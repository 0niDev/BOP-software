import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NotFoundError, ValidationError } from "../src/domain/errors.js";
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

describe("ItemService tags", () => {
  it("creates tags and rejects blank or duplicate names (case-insensitive)", async () => {
    const tag = await items.createTag("  bottle  ");
    expect(tag.name).toBe("bottle");

    await expect(items.createTag("   ")).rejects.toBeInstanceOf(ValidationError);
    await expect(items.createTag("Bottle")).rejects.toBeInstanceOf(ValidationError);
    expect((await items.listTags()).tags).toHaveLength(1);
  });

  it("assigns a tag to many items, idempotently, and lists it on the item row", async () => {
    const tag = await items.createTag("bottle");
    const first = await items.create({ itemName: "Bottle 30ml" });
    const second = await items.create({ itemName: "Bottle 60ml" });

    expect(await items.setTagItems(tag.id, { add: [first.id, second.id] })).toEqual({
      added: 2,
      removed: 0,
    });
    expect(await items.setTagItems(tag.id, { add: [first.id] })).toEqual({
      added: 0,
      removed: 0,
    });

    const links = (await items.listTags()).links;
    expect(links).toHaveLength(2);

    const listed = await items.list();
    expect(listed.find((item) => item.id === first.id)?.tags).toBe("bottle");
    expect(listed.find((item) => item.id === second.id)?.tags).toBe("bottle");
  });

  it("removes a tag from items and keeps other tags intact", async () => {
    const bottle = await items.createTag("bottle");
    const cap = await items.createTag("cap");
    const item = await items.create({ itemName: "Bottle + cap" });
    await items.setTagItems(bottle.id, { add: [item.id] });
    await items.setTagItems(cap.id, { add: [item.id] });

    expect(await items.setTagItems(bottle.id, { remove: [item.id] })).toEqual({
      added: 0,
      removed: 1,
    });
    const listed = (await items.list()).find((row) => row.id === item.id);
    expect(listed?.tags).toBe("cap");
  });

  it("rejects an unknown tag or item", async () => {
    const tag = await items.createTag("bottle");
    await expect(items.setTagItems(999_999, { add: [1] })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(items.setTagItems(tag.id, { add: [999_999] })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
