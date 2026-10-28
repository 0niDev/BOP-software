/**
 * SQL generation for the cloud replica push: the local database is the source
 * of truth, so the replica is *replaced wholesale*, not patched row by row.
 *
 * The plan is one transaction (`BEGIN … COMMIT`) that drops and recreates
 * every schema object, then re-inserts the local snapshot, topologically
 * ordered so **every statement is FK-valid on its own**: SQLite Cloud pins
 * `foreign_keys=ON` and ignores `defer_foreign_keys`/`foreign_keys=OFF`
 * (measured on the real server), so nothing may rely on deferred checks.
 * Because the whole thing is atomic, a push that dies halfway leaves the
 * previous good copy — a failed or interrupted sync can never half-apply.
 *
 * `exec`-style scripts carry no parameters, so values are inlined as SQL
 * literals here. `sqlLiteral` is the only place that ever formats a value.
 */
export interface SchemaEntry {
  type: string;
  name: string;
  sql: string;
}

export interface PushPlan {
  /** Complete SQL statements, sent in order. The first opens, the last commits. */
  chunks: string[];
  /** Total script size in bytes (approximate transfer volume). */
  bytes: number;
  /** Rows re-inserted. */
  rows: number;
  tables: number;
  /** Expected row count per table, used to verify the push landed. */
  counts: Record<string, number>;
}

/** Statement batch target; the whole script stays one transaction regardless. */
const MAX_CHUNK_BYTES = 512 * 1024;
/** Rows per INSERT statement; keeps individual statements comfortably small. */
const ROWS_PER_INSERT = 500;

export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Format one value as a SQL literal. Numbers and text are the realistic
 * payloads of this app; blobs become hex literals; anything else is refused
 * rather than silently coerced. Text containing NUL is refused because a SQL
 * string literal cannot carry it.
 */
