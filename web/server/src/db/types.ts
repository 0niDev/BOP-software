/** The database abstraction every repository depends on. */

export type SqlValue = string | number | bigint | Uint8Array | null;
export type Row = Record<string, unknown>;

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface SqlDatabase {
  /** Run a SELECT and return every row. */
  all<T = Row>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  /** Run a SELECT and return the first row (or undefined). */
  get<T = Row>(sql: string, params?: readonly SqlValue[]): Promise<T | undefined>;
  /** Run a single write statement. */
  run(sql: string, params?: readonly SqlValue[]): Promise<RunResult>;
  /** Run one or more statements with no parameters (DDL, migrations). */
  exec(sql: string): Promise<void>;
  /**
   * Run `fn` inside a database transaction. Nested calls join the outer
   * transaction so a service calling another service commits atomically.
   */
  transaction<T>(fn: (tx: SqlDatabase) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
