"""Data access for Sales Invoices and items."""
from __future__ import annotations

from repositories.base_repository import BaseRepository
from utils.exceptions import DuplicateRecordError


class SalesInvoiceRepository(BaseRepository):
    """Repository for sales_invoices table."""
    table_name = "sales_invoices"

    def find_by_number(self, invoice_number: str, company_id: int = 1) -> dict | None:
        """Finds invoice by number."""
        return self.db.fetch_one(
            """
            SELECT * FROM sales_invoices 
            WHERE invoice_number = ? AND company_id = ?
            """,
            (invoice_number, company_id),
        )

    def number_exists(self, invoice_number: str, company_id: int = 1, exclude_id: int | None = None) -> bool:
        """Checks if invoice number exists."""
        sql = "SELECT id FROM sales_invoices WHERE invoice_number = ? AND company_id = ?"
        params: tuple = (invoice_number, company_id)
        if exclude_id is not None:
            sql += " AND id != ?"
            params += (exclude_id,)
        return self.db.fetch_one(sql, params) is not None

    def find_all_for_company(
        self, 
        company_id: int = 1, 
        status: str | None = None
    ) -> list[dict]:
        """Gets invoices with optional status filter."""
        sql = "SELECT * FROM sales_invoices WHERE company_id = ?"
        params: list = [company_id]
        
        if status:
            sql += " AND status = ?"
            params.append(status)
            
        sql += " ORDER BY invoice_date DESC"
        return self.db.fetch_all(sql, tuple(params))

    def insert_unique(self, data: dict) -> int:
        """Prevents duplicate invoice numbers."""
        if self.number_exists(
            data["invoice_number"], 
            data.get("company_id", 1)
        ):
            raise DuplicateRecordError(
                f"Invoice number '{data['invoice_number']}' already exists."
            )
        return self.insert(data)


# repositories/sales_invoice_repository.py

class SalesInvoiceItemRepository(BaseRepository):
    table_name = "sales_invoice_items"

    def find_by_invoice_id(self, invoice_id: int) -> list[dict]:
        """Finds all items for a given invoice with item details."""
        return self.db.fetch_all(
            """
            SELECT 
                sii.*,
                i.item_name,
                i.item_code,
                i.unit
            FROM sales_invoice_items sii
            JOIN items i ON i.id = sii.item_id
            WHERE sii.invoice_id = ?
            """,
            (invoice_id,)
        )

    def insert(self, data: dict) -> int:
        """Insert item and return ID."""
        return super().insert(data)

    def delete_by_invoice_id(self, invoice_id: int) -> None:
        """Delete all items for an invoice."""
        self.db.execute(
            "DELETE FROM sales_invoice_items WHERE invoice_id = ?",
            (invoice_id,)
        )