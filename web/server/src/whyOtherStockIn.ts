/**
 * Read-only diagnostic: what is inside "Other stock in" on the materials
 * consumption report, and does it belong there?
 *
 *   npx tsx server/src/whyOtherStockIn.ts                       # 1 Nov 2026 → today
 *   npx tsx server/src/whyOtherStockIn.ts --from 2026-11-01 --to 2026-11-27
 *
 * "Other stock in" is every debit to the raw/packing inventory accounts in the
 * period that is not a PURCHASE voucher and not a stock correction
 * (reportService.materialsConsumption). Anything else that touches inventory —
 * a reopen reversal, a repost, an opening entry, an imported journal — lands
 * there and lifts consumption by its own amount, so this prints the
 * composition instead of asking anyone to guess.
 *
 * SELECT statements only. Nothing is written.
 */
import { closeDb, getDb } from "./db/index.js";
import { env } from "./env.js";
import { SystemAccountCodes } from "./domain/enums.js";

const RAW = SystemAccountCodes.INVENTORY_RAW_MATERIALS;
const PACKING = SystemAccountCodes.INVENTORY_PACKING_MATERIALS;

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const from = arg("from") ?? "2026-11-01";
const to = arg("to") ?? new Date().toISOString().slice(0, 10);

const money = (value: unknown): string =>
  Number(value ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function table(rows: Record<string, unknown>[]): string {
  const first = rows[0];
  if (!first) return "  (none)";
  const cols = Object.keys(first);
  const width = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)));
  const line = (vals: unknown[]) =>
    "  " + vals.map((v, i) => String(v ?? "").padEnd(width[i] ?? 0)).join("  ");
  return [
    line(cols),
    line(width.map((w) => "-".repeat(w))),
    ...rows.map((r) => line(cols.map((c) => r[c]))),
  ].join("\n");
}

