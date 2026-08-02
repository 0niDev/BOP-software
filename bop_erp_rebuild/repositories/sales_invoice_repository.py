"""Sales Invoice repository"""

from repositories.base_repository import BaseRepository
from models.sales_invoice import SalesInvoice, SalesInvoiceLine
from database import db


class SalesInvoiceRepository(BaseRepository[SalesInvoice]):
    """Repository for SalesInvoice operations"""
    
    def __init__(self):
        super().__init__(SalesInvoice, 'sales_invoices')
        self.lines_repo = SalesInvoiceLineRepository()
    
    def get_by_invoice_number(self, invoice_number: str, company_id: int) -> SalesInvoice | None:
        """Get invoice by invoice number"""
        return self.get_all(
            "invoice_number = ? AND company_id = ?",
            (invoice_number, company_id)
        )[0] if self.exists("invoice_number = ? AND company_id = ?", (invoice_number, company_id)) else None
    
    def get_by_company(self, company_id: int) -> list[SalesInvoice]:
        """Get all invoices for a company"""
        return self.get_all("company_id = ?", (company_id,), "date DESC")
    
    def get_by_party(self, party_id: int, company_id: int) -> list[SalesInvoice]:
        """Get all invoices for a customer"""
        return self.get_all(
            "party_id = ? AND company_id = ?",
            (party_id, company_id),
            "date DESC"
        )
    
    def get_unpaid_invoices(self, company_id: int) -> list[SalesInvoice]:
        """Get all unpaid or partially paid invoices"""
        return self.get_all(
            "company_id = ? AND balance_amount > 0",
            (company_id,),
            "date ASC"
        )
    
    def get_by_date_range(self, company_id: int, start_date: str, end_date: str) -> list[SalesInvoice]:
        """Get invoices within a date range"""
        return self.get_all(
            "company_id = ? AND date BETWEEN ? AND ?",
            (company_id, start_date, end_date),
            "date DESC"
        )
    
    def create_with_lines(self, invoice: SalesInvoice) -> int:
        """Create sales invoice with its lines in a transaction"""
        with db.transaction() as cursor:
            # Insert header
            columns = [
                'invoice_number', 'date', 'company_id', 'party_id',
                'party_name', 'party_address', 'party_gst',
                'warehouse_id', 'warehouse_name', 'status',
                'subtotal', 'total_discount', 'total_tax', 'total_amount',
                'amount_paid', 'balance_amount', 'narration',
                'shipping_address', 'shipping_charges', 'round_off',
                'due_date', 'reference_number', 'reference_date'
            ]
            
            values = [
                invoice.invoice_number,
                invoice.date.isoformat() if invoice.date else None,
                invoice.company_id,
                invoice.party_id,
                invoice.party_name,
                invoice.party_address,
                invoice.party_gst,
                invoice.warehouse_id,
                invoice.warehouse_name,
                invoice.status.value,
                invoice.subtotal,
                invoice.total_discount,
                invoice.total_tax,
                invoice.total_amount,
                invoice.amount_paid,
                invoice.balance_amount,
                invoice.narration,
                invoice.shipping_address,
                invoice.shipping_charges,
                invoice.round_off,
                invoice.due_date.isoformat() if invoice.due_date else None,
                invoice.reference_number,
                invoice.reference_date.isoformat() if invoice.reference_date else None
            ]
            
            placeholders = ','.join(['?' for _ in values])
            columns_str = ', '.join(columns)
            
            cursor.execute(
                f"INSERT INTO sales_invoices ({columns_str}) VALUES ({placeholders})",
                tuple(values)
            )
            invoice_id = db.get_last_insert_id()
            invoice.id = invoice_id
            
            # Insert lines
            for line in invoice.lines:
                line.sales_invoice_id = invoice_id
                self.lines_repo.create_with_cursor(cursor, line)
        
        self._invalidate_cache(invoice_id)
        return invoice_id
    
    def update_payment_status(self, invoice_id: int, amount_paid: float) -> bool:
        """Update payment status of an invoice"""
        invoice = self.get_by_id(invoice_id)
        if not invoice:
            return False
        
        new_balance = invoice.total_amount - amount_paid
        
        from models.enums import DocumentStatus
        if new_balance <= 0:
            status = DocumentStatus.PAID.value
            new_balance = 0
        elif amount_paid > 0:
            status = DocumentStatus.PARTIAL.value
        else:
            status = invoice.status.value
        
        db.execute(
            """UPDATE sales_invoices 
               SET amount_paid = ?, balance_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (amount_paid, new_balance, status, invoice_id)
        )
        
        self._invalidate_cache(invoice_id)
        return True
    
    def post_invoice(self, invoice_id: int) -> bool:
        """Mark invoice as posted"""
        from models.enums import DocumentStatus
        db.execute(
            """UPDATE sales_invoices 
               SET status = ?, is_posted = 1, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (DocumentStatus.APPROVED.value, invoice_id)
        )
        self._invalidate_cache(invoice_id)
        return True
    
    def cancel_invoice(self, invoice_id: int) -> bool:
        """Cancel an invoice"""
        from models.enums import DocumentStatus
        db.execute(
            """UPDATE sales_invoices 
               SET status = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (DocumentStatus.CANCELLED.value, invoice_id)
        )
        self._invalidate_cache(invoice_id)
        return True


class SalesInvoiceLineRepository:
    """Repository for SalesInvoiceLine operations"""
    
    def create_with_cursor(self, cursor, line: SalesInvoiceLine) -> int:
        """Create a sales invoice line using provided cursor"""
        cursor.execute(
            """INSERT INTO sales_invoice_lines 
               (sales_invoice_id, item_id, item_name, item_code,
                quantity, rate, amount, discount_percent, discount_amount,
                tax_rate, tax_amount, net_amount, batch_id, batch_number,
                warehouse_id, warehouse_name, narration)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                line.sales_invoice_id,
                line.item_id,
                line.item_name,
                line.item_code,
                line.quantity,
                line.rate,
                line.amount,
                line.discount_percent,
                line.discount_amount,
                line.tax_rate,
                line.tax_amount,
                line.net_amount,
                line.batch_id,
                line.batch_number,
                line.warehouse_id,
                line.warehouse_name,
                line.narration
            )
        )
        return db.get_last_insert_id()
    
    def get_by_invoice(self, sales_invoice_id: int) -> list[SalesInvoiceLine]:
        """Get all lines for an invoice"""
        rows = db.fetch_all(
            "SELECT * FROM sales_invoice_lines WHERE sales_invoice_id = ? ORDER BY id",
            (sales_invoice_id,)
        )
        return [SalesInvoiceLine.from_row(row) for row in rows]
