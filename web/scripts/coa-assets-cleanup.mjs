// Rebuild the ASSET side of the chart of accounts to the "assets coa.xml"
// structure: rename + re-parent the existing accounts, add the missing levels,
// then hard-delete only accounts the app itself would allow (zero postings,
// zero links, no active children) — same rules as AccountService.delete().
//
//   node scripts/coa-assets-cleanup.mjs              # data/erp.sqlite (backs up first)
//   node scripts/coa-assets-cleanup.mjs <db> [--dry]
//
// Read/Write on the given file only. Never point it at maindb/SQLITE_CLOUD_URL.

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

const webRoot = path.resolve(import.meta.dirname, "..");
const dbPath = path.resolve(webRoot, process.argv[2] ?? "data/erp.sqlite");
const dry = process.argv.includes("--dry");
const COMPANY = 1;

// Seed codes the app looks up by code (server/src/db/bootstrap.ts). Their rows
// are never deleted regardless of what the tree says.
const SEED_CODES = new Set([
  "1000", "1010", "1100", "1200", "1210", "1220", "1300", "1500", "1501",
  "1502", "1503", "1504", "1505",
]);

// Desired asset rows: [code, name, parentCode | null], parents first.
// Existing codes are renamed/re-parented in place (ids and history untouched);
// new codes are inserted as empty accounts.
const WANT = [
  ["11", "Fixed Assets", "1"],
  ["12", "Leased Assets", "1"],
  ["13", "Current Assets", "1"],

  ["1101", "Fixed Assets At Cost", "11"],
  ["110101", "Land", "1101"],
  ["110104", "Electric Installation", "1101"],
  ["110105", "Factory Equipments", "1101"],
  ["110107", "Electric Appliances", "1101"],
  ["1501", "Furniture & Fixture", "1101"],
  ["1502", "Office Equipment", "1101"],
  ["1503", "Plant & Machinery", "1101"],
  ["1504", "Vehicles", "1101"],
  ["1505", "Building", "1101"],

  ["1102", "Accumulated Depreciation", "11"],
  ["110201", "Acc.Dep on Land", "1102"],
  ["110203", "Acc.Dep on Plant and Machinery", "1102"],
  ["110204", "Acc.Dep on Electric Installations", "1102"],
  ["110205", "Acc.Dep on Factory Equipments", "1102"],
  ["1212", "Acc.Dep on Vehicles", "1102"],
  ["1222", "Acc.Dep on Furniture & Fixture", "1102"],
  ["1232", "Acc.Dep on Building", "1102"],
  ["1242", "Acc.Dep on Office Equipment", "1102"],
  ["1252", "Acc.Dep on Accounting Software", "1102"],

  ["1105", "Fixed Assets - Intangible", "11"],
  ["1251", "Accounting Software", "1105"],

  ["120101", "Solar", "12"],
  ["120102", "Vehicles (Leased)", "12"],

  ["1200", "Raw Material Purchase", "13"],
  ["152210002", "Freight & Other Chgs of Purchase", "1200"],
  ["1210", "Packing Material", "13"],
  ["15230", "Work-in-Process", "13"],
  ["1220", "Finished Goods", "13"],
  ["15250", "Waste Stock", "13"],

  ["15500", "Loan & Advances", "13"],
  ["1550002", "Advance to Suppliers", "15500"],
  ["1550005", "Advance Against Salary", "15500"],
  ["1550006", "Advance to Mill Employes", "15500"],

  ["132", "Advance Deposit & Prepayments", "13"],
  ["15630001", "Prepaid Insurance", "132"],

  ["15700", "Other Receivable", "13"],
  ["131", "Sales Tax Receivable", "15700"],
  ["1570002", "Other Receivables", "15700"],
  ["1300", "Withholding Tax Receivable", "15700"],
  ["1100", "Accounts Receivable", "15700"],

  ["15800", "Cash and Bank Balances", "13"],
  ["1000", "Cash in Hand", "15800"],
  ["15810001", "Cash at Head Office", "1000"],
  ["15810002", "Cash at Mills", "1000"],
  ["1010", "Balance with Banks on Current A/c", "15800"],
];

// Import scaffolding / duplicate rows to remove once everything moved out.
const REMOVE = [
  "111", "112", "113", "1131", "1132", "11321", "11322", "1133", "11331",
  "11332", "1134", "1135", "1136", "1137", "1137001", "1137002", "1138",
  "1138001", "1138002",
  "121", "1211", "122", "1221", "123", "1231", "124", "1241", "125",
  "14", "14001", "12001", "12002", "12003", "13001", "133", "134",
  "6", "61", "62", "63", "64", "ACCOUNT-00001", "ACCOUNT-00002",
];

const db = new DatabaseSync(dbPath);
const q = (sql, args = []) => db.prepare(sql).all(...args);

