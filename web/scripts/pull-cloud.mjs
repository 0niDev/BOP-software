// One-time cutover: pull the SQLite Cloud database into a local SQLite file so
// the app can switch to local-primary mode (see DEPLOYMENT.md, "Local-primary
// mode"). Read-only against the cloud.
//
//   node scripts/pull-cloud.mjs                       # -> data/erp.sqlite.pull
//   node scripts/pull-cloud.mjs --out data/erp.sqlite # overwrite the live file
//   node scripts/pull-cloud.mjs --url sqlitecloud://… --out /tmp/erp.db
//
// Prints per-table row counts so they can be compared with the cloud.

import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Database } from "@sqlitecloud/drivers";

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

const mask = (url) => url.replace(/\/\/[^@]*@/, "//***@").replace(/apikey=[^&]+/, "apikey=***");

const url = arg("url") || process.env.SQLITE_CLOUD_URL || envValue("SQLITE_CLOUD_URL");
if (!url) {
  console.error("No SQLITE_CLOUD_URL (pass --url or set it in web/.env).");
  process.exit(1);
}

const out = path.resolve(webRoot, arg("out") || "data/erp.sqlite.pull");
if (existsSync(out) && !arg("out")) {
  console.error(`${out} already exists; pass --out to choose a target (the live file is not overwritten).`);
  process.exit(1);
}

console.log(`pulling from ${mask(url)}`);
const cloud = new Database(url);
const sql = (query) => cloud.sql({ query, parameters: [] });

/** node:sqlite accepts primitives and byte arrays; never coerce silently. */
function bindable(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") return value;
  if (value instanceof Uint8Array) return value;
  throw new Error(`Unsupported value type in pull: ${Object.prototype.toString.call(value)}`);
}

// One read transaction: a single point in time, not a mix of table moments.
await sql("BEGIN");
const schema = (await sql(
  "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'",
)).map((r) => ({ type: r.type, name: r.name, sql: r.sql }));
const tables = schema.filter((e) => e.type === "table").map((e) => e.name);
const sequences = await sql("SELECT name, seq FROM sqlite_sequence").catch(() => []);
const sequenceRows = Array.isArray(sequences) ? sequences : [];

const data = {};
for (const table of tables) {
  const t0 = Date.now();
  data[table] = await sql(`SELECT * FROM "${table.replace(/"/g, '""')}"`);
  console.log(`  ${table}: ${data[table].length} rows (${Date.now() - t0} ms)`);
}
await sql("ROLLBACK");

console.log(`writing ${out}`);
const local = new DatabaseSync(out);
try {
  local.exec("PRAGMA foreign_keys = OFF");
  local.exec("BEGIN");
  for (const entry of schema.filter((e) => e.type === "table")) local.exec(entry.sql);
  for (const [table, rows] of Object.entries(data)) {
    if (rows.length === 0) continue;
    const columns = Object.keys(rows[0]);
    const stmt = local.prepare(
      `INSERT INTO "${table.replace(/"/g, '""')}" (${columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(", ")}) ` +
        `VALUES (${columns.map(() => "?").join(", ")})`,
    );
    for (const row of rows) stmt.run(...columns.map((c) => bindable(row[c])));
  }
  for (const entry of schema.filter((e) => e.type !== "table")) local.exec(entry.sql);
  const seq = local.prepare("INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (?, ?)");
  for (const s of sequenceRows) seq.run(String(s.name), Number(s.seq ?? 0));
  local.exec("COMMIT");
} catch (err) {
  try {
    local.exec("ROLLBACK");
  } catch {}
  local.close();
  rmSync(out, { force: true });
  throw err;
}
local.close();
await new Promise((r) => cloud.close(r));

const check = new DatabaseSync(out);
const integrity = Object.values(check.prepare("PRAGMA integrity_check").get() ?? {})[0];
let counts = 0;
for (const table of tables) counts += Number(check.prepare(`SELECT COUNT(*) AS n FROM "${table.replace(/"/g, '""')}"`).get().n);
check.close();
console.log(`integrity_check: ${integrity}`);
console.log(`tables: ${tables.length}, rows: ${counts}, bytes: ${statSync(out).size}`);
if (integrity !== "ok") {
  console.error("Snapshot failed its integrity check; delete the file and retry.");
  process.exit(1);
}
if (counts !== Object.values(data).reduce((s, r) => s + r.length, 0)) {
  console.error("Row counts do not match what was read from the cloud; delete the file and retry.");
  process.exit(1);
}
console.log("done. Point ERP_LOCAL_DB at this file and set ERP_DB_ENGINE=local to cut over.");
