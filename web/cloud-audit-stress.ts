/**
 * TEMPORARY adversarial stress harness (delete when the audit is finished).
 * Companion to cloud-audit.ts — this file never modifies it.
 *
 *   npx tsx cloud-audit-stress.ts setup    --engine cloud --base http://127.0.0.1:4302
 *   npx tsx cloud-audit-stress.ts a|b|c|d|e|f|g|h|i  ...   (stress matrix sections)
 *   npx tsx cloud-audit-stress.ts killtest --engine cloud --base http://127.0.0.1:4302
 *   npx tsx cloud-audit-stress.ts killcheck --engine cloud
 *   npx tsx cloud-audit-stress.ts cleanup  --engine cloud
 *   npx tsx cloud-audit-stress.ts all      --engine cloud --base http://127.0.0.1:4302
 *
 * Every row this harness creates carries the run marker (default `STRESS-AUDIT`)
 * in a searchable column (item notes/code, party name, invoice notes, payment
 * notes, expense description, BOM notes). Cleanup is marker-scoped, runs inside
 * one transaction, and is idempotent.
 *
 * The harness never UPDATEs or DELETEs an unmarked row and never reverses the
 * app's own writes outside a transaction.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Row, SqlDatabase } from "./server/src/db/types.js";
import { LocalSqliteDatabase } from "./server/src/db/localSqlite.js";
import { SqliteCloudDatabase } from "./server/src/db/sqliteCloud.js";
import { hashPassword } from "./server/src/services/authService.js";
import { env } from "./server/src/env.js";

// --- CLI ---------------------------------------------------------------
const opts = new Map<string, string>();
const positional: string[] = [];
for (let i = 0; i < process.argv.length - 2; i += 1) {
  const arg = process.argv[i + 2]!;
  if (arg.startsWith("--")) {
    const next = process.argv[i + 3];
    if (next !== undefined && !next.startsWith("--")) {
      opts.set(arg.slice(2), next);
      i += 1;
    } else {
      opts.set(arg.slice(2), "true");
    }
  } else {
    positional.push(arg);
  }
}
const opt = (name: string, fallback: string): string => opts.get(name) ?? fallback;
const command = positional[0] ?? "help";
const engine = opt("engine", "local");
const dbFile = opt("db", "./data/e2e.sqlite");
const base = opt("base", "http://127.0.0.1:4302").replace(/\/$/, "");
const RUN_ID = opt("run", "STRESS-AUDIT");

const OUT_DIR = path.resolve("data", "cloud-audit", "stress");
const CANONICAL_DIR = path.resolve("data", "cloud-audit");
const RESULT_FILE = path.join(OUT_DIR, "results.json");
fs.mkdirSync(OUT_DIR, { recursive: true });

// Always keep a timestamped run log on disk, so progress (and stalls) can be
// inspected long after the terminal output is gone.
const LOG_FILE = path.join(OUT_DIR, `run-${command}-${engine}.log`);
fs.writeFileSync(
  LOG_FILE,
  `${new Date().toISOString()} === stress run command=${command} engine=${engine} base=${base} ===\n`,
);
const rawLog = console.log.bind(console);
const rawErr = console.error.bind(console);
function stamp(args: unknown[]): string {
  return `${new Date().toISOString()} ${args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")}`;
}
console.log = (...args: unknown[]): void => {
  const line = stamp(args);
  fs.appendFileSync(LOG_FILE, `${line}\n`);
  rawLog(line);
};
console.error = (...args: unknown[]): void => {
  const line = stamp(args);
  fs.appendFileSync(LOG_FILE, `${line}\n`);
  rawErr(line);
};

const db: SqlDatabase =
  engine === "cloud" ? new SqliteCloudDatabase(env.sqliteCloudUrl) : new LocalSqliteDatabase(dbFile);

// --- check bookkeeping --------------------------------------------------
type Classification =
  | "reporting"
  | "posting"
  | "stock"
  | "sequence"
  | "concurrency"
  | "boundary"
  | "integrity"
  | "environment"
  | "harness";

interface Defect {
  section: string;
  check: string;
  expected: string;
  actual: string;
  classification: Classification;
}
interface Observation {
  section: string;
  note: string;
  classification: Classification;
}

const defects: Defect[] = [];
const observations: Observation[] = [];
const stats: Record<string, { passed: number; failed: number }> = {};
const sweeps: Array<{ tag: string; failed: string[] }> = [];
let section = "";

function sec(name: string): void {
  section = name;
  stats[name] ??= { passed: 0, failed: 0 };
  console.log(`\n== ${name} ==`);
}
const STARTED_AT = Date.now();
let checkCount = 0;

function heartbeat(): void {
  checkCount += 1;
  if (checkCount % 10 === 0) {
    const elapsed = Math.round((Date.now() - STARTED_AT) / 1000);
    console.log(`  [hb] ${new Date().toISOString()} +${elapsed}s ${checkCount} checks (alive)`);
  }
}

function ok(
  label: string,
  condition: boolean,
  expected: string,
  actual: string,
  classification: Classification = "integrity",
): boolean {
  heartbeat();
  const s = (stats[section] ??= { passed: 0, failed: 0 });
  if (condition) {
    s.passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    s.failed += 1;
    defects.push({ section, check: label, expected, actual, classification });
    console.error(`  FAIL ${label}\n         expected: ${expected}\n         actual:   ${actual}`);
  }
  return condition;
}
function obs(note: string, classification: Classification = "integrity"): void {
  observations.push({ section, note, classification });
  console.log(`  ..   ${note}`);
}
const eq = (a: number, b: number, tol = 0.005): boolean => Math.abs(a - b) <= tol;
function okNum(
  label: string,
  actual: number,
  expected: number,
  classification: Classification = "integrity",
  tol = 0.005,
): boolean {
  return ok(
    label,
    eq(actual, expected, tol),
    String(expected),
    String(actual),
    classification,
  );
}

// --- sql helpers --------------------------------------------------------
async function num(sql: string, params: unknown[] = []): Promise<number> {
  const row = await db.get<{ v: number }>(sql, params as never);
  return Number(row?.v ?? 0);
}
async function rows<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  return db.all<T>(sql, params as never);
}
async function row<T = Row>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await db.get<T>(sql, params as never)) ?? undefined;
}
async function tableNames(): Promise<string[]> {
  const r = await rows<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return r.map((x) => x.name);
}
const TABLES = await tableNames();
const hasTable = (t: string): boolean => TABLES.includes(t);
function tableExists(t: string): boolean {
  return hasTable(t);
}

// --- HTTP ---------------------------------------------------------------
const AUDIT_USER = "__cloud_audit__";
const AUDIT_PASSWORD = "cloud-audit-2026";
let token = "";

interface ApiResult {
  status: number;
  body: unknown;
  text: string;
}
async function api(method: string, route: string, body?: unknown): Promise<ApiResult> {
  try {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    return { status: response.status, body: parsed, text };
  } catch (err) {
    return { status: 0, body: null, text: `network error: ${String(err).slice(0, 200)}` };
  }
}
async function raw(
  method: string,
  route: string,
  rawBody: string,
  contentType = "application/json",
): Promise<ApiResult> {
  try {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: { "content-type": contentType, ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: rawBody,
      signal: AbortSignal.timeout(180_000),
    });
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    return { status: response.status, body: parsed, text };
  } catch (err) {
    return { status: 0, body: null, text: `network error: ${String(err).slice(0, 200)}` };
  }
}
const anyBody = (r: ApiResult): any => r.body as any;

/** Tables that carry a `created_by` reference to users(id). */
const USER_REF_TABLES = [
  "journal_entries",
  "stock_movements",
  "sales_invoices",
  "sales_returns",
  "purchase_invoices",
  "purchase_returns",
  "payments",
  "receipts",
  "production_orders",
  "stock_losses",
  "expenses",
  "expense_items",
  "expense_categories",
  "items",
  "parties",
  "asset_details",
  "cheques",
  "bank_transactions",
];

/** Detach the audit user from anything it created (dangling FK otherwise). */
async function clearUserRefs(userId: number): Promise<void> {
  for (const table of USER_REF_TABLES) {
    if (!hasTable(table)) continue;
    // Ask the catalog first: the hosted schema does not carry created_by
    // everywhere, and probing avoids a flood of driver-level errors.
    let hasColumn = true;
    try {
      const probe = await num(`SELECT COUNT(*) AS v FROM pragma_table_info(?) WHERE name = 'created_by'`, [
        table,
      ]);
      hasColumn = probe > 0;
    } catch {
      hasColumn = true; // cannot introspect: try the update and swallow any error
    }
    if (!hasColumn) continue;
    try {
      await db.run(`UPDATE ${table} SET created_by = NULL WHERE created_by = ?`, [userId] as never);
    } catch {
      /* no such column in this schema */
    }
  }
}

