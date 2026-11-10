// Push the local SQLite database to SQLite Cloud (local-primary mode): the
// local file is the source of truth, so the cloud database is replaced
// wholesale inside one transaction. A failed or interrupted push leaves the
// previous cloud copy untouched.
//
// Used by `deploy/linux/update.sh --push`, or on its own:
//
//   node scripts/push-cloud.mjs                          # data/erp.sqlite -> SQLITE_CLOUD_URL
//   node scripts/push-cloud.mjs --dry-run                # build the script, send nothing
//   node scripts/push-cloud.mjs --db data/other.sqlite
//   node scripts/push-cloud.mjs --url sqlitecloud://… --db data/erp.sqlite
//
// Row counts are verified on the cloud side after the push; a mismatch fails.

import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Database } from "@sqlitecloud/drivers";
import {
  buildCountQuery,
  buildPushPlan,
  quoteIdent,
} from "../server/dist/services/replicaScript.js";

const webRoot = path.resolve(import.meta.dirname, "..");

function envValue(key) {
  const file = path.join(webRoot, ".env");
  if (!existsSync(file)) return "";
  const line = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .find((raw) => raw.trim().startsWith(`${key}=`));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : "";
}

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const flag = (name) => process.argv.includes(`--${name}`);

const mask = (url) => url.replace(/\/\/[^@]*@/, "//***@").replace(/apikey=[^&]+/, "apikey=***");
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "_");

const dbFile = path.resolve(
  webRoot,
  arg("db") || process.env.ERP_LOCAL_DB || envValue("ERP_LOCAL_DB") || "data/erp.sqlite",
);
const url = arg("url") || process.env.SQLITE_CLOUD_URL || envValue("SQLITE_CLOUD_URL");
const dryRun = flag("dry-run");

if (!url) {
  console.error("No SQLITE_CLOUD_URL (pass --url or set it in web/.env).");
  process.exit(1);
}
if (!existsSync(dbFile)) {
  console.error(`Local database not found: ${dbFile}`);
  process.exit(1);
}

console.log(`pushing ${dbFile} -> ${mask(url)}${dryRun ? " (dry run)" : ""}`);

const SCHEMA_SQL =
  "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'";

const tempDir = mkdtempSync(path.join(tmpdir(), "bop-push-"));
const snapshot = path.join(tempDir, `snapshot-${stamp()}.db`);

function readPlan(file) {
  const local = new DatabaseSync(file);
  try {
    const schema = local.prepare(SCHEMA_SQL).all();
    const tables = schema.filter((entry) => entry.type === "table").map((entry) => entry.name);
    const fkDeps = {};
    for (const table of tables) {
      const refs = local.prepare(`PRAGMA foreign_key_list(${quoteIdent(table)})`).all();
      fkDeps[table] = [...new Set(refs.map((fk) => fk.table))];
    }
    const data = {};
    for (const table of tables) {
      data[table] = local.prepare(`SELECT * FROM ${quoteIdent(table)}`).all();
    }
    return buildPushPlan(schema, data, fkDeps);
  } finally {
    local.close();
  }
}

function execAsync(db, sql) {
  return new Promise((resolve, reject) => {
    try {
      db.exec(sql, (err) => (err ? reject(err) : resolve()));
    } catch (err) {
      reject(err);
    }
  });
}

function sqlAsync(db, sql) {
  return db.sql({ query: sql, parameters: [] });
}

function closeAsync(db) {
  return new Promise((resolve) => {
    try {
      db.close(() => resolve());
    } catch {
      resolve();
    }
  });
}

let plan;
try {
  // One consistent point-in-time snapshot even if the file is in WAL mode.
  const local = new DatabaseSync(dbFile);
  try {
    local.exec(`VACUUM INTO '${snapshot.replace(/'/g, "''")}'`);
  } finally {
    local.close();
  }
  plan = readPlan(snapshot);
} catch (err) {
  rmSync(tempDir, { recursive: true, force: true });
  console.error(`could not read ${dbFile}: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

try {
  console.log(
    `  ${plan.tables} tables, ${plan.rows} rows, ${(plan.bytes / 1024).toFixed(0)} KB in ` +
      `${plan.chunks.length} chunk(s), snapshot ${(statSync(snapshot).size / 1024).toFixed(0)} KB`,
  );
  if (dryRun) {
    console.log("dry run: nothing sent");
    process.exit(0);
  }

  const started = Date.now();
  const cloud = new Database(url);
  try {
    for (const chunk of plan.chunks) await execAsync(cloud, chunk);
    const tables = Object.keys(plan.counts);
    if (tables.length > 0) {
      const rows = await sqlAsync(cloud, buildCountQuery(tables));
      const actual = rows[0] ?? {};
      for (const [table, expected] of Object.entries(plan.counts)) {
        const got = Number(actual[table] ?? -1);
        if (got !== expected) {
          throw new Error(`Cloud table '${table}' has ${got} rows, expected ${expected}.`);
        }
      }
    }
    console.log(
      `pushed ${plan.rows} rows to SQLite Cloud in ${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
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
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
