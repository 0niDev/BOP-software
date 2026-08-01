"""Item domain model (products you buy/sell/manufacture)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

@dataclass
class Item:
    item_code: str
    item_name: str
    notes: Optional[str] = None
    unit: str = "UNIT"
    purchase_price: float = 0.0
    selling_price: float = 0.0
    minimum_stock: float = 0.0
    maximum_stock: float = 0.0  # FIXED: was maximum_shift
    tax_rate_id: Optional[int] = None
    item_type: str = "FINISHED_GOOD"
    category_id: Optional[int] = None
    id: Optional[int] = None
    company_id: int = 1
    is_active: bool = True
    created_at: Optional[str] = None

    @staticmethod
    def from_row(row: dict) -> "Item":
        """Factory method to create Item from DB row"""
        return Item(
            id=row["id"],
            company_id=row["company_id"],
            item_code=row["item_code"],
            item_name=row["item_name"],
            notes=row.get("notes"),
            unit=row.get("unit", "UNIT"),
            purchase_price=row["purchase_price"],
            selling_price=row["selling_price"],
            minimum_stock=row["minimum_stock"],
            maximum_stock=row["maximum_stock"],  # FIXED: was maximum_shift
            tax_rate_id=row.get("tax_rate_id"),
            item_type=row.get("item_type", "FINISHED_GOOD"),
            category_id=row.get("category_id"),
            is_active=bool(row["is_active"]),
            created_at=row.get("created_at"),
        )

    def to_dict(self) -> dict:
        """Converts to dict for repository insert"""
        return {
            "company_id": self.company_id,
            "item_code": self.item_code,
            "item_name": self.item_name,
            "notes": self.notes,
            "unit": self.unit,
            "purchase_price": self.purchase_price,
            "selling_price": self.selling_price,
            "minimum_stock": self.minimum_stock,
            "maximum_stock": self.maximum_stock,  # FIXED: was maximum_shift
            "tax_rate_id": self.tax_rate_id,
            "item_type": self.item_type,
            "category_id": self.category_id,
            "is_active": int(self.is_active),
        }
