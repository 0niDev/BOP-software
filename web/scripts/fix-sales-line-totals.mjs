// Fix corrupt sales_invoice_items.line_total values (grouped-by-item sums
// written instead of per-row qty*price-disc+tax by the legacy import).
//
//   node scripts/fix-sales-line-totals.mjs data/fix-fixed-2026-11-11.db        # dry-run
//   node scripts/fix-sales-line-totals.mjs data/fix-fixed-2026-11-11.db --apply
//   node scripts/fix-sales-line-totals.mjs "sqlitecloud://...?apikey=..." --apply
//
// A SQLite Cloud database whose name contains a space cannot be put in the URL
// (the driver looks it up literally), so connect without a database and name it:
//   node scripts/fix-sales-line-totals.mjs "sqlitecloud://host:8860?apikey=..." \
//     --database "sales report" --apply
//
// Dry-run shows every row it would change. --apply recomputes
// line_total = quantity*unit_price - discount_amount + tax_amount for the bad
// rows only, then verifies SUM(lines) == invoice header total for every invoice.

import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const target = process.argv[2];
const apply = process.argv.includes("--apply");
const databaseIndex = process.argv.indexOf("--database");
const database = databaseIndex > -1 ? process.argv[databaseIndex + 1] : undefined;
if (!target) {
  console.error(
    "usage: node scripts/fix-sales-line-totals.mjs <db-file | sqlitecloud://url> [--database <name>] [--apply]",
  );
  process.exit(1);
}

const isCloud = target.startsWith("sqlitecloud://");
const db = isCloud
  ? new (require("@sqlitecloud/drivers").Database)(target)
  : new (require("node:sqlite").DatabaseSync)(path.resolve(import.meta.dirname, "..", target));
if (isCloud && database) {
  await db.sql({ query: `USE DATABASE "${database.replace(/"/g, '""')}"`, parameters: [] });
}
const sql = (q, p = []) => (isCloud ? db.sql({ query: q, parameters: p }) : db.prepare(q).all(...p));
const run = (q, p = []) => (isCloud ? db.sql({ query: q, parameters: p }) : db.prepare(q).run(...p));

const FIND = `
  SELECT id, invoice_id, quantity, unit_price, discount_amount, tax_amount, line_total
  FROM sales_invoice_items
  WHERE line_total != quantity*unit_price - discount_amount + tax_amount
  ORDER BY invoice_id, id`;

const bad = await sql(FIND);
console.log(`found ${bad.length} bad line rows in ${isCloud ? "cloud db" : target}`);
if (bad.length === 0) {
  db.close?.();
  process.exit(0);
}

for (const r of bad) {
  const fixed = r.quantity * r.unit_price - r.discount_amount + r.tax_amount;
  console.log(`  line ${r.id} (invoice ${r.invoice_id}): ${r.line_total} -> ${fixed}`);
}

if (!apply) {
  console.log("dry-run only; re-run with --apply to fix");
} else {
  for (const r of bad) {
    const fixed = r.quantity * r.unit_price - r.discount_amount + r.tax_amount;
    await run("UPDATE sales_invoice_items SET line_total = ? WHERE id = ?", [fixed, r.id]);
  }
  console.log(`updated ${bad.length} rows`);

  const mismatches = await sql(`
    SELECT si.id, ROUND(si.total_amount,2) header,
           ROUND((SELECT SUM(line_total) FROM sales_invoice_items WHERE invoice_id=si.id),2) lines
    FROM sales_invoices si
    WHERE (SELECT SUM(line_total) FROM sales_invoice_items WHERE invoice_id=si.id) != si.total_amount`);
  if (mismatches.length === 0) {
    console.log("verify OK: every invoice's lines now sum to its header total");
  } else {
    console.table(mismatches);
    process.exitCode = 1;
  }
}
db.close?.();
