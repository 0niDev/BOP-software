/**
 * TEMPORARY hosted-database audit harness (delete when the audit is finished).
 *
 *   npx tsx cloud-audit.ts inspect  --engine cloud
 *   npx tsx cloud-audit.ts backup   --engine cloud
 *   npx tsx cloud-audit.ts http     --base http://127.0.0.1:4302
 *   npx tsx cloud-audit.ts restore  --engine cloud
 *   npx tsx cloud-audit.ts verify   --engine cloud
 *   npx tsx cloud-audit.ts cleanup  --engine cloud        # safety net, no dump needed
 *   npx tsx cloud-audit.ts all      --engine cloud --base http://127.0.0.1:4302
 *
 * `--engine local --db ./data/e2e.sqlite` rehearses every phase against a local
 * database, which is how this harness itself is validated before it is pointed
 * at the hosted one.
 *
 * Phases
 *   inspect  read-only inventory: tables, row counts, data window, masters
 *   backup   dump every table + fingerprint + AUTOINCREMENT counters to disk
 *   http     drive the running API: invoices on custom dates, then verify the
 *            report *filters* and every report *value* (both against the API and
 *            against an independent recomputation straight from the ledger)
 *   restore  clear every table and re-insert exactly the backup rows inside one
 *            transaction (schema untouched, AUTOINCREMENT counters put back)
 *   verify   fingerprint again and compare with the backup, byte for byte
 *   cleanup  delete audit rows by marker without touching anything else
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Row, SqlDatabase, SqlValue } from "./server/src/db/types.js";
import { LocalSqliteDatabase } from "./server/src/db/localSqlite.js";
import { SqliteCloudDatabase } from "./server/src/db/sqliteCloud.js";
import { hashPassword } from "./server/src/services/authService.js";
import { SCHEMA_SQL } from "./server/src/db/schema.js";
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
const RUN_ID = opt("run", "CLOUD-AUDIT");

const OUT_DIR = path.resolve("data", "cloud-audit");
const DUMP_FILE = path.join(OUT_DIR, "dump.json");
const SEQUENCE_FILE = path.join(OUT_DIR, "sequences.json");
const BEFORE_FILE = path.join(OUT_DIR, "fingerprint-before.json");
const AFTER_FILE = path.join(OUT_DIR, "fingerprint-after.json");
const REPORT_DIR = path.join(OUT_DIR, "reports");

const problems: string[] = [];
let checkCount = 0;
function check(condition: boolean, message: string): void {
  checkCount += 1;
  if (condition) {
    console.log(`  ok   ${message}`);
  } else {
    problems.push(message);
    console.error(`  FAIL ${message}`);
  }
}
function fail(message: string): void {
  check(false, message);
}
function note(message: string): void {
  console.log(`  ..   ${message}`);
}

const db: SqlDatabase =
  engine === "cloud" ? new SqliteCloudDatabase(env.sqliteCloudUrl) : new LocalSqliteDatabase(dbFile);

// --- generic helpers ---------------------------------------------------
const TABLES_SQL =
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name";

async function tableNames(): Promise<string[]> {
  const rows = await db.all<{ name: string }>(TABLES_SQL);
  return rows.map((row) => row.name);
}

function canonical(row: Row): string {
  return JSON.stringify(
    Object.keys(row)
      .sort()
      .map((key) => [key, row[key]]),
  );
}

/** Content summary of the whole database, tables and id counters included. */
async function fingerprint(): Promise<Record<string, { rows: number; checksum: string }>> {
  const result: Record<string, { rows: number; checksum: string }> = {};
  const names = [...(await tableNames()), "sqlite_sequence"];
  for (const table of names) {
    let rows: Row[] = [];
    try {
      rows = await db.all<Row>(`SELECT * FROM ${table}`);
    } catch {
      continue;
    }
    const checksum = createHash("sha256")
      .update(rows.map(canonical).sort().join("\n"))
      .digest("hex")
      .slice(0, 16);
    result[table] = { rows: rows.length, checksum };
  }
  return result;
}

function compareFingerprints(
  before: Record<string, { rows: number; checksum: string }>,
  after: Record<string, { rows: number; checksum: string }>,
): string[] {
  const diffs: string[] = [];
  for (const table of Object.keys(before)) {
    const a = before[table]!;
    const b = after[table];
    if (!b) diffs.push(`${table}: gone (-${a.rows} rows)`);
    else if (a.rows !== b.rows) diffs.push(`${table}: ${a.rows} -> ${b.rows} rows`);
    else if (a.checksum !== b.checksum) diffs.push(`${table}: ${a.rows} rows, content differs`);
  }
  for (const table of Object.keys(after)) {
    if (!before[table]) diffs.push(`${table}: new table (+${after[table]!.rows} rows)`);
  }
  return diffs;
}

