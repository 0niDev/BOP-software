-- ============================================================
-- ERP DATABASE BACKUP
-- Generated: 2026-08-01 08:17:41
-- ============================================================

PRAGMA foreign_keys=OFF;

-- Table: _sqliteai_vector
CREATE TABLE _sqliteai_vector (tblname TEXT, colname TEXT, key TEXT, value ANY, PRIMARY KEY(tblname, colname, key));

-- Table: tax_rates
CREATE TABLE tax_rates (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id      INTEGER NOT NULL REFERENCES companies(id),
        name            TEXT NOT NULL,
        tax_type        TEXT NOT NULL CHECK (tax_type IN ('SALES_TAX','WITHHOLDING_TAX')),
        rate_percent    REAL NOT NULL,
        is_active       INTEGER NOT NULL DEFAULT 1,
        UNIQUE (company_id, name)
    );

-- Table: companies
CREATE TABLE companies (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        name            TEXT NOT NULL,
        address         TEXT,
        phone           TEXT,
        email           TEXT,
        ntn             TEXT,
        logo_path       TEXT,
        is_active       INTEGER NOT NULL DEFAULT 1,
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

-- Data for: companies
INSERT INTO companies (id,name,address,phone,email,ntn,logo_path,is_active,created_at) VALUES (1,'My Pharmaceutical Company',NULL,NULL,NULL,NULL,NULL,1,'2026-08-01 03:14:55');

-- Table: warehouses
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

-- Data for: warehouses
INSERT INTO warehouses (id,company_id,code,name,address,is_default,is_active,created_at) VALUES (1,1,'MAIN','Main Warehouse',NULL,1,1,'2026-08-01 03:14:56');

-- Table: roles
CREATE TABLE roles (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        name            TEXT NOT NULL UNIQUE,
        description     TEXT
    );

-- Data for: roles
INSERT INTO roles (id,name,description) VALUES (1,'Admin','Full system access');
INSERT INTO roles (id,name,description) VALUES (2,'Accountant','Accounting, sales, purchases and reporting');
INSERT INTO roles (id,name,description) VALUES (3,'Manager','Management oversight and reporting');
INSERT INTO roles (id,name,description) VALUES (4,'Storekeeper','Inventory and warehouse operations');
INSERT INTO roles (id,name,description) VALUES (5,'Production Manager','Manufacturing and production operations');

-- Table: permissions
CREATE TABLE permissions (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        code            TEXT NOT NULL UNIQUE,
        description     TEXT
    );

-- Table: role_permissions
CREATE TABLE role_permissions (
        role_id         INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_id   INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
    );

-- Table: users
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

-- Data for: users
INSERT INTO users (id,username,password_hash,password_salt,full_name,email,role_id,is_active,last_login_at,created_at) VALUES (1,'admin','26330eb7f846f23ebd9ed9bf81330365ce2346ecc6d9e971d79e52561c020233','7b115cf564270182a7595f0fb3366102','System Administrator',NULL,1,1,NULL,'2026-08-01 03:15:18');

-- Table: accounts
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

-- Data for: accounts
INSERT INTO accounts (id,company_id,account_code,account_name,parent_account_id,account_type,account_subtype,opening_balance,is_system_account,is_active,created_at) VALUES (1,1,'1000','Cash in Hand',NULL,'ASSET','CURRENT_ASSET',0.0,1,1,'2026-08-01 03:14:59');
INSERT INTO accounts (id,company_id,account_code,account_name,parent_account_id,account_type,account_subtype,opening_balance,is_system_account,is_active,created_at) VALUES (2,1,'1010','Bank Accounts',NULL,'ASSET','CURRENT_ASSET',0.0,1,1,'2026-08-01 03:15:00');
INSERT INTO accounts (id,company_id,account_code,account_name,parent_account_id,account_type,account_subtype,opening_balance,is_system_account,is_active,created_at) VALUES (3,1,'1100','Accounts Receivable',NULL,'ASSET','CURRENT_ASSET',0.0,1,1,'2026-08-01 03:15:00');
INSERT INTO accounts (id,company_id,account_code,account_name,parent_account_id,account_type,account_subtype,opening_balance,is_system_account,is_active,created_at) VALUES (4,1,'1200','Inventory - Raw Materials',NULL,'ASSET','CURRENT_ASSET',0.0,1,1,'2026-08-01 03:15:01');
INSERT INTO accounts (id,company_id,account_code,account_name,parent_account_id,account_type,account_subtype,opening_balance,is_system_account,is_active,created_at) VALUES (5,1,'1210','Inventory - Packing Materials',NULL,'ASSET','CURRENT_ASSET',0.0,1,1,'2026-08-01 03:15:01');
INSERT INTO accounts (id,company_id,account_code,account_name,parent_account_id,account_type,account_subtype,opening_balance,is_system_account,is_active,created_at) VALUES (6,1,'1220','Inventory - Finished Goods',NULL,'ASSET','CURRENT_ASSET',0.0,1,1,'2026-08-01 03:15:02');
INSERT INTO accounts (id,company_id,account_code,account_name,parent_account_id,account_type,account_subtype,opening_balance,is_system_account,is_active,created_at) VALUES (7,1,'1300','Withholding Tax Receivable',NULL,'ASSET','CURRENT_ASSET',0.0,1,1,'2026-08-01 03:15:03');
INSERT INTO accounts (id,company_id,account_code,account_name,parent_account_id,account_type,account_subtype,opening_balance,is_system_account,is_active,created_at) VALUES (8,1,'2000','Accounts Payable',NULL,'LIABILITY','CURRENT_LIABILITY',0.0,1,1,'2026-08-01 03:15:03');
INSERT INTO accounts (id,company_id,account_code,account_name,parent_account_id,account_type,account_subtype,opening_balance,is_system_account,is_active,created_at) VALUES (9,1,'2100','Sales Tax Payable',NULL,'LIABILITY','CURRENT_LIABILITY',0.0,1,1,'2026-08-01 03:15:04');
INSERT INTO accounts (id,company_id,account_code,account_name,parent_account_id,account_type,account_subtype,opening_balance,is_system_account,is_active,created_at) VALUES (10,1,'2200','Withholding Tax Payable',NULL,'LIABILITY','CURRENT_LIABILITY',0.0,1,1,'2026-08-01 03:15:04');
INSERT INTO accounts (id,company_id,account_code,account_name,parent_account_id,account_type,account_subtype,opening_balance,is_system_account,is_active,created_at) VALUES (11,1,'3000','Owner''s Equity',NULL,'EQUITY',NULL,0.0,1,1,'2026-08-01 03:15:05');
INSERT INTO accounts (id,company_id,account_code,account_name,parent_account_id,account_type,account_subtype,opening_balance,is_system_account,is_active,created_at) VALUES (12,1,'3100','Retained Earnings',NULL,'EQUITY',NULL,0.0,1,1,'2026-08-01 03:15:05');
INSERT INTO accounts (id,company_id,account_code,account_name,parent_account_id,account_type,account_subtype,opening_balance,is_system_account,is_active,created_at) VALUES (13,1,'4000','Sales Revenue',NULL,'REVENUE',NULL,0.0,1,1,'2026-08-01 03:15:06');
INSERT INTO accounts (id,company_id,account_code,account_name,parent_account_id,account_type,account_subtype,opening_balance,is_system_account,is_active,created_at) VALUES (14,1,'4100','Sales Returns & Allowances',NULL,'REVENUE',NULL,0.0,1,1,'2026-08-01 03:15:06');
INSERT INTO accounts (id,company_id,account_code,account_name,parent_account_id,account_type,account_subtype,opening_balance,is_system_account,is_active,created_at) VALUES (15,1,'5000','Cost of Goods Sold',NULL,'EXPENSE',NULL,0.0,1,1,'2026-08-01 03:15:07');
INSERT INTO accounts (id,company_id,account_code,account_name,parent_account_id,account_type,account_subtype,opening_balance,is_system_account,is_active,created_at) VALUES (16,1,'5100','Purchase Returns & Allowances',NULL,'EXPENSE',NULL,0.0,1,1,'2026-08-01 03:15:07');
INSERT INTO accounts (id,company_id,account_code,account_name,parent_account_id,account_type,account_subtype,opening_balance,is_system_account,is_active,created_at) VALUES (17,1,'5200','Manufacturing Wastage Expense',NULL,'EXPENSE',NULL,0.0,1,1,'2026-08-01 03:15:08');
INSERT INTO accounts (id,company_id,account_code,account_name,parent_account_id,account_type,account_subtype,opening_balance,is_system_account,is_active,created_at) VALUES (18,1,'5300','Inventory Loss / Expiry Expense',NULL,'EXPENSE',NULL,0.0,1,1,'2026-08-01 03:15:08');
INSERT INTO accounts (id,company_id,account_code,account_name,parent_account_id,account_type,account_subtype,opening_balance,is_system_account,is_active,created_at) VALUES (19,1,'6000','General & Administrative Expenses',NULL,'EXPENSE',NULL,0.0,1,1,'2026-08-01 03:15:09');

-- Table: journal_entries
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
        source_table    TEXT,
        source_id       INTEGER,
        is_posted       INTEGER NOT NULL DEFAULT 1,
        created_by      INTEGER REFERENCES users(id),
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (company_id, voucher_number)
    );