/** Create (or recreate) the temporary audit user and log in. */
async function ensureSession(): Promise<boolean> {
  const role = await row<{ id: number }>("SELECT id FROM roles WHERE name = 'Admin'");
  if (!role) {
    ok("Admin role exists", false, "a role named Admin", "none", "environment");
    return false;
  }
  const existingUser = await row<{ id: number }>("SELECT id FROM users WHERE username = ?", [AUDIT_USER]);
  const { salt, hash } = hashPassword(AUDIT_PASSWORD);
  await db.transaction(async () => {
    if (existingUser) {
      await clearUserRefs(existingUser.id);
      await db.run("DELETE FROM users WHERE id = ?", [existingUser.id] as never);
    }
    await db.run(
      `INSERT INTO users (username, password_hash, password_salt, full_name, role_id, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [AUDIT_USER, hash, salt, "Stress audit (temporary)", role.id] as never,
    );
  });
  // The hosted driver can hit a stale socket; retry a few times before failing.
  let login: ApiResult = { status: 0, body: null, text: "not attempted" };
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    login = await api("POST", "/api/auth/login", {
      username: AUDIT_USER,
      password: AUDIT_PASSWORD,
    });
    if (login.status === 200 && anyBody(login)?.token) break;
    console.log(`  [hb] login attempt ${attempt}/3 failed: ${login.status} ${login.text.slice(0, 120)}`);
    if (attempt < 3) await new Promise((r) => setTimeout(r, 3000));
  }
  if (login.status !== 200 || !anyBody(login)?.token) {
    ok("temporary audit user can log in", false, "200 + token", `${login.status} ${login.text.slice(0, 200)}`, "environment");
    return false;
  }
  token = String(anyBody(login).token);
  return true;
}

// --- invariants ---------------------------------------------------------
const NUM_COLS: Array<[string, string]> = [
  ["sales_invoices", "invoice_number"],
  ["purchase_invoices", "invoice_number"],
  ["sales_returns", "return_number"],
  ["purchase_returns", "return_number"],
  ["journal_entries", "voucher_number"],
  ["parties", "code"],
  ["items", "item_code"],
  ["payments", "voucher_number"],
  ["receipts", "voucher_number"],
  ["expenses", "voucher_number"],
  ["production_orders", "order_number"],
  ["assets", "asset_code"],
  ["users", "username"],
  ["accounts", "account_code"],
];

async function duplicateNumbers(): Promise<string[]> {
  const found: string[] = [];
  for (const [table, column] of NUM_COLS) {
    if (!hasTable(table)) continue;
    try {
      const dup = await rows<{ k: string; n: number }>(
        `SELECT ${column} AS k, COUNT(*) AS n FROM ${table}
         WHERE ${column} IS NOT NULL GROUP BY ${column} HAVING COUNT(*) > 1 LIMIT 5`,
      );
      for (const d of dup) found.push(`${table}.${column}='${d.k}' x${d.n}`);
    } catch {
      /* column does not exist in this schema */
    }
  }
  return found;
}

/** I1,I2,I3,I4,I6,I8 — cheap enough to run after every mutation group. */
async function quick(tag: string): Promise<boolean> {
  const failed: string[] = [];
  const global = await num("SELECT COALESCE(SUM(debit),0)-COALESCE(SUM(credit),0) AS v FROM journal_entry_lines");
  const unbalanced = await num(
    `SELECT COUNT(*) AS v FROM (SELECT journal_entry_id FROM journal_entry_lines
       GROUP BY journal_entry_id HAVING ABS(COALESCE(SUM(debit),0)-COALESCE(SUM(credit),0)) > 0.005)`,
  );
  const noLines = await num(
    `SELECT COUNT(*) AS v FROM journal_entries je
      WHERE NOT EXISTS (SELECT 1 FROM journal_entry_lines l WHERE l.journal_entry_id = je.id)`,
  );
  const oneLine = await num(
    `SELECT COUNT(*) AS v FROM (SELECT journal_entry_id FROM journal_entry_lines
       GROUP BY journal_entry_id HAVING COUNT(*) < 2)`,
  );
  const orphanLines = await num(
    `SELECT COUNT(*) AS v FROM journal_entry_lines l
      WHERE NOT EXISTS (SELECT 1 FROM journal_entries e WHERE e.id = l.journal_entry_id)`,
  );
  const negative = await num("SELECT COUNT(*) AS v FROM stock_batches WHERE quantity_in_stock < -0.005");
  const dups = await duplicateNumbers();

  if (Math.abs(global) > 0.005) failed.push(`I1 global balance off by ${global.toFixed(4)}`);
  if (unbalanced > 0) failed.push(`I2 ${unbalanced} entries whose debits <> credits`);
  if (noLines > 0) failed.push(`I3 ${noLines} entries with no lines`);
  if (oneLine > 0) failed.push(`I3 ${oneLine} entries with a single line`);
  if (orphanLines > 0) failed.push(`I4 ${orphanLines} orphan lines`);
  if (negative > 0) failed.push(`I6 ${negative} batches with negative stock`);
  if (dups.length > 0) failed.push(`I8 duplicate numbers: ${dups.join(", ")}`);
  sweeps.push({ tag, failed });
  if (failed.length === 0) {
    console.log(`  ok   invariants I1-I8 after ${tag}`);
  } else {
    console.error(`  FAIL invariants after ${tag}: ${failed.join(" | ")}`);
    defects.push({
      section: "invariants",
      check: `invariant sweep after ${tag}`,
      expected: "I1-I8 clean",
      actual: failed.join(" | "),
      classification: "integrity",
    });
  }
  return failed.length === 0;
}

/** How many posted entries declare a source document that no longer exists. */
async function sourceOrphanCount(): Promise<number> {
  let total = 0;
  const sources = await rows<{ source_table: string }>(
    "SELECT DISTINCT source_table FROM journal_entries WHERE source_table IS NOT NULL",
  );
  for (const s of sources) {
    if (!hasTable(s.source_table)) continue;
    total += await num(
      `SELECT COUNT(*) AS v FROM journal_entries e
        WHERE e.source_table = ? AND NOT EXISTS (SELECT 1 FROM ${s.source_table} x WHERE x.id = e.source_id)`,
      [s.source_table],
    );
  }
  return total;
}

/** Batches whose stock_movements do not add up to quantity_in_stock. */
async function movementDriftCount(): Promise<number> {
  if (!hasTable("stock_movements")) return 0;
  return num(
    `SELECT COUNT(*) AS v FROM stock_batches b
      WHERE ABS(COALESCE(b.quantity_in_stock,0) -
            COALESCE((SELECT SUM(m.quantity) FROM stock_movements m WHERE m.batch_id = b.id),0)) > 0.005`,
  );
}

/** Pre-existing data conditions, so every later sweep is a delta against them. */
let preExisting = { orphanSources: 0, drift: 0 };

async function orphansBySource(): Promise<string[]> {
  const found: string[] = [];
  const sources = await rows<{ source_table: string }>(
    "SELECT DISTINCT source_table FROM journal_entries WHERE source_table IS NOT NULL",
  );
  for (const s of sources) {
    const t = s.source_table;
    if (!hasTable(t)) {
      found.push(`I5 source_table '${t}' is not a table`);
      continue;
    }
    const n = await num(
      `SELECT COUNT(*) AS v FROM journal_entries e
        WHERE e.source_table = ? AND NOT EXISTS (SELECT 1 FROM ${t} x WHERE x.id = e.source_id)`,
      [t],
    );
    if (n > 0) found.push(`I5 ${n} entries point at missing ${t} rows`);
  }
  return found;
}

/** Full sweep: adds I5 (dangling sources), I7 (movement reconciliation). */
async function full(tag: string): Promise<boolean> {
  const clean = await quick(tag);
  const failed: string[] = [];
  const orphans = await sourceOrphanCount();
  if (orphans > preExisting.orphanSources)
    failed.push(`I5 +${orphans - preExisting.orphanSources} entries point at a missing source row`);
  const drift = await movementDriftCount();
  if (drift > preExisting.drift)
    failed.push(
      `I7 +${drift - preExisting.drift} batches whose stock_movements no longer reconcile with quantity_in_stock`,
    );
  if (failed.length > 0) {
    console.error(`  FAIL full sweep after ${tag}: ${failed.join(" | ")}`);
    sweeps.push({ tag: `${tag} (full)`, failed });
    defects.push({
      section: "invariants",
      check: `full sweep after ${tag}`,
      expected: "I1-I8 clean",
      actual: failed.join(" | "),
      classification: "integrity",
    });
    return false;
  }
  console.log(`  ok   full invariants I1-I8 after ${tag}`);
  sweeps.push({ tag: `${tag} (full)`, failed: [] });
  return clean;
}

// --- report reconciliation helpers -------------------------------------
const r2 = (v: number): number => Math.round(Number(v) * 100) / 100;
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const TODAY = new Date().toISOString().slice(0, 10);

interface TbRow {
  accountId: number;
  accountCode: string;
  accountName: string;
  accountType: string;
  openingDebit: number;
  openingCredit: number;
  debit: number;
  credit: number;
  closingDebit: number;
  closingCredit: number;
}

/**
 * Independently recompute the trial balance from journal_entry_lines.
 *
 * Mirrors AccountingService.place(): the movement/closing columns always carry
 * the account's normal-sign balance, so a credit balance lands in the credit
 * column for every account type (`debit = max(d-c,0)`, `credit = max(c-d,0)`).
 * The account list matches the service's HAVING clause (active, or carrying
 * posted movement — this replaces the Python `is_active = 1` filter).
 */
async function tbFromLedger(from?: string, to?: string): Promise<Map<string, TbRow>> {
  const params: unknown[] = [];
  // Textual placeholder order: opening subquery (2), movement subquery (2).
  const openingJoin = from
    ? `LEFT JOIN (SELECT l.account_id AS aid,
              SUM(CASE WHEN je.is_posted = 1 AND je.entry_date < ? THEN l.debit ELSE 0 END) AS d,
              SUM(CASE WHEN je.is_posted = 1 AND je.entry_date < ? THEN l.credit ELSE 0 END) AS c
         FROM journal_entry_lines l JOIN journal_entries je ON je.id = l.journal_entry_id
        GROUP BY l.account_id) o ON o.aid = a.id`
    : `LEFT JOIN (SELECT 0 AS aid, 0 AS d, 0 AS c WHERE 0) o ON o.aid = a.id`;
  if (from) params.push(from, from);
  const movementConds = ["je.is_posted = 1", "je.company_id = 1"];
  if (from) {
    movementConds.push("je.entry_date >= ?");
    params.push(from);
  }
  if (to) {
    movementConds.push("je.entry_date <= ?");
    params.push(to);
  }
  const sql = `
    SELECT a.account_code AS code, a.account_name AS name, a.account_type AS type,
           COALESCE(o.d,0) AS opening_debit, COALESCE(o.c,0) AS opening_credit,
           COALESCE(m.d,0) AS period_debit, COALESCE(m.c,0) AS period_credit
      FROM accounts a
      ${openingJoin}
      LEFT JOIN (SELECT l.account_id AS aid, SUM(l.debit) AS d, SUM(l.credit) AS c
                   FROM journal_entry_lines l JOIN journal_entries je ON je.id = l.journal_entry_id
                  WHERE ${movementConds.join(" AND ")}
                  GROUP BY l.account_id) m ON m.aid = a.id
     WHERE a.company_id = 1`;
  const result = new Map<string, TbRow>();
  const data = await rows<any>(sql, params);
  for (const r of data) {
    const place = (d: number, c: number): { debit: number; credit: number } =>
      d - c >= 0 ? { debit: r2(d - c), credit: 0 } : { debit: 0, credit: r2(c - d) };
    const openD = Number(r.opening_debit);
    const openC = Number(r.opening_credit);
    const perD = Number(r.period_debit);
    const perC = Number(r.period_credit);
    const opening = place(openD, openC);
    const period = place(perD, perC);
    const closing = place(openD + perD, openC + perC);
    result.set(String(r.code), {
      accountId: 0,
      accountCode: String(r.code),
      accountName: String(r.name),
      accountType: String(r.type),
      openingDebit: opening.debit,
      openingCredit: opening.credit,
      debit: period.debit,
      credit: period.credit,
      closingDebit: closing.debit,
      closingCredit: closing.credit,
    });
  }
  return result;
}

/** Accounts the trial balance is allowed to list (active, or with movement). */
async function accountsInScope(): Promise<Set<string>> {
  const data = await rows<{ code: string }>(
    `SELECT a.account_code AS code FROM accounts a
       LEFT JOIN journal_entry_lines l ON l.account_id = a.id
      WHERE a.company_id = 1
      GROUP BY a.id, a.account_code, a.is_active
      HAVING a.is_active = 1 OR SUM(CASE WHEN l.debit IS NOT NULL THEN l.debit ELSE 0 END) <> 0
          OR SUM(CASE WHEN l.credit IS NOT NULL THEN l.credit ELSE 0 END) <> 0`,
  );
  return new Set(data.map((d) => String(d.code)));
}

/** Ledger recomputation of revenue/expenses (P&L) for a window. */
async function plFromLedger(from?: string, to?: string): Promise<{ revenue: number; expenses: number }> {
  const params: string[] = [];
  let cond = "";
  if (from) {
    cond += " AND je.entry_date >= ?";
    params.push(from);
  }
  if (to) {
    cond += " AND je.entry_date <= ?";
    params.push(to);
  }
  const data = await row<any>(
    `SELECT
       COALESCE(SUM(CASE WHEN a.account_type='REVENUE' THEN l.credit - l.debit ELSE 0 END),0) AS revenue,
       COALESCE(SUM(CASE WHEN a.account_type='EXPENSE' THEN l.debit - l.credit ELSE 0 END),0) AS expenses
     FROM journal_entry_lines l
     JOIN journal_entries je ON je.id = l.journal_entry_id
     JOIN accounts a ON a.id = l.account_id
     WHERE je.is_posted = 1 AND je.company_id = 1${cond}`,
    params,
  );
  return { revenue: r2(Number(data?.revenue ?? 0)), expenses: r2(Number(data?.expenses ?? 0)) };
}

const codeToAccount = new Map<string, { id: number; type: string; name: string }>();
async function loadAccounts(): Promise<void> {
  const data = await rows<{ id: number; account_code: string; account_type: string; account_name: string }>(
    "SELECT id, account_code, account_type, account_name FROM accounts WHERE company_id = 1",
  );
  for (const a of data) codeToAccount.set(String(a.account_code), { id: a.id, type: String(a.account_type), name: a.account_name });
}

// --- baseline -----------------------------------------------------------
interface Baseline {
  /** Which database this baseline belongs to — a stale one must never be reused. */
  engine: string;
  watermark: number;
  ids: Record<string, number>;
  batchIds: Record<string, number>;
  invoiceNumbers: Record<string, string>;
  accounts: Array<{ code: string; name: string; type: string }>;
  /** Data conditions that predate the run every sweep is measured against. */
  preExisting: { orphanSources: number; drift: number };
}
const ID_FILE = path.join(OUT_DIR, "baseline.json");
function readBaseline(): Baseline | null {
  return fs.existsSync(ID_FILE) ? (JSON.parse(fs.readFileSync(ID_FILE, "utf8")) as Baseline) : null;
}
function writeBaseline(b: Baseline): void {
  fs.writeFileSync(ID_FILE, JSON.stringify(b, null, 2));
}

// --- API facades --------------------------------------------------------
async function createItem(input: Record<string, unknown>): Promise<number | null> {
  const res = await api("POST", "/api/items", input);
  if (res.status !== 201) {
    ok(`create item ${input.itemCode}`, false, "201", `${res.status} ${res.text.slice(0, 200)}`, "environment");
    return null;
  }
  return Number(anyBody(res)?.id ?? anyBody(res)?.item?.id ?? 0) || null;
}
async function createParty(input: Record<string, unknown>): Promise<number | null> {
  const res = await api("POST", "/api/parties", input);
  if (res.status !== 201) {
    ok(`create party ${input.name}`, false, "201", `${res.status} ${res.text.slice(0, 200)}`, "environment");
    return null;
  }
  return Number(anyBody(res)?.id ?? 0) || null;
}
async function openingStock(itemId: number, body: Record<string, unknown>): Promise<any> {
  const res = await api("POST", `/api/items/${itemId}/opening-stock`, body);
  return { status: res.status, body: anyBody(res) };
}

interface SaleLine {
  itemId: number;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxAmount?: number;
}
async function sale(body: Record<string, unknown>): Promise<ApiResult> {
  return api("POST", "/api/sales-invoices", body);
}
async function purchase(body: Record<string, unknown>): Promise<ApiResult> {
  return api("POST", "/api/purchase-invoices", body);
}

/** batch quantity + cost from the database. */
async function batchQty(batchId: number): Promise<number> {
  return num("SELECT COALESCE(quantity_in_stock,0) AS v FROM stock_batches WHERE id = ?", [batchId]);
}
async function stockOf(itemId: number): Promise<number> {
  return num(
    "SELECT COALESCE(SUM(quantity_in_stock),0) AS v FROM stock_batches WHERE item_id = ?",
    [itemId],
  );
}

// =======================================================================
// PHASE: setup
// =======================================================================
async function setup(): Promise<Baseline | null> {
  sec("setup");
  if (!(await ensureSession())) return null;
  await loadAccounts();
  preExisting = { orphanSources: await sourceOrphanCount(), drift: await movementDriftCount() };
  const preExistingSnapshot = { ...preExisting };
  obs(
    `pre-existing data conditions carried into the run: ${preExisting.orphanSources} entries with a dangling source row, ${preExisting.drift} batches whose stock_movements do not reconcile (all later sweeps are deltas against these)`,
  );

  const existing = readBaseline();
  const markerItems = await num("SELECT COUNT(*) AS v FROM items WHERE item_code LIKE ?", [`${RUN_ID}%`]);
  if (existing && markerItems > 0) {
    if (existing.engine !== engine) {
      ok(
        "the baseline belongs to this engine",
        false,
        `a ${engine} baseline`,
        `baseline.json was written for engine='${existing.engine}' — delete it (or run cleanup) before running against ${engine}`,
        "environment",
      );
      return null;
    }
    // The baseline is only usable if everything it points at still exists.
    const ids = Object.values(existing.ids);
    const missing: number[] = [];
    for (const id of ids) {
      const found = await num("SELECT COUNT(*) AS v FROM items WHERE id = ?", [id]);
      const foundParty = await num("SELECT COUNT(*) AS v FROM parties WHERE id = ?", [id]);
      if (found === 0 && foundParty === 0) missing.push(id);
    }
    if (missing.length > 0) {
      ok(
        "every master in the baseline still exists",
        false,
        "all baseline ids resolve",
        `missing ids ${missing.join(",")} — run cleanup and start again`,
        "environment",
      );
      return null;
    }
    obs(`setup replay: ${markerItems} stress items already present — reusing the ${engine} baseline`);
    return existing;
  }
  const markerParties = await num("SELECT COUNT(*) AS v FROM parties WHERE name LIKE ?", [`%${RUN_ID}%`]);
  if (markerItems > 0 || markerParties > 0) {
    ok(
      "setup starts from a clean database",
      false,
      "no marker rows",
      `${markerItems} marker items / ${markerParties} marker parties from an earlier run — run \`cleanup\` first`,
      "environment",
    );
    return null;
  }

  const customerId = await createParty({ name: `${RUN_ID} Customer`, partyType: "CUSTOMER" });
  const supplierId = await createParty({ name: `${RUN_ID} Supplier`, partyType: "SUPPLIER" });
  const bothId = await createParty({ name: `${RUN_ID} Both`, partyType: "BOTH" });
  ok("stress customer created", customerId !== null, "an id", String(customerId), "environment");
  ok("stress supplier created", supplierId !== null, "an id", String(supplierId), "environment");
  if (customerId === null || supplierId === null || bothId === null) return null;

  const items: Record<string, number | null> = {};
  items.main = await createItem({
    itemName: `${RUN_ID} Main`,
    itemCode: `${RUN_ID}-ITEM`,
    notes: `${RUN_ID} main item`,
    unit: "UNIT",
    purchasePrice: 10,
    sellingPrice: 20,
    itemType: "FINISHED_GOOD",
  });
  items.span = await createItem({
    itemName: `${RUN_ID} Span`,
    itemCode: `${RUN_ID}-SPAN`,
    notes: `${RUN_ID} batch spanning item`,
    unit: "UNIT",
    purchasePrice: 10,
    sellingPrice: 20,
    itemType: "FINISHED_GOOD",
  });
  items.conc = await createItem({
    itemName: `${RUN_ID} Conc`,
    itemCode: `${RUN_ID}-CONC`,
    notes: `${RUN_ID} concurrency item`,
    unit: "UNIT",
    purchasePrice: 10,
    sellingPrice: 20,
    itemType: "FINISHED_GOOD",
  });
  items.stockout = await createItem({
    itemName: `${RUN_ID} Stockout`,
    itemCode: `${RUN_ID}-STOCKOUT`,
    notes: `${RUN_ID} thin stock item`,
    unit: "UNIT",
    purchasePrice: 10,
    sellingPrice: 20,
    itemType: "FINISHED_GOOD",
  });
  items.tiny = await createItem({
    itemName: `${RUN_ID} Tiny`,
    itemCode: `${RUN_ID}-TINY`,
    notes: `${RUN_ID} high cost item`,
    unit: "UNIT",
    purchasePrice: 1000,
    sellingPrice: 2000,
    itemType: "FINISHED_GOOD",
  });
  for (const [k, v] of Object.entries(items)) {
    ok(`stress item ${k} created`, v !== null, "an id", String(v), "environment");
  }
  if (Object.values(items).some((v) => v === null)) return null;

  const batches: Record<string, number> = {};
  const os = async (itemId: number, qty: number, cost: number, batchNumber: string, partyId: number) => {
    const r = await openingStock(itemId, {
      quantity: qty,
      unitCost: cost,
      batchNumber,
      partyId,
    });
    ok(
      `opening stock ${batchNumber} (${qty} @ ${cost})`,
      r.status === 201,
      "201",
      `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`,
      "environment",
    );
    const b = await row<{ id: number }>(
      "SELECT id FROM stock_batches WHERE batch_number = ? AND item_id = ?",
      [batchNumber, itemId],
    );
    if (b) batches[batchNumber] = b.id;
    return b?.id ?? 0;
  };

  batches[`${RUN_ID}-A`] = await os(items.main!, 100, 10, `${RUN_ID}-A`, supplierId);
  batches[`${RUN_ID}-SA`] = await os(items.span!, 10, 10, `${RUN_ID}-SA`, supplierId);
  batches[`${RUN_ID}-C`] = await os(items.conc!, 20, 10, `${RUN_ID}-C`, supplierId);
  batches[`${RUN_ID}-SO`] = await os(items.stockout!, 1, 10, `${RUN_ID}-SO`, supplierId);
  batches[`${RUN_ID}-T`] = await os(items.tiny!, 1, 1000, `${RUN_ID}-T`, supplierId);

  // Second batch for the spanning item, via a real purchase (batch B, 5 @ 20).
  const spanPurchase = await purchase({
    supplierId,
    invoiceDate: TODAY,
    paymentType: "CREDIT",
    notes: `${RUN_ID} span purchase`,
    items: [
      { itemId: items.span!, quantity: 5, unitCost: 20, batchNumber: `${RUN_ID}-SB` },
    ],
  });
  ok(
    "purchase creating the second batch",
    spanPurchase.status === 201,
    "201",
    `${spanPurchase.status} ${spanPurchase.text.slice(0, 200)}`,
    "environment",
  );
  const sb = await row<{ id: number }>("SELECT id FROM stock_batches WHERE batch_number = ?", [
    `${RUN_ID}-SB`,
  ]);
  if (sb) batches[`${RUN_ID}-SB`] = sb.id;

  // An expense + category so sequences and P&L have a full document set.
  const cat = await api("POST", "/api/expense-categories", { name: `${RUN_ID} Category` });
  ok("expense category created", cat.status === 201, "201", `${cat.status}`, "environment");
  const categoryId = Number(anyBody(cat)?.id ?? 0);
  if (categoryId) {
    const exp = await api("POST", "/api/expenses", {
      categoryId,
      expenseDate: TODAY,
      amount: 33.33,
      paymentMethod: "CASH",
      description: `${RUN_ID} expense`,
    });
    ok("expense created", exp.status === 201, "201", `${exp.status} ${exp.text.slice(0, 200)}`, "environment");
  }

  const watermark = await num("SELECT COALESCE(MAX(id),0) AS v FROM journal_entries");
  const baseline: Baseline = {
    engine,
    watermark,
    ids: {
      customer: customerId,
      supplier: supplierId,
      both: bothId,
      main: items.main!,
      span: items.span!,
      conc: items.conc!,
      stockout: items.stockout!,
      tiny: items.tiny!,
    },
    batchIds: batches,
    invoiceNumbers: {},
    accounts: [...codeToAccount.entries()].map(([code, v]) => ({ code, name: v.name, type: v.type })),
    preExisting: preExistingSnapshot,
  };
  writeBaseline(baseline);
  console.log(`  ..   watermark = ${watermark}; batches = ${JSON.stringify(batches)}`);
  await full("setup");
  return baseline;
}

// =======================================================================
// SECTION A — numeric boundaries
// =======================================================================
async function sectionA(b: Baseline): Promise<void> {
  sec("A numeric boundaries");
  const customer = b.ids.customer!;
  const mainId = b.ids.main!;
  const tinyId = b.ids.tiny!;

  const zeroSale = await sale({
    customerId: customer,
    invoiceDate: TODAY,
    paymentType: "CASH",
    notes: `${RUN_ID} A1 zero-value line`,
    items: [{ itemId: mainId, quantity: 1, unitPrice: 0 }],
  });
  ok(
    "A1 zero-value invoice line is either accepted with 0 or rejected cleanly",
    zeroSale.status === 201 || zeroSale.status === 400,
    "201 or 400",
    `${zeroSale.status} ${zeroSale.text.slice(0, 200)}`,
    "boundary",
  );
  if (zeroSale.status === 201) {
    const inv = anyBody(zeroSale);
    okNum("A1 invoice total is 0.00", Number(inv.totalAmount ?? inv.total_amount ?? 0), 0, "boundary");
    const je = await row<{ debit: number; credit: number }>(
      `SELECT COALESCE(SUM(l.debit),0) AS debit, COALESCE(SUM(l.credit),0) AS credit
       FROM journal_entries e JOIN journal_entry_lines l ON l.journal_entry_id = e.id
       WHERE e.source_table='sales_invoices' AND e.source_id=?`,
      [Number(inv.id)],
    );
    okNum("A1 its journal entry balances", r2(Number(je?.debit ?? 0) - Number(je?.credit ?? 0)), 0, "posting");
  }
  await quick("A1 zero-value line");

  const stockBefore = await stockOf(mainId);
  const reject0 = await sale({
    customerId: customer,
    invoiceDate: TODAY,
    paymentType: "CASH",
    notes: `${RUN_ID} A2 qty 0`,
    items: [{ itemId: mainId, quantity: 0, unitPrice: 10 }],
  });
  ok("A2 quantity 0 rejected", reject0.status === 400, "400", String(reject0.status), "boundary");
  const rejectNeg = await sale({
    customerId: customer,
    invoiceDate: TODAY,
    paymentType: "CASH",
    notes: `${RUN_ID} A3 qty negative`,
    items: [{ itemId: mainId, quantity: -1, unitPrice: 10 }],
  });
  ok("A3 negative quantity rejected", rejectNeg.status === 400, "400", String(rejectNeg.status), "boundary");
  const rejectNegPrice = await sale({
    customerId: customer,
    invoiceDate: TODAY,
    paymentType: "CASH",
    notes: `${RUN_ID} A4 negative price`,
    items: [{ itemId: mainId, quantity: 1, unitPrice: -1 }],
  });
  ok("A4 negative unit price rejected", rejectNegPrice.status === 400, "400", String(rejectNegPrice.status), "boundary");
  okNum("A2-A4 no stock moved by the rejections", await stockOf(mainId), stockBefore, "stock");

  const dust = await sale({
    customerId: customer,
    invoiceDate: TODAY,
    paymentType: "CASH",
    notes: `${RUN_ID} A5 dust quantity`,
    items: [{ itemId: mainId, quantity: 0.0001, unitPrice: 10 }],
  });
  ok(
    "A5 quantity 0.0001 handled cleanly (accept or 400)",
    dust.status === 201 || dust.status === 400,
    "201 or 400",
    `${dust.status} ${dust.text.slice(0, 160)}`,
    "boundary",
  );
  if (dust.status === 400) {
    obs(
      `A5: a 0.0001-unit sale of a $10 item is rejected with "${anyBody(dust)?.error?.message ?? dust.text.slice(0, 120)}" (COGS rounds to 0.00)`,
      "boundary",
    );
  }

  const tinySale = await sale({
    customerId: customer,
    invoiceDate: TODAY,
    paymentType: "CASH",
    notes: `${RUN_ID} A6 dust with high cost`,
    items: [{ itemId: tinyId, quantity: 0.0001, unitPrice: 2000 }],
  });
  ok(
    "A6 quantity 0.0001 on a $1000-cost item is accepted (COGS 0.10)",
    tinySale.status === 201,
    "201",
    `${tinySale.status} ${tinySale.text.slice(0, 200)}`,
    "boundary",
  );    if (tinySale.status === 201) {
    okNum(
      "A6 total is 0.20 (0.0001 x 2000)",
      Number(anyBody(tinySale).totalAmount ?? anyBody(tinySale).total_amount ?? 0),
      0.2,
      "boundary",
    );
    const stockLeft = await stockOf(tinyId);
    okNum("A6 stock decremented by exactly 0.0001", stockLeft, 0.9999, "stock");
    const tinyLine = await row<{ quantity: number; unit_price: number; line_total: number }>(
      "SELECT quantity, unit_price, line_total FROM sales_invoice_items WHERE invoice_id = ?",
      [Number(anyBody(tinySale).id)],
    );
    okNum(
      "A6 the stored line quantity round-trips (0.0001)",
      Number(tinyLine?.quantity ?? 0),
      0.0001,
      "boundary",
    );
    if (Number(tinyLine?.quantity ?? 0) === 0) {
      obs(
        "A6 root cause: toStorage() rounds to 2 decimals, so the 0.0001 quantity is persisted as 0 while the line total keeps 0.20 and the batch loses 0.0001 units",
        "boundary",
      );
    }
  }

  const huge = await sale({
    customerId: customer,
    invoiceDate: TODAY,
    paymentType: "CASH",
    notes: `${RUN_ID} A7 huge quantity`,
    items: [{ itemId: mainId, quantity: 999999999, unitPrice: 10 }],
  });
  ok(
    "A7 quantity 999999999 rejected with insufficient stock (409)",
    huge.status === 409,
    "409",
    `${huge.status} ${huge.text.slice(0, 160)}`,
    "boundary",
  );

  const disc100 = await sale({
    customerId: customer,
    invoiceDate: TODAY,
    paymentType: "CASH",
    notes: `${RUN_ID} A8 100% discount`,
    items: [{ itemId: mainId, quantity: 1, unitPrice: 100, discountAmount: 100 }],
  });
  ok(
    "A8 exactly 100% discount accepted with a 0.00 total",
    disc100.status === 201 && eq(Number(anyBody(disc100).totalAmount ?? 0), 0),
    "201 and total 0.00",
    `${disc100.status} total=${anyBody(disc100)?.totalAmount}`,
    "boundary",
  );

  const stockBeforeDisc = await stockOf(mainId);
  const disc150 = await sale({
    customerId: customer,
    invoiceDate: TODAY,
    paymentType: "CASH",
    notes: `${RUN_ID} A9 150% discount`,
    items: [{ itemId: mainId, quantity: 1, unitPrice: 100, discountAmount: 150 }],
  });
  ok(
    "A9 >100% discount rejected with 400 (negative total refused)",
    disc150.status === 400,
    "400",
    `${disc150.status} ${disc150.text.slice(0, 200)}`,
    "boundary",
  );
  okNum("A9 rejection moved no stock", await stockOf(mainId), stockBeforeDisc, "stock");
  const residue = await num(
    "SELECT COUNT(*) AS v FROM sales_invoices WHERE notes LIKE ?",
    [`%${RUN_ID} A9%`],
  );
  ok("A9 rejection left no invoice row", residue === 0, "0 rows", `${residue} rows`, "posting");

  const taxHalf = await sale({
    customerId: customer,
    invoiceDate: TODAY,
    paymentType: "CASH",
    notes: `${RUN_ID} A10 tax 0.005`,
    items: [{ itemId: mainId, quantity: 1, unitPrice: 100, taxAmount: 0.005 }],
  });
  ok("A10 tax 0.005 sale accepted", taxHalf.status === 201, "201", String(taxHalf.status), "boundary");
  if (taxHalf.status === 201) {
    const id = Number(anyBody(taxHalf).id);
    const stored = await row<{ tax_amount: number; total_amount: number }>(
      "SELECT tax_amount, total_amount FROM sales_invoices WHERE id = ?",
      [id],
    );
    okNum("A10 tax 0.005 stored as 0.01 (half-up)", Number(stored?.tax_amount ?? 0), 0.01, "boundary");
    okNum("A10 total = 100.01", Number(stored?.total_amount ?? 0), 100.01, "boundary");
    const taxCredit = await num(
      `SELECT COALESCE(SUM(l.credit),0) AS v FROM journal_entry_lines l
        JOIN journal_entries e ON e.id = l.journal_entry_id
        JOIN accounts a ON a.id = l.account_id
       WHERE e.source_table='sales_invoices' AND e.source_id=? AND a.account_code LIKE '21%'`,
      [id],
    );
    okNum("A10 tax credit posted equals the stored tax", taxCredit, 0.01, "posting");
  }
  const taxTwo = await sale({
    customerId: customer,
    invoiceDate: TODAY,
    paymentType: "CASH",
    notes: `${RUN_ID} A10 tax 0.015`,
    items: [{ itemId: mainId, quantity: 1, unitPrice: 100, taxAmount: 0.015 }],
  });
  if (taxTwo.status === 201) {
    const stored = await row<{ tax_amount: number }>(
      "SELECT tax_amount FROM sales_invoices WHERE id = ?",
      [Number(anyBody(taxTwo).id)],
    );
    okNum("A10 tax 0.015 stored as 0.02", Number(stored?.tax_amount ?? 0), 0.02, "boundary");
  }

  const threeLines = await sale({
    customerId: customer,
    invoiceDate: TODAY,
    paymentType: "CASH",
    notes: `${RUN_ID} A11 currency rounding`,
    items: [
      { itemId: mainId, quantity: 1, unitPrice: 33.33 },
      { itemId: mainId, quantity: 1, unitPrice: 33.33 },
      { itemId: mainId, quantity: 1, unitPrice: 33.33 },
    ],
  });
  ok("A11 three-line sale accepted", threeLines.status === 201, "201", String(threeLines.status), "boundary");
  if (threeLines.status === 201) {
    const inv = anyBody(threeLines);
    okNum("A11 subtotal is 99.99 (not 100.00)", Number(inv.subtotal ?? 0), 99.99, "boundary");
    okNum("A11 total is 99.99", Number(inv.totalAmount ?? 0), 99.99, "boundary");
    const revCredit = await num(
      `SELECT COALESCE(SUM(l.credit),0) AS v FROM journal_entry_lines l
        JOIN journal_entries e ON e.id = l.journal_entry_id
        JOIN accounts a ON a.id = l.account_id
       WHERE e.source_table='sales_invoices' AND e.source_id=? AND a.account_type='REVENUE'`,
      [Number(inv.id)],
    );
    okNum("A11 revenue credited is 99.99", revCredit, 99.99, "posting");
  }

  const halfPenny = await sale({
    customerId: customer,
    invoiceDate: TODAY,
    paymentType: "CASH",
    notes: `${RUN_ID} A12 half-penny price`,
    items: [{ itemId: mainId, quantity: 1, unitPrice: 0.005 }],
  });
  ok(
    "A12 half-penny unit price accepted and rounded half-up",
    halfPenny.status === 201 && eq(Number(anyBody(halfPenny).totalAmount ?? 0), 0.01),
    "201 and total 0.01",
    `${halfPenny.status} total=${anyBody(halfPenny)?.totalAmount}`,
    "boundary",
  );
  await full("A end");
}

// =======================================================================
// SECTION B — date boundaries
// =======================================================================
async function sectionB(b: Baseline): Promise<void> {
  sec("B date boundaries");
  const customerId = b.ids.customer!;
  const mainId = b.ids.main!;
  const mk = async (label: string, date: string, qty = 5) => {
    const res = await sale({
      customerId,
      invoiceDate: date,
      paymentType: "CASH",
      notes: `${RUN_ID} ${label}`,
      items: [{ itemId: mainId, quantity: qty, unitPrice: 10 }],
    });
    return res;
  };

  const fyStart = await mk("B1 fiscal-year start", "2026-07-01");
  ok("B1 invoice on the fiscal-year start (2026-07-01) accepted", fyStart.status === 201, "201", String(fyStart.status), "boundary");
  const fyEnd = await mk("B2 fiscal-year end", "2027-06-30");
  ok("B2 invoice on the fiscal-year end (2027-06-30) accepted", fyEnd.status === 201, "201", String(fyEnd.status), "boundary");
  const backdated = await mk("B3 backdated", "2020-01-01");
  ok("B3 backdated invoice (2020-01-01) accepted", backdated.status === 201, "201", String(backdated.status), "boundary");
  const future = await mk("B4 future", "2030-12-31");
  ok("B4 future-dated invoice (2030-12-31) accepted", future.status === 201, "201", String(future.status), "boundary");
  const leap = await mk("B5 leap day", "2028-02-29");
  ok("B5 leap-day invoice (2028-02-29) accepted", leap.status === 201, "201", String(leap.status), "boundary");
  const yearEnd = await mk("B6 year end", "2026-12-31");
  ok("B6 year-end invoice (2026-12-31) accepted", yearEnd.status === 201, "201", String(yearEnd.status), "boundary");

  // B7 same-day composition
  const day = "2026-09-09";
  const sameDay: ApiResult[] = [];
  for (let i = 0; i < 3; i += 1) sameDay.push(await mk(`B7 same day ${i}`, day, 1));
  ok(
    "B7 three same-day invoices accepted",
    sameDay.every((r) => r.status === 201),
    "3x201",
    sameDay.map((r) => r.status).join(","),
    "boundary",
  );
  const dayTb = await api("GET", `/api/reports/trial-balance?from=${day}&to=${day}`);
  const dayLedger = await tbFromLedger(day, day);
  const apiDayRevenue = r2(
    (anyBody(dayTb)?.rows as TbRow[] | undefined)
      ?.filter((r) => r.accountType === "REVENUE")
      .reduce((acc, r) => acc + r2(r.credit - r.debit), 0) ?? 0,
  );
  const ledgerDayRevenue = r2(
    [...dayLedger.values()]
      .filter((r) => r.accountType === "REVENUE")
      .reduce((acc, r) => acc + r2(r.credit - r.debit), 0),
  );
  okNum("B7 same-day revenue equals the independent recomputation", apiDayRevenue, ledgerDayRevenue, "reporting");

  const comp = await api("GET", `/api/reports/trial-balance?from=2026-09-08&to=2026-09-08`);
  const compRevenue = r2(
    (anyBody(comp)?.rows as TbRow[] | undefined)
      ?.filter((r) => r.accountType === "REVENUE")
      .reduce((acc, r) => acc + r2(r.credit - r.debit), 0) ?? 0,
  );
  okNum("B7 previous day has no revenue from that day", compRevenue, 0, "reporting");

  // B11 (before the deliberately malformed dates) filter composition, expressed
  // with a bounded end date: closing(start..yesterday) + movement(today)
  // must equal closing(start..today).
  const WINDOW_START = "2019-01-01";
  const yest = addDays(TODAY, -1);
  const compose = async (): Promise<string[]> => {
    const base = (await api("GET", `/api/reports/trial-balance?from=${WINDOW_START}&to=${yest}`)).body as any;
    const todayWin = (await api("GET", `/api/reports/trial-balance?from=${TODAY}&to=${TODAY}`)).body as any;
    const thruToday = (await api("GET", `/api/reports/trial-balance?from=${WINDOW_START}&to=${TODAY}`)).body as any;
    const idx = (res: any): Map<string, TbRow> => {
      const m = new Map<string, TbRow>();
      for (const r of (res?.rows ?? []) as TbRow[]) m.set(r.accountCode, r);
      return m;
    };
    const bIdx = idx(base);
    const tIdx = idx(todayWin);
    const aIdx = idx(thruToday);
    const out: string[] = [];
    for (const [code, a] of aIdx) {
      const b = bIdx.get(code);
      const t = tIdx.get(code);
      const openAtYest = b ? r2(b.closingDebit - b.closingCredit) : 0;
      const todayMove = t ? r2(t.debit - t.credit) : 0;
      const thru = r2(a.closingDebit - a.closingCredit);
      if (!eq(r2(openAtYest + todayMove), thru))
        out.push(`${code}: ${r2(openAtYest + todayMove)} vs ${thru}`);
    }
    return out;
  };
  const diffs = await compose();
  ok(
    "B11 closing(start..yesterday) + movement(today) = closing(start..today)",
    diffs.length === 0,
    "every account composes",
    diffs.slice(0, 5).join("; "),
    "reporting",
  );

  // B8 timezone straddle / datetime strings
  const straddleA = await mk("B8 23:59", "2026-10-12T23:59:00");
  const straddleB = await mk("B8 00:01", "2026-10-13T00:01:00");
  const acceptedA = straddleA.status === 201;
  const acceptedB = straddleB.status === 201;
  if (acceptedA) {
    const inWindow = await num(
      `SELECT COUNT(*) AS v FROM sales_invoices WHERE notes LIKE ? AND invoice_date <= '2026-10-12'`,
      [`%${RUN_ID} B8 23:59%`],
    );
    ok(
      "B8 an entry dated 2026-10-12T23:59 is inside a window ending 2026-10-12",
      inWindow === 1,
      "1 row in the window",
      `${inWindow} rows (invoice_date stored raw, string-compared)`,
      "boundary",
    );
  }
  if (acceptedA && acceptedB) {
    const tb = await api("GET", "/api/reports/trial-balance?from=2026-10-12&to=2026-10-12");
    const revenue = r2(
      (anyBody(tb)?.rows as TbRow[] | undefined)
        ?.filter((r) => r.accountType === "REVENUE")
        .reduce((acc, r) => acc + r2(r.credit - r.debit), 0) ?? 0,
    );
    const ledger = r2(
      [...(await tbFromLedger("2026-10-12", "2026-10-12")).values()]
        .filter((r) => r.accountType === "REVENUE")
        .reduce((acc, r) => acc + r2(r.credit - r.debit), 0),
    );
    okNum("B8 report window agrees with the ledger for the datetime-stamped rows", revenue, ledger, "reporting");
  }

  // B8b dashboard vs report: the dashboard normalises the date, the report does not
  const dashNow = await api("GET", "/api/dashboard");
  const dashTodayCount = Number(anyBody(dashNow)?.today?.salesCount ?? 0);
  const stringCount = await num("SELECT COUNT(*) AS v FROM sales_invoices WHERE invoice_date = ?", [TODAY]);
  ok(
    "B8 dashboard today's invoice count matches the report window count",
    dashTodayCount === stringCount,
    `${stringCount} (invoice_date = '${TODAY}')`,
    `${dashTodayCount} (dashboard uses date(invoice_date), which folds a datetime stamp onto today)`,
    "reporting",
  );

  // B9/B10 malformed / impossible dates
  const badDate = await mk("B9 malformed date", "banana");
  ok(
    "B9 malformed date rejected",
    badDate.status === 400,
    "400",
    `${badDate.status} ${badDate.text.slice(0, 160)}`,
    "boundary",
  );
  const impossible = await mk("B10 impossible date", "2026-02-30");
  ok(
    "B10 impossible calendar date (2026-02-30) rejected",
    impossible.status === 400,
    "400",
    `${impossible.status} ${impossible.text.slice(0, 160)}`,
    "boundary",
  );

  // B12 composition again, now that datetime-stamped rows exist
  const diffs2 = await compose();
  ok(
    "B12 window composition still holds once a datetime-stamped date exists",
    diffs2.length === 0,
    "every account composes",
    diffs2.slice(0, 5).join("; ") || "composes",
    "boundary",
  );
  if (diffs2.length > 0) {
    obs(
      "B12 root cause: entry_date is compared as a raw TEXT string, so an ISO datetime (or any non YYYY-MM-DD value) falls outside both the '<= to' and the '>= from' window and vanishes from period reports",
      "boundary",
    );
  }

  await full("B end");
}

// =======================================================================
// SECTION C — document lifecycle
// =======================================================================
async function sectionC(b: Baseline): Promise<void> {
  sec("C document lifecycle");
  const customerId = b.ids.customer!;
  const supplierId = b.ids.supplier!;
  const mainId = b.ids.main!;

  // C1 round trip
  const created = await sale({
    customerId,
    invoiceDate: TODAY,
    paymentType: "CREDIT",
    notes: `${RUN_ID} C1 round trip`,
    items: [{ itemId: mainId, quantity: 2, unitPrice: 12.5, discountAmount: 1, taxAmount: 0.5 }],
  });
  ok("C1 credit sale created", created.status === 201, "201", String(created.status), "posting");
  const invoiceId = Number(anyBody(created)?.id ?? 0);
  if (invoiceId) {
    const read = await api("GET", `/api/sales-invoices/${invoiceId}`);
    ok("C1 read-back succeeds", read.status === 200, "200", String(read.status), "posting");
    const body = anyBody(read);
    // getById returns { invoice, items } with the raw snake_case row.
    const inv = body?.invoice ?? body;
    okNum("C1 subtotal round-trips (25.00)", Number(inv?.subtotal ?? 0), 25, "posting");
    okNum("C1 discount round-trips (1.00)", Number(inv?.discount_amount ?? inv?.discountAmount ?? 0), 1, "posting");
    okNum("C1 tax round-trips (0.50)", Number(inv?.tax_amount ?? inv?.taxAmount ?? 0), 0.5, "posting");
    okNum("C1 total round-trips (24.50)", Number(inv?.total_amount ?? inv?.totalAmount ?? 0), 24.5, "posting");
    okNum(
      "C1 total = subtotal - discount + tax",
      r2(Number(inv?.total_amount ?? 0)),
      r2(Number(inv?.subtotal ?? 0) - Number(inv?.discount_amount ?? 0) + Number(inv?.tax_amount ?? 0)),
      "posting",
    );
    const created2 = anyBody(created);
    okNum(
      "C1 the create response equals the stored header",
      r2(Number(created2?.totalAmount ?? 0)),
      r2(Number(inv?.total_amount ?? 0)),
      "posting",
    );
    const dbRow = await row<{ subtotal: number; discount_amount: number; tax_amount: number; total_amount: number }>(
      "SELECT subtotal, discount_amount, tax_amount, total_amount FROM sales_invoices WHERE id = ?",
      [invoiceId],
    );
    okNum("C1 DB total equals the API total", Number(dbRow?.total_amount ?? 0), Number(inv?.total_amount ?? 0), "posting");
    const debitSide = await num(
      `SELECT COALESCE(SUM(l.debit),0) AS v FROM journal_entry_lines l
        JOIN journal_entries e ON e.id=l.journal_entry_id
       WHERE e.source_table='sales_invoices' AND e.source_id=?`,
      [invoiceId],
    );
    ok(
      "C1 journal entry debits equal the invoice total plus COGS",
      eq(r2(debitSide), 24.5 + 2 * 10),
      String(24.5 + 20),
      String(debitSide),
      "posting",
    );
  }

  // C2 immutability of documents through the API
  if (invoiceId) {
    const put = await api("PUT", `/api/sales-invoices/${invoiceId}`, { notes: "tampered" });
    const del = await api("DELETE", `/api/sales-invoices/${invoiceId}`);
    const stillThere = await num("SELECT COUNT(*) AS v FROM sales_invoices WHERE id = ?", [invoiceId]);
    ok(
      "C2 documents cannot be edited or deleted through the API (404) and the row survives",
      (put.status === 404 || put.status === 405) && (del.status === 404 || del.status === 405) && stillThere === 1,
      "404/405 for both, row still present",
      `put=${put.status} delete=${del.status} rows=${stillThere}`,
      "integrity",
    );
    obs("C2 create -> update -> delete round trip is not exposed by design; deletion happens only via the audited restore/cleanup path");
  }

  // C3 full return nets to zero
  const stockBeforeCSale = await stockOf(mainId);
  const saleForReturn = await sale({
    customerId,
    invoiceDate: TODAY,
    paymentType: "CREDIT",
    notes: `${RUN_ID} C3 full return`,
    items: [{ itemId: mainId, quantity: 2, unitPrice: 10 }],
  });
  const retInvoiceId = Number(anyBody(saleForReturn)?.id ?? 0);
  const retItems = await rows<{ id: number }>(
    "SELECT id FROM sales_invoice_items WHERE invoice_id = ?",
    [retInvoiceId],
  );
  const plBefore = await plFromLedger();
  const fullReturn = await api("POST", "/api/sales-returns", {
    invoiceId: retInvoiceId,
    returnDate: TODAY,
    notes: `${RUN_ID} C3 return`,
    items: [{ invoiceItemId: retItems[0]?.id, quantity: 2 }],
  });
  ok("C3 sales return accepted", fullReturn.status === 201, "201", `${fullReturn.status} ${fullReturn.text.slice(0, 200)}`, "posting");
  if (fullReturn.status === 201) {
    const plAfter = await plFromLedger();
    const revDelta = r2(plAfter.revenue - plBefore.revenue);
    const returnId = Number(anyBody(fullReturn).id);
    const netRevenue = await num(
      `SELECT COALESCE(SUM(CASE WHEN a.account_type='REVENUE' THEN l.credit - l.debit ELSE 0 END),0) AS v
         FROM journal_entry_lines l JOIN journal_entries e ON e.id=l.journal_entry_id
         JOIN accounts a ON a.id=l.account_id
        WHERE (e.source_table='sales_invoices' AND e.source_id=?)
           OR (e.source_table='sales_returns' AND e.source_id=?)`,
      [retInvoiceId, returnId],
    );
    okNum("C3 sale + full return nets to zero revenue", netRevenue, 0, "posting");
    okNum("C3 stock fully restored to its pre-sale quantity", await stockOf(mainId), stockBeforeCSale, "stock");
    obs(`C3 the return alone moved revenue by ${revDelta.toFixed(2)} (the sale's own credit nets against it)`);
    const cogsNet = await num(
      `SELECT COALESCE(SUM(CASE WHEN a.account_type='EXPENSE' THEN l.debit - l.credit ELSE 0 END),0) AS v
         FROM journal_entry_lines l JOIN journal_entries e ON e.id=l.journal_entry_id
         JOIN accounts a ON a.id=l.account_id
        WHERE (e.source_table='sales_invoices' AND e.source_id=?)
           OR (e.source_table='sales_returns' AND e.source_id=?)`,
      [retInvoiceId, returnId],
    );
    okNum("C3 sale + full return nets COGS to zero", cogsNet, 0, "posting");
  }

  // C4 partial payment
  const creditSale = await sale({
    customerId,
    invoiceDate: TODAY,
    paymentType: "CREDIT",
    notes: `${RUN_ID} C4 partial payment`,
    items: [{ itemId: mainId, quantity: 6, unitPrice: 10 }],
  });
  const creditId = Number(anyBody(creditSale)?.id ?? 0);
  const arBefore = await num(
    `SELECT COALESCE(SUM(CASE WHEN a.account_code='1100' THEN l.debit - l.credit ELSE 0 END),0) AS v
       FROM journal_entry_lines l JOIN journal_entries e ON e.id=l.journal_entry_id
       JOIN accounts a ON a.id=l.account_id WHERE e.is_posted=1`,
  );
  const receipt = await api("POST", "/api/receipts", {
    customerId,
    amount: 25,
    paymentDate: TODAY,
    paymentMethod: "CASH",
    notes: `${RUN_ID} C4 receipt`,
    salesInvoiceId: creditId,
  });
  ok("C4 partial receipt accepted", receipt.status === 201, "201", `${receipt.status} ${receipt.text.slice(0, 200)}`, "posting");
  const arAfter = await num(
    `SELECT COALESCE(SUM(CASE WHEN a.account_code='1100' THEN l.debit - l.credit ELSE 0 END),0) AS v
       FROM journal_entry_lines l JOIN journal_entries e ON e.id=l.journal_entry_id
       JOIN accounts a ON a.id=l.account_id WHERE e.is_posted=1`,
  );
  okNum("C4 receivable reduced by exactly 25.00", r2(arBefore - arAfter), 25, "posting");
  const paid = await row<{ paid_amount: number; total_amount: number }>(
    "SELECT paid_amount, total_amount FROM sales_invoices WHERE id = ?",
    [creditId],
  );
  okNum("C4 paid_amount is 25.00", Number(paid?.paid_amount ?? 0), 25, "posting");
  okNum("C4 outstanding is 35.00", r2(Number(paid?.total_amount ?? 0) - Number(paid?.paid_amount ?? 0)), 35, "posting");
  // A BANK-method receipt, so account 1020 carries movement for the report checks.
  const bankReceipt = await api("POST", "/api/receipts", {
    customerId,
    amount: 5,
    paymentDate: TODAY,
    paymentMethod: "BANK",
    notes: `${RUN_ID} C4 bank receipt`,
  });
  ok(
    "C4 bank-method receipt accepted (it settles through account 1020)",
    bankReceipt.status === 201,
    "201",
    `${bankReceipt.status} ${bankReceipt.text.slice(0, 160)}`,
    "posting",
  );

  // C5 customer overpayment (AR measured immediately before the attempt)
  const arBeforeC5 = await num(
    `SELECT COALESCE(SUM(CASE WHEN a.account_code='1100' THEN l.debit - l.credit ELSE 0 END),0) AS v
       FROM journal_entry_lines l JOIN journal_entries e ON e.id=l.journal_entry_id
       JOIN accounts a ON a.id=l.account_id WHERE e.is_posted=1`,
  );
  const over = await api("POST", "/api/receipts", {
    customerId,
    amount: 40,
    paymentDate: TODAY,
    paymentMethod: "CASH",
    notes: `${RUN_ID} C5 overpay`,
    salesInvoiceId: creditId,
  });
  ok(
    "C5 customer overpayment accepted as an advance",
    over.status === 201,
    "201",
    `${over.status} ${over.text.slice(0, 160)}`,
    "boundary",
  );
  const arAfterC5 = await num(
    `SELECT COALESCE(SUM(CASE WHEN a.account_code='1100' THEN l.debit - l.credit ELSE 0 END),0) AS v
       FROM journal_entry_lines l JOIN journal_entries e ON e.id=l.journal_entry_id
       JOIN accounts a ON a.id=l.account_id WHERE e.is_posted=1`,
  );
  okNum("C5 overpayment moved A/R by exactly the receipt", arAfterC5, r2(arBeforeC5 - 40), "posting");

  // C6 supplier overpayment (allowed as an advance, like C5)
  const creditPurchase = await purchase({
    supplierId,
    invoiceDate: TODAY,
    paymentType: "CREDIT",
    notes: `${RUN_ID} C6 supplier invoice`,
    items: [{ itemId: mainId, quantity: 2, unitCost: 10, batchNumber: `${RUN_ID}-C6` }],
  });
  const purchaseId = Number(anyBody(creditPurchase)?.id ?? 0);
  const c6paid = await api("POST", "/api/payments", {
    supplierId,
    amount: 1000,
    paymentDate: TODAY,
    paymentMethod: "CASH",
    notes: `${RUN_ID} C6 overpay supplier`,
    purchaseInvoiceId: purchaseId,
  });
  ok(
    "C6 supplier overpayment accepted as an advance",
    c6paid.status === 201,
    "201",
    `${c6paid.status} ${c6paid.text.slice(0, 160)}`,
    "boundary",
  );

  // C7 duplicate numbers
  const explicit = `${RUN_ID}-DUP`;
  const first = await sale({
    customerId,
    invoiceDate: TODAY,
    paymentType: "CASH",
    invoiceNumber: explicit,
    notes: `${RUN_ID} C7 duplicate number`,
    items: [{ itemId: mainId, quantity: 1, unitPrice: 10 }],
  });
  ok("C7 explicit invoice number accepted", first.status === 201, "201", String(first.status), "sequence");
  const second = await sale({
    customerId,
    invoiceDate: TODAY,
    paymentType: "CASH",
    invoiceNumber: explicit,
    notes: `${RUN_ID} C7 duplicate number`,
    items: [{ itemId: mainId, quantity: 1, unitPrice: 10 }],
  });
  ok(
    "C7 duplicate invoice number rejected with 409",
    second.status === 409,
    "409",
    `${second.status} ${second.text.slice(0, 160)}`,
    "sequence",
  );
  const dupRows = await num("SELECT COUNT(*) AS v FROM sales_invoices WHERE invoice_number = ?", [explicit]);
  ok("C7 exactly one document holds the number", dupRows === 1, "1", String(dupRows), "sequence");

  // C8 purchase return against a CASH purchase
  const cashPurchase = await purchase({
    supplierId,
    invoiceDate: TODAY,
    paymentType: "CASH",
    notes: `${RUN_ID} C8 cash purchase`,
    items: [{ itemId: mainId, quantity: 2, unitCost: 10, batchNumber: `${RUN_ID}-C8` }],
  });
  const cashPurchaseId = Number(anyBody(cashPurchase)?.id ?? 0);
  const c8item = await row<{ id: number }>(
    "SELECT id FROM purchase_invoice_items WHERE invoice_id = ?",
    [cashPurchaseId],
  );
  const cashBefore = await num(
    `SELECT COALESCE(SUM(CASE WHEN a.account_code='1000' THEN l.debit - l.credit ELSE 0 END),0) AS v
       FROM journal_entry_lines l JOIN journal_entries e ON e.id=l.journal_entry_id
       JOIN accounts a ON a.id=l.account_id WHERE e.is_posted=1`,
  );
  const apBefore = await num(
    `SELECT COALESCE(SUM(CASE WHEN a.account_code='2000' THEN l.credit - l.debit ELSE 0 END),0) AS v
       FROM journal_entry_lines l JOIN journal_entries e ON e.id=l.journal_entry_id
       JOIN accounts a ON a.id=l.account_id WHERE e.is_posted=1`,
  );
  const purchaseReturn = await api("POST", "/api/purchase-returns", {
    invoiceId: cashPurchaseId,
    returnDate: TODAY,
    notes: `${RUN_ID} C8 return of a cash purchase`,
    items: [{ invoiceItemId: c8item?.id, quantity: 2 }],
  });
  ok("C8 purchase return accepted", purchaseReturn.status === 201, "201", `${purchaseReturn.status}`, "posting");
  if (purchaseReturn.status === 201) {
    const cashAfter = await num(
      `SELECT COALESCE(SUM(CASE WHEN a.account_code='1000' THEN l.debit - l.credit ELSE 0 END),0) AS v
         FROM journal_entry_lines l JOIN journal_entries e ON e.id=l.journal_entry_id
         JOIN accounts a ON a.id=l.account_id WHERE e.is_posted=1`,
    );
    const apAfter = await num(
      `SELECT COALESCE(SUM(CASE WHEN a.account_code='2000' THEN l.credit - l.debit ELSE 0 END),0) AS v
         FROM journal_entry_lines l JOIN journal_entries e ON e.id=l.journal_entry_id
         JOIN accounts a ON a.id=l.account_id WHERE e.is_posted=1`,
    );
    const cashDelta = r2(cashAfter - cashBefore);
    const apDelta = r2(apAfter - apBefore);
    ok(
      "C8 returning a CASH purchase refunds cash (cash +20.00, A/P unchanged)",
      eq(cashDelta, 20) && eq(apDelta, 0),
      "cash +20.00 and A/P +0.00",
      `cash ${cashDelta >= 0 ? "+" : ""}${cashDelta.toFixed(2)}, A/P ${apDelta >= 0 ? "+" : ""}${apDelta.toFixed(2)}`,
      "posting",
    );
    if (!eq(apDelta, 0)) {
      obs(
        `C8 root cause: ReturnsService.createPurchaseReturn always debits A/P (2000) — it never branches on the invoice's payment type, so a cash purchase refund lands on A/P and cash is never credited`,
        "posting",
      );
    }
  }

  // C9 batch-spanning sale + full return
  const spanId = b.ids.span!;
  const bA = b.batchIds[`${RUN_ID}-SA`];
  const bB = b.batchIds[`${RUN_ID}-SB`];
  const spanSale = await sale({
    customerId,
    invoiceDate: TODAY,
    paymentType: "CASH",
    notes: `${RUN_ID} C9 spanning sale`,
    items: [{ itemId: spanId, quantity: 12, unitPrice: 30 }],
  });
  ok(
    "C9 sale spanning two batches accepted",
    spanSale.status === 201,
    "201",
    `${spanSale.status} ${spanSale.text.slice(0, 160)}`,
    "stock",
  );
  if (spanSale.status === 201) {
    const qtyA = await batchQty(bA!);
    const qtyB = await batchQty(bB!);
    okNum("C9 batch A fully consumed (10 -> 0)", qtyA, 0, "stock");
    okNum("C9 batch B partially consumed (5 -> 3)", qtyB, 3, "stock");
    const recordedBatch = await row<{ batch_id: number }>(
      "SELECT batch_id FROM sales_invoice_items WHERE invoice_id = ?",
      [Number(anyBody(spanSale).id)],
    );
    obs(
      `C9 the sale consumed both batches but the invoice line records batch_id=${recordedBatch?.batch_id} (batch A) — the 2 units taken from batch B are not attributable`,
      "stock",
    );
    const cogsOfSale = await num(
      `SELECT COALESCE(SUM(l.debit),0) AS v FROM journal_entry_lines l
        JOIN journal_entries e ON e.id=l.journal_entry_id JOIN accounts a ON a.id=l.account_id
       WHERE e.source_table='sales_invoices' AND e.source_id=? AND a.account_code LIKE '5%'`,
      [Number(anyBody(spanSale).id)],
    );
    okNum("C9 COGS uses the real per-batch costs (10x10 + 2x20 = 140)", cogsOfSale, 140, "posting");
    const item = await row<{ id: number }>(
      "SELECT id FROM sales_invoice_items WHERE invoice_id = ?",
      [Number(anyBody(spanSale).id)],
    );
    const spanningReturn = await api("POST", "/api/sales-returns", {
      invoiceId: Number(anyBody(spanSale).id),
      returnDate: TODAY,
      notes: `${RUN_ID} C9 spanning return`,
      items: [{ invoiceItemId: item?.id, quantity: 12 }],
    });
    ok("C9 full return of the spanning sale accepted", spanningReturn.status === 201, "201", `${spanningReturn.status}`, "stock");
    if (spanningReturn.status === 201) {
      const qtyA2 = await batchQty(bA!);
      const qtyB2 = await batchQty(bB!);
      ok(
        "C9 a full return restores each batch to its pre-sale quantity",
        eq(qtyA2, 10) && eq(qtyB2, 5),
        "batch A 10, batch B 5",
        `batch A ${qtyA2}, batch B ${qtyB2}`,
        "stock",
      );
      const cogsNet = await num(
        `SELECT COALESCE(SUM(l.debit - l.credit),0) AS v FROM journal_entry_lines l
          JOIN journal_entries e ON e.id=l.journal_entry_id JOIN accounts a ON a.id=l.account_id
         WHERE e.source_table IN ('sales_invoices','sales_returns') AND e.source_id IN (?, ?) AND a.account_code LIKE '5%'`,
        [Number(anyBody(spanSale).id), Number(anyBody(spanningReturn).id)],
      );
      okNum("C9 a full return nets COGS to zero", cogsNet, 0, "posting");
      if (!eq(cogsNet, 0)) {
        obs(
          "C9 root cause: SalesInvoiceService.consumeStock returns only batches[0].id, so the return restores all 12 units into batch A at batch A's cost while 140.00 of COGS was posted",
          "stock",
        );
      }
    }
  }

  // C10 invalid returns
  const overReturn = await api("POST", "/api/sales-returns", {
    invoiceId: retInvoiceId,
    returnDate: TODAY,
    notes: `${RUN_ID} C10 over-return`,
    items: [{ invoiceItemId: retItems[0]?.id, quantity: 99 }],
  });
  ok("C10 returning more than was sold is rejected", overReturn.status === 400, "400", String(overReturn.status), "boundary");
  const ghostReturn = await api("POST", "/api/sales-returns", {
    invoiceId: 99999999,
    returnDate: TODAY,
    notes: `${RUN_ID} C10 ghost invoice`,
    items: [{ invoiceItemId: 1, quantity: 1 }],
  });
  ok("C10 return against a non-existent invoice is rejected 404", ghostReturn.status === 404, "404", String(ghostReturn.status), "boundary");
  await full("C end");
}

// =======================================================================
// SECTION D — concurrency
// =======================================================================
async function sectionD(b: Baseline): Promise<void> {
  sec("D concurrency");
  const customerId = b.ids.customer!;
  const supplierId = b.ids.supplier!;
  const concId = b.ids.conc!;

  // D1 ten simultaneous sales for the same item
  const before = await stockOf(concId);
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      sale({
        customerId,
        invoiceDate: TODAY,
        paymentType: "CASH",
        notes: `${RUN_ID} D1 concurrent ${i}`,
        items: [{ itemId: concId, quantity: 1, unitPrice: 10 }],
      }),
    ),
  );
  const accepted = results.filter((r) => r.status === 201).length;
  const after = await stockOf(concId);
  ok("D1 all ten concurrent sales succeeded", accepted === 10, "10 x 201", results.map((r) => r.status).join(","), "concurrency");
  okNum("D1 stock decremented by exactly 10", r2(before - after), 10, "concurrency");
  ok(
    "D1 stock never went negative",
    (await num("SELECT COUNT(*) AS v FROM stock_batches WHERE quantity_in_stock < -0.005")) === 0,
    "0 negative batches",
    "see I6",
    "concurrency",
  );
  const numbers = results.filter((r) => r.status === 201).map((r) => String(anyBody(r)?.invoiceNumber ?? ""));
  ok(
    "D1 all invoice numbers unique",
    new Set(numbers).size === numbers.length,
    "10 distinct",
    `${new Set(numbers).size} distinct of ${numbers.length}`,
    "concurrency",
  );
  await quick("D1 ten simultaneous sales");

  // D2 ten simultaneous invoices -> unique numbers
  const numbers2 = await Promise.all(
    Array.from({ length: 10 }, () => sale({
      customerId,
      invoiceDate: TODAY,
      paymentType: "CASH",
      notes: `${RUN_ID} D2 concurrent numbers`,
      items: [{ itemId: concId, quantity: 1, unitPrice: 10 }],
    })),
  );
  const okNumbers = numbers2.filter((r) => r.status === 201).map((r) => String(anyBody(r)?.invoiceNumber ?? ""));
  ok(
    "D2 concurrent allocations never duplicate a number",
    new Set(okNumbers).size === okNumbers.length,
    "all distinct",
    `${new Set(okNumbers).size} distinct of ${okNumbers.length}`,
    "concurrency",
  );

  // D3 two simultaneous receipts against the same invoice
  const inv = await sale({
    customerId,
    invoiceDate: TODAY,
    paymentType: "CREDIT",
    notes: `${RUN_ID} D3 race invoice`,
    items: [{ itemId: concId, quantity: 6, unitPrice: 10 }],
  });
  const raceInvoiceId = Number(anyBody(inv)?.id ?? 0);
  const pair = await Promise.all([
    api("POST", "/api/receipts", {
      customerId,
      amount: 40,
      paymentDate: TODAY,
      paymentMethod: "CASH",
      notes: `${RUN_ID} D3 race a`,
      salesInvoiceId: raceInvoiceId,
    }),
    api("POST", "/api/receipts", {
      customerId,
      amount: 40,
      paymentDate: TODAY,
      paymentMethod: "CASH",
      notes: `${RUN_ID} D3 race b`,
      salesInvoiceId: raceInvoiceId,
    }),
  ]);
  const paidRow = await row<{ paid_amount: number; total_amount: number }>(
    "SELECT paid_amount, total_amount FROM sales_invoices WHERE id = ?",
    [raceInvoiceId],
  );
  const bothAccepted = pair.every((r) => r.status === 201);
  ok(
    "D3 two simultaneous 40.00 receipts on a 60.00 invoice do not double-count",
    !bothAccepted || Number(paidRow?.paid_amount ?? 0) <= 60,
    "at most one accepted (or paid_amount <= total)",
    `statuses ${pair.map((r) => r.status).join(",")}; paid_amount=${paidRow?.paid_amount} on total ${paidRow?.total_amount}`,
    "concurrency",
  );
  if (bothAccepted) {
    obs(
      "D3 root cause: receivePayment reads total_amount/paid_amount for the guard BEFORE db.transaction, so two requests can both pass the outstanding check and both commit",
      "concurrency",
    );
  }

  // D3b two simultaneous payments to a supplier (no guard at all)
  const purch = await purchase({
    supplierId,
    invoiceDate: TODAY,
    paymentType: "CREDIT",
    notes: `${RUN_ID} D3b race purchase`,
    items: [{ itemId: concId, quantity: 2, unitCost: 10, batchNumber: `${RUN_ID}-D3B` }],
  });
  const racePurchaseId = Number(anyBody(purch)?.id ?? 0);
  const payPair = await Promise.all([
    api("POST", "/api/payments", {
      supplierId,
      amount: 20,
      paymentDate: TODAY,
      paymentMethod: "CASH",
      notes: `${RUN_ID} D3b a`,
      purchaseInvoiceId: racePurchaseId,
    }),
    api("POST", "/api/payments", {
      supplierId,
      amount: 20,
      paymentDate: TODAY,
      paymentMethod: "CASH",
      notes: `${RUN_ID} D3b b`,
      purchaseInvoiceId: racePurchaseId,
    }),
  ]);
  const paidRow2 = await row<{ paid_amount: number; total_amount: number }>(
    "SELECT paid_amount, total_amount FROM purchase_invoices WHERE id = ?",
    [racePurchaseId],
  );
  ok(
    "D3b two simultaneous payments cannot overshoot the payable",
    Number(paidRow2?.paid_amount ?? 0) <= Number(paidRow2?.total_amount ?? 0) + 0.005,
    `paid_amount <= ${paidRow2?.total_amount}`,
    `paid_amount=${paidRow2?.paid_amount} on ${paidRow2?.total_amount} (statuses ${payPair.map((r) => r.status).join(",")})`,
    "concurrency",
  );

  // D4 ten simultaneous purchases without an explicit batch number
  const batchBurst = await Promise.all(
    Array.from({ length: 10 }, () =>
      purchase({
        supplierId,
        invoiceDate: TODAY,
        paymentType: "CASH",
        notes: `${RUN_ID} D4 batch numbering`,
        items: [{ itemId: concId, quantity: 1, unitCost: 11 }],
      }),
    ),
  );
  ok(
    "D4 ten simultaneous purchases without an explicit batch number all succeed",
    batchBurst.every((r) => r.status === 201),
    "10 x 201",
    batchBurst.map((r) => r.status).join(",") +
      (batchBurst.some((r) => r.status >= 500) ? " (500 = same-millisecond batch-number collision)" : ""),
    "concurrency",
  );
  const burstBatches = await num(
    `SELECT COUNT(*) AS v FROM stock_batches b JOIN items i ON i.id = b.item_id
      WHERE i.item_code = ? AND b.batch_number LIKE 'PURCHASE-%'`,
    [`${RUN_ID}-CONC`],
  );
  await quick("D4 batch burst");
  obs(`D4 generated ${burstBatches} auto-numbered PURCHASE-* batches`);

  // D5 concurrent backup + write
  await concurrentBackupProbe();
  await full("D end");
}

