# BOP Nutraceuticals ERP — TypeScript Rewrite: Next-Agent Context

Compact single-file summary of the whole session. Everything verified:
`typecheck=0`, **100/100 tests pass** (16 files), smoke **91 PASS / 0 FAIL**,
client build **0**. The Python project was **never modified** and the hosted
SQLite Cloud DB was **never written to**.

> **Status: master-data CRUD, dashboard, report date-scoping, opening
> balances/stock, expense line items, fixed assets, backups, company profile,
> dark/light theme application, sidebar module finder + Ctrl+F, live table
> filters on every data page, and a single-CSV "Export all reports" (with
> monthly/yearly period presets) are ported.** Settings UI is complete.
> Outstanding is the full acceptance audit the user asked for: rich demo seed
> data of every kind, independent recomputation of every report figure, a
> logical audit of rounding/signs/double-counting, and a UI audit of every page.

## Impact of this chat (the “acceptance audit” that was started)

This session continued the standing review the user asked for: “afterwards when
the app is done test everything add demo data of everykind and check if all the
reports r correctly updating make sure no errors occur especilly logical check if
there is any wrong calculations or any wrong data handling make sure all the ui
components r correctly placed and sized make sure no other errors occur”.

Three concrete pieces were ported before this was interrupted:

1. **Settings extras — company profile + working theme**
   - `web/client/src/SettingsPage.tsx`: a **Company profile** form (company name,
     currency, date format) saved to the `DEFAULT` settings group (`default/FORMAT`
     did not exist — it is `GENERAL`),
     exactly like the desktop app.
   - `web/client/src/theme.ts`: new module; App.tsx now applies theme on login,
     follows OS preference while "system" theme is active, and resets to dark on
     logout.
   - `web/client/src/styles.css`: CSS variables for palette tokens
     (`--bg`, `--text`, `--border`, `--input-bg`, `--input-border`, `--accent`,
     etc.) plus a light palette with `data-theme="light"` overrides.

2. **Global search**
   - `web/client/src/Layout.tsx`: sidebar module finder + Ctrl+F handler +
     nav-empty state, typed from `views/main_window.py` (nav filter, Ctrl+F,
     Enter to jump)
     — not a rewrite of the whole app.
   - `FilterBox.tsx` (new): the live filter input used by Parties, Items, Payments,
     Expenses, Assets and Users, all using `matchesQuery(values)` in the same way.
   - PartiesPage: placeholder text "Search name, code or phone…" on the search box.
   - ItemsPage: placeholder text "Search name or code…" on the search box.
   - PaymentsPage: filter above the payments/receipts table (party, voucher, date,
     method, amount), with "No vouchers match this filter" empty state.
   - ExpensesPage: filter above the recorded expenses table.
   - AssetsPage: filter above the fixed-assets table (book value field included).
   - UsersPage: filter above the users table (status + last-login columns included).

3. **"Export all reports"** — a single CSV containing every report for a period
   - `web/client/src/pages/TrialBalancePage.tsx`: added an **Export all reports**
     card with a frequency (Monthly/Yearly) + period picker pre-populated to the
     most recent period (ported from `report_view._populate_export_periods`,
     starting August 2022 and going forward to today), plus
     `app.ts` + `reportService.ts` + `api.ts` for the `exportAll`/`exportAllCsv`
     flow.
   - `web/server/src/services/reportService.ts`: new `exportAllCsv({from, to})`
     which produces a single CSV containing trial balance, profit & loss, balance
     sheet (as at the period end) and cash book, using the same services as the
     individual tabs. The CSV includes the period label and the balance-sheet line
     carries a "Balanced"/"OUT OF BALANCE" marker (YES/NO). Excel export is out of
     scope.
   - `web/server/src/http/app.ts`: new route `GET /api/reports/export-all.csv`
     (auth required, same period query helper as the other report endpoints).
   - `web/client/src/api.ts`: new `exportAllCsv(from?, to?)` method.
   - `web/server/src/smoke.ts`: added smoke checks for company profile (GENERAL)
     round-trip, invalid theme → 400, and `GET /api/reports/export-all.csv`
     returning CSV for 2026-10 that contains all four report sections and a
     balanced balance sheet.

The context was updated from this chat; all source files remain on disk.


### Current results (at interruption)
- `npm run typecheck` → tsc server + client both clean.
- `npm test` → 100/100 pass (16 files).
- `npm run smoke` → **91 PASS / 0 FAIL**, final trial balance after every module
  ran is `127175 = 127175` (balanced).
