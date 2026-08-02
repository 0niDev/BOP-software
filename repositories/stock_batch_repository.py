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
    ) -> int:
        """Create a new stock batch."""
        data = {
            "item_id": item_id,
            "warehouse_id": warehouse_id,
            "batch_number": batch_number,
            "manufacturing_date": manufacturing_date,
            "expiry_date": expiry_date,
            "purchase_price": purchase_price,
            "quantity_in_stock": quantity_in_stock,
            "is_active": 1,
        }
        return self.insert(data)

    def update_quantity(self, batch_id: int, quantity_change: float) -> None:
        """Update batch quantity (positive or negative)."""
        self.db.execute(
            """
            UPDATE stock_batches 
            SET quantity_in_stock = quantity_in_stock + ? 
            WHERE id = ?
            """,
            (quantity_change, batch_id),
        )
        # Invalidate cache for all item/warehouse combinations
        self._invalidate_cache()

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