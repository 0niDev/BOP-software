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

    def insert(self, data: dict) -> int:
        """Insert item and return ID."""
        return super().insert(data)

    def delete_by_invoice_id(self, invoice_id: int) -> None:
        """Delete all items for an invoice"""
        self.db.execute(
            "DELETE FROM purchase_invoice_items WHERE invoice_id = ?",
            (invoice_id,)
        )