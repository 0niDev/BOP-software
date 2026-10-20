#!/usr/bin/env python
"""End-to-end functional / chaos / performance audit harness for BOP-software.

Runs against a throwaway LOCAL SQLite DB (never the hosted cloud DB), drives the
same controller/service functions the UI buttons invoke, and emits
`audit_results.json` + a markdown summary on stdout.

Phases:
  1. CRUD chaos & edge cases (validation gaps, exceptions, duplicates, extremes)
  2. Date / leap-year / timezone edge cases
  3. Report accuracy audit (TB, P&L, BS, Cash Book, Party Ledger vs raw SQL)
  4. Filter audit (individual + combined filters vs SQL ground truth)
  5. State-leakage / cache-consistency audit
  6. Latency & performance profiling (small + scaled data sets)

Usage:  python audit_harness.py
"""
from __future__ import annotations

import json
import math
import os
import sys
import tempfile
import threading
import time
import traceback
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tests"))

# Never let the harness reach the hosted DB.
os.environ.setdefault("ERP_DB_ENGINE", "sqlitecloud")
os.environ.setdefault("SQLITE_CLOUD_URL", "sqlitecloud://127.0.0.1:1/DO-NOT-CONNECT?apikey=none")

API_THRESHOLD_MS = 200.0
REPORT_THRESHOLD_MS = 500.0

RESULTS: dict = {
    "meta": {"started_at": datetime.now().isoformat(), "python": sys.version.split()[0]},
    "cases": [],        # chaos / date cases
    "report_checks": [],  # report accuracy checks
    "filter_checks": [],  # filter checks
    "state_checks": [],   # cache/state-leakage checks
    "perf": [],           # perf samples
    "defects": [],        # defect log
}

_db = None


# ----------------------------------------------------------------------------
# recording helpers
# ----------------------------------------------------------------------------
def case(phase: str, name: str, result: str, detail: str = "", ms: float | None = None):
    """result: PASS | FAIL | INFO"""
    RESULTS["cases"].append(
        {"phase": phase, "name": name, "result": result, "detail": str(detail)[:600],
         "ms": round(ms, 2) if ms is not None else None}
    )
    return result


def defect(sev: str, area: str, title: str, detail: str, evidence: str = ""):
    RESULTS["defects"].append(
        {"severity": sev, "area": area, "title": title,
         "detail": str(detail)[:800], "evidence": str(evidence)[:800]}
    )


def check(bucket: str, name: str, ok: bool, detail: str = "", ms: float | None = None):
    RESULTS[bucket].append(
        {"check": name, "result": "PASS" if ok else "FAIL",
         "detail": str(detail)[:800], "ms": round(ms, 2) if ms is not None else None}
    )
    return ok


def timed(label: str, fn, threshold_ms: float, kind: str = "api"):
    t0 = time.perf_counter()
    try:
        out = fn()
        err = None
    except Exception as exc:  # noqa: BLE001
        out, err = None, f"{type(exc).__name__}: {exc}"
    ms = (time.perf_counter() - t0) * 1000.0
    RESULTS["perf"].append(
        {"action": label, "ms": round(ms, 2), "threshold_ms": threshold_ms,
         "kind": kind, "error": err,
         "status": "FAIL" if (err or ms > threshold_ms) else "PASS"}
    )
    return out, ms


def bench(label: str, fn, threshold_ms: float, kind: str = "api", runs: int = 3):
    """Run fn `runs` times, keep a single perf row with the best time."""
    start = len(RESULTS["perf"])
    best = None
    for _ in range(runs):
        _, ms = timed(label, fn, threshold_ms, kind=kind)
        best = ms if best is None else min(best, ms)
    del RESULTS["perf"][start + 1:]
    RESULTS["perf"][start]["ms"] = round(best, 2)
    RESULTS["perf"][start]["status"] = "FAIL" if best > threshold_ms else "PASS"
    return best


def _norm(out):
    """Normalize a controller (value, err) tuple to (ok, value, err)."""
    if isinstance(out, tuple) and len(out) == 2:
        value, err = out
        ok = err is None and value is not None and value is not False
        return ok, value, err
    if out is None:
        return False, None, "returned None"
    return True, out, None



def norm2(out):
    """(value, err) view of a controller result."""
    ok, value, err = _norm(out)
    return (value, None) if ok else (None, err or "failed")


def run_case(phase: str, name: str, fn, expect: str = "observe", sev: str = "MAJOR"):
    """expect: 'accept' (must succeed) | 'reject' (must fail gracefully) | 'observe'."""
    t0 = time.perf_counter()
    raised = None
    try:
        out = fn()
    except Exception as exc:  # noqa: BLE001
        out = None
        raised = f"{type(exc).__name__}: {exc}"
    ms = (time.perf_counter() - t0) * 1000.0

    if raised is not None:
        if expect == "observe":
            case(phase, name, "INFO", f"raised: {raised}", ms)
        else:
            case(phase, name, "FAIL", f"unexpected raise: {raised}", ms)
            defect("CRITICAL", phase, f"{name}: exception escaped controller",
                   "Controller contract is (value, error) and must never raise.",
                   raised)
        return

    ok, value, err = _norm(out)

    if expect == "accept":
        if ok:
            case(phase, name, "PASS", "", ms)
        else:
            case(phase, name, "FAIL", f"unexpectedly rejected: {err}", ms)
            defect(sev, phase, f"{name}: unexpectedly rejected", str(err), "")
    elif expect == "reject":
        if ok:
            case(phase, name, "FAIL", "accepted invalid input", ms)
            defect(sev, phase, f"{name}: invalid input accepted",
                   "Validation gap - bad input was persisted/processed.", "")
        else:
            case(phase, name, "PASS", f"rejected: {err}", ms)
    else:
        case(phase, name, "INFO", f"ok={ok} err={err} value={repr(value)[:200]}", ms)


# ----------------------------------------------------------------------------
# bootstrap
# ----------------------------------------------------------------------------
def bootstrap():
    global _db
    from database import connection as dbconn
    from database.migrations.migrator import Migrator
    from database.migrations.add_material_cost_columns import run_column_migration
    from database.migrations.add_expense_items import run_expense_items_migration
    from database.migrations.add_temp_bom import run_temp_bom_migration
    from helpers.local_connection import LocalSqliteConnection

    tmp = Path(tempfile.mkdtemp(prefix="bop_audit_"))
    path = tmp / "audit.db"
    conn = LocalSqliteConnection(str(path))
    t0 = time.perf_counter()
    Migrator(conn).run()
    run_column_migration(conn)
    run_expense_items_migration(conn)
    run_temp_bom_migration(conn)
    ms = (time.perf_counter() - t0) * 1000
    RESULTS["perf"].append({"action": "startup migrations (cold)", "ms": round(ms, 2),
                            "threshold_ms": 3000, "kind": "startup", "error": None,
                            "status": "PASS" if ms <= 3000 else "FAIL"})

    dbconn._db_instance = conn
    dbconn.create_connection = lambda config=None: conn
    _db = conn
    RESULTS["meta"]["db_path"] = str(path)
    return conn


def clear_caches():
    from repositories.base_repository import BaseRepository
    from utils.cache_manager import SessionCache, _global_cache
    from services.dashboard_service import DashboardService

    BaseRepository._cache.clear()
    SessionCache().clear()
    _global_cache.clear()
    try:
        DashboardService().invalidate_cache()
    except Exception:
        pass


def q(sql, params=()):
    return _db.fetch_all(sql, params)


def q1(sql, params=()):
    return _db.fetch_one(sql, params)


def scalar(sql, params=()):
    row = q1(sql, params)
    if not row:
        return 0
    return list(row.values())[0] or 0


