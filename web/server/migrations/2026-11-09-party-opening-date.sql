-- Date-wise party opening balances: invoices dated before a party's opening
-- date no longer move its ledger balance (its opening carries them forward).
ALTER TABLE parties ADD COLUMN opening_balance_date TEXT;
