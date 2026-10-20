"""Controller for backup operations (cloud database -> local .db files)."""
from __future__ import annotations

import datetime
import glob
import os
from pathlib import Path

from utils.logger import get_logger

logger = get_logger(__name__)

BACKUP_DIR = Path("backups")


class BackupController:
    """Controller for backup operations against the cloud database."""

    def backup_all(self) -> tuple[dict | None, str | None]:
        """Create a cloud database backup (.db file) in the local backups folder."""
        try:
            from database.auto_backup import auto_backup
            success = auto_backup()
            return {str(BACKUP_DIR): bool(success)}, None
        except Exception as e:
            logger.exception(f"Backup failed: {e}")
            return None, "An unexpected error occurred during backup."

    def backup_local(self) -> tuple[bool, str | None]:
        """Backup to local backups folder only."""
        try:
            from database.auto_backup import auto_backup
            return auto_backup(), None
        except Exception as e:
            logger.exception(f"Local backup failed: {e}")
            return False, str(e)

    def get_backup_status(self) -> tuple[dict | None, str | None]:
        """Get backup health status from the local backups folder."""
        try:
            BACKUP_DIR.mkdir(parents=True, exist_ok=True)
            backups = sorted(
                glob.glob(os.path.join(str(BACKUP_DIR), "erp_backup_*.db")),
                key=os.path.getmtime,
                reverse=True,
            )

            count = len(backups)
            latest = os.path.basename(backups[0]) if backups else None
            status = {
                str(BACKUP_DIR): {
                    "exists": True,
                    "count": count,
                    "latest": latest,
                }
            }
            return status, None
        except Exception as e:
            return None, str(e)

    def restore_backup(self, file_path: str) -> tuple[bool, str | None]:
        """Restore the cloud database from a local .db backup file."""
        try:
            from database.backup_manager import restore_backup
            result = restore_backup(file_path)
            return bool(result), None
        except Exception as e:
            return False, str(e)