"""Import products from product_info.csv that don't already exist in the system.

Reads product details from product_info.csv, skips duplicates (case-insensitive
name match against existing items), and creates missing items via ItemService.
"""
from __future__ import annotations

import csv
import os
import sys

from utils.env_loader import setup_import_env
setup_import_env()

from database.connection import get_db, close_db
from services.item_service import ItemService

SOURCE_FILE = "product_info.csv"
VALID_UNITS = {"TABLET", "CAPSULE", "ML", "GRAM", "KG", "UNIT", "VIAL", "AMPOULE"}
VALID_TYPES = {"RAW_MATERIAL", "PACKING_MATERIAL", "FINISHED_GOOD"}


def load_products(path: str) -> list[dict]:
    products: list[dict] = []
    with open(path, encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            name = row.get("Item Name", "").strip()
            if not name:
                continue
            unit = (row.get("Unit") or "UNIT").strip().upper()
            if unit not in VALID_UNITS:
                unit = "UNIT"
            item_type = (row.get("Item Type") or "FINISHED_GOOD").strip().upper()
            if item_type not in VALID_TYPES:
                item_type = "FINISHED_GOOD"
            products.append({"name": name, "unit": unit, "item_type": item_type})
    return products


def main() -> None:
    if not os.path.exists(SOURCE_FILE):
        print(f"FATAL: {SOURCE_FILE} not found.")
        sys.exit(1)

    products = load_products(SOURCE_FILE)
    print(f"Parsed {len(products)} products from {SOURCE_FILE}")

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

    for product in products:
        name = product["name"]
        if name.strip().lower() in existing:
            print(f"  SKIP  {name} (already exists)")
            skipped += 1
            continue
        try:
            service.create_item(
                item_name=name,
                unit=product["unit"],
                item_type=product["item_type"],
                purchase_price=0.0,
                selling_price=0.0,
                minimum_stock=0.0,
                maximum_stock=0.0,
                notes=None,
                tax_rate_id=None,
                category_id=None,
            )
            print(f"  ADD   {name}  ({product['item_type']}, {product['unit']})")
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