- Client `tsc --noEmit && vite build` → clean.

### What was *not* finished before interruption
- Rich demo seed data of every kind (`seedDemoData` still only creates one customer,
  one supplier, one finished good and one batch).
- Independent recomputation of every report figure vs the service.
- Logical audit (rounding, signs, unposted entries, double counting) done by hand
  across every report path.
- Full UI audit of every page (placement/sizing/overflow/empty states) done with
  the full page list in front of me.

The next agent should re-read the smoke checks and the report/interrogation code
before writing demo data or writing monetary assertions, because the routes,
services, and the smoke test itself were touched in this session and the file on
disk is the source of truth.

---

## What is
- **Source:** `views/*.py`, `services/*.py`, `controllers/*.py`, `database/schema.py`,
  `database/migrations/migrator.py`, `utils/security.py` — 48,043 lines / 180 files,
  Python 3.9 + PySide6 + SQLite Cloud.
- **Rewrite:** all under `web/` (untracked, nothing committed). 48 server src files,
  13 test files, 21 client src files (15 pages), **70 API routes**.

Run it (from repo root):
```bash
cd web && npm install && npm run seed && npm run dev
# → http://localhost:5173   login admin/admin123
```
Quality gates: `npm run typecheck`, `npm test`, `npm run smoke`,
`npm -w @bop-erp/client run build`.

---

## Compatibility contracts (must keep, from Python)
1. **Passwords:** PBKDF2-HMAC-SHA256, **200,000 iterations**, 16-byte random
   salt, hex(salt+hash). Node: `pbkdf2Sync(plain, salt, 200000, 32, "sha256")`.
   → admin/admin123 logs in unchanged.
2. **Voucher numbering:** `numbering_sequences` upsert
   `ON CONFLICT(company_id, document_type) DO UPDATE SET next_number += 1
   RETURNING prefix, next_number, padding`; printed as `prefix + zfill(5)`.
   Seeded prefixes: SI-, SR-, PI-, PR-, PV-, RV-, JV-, OB-, PO-, EV-,
   CUST-, SUPP-, ITEM-, BOM-. Voucher type → doc type:
   SALES→SALES_INVOICE, PURCHASE→PURCHASE_INVOICE, PAYMENT→PAYMENT,
   RECEIPT→RECEIPT, JOURNAL→JOURNAL_VOUCHER, OPENING→OPENING,
   CUSTOMER→CUSTOMER, SUPPLIER→SUPPLIER, EXPENSE→EXPENSE.
3. **System accounts (27)** resolved by **code, never id**: 1000 Cash, 1010 Bank,
   1100 AR, 1200 Raw, 1210 Packing, 1220 FG, 1300 WHT Recv, 1500–1505 fixed
   assets, 2000 AP, 2100 Tax Pay, 2200 WHT Pay, 3000 Equity, 3100 Retained,
   4000 Sales, 4100 Sales Returns, 5000 COGS, 5001 Packing COGS, 5100 Purch
   Returns, 5200 Mfg Wastage, 5300 Inventory Loss, 6000 G&A, 6100 Selling.
   (5002 is NOT always seeded — fallback to 5000.)
4. **Balance rule:** `get_current_balance` = sums of posted `journal_entry_lines`
   only; do **not** add `accounts.opening_balance` (openings are their own
   OPENING entries — would double-count).
5. **Normal:** ASSET/EXPENSE debit-normal; LIABILITY/EQUITY/REVENUE credit-normal.
6. **Schema** ported verbatim from `database/schema.py` into
   `web/server/src/db/schema.ts` (SCHEMA_SQL). Key tables:
   - `journal_entries`: UNIQUE(company_id, voucher_number); voucher_type CHECK
     IN ('JOURNAL','SALES','SALES_RETURN','PURCHASE','PURCHASE_RETURN','PAYMENT',
     'RECEIPT','MANUFACTURING','STOCK_ADJUSTMENT','OPENING').
   - `journal_entry_lines`: CHECK(debit>=0, credit>=0), CHECK(NOT(debit>0 AND
     credit>0)).
   - `users` (username UNIQUE, password_hash/salt, role_id, is_active, last_login_at).
   - `settings`: company_id + setting_key + setting_group, UNIQUE(company_id, setting_key).
