"""Command line restore tool (local .db backup -> cloud database)."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.backup_manager import list_backups, restore_backup


def main():
    """Restore from backup."""
    print("\n" + "="*60)
    print("🔄 RESTORE FROM BACKUP")
    print("="*60)

    backups = list_backups()

    if not backups:
        print("❌ No backups found in 'backups' folder")
        return

    try:
        choice = int(input("\nSelect backup number (0 to cancel): "))
        if choice == 0:
            print("Cancelled")
            return

        if 1 <= choice <= len(backups):
            backup_path = backups[choice - 1]
            confirm = input(f"⚠️ Restore from {backup_path}? (yes/no): ")
            if confirm.lower() == "yes":
                success = restore_backup(backup_path)
                if success:
                    print("✅ Database restored successfully!")
                else:
                    print("❌ Restore failed!")
        else:
            print("❌ Invalid selection")
    except ValueError:
        print("❌ Invalid input")

    print("="*60)


if __name__ == "__main__":
    main()