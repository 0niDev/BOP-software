/**
 * Local SQLite adapter built on Node's built-in `node:sqlite` module.
 *
 * Used for development and for the fast, network-free test suite. It exposes
 * the exact same `SqlDatabase` contract as the SQLite Cloud adapter so the
 * services and repositories are completely unaware of which one is active.
 *
 * Local SQLite cannot idle-drop the way a remote socket can, but we still
 * provide the same health / interrupt surface so the rest of the app is
 * engine-agnostic.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DatabaseError } from "../domain/errors.js";
import type { Row, RunResult, SqlDatabase, SqlValue } from "./types.js";

type BindValue = string | number | bigint | Uint8Array | null;

/**
 * Re-entrancy marker for `transaction()`: statements issued *inside* a
 * transaction body bypass the serialization queue (they already hold it), and
 * a nested `transaction()` joins the outer one.
 */
const txContext = new AsyncLocalStorage<boolean>();

function bindAll(params?: readonly SqlValue[]): BindValue[] {
  if (!params) return [];
  return params.map((p) => (p === undefined ? null : p));
}

export class LocalSqliteDatabase implements SqlDatabase {
  private readonly db: DatabaseSync;
  /** Serializes every operation on this connection; a transaction body holds it. */
  private chain: Promise<unknown> = Promise.resolve();

  constructor(file: string) {
    if (file !== ":memory:") {
      fs.mkdirSync(path.dirname(file), { recursive: true });
    }
    this.db = new DatabaseSync(file);
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
    // WAL: external readers (DB Browser, scripts) see a consistent snapshot
    // while the app writes, and never block it. File copies still need the
    // -wal sidecar, so backups go through VACUUM INTO instead of `cp`.
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA synchronous = NORMAL");
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

  async all<T = Row>(sql: string, params?: readonly SqlValue[]): Promise<T[]> {
    return this.schedule(async () => {
      try {
        return this.db.prepare(sql).all(...bindAll(params)) as T[];
      } catch (err) {
        throw new DatabaseError(messageOf(err), { sql });
      }
    });
  }

  async get<T = Row>(sql: string, params?: readonly SqlValue[]): Promise<T | undefined> {
    return this.schedule(async () => {
      try {
        const rows = this.db.prepare(sql).all(...bindAll(params)) as T[];
        return rows[0];
      } catch (err) {
        throw new DatabaseError(messageOf(err), { sql });
      }
    });
  }

  async run(sql: string, params?: readonly SqlValue[]): Promise<RunResult> {
    return this.schedule(async () => {
      try {
        const result = this.db.prepare(sql).run(...bindAll(params));
        return {
          changes: Number(result.changes),
          lastInsertRowid: Number(result.lastInsertRowid),
        };
      } catch (err) {
        throw new DatabaseError(messageOf(err), { sql });
      }
    });
  }

  async exec(sql: string): Promise<void> {
    return this.schedule(async () => {
      try {
        this.db.exec(sql);
      } catch (err) {
        throw new DatabaseError(messageOf(err), { sql });
      }
    });
  }

  async interrupt(): Promise<void> {
    // Local `node:sqlite` does not expose a public interrupt API, so this is a
    // no-op that keeps the contract consistent with the cloud adapter.
  }

  async isConnected(): Promise<boolean> {
    // A locally open file-based or in-memory database is always connected.
    return true;
  }

  async ping(): Promise<boolean> {
    try {
      this.db.exec("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async transaction<T>(fn: (tx: SqlDatabase) => Promise<T>): Promise<T> {
    // Join an in-progress transaction rather than opening a nested one.
    if (txContext.getStore()) return fn(this);
    return this.schedule(async () => {
      this.db.exec("BEGIN");
      try {
        const result = await txContext.run(true, () => fn(this));
        this.db.exec("COMMIT");
        return result;
      } catch (err) {
        try {
          this.db.exec("ROLLBACK");
        } catch {
          // ignore rollback failures; the original error is more useful
        }
        throw err;
      }
    });
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
