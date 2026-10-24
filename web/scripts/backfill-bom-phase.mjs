// BOM phase backfill — marks every BOM as FORMULATION or PACKING.
//
//   node scripts/backfill-bom-phase.mjs                 # every configured DB
//   node scripts/backfill-bom-phase.mjs <url-or-file>   # one DB
//
// Targets by default: SQLITE_CLOUD_URL (main), SQLITE_CLOUD_TESTDB_URL (testdb)
// and the local data/dev.sqlite. Pass any sqlitecloud:// URL or .sqlite path to
// run it against a database connected later. Idempotent: adds the `phase`
// column only when missing and fills only rows that are still NULL.
//
// Rule (same as manufacturingService.validateComponents): a BOM containing any
// RAW_MATERIAL is FORMULATION; everything else is PACKING.

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

const BACKFILL = `
UPDATE bill_of_materials
   SET phase = CASE
     WHEN EXISTS (
       SELECT 1 FROM bom_components c
         JOIN items i ON i.id = c.component_item_id
        WHERE c.bom_id = bill_of_materials.id AND i.item_type = 'RAW_MATERIAL'
     ) THEN 'FORMULATION'
     ELSE 'PACKING'
   END
 WHERE phase IS NULL`;

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
  const label = target.replace(/\/\/[^@]*@/, "//***@").replace(/apikey=[^&]+/, "apikey=***");
  try {
    try {
      await db.exec("ALTER TABLE bill_of_materials ADD COLUMN phase TEXT");
      console.log(`  added column phase`);
    } catch (err) {
      const msg = String(err?.message ?? err);
      if (!/duplicate column/i.test(msg)) throw err;
      console.log("  column phase already present");
    }

    await db.exec(BACKFILL);

    const summary = await db.all(
      "SELECT COALESCE(phase, 'NULL') AS phase, COUNT(*) AS n FROM bill_of_materials GROUP BY phase ORDER BY phase",
    );
    const rows = summary.map((r) => `${r.phase}=${r.n}`).join(", ") || "no BOMs";
    console.log(`  ${rows}`);
    const missing = Number(summary.find((r) => r.phase === "NULL")?.n ?? 0);
    if (missing > 0) {
      console.error(`  ERROR: ${missing} BOM(s) still unclassified`);
      process.exitCode = 1;
    }
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
