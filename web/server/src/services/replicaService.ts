/**
 * Cloud replica push: the local database is the source of truth and SQLite
 * Cloud is a read-only copy of it, rebuilt wholesale on every push.
 *
 * Cadence: a full push at startup (catches anything a hard kill left behind),
 * every `intervalMinutes`, on demand (`POST /api/backup/replica/push`), and a
 * flush at shutdown when there is anything unsent.
 *
 * Each push is atomic on the cloud side (`BEGIN … COMMIT`, fresh connection,
 * closed at the end): an interrupted push leaves the previous good copy, and a
 * manual edit made in the SQLite Cloud dashboard is overwritten — by design,
 * the local database is the only writer.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Database } from "@sqlitecloud/drivers";
import type { Row, SqlDatabase } from "../db/types.js";
import {
  buildCountQuery,
  buildPushPlan,
  quoteIdent,
  type PushPlan,
  type SchemaEntry,
} from "./replicaScript.js";

export interface ReplicaStatus {
  enabled: boolean;
  dryRun: boolean;
  intervalMinutes: number;
  lastPushAt: string | null;
  /** Seconds since the last successful push, or null when none yet. */
  secondsAgo: number | null;
  pending: boolean;
  dirty: boolean;
  lastError: string | null;
  lastRows: number;
  lastBytes: number;
  lastDurationMs: number;
}

const SCHEMA_SQL =
  "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'";

export class ReplicaService {
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;
  private rerun = false;
  private passes = 0;
  private dirty = true; // start() pushes once regardless
  private lastPushAt: string | null = null;
  private lastError: string | null = null;
  private lastRows = 0;
  private lastBytes = 0;
  private lastDurationMs = 0;

  constructor(
    private readonly db: SqlDatabase,
    private readonly cloudUrl: string,
    private readonly dir: string,
    private readonly intervalMinutes = 15,
    private readonly dryRun = false,
  ) {}

  get enabled(): boolean {
    return this.cloudUrl.length > 0;
  }

  get file(): string {
    return path.join(this.dir, "replica");
  }

  /** Called by the write observer; the timer decides when to actually push. */
  markDirty(): void {
    this.dirty = true;
  }