/** Run the companion harness' `backup` phase while the API is being written to. */
async function concurrentBackupProbe(): Promise<void> {
  const dumpFile = path.join(CANONICAL_DIR, "dump.json");
  const pristine = path.join(OUT_DIR, "dump-pristine.json");
  const beforeFile = path.join(CANONICAL_DIR, "fingerprint-before.json");
  const pristineBefore = path.join(OUT_DIR, "fingerprint-before-pristine.json");
  const seqFile = path.join(CANONICAL_DIR, "sequences.json");
  const pristineSeq = path.join(OUT_DIR, "sequences-pristine.json");
  if (fs.existsSync(dumpFile)) fs.copyFileSync(dumpFile, pristine);
  if (fs.existsSync(beforeFile)) fs.copyFileSync(beforeFile, pristineBefore);
  if (fs.existsSync(seqFile)) fs.copyFileSync(seqFile, pristineSeq);

  // Restore the companion harness' canonical files under ALL outcomes: a local
  // rehearsal must never leave its own dump where a cloud restore would find it.
  const putBack = (): void => {
    if (fs.existsSync(pristine)) fs.copyFileSync(pristine, dumpFile);
    if (fs.existsSync(pristineBefore)) fs.copyFileSync(pristineBefore, beforeFile);
    if (fs.existsSync(pristineSeq)) fs.copyFileSync(pristineSeq, seqFile);
  };
  const child = new Promise<string>((resolve) => {
    try {
      const out = execFileSync(
        "npx",
        ["tsx", "cloud-audit.ts", "backup", "--engine", engine],
        { cwd: process.cwd(), encoding: "utf8", timeout: 600_000 },
      );
      resolve(out);
    } catch (err) {
      resolve(`backup failed: ${String(err).slice(0, 300)}`);
    } finally {
      putBack();
    }
  });
  const baseline = readBaseline();
  const burst = Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      sale({
        customerId: baseline?.ids.customer,
        invoiceDate: TODAY,
        paymentType: "CASH",
        notes: `${RUN_ID} D5 concurrent write ${i}`,
        items: [{ itemId: baseline?.ids.conc, quantity: 1, unitPrice: 10 }],
      }),
    ),
  );
  const out = await child;
  const burstResults = await burst;
  const okCount = burstResults.filter((r) => r.status === 201).length;
  obs(`D5 wrote ${okCount}/20 invoices while the backup phase ran`);

  let torn = "";
  try {
    const tables = JSON.parse(fs.readFileSync(dumpFile, "utf8")) as Record<string, Row[]>;
    const inv = tables.sales_invoices ?? [];
    const jes = tables.journal_entries ?? [];
    const invoiceIds = new Set(inv.map((r) => Number(r.id)));
    const jeSources = new Set(
      jes.filter((r) => String(r.source_table) === "sales_invoices").map((r) => Number(r.source_id)),
    );
    const missing = [...invoiceIds].filter((id) => !jeSources.has(id));
    if (missing.length > 0) torn = `${missing.length} invoices in the dump have no journal entry in the same dump`;
  } catch (err) {
    torn = `could not parse the dump: ${String(err).slice(0, 200)}`;
  }
  if (torn) {
    obs(
      `D5 FAIL-ISH: the backup phase is not a snapshot — ${torn} (the API's own cloud backup endpoint refuses to run, so this is the only backup path)`,
      "integrity",
    );
  } else {
    obs("D5 the dump taken during writes was internally consistent (invoice/entry pairing held)");
  }
  if (!out.includes("AUDIT")) obs(`D5 backup child output tail: ${out.trim().split("\n").slice(-2).join(" / ")}`);
  putBack();
}

