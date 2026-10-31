# Agent rules — databases

**Never touch the production database.** `SQLITE_CLOUD_URL` in `web/.env` points at
`maindb.db` (production). It must never be opened, read, written, pulled from, or
pushed to by an agent.

- Do not run `npm run dev`, `npm run dev:server`, `npm run seed`, or
  `npm run seed:rich` in `web/`. `npm run dev` uses the local engine and
  replicates `web/data/erp.sqlite` to main at startup, every
  `ERP_REPLICA_MINUTES`, and on shutdown.
- Do not run `scripts/pull-cloud.mjs`, `scripts/dev-testdb.mjs` variants that
  change the URL, or any command containing `maindb` / `SQLITE_CLOUD_URL`.
- Do not create, edit, or export `SQLITE_CLOUD_URL`, and do not edit `web/.env`.

Allowed database work:

- `npm run dev:testdb` in `web/` — local `web/data/testdb.sqlite`, pushes only
  to cloud `testdb`, separate backups in `backups/testdb` and
  `~/Desktop/desktop-testdb`.
- `npm test`, `npm run typecheck`, `npm run build`, `npm run test:e2e` — these
  use local or test files only.

If a task seems to need main, stop and ask the user.
