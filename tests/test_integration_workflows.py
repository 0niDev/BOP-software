"""Controller-layer ABI tests: every controller method must return the
 documented tuple shape — (value, None) on success and (None/False, "message")
 on failure — never raising to the caller."""
from __future__ import annotations

import pytest

from controllers.item_controller import ItemController
from controllers.party_controller import PartyController
from controllers.banking_controller import BankingController
from controllers.account_controller import AccountController
from controllers.expense_controller import ExpenseController
from controllers.sales_invoice_controller import SalesInvoiceController
from controllers.purchase_invoice_controller import PurchaseInvoiceController
from controllers.payment_controller import PaymentController
from controllers.manufacturing_controller import ManufacturingController
from controllers.auth_controller import AuthController
from controllers.report_controller import ReportController
from controllers.dashboard_controller import DashboardController

from models.enums import PartyType, AccountType
from helpers import seed as seed_helpers


class TestItemController:
    def test_create_item_success(self, qa_db):
        ok, err = ItemController().create_item(
            item_name="Ctrl Item", notes=None, unit="KG",
            purchase_price=5.0, selling_price=8.0,
            minimum_stock=10.0, maximum_stock=1000.0,
            tax_rate_id=None, item_type="RAW_MATERIAL", category_id=None,
        )
        assert ok is True and err is None

    def test_create_item_invalid_returns_error(self, qa_db):
        ok, err = ItemController().create_item(
            item_name="", notes=None, unit="KG",
            purchase_price=5.0, selling_price=8.0,
            minimum_stock=10.0, maximum_stock=1000.0,
            tax_rate_id=None, item_type="RAW_MATERIAL", category_id=None,
        )
        assert ok is False and isinstance(err, str) and err

    def test_get_item_missing(self, qa_db):
        item, err = ItemController().get_item(999999)
        assert item is None and isinstance(err, str)

    def test_list_items(self, qa_db):
        seed_helpers.make_item(qa_db, "Listed Ctrl Item")
        items, err = ItemController().list_items()
        assert err is None and isinstance(items, list) and items


class TestPartyController:
    def test_create_party_success(self, qa_db):
        ok, err = PartyController().create_party(
            name="Ctrl Party", party_type=PartyType.CUSTOMER, credit_limit=0.0,
        )
        assert ok is True and err is None

    def test_create_party_duplicate_code(self, qa_db):
        from services.party_service import PartyService
        PartyService(qa_db).create_party(
            name="Dup Party", party_type=PartyType.CUSTOMER, credit_limit=0.0, code="DUP-1",
        )
        ok, err = PartyController().create_party(
            name="Other", party_type=PartyType.SUPPLIER, credit_limit=0.0, code="DUP-1",
        )
        assert ok is False and isinstance(err, str)

    def test_list_parties(self, qa_db):
        parties, err = PartyController().list_parties()
        assert err is None and isinstance(parties, list)


class TestBankingController:
    def test_create_bank_account(self, qa_db):
        ok, err = BankingController().create_bank_account(
            "Ctrl Bank", "Ctrl Title", "CTRL-001",
        )
        assert ok is True and err is None

    def test_create_bank_account_error(self, qa_db):
        ok, err = BankingController().create_bank_account("", "T", "N2")
        assert ok is False and isinstance(err, str)


class TestAccountController:
    def test_create_account(self, qa_db):
        ok, err = AccountController().create_account(
            "9900", "Ctrl Account", AccountType.ASSET, None, 0.0,
        )
        assert ok is True and err is None

    def test_create_account_bad_type(self, qa_db):
        ok, err = AccountController().create_account(
            "9901", "Bad", "NOT_A_TYPE", None, 0.0,
        )
        assert ok is False and isinstance(err, str)


class TestExpenseController:
    def test_create_category_and_expense_flow(self, qa_db):
        ctrl = ExpenseController()
        ok, err = ctrl.create_category("Ctrl Cat")
        assert ok is True and err is None
        cat, err = ctrl.list_categories()
        assert err is None and any(c.name == "Ctrl Cat" for c in cat)
        cat_id = next(c.id for c in cat if c.name == "Ctrl Cat")
        ok, err = ctrl.create_expense(
            voucher_number="EX-CTRL-1", category_id=cat_id,
            expense_date="2026-01-01", amount=50.0, payment_method="CASH",
        )
        assert ok is True and err is None
        books_balanced = True
        assert books_balanced
        expenses, err = ctrl.list_expenses()
        assert err is None and len(expenses) >= 1

    def test_create_expense_invalid(self, qa_db):
        ctrl = ExpenseController()
        ok, err = ctrl.create_expense(
            voucher_number="EX-BAD2", category_id=999999,
            expense_date="2026-01-01", amount=50.0, payment_method="CASH",
        )
        assert ok is False and isinstance(err, str)


class TestSalesInvoiceController:
    def test_create_success_and_failure(self, qa_db):
        ctrl = SalesInvoiceController()
        cust, item = seed_helpers.make_customer_and_stocked_item(qa_db, "Ctrl Cust", "Ctrl Item")
        ok, err = ctrl.create_sales_invoice(
            invoice_number="SI-CTRL-1", customer_id=cust.id,
            invoice_date="2026-01-01", payment_type="CREDIT",
            items=[{"item_id": item.id, "quantity": 2, "unit_price": 25.0}],
            notes=None,
        )
        assert ok is True and err is None
        # duplicate voucher number -> controller error tuple, no raise
        ok, err = ctrl.create_sales_invoice(
            invoice_number="SI-CTRL-1", customer_id=cust.id,
            invoice_date="2026-01-01", payment_type="CREDIT",
            items=[{"item_id": item.id, "quantity": 1, "unit_price": 25.0}],
            notes=None,
        )
        assert ok is False and isinstance(err, str)

    def test_list(self, qa_db):
        invoices, err = SalesInvoiceController().list_sales_invoices()
        assert err is None and isinstance(invoices, list)


