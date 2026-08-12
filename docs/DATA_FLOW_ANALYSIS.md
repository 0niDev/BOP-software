# BOP Nutraceuticals ERP - Complete Data Flow Analysis

## 📊 Project Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ LoginView   │  │ MainWindow  │  │ 15+ Widget Views        │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                      │                 │
│         └────────────────┴──────────────────────┘                 │
│                            │                                      │
│                    (PySide6 Signals/Slots)                        │
└────────────────────────────┼──────────────────────────────────────┘
                             │
┌────────────────────────────▼──────────────────────────────────────┐
│                        CONTROLLER LAYER                           │
│  Auth │ Sales │ Purchase │ Manufacturing │ Payment │ Report │ ... │
└────────────────────────────┼──────────────────────────────────────┘
                             │
┌────────────────────────────▼──────────────────────────────────────┐
│                         SERVICE LAYER                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │SalesInvoiceSvc   │  │PurchaseInvoiceSvc│  │ManufacturingSvc│  │
│  ├──────────────────┤  ├──────────────────┤  ├────────────────┤  │
│  │AccountingService │  │PaymentService    │  │DashboardService│  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────────────┘  │
└───────────┼─────────────────────┼─────────────────────────────────┘
            │                     │
┌───────────▼─────────────────────▼─────────────────────────────────┐
│                       REPOSITORY LAYER                            │
│  BaseRepository (with 30s TTL Cache) + 20+ Specific Repositories │
└────────────────────────────┼──────────────────────────────────────┘
                             │
┌────────────────────────────▼──────────────────────────────────────┐
│                      DATABASE LAYER                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │SQLite Cloud     │  │Connection Pool  │  │Migration System  │  │
│  │(Primary Store)  │  │(Auto-reconnect) │  │(Idempotent)      │  │
│  └─────────────────┘  └─────────────────┘  └──────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

---

## 🔗 Core Dependency Chain

```
Models (DataClasses) → Enums → Services → Repositories → Database
      ↓                    ↓          ↓           ↓
   Validation         Constants   Business    SQL Ops
   from_row()         AccountType  Logic      Transactions
   to_dict()          PartyType   JE Creation Indexes
                      VoucherType Stock Mgmt  Caching
                      DocStatus
```

---

## 📚 Database Schema (24 Core Tables)

### Master Data Tables
1. **companies** - Multi-company support
2. **warehouses** - Storage locations
3. **roles** - 6 predefined roles (Admin, Manager, etc.)
4. **permissions** - Granular access control
5. **role_permissions** - Role-permission mapping
6. **users** - Authentication (PBKDF2-HMAC-SHA256, 200k iterations)
7. **parties** - Customers/Suppliers (PartyType: CUSTOMER/SUPPLIER/BOTH)
8. **item_categories** - Item classification
9. **items** - Products (RAW_MATERIAL/PACKING_MATERIAL/FINISHED_GOOD)
10. **stock_batches** - Batch-wise inventory with expiry tracking
11. **accounts** - Chart of Accounts (AccountType: ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE)

### Transaction Tables
12. **journal_entries** - Accounting headers (VoucherType: 11 types)
13. **journal_entry_lines** - Double-entry lines (debit/credit)
14. **sales_invoices** + **sales_invoice_items** - Revenue transactions
15. **purchase_invoices** + **purchase_invoice_items** - Procurement
16. **payments** + **payment_allocations** - Supplier payments
17. **receipts** + **receipt_allocations** - Customer collections
18. **production_orders** + **production_consumption** - Manufacturing
19. **bill_of_materials** + **bom_components** - Recipe definitions
20. **bank_accounts** + **bank_transactions** - Banking
21. **expenses** + **expense_categories** - Operational costs
22. **stock_movements** - Inventory audit trail
23. **audit_log** - System-wide change tracking
24. **numbering_sequences** - Auto-numbering for documents

---

## ⚡ CRITICAL DATA FLOWS

