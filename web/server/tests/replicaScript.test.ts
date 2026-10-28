import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildCountQuery,
  buildPushPlan,
  sqlLiteral,
  topoTables,
  type PushPlan,
  type SchemaEntry,
} from "../src/services/replicaScript.js";

const SCHEMA_SQL =
  "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'";

type Row = Record<string, unknown>;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "bop-replica-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Read a database the same way ReplicaService.readPlan does. */
function snapshot(file: string): {
  schema: SchemaEntry[];
  data: Record<string, Row[]>;
  tables: string[];
} {
  const local = new DatabaseSync(file);
  try {
    const schema = local.prepare(SCHEMA_SQL).all() as unknown as SchemaEntry[];
    const tables = schema.filter((e) => e.type === "table").map((e) => e.name);
    const data: Record<string, Row[]> = {};
    for (const table of tables) {
      data[table] = local.prepare(`SELECT * FROM "${table}"`).all() as Row[];
    }
    return { schema, data, tables };
  } finally {
    local.close();
  }
}

/** Execute a plan against a target database, chunk by chunk, like the push does. */
function apply(plan: PushPlan, file: string): void {
  const target = new DatabaseSync(file);
  try {
    for (const chunk of plan.chunks) target.exec(chunk);
  } finally {
    target.close();
  }
}

function counts(file: string, tables: string[]): Record<string, number> {
  const db = new DatabaseSync(file);
  try {
    const row = db.prepare(buildCountQuery(tables)).get() as Row;
    return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)]));
  } finally {
    db.close();
  }
}

describe("sqlLiteral", () => {
  it("formats every value type SQLite stores", () => {
    expect(sqlLiteral(null)).toBe("NULL");
    expect(sqlLiteral(undefined)).toBe("NULL");
    expect(sqlLiteral(0)).toBe("0");
    expect(sqlLiteral(-1.5)).toBe("-1.5");
    expect(sqlLiteral(9007199254740993n)).toBe("9007199254740993");
    expect(sqlLiteral(true)).toBe("1");
    expect(sqlLiteral(false)).toBe("0");
    expect(sqlLiteral("it's")).toBe("'it''s'");
    expect(sqlLiteral(new Uint8Array([1, 15, 255]))).toBe("X'010fff'");
  });

  it("refuses values it cannot encode losslessly", () => {
    expect(() => sqlLiteral(Number.NaN)).toThrow();
    expect(() => sqlLiteral(Infinity)).toThrow();
    expect(() => sqlLiteral(2n ** 63n)).toThrow();
    expect(() => sqlLiteral("a\u0000b")).toThrow();
    expect(() => sqlLiteral({ a: 1 })).toThrow();
  });
});

