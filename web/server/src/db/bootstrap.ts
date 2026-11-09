/**
 * Schema creation + minimum seed data, ported from
 * database/migrations/migrator.py. Idempotent: safe to run on every launch
 * of the local database. The hosted SQLite Cloud database is NOT bootstrapped
 * (it already has this data) -- see src/index.ts.
 */
import { hashPassword } from "../services/authService.js";
import { SCHEMA_SQL } from "./schema.js";
import type { SqlDatabase } from "./types.js";

const DEFAULT_ROLES: ReadonlyArray<readonly [string, string]> = [
  ["Admin", "Full system access"],
  ["Accountant", "Accounting, sales, purchases and reporting"],
  ["Manager", "Management oversight and reporting"],
  ["Storekeeper", "Inventory and warehouse operations"],
  ["Production Manager", "Manufacturing and production operations"],
];

/** code, name, type, subtype */
const SYSTEM_ACCOUNTS: ReadonlyArray<readonly [string, string, string, string | null]> = [
  ["1000", "Cash in Hand", "ASSET", "CURRENT_ASSET"],
  ["1010", "Bank Accounts", "ASSET", "CURRENT_ASSET"],
  ["1100", "Accounts Receivable", "ASSET", "CURRENT_ASSET"],
  ["1200", "Inventory - Raw Materials", "ASSET", "CURRENT_ASSET"],
  ["1210", "Inventory - Packing Materials", "ASSET", "CURRENT_ASSET"],
  ["1220", "Inventory - Finished Goods", "ASSET", "CURRENT_ASSET"],
  ["1300", "Withholding Tax Receivable", "ASSET", "CURRENT_ASSET"],
  ["1500", "Fixed Assets", "ASSET", "NON_CURRENT_ASSET"],
  ["1501", "Furniture & Fixture", "ASSET", "NON_CURRENT_ASSET"],
  ["1502", "Office Equipment", "ASSET", "NON_CURRENT_ASSET"],
  ["1503", "Plant & Machinery", "ASSET", "NON_CURRENT_ASSET"],
  ["1504", "Vehicles", "ASSET", "NON_CURRENT_ASSET"],
  ["1505", "Building", "ASSET", "NON_CURRENT_ASSET"],
  ["2000", "Accounts Payable", "LIABILITY", "CURRENT_LIABILITY"],
  ["2100", "Sales Tax Payable", "LIABILITY", "CURRENT_LIABILITY"],
  ["2200", "Withholding Tax Payable", "LIABILITY", "CURRENT_LIABILITY"],
  ["3000", "Owner's Equity", "EQUITY", null],
  ["3100", "Retained Earnings", "EQUITY", null],
  ["4000", "Sales Revenue", "REVENUE", null],
  ["4100", "Sales Returns & Allowances", "REVENUE", null],
  ["5000", "Cost of Goods Sold", "EXPENSE", null],
  ["5001", "Packing Material", "EXPENSE", null],
  ["5002", "Raw Material Consumed", "EXPENSE", null],
  ["5100", "Purchase Returns & Allowances", "EXPENSE", null],
  ["5200", "Manufacturing Wastage Expense", "EXPENSE", null],
  ["5300", "Inventory Loss / Expiry Expense", "EXPENSE", null],
  ["6000", "General & Administrative Expenses", "EXPENSE", null],
  ["6900", "Gain / Loss on Asset Disposal", "EXPENSE", null],
  ["6100", "Selling Expenses", "EXPENSE", null],
];