### 🔄 FLOW 1: Creating a Sales Invoice

```
User Action: Click "Create Sales Invoice" → Fill Form → Submit
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: View Layer (sales_invoice_view.py)                     │
│ • Validates UI inputs (required fields, positive quantities)    │
│ • Emits signal: create_invoice_clicked(invoice_data)           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Controller Layer (sales_invoice_controller.py)         │
│ • Receives invoice_data dict                                   │
│ • Calls: sales_invoice_service.create_sales_invoice(...)       │
│ • Catches: ValidationError, InsufficientStockError             │
│ • Shows QMessageBox on error / Success message on completion   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Service Layer (sales_invoice_service.py)               │
│ ───────────────────────────────────────────────────────────────  │
│ 3a. VALIDATION PHASE:                                          │
│   • Check customer exists & is_active                          │
│   • Verify party_type in [CUSTOMER, BOTH]                      │
│   • Validate each item: exists, active, positive qty           │
│   • Check stock availability (FIFO via stock_batches)          │
│   • Calculate: subtotal, discount, tax, total                  │
│                                                                  │
│ 3b. ACCOUNT SETUP:                                             │
│   • Get Revenue Account (code: 4000)                           │
│   • Get Tax Account (code: 2100) if tax > 0                    │
│   • Determine Debit Account based on payment_type:             │
│     - CREDIT → Accounts Receivable (1100)                      │
│     - CASH → Cash Account (1000)                               │
│     - BANK/CHEQUE → Bank Account (1010 or specific)            │
│                                                                  │
│ 3c. TRANSACTION BLOCK (db.transaction()):                      │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ 1. Insert sales_invoice record                           │  │
│   │    → Returns invoice.id                                  │  │
│   └────────────────────┬─────────────────────────────────────┘  │
│                        │                                        │
│   ┌────────────────────▼─────────────────────────────────────┐  │
│   │ 2. For each item:                                        │  │
│   │    • Insert sales_invoice_item                           │  │
│   │    • Call _update_stock(item_id, qty, negative)          │  │
│   │      → Deducts from stock_batch.quantity_in_stock        │  │
│   │      → Raises InsufficientStockError if not enough       │  │
│   └────────────────────┬─────────────────────────────────────┘  │
│                        │                                        │
│   ┌────────────────────▼─────────────────────────────────────┐  │
│   │ 3. Build Journal Entry Lines:                            │  │
│   │    DEBIT:  [Debit Account, total_amount, party_id?]      │  │
│   │    CREDIT: [Revenue Account, subtotal-discount, null]    │  │
│   │    CREDIT: [Tax Account, tax_amount, null] (if tax>0)    │  │
│   └────────────────────┬─────────────────────────────────────┘  │
│                        │                                        │
│   ┌────────────────────▼─────────────────────────────────────┐  │
│   │ 4. Call accounting_service.post_journal_entry()          │  │
│   │    → Validates: debit == credit                          │  │
│   │    → Generates voucher_number (sequential, gap-free)     │  │
│   │    → Inserts journal_entries header                      │  │
│   │    → Inserts journal_entry_lines (2-3 rows)              │  │
│   │    → Links: source_table='sales_invoices', source_id=X   │  │
│   └────────────────────┬─────────────────────────────────────┘  │
│                        │                                        │
│   ┌────────────────────▼─────────────────────────────────────┐  │
│   │ 5. POST COGS ENTRY (Critical!):                          │  │
│   │    • Calculate COGS = Σ(qty × purchase_price)            │  │
│   │    • DEBIT:  COGS Account (5000)                         │  │
│   │    • CREDIT: Inventory Account (1220/1200)               │  │
│   │    → Ensures P&L reflects true profitability             │  │
│   └────────────────────┬─────────────────────────────────────┘  │
│                        │                                        │
│   ┌────────────────────▼─────────────────────────────────────┐  │
│   │ 6. If BANK/CHEQUE payment:                               │  │
│   │    • Insert bank_transaction (DEPOSIT type)              │  │
│   │    • Links to bank_account_id                            │  │
│   └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│ 3d. COMMIT: All or nothing (atomic transaction)                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ ENTITIES AFFECTED:                                             │
│ ✅ sales_invoices (1 row INSERT)                               │
│ ✅ sales_invoice_items (N rows INSERT)                         │
│ ✅ stock_batches (N rows UPDATE - quantity decreased)          │
│ ✅ journal_entries (2 rows INSERT - Sales + COGS)              │
│ ✅ journal_entry_lines (4-6 rows INSERT)                       │
│ ✅ bank_transactions (1 row INSERT if bank payment)            │
│ ✅ numbering_sequences (UPDATE next_number for SALES)          │
│                                                                │
│ 📊 REPORTS IMPACTED:                                           │
│ • Trial Balance (Revenue ↑, AR/Cash ↑, Inventory ↓, COGS ↑)   │
│ • Profit & Loss (Revenue ↑, COGS ↑ → Gross Profit calculated) │
│ • Balance Sheet (Assets: AR/Cash ↑, Inventory ↓)              │
│ • Party Ledger (Customer balance ↑ if credit sale)            │
│ • Stock Report (Item quantities ↓)                            │
│ • Cash Book (If cash/bank sale)                               │
└─────────────────────────────────────────────────────────────────┘
```

