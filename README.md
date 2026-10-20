# BOP Nutraceuticals ERP

This repository holds **two independent applications** that share a database
schema but have their own source tree, dependencies, configuration and test
suite:

```
python/                 PySide6 desktop ERP (Python 3.9+)
web/                    TypeScript full-stack rewrite (Node 22 + React)
docs/                   Historical notes, audits and design documents
.github/workflows/      CI for each application
python/.env             Python configuration (git-ignored)
web/.env                Web configuration (git-ignored)
```

Each application owns its environment file. There is **no shared or fallback
`.env`**: the Python app reads only `python/.env`, and the web app reads only
`web/.env`, so either one can be configured and deployed without touching the
other.

## Python desktop app — `python/`

```bash
cd python
python -m venv .venv
.venv/bin/pip install -r requirements-dev.txt   # Windows: .venv\Scripts\pip
cp .env.example .env                            # Windows: copy .env.example .env
python main.py
```

On Windows, `setup.bat` installs the dependencies and initializes the database.
All paths used at runtime — `logs/`, `backups/`, `data/`, the historical
`PharmaPro_FullExport/` import inputs — are relative to `python/`, so run the
app and the one-off import scripts from that directory.

Tests:

```bash
cd python
QT_QPA_PLATFORM=offscreen .venv/bin/python -m pytest -q
```

See [python/README.md](python/README.md) for the app's structure and
[python/IMPORT_DOCUMENTATION.md](python/IMPORT_DOCUMENTATION.md) for the
historical data imports.

## Web app — `web/`

On a fresh Windows machine, double-click `web\setup.bat`: it installs Node.js
22 LTS if needed, installs the dependencies, creates `web\.env`, runs the smoke
test and can start the app. Otherwise:

```bash
cd web
npm install
cp .env.example .env
npm run seed        # optional local demo data
npm run dev         # API :4000, client :5173
```

Production runs as one Windows service on one port; the runbook is
[web/DEPLOYMENT.md](web/DEPLOYMENT.md) and the scripts live in
`web/deploy/windows/`.

Verification: `npm run typecheck`, `npm test`, `npm run smoke`, `npm run build`.
See [web/README.md](web/README.md) for the short layout and architecture notes,
and **[web/docs/README.md](web/docs/README.md)** for the full documentation set
(architecture, data model, API, modules, frontend, testing, operations).

## Database

Both apps connect to the same hosted SQLite Cloud database by default
(`ERP_DB_ENGINE=sqlitecloud` plus `SQLITE_CLOUD_URL`), or to a local SQLite file
when the engine is switched to `local`. The web app uses its own local file
(`web/data/dev.sqlite`) and the Python app uses the directories under `python/`.
