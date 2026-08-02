"""StockBatch and StockTransaction models for inventory tracking"""

from dataclasses import dataclass, field
from typing import Optional, List
from datetime import datetime
from models.base import BaseModel
from models.enums import TransactionType


@dataclass
class StockBatch(BaseModel):
    """Batch tracking for inventory items"""
    
    item_id: int = 0
    item_name: str = ""
    batch_number: str = ""
    warehouse_id: int = 0
    warehouse_name: str = ""
    quantity: float = 0.0
    rate: float = 0.0
    value: float = 0.0
    manufacturing_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    is_active: bool = True
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS stock_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            item_name TEXT NOT NULL,
            batch_number TEXT NOT NULL,
            warehouse_id INTEGER NOT NULL,
            warehouse_name TEXT,
            quantity REAL DEFAULT 0.0,
            rate REAL DEFAULT 0.0,
            value REAL DEFAULT 0.0,
            manufacturing_date TEXT,
            expiry_date TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES items(id),
            FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
            UNIQUE(batch_number, item_id, warehouse_id)
        )
        """
    
    def is_expired(self) -> bool:
        """Check if batch is expired"""
        if not self.expiry_date:
            return False
        return datetime.now() > self.expiry_date
    
    def days_to_expiry(self) -> Optional[int]:
        """Get days remaining until expiry"""
        if not self.expiry_date:
            return None
        delta = self.expiry_date - datetime.now()
        return delta.days


@dataclass
class StockTransaction(BaseModel):
    """Stock movement transaction log"""
    
    item_id: int = 0
    item_name: str = ""
    batch_id: Optional[int] = None
    batch_number: Optional[str] = None
    warehouse_id: int = 0
    warehouse_name: str = ""
    transaction_type: TransactionType = TransactionType.PURCHASE
    quantity: float = 0.0
    rate: float = 0.0
    value: float = 0.0
    balance_quantity: float = 0.0
    reference_type: Optional[str] = None  # e.g., 'sales_invoice', 'purchase_invoice'
    reference_id: Optional[int] = None
    narration: str = ""
    company_id: int = 0
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS stock_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            item_name TEXT NOT NULL,
            batch_id INTEGER,
            batch_number TEXT,
            warehouse_id INTEGER NOT NULL,
            warehouse_name TEXT,
            transaction_type TEXT NOT NULL,
            quantity REAL DEFAULT 0.0,
            rate REAL DEFAULT 0.0,
            value REAL DEFAULT 0.0,
            balance_quantity REAL DEFAULT 0.0,
            reference_type TEXT,
            reference_id INTEGER,
            narration TEXT,
            company_id INTEGER NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES items(id),
            FOREIGN KEY (batch_id) REFERENCES stock_batches(id),
            FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
        """
    
    @staticmethod
    def get_increasing_types() -> List[TransactionType]:
        """Get transaction types that increase stock"""
        return [
            TransactionType.PURCHASE,
            TransactionType.PRODUCTION_IN,
            TransactionType.RETURN_IN,
            TransactionType.OPENING,
            TransactionType.ADJUSTMENT  # Can be positive or negative
        ]
    
    @staticmethod
    def get_decreasing_types() -> List[TransactionType]:
        """Get transaction types that decrease stock"""
        return [
            TransactionType.SALES,
            TransactionType.PRODUCTION_OUT,
            TransactionType.RETURN_OUT,
            TransactionType.TRANSFER
        ]
    
    def is_stock_increase(self) -> bool:
        """Check if this transaction increases stock"""
        if self.transaction_type == TransactionType.ADJUSTMENT:
            return self.quantity > 0
        return self.transaction_type in self.get_increasing_types()