---

### 🔄 FLOW 2: Creating a Purchase Invoice

```
User Action: Create Purchase Invoice → Enter Supplier + Items → Submit
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ SERVICE LAYER (purchase_invoice_service.py)                    │
│ ───────────────────────────────────────────────────────────────  │
│ 1. VALIDATION:                                                 │
│   • Supplier exists, active, party_type in [SUPPLIER, BOTH]    │
│   • Items valid, positive quantities, non-negative cost        │
│                                                                  │
│ 2. ACCOUNT SETUP:                                              │
│   • Inventory Account (1200) - DEBIT                           │
│   • Credit Account depends on payment_type:                    │
│     - CREDIT → Accounts Payable (2000) + party_id=supplier_id  │
│     - CASH → Cash (1000)                                       │
│     - BANK → Bank Account (1010 or specific)                   │
│   • Tax Account (2100) if tax > 0                              │
│                                                                  │
│ 3. TRANSACTION BLOCK:                                          │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ 1. Insert purchase_invoice                               │  │
│   └────────────────────┬─────────────────────────────────────┘  │
│                        │                                        │
│   ┌────────────────────▼─────────────────────────────────────┐  │
│   │ 2. For each item:                                        │  │
│   │    • Insert purchase_invoice_item                        │  │
│   │    • Call _update_stock():                               │  │
│   │      → Creates NEW stock_batch OR                        │  │
│   │      → Updates existing batch (+quantity)                │  │
│   │      → Stores: batch_number, mfg_date, expiry_date       │  │
│   └────────────────────┬─────────────────────────────────────┘  │
│                        │                                        │
│   ┌────────────────────▼─────────────────────────────────────┐  │
│   │ 3. Journal Entry:                                        │  │
│   │    DEBIT:  Inventory (1200), total_amount                │  │
│   │    CREDIT: AP/Cash/Bank, total_amount, party_id?         │  │
│   │    CREDIT: Tax (2100), tax_amount (if applicable)        │  │
│   │    → post_journal_entry(VoucherType.PURCHASE)            │  │
│   └────────────────────┬─────────────────────────────────────┘  │
│                        │                                        │
│   ┌────────────────────▼─────────────────────────────────────┐  │
│   │ 4. If BANK/CHEQUE:                                       │  │
│   │    • Insert bank_transaction (WITHDRAWAL type)           │  │
│   └──────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ ENTITIES AFFECTED:                                             │
│ ✅ purchase_invoices (1 INSERT)                                │
│ ✅ purchase_invoice_items (N INSERTs)                          │
│ ✅ stock_batches (INSERT or UPDATE - quantity increased)       │
│ ✅ journal_entries (1 INSERT)                                  │
│ ✅ journal_entry_lines (2-3 INSERTs)                           │
│ ✅ bank_transactions (1 INSERT if bank payment)                │
│ ✅ numbering_sequences (UPDATE for PURCHASE)                   │
│                                                                │
│ 📊 REPORTS IMPACTED:                                           │
│ • Trial Balance (Inventory ↑, AP/Cash ↓)                      │
│ • Balance Sheet (Assets: Inventory ↑, Liabilities: AP ↑)      │
│ • Party Ledger (Supplier balance ↑ if credit purchase)        │
│ • Stock Report (Item quantities ↑)                            │
└─────────────────────────────────────────────────────────────────┘
```