  /** Startup push, then the interval. Never throws. */
  async start(): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.runNow();
    } catch (err) {
      console.error(`[${new Date().toISOString()}] [replica] startup push failed:`, err);
    }
    this.timer = setInterval(() => {
      void this.runNow().catch((err: unknown) => {
        console.error(`[${new Date().toISOString()}] [replica] scheduled push failed:`, err);
      });
    }, this.intervalMinutes * 60 * 1000);
    this.timer.unref?.();
    console.log(`[replica] pushing to SQLite Cloud every ${this.intervalMinutes} min`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Await the in-flight push, then push once more if writes landed during it. */
  async flush(timeoutMs = 20_000): Promise<void> {
    if (!this.enabled || (!this.dirty && !this.running)) return;
    await withTimeout(this.runNow(), timeoutMs);
  }

  /** Push now; joins an in-flight push instead of starting a second one. Rejects on failure. */
  runNow(): Promise<void> {
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.passes = 0;
    this.running = this.loop().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async loop(): Promise<void> {
    do {
      this.rerun = false;
      this.passes += 1;
      await this.execute();
    } while ((this.rerun || this.dirty) && this.passes < 3);
    // A continuous write stream leaves dirty set; the next timer pass catches up.
  }

  private async execute(): Promise<void> {
    // The snapshot below captures everything committed at this moment; writes
    // landing afterwards re-mark dirty and cause another pass.
    this.dirty = false;
    const target = path.join(this.dir, `replica-${stamp()}.db`);
    const started = Date.now();
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      await this.db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
      const plan = this.readPlan(target);
      this.lastRows = plan.rows;
      this.lastBytes = plan.bytes;
      if (!this.dryRun) {
        await this.send(plan);
        this.lastPushAt = new Date().toISOString();
        console.log(
          `[replica] pushed ${plan.rows} rows to SQLite Cloud in ${((Date.now() - started) / 1000).toFixed(1)}s ` +
            `(${(plan.bytes / 1024).toFixed(0)} KB script)`,
        );
      } else {
        console.log(
          `[replica] dry run: ${plan.rows} rows, ${(plan.bytes / 1024).toFixed(0)} KB in ` +
            `${plan.chunks.length} chunk(s) — nothing sent`,
        );
      }
      this.lastDurationMs = Date.now() - started;
      this.lastError = null;
    } catch (err) {
      this.dirty = true;
      this.lastError = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      fs.rmSync(target, { force: true });
    }
  }

  /** Read the staged snapshot and turn it into SQL. Synchronous by design: the file is small. */
  private readPlan(file: string): PushPlan {
    const local = new DatabaseSync(file);
    try {
      const schema = local.prepare(SCHEMA_SQL).all() as unknown as SchemaEntry[];
      const tables = schema.filter((entry) => entry.type === "table").map((entry) => entry.name);
      // The cloud server enforces foreign keys on every statement, so the
      // plan must create/insert parents before children.
      const fkDeps: Record<string, string[]> = {};
      for (const table of tables) {
        const refs = local
          .prepare(`PRAGMA foreign_key_list(${quoteIdent(table)})`)
          .all() as Array<{ table: string }>;
        fkDeps[table] = [...new Set(refs.map((fk) => fk.table))];
      }
      const data: Record<string, Row[]> = {};
      for (const table of tables) {
        data[table] = local
          .prepare(`SELECT * FROM ${quoteIdent(table)}`)
          .all() as unknown as Row[];
      }
      return buildPushPlan(schema, data, fkDeps);
    } finally {
      local.close();
    }
  }

  /** Send the plan on a dedicated connection; verify row counts in one round trip. */
  private async send(plan: PushPlan): Promise<void> {
    const cloud = new Database(this.cloudUrl);
    try {
      for (const chunk of plan.chunks) {
        await execAsync(cloud, chunk);
      }
      const tables = Object.keys(plan.counts);
      if (tables.length > 0) {
        const rows = (await sqlAsync(cloud, buildCountQuery(tables))) as Row[];
        const actual = rows[0] ?? {};
        for (const [table, expected] of Object.entries(plan.counts)) {
          const got = Number(actual[table] ?? -1);
          if (got !== expected) {
            throw new Error(`Replica table '${table}' has ${got} rows, expected ${expected}.`);
          }
        }
      }
    } catch (err) {
      try {
        await execAsync(cloud, "ROLLBACK");
      } catch {
        // the original failure is the useful one
      }
      throw err;
    } finally {
      await closeAsync(cloud);
    }
  }

  async status(): Promise<ReplicaStatus> {
    return {
      enabled: this.enabled,
      dryRun: this.dryRun,
      intervalMinutes: this.intervalMinutes,
      lastPushAt: this.lastPushAt,
      secondsAgo: this.lastPushAt
        ? Math.max(0, Math.round((Date.now() - Date.parse(this.lastPushAt)) / 1000))
        : null,
      pending: this.timer !== null || this.running !== null,
      dirty: this.dirty,
      lastError: this.lastError,
      lastRows: this.lastRows,
      lastBytes: this.lastBytes,
      lastDurationMs: this.lastDurationMs,
    };
  }
}

function execAsync(db: Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      db.exec(sql, (err) => (err ? reject(err) : resolve()));
    } catch (err) {
      reject(err);
    }
  });
}

function sqlAsync(db: Database, sql: string): Promise<unknown> {
  return db.sql({ query: sql, parameters: [] } as Parameters<Database["sql"]>[0]);
}

function closeAsync(db: Database): Promise<void> {
  return new Promise((resolve) => {
    try {
      db.close(() => resolve());
    } catch {
      resolve();
    }
  });
}

function withTimeout(promise: Promise<void>, ms: number): Promise<void> {
  return Promise.race([
    promise,
    new Promise<void>((resolve) => {
      const t = setTimeout(resolve, ms);
      t.unref?.();
    }),
  ]);
}

/** Same stamp format as the named backups: `<YYYYMMDD_HHMMSS>`. */
function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "_");
}