export function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Refusing non-finite number: ${value}`);
    return String(value);
  }
  if (typeof value === "bigint") {
    const min = -(2n ** 63n);
    const max = 2n ** 63n - 1n;
    if (value < min || value > max) throw new Error(`Refusing out-of-range bigint: ${value}`);
    return String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "string") {
    if (value.includes("\0")) throw new Error("Refusing text containing NUL.");
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (value instanceof Uint8Array) {
    return `X'${Array.from(value, (b) => b.toString(16).padStart(2, "0")).join("")}'`;
  }
  throw new Error(
    `Refusing unsupported value type in replica script: ${Object.prototype.toString.call(value)}`,
  );
}

/** `CREATE TABLE "x" …` → `CREATE TABLE IF NOT EXISTS "x" …` (same for the rest). */
function withIfNotExists(sql: string): string {
  return sql.replace(
    /^(CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX|TRIGGER|VIEW)\s+)/i,
    "$1IF NOT EXISTS ",
  );
}

/** Table → tables it declares foreign keys to (self-references excluded). */
export type FkDeps = Record<string, string[]>;

/**
 * Order tables so every referenced table comes first (Kahn). SQLite Cloud
 * enforces FKs immediately, so inserts (and drops, reversed) must follow this
 * order. A cycle cannot be loaded statement-by-statement and fails loudly.
 */
export function topoTables(tables: string[], fkDeps: FkDeps = {}): string[] {
  const known = new Set(tables);
  const dependents: Record<string, string[]> = {};
  const indeg: Record<string, number> = {};
  for (const table of tables) {
    const deps = (fkDeps[table] ?? []).filter((d) => known.has(d) && d !== table);
    indeg[table] = deps.length;
    for (const dep of deps) (dependents[dep] ??= []).push(table);
  }
  const queue = tables.filter((t) => indeg[t] === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const table = queue.shift()!;
    order.push(table);
    for (const dependent of dependents[table] ?? []) {
      if (--indeg[dependent]! === 0) queue.push(dependent);
    }
  }
  if (order.length !== tables.length) {
    const stuck = tables.filter((t) => !order.includes(t));
    throw new Error(`Circular foreign keys between tables: ${stuck.join(", ")}`);
  }
  return order;
}

/**
 * Build the replacement plan for one push.
 *
 * `schema` is the snapshot's `sqlite_master` (tables, indexes — anything with
 * SQL text, excluding `sqlite_%` internals); `data` maps table name to rows,
 * which must be in rowid order (a plain `SELECT *` gives that, and rows
 * referencing later rows in their own table can never exist because the local
 * adapter enforces FKs on every write). `fkDeps` drives the ordering.
 */
export function buildPushPlan(
  schema: SchemaEntry[],
  data: Record<string, RowLike[]>,
  fkDeps?: FkDeps,
  maxChunkBytes = MAX_CHUNK_BYTES,
): PushPlan {
  const chunks: string[] = [];
  let current = "";
  let rows = 0;
  const counts: Record<string, number> = {};

  // Tables in dependency order; everything else (indexes, triggers, views)
  // comes after all tables so it can only ever reference existing ones.
  const tableEntries = schema.filter((entry) => entry.type === "table");
  const otherEntries = schema.filter((entry) => entry.type !== "table");
  const order = topoTables(tableEntries.map((entry) => entry.name), fkDeps);
  const byOrder = (a: SchemaEntry, b: SchemaEntry) =>
    order.indexOf(a.name) - order.indexOf(b.name);
  const orderedTables = [...tableEntries].sort(byOrder);
  for (const table of Object.keys(data)) {
    if (!order.includes(table)) {
      throw new Error(`Data table '${table}' has no schema entry; refusing to skip it.`);
    }
  }

  const flush = () => {
    if (current.trim()) chunks.push(current);
    current = "";
  };
  const append = (statement: string) => {
    if (current.length + statement.length > maxChunkBytes) flush();
    current += statement;
  };

  current += "BEGIN;\n";
  // Drop first, children before the tables they reference, so schema changes
  // apply on the next push instead of failing with "no column named …".
  for (const entry of [...otherEntries].reverse()) {
    if (!entry.sql) continue;
    if (entry.type === "view") append(`DROP VIEW IF EXISTS ${quoteIdent(entry.name)};\n`);
    else if (entry.type === "trigger") {
      append(`DROP TRIGGER IF EXISTS ${quoteIdent(entry.name)};\n`);
    }
  }
  for (const entry of [...orderedTables].reverse()) {
    append(`DROP TABLE IF EXISTS ${quoteIdent(entry.name)};\n`);
  }
  for (const entry of [...orderedTables, ...otherEntries]) {
    if (entry.sql) {
      // sqlite_master.sql has no trailing semicolon; without one the next
      // statement merges into the CREATE and the whole script fails to parse.
      append(withIfNotExists(entry.sql).trimEnd().replace(/;+$/, "") + ";\n");
    }
  }

  for (const table of order) {
    const tableRows = data[table] ?? [];
    // No DELETE needed: the tables were just recreated empty.
    counts[table] = tableRows.length;
    if (tableRows.length === 0) continue;
    const columns = Object.keys(tableRows[0]!);
    const prefix = `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")}) VALUES\n`;
    for (let i = 0; i < tableRows.length; ) {
      // Batch rows by byte size so no statement outgrows a chunk; a single
      // row larger than the limit still rides alone (unavoidable without
      // splitting the INSERT, which SQLite does not allow).
      const tuples: string[] = [];
      let size = prefix.length;
      while (i < tableRows.length && tuples.length < ROWS_PER_INSERT) {
        const tuple = `(${columns.map((c) => sqlLiteral(tableRows[i]![c])).join(", ")})`;
        if (tuples.length > 0 && size + tuple.length + 2 > maxChunkBytes) break;
        tuples.push(tuple);
        size += tuple.length + 2;
        i += 1;
      }
      append(`${prefix}${tuples.join(",\n")};\n`);
      rows += tuples.length;
    }
  }

  current += "COMMIT;\n";
  flush();

  return {
    chunks,
    bytes: chunks.reduce((sum, c) => sum + Buffer.byteLength(c), 0),
    rows,
    tables: Object.keys(data).length,
    counts,
  };
}

/**
 * One statement that counts every table at once — one round trip instead of
 * one per table over the WAN link.
 */
export function buildCountQuery(tables: string[]): string {
  const selects = tables.map(
    (table) => `(SELECT COUNT(*) FROM ${quoteIdent(table)}) AS ${quoteIdent(table)}`,
  );
  return `SELECT ${selects.join(", ")}`;
}

/** Minimal row shape the builder reads. */
type RowLike = Record<string, unknown>;
