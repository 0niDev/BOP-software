// Undo the Nov 19 "fix negative stock" run (scripts/fix-negative-stock.ts):
// put the batches it zeroed back to negative, drop its OPENING movements and
// reverse its two journal entries.
//
//   npx tsx scripts/undo-negative-stock-fix.ts --local                  # dry run
//   npx tsx scripts/undo-negative-stock-fix.ts --local data/erp.sqlite --apply
//   ERP_DB_ENGINE=sqlitecloud SQLITE_CLOUD_URL=... npx tsx scripts/undo-negative-stock-fix.ts --apply
//
// The target for each batch is what on-hand would be if the fix had never run:
//   target = current on-hand - (quantity the fix added to that batch)
// The fix set each negative batch to 0 and added an OPENING movement for the
// deficit, so undoing it subtracts exactly that movement's quantity. Work
// entered since the fix is kept, including receipts whose movement rows were
// back-dated with ids older than the fix.
//
// Safe to re-run: the whole run is skipped once REV-OPENING-STOCK-CORR-2 exists.

import type { JournalLineInput } from "../server/src/services/accountingService.js";

const FIX_REF = "negative_stock_fix";
const OPENING_REF = "OPENING-STOCK-CORR-2";
const ADJUST_REF = "PERIODIC-STOCK-CORR-2";
const REV_OPENING_REF = "REV-OPENING-STOCK-CORR-2";
const REV_ADJUST_REF = "REV-PERIODIC-STOCK-CORR-2";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const dateArg = args.indexOf("--date");
const entryDate = dateArg >= 0 ? args[dateArg + 1] : new Date().toISOString().slice(0, 10);

const localArg = args.indexOf("--local");
const useLocal = localArg >= 0;
if (useLocal) {
  process.env.ERP_DB_ENGINE = "local";
  const target = args[localArg + 1];
  if (target && !target.startsWith("--")) process.env.ERP_LOCAL_DB = target;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 100) / 100;

type FixRow = { batch_id: number; item_id: number; quantity: number };
type BatchRow = {
  id: number;
  item_type: string;
  item_name: string;
  batch_number: string;
  now_qty: number;
};