// =======================================================================
// SECTION E — report cross-checks
// =======================================================================
async function sectionE(b: Baseline): Promise<void> {
  sec("E report cross-checks");
  const from = "2020-01-01";
  const to = "2031-12-31";
  const tb = await api("GET", `/api/reports/trial-balance?from=${from}&to=${to}`);
  const tbRows = (anyBody(tb)?.rows ?? []) as TbRow[];
  const ledger = await tbFromLedger(from, to);

  // E1 account set equality
  const apiCodes = new Set(tbRows.map((r) => r.accountCode));
  const inScope = await accountsInScope();
  const ledgerCodes = new Set([...ledger.keys()].filter((c) => inScope.has(c)));
  const missing = [...ledgerCodes].filter((c) => !apiCodes.has(c));
  const extra = [...apiCodes].filter((c) => !ledgerCodes.has(c));
  ok(
    "E1 every account with movement appears in the trial balance",
    missing.length === 0,
    "no missing accounts",
    missing.join(","),
    "reporting",
  );
  ok("E1 no account appears that has no ledger movement", extra.length === 0, "no extra accounts", extra.join(","), "reporting");

  // E2 per-account values
  const diffs: string[] = [];
  for (const r of tbRows) {
    const l = ledger.get(r.accountCode);
    if (!l) continue;
    if (!eq(r2(r.debit), l.debit) || !eq(r2(r.credit), l.credit)) diffs.push(`${r.accountCode} movement ${r.debit}/${r.credit} vs ${l.debit}/${l.credit}`);
    if (!eq(r2(r.closingDebit), l.closingDebit) || !eq(r2(r.closingCredit), l.closingCredit))
      diffs.push(`${r.accountCode} closing ${r.closingDebit}/${r.closingCredit} vs ${l.closingDebit}/${l.closingCredit}`);
  }
  ok("E2 every trial-balance value equals the ledger recomputation", diffs.length === 0, "all accounts match", diffs.slice(0, 5).join("; "), "reporting");
  ok(
    "E2 trial balance is internally balanced (total debit = total credit)",
    eq(Number(anyBody(tb)?.totalDebit ?? 0), Number(anyBody(tb)?.totalCredit ?? 0)),
    String(anyBody(tb)?.totalDebit),
    String(anyBody(tb)?.totalCredit),
    "reporting",
  );

  // E3 P&L
  const pl = await api("GET", `/api/reports/profit-and-loss?from=${from}&to=${to}`);
  const plLedger = await plFromLedger(from, to);
  okNum("E3 P&L revenue equals the ledger recomputation", Number(anyBody(pl)?.revenue ?? 0), plLedger.revenue, "reporting");
  okNum("E3 P&L expenses equals the ledger recomputation", Number(anyBody(pl)?.expenses ?? 0), plLedger.expenses, "reporting");
  okNum(
    "E3 P&L net profit = revenue - expenses",
    Number(anyBody(pl)?.netProfit ?? 0),
    r2(plLedger.revenue - plLedger.expenses),
    "reporting",
  );

  // E4 balance sheet
  const bs = await api("GET", `/api/reports/balance-sheet?asAt=${to}`);
  ok("E4 balance sheet reports itself balanced", Boolean(anyBody(bs)?.balanced), "true", String(anyBody(bs)?.balanced), "reporting");
  okNum(
    "E4 assets = liabilities + equity",
    Number(anyBody(bs)?.assets ?? 0),
    r2(Number(anyBody(bs)?.liabilities ?? 0) + Number(anyBody(bs)?.equity ?? 0)),
    "reporting",
  );

  // E5 party ledgers vs control accounts
  const parties = await rows<{ id: number; name: string; party_type: string }>(
    "SELECT id, name, party_type FROM parties WHERE company_id = 1 ORDER BY id",
  );
  let customerLedger = 0;
  let supplierLedger = 0;
  let checked = 0;
  for (const p of parties) {
    checked += 1;
    if (checked % 25 === 0) {
      console.log(`  [hb] party ledger cross-check ${checked}/${parties.length}`);
    }
    const res = await api("GET", `/api/reports/party-ledger?partyId=${p.id}&from=${from}&to=${to}`);
    const entries = (anyBody(res) ?? []) as Array<{ debit: number; credit: number; balance: number }>;
    const closing = entries.length ? Number(entries[entries.length - 1]!.balance) : 0;
    let running = 0;
    let arithmeticOk = true;
    for (const e of entries) {
      running = r2(running + Number(e.debit) - Number(e.credit));
      if (!eq(running, Number(e.balance))) arithmeticOk = false;
    }
    if (!arithmeticOk) {
      ok(`E5 running balance arithmetic for party ${p.id}`, false, "balance = previous + debit - credit", "mismatch", "reporting");
    }
    const dbSum = await num(
      `SELECT COALESCE(SUM(l.debit - l.credit),0) AS v FROM journal_entry_lines l
        JOIN journal_entries e ON e.id = l.journal_entry_id
       WHERE l.party_id = ? AND e.is_posted = 1 AND e.entry_date >= ? AND e.entry_date <= ?`,
      [p.id, from, to],
    );
    if (!eq(closing, r2(dbSum))) {
      ok(`E5 party ${p.id} ledger closing equals its lines`, false, String(r2(dbSum)), String(closing), "reporting");
    }
    if (p.party_type === "CUSTOMER" || p.party_type === "BOTH") customerLedger = r2(customerLedger + closing);
    if (p.party_type === "SUPPLIER" || p.party_type === "BOTH") supplierLedger = r2(supplierLedger + closing);
  }
  const ar = tbRows.find((r) => r.accountCode === "1100");
  const ap = tbRows.find((r) => r.accountCode === "2000");
  const arClosing = ar ? r2(ar.closingDebit - ar.closingCredit) : 0;
  const apClosing = ap ? r2(ap.closingCredit - ap.closingDebit) : 0;
  okNum("E5 sum of customer ledgers = AR control closing", customerLedger, arClosing, "reporting");
  okNum("E5 sum of supplier ledgers = AP control closing (credit positive)", -supplierLedger, apClosing, "reporting");

  // E6 dashboard cross-checks
  const dashRes = await api("GET", "/api/dashboard");
  ok("E6 dashboard reachable", dashRes.status === 200, "200", String(dashRes.status), "environment");
  const dash = anyBody(dashRes);
  const cashRes = await api("GET", `/api/reports/cash-book?from=${from}&to=${to}`);
  const cashEntries = (anyBody(cashRes) ?? []) as Array<{ balance: number }>;
  const cashBookClosing = cashEntries.length ? Number(cashEntries[cashEntries.length - 1]!.balance) : 0;
  const cashBookDb = await num(
    `SELECT COALESCE(SUM(l.debit-l.credit),0) AS v FROM journal_entry_lines l
      JOIN journal_entries e ON e.id=l.journal_entry_id JOIN accounts a ON a.id=l.account_id
     WHERE a.account_code='1000' AND e.is_posted=1 AND e.entry_date >= ? AND e.entry_date <= ?`,
    [from, to],
  );
  okNum("E6 cash book closing equals the ledger over the same window", cashBookClosing, r2(cashBookDb), "reporting");
  const dashCash = Number(dash?.balances?.cash ?? 0);
  const acct1020 = await num(
    `SELECT COALESCE(SUM(l.debit-l.credit),0) AS v FROM journal_entry_lines l
      JOIN journal_entries e ON e.id=l.journal_entry_id JOIN accounts a ON a.id=l.account_id
     WHERE a.account_code='1020' AND e.is_posted=1`,
  );
  ok(
    "E6 dashboard cash equals the cash-book closing",
    eq(dashCash, cashBookClosing),
    String(cashBookClosing),
    `${dashCash} (dashboard sums 1000+1020; 1020 movement is ${r2(acct1020)})`,
    "reporting",
  );
  if (!eq(dashCash, cashBookClosing)) {
    obs(
      "E6 root cause: DashboardService.balances.cash sums account codes 1000 AND 1020 while the cash book and the trial balance treat 1020 as a separate (bank) account",
      "reporting",
    );
  }
  okNum("E6 dashboard receivable = AR control closing", Number(dash?.receivablesPayables?.receivable ?? 0), arClosing, "reporting");
  okNum("E6 dashboard payable = AP control closing", Number(dash?.receivablesPayables?.payable ?? 0), apClosing, "reporting");
  const arDashDb = await num(
    `SELECT COALESCE(SUM(l.debit-l.credit),0) AS v FROM journal_entry_lines l
      JOIN journal_entries e ON e.id=l.journal_entry_id JOIN accounts a ON a.id=l.account_id
     WHERE a.account_code='1100' AND e.is_posted=1`,
  );
  okNum("E6 dashboard receivable equals the plain ledger sum", Number(dash?.receivablesPayables?.receivable ?? 0), r2(arDashDb), "reporting");

  // E7 monthly trend vs P&L
  const trend = (dash?.monthlyTrend ?? []) as Array<{ month: string; revenue: number; expenses: number; profit: number }>;
  let trendRevenue = 0;
  let trendExpenses = 0;
  let profitOk = true;
  for (const p of trend) {
    trendRevenue = r2(trendRevenue + Number(p.revenue));
    trendExpenses = r2(trendExpenses + Number(p.expenses));
    if (!eq(Number(p.profit), r2(Number(p.revenue) - Number(p.expenses)))) profitOk = false;
  }
  ok("E7 every trend point's profit = revenue - expenses", profitOk, "consistent", "mismatch", "reporting");
  if (trend.length > 0) {
    const trendFrom = `${String(trend[0]!.month).slice(0, 7)}-01`;
    const plWindow = await plFromLedger(trendFrom, TODAY);
    const windowRevenue = r2(plWindow.revenue);
    okNum(
      "E7 monthly trend revenue sums to the P&L revenue over the trend window",
      trendRevenue,
      windowRevenue,
      "reporting",
    );
    if (!eq(trendRevenue, windowRevenue)) {
      obs(
        `E7 root cause: DashboardService.monthlyTrend sums only jel.credit on REVENUE accounts (${trendRevenue.toFixed(2)}) while the P&L nets debits too (${windowRevenue.toFixed(2)}) — contra-revenue entries (returns) are ignored by the trend`,
        "reporting",
      );
    }
    const monthPl = await plFromLedger(trendFrom, TODAY);
    okNum(
      "E7 monthly trend expenses sums to the P&L expenses over the trend window",
      trendExpenses,
      r2(monthPl.expenses) + 0,
      "reporting",
    );
  }

  // E8 CSV parity
  const tbJson = mapTb(tbRows);
  const csv = await api("GET", `/api/reports/trial-balance.csv?from=${from}&to=${to}`);
  ok("E8 trial-balance CSV downloads", csv.status === 200, "200", String(csv.status), "reporting");
  const csvRows = csv.text.trim().split("\n");
  const header = csvRows[0] ?? "";
  ok("E8 CSV header names the closing columns", /closing/i.test(header), "header with closing columns", header, "reporting");
  const csvDiffs: string[] = [];
  for (const line of csvRows.slice(1)) {
    const cells = splitCsv(line);
    const code = cells[0];
    if (!code || code.toUpperCase().includes("TOTAL")) continue;
    const jsonRow = tbJson.get(code);
    if (!jsonRow) {
      csvDiffs.push(`CSV has ${code} with no JSON row`);
      continue;
    }
    const numeric = cells.slice(1).map((c) => Number(c)).filter((n) => Number.isFinite(n));
    if (numeric.length >= 4) {
      const closingDebit = numeric[numeric.length - 2]!;
      const closingCredit = numeric[numeric.length - 1]!;
      if (!eq(closingDebit, r2(jsonRow.closingDebit)) || !eq(closingCredit, r2(jsonRow.closingCredit)))
        csvDiffs.push(`${code}: csv ${closingDebit}/${closingCredit} vs json ${jsonRow.closingDebit}/${jsonRow.closingCredit}`);
    }
  }
  ok("E8 CSV values equal the JSON values", csvDiffs.length === 0, "identical", csvDiffs.slice(0, 5).join("; "), "reporting");

  // E9 export-all internal balance
  const exportAll = await api("GET", `/api/reports/export-all.csv?from=${from}&to=${to}`);
  ok("E9 export-all CSV downloads", exportAll.status === 200, "200", String(exportAll.status), "reporting");
  const text = exportAll.text;
  ok("E9 export-all contains every section", /trial balance/i.test(text) && /profit/i.test(text) && /balance sheet/i.test(text) && /cash/i.test(text), "trial balance + P&L + balance sheet + cash book", "missing a section", "reporting");
  const bsSection = text.match(/balance sheet[\s\S]*?(?=\n\s*\n|$)/i)?.[0] ?? "";
  ok(
    "E9 export-all balance-sheet section reports itself balanced",
    /balanced/i.test(bsSection) ? /yes/i.test(bsSection) : false,
    "balanced: YES",
    bsSection.slice(0, 200) || "no balance-sheet section found",
    "reporting",
  );
  await full("E end");
}

