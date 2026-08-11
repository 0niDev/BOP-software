"""Data access for Stock Batches."""
from __future__ import annotations

from repositories.base_repository import BaseRepository


class StockBatchRepository(BaseRepository):
    """Repository for stock_batches table."""
    table_name = "stock_batches"

    def find_by_item_and_warehouse(self, item_id: int, warehouse_id: int) -> dict | None:
        """Find a batch for an item in a warehouse (FIFO - returns the one with stock)."""
        cache_key = self._get_cache_key("find_by_item_and_warehouse", item_id, warehouse_id)
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached
        
        # First try to get a batch with stock
        batch = self.db.fetch_one(
            """
            SELECT * FROM stock_batches 
            WHERE item_id = ? AND warehouse_id = ? AND is_active = 1 AND quantity_in_stock > 0
            ORDER BY manufacturing_date, created_at
            LIMIT 1
            """,
            (item_id, warehouse_id),
        )
        
        # If no batch with stock, get any active batch
        if not batch:
            batch = self.db.fetch_one(
                """
                SELECT * FROM stock_batches 
                WHERE item_id = ? AND warehouse_id = ? AND is_active = 1
                ORDER BY manufacturing_date, created_at
                LIMIT 1
                """,
                (item_id, warehouse_id),
            )
        
        if batch:
            self._set_cached(cache_key, batch)
        return batch


    def find_all_for_item(self, item_id: int, warehouse_id: int | None = None) -> list[dict]:
        """Find all batches for an item."""
        sql = "SELECT * FROM stock_batches WHERE item_id = ? AND is_active = 1"
        params = [item_id]
        if warehouse_id:
            sql += " AND warehouse_id = ?"
            params.append(warehouse_id)
        sql += " ORDER BY manufacturing_date, created_at"
        return self.db.fetch_all(sql, tuple(params))

    def create_batch(
        self,
        item_id: int,
        warehouse_id: int,
        batch_number: str,
        manufacturing_date: str,
        expiry_date: str | None,
        purchase_price: float,
        quantity_in_stock: float,
        raw_unit_cost: float = 0.0,
        packing_unit_cost: float = 0.0,
    ) -> int:
        """Create a new stock batch."""
        data = {
            "item_id": item_id,
            "warehouse_id": warehouse_id,
            "batch_number": batch_number,
            "manufacturing_date": manufacturing_date,
            "expiry_date": expiry_date,
            "purchase_price": purchase_price,
            "raw_unit_cost": raw_unit_cost,
            "packing_unit_cost": packing_unit_cost,
            "quantity_in_stock": quantity_in_stock,
            "is_active": 1,
        }
        return self.insert(data)

    def add_to_batch(
        self,
        batch_id: int,
        quantity: float,
        unit_cost: float,
        raw_unit_cost: float = 0.0,
        packing_unit_cost: float = 0.0,
    ) -> None:
        """Add quantity to an existing batch, recomputing weighted-average unit costs."""
        batch = self.get_by_id(batch_id)
        old_qty = batch.get("quantity_in_stock", 0)
        new_qty = old_qty + quantity
        if new_qty <= 0:
            self.update_quantity(batch_id, quantity, use_cache=False)
            return

        new_purchase = (old_qty * batch.get("purchase_price", 0) + quantity * unit_cost) / new_qty
        new_raw = (old_qty * batch.get("raw_unit_cost", 0) + quantity * raw_unit_cost) / new_qty
        new_packing = (old_qty * batch.get("packing_unit_cost", 0) + quantity * packing_unit_cost) / new_qty

        self.db.execute(
            """
            UPDATE stock_batches
            SET quantity_in_stock = quantity_in_stock + ?,
                purchase_price = ?,
                raw_unit_cost = ?,
                packing_unit_cost = ?
            WHERE id = ?
            """,
            (quantity, round(new_purchase, 6), round(new_raw, 6), round(new_packing, 6), batch_id),
        )
        self._invalidate_cache(pattern=f"stock_batches:find_by_item_and_warehouse")

    def update_quantity(self, batch_id: int, quantity_change: float, use_cache: bool = True) -> None:
        """Update batch quantity (positive or negative)."""
        self.db.execute(
            """
            UPDATE stock_batches 
            SET quantity_in_stock = quantity_in_stock + ? 
            WHERE id = ?
            """,
            (quantity_change, batch_id),
        )
        # Only invalidate cache if explicitly requested (to avoid redundant cache clearing in batch operations)
        if use_cache:
            # Invalidate only the specific batch cache, not all cache
            self._invalidate_cache(pattern=f"stock_batches:find_by_item_and_warehouse")

    def get_expiring_batches(self, days_threshold: int = 30) -> list[dict]:
        """Get batches expiring within the threshold."""
        return self.db.fetch_all(
            """
            SELECT sb.*, i.item_name, i.item_code
            FROM stock_batches sb
            JOIN items i ON i.id = sb.item_id
            WHERE sb.is_active = 1 
            AND sb.expiry_date IS NOT NULL
            AND date(sb.expiry_date) <= date('now', '+' || ? || ' days')
            ORDER BY sb.expiry_date
            """,
            (days_threshold,),
        )