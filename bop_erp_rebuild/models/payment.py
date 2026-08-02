"""Payment models for customer receipts and supplier payments"""

from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime
from models.base import BaseModel
from models.enums import PaymentMethod, DocumentStatus


@dataclass
class PaymentLine(BaseModel):
    """Individual line item in a payment (for multiple invoices)"""
    
    payment_id: int = 0
    reference_type: str = ""  # 'sales_invoice' or 'purchase_invoice'
    reference_id: int = 0
    invoice_number: str = ""
    invoice_date: Optional[datetime] = None
    invoice_amount: float = 0.0
    amount_paid: float = 0.0
    balance_before: float = 0.0
    balance_after: float = 0.0
    narration: str = ""
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS payment_lines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            payment_id INTEGER NOT NULL,
            reference_type TEXT NOT NULL,
            reference_id INTEGER NOT NULL,
            invoice_number TEXT NOT NULL,
            invoice_date TEXT,
            invoice_amount REAL DEFAULT 0.0,
            amount_paid REAL DEFAULT 0.0,
            balance_before REAL DEFAULT 0.0,
            balance_after REAL DEFAULT 0.0,
            narration TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (payment_id) REFERENCES payments(id),
            FOREIGN KEY (reference_id) REFERENCES sales_invoices(id),
            FOREIGN KEY (reference_id) REFERENCES purchase_invoices(id)
        )
        """


@dataclass
class Payment(BaseModel):
    """Payment header for receipts and payments"""
    
    payment_number: str = ""
    payment_type: str = ""  # 'Receipt' or 'Payment'
    date: datetime = field(default_factory=datetime.now)
    company_id: int = 0
    party_id: int = 0
    party_name: str = ""
    amount: float = 0.0
    payment_method: PaymentMethod = PaymentMethod.CASH
    bank_account_id: Optional[int] = None
    bank_name: Optional[str] = None
    cheque_number: Optional[str] = None
    cheque_date: Optional[datetime] = None
    reference_number: Optional[str] = None
    narration: str = ""
    status: DocumentStatus = DocumentStatus.DRAFT
    is_posted: bool = False
    lines: List[PaymentLine] = field(default_factory=list)
    
    # Accounting links
    journal_entry_id: Optional[int] = None
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            payment_number TEXT NOT NULL,
            payment_type TEXT NOT NULL,
            date TEXT NOT NULL,
            company_id INTEGER NOT NULL,
            party_id INTEGER NOT NULL,
            party_name TEXT NOT NULL,
            amount REAL DEFAULT 0.0,
            payment_method TEXT NOT NULL,
            bank_account_id INTEGER,
            bank_name TEXT,
            cheque_number TEXT,
            cheque_date TEXT,
            reference_number TEXT,
            narration TEXT,
            status TEXT DEFAULT 'Draft',
            is_posted INTEGER DEFAULT 0,
            journal_entry_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id),
            FOREIGN KEY (party_id) REFERENCES parties(id),
            FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id),
            FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id),
            UNIQUE(payment_number, company_id)
        )
        """
    
    def add_line(self, reference_type: str, reference_id: int, invoice_number: str,
                 amount_paid: float, invoice_amount: float = 0.0,
                 balance_before: float = 0.0, balance_after: float = 0.0,
                 invoice_date: datetime = None, narration: str = "") -> None:
        """Add a payment line against an invoice"""
        line = PaymentLine(
            payment_id=self.id or 0,
            reference_type=reference_type,
            reference_id=reference_id,
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            invoice_amount=invoice_amount,
            amount_paid=amount_paid,
            balance_before=balance_before,
            balance_after=balance_after,
            narration=narration
        )
        self.lines.append(line)
    
    def calculate_totals(self) -> None:
        """Recalculate total amount from lines"""
        self.amount = sum(line.amount_paid for line in self.lines)
