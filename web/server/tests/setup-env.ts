/**
 * Vitest setup: pin the database engine for the test suite.
 *
 * `env.ts` reads `web/.env` at import time, and that file legitimately points at
 * the hosted SQLite Cloud database (the app is connected to it). The unit and
 * acceptance suites build their own throwaway local databases, so they must
 * behave and report as `local` no matter what the developer's `web/.env` says —
 * otherwise switching engines silently changes assertions (it did, for
 * settings.test.ts) or, worse, points a test at the production database.
 *
 * `loadDotEnv()` only fills keys that are still undefined, so setting this here
 * wins over `web/.env` and the repository-root `.env`.
 *
 * The opt-in hosted test (`tests/sqliteCloud.test.ts`) builds its own connection
 * from `SQLITE_CLOUD_URL` and never goes through `getDb()`, so it is unaffected.
 */
process.env.ERP_DB_ENGINE = "local";
