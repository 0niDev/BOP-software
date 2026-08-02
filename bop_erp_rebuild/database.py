"""Database connection and schema management for SQLiteCloud"""

import sqlitecloud
from typing import Optional, List, Any, Dict
from contextlib import contextmanager
import logging
from config import SQLITECLOUD_URL, SQLITECLOUD_API_KEY, CACHE_TTL_SECONDS

logger = logging.getLogger(__name__)


class DatabaseConnection:
    """Singleton database connection manager for SQLiteCloud"""
    
    _instance: Optional['DatabaseConnection'] = None
    _connection: Optional[sqlitecloud.connect] = None
    
    def __new__(cls) -> 'DatabaseConnection':
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def connect(self, url: str = None, api_key: str = None) -> None:
        """Establish connection to SQLiteCloud"""
        try:
            conn_url = url or SQLITECLOUD_URL
            if api_key:
                self._connection = sqlitecloud.connect(
                    conn_url,
                    apikey=api_key
                )
            else:
                self._connection = sqlitecloud.connect(conn_url)
            logger.info("Connected to SQLiteCloud successfully")
        except Exception as e:
            logger.error(f"Failed to connect to SQLiteCloud: {e}")
            raise
    
    def disconnect(self) -> None:
        """Close database connection"""
        if self._connection:
            self._connection.close()
            self._connection = None
            logger.info("Disconnected from SQLiteCloud")
    
    @property
    def connection(self) -> sqlitecloud.connect:
        """Get current connection"""
        if self._connection is None:
            self.connect()
        return self._connection
    
    @contextmanager
    def get_cursor(self):
        """Context manager for database cursor"""
        cursor = None
        try:
            cursor = self.connection.cursor()
            yield cursor
        finally:
            if cursor:
                cursor.close()
    
    @contextmanager
    def transaction(self):
        """Context manager for database transactions with automatic commit/rollback"""
        cursor = None
        try:
            cursor = self.connection.cursor()
            cursor.execute("BEGIN TRANSACTION")
            yield cursor
            cursor.execute("COMMIT")
        except Exception as e:
            if cursor:
                cursor.execute("ROLLBACK")
            logger.error(f"Transaction failed: {e}")
            raise
        finally:
            if cursor:
                cursor.close()
    
    def execute(self, query: str, params: tuple = ()) -> int:
        """Execute a query and return rows affected"""
        with self.get_cursor() as cursor:
            cursor.execute(query, params)
            self.connection.commit()
            return cursor.rowcount
    
    def execute_many(self, query: str, params_list: List[tuple]) -> int:
        """Execute a query with multiple parameter sets"""
        with self.get_cursor() as cursor:
            cursor.executemany(query, params_list)
            self.connection.commit()
            return cursor.rowcount
    
    def fetch_one(self, query: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
        """Fetch a single row as dictionary"""
        with self.get_cursor() as cursor:
            cursor.execute(query, params)
            row = cursor.fetchone()
            if row:
                columns = [description[0] for description in cursor.description]
                return dict(zip(columns, row))
            return None
    
    def fetch_all(self, query: str, params: tuple = ()) -> List[Dict[str, Any]]:
        """Fetch all rows as list of dictionaries"""
        with self.get_cursor() as cursor:
            cursor.execute(query, params)
            rows = cursor.fetchall()
            columns = [description[0] for description in cursor.description]
            return [dict(zip(columns, row)) for row in rows]
    
    def fetch_value(self, query: str, params: tuple = ()) -> Any:
        """Fetch a single value from first column of first row"""
        result = self.fetch_one(query, params)
        if result:
            return list(result.values())[0]
        return None
    
    def table_exists(self, table_name: str) -> bool:
        """Check if a table exists"""
        query = """
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name=?
        """
        result = self.fetch_one(query, (table_name,))
        return result is not None
    
    def get_last_insert_id(self) -> int:
        """Get last inserted row ID"""
        return self.fetch_value("SELECT last_insert_rowid()")


# Global database instance
db = DatabaseConnection()


def init_database_schema() -> None:
    """Initialize all database tables"""
    from models.company import Company
    from models.warehouse import Warehouse
    from models.user import User, Role, Permission, RolePermission
    from models.account import Account
    from models.journal_entry import JournalEntry, JournalEntryLine
    from models.party import Party
    from models.item import Item, ItemCategory, Unit
    from models.stock_batch import StockBatch, StockTransaction
    from models.sales_invoice import SalesInvoice, SalesInvoiceLine
    from models.purchase_invoice import PurchaseInvoice, PurchaseInvoiceLine
    from models.payment import Payment, PaymentLine
    from models.bom import BOM, BOMItem
    from models.production_order import ProductionOrder, ProductionOrderItem
    from models.expense import Expense
    from models.bank_account import BankAccount
    
    # Collect all table creation SQL statements
    tables = [
        Company, Warehouse,
        Permission, Role, RolePermission, User,
        Account,
        JournalEntry, JournalEntryLine,
        Party,
        Unit, ItemCategory, Item,
        StockBatch, StockTransaction,
        SalesInvoice, SalesInvoiceLine,
        PurchaseInvoice, PurchaseInvoiceLine,
        Payment, PaymentLine,
        BOM, BOMItem,
        ProductionOrder, ProductionOrderItem,
        Expense,
        BankAccount
    ]
    
    with db.transaction() as cursor:
        for table_class in tables:
            create_sql = table_class.get_create_table_sql()
            cursor.execute(create_sql)
            logger.info(f"Created table: {table_class.__name__}")
    
    logger.info("Database schema initialized successfully")


def seed_default_data(company_id: int = 1) -> None:
    """Seed default data like roles, permissions, and default accounts"""
    
    # Default permissions
    default_permissions = [
        ('View Dashboard', 'view_dashboard', 'Dashboard'),
        ('Create Sales Invoice', 'create_sales', 'Sales'),
        ('View Sales Invoice', 'view_sales', 'Sales'),
        ('Edit Sales Invoice', 'edit_sales', 'Sales'),
        ('Delete Sales Invoice', 'delete_sales', 'Sales'),
        ('Create Purchase Invoice', 'create_purchase', 'Purchase'),
        ('View Purchase Invoice', 'view_purchase', 'Purchase'),
        ('Edit Purchase Invoice', 'edit_purchase', 'Purchase'),
        ('Delete Purchase Invoice', 'delete_purchase', 'Purchase'),
        ('Create Payment', 'create_payment', 'Payment'),
        ('View Payment', 'view_payment', 'Payment'),
        ('Edit Payment', 'edit_payment', 'Payment'),
        ('Delete Payment', 'delete_payment', 'Payment'),
        ('Manage Inventory', 'manage_inventory', 'Inventory'),
        ('View Reports', 'view_reports', 'Reports'),
        ('Manage Users', 'manage_users', 'Admin'),
        ('Manage Roles', 'manage_roles', 'Admin'),
        ('System Settings', 'system_settings', 'Admin'),
    ]
    
    # Insert permissions
    for name, code, module in default_permissions:
        db.execute(
            "INSERT OR IGNORE INTO permissions (name, code, module) VALUES (?, ?, ?)",
            (name, code, module)
        )
    
    # Default roles
    default_roles = [
        ('Administrator', 'admin', 'Full system access', True),
        ('Manager', 'manager', 'Management access', False),
        ('Accountant', 'accountant', 'Accounting and finance access', False),
        ('Sales User', 'sales', 'Sales operations only', False),
        ('Purchase User', 'purchase', 'Purchase operations only', False),
        ('Inventory User', 'inventory', 'Inventory management only', False),
    ]
    
    for name, code, description, is_system in default_roles:
        db.execute(
            "INSERT OR IGNORE INTO roles (name, code, description, company_id, is_system) VALUES (?, ?, ?, ?, ?)",
            (name, code, description, company_id, is_system)
        )
    
    logger.info("Default data seeded successfully")
