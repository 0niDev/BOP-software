"""Command line restore tool."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.backup_service import BackupService


def main():
    """Restore from backup."""
    print("\n" + "="*60)
    print("[R] RESTORE FROM BACKUP")
    print("="*60)
    
    # List available backups
    import glob
    backup_files = glob.glob("backups/erp_backup_*.db")
    
    if not backup_files:
        print("[ERROR] No backups found in 'backups' folder")
        return
    
    print("\n📋 Available backups:")
    for i, f in enumerate(backup_files, 1):
        print(f"  {i}. {f}")
    
    try:
        choice = int(input("\nSelect backup number (0 to cancel): "))
        if choice == 0:
            print("Cancelled")
            return
        
        if 1 <= choice <= len(backup_files):
            backup_path = backup_files[choice - 1]
            service = BackupService()
            
            confirm = input(f"[WARN] Restore from {backup_path}? (yes/no): ")
            if confirm.lower() == "yes":
                success = service.restore_backup(backup_path)
                if success:
                    print("[OK] Database restored successfully!")
                else:
                    print("[ERROR] Restore failed!")
        else:
            print("[ERROR] Invalid selection")
    except ValueError:
        print("[ERROR] Invalid input")
    
    print("="*60)


if __name__ == "__main__":
    main()