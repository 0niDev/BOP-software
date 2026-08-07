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

    def find_by_invoice_ids(self, invoice_ids: list[int]) -> dict[int, list[dict]]:
        """
        Batch fetch items for multiple invoices in a single query.
        Returns a dict mapping invoice_id -> list of items.
        This eliminates N+1 queries when loading multiple invoices.
        """
        if not invoice_ids:
            return {}
        
        placeholders = ','.join('?' * len(invoice_ids))
        rows = self.db.fetch_all(f"""
            SELECT 
                sii.*,
                i.item_name,
                i.item_code,
                i.unit
            FROM sales_invoice_items sii
            JOIN items i ON i.id = sii.item_id
            WHERE sii.invoice_id IN ({placeholders})
        """, invoice_ids)
        
        # Group by invoice_id
        result = {}
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
            self._invalidate_cache(f"find_by_invoice_ids")  # Also invalidate batch cache
        return result

    def insert_batch(self, items_data: list[dict]) -> list[int]:
        """Insert multiple items in a single batch operation for better performance."""
        if not items_data:
            return []
        
        # Use executemany for true batch insert
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