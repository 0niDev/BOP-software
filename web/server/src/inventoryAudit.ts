// Read-only inventory audit: what the system thinks we hold, against what the
// books and the purchase/consumption history say, item by item.
//
//   npm -w @bop-erp/server run audit:inventory
//   npm -w @bop-erp/server run audit:inventory -- --out data/count.csv
//
// Writes a count sheet (CSV) you can print and walk the store with. Nothing is
// written to the database — this is the sheet you fill in *before* any
// correction is posted.
//
// Per item it prints on-hand from batches, the same figure from the movement
// ledger (they must agree), the value at each batch's own cost, and what was
// bought and consumed. It flags the things that make a valuation wrong:
// negative batches, stock with no cost, stock that was never purchased, and
// batches whose ledger disagrees with the movement history.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const outArg = args.indexOf("--out");
/** Default next to the databases, whatever directory npm started us in. */
const defaultDir = fileURLToPath(new URL("../../data/", import.meta.url));
const outPath = resolve(
  outArg >= 0 ? args[outArg + 1]! : `${defaultDir}inventory-audit-${today()}.csv`,
);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type Row = {
  item_id: number;
  item_code: string;
  item_name: string;
  item_type: string;
  unit: string;
  batch_qty: number;
  movement_qty: number;
  neg_qty: number;
  neg_batches: number;
  zero_cost_qty: number;
  value: number;
  purchased_qty: number;
  purchased_value: number;
  consumed_qty: number;
};

