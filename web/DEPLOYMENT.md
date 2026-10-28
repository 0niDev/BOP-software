# Deploying the BOP ERP

Production deployment for **Windows Server**: one Node process serving the API
*and* the built React client on a single port, registered as a Windows service
with NSSM.

> **This deployment is intentionally single-instance.** Sessions live in an
> in-memory `Map` inside the process, and the auto-backup scheduler runs in the
> same process. Running two copies (a second service, PM2 cluster mode, or a
> load-balanced pair) means a user logged into one instance is rejected by the
> other. Scale up, not out.

## Topology

```
browser ──HTTPS/HTTP──▶  BOP-ERP service (node dist/index.js, port 4000)
                           ├── /api/*      Express API  ──▶ hosted SQLite Cloud
                           └── /*          built React client (client/dist)
```

* **Database** — the existing hosted SQLite Cloud database, reached with
  `SQLITE_CLOUD_URL`. The app never runs DDL or seeds against it; only a `local`
  engine is bootstrapped. If you point production at a `local` engine instead,
  that file becomes production data and must be backed up.
  Schema changes ship as SQL files in `web/server/migrations/`; run the new ones
  against the hosted database **before** deploying code that needs them (e.g.
  `2026-10-22-expense-bills-recurring.sql` adds the expense `status`/`due_date`
  and recurring-item `frequency`/`next_run_date` columns).
* **Client** — `web/client/dist`, served by the same process. Nothing else needs
  to be installed; IIS is not required unless you want TLS terminated elsewhere.

## Local-primary mode (recommended)

The hosted database answers every statement over the WAN (~245 ms round trip;
one screen can fire dozens), so production runs on a **local** SQLite file and
keeps SQLite Cloud only as a **read-only replica**:

```
browser ──▶ BOP-ERP service ──▶ data\erp.sqlite   (source of truth, fast)
                    │
                    └─ every 15 min, at startup/shutdown/on demand ──▶
                        SQLite Cloud  (wholesale replace, read-only)
```

The push takes one consistent snapshot of the local file (`VACUUM INTO`) and
replaces the whole cloud database inside a single transaction: a push that
fails or is interrupted leaves the previous good copy untouched. Watch its
state in **Settings → Cloud copy** (`GET/POST /api/backup/replica`).

**Single-writer rule:** the local file is the only writer. Never edit the
cloud database in the SQLite Cloud dashboard — the next push overwrites it.

### Cutover (one-time, on the server)

1. **Stop the service** (`nssm stop BOP-ERP`) so nothing writes while you copy.
2. **Pull the cloud database into a local file** (read-only against the cloud):

   ```bat
   cd C:\BOP-ERP\web
   node scripts\pull-cloud.mjs --out data\erp.sqlite
   ```

   It prints per-table row counts, runs `integrity_check` and refuses to
   overwrite a file unless you name it with `--out`.
3. **Point `.env` at the local file** and keep the cloud URL as the replica:

   ```ini
   ERP_DB_ENGINE=local
   ERP_LOCAL_DB=./data/erp.sqlite
   SQLITE_CLOUD_URL=sqlitecloud://…          # replica target, never read
   ERP_REPLICA_MINUTES=15
   ERP_AUTO_BACKUP_HOURS=1
   ERP_BACKUP_KEEP=168
   ERP_LIVE_MIRROR=0
   ```

   To rehearse without touching the cloud, set `ERP_REPLICA_DRY_RUN=1` first;
   the Settings page then builds and reports the push script without sending.
4. **Start the service** (`nssm start BOP-ERP`). The startup push replaces the
   cloud copy with the local file; Settings → Cloud copy shows the result.
5. **Verify:** sign in, check the Dashboard, and confirm the cloud database's
   row counts moved with the push.

From then on, schema migrations apply to the local file automatically at
startup (no more pre-deploy SQL against the hosted database), and every
snapshot/live-copy concern collapses to ordinary files on this machine — see
**Backups** below.

