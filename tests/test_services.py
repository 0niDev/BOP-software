"""Service-layer integration tests against the live database.

Runs a complete business flow (party → item → purchase → sales → payments)
and verifies the accounting engine posts balanced, correct journal entries.
"""
from __future__ import annotations

import pytest
from decimal import Decimal

from models.enums import PartyType, VoucherType
from services.party_service import PartyService
from services.item_service import ItemService
from services.purchase_invoice_service import PurchaseInvoiceService
from services.sales_invoice_service import SalesInvoiceService
from services.accounting_service import AccountingService
from services.payment_service import PaymentService
from repositories.account_repository import AccountRepository
from utils.exceptions import ValidationError


class TestPartyService:
    def test_create_and_get(self, db, unique_code, cleanup_registry):
        svc = PartyService(db)
        code = unique_code("PSR")
        p = svc.create_party(name="Party Service Test", party_type=PartyType.CUSTOMER,
                             credit_limit=10000.0, code=code)
        cleanup_registry["parties"].append(p.id)
        assert p.id > 0
        assert p.code == code
        assert p.credit_limit == 10000.0

        fetched = svc.get_party(p.id)
        assert fetched.name == "Party Service Test"

    def test_duplicate_code_rejected(self, db, unique_code, cleanup_registry):
        svc = PartyService(db)
        code = unique_code("PSR")
        p = svc.create_party(name="First", party_type=PartyType.SUPPLIER, code=code)
        cleanup_registry["parties"].append(p.id)
        with pytest.raises(ValidationError):
            svc.create_party(name="Second", party_type=PartyType.SUPPLIER, code=code)

    def test_blank_name_rejected(self, db):
        svc = PartyService(db)
        with pytest.raises(ValidationError):
            svc.create_party(name="   ", party_type=PartyType.CUSTOMER)

    def test_update(self, db, unique_code, cleanup_registry):
        svc = PartyService(db)
        code = unique_code("PSR")
        p = svc.create_party(name="Before", party_type=PartyType.BOTH, code=code)
        cleanup_registry["parties"].append(p.id)
        svc.update_party(p.id, name="After", credit_limit=500.0, account_id=None)
        fetched = svc.get_party(p.id)
        assert fetched.name == "After"
        assert fetched.credit_limit == 500.0

    def test_list_parties(self, db):
        svc = PartyService(db)
        customers = svc.list_parties(active_only=True, party_type=PartyType.CUSTOMER)
        suppliers = svc.list_parties(active_only=True, party_type=PartyType.SUPPLIER)
        assert isinstance(customers, list)
        assert isinstance(suppliers, list)


class TestItemService:
    def test_create_and_get(self, db, unique_code, cleanup_registry):
        svc = ItemService(db)
        code = unique_code("ISR")
        item = svc.create_item(item_name="Service Test Item", unit="UNIT",
                               item_code=code, purchase_price=25.0,
                               selling_price=40.0)
        cleanup_registry["items"].append(item.id)
        assert item.id > 0
        assert item.item_code == code

        fetched = svc.get_item(item.id)
        assert fetched is not None
        assert fetched.selling_price == 40.0

    def test_duplicate_code_rejected(self, db, unique_code, cleanup_registry):
        svc = ItemService(db)
        code = unique_code("ISR")
        item = svc.create_item(item_name="Dup Item", item_code=code)
        cleanup_registry["items"].append(item.id)
        with pytest.raises(ValidationError):
            svc.create_item(item_name="Dup Item 2", item_code=code)

    def test_blank_name_rejected(self, db):
        svc = ItemService(db)
        with pytest.raises(ValidationError):
            svc.create_item(item_name="  ")


