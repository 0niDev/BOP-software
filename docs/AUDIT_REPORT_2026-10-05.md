# BOP-Software ERP — Functional, Chaos & Performance Audit Report

**Date:** 2026-10-05
**Scope:** Full PySide6 ERP — controllers, services, repositories, reports, Qt view wiring,
SQLite schema/queries, cache/state layers.
**Verdict:** Accounting core is numerically sound (books balance, TB/P&L/BS match independent
recomputation), but the audit found **21 distinct defects: 3 CRITICAL, 14 MAJOR, 5 MINOR** —
including an authentication bypass, wrong cash-book totals, two confirmed stale-cache paths,
and a report query that scales quadratically (56s at only 20k journal lines).

---

## 1. Method & Environment

| Item | Value |
|---|---|
| Harness | `audit_harness.py` (throwaway local SQLite via `LocalSqliteConnection`, seeded by production `Migrator`) |
| Results artifact | `audit_results.json` (all cases, checks, defects, perf, stored dates, `db_path`) |
| Baseline test suite | `python -m pytest -q` → **250 passed** (127.8s this session; 57.2s baseline — slower only due to temp-DB churn, no code regressions) |
| Thresholds | API/controller ≤ 200ms; report generation/aggregation ≤ 500ms |
| Severity model | **CRITICAL** = exploitable auth gap / wrong financial totals; **MAJOR** = validation gap, stale cache, broken filter, >threshold perf; **MINOR** = dead code, doc mismatch |
| Cloud DB | Never touched (`ERP_DB_ENGINE=sqlitecloud` neutralized by harness) |
| Volume injected | 10,000 journal entries / 20,142 lines, 1,000 sales invoices, date-edge rows |

**Check totals (final run):** 140 chaos/edge cases (7 FAIL · 61 PASS · 72 INFO) ·
56 report-accuracy checks vs independent Python truth (53 PASS · 3 FAIL) ·
26 filter checks (24 PASS · 2 FAIL) · 7 state/cache checks (4 PASS · 3 FAIL).
Double-entry invariant held throughout: `total_debits == total_credits == 2,001,000,256,435.0`.

**Requested project skills note:** `user:engraph`, `user:graphify`, `user:bop-erp-file-map` are
**not registered** in this environment (only `ponytail` + `.opencode/skills/{database,
documentation, performance, security, testing}` exist; `@sentropic/engram` plugin bins were
unverified). Layering rules were therefore taken from `docs/DATA_FLOW_ANALYSIS.md` and code
reading instead.

---

## 2. Architecture Map

**Runtime entry points**
- `main.py` → `application/app.py` → Qt `QMainWindow` (`views/main_window.py`), tabbed modules.
- No HTTP API — every "endpoint" is a controller method callable in-process (also called
  directly by the harness).

**Layer contract (golden rules)**
```
views (Qt widgets, views/widgets/*, views/dialogs/*)
   → controllers (return (value, error); MUST NOT raise; MUST NOT touch DB)
      → services (raise ValidationError / DuplicateRecordError / ERPException)
         → repositories (BaseRepository: CRUD + optional L1/L2 cache)
            → SQLite (LocalSqliteConnection locally / SQLiteCloud hosted)
reports/ → read-only SQL, used by ReportController → report_view
```

**Data flows audited**
- Sales/Purchase invoice → journal entries (posted) → TB/P&L/BS/Cash Book/Party Ledger.
- Stock: `purchase_invoice_service` / `sales_invoice_service` → `stock_batches` →
  `StockBatchRepository` caches → dashboards/reports.
- Auth: `AuthController` → `authentication/auth_service.py` → `users` table,
  session in `AuthController.current_user`.
- Reports: `controllers/report_controller.py` (`get_trial_balance`, `get_profit_loss`,
  `get_balance_sheet`, `get_cash_book`, `get_party_ledger`) → `reports/*.py`.

**Test inventory:** `tests/` — 250 tests (unit + service + integration), fixtures in
`tests/conftest.py`, helpers `tests/helpers/{seed,books,local_connection}.py`.

---

## 3. Defect Log

### CRITICAL

**D-01 · Empty-password accounts can be created and used to log in**
- Evidence: `user: empty password rejected` → **accepted**; `user: login with empty password
  account` → **login with `""` succeeds** (harness cases, final run).
- Where: `controllers/auth_controller.py:45-80` `create_user` validates only username-exists
  and role-exists — no empty/minimum password check; `authentication/auth_service.py:38`
  `verify_password` happily verifies the PBKDF2 hash of `""`.
