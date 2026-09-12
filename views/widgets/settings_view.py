"""Settings widget with Appearance tab for theme and shortcut customization."""
from __future__ import annotations

import json
from typing import Any

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QColor, QKeySequence
from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDialog,
    QFormLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QScrollArea,
    QTableWidget,
    QTableWidgetItem,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

from config.app_config import get_config
from controllers.settings_controller import SettingsController
from utils.helpers import get_current_company_id
from utils.logger import get_logger
from utils.shortcut_manager import DEFAULT_SHORTCUTS, ShortcutManager, get_shortcut_manager
from utils.theme import get_theme_manager, Theme

logger = get_logger(__name__)


class ColorPickerButton(QPushButton):
    """Button that shows a color and opens QColorDialog on click."""

    color_changed = Signal(str)

    def __init__(self, color_hex: str, parent=None):
        super().__init__(parent)
        self._color = color_hex
        self.setFixedSize(40, 28)
        self.clicked.connect(self._pick_color)
        self._update_style()

    def _update_style(self) -> None:
        self.setStyleSheet(
            f"""
            QPushButton {{
                background: {self._color};
                border: 1px solid #3a3a3a;
                border-radius: 4px;
            }}
            QPushButton:hover {{
                border: 2px solid #A83248;
            }}
        """
        )

    def _pick_color(self) -> None:
        from PySide6.QtWidgets import QColorDialog

        initial = QColor(self._color)
        color = QColorDialog.getColor(initial, self, "Select Color")
        if color.isValid():
            hex_color = color.name()
            self._color = hex_color
            self._update_style()
            self.color_changed.emit(hex_color)

    def get_color(self) -> str:
        return self._color

    def set_color(self, color_hex: str) -> None:
        self._color = color_hex
        self._update_style()


class ShortcutEditDialog(QDialog):
    """Dialog for editing a keyboard shortcut."""

    def __init__(self, action_id: str, current_sequence: str, description: str, parent=None):
        super().__init__(parent)
        self.action_id = action_id
        self.setWindowTitle(f"Edit Shortcut: {description}")
        self.setModal(True)
        self.resize(350, 160)
        self._build_ui(current_sequence, description)

    def _build_ui(self, current: str, desc: str) -> None:
        layout = QVBoxLayout(self)

        info = QLabel(f"<b>{desc}</b><br>Current: <code>{current}</code>")
        info.setWordWrap(True)
        layout.addWidget(info)

        self.key_input = QLineEdit()
        self.key_input.setPlaceholderText("Press key combination...")
        self.key_input.setReadOnly(True)
        self.key_input.setText(current)
        self.key_input.installEventFilter(self)
        layout.addWidget(self.key_input)

        btn_layout = QHBoxLayout()
        self.ok_btn = QPushButton("OK")
        self.ok_btn.clicked.connect(self.accept)
        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.clicked.connect(self.reject)
        self.reset_btn = QPushButton("Reset to Default")
        self.reset_btn.clicked.connect(self._reset_default)
        btn_layout.addWidget(self.reset_btn)
        btn_layout.addStretch()
        btn_layout.addWidget(self.ok_btn)
        btn_layout.addWidget(self.cancel_btn)
        layout.addLayout(btn_layout)

        self._pending_sequence = ""

    def eventFilter(self, obj, event):
        if obj is self.key_input and event.type() == event.Type.KeyPress:
            key = event.key()
            mods = event.modifiers()

            # Build sequence string
            parts = []
            if mods & Qt.ControlModifier:
                parts.append("Ctrl")
            if mods & Qt.AltModifier:
                parts.append("Alt")
            if mods & Qt.ShiftModifier:
                parts.append("Shift")
            if mods & Qt.MetaModifier:
                parts.append("Meta")

            # Skip modifier-only presses
            if key in (Qt.Key_Control, Qt.Key_Alt, Qt.Key_Shift, Qt.Key_Meta):
                return True

            key_text = QKeySequence(key).toString()
            if key_text:
                parts.append(key_text)

            self._pending_sequence = "+".join(parts)
            self.key_input.setText(self._pending_sequence)
            return True
        return super().eventFilter(obj, event)

    def _reset_default(self) -> None:
        from utils.shortcut_manager import DEFAULT_SHORTCUTS
        default = next((s for s in DEFAULT_SHORTCUTS if s.action_id == self.action_id), None)
        if default:
            self._pending_sequence = default.default_sequence
            self.key_input.setText(self._pending_sequence)

    def get_sequence(self) -> str:
        return self._pending_sequence or self.key_input.text()