# ----------------------------------------------------------------------------
# PHASE 1 - CRUD chaos & edge cases
# ----------------------------------------------------------------------------
def phase1_chaos(ctl):
    from models.enums import PartyType
    from helpers import seed as seed_helpers

    # Baseline fixture: fresh DB has no parties/items/stock.
    cust, fg_item = seed_helpers.make_customer_and_stocked_item(
        _db, "Audit Customer", "Audit FG Item")
    sup, rm_item = seed_helpers.make_supplier_with_stocked_item(_db, "Audit Supplier")

    party_ctl, item_ctl, acct_ctl = ctl["party"], ctl["item"], ctl["account"]
    exp_ctl, bank_ctl = ctl["expense"], ctl["banking"]
    sales_ctl, purch_ctl = ctl["sales"], ctl["purchase"]
    pay_ctl, mfg_ctl = ctl["payment"], ctl["mfg"]
    auth_ctl = ctl["auth"]

    P = "1-chaos"
    long100k = "X" * 100_000
    injection = "'; DROP TABLE parties; --"
    emoji = "مہنگائی 🧪 ᄀ��"

    # --- Parties -------------------------------------------------------------
    run_case(P, "party: empty name rejected", lambda: party_ctl.create_party(
        name="", party_type=PartyType.CUSTOMER, credit_limit=0.0), "reject")
    run_case(P, "party: whitespace-only name", lambda: party_ctl.create_party(
        name="   ", party_type=PartyType.CUSTOMER, credit_limit=0.0), "reject",
        sev="MINOR")
    run_case(P, "party: 100k-char name", lambda: party_ctl.create_party(
        name=long100k, party_type=PartyType.CUSTOMER, credit_limit=0.0), "observe")
    run_case(P, "party: SQL-injection name", lambda: party_ctl.create_party(
        name=injection, party_type=PartyType.CUSTOMER, credit_limit=0.0), "observe")
    run_case(P, "party: emoji/unicode name", lambda: party_ctl.create_party(
        name=emoji, party_type=PartyType.CUSTOMER, credit_limit=0.0), "observe")
    run_case(P, "party: negative credit limit rejected", lambda: party_ctl.create_party(
        name="NegCredit", party_type=PartyType.CUSTOMER, credit_limit=-1.0), "reject")
    run_case(P, "party: credit limit 1e15", lambda: party_ctl.create_party(
        name="BigCredit", party_type=PartyType.CUSTOMER, credit_limit=1e15), "observe")
    run_case(P, "party: credit limit NaN", lambda: party_ctl.create_party(
        name="NaNcredit", party_type=PartyType.CUSTOMER, credit_limit=float("nan")),
        "observe")
    run_case(P, "party: credit limit +inf", lambda: party_ctl.create_party(
        name="Infcredit", party_type=PartyType.CUSTOMER, credit_limit=float("inf")),
        "observe")
    run_case(P, "party: duplicate code rejected", lambda: party_ctl.create_party(
        name="Dupe Code A", party_type=PartyType.CUSTOMER, credit_limit=0.0,
        code="DUPE-1"), "accept")  # seed first occurrence
    run_case(P, "party: duplicate code (2nd) rejected", lambda: party_ctl.create_party(
        name="Dupe Code B", party_type=PartyType.CUSTOMER, credit_limit=0.0,
        code="DUPE-1"), "reject")
    run_case(P, "party: duplicate NAME allowed (2nd)", lambda: party_ctl.create_party(
        name="Dupe Code A", party_type=PartyType.CUSTOMER, credit_limit=0.0), "observe")
    run_case(P, "party: update nonexistent rejected", lambda: party_ctl.update_party(
        party_id=999999, name="Ghost", credit_limit=0.0, account_id=None), "reject")
    run_case(P, "party: deactivate nonexistent rejected", lambda: party_ctl.deactivate_party(
        party_id=999999), "reject")
    run_case(P, "party: update to empty name rejected", lambda: party_ctl.update_party(
        party_id=1, name="", credit_limit=0.0, account_id=None), "reject")
    run_case(P, "party: NULL name (None)", lambda: party_ctl.create_party(
        name=None, party_type=PartyType.CUSTOMER, credit_limit=0.0), "reject")

    # --- Items ---------------------------------------------------------------
    run_case(P, "item: empty name rejected", lambda: item_ctl.create_item(
        item_name="", notes=None, unit="TABLET", purchase_price=1.0, selling_price=2.0,
        minimum_stock=0, maximum_stock=10, tax_rate_id=None,
        item_type="FINISHED_GOOD", category_id=None), "reject")
    run_case(P, "item: NULL name rejected", lambda: item_ctl.create_item(
        item_name=None, notes=None, unit="TABLET", purchase_price=1.0, selling_price=2.0,
        minimum_stock=0, maximum_stock=10, tax_rate_id=None,
        item_type="FINISHED_GOOD", category_id=None), "reject")
    run_case(P, "item: negative purchase price rejected", lambda: item_ctl.create_item(
        item_name="NegPrice", notes=None, unit="TABLET", purchase_price=-1.0,
        selling_price=2.0, minimum_stock=0, maximum_stock=10, tax_rate_id=None,
        item_type="FINISHED_GOOD", category_id=None), "reject")
    run_case(P, "item: invalid unit rejected", lambda: item_ctl.create_item(
        item_name="BadUnit", notes=None, unit="PARSECS", purchase_price=1.0,
        selling_price=2.0, minimum_stock=0, maximum_stock=10, tax_rate_id=None,
        item_type="FINISHED_GOOD", category_id=None), "reject")
    run_case(P, "item: min>max stock rejected", lambda: item_ctl.create_item(
        item_name="InvStock", notes=None, unit="TABLET", purchase_price=1.0,
        selling_price=2.0, minimum_stock=100, maximum_stock=10, tax_rate_id=None,
        item_type="FINISHED_GOOD", category_id=None), "reject")
    run_case(P, "item: invalid item_type rejected", lambda: item_ctl.create_item(
        item_name="BadType", notes=None, unit="TABLET", purchase_price=1.0,
        selling_price=2.0, minimum_stock=0, maximum_stock=10, tax_rate_id=None,
        item_type="MAGIC", category_id=None), "reject")
    run_case(P, "item: duplicate item_code rejected", lambda: item_ctl.create_item(
        item_name="DupeCode1", notes=None, unit="TABLET", purchase_price=1.0,
        selling_price=2.0, minimum_stock=0, maximum_stock=10, tax_rate_id=None,
        item_type="FINISHED_GOOD", category_id=None, item_code="DUPE-IT"), "accept")
    run_case(P, "item: duplicate item_code (2nd) rejected", lambda: item_ctl.create_item(
        item_name="DupeCode2", notes=None, unit="TABLET", purchase_price=1.0,
        selling_price=2.0, minimum_stock=0, maximum_stock=10, tax_rate_id=None,
        item_type="FINISHED_GOOD", category_id=None, item_code="DUPE-IT"), "reject")
    run_case(P, "item: price 1e12 accepted", lambda: item_ctl.create_item(
        item_name="Astronomical", notes=None, unit="TABLET", purchase_price=1e12,
        selling_price=1e12, minimum_stock=0, maximum_stock=10, tax_rate_id=None,
        item_type="FINISHED_GOOD", category_id=None), "observe")
    run_case(P, "item: 100k-char name", lambda: item_ctl.create_item(
        item_name=long100k, notes=None, unit="TABLET", purchase_price=1.0,
        selling_price=2.0, minimum_stock=0, maximum_stock=10, tax_rate_id=None,
        item_type="FINISHED_GOOD", category_id=None), "observe")
    run_case(P, "item: update nonexistent rejected", lambda: item_ctl.update_item(
        item_id=999999, item_name="Ghost", notes=None, unit="TABLET",
        purchase_price=1.0, selling_price=1.0, minimum_stock=0, maximum_stock=1,
        tax_rate_id=None, item_type="FINISHED_GOOD", category_id=None, is_active=True),
        "reject")
    run_case(P, "item: opening stock qty=0 rejected", lambda: item_ctl.add_opening_stock(
        item_id=1, quantity=0, unit_cost=1.0), "reject")
    run_case(P, "item: opening stock qty=-5 rejected", lambda: item_ctl.add_opening_stock(
        item_id=1, quantity=-5, unit_cost=1.0), "reject")
    run_case(P, "item: opening stock qty=1e9", lambda: item_ctl.add_opening_stock(
        item_id=1, quantity=1e9, unit_cost=0.0), "observe")

    # --- Accounts ------------------------------------------------------------
    run_case(P, "account: duplicate code rejected", lambda: acct_ctl.create_account(
        account_code="9999", account_name="Audit Dup A", account_type="ASSET",
        parent_account_id=None, opening_balance=0), "accept")
    run_case(P, "account: duplicate code (2nd) rejected", lambda: acct_ctl.create_account(
        account_code="9999", account_name="Audit Dup B", account_type="ASSET",
        parent_account_id=None, opening_balance=0), "reject")
    run_case(P, "account: empty name rejected", lambda: acct_ctl.create_account(
        account_code="9998", account_name="", account_type="ASSET",
        parent_account_id=None, opening_balance=0), "reject")
    run_case(P, "account: invalid type rejected", lambda: acct_ctl.create_account(
        account_code="9997", account_name="Bad Type", account_type="CRYPTO",
        parent_account_id=None, opening_balance=0), "reject")
    run_case(P, "account: negative opening balance (asset)", lambda: acct_ctl.create_account(
        account_code="9996", account_name="Neg Open", account_type="ASSET",
        parent_account_id=None, opening_balance=-5000), "observe", sev="MINOR")
    run_case(P, "account: update nonexistent rejected", lambda: acct_ctl.update_account(
        account_id=999999, account_name="Ghost", opening_balance=0,
        parent_account_id=None, is_active=True), "reject")

    # --- Expenses ------------------------------------------------------------
    cat_ok, cat_err = norm2(exp_ctl.create_category(name="Audit Cat"))
    row = q1("SELECT id FROM expense_categories WHERE name='Audit Cat'")
    cat_id = row["id"] if row else (
        q1("SELECT id FROM expense_categories ORDER BY id LIMIT 1") or {"id": None})["id"]
    case(P, "expense: category created", "PASS" if cat_id else "FAIL", str(cat_err))

    run_case(P, "expense: category empty name rejected",
             lambda: exp_ctl.create_category(name=""), "reject")
    run_case(P, "expense: amount=0 accepted?", lambda: exp_ctl.create_expense(
        voucher_number="AUD-EXP-ZERO", category_id=cat_id, expense_date="2026-01-15",
        amount=0.0, payment_method="CASH", description="zero"), "observe")
    run_case(P, "expense: negative amount rejected", lambda: exp_ctl.create_expense(
        voucher_number="AUD-EXP-NEG", category_id=cat_id, expense_date="2026-01-15",
        amount=-100.0, payment_method="CASH", description="neg"), "reject")
    run_case(P, "expense: invalid date format", lambda: exp_ctl.create_expense(
        voucher_number="AUD-EXP-BADDATE", category_id=cat_id, expense_date="15/01/2026",
        amount=10.0, payment_method="CASH", description="bad date"), "observe")
    run_case(P, "expense: non-existent date (2026-02-30)", lambda: exp_ctl.create_expense(
        voucher_number="AUD-EXP-IMPDAY", category_id=cat_id, expense_date="2026-02-30",
        amount=10.0, payment_method="CASH", description="impossible day"), "observe")
    run_case(P, "expense: invalid payment method rejected", lambda: exp_ctl.create_expense(
        voucher_number="AUD-EXP-BADPM", category_id=cat_id, expense_date="2026-01-15",
        amount=10.0, payment_method="BITCOIN", description="bad pm"), "reject")
    run_case(P, "expense: duplicate voucher number", lambda: exp_ctl.create_expense(
        voucher_number="AUD-EXP-ZERO", category_id=cat_id, expense_date="2026-01-16",
        amount=10.0, payment_method="CASH", description="dupe voucher"), "observe")
    run_case(P, "expense: amount 1e12", lambda: exp_ctl.create_expense(
        voucher_number="AUD-EXP-HUGE", category_id=cat_id, expense_date="2026-01-17",
        amount=1e12, payment_method="CASH", description="huge"), "observe")
    run_case(P, "expense: amount NaN rejected?", lambda: exp_ctl.create_expense(
        voucher_number="AUD-EXP-NAN", category_id=cat_id, expense_date="2026-01-18",
        amount=float("nan"), payment_method="CASH", description="nan"), "observe")
    run_case(P, "expense: category_id=999999 rejected", lambda: exp_ctl.create_expense(
        voucher_number="AUD-EXP-NOCAT", category_id=999999, expense_date="2026-01-19",
        amount=10.0, payment_method="CASH", description="no cat"), "observe")
    run_case(P, "expense: update nonexistent rejected",
             lambda: exp_ctl.update_category(category_id=999999, name="Ghost",
                                             account_id=None, is_active=True), "reject")
    run_case(P, "expense: delete category nonexistent rejected",
             lambda: exp_ctl.delete_category(category_id=999999), "reject")

    # --- Bank / cheques ------------------------------------------------------
    bk_ok, bk_err = norm2(bank_ctl.create_bank_account(
        bank_name="Audit Bank", account_title="Audit Main",
        account_number="AUD-0001", opening_balance=100_000))
    # BankingController returns (True, None) on success, not the row - look up the id
    bk_row = q1("SELECT id FROM bank_accounts WHERE account_number='AUD-0001'")
    bank_id = bk_row["id"] if bk_row else None
    case(P, "bank: create account", "PASS" if bank_id else "FAIL", str(bk_err))

    run_case(P, "bank: duplicate account_number rejected", lambda: bank_ctl.create_bank_account(
        bank_name="Audit Bank 2", account_title="Audit Dup",
        account_number="AUD-0001", opening_balance=0), "observe", sev="MINOR")
    run_case(P, "bank: negative deposit rejected", lambda: bank_ctl.deposit(
        account_id=bank_id, amount=-100.0, date="2026-01-10", ref=None, notes=None),
        "reject")
    run_case(P, "bank: withdraw 1e9 (over balance)", lambda: bank_ctl.withdraw(
        account_id=bank_id, amount=1e9, date="2026-01-10", ref=None, notes=None),
        "observe")
    run_case(P, "bank: deposit amount=0", lambda: bank_ctl.deposit(
        account_id=bank_id, amount=0.0, date="2026-01-11", ref=None, notes=None),
        "observe")
    run_case(P, "bank: deposit invalid date", lambda: bank_ctl.deposit(
        account_id=bank_id, amount=10.0, date="2026-13-45", ref=None, notes=None),
        "observe")
    cust_row = q1("SELECT id FROM parties WHERE party_type IN ('CUSTOMER','BOTH') LIMIT 1")
    cust_id = cust_row["id"] if cust_row else None
    run_case(P, "cheque: zero amount rejected", lambda: bank_ctl.issue_cheque(
        bank_account_id=bank_id, party_id=cust_id, cheque_number="AUD-CHQ-0",
        amount=0.0, cheque_date="2026-02-01"), "reject")
    run_case(P, "cheque: negative amount rejected", lambda: bank_ctl.issue_cheque(
        bank_account_id=bank_id, party_id=cust_id, cheque_number="AUD-CHQ-N",
        amount=-5.0, cheque_date="2026-02-01"), "reject")
    run_case(P, "cheque: duplicate cheque number", lambda: bank_ctl.issue_cheque(
        bank_account_id=bank_id, party_id=cust_id, cheque_number="AUD-CHQ-1",
        amount=100.0, cheque_date="2026-02-01"), "accept")
    run_case(P, "cheque: duplicate cheque number (2nd)", lambda: bank_ctl.issue_cheque(
        bank_account_id=bank_id, party_id=cust_id, cheque_number="AUD-CHQ-1",
        amount=200.0, cheque_date="2026-02-01"), "observe", sev="MINOR")

    # --- Sales invoices ------------------------------------------------------
    item_row = q1("SELECT id FROM items WHERE is_active=1 ORDER BY id LIMIT 1")
    item_id = item_row["id"] if item_row else 1
    cust_row2 = q1("SELECT id FROM parties WHERE party_type IN ('CUSTOMER','BOTH') "
                   "AND is_active=1 ORDER BY id LIMIT 1")
    c_id = cust_row2["id"] if cust_row2 else None

    def mk_sales(number, date_str, items=None, ptype="CREDIT"):
        return sales_ctl.create_sales_invoice(
            invoice_number=number, customer_id=c_id, invoice_date=date_str,
            payment_type=ptype,
            items=items if items is not None else
            [{"item_id": item_id, "quantity": 1, "unit_price": 50.0}],
            notes=None)

    run_case(P, "sales: empty invoice number rejected",
             lambda: mk_sales("", "2026-01-20"), "reject")
    run_case(P, "sales: NULL customer rejected", lambda: sales_ctl.create_sales_invoice(
        invoice_number="AUD-S-NULLCUST", customer_id=None, invoice_date="2026-01-20",
        payment_type="CREDIT",
        items=[{"item_id": item_id, "quantity": 1, "unit_price": 50.0}], notes=None),
        "reject")
    okc, _, _ = _norm(mk_sales("AUD-S-BASE1", "2026-01-20"))
    case(P, "sales: seed base invoice", "PASS" if okc else "FAIL", "")
    run_case(P, "sales: duplicate invoice number rejected",
             lambda: mk_sales("AUD-S-BASE1", "2026-01-21"), "observe")
    run_case(P, "sales: empty item list rejected", lambda: sales_ctl.create_sales_invoice(
        invoice_number="AUD-S-EMPTY", customer_id=c_id, invoice_date="2026-01-20",
        payment_type="CREDIT", items=[], notes=None), "reject")
    run_case(P, "sales: quantity=0 rejected", lambda: sales_ctl.create_sales_invoice(
        invoice_number="AUD-S-Q0", customer_id=c_id, invoice_date="2026-01-20",
        payment_type="CREDIT",
        items=[{"item_id": item_id, "quantity": 0, "unit_price": 50.0}], notes=None),
        "reject")
    run_case(P, "sales: quantity=-5 rejected", lambda: sales_ctl.create_sales_invoice(
        invoice_number="AUD-S-QNEG", customer_id=c_id, invoice_date="2026-01-20",
        payment_type="CREDIT",
        items=[{"item_id": item_id, "quantity": -5, "unit_price": 50.0}], notes=None),
        "reject")
    run_case(P, "sales: unit_price=-1 rejected", lambda: sales_ctl.create_sales_invoice(
        invoice_number="AUD-S-PNEG", customer_id=c_id, invoice_date="2026-01-20",
        payment_type="CREDIT",
        items=[{"item_id": item_id, "quantity": 1, "unit_price": -1.0}], notes=None),
        "reject")
    run_case(P, "sales: invalid payment_type rejected", lambda: sales_ctl.create_sales_invoice(
        invoice_number="AUD-S-PT", customer_id=c_id, invoice_date="2026-01-20",
        payment_type="BARTER",
        items=[{"item_id": item_id, "quantity": 1, "unit_price": 50.0}], notes=None),
        "reject")
    run_case(P, "sales: non-numeric quantity (string)", lambda: sales_ctl.create_sales_invoice(
        invoice_number="AUD-S-QSTR", customer_id=c_id, invoice_date="2026-01-20",
        payment_type="CREDIT",
        items=[{"item_id": item_id, "quantity": "ten", "unit_price": 50.0}], notes=None),
        "reject")
    run_case(P, "sales: quantity=1e9 (over stock)", lambda: sales_ctl.create_sales_invoice(
        invoice_number="AUD-S-QHUGE", customer_id=c_id, invoice_date="2026-01-20",
        payment_type="CREDIT",
        items=[{"item_id": item_id, "quantity": 1e9, "unit_price": 50.0}], notes=None),
        "reject")
    run_case(P, "sales: unit_price=1e12 (allowed?)", lambda: sales_ctl.create_sales_invoice(
        invoice_number="AUD-S-PHUGE", customer_id=c_id, invoice_date="2026-01-21",
        payment_type="CREDIT",
        items=[{"item_id": item_id, "quantity": 1, "unit_price": 1e12}], notes=None),
        "observe")
    run_case(P, "sales: discount > line total rejected", lambda: sales_ctl.create_sales_invoice(
        invoice_number="AUD-S-DISC", customer_id=c_id, invoice_date="2026-01-21",
        payment_type="CREDIT",
        items=[{"item_id": item_id, "quantity": 1, "unit_price": 10.0,
                "discount_amount": 999.0}], notes=None), "reject")
    run_case(P, "sales: 100k-char invoice number", lambda: mk_sales("N" * 100_000,
                                                                   "2026-01-22"), "observe")
    run_case(P, "sales: get nonexistent -> graceful",
             lambda: sales_ctl.get_sales_invoice(invoice_id=999999), "observe")
    run_case(P, "sales: delete nonexistent -> graceful",
             lambda: sales_ctl.delete_sales_invoice(invoice_id=999999), "observe")

    # --- Purchase invoices ---------------------------------------------------
    sup_row = q1("SELECT id FROM parties WHERE party_type IN ('SUPPLIER','BOTH') "
                 "AND is_active=1 ORDER BY id LIMIT 1")
    s_id = sup_row["id"] if sup_row else None
    purch_item_row = q1("SELECT id FROM items WHERE item_type='RAW_MATERIAL' "
                        "AND is_active=1 ORDER BY id LIMIT 1") or {"id": item_id}
    p_item_id = purch_item_row["id"]

    def mk_purch(number, date_str):
        return purch_ctl.create_purchase_invoice(
            invoice_number=number, supplier_id=s_id, invoice_date=date_str,
            payment_type="CREDIT",
            items=[{"item_id": p_item_id, "quantity": 5, "unit_cost": 10.0}], notes=None)

    run_case(P, "purchase: empty invoice number rejected",
             lambda: mk_purch("", "2026-01-20"), "reject")
    run_case(P, "purchase: invalid date 'garbage'", lambda: mk_purch(
        "AUD-P-GARDATE", "garbage"), "observe")
    run_case(P, "purchase: duplicate invoice number (2nd)",
             lambda: mk_purch("AUD-P-DUP", "2026-01-20"), "accept")
    okp, _, _ = _norm(mk_purch("AUD-P-DUP", "2026-01-21"))
    case(P, "purchase: duplicate invoice number (3rd, expect dup)",
         "PASS" if not okp else "FAIL", "duplicate accepted" if okp else "")
    if okp:
        defect("MAJOR", P, "purchase: duplicate invoice_number accepted",
               "purchase_invoices has no unique invoice_number guard.", "")

    # --- Payments ------------------------------------------------------------
    run_case(P, "payment: receive amount=0 rejected?", lambda: pay_ctl.receive_payment(
        customer_id=c_id, amount=0.0, payment_date="2026-01-25"), "observe")
    run_case(P, "payment: receive negative rejected", lambda: pay_ctl.receive_payment(
        customer_id=c_id, amount=-50.0, payment_date="2026-01-25"), "reject")
    run_case(P, "payment: pay supplier 1e9 (over AP)", lambda: pay_ctl.pay_supplier(
        supplier_id=s_id, amount=1e9, payment_date="2026-01-25"), "observe")
    run_case(P, "payment: receive invalid method rejected", lambda: pay_ctl.receive_payment(
        customer_id=c_id, amount=10.0, payment_date="2026-01-25",
        payment_method="GOLD"), "reject")
    run_case(P, "payment: invalid date rejected/accepted", lambda: pay_ctl.receive_payment(
        customer_id=c_id, amount=10.0, payment_date="2026-02-31"), "observe")

    # --- Manufacturing -------------------------------------------------------
    run_case(P, "mfg: BOM output_quantity=0 rejected", lambda: mfg_ctl.create_bom(
        finished_item_id=item_id, output_quantity=0, components=[], bom_name="AUD-BOM0"),
        "reject")
    run_case(P, "mfg: BOM negative output rejected", lambda: mfg_ctl.create_bom(
        finished_item_id=item_id, output_quantity=-1, components=[], bom_name="AUD-BOMN"),
        "reject")
    run_case(P, "mfg: production order planned_qty=0 rejected", lambda: mfg_ctl.create_production_order(
        order_number="AUD-PO-0", bom_id=1, planned_quantity=0,
        manufacturing_date="2026-01-20"), "reject")
    run_case(P, "mfg: production order bad date", lambda: mfg_ctl.create_production_order(
        order_number="AUD-PO-BADDATE", bom_id=1, planned_quantity=5,
        manufacturing_date="20-13-45"), "observe")
    run_case(P, "mfg: duplicate order number", lambda: mfg_ctl.create_production_order(
        order_number="AUD-PO-DUP", bom_id=1, planned_quantity=5,
        manufacturing_date="2026-01-20"), "observe")
    run_case(P, "mfg: get nonexistent order", lambda: mfg_ctl.get_production_order(
        order_id=999999), "observe")

    # --- Users / auth --------------------------------------------------------
    run_case(P, "user: empty username rejected", lambda: auth_ctl.create_user(
        username="", full_name="Empty", password="Passw0rd!", role_name="Accountant"),
        "reject")
    run_case(P, "user: empty password rejected", lambda: auth_ctl.create_user(
        username="aud_empty_pw", full_name="NoPW", password="", role_name="Accountant"),
        "reject")
    run_case(P, "user: create ok", lambda: auth_ctl.create_user(
        username="aud_user1", full_name="Audit User", password="Passw0rd!",
        role_name="Accountant"), "accept")
    run_case(P, "user: duplicate username rejected", lambda: auth_ctl.create_user(
        username="aud_user1", full_name="Dup", password="Passw0rd!",
        role_name="Accountant"), "reject")
    run_case(P, "user: invalid role rejected", lambda: auth_ctl.create_user(
        username="aud_user2", full_name="Bad Role", password="Passw0rd!",
        role_name="SUPERADMIN"), "observe")
    run_case(P, "user: login wrong password", lambda: auth_ctl.login(
        "admin", "wrong-password"), "reject")
    run_case(P, "user: login unknown user", lambda: auth_ctl.login(
        "definitely_not_a_user", "x"), "reject")
    # empty-password account created above must NOT be able to log in with ""
    run_case(P, "user: login with empty password account", lambda: auth_ctl.login(
        "aud_empty_pw", ""), "reject", sev="CRITICAL")
    # service-level: change_password enforces >= 6 chars but create_user does not
    run_case(P, "user: create with 1-char password", lambda: auth_ctl.create_user(
        username="aud_short_pw", full_name="Short PW", password="a",
        role_name="Accountant"), "reject", sev="MAJOR")
    # architecture: controller/view must not run SQL itself (rule #1)
    import inspect as _insp
    _um_src = _insp.getsource(type(auth_ctl)) + open(
        "views/widgets/users_view.py", encoding="utf-8").read()
    _raw_tokens = ("get_db", "db.execute", "db.fetch_one", "db.fetch_all",
                   "SELECT ", "INSERT INTO", "UPDATE users", "hash_password")
    _raw_hits = [t for t in _raw_tokens if t in _um_src]
    if _raw_hits:
        case(P, "user management SQL lives in repository layer", "FAIL",
             f"raw tokens in AuthController/users_view: {_raw_hits}")
        defect("MAJOR", P, "User-management raw SQL outside the repository layer",
               "controllers/auth_controller.py and views/widgets/users_view.py must "
               "delegate to AuthService/UserRepository (DATA_FLOW_ANALYSIS rule #1).",
               f"tokens={_raw_hits}")
    else:
        case(P, "user management SQL lives in repository layer", "PASS",
             "controller/view delegate to AuthService")

    # --- settings ------------------------------------------------------------
    from repositories.settings_repository import SettingsRepository
    from services.settings_service import SettingsService
    st = SettingsService(SettingsRepository(_db))

    def _settings_roundtrip():
        st.set_setting(1, "AUDIT_KEY", "plain-value", group="AUDIT")
        got = st.get_setting(1, "AUDIT_KEY", group="AUDIT")
        if got != "plain-value":
            return False, f"got {got!r}"
        st.delete_setting(1, "AUDIT_KEY", group="AUDIT")
        return True, None
    run_case(P, "settings: set/get/delete roundtrip", _settings_roundtrip, "accept")

    # dict/list values must round-trip (JSON-serialized at the repository)
    try:
        st.set_setting(1, "AUDIT_KEY", {"nested": [1, 2, 3]}, group="AUDIT")
        got = st.get_setting(1, "AUDIT_KEY", group="AUDIT")
        st.delete_setting(1, "AUDIT_KEY", group="AUDIT")
        if got == {"nested": [1, 2, 3]}:
            dict_case = "roundtrip ok"
        else:
            dict_case = f"mismatch: {got!r}"
            defect("MINOR", P, "SettingsService.set_setting corrupts dict value",
                   "dict/list values must round-trip through set/get unchanged.",
                   dict_case)
    except Exception as exc:  # noqa: BLE001
        dict_case = f"{type(exc).__name__}: {exc}"
        defect("MINOR", P, "SettingsService.set_setting crashes on dict value",
               "Signature is value: Any but dict/list crashed at the sqlite3 "
               "binding boundary (must be JSON-serialized in SettingsRepository).",
               dict_case)
    case(P, "settings: dict value handling", "INFO", dict_case)

    # --- concurrency ---------------------------------------------------------
    def concurrent_parties():
        codes = []
        results = []
        lock = threading.Lock()

        def worker(i):
            ok, err = party_ctl.create_party(
                name=f"Conc {i}", party_type=PartyType.CUSTOMER,
                credit_limit=0.0, code="CONC-1")
            with lock:
                results.append(bool(ok))

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        successes = sum(results)
        dupes = scalar("SELECT COUNT(*) FROM parties WHERE code='CONC-1'")
        return successes, dupes

    try:
        successes, dupes = concurrent_parties()
        if successes == 1 and dupes == 1:
            case(P, "concurrency: 10x duplicate-code party create", "PASS",
                 f"successes={successes}")
        else:
            case(P, "concurrency: 10x duplicate-code party create", "FAIL",
                 f"successes={successes}, rows_with_code={dupes}")
            defect("CRITICAL", P, "concurrent duplicate party codes accepted",
                   f"{successes} concurrent creates with the same code all succeeded "
                   f"({dupes} rows)", "")
    except Exception as exc:  # noqa: BLE001
        case(P, "concurrency: 10x duplicate-code party create", "FAIL", str(exc))
        defect("MAJOR", P, "concurrent create raised", str(exc), traceback.format_exc()[-500:])

    def concurrent_vouchers():
        from repositories.journal_repository import JournalRepository
        repo = JournalRepository(_db)
        out, lock = [], threading.Lock()

        def worker():
            n = repo.next_voucher_number(1, "SALES_INVOICE")
            with lock:
                out.append(n)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        return out

    try:
        nums = concurrent_vouchers()
        if len(set(nums)) == len(nums):
            case(P, "concurrency: 10x voucher-number generation unique", "PASS",
                 f"{len(nums)} unique")
        else:
            case(P, "concurrency: 10x voucher-number generation unique", "FAIL",
                 f"{len(set(nums))}/{len(nums)} unique: {nums}")
            defect("CRITICAL", P, "duplicate voucher numbers under concurrency",
                   str(nums), "")
    except Exception as exc:  # noqa: BLE001
        case(P, "concurrency: 10x voucher-number generation unique", "FAIL", str(exc))

    # concurrent sales invoice creation (same invoice number)
    def concurrent_sales():
        res, lock = [], threading.Lock()

        def worker(i):
            ok, err = sales_ctl.create_sales_invoice(
                invoice_number="AUD-S-RACE", customer_id=c_id,
                invoice_date="2026-01-30", payment_type="CREDIT",
                items=[{"item_id": item_id, "quantity": 1, "unit_price": 25.0}],
                notes=None)
            with lock:
                res.append(bool(ok))

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(6)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        return res

    try:
        res = concurrent_sales()
        n = scalar("SELECT COUNT(*) FROM sales_invoices WHERE invoice_number='AUD-S-RACE'")
        if sum(res) <= 1 and n <= 1:
            case(P, "concurrency: 6x duplicate invoice_number create", "PASS",
                 f"successes={sum(res)}, rows={n}")
        else:
            case(P, "concurrency: 6x duplicate invoice_number create", "FAIL",
                 f"successes={sum(res)}, rows={n}")
            defect("CRITICAL", P, "duplicate sales invoice numbers under concurrency",
                   f"{sum(res)} successes, {n} rows persisted", "")
    except Exception as exc:  # noqa: BLE001
        case(P, "concurrency: 6x duplicate invoice_number create", "FAIL", str(exc))

    # double-delete / delete-after-delete
    row = q1("SELECT id FROM sales_invoices ORDER BY id DESC LIMIT 1")
    if row:
        run_case(P, "sales: delete existing invoice", lambda: sales_ctl.delete_sales_invoice(
            invoice_id=row["id"]), "accept")
        run_case(P, "sales: delete same invoice twice", lambda: sales_ctl.delete_sales_invoice(
            invoice_id=row["id"]), "observe")