const byCode = () =>
  new Map(q("SELECT * FROM accounts WHERE company_id = ?", [COMPANY]).map((a) => [a.account_code, a]));

const normalizeType = (row) => (row.account_type === "ASSET" ? row : null);

let map = byCode();
const missing = WANT.filter(([code]) => !map.has(code));
const rename = WANT.filter(([code, name]) => map.has(code) && map.get(code).account_name !== name);
const reparent = WANT.filter(([code, , parent]) => {
  const a = map.get(code);
  return a && (a.parent_account_id ?? null) !== (map.get(parent)?.id ?? null);
});
console.log(
  `db: ${path.relative(webRoot, dbPath)} · ${map.size} accounts · ` +
    `${rename.length} rename, ${reparent.length} re-parent, ${missing.length} add, <${REMOVE.length} delete candidates`,
);

if (dry) {
  for (const [c, n] of rename) console.log(`  rename  ${c}: ${map.get(c).account_name} -> ${n}`);
  for (const [c, , p] of reparent) console.log(`  move    ${c} -> ${p}`);
  for (const [c, n, p] of missing) console.log(`  add     ${c} ${n} under ${p}`);
  console.log("dry run: no changes written");
  process.exit(0);
}

if (existsSync(dbPath) && dbPath.startsWith(webRoot)) {
  const dir = path.join(webRoot, "backups");
  mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `pre-coa-assets-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  copyFileSync(dbPath, dest);
  console.log(`backup: ${path.relative(webRoot, dest)}`);
}

const now = new Date().toISOString().replace("T", " ").slice(0, 19);
const upsert = db.prepare(
  `INSERT INTO accounts
     (company_id, account_code, account_name, parent_account_id, account_type,
      account_subtype, opening_balance, is_system_account, is_active, created_at)
   VALUES (?, ?, ?, ?, 'ASSET', ?, 0, ?, 1, ?)
   ON CONFLICT(company_id, account_code) DO UPDATE SET
     account_name = excluded.account_name,
     parent_account_id = excluded.parent_account_id,
     account_subtype = COALESCE(accounts.account_subtype, excluded.account_subtype)`,
);

const CURRENT = new Set(["1000", "1010", "1100", "1200", "1210", "1220", "1300", "132", "131",
  "110101", "110201", "15500", "1550002", "1550005", "1550006", "15630001", "15700",
  "1570002", "15800", "15810001", "15810002", "15230", "15250", "152210002"]);

db.exec("BEGIN");
try {
  for (const [code, name, parentCode] of WANT) {
    const parentId = parentCode ? byCode().get(parentCode)?.id ?? null : null;
    if (parentCode && parentId == null) throw new Error(`missing parent ${parentCode} for ${code}`);
    upsert.run(
      COMPANY, code, name, parentId,
      CURRENT.has(code) ? "CURRENT_ASSET" : "NON_CURRENT_ASSET",
      SEED_CODES.has(code) ? 1 : 0, now,
    );
  }

  // --- deletion guard: same blockers as AccountRepository.deleteBlockers -------
  // Recomputed every pass: deleting a child unblocks its parent.
  const blockers = () => {
    const blocked = new Map();
    const addBlock = (id, why) => blocked.set(id, [...(blocked.get(id) ?? []), why]);
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
      for (const r of q(sql, [COMPANY])) addBlock(Number(r.id), why);
    }
    return blocked;
  };

  let removed = 0;
  const skipped = [];
  const pending = new Set(REMOVE);
  for (let pass = 0; pass < 5 && pending.size; pass++) {
    for (const code of [...pending]) {
      const a = byCode().get(code);
      if (!a) { pending.delete(code); continue; }
      if (SEED_CODES.has(code)) { skipped.push(`${code} is a seed account`); pending.delete(code); continue; }
      if (blockers().get(a.id)) continue; // children may still be pending; retry next pass
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
const bad = q(
  `SELECT c.account_code AS code, c.parent_account_id AS parent
     FROM accounts c LEFT JOIN accounts p ON p.id = c.parent_account_id
    WHERE c.company_id = ? AND c.account_type = 'ASSET'
      AND c.parent_account_id IS NOT NULL AND p.id IS NULL`,
  [COMPANY],
);
if (bad.length) throw new Error(`broken parents after cleanup: ${JSON.stringify(bad)}`);
const stats = q(
  `SELECT COUNT(*) AS n, SUM(is_active) AS active,
          (SELECT COUNT(*) FROM journal_entry_lines l JOIN accounts a ON a.id = l.account_id
            WHERE a.account_type = 'ASSET') AS lines
     FROM accounts WHERE company_id = ? AND account_type = 'ASSET'`,
  [COMPANY],
)[0];
console.log(`assets now: ${stats.n} accounts (${stats.active} active, ${stats.lines} journal lines) — no broken parents`);
db.close();
