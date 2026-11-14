import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NotFoundError } from "../src/domain/errors.js";
import { insertRow } from "../src/repositories/base.js";
import { ItemService } from "../src/services/itemService.js";
import { closeDb, freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let items: ItemService;

beforeEach(async () => {
  ctx = await freshDb();
  items = new ItemService(ctx.db);
});
afterEach(async () => {
  await closeDb(ctx.db);
});

describe("ItemService.setPrices", () => {
  it("sets purchase prices on many items in one call", async () => {
    const first = await items.create({ itemName: "Raw A", itemType: "RAW_MATERIAL" });
    const second = await items.create({ itemName: "Pack B", itemType: "PACKING_MATERIAL" });

    const result = await items.setPrices([
      { id: first.id, purchasePrice: 12.5 },
      { id: second.id, purchasePrice: 3 },
    ]);
    expect(result).toEqual({ updated: 2 });

    const listed = await items.list();
    expect(listed.find((row) => row.id === first.id)?.purchase_price).toBe(12.5);
    expect(listed.find((row) => row.id === second.id)?.purchase_price).toBe(3);
  });

  it("rejects an unknown item id and updates nothing", async () => {
    const item = await items.create({ itemName: "Raw A", itemType: "RAW_MATERIAL" });

    await expect(
      items.setPrices([
        { id: item.id, purchasePrice: 5 },
        { id: 999_999, purchasePrice: 1 },
      ]),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect((await items.get(item.id)).purchase_price).toBe(0);
  });
});

describe("ItemService.list unpriced", () => {
  it("lists only raw/packing items with no cost that are used (BOM or opening)", async () => {
    const rawUsed = await items.create({ itemName: "Raw Used", itemType: "RAW_MATERIAL" });
    const rawUnused = await items.create({ itemName: "Raw Unused", itemType: "RAW_MATERIAL" });
    const fg = await items.create({ itemName: "FG Component", itemType: "FINISHED_GOOD" });
    const rawOpening = await items.create({ itemName: "Raw Opening", itemType: "RAW_MATERIAL" });

    // A BOM consuming rawUsed (included) and fg (finished good, excluded).
    const bomId = await insertRow(ctx.db, "bill_of_materials", {
      company_id: 1,
      finished_item_id: fg.id,
      bom_name: "Test BOM",
    });
    await insertRow(ctx.db, "bom_components", {
      bom_id: bomId,
      component_item_id: rawUsed.id,
      quantity_required: 1,
    });
    await insertRow(ctx.db, "bom_components", {
      bom_id: bomId,
      component_item_id: fg.id,
      quantity_required: 1,
    });
    // Opening stock makes rawOpening "used" too.
    await items.addOpeningStock({ itemId: rawOpening.id, quantity: 10 });

    const listed = await items.list({ unpricedOnly: true });
    const ids = listed.map((row) => row.id).sort((a, b) => a - b);
    expect(ids).toEqual([rawUsed.id, rawOpening.id].sort((a, b) => a - b));
  });
});