---

### 🔄 FLOW 3: Completing a Production Order

```
User Action: Select Production Order → Click "Complete" → Enter Actual Qty
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ SERVICE LAYER (manufacturing_service.py)                       │
│ ───────────────────────────────────────────────────────────────  │
│ 1. VALIDATION:                                                 │
│   • Order status must be IN_PROGRESS                           │
│   • actual_quantity > 0                                        │
│   • BOM exists and is active                                   │
│                                                                  │
│ 2. CALCULATE MATERIAL REQUIREMENTS:                            │
│   ratio = actual_qty / BOM.output_quantity                     │
│   For each component:                                          │
│     required = component.qty × ratio                           │
│     wastage = required × (wastage% / 100)                      │
│     total_needed = required + wastage                          │
│     ✓ Check stock_available >= total_needed                    │
│     ✓ Calculate cost = total_needed × unit_cost                │
│                                                                  │
│ 3. ACCOUNT SETUP:                                              │
│   • Inventory Raw Materials (1200)                             │
│   • Inventory Finished Goods (1220)                            │
│   • Wastage Account (5200)                                     │
│   • Work in Progress (WIP) if used                             │
│                                                                  │
│ 4. TRANSACTION BLOCK:                                          │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ 1. For each raw material:                                │  │
│   │    • Deduct stock_batch.quantity (-total_needed)         │  │
│   │    • Insert production_consumption record                │  │
│   └────────────────────┬─────────────────────────────────────┘  │
│                        │                                        │
│   ┌────────────────────▼─────────────────────────────────────┐  │
│   │ 2. Add Finished Goods:                                   │  │
│   │    • INSERT/UPDATE stock_batch for finished_item         │  │
│   │    • +actual_quantity                                    │  │
│   │    • New batch_number, mfg_date, expiry_date             │  │
│   └────────────────────┬─────────────────────────────────────┘  │
│                        │                                        │
│   ┌────────────────────▼─────────────────────────────────────┐  │
│   │ 3. Journal Entry 1 - Raw Material Consumption:           │  │
│   │    DEBIT:  WIP / COGS                                    │  │
│   │    CREDIT: Inventory Raw Materials (1200)                │  │
│   └────────────────────┬─────────────────────────────────────┘  │
│                        │                                        │
│   ┌────────────────────▼─────────────────────────────────────┐  │
│   │ 4. Journal Entry 2 - Finished Goods Production:          │  │
│   │    DEBIT:  Inventory Finished Goods (1220)               │  │
│   │    CREDIT: WIP / Manufacturing Income                    │  │
│   └────────────────────┬─────────────────────────────────────┘  │
│                        │                                        │
│   ┌────────────────────▼─────────────────────────────────────┐  │
│   │ 5. Journal Entry 3 - Wastage (if any):                   │  │
│   │    DEBIT:  Wastage Expense (5200)                        │  │
│   │    CREDIT: Inventory Raw Materials                       │  │
│   └────────────────────┬─────────────────────────────────────┘  │
│                        │                                        │
│   ┌────────────────────▼─────────────────────────────────────┐  │
│   │ 6. Update production_order.status = 'COMPLETED'          │  │
│   └──────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ ENTITIES AFFECTED:                                             │
│ ✅ production_orders (1 UPDATE - status)                       │
│ ✅ production_consumption (N INSERTs)                          │
│ ✅ stock_batches (N+1 updates: N raw materials ↓, 1 FG ↑)      │
│ ✅ journal_entries (2-3 INSERTs)                               │
│ ✅ journal_entry_lines (4-6 INSERTs)                           │
│                                                                │
│ 📊 REPORTS IMPACTED:                                           │
│ • Trial Balance (Raw Inv ↓, Finished Inv ↑, Wastage Exp ↑)    │
│ • P&L (Wastage expense reduces profit)                        │
│ • Balance Sheet (Asset composition changes)                   │
│ • Stock Report (RM ↓, FG ↑)                                   │
│ • Production Cost Report (Material consumption tracked)       │
└─────────────────────────────────────────────────────────────────┘
```

