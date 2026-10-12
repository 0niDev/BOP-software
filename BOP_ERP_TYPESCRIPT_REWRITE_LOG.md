# BOP Nutraceuticals ERP — TypeScript Rewrite: Full Session Log

> Single-file record of the whole coding session: decisions, design contracts,
> implementation details, verification results, and what is still left to port.
>
> - **Session tool:** Freebuff (Buffy agent)
> - **Date:** 2026-10-07 … 2026-10-09
> - **Repo:** `/home/oni/Documents/projects/work/BOP-software`
> - **Branch:** `main` (355 commits; nothing was committed during this session)
> - **New code lives entirely under `web/`** (untracked). The Python project was
>   never modified and the hosted SQLite Cloud database was never written to.

---

## 1. Objective

User's first request: *"read the whole project"* — a ~48k-line Python/PySide6
pharmaceutical ERP — and **recreate the whole project in a language more
appropriate for it**.

Decisions made with the user via multiple-choice prompts:

| # | Question | Chosen answer |
|---|---|---|
| 1 | Target stack | **TypeScript — full-stack web (React + Node)** |
| 2 | Database | **Keep SQLite Cloud (existing hosted DB)** (overriding an earlier Postgres suggestion) |
| 3 | Sequencing | **Vertical slice first**: accounting core + sales, end-to-end |
| 4 | After the slice | **"Continue straight through the rest in original order"** — payments → manufacturing → expenses → banking → returns → reports → users/settings, tests for each, no further per-module prompts |
| 5 | *"can we run the app rn"* | Run it now: seed + start server + client, verify readiness |
| 6 | *"what r the commands to run it"* | Provide the run commands |
| 7 | *"continue"* | Continue the plan: finish reports UI → verify → README → users/settings |
| 8 | *"is everything from python project in the js one"* | Audited both trees and reported the real gap |

---

## 2. The original Python project (source of truth)

- **Scale:** 180 `.py` files, **48,043 lines** total (venvs excluded).
- **Stack:** Python 3.9 + PySide6 (Qt6 desktop GUI) + SQLite Cloud (hosted).
  `views/` alone is ~12,937 lines of Qt view code.
