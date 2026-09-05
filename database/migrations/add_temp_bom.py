"""
Idempotent migration adding one-time ("temporary") BOM support.

A temporary production order has no permanently-saved BOM. Internally it
still needs a bill_of_materials row (production_orders.bom_id is NOT NULL
and completion reads components from the BOM), so we create a hidden BOM
flagged `is_temp = 1` and exclude those from the BOM listing UI.

Existing databases (created before this feature) are missing the column.
This module runs on every startup and safely adds it if absent. Fresh
databases get the column straight from schema.py.
"""
from __future__ import annotations

from database.connection import DatabaseConnection
from utils.logger import get_logger

logger = get_logger(__name__)


def run_temp_bom_migration(db: DatabaseConnection) -> None:
    """Add the bill_of_materials.is_temp column if it does not exist."""
    rows = db.fetch_all("PRAGMA table_info(bill_of_materials)") or []
    columns = {str(row.get("name")) for row in rows}
    if "is_temp" in columns:
        return
    db.execute(
        "ALTER TABLE bill_of_materials ADD COLUMN is_temp INTEGER NOT NULL DEFAULT 0"
    )
    logger.info("Added column bill_of_materials.is_temp")