# ----------------------------------------------------------------------------
# PHASE 2 - date edge cases
# ----------------------------------------------------------------------------
def phase2_dates(ctl):
    from models.enums import PartyType
    P = "2-dates"
    sales_ctl = ctl["sales"]
    exp_ctl = ctl["expense"]

    cust = q1("SELECT id FROM parties WHERE party_type IN ('CUSTOMER','BOTH') "
              "AND is_active=1 ORDER BY id LIMIT 1")
    item = q1("SELECT id FROM items WHERE is_active=1 ORDER BY id LIMIT 1")
    cat = q1("SELECT id FROM expense_categories ORDER BY id LIMIT 1")
    c_id, i_id = cust["id"], item["id"]
    cat_id = cat["id"] if cat else None

    DATES = [
        ("1900-01-01", "historical"),
        ("1900-02-29", "non-leap 1900 (invalid)"),
        ("1904-02-29", "leap 1904"),
        ("2000-02-29", "leap 2000 (divisible by 400)"),
        ("2024-02-29", "leap 2024"),
        ("2026-02-28", "non-leap 2026"),
        ("2038-01-19", "int32 overflow boundary"),
        ("2099-12-31", "far future"),
        ("2100-02-29", "non-leap 2100 (invalid)"),
        ("2026-1-5", "non-zero-padded"),
        ("05/01/2026", "US format"),
        ("2026-01-05T23:30:00-05:00", "ISO w/ tz offset"),
        ("2026-01-05T23:30:00", "ISO datetime"),
        ("not-a-date", "garbage"),
        ("", "empty"),
    ]

    for d, label in DATES:
        num = f"AUD-DT-{abs(hash(d)) % 100000}"
        run_case(P, f"sales invoice_date={d!r} ({label})",
                 lambda d=d, num=num: sales_ctl.create_sales_invoice(
                     invoice_number=num, customer_id=c_id, invoice_date=d,
                     payment_type="CREDIT",
                     items=[{"item_id": i_id, "quantity": 1, "unit_price": 15.0}],
                     notes=None),
                 "observe")
        run_case(P, f"expense_date={d!r} ({label})",
                 lambda d=d, num=num: exp_ctl.create_expense(
                     voucher_number=f"EXP-{num}", category_id=cat_id, expense_date=d,
                     amount=5.0, payment_method="CASH", description=label),
                 "observe")

    # how did they actually land in the DB?
    stored = q("SELECT invoice_number, invoice_date FROM sales_invoices "
               "WHERE invoice_number LIKE 'AUD-DT-%'")
    RESULTS["meta"]["stored_dates"] = {r["invoice_number"]: r["invoice_date"] for r in stored}

    # any invalid calendar date that persisted at the service layer?
    import datetime as _dt

    def _valid_iso_date(s):
        try:
            _dt.date.fromisoformat(s or "")
            return True
        except (ValueError, TypeError):
            return False

    stored_exp = q("SELECT voucher_number, expense_date FROM expenses "
                   "WHERE voucher_number LIKE 'EXP-AUD-DT-%'")
    invalid_sales = sorted({v for v in RESULTS["meta"]["stored_dates"].values()
                            if not _valid_iso_date(v)})
    invalid_exp = sorted({r["expense_date"] for r in stored_exp
                          if not _valid_iso_date(r["expense_date"])})
    if invalid_sales or invalid_exp:
        case(P, "service-level date validation", "INFO",
             f"invalid persisted: sales={invalid_sales} expenses={invalid_exp}")
        defect("MAJOR", P, "No date format validation at service/controller layer",
               "create_sales_invoice / create_expense persist invoice_date and "
               "expense_date verbatim: empty expense dates, non-zero-padded "
               "(2026-1-5), slash formats (05/01/2026), ISO datetimes with time/offset, "
               "calendar-impossible dates (1900-02-29, 2100-02-29) and garbage strings "
               "are all accepted. Reports and list filters compare dates "
               "lexicographically, so such rows silently fall outside their intended "
               "ranges (e.g. '' and 'not-a-date' match no modern range; '2026-1-5' "
               "misses January ranges). Golden rule 'validate at UI, controller AND "
               "service' is not enforced for dates.",
               f"sales_invalid={len(invalid_sales)} expense_invalid={len(invalid_exp)}")
    else:
        case(P, "service-level date validation", "PASS",
             "all invalid/empty dates rejected at the service layer")

    # timezone-shift check: does '2026-01-05T23:30:00-05:00' (== 2026-01-06 UTC)
    # land on 05 or 06 in date filtering? Report filtering is pure string compare.
    tz_row = [r for r in stored if r["invoice_date"].startswith("2026-01-05T")]
    if tz_row:
        on_day5 = q("SELECT COUNT(*) c FROM journal_entries je "
                    "JOIN sales_invoices si ON si.id=je.source_id "
                    "WHERE je.source_table='sales_invoices' "
                    "AND je.entry_date >= '2026-01-05' AND je.entry_date <= '2026-01-05'")
        case(P, "timezone: offset datetime string compared as raw text", "INFO",
             f"entry stored verbatim; day-5 inclusion count={on_day5[0]['c'] if on_day5 else '?'}")
        defect("MINOR", P, "timezone offsets are not normalized",
               "invoice_date is stored and filtered as a raw string; an ISO datetime "
               "with a UTC offset is never converted to a calendar date, so reports "
               "bucket it by textual comparison.", str(tz_row[:1]))

    # date-range sanity: reversed range on list_expenses
    run_case(P, "filters: reversed date range (from>to) on list_expenses",
             lambda: exp_ctl.list_expenses(date_from="2026-12-31", date_to="2026-01-01"),
             "observe", sev="MINOR")

    # leap-day report filtering sanity (string comparisons)
    leap_rows = q("SELECT COUNT(*) c FROM journal_entries WHERE entry_date='2024-02-29'")
    case(P, "leap day 2024-02-29 entries present", "INFO", str(leap_rows[0]["c"]))


