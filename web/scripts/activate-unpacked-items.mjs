// Activate finished goods that received unpacked production output.
//
//   node scripts/activate-unpacked-items.mjs                 # every configured DB
//   node scripts/activate-unpacked-items.mjs <url-or-file>   # one DB
//
// Targets by default: the local data/dev.sqlite, SQLITE_CLOUD_URL (main) and
// SQLITE_CLOUD_TESTDB_URL (testdb), matching scripts/backfill-bom-phase.mjs.
//
// Rule: an item is touched only when it owns an UNPACKED- batch — i.e. stock
// was produced through the unpacked stage. Those items become active and get
// the "(unpacked) " prefix on their name. Every other row is left alone.
// Idempotent: a second run reports zero changes.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const webRoot = path.resolve(import.meta.dirname, "..");

function envValue(key) {
  const file = path.join(webRoot, ".env");
  if (!existsSync(file)) return "";
  const line = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .find((raw) => raw.trim().startsWith(`${key}=`));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : "";
}

const AFFECTED = `
  SELECT i.id, i.item_name, i.is_active
    FROM items i
   WHERE i.id IN (SELECT DISTINCT item_id FROM stock_batches WHERE batch_number LIKE 'UNPACKED-%')
     AND (i.is_active = 0 OR i.item_name NOT LIKE '(unpacked) %')
   ORDER BY i.id`;

const ACTIVATE = `
UPDATE items
   SET is_active = 1,
       item_name = CASE
         WHEN item_name LIKE '(unpacked) %' THEN item_name
         ELSE '(unpacked) ' || item_name
       END
 WHERE id IN (SELECT DISTINCT item_id FROM stock_batches WHERE batch_number LIKE 'UNPACKED-%')
   AND (is_active = 0 OR item_name NOT LIKE '(unpacked) %')`;

async function targets() {
  const args = process.argv.slice(2);
  if (args.length > 0) return args;
  const list = [];
  const dev = path.join(webRoot, "data/dev.sqlite");
  if (existsSync(dev)) list.push(dev);
  const main = process.env.SQLITE_CLOUD_URL || envValue("SQLITE_CLOUD_URL");
  if (main) list.push(main);
  const testdb = process.env.SQLITE_CLOUD_TESTDB_URL || envValue("SQLITE_CLOUD_TESTDB_URL");
  if (testdb) list.push(testdb);
  return list;
}

/** Minimal SQLite facade over either the cloud driver or the local node:sqlite. */
async function connect(target) {
  if (target.startsWith("sqlitecloud://")) {
    const { Database } = await import("@sqlitecloud/drivers");
    const db = new Database(target);
    return {
      all: (sql) => db.sql(sql),
      exec: (sql) => db.sql(sql),
      close: async () => {},
    };
  }
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(target);
  return {
    all: (sql) => db.prepare(sql).all(),
    exec: (sql) => db.exec(sql),
    close: async () => db.close(),
  };
}

async function migrate(target) {
  const db = await connect(target);
  try {
    const rows = await db.all(AFFECTED);
    if (rows.length === 0) {
      console.log("  nothing to change (already done)");
      return;
    }
    await db.exec(ACTIVATE);
    for (const row of rows) {
      console.log(
        `  ${row.id}: "${row.item_name}" (is_active=${row.is_active}) -> active, prefixed`,
      );
    }
    console.log(`  ${rows.length} item(s) activated`);
  } finally {
    await db.close();
  }
}

const list = await targets();
if (list.length === 0) {
  console.error("No database targets. Set SQLITE_CLOUD_URL / SQLITE_CLOUD_TESTDB_URL or pass a URL/path.");
  process.exit(1);
}

for (const target of list) {
  console.log(`\n${target.startsWith("sqlitecloud://") ? "cloud" : "local"}: ${target.replace(/apikey=[^&]+/, "apikey=***")}`);
  try {
    await migrate(target);
  } catch (err) {
    console.error(`  FAILED: ${err?.message ?? err}`);
    process.exitCode = 1;
  }
}

// The cloud driver keeps sockets open; exit once every target is done.
process.exit(process.exitCode ?? 0);
