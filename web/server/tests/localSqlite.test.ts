import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalSqliteDatabase } from "../src/db/localSqlite.js";

let dir: string;
let db: LocalSqliteDatabase;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "bop-localdb-"));
  db = new LocalSqliteDatabase(path.join(dir, "t.sqlite"));
  // Minimal schema for the isolation tests.
  void db;
});
afterEach(() => {
  void db?.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("LocalSqliteDatabase", () => {
  it("runs in WAL mode on a file database", async () => {
    const row = await db.get<{ journal_mode: string }>("PRAGMA journal_mode");
    expect(String(row?.journal_mode).toLowerCase()).toBe("wal");
  });

  it("never shows one transaction's uncommitted writes to a concurrent reader", async () => {
    await db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)");
    let reader: Promise<Array<{ n: number }>> | null = null;
    // Scheduled before the transaction starts, so its callback runs with no
    // transaction context: a genuine concurrent request that must queue
    // behind the open transaction and only execute once it has settled.
    const timer = setTimeout(() => {
      reader = db.all<{ n: number }>("SELECT COUNT(*) AS n FROM t WHERE v = 'uncommitted'");
    }, 15);
    timer.unref?.();

    await expect(
      db.transaction(async () => {
        await db.run("INSERT INTO t (v) VALUES ('uncommitted')");
        // Keep the transaction open past t=15 so the reader queues behind it.
        await new Promise((r) => setTimeout(r, 50));
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");

    const rows = (await reader) as Array<{ n: number }>;
    // The reader ran after the rollback: it must not have seen the write…
    expect(rows[0]?.n).toBe(0);
    // …and the rollback is real.
    expect((await db.all<{ n: number }>("SELECT COUNT(*) AS n FROM t"))[0]?.n).toBe(0);
  });

  it("keeps two concurrent transactions from merging", async () => {
    await db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)");
    const first = db.transaction(async () => {
      await db.run("INSERT INTO t (v) VALUES ('first')");
      // Give the second transaction time to start while the first is open.
      await new Promise((r) => setTimeout(r, 25));
      throw new Error("first rolls back");
    });

    const second = db.transaction(async () => {
      await db.run("INSERT INTO t (v) VALUES ('second')");
      return "committed";
    });

    await expect(first).rejects.toThrow("first rolls back");
    await expect(second).resolves.toBe("committed");

    const rows = await db.all<{ v: string }>("SELECT v FROM t ORDER BY id");
    expect(rows.map((r) => r.v)).toEqual(["second"]);
  });

  it("commits a nested transaction as part of the outer one", async () => {
    await db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)");
    await expect(
      db.transaction(async () => {
        await db.run("INSERT INTO t (v) VALUES ('outer')");
        await db.transaction(async () => {
          await db.run("INSERT INTO t (v) VALUES ('inner')");
        });
        return "ok";
      }),
    ).resolves.toBe("ok");
    expect((await db.all<{ n: number }>("SELECT COUNT(*) AS n FROM t"))[0]?.n).toBe(2);
  });
});