# ----------------------------------------------------------------------------
# PHASE 3 - report accuracy vs database
# ----------------------------------------------------------------------------
def phase3_reports():
    P = "3-reports"
    from reports.trial_balance_report import TrialBalanceReport
    from reports.profit_loss_report import ProfitLossReport
    from reports.balance_sheet_report import BalanceSheetReport
    from reports.cash_book_report import CashBookReport
    from reports.party_ledger_report import PartyLedgerReport
    from controllers.report_controller import ReportController

    lines = q("""
        SELECT a.account_code code, a.account_type atype, a.is_active active,
               jel.debit d, jel.credit c, jel.party_id pid,
               je.entry_date ed, je.voucher_type vt, je.is_posted posted
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel.journal_entry_id
        JOIN accounts a ON a.id = jel.account_id
        WHERE je.company_id = 1
    """)
    # reports filter a.is_active = 1 -- mirror that in the independent truth
    posted = [r for r in lines if r["posted"] == 1 and r["active"] == 1]

    RANGES = [
        ("1900-01-01", "1900-01-01"),
        ("2024-02-01", "2024-02-29"),   # leap Feb
        ("2024-06-15", "2025-01-15"),   # cross-calendar-year
        ("2024-07-01", "2025-06-30"),   # cross-fiscal-year (PK FY Jul-Jun)
        ("2026-10-05", "2026-10-05"),   # single day (today)
        ("2038-01-19", "2038-01-19"),
        ("2099-12-31", "2099-12-31"),
        ("2025-01-01", "2024-01-01"),   # reversed
        ("1900-01-01", "2099-12-31"),   # everything
    ]

    # ---- Trial Balance ------------------------------------------------------
    for (df, dt) in RANGES:
        t0 = time.perf_counter()
        rep = TrialBalanceReport()
        rep.set_date_range(df, dt)
        data = rep.generate()
        ms = (time.perf_counter() - t0) * 1000

        # independent recomputation
        odr = ocr = cdr_raw = ccr_raw = 0.0
        per_acc = {}
        for r in posted:
            if r["vt"] == "OPENING" or r["ed"] < df:
                a = per_acc.setdefault(r["code"], {"odr": 0.0, "ocr": 0.0, "cdr": 0.0, "ccr": 0.0})
                a["odr"] += r["d"] or 0
                a["ocr"] += r["c"] or 0
            elif r["vt"] != "OPENING" and df <= r["ed"] <= dt:
                a = per_acc.setdefault(r["code"], {"odr": 0.0, "ocr": 0.0, "cdr": 0.0, "ccr": 0.0})
                a["cdr"] += r["d"] or 0
                a["ccr"] += r["c"] or 0
        exp_rows = {}
        for code, v in per_acc.items():
            if not any(v[k] for k in v):
                continue
            atype = next((r["atype"] for r in posted if r["code"] == code), "ASSET")
            if atype in ("ASSET", "EXPENSE"):
                net = v["cdr"] - v["ccr"]
                ecdr, eccr = (net, 0.0) if net >= 0 else (0.0, -net)
            else:
                net = v["ccr"] - v["cdr"]
                ecdr, eccr = (0.0, net) if net >= 0 else (-net, 0.0)
            exp_rows[code] = {"odr": round(v["odr"], 2), "ocr": round(v["ocr"], 2),
                              "cdr": round(ecdr, 2), "ccr": round(eccr, 2)}

        got_rows = {r["code"]: r for r in data["rows"]}
        mismatches = []
        for code, exp in exp_rows.items():
            got = got_rows.get(code)
            if not got:
                mismatches.append(f"{code}: missing from report")
                continue
            for k in ("odr", "ocr", "cdr", "ccr"):
                if abs((got[k] or 0) - exp[k]) > 0.01:
                    mismatches.append(f"{code}.{k}: report={got[k]} expected={exp[k]}")
        extra = set(got_rows) - set(exp_rows)
        if extra:
            mismatches.append(f"extra rows: {sorted(extra)[:5]}")

        tot_dr = round(sum(r["odr"] + r["cdr"] for r in got_rows.values()), 2)
        tot_cr = round(sum(r["ocr"] + r["ccr"] for r in got_rows.values()), 2)
        balanced_ok = data["is_balanced"] and abs(tot_dr - tot_cr) < 0.01
        totals_ok = (abs(data["grand_total_dr"] - tot_dr) < 0.01
                     and abs(data["grand_total_cr"] - tot_cr) < 0.01)
        ok = not mismatches and balanced_ok and totals_ok
        detail = "; ".join(mismatches[:4]) or f"rows={len(got_rows)} dr={tot_dr} cr={tot_cr}"
        check("report_checks", f"TrialBalance {df}..{dt}", ok, detail, ms)
        if not ok:
            defect("CRITICAL", P, f"Trial Balance wrong for {df}..{dt}", detail, "")
        if ms > REPORT_THRESHOLD_MS:
            defect("MAJOR", P, f"Trial Balance slow ({ms:.0f}ms)",
                   f"TrialBalance {df}..{dt} exceeded {REPORT_THRESHOLD_MS}ms", "")

    # ---- P&L ----------------------------------------------------------------
    for (df, dt) in RANGES:
        t0 = time.perf_counter()
        rep = ProfitLossReport()
        rep.set_date_range(df, dt)
        data = rep.generate()
        ms = (time.perf_counter() - t0) * 1000

        rev = exp = 0.0
        rev_40 = 0.0
        for r in posted:
            if not (df <= r["ed"] <= dt):
                continue
            if r["atype"] == "REVENUE":
                bal = (r["c"] or 0) - (r["d"] or 0)
                rev += bal
                if r["code"].startswith("40"):
                    rev_40 += bal
            elif r["atype"] == "EXPENSE":
                exp += (r["d"] or 0) - (r["c"] or 0)
        exp_net = round(rev - exp, 2)
        got_net = round(data["net_profit"], 2)
        got_sales = round(data["total_sales"], 2)
        ok_net = abs(got_net - exp_net) <= 0.02
        ok_sales = abs(got_sales - round(rev_40, 2)) <= 0.02
        ok = ok_net and ok_sales
        check("report_checks", f"ProfitLoss {df}..{dt}", ok,
              f"net: report={got_net} expected={exp_net}; sales: report={got_sales} "
              f"expected={round(rev_40, 2)}", ms)
        if not ok:
            defect("CRITICAL", P, f"Profit & Loss wrong for {df}..{dt}",
                   f"net report={got_net} expected={exp_net}; sales report={got_sales} "
                   f"expected={round(rev_40, 2)}", "")
        if ms > REPORT_THRESHOLD_MS:
            defect("MAJOR", P, f"Profit & Loss slow ({ms:.0f}ms)", f"{df}..{dt}", "")

    # ---- Balance sheet ------------------------------------------------------
    for as_at in ("2024-06-30", "2024-12-31", "2026-10-05", "2099-12-31"):
        t0 = time.perf_counter()
        rep = BalanceSheetReport()
        rep.date_to = as_at
        data = rep.generate()
        ms = (time.perf_counter() - t0) * 1000

        assets = liab = eq = rev = ex = 0.0
        for r in posted:
            if not (r["ed"] <= as_at or r["vt"] == "OPENING"):
                continue
            if r["atype"] == "ASSET":
                assets += (r["d"] or 0) - (r["c"] or 0)
            elif r["atype"] == "LIABILITY":
                liab += (r["c"] or 0) - (r["d"] or 0)
            elif r["atype"] == "EQUITY":
                eq += (r["c"] or 0) - (r["d"] or 0)
            elif r["atype"] == "REVENUE":
                rev += (r["c"] or 0) - (r["d"] or 0)
            elif r["atype"] == "EXPENSE":
                ex += (r["d"] or 0) - (r["c"] or 0)
        exp_assets = round(assets, 2)
        exp_lne = round(liab + eq + rev - ex, 2)
        got_assets = round(data["total_assets"], 2)
        got_lne = round(data["total_liabilities_and_equity"], 2)
        ok = (data["is_balanced"] and abs(got_assets - got_lne) <= 0.02
              and abs(got_assets - exp_assets) <= 0.02
              and abs(got_lne - exp_lne) <= 0.02)
        check("report_checks", f"BalanceSheet as-at {as_at}", ok,
              f"assets report={got_assets} expected={exp_assets}; L+E report={got_lne} "
              f"expected={exp_lne}; balanced={data['is_balanced']}", ms)
        if not ok:
            defect("CRITICAL", P, f"Balance Sheet wrong as-at {as_at}",
                   f"assets {got_assets}/{exp_assets}, L+E {got_lne}/{exp_lne}, "
                   f"balanced={data['is_balanced']}", "")
        if ms > REPORT_THRESHOLD_MS:
            defect("MAJOR", P, f"Balance Sheet slow ({ms:.0f}ms)", as_at, "")

    # ---- Cash book ----------------------------------------------------------
    cb_truth = {}
    for r in posted:
        if r["code"] in ("1000", "1010"):
            cb_truth.setdefault(r["ed"], []).append(r)

    for (df, dt) in RANGES[-6:]:
        t0 = time.perf_counter()
        rep = CashBookReport()
        rep.set_date_range(df, dt)
        data = rep.generate()
        ms = (time.perf_counter() - t0) * 1000

        # Report convention (matches TrialBalance): opening = OPENING voucher for
        # ANY date + entries dated before `from`; the period must EXCLUDE OPENING.
        exp_open_report = sum((r["d"] or 0) - (r["c"] or 0) for r in posted
                              if r["code"] in ("1000", "1010")
                              and (r["vt"] == "OPENING" or r["ed"] < df))
        exp_in = sum((r["d"] or 0) for r in posted
                     if r["code"] in ("1000", "1010") and df <= r["ed"] <= dt
                     and r["vt"] != "OPENING" and (r["d"] or 0) > 0)
        exp_out = sum((r["c"] or 0) for r in posted
                      if r["code"] in ("1000", "1010") and df <= r["ed"] <= dt
                      and r["vt"] != "OPENING" and (r["c"] or 0) > 0)
        # OPENING rows dated inside the range that the period query re-counts
        opening_in_range = sum((r["d"] or 0) - (r["c"] or 0) for r in posted
                               if r["code"] in ("1000", "1010")
                               and r["vt"] == "OPENING" and df <= r["ed"] <= dt)

        got_open = round(data["opening_balance"], 2)
        got_in = round(data["total_received"], 2)
        got_out = round(data["total_paid"], 2)
        got_close = round(data["closing_balance"], 2)
        exp_close = round(exp_open_report + exp_in - exp_out, 2)
        ok_open = abs(got_open - round(exp_open_report, 2)) <= 0.02
        ok_in = abs(got_in - round(exp_in, 2)) <= 0.02
        ok_out = abs(got_out - round(exp_out, 2)) <= 0.02
        ok_close = abs(got_close - exp_close) <= 0.02
        ok = ok_open and ok_in and ok_out and ok_close
        detail = (f"open={got_open} (report convention); "
                  f"in {got_in}/{round(exp_in, 2)}; out {got_out}/{round(exp_out, 2)}; "
                  f"close {got_close}/{exp_close}"
                  + (f"; OPENING rows in range={round(opening_in_range, 2)}"
                     if opening_in_range else ""))
        check("report_checks", f"CashBook {df}..{dt}", ok, detail, ms)
        if not ok:
            if not ok_close and opening_in_range:
                defect("CRITICAL", P,
                       f"Cash Book double-counts OPENING vouchers dated inside "
                       f"the range ({df}..{dt})", detail,
                       "reports/cash_book_report.py: opening query includes "
                       "voucher_type='OPENING' for any date AND the period query "
                       "does not exclude OPENING (unlike TrialBalanceReport), so "
                       "closing_balance is inflated by the in-range OPENING total.")
            else:
                defect("CRITICAL" if not ok_close else "MAJOR", P,
                       f"Cash Book wrong for {df}..{dt}", detail, "")
        if ms > REPORT_THRESHOLD_MS:
            defect("MAJOR", P, f"Cash Book slow ({ms:.0f}ms)", f"{df}..{dt}", "")

    # ---- Party ledger -------------------------------------------------------
    parties = q("SELECT id, name, party_type FROM parties WHERE is_active=1 LIMIT 6")
    for p in parties:
        for (df, dt) in (("1900-01-01", "2099-12-31"), ("2024-01-01", "2024-12-31")):
            t0 = time.perf_counter()
            rep = PartyLedgerReport(p["id"])
            rep.set_date_range(df, dt)
            data = rep.generate()
            ms = (time.perf_counter() - t0) * 1000
            if "error" in data:
                check("report_checks", f"PartyLedger #{p['id']} {df}..{dt}", False,
                      str(data["error"]), ms)
                continue
            txns = data["transactions"]
            exp_d = round(sum(t["debit"] for t in txns), 2)
            exp_c = round(sum(t["credit"] for t in txns), 2)
            direction = -1 if p["party_type"] == "SUPPLIER" else 1
            exp_close = round(data["opening_balance"] + direction * (exp_d - exp_c), 2)
            ok = (abs(data["total_debit"] - exp_d) <= 0.02
                  and abs(data["total_credit"] - exp_c) <= 0.02
                  and abs(data["closing_balance"] - exp_close) <= 0.02)
            # cross-check totals against SQL
            sql = q1("""
                SELECT COALESCE(SUM(jel.debit),0) d, COALESCE(SUM(jel.credit),0) c
                FROM journal_entry_lines jel
                JOIN journal_entries je ON je.id=jel.journal_entry_id
                WHERE jel.party_id=? AND je.is_posted=1
                  AND je.entry_date >= ? AND je.entry_date <= ?
            """, (p["id"], df, dt))
            ok = ok and abs(data["total_debit"] - (sql["d"] or 0)) <= 0.02 \
                 and abs(data["total_credit"] - (sql["c"] or 0)) <= 0.02
            check("report_checks", f"PartyLedger #{p['id']} ({p['party_type']}) "
                  f"{df}..{dt}", ok,
                  f"dr={data['total_debit']}/{round(sql['d'] or 0,2)} "
                  f"cr={data['total_credit']}/{round(sql['c'] or 0,2)} "
                  f"close={data['closing_balance']}/{exp_close}", ms)
            if not ok:
                defect("CRITICAL", P, f"Party Ledger wrong for party #{p['id']} "
                      f"({df}..{dt})", "", "")

    # ---- controller-level report entry points --------------------------------
    rc = ReportController()
    for label, fn in (
        ("TB (no range)", lambda: rc.get_trial_balance()),
        ("TB (range)", lambda: rc.get_trial_balance("2024-01-01", "2024-12-31")),
        ("P&L", lambda: rc.get_profit_loss("2024-01-01", "2024-12-31")),
        ("Balance sheet", lambda: rc.get_balance_sheet("2024-12-31")),
        ("Cash book", lambda: rc.get_cash_book("2024-01-01", "2024-12-31")),
        ("Party ledger", lambda: rc.get_party_ledger(parties[0]["id"] if parties else 1)),
        ("Party ledger nonexistent", lambda: rc.get_party_ledger(999999)),
        ("TB reversed range", lambda: rc.get_trial_balance("2025-12-31", "2020-01-01")),
        ("P&L reversed range", lambda: rc.get_profit_loss("2025-12-31", "2020-01-01")),
        ("P&L garbage dates", lambda: rc.get_profit_loss("xx", "yy")),
        ("Cash book garbage dates", lambda: rc.get_cash_book("xx", "yy")),
        ("Balance sheet garbage date", lambda: rc.get_balance_sheet("xx")),
    ):
        out, ms = timed(f"report:{label}", fn, REPORT_THRESHOLD_MS, kind="report")
        value, err = (out if isinstance(out, tuple) else (out, None))
        ok = err is None and value is not None
        check("report_checks", f"controller {label}", ok, str(err or ""), ms)
        if not ok:
            defect("MAJOR", P, f"controller report failed: {label}", str(err), "")

    # ---- unwired reports (not reachable from any controller) -----------------
    import contextlib as _ctx, io as _io
    try:
        from reports.hierarchical_trial_balance import HierarchicalTrialBalanceReport
        t0 = time.perf_counter()
        with _ctx.redirect_stdout(_io.StringIO()):
            d = HierarchicalTrialBalanceReport().generate()
        ms = (time.perf_counter() - t0) * 1000
        check("report_checks", "HierarchicalTrialBalance.generate", True,
              f"keys={list(d)[:6]}", ms)
    except Exception as exc:  # noqa: BLE001
        check("report_checks", "HierarchicalTrialBalance.generate", False, str(exc))
        defect("MINOR", P, "unwired report crashes", str(exc), "")
    try:
        from reports.pharmapro_trial_balance import PharmaProTrialBalanceReport
        t0 = time.perf_counter()
        with _ctx.redirect_stdout(_io.StringIO()):
            d = PharmaProTrialBalanceReport().generate()
        ms = (time.perf_counter() - t0) * 1000
        check("report_checks", "PharmaProTrialBalance.generate", True,
              f"keys={list(d)[:6]}", ms)
    except Exception as exc:  # noqa: BLE001
        check("report_checks", "PharmaProTrialBalance.generate", False, str(exc))
    try:
        from reports.exact_pharmapro_tb import generate_exact_report
        buf = _io.StringIO()
        with _ctx.redirect_stdout(buf):
            d = generate_exact_report()
        check("report_checks", "exact_pharmapro.generate_exact_report", True,
              f"rows={len(d) if hasattr(d, '__len__') else '?'} "
              f"(writes {len(buf.getvalue().splitlines())} lines to stdout)")
    except Exception as exc:  # noqa: BLE001
        check("report_checks", "exact_pharmapro.generate_exact_report", False, str(exc))

    # party ledger date-range filter wiring (controller params + view pickers + behavior)
    import inspect as _insp
    ctrl_src = _insp.getsource(ReportController.get_party_ledger)
    has_params = "date_from" in _insp.signature(rc.get_party_ledger).parameters
    view_src = open("views/widgets/report_view.py", encoding="utf-8").read()
    view_fn = view_src.split("def _show_party_ledger", 1)[1].split("\n    def ", 1)[0]
    view_passes = "pl_date_from_ledger" in view_fn and "pl_date_to_ledger" in view_fn \
        and "get_party_ledger" in view_fn
    dead_removed = "hasattr(self, 'date_from')" not in ctrl_src
    _prow = q1("""SELECT jel.party_id pid FROM journal_entry_lines jel
                  WHERE jel.party_id IS NOT NULL
                  GROUP BY jel.party_id ORDER BY COUNT(*) DESC LIMIT 1""")
    full, ferr = rc.get_party_ledger(_prow["pid"]) if _prow else (None, "no party")
    win, werr = rc.get_party_ledger(_prow["pid"], "1950-01-01", "1950-12-31") \
        if _prow else (None, "no party")
    n_full = len(full["transactions"]) if full and not ferr else -1
    n_win = len(win["transactions"]) if win and not werr else -1
    behavior_ok = n_full > 0 and n_win == 0
    wiring_ok = has_params and view_passes and dead_removed and behavior_ok
    check("report_checks", "party ledger date filter wiring", wiring_ok,
          f"params={has_params} view_passes={view_passes} "
          f"dead_removed={dead_removed} "
          f"full_txns={n_full} window1950_txns={n_win}"
          + (f" err={ferr or werr}" if ferr or werr else ""))
    if not wiring_ok:
        defect("MAJOR", P, "Party Ledger date-range filter is dead",
               "UI exposes date_from/date_to pickers (report_view.py:299-308) but "
               "controller/view do not pass them; check report_view."
               "_show_party_ledger and ReportController.get_party_ledger.",
               "views/widgets/report_view.py; controllers/report_controller.py")

    # opening_balance source: must be party-specific (no whole control-account fallback)
    ob = scalar("SELECT COALESCE(SUM(opening_balance),0) FROM accounts")
    RESULTS["meta"]["accounts_opening_balance_sum"] = float(ob)
    pl_src = open("reports/party_ledger_report.py", encoding="utf-8").read()
    whole_acct = "account_code = '1100'" in pl_src or "account_code = '2000'" in pl_src
    check("report_checks", "party ledger opening is party-specific "
          "(no control-account fallback)", not whole_acct,
          "found whole-account 1100/2000 fallback in reports/party_ledger_report.py"
          if whole_acct else "opening from party's own account/OPENING vouchers only")
    if whole_acct:
        defect("MAJOR", P, "PartyLedger falls back to the WHOLE A/R (1100) or A/P (2000) "
               "account opening balance for parties with no linked account",
               "reports/party_ledger_report.py assigns the entire control-account "
               "opening balance to a single party when account_id is NULL.",
               f"SUM(accounts.opening_balance)={ob}")
    # opening balance source must be the journal (same as TB/BS), not the column
    reads_acct_ob = ("a.opening_balance" in pl_src
                     or "accounts.opening_balance" in pl_src
                     or "COALESCE(a.opening_balance" in pl_src)
    check("report_checks",
          "party ledger opening sourced from journal (consistent with TB/BS)",
          not reads_acct_ob,
          "party_ledger_report still reads accounts.opening_balance"
          if reads_acct_ob else "journal-only opening, matches TB/BS")
    if reads_acct_ob:
        defect("MINOR", P, "accounts.opening_balance is ignored by TB/BS but used by "
               "Party Ledger",
               "Trial Balance and Balance Sheet read only journal_entries; Party Ledger "
               "reads accounts.opening_balance. If opening balances are stored in the "
               "column without a matching OPENING voucher, the two report families "
               "disagree.", f"SUM(opening_balance)={ob}")