const DEFAULT_NUMBERING: ReadonlyArray<readonly [string, string]> = [
  ["SALES_INVOICE", "SI-"],
  ["SALES_RETURN", "SR-"],
  ["PURCHASE_INVOICE", "PI-"],
  ["PURCHASE_RETURN", "PR-"],
  ["PAYMENT", "PV-"],
  ["RECEIPT", "RV-"],
  ["JOURNAL_VOUCHER", "JV-"],
  ["OPENING", "OB-"],
  ["PRODUCTION_ORDER", "PO-"],
  ["PACKING_ORDER", "PCO-"],
  ["EXPENSE_VOUCHER", "EV-"],
  ["CUSTOMER", "CUST-"],
  ["SUPPLIER", "SUPP-"],
  ["ITEM", "ITEM-"],
  ["BOM", "BOM-"],
  ["ACCOUNT", "AC-"],
];

/**
 * Tables whose auto-generated codes are backed by a numbering sequence. A
 * migrated database can have the codes present while its sequences were reset
 * (or never advanced) — e.g. items already contain ITEM-00002..ITEM-01752 but
 * the ITEM sequence still points at 1, so the next generated code collides.
 */
const RECONCILE: ReadonlyArray<{
  docType: string;
  prefix: string;
  table: string;
  column: string;
}> = [
  { docType: "ITEM", prefix: "ITEM-", table: "items", column: "item_code" },
  { docType: "ACCOUNT", prefix: "AC-", table: "accounts", column: "account_code" },
  { docType: "CUSTOMER", prefix: "CUST-", table: "parties", column: "code" },
  { docType: "SUPPLIER", prefix: "SUPP-", table: "parties", column: "code" },
  { docType: "SALES_INVOICE", prefix: "SI-", table: "sales_invoices", column: "invoice_number" },
  { docType: "PURCHASE_INVOICE", prefix: "PI-", table: "purchase_invoices", column: "invoice_number" },
  { docType: "SALES_RETURN", prefix: "SR-", table: "sales_returns", column: "return_number" },
  { docType: "PURCHASE_RETURN", prefix: "PR-", table: "purchase_returns", column: "return_number" },
  { docType: "PAYMENT", prefix: "PV-", table: "payments", column: "voucher_number" },
  { docType: "RECEIPT", prefix: "RV-", table: "receipts", column: "voucher_number" },
  { docType: "EXPENSE_VOUCHER", prefix: "EV-", table: "expenses", column: "voucher_number" },
  { docType: "PRODUCTION_ORDER", prefix: "PO-", table: "production_orders", column: "order_number" },
  { docType: "PACKING_ORDER", prefix: "PCO-", table: "packing_orders", column: "order_number" },
];

/**
 * Advance every numbering sequence to at least max(existing code)+1 so the next
 * generated code can never collide with an already-present record. Only ever
 * moves a sequence forward (never rewinds an in-flight one). Idempotent.
 */
export async function reconcileNumberingSequences(
  db: SqlDatabase,
  companyId = 1,
): Promise<void> {
  for (const entry of RECONCILE) {
    const seq = await db.get<{ next_number: number }>(
      "SELECT next_number FROM numbering_sequences WHERE company_id = ? AND document_type = ?",
      [companyId, entry.docType],
    );
    if (!seq) continue;
    const suffixStart = entry.prefix.length + 1;
    const row = await db.get<{ max_suffix: number | null }>(
      `SELECT MAX(CAST(substr(${entry.column}, ?) AS INTEGER)) AS max_suffix
         FROM ${entry.table}
        WHERE ${entry.column} LIKE ? AND substr(${entry.column}, ?, 1) GLOB '[0-9]'`,
      [suffixStart, `${entry.prefix}%`, suffixStart],
    );
    // The document and its journal entry now share one number, but historic
    // data may have left a *journal* voucher number ahead of every document
    // (the old double-allocation bug), so the journal has to be considered too.
    const journalRow = await db.get<{ max_suffix: number | null }>(
      `SELECT MAX(CAST(substr(voucher_number, ?) AS INTEGER)) AS max_suffix
         FROM journal_entries
        WHERE voucher_number LIKE ? AND substr(voucher_number, ?, 1) GLOB '[0-9]'`,
      [suffixStart, `${entry.prefix}%`, suffixStart],
    );
    const maxSuffix = Math.max(
      Number(row?.max_suffix ?? 0),
      Number(journalRow?.max_suffix ?? 0),
    );
    const required = Number.isFinite(maxSuffix) && maxSuffix > 0 ? maxSuffix + 1 : 1;
    if (required > Number(seq.next_number)) {
      await db.run(
        "UPDATE numbering_sequences SET next_number = ? WHERE company_id = ? AND document_type = ?",
        [required, companyId, entry.docType],
      );
    }
  }
}

