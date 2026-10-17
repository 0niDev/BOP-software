/**
 * Regression tests for the defects found during the adversarial test pass:
 * voucher numbering, sequence reconciliation, quantity precision, stock
 * movements, COGS account mapping, payment references and bank guards.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ValidationError } from "../src/domain/errors.js";
import { toQuantity, toStorage } from "../src/domain/money.js";
import { insertRow } from "../src/repositories/base.js";
import { reconcileNumberingSequences } from "../src/db/bootstrap.js";
import { AccountingService } from "../src/services/accountingService.js";
import { BankingService } from "../src/services/bankingService.js";
import { ItemService } from "../src/services/itemService.js";
import { PaymentService } from "../src/services/paymentService.js";
import { PurchaseInvoiceService } from "../src/services/purchaseInvoiceService.js";
import { ReturnsService } from "../src/services/returnsService.js";
import { SalesInvoiceService } from "../src/services/salesInvoiceService.js";
import { freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let sales: SalesInvoiceService;
let purchases: PurchaseInvoiceService;
let accounting: AccountingService;
let supplierId: number;

beforeEach(async () => {
  ctx = await freshDb();
  sales = new SalesInvoiceService(ctx.db);
  purchases = new PurchaseInvoiceService(ctx.db);
  accounting = new AccountingService(ctx.db);
  supplierId = await insertRow(ctx.db, "parties", {
    company_id: 1,
    code: "SUP-FIX",
    name: "Fix Supplier",
    party_type: "SUPPLIER",
    opening_balance: 0,
    credit_limit: 0,
    is_active: 1,
  });
});

afterEach(async () => {
  await ctx.db.close();
});

async function scalar(sql: string, ...params: Array<string | number>): Promise<number> {
  const row = await ctx.db.get<{ v: number | null }>(sql, params);
  return Number(row?.v ?? 0);
}

describe("F1: gap-free numbering", () => {
  it("issues the first number as 00001 and shares it with the journal entry", async () => {
    const invoice = await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      items: [{ itemId: ctx.ids.itemId, quantity: 1, unitPrice: 150 }],
    });
    expect(invoice.invoiceNumber).toBe("SI-00001");

    const je = await ctx.db.get<{ voucher_number: string }>(
      "SELECT voucher_number FROM journal_entries WHERE source_table = 'sales_invoices' AND source_id = ?",
      [invoice.id],
    );
    // The document number and its ledger voucher number must be identical.
    expect(je?.voucher_number).toBe("SI-00001");

    const next = await ctx.db.get<{ next_number: number }>(
      "SELECT next_number FROM numbering_sequences WHERE document_type = 'SALES_INVOICE'",
    );
    expect(next?.next_number).toBe(2);
  });
});

describe("F2: sequence reconciliation", () => {
  it("advances a stale ITEM sequence past existing codes so creation cannot collide", async () => {
    await insertRow(ctx.db, "items", {
      company_id: 1,
      item_code: "ITEM-00002",
      item_name: "Pre-existing",
      unit: "UNIT",
      item_type: "RAW_MATERIAL",
      purchase_price: 0,
      selling_price: 0,
      minimum_stock: 0,
      maximum_stock: 0,
      is_active: 1,
    });
    await ctx.db.run("UPDATE numbering_sequences SET next_number = 1 WHERE document_type = 'ITEM'");

    await reconcileNumberingSequences(ctx.db, 1);

    const next = await ctx.db.get<{ next_number: number }>(
      "SELECT next_number FROM numbering_sequences WHERE document_type = 'ITEM'",
    );
    expect(next?.next_number).toBe(3);

    const created = await new ItemService(ctx.db).create({
      itemName: "Newly created",
      unit: "UNIT",
      itemType: "RAW_MATERIAL",
    });
    expect(created.item_code).toBe("ITEM-00003");
  });
});

describe("F3/F5: numeric bounds and quantity precision", () => {
  it("rejects amounts and quantities beyond the storage ceiling", () => {
    expect(() => toStorage(1e21)).toThrow(ValidationError);
    expect(() => toQuantity(1e21)).toThrow(ValidationError);
    expect(() => toStorage(Number.POSITIVE_INFINITY)).toThrow(ValidationError);
  });

  it("keeps sub-cent quantities in stock instead of rounding them to zero", async () => {
    const result = await purchases.createPurchaseInvoice({
      supplierId,
      invoiceDate: "2026-10-08",
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 0.001, unitCost: 10, batchNumber: "FIX-Q" }],
    });
    const batch = await ctx.db.get<{ qty: number }>(
      "SELECT quantity_in_stock AS qty FROM stock_batches WHERE batch_number = 'FIX-Q'",
    );
    const line = await ctx.db.get<{ quantity: number }>(
      "SELECT quantity FROM purchase_invoice_items WHERE invoice_id = ?",
      [result.id],
    );
    expect(batch?.qty).toBe(0.001);
    expect(line?.quantity).toBe(0.001);
  });
});

describe("F4: stock movements mirror stock batches", () => {
  it("records a movement for every purchase and sale, keeping the two in step", async () => {
    await purchases.createPurchaseInvoice({
      supplierId,
      invoiceDate: "2026-10-08",
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 10, unitCost: 50, batchNumber: "FIX-M" }],
    });
    await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-09",
      paymentType: "CASH",
      items: [{ itemId: ctx.ids.itemId, quantity: 3, unitPrice: 150 }],
    });

    const moved = await scalar("SELECT COALESCE(SUM(quantity), 0) AS v FROM stock_movements");
    const onHand = await scalar("SELECT COALESCE(SUM(quantity_in_stock), 0) AS v FROM stock_batches");
    expect(moved).toBeCloseTo(onHand, 6);

    const saleMovement = await ctx.db.get<{ quantity: number }>(
      "SELECT quantity FROM stock_movements WHERE movement_type = 'SALE'",
    );
    expect(saleMovement?.quantity).toBe(-3);
  });
});

describe("F9: returns reverse the COGS account the sale used", () => {
  it("nets COGS to zero over a raw-material sale and full return", async () => {
    // 5002 is part of the bootstrap seed, so the sale and its return both land
    // on the raw-material COGS account without a test-local workaround.
    const rawItemId = await insertRow(ctx.db, "items", {
      company_id: 1,
      item_code: "RAW-FIX",
      item_name: "Raw Fix",
      unit: "KG",
      item_type: "RAW_MATERIAL",
      purchase_price: 10,
      selling_price: 0,
      minimum_stock: 0,
      maximum_stock: 0,
      is_active: 1,
    });
    await insertRow(ctx.db, "stock_batches", {
      item_id: rawItemId,
      warehouse_id: 1,
      batch_number: "RAW-FIX-B",
      purchase_price: 10,
      raw_unit_cost: 10,
      packing_unit_cost: 0,
      quantity_in_stock: 100,
      is_active: 1,
    });

    const invoice = await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CREDIT",
      items: [{ itemId: rawItemId, quantity: 2, unitPrice: 100 }],
    });
    const jeSale = await accounting.getJournalEntry("sales_invoices", invoice.id);
    expect(
      (jeSale!.lines as Array<{ account_code: string; debit: number }>).find(
        (l) => l.account_code === "5002",
      )?.debit,
    ).toBe(20);

    const items = await ctx.db.all<{ id: number }>(
      "SELECT id FROM sales_invoice_items WHERE invoice_id = ?",
      [invoice.id],
    );
    const ret = await new ReturnsService(ctx.db).createSalesReturn({
      invoiceId: invoice.id,
      returnDate: "2026-10-09",
      items: [{ invoiceItemId: items[0]!.id, quantity: 2 }],
    });
    const jeRet = await accounting.getJournalEntry("sales_returns", ret.id);
    const retLines = jeRet!.lines as Array<{ account_code: string; credit: number }>;
    expect(retLines.find((l) => l.account_code === "5002")?.credit).toBe(20);
    expect(retLines.find((l) => l.account_code === "5000")).toBeUndefined();
  });
});

describe("F10: payment references are persisted", () => {
  it("stores the reference number on the journal entry", async () => {
    const invoice = await purchases.createPurchaseInvoice({
      supplierId,
      invoiceDate: "2026-10-08",
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 1, unitCost: 100 }],
    });
    await new PaymentService(ctx.db).paySupplier({
      supplierId,
      amount: 100,
      paymentDate: "2026-10-08",
      paymentMethod: "CASH",
      purchaseInvoiceId: invoice.id,
      referenceNo: "REF-12345",
    });
    const row = await ctx.db.get<{ reference_no: string }>(
      "SELECT reference_no FROM journal_entries WHERE voucher_type = 'PAYMENT'",
    );
    expect(row?.reference_no).toBe("REF-12345");
  });
});

describe("F6: bank accounts cannot be overdrawn", () => {
  it("refuses a withdrawal larger than the bank balance", async () => {
    const banking = new BankingService(ctx.db);
    const account = await banking.createBankAccount({
      bankName: "HBL",
      accountTitle: "Main",
      accountNumber: "FIX-1",
      openingBalance: 100,
    });
    await expect(
      banking.withdraw({ bankAccountId: account.id, amount: 500, date: "2026-10-08" }),
    ).rejects.toBeInstanceOf(ValidationError);
    // A valid withdrawal still works.
    await banking.withdraw({ bankAccountId: account.id, amount: 50, date: "2026-10-08" });
    expect(await banking.getBalance(account.id)).toBe(50);
  });
});

describe("F11: identical settlements are not posted twice", () => {
  it("rejects a repeated supplier payment carrying the same reference", async () => {
    const payments = new PaymentService(ctx.db);
    const invoice = await purchases.createPurchaseInvoice({
      supplierId,
      invoiceDate: "2026-10-08",
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 1, unitCost: 100 }],
    });
    const first = await payments.paySupplier({
      supplierId,
      amount: 100,
      paymentDate: "2026-10-08",
      paymentMethod: "CASH",
      purchaseInvoiceId: invoice.id,
      referenceNo: "DUP-REF-1",
    });
    expect(first.voucherNumber).toMatch(/^PV-\d+$/);

    await expect(
      payments.paySupplier({
        supplierId,
        amount: 100,
        paymentDate: "2026-10-08",
        paymentMethod: "CASH",
        purchaseInvoiceId: invoice.id,
        referenceNo: "DUP-REF-1",
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    // The retry must not have created a second payment or disbursed cash twice.
    expect(await scalar("SELECT COUNT(*) AS v FROM payments")).toBe(1);
    const cash = await ctx.db.get<{ balance: number | null }>(
      `SELECT SUM(l.debit - l.credit) AS balance FROM journal_entry_lines l
       JOIN accounts a ON a.id = l.account_id WHERE a.account_code = '1000'`,
    );
    expect(Number(cash?.balance ?? 0)).toBe(-100);
  });

  it("rejects a repeated customer receipt carrying the same reference", async () => {
    const payments = new PaymentService(ctx.db);
    const invoice = await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 2, unitPrice: 150 }],
    });
    await payments.receivePayment({
      customerId: ctx.ids.customerId,
      amount: 300,
      paymentDate: "2026-10-08",
      paymentMethod: "BANK",
      salesInvoiceId: invoice.id,
      referenceNo: "RCPT-DUP-9",
    });
    await expect(
      payments.receivePayment({
        customerId: ctx.ids.customerId,
        amount: 300,
        paymentDate: "2026-10-08",
        paymentMethod: "BANK",
        salesInvoiceId: invoice.id,
        referenceNo: "RCPT-DUP-9",
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(await scalar("SELECT COUNT(*) AS v FROM receipts")).toBe(1);
  });
});
