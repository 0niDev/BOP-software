import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertRow } from "../src/repositories/base.js";
import { PurchaseInvoiceService } from "../src/services/purchaseInvoiceService.js";
import { ReportService } from "../src/services/reportService.js";
import { freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let reports: ReportService;
let purchases: PurchaseInvoiceService;
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
  date = "2026-10-08",
): Promise<void> {
  await purchases.createPurchaseInvoice({
    supplierId,
    invoiceDate: date,
    paymentType: "CASH",
    items: [{ itemId, quantity, unitCost, batchNumber: `T-${itemId}-${date}` }],
  });
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
      "T-" + rawItemId + "-2026-10-08",
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

    const later = await reports.materialsConsumption("2026-10-09");
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
});