class TestAccountingService:
    def test_post_balanced_entry(self, db):
        svc = AccountingService(db)
        acc_repo = AccountRepository(db)
        cash = acc_repo.find_by_code("1000", 1)
        equity = acc_repo.find_by_code("3000", 1)
        assert cash and equity

        from services.accounting_service import JournalLine
        from utils.exceptions import UnbalancedJournalEntryError

        with db.transaction():
            entry_id = svc.post_journal_entry(
                voucher_type=VoucherType.JOURNAL,
                entry_date="2026-08-12",
                lines=[
                    JournalLine(account_id=cash["id"], debit=100.0),
                    JournalLine(account_id=equity["id"], credit=100.0),
                ],
                narration="test balanced entry",
                source_table="TST_JOURNAL",
                source_id=0,
            )
        assert entry_id > 0
        row = svc.get_journal_entry("TST_JOURNAL", 0)
        assert row is not None
        assert len(row.get("lines", [])) == 2

        # cleanup
        db.execute("DELETE FROM journal_entry_lines WHERE journal_entry_id = ?", (entry_id,))
        db.execute("DELETE FROM journal_entries WHERE id = ?", (entry_id,))

    def test_unbalanced_entry_rejected(self, db):
        svc = AccountingService(db)
        acc_repo = AccountRepository(db)
        cash = acc_repo.find_by_code("1000", 1)
        from services.accounting_service import JournalLine
        from utils.exceptions import UnbalancedJournalEntryError
        with pytest.raises(UnbalancedJournalEntryError):
            with db.transaction():
                svc.post_journal_entry(
                    voucher_type=VoucherType.JOURNAL,
                    entry_date="2026-08-12",
                    lines=[
                        JournalLine(account_id=cash["id"], debit=100.0),
                        JournalLine(account_id=cash["id"], debit=50.0),
                    ],
                    narration="unbalanced",
                )

    def test_trial_balance(self, db):
        svc = AccountingService(db)
        tb = svc.get_trial_balance(1)
        assert isinstance(tb, list)

    def test_account_balance_returns_number(self, db):
        svc = AccountingService(db)
        acc_repo = AccountRepository(db)
        cash = acc_repo.find_by_code("1000", 1)
        bal = svc.get_account_balance(cash["id"])
        assert isinstance(bal, (int, float, Decimal))