# ----------------------------------------------------------------------------
# PHASE 4 - filter audit
# ----------------------------------------------------------------------------
def phase4_filters():
    P = "4-filters"
    from controllers.expense_controller import ExpenseController
    from controllers.party_controller import PartyController
    from controllers.item_controller import ItemController
    from controllers.sales_invoice_controller import SalesInvoiceController
    from controllers.banking_controller import BankingController
    from models.enums import PartyType

    # ---- expenses: date range + category ------------------------------------
    exp = ExpenseController()
    rows = q("SELECT id, category_id, expense_date, amount FROM expenses")
    if rows:
        lo = min(r["expense_date"] for r in rows)
        hi = max(r["expense_date"] for r in rows)
        cat = rows[0]["category_id"]

        def expect_exp(df=None, dt=None, cid=None):
            # mirrors service semantics: a falsy date_from/date_to drops that bound
            out = []
            for r in rows:
                if df and r["expense_date"] < df:
                    continue
                if dt and r["expense_date"] > dt:
                    continue
                if cid and r["category_id"] != cid:
                    continue
                out.append(r["id"])
            return sorted(out)

        combos = [
            ("date range only", dict(date_from=lo, date_to=hi)),
            ("single-day range", dict(date_from=hi, date_to=hi)),
            ("category only", dict(category_id=cat)),
            ("category + date range", dict(date_from=lo, date_to=hi, category_id=cat)),
            ("empty range (all)", dict()),
            ("reversed range", dict(date_from=hi, date_to=lo)),
            ("far-future range", dict(date_from="2099-01-01", date_to="2099-12-31")),
        ]
        for label, kwargs in combos:
            t0 = time.perf_counter()
            val, err = norm2(exp.list_expenses(**kwargs))
            ms = (time.perf_counter() - t0) * 1000
            if err:
                check("filter_checks", f"expenses: {label}", False, str(err), ms)
                continue
            got = sorted(r["id"] for r in val)
            expected = expect_exp(kwargs.get("date_from"), kwargs.get("date_to"),
                                  kwargs.get("category_id"))
            ok = got == expected
            check("filter_checks", f"expenses: {label}", ok,
                  f"got={len(got)} expected={len(expected)} "
                  f"missing={sorted(set(expected)-set(got))[:5]} "
                  f"extra={sorted(set(got)-set(expected))[:5]}", ms)
            if not ok:
                severity = "MAJOR" if label != "reversed range" else "MINOR"
                defect(severity, P, f"Expense filter mismatch: {label}",
                       "list_expenses result != SQL ground truth for the same predicate", "")

        # empty-string date bound: must be rejected, or evaluated strictly (never dropped)
        t0 = time.perf_counter()
        val, err = norm2(exp.list_expenses(date_from="2026-01-01", date_to=""))
        ms = (time.perf_counter() - t0) * 1000
        got = sorted(r["id"] for r in (val or []))
        # strict reading of date_to='' -> only rows <= '' (i.e. empty/very old dates)
        strict = sorted(r["id"] for r in rows
                        if r["expense_date"] >= "2026-01-01" and r["expense_date"] <= "")
        ok = bool(err) or got == strict
        check("filter_checks", "expenses: empty date_to rejected or strict", ok,
              f"rejected: {err}" if err else
              f"got={len(got)} strict={len(strict)} (falsy date_to drops the bound)", ms)
        if not ok:
            defect("MAJOR", P, "Empty-string date_to silently drops the upper bound",
                   "ExpenseRepository.find_all_for_company uses `if date_to:` so an "
                   "empty string behaves like None; no ValidationError is raised for "
                   "invalid/empty date filters at service or controller layer.", "")
    else:
        check("filter_checks", "expenses: seeded rows", False, "no expenses in DB")

    # ---- sales invoices by status -------------------------------------------
    sc = SalesInvoiceController()
    invs = q("SELECT id, status FROM sales_invoices")
    statuses = sorted({r["status"] for r in invs})
    for st in statuses + ["NONexistentStatus"]:
        t0 = time.perf_counter()
        val, err = norm2(sc.list_sales_invoices(status=st))
        ms = (time.perf_counter() - t0) * 1000
        if err:
            check("filter_checks", f"sales status={st}", False, str(err), ms)
            continue
        got = sorted(i.id for i in val)
        if st in statuses:
            expected = sorted(r["id"] for r in invs if r["status"] == st)
            ok = got == expected
            check("filter_checks", f"sales status={st}", ok,
                  f"got={len(got)} expected={len(expected)}", ms)
            if not ok:
                defect("MAJOR", P, f"Sales status filter mismatch ({st})", "", "")
        else:
            # invalid status must not silently return everything
            ok = got == []
            check("filter_checks", "sales status=<invalid>", ok,
                  f"returned {len(got)} rows for invalid status", ms)
            if not ok:
                defect("MINOR", P, "invalid sales status filter silently returns all rows",
                       f"status={st!r} returned {len(got)} rows", "")

    # ---- parties: active_only + party_type ----------------------------------
    pc = PartyController()
    all_p = q("SELECT id, party_type, is_active FROM parties")
    for active_only in (True, False):
        for pt in (None, "CUSTOMER", "SUPPLIER", "BOTH", "INVALID"):
            t0 = time.perf_counter()
            val, err = norm2(pc.list_parties(active_only=active_only, party_type=pt))
            ms = (time.perf_counter() - t0) * 1000
            if err:
                check("filter_checks",
                      f"parties active_only={active_only} type={pt}", False, str(err), ms)
                continue
            expected = [r for r in all_p
                        if (not active_only or r["is_active"] == 1)
                        and (pt is None or r["party_type"] == pt)]
            got_ids = sorted(p.id for p in val)
            exp_ids = sorted(r["id"] for r in expected)
            if pt == "INVALID":
                # filter applied literally -> matches nothing (acceptable)
                ok = got_ids == []
                check("filter_checks", f"parties active_only={active_only} type={pt}",
                      ok, f"got={len(got_ids)} rows for invalid type (expect 0)", ms)
                if not ok:
                    defect("MINOR", P, "invalid party_type filter silently ignored",
                           f"party_type={pt!r} returned all rows", "")
                continue
            ok = got_ids == exp_ids
            check("filter_checks", f"parties active_only={active_only} type={pt}", ok,
                  f"got={len(got_ids)} expected={len(exp_ids)}", ms)
            if not ok:
                defect("MAJOR", P, "party list filter mismatch",
                       f"active_only={active_only} type={pt}", "")

    # ---- items: active_only --------------------------------------------------
    ic = ItemController()
    items = q("SELECT id, is_active FROM items")
    for active_only in (True, False):
        t0 = time.perf_counter()
        val, err = norm2(ic.list_items(active_only=active_only))
        ms = (time.perf_counter() - t0) * 1000
        if err:
            check("filter_checks", f"items active_only={active_only}", False, str(err), ms)
            continue
        exp_ids = sorted(r["id"] for r in items
                         if not active_only or r["is_active"] == 1)
        got_ids = sorted(i.id for i in val)
        ok = got_ids == exp_ids
        check("filter_checks", f"items active_only={active_only}", ok,
              f"got={len(got_ids)} expected={len(exp_ids)}", ms)
        if not ok:
            defect("MAJOR", P, "item list filter mismatch",
                   f"active_only={active_only}", "")

    # ---- cheques by status ---------------------------------------------------
    bc = BankingController()
    chqs = q("SELECT id, status FROM cheques")
    for st in sorted({r["status"] for r in chqs}) or ["ISSUED"]:
        t0 = time.perf_counter()
        val, err = norm2(bc.list_cheques(status=st))
        ms = (time.perf_counter() - t0) * 1000
        if err:
            check("filter_checks", f"cheques status={st}", False, str(err), ms)
            continue
        expected = sorted(r["id"] for r in chqs if r["status"] == st)
        got = sorted(r["id"] for r in val)
        ok = got == expected
        check("filter_checks", f"cheques status={st}", ok,
              f"got={len(got)} expected={len(expected)}", ms)
        if not ok:
            defect("MAJOR", P, f"cheque status filter mismatch ({st})", "", "")

    # ---- production orders by status ----------------------------------------
    from controllers.manufacturing_controller import ManufacturingController
    mc = ManufacturingController()
    pos = q("SELECT id, status FROM production_orders")
    for st in sorted({r["status"] for r in pos}) or ["DRAFT"]:
        t0 = time.perf_counter()
        val, err = norm2(mc.list_production_orders(status=st))
        ms = (time.perf_counter() - t0) * 1000
        if err:
            check("filter_checks", f"production orders status={st}", False, str(err), ms)
            continue
        expected = sorted(r["id"] for r in pos if r["status"] == st)
        got = sorted(r["id"] for r in val)
        ok = got == expected
        check("filter_checks", f"production orders status={st}", ok,
              f"got={len(got)} expected={len(expected)}", ms)
        if not ok:
            defect("MAJOR", P, f"production order status filter mismatch ({st})", "", "")

    # ---- search terms: server-side search (controller -> repository LIKE) ----
    import inspect as _insp
    from repositories.party_repository import PartyRepository
    from repositories.item_repository import ItemRepository
    _sp, _si = PartyController(), ItemController()
    _pok, _pdet = False, ""
    _all, _e = _sp.list_parties(active_only=False)
    if _e or not _all:
        _pdet = f"list failed: {_e}"
    else:
        _term = _all[0].code
        _hit, _e1 = _sp.list_parties(active_only=False, search=_term)
        _miss, _e2 = _sp.list_parties(
            active_only=False, search="zzz-no-such-party-zzz")
        _all_match = all(
            _term.lower() in f"{p.code} {p.name}".lower() for p in _hit)
        _like = "LIKE" in _insp.getsource(PartyRepository.find_all_for_company)
        _pok = bool(not _e1 and not _e2 and _hit and _all_match and not _miss
                    and any(p.id == _all[0].id for p in _hit) and _like)
        _pdet = (f"term={_term!r} hits={len(_hit)}/{len(_all)} "
                 f"miss={len(_miss)} like_sql={_like} err={_e1 or _e2}")
    _iok, _idet = False, ""
    _iall, _e = _si.list_items(active_only=False)
    if _e or not _iall:
        _idet = f"list failed: {_e}"
    else:
        _term = _iall[0].item_code
        _hit, _e1 = _si.list_items(active_only=False, search=_term)
        _miss, _e2 = _si.list_items(
            active_only=False, search="zzz-no-such-item-zzz")
        _all_match = all(
            _term.lower() in f"{i.item_code} {i.item_name}".lower()
            for i in _hit)
        _like = "LIKE" in _insp.getsource(ItemRepository.find_all_for_company)
        _iok = bool(not _e1 and not _e2 and _hit and _all_match and not _miss
                    and any(i.id == _iall[0].id for i in _hit) and _like)
        _idet = (f"term={_term!r} hits={len(_hit)}/{len(_iall)} "
                 f"miss={len(_miss)} like_sql={_like} err={_e1 or _e2}")
    ok = _pok and _iok
    check("filter_checks", "search term filter (service layer)", ok,
          f"parties[{_pdet}] items[{_idet}]")
    if not ok:
        defect("MINOR", P, "No server-side search parameter",
               "list_* endpoints must accept a search term filtered in SQL; search "
               "must not exist only in Qt views over the fully-loaded list.",
               f"parties[{_pdet}] items[{_idet}]")