/** children before parents (deletes) and parents before children (inserts) */
async function dependencyOrder(): Promise<{ deletes: string[]; inserts: string[] }> {
  const tables = await tableNames();
  const parents = new Map<string, string[]>();
  for (const table of tables) {
    const fks = await db
      .all<{ table: string }>(`PRAGMA foreign_key_list(${table})`)
      .catch(() => [] as Array<{ table: string }>);
    parents.set(table, [...new Set(fks.map((fk) => fk.table))].filter((t) => tables.includes(t)));
  }
  const depth = (table: string, seen = new Set<string>()): number => {
    if (seen.has(table)) return 0;
    seen.add(table);
    const deps = parents.get(table) ?? [];
    return deps.length === 0 ? 0 : 1 + Math.max(...deps.map((d) => depth(d, new Set(seen))));
  };
  const ordered = [...tables].sort((a, b) => depth(a) - depth(b));
  return { deletes: [...ordered].reverse(), inserts: ordered };
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

// --- phases ------------------------------------------------------------
async function inspect(): Promise<void> {
  console.log(`\n== inspect (${engine}) ==`);
  const names = await tableNames();
  let total = 0;
  for (const table of names) {
    try {
      const row = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
      const n = Number(row?.n ?? 0);
      total += n;
      if (n > 0) console.log(`  ${String(n).padStart(8)}  ${table}`);
    } catch (err) {
      console.log(`  ${"ERR".padStart(8)}  ${table}: ${String(err)}`);
    }
  }
  console.log(`  ${String(total).padStart(8)}  TOTAL across ${names.length} tables`);

  const expected = [...SCHEMA_SQL.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]!);
  const missing = expected.filter((table) => !names.includes(table));
  const extra = names.filter((table) => !expected.includes(table));
  check(
    missing.length === 0,
    `every table the app expects exists (${expected.length} declared${
      missing.length > 0 ? `, missing: ${missing.join(", ")}` : ""
    })`,
  );
  note(`${extra.length} table(s) exist that the app does not declare: ${extra.join(", ") || "none"}`);

  const window = await db.get<{ first: string; last: string; n: number }>(
    "SELECT MIN(entry_date) AS first, MAX(entry_date) AS last, COUNT(*) AS n FROM journal_entries",
  );
  console.log(
    `  ledger: ${window?.n ?? 0} entries from ${window?.first ?? "-"} to ${window?.last ?? "-"}`,
  );
  const unbalanced = await db.get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM (
       SELECT je.id FROM journal_entries je
       JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
       GROUP BY je.id HAVING ABS(SUM(jel.debit) - SUM(jel.credit)) > 0.005)`,
  );
  check(Number(unbalanced?.n ?? 0) === 0, `every journal entry is balanced (${unbalanced?.n ?? 0} off)`);
  const customers = await db.get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM parties WHERE party_type IN ('CUSTOMER','BOTH') AND is_active = 1",
  );
  const suppliers = await db.get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM parties WHERE party_type IN ('SUPPLIER','BOTH') AND is_active = 1",
  );
  const items = await db.get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM items i WHERE i.is_active = 1 AND EXISTS (
       SELECT 1 FROM stock_batches sb WHERE sb.item_id = i.id AND sb.is_active = 1 AND sb.quantity_in_stock > 0)`,
  );
  const users = await db.all<{ username: string }>("SELECT username FROM users ORDER BY id");
  console.log(
    `  active customers: ${customers?.n}, suppliers: ${suppliers?.n}, stocked items: ${items?.n}`,
  );

  // Numbering sequences vs the rows that already carry that prefix: a counter
  // behind the data means the app's own numbering collides on insert.
  const numberColumns: Record<string, string> = {
    ITEM: "items.item_code",
    SALES_INVOICE: "sales_invoices.invoice_number",
    PURCHASE_INVOICE: "purchase_invoices.invoice_number",
    SALES_RETURN: "sales_returns.return_number",
    PURCHASE_RETURN: "purchase_returns.return_number",
    PAYMENT: "payments.voucher_number",
    RECEIPT: "receipts.voucher_number",
    EXPENSE_VOUCHER: "expenses.voucher_number",
    JOURNAL_VOUCHER: "journal_entries.voucher_number",
    PRODUCTION_ORDER: "production_orders.order_number",
    CUSTOMER: "parties.code",
    SUPPLIER: "parties.code",
  };
  const sequences = await db.all<{ document_type: string; prefix: string; next_number: number }>(
    "SELECT document_type, prefix, next_number FROM numbering_sequences WHERE company_id = 1",
  );
  for (const sequence of sequences) {
    const target = numberColumns[sequence.document_type];
    if (!target) continue;
    const [table, column] = target.split(".") as [string, string];
    const prefix = String(sequence.prefix ?? "");
    if (!prefix) continue;
    const used = await db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${table} WHERE ${column} LIKE ?`,
      [`${prefix}%`],
    );
    if (Number(used?.n ?? 0) === 0) continue;
    const last = await db.get<{ v: number | null }>(
      `SELECT MAX(CAST(SUBSTR(${column}, ${prefix.length + 1}) AS INTEGER)) AS v
       FROM ${table} WHERE ${column} LIKE ?`,
      [`${prefix}%`],
    );
    const maxUsed = Number(last?.v ?? 0);
    if (Number(sequence.next_number ?? 1) <= maxUsed) {
      note(
        `numbering defect: ${sequence.document_type} next_number=${sequence.next_number} but ${used?.n} row(s) already use ${prefix}* up to ${prefix}${String(maxUsed).padStart(6, "0")} - creating one from the app fails`,
      );
    }
  }

  console.log(`  users: ${users.map((u) => u.username).join(", ") || "(none)"}`);
}

/**
 * Proves the two driver behaviours the restore depends on, without touching a
 * single production row: transactions must really roll back, and the temp
 * table must be connection-scoped. A temp table is used so a failed rollback
 * cannot leave anything behind.
 */
async function probe(): Promise<void> {
  console.log(`\n== probe (${engine}) ==`);
  const created = await db
    .exec("CREATE TEMP TABLE IF NOT EXISTS __audit_probe (x INTEGER)")
    .then(() => true)
    .catch((err: unknown) => {
      note(`temp table unavailable: ${String(err).slice(0, 160)}`);
      return false;
    });
  if (!created) {
    fail("cannot create a temp probe table, rollback behaviour unverified");
    return;
  }
  await db.exec("DELETE FROM __audit_probe");
  await db.exec("BEGIN");
  await db.run("INSERT INTO __audit_probe (x) VALUES (?)", [1]);
  const inside = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM __audit_probe");
  await db.exec("ROLLBACK");
  const after = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM __audit_probe");
  check(
    Number(inside?.n ?? 0) === 1 && Number(after?.n ?? 0) === 0,
    `BEGIN/ROLLBACK behaves like sqlite (${inside?.n} inside, ${after?.n} after rollback)`,
  );
  await db.exec("BEGIN");
  await db.run("INSERT INTO __audit_probe (x) VALUES (?)", [2]);
  await db.exec("COMMIT");
  const committed = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM __audit_probe");
  await db.exec("DELETE FROM __audit_probe");
  check(Number(committed?.n ?? 0) === 1, "COMMIT persists");
  const seq = await db
    .get<{ seq: number }>("SELECT seq FROM sqlite_sequence WHERE name = 'role_permissions'")
    .catch(() => undefined);
  note(`sqlite_sequence reachable (role_permissions: ${seq?.seq ?? "absent"})`);
}

async function backup(): Promise<void> {
  console.log(`\n== backup (${engine}) ==`);
  const dump: Record<string, Row[]> = {};
  for (const table of await tableNames()) {
    const rows = await db.all<Row>(`SELECT * FROM ${table}`);
    dump[table] = rows;
    if (rows.length > 0) console.log(`  dumped ${table}: ${rows.length} rows`);
  }
  const before = await fingerprint();
  const sequences = await db.all<Row>("SELECT name, seq FROM sqlite_sequence").catch(() => []);
  writeJson(DUMP_FILE, dump);
  writeJson(BEFORE_FILE, before);
  writeJson(SEQUENCE_FILE, sequences);
  console.log(
    `  sequences: ${sequences.map((s) => `${s.name}=${s.seq}`).join(", ") || "(none)"}`,
  );
  console.log(`  dump -> ${DUMP_FILE} (${fs.statSync(DUMP_FILE).size} bytes)`);
}

async function restore(): Promise<void> {
  console.log(`\n== restore (${engine}) ==`);
  if (!fs.existsSync(DUMP_FILE)) {
    fail(`no backup at ${DUMP_FILE} - run the backup phase first`);
    return;
  }
  const dump = JSON.parse(fs.readFileSync(DUMP_FILE, "utf8")) as Record<string, Row[]>;
  const sequences = JSON.parse(fs.readFileSync(SEQUENCE_FILE, "utf8")) as Row[];
  const { deletes, inserts } = await dependencyOrder();

  // Ordering already keeps children out of the way, but switching the checks
  // off for the swap (a no-op inside a transaction, so it happens first) makes
  // the restore independent of the server's pragma defaults.
  const fkBefore = await db
    .get<{ foreign_keys: number }>("PRAGMA foreign_keys")
    .catch(() => undefined);
  let fkDisabled = false;
  try {
    await db.exec("PRAGMA foreign_keys = OFF");
    fkDisabled = true;
  } catch {
    note("could not turn foreign keys off; relying on dependency order");
  }

  await db.exec("BEGIN");
  try {
    for (const table of deletes) {
      await db.run(`DELETE FROM ${table}`);
    }
    for (const table of inserts) {
      const rows = dump[table] ?? [];
      if (rows.length === 0) continue;
      const columns = Object.keys(rows[0]!).filter((c) => c.length > 0);
      const placeholders = `(${columns.map(() => "?").join(", ")})`;
      const CHUNK = 100; // 100 rows per statement keeps writes to ~a few hundred round trips
      for (let start = 0; start < rows.length; start += CHUNK) {
        const slice = rows.slice(start, start + CHUNK);
        const values: SqlValue[] = [];
        for (const row of slice) {
          for (const column of columns) {
            values.push(row[column] === undefined ? null : (row[column] as SqlValue));
          }
        }
        await db.run(
          `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${slice
            .map(() => placeholders)
            .join(", ")}`,
          values,
        );
      }
      console.log(`  restored ${table}: ${rows.length} rows`);
    }
    // AUTOINCREMENT counters must not keep counting past the backup.
    const current = await db.all<{ name: string; seq: number }>(
      "SELECT name, seq FROM sqlite_sequence",
    );
    const wanted = new Map(sequences.map((s) => [String(s.name), Number(s.seq ?? 0)]));
    for (const row of current) {
      const seq = wanted.get(row.name);
      if (seq === undefined) {
        // A table that was empty at backup time has no counter; SQLite creates
        // one as soon as the audit inserts into it, so it has to go again.
        await db.run("DELETE FROM sqlite_sequence WHERE name = ?", [row.name]);
        continue;
      }
      if (Number(row.seq) !== seq) {
        await db.run("UPDATE sqlite_sequence SET seq = ? WHERE name = ?", [seq, row.name]);
      }
      wanted.delete(row.name);
    }
    for (const [name, seq] of wanted) {
      await db.run("INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)", [name, seq]);
    }
    await db.exec("COMMIT");
    console.log("  committed");
  } catch (err) {
    await db.exec("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    if (fkDisabled && fkBefore) {
      await db.exec(`PRAGMA foreign_keys = ${Number(fkBefore.foreign_keys) ? "ON" : "OFF"}`).catch(
        () => undefined,
      );
    }
  }
}

async function verify(): Promise<void> {
  console.log(`\n== verify (${engine}) ==`);
  const before = JSON.parse(fs.readFileSync(BEFORE_FILE, "utf8")) as Record<
    string,
    { rows: number; checksum: string }
  >;
  const after = await fingerprint();
  writeJson(AFTER_FILE, after);
  const diffs = compareFingerprints(before, after);
  check(diffs.length === 0, "every table (and the id counters) matches the backup exactly");
  for (const diff of diffs) console.error(`       ${diff}`);
  const leftover = await db.all<{ n: number }>(
    "SELECT COUNT(*) AS n FROM sales_invoices WHERE notes LIKE ?",
    [`%${RUN_ID}%`],
  );
  check(Number(leftover[0]?.n ?? 0) === 0, "no audit invoices left in sales_invoices");
  const leftoverPurchases = await db.all<{ n: number }>(
    "SELECT COUNT(*) AS n FROM purchase_invoices WHERE notes LIKE ?",
    [`%${RUN_ID}%`],
  );
  check(Number(leftoverPurchases[0]?.n ?? 0) === 0, "no audit invoices left in purchase_invoices");
  const auditUser = await db.all<{ n: number }>(
    "SELECT COUNT(*) AS n FROM users WHERE username = ?",
    [AUDIT_USER],
  );
  check(Number(auditUser[0]?.n ?? 0) === 0, "the temporary audit user is gone");
}

/** Safety net: remove only what this audit created, without needing the dump. */
async function cleanup(): Promise<void> {
  console.log(`\n== cleanup (${engine}) ==`);
  const sales = await db.all<{ id: number }>(
    "SELECT id FROM sales_invoices WHERE notes LIKE ?",
    [`%${RUN_ID}%`],
  );
  const purchases = await db.all<{ id: number }>(
    "SELECT id FROM purchase_invoices WHERE notes LIKE ?",
    [`%${RUN_ID}%`],
  );
  console.log(`  audit sales: ${sales.length}, audit purchases: ${purchases.length}`);
  await db.transaction(async () => {
    for (const { id } of sales) {
      await deleteInvoice("sales", id);
    }
    for (const { id } of purchases) {
      await deleteInvoice("purchase", id);
    }
    await db.run("DELETE FROM users WHERE username = ?", [AUDIT_USER]);
  });
  const remaining = await db.get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM sales_invoices WHERE notes LIKE ?",
    [`%${RUN_ID}%`],
  );
  check(Number(remaining?.n ?? 0) === 0, "audit rows removed");
}

/** Undo one invoice end to end: lines, journal entry, stock, header. */
async function deleteInvoice(kind: "sales" | "purchase", id: number): Promise<void> {
  const table = kind === "sales" ? "sales_invoices" : "purchase_invoices";
  const itemTable = kind === "sales" ? "sales_invoice_items" : "purchase_invoice_items";
  const items = await db.all<{ batch_id: number | null; quantity: number }>(
    `SELECT batch_id, quantity FROM ${itemTable} WHERE invoice_id = ?`,
    [id],
  );
  const entry = await db.get<{ id: number }>(
    "SELECT id FROM journal_entries WHERE source_table = ? AND source_id = ?",
    [table, id],
  );
  if (entry) {
    await db.run("DELETE FROM journal_entry_lines WHERE journal_entry_id = ?", [entry.id]);
    await db.run("DELETE FROM journal_entries WHERE id = ?", [entry.id]);
  }
  for (const item of items) {
    if (item.batch_id == null) continue;
    const delta = kind === "sales" ? Number(item.quantity) : -Number(item.quantity);
    await db.run("UPDATE stock_batches SET quantity_in_stock = quantity_in_stock + ? WHERE id = ?", [
      delta,
      item.batch_id,
    ]);
  }
  await db.run("DELETE FROM stock_movements WHERE reference_table = ? AND reference_id = ?", [
    table,
    id,
  ]);
  await db.run(`DELETE FROM ${itemTable} WHERE invoice_id = ?`, [id]);
  await db.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

// --- HTTP suite --------------------------------------------------------
const AUDIT_USER = "__cloud_audit__";
const AUDIT_PASSWORD = "cloud-audit-2026";

interface ApiResult {
  status: number;
  body: any;
  text: string;
}
let token = "";

async function api(method: string, route: string, body?: unknown): Promise<ApiResult> {
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
}

async function apiOk(method: string, route: string, body?: unknown): Promise<any> {
  const result = await api(method, route, body);
  if (result.status >= 300) {
    fail(`${method} ${route} -> ${result.status} ${result.text.slice(0, 300)}`);
    return null;
  }
  return result.body;
}

const r2 = (value: number): number => Math.round(Number(value) * 100) / 100;

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Four mid-months (each in a different month) plus today. */
function customDates(): string[] {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date(`${today}T00:00:00Z`);
  const dates: string[] = [];
  for (let back = 4; back >= 1; back -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 15));
    dates.push(d.toISOString().slice(0, 10));
  }
  dates.push(today);
  return dates;
}

/** Aggregates recomputed straight from the ledger, bypassing the API. */
async function rawLedger(from: string, to: string): Promise<{
  debit: number;
  credit: number;
  revenue: number;
  expenses: number;
}> {
  const totals = await db.get<{ debit: number; credit: number }>(
    `SELECT COALESCE(SUM(jel.debit), 0) AS debit, COALESCE(SUM(jel.credit), 0) AS credit
     FROM journal_entry_lines jel
     JOIN journal_entries je ON je.id = jel.journal_entry_id
     WHERE je.is_posted = 1 AND je.entry_date >= ? AND je.entry_date <= ?`,
    [from, to],
  );
  const pl = await db.get<{ revenue: number; expenses: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN a.account_type = 'REVENUE' THEN jel.credit - jel.debit ELSE 0 END), 0) AS revenue,
       COALESCE(SUM(CASE WHEN a.account_type = 'EXPENSE' THEN jel.debit - jel.credit ELSE 0 END), 0) AS expenses
     FROM journal_entry_lines jel
     JOIN journal_entries je ON je.id = jel.journal_entry_id
     JOIN accounts a ON a.id = jel.account_id
     WHERE je.is_posted = 1 AND je.entry_date >= ? AND je.entry_date <= ?`,
    [from, to],
  );
  return {
    debit: r2(Number(totals?.debit ?? 0)),
    credit: r2(Number(totals?.credit ?? 0)),
    revenue: r2(Number(pl?.revenue ?? 0)),
    expenses: r2(Number(pl?.expenses ?? 0)),
  };
}

