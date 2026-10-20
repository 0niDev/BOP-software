# Architecture

How the web app is put together, why, and where each kind of change belongs.

## System context

```
                       ┌─────────────────────────────────────────┐
  browser  ──HTTP(S)──▶ │  Node process (one port in production)  │
                       │                                         │
                       │  Express 5  ── /api/*  ── services      │
                       │      │                     │            │
                       │      │                     ▼            │
                       │      │              SqlDatabase         │
                       │      │              ├─ LocalSqlite (node:sqlite)
                       │      │              └─ SqliteCloud (@sqlitecloud/drivers)
                       │      │                                  │
                       │      └─ /*  ── client/dist (SPA)        │
                       └─────────────────────────────────────────┘
                                        │
                                        ▼
                            SQLite Cloud (production)
                            web/data/dev.sqlite (development)
```

There is no separate web server tier, no build step on the server and no
background worker. One process owns the HTTP listener, the database connection,
the session map and (optionally) the local backup timer.

## Layers

Layering is strict and mirrors the desktop app:
`React page → api.ts → http/app.ts → service → repository → SqlDatabase`.

| Layer | Location | May depend on | Must not |
| --- | --- | --- | --- |
| Domain | `server/src/domain/` | nothing | touch the database or Express |
| Database | `server/src/db/` | domain errors | know about business rules |
| Repositories | `server/src/repositories/` | `db`, domain | contain business rules or post journal entries |
| Services | `server/src/services/` | repositories, domain, `AccountingService` | read `req`/`res`, or run raw SQL for business rules |
| HTTP | `server/src/http/app.ts` | services, Zod, env | contain business rules |
| Client | `client/src/` | `api.ts`, `types.ts`, components | construct SQL or know credentials |

Practical consequences:

- Every monetary document goes through `AccountingService.postJournalEntry()`;
  no route or repository writes `journal_entries` directly.
- System accounts are resolved **by code**, never by numeric id, through
  `repositories/systemAccounts.ts` (codes: `1000`, `1010`, `1100`, `1200`,
  `1210`, `1220`, `2000`, `2100`, `3100`, `4000`, `4100`, `5000`, `5200`).
- A service that needs another service's effect (e.g. paying expense items)
  calls it inside one outer `db.transaction()`, not with its own copy of the
  rules.

## Request lifecycle

1. `express.json({ limit: "1mb" })` parses JSON bodies (absent bodies become
   `{}`).
2. `app.use(cors())` allows any origin. This is deliberate for the desktop/LAN
   deployment; put a reverse proxy in front if that is too open.
3. `requireAuth` reads `Authorization: Bearer <token>`, looks the opaque token
   up in the in-memory session map and rejects missing/expired tokens with
   `401 UNAUTHORIZED`. The session (`userId`, `username`, `expiresAt`) is
   attached as `req.user`.
4. The route parses and validates its input with Zod (`parseBody`) — body or
   query string. Unknown extra keys are stripped by the schemas; wrong shapes
   become `400 VALIDATION_ERROR` with the Zod issues in `error.details`.
5. The route calls one service method and serializes the result, usually
   `200`, or `201` for creates.
6. The service validates business rules, then does all reads, stock movements,
   document rows and the journal entry inside **one** `db.transaction()`.
7. Errors reach the global middleware, which maps `AppError` subclasses to
   their status/code and everything else to `500 INTERNAL_ERROR`.
8. Unknown `/api/*` paths return `404 {"error":{"code":"NOT_FOUND"}}`; unknown
   non-API GETs fall back to the SPA shell when the client is served.

`GET /api/health` is the only unauthenticated endpoint besides login; it answers
`{"status":"ok"}` without touching the database.

## Startup and shutdown

`server/src/index.ts`:

1. Install `unhandledRejection` (log and continue) and `uncaughtException` (log
   and exit 1) handlers.
2. Build the database from configuration (`getDb()`).
3. **Local engine**: run `bootstrapDatabase()` — create tables (`CREATE TABLE IF
   NOT EXISTS`), seed defaults (company, warehouse, roles, system accounts,
   numbering sequences, theme, first admin), then reconcile sequences.
   **Cloud engine**: never run DDL or seeds; ping the server and exit 1 if it is
   unreachable, so a bad credential fails at boot rather than on first request.
4. `createApp(db, companyId, { engine, clientDir })` — mounts the API and,
   when configured **and present**, the built client.
5. Read TLS files. Both cert and key, or neither; a half-configured pair or a
   missing file is a fatal startup error.
6. Listen on `ERP_HOST:PORT`; log one banner line with engine, client mode and
   TLS state.
7. If `ERP_AUTO_BACKUP_HOURS > 0` and the engine is local, start the backup
   interval.
