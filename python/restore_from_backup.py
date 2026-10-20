#!/usr/bin/env python3
"""Restore database from a backup file."""
import sys
import sqlite3
from database.connection import create_connection
from utils.logger import get_logger

logger = get_logger(__name__)

def restore_from_backup(backup_path: str):
    """Restore all data from backup to cloud database."""
    print(f"🔄 Restoring from {backup_path}...")
    
    # Connect to backup
    backup_conn = sqlite3.connect(backup_path)
    backup_conn.row_factory = sqlite3.Row
    backup_cursor = backup_conn.cursor()
    
    # Connect to cloud
    cloud_db = create_connection()
    
    tables_to_restore = [
        'companies', 'warehouses', 'roles', 'permissions', 'role_permissions',
        'users', 'accounts', 'journal_entries', 'journal_entry_lines',
        'parties', 'item_categories', 'items', 'stock_batches',
        'stock_movements', 'sales_invoices', 'sales_invoice_items',
        'purchase_invoices', 'purchase_invoice_items', 'payments',
        'payment_allocations', 'receipts', 'receipt_allocations',
        'bill_of_materials', 'bom_components', 'production_orders',
        'production_consumption', 'tax_rates'
    ]
    
    restored_count = 0
    
    for table in tables_to_restore:
        try:
            # Get all data from backup
            backup_cursor.execute(f"SELECT * FROM {table}")
            rows = backup_cursor.fetchall()
            
            if not rows:
                continue
            
            # Get column names
            columns = [description[0] for description in backup_cursor.description]
            placeholders = ','.join(['?' for _ in columns])
            column_names = ','.join(columns)
            
            # Insert into cloud using executemany
            sql = f"INSERT OR REPLACE INTO {table} ({column_names}) VALUES ({placeholders})"
            
            values_list = [tuple(row[col] for col in columns) for row in rows]
            cloud_db.executemany(sql, values_list)
            restored_count += len(rows)
            
            print(f"✅ Restored {len(rows)} rows to {table}")
            
        except Exception as e:
            print(f"❌ Error restoring {table}: {e}")
    
    # Commit all changes - not needed with executemany as it auto-commits
    print(f"\n✨ Restoration complete! Total rows restored: {restored_count}")
    
    # Verify
    item_result = cloud_db.fetch_one("SELECT COUNT(*) as count FROM items")
    item_count = item_result['count'] if item_result else 0
    batch_result = cloud_db.fetch_one("SELECT COUNT(*) as count FROM stock_batches")
    batch_count = batch_result['count'] if batch_result else 0
    
    print(f"📊 Verification: {item_count} items, {batch_count} stock batches in cloud database")
    
    backup_conn.close()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python restore_from_backup.py <backup_file.db>")
        print("\nAvailable backups:")
        import os
        for f in sorted(os.listdir('backups')):
            if f.endswith('.db'):
                print(f"  - backups/{f}")
        sys.exit(1)
    
    backup_file = sys.argv[1]
    restore_from_backup(backup_file)
