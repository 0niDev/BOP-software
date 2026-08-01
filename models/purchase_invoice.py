"""Purchase Invoice model (header)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class PurchaseInvoice:
    invoice_number: str
    supplier_id: int
    invoice_date: str
    payment_type: str = "CREDIT"
    subtotal: float = 0.0
    discount_amount: float = 0.0
    tax_amount: float = 0.0
    total_amount: float = 0.0
    paid_amount: float = 0.0
    status: str = "CONFIRMED"
    notes: Optional[str] = None
    id: Optional[int] = None
    company_id: int = 1
    warehouse_id: int = 1
    created_by: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @staticmethod
    def from_row(row: dict) -> "PurchaseInvoice":
        return PurchaseInvoice(
            id=row["id"],
            company_id=row["company_id"],
            warehouse_id=row["warehouse_id"],
            invoice_number=row["invoice_number"],
            supplier_id=row["supplier_id"],
            invoice_date=row["invoice_date"],
            payment_type=row["payment_type"],
            subtotal=row["subtotal"],
            discount_amount=row["discount_amount"],
            tax_amount=row["tax_amount"],
            total_amount=row["total_amount"],
            paid_amount=row["paid_amount"],
            status=row["status"],
            notes=row.get("notes"),
            created_by=row.get("created_by"),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )

    def to_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "warehouse_id": self.warehouse_id,
            "invoice_number": self.invoice_number,
            "supplier_id": self.supplier_id,
            "invoice_date": self.invoice_date,
            "payment_type": self.payment_type,
            "subtotal": self.subtotal,
            "discount_amount": self.discount_amount,
            "tax_amount": self.tax_amount,
            "total_amount": self.total_amount,
            "paid_amount": self.paid_amount,
            "status": self.status,
            "notes": self.notes,
            "created_by": self.created_by,
        }   