/** signed (debit-positive) movement per account code, straight from the ledger */
async function rawNetByAccount(from: string, to: string): Promise<Map<string, number>> {
  const rows = await db.all<{ code: string; net: number }>(
    `SELECT a.account_code AS code, COALESCE(SUM(jel.debit - jel.credit), 0) AS net
     FROM journal_entry_lines jel
     JOIN journal_entries je ON je.id = jel.journal_entry_id
     JOIN accounts a ON a.id = jel.account_id
     WHERE je.is_posted = 1 AND je.entry_date >= ? AND je.entry_date <= ?
     GROUP BY a.id, a.account_code`,
    [from, to],
  );
  return new Map(rows.map((row) => [String(row.code), r2(Number(row.net))]));
}

/** signed (debit-positive) movement per account code for specific entries */
async function rawNetByAccountForEntries(ids: number[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ids.length === 0) return map;
  const rows = await db.all<{ code: string; net: number }>(
    `SELECT a.account_code AS code, COALESCE(SUM(jel.debit - jel.credit), 0) AS net
     FROM journal_entry_lines jel
     JOIN accounts a ON a.id = jel.account_id
     WHERE jel.journal_entry_id IN (${ids.join(", ")})
     GROUP BY a.id, a.account_code`,
  );
  for (const row of rows) map.set(String(row.code), r2(Number(row.net)));
  return map;
}

