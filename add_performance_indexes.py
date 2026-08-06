#!/usr/bin/env python3
"""
Migration script to add performance indexes for purchase invoice operations.
These indexes significantly speed up:
1. Stock batch lookups by item_id and warehouse_id
2. Journal entry balance calculations by account_id and is_posted
3. Journal entry line queries
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "erp.db"

INDEXES = [
    # Journal entries - for faster posted entry filtering
    "CREATE INDEX IF NOT EXISTS idx_je_is_posted ON journal_entries(is_posted)",
    "CREATE INDEX IF NOT EXISTS idx_je_company_posted ON journal_entries(company_id, is_posted)",
    "CREATE INDEX IF NOT EXISTS idx_je_entry_date ON journal_entries(entry_date)",
    
    # Journal entry lines - for faster balance calculations
    "CREATE INDEX IF NOT EXISTS idx_jel_account ON journal_entry_lines(account_id)",
    "CREATE INDEX IF NOT EXISTS idx_jel_account_je ON journal_entry_lines(account_id, journal_entry_id)",
    "CREATE INDEX IF NOT EXISTS idx_jel_party ON journal_entry_lines(party_id)",
    
    # Stock batches - for faster stock lookups during purchase
    "CREATE INDEX IF NOT EXISTS idx_batches_item ON stock_batches(item_id)",
    "CREATE INDEX IF NOT EXISTS idx_batches_item_warehouse ON stock_batches(item_id, warehouse_id, is_active)",
    "CREATE INDEX IF NOT EXISTS idx_batches_expiry ON stock_batches(expiry_date)",
    
    # Purchase invoices - for faster lookups
    "CREATE INDEX IF NOT EXISTS idx_pi_supplier ON purchase_invoices(supplier_id)",
    "CREATE INDEX IF NOT EXISTS idx_pi_date ON purchase_invoices(invoice_date)",
    "CREATE INDEX IF NOT EXISTS idx_pi_company ON purchase_invoices(company_id)",
    
    # Purchase invoice items
    "CREATE INDEX IF NOT EXISTS idx_pii_invoice ON purchase_invoice_items(invoice_id)",
    "CREATE INDEX IF NOT EXISTS idx_pii_item ON purchase_invoice_items(item_id)",
]


def run_migration():
    """Add performance indexes to the database."""
    if not DB_PATH.exists():
        print(f"❌ Database not found at {DB_PATH}")
        return False
    
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    print("📊 Checking existing indexes...")
    cursor.execute('SELECT name FROM sqlite_master WHERE type="index"')
    existing = {row[0] for row in cursor.fetchall()}
    
    created_count = 0
    skipped_count = 0
    
    for sql in INDEXES:
        # Extract index name from SQL
        parts = sql.split(" ")
        if "idx_" in sql:
            for part in parts:
                if part.startswith("idx_"):
                    index_name = part
                    break
        
        if index_name in existing:
            print(f"⏭️  Index already exists: {index_name}")
            skipped_count += 1
            continue
        
        try:
            cursor.execute(sql)
            print(f"✅ Created index: {index_name}")
            created_count += 1
        except sqlite3.Error as e:
            print(f"❌ Failed to create {index_name}: {e}")
    
    conn.commit()
    conn.close()
    
    print(f"\n📈 Migration complete!")
    print(f"   Created: {created_count} indexes")
    print(f"   Skipped: {skipped_count} indexes (already existed)")
    
    return True


if __name__ == "__main__":
    run_migration()