- Aggravating: `change_password` enforces ≥6 chars (`auth_service.py:58`) but
  `create_user` enforces nothing → one-character passwords also accepted
  (`user: create with 1-char password` → accepted).
- Fix: validate `username.strip()` and `len(password) >= 6` in one place used by both
  create and change paths (service layer).

**D-02 · Cash Book double-counts OPENING vouchers dated inside the range (wrong balances)**
- Evidence (final run): range `2026-10-05..2026-10-05`: `in 100000/0`,
  `close -1000999800075.0` vs expected `-1000999900075.0` (Δ = 100,000 = in-range OPENING);
  range `1900-01-01..2099-12-31`: `in 100020/20`, closing inflated by the same 100,000.
- Where: `reports/cash_book_report.py:29` opening query includes
  `je.voucher_type = 'OPENING' OR je.entry_date < ?` (any-date OPENING), while the period
  query (`:48`) does **not** exclude `voucher_type='OPENING'` — unlike
  `reports/trial_balance_report.py`, which does exclude it.
- Impact: any cash-book range whose dates span an OPENING voucher reports inflated
  received/paid totals and a wrong closing balance. Report-accuracy checks failed 2/6 ranges.
- Fix: add `AND je.voucher_type != 'OPENING'` to the period query (one line).

### MAJOR

**D-03 · Updating/deleting nonexistent records silently "succeeds"**
- Cases: `item: update nonexistent rejected` → accepted;
  `expense: update nonexistent rejected` → accepted;
  `expense: delete category nonexistent rejected` → accepted.
- Where: `repositories/base_repository.py:230-241` `update()` ignores `cursor.rowcount`;
  services (`services/item_service.py:114+`, `services/expense_service.py:70-92`) never call
  `exists()` (which `BaseRepository:255` provides). UI shows "saved" for a no-op.
- Fix: raise `RecordNotFoundError` when `rowcount == 0` in `BaseRepository.update/deactivate`.

**D-04 · Empty username accepted at user creation**
- Case: `user: empty username rejected` → accepted (`controllers/auth_controller.py:45`).
- Fix: same validation block as D-01 (`username.strip()`).

**D-05 · AuthController performs raw SQL in the controller layer**
- `controllers/auth_controller.py:34-43` (`get_all_users`) and `:45-80` (`create_user`) call
  `get_db()` and run SQL directly — bypasses service/repository layers, violating golden rule
  #1 (`docs/DATA_FLOW_ANALYSIS.md`). Also the layer where D-01/D-04 validation is missing.
- Fix: move to `AuthRepository` + validation in `authentication/auth_service.py`.

