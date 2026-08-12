"""Unit tests for domain models: dataclasses, factories, enums, permissions."""
from __future__ import annotations

import pytest

from models.enums import (
    AccountType,
    DocumentStatus,
    PartyType,
    PaymentMethod,
    VoucherType,
)
from models.user import Role, User, UserRole
from models.party import Party
from models.item import Item
from models.sales_invoice import SalesInvoice, SalesInvoiceItem


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TestEnums:
    def test_account_type_normal_balance(self):
        assert AccountType.ASSET.normal_balance_is_debit is True
        assert AccountType.EXPENSE.normal_balance_is_debit is True
        assert AccountType.LIABILITY.normal_balance_is_debit is False
        assert AccountType.EQUITY.normal_balance_is_debit is False
        assert AccountType.REVENUE.normal_balance_is_debit is False

    def test_account_type_label(self):
        assert AccountType.ASSET.label == "Asset"
        assert AccountType.EXPENSE.label == "Expense"

    def test_party_type_values(self):
        assert PartyType.CUSTOMER.value == "CUSTOMER"
        assert PartyType.SUPPLIER.value == "SUPPLIER"
        assert PartyType.BOTH.value == "BOTH"

    def test_payment_method_values(self):
        assert PaymentMethod.CASH.value == "CASH"
        assert PaymentMethod.BANK.value == "BANK"
        assert PaymentMethod.CHEQUE.value == "CHEQUE"
        assert PaymentMethod.CREDIT.value == "CREDIT"

    def test_voucher_type_values(self):
        assert VoucherType.SALES.value == "SALES"
        assert VoucherType.PURCHASE.value == "PURCHASE"
        assert VoucherType.PAYMENT.value == "PAYMENT"
        assert VoucherType.RECEIPT.value == "RECEIPT"

    def test_document_status_values(self):
        assert DocumentStatus.DRAFT.value == "DRAFT"
        assert DocumentStatus.CONFIRMED.value == "CONFIRMED"
        assert DocumentStatus.CANCELLED.value == "CANCELLED"


# ---------------------------------------------------------------------------
# User role permissions
# ---------------------------------------------------------------------------

class TestUserPermissions:
    def test_admin_has_full_access(self):
        perms = UserRole.ADMIN.permissions
        assert "dashboard" in perms
        assert "users" in perms
        assert "settings" in perms
        assert "backup" in perms

    def test_viewer_restricted(self):
        perms = UserRole.VIEWER.permissions
        assert "dashboard" in perms
        assert "reports" in perms
        assert "users" not in perms
        assert "inventory" not in perms

    def test_storekeeper_cannot_see_users(self):
        assert "users" not in UserRole.STOREKEEPER.permissions

    def test_role_permissions_map_keys_complete(self):
        for role in UserRole:
            assert isinstance(role.permissions, list), f"{role} has no permissions"


class TestUserModel:
    def test_from_row(self):
        row = {
            "id": 1,
            "username": "admin",
            "full_name": "System Admin",
            "role_id": 1,
            "role_name": "Admin",
            "email": "a@b.c",
            "is_active": 1,
            "last_login_at": None,
        }
        u = User.from_row(row)
        assert u.id == 1
        assert u.username == "admin"
        assert u.role_name == "Admin"
        assert u.is_active is True

    def test_can_access_uses_role(self):
        u = User(id=1, username="x", full_name="X", role_id=1, role_name="Admin")
        assert u.can_access("users") is True
        assert u.can_access("banking") is True

    def test_unknown_role_falls_back_to_viewer(self):
        u = User(id=2, username="y", full_name="Y", role_id=9, role_name="Ghost")
        assert u.can_access("users") is False
        assert u.can_access("dashboard") is True

    def test_role_dataclass(self):
        r = Role(id=3, name="Manager", description="Oversight")
        assert r.name == "Manager"


# ---------------------------------------------------------------------------
# Party model
# ---------------------------------------------------------------------------

