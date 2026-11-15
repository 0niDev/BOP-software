// Bring raw + packing inventory on the books down to the physical stock count,
// the way the old software does it: opening + purchases − closing = consumed.
// The difference becomes COGS. No BOMs involved, so it cannot be fooled by a
// wrong component quantity or a missing price.
//
//   npx tsx scripts/post-periodic-stock-correction.ts                    # dry run
//   npx tsx scripts/post-periodic-stock-correction.ts --db fixed         # dry run, other database
//   npx tsx scripts/post-periodic-stock-correction.ts --db fixed --apply # post both entries
//   ... --date 2026-10-31
//
// Two entries:
//   1. Dr 1210 Packing / Cr 3100 Retained Earnings  — opening stock that was
//      never valued into the books (OPENING stock movements at current prices).
//   2. Dr 5000 COGS / Cr 1200 + 1210 — the rest, so each account lands exactly
//      on its counted value.
//
// Re-running is safe: both entries carry a fixed reference number and are
// skipped if already posted. MAX_ADJUSTMENT aborts the run if the gap ever
// looks like a data error rather than missing cost.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { JournalLineInput } from "../server/src/services/accountingService.js";

const OPENING_REF = "OPENING-STOCK-CORR";
const ADJUST_REF = "PERIODIC-STOCK-CORR";
const MAX_ADJUSTMENT = 6_000_000;

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const force = args.includes("--force");
const dateArg = args.indexOf("--date");
const entryDate = dateArg >= 0 ? args[dateArg + 1] : "2026-10-31";
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

const TYPES = "'RAW_MATERIAL','PACKING_MATERIAL'";

/** Batch cost when it has one, else the item's purchase price. */
const UNIT_COST = `COALESCE(NULLIF(sb.purchase_price,0), i.purchase_price, 0)`;

