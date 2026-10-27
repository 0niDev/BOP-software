# BOP Nutraceuticals ERP — web application documentation

This is the documentation set for the **web application** in `web/`: a
TypeScript rewrite of the original Python/PySide6 desktop ERP. It runs as a
Node.js API plus a React client, over the same SQLite database schema the
desktop app uses (locally, or on hosted SQLite Cloud).

The desktop app in `python/` is documented separately in
[`python/README.md`](../../python/README.md) and
[`python/IMPORT_DOCUMENTATION.md`](../../python/IMPORT_DOCUMENTATION.md).

## Documentation map

| Document | What it covers |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Runtime modes, layers, request lifecycle, configuration, database abstraction, authentication, money and numbering |
| [DATA_MODEL.md](DATA_MODEL.md) | Every table, relationships, invariants, system accounts, numbering sequences and settings keys |
| [API.md](API.md) | HTTP conventions, error model and the complete endpoint reference |
| [MODULES.md](MODULES.md) | Business rules and journal postings for every functional module |
| [FRONTEND.md](FRONTEND.md) | Application shell, pages, components, design system, theming, shortcuts |
| [TESTING.md](TESTING.md) | Unit/integration suites, the browser UI audit, the HTTP smoke test and CI |
| [OPERATIONS.md](OPERATIONS.md) | Health, logs, backups, failure modes, security posture and known limitations |
| [DEPLOYMENT.md](../DEPLOYMENT.md) | The Windows single-process install, upgrade and rollback runbook |
| [README.md](../README.md) | Short project intro, layout and getting started |

If you are new to the codebase, read this page, then ARCHITECTURE, then the
module you are about to touch in MODULES.md. DATA_MODEL and API are references.

## What the application does

One company's pharmaceutical/nutraceutical books, end to end:

- **Sales & purchasing** — sales invoices, purchase invoices and sales/purchase
  returns.
- **Inventory & production** — items (raw, packing, finished goods) with stock
  levels and batches, BOMs and production/packing orders.
- **Accounting** — payments & receipts, expense vouchers (including recurring
  "pay items"), bank & cash (accounts, deposits/withdrawals, cheque lifecycle)
  and manual journal vouchers.
- **Master data** — chart of accounts, customers & suppliers, tax rates, fixed
  assets, users and roles.
- **Insight** — a dashboard of KPIs and alerts, trial balance, profit & loss,
  balance sheet, party ledger and cash book, each exportable as CSV or Excel.
- **Administration** — users, password changes, appearance, company profile,
  keyboard shortcuts, read-only database info and local-engine backups.

Every document that moves money writes exactly one balanced journal entry in
the same database transaction, so the reports can never disagree with the
documents.

## Stack at a glance

| Layer | Technology |
| --- | --- |
| Server | Node.js 22, Express 5, TypeScript 5.9 |
| Validation | Zod 4 schemas at the HTTP boundary |
| Money | `decimal.js` (34-digit precision, round half-up to 2 dp) |
| Database | Local `node:sqlite` file **or** hosted SQLite Cloud (`@sqlitecloud/drivers`) behind one interface |
| Client | React 19, Vite 8, Tailwind CSS v4 (utilities only), Framer Motion, Lucide, Recharts |
| Tests | Vitest (server), Playwright (browser audit) |
| Packaging | npm workspaces (`server`, `client`); one Node process serves both in production |

## Runtime modes

There are three ways the app runs, and the difference matters when debugging:

| Mode | Command | API | Client | Database |
| --- | --- | --- | --- | --- |
| Development | `npm run dev` | `:4000` | Vite `:5173`, proxies `/api` | `web/data/dev.sqlite` |
| Tests | `npm test`, `npm run test:e2e` | ephemeral (`:4100` for e2e) | Vitest / Chromium | throwaway local files |
| Production | `node server/dist/index.js` with `ERP_SERVE_CLIENT=1` | one port (`:4000`) | same process serves `client/dist` | usually SQLite Cloud |