function mapTb(rowsIn: TbRow[]): Map<string, TbRow> {
  const m = new Map<string, TbRow>();
  for (const r of rowsIn) m.set(r.accountCode, r);
  return m;
}
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

// =======================================================================
// SECTION F — sequences and numbering
// =======================================================================
async function sectionF(b: Baseline): Promise<void> {
  sec("F sequence and numbering");
  const customerId = b.ids.customer!;
  const mainId = b.ids.main!;

  const sequences = await rows<{ document_type: string; prefix: string; next_number: number; company_id: number }>(
    "SELECT document_type, prefix, next_number, company_id FROM numbering_sequences WHERE company_id = 1 ORDER BY document_type",
  );
  obs(`declared sequences: ${sequences.map((s) => `${s.document_type}=${s.prefix}${s.next_number}`).join(", ")}`);

  // F1 automatic number format + increment
  const seqBefore = await row<{ next_number: number; prefix: string }>(
    "SELECT next_number, prefix FROM numbering_sequences WHERE document_type='SALES_INVOICE' AND company_id=1",
  );
  const auto = await sale({
    customerId,
    invoiceDate: TODAY,
    paymentType: "CASH",
    notes: `${RUN_ID} F1 auto number`,
    items: [{ itemId: mainId, quantity: 1, unitPrice: 10 }],
  });
  ok("F1 auto-numbered invoice created", auto.status === 201, "201", String(auto.status), "sequence");
  const seqAfter = await row<{ next_number: number }>(
    "SELECT next_number FROM numbering_sequences WHERE document_type='SALES_INVOICE' AND company_id=1",
  );
  const used = String(anyBody(auto)?.invoiceNumber ?? "");
  ok(
    "F1 the number uses the declared prefix",
    used.startsWith(String(seqBefore?.prefix ?? "SI-")),
    `prefix ${seqBefore?.prefix}`,
    used,
    "sequence",
  );
  ok(
    "F1 the number is prefix + zero-padded 5 digits",
    new RegExp(`^${String(seqBefore?.prefix ?? "SI-").replace(/[-]/g, "\\-")}\\d{5}$`).test(used),
    `${seqBefore?.prefix}00000`,
    used,
    "sequence",
  );
  const beforeNext = Number(seqBefore?.next_number ?? 0);
  const advance = Number(seqAfter?.next_number ?? 0) - beforeNext;
  ok(
    "F1 the allocated number is the sequence's next value + 1",
    Number(used.slice(-5)) === beforeNext + 1,
    `SI-${String(beforeNext + 1).padStart(5, "0")}`,
    used,
    "sequence",
  );
  // Every sale also posts a journal entry whose voucher is drawn from the SAME
  // SALES_INVOICE namespace, so one sale consumes two numbers.
  const ownEntry = await row<{ voucher_number: string }>(
    "SELECT voucher_number FROM journal_entries WHERE source_table='sales_invoices' AND source_id=?",
    [Number(anyBody(auto)?.id ?? 0)],
  );
  const jeUsed = String(ownEntry?.voucher_number ?? "");
  ok(
    "F1 the paired journal voucher takes the following number in the same namespace",
    advance === 1 || (advance === 2 && Number(jeUsed.slice(-5)) === beforeNext + 2),
    `advance 1, or 2 with the entry at SI-${String(beforeNext + 2).padStart(5, "0")}`,
    `advance ${advance}, entry voucher ${jeUsed || "(none)"}`,
    "sequence",
  );
  if (advance === 2) {
    obs(
      `F1 one sales invoice consumes two SI- numbers: the invoice takes SI-${String(beforeNext + 1).padStart(5, "0")} and its journal entry voucher takes SI-${String(beforeNext + 2).padStart(5, "0")}`,
      "sequence",
    );
  }

  // F2 no reuse after deletion
  const second = await sale({
    customerId,
    invoiceDate: TODAY,
    paymentType: "CASH",
    notes: `${RUN_ID} F2 no reuse`,
    items: [{ itemId: mainId, quantity: 1, unitPrice: 10 }],
  });
  const secondNumber = String(anyBody(second)?.invoiceNumber ?? "");
  ok(
    "F2 a later allocation never repeats an earlier number",
    secondNumber !== used && Number(secondNumber.slice(-5)) > Number(used.slice(-5)),
    "strictly increasing",
    `${used} then ${secondNumber}`,
    "sequence",
  );

  // F3 full sweep for next_number <= max_used
  const targets: Array<[string, string, string | null]> = [
    ["ITEM", "items", "item_code"],
    ["CUSTOMER", "parties", "code"],
    ["SUPPLIER", "parties", "code"],
    ["SALES_INVOICE", "sales_invoices", "invoice_number"],
    ["PURCHASE_INVOICE", "purchase_invoices", "invoice_number"],
    ["SALES_RETURN", "sales_returns", "return_number"],
    ["PURCHASE_RETURN", "purchase_returns", "return_number"],
    ["PAYMENT", "payments", "voucher_number"],
    ["RECEIPT", "receipts", "voucher_number"],
    ["EXPENSE_VOUCHER", "expenses", "voucher_number"],
    ["PRODUCTION_ORDER", "production_orders", "order_number"],
    ["JOURNAL_VOUCHER", "journal_entries", "voucher_number"],
  ];
  // A fresh read: the array above was captured before F1/F2 allocated.
  const seqFresh = await rows<{ document_type: string; prefix: string; next_number: number }>(
    "SELECT document_type, prefix, next_number FROM numbering_sequences WHERE company_id = 1",
  );
  // SALES_INVOICE shares its namespace with journal entry vouchers.
  const extraNamespaces: Record<string, Array<[string, string]>> = {
    SALES_INVOICE: [["journal_entries", "voucher_number"]],
    PURCHASE_INVOICE: [["journal_entries", "voucher_number"]],
    PAYMENT: [["journal_entries", "voucher_number"]],
    RECEIPT: [["journal_entries", "voucher_number"]],
    EXPENSE_VOUCHER: [["journal_entries", "voucher_number"]],
  };
  const collisions: string[] = [];
  const staleInfo: string[] = [];
  for (const [docType, table, column] of targets) {
    const seq = seqFresh.find((s) => s.document_type === docType);
    if (!seq || !hasTable(table)) continue;
    const prefix = String(seq.prefix ?? "");
    let maxUsed = await num(
      `SELECT COALESCE(MAX(CAST(SUBSTR(${column}, ?) AS INTEGER)),0) AS v FROM ${table}
        WHERE ${column} LIKE ?`,
      [prefix.length + 1, `${prefix}%`],
    );
    for (const [t2, c2] of extraNamespaces[docType] ?? []) {
      if (!hasTable(t2)) continue;
      maxUsed = Math.max(
        maxUsed,
        await num(
          `SELECT COALESCE(MAX(CAST(SUBSTR(${c2}, ?) AS INTEGER)),0) AS v FROM ${t2} WHERE ${c2} LIKE ?`,
          [prefix.length + 1, `${prefix}%`],
        ),
      );
    }
    // A seeded row takes the conflict path: the next allocation is next_number+1.
    const predictedNext = Number(seq.next_number) + 1;
    if (predictedNext <= maxUsed) {
      collisions.push(
        `${docType}: the next allocation would be ${prefix}${String(predictedNext).padStart(5, "0")} which already exists (max used ${maxUsed})`,
      );
    }
    if (Number(seq.next_number) <= maxUsed) {
      staleInfo.push(`${docType} (next_number=${seq.next_number} <= max_used=${maxUsed})`);
    }
  }
  ok(
    "F3 no sequence would re-issue a number that already exists",
    collisions.length === 0,
    "every next allocation is a fresh number",
    collisions.join(" | "),
    "sequence",
  );
  if (staleInfo.length > 0) {
    obs(
      `F3 the counter holds the LAST issued number rather than the next one, so 'next_number <= max_used' is true for: ${staleInfo.join(", ")}. Harmless on its own (the allocation increments first) — the collision test above is the one that matters`,
      "sequence",
    );
  }
  if (collisions.length > 0) {
    const itemOnly = collisions.every((c) => c.startsWith("ITEM:"));
    obs(
      itemOnly
        ? "F3 the only collisions are on ITEM, which predates this run (next_number=1 while ITEM-00001..ITEM-01752 exist) — a real, pre-existing sequence defect"
        : "F3 collisions found (see evidence)",
      "sequence",
    );
  }

  // F4 the shared invoice/journal namespace
  const si = await row<{ next_number: number }>(
    "SELECT next_number FROM numbering_sequences WHERE document_type='SALES_INVOICE'",
  );
  const siMax = await num(
    "SELECT COALESCE(MAX(CAST(SUBSTR(invoice_number,4) AS INTEGER)),0) AS v FROM sales_invoices WHERE invoice_number LIKE 'SI-%'",
  );
  const jeSiMax = await num(
    "SELECT COALESCE(MAX(CAST(SUBSTR(voucher_number,4) AS INTEGER)),0) AS v FROM journal_entries WHERE voucher_number LIKE 'SI-%'",
  );
  obs(
    `F4 the SI- namespace is shared with journal entry vouchers (invoice max ${siMax}, journal entry max ${jeSiMax}, sequence next ${si?.next_number}) — each sale consumes two SI- numbers`,
    "sequence",
  );
  await full("F end");
}

