"""Item, ItemCategory, and Unit models for inventory management"""

from dataclasses import dataclass
from typing import Optional
from models.base import BaseModel
from models.enums import ItemType, UnitType


@dataclass
class Unit(BaseModel):
    """Unit of measurement entity"""
    
    name: str = ""
    code: str = ""
    unit_type: UnitType = UnitType.COUNT
    symbol: str = ""
    company_id: int = 0
    is_base: bool = False
    conversion_factor: float = 1.0
    base_unit_id: Optional[int] = None
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT NOT NULL,
            unit_type TEXT NOT NULL,
            symbol TEXT,
            company_id INTEGER NOT NULL,
            is_base INTEGER DEFAULT 0,
            conversion_factor REAL DEFAULT 1.0,
            base_unit_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id),
            FOREIGN KEY (base_unit_id) REFERENCES units(id),
            UNIQUE(code, company_id)
        )
        """


@dataclass
class ItemCategory(BaseModel):
    """Item category for grouping items"""
    
    name: str = ""
    code: str = ""
    parent_id: Optional[int] = None
    company_id: int = 0
    description: str = ""
    is_active: bool = True
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS item_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT NOT NULL,
            parent_id INTEGER,
            company_id INTEGER NOT NULL,
            description TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES item_categories(id),
            FOREIGN KEY (company_id) REFERENCES companies(id),
            UNIQUE(code, company_id)
        )
        """


@dataclass
class Item(BaseModel):
    """Inventory item entity"""
    
    name: str = ""
    code: str = ""
    item_type: ItemType = ItemType.TRADING
    category_id: Optional[int] = None
    company_id: int = 0
    description: str = ""
    unit_id: int = 0
    unit_name: str = ""
    purchase_rate: float = 0.0
    sales_rate: float = 0.0
    mrp: float = 0.0
    min_stock_level: float = 0.0
    max_stock_level: float = 0.0
    reorder_level: float = 0.0
    is_batched: bool = True
    has_expiry: bool = False
    shelf_life_days: int = 0
    gst_rate: float = 0.0
    hsn_code: str = ""
    sac_code: str = ""
    is_active: bool = True
    remarks: str = ""
    
    # Accounting links
    sales_account_id: Optional[int] = None
    purchase_account_id: Optional[int] = None
    inventory_account_id: Optional[int] = None
    expense_account_id: Optional[int] = None
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT NOT NULL,
            item_type TEXT NOT NULL,
            category_id INTEGER,
            company_id INTEGER NOT NULL,
            description TEXT,
            unit_id INTEGER NOT NULL,
            unit_name TEXT,
            purchase_rate REAL DEFAULT 0.0,
            sales_rate REAL DEFAULT 0.0,
            mrp REAL DEFAULT 0.0,
            min_stock_level REAL DEFAULT 0.0,
            max_stock_level REAL DEFAULT 0.0,
            reorder_level REAL DEFAULT 0.0,
            is_batched INTEGER DEFAULT 1,
            has_expiry INTEGER DEFAULT 0,
            shelf_life_days INTEGER DEFAULT 0,
            gst_rate REAL DEFAULT 0.0,
            hsn_code TEXT,
            sac_code TEXT,
            is_active INTEGER DEFAULT 1,
            remarks TEXT,
            sales_account_id INTEGER,
            purchase_account_id INTEGER,
            inventory_account_id INTEGER,
            expense_account_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES item_categories(id),
            FOREIGN KEY (company_id) REFERENCES companies(id),
            FOREIGN KEY (unit_id) REFERENCES units(id),
            FOREIGN KEY (sales_account_id) REFERENCES accounts(id),
            FOREIGN KEY (purchase_account_id) REFERENCES accounts(id),
            FOREIGN KEY (inventory_account_id) REFERENCES accounts(id),
            FOREIGN KEY (expense_account_id) REFERENCES accounts(id),
            UNIQUE(code, company_id)
        )
        """
    
    def get_stock_value(self, quantity: float, rate: float) -> float:
        """Calculate stock value"""
        return quantity * rate
