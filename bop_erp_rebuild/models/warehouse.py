"""Warehouse model for inventory locations"""

from dataclasses import dataclass
from typing import Optional
from models.base import BaseModel


@dataclass
class Warehouse(BaseModel):
    """Warehouse/Storage location entity"""
    
    name: str = ""
    code: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    country: str = "India"
    pincode: str = ""
    phone: str = ""
    email: str = ""
    company_id: int = 0
    is_active: bool = True
    is_default: bool = False
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS warehouses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT NOT NULL,
            address TEXT,
            city TEXT,
            state TEXT,
            country TEXT DEFAULT 'India',
            pincode TEXT,
            phone TEXT,
            email TEXT,
            company_id INTEGER NOT NULL,
            is_active INTEGER DEFAULT 1,
            is_default INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id),
            UNIQUE(code, company_id)
        )
        """
