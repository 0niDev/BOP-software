/**
 * End-to-end QA harness: bootstrap an EMPTY database and walk the whole
 * accounting dataflow through the real services, then verify the ledger,
 * numbering, stock valuation and the financial reports against each other.
 *
 * Run:  npm -w @bop-erp/server run qa:dataflow
 *
 * Every money figure is recalculated in exact decimal (Decimal) and compared,
 * never eyeballed. A non-zero exit code means at least one check FAILED.
 */
import fs from "node:fs";
import path from "node:path";
import { LocalSqliteDatabase } from "./db/localSqlite.js";
import { bootstrapDatabase } from "./db/bootstrap.js";
import { SCHEMA_SQL } from "./db/schema.js";
import { Decimal } from "./domain/money.js";
import { webRoot } from "./env.js";
import type { SqlDatabase } from "./db/types.js";
import { SystemAccountResolver } from "./repositories/systemAccounts.js";
import { AccountingService } from "./services/accountingService.js";
import { AccountService } from "./services/accountService.js";
import { BankingService } from "./services/bankingService.js";
import { ItemService } from "./services/itemService.js";
import { ManufacturingService } from "./services/manufacturingService.js";
import { PartyService } from "./services/partyService.js";
import { PaymentService } from "./services/paymentService.js";
import { PurchaseInvoiceService } from "./services/purchaseInvoiceService.js";
import { ReportService } from "./services/reportService.js";
import { ReturnsService } from "./services/returnsService.js";
import { SalesInvoiceService } from "./services/salesInvoiceService.js";

// --- reporting -----------------------------------------------------------

type Status = "PASS" | "FAIL" | "INFO";
const log: Array<{ phase: string; name: string; status: Status; detail: string }> = [];
let failures = 0;

