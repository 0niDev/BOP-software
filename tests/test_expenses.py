"""Tests for ExpenseService (categories + expenses) and ExpenseItemService
(per-category recurring items, create/list/update/delete, and bulk pay)."""
from __future__ import annotations

import pytest

from services.expense_service import ExpenseService
from services.expense_item_service import ExpenseItemService
from utils.exceptions import ValidationError


@pytest.fixture()
def svc(qa_db):
    return ExpenseService(qa_db)


@pytest.fixture()
def item_svc(qa_db):
    return ExpenseItemService(qa_db)


def _expense_category_id(qa_db, name="Utilities"):
    # 6000 is an EXPENSE-type system account.
    from repositories.account_repository import AccountRepository
    account = AccountRepository(qa_db).find_by_code("6000")
    return ExpenseService(qa_db).create_category(name=name, account_id=account["id"]).id


class TestExpenseService:
    def test_create_category(self, qa_db, svc):
        cat = svc.create_category(name="Rent")
        assert cat.id is not None
        assert cat.name == "Rent"
        assert cat.is_active is True

    def test_create_category_blank_raises(self, svc):
        with pytest.raises(ValidationError):
            svc.create_category(name="  ")

    def test_create_category_requires_expense_account(self, qa_db, svc):
        from repositories.account_repository import AccountRepository
        non_expense = AccountRepository(qa_db).find_by_code("1000")
        with pytest.raises(ValidationError):
            svc.create_category(name="X", account_id=non_expense["id"])

    def test_list_and_get_category(self, svc):
        svc.create_category(name="CatA")
        cats = svc.list_categories()
        assert any(c.name == "CatA" for c in cats)

    def test_update_category(self, svc):
        cat = svc.create_category(name="Old")
        svc.update_category(cat.id, name="New", account_id=None, is_active=True)
        assert svc.get_category(cat.id).name == "New"

    def test_delete_category_without_expenses(self, svc):
        cat = svc.create_category(name="Empty")
        svc.delete_category(cat.id)
        assert svc.get_category(cat.id).is_active is False

    def test_create_expense(self, qa_db, svc):
        cat_id = _expense_category_id(qa_db, "Exp Cat")
        exp = svc.create_expense(
            voucher_number="EV-001", category_id=cat_id, expense_date="2026-01-02",
            amount=100, payment_method="CASH",
        )
        assert exp.id is not None
        row = qa_db.fetch_one("SELECT * FROM journal_entries WHERE source_table='expenses' AND source_id=?", (exp.id,))
        assert row is not None and row["is_posted"] == 1

    def test_create_expense_invalid_amount(self, qa_db, svc):
        cat_id = _expense_category_id(qa_db)
        with pytest.raises(ValidationError):
            svc.create_expense("EV-X", cat_id, "2026-01-01", amount=0, payment_method="CASH")
        with pytest.raises(ValidationError):
            svc.create_expense("EV-X", cat_id, "2026-01-01", amount=-5, payment_method="CASH")

    def test_create_expense_invalid_method(self, qa_db, svc):
        cat_id = _expense_category_id(qa_db)
        with pytest.raises(ValidationError):
            svc.create_expense("EV-X", cat_id, "2026-01-01", amount=10, payment_method="CRYPTO")

    def test_list_expenses(self, qa_db, svc):
        cat_id = _expense_category_id(qa_db)
        svc.create_expense("EV-1", cat_id, "2026-01-01", 10, "CASH")
        svc.create_expense("EV-2", cat_id, "2026-01-02", 20, "CASH")
        expenses = svc.list_expenses(company_id=1)
        assert len(expenses) == 2

    def test_get_monthly_summary(self, qa_db, svc):
        cat_id = _expense_category_id(qa_db)
        svc.create_expense("EV-3", cat_id, "2026-01-15", 100, "CASH")
        summary = svc.get_monthly_summary(2026, 1)
        assert summary is not None


class TestExpenseItemService:
    def test_create_and_list_item(self, qa_db, item_svc):
        cat_id = _expense_category_id(qa_db, "ItemCat")
        item = item_svc.create_item(category_id=cat_id, name="Rent", amount=5000)
        assert item.id is not None
        items = item_svc.list_items(cat_id)
        assert any(i.name == "Rent" for i in items)

    def test_create_item_blank_name_raises(self, qa_db, item_svc):
        cat_id = _expense_category_id(qa_db)
        with pytest.raises(ValidationError):
            item_svc.create_item(category_id=cat_id, name="  ")

    def test_create_item_negative_amount_raises(self, qa_db, item_svc):
        cat_id = _expense_category_id(qa_db)
        with pytest.raises(ValidationError):
            item_svc.create_item(category_id=cat_id, name="X", amount=-1)

    def test_update_item(self, qa_db, item_svc):
        cat_id = _expense_category_id(qa_db)
        item = item_svc.create_item(category_id=cat_id, name="A", amount=10)
        item_svc.update_item(item.id, name="B", amount=20)
        items = item_svc.list_items(cat_id)
        updated = next(i for i in items if i.id == item.id)
        assert updated.name == "B" and updated.amount == 20

    def test_delete_item_deactivates(self, qa_db, item_svc):
        cat_id = _expense_category_id(qa_db)
        item = item_svc.create_item(category_id=cat_id, name="Temp", amount=5)
        item_svc.delete_item(item.id)
        active = item_svc.list_items(cat_id)
        assert all(i.id != item.id for i in active)

    def test_pay_items_creates_expenses_and_journal(self, qa_db, item_svc):
        cat_id = _expense_category_id(qa_db, "PayCat")
        item1 = item_svc.create_item(category_id=cat_id, name="One", amount=100)
        item2 = item_svc.create_item(category_id=cat_id, name="Two", amount=200)
        vouchers = item_svc.pay_items(
            company_id=1, category_id=cat_id,
            selections=[{"item_id": item1.id, "amount": 100}, {"item_id": item2.id, "amount": 200}],
            payment_method="CASH", expense_date="2026-01-10",
        )
        assert len(vouchers) == 2
        expenses = qa_db.fetch_all("SELECT * FROM expenses")
        assert len(expenses) == 2
        from helpers import books
        # two expense vouchers, each balanced
        assert books.count(qa_db, "journal_entries", "WHERE is_posted=1") >= 2
        books.assert_books_balanced(qa_db)

    def test_pay_items_requires_selection(self, qa_db, item_svc):
        cat_id = _expense_category_id(qa_db)
        with pytest.raises(ValidationError):
            item_svc.pay_items(
                company_id=1, category_id=cat_id, selections=[],
                payment_method="CASH", expense_date="2026-01-10",
            )

    def test_pay_items_invalid_method(self, qa_db, item_svc):
        cat_id = _expense_category_id(qa_db)
        item = item_svc.create_item(category_id=cat_id, name="X", amount=10)
        with pytest.raises(ValidationError):
            item_svc.pay_items(
                company_id=1, category_id=cat_id,
                selections=[{"item_id": item.id, "amount": 10}],
                payment_method="QWERTY", expense_date="2026-01-10",
            )