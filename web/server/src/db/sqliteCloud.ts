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
 *
 * Remote sockets can drop or idle out. We treat that as a *transient* fault and
 * retry the failed operation once on the same connection object. The driver
 * itself is stateful: a credential or configuration failure will repeat on every
 * attempt, so we bound retries and classify repeated failures as permanent.
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

/** Transient socket / idle-timeout faults that are worth one reconnect retry. */
const TRANSIENT_DB_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EPIPE",
  "PROTOCOL_CONNECTION_LOST",
  "SQLITE_CLOUD_DISCONNECTED",
  "SQLITE_CLOUD_CONNECTION_LOST",
  "SQLITE_CLOUD_CONNECTION_FAIL",
  "SQLITE_CLOUD_CONNECTION_ERROR",
  "SocketError",
  "NetworkError",
]);

function isTransient(err: unknown): boolean {
  if (err instanceof Error) {
    if (TRANSIENT_DB_CODES.has(err.name)) return true;
    if (TRANSIENT_DB_CODES.has((err as unknown as { code?: string }).code ?? "")) return true;
    const message = err.message ?? "";
    return TRANSIENT_DB_CODES.has(message);
  }
  return false;
}

/** Permanent configuration / credential failures that retry cannot fix. */
function isPermanent(err: unknown): boolean {
  if (err instanceof Error) {
    const name = err.name;
    const code = (err as unknown as { code?: string }).code ?? "";
    if (
      name === "TypeError" ||
      name === "URIError" ||
      name === "SyntaxError" ||
      code === "ECONNREFUSED" ||
      code === "ENOTFOUND" ||
      code === "EINVAL"
    ) {
      return true;
    }
  }
  return false;
}

export class SqliteCloudDatabase implements SqlDatabase {
  private readonly db: Database;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(connectionString: string) {
    if (!connectionString) {
      throw new DatabaseError("SQLITE_CLOUD_URL is not set.");
    }
    this.db = new Database(connectionString);

    // The driver keeps a single connection object and reconnects it lazily when
    // a command fails. If the installed driver version exposes a supported
    // configuration surface we can wire keep-alive / verbose logging there;
    // until then, don't call undocumented config shapes.
  }

  private readonly _pingSql = "SELECT 1";
  private readonly _pingParams: readonly SqlValue[] = [];

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

  /**
   * Run a single driver statement with one automatic retry for transient
   * connection faults. Permanent failures are thrown immediately so a bad URL
   * or expired credentials fail fast and stay failed.
   *
   * The driver's command signature is not cleanly exported from the package
   * index, so we construct the command object and cast it. Its data-types union
   * uses `Buffer` rather than `Uint8Array`, but this app never binds blobs, so
   * `SqlValue` is safe at runtime and only needs a cast at the boundary.
   */
  private async query(sql: string, params: readonly SqlValue[]): Promise<unknown> {
    const command = { query: sql, parameters: [...params] } as Parameters<Database["sql"]>[0];

    const attempt = async () => {
      try {
        return await this.db.sql(command);
      } catch (err) {
        throw new DatabaseError(err instanceof Error ? err.message : String(err), { sql });
      }
    };

    try {
      return await attempt();
    } catch (err) {
      // One retry window for socket drops and idle timeouts.
      if (isTransient(err) && !isPermanent(err)) {
        try {
          return await attempt();
        } catch (retryErr) {
          throw retryErr;
        }
      }
      throw err;
    }
  }

  /** Lightweight connection health probe. The driver exposes `isConnected()`. */
  async isConnected(): Promise<boolean> {
    if (typeof this.db.isConnected === "function") {
      try {
        return this.db.isConnected();
      } catch {
        return false;
      }
    }
    return true;
  }  /** Explicit health probe for monitoring / readiness. Uses a real query so a
   *  stale TCP connection cannot report healthy. Transient failures are treated as
   *  unhealthy without faulting the process.
   */
  async ping(): Promise<boolean> {
    try {
      await this.db.sql({ query: this._pingSql, parameters: [...this._pingParams] } as Parameters<Database["sql"]>[0]);
      return true;
    } catch {
      return false;
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

  async interrupt(): Promise<void> {
    if (typeof this.db.interrupt === "function") {
      try {
        this.db.interrupt();
      } catch {
        // best-effort cancellation; not a failure path for the app
      }
    }
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