/** The trial balance places balances in the account's normal column, so
 *  `debit - credit` is the signed, debit-positive figure the ledger produces. */
function netMovementMap(rows: any[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows ?? []) {
    map.set(
      String(row.accountCode),
      r2(Number(row.debit ?? 0) - Number(row.credit ?? 0)),
    );
  }
  return map;
}

function netClosingMap(rows: any[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows ?? []) {
    map.set(
      String(row.accountCode),
      r2(Number(row.closingDebit ?? 0) - Number(row.closingCredit ?? 0)),
    );
  }
  return map;
}

function subtractMaps(a: Map<string, number>, b: Map<string, number>): Map<string, number> {
  const result = new Map<string, number>();
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    result.set(key, r2((a.get(key) ?? 0) - (b.get(key) ?? 0)));
  }
  return result;
}

/** accounts whose values differ by more than a penny */
function diffMaps(a: Map<string, number>, b: Map<string, number>): string[] {
  const diffs: string[] = [];
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const left = a.get(key) ?? 0;
    const right = b.get(key) ?? 0;
    if (Math.abs(r2(left - right)) > 0.005) diffs.push(`${key}: ${left} vs ${right}`);
  }
  return diffs;
}

async function ensureAuditUser(): Promise<boolean> {
  const role = await db.get<{ id: number }>("SELECT id FROM roles WHERE name = 'Admin'");
  if (!role) {
    fail("no Admin role in the database, cannot create the temporary audit user");
    return false;
  }
  await db.run("DELETE FROM users WHERE username = ?", [AUDIT_USER]);
  const { salt, hash } = hashPassword(AUDIT_PASSWORD);
  await db.run(
    `INSERT INTO users (username, password_hash, password_salt, full_name, role_id, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [AUDIT_USER, hash, salt, "Cloud Audit (temporary)", role.id],
  );
  return true;
}

async function http(): Promise<void> {
  console.log(`\n== http suite (base ${base}, run ${RUN_ID}) ==`);
  const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(15_000) })
    .then((r) => r.json())
    .catch((err: unknown) => ({ status: `unreachable: ${String(err)}` }));
  check((health as { status?: string }).status === "ok", `API is up (${JSON.stringify(health)})`);
  if ((health as { status?: string }).status !== "ok") return;

  if (!(await ensureAuditUser())) return;
  const login = await api("POST", "/api/auth/login", {
    username: AUDIT_USER,
    password: AUDIT_PASSWORD,
  });
  check(
    login.status === 200 && Boolean(login.body?.token),
    login.status === 200
      ? "temporary audit user can log in"
      : `temporary audit user can log in (got ${login.status}: ${login.text.slice(0, 200)})`,
  );
  if (login.status !== 200) return;
  token = String(login.body.token);

  // --- pick masters ------------------------------------------------------
  const customer = await db.get<{ id: number; name: string }>(
    `SELECT id, name FROM parties
     WHERE party_type IN ('CUSTOMER','BOTH') AND is_active = 1 AND company_id = 1
     ORDER BY id LIMIT 1`,
  );
  const supplier = await db.get<{ id: number; name: string }>(
    `SELECT id, name FROM parties
     WHERE party_type IN ('SUPPLIER','BOTH') AND is_active = 1 AND company_id = 1
     ORDER BY id LIMIT 1`,
  );
  check(
    Boolean(customer && supplier),
    `masters available (customer ${customer?.id ?? "-"} "${customer?.name ?? "-"}", ` +
      `supplier ${supplier?.id ?? "-"} "${supplier?.name ?? "-"}")`,
  );
  if (!customer || !supplier) return;

  // The audit needs an item it can actually sell. A database that already
  // carries stock is used as is; a database with master data only (no stock
  // batches at all) gets a temporary item plus opening stock, which the
  // restore deletes again together with everything else.
  let item = await db.get<{ id: number; item_name: string; stock: number }>(
    `SELECT i.id, i.item_name, SUM(sb.quantity_in_stock) AS stock
     FROM items i
     JOIN stock_batches sb ON sb.item_id = i.id AND sb.is_active = 1
     WHERE i.is_active = 1 AND i.company_id = 1 AND sb.quantity_in_stock > 2
       AND (COALESCE(sb.raw_unit_cost, 0) + COALESCE(sb.packing_unit_cost, 0) > 0
            OR sb.purchase_price > 0 OR i.purchase_price > 0)
     GROUP BY i.id, i.item_name
     ORDER BY stock DESC
     LIMIT 1`,
  );
  if (item) {
    note(`stocked item already present: ${item.id} "${item.item_name}" (stock ${item.stock})`);
  } else {
    const createdItem = await apiOk("POST", "/api/items", {
      itemName: `${RUN_ID} audit item`,
      // The hosted data has items numbered ITEM-00001..ITEM-01752 while its
      // numbering_sequences still says next_number = 1, so the auto-generated
      // code collides. An explicit code keeps the audit moving.
      itemCode: `${RUN_ID}-AUDIT-ITEM`,
      unit: "UNIT",
      itemType: "FINISHED_GOOD",
      purchasePrice: 10,
      sellingPrice: 100,
      minimumStock: 0,
      maximumStock: 0,
      notes: `${RUN_ID} temporary item for the hosted audit`,
    });
    const itemId = Number(createdItem?.id ?? 0);
    if (!createdItem || !Number.isFinite(itemId) || itemId <= 0) {
      fail(`the database has no sellable item and one could not be created (${JSON.stringify(createdItem)?.slice(0, 200)})`);
      return;
    }
    const opening = await apiOk("POST", `/api/items/${itemId}/opening-stock`, {
      quantity: 100,
      unitCost: 10,
      batchNumber: `${RUN_ID}-OPENING`,
    });
    if (!opening) {
      fail("opening stock could not be created");
      return;
    }
    const row = await db.get<{ stock: number }>(
      "SELECT COALESCE(SUM(quantity_in_stock), 0) AS stock FROM stock_batches WHERE item_id = ? AND is_active = 1",
      [itemId],
    );
    item = {
      id: itemId,
      item_name: String((createdItem as { item_name?: string }).item_name ?? itemId),
      stock: Number(row?.stock ?? 0),
    };
    note(`created audit item ${itemId} ("${item.item_name}") with ${item.stock} units of opening stock`);
  }
  check(item.stock > 2, `the audit item has stock to sell (${item.stock} units)`);

  const stockBefore = Number(item.stock);
  const dates = customDates();
  const startRow = await db.get<{ first: string | null }>(
    "SELECT MIN(entry_date) AS first FROM journal_entries WHERE is_posted = 1",
  );
  const firstDate = dates[0]!;
  const earliest = startRow?.first ? String(startRow.first) : firstDate;
  const ledgerStart = earliest < firstDate ? earliest : firstDate;
  console.log(`  custom dates: ${dates.join(", ")}`);
  console.log(
    `  plan per date: cash sale 1 @ 100, credit sale 1 @ 60, credit purchase 2 @ 10 (item ${item.id})`,
  );

  // --- baseline ----------------------------------------------------------
  const dashBefore = await apiOk("GET", "/api/dashboard");
  const tbBefore = await apiOk("GET", "/api/reports/trial-balance");
  check(Boolean(dashBefore && tbBefore), "baseline dashboard and trial balance load");
  if (!dashBefore || !tbBefore) return;
  note(
    `baseline: TB debit ${tbBefore.totalDebit}, cash ${dashBefore.balances.cash}, ` +
      `receivable ${dashBefore.receivablesPayables.receivable}, payable ${dashBefore.receivablesPayables.payable}`,
  );
  // Everything posted from here on is the audit's own work; the trial-balance
  // delta at the end is compared against exactly these entries.
  const watermark = Number(
    (await db.get<{ m: number }>("SELECT COALESCE(MAX(id), 0) AS m FROM journal_entries"))?.m ?? 0,
  );
  note(`journal-entry watermark before the audit: ${watermark}`);

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const ledgerTotals = await db.get<{ debit: number; credit: number }>(
    "SELECT COALESCE(SUM(debit), 0) AS debit, COALESCE(SUM(credit), 0) AS credit FROM journal_entry_lines",
  );
  check(
    r2(Number(ledgerTotals?.debit ?? 0)) === r2(Number(ledgerTotals?.credit ?? 0)),
    `the whole ledger is balanced (Dr ${ledgerTotals?.debit} = Cr ${ledgerTotals?.credit})`,
  );
  const created: Array<{
    date: string;
    cashSale: number;
    cashSaleNumber: string;
    creditSale: number;
    purchase: number;
    journalDebit: number;
    journalCredit: number;
  }> = [];

  for (const date of dates) {
    console.log(`\n  --- ${date} ---`);
    const cashBookBefore = await apiOk("GET", `/api/reports/cash-book?from=${date}&to=${date}`);

    const cashSale = await apiOk("POST", "/api/sales-invoices", {
      customerId: customer.id,
      invoiceDate: date,
      paymentType: "CASH",
      notes: `${RUN_ID} cash sale ${date}`,
      items: [{ itemId: item.id, quantity: 1, unitPrice: 100 }],
    });
    const creditSale = await apiOk("POST", "/api/sales-invoices", {
      customerId: customer.id,
      invoiceDate: date,
      paymentType: "CREDIT",
      notes: `${RUN_ID} credit sale ${date}`,
      items: [{ itemId: item.id, quantity: 1, unitPrice: 60 }],
    });
    const purchase = await apiOk("POST", "/api/purchase-invoices", {
      supplierId: supplier.id,
      invoiceDate: date,
      paymentType: "CREDIT",
      notes: `${RUN_ID} purchase ${date}`,
      items: [{ itemId: item.id, quantity: 2, unitCost: 10 }],
    });
    if (!cashSale || !creditSale || !purchase) {
      fail(`[${date}] documents could not be created`);
      continue;
    }
    check(
      r2(cashSale.totalAmount) === 100 && r2(creditSale.totalAmount) === 60 && r2(purchase.totalAmount) === 20,
      `[${date}] documents saved with the right totals (${cashSale.totalAmount}/${creditSale.totalAmount}/${purchase.totalAmount})`,
    );

    // --- the documents are readable back through the API ----------------
    const reopened = await apiOk("GET", `/api/sales-invoices/${cashSale.id}`);
    check(
      Boolean(reopened) &&
        String(reopened.invoice?.invoice_number) === String(cashSale.invoiceNumber) &&
        r2(Number(reopened.items?.[0]?.quantity)) === 1 &&
        r2(Number(reopened.items?.[0]?.unit_price)) === 100,
      `[${date}] cash sale reads back with its line (${cashSale.invoiceNumber})`,
    );
    const listed = await apiOk(
      "GET",
      `/api/sales-invoices?search=${encodeURIComponent(String(cashSale.invoiceNumber))}`,
    );
    check(
      Array.isArray(listed) && listed.some((row: any) => Number(row.id) === cashSale.id),
      `[${date}] the invoice appears in the sales list`,
    );
    const ledger = await apiOk(
      "GET",
      `/api/journal-entries/sales_invoices/${cashSale.id}`,
    );
    const lines: any[] = Array.isArray(ledger?.lines) ? ledger.lines : [];
    const debit = r2(lines.reduce((acc, l) => acc + Number(l.debit ?? 0), 0));
    const credit = r2(lines.reduce((acc, l) => acc + Number(l.credit ?? 0), 0));
    check(
      lines.length >= 4 &&
        debit === credit &&
        debit >= 100 &&
        lines.some((l) => r2(Number(l.debit)) === 100),
      `[${date}] the sale's journal entry is posted and balanced (Dr ${debit} = Cr ${credit}, ${lines.length} lines)`,
    );

    // --- report filters -------------------------------------------------
    const plDay = await apiOk("GET", `/api/reports/profit-and-loss?from=${date}&to=${date}`);
    const plUpToBefore = await apiOk(
      "GET",
      `/api/reports/profit-and-loss?from=${ledgerStart}&to=${addDays(date, -1)}`,
    );
    const plUpTo = await apiOk(
      "GET",
      `/api/reports/profit-and-loss?from=${ledgerStart}&to=${date}`,
    );
    const raw = await rawLedger(date, date);
    check(
      r2(plDay.revenue) === 160,
      `[${date}] P&L for the day shows the 160.00 of revenue (got ${plDay.revenue})`,
    );
    check(
      r2(plDay.revenue) === raw.revenue && r2(plDay.expenses) === raw.expenses,
      `[${date}] P&L matches the raw ledger (revenue ${raw.revenue}, expenses ${raw.expenses})`,
    );
    check(
      r2(plUpTo.revenue) === r2(plUpToBefore.revenue + plDay.revenue) &&
        r2(plUpTo.expenses) === r2(plUpToBefore.expenses + plDay.expenses),
      `[${date}] the filter composes: P&L(${ledgerStart}..${addDays(date, -1)}) + P&L(${date}) = P&L(${ledgerStart}..${date})`,
    );
    check(
      r2(plUpTo.netProfit) === r2(plUpTo.revenue - plUpTo.expenses),
      `[${date}] net profit is revenue - expenses (${plUpTo.netProfit})`,
    );

    const tbDay = await apiOk("GET", `/api/reports/trial-balance?from=${date}&to=${date}`);
    const tbUpTo = await apiOk("GET", `/api/reports/trial-balance?to=${date}`);
    const tbUpToBefore = await apiOk("GET", `/api/reports/trial-balance?to=${addDays(date, -1)}`);
    const rawByAccount = await rawNetByAccount(date, date);
    const movementDiff = diffMaps(netMovementMap(tbDay.rows), rawByAccount);
    check(
      movementDiff.length === 0,
      `[${date}] scoped trial balance matches the raw ledger account by account (${
        movementDiff.join("; ") || `${rawByAccount.size} accounts agree`
      })`,
    );
    const closingDelta = subtractMaps(netClosingMap(tbUpTo.rows), netClosingMap(tbUpToBefore.rows));
    const openingDiff = diffMaps(closingDelta, rawByAccount);
    check(
      openingDiff.length === 0,
      `[${date}] openings carry correctly: closing(<=${date}) - closing(<=${addDays(date, -1)}) equals the day's movement (${
        openingDiff.join("; ") || "all accounts agree"
      })`,
    );
    check(
      r2(tbUpTo.totalDebit) === r2(tbDay.totalDebit) &&
        r2(tbUpTo.totalCredit) === r2(tbDay.totalCredit),
      `[${date}] closing figures agree between the day-scoped and cumulative trial balance`,
    );
    check(
      tbDay.balanced && tbUpTo.balanced &&
        r2(tbUpTo.totalDebit) === r2(tbUpTo.totalCredit),
      `[${date}] trial balance stays balanced (Dr ${tbUpTo.totalDebit} = Cr ${tbUpTo.totalCredit})`,
    );

    const sheetDay = await apiOk("GET", `/api/reports/balance-sheet?asAt=${date}`);
    const sheetBefore = await apiOk(
      "GET",
      `/api/reports/balance-sheet?asAt=${addDays(date, -1)}`,
    );
    check(
      sheetDay.balanced,
      `[${date}] balance sheet balances (assets ${sheetDay.assets} = liabilities ${sheetDay.liabilities} + equity ${sheetDay.equity})`,
    );
    check(
      sheetBefore.balanced && sheetDay.assets !== sheetBefore.assets,
      `[${date}] the as-at filter moves the position (${sheetBefore.assets} -> ${sheetDay.assets})`,
    );

    const cashBookAfter = await apiOk("GET", `/api/reports/cash-book?from=${date}&to=${date}`);
    const cashRows = Array.isArray(cashBookAfter) ? cashBookAfter : [];
    const cashBeforeRows = Array.isArray(cashBookBefore) ? cashBookBefore : [];
    check(
      cashRows.length === cashBeforeRows.length + 1 &&
        cashRows.some((row: any) => r2(Number(row.debit)) === 100),
      `[${date}] cash book picks up the cash sale (${cashBeforeRows.length} -> ${cashRows.length} rows)`,
    );

    const partyLedger = await apiOk(
      "GET",
      `/api/reports/party-ledger?partyId=${customer.id}&from=${date}&to=${date}`,
    );
    check(
      Array.isArray(partyLedger) &&
        partyLedger.some((row: any) => r2(Number(row.debit)) === 60) &&
        r2(partyLedger[partyLedger.length - 1]?.balance ?? 0) >= 60,
      `[${date}] customer ledger shows the credit sale (Dr 60.00)`,
    );

    // --- generated report files ----------------------------------------
    const exportAll = await api("GET", `/api/reports/export-all.csv?from=${date}&to=${date}`);
    fs.writeFileSync(path.join(REPORT_DIR, `export-all-${date}.csv`), exportAll.text);
    check(
      exportAll.status === 200 &&
        ["Trial Balance", "Profit & Loss", "Balance Sheet", "Cash Book"].every((section) =>
          exportAll.text.includes(section),
        ) &&
        exportAll.text.includes(",YES"),
      `[${date}] export-all CSV has all four sections and a balanced sheet`,
    );
    check(
      exportAll.text.includes("160.00"),
      `[${date}] export-all CSV contains the day's revenue`,
    );
    const tbCsv = await api("GET", `/api/reports/trial-balance.csv?from=${date}&to=${date}`);
    fs.writeFileSync(path.join(REPORT_DIR, `trial-balance-${date}.csv`), tbCsv.text);
    check(
      tbCsv.status === 200 &&
        tbCsv.text.includes(`${tbDay.totalDebit.toFixed(2)},${tbDay.totalCredit.toFixed(2)}`),
      `[${date}] trial-balance CSV totals match the API figures`,
    );

    const entry = await db.get<{ debit: number; credit: number }>(
      `SELECT SUM(debit) AS debit, SUM(credit) AS credit FROM journal_entry_lines
       WHERE journal_entry_id IN (
         SELECT id FROM journal_entries
         WHERE (source_table = 'sales_invoices' AND source_id IN (?, ?))
            OR (source_table = 'purchase_invoices' AND source_id = ?))`,
      [cashSale.id, creditSale.id, purchase.id],
    );
    created.push({
      date,
      cashSale: Number(cashSale.id),
      cashSaleNumber: String(cashSale.invoiceNumber),
      creditSale: Number(creditSale.id),
      purchase: Number(purchase.id),
      journalDebit: r2(Number(entry?.debit ?? 0)),
      journalCredit: r2(Number(entry?.credit ?? 0)),
    });
  }

  // --- after all dates --------------------------------------------------
  console.log("\n  --- totals after all dates ---");
  const dashAfter = await apiOk("GET", "/api/dashboard");
  const tbAfter = await apiOk("GET", "/api/reports/trial-balance");
  const today = dates[dates.length - 1]!;
  const todaySale = created.find((c) => c.date === today);
  check(
    r2(dashAfter.balances.cash) === r2(dashBefore.balances.cash + 100 * dates.length),
    `dashboard cash grew by the ${dates.length} cash sales (${dashBefore.balances.cash} -> ${dashAfter.balances.cash})`,
  );
  check(
    r2(dashAfter.receivablesPayables.receivable) ===
      r2(dashBefore.receivablesPayables.receivable + 60 * dates.length),
    `receivables grew by the credit sales (${dashBefore.receivablesPayables.receivable} -> ${dashAfter.receivablesPayables.receivable})`,
  );
  check(
    r2(dashAfter.receivablesPayables.payable) ===
      r2(dashBefore.receivablesPayables.payable + 20 * dates.length),
    `payables grew by the credit purchases (${dashBefore.receivablesPayables.payable} -> ${dashAfter.receivablesPayables.payable})`,
  );
  check(
    r2(dashAfter.today.salesTotal) === r2(dashBefore.today.salesTotal + 160) &&
      Number(dashAfter.today.salesCount) === Number(dashBefore.today.salesCount) + 2,
    `today's tile picked up both sales (${dashBefore.today.salesTotal} -> ${dashAfter.today.salesTotal}, ${dashBefore.today.salesCount} -> ${dashAfter.today.salesCount} invoices)`,
  );
  check(
    dashAfter.recentTransactions.some(
      (row: any) => row.type === "Sales" && row.reference === todaySale?.cashSaleNumber,
    ),
    `recent transactions list today's sale (${todaySale?.cashSaleNumber ?? "-"})`,
  );
  const month = today.slice(0, 7);
  const trendBefore = dashBefore.monthlyTrend.find((point: any) => String(point.month).startsWith(month));
  const trendAfter = dashAfter.monthlyTrend.find((point: any) => String(point.month).startsWith(month));
  check(
    Boolean(trendBefore && trendAfter) &&
      r2(Number(trendAfter.revenue) - Number(trendBefore.revenue)) === 160,
    `the ${month} trend point gained both sales (${trendBefore?.revenue} -> ${trendAfter?.revenue})`,
  );
  const auditEntryIds = await db.all<{ id: number }>(
    `SELECT id FROM journal_entries WHERE id > ${watermark} ORDER BY id`,
  );
  const rawCreated = await rawNetByAccountForEntries(auditEntryIds.map((row) => Number(row.id)));
  const overallDelta = subtractMaps(netClosingMap(tbAfter.rows), netClosingMap(tbBefore.rows));
  const overallDiff = diffMaps(overallDelta, rawCreated);
  check(
    overallDiff.length === 0 && auditEntryIds.length >= created.length * 3,
    `the trial balance grew by exactly the ${auditEntryIds.length} journal entries the audit posted, account by account (${
      overallDiff.join("; ") || "all accounts agree"
    })`,
  );
  check(
    tbAfter.balanced && r2(tbAfter.totalDebit) === r2(tbAfter.totalCredit),
    `trial balance still balanced overall (${tbAfter.totalDebit} = ${tbAfter.totalCredit})`,
  );

  const stockAfter = await db.get<{ stock: number }>(
    "SELECT COALESCE(SUM(quantity_in_stock), 0) AS stock FROM stock_batches WHERE item_id = ? AND is_active = 1",
    [item.id],
  );
  check(
    r2(Number(stockAfter?.stock ?? 0)) === r2(stockBefore),
    `stock is back where it started after selling ${dates.length} and buying ${dates.length * 2} (${stockBefore} -> ${stockAfter?.stock})`,
  );

  // --- filters over periods with nothing in them --------------------------
  const lastEntry = await db.get<{ last: string }>(
    "SELECT MAX(entry_date) AS last FROM journal_entries WHERE is_posted = 1",
  );
  const firstEntry = await db.get<{ first: string }>(
    "SELECT MIN(entry_date) AS first FROM journal_entries WHERE is_posted = 1",
  );
  const future = addDays(String(lastEntry?.last ?? today), 1);
  const plFuture = await apiOk(
    "GET",
    `/api/reports/profit-and-loss?from=${future}&to=${addDays(future, 1)}`,
  );
  check(
    r2(plFuture.revenue) === 0 && r2(plFuture.expenses) === 0,
    `a period after all data is empty (${future}: revenue ${plFuture.revenue})`,
  );
  const tbFuture = await apiOk(
    "GET",
    `/api/reports/trial-balance?from=${future}&to=${addDays(future, 1)}`,
  );
  const futureMovement = r2(
    tbFuture.rows.reduce(
      (acc: number, row: any) => acc + Number(row.debit ?? 0) + Number(row.credit ?? 0),
      0,
    ),
  );
  check(futureMovement === 0, `trial balance movement in that period is zero (${futureMovement})`);
  const ancient = addDays(String(firstEntry?.first ?? today), -1);
  const sheetAncient = await apiOk("GET", `/api/reports/balance-sheet?asAt=${ancient}`);
  check(
    r2(sheetAncient.assets) === 0 && r2(sheetAncient.liabilities) === 0,
    `the balance sheet before the first entry is empty (as at ${ancient})`,
  );

  // --- what the audit created --------------------------------------------
  const storedSales = await db.all<{ id: number }>(
    "SELECT id FROM sales_invoices WHERE notes LIKE ?",
    [`%${RUN_ID}%`],
  );
  const storedPurchases = await db.all<{ id: number }>(
    "SELECT id FROM purchase_invoices WHERE notes LIKE ?",
    [`%${RUN_ID}%`],
  );
  check(
    storedSales.length === dates.length * 2 && storedPurchases.length === dates.length,
    `all ${dates.length * 3} documents are in the database (${storedSales.length} sales, ${storedPurchases.length} purchases)`,
  );
  writeJson(path.join(OUT_DIR, "created.json"), { runId: RUN_ID, dates, created });
  fs.writeFileSync(path.join(OUT_DIR, "http-run.log"), JSON.stringify({ problems }, null, 2));
}

