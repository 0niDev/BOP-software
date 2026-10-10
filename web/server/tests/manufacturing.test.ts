import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InsufficientStockError, ValidationError } from "../src/domain/errors.js";
import { insertRow } from "../src/repositories/base.js";
import { AccountingService } from "../src/services/accountingService.js";
import { ManufacturingService } from "../src/services/manufacturingService.js";
import { freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let mfg: ManufacturingService;
let accounting: AccountingService;
let rawItemId: number;

beforeEach(async () => {
  ctx = await freshDb();
  mfg = new ManufacturingService(ctx.db);
  accounting = new AccountingService(ctx.db);
  rawItemId = await insertRow(ctx.db, "items", {
    company_id: 1,
    item_code: "RM-1",
    item_name: "Raw Material 1",
    unit: "KG",
    item_type: "RAW_MATERIAL",
    purchase_price: 20,
    selling_price: 0,
    minimum_stock: 0,
    maximum_stock: 0,
    is_active: 1,
  });
  await insertRow(ctx.db, "stock_batches", {
    item_id: rawItemId,
    warehouse_id: 1,
    batch_number: "RM-1-BATCH",
    purchase_price: 20,
    quantity_in_stock: 100,
    is_active: 1,
  });
});
afterEach(async () => {
  await ctx.db.close();
});

async function rawQty(): Promise<number> {
  const row = await ctx.db.get<{ qty: number }>(
    "SELECT quantity_in_stock AS qty FROM stock_batches WHERE batch_number = 'RM-1-BATCH'",
  );
  return row?.qty ?? 0;
}

describe("ManufacturingService", () => {
  it("creates a BOM with an auto-generated name", async () => {
    const bom = await mfg.createBom({
      finishedItemId: ctx.ids.itemId,
      outputQuantity: 10,
      components: [{ componentItemId: rawItemId, quantityRequired: 5 }],
    });
    expect(bom.bomName).toMatch(/^BOM-\d+$/);
    const { components } = await mfg.getBom(bom.id);
    expect(components).toHaveLength(1);
    expect(components[0]!.quantity_required).toBe(5);
  });

  it("rejects a BOM whose finished item is not a finished good", async () => {
    await expect(
      mfg.createBom({
        finishedItemId: rawItemId,
        outputQuantity: 1,
        components: [{ componentItemId: rawItemId, quantityRequired: 1 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("completes a production order: consumes stock and posts to inventory", async () => {
    const bom = await mfg.createBom({
      finishedItemId: ctx.ids.itemId,
      outputQuantity: 10,
      components: [{ componentItemId: rawItemId, quantityRequired: 5 }],
    });
    const order = await mfg.createProductionOrder({
      bomId: bom.id,
      plannedQuantity: 10,
      manufacturingDate: "2026-10-08",
    });
    await mfg.startProduction(order.id);
    const result = await mfg.completeProduction(order.id, {
      actualQuantity: 10,
      outputBatchNumber: "FG-PROD-1",
    });

    // 5 units of raw material at cost 20 => 100
    expect(result.productionCost).toBe(100);
    expect(await rawQty()).toBe(95);

    // Faithful to the Python code: when the finished item already has a stock
    // batch, output is ADDED to it (and its costs refreshed) rather than a new
    // batch being created. The demo finished good starts with 1000 units.
    const finished = await ctx.db.get<{ qty: number; purchase_price: number }>(
      "SELECT quantity_in_stock AS qty, purchase_price FROM stock_batches WHERE batch_number = 'DEMO-BATCH'",
    );
    expect(finished?.qty).toBe(1010);
    expect(finished?.purchase_price).toBe(10);

    const je = await accounting.getJournalEntry("production_orders", order.id);
    const lines = je!.lines as Array<{ account_code: string; debit: number; credit: number }>;
    expect(lines.find((l) => l.account_code === "1220")?.debit).toBe(100);
    expect(lines.find((l) => l.account_code === "1200")?.credit).toBe(100);
    expect(lines.reduce((a, l) => a + l.debit, 0)).toBe(
      lines.reduce((a, l) => a + l.credit, 0),
    );
  });

  it("refuses to complete when component stock is insufficient", async () => {
    const bom = await mfg.createBom({
      finishedItemId: ctx.ids.itemId,
      outputQuantity: 1,
      components: [{ componentItemId: rawItemId, quantityRequired: 1000 }],
    });
    const order = await mfg.createProductionOrder({
      bomId: bom.id,
      plannedQuantity: 1,
      manufacturingDate: "2026-10-08",
    });
    await mfg.startProduction(order.id);
    await expect(
      mfg.completeProduction(order.id, { actualQuantity: 1 }),
    ).rejects.toBeInstanceOf(InsufficientStockError);
    expect(await rawQty()).toBe(100);
  });
});
