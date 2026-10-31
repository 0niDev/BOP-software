// Rebuild the non-admin (manufacturing) side of the chart of accounts to the
// "expenses coa.ods" structure. Same mechanics as coa-assets-cleanup.mjs:
// rename/re-parent in place, add the missing levels, then hard-delete only
// accounts the app itself would allow.
//
//   node scripts/coa-expenses-cleanup.mjs              # data/erp.sqlite (backs up first)
//   node scripts/coa-expenses-cleanup.mjs <db> [--dry]

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

const webRoot = path.resolve(import.meta.dirname, "..");
const dbPath = path.resolve(webRoot, process.argv[2] ?? "data/erp.sqlite");
const dry = process.argv.includes("--dry");
const COMPANY = 1;

// Bootstrap seeds: never deleted, codes never changed.
const SEED_CODES = new Set([
  "1000", "1010", "1100", "1200", "1210", "1220", "1300", "1500", "1501",
  "1502", "1503", "1504", "1505", "2000", "2100", "2200", "3000", "3100",
  "4000", "4100", "5000", "5001", "5002", "5100", "5200", "5300", "6000",
  "6100", "6900",
]);

// [code, name, parentCode | null, type?, subtype?] — parents before children.
// Rows without a type are EXPENSE. Cross-type moves (516 -> assets) spell it out.
const WANT = [
  ["56", "Raw Materials", "5"],
  ["5002", "Raw Material Consumed", "56"],

  ["57", "Store & Spares", "5"],

  ["58", "Packing Material", "5"],
  ["5001", "Packing Material", "58"],
  ["33003", "Polypropline Bags", "58"],
  ["33004", "Polythene Bags", "58"],
  ["33006", "Miscellaneous", "58"],

  ["59", "Manufacturing Expenses", "5"],

  ["34100", "Salaries, Wages and Benefits (Mfg)", "59"],
  ["517", "Salary/Wages", "34100"],
  ["542", "Overtime", "34100"],
  ["52012", "Medical Allowance (Mfg)", "34100"],
  ["34100012", "Final Settlement (Mfg)", "34100"],
  ["34100013", "Others", "34100"],
  ["34100016", "Canteen Subsidy & Expenses", "34100"],

  ["540", "Fuel and Power", "59"],
  ["5209041", "Electric Power Bills", "540"],
  ["5209042", "Sui Gas", "540"],
  ["34200003", "Diesel", "540"],

  ["34250", "Travelling & Conveyance", "59"],
  ["52052", "Travelling & Conveyance (Site)", "34250"],
  ["52054", "Entertainment Expenses (Site)", "34250"],

  ["52063", "Insurance", "59"],
  ["34300002", "Group Insurance Expense", "52063"],

  ["34350", "Repairs and Maintenance", "59"],
  ["5113", "Repair Plant and Machinery", "34350"],
  ["52025", "Repair & Maint Computers (Mills)", "34350"],
  ["34350002", "Repair Mill Building/Colony", "34350"],
  ["34350003", "Repair Other Equipments Used in Factory", "34350"],
  ["34350004", "Repair General", "34350"],

  ["55", "Vehicle Running Expenses", "59"],
  ["55001", "Vehicle Repair (Mill)", "55"],
  ["34550001", "Vehicle Petrol Bills (Mill)", "55"],
  ["34550003", "Misc Expenses", "55"],
  ["34550004", "Vehicle Token Tax & Others", "55"],

  ["5203", "Depreciation", "59"],
  ["64008", "Miscellaneous Expenses", "59"],

  ["51", "Selling", "5"],
  ["511", "Cost of Goods Sold", "51"],
  ["5000", "Cost of Goods Sold", "511"],
  ["515", "Purchase Return Cost Difference", "511"],
  ["518", "Salesman Salary", "6100"],
  ["519", "L.C Market Expenses", "6100"],
  ["513", "Customer Claimed Stock Value", "51"],
  ["5200", "Manufacturing Wastage Expense", "59"],
  ["5300", "Inventory Loss / Expiry Expense", "59"],

  // Salary advance is an asset by nature; move it to Loan & Advances.
  ["516", "Staff Salary Advance", "15500", "ASSET", "CURRENT_ASSET"],
];

const REMOVE = ["52014", "52015", "514", "5111", "5112"];

const db = new DatabaseSync(dbPath);
const q = (sql, args = []) => db.prepare(sql).all(...args);
const byCode = () =>
  new Map(q("SELECT * FROM accounts WHERE company_id = ?", [COMPANY]).map((a) => [a.account_code, a]));

const map = byCode();
const missing = WANT.filter(([code]) => !map.has(code));
const rename = WANT.filter(([code, name]) => map.has(code) && map.get(code).account_name !== name);
const reparent = WANT.filter(([code, , parent]) => {
  const a = map.get(code);
  return a && (a.parent_account_id ?? null) !== (map.get(parent)?.id ?? null);
});
console.log(
  `db: ${path.relative(webRoot, dbPath)} · ${map.size} accounts · ` +
    `${rename.length} rename, ${reparent.length} re-parent, ${missing.length} add`,
);