async function main(): Promise<void> {
  const { getDb, closeDb } = await import("../server/src/db/index.js");
  const { env } = await import("../server/src/env.js");
  const { AccountingService } = await import("../server/src/services/accountingService.js");

  const db = getDb();
  console.log(
    `Database: ${
      useLocal ? `${env.localDbPath} (local — the service must be stopped)` : "(cloud)"
    }  date: ${entryDate}`,
  );

  const refs = new Set(
    (
      await db.all<{ reference_no: string }>(
        "SELECT reference_no FROM journal_entries WHERE company_id = 1 AND reference_no IS NOT NULL",
      )
    ).map((row) => row.reference_no),
  );
  if (refs.has(REV_OPENING_REF)) {
    console.log(`${REV_OPENING_REF} already posted — the fix is already undone.`);
    await closeDb();
    return;
  }

  // --- what the fix did ----------------------------------------------------
  const fixRows = await db.all<FixRow>(
    `SELECT batch_id, item_id, SUM(quantity) quantity
       FROM stock_movements
      WHERE reference_table = ?
      GROUP BY batch_id, item_id
      ORDER BY batch_id`,
    [FIX_REF],
  );
  if (fixRows.length === 0) {
    console.log(`No '${FIX_REF}' movements found — nothing to undo.`);
    await closeDb();
    return;
  }
  const ids = fixRows.map((row) => row.batch_id);
  const batchInfo = new Map<number, BatchRow>();
  for (const row of await db.all<BatchRow>(
    `SELECT sb.id, i.item_type, i.item_name, sb.batch_number, ROUND(sb.quantity_in_stock, 4) now_qty
       FROM stock_batches sb JOIN items i ON i.id = sb.item_id
      WHERE sb.id IN (${ids.map(() => "?").join(",")})`,
    ids,
  )) {
    batchInfo.set(row.id, row);
  }

  type Plan = {
    id: number;
    item_type: string;
    item_name: string;
    batch_number: string;
    now: number;
    fix: number;
    target: number;
  };
  const plan: Plan[] = fixRows.map((row) => {
    const info = batchInfo.get(row.batch_id);
    const fix = Number(row.quantity);
    const now = Number(info?.now_qty ?? 0);
    return {
      id: row.batch_id,
      item_type: info?.item_type ?? "?",
      item_name: info?.item_name ?? `batch ${row.batch_id}`,
      batch_number: info?.batch_number ?? "?",
      now,
      fix,
      target: round4(now - fix),
    };
  });

  // --- reversal entries ----------------------------------------------------
  type Job = { ref: string; narration: string; lines: JournalLineInput[]; originalId: number };
  const jobs: Job[] = [];
  for (const [ref, original, narration] of [
    [REV_OPENING_REF, OPENING_REF, "Reversal - opening stock for negative batches"],
    [REV_ADJUST_REF, ADJUST_REF, "Reversal - raw and packing materials consumed"],
  ] as const) {
    const entry = await db.get<{ id: number; reference_no: string }>(
      "SELECT id, reference_no FROM journal_entries WHERE company_id = 1 AND reference_no = ?",
      [original],
    );
    if (!entry) {
      console.log(`Warning: ${original} not found — its reversal will be skipped.`);
      continue;
    }
    const lines = await db.all<{ account_id: number; debit: number; credit: number; description: string | null }>(
      "SELECT account_id, debit, credit, description FROM journal_entry_lines WHERE journal_entry_id = ? ORDER BY id",
      [entry.id],
    );
    jobs.push({
      ref,
      narration,
      originalId: entry.id,
      lines: lines.map((line) => ({
        accountId: line.account_id,
        ...(Number(line.credit) > 0 ? { debit: Number(line.credit) } : { credit: Number(line.debit) }),
        description: `Reversal - ${line.description ?? original}`,
      })),
    });
  }

  // --- report --------------------------------------------------------------
  const byType = new Map<string, { n: number; now: number; target: number; positive: number }>();
  for (const row of plan) {
    const bucket = byType.get(row.item_type) ?? { n: 0, now: 0, target: 0, positive: 0 };
    bucket.n += 1;
    bucket.now += row.now;
    bucket.target += row.target;
    if (row.target > 0) bucket.positive += 1;
    byType.set(row.item_type, bucket);
  }

  console.log(`\n  ${FIX_REF} movements : ${fixRows.length} batches`);
  console.log("\n  type              n        now       target   positive");
  for (const [type, b] of byType) {
    console.log(
      `  ${type.padEnd(16)} ${String(b.n).padStart(3)} ${b.now.toFixed(2).padStart(10)} ${b.target.toFixed(2).padStart(12)} ${String(b.positive).padStart(9)}`,
    );
  }
  console.log(
    `  ${"TOTAL".padEnd(16)} ${String(plan.length).padStart(3)} ${plan
      .reduce((s, r) => s + r.now, 0)
      .toFixed(2)
      .padStart(10)} ${plan
      .reduce((s, r) => s + r.target, 0)
      .toFixed(2)
      .padStart(12)}`,
  );

  const changed = plan.filter((row) => Math.abs(row.now - row.target) > 1e-9);
  console.log(`\n  batches to change: ${changed.length}`);
  for (const row of changed.sort((a, b) => Math.abs(b.now - b.target) - Math.abs(a.now - a.target)).slice(0, 20)) {
    console.log(
      `    ${row.id.toString().padStart(4)} ${row.item_name.slice(0, 38).padEnd(38)} ${row.now
        .toFixed(2)
        .padStart(12)} -> ${row.target.toFixed(2).padStart(12)}  (fix ${row.fix})`,
    );
  }
  if (changed.length > 20) console.log(`    … and ${changed.length - 20} more`);

  for (const job of jobs) {
    const debit = round2(job.lines.reduce((s, line) => s + Number(line.debit ?? 0), 0));
    const credit = round2(job.lines.reduce((s, line) => s + Number(line.credit ?? 0), 0));
    console.log(`  will post ${job.ref} for ${debit.toFixed(2)} (reverses entry #${job.originalId})`);
    if (debit !== credit) throw new Error(`${job.ref} is unbalanced: debit ${debit} vs credit ${credit}.`);
  }

  if (!apply) {
    console.log("\nDry run — nothing written. Re-run with --apply to undo.");
    await closeDb();
    return;
  }

  await db.transaction(async (tx) => {
    const inside = new AccountingService(tx);

    for (const row of plan) {
      await tx.run("UPDATE stock_batches SET quantity_in_stock = ? WHERE id = ?", [row.target, row.id]);
    }
    const removed = await tx.run("DELETE FROM stock_movements WHERE reference_table = ?", [FIX_REF]);
    console.log(`\nRestored ${plan.length} batches; removed ${removed.changes ?? plan.length} OPENING movements.`);

    for (const job of jobs) {
      const id = await inside.postJournalEntry({
        voucherType: "JOURNAL",
        entryDate,
        narration: job.narration,
        referenceNo: job.ref,
        lines: job.lines,
      });
      await tx.run(
        "UPDATE journal_entries SET source_table = 'journal_entries', source_id = ? WHERE company_id = 1 AND reference_no = ?",
        [job.originalId, job.ref],
      );
      console.log(`Posted ${job.ref} as entry #${id} on ${entryDate}.`);
    }
  });

  // --- verify --------------------------------------------------------------
  const negatives = await db.get<{ n: number }>(
    "SELECT COUNT(*) n FROM stock_batches WHERE quantity_in_stock < 0",
  );
  const balance = await db.get<{ dr: number; cr: number }>(
    "SELECT ROUND(SUM(debit),2) dr, ROUND(SUM(credit),2) cr FROM journal_entry_lines",
  );
  const after = await db.get<{ n: number }>(
    "SELECT COUNT(*) n FROM stock_movements WHERE reference_table = ?",
    [FIX_REF],
  );
  console.log(
    `\ncheck: ${FIX_REF} movements left ${after?.n ?? "?"}; negative batches ${negatives?.n ?? "?"}; ` +
      `trial balance Dr ${balance?.dr} / Cr ${balance?.cr}`,
  );
  await closeDb();
}

main()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
