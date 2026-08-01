"""Data access for Production Orders."""
from __future__ import annotations

from datetime import datetime
from repositories.base_repository import BaseRepository
from utils.exceptions import DuplicateRecordError


class ProductionOrderRepository(BaseRepository):
    """Repository for production_orders table."""
    table_name = "production_orders"

    def find_by_number(self, order_number: str, company_id: int = 1) -> dict | None:
        """Find production order by number."""
        return self.db.fetch_one(
            """
            SELECT * FROM production_orders 
            WHERE order_number = ? AND company_id = ?
            """,
            (order_number, company_id),
        )

    def number_exists(self, order_number: str, company_id: int = 1, exclude_id: int | None = None) -> bool:
        """Check if order number exists."""
        sql = "SELECT id FROM production_orders WHERE order_number = ? AND company_id = ?"
        params = (order_number, company_id)
        if exclude_id is not None:
            sql += " AND id != ?"
            params += (exclude_id,)
        return self.db.fetch_one(sql, params) is not None

    def find_all_for_company(
        self, 
        company_id: int = 1, 
        status: str | None = None
    ) -> list[dict]:
        """Get all production orders with optional status filter."""
        sql = "SELECT * FROM production_orders WHERE company_id = ?"
        params = [company_id]
        if status:
            sql += " AND status = ?"
            params.append(status)
        sql += " ORDER BY manufacturing_date DESC"
        return self.db.fetch_all(sql, tuple(params))

    def insert_unique(self, data: dict) -> int:
        """Prevent duplicate order numbers."""
        if self.number_exists(data["order_number"], data.get("company_id", 1)):
            raise DuplicateRecordError(
                f"Production order '{data['order_number']}' already exists."
            )
        return self.insert(data)

    def update_status(self, order_id: int, status: str) -> None:
        """Update only the status field."""
        self.update(order_id, {"status": status})

    def update_with_timestamp(self, order_id: int, data: dict) -> None:
        """Update with updated_at timestamp."""
        data["updated_at"] = datetime.now().isoformat()
        self.update(order_id, data)


class ProductionConsumptionRepository(BaseRepository):
    """Repository for production_consumption table."""
    table_name = "production_consumption"

    def find_by_production_order(self, production_order_id: int) -> list[dict]:
        """Find all consumption records for a production order."""
        return self.db.fetch_all(
            """
            SELECT pc.*, i.item_name, i.item_code, i.unit
            FROM production_consumption pc
            JOIN items i ON i.id = pc.component_item_id
            WHERE pc.production_order_id = ?
            """,
            (production_order_id,),
        )

    def delete_by_production_order(self, production_order_id: int) -> None:
        """Delete all consumption records for a production order."""
        self.db.execute(
            "DELETE FROM production_consumption WHERE production_order_id = ?",
            (production_order_id,)
        )