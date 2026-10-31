// Rebuild ADMIN expenses to match "admin expenses.xlsx" §35.
// Keep seed 6000; hard-delete old 52/53/54 (children first).
//
//   node scripts/coa-admin-expenses-cleanup.mjs                 # data/erp.sqlite
//   node scripts/coa-admin-expenses-cleanup.mjs <db> [--dry]
//   node scripts/coa-admin-expenses-cleanup.mjs --allow-main [--dry]
//
// --allow-main targets SQLITE_CLOUD_URL (production). Pull a backup first.

import { readFileSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const webRoot = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const allowMain = args.includes("--allow-main");
const dbArg = args.find((a) => !a.startsWith("--"));
const COMPANY = 1;

function envValue(key) {
  const file = path.join(webRoot, ".env");
  if (!existsSync(file)) return "";
  const line = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .find((raw) => raw.trim().startsWith(`${key}=`));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : "";
}

function mask(url) {
  return url.replace(/\/\/[^@]*@/, "//***@").replace(/apikey=[^&]+/, "apikey=***");
}

const SEED_CODES = new Set([
  "1000", "1010", "1100", "1200", "1210", "1220", "1300", "1500", "1501",
  "1502", "1503", "1504", "1505", "2000", "2100", "2200", "3000", "3100",
  "4000", "4100", "5000", "5001", "5002", "5100", "5200", "5300", "6000",
  "6100", "6900",
]);

// Blank-name Excel rows skipped: 35100, 35100001-003, 35150011/15/16/19,
// 35350004, 35450002, 35550004-05, 35970002.
const WANT = [
  ["35", "Administrative Expenses", "5"],
  ["35150", "Staff Salaries, Allow. & Other Bene.", "35"],
  ["351500001", "Salary (H.O Staff)", "35150"],
  ["351500002", "Salary (Mill Security Staff)", "35150"],
  ["351500003", "Provident Fund of Head Office", "35150"],
  ["35150010", "Over Time", "35150"],
  ["35150017", "Entertainment - Directors", "35150"],
  ["35150020", "Medical Allowance", "35150"],
  ["35200", "Travelling & Conveyance", "35"],
  ["35200001", "Travelling & Conveyance (H.O)", "35200"],
  ["35200002", "Travelling & Conveyance - Directors", "35200"],
  ["35250", "Postage, Telegram, Telephone & Telex", "35"],
  ["35250001", "Postage & Telegram", "35250"],
  ["35250002", "Telephone", "35250"],
  ["35300", "Printing & Stationery", "35"],
  ["35300001", "Printing & Stationery", "35300"],
  ["35300002", "Computer Accessories", "35300"],
  ["35350", "Vehicles Running & Maintenance", "35"],
  ["35350001", "Vehicles Petrol Bills", "35350"],
  ["35350002", "Vehicles Repairs & Maintenance", "35350"],
  ["35350003", "Vehicle Registration Exp", "35350"],
  ["35350005", "Parking Bill", "35350"],
  ["35400", "Subscription, Periodicals & Fees", "35"],
  ["3540010", "Fee and Subscription", "35400"],
  ["35450", "Staff Welfare", "35"],
  ["35450001", "Staff Welfare Expenses", "35450"],
  ["35500", "Auditors Remuneration", "35"],
  ["35500001", "Audit Fee", "35500"],
  ["35550", "Legal & Professional Charges", "35"],
  ["35550001", "Legal & Professional Charges", "35550"],
  ["35550003", "Other Charges", "35550"],
  ["35600", "Rent, Rate and Taxes", "35"],
  ["35600001", "Rent for Offices", "35600"],
  ["35600004", "Professional Tax", "35600"],
  ["35600005", "Motor Vehicle Tax", "35600"],
  ["35700", "Repair & Maintenance", "35"],
  ["35700006", "Repair General", "35700"],
  ["35750", "Charity & Donation", "35"],
  ["35750001", "Charity & Donation", "35750"],
  ["35750002", "Zakat Deducted by Banks/DFIs on Profit", "35750"],
  ["35750003", "Zakat", "35750"],
  ["35850", "Insurance", "35"],
  ["35850001", "Insurance Expense", "35850"],
  ["35850002", "Insurance Vehicles", "35850"],
  ["35900", "Depreciation Head Office", "35"],
  ["35900001", "Depreciation", "35900"],
  ["35960", "Electric Bills Head Office", "35"],
  ["35960001", "Electricity Bill", "35960"],
  ["359600004", "Sui Gas Consumed (H.O)", "35960"],
  ["35960004", "Wasa Bill (H.O)", "35960"],
  ["35960005", "General Exp.", "35960"],
  ["35970", "Others", "35"],
  ["359700008", "Crockery & Utensils", "35970"],
  ["35970001", "Miscellaneous", "35970"],
  ["6000", "General & Administrative Expenses", "35"],
];

const OLD_ROOTS = ["52", "53", "54"];

async function connect(target) {
  if (target.startsWith("sqlitecloud://")) {
    const { Database } = await import("@sqlitecloud/drivers");
    const db = new Database(target);
    const query = (sql, params = []) =>
      params.length ? db.sql({ query: sql, parameters: params }) : db.sql(sql);
    return {
      label: mask(target),
      cloud: true,
      all: async (sql, params = []) => {
        const out = await query(sql, params);
        return Array.isArray(out) ? out : [];
      },
      run: async (sql, params = []) => query(sql, params),
      exec: async (sql) => {
        await query(sql);
      },
      close: async () => {},
    };
  }
  const { DatabaseSync } = await import("node:sqlite");
  const abs = path.resolve(webRoot, target);
  const db = new DatabaseSync(abs);
  return {
    label: path.relative(webRoot, abs),
    cloud: false,
    path: abs,
    all: async (sql, params = []) => db.prepare(sql).all(...params),
    run: async (sql, params = []) => db.prepare(sql).run(...params),
    exec: async (sql) => db.exec(sql),
    close: async () => db.close(),
  };
}

function collectRemovals(current, wantCodes) {
  const children = new Map();
  for (const a of current.values()) {
    if (a.parent_account_id == null) continue;
    if (!children.has(a.parent_account_id)) children.set(a.parent_account_id, []);
    children.get(a.parent_account_id).push(a);
  }
  const out = new Set();
  const walk = (code) => {
    const a = current.get(code);
    if (!a) return;
    for (const c of children.get(a.id) ?? []) walk(c.account_code);
    if (!wantCodes.has(code) && !SEED_CODES.has(code)) out.add(code);
  };
  for (const root of OLD_ROOTS) walk(root);
  return [...out];
}

async function main() {
  const mainUrl = process.env.SQLITE_CLOUD_URL || envValue("SQLITE_CLOUD_URL");
  let target;
  if (allowMain) {
    if (!mainUrl) {
      console.error("SQLITE_CLOUD_URL not set.");
      process.exit(1);
    }
    target = mainUrl;
  } else {
    target = dbArg ?? "data/erp.sqlite";
  }

  const db = await connect(target);
  const q = (sql, params = []) => db.all(sql, params);
  const load = async () =>
    new Map((await q("SELECT * FROM accounts WHERE company_id = ?", [COMPANY])).map((a) => [a.account_code, a]));

  let map = await load();
  const wantCodes = new Set(WANT.map(([code]) => code));
  const missing = WANT.filter(([code]) => !map.has(code));
  const rename = WANT.filter(([code, name]) => map.has(code) && map.get(code).account_name !== name);
  const reparent = WANT.filter(([code, , parent]) => {
    const a = map.get(code);
    return a && (a.parent_account_id ?? null) !== (map.get(parent)?.id ?? null);
  });
  const REMOVE = collectRemovals(map, wantCodes);

  console.log(
    `db: ${db.label} · ${map.size} accounts · ` +
      `${rename.length} rename, ${reparent.length} re-parent, ${missing.length} add, ${REMOVE.length} remove-candidates`,
  );

  if (dry) {
    for (const [c, n] of rename) console.log(`  rename ${c}: "${map.get(c).account_name}" -> "${n}"`);
    for (const [c, , parent] of reparent) console.log(`  move ${c} -> ${parent}`);
    for (const [c, n, p] of missing) console.log(`  add  ${c} ${n} under ${p}`);
    for (const c of REMOVE) console.log(`  del  ${c} ${map.get(c)?.account_name ?? "?"}`);
    console.log("dry run: no changes written");
    await db.close();
    return;
  }

  if (!db.cloud && db.path?.startsWith(webRoot)) {
    const dir = path.join(webRoot, "backups");
    mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, `pre-coa-admin-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
    await db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    copyFileSync(db.path, dest);
    console.log(`backup: ${path.relative(webRoot, dest)}`);
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  await db.exec("BEGIN");
  try {
    for (const [code, name, parentCode] of WANT) {
      map = await load();
      const existing = map.get(code);
      if (existing && existing.account_type !== "EXPENSE") {
        throw new Error(`code ${code} is already used by ${existing.account_type} "${existing.account_name}"`);
      }
      const parentId = parentCode ? map.get(parentCode)?.id ?? null : null;
      if (parentCode && parentId == null) throw new Error(`missing parent ${parentCode} for ${code}`);
      const isSys = SEED_CODES.has(code) ? 1 : 0;
      if (existing) {
        await db.run(
          `UPDATE accounts SET account_name = ?, parent_account_id = ?, account_type = 'EXPENSE',
             account_subtype = NULL WHERE id = ?`,
          [name, parentId, existing.id],
        );
      } else {
        await db.run(
          `INSERT INTO accounts
             (company_id, account_code, account_name, parent_account_id, account_type,
              account_subtype, opening_balance, is_system_account, is_active, created_at)
           VALUES (?, ?, ?, ?, 'EXPENSE', NULL, 0, ?, 1, ?)`,
          [COMPANY, code, name, parentId, isSys, now],
        );
      }
    }

    const blockers = async () => {
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
        for (const r of await q(sql, [COMPANY])) add(Number(r.id), why);
      }
      return blocked;
    };

    let removed = 0;
    const pending = new Set(REMOVE);
    const skipped = [];
    for (let pass = 0; pass < 8 && pending.size; pass++) {
      const blocked = await blockers();
      map = await load();
      for (const code of [...pending]) {
        const a = map.get(code);
        if (!a) { pending.delete(code); continue; }
        if (SEED_CODES.has(code)) { skipped.push(`${code} is a seed account`); pending.delete(code); continue; }
        if (blocked.get(a.id)) continue;
        await db.run("DELETE FROM accounts WHERE id = ?", [a.id]);
        removed++;
        pending.delete(code);
      }
    }
    const left = await blockers();
    map = await load();
    for (const code of pending) {
      const a = map.get(code);
      skipped.push(`${code}: ${left.get(a?.id)?.join(", ") ?? "still present"}`);
    }

    await db.exec("COMMIT");
    console.log(`removed ${removed} accounts`);
    if (skipped.length) console.log(`kept ${skipped.length}:\n  ${skipped.join("\n  ")}`);
  } catch (err) {
    try { await db.exec("ROLLBACK"); } catch { /* best effort */ }
    throw err;
  }

  map = await load();
  const broken = await q(
    `SELECT c.account_code AS code FROM accounts c LEFT JOIN accounts p ON p.id = c.parent_account_id
      WHERE c.company_id = ? AND c.account_type = 'EXPENSE'
        AND c.parent_account_id IS NOT NULL AND p.id IS NULL`,
    [COMPANY],
  );
  if (broken.length) throw new Error(`broken parents after cleanup: ${JSON.stringify(broken)}`);

  const stillOld = await q(
    `SELECT account_code AS code, account_name AS name FROM accounts
      WHERE company_id = ? AND account_code IN ('52','53','54')`,
    [COMPANY],
  );
  if (stillOld.length) {
    console.log(`warning: old roots still present:\n  ${stillOld.map((r) => `${r.code} ${r.name}`).join("\n  ")}`);
  }

  const seed = map.get("6000");
  const parent35 = map.get("35");
  if (!seed) throw new Error("seed 6000 missing after cleanup");
  if (!parent35) throw new Error("35 missing after cleanup");
  if (seed.parent_account_id !== parent35.id) {
    throw new Error(`6000 parent is ${seed.parent_account_id}, expected 35 id ${parent35.id}`);
  }
  console.log(`admin done · 35 present · seed 6000 OK under 35 · ${map.size} accounts total`);
  await db.close();
}

await main();
