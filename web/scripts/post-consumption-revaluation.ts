// Post the cost of materials that were consumed in production/packing but
// recorded at zero, now that the items have a purchase price.
//
//   npx tsx scripts/post-consumption-revaluation.ts                          # dry run
//   npx tsx scripts/post-consumption-revaluation.ts --db fixed               # dry run, other database
//   npx tsx scripts/post-consumption-revaluation.ts --db fixed --apply       # post it
//   npx tsx scripts/post-consumption-revaluation.ts --db fixed --apply --date 2026-10-31
//
// The database defaults to SQLITE_CLOUD_URL from web/.env; --db swaps its name
// (web/.env currently points at the sale_report test database).
//
// What counts as "under-costed": a BOM component that was never bought in the
// system (no purchase invoice line) and never had a batch with a cost, so
// resolveConsumptionBatch() used 0. Those items contributed nothing to the
// MANUFACTURING journals.
//
// One balanced entry: Dr COGS / Cr raw + packing inventory. Re-running is safe:
// the entry carries a fixed reference number and is skipped if already posted.
//
// Items whose BOM quantity looks wrong (Vitamin H/D/B6 at 0.5 KG per unit while
// sibling BOMs use 0.0005) are excluded until the BOM is corrected, and a
// MAX_TOTAL cap aborts the run if the numbers ever look like that again.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const REFERENCE = "CONSUMPTION-REVAL";
const MAX_TOTAL = 5_000_000;
const SUSPECT_ITEMS = ["Vitamin H", "Vitamin D", "Vitamin B6"];

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const force = args.includes("--force");
const dateArg = args.indexOf("--date");
const entryDate = dateArg >= 0 ? args[dateArg + 1] : new Date().toISOString().slice(0, 10);
const dbArg = args.indexOf("--db");

/** Point the server's config at another database on the same SQLite Cloud instance. */
function retargetDatabase(name: string): void {
  const envFile = path.resolve(import.meta.dirname, "..", ".env");
  if (!existsSync(envFile)) throw new Error("web/.env not found.");
  const line = readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .find((raw) => raw.trim().startsWith("SQLITE_CLOUD_URL="));
  if (!line) throw new Error("SQLITE_CLOUD_URL is not set in web/.env.");
  const url = line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  process.env.ERP_DB_ENGINE = "sqlitecloud";
  process.env.SQLITE_CLOUD_URL = url.replace(/(:\d+\/)[^?]*/, `$1${name}`);
}

if (dbArg >= 0) retargetDatabase(args[dbArg + 1]);

interface Row {
  item_type: string;
  item_name: string;
  unit: string;
  purchase_price: number;
  qty: number;
  value: number;
}

const CONSUMPTION_SQL = `
  WITH raw AS (
    SELECT bc.component_item_id id,
           SUM(bc.quantity_required * (po.actual_quantity / b.output_quantity)
               * (1 + bc.wastage_percent / 100.0)) q
    FROM production_orders po
    JOIN bill_of_materials b ON b.id = po.bom_id
    JOIN bom_components bc ON bc.bom_id = b.id
    WHERE po.company_id = 1 AND po.actual_quantity > 0
    GROUP BY bc.component_item_id
  ), pack AS (
    SELECT bc.component_item_id id,
           SUM(bc.quantity_required * (pko.actual_quantity / b.output_quantity)
               * (1 + bc.wastage_percent / 100.0)) q
    FROM packing_orders pko
    JOIN bill_of_materials b ON b.id = pko.bom_id
    JOIN bom_components bc ON bc.bom_id = b.id
    WHERE pko.company_id = 1 AND pko.actual_quantity > 0
    GROUP BY bc.component_item_id
  ), consumed AS (
    SELECT id, SUM(q) q FROM (SELECT * FROM raw UNION ALL SELECT * FROM pack) GROUP BY id
  )
  SELECT i.item_type, i.item_name, i.unit, i.purchase_price,
         ROUND(consumed.q, 2) qty,
         ROUND(consumed.q * i.purchase_price, 2) value
  FROM consumed
  JOIN items i ON i.id = consumed.id
  WHERE i.company_id = 1
    AND i.purchase_price > 0
    AND consumed.q > 0
    AND NOT EXISTS (SELECT 1 FROM purchase_invoice_items p WHERE p.item_id = i.id)
    AND NOT EXISTS (SELECT 1 FROM stock_batches sb WHERE sb.item_id = i.id AND sb.purchase_price > 0)
    AND i.item_name NOT IN (${SUSPECT_ITEMS.map(() => "?").join(", ")})
  ORDER BY consumed.q * i.purchase_price DESC`;