- **Layers:** `models/` → `repositories/` → `services/` → `controllers/` → `views/`.
- **Why rewrite (from the project's own `DATA_FLOW_ANALYSIS.md`):**
  1. money stored as `REAL` floats with manual `round(x, 2)` (IEEE-754 drift),
  2. dict-passing everywhere (no typed contracts),
  3. desktop Qt GUI,
  4. tests require a live cloud DB.
- **Toolchain present:** node v22.22.1, npm 9.2.0, python3 3.14.4.
  **Not installed:** dotnet, bun, deno, go, rustc, java, psql, sqlite3, **Chrome**.
- **Env:** repo-root `.env` has keys `SQLITE_CLOUD_URL`, `ERP_DB_ENGINE`
  (values intentionally never read into this log).
- `node:sqlite` (`DatabaseSync`) works on Node v22 with only an experimental
  warning — used as the local/test database so no network DB is needed.

---

## 3. Compatibility contracts that MUST be preserved

These are the rules the rewrite had to reimplement byte-for-byte so existing
data keeps working.

### 3.1 Password hashing (`utils/security.py`)
- **PBKDF2-HMAC-SHA256, 200,000 iterations, 16-byte random salt,
  hex-encoded salt + hash.**
- Node side: `pbkdf2Sync(plain, salt, 200000, 32, "sha256")`.
- Consequence: the seeded `admin` / `admin123` logs in unchanged.

### 3.2 Voucher numbering (`numbering_sequences`)
Upsert:
```sql
ON CONFLICT(company_id, document_type) DO UPDATE
  SET next_number = next_number + 1
RETURNING prefix, next_number, padding;
```
Format: `prefix + zfill(padding)` (padding = **5**).
Seeded prefixes:

| Document type | Prefix |
|---|---|
| SALES_INVOICE | `SI-` |
| SALES_RETURN | `SR-` |
| PURCHASE_INVOICE | `PI-` |
| PURCHASE_RETURN | `PR-` |
| PAYMENT | `PV-` |
| RECEIPT | `RV-` |
| JOURNAL_VOUCHER | `JV-` |
| OPENING | `OB-` |
| PRODUCTION_ORDER | `PO-` |
| EXPENSE_VOUCHER | `EV-` |
| CUSTOMER | `CUST-` |
| SUPPLIER | `SUPP-` |
| ITEM | `ITEM-` |
| BOM | `BOM-` |

Voucher-type → numbering doc type (from `journal_repository.py`):
SALES→SALES_INVOICE, PURCHASE→PURCHASE_INVOICE, PAYMENT→PAYMENT,
RECEIPT→RECEIPT, JOURNAL→JOURNAL_VOUCHER, OPENING→OPENING,
CUSTOMER→CUSTOMER, SUPPLIER→SUPPLIER, EXPENSE→EXPENSE.

### 3.3 System accounts (`accounting/system_accounts.py`)
Resolved **by code, never by numeric id** — 27 `SYSTEM_ACCOUNTS`:

`1000` Cash in Hand · `1010` Bank Accounts · `1100` Accounts Receivable ·
`1200` Inv-Raw Materials · `1210` Inv-Packing Materials ·
`1220` Inv-Finished Goods · `1300` WHT Receivable · `1500`–`1505` fixed assets
(Fixed Assets, HBL Instalment, Motor Car, Auto Vehicles, Furniture & Fixtures,
Car Sale & Purchase) · `2000` Accounts Payable · `2100` Sales Tax Payable ·
`2200` WHT Payable · `3000` Owner's Equity · `3100` Retained Earnings ·
`4000` Sales Revenue · `4100` Sales Returns · `5000` COGS ·
`5001` Cost of Packing Materials · `5100` Purchase Returns ·
`5200` Manufacturing Wastage Expense · `5300` Inventory Loss ·
`6000` Gen&Admin Expenses · `6100` Selling Expenses.

> `5002` raw-material COGS is **not** always seeded — code falls back to `5000`.

### 3.4 Account balance rule
`get_current_balance` = sums of **posted `journal_entry_lines` only**.
`accounts.opening_balance` is **NOT** added — openings are posted as their own
`OPENING` journal entries, so adding the column would double-count.

### 3.5 Trial balance normality
- Debit-normal: **ASSET, EXPENSE**
- Credit-normal: **LIABILITY, EQUITY, REVENUE**

### 3.6 Schema notes (`database/schema.py`, 763 lines, ~30 tables)
- `journal_entries`: id, company_id, voucher_number, voucher_type, entry_date,
  reference_no, narration, source_table, source_id, is_posted, created_by,
  created_at, **UNIQUE(company_id, voucher_number)**;
  `voucher_type` CHECK IN ('JOURNAL','SALES','SALES_RETURN','PURCHASE',
  'PURCHASE_RETURN','PAYMENT','RECEIPT','MANUFACTURING','STOCK_ADJUSTMENT','OPENING').
- `journal_entry_lines`: id, journal_entry_id, account_id, party_id, debit REAL,
  credit REAL, description, line_order, `CHECK(debit>=0 AND credit>=0)`,
  `CHECK(NOT(debit>0 AND credit>0))`.
- `users`: username UNIQUE, password_hash, password_salt, full_name, email,
  role_id → roles, is_active, last_login_at, created_at.
- `roles`: name UNIQUE, description. `permissions`, `role_permissions` also exist.
- `settings`: company_id + setting_key + setting_group, **UNIQUE(company_id, setting_key)**.

### 3.7 Seed data (`database/migrations/migrator.py`)
company id=1 "My Pharmaceutical Company"; warehouse id=1 `MAIN`/Main Warehouse;
roles Admin, Accountant, Manager, Storekeeper, Production Manager;
27 system accounts; numbering sequences; admin user `admin123`
(only if `users` is empty); settings `theme_name=dark` + shortcut settings.

### 3.8 Posting rules implemented faithfully

**Sales invoice** (`sales_invoice_service.py`):
Dr Cash(1000) / Bank(1010 or the specific `bank_account_id`'s account) / AR(1100,
with `party_id`) = total; Cr Sales Revenue(4000) = subtotal − discount;
Cr Sales Tax Payable(2100) = tax; plus COGS Dr 5000/5001/5002 chosen by item
type (FINISHED_GOOD / PACKING_MATERIAL / RAW_MATERIAL) and Cr inventory
1220/1210/1200. `paid_amount = total` unless `payment_type == CREDIT` (then 0).
BANK/CHEQUE also insert a `bank_transactions` DEPOSIT row.
**Zero COGS → ValidationError.**

**Purchase invoice**: inventory debit split by item type, `line_total`
**including** tax (tax credited back separately to 2100); credit AP(2000, with
`party_id`) or cash(1000)/bank = total − tax. Stock increases; batch
get-or-create by `batch_number`, default `PURCHASE-{item_id}-{timestamp}`;
BANK/CHEQUE inserts a WITHDRAWAL.

**Payments/receipts**: paySupplier = Dr AP(2000, party_id=supplier) Cr cash/bank;
receivePayment = Dr cash/bank Cr AR(1100, party_id=customer).
Guards: reject over-collection, reject receipts on CASH invoices, block
amount > outstanding.

**Manufacturing `complete_production`**: ratio = actual / bom.output_quantity;
per component required = qty × ratio + wastage; consume from
`find_by_item_and_warehouse` batch; Dr 1220 = total cost, Cr 1200 = raw cost,
Cr 1210 = packing cost; **finished-goods output is ADDED to the item's existing
stock batch** (`add_to_batch`) when one exists, else a new batch.

**Expense**: Dr category.account_id (fallback-create 6000) Cr 1000 (CASH) or
1010 (BANK/CHEQUE); voucher_type JOURNAL, source_table `expenses`.

**Banking**: all bank accounts link to the single COA account **1010**.
Opening balance → OPENING entry Dr 1010 Cr 3100. Deposit Dr 1010 Cr 1000;
withdraw Dr 1000 Cr 1010. Cheque clear ISSUED = Dr 2000 (party) Cr 1010;
RECEIVED = Dr 1010 Cr 1100 (party). Statuses UNCLEARED/CLEARED/BOUNCED/LOST.

**Returns**: the Python app had **no create path** (only reversal helpers), so
clean versions were written: sales return Dr 4100 Cr AR/Cash + Dr inventory
Cr 5000; purchase return Dr 2000 Cr inventory. **The web app is ahead here.**

### 3.9 SQLite Cloud Node driver facts (verified from `node_modules` source)
- `@sqlitecloud/drivers` v1.0.982 — `new Database(connectionString)`,
  `db.sql({query, parameters})` or `db.sql(sql, ...params)`.
- **Single serialized connection** → BEGIN/COMMIT is safe; writes return
  `{lastID, changes, ...}`; SELECTs return arrays of rows.
- `SQLiteCloudCommand` is **not** exported (TS error) — workaround:
  `type SqlArgument = Parameters<Database["sql"]>[0]` then cast. Its DataTypes
  union uses `Buffer`, not `Uint8Array`.
- `decimal.js` v10.6.0: **`export default` is broken under NodeNext** — must use
  the **named import** `import { Decimal } from "decimal.js"`.

---

## 4. What was built (`web/`)

**Inventory:** 43 server src files, 12 test files, 18 client src files.
**11,171 lines** (server src + client src + tests) vs Python's 48,043.

### 4.1 Scaffold
- `web/package.json` — npm workspaces (`server`, `client`); scripts:
  `dev`, `dev:server`, `dev:client`, `build`, `typecheck`, `test`, `seed`, `smoke`.
- `web/tsconfig.base.json` — strict + `noUncheckedIndexedAccess`.
- `web/.gitignore`, `web/.env.example`, `web/.env`
  (`ERP_DB_ENGINE=local`, `ERP_LOCAL_DB=./data/dev.sqlite`, `PORT=4000`).
- Server deps: `@sqlitecloud/drivers ^1.0.982`, `cors`, `decimal.js ^10.6.0`,
  `express ^5.2.1`, `zod ^4.6.5`; dev: `tsx`, `typescript ^5.9`, `vitest ^3.2.4`.
  `type: module`, tsconfig NodeNext.
- Client deps: `react`/`react-dom ^19.3`, `vite ^8.3.3`,
  `@vitejs/plugin-react ^6.1.2`; `vite.config.ts` proxies `/api` → `:4000`.

### 4.2 Server source tree
```
server/src/
├── env.ts                     loads web/.env then repo-root .env
├── index.ts                   bootstrap (local only) + listen + shutdown
├── seed.ts                    seeds local demo data (refuses non-local)
├── smoke.ts                   HTTP smoke test (throwaway DB, 38 checks)
├── seedData.ts                seedDemoData() → DemoIds
├── domain/
│   ├── errors.ts              AppError + ValidationError(400) NotFound(404)
│   │                          Conflict(409) Unauthorized(401) Configuration(500)
│   │                          Database(500) InsufficientStock(409)
│   │                          UnbalancedJournalEntry(500)
│   ├── enums.ts               AccountType/PartyType/PaymentMethod/VoucherType/
│   │                          DocumentStatus/ItemType, isDebitNormal,
│   │                          SystemAccountCodes
│   └── money.ts               Decimal (precision 34, ROUND_HALF_UP), dec,
│                              round2, toStorage, sum, multiply, formatAmount,
│                              formatMoney, MONEY_DP=2
├── db/
│   ├── types.ts               SqlDatabase: all/get/run/exec/transaction/close
│   ├── localSqlite.ts         node:sqlite adapter, nested-tx depth counter
│   ├── sqliteCloud.ts         driver adapter + AsyncLocalStorage re-entrant lock
│   ├── index.ts               createDatabase/getDb/closeDb
│   ├── schema.ts              SCHEMA_SQL ported verbatim
│   └── bootstrap.ts           exec SCHEMA_SQL + idempotent seedDefaults
├── repositories/              base, account, systemAccounts (resolver + cache),
│                              journal, party, item, stockBatch, sales,
│                              purchase, payment, manufacturing, expense,
│                              banking, returns, user, settings
├── services/                  accounting, auth, salesInvoice, purchaseInvoice,
│                              payment, manufacturing, expense, banking,
│                              returns, report, settings, user
└── http/app.ts                Express app + all routes
```

### 4.3 Client source tree
```
client/src/
├── main.tsx, App.tsx          Page union + routing
├── api.ts                     typed fetch wrapper, ApiError, localStorage token
│                              (bop-erp.token / bop-erp.user)
├── types.ts                   API shapes
├── styles.css                 dark theme, --accent:#8b1a2b, card/row/table/num/badge
├── components/Layout.tsx      sidebar nav + topbar
└── pages/                     LoginPage, SalesInvoicesPage, PurchaseInvoicesPage,
                               PaymentsPage, ManufacturingPage, ExpensesPage,
                               BankingPage, ReturnsPage, AccountsPage,
                               TrialBalancePage (Reports), UsersPage, SettingsPage
```

### 4.4 All API routes
`GET /api/health` · `POST /api/auth/login` · `POST /api/auth/change-password`

`GET /api/accounts` · `GET /api/parties?type=` · `GET /api/items`

Sales: `GET|POST /api/sales-invoices`, `GET /api/sales-invoices/:id`
Purchases: `GET|POST /api/purchase-invoices`, `GET /api/purchase-invoices/:id`
Payments: `GET|POST /api/payments`, `GET|POST /api/receipts`
Manufacturing: `GET|POST /api/boms`, `GET /api/boms/:id`,
`GET|POST /api/production-orders`, `GET /api/production-orders/:id`,
`POST /api/production-orders/:id/start|/complete`
Expenses: `GET|POST /api/expense-categories`, `GET|POST /api/expenses`
Banking: `GET|POST /api/bank-accounts`, `GET /api/bank-accounts/:id/balance`,
`GET /api/bank-transactions`, `POST .../deposit`, `POST .../withdraw`,
`GET /api/cheques`, `POST /api/cheques/issue|/receive`,
`POST /api/cheques/:id/clear|/bounce|/lose`
Returns: `GET|POST /api/sales-returns`, `GET|POST /api/purchase-returns`
Journal: `GET /api/journal-entries/:sourceTable/:sourceId`
Reports: `GET /api/reports/trial-balance`, `.../profit-and-loss`,
`.../balance-sheet`, `.../party-ledger?partyId=&from=&to=`,
`.../cash-book?from=&to=`, `.../trial-balance.csv`
Administration: `GET|POST /api/users`, `PUT /api/users/:id`,
`POST /api/users/:id/reset-password`, `GET /api/roles`,
`GET /api/settings`, `PUT /api/settings`, `DELETE /api/settings/:group`

### 4.5 Tests
`server/tests/`: `helpers/db.ts` (`freshDb()` → in-memory + `seedDemoData`),
`money`(5), `accounting`(5), `salesInvoice`(5), `purchaseInvoice`(5),
`payment`(4), `manufacturing`(4), `expense`(4), `banking`(6), `returns`(3),
`report`(5), **`user`(11)**.

### 4.6 Data-flow notes from this session
- Sessions are an in-memory `Map` (token = `randomUUID`, 12h TTL) behind a
  `requireAuth` Bearer middleware.
- `insertRow()` falls back to `last_insert_rowid()` when the driver omits it.
- `NewUser` is a **type alias, not an interface**, so TypeScript gives it an
  implicit index signature and it can be passed straight to `insertRow`.
- Settings values use Python's `json:` prefix tag for objects/lists
  (`json:{"accent":"#8b1a2b"}`) so both apps can read each other's rows.

---

## 5. Verification history (all exit 0)

| Stage | Check | Result |
|---|---|---|
| After accounting + sales slice | typecheck, tests, smoke, client build | all pass |
| After reports server work | typecheck 0 · tests **46/46** (10 files) | pass |
| After reports client UI | `npm run typecheck` **0** | pass |
| | `npm test` **46/46** | pass |
| | `npm run smoke` **0**, 24 PASS | pass |
| | client `tsc && vite build` **0** | pass |
| Live endpoints (reports) | balance-sheet 200 `{assets:501,liabilities:1,equity:500,netProfit:500,balanced:true}`, party-ledger 200, cash-book 200, trial-balance.csv 200 `text/csv; charset=utf-8` 28 rows | pass |
| After users/roles/settings | `npm run typecheck` **0** | pass |
| | `npm test` **57/57** (11 files) | pass |
| | `npm run smoke` **0**, **38 PASS / 0 FAIL** (14 new admin checks) | pass |
| | client `tsc && vite build` **0**, 30 modules, 277.35 kB (gzip 78.34) | pass |
| Live admin endpoints | `GET /api/roles` 200 · `/api/users` 200 · `/api/settings` 200 | pass |
| Vite compiles new pages | `TrialBalancePage.tsx` 200 · `UsersPage.tsx` 200 · `SettingsPage.tsx` 200 | pass |

Smoke checks include: health, login, session, 401 on missing session, parties,
sales invoice (201, total 750), journal posted, trial balance balanced 1250/1250,
P&L revenue 750 / COGS 500 / net 250, purchase 200, receipt RV-00002, expense
category + EV-00002, then the admin block: roles, user list without password
material, create user 201, duplicate username 409, update role 200, password
reset + re-login 200, wrong current password 401, change-password 200,
settings grouped (theme dark), settings write/read-back, invalid theme 400.

---

## 6. How to run it

```bash
cd web
npm install        # first time only
npm run seed       # demo data → web/data/dev.sqlite
npm run dev        # server :4000 + client :5173 together
```

Open **http://localhost:5173** and log in with **`admin` / `admin123`**.

Separately:
```bash
npm run dev:server   # API on :4000
npm run dev:client   # Vite on :5173
```

Quality gates:
```bash
npm run typecheck    # tsc server + client
npm test             # vitest (57 tests)
npm run smoke        # end-to-end HTTP against a throwaway DB
npm run build        # production build of both
```

**Live state during this session:** server PID 8862 (`tsx watch`) and client
PID 8864 (Vite) running in the background; logs at `/tmp/bop-server.log` and
`/tmp/bop-client.log`. Both on the **local** SQLite engine — the hosted
SQLite Cloud DB is not touched.

---

## 7. WHAT IS LEFT TO PORT

### ⚠️ Partially ported
| Python module | Gap in web |
|---|---|
| `views/widgets/report_view.py` — trial balance **with From/To and opening/closing balances**, P&L **by period**, balance sheet **as at a date**, plus **scheduled export (frequency/period)** | web trial balance / P&L / balance sheet are "all posted entries" (no date scoping); CSV is a manual download only |
| `views/widgets/settings_view.py` (695 lines) — appearance, **shortcut editor**, company profile, other groups | web has theme + change password only; shortcuts are stored but have no editor UI |
| `services/expense_item_service.py` — itemised expense items (`list_items`, `create_item`, `update_item`, `delete_item`, `pay_items`) + `views/widgets/expense_items_dialog.py` | web has a flat expense + category only |

### ❌ Not ported at all
1. **Master-data CRUD — the biggest gap.**
   - `services/item_service.py` + `controllers/item_controller.py`:
     `create_item`, `update_item`, `deactivate_item`, `get_tax_rates_for_dropdown`,
     **`add_opening_stock`** → web has `GET /api/items` only, **no item page**.
   - `services/party_service.py` + `party_controller.py`:
     `create_party`, `update_party`, `deactivate_party` → `GET /api/parties`
     only, **no party page** (customers/suppliers cannot be created).
   - `services/account_service.py` + `account_controller.py`:
     `create_account`, `update_account`, `deactivate_account`, `get_balance`
     → `GET /api/accounts` only, **no account page**.
2. **Dashboard** — `views/widgets/dashboard_view.py` +
   `services/dashboard_service.py` (~650 lines: today/monthly summary,
   balances, receivables/payables, inventory summary, alerts, recent
   transactions, 6-month trend, caching). The web app opens on Sales Invoices.
3. **Fixed assets** — `views/widgets/asset_view.py` (accounts 1500–1505 are
   seeded but there is no asset register / depreciation / disposal flow;
   root `.env.example` even carries `DEPRECIATION_MAX_YEARS`).
4. **Backups** — `views/widgets/backup_view.py`,
   `controllers/backup_controller.py` (`backup_all`, `backup_local`,
   `get_backup_status`, `restore_backup`) and `services/auto_backup.py`
   (24-hour scheduled backup thread).
5. **Opening balance / opening stock dialogs** —
   `views/widgets/opening_balance_dialog.py`, `opening_stock_dialog.py`
   (the `OB-` numbering sequence is seeded but unused).
6. **Global search** — `views/widgets/search_bar.py` (cross-entity search).
7. **Dashboard-side dialogs** — `expense_items_dialog` covered above; the
   `search_bar` and `dashboard` account for the two biggest missing screens.

### ✅ Already ahead of Python
- Sales & purchase **returns**: the Python app only had reversal helpers; the
  web app has real create paths (server + client + 3 tests).
- Balance sheet, party ledger and cash book exist as first-class tested
  endpoints (Python had them only inside the Qt report view).

### Suggested order for the remaining passes
1. Items / parties / accounts CRUD (unblocks every screen — you currently
   cannot add a customer, item or account).
2. Dashboard.
3. Report date scoping (TB/P&L/BS) + scheduled export.
4. Fixed assets.
5. Expense line items.
6. Backups + auto-backup.
7. Opening balances / opening stock.
8. Settings extras (shortcut editor, company profile) + global search.

---

## 8. Deviations from the Python app (deliberate, documented)

1. **Duplicate username returns HTTP 409** (`ConflictError`) where the Python
   app raised `ValidationError` (400). Chosen as the more correct HTTP semantic;
   every other validation still returns 400 to match Python.
2. **Returns creation** is implemented (Python had none) — see §3.8.
3. Session tokens are **in-memory** (no DB session table), 12h TTL, lost on
   restart — the Python desktop app had no equivalent concept.

---

## 9. Limitations & environment constraints

- **No real-browser DOM test** — Chrome is not installed on this machine, so
  the client is verified via TypeScript, the production build, Vite compiling
  each page, and full HTTP coverage of every endpoint those pages call. It has
  **not** been clicked through in a browser.
- **Live SQLite Cloud never exercised** — deliberately avoided so no write ever
  reaches production data. The `sqliteCloud.ts` adapter exists and typechecks.
- **Theme persists but does not switch visually** — the client ships one dark
  CSS theme; `theme_name` is stored and validated (invalid theme → 400) but
  there is no light/system/custom rendering yet.
- **Demo data is thin** — one customer, one item, one batch, so screens look
  sparse until records are created (`npm run seed`).
- Starting a second copy on the same ports fails with `EADDRINUSE`; stop the
  running processes first.
- Shell note: `cd web/server` from a `web` cwd failed once; most commands run
  from the repo root as `cd web && …`.

---

## 10. Git state

```
$ git status --porcelain
?? BOP_ERP_TYPESCRIPT_REWRITE_LOG.md   (this file)
?? freebuff-chat-2026-10-07T21-54-07.857Z.md   (client-generated transcript)
?? web/                                (the entire rewrite)
```
- **No tracked file was modified.** The Python project is byte-for-byte
  untouched; the rewrite lives in an untracked directory.
- Nothing was committed, pushed, or deployed during this session.
- The hosted SQLite Cloud database was never written to.

---

## 11. Command reference (copy-paste)

```bash
# --- run -------------------------------------------------------------
cd web && npm install && npm run seed && npm run dev
#     → http://localhost:5173   (admin / admin123)

# --- separate processes ----------------------------------------------
cd web && npm run dev:server     # API   :4000
cd web && npm run dev:client     # Vite  :5173

# --- verification ----------------------------------------------------
cd web && npm run typecheck      # exit 0
cd web && npm test               # 11 files, 57 tests
cd web && npm run smoke          # 38 PASS / 0 FAIL
cd web && npm -w @bop-erp/client run build

# --- manual API probe ------------------------------------------------
curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'
curl -s http://localhost:4000/api/reports/trial-balance \
  -H "Authorization: Bearer $TOKEN"
```

---

*End of session log.*