const money = (n: number): string => n.toFixed(2);
const qty = (n: number): string => (Math.round(n * 10000) / 10000).toString();

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main(): Promise<void> {
  const { getDb, closeDb } = await import("./db/index.js");
  const { env } = await import("./env.js");

  const db = getDb();
  console.log(`inventory audit — engine=${env.dbEngine} company=${env.companyId}`);

  // One row per item, with on-hand from the batches (the source of truth for
  // what the system holds) and from the movements (the audit trail).
  const rows = await db.all<Row>(
    `SELECT i.id item_id, i.item_code, i.item_name, i.item_type, i.unit,
            COALESCE(b.qty, 0) batch_qty,
            COALESCE(m.qty, 0) movement_qty,
            COALESCE(b.neg_qty, 0) neg_qty,
            COALESCE(b.neg_batches, 0) neg_batches,
            COALESCE(b.zero_cost_qty, 0) zero_cost_qty,
            COALESCE(b.value, 0) value,
            COALESCE(p.qty, 0) purchased_qty,
            COALESCE(p.value, 0) purchased_value,
            COALESCE(c.qty, 0) consumed_qty
       FROM items i
       LEFT JOIN (
            SELECT sb.item_id,
                   SUM(sb.quantity_in_stock) qty,
                   SUM(CASE WHEN sb.quantity_in_stock < 0 THEN sb.quantity_in_stock ELSE 0 END) neg_qty,
                   SUM(CASE WHEN sb.quantity_in_stock < 0 THEN 1 ELSE 0 END) neg_batches,
                   SUM(CASE WHEN sb.quantity_in_stock > 0
                             AND COALESCE(NULLIF(sb.raw_unit_cost + sb.packing_unit_cost,0),
                                          NULLIF(sb.purchase_price,0), i2.purchase_price, 0) <= 0
                            THEN sb.quantity_in_stock ELSE 0 END) zero_cost_qty,
                   -- Same cost the books use: a manufactured batch carries raw +
                   -- packing cost, a bought one its purchase price.
                   SUM(CASE WHEN sb.quantity_in_stock > 0
                            THEN sb.quantity_in_stock
                                 * COALESCE(NULLIF(sb.raw_unit_cost + sb.packing_unit_cost,0),
                                            NULLIF(sb.purchase_price,0), i2.purchase_price, 0)
                            ELSE 0 END) value
              FROM stock_batches sb
              JOIN items i2 ON i2.id = sb.item_id
             WHERE sb.is_active = 1
             GROUP BY sb.item_id
       ) b ON b.item_id = i.id
       LEFT JOIN (
            SELECT item_id, SUM(quantity) qty FROM stock_movements GROUP BY item_id
       ) m ON m.item_id = i.id
       LEFT JOIN (
            SELECT pii.item_id, SUM(pii.quantity) qty, SUM(pii.line_total) value
              FROM purchase_invoice_items pii
              JOIN purchase_invoices pi ON pi.id = pii.invoice_id
             WHERE pi.status = 'CONFIRMED'
             GROUP BY pii.item_id
       ) p ON p.item_id = i.id
       LEFT JOIN (
            SELECT item_id, SUM(qty) qty FROM (
                 SELECT component_item_id item_id, quantity_consumed qty FROM production_consumption
                 UNION ALL
                 SELECT component_item_id item_id, quantity_consumed qty FROM packing_consumption
            ) GROUP BY item_id
       ) c ON c.item_id = i.id
      WHERE i.company_id = ?
      ORDER BY i.item_type, i.item_name`,
    [env.companyId],
  );

  // --- what the books say ---------------------------------------------------
  const accounts = await db.all<{ account_code: string; net: number }>(
    `SELECT a.account_code, ROUND(SUM(jel.debit - jel.credit), 2) net
       FROM journal_entry_lines jel
       JOIN accounts a ON a.id = jel.account_id
       JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.company_id = ? AND a.account_code IN ('1200','1210','1220')
      GROUP BY a.id`,
    [env.companyId],
  );
  const gl = new Map(accounts.map((row) => [row.account_code, Number(row.net)]));
  const glance = new Map([
    ["RAW_MATERIAL", "1200"],
    ["PACKING_MATERIAL", "1210"],
    ["FINISHED_GOOD", "1220"],
  ]);

  const types = [...new Set(rows.map((row) => row.item_type))];
  console.log("\n### Batch stock per type vs the inventory account");
  console.log(
    "  type              items       qty         value       GL (1xxx)      difference   negatives",
  );
  let totalValue = 0;
  let totalGl = 0;
  for (const type of types) {
    const ofType = rows.filter((row) => row.item_type === type);
    const value = ofType.reduce((sum, row) => sum + Number(row.value), 0);
    const qty = ofType.reduce((sum, row) => sum + Number(row.batch_qty), 0);
    const negatives = ofType.reduce((sum, row) => sum + Number(row.neg_batches), 0);
    const code = glance.get(type);
    const book = code ? (gl.get(code) ?? 0) : 0;
    totalValue += value;
    totalGl += book;
    console.log(
      `  ${type.padEnd(16)} ${String(ofType.length).padStart(5)} ${qty
        .toFixed(2)
        .padStart(12)} ${money(value).padStart(13)} ${money(book).padStart(13)} ${money(value - book).padStart(
        14,
      )} ${String(negatives).padStart(11)}`,
    );
  }
  console.log(
    `  ${"TOTAL".padEnd(16)} ${String(rows.length).padStart(5)} ${rows
      .reduce((s, r) => s + Number(r.batch_qty), 0)
      .toFixed(2)
      .padStart(12)} ${money(totalValue).padStart(13)} ${money(totalGl).padStart(13)} ${money(
      totalValue - totalGl,
    ).padStart(14)}`,
  );

  // --- the problems that make a count impossible to match -------------------
  const negative = rows.filter((row) => Number(row.neg_batches) > 0);
  const mismatched = rows.filter(
    (row) => Math.abs(Number(row.batch_qty) - Number(row.movement_qty)) > 1e-6,
  );
  const uncosted = rows.filter((row) => Number(row.zero_cost_qty) > 0);
  const unpurchased = rows.filter(
    (row) => Number(row.batch_qty) > 0 &&
      Number(row.purchased_qty) <= 0 &&
      Number(row.consumed_qty) <= 0,
  );

  const negativeQty = negative.reduce((s, row) => s + Number(row.neg_qty), 0);
  console.log("\n### Things to settle before you count");
  console.log(`  negative stock        ${String(negative.length).padStart(4)} items, ${negativeQty.toFixed(2)} in total`);
  console.log(`  batch vs movement     ${String(mismatched.length).padStart(4)} items disagree with their own movement ledger`);
  console.log(`  stock with no cost    ${String(uncosted.length).padStart(4)} items, ${uncosted
    .reduce((s, row) => s + Number(row.zero_cost_qty), 0)
    .toFixed(2)} qty valued at 0`);
  console.log(`  never purchased       ${String(unpurchased.length).padStart(4)} items hold stock with no purchase and no consumption`);

  const show = (rows: Row[], detail: (row: Row) => string, limit = 12): void => {
    for (const row of rows.sort((a, b) => Math.abs(Number(b.value)) - Math.abs(Number(a.value))).slice(0, limit)) {
      console.log(`    ${row.item_code.slice(0, 14).padEnd(14)} ${row.item_name.slice(0, 40).padEnd(40)} ${detail(row)}`);
    }
    if (rows.length > limit) console.log(`    … and ${rows.length - limit} more (see the CSV)`);
  };
  if (negative.length > 0) {
    console.log("\n  Negative stock:");
    show(negative, (row) => `${qty(Number(row.neg_qty)).padStart(12)} over ${row.neg_batches} batch(es)`);
  }
  if (mismatched.length > 0) {
    console.log("\n  Batch on-hand vs movement ledger:");
    show(
      mismatched,
      (row) =>
        `batches ${qty(Number(row.batch_qty)).padStart(12)}  movements ${qty(
          Number(row.movement_qty),
        ).padStart(12)}  diff ${qty(Number(row.batch_qty) - Number(row.movement_qty))}`,
    );
  }
  if (uncosted.length > 0) {
    console.log("\n  Stock valued at zero (invisible to the books):");
    show(uncosted, (row) => `${qty(Number(row.zero_cost_qty)).padStart(12)} qty`);
  }
  if (unpurchased.length > 0) {
    console.log("\n  Holds stock the system never bought:");
    show(unpurchased, (row) => `${qty(Number(row.batch_qty)).padStart(12)} qty`);
  }

  // --- the sheet ------------------------------------------------------------
  const header = [
    "code",
    "name",
    "type",
    "unit",
    "system_qty",
    "system_value",
    "counted_qty",
    "counted_value",
    "variance_qty",
    "variance_value",
    "negative_batches",
    "zero_cost_qty",
    "purchased_qty",
    "purchased_value",
    "consumed_qty",
    "flags",
  ];
  const lines = rows.map((row) => {
    const flags: string[] = [];
    if (Number(row.neg_batches) > 0) flags.push("negative");
    if (Number(row.zero_cost_qty) > 0) flags.push("no-cost");
    if (Math.abs(Number(row.batch_qty) - Number(row.movement_qty)) > 1e-6) flags.push("ledger-mismatch");
    if (
      Number(row.batch_qty) > 0 &&
      Number(row.purchased_qty) <= 0 &&
      Number(row.consumed_qty) <= 0
    ) {
      flags.push("never-purchased");
    }
    return [
      row.item_code,
      row.item_name,
      row.item_type,
      row.unit,
      qty(Number(row.batch_qty)),
      money(Number(row.value)),
      "",
      "",
      "",
      "",
      row.neg_batches,
      qty(Number(row.zero_cost_qty)),
      qty(Number(row.purchased_qty)),
      money(Number(row.purchased_value)),
      qty(Number(row.consumed_qty)),
      flags.join(" "),
    ]
      .map(csvCell)
      .join(",");
  });

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, [header.join(","), ...lines].join("\n") + "\n", "utf8");
  console.log(`\nCount sheet: ${outPath} (${rows.length} items)`);
  console.log(
    "Fill counted_qty from the shelf; variance columns are formulas once you open it." +
      "\nNothing was written to the database.",
  );

  await closeDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
