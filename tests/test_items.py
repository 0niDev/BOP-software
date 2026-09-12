"""Business-rule tests for ItemService (creation, validation, stock) and the
ItemController, against a fresh local DB."""
from __future__ import annotations

import pytest

from services.item_service import ItemService
from utils.exceptions import ValidationError, DuplicateRecordError


@pytest.fixture()
def svc(qa_db):
    return ItemService(qa_db)


class TestItemService:
    def test_create_item_autogenerates_code(self, svc):
        item = svc.create_item(item_name="Aspirin 500mg")
        assert item.id is not None
        assert item.item_code  # auto-generated
        reassigned = ItemService(svc.db).get_item(item.id)
        assert reassigned.item_name == "Aspirin 500mg"

    def test_create_item_manual_code(self, svc):
        item = svc.create_item(item_name="Paracetamol", item_code="P-001")
        assert item.item_code == "P-001"

    def test_create_item_blank_name_raises(self, svc):
        with pytest.raises(ValidationError):
            svc.create_item(item_name="   ")

    def test_create_item_negative_prices_raise(self, svc):
        with pytest.raises(ValidationError):
            svc.create_item(item_name="X", purchase_price=-1)
        with pytest.raises(ValidationError):
            svc.create_item(item_name="X", selling_price=-5)

    def test_create_item_negative_stock_raises(self, svc):
        with pytest.raises(ValidationError):
            svc.create_item(item_name="X", minimum_stock=-1)
        with pytest.raises(ValidationError):
            svc.create_item(item_name="X", maximum_stock=-1)

    def test_create_item_max_less_than_min_raises(self, svc):
        with pytest.raises(ValidationError):
            svc.create_item(item_name="X", minimum_stock=10, maximum_stock=2)

    def test_create_item_invalid_unit_raises(self, svc):
        with pytest.raises(ValidationError):
            svc.create_item(item_name="X", unit="LITRES")

    def test_create_item_invalid_type_raises(self, svc):
        with pytest.raises(ValidationError):
            svc.create_item(item_name="X", item_type="RAW_WRONG")

    def test_create_item_duplicate_manual_code_raises(self, svc):
        svc.create_item(item_name="First", item_code="DUP-1")
        with pytest.raises(ValidationError):
            svc.create_item(item_name="Second", item_code="DUP-1")

    def test_create_item_empty_manual_code_raises(self, svc):
        with pytest.raises(ValidationError):
            svc.create_item(item_name="X", item_code="   ")

    def test_create_item_many(self, svc):
        for i in range(10):
            svc.create_item(item_name=f"Item {i}")
        items = svc.list_items()
        assert len(items) == 10

    def test_update_item(self, svc):
        item = svc.create_item(item_name="Before", unit="TABLET")
        svc.update_item(
            item.id, item_name="After", notes=None, unit="CAPSULE",
            purchase_price=5, selling_price=10,
            minimum_stock=1, maximum_stock=50,
            tax_rate_id=None, item_type="FINISHED_GOOD", category_id=None,
        )
        updated = svc.get_item(item.id)
        assert updated.item_name == "After"
        assert updated.unit == "CAPSULE"

    def test_update_item_blank_name_raises(self, svc):
        item = svc.create_item(item_name="X")
        with pytest.raises(ValidationError):
            svc.update_item(item.id, item_name=" ", notes=None, unit="UNIT",
                            purchase_price=0, selling_price=0,
                            minimum_stock=0, maximum_stock=0,
                            tax_rate_id=None, item_type="FINISHED_GOOD", category_id=None)

    def test_deactivate_item(self, svc):
        item = svc.create_item(item_name="Temp")
        svc.deactivate_item(item.id)
        assert svc.get_item(item.id).is_active is False
        assert len(svc.list_items(active_only=True)) == 0
        assert len(svc.list_items(active_only=False)) == 1

    def test_get_missing_item_raises(self, svc):
        from utils.exceptions import RecordNotFoundError
        with pytest.raises(RecordNotFoundError):
            svc.get_item(999999)


