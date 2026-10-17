/**
 * Deterministic demo data used by `npm run seed` and the HTTP smoke test.
 * Idempotent: looks up by code and only inserts what is missing. Only ever
 * run against the local development database.
 */
import { bootstrapDatabase } from "./db/bootstrap.js";
import type { SqlDatabase } from "./db/types.js";
import { AccountingService } from "./services/accountingService.js";
import { BankingService } from "./services/bankingService.js";
import { ExpenseItemService } from "./services/expenseItemService.js";
import { ExpenseService } from "./services/expenseService.js";
import { ManufacturingService } from "./services/manufacturingService.js";
import { PaymentService } from "./services/paymentService.js";
import { PurchaseInvoiceService } from "./services/purchaseInvoiceService.js";
import { ReturnsService } from "./services/returnsService.js";
import { SalesInvoiceService } from "./services/salesInvoiceService.js";
import { AssetService } from "./services/assetService.js";
import { SystemAccountResolver } from "./repositories/systemAccounts.js";
import { insertRow } from "./repositories/base.js";

export const DEMO_CUSTOMER_CODE = "DEMO-CUST";
export const DEMO_SUPPLIER_CODE = "DEMO-SUPP";
export const DEMO_ITEM_CODE = "DEMO-FG";

export interface DemoIds {
  customerId: number;
  supplierId: number;
  itemId: number;
  batchId: number;
  /** Extra parties/items for the rich demo set. */
  extraCustomer?: number;
  extraSupplier?: number;
  rawItem?: number;
  packingItem?: number;
  expenseCategoryId?: number;
  bankAccountId?: number;
  expenseItemId?: number;
}

/**
 * Date used for the rich demo transactions (all in the past, balanced). Shared
 * with the acceptance test so the period assertions cannot drift from the seed.
 */
export const RICH_DEMO_DATE = "2024-06-15";

export async function seedDemoData(db: SqlDatabase, companyId = 1): Promise<DemoIds> {
  await bootstrapDatabase(db);

  // --- Core demo party / item / batch (kept for backward compat) ---
  let customer = await db.get<{ id: number }>(
    "SELECT id FROM parties WHERE company_id = ? AND code = ?",
    [companyId, DEMO_CUSTOMER_CODE],
  );
  if (!customer) {
    const id = await insertRow(db, "parties", {
      company_id: companyId,
      code: DEMO_CUSTOMER_CODE,
      name: "Demo Customer",
      party_type: "CUSTOMER",
      opening_balance: 0,
      credit_limit: 0,
      is_active: 1,
    });
    customer = { id };
  }

  let supplier = await db.get<{ id: number }>(
    "SELECT id FROM parties WHERE company_id = ? AND code = ?",
    [companyId, DEMO_SUPPLIER_CODE],
  );
  if (!supplier) {
    const id = await insertRow(db, "parties", {
      company_id: companyId,
      code: DEMO_SUPPLIER_CODE,
      name: "Demo Supplier",
      party_type: "SUPPLIER",
      opening_balance: 0,
      credit_limit: 0,
      is_active: 1,
    });
    supplier = { id };
  }

  let item = await db.get<{ id: number }>(
    "SELECT id FROM items WHERE company_id = ? AND item_code = ?",
    [companyId, DEMO_ITEM_CODE],
  );
  if (!item) {
    const id = await insertRow(db, "items", {
      company_id: companyId,
      item_code: DEMO_ITEM_CODE,
      item_name: "Demo Finished Good",
      unit: "UNIT",
      item_type: "FINISHED_GOOD",
      purchase_price: 100,
      selling_price: 150,
      minimum_stock: 0,
      maximum_stock: 0,
      is_active: 1,
    });
    item = { id };
  }

  let batch = await db.get<{ id: number }>(
    "SELECT id FROM stock_batches WHERE item_id = ? AND warehouse_id = 1 AND batch_number = 'DEMO-BATCH'",
    [item.id],
  );
  if (!batch) {
    const id = await insertRow(db, "stock_batches", {
      item_id: item.id,
      warehouse_id: 1,
      batch_number: "DEMO-BATCH",
      raw_unit_cost: 60,
      packing_unit_cost: 40,
      purchase_price: 100,
      quantity_in_stock: 1000,
      is_active: 1,
    });
    // Log the opening quantity as a movement so on-hand stock always equals
    // SUM(stock_movements) (the invariant the acceptance audit relies on).
    await insertRow(db, "stock_movements", {
      item_id: item.id,
      batch_id: id,
      warehouse_id: 1,
      movement_type: "OPENING",
      quantity: 1000,
      unit_cost: 100,
      movement_date: "2024-01-01",
      notes: "Opening stock - Demo Finished Good",
    });
    batch = { id };
  }

  const ids: DemoIds = {
    customerId: customer.id,
    supplierId: supplier.id,
    itemId: item.id,
    batchId: batch.id,
  };

  return ids;
}

