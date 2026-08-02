"""Stock Batch and Stock Transaction repositories"""

from repositories.base_repository import BaseRepository
from models.stock_batch import StockBatch, StockTransaction
from models.enums import TransactionType
from database import db


class StockBatchRepository(BaseRepository[StockBatch]):
    """Repository for StockBatch operations"""
    
    def __init__(self):
        super().__init__(StockBatch, 'stock_batches')
    
    def get_by_item(self, item_id: int, warehouse_id: int = None) -> list[StockBatch]:
        """Get all batches for an item"""
        if warehouse_id:
            return self.get_all(
                "item_id = ? AND warehouse_id = ? AND is_active = ?",
                (item_id, warehouse_id, 1),
                "expiry_date ASC"
            )
        return self.get_all(
            "item_id = ? AND is_active = ?",
            (item_id, 1),
            "expiry_date ASC"
        )
    
    def get_by_warehouse(self, warehouse_id: int) -> list[StockBatch]:
        """Get all batches in a warehouse"""
        return self.get_all(
            "warehouse_id = ? AND is_active = ?",
            (warehouse_id, 1),
            "item_name"
        )
    
    def get_by_batch_number(self, batch_number: str, item_id: int, 
                            warehouse_id: int) -> StockBatch | None:
        """Get batch by batch number"""
        batches = self.get_all(
            "batch_number = ? AND item_id = ? AND warehouse_id = ?",
            (batch_number, item_id, warehouse_id)
        )
        return batches[0] if batches else None
    
    def get_available_batches(self, item_id: int, warehouse_id: int, 
                              min_quantity: float = 0) -> list[StockBatch]:
        """Get batches with sufficient quantity (FIFO order - earliest expiry first)"""
        return self.get_all(
            "item_id = ? AND warehouse_id = ? AND quantity >= ? AND is_active = ?",
            (item_id, warehouse_id, min_quantity, 1),
            "expiry_date ASC"
        )
    
    def get_total_stock(self, item_id: int, warehouse_id: int = None) -> float:
        """Get total stock quantity for an item"""
        if warehouse_id:
            query = """
                SELECT COALESCE(SUM(quantity), 0) as total
                FROM stock_batches
                WHERE item_id = ? AND warehouse_id = ? AND is_active = 1
            """
            result = db.fetch_one(query, (item_id, warehouse_id))
        else:
            query = """
                SELECT COALESCE(SUM(quantity), 0) as total
                FROM stock_batches
                WHERE item_id = ? AND is_active = 1
            """
            result = db.fetch_one(query, (item_id,))
        
        return result['total'] if result else 0
    
    def update_batch_quantity(self, batch_id: int, quantity_change: float) -> bool:
        """Update batch quantity (positive for addition, negative for deduction)"""
        batch = self.get_by_id(batch_id)
        if not batch:
            return False
        
        new_quantity = batch.quantity + quantity_change
        
        if new_quantity < 0:
            raise ValueError(f"Insufficient stock in batch {batch.batch_number}")
        
        db.execute(
            "UPDATE stock_batches SET quantity = ?, value = quantity * rate WHERE id = ?",
            (new_quantity, batch_id)
        )
        
        # Deactivate batch if quantity is zero
        if new_quantity == 0:
            db.execute(
                "UPDATE stock_batches SET is_active = 0 WHERE id = ?",
                (batch_id,)
            )
        
        self._invalidate_cache(batch_id)
        return True
    
    def create_or_update_batch(self, batch: StockBatch) -> int:
        """Create new batch or update existing one"""
        existing = self.get_by_batch_number(
            batch.batch_number, batch.item_id, batch.warehouse_id
        )
        
        if existing:
            existing.quantity += batch.quantity
            existing.value = existing.quantity * existing.rate
            self.update(existing)
            return existing.id
        else:
            batch.value = batch.quantity * batch.rate
            return self.create(batch)


class StockTransactionRepository(BaseRepository[StockTransaction]):
    """Repository for StockTransaction operations"""
    
    def __init__(self):
        super().__init__(StockTransaction, 'stock_transactions')
    
    def get_by_item(self, item_id: int, limit: int = 100) -> list[StockTransaction]:
        """Get recent transactions for an item"""
        return self.get_all(
            "item_id = ?",
            (item_id,),
            "created_at DESC",
            limit
        )
    
    def get_by_warehouse(self, warehouse_id: int, limit: int = 100) -> list[StockTransaction]:
        """Get recent transactions for a warehouse"""
        return self.get_all(
            "warehouse_id = ?",
            (warehouse_id,),
            "created_at DESC",
            limit
        )
    
    def get_by_reference(self, reference_type: str, reference_id: int) -> list[StockTransaction]:
        """Get transactions linked to a specific document"""
        return self.get_all(
            "reference_type = ? AND reference_id = ?",
            (reference_type, reference_id),
            "created_at"
        )
    
    def get_by_date_range(self, company_id: int, start_date: str, 
                          end_date: str) -> list[StockTransaction]:
        """Get transactions within a date range"""
        return self.get_all(
            "company_id = ? AND DATE(created_at) BETWEEN ? AND ?",
            (company_id, start_date, end_date),
            "created_at DESC"
        )
    
    def record_transaction(self, item_id: int, item_name: str, batch_id: int,
                           batch_number: str, warehouse_id: int, warehouse_name: str,
                           transaction_type: TransactionType, quantity: float,
                           rate: float, balance_quantity: float, reference_type: str = None,
                           reference_id: int = None, narration: str = "",
                           company_id: int = 0) -> int:
        """Record a stock transaction"""
        txn = StockTransaction(
            item_id=item_id,
            item_name=item_name,
            batch_id=batch_id,
            batch_number=batch_number,
            warehouse_id=warehouse_id,
            warehouse_name=warehouse_name,
            transaction_type=transaction_type,
            quantity=quantity,
            rate=rate,
            value=quantity * rate,
            balance_quantity=balance_quantity,
            reference_type=reference_type,
            reference_id=reference_id,
            narration=narration,
            company_id=company_id
        )
        return self.create(txn)
    
    def get_stock_summary(self, company_id: int) -> list[dict]:
        """Get stock summary by item"""
        query = """
            SELECT 
                i.id as item_id,
                i.code as item_code,
                i.name as item_name,
                i.unit_name,
                w.id as warehouse_id,
                w.name as warehouse_name,
                SUM(sb.quantity) as total_quantity,
                AVG(sb.rate) as avg_rate,
                SUM(sb.value) as total_value
            FROM items i
            JOIN stock_batches sb ON i.id = sb.item_id AND sb.is_active = 1
            JOIN warehouses w ON sb.warehouse_id = w.id
            WHERE i.company_id = ?
            GROUP BY i.id, w.id
        """
        return db.fetch_all(query, (company_id,))
