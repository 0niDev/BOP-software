"""Command line backup tool."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.backup_service import BackupService


def main():
    """Run backup from command line."""
    service = BackupService()
    results = service.backup_all()
    
    success_count = sum(1 for v in results.values() if v)
    total_count = len(results)
    
    print("\n" + "="*60)
    if success_count == total_count:
        print(f"✅ All {total_count} backups successful!")
    else:
        print(f"⚠️ {success_count}/{total_count} backups successful")
    print("="*60)


if __name__ == "__main__":
    main()