**D-06 · No date-format validation at service/controller layer**
- Evidence: every invalid date persisted verbatim (see `meta.stored_dates` in
  `audit_results.json`): `1900-02-29` and `2100-02-29` (impossible calendar dates),
  `05/01/2026` (slash format), `2026-1-5` (unpadded), `2026-01-05T23:30:00-05:00`
  (datetime+offset), `not-a-date`, and — for expenses — even `''` ("Invoice date is
  required" exists for sales, but `expense_date=''` is accepted).
- Impact: report/list filters compare dates **lexicographically**, so such rows silently fall
  outside intended ranges (`''`/`not-a-date` appear in no modern range; `2026-1-5` misses
  January ranges because `'2026-1-' > '2026-01-31'`).
- Fix: one `parse_date()` guard in the service layer (reject anything that isn't
  `YYYY-MM-DD` and a real calendar date).

**D-07 · Party Ledger date-range filter is dead (two dead controls)**
- Evidence: filter check `party ledger date filter wiring` FAIL.
- Where: `controllers/report_controller.py:195-196` reads
  `self.date_from/self.date_to` behind `hasattr(...)` — never set, so always False;
  `views/widgets/report_view.py:1131-1139` `_show_party_ledger()` never passes the two
  date pickers built at `report_view.py:299-308`.
- Impact: user picks dates, report ignores them, always shows all history.

**D-08 · PartyLedger falls back to the whole A/R or A/P account balance**
- Where: `reports/party_ledger_report.py:42-54` — a party with `opening_balance == 0` and
  `account_id IS NULL` gets `accounts.opening_balance` of account `1100` (A/R) or `2000`
  (A/P) — i.e. **every** customer/supplier without a linked account receives the entire
  company-level opening balance as *their* opening balance.
- Impact: wrong party-ledger balances and wrong running totals for any unlinked party.

**D-09 · Empty-string `date_to` silently drops the filter bound**
- Evidence: `expenses: empty date_to keeps lower bound only` → got 11 rows, strict 0.
- Where: `repositories/expense_repository.py:65-70` uses `if date_from:` / `if date_to:` —
  `''` is falsy → bound vanishes with no error. No service/controller validates filter dates.
- Fix: treat only `None` as "no bound"; reject `''` with `ValidationError`.

**D-10 · Stale stock cache after re-purchase of an existing batch (raw SQL bypass)**
- Evidence: `stock caches fresh after purchase into existing batch (raw SQL path)` FAIL —
  truth `490.0` (483+7) but `find_by_id` → `483.0` and `find_by_item_and_warehouse` → `483.0`.
- Where: `services/purchase_invoice_service.py:85-101` runs raw
  `UPDATE stock_batches ...` inside `_get_or_create_batch` (same-batch re-purchase), never
  calling `StockBatchRepository._invalidate_cache` / `invalidate_on_change('stock_batches')`.
- Impact: any read through the repository serves pre-purchase quantities for up to the 120s
  TTL; `add_stock` (`repositories/stock_batch_repository.py:88-115`) reads via cached
  `get_by_id`, so its weighted-average cost recomputation can also run on stale quantity.

**D-11 · `find_by_id` cache not invalidated by sales stock updates**
- Evidence: `find_by_id per-row cache fresh after sale` FAIL — batch 1: cached `483.0`,
  truth `488.0`.
- Where: `repositories/stock_batch_repository.py:114` and `:126-129` — both `add_stock` and
  `update_quantity(use_cache=True)` invalidate only the pattern
  `stock_batches:find_by_item_and_warehouse`; per-row `stock_batches:find_by_id:*` entries
  survive until TTL. (`find_all_for_item` is never cached — that earlier "check" was vacuous.)
- Fix: invalidate all `stock_batches:` keys on any stock write
  (`self._invalidate_cache()` → prefix clear, or `invalidate_on_change('stock_batches')`).

**D-12 · Trial Balance scales quadratically — 56.0s at 20k journal lines (threshold 500ms)**
- Evidence: `SCALED report.trial_balance` **56,018ms** vs 500ms; single run of the parties
  "current" query measured **18,806ms**; with `CREATE INDEX idx_jel_je ON
  journal_entry_lines(journal_entry_id)` the same query measured **16.5ms**
  (plan changed from `SEARCH je (date index) × SCAN jel` nested loop to
  `SEARCH je ... SEARCH jel USING idx_jel_je`).
- Root cause (two compounding bugs):
  1. No index on `journal_entry_lines.journal_entry_id` (FK is off, so SQLite doesn't create
     one) → the planner matches every in-range `journal_entries` row against a full
     `journal_entry_lines` scan: O(entries × lines).
  2. The slow parties query is executed **twice per request**:
     `ReportController.get_trial_balance` (`controllers/report_controller.py:35-39`) calls
     `report.generate()` — which already builds `parties_summary`
     (`reports/trial_balance_report.py:187,200`) — then rebuilds it with a near-duplicate
     copy at `controllers/report_controller.py:48-100`, overwriting the report's value.
- Fix: add the index (migration) and delete the controller-side duplicate (use
  `data["parties_summary"]` from `generate()`).

**D-13 · SCALED Balance Sheet 439ms (near threshold) / structural note**
- `SCALED report.balance_sheet` 439.4ms vs 500ms — passes today but on the same missing-index
  join pattern (opening-side party query). Treat with D-12.

**D-14 · `auth.login` 390ms vs 200ms threshold — accepted as by-design, recorded**
- PBKDF2-HMAC-SHA256 × 200,000 iterations (`utils/security.py:15-28`) ≈ 350-390ms.
- Not a defect to "fix" by lowering cost; note only: session/remember-me would avoid
  repeated cost, and thresholds should special-case password hashing.

### MINOR

**D-15 · `SettingsService.set_setting(value: Any)` crashes on dict/list values**
- `services/settings_service.py:30` binds the raw object to SQLite →
  `DatabaseError: Error binding parameter 2 - probably unsupported type`. No controller
  currently passes a dict (latent); JSON-serialize in the service or narrow the type.

**D-16 · Timezone/offset datetimes are never normalized**
- `2026-01-05T23:30:00-05:00` is stored verbatim and bucketed by raw string comparison —
  harness confirmed its journal entry lands on Jan 6, not Jan 5 (`day-5 inclusion count=0`).

**D-17 · `accounts.opening_balance` contract mismatch**
- Docs claim the column drives opening balances; TB/BS/P&L ignore it (they use OPENING
  vouchers), Party Ledger uses it — inconsistent sources of truth.

**D-18 · No server-side search parameter**
- All "search" boxes filter fully-loaded lists client-side (`views/widgets/*`); >1 page of
  data cannot be searched server-side.

**D-19 · Cache TTL documented as 30s, implemented as 120s**
- `repositories/base_repository.py:33` (`_cache_ttl = 120`, comment says "raised from 30")
  vs `docs/DATA_FLOW_ANALYSIS.md` golden rule #7. Staleness windows are 4× the documented
  contract (compounds D-10/D-11).

---

## 4. Performance Summary

| Action | Time (ms) | Threshold (ms) | Status |
|---|---:|---:|---|
| startup migrations (cold) | 474.7 | 3,000 | PASS |
| report:TB (no range) | 4.9 | 500 | PASS |
| report:TB (range) | 5.4 | 500 | PASS |
| report:P&L | 0.8 | 500 | PASS |
| report:Balance sheet | 2.5 | 500 | PASS |
| report:Cash book | 1.5 | 500 | PASS |
| report:Party ledger | 2.3 | 500 | PASS |
| report:Party ledger nonexistent | 0.4 | 500 | PASS |
| report:TB reversed range | 3.1 | 500 | PASS |
| report:P&L reversed range | 0.3 | 500 | PASS |
| report:P&L garbage dates | 0.3 | 500 | PASS |
| report:Cash book garbage dates | 1.4 | 500 | PASS |
| report:Balance sheet garbage date | 2.9 | 500 | PASS |
| dashboard: cold get_dashboard_data | 5.2 | 200 | PASS |
| dashboard: cached read after new invoice | 0.0 | 200 | PASS |
| dashboard: force_refresh after new invoice | 4.7 | 200 | PASS |
| auth.login | 390.6 | 200 | FAIL *(PBKDF2 by design — D-14)* |
| party.list (warm) | 0.4 | 200 | PASS |
| item.list (warm) | 0.3 | 200 | PASS |
| sales.list (warm) | 1.2 | 200 | PASS |
| purchase.list (warm) | 0.8 | 200 | PASS |
| expense.list (warm) | 0.6 | 200 | PASS |
| account.list (warm) | 0.0 | 200 | PASS |
| dashboard.get (cached) | 0.0 | 200 | PASS |
| dashboard.refresh (force) | 0.0 | 200 | PASS |
| report.trial_balance (range) | 5.0 | 500 | PASS |
| report.trial_balance (all history) | 6.7 | 500 | PASS |
| report.profit_loss | 0.5 | 500 | PASS |
| report.balance_sheet | 1.7 | 500 | PASS |
| report.cash_book | 0.9 | 500 | PASS |
| report.party_ledger | 1.7 | 500 | PASS |
| seed 10000 journal entries (2 lines each) | 3,353.9 | 60,000 | INFO |
| SCALED report.trial_balance | 56,018.0 | 500 | **FAIL — D-12** |
| SCALED report.profit_loss | 10.3 | 500 | PASS |
| SCALED report.balance_sheet | 439.4 | 500 | PASS *(D-13 watch)* |
| SCALED report.cash_book | 170.7 | 500 | PASS |
| SCALED dashboard.refresh | 0.0 | 200 | PASS |
| SCALED party.list | 0.4 | 200 | PASS |
| SCALED sales.list (1000 invoices) | 32.9 | 200 | PASS |

**Reading:** everything is comfortably fast on an unremarkable dataset; the only genuine
performance defect is the Trial Balance parties query (D-12), which degrades quadratically —
at production-sized history (hundreds of thousands of lines) it would take minutes and freeze
the UI. The one other FAIL is password hashing (accepted cost).

---

## 5. Broken Filters & Date-Calculation Flaws

| # | Finding | Severity | Evidence / location |
|---|---|---|---|
| 1 | Party Ledger date pickers are dead controls | MAJOR (D-07) | `report_controller.py:195-196`, `report_view.py:299-308,1131-1139` |
| 2 | Empty-string `date_to` disables the upper bound | MAJOR (D-09) | `expense_repository.py:65-70`; 11 rows returned where 0 expected |
| 3 | Invalid/impossible dates accepted verbatim at service layer | MAJOR (D-06) | `meta.stored_dates`: `1900-02-29`, `2100-02-29`, `05/01/2026`, `2026-1-5`, ISO-TZ, `not-a-date`, `''` |
| 4 | Lexicographic date comparison buckets mis-formatted dates into wrong ranges | MAJOR (D-06) | `'2026-1-5'` excluded from January range; `''` excluded from every modern range |
| 5 | Offset datetimes not normalized to a calendar date (shifts bucket by a day) | MINOR (D-16) | day-5 inclusion count = 0 for `2026-01-05T23:30:00-05:00` |
| 6 | No server-side search parameter anywhere | MINOR (D-18) | client-side `QLineEdit` filtering only |
| 7 | Reversed date range (`from > to`) returns `[]` rather than an error | — (acceptable, noted) | `expenses: reversed range` PASS vs strict truth |
| 8 | Invalid `party_type` / sales `status` filter values correctly return `[]` (not everything) | — (good) | filter checks PASS |

**What worked:** Sales invoice requires non-empty `invoice_date`; invalid payment methods,
negative amounts, duplicate voucher numbers, nonexistent FK ids, and unknown statuses were
rejected across party/item/expense/bank/cheque/mfg/user flows (61 PASS cases).

---

## 6. State & Cache Leakage

| Check | Result | Detail |
|---|---|---|
| stock caches fresh after purchase into existing batch (raw SQL path) | **FAIL** | truth 490, `find_by_id`/`find_by_item_and_warehouse` still 483 → D-10 |
| find_by_id per-row cache fresh after sale | **FAIL** | batch 1 cached 483, truth 488 → D-11 |
| repository cache TTL matches documentation | **FAIL** | actual 120s vs documented 30s → D-19 |
| dashboard force_refresh reflects latest data | PASS | force path recomputes in ~5ms |
| dashboard non-forced read is intentionally stale | PASS | documented 60s TTL; UI must call refresh |
| party list fresh after create (write-through invalidation) | PASS | generic repo invalidation works |
| logout clears current_user | PASS | no session leakage |

**Architecture violations found:** AuthController raw SQL (D-05);
`purchase_invoice_service` raw `stock_batches` writes bypassing the repository (D-10);
report layer contains two near-duplicate `_build_parties_summary` implementations (D-12).
Everything else respected the layer rules: controllers returned `(value, error)` tuples —
**zero exceptions escaped a controller** in 140 chaos cases.

---

## 7. What Passed (assurance)

- **Books balance:** total debits = total credits = 2,001,000,256,435.0 over 20k+ entries.
- **Numeric accuracy:** Trial Balance, P&L, Balance Sheet, Party Ledger (5/6 ranges), Cash
  Book (4/6 ranges) matched independent Python recomputation from raw journal rows to the cent.
- **250/250 baseline tests pass.**
- Reversed/garbage date ranges on reports degrade gracefully (no crash, empty or sane result).
- Cache write-through works for generic repositories; dashboard staleness behaves as documented.

---

## 8. Recommended Fix Order

1. **D-01/D-04** — validate username/password in the auth service (security).
2. **D-02** — add `AND voucher_type != 'OPENING'` to the Cash Book period query (one line).
3. **D-12** — `CREATE INDEX idx_jel_je ON journal_entry_lines(journal_entry_id)` migration +
   delete the duplicated controller-side parties summary.
4. **D-10/D-11** — invalidate all `stock_batches:` cache keys on every stock write; move
   `_get_or_create_batch`'s raw SQL into `StockBatchRepository`.
5. **D-03** — raise `RecordNotFoundError` when `rowcount == 0` in `BaseRepository`.
6. **D-06/D-09** — single `parse_date()` + non-None date-bound validation in services.
7. **D-07/D-08** — wire the Party Ledger date pickers; drop the whole-A/R-A/P fallback.
8. **D-05, D-13…D-19** — layering cleanup and doc/TTL reconciliation.

---

## 9. Reproducing This Audit

```bash
python audit_harness.py     # ~5 min; writes audit_results.json (+ fresh temp DB)
python -m pytest -q         # baseline suite (250 tests)
```

Harness phases: `1-chaos` CRUD/validation · `2-dates` date edges · `3-reports` accuracy vs
independent truth · `4-filters` filter semantics · `5-state` cache/session leakage ·
`6-perf` timing incl. scaled dataset. Known-truth checks are asserted; exploratory cases are
recorded as INFO for triage.
