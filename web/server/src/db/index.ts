import { env } from "../env.js";
import { ConfigurationError } from "../domain/errors.js";
import { LocalSqliteDatabase } from "./localSqlite.js";
import { SqliteCloudDatabase } from "./sqliteCloud.js";
import type { SqlDatabase } from "./types.js";

/**
 * A database loaded through Settings → Database. When set, the local adapter
 * opens this file instead of `ERP_LOCAL_DB`; the real database file is never
 * touched, so a restart always returns to it. In-memory only: cleared on exit.
 */
let localOverride: { file: string; label: string } | null = null;

/** Point the local engine at another file (or `null` to use `ERP_LOCAL_DB`). */
export function setLocalDbOverride(next: { file: string; label: string } | null): void {
  localOverride = next;
}

/** The hot-swapped database, or `null` when the real local file is active. */
export function getLocalDbOverride(): { file: string; label: string } | null {
  return localOverride;
}

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
  return new LocalSqliteDatabase(localOverride?.file ?? env.localDbPath);
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
