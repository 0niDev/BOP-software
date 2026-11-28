// Rebuild inventory from what actually moved: everything purchased, less
// everything consumed, with nothing invented in between.
//
//   npm -w @bop-erp/server run rebuild:inventory              # dry run + CSV
//   npm -w @bop-erp/server run rebuild:inventory -- --cutover 2026-11-01
//
// Two proposals per item, side by side with what the batches say today:
//
//   purchased − consumed                    (no opening stock at all)
//   opening at cutover + purchased − consumed
//
// "Consumed" is production + packing + sold − sales returned. Purchase returns
// come off the purchases. Manual stock corrections and adjustments are
// deliberately NOT an input: they are what we are trying to measure, and the
// report prints how much of today's figure they moved.
//
// Read-only. Writes a CSV you can review line by line before anything is posted.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const cutoverArg = args.indexOf("--cutover");
const cutover = cutoverArg >= 0 ? args[cutoverArg + 1]! : "2026-11-01";
const outArg = args.indexOf("--out");
const defaultDir = fileURLToPath(new URL("../../data/", import.meta.url));
const outPath = resolve(
  outArg >= 0 ? args[outArg + 1]! : `${defaultDir}inventory-rebuild-${new Date().toISOString().slice(0, 10)}.csv`,
);

type Row = {
  item_id: number;
  item_code: string;
  item_name: string;
  item_type: string;
  unit: string;
  purchased: number;
  purchase_returns: number;
  produced: number;
  packed: number;
  output: number;
  sold: number;
  sales_returned: number;
  opening: number;
  current: number;
  adjustments: number;
  unit_cost: number;
};

