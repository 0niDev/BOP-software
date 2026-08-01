"""Bill of Materials (BOM) domain model."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class BillOfMaterials:
    """Bill of Materials - defines what goes into making a finished product."""
    finished_item_id: int
    bom_name: str
    output_quantity: float = 1.0
    notes: Optional[str] = None
    id: Optional[int] = None
    company_id: int = 1
    is_active: bool = True
    created_at: Optional[str] = None
    components: list = field(default_factory=list)

    @staticmethod
    def from_row(row: dict) -> "BillOfMaterials":
        """Factory method to create BOM from DB row."""
        return BillOfMaterials(
            id=row["id"],
            company_id=row["company_id"],
            finished_item_id=row["finished_item_id"],
            bom_name=row["bom_name"],
            output_quantity=row["output_quantity"],
            notes=row.get("notes"),
            is_active=bool(row["is_active"]),
            created_at=row.get("created_at"),
            components=[],
        )

    def to_dict(self) -> dict:
        """Converts to dict for repository insert."""
        return {
            "company_id": self.company_id,
            "finished_item_id": self.finished_item_id,
            "bom_name": self.bom_name,
            "output_quantity": self.output_quantity,
            "notes": self.notes,
            "is_active": int(self.is_active),
        }


@dataclass
class BOMComponent:
    """Component of a Bill of Materials."""
    bom_id: int
    component_item_id: int
    quantity_required: float
    wastage_percent: float = 0.0
    id: Optional[int] = None

    @staticmethod
    def from_row(row: dict) -> "BOMComponent":
        """Factory method to create BOMComponent from DB row."""
        return BOMComponent(
            id=row["id"],
            bom_id=row["bom_id"],
            component_item_id=row["component_item_id"],
            quantity_required=row["quantity_required"],
            wastage_percent=row["wastage_percent"],
        )

    def to_dict(self) -> dict:
        """Converts to dict for repository insert."""
        return {
            "bom_id": self.bom_id,
            "component_item_id": self.component_item_id,
            "quantity_required": self.quantity_required,
            "wastage_percent": self.wastage_percent,
        }