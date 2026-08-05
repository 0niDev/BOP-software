# BOP Nutraceuticals ERP System - Complete Documentation

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Database Architecture](#database-architecture)
6. [Core Modules Documentation](#core-modules-documentation)
7. [Business Logic & Services](#business-logic--services)
8. [API Reference](#api-reference)
9. [Data Flow & Workflows](#data-flow--workflows)
10. [Security Implementation](#security-implementation)
11. [Error Handling](#error-handling)
12. [Caching Strategy](#caching-strategy)
13. [Backup & Recovery](#backup--recovery)
14. [Reporting System](#reporting-system)
15. [User Interface](#user-interface)
16. [Configuration](#configuration)
17. [Installation & Deployment](#installation--deployment)
18. [Performance Optimizations](#performance-optimizations)
19. [Testing](#testing)
20. [Troubleshooting](#troubleshooting)
21. [Future Enhancements](#future-enhancements)

---

## Executive Summary

### Project Overview

**Project Name:** BOP Nutraceuticals ERP System  
**Industry:** Pharmaceutical/Nutraceutical Manufacturing  
**Architecture Pattern:** Multi-layered (Views → Controllers → Services → Repositories → Database)  
**Programming Language:** Python 3.9+  
**GUI Framework:** PySide6 (Qt 6)  
**Database:** SQLite Cloud (Hosted) with local fallback  
**Total Codebase:** ~14,500 lines of Python code across 110+ files  

### Business Purpose

This is a complete Enterprise Resource Planning (ERP) system designed specifically for pharmaceutical and nutraceutical manufacturing companies. It integrates:

- **Double-entry accounting** with full audit trail
- **Inventory management** with batch tracking
- **Manufacturing operations** (BOM, Production Orders)
- **Sales & Purchase invoicing**
- **Party management** (Customers/Suppliers)
- **Financial reporting** (Trial Balance, P&L, Balance Sheet, etc.)
- **Banking & Payment processing**
- **Expense tracking**
- **Role-based access control**

### Key Design Principles

1. **Separation of Concerns**: Each layer has a single responsibility
2. **Double-Entry Integrity**: All monetary transactions flow through `AccountingService`
3. **Audit Trail**: Every journal entry links to its source document
4. **Soft Deletes**: Historical data preserved via `is_active` flags
5. **Multi-Tenant Ready**: All business tables include `company_id`
6. **Transaction Safety**: Related operations wrapped in database transactions
7. **Caching**: Multi-level caching for performance optimization

---

## System Architecture

### Layered Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ LoginView   │  │ MainWindow   │  │ Widget Views         │   │
│  │             │  │              │  │ (Invoice, Party,     │   │
│  │             │  │              │  │  Item, Report, etc.) │   │
│  └─────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       CONTROLLER LAYER                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ AuthCtrl    │  │ InvoiceCtrl  │  │ ReportCtrl           │   │
│  │ (validate)  │  │ (validate)   │  │ (format)             │   │
│  │ (handle)    │  │ (handle)     │  │ (export)             │   │
│  └─────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        SERVICE LAYER                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ AccountingService (Core Engine)                          │   │
│  │ - post_journal_entry()                                   │   │
│  │ - validate debits = credits                              │   │
│  │ - generate voucher numbers                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ SalesInvSvc │  │ PurchaseSvc  │  │ ManufacturingSvc     │   │
│  │ PaymentSvc  │  │ BankingSvc   │  │ DashboardSvc         │   │
│  └─────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      REPOSITORY LAYER                            │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ BaseRepo    │  │ AccountRepo  │  │ JournalRepo          │   │
│  │ (CRUD)      │  │ (balances)   │  │ (voucher numbers)    │   │
│  │ + Cache     │  │ StockRepo     │  │ PartyRepo            │   │
│  └─────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE LAYER                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ SQLite Cloud (Hosted)                                    │   │
│  │ - Connection Pooling (max 20 connections)                │   │
│  │ - Prepared Statements Cache                              │   │
│  │ - Auto-backup every 24 hours                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Schema: 20+ Tables, FK Constraints, Indexes              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
User Action → View (Qt Widget)
    ↓
Controller (Input Validation, Error Handling)
    ↓
Service (Business Logic, Calculations, Transactions)
    ↓
Repository (CRUD Operations with Caching)
    ↓
Database (SQLite Cloud with Connection Pooling)
```

---

## Technology Stack

### Core Technologies

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Language** | Python | 3.9+ | Application logic |
| **GUI Framework** | PySide6 | 6.0+ | Desktop user interface |
| **Database** | SQLite Cloud | Hosted | Data persistence |
| **Connection Library** | sqlitecloud | Latest | Database connectivity |

### Supporting Libraries

| Library | Minimum Version | Purpose |
|---------|----------------|---------|
| **openpyxl** | 3.0.0 | Excel export for reports |
| **beautifulsoup4** | 4.9.0 | HTML parsing (if needed) |
| **reportlab** | Latest | PDF generation |

### Development Tools

| Tool | Purpose |
|------|---------|
| **Git** | Version control |
| **pip** | Package management |
| **Python logging** | Application logging with rotation |

---

## Project Structure

### Directory Layout

```
/workspace/
├── main.py                          # Application entry point
├── requirements.txt                 # Python dependencies
├── setup.bat                        # Windows setup script
├── README.md                        # Project overview
├── PROJECT_DOCUMENTATION.md         # Existing documentation
├── seed_data.py                     # Initial data seeding
│
├── accounting/                      # Accounting system utilities
│   ├── __pycache__/
│   └── system_accounts.py           # Chart of accounts initialization
│
├── authentication/                  # Authentication module
│   ├── __pycache__/
│   └── auth_service.py              # Login, password verification
│
├── config/                          # Configuration management
│   ├── __pycache__/
│   ├── app_config.py                # Environment variables, DB config
│   └── backup_config.py             # Backup settings
│
├── controllers/                     # Controller layer (12 files)
│   ├── __pycache__/
│   ├── account_controller.py        # Chart of accounts UI logic
│   ├── auth_controller.py           # Login/logout handling
│   ├── backup_controller.py         # Backup/restore operations
│   ├── banking_controller.py        # Banking transactions
│   ├── dashboard_controller.py      # Dashboard data aggregation
│   ├── expense_controller.py        # Expense management
│   ├── item_controller.py           # Inventory item management
│   ├── manufacturing_controller.py  # BOM & production orders
│   ├── party_controller.py          # Customer/supplier management
│   ├── payment_controller.py        # Payment processing
│   ├── purchase_invoice_controller.py
│   ├── report_controller.py         # Report generation/export
│   └── sales_invoice_controller.py  # Sales invoice operations
│
├── database/                        # Database layer
│   ├── __pycache__/
│   ├── connection.py                # Connection pooling, transaction mgmt
│   ├── schema.py                    # DDL statements (20+ tables)
│   ├── sqlitecloud_connection.py    # SQLite Cloud specific implementation
│   ├── auto_backup.py               # Automatic backup scheduler
│   ├── backup.py                    # Manual backup functions
│   ├── backup_launcher.py           # Backup process launcher
│   ├── backup_manager.py            # Backup lifecycle management
│   └── migrations/
│       ├── migrator.py              # Schema migration runner
│       └── add_performance_indexes.py
│
├── models/                          # Data models (DataClasses)
│   ├── __pycache__/
│   ├── account.py                   # Account model
│   ├── banking.py                   # Bank account, cheque models
│   ├── bill_of_materials.py         # BOM & component models
│   ├── enums.py                     # Shared enumerations
│   ├── expense.py                   # Expense models
│   ├── item.py                      # Inventory item model
│   ├── party.py                     # Customer/supplier model
│   ├── production_order.py          # Production order model
│   ├── purchase_invoice.py          # Purchase invoice model
│   ├── purchase_invoice_item.py     # Purchase invoice line items
│   ├── sales_invoice.py             # Sales invoice model
│   └── user.py                      # User model
│
├── repositories/                    # Repository layer (15 files)
│   ├── __pycache__/
│   ├── base_repository.py           # Base CRUD with caching
│   ├── account_repository.py        # Account operations
│   ├── banking_repository.py        # Banking operations
│   ├── bom_repository.py            # BOM operations
│   ├── expense_repository.py        # Expense operations
│   ├── item_repository.py           # Item operations
│   ├── journal_repository.py        # Journal entry operations
│   ├── party_repository.py          # Party operations
│   ├── production_order_repository.py
│   ├── purchase_invoice_item_repository.py
│   ├── purchase_invoice_repository.py
│   ├── sales_invoice_repository.py  # Sales invoice operations
│   ├── stock_batch_repository.py    # Stock batch operations
│   ├── tax_rate_repository.py       # Tax rate operations
│   └── user_repository.py           # User operations
│
├── reports/                         # Financial reports
│   ├── __pycache__/
│   ├── report_base.py               # Base report class
│   ├── balance_sheet_report.py      # Balance Sheet
│   ├── cash_book_report.py          # Cash Book
│   ├── party_ledger_report.py       # Party Ledger
│   ├── profit_loss_report.py        # Profit & Loss
│   └── trial_balance_report.py      # Trial Balance
│
├── services/                        # Business logic layer (13 files)
│   ├── __pycache__/
│   ├── account_service.py           # Account management
│   ├── accounting_service.py        # ⭐ CORE: Double-entry engine
│   ├── auto_backup.py               # Auto-backup service
│   ├── backup_service.py            # Backup operations
│   ├── banking_service.py           # Banking transactions
│   ├── dashboard_service.py         # Dashboard data aggregation
│   ├── expense_service.py           # Expense management
│   ├── item_service.py              # Item management
│   ├── manufacturing_service.py     # BOM & production
│   ├── party_service.py             # Party management
│   ├── payment_service.py           # Payment processing
│   ├── purchase_invoice_service.py  # Purchase invoices
│   └── sales_invoice_service.py     # Sales invoices
│
├── utils/                           # Utility modules
│   ├── __pycache__/
│   ├── cache_manager.py             # Global cache management
│   ├── event_bus.py                 # Pub/sub communication
│   ├── exceptions.py                # Custom exception hierarchy
│   ├── lazy_loader.py               # Lazy loading utilities
│   ├── logger.py                    # Logging configuration
│   ├── report_exporter.py           # PDF/Excel/CSV export
│   └── security.py                  # Password hashing (PBKDF2)
│
├── views/                           # UI layer (PySide6)
│   ├── __pycache__/
│   ├── base_view.py                 # Base view class
│   ├── login_view.py                # Login screen
│   ├── main_window.py               # Main application window
│   └── widgets/                     # UI widgets (15 files)
│       ├── asset_dialog.py
│       ├── asset_view.py
│       ├── backup_view.py
│       ├── banking_view.py
│       ├── chart_of_accounts_widget.py
│       ├── dashboard_view.py
│       ├── expense_view.py
│       ├── item_view.py
│       ├── manufacturing_view.py
│       ├── opening_balance_dialog.py
│       ├── party_view.py
│       ├── payment_view.py
│       ├── purchase_invoice_view.py
│       ├── report_view.py
│       ├── sales_invoice_view.py
│       └── users_view.py
│
├── logs/                            # Application logs
│   └── erp.log
│
├── backups/                         # Database backups
│   └── erp_backup_YYYYMMDD_HHMMSS.db/sql
│
├── data/                            # Local database files
│   ├── company_1.db
│   └── erp.db
│
└── project/                         # Legacy project files
    ├── init_db.py
    └── fix_database.py
```

### File Count by Module

| Module | File Count | Purpose |
|--------|-----------|---------|
| **Controllers** | 12 | UI logic handlers |
| **Models** | 12 | Data structures |
| **Repositories** | 15 | Data access layer |
| **Services** | 13 | Business logic |
| **Views/Widgets** | 18 | User interface |
| **Database** | 8 | Connection & schema |
| **Reports** | 6 | Financial reports |
| **Utils** | 7 | Helper functions |

---

## Database Architecture

### Database Schema Overview

The database consists of **20+ tables** organized into logical groups:

#### 1. Multi-Tenancy Foundation

**companies**
```sql
CREATE TABLE companies (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    address         TEXT,
    phone           TEXT,
    email           TEXT,
    ntn             TEXT,              -- National Tax Number
    logo_path       TEXT,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**warehouses**
```sql
CREATE TABLE warehouses (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id      INTEGER NOT NULL REFERENCES companies(id),
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    address         TEXT,
    is_default      INTEGER NOT NULL DEFAULT 0,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (company_id, code)
);
```

#### 2. Authentication & Authorization

**roles**
```sql
CREATE TABLE roles (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    description     TEXT
);
```

**permissions**
```sql
CREATE TABLE permissions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    code            TEXT NOT NULL UNIQUE,
    description     TEXT
);
```

**role_permissions** (Junction Table)
```sql
CREATE TABLE role_permissions (
    role_id         INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);
```

**users**
```sql
CREATE TABLE users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    password_salt   TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    email           TEXT,
    role_id         INTEGER NOT NULL REFERENCES roles(id),
    is_active       INTEGER NOT NULL DEFAULT 1,
    last_login_at   TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### 3. Chart of Accounts (Double-Entry Core)

**accounts**
```sql
CREATE TABLE accounts (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id          INTEGER NOT NULL REFERENCES companies(id),
    account_code        TEXT NOT NULL,
    account_name        TEXT NOT NULL,
    parent_account_id   INTEGER REFERENCES accounts(id),
    account_type        TEXT NOT NULL CHECK (account_type IN 
                          ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
    account_subtype     TEXT,
    opening_balance     REAL NOT NULL DEFAULT 0,
    is_system_account   INTEGER NOT NULL DEFAULT 0,
    is_active           INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (company_id, account_code)
);
```

**Indexes on accounts:**
- `idx_accounts_type` - Filter by account type
- `idx_accounts_company_active` - Company-specific active accounts
- `idx_accounts_code_order` - Ordered by account code
- `idx_accounts_company_code` - Composite lookup

**journal_entries**
```sql
CREATE TABLE journal_entries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id      INTEGER NOT NULL REFERENCES companies(id),
    voucher_number  TEXT NOT NULL,
    voucher_type    TEXT NOT NULL CHECK (voucher_type IN
                      ('JOURNAL','SALES','SALES_RETURN','PURCHASE','PURCHASE_RETURN',
                       'PAYMENT','RECEIPT','MANUFACTURING','STOCK_ADJUSTMENT','OPENING')),
    entry_date      TEXT NOT NULL,
    reference_no    TEXT,
    narration       TEXT,
    source_table    TEXT,              -- e.g., "sales_invoices"
    source_id       INTEGER,           -- FK to source document
    is_posted       INTEGER NOT NULL DEFAULT 1,
    created_by      INTEGER REFERENCES users(id),
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (company_id, voucher_number)
);
```

**Indexes on journal_entries:**
- `idx_je_date` - Date range queries
- `idx_je_source` - Source document lookup
- `idx_je_posted` - Posted entries filter
- `idx_je_company_date` - Company-specific date filtering
- `idx_je_company_posted` - Company posted entries

**journal_entry_lines**
```sql
CREATE TABLE journal_entry_lines (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    journal_entry_id    INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id          INTEGER NOT NULL REFERENCES accounts(id),
    party_id            INTEGER REFERENCES parties(id),
    debit               REAL NOT NULL DEFAULT 0,
    credit              REAL NOT NULL DEFAULT 0,
    description         TEXT,
    line_order          INTEGER NOT NULL DEFAULT 0,
    CHECK (debit >= 0 AND credit >= 0),
    CHECK (NOT (debit > 0 AND credit > 0))  -- Can't have both debit and credit
);
```

**Indexes on journal_entry_lines:**
- `idx_jel_account` - Account-wise ledger
- `idx_jel_party` - Party-wise transactions
- `idx_jel_account_je` - Composite for fast lookups

#### 4. Party Management

**parties**
```sql
CREATE TABLE parties (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id      INTEGER NOT NULL REFERENCES companies(id),
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    party_type      TEXT NOT NULL CHECK (party_type IN ('CUSTOMER','SUPPLIER','BOTH')),
    customer_category TEXT CHECK (customer_category IN 
        ('FARMER','INDIVIDUAL','BUSINESS') OR customer_category IS NULL),
    phone           TEXT,
    address         TEXT,
    email           TEXT,
    opening_balance REAL NOT NULL DEFAULT 0,
    credit_limit    REAL NOT NULL DEFAULT 0,
    account_id      INTEGER REFERENCES accounts(id),  -- Linked AR/AP account
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (company_id, code)
);
```

**Indexes on parties:**
- `idx_parties_type` - Filter by customer/supplier
- `idx_parties_name` - Name search
- `idx_parties_company_type` - Composite filtering

#### 5. Inventory Management

**items**
```sql
CREATE TABLE items (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id          INTEGER NOT NULL REFERENCES companies(id),
    item_code           TEXT NOT NULL,
    item_name           TEXT NOT NULL,
    item_type           TEXT NOT NULL CHECK (item_type IN 
                          ('RAW_MATERIAL','PACKING_MATERIAL','FINISHED_GOOD','OTHER')),
    category            TEXT,
    unit_of_measure     TEXT NOT NULL DEFAULT 'UNIT',
    purchase_price      REAL NOT NULL DEFAULT 0,
    selling_price       REAL NOT NULL DEFAULT 0,
    min_stock_level     REAL NOT NULL DEFAULT 0,
    max_stock_level     REAL NOT NULL DEFAULT 0,
    tax_rate_id         INTEGER REFERENCES tax_rates(id),
    is_active           INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT,
    UNIQUE (company_id, item_code)
);
```

**stock_batches**
```sql
CREATE TABLE stock_batches (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id          INTEGER NOT NULL REFERENCES companies(id),
    item_id             INTEGER NOT NULL REFERENCES items(id),
    warehouse_id        INTEGER NOT NULL REFERENCES warehouses(id),
    batch_number        TEXT NOT NULL,
    quantity_in_stock   REAL NOT NULL DEFAULT 0,
    unit_cost           REAL NOT NULL DEFAULT 0,
    manufacturing_date  TEXT,
    expiry_date         TEXT,
    is_active           INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (company_id, item_id, warehouse_id, batch_number)
);
```

**Indexes on stock_batches:**
- `idx_batches_item_warehouse` - Fast stock lookup

#### 6. Sales & Purchase Invoices

**sales_invoices**
```sql
CREATE TABLE sales_invoices (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id          INTEGER NOT NULL REFERENCES companies(id),
    invoice_number      TEXT NOT NULL,
    customer_id         INTEGER NOT NULL REFERENCES parties(id),
    invoice_date        TEXT NOT NULL,
    payment_type        TEXT NOT NULL CHECK (payment_type IN 
                          ('CASH','BANK','CHEQUE','CREDIT')),
    subtotal            REAL NOT NULL DEFAULT 0,
    discount_amount     REAL NOT NULL DEFAULT 0,
    tax_amount          REAL NOT NULL DEFAULT 0,
    total_amount        REAL NOT NULL DEFAULT 0,
    notes               TEXT,
    status              TEXT NOT NULL DEFAULT 'CONFIRMED' 
                          CHECK (status IN ('DRAFT','CONFIRMED','CANCELLED')),
    warehouse_id        INTEGER NOT NULL REFERENCES warehouses(id),
    bank_account_id     INTEGER REFERENCES bank_accounts(id),
    journal_entry_id    INTEGER REFERENCES journal_entries(id),
    created_by          INTEGER REFERENCES users(id),
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT,
    UNIQUE (company_id, invoice_number)
);
```

**sales_invoice_items**
```sql
CREATE TABLE sales_invoice_items (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id          INTEGER NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    item_id             INTEGER NOT NULL REFERENCES items(id),
    batch_id            INTEGER REFERENCES stock_batches(id),
    quantity            REAL NOT NULL DEFAULT 0,
    unit_price          REAL NOT NULL DEFAULT 0,
    discount_amount     REAL NOT NULL DEFAULT 0,
    tax_amount          REAL NOT NULL DEFAULT 0,
    amount              REAL NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**purchase_invoices** (similar structure to sales_invoices)  
**purchase_invoice_items** (similar structure to sales_invoice_items)

#### 7. Manufacturing

**bom** (Bill of Materials)
```sql
CREATE TABLE bom (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id          INTEGER NOT NULL REFERENCES companies(id),
    bom_name            TEXT NOT NULL,
    finished_item_id    INTEGER NOT NULL REFERENCES items(id),
    output_quantity     REAL NOT NULL DEFAULT 1,
    notes               TEXT,
    is_active           INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (company_id, bom_name)
);
```

**bom_components**
```sql
CREATE TABLE bom_components (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    bom_id              INTEGER NOT NULL REFERENCES bom(id) ON DELETE CASCADE,
    component_item_id   INTEGER NOT NULL REFERENCES items(id),
    quantity_required   REAL NOT NULL DEFAULT 0,
    wastage_percent     REAL NOT NULL DEFAULT 0,
    line_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**production_orders**
```sql
CREATE TABLE production_orders (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id          INTEGER NOT NULL REFERENCES companies(id),
    order_number        TEXT NOT NULL,
    bom_id              INTEGER NOT NULL REFERENCES bom(id),
    planned_quantity    REAL NOT NULL DEFAULT 0,
    actual_quantity     REAL NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'PLANNED'
                          CHECK (status IN ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED')),
    start_date          TEXT,
    completion_date     TEXT,
    warehouse_id        INTEGER NOT NULL REFERENCES warehouses(id),
    notes               TEXT,
    journal_entry_id    INTEGER REFERENCES journal_entries(id),
    created_by          INTEGER REFERENCES users(id),
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (company_id, order_number)
);
```

**production_consumption**
```sql
CREATE TABLE production_consumption (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    production_order_id INTEGER NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
    item_id             INTEGER NOT NULL REFERENCES items(id),
    batch_id            INTEGER REFERENCES stock_batches(id),
    quantity_consumed   REAL NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### 8. Banking

**bank_accounts**
```sql
CREATE TABLE bank_accounts (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id          INTEGER NOT NULL REFERENCES companies(id),
    account_id          INTEGER NOT NULL REFERENCES accounts(id),
    bank_name           TEXT NOT NULL,
    account_title       TEXT NOT NULL,
    account_number      TEXT NOT NULL,
    branch_code         TEXT,
    iban                TEXT,
    opening_balance     REAL NOT NULL DEFAULT 0,
    is_active           INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**cheques**
```sql
CREATE TABLE cheques (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id          INTEGER NOT NULL REFERENCES companies(id),
    bank_account_id     INTEGER NOT NULL REFERENCES bank_accounts(id),
    party_id            INTEGER REFERENCES parties(id),
    cheque_number       TEXT NOT NULL,
    cheque_type         TEXT NOT NULL CHECK (cheque_type IN ('ISSUED','RECEIVED')),
    amount              REAL NOT NULL,
    cheque_date         TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'UNCLEARED'
                          CHECK (status IN ('UNCLEARED','CLEARED','BOUNCED','LOST')),
    cleared_date        TEXT,
    notes               TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**bank_transactions**
```sql
CREATE TABLE bank_transactions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_account_id     INTEGER NOT NULL REFERENCES bank_accounts(id),
    transaction_type    TEXT NOT NULL CHECK (transaction_type IN
                          ('DEPOSIT','WITHDRAWAL','TRANSFER_IN','TRANSFER_OUT')),
    amount              REAL NOT NULL,
    transaction_date    TEXT NOT NULL,
    reference_no        TEXT,
    notes               TEXT,
    journal_entry_id    INTEGER REFERENCES journal_entries(id),
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### 9. Expenses

**expense_categories**
```sql
CREATE TABLE expense_categories (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id          INTEGER NOT NULL REFERENCES companies(id),
    name                TEXT NOT NULL,
    account_id          INTEGER REFERENCES accounts(id),
    is_active           INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (company_id, name)
);
```

**expenses**
```sql
CREATE TABLE expenses (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id          INTEGER NOT NULL REFERENCES companies(id),
    voucher_number      TEXT NOT NULL,
    category_id         INTEGER NOT NULL REFERENCES expense_categories(id),
    expense_date        TEXT NOT NULL,
    amount              REAL NOT NULL,
    payment_method      TEXT NOT NULL CHECK (payment_method IN ('CASH','BANK','CHEQUE')),
    bank_account_id     INTEGER REFERENCES bank_accounts(id),
    cheque_id           INTEGER REFERENCES cheques(id),
    description         TEXT,
    created_by          INTEGER REFERENCES users(id),
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT,
    UNIQUE (company_id, voucher_number)
);
```

#### 10. Additional Tables

**tax_rates**
```sql
CREATE TABLE tax_rates (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id      INTEGER NOT NULL REFERENCES companies(id),
    name            TEXT NOT NULL,
    tax_type        TEXT NOT NULL CHECK (tax_type IN ('SALES_TAX','WITHHOLDING_TAX')),
    rate_percent    REAL NOT NULL,
    is_active       INTEGER NOT NULL DEFAULT 1,
    UNIQUE (company_id, name)
);
```

**asset_details**
```sql
CREATE TABLE asset_details (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id          INTEGER NOT NULL REFERENCES accounts(id),
    asset_type          TEXT CHECK (asset_type IN ('CURRENT', 'NON_CURRENT')),
    purchase_amount     REAL NOT NULL DEFAULT 0,
    purchase_date       TEXT,
    supplier_id         INTEGER REFERENCES parties(id),
    due_date            TEXT,
    notes               TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (account_id)
);
```

**payments** & **receipts** - Track cash/bank movements  
**audit_log** - User action tracking  
**settings** - Key/value configuration storage  
**numbering_sequences** - Auto-increment document numbers

### Database Indexes (Performance Optimization)

The schema includes strategic indexes for query performance:

| Index Name | Table | Columns | Purpose |
|------------|-------|---------|---------|
| `idx_accounts_type` | accounts | account_type | Type filtering |
| `idx_accounts_company_active` | accounts | company_id, is_active | Active accounts per company |
| `idx_accounts_code_order` | accounts | company_id, account_code | Ordered chart of accounts |
| `idx_accounts_company_code` | accounts | company_id, account_code | Code lookup |
| `idx_je_date` | journal_entries | entry_date | Date range queries |
| `idx_je_source` | journal_entries | source_table, source_id | Document tracing |
| `idx_je_posted` | journal_entries | is_posted, id | Posted entries |
| `idx_je_company_date` | journal_entries | company_id, entry_date | Company date filtering |
| `idx_je_company_posted` | journal_entries | company_id, is_posted | Company posted filter |
| `idx_jel_account` | journal_entry_lines | account_id | Ledger queries |
| `idx_jel_party` | journal_entry_lines | party_id | Party transactions |
| `idx_jel_account_je` | journal_entry_lines | account_id, journal_entry_id | Fast joins |
| `idx_parties_type` | parties | party_type | Customer/supplier filter |
| `idx_parties_name` | parties | name | Name search |
| `idx_parties_company_type` | parties | company_id, party_type | Composite filter |
| `idx_items_company_active` | items | company_id, is_active | Active items |
| `idx_batches_item_warehouse` | stock_batches | item_id, warehouse_id | Stock lookup |
| `idx_si_company_date_status` | sales_invoices | company_id, invoice_date, status | Invoice queries |
| `idx_pi_company_date_status` | purchase_invoices | company_id, invoice_date, status | PO queries |
| `idx_payments_company_date` | payments | company_id, payment_date | Payment history |
| `idx_receipts_company_date` | receipts | company_id, receipt_date | Receipt history |
| `idx_asset_details_account` | asset_details | account_id | Asset lookup |
| `idx_audit_entity` | audit_log | entity_table, entity_id | Audit trail |

### Default Data Seeding

The system seeds the following default data on first run:

1. **Default Company** (id=1)
2. **Default Warehouse** (id=1)
3. **Chart of Accounts** - Complete COA with standard accounts:
   - Assets (1000-1999): Cash, Bank, Accounts Receivable, Inventory, Fixed Assets
   - Liabilities (2000-2999): Accounts Payable, Loans, Tax Payable
   - Equity (3000-3999): Capital, Retained Earnings
   - Revenue (4000-4999): Sales Income, Service Income
   - Expenses (5000-5999): COGS, Operating Expenses
4. **Default Roles**: Admin, Manager, Accountant, User
5. **Default Permissions**: CRUD permissions for each module
6. **Admin User**: Default administrator account

---

## Core Modules Documentation

### 1. Authentication Module (`/authentication`)

**File:** `auth_service.py`

**Purpose:** Secure user authentication with password hashing and role-based access control.

**Key Class:** `AuthService`

```python
class AuthService:
    def __init__(self, db: DatabaseConnection | None = None)
    
    def login(self, username: str, password: str) -> User
    def logout(self) -> None
    def create_user(self, user_data: dict) -> User
    def update_user(self, user_id: int, user_data: dict) -> None
    def reset_password(self, user_id: int, new_password: str) -> None
    def verify_password(plain_password: str, salt: str, expected_hash: str) -> bool
    def get_user_permissions(user_id: int) -> list[str]
    def can_access(user: User, permission_code: str) -> bool
```

**Password Security:**
- Algorithm: PBKDF2-HMAC-SHA256
- Iterations: 200,000
- Salt: Random 32-byte salt stored per user
- Hash Storage: Hex-encoded hash in database

**Authentication Flow:**
```
1. User enters credentials in LoginView
2. AuthController.validate_credentials() called
3. AuthService.login() fetches user from DB
4. verify_password() compares hash
5. On success: Load permissions, set current_user singleton
6. On failure: Raise AuthenticationError
```

**Session Management:**
- Single active session per user (configurable)
- `last_login_at` timestamp tracked
- `current_user` singleton accessible via `AuthService.get_current_user()`

---

### 2. Accounting Service (`/services/accounting_service.py`)

**⭐ This is the CORE engine of the entire ERP system.**

**Purpose:** Enforce double-entry accounting principles, generate journal entries, maintain audit trail.

**Key Class:** `AccountingService`

```python
class AccountingService:
    def __init__(self, db: DatabaseConnection | None = None)
    
    def post_journal_entry(
        voucher_type: VoucherType,
        entry_date: str,
        lines: list[JournalLine],
        narration: str | None = None,
        reference_no: str | None = None,
        source_table: str | None = None,
        source_id: int | None = None,
        created_by: int | None = None,
        company_id: int = 1,
        voucher_number: str | None = None
    ) -> int
    
    def get_account_balance(account_id: int) -> float
    def get_trial_balance(company_id: int = 1) -> list[dict]
    def get_party_balance(party_id: int, company_id: int = 1) -> float
```

**JournalLine DataClass:**
```python
@dataclass
class JournalLine:
    account_id: int
    debit: float = 0.0
    credit: float = 0.0
    party_id: int | None = None
    description: str | None = None
```

**Validation Rules:**
1. **Minimum 2 Lines:** Every journal entry must have at least 2 lines
2. **Debit = Credit:** Sum of debits must equal sum of credits (±0.01 tolerance)
3. **No Negative Amounts:** Debit and credit values must be ≥ 0
4. **No Dual Entry:** A single line cannot have both debit and credit

**Voucher Number Generation:**
- Format: `{PREFIX}-{YYYYMMDD}-{SEQ}` (e.g., `SLS-20260801-001`)
- Prefixes by type:
  - SALES: `SLS`
  - PURCHASE: `PUR`
  - PAYMENT: `PAY`
  - RECEIPT: `REC`
  - JOURNAL: `JNL`
  - MANUFACTURING: `MFG`
- Sequential per day, gap-free

**Source Document Linking:**
- `source_table`: Name of originating table (e.g., "sales_invoices")
- `source_id`: Primary key of originating document
- Enables drill-down from ledger to source document

**Example Usage (Sales Invoice):**
```python
# Service layer creates journal lines
lines = [
    JournalLine(account_id=cash_account_id, debit=1000.00),
    JournalLine(account_id=sales_account_id, credit=900.00),
    JournalLine(account_id=tax_account_id, credit=100.00),
]

# Post within transaction
with db.transaction():
    invoice_id = invoice_repo.insert(invoice_data)
    AccountingService.post_journal_entry(
        voucher_type=VoucherType.SALES,
        entry_date="2026-08-01",
        lines=lines,
        narration="Sale to Customer XYZ",
        source_table="sales_invoices",
        source_id=invoice_id,
        created_by=current_user.id
    )
```

---

### 3. Sales Invoice Module

**Files:**
- `services/sales_invoice_service.py`
- `controllers/sales_invoice_controller.py`
- `views/widgets/sales_invoice_view.py`
- `models/sales_invoice.py`
- `repositories/sales_invoice_repository.py`

**Key Class:** `SalesInvoiceService`

**Main Method:**
```python
def create_sales_invoice(
    invoice_number: str,
    customer_id: int,
    invoice_date: str,
    payment_type: str,        # CASH, BANK, CHEQUE, CREDIT
    items: List[dict],        # [{item_id, quantity, unit_price, discount, tax}]
    notes: str | None = None,
    company_id: int = 1,
    warehouse_id: int = 1,
    created_by: int | None = None,
    bank_account_id: int | None = None
) -> SalesInvoice
```

**Validation Steps:**
1. Invoice number uniqueness
2. Customer existence and active status
3. Customer type validation (must be CUSTOMER or BOTH)
4. Item existence and active status
5. Stock availability check (per item)
6. Price and quantity validation
7. Payment type validity

**Calculation Logic:**
```python
# Per line item
line_total = (quantity × unit_price) - discount + tax

# Invoice totals
subtotal = Σ(quantity × unit_price)
discount_amount = Σ(discount)
tax_amount = Σ(tax)
total_amount = subtotal - discount_amount + tax_amount
```

**Stock Update Process:**
1. Check available stock in `stock_batches`
2. Deduct quantity from appropriate batch (FIFO method)
3. Raise `InsufficientStockError` if stock < required

**Journal Entry Creation:**

**For CASH Sales:**
```
Dr Cash/Bank Account          1,000.00
    Cr Sales Account                      900.00
    Cr Tax Payable Account                100.00
```

**For CREDIT Sales:**
```
Dr Accounts Receivable        1,000.00
    Cr Sales Account                      900.00
    Cr Tax Payable Account                100.00
```

**Transaction Atomicity:**
All operations wrapped in single transaction:
```python
with db.transaction():
    # 1. Insert invoice header
    invoice_id = invoice_repo.insert(invoice)
    
    # 2. Insert invoice items
    for item in items:
        item_repo.insert(item)
    
    # 3. Post journal entry
    accounting_service.post_journal_entry(...)
    
    # 4. Update stock batches
    stock_repo.update_quantities(...)
```

If any step fails, entire transaction rolls back.

---

### 4. Purchase Invoice Module

**Similar structure to Sales Invoice, with reversed accounting entries.**

**Key Differences:**
- Supplier instead of customer
- Stock increases (not decreases)
- Different journal entry accounts

**Journal Entry for CASH Purchase:**
```
Dr Inventory Account            900.00
Dr Tax Recoverable Account      100.00
    Cr Cash/Bank Account                    1,000.00
```

**Journal Entry for CREDIT Purchase:**
```
Dr Inventory Account            900.00
Dr Tax Recoverable Account      100.00
    Cr Accounts Payable Account             1,000.00
```

---

### 5. Manufacturing Module

**Files:**
- `services/manufacturing_service.py`
- `models/bill_of_materials.py`
- `models/production_order.py`
- `repositories/bom_repository.py`
- `repositories/production_order_repository.py`

#### Bill of Materials (BOM)

**Purpose:** Define recipe for finished goods from raw materials.

**Key Method:**
```python
def create_bom(
    finished_item_id: int,
    output_quantity: float,
    components: list[dict],      # [{component_item_id, quantity_required, wastage_percent}]
    bom_name: str | None = None,  # Auto-generated if not provided
    notes: str | None = None,
    company_id: int = 1
) -> BillOfMaterials
```

**Validation:**
1. Finished item must be of type `FINISHED_GOOD`
2. Components must be `RAW_MATERIAL` or `PACKING_MATERIAL`
3. Output quantity > 0
4. At least one component required
5. Wastage percentage between 0-100%

**Auto-Generated BOM Name:**
- Uses voucher number generator with prefix "BOM"
- Example: `BOM-20260801-001`

#### Production Order Completion

**Key Method:**
```python
def complete_production_order(
    order_id: int,
    actual_qty: float,
    completed_by: int | None = None
) -> ProductionOrder
```

**Process Flow:**
1. Fetch BOM and calculate required components
2. For each component:
   - Calculate required quantity: `(actual_qty / output_qty) × quantity_required`
   - Apply wastage: `required × (1 + wastage_percent/100)`
   - Deduct from stock (FIFO by batch)
3. Add finished goods to stock
4. Calculate production cost: `Σ(component_qty × component_cost)`
5. Post journal entry

**Journal Entry:**
```
Dr Finished Goods Inventory     XXXX.XX
    Dr Wastage Expense (if any)     XX.XX
    Cr Raw Materials Inventory              XXXX.XX
```

---

### 6. Payment Service

**Purpose:** Process customer receipts and supplier payments.

**Key Method:**
```python
def create_payment(
    party_id: int,
    amount: float,
    payment_method: str,       # CASH, BANK, CHEQUE
    is_receipt: bool,          # True = customer paying us, False = we pay supplier
    payment_date: str,
    reference_no: str | None = None,
    company_id: int = 1
) -> dict
```

**Receipt from Customer:**
```
Dr Cash/Bank Account            XXXX.XX
    Cr Accounts Receivable                XXXX.XX
```

**Payment to Supplier:**
```
Dr Accounts Payable             XXXX.XX
    Cr Cash/Bank Account                  XXXX.XX
```

---

### 7. Dashboard Service

**Purpose:** Aggregate key metrics for dashboard display.

**Key Method:**
```python
def get_dashboard_data(company_id: int = 1) -> dict
```

**Returns:**
```python
{
    "today_sales": {"count": 10, "total": 50000.00},
    "today_purchases": {"count": 5, "total": 30000.00},
    "cash_balance": 25000.00,
    "bank_balance": 75000.00,
    "accounts_receivable": 45000.00,
    "accounts_payable": 35000.00,
    "low_stock_items": [...],
    "top_customers": [...],
    "top_suppliers": [...],
    "monthly_sales_trend": [data points for last 7 days]
}
```

**Optimization:** Single optimized query with multiple JOINs and GROUP BY clauses.

---

## API Reference

### Repository Layer Methods

All repositories extend `BaseRepository` which provides:

```python
class BaseRepository:
    def get_by_id(id: int) -> dict | None
    def get_all(limit: int = 100, offset: int = 0) -> list[dict]
    def find_by_field(field: str, value: Any) -> list[dict]
    def insert(data: dict) -> int          # Returns new ID
    def update(id: int, data: dict) -> None
    def delete(id: int) -> None
    def count() -> int
```

### Key Repository Methods

**AccountRepository:**
```python
def find_by_code(code: str, company_id: int = 1) -> dict | None
def get_current_balance(account_id: int) -> float
def find_all_for_company(company_id: int = 1, active_only: bool = True) -> list[dict]
def get_accounts_by_type(account_type: str, company_id: int = 1) -> list[dict]
```

**JournalRepository:**
```python
def next_voucher_number(company_id: int, voucher_type: str) -> str
def insert_entry(header: dict, lines: list[dict]) -> int
def find_by_source(source_table: str, source_id: int) -> dict | None
def get_entries_by_date_range(from_date: str, to_date: str) -> list[dict]
```

**StockBatchRepository:**
```python
def find_by_item_and_warehouse(item_id: int, warehouse_id: int) -> dict | None
def update_quantity(batch_id: int, quantity_change: float, use_cache: bool = True) -> None
def get_available_stock(item_id: int, warehouse_id: int = 1) -> float
```

**PartyRepository:**
```python
def find_by_code(code: str, company_id: int = 1) -> dict | None
def get_current_balance(party_id: int) -> float
def find_customers(company_id: int = 1) -> list[dict]
def find_suppliers(company_id: int = 1) -> list[dict]
```

---

## Data Flow & Workflows

### Sales Invoice Creation Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: User fills sales invoice form in SalesInvoiceView       │
│ - Selects customer                                              │
│ - Adds items with quantities and prices                         │
│ - Selects payment type (Cash/Credit)                            │
│ - Clicks "Save" button                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: SalesInvoiceController.create_invoice()                 │
│ - Gather form data                                              │
│ - Basic validation (required fields)                            │
│ - Call SalesInvoiceService.create_sales_invoice()               │
│ - Catch exceptions → Show QMessageBox                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: SalesInvoiceService.create_sales_invoice()              │
│ - Validate customer exists and active                           │
│ - Validate each item exists and active                          │
│ - Check stock availability for each item                        │
│ - Calculate: subtotal, discount, tax, total                     │
│ - Begin database transaction                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Within Transaction                                      │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 4a. Insert invoice header                                 │   │
│ │     → sales_invoices table                                │   │
│ └───────────────────────────────────────────────────────────┘   │
│                              ↓                                  │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 4b. Insert invoice items                                  │   │
│ │     → sales_invoice_items table                           │   │
│ └───────────────────────────────────────────────────────────┘   │
│                              ↓                                  │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 4c. Build journal entry lines                             │   │
│ │     - If CASH: Dr Cash, Cr Sales, Cr Tax Payable          │   │
│ │     - If CREDIT: Dr AR, Cr Sales, Cr Tax Payable          │   │
│ └───────────────────────────────────────────────────────────┘   │
│                              ↓                                  │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 4d. Post journal entry                                    │   │
│ │     → AccountingService.post_journal_entry()              │   │
│ │     → journal_entries + journal_entry_lines tables        │   │
│ └───────────────────────────────────────────────────────────┘   │
│                              ↓                                  │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 4e. Update stock batches                                  │   │
│ │     → stock_batches.quantity_in_stock -= qty              │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Commit or Rollback                                      │
│ - If all steps succeed: COMMIT transaction                      │
│ - If any step fails: ROLLBACK entire transaction                │
│ - Return invoice object with generated ID                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Post-Save Actions                                       │
│ - Refresh invoice list in UI                                    │
│ - Show success message                                          │
│ - Optionally print/export invoice                               │
└─────────────────────────────────────────────────────────────────┘
```

### Manufacturing Order Completion Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: User selects production order in ManufacturingView      │
│ - Enters actual quantity produced                               │
│ - Clicks "Complete Order"                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: ManufacturingService.complete_production_order()        │
│ - Fetch production order and linked BOM                         │
│ - Calculate component consumption based on actual output        │
│ - Begin transaction                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: For Each BOM Component                                  │
│ - Calculate required qty: (actual/output) × qty_required        │
│ - Add wastage: required × (1 + wastage%/100)                    │
│ - Find stock batch (FIFO)                                       │
│ - Deduct from stock                                             │
│ - Record in production_consumption table                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Add Finished Goods to Stock                             │
│ - Create/find stock batch for finished item                     │
│ - Increase quantity_in_stock                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Calculate Production Cost                               │
│ - Sum(component_qty × component_unit_cost)                      │
│ - Calculate per-unit cost: total_cost / actual_qty              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Post Journal Entry                                      │
│ Dr Finished Goods Inventory     (total_cost)                    │
│ Dr Wastage Expense (if any)     (wastage_cost)                  │
│     Cr Raw Materials Inventory          (total_component_cost)  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 7: Update Production Order Status                          │
│ - Set status = "COMPLETED"                                      │
│ - Set completion_date = now                                     │
│ - Link journal_entry_id                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Security Implementation

### Password Hashing

**Algorithm:** PBKDF2-HMAC-SHA256  
**Iterations:** 200,000  
**Salt Length:** 32 bytes (random)  
**Hash Encoding:** Hexadecimal string

**Implementation (`utils/security.py`):**
```python
import hashlib
import os

def hash_password(password: str) -> tuple[str, str]:
    """Hash password with random salt."""
    salt = os.urandom(32).hex()
    hash_obj = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        iterations=200000
    )
    return hash_obj.hex(), salt

def verify_password(plain_password: str, salt: str, expected_hash: str) -> bool:
    """Verify password against stored hash."""
    hash_obj = hashlib.pbkdf2_hmac(
        'sha256',
        plain_password.encode('utf-8'),
        salt.encode('utf-8'),
        iterations=200000
    )
    return hash_obj.hex() == expected_hash
```

### Role-Based Access Control (RBAC)

**Permission Codes:**
```python
PERMISSIONS = {
    # Sales
    'sales.view': 'View sales invoices',
    'sales.create': 'Create sales invoices',
    'sales.edit': 'Edit sales invoices',
    'sales.delete': 'Delete sales invoices',
    
    # Purchase
    'purchase.view': 'View purchase invoices',
    'purchase.create': 'Create purchase invoices',
    
    # Accounting
    'accounting.view': 'View financial reports',
    'accounting.journal': 'Post journal entries',
    
    # Master Data
    'items.manage': 'Manage items',
    'parties.manage': 'Manage parties',
    'accounts.manage': 'Manage chart of accounts',
    
    # Administration
    'admin.users': 'Manage users',
    'admin.backup': 'Backup/Restore database',
    'admin.settings': 'Modify system settings'
}
```

**Permission Checking:**
```python
class User:
    def can_access(self, permission_code: str) -> bool:
        return permission_code in self.permissions

# Usage in controller
if not current_user.can_access('sales.create'):
    raise AuthorizationError("You don't have permission to create sales invoices")
```

### SQL Injection Prevention

- All queries use parameterized statements
- No string concatenation for SQL
- ORM-style repository pattern

```python
# ✅ Correct
cursor.execute("SELECT * FROM users WHERE username = ?", (username,))

# ❌ Wrong (never do this)
cursor.execute(f"SELECT * FROM users WHERE username = '{username}'")
```

### Session Security

- Passwords never stored in plain text
- Session timeout configurable
- Last login timestamp tracked
- Failed login attempts logged

---

## Error Handling

### Exception Hierarchy

```
ERPException (Base)
├── DatabaseError
├── RecordNotFoundError
├── ValidationError
├── DuplicateRecordError
├── InsufficientStockError
├── UnbalancedJournalEntryError
├── AuthenticationError
├── AuthorizationError
└── ConfigurationError
```

### Exception Definitions (`utils/exceptions.py`)

```python
class ERPException(Exception):
    """Base class for all application exceptions."""

class DatabaseError(ERPException):
    """Raised when database operation fails."""

class RecordNotFoundError(ERPException):
    """Raised when lookup finds no matching record."""

class ValidationError(ERPException):
    """Raised when input fails business validation."""

class InsufficientStockError(ERPException):
    """Raised when sale/consumption exceeds available stock."""

class UnbalancedJournalEntryError(ERPException):
    """Raised when journal entry debits ≠ credits."""

class AuthenticationError(ERPException):
    """Raised when login credentials are invalid."""

class AuthorizationError(ERPException):
    """Raised when user lacks required permission."""
```

### Error Handling Pattern

**Service Layer:**
```python
def create_sales_invoice(...) -> SalesInvoice:
    if not customer:
        raise ValidationError("Customer does not exist.")
    
    if available_stock < quantity:
        raise InsufficientStockError(
            f"Insufficient stock for {item_name}. "
            f"Available: {available_stock}, Required: {quantity}"
        )
    
    try:
        # Business logic
    except Exception as e:
        logger.error(f"Error creating invoice: {e}", exc_info=True)
        raise
```

**Controller Layer:**
```python
def create_invoice(self, form_data: dict):
    try:
        invoice = self.service.create_sales_invoice(**form_data)
        QMessageBox.information(self.view, "Success", "Invoice created!")
        return invoice
    except ValidationError as e:
        QMessageBox.warning(self.view, "Validation Error", str(e))
    except InsufficientStockError as e:
        QMessageBox.critical(self.view, "Stock Error", str(e))
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        QMessageBox.critical(self.view, "Error", "An unexpected error occurred.")
```

**View Layer:**
```python
try:
    controller.create_invoice(form_data)
except ERPException as e:
    # Already handled by controller
    pass
```

---

## Caching Strategy

### Repository-Level Cache

**Implementation:** `repositories/base_repository.py`

```python
class BaseRepository:
    def __init__(self, db: DatabaseConnection):
        self.db = db
        self._cache: dict[str, tuple[Any, float]] = {}
        self._cache_ttl = 30  # seconds
    
    def _get_from_cache(self, key: str) -> Any | None:
        if key in self._cache:
            value, timestamp = self._cache[key]
            if time.time() - timestamp < self._cache_ttl:
                return value
            del self._cache[key]
        return None
    
    def _set_cache(self, key: str, value: Any) -> None:
        self._cache[key] = (value, time.time())
    
    def clear_cache(self) -> None:
        self._cache.clear()
```

**Cache Keys:**
```python
# Account lookup
f"account:{account_id}"
f"account_code:{code}:{company_id}"

# Party lookup
f"party:{party_id}"

# Stock lookup
f"stock:{item_id}:{warehouse_id}"

# Journal entry
f"journal:{journal_id}"
```

### Global Cache Manager

**File:** `utils/cache_manager.py`

```python
class CacheManager:
    _instance = None
    
    def __init__(self):
        self._repositories: dict[str, BaseRepository] = {}
    
    def register_repository(self, name: str, repo: BaseRepository) -> None:
        self._repositories[name] = repo
    
    def clear_all(self) -> None:
        for repo in self._repositories.values():
            repo.clear_cache()
    
    def clear_repository(self, name: str) -> None:
        if name in self._repositories:
            self._repositories[name].clear_cache()
    
    def clear_related_to_invoice(self, invoice_id: int) -> None:
        """Clear caches related to invoice operations."""
        self.clear_repository('account')
        self.clear_repository('stock')
        self.clear_repository('party')
```

### Cache Invalidation Patterns

**When to Clear Cache:**
1. After INSERT/UPDATE/DELETE operations
2. After posting journal entries
3. After stock changes
4. Before generating reports

**Example:**
```python
def create_sales_invoice(...) -> SalesInvoice:
    with db.transaction():
        invoice_id = invoice_repo.insert(invoice)
        
        # Post journal entry
        accounting_service.post_journal_entry(...)
        
        # Update stock
        stock_repo.update_quantities(...)
        
        # Clear related caches
        cache_manager.clear_repository('stock')
        cache_manager.clear_repository('account')
```

### Dashboard Cache

**TTL:** 60 seconds

```python
class DashboardService:
    def __init__(self):
        self._cache: dict | None = None
        self._cache_timestamp: float = 0
        self._cache_ttl = 60
    
    def get_dashboard_data(self, company_id: int = 1) -> dict:
        now = time.time()
        if self._cache and (now - self._cache_timestamp) < self._cache_ttl:
            return self._cache
        
        # Generate fresh data
        self._cache = self._generate_dashboard_data(company_id)
        self._cache_timestamp = now
        return self._cache
```

---

## Backup & Recovery

### Backup System Architecture

**Components:**
1. **Auto-backup Scheduler** (`database/auto_backup.py`)
2. **Backup Manager** (`database/backup_manager.py`)
3. **Manual Backup** (`database/backup.py`)
4. **Restore Functionality** (`restore_from_backup.py`)

### Auto-Backup Configuration

**File:** `config/backup_config.py`

```python
BACKUP_CONFIG = {
    'enabled': True,
    'interval_hours': 24,
    'max_backups': 14,
    'backup_dir': '/workspace/backups',
    'backup_format': 'sql',  # or 'db'
}
```

### Auto-Backup Process

**File:** `database/auto_backup.py`

```python
def auto_backup() -> str:
    """Create automatic backup."""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_filename = f"erp_backup_{timestamp}.sql"
    backup_path = os.path.join(BACKUP_DIR, backup_filename)
    
    # Export database to SQL dump
    conn = sqlitecloud.connect(CONNECTION_STRING)
    with open(backup_path, 'w') as f:
        for line in conn.iterdump():
            f.write(f"{line}\n")
    
    # Cleanup old backups
    cleanup_old_backups(max_keep=14)
    
    logger.info(f"Auto-backup created: {backup_path}")
    return backup_path
```

### Backup Scheduler

```python
class AutoBackupScheduler:
    def __init__(self, interval_hours: int = 24):
        self.interval = interval_hours * 3600  # seconds
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
    
    def start(self) -> None:
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
    
    def _run(self) -> None:
        while not self._stop_event.is_set():
            auto_backup()
            self._stop_event.wait(self.interval)
    
    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join()
```

### Manual Backup

**Via UI:** `views/widgets/backup_view.py`

**Options:**
1. **Backup Now:** Immediate backup creation
2. **Choose Location:** Custom backup directory
3. **Format Selection:** SQL dump or binary DB file

### Restore Process

**File:** `restore_from_backup.py`

```python
def restore_from_backup(backup_file: str) -> None:
    """Restore database from backup file."""
    conn = sqlitecloud.connect(CONNECTION_STRING)
    
    # Read backup file
    with open(backup_file, 'r') as f:
        sql_script = f.read()
    
    # Execute restoration
    with conn:
        # Drop existing tables
        drop_all_tables(conn)
        
        # Recreate schema
        run_migrations(conn)
        
        # Import data
        conn.executescript(sql_script)
    
    logger.info(f"Database restored from {backup_file}")
```

### Backup Files Location

**Directory:** `/workspace/backups/`

**Naming Convention:**
- `erp_backup_YYYYMMDD_HHMMSS.sql` - SQL dump format
- `erp_backup_YYYYMMDD_HHMMSS.db` - Binary database file

**Retention Policy:**
- Keep last 14 backups (configurable)
- Automatic deletion of older backups

### Exit Backup

**File:** `main.py`

```python
def cleanup():
    """Clean up on application exit."""
    try:
        # Create backup before closing
        logger.info("🔄 Creating exit backup...")
        auto_backup()
        logger.info("✅ Exit backup created")
        
        # Close database connections
        close_db()
        SQLiteCloudConnection.close_all()
        logger.info("✅ Database connections closed")
    except Exception as e:
        logger.warning(f"Cleanup error: {e}")

atexit.register(cleanup)
```

---

## Reporting System

### Report Architecture

**Base Class:** `reports/report_base.py`

```python
class Report(ABC):
    def __init__(self, db: DatabaseConnection | None = None):
        self.db = db or get_db()
        self.title = ""
        self.date_from: str | None = None
        self.date_to: str | None = None
        self.company_id: int = 1
    
    @abstractmethod
    def generate(self) -> dict:
        """Generate report data."""
        pass
    
    def set_date_range(self, date_from: str, date_to: str) -> None:
        self.date_from = date_from
        self.date_to = date_to
    
    def format_currency(self, amount: float) -> str:
        return f"Rs. {amount:,.2f}"
    
    def format_indian_currency(self, amount: float) -> str:
        """Format with Indian numbering (lakhs, crores)."""
        # Implementation handles 1,00,00,000 format
```

### Available Reports

#### 1. Trial Balance Report

**File:** `reports/trial_balance_report.py`

**Purpose:** List all accounts with debit/credit balances.

**Query Logic:**
```sql
SELECT 
    a.account_code,
    a.account_name,
    a.account_type,
    SUM(jel.debit) as total_debit,
    SUM(jel.credit) as total_credit
FROM accounts a
LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id
LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
WHERE a.company_id = ?
  AND a.is_active = 1
  AND (je.entry_date BETWEEN ? AND ? OR je.id IS NULL)
GROUP BY a.id
ORDER BY a.account_code
```

**Output Structure:**
```python
{
    "title": "Trial Balance",
    "sections": [
        {
            "title": "Assets",
            "rows": [
                {"account_code": "1000", "account_name": "Cash", "debit": 10000, "credit": 0},
                ...
            ],
            "total": 50000
        },
        ...
    ],
    "grand_total_debit": 100000,
    "grand_total_credit": 100000
}
```

#### 2. Profit & Loss Report

**File:** `reports/profit_loss_report.py`

**Purpose:** Calculate net profit/loss for a period.

**Structure:**
```
REVENUE
  ├─ Sales Income
  ├─ Service Income
  └─ Other Income
Total Revenue: XXXX

EXPENSES
  ├─ Cost of Goods Sold
  ├─ Operating Expenses
  ├─ Administrative Expenses
  └─ Financial Charges
Total Expenses: XXXX

NET PROFIT/(LOSS): XXXX
```

**Query Logic:**
```sql
SELECT 
    a.account_code,
    a.account_name,
    SUM(jel.credit - jel.debit) as balance
FROM accounts a
JOIN journal_entry_lines jel ON a.id = jel.account_id
JOIN journal_entries je ON jel.journal_entry_id = je.id
WHERE a.account_type IN ('REVENUE', 'EXPENSE')
  AND je.entry_date BETWEEN ? AND ?
GROUP BY a.id
ORDER BY a.account_code
```

#### 3. Balance Sheet Report

**File:** `reports/balance_sheet_report.py`

**Purpose:** Show financial position at a point in time.

**Structure:**
```
ASSETS
  Current Assets
    ├─ Cash in Hand
    ├─ Cash at Bank
    ├─ Accounts Receivable
    └─ Inventory
  Fixed Assets
    ├─ Land & Building
    ├─ Plant & Machinery
    └─ Vehicles
Total Assets: XXXX

LIABILITIES
  Current Liabilities
    ├─ Accounts Payable
    ├─ Short-term Loans
    └─ Tax Payable
  Long-term Liabilities
    └─ Bank Loans
Total Liabilities: XXXX

EQUITY
  ├─ Share Capital
  ├─ Retained Earnings
  └─ Current Year Profit (from P&L)
Total Equity: XXXX

Total Liabilities + Equity: XXXX
```

#### 4. Party Ledger Report

**File:** `reports/party_ledger_report.py`

**Purpose:** Show all transactions with a specific party.

**Query Logic:**
```sql
SELECT 
    je.entry_date,
    je.voucher_number,
    je.voucher_type,
    jel.description,
    jel.debit,
    jel.credit,
    jel.debit - jel.credit as running_balance
FROM journal_entry_lines jel
JOIN journal_entries je ON jel.journal_entry_id = je.id
WHERE jel.party_id = ?
  AND je.entry_date BETWEEN ? AND ?
ORDER BY je.entry_date, je.id
```

**Output:**
```
Date        | Voucher No  | Description     | Debit   | Credit  | Balance
----------------------------------------------------------------------------
2026-08-01  | SLS-001     | Sale Invoice    | 0       | 1000    | 1000
2026-08-05  | REC-001     | Payment Received| 500     | 0       | 500
```

#### 5. Cash Book Report

**File:** `reports/cash_book_report.py`

**Purpose:** Track cash transactions.

**Filters:**
- Cash accounts (account codes starting with '1000')
- Bank accounts (account codes starting with '1010')

### Report Export Options

**Supported Formats:**
1. **PDF** (ReportLab)
2. **Excel** (openpyxl)
3. **CSV** (built-in csv module)
4. **Print** (QPrinter)

**Export Implementation:**
```python
class ReportExporter:
    @staticmethod
    def export_to_pdf(report_data: dict, filename: str) -> str:
        """Generate PDF using ReportLab."""
        doc = SimpleDocTemplate(filename)
        elements = []
        
        # Title
        elements.append(Paragraph(report_data['title'], style_heading))
        
        # Table
        data = [['Date', 'Description', 'Debit', 'Credit']]
        for row in report_data['rows']:
            data.append([row['date'], row['desc'], row['debit'], row['credit']])
        
        table = Table(data)
        elements.append(table)
        
        doc.build(elements)
        return filename
    
    @staticmethod
    def export_to_excel(report_data: dict, filename: str) -> str:
        """Generate Excel workbook."""
        wb = Workbook()
        ws = wb.active
        ws.title = report_data['title']
        
        # Write headers
        for col, header in enumerate(headers, 1):
            ws.cell(row=1, column=col, value=header)
        
        # Write data rows
        for row_idx, row in enumerate(report_data['rows'], 2):
            for col_idx, value in enumerate(row.values(), 1):
                ws.cell(row=row_idx, column=col_idx, value=value)
        
        wb.save(filename)
        return filename
```

---

## User Interface

### Application Entry Point

**File:** `main.py`

**Startup Sequence:**
```python
def main():
    # 1. Configure environment
    os.environ['ERP_DB_ENGINE'] = 'sqlitecloud'
    os.environ['SQLITE_CLOUD_URL'] = '...'
    
    # 2. Initialize Qt application
    app = QApplication(sys.argv)
    app.setFont(QFont('Segoe UI', 10))
    
    # 3. Initialize database connection pool
    init_pool(SQLITE_CLOUD_URL)
    
    # 4. Run migrations (idempotent)
    run_migrations()
    
    # 5. Show login window
    login_view = LoginView()
    login_view.show()
    
    # 6. Start auto-backup scheduler
    start_auto_backup()
    
    # 7. Register cleanup on exit
    atexit.register(cleanup)
    
    sys.exit(app.exec())
```

### Login View

**File:** `views/login_view.py`

**Components:**
- Username input field
- Password input field (masked)
- Login button
- Error message label
- Company logo (optional)

**Styling:**
- Centered card layout
- Gradient background
- Modern flat design

**Flow:**
```python
def attempt_login(self):
    username = self.username_input.text()
    password = self.password_input.text()
    
    try:
        controller = AuthController()
        user = controller.login(username, password)
        
        # Open main window
        self.main_window = MainWindow(user)
        self.main_window.show()
        self.close()
        
    except AuthenticationError as e:
        self.error_label.setText(str(e))
        self.error_label.show()
```

### Main Window

**File:** `views/main_window.py`

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│  Header Bar                                                 │
│  [Logo] BOP Nutraceuticals ERP              [User] [Logout] │
├────────────┬────────────────────────────────────────────────┤
│            │                                                │
│  SIDEBAR   │           CONTENT AREA                         │
│            │                                                │
│  Dashboard │  ┌──────────────────────────────────┐          │
│  Sales     │  │                                  │          │
│  Purchase  │  │     Module-specific widget       │          │
│  Inventory │  │                                  │          │
│  Mfg       │  └──────────────────────────────────┘          │
│  Reports   │                                                │
│  Parties   │                                                │
│  Banking   │                                                │
│  Expenses  │                                                │
│            │                                                │
│  ────────  │                                                │
│  Settings  │                                                │
│  Logout    │                                                │
│            │                                                │
└────────────┴────────────────────────────────────────────────┘
```

**Sidebar Navigation:**
```python
MENU_ITEMS = [
    {'label': 'Dashboard', 'icon': 'dashboard.png', 'module': 'dashboard'},
    {'label': 'Sales Invoice', 'icon': 'sales.png', 'module': 'sales'},
    {'label': 'Purchase Invoice', 'icon': 'purchase.png', 'module': 'purchase'},
    {'label': 'Inventory', 'icon': 'inventory.png', 'module': 'inventory'},
    {'label': 'Manufacturing', 'icon': 'manufacturing.png', 'module': 'manufacturing'},
    {'label': 'Parties', 'icon': 'parties.png', 'module': 'parties'},
    {'label': 'Chart of Accounts', 'icon': 'accounts.png', 'module': 'accounts'},
    {'label': 'Banking', 'icon': 'banking.png', 'module': 'banking'},
    {'label': 'Expenses', 'icon': 'expenses.png', 'module': 'expenses'},
    {'label': 'Reports', 'icon': 'reports.png', 'module': 'reports'},
    {'label': 'Backup', 'icon': 'backup.png', 'module': 'backup'},
]
```

**Role-Based Menu Filtering:**
```python
def build_sidebar(self, user: User):
    for item in MENU_ITEMS:
        if user.can_access(f"{item['module']}.view"):
            button = QPushButton(item['label'])
            button.clicked.connect(lambda checked, m=item['module']: self.load_module(m))
            self.sidebar_layout.addWidget(button)
```

### Widgets

#### Dashboard Widget

**File:** `views/widgets/dashboard_view.py`

**Components:**
- Today's sales card (count + total)
- Today's purchases card
- Cash balance card
- Bank balance card
- Accounts receivable card
- Accounts payable card
- Low stock alert table
- Top customers chart
- Monthly sales trend graph

**Data Source:** `DashboardService.get_dashboard_data()`

#### Sales Invoice Widget

**File:** `views/widgets/sales_invoice_view.py`

**Components:**
- Invoice list table (sortable, filterable)
- "New Invoice" button
- Search box (by invoice number, customer name)
- Date range filter
- Export buttons (PDF, Excel, Print)

**Invoice Form Dialog:**
- Customer dropdown (autocomplete)
- Date picker
- Payment type dropdown
- Items table:
  - Item selection (autocomplete)
  - Batch selection (if applicable)
  - Quantity input
  - Unit price input
  - Discount input
  - Tax input
  - Line total (auto-calculated)
- Subtotal, discount, tax, total (auto-calculated)
- Notes textarea
- Save/Cancel buttons

#### Manufacturing Widget

**File:** `views/widgets/manufacturing_view.py`

**Tabs:**
1. **Bill of Materials**
   - BOM list
   - BOM creator wizard
   - Component table

2. **Production Orders**
   - Order list with status badges
   - Order creation dialog
   - Completion wizard (enter actual qty)

#### Report Widget

**File:** `views/widgets/report_view.py`

**Components:**
- Report type dropdown
- Date range picker (From/To)
- Generate button
- Results table
- Export buttons (PDF, Excel, CSV, Print)

**Dynamic Loading:**
```python
def generate_report(self, report_type: str):
    report_class = REPORT_CLASSES[report_type]
    report = report_class()
    report.set_date_range(self.date_from, self.date_to)
    
    data = report.generate()
    self.display_results(data)
```

### Styling

**Centralized Stylesheet:** `main.py`

```python
APP_STYLESHEET = """
/* Global Styles */
QWidget {
    font-family: 'Segoe UI', 'Microsoft YaHei', Arial, sans-serif;
    font-size: 16px;
    color: #1a1a2e;
}

QMainWindow {
    background: #f0f2f5;
}

/* Sidebar */
#sidebar {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #1a1a2e,
        stop:1 #16213e);
    border-right: 1px solid #0f3460;
}

#sidebar QListWidget::item:selected {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 #e94560,
        stop:1 #ff6b6b);
    color: #ffffff;
}

/* Buttons */
QPushButton {
    background: #e94560;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 20px;
}

QPushButton:hover {
    background: #ff6b6b;
}

/* Tables */
QTableWidget {
    gridline-color: #e0e0e0;
    alternate-background-color: #f9f9f9;
}

QTableWidget::item:selected {
    background: #e94560;
    color: white;
}
"""
```

---

## Configuration

### Environment Variables

**File:** `config/app_config.py`

```python
import os
from dataclasses import dataclass

@dataclass
class DatabaseConfig:
    engine: str = os.getenv('ERP_DB_ENGINE', 'sqlitecloud')
    sqlite_cloud_url: str = os.getenv('SQLITE_CLOUD_URL', '')
    local_db_path: str = os.getenv('ERP_LOCAL_DB', '/workspace/data/erp.db')

@dataclass
class AppConfig:
    log_level: str = os.getenv('ERP_LOG_LEVEL', 'INFO')
    backup_enabled: bool = os.getenv('ERP_BACKUP_ENABLED', 'true').lower() == 'true'
    backup_interval_hours: int = int(os.getenv('ERP_BACKUP_INTERVAL', '24'))
    max_backups: int = int(os.getenv('ERP_MAX_BACKUPS', '14'))
    
    @property
    def database(self) -> DatabaseConfig:
        return DatabaseConfig()

def get_config() -> AppConfig:
    return AppConfig()
```

### Supported Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ERP_DB_ENGINE` | `sqlitecloud` | Database engine (sqlitecloud, sqlite) |
| `SQLITE_CLOUD_URL` | (required) | SQLite Cloud connection string |
| `ERP_LOCAL_DB` | `/workspace/data/erp.db` | Local database path |
| `ERP_LOG_LEVEL` | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR) |
| `ERP_BACKUP_ENABLED` | `true` | Enable auto-backup |
| `ERP_BACKUP_INTERVAL` | `24` | Backup interval in hours |
| `ERP_MAX_BACKUPS` | `14` | Maximum backups to retain |

### Configuration Usage

```python
from config.app_config import get_config

config = get_config()

# Database connection
if config.database.engine == 'sqlitecloud':
    conn = sqlitecloud.connect(config.database.sqlite_cloud_url)
else:
    conn = sqlite3.connect(config.database.local_db_path)

# Logging
logging.basicConfig(level=getattr(logging, config.log_level))

# Backup scheduling
if config.backup_enabled:
    scheduler = AutoBackupScheduler(interval_hours=config.backup_interval_hours)
    scheduler.start()
```

---

## Installation & Deployment

### Prerequisites

1. **Python 3.9 or higher**
   ```bash
   python3 --version
   ```

2. **pip (Python package manager)**
   ```bash
   pip --version
   ```

3. **SQLite Cloud Account** (for hosted database)
   - Sign up at https://sqlite.cloud
   - Create a database
   - Get connection string

### Installation Steps

#### 1. Clone or Download Project

```bash
cd /workspace
# Or copy project files to /workspace
```

#### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

**requirements.txt:**
```
PySide6>=6.0.0
openpyxl>=3.0.0
beautifulsoup4>=4.9.0
```

#### 3. Configure Environment

Create `.env` file or set environment variables:

```bash
export ERP_DB_ENGINE=sqlitecloud
export SQLITE_CLOUD_URL="sqlitecloud://host:port/database?apikey=your_api_key"
export ERP_LOG_LEVEL=INFO
export ERP_BACKUP_ENABLED=true
```

Or on Windows:
```batch
set ERP_DB_ENGINE=sqlitecloud
set SQLITE_CLOUD_URL=sqlitecloud://host:port/database?apikey=your_api_key
```

#### 4. Initialize Database

First run will automatically:
- Create all tables
- Seed default company and warehouse
- Create chart of accounts
- Seed roles and permissions
- Create admin user

```bash
python main.py
```

#### 5. First Login

**Default Admin Credentials:**
- Username: `admin`
- Password: `admin123` (or as configured in migrator)

**⚠️ Change default password immediately!**

### Running the Application

#### Development Mode

```bash
python main.py
```

#### Production Mode (Windows)

Double-click `setup.bat` or `main.py - Shortcut.lnk`

#### Production Mode (Linux/Mac)

```bash
nohup python main.py > erp.log 2>&1 &
```

### Database Migration

Migrations run automatically on startup:

```python
# main.py
from database.migrations.migrator import run_migrations

# Idempotent - safe to run multiple times
run_migrations()
```

### Backup Configuration

Edit `config/backup_config.py`:

```python
BACKUP_CONFIG = {
    'enabled': True,
    'interval_hours': 24,
    'max_backups': 14,
    'backup_dir': '/path/to/backups',
}
```

### Logging Configuration

Logs written to `/workspace/logs/erp.log`

**Rotation:**
- Max file size: 5 MB
- Max backup files: 5
- Level: INFO (configurable)

---

## Performance Optimizations

### Database Indexes

Strategic indexes on frequently queried columns:

**See "Database Indexes" section above for complete list.**

### Connection Pooling

**Pool Size:** 20 connections (configurable)

```python
class ConnectionPool:
    def __init__(self, max_connections: int = 20):
        self.max_connections = max_connections
        self._connections: list = []
```

**Benefits:**
- Reuse connections (avoid overhead of creating new)
- Thread-safe connection management
- Automatic cleanup of dead connections

### Query Optimization

**Before:**
```python
# N+1 query problem
for invoice in invoices:
    customer = party_repo.get_by_id(invoice.customer_id)
```

**After:**
```python
# Single query with JOIN
invoices_with_customers = invoice_repo.get_all_with_customers()
```

### Caching

**Multi-level caching:**
1. Repository-level cache (30s TTL)
2. Dashboard cache (60s TTL)
3. Account lookup cache (in AccountingService)

### Bulk Operations

**Stock Update Optimization:**
```python
# Before: One query per item
for item in items:
    stock_repo.update_quantity(item_id, -qty)

# After: Batch cache, single update per unique item
batch_cache = {}
for item in items:
    stock_repo.update_quantity(item_id, -qty, batch_cache=batch_cache)
```

### Lazy Loading

**File:** `utils/lazy_loader.py`

```python
class LazyLoader:
    """Load expensive resources only when needed."""
    
    def __init__(self, module_name: str):
        self.module_name = module_name
        self._module = None
    
    def __getattr__(self, name: str):
        if self._module is None:
            self._module = importlib.import_module(self.module_name)
        return getattr(self._module, name)
```

### Report Query Optimization

**Single Query Reports:**
Instead of multiple queries, reports use single optimized queries with JOINs and GROUP BY.

**Example - Trial Balance:**
```sql
SELECT 
    a.account_code,
    a.account_name,
    SUM(COALESCE(jel.debit, 0)) as total_debit,
    SUM(COALESCE(jel.credit, 0)) as total_credit
FROM accounts a
LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id
LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
    AND je.entry_date BETWEEN ? AND ?
WHERE a.company_id = 1
  AND a.is_active = 1
GROUP BY a.id
ORDER BY a.account_code
```

---

## Testing

### Test Files

**Location:** `/workspace/`

- `test_db.py` - Database connection tests
- `test_cases_sp.py` - Service layer test cases

### Manual Testing Checklist

#### Authentication
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Password reset functionality
- [ ] User creation
- [ ] Role-based access control

#### Sales Invoice
- [ ] Create new invoice
- [ ] Validate stock check
- [ ] Journal entry creation
- [ ] Edit invoice
- [ ] Cancel invoice
- [ ] Export to PDF

#### Purchase Invoice
- [ ] Create new invoice
- [ ] Stock increase
- [ ] Supplier ledger update

#### Manufacturing
- [ ] Create BOM
- [ ] Create production order
- [ ] Complete production order
- [ ] Stock consumption
- [ ] Finished goods addition

#### Reports
- [ ] Trial Balance
- [ ] Profit & Loss
- [ ] Balance Sheet
- [ ] Party Ledger
- [ ] Cash Book
- [ ] Export to Excel/PDF

#### Banking
- [ ] Create bank account
- [ ] Record payment
- [ ] Record receipt
- [ ] Cheque management

#### Backup
- [ ] Manual backup
- [ ] Restore from backup
- [ ] Auto-backup execution

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Error

**Symptom:** "Unable to connect to database"

**Causes:**
- Incorrect SQLite Cloud URL
- Network connectivity issue
- Invalid API key

**Solution:**
```bash
# Verify connection string
echo $SQLITE_CLOUD_URL

# Test connection manually
python -c "import sqlitecloud; conn = sqlitecloud.connect('$SQLITE_CLOUD_URL'); print(conn)"
```

#### 2. Login Fails

**Symptom:** "Invalid credentials" for admin user

**Causes:**
- Default user not seeded
- Password changed

**Solution:**
```python
# Reset admin password
from utils.security import hash_password
from database.connection import get_db

db = get_db()
password_hash, salt = hash_password("new_password")

db.execute("""
    UPDATE users 
    SET password_hash = ?, password_salt = ?
    WHERE username = 'admin'
""", (password_hash, salt))
```

#### 3. Insufficient Stock Error

**Symptom:** Cannot create sales invoice

**Causes:**
- Item not in stock
- Batch expired

**Solution:**
1. Create purchase invoice to add stock
2. Or adjust stock manually
3. Check batch expiry dates

#### 4. Journal Entry Not Balanced

**Symptom:** `UnbalancedJournalEntryError`

**Causes:**
- Service layer calculation error
- Manual journal entry mistake

**Solution:**
- Review service logic
- Ensure debits = credits
- Check rounding tolerance (±0.01)

#### 5. Report Shows Incorrect Balances

**Symptom:** Trial Balance doesn't match

**Causes:**
- Unposted journal entries
- Date range issue
- Inactive accounts included

**Solution:**
- Verify all entries are posted (`is_posted = 1`)
- Check report date range
- Filter inactive accounts

#### 6. Backup Fails

**Symptom:** "Backup creation failed"

**Causes:**
- Insufficient disk space
- Permission issues
- Database locked

**Solution:**
```bash
# Check disk space
df -h

# Check permissions
ls -la /workspace/backups

# Kill locked connections
# (Wait for users to finish transactions)
```

### Log Analysis

**Log File:** `/workspace/logs/erp.log`

**Search for errors:**
```bash
grep "ERROR" /workspace/logs/erp.log
grep "Exception" /workspace/logs/erp.log
```

**Enable DEBUG logging:**
```bash
export ERP_LOG_LEVEL=DEBUG
```

---

## Future Enhancements

### Planned Features

1. **Multi-Currency Support**
   - Currency exchange rates
   - Multi-currency invoices
   - Exchange gain/loss tracking

2. **Advanced Inventory**
   - Barcode scanning
   - Stock transfers between warehouses
   - Stock aging analysis

3. **Enhanced Reporting**
   - Custom report builder
   - Scheduled report delivery
   - Interactive dashboards

4. **Integration**
   - REST API for third-party integration
   - E-commerce platform connectors
   - Payment gateway integration

5. **Mobile App**
   - iOS/Android app for sales
   - Inventory counting mobile app
   - Approval workflows

6. **Advanced Manufacturing**
   - Work order tracking
   - Quality control
   - Machine maintenance scheduling

7. **HR & Payroll**
   - Employee management
   - Attendance tracking
   - Payroll processing

8. **CRM**
   - Lead management
   - Opportunity tracking
   - Customer support tickets

### Technical Improvements

1. **Database Migration**
   - PostgreSQL support
   - MySQL support
   - Automated migration scripts

2. **Web Interface**
   - Django/Flask web frontend
   - Real-time updates via WebSocket
   - Progressive Web App (PWA)

3. **Microservices Architecture**
   - Split monolith into services
   - Message queue (RabbitMQ/Kafka)
   - API Gateway

4. **Enhanced Security**
   - Two-factor authentication
   - OAuth2 integration
   - Audit log encryption

5. **Performance**
   - Redis caching layer
   - CDN for static assets
   - Database read replicas

---

## Appendix

### A. Glossary

| Term | Definition |
|------|-----------|
| **BOM** | Bill of Materials - Recipe for finished goods |
| **COA** | Chart of Accounts - List of all accounts |
| **JE** | Journal Entry - Double-entry accounting record |
| **AR** | Accounts Receivable - Money owed by customers |
| **AP** | Accounts Payable - Money owed to suppliers |
| **FIFO** | First In, First Out - Inventory valuation method |
| **RBAC** | Role-Based Access Control |
| **PBKDF2** | Password-Based Key Derivation Function 2 |
| **TTL** | Time To Live - Cache expiration time |

### B. Account Code Structure

```
1xxx - Assets
  1000 - Cash in Hand
  1010 - Cash at Bank
  1100 - Accounts Receivable
  1200 - Inventory
  1210 - Raw Materials
  1220 - Finished Goods
  1300 - Prepaid Expenses
  1400 - Fixed Assets

2xxx - Liabilities
  2000 - Accounts Payable
  2100 - Accrued Expenses
  2200 - Short-term Loans
  2300 - Tax Payable

3xxx - Equity
  3000 - Share Capital
  3100 - Retained Earnings

4xxx - Revenue
  4000 - Sales Income
  4100 - Service Income
  4200 - Other Income

5xxx - Expenses
  5000 - Cost of Goods Sold
  5100 - Operating Expenses
  5200 - Administrative Expenses
  5300 - Financial Charges
```

### C. Voucher Number Format

```
{TYPE}-{YYYYMMDD}-{SEQUENCE}

Examples:
SLS-20260801-001  (Sales invoice #1 on Aug 1, 2026)
PUR-20260801-005  (Purchase invoice #5 on Aug 1, 2026)
PAY-20260802-001  (Payment #1 on Aug 2, 2026)
REC-20260802-003  (Receipt #3 on Aug 2, 2026)
JNL-20260801-001  (Journal entry #1 on Aug 1, 2026)
MFG-20260803-001  (Manufacturing entry #1 on Aug 3, 2026)
```

### D. File Size Statistics

| Category | File Count | Total Lines |
|----------|-----------|-------------|
| Models | 12 | ~1,200 |
| Repositories | 15 | ~2,500 |
| Services | 13 | ~3,500 |
| Controllers | 12 | ~1,800 |
| Views | 18 | ~3,000 |
| Database | 8 | ~1,500 |
| Utils | 7 | ~800 |
| Reports | 6 | ~600 |
| **Total** | **110+** | **~14,500** |

### E. Contact & Support

**For technical support:**
- Check logs: `/workspace/logs/erp.log`
- Review documentation: `/workspace/PROJECT_DOCUMENTATION.md`
- Examine existing fixes: `/workspace/FIXES_SUMMARY.md`

---

## Document Information

**Version:** 1.0  
**Last Updated:** 2026-08-02  
**Author:** AI Assistant  
**Based on:** Codebase analysis of 110+ Python files  

**Document Coverage:**
- ✅ Architecture overview
- ✅ Database schema (all 20+ tables)
- ✅ All modules documented
- ✅ API reference
- ✅ Workflows and data flows
- ✅ Security implementation
- ✅ Error handling
- ✅ Caching strategy
- ✅ Backup system
- ✅ Reporting system
- ✅ UI documentation
- ✅ Configuration guide
- ✅ Installation instructions
- ✅ Performance optimizations
- ✅ Troubleshooting guide
- ✅ Future enhancements

---

*This documentation represents a comprehensive analysis of the BOP Nutraceuticals ERP System codebase. Every effort has been made to ensure accuracy and completeness.*
