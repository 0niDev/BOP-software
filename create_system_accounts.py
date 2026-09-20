"""
Create BOP system accounts that are required by import scripts but don't exist
in the PharmaPro COA. These are BOP-style accounts (1000, 1100, 2000, 3100,
6000, 6100, 1501-1505) that the import scripts reference.

Run this BEFORE any import scripts.
"""
import os
import sys

from utils.env_loader import setup_import_env
setup_import_env()

from database.connection import get_db, close_db

# BOP system accounts required by import scripts
SYSTEM_ACCOUNTS = [
    # (code, name, type, subtype, is_system)
    ("1000", "Cash", "ASSET", "CURRENT_ASSET", True),
    ("1100", "Accounts Receivable", "ASSET", "CURRENT_ASSET", True),
    ("1200", "Inventory - Raw Material", "ASSET", "CURRENT_ASSET", True),
    ("1210", "Inventory - Packing Material", "ASSET", "CURRENT_ASSET", True),
    ("1220", "Inventory - Finished Goods", "ASSET", "CURRENT_ASSET", True),
    ("1500", "Fixed Assets", "ASSET", "NON_CURRENT_ASSET", True),
    ("1501", "HBL Instalment", "ASSET", "NON_CURRENT_ASSET", True),
    ("1502", "Motor Car Instalment", "ASSET", "NON_CURRENT_ASSET", True),
    ("1503", "Auto Vehicles", "ASSET", "NON_CURRENT_ASSET", True),
    ("1504", "Furniture & Fixtures", "ASSET", "NON_CURRENT_ASSET", True),
    ("1505", "Car Sale & Purchase", "ASSET", "NON_CURRENT_ASSET", True),
    ("2000", "Accounts Payable", "LIABILITY", "CURRENT_LIABILITY", True),
    ("3000", "Equity", "EQUITY", None, True),
    ("3100", "Retained Earnings", "EQUITY", None, True),
    ("4000", "Sales Revenue", "REVENUE", None, True),
    ("5000", "Cost of Goods Sold", "EXPENSE", None, True),
    ("6000", "General & Administrative", "EXPENSE", None, True),
    ("6100", "Selling Expenses", "EXPENSE", None, True),
]


def main():
    db = get_db()
    created = 0
    skipped = 0

    for code, name, atype, subtype, is_sys in SYSTEM_ACCOUNTS:
        existing = db.fetch_one(
            "SELECT id FROM accounts WHERE company_id = 1 AND account_code = ?",
            (code,),
        )
        if existing:
            skipped += 1
            continue
        db.execute(
            """INSERT INTO accounts
               (company_id, account_code, account_name, account_type,
                account_subtype, is_system_account, is_active)
               VALUES (1, ?, ?, ?, ?, ?, 1)""",
            (code, name, atype, subtype, int(is_sys)),
        )
        print(f"  CREATED  {code} {name}")
        created += 1

    close_db()
    print(f"\nDone: {created} created, {skipped} already existed")


if __name__ == "__main__":
    main()
