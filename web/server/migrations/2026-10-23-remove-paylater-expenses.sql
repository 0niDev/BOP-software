-- Remove pay-later expense bills and stop recurring auto-bills.
-- Run once against the hosted SQLite Cloud database (the app never runs DML
-- migrations there). Safe to re-run: every statement is idempotent.
--
-- Unpaid bills posted Dr expense / Cr Accounts Payable when they were created,
-- so the rows cannot simply vanish: their journal entries are deleted first or
-- the ledger would keep the expense and the payable with no document behind
-- them. PAID expenses are real transactions and are untouched.

DELETE FROM journal_entry_lines
 WHERE journal_entry_id IN (
   SELECT je.id
     FROM journal_entries je
     JOIN expenses e ON je.source_table = 'expenses' AND je.source_id = e.id
    WHERE e.status = 'UNPAID'
 );

DELETE FROM journal_entries
 WHERE source_table = 'expenses'
   AND source_id IN (SELECT id FROM expenses WHERE status = 'UNPAID');

DELETE FROM expenses WHERE status = 'UNPAID';

-- Recurring items would regenerate an unpaid bill on the next GET /api/expenses.
UPDATE expense_items
   SET is_active = 0, updated_at = datetime('now')
 WHERE frequency IS NOT NULL AND amount IS NOT NULL AND amount > 0;
