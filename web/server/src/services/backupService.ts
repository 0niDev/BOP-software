/**
 * Timestamp-named database backups: `<YYYYMMDD_HHMMSS>.db` snapshots with pruning.
 *
 * Both engines are supported now. Local snapshots use `VACUUM INTO`; hosted
 * SQLite Cloud snapshots are rebuilt into a portable local file (see
 * `snapshot.ts`). The live continuously-updated copy is a separate service
 * (`mirrorService.ts`).
 *
 * Restore is still refused while the server holds the connection open: swapping
 * the database file under a live connection corrupts it.
 */
import fs from "node:fs";
import path from "node:path";
import type { SqlDatabase } from "../db/types.js";
import { NotFoundError, ValidationError } from "../domain/errors.js";
import { verifySnapshot, writeSnapshot } from "./snapshot.js";

/** Snapshot file name: a pure UTC timestamp, `<YYYYMMDD_HHMMSS>.db`. */
const FILE_RE = /^\d{8}_\d{6}\.db$/;

export interface BackupFile {
  file: string;
  bytes: number;
  modifiedAt: string;
}

export interface BackupStatus {
  engine: string;
  directory: string;
  supported: boolean;
  exists: boolean;
  count: number;
  latest: string | null;
  totalBytes: number;
  backups: BackupFile[];
}

export interface BackupResult {
  file: string;
  path: string;
  bytes: number;
  createdAt: string;
}

export class BackupService {
  constructor(
    private readonly db: SqlDatabase,
    private readonly engine: string,
    private readonly backupDir: string,
    /** Keep at most this many snapshots; 0 disables pruning. */
    private readonly keep = 0,
    /** Optional second copy of every snapshot (the operator's Desktop folder). */
    private readonly desktopDir: string | null = null,
  ) {}

  private stamp(): string {
    return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "_");
  }
  /** All snapshot files, newest first. */
  private readDir(): BackupFile[] {
    if (!fs.existsSync(this.backupDir)) return [];
    return fs
      .readdirSync(this.backupDir)
      .filter((name) => FILE_RE.test(name))
      .map((name) => {
        const stat = fs.statSync(path.join(this.backupDir, name));
        return { file: name, bytes: stat.size, modifiedAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1));
  }

  async status(): Promise<BackupStatus> {
    const backups = this.readDir();
    const latest = backups[0] ?? null;
    return {
      engine: this.engine,
      directory: this.backupDir,
      supported: true,
      exists: fs.existsSync(this.backupDir),
      count: backups.length,
      latest: latest?.file ?? null,
      totalBytes: backups.reduce((sum, entry) => sum + entry.bytes, 0),
      backups,
    };
  }

  /** Create a snapshot now. */
  async run(): Promise<BackupResult> {
    fs.mkdirSync(this.backupDir, { recursive: true });
    const file = `${this.stamp()}.db`;
    const target = path.join(this.backupDir, file);
    try {
      const counts = await writeSnapshot(this.db, this.engine, target);
      verifySnapshot(target, counts);
    } catch (err) {
      fs.rmSync(target, { force: true });
      throw err;
    }
    this.prune();
    this.copyToDesktop(target, file);
    this.pruneDesktop();
    const stat = fs.statSync(target);
    return {
      file,
      path: target,
      bytes: stat.size,
      createdAt: stat.mtime.toISOString(),
    };
  }

  /** Keep the newest `keep` snapshots, only after a successful new one exists. */
  private prune(): void {
    if (this.keep <= 0) return;
    for (const entry of this.readDir().slice(this.keep)) {
      try {
        fs.rmSync(path.join(this.backupDir, entry.file), { force: true });
      } catch {
        // a locked file is retried on the next successful backup
      }
    }
  }

  /** Best-effort copy into the desktop folder; never fails the real backup. */
  private copyToDesktop(target: string, file: string): void {
    if (!this.desktopDir) return;
    try {
      fs.mkdirSync(this.desktopDir, { recursive: true });
      fs.copyFileSync(target, path.join(this.desktopDir, file));
    } catch (err) {
      console.error(`[${new Date().toISOString()}] [backup] could not copy to ${this.desktopDir}:`, err);
    }
  }

  /** The desktop folder mirrors the local set: pruned local snapshots go too. */
  private pruneDesktop(): void {
    if (!this.desktopDir) return;
    const keep = new Set(this.readDir().map((entry) => entry.file));
    let names: string[];
    try {
      names = fs.readdirSync(this.desktopDir);
    } catch {
      return;
    }
    for (const name of names.filter((n) => FILE_RE.test(n))) {
      if (keep.has(name)) continue;
      try {
        fs.rmSync(path.join(this.desktopDir, name), { force: true });
      } catch {
        // a locked file is retried on the next successful backup
      }
    }
  }

  /** Resolve a snapshot name to an absolute path, refusing traversal. */
  resolve(file: string): string {
    const name = path.basename(file);
    if (name !== file || !FILE_RE.test(name)) {
      throw new ValidationError("Invalid backup file name.");
    }
    const target = path.join(this.backupDir, name);
    if (!fs.existsSync(target)) throw new NotFoundError(`Backup '${name}' not found.`);
    return target;
  }

  /**
   * Restoring means replacing the live database, which cannot be done safely
   * while this process holds the connection open.
   */
  restore(file: string): never {
    this.resolve(file); // 400/404 for a bad name, before explaining
    throw new ValidationError(
      this.engine === "sqlitecloud"
        ? "Restore cannot run while the server is using the hosted database. Use the provider's " +
            "point-in-time restore, or upload the snapshot through the SQLite Cloud dashboard."
        : "Restore cannot run while the server is using the database. Stop the server, then copy " +
            `backups/${path.basename(file)} over the database file and start it again.`,
    );
  }
}
