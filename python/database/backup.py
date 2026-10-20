"""Command line backup tool (cloud database -> local .db file)."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.auto_backup import auto_backup


def main():
    """Run backup from command line."""
    success = auto_backup()

    if success:
        print("\n" + "="*60)
        print("✅ Backup successful!")
        print("="*60)
    else:
        print("\n" + "="*60)
        print("❌ Backup failed")
        print("="*60)
        sys.exit(1)


if __name__ == "__main__":
    main()