import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NotFoundError, ValidationError } from "../src/domain/errors.js";
import { ItemService } from "../src/services/itemService.js";
import { StockLedgerService } from "../src/services/stockLedgerService.js";
import { closeDb, freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let items: ItemService;
let ledger: StockLedgerService;

beforeEach(async () => {
  ctx = await freshDb();
  items = new ItemService(ctx.db);
  ledger = new StockLedgerService(ctx.db);
});
afterEach(async () => {
  await closeDb(ctx.db);
});

/** Every batch quantity, keyed by batch id, so a restore can be compared exactly. */
async function quantities(): Promise<Map<number, number>> {
  const rows = await ctx.db.all<{ id: number; quantity_in_stock: number }>(
    "SELECT id, quantity_in_stock FROM stock_batches ORDER BY id",
  );
  return new Map(rows.map((row) => [row.id, Number(row.quantity_in_stock)]));
}

describe("StockLedgerService", () => {
  it("zeroes every batch, records what it removed, and restores it exactly", async () => {
    const item = await items.create({ itemName: "Warehouse item" });
    await items.addOpeningStock({ itemId: item.id, quantity: 12, unitCost: 5 });
    await items.addOpeningStock({
      itemId: item.id,
      quantity: 3,
      unitCost: 7,
      batchNumber: "SECOND",
    });

    const before = await quantities();
    const liveBatches = [...before.values()].filter((qty) => qty !== 0).length;
    expect(liveBatches).toBeGreaterThanOrEqual(2);

    const reset = await ledger.zero({ reason: "  31 Oct count  ", snapshotFile: "fix_1.db" });
    expect(reset.batchCount).toBe(liveBatches);
    expect(reset.snapshotFile).toBe("fix_1.db");
    expect(reset.totalValue).toBeGreaterThan(0);
    expect([...(await quantities()).values()].every((qty) => qty === 0)).toBe(true);

    const history = await ledger.list();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      reason: "31 Oct count",
      batch_count: liveBatches,
      snapshot_file: "fix_1.db",
      restored_at: null,
    });

    const restored = await ledger.restore(reset.resetId);
    expect(restored.batchCount).toBe(liveBatches);
    expect(restored.restoredAt).not.toBe("");
    expect(await quantities()).toEqual(before);

    const afterRestore = await ledger.list();
    expect(afterRestore[0].restored_at).not.toBeNull();
  });

  it("refuses a second zero when every batch is already zero", async () => {
    await ledger.zero({ reason: "first" });
    await expect(ledger.zero({ reason: "second" })).rejects.toBeInstanceOf(ValidationError);
    expect(await ledger.list()).toHaveLength(1);
  });

  it("refuses to restore the same reset twice or an unknown one", async () => {
    const reset = await ledger.zero();
    await ledger.restore(reset.resetId);
    await expect(ledger.restore(reset.resetId)).rejects.toBeInstanceOf(ValidationError);
    await expect(ledger.restore(999_999)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("works without a snapshot file (the route owns the backup service)", async () => {
    const reset = await ledger.zero();
    expect(reset.snapshotFile).toBeNull();
    expect((await ledger.list())[0].snapshot_file).toBeNull();
  });
});
