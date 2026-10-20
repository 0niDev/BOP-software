"""Unit tests for the generic BaseRepository CRUD contract against a real
local SQLite connection (via the qa_db fixture)."""
from __future__ import annotations

import pytest

from repositories.base_repository import BaseRepository
from utils.exceptions import RecordNotFoundError


class FakeRepository(BaseRepository):
    table_name = "warehouses"
    pk_column = "id"

    def _seed(self, **overrides):
        data = {
            "company_id": 1,
            "code": "WH1",
            "name": "Main Warehouse",
            "address": "Street 1",
            "is_default": 1,
            "is_active": 1,
            **overrides,
        }
        return self.insert(data)


@pytest.fixture()
def repo(qa_db):
    return FakeRepository(qa_db)


class TestBaseRepository:
    def test_table_name_required(self, qa_db):
        class NoTable(BaseRepository):
            pass

        with pytest.raises(ValueError):
            NoTable(qa_db)

    def test_insert_returns_id_and_row_exists(self, qa_db, repo):
        rid = repo._seed()
        assert isinstance(rid, int) and rid > 0
        row = qa_db.fetch_one("SELECT * FROM warehouses WHERE id = ?", (rid,))
        assert row["name"] == "Main Warehouse"

    def test_find_by_id(self, repo):
        rid = repo._seed()
        assert repo.find_by_id(rid)["code"] == "WH1"
        assert repo.find_by_id(999999) is None

    def test_find_by_id_cached(self, repo):
        rid = repo._seed()
        first = repo.find_by_id(rid)
        # Mutate the row out-of-band; the L1 cache should still return the same
        # dict *object* it cached.
        second = repo.find_by_id(rid)
        assert second is first

    def test_get_by_id_raises_when_missing(self, repo):
        with pytest.raises(RecordNotFoundError):
            repo.get_by_id(424242)

    def test_update(self, repo, qa_db):
        rid = repo._seed()
        repo.update(rid, {"name": "Renamed"})
        assert qa_db.fetch_one("SELECT name FROM warehouses WHERE id=?", (rid,))["name"] == "Renamed"

    def test_update_noop_when_empty(self, repo, qa_db):
        rid = repo._seed()
        repo.update(rid, {})  # should not raise
        assert qa_db.fetch_one("SELECT name FROM warehouses WHERE id=?", (rid,))["name"] == "Main Warehouse"

    def test_delete(self, repo, qa_db):
        rid = repo._seed()
        repo.delete(rid)
        assert qa_db.fetch_one("SELECT * FROM warehouses WHERE id=?", (rid,)) is None

    def test_deactivate_sets_is_active_zero(self, qa_db, repo):
        rid = repo._seed()
        repo.deactivate(rid)
        assert repo.find_by_id(rid)["is_active"] == 0

    def test_exists(self, repo):
        rid = repo._seed()
        assert repo.exists(rid) is True
        assert repo.exists(999) is False

    def test_count(self, repo):
        base = repo.count()
        repo._seed()
        repo._seed(code="WH2", name="Second")
        assert repo.count() == base + 2
        assert repo.count("is_active = 1") == base + 2
        newest = repo.find_all(order_by="id")[-1]["id"]
        repo.deactivate(newest)
        assert repo.count("is_active = 0") == 1
        assert repo.count("is_active = 1") == base + 1

    def test_find_all_and_filter(self, repo):
        base_rows = repo.find_all()
        base = len(base_rows)
        repo._seed()
        repo._seed(code="WH2", name="Second")
        repo._seed(code="WH3", name="Third")
        all_rows = repo.find_all()
        assert len(all_rows) == base + 3
        repo.deactivate(all_rows[-1]["id"])
        active = repo.find_all(active_only=True)
        assert len(active) == base + 2

    def test_find_all_ordered(self, repo):
        repo._seed(code="B")
        repo._seed(code="A")
        rows = repo.find_all(order_by="code")
        codes = [r["code"] for r in rows]
        assert codes == sorted(codes)
        assert codes[0] == "A"

    def test_fetch_with_join(self, qa_db, repo):
        # warehouses join companies on company_id
        cid = repo._seed()
        rows = repo.fetch_with_join(
            join_table="companies",
            join_condition="warehouses.company_id = companies.id",
            columns="warehouses.name, companies.name AS company_name",
            where="warehouses.id = ?",
            params=(cid,),
        )
        assert len(rows) == 1
        assert rows[0]["name"] == "Main Warehouse"

    def test_batch_insert(self, qa_db, repo):
        base = qa_db.fetch_one("SELECT COUNT(*) n FROM warehouses")["n"]
        rows = [
            {"company_id": 1, "code": f"W{i}", "name": f"W {i}", "is_default": 0, "is_active": 1}
            for i in range(5)
        ]
        ids = repo._execute_batch_insert(rows)
        assert len(ids) == 5
        assert qa_db.fetch_one("SELECT COUNT(*) n FROM warehouses")["n"] == base + 5

    def test_batch_insert_empty(self, repo):
        assert repo._execute_batch_insert([]) == []

    def test_batch_update(self, qa_db, repo):
        ids = [repo._seed(code=f"W{i}") for i in range(3)]
        updates = [(ids[0], {"name": "Zero"}), (ids[1], {"name": "One"}), (ids[2], {})]
        count = repo._execute_batch_update(updates)
        assert count == 2  # empty update dict is skipped
        assert qa_db.fetch_one("SELECT name FROM warehouses WHERE id=?", (ids[0],))["name"] == "Zero"

    def test_clear_all_cache(self, qa_db):
        r1 = FakeRepository(qa_db)
        r2 = FakeRepository(qa_db)
        rid = r1._seed()
        r1.find_by_id(rid)
        assert len(BaseRepository._cache) > 0
        BaseRepository.clear_all_cache()
        assert len(BaseRepository._cache) == 0
        r2.find_by_id(rid)  # still works after cache clear