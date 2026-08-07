# repositories/purchase_invoice_item_repository.py
"""Data access for Purchase Invoice Items."""
from __future__ import annotations

from repositories.base_repository import BaseRepository


class PurchaseInvoiceItemRepository(BaseRepository):
    table_name = "purchase_invoice_items"

    def find_by_invoice_id(self, invoice_id: int) -> list[dict]:
        """Finds all items for a given invoice with item details."""
        return self.db.fetch_all(
            """
            SELECT 
                pii.*,
                i.item_name,
                i.item_code,
                i.unit
            FROM purchase_invoice_items pii
            JOIN items i ON i.id = pii.item_id
            WHERE pii.invoice_id = ?
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
                pii.*,
                i.item_name,
                i.item_code,
                i.unit
            FROM purchase_invoice_items pii
            JOIN items i ON i.id = pii.item_id
            WHERE pii.invoice_id IN ({placeholders})
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
        if "invoice_id" in data:
            self._invalidate_cache(f"find_by_invoice_id:{data['invoice_id']}")
            self._invalidate_cache("find_by_invoice_ids")
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
        """Delete all items for an invoice"""
        self.db.execute(
            "DELETE FROM purchase_invoice_items WHERE invoice_id = ?",
            (invoice_id,)
        )
        self._invalidate_cache(f"find_by_invoice_id:{invoice_id}")
        self._invalidate_cache("find_by_invoice_ids")