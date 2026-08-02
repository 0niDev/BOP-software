"""BOM (Bill of Materials) and BOMItem models for manufacturing"""

from dataclasses import dataclass, field
from typing import List, Optional
from models.base import BaseModel


@dataclass
class BOMItem(BaseModel):
    """Individual component in a Bill of Materials"""
    
    bom_id: int = 0
    item_id: int = 0
    item_name: str = ""
    item_code: str = ""
    quantity: float = 0.0
    unit_id: int = 0
    unit_name: str = ""
    rate: float = 0.0
    amount: float = 0.0
    waste_percent: float = 0.0
    is_active: bool = True
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS bom_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bom_id INTEGER NOT NULL,
            item_id INTEGER NOT NULL,
            item_name TEXT NOT NULL,
            item_code TEXT NOT NULL,
            quantity REAL DEFAULT 0.0,
            unit_id INTEGER NOT NULL,
            unit_name TEXT,
            rate REAL DEFAULT 0.0,
            amount REAL DEFAULT 0.0,
            waste_percent REAL DEFAULT 0.0,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (bom_id) REFERENCES boms(id),
            FOREIGN KEY (item_id) REFERENCES items(id),
            FOREIGN KEY (unit_id) REFERENCES units(id)
        )
        """


@dataclass
class BOM(BaseModel):
    """Bill of Materials header"""
    
    name: str = ""
    code: str = ""
    company_id: int = 0
    finished_goods_id: int = 0
    finished_goods_name: str = ""
    output_quantity: float = 1.0
    output_unit_id: int = 0
    output_unit_name: str = ""
    total_cost: float = 0.0
    is_active: bool = True
    version: int = 1
    remarks: str = ""
    items: List[BOMItem] = field(default_factory=list)
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS boms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT NOT NULL,
            company_id INTEGER NOT NULL,
            finished_goods_id INTEGER NOT NULL,
            finished_goods_name TEXT NOT NULL,
            output_quantity REAL DEFAULT 1.0,
            output_unit_id INTEGER NOT NULL,
            output_unit_name TEXT,
            total_cost REAL DEFAULT 0.0,
            is_active INTEGER DEFAULT 1,
            version INTEGER DEFAULT 1,
            remarks TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id),
            FOREIGN KEY (finished_goods_id) REFERENCES items(id),
            UNIQUE(code, company_id)
        )
        """
    
    def add_item(self, item_id: int, item_name: str, item_code: str,
                 quantity: float, unit_id: int, unit_name: str,
                 rate: float = 0.0, waste_percent: float = 0.0) -> None:
        """Add a component to the BOM"""
        amount = quantity * rate
        item = BOMItem(
            bom_id=self.id or 0,
            item_id=item_id,
            item_name=item_name,
            item_code=item_code,
            quantity=quantity,
            unit_id=unit_id,
            unit_name=unit_name,
            rate=rate,
            amount=amount,
            waste_percent=waste_percent
        )
        self.items.append(item)
        self.total_cost += amount
    
    def calculate_totals(self) -> None:
        """Recalculate total cost"""
        self.total_cost = sum(item.amount for item in self.items)
