"""BOM, ProductionOrder, Expense, and BankAccount repositories"""

from repositories.base_repository import BaseRepository
from models.bom import BOM, BOMItem
from models.production_order import ProductionOrder, ProductionOrderItem
from models.expense import Expense
from models.bank_account import BankAccount
from database import db


class BOMRepository(BaseRepository[BOM]):
    """Repository for BOM operations"""
    
    def __init__(self):
        super().__init__(BOM, 'boms')
        self.items_repo = BOMItemRepository()
    
    def get_by_code(self, code: str, company_id: int) -> BOM | None:
        """Get BOM by code"""
        return self.get_all("code = ? AND company_id = ?", (code, company_id))[0] \
            if self.exists("code = ? AND company_id = ?", (code, company_id)) else None
    
    def get_by_company(self, company_id: int) -> list[BOM]:
        """Get all BOMs for a company"""
        return self.get_all("company_id = ?", (company_id,), "name")
    
    def get_by_finished_goods(self, finished_goods_id: int) -> list[BOM]:
        """Get all BOMs for a finished good"""
        return self.get_all("finished_goods_id = ?", (finished_goods_id,), "version DESC")
    
    def get_active_boms(self, company_id: int) -> list[BOM]:
        """Get all active BOMs"""
        return self.get_all("company_id = ? AND is_active = ?", (company_id, 1), "name")
    
    def create_with_items(self, bom: BOM) -> int:
        """Create BOM with its items in a transaction"""
        with db.transaction() as cursor:
            columns = ['name', 'code', 'company_id', 'finished_goods_id', 
                       'finished_goods_name', 'output_quantity', 'output_unit_id',
                       'output_unit_name', 'total_cost', 'remarks']
            
            values = [
                bom.name, bom.code, bom.company_id, bom.finished_goods_id,
                bom.finished_goods_name, bom.output_quantity, bom.output_unit_id,
                bom.output_unit_name, bom.total_cost, bom.remarks
            ]
            
            placeholders = ','.join(['?' for _ in values])
            columns_str = ', '.join(columns)
            
            cursor.execute(
                f"INSERT INTO boms ({columns_str}) VALUES ({placeholders})",
                tuple(values)
            )
            bom_id = db.get_last_insert_id()
            bom.id = bom_id
            
            for item in bom.items:
                item.bom_id = bom_id
                self.items_repo.create_with_cursor(cursor, item)
        
        self._invalidate_cache(bom_id)
        return bom_id


