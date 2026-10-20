# Operations

Running the application day to day: health, logs, backups, failure modes,
security posture and the limitations an operator must know about. Installation,
upgrades and rollback live in [DEPLOYMENT.md](../DEPLOYMENT.md).

## Process model and why one instance

Production is **one Node process on one port** serving `/api` and the built
client, registered as the `BOP-ERP` Windows service via NSSM. Keep it that way:

- sessions are an in-memory `Map` (12 h TTL), so a second process would reject
  users signed in on the first;
- the auto-backup scheduler runs inside the process;
- SQLite (local file or hosted) prefers a single writer, and the local adapter
  installs a 5 s busy timeout rather than a connection pool.

Scale up (more RAM/CPU) rather than out. Restarting the service signs everyone
out; that is expected.

## Startup checks

The first lines of `web/logs/erp-out.log` tell you which mode is running:

```
[bootstrap] local database ready at …                              (local engine)
[bootstrap] using hosted SQLite Cloud database (no schema changes)  (cloud engine)
[bootstrap] SQLite Cloud connectivity check passed
[client] serving the built client from …                            (ERP_SERVE_CLIENT=1)
[server] API listening on http://0.0.0.0:4000 (engine=…, client=…, tls=…)
[backup] auto-backup every 24h into …                               (if enabled)
[mirror] local copy at …                                            (after the first refresh)
```

The process exits non-zero at startup when:

- `ERP_DB_ENGINE=sqlitecloud` but `SQLITE_CLOUD_URL` is missing;
- the cloud ping fails (bad credentials, unreachable host, firewall);
- only one of `ERP_TLS_CERT` / `ERP_TLS_KEY` is set, or a file is missing;
- the port is already in use.

It does **not** fail when `ERP_SERVE_CLIENT=1` but the client build is missing:
it logs `[client] no build found … serving the API only` and continues. That is
the usual cause of a JSON 404 at `/`.

## Health and monitoring

| Signal | How |
| --- | --- |
| Liveness/readiness | `GET /api/health` → `{"status":"ok"}`. Only proves the process answers; it does not touch the database |
| Database connectivity | Startup ping (cloud) and request errors in the log. `GET /api/settings/database` shows the engine and SQLite version to a signed-in user |
| Errors | `web/logs/erp-error.log` (NSSM stderr). Every handled error logs `[ISO timestamp] HTTP <status> <CODE>: <message>`; unexpected ones log the stack |
| Windows service state | `nssm status BOP-ERP` |
| Disk | `web/logs/` and `web/backups/` grow; monitor free space |

NSSM appends to the same two files indefinitely. There is no built-in rotation —
set up Windows log rotation (or truncate during a maintenance window) so a busy
server cannot fill the disk.

## Backups and restore

Two layers, on purpose:

1. **Provider history (hosted engine).** SQLite Cloud keeps a daily full snapshot
   plus per-second changes, stored off-box, restorable to any second inside the
   retention window. Keep that window at 30 days if the plan allows it. RPO:
   seconds; RTO: minutes (dashboard or `RESTORE BACKUP DATABASE`).
2. **Live local copy + named snapshots (this app).** A portable SQLite file the
   operator can open, copy and restore without the provider. RPO: the debounce
   interval plus however long someone keeps writing without a pause.

### Live local copy

- `backups/live/erp_mirror.db` is rewritten after `ERP_MIRROR_DEBOUNCE_SECONDS`
  (default 15) of no writes, at startup, and on a clean shutdown. Every rewrite
  is a full, consistent snapshot (read in one transaction for the hosted
  engine) and is verified with `PRAGMA integrity_check` before it replaces the
  old file.
- Status and a manual refresh: Settings → Local copy, or
  `GET/POST /api/backup/mirror`. Download: `GET /api/backup/mirror/download`.
- `ERP_PC_MIRROR_DIR` pushes the same file to a mapped drive or UNC share, e.g.
  `\\your-pc\bop-backup`. If that machine is off or the share is unreachable the
  server keeps its own copy and retries on the next refresh; the Settings page
  shows the error.
- Disable with `ERP_LIVE_MIRROR=0`.
- A file held open in DB Browser blocks the Windows rename. The mirror keeps the
  previous file and reports the error; close the viewer and it catches up.

