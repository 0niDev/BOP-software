// Dump the tables the cleanup scripts touch, before they touch them.
//
//   node scripts/snapshot-db.mjs                    # testdb -> backups/testdb-<ts>/
//   node scripts/snapshot-db.mjs --allow-main       # main   -> backups/main-<ts>/
//   node scripts/snapshot-db.mjs --url data/e2e.sqlite --out /tmp/snap
//
// One NDJSON file per table plus manifest.json with row counts. Restore is
// manual; this is the undo record, not a restore tool.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const webRoot = path.resolve(import.meta.dirname, "..");

const TABLES = [
  "bill_of_materials",
  "bom_components",
  "production_orders",
  "production_consumption",
  "packing_orders",
  "packing_consumption",
  "journal_entries",
  "journal_entry_lines",
  "stock_batches",
  "stock_movements",
  "items",
  "numbering_sequences",
];

function envValue(key) {
  const file = path.join(webRoot, ".env");
  if (!existsSync(file)) return "";
  const line = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .find((raw) => raw.trim().startsWith(`${key}=`));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : "";
}

const mask = (url) =>
  url.replace(/\/\/[^@]*@/, "//***@").replace(/apikey=[^&]+/, "apikey=***");

async function connect(target) {
  if (target.startsWith("sqlitecloud://")) {
    const { Database } = await import("@sqlitecloud/drivers");
    const db = new Database(target);
    return {
      all: async (sql) => {
        const out = await db.sql(sql);
        return Array.isArray(out) ? out : [];
      },
      close: async () => {},
    };
  }
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(target);
  return {
    all: async (sql) => db.prepare(sql).all(),
    close: async () => db.close(),
  };
}

const args = process.argv.slice(2);
const allowMain = args.includes("--allow-main");
const urlFlag = args.indexOf("--url");
const outFlag = args.indexOf("--out");
const explicit = urlFlag >= 0 ? args[urlFlag + 1] : null;

const main = process.env.SQLITE_CLOUD_URL || envValue("SQLITE_CLOUD_URL");
const testdb = process.env.SQLITE_CLOUD_TESTDB_URL || envValue("SQLITE_CLOUD_TESTDB_URL");
const target = explicit || (args.includes("--main") ? main : testdb);

if (!target) {
  console.error("No target: set SQLITE_CLOUD_TESTDB_URL in web/.env or pass --url.");
  process.exit(1);
}
if (main && target === main && !allowMain) {
  console.error("Target is SQLITE_CLOUD_URL (main). Pass --allow-main to override.");
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const label = main && target === main ? "main" : "testdb";
const outDir = path.resolve(
  outFlag >= 0 ? args[outFlag + 1] : path.join(webRoot, "backups", `${label}-${stamp}`),
);
mkdirSync(outDir, { recursive: true });

console.log(`SNAPSHOT — ${mask(target)}`);
console.log(`  out: ${outDir}`);

const db = await connect(target);
try {
  const existing = new Set(
    (await db.all("SELECT name FROM sqlite_master WHERE type = 'table'")).map((r) => r.name),
  );
  const manifest = { source: mask(target), takenAt: new Date().toISOString(), tables: {} };
  for (const table of TABLES) {
    if (!existing.has(table)) {
      console.log(`  ${table}: missing, skipped`);
      continue;
    }
    const rows = await db.all(`SELECT * FROM ${table}`);
    writeFileSync(
      path.join(outDir, `${table}.ndjson`),
      rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""),
    );
    manifest.tables[table] = rows.length;
    console.log(`  ${table}: ${rows.length} rows`);
  }
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log("  done.");
} catch (err) {
  console.error(`  FAILED: ${err?.message ?? err}`);
  process.exitCode = 1;
} finally {
  await db.close();
}

process.exit(process.exitCode ?? 0);