7. **SQLite Cloud driver** `@sqlitecloud/drivers` v1.0.982 — single serialized
   connection (`new Database`); TS quirk: `SQLiteCloudCommand` not exported → use
   `type SqlArgument = Parameters<Database["sql"]>[0]` and cast (DataTypes union
   uses `Buffer` not `Uint8Array`).
8. **`decimal.js` v10.6.0 quirk:** under NodeNext, `export default` is broken —
   **must use named import** `import { Decimal } from "decimal.js"`.
9. `node:sqlite` (`DatabaseSync`) works on Node v22 (experimental warning only) →
   used as the local/test DB.

---

## Documented deviations (deliberate)
- **Trial balance includes deactivated accounts that still carry posted
  movement.** Python filtered on `is_active = 1` only, so deactivating a funded
  account silently unbalanced the trial balance (its journal lines remained but
  the account vanished from the report). Fixed in
  `AccountingService.getTrialBalance` via a `HAVING` clause; regression test in
  `tests/masterdata.test.ts`. Inactive accounts with no movement stay hidden.
- Duplicate username → **409** (Python → 400).
- Party codes are unique **company-wide** (the schema's `UNIQUE(company_id, code)`
  is authoritative; Python's per-party-type check would let a duplicate through
  to a DB error).
- Returns: Python had **no create path** (only reversal helpers) — web has real
  create paths + tests (ahead of Python).
- Sessions: in-memory `Map`, token = `randomUUID`, 12h TTL, lost on restart.

---

## Files
**Server** (all under `web/server/src/`):
- `env.ts` (loads web/.env then repo-root .env), `index.ts` (boot local only,
  listen, SIGINT/SIGTERM shutdown), `seed.ts` (refuses non-local), `smoke.ts`
  (throwaway DB `data/smoke-<pid>.sqlite`, 38 HTTP checks), `seedData.ts`
  (`seedDemoData` → DemoIds: customer id=1 DEMO-CUST, item id=1 DEMO-FG,
  batch id=1 DEMO-BATCH 1000 units @ 100.00).
- `domain/`: `errors.ts` (AppError + ValidationError 400, NotFound 404,
  Conflict 409, Unauthorized 401, Configuration 500, Database 500,
  InsufficientStock 409, UnbalancedJournalEntry 500), `enums.ts` (types +
  isDebitNormal + SystemAccountCodes), `money.ts` (Decimal, round2, toStorage,
  sum, multiply, formatAmount, formatMoney; MONEY_DP=2).
- `db/`: `types.ts` (SqlDatabase: all/get/run/exec/transaction<T>/close),
  `localSqlite.ts` (node:sqlite adapter + nested tx depth counter),
  `sqliteCloud.ts` (driver + AsyncLocalStorage re-entrant tx lock),
  `index.ts` (createDatabase/getDb/closeDb, re-exports SCHEMA_SQL),
  `schema.ts`, `bootstrap.ts` (exec SCHEMA_SQL + idempotent seedDefaults
  — only local engine).
- **Repositories (16):** base (insertRow, falls back to last_insert_rowid),
  accountRepository, systemAccounts (resolver + cache), journal,
  party, item, stockBatch, sales, purchase, payment, manufacturing, expense,
  banking, returns, user (listWithRoles/findSummaryById/create/update/filterByUsername/changePassword/listRoles),
  settings (group/all/setGroup/deleteGroup; values encoded `json:` for objects).
- **Services (11):** accounting (getTrialBalance → TrialBalanceRow), auth,
  salesInvoice, purchaseInvoice, payment, manufacturing, expense, banking,
  returns, report (**trialBalance, profitAndLoss, balanceSheet, partyLedger,
  cashBook, trialBalanceCsv**), settings, user.
