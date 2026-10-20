/**
 * Write notification wrapper around a `SqlDatabase`.
 *
 * The mirror needs to know "something changed", not what changed. Every
 * successful write (`run`/`exec`) pokes the callback; the mirror debounces and
 * takes a full snapshot. A failed or rolled-back write may still poke it — the
 * snapshot is taken later and simply reflects the committed state, so a false
 * positive costs one extra copy, never correctness.
 *
 * `VACUUM INTO` is exempt: it is a read that writes a file, and letting it
 * trigger a mirror would make the mirror trigger itself.
 */
import type { Row, RunResult, SqlDatabase, SqlValue } from "./types.js";

const WRITE_EXEMPT = /^\s*VACUUM\s+INTO\b/i;

export class ObservedDatabase implements SqlDatabase {
  constructor(
    private readonly inner: SqlDatabase,
    private readonly onWrite: () => void,
  ) {}

  all<T = Row>(sql: string, params?: readonly SqlValue[]): Promise<T[]> {
    return this.inner.all<T>(sql, params);
  }

  get<T = Row>(sql: string, params?: readonly SqlValue[]): Promise<T | undefined> {
    return this.inner.get<T>(sql, params);
  }

  async run(sql: string, params?: readonly SqlValue[]): Promise<RunResult> {
    const result = await this.inner.run(sql, params);
    this.notify(sql);
    return result;
  }

  async exec(sql: string): Promise<void> {
    await this.inner.exec(sql);
    this.notify(sql);
  }

  /**
   * Delegates as-is. The services hold this wrapper and issue their statements
   * through it, so writes inside a transaction are already observed. The `tx`
   * argument is the inner adapter; code that writes through `tx` directly would
   * bypass the notification, which this codebase does not do.
   */
  transaction<T>(fn: (tx: SqlDatabase) => Promise<T>): Promise<T> {
    return this.inner.transaction(fn);
  }

  close(): Promise<void> {
    return this.inner.close();
  }

  interrupt(): Promise<void> {
    return this.inner.interrupt();
  }

  isConnected(): Promise<boolean> {
    return this.inner.isConnected();
  }

  ping(): Promise<boolean> {
    return this.inner.ping();
  }

  private notify(sql: string): void {
    if (WRITE_EXEMPT.test(sql)) return;
    try {
      this.onWrite();
    } catch {
      // A mirror failure must never fail the business write.
    }
  }
}
