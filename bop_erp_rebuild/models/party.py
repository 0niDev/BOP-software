"""Party model for customers and suppliers"""

from dataclasses import dataclass
from typing import Optional
from models.base import BaseModel
from models.enums import PartyType


@dataclass
class Party(BaseModel):
    """Customer/Supplier entity"""
    
    name: str = ""
    code: str = ""
    party_type: PartyType = PartyType.CUSTOMER
    company_id: int = 0
    address: str = ""
    city: str = ""
    state: str = ""
    country: str = "India"
    pincode: str = ""
    phone: str = ""
    mobile: str = ""
    email: str = ""
    website: str = ""
    contact_person: str = ""
    gst_number: str = ""
    pan_number: str = ""
    cin_number: str = ""
    opening_balance: float = 0.0
    current_balance: float = 0.0
    credit_limit: float = 0.0
    payment_terms_days: int = 30
    is_active: bool = True
    remarks: str = ""
    
    # Banking details
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    branch: Optional[str] = None
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS parties (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT NOT NULL,
            party_type TEXT NOT NULL,
            company_id INTEGER NOT NULL,
            address TEXT,
            city TEXT,
            state TEXT,
            country TEXT DEFAULT 'India',
            pincode TEXT,
            phone TEXT,
            mobile TEXT,
            email TEXT,
            website TEXT,
            contact_person TEXT,
            gst_number TEXT,
            pan_number TEXT,
            cin_number TEXT,
            opening_balance REAL DEFAULT 0.0,
            current_balance REAL DEFAULT 0.0,
            credit_limit REAL DEFAULT 0.0,
            payment_terms_days INTEGER DEFAULT 30,
            is_active INTEGER DEFAULT 1,
            remarks TEXT,
            bank_name TEXT,
            bank_account_number TEXT,
            bank_ifsc TEXT,
            branch TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id),
            UNIQUE(code, company_id)
        )
        """
    
    def is_customer(self) -> bool:
        """Check if party is a customer"""
        return self.party_type in [PartyType.CUSTOMER, PartyType.BOTH]
    
    def is_supplier(self) -> bool:
        """Check if party is a supplier"""
        return self.party_type in [PartyType.SUPPLIER, PartyType.BOTH]
