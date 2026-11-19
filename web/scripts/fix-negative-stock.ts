// Clear priced negative stock batches and re-book the inventory correction.
//
//   npx tsx scripts/fix-negative-stock.ts --local                     # dry run
//   npx tsx scripts/fix-negative-stock.ts --local data/erp.sqlite --apply
//   ... --date 2026-11-19
//
// Four steps, one transaction:
//   1. Reverse the old OPENING-STOCK-CORR / PERIODIC-STOCK-CORR pair (posted by
//      post-periodic-stock-correction.ts). Those are the only manual corrections;
//      the app's own manufacturing/reversal entries are never touched.
//   2. Bring every *priced* negative batch to 0 and record the missing receipt
//      as an OPENING movement. Unpriced batches are left alone — there is no
//      value to book for them.
//   3. Dr 1200/1210/1220 / Cr 3100 for the opening value just added.
//   4. Dr 5000 COGS / Cr 1200 + 1210 so each raw/packing account lands on the
//      counted batch value. Finished goods are NOT trued up here — that needs a
//      physical count (see P0).
//
// Re-running is safe: every entry carries a fixed reference number and the
// whole run is skipped once OPENING-STOCK-CORR-2 exists.

import { existsSync } from "node:fs";
import type { JournalLineInput } from "../server/src/services/accountingService.js";

const OLD_REFS = ["OPENING-STOCK-CORR", "PERIODIC-STOCK-CORR"];
const REV_REFS = ["REV-OPENING-STOCK-CORR", "REV-PERIODIC-STOCK-CORR"];
const OPENING_REF = "OPENING-STOCK-CORR-2";
const ADJUST_REF = "PERIODIC-STOCK-CORR-2";
const MAX_ADJUSTMENT = 6_000_000;

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const force = args.includes("--force");
const dateArg = args.indexOf("--date");
const entryDate = dateArg >= 0 ? args[dateArg + 1] : new Date().toISOString().slice(0, 10);

const localArg = args.indexOf("--local");
const useLocal = localArg >= 0;
if (useLocal) {
  process.env.ERP_DB_ENGINE = "local";
  const target = args[localArg + 1];
  if (target && !target.startsWith("--")) process.env.ERP_LOCAL_DB = target;
}

/** Batch cost when it has one, else the item's purchase price. */
const UNIT_COST = "COALESCE(NULLIF(sb.purchase_price,0), i.purchase_price, 0)";

/** Inventory account per item type — mirrors INVENTORY_ACCOUNT_BY_TYPE. */
const ACCOUNT_FOR_TYPE: Record<string, string> = {
  RAW_MATERIAL: "1200",
  PACKING_MATERIAL: "1210",
  FINISHED_GOOD: "1220",
};
/** Types the periodic true-up may touch (finished goods wait for the count). */
const TRUE_UP_TYPES = ["RAW_MATERIAL", "PACKING_MATERIAL"];

type NegativeBatch = {
  id: number;
  item_id: number;
  warehouse_id: number;
  item_type: string;
  batch_number: string;
  quantity: number;
  price: number;
};

