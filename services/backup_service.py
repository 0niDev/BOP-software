"""Backup service - automatic and manual backups to multiple locations."""
from __future__ import annotations

import os
import shutil
import datetime
import zipfile
from pathlib import Path
from typing import List, Dict

from config.backup_config import BackupConfig
from utils.logger import get_logger

logger = get_logger(__name__)


class BackupService:
    """Service for backing up database to multiple locations."""

    def __init__(self, custom_locations: List[str] = None):
        self.locations = custom_locations or BackupConfig.get_valid_locations()
        self.max_backups = BackupConfig.MAX_BACKUPS_PER_LOCATION
        self.db_path = "data/erp.db"
        self.timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

    def backup_all(self) -> Dict[str, bool]:
        """Backup to all configured locations."""
        results = {}
        
        print("\n" + "="*60)
        print("💾 BACKING UP DATABASE")
        print("="*60)
        print(f"📁 Database: {self.db_path}")
        print(f"🕐 Timestamp: {self.timestamp}")
        print("-"*60)

        for location in self.locations:
            result = self.backup_to_location(location)
            results[location] = result

        print("-"*60)
        print("📊 BACKUP SUMMARY")
        print("-"*60)
        
        success_count = sum(1 for v in results.values() if v)
        total_count = len(results)
        
        for location, success in results.items():
            status = "[OK]" if success else "[ERROR]"
            short_name = location.replace(os.path.expanduser("~"), "~")
            print(f"  {status} {short_name}")

        print("-"*60)
        print(f"  [OK] {success_count}/{total_count} backups successful")
        print("="*60)

        return results

    def backup_local(self) -> bool:
        """Create backup in local backups folder."""
        try:
            backup_dir = Path("backups")
            backup_dir.mkdir(exist_ok=True)

            backup_name = f"erp_backup_{self.timestamp}.db"
            backup_path = backup_dir / backup_name

            shutil.copy2(self.db_path, backup_path)
            self._cleanup_old_backups(backup_dir, keep=self.max_backups)
            
            print(f"  [OK] Local: backups/{backup_name}")
            return True

        except Exception as e:
            print(f"  [ERROR] Local backup failed: {e}")
            logger.error(f"Local backup failed: {e}")
            return False

    def backup_to_location(self, location: str) -> bool:
        """Backup to a specific location."""
        try:
            location_path = Path(location)
            
            # Skip if path doesn't exist (like a drive that's not connected)
            if not location_path.exists():
                print(f"  [WARN] Skipping {location}: Path does not exist")
                return False
                
            location_path.mkdir(parents=True, exist_ok=True)

            backup_name = f"erp_backup_{self.timestamp}.db"
            backup_path = location_path / backup_name

            shutil.copy2(self.db_path, backup_path)
            self._cleanup_old_backups(location_path, keep=self.max_backups)

            print(f"  [OK] {location}: {backup_name}")
            return True

        except Exception as e:
            print(f"  [ERROR] {location} backup failed: {e}")
            logger.error(f"Backup to {location} failed: {e}")
            return False

    def backup_to_zip(self) -> bool:
        """Create a zip backup with timestamp."""
        try:
            zip_dir = Path("backups/zip")
            zip_dir.mkdir(parents=True, exist_ok=True)

            zip_name = f"erp_backup_{self.timestamp}.zip"
            zip_path = zip_dir / zip_name

            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                zipf.write(self.db_path, "erp.db")

            print(f"  [OK] Zip backup: {zip_path}")
            return True

        except Exception as e:
            print(f"  [ERROR] Zip backup failed: {e}")
            return False

    def _cleanup_old_backups(self, directory: Path, keep: int = 10):
        """Delete old backups, keeping only the most recent ones."""
        try:
            if not directory.exists():
                return
                
            backups = sorted(
                [f for f in directory.glob("erp_backup_*.db")],
                key=lambda x: x.stat().st_mtime,
                reverse=True
            )

            for old_backup in backups[keep:]:
                old_backup.unlink()
                logger.info(f"Removed old backup: {old_backup}")

        except Exception as e:
            logger.warning(f"Cleanup failed: {e}")

    def check_backup_health(self) -> Dict[str, dict]:
        """Check if backups exist and are valid."""
        results = {}
        
        for location in self.locations:
            location_path = Path(location)
            if location_path.exists():
                backups = list(location_path.glob("erp_backup_*.db"))
                results[location] = {
                    "exists": True,
                    "count": len(backups),
                    "latest": max(backups, key=lambda x: x.stat().st_mtime).name if backups else None
                }
            else:
                results[location] = {"exists": False, "count": 0, "latest": None}

        return results

    def restore_backup(self, backup_path: str) -> bool:
        """Restore from a backup file."""
        try:
            if not os.path.exists(backup_path):
                print(f"[ERROR] Backup file not found: {backup_path}")
                return False

            # Create backup of current database first
            if os.path.exists(self.db_path):
                shutil.copy2(self.db_path, f"{self.db_path}.pre_restore")
                print(f"[OK] Current database backed up to {self.db_path}.pre_restore")

            shutil.copy2(backup_path, self.db_path)
            print(f"[OK] Restored from: {backup_path}")
            return True

        except Exception as e:
            print(f"[ERROR] Restore failed: {e}")
            return False