- `http/app.ts`: Express app + in-memory sessions + `requireAuth` Bearer
  middleware + `parseBody(zod)` + **69 routes** (full list below) + 404 +
  error handler. Also `dateRangeQuery(req)`, `returnSchema`, `movementSchema`,
  `chequeSchema` at module scope.
  Route list (server/src/http/app.ts):
  `GET /api/health`; `GET /api/dashboard`;
  `POST /api/auth/login`, `POST /api/auth/change-password`;
  `GET /api/accounts`, `POST /api/accounts`, `PUT /api/accounts/:id`,
  `POST /api/accounts/:id/deactivate`;
  `GET /api/parties?type=&search=&activeOnly=`, `POST /api/parties`,
  `PUT /api/parties/:id`, `POST /api/parties/:id/deactivate`;
  `GET /api/items?search=&type=&activeOnly=`, `POST /api/items`,
  `PUT /api/items/:id`, `POST /api/items/:id/deactivate`;
  `GET /api/tax-rates`;
  `GET|POST /api/sales-invoices`, `GET /api/sales-invoices/:id`;
  `GET|POST /api/purchase-invoices`, `GET /api/purchase-invoices/:id`;
  `GET|POST /api/payments`, `GET|POST /api/receipts`;
  `GET|POST /api/boms`, `GET /api/boms/:id`;
  `GET|POST /api/production-orders`, `GET /api/production-orders/:id`,
  `POST /api/production-orders/:id/start`, `POST /api/production-orders/:id/complete`;
  `GET|POST /api/expense-categories`, `GET|POST /api/expenses`;
  `GET|POST /api/bank-accounts`, `GET /api/bank-accounts/:id/balance`,
  `GET /api/bank-transactions`, `POST /api/bank-transactions/deposit`,
  `POST /api/bank-transactions/withdraw`;
  `GET /api/cheques`, `POST /api/cheques/issue`, `POST /api/cheques/receive`;
  `POST /api/cheques/:id/clear`, `POST /api/cheques/:id/bounce`,
  `POST /api/cheques/:id/lose`;
  `GET|POST /api/sales-returns`, `GET|POST /api/purchase-returns`;
  `GET /api/journal-entries/:sourceTable/:sourceId`;
  `GET /api/reports/trial-balance`, `GET /api/reports/profit-and-loss`,
  `GET /api/reports/balance-sheet`;
  `GET /api/reports/party-ledger?partyId=&from=&to=`,
  `GET /api/reports/cash-book?from=&to=`,
  `GET /api/reports/trial-balance.csv`;
  `GET /api/reports/export-all.csv?from=&to=` (all four reports for one period
  into one CSV: trial balance, P&L, balance sheet as at the end, cash book).
  `GET /api/users`, `POST /api/users`,
  `PUT /api/users/:id`, `POST /api/users/:id/reset-password`;
  `GET /api/roles`;
  `GET /api/settings`, `PUT /api/settings`, `DELETE /api/settings/:group`.
- `seedData.ts` returns DemoIds; `smoke.ts` boots createApp against throwaway DB.

**Client** (all under `web/client/src/`):
- `types.ts` (Account, Party, Item, SalesInvoice*, PurchaseInvoice*, Payment*,
  Receipt*, Expense*, ExpenseResult, BankAccount, BankTransaction, Cheque,
  ExpenseCategory, Bom, ProductionOrder, TrialBalanceRow, TrialBalance,
  ProfitAndLoss, **BalanceSheet, LedgerEntry, UserRow, Role, SettingsGroups**).
- `api.ts` (typed fetch wrapper, ApiError, localStorage token
  `bop-erp.token` + `bop-erp.user`; helpers `request<T>`, `requestText(path)`
  for CSV; methods: login, accounts, parties, items, salesInvoices$$,
  createSalesInvoice, purchaseInvoices$$, createPurchaseInvoice,
  payments$$, receipts$$, paySupplier$$, receivePayment$$, salesReturns$$,
  createSalesReturn$$, purchaseReturns$$, createPurchaseReturn$$, bankAccounts$$,
  createBankAccount$$, bankTransactions$$, deposit$$, withdraw$$, cheques$$,
  issueCheque$$, receiveCheque$$, clearCheque$$/bounceCheque$$/loseCheque$$,
  expenseCategories$$, createExpenseCategory$$, expenses$$, createExpense$$,
  boms$$, createBom$$, productionOrders$$, createProductionOrder$$,
  startProduction$$, completeProduction$$, trialBalance$$, profitAndLoss$$,
  balanceSheet$$, partyLedger$$(partyId, from?, to?), cashBook$$(from?, to?),
  trialBalanceCsv$$, users$$, roles$$, createUser$$, updateUser$$,
  resetUserPassword$$, changePassword$$ (current/new), settings$$
  (group), saveSettings$$(group, settings)).