The database engine is chosen by `ERP_DB_ENGINE`; the client never talks to the
database directly. See [ARCHITECTURE.md](ARCHITECTURE.md#database-layer).

## Quick start

```bash
cd web
npm install
cp .env.example .env          # defaults to a local SQLite file
npm run seed:rich             # optional demo data (refuses non-local engines)
npm run dev                   # API :4000, client :5173
```

A freshly bootstrapped *local* database seeds the administrator **`admin` /
`admin123`**. The hosted database has its own users, but the legacy default is
known from the desktop app — if it was ever used there, change it before go-live
(see [DEPLOYMENT.md](../DEPLOYMENT.md#security-checklist-before-go-live)).

On a fresh Windows machine, `web\setup.bat` does all of the above (installs
Node 22 via winget if needed, creates `.env`, runs the smoke test, offers demo
data and can start the app).

## Configuration reference

`web/.env` is the **only** environment file the web app reads (the repository
root and `python/` files are ignored). Environment variables already set in the
process win over the file. Every key is read once at startup, so changes need a
restart.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ERP_DB_ENGINE` | `local` | `local` or `sqlitecloud`; anything else falls back to `local` |
| `ERP_LOCAL_DB` | `./data/dev.sqlite` | Local database file (resolved against `web/`) |
| `SQLITE_CLOUD_URL` | — | `sqlitecloud://user:password@host:port/database`; required when the engine is `sqlitecloud` |
| `ERP_HOST` | `0.0.0.0` | Bind address. Use `127.0.0.1` behind a reverse proxy |
| `PORT` | `4000` | HTTP(S) port |
| `ERP_SERVE_CLIENT` | off | `1`/`true`/`yes`/`on` serves `client/dist` from the same process and enables the SPA fallback |
| `ERP_CLIENT_DIST` | `./client/dist` | Where the built client lives (resolved against `web/`) |
| `ERP_TLS_CERT`, `ERP_TLS_KEY` | — | Set **both** to terminate HTTPS in-process; setting one is a startup error |
| `ERP_BACKUP_DIR` | `./backups` | Snapshot directory; the live copy lives in `live/` under it |
| `ERP_BACKUP_KEEP` | `7` | Named snapshots to keep; `0` keeps everything |
| `ERP_DESKTOP_DIR` | `<home>/Desktop/desktop` | Extra copy of every snapshot on this machine's desktop |
| `ERP_AUTO_BACKUP_HOURS` | `0` (off) | Extra named-snapshot interval; both engines |
| `ERP_LIVE_MIRROR` | on | Continuously refreshed portable copy (`backups/live/erp_mirror.db`); `0` disables |
| `ERP_MIRROR_DEBOUNCE_SECONDS` | `15` | Idle gap before the live copy is rewritten |
| `ERP_PC_MIRROR_DIR` | — | Mapped drive or UNC folder; the live copy is pushed there after each refresh |
| `ERP_COMPANY_ID` | `1` | Company used by every service and query |
| `ERP_WAREHOUSE_ID`, `ERP_CURRENCY`, `ERP_API_KEY` | `1`, `PKR`, empty | Parsed into `env` but not consumed by any route yet (reserved) |

Test-only: `ERP_CLOUD_TEST=1` plus `SQLITE_CLOUD_URL` enables the opt-in hosted
database test (see [TESTING.md](TESTING.md#hosted-sqlite-cloud-test-opt-in)).

`.env` is git-ignored; `.env.example` is the tracked template. Never commit real
credentials, and never point a development machine at production data unless you
mean it.

## Repository map

```
web/
├── package.json              npm workspaces + the scripts below
├── .env.example              configuration template
├── README.md                 short intro        DEPLOYMENT.md  Windows runbook
├── docs/                     this documentation set
├── deploy/windows/           deploy / install-service / uninstall / run-foreground .bat
├── e2e/                      Playwright UI audit (`npm run test:e2e`)
├── e2e-sweep/                optional button sweep against a running dev stack
├── data/                     git-ignored SQLite files (dev.sqlite, e2e.sqlite)
├── server/
│   ├── src/
│   │   ├── env.ts            configuration (loads web/.env once)
│   │   ├── index.ts          entry point: db, bootstrap, TLS, HTTP, shutdown
│   │   ├── domain/           enums, errors, money, date validation, shortcuts
│   │   ├── db/               SqlDatabase interface, schema, bootstrap, adapters
│   │   ├── repositories/     SQL access per aggregate
│   │   ├── services/         business rules and journal posting
│   │   ├── http/app.ts       Express routes, sessions, static client, errors
│   │   ├── seed.ts           demo data (`--rich` for the full set)
│   │   ├── smoke.ts          HTTP smoke test
│   │   └── qaDataflow.ts, reconcile.ts, trialBalanceDemo.ts   one-off tools
│   ├── tests/                Vitest suites (one file per module + acceptance)
│   └── tsconfig.json
└── client/
    ├── index.html, vite.config.ts, tsconfig.json
    ├── public/fonts/         self-hosted Plus Jakarta Sans
    └── src/
        ├── main.tsx, App.tsx page switch, authentication gate
        ├── api.ts            one typed method per endpoint + session handling
        ├── types.ts          API response types
        ├── theme.ts          theme resolution   shortcuts.ts  shortcut binding
        ├── styles.css        Tokens + ERP component layer (unlayered CSS)
        ├── pages/            one file per module (15 pages)
        ├── components/       ui/, layout/, dashboard/, SearchableSelect, FilterBox
        └── lib/              formatting, downloads, hooks
```

## Conventions used everywhere

- **Dates** are `YYYY-MM-DD` strings, validated at the API (real calendar dates
  only) and in the client with `<input type="date">`. There is no time component
  for business dates.
- **Money** is stored in SQLite `REAL` for compatibility with the desktop app,
  but arithmetic happens in `Decimal` and every persisted amount is rounded
  half-up to 2 dp (`toStorage`). Quantities keep 6 dp (`toQuantity`).
- **Identifiers** in JSON responses are the column names the database uses
  (`snake_case`) for rows, while computed payloads and request bodies use
  `camelCase`. Client types in `types.ts` mirror the actual responses.
- **Soft deletes**: master data is deactivated (`is_active = 0`), never deleted.
  A deactivated account still carrying movement stays in the trial balance.
- **Journal entries** are append-only. Nothing exposes a "delete entry" route;
  corrections are new documents/entries.
- **Voucher numbers** come from `numbering_sequences` inside the same
  transaction as the document, so a failed create does not burn a number.

## Glossary

| Term | Meaning here |
| --- | --- |
| **Party** | A customer, supplier, or both; carries an optional AR/AP account link |
| **Voucher** | The accounting document number (`SI-`, `PI-`, `PV-`, `RV-`, `JV-`, `OB-`, `PO-`, `PCO-`, `EV-`, `SR-`, `PR-`) |
| **OPENING** | Journal entry that gives an account, item or bank account its starting balance |
| **COGS** | Cost of goods sold, recognised from the FIFO cost of the batches a sale consumed |
| **FIFO** | Stock consumption order: earliest `received_date` first |
| **Batch** | A stock lot for one item in one warehouse, with cost, expiry and quantity |
| **BOM** | Bill of materials: finished item + output quantity + component quantities and wastage |
| **Unpacked item** | The `(Unpacked) <BOM name>` finished good a formulation BOM creates for the bulk its production run makes |
| **Packing order** | An independent order that turns unpacked bulk plus packing materials into a finished good (`PCO-`) |
| **Pay items** | Recurring expense items under a category; paying them creates one expense voucher each |
| **Session** | Opaque bearer token kept in an in-memory `Map` (12 h TTL), lost on restart |
