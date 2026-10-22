-- Expense pay-later bills + recurring expense rules.
-- Run once against the hosted SQLite Cloud database (the app never runs DDL
-- there). The local engine applies the same columns automatically via
-- bootstrapDatabase() -> ensureColumns().

ALTER TABLE expenses ADD COLUMN status TEXT NOT NULL DEFAULT 'PAID';
ALTER TABLE expenses ADD COLUMN due_date TEXT;
ALTER TABLE expenses ADD COLUMN settlement_journal_entry_id INTEGER;

ALTER TABLE expense_items ADD COLUMN frequency TEXT;
ALTER TABLE expense_items ADD COLUMN next_run_date TEXT;