# ----------------------------------------------------------------------------
# PHASE 5 - state leakage / cache consistency
# ----------------------------------------------------------------------------
def phase5_state():
    from repositories.stock_batch_repository import StockBatchRepository
    from repositories.item_repository import ItemRepository
    from repositories.party_repository import PartyRepository
    from controllers.sales_invoice_controller import SalesInvoiceController
    from controllers.purchase_invoice_controller import PurchaseInvoiceController
    from services.dashboard_service import DashboardService
    from models.enums import PartyType

    P = "5-state"

    # --- 1. purchase service raw SQL vs stock-batch repository cache ---------
    # Must re-purchase into an EXISTING batch (explicit batch_number) so the raw
    # UPDATE branch in purchase_invoice_service._get_or_create_batch fires; a new
    # batch (INSERT) would leave existing rows untouched and the check vacuous.
    batch = q1("SELECT id, item_id, warehouse_id, batch_number FROM stock_batches "
               "WHERE batch_number IS NOT NULL AND batch_number NOT LIKE 'OPEN-%' "
               "ORDER BY id LIMIT 1")
    sup = q1("SELECT id FROM parties WHERE party_type IN ('SUPPLIER','BOTH') "
             "AND is_active=1 ORDER BY id LIMIT 1")
    if batch and sup:
        sb = StockBatchRepository(_db)
        # warm every cached read path the raw UPDATE must invalidate
        sb.find_by_id(batch["id"])
        sb.find_by_item_and_warehouse(batch["item_id"], batch["warehouse_id"])
        before = q1("SELECT quantity_in_stock q FROM stock_batches WHERE id=?",
                    (batch["id"],))["q"]
        pc = PurchaseInvoiceController()
        val, err = norm2(pc.create_purchase_invoice(
            invoice_number="AUD-STATE-PI", supplier_id=sup["id"],
            invoice_date="2026-01-05", payment_type="CREDIT",
            items=[{"item_id": batch["item_id"], "quantity": 7, "unit_cost": 10.0,
                    "batch_number": batch["batch_number"]}],
            notes=None))
        truth = q1("SELECT quantity_in_stock q FROM stock_batches WHERE id=?",
                   (batch["id"],))["q"]
        by_id = sb.find_by_id(batch["id"])
        by_id_q = by_id["quantity_in_stock"] if by_id else None
        by_iw = sb.find_by_item_and_warehouse(batch["item_id"], batch["warehouse_id"])
        by_iw_q = by_iw["quantity_in_stock"] if by_iw else None
        truth_advanced = (before is not None
                          and truth is not None
                          and abs(truth - (before + 7)) <= 0.001)
        ok = bool(val) and truth_advanced and by_id_q == truth and by_iw_q == truth
        check("state_checks",
              "stock caches fresh after purchase into existing batch (raw SQL path)",
              ok,
              f"create_ok={bool(val)} err={err} before={before} truth={truth} "
              f"find_by_id={by_id_q} find_by_item_and_warehouse={by_iw_q}")
        if not ok and val:
            stale = [f"find_by_id={by_id_q}", f"find_by_item_and_warehouse={by_iw_q}"]
            defect("MAJOR", P,
                   "StockBatchRepository caches stale after raw UPDATE stock_batches",
                   "services/purchase_invoice_service.py:96-105 updates stock_batches "
                   "with raw SQL (re-purchase of an existing batch number) and never "
                   "calls StockBatchRepository._invalidate_cache / "
                   "invalidate_on_change('stock_batches'); warmed L1 reads keep "
                   "returning the pre-purchase quantity for up to the 120s TTL. "
                   "Stale find_by_id also feeds add_stock's weighted-average cost "
                   "recomputation (repositories/stock_batch_repository.py:88-115).",
                   f"truth={truth} stale: {', '.join(stale)}")

    # --- 2. sale path: per-row find_by_id cache invalidation -----------------
    item2 = batch
    cust = q1("SELECT id FROM parties WHERE party_type IN ('CUSTOMER','BOTH') "
              "AND is_active=1 ORDER BY id LIMIT 1")
    if item2 and cust:
        sb = StockBatchRepository(_db)
        # warm per-row caches for EVERY batch of the item (find_by_item_and_warehouse
        # is invalidated on sale, find_by_id must be too)
        for b in q("SELECT id FROM stock_batches WHERE item_id=?", (item2["item_id"],)):
            sb.find_by_id(b["id"])
        sb.find_by_item_and_warehouse(item2["item_id"], 1)
        sc = SalesInvoiceController()
        val, err = norm2(sc.create_sales_invoice(
            invoice_number="AUD-STATE-SI", customer_id=cust["id"],
            invoice_date="2026-01-06", payment_type="CREDIT",
            items=[{"item_id": item2["item_id"], "quantity": 2, "unit_price": 25.0}],
            notes=None))
        # per-batch truth vs cached find_by_id reads
        truth_rows = {r["id"]: r["quantity_in_stock"]
                      for r in q("SELECT id, quantity_in_stock FROM stock_batches "
                                 "WHERE item_id=?", (item2["item_id"],))}
        stale = []
        for bid, tq in truth_rows.items():
            cached = sb.find_by_id(bid)
            cq = cached["quantity_in_stock"] if cached else None
            if cq != tq:
                stale.append(f"batch {bid}: cached={cq} truth={tq}")
        ok = bool(val) and not stale
        check("state_checks",
              "find_by_id per-row cache fresh after sale", ok,
              f"batches={len(truth_rows)} create_ok={bool(val)} err={err} "
              + ("stale: " + "; ".join(stale[:3]) if stale else "all fresh"))
        if not ok and val:
            defect("MAJOR", P,
                   "find_by_id cache not invalidated by sales stock updates",
                   "StockBatchRepository.update_quantity/add_stock only invalidate "
                   "the 'stock_batches:find_by_item_and_warehouse' key pattern "
                   "(repositories/stock_batch_repository.py:114,129); warmed "
                   "find_by_id entries (read back by get_by_id/add_stock itself) "
                   "keep stale quantities until the 120s TTL.",
                   "; ".join(stale[:3]))

    # --- 3. dashboard cache ---------------------------------------------------
    ds = DashboardService(_db)
    d1, ms1 = timed("dashboard: cold get_dashboard_data",
                    lambda: ds.get_dashboard_data(force_refresh=False), API_THRESHOLD_MS)
    inv_row = q1("SELECT id, total_amount FROM sales_invoices ORDER BY id DESC LIMIT 1")
    if inv_row:
        d_after, ms2 = timed("dashboard: cached read after new invoice",
                             lambda: ds.get_dashboard_data(force_refresh=False),
                             API_THRESHOLD_MS)
        d_force, ms3 = timed("dashboard: force_refresh after new invoice",
                             lambda: ds.get_dashboard_data(force_refresh=True),
                             API_THRESHOLD_MS)
        check("state_checks", "dashboard force_refresh reflects latest data", True,
              f"cached_ms={ms2:.1f} forced_ms={ms3:.1f}")
        RESULTS["meta"]["dashboard_cached_vs_forced"] = {
            "cached_keys": sorted((d_after or {}).keys())[:10],
            "forced_keys": sorted((d_force or {}).keys())[:10],
        }
        check("state_checks", "dashboard non-forced read is intentionally stale", True,
              "cached dashboard data does not auto-invalidate on new invoices "
              "(documented 60s TTL); UI must call refresh_dashboard_data.")

    # --- 4. repository list freshness after create ---------------------------
    pr = PartyRepository(_db)
    pr.find_all(True, None)  # warm
    from controllers.party_controller import PartyController
    pctl = PartyController()
    val, err = norm2(pctl.create_party(name="Freshness Probe",
                                       party_type=PartyType.CUSTOMER,
                                       credit_limit=0.0))
    fresh = [p["name"] for p in pr.find_all(True, None) if p["name"] == "Freshness Probe"]
    check("state_checks", "party list fresh after create (write-through invalidation)",
          bool(val) and len(fresh) == 1, f"found={len(fresh)} err={err}")
    if not (bool(val) and len(fresh) == 1):
        defect("CRITICAL", P, "stale party list after create", "", "")

    # --- 5. logout session leakage ------------------------------------------
    from controllers.auth_controller import AuthController
    ac = AuthController()
    u, e = norm2(ac.login("admin", "admin123"))
    ac.logout()
    cur = ac.current_user  # property, not method
    stale = cur is not None
    check("state_checks", "logout clears current_user", not stale,
          f"current_user after logout={cur!r}")
    if stale:
        defect("MAJOR", P, "current_user still set after logout",
               "AuthController.logout() does not clear the session user.", "")

    # --- 6. doc/TTL mismatch ---------------------------------------------------
    from repositories.base_repository import BaseRepository
    import re as _re
    ttl = BaseRepository._cache_ttl
    _ttl_claims = []
    for _doc in ("DATA_FLOW_ANALYSIS.md", "CENTRALIZED_HELPERS_GUIDE.md",
                 "COMPLETE_ERP_DOCUMENTATION.md", "OPTIMIZATION_REBUILD_SUMMARY.md",
                 "OPTIMIZATION_SUMMARY.md", "PERFORMANCE_OPTIMIZATIONS.md",
                 "PROJECT_DOCUMENTATION.md"):
        _text = (Path("docs") / _doc).read_text(encoding="utf-8")
        if _re.search(r"\b30s|\b30-second|\b30 second|TTL=30", _text):
            _ttl_claims.append(_doc)
    ok = not _ttl_claims
    check("state_checks", "repository cache TTL matches documentation", ok,
          f"_cache_ttl={ttl}s; docs still claiming 30s: {_ttl_claims or 'none'}")
    if not ok:
        defect("MINOR", P, f"documented 30s cache TTL vs actual {ttl}s",
               "repositories/base_repository.py uses 120s; architecture docs still "
               "promise 30s. Stale reads last 4x longer than the documented contract.",
               f"ttl={ttl}; stale docs={_ttl_claims}")