async function main(): Promise<void> {
  const db = getDb();
  console.log(
    `other stock in — engine=${env.dbEngine} company=${env.companyId} ${from} → ${to}\n`,
  );

  const accounts = await db.all<{ account_code: string; account_name: string }>(
    `SELECT account_code, account_name FROM accounts
      WHERE company_id = ? AND account_code IN (?, ?) ORDER BY account_code`,
    [env.companyId, RAW, PACKING],
  );
  const label = new Map(accounts.map((a) => [a.account_code, a.account_name]));

  console.log("### 1. The report's own arithmetic");
  const summary = await db.all<Record<string, unknown>>(
    `SELECT a.account_code account,
            ROUND(SUM(CASE WHEN je.entry_date < ? THEN jel.debit - jel.credit ELSE 0 END), 2) opening,
            ROUND(SUM(CASE WHEN je.entry_date >= ? AND je.entry_date <= ?
                            AND je.voucher_type = 'PURCHASE' THEN jel.debit ELSE 0 END), 2) purchases,
            ROUND(SUM(CASE WHEN je.entry_date >= ? AND je.entry_date <= ?
                            AND je.voucher_type <> 'PURCHASE'
                            AND COALESCE(je.reference_no, '') NOT LIKE '%-STOCK-CORR'
                       THEN jel.debit ELSE 0 END), 2) other_in,
            ROUND(SUM(CASE WHEN je.entry_date >= ? AND je.entry_date <= ?
                            AND je.voucher_type <> 'PURCHASE'
                            AND COALESCE(je.reference_no, '') LIKE '%-STOCK-CORR'
                       THEN jel.debit ELSE 0 END), 2) correction_in,
            ROUND(SUM(CASE WHEN je.entry_date <= ? THEN jel.debit - jel.credit ELSE 0 END), 2) closing
       FROM journal_entry_lines jel
       JOIN accounts a ON a.id = jel.account_id
       JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.company_id = ? AND a.account_code IN (?, ?)
      GROUP BY a.id ORDER BY a.account_code`,
    [from, from, to, from, to, from, to, to, env.companyId, RAW, PACKING],
  );
  for (const row of summary) {
    row.account = `${row.account} ${label.get(String(row.account)) ?? ""}`;
  }
  console.log(table(summary));

  console.log(
    "\n### 2. Every non-purchase debit (in other stock in unless tagged 'correction')",
  );
  const composition = await db.all<Record<string, unknown>>(
    `SELECT a.account_code account,
            je.voucher_type,
            COALESCE(je.source_table, '-') source,
            CASE WHEN COALESCE(je.reference_no, '') LIKE '%STOCK-CORR%'
                 THEN 'correction' ELSE 'other stock in' END bucket,
            COUNT(*) lines,
            COUNT(DISTINCT je.id) entries,
            ROUND(SUM(jel.debit), 2) amount
       FROM journal_entry_lines jel
       JOIN accounts a ON a.id = jel.account_id
       JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.company_id = ?
        AND a.account_code IN (?, ?)
        AND je.entry_date >= ? AND je.entry_date <= ?
        AND je.voucher_type <> 'PURCHASE'
      GROUP BY a.account_code, je.voucher_type, je.source_table, bucket
      ORDER BY amount DESC`,
    [env.companyId, RAW, PACKING, from, to],
  );
  console.log(table(composition));

  console.log("\n### 3. Biggest individual entries in other stock in");
  console.log(
    table(
      await db.all<Record<string, unknown>>(
        `SELECT je.entry_date date, je.voucher_number voucher, je.voucher_type type,
                COALESCE(je.source_table, '-') source, je.source_id src_id,
                substr(COALESCE(je.narration, ''), 1, 60) narration,
                ROUND(jel.debit, 2) amount
           FROM journal_entry_lines jel
           JOIN accounts a ON a.id = jel.account_id
           JOIN journal_entries je ON je.id = jel.journal_entry_id
          WHERE je.company_id = ?
            AND a.account_code IN (?, ?)
            AND je.entry_date >= ? AND je.entry_date <= ?
            AND je.voucher_type <> 'PURCHASE'
            AND COALESCE(je.reference_no, '') NOT LIKE '%STOCK-CORR%'
          ORDER BY jel.debit DESC LIMIT 25`,
        [env.companyId, RAW, PACKING, from, to],
      ),
    ),
  );

  console.log("\n### 4. Checks that explain the usual causes");

  console.log("\na. Purchases that never got a PURCHASE voucher (their debits fall into other stock in):");
  console.log(
    table(
      await db.all<Record<string, unknown>>(
        `SELECT je.voucher_type type, je.source_table source, COUNT(DISTINCT je.id) entries,
                ROUND(SUM(jel.debit), 2) amount
           FROM journal_entry_lines jel
           JOIN accounts a ON a.id = jel.account_id
           JOIN journal_entries je ON je.id = jel.journal_entry_id
          WHERE je.company_id = ? AND a.account_code IN (?, ?)
            AND je.entry_date >= ? AND je.entry_date <= ?
            AND je.voucher_type IN ('JOURNAL', 'OPENING', 'STOCK_ADJUSTMENT')
            AND COALESCE(je.reference_no, '') NOT LIKE '%STOCK-CORR%'
          GROUP BY je.voucher_type, je.source_table ORDER BY amount DESC`,
        [env.companyId, RAW, PACKING, from, to],
      ),
    ),
  );

  console.log("\nb. Purchase invoices in the period vs PURCHASE-voucher inventory debits:");
  console.log(
    table(
      await db.all<Record<string, unknown>>(
        `SELECT (SELECT COUNT(*) FROM purchase_invoices
                  WHERE company_id = ? AND invoice_date >= ? AND invoice_date <= ?) purchase_invoices,
                (SELECT COUNT(DISTINCT je.id) FROM journal_entries je
                   JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
                   JOIN accounts a ON a.id = jel.account_id
                  WHERE je.company_id = ? AND je.voucher_type = 'PURCHASE'
                    AND a.account_code IN (?, ?)
                    AND je.entry_date >= ? AND je.entry_date <= ?) purchase_vouchers`,
        [env.companyId, from, to, env.companyId, RAW, PACKING, from, to],
      ),
    ),
  );

  console.log(
    "\nc. MANUFACTURING debits to inventory (a reopen/repost reversal puts stock back in and lifts other stock in):",
  );
  console.log(
    table(
      await db.all<Record<string, unknown>>(
        `SELECT a.account_code account, COALESCE(je.source_table, '-') source,
                COUNT(DISTINCT je.id) entries,
                ROUND(SUM(jel.debit), 2) debits, ROUND(SUM(jel.credit), 2) credits,
                ROUND(SUM(jel.debit - jel.credit), 2) net
           FROM journal_entry_lines jel
           JOIN accounts a ON a.id = jel.account_id
           JOIN journal_entries je ON je.id = jel.journal_entry_id
          WHERE je.company_id = ? AND a.account_code IN (?, ?)
            AND je.entry_date >= ? AND je.entry_date <= ?
            AND je.voucher_type = 'MANUFACTURING'
          GROUP BY a.account_code, je.source_table ORDER BY debits DESC`,
        [env.companyId, RAW, PACKING, from, to],
      ),
    ),
  );

  console.log("\nd. Orders dated in the period but posted after it (the manufacturingEdits column):");
  console.log(
    table(
      await db.all<Record<string, unknown>>(
        `SELECT je.entry_date date, je.voucher_number voucher, COALESCE(je.source_table, '-') source,
                je.source_id src_id, substr(COALESCE(je.narration, ''), 1, 50) narration,
                ROUND(SUM(jel.credit - jel.debit), 2) net_stock_in
           FROM journal_entry_lines jel
           JOIN accounts a ON a.id = jel.account_id
           JOIN journal_entries je ON je.id = jel.journal_entry_id
           JOIN (SELECT 'production_orders' t, id, manufacturing_date FROM production_orders
                  WHERE company_id = ?
                 UNION ALL
                 SELECT 'packing_orders', id, manufacturing_date FROM packing_orders
                  WHERE company_id = ?) o
             ON o.t = je.source_table AND o.id = je.source_id
          WHERE je.company_id = ? AND a.account_code IN (?, ?)
            AND o.manufacturing_date >= ? AND o.manufacturing_date <= ?
            AND je.entry_date > ?
          GROUP BY je.id ORDER BY je.entry_date DESC LIMIT 25`,
        [env.companyId, env.companyId, env.companyId, RAW, PACKING, from, to, to],
      ),
    ),
  );

  await closeDb();
}

main().catch((err: unknown) => {
  console.error("[why-other-stock-in] failed:", err);
  process.exit(1);
});