/**
 * Rich demo data for the running application — only invoked by `npm run seed
 * (rich)` or the app bootstrap, NOT by tests. Creates parties of both types,
 * raw/packing/finished items, purchase invoices that create batches, credit +
 * cash sales, receipts/payments, a production order + BOM, expenses (incl.
 * recurring pay-items and a bulk "Pay items"), bank account + deposit/withdraw
 * + issue/receive/clear cheques, a sales return and a purchase return, a fixed
 * asset purchase, and an opening balance.
 *
 * Idempotent: safe to re-run.
 *
 * Returns how many journal entries it created (0 when the data was already
 * there), so callers can report what actually happened.
 */
export async function seedRichDemoData(
  db: SqlDatabase,
  ids: DemoIds,
  companyId = 1,
): Promise<number> {
  const accounting = new AccountingService(db, companyId);
  const sales = new SalesInvoiceService(db, companyId);
  const purchases = new PurchaseInvoiceService(db, companyId);
  const payments = new PaymentService(db, companyId);
  const banking = new BankingService(db, companyId);
  const expenses = new ExpenseService(db, companyId);
  const expenseItems = new ExpenseItemService(db, companyId);
  const asset = new AssetService(db, companyId);
  const returns_ = new ReturnsService(db, companyId);
  const manufacturing = new ManufacturingService(db, companyId);
  const resolver = new SystemAccountResolver(db, companyId);

  const ensureParty = async (code: string, name: string, type: "CUSTOMER" | "SUPPLIER" | "BOTH") => {
    const existing = await db.get<{ id: number }>(
      "SELECT id FROM parties WHERE company_id = ? AND code = ?",
      [companyId, code],
    );
    if (existing) return existing.id;
    return insertRow(db, "parties", {
      company_id: companyId,
      code,
      name,
      party_type: type,
      opening_balance: 0,
      credit_limit: 0,
      is_active: 1,
    });
  };

  const ensureItem = async (
    code: string,
    name: string,
    itemType: "RAW_MATERIAL" | "PACKING_MATERIAL" | "FINISHED_GOOD",
    purchasePrice: number,
    sellingPrice: number,
  ) => {
    const existing = await db.get<{ id: number }>(
      "SELECT id FROM items WHERE company_id = ? AND item_code = ?",
      [companyId, code],
    );
    if (existing) return existing.id;
    return insertRow(db, "items", {
      company_id: companyId,
      item_code: code,
      item_name: name,
      unit:
        itemType === "RAW_MATERIAL" ? "KG" : itemType === "PACKING_MATERIAL" ? "BOX" : "UNIT",
      item_type: itemType,
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      minimum_stock: 0,
      maximum_stock: 0,
      is_active: 1,
    });
  };

  // Skip if the rich demo transactions already exist (idempotency).
  const count = await db.get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM journal_entries WHERE company_id = ? AND narration LIKE 'RICH DEMO%'",
    [companyId],
  );
  if (count && count.n > 0) return 0;

  const entriesBefore = await db.get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM journal_entries WHERE company_id = ?",
    [companyId],
  );

  await db.transaction(async () => {
    const demoDate = RICH_DEMO_DATE;

    // -- Extra parties --
    const extraCustomerId = await ensureParty("DEMO-CUST2", "Second Customer", "CUSTOMER");
    const extraSupplierId = await ensureParty("DEMO-SUPP2", "Second Supplier", "SUPPLIER");

    // -- Extra items --
    const rawItemId = await ensureItem("DEMO-RAW", "Demo Raw Material", "RAW_MATERIAL", 60, 0);
    const packingItemId = await ensureItem("DEMO-PACK", "Demo Packing Box", "PACKING_MATERIAL", 40, 0);
    const secondFgId = await ensureItem("DEMO-FG2", "Demo Small Bottle", "FINISHED_GOOD", 0, 200);

    // -- Bank account with opening balance --
    const bankAccount = await banking.createBankAccount({
      bankName: "Demo Bank Limited",
      accountTitle: "BOP ERP Operating Account",
      accountNumber: "0123456789",
      openingBalance: 50000,
      branchCode: "BR001",
    });

    // -- Expense category + item --
    const expenseCat = await expenses.createCategory("Utilities", undefined);
    const expItem = await expenseItems.create({
      categoryId: expenseCat.id,
      name: "Electricity Bill",
      amount: 5000,
    });

    // -- Purchase invoice: credit purchase from supplier (creates stock + AP) --
    await purchases.createPurchaseInvoice({
      supplierId: extraSupplierId,
      invoiceDate: demoDate,
      paymentType: "CREDIT",
      invoiceNumber: "PI-DEMO-001",
      items: [{ itemId: rawItemId, quantity: 100, unitCost: 55, taxAmount: 0 }],
    });

    // Purchase via bank (creates another batch)
    await purchases.createPurchaseInvoice({
      supplierId: extraSupplierId,
      invoiceDate: demoDate,
      paymentType: "BANK",
      invoiceNumber: "PI-DEMO-002",
      bankAccountId: bankAccount.id,
      items: [{ itemId: packingItemId, quantity: 200, unitCost: 35, taxAmount: 0 }],
    });

    // -- Cash sale to original customer --
    await sales.createSalesInvoice({
      customerId: ids.customerId,
      invoiceDate: demoDate,
      paymentType: "CASH",
      invoiceNumber: "SI-DEMO-001",
      items: [{ itemId: ids.itemId, quantity: 100, unitPrice: 150, taxAmount: 0 }],
    });

    // -- Credit sale to extra customer (settled later with a receipt) --
    const creditSale = await sales.createSalesInvoice({
      customerId: extraCustomerId,
      invoiceDate: demoDate,
      paymentType: "CREDIT",
      invoiceNumber: "SI-DEMO-002",
      items: [{ itemId: ids.itemId, quantity: 200, unitPrice: 150, taxAmount: 0 }],
    });

    // -- Receipt from customer settles the credit sale --
    await payments.receivePayment({
      customerId: extraCustomerId,
      amount: 30000,
      paymentDate: demoDate,
      paymentMethod: "BANK",
    });

    // -- Payment to supplier settles part of the credit purchase --
    await payments.paySupplier({
      supplierId: extraSupplierId,
      amount: 4000,
      paymentDate: demoDate,
      paymentMethod: "BANK",
    });

    // -- Bank deposit / withdrawal --
    await banking.deposit({
      bankAccountId: bankAccount.id,
      amount: 10000,
      date: demoDate,
      referenceNo: "DEP001",
    });
    await banking.withdraw({
      bankAccountId: bankAccount.id,
      amount: 5000,
      date: demoDate,
      referenceNo: "WTH001",
    });

    // -- Cheque flow: issue from bank, then clear --
    const cheque = await banking.issueCheque({
      bankAccountId: bankAccount.id,
      chequeNumber: "CHQ001",
      amount: 7500,
      chequeDate: demoDate,
      partyId: extraSupplierId,
    });
    await banking.clearCheque(cheque.id);

    // -- Fixed asset purchase (credit) --
    await asset.create({
      assetName: "Office Computer",
      assetCode: "1501",
      amount: 120000,
      purchaseDate: demoDate,
      paymentType: "CREDIT",
      classification: "CURRENT",
      supplierId: extraSupplierId,
    });

    // -- Expense via category, then bulk pay-items --
    await expenses.createExpense({
      categoryId: expenseCat.id,
      expenseDate: demoDate,
      amount: 3000,
      paymentMethod: "CASH",
      description: "Monthly utilities",
    });
    await expenseItems.payItems({
      categoryId: expenseCat.id,
      selections: [{ itemId: expItem.id, amount: 5000 }],
      paymentMethod: "BANK",
      expenseDate: demoDate,
    });

    // -- Manufacturing: BOM + production order for second FG --
    const bom = await manufacturing.createBom({
      finishedItemId: secondFgId,
      outputQuantity: 100,
      components: [
        { componentItemId: rawItemId, quantityRequired: 50 },
        { componentItemId: packingItemId, quantityRequired: 100 },
      ],
    });
    const order = await manufacturing.createProductionOrder({
      bomId: bom.id,
      plannedQuantity: 100,
      manufacturingDate: demoDate,
    });
    await manufacturing.startProduction(order.id);
    await manufacturing.completeProduction(order.id, {
      actualQuantity: 100,
      outputBatchNumber: "PROD-DEMO-001",
    });

    // -- Sales return (partial: return 50 of the 200 units sold) --
    const saleItems = await db.all<{ id: number }>(
      "SELECT id FROM sales_invoice_items WHERE invoice_id = ? ORDER BY id LIMIT 1",
      [creditSale.id],
    );
    if (saleItems[0]) {
      await returns_.createSalesReturn({
        invoiceId: creditSale.id,
        returnDate: demoDate,
        items: [{ invoiceItemId: saleItems[0].id, quantity: 50 }],
      });
    }

    // -- Purchase return (partial: return 20 of the 100 raw units) --
    const purchInv = await db.get<{ id: number }>(
      "SELECT id FROM purchase_invoices WHERE company_id = ? AND invoice_number = ?",
      [companyId, "PI-DEMO-001"],
    );
    if (purchInv) {
      const items = await db.all<{ id: number }>(
        "SELECT id FROM purchase_invoice_items WHERE invoice_id = ? ORDER BY id LIMIT 1",
        [purchInv.id],
      );
      if (items[0]) {
        await returns_.createPurchaseReturn({
          invoiceId: purchInv.id,
          returnDate: demoDate,
          items: [{ invoiceItemId: items[0].id, quantity: 20 }],
        });
      }
    }

    // --- Opening balances ---
    await accounting.postJournalEntry({
      voucherType: "OPENING",
      entryDate: "2024-01-01",
      lines: [
        { accountId: await resolver.idFor("1220"), debit: 50000, description: "Opening finished goods" },
        { accountId: await resolver.idFor("3100"), credit: 50000, description: "Opening equity" },
      ],
      // Number auto-allocated from the OPENING sequence; hard-coding OB-00001
      // would collide with the bank account's own opening entry.
      narration: "RICH DEMO: Opening balances - January 2024",
    });
  });

  const entriesAfter = await db.get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM journal_entries WHERE company_id = ?",
    [companyId],
  );
  return Number(entriesAfter?.n ?? 0) - Number(entriesBefore?.n ?? 0);
}
