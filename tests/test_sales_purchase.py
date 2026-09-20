"""Integration-style service tests for SalesInvoiceService and
PurchaseInvoiceService: stock movement, automatic double-entry posting,
and validation guards."""
from __future__ import annotations

import pytest

from services.sales_invoice_service import SalesInvoiceService
from services.purchase_invoice_service import PurchaseInvoiceService
from utils.exceptions import ValidationError, InsufficientStockError
from helpers import seed as seed_helpers
from helpers import books


@pytest.fixture()
def sales_svc(qa_db):
    return SalesInvoiceService(qa_db)


@pytest.fixture()
def purchase_svc(qa_db):
    return PurchaseInvoiceService(qa_db)


def _stock_qty(qa_db, item_id):
    row = qa_db.fetch_one(
        "SELECT quantity_in_stock q FROM stock_batches WHERE item_id=?", (item_id,)
    )
    return float(row["q"]) if row else 0.0


class TestSalesInvoice:
    def test_create_credit_sale_reduces_stock_and_posts_journal(self, qa_db, sales_svc):
        cust, item = seed_helpers.make_customer_and_stocked_item(qa_db, "SI Cust", "SI Item")
        before = _stock_qty(qa_db, item.id)
        invoice = sales_svc.create_sales_invoice(
            invoice_number="SI-1000", customer_id=cust.id, invoice_date="2026-01-01",
            payment_type="CREDIT",
            items=[{"item_id": item.id, "quantity": 10, "unit_price": 70.0}],
        )
        assert invoice.id is not None
        assert invoice.total_amount == 700.0
        assert _stock_qty(qa_db, item.id) == before - 10
        # AR (1100) debited 700, revenue (4000) credited 700
        assert abs(books.ar_balance(qa_db) - 700.0) < 0.01
        assert abs(books.revenue_total(qa_db) - 700.0) < 0.01
        books.assert_books_balanced(qa_db)
        # journal linked to this invoice
        entry = books.journal_entries_for(qa_db, "sales_invoices", invoice.id)
        assert len(entry) == 1

    def test_cash_sale_uses_cash_account(self, qa_db, sales_svc):
        cust, item = seed_helpers.make_customer_and_stocked_item(qa_db, "Cash Cust", "Cash Item")
        sales_svc.create_sales_invoice(
            invoice_number="SI-CASH", customer_id=cust.id, invoice_date="2026-01-01",
            payment_type="CASH",
            items=[{"item_id": item.id, "quantity": 2, "unit_price": 100.0}],
        )
        # cash debited, revenue credited
        assert abs(books.cash_balance(qa_db) - 200.0) < 0.01
        assert abs(books.revenue_total(qa_db) - 200.0) < 0.01
        books.assert_books_balanced(qa_db)

    def test_insufficient_stock_raises(self, qa_db, sales_svc):
        cust, item = seed_helpers.make_customer_and_stocked_item(qa_db, "Low Cust", "Low Item")
        with pytest.raises(InsufficientStockError):
            sales_svc.create_sales_invoice(
                invoice_number="SI-OVER", customer_id=cust.id, invoice_date="2026-01-01",
                payment_type="CREDIT",
                items=[{"item_id": item.id, "quantity": 99999, "unit_price": 70.0}],
            )

    def test_invalid_payment_type_raises(self, qa_db, sales_svc):
        cust, item = seed_helpers.make_customer_and_stocked_item(qa_db, "P", "PP")
        with pytest.raises(ValidationError):
            sales_svc.create_sales_invoice(
                invoice_number="SI-BAD", customer_id=cust.id, invoice_date="2026-01-01",
                payment_type="TRADE",
                items=[{"item_id": item.id, "quantity": 1, "unit_price": 70.0}],
            )

    def test_empty_items_raises(self, qa_db, sales_svc):
        cust, item = seed_helpers.make_customer_and_stocked_item(qa_db, "E", "EE")
        with pytest.raises(ValidationError):
            sales_svc.create_sales_invoice(
                invoice_number="SI-NONE", customer_id=cust.id, invoice_date="2026-01-01",
                payment_type="CREDIT", items=[],
            )

    def test_non_customer_raises(self, qa_db, sales_svc):
        sup, item = seed_helpers.make_supplier_with_stocked_item(qa_db, "Not A Customer")
        with pytest.raises(ValidationError):
            sales_svc.create_sales_invoice(
                invoice_number="SI-WRONG", customer_id=sup.id, invoice_date="2026-01-01",
                payment_type="CREDIT",
                items=[{"item_id": item.id, "quantity": 1, "unit_price": 70.0}],
            )

    def test_no_stock_raises(self, qa_db, sales_svc):
        cust = seed_helpers.customer(qa_db, "NoStock Cust")
        item = seed_helpers.make_item(qa_db, "Unstocked Item")
        with pytest.raises(ValidationError):
            sales_svc.create_sales_invoice(
                invoice_number="SI-NOSTOCK", customer_id=cust.id, invoice_date="2026-01-01",
                payment_type="CREDIT",
                items=[{"item_id": item.id, "quantity": 1, "unit_price": 10.0}],
            )

    def test_get_and_list(self, qa_db, sales_svc):
        cust, item = seed_helpers.make_customer_and_stocked_item(qa_db, "GL", "GL Item")
        invoice = sales_svc.create_sales_invoice(
            invoice_number="SI-LIST", customer_id=cust.id, invoice_date="2026-01-01",
            payment_type="CREDIT",
            items=[{"item_id": item.id, "quantity": 1, "unit_price": 50.0}],
        )
        fetched = sales_svc.get_sales_invoice(invoice.id)
        assert fetched.invoice_number == "SI-LIST"
        invoices = sales_svc.list_sales_invoices(company_id=1)
        assert any(i.id == invoice.id for i in invoices)
