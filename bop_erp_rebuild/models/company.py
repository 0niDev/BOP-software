"""Company model for multi-company support"""

from dataclasses import dataclass
from typing import Optional
from datetime import datetime
from models.base import BaseModel


@dataclass
class Company(BaseModel):
    """Company entity for multi-tenant support"""
    
    name: str = ""
    code: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    country: str = ""
    pincode: str = ""
    phone: str = ""
    email: str = ""
    website: str = ""
    gst_number: str = ""
    pan_number: str = ""
    cin_number: str = ""
    logo: Optional[bytes] = None
    is_active: bool = True
    
    # Additional fields
    registration_date: Optional[datetime] = None
    financial_year_start: str = "04-01"  # April 1st default
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT UNIQUE NOT NULL,
            address TEXT,
            city TEXT,
            state TEXT,
            country TEXT DEFAULT 'India',
            pincode TEXT,
            phone TEXT,
            email TEXT,
            website TEXT,
            gst_number TEXT,
            pan_number TEXT,
            cin_number TEXT,
            logo BLOB,
            is_active INTEGER DEFAULT 1,
            registration_date TEXT,
            financial_year_start TEXT DEFAULT '04-01',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
