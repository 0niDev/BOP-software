# Agent rules — databases

## Production (`maindb`)

`SQLITE_CLOUD_URL` in `web/.env` points at `maindb.db` (production).

**Allowed when the user explicitly asks** to read, write, pull, push, or run
cleanup/scripts against main / MDB / production / `SQLITE_CLOUD_URL`.

Before any write to main:

1. Confirm the target is main (not testdb).
2. Take a backup first (script backup, cloud snapshot, or copy).
3. Prefer dry-run, then apply.
4. Do not edit `web/.env` unless the user asks.

## Default (no explicit main request)

Use local or test DBs only:

- Local: `web/data/erp.sqlite` (COA cleanup scripts default here).
- Test: `npm run dev:testdb` — `web/data/testdb.sqlite`, cloud `testdb`,
  backups in `backups/testdb` and `~/Desktop/desktop-testdb`.
- `npm test`, `npm run typecheck`, `npm run build`, `npm run test:e2e` — local
  or test files only.

Do **not** point scripts at main, run `pull-cloud` / replica-to-main flows, or
open `SQLITE_CLOUD_URL` unless the user asked for production/main/MDB.
