/**
 * Named database backups: `erp_backup_<timestamp>.db` snapshots with pruning.
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

const FILE_PREFIX = "erp_backup_";
const FILE_SUFFIX = ".db";

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
  ) {}

  private stamp(): string {
    return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "_");
  }

  /** All snapshot files, newest first. */
  private readDir(): BackupFile[] {
    if (!fs.existsSync(this.backupDir)) return [];
    return fs
      .readdirSync(this.backupDir)
      .filter((name) => name.startsWith(FILE_PREFIX) && name.endsWith(FILE_SUFFIX))
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
    const file = `${FILE_PREFIX}${this.stamp()}${FILE_SUFFIX}`;
    const target = path.join(this.backupDir, file);
    try {
      const counts = await writeSnapshot(this.db, this.engine, target);
      verifySnapshot(target, counts);
    } catch (err) {
      fs.rmSync(target, { force: true });
      throw err;
    }
    this.prune();
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

  /** Resolve a snapshot name to an absolute path, refusing traversal. */
  resolve(file: string): string {
    const name = path.basename(file);
    if (name !== file || !name.startsWith(FILE_PREFIX) || !name.endsWith(FILE_SUFFIX)) {
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
