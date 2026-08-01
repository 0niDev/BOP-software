"""Production Order domain model."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ProductionOrder:
    """Production Order - actual manufacturing run."""
    order_number: str
    bom_id: int
    planned_quantity: float
    manufacturing_date: str
    company_id: int = 1
    warehouse_id: int = 1
    actual_quantity: float = 0.0
    wastage_quantity: float = 0.0
    output_batch_number: Optional[str] = None
    expiry_date: Optional[str] = None
    production_cost: float = 0.0
    status: str = "DRAFT"  # DRAFT, IN_PROGRESS, COMPLETED, CANCELLED
    notes: Optional[str] = None
    id: Optional[int] = None
    created_by: Optional[int] = None
    created_at: Optional[str] = None
    completed_at: Optional[str] = None
    components: list = field(default_factory=list)

    @staticmethod
    def from_row(row: dict) -> "ProductionOrder":
        """Factory method to create ProductionOrder from DB row."""
        return ProductionOrder(
            id=row["id"],
            company_id=row["company_id"],
            warehouse_id=row["warehouse_id"],
            order_number=row["order_number"],
            bom_id=row["bom_id"],
            planned_quantity=row["planned_quantity"],
            actual_quantity=row["actual_quantity"],
            wastage_quantity=row["wastage_quantity"],
            output_batch_number=row.get("output_batch_number"),
            manufacturing_date=row["manufacturing_date"],
            expiry_date=row.get("expiry_date"),
            production_cost=row["production_cost"],
            status=row["status"],
            notes=row.get("notes"),
            created_by=row.get("created_by"),
            created_at=row.get("created_at"),
            completed_at=row.get("completed_at"),
            components=[],
        )

    def to_dict(self) -> dict:
        """Converts to dict for repository insert."""
        return {
            "company_id": self.company_id,
            "warehouse_id": self.warehouse_id,
            "order_number": self.order_number,
            "bom_id": self.bom_id,
            "planned_quantity": self.planned_quantity,
            "actual_quantity": self.actual_quantity,
            "wastage_quantity": self.wastage_quantity,
            "output_batch_number": self.output_batch_number,
            "manufacturing_date": self.manufacturing_date,
            "expiry_date": self.expiry_date,
            "production_cost": self.production_cost,
            "status": self.status,
            "notes": self.notes,
            "created_by": self.created_by,
        }


@dataclass
class ProductionConsumption:
    """Raw materials consumed during production."""
    production_order_id: int
    component_item_id: int
    batch_id: int
    quantity_consumed: float
    unit_cost: float = 0.0
    id: Optional[int] = None

    @staticmethod
    def from_row(row: dict) -> "ProductionConsumption":
        """Factory method to create ProductionConsumption from DB row."""
        return ProductionConsumption(
            id=row["id"],
            production_order_id=row["production_order_id"],
            component_item_id=row["component_item_id"],
            batch_id=row["batch_id"],
            quantity_consumed=row["quantity_consumed"],
            unit_cost=row["unit_cost"],
        )

    def to_dict(self) -> dict:
        """Converts to dict for repository insert."""
        return {
            "production_order_id": self.production_order_id,
            "component_item_id": self.component_item_id,
            "batch_id": self.batch_id,
            "quantity_consumed": self.quantity_consumed,
            "unit_cost": self.unit_cost,
        }