### Named snapshots

- `erp_backup_<UTC timestamp>.db` in `ERP_BACKUP_DIR` (default `web/backups`).
  `ERP_BACKUP_KEEP` (default 7) prunes the oldest after a successful new one.
- Create one now: `POST /api/backup` or Settings → Backups. Schedule with
  `ERP_AUTO_BACKUP_HOURS=24` if you want a separate history.
- Restore (local engine): stop the service, copy the snapshot over `ERP_LOCAL_DB`,
  start it, check health and the trial balance. Restore (hosted engine): use the
  provider's point-in-time restore, or upload the file through the dashboard.

### Off-box and secrets

A copy on the same disk is not a backup against disk failure. Keep the PC/NAS
copy, and keep `web/.env` (it holds the only database credential) with your
password manager or the same secure off-box location. It is never included in a
snapshot.

## Routine maintenance

| Task | Command | Notes |
| --- | --- | --- |
| Reconcile voucher/party/item sequences | `npm -w @bop-erp/server run reconcile` | Moves sequences forward to `max(code)+1`; safe on the hosted database. Run after a data migration |
| Full dataflow QA against a throwaway DB | `npm -w @bop-erp/server run qa:dataflow` | Bootstraps an empty database (`data/qa-dataflow.sqlite`, deleted first), posts every document type through the services and cross-checks ledger, stock valuation, numbering and reports. Exits non-zero on failure; see the note below |
| HTTP smoke test | `npm run smoke` | Throwaway local database |
| Seed demo data | `npm run seed` / `seed:rich` | **Refuses non-local engines** |
| Trial-balance demo | `npx tsx server/src/trialBalanceDemo.ts` | Prints a hand-checkable ledger vs the report |

`seed.ts` updates the local file only. Never run it with
`ERP_DB_ENGINE=sqlitecloud`; the guard prevents it, and the hosted database has
no demo data.

The QA harness currently reports **3 known failures** out of 117 checks, which
match the limitations below rather than a broken build:

1. wastage is not posted to `5200` (it is capitalised into finished-goods cost);
2. adding stock to an existing batch at a new price does not re-weight the batch
   cost, so stock valuation drifts from the GL;
3. opening stock without a supplier creates stock with no inventory GL entry, so
   stock and GL diverge.

Use the harness as a regression signal: a *new* failure, or a change in these
three, deserves investigation.

## Failure modes

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Service starts then stops | Bad `.env`, unreachable cloud database, TLS misconfiguration, port in use | Read `erp-error.log`; run `run-foreground.bat` to see the fatal message |
| `/` returns JSON `404 NOT_FOUND` | `ERP_SERVE_CLIENT` off, or `client/dist` missing | Set it to `1`, run `npm run build`, restart |
| Login returns `500 DATABASE_ERROR` | Database reached but the query failed (missing table/column, dropped connection) | Check the log; verify the hosted schema matches `db/schema.ts` |
| Every request `401 UNAUTHORIZED` | Service restarted (sessions are in memory) or 12 h TTL elapsed | Sign in again |
| `database is locked` | A second process on the same local file, or a long transaction | Ensure one instance; retry after the long operation |
| `CONFIGURATION_ERROR: Required system account '…' is missing` | Database has no seeded chart of accounts | Restore/seed the database; never patch the code |
| Numbering collision (`CONFLICT` on create) | Sequences behind existing codes (usually after a migration) | `npm -w @bop-erp/server run reconcile` |
| Garbled characters in the log | Console code page differs from the log encoding | Cosmetic; set the service to UTF-8 if it matters |
| Client looks stale after a deploy | Browser cached `index.html` | It is sent `no-cache`; force a reload once and check the hashed asset name changed |

## Security posture

What is implemented:

- Authentication on every endpoint except health and login; PBKDF2 password
  hashing compatible with the desktop app.
- Zod validation and parameterised SQL on every route; no string interpolation
  of user input into SQL.
- Credential masking in the database info endpoint and in logs.
- Restore refuses to run against a live connection; backup filenames are
  sanitised against path traversal.
- Honest error messages: internal exceptions never leak a stack trace.

What is **not** implemented — plan for it:

| Gap | Impact | Mitigation before go-live |
| --- | --- | --- |
| No role authorization | Any signed-in user can create an Admin, reset passwords, change settings, read every report | Keep accounts few and trusted; put the app on a private network/VPN |
| Default `admin` / `admin123` on a fresh local database | Trivial takeover if left unchanged | Change it immediately; create named accounts |
| No rate limiting / lockout | Password guessing and brute force are unthrottled | Reverse proxy with rate limiting; strong passwords |
| No security headers / CSP | Weaker defence in depth | Add them at the proxy |
| Open CORS (`*`) | Any website can call the API with a user's token if it can read it | Restrict origins at the proxy, or patch `cors()` |
| Token in `localStorage` | Readable by any XSS on the origin | Keep dependencies patched; add CSP |
| Plain HTTP by default | Credentials and data in clear text on the LAN | Terminate TLS in-process (`ERP_TLS_CERT`/`KEY`) or via IIS/nginx with `ERP_HOST=127.0.0.1` |
| No audit trail | No record of who changed what | `audit_log` exists but is unwritten; add it before regulated use |

Do not expose the port directly to the internet. The deployment checklist in
[DEPLOYMENT.md](../DEPLOYMENT.md#security-checklist-before-go-live) is the
short version; the table above is the full list.

## Known functional limitations

These are real behaviours of the current code, not bugs in the deployment:

1. **Single instance only** — no horizontal scaling, logout on restart.
2. **Roles are labels** — see the security table.
3. **Bank accounts share one GL account** (`1010`). The balance shown for a
   bank account, and the funds check on withdrawal/payment, use the combined
   `1010` balance, so one account's funds can cover another's payment.
4. **Sales returns settle to cash** unless the original invoice was a credit
   sale; the original bank account is not remembered.
5. **Return quantities are checked per request** against the quantity sold, not
   against previous returns, so two requests could over-return the same line.
6. **Purchase invoices gross up both sides for input tax.** The inventory debit
   is the tax-inclusive line total *and* the tax is credited to `2100`, faithful
   to the desktop app. This balances the entry but overstates inventory and the
   tax liability by the tax amount; check with the accountant before relying on
   the inventory valuation when input tax is in use.
7. **Asset details are one row per account** — recording a second purchase on an
   existing asset code overwrites the detail record (the journal entries remain).
8. **Party `opening_balance` is not posted**; use account opening balances or a
   journal entry.
9. **Deactivating an account is allowed with movement** (by design, so the trial
   balance still balances); only active sub-accounts block it.
10. **Unused schema**: `permissions`, `role_permissions`, `audit_log` and
    `stock_losses` exist for parity but no route writes them. There is no
    stock-adjustment/loss screen yet.
11. **Client is one bundle** (~894 kB, 258 kB gzip) with no route-level code
    splitting; first load over a slow WAN is the main performance cost.
12. **No scheduled exports** and no email — reports are downloaded manually.
13. **Opening stock without a supplier has no GL entry** — stock and batch value
    are created, but inventory in the GL does not move, so stock valuation and
    the ledger diverge by that value. Supply a supplier (or post a journal
    entry) when the opening stock should be in the books.
14. **Batch costs are not re-weighted** — adding stock to an existing batch at a
    different price keeps the batch's original unit cost, so inventory value can
    drift from the GL after a re-purchase at a new price.

## Data and privacy notes

- The database holds customer/supplier contact details, prices and financial
  records. Treat the hosted connection string as a production secret: it
  contains the password, and the app masks it everywhere except `.env`.
- Logs contain timestamps, HTTP status/codes and human-readable messages. They
  do not log request bodies, SQL parameters or passwords. Keep `web/logs/` and
  `web/.env` readable only by the service account.
- Sessions are not stored anywhere; no personal data is cached server-side
  beyond the in-process map.

## Useful endpoints for operators

| Endpoint | Auth | Use |
| --- | --- | --- |
| `GET /api/health` | none | Load balancer / uptime probe |
| `GET /api/settings/database` | yes | Confirm engine, connection (masked), SQLite version |
| `GET /api/backup/status` | yes | Snapshot count, latest file, total size (local engine) |
| `GET /api/reports/trial-balance` | yes | Post-deploy sanity: `balanced: true` |
