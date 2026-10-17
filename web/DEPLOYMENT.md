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
* **Client** — `web/client/dist`, served by the same process. Nothing else needs
  to be installed; IIS is not required unless you want TLS terminated elsewhere.

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

   > `web\.env` is read first, then the repository-root `.env` fills in any key
   > that is still unset — so an existing root `.env` carrying `SQLITE_CLOUD_URL`
   > still works.

3. **Build and install:**

   ```bat
   deploy\windows\deploy.bat
   ```

   Then, **as Administrator**:

   ```bat
   deploy\windows\install-service.bat
   ```

   The installer registers the service as auto-start, redirects output to
   `logs\erp-out.log` and `logs\erp-error.log`, restarts it on failure, and
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
deploy\windows\deploy.bat                  REM pull, install, typecheck, test, build, restart
deploy\windows\deploy.bat --skip-tests     REM fast hotfix
deploy\windows\deploy.bat --skip-pull      REM deploy the working tree as-is
```

`deploy.bat` stops the service before replacing the build, so a failed build
leaves the service stopped rather than serving a half-written bundle — check
`logs\erp-error.log` and re-run.

**Rollback:** check out the previous release and re-run `deploy.bat`:

```bat
git log --oneline -5
git checkout <previous-release-commit>
deploy\windows\deploy.bat --skip-pull
```

## Service management

| Task | Command |
| --- | --- |
| Start / stop / restart | `nssm start BOP-ERP` · `nssm stop BOP-ERP` · `nssm restart BOP-ERP` |
| Status | `nssm status BOP-ERP` |
| Live log | `logs\erp-out.log` (startup banner, errors) |
| Error log | `logs\erp-error.log` |
| Remove the service | `deploy\windows\uninstall-service.bat` (Administrator) |
| Trial run in a console | `deploy\windows\run-foreground.bat` — same config, visible output |

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

* **Hosted engine (production):** the SQLite Cloud provider snapshots the
  database. The app's own snapshot feature is deliberately disabled for this
  engine — `GET /api/backup/status` reports `supported: false`, and the Settings
  page says so, so nobody mistakes a missing button for a broken one.
* **Local engine:** set `ERP_AUTO_BACKUP_HOURS=24` to have the process write
  `erp_backup_<timestamp>.db` snapshots into `ERP_BACKUP_DIR` (default
  `web\backups`). Restoring is refused while the server is running, by design —
  swapping the file under an open connection corrupts it.

## Verification after every deploy

1. `curl.exe -fsS http://localhost:4000/api/health` → `{"status":"ok"}`.
2. Open the app and sign in; the Dashboard must render figures, not an error.
3. Reports → Trial Balance must be balanced (debit = credit).
4. `logs\erp-error.log` must contain nothing new.

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
- [ ] Confirm `logs\` and `web\.env` are readable only by the service account.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Service starts then stops | Read `logs\erp-error.log`. Usually a missing/invalid `web\.env` key or an unreachable `SQLITE_CLOUD_URL` |
| `Server service failed to start` on install | Wrong `node.exe` path, or NSSM is not on `PATH` |
| JSON 404 at `/` | `ERP_SERVE_CLIENT` is not `1`, or `client\dist` was not built (`npm run build`) |
| Login returns 500 | The database was reached but the query failed — check the log; a dead connection reports `DATABASE_ERROR` |
| `Missing or expired session` after a service restart | Expected: sessions are in memory and are lost on restart. Users sign in again |
| `database is locked` | Two processes (or a second service) are talking to the same hosted database. There must be exactly one |
| Turkish/garbled characters in logs | Cosmetic: the console code page differs from the log encoding |