class TestItemOpeningStock:
    def test_add_opening_stock_creates_batch(self, qa_db, svc):
        item = svc.create_item(item_name="Stocked", item_type="RAW_MATERIAL")
        svc.add_opening_stock(item.id, quantity=500, unit_cost=10.0, batch_number="B1")
        batch = qa_db.fetch_one("SELECT * FROM stock_batches WHERE item_id=?", (item.id,))
        assert batch is not None and batch["quantity_in_stock"] == 500
        movement = qa_db.fetch_one(
            "SELECT * FROM stock_movements WHERE item_id=? AND movement_type='OPENING'", (item.id,)
        )
        assert movement is not None

    def test_add_opening_stock_quantity_must_be_positive(self, svc):
        item = svc.create_item(item_name="S")
        with pytest.raises(ValidationError):
            svc.add_opening_stock(item.id, quantity=0)
        with pytest.raises(ValidationError):
            svc.add_opening_stock(item.id, quantity=-5)

    def test_add_opening_stock_negative_cost_raises(self, svc):
        item = svc.create_item(item_name="S2")
        with pytest.raises(ValidationError):
            svc.add_opening_stock(item.id, quantity=5, unit_cost=-1)

    def test_duplicate_batch_number_raises(self, svc):
        item = svc.create_item(item_name="DupBatch")
        svc.add_opening_stock(item.id, quantity=1, batch_number="BATCH-X")
        with pytest.raises(DuplicateRecordError):
            svc.add_opening_stock(item.id, quantity=1, batch_number="BATCH-X")

    def test_opening_stock_posts_journal_when_party_given(self, qa_db):
        from helpers import seed as s
        from helpers import books
        sup = s.supplier(qa_db, "Inv Supplier")
        item = s.make_item(qa_db, "Inv Item", item_type="RAW_MATERIAL")
        s.add_stock(qa_db, item.id, quantity=100, unit_cost=20.0,
                    batch_number="INV-1", supplier_id=sup.id)
        # inventory (1200) debited, AP (2000) credited
        assert abs(books.ledger_balance(qa_db, "1200") - 2000.0) < 0.01
        assert abs(books.ap_balance(qa_db) - 2000.0) < 0.01
        books.assert_books_balanced(qa_db)


class TestItemController:
    def test_create_list_get(self, qa_db):
        from controllers.item_controller import ItemController
        ctrl = ItemController()
        ok, err = ctrl.create_item(
            item_name="CtrlItem", notes=None, unit="UNIT",
            purchase_price=1, selling_price=2, minimum_stock=0,
            maximum_stock=10, tax_rate_id=None,
            item_type="FINISHED_GOOD", category_id=None,
        )
        assert ok is True and err is None
        items, err2 = ctrl.list_items()
        assert err2 is None
        item = next(i for i in items if i.item_name == "CtrlItem")
        found, err3 = ctrl.get_item(item.id)
        assert found.item_name == "CtrlItem"

    def test_create_invalid(self, qa_db):
        from controllers.item_controller import ItemController
        ctrl = ItemController()
        ok, err = ctrl.create_item(
            item_name="", notes=None, unit="UNIT",
            purchase_price=1, selling_price=2, minimum_stock=0,
            maximum_stock=10, tax_rate_id=None,
            item_type="FINISHED_GOOD", category_id=None,
        )
        assert ok is False and err is not None

    def test_get_missing_returns_error(self, qa_db):
        from controllers.item_controller import ItemController
        ctrl = ItemController()
        item, err = ctrl.get_item(999999)
        assert item is None and err is not None

    def test_add_opening_stock_controller(self, qa_db):
        from controllers.item_controller import ItemController
        from helpers import seed as s
        it = s.make_item(qa_db, "Ctrl Stock", item_type="RAW_MATERIAL")
        ctrl = ItemController()
        ok, err = ctrl.add_opening_stock(it.id, quantity=10, unit_cost=5.0, batch_number="C-1")
        assert ok is True and err is None