async function main(): Promise<void> {
  // Imported late so a --db override lands before env.ts reads process.env.
  const { getDb } = await import("../server/src/db/index.js");
  const { AccountingService } = await import("../server/src/services/accountingService.js");

  const db = getDb();
  console.log(`Database: ${(process.env.SQLITE_CLOUD_URL ?? "").replace(/apikey=[^&]+/, "apikey=***")}`);
  const rows = await db.all<Row>(CONSUMPTION_SQL, SUSPECT_ITEMS);

  const byType = new Map<string, number>();
  for (const row of rows) {
    byType.set(row.item_type, (byType.get(row.item_type) ?? 0) + Number(row.value));
  }
  const total = [...byType.values()].reduce((a, b) => a + b, 0);

  console.log(`Items under-costed: ${rows.length}`);
  for (const row of rows.slice(0, 15)) {
    console.log(
      `  ${row.item_type.slice(0, 4)} ${row.item_name} [${row.unit}] ` +
        `qty=${row.qty} @ ${row.purchase_price} = ${Number(row.value).toFixed(2)}`,
    );
  }
  if (rows.length > 15) console.log(`  … and ${rows.length - 15} more`);
  for (const [type, value] of byType) console.log(`  ${type}: ${value.toFixed(2)}`);
  console.log(`  TOTAL: ${total.toFixed(2)}`);

  if (total <= 0) {
    console.log("Nothing to post.");
    return;
  }
  if (total > MAX_TOTAL && !force) {
    throw new Error(
      `Total ${total.toFixed(2)} exceeds the ${MAX_TOTAL} safety cap — check the BOM quantities before posting (use --force to override).`,
    );
  }

  const accounts = await db.all<{ id: number; account_code: string }>(
    "SELECT id, account_code FROM accounts WHERE company_id = 1 AND account_code IN ('5000','1200','1210')",
  );
  const account = (code: string): number => {
    const found = accounts.find((row) => row.account_code === code);
    if (!found) throw new Error(`Account ${code} not found.`);
    return found.id;
  };

  const existing = await db.all<{ id: number }>(
    "SELECT id FROM journal_entries WHERE company_id = 1 AND reference_no = ?",
    [REFERENCE],
  );
  if (existing.length > 0) {
    console.log(`Already posted as entry #${existing[0].id}. Nothing to do.`);
    return;
  }

  const lines = [];
  for (const [type, value] of byType) {
    lines.push({
      accountId: account("5000"),
      debit: value,
      description: `Consumed ${type.toLowerCase().replace("_", " ")}s recorded at zero cost`,
    });
  }
  const raw = byType.get("RAW_MATERIAL") ?? 0;
  const packing = byType.get("PACKING_MATERIAL") ?? 0;
  if (raw > 0) lines.push({ accountId: account("1200"), credit: raw, description: "Raw material consumed" });
  if (packing > 0)
    lines.push({ accountId: account("1210"), credit: packing, description: "Packing material consumed" });

  if (!apply) {
    console.log("Dry run — nothing written. Re-run with --apply to post.");
    return;
  }

  const accounting = new AccountingService(db);
  const id = await accounting.postJournalEntry({
    voucherType: "JOURNAL",
    entryDate,
    narration: `Cost of materials consumed but posted at zero (${rows.length} items)`,
    referenceNo: REFERENCE,
    lines,
  });
  console.log(`Posted journal entry #${id} on ${entryDate} for ${total.toFixed(2)}.`);
}

main()
  .then(async () => {
    const { closeDb } = await import("../server/src/db/index.js");
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
