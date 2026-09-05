"""Monitoring helpers - run the exact report/dashboard functions the UI buttons call."""
from __future__ import annotations

import datetime


def today() -> str:
    return datetime.date.today().isoformat()


def today_minus(days: int) -> str:
    return (datetime.date.today() - datetime.timedelta(days=days)).isoformat()


WIDE_FROM = "2000-01-01"
WIDE_TO = "2100-01-01"


def monitor_reports(db, date_from=WIDE_FROM, date_to=WIDE_TO, parties=None):
    """Generate every report (the Generate buttons' code path) and assert none errors.

    Returns dict of report data for finer assertions.
    """
    from controllers.report_controller import ReportController
    from helpers import books

    rc = ReportController()
    out: dict = {}

    tb, err = rc.get_trial_balance()
    assert err is None, f"Trial Balance error: {err}"
    assert tb is not None
    assert tb["is_balanced"] is True, "Trial Balance is NOT balanced"
    assert abs(float(tb["balance_diff"])) <= 0.01
    out["trial"] = tb

    pl, err = rc.get_profit_loss(date_from, date_to)
    assert err is None, f"P&L error: {err}"
    out["pl"] = pl

    bs, err = rc.get_balance_sheet()
    assert err is None, f"Balance Sheet error: {err}"
    assert bs is not None
    assert bs["is_balanced"] is True, "Balance Sheet A != L+E"
    out["balance_sheet"] = bs

    cb, err = rc.get_cash_book(date_from, date_to)
    assert err is None, f"Cash Book error: {err}"
    out["cash_book"] = cb

    for party_id in parties or []:
        pl_data, err = rc.get_party_ledger(party_id)
        assert err is None, f"Party ledger error for {party_id}: {err}"
        out[f"party_ledger_{party_id}"] = pl_data

    books.assert_books_balanced(db)
    return out


def monitor_dashboard():
    """Run the Dashboard refresh code path and return the KPI dict."""
    from controllers.dashboard_controller import DashboardController

    data, err = DashboardController().get_dashboard_data()
    assert err is None, f"Dashboard error: {err}"
    assert data is not None
    return data
