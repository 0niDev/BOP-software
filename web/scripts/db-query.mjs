// READ-ONLY ad-hoc query runner for a SQLite Cloud database.
// Refuses anything that is not a single SELECT / WITH statement.
//
//   node scripts/db-query.mjs "<url>" "SELECT ..."

import { Database } from "@sqlitecloud/drivers";

const [url, query] = process.argv.slice(2);
if (!url || !query) {
  console.error("usage: node scripts/db-query.mjs <url> \"<select sql>\"");
  process.exit(1);
}
if (!/^\s*(select|with)\b/i.test(query)) {
  console.error("refusing: only SELECT/WITH queries are allowed by this tool.");
  process.exit(1);
}
if (/;\s*\S/.test(query)) {
  console.error("refusing: multiple statements.");
  process.exit(1);
}

const db = new Database(url);
const rows = await db.sql({ query, parameters: [] });
const list = Array.isArray(rows) ? rows : [];
if (!list.length) {
  console.log("(no rows)");
} else {
  const cols = Object.keys(list[0]);
  const widths = cols.map((c) => Math.max(c.length, ...list.map((r) => String(r[c] ?? "").length)));
  console.log("  " + cols.map((c, i) => c.padEnd(widths[i])).join("  "));
  console.log("  " + widths.map((w) => "-".repeat(w)).join("  "));
  for (const r of list) console.log("  " + cols.map((c, i) => String(r[c] ?? "").padEnd(widths[i])).join("  "));
  console.log(`(${list.length} rows)`);
}
await new Promise((r) => db.close(r));