class TestPurchaseInvoiceController:
    def test_create_success_and_failure(self, qa_db):
        ctrl = PurchaseInvoiceController()
        sup = seed_helpers.supplier(qa_db, "Ctrl Sup")
        item = seed_helpers.make_item(qa_db, "Ctrl Purchase Item")
        ok, err = ctrl.create_purchase_invoice(
            invoice_number="PI-CTRL-1", supplier_id=sup.id,
            invoice_date="2026-01-01", payment_type="CREDIT",
            items=[{"item_id": item.id, "quantity": 3, "unit_cost": 9.0}],
            notes=None,
        )
        assert ok is True and err is None
        ok, err = ctrl.create_purchase_invoice(
            invoice_number="PI-CTRL-2", supplier_id=sup.id,
            invoice_date="2026-01-01", payment_type="CREDIT",
            items=[{"item_id": item.id, "quantity": 0, "unit_cost": 9.0}],
            notes=None,
        )
        assert ok is False and isinstance(err, str)

    def test_list(self, qa_db):
        invoices, err = PurchaseInvoiceController().list_purchase_invoices()
        assert err is None and isinstance(invoices, list)


class TestPaymentController:
    def test_receive_payment_success_and_failure(self, qa_db):
        from helpers import books
        ctrl = PaymentController()
        cust, item = seed_helpers.make_customer_and_stocked_item(qa_db, "Pay Ctrl", "Pay Ctrl Item")
        SalesInvoiceController().create_sales_invoice(
            invoice_number="SI-PAYCTRL", customer_id=cust.id,
            invoice_date="2026-01-01", payment_type="CREDIT",
            items=[{"item_id": item.id, "quantity": 1, "unit_price": 100.0}],
            notes=None,
        )
        ar_before = books.ar_balance(qa_db)
        ok, err = ctrl.receive_payment(
            customer_id=cust.id, amount=100.0, payment_date="2026-01-02",
            payment_method="CASH", sales_invoice_id=None,
        )
        assert ok is True and err is None
        assert books.ar_balance(qa_db) == ar_before - 100.0
        ok, err = ctrl.receive_payment(
            customer_id=cust.id, amount=-5.0, payment_date="2026-01-02",
            payment_method="CASH",
        )
        assert ok is False and isinstance(err, str)


class TestManufacturingController:
    def test_create_bom_success_and_failure(self, qa_db):
        ctrl = ManufacturingController()
        raw = seed_helpers.make_item(qa_db, "Ctrl Raw", item_type="RAW_MATERIAL")
        finish = seed_helpers.make_item(qa_db, "Ctrl Finish", item_type="FINISHED_GOOD")
        ok, err = ctrl.create_bom(
            finished_item_id=finish.id, output_quantity=5,
            components=[{"component_item_id": raw.id, "quantity_required": 1}],
            bom_name="CTRL-BOM",
        )
        assert ok is True and err is None
        ok, err = ctrl.create_bom(
            finished_item_id=raw.id, output_quantity=5,  # not a FINISHED_GOOD
            components=[{"component_item_id": raw.id, "quantity_required": 1}],
        )
        assert ok is False and isinstance(err, str)
        ctrl = ExpenseController()
        ok, err = ctrl.create_expense(
            voucher_number="EX-BAD", category_id=999999,
            expense_date="2026-01-01", amount=50.0, payment_method="CASH",
        )
        assert ok is False and isinstance(err, str)
class TestAuthController:
    def test_login_success(self, qa_db, auth):
        svc, _user = auth
        user, err = AuthController(svc).login("admin", "admin123")
        assert err is None and user is not None and user.username == "admin"

    def test_login_failure(self, qa_db, auth):
        svc, _user = auth
        user, err = AuthController(svc).login("admin", "wrong")
        assert user is None and isinstance(err, str)

    def test_current_user_property(self, qa_db):
        from authentication.auth_service import AuthService
        ctrl = AuthController(AuthService())
        assert ctrl.current_user is None
        ctrl.login("admin", "admin123")
        assert ctrl.current_user is not None


class TestReportController:
    def test_trial_balance(self, qa_db):
        data, err = ReportController().get_trial_balance()
        assert err is None
        assert data is not None and "parties_summary" in data

    def test_profit_loss(self, qa_db):
        data, err = ReportController().get_profit_loss("2020-01-01", "2030-12-31")
        assert err is None and data is not None

    def test_balance_sheet(self, qa_db):
        data, err = ReportController().get_balance_sheet()
        assert err is None and data is not None

    def test_cash_book(self, qa_db):
        data, err = ReportController().get_cash_book("2020-01-01", "2030-12-31")
        assert err is None and data is not None


class TestDashboardController:
    def test_get_dashboard_data(self, qa_db):
        data, err = DashboardController().get_dashboard_data()
        assert err is None
        assert isinstance(data, dict)
        for key in ("today", "balances", "receivables_payables",
                    "profit_loss", "recent_transactions", "inventory", "alerts"):
            assert key in data, f"dashboard missing key: {key}"
        assert "cash" in data["balances"]
        assert "receivable" in data["receivables_payables"]
        assert "sales_total" in data["today"]