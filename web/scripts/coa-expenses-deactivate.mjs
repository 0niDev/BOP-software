// Deactivate the leftover expense shells agreed in the CoA cleanup. These rows
// are imported with is_system_account=1, so the app's own deactivate path
// refuses them; this script flips is_active directly and moves COGS 5000 under
// 511 first so no active child is left under a hidden parent.
//
//   node scripts/coa-expenses-deactivate.mjs <db> [--dry]
//   node scripts/coa-expenses-deactivate.mjs --allow-main [--dry]   # SQLITE_CLOUD_URL
//
// Codes are the stored account_code values, not the CoA page display_code.

import { DatabaseSync } from "node:sqlite";
import { readFileSync, copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const webRoot = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const allowMain = args.includes("--allow-main");
const dbArg = args.find((a) => !a.startsWith("--"));
const COMPANY = 1;

// Display code -> stored code in the comments for cross-checking the CoA page.
const TARGETS = [
  "5111", // 5112 Actual cost of sold stock (moved to 511 below)
  "5112", // 5113 Actual cost of returned stock
  "513", // 513 Customer claimed stock value
  "515", // 515 Purchase Return Cost Difference
  "518", // 516 Salary Salesman
  "519", // 517 L.C MARKET EXP
  // 5211 Admin Staff Salary stays active — it holds real postings (3 lines).
  "5211001", // 52a11 admin staff salary (hidden child)
  "52023", // 5223 Building and ground
  "52024", // 5224 Office equipment
  "52041", // 5231 Shop and store rent
  "5204", // 523 Rents and leases
  "520909", // 528a1 News papers and journals
  "64002", // 5281 Personal & House Expenses
  "520907", // 5288 License or permit fees
  "520908", // 5289 Membership dues
];
const KEEP = ["5100", "5000", "6000"];

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
      exec: async (sql) => { await query(sql); },
      close: async () => { try { await db.close(); } catch { /* best effort */ } },
    };
  }
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
  if (!allowMain && (!dbArg || dbArg.startsWith("sqlitecloud://"))) {
    console.error("usage: node scripts/coa-expenses-deactivate.mjs <db> [--dry]  |  --allow-main");
    process.exit(1);
  }
  if (allowMain && !mainUrl) {
    console.error("SQLITE_CLOUD_URL not set.");
    process.exit(1);
  }

  const db = await connect(allowMain ? mainUrl : dbArg);
  const load = async () =>
    new Map((await db.all("SELECT * FROM accounts WHERE company_id = ?", [COMPANY])).map((a) => [a.account_code, a]));

  let map = await load();
  const missing = TARGETS.filter((c) => !map.has(c));
  const present = TARGETS.filter((c) => map.has(c));
  const alreadyOff = present.filter((c) => map.get(c).is_active === 0);
  console.log(
    `db: ${db.label} · ${map.size} accounts · ` +
      `${present.length} targets present (${alreadyOff.length} already inactive)` +
      (missing.length ? ` · missing: ${missing.join(", ")}` : ""),
  );

  const cogs = map.get("5000");
  const cogsParent = map.get("511");
  if (!cogs || !cogsParent) throw new Error("5000 and 511 must both exist");
  const moveCogs = cogs.parent_account_id !== cogsParent.id;
  console.log(moveCogs ? "  move 5000 (COGS) -> 511" : "  5000 already under 511");

  if (dry) {
    for (const c of present) console.log(`  deactivate ${c} ${map.get(c).account_name}`);
    console.log("dry run: no changes written");
    await db.close();
    return;
  }

  if (!db.cloud && db.path?.startsWith(webRoot)) {
    const dir = path.join(webRoot, "backups");
    mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, `pre-coa-deactivate-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
    await db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    copyFileSync(db.path, dest);
    console.log(`backup: ${path.relative(webRoot, dest)}`);
  } else if (db.cloud) {
    const dir = path.join(webRoot, "backups");
    mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, `cloud-accounts-pre-deactivate-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(dest, JSON.stringify(await db.all("SELECT * FROM accounts WHERE company_id = ?", [COMPANY]), null, 2));
    console.log(`backup: ${path.relative(webRoot, dest)} (accounts table only)`);
  }

  const before = (await db.all("SELECT COUNT(*) AS n FROM journal_entry_lines WHERE account_id = ?", [cogs.id]))[0].n;

  await db.exec("BEGIN");
  try {
    if (moveCogs) {
      await db.run("UPDATE accounts SET parent_account_id = ? WHERE id = ?", [cogsParent.id, cogs.id]);
    }
    await db.run(
      `UPDATE accounts SET is_active = 0
        WHERE company_id = ? AND account_code IN (${present.map(() => "?").join(",")})`,
      [COMPANY, ...present],
    );
    await db.exec("COMMIT");
    console.log(`deactivated ${present.length} accounts`);
  } catch (err) {
    try { await db.exec("ROLLBACK"); } catch { /* best effort */ }
    throw err;
  }

  // --- verify -------------------------------------------------------------------
  map = await load();
  for (const c of KEEP) if (map.get(c)?.is_active !== 1) throw new Error(`${c} was deactivated`);
  const stillOn = TARGETS.filter((c) => map.get(c)?.is_active === 1);
  if (stillOn.length) throw new Error(`still active: ${stillOn.join(", ")}`);
  if (map.get("5000").parent_account_id !== map.get("511").id) throw new Error("5000 not under 511");
  const lines = (await db.all("SELECT COUNT(*) AS n FROM journal_entry_lines WHERE account_id = ?", [map.get("5000").id]))[0].n;
  if (Number(lines) !== Number(before)) throw new Error(`COGS journal lines changed: ${before} -> ${lines}`);
  const orphans = await db.all(
    `SELECT c.account_code AS code, p.account_code AS parent
       FROM accounts c JOIN accounts p ON p.id = c.parent_account_id
      WHERE c.company_id = ? AND c.is_active = 1 AND p.is_active = 0`,
    [COMPANY],
  );
  if (orphans.length) throw new Error(`active accounts under inactive parents: ${JSON.stringify(orphans)}`);
  console.log(`done — ${TARGETS.length} inactive, 5000/5100/6000 active, COGS lines ${lines}, no orphans`);
  await db.close();
}

await main();
process.exit(0);