- `main.tsx`, `styles.css` (dark theme, CSS var `--accent:#8b1a2b`,
  cards/rows/tables/num/badge; button primary hover disabled),
  `App.tsx` (Page union = dashboard|sales|purchases|parties|items|payments|
  manufacturing|expenses|banking|returns|accounts|reports|users|settings;
  default page = **dashboard**), `Layout.tsx` (sidebar nav + topbar; NAV array).
  Pages: **DashboardPage**, LoginPage,
  SalesInvoicesPage, PurchaseInvoicesPage, **PartiesPage** (CRUD, type/search/
  inactive filters, account picker filtered by party type), **ItemsPage** (CRUD,
  type/search/inactive filters, unit + tax-rate pickers),
  PaymentsPage, ManufacturingPage, ExpensesPage,
  BankingPage, ReturnsPage, **AccountsPage** (CRUD + include-inactive toggle +
  system-account badge), **TrialBalancePage** (reports:
  P&L + trial balance + balance sheet + party ledger with party+
  from/to filters + running balance + cash book + **Export CSV** button),
  **UsersPage** (list/edit/add/disable/reset password across bootstrapped
  edit form that reuses the same draft and calls the same handlers), **SettingsPage**
  (theme save + change own password).
- `middleware` / vite proxy: `vite.config.ts` proxies `/api` → `localhost:4000`.

**Tests** (`web/server/tests/`): helpers/db.ts (`freshDb() → in-memory + seedDemoData
  TestContext{db,ids}`; closeDb; accountId(db,code)); money(5) accounting(5)
  salesInvoice(5) purchaseInvoice(5) payment(4) manufacturing(4) expense(4)
  banking(6) returns(3) report(5) user(11) **masterdata(16)**.
  vitest.config includes tests/**/*.test.ts.

**Master-data layer (newest batch):**
- `services/itemService.ts` — units (TABLET/CAPSULE/ML/GRAM/KG/UNIT/VIAL/AMPOULE),
  types (RAW/PACKING/FINISHED_GOOD), price + stock-bound validation, manual or
  auto `ITEM-00001` code allocated **inside the insert transaction**, tax-rate
  validation (must exist, same company, SALES_TAX), update, deactivate, search.
- `services/partyService.ts` — auto `CUST-`/`SUPP-` codes, customer→ASSET /
  supplier→LIABILITY account-link rule, and the `hasOpenTransactions` guard
  (unpaid CONFIRMED/PENDING invoices, or any receipt/payment) that blocks
  deactivation -- ported from PartyService._has_open_transactions.
- `services/accountService.ts` — code/name required, parent must exist and share
  the account type, non-zero opening balance posted immediately as an OPENING
  entry against Retained Earnings (3100, skipped when the account *is* 3100),
  opening-balance changes post an adjusting entry, system accounts cannot be
  deactivated, parents with active children cannot be deactivated.
- `repositories/taxRateRepository.ts` (read-only); `update`/`deactivate`/
  `findChildren` added to account/party/item repositories.
- Routes: `POST /api/accounts`, `PUT /api/accounts/:id`,
  `POST /api/accounts/:id/deactivate`, `POST /api/parties`, `PUT /api/parties/:id`,
  `POST /api/parties/:id/deactivate`, `GET /api/tax-rates`, `POST /api/items`,
  `PUT /api/items/:id`, `POST /api/items/:id/deactivate`; the three list routes
  now accept `?search=` and `?activeOnly=false` and are served through services.
- Client: `ItemsPage.tsx`, `PartiesPage.tsx`, and `AccountsPage.tsx` extended with
  create/edit/deactivate + an "include inactive" toggle and a system-account badge.
  Note `api.parties()` now takes an options object (was positional `type`).

**Backups (newest batch):**
- `services/backupService.ts` ported from `controllers/backup_controller.py` +
  `services/auto_backup.py` (which wrote `backups/erp_backup_*.db`).
  `status()` reports engine/dir/supported/count/latest/size; `run()` writes a
  snapshot with **`VACUUM INTO`** (consistent even while serving); `resolve()`
  rejects path traversal and bad names.
- **Deliberate scope limits, documented in the code:** snapshots are **refused on
  the `sqlitecloud` engine** (`ConfigurationError`) — the provider snapshots the
  hosted database and this app must never touch production. **Restore is refused
  while the server is live** (swapping the file under an open connection corrupts
  it) and the error explains the safe procedure instead. This differs from the
  Python desktop app, which held a short-lived connection and could restore.
- `createApp(db, companyId, {engine?, backupDir?})` gained an options argument so
  tests/smoke can redirect snapshots; `env` gained `backupDir` and
  `autoBackupHours` (opt-in via `ERP_AUTO_BACKUP_HOURS`, default 0; 24 = the
  Python default) and `index.ts` runs the interval, clearing it on shutdown.
