"""Repository tests against the live database (CRUD + cache behavior)."""
from __future__ import annotations

import pytest

from repositories.party_repository import PartyRepository
from repositories.item_repository import ItemRepository
from repositories.account_repository import AccountRepository
from utils.exceptions import DuplicateRecordError, RecordNotFoundError


class TestPartyRepository:
    def test_insert_and_find(self, db, unique_code, cleanup_registry):
        repo = PartyRepository(db)
        code = unique_code("PTR")
        pid = repo.insert({
            "company_id": 1,
            "code": code,
            "name": "Repo Test Customer",
            "party_type": "CUSTOMER",
            "credit_limit": 1000,
            "is_active": 1,
        })
        cleanup_registry["parties"].append(pid)
        row = repo.get_by_id(pid)
        assert row["code"] == code
        assert row["party_type"] == "CUSTOMER"

        found = repo.find_by_code(code, "CUSTOMER", 1)
        assert found is not None
        assert found["id"] == pid

    def test_code_exists(self, db, unique_code, cleanup_registry):
        repo = PartyRepository(db)
        code = unique_code("PTR")
        pid = repo.insert({
            "company_id": 1,
            "code": code,
            "name": "Dup Check",
            "party_type": "SUPPLIER",
            "is_active": 1,
        })
        cleanup_registry["parties"].append(pid)
        assert repo.code_exists(code, "SUPPLIER", 1) is True
        assert repo.code_exists(code, "CUSTOMER", 1) is False

    def test_insert_unique_rejects_duplicate(self, db, unique_code, cleanup_registry):
        repo = PartyRepository(db)
        code = unique_code("PTR")
        pid = repo.insert_unique({
            "company_id": 1,
            "code": code,
            "name": "First",
            "party_type": "CUSTOMER",
            "is_active": 1,
        })
        cleanup_registry["parties"].append(pid)
        with pytest.raises(DuplicateRecordError):
            repo.insert_unique({
                "company_id": 1,
                "code": code,
                "name": "Second",
                "party_type": "CUSTOMER",
                "is_active": 1,
            })

    def test_update_and_deactivate(self, db, unique_code, cleanup_registry):
        repo = PartyRepository(db)
        code = unique_code("PTR")
        pid = repo.insert({
            "company_id": 1,
            "code": code,
            "name": "Original",
            "party_type": "BOTH",
            "is_active": 1,
        })
        cleanup_registry["parties"].append(pid)
        repo.update(pid, {"name": "Renamed"})
        assert repo.get_by_id(pid)["name"] == "Renamed"
        repo.deactivate(pid)
        assert repo.get_by_id(pid)["is_active"] == 0

    def test_find_all_for_company(self, db):
        repo = PartyRepository(db)
        rows = repo.find_all_for_company(1, active_only=True)
        assert isinstance(rows, list)

    def test_get_missing_raises(self, db):
        repo = PartyRepository(db)
        with pytest.raises(RecordNotFoundError):
            repo.get_by_id(999_999_999)


class TestItemRepository:
    def test_insert_and_find(self, db, unique_code, cleanup_registry):
        repo = ItemRepository(db)
        code = unique_code("ITR")
        iid = repo.insert({
            "company_id": 1,
            "item_code": code,
            "item_name": "Repo Test Item",
            "unit": "UNIT",
            "purchase_price": 10.0,
            "selling_price": 15.0,
            "minimum_stock": 0,
            "maximum_stock": 0,
            "is_active": 1,
        })
        cleanup_registry["items"].append(iid)
        row = repo.get_by_id(iid)
        assert row["item_code"] == code
        assert row["selling_price"] == 15.0

        found = repo.find_by_code(code, 1)
        assert found["id"] == iid

    def test_code_exists(self, db, unique_code, cleanup_registry):
        repo = ItemRepository(db)
        code = unique_code("ITR")
        iid = repo.insert({
            "company_id": 1,
            "item_code": code,
            "item_name": "Exists Check",
            "unit": "UNIT",
            "is_active": 1,
        })
        cleanup_registry["items"].append(iid)
        assert repo.code_exists(code, 1) is True
        assert repo.code_exists(code + "ZZ", 1) is False

    def test_find_all(self, db):
        repo = ItemRepository(db)
        rows = repo.find_all(active_only=True)
        assert isinstance(rows, list)


class TestAccountRepository:
    def test_system_accounts_exist(self, db):
        repo = AccountRepository(db)
        # The migrator seeds these system accounts
        for code in ("1000", "1100", "2000", "4000"):
            acc = repo.find_by_code(code, 1)
            assert acc is not None, f"system account {code} missing"
            assert acc["is_system_account"] == 1

    def test_balance_lookup(self, db):
        repo = AccountRepository(db)
        acc = repo.find_by_code("1000", 1)
        assert acc is not None
        assert "id" in acc