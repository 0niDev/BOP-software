/**
 * Opt-in integration test for the hosted **SQLite Cloud** adapter.
 *
 * Every other test exercises the local `node:sqlite` adapter; the real
 * `@sqlitecloud/drivers` code path (parameter binding, how rows and numbers come
 * back, the serialized async transaction lock, error mapping) is only touched
 * here. It needs credentials, so it is **skipped unless both** `SQLITE_CLOUD_URL`
 * is set **and** `ERP_CLOUD_TEST=1` — the explicit flag matters because the
 * repository's `.env` may hold the *production* URL, and this test must never be
 * run against production by accident. Point it at a scratch database:
 *
 *   SQLITE_CLOUD_URL='sqlitecloud://user:pass@host:port/scratch' ERP_CLOUD_TEST=1 \
 *     npx vitest run --root server tests/sqliteCloud.test.ts
 *
 * Every statement below is read-only (SELECT only), so the test cannot modify the
 * database it is pointed at.
 */
import { afterAll, describe, expect, it } from "vitest";
import { DatabaseError } from "../src/domain/errors.js";
import { SqliteCloudDatabase } from "../src/db/sqliteCloud.js";

const url = process.env.SQLITE_CLOUD_URL ?? "";
const enabled = process.env.ERP_CLOUD_TEST === "1" && url.length > 0;

const cloud = enabled ? new SqliteCloudDatabase(url) : null;

afterAll(async () => {
  await cloud?.close();
});

describe.skipIf(!enabled)("SqliteCloudDatabase (opt-in, read-only)", () => {
  it("connects and binds parameters", async () => {
    const row = await cloud!.get<{ one: number; bound: string }>(
      "SELECT 1 AS one, ? AS bound",
      ["hello"],
    );
    expect(Number(row?.one)).toBe(1);
    expect(row?.bound).toBe("hello");
  });

  it("returns rows as objects and reports the server's SQLite version", async () => {
    const totals = await cloud!.all<{ tables: number }>(
      "SELECT COUNT(*) AS tables FROM sqlite_master WHERE type = 'table'",
    );
    expect(Number.isInteger(Number(totals[0]?.tables))).toBe(true);

    const version = await cloud!.get<{ version: string }>("SELECT sqlite_version() AS version");
    expect(String(version?.version)).toMatch(/^\d+\.\d+/);
  });

  it("serialises concurrent statements without mixing up parameters", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        cloud!.get<{ n: number }>("SELECT ? AS n", [index]),
      ),
    );
    expect(results.map((row) => Number(row?.n))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("runs a transaction (with a nested one) and commits", async () => {
    const result = await cloud!.transaction(async (tx) => {
      const outer = await tx.get<{ n: number }>("SELECT ? AS n", [1]);
      const inner = await cloud!.transaction(async (nested) => {
        const row = await nested.get<{ n: number }>("SELECT ? AS n", [2]);
        return Number(row?.n ?? 0);
      });
      return Number(outer?.n ?? 0) + inner;
    });
    expect(result).toBe(3);
  });

  it("surfaces a driver failure as a DatabaseError", async () => {
    await expect(
      cloud!.all("SELECT * FROM table_that_does_not_exist_9f2c"),
    ).rejects.toBeInstanceOf(DatabaseError);
  });
});
