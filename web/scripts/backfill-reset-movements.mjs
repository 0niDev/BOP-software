// Backfill the ADJUSTMENT stock movements that a stock-ledger reset should have
// written but the first version of the feature did not.
//
// Zeroing a batch only changed `stock_batches.quantity_in_stock`, so on-hand and
// SUM(stock_movements) stopped agreeing. This writes one negative ADJUSTMENT per
// reset line, dated now, so the movement ledger matches the batch ledger again.
//
//   node scripts/backfill-reset-movements.mjs "<url>" [--reset <id>] [--apply]
//
// Dry run unless --apply is given.

import { Database } from "@sqlitecloud/drivers";

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith("--") && a !== "apply" && !/^\d+$/.test(a));
const apply = args.includes("--apply");
const resetFlag = args.indexOf("--reset");
const resetArg = resetFlag >= 0 ? Number(args[resetFlag + 1]) : null;

if (!url) {
  console.error('usage: node scripts/backfill-reset-movements.mjs "<url>" [--reset <id>] [--apply]');
  process.exit(1);
}

const db = new Database(url);
const sql = (query, parameters = []) => db.sql({ query, parameters });

function table(rows) {
  if (!rows.length) return console.log("  (no rows)");
  const cols = Object.keys(rows[0]);
  const widths = cols.map((c) =>
    Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)),
  );
  console.log("  " + cols.map((c, i) => c.padEnd(widths[i])).join("  "));
  console.log("  " + widths.map((w) => "-".repeat(w)).join("  "));
  for (const r of rows)
    console.log("  " + cols.map((c, i) => String(r[c] ?? "").padEnd(widths[i])).join("  "));
}

const reset = resetArg
  ? (await sql("SELECT * FROM stock_ledger_resets WHERE id = ?", [resetArg]))[0]
  : (await sql("SELECT * FROM stock_ledger_resets ORDER BY id DESC LIMIT 1"))[0];

if (!reset) {
  console.error("no stock ledger reset found");
  process.exit(1);
}
console.log(
  `reset #${reset.id} "${reset.reason ?? ""}" — ${reset.batch_count} batches, ` +
    `${reset.total_quantity} units, created ${reset.created_at}` +
    (reset.restored_at ? ` (RESTORED ${reset.restored_at})` : ""),
);

const lines = await sql(
  `SELECT l.batch_id, l.item_id, l.quantity, l.unit_cost, sb.warehouse_id
     FROM stock_ledger_reset_lines l
     JOIN stock_batches sb ON sb.id = l.batch_id
    WHERE l.reset_id = ?
    ORDER BY l.id`,
  [reset.id],
);
const written = await sql(
  `SELECT batch_id, SUM(quantity) AS quantity
     FROM stock_movements
    WHERE reference_table = 'stock_ledger_resets' AND reference_id = ?
    GROUP BY batch_id`,
  [reset.id],
);
const already = new Map(written.map((r) => [Number(r.batch_id), Number(r.quantity)]));

const todo = [];
let units = 0;
let value = 0;
for (const line of lines) {
  // A restored reset already has its +q row, so only the missing part is written.
  const need = -Number(line.quantity) - (already.get(Number(line.batch_id)) ?? 0);
  if (Math.abs(need) < 1e-9) continue;
  todo.push({ line, need });
  units += need;
  value += need * Number(line.unit_cost);
}

console.log(`\nmissing movement rows: ${todo.length} of ${lines.length}`);
if (todo.length) {
  table(
    todo.slice(0, 10).map(({ line, need }) => ({
      batch_id: line.batch_id,
      item_id: line.item_id,
      quantity: round(need),
      unit_cost: line.unit_cost,
    })),
  );
  if (todo.length > 10) console.log(`  … and ${todo.length - 10} more`);
}
console.log(`total quantity to offset: ${round(units)}, value ${round(value)}`);
table(
  await sql(
    `SELECT ROUND(SUM(q), 2) AS movement_qty
       FROM (SELECT SUM(quantity) AS q FROM stock_movements GROUP BY item_id)`,
  ),
);

if (!apply) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply to insert the movements.");
  await new Promise((r) => db.close(r));
  process.exit(0);
}

// The driver does not autocommit on this connection: writes only survive if the
// transaction is closed explicitly. Verify afterwards on a *new* connection —
// reading back on the same one would show uncommitted rows and prove nothing.
await sql("BEGIN");
try {
  for (const { line, need } of todo) {
    await sql(
      `INSERT INTO stock_movements
         (item_id, batch_id, warehouse_id, movement_type, quantity, unit_cost,
          reference_table, reference_id, notes)
       VALUES (?, ?, ?, 'ADJUSTMENT', ?, ?, 'stock_ledger_resets', ?, ?)`,
      [
        line.item_id,
        line.batch_id,
        line.warehouse_id,
        round(need),
        line.unit_cost,
        reset.id,
        `Stock ledger zeroed (reset #${reset.id}) — backfilled`,
      ],
    );
  }
  await sql("COMMIT");
} catch (err) {
  await sql("ROLLBACK");
  throw err;
}
console.log(`\ncommitted ${todo.length} ADJUSTMENT rows for reset #${reset.id}.`);
await new Promise((r) => db.close(r));

// Fresh connection: only committed rows are visible here.
const checkDb = new Database(url);
const check = await checkDb.sql({
  query: `SELECT ROUND(SUM(batch_qty), 2) AS batch_qty,
                 ROUND(SUM(mov_qty), 2) AS movement_qty,
                 SUM(CASE WHEN ABS(batch_qty - mov_qty) > 0.0001 THEN 1 ELSE 0 END) AS mismatched_items
            FROM (SELECT i.id,
                         COALESCE(b.qty, 0) AS batch_qty,
                         COALESCE(m.qty, 0) AS mov_qty
                    FROM items i
                    LEFT JOIN (SELECT item_id, SUM(quantity_in_stock) AS qty FROM stock_batches
                                WHERE is_active = 1 GROUP BY item_id) b ON b.item_id = i.id
                    LEFT JOIN (SELECT item_id, SUM(quantity) AS qty FROM stock_movements
                                GROUP BY item_id) m ON m.item_id = i.id)`,
  parameters: [],
});
table(check);
const adjustments = await checkDb.sql({
  query: "SELECT COUNT(*) AS rows FROM stock_movements WHERE reference_table = 'stock_ledger_resets' AND reference_id = ?",
  parameters: [reset.id],
});
table(adjustments);
await new Promise((r) => checkDb.close(r));

function round(n) {
  return Math.round(n * 1e6) / 1e6;
}