-- Table: journal_entry_lines
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
        CHECK (NOT (debit > 0 AND credit > 0))
    );

-- Table: parties
CREATE TABLE parties (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id      INTEGER NOT NULL REFERENCES companies(id),
        code            TEXT NOT NULL,
        name            TEXT NOT NULL,
        party_type      TEXT NOT NULL CHECK (party_type IN ('CUSTOMER','SUPPLIER','BOTH')),
        customer_category TEXT CHECK (customer_category IN ('FARMER','INDIVIDUAL','BUSINESS') OR customer_category IS NULL),
        phone           TEXT,
        address         TEXT,
        email           TEXT,
        opening_balance REAL NOT NULL DEFAULT 0,
        credit_limit    REAL NOT NULL DEFAULT 0,
        account_id      INTEGER REFERENCES accounts(id),
        is_active       INTEGER NOT NULL DEFAULT 1,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (company_id, code)
    );

-- Table: item_categories
CREATE TABLE item_categories (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id      INTEGER NOT NULL REFERENCES companies(id),
        name            TEXT NOT NULL,
        UNIQUE (company_id, name)
    );

-- Table: items
CREATE TABLE items (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        item_code           TEXT NOT NULL,
        item_name           TEXT NOT NULL,
        generic_name        TEXT,
        formula             TEXT,
        strength            TEXT,
        dosage_form         TEXT,
        unit                TEXT NOT NULL,
        manufacturer        TEXT,
        category_id         INTEGER REFERENCES item_categories(id),
        item_type           TEXT NOT NULL DEFAULT 'FINISHED_GOOD'
                              CHECK (item_type IN ('RAW_MATERIAL','PACKING_MATERIAL','FINISHED_GOOD')),
        purchase_price      REAL NOT NULL DEFAULT 0,
        selling_price       REAL NOT NULL DEFAULT 0,
        minimum_stock       REAL NOT NULL DEFAULT 0,
        maximum_stock       REAL NOT NULL DEFAULT 0,
        tax_rate_id         INTEGER REFERENCES tax_rates(id),
        notes               TEXT,
        is_active           INTEGER NOT NULL DEFAULT 1,
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (company_id, item_code)
    );

