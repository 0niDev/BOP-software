// Party-ledger backfill — links old cash/bank/cheque invoice journal lines to
// their party so they show up in the party ledger.
//
//   node scripts/backfill-invoice-party-links.mjs                 # every configured DB
//   node scripts/backfill-invoice-party-links.mjs <url-or-file>   # one DB
//
// Only the payment line (cash-in-hand / bank account) is tagged; revenue, tax
// and COGS lines stay unlinked. Idempotent: fills only lines where party_id is
// still NULL.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const webRoot = path.resolve(import.meta.dirname, "..");

function envValue(key) {
  const file = path.join(webRoot, ".env");
  if (!existsSync(file)) return "";
  const line = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .find((raw) => raw.trim().startsWith(`${key}=`));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : "";
}

const PAYMENT_ACCOUNTS = `(
  SELECT id FROM accounts WHERE account_code IN ('1000','1010')
  UNION SELECT account_id FROM bank_accounts)`;

const SALES_BACKFILL = `
UPDATE journal_entry_lines
   SET party_id = (SELECT si.customer_id
                     FROM journal_entries je
                     JOIN sales_invoices si ON si.id = je.source_id
                    WHERE je.id = journal_entry_lines.journal_entry_id)
 WHERE party_id IS NULL
   AND journal_entry_id IN (
     SELECT je.id FROM journal_entries je
     JOIN sales_invoices si ON si.id = je.source_id
     WHERE je.source_table = 'sales_invoices' AND si.payment_type <> 'CREDIT')
   AND account_id IN ${PAYMENT_ACCOUNTS}`;

const PURCHASE_BACKFILL = `
UPDATE journal_entry_lines
   SET party_id = (SELECT pi.supplier_id
                     FROM journal_entries je
                     JOIN purchase_invoices pi ON pi.id = je.source_id
                    WHERE je.id = journal_entry_lines.journal_entry_id)
 WHERE party_id IS NULL
   AND journal_entry_id IN (
     SELECT je.id FROM journal_entries je
     JOIN purchase_invoices pi ON pi.id = je.source_id
     WHERE je.source_table = 'purchase_invoices' AND pi.payment_type <> 'CREDIT')
   AND account_id IN ${PAYMENT_ACCOUNTS}`;

const REMAINING = `
SELECT COUNT(*) AS n
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  LEFT JOIN sales_invoices si
         ON je.source_table = 'sales_invoices' AND si.id = je.source_id
  LEFT JOIN purchase_invoices pi
         ON je.source_table = 'purchase_invoices' AND pi.id = je.source_id
 WHERE jel.party_id IS NULL
   AND (si.payment_type IS NOT NULL AND si.payment_type <> 'CREDIT'
        OR pi.payment_type IS NOT NULL AND pi.payment_type <> 'CREDIT')
   AND (jel.account_id IN ${PAYMENT_ACCOUNTS})`;

async function targets() {
  const args = process.argv.slice(2);
  if (args.length > 0) return args;
  const list = [];
  const dev = path.join(webRoot, "data/dev.sqlite");
  if (existsSync(dev)) list.push(dev);
  const main = process.env.SQLITE_CLOUD_URL || envValue("SQLITE_CLOUD_URL");
  if (main) list.push(main);
  const testdb = process.env.SQLITE_CLOUD_TESTDB_URL || envValue("SQLITE_CLOUD_TESTDB_URL");
  if (testdb) list.push(testdb);
  return list;
}

/** Minimal SQLite facade over either the cloud driver or the local node:sqlite. */
async function connect(target) {
  if (target.startsWith("sqlitecloud://")) {
    const { Database } = await import("@sqlitecloud/drivers");
    const db = new Database(target);
    return {
      all: (sql) => db.sql(sql),
      exec: (sql) => db.sql(sql),
      close: async () => {},
    };
  }
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(target);
  return {
    all: (sql) => db.prepare(sql).all(),
    exec: (sql) => db.exec(sql),
    close: async () => db.close(),
  };
}

async function backfill(target) {
  const db = await connect(target);
  try {
    await db.exec(SALES_BACKFILL);
    await db.exec(PURCHASE_BACKFILL);
    const rows = await db.all(REMAINING);
    const missing = Number(rows[0]?.n ?? 0);
    if (missing > 0) {
      console.error(`  ERROR: ${missing} cash/bank invoice line(s) still unlinked`);
      process.exitCode = 1;
    } else {
      console.log("  all cash/bank invoice lines linked to their party");
    }
  } finally {
    await db.close();
  }
}

const list = await targets();
if (list.length === 0) {
  console.error("No database targets. Set SQLITE_CLOUD_URL / SQLITE_CLOUD_TESTDB_URL or pass a URL/path.");
  process.exit(1);
}

for (const target of list) {
  console.log(`\n${target.startsWith("sqlitecloud://") ? "cloud" : "local"}: ${target.replace(/apikey=[^&]+/, "apikey=***")}`);
  try {
    await backfill(target);
  } catch (err) {
    console.error(`  FAILED: ${err?.message ?? err}`);
    process.exitCode = 1;
  }
}

// The cloud driver keeps sockets open; exit once every target is done.
process.exit(process.exitCode ?? 0);