---

### 🔄 FLOW 4: Recording a Payment (Supplier) / Receipt (Customer)

```
User Action: Payment/Receipt Form → Select Party + Amount → Submit
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ SERVICE LAYER (payment_service.py)                             │
│ ───────────────────────────────────────────────────────────────  │
│ PAYMENT TO SUPPLIER:                                           │
│ 1. Validate supplier exists, party_type in [SUPPLIER, BOTH]    │
│ 2. amount > 0                                                  │
│ 3. Check if exceeds outstanding (optional validation)          │
│                                                                  │
│ 4. ACCOUNT SETUP:                                              │
│   • AP Account (2000) - DEBIT (reduces liability)              │
│   • Cash/Bank Account - CREDIT                                 │
│                                                                  │
│ 5. TRANSACTION:                                                │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ 1. Journal Entry:                                        │  │
│   │    DEBIT:  AP (2000), amount, party_id=supplier_id       │  │
│   │    CREDIT: Cash/Bank, amount                             │  │
│   │    → VoucherType.PAYMENT                                 │  │
│   └────────────────────┬─────────────────────────────────────┘  │
│                        │                                        │
│   ┌────────────────────▼─────────────────────────────────────┐  │
│   │ 2. Insert payment record                                 │  │
│   └────────────────────┬─────────────────────────────────────┘  │
│                        │                                        │
│   ┌────────────────────▼─────────────────────────────────────┐  │
│   │ 3. If linked to invoice:                                 │  │
│   │    • UPDATE purchase_invoices                            │  │
│   │    • paid_amount += payment_amount                       │  │
│   └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│ RECEIPT FROM CUSTOMER (Mirror logic):                          │
│ • DEBIT: Cash/Bank                                             │
│ • CREDIT: AR (1100), party_id=customer_id                      │
│ • UPDATE sales_invoices.paid_amount                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ ENTITIES AFFECTED:                                             │
│ ✅ payments OR receipts (1 INSERT)                             │
│ ✅ journal_entries (1 INSERT)                                  │
│ ✅ journal_entry_lines (2 INSERTs)                             │
│ ✅ purchase_invoices OR sales_invoices (1 UPDATE if linked)    │
│ ✅ numbering_sequences (UPDATE for PAYMENT/RECEIPT)            │
│                                                                │
│ 📊 REPORTS IMPACTED:                                           │
│ • Trial Balance (Cash ↑↓, AR/AP ↓)                            │
│ • Balance Sheet (Assets: Cash ↑↓, AR ↓ / Liabilities: AP ↓)   │
│ • Party Ledger (Party balance ↓)                              │
│ • Cash Book (Cash/Bank transaction recorded)                  │
│ • Aged Payables/Receivables (Outstanding reduced)             │
└─────────────────────────────────────────────────────────────────┘
```

---

### 🔄 FLOW 5: User Login & Authorization

