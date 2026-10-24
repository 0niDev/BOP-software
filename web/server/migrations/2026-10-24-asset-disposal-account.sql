-- Asset disposal gain/loss account.
-- The Fixed Assets module can now dispose of an asset (edit/delete feature):
-- the difference between proceeds and book value posts to 6900. The local
-- database seeds this automatically; the hosted SQLite Cloud database is
-- migrated by hand with this file. Safe to re-run (INSERT OR IGNORE).

INSERT OR IGNORE INTO accounts
  (company_id, account_code, account_name, account_type, account_subtype, is_system_account)
VALUES
  (1, '6900', 'Gain / Loss on Asset Disposal', 'EXPENSE', NULL, 1);
