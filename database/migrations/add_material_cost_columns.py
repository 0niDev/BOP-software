"""
Idempotent column migration for splitting raw vs packing material costs.

The main migrator (database/migrations/migrator.py) only runs CREATE TABLE
statements on a freshly-created database. Existing (already-initialized)
databases from before this feature therefore lack the new columns and the
new "Cost of Packing Materials" (5001) account.

This module runs on every startup and safely adds anything missing:
  - production_orders.raw_material_cost / packing_material_cost
  - stock_batches.raw_unit_cost / packing_unit_cost
  - accounts row "5001 - Cost of Packing Materials" (EXPENSE)

Every operation is guarded, so repeated runs are no-ops.
"""
from __future__ import annotations

from database.connection import DatabaseConnection
from utils.logger import get_logger

logger = get_logger(__name__)

_COLUMN_MIGRATIONS: list[tuple[str, str, str]] = [
    # table,      column,                ddl
    ("production_orders", "raw_material_cost", "REAL NOT NULL DEFAULT 0"),
    ("production_orders", "packing_material_cost", "REAL NOT NULL DEFAULT 0"),
    ("stock_batches", "raw_unit_cost", "REAL NOT NULL DEFAULT 0"),
    ("stock_batches", "packing_unit_cost", "REAL NOT NULL DEFAULT 0"),
]

_SYSTEM_ACCOUNTS_5001 = (
    "5001",
    "Cost of Packing Materials",
    "EXPENSE",
    None,
)


def _table_columns(db: DatabaseConnection, table: str) -> set[str]:
    rows = db.fetch_all(f"PRAGMA table_info({table})") or []
    return {str(row.get("name")) for row in rows}


def run_column_migration(db: DatabaseConnection) -> None:
    """Add missing material-cost columns and seed the 5001 account."""
    for table, column, ddl in _COLUMN_MIGRATIONS:
        existing = _table_columns(db, table)
        if column in existing:
            continue
        try:
            db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")
            logger.info("Added column %s.%s", table, column)
        except Exception as e:  # pragma: no cover - defensive
            logger.warning("Could not add column %s.%s: %s", table, column, e)

    existing_5001 = db.fetch_one(
        "SELECT id FROM accounts WHERE company_id = 1 AND account_code = ?",
        ("5001",),
    )
    if not existing_5001:
        code, name, acc_type, subtype = _SYSTEM_ACCOUNTS_5001
        db.execute(
            """
            INSERT OR IGNORE INTO accounts
                (company_id, account_code, account_name, account_type,
                 account_subtype, is_system_account)
            VALUES (1, ?, ?, ?, ?, 1)
            """,
            (code, name, acc_type, subtype),
        )
        logger.info("Seeded account 5001 - Cost of Packing Materials")