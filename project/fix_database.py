"""Fix database - add missing columns."""
import sqlite3
import os

def fix_database():
    """Add missing columns to tables."""
    db_path = "data/erp.db"
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if updated_at exists in production_orders
    cursor.execute("SELECT name FROM pragma_table_info('production_orders') WHERE name='updated_at'")
    result = cursor.fetchone()
    
    if not result:
        print("Adding updated_at column to production_orders...")
        cursor.execute("ALTER TABLE production_orders ADD COLUMN updated_at TEXT")
        conn.commit()
        print("Done!")
    else:
        print("updated_at column already exists in production_orders")
    
    # Check if created_at exists in stock_batches
    cursor.execute("SELECT name FROM pragma_table_info('stock_batches') WHERE name='created_at'")
    result = cursor.fetchone()
    
    if not result:
        print("Adding created_at column to stock_batches...")
        cursor.execute("ALTER TABLE stock_batches ADD COLUMN created_at TEXT")
        cursor.execute("UPDATE stock_batches SET created_at = datetime('now')")
        conn.commit()
        print("Done!")
    else:
        print("created_at column already exists in stock_batches")
    
    conn.close()
    print("Database fix complete!")

if __name__ == "__main__":
    fix_database()