```
User Action: Enter credentials → Click Login
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. LOGIN VIEW (login_view.py)                                  │
│ • Captures username, password                                  │
│ • Emits: login_attempt(username, password_hash)                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. AUTH CONTROLLER (auth_controller.py)                        │
│ • Calls: auth_service.authenticate(username, password)         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. AUTH SERVICE (authentication/auth_service.py)               │
│ ───────────────────────────────────────────────────────────────  │
│ 3a. Fetch user by username                                     │
│ 3b. Verify password:                                           │
│     • pbkdf2_hmac('sha256', password, salt, 200000)            │
│     • Compare with stored hash                                 │
│ 3c. Fetch role & permissions:                                  │
│     SELECT p.code FROM permissions p                           │
│     JOIN role_permissions rp ON p.id = rp.permission_id        │
│     JOIN roles r ON rp.role_id = r.id                          │
│     WHERE r.id = user.role_id                                  │
│ 3d. Return User object with permissions list                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. MAIN WINDOW INITIALIZATION                                  │
│ • Role-based menu visibility:                                  │
│   - Admin: Full access                                         │
│   - Accountant: Accounting, Reports, no User Mgmt              │
│   - Sales: Sales Invoices, Parties, no Manufacturing           │
│   - Warehouse: Inventory, Production, no Financials            │
│ • Dashboard data loaded (lazy or immediate)                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔥 CASCADE EFFECTS - What Breaks When...

### Scenario 1: **Journal Entry Posting Fails**
```
Root Cause: Unbalanced entry (debit ≠ credit)
│
▼
AFFECTED OPERATIONS:
❌ Sales Invoice creation → ROLLBACK entire invoice
❌ Purchase Invoice → ROLLBACK stock + invoice
❌ Payment/Receipt → ROLLBACK payment record
❌ Production Completion → ROLLBACK stock changes
│
▼
USER IMPACT:
• Error message: "Journal entry not balanced"
• No partial data saved (transaction atomicity)
• Audit log records failed attempt
```

### Scenario 2: **Insufficient Stock**
```
Root Cause: Stock check fails during sales invoice
│
▼
AFFECTED OPERATIONS:
❌ Sales Invoice → Blocked before any DB writes
❌ Production Order Completion → Blocked
│
▼
CHAIN REACTION:
• Cannot sell → No revenue recognition
• Cannot produce → No finished goods
• Customer orders delayed
• Cash flow impact
│
▼
PREVENTION:
• Real-time stock validation BEFORE transaction
• Warning thresholds in dashboard
• Reorder point alerts
```

### Scenario 3: **Account Not Found (e.g., 4000 Sales Revenue)**
```
Root Cause: Chart of Accounts misconfigured
│
▼
AFFECTED OPERATIONS:
❌ All Sales Invoices → Cannot post revenue
❌ Manual Journal Entries → If referencing missing account
│
▼
ERROR HANDLING:
• ValidationError raised
• Clear message: "Sales Revenue account (4000) not found"
• Requires admin to fix chart of accounts
```

### Scenario 4: **Database Connection Lost**
```
Root Cause: SQLite Cloud network issue
│
▼
SYSTEM RESPONSE:
• Connection pool auto-reconnect (configured in connection.py)
• Retry logic with exponential backoff
• If persistent: Show error, prevent data corruption
│
▼
DATA INTEGRITY:
• Transactions ensure no partial writes
• Cache invalidated on reconnect
• Backup system preserves last known state
```

### Scenario 5: **User Permission Denied**
```
Root Cause: RBAC check fails
│
▼
BLOCKED ACTIONS:
• View hidden from sidebar (role-based filtering)
• Button disabled (permission check in widget)
• API call rejected (controller-level validation)
│
▼
EXAMPLE RESTRICTIONS:
• Sales User: Cannot access Manufacturing module
• Warehouse User: Cannot view Financial Reports
• Accountant: Cannot delete users
```

---

## 📈 REPORT GENERATION DATA FLOW

```
User: Click "Profit & Loss Report" → Select Date Range
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ REPORT CONTROLLER (report_controller.py)                       │
│ • Validates date range                                         │
│ • Calls: report_service.generate_profit_loss(from, to)         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ REPORT SERVICE (reports/profit_loss_report.py)                 │
│ ───────────────────────────────────────────────────────────────  │
│ 1. Fetch all REVENUE accounts:                                 │
│    SELECT id FROM accounts WHERE account_type = 'REVENUE'      │
│ 2. Fetch all EXPENSE accounts:                                 │
│    SELECT id FROM accounts WHERE account_type = 'EXPENSE'      │
│ 3. For each account:                                           │
│    balance = account_repo.get_current_balance(account_id)      │
│    → Sums journal_entry_lines.debit - credit for date range    │
│ 4. Calculate:                                                  │
│    Total Revenue = Σ(revenue account balances)                 │
│    Total Expenses = Σ(expense account balances)                │
│    Net Profit = Revenue - Expenses                             │
│ 5. Format output (dict for PDF/Excel)                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ OUTPUT OPTIONS:                                                │
│ • PDF (ReportLab) → Styled document                            │
│ • Excel (openpyxl) → Spreadsheet with formulas                 │
│ • CSV → Raw data export                                        │
│ • On-screen table → QTableWidget                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ DATA INTEGRITY GUARANTEES

