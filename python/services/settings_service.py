"""
Service for application settings.
Business logic layer for settings management.
"""
from __future__ import annotations

import json
from typing import Any, Optional

from repositories.settings_repository import SettingsRepository
from utils.exceptions import ValidationError
from utils.logger import get_logger

logger = get_logger(__name__)


class SettingsService:
    def __init__(self, repo: SettingsRepository):
        self.repo = repo

    def get_setting(self, company_id: int, key: str, group: str = "GENERAL") -> Optional[Any]:
        return self.repo.get_setting(company_id, key, group)

    def get_settings_group(self, company_id: int, group: str) -> dict[str, Any]:
        return self.repo.get_settings_by_group(company_id, group)

    def get_all_settings(self, company_id: int) -> dict[str, dict[str, Any]]:
        return self.repo.get_all_settings(company_id)

    def set_setting(self, company_id: int, key: str, value: Any, group: str = "GENERAL") -> None:
        self.repo.set_setting(company_id, key, value, group)
        logger.debug(f"Setting updated: {group}.{key} = {value}")

    def set_settings_group(self, company_id: int, group: str, settings: dict[str, Any]) -> None:
        """Set multiple settings in a group."""
        for key, value in settings.items():
            self.repo.set_setting(company_id, key, value, group)
        logger.info(f"Settings group updated: {group} ({len(settings)} keys)")

    def delete_setting(self, company_id: int, key: str, group: str = "GENERAL") -> bool:
        return self.repo.delete_setting(company_id, key, group)

    def reset_group(self, company_id: int, group: str) -> int:
        """Delete all settings in a group."""
        return self.repo.delete_group(company_id, group)

    # --- Appearance-specific helpers ---

    def get_theme_name(self, company_id: int) -> str:
        """Get current theme name."""
        value = self.get_setting(company_id, "theme_name", "APPEARANCE")
        return value if value in ("dark", "light", "system", "custom") else "dark"

    def set_theme_name(self, company_id: int, theme_name: str) -> None:
        """Set theme name."""
        if theme_name not in ("dark", "light", "system", "custom"):
            raise ValidationError(f"Invalid theme: {theme_name}")
        self.set_setting(company_id, "theme_name", theme_name, "APPEARANCE")

    def get_custom_theme(self, company_id: int) -> Optional[dict]:
        """Get custom theme JSON."""
        value = self.get_setting(company_id, "custom_theme", "APPEARANCE")
        if value:
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return None
        return None

    def set_custom_theme(self, company_id: int, theme_data: dict) -> None:
        """Save custom theme as JSON."""
        self.set_setting(company_id, "custom_theme", json.dumps(theme_data), "APPEARANCE")

    def get_shortcut(self, company_id: int, action_id: str) -> Optional[dict]:
        """Get shortcut configuration."""
        value = self.get_setting(company_id, f"shortcut:{action_id}", "SHORTCUTS")
        if value:
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return None
        return None

    def set_shortcut(self, company_id: int, action_id: str, config: dict) -> None:
        """Save shortcut configuration."""
        self.set_setting(company_id, f"shortcut:{action_id}", json.dumps(config), "SHORTCUTS")

    def get_all_shortcuts(self, company_id: int) -> dict[str, dict]:
        """Get all shortcut customizations."""
        group = self.get_settings_group(company_id, "SHORTCUTS")
        result = {}
        for key, value in group.items():
            if key.startswith("shortcut:"):
                action_id = key[9:]
                try:
                    result[action_id] = json.loads(value)
                except json.JSONDecodeError:
                    pass
        return result

    def reset_shortcuts(self, company_id: int) -> int:
        """Reset all shortcuts to defaults."""
        return self.repo.delete_group(company_id, "SHORTCUTS")

    def reset_appearance(self, company_id: int) -> int:
        """Reset all appearance settings."""
        return self.repo.delete_group(company_id, "APPEARANCE")