class TestPurchaseInvoice:
    def test_create_credit_purchase_increases_stock_and_posts(self, qa_db, purchase_svc):
        sup = seed_helpers.supplier(qa_db, "PI Supplier")
        item = seed_helpers.make_item(qa_db, "Raw Material", item_type="RAW_MATERIAL",
                                      purchase_price=40.0)
        before = _stock_qty(qa_db, item.id)
        invoice = purchase_svc.create_purchase_invoice(
            invoice_number="PI-1000", supplier_id=sup.id, invoice_date="2026-01-01",
            payment_type="CREDIT",
            items=[{"item_id": item.id, "quantity": 100, "unit_cost": 40.0}],
        )
        assert invoice.id is not None
        assert invoice.total_amount == 4000.0
        assert _stock_qty(qa_db, item.id) == before + 100
        # inventory (1200) debited 4000, AP (2000) credited 4000
        assert abs(books.ledger_balance(qa_db, "1200") - 4000.0) < 0.01
        assert abs(books.ap_balance(qa_db) - 4000.0) < 0.01
        books.assert_books_balanced(qa_db)

    def test_invalid_quantity_raises(self, qa_db, purchase_svc):
        sup = seed_helpers.supplier(qa_db, "Bad Qty Sup")
        item = seed_helpers.make_item(qa_db, "BadQtyItem")
        with pytest.raises(ValidationError):
            purchase_svc.create_purchase_invoice(
                invoice_number="PI-BAD", supplier_id=sup.id, invoice_date="2026-01-01",
                payment_type="CREDIT",
                items=[{"item_id": item.id, "quantity": 0, "unit_cost": 10.0}],
            )

    def test_non_supplier_raises(self, qa_db, purchase_svc):
        cust = seed_helpers.customer(qa_db, "PI Wrong Party")
        item = seed_helpers.make_item(qa_db, "W Item")
        with pytest.raises(ValidationError):
            purchase_svc.create_purchase_invoice(
                invoice_number="PI-WRONG", supplier_id=cust.id, invoice_date="2026-01-01",
                payment_type="CREDIT",
                items=[{"item_id": item.id, "quantity": 1, "unit_cost": 10.0}],
            )

    def test_invalid_payment_type_raises(self, qa_db, purchase_svc):
        sup = seed_helpers.supplier(qa_db, "BadPT")
        item = seed_helpers.make_item(qa_db, "BPT Item")
        with pytest.raises(ValidationError):
            purchase_svc.create_purchase_invoice(
                invoice_number="PI-BPT", supplier_id=sup.id, invoice_date="2026-01-01",
                payment_type="NOPE",
                items=[{"item_id": item.id, "quantity": 1, "unit_cost": 10.0}],
            )

    def test_get_and_list(self, qa_db, purchase_svc):
        sup = seed_helpers.supplier(qa_db, "List Sup")
        item = seed_helpers.make_item(qa_db, "List Item")
        invoice = purchase_svc.create_purchase_invoice(
            invoice_number="PI-LIST", supplier_id=sup.id, invoice_date="2026-01-01",
            payment_type="CREDIT",
            items=[{"item_id": item.id, "quantity": 5, "unit_cost": 20.0}],
        )
        fetched = purchase_svc.get_purchase_invoice(invoice.id)
        assert fetched.invoice_number == "PI-LIST"
        invoices = purchase_svc.list_purchase_invoices(company_id=1)
        assert any(i.id == invoice.id for i in invoices)