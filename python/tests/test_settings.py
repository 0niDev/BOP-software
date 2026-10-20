"""Tests for SettingsRepository / SettingsService / SettingsController."""
from __future__ import annotations

import json

import pytest

from repositories.settings_repository import SettingsRepository
from services.settings_service import SettingsService
from utils.exceptions import ValidationError


@pytest.fixture()
def repo(qa_db):
    return SettingsRepository(qa_db)


@pytest.fixture()
def service(repo):
    return SettingsService(repo)


class TestSettingsRepository:
    def test_set_and_get(self, qa_db, repo):
        repo.set_setting(1, "key1", "value1", "GENERAL")
        assert repo.get_setting(1, "key1", "GENERAL") == "value1"
        assert repo.get_setting(1, "missing") is None

    def test_get_settings_by_group(self, qa_db, repo):
        repo.set_setting(1, "a", "1", "G")
        repo.set_setting(1, "b", "2", "G")
        repo.set_setting(1, "c", "3", "OTHER")
        group = repo.get_settings_by_group(1, "G")
        assert group == {"a": "1", "b": "2"}

    def test_get_all_settings(self, qa_db, repo):
        repo.set_setting(1, "a", 1, "G")
        all_s = repo.get_all_settings(1)
        assert "G" in all_s

    def test_delete_setting(self, qa_db, repo):
        repo.set_setting(1, "k", "v", "G")
        assert repo.delete_setting(1, "k", "G") is True
        assert repo.delete_setting(1, "ghost", "G") is False

    def test_delete_group(self, qa_db, repo):
        repo.set_setting(1, "a", 1, "GROUPX")
        repo.set_setting(1, "b", 2, "GROUPX")
        assert repo.delete_group(1, "GROUPX") == 2


class TestSettingsService:
    def test_set_get_roundtrip(self, service):
        service.set_setting(1, "key", "plain-string-value", "GENERAL")
        assert service.get_setting(1, "key", "GENERAL") == "plain-string-value"

    def test_set_settings_group(self, service):
        service.set_settings_group(1, "G", {"x": "1", "y": "2"})
        assert service.get_settings_group(1, "G") == {"x": "1", "y": "2"}

    def test_reset_group(self, service):
        service.set_setting(1, "a", 1, "G")
        assert service.reset_group(1, "G") == 1

    def test_theme_roundtrip(self, service):
        service.set_theme_name(1, "light")
        assert service.get_theme_name(1) == "light"

    def test_theme_defaults_to_dark(self, service):
        assert service.get_theme_name(1) == "dark"

    def test_set_invalid_theme_raises(self, service):
        with pytest.raises(ValidationError):
            service.set_theme_name(1, "neon")

    def test_custom_theme_roundtrip(self, service):
        service.set_custom_theme(1, {"bg": "#000"})
        assert service.get_custom_theme(1) == {"bg": "#000"}

    def test_custom_theme_bad_json_returns_none(self, repo):
        repo.set_setting(1, "custom_theme", "not-json", "APPEARANCE")
        service = SettingsService(repo)
        assert service.get_custom_theme(1) is None

    def test_shortcut_roundtrip(self, service):
        cfg = {"action_id": "save", "default_sequence": "Ctrl+S", "current_sequence": "Ctrl+S"}
        service.set_shortcut(1, "save", cfg)
        assert service.get_shortcut(1, "save") == cfg

    def test_get_all_shortcuts(self, service):
        service.set_shortcut(1, "save", {"seq": "S"})
        service.set_shortcut(1, "open", {"seq": "O"})
        service.set_setting(1, "not_shortcut", "1", "SHORTCUTS")
        shortcuts = service.get_all_shortcuts(1)
        # Migrations pre-seed many defaults; ours must be included and the
        # non-shortcut key must NOT be surfaced as an action.
        assert {"save", "open"} <= set(shortcuts.keys())
        assert "not_shortcut" not in shortcuts

    def test_reset_shortcuts(self, service):
        service.set_shortcut(1, "save", {"seq": "S"})
        assert service.reset_shortcuts(1) >= 1
        assert service.get_all_shortcuts(1) == {}


class TestSettingsController:
    def test_controller_roundtrip(self, qa_db):
        from controllers.settings_controller import SettingsController
        from repositories.settings_repository import SettingsRepository
        from services.settings_service import SettingsService
        ctrl = SettingsController(SettingsService(SettingsRepository(qa_db)))
        ok, err = ctrl.set_theme_name(1, "light")
        assert ok is True and err is None
        assert ctrl.get_theme_name(1) == "light"

    def test_controller_invalid_theme(self, qa_db):
        from controllers.settings_controller import SettingsController
        from repositories.settings_repository import SettingsRepository
        from services.settings_service import SettingsService
        ctrl = SettingsController(SettingsService(SettingsRepository(qa_db)))
        ok, err = ctrl.set_theme_name(1, "neon")
        assert ok is False and err is not None