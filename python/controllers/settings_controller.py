"""
Controller for Settings screen.
Translates service data to UI models and handles user actions.
"""
from __future__ import annotations

from typing import Any, Optional

from services.settings_service import SettingsService
from utils.exceptions import ERPException


class SettingsController:
    def __init__(self, settings_service: SettingsService):
        self.service = settings_service

    # --- General ---

    def get_all_settings(self, company_id: int) -> dict[str, dict[str, Any]]:
        return self.service.get_all_settings(company_id)

    def get_settings_group(self, company_id: int, group: str) -> dict[str, Any]:
        return self.service.get_settings_group(company_id, group)

    # --- Appearance ---

    def get_theme_name(self, company_id: int) -> str:
        return self.service.get_theme_name(company_id)

    def set_theme_name(self, company_id: int, theme_name: str) -> tuple[bool, Optional[str]]:
        try:
            self.service.set_theme_name(company_id, theme_name)
            return True, None
        except ERPException as e:
            return False, str(e)
        except Exception:
            return False, "Failed to change theme"

    def get_custom_theme(self, company_id: int) -> Optional[dict]:
        return self.service.get_custom_theme(company_id)

    def set_custom_theme(self, company_id: int, theme_data: dict) -> tuple[bool, Optional[str]]:
        try:
            self.service.set_custom_theme(company_id, theme_data)
            return True, None
        except Exception:
            return False, "Failed to save custom theme"

    def update_theme_color(self, company_id: int, token: str, value: str) -> tuple[bool, Optional[str]]:
        """Update a single theme color token."""
        try:
            custom = self.service.get_custom_theme(company_id) or {}
            custom[token] = value
            self.service.set_custom_theme(company_id, custom)
            return True, None
        except Exception:
            return False, "Failed to update color"

    def reset_appearance(self, company_id: int) -> tuple[bool, Optional[str]]:
        try:
            self.service.reset_appearance(company_id)
            return True, None
        except Exception:
            return False, "Failed to reset appearance"

    # --- Shortcuts ---

    def get_shortcut(self, company_id: int, action_id: str) -> Optional[dict]:
        return self.service.get_shortcut(company_id, action_id)

    def get_all_shortcuts(self, company_id: int) -> dict[str, dict]:
        return self.service.get_all_shortcuts(company_id)

    def get_shortcuts_by_category(self, company_id: int) -> dict[str, list[dict]]:
        """Get shortcuts grouped by category."""
        from utils.shortcut_manager import DEFAULT_SHORTCUTS

        shortcuts = self.service.get_all_shortcuts(company_id)
        result = {}
        for sc in DEFAULT_SHORTCUTS:
            action_id = sc.action_id
            config = shortcuts.get(action_id, sc.to_dict())
            cat = sc.category
            if cat not in result:
                result[cat] = []
            result[cat].append(config)
        return result

    def update_shortcut(
        self, company_id: int, action_id: str, new_sequence: str
    ) -> tuple[bool, Optional[str]]:
        """Update a shortcut's key sequence."""
        try:
            self.service.set_shortcut(company_id, action_id, {"action_id": action_id, "current_sequence": new_sequence})
            return True, None
        except Exception:
            return False, "Failed to update shortcut"

    def reset_shortcut(self, company_id: int, action_id: str) -> tuple[bool, Optional[str]]:
        """Reset a shortcut to default."""
        from utils.shortcut_manager import DEFAULT_SHORTCUTS

        try:
            default = next((sc for sc in DEFAULT_SHORTCUTS if sc.action_id == action_id), None)
            if default:
                self.service.set_shortcut(company_id, action_id, default.to_dict())
            return True, None
        except Exception:
            return False, "Failed to reset shortcut"

    def reset_all_shortcuts(self, company_id: int) -> tuple[bool, Optional[str]]:
        try:
            self.service.reset_shortcuts(company_id)
            return True, None
        except Exception:
            return False, "Failed to reset shortcuts"