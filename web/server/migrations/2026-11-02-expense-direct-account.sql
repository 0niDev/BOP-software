-- Expenses post straight to a COA account; the expense-category system is
-- retired. Run once against the hosted SQLite Cloud database (the app never
-- runs DDL there). The local engine applies the same shape automatically via
-- bootstrapDatabase() -> ensureColumns() + ensureExpenseAccountSchema().
--
-- Steps:
--   1. Add expenses.account_id (new expenses store their target account;
--      legacy rows keep NULL and resolve through their category link).
--   2. Relax category_id to nullable by a one-time table rebuild — SQLite
--      cannot drop a NOT NULL in place. Skip step 2 if category_id is already
--      nullable (e.g. after a re-run); guarded instead by the check below.

-- 1. New column. Re-running errors harmlessly ("duplicate column name").
ALTER TABLE expenses ADD COLUMN account_id INTEGER REFERENCES accounts(id);

-- 2. Only while category_id is still NOT NULL:
--    SELECT notnull FROM pragma_table_info('expenses') WHERE name = 'category_id';  -- 1
PRAGMA foreign_keys = OFF;
CREATE TABLE expenses_rebuild (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id          INTEGER NOT NULL REFERENCES companies(id),
  voucher_number      TEXT NOT NULL,
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
PRAGMA foreign_keys = ON;
