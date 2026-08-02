"""Manufacturing Controller for BOP Nutraceuticals ERP."""

from typing import List, Optional, Dict, Any
from datetime import date
from decimal import Decimal
from models.production_order import ProductionOrder, DocumentStatus
from models.bom import BOM, BOMItem
from services.manufacturing_service import ManufacturingService
from services.inventory_service import InventoryService


class ManufacturingController:
    """Controller for manufacturing operations."""
    
    def __init__(
        self,
        manufacturing_service: ManufacturingService,
        inventory_service: InventoryService
    ):
        self.manufacturing_service = manufacturing_service
        self.inventory_service = inventory_service
    
    # BOM Operations
    
    def create_bom(
        self,
        company_id: str,
        fg_item_id: str,
        bom_items: List[Dict[str, Any]],
        narration: str = ""
    ) -> tuple[bool, str, Optional[BOM]]:
        """Create a new Bill of Materials."""
        try:
            bom = self.manufacturing_service.create_bom(
                company_id=company_id,
                fg_item_id=fg_item_id,
                bom_items=bom_items,
                narration=narration
            )
            
            if bom:
                return True, f"BOM created successfully for {bom.bom_number}.", bom
            else:
                return False, "Failed to create BOM.", None
                
        except Exception as e:
            return False, f"Error creating BOM: {str(e)}", None
    
    def get_bom_by_id(self, bom_id: str) -> Optional[BOM]:
        """Get BOM by ID."""
        try:
            return self.manufacturing_service.get_bom_by_id(bom_id)
        except Exception:
            return None
    
    def get_bom_for_item(self, company_id: str, fg_item_id: str) -> Optional[BOM]:
        """Get active BOM for a finished good item."""
        try:
            return self.manufacturing_service.get_bom_for_item(company_id, fg_item_id)
        except Exception:
            return None
    
    def update_bom(
        self,
        bom_id: str,
        bom_items: Optional[List[Dict[str, Any]]] = None,
        narration: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> tuple[bool, str]:
        """Update existing BOM."""
        try:
            result = self.manufacturing_service.update_bom(
                bom_id=bom_id,
                bom_items=bom_items,
                narration=narration,
                is_active=is_active
            )
            
            if result:
                return True, "BOM updated successfully."
            else:
                return False, "Failed to update BOM."
                
        except Exception as e:
            return False, f"Error updating BOM: {str(e)}"
    
    # Production Order Operations
    
    def create_production_order(
        self,
        company_id: str,
        warehouse_id: str,
        bom_id: str,
        quantity: Decimal,
        planned_start_date: date,
        narration: str = ""
    ) -> tuple[bool, str, Optional[ProductionOrder]]:
        """Create a new production order."""
        try:
            po = self.manufacturing_service.create_production_order(
                company_id=company_id,
                warehouse_id=warehouse_id,
                bom_id=bom_id,
                quantity=quantity,
                planned_start_date=planned_start_date,
                narration=narration
            )
            
            if po:
                return True, f"Production order {po.order_number} created.", po
            else:
                return False, "Failed to create production order.", None
                
        except Exception as e:
            return False, f"Error creating production order: {str(e)}", None
    
    def get_production_order(self, order_id: str) -> Optional[ProductionOrder]:
        """Get production order by ID."""
        try:
            return self.manufacturing_service.get_production_order(order_id)
        except Exception:
            return None
    
    def start_production(self, order_id: str) -> tuple[bool, str]:
        """Start production (reserve raw materials)."""
        try:
            result = self.manufacturing_service.start_production(order_id)
            
            if result:
                return True, "Production started. Raw materials reserved."
            else:
                return False, "Failed to start production."
                
        except Exception as e:
            return False, f"Error starting production: {str(e)}"
    
    def complete_production(
        self,
        order_id: str,
        actual_quantity: Optional[Decimal] = None,
        completion_date: Optional[date] = None
    ) -> tuple[bool, str]:
        """Complete production order (consume RM, add FG)."""
        try:
            result = self.manufacturing_service.complete_production(
                order_id=order_id,
                actual_quantity=actual_quantity,
                completion_date=completion_date
            )
            
            if result:
                return True, "Production completed successfully."
            else:
                return False, "Failed to complete production."
                
        except Exception as e:
            return False, f"Error completing production: {str(e)}"
    
    def cancel_production_order(self, order_id: str, reason: str = "") -> tuple[bool, str]:
        """Cancel a production order."""
        try:
            result = self.manufacturing_service.cancel_production_order(order_id, reason)
            
            if result:
                return True, "Production order cancelled."
            else:
                return False, "Failed to cancel production order."
                
        except Exception as e:
            return False, f"Error cancelling production order: {str(e)}"
    
    def get_production_orders(
        self,
        company_id: str,
        from_date: date,
        to_date: date,
        status: Optional[DocumentStatus] = None
    ) -> List[ProductionOrder]:
        """Get production orders report."""
        try:
            return self.manufacturing_service.get_production_orders(
                company_id=company_id,
                from_date=from_date,
                to_date=to_date,
                status=status
            )
        except Exception:
            return []
    
    def check_raw_material_availability(
        self,
        company_id: str,
        warehouse_id: str,
        bom_id: str,
        quantity: Decimal
    ) -> tuple[bool, List[Dict[str, Any]]]:
        """Check if raw materials are available for production."""
        try:
            return self.manufacturing_service.check_raw_material_availability(
                company_id=company_id,
                warehouse_id=warehouse_id,
                bom_id=bom_id,
                quantity=quantity
            )
        except Exception as e:
            return False, [{'error': str(e)}]
    
    def get_production_cost(self, order_id: str) -> Dict[str, Any]:
        """Get production cost breakdown."""
        try:
            return self.manufacturing_service.get_production_cost(order_id)
        except Exception:
            return {}
