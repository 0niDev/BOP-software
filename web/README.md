# BOP Nutraceuticals ERP — TypeScript rewrite

This directory contains the rewrite of the original Python/PySide6 ERP into a
**TypeScript full-stack web application** (Node API + React client). It talks to
the **existing SQLite Cloud database** — the schema, the seeded chart of
accounts and doc formats (e.g. `SI-00002`) are reused unchanged, and the
password hashes stay compatible.

## Documentation

The full documentation set lives in **[docs/](docs/)**. Start with
[docs/README.md](docs/README.md) for the overview and document map, then:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layers, request lifecycle,
  database adapters, authentication, money and numbering
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — tables, relationships, enums,
  system accounts, numbering sequences, settings keys
- [docs/API.md](docs/API.md) — every endpoint, with bodies and error codes
- [docs/MODULES.md](docs/MODULES.md) — business rules and journal postings per
  module
- [docs/FRONTEND.md](docs/FRONTEND.md) — shell, pages, design system, shortcuts
- [docs/TESTING.md](docs/TESTING.md) — unit/integration, smoke, browser audit, CI
- [docs/OPERATIONS.md](docs/OPERATIONS.md) — health, logs, backups, failure
  modes, security posture, known limitations

This README stays the short introduction; [DEPLOYMENT.md](DEPLOYMENT.md) is the
Windows deployment runbook.

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
│   │   ├── seed.ts         seed local demo data (`--rich` for the full set)
│   │   └── smoke.ts        end-to-end HTTP smoke test
│   └── tests/              vitest unit + integration tests
└── client/                 React + Vite web client
    ├── public/fonts/       self-hosted Plus Jakarta Sans (woff2)
    └── src/
        ├── pages/          login, dashboard, transactions, chart of accounts, reports, users, settings
        ├── components/     ui/ (design-system primitives), layout/ (sidebar, topbar), dashboard/ (widgets)
        ├── lib/format.ts   money / compact / percent / initials helpers
        └── styles.css      Tailwind entry + theme tokens + ERP component layer
```

Layering mirrors the original: `views (React) → http → services → repositories → db`.

## Client design system

The client is **Tailwind v4 (utilities only) + Framer Motion + Lucide + Recharts**
on top of the ERP component layer in `client/src/styles.css`. Tailwind's preflight
is deliberately **not** imported: fifteen module screens are styled by the
unlayered rules in that file, and a global reset would restyle all of them. New
UI (the shell and the dashboard) is written with utilities; anything that is
controlled by an element rule — buttons, inputs, tables, headings — keeps a
class-based variant (`.icon-btn`, `.sort-btn`, `.num`, `.pill`, `.meter`, `.menu`,
`.thumb`, `.search-field`) because unlayered CSS outranks the utility layer.

- **Tokens** live in `styles.css`: `:root` is the dark palette, `:root[data-theme="light"]`
  the light one (slate surface `#F4F6FB`, royal blue `#2563EB`, teal `#0D9488`,
  amber). They are re-exported to Tailwind via `@theme inline`, so `bg-surface`,
  `text-muted`, `border-line`, `rounded-card` and `shadow-float` follow the
  Appearance setting instead of baking in a colour. Status colours ship `-ink`
  text variants so 12px labels clear WCAG AA in both themes.
- **Type**: Plus Jakarta Sans, self-hosted in `client/public/fonts` — no network
  at runtime and no font-fetch errors in the console.
- **Motion**: every dashboard widget fades and slides up once, staggered so the
  whole grid settles in under half a second, and all of it is skipped under
  `prefers-reduced-motion`.
- **Charts** are Recharts inside `components/ui/ChartFrame.tsx`, which owns the
  fixed height a `ResponsiveContainer` needs.

## Getting started

### Fresh Windows machine

Double-click **`web\setup.bat`** (or run `web\setup.bat` from a command
prompt). It installs Node.js 22 LTS through winget when Node is missing or too
old, installs the npm dependencies, creates `web\.env` from the template (local
SQLite by default, with an optional prompt to configure the hosted database),
verifies the installation with `npm run smoke`, optionally seeds demo data, and
can start the app. No other prerequisites are needed.

