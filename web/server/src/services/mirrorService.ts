/**
 * Live local copy of the hosted database.
 *
 * Every successful write pokes `notify()`. After a short idle gap the service
 * takes one full snapshot and atomically replaces `erp_mirror.db`. A burst of
 * invoice writes therefore produces one file update, not twenty, and the file
 * is always a consistent SQLite database rather than a half-written state.
 *
 * The copy is refreshed at startup (picks up edits made in the SQLite Cloud
 * dashboard) and flushed on shutdown (the last edits before a restart).
 */
import fs from "node:fs";
import path from "node:path";
import type { SqlDatabase } from "../db/types.js";
import { NotFoundError } from "../domain/errors.js";
import { verifySnapshot, writeSnapshot } from "./snapshot.js";

const FILE = "erp_mirror.db";
const META = "erp_mirror.meta.json";

export interface MirrorStatus {
  enabled: boolean;
  path: string;
  exists: boolean;
  bytes: number;
  updatedAt: string | null;
  /** Seconds since the file last changed, or null when it does not exist yet. */
  lagSeconds: number | null;
  pending: boolean;
  lastError: string | null;
  /** Folder on the operator's computer (mapped drive / UNC share), if configured. */
  pcDirectory: string | null;
  pcUpdatedAt: string | null;
  pcError: string | null;
}

interface MirrorMeta {
  pcUpdatedAt: string | null;
  pcError: string | null;
}

export class MirrorService {
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;
  private rerun = false;
  private lastWriteAt = 0;
  private lastRunAt = 0;
  private lastError: string | null = null;
  private pcUpdatedAt: string | null = null;
  private pcError: string | null = null;

  constructor(
    private readonly db: SqlDatabase,
    private readonly engine: string,
    private readonly dir: string,
    private readonly pcDir: string | null,
    private readonly debounceMs: number,
    private readonly enabled = true,
  ) {
    const meta = this.readMeta();
    this.pcUpdatedAt = meta.pcUpdatedAt ?? null;
    this.pcError = meta.pcError ?? null;
  }

  get file(): string {
    return path.join(this.dir, FILE);
  }

  /** Called by the write observer. Debounced; cheap. */
  notify(): void {
    if (!this.enabled) return;
    this.lastWriteAt = Date.now();
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.runNow();
    }, this.debounceMs);
    this.timer.unref?.();
  }

  /** Startup refresh: catches changes made outside the app. */
  async start(): Promise<void> {
    if (!this.enabled) return;
    await this.runNow();
    console.log(`[mirror] local copy at ${this.file}`);
  }

  /** Flush a pending change before the process exits. */
  async flush(timeoutMs = 20_000): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.lastWriteAt <= this.lastRunAt && !this.running) return;
    await Promise.race([
      this.runNow(),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs).unref?.()),
    ]);
  }

  async runNow(): Promise<void> {
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = this.loop().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async loop(): Promise<void> {
    do {
      this.rerun = false;
      await this.execute();
    } while (this.rerun);
  }

  private async execute(): Promise<void> {
    const target = `${this.file}.tmp`;
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.rmSync(target, { force: true });
      const counts = await writeSnapshot(this.db, this.engine, target);
      verifySnapshot(target, counts);
      this.replace(target);
      this.lastRunAt = Date.now();
      this.lastError = null;
      this.copyToPc();
    } catch (err) {
      fs.rmSync(target, { force: true });
      this.lastError = messageOf(err);
      console.error(`[${new Date().toISOString()}] [mirror] failed:`, err);
    }
    this.writeMeta();
  }

  /** Rename over the previous copy; if it is locked, the old file stays and the next run retries. */
  private replace(tmp: string): void {
    fs.renameSync(tmp, this.file);
  }

  private copyToPc(): void {
    if (!this.pcDir) return;
    const target = path.join(this.pcDir, FILE);
    const tmp = `${target}.tmp`;
    try {
      fs.mkdirSync(this.pcDir, { recursive: true });
      fs.copyFileSync(this.file, tmp);
      fs.renameSync(tmp, target);
      this.pcUpdatedAt = new Date().toISOString();
      this.pcError = null;
    } catch (err) {
      try {
        fs.rmSync(tmp, { force: true });
      } catch {
        // the share may be gone entirely; the local copy is what matters
      }
      this.pcError = messageOf(err);
      console.error(`[mirror] could not write to ${this.pcDir}:`, err);
    }
  }

  async status(): Promise<MirrorStatus> {
    const exists = fs.existsSync(this.file);
    const stat = exists ? fs.statSync(this.file) : null;
    return {
      enabled: this.enabled,
      path: this.file,
      exists,
      bytes: stat?.size ?? 0,
      updatedAt: stat ? stat.mtime.toISOString() : null,
      lagSeconds: stat ? Math.max(0, Math.round((Date.now() - stat.mtimeMs) / 1000)) : null,
      pending: this.timer !== null || this.running !== null,
      lastError: this.lastError,
      pcDirectory: this.pcDir,
      pcUpdatedAt: this.pcUpdatedAt,
      pcError: this.pcError,
    };
  }

  /** Read the whole file for a browser download; safe while a replace is in flight. */
  async read(): Promise<Buffer> {
    if (!fs.existsSync(this.file)) throw new NotFoundError("No local copy has been written yet.");
    return fs.readFileSync(this.file);
  }

  private metaPath(): string {
    return path.join(this.dir, META);
  }

  private readMeta(): Partial<MirrorMeta> {
    try {
      return JSON.parse(fs.readFileSync(this.metaPath(), "utf8")) as Partial<MirrorMeta>;
    } catch {
      return {};
    }
  }

  private writeMeta(): void {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const tmp = `${this.metaPath()}.tmp`;
      fs.writeFileSync(
        tmp,
        JSON.stringify({ pcUpdatedAt: this.pcUpdatedAt, pcError: this.pcError }, null, 2),
      );
      fs.renameSync(tmp, this.metaPath());
    } catch {
      // status is a convenience; never let its bookkeeping fail a snapshot
    }
  }
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
