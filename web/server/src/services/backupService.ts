/**
 * Database backups, ported from controllers/backup_controller.py and
 * services/auto_backup.py (which write `backups/erp_backup_*.db` snapshots and
 * report folder health).
 *
 * Scope note -- this is deliberately narrow:
 * - **local engine**: `VACUUM INTO` produces a consistent snapshot even while
 *   the database is open, so backups work live.
 * - **sqlitecloud engine**: refused. The hosted database's snapshotting is the
 *   provider's job, and this code must never touch production data.
 * - **restore**: refused while the server holds the connection open, because
 *   swapping the database file under a live connection corrupts it. The error
 *   explains the safe procedure instead of pretending to work.
 */
import fs from "node:fs";
import path from "node:path";
import type { SqlDatabase } from "../db/types.js";
import { ConfigurationError, NotFoundError, ValidationError } from "../domain/errors.js";

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
  ) {}

  private assertSupported(): void {
    if (this.engine !== "local") {
      throw new ConfigurationError(
        "Snapshots are only available for the local database engine. The hosted " +
          "SQLite Cloud database is backed up by the provider.",
      );
    }
  }

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
      supported: this.engine === "local",
      exists: fs.existsSync(this.backupDir),
      count: backups.length,
      latest: latest?.file ?? null,
      totalBytes: backups.reduce((sum, entry) => sum + entry.bytes, 0),
      backups,
    };
  }

  /** Create a snapshot now. */
  async run(): Promise<BackupResult> {
    this.assertSupported();
    fs.mkdirSync(this.backupDir, { recursive: true });
    const file = `${FILE_PREFIX}${this.stamp()}${FILE_SUFFIX}`;
    const target = path.join(this.backupDir, file);
    // VACUUM INTO writes a fully consistent copy without stopping the server.
    await this.db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    const stat = fs.statSync(target);
    return {
      file,
      path: target,
      bytes: stat.size,
      createdAt: stat.mtime.toISOString(),
    };
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
   * Restoring means replacing the live database file, which cannot be done
   * safely while this process holds the connection open.
   */
  restore(file: string): never {
    this.resolve(file); // 400/404 for a bad name, before explaining
    throw new ValidationError(
      "Restore cannot run while the server is using the database. Stop the server, then copy " +
        `backups/${path.basename(file)} over the database file and start it again.`,
    );
  }
}