class TestPartyModel:
    def test_from_row_roundtrip(self):
        row = {
            "id": 7,
            "company_id": 1,
            "code": "CUST-TEST",
            "name": "Alice Corp",
            "party_type": "CUSTOMER",
            "credit_limit": 5000.0,
            "account_id": 3,
            "phone": "123",
            "address": "addr",
            "email": "a@x.com",
            "is_active": 1,
            "created_at": "2026-01-01",
            "opening_balance": 100.0,
            "customer_category": "Retail",
        }
        p = Party.from_row(row)
        assert isinstance(p.party_type, PartyType)
        assert p.party_type is PartyType.CUSTOMER
        assert p.code == "CUST-TEST"
        assert p.customer_category == "Retail"

    def test_to_dict_serializes_enum(self):
        p = Party(code="SUPP-T", name="Bob Supplies", party_type=PartyType.SUPPLIER)
        d = p.to_dict()
        assert d["party_type"] == "SUPPLIER"
        assert d["is_active"] == 1

    def test_defaults(self):
        p = Party(code="X", name="Y", party_type=PartyType.BOTH)
        assert p.company_id == 1
        assert p.credit_limit == 0.0
        assert p.is_active is True


# ---------------------------------------------------------------------------
# Item model
# ---------------------------------------------------------------------------

class TestItemModel:
    def test_from_row(self):
        row = {
            "id": 10,
            "company_id": 1,
            "item_code": "ITEM-T",
            "item_name": "Test Item",
            "notes": "n",
            "unit": "BOX",
            "purchase_price": 12.5,
            "selling_price": 20.0,
            "minimum_stock": 5.0,
            "maximum_stock": 100.0,
            "tax_rate_id": 2,
            "item_type": "FINISHED_GOOD",
            "category_id": 1,
            "is_active": 1,
            "created_at": "2026-01-01",
        }
        it = Item.from_row(row)
        assert it.item_code == "ITEM-T"
        assert it.maximum_stock == 100.0
        assert it.is_active is True

    def test_to_dict(self):
        it = Item(item_code="A1", item_name="N", unit="KG")
        d = it.to_dict()
        assert d["unit"] == "KG"
        assert d["is_active"] == 1


# ---------------------------------------------------------------------------
# Sales invoice model
# ---------------------------------------------------------------------------

class TestSalesInvoiceModel:
    def test_from_row(self):
        row = {
            "id": 5,
            "company_id": 1,
            "warehouse_id": 1,
            "invoice_number": "SI-00001",
            "customer_id": 2,
            "invoice_date": "2026-01-01",
            "payment_type": "CREDIT",
            "subtotal": 100.0,
            "discount_amount": 5.0,
            "tax_amount": 7.0,
            "total_amount": 102.0,
            "paid_amount": 0.0,
            "status": "CONFIRMED",
            "notes": None,
            "created_by": 1,
            "created_at": "2026-01-01",
            "updated_at": None,
        }
        inv = SalesInvoice.from_row(row)
        assert inv.payment_type == "CREDIT"
        assert inv.total_amount == 102.0
        assert inv.items == []

    def test_to_dict_includes_bank_account_only_when_set(self):
        inv = SalesInvoice(invoice_number="SI-1", customer_id=1, invoice_date="2026-01-01")
        assert "bank_account_id" not in inv.to_dict()
        inv.bank_account_id = 3
        assert inv.to_dict()["bank_account_id"] == 3

    def test_sales_invoice_item_roundtrip(self):
        row = {
            "id": 1,
            "invoice_id": 5,
            "item_id": 9,
            "batch_id": 4,
            "quantity": 2.0,
            "unit_price": 10.0,
            "discount_amount": 0.0,
            "tax_amount": 1.0,
            "line_total": 21.0,
        }
        li = SalesInvoiceItem.from_row(row)
        assert li.quantity == 2.0
        d = li.to_dict()
        assert d["line_total"] == 21.0