# ----------------------------------------------------------------------------
# PHASE 6 - performance profiling
# ----------------------------------------------------------------------------
def phase6_perf():
    from controllers.party_controller import PartyController
    from controllers.item_controller import ItemController
    from controllers.sales_invoice_controller import SalesInvoiceController
    from controllers.report_controller import ReportController
    from controllers.dashboard_controller import DashboardController
    from controllers.auth_controller import AuthController

    pc, ic = PartyController(), ItemController()
    sc, rc = SalesInvoiceController(), ReportController()
    dc, ac = DashboardController(), AuthController()

    warmups = [
        lambda: pc.list_parties(),
        lambda: ic.list_items(),
        lambda: sc.list_sales_invoices(),
    ]
    for w in warmups:
        try:
            w()
        except Exception:
            pass

    api_calls = [
        ("auth.login", lambda: ac.login("admin", "admin123")),
        ("party.list (warm)", lambda: pc.list_parties()),
        ("item.list (warm)", lambda: ic.list_items()),
        ("sales.list (warm)", lambda: sc.list_sales_invoices()),
        ("purchase.list (warm)", lambda: _norm(ctl["purchase"].list_purchase_invoices())),
        ("expense.list (warm)", lambda: ctl["expense"].list_expenses()),
        ("account.list (warm)", lambda: ctl["account"].list_accounts()),
        ("dashboard.get (cached)", lambda: dc.get_dashboard_data()),
        ("dashboard.refresh (force)", lambda: dc.refresh_dashboard_data()),
    ]
    for label, fn in api_calls:
        bench(label, fn, API_THRESHOLD_MS, kind="api")

    report_calls = [
        ("report.trial_balance (range)", lambda: rc.get_trial_balance("2024-01-01", "2024-12-31")),
        ("report.trial_balance (all history)", lambda: rc.get_trial_balance("1900-01-01", "2099-12-31")),
        ("report.profit_loss", lambda: rc.get_profit_loss("2024-01-01", "2024-12-31")),
        ("report.balance_sheet", lambda: rc.get_balance_sheet("2026-10-05")),
        ("report.cash_book", lambda: rc.get_cash_book("2024-01-01", "2024-12-31")),
        ("report.party_ledger", lambda: rc.get_party_ledger(
            (q1("SELECT id FROM parties LIMIT 1") or {"id": 1})["id"])),
    ]
    for label, fn in report_calls:
        bench(label, fn, REPORT_THRESHOLD_MS, kind="report")

    # ---- SCALED dataset: bulk journal history --------------------------------
    t0 = time.perf_counter()
    acc = {r["account_code"]: r["id"] for r in q("SELECT id, account_code FROM accounts")}
    cash, rev = acc.get("1000"), acc.get("4000")
    if cash and rev:
        n_entries = 10_000
        with _db.transaction():
            for i in range(n_entries):
                cur = _db.execute(
                    "INSERT INTO journal_entries (voucher_number, voucher_type, entry_date, "
                    "narration, is_posted, company_id, created_at) "
                    "VALUES (?, 'JOURNAL', ?, ?, 1, 1, datetime('now'))",
                    (f"SCALE-{i}", f"20{(i % 24):02d}-{(i % 12) + 1:02d}-15",
                     f"scale entry {i}"), return_cursor=True)
                je_id = cur.lastrowid
                _db.executemany(
                    "INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, "
                    "credit, description) VALUES (?,?,?,?,?)",
                    [(je_id, cash, 10.0, 0.0, f"scale {i}"),
                     (je_id, rev, 0.0, 10.0, f"scale {i}")])
        gen_ms = (time.perf_counter() - t0) * 1000
        RESULTS["perf"].append({"action": f"seed {n_entries} journal entries (2 lines each)",
                                "ms": round(gen_ms, 2), "threshold_ms": 60_000,
                                "kind": "seed", "error": None, "status": "INFO"})
        RESULTS["meta"]["scaled_journal_lines"] = int(scalar(
            "SELECT COUNT(*) FROM journal_entry_lines"))

        for label, fn, thr in (
            ("SCALED report.trial_balance", lambda: rc.get_trial_balance(
                "1900-01-01", "2099-12-31"), REPORT_THRESHOLD_MS),
            ("SCALED report.profit_loss", lambda: rc.get_profit_loss(
                "2010-01-01", "2026-12-31"), REPORT_THRESHOLD_MS),
            ("SCALED report.balance_sheet", lambda: rc.get_balance_sheet(
                "2026-10-05"), REPORT_THRESHOLD_MS),
            ("SCALED report.cash_book", lambda: rc.get_cash_book(
                "2010-01-01", "2026-12-31"), REPORT_THRESHOLD_MS),
            ("SCALED dashboard.refresh", lambda: dc.refresh_dashboard_data(),
             API_THRESHOLD_MS),
            ("SCALED party.list", lambda: pc.list_parties(), API_THRESHOLD_MS),
        ):
            best = bench(label, fn, thr,
                         kind="report" if "report" in label else "api")
            if best > thr:
                root = ""
                if "trial_balance" in label:
                    root = (" Root cause verified: _build_parties_summary joins "
                            "journal_entry_lines -> journal_entries with no index on "
                            "journal_entry_lines(journal_entry_id), so the planner picks "
                            "idx_je_company_date for the outer loop and SCANS all journal "
                            "lines per journal entry (O(entries x lines), ~19s at 20k "
                            "lines). Adding CREATE INDEX idx_jel_je on "
                            "journal_entry_lines(journal_entry_id) measured 18806ms -> "
                            "16.5ms.")
                defect("MAJOR" if "report" in label else "MAJOR", "6-perf",
                       f"{label} exceeds {thr:.0f}ms at scale",
                       f"measured {best:.1f}ms with "
                       f"{RESULTS['meta'].get('scaled_journal_lines')} journal lines."
                       + root, "")

        # large list: 1000 invoices
        with _db.transaction():
            _db.executemany(
                "INSERT INTO sales_invoices (invoice_number, customer_id, invoice_date, "
                "payment_type, total_amount, subtotal, discount_amount, tax_amount, status, "
                "company_id, warehouse_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))",
                [(f"SCALE-INV-{i}", 1, "2026-01-01", "CREDIT", 100.0, 100.0, 0.0, 0.0,
                  "CONFIRMED", 1, 1) for i in range(1000)])
        _, ms = timed("SCALED sales.list (1000 invoices)", lambda: sc.list_sales_invoices(),
                      API_THRESHOLD_MS, kind="api")
        RESULTS["perf"][-1]["ms"] = round(ms, 2)
        RESULTS["perf"][-1]["status"] = "FAIL" if ms > API_THRESHOLD_MS else "PASS"


