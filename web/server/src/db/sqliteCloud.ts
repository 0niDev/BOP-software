/**
 * SQLite Cloud adapter built on the official `@sqlitecloud/drivers` package.
 *
 * The driver opens a single serialized connection: `sql()` returns an array
 * of rows for SELECTs and a `{ lastID, changes }` context object for writes.
 * Because every command goes to the same connection, BEGIN/COMMIT works, but
 * we still guard the whole transaction with an async lock so a concurrent
 * request cannot interleave statements into the middle of it.
 *
 * `AsyncLocalStorage` makes the lock re-entrant: statements issued *inside* a
 * transaction body bypass the lock (they already hold it), while nested
 * `transaction()` calls simply join the outer one.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { Database } from "@sqlitecloud/drivers";
import { DatabaseError } from "../domain/errors.js";
import type { Row, RunResult, SqlDatabase, SqlValue } from "./types.js";

const txContext = new AsyncLocalStorage<boolean>();

interface WriteContext {
  changes?: number;
  lastID?: number | bigint;
}

export class SqliteCloudDatabase implements SqlDatabase {
  private readonly db: Database;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(connectionString: string) {
    if (!connectionString) {
      throw new DatabaseError("SQLITE_CLOUD_URL is not set.");
    }
    this.db = new Database(connectionString);
  }

  /** Serialize operations unless we are already inside the held transaction. */
  private schedule<T>(fn: () => Promise<T>): Promise<T> {
    if (txContext.getStore()) return fn();
    const run = this.chain.then(fn, fn);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async query(sql: string, params: readonly SqlValue[]): Promise<unknown> {
    // The driver's command type is not re-exported from its package index, so
    // we express it via the method signature. Its DataTypes union uses Buffer
    // rather than Uint8Array, but the app never binds blobs.
    type SqlArgument = Parameters<Database["sql"]>[0];
    const command = { query: sql, parameters: [...params] } as unknown as SqlArgument;
    try {
      return await this.db.sql(command);
    } catch (err) {
      throw new DatabaseError(err instanceof Error ? err.message : String(err), { sql });
    }
  }

  async all<T = Row>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    return this.schedule(async () => {
      const result = await this.query(sql, params);
      return Array.isArray(result) ? (result as T[]) : [];
    });
  }

  async get<T = Row>(sql: string, params: readonly SqlValue[] = []): Promise<T | undefined> {
    const rows = await this.all<T>(sql, params);
    return rows[0];
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<RunResult> {
    return this.schedule(async () => {
      const result = await this.query(sql, params);
      if (result && typeof result === "object" && !Array.isArray(result)) {
        const ctx = result as WriteContext;
        if ("changes" in ctx || "lastID" in ctx) {
          return {
            changes: Number(ctx.changes ?? 0),
            lastInsertRowid: Number(ctx.lastID ?? 0),
          };
        }
      }
      // Some statements (e.g. plain INSERT) may come back without a context;
      // fall back to querying the rowid on the same connection.
      const row = await this.rawGet<{ id: number }>("SELECT last_insert_rowid() AS id");
      return { changes: 0, lastInsertRowid: Number(row?.id ?? 0) };
    });
  }

  private async rawGet<T>(sql: string): Promise<T | undefined> {
    const result = await this.query(sql, []);
    if (Array.isArray(result)) return result[0] as T | undefined;
    return undefined;
  }

  async exec(sql: string): Promise<void> {
    await this.schedule(
      () =>
        new Promise<void>((resolve, reject) => {
          try {
            this.db.exec(sql, (err) => (err ? reject(err) : resolve()));
          } catch (err) {
            reject(err);
          }
        }),
    );
  }

  async transaction<T>(fn: (tx: SqlDatabase) => Promise<T>): Promise<T> {
    // Join an in-progress transaction rather than opening a nested one.
    if (txContext.getStore()) {
      return fn(this);
    }
    return this.schedule(async () => {
      await this.execDirect("BEGIN");
      try {
        const result = await txContext.run(true, () => fn(this));
        await this.execDirect("COMMIT");
        return result;
      } catch (err) {
        try {
          await this.execDirect("ROLLBACK");
        } catch {
          // rollback best-effort; surface the original error
        }
        throw err;
      }
    });
  }

  /** Exec without touching the lock (used from inside a held transaction). */
  private execDirect(sql: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        this.db.exec(sql, (err) => (err ? reject(err) : resolve()));
      } catch (err) {
        reject(err);
      }
    });
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve) => {
      try {
        this.db.close(() => resolve());
      } catch {
        resolve();
      }
    });
  }
}
