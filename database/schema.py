"""
Full database schema (DDL) for the Pharmaceutical ERP.

Design notes
------------
* Every business table carries a `company_id` and, where relevant, a
  `warehouse_id`, even though the app currently runs single-company /
  single-warehouse. A default row (id=1) is seeded for each, so today's
  code can ignore multi-tenancy while the schema is already future-ready.
* Money is stored as REAL (SQLite has no fixed-point DECIMAL type); the
  service layer is responsible for rounding consistently. Swapping to
  MySQL/PostgreSQL later means changing these to DECIMAL(18,4) in one
  place without touching business logic.
* Soft-delete via `is_active` instead of physical deletes, so ledgers
  and historical documents always resolve correctly.
* All monetary documents (sales, purchases, payments, receipts,
  manufacturing) are linked 1:1 to a journal_entries row, which is how
  double-entry accounting stays automatic and auditable.
"""
from __future__ import annotations

# Order matters: tables are created in this sequence so FK targets
# already exist when referencing tables are created.
SCHEMA_STATEMENTS: list[str] = [
    # ------------------------------------------------------------------
    # Company / Warehouse (multi-company & multi-warehouse ready)
    # ------------------------------------------------------------------
    """
    CREATE TABLE IF NOT EXISTS companies (
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
    """,
    """
    CREATE TABLE IF NOT EXISTS warehouses (
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
    """,
    # ------------------------------------------------------------------
    # Authentication: Users / Roles / Permissions
    # ------------------------------------------------------------------
    """
    CREATE TABLE IF NOT EXISTS roles (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        name            TEXT NOT NULL UNIQUE,
        description     TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS permissions (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        code            TEXT NOT NULL UNIQUE,
        description     TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS role_permissions (
        role_id         INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_id   INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS users (
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
    """,
    # ------------------------------------------------------------------
    # Chart of Accounts / Journal (Double Entry core)
    # ------------------------------------------------------------------
    """
    CREATE TABLE IF NOT EXISTS accounts (
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
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type);
    """,
    """
    CREATE TABLE IF NOT EXISTS journal_entries (
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
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_je_date ON journal_entries(entry_date);
    CREATE INDEX IF NOT EXISTS idx_je_source ON journal_entries(source_table, source_id);
    """,
    """
    CREATE TABLE IF NOT EXISTS journal_entry_lines (
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
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_jel_account ON journal_entry_lines(account_id);
    CREATE INDEX IF NOT EXISTS idx_jel_party ON journal_entry_lines(party_id);
    """,
    # ------------------------------------------------------------------
    # Parties (Customers / Suppliers share one physical table)
    # ------------------------------------------------------------------
    """
    CREATE TABLE IF NOT EXISTS parties (
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
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_parties_type ON parties(party_type);
    CREATE INDEX IF NOT EXISTS idx_parties_name ON parties(name);
    """,
    # ------------------------------------------------------------------
    # Inventory: Items, Batches, Stock Movements
    # ------------------------------------------------------------------
    """
    CREATE TABLE IF NOT EXISTS item_categories (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id      INTEGER NOT NULL REFERENCES companies(id),
        name            TEXT NOT NULL,
        UNIQUE (company_id, name)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS items (
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
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_items_name ON items(item_name);
    CREATE INDEX IF NOT EXISTS idx_items_generic ON items(generic_name);
    """,
    """
    CREATE TABLE IF NOT EXISTS stock_batches (
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
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_batches_expiry ON stock_batches(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_batches_item ON stock_batches(item_id);
    """,
    """
    CREATE TABLE IF NOT EXISTS stock_movements (
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
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_movements_item ON stock_movements(item_id);
    CREATE INDEX IF NOT EXISTS idx_movements_ref ON stock_movements(reference_table, reference_id);
    """,
    # ------------------------------------------------------------------
    # Taxes (created before items references it)
    # ------------------------------------------------------------------
    # ------------------------------------------------------------------
    # Sales
    # ------------------------------------------------------------------
    """
    CREATE TABLE IF NOT EXISTS sales_invoices (
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
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_si_date ON sales_invoices(invoice_date);
    CREATE INDEX IF NOT EXISTS idx_si_customer ON sales_invoices(customer_id);
    """,
    """
    CREATE TABLE IF NOT EXISTS sales_invoice_items (
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
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_sii_invoice ON sales_invoice_items(invoice_id);
    """,
    """
    CREATE TABLE IF NOT EXISTS sales_returns (
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
    """,
    """
    CREATE TABLE IF NOT EXISTS sales_return_items (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id           INTEGER NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
        invoice_item_id     INTEGER NOT NULL REFERENCES sales_invoice_items(id),
        quantity            REAL NOT NULL,
        line_total          REAL NOT NULL
    );
    """,
    
    # ------------------------------------------------------------------
    # Purchases
    # ------------------------------------------------------------------
    """
    CREATE TABLE IF NOT EXISTS purchase_invoices (
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
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_pi_date ON purchase_invoices(invoice_date);
    CREATE INDEX IF NOT EXISTS idx_pi_supplier ON purchase_invoices(supplier_id);
    """,
    """
    CREATE TABLE IF NOT EXISTS purchase_invoice_items (
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
    """,
    """
    CREATE TABLE IF NOT EXISTS purchase_returns (
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
    """,
    """
    CREATE TABLE IF NOT EXISTS purchase_return_items (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id           INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
        invoice_item_id     INTEGER NOT NULL REFERENCES purchase_invoice_items(id),
        quantity            REAL NOT NULL,
        line_total          REAL NOT NULL
    );
    """,
    # ------------------------------------------------------------------
    # Payments / Receipts
    # ------------------------------------------------------------------
    """
    CREATE TABLE IF NOT EXISTS payments (
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
    """,
    """
    CREATE TABLE IF NOT EXISTS payment_allocations (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id          INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        purchase_invoice_id INTEGER NOT NULL REFERENCES purchase_invoices(id),
        allocated_amount    REAL NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS receipts (
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
    """,
    """
    CREATE TABLE IF NOT EXISTS receipt_allocations (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_id          INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
        sales_invoice_id    INTEGER NOT NULL REFERENCES sales_invoices(id),
        allocated_amount    REAL NOT NULL
    );
    """,
    # ------------------------------------------------------------------
    # Manufacturing: BOM / Production Orders
    # ------------------------------------------------------------------
    """
    CREATE TABLE IF NOT EXISTS bill_of_materials (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        finished_item_id    INTEGER NOT NULL REFERENCES items(id),
        bom_name            TEXT NOT NULL,
        output_quantity     REAL NOT NULL DEFAULT 1,
        notes               TEXT,
        is_active           INTEGER NOT NULL DEFAULT 1,
        created_at          TEXT NOT NULL DEFAULT (datetime('now'))
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS bom_components (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        bom_id              INTEGER NOT NULL REFERENCES bill_of_materials(id) ON DELETE CASCADE,
        component_item_id   INTEGER NOT NULL REFERENCES items(id),
        quantity_required   REAL NOT NULL,
        wastage_percent     REAL NOT NULL DEFAULT 0
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS production_orders (
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
    """,
    """
    CREATE TABLE IF NOT EXISTS production_consumption (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        production_order_id INTEGER NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
        component_item_id   INTEGER NOT NULL REFERENCES items(id),
        batch_id            INTEGER NOT NULL REFERENCES stock_batches(id),
        quantity_consumed   REAL NOT NULL,
        unit_cost           REAL NOT NULL DEFAULT 0
    );
    """,
    # ------------------------------------------------------------------
    # Loss / Disposal
    # ------------------------------------------------------------------
    """
    CREATE TABLE IF NOT EXISTS stock_losses (
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
    """,
    # ------------------------------------------------------------------
    # Banking
    # ------------------------------------------------------------------
    """
    CREATE TABLE IF NOT EXISTS bank_accounts (
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
    """,
    """
    CREATE TABLE IF NOT EXISTS cheques (
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
    """,
    """
    CREATE TABLE IF NOT EXISTS bank_transactions (
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
    """,
    # ------------------------------------------------------------------
    # Expenses
    # ------------------------------------------------------------------
    """
    CREATE TABLE IF NOT EXISTS expense_categories (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        name                TEXT NOT NULL,
        account_id          INTEGER REFERENCES accounts(id),
        is_active           INTEGER NOT NULL DEFAULT 1,
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (company_id, name)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS expenses (
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
    """,
        """
    CREATE TABLE IF NOT EXISTS asset_details (
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
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_asset_details_account ON asset_details(account_id);
    """,
    # ------------------------------------------------------------------
    # Audit trail (supports "Recent Transactions" widget + accountability)
    # ------------------------------------------------------------------
    """
    CREATE TABLE IF NOT EXISTS audit_log (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id             INTEGER REFERENCES users(id),
        action              TEXT NOT NULL,
        entity_table        TEXT NOT NULL,
        entity_id           INTEGER,
        details             TEXT,
        created_at          TEXT NOT NULL DEFAULT (datetime('now'))
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_table, entity_id);
    """,
    # ------------------------------------------------------------------
    # Settings (key/value, no hardcoded settings anywhere in app code)
    # ------------------------------------------------------------------
    """
    CREATE TABLE IF NOT EXISTS settings (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        setting_key         TEXT NOT NULL,
        setting_value       TEXT,
        setting_group       TEXT NOT NULL DEFAULT 'GENERAL',
        UNIQUE (company_id, setting_key)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS numbering_sequences (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id          INTEGER NOT NULL REFERENCES companies(id),
        document_type       TEXT NOT NULL,
        prefix              TEXT NOT NULL DEFAULT '',
        next_number         INTEGER NOT NULL DEFAULT 1,
        padding             INTEGER NOT NULL DEFAULT 5,
        UNIQUE (company_id, document_type)
    );
    """,
]

# Tables that other tables above reference before they are (textually)
# defined -- SQLite resolves FK targets lazily as long as the target
# table exists by the time constraints are enforced (PRAGMA foreign_keys
# is checked at write time, not at CREATE TABLE time), so declaration
# order is mostly cosmetic. tax_rates, however, is referenced by `items`
# via a column default lookup and must exist first for clarity.
EARLY_STATEMENTS: list[str] = [
    """
    CREATE TABLE IF NOT EXISTS tax_rates (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id      INTEGER NOT NULL REFERENCES companies(id),
        name            TEXT NOT NULL,
        tax_type        TEXT NOT NULL CHECK (tax_type IN ('SALES_TAX','WITHHOLDING_TAX')),
        rate_percent    REAL NOT NULL,
        is_active       INTEGER NOT NULL DEFAULT 1,
        UNIQUE (company_id, name)
    );
    """,
]

ALL_STATEMENTS: list[str] = EARLY_STATEMENTS + SCHEMA_STATEMENTS