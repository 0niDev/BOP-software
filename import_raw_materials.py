"""One-off import of raw materials from 'list of raw material.txt' into inventory.

Reads the numbered list, skips '*(missing)*' entries, and creates each material
via ItemService with defaults: unit=KG, item_type=RAW_MATERIAL, all prices and
stock levels at 0. Existing items (matched by name, case-insensitive) are skipped.
"""
from __future__ import annotations

import os
import re

os.environ["ERP_LOG_LEVEL"] = "CRITICAL"
os.environ["ERP_DB_ENGINE"] = "sqlitecloud"
os.environ["SQLITE_CLOUD_URL"] = (
    "sqlitecloud://cjja8z6pvz.g4.sqlite.cloud:8860/erp_backup_20260820_023705.db?apikey=bmJZ0l1RTFCoxS0Au17c0iofzZmrDn2Db94v0YtV9Uw"
)

from database.connection import get_db, close_db
from services.item_service import ItemService

SOURCE_FILE = "list of raw material.txt"

MISSING_RE = re.compile(r"^\*\s*missing\s*\*$", re.IGNORECASE)


def parse_materials(path: str) -> list[str]:
    materials: list[str] = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            name = line.strip()
            if not name or MISSING_RE.match(name):
                continue
            materials.append(name)
    return materials


def main() -> None:
    materials = parse_materials(SOURCE_FILE)
    print(f"Parsed {len(materials)} materials from {SOURCE_FILE}")

    db = get_db()
    service = ItemService(db)

    existing_rows = db.fetch_all(
        "SELECT item_name FROM items WHERE company_id = 1"
    )
    existing = {row["item_name"].strip().lower() for row in existing_rows}
    print(f"Found {len(existing)} existing items; skipping names that already exist")

    created = 0
    skipped = 0
    failed = 0

    for name in materials:
        if name.strip().lower() in existing:
            print(f"  SKIP  {name} (already exists)")
            skipped += 1
            continue
        try:
            service.create_item(
                item_name=name,
                unit="KG",
                item_type="RAW_MATERIAL",
                purchase_price=0.0,
                selling_price=0.0,
                minimum_stock=0.0,
                maximum_stock=0.0,
                notes=None,
                tax_rate_id=None,
                category_id=None,
            )
            print(f"  ADD   {name}")
            created += 1
            existing.add(name.strip().lower())
        except Exception as exc:
            print(f"  FAIL  {name}: {exc}")
            failed += 1

    print("\n===== SUMMARY =====")
    print(f"Created: {created}")
    print(f"Skipped: {skipped}")
    print(f"Failed:  {failed}")

    close_db()


if __name__ == "__main__":
    main()