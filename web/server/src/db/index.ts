import { env } from "../env.js";
import { ConfigurationError } from "../domain/errors.js";
import { LocalSqliteDatabase } from "./localSqlite.js";
import { SqliteCloudDatabase } from "./sqliteCloud.js";
import type { SqlDatabase } from "./types.js";

/** Build a database adapter from configuration. */
export function createDatabase(): SqlDatabase {
  if (env.dbEngine === "sqlitecloud") {
    if (!env.sqliteCloudUrl) {
      throw new ConfigurationError(
        "ERP_DB_ENGINE=sqlitecloud but SQLITE_CLOUD_URL is not set.",
      );
    }
    return new SqliteCloudDatabase(env.sqliteCloudUrl);
  }
  return new LocalSqliteDatabase(env.localDbPath);
}

let instance: SqlDatabase | null = null;

export function getDb(): SqlDatabase {
  if (!instance) instance = createDatabase();
  return instance;
}

export async function closeDb(): Promise<void> {
  if (instance) {
    await instance.close();
    instance = null;
  }
}

export type { SqlDatabase, Row, SqlValue, RunResult } from "./types.js";
export { SCHEMA_SQL } from "./schema.js";
