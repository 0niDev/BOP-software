"""Data access for Bill of Materials."""
from __future__ import annotations

from repositories.base_repository import BaseRepository
from utils.exceptions import DuplicateRecordError


class BOMRepository(BaseRepository):
    """Repository for bill_of_materials table."""
    table_name = "bill_of_materials"

    def find_by_finished_item(self, finished_item_id: int, company_id: int = 1) -> list[dict]:
        """Find all BOMs for a finished item."""
        return self.db.fetch_all(
            """
            SELECT * FROM bill_of_materials 
            WHERE finished_item_id = ? AND company_id = ?
            ORDER BY bom_name
            """,
            (finished_item_id, company_id),
        )

    def find_by_name(self, bom_name: str, company_id: int = 1) -> dict | None:
        """Find BOM by name."""
        return self.db.fetch_one(
            """
            SELECT * FROM bill_of_materials 
            WHERE bom_name = ? AND company_id = ?
            """,
            (bom_name, company_id),
        )

    def find_all_for_company(self, company_id: int = 1, active_only: bool = True) -> list[dict]:
        """Get all BOMs for a company."""
        sql = "SELECT * FROM bill_of_materials WHERE company_id = ?"
        params = [company_id]
        if active_only:
            sql += " AND is_active = 1"
        sql += " ORDER BY bom_name"
        return self.db.fetch_all(sql, tuple(params))


class BOMComponentRepository(BaseRepository):
    """Repository for bom_components table."""
    table_name = "bom_components"

    def find_by_bom_id(self, bom_id: int) -> list[dict]:
        """Find all components for a BOM."""
        return self.db.fetch_all(
            """
            SELECT bc.*, i.item_name, i.item_code, i.unit
            FROM bom_components bc
            JOIN items i ON i.id = bc.component_item_id
            WHERE bc.bom_id = ?
            ORDER BY i.item_name
            """,
            (bom_id,),
        )

    def find_by_bom_ids(self, bom_ids: list[int]) -> dict[int, list[dict]]:
        """
        Batch fetch components for multiple BOMs in a single query.
        Returns a dict mapping bom_id -> list of components.
        This eliminates N+1 queries when loading multiple BOMs.
        """
        if not bom_ids:
            return {}
        
        placeholders = ','.join('?' * len(bom_ids))
        rows = self.db.fetch_all(f"""
            SELECT bc.*, i.item_name, i.item_code, i.unit
            FROM bom_components bc
            JOIN items i ON i.id = bc.component_item_id
            WHERE bc.bom_id IN ({placeholders})
            ORDER BY i.item_name
        """, bom_ids)
        
        # Group by bom_id
        result = {}
        for row in rows:
            bom_id = row['bom_id']
            if bom_id not in result:
                result[bom_id] = []
            result[bom_id].append(row)
        
        return result

    def delete_by_bom_id(self, bom_id: int) -> None:
        """Delete all components for a BOM."""
        self.db.execute(
            "DELETE FROM bom_components WHERE bom_id = ?",
            (bom_id,)
        )
        self._invalidate_cache(f"find_by_bom_id:{bom_id}")
        self._invalidate_cache("find_by_bom_ids")