### Rollback to the hosted engine

1. Settings → Cloud copy → **Push now**, so the replica holds every write.
2. Set `ERP_DB_ENGINE=sqlitecloud` in `web\.env` and restart.

Writes made in local mode after the last successful push are lost in this
direction — that is why the push is step 1.

## Prerequisites

| Requirement | Notes |
| --- | --- |
| Windows Server 2019+ | 64-bit |
| **Node.js 22 LTS (x64)** | Hard requirement — the local DB adapter uses `node:sqlite`, which does not exist before Node 22 |
| [NSSM](https://nssm.cc/download) | `nssm.exe` on `PATH` (e.g. `C:\Windows\System32`) |
| Git | Only needed for `deploy.bat`'s pull step |
| Administrator access | To install/remove the service and open the firewall port |

## One-time setup

1. **Get the code onto the server** and check out the release you intend to run:

   ```bat
   git clone <repository-url> C:\BOP-ERP
   cd C:\BOP-ERP
   ```

2. **Create the environment file.** `web\.env` is git-ignored, so it is never in
   the repository; copy the tracked template and edit it:

   ```bat
   copy web\.env.example web\.env
   notepad web\.env
   ```

   The keys that matter in production:

   ```ini
   ERP_DB_ENGINE=sqlitecloud
   SQLITE_CLOUD_URL=sqlitecloud://user:password@host:port/database
   ERP_HOST=0.0.0.0
   PORT=4000
   ERP_SERVE_CLIENT=1      # serve the built client from this same process
   # ERP_TLS_CERT=./certs/erp.crt   # optional: terminate HTTPS here (set with the key)
   # ERP_TLS_KEY=./certs/erp.key
   ```

   > `web\.env` is the complete configuration for the web app. The Python app's
   > `python\.env` is separate: neither app reads the other's environment file.

3. **Build and install:**

   ```bat
   web\deploy\windows\deploy.bat
   ```

   Then, **as Administrator**:

   ```bat
   web\deploy\windows\install-service.bat
   ```

   The installer registers the service as auto-start, redirects output to
   `web\logs\erp-out.log` and `web\logs\erp-error.log`, restarts it on failure, and
   offers to open the port in Windows Firewall.

4. **Verify** (also done automatically at the end of `deploy.bat`):

   ```bat
   curl.exe -fsS http://localhost:4000/api/health
   ```

   Expect `{"status":"ok"}`. Open `http://localhost:4000` — the login page must
   load. If you get a JSON 404 at `/`, `ERP_SERVE_CLIENT` is off or
   `client\dist` was not built.

## Everyday deploy, upgrade and rollback

```bat
web\deploy\windows\deploy.bat                  REM pull, install, typecheck, test, build, restart
web\deploy\windows\deploy.bat --skip-tests     REM fast hotfix
web\deploy\windows\deploy.bat --skip-pull      REM deploy the working tree as-is
```

`deploy.bat` stops the service before replacing the build, so a failed build
leaves the service stopped rather than serving a half-written bundle — check
`web\logs\erp-error.log` and re-run.

**Rollback:** check out the previous release and re-run `deploy.bat`:

```bat
git log --oneline -5
git checkout <previous-release-commit>
web\deploy\windows\deploy.bat --skip-pull
```

## Service management

| Task | Command |
| --- | --- |
| Start / stop / restart | `nssm start BOP-ERP` · `nssm stop BOP-ERP` · `nssm restart BOP-ERP` |
| Status | `nssm status BOP-ERP` |
| Live log | `web\logs\erp-out.log` (startup banner, errors) |
| Error log | `web\logs\erp-error.log` |
| Remove the service | `web\deploy\windows\uninstall-service.bat` (Administrator) |
| Trial run in a console | `web\deploy\windows\run-foreground.bat` — same config, visible output |

Use `run-foreground.bat` when the service will not start: it reads the same
`web\.env` and prints the fatal error instead of burying it in a log.

## Optional HTTPS

If the machine has a certificate, point `ERP_TLS_CERT` and `ERP_TLS_KEY` at it
(both, or neither) and the process serves HTTPS itself — still one port, one
service. The banner on startup reports `tls=on`.

Otherwise terminate TLS in front: an IIS/ARR or nginx reverse proxy to
`http://127.0.0.1:4000` (set `ERP_HOST=127.0.0.1` so the app is not also
reachable directly).

There is currently **no request rate limiting and no security headers in the
app**, so a reverse proxy in front is worth having for those alone.

## Backups

* **Provider history:** SQLite Cloud keeps a daily full snapshot plus per-second
  changes and can restore to any second in the retention window. Confirm backup
  is enabled for the production database and keep the window at 30 days.
* **Live local copy:** on by default in hosted-engine mode.
  `backups\live\erp_mirror.db` is rewritten after about 15 seconds without
  writes, at startup and on shutdown, and is verified before replacing the
  previous file. Redundant in local-primary mode (the database itself is
  already a local file) — set `ERP_LIVE_MIRROR=0` there. `ERP_PC_MIRROR_DIR`
  can point it at a shared folder or mapped drive as well.
* **Named snapshots:** set `ERP_AUTO_BACKUP_HOURS=24` to also write
  `<YYYYMMDD_HHMMSS>.db` into `ERP_BACKUP_DIR`; `ERP_BACKUP_KEEP` (default
  7) prunes older ones. Both engines now produce a portable SQLite file. Every
  snapshot is also copied to `<home>\Desktop\desktop` on the machine running
  the server; `ERP_DESKTOP_DIR` moves or disables that second copy.
* **Restore:** provider point-in-time restore first (hosted) or, with the service
  stopped, copying the snapshot over `ERP_LOCAL_DB` (local). Restore through the
  API is refused while the server is running, by design.
* **Keep `web\.env` off-box too** — it holds the database credential and is not
  part of any snapshot.

## Verification after every deploy

1. `curl.exe -fsS http://localhost:4000/api/health` → `{"status":"ok"}`.
2. Open the app and sign in; the Dashboard must render figures, not an error.
3. Reports → Trial Balance must be balanced (debit = credit).
4. `web\logs\erp-error.log` must contain nothing new.

## Security checklist before go-live

Run through this before the app is reachable by anyone else:

- [ ] **Change the admin password.** The seeded credential is `admin` /
      `admin123`; it is checked into the installer of the original desktop app
      and must never survive on a network-reachable server.
- [ ] **Create a named account per person** and disable accounts that leave.
- [ ] **Do not open the port to the internet.** Put it behind a VPN or a
      reverse proxy with TLS and access control.
- [ ] **Know the authorization gap.** The API enforces *authentication only* —
      any signed-in user can create an Admin user, reset any password, change
      settings and read every report. Until role checks are added, treat every
      account you create as an administrator and keep the user list short.
- [ ] Confirm the firewall only exposes the port you intend.
- [ ] Confirm `web\logs\` and `web\.env` are readable only by the service account.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Service starts then stops | Read `web\logs\erp-error.log`. Usually a missing/invalid `web\.env` key or an unreachable `SQLITE_CLOUD_URL` |
| `Server service failed to start` on install | Wrong `node.exe` path, or NSSM is not on `PATH` |
| JSON 404 at `/` | `ERP_SERVE_CLIENT` is not `1`, or `client\dist` was not built (`npm run build`) |
| Login returns 500 | The database was reached but the query failed — check the log; a dead connection reports `DATABASE_ERROR` |
| `Missing or expired session` after a service restart | Expected: sessions are in memory and are lost on restart. Users sign in again |
| `database is locked` | Two processes (or a second service) are talking to the same hosted database. There must be exactly one |
| Turkish/garbled characters in logs | Cosmetic: the console code page differs from the log encoding |
