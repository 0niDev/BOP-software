"""Item Controller for BOP Nutraceuticals ERP."""

from typing import List, Optional, Dict, Any
from decimal import Decimal
from models.item import Item, ItemType
from services.item_service import ItemService


class ItemController:
    """Controller for item master operations."""
    
    def __init__(self, item_service: ItemService):
        self.item_service = item_service
    
    def create_item(
        self,
        company_id: str,
        name: str,
        item_type: ItemType,
        unit: str,
        hsn_code: Optional[str] = None,
        gst_rate: Decimal = Decimal('18.00'),
        opening_stock: Decimal = Decimal('0.00'),
        opening_rate: Decimal = Decimal('0.00'),
        description: Optional[str] = None,
        is_stock_item: bool = True
    ) -> tuple[bool, str, Optional[Item]]:
        """Create a new item."""
        try:
            item = self.item_service.create_item(
                company_id=company_id,
                name=name,
                item_type=item_type,
                unit=unit,
                hsn_code=hsn_code,
                gst_rate=gst_rate,
                opening_stock=opening_stock,
                opening_rate=opening_rate,
                description=description,
                is_stock_item=is_stock_item
            )
            
            if item:
                return True, f"Item {item.name} created successfully.", item
            else:
                return False, "Failed to create item.", None
                
        except Exception as e:
            return False, f"Error creating item: {str(e)}", None
    
    def get_item(self, item_id: str) -> Optional[Item]:
        """Get item by ID."""
        try:
            return self.item_service.get_item(item_id)
        except Exception:
            return None
    
    def update_item(
        self,
        item_id: str,
        name: Optional[str] = None,
        item_type: Optional[ItemType] = None,
        unit: Optional[str] = None,
        hsn_code: Optional[str] = None,
        gst_rate: Optional[Decimal] = None,
        description: Optional[str] = None,
        is_stock_item: Optional[bool] = None
    ) -> tuple[bool, str]:
        """Update existing item."""
        try:
            result = self.item_service.update_item(
                item_id=item_id,
                name=name,
                item_type=item_type,
                unit=unit,
                hsn_code=hsn_code,
                gst_rate=gst_rate,
                description=description,
                is_stock_item=is_stock_item
            )
            
            if result:
                return True, "Item updated successfully."
            else:
                return False, "Failed to update item."
                
        except Exception as e:
            return False, f"Error updating item: {str(e)}"
    
    def get_all_items(self, company_id: str) -> List[Item]:
        """Get all items for a company."""
        try:
            return self.item_service.get_all_items(company_id)
        except Exception:
            return []
    
    def get_items_by_type(
        self,
        company_id: str,
        item_type: ItemType
    ) -> List[Item]:
        """Get items by type."""
        try:
            return self.item_service.get_items_by_type(company_id, item_type)
        except Exception:
            return []
    
    def get_stock_items(self, company_id: str) -> List[Item]:
        """Get all stock items."""
        try:
            return self.item_service.get_stock_items(company_id)
        except Exception:
            return []
    
    def get_non_stock_items(self, company_id: str) -> List[Item]:
        """Get all non-stock items."""
        try:
            return self.item_service.get_non_stock_items(company_id)
        except Exception:
            return []
    
    def search_items(
        self,
        company_id: str,
        search_term: str,
        is_stock_item: Optional[bool] = None
    ) -> List[Item]:
        """Search items by name or code."""
        try:
            return self.item_service.search_items(
                company_id=company_id,
                search_term=search_term,
                is_stock_item=is_stock_item
            )
        except Exception:
            return []
    
    def get_item_stock_summary(
        self,
        company_id: str,
        item_id: str
    ) -> Dict[str, Any]:
        """Get stock summary for an item across all warehouses."""
        try:
            return self.item_service.get_item_stock_summary(company_id, item_id)
        except Exception:
            return {}
    
    def get_item_valuation(
        self,
        company_id: str,
        item_id: str
    ) -> Dict[str, Any]:
        """Get item valuation details."""
        try:
            return self.item_service.get_item_valuation(company_id, item_id)
        except Exception:
            return {}
    
    def get_item_movement(
        self,
        company_id: str,
        item_id: str,
        from_date: Any,
        to_date: Any
    ) -> List[Dict[str, Any]]:
        """Get item movement history."""
        try:
            return self.item_service.get_item_movement(
                company_id=company_id,
                item_id=item_id,
                from_date=from_date,
                to_date=to_date
            )
        except Exception:
            return []