// =======================================================================
// SECTION G — data quality sweep
// =======================================================================
async function sectionG(b: Baseline): Promise<void> {
  sec("G data-quality sweep");

  const orphanLines = await num(
    "SELECT COUNT(*) AS v FROM journal_entry_lines l WHERE NOT EXISTS (SELECT 1 FROM journal_entries e WHERE e.id=l.journal_entry_id)",
  );
  ok("G orphan journal lines", orphanLines === 0, "0", String(orphanLines), "integrity");

  const noLines = await num(
    "SELECT COUNT(*) AS v FROM journal_entries je WHERE NOT EXISTS (SELECT 1 FROM journal_entry_lines l WHERE l.journal_entry_id=je.id)",
  );
  ok("G entries with no lines", noLines === 0, "0", String(noLines), "integrity");

  const batchNoItem = await num(
    `SELECT COUNT(*) AS v FROM stock_batches b
      WHERE NOT EXISTS (SELECT 1 FROM items i WHERE i.id=b.item_id)`,
  );
  ok("G stock batches without an item", batchNoItem === 0, "0", String(batchNoItem), "integrity");

  const dups = await duplicateNumbers();
  ok("G duplicate document numbers / codes", dups.length === 0, "none", dups.join(", "), "integrity");

  const negativeStock = await num("SELECT COUNT(*) AS v FROM stock_batches WHERE quantity_in_stock < -0.005");
  ok("G negative stock quantities", negativeStock === 0, "0", String(negativeStock), "stock");

  const negativeCost = await num(
    "SELECT COUNT(*) AS v FROM stock_batches WHERE purchase_price < -0.005 OR raw_unit_cost < -0.005 OR packing_unit_cost < -0.005",
  );
  ok("G negative batch costs", negativeCost === 0, "0", String(negativeCost), "stock");

  const badLines = await rows<{ invoice_number: string; quantity: number; line_total: number }>(
    `SELECT i.invoice_number, si.quantity, si.line_total FROM sales_invoice_items si
       JOIN sales_invoices i ON i.id = si.invoice_id WHERE si.quantity <= 0
     UNION ALL
     SELECT p.invoice_number, pi.quantity, pi.line_total FROM purchase_invoice_items pi
       JOIN purchase_invoices p ON p.id = pi.invoice_id WHERE pi.quantity <= 0`,
  );
  ok(
    "G non-positive invoice line quantities",
    badLines.length === 0,
    "0 lines",
    `${badLines.length} line(s): ${badLines.slice(0, 5).map((l) => `${l.invoice_number} qty=${l.quantity} total=${l.line_total}`).join(", ")}`,
    "integrity",
  );
  if (badLines.length > 0) {
    obs(
      "G root cause: toStorage() rounds every stored value to 2 decimals, so a sub-cent quantity (0.0001) persists as 0 while the line total and the stock movement keep the fractional amount",
      "boundary",
    );
  }

  const futureDated = await num(
    "SELECT COUNT(*) AS v FROM journal_entries WHERE entry_date > date('now')",
  );
  obs(`G future-dated posted entries: ${futureDated}${futureDated > 0 ? " (the app has no dating policy; B4/B5 deliberately created some)" : ""}`);

  const unbalanced = await num(
    `SELECT COUNT(*) AS v FROM (SELECT journal_entry_id FROM journal_entry_lines
       GROUP BY journal_entry_id HAVING ABS(COALESCE(SUM(debit),0)-COALESCE(SUM(credit),0)) > 0.005)`,
  );
  ok("G journal entries beyond tolerance", unbalanced === 0, "0", String(unbalanced), "posting");

  const missingParty = await num(
    `SELECT COUNT(*) AS v FROM journal_entry_lines l
      WHERE l.party_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM parties p WHERE p.id=l.party_id)`,
  );
  ok("G ledger lines referencing a missing party", missingParty === 0, "0", String(missingParty), "integrity");

  const missingItem = await num(
    `SELECT COUNT(*) AS v FROM sales_invoice_items si
      WHERE NOT EXISTS (SELECT 1 FROM items i WHERE i.id=si.item_id)`,
  );
  ok("G sales lines referencing a missing item", missingItem === 0, "0", String(missingItem), "integrity");

  const missingAccount = await num(
    `SELECT COUNT(*) AS v FROM journal_entry_lines l
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id=l.account_id)`,
  );
  ok("G ledger lines referencing a missing account", missingAccount === 0, "0", String(missingAccount), "integrity");

  // Document-level reconciliation: header total vs its lines, and vs the entry.
  const headerMismatch = await num(
    `SELECT COUNT(*) AS v FROM sales_invoices si
      WHERE ABS(si.total_amount - (SELECT COALESCE(SUM(si2.line_total),0) FROM sales_invoice_items si2 WHERE si2.invoice_id = si.id)) > 0.005`,
  );
  ok("G sales invoice totals equal the sum of their lines", headerMismatch === 0, "0", String(headerMismatch), "posting");

  const entryMismatch = await num(
    `SELECT COUNT(*) AS v FROM sales_invoices si
      WHERE NOT EXISTS (
        SELECT 1 FROM journal_entries e
         WHERE e.source_table='sales_invoices' AND e.source_id=si.id
           AND ABS((SELECT COALESCE(SUM(l.debit),0) FROM journal_entry_lines l WHERE l.journal_entry_id=e.id) - (si.total_amount + COALESCE((SELECT SUM(l2.debit) FROM journal_entry_lines l2 JOIN accounts a ON a.id=l2.account_id WHERE l2.journal_entry_id=e.id AND a.account_code LIKE '5%'),0))) <= 0.005
      )`,
  );
  ok(
    "G every sales invoice's entry debits equal its total plus COGS",
    entryMismatch === 0,
    "0 mismatches",
    String(entryMismatch),
    "posting",
  );

  const orphanCount = await sourceOrphanCount();
  const orphanEntries = (await orphansBySource()).join("; ");
  ok(
    "G entries whose declared source document is missing",
    orphanCount <= preExisting.orphanSources,
    `no more than the ${preExisting.orphanSources} pre-existing`,
    `${orphanCount} total / ${orphanCount - preExisting.orphanSources} new${orphanEntries ? ` (${orphanEntries})` : ""}`,
    "integrity",
  );
  if (preExisting.orphanSources > 0) {
    obs(`G pre-existing dangling sources (not caused by this run): ${orphanEntries || preExisting.orphanSources}`);
  }

  // I7 movement reconciliation (documented, expected to be noisy)
  if (hasTable("stock_movements")) {
    const drift = await num(
      `SELECT COUNT(*) AS v FROM stock_batches b
        WHERE ABS(COALESCE(b.quantity_in_stock,0) -
              COALESCE((SELECT SUM(m.quantity) FROM stock_movements m WHERE m.batch_id=b.id),0)) > 0.005`,
    );
    const total = await num("SELECT COUNT(*) AS v FROM stock_batches");
    ok(
      "I7 SUM(stock_movements) = quantity_in_stock for every batch",
      drift <= preExisting.drift,
      `no more than the ${preExisting.drift} pre-existing drifting batches`,
      `${drift} of ${total} batches drift (${drift - preExisting.drift} caused by this run: sales/purchases/returns never write stock_movements)`,
      "stock",
    );
  }

  // Document-driven per-batch reconciliation for the batches this run touched.
  const stressBatches = await rows<{ id: number; batch_number: string; quantity_in_stock: number; item_id: number }>(
    "SELECT id, batch_number, quantity_in_stock, item_id FROM stock_batches WHERE batch_number LIKE ?",
    [`${RUN_ID}%`],
  );
  const batchProblems: string[] = [];
  for (const batch of stressBatches) {
    const opening = await num(
      "SELECT COALESCE(SUM(quantity),0) AS v FROM stock_movements WHERE batch_id = ? AND movement_type LIKE 'OPENING%'",
      [batch.id],
    );
    const purchased = await num(
      "SELECT COALESCE(SUM(quantity),0) AS v FROM purchase_invoice_items WHERE batch_id = ?",
      [batch.id],
    );
    const sold = await num(
      "SELECT COALESCE(SUM(quantity),0) AS v FROM sales_invoice_items WHERE batch_id = ?",
      [batch.id],
    );
    // Returns are attributed through the line they reverse (returns carry no batch).
    const soldReturned = await num(
      `SELECT COALESCE(SUM(sri.quantity),0) AS v FROM sales_return_items sri
        JOIN sales_invoice_items sii ON sii.id = sri.invoice_item_id WHERE sii.batch_id = ?`,
      [batch.id],
    );
    const purchasedReturned = await num(
      `SELECT COALESCE(SUM(pri.quantity),0) AS v FROM purchase_return_items pri
        JOIN purchase_invoice_items pii ON pii.id = pri.invoice_item_id WHERE pii.batch_id = ?`,
      [batch.id],
    );
    const expected = r2(opening + purchased - sold + soldReturned - purchasedReturned);
    if (!eq(Number(batch.quantity_in_stock), expected)) {
      batchProblems.push(
        `${batch.batch_number}: db ${batch.quantity_in_stock} vs documents ${expected} (opening ${opening} + purchased ${purchased} - sold ${sold} + returned ${soldReturned} - purchase-returned ${purchasedReturned})`,
      );
    }
  }
  ok(
    "G per-batch stock reconciles against the documents (opening + purchases - sales + returns)",
    batchProblems.length === 0,
    "every batch reconciles",
    batchProblems.slice(0, 5).join(" | "),
    "stock",
  );
  if (batchProblems.length > 0) {
    obs(
      "G root cause: sales lines record only the FIRST batch consumed, so any quantity taken from a second batch is invisible to document-driven reconciliation",
      "stock",
    );
  }
  await full("G end");
}

