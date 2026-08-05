"""
Item repository for product/raw material management.

Optimized for SQLite Cloud with:
- Batch operations for reduced round-trips
- Multi-level caching
- Inventory and pricing queries
"""
from __future__ import annotations

from typing import List, Optional

from database.connection import DatabaseConnection, get_db
from repositories.base_repository import BaseRepository
from utils.cache_manager import get_cache_manager
from utils.logger import get_logger

logger = get_logger(__name__)


class ItemRepository(BaseRepository):
    """Repository for item/product operations."""
    
    table_name = "items"
    pk_column = "id"
    
    def __init__(self, db: Optional[DatabaseConnection] = None):
        super().__init__(db)
        self._cache = get_cache_manager()
    
    def find_by_code(self, item_code: str) -> Optional[dict]:
        """Find item by item code."""
        cache_key = f"{self.table_name}:find_by_code:{item_code}"
        cached = self._cache.get(cache_key)
        
        if cached is not None:
            return cached
        
        sql = f"SELECT * FROM {self.table_name} WHERE item_code = ?"
        result = self.db.fetch_one(sql, (item_code,))
        
        if result is not None:
            self._cache.set(cache_key, result)
        
        return result
    
    def find_by_category(self, category: str) -> List[dict]:
        """Find all items in a category."""
        cache_key = f"{self.table_name}:category:{category}"
        cached = self._cache.get(cache_key)
        
        if cached is not None:
            return cached
        
        sql = f"""
            SELECT * FROM {self.table_name} 
            WHERE category = ? AND is_active = 1
            ORDER BY item_name
        """
        result = self.db.fetch_all(sql, (category,))
        
        self._cache.set(cache_key, result)
        return result
    
    def search_items(
        self, 
        search_term: str, 
        category: Optional[str] = None,
        limit: int = 50
    ) -> List[dict]:
        """
        Search items by code or name.
        
        Uses LIKE for fuzzy matching.
        """
        category_filter = ""
        params = [f"%{search_term}%", f"%{search_term}%"]
        
        if category:
            category_filter = "AND category = ?"
            params.append(category)
        
        sql = f"""
            SELECT * FROM {self.table_name}
            WHERE (item_code LIKE ? OR item_name LIKE ?)
            AND is_active = 1
            {category_filter}
            ORDER BY item_name
            LIMIT ?
        """
        params.append(limit)
        
        return self.db.fetch_all(sql, params)
    
    def get_item_stock(
        self, 
        item_id: int, 
        warehouse_id: int = 1
    ) -> float:
        """
        Get current stock quantity for an item in a warehouse.
        
        Calculates from stock transactions (purchases add, sales subtract).
        """
        sql = """
            SELECT COALESCE(SUM(
                CASE 
                    WHEN transaction_type IN ('PURCHASE', 'RETURN_IN', 'ADJUSTMENT_IN') THEN quantity
                    WHEN transaction_type IN ('SALE', 'RETURN_OUT', 'ADJUSTMENT_OUT') THEN -quantity
                    ELSE 0
                END
            ), 0) as stock_quantity
            FROM stock_transactions
            WHERE item_id = ?
            AND warehouse_id = ?
            AND is_posted = 1
        """
        
        result = self.db.fetch_one(sql, (item_id, warehouse_id))
        return result['stock_quantity'] if result else 0.0
    
    def find_with_stock(
        self, 
        warehouse_id: int = 1,
        include_inactive: bool = False
    ) -> List[dict]:
        """Find all items with their current stock levels."""
        active_filter = "AND i.is_active = 1" if not include_inactive else ""
        
        sql = f"""
            SELECT 
                i.*,
                COALESCE(SUM(
                    CASE 
                        WHEN st.transaction_type IN ('PURCHASE', 'RETURN_IN', 'ADJUSTMENT_IN') THEN st.quantity
                        WHEN st.transaction_type IN ('SALE', 'RETURN_OUT', 'ADJUSTMENT_OUT') THEN -st.quantity
                        ELSE 0
                    END
                ), 0) as stock_quantity
            FROM {self.table_name} i
            LEFT JOIN stock_transactions st ON i.id = st.item_id
                AND st.warehouse_id = ?
                AND st.is_posted = 1
            WHERE 1=1
            {active_filter}
            GROUP BY i.id
            ORDER BY i.item_name
        """
        
        return self.db.fetch_all(sql, (warehouse_id,))
    
    def find_low_stock_items(
        self, 
        warehouse_id: int = 1,
        threshold_multiplier: float = 1.0
    ) -> List[dict]:
        """Find items below reorder level."""
        sql = f"""
            SELECT 
                i.*,
                COALESCE(SUM(
                    CASE 
                        WHEN st.transaction_type IN ('PURCHASE', 'RETURN_IN', 'ADJUSTMENT_IN') THEN st.quantity
                        WHEN st.transaction_type IN ('SALE', 'RETURN_OUT', 'ADJUSTMENT_OUT') THEN -st.quantity
                        ELSE 0
                    END
                ), 0) as stock_quantity
            FROM {self.table_name} i
            LEFT JOIN stock_transactions st ON i.id = st.item_id
                AND st.warehouse_id = ?
                AND st.is_posted = 1
            WHERE i.is_active = 1
            GROUP BY i.id
            HAVING stock_quantity < (i.reorder_level * ?)
            ORDER BY stock_quantity ASC
        """
        
        return self.db.fetch_all(sql, (warehouse_id, threshold_multiplier))
    
    def update_prices(
        self, 
        item_id: int,
        sale_price: Optional[float] = None,
        purchase_price: Optional[float] = None,
        cost_price: Optional[float] = None
    ) -> None:
        """Update item prices."""
        update_data = {}
        
        if sale_price is not None:
            update_data['sale_price'] = sale_price
        if purchase_price is not None:
            update_data['purchase_price'] = purchase_price
        if cost_price is not None:
            update_data['cost_price'] = cost_price
        
        if update_data:
            self.update(item_id, update_data)
            
            # Invalidate price cache
            cache_key = f"{self.table_name}:prices:{item_id}"
            self._cache.delete(cache_key)
    
    def get_item_prices(self, item_id: int) -> dict:
        """Get current prices for an item."""
        cache_key = f"{self.table_name}:prices:{item_id}"
        cached = self._cache.get(cache_key)
        
        if cached is not None:
            return cached
        
        item = self.find_by_id(item_id)
        if item is None:
            raise ValueError(f"Item {item_id} not found")
        
        prices = {
            'sale_price': item.get('sale_price', 0.0),
            'purchase_price': item.get('purchase_price', 0.0),
            'cost_price': item.get('cost_price', 0.0),
        }
        
        self._cache.set(cache_key, prices)
        return prices
    
    def count_by_category(self, category: str) -> int:
        """Count items in a category."""
        return self.count("category = ? AND is_active = 1", (category,))
    
    def find_items_without_tax_rate(self) -> List[dict]:
        """Find items that don't have a tax rate assigned."""
        sql = f"""
            SELECT * FROM {self.table_name}
            WHERE tax_rate IS NULL
            AND is_active = 1
            ORDER BY item_name
        """
        return self.db.fetch_all(sql)
    
    def batch_update_category(
        self, 
        item_ids: List[int], 
        new_category: str
    ) -> int:
        """Batch update category for multiple items."""
        if not item_ids:
            return 0
        
        placeholders = ','.join('?' * len(item_ids))
        sql = f"""
            UPDATE {self.table_name}
            SET category = ?
            WHERE id IN ({placeholders})
        """
        
        params = [new_category] + item_ids
        self.db.execute(sql, params)
        
        # Invalidate caches
        for item_id in item_ids:
            self._invalidate_cache(f"{self.table_name}:{item_id}")
        
        logger.info(f"Updated category for {len(item_ids)} items to {new_category}")
        return len(item_ids)
