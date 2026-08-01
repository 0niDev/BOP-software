"""Controller for backup operations."""
from __future__ import annotations

from services.backup_service import BackupService
from utils.exceptions import ERPException
from utils.logger import get_logger

logger = get_logger(__name__)


class BackupController:
    """Controller for backup operations."""

    def __init__(self, backup_service: BackupService | None = None):
        self.service = backup_service or BackupService()

    def backup_all(self) -> tuple[dict | None, str | None]:
        """Backup to all configured locations."""
        try:
            results = self.service.backup_all()
            return results, None
        except ERPException as exc:
            return None, str(exc)
        except Exception as e:
            logger.exception(f"Backup failed: {e}")
            return None, "An unexpected error occurred during backup."

    def backup_local(self) -> tuple[bool, str | None]:
        """Backup to local folder only."""
        try:
            result = self.service.backup_local()
            return result, None
        except Exception as e:
            return False, str(e)

    def get_backup_status(self) -> tuple[dict | None, str | None]:
        """Get backup health status."""
        try:
            status = self.service.check_backup_health()
            return status, None
        except Exception as e:
            return None, str(e)

    def restore_backup(self, file_path: str) -> tuple[bool, str | None]:
        """Restore from backup."""
        try:
            result = self.service.restore_backup(file_path)
            return result, None
        except Exception as e:
            return False, str(e)