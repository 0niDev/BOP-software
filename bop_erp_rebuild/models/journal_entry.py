"""Journal Entry models for double-entry accounting"""

from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime
from models.base import BaseModel
from models.enums import VoucherType, DocumentStatus


@dataclass
class JournalEntryLine(BaseModel):
    """Individual line item in a journal entry"""
    
    journal_entry_id: int = 0
    account_id: int = 0
    account_code: str = ""
    account_name: str = ""
    debit: float = 0.0
    credit: float = 0.0
    narration: str = ""
    party_id: Optional[int] = None
    party_name: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS journal_entry_lines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            journal_entry_id INTEGER NOT NULL,
            account_id INTEGER NOT NULL,
            account_code TEXT NOT NULL,
            account_name TEXT NOT NULL,
            debit REAL DEFAULT 0.0,
            credit REAL DEFAULT 0.0,
            narration TEXT,
            party_id INTEGER,
            party_name TEXT,
            reference_type TEXT,
            reference_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id),
            FOREIGN KEY (account_id) REFERENCES accounts(id),
            FOREIGN KEY (party_id) REFERENCES parties(id)
        )
        """


@dataclass
class JournalEntry(BaseModel):
    """Main journal entry header"""
    
    voucher_number: str = ""
    voucher_type: VoucherType = VoucherType.JOURNAL
    date: datetime = field(default_factory=datetime.now)
    company_id: int = 0
    narration: str = ""
    status: DocumentStatus = DocumentStatus.DRAFT
    total_debit: float = 0.0
    total_credit: float = 0.0
    is_posted: bool = False
    posted_at: Optional[datetime] = None
    posted_by: Optional[int] = None
    reference_number: Optional[str] = None
    reference_date: Optional[datetime] = None
    lines: List[JournalEntryLine] = field(default_factory=list)
    
    # Link to source documents
    source_type: Optional[str] = None  # e.g., 'sales_invoice', 'purchase_invoice'
    source_id: Optional[int] = None
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS journal_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            voucher_number TEXT NOT NULL,
            voucher_type TEXT NOT NULL,
            date TEXT NOT NULL,
            company_id INTEGER NOT NULL,
            narration TEXT,
            status TEXT DEFAULT 'Draft',
            total_debit REAL DEFAULT 0.0,
            total_credit REAL DEFAULT 0.0,
            is_posted INTEGER DEFAULT 0,
            posted_at TEXT,
            posted_by INTEGER,
            reference_number TEXT,
            reference_date TEXT,
            source_type TEXT,
            source_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id),
            FOREIGN KEY (posted_by) REFERENCES users(id),
            UNIQUE(voucher_number, company_id)
        )
        """
    
    def is_balanced(self) -> bool:
        """Check if debits equal credits"""
        return abs(self.total_debit - self.total_credit) < 0.01
    
    def add_line(self, account_id: int, account_code: str, account_name: str, 
                 debit: float = 0.0, credit: float = 0.0, narration: str = "",
                 party_id: int = None, party_name: str = None) -> None:
        """Add a line item to the journal entry"""
        line = JournalEntryLine(
            journal_entry_id=self.id or 0,
            account_id=account_id,
            account_code=account_code,
            account_name=account_name,
            debit=debit,
            credit=credit,
            narration=narration,
            party_id=party_id,
            party_name=party_name
        )
        self.lines.append(line)
        self.total_debit += debit
        self.total_credit += credit
