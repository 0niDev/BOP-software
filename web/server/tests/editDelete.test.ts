/**
 * Edit / delete / restore round-trips.
 *
 * Every mutation here is checked against the ledger itself: not just "the row
 * is gone", but "the journal entry, stock movement or bank balance it posted is
 * gone with it" — because a document that vanishes while its money stays is
 * exactly the bug this feature exists to prevent.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConflictError } from "../src/domain/errors.js";
import { insertRow } from "../src/repositories/base.js";
import { AccountingService } from "../src/services/accountingService.js";
import { AssetService } from "../src/services/assetService.js";
import { BankingService } from "../src/services/bankingService.js";
import { ExpenseService } from "../src/services/expenseService.js";
import { PaymentService } from "../src/services/paymentService.js";
import { PurchaseInvoiceService } from "../src/services/purchaseInvoiceService.js";
import { RestoreService } from "../src/services/restoreService.js";
import { ReturnsService } from "../src/services/returnsService.js";
import { SalesInvoiceService } from "../src/services/salesInvoiceService.js";
import { freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let expenses: ExpenseService;
let payments: PaymentService;
let sales: SalesInvoiceService;
let purchases: PurchaseInvoiceService;
let banking: BankingService;
let returns: ReturnsService;
let assets: AssetService;
let restore: RestoreService;
let accounting: AccountingService;
let supplierId: number;
let categoryId: number;

beforeEach(async () => {
  ctx = await freshDb();
  expenses = new ExpenseService(ctx.db);
  payments = new PaymentService(ctx.db);
  sales = new SalesInvoiceService(ctx.db);
  purchases = new PurchaseInvoiceService(ctx.db);
  banking = new BankingService(ctx.db);
  returns = new ReturnsService(ctx.db);
  assets = new AssetService(ctx.db);
  restore = new RestoreService(ctx.db);
  accounting = new AccountingService(ctx.db);
  supplierId = await insertRow(ctx.db, "parties", {
    company_id: 1,
    code: "SUP-ED",
    name: "Edit Delete Supplier",
    party_type: "SUPPLIER",
    opening_balance: 0,
    credit_limit: 0,
    is_active: 1,
  });
  categoryId = (await expenses.createCategory("Office Supplies")).id;
});
afterEach(async () => {
  await ctx.db.close();
});

async function balance(code: string): Promise<number> {
  const row = await ctx.db.get<{ balance: number }>(
    `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) AS balance
       FROM journal_entry_lines jel
       JOIN accounts a ON a.id = jel.account_id
       JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE a.company_id = 1 AND a.account_code = ? AND je.is_posted = 1`,
    [code],
  );
  return Number(row?.balance ?? 0);
}

async function journalCount(sourceTable: string, sourceId: number): Promise<number> {
  const row = await ctx.db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM journal_entries WHERE source_table = ? AND source_id = ?",
    [sourceTable, sourceId],
  );
  return Number(row?.count ?? 0);
}

describe("expenses", () => {
  it("edits an expense, replacing its journal entry", async () => {
    const created = await expenses.createExpense({
      categoryId,
      expenseDate: "2026-10-08",
      amount: 250,
      paymentMethod: "CASH",
      description: "Printer paper",
    });
    expect(await balance("1000")).toBe(-250);

    await expenses.updateExpense(created.id, {
      categoryId,
      expenseDate: "2026-10-08",
      amount: 400,
      paymentMethod: "CASH",
      description: "Printer paper and ink",
    });

    expect(await balance("1000")).toBe(-400);
    expect(await balance("6000")).toBe(400);
    expect(await journalCount("expenses", created.id)).toBe(1);
  });

  it("deletes an expense and its journal entry", async () => {
    const created = await expenses.createExpense({
      categoryId,
      expenseDate: "2026-10-08",
      amount: 250,
      paymentMethod: "CASH",
    });

    await expenses.deleteExpense(created.id);
    expect(await journalCount("expenses", created.id)).toBe(0);
    expect(await balance("1000")).toBe(0);
    const row = await ctx.db.get("SELECT id FROM expenses WHERE id = ?", [created.id]);
    expect(row).toBeUndefined();
  });

  it("unsettles a pay-later bill, then allows deleting it", async () => {
    const bill = await expenses.createExpense({
      categoryId,
      expenseDate: "2026-10-08",
      amount: 500,
      paymentMethod: "CASH",
      payLater: true,
    });
    await expenses.payExpense(bill.id, { paymentMethod: "CASH", paymentDate: "2026-10-09" });
    expect(await balance("1000")).toBe(-500);

    await expect(expenses.deleteExpense(bill.id)).rejects.toBeInstanceOf(ConflictError);

    await expenses.deleteExpenseSettlement(bill.id);
    expect(await balance("1000")).toBe(0);
    const row = await ctx.db.get<{ status: string }>(
      "SELECT status FROM expenses WHERE id = ?",
      [bill.id],
    );
    expect(row?.status).toBe("UNPAID");

    await expenses.deleteExpense(bill.id);
    expect(await journalCount("expenses", bill.id)).toBe(0);
  });
});

describe("payments", () => {
  it("deleting a payment puts the invoice's paid_amount back", async () => {
    const invoice = await purchases.createPurchaseInvoice({
      supplierId,
      invoiceDate: "2026-10-08",
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 10, unitCost: 20 }],
    });
    const payment = await payments.paySupplier({
      supplierId,
      amount: 200,
      paymentDate: "2026-10-09",
      paymentMethod: "CASH",
      purchaseInvoiceId: invoice.id,
    });

    let row = await ctx.db.get<{ paid_amount: number }>(
      "SELECT paid_amount FROM purchase_invoices WHERE id = ?",
      [invoice.id],
    );
    expect(row?.paid_amount).toBe(200);
    expect(await balance("1000")).toBe(-200);

    await payments.deletePayment(payment.id);

    row = await ctx.db.get<{ paid_amount: number }>(
      "SELECT paid_amount FROM purchase_invoices WHERE id = ?",
      [invoice.id],
    );
    expect(row?.paid_amount).toBe(0);
    expect(await balance("1000")).toBe(0);
    const entry = await ctx.db.get("SELECT id FROM journal_entries WHERE voucher_number = ?", [
      payment.voucherNumber,
    ]);
    expect(entry).toBeUndefined();
  });

  it("refuses to edit a payment that was applied to an invoice", async () => {
    const invoice = await purchases.createPurchaseInvoice({
      supplierId,
      invoiceDate: "2026-10-08",
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 1, unitCost: 20 }],
    });
    const payment = await payments.paySupplier({
      supplierId,
      amount: 20,
      paymentDate: "2026-10-09",
      paymentMethod: "CASH",
      purchaseInvoiceId: invoice.id,
    });
    await expect(
      payments.updatePayment(payment.id, {
        supplierId,
        amount: 30,
        paymentDate: "2026-10-09",
        paymentMethod: "CASH",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("banking", () => {
  it("edits and deletes a manual deposit", async () => {
    const bank = await banking.createBankAccount({
      bankName: "HBL",
      accountTitle: "BOP",
      accountNumber: "0001",
    });
    const deposit = await banking.deposit({
      bankAccountId: bank.id,
      amount: 500,
      date: "2026-10-08",
    });
    expect(await banking.getBalance(bank.id)).toBe(500);

    await banking.updateTransaction(deposit.id, {
      bankAccountId: bank.id,
      amount: 300,
      date: "2026-10-08",
      type: "DEPOSIT",
    });
    expect(await banking.getBalance(bank.id)).toBe(300);

    await banking.deleteTransaction(deposit.id);
    expect(await banking.getBalance(bank.id)).toBe(0);
  });

  it("cancels a cleared cheque, reversing the bank movement", async () => {
    const bank = await banking.createBankAccount({
      bankName: "HBL",
      accountTitle: "BOP",
      accountNumber: "0002",
    });
    await banking.deposit({ bankAccountId: bank.id, amount: 1000, date: "2026-10-08" });
    const cheque = await banking.issueCheque({
      bankAccountId: bank.id,
      chequeNumber: "CHQ-1",
      amount: 300,
      chequeDate: "2026-10-08",
      partyId: supplierId,
    });
    await banking.clearCheque(cheque.id);
    expect(await banking.getBalance(bank.id)).toBe(700);

    await banking.cancelCheque(cheque.id);
    expect(await banking.getBalance(bank.id)).toBe(1000);
    const row = await ctx.db.get("SELECT id FROM cheques WHERE id = ?", [cheque.id]);
    expect(row).toBeUndefined();
  });
});

describe("returns", () => {
  it("deleting a sales return takes the returned stock back out", async () => {
    const invoice = await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 2, unitPrice: 150 }],
    });
    const [line] = await ctx.db.all<{ id: number }>(
      "SELECT id FROM sales_invoice_items WHERE invoice_id = ?",
      [invoice.id],
    );
    const created = await returns.createSalesReturn({
      invoiceId: invoice.id,
      returnDate: "2026-10-09",
      items: [{ invoiceItemId: line!.id, quantity: 1 }],
    });
    const stock = async () =>
      (
        await ctx.db.get<{ qty: number }>(
          "SELECT quantity_in_stock AS qty FROM stock_batches WHERE batch_number = 'DEMO-BATCH'",
        )
      )?.qty ?? 0;
    expect(await stock()).toBe(999);

    await returns.deleteSalesReturn(created.id);
    expect(await stock()).toBe(998);
    expect(await journalCount("sales_returns", created.id)).toBe(0);
  });
});

describe("assets", () => {
  it("edits an asset purchase and disposes it with a gain/loss entry", async () => {
    const asset = await assets.create({
      assetName: "Delivery Van",
      assetCode: "1506",
      amount: 10_000,
      purchaseDate: "2026-10-08",
      paymentType: "CASH",
    });
    const cashBefore = await balance("1000");

    await assets.update(asset.account_id, {
      assetName: "Delivery Van",
      assetCode: "1506",
      amount: 12_000,
      purchaseDate: "2026-10-08",
      paymentType: "CASH",
    });
    expect(await balance("1000")).toBe(cashBefore - 2_000);

    const result = await assets.dispose(asset.account_id, {
      disposeDate: "2026-10-10",
      proceeds: 4_000,
    });
    expect(result.gainLoss).toBe(-8_000);
    expect(await balance("6900")).toBe(8_000);
    expect(await balance("1000")).toBe(cashBefore - 2_000 + 4_000);
    expect(await balance("1506")).toBe(0);
  });

  it("deletes a freshly bought asset and its journal entry", async () => {
    const asset = await assets.create({
      assetName: "Laptop",
      assetCode: "1506",
      amount: 2_000,
      purchaseDate: "2026-10-08",
      paymentType: "CREDIT",
      supplierId,
    });
    await assets.delete(asset.account_id);
    expect(await journalCount("asset_details", asset.account_id)).toBe(0);
    expect(await balance("2000")).toBe(0);

    // Restoring brings the account back onto the list, not just the ledger.
    const entry = (await restore.listDeleted()).find(
      (row) => row.entity_table === "assets" && !row.restored,
    );
    const result = await restore.restore(entry!.id);
    expect((await assets.list()).some((row) => row.account_id === result.id)).toBe(true);
  });
});

describe("invoice paid guard", () => {
  it("refuses to cancel a credit invoice with payments, then allows it after they go", async () => {
    const invoice = await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 2, unitPrice: 100 }],
    });
    const receipt = await payments.receivePayment({
      customerId: ctx.ids.customerId,
      amount: 100,
      paymentDate: "2026-10-09",
      paymentMethod: "CASH",
      salesInvoiceId: invoice.id,
    });

    await expect(sales.deleteSalesInvoice(invoice.id)).rejects.toBeInstanceOf(ConflictError);

    await payments.deleteReceipt(receipt.id);
    await sales.deleteSalesInvoice(invoice.id);
    const row = await ctx.db.get<{ status: string }>(
      "SELECT status FROM sales_invoices WHERE id = ?",
      [invoice.id],
    );
    expect(row?.status).toBe("CANCELLED");
  });
});

describe("restore", () => {
  it("restores a deleted expense through the audit trail", async () => {
    const created = await expenses.createExpense({
      categoryId,
      expenseDate: "2026-10-08",
      amount: 250,
      paymentMethod: "CASH",
      description: "Restorable",
    });
    await expenses.deleteExpense(created.id);
    expect(await balance("1000")).toBe(0);

    const deleted = await restore.listDeleted();
    const entry = deleted.find((row) => row.entity_table === "expenses" && !row.restored);
    expect(entry).toBeDefined();

    const result = await restore.restore(entry!.id);
    expect(result.table).toBe("expenses");
    expect(await balance("1000")).toBe(-250);
    const row = await ctx.db.get<{ description: string }>(
      "SELECT description FROM expenses WHERE id = ?",
      [result.id],
    );
    expect(row?.description).toBe("Restorable");

    // A second restore of the same deletion is refused.
    await expect(restore.restore(entry!.id)).rejects.toBeInstanceOf(Error);
  });
});
