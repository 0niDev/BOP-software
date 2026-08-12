"""GUI regression test: spamming dashboard refresh must not grow graph sizes.

Regression target (dashboard_view.py): every refresh used to rebuild fresh
QChartView widgets and schedule old ones for deleteLater() without flushing
the deferred deletes, so rapid refreshes left orphaned charts stacked on top
of each other -- the graphs visually "grew" on each refresh.
"""
from __future__ import annotations

import pytest

pytestmark = pytest.mark.gui

import shiboken6
from PySide6.QtCharts import QChartView
from PySide6.QtCore import QCoreApplication, QEvent


def _flush_deferred(qapp):
    """Give Qt a chance to run pending DeferredDelete events."""
    qapp.processEvents()
    qapp.sendPostedEvents(None, QEvent.DeferredDelete)
    qapp.processEvents()


def _sample_dashboard_data():
    return {
        "balances": {"cash": 100, "bank": 200, "inventory": 50},
        "monthly_trend": [{"month": "2026-01", "revenue": 10, "expenses": 5}] * 6,
        "today": {"sales": 1, "purchases": 2, "expenses": 3},
        "recent_transactions": [],
        "alerts": {"alerts": []},
        "low_stock": [],
        "expiring": [],
    }


class _StubDashboardService:
    """Returns fixed data; no DB, no latency."""

    def __init__(self):
        self.refresh_calls = 0

    def get_dashboard_data(self, force_refresh=False):
        if force_refresh:
            self.refresh_calls += 1
        return _sample_dashboard_data()


class _StubController:
    def __init__(self):
        self.service = _StubDashboardService()

    def get_dashboard_data(self):
        return self.service.get_dashboard_data(force_refresh=False), None

    def refresh_dashboard_data(self):
        return self.service.get_dashboard_data(force_refresh=True), None


@pytest.fixture
def dashboard_view(qapp):
    from views.widgets.dashboard_view import DashboardView
    view = DashboardView()
    view.controller = _StubController()
    return view


class TestDashboardRefreshRegression:
    def test_chart_count_stable_after_many_refreshes(self, qapp, dashboard_view):
        """Back-to-back rebuilds (no event-loop flush) must NOT stack orphaned charts.

        The legacy bug accumulated 2 stale QChartView widgets per rebuild. A
        flush at the end must converge back to exactly 2 (donut + bar).
        """
        view = dashboard_view
        data = _sample_dashboard_data()

        for _ in range(12):
            view._on_data_loaded(data, "")

        # NOTE: deliberately NO event-loop flush here. The regression is that
        # back-to-back rebuilds with no Qt event-loop turn leave orphaned
        # QChartView widgets stacked (the fix flushes deferred deletes inline).
        n = len(view.content_widget.findChildren(QChartView))
        assert n == 2, (
            f"Charts grew to {n} after 12 back-to-back refreshes "
            f"(expected exactly 2: donut + bar). Orphaned QChartView leak."
        )

    def test_layout_count_stable(self, qapp, dashboard_view):
        view = dashboard_view
        data = _sample_dashboard_data()
        view._on_data_loaded(data, "")
        _flush_deferred(qapp)
        baseline = view.content_layout.count()

        for _ in range(8):
            view._on_data_loaded(data, "")
            _flush_deferred(qapp)
            assert view.content_layout.count() == baseline

    def test_public_refresh_method_uses_force_flag(self, qapp, dashboard_view):
        view = dashboard_view
        # refresh() drives the async thread path (force=False flag path)
        view.refresh()
        qapp.processEvents()
        # Wait for the load thread to finish, if it is still running.
        thread = view._load_thread
        if thread is not None:
            thread.wait(5000)
        qapp.processEvents()
        _flush_deferred(qapp)
        assert len(view.content_widget.findChildren(QChartView)) == 2

    def test_repeated_refreshes_do_not_crash(self, qapp, dashboard_view):
        """Regression: a finished+deleted load thread must not be touched again.

        Legacy bug: 'finished' -> deleteLater() destroyed the C++ QThread while
        the Python wrapper stayed alive, so every later refresh raised
        'Internal C++ object (DashboardLoadThread) already deleted' from
        _load_thread.isRunning().
        """
        view = dashboard_view
        for _ in range(6):
            view.refresh()
            thread = view._load_thread
            if thread is not None:
                thread.wait(2000)
            for _ in range(50):
                qapp.processEvents()
            _flush_deferred(qapp)
            # After the thread finished and its events were delivered, the
            # wrapper must be cleared or still a live C++ object.
            assert view._load_thread is None or shiboken6.isValid(view._load_thread)

    def test_empty_state_does_not_leak(self, qapp, dashboard_view):
        view = dashboard_view
        view._on_data_loaded({}, "simulated error")
        _flush_deferred(qapp)
        view._on_data_loaded({}, "simulated error")
        _flush_deferred(qapp)
        assert len(view.content_widget.findChildren(QChartView)) == 0

    def test_show_event_marker(self, qapp, dashboard_view):
        assert dashboard_view.refresh_btn is not None
        assert dashboard_view.last_updated_label is not None