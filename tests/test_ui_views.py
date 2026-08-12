"""GUI smoke tests: every main view must construct without raising.

These are intentionally shallow -- they only verify that a view can be built
offscreen (catches import breakage, missing attribute renames, broken widget
libraries) without exercising business logic.
"""
from __future__ import annotations

import pytest

pytestmark = pytest.mark.gui

_SIMPLE_VIEWS = [
    ("party_view", "PartyView"),
    ("item_view", "ItemView"),
    ("sales_invoice_view", "SalesInvoiceView"),
    ("purchase_invoice_view", "PurchaseInvoiceView"),
    ("expense_view", "ExpenseView"),
    ("report_view", "ReportView"),
    ("backup_view", "BackupView"),
    ("banking_view", "BankingView"),
    ("manufacturing_view", "ManufacturingView"),
]

_DB_BACKED_VIEWS = [
    ("users_view", "UsersView"),
    ("asset_view", "AssetView"),
]


def _import_view(mod_name: str, cls_name: str):
    import importlib
    mod = importlib.import_module(f"views.widgets.{mod_name}")
    return getattr(mod, cls_name)


@pytest.mark.parametrize("mod_name,cls_name", _SIMPLE_VIEWS)
def test_view_constructs(qapp, mod_name, cls_name):
    cls = _import_view(mod_name, cls_name)
    widget = cls()
    assert widget is not None
    assert widget.objectName() is not None or widget.layout() is not None
    widget.deleteLater()
    qapp.processEvents()


@pytest.mark.parametrize("mod_name,cls_name", _DB_BACKED_VIEWS)
def test_db_backed_view_constructs(qapp, db, mod_name, cls_name):
    """These query the DB during construction, so migrations must have run."""
    cls = _import_view(mod_name, cls_name)
    widget = cls()
    assert widget is not None
    widget.deleteLater()
    qapp.processEvents()
