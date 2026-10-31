// Add Excel "admin expenses.xlsx" §36 selling, §37 financial, §43 tax.
// Re-parent seed 6100 under 36. Finish leftover COGS reparents from the mfg
// pass (5000 under 511; drop empty 5111/5112/514 when deletable).
//
//   node scripts/coa-pnl-expenses-cleanup.mjs                 # data/erp.sqlite
//   node scripts/coa-pnl-expenses-cleanup.mjs <db> [--dry]
//   node scripts/coa-pnl-expenses-cleanup.mjs --allow-main [--dry]

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

// [code, name, parentCode] — parents before children.
const WANT = [
  ["36", "Selling and Distribution Expenses", "5"],
  ["36100", "Selling Exps Local Sale", "36"],
  ["3610001", "Loading Charges", "36100"],
  ["3610003", "Freight on Local Sale", "36100"],
  ["3610004", "Brokerage on L.Sale", "36100"],
  ["6100", "Selling Expenses", "36"],
  ["518", "Salesman Salary", "6100"],
  ["519", "L.C Market Expenses", "6100"],

  ["37", "Financial Expenses", "5"],
  ["37850", "Bank Charges", "37"],
  ["37850001", "Bank Charges", "37850"],
  ["37850002", "Bank Guarantee Comm (Sui Gas)", "37850"],

  ["43", "Taxes on Income", "5"],
  ["43100", "Provision for Taxation", "43"],
  ["43100001", "Minimum Tax on Sales", "43100"],
  ["43100002", "Deferred Taxation", "43100"],
  ["43100004", "Income Tax Exps (Arrears)", "43100"],
  ["43300", "Prior Year Adjustment", "43"],
  ["43300001", "Prior Year Adjustment", "43300"],

  // Finish mfg/expenses pass layout for COGS seeds.
  ["51", "Selling", "5"],
  ["511", "Cost of Goods Sold", "51"],
  ["5000", "Cost of Goods Sold", "511"],
  ["515", "Purchase Return Cost Difference", "511"],
  ["5100", "Purchase Returns & Allowances", "511"],
  ["5200", "Manufacturing Wastage Expense", "59"],
  ["5300", "Inventory Loss / Expiry Expense", "59"],
];

// Redundant shells / not in Excel, deletable after re-parents above.
const REMOVE = ["5111", "5112", "514"];

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

async function main() {
  const mainUrl = process.env.SQLITE_CLOUD_URL || envValue("SQLITE_CLOUD_URL");
  const target = allowMain
    ? (() => {
        if (!mainUrl) {
          console.error("SQLITE_CLOUD_URL not set.");
          process.exit(1);
        }
        return mainUrl;
      })()
    : (dbArg ?? "data/erp.sqlite");

  const db = await connect(target);
  const q = (sql, params = []) => db.all(sql, params);
  const load = async () =>
    new Map((await q("SELECT * FROM accounts WHERE company_id = ?", [COMPANY])).map((a) => [a.account_code, a]));

  let map = await load();
  const missing = WANT.filter(([code]) => !map.has(code));
  const rename = WANT.filter(([code, name]) => map.has(code) && map.get(code).account_name !== name);
  const reparent = WANT.filter(([code, , parent]) => {
    const a = map.get(code);
    return a && (a.parent_account_id ?? null) !== (map.get(parent)?.id ?? null);
  });

  console.log(
    `db: ${db.label} · ${map.size} accounts · ` +
      `${rename.length} rename, ${reparent.length} re-parent, ${missing.length} add, ${REMOVE.length} remove-candidates`,
  );

  if (dry) {
    for (const [c, n] of rename) console.log(`  rename ${c}: "${map.get(c).account_name}" -> "${n}"`);
    for (const [c, , parent] of reparent) console.log(`  move ${c} -> ${parent}`);
    for (const [c, n, p] of missing) console.log(`  add  ${c} ${n} under ${p}`);
    for (const c of REMOVE) console.log(`  del  ${c} ${map.get(c)?.account_name ?? "(absent)"}`);
    console.log("dry run: no changes written");
    await db.close();
    return;
  }

  if (!db.cloud && db.path?.startsWith(webRoot)) {
    const dir = path.join(webRoot, "backups");
    mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, `pre-coa-pnl-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
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
    for (let pass = 0; pass < 5 && pending.size; pass++) {
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
  for (const code of ["36", "37", "43", "6100"]) {
    if (!map.has(code)) throw new Error(`missing ${code} after cleanup`);
  }
  if (map.get("6100").parent_account_id !== map.get("36").id) {
    throw new Error("6100 not under 36");
  }
  if (map.get("5000").parent_account_id !== map.get("511").id) {
    throw new Error("5000 not under 511");
  }
  console.log(`pnl done · 36/37/43 present · 6100 under 36 · ${map.size} accounts total`);
  await db.close();
}

await main();
