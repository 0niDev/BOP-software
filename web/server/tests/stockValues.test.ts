import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "../src/domain/errors.js";
import { insertRow } from "../src/repositories/base.js";
import { ItemService } from "../src/services/itemService.js";
import { accountId, closeDb, freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let items: ItemService;

beforeEach(async () => {
  ctx = await freshDb();
  items = new ItemService(ctx.db);
});
afterEach(async () => {
  await closeDb(ctx.db);
});

describe("ItemService.setStockValues", () => {
  it("brings a negative item to the real qty and posts inventory vs retained earnings", async () => {
    const item = await items.create({ itemName: "Negative Raw", itemType: "RAW_MATERIAL" });
    await insertRow(ctx.db, "stock_batches", {
      item_id: item.id,
      warehouse_id: 1,
      batch_number: "NEG-1",
      purchase_price: 0,
      raw_unit_cost: 0,
      packing_unit_cost: 0,
      quantity_in_stock: -5,
      received_date: "2026-01-01",
      is_active: 1,
    });

    const result = await items.setStockValues([
      { itemId: item.id, quantityOnHand: 10, unitCost: 4 },
    ]);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].addedQuantity).toBe(15);
    expect(result.totalValue).toBe(60);

    const listed = await items.list();
    expect(listed.find((row) => row.id === item.id)?.current_stock).toBe(10);

    const inventory = await accountId(ctx.db, "1200");
    const retained = await accountId(ctx.db, "3100");
    const payable = await accountId(ctx.db, "2000");
    const lines = await ctx.db.all<{ account_id: number; debit: number; credit: number }>(
      "SELECT account_id, debit, credit FROM journal_entry_lines WHERE journal_entry_id = ?",
      [result.journalEntryId],
    );
    expect(lines.find((line) => line.account_id === inventory)).toMatchObject({
      debit: 60,
      credit: 0,
    });
    expect(lines.find((line) => line.account_id === retained)).toMatchObject({
      debit: 0,
      credit: 60,
    });
    expect(lines.some((line) => line.account_id === payable)).toBe(false);
  });

  it("rejects an on-hand quantity below current stock and changes nothing", async () => {
    const item = await items.create({ itemName: "Keep Stock", itemType: "RAW_MATERIAL" });
    await items.addOpeningStock({ itemId: item.id, quantity: 10, unitCost: 2 });

    await expect(
      items.setStockValues([{ itemId: item.id, quantityOnHand: 4, unitCost: 2 }]),
    ).rejects.toBeInstanceOf(ValidationError);

    const listed = await items.list();
    expect(listed.find((row) => row.id === item.id)?.current_stock).toBe(10);
  });

  it("rejects a request where every row already matches stock", async () => {
    const item = await items.create({ itemName: "Already Right", itemType: "RAW_MATERIAL" });
    await items.addOpeningStock({ itemId: item.id, quantity: 3, unitCost: 1 });

    await expect(
      items.setStockValues([{ itemId: item.id, quantityOnHand: 3, unitCost: 1 }]),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("ItemService.reverseStockValues", () => {
  it("lists a saved correction and undoes it, restoring stock and the ledger", async () => {
    const item = await items.create({ itemName: "Undo Raw", itemType: "RAW_MATERIAL" });
    await insertRow(ctx.db, "stock_batches", {
      item_id: item.id,
      warehouse_id: 1,
      batch_number: "NEG-U",
      purchase_price: 0,
      raw_unit_cost: 0,
      packing_unit_cost: 0,
      quantity_in_stock: -4,
      received_date: "2026-01-01",
      is_active: 1,
    });

    const saved = await items.setStockValues(
      [{ itemId: item.id, quantityOnHand: 6, unitCost: 3 }],
      "2026-11-01",
    );
    expect(saved.entryId).toBeGreaterThan(0);

    const listed = await items.listStockValues();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      id: saved.entryId,
      entry_date: "2026-11-01",
      total_value: 30,
      reversed_at: null,
    });
    expect(listed[0].lines[0]).toMatchObject({
      item_id: item.id,
      quantity: 10,
      quantity_on_hand: 6,
      unit_cost: 3,
    });

    await items.reverseStockValues(saved.entryId);

    const after = await items.list();
    expect(after.find((row) => row.id === item.id)?.current_stock).toBe(-4);
    expect((await items.listStockValues())[0].reversed_at).not.toBeNull();

    // The posting and its reversal net to zero on the inventory account.
    const inventory = await accountId(ctx.db, "1200");
    const net = await ctx.db.get<{ debit: number; credit: number }>(
      `SELECT COALESCE(SUM(debit), 0) AS debit, COALESCE(SUM(credit), 0) AS credit
         FROM journal_entry_lines WHERE account_id = ?`,
      [inventory],
    );
    expect(Number(net?.debit)).toBe(Number(net?.credit));

    await expect(items.reverseStockValues(saved.entryId)).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses to undo once the added stock has been used", async () => {
    const item = await items.create({ itemName: "Used Raw", itemType: "RAW_MATERIAL" });
    await insertRow(ctx.db, "stock_batches", {
      item_id: item.id,
      warehouse_id: 1,
      batch_number: "NEG-X",
      purchase_price: 0,
      raw_unit_cost: 0,
      packing_unit_cost: 0,
      quantity_in_stock: -2,
      received_date: "2026-01-01",
      is_active: 1,
    });
    const saved = await items.setStockValues([{ itemId: item.id, quantityOnHand: 5, unitCost: 2 }]);

    const batch = await ctx.db.get<{ id: number }>(
      "SELECT id FROM stock_batches WHERE item_id = ? AND batch_number LIKE 'STK-%' LIMIT 1",
      [item.id],
    );
    await ctx.db.run(
      "UPDATE stock_batches SET quantity_in_stock = quantity_in_stock - 1 WHERE id = ?",
      [batch!.id],
    );

    await expect(items.reverseStockValues(saved.entryId)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("ItemService.consumptionHistory", () => {
  it("lists production and packing runs that consumed the item, oldest first", async () => {
    const raw = await items.create({ itemName: "Consumed Raw", itemType: "RAW_MATERIAL" });
    await items.addOpeningStock({ itemId: raw.id, quantity: 100, unitCost: 1 });
    const batch = await ctx.db.get<{ id: number }>(
      "SELECT id FROM stock_batches WHERE item_id = ? LIMIT 1",
      [raw.id],
    );
    const fg = await items.create({ itemName: "Output FG", itemType: "FINISHED_GOOD" });
    const bomId = await insertRow(ctx.db, "bill_of_materials", {
      company_id: 1,
      finished_item_id: fg.id,
      bom_name: "Consumption BOM",
    });

    const later = await insertRow(ctx.db, "production_orders", {
      company_id: 1,
      warehouse_id: 1,
      order_number: "PO-LATER",
      bom_id: bomId,
      planned_quantity: 1,
      manufacturing_date: "2026-06-02",
    });
    await insertRow(ctx.db, "production_consumption", {
      production_order_id: later,
      component_item_id: raw.id,
      batch_id: batch!.id,
      quantity_consumed: 2,
    });

    const earlier = await insertRow(ctx.db, "packing_orders", {
      company_id: 1,
      warehouse_id: 1,
      order_number: "PCO-EARLIER",
      bom_id: bomId,
      planned_quantity: 1,
      manufacturing_date: "2026-05-01",
    });
    await insertRow(ctx.db, "packing_consumption", {
      packing_order_id: earlier,
      component_item_id: raw.id,
      batch_id: batch!.id,
      quantity_consumed: 5,
    });

    const forItem = (await items.consumptionHistory()).filter((row) => row.item_id === raw.id);
    expect(forItem.map((row) => row.order_number)).toEqual(["PCO-EARLIER", "PO-LATER"]);
    expect(forItem[0]).toMatchObject({
      kind: "PACKING",
      manufacturing_date: "2026-05-01",
      quantity_consumed: 5,
    });
    expect(forItem[1]).toMatchObject({
      kind: "PRODUCTION",
      manufacturing_date: "2026-06-02",
      quantity_consumed: 2,
    });
  });
});
