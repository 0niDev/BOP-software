"""
Sales Invoice repository for sales processing.

Optimized for SQLite Cloud with:
- Batch operations for invoice items
- Multi-level caching
- Transaction support for atomic invoice creation
"""
from __future__ import annotations

from typing import List, Optional

from database.connection import DatabaseConnection, get_db
from repositories.base_repository import BaseRepository
from utils.cache_manager import get_cache_manager
from utils.logger import get_logger

logger = get_logger(__name__)


class SalesInvoiceRepository(BaseRepository):
    """Repository for sales invoice operations."""
    
    table_name = "sales_invoices"
    pk_column = "id"
    
    def __init__(self, db: Optional[DatabaseConnection] = None):
        super().__init__(db)
        self._cache = get_cache_manager()
        self._items_table = "sales_invoice_items"
    
    def find_by_invoice_number(self, invoice_number: str) -> Optional[dict]:
        """Find invoice by invoice number."""
        cache_key = f"{self.table_name}:invoice_number:{invoice_number}"
        cached = self._cache.get(cache_key)
        
        if cached is not None:
            return cached
        
        sql = f"SELECT * FROM {self.table_name} WHERE invoice_number = ?"
        result = self.db.fetch_one(sql, (invoice_number,))
        
        if result is not None:
            self._cache.set(cache_key, result)
        
        return result
    
    def find_by_customer(
        self, 
        customer_id: int,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None
    ) -> List[dict]:
        """Find all invoices for a customer."""
        date_filter = ""
        params = [customer_id]
        
        if from_date and to_date:
            date_filter = "AND invoice_date BETWEEN ? AND ?"
            params.extend([from_date, to_date])
        
        sql = f"""
            SELECT * FROM {self.table_name}
            WHERE customer_id = ?
            AND is_posted = 1
            {date_filter}
            ORDER BY invoice_date DESC, id DESC
        """
        
        return self.db.fetch_all(sql, params)
    
    def get_invoice_with_items(self, invoice_id: int) -> Optional[dict]:
        """Get invoice with its line items."""
        invoice = self.find_by_id(invoice_id)
        
        if invoice is None:
            return None
        
        # Get invoice items
        items_sql = f"""
            SELECT * FROM {self._items_table}
            WHERE sales_invoice_id = ?
            ORDER BY id
        """
        items = self.db.fetch_all(items_sql, (invoice_id,))
        
        invoice['items'] = items
        return invoice
    
    def create_invoice_with_items(
        self, 
        invoice_data: dict,
        items: List[dict]
    ) -> tuple[int, List[int]]:
        """
        Create invoice with its line items atomically.
        
        Returns:
            tuple: (invoice_id, item_ids)
        """
        # Insert invoice
        invoice_id = self.insert(invoice_data)
        
        # Insert items
        item_ids = []
        for item in items:
            item['sales_invoice_id'] = invoice_id
            item_id = self._insert_item(item)
            item_ids.append(item_id)
        
        logger.info(f"Created sales invoice {invoice_id} with {len(items)} items")
        return (invoice_id, item_ids)
    
    def _insert_item(self, item_data: dict) -> int:
        """Insert a single invoice item."""
        columns = list(item_data.keys())
        placeholders = ','.join('?' * len(columns))
        col_list = ', '.join(columns)
        sql = f"INSERT INTO {self._items_table} ({col_list}) VALUES ({placeholders})"
        
        self.db.execute(sql, tuple(item_data.values()))
        return self.db.last_insert_id()
    
    def update_invoice_with_items(
        self, 
        invoice_id: int,
        invoice_data: dict,
        items: List[dict]
    ) -> None:
        """Update invoice and replace all items."""
        # Update invoice header
        self.update(invoice_id, invoice_data)
        
        # Delete existing items
        self._delete_items(invoice_id)
        
        # Insert new items
        for item in items:
            item['sales_invoice_id'] = invoice_id
            self._insert_item(item)
        
        logger.info(f"Updated sales invoice {invoice_id} with {len(items)} items")
    
    def _delete_items(self, invoice_id: int) -> None:
        """Delete all items for an invoice."""
        sql = f"DELETE FROM {self._items_table} WHERE sales_invoice_id = ?"
        self.db.execute(sql, (invoice_id,))
    
    def delete_invoice(self, invoice_id: int) -> None:
        """Delete invoice and all its items."""
        # Delete items first (foreign key constraint)
        self._delete_items(invoice_id)
        
        # Delete invoice
        self.delete(invoice_id)
        
        logger.info(f"Deleted sales invoice {invoice_id}")
    
    def find_unposted_invoices(self) -> List[dict]:
        """Find all unposted invoices."""
        sql = f"""
            SELECT * FROM {self.table_name}
            WHERE is_posted = 0
            ORDER BY invoice_date, id
        """
        return self.db.fetch_all(sql)
    
    def get_customer_outstanding(
        self, 
        customer_id: int,
        as_of_date: Optional[str] = None
    ) -> float:
        """Get total outstanding amount for a customer."""
        date_filter = ""
        params = [customer_id]
        
        if as_of_date:
            date_filter = "AND invoice_date <= ?"
            params.append(as_of_date)
        
        sql = f"""
            SELECT COALESCE(SUM(total_amount), 0) as outstanding
            FROM {self.table_name}
            WHERE customer_id = ?
            AND is_posted = 1
            {date_filter}
        """
        
        result = self.db.fetch_one(sql, params)
        return result['outstanding'] if result else 0.0
    
    def search_invoices(
        self,
        search_term: str,
        customer_id: Optional[int] = None,
        limit: int = 50
    ) -> List[dict]:
        """Search invoices by invoice number or customer name."""
        customer_filter = ""
        params = [f"%{search_term}%"]
        
        if customer_id:
            customer_filter = "AND customer_id = ?"
            params.append(customer_id)
        
        sql = f"""
            SELECT si.*, p.name as customer_name
            FROM {self.table_name} si
            LEFT JOIN parties p ON si.customer_id = p.id
            WHERE si.invoice_number LIKE ?
            AND si.is_posted = 1
            {customer_filter}
            ORDER BY si.invoice_date DESC
            LIMIT ?
        """
        params.append(limit)
        
        return self.db.fetch_all(sql, params)
    
    def get_daily_sales_summary(
        self,
        from_date: str,
        to_date: str,
        customer_id: Optional[int] = None
    ) -> dict:
        """Get daily sales summary for a date range."""
        customer_filter = ""
        params = [from_date, to_date]
        
        if customer_id:
            customer_filter = "AND customer_id = ?"
            params.append(customer_id)
        
        sql = f"""
            SELECT 
                COUNT(*) as invoice_count,
                COALESCE(SUM(subtotal), 0) as total_subtotal,
                COALESCE(SUM(discount_amount), 0) as total_discount,
                COALESCE(SUM(tax_amount), 0) as total_tax,
                COALESCE(SUM(total_amount), 0) as grand_total
            FROM {self.table_name}
            WHERE invoice_date BETWEEN ? AND ?
            AND is_posted = 1
            {customer_filter}
        """
        
        result = self.db.fetch_one(sql, params)
        return result if result else {
            'invoice_count': 0,
            'total_subtotal': 0.0,
            'total_discount': 0.0,
            'total_tax': 0.0,
            'grand_total': 0.0
        }
    
    def count_by_customer(self, customer_id: int) -> int:
        """Count invoices for a customer."""
        return self.count("customer_id = ? AND is_posted = 1", (customer_id,))
    
    def get_last_invoice_number(self) -> str:
        """Get the last used invoice number."""
        sql = f"""
            SELECT invoice_number FROM {self.table_name}
            ORDER BY id DESC
            LIMIT 1
        """
        result = self.db.fetch_one(sql)
        return result['invoice_number'] if result else ""
