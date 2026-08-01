"""Controller for Manufacturing - translates service errors to UI messages."""
from __future__ import annotations

from models.bill_of_materials import BillOfMaterials
from models.production_order import ProductionOrder
from services.manufacturing_service import ManufacturingService
from utils.exceptions import ERPException
from utils.logger import get_logger

logger = get_logger(__name__)


class ManufacturingController:
    """Controller for manufacturing operations."""
    
    def __init__(self, manufacturing_service: ManufacturingService | None = None):
        self.service = manufacturing_service or ManufacturingService()

    # ===================================================================
    # BOM Operations
    # ===================================================================

# controllers/manufacturing_controller.py

    def create_bom(
        self,
        finished_item_id: int,
        output_quantity: float,
        components: list[dict],
        bom_name: str | None = None,  # ← Optional, auto-generated
        notes: str | None = None,
    ) -> tuple[bool, str | None]:
        """Create a new Bill of Materials (name auto-generated if not provided)."""
        try:
            self.service.create_bom(
                finished_item_id=finished_item_id,
                bom_name=bom_name,  # ← Pass through (None = auto-generate)
                output_quantity=output_quantity,
                components=components,
                notes=notes,
            )
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error creating BOM")
            return False, "An unexpected error occurred while creating the BOM."
    def get_bom(self, bom_id: int) -> tuple[BillOfMaterials | None, str | None]:
        """Get BOM by ID."""
        try:
            bom = self.service.get_bom(bom_id)
            return bom, None
        except ERPException as exc:
            return None, str(exc)
        except Exception:
            logger.exception("Unexpected error getting BOM")
            return None, "An unexpected error occurred."

    def list_boms(self, active_only: bool | None = True) -> tuple[list[BillOfMaterials], str | None]:
        """List BOMs."""
        try:
            boms = self.service.list_boms(active_only=active_only)
            return boms, None
        except ERPException as exc:
            return [], str(exc)
        except Exception:
            logger.exception("Unexpected error listing BOMs")
            return [], "An unexpected error occurred."

    def update_bom(
        self,
        bom_id: int,
        bom_name: str,
        finished_item_id: int,
        output_quantity: float,
        components: list[dict],
        notes: str | None,
    ) -> tuple[bool, str | None]:
        """Update BOM."""
        try:
            # Get current BOM to preserve is_active
            bom, _ = self.get_bom(bom_id)
            if not bom:
                return False, "BOM not found."
            
            self.service.update_bom(
                bom_id=bom_id,
                bom_name=bom_name,
                output_quantity=output_quantity,
                components=components,
                notes=notes,
                is_active=bom.is_active,
            )
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error updating BOM")
            return False, "An unexpected error occurred."

    def deactivate_bom(self, bom_id: int) -> tuple[bool, str | None]:
        """Deactivate BOM."""
        try:
            self.service.deactivate_bom(bom_id)
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error deactivating BOM")
            return False, "An unexpected error occurred."

    # ===================================================================
    # Production Order Operations
    # ===================================================================

    def create_production_order(
        self,
        order_number: str,
        bom_id: int,
        planned_quantity: float,
        manufacturing_date: str,
        expiry_date: str | None = None,
        notes: str | None = None,
    ) -> tuple[bool, str | None]:
        """Create a new production order."""
        try:
            self.service.create_production_order(
                order_number=order_number,
                bom_id=bom_id,
                planned_quantity=planned_quantity,
                manufacturing_date=manufacturing_date,
                expiry_date=expiry_date,
                notes=notes,
            )
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error creating production order")
            return False, "An unexpected error occurred."

    def get_production_order(self, order_id: int) -> tuple[ProductionOrder | None, str | None]:
        """Get production order by ID."""
        try:
            order = self.service.get_production_order(order_id)
            return order, None
        except ERPException as exc:
            return None, str(exc)
        except Exception:
            logger.exception("Unexpected error getting production order")
            return None, "An unexpected error occurred."

    def list_production_orders(
        self,
        status: str | None = None
    ) -> tuple[list[ProductionOrder], str | None]:
        """List production orders."""
        try:
            orders = self.service.list_production_orders(status=status)
            return orders, None
        except ERPException as exc:
            return [], str(exc)
        except Exception:
            logger.exception("Unexpected error listing production orders")
            return [], "An unexpected error occurred."

    def start_production(self, order_id: int) -> tuple[bool, str | None]:
        """Start production order."""
        try:
            self.service.start_production(order_id)
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error starting production")
            return False, "An unexpected error occurred."

    def complete_production(
        self,
        order_id: int,
        actual_quantity: float,
        wastage_quantity: float = 0,
        output_batch_number: str | None = None,
    ) -> tuple[bool, str | None]:
        """Complete production order."""
        try:
            self.service.complete_production(
                order_id=order_id,
                actual_quantity=actual_quantity,
                wastage_quantity=wastage_quantity,
                output_batch_number=output_batch_number,
            )
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error completing production")
            return False, "An unexpected error occurred."

    def cancel_production_order(self, order_id: int) -> tuple[bool, str | None]:
        """Cancel production order."""
        try:
            self.service.cancel_production_order(order_id)
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error cancelling production order")
            return False, "An unexpected error occurred."

    def delete_production_order(self, order_id: int) -> tuple[bool, str | None]:
        """Delete production order (only DRAFT)."""
        try:
            self.service.delete_production_order(order_id)
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error deleting production order")
            return False, "An unexpected error occurred."