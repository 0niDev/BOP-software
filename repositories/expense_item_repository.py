"""Data access for recurring expense items (Pay Items feature)."""
from __future__ import annotations

from repositories.base_repository import BaseRepository
from utils.exceptions import DuplicateRecordError


class ExpenseItemRepository(BaseRepository):
    table_name = "expense_items"

    def find_all_for_company(
        self,
        company_id: int = 1,
        category_id: int | None = None,
        active_only: bool = True,
    ) -> list[dict]:
        sql = "SELECT * FROM expense_items WHERE company_id = ?"
        params: list = [company_id]
        if category_id is not None:
            sql += " AND category_id = ?"
            params.append(category_id)
        if active_only:
            sql += " AND is_active = 1"
        sql += " ORDER BY name"
        return self.db.fetch_all(sql, tuple(params))

    def find_by_name(self, category_id: int, name: str, company_id: int = 1) -> dict | None:
        return self.db.fetch_one(
            "SELECT * FROM expense_items WHERE company_id = ? AND category_id = ? AND name = ?",
            (company_id, category_id, name),
        )

    def insert_unique(self, data: dict) -> int:
        if self.find_by_name(data["category_id"], data["name"], data.get("company_id", 1)):
            raise DuplicateRecordError(
                f"Item '{data['name']}' already exists in this category."
            )
        return self.insert(data)