-- Table: stock_batches
CREATE TABLE stock_batches (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id             INTEGER NOT NULL REFERENCES items(id),
        warehouse_id        INTEGER NOT NULL REFERENCES warehouses(id),
        batch_number        TEXT NOT NULL,
        manufacturing_date  TEXT,
        expiry_date         TEXT,
        purchase_price      REAL NOT NULL DEFAULT 0,
        quantity_in_stock   REAL NOT NULL DEFAULT 0,
        received_date       TEXT NOT NULL DEFAULT (date('now')),
        is_active           INTEGER NOT NULL DEFAULT 1,
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (item_id, warehouse_id, batch_number)
    );

-- Table: stock_movements
CREATE TABLE stock_movements (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id             INTEGER NOT NULL REFERENCES items(id),
        batch_id            INTEGER NOT NULL REFERENCES stock_batches(id),
        warehouse_id        INTEGER NOT NULL REFERENCES warehouses(id),
        movement_type       TEXT NOT NULL CHECK (movement_type IN
                              ('PURCHASE','SALE','SALE_RETURN','PURCHASE_RETURN',
                               'PRODUCTION_IN','PRODUCTION_CONSUME','ADJUSTMENT',
                               'EXPIRY','DAMAGE','OPENING')),
        quantity            REAL NOT NULL,
        unit_cost           REAL NOT NULL DEFAULT 0,
        reference_table     TEXT,
        reference_id        INTEGER,
        movement_date       TEXT NOT NULL DEFAULT (datetime('now')),
        notes               TEXT,
        created_by          INTEGER REFERENCES users(id)
    );

