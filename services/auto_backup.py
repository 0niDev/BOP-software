"""Automatic backup scheduler."""
from __future__ import annotations

import threading
import time
import datetime
from pathlib import Path

from services.backup_service import BackupService
from utils.logger import get_logger

logger = get_logger(__name__)


class AutoBackup:
    """Automatic backup scheduler running in background."""

    def __init__(self, interval_hours: int = 24):
        self.interval_hours = interval_hours
        self.service = BackupService()
        self.running = False
        self.thread = None

    def start(self):
        """Start the auto-backup thread."""
        if self.running:
            return

        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()
        logger.info(f"Auto-backup started (interval: {self.interval_hours} hours)")

    def stop(self):
        """Stop the auto-backup thread."""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        logger.info("Auto-backup stopped")

    def _run(self):
        """Run the backup loop."""
        while self.running:
            try:
                # Wait for interval
                time.sleep(self.interval_hours * 3600)

                # Perform backup
                logger.info("Auto-backup triggered...")
                results = self.service.backup_all()

                success_count = sum(1 for v in results.values() if v)
                total_count = len(results)

                if success_count == total_count:
                    logger.info(f"Auto-backup complete: {success_count}/{total_count} locations")
                else:
                    logger.warning(f"Auto-backup partial: {success_count}/{total_count} locations")

            except Exception as e:
                logger.exception(f"Auto-backup error: {e}")


# Singleton instance
_auto_backup: AutoBackup | None = None


def start_auto_backup(interval_hours: int = 24):
    """Start the auto-backup service."""
    global _auto_backup
    if _auto_backup is None:
        _auto_backup = AutoBackup(interval_hours)
    _auto_backup.start()


def stop_auto_backup():
    """Stop the auto-backup service."""
    global _auto_backup
    if _auto_backup:
        _auto_backup.stop()
        _auto_backup = None 