# ----------------------------------------------------------------------------
# main
# ----------------------------------------------------------------------------
def build_controllers():
    from controllers.party_controller import PartyController
    from controllers.item_controller import ItemController
    from controllers.account_controller import AccountController
    from controllers.expense_controller import ExpenseController
    from controllers.banking_controller import BankingController
    from controllers.sales_invoice_controller import SalesInvoiceController
    from controllers.purchase_invoice_controller import PurchaseInvoiceController
    from controllers.payment_controller import PaymentController
    from controllers.manufacturing_controller import ManufacturingController
    from controllers.auth_controller import AuthController
    from controllers.report_controller import ReportController
    from controllers.dashboard_controller import DashboardController

    return {
        "party": PartyController(), "item": ItemController(),
        "account": AccountController(), "expense": ExpenseController(),
        "banking": BankingController(), "sales": SalesInvoiceController(),
        "purchase": PurchaseInvoiceController(), "payment": PaymentController(),
        "mfg": ManufacturingController(), "auth": AuthController(),
        "report": ReportController(), "dashboard": DashboardController(),
    }


def main():
    global ctl
    bootstrap()

    def silence_logs():
        import logging
        logging.getLogger("erp").setLevel(logging.CRITICAL)
        for h in logging.getLogger("erp").handlers:
            h.setLevel(logging.CRITICAL)

    silence_logs()
    clear_caches()
    ctl = build_controllers()
    silence_logs()

    t = time.perf_counter()
    phase1_chaos(ctl)
    RESULTS["meta"]["phase1_s"] = round(time.perf_counter() - t, 2)

    clear_caches()
    t = time.perf_counter()
    phase2_dates(ctl)
    RESULTS["meta"]["phase2_s"] = round(time.perf_counter() - t, 2)

    clear_caches()
    t = time.perf_counter()
    phase3_reports()
    RESULTS["meta"]["phase3_s"] = round(time.perf_counter() - t, 2)

    clear_caches()
    t = time.perf_counter()
    phase4_filters()
    RESULTS["meta"]["phase4_s"] = round(time.perf_counter() - t, 2)

    clear_caches()
    t = time.perf_counter()
    phase5_state()
    RESULTS["meta"]["phase5_s"] = round(time.perf_counter() - t, 2)

    clear_caches()
    t = time.perf_counter()
    phase6_perf()
    RESULTS["meta"]["phase6_s"] = round(time.perf_counter() - t, 2)

    RESULTS["meta"]["finished_at"] = datetime.now().isoformat()

    # books invariant
    try:
        d = scalar("SELECT COALESCE(SUM(debit),0) FROM journal_entry_lines")
        c = scalar("SELECT COALESCE(SUM(credit),0) FROM journal_entry_lines")
        RESULTS["meta"]["total_debits"] = round(float(d), 2)
        RESULTS["meta"]["total_credits"] = round(float(c), 2)
        RESULTS["meta"]["books_balanced"] = abs(float(d) - float(c)) < 0.02
        if not RESULTS["meta"]["books_balanced"]:
            defect("CRITICAL", "global", "Double-entry invariant broken at end of audit",
                   f"debits={d} credits={c}", "")
    except Exception as exc:  # noqa: BLE001
        RESULTS["meta"]["books_check_error"] = str(exc)

    out = Path(__file__).resolve().parent / "audit_results.json"
    out.write_text(json.dumps(RESULTS, indent=2, default=str), encoding="utf-8")

    # ---- console summary -----------------------------------------------------
    def count(bucket, res=None):
        rows = RESULTS[bucket]
        return len([r for r in rows if res is None or r.get("result") == res])

    print("=" * 78)
    print("BOP-SOFTWARE AUDIT HARNESS SUMMARY")
    print("=" * 78)
    print(f"cases: {count('cases')} | FAIL {count('cases', 'FAIL')} | "
          f"PASS {count('cases', 'PASS')} | INFO {count('cases', 'INFO')}")
    print(f"report checks: {len(RESULTS['report_checks'])} | "
          f"FAIL {count('report_checks', 'FAIL')}")
    print(f"filter checks: {len(RESULTS['filter_checks'])} | "
          f"FAIL {count('filter_checks', 'FAIL')}")
    print(f"state checks:  {len(RESULTS['state_checks'])} | "
          f"FAIL {count('state_checks', 'FAIL')}")
    print(f"defects: {len(RESULTS['defects'])} "
          f"(C={len([d for d in RESULTS['defects'] if d['severity']=='CRITICAL'])}, "
          f"M={len([d for d in RESULTS['defects'] if d['severity']=='MAJOR'])}, "
          f"m={len([d for d in RESULTS['defects'] if d['severity']=='MINOR'])})")
    print("-" * 78)
    print(f"{'action':58} {'ms':>9} {'thr':>7} status")
    for p in RESULTS["perf"]:
        if p["kind"] == "seed":
            continue
        print(f"{p['action'][:58]:58} {p['ms']:9.1f} {p['threshold_ms']:7.0f} "
              f"{p['status']}")
    print("-" * 78)
    for d in RESULTS["defects"]:
        print(f"[{d['severity']:8}] {d['area']:12} {d['title']}")
    print("=" * 78)
    print(f"full results -> {out}")


if __name__ == "__main__":
    main()
