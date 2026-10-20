# Testing and verification

Five layers, each catching a different class of defect. Run the fast three
before every commit; CI runs all of them.

| Layer | Command | What it proves |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | Server, client and e2e TypeScript compile |
| Unit/integration | `npm test` | Business rules, postings, repositories against a real SQLite database |
| HTTP smoke | `npm run smoke` | A real server boots and the core flow works over HTTP |
| Production build | `npm run build` | Server and client compile/bundle |
| Browser audit | `npm run test:e2e` | Every page renders and behaves in Chromium |

There are no mocks of the database: every test runs against a real SQLite
database (in memory or a throwaway file), which is the main reason the suite is
trustworthy — and why it takes ~45 s.

## Unit and integration tests (Vitest)

```bash
cd web
npm test                 # all suites, once
npm -w @bop-erp/server run test:watch
```

Configuration: `server/vitest.config.ts` includes `tests/**/*.test.ts`, uses the
Node environment, and loads `tests/setup-env.ts` first. That setup forces
`ERP_DB_ENGINE=local`, overriding `web/.env`, so a developer whose `.env` points
at SQLite Cloud can never run the suite against production data.

`tests/helpers/db.ts` provides:

- `freshDb()` — a new in-memory database with the schema, default seed data and
  the demo dataset;
- `accountId(db, code)` — resolve a system account id by code;
- `closeDb(db)`.

A typical test builds services directly (`new SalesInvoiceService(db)`) and
asserts both the document and the journal entry. Route-level behaviour is
covered by the smoke test and the browser audit rather than by HTTP tests in
Vitest.

### Suites

| File | Covers |
| --- | --- |
| `money.test.ts` | Rounding, storage limits, quantity precision, formatting |
| `accounting.test.ts` | Balanced/unbalanced entries, voucher numbering, trial balance |
| `salesInvoice.test.ts` | Totals, FIFO stock, COGS, payment types, numbering, failures |
| `purchaseInvoice.test.ts` | Batches, cost split by item type, tax, duplicate numbers |
| `payment.test.ts` | Payments/receipts, allocations, overpayment guards, duplicate protection, bank funds |
| `returns.test.ts` | Sales/purchase returns, stock restoration, over-return guard |
| `manufacturing.test.ts` | BOM validation, temporary BOMs, production lifecycle, consumption |
| `expense.test.ts`, `expenseItem.test.ts` | Categories, vouchers, pay-items bulk payment |
| `banking.test.ts` | Accounts, deposits/withdrawals, cheque lifecycle, negative-balance guard |
| `asset.test.ts` | Asset creation, account reuse, payment types, validation |
| `masterdata.test.ts` | Parties and items: codes, validation, deactivation guards |
| `accounting` / `report.test.ts` | Trial balance, P&L, balance sheet, ledgers, CSV |
| `reportXlsx.test.ts` | Workbooks unzipped and read back: sheets, shared strings, numeric cells |
| `backup.test.ts` | Local snapshots, filename safety, restore refusal, cloud refusal |
| `serveClient.test.ts` | Single-process mode: `/`, assets, cache headers, SPA fallback, JSON API 404s, API-only fallback |
| `settings.test.ts` | Settings groups, appearance validation, shortcuts |
| `user.test.ts` | User CRUD, roles, password reset/change, hashing |
| `acceptance.test.ts` | Rich demo dataset: every headline report recomputed from raw journal lines with SQL and compared against the services; dashboard and sub-ledgers tied to control accounts |
| `fixes.test.ts` | Regression tests for past defects: sequence reconciliation, COGS mapping, quantity precision, payment references, bank guards |
| `sqliteCloud.test.ts` | **Skipped by default** — the hosted adapter, opt-in |

Current baseline: **21 files passed, 1 skipped; 142 tests passed, 5 skipped.**

### Hosted SQLite Cloud test (opt-in)

```bash
SQLITE_CLOUD_URL='sqlitecloud://user:pass@host:port/scratch' ERP_CLOUD_TEST=1 \
  npx vitest run --root server tests/sqliteCloud.test.ts
```

It builds its own connection from the URL and never uses `getDb()`. Point it at
a **scratch** database: it creates and drops tables. Without
`ERP_CLOUD_TEST=1`, the file is skipped, so the hosted adapter is not covered by
a normal `npm test` run.

## HTTP smoke test

```bash
cd web
npm run smoke
```