async function main(): Promise<void> {
  const { getDb } = await import("../server/src/db/index.js");
  const { env } = await import("../server/src/env.js");
  const { AccountingService } = await import("../server/src/services/accountingService.js");

  const db = getDb();
  console.log(
    `Database: ${
      useLocal ? `${env.localDbPath} (local — the service must be stopped)` : "(cloud)"
    }  date: ${entryDate}`,
  );

  const existing = new Set(
    (
      await db.all<{ reference_no: string }>(
        "SELECT reference_no FROM journal_entries WHERE company_id = 1 AND reference_no IS NOT NULL",
      )
    ).map((r) => r.reference_no),
  );
  if (existing.has(OPENING_REF)) {
    console.log(`${OPENING_REF} already posted — nothing to do.`);
    return;
  }

  const accountIds = new Map<string, number>();
  for (const row of await db.all<{ id: number; account_code: string }>(
    "SELECT id, account_code FROM accounts WHERE company_id = 1 AND account_code IN ('1200','1210','1220','3100','5000')",
  )) {
    accountIds.set(row.account_code, row.id);
  }
  const account = (code: string): number => {
    const id = accountIds.get(code);
    if (!id) throw new Error(`Account ${code} not found.`);
    return id;
  };

  // --- 1. reversal of the old correction pair -------------------------------
  type Job = { ref: string; narration: string; lines: JournalLineInput[]; total: number };
  const jobs: Job[] = [];

  for (let i = 0; i < OLD_REFS.length; i += 1) {
    if (existing.has(REV_REFS[i])) continue;
    const entry = await db.get<{ id: number; reference_no: string; narration: string | null }>(
      "SELECT id, reference_no, narration FROM journal_entries WHERE company_id = 1 AND reference_no = ?",
      [OLD_REFS[i]],
    );
    if (!entry) continue;
    const lines = await db.all<{ account_id: number; debit: number; credit: number; description: string | null }>(
      "SELECT account_id, debit, credit, description FROM journal_entry_lines WHERE journal_entry_id = ? ORDER BY id",
      [entry.id],
    );
    const total = lines.reduce((sum, l) => sum + Number(l.debit), 0);
    jobs.push({
      ref: REV_REFS[i],
      narration: `Reversal - ${entry.reference_no}`,
      total,
      lines: lines.map((l) => ({
        accountId: l.account_id,
        ...(Number(l.credit) > 0 ? { debit: Number(l.credit) } : { credit: Number(l.debit) }),
        description: `Reversal - ${l.description ?? entry.reference_no}`,
      })),
    });
  }

  // --- 2. priced negative batches -> 0 -------------------------------------
  const negatives = await db.all<NegativeBatch>(
    `SELECT sb.id, sb.item_id, sb.warehouse_id, i.item_type, sb.batch_number,
            ROUND(sb.quantity_in_stock, 4) quantity, ${UNIT_COST} price
     FROM stock_batches sb
     JOIN items i ON i.id = sb.item_id
     WHERE i.company_id = 1 AND sb.quantity_in_stock < 0 AND ${UNIT_COST} > 0
     ORDER BY sb.id`,
  );
  const skipped = await db.get<{ n: number }>(
    `SELECT COUNT(*) n FROM stock_batches sb JOIN items i ON i.id = sb.item_id
     WHERE i.company_id = 1 AND sb.quantity_in_stock < 0 AND ${UNIT_COST} <= 0`,
  );

  const openingByType = new Map<string, number>();
  for (const b of negatives) {
    const code = ACCOUNT_FOR_TYPE[b.item_type];
    if (!code) throw new Error(`No inventory account for item type ${b.item_type}.`);
    openingByType.set(
      b.item_type,
      (openingByType.get(b.item_type) ?? 0) + Math.abs(b.quantity) * b.price,
    );
  }
  const round2 = (n: number): number => Math.round(n * 100) / 100;
  for (const [type, v] of openingByType) openingByType.set(type, round2(v));
  const openingTotal = round2([...openingByType.values()].reduce((s, v) => s + v, 0));

  // --- 3. balances and counted values (after the opening value is added) ----
  const balances = new Map<string, number>();
  for (const row of await db.all<{ account_code: string; net: number }>(
    `SELECT a.account_code, ROUND(SUM(jel.debit - jel.credit), 2) net
     FROM journal_entry_lines jel
     JOIN accounts a ON a.id = jel.account_id
     JOIN journal_entries je ON je.id = jel.journal_entry_id
     WHERE je.company_id = 1 AND a.account_code IN ('1200','1210','1220')
     GROUP BY a.id`,
  )) {
    balances.set(row.account_code, Number(row.net));
  }
  // The true-up must land on the balances *after* the reversal. The reversal is
  // posted inside the same transaction, so subtract the not-yet-reversed old
  // correction here (a re-run that already reversed it skips this).
  for (let i = 0; i < OLD_REFS.length; i += 1) {
    if (existing.has(REV_REFS[i])) continue;
    for (const row of await db.all<{ account_code: string; net: number }>(
      `SELECT a.account_code, ROUND(SUM(jel.debit - jel.credit), 2) net
       FROM journal_entry_lines jel
       JOIN accounts a ON a.id = jel.account_id
       JOIN journal_entries je ON je.id = jel.journal_entry_id
       WHERE je.company_id = 1 AND je.reference_no = ? AND a.account_code IN ('1200','1210','1220')
       GROUP BY a.id`,
      [OLD_REFS[i]],
    )) {
      balances.set(row.account_code, round2((balances.get(row.account_code) ?? 0) - Number(row.net)));
    }
  }
  const counted = new Map<string, number>();
  for (const row of await db.all<{ item_type: string; v: number }>(
    `SELECT i.item_type, ROUND(SUM(sb.quantity_in_stock * ${UNIT_COST}), 2) v
     FROM stock_batches sb JOIN items i ON i.id = sb.item_id
     WHERE i.company_id = 1 AND sb.quantity_in_stock > 0 AND sb.is_active = 1
     GROUP BY i.item_type`,
  )) {
    counted.set(row.item_type, Number(row.v));
  }

  // The opening entry is posted before the true-up, so its value counts as part
  // of the balance the true-up has to move; it is also part of the batch value.
  const plan = Object.values(ACCOUNT_FOR_TYPE).map((code) => {
    const type = Object.keys(ACCOUNT_FOR_TYPE).find((t) => ACCOUNT_FOR_TYPE[t] === code)!;
    const balance = balances.get(code) ?? 0;
    const opening = openingByType.get(type) ?? 0;
    const target = counted.get(type) ?? 0;
    return { code, type, balance, opening, target, delta: round2(balance + opening - target) };
  });

  if (openingTotal > 0) {
    jobs.push({
      ref: OPENING_REF,
      total: openingTotal,
      narration: "Opening stock for negative batches brought into the inventory accounts",
      lines: plan
        .filter((p) => p.opening > 0)
        .map((p) => ({
          accountId: account(p.code),
          debit: p.opening,
          description: `Opening stock — ${p.type.toLowerCase().replace("_", " ")}`,
        }))
        .concat([{ accountId: account("3100"), credit: openingTotal, description: "Opening stock" }]),
    });
  }

  const tuneUp = plan.filter((p) => TRUE_UP_TYPES.includes(p.type) && Math.abs(p.delta) >= 0.01);
  const adjustTotal = round2(tuneUp.reduce((s, p) => s + p.delta, 0));
  if (tuneUp.length > 0) {
    const lines: JournalLineInput[] = [
      adjustTotal > 0
        ? { accountId: account("5000"), debit: adjustTotal, description: "Materials consumed" }
        : {
            accountId: account("5000"),
            credit: -adjustTotal,
            description: "Materials consumption reversed — stock over the books",
          },
      ...tuneUp.map((p) => ({
        accountId: account(p.code),
        ...(p.delta > 0 ? { credit: p.delta } : { debit: -p.delta }),
        description: `Consumed ${p.type.toLowerCase().replace("_", " ")}`,
      })),
    ];
    jobs.push({
      ref: ADJUST_REF,
      total: adjustTotal,
      narration: "Raw and packing materials consumed — opening + purchases less closing stock",
      lines,
    });
  }

  // --- report ---------------------------------------------------------------
  console.log(`\n  priced negative batches -> 0 : ${negatives.length}`);
  console.log(`  unpriced negative batches   : ${skipped?.n ?? 0} (left alone, no value to book)`);
  console.log("\n            balance    + opening    - counted   = adjustment");
  for (const p of plan) {
    console.log(
      `  ${p.code} ${p.type.padEnd(16)} ${p.balance.toFixed(2).padStart(12)} ${p.opening
        .toFixed(2)
        .padStart(12)} ${p.target.toFixed(2).padStart(12)} ${p.delta.toFixed(2).padStart(14)}${
        TRUE_UP_TYPES.includes(p.type) ? "" : "   (not trued up)"
      }`,
    );
  }
  if (jobs.length === 0) {
    console.log("\nNothing to post.");
    return;
  }
  for (const job of jobs) console.log(`  will post ${job.ref} for ${job.total.toFixed(2)}`);

  if (Math.abs(adjustTotal) > MAX_ADJUSTMENT && !force) {
    throw new Error(
      `Adjustment ${adjustTotal.toFixed(2)} exceeds the ${MAX_ADJUSTMENT} cap — check the count first (use --force to override).`,
    );
  }
  for (const job of jobs) {
    const debit = round2(job.lines.reduce((s, l) => s + Number(l.debit ?? 0), 0));
    const credit = round2(job.lines.reduce((s, l) => s + Number(l.credit ?? 0), 0));
    if (debit !== credit) {
      throw new Error(`${job.ref} is unbalanced: debit ${debit} vs credit ${credit}.`);
    }
  }

  if (!apply) {
    console.log("\nDry run — nothing written. Re-run with --apply to post.");
    return;
  }

  await db.transaction(async (tx) => {
    const inside = new AccountingService(tx);

    // Reverse first, so the true-up below sees the post-reversal balances.
    for (const job of jobs.filter((j) => REV_REFS.includes(j.ref))) {
      const id = await inside.postJournalEntry({
        voucherType: "JOURNAL",
        entryDate,
        narration: job.narration,
        referenceNo: job.ref,
        lines: job.lines,
      });
      // Same marker reverseManualJournal uses, so the UI cannot reverse it twice.
      const original = OLD_REFS[REV_REFS.indexOf(job.ref)];
      await tx.run(
        "UPDATE journal_entries SET source_table = 'journal_entries', source_id = ? WHERE company_id = 1 AND reference_no = ?",
        [id, original],
      );
      console.log(`Posted ${job.ref} as entry #${id} on ${entryDate}.`);
    }

    for (const b of negatives) {
      await tx.run("UPDATE stock_batches SET quantity_in_stock = 0 WHERE id = ?", [b.id]);
      await tx.run(
        `INSERT INTO stock_movements
           (item_id, batch_id, warehouse_id, movement_type, quantity, unit_cost,
            reference_table, movement_date, notes)
         VALUES (?, ?, ?, 'OPENING', ?, ?, 'negative_stock_fix', ?, ?)`,
        [
          b.item_id,
          b.id,
          b.warehouse_id,
          Math.abs(b.quantity),
          b.price,
          entryDate,
          `Missing receipt for negative batch ${b.batch_number}`,
        ],
      );
    }
    console.log(`Cleared ${negatives.length} priced negative batches and recorded their OPENING movements.`);

    for (const job of jobs.filter((j) => !REV_REFS.includes(j.ref))) {
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
