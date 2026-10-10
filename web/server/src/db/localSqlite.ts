/**
 * Local SQLite adapter built on Node's built-in `node:sqlite` module.
 *
 * Used for development and for the fast, network-free test suite. It exposes
 * the exact same `SqlDatabase` contract as the SQLite Cloud adapter so the
 * services and repositories are completely unaware of which one is active.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DatabaseError } from "../domain/errors.js";
import type { Row, RunResult, SqlDatabase, SqlValue } from "./types.js";

type BindValue = string | number | bigint | Uint8Array | null;

function bindAll(params?: readonly SqlValue[]): BindValue[] {
  if (!params) return [];
  return params.map((p) => (p === undefined ? null : p));
}

export class LocalSqliteDatabase implements SqlDatabase {
  private readonly db: DatabaseSync;
  private depth = 0;

  constructor(file: string) {
    if (file !== ":memory:") {
      fs.mkdirSync(path.dirname(file), { recursive: true });
    }
    this.db = new DatabaseSync(file);
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
  }

  async all<T = Row>(sql: string, params?: readonly SqlValue[]): Promise<T[]> {
    try {
      return this.db.prepare(sql).all(...bindAll(params)) as T[];
    } catch (err) {
      throw new DatabaseError(messageOf(err), { sql });
    }
  }

  async get<T = Row>(sql: string, params?: readonly SqlValue[]): Promise<T | undefined> {
    try {
      const rows = this.db.prepare(sql).all(...bindAll(params)) as T[];
      return rows[0];
    } catch (err) {
      throw new DatabaseError(messageOf(err), { sql });
    }
  }

  async run(sql: string, params?: readonly SqlValue[]): Promise<RunResult> {
    try {
      const result = this.db.prepare(sql).run(...bindAll(params));
      return {
        changes: Number(result.changes),
        lastInsertRowid: Number(result.lastInsertRowid),
      };
    } catch (err) {
      throw new DatabaseError(messageOf(err), { sql });
    }
  }

  async exec(sql: string): Promise<void> {
    try {
      this.db.exec(sql);
    } catch (err) {
      throw new DatabaseError(messageOf(err), { sql });
    }
  }

  async transaction<T>(fn: (tx: SqlDatabase) => Promise<T>): Promise<T> {
    // Nested calls join the outer transaction; an error thrown anywhere in
    // the body propagates to the root, which issues the single ROLLBACK.
    if (this.depth > 0) {
      this.depth += 1;
      try {
        return await fn(this);
      } finally {
        this.depth -= 1;
      }
    }

    this.db.exec("BEGIN");
    this.depth = 1;
    try {
      const result = await fn(this);
      this.db.exec("COMMIT");
      return result;
    } catch (err) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
        // ignore rollback failures; the original error is more useful
      }
      throw err;
    } finally {
      this.depth = 0;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
