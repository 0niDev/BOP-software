import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigurationError, NotFoundError, ValidationError } from "../src/domain/errors.js";
import { BackupService } from "../src/services/backupService.js";
import { closeDb, freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let dir: string;
let backups: BackupService;

beforeEach(async () => {
  ctx = await freshDb();
  dir = mkdtempSync(path.join(tmpdir(), "bop-backup-"));
  backups = new BackupService(ctx.db, "local", dir);
});
afterEach(async () => {
  await closeDb(ctx.db);
  rmSync(dir, { recursive: true, force: true });
});

describe("BackupService", () => {
  it("starts with an empty backup directory", async () => {
    const status = await backups.status();
    expect(status.supported).toBe(true);
    expect(status.engine).toBe("local");
    expect(status.count).toBe(0);
    expect(status.latest).toBeNull();
    expect(status.backups).toEqual([]);
  });

  it("writes a snapshot that is a real, readable SQLite file", async () => {
    const result = await backups.run();
    expect(result.file).toMatch(/^erp_backup_\d{8}_\d{6}\.db$/);
    expect(existsSync(result.path)).toBe(true);
    expect(result.bytes).toBeGreaterThan(0);
    // A SQLite database starts with the 16-byte header magic.
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(result.path).subarray(0, 15).toString()).toBe("SQLite format 3");

    const status = await backups.status();
    expect(status.count).toBe(1);
    expect(status.latest).toBe(result.file);
    expect(status.totalBytes).toBe(result.bytes);

    // The snapshot carries the seeded chart of accounts.
    const { DatabaseSync } = await import("node:sqlite");
    const snapshot = new DatabaseSync(result.path);
    const row = snapshot.prepare("SELECT COUNT(*) AS count FROM accounts").get() as {
      count: number;
    };
    snapshot.close();
    expect(row.count).toBeGreaterThan(20);
  });

  it("lists newest first and resolves files safely", async () => {
    const first = await backups.run();
    await new Promise((resolve) => setTimeout(resolve, 1100)); // distinct timestamps
    const second = await backups.run();

    const status = await backups.status();
    expect(status.count).toBe(2);
    expect(status.latest).toBe(second.file);
    expect(status.backups.map((entry) => entry.file)).toContain(first.file);

    expect(backups.resolve(second.file)).toBe(second.path);
    expect(() => backups.resolve("../../etc/passwd")).toThrow(ValidationError);
    expect(() => backups.resolve("not-a-backup.txt")).toThrow(ValidationError);
    expect(() => backups.resolve("erp_backup_20260101_000000.db")).toThrow(NotFoundError);
  });

  it("refuses to restore while the server is using the database", async () => {
    const result = await backups.run();
    expect(() => backups.restore(result.file)).toThrow(ValidationError);
    expect(() => backups.restore(result.file)).toThrow(/Stop the server/);
  });

  it("refuses snapshots entirely on the hosted database", async () => {
    const cloud = new BackupService(ctx.db, "sqlitecloud", dir);
    await expect(cloud.run()).rejects.toBeInstanceOf(ConfigurationError);
    const status = await cloud.status();
    expect(status.supported).toBe(false);
    expect(status.engine).toBe("sqlitecloud");
  });
});
