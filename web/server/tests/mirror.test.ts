import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ObservedDatabase } from "../src/db/observed.js";
import { MirrorService } from "../src/services/mirrorService.js";
import { closeDb, freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let dir: string;

beforeEach(async () => {
  ctx = await freshDb();
  dir = mkdtempSync(path.join(tmpdir(), "bop-mirror-"));
});
afterEach(async () => {
  await closeDb(ctx.db);
  rmSync(dir, { recursive: true, force: true });
});

describe("MirrorService", () => {
  it("writes a portable copy, pushes it to the computer folder, and refreshes it", async () => {
    // "sqlitecloud" exercises the logical dump path against the local adapter.
    const mirror = new MirrorService(
      ctx.db,
      "sqlitecloud",
      path.join(dir, "live"),
      path.join(dir, "pc"),
      0,
    );

    await mirror.start();
    const first = await mirror.status();
    expect(first.exists).toBe(true);
    expect(first.bytes).toBeGreaterThan(0);
    expect(first.pcError).toBeNull();
    expect(existsSync(path.join(dir, "pc", "erp_mirror.db"))).toBe(true);

    await ctx.db.run(
      "INSERT INTO accounts (company_id, account_code, account_name, account_type) VALUES (?, ?, ?, ?)",
      [1, "9999", "Mirror test account", "ASSET"],
    );
    await mirror.runNow();

    const snapshot = new DatabaseSync(first.path);
    try {
      const row = snapshot
        .prepare("SELECT COUNT(*) AS n FROM accounts WHERE account_code = ?")
        .get("9999") as { n: number };
      expect(Number(row.n)).toBe(1);
    } finally {
      snapshot.close();
    }

    const second = await mirror.status();
    expect(second.lastError).toBeNull();
    expect(second.pcUpdatedAt).not.toBeNull();
  });

  it("does not let the mirror trigger itself through VACUUM INTO", async () => {
    let writes = 0;
    const observed = new ObservedDatabase(ctx.db, () => {
      writes += 1;
    });

    await observed.run("UPDATE accounts SET is_active = 1 WHERE id = 1");
    expect(writes).toBe(1);

    await observed.exec(`VACUUM INTO '${path.join(dir, "ignored.db").replace(/'/g, "''")}'`);
    expect(writes).toBe(1);
  });
});
