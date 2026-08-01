# repositories/party_repository.py
"""Data access for Parties."""
from __future__ import annotations

from repositories.base_repository import BaseRepository
from utils.exceptions import DuplicateRecordError


class PartyRepository(BaseRepository):
    table_name = "parties"

    def find_by_code(self, code: str, party_type: str, company_id: int = 1) -> dict | None:
        """Finds party by code and type"""
        return self.db.fetch_one(
            """
            SELECT * FROM parties 
            WHERE code = ? AND party_type = ? AND company_id = ?
            """,
            (code, party_type, company_id),
        )

    def code_exists(self, code: str, party_type: str, company_id: int = 1, exclude_id: int | None = None) -> bool:
        """Checks if party code exists"""
        sql = "SELECT id FROM parties WHERE code = ? AND party_type = ? AND company_id = ?"
        params: tuple = (code, party_type, company_id)
        if exclude_id is not None:
            sql += " AND id != ?"
            params += (exclude_id,)
        return self.db.fetch_one(sql, params) is not None

    def find_all_for_company(
        self, 
        company_id: int = 1, 
        active_only: bool = True,
        party_type: str | None = None
    ) -> list[dict]:
        """Gets parties with optional type filter."""
        sql = "SELECT * FROM parties WHERE company_id = ?"
        params: list = [company_id]
        
        if active_only:
            sql += " AND is_active = 1"
        if party_type:
            sql += " AND party_type = ?"
            params.append(party_type)
            
        sql += " ORDER BY code"
        return self.db.fetch_all(sql, tuple(params))

    def find_by_account_id(self, account_id: int) -> list[dict]:
        """Finds parties linked to a specific account"""
        return self.db.fetch_all(
            "SELECT * FROM parties WHERE account_id = ? AND is_active = 1",
            (account_id,)
        )

    def insert_unique(self, data: dict) -> int:
        """Prevents duplicate party codes - KEPT for backward compatibility"""
        # Check if code exists
        existing = self.find_by_code(
            data["code"], 
            data["party_type"], 
            data.get("company_id", 1)
        )
        if existing:
            raise DuplicateRecordError(
                f"Party code '{data['code']}' already exists for this type."
            )
        return self.insert(data)