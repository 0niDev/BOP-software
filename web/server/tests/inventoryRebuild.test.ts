import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertRow } from "../src/repositories/base.js";
import { InventoryRebuildService } from "../src/services/inventoryRebuildService.js";
import { PurchaseInvoiceService } from "../src/services/purchaseInvoiceService.js";
import { accountId, freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let rebuilds: InventoryRebuildService;
let purchases: PurchaseInvoiceService;
let supplierId: number;
let rawItemId: number;

async function makeItem(code: string, type: string): Promise<number> {
  return insertRow(ctx.db, "items", {
    company_id: 1,
    item_code: code,
    item_name: `Item ${code}`,
    unit: "KG",
    item_type: type,
    purchase_price: 0,
    selling_price: 0,
    is_active: 1,
  });
}

/** A completed production order that consumed `quantity` of the raw item. */
async function produceUsing(quantity: number, date = "2026-11-10"): Promise<void> {
  const batch = await ctx.db.get<{ id: number }>(
    "SELECT id FROM stock_batches WHERE item_id = ? ORDER BY id LIMIT 1",
    [rawItemId],
  );
  const bomId = await insertRow(ctx.db, "bill_of_materials", {
    company_id: 1,
    finished_item_id: rawItemId,
    bom_name: "BOM",
    output_quantity: 1,
    phase: "FORMULATION",
    is_active: 1,
  });
  const orderId = await insertRow(ctx.db, "production_orders", {
    company_id: 1,
    warehouse_id: 1,
    order_number: `PO-${Math.random()}`,
    bom_id: bomId,
    planned_quantity: 1,
    actual_quantity: 0,
    manufacturing_date: date,
    status: "COMPLETED",
  });
  await insertRow(ctx.db, "production_consumption", {
    production_order_id: orderId,
    component_item_id: rawItemId,
    batch_id: batch!.id,
    quantity_consumed: quantity,
    unit_cost: 50,
  });
}

async function rawOnHand(): Promise<{ batch: number; movements: number }> {
  const batch = await ctx.db.get<{ qty: number }>(
    "SELECT ROUND(COALESCE(SUM(quantity_in_stock),0),4) qty FROM stock_batches WHERE item_id = ?",
    [rawItemId],
  );
  const movements = await ctx.db.get<{ qty: number }>(
    "SELECT ROUND(COALESCE(SUM(quantity),0),4) qty FROM stock_movements WHERE item_id = ?",
    [rawItemId],
  );
  return { batch: Number(batch?.qty ?? 0), movements: Number(movements?.qty ?? 0) };
}

async function rawOnBooks(): Promise<number> {
  const row = await ctx.db.get<{ net: number }>(
    `SELECT ROUND(COALESCE(SUM(jel.debit - jel.credit),0),2) net
       FROM journal_entry_lines jel
       JOIN accounts a ON a.id = jel.account_id
      WHERE a.account_code = '1200'`,
  );
  return Number(row?.net ?? 0);
}

beforeEach(async () => {
  ctx = await freshDb();
  rebuilds = new InventoryRebuildService(ctx.db, 1);
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
  rawItemId = await makeItem("RAW-1", "RAW_MATERIAL");
});
afterEach(async () => {
  await ctx.db.close();
});

describe("InventoryRebuildService", () => {
  it("leaves bought-less-consumed in stock and posts the difference", async () => {
    await purchases.createPurchaseInvoice({
      supplierId,
      invoiceDate: "2026-11-08",
      paymentType: "CASH",
      items: [{ itemId: rawItemId, quantity: 10, unitCost: 50, batchNumber: "R-1" }],
    });
    await produceUsing(4);

    const plan = await rebuilds.plan({ from: "2026-11-01", to: "2026-11-30" });
    const line = plan.lines.find((candidate) => candidate.itemId === rawItemId);
    expect(plan.errors).toEqual([]);
    expect(line?.purchased).toBe(10);
    expect(line?.productionConsumed).toBe(4);
    expect(line?.target).toBe(6);
    expect(line?.value).toBe(300);

    const result = await rebuilds.apply({ from: "2026-11-01", to: "2026-11-30" });
    expect(result.rebuildId).toBeGreaterThan(0);

    expect(await rawOnHand()).toEqual({ batch: 6, movements: 6 });
    // 500 bought, 200 consumed: the books land on the rebuild's value.
    expect(await rawOnBooks()).toBe(300);
  });

  it("values finished goods as manufacturing output less sales", async () => {
    const fgItemId = await makeItem("FG-1", "FINISHED_GOOD");
    const bomId = await insertRow(ctx.db, "bill_of_materials", {
      company_id: 1,
      finished_item_id: fgItemId,
      bom_name: "BOM FG",
      output_quantity: 1,
      phase: "PACKING",
      is_active: 1,
    });
    // Packing produced 100 of it in November.
    await insertRow(ctx.db, "packing_orders", {
      company_id: 1,
      warehouse_id: 1,
      order_number: "PCO-1",
      bom_id: bomId,
      planned_quantity: 100,
      actual_quantity: 100,
      manufacturing_date: "2026-11-10",
      status: "COMPLETED",
    });
    // Packing then used 40 of it as a component: still not a purchase or a sale.
    const batchId = await insertRow(ctx.db, "stock_batches", {
      item_id: fgItemId,
      warehouse_id: 1,
      batch_number: "FG-B",
      purchase_price: 100,
      quantity_in_stock: 0,
      is_active: 1,
    });
    const packingBom = await insertRow(ctx.db, "bill_of_materials", {
      company_id: 1,
      finished_item_id: rawItemId,
      bom_name: "BOM 2",
      output_quantity: 1,
      phase: "PACKING",
      is_active: 1,
    });
    const packingOrder = await insertRow(ctx.db, "packing_orders", {
      company_id: 1,
      warehouse_id: 1,
      order_number: "PCO-2",
      bom_id: packingBom,
      planned_quantity: 40,
      actual_quantity: 40,
      manufacturing_date: "2026-11-12",
      status: "COMPLETED",
    });
    await insertRow(ctx.db, "packing_consumption", {
      packing_order_id: packingOrder,
      component_item_id: fgItemId,
      batch_id: batchId,
      quantity_consumed: 40,
      unit_cost: 100,
    });
    // 30 were sold.
    const customerId = await insertRow(ctx.db, "parties", {
      company_id: 1,
      code: "CUS-1",
      name: "Test Customer",
      party_type: "CUSTOMER",
      opening_balance: 0,
      credit_limit: 0,
      is_active: 1,
    });
    const invoiceId = await insertRow(ctx.db, "sales_invoices", {
      company_id: 1,
      warehouse_id: 1,
      invoice_number: "SI-1",
      customer_id: customerId,
      invoice_date: "2026-11-20",
      payment_type: "CASH",
      status: "CONFIRMED",
    });
    await insertRow(ctx.db, "sales_invoice_items", {
      invoice_id: invoiceId,
      item_id: fgItemId,
      quantity: 30,
      unit_price: 0,
      line_total: 0,
    });

    const plan = await rebuilds.plan({ from: "2026-11-01", to: "2026-11-30" });
    const line = plan.lines.find((candidate) => candidate.itemId === fgItemId);
    expect(line?.produced).toBe(100);
    expect(line?.sold).toBe(30);
    expect(line?.packingConsumed).toBe(40);
    // Output − sales, with neither the packing consumption nor any purchase.
    expect(line?.target).toBe(70);
    expect(line?.flags).toContain("packed-from");

    // Opting into the netting: output − sales − what packing drew out of it.
    const netted = await rebuilds.plan({
      from: "2026-11-01",
      to: "2026-11-30",
      fgNetConsumption: true,
    });
    expect(netted.lines.find((candidate) => candidate.itemId === fgItemId)?.target).toBe(30);
  });

  it("ignores October", async () => {
    await purchases.createPurchaseInvoice({
      supplierId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      items: [{ itemId: rawItemId, quantity: 10, unitCost: 50, batchNumber: "R-OCT" }],
    });

    const plan = await rebuilds.plan({ from: "2026-11-01", to: "2026-11-30" });
    const line = plan.lines.find((candidate) => candidate.itemId === rawItemId);
    expect(line?.purchased).toBe(0);
    expect(line?.target).toBe(0);

    await rebuilds.apply({ from: "2026-11-01", to: "2026-11-30" });
    expect(await rawOnHand()).toEqual({ batch: 0, movements: 0 });
  });

  it("sets an item that was used but never bought to negative", async () => {
    // Consumption recorded against a batch the purchases never created.
    const batchId = await insertRow(ctx.db, "stock_batches", {
      item_id: rawItemId,
      warehouse_id: 1,
      batch_number: "NEG-1",
      purchase_price: 50,
      quantity_in_stock: 0,
      is_active: 1,
    });
    const bomId = await insertRow(ctx.db, "bill_of_materials", {
      company_id: 1,
      finished_item_id: rawItemId,
      bom_name: "BOM",
      output_quantity: 1,
      phase: "FORMULATION",
      is_active: 1,
    });
    const orderId = await insertRow(ctx.db, "production_orders", {
      company_id: 1,
      warehouse_id: 1,
      order_number: "PO-1",
      bom_id: bomId,
      planned_quantity: 1,
      manufacturing_date: "2026-11-12",
      status: "COMPLETED",
    });
    await insertRow(ctx.db, "production_consumption", {
      production_order_id: orderId,
      component_item_id: rawItemId,
      batch_id: batchId,
      quantity_consumed: 5,
      unit_cost: 50,
    });

    const plan = await rebuilds.plan({ from: "2026-11-01", to: "2026-11-30" });
    const line = plan.lines.find((candidate) => candidate.itemId === rawItemId);
    expect(line?.target).toBe(-5);
    expect(line?.flags).toContain("negative");

    await rebuilds.apply({ from: "2026-11-01", to: "2026-11-30" });
    expect(await rawOnHand()).toEqual({ batch: -5, movements: -5 });
  });

  it("restores the exact state the rebuild replaced", async () => {
    await purchases.createPurchaseInvoice({
      supplierId,
      invoiceDate: "2026-11-08",
      paymentType: "CASH",
      items: [{ itemId: rawItemId, quantity: 10, unitCost: 50, batchNumber: "R-1" }],
    });
    await produceUsing(4);
    const before = await rawOnHand();
    const beforeBooks = await rawOnBooks();
    const movementsBefore = await ctx.db.get<{ n: number }>(
      "SELECT COUNT(*) n FROM stock_movements WHERE item_id = ?",
      [rawItemId],
    );

    const { rebuildId } = await rebuilds.apply({ from: "2026-11-01", to: "2026-11-30" });
    expect(await rawOnHand()).toEqual({ batch: 6, movements: 6 });

    await rebuilds.restore(rebuildId);
    expect(await rawOnHand()).toEqual(before);
    expect(await rawOnBooks()).toBe(beforeBooks);
    const movementsAfter = await ctx.db.get<{ n: number }>(
      "SELECT COUNT(*) n FROM stock_movements WHERE item_id = ?",
      [rawItemId],
    );
    expect(movementsAfter?.n).toBe(movementsBefore?.n);

    const history = await rebuilds.list();
    expect(history[0]?.restored_at).toBeTruthy();
  });

  it("refuses a second rebuild until the first is restored", async () => {
    await rebuilds.apply({ from: "2026-11-01", to: "2026-11-30" });
    await expect(rebuilds.apply({ from: "2026-11-01", to: "2026-11-30" })).rejects.toThrow(
      /still active/,
    );
    await expect(rebuilds.apply({ from: "2026-11-01", to: "2026-11-30", force: true })).resolves.toBeTruthy();
  });

  it("refuses to restore over stock recorded after the rebuild", async () => {
    const batchId = await insertRow(ctx.db, "stock_batches", {
      item_id: rawItemId,
      warehouse_id: 1,
      batch_number: "R-1",
      purchase_price: 50,
      quantity_in_stock: 4,
      is_active: 1,
    });
    const { rebuildId } = await rebuilds.apply({ from: "2026-11-01", to: "2026-11-30" });
    await insertRow(ctx.db, "stock_movements", {
      item_id: rawItemId,
      batch_id: batchId,
      warehouse_id: 1,
      movement_type: "ADJUSTMENT",
      quantity: 1,
      unit_cost: 50,
      movement_date: "2026-11-29",
      notes: "counted later",
    });
    await expect(rebuilds.restore(rebuildId)).rejects.toThrow(/recorded after this rebuild/);
  });
});
