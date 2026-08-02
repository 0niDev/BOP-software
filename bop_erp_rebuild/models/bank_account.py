"""BankAccount model for bank account management"""

from dataclasses import dataclass
from typing import Optional
from models.base import BaseModel


@dataclass
class BankAccount(BaseModel):
    """Bank account entity for cash and bank management"""
    
    account_name: str = ""
    account_number: str = ""
    bank_name: str = ""
    branch: str = ""
    ifsc_code: str = ""
    account_type: str = "Current"  # Current, Savings, Cash, etc.
    company_id: int = 0
    currency: str = "INR"
    opening_balance: float = 0.0
    current_balance: float = 0.0
    is_active: bool = True
    is_cash_account: bool = False
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS bank_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_name TEXT NOT NULL,
            account_number TEXT NOT NULL,
            bank_name TEXT NOT NULL,
            branch TEXT,
            ifsc_code TEXT,
            account_type TEXT DEFAULT 'Current',
            company_id INTEGER NOT NULL,
            currency TEXT DEFAULT 'INR',
            opening_balance REAL DEFAULT 0.0,
            current_balance REAL DEFAULT 0.0,
            is_active INTEGER DEFAULT 1,
            is_cash_account INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id),
            UNIQUE(account_number, company_id)
        )
        """