// =======================================================================
// SECTION H — idempotency and replay
// =======================================================================
async function sectionH(b: Baseline): Promise<void> {
  sec("H idempotency and replay");
  const customerId = b.ids.customer!;
  const mainId = b.ids.main!;

  // H1 keyed replay
  const key = `${RUN_ID}-H1`;
  const one = await sale({
    customerId,
    invoiceDate: TODAY,
    paymentType: "CASH",
    invoiceNumber: key,
    notes: `${RUN_ID} H1 keyed`,
    items: [{ itemId: mainId, quantity: 1, unitPrice: 10 }],
  });
  const two = await sale({
    customerId,
    invoiceDate: TODAY,
    paymentType: "CASH",
    invoiceNumber: key,
    notes: `${RUN_ID} H1 keyed`,
    items: [{ itemId: mainId, quantity: 1, unitPrice: 10 }],
  });
  const keyedRows = await num("SELECT COUNT(*) AS v FROM sales_invoices WHERE invoice_number = ?", [key]);
  ok(
    "H1 replaying the same request key creates exactly one document",
    one.status === 201 && two.status === 409 && keyedRows === 1,
    "201 then 409, one row",
    `${one.status} then ${two.status}, ${keyedRows} rows`,
    "boundary",
  );

  // H2 unkeyed replay
  const payload = {
    customerId,
    invoiceDate: TODAY,
    paymentType: "CASH" as const,
    notes: `${RUN_ID} H2 unkeyed`,
    items: [{ itemId: mainId, quantity: 1, unitPrice: 10 }],
  };
  const r1 = await sale(payload);
  const r2res = await sale(payload);
  const n1 = String(anyBody(r1)?.invoiceNumber ?? "");
  const n2 = String(anyBody(r2res)?.invoiceNumber ?? "");
  ok(
    "H2 an unkeyed replay creates a fresh number rather than a duplicate",
    r1.status === 201 && r2res.status === 201 && n1 !== n2,
    "two documents with distinct numbers",
    `${n1} / ${n2}`,
    "sequence",
  );
  await quick("H2 unkeyed replay");

  // H3 setup replay is idempotent (masters are reused, not duplicated)
  const before = await num("SELECT COUNT(*) AS v FROM items WHERE item_code = ?", [`${RUN_ID}-ITEM`]);
  await setup();
  const after = await num("SELECT COUNT(*) AS v FROM items WHERE item_code = ?", [`${RUN_ID}-ITEM`]);
  ok(
    "H3 re-running setup does not duplicate the masters",
    before === 1 && after === 1,
    "one item row",
    `${before} then ${after}`,
    "integrity",
  );
  await full("H end");
}

// =======================================================================
// SECTION I — failure injection
// =======================================================================
async function sectionI(b: Baseline): Promise<void> {
  sec("I failure injection");
  const customerId = b.ids.customer!;
  const mainId = b.ids.main!;
  const stockoutId = b.ids.stockout!;

  const invoicesBefore = await num("SELECT COUNT(*) AS v FROM sales_invoices");
  const balanceBefore = await quick("I baseline");

  const malformed = await raw("POST", "/api/sales-invoices", "{ this is not json");
  ok(
    "I1 malformed JSON rejected with 400",
    malformed.status === 400,
    "400",
    `${malformed.status} ${malformed.text.slice(0, 160)}`,
    "boundary",
  );
  if (malformed.status === 500) {
    obs(
      "I1 root cause: the error middleware maps every non-AppError to 500, so body-parser's 400/413 are lost",
      "boundary",
    );
  }

  const oversized = await raw(
    "POST",
    "/api/sales-invoices",
    JSON.stringify({
      customerId,
      invoiceDate: TODAY,
      paymentType: "CASH",
      notes: "x".repeat(1_400_000),
      items: [{ itemId: mainId, quantity: 1, unitPrice: 10 }],
    }),
  );
  ok(
    "I2 oversized payload rejected cleanly (413/400, not 500)",
    oversized.status === 413 || oversized.status === 400,
    "413 or 400",
    `${oversized.status} ${oversized.text.slice(0, 120)}`,
    "boundary",
  );

  const badCustomer = await sale({
    customerId: 99999999,
    invoiceDate: TODAY,
    paymentType: "CASH",
    notes: `${RUN_ID} I3 bad customer`,
    items: [{ itemId: mainId, quantity: 1, unitPrice: 10 }],
  });
  ok("I3 unknown customer rejected 404", badCustomer.status === 404, "404", String(badCustomer.status), "boundary");
  const badItem = await sale({
    customerId,
    invoiceDate: TODAY,
    paymentType: "CASH",
    notes: `${RUN_ID} I3 bad item`,
    items: [{ itemId: 99999999, quantity: 1, unitPrice: 10 }],
  });
  ok("I3 unknown item rejected 404", badItem.status === 404, "404", String(badItem.status), "boundary");
  const noAuth = await fetch(`${base}/api/sales-invoices`, { signal: AbortSignal.timeout(30_000) });
  ok("I3 unauthenticated request rejected 401", noAuth.status === 401, "401", String(noAuth.status), "boundary");

  const invoicesMid = await num("SELECT COUNT(*) AS v FROM sales_invoices");
  ok("I1-I3 injections wrote no invoice rows", invoicesMid === invoicesBefore, String(invoicesBefore), String(invoicesMid), "integrity");

  // I4 partial write: the second line must fail, so nothing may persist.
  const mainStock = await stockOf(mainId);
  const stockoutStock = await stockOf(stockoutId);
  const partial = await sale({
    customerId,
    invoiceDate: TODAY,
    paymentType: "CASH",
    notes: `${RUN_ID} I4 partial write`,
    items: [
      { itemId: mainId, quantity: 1, unitPrice: 10 },
      { itemId: stockoutId, quantity: 5, unitPrice: 10 },
    ],
  });
  ok(
    "I4 a sale whose second line lacks stock is rejected 409",
    partial.status === 409,
    "409",
    `${partial.status} ${partial.text.slice(0, 160)}`,
    "boundary",
  );
  const residue = await num("SELECT COUNT(*) AS v FROM sales_invoices WHERE notes LIKE ?", [`%${RUN_ID} I4%`]);
  ok("I4 no header row survived the rollback", residue === 0, "0", String(residue), "posting");
  okNum("I4 the first line's stock was rolled back", await stockOf(mainId), mainStock, "stock");
  okNum("I4 the second item's stock is untouched", await stockOf(stockoutId), stockoutStock, "stock");
  const partialEntries = await num(
    `SELECT COUNT(*) AS v FROM journal_entries WHERE narration LIKE ?`,
    [`%${RUN_ID} I4%`],
  );
  ok("I4 no journal entry survived the rollback", partialEntries === 0, "0", String(partialEntries), "posting");

  // I5 no endpoint accepts a raw journal entry
  const rawJe = await api("POST", "/api/journal-entries", {
    entryDate: TODAY,
    lines: [{ accountId: 1, debit: 100 }, { accountId: 2, credit: 50 }],
  });
  ok(
    "I5 unbalanced journal entries cannot be posted directly (no route)",
    rawJe.status === 404,
    "404 (the /api/journal-entries route is read-only)",
    String(rawJe.status),
    "posting",
  );
  const invoicesAfter = await num("SELECT COUNT(*) AS v FROM sales_invoices");
  ok(
    "I4/I5 the injections added no invoice rows",
    invoicesAfter === invoicesBefore,
    String(invoicesBefore),
    String(invoicesAfter),
    "integrity",
  );
  const unbalancedNow = await num(
    `SELECT COUNT(*) AS v FROM (SELECT journal_entry_id FROM journal_entry_lines
       GROUP BY journal_entry_id HAVING ABS(COALESCE(SUM(debit),0)-COALESCE(SUM(credit),0)) > 0.005)`,
  );
  ok("I4/I5 no unbalanced entry was introduced", unbalancedNow === 0, "0", String(unbalancedNow), "integrity");
  void balanceBefore;
  await full("I end");
}

