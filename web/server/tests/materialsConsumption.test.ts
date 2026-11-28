import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertRow } from "../src/repositories/base.js";
import { AccountingService } from "../src/services/accountingService.js";
import { PurchaseInvoiceService } from "../src/services/purchaseInvoiceService.js";
import { ReportService } from "../src/services/reportService.js";
import { accountId, freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let reports: ReportService;
let purchases: PurchaseInvoiceService;
let accounting: AccountingService;
let supplierId: number;
let rawItemId: number;
let packingItemId: number;

async function makeItem(code: string, name: string, type: string): Promise<number> {
  return insertRow(ctx.db, "items", {
    company_id: 1,
    item_code: code,
    item_name: name,
    unit: "KG",
    item_type: type,
    purchase_price: 0,
    selling_price: 0,
    is_active: 1,
  });
}

beforeEach(async () => {
  ctx = await freshDb();
  reports = new ReportService(ctx.db);
  purchases = new PurchaseInvoiceService(ctx.db);
  accounting = new AccountingService(ctx.db);
  supplierId = await insertRow(ctx.db, "parties", {
    company_id: 1,
    code: "SUP-1",
    name: "Test Supplier",
    party_type: "SUPPLIER",
    opening_balance: 0,
    credit_limit: 0,
    is_active: 1,
  });
  rawItemId = await makeItem("RAW-1", "Test Raw Material", "RAW_MATERIAL");
  packingItemId = await makeItem("PACK-1", "Test Packing Box", "PACKING_MATERIAL");
});
afterEach(async () => {
  await ctx.db.close();
});

/** Buy raw material so it lands in stock and in account 1200. */
async function buy(
  itemId: number,
  quantity: number,
  unitCost: number,
  date = "2026-11-08",
): Promise<void> {
  await purchases.createPurchaseInvoice({
    supplierId,
    invoiceDate: date,
    paymentType: "CASH",
    items: [{ itemId, quantity, unitCost, batchNumber: `T-${itemId}-${date}` }],
  });
}

/** A completed production or packing order with one consumption row. */
async function consumeOrder(
  kind: "production" | "packing",
  itemId: number,
  date: string,
  quantity: number,
  unitCost: number,
  orderNumber: string,
): Promise<number> {
  const batchId = await insertRow(ctx.db, "stock_batches", {
    item_id: itemId,
    warehouse_id: 1,
    batch_number: `B-${orderNumber}`,
    purchase_price: unitCost,
    quantity_in_stock: 0,
    is_active: 1,
  });
  const bomId = await insertRow(ctx.db, "bill_of_materials", {
    company_id: 1,
    finished_item_id: itemId,
    bom_name: `BOM ${orderNumber}`,
    output_quantity: 1,
    phase: kind === "production" ? "FORMULATION" : "PACKING",
    is_active: 1,
  });
  const orderId =
    kind === "production"
      ? await insertRow(ctx.db, "production_orders", {
          company_id: 1,
          warehouse_id: 1,
          order_number: orderNumber,
          bom_id: bomId,
          planned_quantity: 1,
          manufacturing_date: date,
          status: "COMPLETED",
        })
      : await insertRow(ctx.db, "packing_orders", {
          company_id: 1,
          warehouse_id: 1,
          order_number: orderNumber,
          bom_id: bomId,
          planned_quantity: 1,
          manufacturing_date: date,
          status: "COMPLETED",
        });
  await insertRow(
    ctx.db,
    kind === "production" ? "production_consumption" : "packing_consumption",
    {
      [kind === "production" ? "production_order_id" : "packing_order_id"]: orderId,
      component_item_id: itemId,
      batch_id: batchId,
      quantity_consumed: quantity,
      unit_cost: unitCost,
    },
  );
  return orderId;
}

describe("ReportService.materialsConsumption", () => {
  it("consumption is opening + purchases − closing stock", async () => {
    await buy(rawItemId, 10, 50);
    const result = await reports.materialsConsumption();

    expect(result.total.opening).toBe(0);
    expect(result.total.purchases).toBe(500);
    // Nothing has been used yet, so everything bought is still on the shelf.
    expect(result.total.counted).toBe(500);
    expect(result.total.consumed).toBe(0);
    expect(result.total.bookClosing).toBe(500);
    expect(result.total.difference).toBe(0);
  });

  it("stock that is no longer on the shelf is the consumption", async () => {
    await buy(rawItemId, 10, 50);
    // Take 4 units off the shelf without posting anything: the periodic view
    // still sees them as consumed, which is the whole point of the method.
    await ctx.db.run("UPDATE stock_batches SET quantity_in_stock = 6 WHERE batch_number = ?", [
      "T-" + rawItemId + "-2026-11-08",
    ]);

    const result = await reports.materialsConsumption();
    expect(result.total.counted).toBe(300);
    expect(result.total.consumed).toBe(200);
    // The books still carry the full 500, so they are 200 out of step.
    expect(result.total.bookClosing).toBe(500);
    expect(result.total.difference).toBe(200);
  });

  it("the start date turns earlier purchases into opening stock", async () => {
    await buy(rawItemId, 10, 50);

    const later = await reports.materialsConsumption("2026-11-09");
    expect(later.total.opening).toBe(500);
    expect(later.total.purchases).toBe(0);
    expect(later.total.consumed).toBe(0);
  });

  it("splits raw material from packing material", async () => {
    await buy(rawItemId, 10, 50);
    await buy(packingItemId, 4, 25);

    const result = await reports.materialsConsumption();
    expect(result.rows.map((row) => row.itemType)).toEqual(["RAW_MATERIAL", "PACKING_MATERIAL"]);
    expect(result.rows[0]?.purchases).toBe(500);
    expect(result.rows[1]?.purchases).toBe(100);
    expect(result.total.purchases).toBe(600);
  });

  it("puts the periodic figure on the trial balance, per material type", async () => {
    await buy(rawItemId, 10, 50);
    await buy(packingItemId, 4, 25);
    await ctx.db.run("UPDATE stock_batches SET quantity_in_stock = 6 WHERE batch_number = ?", [
      "T-" + rawItemId + "-2026-11-08",
    ]);

    const tb = await reports.trialBalance();
    expect(tb.rows.find((row) => row.accountCode === "1200")?.consumedValue).toBe(200);
    expect(tb.rows.find((row) => row.accountCode === "1210")?.consumedValue).toBe(0);
  });

  it("does not count a stock correction as material coming in", async () => {
    await buy(rawItemId, 10, 50);
    await ctx.db.run("UPDATE stock_batches SET quantity_in_stock = 6 WHERE batch_number = ?", [
      "T-" + rawItemId + "-2026-11-08",
    ]);
    const before = await reports.materialsConsumption();

    // What the periodic fix posts: debit the account up to the count.
    await accounting.postJournalEntry({
      voucherType: "JOURNAL",
      entryDate: "2026-11-30",
      narration: "Stock correction",
      referenceNo: "PERIODIC-STOCK-CORR",
      lines: [
        { accountId: await accountId(ctx.db, "1200"), debit: 100 },
        { accountId: await accountId(ctx.db, "5000"), credit: 100 },
      ],
    });

    const after = await reports.materialsConsumption();
    // Same consumption: the correction restates the books, it is not an intake.
    expect(after.total.consumed).toBe(before.total.consumed);
    expect(after.total.otherIn).toBe(before.total.otherIn);
    // The books moved though, so they are 100 closer to the count.
    expect(after.total.bookClosing).toBe(before.total.bookClosing + 100);
    expect(after.total.difference).toBe(before.total.difference + 100);

    // Closing on the ledger, the correction has to be in "stock in" so the row
    // adds up: 0 + 500 + 100 − 600 = 0.
    const dated = await reports.materialsConsumption(undefined, "2026-11-30");
    expect(dated.total.otherIn).toBe(100);
    expect(dated.total.bookClosing).toBe(600);
    expect(dated.total.consumed).toBe(0);
  });

  it("ignores a correction whose reference carries a suffix", async () => {
    await buy(rawItemId, 10, 50);
    await ctx.db.run("UPDATE stock_batches SET quantity_in_stock = 6 WHERE batch_number = ?", [
      "T-" + rawItemId + "-2026-11-08",
    ]);
    const before = await reports.materialsConsumption();

    // fix-negative-stock.ts posts its opening restatement as
    // OPENING-STOCK-CORR-2, so a trailing-only match would miss it.
    await accounting.postJournalEntry({
      voucherType: "JOURNAL",
      entryDate: "2026-11-30",
      narration: "Opening stock for negative batches brought into the inventory accounts",
      referenceNo: "OPENING-STOCK-CORR-2",
      lines: [
        { accountId: await accountId(ctx.db, "1200"), debit: 400 },
        { accountId: await accountId(ctx.db, "3100"), credit: 400 },
      ],
    });

    const after = await reports.materialsConsumption();
    // A restatement is not material coming in, so consumption cannot move.
    expect(after.total.otherIn).toBe(before.total.otherIn);
    expect(after.total.consumed).toBe(before.total.consumed);
  });

  it("does not value a negative batch as negative stock", async () => {
    await buy(rawItemId, 10, 50);
    // Consumption drove the only batch below zero: there is no stock, not
    // minus 200 worth of it.
    await ctx.db.run("UPDATE stock_batches SET quantity_in_stock = -4 WHERE batch_number = ?", [
      "T-" + rawItemId + "-2026-11-08",
    ]);

    const tb = await reports.trialBalance();
    const row = tb.rows.find((candidate) => candidate.accountCode === "1200");
    expect((row?.tagBreakdown ?? []).reduce((total, tag) => total + tag.value, 0)).toBe(0);
    expect(row?.consumedValue).toBe(500);
  });

  it("closes on the inventory account when the report ends in the past", async () => {
    await buy(rawItemId, 10, 50, "2026-11-08");
    await buy(rawItemId, 4, 50, "2026-11-20");

    const firstHalf = await reports.materialsConsumption("2026-11-01", "2026-11-15");
    expect(firstHalf.to).toBe("2026-11-15");
    // The 20 November purchase is outside the period.
    expect(firstHalf.total.purchases).toBe(500);
    expect(firstHalf.total.bookClosing).toBe(500);
    expect(firstHalf.total.consumed).toBe(0);
    // No count survives in the past, so neither column is claimed.
    expect(firstHalf.total.counted).toBeNull();
    expect(firstHalf.total.difference).toBeNull();

    const november = await reports.materialsConsumption("2026-11-01", "2026-11-30");
    expect(november.total.purchases).toBe(700);
    expect(november.total.consumed).toBe(0);
  });

  it("never reports consumption from 31 October or earlier", async () => {
    await buy(rawItemId, 10, 50, "2026-10-08");

    // Asked for October only, the report is empty.
    const october = await reports.materialsConsumption(undefined, "2026-10-31");
    expect(october.total.purchases).toBe(0);
    expect(october.total.consumed).toBe(0);

    // With no dates, October is opening stock, not a purchase.
    const live = await reports.materialsConsumption();
    expect(live.from).toBe("2026-11-01");
    expect(live.total.opening).toBe(500);
    expect(live.total.purchases).toBe(0);
    expect(live.total.consumed).toBe(0);

    // A start before the books begin is pulled forward to the cutover.
    const clamped = await reports.materialsConsumption("2026-10-01");
    expect(clamped.from).toBe("2026-11-01");
    expect(clamped.total.opening).toBe(500);
    expect(clamped.total.purchases).toBe(0);
  });

  it("adds a later repack's delta to an old period", async () => {
    const packingAccount = await accountId(ctx.db, "1210");
    const finishedGoods = await accountId(ctx.db, "1220");
    const orderId = await consumeOrder(
      "packing",
      packingItemId,
      "2026-11-08",
      1,
      100,
      "PCO-00010",
    );

    // Original pack inside the period.
    await accounting.postJournalEntry({
      voucherType: "MANUFACTURING",
      entryDate: "2026-11-10",
      narration: "Packing order PCO-00010 packed",
      sourceTable: "packing_orders",
      sourceId: orderId,
      lines: [
        { accountId: finishedGoods, debit: 100 },
        { accountId: packingAccount, credit: 100 },
      ],
    });
    // Reopened and repacked after the period end, for 250 instead of 100.
    await accounting.postJournalEntry({
      voucherType: "MANUFACTURING",
      entryDate: "2026-11-20",
      narration: "Reversal - packing order PCO-00010",
      sourceTable: "packing_orders",
      sourceId: orderId,
      lines: [
        { accountId: packingAccount, debit: 100 },
        { accountId: finishedGoods, credit: 100 },
      ],
    });
    await accounting.postJournalEntry({
      voucherType: "MANUFACTURING",
      entryDate: "2026-11-20",
      narration: "Packing order PCO-00010 packed",
      sourceTable: "packing_orders",
      sourceId: orderId,
      lines: [
        { accountId: finishedGoods, debit: 250 },
        { accountId: packingAccount, credit: 250 },
      ],
    });

    const result = await reports.materialsConsumption("2026-11-01", "2026-11-15");
    const packing = result.rows.find((row) => row.itemType === "PACKING_MATERIAL");
    // 250 after the edit − 100 before it.
    expect(packing?.manufacturingEdits).toBe(150);
    // The original 100 in the period is replaced by the new 250.
    expect(packing?.consumed).toBe(250);
  });

  it("does not pull in a later pack that was never reopened", async () => {
    const rawAccount = await accountId(ctx.db, "1200");
    const finishedGoods = await accountId(ctx.db, "1220");
    const orderId = await consumeOrder("production", rawItemId, "2026-11-08", 1, 500, "PO-00010");

    await accounting.postJournalEntry({
      voucherType: "MANUFACTURING",
      entryDate: "2026-11-20",
      narration: "Production order PO-00010 produced",
      sourceTable: "production_orders",
      sourceId: orderId,
      lines: [
        { accountId: finishedGoods, debit: 500 },
        { accountId: rawAccount, credit: 500 },
      ],
    });

    const result = await reports.materialsConsumption("2026-11-01", "2026-11-15");
    expect(result.rows.find((row) => row.itemType === "RAW_MATERIAL")?.manufacturingEdits).toBe(0);
  });

  it("does not adjust a live report", async () => {
    const packingAccount = await accountId(ctx.db, "1210");
    const finishedGoods = await accountId(ctx.db, "1220");
    const orderId = await consumeOrder(
      "packing",
      packingItemId,
      "2026-11-08",
      1,
      100,
      "PCO-00011",
    );
    await accounting.postJournalEntry({
      voucherType: "MANUFACTURING",
      entryDate: "2026-11-10",
      narration: "Packing order PCO-00011 packed",
      sourceTable: "packing_orders",
      sourceId: orderId,
      lines: [
        { accountId: finishedGoods, debit: 100 },
        { accountId: packingAccount, credit: 100 },
      ],
    });
    await accounting.postJournalEntry({
      voucherType: "MANUFACTURING",
      entryDate: "2026-11-20",
      narration: "Reversal - packing order PCO-00011",
      sourceTable: "packing_orders",
      sourceId: orderId,
      lines: [
        { accountId: packingAccount, debit: 100 },
        { accountId: finishedGoods, credit: 100 },
      ],
    });

    const live = await reports.materialsConsumption();
    expect(live.total.manufacturingEdits).toBe(0);
  });

  it("values order consumption at each layer's own price", async () => {
    // 10 at 50 then 10 at 70, both drawn in the same period: 500 + 700.
    await consumeOrder("production", rawItemId, "2026-11-08", 10, 50, "PO-00020");
    await consumeOrder("production", rawItemId, "2026-11-18", 10, 70, "PO-00021");
    // A finished good taken by packing is not a material, so it stays out.
    await consumeOrder("packing", packingItemId, "2026-11-18", 4, 25, "PCO-00020");

    const result = await reports.materialsConsumption("2026-11-01", "2026-11-30");
    const raw = result.rows.find((row) => row.itemType === "RAW_MATERIAL");
    expect(raw?.orderQty).toBe(20);
    expect(raw?.orderValue).toBe(1_200);
    expect(raw?.orderLines).toBe(2);
    expect(raw?.orderCount).toBe(2);

    const packing = result.rows.find((row) => row.itemType === "PACKING_MATERIAL");
    expect(packing?.orderValue).toBe(100);
    expect(result.total.orderValue).toBe(1_300);
  });

  it("leaves order consumption out of a period before it happened", async () => {
    await consumeOrder("production", rawItemId, "2026-11-18", 10, 70, "PO-00022");

    const early = await reports.materialsConsumption("2026-11-01", "2026-11-10");
    expect(early.total.orderQty).toBe(0);
    expect(early.total.orderValue).toBe(0);

    const later = await reports.materialsConsumption("2026-11-01", "2026-11-30");
    expect(later.total.orderValue).toBe(700);
  });

  it("flags consumption that carries no cost at all", async () => {
    await consumeOrder("production", rawItemId, "2026-11-08", 10, 0, "PO-00023");
    await consumeOrder("production", rawItemId, "2026-11-08", 5, 60, "PO-00024");

    const result = await reports.materialsConsumption("2026-11-01", "2026-11-30");
    expect(result.total.orderValue).toBe(300);
    expect(result.total.orderUnpricedQty).toBe(10);
  });

  it("shows the periodic figure on a dated trial balance too", async () => {
    await buy(rawItemId, 10, 50);

    const tb = await reports.trialBalance({ to: "2026-11-30" });
    // Nothing left the store yet, so the period consumption is zero — but the
    // line is present, closing on the ledger balance at the end date.
    expect(tb.rows.find((row) => row.accountCode === "1200")?.consumedValue).toBe(0);
  });
});