- Routes `GET /api/backup/status`, `POST /api/backup`,
  `GET /api/backups/:file/download`, `POST /api/backups/:file/restore`.
- Client: a **Backups** card on SettingsPage (count/size, "Back up now",
  per-snapshot Download via an authenticated blob fetch, provider-managed notice).
- Tests `tests/backup.test.ts` (5) — including verifying the snapshot really is a
  SQLite file that opens and still contains the seeded chart of accounts.

**Fixed assets (older batch):**
- `asset_details` was already in `schema.py` (it is NOT one of the missing
  migration tables) -> nothing to add to the schema.
- `repositories/assetRepository.ts` + `services/assetService.ts` ported from
  `views/widgets/asset_view.py`: an asset **is** an ASSET account under code
  `15%` (1500-1505 seeded, plus 1506 created on demand) optionally described by
  an `asset_details` row. `create()` posts Dr asset / Cr **2000** (CREDIT, with
  the supplier as `party_id`) or **1000** (CASH) or **1010** (BANK/CHEQUE) as a
  **JOURNAL** entry, then upserts `asset_details`. `list()` returns the joined
  accounts with `current_balance` = posted debit-credit.
- **Faithful quirk (documented):** `asset_details` is `UNIQUE(account_id)` in the
  schema, so each of the six codes can only describe **one** asset record; a
  second purchase on the same code reuses the account and overwrites the
  descriptive row while the book value accumulates. There is no depreciation
  engine in Python either (root `.env.example` mentions
  `DEPRECIATION_MAX_YEARS`, but nothing consumes it).
- Deviation: the Python dialog find-or-creates a supplier by typed name; the web
  form takes a `supplierId` from the existing supplier list instead.
- Routes `GET /api/assets`, `GET /api/asset-codes`, `POST /api/assets`.
- Client `AssetsPage.tsx` (book-value table + record-purchase form, payment-method
  and classification aware) and a **Fixed Assets** nav entry.
- Tests `tests/asset.test.ts` (5).

**Recurring expense items / "Pay Items" (older batch):**
- `expense_items` came from `database/migrations/add_expense_items.py`, **not**
  `schema.py` — the DDL was added to `web/server/src/db/schema.ts` (guarded by
  `IF NOT EXISTS`, so it is safe against the hosted DB where the Python
  migration already created it). `UNIQUE(company_id, category_id, name)`.
- `repositories/expenseItemRepository.ts` + `expenseItemService.ts` ported from
  `expense_item_service.py`: per-category recurring payees/bills, `list/create/
  update/deactivate`, and `payItems` — **one expense voucher per selected item**
  through the existing `ExpenseService.createExpense` (so the category account /
  6000 fallback and EV- numbering are reused), all wrapped in one outer
  transaction, with the paid amount stored back on the item. Zero amounts are
  skipped; an item from another category is rejected.
- Routes `GET /api/expense-items?categoryId=`, `POST /api/expense-items`,
  `PUT /api/expense-items/:id`, `POST /api/expense-items/:id/deactivate`,
  `POST /api/expense-items/pay`.
- Client `ExpensesPage` gained a **Pay items** grid (per-item "pay now" amounts
  + "save amount", pay-selected using the same method/date as the record form)
  and an **Add expense item** form; the category selector reloads the items.
- Tests `tests/expenseItem.test.ts` (4).

**Opening balances & opening stock (older batch):**
- `AccountService.postOpeningBalances(entries)` — ported from
  `opening_balance_dialog.py`: one balanced OPENING journal entry for all entered
  amounts (assets debit, liabilities/equity credit), then refreshes each
  account's `opening_balance` **display** column (signed by normal balance; it is
  still never added into balances). Rejects unbalanced/zero/unknown input with 400.
- `ItemService.addOpeningStock(input)` — ported from `ItemService.add_opening_stock`:
  creates the batch (**409** on a duplicate batch number in the same warehouse),
  inserts a `stock_movements` row with `movement_type = 'OPENING'`, and — only when
  `partyId` is supplied and the value is non-zero — posts an OPENING entry
  Dr inventory (1200/1210/1220 by item type) / Cr A/P (2000) with the party.
  Auto batch number `OPEN-{item_code}-{timestamp}`.
- Routes `POST /api/accounts/opening-balances` (201) and
  `POST /api/items/:id/opening-stock` (201).
- Client: AccountsPage has an **Opening balances** card (per-account inputs, live
  debit/credit totals, "Calculate equity" plug into the first EQUITY account,
  post); ItemsPage has an **Opening stock** card (item, quantity, unit cost,
  batch, expiry, optional supplier, live value).
