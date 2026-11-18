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