class TestFullBusinessFlow:
    """End-to-end: party+item -> purchase -> sales -> payments, checking balances."""

    @pytest.fixture(autouse=True)
    def _setup(self, db, unique_code, cleanup_registry):
        self.db = db
        self.cleanup = cleanup_registry
        self.party_svc = PartyService(db)
        self.item_svc = ItemService(db)
        self.purchase_svc = PurchaseInvoiceService(db)
        self.sales_svc = SalesInvoiceService(db)
        self.payment_svc = PaymentService(db)
        self.accounting = AccountingService(db)
        self.acc_repo = AccountRepository(db)

        self.supplier = self.party_svc.create_party(
            name="Flow Supplier", party_type=PartyType.SUPPLIER,
            code=unique_code("FLW"))
        cleanup_registry["parties"].append(self.supplier.id)

        self.customer = self.party_svc.create_party(
            name="Flow Customer", party_type=PartyType.CUSTOMER,
            code=unique_code("FLW"))
        cleanup_registry["parties"].append(self.customer.id)

        self.item = self.item_svc.create_item(
            item_name="Flow Item", unit="UNIT", item_code=unique_code("FLW"),
            purchase_price=100.0, selling_price=150.0)
        cleanup_registry["items"].append(self.item.id)

    def _balance(self, code):
        from repositories.base_repository import BaseRepository
        BaseRepository._cache.clear()
        BaseRepository._session_cache = None
        acc = self.acc_repo.find_by_code(code, 1)
        bal = self.accounting.get_account_balance(acc["id"])
        return Decimal(str(bal.get("balance", bal) if isinstance(bal, dict) else bal))

    def _inventory_value(self):
        from repositories.base_repository import BaseRepository
        BaseRepository._cache.clear()
        BaseRepository._session_cache = None
        from services.dashboard_service import DashboardService
        ds = DashboardService(self.db)
        ds.invalidate_cache()
        return Decimal(str(ds._get_balances(1).get("inventory", 0)))

    def test_purchase_credit_changes_ap_and_inventory(self):
        initial_ap = self._balance("2000")
        initial_inv = self._inventory_value()
        qty, unit_cost = 10, 100.0
        expected = Decimal(str(qty * unit_cost))

        invoice = self.purchase_svc.create_purchase_invoice(
            invoice_number="PI-FLOW-" + self.item.item_code,
            supplier_id=self.supplier.id,
            invoice_date="2026-08-12",
            payment_type="CREDIT",
            items=[{"item_id": self.item.id, "quantity": qty,
                    "unit_cost": unit_cost, "discount_amount": 0, "tax_amount": 0}],
            notes="flow test",
        )
        self.cleanup["purchase_invoices"].append(invoice)

        assert abs(self._balance("2000") - initial_ap - expected) < Decimal("0.01")
        assert abs(self._inventory_value() - initial_inv - expected) < Decimal("0.01")

    def test_purchase_cash_decreases_cash(self):
        initial_cash = self._balance("1000")
        initial_inv = self._inventory_value()
        qty, unit_cost = 5, 100.0
        expected = Decimal(str(qty * unit_cost))

        invoice = self.purchase_svc.create_purchase_invoice(
            invoice_number="PI-FLOWC-" + self.item.item_code,
            supplier_id=self.supplier.id,
            invoice_date="2026-08-12",
            payment_type="CASH",
            items=[{"item_id": self.item.id, "quantity": qty,
                    "unit_cost": unit_cost, "discount_amount": 0, "tax_amount": 0}],
            notes="flow cash purchase",
        )
        self.cleanup["purchase_invoices"].append(invoice)

        assert abs(initial_cash - self._balance("1000") - expected) < Decimal("0.01")
        assert abs(self._inventory_value() - initial_inv - expected) < Decimal("0.01")

    def test_sales_credit_increases_ar_decreases_inventory(self):
        # Stock up first
        self.purchase_svc.create_purchase_invoice(
            invoice_number="PI-FLOW-S1-" + self.item.item_code,
            supplier_id=self.supplier.id,
            invoice_date="2026-08-12",
            payment_type="CREDIT",
            items=[{"item_id": self.item.id, "quantity": 100,
                    "unit_cost": 100.0, "discount_amount": 0, "tax_amount": 0}],
        )

        initial_ar = self._balance("1100")
        initial_inv = self._inventory_value()
        qty, unit_price = 10, 150.0
        expected_rev = Decimal(str(qty * unit_price))
        expected_cogs = Decimal(str(qty * 100.0))

        invoice = self.sales_svc.create_sales_invoice(
            invoice_number="SI-FLOW-" + self.item.item_code,
            customer_id=self.customer.id,
            invoice_date="2026-08-12",
            payment_type="CREDIT",
            items=[{"item_id": self.item.id, "quantity": qty,
                    "unit_price": unit_price, "discount_amount": 0, "tax_amount": 0}],
            notes="flow sale",
        )
        self.cleanup["sales_invoices"].append(invoice)

        assert abs(self._balance("1100") - initial_ar - expected_rev) < Decimal("0.01")
        assert abs(initial_inv - self._inventory_value() - expected_cogs) < Decimal("0.01")

    def test_receive_payment(self):
        self.purchase_svc.create_purchase_invoice(
            invoice_number="PI-FLOW-R1-" + self.item.item_code,
            supplier_id=self.supplier.id, invoice_date="2026-08-12",
            payment_type="CREDIT",
            items=[{"item_id": self.item.id, "quantity": 50,
                    "unit_cost": 100.0, "discount_amount": 0, "tax_amount": 0}],
        )
        inv = self.sales_svc.create_sales_invoice(
            invoice_number="SI-FLOW-R1-" + self.item.item_code,
            customer_id=self.customer.id, invoice_date="2026-08-12",
            payment_type="CREDIT",
            items=[{"item_id": self.item.id, "quantity": 10,
                    "unit_price": 150.0, "discount_amount": 0, "tax_amount": 0}],
        )
        self.cleanup["sales_invoices"].append(inv)

        initial_cash = self._balance("1000")
        initial_ar = self._balance("1100")
        expected = Decimal(str(inv.total_amount))

        self.payment_svc.receive_payment(
            customer_id=self.customer.id, amount=inv.total_amount,
            payment_date="2026-08-12", payment_method="CASH",
            reference_no="REC-FLOW", sales_invoice_id=inv.id,
        )

        assert abs(self._balance("1000") - initial_cash - expected) < Decimal("0.01")
        assert abs(initial_ar - self._balance("1100") - expected) < Decimal("0.01")

    def test_pay_supplier(self):
        inv = self.purchase_svc.create_purchase_invoice(
            invoice_number="PI-FLOW-P1-" + self.item.item_code,
            supplier_id=self.supplier.id, invoice_date="2026-08-12",
            payment_type="CREDIT",
            items=[{"item_id": self.item.id, "quantity": 10,
                    "unit_cost": 100.0, "discount_amount": 0, "tax_amount": 0}],
        )
        self.cleanup["purchase_invoices"].append(inv)

        initial_cash = self._balance("1000")
        initial_ap = self._balance("2000")
        expected = Decimal(str(inv.total_amount))

        self.payment_svc.pay_supplier(
            supplier_id=self.supplier.id, amount=inv.total_amount,
            payment_date="2026-08-12", payment_method="CASH",
            reference_no="PAY-FLOW", purchase_invoice_id=inv.id,
        )

        assert abs(initial_cash - self._balance("1000") - expected) < Decimal("0.01")
        assert abs(initial_ap - self._balance("2000") - expected) < Decimal("0.01")