`server/src/smoke.ts` sets `ERP_LOCAL_DB` to a per-PID throwaway file *before*
importing configuration, seeds the demo data, boots the real Express app on an
ephemeral port and drives it as a browser would: health, login, reads, creates
(sales invoice, payment, etc.), reports, journal entry, exports and backup
status. It asserts absolute values (safe because the database starts empty),
prints one `PASS`/`FAIL` line per check, and exits non-zero on any failure. A
separate throwaway backup directory is used so it never litters `web/backups`.

## Browser UI audit (Playwright)

```bash
cd web
npx playwright install chromium   # once
npm run test:e2e
```

`playwright.config.ts` boots both servers itself:

- API: `npm run seed:rich && npm run -w @bop-erp/server run dev` on port 4100,
  using `data/e2e.sqlite` with `ERP_DB_ENGINE=local`. The seed is idempotent: it
  adds the rich dataset when absent and is a no-op when it is already there, so
  the file persists between runs (delete it for a pristine audit database);
- client: Vite on port 5273 with `API_URL` pointed at 4100;
- viewport 1440×900, one worker, traces kept on failure.

`e2e/ui-audit.spec.ts` runs 23 tests:

| Test | Checks |
| --- | --- |
| `renders <page>` × 15 | Every page loads with no console/page errors, no failed or 4xx API calls, no horizontal overflow, no text clipped by a fixed-size container, no control smaller than 18 px or overlapping another, visible headings, and data present where the demo set guarantees it |
| Keyboard shortcuts | `Ctrl+2` → Sales Invoices, `Ctrl+5` → Manufacturing, `Ctrl+F` focuses the page filter |
| Dashboard | Best sellers are revenue-sorted, the sort toggles, avatar/meter render, and a row menu navigates to the owning module |
| Settings | 26 shortcut rows, rebind/capture/save/reset, Database card contents |
| Manufacturing | The combobox filters and selects; temporary production swaps pickers; errors stay empty |
| Typography/hit targets | Font sizes, `.num` alignment and control sizes across every page |
| Empty states | A nonsense filter on every filterable page shows an empty state, not an error or a crash |
| Responsive | No page overflows horizontally at 1280 or 1024 px |
| Excel downloads | Every report downloads a workbook through the UI |

Full-page screenshots are written to `web/e2e/.artifacts/` (CI uploads them as
an artifact on every run, pass or fail).

The audit is the acceptance test for layout and real-browser behaviour; it is
what catches a dropdown being clipped, a table pushing the page wide, or a click
handler that only works with a mouse.

## Optional button sweep

`web/e2e-sweep/` is a separate Playwright project that drives **whatever is
already running** (`SWEEP_BASE_URL`, default `http://localhost:5173`) and clicks
every button on every page, recording failures and slow clicks. It is not part
of `npm test:e2e` and not in CI; run it manually against `npm run dev` when
changing shared UI or navigation.

```bash
cd web
npx playwright test -c e2e-sweep/playwright.sweep.config.ts
```

## CI

`.github/workflows/ci.yml` runs on every push to `main`, every pull request and
manual dispatch:

| Job | Steps |
| --- | --- |
| `web` | Node 22, `npm ci`, `npm run typecheck`, `npm test`, `npm run smoke`, client production build |
| `ui-audit` | Node 22, `npm ci`, install Chromium, `npm run test:e2e`, upload `web/e2e/.artifacts` |
| `python` | The desktop app's pytest suite (independent of the web app) |

The Windows deployment script (`deploy/windows/deploy.bat`) runs install,
typecheck, `npm test` and `npm run build` before restarting the service; it does
not run the browser audit or the smoke test.

## Writing tests

- Put service tests in the matching `tests/<module>.test.ts`; use `freshDb()`
  and close it in `afterEach`.
- Assert the **journal entry** as well as the document. A create that returns the
  right total but posts the wrong accounts is the most expensive kind of bug in
  an ERP.
- For failures, assert the error class (`ValidationError`, `ConflictError`,
  `InsufficientStockError`, …) and that nothing was written (read the document
  count after the rejection).
- For numbering, assert gap-free sequence: a rejected create must not consume a
  number.
- For reports, prefer recomputing from `journal_entry_lines` with plain SQL (as
  `acceptance.test.ts` does) over comparing the service to itself.
- For UI changes, extend the browser audit rather than adding unit tests around
  React components; there is no component-testing setup.

## Known coverage gaps

- The hosted SQLite Cloud adapter runs only in the opt-in test; a normal run
  exercises the local adapter.
- No load/performance tests; the app is single-instance by design.
- No component-level (jsdom) tests; React behaviour is covered in Chromium.
- No automated RBAC tests because roles are not enforced yet.
- The `e2e-sweep` click-every-button suite is manual.