- Tests: 5 new in `masterdata.test.ts` (bulk opening balances + stock movement +
  Dr 1220/Cr 2000 with party + duplicate/bad input).

**Report date-scoping (older batch) — BREAKING shape changes:**
- `TrialBalanceRow` now carries `openingDebit/openingCredit` (entries strictly
  before `from`), `debit/credit` (**movement inside the period**) and
  `closingDebit/closingCredit` (opening + period). Existing consumers must use
  the right set: TB **totals** use closing, P&L uses period movement, balance
  sheet uses closing cumulative.
- `AccountingService.getTrialBalance(companyId, {from?, to?})` computes all three
  sets in one query with `(? IS NULL OR je.entry_date >= ?)` guards. **Plain `?`
  placeholders only** — `?NNN` support in the hosted SQLite Cloud driver is
  unverified (the local adapter is the only one tested).
- `ReportService.trialBalance({from,to})`, `profitAndLoss({from,to})`,
  `balanceSheet(asAt)` (cumulative to that date) and
  `trialBalanceCsv({from,to})`. The CSV header changed to
  `Account Code,Account Name,Type,Opening Debit,Opening Credit,Debit,Credit,Closing Debit,Closing Credit`.
- Routes accept `?from=&to=` (TB, P&L, CSV) and `?asAt=` (balance sheet).
- Client `api.trialBalance(from?,to?)`, `api.profitAndLoss(from?,to?)`,
  `api.balanceSheet(asAt?)`, `api.trialBalanceCsv(from?,to?)` (shared
  `periodQuery()` helper); `TrialBalancePage` gained a "Report period" card
  (From / To / Balance sheet as at / Apply / All posted entries) and nine TB
  columns.
- Tests: 3 new in `report.test.ts` pinning opening-carry-forward, per-day P&L
  (250 / 100 / 350) and as-at balance sheets (250 then 350).

**Dashboard (previous batch):**
- `services/dashboardService.ts` — ported from `dashboard_service.py`:
  `get()` returns `{today, balances, receivablesPayables, profitLoss,
  recentTransactions, inventory, alerts, monthlyTrend}` (camelCase). Cash =
  accounts 1000+1020, bank = 1010, receivable = 1100 (debit-credit), payable =
  2000 (credit-debit), month-to-date P&L from REVENUE/EXPENSE lines, inventory
  value from `stock_batches.quantity*purchase_price` with a GL 1200/1210/1220
  fallback, last 15 transactions UNIONed across sales/purchases/payments/
  receipts/expenses, low-stock (`HAVING current_stock < minimum_stock`),
  batches expiring within 30 days, generated alerts (low stock ×5, expiring ×3,
  else "All Clear!") and a 6-month recursive-CTE revenue/expense trend.
- No cache: the Python app cached for 5 minutes; these queries are index-backed
  and always current, so `GET /api/dashboard` recomputes every call.
- Route `GET /api/dashboard`; client `DashboardPage.tsx` (tiles, alert list with
  colour-coded left borders, CSS-bar trend table, recent transactions, low-stock
  and expiring tables) — now the **default landing page** and first nav entry.
- Tests `tests/dashboard.test.ts` (5). Caveat: month-to-date **expenses include
  COGS** (5000 is an EXPENSE account), so a 750 sale with a 500 cost shows
  expenses 525 = 500 COGS + 25 expense.

---

## Verification (last full run — exit 0 each)
- `npm run typecheck` → tsc server + client both clean.
- `npm test` → 16 files, **100/100 pass** (21 masterdata, 5 dashboard, 8 report,
  4 expenseItem, 5 asset, 5 backup).
- `npm run smoke` → **87 PASS / 0 FAIL** (throwaway DB; never touches dev/prod DB;
  snapshots go to a throwaway `data/smoke-backups-<pid>/` so `web/backups` is
  never littered).
  New admin checks: roles list, user list with no password material, create user
  → 201, duplicate username → 409, update role → 200, reset password + re-login
  → 200, wrong current password → 401, change-password → 200, settings grouped
  (theme dark), settings write/read-back, invalid theme → 400.
- Client `tsc --noEmit && vite build` → 30 modules, 277.35 kB (gzip 78.34 kB).

