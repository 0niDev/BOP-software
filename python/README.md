# BOP Nutraceuticals ERP — Python desktop app

The original PySide6 desktop ERP: authentication, chart of accounts, parties,
inventory, sales/purchase invoices, manufacturing, expenses, banking, returns,
fixed assets and financial reports. The TypeScript rewrite lives separately in
[`../web`](../web) and the two do not share an environment file.

## Setup

Requires Python 3.9+ (developed against 3.14).

```bash
cd python
python -m venv .venv
.venv/bin/pip install -r requirements-dev.txt    # Windows: .venv\Scripts\pip
cp .env.example .env                             # Windows: copy .env.example .env
python main.py
```

On Windows, `setup.bat` installs the dependencies, creates the runtime folders
and initializes the database. The default login is `admin` / `admin123`; change
it after the first sign-in.

## Configuration

`python/.env` is the app's only environment file (git-ignored). Start from
[`.env.example`](.env.example):

```ini
ERP_DB_ENGINE=sqlitecloud
SQLITE_CLOUD_URL=sqlitecloud://user:password@host:port/database
```

- `ERP_DB_ENGINE=sqlitecloud` uses the hosted SQLite Cloud database.
- `ERP_DB_ENGINE=sqlite` (or the local default) uses a local SQLite file.
- `ERP_LOG_LEVEL` sets the log level; `ERP_DB_HOST`/`PORT`/`NAME`/`USER`/
  `PASSWORD` configure a MySQL/PostgreSQL backend.

The web app's configuration is `web/.env`; it is never read here, and this file
is never read by the web app.

## Layout

```
python/
├── main.py                 application entry point
├── config/app_config.py    paths and environment-derived settings
├── database/               connection, schema, migrations, backups
├── models/                 domain models
├── repositories/           data access
├── services/               business logic (accounting, sales, reports, ...)
├── controllers/            UI-facing controllers
├── views/                  PySide6 windows and widgets
├── authentication/         login and password hashing
├── utils/                  logging, caching, env loading, helpers
├── tests/                  pytest suite
├── scripts/                maintenance/export utilities
├── logs/  backups/  data/  runtime output (git-ignored)
└── PharmaPro_FullExport/   historical import inputs
```

## Tests

```bash
cd python
QT_QPA_PLATFORM=offscreen .venv/bin/python -m pytest -q
```

Tests use a throwaway local SQLite database and never touch the hosted one.

## Historical import scripts

The `import_*.py`, `coa_import.py`, `backfill_*.py` and `diag_*.py` scripts are
one-off data migrations. They resolve their input files (`PharmaPro_FullExport/`,
`product_info.csv`, `list of raw material.txt`, ...) relative to the current
directory, so run them **from `python/`**. See
[IMPORT_DOCUMENTATION.md](IMPORT_DOCUMENTATION.md) for the order to run them in.