const round4 = (n: number): number => Math.round(n * 10000) / 10000;
const money = (n: number): string => n.toFixed(2);
const qty = (n: number): string => round4(n).toString();

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main(): Promise<void> {
  const { getDb, closeDb } = await import("./db/index.js");
  const { env } = await import("./env.js");

  const db = getDb();
  console.log(`inventory rebuild — engine=${env.dbEngine} company=${env.companyId} cutover=${cutover}`);

  const rows = await db.all<Row>(
    `SELECT i.id item_id, i.item_code, i.item_name, i.item_type, i.unit,
            COALESCE(p.qty, 0) purchased,
            COALESCE(pr.qty, 0) purchase_returns,
            COALESCE(c.prod, 0) produced,
            COALESCE(c.pack, 0) packed,
            COALESCE(out.qty, 0) output,
            COALESCE(s.qty, 0) sold,
            COALESCE(sr.qty, 0) sales_returned,
            COALESCE(o.qty, 0) opening,
            COALESCE(b.qty, 0) current,
            COALESCE(a.qty, 0) adjustments,
            COALESCE(pc.cost, i.purchase_price, 0) unit_cost
       FROM items i
       LEFT JOIN (
            SELECT pii.item_id, SUM(pii.quantity) qty
              FROM purchase_invoice_items pii
              JOIN purchase_invoices pi ON pi.id = pii.invoice_id
             WHERE pi.status = 'CONFIRMED'
             GROUP BY pii.item_id
       ) p ON p.item_id = i.id
       LEFT JOIN (
            SELECT pri.item_id, SUM(pri.quantity) qty
              FROM purchase_return_items pri
             GROUP BY pri.item_id
       ) pr ON pr.item_id = i.id
       LEFT JOIN (
            SELECT item_id, SUM(prod) prod, SUM(pack) pack FROM (
                 SELECT component_item_id item_id, quantity_consumed prod, 0 pack FROM production_consumption
                 UNION ALL
                 SELECT component_item_id item_id, 0 prod, quantity_consumed pack FROM packing_consumption
            ) GROUP BY item_id
       ) c ON c.item_id = i.id
       -- What the factory produced of this item: production and packing output.
       LEFT JOIN (
            SELECT finished_item_id item_id, SUM(qty) qty FROM (
                 SELECT b.finished_item_id, po.actual_quantity qty
                   FROM production_orders po
                   JOIN bill_of_materials b ON b.id = po.bom_id
                  WHERE po.status = 'COMPLETED' AND po.actual_quantity > 0 AND po.is_ghost = 0
                 UNION ALL
                 SELECT b.finished_item_id, pk.actual_quantity qty
                   FROM packing_orders pk
                   JOIN bill_of_materials b ON b.id = pk.bom_id
                  WHERE pk.status = 'COMPLETED' AND pk.actual_quantity > 0
            ) GROUP BY item_id
       ) out ON out.item_id = i.id
       LEFT JOIN (
            SELECT sii.item_id, SUM(sii.quantity) qty
              FROM sales_invoice_items sii
              JOIN sales_invoices si ON si.id = sii.invoice_id
             WHERE si.status = 'CONFIRMED'
             GROUP BY sii.item_id
       ) s ON s.item_id = i.id
       LEFT JOIN (
            SELECT sri.item_id, SUM(sri.quantity) qty
              FROM sales_return_items sri
             GROUP BY sri.item_id
       ) sr ON sr.item_id = i.id
       -- Stock on hand at the cutover, from the movement ledger, so items that
       -- arrived before the cutover are not counted as "never purchased".
       LEFT JOIN (
            SELECT item_id, SUM(quantity) qty
              FROM stock_movements
             WHERE movement_date < ?
             GROUP BY item_id
       ) o ON o.item_id = i.id
       LEFT JOIN (
            SELECT item_id, SUM(quantity) qty FROM stock_movements GROUP BY item_id
       ) b ON b.item_id = i.id
       LEFT JOIN (
            SELECT item_id, SUM(quantity) qty
              FROM stock_movements
             WHERE movement_type IN ('ADJUSTMENT','EXPIRY','DAMAGE')
             GROUP BY item_id
       ) a ON a.item_id = i.id
       -- Last cost paid for the item, for valuing what the rebuild leaves over.
       LEFT JOIN (
            SELECT pii.item_id, pii.unit_cost cost
              FROM purchase_invoice_items pii
              JOIN purchase_invoices pi ON pi.id = pii.invoice_id
             WHERE pi.status = 'CONFIRMED'
               AND pii.id = (SELECT MAX(x.id) FROM purchase_invoice_items x
                               JOIN purchase_invoices y ON y.id = x.invoice_id
                              WHERE x.item_id = pii.item_id AND y.status = 'CONFIRMED')
       ) pc ON pc.item_id = i.id
      WHERE i.company_id = ?
      ORDER BY i.item_type, i.item_name`,
    [cutover, env.companyId],
  );

  // Batches (what the system shows now), independent of movement history.
  const batches = await db.all<{ item_id: number; qty: number; neg: number }>(
    `SELECT sb.item_id,
            SUM(sb.quantity_in_stock) qty,
            SUM(CASE WHEN sb.quantity_in_stock < 0 THEN 1 ELSE 0 END) neg
       FROM stock_batches sb
       JOIN items i ON i.id = sb.item_id
      WHERE i.company_id = ? AND sb.is_active = 1
      GROUP BY sb.item_id`,
    [env.companyId],
  );
  const batchByItem = new Map(batches.map((row) => [row.item_id, row]));
  for (const row of rows) {
    const batch = batchByItem.get(row.item_id);
    row.current = Number(batch?.qty ?? 0);
  }

  const consumedOf = (row: Row): number =>
    Number(row.produced) + Number(row.packed) + Number(row.sold) - Number(row.sales_returned);
  const netPurchased = (row: Row): number =>
    Number(row.purchased) - Number(row.purchase_returns);
  /** Bought materials only, as stated: purchased − consumed. */
  const pure = (row: Row): number => round4(netPurchased(row) - consumedOf(row));
  /** The same rule plus what the cutover left and what the factory produced. */
  const rolled = (row: Row): number =>
    round4(Number(row.opening) + netPurchased(row) + Number(row.output) - consumedOf(row));

  // --- totals ---------------------------------------------------------------
  const types = [...new Set(rows.map((row) => row.item_type))];
  console.log("\n### What the rule says, by type (quantity)");
  console.log(
    "  type               items   purchased    consumed     opening    produced     current  bought-only  roll-forward",
  );
  for (const type of types) {
    const ofType = rows.filter((row) => row.item_type === type);
    const sum = (pick: (row: Row) => number): number =>
      ofType.reduce((total, row) => total + Number(pick(row)), 0);
    console.log(
      `  ${type.padEnd(16)} ${String(ofType.length).padStart(5)} ${sum((r) => r.purchased)
        .toFixed(2)
        .padStart(11)} ${sum(consumedOf).toFixed(2).padStart(11)} ${sum((r) => r.opening)
        .toFixed(2)
        .padStart(11)} ${sum((r) => r.output).toFixed(2).padStart(11)} ${sum(
        (r) => r.current,
      )
        .toFixed(2)
        .padStart(11)} ${sum(pure).toFixed(2).padStart(12)} ${sum(rolled).toFixed(2).padStart(14)}`,
    );
  }
  const total = (pick: (row: Row) => number): number => rows.reduce((sum, row) => sum + Number(pick(row)), 0);
  console.log(
    `  ${"TOTAL".padEnd(16)} ${String(rows.length).padStart(5)} ${total((r) => r.purchased)
      .toFixed(2)
      .padStart(11)} ${total(consumedOf).toFixed(2).padStart(11)} ${total((r) => r.opening)
      .toFixed(2)
      .padStart(11)} ${total((r) => r.output).toFixed(2).padStart(11)} ${total(
      (r) => r.current,
    )
      .toFixed(2)
      .padStart(11)} ${total(pure).toFixed(2).padStart(12)} ${total(rolled).toFixed(2).padStart(14)}`,
  );

  // --- how far today's batches are from each proposal -----------------------
  const compare = (pick: (row: Row) => number, label: string): void => {
    const moved = rows.filter((row) => Math.abs(pick(row) - Number(row.current)) > 1e-6);
    const value = rows.reduce(
      (sum, row) => sum + Math.abs(Number(row.current) - pick(row)) * Number(row.unit_cost),
      0,
    );
    console.log(
      `\n  ${label}: ${moved.length} items differ from the batches, ${money(value)} of value at last cost`,
    );
  };
  compare(pure, "bought-only (purchased − consumed)");
  compare(rolled, "roll-forward (opening + purchased + produced − consumed)");

  // --- the cases the rule was aimed at -------------------------------------
  const neverBought = rows.filter(
    (row) => netPurchased(row) <= 0 && consumedOf(row) > 0,
  );
  const wouldGoNegative = rows.filter((row) => pure(row) < 0);
  const negativeNow = rows.filter((row) => Number(row.current) < 0);

  // If the cutover was recorded as movements, then "opening" already contains
  // purchases and production, and adding them again would double count.
  const before = await db.all<{ movement_type: string; qty: number }>(
    `SELECT movement_type, ROUND(SUM(quantity), 2) qty
       FROM stock_movements WHERE movement_date < ? GROUP BY movement_type
      ORDER BY ABS(SUM(quantity)) DESC`,
    [cutover],
  );
  if (before.length > 0) {
    const overlap = before
      .filter((row) => row.movement_type === "PURCHASE" || row.movement_type === "PRODUCTION_IN")
      .reduce((sum, row) => sum + Math.abs(Number(row.qty)), 0);
    console.log(`\n### What is dated before the cutover (${cutover})`);
    console.log(`  ${before.map((row) => `${row.movement_type} ${row.qty}`).join("  |  ")}`);
    if (overlap > 0) {
      console.log(
        `  ${overlap.toFixed(2)} qty of that is purchases and production output — the same things\n` +
          "  the rule counts again. Pick one starting point: a counted opening balance, or a\n" +
          "  zero start with every purchase in the register. Not both.",
      );
    }
  }

  console.log("\n### The cases that decide the approach");
  console.log(
    `  never purchased but consumed   ${String(neverBought.length).padStart(4)} items ` +
      `(${neverBought.reduce((s, row) => s + consumedOf(row), 0).toFixed(2)} consumed) — the ones you want negative`,
  );
  console.log(
    `  negative under the pure rule   ${String(wouldGoNegative.length).padStart(4)} items ` +
      `(${wouldGoNegative.reduce((s, row) => s + pure(row), 0).toFixed(2)}) — mostly opening stock with no purchase`,
  );
  console.log(`  negative today in the batches ${String(negativeNow.length).padStart(4)} items`);
  console.log(
    `  moved by manual adjustments    ${String(rows.filter((row) => Number(row.adjustments) !== 0).length).padStart(4)} items ` +
      `(${rows.reduce((s, row) => s + Number(row.adjustments), 0).toFixed(2)} qty) — excluded from the rule on purpose`,
  );

  const show = (list: Row[], detail: (row: Row) => string, limit = 10): void => {
    for (const row of list.slice(0, limit)) {
      console.log(`    ${row.item_code.slice(0, 13).padEnd(13)} ${row.item_name.slice(0, 36).padEnd(36)} ${detail(row)}`);
    }
    if (list.length > limit) console.log(`    … and ${list.length - limit} more (see the CSV)`);
  };
  if (neverBought.length > 0) {
    console.log("\n  Never purchased, consumed anyway (would sit negative):");
    show(neverBought, (row) => `used ${qty(consumedOf(row)).padStart(10)}  now ${qty(row.current).padStart(10)}`);
  }
  if (wouldGoNegative.length > 0) {
    console.log("\n  Opening stock the pure rule would wipe out:");
    show(wouldGoNegative, (row) => `rule ${qty(pure(row)).padStart(10)}  opening ${qty(row.opening).padStart(10)}  now ${qty(row.current).padStart(10)}`);
  }

  // --- the sheet -----------------------------------------------------------
  const header = [
    "code",
    "name",
    "type",
    "unit",
    "purchased",
    "purchase_returns",
    "production_consumed",
    "packing_consumed",
    "produced_output",
    "sold",
    "sales_returned",
    "consumed_total",
    "opening_at_cutover",
    "rule_qty",
    "rule_plus_opening_qty",
    "current_batch_qty",
    "adjustment_qty",
    "last_unit_cost",
    "rule_value",
  ];
  const lines = rows.map((row) =>
    [
      row.item_code,
      row.item_name,
      row.item_type,
      row.unit,
      qty(row.purchased),
      qty(row.purchase_returns),
      qty(row.produced),
      qty(row.packed),
      qty(row.output),
      qty(row.sold),
      qty(row.sales_returned),
      qty(consumedOf(row)),
      qty(row.opening),
      qty(pure(row)),
      qty(rolled(row)),
      qty(row.current),
      qty(row.adjustments),
      money(Number(row.unit_cost)),
      money(rolled(row) * Number(row.unit_cost)),
    ]
      .map(csvCell)
      .join(","),
  );

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, [header.join(","), ...lines].join("\n") + "\n", "utf8");
  console.log(`\nProposal: ${outPath} (${rows.length} items)`);
  console.log("Nothing was written to the database.");
  await closeDb();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