async function main(): Promise<void> {
  // Imported late so a --db override lands before env.ts reads process.env.
  const { getDb } = await import("../server/src/db/index.js");
  const { AccountingService } = await import("../server/src/services/accountingService.js");

  const db = getDb();
  console.log(`Database: ${(process.env.SQLITE_CLOUD_URL ?? "").replace(/apikey=[^&]+/, "apikey=***")}`);

  const balances = new Map<string, number>();
  for (const row of await db.all<{ account_code: string; net: number }>(
    `SELECT a.account_code, ROUND(SUM(jel.debit - jel.credit), 2) net
     FROM journal_entry_lines jel
     JOIN accounts a ON a.id = jel.account_id
     JOIN journal_entries je ON je.id = jel.journal_entry_id
     WHERE je.company_id = 1 AND a.account_code IN ('1200','1210')
     GROUP BY a.id`,
  )) {
    balances.set(row.account_code, Number(row.net));
  }

  const opening = new Map<string, number>();
  for (const row of await db.all<{ item_type: string; v: number }>(
    `SELECT i.item_type,
            ROUND(SUM(m.quantity * COALESCE(NULLIF((SELECT MAX(sb.purchase_price) FROM stock_batches sb
              WHERE sb.item_id = i.id AND sb.purchase_price > 0), 0), NULLIF(i.purchase_price, 0), 0)), 2) v
     FROM stock_movements m
     JOIN items i ON i.id = m.item_id
     WHERE i.company_id = 1 AND m.movement_type = 'OPENING' AND i.item_type IN (${TYPES})
     GROUP BY i.item_type`,
  )) {
    opening.set(row.item_type, Number(row.v));
  }

  const counted = new Map<string, number>();
  for (const row of await db.all<{ item_type: string; v: number }>(
    `SELECT i.item_type, ROUND(SUM(sb.quantity_in_stock * ${UNIT_COST}), 2) v
     FROM stock_batches sb
     JOIN items i ON i.id = sb.item_id
     WHERE i.company_id = 1 AND sb.quantity_in_stock > 0 AND sb.is_active = 1
       AND i.item_type IN (${TYPES})
     GROUP BY i.item_type`,
  )) {
    counted.set(row.item_type, Number(row.v));
  }

  // Per-account movement: bring each balance to its counted value, after the
  // opening value that was never booked has been added back.
  const plan = ["1200", "1210"].map((code) => {
    const type = code === "1200" ? "RAW_MATERIAL" : "PACKING_MATERIAL";
    const balance = balances.get(code) ?? 0;
    const openingValue = opening.get(type) ?? 0;
    const target = counted.get(type) ?? 0;
    return { code, type, balance, openingValue, target, delta: balance + openingValue - target };
  });

  const openingTotal = plan.reduce((sum, p) => sum + p.openingValue, 0);
  const adjustTotal = plan.reduce((sum, p) => sum + p.delta, 0);

  console.log("\n            balance    + opening    - counted   = adjustment");
  for (const p of plan) {
    console.log(
      `  ${p.code} ${p.type.padEnd(16)} ${p.balance.toFixed(2).padStart(12)} ${p.openingValue
        .toFixed(2)
        .padStart(12)} ${p.target.toFixed(2).padStart(12)} ${p.delta.toFixed(2).padStart(14)}`,
    );
  }
  console.log(`  opening entry total: ${openingTotal.toFixed(2)}`);
  console.log(`  COGS adjustment    : ${adjustTotal.toFixed(2)}`);

  if (openingTotal <= 0 && adjustTotal <= 0) {
    console.log("Nothing to post.");
    return;
  }
  if (adjustTotal > MAX_ADJUSTMENT && !force) {
    throw new Error(
      `Adjustment ${adjustTotal.toFixed(2)} exceeds the ${MAX_ADJUSTMENT} cap — check the stock count before posting (use --force to override).`,
    );
  }

  const accountIds = new Map<string, number>();
  for (const row of await db.all<{ id: number; account_code: string }>(
    "SELECT id, account_code FROM accounts WHERE company_id = 1 AND account_code IN ('1200','1210','3100','5000')",
  )) {
    accountIds.set(row.account_code, row.id);
  }
  const account = (code: string): number => {
    const id = accountIds.get(code);
    if (!id) throw new Error(`Account ${code} not found.`);
    return id;
  };

  const posted = new Set(
    (
      await db.all<{ reference_no: string }>(
        "SELECT reference_no FROM journal_entries WHERE company_id = 1 AND reference_no IN (?, ?)",
        [OPENING_REF, ADJUST_REF],
      )
    ).map((r) => r.reference_no),
  );

  const jobs: Array<{ ref: string; narration: string; lines: JournalLineInput[] }> = [];

  if (openingTotal > 0 && !posted.has(OPENING_REF)) {
    jobs.push({
      ref: OPENING_REF,
      narration: "Opening stock at 1 October brought into the inventory accounts",
      lines: plan
        .filter((p) => p.openingValue > 0)
        .map((p) => ({
          accountId: account(p.code),
          debit: p.openingValue,
          description: `Opening stock — ${p.type.toLowerCase().replace("_", " ")}`,
        }))
        .concat([{ accountId: account("3100"), credit: openingTotal, description: "Opening stock" }]),
    });
  }

  if (adjustTotal > 0 && !posted.has(ADJUST_REF)) {
    jobs.push({
      ref: ADJUST_REF,
      narration: "Raw and packing materials consumed — opening + purchases less closing stock",
      lines: [{ accountId: account("5000"), debit: adjustTotal, description: "Materials consumed" }].concat(
        plan
          .filter((p) => p.delta > 0)
          .map((p) => ({
            accountId: account(p.code),
            credit: p.delta,
            description: `Consumed ${p.type.toLowerCase().replace("_", " ")}`,
          })),
      ),
    });
  }

  if (jobs.length === 0) {
    console.log("Both entries already posted. Nothing to do.");
    return;
  }
  for (const job of jobs) console.log(`  will post ${job.ref} for ${(job.ref === OPENING_REF ? openingTotal : adjustTotal).toFixed(2)}`);

  if (!apply) {
    console.log("Dry run — nothing written. Re-run with --apply to post.");
    return;
  }

  await db.transaction(async (tx) => {
    const inside = new AccountingService(tx);
    for (const job of jobs) {
      const id = await inside.postJournalEntry({
        voucherType: "JOURNAL",
        entryDate,
        narration: job.narration,
        referenceNo: job.ref,
        lines: job.lines,
      });
      console.log(`Posted ${job.ref} as entry #${id} on ${entryDate}.`);
    }
  });
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