class BOMItemRepository:
    """Repository for BOMItem operations"""
    
    def create_with_cursor(self, cursor, item: BOMItem) -> int:
        """Create a BOM item using provided cursor"""
        cursor.execute(
            """INSERT INTO bom_items 
               (bom_id, item_id, item_name, item_code, quantity,
                unit_id, unit_name, rate, amount, waste_percent)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                item.bom_id, item.item_id, item.item_name, item.item_code,
                item.quantity, item.unit_id, item.unit_name, item.rate,
                item.amount, item.waste_percent
            )
        )
        return db.get_last_insert_id()
    
    def get_by_bom(self, bom_id: int) -> list[BOMItem]:
        """Get all items for a BOM"""
        rows = db.fetch_all(
            "SELECT * FROM bom_items WHERE bom_id = ? ORDER BY id",
            (bom_id,)
        )
        return [BOMItem.from_row(row) for row in rows]


class ProductionOrderRepository(BaseRepository[ProductionOrder]):
    """Repository for ProductionOrder operations"""
    
    def __init__(self):
        super().__init__(ProductionOrder, 'production_orders')
        self.items_repo = ProductionOrderItemRepository()
    
    def get_by_order_number(self, order_number: str, company_id: int) -> ProductionOrder | None:
        """Get production order by order number"""
        return self.get_all(
            "order_number = ? AND company_id = ?",
            (order_number, company_id)
        )[0] if self.exists("order_number = ? AND company_id = ?", (order_number, company_id)) else None
    
    def get_by_company(self, company_id: int) -> list[ProductionOrder]:
        """Get all production orders for a company"""
        return self.get_all("company_id = ?", (company_id,), "date DESC")
    
    def get_by_date_range(self, company_id: int, start_date: str, end_date: str) -> list[ProductionOrder]:
        """Get production orders within a date range"""
        return self.get_all(
            "company_id = ? AND date BETWEEN ? AND ?",
            (company_id, start_date, end_date),
            "date DESC"
        )
    
    def create_with_items(self, order: ProductionOrder) -> int:
        """Create production order with its items in a transaction"""
        with db.transaction() as cursor:
            columns = [
                'order_number', 'date', 'company_id', 'bom_id', 'bom_code',
                'finished_goods_id', 'finished_goods_name', 'target_quantity',
                'unit_id', 'unit_name', 'warehouse_id', 'warehouse_name',
                'status', 'narration'
            ]
            
            values = [
                order.order_number,
                order.date.isoformat() if order.date else None,
                order.company_id,
                order.bom_id,
                order.bom_code,
                order.finished_goods_id,
                order.finished_goods_name,
                order.target_quantity,
                order.unit_id,
                order.unit_name,
                order.warehouse_id,
                order.warehouse_name,
                order.status.value,
                order.narration
            ]
            
            placeholders = ','.join(['?' for _ in values])
            columns_str = ', '.join(columns)
            
            cursor.execute(
                f"INSERT INTO production_orders ({columns_str}) VALUES ({placeholders})",
                tuple(values)
            )
            order_id = db.get_last_insert_id()
            order.id = order_id
            
            for item in order.items:
                item.production_order_id = order_id
                self.items_repo.create_with_cursor(cursor, item)
        
        self._invalidate_cache(order_id)
        return order_id


class ProductionOrderItemRepository:
    """Repository for ProductionOrderItem operations"""
    
    def create_with_cursor(self, cursor, item: ProductionOrderItem) -> int:
        """Create a production order item using provided cursor"""
        cursor.execute(
            """INSERT INTO production_order_items 
               (production_order_id, item_id, item_name, item_code, item_type,
                quantity, unit_id, unit_name, rate, amount, warehouse_id,
                warehouse_name, batch_id, batch_number)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                item.production_order_id, item.item_id, item.item_name,
                item.item_code, item.item_type, item.quantity, item.unit_id,
                item.unit_name, item.rate, item.amount, item.warehouse_id,
                item.warehouse_name, item.batch_id, item.batch_number
            )
        )
        return db.get_last_insert_id()
    
    def get_by_order(self, production_order_id: int) -> list[ProductionOrderItem]:
        """Get all items for a production order"""
        rows = db.fetch_all(
            "SELECT * FROM production_order_items WHERE production_order_id = ? ORDER BY id",
            (production_order_id,)
        )
        return [ProductionOrderItem.from_row(row) for row in rows]


class ExpenseRepository(BaseRepository[Expense]):
    """Repository for Expense operations"""
    
    def __init__(self):
        super().__init__(Expense, 'expenses')
    
    def get_by_expense_number(self, expense_number: str, company_id: int) -> Expense | None:
        """Get expense by expense number"""
        return self.get_all(
            "expense_number = ? AND company_id = ?",
            (expense_number, company_id)
        )[0] if self.exists("expense_number = ? AND company_id = ?", (expense_number, company_id)) else None
    
    def get_by_company(self, company_id: int) -> list[Expense]:
        """Get all expenses for a company"""
        return self.get_all("company_id = ?", (company_id,), "date DESC")
    
    def get_by_date_range(self, company_id: int, start_date: str, end_date: str) -> list[Expense]:
        """Get expenses within a date range"""
        return self.get_all(
            "company_id = ? AND date BETWEEN ? AND ?",
            (company_id, start_date, end_date),
            "date DESC"
        )


class BankAccountRepository(BaseRepository[BankAccount]):
    """Repository for BankAccount operations"""
    
    def __init__(self):
        super().__init__(BankAccount, 'bank_accounts')
    
    def get_by_account_number(self, account_number: str, company_id: int) -> BankAccount | None:
        """Get bank account by account number"""
        return self.get_all(
            "account_number = ? AND company_id = ?",
            (account_number, company_id)
        )[0] if self.exists("account_number = ? AND company_id = ?", (account_number, company_id)) else None
    
    def get_by_company(self, company_id: int) -> list[BankAccount]:
        """Get all bank accounts for a company"""
        return self.get_all("company_id = ?", (company_id,), "account_name")
    
    def get_cash_accounts(self, company_id: int) -> list[BankAccount]:
        """Get all cash accounts"""
        return self.get_all("company_id = ? AND is_cash_account = ?", (company_id, 1), "account_name")
    
    def get_active_accounts(self, company_id: int) -> list[BankAccount]:
        """Get all active bank accounts"""
        return self.get_all("company_id = ? AND is_active = ?", (company_id, 1), "account_name")
