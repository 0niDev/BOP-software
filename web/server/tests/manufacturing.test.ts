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

  it("edits and deletes a BOM", async () => {
    const bom = await mfg.createBom({
      finishedItemId: ctx.ids.itemId,
      outputQuantity: 10,
      components: [{ componentItemId: rawItemId, quantityRequired: 5 }],
    });

    await mfg.updateBom(bom.id, {
      finishedItemId: ctx.ids.itemId,
      outputQuantity: 20,
      components: [{ componentItemId: rawItemId, quantityRequired: 3 }],
    });
    const updated = await mfg.getBom(bom.id);
    expect(updated.bom.output_quantity).toBe(20);
    expect(updated.components).toHaveLength(1);
    expect(updated.components[0]!.quantity_required).toBe(3);

    const order = await mfg.createProductionOrder({
      bomId: bom.id,
      plannedQuantity: 1,
      manufacturingDate: "2026-10-08",
    });
    await expect(mfg.deleteBom(bom.id)).rejects.toBeInstanceOf(ValidationError);
    await mfg.deleteProductionOrder(order.id);
    await mfg.deleteBom(bom.id);
    expect(await mfg.getBom(bom.id).catch(() => null)).toBeNull();
  });

  it("edits and deletes a draft production order", async () => {
    const bom = await mfg.createBom({
      finishedItemId: ctx.ids.itemId,
      outputQuantity: 1,
      components: [{ componentItemId: rawItemId, quantityRequired: 1 }],
    });
    const order = await mfg.createProductionOrder({
      bomId: bom.id,
      plannedQuantity: 1,
      manufacturingDate: "2026-10-08",
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

    // The unpacked output is its own batch; the pre-existing DEMO-BATCH is untouched.
    const finished = await ctx.db.get<{ qty: number; purchase_price: number }>(
      "SELECT quantity_in_stock AS qty, purchase_price FROM stock_batches WHERE batch_number = 'FG-PROD-1'",
    );
    expect(finished?.qty).toBe(10);
    expect(finished?.purchase_price).toBe(10);
    const demo = await ctx.db.get<{ qty: number }>(
      "SELECT quantity_in_stock AS qty FROM stock_batches WHERE batch_number = 'DEMO-BATCH'",
    );
    expect(demo?.qty).toBe(1000);

    const je = await accounting.getJournalEntry("production_orders", order.id);
    const lines = je!.lines as Array<{ account_code: string; debit: number; credit: number }>;
    expect(lines.find((l) => l.account_code === "1220")?.debit).toBe(100);
    expect(lines.find((l) => l.account_code === "1200")?.credit).toBe(100);
    expect(lines.reduce((a, l) => a + l.debit, 0)).toBe(
      lines.reduce((a, l) => a + l.credit, 0),
    );
  });

  it("produces unpacked stock, then packs it consuming packing materials", async () => {
    const packingItemId = await insertRow(ctx.db, "items", {
      company_id: 1,
      item_code: "PM-1",
      item_name: "Packing Material 1",
      unit: "PCS",
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
    const unusedPackingId = await insertRow(ctx.db, "items", {
      company_id: 1,
      item_code: "PM-2",
      item_name: "Packing Material 2",
      unit: "PCS",
      item_type: "PACKING_MATERIAL",
      purchase_price: 5,
      selling_price: 0,
      minimum_stock: 0,
      maximum_stock: 0,
      is_active: 1,
    });
    await insertRow(ctx.db, "stock_batches", {
      item_id: unusedPackingId,
      warehouse_id: 1,
      batch_number: "PM-2-BATCH",
      purchase_price: 5,
      quantity_in_stock: 50,
      is_active: 1,
    });
    const bom = await mfg.createBom({
      finishedItemId: ctx.ids.itemId,
      outputQuantity: 10,
      components: [
        { componentItemId: rawItemId, quantityRequired: 5 },
        { componentItemId: packingItemId, quantityRequired: 10 },
        { componentItemId: unusedPackingId, quantityRequired: 10 },
      ],
    });
    const order = await mfg.createProductionOrder({
      bomId: bom.id,
      plannedQuantity: 10,
      manufacturingDate: "2026-10-08",
    });
    await mfg.startProduction(order.id);

    // Stage 1: raw only, output held as an unpacked batch that sales cannot see.
    const produced = await mfg.produceProduction(order.id, {
      actualQuantity: 10,
      outputBatchNumber: "FG-STAGE",
    });
    expect(produced.productionCost).toBe(100);
    expect(await rawQty()).toBe(95);
    const packingQty = async () =>
      (
        await ctx.db.get<{ qty: number }>(
          "SELECT quantity_in_stock AS qty FROM stock_batches WHERE batch_number = 'PM-1-BATCH'",
        )
      )?.qty ?? 0;
    expect(await packingQty()).toBe(100);

    const unpacked = await ctx.db.get<{ qty: number; batch_number: string }>(
      "SELECT quantity_in_stock AS qty, batch_number FROM stock_batches WHERE batch_number = 'UNPACKED-FG-STAGE'",
    );
    expect(unpacked?.qty).toBe(10);

    // Stage 2: packing materials are consumed and the batch becomes saleable.
    const packed = await mfg.packProduction(order.id, {
      outputBatchNumber: "FG-PACKED",
      materials: [{ itemId: packingItemId, quantity: 10 }],
    });
    expect(packed.productionCost).toBe(120);
    expect(await packingQty()).toBe(90);
    const unusedQty = await ctx.db.get<{ qty: number }>(
      "SELECT quantity_in_stock AS qty FROM stock_batches WHERE batch_number = 'PM-2-BATCH'",
    );
    expect(unusedQty?.qty).toBe(50);
    const finalBatch = await ctx.db.get<{ qty: number; purchase_price: number }>(
      "SELECT quantity_in_stock AS qty, purchase_price FROM stock_batches WHERE batch_number = 'FG-PACKED'",
    );
    expect(finalBatch?.qty).toBe(10);
    expect(finalBatch?.purchase_price).toBe(12);

    const { order: finished } = await mfg.getProductionOrder(order.id);
    expect(finished.status).toBe("COMPLETED");
    expect(finished.raw_material_cost).toBe(100);
    expect(finished.packing_material_cost).toBe(20);

    const journals = await ctx.db.all<{ total_debit: number }>(
      `SELECT SUM(jel.debit) AS total_debit FROM journal_entries je
         JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
        WHERE je.source_table = 'production_orders' AND je.source_id = ?`,
      [order.id],
    );
    expect(Number(journals[0]?.total_debit ?? 0)).toBe(120);
  });

  it("packs only part of the unpacked stock and leaves the rest", async () => {
    const packingItemId = await insertRow(ctx.db, "items", {
      company_id: 1,
      item_code: "PM-P",
      item_name: "Packing Material P",
      unit: "PCS",
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
      batch_number: "PM-P-BATCH",
      purchase_price: 2,
      quantity_in_stock: 100,
      is_active: 1,
    });
    const bom = await mfg.createBom({
      finishedItemId: ctx.ids.itemId,
      outputQuantity: 10,
      components: [
        { componentItemId: rawItemId, quantityRequired: 5 },
        { componentItemId: packingItemId, quantityRequired: 10 },
      ],
    });
    const order = await mfg.createProductionOrder({
      bomId: bom.id,
      plannedQuantity: 10,
      manufacturingDate: "2026-10-08",
    });
    await mfg.startProduction(order.id);
    await mfg.produceProduction(order.id, {
      actualQuantity: 10,
      outputBatchNumber: "FG-PART",
    });

    // Pack 4 of the 10 unpacked units: raw unit cost is 10, packing is 2/unit.
    const packed = await mfg.packProduction(order.id, {
      quantity: 4,
      materials: [{ itemId: packingItemId, quantity: 4 }],
    });
    expect(packed.productionCost).toBe(48);

    const remainder = await ctx.db.get<{ qty: number }>(
      "SELECT quantity_in_stock AS qty FROM stock_batches WHERE batch_number = 'UNPACKED-FG-PART'",
    );
    expect(remainder?.qty).toBe(6);
    const packedBatch = await ctx.db.get<{ qty: number; purchase_price: number }>(
      "SELECT quantity_in_stock AS qty, purchase_price FROM stock_batches WHERE batch_number = 'FG-PART'",
    );
    expect(packedBatch?.qty).toBe(4);
    expect(packedBatch?.purchase_price).toBe(12);

    const { order: partial } = await mfg.getProductionOrder(order.id);
    expect(partial.status).toBe("IN_PROGRESS");
    expect(partial.output_batch_number).toBe("UNPACKED-FG-PART");

    // Packing the rest completes the order; the unpacked batch is renamed away.
    await mfg.packProduction(order.id, {
      materials: [{ itemId: packingItemId, quantity: 6 }],
    });
    const unpackedGone = await ctx.db.get<{ qty: number }>(
      "SELECT quantity_in_stock AS qty FROM stock_batches WHERE batch_number = 'UNPACKED-FG-PART'",
    );
    expect(unpackedGone).toBeUndefined();
    const totalPacked = await ctx.db.get<{ qty: number }>(
      `SELECT SUM(quantity_in_stock) AS qty FROM stock_batches
        WHERE item_id = ? AND batch_number LIKE 'FG-PART%'`,
      [ctx.ids.itemId],
    );
    expect(totalPacked?.qty).toBe(10);
    const { order: done } = await mfg.getProductionOrder(order.id);
    expect(done.status).toBe("COMPLETED");
  });

  it("creates a hidden temporary one-use BOM for an ad-hoc order", async () => {
    const order = await mfg.createProductionOrder({
      plannedQuantity: 10,
      manufacturingDate: "2026-10-08",
      tempFinishedItemId: ctx.ids.itemId,
      tempComponents: [{ componentItemId: rawItemId, quantityRequired: 5 }],
    });
    expect(order.orderNumber).toMatch(/^PO-\d+$/);

    const { bom, components } = await mfg.getBom(order.bomId);
    expect(bom.is_temp).toBe(1);
    expect(bom.bom_name).toBe(`TEMP-${order.orderNumber}`);
    // Components are expressed per ONE unit of output, like the Python path.
    expect(bom.output_quantity).toBe(1);
    expect(components).toHaveLength(1);
    expect(components[0]!.quantity_required).toBe(5);

    // …and the temp BOM is invisible in the BOM list.
    const boms = await mfg.listBoms();
    expect(boms.some((row) => row.id === order.bomId)).toBe(false);
    expect(boms.some((row) => row.is_temp === 1)).toBe(false);
  });

  it("runs a temporary production order end to end", async () => {
    const order = await mfg.createProductionOrder({
      orderNumber: "PO-TEMP-1",
      plannedQuantity: 10,
      manufacturingDate: "2026-10-08",
      tempFinishedItemId: ctx.ids.itemId,
      tempComponents: [{ componentItemId: rawItemId, quantityRequired: 5 }],
    });
    expect(order.orderNumber).toBe("PO-TEMP-1");

    await mfg.startProduction(order.id);
    const result = await mfg.completeProduction(order.id, {
      actualQuantity: 10,
      outputBatchNumber: "FG-TEMP-1",
    });

    // 5 units of raw material per output unit x 10 output units at cost 20.
    expect(result.productionCost).toBe(1000);
    expect(await rawQty()).toBe(50);
    const je = await accounting.getJournalEntry("production_orders", order.id);
    const lines = je!.lines as Array<{ account_code: string; debit: number; credit: number }>;
    expect(lines.find((l) => l.account_code === "1220")?.debit).toBe(1000);
    expect(lines.find((l) => l.account_code === "1200")?.credit).toBe(1000);
  });

  it("rejects a malformed temporary or saved production order", async () => {
    const base = { plannedQuantity: 1, manufacturingDate: "2026-10-08" };
    // No BOM and no temporary details.
    await expect(mfg.createProductionOrder(base)).rejects.toBeInstanceOf(ValidationError);
    // Temporary production needs a finished good as the output item.
    await expect(
      mfg.createProductionOrder({
        ...base,
        tempFinishedItemId: rawItemId,
        tempComponents: [{ componentItemId: rawItemId, quantityRequired: 1 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    // …and at least one component, which must be raw/packing material.
    await expect(
      mfg.createProductionOrder({ ...base, tempFinishedItemId: ctx.ids.itemId, tempComponents: [] }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      mfg.createProductionOrder({
        ...base,
        tempFinishedItemId: ctx.ids.itemId,
        tempComponents: [{ componentItemId: ctx.ids.itemId, quantityRequired: 1 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
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

  it("can complete with ignore stock when component stock is insufficient", async () => {
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

    const result = await mfg.completeProduction(order.id, {
      actualQuantity: 1,
      ignoreStock: true,
    });
    expect(result.productionCost).toBe(20_000);
    expect(await rawQty()).toBe(100);

    const { consumptions } = await mfg.getProductionOrder(order.id);
    expect(consumptions).toHaveLength(0);
    const je = await accounting.getJournalEntry("production_orders", order.id);
    expect(je).not.toBeNull();
  });
});