### 1. **Double-Entry Enforcement**
```python
# accounting_service.py:post_journal_entry()
total_debit = sum(l.debit for l in lines)
total_credit = sum(l.credit for l in lines)
if abs(total_debit - total_credit) > 0.01:
    raise UnbalancedJournalEntryError(...)
# → NO entry posted unless balanced
```

### 2. **Transaction Atomicity**
```python
# Every critical operation wrapped in:
with db.transaction():
    insert_invoice()
    update_stock()
    post_journal_entry()
    # If ANY fails → ALL rolled back
```

### 3. **Referential Integrity**
```sql
-- Foreign keys enforced at DB level
CREATE TABLE sales_invoice_items (
    invoice_id INTEGER REFERENCES sales_invoices(id),
    item_id INTEGER REFERENCES items(id),
    ...
);
```

### 4. **Cache Invalidation**
```python
# repositories/base_repository.py
CACHE_TTL = 30  # seconds
# After write operations:
invalidate_db_cache()  # Clears stale reads
```

### 5. **Audit Trail**
```python
# Every insert/update logs to audit_log:
INSERT INTO audit_log (
    table_name, record_id, action, 
    old_values, new_values, user_id
) VALUES (...)
```

---

## 🎯 KEY VARIABLES & CONFIGURATION

### Environment Variables
```bash
ERP_DB_ENGINE=sqlitecloud
SQLITE_CLOUD_URL=sqlitecloud://host:port/db?apikey=key
```

### Account Codes (Chart of Accounts)
```python
ASSETS:
  1000 - Cash
  1010 - Bank
  1100 - Accounts Receivable
  1200 - Inventory Raw Materials
  1220 - Inventory Finished Goods

LIABILITIES:
  2000 - Accounts Payable
  2100 - Tax Payable

EQUITY:
  3000 - Share Capital
  3100 - Retained Earnings

REVENUE:
  4000 - Sales Revenue

EXPENSES:
  5000 - Cost of Goods Sold
  5100 - Operating Expenses
  5200 - Wastage Expense
```

### Voucher Types (Document Numbering)
```python
JOURNAL, SALES, SALES_RETURN, PURCHASE, PURCHASE_RETURN,
PAYMENT, RECEIPT, MANUFACTURING, STOCK_ADJUSTMENT, OPENING
```

### Document Status Lifecycle
```python
DRAFT → CONFIRMED → (optional) CANCELLED
# Once CONFIRMED: Stock moved, JE posted, irreversible except via reversal
```

---

## 📦 REBUILD CHECKLIST

When recreating this project from scratch:

