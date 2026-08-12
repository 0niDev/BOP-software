#!/usr/bin/env python3
"""
Backup Manager for SQLite Cloud - Creates SQLite .db file.
"""
import sqlitecloud
import datetime
import os
import glob
import sys
import sqlite3

os.environ['ERP_DB_ENGINE'] = 'sqlitecloud'
os.environ['SQLITE_CLOUD_URL'] = 'sqlitecloud://cjja8z6pvz.g4.sqlite.cloud:8860/flint-sync.sqlite?apikey=bmJZ0l1RTFCoxS0Au17c0iofzZmrDn2Db94v0YtV9Uw'

DB_URL = os.environ.get('SQLITE_CLOUD_URL')


def create_backup():
    """Create a backup as SQLite .db file."""
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = "backups"
    backup_file = os.path.join(backup_dir, f"erp_backup_{timestamp}.db")
    
    os.makedirs(backup_dir, exist_ok=True)
    
    print(f"🔄 Creating .db backup: {backup_file}")
    
    try:
        # Connect to cloud database
        cloud_conn = sqlitecloud.connect(DB_URL)
        
        # Create local SQLite database
        local_conn = sqlite3.connect(backup_file)
        
        # Get all tables from cloud
        tables = cloud_conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()
        
        if not tables:
            print("⚠️ No tables found in database")
            cloud_conn.close()
            local_conn.close()
            return None
        
        print(f"📊 Found {len(tables)} tables to backup")
        
        # Copy each table
        for table in tables:
            table_name = table[0]
            print(f"  📋 Copying: {table_name}")
            
            # Get schema
            schema = cloud_conn.execute(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table_name}'").fetchone()
            if schema:
                local_conn.execute(schema[0])
            
            # Get data
            rows = cloud_conn.execute(f"SELECT * FROM {table_name}").fetchall()
            if rows:
                columns = [desc[0] for desc in cloud_conn.execute(f"SELECT * FROM {table_name} LIMIT 1").description]
                placeholders = ','.join(['?' for _ in columns])
                columns_str = ','.join(columns)
                local_conn.executemany(
                    f"INSERT INTO {table_name} ({columns_str}) VALUES ({placeholders})",
                    rows
                )
        
        local_conn.commit()
        local_conn.close()
        cloud_conn.close()
        
        # Cleanup old backups (keep last 10)
        backup_files = sorted(
            glob.glob(os.path.join(backup_dir, "erp_backup_*.db")),
            key=os.path.getmtime,
            reverse=True
        )
        
        for old_file in backup_files[10:]:
            os.remove(old_file)
            print(f"  🗑️ Removed old backup: {os.path.basename(old_file)}")
        
        size = os.path.getsize(backup_file)
        print(f"\n✅ .db backup created: {backup_file}")
        print(f"📊 Size: {size / 1024:.2f} KB")
        return backup_file
        
    except Exception as e:
        print(f"❌ Backup failed: {e}")
        import traceback
        traceback.print_exc()
        return None


def restore_backup(backup_file):
    """Restore from a .db backup file."""
    if not os.path.exists(backup_file):
        print(f"❌ Backup file not found: {backup_file}")
        return False
    
    print(f"⚠️ RESTORE WARNING: This will replace your current database!")
    confirm = input("Are you sure you want to continue? (yes/no): ")
    
    if confirm.lower() != 'yes':
        print("❌ Restore cancelled.")
        return False
    
    try:
        # Create emergency backup first
        emergency_backup = create_backup()
        if emergency_backup:
            print(f"💾 Emergency backup created: {emergency_backup}")
        
        # Read from local .db file
        local_conn = sqlite3.connect(backup_file)
        local_conn.row_factory = sqlite3.Row
        
        # Get all tables from local backup
        tables = local_conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()
        
        # Connect to cloud
        cloud_conn = sqlitecloud.connect(DB_URL)
        
        # Clear existing data and restore
        for table in tables:
            table_name = table[0]
            print(f"  📋 Restoring: {table_name}")
            
            # Get data from local backup
            rows = local_conn.execute(f"SELECT * FROM {table_name}").fetchall()
            if rows:
                columns = [desc[0] for desc in local_conn.execute(f"SELECT * FROM {table_name} LIMIT 1").description]
                placeholders = ','.join(['?' for _ in columns])
                columns_str = ','.join(columns)
                
                # Clear existing data
                cloud_conn.execute(f"DELETE FROM {table_name}")
                
                # Insert data
                for row in rows:
                    cloud_conn.execute(
                        f"INSERT INTO {table_name} ({columns_str}) VALUES ({placeholders})",
                        tuple(row)
                    )
        
        local_conn.close()
        cloud_conn.close()
        
        print(f"✅ Database restored from: {backup_file}")
        return True
        
    except Exception as e:
        print(f"❌ Restore failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def list_backups():
    """List all available backups."""
    backup_files = sorted(
        glob.glob("backups/erp_backup_*.db"),
        key=os.path.getmtime,
        reverse=True
    )
    
    if not backup_files:
        print("📋 No backups found.")
        return []
    
    print("\n📋 AVAILABLE BACKUPS (.db files)")
    print("=" * 60)
    for i, file_path in enumerate(backup_files, 1):
        size = os.path.getsize(file_path)
        mtime = datetime.datetime.fromtimestamp(os.path.getmtime(file_path))
        print(f"  {i}. {os.path.basename(file_path)}")
        print(f"     📅 {mtime.strftime('%Y-%m-%d %H:%M:%S')} | 📊 {size / 1024:.2f} KB")
    print("=" * 60)
    
    return backup_files


def main():
    print("\n" + "=" * 50)
    print("💾 SQLITE CLOUD BACKUP MANAGER")
    print("=" * 50)
    print("1. Create Backup (.db file)")
    print("2. List Backups")
    print("3. Restore Backup")
    print("4. Exit")
    print("=" * 50)
    
    while True:
        choice = input("\nSelect option (1-4): ").strip()
        
        if choice == '1':
            create_backup()
        elif choice == '2':
            list_backups()
        elif choice == '3':
            backups = list_backups()
            if backups:
                try:
                    idx = int(input("\nSelect backup number to restore: ")) - 1
                    if 0 <= idx < len(backups):
                        restore_backup(backups[idx])
                    else:
                        print("❌ Invalid selection.")
                except ValueError:
                    print("❌ Please enter a valid number.")
        elif choice == '4':
            print("👋 Goodbye!")
            break
        else:
            print("❌ Invalid option. Please select 1-4.")


if __name__ == "__main__":
    main()