/** Create all tables (idempotent) and seed defaults. */
export async function bootstrapDatabase(db: SqlDatabase): Promise<void> {
  await db.exec(SCHEMA_SQL);
  await ensureColumns(db);
  await ensureExpenseAccountSchema(db);
  await ensureStandaloneReturnsSchema(db);
  await seedDefaults(db);
  await reconcileNumberingSequences(db);
}

/**
 * Columns added after the first release. SCHEMA_SQL only creates missing
 * tables, so an existing local database needs the ALTERs below. The hosted
 * SQLite Cloud database is migrated by hand with the matching SQL in
 * server/migrations/ (the app never runs DDL against it).
 */
const ADDED_COLUMNS: ReadonlyArray<readonly [table: string, column: string, definition: string]> = [
  ["expenses", "status", "TEXT NOT NULL DEFAULT 'PAID'"],
  ["expenses", "due_date", "TEXT"],
  ["expenses", "settlement_journal_entry_id", "INTEGER"],
  ["expenses", "account_id", "INTEGER REFERENCES accounts(id)"],
  ["expense_items", "frequency", "TEXT"],
  ["expense_items", "next_run_date", "TEXT"],
  // BOM stage: 'FORMULATION' (raw materials) or 'PACKING' (packaging + finished good).
  ["bill_of_materials", "phase", "TEXT"],
  // Date-wise party opening: invoices before it do not move the party balance.
  ["parties", "opening_balance_date", "TEXT"],
];

