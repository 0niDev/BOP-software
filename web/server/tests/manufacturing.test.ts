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
let packingItemId: number;

const DATE = "2026-10-08";

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
  packingItemId = await insertRow(ctx.db, "items", {
    company_id: 1,
    item_code: "PM-1",
    item_name: "Bottle 1 Lit",
    unit: "UNIT",
    item_type: "PACKING_MATERIAL",
    purchase_price: 2,
    selling_price: 0,
    minimum_stock: 0,
    maximum_stock: 0,
    is_active: 1,
  });
  await insertRow(ctx.db, "stock_batches", {
    item_id: packingItemId,
    warehouse_id: 1,
    batch_number: "PM-1-BATCH",
    purchase_price: 2,
    quantity_in_stock: 100,
    is_active: 1,
  });
});
afterEach(async () => {
  await ctx.db.close();
});

async function batchQty(batchNumber: string): Promise<number> {
  const row = await ctx.db.get<{ qty: number }>(
    "SELECT quantity_in_stock AS qty FROM stock_batches WHERE batch_number = ?",
    [batchNumber],
  );
  return row?.qty ?? 0;
}

/** A formulation BOM producing 10 units of "(Unpacked) Syrup" from 5 KG raw. */
async function formulationBom() {
  return mfg.createBom({
    bomName: "Syrup",
    outputQuantity: 10,
    components: [{ componentItemId: rawItemId, quantityRequired: 5 }],
  });
}

async function producedBulk(): Promise<{
  bom: { id: number; finishedItemId: number };
  order: { id: number };
}> {
  const bom = await formulationBom();
  const order = await mfg.createProductionOrder({
    bomId: bom.id,
    plannedQuantity: 10,
    manufacturingDate: DATE,
  });
  await mfg.startProduction(order.id);
  await mfg.produceProduction(order.id, { actualQuantity: 10, outputBatchNumber: "BULK-1" });
  return { bom, order };
}