// --- main --------------------------------------------------------------
async function main(): Promise<void> {
  console.log(`cloud audit: command=${command} engine=${engine} run=${RUN_ID}`);
  if (engine === "cloud") {
    console.log(`target: ${env.sqliteCloudUrl.replace(/api(t)?key=[^&]+/i, "apikey=***")}`);
  } else {
    console.log(`target: local ${dbFile}`);
  }

  switch (command) {
    case "inspect":
      await inspect();
      break;
    case "probe":
      await probe();
      break;
    case "backup":
      await backup();
      break;
    case "restore":
      await restore();
      break;
    case "verify":
      await verify();
      break;
    case "cleanup":
      await cleanup();
      break;
    case "http":
      await http();
      break;
    case "all":
      await probe();
      await backup();
      await http();
      await restore();
      await verify();
      break;
    default:
      console.log(
        "commands: inspect | probe | backup | http | restore | verify | cleanup | all\n" +
          "flags:    --engine local|cloud --db <file> --base <url> --run <marker>",
      );
  }

  await db.close();
  console.log("");
  if (problems.length > 0) {
    console.error(`AUDIT FAILED: ${problems.length} of ${checkCount} checks failed`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log(`AUDIT OK: ${checkCount} checks passed.`);
}

main().catch(async (err) => {
  console.error("audit crashed:", err);
  await db.close().catch(() => undefined);
  process.exit(1);
});
