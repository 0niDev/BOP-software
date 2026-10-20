"""Tests for ManufacturingService: BOM creation/lifecycle and production
order lifecycle (create → start → complete) with automatic stock & journal
updates."""
from __future__ import annotations

import pytest

from services.manufacturing_service import ManufacturingService
from utils.exceptions import ValidationError
from helpers import seed as seed_helpers


@pytest.fixture()
def svc(qa_db):
    return ManufacturingService(qa_db)


def _setup_bom(qa_db):
    """Finished item F + raw component R; returns ids and names."""
    raw = seed_helpers.make_item(qa_db, "Raw Comp", item_type="RAW_MATERIAL", purchase_price=5.0)
    finish = seed_helpers.make_item(qa_db, "Made Good", item_type="FINISHED_GOOD", selling_price=100.0)
    seed_helpers.add_stock(qa_db, raw.id, quantity=1000, unit_cost=5.0, batch_number="RAW-1")
    return raw, finish


class TestBOM:
    def test_create_bom(self, qa_db, svc):
        raw, finish = _setup_bom(qa_db)
        bom = svc.create_bom(
            finished_item_id=finish.id, output_quantity=10,
            components=[{"component_item_id": raw.id, "quantity_required": 2}],
            bom_name="BOM-1",
        )
        assert bom.id is not None
        loaded = svc.get_bom(bom.id)
        assert loaded.bom_name == "BOM-1"
        assert len(loaded.components) == 1

    def test_create_bom_requires_components(self, qa_db, svc):
        _, finish = _setup_bom(qa_db)
        with pytest.raises(ValidationError):
            svc.create_bom(finished_item_id=finish.id, output_quantity=10, components=[])

    def test_create_bom_invalid_output_quantity(self, qa_db, svc):
        raw, finish = _setup_bom(qa_db)
        with pytest.raises(ValidationError):
            svc.create_bom(
                finished_item_id=finish.id, output_quantity=0,
                components=[{"component_item_id": raw.id, "quantity_required": 1}],
            )

    def test_create_bom_requires_component_quantity(self, qa_db, svc):
        raw, finish = _setup_bom(qa_db)
        with pytest.raises(ValidationError):
            svc.create_bom(
                finished_item_id=finish.id, output_quantity=10,
                components=[{"component_item_id": raw.id, "quantity_required": 0}],
            )

    def test_create_bom_missing_finished_item(self, qa_db, svc):
        raw, finish = _setup_bom(qa_db)
        # repo.get_by_id raises RecordNotFoundError for unknown ids
        from utils.exceptions import RecordNotFoundError
        with pytest.raises(RecordNotFoundError):
            svc.create_bom(
                finished_item_id=999999, output_quantity=10,
                components=[{"component_item_id": raw.id, "quantity_required": 1}],
            )

    def test_list_boms(self, qa_db, svc):
        raw, finish = _setup_bom(qa_db)
        svc.create_bom(finish.id, 10, [{"component_item_id": raw.id, "quantity_required": 1}], bom_name="B-1")
        boms = svc.list_boms()
        assert any(b.bom_name == "B-1" for b in boms)

    def test_update_bom(self, qa_db, svc):
        raw, finish = _setup_bom(qa_db)
        bom = svc.create_bom(finish.id, 10, [{"component_item_id": raw.id, "quantity_required": 1}], bom_name="B-U")
        svc.update_bom(bom.id, "B-U2", 20, [{"component_item_id": raw.id, "quantity_required": 2}], None, True)
        loaded = svc.get_bom(bom.id)
        assert loaded.bom_name == "B-U2" and loaded.output_quantity == 20


class TestProductionOrder:
    def _make_order(self, qa_db, svc):
        raw, finish = _setup_bom(qa_db)
        bom = svc.create_bom(finish.id, 10, [{"component_item_id": raw.id, "quantity_required": 2}], bom_name="B-PO")
        order = svc.create_production_order(
            order_number="PO-1", bom_id=bom.id, planned_quantity=5,
            manufacturing_date="2026-01-01", warehouse_id=1,
        )
        return order, bom, raw, finish

    def test_create_production_order(self, qa_db, svc):
        order, _, _, _ = self._make_order(qa_db, svc)
        assert order.id is not None
        assert order.status == "DRAFT"

    def test_start_order(self, qa_db, svc):
        order, _, _, _ = self._make_order(qa_db, svc)
        svc.start_production(order.id)
        assert svc.get_production_order(order.id).status == "IN_PROGRESS"

    def test_start_non_draft_raises(self, qa_db, svc):
        order, _, _, _ = self._make_order(qa_db, svc)
        svc.start_production(order.id)
        with pytest.raises(ValidationError):
            svc.start_production(order.id)

    def test_cancel_order(self, qa_db, svc):
        order, _, _, _ = self._make_order(qa_db, svc)
        svc.cancel_production_order(order.id)
        assert svc.get_production_order(order.id).status == "CANCELLED"

    def test_complete_requires_in_progress(self, qa_db, svc):
        order, _, _, _ = self._make_order(qa_db, svc)
        with pytest.raises(ValidationError):
            svc.complete_production(order.id, actual_quantity=5)

    def test_complete_production(self, qa_db, svc):
        order, _, raw, finish = self._make_order(qa_db, svc)
        raw_before = qa_db.fetch_one(
            "SELECT quantity_in_stock q FROM stock_batches WHERE item_id=?", (raw.id,)
        )["q"]
        svc.start_production(order.id)
        svc.complete_production(
            order.id,
            actual_quantity=5,
            wastage_quantity=0,
            output_batch_number="OUT-FIN-1",
        )
        assert svc.get_production_order(order.id).status == "COMPLETED"
        # raw consumed is scaled to BOM output: actual(5) * required(2) / output_qty(10) = 1
        raw_after = qa_db.fetch_one(
            "SELECT quantity_in_stock q FROM stock_batches WHERE item_id=?", (raw.id,)
        )["q"]
        assert raw_after == raw_before - 1
        # finished goods output batch created
        out = qa_db.fetch_one(
            "SELECT quantity_in_stock q FROM stock_batches WHERE item_id=? AND batch_number='OUT-FIN-1'",
            (finish.id,),
        )
        assert out is not None and out["q"] == 5
        from helpers import books
        books.assert_books_balanced(qa_db)