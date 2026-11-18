import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { ValidationError } from "../src/domain/errors.js";
import {
  discardUploadedDatabase,
  validateUploadedDatabase,
} from "../src/services/dbSwapService.js";

const REQUIRED = ["users", "accounts", "journal_entries", "settings"];

/** A real SQLite file with the given tables, returned as bytes. */
function makeDb(tables: string[]): Buffer {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bop-dbtest-"));
  const file = path.join(dir, "sample.db");
  const db = new DatabaseSync(file);
  for (const table of tables) db.exec(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY)`);
  db.close();
  const bytes = fs.readFileSync(file);
  fs.rmSync(dir, { recursive: true, force: true });
  return bytes;
}

describe("validateUploadedDatabase", () => {
  const temps: string[] = [];
  afterEach(() => {
    for (const file of temps.splice(0)) discardUploadedDatabase(file);
  });

  it("accepts a BOP database and returns a readable temp copy", () => {
    const file = validateUploadedDatabase(makeDb(REQUIRED));
    temps.push(file);
    expect(fs.existsSync(file)).toBe(true);
    const db = new DatabaseSync(file);
    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{
        name: string;
      }>
    ).map((row) => row.name);
    db.close();
    expect(tables).toEqual([...REQUIRED].sort());
  });

  it("rejects a file that is not SQLite at all", () => {
    expect(() => validateUploadedDatabase(Buffer.from("definitely not a database"))).toThrow(
      ValidationError,
    );
  });

  it("rejects a SQLite file missing the BOP tables", () => {
    expect(() => validateUploadedDatabase(makeDb(["users"]))).toThrow(
      /missing expected tables/,
    );
  });
});
