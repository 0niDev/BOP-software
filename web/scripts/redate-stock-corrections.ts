// Move the two stock-correction entries to the day the count was actually taken.
//
// The correction is computed from today's shelf, but it was posted dated
// 31 October, so October's closing carries a November fact and November's
// opening inherits it. Re-dating it to the count date isolates the two months:
// October keeps its own posting, November owns the correction.
//
//   npx tsx scripts/redate-stock-corrections.ts --local --date 2026-11-15
//   npx tsx scripts/redate-stock-corrections.ts --local --date 2026-11-15 --apply
//   npx tsx scripts/redate-stock-corrections.ts --db fixed --apply
//
// Only `entry_date` changes; amounts, lines and totals are untouched.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const REFS = ["OPENING-STOCK-CORR", "PERIODIC-STOCK-CORR"];

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const dateArg = args.indexOf("--date");
const newDate = dateArg >= 0 ? args[dateArg + 1] : "";
if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
  console.error("Pass --date YYYY-MM-DD (the date the count was taken).");
  process.exit(1);
}

const dbArg = args.indexOf("--db");
const localArg = args.indexOf("--local");
const useLocal = localArg >= 0;
if (useLocal) {
  process.env.ERP_DB_ENGINE = "local";
  const target = args[localArg + 1];
  if (target && !target.startsWith("--")) process.env.ERP_LOCAL_DB = target;
} else if (dbArg >= 0) {
  const envFile = path.resolve(import.meta.dirname, "..", ".env");
  if (!existsSync(envFile)) throw new Error("web/.env not found.");
  const line = readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .find((raw) => raw.trim().startsWith("SQLITE_CLOUD_URL="));
  if (!line) throw new Error("SQLITE_CLOUD_URL is not set in web/.env.");
  const url = line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  process.env.ERP_DB_ENGINE = "sqlitecloud";
  process.env.SQLITE_CLOUD_URL = url.replace(/(:\d+\/)[^?]*/, `$1${args[dbArg + 1]}`);
}

async function main(): Promise<void> {
  const { getDb, closeDb } = await import("../server/src/db/index.js");
  const { env } = await import("../server/src/env.js");
  const db = getDb();
  console.log(
    `Database: ${
      useLocal
        ? `${env.localDbPath} (local — stop the service first)`
        : (process.env.SQLITE_CLOUD_URL ?? "").replace(/apikey=[^&]+/, "apikey=***")
    }`,
  );

  const entries = await db.all<{ id: number; voucher_number: string; entry_date: string; reference_no: string }>(
    `SELECT id, voucher_number, entry_date, reference_no FROM journal_entries
      WHERE company_id = 1 AND reference_no IN (?, ?) ORDER BY id`,
    REFS,
  );
  if (entries.length === 0) {
    console.log("No correction entries found — nothing to re-date.");
    await closeDb();
    return;
  }
  for (const entry of entries) {
    const verb = entry.entry_date === newDate ? "already" : "move";
    console.log(`  ${verb} #${entry.id} ${entry.voucher_number} ${entry.reference_no}: ${entry.entry_date} -> ${newDate}`);
  }
  if (entries.every((entry) => entry.entry_date === newDate)) {
    console.log("Nothing to change.");
    await closeDb();
    return;
  }

  // What the split looks like either side of the move, so the effect is visible
  // before it is applied.
  const months = await db.all<{ month: string; voucher_type: string; net: number }>(
    `SELECT substr(je.entry_date, 1, 7) AS month, je.voucher_type,
            ROUND(SUM(jel.debit - jel.credit), 2) AS net
       FROM journal_entry_lines jel
       JOIN accounts a ON a.id = jel.account_id
       JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.company_id = 1 AND a.account_code IN ('1200','1210')
      GROUP BY month, je.voucher_type ORDER BY month`,
  );
  console.log("\ninventory debits-credits by month (before):");
  for (const row of months) {
    if (row.voucher_type === "PURCHASE") continue;
    console.log(`  ${row.month} ${row.voucher_type.padEnd(14)} ${row.net}`);
  }

  if (!apply) {
    console.log("\nDry run — nothing written. Re-run with --apply.");
    await closeDb();
    return;
  }
  await db.transaction(async (tx) => {
    for (const entry of entries) {
      await tx.run("UPDATE journal_entries SET entry_date = ? WHERE id = ?", [newDate, entry.id]);
    }
  });
  console.log(`\nRe-dated ${entries.length} entries to ${newDate}.`);
  await closeDb();
}

main().then(
  () => process.exit(0),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
