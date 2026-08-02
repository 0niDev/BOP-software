"""Expense model for tracking expenses"""

from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime
from models.base import BaseModel


@dataclass
class Expense(BaseModel):
    """Expense entity for tracking operational expenses"""
    
    expense_number: str = ""
    date: datetime = field(default_factory=datetime.now)
    company_id: int = 0
    account_id: int = 0
    account_name: str = ""
    party_id: Optional[int] = None
    party_name: Optional[str] = None
    amount: float = 0.0
    tax_rate: float = 0.0
    tax_amount: float = 0.0
    total_amount: float = 0.0
    payment_method: str = "Cash"
    bank_account_id: Optional[int] = None
    cheque_number: Optional[str] = None
    reference_number: Optional[str] = None
    narration: str = ""
    is_paid: bool = False
    is_posted: bool = False
    
    # Accounting links
    journal_entry_id: Optional[int] = None
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            expense_number TEXT NOT NULL,
            date TEXT NOT NULL,
            company_id INTEGER NOT NULL,
            account_id INTEGER NOT NULL,
            account_name TEXT NOT NULL,
            party_id INTEGER,
            party_name TEXT,
            amount REAL DEFAULT 0.0,
            tax_rate REAL DEFAULT 0.0,
            tax_amount REAL DEFAULT 0.0,
            total_amount REAL DEFAULT 0.0,
            payment_method TEXT DEFAULT 'Cash',
            bank_account_id INTEGER,
            cheque_number TEXT,
            reference_number TEXT,
            narration TEXT,
            is_paid INTEGER DEFAULT 0,
            is_posted INTEGER DEFAULT 0,
            journal_entry_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id),
            FOREIGN KEY (account_id) REFERENCES accounts(id),
            FOREIGN KEY (party_id) REFERENCES parties(id),
            FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id),
            FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id),
            UNIQUE(expense_number, company_id)
        )
        """
    
    def calculate_total(self) -> None:
        """Calculate total amount including tax"""
        self.tax_amount = self.amount * (self.tax_rate / 100)
        self.total_amount = self.amount + self.tax_amount
