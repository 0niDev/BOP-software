"""Repository for Sales Invoices - Data access layer."""
from __future__ import annotations

from typing import Optional, List, Dict
from repositories.base_repository import BaseRepository
from utils.exceptions import DuplicateRecordError


class SalesInvoiceRepository(BaseRepository):
    """Repository for sales_invoices table."""
    
    table_name = "sales_invoices"

    def find_by_number(self, invoice_number: str, company_id: int = 1) -> Optional[dict]:
        """Find invoice by invoice number."""
        sql = """
            SELECT * FROM sales_invoices 
            WHERE invoice_number = ? AND company_id = ?
        """
        return self.db.fetch_one(sql, (invoice_number, company_id))

    def number_exists(self, invoice_number: str, company_id: int = 1, exclude_id: Optional[int] = None) -> bool:
        """Check if invoice number already exists."""
        sql = "SELECT id FROM sales_invoices WHERE invoice_number = ? AND company_id = ?"
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
        sql = "SELECT * FROM sales_invoices WHERE company_id = ?"
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
        sql = "SELECT * FROM sales_invoices WHERE id = ?"
        return self.db.fetch_one(sql, (invoice_id,))

    def update(self, invoice_id: int, data: dict) -> bool:
        """Update invoice by ID."""
        return super().update(invoice_id, data)

    def delete(self, invoice_id: int) -> bool:
        """Delete invoice by ID."""
        return super().delete(invoice_id)


class SalesInvoiceItemRepository(BaseRepository):
    """Repository for sales_invoice_items table."""
    
    table_name = "sales_invoice_items"

    def find_by_invoice_id(self, invoice_id: int) -> List[dict]:
        """Find all items for a given invoice with item details."""
        sql = """
            SELECT 
                sii.*,
                i.item_name,
                i.item_code,
                i.unit
            FROM sales_invoice_items sii
            JOIN items i ON i.id = sii.item_id
            WHERE sii.invoice_id = ?
        """
        return self.db.fetch_all(sql, (invoice_id,))

    def find_by_invoice_ids(self, invoice_ids: List[int]) -> Dict[int, List[dict]]:
        """
        Batch fetch items for multiple invoices in a single query.
        Returns a dict mapping invoice_id -> list of items.
        This eliminates N+1 queries when loading multiple invoices.
        """
        if not invoice_ids:
            return {}
        
        placeholders = ','.join('?' * len(invoice_ids))
        sql = f"""
            SELECT 
                sii.*,
                i.item_name,
                i.item_code,
                i.unit
            FROM sales_invoice_items sii
            JOIN items i ON i.id = sii.item_id
            WHERE sii.invoice_id IN ({placeholders})
        """
        rows = self.db.fetch_all(sql, invoice_ids)
        
        # Group by invoice_id
        result: Dict[int, List[dict]] = {}
        for row in rows:
            inv_id = row['invoice_id']
            if inv_id not in result:
                result[inv_id] = []
            result[inv_id].append(row)
        
        return result

    def insert(self, data: dict) -> int:
        """Insert item and return ID."""
        result = super().insert(data)
        # Invalidate parent invoice cache
        if "invoice_id" in data:
            self._invalidate_cache(f"find_by_invoice_id:{data['invoice_id']}")
            self._invalidate_cache("find_by_invoice_ids")
        return result

    def insert_batch(self, items_data: List[dict]) -> List[int]:
        """Insert multiple items in a single batch operation."""
        if not items_data:
            return []
        
        columns = list(items_data[0].keys())
        placeholders = ','.join(['?' for _ in columns])
        column_names = ','.join(columns)
        
        values = [[item[col] for col in columns] for item in items_data]
        
        sql = f"INSERT INTO {self.table_name} ({column_names}) VALUES ({placeholders})"
        self.db.executemany(sql, values)
        
        # Invalidate cache
        invoice_ids = set(item['invoice_id'] for item in items_data if 'invoice_id' in item)
        for inv_id in invoice_ids:
            self._invalidate_cache(f"find_by_invoice_id:{inv_id}")
        self._invalidate_cache("find_by_invoice_ids")
        
        # Get last inserted IDs
        ids = []
        for _ in items_data:
            ids.append(self.db.last_insert_id())
        
        return ids

    def delete_by_invoice_id(self, invoice_id: int) -> None:
        """Delete all items for an invoice."""
        self.db.execute(
            "DELETE FROM sales_invoice_items WHERE invoice_id = ?",
            (invoice_id,)
        )
        self._invalidate_cache(f"find_by_invoice_id:{invoice_id}")
        self._invalidate_cache("find_by_invoice_ids")

    def find_by_id(self, item_id: int) -> dict:
        """Find item by ID."""
        sql = "SELECT * FROM sales_invoice_items WHERE id = ?"
        return self.db.fetch_one(sql, (item_id,))
