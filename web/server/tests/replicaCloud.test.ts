/**
 * Opt-in integration test for the cloud **replica push** path.
 *
 * Validates against a real SQLite Cloud server what the unit tests cannot:
 * the largest `exec` message the server accepts, transactions spanning
 * separate `exec` calls, and a full `buildPushPlan` round trip (fresh
 * connection, chunk by chunk, one-statement count verification).
 *
 * It runs **only** against the scratch database in
 * `SQLITE_CLOUD_TESTDB_URL` (never `SQLITE_CLOUD_URL`) and only touches
 * `replica_probe_*` tables, which it drops afterwards:
 *
 *   ERP_CLOUD_TEST=1 \
 *   SQLITE_CLOUD_TESTDB_URL='sqlitecloud://…/testdb' \
 *     npx vitest run --root server tests/replicaCloud.test.ts
 */
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Database } from "@sqlitecloud/drivers";
import type { Row, SqlValue } from "../src/db/types.js";
import {
  buildCountQuery,
  buildPushPlan,
  type PushPlan,
  type SchemaEntry,
} from "../src/services/replicaScript.js";

const url = process.env.SQLITE_CLOUD_TESTDB_URL ?? "";
const enabled = process.env.ERP_CLOUD_TEST === "1" && url.length > 0;

const PAD = "replica_probe_pad";
const A = "replica_probe_a";
const B = "replica_probe_b";

let cloud: Database | null = null;

function execOn(db: Database, statement: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(statement, (err) => (err ? reject(err) : resolve()));
  });
}

function sqlOn(db: Database, query: string): Promise<unknown> {
  return db.sql({ query, parameters: [] });
}

async function close(db: Database): Promise<void> {
  await new Promise<void>((resolve) => db.close(() => resolve()));
}

/** Same snapshot + plan the ReplicaService builds, on a throwaway source. */
function planFromSource(): PushPlan {
  const source = new DatabaseSync(":memory:");
  source.exec(`
    CREATE TABLE ${A} (id INTEGER PRIMARY KEY, name TEXT, blob BLOB);
    CREATE TABLE ${B} (id INTEGER PRIMARY KEY, a_id INTEGER REFERENCES ${A}(id), note);
    CREATE INDEX b_a ON ${B}(a_id);
    INSERT INTO ${A} (id, name, blob) VALUES
      (1, 'it''s 📦 "quoted"', X'deadd0'),
      (2, NULL, NULL);
    INSERT INTO ${B} (id, a_id, note) VALUES (10, 1, 'multi
line'), (11, 2, NULL);
  `);
  const schema = source
    .prepare(
      "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'",
    )
    .all() as unknown as SchemaEntry[];
  const tables = schema.filter((e) => e.type === "table").map((e) => e.name);
  const fkDeps: Record<string, string[]> = {};
  for (const table of tables) {
    const refs = source
      .prepare(`PRAGMA foreign_key_list("${table.replace(/"/g, '""')}")`)
      .all() as Array<{ table: string }>;
    fkDeps[table] = [...new Set(refs.map((fk) => fk.table))];
  }
  const data: Record<string, Row[]> = {};
  for (const entry of schema.filter((e) => e.type === "table")) {
    data[entry.name] = source.prepare(`SELECT * FROM "${entry.name}"`).all() as Row[];
  }
  const plan = buildPushPlan(schema, data, fkDeps);
  source.close();
  return plan;
}

beforeAll(async () => {
  if (!enabled) return;
  cloud = new Database(url);
  for (const table of [B, A, PAD]) { // children first: FKs are enforced
    await execOn(cloud, `DROP TABLE IF EXISTS "${table}"`);
  }
});

afterAll(async () => {
  if (!cloud) return;
  try {
    for (const table of [B, A, PAD]) {
      await execOn(cloud, `DROP TABLE IF EXISTS "${table}"`);
    }
  } finally {
    await close(cloud);
  }
});

describe.skipIf(!enabled)("Replica push against SQLite Cloud (testdb only)", () => {
  it(
    "accepts exec messages of at least one chunk (512 KB) and reports the real limit",
    async () => {
      await execOn(cloud!, `CREATE TABLE "${PAD}" (v TEXT)`);
      for (const size of [512 * 1024, 1024 * 1024, 2 * 1024 * 1024]) {
        const payload = "x".repeat(size);
        try {
          await execOn(cloud!, `INSERT INTO "${PAD}" VALUES ('${payload}')`);
          console.log(`[replicaCloud] exec of ~${Math.round(size / 1024)} KB: ok`);
        } catch (err) {
          console.log(
            `[replicaCloud] exec of ~${Math.round(size / 1024)} KB: REJECTED (${(err as Error).message.slice(0, 120)})`,
          );
          if (size <= 512 * 1024) throw err; // below our chunk target must work
        }
      }
      await execOn(cloud!, `DELETE FROM "${PAD}"`);
    },
    120_000,
  );

  it("keeps a transaction open across separate exec calls, and rolls it back", async () => {
    // BEGIN + schema + first write in one call, second write in the next.
    await execOn(
      cloud!,
      `BEGIN;\nCREATE TABLE "${A}" (id INTEGER PRIMARY KEY, name TEXT);\nINSERT INTO "${A}" VALUES (1, 'one');\n`,
    );
    await execOn(cloud!, `INSERT INTO "${A}" VALUES (2, 'two');`);
    const during = (await sqlOn(cloud!, `SELECT COUNT(*) AS n FROM "${A}"`)) as Row[];
    expect(Number((during[0] as { n: number }).n)).toBe(2);
    await execOn(cloud!, "COMMIT;");
    const committed = (await sqlOn(cloud!, `SELECT COUNT(*) AS n FROM "${A}"`)) as Row[];
    expect(Number((committed[0] as { n: number }).n)).toBe(2);

    // Rollback discards the third write.
    await execOn(cloud!, "BEGIN;");
    await execOn(cloud!, `INSERT INTO "${A}" VALUES (3, 'three');`);
    await execOn(cloud!, "ROLLBACK;");
    const after = (await sqlOn(cloud!, `SELECT COUNT(*) AS n FROM "${A}"`)) as Row[];
    expect(Number((after[0] as { n: number }).n)).toBe(2);
  }, 60_000);

  it("pushes a full plan and overwrites a manual edit on the next push", async () => {
    const plan = planFromSource();
    expect(plan.rows).toBe(4);

    const push = async (): Promise<void> => {
      const target = new Database(url); // fresh connection, like every push
      try {
        for (const chunk of plan.chunks) await execOn(target, chunk);
        const rows = (await sqlOn(target, buildCountQuery([A, B]))) as Row[];
        const actual = rows[0] as Record<string, number>;
        expect(Number(actual[A])).toBe(2);
        expect(Number(actual[B])).toBe(2);
      } finally {
        await close(target);
      }
    };

    await push();

    // A manual edit "in the dashboard" is wiped by the next push.
    await execOn(cloud!, `DELETE FROM "${B}"`);
    await push();
    const notes = (await sqlOn(cloud!, `SELECT name FROM "${A}" ORDER BY id`)) as Row[];
    expect(notes.map((r) => (r as { name: string }).name)).toEqual(['it\'s 📦 "quoted"', null]);
  }, 120_000);
});
