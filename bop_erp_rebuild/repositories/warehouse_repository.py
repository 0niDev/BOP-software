"""Warehouse repository"""

from repositories.base_repository import BaseRepository
from models.warehouse import Warehouse


class WarehouseRepository(BaseRepository[Warehouse]):
    """Repository for Warehouse operations"""
    
    def __init__(self):
        super().__init__(Warehouse, 'warehouses')
    
    def get_by_code(self, code: str, company_id: int) -> Warehouse | None:
        """Get warehouse by code and company"""
        return self.get_all("code = ? AND company_id = ?", (code, company_id))[0] \
            if self.exists("code = ? AND company_id = ?", (code, company_id)) else None
    
    def get_by_company(self, company_id: int) -> list[Warehouse]:
        """Get all warehouses for a company"""
        return self.get_all("company_id = ?", (company_id,), "name")
    
    def get_active_warehouses(self, company_id: int) -> list[Warehouse]:
        """Get all active warehouses for a company"""
        return self.get_all("company_id = ? AND is_active = ?", (company_id, 1), "name")
    
    def get_default_warehouse(self, company_id: int) -> Warehouse | None:
        """Get the default warehouse for a company"""
        warehouses = self.get_all("company_id = ? AND is_default = ?", (company_id, 1))
        return warehouses[0] if warehouses else None
    
    def set_default_warehouse(self, warehouse_id: int, company_id: int) -> bool:
        """Set a warehouse as default for the company"""
        from database import db
        # First unset all defaults for this company
        db.execute(
            "UPDATE warehouses SET is_default = 0 WHERE company_id = ?",
            (company_id,)
        )
        # Then set the new default
        db.execute(
            "UPDATE warehouses SET is_default = 1 WHERE id = ? AND company_id = ?",
            (warehouse_id, company_id)
        )
        self._invalidate_cache(warehouse_id)
        return True