-- Table: sales_invoices
CREATE TABLE sales_invoices (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        warehouse_id        INTEGER NOT NULL REFERENCES warehouses(id),
        invoice_number      TEXT NOT NULL,
        customer_id         INTEGER NOT NULL REFERENCES parties(id),
        invoice_date        TEXT NOT NULL,
        payment_type        TEXT NOT NULL CHECK (payment_type IN ('CASH','BANK','CHEQUE','CREDIT')),
        subtotal            REAL NOT NULL DEFAULT 0,
        discount_amount     REAL NOT NULL DEFAULT 0,
        tax_amount          REAL NOT NULL DEFAULT 0,
        total_amount        REAL NOT NULL DEFAULT 0,
        paid_amount         REAL NOT NULL DEFAULT 0,
        status              TEXT NOT NULL DEFAULT 'CONFIRMED'
                              CHECK (status IN ('DRAFT','CONFIRMED','CANCELLED')),
        notes               TEXT,
        created_by          INTEGER REFERENCES users(id),
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at          TEXT,
        UNIQUE (company_id, invoice_number)
    );

-- Table: sales_invoice_items
CREATE TABLE sales_invoice_items (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id          INTEGER NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
        item_id             INTEGER NOT NULL REFERENCES items(id),
        batch_id            INTEGER REFERENCES stock_batches(id),  -- ✅ FIXED: NULL allowed
        quantity            REAL NOT NULL,
        unit_price          REAL NOT NULL,
        discount_amount     REAL NOT NULL DEFAULT 0,
        tax_amount          REAL NOT NULL DEFAULT 0,
        line_total          REAL NOT NULL
    );

-- Table: sales_returns
CREATE TABLE sales_returns (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        return_number       TEXT NOT NULL,
        invoice_id          INTEGER NOT NULL REFERENCES sales_invoices(id),
        return_date         TEXT NOT NULL,
        total_amount        REAL NOT NULL DEFAULT 0,
        notes               TEXT,
        created_by          INTEGER REFERENCES users(id),
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (company_id, return_number)
    );

-- Table: sales_return_items
CREATE TABLE sales_return_items (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id           INTEGER NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
        invoice_item_id     INTEGER NOT NULL REFERENCES sales_invoice_items(id),
        quantity            REAL NOT NULL,
        line_total          REAL NOT NULL
    );

-- Table: purchase_invoices
CREATE TABLE purchase_invoices (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        warehouse_id        INTEGER NOT NULL REFERENCES warehouses(id),
        invoice_number      TEXT NOT NULL,
        supplier_id         INTEGER NOT NULL REFERENCES parties(id),
        invoice_date        TEXT NOT NULL,
        payment_type        TEXT NOT NULL CHECK (payment_type IN ('CASH','BANK','CHEQUE','CREDIT')),
        subtotal            REAL NOT NULL DEFAULT 0,
        discount_amount     REAL NOT NULL DEFAULT 0,
        tax_amount          REAL NOT NULL DEFAULT 0,
        total_amount        REAL NOT NULL DEFAULT 0,
        paid_amount         REAL NOT NULL DEFAULT 0,
        status              TEXT NOT NULL DEFAULT 'CONFIRMED'
                              CHECK (status IN ('DRAFT','CONFIRMED','CANCELLED')),
        notes               TEXT,
        created_by          INTEGER REFERENCES users(id),
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at          TEXT,
        UNIQUE (company_id, invoice_number)
    );

-- Table: purchase_invoice_items
CREATE TABLE purchase_invoice_items (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id          INTEGER NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
        item_id             INTEGER NOT NULL REFERENCES items(id),
        batch_id            INTEGER REFERENCES stock_batches(id),
        batch_number        TEXT,
        manufacturing_date  TEXT,
        expiry_date         TEXT,
        quantity            REAL NOT NULL,
        unit_cost           REAL NOT NULL,
        discount_amount     REAL NOT NULL DEFAULT 0,
        tax_amount          REAL NOT NULL DEFAULT 0,
        line_total          REAL NOT NULL
    );

