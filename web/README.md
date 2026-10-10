# BOP Nutraceuticals ERP — TypeScript rewrite

This directory contains the rewrite of the original Python/PySide6 ERP into a
**TypeScript full-stack web application** (Node API + React client). It talks to
the **existing SQLite Cloud database** — the schema, the seeded chart of
accounts and doc formats (e.g. `SI-00002`) are reused unchanged, and the
password hashes stay compatible.

## Why the rewrite

The original is a business/accounting system written in Python with a Qt
desktop GUI, storing money in `REAL` (floating point) columns. An ERP needs
exact money arithmetic, strong typing, real multi-user access and reliable
transactions. TypeScript provides typed contracts end-to-end, and this rewrite
performs all money arithmetic in exact decimal (`decimal.js`), converting to a
number only at the database boundary.

## Layout

```
web/
├── server/                 Node + Express + TypeScript API and business logic
│   ├── src/
│   │   ├── domain/         Enums, errors, exact-decimal money helpers
│   │   ├── db/             SqlDatabase abstraction, schema, bootstrap, adapters
│   │   │   ├── localSqlite.ts     development / tests (node:sqlite, no network)
│   │   │   └── sqliteCloud.ts     the hosted SQLite Cloud database
│   │   ├── repositories/   data access (accounts, journal, sales, stock, ...)
│   │   ├── services/       accounting engine, sales, auth, reports (trial balance, P&L, balance sheet, ledgers)
│   │   ├── http/           Express app and routes
│   │   ├── index.ts        server entry point
│   │   ├── seed.ts         seed local demo data
│   │   └── smoke.ts        end-to-end HTTP smoke test
│   └── tests/              vitest unit + integration tests
└── client/                 React + Vite web client
    └── src/pages/          login, transactions, chart of accounts, reports, users, settings
```

Layering mirrors the original: `views (React) → http → services → repositories → db`.

## Getting started

```bash
cd web
npm install

# development (API on :4000, client on :5173 with /api proxied to the server)
npm run dev

# or individually
npm run dev:server
npm run dev:client
```

Configuration lives in `web/.env` (git-ignored). Copy `.env.example` to start.
By default the server uses a **local SQLite file** (`web/data/dev.sqlite`) so
development never touches production data. To point at the hosted database:

```
ERP_DB_ENGINE=sqlitecloud
SQLITE_CLOUD_URL=sqlitecloud://user:password@host:port/database
```

The hosted database is **never** bootstrapped (no DDL/seed) — only the local
database is created and seeded automatically.

## Verification

```bash
npm run typecheck   # tsc for server and client
npm test            # vitest (money, accounting engine, sales invoice)
npm run smoke       # boots the API against a throwaway DB and drives it over HTTP
npm run build       # production build of the client
```

## Money handling

`server/src/domain/money.ts` is the only place money is arithmetic'd:
`round2`, `sum`, `toStorage`. Values are stored to 2 decimal places half-up,
matching the original rounding but without IEEE-754 drift.

## Compatibility with the Python app

- **Schema**: `server/src/db/schema.ts` is ported verbatim from `database/schema.py`.
- **Password hashing**: PBKDF2-HMAC-SHA256, 200k iterations, 16-byte salt, hex
  encoded — existing users log in unchanged.
- **Voucher numbering**: same `numbering_sequences` upsert-with-`RETURNING`, so
  numbers continue from the existing sequence.
- **System accounts**: resolved by code (`1000`, `1100`, `4000`, ...), never by id.

## Implemented so far

- **Accounting core**: double-entry engine, gap-free voucher numbering, trial
  balance, P&L.
- **Sales invoices**: validation, exact totals, FIFO stock consumption,
  revenue / tax / COGS journal posting, REST API, React UI.
- **Purchase invoices**: validation, exact totals, stock increase (batches),
  inventory/tax/AP journal posting, REST API, React UI.
- **Payments & receipts**: supplier payments (Dr AP / Cr cash-bank) and customer
  receipts (Dr cash-bank / Cr AR) with invoice settlement guards.
- **Manufacturing**: bills of materials and production orders (draft -> start ->
  complete), component consumption and finished-goods posting.
- **Expenses**: categories and vouchers with automatic expense/cash-bank posting.
- **Banking**: bank accounts (linked to COA 1010), deposits/withdrawals and the
  cheque lifecycle (issue/receive/clear/bounce/lose).
- **Returns**: sales and purchase returns with stock reversal and posting.
- **Reports & exports**: balance sheet (assets = liabilities + equity incl. net
  profit), party ledger and cash book with running balances and date filters,
  plus trial-balance CSV download from the Reports page.
- **Users, roles & settings**: user administration (create / edit / disable,
  role assignment, admin password reset), self-service password change, the
  role catalogue and grouped application settings (APPEARANCE, SHORTCUTS) with
  the same `json:` value encoding the Python app writes.
- **Master data**: customers & suppliers (auto CUST-/SUPP- codes, credit limits,
  account linkage rules, open-transaction guard on deactivation), items (auto
  ITEM- codes, units, item types, tax-rate validation) and the chart of accounts
  (sub-accounts, opening balances posted as OPENING entries against Retained
  Earnings, system-account protection).

All of the above are covered by unit/integration tests and the HTTP smoke test.

One deliberate fix over the Python original: the trial balance now includes
**deactivated accounts that still carry posted movement**, so deactivating a
funded account can no longer silently unbalance the report.

## Remaining modules (next passes)

Dashboard, report date-scoping and scheduled export, fixed assets, expense line
items, backups, opening balances/stock, settings extras and global search.