describe("ManufacturingService — BOMs", () => {
  it("creates the (Unpacked) output item automatically for a formulation BOM", async () => {
    const bom = await formulationBom();
    const detail = await mfg.getBom(bom.id);
    expect(detail.bom.phase).toBe("FORMULATION");
    expect(bom.finishedItemId).not.toBe(ctx.ids.itemId);

    const item = await ctx.db.get<{ item_name: string; item_type: string; unit: string }>(
      "SELECT item_name, item_type, unit FROM items WHERE id = ?",
      [bom.finishedItemId],
    );
    expect(item?.item_name).toBe("(Unpacked) Syrup");
    expect(item?.item_type).toBe("FINISHED_GOOD");
    // Bulk is measured in the raw material's unit.
    expect(item?.unit).toBe("KG");
  });

  it("reuses the (Unpacked) item when the same BOM name is created again", async () => {
    const first = await formulationBom();
    const second = await formulationBom().catch(() => null);
    expect(second).toBeNull(); // duplicate BOM name rejected
    const item = await ctx.db.get<{ id: number }>(
      "SELECT id FROM items WHERE item_name = '(Unpacked) Syrup'",
    );
    expect(item?.id).toBe(first.finishedItemId);
  });

  it("auto-generates a BOM name and names its output item after it", async () => {
    const bom = await mfg.createBom({
      outputQuantity: 10,
      components: [{ componentItemId: rawItemId, quantityRequired: 5 }],
    });
    expect(bom.bomName).toMatch(/^BOM-\d+$/);
    const item = await ctx.db.get<{ item_name: string }>(
      "SELECT item_name FROM items WHERE id = ?",
      [bom.finishedItemId],
    );
    expect(item?.item_name).toBe(`(Unpacked) ${bom.bomName}`);
    const { components } = await mfg.getBom(bom.id);
    expect(components).toHaveLength(1);
    expect(components[0]!.quantity_required).toBe(5);
  });

  it("marks a packing BOM from its finished-good component and requires the output item", async () => {
    const unpacked = await formulationBom();
    const packing = await mfg.createBom({
      bomName: "Syrup bottles",
      finishedItemId: ctx.ids.itemId,
      outputQuantity: 1,
      components: [
        { componentItemId: unpacked.finishedItemId, quantityRequired: 1 },
        { componentItemId: packingItemId, quantityRequired: 1 },
      ],
    });
    const detail = await mfg.getBom(packing.id);
    expect(detail.bom.phase).toBe("PACKING");
    expect(detail.bom.finished_item_id).toBe(ctx.ids.itemId);

    // A packing BOM without its output item is rejected.
    await expect(
      mfg.createBom({
        bomName: "No output",
        outputQuantity: 1,
        components: [{ componentItemId: packingItemId, quantityRequired: 1 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    // More than one unpacked material is ambiguous.
    await expect(
      mfg.createBom({
        finishedItemId: ctx.ids.itemId,
        outputQuantity: 1,
        components: [
          { componentItemId: unpacked.finishedItemId, quantityRequired: 1 },
          { componentItemId: ctx.ids.itemId, quantityRequired: 1 },
        ],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a BOM that mixes raw materials with packing or finished goods", async () => {
    await expect(
      mfg.createBom({
        outputQuantity: 10,
        components: [
          { componentItemId: rawItemId, quantityRequired: 5 },
          { componentItemId: packingItemId, quantityRequired: 1 },
        ],
      }),
    ).rejects.toThrow(/cannot mix raw materials/i);
  });

  it("renaming a formulation BOM leaves its (Unpacked) item untouched", async () => {
    const bom = await formulationBom();
    await mfg.updateBom(bom.id, {
      bomName: "Syrup v2",
      outputQuantity: 20,
      components: [{ componentItemId: rawItemId, quantityRequired: 3 }],
    });
    const updated = await mfg.getBom(bom.id);
    expect(updated.bom.bom_name).toBe("Syrup v2");
    expect(updated.bom.output_quantity).toBe(20);
    expect(updated.bom.finished_item_id).toBe(bom.finishedItemId);
    const item = await ctx.db.get<{ item_name: string }>(
      "SELECT item_name FROM items WHERE id = ?",
      [bom.finishedItemId],
    );
    expect(item?.item_name).toBe("(Unpacked) Syrup");
  });

  it("deletes an unused BOM and refuses one used by an order", async () => {
    const bom = await formulationBom();
    const order = await mfg.createProductionOrder({
      bomId: bom.id,
      plannedQuantity: 1,
      manufacturingDate: DATE,
    });
    await expect(mfg.deleteBom(bom.id)).rejects.toBeInstanceOf(ValidationError);
    await mfg.deleteProductionOrder(order.id);
    await mfg.deleteBom(bom.id);
    expect(await mfg.getBom(bom.id).catch(() => null)).toBeNull();
  });

  it("allows a deactivated BOM to be used for a production order", async () => {
    const bom = await formulationBom();
    await mfg.updateBom(bom.id, {
      outputQuantity: 10,
      components: [{ componentItemId: rawItemId, quantityRequired: 5 }],
      isActive: false,
    });
    expect((await mfg.listBoms(true)).some((row) => row.id === bom.id)).toBe(false);
    const order = await mfg.createProductionOrder({
      bomId: bom.id,
      plannedQuantity: 2,
      manufacturingDate: DATE,
    });
    expect(order.bomId).toBe(bom.id);
    await mfg.deleteProductionOrder(order.id);
  });
});

describe("ManufacturingService — production", () => {
  it("edits and deletes a draft production order", async () => {
    const bom = await formulationBom();
    const order = await mfg.createProductionOrder({
      bomId: bom.id,
      plannedQuantity: 1,
      manufacturingDate: DATE,
    });
    await mfg.updateProductionOrder(order.id, {
      bomId: bom.id,
      plannedQuantity: 7,
      manufacturingDate: "2026-10-09",
    });
    const { order: updated } = await mfg.getProductionOrder(order.id);
    expect(updated.planned_quantity).toBe(7);
    expect(updated.manufacturing_date).toBe("2026-10-09");

    await mfg.deleteProductionOrder(order.id);
    await expect(mfg.getProductionOrder(order.id)).rejects.toBeTruthy();
  });

  it("saves a per-unit BOM from a manual run's totals", async () => {
    const order = await mfg.createProductionOrder({
      bomName: "Ad hoc batch",
      plannedQuantity: 10,
      manufacturingDate: DATE,
      components: [{ componentItemId: rawItemId, quantityRequired: 20 }],
    });
    expect(order.orderNumber).toMatch(/^PO-\d+$/);

    const { bom, components } = await mfg.getBom(order.bomId);
    expect(bom.bom_name).toBe("Ad hoc batch");
    expect(bom.output_quantity).toBe(1);
    expect(bom.phase).toBe("FORMULATION");
    expect(components).toHaveLength(1);
    expect(components[0]!.quantity_required).toBe(2);
    const item = await ctx.db.get<{ item_name: string }>(
      "SELECT item_name FROM items WHERE id = ?",
      [order.finishedItemId],
    );
    expect(item?.item_name).toBe("(Unpacked) Ad hoc batch");

    await mfg.startProduction(order.id);
    // 20 KG of totals over 10 units = 2 KG/unit; producing 10 consumes 20 KG @20.
    const result = await mfg.produceProduction(order.id, { actualQuantity: 10 });
    expect(result.productionCost).toBe(400);
    expect(await batchQty("RM-1-BATCH")).toBe(80);
  });

  it("rejects a manual run without totals or with a packing BOM", async () => {
    await expect(
      mfg.createProductionOrder({ plannedQuantity: 1, manufacturingDate: DATE }),
    ).rejects.toBeInstanceOf(ValidationError);

    const packing = await mfg.createBom({
      finishedItemId: ctx.ids.itemId,
      outputQuantity: 1,
      components: [{ componentItemId: packingItemId, quantityRequired: 1 }],
    });
    await expect(
      mfg.createProductionOrder({ bomId: packing.id, plannedQuantity: 1, manufacturingDate: DATE }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("produces unpacked stock, consumes raw materials and posts to inventory", async () => {
    const bom = await formulationBom();
    const order = await mfg.createProductionOrder({
      bomId: bom.id,
      plannedQuantity: 10,
      manufacturingDate: DATE,
    });
    await mfg.startProduction(order.id);
    const result = await mfg.produceProduction(order.id, {
      actualQuantity: 10,
      outputBatchNumber: "FG-PROD-1",
    });

    // 5 KG of raw at 20 => 100.
    expect(result.productionCost).toBe(100);
    expect(await batchQty("RM-1-BATCH")).toBe(95);

    const unpacked = await ctx.db.get<{ qty: number; purchase_price: number; item_id: number }>(
      "SELECT quantity_in_stock AS qty, purchase_price, item_id FROM stock_batches WHERE batch_number = 'FG-PROD-1'",
    );
    expect(unpacked?.qty).toBe(10);
    expect(unpacked?.purchase_price).toBe(10);
    expect(unpacked?.item_id).toBe(bom.finishedItemId);
    expect(await batchQty("DEMO-BATCH")).toBe(1000);

    const je = await accounting.getJournalEntry("production_orders", order.id);
    const lines = je!.lines as Array<{ account_code: string; debit: number; credit: number }>;
    expect(lines.find((l) => l.account_code === "1220")?.debit).toBe(100);
    expect(lines.find((l) => l.account_code === "1200")?.credit).toBe(100);
    expect(lines.reduce((a, l) => a + l.debit, 0)).toBe(
      lines.reduce((a, l) => a + l.credit, 0),
    );
  });

  it("refuses to produce with insufficient stock unless Ignore stock is set", async () => {
    const bom = await mfg.createBom({
      bomName: "Huge batch",
      outputQuantity: 1,
      components: [{ componentItemId: rawItemId, quantityRequired: 1000 }],
    });
    const order = await mfg.createProductionOrder({
      bomId: bom.id,
      plannedQuantity: 1,
      manufacturingDate: DATE,
    });
    await mfg.startProduction(order.id);
    await expect(
      mfg.produceProduction(order.id, { actualQuantity: 1 }),
    ).rejects.toBeInstanceOf(InsufficientStockError);
    expect(await batchQty("RM-1-BATCH")).toBe(100);

    const forced = await mfg.produceProduction(order.id, {
      actualQuantity: 1,
      ignoreStock: true,
    });
    expect(forced.productionCost).toBe(20_000);
    expect(await batchQty("RM-1-BATCH")).toBe(100);
    const { consumptions } = await mfg.getProductionOrder(order.id);
    expect(consumptions).toHaveLength(0);
    expect(await accounting.getJournalEntry("production_orders", order.id)).not.toBeNull();
  });
});

describe("ManufacturingService — packing", () => {
  it("packs unpacked bulk with packing materials into finished goods", async () => {
    const { bom } = await producedBulk();
    const packing = await mfg.createPackingOrder({
      packingBomName: "Syrup bottles",
      plannedQuantity: 10,
      manufacturingDate: DATE,
      outputItemId: ctx.ids.itemId,
      unpackedItemId: bom.finishedItemId,
      unpackedQuantity: 10,
      materials: [{ componentItemId: packingItemId, quantityRequired: 10 }],
    });
    expect(packing.orderNumber).toMatch(/^PCO-\d+$/);

    const saved = await mfg.getBom(packing.bomId);
    expect(saved.bom.phase).toBe("PACKING");
    expect(saved.bom.finished_item_id).toBe(ctx.ids.itemId);
    expect(saved.bom.output_quantity).toBe(1);
    expect(saved.components).toHaveLength(2);
    // Per unit: 1 unit of unpacked bulk + 1 bottle.
    expect(saved.components.map((c) => c.quantity_required).sort()).toEqual([1, 1]);

    await mfg.startPacking(packing.id);
    const result = await mfg.packPackingOrder(packing.id, { outputBatchNumber: "FG-PACKED" });

    // Unpacked 10 @10 = 100, bottles 10 @2 = 20.
    expect(result.productionCost).toBe(120);
    expect(await batchQty("BULK-1")).toBe(0);
    expect(await batchQty("PM-1-BATCH")).toBe(90);

    const fg = await ctx.db.get<{ qty: number; purchase_price: number; item_id: number }>(
      "SELECT quantity_in_stock AS qty, purchase_price, item_id FROM stock_batches WHERE batch_number = 'FG-PACKED'",
    );
    expect(fg?.qty).toBe(10);
    expect(fg?.purchase_price).toBe(12);
    expect(fg?.item_id).toBe(ctx.ids.itemId);

    const { order } = await mfg.getPackingOrder(packing.id);
    expect(order.status).toBe("COMPLETED");
    expect(order.production_cost).toBe(120);

    const je = await accounting.getJournalEntry("packing_orders", packing.id);
    const lines = je!.lines as Array<{ account_code: string; debit: number; credit: number }>;
    expect(lines.find((l) => l.account_code === "1220")?.debit).toBe(120);
    expect(lines.find((l) => l.account_code === "1210")?.credit).toBe(20);
    expect(lines.reduce((a, l) => a + l.debit, 0)).toBe(
      lines.reduce((a, l) => a + l.credit, 0),
    );
  });

  it("packs part of a packing order and completes it with the rest", async () => {
    const { bom } = await producedBulk();
    const packing = await mfg.createPackingOrder({
      packingBomName: "Partial pack",
      plannedQuantity: 10,
      manufacturingDate: DATE,
      outputItemId: ctx.ids.itemId,
      unpackedItemId: bom.finishedItemId,
      unpackedQuantity: 10,
      materials: [{ componentItemId: packingItemId, quantityRequired: 10 }],
    });
    await mfg.startPacking(packing.id);

    const partial = await mfg.packPackingOrder(packing.id, {
      units: 4,
      unpackedQuantity: 4,
      materials: [{ itemId: packingItemId, quantity: 4 }],
    });
    expect(partial.productionCost).toBe(48);
    expect(await batchQty("BULK-1")).toBe(6);
    expect((await mfg.getPackingOrder(packing.id)).order.status).toBe("IN_PROGRESS");

    await mfg.packPackingOrder(packing.id, {
      units: 6,
      unpackedQuantity: 6,
      materials: [{ itemId: packingItemId, quantity: 6 }],
    });
    expect((await mfg.getPackingOrder(packing.id)).order.status).toBe("COMPLETED");
    expect(await batchQty("BULK-1")).toBe(0);
  });

  it("packs from a saved packing BOM, using its per-unit recipe", async () => {
    const { bom } = await producedBulk();
    const packingBom = await mfg.createBom({
      bomName: "Saved packing",
      finishedItemId: ctx.ids.itemId,
      outputQuantity: 1,
      components: [
        { componentItemId: bom.finishedItemId, quantityRequired: 1 },
        { componentItemId: packingItemId, quantityRequired: 2 },
      ],
    });
    const order = await mfg.createPackingOrder({
      bomId: packingBom.id,
      plannedQuantity: 5,
      manufacturingDate: DATE,
    });
    await mfg.startPacking(order.id);
    const result = await mfg.packPackingOrder(order.id);
    // 5 unpacked @10 + 10 bottles @2 = 70.
    expect(result.productionCost).toBe(70);
    expect(await batchQty("PM-1-BATCH")).toBe(90);
  });

  it("refuses a formulation BOM for packing and vice versa", async () => {
    const bom = await formulationBom();
    await expect(
      mfg.createPackingOrder({ bomId: bom.id, plannedQuantity: 1, manufacturingDate: DATE }),
    ).rejects.toBeInstanceOf(ValidationError);

    const packing = await mfg.createBom({
      finishedItemId: ctx.ids.itemId,
      outputQuantity: 1,
      components: [{ componentItemId: packingItemId, quantityRequired: 1 }],
    });
    await expect(
      mfg.createProductionOrder({ bomId: packing.id, plannedQuantity: 1, manufacturingDate: DATE }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses packing with insufficient stock unless Ignore stock is set", async () => {
    const { bom } = await producedBulk();
    const order = await mfg.createPackingOrder({
      packingBomName: "Too many bottles",
      plannedQuantity: 10,
      manufacturingDate: DATE,
      outputItemId: ctx.ids.itemId,
      unpackedItemId: bom.finishedItemId,
      unpackedQuantity: 10,
      materials: [{ componentItemId: packingItemId, quantityRequired: 500 }],
    });
    await mfg.startPacking(order.id);
    await expect(mfg.packPackingOrder(order.id)).rejects.toBeInstanceOf(InsufficientStockError);
    expect(await batchQty("PM-1-BATCH")).toBe(100);

    const forced = await mfg.packPackingOrder(order.id, { ignoreStock: true });
    expect(forced.productionCost).toBe(1100); // 10 @10 + 500 @2
    expect(await batchQty("PM-1-BATCH")).toBe(100);
    expect((await mfg.getPackingOrder(order.id)).consumptions).toHaveLength(0);
  });

  it("deletes a draft packing order and refuses to delete its BOM while it exists", async () => {
    const { bom } = await producedBulk();
    const order = await mfg.createPackingOrder({
      packingBomName: "Draft pack",
      plannedQuantity: 1,
      manufacturingDate: DATE,
      outputItemId: ctx.ids.itemId,
      unpackedItemId: bom.finishedItemId,
      unpackedQuantity: 1,
    });
    await expect(mfg.deleteBom(order.bomId)).rejects.toBeInstanceOf(ValidationError);
    await mfg.deletePackingOrder(order.id);
    await mfg.deleteBom(order.bomId);
  });
});
