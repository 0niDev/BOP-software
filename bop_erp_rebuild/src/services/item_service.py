"""
Item Service - Item master management
Handles item CRUD, pricing, and item category operations.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from models.item import Item, ItemCategory, UOM
from repositories.item_repository import ItemRepository, ItemCategoryRepository
from database.connection_manager import get_connection


class ItemServiceError(Exception):
    """Custom exception for item service errors."""
    pass


class ItemService:
    """
    Handles all item master operations including:
    - Item CRUD operations
    - Category management
    - Pricing management
    - Stock status queries
    """
    
    def __init__(self, company_id: str):
        self.company_id = company_id
        self.item_repo = ItemRepository()
        self.category_repo = ItemCategoryRepository()
    
    def create_item(
        self,
        code: str,
        name: str,
        category_id: str,
        uom: UOM,
        description: str = "",
        sales_rate: Decimal = Decimal('0'),
        purchase_rate: Decimal = Decimal('0'),
        reorder_level: Decimal = Decimal('0'),
        is_stock_item: bool = True,
        is_active: bool = True
    ) -> Item:
        """
        Create a new item.
        """
        conn = None
        try:
            conn = get_connection()
            
            # Check if code exists
            existing = self.item_repo.get_by_code(conn, code, self.company_id)
            if existing:
                raise ItemServiceError(f"Item code {code} already exists")
            
            # Validate category
            category = self.category_repo.get_by_id(conn, category_id)
            if not category:
                raise ItemServiceError(f"Category {category_id} not found")
            
            item = Item(
                id='',  # Set by repository
                company_id=self.company_id,
                code=code,
                name=name,
                category_id=category_id,
                description=description,
                uom=uom,
                sales_rate=sales_rate,
                purchase_rate=purchase_rate,
                reorder_level=reorder_level,
                is_stock_item=is_stock_item,
                is_active=is_active,
                created_at=datetime.now()
            )
            
            self.item_repo.create(conn, item)
            self.item_repo.invalidate_cache()
            
            return item
            
        finally:
            if conn:
                conn.close()
    
    def update_item(self, item_id: str, updates: Dict[str, Any]) -> Item:
        """
        Update an existing item.
        """
        conn = None
        try:
            conn = get_connection()
            
            item = self.item_repo.get_by_id(conn, item_id)
            if not item:
                raise ItemServiceError(f"Item {item_id} not found")
            
            for key, value in updates.items():
                if hasattr(item, key):
                    setattr(item, key, value)
            
            self.item_repo.update(conn, item)
            self.item_repo.invalidate_cache()
            
            return item
            
        finally:
            if conn:
                conn.close()
    
    def get_item_by_id(self, item_id: str) -> Optional[Item]:
        """Get item by ID."""
        conn = None
        try:
            conn = get_connection()
            return self.item_repo.get_by_id(conn, item_id)
        finally:
            if conn:
                conn.close()
    
    def get_item_by_code(self, code: str) -> Optional[Item]:
        """Get item by code."""
        conn = None
        try:
            conn = get_connection()
            return self.item_repo.get_by_code(conn, code, self.company_id)
        finally:
            if conn:
                conn.close()
    
    def get_all_items(self, is_active: bool = True, category_id: Optional[str] = None) -> List[Item]:
        """Get all items with optional filters."""
        conn = None
        try:
            conn = get_connection()
            return self.item_repo.get_all(conn, self.company_id, is_active, category_id)
        finally:
            if conn:
                conn.close()
    
    def get_stock_items(self) -> List[Item]:
        """Get all stock items."""
        items = self.get_all_items(True)
        return [item for item in items if item.is_stock_item]
    
    def get_non_stock_items(self) -> List[Item]:
        """Get all non-stock items (services, etc.)."""
        items = self.get_all_items(True)
        return [item for item in items if not item.is_stock_item]
    
    def create_category(self, name: str, parent_id: Optional[str] = None) -> ItemCategory:
        """Create a new item category."""
        conn = None
        try:
            conn = get_connection()
            
            category = ItemCategory(
                id='',
                company_id=self.company_id,
                name=name,
                parent_id=parent_id,
                is_active=True,
                created_at=datetime.now()
            )
            
            self.category_repo.create(conn, category)
            self.category_repo.invalidate_cache()
            
            return category
            
        finally:
            if conn:
                conn.close()
    
    def get_all_categories(self) -> List[ItemCategory]:
        """Get all item categories."""
        conn = None
        try:
            conn = get_connection()
            return self.category_repo.get_all(conn, self.company_id)
        finally:
            if conn:
                conn.close()
    
    def get_items_by_category(self, category_id: str) -> List[Item]:
        """Get all items in a category."""
        return self.get_all_items(True, category_id)
    
    def search_items(self, search_term: str) -> List[Item]:
        """Search items by code or name."""
        conn = None
        try:
            conn = get_connection()
            return self.item_repo.search(conn, self.company_id, search_term)
        finally:
            if conn:
                conn.close()
    
    def get_item_with_stock(self, item_id: str) -> Dict[str, Any]:
        """Get item details along with current stock status."""
        from services.inventory_service import InventoryService
        
        item = self.get_item_by_id(item_id)
        if not item:
            return {}
        
        inventory_service = InventoryService(self.company_id)
        stock_qty = inventory_service.get_available_stock(item.code)
        stock_by_warehouse = inventory_service.get_stock_by_warehouse(item.code)
        
        return {
            'item': item,
            'stock_quantity': stock_qty,
            'stock_by_warehouse': stock_by_warehouse,
            'is_below_reorder': stock_qty < item.reorder_level if item.reorder_level > 0 else False
        }
