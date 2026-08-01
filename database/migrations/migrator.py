"""
Runs the DDL in database/schema.py against the active connection and
seeds the minimum data the application cannot function without:

- default company + default warehouse (id=1 each, per the current
  single-company/single-warehouse requirement)
- roles (Admin, Accountant, Manager, Storekeeper, Production Manager)
- a starter Chart of Accounts (enough system accounts for the
  accounting engine to post Sales/Purchase/Payment/Receipt entries
  out of the box)
- default numbering sequences for every voucher/document type
- one accountant user with a default password (must be changed on
  first login by the authentication module)

This module is idempotent: running it multiple times is safe because
every statement uses IF NOT EXISTS / INSERT OR IGNORE.
"""
from __future__ import annotations

from database.connection import DatabaseConnection
from database.schema import ALL_STATEMENTS
from utils.logger import get_logger
from utils.security import hash_password

logger = get_logger(__name__)

DEFAULT_ROLES = [
    ("Admin", "Full system access"),
    ("Accountant", "Accounting, sales, purchases and reporting"),
    ("Manager", "Management oversight and reporting"),
    ("Storekeeper", "Inventory and warehouse operations"),
    ("Production Manager", "Manufacturing and production operations"),
]

# System (non-deletable) accounts the accounting engine relies on to
# auto-post journal entries. account_code is the stable key the
# accounting service looks up by (see accounting/system_accounts.py).
SYSTEM_ACCOUNTS: list[tuple[str, str, str, str | None]] = [
    # code,   name,                         type,        subtype
    ("1000", "Cash in Hand",                "ASSET",     "CURRENT_ASSET"),
    ("1010", "Bank Accounts",               "ASSET",     "CURRENT_ASSET"),
    ("1100", "Accounts Receivable",         "ASSET",     "CURRENT_ASSET"),
    ("1200", "Inventory - Raw Materials",   "ASSET",     "CURRENT_ASSET"),
    ("1210", "Inventory - Packing Materials","ASSET",    "CURRENT_ASSET"),
    ("1220", "Inventory - Finished Goods",  "ASSET",     "CURRENT_ASSET"),
    ("1300", "Withholding Tax Receivable",  "ASSET",     "CURRENT_ASSET"),
    ("2000", "Accounts Payable",            "LIABILITY", "CURRENT_LIABILITY"),
    ("2100", "Sales Tax Payable",           "LIABILITY", "CURRENT_LIABILITY"),
    ("2200", "Withholding Tax Payable",     "LIABILITY", "CURRENT_LIABILITY"),
    ("3000", "Owner's Equity",              "EQUITY",    None),
    ("3100", "Retained Earnings",           "EQUITY",    None),
    ("4000", "Sales Revenue",               "REVENUE",   None),
    ("4100", "Sales Returns & Allowances",  "REVENUE",   None),
    ("5000", "Cost of Goods Sold",          "EXPENSE",   None),
    ("5100", "Purchase Returns & Allowances","EXPENSE",  None),
    ("5200", "Manufacturing Wastage Expense","EXPENSE",  None),
    ("5300", "Inventory Loss / Expiry Expense","EXPENSE", None),
    ("6000", "General & Administrative Expenses", "EXPENSE", None),
]

# database/migrations/migrator.py

# database/migrations/migrator.py

DEFAULT_NUMBERING = [
        ("SALES_INVOICE", "SI-"),
        ("SALES_RETURN", "SR-"),
        ("PURCHASE_INVOICE", "PI-"),
        ("PURCHASE_RETURN", "PR-"),
        ("PAYMENT", "PV-"),
        ("RECEIPT", "RV-"),
        ("JOURNAL_VOUCHER", "JV-"),
        ("PRODUCTION_ORDER", "PO-"),
        ("EXPENSE_VOUCHER", "EV-"),
        ("CUSTOMER", "CUST-"),          # Parties
        ("SUPPLIER", "SUPP-"),          # Parties
        ("ITEM", "ITEM-"),              # Items
        ("BOM", "BOM-"),                # ← NEW: BOM auto-generation
        ("PRODUCTION_ORDER", "PO-"),    # Production Orders (already exists)
]


class Migrator:
    def __init__(self, db: DatabaseConnection):
        self._db = db

    def run(self) -> None:
        logger.info("Running schema migration...")
        with self._db.transaction():
            for statement in ALL_STATEMENTS:
                for sub_stmt in statement.strip().split(";"):
                    sub_stmt = sub_stmt.strip()
                    if sub_stmt:
                        self._db.execute(sub_stmt)
        logger.info("Schema migration complete.")
        self._seed_defaults()

    def _seed_defaults(self) -> None:
        with self._db.transaction():
            self._seed_company_and_warehouse()
            self._seed_roles()
            self._seed_accounts()
            self._seed_numbering_sequences()
            self._seed_default_user()
        logger.info("Default data seeding complete.")

    def _seed_company_and_warehouse(self) -> None:
        if not self._db.fetch_one("SELECT id FROM companies WHERE id = 1"):
            self._db.execute(
                "INSERT INTO companies (id, name) VALUES (1, ?)",
                ("My Pharmaceutical Company",),
            )
        if not self._db.fetch_one("SELECT id FROM warehouses WHERE id = 1"):
            self._db.execute(
                "INSERT INTO warehouses (id, company_id, code, name, is_default) "
                "VALUES (1, 1, 'MAIN', 'Main Warehouse', 1)"
            )

    def _seed_roles(self) -> None:
        for name, description in DEFAULT_ROLES:
            self._db.execute(
                "INSERT OR IGNORE INTO roles (name, description) VALUES (?, ?)",
                (name, description),
            )

    def _seed_accounts(self) -> None:
        for code, name, acc_type, subtype in SYSTEM_ACCOUNTS:
            self._db.execute(
                """
                INSERT OR IGNORE INTO accounts
                    (company_id, account_code, account_name, account_type,
                     account_subtype, is_system_account)
                VALUES (1, ?, ?, ?, ?, 1)
                """,
                (code, name, acc_type, subtype),
            )

    def _seed_numbering_sequences(self) -> None:
        for doc_type, prefix in DEFAULT_NUMBERING:
            self._db.execute(
                """
                INSERT OR IGNORE INTO numbering_sequences
                    (company_id, document_type, prefix, next_number, padding)
                VALUES (1, ?, ?, 1, 5)
                """,
                (doc_type, prefix),
            )

    def _seed_default_user(self) -> None:
        existing = self._db.fetch_one("SELECT id FROM users LIMIT 1")
        if existing:
            return
        admin_role = self._db.fetch_one("SELECT id FROM roles WHERE name = 'Admin'")
        role_id = admin_role["id"] if admin_role else None
        salt, pwd_hash = hash_password("admin123")
        self._db.execute(
            """
            INSERT INTO users (username, password_hash, password_salt, full_name, role_id)
            VALUES (?, ?, ?, ?, ?)
            """,
            ("admin", pwd_hash, salt, "System Administrator", role_id),
        )
        logger.warning(
            "Seeded default user 'admin' with password 'admin123'. "
            "Change this password immediately after first login."
        )


def run_migrations(db: DatabaseConnection) -> None:
    Migrator(db).run()
