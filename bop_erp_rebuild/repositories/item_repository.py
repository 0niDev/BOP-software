"""Item, Unit, and ItemCategory repositories"""

from repositories.base_repository import BaseRepository
from models.item import Item, ItemCategory, Unit, ItemType
from database import db


class UnitRepository(BaseRepository[Unit]):
    """Repository for Unit operations"""
    
    def __init__(self):
        super().__init__(Unit, 'units')
    
    def get_by_code(self, code: str, company_id: int) -> Unit | None:
        """Get unit by code and company"""
        units = self.get_all("code = ? AND company_id = ?", (code, company_id))
        return units[0] if units else None
    
    def get_by_company(self, company_id: int) -> list[Unit]:
        """Get all units for a company"""
        return self.get_all("company_id = ?", (company_id,), "name")
    
    def get_base_units(self, company_id: int) -> list[Unit]:
        """Get all base units"""
        return self.get_all("company_id = ? AND is_base = ?", (company_id, 1), "name")


class ItemCategoryRepository(BaseRepository[ItemCategory]):
    """Repository for ItemCategory operations"""
    
    def __init__(self):
        super().__init__(ItemCategory, 'item_categories')
    
    def get_by_code(self, code: str, company_id: int) -> ItemCategory | None:
        """Get category by code and company"""
        categories = self.get_all("code = ? AND company_id = ?", (code, company_id))
        return categories[0] if categories else None
    
    def get_by_company(self, company_id: int) -> list[ItemCategory]:
        """Get all categories for a company"""
        return self.get_all("company_id = ?", (company_id,), "name")
    
    def get_parent_categories(self, company_id: int) -> list[ItemCategory]:
        """Get all parent (top-level) categories"""
        return self.get_all(
            "(parent_id IS NULL OR parent_id = 0) AND company_id = ?",
            (company_id,),
            "name"
        )
    
    def get_child_categories(self, parent_id: int) -> list[ItemCategory]:
        """Get child categories under a parent"""
        return self.get_all("parent_id = ?", (parent_id,), "name")


class ItemRepository(BaseRepository[Item]):
    """Repository for Item operations"""
    
    def __init__(self):
        super().__init__(Item, 'items')
    
    def get_by_code(self, code: str, company_id: int) -> Item | None:
        """Get item by code and company"""
        return self.get_all("code = ? AND company_id = ?", (code, company_id))[0] \
            if self.exists("code = ? AND company_id = ?", (code, company_id)) else None
    
    def get_by_company(self, company_id: int) -> list[Item]:
        """Get all items for a company"""
        return self.get_all("company_id = ?", (company_id,), "name")
    
    def get_by_type(self, item_type: ItemType, company_id: int) -> list[Item]:
        """Get items by type"""
        return self.get_all(
            "item_type = ? AND company_id = ?",
            (item_type.value, company_id),
            "name"
        )
    
    def get_active_items(self, company_id: int) -> list[Item]:
        """Get all active items"""
        return self.get_all("company_id = ? AND is_active = ?", (company_id, 1), "name")
    
    def get_raw_materials(self, company_id: int) -> list[Item]:
        """Get all raw material items"""
        return self.get_by_type(ItemType.RAW_MATERIAL, company_id)
    
    def get_finished_goods(self, company_id: int) -> list[Item]:
        """Get all finished goods items"""
        return self.get_by_type(ItemType.FINISHED_GOODS, company_id)
    
    def search_items(self, company_id: int, search_term: str) -> list[Item]:
        """Search items by name, code, or description"""
        return self.search(search_term, ['name', 'code', 'description'])
    
    def get_items_with_stock(self, company_id: int, warehouse_id: int = None) -> list[dict]:
        """Get items with current stock quantities"""
        if warehouse_id:
            query = """
                SELECT 
                    i.id, i.code, i.name, i.unit_name,
                    COALESCE(SUM(sb.quantity), 0) as stock_quantity,
                    COALESCE(AVG(sb.rate), 0) as avg_rate,
                    w.name as warehouse_name
                FROM items i
                LEFT JOIN stock_batches sb ON i.id = sb.item_id AND sb.is_active = 1
                LEFT JOIN warehouses w ON sb.warehouse_id = w.id
                WHERE i.company_id = ? AND (sb.warehouse_id = ? OR sb.warehouse_id IS NULL)
                GROUP BY i.id
            """
            return db.fetch_all(query, (company_id, warehouse_id))
        else:
            query = """
                SELECT 
                    i.id, i.code, i.name, i.unit_name,
                    COALESCE(SUM(sb.quantity), 0) as stock_quantity,
                    COALESCE(AVG(sb.rate), 0) as avg_rate
                FROM items i
                LEFT JOIN stock_batches sb ON i.id = sb.item_id AND sb.is_active = 1
                WHERE i.company_id = ?
                GROUP BY i.id
            """
            return db.fetch_all(query, (company_id,))
    
    def get_low_stock_items(self, company_id: int) -> list[Item]:
        """Get items below reorder level"""
        query = """
            SELECT i.* FROM items i
            LEFT JOIN stock_batches sb ON i.id = sb.item_id AND sb.is_active = 1
            WHERE i.company_id = ?
            GROUP BY i.id
            HAVING COALESCE(SUM(sb.quantity), 0) <= i.reorder_level
        """
        rows = db.fetch_all(query, (company_id,))
        return [Item.from_row(row) for row in rows]
    
    def update_rates(self, item_id: int, purchase_rate: float = None, 
                     sales_rate: float = None, mrp: float = None) -> bool:
        """Update item rates"""
        updates = []
        values = []
        
        if purchase_rate is not None:
            updates.append("purchase_rate = ?")
            values.append(purchase_rate)
        
        if sales_rate is not None:
            updates.append("sales_rate = ?")
            values.append(sales_rate)
        
        if mrp is not None:
            updates.append("mrp = ?")
            values.append(mrp)
        
        if not updates:
            return False
        
        values.append(item_id)
        db.execute(
            f"UPDATE items SET {', '.join(updates)} WHERE id = ?",
            tuple(values)
        )
        self._invalidate_cache(item_id)
        return True
