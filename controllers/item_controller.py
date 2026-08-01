# controllers/item_controller.py
"""Controller for Items screen - translates service errors to UI messages."""
from __future__ import annotations

from models.item import Item
from services.item_service import ItemService
from utils.exceptions import ERPException
from utils.logger import get_logger

logger = get_logger(__name__)


class ItemController:
    def __init__(self, item_service: ItemService | None = None):
        self.service = item_service or ItemService()

    def create_item(
        self,
        item_name: str,  # ← Changed: item_code is now optional
        notes: str | None,
        unit: str,
        purchase_price: float,
        selling_price: float,
        minimum_stock: float,
        maximum_stock: float,
        tax_rate_id: int | None,
        item_type: str,
        category_id: int | None,
        item_code: str | None = None,  # ← Optional, auto-generated
    ) -> tuple[bool, str | None]:
        """Attempts to create item (code auto-generated if not provided)."""
        try:
            self.service.create_item(
                item_code=item_code,  # ← Pass through (None = auto-generate)
                item_name=item_name,
                notes=notes,
                unit=unit,
                purchase_price=purchase_price,
                selling_price=selling_price,
                minimum_stock=minimum_stock,
                maximum_stock=maximum_stock,
                tax_rate_id=tax_rate_id,
                item_type=item_type,
                category_id=category_id,
            )
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error creating item")
            return False, "An unexpected error occurred while creating the item."

    def update_item(
        self,
        item_id: int,
        item_name: str,
        notes: str | None,
        unit: str,
        purchase_price: float,
        selling_price: float,
        minimum_stock: float,
        maximum_stock: float,
        tax_rate_id: int | None,
        item_type: str,
        category_id: int | None,
        is_active: bool,
    ) -> tuple[bool, str | None]:
        """Attempts to update item"""
        try:
            self.service.update_item(
                item_id=item_id,
                item_name=item_name,
                notes=notes,
                unit=unit,
                purchase_price=purchase_price,
                selling_price=selling_price,
                minimum_stock=minimum_stock,
                maximum_stock=maximum_stock,
                tax_rate_id=tax_rate_id,
                item_type=item_type,
                category_id=category_id,
                is_active=is_active,
            )
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error updating item")
            return False, "An unexpected error occurred while updating the item."

    def deactivate_item(self, item_id: int) -> tuple[bool, str | None]:
        """Attempts to deactivate item"""
        try:
            self.service.deactivate_item(item_id)
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error deactivating item")
            return False, "An unexpected error occurred."

    def list_items(
        self, 
        active_only: bool = True
    ) -> tuple[list[Item], str | None]:
        """Lists items"""
        try:
            return self.service.list_items(active_only=active_only), None
        except ERPException as exc:
            return [], str(exc)
        except Exception:
            logger.exception("Unexpected error listing items")
            return [], "An unexpected error occurred while listing items."

    def get_item(self, item_id: int) -> tuple[Item | None, str | None]:
        """Gets item by ID"""
        try:
            item = self.service.get_item(item_id)
            if item is None:
                return None, "Item not found."
            return item, None
        except ERPException as exc:
            return None, str(exc)
        except Exception:
            logger.exception("Unexpected error getting item")
            return None, "An unexpected error occurred while retrieving the item."

    def get_tax_rates_for_dropdown(
        self, 
        active_only: bool = True
    ) -> tuple[list[dict], str | None]:
        """Get tax rates for dropdowns"""
        try:
            tax_rates = self.service.get_tax_rates(active_only=active_only)
            return tax_rates, None
        except ERPException as exc:
            return [], str(exc)
        except Exception:
            logger.exception("Unexpected error getting tax rates")
            return [], "An unexpected error occurred while loading tax rates"