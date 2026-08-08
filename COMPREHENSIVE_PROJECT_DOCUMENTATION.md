# COMPREHENSIVE PROJECT DOCUMENTATION
## Pharmaceutical ERP & Accounting System - Complete Technical Reference

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Project Structure](#project-structure)
4. [Database Layer](#database-layer)
5. [Models (Domain Layer)](#models-domain-layer)
6. [Repositories (Data Access Layer)](#repositories-data-access-layer)
7. [Services (Business Logic Layer)](#services-business-logic-layer)
8. [Controllers (Application Layer)](#controllers-application-layer)
9. [Views (Presentation Layer)](#views-presentation-layer)
10. [Reports Module](#reports-module)
11. [Utilities & Helpers](#utilities--helpers)
12. [Configuration](#configuration)
13. [Authentication & Authorization](#authentication--authorization)
14. [Accounting Engine](#accounting-engine)
15. [Data Flow Examples](#data-flow-examples)
16. [API Reference](#api-reference)

---

## EXECUTIVE SUMMARY

This is a complete, professional Enterprise Resource Planning (ERP) system designed specifically for pharmaceutical manufacturing companies. The application follows a multi-layered architecture pattern (MVC-inspired) with clear separation of concerns between data access, business logic, and presentation layers.

### Key Features

- **Complete Double-Entry Accounting**: Automated journal entries for all business transactions
- **Multi-User with Role-Based Access Control (RBAC)**: 6 predefined roles with granular permissions
- **Inventory Management**: Batch tracking, expiry management, stock movements
- **Manufacturing**: Bill of Materials (BOM), Production Orders, consumption tracking
- **Sales & Purchase Invoicing**: Full CRUD with automatic accounting integration
- **Financial Reports**: Trial Balance, Profit & Loss, Balance Sheet, Party Ledger, Cash Book
- **Banking Management**: Bank accounts, cheques, transactions
- **Expense Tracking**: Categorized expenses with accounting integration
- **Backup System**: Automatic and manual database backups
- **Export/Print**: PDF, Excel, CSV export capabilities

### Technology Stack

- **Language**: Python 3.9+
- **GUI Framework**: PySide6 (Qt for Python)
- **Database**: SQLiteCloud (cloud-hosted SQLite) with local SQLite fallback
- **Architecture**: Multi-layered (Repository-Service-Controller-View)
- **Design Patterns**: Repository, Service Layer, Dependency Injection, Singleton, Factory

---

## SYSTEM ARCHITECTURE

### Architectural Pattern

The application follows a **multi-layered architecture** with the following layers from bottom to top:

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  (views/) - PyQt5 GUI, Widgets, Dialogs, Main Window        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                          │
│  (controllers/) - Handle user input, coordinate services    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   BUSINESS LOGIC LAYER                       │
│  (services/) - Business rules, calculations, validations    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   DATA ACCESS LAYER                          │
│  (repositories/) - CRUD operations, SQL queries             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                          │
│  (database/) - Connection management, schema, migrations    │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
User Action → View → Controller → Service → Repository → Database
                ↑                                        ↓
                └────────── Response/Update ─────────────┘
```

### Key Design Principles

1. **Separation of Concerns**: Each layer has a single responsibility
2. **Dependency Injection**: Services receive repository instances; controllers receive services
3. **Single Source of Truth**: Database is the authoritative data source
4. **Soft Deletes**: `is_active` flag preserves historical data integrity
5. **Transaction Management**: Related operations commit/rollback together
6. **Caching**: Two-level caching (L1 instance, L2 session) for performance
7. **Lazy Loading**: UI components load data only when needed

---

## PROJECT STRUCTURE

```
/workspace/
├── main.py                      # Application entry point
├── requirements.txt             # Python dependencies
├── setup.bat                    # Windows setup script
│
├── config/                      # Configuration files
│   ├── app_config.py            # Application settings
│   └── backup_config.py         # Backup configuration
│
├── database/                    # Database layer
│   ├── connection.py            # Database connection manager
│   ├── sqlitecloud_connection.py # Cloud database adapter
│   ├── schema.py                # Complete DDL schema
│   ├── backup.py                # Backup functionality
│   ├── backup_manager.py        # Backup orchestration
│   ├── auto_backup.py           # Scheduled backups
│   └── migrations/              # Database migrations
│       ├── migrator.py          # Migration runner
│       └── add_performance_indexes.py
│
├── models/                      # Domain models (entities)
│   ├── enums.py                 # Shared enumerations
│   ├── user.py                  # User, Role models
│   ├── account.py               # Chart of Accounts
│   ├── party.py                 # Customers/Suppliers
│   ├── item.py                  # Products/Items
│   ├── sales_invoice.py         # Sales documents
│   ├── purchase_invoice.py      # Purchase documents
│   ├── banking.py               # Bank accounts, transactions
│   ├── expense.py               # Expense tracking
│   ├── bill_of_materials.py     # Manufacturing BOM
│   ├── production_order.py      # Production orders
│   └── purchase_invoice_item.py # Purchase line items
│
├── repositories/                # Data access layer
│   ├── base_repository.py       # Generic CRUD operations
│   ├── account_repository.py    # Account data access
│   ├── party_repository.py      # Party data access
│   ├── item_repository.py       # Item data access
│   ├── sales_invoice_repository.py
│   ├── purchase_invoice_repository.py
│   ├── journal_repository.py    # Journal entries
│   ├── banking_repository.py    # Banking data
│   ├── expense_repository.py    # Expense data
│   ├── bom_repository.py        # BOM data
│   ├── production_order_repository.py
│   ├── stock_batch_repository.py
│   ├── tax_rate_repository.py
│   └── user_repository.py       # User authentication
│
├── services/                    # Business logic layer
│   ├── accounting_service.py    # Core double-entry engine
│   ├── account_service.py       # Account management
│   ├── party_service.py         # Party management
│   ├── item_service.py          # Inventory management
│   ├── sales_invoice_service.py # Sales processing
│   ├── purchase_invoice_service.py # Purchase processing
│   ├── manufacturing_service.py # Production processing
│   ├── expense_service.py       # Expense processing
│   ├── payment_service.py       # Payment/receipt processing
│   ├── banking_service.py       # Banking operations
│   ├── dashboard_service.py     # Dashboard KPIs
│   ├── backup_service.py        # Backup operations
│   └── activity_logger.py       # Audit logging
│
├── controllers/                 # Application layer
│   ├── auth_controller.py       # Authentication
│   ├── account_controller.py    # Account UI logic
│   ├── party_controller.py      # Party UI logic
│   ├── item_controller.py       # Item UI logic
│   ├── sales_invoice_controller.py
│   ├── purchase_invoice_controller.py
│   ├── manufacturing_controller.py
│   ├── expense_controller.py
│   ├── payment_controller.py
│   ├── banking_controller.py
│   ├── report_controller.py     # Report generation
│   ├── dashboard_controller.py  # Dashboard logic
│   └── backup_controller.py     # Backup UI logic
│
├── views/                       # Presentation layer
│   ├── main_window.py           # Main application window
│   ├── login_view.py            # Login screen
│   ├── base_view.py             # Base widget class
│   └── widgets/                 # Feature widgets
│       ├── dashboard_view.py
│       ├── chart_of_accounts_widget.py
│       ├── party_view.py
│       ├── item_view.py
│       ├── sales_invoice_view.py
│       ├── purchase_invoice_view.py
│       ├── manufacturing_view.py
│       ├── expense_view.py
│       ├── payment_view.py
│       ├── banking_view.py
│       ├── report_view.py
│       ├── backup_view.py
│       ├── users_view.py
│       ├── asset_view.py
│       └── opening_balance_dialog.py
│
├── reports/                     # Financial reports
│   ├── report_base.py           # Base report class
│   ├── trial_balance_report.py
│   ├── profit_loss_report.py
│   ├── balance_sheet_report.py
│   ├── party_ledger_report.py
│   └── cash_book_report.py
│
├── accounting/                  # Accounting utilities
│   └── system_accounts.py       # System account definitions
│
├── authentication/              # Authentication module
│   └── auth_service.py          # Password hashing, validation
│
├── utils/                       # Utility functions
│   ├── logger.py                # Logging configuration
│   ├── exceptions.py            # Custom exceptions
│   ├── helpers.py               # Helper functions
│   ├── security.py              # Security utilities
│   ├── cache_manager.py         # Caching system
│   ├── event_bus.py             # Event messaging
│   ├── activity_logger.py       # Activity logging
│   ├── report_exporter.py       # Export utilities
│   ├── performance_monitor.py   # Performance tracking
│   └── lazy_loader.py           # Lazy loading utilities
│
└── logs/                        # Application logs
    ├── erp.log
    └── activity_log.txt
```

---

## DATABASE LAYER

### Connection Management

**File**: `database/connection.py`

The database layer provides a unified interface for database operations with support for both local SQLite and cloud-hosted SQLiteCloud.

#### `DatabaseConnection` Class

```python
class DatabaseConnection:
    """
    Unified database connection wrapper.
    
    Provides consistent API for:
    - Query execution (fetch_one, fetch_all)
    - Write operations (execute, executemany)
    - Transaction management (transaction context manager)
    - Last insert ID retrieval
    """
```

**Key Methods**:

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `fetch_one(sql, params)` | sql: str, params: tuple | dict | Fetch single row as dictionary |
| `fetch_all(sql, params)` | sql: str, params: tuple | list[dict] | Fetch all rows as list of dicts |
| `execute(sql, params)` | sql: str, params: tuple | None | Execute write operation |
| `executemany(sql, params_list)` | sql: str, params_list: list[tuple] | None | Batch execute |
| `transaction()` | None | ContextManager | Transaction context manager |
| `last_insert_id()` | None | int | Get last inserted ID |
| `close()` | None | None | Close connection |

**Usage Example**:
```python
from database.connection import get_db

db = get_db()
with db.transaction():
    db.execute("INSERT INTO users (username) VALUES (?)", ("admin",))
    user_id = db.last_insert_id()
```

#### `get_db()` Function

Singleton function that returns the active database connection. Reads connection parameters from environment variables:

- `ERP_DB_ENGINE`: 'sqlite' or 'sqlitecloud'
- `SQLITE_CLOUD_URL`: Connection string for SQLiteCloud

#### `close_db()` Function

Properly closes the database connection on application shutdown.

### SQLiteCloud Adapter

**File**: `database/sqlitecloud_connection.py`

Specialized connection handler for SQLiteCloud hosted databases with connection pooling.

**Key Features**:
- Connection pooling for performance
- Automatic reconnection on network issues
- Thread-safe connection management
- `SQLiteCloudConnection.close_all()` - Close all pooled connections

### Schema Definition

**File**: `database/schema.py`

Complete DDL schema definition with 40+ tables organized in creation order to respect foreign key dependencies.

#### Table Categories

1. **Core Infrastructure**
   - `companies` - Multi-company support (default: id=1)
   - `warehouses` - Multi-warehouse support (default: id=1)

2. **Authentication & Authorization**
   - `roles` - User roles
   - `permissions` - Granular permissions
   - `role_permissions` - Role-permission mapping
   - `users` - User accounts

3. **Chart of Accounts (Double-Entry Core)**
   - `accounts` - Chart of accounts with hierarchy
   - `journal_entries` - Journal entry headers
   - `journal_entry_lines` - Journal entry lines (debit/credit)

4. **Parties (Customers/Suppliers)**
   - `parties` - Unified customer/supplier table
   - Linked to accounts receivable/payable

5. **Inventory**
   - `item_categories` - Item categorization
   - `items` - Product master
   - `stock_batches` - Batch tracking with expiry
   - `stock_movements` - Stock transaction log
   - `stock_losses` - Expiry/damage recording

6. **Sales**
   - `sales_invoices` - Invoice headers
   - `sales_invoice_items` - Line items
   - `sales_returns` - Return headers
   - `sales_return_items` - Return line items

7. **Purchases**
   - `purchase_invoices` - Invoice headers
   - `purchase_invoice_items` - Line items with batch details
   - `purchase_returns` - Return headers
   - `purchase_return_items` - Return line items

8. **Payments & Receipts**
   - `payments` - Payment to suppliers
   - `payment_allocations` - Payment-invoice linking
   - `receipts` - Receipts from customers
   - `receipt_allocations` - Receipt-invoice linking

9. **Manufacturing**
   - `bill_of_materials` - BOM headers
   - `bom_components` - BOM line items
   - `production_orders` - Production job orders
   - `production_consumption` - Material consumption tracking

10. **Banking**
    - `bank_accounts` - Bank account master
    - `cheques` - Cheque tracking
    - `bank_transactions` - Bank transaction log

11. **Expenses**
    - `expense_categories` - Expense categorization
    - `expenses` - Expense records
    - `asset_details` - Fixed asset tracking

12. **Tax**
    - `tax_rates` - Tax rate definitions

13. **Audit & Settings**
    - `audit_log` - User action logging
    - `settings` - Key-value settings store
    - `numbering_sequences` - Document number generation

#### Key Schema Design Decisions

1. **Multi-Tenancy Ready**: Every business table has `company_id` column
2. **Warehouse Support**: Inventory tables include `warehouse_id`
3. **Soft Deletes**: `is_active` flag instead of physical deletes
4. **Audit Trail**: `created_at`, `created_by` on most tables
5. **Foreign Keys**: Referential integrity enforced
6. **Indexes**: Strategic indexes for query performance
7. **Money Storage**: REAL type (documented limitation, handled in service layer)

### Migrations

**File**: `database/migrations/migrator.py`

Idempotent migration system that runs on every application startup.

**Features**:
- Checks migration history table
- Executes pending migrations in order
- Safe to run multiple times
- Logs migration progress

**Usage**:
```python
from database.migrations.migrator import run_migrations
run_migrations(db)
```

### Backup System

**Files**: 
- `database/backup.py` - Core backup logic
- `database/backup_manager.py` - Backup orchestration
- `database/auto_backup.py` - Scheduled backups

**Backup Types**:
1. **Manual Backup**: User-initiated via Backup view
2. **Auto Backup**: Scheduled (default: every 24 hours)
3. **Exit Backup**: Created on application close

**Backup Process**:
1. Create timestamped backup filename
2. Copy database file to backup location
3. Maintain backup rotation (keep last N backups)
4. Log backup success/failure

---

## MODELS (DOMAIN LAYER)

Models are pure Python dataclasses representing business entities. They contain no business logic, only data structure and conversion methods.

### Common Model Patterns

Every model follows these conventions:

1. **Dataclass Decorator**: `@dataclass` for boilerplate reduction
2. **Type Hints**: Full type annotations for IDE support
3. **Default Values**: Sensible defaults for optional fields
4. **`from_row()` Static Method**: Factory method to create instance from DB row
5. **`to_dict()` Method**: Convert to dictionary for repository operations

### Enumerations

**File**: `models/enums.py`

#### `AccountType`
```python
class AccountType(str, Enum):
    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    EQUITY = "EQUITY"
    REVENUE = "REVENUE"
    EXPENSE = "EXPENSE"
```

**Properties**:
- `label`: Human-readable name (e.g., "Asset")
- `normal_balance_is_debit`: Boolean indicating normal balance direction
  - True for: ASSET, EXPENSE
  - False for: LIABILITY, EQUITY, REVENUE

#### `PartyType`
```python
class PartyType(str, Enum):
    CUSTOMER = "CUSTOMER"
    SUPPLIER = "SUPPLIER"
    BOTH = "BOTH"
```

#### `PaymentMethod`
```python
class PaymentMethod(str, Enum):
    CASH = "CASH"
    BANK = "BANK"
    CHEQUE = "CHEQUE"
    CREDIT = "CREDIT"
```

#### `VoucherType`
```python
class VoucherType(str, Enum):
    JOURNAL = "JOURNAL"
    SALES = "SALES"
    SALES_RETURN = "SALES_RETURN"
    PURCHASE = "PURCHASE"
    PURCHASE_RETURN = "PURCHASE_RETURN"
    PAYMENT = "PAYMENT"
    RECEIPT = "RECEIPT"
    MANUFACTURING = "MANUFACTURING"
    STOCK_ADJUSTMENT = "STOCK_ADJUSTMENT"
    OPENING = "OPENING"
```

#### `DocumentStatus`
```python
class DocumentStatus(str, Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
```

### User Models

**File**: `models/user.py`

#### `UserRole` Enum
```python
class UserRole(str, Enum):
    ADMIN = "Admin"
    ACCOUNTANT = "Accountant"
    MANAGER = "Manager"
    STOREKEEPER = "Storekeeper"
    PRODUCTION_MANAGER = "Production Manager"
    VIEWER = "Viewer"
```

**Permissions by Role**:

| Role | Permissions |
|------|-------------|
| ADMIN | All permissions (dashboard, chart_of_accounts, opening_balance, parties, inventory, sales, purchases, manufacturing, expenses, assets, payments, banking, reports, backup, settings, users) |
| ACCOUNTANT | dashboard, chart_of_accounts, parties, inventory, sales, purchases, expenses, payments, banking, reports |
| MANAGER | dashboard, parties, inventory, sales, purchases, manufacturing, expenses, reports |
| STOREKEEPER | dashboard, inventory, purchases, manufacturing |
| PRODUCTION_MANAGER | inventory, manufacturing |
| VIEWER | dashboard, reports |

#### `Role` Dataclass
```python
@dataclass
class Role:
    id: int
    name: str
    description: str | None = None
```

#### `User` Dataclass
```python
@dataclass
class User:
    id: int
    username: str
    full_name: str
    role_id: int
    role_name: str | None = None
    email: str | None = None
    is_active: bool = True
    last_login_at: str | None = None
```

**Methods**:
- `from_row(row: dict) -> User`: Factory method
- `permissions -> list[str]`: Get permissions for user's role
- `can_access(module_key: str) -> bool`: Check module access

### Account Model

**File**: `models/account.py`

```python
@dataclass
class Account:
    account_code: str          # e.g., "1100" for Accounts Receivable
    account_name: str          # e.g., "Accounts Receivable"
    account_type: AccountType  # ASSET, LIABILITY, etc.
    id: int | None = None
    company_id: int = 1
    parent_account_id: int | None = None  # For hierarchy
    account_subtype: str | None = None
    opening_balance: float = 0.0
    current_balance: float = 0.0
    is_system_account: bool = False  # Protected from deletion
    is_active: bool = True
    created_at: str | None = None
```

**Methods**:
- `from_row(row: dict) -> Account`: Factory method
- `to_insert_dict() -> dict`: Convert for INSERT operations

**Account Code Structure**:
- 1xxx: Assets
- 2xxx: Liabilities
- 3xxx: Equity
- 4xxx: Revenue
- 5xxx: Expenses

### Party Model

**File**: `models/party.py`

```python
@dataclass
class Party:
    code: str                  # Unique party code
    name: str                  # Party name
    party_type: PartyType      # CUSTOMER, SUPPLIER, BOTH
    id: Optional[int] = None
    company_id: int = 1
    credit_limit: float = 0.0
    account_id: Optional[int] = None  # Linked A/R or A/P account
    phone: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    is_active: bool = True
    created_at: Optional[str] = None
```

**Methods**:
- `from_row(row: dict) -> Party`: Factory method
- `to_dict() -> dict`: Convert for INSERT/UPDATE

### Item Model

**File**: `models/item.py`

```python
@dataclass
class Item:
    item_code: str             # Unique item code
    item_name: str             # Item name
    notes: Optional[str] = None
    unit: str = "UNIT"         # Unit of measure
    purchase_price: float = 0.0
    selling_price: float = 0.0
    minimum_stock: float = 0.0
    maximum_stock: float = 0.0
    tax_rate_id: Optional[int] = None
    item_type: str = "FINISHED_GOOD"  # RAW_MATERIAL, PACKING_MATERIAL, FINISHED_GOOD
    category_id: Optional[int] = None
    id: Optional[int] = None
    company_id: int = 1
    is_active: bool = True
    created_at: Optional[str] = None
```

**Methods**:
- `from_row(row: dict) -> Item`: Factory method
- `to_dict() -> dict`: Convert for INSERT/UPDATE

### Sales Invoice Models

**File**: `models/sales_invoice.py`

#### `SalesInvoice` (Header)
```python
@dataclass
class SalesInvoice:
    invoice_number: str
    customer_id: int
    invoice_date: str
    payment_type: str = "CREDIT"  # CASH, BANK, CHEQUE, CREDIT
    bank_account_id: int | None = None
    subtotal: float = 0.0
    discount_amount: float = 0.0
    tax_amount: float = 0.0
    total_amount: float = 0.0
    paid_amount: float = 0.0
    status: str = "CONFIRMED"  # DRAFT, CONFIRMED, CANCELLED
    notes: Optional[str] = None
    id: Optional[int] = None
    company_id: int = 1
    warehouse_id: int = 1
    created_by: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    items: list = field(default_factory=list)  # Line items
```

#### `SalesInvoiceItem` (Line Item)
```python
@dataclass
class SalesInvoiceItem:
    invoice_id: int
    item_id: int
    batch_id: int | None = None
    quantity: float = 0.0
    unit_price: float = 0.0
    discount_amount: float = 0.0
    tax_amount: float = 0.0
    line_total: float = 0.0
    id: Optional[int] = None
```

### Purchase Invoice Models

**File**: `models/purchase_invoice.py`

Similar structure to Sales Invoice with supplier-specific fields and batch information on line items.

### Banking Models

**File**: `models/banking.py`

#### `BankAccount`
```python
@dataclass
class BankAccount:
    bank_name: str
    account_title: str
    account_number: str
    account_id: int  # Link to Chart of Accounts
    opening_balance: float = 0.0
    branch_code: str | None = None
    iban: str | None = None
    id: Optional[int] = None
    company_id: int = 1
    is_active: bool = True
    created_at: Optional[str] = None
```

#### `BankTransaction`
```python
@dataclass
class BankTransaction:
    bank_account_id: int
    transaction_type: str  # DEPOSIT, WITHDRAWAL, TRANSFER_IN, TRANSFER_OUT
    amount: float
    transaction_date: str
    reference_no: str | None = None
    notes: str | None = None
    journal_entry_id: int | None = None
    id: Optional[int] = None
```

#### `Cheque`
```python
@dataclass
class Cheque:
    bank_account_id: int
    cheque_number: str
    cheque_type: str  # ISSUED, RECEIVED
    amount: float
    cheque_date: str
    party_id: int | None = None
    status: str = "UNCLEARED"  # UNCLEARED, CLEARED, BOUNCED, LOST
    cleared_date: str | None = None
    notes: str | None = None
```

### Manufacturing Models

**Files**: `models/bill_of_materials.py`, `models/production_order.py`

#### `BillOfMaterials`
```python
@dataclass
class BillOfMaterials:
    finished_item_id: int
    bom_name: str
    output_quantity: float = 1.0
    notes: Optional[str] = None
    id: Optional[int] = None
    is_active: bool = True
    components: list = field(default_factory=list)  # BOM components
```

#### `BOMComponent`
```python
@dataclass
class BOMComponent:
    bom_id: int
    component_item_id: int
    quantity_required: float
    wastage_percent: float = 0.0
    id: Optional[int] = None
```

#### `ProductionOrder`
```python
@dataclass
class ProductionOrder:
    order_number: str
    bom_id: int
    planned_quantity: float
    manufacturing_date: str
    expiry_date: str | None = None
    output_batch_number: str | None = None
    status: str = "DRAFT"  # DRAFT, IN_PROGRESS, COMPLETED, CANCELLED
    actual_quantity: float = 0.0
    wastage_quantity: float = 0.0
    production_cost: float = 0.0
    id: Optional[int] = None
    company_id: int = 1
    warehouse_id: int = 1
    created_by: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    completed_at: Optional[str] = None
```

---

## REPOSITORIES (DATA ACCESS LAYER)

Repositories handle all database interactions, providing a clean API to services without exposing SQL.

### Base Repository

**File**: `repositories/base_repository.py`

Generic repository providing CRUD operations for all entities.

#### `BaseRepository[T]` Class

**Class Attributes**:
- `table_name: str` - Must be overridden by subclasses
- `pk_column: str` - Primary key column name (default: "id")
- `_cache: dict[str, tuple[Any, float]]` - L1 instance cache
- `_cache_ttl: int` - Cache TTL in seconds (default: 30)
- `_cache_enabled: bool` - Enable/disable caching
- `_session_cache: SessionCache` - L2 shared session cache

**Constructor**:
```python
def __init__(self, db: DatabaseConnection | None = None)
```

**Generic CRUD Methods**:

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `find_by_id` | `(record_id: int)` | dict \| None | Find by primary key |
| `get_by_id` | `(record_id: int)` | dict | Find or raise RecordNotFoundError |
| `find_all` | `(active_only=False, order_by=None)` | list[dict] | Get all records |
| `insert` | `(data: dict[str, Any])` | int | Insert new record, return ID |
| `update` | `(record_id: int, data: dict)` | None | Update existing record |
| `delete` | `(record_id: int)` | None | Physical delete |
| `deactivate` | `(record_id: int)` | None | Soft delete (set is_active=0) |
| `exists` | `(record_id: int)` | bool | Check existence |
| `count` | `(where_clause="", params=())` | int | Count matching records |
| `fetch_with_join` | `(join_table, join_condition, ...)` | list[dict] | JOIN query |

**Batch Operations**:
- `_execute_batch_insert(data_list: list[dict]) -> list[int]`
- `_execute_batch_update(updates: list[tuple[int, dict]]) -> int`

**Caching Methods**:
- `_get_cache_key(method, *args) -> str`
- `_get_cached(key: str) -> Any | None`
- `_set_cached(key: str, value: Any)`
- `_invalidate_cache(pattern: str | None = None)`
- `clear_all_cache()`

**Usage Example**:
```python
class AccountRepository(BaseRepository):
    table_name = "accounts"
    
    def find_by_code(self, code: str, company_id: int = 1) -> dict | None:
        return self.db.fetch_one(
            "SELECT * FROM accounts WHERE account_code = ? AND company_id = ?",
            (code, company_id)
        )
```

### Entity Repositories

Each entity has a dedicated repository extending `BaseRepository`.

#### `AccountRepository`
**File**: `repositories/account_repository.py`

**Additional Methods**:
- `find_by_code(code: str, company_id: int) -> dict | None`
- `find_all_for_company(company_id: int) -> list[dict]`
- `get_current_balance(account_id: int) -> float`
- `get_accounts_by_type(account_type: AccountType, company_id: int) -> list[dict]`
- `get_child_accounts(parent_id: int) -> list[dict]`
- `has_transactions(account_id: int) -> bool`

#### `PartyRepository`
**File**: `repositories/party_repository.py`

**Additional Methods**:
- `find_by_code(code: str, company_id: int) -> dict | None`
- `find_all_for_company(company_id: int, party_type: PartyType | None = None) -> list[dict]`
- `get_party_balance(party_id: int) -> float`
- `get_customer_ledger(customer_id: int, from_date: str, to_date: str) -> list[dict]`
- `next_party_code(party_type: PartyType) -> str`

#### `ItemRepository`
**File**: `repositories/item_repository.py`

**Additional Methods**:
- `find_by_code(code: str, company_id: int) -> dict | None`
- `find_all_for_company(company_id: int, item_type: str | None = None) -> list[dict]`
- `get_stock_quantity(item_id: int, warehouse_id: int = 1) -> float`
- `get_batches_by_item(item_id: int, warehouse_id: int) -> list[dict]`
- `get_low_stock_items(company_id: int) -> list[dict]`

#### `JournalRepository`
**File**: `repositories/journal_repository.py`

**Additional Methods**:
- `next_voucher_number(company_id: int, voucher_type: str) -> str`
- `insert_entry(header: dict, lines: list[dict]) -> int`
- `get_entries_by_source(source_table: str, source_id: int) -> list[dict]`
- `get_trial_balance(company_id: int, from_date: str, to_date: str) -> list[dict]`
- `get_account_transactions(account_id: int, from_date: str, to_date: str) -> list[dict]`

#### `SalesInvoiceRepository`
**File**: `repositories/sales_invoice_repository.py`

**Additional Methods**:
- `next_invoice_number(company_id: int) -> str`
- `insert_with_items(invoice: SalesInvoice, items: list[SalesInvoiceItem]) -> int`
- `get_invoice_with_items(invoice_id: int) -> dict`
- `get_customer_invoices(customer_id: int, status: str | None = None) -> list[dict]`
- `update_status(invoice_id: int, status: str) -> None`

#### `PurchaseInvoiceRepository`
**File**: `repositories/purchase_invoice_repository.py`

Similar to SalesInvoiceRepository with supplier-specific queries.

#### `BankingRepository`
**File**: `repositories/banking_repository.py`

**Additional Methods**:
- `get_bank_balance(bank_account_id: int) -> float`
- `get_cheques_by_status(status: str) -> list[dict]`
- `update_cheque_status(cheque_id: int, status: str) -> None`

#### `ProductionOrderRepository`
**File**: `repositories/production_order_repository.py`

**Additional Methods**:
- `next_order_number(company_id: int) -> str`
- `get_pending_orders() -> list[dict]`
- `update_status(order_id: int, status: str, actual_quantity: float) -> None`

### Repository Best Practices

1. **Always use parameterized queries** to prevent SQL injection
2. **Return dictionaries**, not model objects (conversion happens in service layer)
3. **Use transactions** for multi-step operations (called from service layer)
4. **Leverage caching** for frequently accessed, rarely changed data
5. **Keep SQL simple**; complex logic belongs in service layer
6. **Log errors** with context (table name, operation, parameters)

---

## SERVICES (BUSINESS LOGIC LAYER)

Services encapsulate business rules, calculations, and orchestration between repositories.

### Accounting Service (Core Engine)

**File**: `services/accounting_service.py`

The heart of the double-entry accounting system. All monetary transactions flow through this service.

#### `JournalLine` Dataclass
```python
@dataclass
class JournalLine:
    account_id: int
    debit: float = 0.0
    credit: float = 0.0
    party_id: int | None = None
    description: str | None = None
```

**Validation**:
- Cannot have both debit and credit on same line
- Amounts cannot be negative

#### `AccountingService` Class

**Constructor**:
```python
def __init__(self, db: DatabaseConnection | None = None)
```

**Key Method**: `post_journal_entry()`

```python
def post_journal_entry(
    *,
    voucher_type: VoucherType,
    entry_date: str,
    lines: list[JournalLine],
    narration: str | None = None,
    reference_no: str | None = None,
    source_table: str | None = None,
    source_id: int | None = None,
    created_by: int | None = None,
    company_id: int = 1,
    voucher_number: str | None = None,
) -> int:
    """
    Validates and writes one balanced journal entry.
    
    Validations:
    1. At least two lines required
    2. Total debit must equal total credit (within 0.01 tolerance)
    3. Each line has either debit OR credit, not both
    
    Returns: journal_entries.id
    """
```

**Process Flow**:
1. Validate line count (minimum 2)
2. Calculate total debit and credit
3. Verify balance (difference ≤ 0.01)
4. Generate voucher number if not provided
5. Build header dictionary
6. Build line dictionaries
7. Call `JournalRepository.insert_entry()`
8. Log successful posting

**Other Methods**:
- `get_account_balance(account_id: int) -> float`
- `get_trial_balance(company_id: int) -> list[dict]`

**Usage Example**:
```python
from services.accounting_service import AccountingService, JournalLine
from models.enums import VoucherType

accounting = AccountingService(db)
lines = [
    JournalLine(account_id=1100, debit=1000.00, party_id=customer_id),  # A/R
    JournalLine(account_id=4000, credit=1000.00),  # Sales Revenue
]
entry_id = accounting.post_journal_entry(
    voucher_type=VoucherType.SALES,
    entry_date="2024-01-15",
    lines=lines,
    narration="Sale to Customer XYZ",
    source_table="sales_invoices",
    source_id=invoice_id,
    created_by=user_id
)
```

### Sales Invoice Service

**File**: `services/sales_invoice_service.py`

Handles complete sales invoice lifecycle with automatic accounting.

#### `SalesInvoiceService` Class

**Key Methods**:

1. **`create_invoice(invoice_data, items_data, user_id)`**
   
   Process:
   - Validate customer exists and is active
   - Validate items exist and have sufficient stock
   - Calculate totals (subtotal, discount, tax, total)
   - Begin transaction
   - Insert invoice header
   - Insert invoice items
   - Create journal entry:
     - Debit: Accounts Receivable (or Cash/Bank)
     - Credit: Sales Revenue
     - Credit: Tax Payable (if applicable)
   - Reduce stock batches (FIFO/expiry-based)
   - Create stock movement records
   - Commit transaction
   
2. **`confirm_invoice(invoice_id, user_id)`**
   - Change status from DRAFT to CONFIRMED
   - Post accounting entries
   - Update stock

3. **`cancel_invoice(invoice_id, user_id)`**
   - Change status to CANCELLED
   - Reverse accounting entries
   - Restore stock

4. **`get_customer_outstanding(customer_id: int) -> float`**
   - Sum of unpaid invoices

5. **`check_credit_limit(customer_id: float, new_amount: float) -> bool`**
   - Verify customer won't exceed credit limit

### Purchase Invoice Service

**File**: `services/purchase_invoice_service.py`

Mirrors Sales Invoice Service with supplier-side logic.

**Key Differences**:
- Debit: Inventory/Expense Account
- Credit: Accounts Payable (or Cash/Bank)
- Increases stock
- Creates/updates stock batches with batch numbers, expiry dates

### Manufacturing Service

**File**: `services/manufacturing_service.py`

Handles production orders and material consumption.

#### Key Processes:

1. **Create Production Order**
   - Validate BOM exists
   - Check raw material availability
   - Reserve materials

2. **Consume Materials**
   - Deduct from stock batches
   - Record in `production_consumption` table
   - Create stock movements (PRODUCTION_CONSUME)

3. **Complete Production**
   - Create finished goods batch
   - Add to stock
   - Calculate production cost
   - Post journal entry:
     - Debit: Finished Goods Inventory
     - Credit: Work in Progress / Raw Materials

### Payment Service

**File**: `services/payment_service.py`

Handles payments to suppliers and receipts from customers.

#### Payment Process:
1. Validate party and amount
2. Allocate to outstanding invoices (oldest first)
3. Create payment record
4. Post journal entry:
   - Debit: Accounts Payable
   - Credit: Cash/Bank

#### Receipt Process:
1. Validate customer and amount
2. Allocate to outstanding invoices
3. Create receipt record
4. Post journal entry:
   - Debit: Cash/Bank
   - Credit: Accounts Receivable

### Banking Service

**File**: `services/banking_service.py`

Manages bank accounts, cheques, and transactions.

**Key Methods**:
- `create_bank_account(account_data)`
- `record_deposit(transaction_data)`
- `record_withdrawal(transaction_data)`
- `update_cheque_status(cheque_id, status)`
- `get_bank_reconciliation(bank_account_id, date)`

### Expense Service

**File**: `services/expense_service.py`

Tracks operational expenses.

**Process**:
1. Validate expense category
2. Create expense record
3. Post journal entry:
   - Debit: Expense Account
   - Credit: Cash/Bank/Payable

### Dashboard Service

**File**: `services/dashboard_service.py`

Aggregates KPIs for the dashboard view.

**KPIs Calculated**:
- Total Receivables
- Total Payables
- Cash in Hand
- Bank Balance
- Today's Sales
- Today's Purchases
- Low Stock Items
- Pending Production Orders

### Backup Service

**File**: `services/backup_service.py`

Orchestrates backup operations.

**Methods**:
- `create_backup()` - Manual backup
- `schedule_auto_backup(interval_hours: int)`
- `get_backup_history()` - List of backups
- `restore_from_backup(backup_file: str)`

### Activity Logger

**File**: `services/activity_logger.py`

Logs user actions for audit trail.

**Logged Actions**:
- Login/Logout
- Create/Update/Delete operations
- Document confirmations/cancellations
- Backup operations

---

## CONTROLLERS (APPLICATION LAYER)

Controllers bridge the gap between UI and business logic, handling user input and coordinating service calls.

### Common Controller Pattern

Each controller follows this structure:

```python
class EntityController:
    def __init__(self, service: EntityService):
        self.service = service
    
    def handle_action(self, action: str, data: dict) -> dict:
        """Route user action to appropriate service method."""
        try:
            if action == "create":
                result = self.service.create(data)
                return {"success": True, "data": result}
            elif action == "update":
                result = self.service.update(data["id"], data)
                return {"success": True, "data": result}
            # ... more actions
        except ValidationError as e:
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.exception("Error in %s", action)
            return {"success": False, "error": "An unexpected error occurred"}
```

### Auth Controller

**File**: `controllers/auth_controller.py`

Handles user authentication.

**Methods**:
- `login(username: str, password: str) -> User | None`
- `logout(user: User) -> None`
- `validate_session(user_id: int) -> bool`
- `change_password(user_id: int, old_password: str, new_password: str) -> bool`

**Flow**:
1. Receive credentials from LoginView
2. Call `AuthService.authenticate()`
3. On success, return User object
4. On failure, return error message

### Account Controller

**File**: `controllers/account_controller.py`

Manages Chart of Accounts operations.

**Methods**:
- `get_accounts()` - Get all accounts
- `create_account(data: dict) -> int`
- `update_account(id: int, data: dict) -> None`
- `delete_account(id: int) -> bool`
- `get_account_tree()` - Hierarchical view
- `set_opening_balance(account_id: int, balance: float) -> None`

### Party Controller

**File**: `controllers/party_controller.py`

**Methods**:
- `get_parties(party_type: PartyType | None = None) -> list[dict]`
- `create_party(data: dict) -> int`
- `update_party(id: int, data: dict) -> None`
- `deactivate_party(id: int) -> None`
- `get_party_balance(id: int) -> float`
- `get_party_ledger(id: int, from_date: str, to_date: str) -> list[dict]`

### Item Controller

**File**: `controllers/item_controller.py`

**Methods**:
- `get_items(item_type: str | None = None) -> list[dict]`
- `create_item(data: dict) -> int`
- `update_item(id: int, data: dict) -> None`
- `get_stock_levels() -> list[dict]`
- `get_low_stock_alerts() -> list[dict]`

### Sales Invoice Controller

**File**: `controllers/sales_invoice_controller.py`

**Methods**:
- `get_invoices(customer_id: int | None = None) -> list[dict]`
- `create_invoice(invoice_data: dict, items: list[dict]) -> int`
- `update_invoice(id: int, invoice_data: dict, items: list[dict]) -> None`
- `confirm_invoice(id: int) -> None`
- `cancel_invoice(id: int) -> None`
- `print_invoice(id: int) -> bytes`
- `export_invoice(id: int, format: str) -> bytes`

### Purchase Invoice Controller

**File**: `controllers/purchase_invoice_controller.py`

Similar to Sales Invoice Controller with supplier-side operations.

### Manufacturing Controller

**File**: `controllers/manufacturing_controller.py`

**Methods**:
- `get_boms() -> list[dict]`
- `create_bom(data: dict) -> int`
- `get_production_orders(status: str | None = None) -> list[dict]`
- `create_production_order(data: dict) -> int`
- `consume_materials(order_id: int, consumptions: list[dict]) -> None`
- `complete_production(order_id: int, actual_quantity: float) -> None`

### Payment Controller

**File**: `controllers/payment_controller.py`

**Methods**:
- `make_payment(data: dict, allocations: list[dict]) -> int`
- `receive_payment(data: dict, allocations: list[dict]) -> int`
- `get_unpaid_invoices(party_id: int) -> list[dict]`

### Banking Controller

**File**: `controllers/banking_controller.py`

**Methods**:
- `get_bank_accounts() -> list[dict]`
- `create_bank_account(data: dict) -> int`
- `record_transaction(data: dict) -> int`
- `manage_cheque(data: dict) -> int`
- `get_bank_statement(account_id: int, from_date: str, to_date: str) -> list[dict]`

### Report Controller

**File**: `controllers/report_controller.py`

**Methods**:
- `generate_trial_balance(from_date: str, to_date: str) -> list[dict]`
- `generate_profit_loss(from_date: str, to_date: str) -> dict`
- `generate_balance_sheet(as_of_date: str) -> dict`
- `generate_party_ledger(party_id: int, from_date: str, to_date: str) -> list[dict]`
- `generate_cash_book(from_date: str, to_date: str) -> list[dict]`
- `export_report(report_data: list, format: str) -> bytes`

### Dashboard Controller

**File**: `controllers/dashboard_controller.py`

**Methods**:
- `get_kpis() -> dict`
- `get_recent_transactions(limit: int = 10) -> list[dict]`
- `get_sales_trend(days: int = 30) -> list[dict]`
- `get_top_customers(limit: int = 5) -> list[dict]`

### Backup Controller

**File**: `controllers/backup_controller.py`

**Methods**:
- `create_backup() -> str`
- `get_backups() -> list[dict]`
- `restore_backup(backup_path: str) -> bool`
- `configure_auto_backup(enabled: bool, interval_hours: int) -> None`

---

## VIEWS (PRESENTATION LAYER)

Views handle all UI rendering and user interaction using PySide6 (Qt).

### Main Window

**File**: `views/main_window.py`

Central navigation hub with role-based access control.

#### `MainWindow` Class

**Structure**:
```
┌─────────────────────────────────────────────────────┐
│ MainWindow                                          │
│ ┌─────────────┐ ┌─────────────────────────────────┐ │
│ │   Sidebar   │ │         Content Stack           │ │
│ │             │ │                                 │ │
│ │ - Brand     │ │  ┌───────────────────────────┐  │ │
│ │ - Nav List  │ │  │    DashboardView          │  │ │
│ │ - User Info │ │  └───────────────────────────┘  │ │
│ │ - Logout    │ │  ┌───────────────────────────┐  │ │
│ │             │ │  │    ChartOfAccountsWidget  │  │ │
│ │             │ │  └───────────────────────────┘  │ │
│ │             │ │            ...                  │ │
│ └─────────────┘ └─────────────────────────────────┘ │
│ └────────────────── Status Bar ────────────────────┘│
└─────────────────────────────────────────────────────┘
```

**Key Properties**:
- `ALL_NAV_ITEMS`: List of all available pages
- `_nav_items`: Filtered list based on user permissions
- `_pages`: Cache of instantiated page widgets
- `stack`: QStackedWidget for page switching

**Navigation Flow**:
1. User clicks nav item
2. `_on_nav_changed()` triggered
3. Check if special case (Opening Balance dialog)
4. Call `_get_or_create_page(key)`
5. If page doesn't exist, instantiate view class
6. Switch stacked widget to show page
7. Update status bar

**Lazy Loading**:
- Constructor builds UI only (no data loading)
- `load_initial_data()` called after window shown
- Prevents UI freeze on login

### Login View

**File**: `views/login_view.py`

Authentication screen with credential validation.

**Components**:
- Username QLineEdit
- Password QLineEdit (echo mode: Password)
- Login QPushButton
- Error QLabel

**Signals**:
- `login_successful.emit(User)` - On successful authentication

**Flow**:
1. User enters credentials
2. Clicks Login button
3. Calls `AuthController.login()`
4. On success: emit signal, close login window
5. On failure: show error message

### Base View

**File**: `views/base_view.py`

Abstract base class for all feature widgets.

**Common Functionality**:
- Standard layout structure
- Error handling
- Loading states
- Refresh mechanism

### Feature Widgets

Each module has a dedicated widget class.

#### `DashboardView`
**File**: `views/widgets/dashboard_view.py`

**Components**:
- KPI Cards (grid layout)
  - Receivables
  - Payables
  - Cash in Hand
  - Bank Balance
  - Today's Sales
  - Today's Purchases
- Recent Transactions table
- Quick action buttons

**Data Loading**:
```python
def _load_data(self):
    kpis = self.controller.get_kpis()
    self._update_kpi_cards(kpis)
    transactions = self.controller.get_recent_transactions()
    self._populate_transactions_table(transactions)
```

#### `ChartOfAccountsWidget`
**File**: `views/widgets/chart_of_accounts_widget.py`

**Components**:
- Tree view of accounts (hierarchical)
- Add/Edit/Delete buttons
- Opening Balance dialog
- Filter by account type

**Features**:
- Expandable/collapsible nodes
- Color coding by account type
- Inline editing
- Drag-and-drop reordering (future)

#### `PartyView`
**File**: `views/widgets/party_view.py`

**Components**:
- Party list table
- Customer/Supplier filter tabs
- Add/Edit dialog
- Ledger view button
- Outstanding balance display

**Dialog Fields**:
- Code (auto-generated)
- Name
- Type (Customer/Supplier/Both)
- Credit Limit
- Phone, Address, Email
- Linked Account (A/R or A/P)

#### `ItemView`
**File**: `views/widgets/item_view.py`

**Components**:
- Item list table
- Category filter
- Stock level indicators
- Low stock alerts
- Batch viewer

**Dialog Fields**:
- Item Code
- Item Name
- Category
- Unit
- Purchase Price
- Selling Price
- Min/Max Stock
- Item Type (Raw Material/Packing/Finished Good)

#### `SalesInvoiceView`
**File**: `views/widgets/sales_invoice_view.py`

**Components**:
- Invoice list table
- Create/Edit form
- Line item editor
- Customer selector
- Batch selector (FIFO)
- Print/Export buttons

**Invoice Form**:
- Invoice Number (auto)
- Customer dropdown
- Invoice Date
- Payment Type (Cash/Bank/Cheque/Credit)
- Line Items Table:
  - Item
  - Batch
  - Quantity
  - Unit Price
  - Discount
  - Tax
  - Line Total
- Subtotal
- Discount (global)
- Tax
- Total
- Paid Amount
- Notes

**Workflow**:
1. Click "New Invoice"
2. Select customer
3. Add line items
4. System calculates totals
5. Save as DRAFT or Confirm
6. On Confirm: stock reduced, accounting posted

#### `PurchaseInvoiceView`
**File**: `views/widgets/purchase_invoice_view.py`

Similar to SalesInvoiceView with supplier-side fields and batch creation.

**Additional Fields**:
- Batch Number
- Manufacturing Date
- Expiry Date

#### `ManufacturingView`
**File**: `views/widgets/manufacturing_view.py`

**Tabs**:
1. Bill of Materials
2. Production Orders

**BOM Tab**:
- BOM list
- Create/Edit BOM
- Component list
- Output quantity

**Production Orders Tab**:
- Order list with status
- Create Production Order
- Consume Materials dialog
- Complete Production dialog

**Workflow**:
1. Create BOM (define recipe)
2. Create Production Order (specify quantity)
3. Consume Materials (select batches)
4. Complete Production (enter actual output)
5. System creates finished goods batch

#### `ExpenseView`
**File**: `views/widgets/expense_view.py`

**Components**:
- Expense list
- Category filter
- Date range filter
- Add/Edit dialog

**Dialog Fields**:
- Voucher Number (auto)
- Category
- Date
- Amount
- Payment Method
- Description

#### `PaymentView`
**File**: `views/widgets/payment_view.py`

**Tabs**:
1. Payments (to suppliers)
2. Receipts (from customers)

**Payment Workflow**:
1. Select supplier
2. System shows unpaid invoices
3. Enter payment amount
4. Allocate to invoices (auto or manual)
5. Select payment method
6. Post payment

#### `BankingView`
**File**: `views/widgets/banking_view.py`

**Tabs**:
1. Bank Accounts
2. Transactions
3. Cheques

**Features**:
- Account balance display
- Transaction history
- Cheque status tracking
- Bank reconciliation

#### `ReportView`
**File**: `views/widgets/report_view.py`

**Report Types**:
- Trial Balance
- Profit & Loss
- Balance Sheet
- Party Ledger
- Cash Book

**Common Controls**:
- From Date
- To Date
- Generate button
- Export dropdown (PDF/Excel/CSV)
- Print button

**Output**:
- Table view in dialog
- Exportable formats
- Printable layout

#### `BackupView`
**File**: `views/widgets/backup_view.py`

**Components**:
- Backup Now button
- Backup list (date, size)
- Restore button
- Auto-backup configuration
- Backup location setting

#### `UsersView`
**File**: `views/widgets/users_view.py`

**Components**:
- User list
- Add/Edit user dialog
- Role assignment
- Activate/Deactivate

**Dialog Fields**:
- Username
- Password
- Full Name
- Email
- Role (dropdown)
- Active checkbox

#### `AssetView`
**File**: `views/widgets/asset_view.py`

**Components**:
- Asset list
- Asset categories
- Depreciation tracking
- Add/Edit dialog

#### `OpeningBalanceDialog`
**File**: `views/widgets/opening_balance_dialog.py`

**Purpose**: Set opening balances for accounts and parties.

**Tabs**:
1. Accounts
2. Customers
3. Suppliers

**Process**:
1. Enter opening balances
2. Specify date
3. System creates opening journal entry

### Styling

**File**: `main.py` (APP_STYLESHEET constant)

Comprehensive Qt stylesheet defining:
- Color scheme (primary: #e94560)
- Typography (Segoe UI, 16px base)
- Widget styles (buttons, inputs, tables, dialogs)
- Layout spacing
- Hover/pressed states
- Scrollbar styling
- KPI card styling

---

## REPORTS MODULE

Financial report generation with export capabilities.

### Report Base

**File**: `reports/report_base.py`

Abstract base class for all reports.

```python
class ReportBase:
    def __init__(self, db: DatabaseConnection):
        self.db = db
    
    def generate(self, from_date: str, to_date: str) -> dict:
        """Generate report data. Override in subclasses."""
        raise NotImplementedError
    
    def export_pdf(self, data: dict) -> bytes:
        """Export to PDF using reportlab."""
    
    def export_excel(self, data: dict) -> bytes:
        """Export to Excel using openpyxl."""
    
    def export_csv(self, data: dict) -> bytes:
        """Export to CSV."""
```

### Trial Balance Report

**File**: `reports/trial_balance_report.py`

**Purpose**: List all accounts with debit/credit balances.

**Columns**:
- Account Code
- Account Name
- Account Type
- Debit
- Credit

**Logic**:
1. Get all active accounts
2. Calculate balance from journal entries
3. Determine normal balance direction
4. Format as debit or credit

**Validation**: Total Debit must equal Total Credit

### Profit & Loss Report

**File**: `reports/profit_loss_report.py`

**Purpose**: Show revenue, expenses, and net profit for a period.

**Structure**:
```
Revenue:
  - Sales Revenue          XXXX
  - Other Income           XXXX
Total Revenue:             XXXX

Expenses:
  - Cost of Goods Sold     XXXX
  - Operating Expenses     XXXX
  - Depreciation           XXXX
Total Expenses:            XXXX

Net Profit:                XXXX
```

**Logic**:
1. Sum all REVENUE accounts for period
2. Sum all EXPENSE accounts for period
3. Calculate Net Profit = Revenue - Expenses

### Balance Sheet Report

**File**: `reports/balance_sheet_report.py`

**Purpose**: Show financial position at a specific date.

**Structure**:
```
ASSETS:
  Current Assets:
    - Cash in Hand         XXXX
    - Bank Balance         XXXX
    - Accounts Receivable  XXXX
    - Inventory            XXXX
  Fixed Assets:
    - Property & Equipment XXXX
Total Assets:              XXXX

LIABILITIES:
  Current Liabilities:
    - Accounts Payable     XXXX
    - Short-term Loans     XXXX
  Long-term Liabilities:
    - Long-term Debt       XXXX
Total Liabilities:         XXXX

EQUITY:
  - Owner's Capital        XXXX
  - Retained Earnings      XXXX
Total Equity:              XXXX

Total Liabilities + Equity: XXXX
```

**Validation**: Assets = Liabilities + Equity

### Party Ledger Report

**File**: `reports/party_ledger_report.py`

**Purpose**: Show all transactions with a specific party.

**Columns**:
- Date
- Voucher Type
- Voucher Number
- Description
- Debit
- Credit
- Balance

**Logic**:
1. Get all journal entries involving party
2. Include invoices, payments, receipts
3. Calculate running balance

### Cash Book Report

**File**: `reports/cash_book_report.py`

**Purpose**: Show all cash and bank transactions.

**Columns**:
- Date
- Particulars
- Voucher Type
- Voucher Number
- Debit
- Credit
- Balance

**Logic**:
1. Filter journal entries for Cash and Bank accounts
2. Chronological order
3. Running balance

---

## UTILITIES & HELPERS

### Logger

**File**: `utils/logger.py`

Centralized logging configuration.

```python
def get_logger(name: str) -> logging.Logger:
    """Get configured logger instance."""
```

**Configuration**:
- Log level: INFO (configurable)
- Format: timestamp - level - name - message
- Handlers: File (logs/erp.log), Console
- Rotation: Daily, 7 backups

### Exceptions

**File**: `utils/exceptions.py`

Custom exception classes:

```python
class ERPError(Exception):
    """Base exception for ERP system."""

class ValidationError(ERPError):
    """Business rule validation failed."""

class DatabaseError(ERPError):
    """Database operation failed."""

class RecordNotFoundError(ERPError):
    """Requested record does not exist."""

class UnbalancedJournalEntryError(ERPError):
    """Journal entry debits != credits."""

class InsufficientStockError(ERPError):
    """Not enough stock for operation."""

class DuplicateRecordError(ERPError):
    """Unique constraint violation."""
```

### Helpers

**File**: `utils/helpers.py`

Utility functions used throughout the application.

**Functions**:
- `format_currency(amount: float) -> str` - Format as currency
- `format_date(date_str: str) -> str` - Format date
- `parse_date(date_str: str) -> datetime` - Parse date string
- `generate_code(prefix: str, next_num: int, padding: int) -> str` - Generate codes
- `calculate_age(dob: str) -> int` - Calculate age
- `safe_divide(numerator: float, denominator: float) -> float` - Safe division

### Security

**File**: `utils/security.py`

Security utilities.

**Functions**:
- `hash_password(password: str) -> tuple[str, str]` - Hash with salt
- `verify_password(password: str, hash: str, salt: str) -> bool` - Verify password
- `sanitize_input(text: str) -> str` - Sanitize user input
- `generate_token(length: int = 32) -> str` - Generate random token

### Cache Manager

**File**: `utils/cache_manager.py`

Two-level caching system.

#### `SessionCache` Class
Shared across repositories for session-wide caching.

```python
class SessionCache:
    def __init__(self, default_ttl: int = 60):
        self._cache: dict[str, tuple[Any, float]] = {}
        self.default_ttl = default_ttl
    
    def get(self, key: str) -> Any | None
    def set(self, key: str, value: Any, ttl: int = None)
    def invalidate_pattern(self, pattern: str)
    def clear(self)
```

#### `invalidate_on_change(table_name: str)` Function
Decorator/function to invalidate cache when data changes.

### Event Bus

**File**: `utils/event_bus.py`

Simple pub/sub system for cross-component communication.

```python
class EventBus:
    def subscribe(event_type: str, callback: Callable)
    def publish(event_type: str, data: Any)
    def unsubscribe(event_type: str, callback: Callable)
```

**Events**:
- `record_created` - New record created
- `record_updated` - Record modified
- `record_deleted` - Record deleted
- `document_confirmed` - Document confirmed
- `document_cancelled` - Document cancelled

### Activity Logger

**File**: `utils/activity_logger.py`

Logs user activities to database and file.

```python
def log_activity(user_id: int, action: str, entity_table: str, 
                 entity_id: int | None, details: str | None)
```

**Logged Information**:
- User ID
- Action (CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.)
- Entity Table
- Entity ID
- Details (JSON)
- Timestamp

### Report Exporter

**File**: `utils/report_exporter.py`

Export utilities for reports.

**Methods**:
- `export_to_pdf(data: list, columns: list, title: str) -> bytes`
- `export_to_excel(data: list, columns: list, sheet_name: str) -> bytes`
- `export_to_csv(data: list, columns: list) -> bytes`

### Performance Monitor

**File**: `utils/performance_monitor.py`

Track query and operation performance.

```python
class PerformanceMonitor:
    def start_timer(operation: str)
    def stop_timer(operation: str) -> float
    def get_stats() -> dict
```

### Lazy Loader

**File**: `utils/lazy_loader.py`

Deferred loading for expensive operations.

```python
class LazyLoader:
    def __init__(self, factory: Callable)
    def load() -> Any  # Loads on first access
    def reload() -> Any  # Force reload
```

---

## CONFIGURATION

### App Config

**File**: `config/app_config.py`

Application-wide settings.

```python
class AppConfig:
    app_name: str = "Pharmaceutical ERP"
    version: str = "1.0.0"
    company_id: int = 1
    warehouse_id: int = 1
    currency_symbol: str = "Rs."
    date_format: str = "%Y-%m-%d"
    decimal_places: int = 2
    backup_directory: str = "./backups"
    log_directory: str = "./logs"
```

**Singleton Access**:
```python
from config.app_config import get_config
config = get_config()
```

### Backup Config

**File**: `config/backup_config.py`

Backup-specific settings.

```python
class BackupConfig:
    enabled: bool = True
    interval_hours: int = 24
    max_backups: int = 7
    backup_directory: str = "./backups"
    compress: bool = False
```

---

## AUTHENTICATION & AUTHORIZATION

### Authentication Flow

1. User enters credentials in LoginView
2. LoginView calls AuthController.login()
3. AuthController calls AuthService.authenticate()
4. AuthService:
   - Fetches user by username
   - Verifies password hash
   - Updates last_login_at
   - Returns User object
5. On success, MainWindow opens with User context
6. On failure, error message displayed

### Authorization (RBAC)

**Implementation**:
- Each User has a role (UserRole enum)
- Each role has predefined permissions
- MainWindow filters navigation based on permissions
- Views can check `user.can_access(module_key)`

**Permission Checks**:
```python
if not self.user.can_access("sales"):
    QMessageBox.warning(self, "Access Denied", 
                       "You don't have permission to access Sales")
    return
```

### Password Security

**Hashing Algorithm**: PBKDF2-HMAC-SHA256
**Salt**: Random 32-byte salt per user
**Iterations**: 100,000 (configurable)

```python
import hashlib
import os

def hash_password(password: str) -> tuple[str, str]:
    salt = os.urandom(32)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
    return pwd_hash.hex(), salt.hex()
```

---

## ACCOUNTING ENGINE

### Double-Entry Principles

Every transaction affects at least two accounts:
- Total Debits = Total Credits
- Each transaction traceable to source document

### Account Types & Normal Balances

| Type | Normal Balance | Increases With |
|------|---------------|----------------|
| Asset | Debit | Debit |
| Liability | Credit | Credit |
| Equity | Credit | Credit |
| Revenue | Credit | Credit |
| Expense | Debit | Debit |

### System Accounts

**File**: `accounting/system_accounts.py`

Predefined system accounts:

| Code | Name | Type | Purpose |
|------|------|------|---------|
| 1010 | Cash in Hand | Asset | Cash transactions |
| 1020 | Bank Account | Asset | Bank transactions |
| 1100 | Accounts Receivable | Asset | Customer balances |
| 1200 | Inventory | Asset | Stock valuation |
| 2000 | Accounts Payable | Liability | Supplier balances |
| 2100 | Tax Payable | Liability | Sales tax owed |
| 3000 | Owner's Capital | Equity | Owner investment |
| 3100 | Retained Earnings | Equity | Accumulated profits |
| 4000 | Sales Revenue | Revenue | Product sales |
| 4100 | Service Revenue | Revenue | Service income |
| 5000 | Cost of Goods Sold | Expense | Direct costs |
| 5100 | Operating Expenses | Expense | Overhead costs |

### Journal Entry Creation by Transaction Type

#### Sales Invoice (Credit Sale)
```
Dr. Accounts Receivable    1000
    Cr. Sales Revenue              1000
```

#### Sales Invoice (Cash Sale)
```
Dr. Cash in Hand           1000
    Cr. Sales Revenue              1000
```

#### Purchase Invoice (Credit Purchase)
```
Dr. Inventory              1000
    Cr. Accounts Payable            1000
```

#### Payment to Supplier
```
Dr. Accounts Payable       1000
    Cr. Bank Account               1000
```

#### Receipt from Customer
```
Dr. Bank Account           1000
    Cr. Accounts Receivable         1000
```

#### Production Completion
```
Dr. Finished Goods Inventory  1000
    Cr. Work in Progress             1000
```

#### Expense Payment
```
Dr. Expense Account        500
    Cr. Cash in Hand                 500
```

### Voucher Numbering

Sequential, gap-free numbering per voucher type.

**Format**: `{PREFIX}-{YYYYMMDD}-{SEQ}`

Example: `SAL-20240115-00001`

**Implementation**:
- `numbering_sequences` table tracks next number
- Incremented within transaction
- Reset daily (optional)

---

## DATA FLOW EXAMPLES

### Example 1: Creating a Sales Invoice

```
User Action: Click "New Invoice" → Fill form → Click "Save"

View Layer (SalesInvoiceView):
1. Collect form data
2. Collect line items
3. Call controller.create_invoice()

Controller Layer (SalesInvoiceController):
1. Validate input data
2. Call service.create_invoice()
3. Handle exceptions
4. Show success/error message

Service Layer (SalesInvoiceService):
1. Validate customer exists
2. Validate items exist
3. Check stock availability
4. Calculate totals
5. Begin transaction
6. Call AccountingService.post_journal_entry()
   - Dr. Accounts Receivable
   - Cr. Sales Revenue
   - Cr. Tax Payable
7. Insert invoice header
8. Insert invoice items
9. Reduce stock batches
10. Create stock movements
11. Commit transaction
12. Log activity

Repository Layer:
- SalesInvoiceRepository.insert()
- SalesInvoiceItemRepository.insert_batch()
- StockBatchRepository.update_quantities()
- StockMovementRepository.insert_batch()
- JournalRepository.insert_entry()

Database Layer:
- Execute INSERT statements
- Enforce constraints
- Return inserted IDs

Response Flow:
- Database → Repository → Service → Controller → View
- View refreshes grid
- Shows confirmation message
```

### Example 2: Generating Balance Sheet

```
User Action: Open Reports → Balance Sheet → Select Date → Generate

View Layer (ReportView):
1. Get date from user
2. Call controller.generate_balance_sheet()
3. Display results in table
4. Enable export buttons

Controller Layer (ReportController):
1. Call service.generate_balance_sheet()
2. Format data for display
3. Return to view

Service Layer (uses report classes):
1. BalanceSheetReport.generate()
2. Get all Asset accounts
   - Query journal entries for balances
   - Group by subtype (Current/Fixed)
3. Get all Liability accounts
   - Query journal entries for balances
   - Group by subtype (Current/Long-term)
4. Get all Equity accounts
5. Calculate totals
6. Validate: Assets = Liabilities + Equity
7. Return structured data

Repository Layer:
- AccountRepository.find_all_for_company()
- JournalRepository.get_account_balances()

Database Layer:
- Execute SELECT queries with SUM aggregations
- Join accounts with journal_entry_lines
- Group by account type

Response Flow:
- Database → Repository → Service → Controller → View
- View renders table
- User can export/print
```

### Example 3: User Login

```
User Action: Enter credentials → Click Login

View Layer (LoginView):
1. Get username/password from inputs
2. Call controller.login()
3. On success: close window, open MainWindow
4. On failure: show error message

Controller Layer (AuthController):
1. Call service.authenticate()
2. Handle exceptions
3. Return User object or error

Service Layer (AuthService):
1. UserRepository.find_by_username()
2. Verify password hash
3. Update last_login_at
4. Log login activity
5. Return User object

Repository Layer:
- UserRepository.find_by_username()
- UserRepository.update_last_login()

Database Layer:
- SELECT user by username
- UPDATE last_login_at

Response Flow:
- Database → Repository → Service → Controller → View
- View emits login_successful signal
- Application creates MainWindow with User context
- MainWindow filters navigation by permissions
```

---

## API REFERENCE

### Database Connection

```python
from database.connection import get_db, close_db

db = get_db()
db.fetch_one("SELECT * FROM users WHERE id = ?", (1,))
db.fetch_all("SELECT * FROM accounts WHERE is_active = 1")
db.execute("INSERT INTO users (username) VALUES (?)", ("admin",))
db.last_insert_id()

with db.transaction():
    db.execute(...)
    db.execute(...)

close_db()
```

### Repository Usage

```python
from repositories.account_repository import AccountRepository

repo = AccountRepository(db)
account = repo.find_by_id(1)
accounts = repo.find_all(active_only=True)
account_id = repo.insert({"account_code": "1100", ...})
repo.update(1, {"account_name": "New Name"})
repo.deactivate(1)
exists = repo.exists(1)
count = repo.count("account_type = ?", ("ASSET",))
```

### Service Usage

```python
from services.sales_invoice_service import SalesInvoiceService
from services.accounting_service import AccountingService, JournalLine
from models.enums import VoucherType

sales_service = SalesInvoiceService(db)
accounting = AccountingService(db)

# Create invoice
invoice_id = sales_service.create_invoice(
    invoice_data={"customer_id": 1, "invoice_date": "2024-01-15", ...},
    items_data=[{"item_id": 1, "quantity": 10, "unit_price": 100}, ...],
    user_id=1
)

# Post manual journal entry
lines = [
    JournalLine(account_id=1100, debit=1000, party_id=1),
    JournalLine(account_id=4000, credit=1000),
]
entry_id = accounting.post_journal_entry(
    voucher_type=VoucherType.JOURNAL,
    entry_date="2024-01-15",
    lines=lines,
    narration="Adjustment entry"
)
```

### Controller Usage

```python
from controllers.party_controller import PartyController
from services.party_service import PartyService

service = PartyService(db)
controller = PartyController(service)

result = controller.handle_action("create", {
    "code": "CUST-001",
    "name": "ABC Company",
    "party_type": "CUSTOMER",
    "credit_limit": 50000
})

if result["success"]:
    party_id = result["data"]
else:
    error = result["error"]
```

### Model Usage

```python
from models.party import Party
from models.enums import PartyType

# Create from scratch
party = Party(
    code="CUST-001",
    name="ABC Company",
    party_type=PartyType.CUSTOMER,
    credit_limit=50000
)

# Create from database row
row = {"id": 1, "code": "CUST-001", "name": "ABC Company", ...}
party = Party.from_row(row)

# Convert to dict for repository
data = party.to_dict()
```

### View Usage

```python
from views.widgets.party_view import PartyView
from controllers.party_controller import PartyController

# In MainWindow
controller = PartyController(PartyService(db))
party_widget = PartyView(controller, self.user)
stack.addWidget(party_widget)
```

---

## BEST PRACTICES

### Code Organization

1. **One class per file** (except small related classes)
2. **Consistent naming**: CamelCase for classes, snake_case for functions
3. **Type hints** on all function signatures
4. **Docstrings** on all public methods
5. **Logging** at key decision points

### Error Handling

1. **Catch specific exceptions** before generic Exception
2. **Log with context** (parameters, user, operation)
3. **User-friendly messages** in UI, detailed in logs
4. **Rollback transactions** on any error

### Performance

1. **Use indexes** on frequently queried columns
2. **Batch operations** for bulk inserts/updates
3. **Cache aggressively** for read-heavy data
4. **Lazy load** expensive operations
5. **Profile queries** with EXPLAIN QUERY PLAN

### Security

1. **Parameterized queries** always (no string concatenation)
2. **Password hashing** with salt
3. **Session validation** on sensitive operations
4. **Input sanitization** for user-provided data
5. **Least privilege** for database user

### Testing

1. **Unit tests** for services (business logic)
2. **Integration tests** for repositories (database)
3. **UI tests** for critical workflows
4. **Mock external dependencies** (database, file system)

---

## TROUBLESHOOTING

### Common Issues

#### "Database is locked"
- Cause: Multiple writers
- Solution: Ensure transactions are short and committed
- Prevention: Use connection pooling

#### "Journal entry not balanced"
- Cause: Debits ≠ Credits
- Solution: Review line amounts, check rounding

#### "Insufficient stock"
- Cause: Trying to sell more than available
- Solution: Check batch quantities, adjust or purchase more

#### "Foreign key constraint failed"
- Cause: Referencing non-existent record
- Solution: Verify referenced IDs exist

#### "Permission denied"
- Cause: User role lacks required permission
- Solution: Assign appropriate role or custom permissions

### Debug Mode

Enable verbose logging:
```python
import logging
logging.getLogger().setLevel(logging.DEBUG)
```

### Database Inspection

```sql
-- Check table sizes
SELECT name, (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=tbl.name) as rows
FROM sqlite_master tbl
WHERE type='table';

-- Find unbalanced entries
SELECT journal_entry_id, SUM(debit) - SUM(credit) as difference
FROM journal_entry_lines
GROUP BY journal_entry_id
HAVING ABS(difference) > 0.01;

-- Check stock consistency
SELECT item_id, SUM(quantity) as total_stock
FROM stock_movements
GROUP BY item_id;
```

---

## GLOSSARY

| Term | Definition |
|------|------------|
| BOM | Bill of Materials - recipe for manufacturing |
| COA | Chart of Accounts - list of all accounts |
| FIFO | First In First Out - inventory valuation method |
| Journal Entry | Accounting record with debits and credits |
| KPI | Key Performance Indicator - business metric |
| Party | Customer or Supplier |
| RBAC | Role-Based Access Control |
| Repository | Data access pattern |
| Service Layer | Business logic layer |
| Voucher | Document number for accounting entries |

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01 | Initial release |
| 1.0.1 | 2024-01 | Performance optimizations, caching |
| 1.0.2 | 2024-01 | SQLiteCloud integration, auto-backup |

---

## SUPPORT

For issues, questions, or contributions:
- Check existing documentation
- Review logs in `/workspace/logs/`
- Contact development team

---

*Documentation generated: 2024*
*Last updated: Comprehensive review of all source files*
