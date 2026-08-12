"""Regression tests ported from the legacy standalone test scripts.

Covers previously-fixed bugs: customer-dict handling in sales updates,
activity-logger signatures, party model constructor compatibility, and
database connectivity.
"""
from __future__ import annotations

import inspect

import pytest


class TestSalesInvoiceUpdateFixes:
    """Ported from test_error_fixes.py (no DB needed)."""

    def test_customer_dict_has_no_name_attr(self):
        customer = {"id": 1, "name": "Test Customer", "code": "CUST-001"}
        assert not hasattr(customer, "name")
        assert customer.get("name", "Unknown") == "Test Customer"

    def test_party_object_has_name_attr(self):
        from models.party import Party
        customer = Party(id=1, code="CUST-001", name="Object Customer",
                         party_type="CUSTOMER", company_id=1)
        assert hasattr(customer, "name")
        assert customer.name == "Object Customer"

    def test_log_sales_invoice_updated_signature(self):
        from utils.activity_logger import log_sales_invoice_updated
        sig = inspect.signature(log_sales_invoice_updated)
        params = list(sig.parameters.keys())

        required = ["invoice_id", "invoice_number", "customer_name", "total_amount"]
        optional = ["user_id", "username", "company_id", "changes"]
        removed = ["items_count", "payment_type"]

        assert all(p in params for p in required)
        assert all(p in params for p in optional)
        assert all(p not in params for p in removed)

    def test_accounting_service_has_post_journal_entry(self):
        from services.accounting_service import AccountingService
        assert hasattr(AccountingService, "post_journal_entry")

    def test_sales_service_instantiable(self):
        # Does not hit DB: constructor only wires repositories (lazy).
        from services.sales_invoice_service import SalesInvoiceService
        svc = SalesInvoiceService()
        assert svc is not None


class TestPurchaseInvoiceFixes:
    """Ported from test_purchase_invoice_fix.py."""

    def test_party_accepts_customer_category(self):
        from models.party import Party
        p = Party(code="C1", name="Cat Customer", party_type="CUSTOMER",
                  customer_category="Retail")
        assert p.customer_category == "Retail"

    def test_party_from_row_preserves_customer_category(self):
        from models.party import Party
        row = {
            "id": 1, "company_id": 1, "code": "C1", "name": "N",
            "party_type": "CUSTOMER", "credit_limit": 0.0, "account_id": None,
            "phone": None, "address": None, "email": None, "is_active": 1,
            "created_at": None, "opening_balance": 0.0,
            "customer_category": "Wholesale",
        }
        p = Party.from_row(row)
        assert p.customer_category == "Wholesale"

    def test_party_to_dict_includes_category(self):
        from models.party import Party
        from models.enums import PartyType
        p = Party(code="C1", name="N", party_type=PartyType.CUSTOMER,
                  customer_category="Retail")
        assert p.to_dict()["customer_category"] == "Retail"

    def test_party_repository_get_by_id(self, db):
        # Smoke test against the live DB (original test 8)
        from repositories.party_repository import PartyRepository
        repo = PartyRepository(db)
        rows = repo.find_all_for_company(1, active_only=True)
        if not rows:
            pytest.skip("no parties seeded")
        first = rows[0]
        fetched = repo.get_by_id(first["id"])
        assert fetched["id"] == first["id"]


class TestDatabaseConnectivity:
    """Ported from test_db.py -- verify the connection layer answers."""

    def test_db_can_query_tables(self, db):
        row = db.fetch_one("SELECT COUNT(*) AS c FROM sqlite_master")
        assert row is not None

    def test_migrations_seed_system_accounts(self, db):
        cash = db.fetch_one(
            "SELECT id FROM accounts WHERE account_code = '1000' AND company_id = 1"
        )
        assert cash is not None

    def test_db_supports_transaction_rollback(self, db):
        before = db.fetch_one("SELECT COUNT(*) c FROM parties")["c"]
        try:
            with db.transaction():
                db.execute(
                    "INSERT INTO parties (company_id, code, name, party_type, is_active) "
                    "VALUES (1, 'ROLLBACK-TEST', 'RB', 'CUSTOMER', 1)"
                )
                raise RuntimeError("force rollback")
        except RuntimeError:
            pass
        after = db.fetch_one("SELECT COUNT(*) c FROM parties")["c"]
        assert after == before
