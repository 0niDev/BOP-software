"""Data access for Items."""
from __future__ import annotations

from repositories.base_repository import BaseRepository
from utils.exceptions import DuplicateRecordError


class ItemRepository(BaseRepository):
    table_name = "items"

    def find_by_code(self, item_code: str, company_id: int = 1) -> dict | None:
        """Finds item by item_code"""
        cache_key = self._get_cache_key("find_by_code", item_code, company_id)
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached
        
        result = self.db.fetch_one(
            """
            SELECT * FROM items 
            WHERE item_code = ? AND company_id = ?
            """,
            (item_code, company_id),
        )
        if result:
            self._set_cached(cache_key, result)
        return result

    def code_exists(self, item_code: str, company_id: int = 1, exclude_id: int | None = None) -> bool:
        """Checks if item code exists"""
        sql = "SELECT id FROM items WHERE item_code = ? AND company_id = ?"
        params: tuple = (item_code, company_id)
        if exclude_id is not None:
            sql += " AND id != ?"
            params += (exclude_id,)
        return self.db.fetch_one(sql, params) is not None

    def find_all_for_company(
        self, 
        company_id: int = 1, 
        active_only: bool = True
    ) -> list[dict]:
        """Gets items with optional active filter"""
        sql = "SELECT * FROM items WHERE company_id = ?"
        params: list = [company_id]
        
        if active_only:
            sql += " AND is_active = 1"
            
        sql += " ORDER BY item_code"
        return self.db.fetch_all(sql, tuple(params))

    def insert_unique(self, data: dict) -> int:
        """Prevents duplicate item codes"""
        if self.code_exists(
            data["item_code"], 
            data.get("company_id", 1)
        ):
            raise DuplicateRecordError(
                f"Item code '{data['item_code']}' already exists."
            )
        return self.insert(data)
