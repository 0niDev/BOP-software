"""Inventory Controller for BOP Nutraceuticals ERP."""

from typing import List, Optional, Dict, Any
from datetime import date
from decimal import Decimal
from models.stock_batch import StockBatch
from models.item import Item
from services.inventory_service import InventoryService


class InventoryController:
    """Controller for inventory operations."""
    
    def __init__(self, inventory_service: InventoryService):
        self.inventory_service = inventory_service
    
    def get_stock_summary(
        self,
        company_id: str,
        warehouse_id: Optional[str] = None,
        item_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get stock summary for items."""
        try:
            return self.inventory_service.get_stock_summary(
                company_id=company_id,
                warehouse_id=warehouse_id,
                item_id=item_id
            )
        except Exception:
            return []
    
    def get_available_stock(
        self,
        company_id: str,
        warehouse_id: str,
        item_id: str
    ) -> Decimal:
        """Get available stock quantity for an item."""
        try:
            return self.inventory_service.get_available_stock(
                company_id=company_id,
                warehouse_id=warehouse_id,
                item_id=item_id
            )
        except Exception:
            return Decimal('0.00')
    
    def get_stock_batches(
        self,
        company_id: str,
        warehouse_id: str,
        item_id: str
    ) -> List[StockBatch]:
        """Get stock batches for an item (FEFO order)."""
        try:
            return self.inventory_service.get_stock_batches(
                company_id=company_id,
                warehouse_id=warehouse_id,
                item_id=item_id
            )
        except Exception:
            return []
    
    def transfer_stock(
        self,
        company_id: str,
        from_warehouse_id: str,
        to_warehouse_id: str,
        item_id: str,
        quantity: Decimal,
        batch_id: Optional[str] = None,
        narration: str = ""
    ) -> tuple[bool, str]:
        """Transfer stock between warehouses."""
        try:
            result = self.inventory_service.transfer_stock(
                company_id=company_id,
                from_warehouse_id=from_warehouse_id,
                to_warehouse_id=to_warehouse_id,
                item_id=item_id,
                quantity=quantity,
                batch_id=batch_id,
                narration=narration
            )
            
            if result:
                return True, "Stock transferred successfully."
            else:
                return False, "Failed to transfer stock."
                
        except Exception as e:
            return False, f"Error transferring stock: {str(e)}"
    
    def adjust_stock(
        self,
        company_id: str,
        warehouse_id: str,
        item_id: str,
        quantity: Decimal,
        reason: str,
        batch_number: Optional[str] = None,
        expiry_date: Optional[date] = None,
        narration: str = ""
    ) -> tuple[bool, str]:
        """Adjust stock (positive or negative)."""
        try:
            result = self.inventory_service.adjust_stock(
                company_id=company_id,
                warehouse_id=warehouse_id,
                item_id=item_id,
                quantity=quantity,
                reason=reason,
                batch_number=batch_number,
                expiry_date=expiry_date,
                narration=narration
            )
            
            if result:
                return True, "Stock adjusted successfully."
            else:
                return False, "Failed to adjust stock."
                
        except Exception as e:
            return False, f"Error adjusting stock: {str(e)}"
    
    def get_low_stock_items(
        self,
        company_id: str,
        threshold: int = 10
    ) -> List[Dict[str, Any]]:
        """Get items with low stock."""
        try:
            return self.inventory_service.get_low_stock_items(
                company_id=company_id,
                threshold=threshold
            )
        except Exception:
            return []
    
    def get_expired_items(
        self,
        company_id: str,
        warehouse_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get expired or near-expiry items."""
        try:
            return self.inventory_service.get_expired_items(
                company_id=company_id,
                warehouse_id=warehouse_id
            )
        except Exception:
            return []
    
    def get_item_by_id(self, item_id: str) -> Optional[Item]:
        """Get item details by ID."""
        try:
            return self.inventory_service.get_item_by_id(item_id)
        except Exception:
            return None
    
    def get_all_items(self, company_id: str) -> List[Item]:
        """Get all items for a company."""
        try:
            return self.inventory_service.get_all_items(company_id)
        except Exception:
            return []
    
    def get_warehouse_stock(
        self,
        company_id: str,
        warehouse_id: str
    ) -> List[Dict[str, Any]]:
        """Get complete stock status for a warehouse."""
        try:
            return self.inventory_service.get_warehouse_stock(
                company_id=company_id,
                warehouse_id=warehouse_id
            )
        except Exception:
            return []