-- Table: purchase_returns
CREATE TABLE purchase_returns (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        return_number       TEXT NOT NULL,
        invoice_id          INTEGER NOT NULL REFERENCES purchase_invoices(id),
        return_date         TEXT NOT NULL,
        total_amount        REAL NOT NULL DEFAULT 0,
        notes               TEXT,
        created_by          INTEGER REFERENCES users(id),
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (company_id, return_number)
    );

-- Table: purchase_return_items
CREATE TABLE purchase_return_items (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id           INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
        invoice_item_id     INTEGER NOT NULL REFERENCES purchase_invoice_items(id),
        quantity            REAL NOT NULL,
        line_total          REAL NOT NULL
    );

-- Table: payments
CREATE TABLE payments (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        voucher_number      TEXT NOT NULL,
        party_id            INTEGER NOT NULL REFERENCES parties(id),
        payment_date        TEXT NOT NULL,
        payment_method      TEXT NOT NULL CHECK (payment_method IN ('CASH','BANK','CHEQUE')),
        bank_account_id     INTEGER REFERENCES bank_accounts(id),
        cheque_id           INTEGER REFERENCES cheques(id),
        amount              REAL NOT NULL,
        notes               TEXT,
        created_by          INTEGER REFERENCES users(id),
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (company_id, voucher_number)
    );

-- Table: payment_allocations
CREATE TABLE payment_allocations (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id          INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        purchase_invoice_id INTEGER NOT NULL REFERENCES purchase_invoices(id),
        allocated_amount    REAL NOT NULL
    );

-- Table: receipts
CREATE TABLE receipts (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        voucher_number      TEXT NOT NULL,
        party_id            INTEGER NOT NULL REFERENCES parties(id),
        receipt_date        TEXT NOT NULL,
        payment_method      TEXT NOT NULL CHECK (payment_method IN ('CASH','BANK','CHEQUE')),
        bank_account_id     INTEGER REFERENCES bank_accounts(id),
        cheque_id           INTEGER REFERENCES cheques(id),
        amount              REAL NOT NULL,
        notes               TEXT,
        created_by          INTEGER REFERENCES users(id),
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (company_id, voucher_number)
    );

-- Table: receipt_allocations
CREATE TABLE receipt_allocations (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_id          INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
        sales_invoice_id    INTEGER NOT NULL REFERENCES sales_invoices(id),
        allocated_amount    REAL NOT NULL
    );

-- Table: bill_of_materials
CREATE TABLE bill_of_materials (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        finished_item_id    INTEGER NOT NULL REFERENCES items(id),
        bom_name            TEXT NOT NULL,
        output_quantity     REAL NOT NULL DEFAULT 1,
        notes               TEXT,
        is_active           INTEGER NOT NULL DEFAULT 1,
        created_at          TEXT NOT NULL DEFAULT (datetime('now'))
    );

-- Table: bom_components
CREATE TABLE bom_components (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        bom_id              INTEGER NOT NULL REFERENCES bill_of_materials(id) ON DELETE CASCADE,
        component_item_id   INTEGER NOT NULL REFERENCES items(id),
        quantity_required   REAL NOT NULL,
        wastage_percent     REAL NOT NULL DEFAULT 0
    );

-- Table: production_orders
CREATE TABLE production_orders (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        warehouse_id        INTEGER NOT NULL REFERENCES warehouses(id),
        order_number        TEXT NOT NULL,
        bom_id              INTEGER NOT NULL REFERENCES bill_of_materials(id),
        planned_quantity    REAL NOT NULL,
        actual_quantity     REAL NOT NULL DEFAULT 0,
        wastage_quantity    REAL NOT NULL DEFAULT 0,
        output_batch_number TEXT,
        manufacturing_date  TEXT NOT NULL,
        expiry_date         TEXT,
        production_cost     REAL NOT NULL DEFAULT 0,
        status              TEXT NOT NULL DEFAULT 'DRAFT'
                            CHECK (status IN ('DRAFT','IN_PROGRESS','COMPLETED','CANCELLED')),
        notes               TEXT,
        created_by          INTEGER REFERENCES users(id),
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at          TEXT,  -- ✅ ADD THIS LINE
        completed_at        TEXT,
        UNIQUE (company_id, order_number)
    );

-- Table: production_consumption
CREATE TABLE production_consumption (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        production_order_id INTEGER NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
        component_item_id   INTEGER NOT NULL REFERENCES items(id),
        batch_id            INTEGER NOT NULL REFERENCES stock_batches(id),
        quantity_consumed   REAL NOT NULL,
        unit_cost           REAL NOT NULL DEFAULT 0
    );

