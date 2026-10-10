import { LocalSqliteDatabase } from "../../src/db/localSqlite.js";
import { seedDemoData, type DemoIds } from "../../src/seedData.js";
import type { SqlDatabase } from "../../src/db/types.js";

export interface TestContext {
  db: SqlDatabase;
  ids: DemoIds;
}

/** Fresh in-memory SQLite database with schema, seed accounts and demo data. */
export async function freshDb(): Promise<TestContext> {
  const db = new LocalSqliteDatabase(":memory:");
  const ids = await seedDemoData(db);
  return { db, ids };
}

export async function closeDb(db: SqlDatabase): Promise<void> {
  await db.close();
}

/** Look up an account id by code (company 1). */
export async function accountId(db: SqlDatabase, code: string): Promise<number> {
  const row = await db.get<{ id: number }>(
    "SELECT id FROM accounts WHERE account_code = ? AND company_id = 1",
    [code],
  );
  if (!row) throw new Error(`Account ${code} not seeded`);
  return row.id;
}
