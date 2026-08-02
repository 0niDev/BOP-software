"""Backup configuration."""
from __future__ import annotations

import os
from pathlib import Path


class BackupConfig:
    """Backup location configuration."""

    # Backup locations - Updated for your system
    DEFAULT_LOCATIONS = [
        "backups",                                    # Local folder
        os.path.expanduser("~/ERP_Backups"),          # User home folder
        "F:/ERP_Backups",                             # F: Drive
        "C:/ERP_Backups",                             # C: Drive
    ]

    MAX_BACKUPS_PER_LOCATION = 10
    AUTO_BACKUP_INTERVAL = 24

    @classmethod
    def get_valid_locations(cls) -> list[str]:
        """Get only valid (existing or creatable) locations."""
        valid = []
        for location in cls.DEFAULT_LOCATIONS:
            try:
                path = Path(location)
                path.mkdir(parents=True, exist_ok=True)
                valid.append(str(path))
            except Exception as e:
                print(f"[WARN] Skipping {location}: {e}")
                continue
        return valid

    @classmethod
    def get_location_status(cls) -> dict:
        """Get status of all configured locations."""
        status = {}
        for location in cls.DEFAULT_LOCATIONS:
            path = Path(location)
            status[location] = {
                "exists": path.exists(),
                "writable": os.access(str(path), os.W_OK) if path.exists() else False,
                "path": str(path)
            }
        return status