async function ensureColumns(db: SqlDatabase): Promise<void> {
  for (const [table, column, definition] of ADDED_COLUMNS) {
    const columns = await db.all<{ name: string }>(`PRAGMA table_info(${table})`);
    if (columns.some((existing) => existing.name === column)) continue;
    await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * Older `expenses` tables declare `category_id NOT NULL` from the removed
 * category system. SQLite cannot drop a NOT NULL in place, so such databases
 * are rebuilt once (copy all rows into a new nullable table, then swap).
 */
async function ensureExpenseAccountSchema(db: SqlDatabase): Promise<void> {
  const columns = await db.all<{ name: string; notnull: number }>("PRAGMA table_info(expenses)");
  if (!columns.length) return; // fresh database: SCHEMA_SQL already made the new shape
  const categoryId = columns.find((column) => column.name === "category_id");
  if (!categoryId || !categoryId.notnull) return;

  await db.exec("PRAGMA foreign_keys = OFF");
  try {
    await db.exec(`
      CREATE TABLE expenses_rebuild (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        voucher_number      TEXT NOT NULL,
        -- New expenses post straight to a COA account (level-4 leaf, or a
        -- level-3 header with no children). Legacy rows keep their category_id.
        category_id         INTEGER REFERENCES expense_categories(id),
        account_id          INTEGER REFERENCES accounts(id),
        expense_date        TEXT NOT NULL,
        amount              REAL NOT NULL,
        payment_method      TEXT NOT NULL CHECK (payment_method IN ('CASH','BANK','CHEQUE')),
        status              TEXT NOT NULL DEFAULT 'PAID' CHECK (status IN ('PAID','UNPAID')),
        due_date            TEXT,
        settlement_journal_entry_id INTEGER REFERENCES journal_entries(id),
        bank_account_id     INTEGER REFERENCES bank_accounts(id),
        cheque_id           INTEGER REFERENCES cheques(id),
        description         TEXT,
        created_by          INTEGER REFERENCES users(id),
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at          TEXT,
        UNIQUE (company_id, voucher_number)
      );
      -- Explicit column list: on older databases ensureColumns appends
      -- account_id at the end of expenses, so SELECT * would misalign.
      INSERT INTO expenses_rebuild
        (id, company_id, voucher_number, category_id, account_id, expense_date,
         amount, payment_method, status, due_date, settlement_journal_entry_id,
         bank_account_id, cheque_id, description, created_by, created_at, updated_at)
      SELECT
        id, company_id, voucher_number, category_id, account_id, expense_date,
        amount, payment_method, status, due_date, settlement_journal_entry_id,
        bank_account_id, cheque_id, description, created_by, created_at, updated_at
      FROM expenses;
      DROP TABLE expenses;
      ALTER TABLE expenses_rebuild RENAME TO expenses;
    `);
  } finally {
    await db.exec("PRAGMA foreign_keys = ON");
  }
}

/**
 * Returns used to be tied to an invoice (invoice_id / invoice_item_id). They
 * are now standalone party + item documents. Rebuild the four tables once,
 * backfilling the party and item from the old invoice links so history keeps
 * its meaning. Mirrors server/migrations/2026-11-08-standalone-returns.sql.
 */
async function ensureStandaloneReturnsSchema(db: SqlDatabase): Promise<void> {
  const columns = await db.all<{ name: string }>("PRAGMA table_info(sales_returns)");
  if (!columns.some((column) => column.name === "invoice_id")) return;

  await db.exec("PRAGMA foreign_keys = OFF");
  try {
    await db.exec(`
      CREATE TABLE sales_returns_new (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        return_number       TEXT NOT NULL,
        party_id            INTEGER NOT NULL REFERENCES parties(id),
        return_date         TEXT NOT NULL,
        total_amount        REAL NOT NULL DEFAULT 0,
        notes               TEXT,
        created_by          INTEGER REFERENCES users(id),
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (company_id, return_number)
      );
      INSERT INTO sales_returns_new
        (id, company_id, return_number, party_id, return_date, total_amount,
         notes, created_by, created_at)
      SELECT r.id, r.company_id, r.return_number, si.customer_id, r.return_date,
             r.total_amount, r.notes, r.created_by, r.created_at
        FROM sales_returns r
        JOIN sales_invoices si ON si.id = r.invoice_id;

      CREATE TABLE sales_return_items_new (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id           INTEGER NOT NULL REFERENCES sales_returns_new(id) ON DELETE CASCADE,
        item_id             INTEGER NOT NULL REFERENCES items(id),
        batch_id            INTEGER REFERENCES stock_batches(id),
        quantity            REAL NOT NULL,
        unit_cost           REAL NOT NULL DEFAULT 0,
        destination         TEXT NOT NULL DEFAULT 'INVENTORY'
                              CHECK (destination IN ('INVENTORY','WASTE')),
        line_total          REAL NOT NULL
      );
      INSERT INTO sales_return_items_new
        (id, return_id, item_id, batch_id, quantity, unit_cost, destination, line_total)
      SELECT ri.id, ri.return_id, ii.item_id, ii.batch_id, ri.quantity,
             CASE WHEN ri.quantity <> 0 THEN ri.line_total / ri.quantity ELSE 0 END,
             'INVENTORY', ri.line_total
        FROM sales_return_items ri
        JOIN sales_invoice_items ii ON ii.id = ri.invoice_item_id;

      CREATE TABLE purchase_returns_new (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        return_number       TEXT NOT NULL,
        party_id            INTEGER NOT NULL REFERENCES parties(id),
        return_date         TEXT NOT NULL,
        total_amount        REAL NOT NULL DEFAULT 0,
        notes               TEXT,
        created_by          INTEGER REFERENCES users(id),
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (company_id, return_number)
      );
      INSERT INTO purchase_returns_new
        (id, company_id, return_number, party_id, return_date, total_amount,
         notes, created_by, created_at)
      SELECT r.id, r.company_id, r.return_number, pi.supplier_id, r.return_date,
             r.total_amount, r.notes, r.created_by, r.created_at
        FROM purchase_returns r
        JOIN purchase_invoices pi ON pi.id = r.invoice_id;

      CREATE TABLE purchase_return_items_new (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id           INTEGER NOT NULL REFERENCES purchase_returns_new(id) ON DELETE CASCADE,
        item_id             INTEGER NOT NULL REFERENCES items(id),
        batch_id            INTEGER REFERENCES stock_batches(id),
        quantity            REAL NOT NULL,
        unit_cost           REAL NOT NULL DEFAULT 0,
        line_total          REAL NOT NULL
      );
      INSERT INTO purchase_return_items_new
        (id, return_id, item_id, batch_id, quantity, unit_cost, line_total)
      SELECT ri.id, ri.return_id, ii.item_id, ii.batch_id, ri.quantity,
             CASE WHEN ri.quantity <> 0 THEN ri.line_total / ri.quantity ELSE 0 END,
             ri.line_total
        FROM purchase_return_items ri
        JOIN purchase_invoice_items ii ON ii.id = ri.invoice_item_id;

      DROP TABLE sales_return_items;
      DROP TABLE sales_returns;
      DROP TABLE purchase_return_items;
      DROP TABLE purchase_returns;
      ALTER TABLE sales_returns_new RENAME TO sales_returns;
      ALTER TABLE sales_return_items_new RENAME TO sales_return_items;
      ALTER TABLE purchase_returns_new RENAME TO purchase_returns;
      ALTER TABLE purchase_return_items_new RENAME TO purchase_return_items;
    `);
  } finally {
    await db.exec("PRAGMA foreign_keys = ON");
  }
}

async function seedDefaults(db: SqlDatabase): Promise<void> {
  await db.transaction(async () => {
    await db.run("INSERT OR IGNORE INTO companies (id, name) VALUES (1, ?)", [
      "My Pharmaceutical Company",
    ]);
    await db.run(
      "INSERT OR IGNORE INTO warehouses (id, company_id, code, name, is_default) VALUES (1, 1, 'MAIN', 'Main Warehouse', 1)",
    );

    for (const [name, description] of DEFAULT_ROLES) {
      await db.run("INSERT OR IGNORE INTO roles (name, description) VALUES (?, ?)", [
        name,
        description,
      ]);
    }

    for (const [code, name, type, subtype] of SYSTEM_ACCOUNTS) {
      await db.run(
        `INSERT OR IGNORE INTO accounts
           (company_id, account_code, account_name, account_type, account_subtype, is_system_account)
         VALUES (1, ?, ?, ?, ?, 1)`,
        [code, name, type, subtype],
      );
    }

    for (const [docType, prefix] of DEFAULT_NUMBERING) {
      await db.run(
        `INSERT OR IGNORE INTO numbering_sequences
           (company_id, document_type, prefix, next_number, padding)
         VALUES (1, ?, ?, 1, 5)`,
        [docType, prefix],
      );
    }

    await db.run(
      "INSERT OR IGNORE INTO settings (company_id, setting_key, setting_value, setting_group) VALUES (1, 'theme_name', 'dark', 'APPEARANCE')",
    );

    const existing = await db.get<{ id: number }>("SELECT id FROM users LIMIT 1");
    if (existing) return;
    const adminRole = await db.get<{ id: number }>("SELECT id FROM roles WHERE name = 'Admin'");
    const { salt, hash } = hashPassword("admin123");
    await db.run(
      `INSERT INTO users (username, password_hash, password_salt, full_name, role_id)
       VALUES (?, ?, ?, ?, ?)`,
      ["admin", hash, salt, "System Administrator", adminRole?.id ?? null],
    );
  });
}
