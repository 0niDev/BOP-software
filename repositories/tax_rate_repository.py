"""Data access for Tax Rates."""
from __future__ import annotations

from repositories.base_repository import BaseRepository
from utils.exceptions import DuplicateRecordError


class TaxRateRepository(BaseRepository):
    table_name = "tax_rates"

    def find_by_name(self, name: str, company_id: int = 1) -> dict | None:
        """Finds tax rate by name"""
        return self.db.fetch_one(
            """
            SELECT * FROM tax_rates 
            WHERE name = ? AND company_id = ?
            """,
            (name, company_id),
        )

    def find_all_for_company(
        self, 
        company_id: int = 1, 
        active_only: bool = True
    ) -> list[dict]:
        """Gets tax rates with optional active filter"""
        sql = "SELECT * FROM tax_rates WHERE company_id = ?"
        params: list = [company_id]
        
        if active_only:
            sql += " AND is_active = 1"
            
        sql += " ORDER BY name"
        return self.db.fetch_all(sql, tuple(params))

    def insert_unique(self, data: dict) -> int:
        """Prevents duplicate tax rate names"""
        if self.find_by_name(
            data["name"], 
            data.get("company_id", 1)
        ):
            raise DuplicateRecordError(
                f"Tax rate name '{data['name']}' already exists for this company."
            )
        return self.insert(data)