function record(phase: string, status: Status, name: string, detail = ""): void {
  if (status === "FAIL") failures += 1;
  log.push({ phase, name, status, detail });
  const tag = status.padEnd(4);
  console.log(`  [${tag}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function check(phase: string, name: string, ok: boolean, detail = ""): void {
  record(phase, ok ? "PASS" : "FAIL", name, detail);
}

function eq(phase: string, name: string, actual: Decimal | number, expected: Decimal | number): void {
  const a = new Decimal(actual);
  const e = new Decimal(expected);
  check(phase, name, a.minus(e).abs().lessThan(new Decimal("0.005")), `actual=${a.toFixed(2)} expected=${e.toFixed(2)}`);
}

function info(phase: string, name: string, detail = ""): void {
  record(phase, "INFO", name, detail);
}

function section(title: string): void {
  console.log(`\n${"=".repeat(78)}\n${title}\n${"=".repeat(78)}`);
}

function d(value: unknown): Decimal {
  return new Decimal((value ?? 0) as number);
}

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`QA harness precondition failed: ${label} is undefined`);
  return value;
}

/** Captures an error thrown by a service call so a failure can be asserted. */
async function expectError(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "";
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

// --- scenario constants --------------------------------------------------

const TODAY = new Date().toISOString().slice(0, 10);
const COMPONENT_RM_PER_1000 = new Decimal("15"); // KG per 1,000 tablets
const COMPONENT_PM_PER_1000 = new Decimal("250"); // UNIT per 1,000 tablets
const RM_WASTAGE_PERCENT = new Decimal("2");

const REQUIRED_ACCOUNTS: ReadonlyArray<[string, string]> = [
  ["1000", "Cash in Hand"],
  ["1010", "Bank Accounts"],
  ["1100", "Accounts Receivable"],
  ["1220", "Inventory - Finished Goods"],
  ["2000", "Accounts Payable"],
  ["4000", "Sales Revenue"],
  ["5000", "Cost of Goods Sold"],
  ["5001", "Cost of Packing Materials"],
  ["5002", "Cost of Raw Materials"],
  ["5200", "Manufacturing Wastage Expense"],
  ["2100", "Sales Tax Payable"],
];

async function main(): Promise<void> {
  const dbPath = path.resolve(webRoot, "data/qa-dataflow.sqlite");
  fs.rmSync(dbPath, { force: true });
  for (const suffix of ["-wal", "-shm"]) fs.rmSync(`${dbPath}${suffix}`, { force: true });

  const db = new LocalSqliteDatabase(dbPath);
  const companyId = 1;
  const accounting = new AccountingService(db, companyId);
  const accounts = new AccountService(db, companyId);
  const items = new ItemService(db, companyId, 1);
  const parties = new PartyService(db, companyId);
  const purchases = new PurchaseInvoiceService(db, companyId);
  const manufacturing = new ManufacturingService(db, companyId);
  const sales = new SalesInvoiceService(db, companyId);
  const returns = new ReturnsService(db, companyId);
  const banking = new BankingService(db, companyId);
  const payments = new PaymentService(db, companyId);
  const reports = new ReportService(db, companyId);
  const resolver = new SystemAccountResolver(db, companyId);

  console.log(`QA dataflow run on a fresh database: ${dbPath}`);

  // ======================================================================
  section("PHASE 0 — Bootstrap & initialization");
  // ======================================================================
  const schemaTables = (SCHEMA_SQL.match(/CREATE TABLE IF NOT EXISTS \w+/g) ?? []).length;
  await bootstrapDatabase(db);

  const tableRows = await db.all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  info("P0", `schema.ts declares ${schemaTables} tables; sqlite_master reports ${tableRows.length}`);
  check(
    "P0",
    "all schema tables exist after bootstrap",
    tableRows.length === schemaTables,
    `${tableRows.length}/${schemaTables}`,
  );

  const seeded = await db.all<{ account_code: string; account_name: string; account_type: string; is_system_account: number }>(
    "SELECT account_code, account_name, account_type, is_system_account FROM accounts WHERE company_id = ? ORDER BY account_code",
    [companyId],
  );
  const seededCodes = new Map(seeded.map((row) => [row.account_code, row]));
  info("P0", `chart of accounts seeded: ${seeded.length} accounts (all flagged is_system_account=1)`);
  check(
    "P0",
    "every non-system table starts empty (zero business data)",
    (await scalar(db, "SELECT COUNT(*) FROM journal_entries")) === 0 &&
      (await scalar(db, "SELECT COUNT(*) FROM items")) === 0 &&
      (await scalar(db, "SELECT COUNT(*) FROM parties")) === 0,
  );

  for (const [code, name] of REQUIRED_ACCOUNTS) {
    const row = seededCodes.get(code);
    check(
      "P0",
      `account ${code} (${name}) exists`,
      row !== undefined,
      row ? `found "${row.account_name}" [${row.account_type}]` : "MISSING from bootstrap seed",
    );
  }
  const nonSystem = seeded.filter((row) => row.is_system_account !== 1);
  check("P0", "all seeded accounts are marked system accounts", nonSystem.length === 0, `${nonSystem.length} not flagged`);

  // Cache proof: resolve, delete the row inside a rolled-back transaction,
  // resolve again. A cache hit must still answer; a fresh resolver must not.
  const cachedProbe = await db.transaction(async () => {
    const first = await resolver.idFor("1000");
    await db.run("UPDATE accounts SET account_code = 'TMP-DELETED' WHERE account_code = '1000'");
    const second = await resolver.idFor("1000");
    const freshResolver = new SystemAccountResolver(db, companyId);
    const freshMessage = await expectError(() => freshResolver.idFor("1000"));
    throw Object.assign(new Error("rollback"), { probe: { first, second, freshMessage } });
  }).catch((err: unknown) => (err as { probe: { first: number; second: number; freshMessage: string } }).probe);

  check(
    "P0",
    "SystemAccountResolver caches a hit",
    cachedProbe.first === cachedProbe.second,
    `id=${cachedProbe.first} returned from cache after the row was removed from the table`,
  );
  check(
    "P0",
    "a resolver without the cache still reads through and fails loudly",
    cachedProbe.freshMessage.includes("Required system account '1000' is missing"),
    cachedProbe.freshMessage || "(no error thrown)",
  );

  // ======================================================================
  section("PHASE 1 — Opening balances, items and Stage 1 validation");
  // ======================================================================
  const id = {
    cash: await resolver.idFor("1000"),
    bank: await resolver.idFor("1010"),
    ar: await resolver.idFor("1100"),
    invRm: await resolver.idFor("1200"),
    invPm: await resolver.idFor("1210"),
    invFg: await resolver.idFor("1220"),
    ap: await resolver.idFor("2000"),
    tax: await resolver.idFor("2100"),
    equity: await resolver.idFor("3000"),
    retained: await resolver.idFor("3100"),
    revenue: await resolver.idFor("4000"),
    salesReturns: await resolver.idFor("4100"),
    cogs: await resolver.idFor("5000"),
  };

  const opening = await accounts.postOpeningBalances([
    { accountId: id.cash, debit: 500_000 },
    { accountId: id.bank, debit: 1_000_000 },
    { accountId: id.equity, credit: 1_500_000 },
  ]);
  eq("P1", "opening-balance entry debits", opening.totalDebit, 1_500_000);
  eq("P1", "opening-balance entry credits", opening.totalCredit, 1_500_000);
  info("P1", `opening balances posted as journal entry #${opening.journalEntryId} for ${opening.accountsUpdated} accounts`);

  const supplier = await parties.create({ name: "QA Supplier", partyType: "SUPPLIER" });
  const customer = await parties.create({ name: "QA Customer", partyType: "CUSTOMER" });
  info("P1", `parties created: supplier #${supplier.id} (${supplier.code}), customer #${customer.id} (${customer.code})`);

  const rmA = await items.create({
    itemName: "Paracetamol API",
    unit: "KG",
    itemCode: "QA-RM-A",
    purchasePrice: 900,
    sellingPrice: 1000,
    itemType: "RAW_MATERIAL",
  });
  const pmA = await items.create({
    itemName: "Blister Foil",
    unit: "UNIT",
    itemCode: "QA-PM-A",
    purchasePrice: 50,
    sellingPrice: 60,
    itemType: "PACKING_MATERIAL",
  });
  const fgA = await items.create({
    itemName: "Panadol 500mg",
    unit: "TABLET",
    itemCode: "QA-FG-A",
    purchasePrice: 25,
    sellingPrice: 40,
    itemType: "FINISHED_GOOD",
  });
  info("P1", `items: RM #${rmA.id}, PM #${pmA.id}, FG #${fgA.id} (warehouse MAIN, id 1)`);

  const rmOpening = await items.addOpeningStock({
    itemId: rmA.id,
    quantity: 100,
    unitCost: 900,
    batchNumber: "OPEN-RM-A-001",
    expiryDate: "2026-12-31",
    partyId: supplier.id,
  });
  const pmOpening = await items.addOpeningStock({
    itemId: pmA.id,
    quantity: 5_000,
    unitCost: 50,
    batchNumber: "OPEN-PM-A-001",
    expiryDate: "2026-12-31",
    partyId: supplier.id,
  });
  check("P1", "RM opening stock booked against A/P", rmOpening.journalEntryId !== null, `entry #${rmOpening.journalEntryId}, batch #${rmOpening.batchId}`);
  check("P1", "PM opening stock booked against A/P", pmOpening.journalEntryId !== null, `entry #${pmOpening.journalEntryId}, batch #${pmOpening.batchId}`);

  const stage1 = await reports.trialBalance();
  eq("P1", "Stage 1 trial balance total debits", stage1.totalDebit, 1_840_000);
  eq("P1", "Stage 1 trial balance total credits", stage1.totalCredit, 1_840_000);
  check("P1", "Stage 1 trial balance balances to 0.00", stage1.balanced, `debit=${stage1.totalDebit.toFixed(2)} credit=${stage1.totalCredit.toFixed(2)}`);
  eq("P1", "Stage 1 A/P credit (opening stock)", await accounting.getAccountBalance(id.ap), 340_000);

  // ======================================================================
  section("PHASE 2 — Transaction walkthrough (write path)");
  // ======================================================================

  // --- 2.1 purchases (credit) -------------------------------------------
  section("PHASE 2.1 — Purchases on credit");
  const pi1 = await db.transaction(() =>
    purchases.createPurchaseInvoice({
      supplierId: supplier.id,
      invoiceDate: TODAY,
      paymentType: "CREDIT",
      items: [{ itemId: rmA.id, quantity: 200, unitCost: 880, batchNumber: "PO-RM-A-880", expiryDate: "2027-06-30" }],
    }),
  );
  const pi2 = await db.transaction(() =>
    purchases.createPurchaseInvoice({
      supplierId: supplier.id,
      invoiceDate: TODAY,
      paymentType: "CREDIT",
      items: [{ itemId: pmA.id, quantity: 1_500, unitCost: 48, batchNumber: "PO-PM-A-048", expiryDate: "2027-06-30" }],
    }),
  );
  info("P2.1", `purchase invoices: ${pi1.invoiceNumber} (RM 176,000.00), ${pi2.invoiceNumber} (PM 72,000.00)`);
  eq("P2.1", "A/P credited with both purchases", await accounting.getAccountBalance(id.ap), 588_000);
  eq("P2.1", "RM inventory account debited", await accounting.getAccountBalance(id.invRm), 266_000);
  const rmBatches = await batchesOf(db, rmA.id);
  check(
    "P2.1",
    "raw material now has two distinct batches (FIFO candidate)",
    rmBatches.length === 2,
    rmBatches.map((b) => `${b.batch_number}:${d(b.quantity_in_stock).toFixed(2)}@${d(b.purchase_price).toFixed(2)}`).join(", "),
  );

  // --- 2.2 manufacturing -------------------------------------------------
  section("PHASE 2.2 — Manufacturing (formulation -> unpacked -> packing -> FG)");
  const bom = await db.transaction(() =>
    manufacturing.createBom({
      bomName: "Formulation A",
      outputQuantity: 1_000,
      components: [
        { componentItemId: rmA.id, quantityRequired: COMPONENT_RM_PER_1000.toNumber(), wastagePercent: RM_WASTAGE_PERCENT.toNumber() },
      ],
    }),
  );
  const order = await db.transaction(() =>
    manufacturing.createProductionOrder({ bomId: bom.id, plannedQuantity: 2_000, manufacturingDate: TODAY, expiryDate: "2027-01-31" }),
  );
  await db.transaction(() => manufacturing.startProduction(order.id));
  const produced = await db.transaction(() =>
    manufacturing.produceProduction(order.id, { actualQuantity: 2_000, wastageQuantity: 50, outputBatchNumber: "PRD-UNPACKED-A-001" }),
  );

  // The packing stage is its own order: unpacked bulk + packing materials.
  const packingOrder = await db.transaction(() =>
    manufacturing.createPackingOrder({
      packingBomName: "Packing A",
      plannedQuantity: 2_000,
      manufacturingDate: TODAY,
      expiryDate: "2027-01-31",
      outputItemId: fgA.id,
      unpackedItemId: bom.finishedItemId,
      unpackedQuantity: 2_000,
      materials: [{ componentItemId: pmA.id, quantityRequired: COMPONENT_PM_PER_1000.times(2).toNumber() }],
    }),
  );
  await db.transaction(() => manufacturing.startPacking(packingOrder.id));
  const packed = await db.transaction(() =>
    manufacturing.packPackingOrder(packingOrder.id, { outputBatchNumber: "PRD-FG-A-001" }),
  );

  const expectedRm = COMPONENT_RM_PER_1000.times(2).times(RM_WASTAGE_PERCENT.dividedBy(100).plus(1));
  const expectedPm = COMPONENT_PM_PER_1000.times(2);
  eq("P2.2", "production cost = raw consumed", produced.productionCost, 27_540);
  eq("P2.2", "packing cost = unpacked bulk + packing consumed", packed.productionCost, 27_540 + 25_000);
  info(
    "P2.2",
    `raw consumed ${expectedRm.toFixed(2)} KG @900 = 27,540.00; packing consumed ${expectedPm.toFixed(2)} UNIT @50 = 25,000.00; total 52,540.00`,
  );

  const fgProduced = must((await batchesOf(db, fgA.id)).find((b) => b.batch_number === "PRD-FG-A-001"), "PRD batch");
  eq("P2.2", "FG output batch quantity", fgProduced.quantity_in_stock, 2_000);
  eq("P2.2", "FG output batch raw_unit_cost", fgProduced.raw_unit_cost, 13.77);
  eq("P2.2", "FG output batch packing_unit_cost", fgProduced.packing_unit_cost, 12.5);
  eq("P2.2", "FG output batch total unit cost", d(fgProduced.raw_unit_cost).plus(d(fgProduced.packing_unit_cost)), 26.27);

  // The FG purchase runs after the production run: a purchase (or any production
  // output) for an item that already has a batch is merged into the oldest FIFO
  // batch instead of creating a new one, which would hide the FIFO test below.
  section("PHASE 2.2b — Purchase of finished goods into its own batch");
  const pi3 = await db.transaction(() =>
    purchases.createPurchaseInvoice({
      supplierId: supplier.id,
      invoiceDate: TODAY,
      paymentType: "CREDIT",
      items: [{ itemId: fgA.id, quantity: 1_000, unitCost: 30, batchNumber: "PO-FG-A-030", expiryDate: "2027-12-31" }],
    }),
  );
  info("P2.2b", `purchase invoice ${pi3.invoiceNumber} booked (FG 1,000 @ 30.00)`);
  eq("P2.2b", "A/P credited with the FG purchase", await accounting.getAccountBalance(id.ap), 618_000);
  eq("P2.2b", "FG inventory account debited", await accounting.getAccountBalance(id.invFg), 82_540);

  const consumption = await db.all<{ quantity_consumed: number; unit_cost: number }>(
    "SELECT quantity_consumed, unit_cost FROM production_consumption WHERE production_order_id = ?",
    [order.id],
  );
  eq("P2.2", "raw material consumption rows recorded", consumption.length, 1);
  const packingConsumption = await db.all<{ quantity_consumed: number; unit_cost: number }>(
    "SELECT quantity_consumed, unit_cost FROM packing_consumption WHERE packing_order_id = ?",
    [packingOrder.id],
  );
  eq("P2.2", "packing consumption rows (unpacked bulk + packing material)", packingConsumption.length, 2);
  const wastageRow = await db.get<{ wastage_quantity: number }>(
    "SELECT wastage_quantity FROM production_orders WHERE id = ?",
    [order.id],
  );
  eq("P2.2", "wastage quantity recorded on the order", wastageRow?.wastage_quantity ?? 0, 50);
  const wastageGl = await db.get<{ net: number | null }>(
    `SELECT SUM(jel.debit - jel.credit) AS net FROM journal_entry_lines jel WHERE jel.account_id = ?`,
    [await resolver.idFor("5200")],
  );
  check(
    "P2.2",
    "wastage posted to 5200 Manufacturing Wastage Expense",
    Math.abs(Number(wastageGl?.net ?? 0)) > 0,
    `GL movement on 5200 = ${d(wastageGl?.net).toFixed(2)} (wastage is instead capitalised into FG cost)`,
  );

  // --- 2.3 sales invoice -------------------------------------------------
  section("PHASE 2.3 — Sales invoice across multiple FIFO batches (cash)");
  const inv1 = await db.transaction(() =>
    sales.createSalesInvoice({
      customerId: customer.id,
      invoiceDate: TODAY,
      paymentType: "CASH",
      items: [{ itemId: fgA.id, quantity: 2_500, unitPrice: 40, discountAmount: 1_000, taxAmount: 17_000 }],
    }),
  );
  eq("P2.3", "invoice subtotal", inv1.subtotal, 100_000);
  eq("P2.3", "invoice discount", inv1.discountAmount, 1_000);
  eq("P2.3", "invoice sales tax", inv1.taxAmount, 17_000);
  eq("P2.3", "invoice total", inv1.totalAmount, 116_000);

  const saleMovements = await db.all<{ batch_id: number; quantity: number; unit_cost: number }>(
    "SELECT batch_id, quantity, unit_cost FROM stock_movements WHERE reference_table = 'sales_invoices' AND reference_id = ?",
    [inv1.id],
  );
  check(
    "P2.3",
    "FIFO consumed two batches for one line",
    saleMovements.length === 2,
    saleMovements.map((m) => `batch#${m.batch_id} ${d(m.quantity).toFixed(2)}@${d(m.unit_cost).toFixed(2)}`).join(" + "),
  );
  const cogs1 = saleMovements.reduce((acc, m) => acc.plus(d(m.quantity).abs().times(d(m.unit_cost))), new Decimal(0));
  eq("P2.3", "FIFO COGS = 2,000 @ 26.27 + 500 @ 30.00", cogs1, 52_540 + 15_000);

  const inv1Entry = must(await entryFor(db, "sales_invoices", inv1.id), "invoice 1 journal entry");
  const inv1Lines = await linesOf(db, Number(inv1Entry.id));
  eq("P2.3", "journal: cash debit", sumSide(inv1Lines, "debit", id.cash), 116_000);
  eq("P2.3", "journal: revenue credit (subtotal - discount)", sumSide(inv1Lines, "credit", id.revenue), 99_000);
  eq("P2.3", "journal: sales tax credit", sumSide(inv1Lines, "credit", id.tax), 17_000);
  eq("P2.3", "journal: COGS debit", sumSide(inv1Lines, "debit", id.cogs), 67_540);
  eq("P2.3", "journal: inventory credit", sumSide(inv1Lines, "credit", id.invFg), 67_540);
  eq("P2.3", "journal entry balances", entryTotal(inv1Lines, "debit"), entryTotal(inv1Lines, "credit"));

  section("PHASE 2.3b — Sales invoice on credit (unsettled → receivables)");
  const inv2 = await db.transaction(() =>
    sales.createSalesInvoice({
      customerId: customer.id,
      invoiceDate: TODAY,
      paymentType: "CREDIT",
      items: [{ itemId: fgA.id, quantity: 400, unitPrice: 40 }],
    }),
  );
  eq("P2.3b", "credit invoice total", inv2.totalAmount, 16_000);
  eq("P2.3b", "A/R debit for the credit sale", await accounting.getAccountBalance(id.ar), 16_000);

  // --- 2.4 sales return --------------------------------------------------
  section("PHASE 2.4 — Partial sales return (stock restored at original cost)");
  const inv2Detail = await sales.getById(inv2.id);
  const inv2Line = must(
    (inv2Detail.items as Array<{ id: number; batch_id: number; quantity: number }>)[0],
    "invoice 2 line",
  );
  const fgBatchBefore = must(
    (await batchesOf(db, fgA.id)).find((b) => b.id === inv2Line.batch_id),
    "returned batch",
  );
  const qtyBeforeReturn = d(fgBatchBefore.quantity_in_stock);
  const unitCostBeforeReturn = d(fgBatchBefore.purchase_price);

  const returnResult = await db.transaction(() =>
    returns.createSalesReturn({ invoiceId: inv2.id, returnDate: TODAY, items: [{ invoiceItemId: inv2Line.id, quantity: 100 }] }),
  );
  eq("P2.4", "return value (100 of 400 units at 40.00)", returnResult.totalAmount, 4_000);

  const fgBatchAfter = must((await batchesOf(db, fgA.id)).find((b) => b.id === inv2Line.batch_id), "batch after return");
  eq("P2.4", "stock restored to the original batch", d(fgBatchAfter.quantity_in_stock).minus(qtyBeforeReturn), 100);
  eq("P2.4", "batch unit cost unchanged by the return", fgBatchAfter.purchase_price, unitCostBeforeReturn);

  const retEntry = must(await entryFor(db, "sales_returns", returnResult.id), "return journal entry");
  const retLines = await linesOf(db, Number(retEntry.id));
  eq("P2.4", "journal: sales returns debited (4100)", sumSide(retLines, "debit", id.salesReturns), 4_000);
  eq("P2.4", "journal: A/R credited", sumSide(retLines, "credit", id.ar), 4_000);
  eq("P2.4", "journal: inventory restored (1220 debit) at original cost", sumSide(retLines, "debit", id.invFg), 3_000);
  eq("P2.4", "journal: COGS reversed", sumSide(retLines, "credit", id.cogs), 3_000);
  eq("P2.4", "journal entry balances", entryTotal(retLines, "debit"), entryTotal(retLines, "credit"));
  const cogsNet = d(await accounting.getAccountBalance(id.cogs));
  eq("P2.4", "COGS nets to 300 units sold (400 - 100) at 30.00", cogsNet.minus(67_540), 9_000);

  // --- 2.5 banking and payments -----------------------------------------
  section("PHASE 2.5 — Banking, receipts, supplier payment and the duplicate guard");
  const bank = await db.transaction(() =>
    banking.createBankAccount({ bankName: "HBL", accountTitle: "BOP Nutraceuticals", accountNumber: "QA-0001", openingBalance: 250_000 }),
  );
  info("P2.5", `bank account #${bank.id} ${bank.bank_name} ${bank.account_number} opened with 250,000.00`);
  eq("P2.5", "bank GL account credited with the deposit", await accounting.getAccountBalance(id.bank), 1_250_000);

  const receipt = await db.transaction(() =>
    payments.receivePayment({
      customerId: customer.id,
      amount: 12_000,
      paymentDate: TODAY,
      paymentMethod: "CASH",
      referenceNo: "QA-RCPT-1",
      salesInvoiceId: inv2.id,
    }),
  );
  info("P2.5", `receipt ${receipt.voucherNumber} recorded (journal entry #${receipt.journalEntryId})`);
  eq("P2.5", "A/R cleared by the receipt", await accounting.getAccountBalance(id.ar), 0);

  const payment = await db.transaction(() =>
    payments.paySupplier({
      supplierId: supplier.id,
      amount: 100_000,
      paymentDate: TODAY,
      paymentMethod: "BANK",
      referenceNo: "QA-PAY-1",
    }),
  );
  info("P2.5", `supplier payment ${payment.voucherNumber} recorded (journal entry #${payment.journalEntryId})`);
  eq("P2.5", "A/P reduced by the payment", await accounting.getAccountBalance(id.ap), 518_000);

  // Deliberately NOT wrapped in a harness transaction: this is how the HTTP
  // layer calls the service, so any side effect of a rejection is real.
  const duplicateReceipt = await expectError(() =>
    payments.receivePayment({
      customerId: customer.id,
      amount: 12_000,
      paymentDate: TODAY,
      paymentMethod: "CASH",
      referenceNo: "QA-RCPT-1",
      salesInvoiceId: inv2.id,
    }),
  );
  const duplicatePayment = await expectError(() =>
    payments.paySupplier({
      supplierId: supplier.id,
      amount: 100_000,
      paymentDate: TODAY,
      paymentMethod: "BANK",
      referenceNo: "QA-PAY-1",
    }),
  );
  check("P2.5", "duplicate receipt rejected", duplicateReceipt.includes("already recorded"), duplicateReceipt || "(no error thrown)");
  check("P2.5", "duplicate payment rejected", duplicatePayment.includes("already recorded"), duplicatePayment || "(no error thrown)");
  eq("P2.5", "rejected duplicates did not move the ledger", await accounting.getAccountBalance(id.ap), 518_000);

  // ======================================================================
  section("PHASE 3 — Ledger and invariant verification");
  // ======================================================================
  const unbalanced = await db.all<{ voucher_number: string; diff: number }>(
    `SELECT je.voucher_number, SUM(jel.debit) - SUM(jel.credit) AS diff
       FROM journal_entries je JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
      GROUP BY je.id HAVING ABS(SUM(jel.debit) - SUM(jel.credit)) > 0.005`,
  );
  check("P3", "every journal entry balances (SUM debit = SUM credit)", unbalanced.length === 0, unbalanced.length ? unbalanced.map((r) => `${r.voucher_number}:${r.diff}`).join(", ") : "0 exceptions");

  const negatives = await scalar(db, "SELECT COUNT(*) FROM journal_entry_lines WHERE debit < 0 OR credit < 0");
  check("P3", "no negative debit/credit amounts", negatives === 0, `${negatives} rows`);
  const mixed = await scalar(db, "SELECT COUNT(*) FROM journal_entry_lines WHERE debit > 0 AND credit > 0");
  check("P3", "no line carries both a debit and a credit", mixed === 0, `${mixed} rows`);
  const oneSided = await scalar(db, "SELECT COUNT(*) FROM journal_entry_lines WHERE debit = 0 AND credit = 0");
  check("P3", "no empty journal line", oneSided === 0, `${oneSided} rows`);
  const thinEntries = await scalar(
    db,
    "SELECT COUNT(*) FROM (SELECT journal_entry_id FROM journal_entry_lines GROUP BY journal_entry_id HAVING COUNT(*) < 2)",
  );
  check("P3", "every entry has at least two lines", thinEntries === 0, `${thinEntries} entries`);

  const grandDebit = d(await scalar(db, "SELECT SUM(debit) FROM journal_entry_lines"));
  const grandCredit = d(await scalar(db, "SELECT SUM(credit) FROM journal_entry_lines"));
  eq("P3", "ledger-wide SUM(debit) = SUM(credit)", grandDebit, grandCredit);

  const traceability = await db.all<{ voucher_number: string; source_table: string }>(
    "SELECT voucher_number, source_table FROM journal_entries WHERE source_table IS NOT NULL AND source_id IS NOT NULL",
  );
  let brokenLinks = 0;
  for (const row of traceability) {
    const exists = await scalar(db, `SELECT COUNT(*) FROM ${row.source_table} WHERE id = (SELECT source_id FROM journal_entries WHERE voucher_number = ?)`, [row.voucher_number]);
    if (exists === 0) brokenLinks += 1;
  }
  check("P3", "every sourced entry points at an existing document", brokenLinks === 0, `${traceability.length} traced entries`);

  // --- voucher continuity -------------------------------------------------
  // A number can live on the document, on its journal entry, or both (the
  // document and its entry share one number), so the issued set is the union.
  const sequences: ReadonlyArray<{
    prefix: string;
    docType: string;
    sources: ReadonlyArray<readonly [string, string]>;
  }> = [
    { prefix: "SI-", docType: "SALES_INVOICE", sources: [["journal_entries", "voucher_number"], ["sales_invoices", "invoice_number"]] },
    { prefix: "SR-", docType: "SALES_RETURN", sources: [["journal_entries", "voucher_number"], ["sales_returns", "return_number"]] },
    { prefix: "PI-", docType: "PURCHASE_INVOICE", sources: [["journal_entries", "voucher_number"], ["purchase_invoices", "invoice_number"]] },
    { prefix: "PR-", docType: "PURCHASE_RETURN", sources: [["journal_entries", "voucher_number"], ["purchase_returns", "return_number"]] },
    { prefix: "PV-", docType: "PAYMENT", sources: [["journal_entries", "voucher_number"], ["payments", "voucher_number"]] },
    { prefix: "RV-", docType: "RECEIPT", sources: [["journal_entries", "voucher_number"], ["receipts", "voucher_number"]] },
    { prefix: "JV-", docType: "JOURNAL_VOUCHER", sources: [["journal_entries", "voucher_number"]] },
    { prefix: "OB-", docType: "OPENING", sources: [["journal_entries", "voucher_number"]] },
    { prefix: "PO-", docType: "PRODUCTION_ORDER", sources: [["production_orders", "order_number"]] },
    { prefix: "PCO-", docType: "PACKING_ORDER", sources: [["packing_orders", "order_number"]] },
    { prefix: "BOM-", docType: "BOM", sources: [["bill_of_materials", "bom_name"]] },
  ];
  section("PHASE 3.2 — Voucher continuity");
  for (const definition of sequences) {
    const issued = new Set<number>();
    for (const [table, column] of definition.sources) {
      const rows = await db.all<{ number: string }>(
        `SELECT ${column} AS number FROM ${table} WHERE ${column} LIKE ?`,
        [`${definition.prefix}%`],
      );
      for (const row of rows) {
        const suffix = Number(row.number.slice(definition.prefix.length));
        if (Number.isInteger(suffix) && suffix > 0) issued.add(suffix);
      }
    }
    const suffixes = [...issued].sort((a, b) => a - b);
    const seq = await db.get<{ next_number: number; padding: number }>(
      "SELECT next_number, padding FROM numbering_sequences WHERE company_id = ? AND document_type = ?",
      [companyId, definition.docType],
    );
    if (!seq) {
      info("P3.2", `${definition.prefix} sequence not configured in numbering_sequences`);
      continue;
    }
    const highest = suffixes.length ? (suffixes[suffixes.length - 1] ?? 0) : 0;
    const expectedSet = Array.from({ length: highest }, (_, index) => index + 1);
    const gapFree = JSON.stringify(suffixes) === JSON.stringify(expectedSet);
    const noBurn = Number(seq.next_number) === highest + 1;
    info(
      "P3.2",
      `${definition.prefix} issued [${suffixes.join(",")}] next_number=${seq.next_number}`,
      `highest=${highest}`,
    );
    check("P3.2", `${definition.prefix} numbers are gap-free (1..${highest})`, gapFree, gapFree ? "no holes" : `holes: expected 1..${highest}, got [${suffixes.join(",")}]`);
    check(
      "P3.2",
      `${definition.prefix} next_number follows the last issued number (no burned numbers)`,
      noBurn,
      `next_number=${seq.next_number}, expected ${highest + 1}`,
    );
  }

  // --- stock vs GL --------------------------------------------------------
  section("PHASE 3.3 — Stock batch valuation vs inventory GL");
  const stockValue = d(
    await scalar(
      db,
      `SELECT SUM(sb.quantity_in_stock *
           CASE WHEN (sb.raw_unit_cost + sb.packing_unit_cost) > 0
                THEN sb.raw_unit_cost + sb.packing_unit_cost
                ELSE sb.purchase_price END)
         FROM stock_batches sb JOIN items i ON i.id = sb.item_id
        WHERE sb.is_active = 1 AND i.is_active = 1 AND i.company_id = ?`,
      [companyId],
    ),
  );
  const glInventory = await inventoryGl(accounting, id);
  eq("P3.3", "stock batch valuation = inventory GL (1200 + 1210 + 1220)", stockValue, glInventory);
  info(
    "P3.3",
    `RM ${d(await accounting.getAccountBalance(id.invRm)).toFixed(2)} + PM ${d(await accounting.getAccountBalance(id.invPm)).toFixed(2)} + FG ${d(await accounting.getAccountBalance(id.invFg)).toFixed(2)} = ${glInventory.toFixed(2)}`,
  );

  const movementValue = d(
    await scalar(db, "SELECT SUM(quantity * unit_cost) FROM stock_movements WHERE unit_cost > 0"),
  );
  info("P3.3", `stock_movements signed value = ${movementValue.toFixed(2)} (movements are the audit trail for every batch change)`);

  // ======================================================================
  section("PHASE 4 — Financial report audit");
  // ======================================================================
  const tb = await reports.trialBalance();
  eq("P4", "trial balance total debits", tb.totalDebit, tb.totalCredit);
  eq("P4", "trial balance total debits = 2,400,000.00", tb.totalDebit, 2_400_000);
  check("P4", "trial balance is balanced", tb.balanced, `debit=${tb.totalDebit.toFixed(2)} credit=${tb.totalCredit.toFixed(2)}`);
  const withMovement = tb.rows.filter((row) => row.closingDebit !== 0 || row.closingCredit !== 0);
  check(
    "P4",
    "accounts with movement are listed",
    withMovement.length >= 10,
    `${withMovement.length} of ${tb.rows.length} accounts carry a closing balance`,
  );
  for (const row of withMovement) {
    info("P4", `  ${row.accountCode} ${row.accountName}`, `Debit ${row.closingDebit.toFixed(2)}  Credit ${row.closingCredit.toFixed(2)}`);
  }

  const pl = await reports.profitAndLoss();
  eq("P4", "P&L revenue (net of returns)", pl.revenue, 111_000);
  eq("P4", "P&L expenses (COGS)", pl.expenses, 76_540);
  eq("P4", "P&L net profit = revenue - expenses", pl.netProfit, pl.revenue - pl.expenses);
  eq("P4", "P&L net profit figure", pl.netProfit, 34_460);

  const bs = await reports.balanceSheet(null);
  eq("P4", "balance sheet: assets", bs.assets, 2_319_460);
  eq("P4", "balance sheet: liabilities", bs.liabilities, 535_000);
  eq("P4", "balance sheet: equity incl. net profit", bs.equity, 1_784_460);
  eq(
    "P4",
    "Assets = Liabilities + Equity + Net Profit",
    bs.assets,
    new Decimal(bs.liabilities).plus(bs.equity),
  );
  check("P4", "balance sheet reports balanced = true", bs.balanced, `assets=${bs.assets.toFixed(2)}`);

  // --- 4.4 line-by-line running balance ---------------------------------
  section("PHASE 4.4 — Ledger recalculated line by line in Decimal");
  for (const [label, accountId] of [["Cash in Hand (1000)", id.cash], ["Accounts Receivable (1100)", id.ar]] as const) {
    const lines = await db.all<{ entry_date: string; voucher_number: string; debit: number; credit: number }>(
      `SELECT je.entry_date, je.voucher_number, jel.debit, jel.credit
         FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id
        WHERE jel.account_id = ? AND je.is_posted = 1
        ORDER BY je.entry_date, je.id, jel.line_order`,
      [accountId],
    );
    let running = new Decimal(0);
    for (const line of lines) {
      running = running.plus(d(line.debit)).minus(d(line.credit));
      console.log(`        ${line.entry_date}  ${line.voucher_number.padEnd(10)} dr ${d(line.debit).toFixed(2).padStart(12)}  cr ${d(line.credit).toFixed(2).padStart(12)}  bal ${running.toFixed(2).padStart(12)}`);
    }
    const viaService = await accounting.getAccountBalance(accountId);
    const viaTrialBalance = must(
      tb.rows.find((row) => row.accountId === accountId),
      `${label} trial balance row`,
    );
    const tbClosing = d(viaTrialBalance.closingDebit).minus(viaTrialBalance.closingCredit);
    eq("P4.4", `${label}: recalculated running balance = closing debit - closing credit`, running, tbClosing);
    eq("P4.4", `${label}: recalculated balance = AccountRepository.getCurrentBalance`, running, viaService);
  }

  const cashBook = await reports.cashBook();
  const lastCash = cashBook.length ? must(cashBook[cashBook.length - 1], "last cash book row") : null;
  eq("P4.4", "cash book final running balance = Cash GL", d(lastCash?.balance), await accounting.getAccountBalance(id.cash));
  const ledger = await reports.partyLedger(customer.id);
  const lastParty = ledger.length ? must(ledger[ledger.length - 1], "last party ledger row") : null;
  eq("P4.4", "customer ledger closes at the A/R balance", d(lastParty?.balance), 0);

  // ======================================================================
  section("PHASE 5 — Adversarial probes (run after the clean reconciliation)");
  // ======================================================================
  const stockBeforeProbe = d(
    await scalar(
      db,
      `SELECT SUM(sb.quantity_in_stock * CASE WHEN (sb.raw_unit_cost + sb.packing_unit_cost) > 0
              THEN sb.raw_unit_cost + sb.packing_unit_cost ELSE sb.purchase_price END)
         FROM stock_batches sb WHERE sb.is_active = 1`,
    ),
  );
  const glBeforeProbe = await inventoryGl(accounting, id);

  // Probe A: same batch number purchased again at a different price.
  await db.transaction(() =>
    purchases.createPurchaseInvoice({
      supplierId: supplier.id,
      invoiceDate: TODAY,
      paymentType: "CREDIT",
      items: [{ itemId: rmA.id, quantity: 100, unitCost: 900, batchNumber: "PO-RM-A-880", expiryDate: "2027-06-30" }],
    }),
  );
  const stockAfterA = d(
    await scalar(
      db,
      `SELECT SUM(sb.quantity_in_stock * CASE WHEN (sb.raw_unit_cost + sb.packing_unit_cost) > 0
              THEN sb.raw_unit_cost + sb.packing_unit_cost ELSE sb.purchase_price END)
         FROM stock_batches sb WHERE sb.is_active = 1`,
    ),
  );
  const glAfterA = await inventoryGl(accounting, id);
  const driftA = stockAfterA.minus(glAfterA);
  info("P5", "probe A: 100 KG of RM bought @900 into an existing batch held @880");
  info("P5", `  GL inventory moved by ${glAfterA.minus(glBeforeProbe).toFixed(2)}; batch valuation moved by ${stockAfterA.minus(stockBeforeProbe).toFixed(2)}`);
  check(
    "P5",
    "probe A: stock valuation still reconciles to GL",
    driftA.abs().lessThan(new Decimal("0.005")),
    `drift = ${driftA.toFixed(2)} (batch cost is not re-weighted when a batch receives stock at a new price)`,
  );

  // Probe B: manufacturing consumption across batches.
  const shortOrder = await db.transaction(() =>
    manufacturing.createProductionOrder({ bomId: bom.id, plannedQuantity: 10_000, manufacturingDate: TODAY, expiryDate: "2027-03-31" }),
  );
  await db.transaction(() => manufacturing.startProduction(shortOrder.id));
  const shortError = await expectError(() =>
    manufacturing.produceProduction(shortOrder.id, { actualQuantity: 10_000, outputBatchNumber: "PRD-UNPACKED-A-002" }),
  );
  const rmAvailable = await db.get<{ total: number }>(
    "SELECT SUM(quantity_in_stock) AS total FROM stock_batches WHERE item_id = ? AND is_active = 1",
    [rmA.id],
  );
  check(
    "P5",
    "probe B: production consuming more than the first FIFO batch but less than total stock",
    shortError.includes("Insufficient stock"),
    `${shortError} (total on hand ${d(rmAvailable?.total).toFixed(2)} KG is enough, but consumption never spans batches)`,
  );

  // Probe D: an invoice that fails *after* its number was allocated.
  const siBefore = await db.get<{ next_number: number }>(
    "SELECT next_number FROM numbering_sequences WHERE company_id = ? AND document_type = 'SALES_INVOICE'",
    [companyId],
  );
  const impossibleSale = await expectError(() =>
    sales.createSalesInvoice({
      customerId: customer.id,
      invoiceDate: TODAY,
      paymentType: "CASH",
      items: [{ itemId: fgA.id, quantity: 1_000_000, unitPrice: 40 }],
    }),
  );
  const siAfter = await db.get<{ next_number: number }>(
    "SELECT next_number FROM numbering_sequences WHERE company_id = ? AND document_type = 'SALES_INVOICE'",
    [companyId],
  );
  const lastInvoice = await db.get<{ max_suffix: number | null }>(
    "SELECT MAX(CAST(substr(invoice_number, 4) AS INTEGER)) AS max_suffix FROM sales_invoices WHERE invoice_number LIKE 'SI-%'",
  );
  info("P5", `probe D: sale of 1,000,000 units rejected — ${impossibleSale || "(no error thrown)"}`);
  check(
    "P5",
    "probe D: a rejected invoice leaves no burned invoice number",
    Number(siAfter?.next_number ?? 0) === Number(lastInvoice?.max_suffix ?? 0) + 1,
    `next_number ${siBefore?.next_number} → ${siAfter?.next_number}, last issued SI-${lastInvoice?.max_suffix}`,
  );

  // Probe C: opening stock without a supplier.
  const noPartyItem = await items.create({
    itemName: "QA Unbooked Stock",
    unit: "UNIT",
    itemCode: "QA-ORPHAN",
    itemType: "RAW_MATERIAL",
    purchasePrice: 100,
  });
  const orphan = await items.addOpeningStock({ itemId: noPartyItem.id, quantity: 10, unitCost: 100, batchNumber: "OPEN-ORPHAN" });
  const glAfterC = await inventoryGl(accounting, id);
  const stockAfterC = d(
    await scalar(
      db,
      `SELECT SUM(sb.quantity_in_stock * CASE WHEN (sb.raw_unit_cost + sb.packing_unit_cost) > 0
              THEN sb.raw_unit_cost + sb.packing_unit_cost ELSE sb.purchase_price END)
         FROM stock_batches sb WHERE sb.is_active = 1`,
    ),
  );
  info("P5", `probe C: opening stock without a supplier → journalEntryId=${orphan.journalEntryId === null ? "null" : orphan.journalEntryId}`);
  check(
    "P5",
    "probe C: stock without a counterparty entry keeps stock = GL",
    stockAfterC.minus(glAfterC).abs().lessThan(new Decimal("0.005")),
    `drift = ${stockAfterC.minus(glAfterC).toFixed(2)} (1,000.00 of stock value has no inventory GL entry — intentional per src/smoke.ts, but it breaks the Phase 3.3 invariant)`,
  );

  // ======================================================================
  section("SUMMARY");
  // ======================================================================
  const phases = [...new Set(log.map((row) => row.phase))];
  for (const phase of phases) {
    const rows = log.filter((row) => row.phase === phase);
    const failed = rows.filter((row) => row.status === "FAIL").length;
    const passed = rows.filter((row) => row.status === "PASS").length;
    console.log(`  ${phase.padEnd(6)} ${failed === 0 ? "PASS" : "FAIL"}  (${passed} passed, ${failed} failed, ${rows.length - passed - failed} info)`);
  }
  console.log(`\n  journal entries: ${await scalar(db, "SELECT COUNT(*) FROM journal_entries")}, lines: ${await scalar(db, "SELECT COUNT(*) FROM journal_entry_lines")}`);
  console.log(`  total checks: ${log.filter((row) => row.status !== "INFO").length}, failures: ${failures}`);

  await db.close();
  process.exitCode = failures === 0 ? 0 : 1;
}

// --- small query helpers -------------------------------------------------

/** Total inventory GL balance (raw + packing + finished goods), as Decimal. */
async function inventoryGl(
  accounting: AccountingService,
  id: { invRm: number; invPm: number; invFg: number },
): Promise<Decimal> {
  return d(await accounting.getAccountBalance(id.invRm))
    .plus(await accounting.getAccountBalance(id.invPm))
    .plus(await accounting.getAccountBalance(id.invFg));
}

async function scalar(db: SqlDatabase, sql: string, params: readonly (string | number)[] = []): Promise<number> {
  const row = await db.get<{ value: number | null }>(`SELECT (${sql}) AS value`, params);
  return Number(row?.value ?? 0);
}

interface BatchRow {
  id: number;
  batch_number: string;
  purchase_price: number;
  raw_unit_cost: number;
  packing_unit_cost: number;
  quantity_in_stock: number;
  expiry_date: string | null;
}

function batchesOf(db: SqlDatabase, itemId: number): Promise<BatchRow[]> {
  return db.all<BatchRow>(
    `SELECT id, batch_number, purchase_price, raw_unit_cost, packing_unit_cost, quantity_in_stock, expiry_date
       FROM stock_batches WHERE item_id = ? AND is_active = 1 ORDER BY id`,
    [itemId],
  );
}

function entryFor(db: SqlDatabase, sourceTable: string, sourceId: number): Promise<{ id: number; voucher_number: string } | undefined> {
  return db.get<{ id: number; voucher_number: string }>(
    "SELECT id, voucher_number FROM journal_entries WHERE source_table = ? AND source_id = ?",
    [sourceTable, sourceId],
  );
}

interface LineRow {
  account_id: number;
  debit: number;
  credit: number;
  description: string | null;
}

function linesOf(db: SqlDatabase, entryId: number): Promise<LineRow[]> {
  return db.all<LineRow>(
    "SELECT account_id, debit, credit, description FROM journal_entry_lines WHERE journal_entry_id = ? ORDER BY line_order",
    [entryId],
  );
}

function sumSide(lines: readonly LineRow[], side: "debit" | "credit", accountId: number): Decimal {
  return lines.reduce((acc, line) => (line.account_id === accountId ? acc.plus(d(line[side])) : acc), new Decimal(0));
}

function entryTotal(lines: readonly LineRow[], side: "debit" | "credit"): Decimal {
  return lines.reduce((acc, line) => acc.plus(d(line[side])), new Decimal(0));
}

void main().catch((err: unknown) => {
  console.error("\nQA HARNESS CRASHED:", err);
  process.exitCode = 1;
});
