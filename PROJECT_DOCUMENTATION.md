# BOP Nutraceuticals ERP System - Documentation

## Overview
A complete pharmaceutical manufacturing ERP with double-entry accounting, built with Python + PySide6 (Qt) + SQLite Cloud.

---

## Architecture Layers

```
Views (Qt GUI) → Controllers → Services → Repositories → Database
                      ↓
                 Models (DataClasses)
                      ↓
              Utils (Cache, Security, Logger)
```

---

## Core Modules

### 1. **Database Layer** (`/database`)
- **connection.py**: Connection pooling for SQLite Cloud (max 20 connections)
- **schema.py**: 20+ tables with FK constraints, indexes, soft-delete (`is_active`)
- **migrations/migrator.py**: Seeds chart of accounts, roles, permissions

**Key Tables:**
| Table | Purpose |
|-------|---------|
| `companies`, `warehouses` | Multi-tenant ready (default id=1) |
| `users`, `roles`, `permissions` | RBAC authentication |
| `accounts`, `journal_entries`, `journal_entry_lines` | Double-entry core |
| `parties` | Customers/Suppliers (linked to A/R or A/P) |
| `items`, `stock_batches` | Inventory with batch tracking |
| `sales_invoices`, `purchase_invoices` | Documents with auto-accounting |
| `bom`, `production_orders` | Manufacturing |

---

### 2. **Models** (`/models`) - DataClasses
| Model | Key Fields | Calculations |
|-------|-----------|--------------|
| `Account` | code, name, type, opening_balance | `current_balance` computed in repo |
| `Party` | code, name, type, credit_limit, account_id | Links to AR/AP account |
| `Item` | code, name, type, purchase_price, selling_price, min/max_stock | Stock tracked in batches |
| `SalesInvoice` | customer_id, items[], subtotal, discount, tax, total | `total = subtotal - discount + tax` |
| `PurchaseInvoice` | supplier_id, items[], subtotal, tax, total | Same as sales |
| `BillOfMaterials` | finished_item_id, components[], output_qty | Defines recipe |
| `ProductionOrder` | bom_id, planned_qty, actual_qty, status | Tracks production runs |

**Enums:** `AccountType`, `PartyType`, `VoucherType`, `DocumentStatus`, `PaymentMethod`

---

### 3. **Repositories** (`/repositories`)
Extend `BaseRepository` with:
- CRUD operations (`find_by_id`, `get_all`, `insert`, `update`, `delete`)
- **In-memory cache** (30s TTL, clearable via `CacheManager`)
- Transaction support via `db.transaction()` context manager

**Key Repositories:**
- `AccountRepository`: `get_current_balance()`, `find_by_code()`
- `JournalRepository`: `next_voucher_number()`, `insert_entry(lines)`
- `StockBatchRepository`: `find_by_item_and_warehouse()`, `update_quantity()`

---

### 4. **Services** (`/services`) - Business Logic

#### **AccountingService** (Core Engine)
```python
post_journal_entry(
    voucher_type: VoucherType,
    entry_date: str,
    lines: list[JournalLine],  # debit/credit pairs
    source_table: str,         # e.g., "sales_invoices"
    source_id: int             # FK to document
) → journal_entry_id
```
**Validations:**
- Debits == Credits (±0.01 tolerance)
- Auto-generates sequential voucher numbers (e.g., `SLS-20260801-001`)
- Links to source document for audit trail

#### **SalesInvoiceService**
```python
create_sales_invoice(
    invoice_number, customer_id, items[], payment_type, bank_account_id
) → SalesInvoice
```
**Flow:**
1. Validate customer, items, stock availability
2. Calculate: `subtotal = Σ(qty × price)`, `tax`, `total`
3. **Insert invoice** → **Post JE** → **Deduct stock**
4. **JE Lines:**
   - If CASH: Dr Cash (1000), Cr Sales (4000), Cr Tax Payable (2100)
   - If CREDIT: Dr AR (1100), Cr Sales (4000), Cr Tax Payable (2100)
5. Reduce `stock_batches.quantity_in_stock`

#### **PurchaseInvoiceService**
Same as sales, reversed:
- Dr Inventory (1200), Dr Tax Recoverable (1300)
- Cr Cash/Bank (1000/1010) or AP (2000)

#### **ManufacturingService**
```python
create_bom(finished_item_id, components[], output_qty) → BOM
complete_production_order(order_id, actual_qty) → ProductionOrder
```
**BOM Creation:**
- Validates components are RAW_MATERIAL or PACKING_MATERIAL
- Auto-generates BOM name if not provided

**Production Completion:**
1. Consume raw materials from stock (FIFO by batch)
2. Add finished goods to stock
3. Post JE: Dr Finished Goods (1220), Cr Raw Materials (1200)
4. Handle wastage: Dr Wastage Expense (5200)

#### **PaymentService**
```python
create_payment(party_id, amount, payment_method, is_receipt: bool)
```
- **Receipt** (customer pays): Dr Cash/Bank, Cr AR (1100)
- **Payment** (pay supplier): Dr AP (2000), Cr Cash/Bank

#### **DashboardService**
Single optimized query returns:
- Today's sales/purchases count & total
- Cash, Bank, AR, AP balances
- Low-stock items, top customers/suppliers
- Monthly sales trend (7 data points)

---

### 5. **Controllers** (`/controllers`)
Bridge services ↔ views with UI-friendly error messages.
- `AuthController`: login(), create_user(), reset_password()
- `SalesInvoiceController`: wrap service exceptions → QMessageBox
- `ReportController`: generate reports, export to PDF/Excel

---