8. On `SIGINT`/`SIGTERM`: stop the timer, best-effort `interrupt()` the
   database, close the HTTP server and the database, exit 0.

Sessions live only in this process, so a restart logs everyone out. The
deployment is intentionally single-instance (see
[OPERATIONS.md](OPERATIONS.md#process-model-and-why-one-instance)).

## Configuration

`server/src/env.ts` loads `web/.env` once (existing `process.env` values win),
exports a frozen `env` object, and is the only module that reads
`process.env`. Add new settings there and in `.env.example`; never read
`process.env` elsewhere.

The same file resolves all paths against `web/`, so the app behaves identically
whatever the current working directory is.

## Database layer

`db/types.ts` defines the only contract repositories see:

```ts
all / get / run / exec / transaction / close / interrupt / isConnected / ping
```

Two adapters implement it:

**`localSqlite.ts`** — Node's built-in `node:sqlite` (`DatabaseSync`).
Enables `foreign_keys` and a 5 s `busy_timeout`; transactions are real
`BEGIN`/`COMMIT`/`ROLLBACK` with a depth counter so nested calls join the outer
transaction. This is why Node 22 is a hard requirement.

**`sqliteCloud.ts`** — the official hosted driver, one serialized connection.
Transactions take an async lock and use `AsyncLocalStorage` to make the lock
re-entrant: statements inside the transaction body bypass the lock (they already
hold it) and nested `transaction()` calls join the outer one. Transient socket
errors (`ECONNRESET`, `ETIMEDOUT`, `SQLITE_CLOUD_DISCONNECTED`, …) are retried
once; repeated failures surface as `DATABASE_ERROR`.

Both adapters translate driver exceptions into `DatabaseError` carrying the SQL
(never the parameters), so a log line is enough to identify the failing query
without leaking customer data.

### Transactions

`db.transaction(fn)` is the atomicity boundary. It must wrap:

- the document row(s),
- its stock movements/batches,
- its journal entry (allocation of the voucher number included).

If anything throws, everything rolls back — including the sequence bump — so a
failed sale does not leave a gap in `SI-` numbering. Repositories never open
their own transactions.

### Schema and migrations

`db/schema.ts` holds the full DDL, ported verbatim from the desktop app so both
applications can share a database. The local engine applies it on every start
(idempotent). The hosted database is **not** migrated automatically: applying a
schema change there is a deliberate, separate step (compare with
`python/database/migrations/` and run the equivalent by hand). `reconcile.ts`
and `bootstrap.reconcileNumberingSequences()` exist to repair sequence drift on
databases migrated from the Python app.

## Authentication and authorization

- **Passwords**: PBKDF2-HMAC-SHA256, 200,000 iterations, 32-byte key, 16-byte
  salt, hex-encoded salt and hash. Byte-compatible with the desktop app, so
  existing users sign in unchanged. Verification is constant-time
  (`timingSafeEqual`).
- **Login**: `POST /api/auth/login` checks the user is active, verifies the
  hash, updates `last_login_at`, and returns an opaque UUID token plus the user
  profile. Tokens are random, not JWTs, and carry no claims.
- **Session store**: `Map<token, {userId, username, expiresAt}>` in the process,
  12-hour TTL. Expired tokens are deleted when presented.
- **Client behaviour**: the token lives in `localStorage` under
  `bop-erp.token`; `api.ts` attaches it to every request and, on a `401` from a
  normal endpoint, clears it and reloads the shell (the login page renders).
  Login and change-password are exempt so their inline errors survive.
- **Authorization**: there is **authentication only**. Roles exist (`Admin`,
  `Accountant`, `Manager`, `Storekeeper`, `Production Manager`) and are stored
  on users, but no route checks them. Any signed-in user can create an Admin,
  reset any password, change settings and read every report. Treat every
  account as an administrator until role checks are added; keep the user list
  short and the network private. This is called out in the deployment security
  checklist.

## Money, quantities and dates

- `domain/money.ts` is the only place money arithmetic happens.
  `Decimal` is configured to 34 digits and `ROUND_HALF_UP`; `toStorage()`
  rounds to 2 dp and rejects non-finite values and magnitudes ≥ 1e15 (the
  SQLite Cloud driver encodes whole numbers as 64-bit integers, so larger values
  would be stored incorrectly).
- Quantities round to 6 dp (`toQuantity`) so grams and millilitres survive.
- **No JavaScript floating-point arithmetic on amounts.** Code that wants to
  add or multiply uses `Decimal`, `sum()`, `multiply()`, `round2()`.
- Journal balance tolerance is 1 paisa (`0.01`), which absorbs rounding across
  many lines while still rejecting genuinely unbalanced entries.
- Dates are validated by `domain/dateValidation.ts`
  (`isoDateSchema`/`validateIsoDate`): `YYYY-MM-DD`, 1900–2100, real calendar
  date. Report ranges accept empty strings (meaning "unbounded").

## Numbering

`numbering_sequences` holds `next_number` per company/document type. Allocation
is one atomic upsert:

```sql
INSERT INTO numbering_sequences (company_id, document_type, prefix, next_number, padding)
VALUES (?, ?, ?, 2, 5)
ON CONFLICT(company_id, document_type) DO UPDATE SET next_number = next_number + 1
RETURNING prefix, next_number - 1, padding
```

A new sequence starts at 2 so the first issued number is 1; padding is 5, so
`SI-00001`. The document and its journal entry share the number, and both are
created after allocation inside the same transaction. `bootstrapDatabase()`
advances any sequence that lags behind existing document/journal numbers, which
can happen on databases migrated from the desktop app.

## Serving the client in production

When `ERP_SERVE_CLIENT` is on and `client/dist/index.html` exists:

- `express.static` serves hashed assets with
  `Cache-Control: public, max-age=31536000, immutable`.
- `index.html` is always sent with `no-cache` (both the file and the SPA
  fallback), so a deploy cannot keep serving an old bundle.
- Any `GET` that is not `/api/*` returns `index.html` (Express 5 RegExp route).
- If the build is missing, the process logs a warning and serves the API only
  instead of failing to start.

There is no client-side router: the app is a single page driven by `App.tsx`
state, so the SPA fallback only matters for deep links/reloads.

## Error model

`domain/errors.ts` defines one hierarchy; each class carries a stable code and
HTTP status:

| Class | Code | Status | Typical cause |
| --- | --- | --- | --- |
| `ValidationError` | `VALIDATION_ERROR` | 400 | Zod issues, business-rule violation |
| `UnauthorizedError` | `UNAUTHORIZED` | 401 | Missing/expired session, bad credentials |
| `NotFoundError` | `NOT_FOUND` | 404 | Unknown id or document |
| `InsufficientStockError` | `INSUFFICIENT_STOCK` | 409 | Sale/production needs more than a batch holds |
| `ConflictError` | `CONFLICT` | 409 | Duplicate invoice/voucher/user/code |
| `ConfigurationError` | `CONFIGURATION_ERROR` | 500 | Missing system account, bad engine config |
| `DatabaseError` | `DATABASE_ERROR` | 500 | Driver failure after retries |
| `UnbalancedJournalEntryError` | `UNBALANCED_JOURNAL_ENTRY` | 500 | Engine bug — should be unreachable |
| `AppError` (other) | e.g. `NUMBERING_ERROR` | 500 | Allocation failure |

Response shape is always:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [] } }
```

`details` is present only when the thrower supplied it (Zod issues, SQL text).
Unexpected exceptions are logged with a timestamp and answered with a generic
`INTERNAL_ERROR`; they never leak a stack trace to the client.

## Design decisions and trade-offs

| Decision | Why | Cost |
| --- | --- | --- |
| No ORM | The schema is shared with a non-TypeScript app; SQL stays explicit and greppable | Hand-written mapping in repositories |
| Money in `REAL` columns | Byte-compatibility with existing data | Services must remember to use `Decimal` |
| In-memory sessions | No session table or extra infrastructure | Single instance only; logout on restart |
| Authentication without roles | Scope control for the rewrite | Not safe for untrusted users yet |
| One process serving API + SPA | Simple Windows service, no IIS requirement | No horizontal scaling |
| Zod at the boundary only | One validation style for every route | Services still re-check business invariants |
| Append-only journal | Auditable books | Corrections are new entries, not edits |

## Adding to the system

**A new business action**

1. Add the method to the owning service; validate inputs, then do all writes
   and the journal entry inside `db.transaction()`.
2. Add a Zod schema and route in `http/app.ts` behind `requireAuth`.
3. Add the typed method to `client/src/api.ts` and any response type to
   `client/src/types.ts`.
4. Wire the UI in the relevant page; show `ApiError.message` on failure.
5. Add a Vitest case in the matching `server/tests/*.test.ts` and, if the UI
   changed, extend the browser audit.

**A new table or column**

1. Add it to `db/schema.ts` (local bootstrap applies it automatically).
2. Apply the same change to the hosted database deliberately; record it next to
   the Python migrations if both apps share the table.
3. Add a repository method; never write SQL in a service or route.

**A new page** — add the id to `Page` in `client/src/App.tsx`, an entry to
`NAV_SECTIONS` in `components/layout/Sidebar.tsx` (order matters: shortcuts
index the flat list), render it in `App.tsx`, and add it to `PAGES` in
`e2e/ui-audit.spec.ts` so the layout audit covers it.
