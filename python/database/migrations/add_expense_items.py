"""
Idempotent migration for the "Pay Items" bulk-payment feature.

Adds a per-category recurring expense item list (e.g. salary payees such as
Editor, Janitor, or recurring bills like Electricity, Rent) and seeds the
EXPENSE numbering sequence used when paying selected items.

Runs on every startup; all operations are guarded so repeated runs are
no-ops. Mirrors database/migrations/add_material_cost_columns.py.
"""
from __future__ import annotations

from database.connection import DatabaseConnection
from utils.logger import get_logger

logger = get_logger(__name__)

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS expense_items (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id          INTEGER NOT NULL REFERENCES companies(id),
    category_id         INTEGER NOT NULL REFERENCES expense_categories(id),
    name                TEXT NOT NULL,
    amount              REAL,
    is_active           INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT,
    UNIQUE (company_id, category_id, name)
);
"""


def run_expense_items_migration(db: DatabaseConnection) -> None:
    """Create the expense_items table and seed the EXPENSE sequence if missing."""
    try:
        db.execute(_CREATE_TABLE)
        logger.info("Ensured expense_items table exists")
    except Exception as e:  # pragma: no cover - defensive
        logger.warning("Could not create expense_items table: %s", e)

    try:
        existing = db.fetch_one(
            "SELECT 1 FROM numbering_sequences WHERE company_id = 1 AND document_type = 'EXPENSE'"
        )
        if not existing:
            db.execute(
                """
                INSERT OR IGNORE INTO numbering_sequences
                    (company_id, document_type, prefix, next_number, padding)
                VALUES (1, 'EXPENSE', 'EXP-', 1, 6)
                """
            )
            logger.info("Seeded EXPENSE numbering sequence")
    except Exception as e:  # pragma: no cover - defensive
        logger.warning("Could not seed EXPENSE numbering sequence: %s", e)