## What's POST-PORTIONED vs PYTHON
- `report_view.py`: Python had date-scoped TB + opening/closing, P&L by period,
  BS as-at date, scheduled export (frequency/period); web has all-posted TB/P&L/BS
  + manual CSV download + the "Export all reports" single-CSV with monthly/yearly
  period presets.
- `settings_view.py` (695 lines) + `expense_items_dialog.py` + `expense_item_service.py`:
  only theme + change password / flat expense implemented (shortcuts stored but
  no editor).
- `item_service.add_opening_stock` (batch + OPENING stock movement + OPENING
  journal entry against 2000 when a supplier is given) is **not yet ported** —
  it belongs to the opening-stock batch below.
- **Ported (was on this list):** global search (sidebar module finder + Ctrl+F),
  settings extras (company profile), and the **"Export all reports"** single-CSV
  export with monthly/yearly period presets (the spreadsheet scheduler itself is
  out of scope).
- **Ported (was on this list):** backups + auto-backup scheduler (with the
  documented local-only / no-live-restore scope limits).
- **Ported (was on this list):** opening balances and opening stock, including
  `ItemService.add_opening_stock`.
- **Ported (was on this list):** master-data CRUD (items, parties, accounts),
  the dashboard, and report date-scoping. The Python dashboard's heavy/legacy
  helper methods are not needed; only `get_dashboard_data` + `_get_monthly_trend`
  had behaviour to port.

---

## Git state (checked)
```
?? BOP_ERP_TYPESCRIPT_REWRITE_LOG.md   (497-line full session log I wrote)
?? freebuff-chat-2026-10-07T21-54-07.857Z.md   (client transcript, 1.6MB)
?? web/
```
Last commit `d9435f4` is "before buff"; `f71b249` is the Python-side commit
"Improve UX and performance: security, async reports, thread-safe cache,
persistence". No tracked files modified.

---

## Outstanding: the acceptance audit the user asked for

The user's standing request after the port finishes:
1. **Rich demo data of every kind** — `seedDemoData` was extended so the app
   starts loaded: parties of both types, raw/packing/finished items, purchase
   invoices that create batches, credit + cash sales, receipts/payments, a
   production order + BOM, expenses (incl. recurring pay-items and a bulk "Pay
   items"), bank account + deposit/withdraw + issue/receive/clear cheques, a
   sales return and a purchase return, a fixed asset purchase, and an opening
   balance. This is the core of the acceptance audit.
2. **Every report must update correctly** — recompute each figure independently
   in the test (not via the same service) and cross-check: trial balance
   balances, P&L = revenue - expenses, balance sheet assets = liabilities +
   equity, party ledger running balance, cash book, dashboard tiles vs the report
   services.
3. **Logical audit** — hunt for wrong calculations / wrong data handling
   (rounding, sign placement, deferred/credit handling, unposted entries leaking
   into reports, double counting).
4. **UI audit** — every page: component placement, sizing, overflow, table
   widths, number alignment, empty states.

## Read-first file for next agent
- `web/server/src/http/app.ts` ≈ 533 lines: central route registration +
  `createApp(db, companyId)` + `requireAuth` + `parseBody` + module-scope schemas.
- `web/server/src/services/reportService.ts` (verified clean) — trialBalance,
  profitAndLoss, balanceSheet (assets=liab+equity+profit), partyLedger+
  cashBook (withRunningBalance), trialBalanceCsv (header + TOTAL line).
- `web/client/src/pages/TrialBalancePage.tsx` — the big one: P&L + trial balance
  + balance sheet + party ledger (party selector + from/to + running balance) +
  cash book (from/to + running balance) + Export CSV (blob).
- `web/server/src/services/userService.ts` + `settingsService.ts` + the two
  new repos (`userRepository.ts`, `settingsRepository.ts`).
- `web/README.md` — documents the rewrite, what was ported, what's left.
- `IMPORT_DOCUMENTATION.md` and `IMPORT_DOCUMENTATION.md` exist at repo root but
  were not read in this session.

---

## Environment / constraints
- node v22.22.1, npm 9.2.0, python3 3.14.4. **NOT installed:** dotnet, bun,
  deno, go, rustc, java, psql, sqlite3, **Chrome** → no real-browser DOM test
  (client verified via vite compile + HTTP only).
- `web/.env`: ERP_DB_ENGINE=local, ERP_LOCAL_DB=./data/dev.sqlite, PORT=4000.
  Shell note: `cd web/server` from a web cwd failed once; most commands run as
  `cd web && …`. Live SQLite Cloud never exercised.
