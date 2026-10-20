/**
 * Portable SQLite snapshots used by both the named backups and the live mirror.
 *
 * - **local engine**: `VACUUM INTO` writes a consistent copy while the server
 *   keeps running. SQLite does the hard part.
 * - **sqlitecloud engine**: the gateway writes files on its own machine, not
 *   ours, so the schema and rows are read out and rebuilt into a local
 *   `node:sqlite` file. The reads run inside one transaction so the copy is a
 *   single point in time rather than a mix of tables from different moments.
 *
 * The result is always a real SQLite database: openable, verifiable and
 * restorable with any SQLite tool, regardless of which engine produced it.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Row, SqlDatabase } from "../db/types.js";

export type SnapshotCounts = Record<string, number>;

interface SchemaRow {
  type: string;
  name: string;
  sql: string;
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Write a snapshot of `db` to `target`. Returns the row count per table so the
 * caller can verify the copy (the local engine has no counts to return).
 */
export async function writeSnapshot(
  db: SqlDatabase,
  engine: string,
  target: string,
): Promise<SnapshotCounts> {
  fs.mkdirSync(path.dirname(target), { recursive: true });

  if (engine !== "sqlitecloud") {
    await db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    return {};
  }

  const schema = await db.all<SchemaRow>(
    "SELECT type, name, sql FROM sqlite_master " +
      "WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'",
  );
  const tables = schema.filter((entry) => entry.type === "table").map((entry) => entry.name);
  const sequences = await db
    .all<Row>("SELECT name, seq FROM sqlite_sequence")
    .catch(() => [] as Row[]);

  // One read transaction = one point-in-time view. Without it a transaction
  // that commits mid-copy could leave a header without its lines.
  const data = await db.transaction(async (tx) => {
    const rows: Record<string, Row[]> = {};
    for (const table of tables) {
      rows[table] = await tx.all<Row>(`SELECT * FROM ${quoteIdent(table)}`);
    }
    return rows;
  });

  writeLogicalFile(target, schema, data, sequences);

  return Object.fromEntries(tables.map((table) => [table, data[table]!.length]));
}

function writeLogicalFile(
  target: string,
  schema: SchemaRow[],
  data: Record<string, Row[]>,
  sequences: Row[],
): void {
  const local = new DatabaseSync(target);
  try {
    local.exec("PRAGMA foreign_keys = OFF");
    local.exec("BEGIN");
    for (const entry of schema.filter((row) => row.type === "table")) {
      local.exec(entry.sql);
    }
    for (const [table, rows] of Object.entries(data)) {
      insertRows(local, table, rows);
    }
    if (sequences.length > 0) {
      const stmt = local.prepare(
        "INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (?, ?)",
      );
      for (const row of sequences) stmt.run(String(row.name), Number(row.seq ?? 0));
    }
    // Indexes/triggers/views last: they are faster to build over existing rows
    // and never get in the way of the table inserts.
    for (const entry of schema.filter((row) => row.type !== "table")) {
      local.exec(entry.sql);
    }
    local.exec("COMMIT");
  } catch (err) {
    try {
      local.exec("ROLLBACK");
    } catch {
      // the original failure is the useful one
    }
    local.close();
    fs.rmSync(target, { force: true });
    throw err;
  }
  local.close();
}

function insertRows(local: DatabaseSync, table: string, rows: Row[]): void {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]!);
  const stmt = local.prepare(
    `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")}) ` +
      `VALUES (${columns.map(() => "?").join(", ")})`,
  );
  for (const row of rows) {
    stmt.run(...columns.map((column) => bindable(row[column])));
  }
}

/** `node:sqlite` accepts primitives and byte arrays; never coerce silently. */
function bindable(value: unknown): string | number | bigint | Uint8Array | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    value instanceof Uint8Array
  ) {
    return value;
  }
  throw new Error(`Unsupported value type in snapshot: ${Object.prototype.toString.call(value)}`);
}

/**
 * Check that `file` is a healthy SQLite database and, when counts are supplied,
 * that no table lost rows. Throws on the first problem.
 */
export function verifySnapshot(file: string, expected?: SnapshotCounts): void {
  const local = new DatabaseSync(file);
  try {
    const check = local.prepare("PRAGMA integrity_check").get() as Row | undefined;
    const result = String(Object.values(check ?? {})[0] ?? "");
    if (result !== "ok") {
      throw new Error(`Snapshot integrity check failed: ${result || "no result"}`);
    }
    for (const [table, count] of Object.entries(expected ?? {})) {
      const row = local.prepare(`SELECT COUNT(*) AS n FROM ${quoteIdent(table)}`).get() as
        | { n: number }
        | undefined;
      if (Number(row?.n ?? -1) !== count) {
        throw new Error(
          `Snapshot table '${table}' has ${Number(row?.n ?? -1)} rows, expected ${count}.`,
        );
      }
    }
  } finally {
    local.close();
  }
}