// =======================================================================
// kill test (run separately around an API restart)
// =======================================================================
async function killtest(b: Baseline): Promise<void> {
  sec("I kill mid-burst");
  const customerId = b.ids.customer!;
  // A dedicated item so the burst's effect is unambiguous (only the burst sells it).
  const itemRes = await api("POST", "/api/items", {
    itemName: `${RUN_ID} Kill`,
    itemCode: `${RUN_ID}-KILLITEM`,
    notes: `${RUN_ID} kill item`,
    unit: "UNIT",
    purchasePrice: 10,
    sellingPrice: 20,
    itemType: "FINISHED_GOOD",
  });
  const concId = Number(anyBody(itemRes)?.id ?? 0);
  ok(
    "kill-test item created",
    itemRes.status === 201 && concId > 0,
    "201 + id",
    `${itemRes.status} ${itemRes.text.slice(0, 160)}`,
    "environment",
  );
  const stocked = await api("POST", `/api/items/${concId}/opening-stock`, {
    quantity: 60,
    unitCost: 10,
    batchNumber: `${RUN_ID}-KILLBATCH`,
    partyId: b.ids.supplier,
  });
  ok(
    "kill-test item stocked with 60 units",
    stocked.status === 201,
    "201",
    `${stocked.status} ${stocked.text.slice(0, 160)}`,
    "environment",
  );
  const before = await stockOf(concId);
  const settlement = Array.from({ length: 25 }, (_, i) =>
    sale({
      customerId,
      invoiceDate: TODAY,
      paymentType: "CASH",
      notes: `${RUN_ID} KILL ${i}`,
      items: [{ itemId: concId, quantity: 1, unitPrice: 10 }],
    }),
  ).map((p: Promise<ApiResult>) =>
    Promise.race([
      p.then(
        (r: ApiResult) => `resolved:${r.status}`,
        (e: unknown) => `rejected:${String(e).slice(0, 40)}`,
      ),
      new Promise<string>((r) => setTimeout(() => r("pending"), 20_000)),
    ]),
  );
  // Kill only once part of the burst has actually committed, so the test sees a
  // genuinely mixed outcome (some committed, some in flight, some never sent).
  const commitDeadline = Date.now() + 15_000;
  let committedBeforeKill = 0;
  while (Date.now() < commitDeadline) {
    committedBeforeKill = await num("SELECT COUNT(*) AS v FROM sales_invoices WHERE notes LIKE ?", [
      `%${RUN_ID} KILL%`,
    ]);
    if (committedBeforeKill >= 3) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  console.log(`  ..   ${committedBeforeKill} kill-burst invoices committed before the kill`);
  let killed = "";
  try {
    const pid = execFileSync(
      "bash",
      ["-lc", "ss -ltnp 2>/dev/null | grep ':4302' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2"],
      { encoding: "utf8" },
    ).trim();
    execFileSync("bash", ["-lc", `kill -9 ${pid || 0}`], { encoding: "utf8" });
    killed = pid;
  } catch (err) {
    killed = `kill failed: ${String(err).slice(0, 120)}`;
  }
  const settled = await Promise.all(settlement);
  const resolved = settled.filter((s: string) => s.startsWith("resolved:201")).length;
  fs.writeFileSync(
    path.join(OUT_DIR, "killtest.json"),
    JSON.stringify({ killedPid: killed, resolved, before, itemId: concId, settled }, null, 2),
  );
  obs(`killtest killed listener pid ${killed}; ${resolved}/25 sales completed before the process died`);
  console.log("  ..   verify with: npx tsx cloud-audit-stress.ts killcheck --engine cloud");
}

async function killcheck(b: Baseline): Promise<void> {
  sec("I kill reconciliation");
  const state = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "killtest.json"), "utf8")) as {
    before: number;
    itemId: number;
    killedPid: string;
    resolved: number;
  };
  const concId = state.itemId;
  obs(`killtest killed listener pid ${state.killedPid}; ${state.resolved}/25 sales answered before the process died`);

  const invoices = await rows<{ id: number; invoice_number: string }>(
    "SELECT id, invoice_number FROM sales_invoices WHERE notes LIKE ?",
    [`%${RUN_ID} KILL%`],
  );
  let missingEntry = 0;
  let unpairedLines = 0;
  let lineTotal = 0;
  for (const inv of invoices) {
    const entry = await row<{ id: number }>(
      "SELECT id FROM journal_entries WHERE source_table='sales_invoices' AND source_id=?",
      [inv.id],
    );
    if (!entry) missingEntry += 1;
    const items = await rows<{ quantity: number; line_total: number }>(
      "SELECT quantity, line_total FROM sales_invoice_items WHERE invoice_id = ?",
      [inv.id],
    );
    if (items.length === 0) unpairedLines += 1;
    for (const it of items) lineTotal += Number(it.quantity);
  }
  const stock = await stockOf(concId);
  const opening = await num(
    `SELECT COALESCE(SUM(m.quantity),0) AS v FROM stock_movements m
      JOIN stock_batches b ON b.id=m.batch_id WHERE b.item_id = ? AND m.movement_type LIKE 'OPENING%'`,
    [concId],
  );
  const purchased = await num(
    `SELECT COALESCE(SUM(pi.quantity),0) AS v FROM purchase_invoice_items pi
      JOIN purchase_invoices p ON p.id = pi.invoice_id
      JOIN stock_batches sb ON sb.id = pi.batch_id
     WHERE sb.item_id = ?`,
    [concId],
  );
  const soldLines = await num("SELECT COALESCE(SUM(quantity),0) AS v FROM sales_invoice_items WHERE item_id = ?", [
    concId,
  ]);

  obs(
    `killcheck: ${invoices.length} surviving kill-burst invoices, ${lineTotal} units sold by them; item stock ${state.before} -> ${stock}`,
  );
  ok("I6 every surviving invoice has its journal entry", missingEntry === 0, "0", String(missingEntry), "posting");
  ok("I6 every surviving invoice has its line rows", unpairedLines === 0, "0", String(unpairedLines), "posting");
  ok(
    "I6 no more than the 25 fired requests committed",
    invoices.length <= 25,
    "<= 25",
    `${invoices.length}`,
    "concurrency",
  );
  okNum(
    "I6 the stock the burst consumed equals the units on its surviving invoices",
    r2(state.before - stock),
    r2(lineTotal),
    "stock",
  );
  okNum("I6 item stock = opening + purchases - sales", stock, r2(opening + purchased - soldLines), "stock");
  ok(
    "I6 stock never went negative after the kill",
    stock >= -0.005,
    ">= 0",
    String(stock),
    "stock",
  );
  await full("I kill reconciliation");
}

// =======================================================================
// cleanup
// =======================================================================
async function cleanup(): Promise<void> {
  sec("cleanup");
  const marker = `%${RUN_ID}%`;
  const salesIds = (await rows<{ id: number }>("SELECT id FROM sales_invoices WHERE notes LIKE ?", [marker])).map((r) => r.id);
  const purchaseIds = (await rows<{ id: number }>("SELECT id FROM purchase_invoices WHERE notes LIKE ?", [marker])).map((r) => r.id);
  const salesReturnIds = (await rows<{ id: number }>("SELECT id FROM sales_returns WHERE notes LIKE ?", [marker])).map((r) => r.id);
  const purchaseReturnIds = (await rows<{ id: number }>("SELECT id FROM purchase_returns WHERE notes LIKE ?", [marker])).map((r) => r.id);
  const itemIds = (
    await rows<{ id: number }>("SELECT id FROM items WHERE notes LIKE ? OR item_code LIKE ?", [marker, `%${RUN_ID}%`])
  ).map((r) => r.id);
  const partyIds = (await rows<{ id: number }>("SELECT id FROM parties WHERE name LIKE ?", [marker])).map((r) => r.id);
  const paymentRows = await rows<{ id: number; voucher_number: string }>(
    "SELECT id, voucher_number FROM payments WHERE notes LIKE ?",
    [marker],
  );
  const receiptRows = await rows<{ id: number; voucher_number: string }>(
    "SELECT id, voucher_number FROM receipts WHERE notes LIKE ?",
    [marker],
  );
  const expenseRows = await rows<{ id: number; voucher_number: string }>(
    "SELECT id, voucher_number FROM expenses WHERE description LIKE ?",
    [marker],
  );
  const bomIds = hasTable("bill_of_materials")
    ? (await rows<{ id: number }>("SELECT id FROM bill_of_materials WHERE notes LIKE ?", [marker])).map((r) => r.id)
    : [];
  const orderIds = hasTable("production_orders")
    ? (await rows<{ id: number }>("SELECT id FROM production_orders WHERE notes LIKE ?", [marker])).map((r) => r.id)
    : [];
  const categoryIds = (await rows<{ id: number }>("SELECT id FROM expense_categories WHERE name LIKE ?", [marker])).map((r) => r.id);

  console.log(
    `  ..   sales ${salesIds.length}, purchases ${purchaseIds.length}, sales returns ${salesReturnIds.length}, purchase returns ${purchaseReturnIds.length}, items ${itemIds.length}, parties ${partyIds.length}, payments ${paymentRows.length}, receipts ${receiptRows.length}, expenses ${expenseRows.length}`,
  );

  await db.transaction(async () => {
    // journal entries: by declared source, by voucher number, or by narration.
    const entryIds = new Set<number>();
    const addBySource = async (table: string, ids: number[]) => {
      for (const id of ids) {
        const e = await row<{ id: number }>(
          "SELECT id FROM journal_entries WHERE source_table = ? AND source_id = ?",
          [table, id],
        );
        if (e) entryIds.add(e.id);
      }
    };
    await addBySource("sales_invoices", salesIds);
    await addBySource("purchase_invoices", purchaseIds);
    await addBySource("sales_returns", salesReturnIds);
    await addBySource("purchase_returns", purchaseReturnIds);
    for (const p of [...paymentRows, ...receiptRows, ...expenseRows]) {
      const e = await row<{ id: number }>("SELECT id FROM journal_entries WHERE voucher_number = ?", [p.voucher_number]);
      if (e) entryIds.add(e.id);
    }
    for (const e of await rows<{ id: number }>("SELECT id FROM journal_entries WHERE narration LIKE ?", [marker])) {
      entryIds.add(e.id);
    }
    for (const id of entryIds) {
      await db.run("DELETE FROM journal_entry_lines WHERE journal_entry_id = ?", [id] as never);
    }
    for (const id of entryIds) {
      await db.run("DELETE FROM journal_entries WHERE id = ?", [id] as never);
    }

    // documents (each child delete is attempted defensively: a FK/name that
    // does not exist in this schema must not abort the cleanup transaction)
    const tryRun = async (sql: string, params: unknown[]): Promise<void> => {
      try {
        await db.run(sql, params as never);
      } catch {
        /* table/column not present in this schema */
      }
    };
    for (const p of paymentRows) await tryRun("DELETE FROM payment_allocations WHERE payment_id = ?", [p.id]);
    for (const r of receiptRows) await tryRun("DELETE FROM receipt_allocations WHERE receipt_id = ?", [r.id]);
    // returns before the invoices they point at (FK order)
    for (const id of salesReturnIds) {
      await tryRun("DELETE FROM sales_return_items WHERE return_id = ?", [id]);
      await db.run("DELETE FROM sales_returns WHERE id = ?", [id] as never);
    }
    for (const id of purchaseReturnIds) {
      await tryRun("DELETE FROM purchase_return_items WHERE return_id = ?", [id]);
      await db.run("DELETE FROM purchase_returns WHERE id = ?", [id] as never);
    }
    for (const id of salesIds) {
      await db.run("DELETE FROM sales_invoice_items WHERE invoice_id = ?", [id] as never);
      await db.run("DELETE FROM sales_invoices WHERE id = ?", [id] as never);
    }
    for (const id of purchaseIds) {
      await db.run("DELETE FROM purchase_invoice_items WHERE invoice_id = ?", [id] as never);
      await db.run("DELETE FROM purchase_invoices WHERE id = ?", [id] as never);
    }
    for (const p of paymentRows) await db.run("DELETE FROM payments WHERE id = ?", [p.id] as never);
    for (const r of receiptRows) await db.run("DELETE FROM receipts WHERE id = ?", [r.id] as never);
    for (const e of expenseRows) await db.run("DELETE FROM expenses WHERE id = ?", [e.id] as never);
    for (const id of categoryIds) await db.run("DELETE FROM expense_categories WHERE id = ?", [id] as never);
    // production orders reference a BOM, so they go first
    for (const id of orderIds) {
      await tryRun("DELETE FROM production_consumptions WHERE production_order_id = ?", [id]);
      await db.run("DELETE FROM production_orders WHERE id = ?", [id] as never);
    }
    for (const id of bomIds) {
      await tryRun("DELETE FROM bom_components WHERE bom_id = ?", [id]);
      await db.run("DELETE FROM bill_of_materials WHERE id = ?", [id] as never);
    }

    // stock
    const batchIds = (
      await rows<{ id: number }>(
        `SELECT id FROM stock_batches WHERE batch_number LIKE ? OR item_id IN (${itemIds.map(() => "?").join(",") || "NULL"})`,
        [`${RUN_ID}%`, ...itemIds],
      )
    ).map((r) => r.id);
    for (const id of batchIds) {
      await tryRun("DELETE FROM stock_movements WHERE batch_id = ?", [id]);
    }
    for (const id of batchIds) await db.run("DELETE FROM stock_batches WHERE id = ?", [id] as never);
    for (const id of itemIds) await db.run("DELETE FROM items WHERE id = ?", [id] as never);
    for (const id of partyIds) await db.run("DELETE FROM parties WHERE id = ?", [id] as never);
    const auditUserRow = await row<{ id: number }>("SELECT id FROM users WHERE username = ?", [AUDIT_USER]);
    if (auditUserRow) {
      await clearUserRefs(auditUserRow.id);
      await db.run("DELETE FROM users WHERE id = ?", [auditUserRow.id] as never);
    }
  });

  const leftovers: string[] = [];
  const checks: Array<[string, string, string]> = [
    ["sales_invoices", "notes", marker],
    ["purchase_invoices", "notes", marker],
    ["sales_returns", "notes", marker],
    ["purchase_returns", "notes", marker],
    ["items", "item_code", `%${RUN_ID}%`],
    ["parties", "name", marker],
    ["payments", "notes", marker],
    ["receipts", "notes", marker],
    ["expenses", "description", marker],
    ["journal_entries", "narration", marker],
    ["users", "username", AUDIT_USER],
  ];
  for (const [table, column, pattern] of checks) {
    if (!hasTable(table)) continue;
    const n = await num(`SELECT COUNT(*) AS v FROM ${table} WHERE ${column} LIKE ?`, [pattern]);
    if (n > 0) leftovers.push(`${table}: ${n}`);
  }
  ok("CLEANUP no audit rows remain", leftovers.length === 0, "none", leftovers.join(", "), "integrity");
  await full("post-cleanup");
}

// =======================================================================
// runner
// =======================================================================
async function all(): Promise<void> {
  const b = await setup();
  if (!b) return;
  await sectionA(b);
  await sectionB(b);
  await sectionC(b);
  await sectionD(b);
  await sectionE(b);
  await sectionF(b);
  await sectionG(b);
  await sectionH(b);
  await sectionI(b);
}

function report(): void {
  const resultFile = RESULT_FILE.replace(/\.json$/, `-${command}.json`);
  const totalPassed = Object.values(stats).reduce((a, s) => a + s.passed, 0);
  const totalFailed = Object.values(stats).reduce((a, s) => a + s.failed, 0);
  console.log("\n================ STRESS SUMMARY ================");
  for (const [name, s] of Object.entries(stats)) {
    console.log(`  ${name.padEnd(24)} ${String(s.passed).padStart(3)} passed  ${String(s.failed).padStart(3)} failed`);
  }
  console.log(`  ${"TOTAL".padEnd(24)} ${String(totalPassed).padStart(3)} passed  ${String(totalFailed).padStart(3)} failed`);
  const byClass = new Map<string, number>();
  for (const d of defects) byClass.set(d.classification, (byClass.get(d.classification) ?? 0) + 1);
  console.log("\n  defects by classification:");
  for (const [c, n] of [...byClass.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${c}: ${n}`);
  console.log(`\n  VERDICT: ${defects.length === 0 ? "AUDIT OK" : `AUDIT FAILED (${defects.length} defects)`}`);
  if (observations.length) {
    console.log("\n  observations:");
    for (const o of observations) console.log(`    [${o.classification}] ${o.section}: ${o.note}`);
  }
  fs.writeFileSync(
    resultFile,
    JSON.stringify(
      {
        engine,
        base,
        runId: RUN_ID,
        generatedAt: new Date().toISOString(),
        stats,
        defects,
        observations,
        sweeps,
      },
      null,
      2,
    ),
  );
  console.log(`\n  results written to ${resultFile}`);
}

/**
 * The hosted driver holds its TLS socket open, so node would otherwise sit on
 * the event loop forever after the work is done (which is what made the first
 * cloud run look stuck). Always exit explicitly.
 */
function finish(): void {
  process.exit(process.exitCode ?? 0);
}

switch (command) {
  case "setup": {
    const b = await setup();
    report();
    void b;
    finish();
    break;
  }
  case "a":
  case "b":
  case "c":
  case "d":
  case "e":
  case "f":
  case "g":
  case "h":
  case "i": {
    const b = readBaseline();
    if (!b) {
      console.error("no baseline; run `setup` first");
      process.exitCode = 1;
      break;
    }
    if (b.engine !== engine) {
      console.error(`baseline.json belongs to engine='${b.engine}', not '${engine}' — run cleanup for that engine`);
      process.exitCode = 1;
      break;
    }
    if (!(await ensureSession())) break;
    await loadAccounts();
    preExisting = b.preExisting ?? {
      orphanSources: await sourceOrphanCount(),
      drift: await movementDriftCount(),
    };
    const map: Record<string, (x: Baseline) => Promise<void>> = {
      a: sectionA,
      b: sectionB,
      c: sectionC,
      d: sectionD,
      e: sectionE,
      f: sectionF,
      g: sectionG,
      h: sectionH,
      i: sectionI,
    };
    await map[command]!(b);
    report();
    finish();
    break;
  }
  case "killtest": {
    const b = readBaseline();
    if (!b) {
      console.error("no baseline; run `setup` first");
      process.exitCode = 1;
      break;
    }
    if (b.engine !== engine) {
      console.error(`baseline.json belongs to engine='${b.engine}', not '${engine}'`);
      process.exitCode = 1;
      break;
    }
    if (!(await ensureSession())) break;
    preExisting = b.preExisting ?? {
      orphanSources: await sourceOrphanCount(),
      drift: await movementDriftCount(),
    };
    await killtest(b);
    report();
    finish();
    break;
  }
  case "killcheck": {
    const b = readBaseline();
    if (!b) {
      console.error("no baseline; run `setup` first");
      process.exitCode = 1;
      break;
    }
    if (b.engine !== engine) {
      console.error(`baseline.json belongs to engine='${b.engine}', not '${engine}'`);
      process.exitCode = 1;
      break;
    }
    preExisting = b.preExisting ?? {
      orphanSources: await sourceOrphanCount(),
      drift: await movementDriftCount(),
    };
    await killcheck(b);
    report();
    finish();
    break;
  }
  case "cleanup": {
    await cleanup();
    report();
    finish();
    break;
  }
  case "all": {
    await all();
    report();
    finish();
    break;
  }
  default:
    console.log(
      "usage: tsx cloud-audit-stress.ts <setup|a..i|killtest|killcheck|cleanup|all> [--engine local|cloud] [--db file] [--base url] [--run MARKER]",
    );
    finish();
}
