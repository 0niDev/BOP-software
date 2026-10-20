"""Repository for Purchase Invoices - Data access layer."""
from __future__ import annotations

from typing import Optional, List
from repositories.base_repository import BaseRepository
from utils.exceptions import DuplicateRecordError


class PurchaseInvoiceRepository(BaseRepository):
    """Repository for purchase_invoices table."""
    
    table_name = "purchase_invoices"

    def find_by_number(self, invoice_number: str, company_id: int = 1) -> Optional[dict]:
        """Find invoice by invoice number."""
        sql = """
            SELECT * FROM purchase_invoices 
            WHERE invoice_number = ? AND company_id = ?
        """
        return self.db.fetch_one(sql, (invoice_number, company_id))

    def number_exists(self, invoice_number: str, company_id: int = 1, exclude_id: Optional[int] = None) -> bool:
        """Check if invoice number already exists."""
        sql = "SELECT id FROM purchase_invoices WHERE invoice_number = ? AND company_id = ?"
        params: list = [invoice_number, company_id]
        
        if exclude_id is not None:
            sql += " AND id != ?"
            params.append(exclude_id)
        
        return self.db.fetch_one(sql, tuple(params)) is not None

    def find_all_for_company(
        self, 
        company_id: int = 1, 
        status: Optional[str] = None
    ) -> List[dict]:
        """Get all invoices for a company with optional status filter."""
        sql = "SELECT * FROM purchase_invoices WHERE company_id = ?"
        params: list = [company_id]
        
        if status:
            sql += " AND status = ?"
            params.append(status)
        
        sql += " ORDER BY invoice_date DESC"
        return self.db.fetch_all(sql, tuple(params))

    def insert_unique(self, data: dict) -> int:
        """Insert invoice, preventing duplicate invoice numbers."""
        invoice_number = data.get("invoice_number")
        company_id = data.get("company_id", 1)
        
        if self.number_exists(invoice_number, company_id):
            raise DuplicateRecordError(
                f"Invoice number '{invoice_number}' already exists."
            )
        
        return self.insert(data)

    def get_by_id(self, invoice_id: int) -> Optional[dict]:
        """Get invoice by ID."""
        sql = "SELECT * FROM purchase_invoices WHERE id = ?"
        return self.db.fetch_one(sql, (invoice_id,))

    def update(self, invoice_id: int, data: dict) -> bool:
        """Update invoice by ID."""
        return super().update(invoice_id, data)

    def delete(self, invoice_id: int) -> bool:
        """Delete invoice by ID."""
        return super().delete(invoice_id)
