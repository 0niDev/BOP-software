"""Account model for Chart of Accounts"""

from dataclasses import dataclass
from typing import Optional
from models.base import BaseModel
from models.enums import AccountType


@dataclass
class Account(BaseModel):
    """Chart of Accounts entity"""
    
    code: str = ""
    name: str = ""
    account_type: AccountType = AccountType.ASSET
    parent_id: Optional[int] = None
    company_id: int = 0
    is_group: bool = False
    is_bank_account: bool = False
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    branch: Optional[str] = None
    currency: str = "INR"
    opening_balance: float = 0.0
    current_balance: float = 0.0
    is_active: bool = True
    description: str = ""
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL,
            name TEXT NOT NULL,
            account_type TEXT NOT NULL,
            parent_id INTEGER,
            company_id INTEGER NOT NULL,
            is_group INTEGER DEFAULT 0,
            is_bank_account INTEGER DEFAULT 0,
            bank_name TEXT,
            bank_account_number TEXT,
            bank_ifsc TEXT,
            branch TEXT,
            currency TEXT DEFAULT 'INR',
            opening_balance REAL DEFAULT 0.0,
            current_balance REAL DEFAULT 0.0,
            is_active INTEGER DEFAULT 1,
            description TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES accounts(id),
            FOREIGN KEY (company_id) REFERENCES companies(id),
            UNIQUE(code, company_id)
        )
        """
    
    def get_normal_balance(self) -> str:
        """Get the normal balance side for this account type"""
        debit_accounts = [AccountType.ASSET, AccountType.EXPENSE]
        if self.account_type in debit_accounts:
            return "DEBIT"
        return "CREDIT"
