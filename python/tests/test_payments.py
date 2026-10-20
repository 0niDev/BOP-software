"""Tests for PaymentService: pay_supplier and receive_payment (automatic
journal posting, validations, and ledger impacts)."""
from __future__ import annotations

import pytest

from services.payment_service import PaymentService
from utils.exceptions import ValidationError
from helpers import seed as seed_helpers
from helpers import books


@pytest.fixture()
def svc(qa_db):
    return PaymentService(qa_db)


class TestPaySupplier:
    def test_pay_supplier_cash(self, qa_db, svc):
        sup = seed_helpers.supplier(qa_db, "Pay Vendor")
        payment_id = svc.pay_supplier(
            supplier_id=sup.id, amount=500, payment_date="2026-01-01",
            payment_method="CASH", reference_no="R1",
        )
        assert payment_id is not None
        row = qa_db.fetch_one("SELECT * FROM payments WHERE id=?", (payment_id,))
        assert row is not None and row["amount"] == 500
        # cash paid out (1000 debit), AP reduced (2000)
        assert abs(books.cash_balance(qa_db) + 500.0) < 0.01
        books.assert_books_balanced(qa_db)

    def test_pay_customer_raises(self, qa_db, svc):
        cust = seed_helpers.customer(qa_db, "Not A Supplier")
        with pytest.raises(ValidationError):
            svc.pay_supplier(supplier_id=cust.id, amount=10, payment_date="2026-01-01")

    def test_pay_zero_amount_raises(self, qa_db, svc):
        sup = seed_helpers.supplier(qa_db, "Zero Vendor")
        with pytest.raises(ValidationError):
            svc.pay_supplier(supplier_id=sup.id, amount=0, payment_date="2026-01-01")

    def test_pay_invalid_method_raises(self, qa_db, svc):
        sup = seed_helpers.supplier(qa_db, "M Vendor")
        with pytest.raises(ValidationError):
            svc.pay_supplier(supplier_id=sup.id, amount=10, payment_date="2026-01-01",
                             payment_method="CARD")

    def test_pay_unknown_supplier_raises(self, svc):
        from utils.exceptions import RecordNotFoundError
        with pytest.raises(RecordNotFoundError):
            svc.pay_supplier(supplier_id=99999, amount=10, payment_date="2026-01-01")


class TestReceivePayment:
    def test_receive_payment_cash(self, qa_db, svc):
        cust = seed_helpers.customer(qa_db, "Paying Customer")
        receipt_id = svc.receive_payment(
            customer_id=cust.id, amount=300, payment_date="2026-01-01",
            payment_method="CASH", reference_no="RC1",
        )
        assert receipt_id is not None
        row = qa_db.fetch_one("SELECT * FROM receipts WHERE id=?", (receipt_id,))
        assert row is not None and row["amount"] == 300
        # cash received (1000 credit -> balance negative means credit-normal),
        # AR reduced (1100 credited)
        assert abs(books.cash_balance(qa_db) - 300.0) < 0.01
        assert abs(books.ar_balance(qa_db) + 300.0) < 0.01
        books.assert_books_balanced(qa_db)

    def test_receive_from_supplier_raises(self, qa_db, svc):
        sup = seed_helpers.supplier(qa_db, "Wrong Party")
        with pytest.raises(ValidationError):
            svc.receive_payment(customer_id=sup.id, amount=10, payment_date="2026-01-01")

    def test_receive_zero_amount_raises(self, qa_db, svc):
        cust = seed_helpers.customer(qa_db, "Zero Cust")
        with pytest.raises(ValidationError):
            svc.receive_payment(customer_id=cust.id, amount=0, payment_date="2026-01-01")

    def test_receive_invalid_method_raises(self, qa_db, svc):
        cust = seed_helpers.customer(qa_db, "M Cust")
        with pytest.raises(ValidationError):
            svc.receive_payment(customer_id=cust.id, amount=10, payment_date="2026-01-01",
                                payment_method="CHEQUEBANK")

    def test_receive_updates_sales_invoice_paid(self, qa_db, svc):
        # A sales invoice sets AR; receiving reduces the outstanding amount.
        cust, item = seed_helpers.make_customer_and_stocked_item(qa_db, "Inv Cust", "Inv Item")
        from services.sales_invoice_service import SalesInvoiceService
        invoice = SalesInvoiceService(qa_db).create_sales_invoice(
            invoice_number="SI-PAY-1", customer_id=cust.id, invoice_date="2026-01-01",
            payment_type="CREDIT",
            items=[{"item_id": item.id, "quantity": 1, "unit_price": 70.0}],
        )
        svc.receive_payment(customer_id=cust.id, amount=30, payment_date="2026-01-02",
                            sales_invoice_id=invoice.id)
        row = qa_db.fetch_one("SELECT paid_amount FROM sales_invoices WHERE id=?", (invoice.id,))
        assert row["paid_amount"] == 30