if (dry) {
  for (const [c, , parent] of reparent) console.log(`  move ${c} -> ${parent}`);
  for (const [c, n, p] of missing) console.log(`  add  ${c} ${n} under ${p}`);
  console.log("dry run: no changes written");
  process.exit(0);
}

if (existsSync(dbPath) && dbPath.startsWith(webRoot)) {
  const dir = path.join(webRoot, "backups");
  mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `pre-coa-expenses-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  copyFileSync(dbPath, dest);
  console.log(`backup: ${path.relative(webRoot, dest)}`);
}

const now = new Date().toISOString().replace("T", " ").slice(0, 19);
const upsert = db.prepare(
  `INSERT INTO accounts
     (company_id, account_code, account_name, parent_account_id, account_type,
      account_subtype, opening_balance, is_system_account, is_active, created_at)
   VALUES (?, ?, ?, ?, ?, ?, 0, ?, 1, ?)
   ON CONFLICT(company_id, account_code) DO UPDATE SET
     account_name = excluded.account_name,
     parent_account_id = excluded.parent_account_id,
     account_type = excluded.account_type,
     account_subtype = excluded.account_subtype`,
);

db.exec("BEGIN");
try {
  for (const row of WANT) {
    const [code, name, parentCode, type = "EXPENSE", subtype = null] = row;
    const existing = byCode().get(code);
    // A code collision with another account type means the XML code is already
    // taken (31 "Capital investment" is the one that bit us) — refuse loudly.
    if (existing && existing.account_type !== type && row.length < 4) {
      throw new Error(
        `code ${code} is already used by ${existing.account_type} "${existing.account_name}"`,
      );
    }
    const parentId = parentCode ? byCode().get(parentCode)?.id ?? null : null;
    if (parentCode && parentId == null) throw new Error(`missing parent ${parentCode} for ${code}`);
    upsert.run(COMPANY, code, name, parentId, type, subtype, SEED_CODES.has(code) ? 1 : 0, now);
  }

  // Same deletion blockers as AccountRepository.deleteBlockers, recomputed per
  // pass so deleting a child unblocks its parent.
  const blockers = () => {
    const blocked = new Map();
    const add = (id, why) => blocked.set(id, [...(blocked.get(id) ?? []), why]);
    for (const [sql, why] of [
      [`SELECT DISTINCT l.account_id AS id FROM journal_entry_lines l
          JOIN journal_entries e ON e.id = l.journal_entry_id WHERE e.company_id = ?`, "journal entries"],
      ["SELECT account_id AS id FROM parties WHERE account_id IS NOT NULL AND company_id = ?", "parties"],
      ["SELECT account_id AS id FROM bank_accounts WHERE account_id IS NOT NULL AND company_id = ?", "bank account"],
      ["SELECT account_id AS id FROM expense_categories WHERE account_id IS NOT NULL AND company_id = ?", "expense category"],
      ["SELECT d.account_id AS id FROM asset_details d JOIN accounts a ON a.id = d.account_id WHERE a.company_id = ?", "asset details"],
      [`SELECT DISTINCT c.parent_account_id AS id FROM accounts c
          JOIN accounts p ON p.id = c.parent_account_id WHERE p.company_id = ?`, "sub-accounts"],
    ]) {
      for (const r of q(sql, [COMPANY])) add(Number(r.id), why);
    }
    return blocked;
  };

  let removed = 0;
  const pending = new Set(REMOVE);
  const skipped = [];
  for (let pass = 0; pass < 5 && pending.size; pass++) {
    for (const code of [...pending]) {
      const a = byCode().get(code);
      if (!a) { pending.delete(code); continue; }
      if (SEED_CODES.has(code)) { skipped.push(`${code} is a seed account`); pending.delete(code); continue; }
      if (blockers().get(a.id)) continue;
      db.prepare("DELETE FROM accounts WHERE id = ?").run(a.id);
      removed++;
      pending.delete(code);
    }
  }
  const left = blockers();
  for (const code of pending) skipped.push(`${code}: ${left.get(byCode().get(code)?.id)?.join(", ")}`);

  db.exec("COMMIT");
  console.log(`removed ${removed} accounts`);
  if (skipped.length) console.log(`kept ${skipped.length}:\n  ${skipped.join("\n  ")}`);
} catch (err) {
  db.exec("ROLLBACK");
  throw err;
}

// --- verify ---------------------------------------------------------------------
const broken = q(
  `SELECT c.account_code AS code FROM accounts c LEFT JOIN accounts p ON p.id = c.parent_account_id
    WHERE c.company_id = ? AND c.account_type = 'EXPENSE'
      AND c.parent_account_id IS NOT NULL AND p.id IS NULL`,
  [COMPANY],
);
if (broken.length) throw new Error(`broken parents after cleanup: ${JSON.stringify(broken)}`);
const stats = q(
  `SELECT COUNT(*) AS n,
          (SELECT COUNT(*) FROM journal_entry_lines l JOIN accounts a ON a.id = l.account_id
            WHERE a.account_type = 'EXPENSE') AS lines
     FROM accounts WHERE company_id = ? AND account_type = 'EXPENSE'`,
  [COMPANY],
)[0];
console.log(`expenses now: ${stats.n} accounts, ${stats.lines} journal lines — no broken parents`);
db.close();
