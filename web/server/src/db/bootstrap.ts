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
  ["1501", "HBL Instalment", "ASSET", "NON_CURRENT_ASSET"],
  ["1502", "Motor Car Instalment", "ASSET", "NON_CURRENT_ASSET"],
  ["1503", "Auto Vehicles", "ASSET", "NON_CURRENT_ASSET"],
  ["1504", "Furniture & Fixtures", "ASSET", "NON_CURRENT_ASSET"],
  ["1505", "Car Sale & Purchase", "ASSET", "NON_CURRENT_ASSET"],
  ["2000", "Accounts Payable", "LIABILITY", "CURRENT_LIABILITY"],
  ["2100", "Sales Tax Payable", "LIABILITY", "CURRENT_LIABILITY"],
  ["2200", "Withholding Tax Payable", "LIABILITY", "CURRENT_LIABILITY"],
  ["3000", "Owner's Equity", "EQUITY", null],
  ["3100", "Retained Earnings", "EQUITY", null],
  ["4000", "Sales Revenue", "REVENUE", null],
  ["4100", "Sales Returns & Allowances", "REVENUE", null],
  ["5000", "Cost of Goods Sold", "EXPENSE", null],
  ["5001", "Cost of Packing Materials", "EXPENSE", null],
  ["5100", "Purchase Returns & Allowances", "EXPENSE", null],
  ["5200", "Manufacturing Wastage Expense", "EXPENSE", null],
  ["5300", "Inventory Loss / Expiry Expense", "EXPENSE", null],
  ["6000", "General & Administrative Expenses", "EXPENSE", null],
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
  ["EXPENSE_VOUCHER", "EV-"],
  ["CUSTOMER", "CUST-"],
  ["SUPPLIER", "SUPP-"],
  ["ITEM", "ITEM-"],
  ["BOM", "BOM-"],
];

/** Create all tables (idempotent) and seed defaults. */
export async function bootstrapDatabase(db: SqlDatabase): Promise<void> {
  await db.exec(SCHEMA_SQL);
  await seedDefaults(db);
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
