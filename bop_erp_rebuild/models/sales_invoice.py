"""Sales Invoice models"""

from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime
from models.base import BaseModel
from models.enums import DocumentStatus


@dataclass
class SalesInvoiceLine(BaseModel):
    """Individual line item in a sales invoice"""
    
    sales_invoice_id: int = 0
    item_id: int = 0
    item_name: str = ""
    item_code: str = ""
    quantity: float = 0.0
    rate: float = 0.0
    amount: float = 0.0
    discount_percent: float = 0.0
    discount_amount: float = 0.0
    tax_rate: float = 0.0
    tax_amount: float = 0.0
    net_amount: float = 0.0
    batch_id: Optional[int] = None
    batch_number: Optional[str] = None
    warehouse_id: int = 0
    warehouse_name: str = ""
    narration: str = ""
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS sales_invoice_lines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sales_invoice_id INTEGER NOT NULL,
            item_id INTEGER NOT NULL,
            item_name TEXT NOT NULL,
            item_code TEXT NOT NULL,
            quantity REAL DEFAULT 0.0,
            rate REAL DEFAULT 0.0,
            amount REAL DEFAULT 0.0,
            discount_percent REAL DEFAULT 0.0,
            discount_amount REAL DEFAULT 0.0,
            tax_rate REAL DEFAULT 0.0,
            tax_amount REAL DEFAULT 0.0,
            net_amount REAL DEFAULT 0.0,
            batch_id INTEGER,
            batch_number TEXT,
            warehouse_id INTEGER NOT NULL,
            warehouse_name TEXT,
            narration TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id),
            FOREIGN KEY (item_id) REFERENCES items(id),
            FOREIGN KEY (batch_id) REFERENCES stock_batches(id),
            FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
        )
        """


@dataclass
class SalesInvoice(BaseModel):
    """Sales invoice header"""
    
    invoice_number: str = ""
    date: datetime = field(default_factory=datetime.now)
    company_id: int = 0
    party_id: int = 0
    party_name: str = ""
    party_address: str = ""
    party_gst: str = ""
    warehouse_id: int = 0
    warehouse_name: str = ""
    status: DocumentStatus = DocumentStatus.DRAFT
    subtotal: float = 0.0
    total_discount: float = 0.0
    total_tax: float = 0.0
    total_amount: float = 0.0
    amount_paid: float = 0.0
    balance_amount: float = 0.0
    narration: str = ""
    shipping_address: str = ""
    shipping_charges: float = 0.0
    round_off: float = 0.0
    due_date: Optional[datetime] = None
    reference_number: Optional[str] = None
    reference_date: Optional[datetime] = None
    lines: List[SalesInvoiceLine] = field(default_factory=list)
    
    # Accounting links
    journal_entry_id: Optional[int] = None
    is_posted: bool = False
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS sales_invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_number TEXT NOT NULL,
            date TEXT NOT NULL,
            company_id INTEGER NOT NULL,
            party_id INTEGER NOT NULL,
            party_name TEXT NOT NULL,
            party_address TEXT,
            party_gst TEXT,
            warehouse_id INTEGER NOT NULL,
            warehouse_name TEXT,
            status TEXT DEFAULT 'Draft',
            subtotal REAL DEFAULT 0.0,
            total_discount REAL DEFAULT 0.0,
            total_tax REAL DEFAULT 0.0,
            total_amount REAL DEFAULT 0.0,
            amount_paid REAL DEFAULT 0.0,
            balance_amount REAL DEFAULT 0.0,
            narration TEXT,
            shipping_address TEXT,
            shipping_charges REAL DEFAULT 0.0,
            round_off REAL DEFAULT 0.0,
            due_date TEXT,
            reference_number TEXT,
            reference_date TEXT,
            journal_entry_id INTEGER,
            is_posted INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id),
            FOREIGN KEY (party_id) REFERENCES parties(id),
            FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
            FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id),
            UNIQUE(invoice_number, company_id)
        )
        """
    
    def add_line(self, item_id: int, item_name: str, item_code: str,
                 quantity: float, rate: float, warehouse_id: int,
                 warehouse_name: str = "", batch_id: int = None,
                 batch_number: str = None, tax_rate: float = 0.0,
                 discount_percent: float = 0.0) -> None:
        """Add a line item to the invoice"""
        amount = quantity * rate
        discount_amount = amount * (discount_percent / 100)
        taxable_amount = amount - discount_amount
        tax_amount = taxable_amount * (tax_rate / 100)
        net_amount = taxable_amount + tax_amount
        
        line = SalesInvoiceLine(
            sales_invoice_id=self.id or 0,
            item_id=item_id,
            item_name=item_name,
            item_code=item_code,
            quantity=quantity,
            rate=rate,
            amount=amount,
            discount_percent=discount_percent,
            discount_amount=discount_amount,
            tax_rate=tax_rate,
            tax_amount=tax_amount,
            net_amount=net_amount,
            batch_id=batch_id,
            batch_number=batch_number,
            warehouse_id=warehouse_id,
            warehouse_name=warehouse_name
        )
        self.lines.append(line)
        
        # Update totals
        self.subtotal += amount
        self.total_discount += discount_amount
        self.total_tax += tax_amount
    
    def calculate_totals(self) -> None:
        """Recalculate all totals"""
        self.subtotal = sum(line.amount for line in self.lines)
        self.total_discount = sum(line.discount_amount for line in self.lines)
        self.total_tax = sum(line.tax_amount for line in self.lines)
        self.total_amount = self.subtotal - self.total_discount + self.total_tax + self.shipping_charges
        self.total_amount += self.round_off
        self.balance_amount = self.total_amount - self.amount_paid
