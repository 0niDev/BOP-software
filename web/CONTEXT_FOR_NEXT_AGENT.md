# BOP Nutraceuticals ERP — TypeScript Rewrite: Next-Agent Context

Compact single-file summary of the whole session. Everything verified:
`typecheck=0`, **73/73 tests pass** (12 files), smoke **57 PASS / 0 FAIL**,
client build **0**. The Python project was **never modified** and the hosted
SQLite Cloud DB was **never written to**.

> **Status: master-data CRUD is now ported (items / parties / accounts).**
> Remaining: dashboard, report date-scoping + scheduled export, fixed assets,
> expense line items, backups, opening balance/stock, settings extras, search.

---

## What is
- **Source:** `views/*.py`, `services/*.py`, `controllers/*.py`, `database/schema.py`,
  `database/migrations/migrator.py`, `utils/security.py` — 48,043 lines / 180 files,
  Python 3.9 + PySide6 + SQLite Cloud.
- **Rewrite:** all under `web/` (untracked, nothing committed). 47 server src files,
  12 test files, 21 client src files (14 pages), **69 API routes**.

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
  `GET /api/health`; `POST /api/auth/login`, `POST /api/auth/change-password`;
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
  `App.tsx` (Page union = sales|purchases|parties|items|payments|manufacturing|
  expenses|banking|returns|accounts|reports|users|settings),
  `Layout.tsx` (sidebar nav + topbar; NAV array). Pages: LoginPage,
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

---

## Verification (last full run — exit 0 each)
- `npm run typecheck` → tsc server + client both clean.
- `npm test` → 12 files, **73/73 pass** (16 new in masterdata.test.ts).
- `npm run smoke` → **57 PASS / 0 FAIL** (throwaway DB; never touches dev/prod DB).
  New admin checks: roles list, user list with no password material, create user
  → 201, duplicate username → 409, update role → 200, reset password + re-login
  → 200, wrong current password → 401, change-password → 200, settings grouped
  (theme dark), settings write/read-back, invalid theme → 400.
- Client `tsc --noEmit && vite build` → 30 modules, 277.35 kB (gzip 78.34 kB).

---

## What's POST-PORTIONED vs PYTHON
- `report_view.py`: Python had date-scoped TB + opening/closing, P&L by period,
  BS as-at date, scheduled export (frequency/period); web has all-posted TB/P&L/BS
  + manual CSV download.
- `settings_view.py` (695 lines) + `expense_items_dialog.py` + `expense_item_service.py`:
  only theme + change password / flat expense implemented (shortcuts stored but
  no editor).
- `item_service.add_opening_stock` (batch + OPENING stock movement + OPENING
  journal entry against 2000 when a supplier is given) is **not yet ported** —
  it belongs to the opening-stock batch below.
- **NOT ported:** dashboard (`dashboard_service.py` ~650 lines: today/monthly
  summaries, balances, receivables/payables, inventory, alerts, recent
  transactions, 6-month trend), fixed assets, backups/auto-backup, opening
  balance/stock dialogs, global search bar, settings extras (shortcut
  editor/company profile).
- **Ported (was on this list):** master-data CRUD — items, parties, accounts.

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
