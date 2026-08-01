"""Sales Invoice domain models (header and items)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SalesInvoice:
    """Sales invoice header."""
    invoice_number: str
    customer_id: int
    invoice_date: str
    payment_type: str = "CREDIT"
    bank_account_id: int | None = None  # ← ADD THIS
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
    items: list = field(default_factory=list)

    @staticmethod
    def from_row(row: dict) -> "SalesInvoice":
        """Factory method to create SalesInvoice from DB row."""
        return SalesInvoice(
            id=row["id"],
            company_id=row["company_id"],
            warehouse_id=row["warehouse_id"],
            invoice_number=row["invoice_number"],
            customer_id=row["customer_id"],
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
            items=[],
        )

    def to_dict(self) -> dict:
        """Converts to dict for repository insert."""
        return {
            "company_id": self.company_id,
            "warehouse_id": self.warehouse_id,
            "invoice_number": self.invoice_number,
            "customer_id": self.customer_id,
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


@dataclass
class SalesInvoiceItem:
    """Sales invoice line item."""
    invoice_id: int
    item_id: int
    batch_id: int | None = None
    quantity: float = 0.0
    unit_price: float = 0.0
    discount_amount: float = 0.0
    tax_amount: float = 0.0
    line_total: float = 0.0
    id: Optional[int] = None

    @staticmethod
    def from_row(row: dict) -> "SalesInvoiceItem":
        """Factory method to create SalesInvoiceItem from DB row."""
        return SalesInvoiceItem(
            id=row["id"],
            invoice_id=row["invoice_id"],
            item_id=row["item_id"],
            batch_id=row.get("batch_id"),
            quantity=row["quantity"],
            unit_price=row["unit_price"],
            discount_amount=row["discount_amount"],
            tax_amount=row["tax_amount"],
            line_total=row["line_total"],
        )

    def to_dict(self) -> dict:
        """Converts to dict for repository insert."""
        return {
            "invoice_id": self.invoice_id,
            "item_id": self.item_id,
            "batch_id": self.batch_id,
            "quantity": self.quantity,
            "unit_price": self.unit_price,
            "discount_amount": self.discount_amount,
            "tax_amount": self.tax_amount,
            "line_total": self.line_total,
        }