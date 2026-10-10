import type { SqlDatabase, SqlValue } from "../db/types.js";

export type InsertData = Record<string, SqlValue>;

/**
 * Insert one row and return its new id. Falls back to `last_insert_rowid()`
 * when the driver does not surface it in the write context (some SQLite Cloud
 * responses omit it for plain INSERTs).
 */
export async function insertRow(
  db: SqlDatabase,
  table: string,
  data: InsertData,
): Promise<number> {
  const cols = Object.keys(data);
  if (cols.length === 0) {
    throw new Error(`No columns supplied for insert into ${table}`);
  }
  const placeholders = cols.map(() => "?").join(", ");
  const result = await db.run(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`,
    cols.map((c) => data[c] ?? null),
  );
  if (result.lastInsertRowid > 0) return result.lastInsertRowid;
  const row = await db.get<{ id: number }>("SELECT last_insert_rowid() AS id");
  return Number(row?.id ?? 0);
}
