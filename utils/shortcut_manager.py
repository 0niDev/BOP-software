"""
Shortcut manager for BOP Pharmaceutical ERP.
Handles registration, customization, and persistence of keyboard shortcuts.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from functools import partial
from typing import Any, Callable, Optional

from PySide6.QtCore import Qt
from PySide6.QtGui import QKeySequence, QShortcut
from PySide6.QtWidgets import QWidget

from utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class ShortcutConfig:
    """Configuration for a single shortcut action."""
    action_id: str
    default_sequence: str
    current_sequence: str
    description: str
    context: str = "window"  # "window" or "widget"
    category: str = "General"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ShortcutConfig":
        return cls(**data)


# Default shortcut definitions
DEFAULT_SHORTCUTS: list[ShortcutConfig] = [
    # Navigation - Module jump (Ctrl+1..9, Ctrl+0)
    ShortcutConfig("module_jump_1", "Ctrl+1", "Ctrl+1", "Jump to module 1", "window", "Navigation"),
    ShortcutConfig("module_jump_2", "Ctrl+2", "Ctrl+2", "Jump to module 2", "window", "Navigation"),
    ShortcutConfig("module_jump_3", "Ctrl+3", "Ctrl+3", "Jump to module 3", "window", "Navigation"),
    ShortcutConfig("module_jump_4", "Ctrl+4", "Ctrl+4", "Jump to module 4", "window", "Navigation"),
    ShortcutConfig("module_jump_5", "Ctrl+5", "Ctrl+5", "Jump to module 5", "window", "Navigation"),
    ShortcutConfig("module_jump_6", "Ctrl+6", "Ctrl+6", "Jump to module 6", "window", "Navigation"),
    ShortcutConfig("module_jump_7", "Ctrl+7", "Ctrl+7", "Jump to module 7", "window", "Navigation"),
    ShortcutConfig("module_jump_8", "Ctrl+8", "Ctrl+8", "Jump to module 8", "window", "Navigation"),
    ShortcutConfig("module_jump_9", "Ctrl+9", "Ctrl+9", "Jump to module 9", "window", "Navigation"),
    ShortcutConfig("module_jump_0", "Ctrl+0", "Ctrl+0", "Jump to module 10", "window", "Navigation"),

    # Module navigation
    ShortcutConfig("module_next", "Ctrl+Tab", "Ctrl+Tab", "Next module", "window", "Navigation"),
    ShortcutConfig("module_prev", "Ctrl+Shift+Tab", "Ctrl+Shift+Tab", "Previous module", "window", "Navigation"),

    # Common actions
    ShortcutConfig("refresh", "Ctrl+R", "Ctrl+R", "Refresh current view", "window", "General"),
    ShortcutConfig("search", "Ctrl+F", "Ctrl+F", "Focus search", "window", "General"),
    ShortcutConfig("new_record", "Ctrl+N", "Ctrl+N", "Create new record", "window", "General"),
    ShortcutConfig("command_palette", "Ctrl+K", "Ctrl+K", "Open command palette", "window", "General"),

    # File/Window actions
    ShortcutConfig("close_tab", "Ctrl+W", "Ctrl+W", "Close current tab", "window", "Window"),
    ShortcutConfig("save", "Ctrl+S", "Ctrl+S", "Save current form", "widget", "General"),
    ShortcutConfig("cancel", "Escape", "Escape", "Cancel/Close dialog", "widget", "General"),

    # Edit actions
    ShortcutConfig("copy", "Ctrl+C", "Ctrl+C", "Copy", "widget", "Edit"),
    ShortcutConfig("paste", "Ctrl+V", "Ctrl+V", "Paste", "widget", "Edit"),
    ShortcutConfig("cut", "Ctrl+X", "Ctrl+X", "Cut", "widget", "Edit"),
    ShortcutConfig("undo", "Ctrl+Z", "Ctrl+Z", "Undo", "widget", "Edit"),
    ShortcutConfig("redo", "Ctrl+Y", "Ctrl+Y", "Redo", "widget", "Edit"),

    # View actions
    ShortcutConfig("toggle_sidebar", "Ctrl+B", "Ctrl+B", "Toggle sidebar", "window", "View"),
    ShortcutConfig("fullscreen", "F11", "F11", "Toggle fullscreen", "window", "View"),
]


class ShortcutManager:
    """Singleton manager for all application shortcuts."""

    _instance: "ShortcutManager | None" = None

    def __new__(cls) -> "ShortcutManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._shortcuts: dict[str, ShortcutConfig] = {s.action_id: s for s in DEFAULT_SHORTCUTS}
        self._registered: dict[str, QShortcut] = {}  # action_id -> QShortcut
        self._callbacks: dict[str, Callable] = {}  # action_id -> callback
        self._db = None

    def set_database(self, db) -> None:
        """Set database connection for persistence."""
        self._db = db

    def register_shortcut(
        self,
        parent: QWidget,
        action_id: str,
        callback: Callable,
        context: Qt.ShortcutContext = Qt.WindowShortcut,
    ) -> Optional[QShortcut]:
        """Register a shortcut with the given callback."""
        if action_id not in self._shortcuts:
            logger.warning(f"Unknown shortcut action: {action_id}")
            return None

        config = self._shortcuts[action_id]
        sequence = QKeySequence(config.current_sequence)
        shortcut = QShortcut(sequence, parent, callback, context)
        self._registered[action_id] = shortcut
        self._callbacks[action_id] = callback
        logger.debug(f"Registered shortcut: {action_id} = {config.current_sequence}")
        return shortcut

    def register_multiple_shortcuts(
        self,
        parent: QWidget,
        action_ids: list[str],
        callback_factory: Callable[[str], Callable],
        context: Qt.ShortcutContext = Qt.WindowShortcut,
    ) -> list[QShortcut]:
        """Register multiple shortcuts using a callback factory."""
        shortcuts = []
        for action_id in action_ids:
            if action_id in self._shortcuts:
                callback = callback_factory(action_id)
                shortcut = self.register_shortcut(parent, action_id, callback, context)
                if shortcut:
                    shortcuts.append(shortcut)
        return shortcuts

    def get_shortcut(self, action_id: str) -> Optional[ShortcutConfig]:
        return self._shortcuts.get(action_id)

    def get_all_shortcuts(self) -> list[ShortcutConfig]:
        return list(self._shortcuts.values())

    def get_shortcuts_by_category(self, category: str) -> list[ShortcutConfig]:
        return [s for s in self._shortcuts.values() if s.category == category]

    def get_categories(self) -> list[str]:
        cats = set(s.category for s in self._shortcuts.values())
        return sorted(cats)

    def update_shortcut(self, action_id: str, new_sequence: str) -> bool:
        """Update a shortcut's key sequence."""
        if action_id not in self._shortcuts:
            return False

        # Validate the sequence
        seq = QKeySequence(new_sequence)
        if seq.isEmpty() and new_sequence:
            logger.warning(f"Invalid key sequence: {new_sequence}")
            return False

        old_sequence = self._shortcuts[action_id].current_sequence
        self._shortcuts[action_id].current_sequence = new_sequence

        # Update registered shortcut
        if action_id in self._registered:
            self._registered[action_id].setKey(seq)

        self._persist_shortcut(action_id)
        logger.info(f"Updated shortcut {action_id}: {old_sequence} -> {new_sequence}")
        return True

    def reset_shortcut(self, action_id: str) -> bool:
        """Reset a shortcut to its default."""
        if action_id not in self._shortcuts:
            return False

        default = self._shortcuts[action_id].default_sequence
        return self.update_shortcut(action_id, default)

    def reset_all_shortcuts(self) -> None:
        """Reset all shortcuts to defaults."""
        for action_id in self._shortcuts:
            self._shortcuts[action_id].current_sequence = self._shortcuts[action_id].default_sequence
            if action_id in self._registered:
                self._registered[action_id].setKey(QKeySequence(self._shortcuts[action_id].default_sequence))
        self._persist_all_shortcuts()
        logger.info("All shortcuts reset to defaults")

    def _persist_shortcut(self, action_id: str) -> None:
        """Save a single shortcut to database."""
        if not self._db:
            return
        try:
            from utils.helpers import get_current_company_id
            company_id = get_current_company_id(self._db) or 1

            config = self._shortcuts[action_id]
            self._db.execute(
                """
                INSERT INTO settings (company_id, setting_key, setting_value, setting_group)
                VALUES (?, ?, ?, 'SHORTCUTS')
                ON CONFLICT(company_id, setting_key) DO UPDATE SET
                    setting_value = excluded.setting_value
                """,
                (company_id, f"shortcut:{action_id}", json.dumps(config.to_dict())),
            )
        except Exception as e:
            logger.warning(f"Failed to persist shortcut {action_id}: {e}")

    def _persist_all_shortcuts(self) -> None:
        """Save all shortcuts to database."""
        for action_id in self._shortcuts:
            self._persist_shortcut(action_id)

    def load_from_db(self, db) -> None:
        """Load shortcut customizations from database."""
        self._db = db
        try:
            from utils.helpers import get_current_company_id
            company_id = get_current_company_id(db) or 1

            rows = db.fetch_all(
                "SELECT setting_key, setting_value FROM settings WHERE company_id = ? AND setting_group = 'SHORTCUTS'",
                (company_id,),
            )

            for row in rows:
                key = row["setting_key"]
                if key.startswith("shortcut:"):
                    action_id = key[9:]  # Remove "shortcut:" prefix
                    if action_id in self._shortcuts:
                        try:
                            data = json.loads(row["setting_value"])
                            config = ShortcutConfig.from_dict(data)
                            self._shortcuts[action_id] = config
                        except (json.JSONDecodeError, TypeError) as e:
                            logger.warning(f"Failed to load shortcut {action_id}: {e}")

            logger.info(f"Loaded {len(rows)} shortcut customizations")
        except Exception as e:
            logger.warning(f"Failed to load shortcuts from DB: {e}")

    def get_sequence_string(self, action_id: str) -> str:
        """Get the current key sequence as a string for display."""
        return self._shortcuts.get(action_id, ShortcutConfig("", "", "", "")).current_sequence


def get_shortcut_manager() -> ShortcutManager:
    """Get the singleton ShortcutManager instance."""
    return ShortcutManager()