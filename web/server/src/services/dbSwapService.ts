/**
 * Validation for a database file uploaded through Settings → Database.
 *
 * A hot-swap replaces the live connection, so the file has to be inspected
 * *before* anything is touched: a corrupt file or an unrelated SQLite file
 * must leave the running database alone. The upload is written to a temp
 * folder, checked with `PRAGMA integrity_check`, and confirmed to have the
 * core BOP ERP tables. The caller copies the validated temp file into place.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ValidationError } from "../domain/errors.js";

/** The 16-byte header every SQLite database starts with. */
const SQLITE_MAGIC = Buffer.from("SQLite format 3\0", "latin1");

/** Tables a BOP ERP database must have; a stray SQLite file will not. */
const REQUIRED_TABLES = ["users", "accounts", "journal_entries", "settings"] as const;

/**
 * Write `bytes` to a fresh temp file and verify it is a healthy BOP ERP
 * database. Returns the temp file path (owned by the caller) or throws a
 * `ValidationError` after cleaning up.
 */
export function validateUploadedDatabase(bytes: Buffer): string {
  if (bytes.length < 100 || !bytes.subarray(0, SQLITE_MAGIC.length).equals(SQLITE_MAGIC)) {
    throw new ValidationError("That file is not a SQLite database (.db).");
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bop-dbswap-"));
  const file = path.join(dir, "upload.db");
  fs.writeFileSync(file, bytes);

  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(file);
    const check = db.prepare("PRAGMA integrity_check").get() as
      | Record<string, unknown>
      | undefined;
    const result = String(Object.values(check ?? {})[0] ?? "");
    if (result !== "ok") {
      throw new ValidationError(`Database integrity check failed: ${result || "no result"}.`);
    }
    const tables = new Set(
      (
        db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{
          name: string;
        }>
      ).map((row) => row.name),
    );
    const missing = REQUIRED_TABLES.filter((table) => !tables.has(table));
    if (missing.length > 0) {
      throw new ValidationError(
        `That database is missing expected tables (${missing.join(", ")}). ` +
          "Is it a BOP ERP database?",
      );
    }
    return file;
  } catch (err) {
    fs.rmSync(dir, { recursive: true, force: true });
    if (err instanceof ValidationError) throw err;
    throw new ValidationError(`Could not read that database: ${(err as Error).message}`);
  } finally {
    if (db) db.close();
  }
}

/** Remove the temp folder returned by `validateUploadedDatabase`. */
export function discardUploadedDatabase(file: string): void {
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
}
