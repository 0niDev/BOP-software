// Price unpriced opening batches from what the item actually cost on a
// purchase invoice. Reads the latest purchase line for the item (by invoice
// date) and copies its unit cost onto the batch, which is exactly what
// receiving a purchase does. Dry run unless --apply is passed.
//
//   node scripts/price-batches.mjs                       (dry run, packing)
//   node scripts/price-batches.mjs --type FINISHED_GOOD  (dry run, finished goods)
//   node scripts/price-batches.mjs --apply
//
// Options: --db <path>  (default: ERP_LOCAL_DB from .env)

import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const apply = args.includes("--apply");
const itemType = flag("type", "PACKING_MATERIAL");

const envPath = new URL("../.env", import.meta.url).pathname;
let dbPath = flag("db", null);
if (!dbPath) {
  const line = readFileSync(envPath, "utf8")
    .split("\n")
    .find((l) => l.startsWith("ERP_LOCAL_DB="));
  dbPath = (line?.split("=")[1] ?? "").trim().replace(/^\.\//, "");
  dbPath = new URL(`../${dbPath}`, import.meta.url).pathname;
}

/** Zero-cost batches that still hold stock, with the item's latest purchase price. */
function plan(db, type) {
  const batches = db
    .prepare(
      `SELECT sb.id, sb.batch_number, sb.quantity_in_stock AS qty,
              sb.purchase_price, sb.raw_unit_cost, sb.packing_unit_cost,
              i.id AS item_id, i.item_code, i.item_name
         FROM stock_batches sb
         JOIN items i ON i.id = sb.item_id
        WHERE sb.is_active = 1 AND sb.quantity_in_stock > 0
          AND sb.purchase_price = 0
          AND (sb.raw_unit_cost + sb.packing_unit_cost) = 0
          AND i.item_type = ?
        ORDER BY i.item_name, sb.id`,
    )
    .all(type);

  const price = db.prepare(
    `SELECT pii.unit_cost AS cost, pi.invoice_number AS invoice, pi.invoice_date AS date
       FROM purchase_invoice_items pii
       JOIN purchase_invoices pi ON pi.id = pii.invoice_id
      WHERE pii.item_id = ? AND pii.unit_cost > 0
      ORDER BY date(pi.invoice_date) DESC, pii.id DESC
      LIMIT 1`,
  );

  // A made item has no purchase price: take what the production and packing
  // runs cost per unit instead.
  const made = db.prepare(
    `SELECT ROUND(SUM(cost) / NULLIF(SUM(qty), 0), 4) AS cost, SUM(runs) AS runs
       FROM (
         SELECT SUM(po.production_cost) AS cost, SUM(po.actual_quantity) AS qty, COUNT(*) AS runs
           FROM production_orders po
           JOIN bill_of_materials b ON b.id = po.bom_id
          WHERE b.finished_item_id = ? AND po.actual_quantity > 0 AND po.production_cost > 0
         UNION ALL
         SELECT SUM(po.production_cost), SUM(po.actual_quantity), COUNT(*)
           FROM packing_orders po
           JOIN bill_of_materials b ON b.id = po.bom_id
          WHERE b.finished_item_id = ? AND po.actual_quantity > 0 AND po.production_cost > 0
       )`,
  );

  return batches.map((batch) => {
    const bought = price.get(batch.item_id);
    if (bought) return { ...batch, price: { ...bought, source: "purchase" } };
    const run = made.get(batch.item_id, batch.item_id);
    if (run?.cost > 0) {
      return {
        ...batch,
        price: { cost: run.cost, invoice: `${run.runs} run(s)`, date: "production", source: "production" },
      };
    }
    return { ...batch, price: null };
  });
}

const db = new DatabaseSync(dbPath);
const rows = plan(db, itemType);

let priced = 0;
let pricedQty = 0;
let pricedValue = 0;
let unpriced = 0;
let unpricedQty = 0;

console.log(`${itemType} — unpriced batches holding stock (${rows.length})\n`);
for (const row of rows) {
  if (row.price) {
    priced += 1;
    pricedQty += row.qty;
    pricedValue += row.qty * row.price.cost;
    console.log(
      `  ${row.item_name.padEnd(45)} ${String(row.qty).padStart(6)} × ${String(row.price.cost).padStart(10)}` +
        ` = ${String(Math.round(row.qty * row.price.cost * 100) / 100).padStart(14)}` +
        `   (${row.price.invoice}, ${row.price.date})`,
    );
  } else {
    unpriced += 1;
    unpricedQty += row.qty;
    console.log(`  ${row.item_name.padEnd(45)} ${String(row.qty).padStart(6)} ×    —unpriced—   no purchase, no run`);
  }
}

console.log(
  `\n  priced    ${priced} batches, ${pricedQty} units, value ${Math.round(pricedValue * 100) / 100}`,
);
console.log(`  unpriced  ${unpriced} batches, ${unpricedQty} units (no purchase history)`);

if (!apply) {
  console.log("\ndry run — pass --apply to write these prices onto the batches.");
  db.close();
  process.exit(0);
}

db.exec("BEGIN");
const update = db.prepare("UPDATE stock_batches SET purchase_price = ? WHERE id = ?");
for (const row of rows) if (row.price) update.run(row.price.cost, row.id);
db.exec("COMMIT");
db.close();

// Verify on a fresh connection: the driver does not autocommit behind our back.
const check = new DatabaseSync(dbPath, { readOnly: true });
const applied = check
  .prepare(
    `SELECT COUNT(*) AS n, ROUND(SUM(sb.quantity_in_stock * sb.purchase_price), 2) AS value
       FROM stock_batches sb JOIN items i ON i.id = sb.item_id
      WHERE sb.quantity_in_stock > 0 AND sb.purchase_price > 0 AND i.item_type = ?`,
  )
  .get(itemType);
const left = check
  .prepare(
    `SELECT COUNT(*) AS n FROM stock_batches sb JOIN items i ON i.id = sb.item_id
      WHERE sb.quantity_in_stock > 0 AND sb.purchase_price = 0
        AND (sb.raw_unit_cost + sb.packing_unit_cost) = 0 AND i.item_type = ?`,
  )
  .get(itemType);
check.close();

console.log(`\ncommitted. priced batches now ${applied.n}, value ${applied.value}; still unpriced ${left.n}`);