### Phase 1: Foundation
- [ ] Set up directory structure (models/, services/, repositories/, views/, controllers/)
- [ ] Create database schema (24 tables)
- [ ] Implement DatabaseConnection with pooling
- [ ] Build BaseRepository with caching
- [ ] Define Enums (AccountType, PartyType, VoucherType, DocumentStatus)

### Phase 2: Core Models
- [ ] DataClass models with from_row()/to_dict()
- [ ] Relationships (foreign keys as IDs)
- [ ] Validation in __post_init__()

### Phase 3: Accounting Engine
- [ ] AccountingService.post_journal_entry()
- [ ] JournalLine dataclass
- [ ] Voucher number generation (gap-free sequences)
- [ ] Balance calculation (debit - credit)

### Phase 4: Business Services
- [ ] SalesInvoiceService (stock deduction, JE, COGS)
- [ ] PurchaseInvoiceService (stock addition, JE)
- [ ] ManufacturingService (BOM, production, consumption)
- [ ] PaymentService (supplier payments, customer receipts)
- [ ] ExpenseService

### Phase 5: Repositories
- [ ] One repository per table
- [ ] CRUD operations
- [ ] Custom queries (find_by_company, get_current_balance)

### Phase 6: Controllers
- [ ] Bridge between views and services
- [ ] Error handling (try/catch, show QMessageBox)
- [ ] Permission checks

### Phase 7: Views (PySide6)
- [ ] LoginView (authentication)
- [ ] MainWindow (navigation, role-based menus)
- [ ] 15+ Widgets (forms + tables)
- [ ] Centralized stylesheet (APP_STYLESHEET)

### Phase 8: Reports
- [ ] TrialBalance, P&L, BalanceSheet
- [ ] PartyLedger, CashBook
- [ ] Export: PDF, Excel, CSV

### Phase 9: Security & Utilities
- [ ] Password hashing (PBKDF2)
- [ ] RBAC system
- [ ] Logging configuration
- [ ] Auto-backup service
- [ ] Migration system

### Phase 10: Testing & Polish
- [ ] Seed data script
- [ ] Test cases (test_cases_sp.py)
- [ ] Performance indexes
- [ ] Error messages (user-friendly)

---

## 🚨 CRITICAL EDGE CASES TO HANDLE

1. **Rounding Errors**: Use Decimal for money, round to 2 decimals before DB insert
2. **Concurrent Access**: Transaction isolation, optimistic locking (version field optional)
3. **Deleted References**: Soft deletes (is_active flag), never hard delete master data
4. **Negative Stock**: Block at service layer, never allow in DB
5. **Orphaned Journal Entries**: Always link to source_table/source_id
6. **Timezone Issues**: Store all dates as ISO strings (YYYY-MM-DD)
7. **Empty Result Sets**: Return [] not None for lists, handle gracefully in UI
8. **Long Running Queries**: Pagination in views, async loading for large datasets
9. **Backup Failures**: Try/except in auto_backup, log errors but don't crash app
10. **Migration Conflicts**: Idempotent migrations (CREATE IF NOT EXISTS, ALTER only if column missing)

---

## 📝 SUMMARY: The Golden Rules

1. **No direct DB access from views/controllers** - Always go through services
2. **Services never import repositories directly** - Use dependency injection
3. **All money movement via AccountingService** - Never insert journal_entries manually
4. **Transactions wrap related operations** - Invoice + Stock + JE in one transaction
5. **Validate early, validate often** - At UI, controller, and service layers
6. **Cache with TTL** - 30-second cache for reads, invalidate on writes
7. **Role-based everything** - Menu items, buttons, API calls
8. **Audit every change** - Who, what, when, old vs new values
9. **Graceful degradation** - If backup fails, log but continue; if report generation fails, show error but don't crash
10. **Test with real data** - Seed data should cover edge cases (zero qty, negative balances, expired batches)

---

**This document captures the complete data flow architecture. Any rebuild must replicate these flows exactly to maintain data integrity and business logic correctness.**
