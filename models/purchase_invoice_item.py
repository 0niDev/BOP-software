"""Purchase Invoice Item model (line items)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

@dataclass
class PurchaseInvoiceItem:
    invoice_id: int
    item_id: int
    batch_id: Optional[int] = None
    batch_number: Optional[str] = None
    manufacturing_date: Optional[str] = None
    expiry_date: Optional[str] = None
    quantity: float = 0.0
    unit_cost: float = 0.0
    discount_amount: float = 0.0
    tax_amount: float = 0.0
    line_total: float = 0.0
    id: Optional[int] = None

    @staticmethod
    def from_row(row: dict) -> "PurchaseInvoiceItem":
        """Factory method to create PurchaseInvoiceItem from DB row"""
        return PurchaseInvoiceItem(
            id=row["id"],
            invoice_id=row["invoice_id"],
            item_id=row["item_id"],
            batch_id=row.get("batch_id"),
            batch_number=row.get("batch_number"),
            manufacturing_date=row.get("manufacturing_date"),
            expiry_date=row.get("expiry_date"),
            quantity=row["quantity"],
            unit_cost=row["unit_cost"],
            discount_amount=row["discount_amount"],
            tax_amount=row["tax_amount"],
            line_total=row["line_total"],
        )

    def to_dict(self) -> dict:
        """Converts to dict for repository insert"""
        return {
            "invoice_id": self.invoice_id,
            "item_id": self.item_id,
            "batch_id": self.batch_id,
            "batch_number": self.batch_number,
            "manufacturing_date": self.manufacturing_date,
            "expiry_date": self.expiry_date,
            "quantity": self.quantity,
            "unit_cost": self.unit_cost,
            "discount_amount": self.discount_amount,
            "tax_amount": self.tax_amount,
            "line_total": self.line_total,
        }