describe("buildPushPlan", () => {
  it("refuses data without a schema entry", () => {
    const schema: SchemaEntry[] = [
      { type: "table", name: "t", sql: "CREATE TABLE t (v TEXT)" },
    ];
    expect(() => buildPushPlan([], { t: [{ v: "x" }] })).toThrow(/no schema entry/);
    expect(() => buildPushPlan(schema, { t: [{ v: "a\u0000b" }], stray: [{ v: 1 }] })).toThrow(
      /no schema entry/,
    );
    // NUL inside a properly declared table still refuses to encode.
    expect(() => buildPushPlan(schema, { t: [{ v: "a\u0000b" }] })).toThrow(/NUL/);
  });

  it("orders parents before children when the source schema does not", () => {
    // The cloud server enforces FKs on every statement, so even though the
    // source created/inserted the child first, the plan must not.
    const schema: SchemaEntry[] = [
      {
        type: "table",
        name: "child",
        sql: "CREATE TABLE child (id INTEGER PRIMARY KEY, p_id INTEGER REFERENCES parent(id))",
      },
      { type: "table", name: "parent", sql: "CREATE TABLE parent (id INTEGER PRIMARY KEY)" },
    ];
    const plan = buildPushPlan(
      schema,
      { child: [{ id: 1, p_id: 5 }], parent: [{ id: 5 }] },
      { child: ["parent"] },
    );
    const script = plan.chunks.join("\n");
    expect(script.indexOf('INSERT INTO "parent"')).toBeLessThan(
      script.indexOf('INSERT INTO "child"'),
    );
    expect(script.indexOf('DROP TABLE IF EXISTS "child"')).toBeLessThan(
      script.indexOf('DROP TABLE IF EXISTS "parent"'),
    );

    const target = path.join(dir, "topo.sqlite");
    apply(plan, target);
    expect(counts(target, ["child", "parent"])).toEqual({ child: 1, parent: 1 });
  });

  it("refuses circular foreign keys", () => {
    expect(() => topoTables(["a", "b"], { a: ["b"], b: ["a"] })).toThrow(/Circular/);
  });

  it("rebuilds the source database exactly, and repushing stays idempotent", () => {
    const source = path.join(dir, "source.sqlite");
    const seed = new DatabaseSync(source);
    seed.exec(`
      CREATE TABLE parent (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id), note);
      CREATE INDEX child_parent ON child(parent_id);
      CREATE VIEW child_notes AS SELECT note FROM child WHERE note IS NOT NULL;
      CREATE TABLE empty (x INTEGER);
      INSERT INTO parent (id, name) VALUES (1, 'it''s'), (2, 'emoji 📦 "quoted"');
      INSERT INTO child (id, parent_id, note) VALUES (10, 1, NULL), (11, 2, 'multi
line'), (12, 1, X'00ff');
    `);
    seed.close();

    const { schema, data, tables } = snapshot(source);
    const plan = buildPushPlan(schema, data);
    expect(plan.rows).toBe(5);
    expect(plan.tables).toBe(3);
    expect(plan.chunks[0]).toContain("BEGIN;");
    expect(plan.chunks.at(-1)).toContain("COMMIT;");

    const target = path.join(dir, "target.sqlite");
    apply(plan, target);
    expect(counts(target, tables)).toEqual({ parent: 2, child: 3, empty: 0 });

    // Values survive the literal encoding, and the index/view came along.
    const round = new DatabaseSync(target);
    const names = round.prepare("SELECT name FROM parent ORDER BY id").all().map((r) => r.name);
    expect(names).toEqual(["it's", 'emoji 📦 "quoted"']);
    expect(Number(round.prepare("SELECT COUNT(*) AS n FROM child_notes").get()!.n)).toBe(2);
    round.close();

    // A manual edit "in the dashboard" is overwritten by the next push.
    const meddle = new DatabaseSync(target);
    meddle.exec("DELETE FROM child WHERE id = 10");
    meddle.close();
    apply(plan, target);
    expect(counts(target, tables)).toEqual({ parent: 2, child: 3, empty: 0 });
  });

  it("splits large plans into chunks that still form one transaction", () => {
    const source = path.join(dir, "big.sqlite");
    const seed = new DatabaseSync(source);
    seed.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)");
    const insert = seed.prepare("INSERT INTO t (v) VALUES (?)");
    for (let i = 0; i < 40; i += 1) insert.run(`value-${i}-${"x".repeat(50)}`);
    seed.close();

    const { schema, data, tables } = snapshot(source);
    const plan = buildPushPlan(schema, data, undefined, 400);
    expect(plan.chunks.length).toBeGreaterThan(1);
    expect(plan.chunks[0]).toContain("BEGIN;");
    expect(plan.chunks.at(-1)).toContain("COMMIT;");

    const target = path.join(dir, "big-target.sqlite");
    apply(plan, target);
    expect(counts(target, tables)).toEqual({ t: 40 });
  });

  it("counts every table in one statement", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(
      'CREATE TABLE "weird ""name""" (id INTEGER); CREATE TABLE plain (id INTEGER); ' +
        "INSERT INTO plain VALUES (1),(2)",
    );
    const row = db.prepare(buildCountQuery(['weird "name"', "plain"])).get() as Row;
    expect(row).toEqual({ 'weird "name"': 0, plain: 2 });
    db.close();
  });
});