### Manual setup

```bash
cd web
npm install
npm run seed:rich   # optional: load the full demo transaction set

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

## Deployment

Production runs as **one Windows service on one port**: the Node process serves
both `/api` and the built React client. `deploy/windows/` holds the scripts
(`deploy.bat`, `install-service.bat`, `uninstall-service.bat`,
`run-foreground.bat`) and **[DEPLOYMENT.md](DEPLOYMENT.md)** is the runbook —
prerequisites, environment keys, service management, upgrades and rollback, and
the pre-go-live security checklist.

Set `ERP_SERVE_CLIENT=1` (after `npm run build`) to have the API process serve
`client/dist`; `/api/*` still answers with JSON 404s, and every other path falls
back to `index.html` for the SPA.

## Verification

```bash
npm run typecheck   # tsc for server and client
npm test            # vitest, incl. the rich-demo acceptance audit
npm run smoke       # boots the API against a throwaway DB and drives it over HTTP
npm run build       # production build of the client
npm run test:e2e    # browser UI audit (Chromium; see below)
```

### Browser UI audit

`npm run test:e2e` drives every page in Chromium against a throwaway database
seeded with the rich demo data (`data/e2e.sqlite`, ports 4100/5273 so it never
collides with `npm run dev`) and fails on console/API errors, horizontal
overflow, text clipped by a fixed-size container, controls that overlap or are
too small to hit, tables without header cells, `.num` columns that are not
right-aligned, and pages that stay empty although the demo data has content. It
also types a nonsense filter into every page that has one to check the empty
states, and exercises the keyboard shortcuts in a real browser. A full-page
screenshot per page is written to `web/e2e/.artifacts/` for review.

One-time setup: `npx playwright install chromium`.

All five commands run in CI (`.github/workflows/ci.yml`) on every push to
`main` and every pull request, in two jobs: the server/client checks and the
browser audit (which uploads its screenshots as an artifact).

The hosted SQLite Cloud adapter is covered by an **opt-in** integration test that
is skipped by default. Point it at a *scratch* database (never production):

```bash
SQLITE_CLOUD_URL='sqlitecloud://user:pass@host:port/scratch' ERP_CLOUD_TEST=1 \
  npx vitest run --root server tests/sqliteCloud.test.ts
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
  complete), component consumption and finished-goods posting, plus one-use
  "temporary production" orders that create a hidden, never-listed BOM.
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
  the same value encoding the Python app writes. The Settings page also has the
  keyboard-shortcut editor (module jumps, module next/previous and the search
  box are live in the browser) and a read-only Database card showing the engine,
  connection and SQLite version.
- **Master data**: customers & suppliers (auto CUST-/SUPP- codes, credit limits,
  account linkage rules, open-transaction guard on deactivation), items (auto
  ITEM- codes, units, item types, tax-rate validation) and the chart of accounts
  (sub-accounts, opening balances posted as OPENING entries against Retained
  Earnings, system-account protection).

All of the above are covered by unit/integration tests and the HTTP smoke test.

One deliberate fix over the Python original: the trial balance now includes
**deactivated accounts that still carry posted movement**, so deactivating a
funded account can no longer silently unbalance the report.

## Remaining work (next passes)

- **Role-based authorization** — roles exist but no route enforces them; every
  signed-in user is effectively an administrator.
- **Audit trail** — the `audit_log` table exists but nothing writes it.
- **Global search** — the top-bar search currently filters modules; there is no
  cross-entity search.
- **Stock adjustments and losses** — `stock_losses` exists, with no screen or
  route.
- **Scheduled / emailed exports** — reports are downloaded manually.
- **Per-bank-account ledger** — every bank account shares COA `1010`, so
  per-account balances and funds checks are combined (see
  [docs/OPERATIONS.md](docs/OPERATIONS.md#known-functional-limitations)).

See [docs/OPERATIONS.md](docs/OPERATIONS.md) for the complete list of known
functional limitations and security gaps.
