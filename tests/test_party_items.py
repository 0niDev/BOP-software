"""T5.x Party Management + T6.x Inventory/Items (headless; controller functions)."""
from __future__ import annotations

import pytest

from helpers import books, monitor
from models.enums import PartyType


@pytest.fixture()
def parties():
    from controllers.party_controller import PartyController
    return PartyController()


@pytest.fixture()
def items():
    from controllers.item_controller import ItemController
    return ItemController()


def _id(db, table, name):
    return db.fetch_one(f"SELECT id FROM {table} WHERE name=?", (name,))["id"]


def test_create_customer_auto_code(qa_db, parties):
    ok, err = parties.create_party("Acme Pharma", PartyType.CUSTOMER, 100000.0)
    assert ok, err
    row = qa_db.fetch_one("SELECT code, party_type, credit_limit FROM parties WHERE name='Acme Pharma'")
    assert row["code"].startswith("CUST-")
    assert row["party_type"] == "CUSTOMER"
    assert row["credit_limit"] == pytest.approx(100000.0)
    list_parties, lerr = parties.list_parties()
    assert lerr is None and any(p.name == "Acme Pharma" for p in list_parties)


def test_create_supplier_and_both(qa_db, parties):
    ok, err = parties.create_party("Vendor World", PartyType.SUPPLIER, 50000.0)
    assert ok, err
    ok, err = parties.create_party("Middle Man", PartyType.BOTH, 0.0)
    assert ok, err
    rows = qa_db.fetch_all("SELECT code, party_type FROM parties WHERE name IN ('Vendor World','Middle Man') ORDER BY name")
    assert {r["party_type"] for r in rows} == {"SUPPLIER", "BOTH"}
    assert all(r["code"].startswith("SUPP-") for r in rows)


def test_party_validation(qa_db, parties):
    ok, err = parties.create_party("", PartyType.CUSTOMER, 0.0)
    assert not ok and "required" in err
    ok, err = parties.create_party("Neg Party", PartyType.CUSTOMER, -5)
    assert not ok and "negative" in err
    # duplicate manual code
    ok, err = parties.create_party("Other", PartyType.CUSTOMER, 0, code="CUST-999")
    assert ok, err
    ok, err = parties.create_party("Another", PartyType.CUSTOMER, 0, code="CUST-999")
    assert not ok and "already exists" in err


def test_update_and_deactivate_party(qa_db, parties):
    ok, _ = parties.create_party("Updatable Ltd", PartyType.SUPPLIER, 100.0)
    pid = _id(qa_db, "parties", "Updatable Ltd")
    ok, err = parties.update_party(pid, "Updatable Renamed", 250.0, None, True)
    assert ok, err
    ok, err = parties.deactivate_party(pid)
    assert ok, err
    assert qa_db.fetch_one("SELECT is_active FROM parties WHERE id=?", (pid,))["is_active"] == 0


def test_list_filters_parties(qa_db, parties):
    parties.create_party("Filter Cust", PartyType.CUSTOMER, 0)
    parties.create_party("Filter Sup", PartyType.SUPPLIER, 0)
    act, _ = parties.list_parties()
    assert any(p.name == "Filter Cust" for p in act)
    books.assert_books_balanced(qa_db)


def test_create_item_validation_and_auto_code(qa_db, items):
    ok, err = items.create_item("Syrup Bottle", None, "ML", 30, 60, 5, 50, None, "FINISHED_GOOD", None)
    assert ok, err
    ok, err = items.create_item("", None, "ML", 0, 0, 0, 0, None, "FINISHED_GOOD", None)
    assert not ok
    ok, err = items.create_item("Bad Unit", None, "BUCKET", 0, 0, 0, 0, None, "FINISHED_GOOD", None)
    assert not ok and "Invalid unit" in err
    ok, err = items.create_item("Neg Price", None, "ML", -1, 0, 0, 0, None, "FINISHED_GOOD", None)
    assert not ok and "negative" in err
    row = qa_db.fetch_one("SELECT item_code FROM items WHERE item_name='Syrup Bottle'")
    assert row["item_code"].startswith("ITEM-")


def test_add_opening_stock_posts_journal(qa_db, items):
    from helpers import seed

    ok, err = items.create_item("Powder X", None, "KG", 40, 80, 0, 0, None, "RAW_MATERIAL", None)
    assert ok
    item = seed.find_item(qa_db, "Powder X")
    sup = seed.supplier("Stock Supplier")
    ok, err = items.add_opening_stock(item["id"], 100, unit_cost=40.0, party_id=sup.id)
    assert ok, err
    batch = qa_db.fetch_one("SELECT quantity_in_stock, purchase_price FROM stock_batches WHERE item_id=?", (item["id"],))
    assert batch["quantity_in_stock"] == pytest.approx(100.0)
    assert batch["purchase_price"] == pytest.approx(40.0)
    assert books.ledger_balance(qa_db, "1200") == pytest.approx(4000.0)
    books.assert_books_balanced(qa_db)
    monitor.monitor_reports(qa_db, parties=[sup.id])


def test_add_opening_stock_negative_quantity_rejected(qa_db, items):
    from helpers import seed

    items.create_item("Powder Y", None, "KG", 40, 80, 0, 0, None, "RAW_MATERIAL", None)
    item = seed.find_item(qa_db, "Powder Y")
    ok, err = items.add_opening_stock(item["id"], -5, unit_cost=40.0)
    assert not ok and "greater than 0" in err


def test_update_and_deactivate_item(qa_db, items):
    from helpers import seed

    items.create_item("Editable Item", None, "UNIT", 10, 20, 0, 0, None, "FINISHED_GOOD", None)
    row = seed.find_item(qa_db, "Editable Item")
    ok, err = items.update_item(row["id"], "Editable Item 2", None, "UNIT", 15, 25, 0, 100, None, "FINISHED_GOOD", None, True)
    assert ok, err
    ok, err = items.deactivate_item(row["id"])
    assert ok, err
    assert qa_db.fetch_one("SELECT is_active FROM items WHERE id=?", (row["id"],))["is_active"] == 0