-- Table: stock_losses
CREATE TABLE stock_losses (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        item_id             INTEGER NOT NULL REFERENCES items(id),
        batch_id            INTEGER NOT NULL REFERENCES stock_batches(id),
        loss_type           TEXT NOT NULL CHECK (loss_type IN
                              ('EXPIRY','DAMAGE','MANUFACTURING','TRANSPORT')),
        quantity            REAL NOT NULL,
        unit_cost           REAL NOT NULL DEFAULT 0,
        loss_date           TEXT NOT NULL,
        notes               TEXT,
        created_by          INTEGER REFERENCES users(id),
        created_at          TEXT NOT NULL DEFAULT (datetime('now'))
    );

-- Table: bank_accounts
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

-- Table: cheques
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

-- Table: bank_transactions
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

-- Table: expense_categories
CREATE TABLE expense_categories (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        name                TEXT NOT NULL,
        account_id          INTEGER REFERENCES accounts(id),
        is_active           INTEGER NOT NULL DEFAULT 1,
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (company_id, name)
    );

-- Table: expenses
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

-- Table: asset_details
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

-- Table: audit_log
CREATE TABLE audit_log (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id             INTEGER REFERENCES users(id),
        action              TEXT NOT NULL,
        entity_table        TEXT NOT NULL,
        entity_id           INTEGER,
        details             TEXT,
        created_at          TEXT NOT NULL DEFAULT (datetime('now'))
    );

-- Table: settings
CREATE TABLE settings (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        setting_key         TEXT NOT NULL,
        setting_value       TEXT,
        setting_group       TEXT NOT NULL DEFAULT 'GENERAL',
        UNIQUE (company_id, setting_key)
    );

-- Table: numbering_sequences
CREATE TABLE numbering_sequences (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        document_type       TEXT NOT NULL,
        prefix              TEXT NOT NULL DEFAULT '',
        next_number         INTEGER NOT NULL DEFAULT 1,
        padding             INTEGER NOT NULL DEFAULT 5,
        UNIQUE (company_id, document_type)
    );

-- Data for: numbering_sequences
INSERT INTO numbering_sequences (id,company_id,document_type,prefix,next_number,padding) VALUES (1,1,'SALES_INVOICE','SI-',1,5);
INSERT INTO numbering_sequences (id,company_id,document_type,prefix,next_number,padding) VALUES (2,1,'SALES_RETURN','SR-',1,5);
INSERT INTO numbering_sequences (id,company_id,document_type,prefix,next_number,padding) VALUES (3,1,'PURCHASE_INVOICE','PI-',1,5);
INSERT INTO numbering_sequences (id,company_id,document_type,prefix,next_number,padding) VALUES (4,1,'PURCHASE_RETURN','PR-',1,5);
INSERT INTO numbering_sequences (id,company_id,document_type,prefix,next_number,padding) VALUES (5,1,'PAYMENT','PV-',1,5);
INSERT INTO numbering_sequences (id,company_id,document_type,prefix,next_number,padding) VALUES (6,1,'RECEIPT','RV-',1,5);
INSERT INTO numbering_sequences (id,company_id,document_type,prefix,next_number,padding) VALUES (7,1,'JOURNAL_VOUCHER','JV-',1,5);
INSERT INTO numbering_sequences (id,company_id,document_type,prefix,next_number,padding) VALUES (8,1,'PRODUCTION_ORDER','PO-',1,5);
INSERT INTO numbering_sequences (id,company_id,document_type,prefix,next_number,padding) VALUES (9,1,'EXPENSE_VOUCHER','EV-',1,5);
INSERT INTO numbering_sequences (id,company_id,document_type,prefix,next_number,padding) VALUES (10,1,'CUSTOMER','CUST-',1,5);
INSERT INTO numbering_sequences (id,company_id,document_type,prefix,next_number,padding) VALUES (11,1,'SUPPLIER','SUPP-',1,5);
INSERT INTO numbering_sequences (id,company_id,document_type,prefix,next_number,padding) VALUES (12,1,'ITEM','ITEM-',1,5);
INSERT INTO numbering_sequences (id,company_id,document_type,prefix,next_number,padding) VALUES (13,1,'BOM','BOM-',1,5);