### 6. **Views** (`/views`) - PySide6 Qt Widgets
| Widget | Purpose |
|--------|---------|
| `LoginView` | Username/password → AuthController |
| `MainWindow` | Sidebar navigation, role-based filtering |
| `SalesInvoiceView` | Table + dialog for CRUD, batch selection |
| `ManufacturingView` | BOM builder, production order wizard |
| `ReportView` | Date range picker, table, export buttons |
| `BackupView` | Manual backup, restore, auto-backup toggle |

**Styling:** Centralized stylesheet in `main.py` (dark sidebar, light content)

---

### 7. **Reports** (`/reports`)
All extend `ReportBase` with date range filtering.

| Report | Query Logic |
|--------|-------------|
| `TrialBalanceReport` | Group by account, sum(jel.debit - jel.credit) |
| `ProfitLossReport` | Filter REVENUE/EXPENSE accounts, classify by code prefix |
| `BalanceSheetReport` | ASSET/LIABILITY/EQUITY, include retained earnings from P&L |
| `PartyLedgerReport` | Filter JE lines by party_id, running balance |
| `CashBookReport` | Filter Cash/Bank accounts (1000, 1010) |

**Export:** PDF (ReportLab), Excel (openpyxl), CSV, Print (QPrinter)

---

### 8. **Utilities** (`/utils`)
| Module | Purpose |
|--------|---------|
| `security.py` | PBKDF2-HMAC-SHA256 (200k iterations) for passwords |
| `cache_manager.py` | Global cache control, invalidation patterns |
| `event_bus.py` | Pub/sub for cross-widget communication |
| `exceptions.py` | Custom: `ValidationError`, `InsufficientStockError`, `UnbalancedJournalEntryError` |
| `logger.py` | RotatingFileHandler (5MB, 5 backups) |
| `report_exporter.py` | PDF/Excel/CSV generation |

---

### 9. **Authentication** (`/authentication`)
```python
AuthService.login(username, password) → User
```
1. Fetch user + salt + hash from DB
2. `verify_password(plain, salt, expected_hash)`
3. Load permissions: `SELECT p.code FROM permissions p JOIN role_permissions rp ...`
4. Set `current_user` singleton

**User Permissions:** `can_access(module_key)` checks against role permissions.

---

### 10. **Configuration** (`/config`)
Environment variables override defaults:
```python
ERP_DB_ENGINE=sqlitecloud
SQLITE_CLOUD_URL=sqlitecloud://host:port/db?apikey=key
ERP_LOG_LEVEL=DEBUG
```

---

## Key Workflows

### Sales Invoice Creation
```
User fills form → SalesInvoiceController.validate() 
→ SalesInvoiceService.create_sales_invoice()
   ├─ Validate customer, items, stock
   ├─ Calculate totals (Decimal precision)
   ├─ db.transaction():
   │   ├─ invoice_repo.insert(invoice)
   │   ├─ accounting_service.post_journal_entry(lines)
   │   └─ stock_repo.update_quantity(-qty)
   └─ Return invoice with ID
```

### Manufacturing Order Completion
```
User selects order + actual qty → ManufacturingService.complete_production_order()
   ├─ Fetch BOM components
   ├─ For each component:
   │   └─ Deduct from stock (FIFO by batch)
   ├─ Add finished goods to stock
   ├─ Calculate production cost (Σ component_cost)
   └─ Post JE: Dr Finished Goods, Cr Raw Materials, Cr/Wastage Expense
```

### Report Generation
```
ReportController.generate(report_type, date_from, date_to)
→ ReportClass.generate()
   ├─ Build SQL query with date filters
   ├─ Execute single optimized query
   ├─ Classify rows by account code/type
   └─ Return dict with sections, totals, subtotals
```

---

## Database Indexes (Performance)
- `idx_accounts_company_active`: Fast chart of accounts filtering
- `idx_je_posted`: Quick posted entry lookup
- `idx_jel_account_je`: Fast ledger queries
- `idx_stock_item_warehouse`: Instant stock checks

---

## Error Handling
- All services raise custom exceptions (`ValidationError`, etc.)
- Controllers catch → show QMessageBox → log stack trace
- Transactions rollback on exception (atomic operations)

---

## Backup System
- **Auto-backup**: Every 24h (configurable), keeps last 14
- **Manual backup**: `.sql` dump via `sqlitecloud` CLI
- **Restore**: Upload `.sql` file → drop tables → reimport

---

## Entry Point (`main.py`)
```python
app = QApplication()
init_pool(SQLITE_CLOUD_URL)
run_migrations()  # Idempotent
show LoginView
On success → MainWindow(user)
start_auto_backup()
atexit.register(cleanup)  # Backup + close connections
```

---

## Design Principles
1. **Separation of Concerns**: Views never touch DB directly
2. **Double-Entry Integrity**: All money movement via `AccountingService`
3. **Audit Trail**: Every JE links to source document
4. **Soft Deletes**: `is_active` flag preserves history
5. **Multi-Tenant Ready**: `company_id` on all business tables
6. **Caching**: Repository-level (30s) + Dashboard-level (60s)
7. **Transaction Safety**: Related writes wrapped in `db.transaction()`

---

## Tech Stack
- **GUI**: PySide6 (Qt 6)
- **Database**: SQLite Cloud (hosted) with local fallback
- **ORM Pattern**: Repository + DataClass models
- **Reporting**: ReportLab (PDF), openpyxl (Excel)
- **Security**: PBKDF2 password hashing
- **Logging**: RotatingFileHandler with levels

---

*Total: ~100 Python files, 20+ tables, full double-entry accounting, manufacturing, inventory, and financial reporting.*
