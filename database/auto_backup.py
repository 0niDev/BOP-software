#!/usr/bin/env python3
"""
Automatic backup script - Creates SQLite .db file backup.
"""
import sqlitecloud
import datetime
import os
import sys
import glob
import sqlite3
import time

# Set environment variable
os.environ['ERP_DB_ENGINE'] = 'sqlitecloud'
os.environ['SQLITE_CLOUD_URL'] = 'sqlitecloud://cjja8z6pvz.g4.sqlite.cloud:8860/cool-depot.sqlite?apikey=bmJZ0l1RTFCoxS0Au17c0iofzZmrDn2Db94v0YtV9Uw'

DB_URL = os.environ.get('SQLITE_CLOUD_URL')


def auto_backup():
    """Create automatic backup as SQLite .db file."""
    backup_dir = "backups"
    max_backups = 30
    
    os.makedirs(backup_dir, exist_ok=True)
    
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(backup_dir, f"erp_backup_{timestamp}.db")
    
    # Check if DB_URL is set
    if not DB_URL:
        print("❌ Auto-backup failed: SQLITE_CLOUD_URL environment variable not set")
        return False
    
    try:
        print(f"🔄 Creating .db backup at {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Connect to cloud database with retry logic and better error handling
        cloud_conn = None
        retry_count = 0
        max_retries = 3
        
        while retry_count < max_retries:
            try:
                cloud_conn = sqlitecloud.connect(DB_URL)
                break
            except sqlitecloud.Error as e:
                error_msg = str(e)
                retry_count += 1
                
                # Check for specific "database does not exist" error
                if "does not exist" in error_msg:
                    print(f"❌ Auto-backup failed: Database does not exist on SQLite Cloud server")
                    print(f"   Error: {error_msg}")
                    print(f"   Please ensure the database is created on SQLite Cloud first.")
                    return False
                
                if retry_count >= max_retries:
                    print(f"❌ Auto-backup failed after {max_retries} retries: {e}")
                    raise
                print(f"⚠️ Connection attempt {retry_count} failed ({e}), retrying in 2 seconds...")
                time.sleep(2)
        
        # Verify database exists and is accessible by checking tables
        try:
            tables = cloud_conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()
        except sqlitecloud.Error as e:
            error_msg = str(e)
            if "does not exist" in error_msg:
                print(f"❌ Auto-backup failed: Database does not exist or is not accessible")
                print(f"   Error: {error_msg}")
                cloud_conn.close()
                return False
            raise
        
        if not tables:
            print("⚠️ No tables found in database")
            cloud_conn.close()
            local_conn.close()
            return False
        
        print(f"📊 Found {len(tables)} tables to backup")
        
        # Copy each table
        for table in tables:
            table_name = table[0]
            print(f"  📋 Copying: {table_name}")
            
            # Get schema
            schema = cloud_conn.execute(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table_name}'").fetchone()
            if schema:
                # Create table in local database
                local_conn.execute(schema[0])
            
            # Get data
            rows = cloud_conn.execute(f"SELECT * FROM {table_name}").fetchall()
            if rows:
                # Get column names
                columns = [desc[0] for desc in cloud_conn.execute(f"SELECT * FROM {table_name} LIMIT 1").description]
                placeholders = ','.join(['?' for _ in columns])
                columns_str = ','.join(columns)
                
                # Insert data
                local_conn.executemany(
                    f"INSERT INTO {table_name} ({columns_str}) VALUES ({placeholders})",
                    rows
                )
        
        # Commit and close
        local_conn.commit()
        local_conn.close()
        cloud_conn.close()
        
        size = os.path.getsize(backup_file)
        print(f"✅ .db backup created: {backup_file} ({size / 1024:.2f} KB)")
        
        # Cleanup old backups
        backup_files = sorted(
            glob.glob(os.path.join(backup_dir, "erp_backup_*.db")),
            key=lambda x: os.path.getmtime(x)
        )
        
        while len(backup_files) > max_backups:
            old_file = backup_files.pop(0)
            os.remove(old_file)
            print(f"🗑️ Removed old backup: {os.path.basename(old_file)}")
            
        return True
            
    except Exception as e:
        print(f"❌ Auto-backup failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = auto_backup()
    sys.exit(0 if success else 1)