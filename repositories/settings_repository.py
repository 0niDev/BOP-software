"""
Repository for application settings.
Handles CRUD operations on the settings table.
"""
from __future__ import annotations

import json
from typing import Any, Optional

from repositories.base_repository import BaseRepository
from utils.logger import get_logger

logger = get_logger(__name__)

_JSON_PREFIX = "json:"


def _encode_value(value: Any) -> Any:
    """sqlite3 can only bind primitives; serialize dict/list as tagged JSON."""
    if isinstance(value, (dict, list)):
        return _JSON_PREFIX + json.dumps(value, ensure_ascii=False)
    return value


def _decode_value(raw: Any) -> Any:
    if isinstance(raw, str) and raw.startswith(_JSON_PREFIX):
        try:
            return json.loads(raw[len(_JSON_PREFIX):])
        except ValueError:
            return raw
    return raw


class SettingsRepository(BaseRepository):
    table_name = "settings"

    def __init__(self, db):
        super().__init__(db)

    def get_setting(self, company_id: int, key: str, group: str = "GENERAL") -> Optional[Any]:
        """Get a single setting value."""
        row = self.db.fetch_one(
            """
            SELECT setting_value FROM settings
            WHERE company_id = ? AND setting_key = ? AND setting_group = ?
            """,
            (company_id, key, group),
        )
        return _decode_value(row["setting_value"]) if row else None

    def get_settings_by_group(self, company_id: int, group: str) -> dict[str, Any]:
        """Get all settings for a group as a dict."""
        rows = self.db.fetch_all(
            """
            SELECT setting_key, setting_value FROM settings
            WHERE company_id = ? AND setting_group = ?
            """,
            (company_id, group),
        )
        return {row["setting_key"]: _decode_value(row["setting_value"]) for row in rows}

    def get_all_settings(self, company_id: int) -> dict[str, dict[str, Any]]:
        """Get all settings grouped by group."""
        rows = self.db.fetch_all(
            """
            SELECT setting_group, setting_key, setting_value FROM settings
            WHERE company_id = ?
            """,
            (company_id,),
        )
        result = {}
        for row in rows:
            group = row["setting_group"]
            if group not in result:
                result[group] = {}
            result[group][row["setting_key"]] = _decode_value(row["setting_value"])
        return result

    def set_setting(self, company_id: int, key: str, value: Any, group: str = "GENERAL") -> None:
        """Set a setting value (upsert). dict/list are JSON-serialized."""
        self.db.execute(
            """
            INSERT INTO settings (company_id, setting_key, setting_value, setting_group)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(company_id, setting_key) DO UPDATE SET
                setting_value = excluded.setting_value,
                setting_group = excluded.setting_group
            """,
            (company_id, key, _encode_value(value), group),
        )

    def delete_setting(self, company_id: int, key: str, group: str = "GENERAL") -> bool:
        """Delete a setting."""
        result = self.db.execute(
            """
            DELETE FROM settings
            WHERE company_id = ? AND setting_key = ? AND setting_group = ?
            """,
            (company_id, key, group),
        )
        return result > 0

    def delete_group(self, company_id: int, group: str) -> int:
        """Delete all settings in a group."""
        return self.db.execute(
            "DELETE FROM settings WHERE company_id = ? AND setting_group = ?",
            (company_id, group),
        )

    def bulk_upsert(self, company_id: int, settings: dict[str, dict[str, Any]]) -> None:
        """Bulk insert/update settings by group."""
        for group, group_settings in settings.items():
            for key, value in group_settings.items():
                self.set_setting(company_id, key, value, group)