class SettingsView(QWidget):
    """Main settings widget with tabbed interface."""

    settings_changed = Signal()

    def __init__(self, settings_controller: SettingsController, parent=None):
        super().__init__(parent)
        self.controller = settings_controller
        self.company_id = get_current_company_id(None) or 1
        self._theme_manager = get_theme_manager()
        self._shortcut_manager = get_shortcut_manager()
        self._color_widgets: dict[str, ColorPickerButton] = {}
        self._build_ui()
        self._load_settings()

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        # Title
        title = QLabel("Settings")
        title.setStyleSheet("font-size: 22px; font-weight: 600; color: #e0e0e0;")
        layout.addWidget(title)

        # Tab widget
        self.tabs = QTabWidget()
        layout.addWidget(self.tabs, stretch=1)

        # Build tabs
        self._build_general_tab()
        self._build_appearance_tab()
        self._build_shortcuts_tab()
        self._build_database_tab()
        self._build_backup_tab()

        # Bottom buttons
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        self.save_btn = QPushButton("Save All")
        self.save_btn.setProperty("primary", True)
        self.save_btn.clicked.connect(self._save_all)
        btn_layout.addWidget(self.save_btn)
        layout.addLayout(btn_layout)

    def _build_general_tab(self) -> None:
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setSpacing(16)

        # Company info
        group = QGroupBox("Company Information")
        form = QFormLayout(group)

        self.company_name = QLineEdit()
        self.company_name.setPlaceholderText("Company name")
        form.addRow("Company Name:", self.company_name)

        self.currency = QComboBox()
        self.currency.addItems(["PKR", "USD", "EUR", "GBP", "SAR", "AED"])
        form.addRow("Default Currency:", self.currency)

        self.date_format = QComboBox()
        self.date_format.addItems(["yyyy-MM-dd", "dd/MM/yyyy", "MM/dd/yyyy", "dd.MM.yyyy"])
        form.addRow("Date Format:", self.date_format)

        layout.addWidget(group)

        # Language (placeholder for future i18n)
        lang_group = QGroupBox("Localization")
        lang_form = QFormLayout(lang_group)
        self.language = QComboBox()
        self.language.addItems(["English", "Urdu (Coming Soon)"])
        self.language.setEnabled(False)
        lang_form.addRow("Language:", self.language)
        layout.addWidget(lang_group)

        layout.addStretch()
        self.tabs.addTab(tab, "General")

    def _build_appearance_tab(self) -> None:
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setSpacing(12)

        # Theme selector
        theme_group = QGroupBox("Theme")
        theme_layout = QHBoxLayout(theme_group)

        self.theme_combo = QComboBox()
        self.theme_combo.addItems(["Dark", "Light", "System", "Custom"])
        self.theme_combo.currentTextChanged.connect(self._on_theme_changed)
        theme_layout.addWidget(QLabel("Theme:"))
        theme_layout.addWidget(self.theme_combo)
        theme_layout.addStretch()

        self.apply_theme_btn = QPushButton("Apply Theme")
        self.apply_theme_btn.clicked.connect(self._apply_theme)
        theme_layout.addWidget(self.apply_theme_btn)

        self.reset_theme_btn = QPushButton("Reset to Default")
        self.reset_theme_btn.clicked.connect(self._reset_theme)
        theme_layout.addWidget(self.reset_theme_btn)

        layout.addWidget(theme_group)

        # Color customization (scrollable)
        self.color_scroll = QScrollArea()
        self.color_scroll.setWidgetResizable(True)
        self.color_scroll.setMaximumHeight(350)
        self.color_widget = QWidget()
        self.color_layout = QVBoxLayout(self.color_widget)
        self.color_scroll.setWidget(self.color_widget)
        layout.addWidget(self.color_scroll)

        self._build_color_pickers()

        layout.addStretch()
        self.tabs.addTab(tab, "Appearance")

    def _build_color_pickers(self) -> None:
        """Build color picker rows organized by category."""
        categories = [
            ("Base Colors", [
                ("bg_primary", "Primary Background"),
                ("bg_secondary", "Secondary Background"),
                ("bg_tertiary", "Tertiary Background"),
                ("bg_hover", "Hover Background"),
            ]),
            ("Text Colors", [
                ("text_primary", "Primary Text"),
                ("text_secondary", "Secondary Text"),
                ("text_muted", "Muted Text"),
                ("text_disabled", "Disabled Text"),
            ]),
            ("Accent Colors", [
                ("accent_primary", "Primary Accent"),
                ("accent_secondary", "Secondary Accent"),
                ("accent_hover", "Accent Hover"),
                ("accent_focus", "Accent Focus"),
            ]),
            ("Border Colors", [
                ("border_subtle", "Subtle Border"),
                ("border_default", "Default Border"),
                ("border_focus", "Focus Border"),
            ]),
            ("Status Colors", [
                ("success", "Success"),
                ("warning", "Warning"),
                ("danger", "Danger"),
                ("info", "Info"),
            ]),
            ("Input Colors", [
                ("input_bg", "Input Background"),
                ("input_border", "Input Border"),
                ("input_focus_border", "Input Focus Border"),
                ("input_text", "Input Text"),
            ]),
            ("Button Colors", [
                ("btn_primary_bg", "Primary Button BG"),
                ("btn_primary_hover", "Primary Button Hover"),
                ("btn_secondary_bg", "Secondary Button BG"),
                ("btn_secondary_text", "Secondary Button Text"),
                ("btn_danger_bg", "Danger Button BG"),
            ]),
            ("Table Colors", [
                ("table_header_bg", "Header Background"),
                ("table_header_text", "Header Text"),
                ("table_row_hover", "Row Hover"),
                ("table_row_selected", "Row Selected"),
            ]),
        ]

        for cat_name, colors in categories:
            group = QGroupBox(cat_name)
            form = QFormLayout(group)
            for token, label in colors:
                btn = ColorPickerButton("#000000")  # placeholder
                btn.color_changed.connect(lambda c, t=token: self._on_color_changed(t, c))
                self._color_widgets[token] = btn
                form.addRow(label + ":", btn)
            self.color_layout.addWidget(group)

        # Initially hide color pickers unless Custom theme
        self.color_widget.setVisible(False)

    def _build_shortcuts_tab(self) -> None:
        tab = QWidget()
        layout = QVBoxLayout(tab)

        # Toolbar
        toolbar = QHBoxLayout()
        self.shortcut_filter = QLineEdit()
        self.shortcut_filter.setPlaceholderText("Filter shortcuts...")
        self.shortcut_filter.textChanged.connect(self._filter_shortcuts)
        toolbar.addWidget(QLabel("Search:"))
        toolbar.addWidget(self.shortcut_filter)
        toolbar.addStretch()

        self.reset_all_shortcuts_btn = QPushButton("Reset All to Defaults")
        self.reset_all_shortcuts_btn.setProperty("danger", True)
        self.reset_all_shortcuts_btn.clicked.connect(self._reset_all_shortcuts)
        toolbar.addWidget(self.reset_all_shortcuts_btn)
        layout.addLayout(toolbar)

        # Shortcuts table
        self.shortcuts_table = QTableWidget()
        self.shortcuts_table.setColumnCount(4)
        self.shortcuts_table.setHorizontalHeaderLabels(["Action", "Category", "Current Key", "Change"])
        self.shortcuts_table.horizontalHeader().setStretchLastSection(False)
        self.shortcuts_table.setColumnWidth(0, 220)
        self.shortcuts_table.setColumnWidth(1, 120)
        self.shortcuts_table.setColumnWidth(2, 150)
        self.shortcuts_table.setColumnWidth(3, 100)
        self.shortcuts_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.shortcuts_table.setEditTriggers(QTableWidget.NoEditTriggers)
        layout.addWidget(self.shortcuts_table)

        self.tabs.addTab(tab, "Shortcuts")

    def _build_database_tab(self) -> None:
        tab = QWidget()
        layout = QVBoxLayout(tab)

        group = QGroupBox("Database Connection")
        form = QFormLayout(group)

        self.db_engine = QComboBox()
        self.db_engine.addItems(["sqlitecloud", "sqlite", "mysql", "postgresql"])
        form.addRow("Engine:", self.db_engine)

        self.db_host = QLineEdit()
        self.db_host.setPlaceholderText("localhost")
        form.addRow("Host:", self.db_host)

        self.db_port = QLineEdit()
        self.db_port.setPlaceholderText("5432")
        form.addRow("Port:", self.db_port)

        self.db_name = QLineEdit()
        self.db_name.setPlaceholderText("pharma_erp")
        form.addRow("Database:", self.db_name)

        self.db_user = QLineEdit()
        form.addRow("User:", self.db_user)

        self.db_password = QLineEdit()
        self.db_password.setEchoMode(QLineEdit.Password)
        form.addRow("Password:", self.db_password)

        layout.addWidget(group)

        # Read-only note
        note = QLabel("⚠️ Database changes require application restart.")
        note.setStyleSheet("color: #f39c12; font-size: 12px; padding: 8px;")
        layout.addWidget(note)

        layout.addStretch()
        self.tabs.addTab(tab, "Database")

    def _build_backup_tab(self) -> None:
        tab = QWidget()
        layout = QVBoxLayout(tab)

        group = QGroupBox("Auto Backup")
        form = QFormLayout(group)

        self.auto_backup = QCheckBox("Enable automatic backups")
        form.addRow(self.auto_backup)

        self.backup_interval = QComboBox()
        self.backup_interval.addItems(["6 hours", "12 hours", "24 hours", "48 hours", "Weekly"])
        form.addRow("Interval:", self.backup_interval)

        self.backup_retention = QComboBox()
        self.backup_retention.addItems(["7 days", "14 days", "30 days", "60 days", "90 days"])
        form.addRow("Retention:", self.backup_retention)

        self.backup_location = QLineEdit()
        self.backup_location.setPlaceholderText("Backup directory path")
        form.addRow("Location:", self.backup_location)

        layout.addWidget(group)

        # Manual backup
        manual_group = QGroupBox("Manual Backup")
        manual_layout = QHBoxLayout(manual_group)
        self.backup_now_btn = QPushButton("Create Backup Now")
        self.backup_now_btn.clicked.connect(self._create_backup)
        manual_layout.addWidget(self.backup_now_btn)
        manual_layout.addStretch()
        layout.addWidget(manual_group)

        layout.addStretch()
        self.tabs.addTab(tab, "Backup")

    # --- Theme handling ---

    def _load_settings(self) -> None:
        """Load all settings from controller."""
        try:
            # General
            general = self.controller.get_settings_group(self.company_id, "GENERAL")
            self.company_name.setText(general.get("company_name", get_config().app_name))
            self.currency.setCurrentText(general.get("currency", "PKR"))
            self.date_format.setCurrentText(general.get("date_format", "yyyy-MM-dd"))

            # Appearance
            theme_name = self.controller.get_theme_name(self.company_id)
            self.theme_combo.setCurrentText(theme_name.capitalize())
            self._on_theme_changed(theme_name.capitalize())

            # Load custom colors if custom theme
            if theme_name == "custom":
                custom = self.controller.get_custom_theme(self.company_id)
                if custom:
                    for token, btn in self._color_widgets.items():
                        if token in custom:
                            btn.set_color(custom[token])

            # Shortcuts
            self._populate_shortcuts_table()

            # Database (read-only for now)
            db_cfg = get_config().database
            self.db_engine.setCurrentText(db_cfg.engine)
            self.db_host.setText(db_cfg.host)
            self.db_port.setText(str(db_cfg.port))
            self.db_name.setText(db_cfg.name)
            self.db_user.setText(db_cfg.user)
            self.db_password.setText(db_cfg.password)

            # Backup
            backup = self.controller.get_settings_group(self.company_id, "BACKUP")
            self.auto_backup.setChecked(backup.get("auto_backup_enabled", True))
            interval = backup.get("auto_backup_interval_hours", 24)
            self.backup_interval.setCurrentText(
                "6 hours" if interval == 6 else
                "12 hours" if interval == 12 else
                "24 hours" if interval == 24 else
                "48 hours" if interval == 48 else
                "Weekly"
            )
            retention = backup.get("keep_last_n_backups", 14)
            self.backup_retention.setCurrentText(
                "7 days" if retention == 7 else
                "14 days" if retention == 14 else
                "30 days" if retention == 30 else
                "60 days" if retention == 60 else
                "90 days"
            )
            self.backup_location.setText(backup.get("backup_dir", ""))

        except Exception as e:
            logger.error(f"Failed to load settings: {e}")

    def _on_theme_changed(self, text: str) -> None:
        """Handle theme combo change."""
        is_custom = text.lower() == "custom"
        self.color_widget.setVisible(is_custom)
        self.apply_theme_btn.setEnabled(True)

    def _apply_theme(self) -> None:
        """Apply selected theme."""
        theme_name = self.theme_combo.currentText().lower()
        success, error = self.controller.set_theme_name(self.company_id, theme_name)
        if success:
            # Apply immediately for preview
            from utils.theme import BUILTIN_THEMES, apply_theme
            from PySide6.QtWidgets import QApplication

            theme = BUILTIN_THEMES.get(theme_name, BUILTIN_THEMES["dark"])
            if theme_name == "custom":
                custom = self.controller.get_custom_theme(self.company_id)
                if custom:
                    theme = Theme.from_dict(custom)

            apply_theme(QApplication.instance(), theme)
            self._theme_manager.set_theme(theme_name)
            if theme_name == "custom":
                self._theme_manager.set_custom_theme(theme)

            QMessageBox.information(self, "Theme Applied", f"Theme changed to {theme_name.capitalize()}. Changes applied immediately.")
            self.settings_changed.emit()
        else:
            QMessageBox.warning(self, "Error", error or "Failed to apply theme")

    def _reset_theme(self) -> None:
        """Reset to default dark theme."""
        success, error = self.controller.reset_appearance(self.company_id)
        if success:
            self.theme_combo.setCurrentText("Dark")
            self.color_widget.setVisible(False)
            self._apply_theme()
        else:
            QMessageBox.warning(self, "Error", error)

    def _on_color_changed(self, token: str, color: str) -> None:
        """Handle color picker change - live preview."""
        # Update theme manager for live preview
        self._theme_manager.update_color(token, color)

        # Apply immediately
        from PySide6.QtWidgets import QApplication
        from utils.theme import apply_theme

        theme = self._theme_manager.get_current_theme()
        apply_theme(QApplication.instance(), theme)

        # Persist
        self.controller.update_theme_color(self.company_id, token, color)

    # --- Shortcuts ---

    def _populate_shortcuts_table(self) -> None:
        """Populate shortcuts table with current values."""
        shortcuts_by_cat = self.controller.get_shortcuts_by_category(self.company_id)

        all_shortcuts = []
        for cat, shortcuts in shortcuts_by_cat.items():
            for sc in shortcuts:
                all_shortcuts.append((cat, sc))

        self.shortcuts_table.setRowCount(len(all_shortcuts))

        for row, (cat, sc) in enumerate(all_shortcuts):
            # Action name
            action_item = QTableWidgetItem(sc.get("description", sc["action_id"]))
            action_item.setData(Qt.UserRole, sc["action_id"])
            self.shortcuts_table.setItem(row, 0, action_item)

            # Category
            cat_item = QTableWidgetItem(cat)
            self.shortcuts_table.setItem(row, 1, cat_item)

            # Current key
            key_item = QTableWidgetItem(sc.get("current_sequence", sc.get("default_sequence", "")))
            key_item.setTextAlignment(Qt.AlignCenter)
            self.shortcuts_table.setItem(row, 2, key_item)

            # Edit button
            edit_btn = QPushButton("Edit")
            edit_btn.setFixedWidth(70)
            edit_btn.clicked.connect(lambda _, a=sc["action_id"]: self._edit_shortcut(a))
            self.shortcuts_table.setCellWidget(row, 3, edit_btn)

    def _filter_shortcuts(self, text: str) -> None:
        """Filter shortcuts table by search text."""
        text = text.lower()
        for row in range(self.shortcuts_table.rowCount()):
            action_item = self.shortcuts_table.item(row, 0)
            cat_item = self.shortcuts_table.item(row, 1)
            key_item = self.shortcuts_table.item(row, 2)

            match = (
                text in action_item.text().lower() or
                text in cat_item.text().lower() or
                text in key_item.text().lower()
            )
            self.shortcuts_table.setRowHidden(row, not match)

    def _edit_shortcut(self, action_id: str) -> None:
        """Open dialog to edit shortcut."""
        current = self._shortcut_manager.get_sequence_string(action_id)
        sc_config = next((s for s in DEFAULT_SHORTCUTS if s.action_id == action_id), None)
        desc = sc_config.description if sc_config else action_id

        dialog = ShortcutEditDialog(action_id, current, desc, self)
        if dialog.exec() == QDialog.Accepted:
            new_seq = dialog.get_sequence()
            if new_seq and new_seq != current:
                success, error = self.controller.update_shortcut(self.company_id, action_id, new_seq)
                if success:
                    self._shortcut_manager.update_shortcut(action_id, new_seq)
                    self._populate_shortcuts_table()
                else:
                    QMessageBox.warning(self, "Error", error)

    def _reset_all_shortcuts(self) -> None:
        reply = QMessageBox.question(
            self,
            "Reset Shortcuts",
            "Reset all shortcuts to their default values?",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )
        if reply == QMessageBox.Yes:
            success, error = self.controller.reset_all_shortcuts(self.company_id)
            if success:
                self._shortcut_manager.reset_all_shortcuts()
                self._populate_shortcuts_table()
            else:
                QMessageBox.warning(self, "Error", error)

    # --- Actions ---

    def _save_all(self) -> None:
        """Save all settings (general, database, backup)."""
        try:
            # General
            self.controller.set_setting(self.company_id, "company_name", self.company_name.text(), "GENERAL")
            self.controller.set_setting(self.company_id, "currency", self.currency.currentText(), "GENERAL")
            self.controller.set_setting(self.company_id, "date_format", self.date_format.currentText(), "GENERAL")

            # Database - note: these are env-based, just save to settings for reference
            self.controller.set_setting(self.company_id, "db_engine", self.db_engine.currentText(), "DATABASE")
            self.controller.set_setting(self.company_id, "db_host", self.db_host.text(), "DATABASE")
            self.controller.set_setting(self.company_id, "db_port", self.db_port.text(), "DATABASE")
            self.controller.set_setting(self.company_id, "db_name", self.db_name.text(), "DATABASE")
            self.controller.set_setting(self.company_id, "db_user", self.db_user.text(), "DATABASE")
            self.controller.set_setting(self.company_id, "db_password", self.db_password.text(), "DATABASE")

            # Backup
            self.controller.set_setting(self.company_id, "auto_backup_enabled", self.auto_backup.isChecked(), "BACKUP")
            interval_map = {"6 hours": 6, "12 hours": 12, "24 hours": 24, "48 hours": 48, "Weekly": 168}
            self.controller.set_setting(self.company_id, "auto_backup_interval_hours", interval_map.get(self.backup_interval.currentText(), 24), "BACKUP")
            retention_map = {"7 days": 7, "14 days": 14, "30 days": 30, "60 days": 60, "90 days": 90}
            self.controller.set_setting(self.company_id, "keep_last_n_backups", retention_map.get(self.backup_retention.currentText(), 14), "BACKUP")
            self.controller.set_setting(self.company_id, "backup_dir", self.backup_location.text(), "BACKUP")

            QMessageBox.information(self, "Saved", "All settings saved successfully.")
            self.settings_changed.emit()
        except Exception as e:
            logger.error(f"Failed to save settings: {e}")
            QMessageBox.warning(self, "Error", f"Failed to save settings: {e}")

    def _create_backup(self) -> None:
        """Trigger manual backup."""
        from services.auto_backup import create_backup
        try:
            path = create_backup()
            QMessageBox.information(self, "Backup Created", f"Backup saved to:\n{path}")
        except Exception as e:
            QMessageBox.warning(self, "Backup Failed", str(e))