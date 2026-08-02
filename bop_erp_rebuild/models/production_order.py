"""ProductionOrder and ProductionOrderItem models for manufacturing"""

from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime
from models.base import BaseModel
from models.enums import DocumentStatus


@dataclass
class ProductionOrderItem(BaseModel):
    """Raw material consumption or finished goods production in a production order"""
    
    production_order_id: int = 0
    item_id: int = 0
    item_name: str = ""
    item_code: str = ""
    item_type: str = ""  # 'Raw Material' or 'Finished Goods'
    quantity: float = 0.0
    unit_id: int = 0
    unit_name: str = ""
    rate: float = 0.0
    amount: float = 0.0
    batch_id: Optional[int] = None
    batch_number: Optional[str] = None
    warehouse_id: int = 0
    warehouse_name: str = ""
    is_consumed: bool = False  # For raw materials
    is_produced: bool = False  # For finished goods
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS production_order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            production_order_id INTEGER NOT NULL,
            item_id INTEGER NOT NULL,
            item_name TEXT NOT NULL,
            item_code TEXT NOT NULL,
            item_type TEXT NOT NULL,
            quantity REAL DEFAULT 0.0,
            unit_id INTEGER NOT NULL,
            unit_name TEXT,
            rate REAL DEFAULT 0.0,
            amount REAL DEFAULT 0.0,
            batch_id INTEGER,
            batch_number TEXT,
            warehouse_id INTEGER NOT NULL,
            warehouse_name TEXT,
            is_consumed INTEGER DEFAULT 0,
            is_produced INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (production_order_id) REFERENCES production_orders(id),
            FOREIGN KEY (item_id) REFERENCES items(id),
            FOREIGN KEY (unit_id) REFERENCES units(id),
            FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
        )
        """


@dataclass
class ProductionOrder(BaseModel):
    """Production order header for manufacturing"""
    
    order_number: str = ""
    date: datetime = field(default_factory=datetime.now)
    company_id: int = 0
    bom_id: Optional[int] = None
    bom_code: Optional[str] = None
    finished_goods_id: int = 0
    finished_goods_name: str = ""
    target_quantity: float = 0.0
    produced_quantity: float = 0.0
    unit_id: int = 0
    unit_name: str = ""
    warehouse_id: int = 0
    warehouse_name: str = ""
    status: DocumentStatus = DocumentStatus.DRAFT
    planned_start_date: Optional[datetime] = None
    planned_end_date: Optional[datetime] = None
    actual_start_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    total_raw_material_cost: float = 0.0
    total_production_cost: float = 0.0
    cost_per_unit: float = 0.0
    narration: str = ""
    items: List[ProductionOrderItem] = field(default_factory=list)
    
    # Accounting links
    journal_entry_id: Optional[int] = None
    is_posted: bool = False
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS production_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_number TEXT NOT NULL,
            date TEXT NOT NULL,
            company_id INTEGER NOT NULL,
            bom_id INTEGER,
            bom_code TEXT,
            finished_goods_id INTEGER NOT NULL,
            finished_goods_name TEXT NOT NULL,
            target_quantity REAL DEFAULT 0.0,
            produced_quantity REAL DEFAULT 0.0,
            unit_id INTEGER NOT NULL,
            unit_name TEXT,
            warehouse_id INTEGER NOT NULL,
            warehouse_name TEXT,
            status TEXT DEFAULT 'Draft',
            planned_start_date TEXT,
            planned_end_date TEXT,
            actual_start_date TEXT,
            actual_end_date TEXT,
            total_raw_material_cost REAL DEFAULT 0.0,
            total_production_cost REAL DEFAULT 0.0,
            cost_per_unit REAL DEFAULT 0.0,
            narration TEXT,
            journal_entry_id INTEGER,
            is_posted INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id),
            FOREIGN KEY (bom_id) REFERENCES boms(id),
            FOREIGN KEY (finished_goods_id) REFERENCES items(id),
            FOREIGN KEY (unit_id) REFERENCES units(id),
            FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
            FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id),
            UNIQUE(order_number, company_id)
        )
        """
    
    def add_item(self, item_id: int, item_name: str, item_code: str,
                 item_type: str, quantity: float, unit_id: int, unit_name: str,
                 rate: float = 0.0, warehouse_id: int = 0,
                 warehouse_name: str = "", batch_id: int = None,
                 batch_number: str = None) -> None:
        """Add an item (raw material or finished good) to the production order"""
        amount = quantity * rate
        item = ProductionOrderItem(
            production_order_id=self.id or 0,
            item_id=item_id,
            item_name=item_name,
            item_code=item_code,
            item_type=item_type,
            quantity=quantity,
            unit_id=unit_id,
            unit_name=unit_name,
            rate=rate,
            amount=amount,
            batch_id=batch_id,
            batch_number=batch_number,
            warehouse_id=warehouse_id,
            warehouse_name=warehouse_name
        )
        self.items.append(item)
        
        if item_type == "Raw Material":
            self.total_raw_material_cost += amount
    
    def calculate_totals(self) -> None:
        """Recalculate production costs"""
        self.total_raw_material_cost = sum(
            item.amount for item in self.items 
            if item.item_type == "Raw Material"
        )
        self.total_production_cost = self.total_raw_material_cost
        if self.produced_quantity > 0:
            self.cost_per_unit = self.total_production_cost / self.produced_quantity
