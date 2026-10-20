"""
Theme engine for BOP Pharmaceutical ERP.
Provides semantic color tokens and QSS generation from templates.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Any

from utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class Theme:
    """Semantic color tokens for the application theme."""

    name: str = "dark"

    # Base backgrounds
    bg_primary: str = "#0c0c0c"
    bg_secondary: str = "#141414"
    bg_tertiary: str = "#242424"
    bg_hover: str = "rgba(255,255,255,0.08)"
    bg_pressed: str = "rgba(255,255,255,0.15)"

    # Text colors
    text_primary: str = "#e0e0e0"
    text_secondary: str = "#a8b2d1"
    text_muted: str = "#8a94ad"
    text_disabled: str = "#6b6b6b"

    # Accent colors
    accent_primary: str = "#8B1A2B"
    accent_secondary: str = "#A83248"
    accent_hover: str = "rgba(139,26,43,0.35)"
    accent_focus: str = "rgba(168,50,72,0.5)"

    # Borders
    border_subtle: str = "#2a2a2a"
    border_default: str = "#3a3a3a"
    border_focus: str = "#A83248"

    # Status colors
    success: str = "#2ecc71"
    warning: str = "#f39c12"
    danger: str = "#e74c3c"
    info: str = "#3498db"

    # Sidebar gradient
    sidebar_grad_start: str = "#000000"
    sidebar_grad_end: str = "#151515"

    # Login card gradient
    login_grad_start: str = "#1c1c1c"
    login_grad_end: str = "#141414"

    # Input fields
    input_bg: str = "#222222"
    input_border: str = "#3a3a3a"
    input_focus_border: str = "#A83248"
    input_text: str = "#e0e0e0"
    input_placeholder: str = "#8a94ad"
    input_readonly_bg: str = "#242424"
    input_readonly_text: str = "#adb5bd"

    # Button base
    btn_primary_bg: str = "#8B1A2B"
    btn_primary_hover: str = "#A83248"
    btn_primary_pressed: str = "#6B1520"
    btn_primary_text: str = "#ffffff"

    btn_secondary_bg: str = "rgba(255,255,255,0.08)"
    btn_secondary_hover: str = "rgba(255,255,255,0.15)"
    btn_secondary_text: str = "#a8b2d1"

    btn_danger_bg: str = "#c0392b"
    btn_danger_hover: str = "#e74c3c"

    # Table
    table_header_bg: str = "#1a1a1a"
    table_header_text: str = "#a8b2d1"
    table_row_even: str = "transparent"
    table_row_odd: str = "rgba(255,255,255,0.03)"
    table_row_hover: str = "rgba(255,255,255,0.08)"
    table_row_selected: str = "rgba(139,26,43,0.4)"
    table_grid: str = "#2a2a2a"

    # Scrollbar
    scrollbar_bg: str = "transparent"
    scrollbar_handle: str = "#3a3a3a"
    scrollbar_handle_hover: str = "#4a4a4a"

    # Tooltip
    tooltip_bg: str = "#222222"
    tooltip_text: str = "#e0e0e0"
    tooltip_border: str = "#3a3a3a"

    # Menu
    menu_bg: str = "#1c1c1c"
    menu_item_selected: str = "rgba(139,26,43,0.4)"
    menu_border: str = "#2a2a2a"

    # Dialog
    dialog_bg: str = "#141418"

    # Font
    font_family: str = "'Segoe UI', 'Microsoft YaHei', Arial, sans-serif"
    font_size: str = "16px"
    font_size_small: str = "13px"
    font_size_large: str = "18px"

    # Border radius
    border_radius_small: str = "4px"
    border_radius_medium: str = "8px"
    border_radius_large: str = "16px"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Theme":
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})


# Built-in themes
DARK_THEME = Theme(name="dark")

LIGHT_THEME = Theme(
    name="light",
    bg_primary="#ffffff",
    bg_secondary="#f5f5f5",
    bg_tertiary="#e8e8e8",
    bg_hover="rgba(0,0,0,0.05)",
    bg_pressed="rgba(0,0,0,0.1)",
    text_primary="#1a1a1a",
    text_secondary="#4a4a4a",
    text_muted="#888888",
    text_disabled="#bbbbbb",
    accent_primary="#8B1A2B",
    accent_secondary="#A83248",
    accent_hover="rgba(139,26,43,0.15)",
    accent_focus="rgba(168,50,72,0.3)",
    border_subtle="#e0e0e0",
    border_default="#d0d0d0",
    border_focus="#A83248",
    success="#27ae60",
    warning="#e67e22",
    danger="#c0392b",
    info="#2980b9",
    sidebar_grad_start="#f0f0f0",
    sidebar_grad_end="#e0e0e0",
    login_grad_start="#fafafa",
    login_grad_end="#f0f0f0",
    input_bg="#ffffff",
    input_border="#d0d0d0",
    input_focus_border="#A83248",
    input_text="#1a1a1a",
    input_placeholder="#888888",
    input_readonly_bg="#f5f5f5",
    input_readonly_text="#666666",
    btn_primary_bg="#8B1A2B",
    btn_primary_hover="#A83248",
    btn_primary_pressed="#6B1520",
    btn_primary_text="#ffffff",
    btn_secondary_bg="#e8e8e8",
    btn_secondary_hover="#d8d8d8",
    btn_secondary_text="#4a4a4a",
    btn_danger_bg="#c0392b",
    btn_danger_hover="#e74c3c",
    table_header_bg="#f0f0f0",
    table_header_text="#4a4a4a",
    table_row_even="transparent",
    table_row_odd="rgba(0,0,0,0.02)",
    table_row_hover="rgba(0,0,0,0.05)",
    table_row_selected="rgba(139,26,43,0.15)",
    table_grid="#e0e0e0",
    scrollbar_bg="transparent",
    scrollbar_handle="#c0c0c0",
    scrollbar_handle_hover="#a0a0a0",
    tooltip_bg="#333333",
    tooltip_text="#ffffff",
    tooltip_border="#444444",
    menu_bg="#ffffff",
    menu_item_selected="rgba(139,26,43,0.1)",
    menu_border="#e0e0e0",
    dialog_bg="#fafafa",
)

SYSTEM_THEME = Theme(name="system")  # Placeholder - resolved at runtime

BUILTIN_THEMES = {
    "dark": DARK_THEME,
    "light": LIGHT_THEME,
    "system": SYSTEM_THEME,
}


class ThemeManager:
    """Singleton theme manager - loads/saves theme from settings table."""

    _instance: "ThemeManager | None" = None

    def __new__(cls) -> "ThemeManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._current_theme: Theme = DARK_THEME
        self._custom_theme: Theme | None = None
        self._theme_name: str = "dark"
        self._db = None

    def set_database(self, db) -> None:
        """Set database connection for persistence."""
        self._db = db

    def get_current_theme(self) -> Theme:
        """Get the currently active theme."""
        if self._theme_name == "custom" and self._custom_theme:
            return self._custom_theme
        return BUILTIN_THEMES.get(self._theme_name, DARK_THEME)

    def get_theme_name(self) -> str:
        return self._theme_name

    def set_theme(self, theme_name: str) -> bool:
        """Switch to a built-in theme."""
        if theme_name in BUILTIN_THEMES:
            self._theme_name = theme_name
            self._custom_theme = None
            self._persist_theme()
            logger.info(f"Theme changed to: {theme_name}")
            return True
        return False

    def set_custom_theme(self, theme: Theme) -> None:
        """Set a custom theme (user-modified colors)."""
        self._theme_name = "custom"
        self._custom_theme = theme
        self._persist_theme()
        logger.info("Custom theme applied")

    def update_color(self, token: str, value: str) -> bool:
        """Update a single color token in the current/custom theme."""
        theme = self.get_current_theme()
        if hasattr(theme, token):
            setattr(theme, token, value)
            if self._theme_name != "custom":
                # Create custom theme from current
                self._custom_theme = Theme(**theme.to_dict())
                self._theme_name = "custom"
            self._persist_theme()
            logger.debug(f"Updated theme color {token} = {value}")
            return True
        return False

    def reset_to_default(self, theme_name: str = "dark") -> None:
        """Reset to a built-in theme, discarding custom changes."""
        self.set_theme(theme_name)

    def _persist_theme(self) -> None:
        """Save theme preference to database."""
        if not self._db:
            return
        try:
            from utils.helpers import get_current_company_id
            company_id = get_current_company_id(self._db) or 1

            if self._theme_name == "custom" and self._custom_theme:
                self._db.execute(
                    """
                    INSERT INTO settings (company_id, setting_key, setting_value, setting_group)
                    VALUES (?, ?, ?, 'APPEARANCE')
                    ON CONFLICT(company_id, setting_key) DO UPDATE SET
                        setting_value = excluded.setting_value
                    """,
                    (company_id, "theme_name", "custom"),
                )
                self._db.execute(
                    """
                    INSERT INTO settings (company_id, setting_key, setting_value, setting_group)
                    VALUES (?, ?, ?, 'APPEARANCE')
                    ON CONFLICT(company_id, setting_key) DO UPDATE SET
                        setting_value = excluded.setting_value
                    """,
                    (company_id, "custom_theme", json.dumps(self._custom_theme.to_dict())),
                )
            else:
                self._db.execute(
                    """
                    INSERT INTO settings (company_id, setting_key, setting_value, setting_group)
                    VALUES (?, ?, ?, 'APPEARANCE')
                    ON CONFLICT(company_id, setting_key) DO UPDATE SET
                        setting_value = excluded.setting_value
                    """,
                    (company_id, "theme_name", self._theme_name),
                )
                # Clear custom theme
                self._db.execute(
                    "DELETE FROM settings WHERE company_id = ? AND setting_key = 'custom_theme'",
                    (company_id,),
                )
        except Exception as e:
            logger.warning(f"Failed to persist theme: {e}")

    def load_from_db(self, db) -> None:
        """Load theme preference from database."""
        self._db = db
        try:
            from utils.helpers import get_current_company_id
            company_id = get_current_company_id(db) or 1

            row = db.fetch_one(
                "SELECT setting_key, setting_value FROM settings WHERE company_id = ? AND setting_group = 'APPEARANCE'",
                (company_id,),
            )
            if not row:
                return

            settings = {}
            for r in db.fetch_all(
                "SELECT setting_key, setting_value FROM settings WHERE company_id = ? AND setting_group = 'APPEARANCE'",
                (company_id,),
            ):
                settings[r["setting_key"]] = r["setting_value"]

            theme_name = settings.get("theme_name", "dark")
            if theme_name == "custom":
                custom_data = settings.get("custom_theme")
                if custom_data:
                    try:
                        data = json.loads(custom_data)
                        self._custom_theme = Theme.from_dict(data)
                        self._theme_name = "custom"
                    except (json.JSONDecodeError, TypeError):
                        self._theme_name = "dark"
            else:
                self._theme_name = theme_name if theme_name in BUILTIN_THEMES else "dark"

            logger.info(f"Loaded theme: {self._theme_name}")
        except Exception as e:
            logger.warning(f"Failed to load theme from DB: {e}")


def apply_theme(app, theme: Theme) -> None:
    """Apply theme to QApplication by generating QSS from template."""
    qss = QSS_TEMPLATE.format(**theme.to_dict())
    app.setStyleSheet(qss)
    logger.debug(f"Applied theme: {theme.name}")


def get_theme_manager() -> ThemeManager:
    """Get the singleton ThemeManager instance."""
    return ThemeManager()


# --- QSS Template (inline for now, will move to theme_templates.py) ---
QSS_TEMPLATE = """
/* ============================================================
   GLOBAL STYLES
   ============================================================ */
QWidget {{
    font-family: {font_family};
    font-size: {font_size};
    color: {text_primary};
}}

QMainWindow {{
    background: {bg_primary};
}}

QScrollArea, QStackedWidget {{
    background: {bg_primary};
}}

QScrollArea > QWidget > QWidget {{
    background: {bg_primary};
}}

QWidget:tooltip {{
    background: {tooltip_bg};
    color: {tooltip_text};
    border: 1px solid {tooltip_border};
}}

/* ============================================================
   SIDEBAR
   ============================================================ */
#sidebar {{
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 {sidebar_grad_start},
        stop:1 {sidebar_grad_end});
    border-right: 1px solid {border_subtle};
}}

#sidebar QLabel {{
    color: #ffffff;
    font-size: 14px;
    font-weight: bold;
    padding: 12px 16px;
}}

#sidebar QListWidget {{
    background: transparent;
    color: {text_secondary};
    border: none;
    outline: none;
    font-size: {font_size_small};
}}

#sidebar QListWidget::item {{
    padding: 10px 16px;
    border-radius: {border_radius_medium};
    margin: 2px 8px;
}}

#sidebar QListWidget::item:hover {{
    background: {bg_hover};
    color: {text_primary};
}}

#sidebar QListWidget::item:selected {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 {accent_primary},
        stop:1 {accent_secondary});
    color: {text_primary};
}}

#sidebar QPushButton {{
    background: {bg_hover};
    color: {text_secondary};
    border: 1px solid {border_subtle};
    border-radius: {border_radius_medium};
    padding: 10px 16px;
    margin: 4px 12px 12px 12px;
    font-weight: 500;
}}

#sidebar QPushButton:hover {{
    background: {bg_pressed};
    color: {text_primary};
}}

#sidebar QPushButton:pressed {{
    background: {accent_hover};
}}

/* ============================================================
   LOGIN CARD
   ============================================================ */
#loginCard {{
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 {login_grad_start},
        stop:1 {login_grad_end});
    border: 1px solid {border_subtle};
    border-radius: {border_radius_large};
}}

#loginCard QLabel {{
    color: {text_primary};
}}

#loginCard QLineEdit {{
    background: {input_bg};
    border: 1px solid {input_border};
    border-radius: 10px;
    padding: 12px 16px;
    font-size: {font_size_small};
    color: {input_text};
}}

#loginCard QLineEdit:focus {{
    border: 2px solid {input_focus_border};
}}

#loginCard QPushButton {{
    background: {btn_primary_bg};
    color: {btn_primary_text};
    border: none;
    border-radius: 10px;
    padding: 12px 24px;
    font-size: {font_size_small};
    font-weight: 600;
}}

#loginCard QPushButton:hover {{
    background: {btn_primary_hover};
}}

#loginCard QPushButton:pressed {{
    background: {btn_primary_pressed};
}}

/* ============================================================
   BUTTONS
   ============================================================ */
QPushButton {{
    background: {btn_secondary_bg};
    color: {btn_secondary_text};
    border: 1px solid {border_subtle};
    border-radius: {border_radius_medium};
    padding: 8px 16px;
    font-size: {font_size_small};
    font-weight: 500;
}}

QPushButton:hover {{
    background: {bg_hover};
    color: {text_primary};
}}

QPushButton:pressed {{
    background: {bg_pressed};
}}

QPushButton:disabled {{
    background: {bg_tertiary};
    color: {text_disabled};
    border-color: {border_subtle};
}}

QPushButton[primary="true"] {{
    background: {btn_primary_bg};
    color: {btn_primary_text};
    border: none;
}}

QPushButton[primary="true"]:hover {{
    background: {btn_primary_hover};
}}

QPushButton[primary="true"]:pressed {{
    background: {btn_primary_pressed};
}}

QPushButton[danger="true"] {{
    background: {btn_danger_bg};
    color: {btn_primary_text};
    border: none;
}}

QPushButton[danger="true"]:hover {{
    background: {btn_danger_hover};
}}

/* ============================================================
   LINE EDIT / INPUTS
   ============================================================ */
QLineEdit, QTextEdit, QPlainTextEdit {{
    background: {input_bg};
    border: 1px solid {input_border};
    border-radius: {border_radius_medium};
    padding: 8px 12px;
    color: {input_text};
    selection-background-color: {accent_primary};
}}

QLineEdit:focus, QTextEdit:focus, QPlainTextEdit:focus {{
    border: 2px solid {input_focus_border};
}}

QLineEdit:read-only {{
    background: {input_readonly_bg};
    color: {input_readonly_text};
}}

QLineEdit::placeholder {{
    color: {input_placeholder};
}}

/* ============================================================
   COMBO BOX
   ============================================================ */
QComboBox {{
    background: {input_bg};
    border: 1px solid {input_border};
    border-radius: {border_radius_medium};
    padding: 8px 12px;
    color: {input_text};
    min-width: 100px;
}}

QComboBox:hover {{
    border-color: {border_default};
}}

QComboBox:focus {{
    border: 2px solid {input_focus_border};
}}

QComboBox::drop-down {{
    border: none;
    width: 24px;
}}

QComboBox::down-arrow {{
    image: none;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid {text_secondary};
    margin-right: 8px;
}}

QComboBox QAbstractItemView {{
    background: {menu_bg};
    border: 1px solid {menu_border};
    selection-background-color: {menu_item_selected};
    color: {text_primary};
    outline: none;
    padding: 4px;
}}

/* ============================================================
   TABLE WIDGET
   ============================================================ */
QTableWidget {{
    background: {bg_primary};
    border: 1px solid {table_grid};
    border-radius: 12px;
    gridline-color: {table_grid};
    selection-background-color: {table_row_selected};
    selection-color: #ffffff;
    alternate-background-color: {table_row_odd};
    color: {text_primary};
}}

QTableWidget::item {{
    padding: 8px 12px;
    color: {text_primary};
}}

QTableWidget::item:selected {{
    background: {table_row_selected};
    color: #ffffff;
}}

QHeaderView::section {{
    background: {table_header_bg};
    color: {table_header_text};
    padding: 10px 12px;
    border: none;
    border-bottom: 2px solid {table_grid};
    font-weight: 600;
    font-size: {font_size_small};
}}

QTableCornerButton::section {{
    background: {table_header_bg};
    border: none;
}}

/* ============================================================
   SCROLLBAR
   ============================================================ */
QScrollBar:vertical {{
    background: #1a1a1a;
    width: 10px;
    border-radius: 5px;
}}

QScrollBar::handle:vertical {{
    background: {scrollbar_handle};
    border-radius: 5px;
    min-height: 30px;
}}

QScrollBar::handle:vertical:hover {{
    background: {scrollbar_handle_hover};
}}

QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
    height: 0px;
}}

QScrollBar:horizontal {{
    background: #1a1a1a;
    height: 10px;
    border-radius: 5px;
}}

QScrollBar::handle:horizontal {{
    background: {scrollbar_handle};
    border-radius: 5px;
    min-width: 30px;
}}

QScrollBar::handle:horizontal:hover {{
    background: {scrollbar_handle_hover};
}}

/* ============================================================
   TAB WIDGET
   ============================================================ */
QTabWidget::pane {{
    background: {bg_secondary};
    border: 1px solid {border_subtle};
    border-radius: 12px;
    top: -1px;
}}

QTabBar::tab {{
    background: #1f1f1f;
    color: {text_secondary};
    padding: 10px 20px;
    border: none;
    border-radius: 8px 8px 0 0;
    margin-right: 2px;
    font-weight: 500;
}}

QTabBar::tab:selected {{
    background: {accent_primary};
    color: #ffffff;
}}

QTabBar::tab:hover:!selected {{
    background: #2b2b2b;
    color: {text_primary};
}}

/* ============================================================
   GROUP BOX
   ============================================================ */
QGroupBox {{
    background: {bg_secondary};
    border: 1px solid {border_subtle};
    border-radius: 12px;
    margin-top: 12px;
    padding-top: 8px;
    color: {text_primary};
}}

QGroupBox::title {{
    subcontrol-origin: margin;
    subcontrol-position: top left;
    padding: 0 8px;
    left: 16px;
    color: {text_secondary};
    font-weight: 600;
    font-size: 13px;
}}

/* ============================================================
   INPUTS (LineEdit, ComboBox, SpinBox, TextEdit, etc.)
   ============================================================ */
QLineEdit, QComboBox, QSpinBox, QDoubleSpinBox, QDateEdit, QTextEdit, QPlainTextEdit {{
    background: {input_bg};
    border: 1px solid {input_border};
    border-radius: 8px;
    padding: 8px 12px;
    min-height: 20px;
    color: {input_text};
    selection-background-color: {accent_primary};
    selection-color: #ffffff;
}}

QLineEdit:focus, QComboBox:focus, QSpinBox:focus, QDoubleSpinBox:focus,
QDateEdit:focus, QTextEdit:focus, QPlainTextEdit:focus {{
    border-color: {input_focus_border};
}}

QLineEdit:disabled, QComboBox:disabled {{
    background: #1a1a1a;
    color: #6c757d;
}}

QComboBox::drop-down {{
    border: none;
    width: 20px;
}}

QComboBox::down-arrow {{
    image: none;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 5px solid {text_secondary};
    margin-right: 8px;
}}

QComboBox QAbstractItemView {{
    background: #222222;
    color: {text_primary};
    border: 1px solid #3a3a3a;
    selection-background-color: {accent_primary};
    selection-color: #ffffff;
}}

QAbstractSpinBox::up-button, QAbstractSpinBox::down-button {{
    background: #2b2b2b;
    border: none;
}}

QCalendarWidget QWidget {{
    alternate-background-color: #222222;
    background: #1a1a1a;
    color: {text_primary};
}}

/* ============================================================
   BUTTONS
   ============================================================ */
QPushButton {{
    background: #2b2b2b;
    color: {text_primary};
    border: 1px solid #3a3a3a;
    border-radius: 8px;
    padding: 8px 18px;
    font-weight: 500;
    font-size: 12px;
}}

QPushButton:hover {{
    background: #363636;
    border-color: #4a4a4a;
}}

QPushButton:pressed {{
    background: #242424;
}}

QPushButton:disabled {{
    background: #1f1f1f;
    color: #6c757d;
    border-color: #2a2a2a;
}}

QPushButton[primary="true"] {{
    background: {btn_primary_bg};
    border-color: {btn_primary_bg};
    color: {btn_primary_text};
}}

QPushButton[primary="true"]:hover {{
    background: {btn_primary_hover};
    border-color: {btn_primary_hover};
}}

QPushButton[accent="true"] {{
    background: {accent_primary};
    border-color: {accent_primary};
    color: {btn_primary_text};
}}

QPushButton[accent="true"]:hover {{
    background: {accent_secondary};
    border-color: {accent_secondary};
}}

QPushButton[secondary="true"] {{
    background: transparent;
    color: {text_secondary};
    border: 1px solid #3a3a3a;
}}

QPushButton[secondary="true"]:hover {{
    background: #2b2b2b;
    color: {text_primary};
}}

QPushButton[success="true"] {{
    background: #27ae60;
    border-color: #27ae60;
    color: #ffffff;
}}

QPushButton[success="true"]:hover {{
    background: #219653;
    border-color: #219653;
}}

QPushButton[danger="true"] {{
    background: #e74c3c;
    border-color: #e74c3c;
    color: #ffffff;
}}

QPushButton[danger="true"]:hover {{
    background: #c0392b;
    border-color: #c0392b;
}}

/* ============================================================
   LOGIN CARD
   ============================================================ */
#loginCard {{
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 {login_grad_start},
        stop:1 {login_grad_end});
    border: 1px solid {border_subtle};
    border-radius: {border_radius_large};
}}

#loginCard QLabel {{
    color: {text_primary};
}}

#loginCard QLineEdit {{
    background: {input_bg};
    border: 1px solid {input_border};
    border-radius: 10px;
    padding: 12px 16px;
    font-size: {font_size_small};
    color: {input_text};
}}

#loginCard QLineEdit:focus {{
    border-color: {input_focus_border};
    background: #262626;
}}

#loginCard QPushButton {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 {btn_primary_bg},
        stop:1 {btn_primary_hover});
    color: {btn_primary_text};
    border: none;
    border-radius: 10px;
    padding: 12px 24px;
    font-size: {font_size_small};
    font-weight: bold;
}}

#loginCard QPushButton:hover {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 #701320,
        stop:1 {accent_primary});
}}

/* ============================================================
   SIDEBAR
   ============================================================ */
#sidebar {{
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 {sidebar_grad_start},
        stop:1 {sidebar_grad_end});
    border-right: 1px solid {border_subtle};
}}

#sidebar QLabel {{
    color: #ffffff;
    font-size: 14px;
    font-weight: bold;
    padding: 12px 16px;
}}

#sidebar QListWidget {{
    background: transparent;
    color: {text_secondary};
    border: none;
    outline: none;
    font-size: {font_size_small};
}}

#sidebar QListWidget::item {{
    padding: 10px 16px;
    border-radius: {border_radius_medium};
    margin: 2px 8px;
}}

#sidebar QListWidget::item:hover {{
    background: {bg_hover};
    color: {text_primary};
}}

#sidebar QListWidget::item:selected {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 {accent_primary},
        stop:1 {accent_secondary});
    color: #ffffff;
}}

#sidebar QPushButton {{
    background: rgba(255, 255, 255, 0.08);
    color: {text_secondary};
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 10px 16px;
    margin: 4px 12px 12px 12px;
    font-weight: 500;
}}

#sidebar QPushButton:hover {{
    background: rgba(255, 255, 255, 0.15);
    color: #ffffff;
}}

#sidebar QPushButton:pressed {{
    background: rgba(139, 26, 43, 0.35);
}}

/* ============================================================
   GLOBAL STYLES
   ============================================================ */
QWidget {{
    font-family: {font_family};
    font-size: {font_size};
    color: {text_primary};
}}

QMainWindow {{
    background: {bg_primary};
}}

QScrollArea, QStackedWidget {{
    background: {bg_primary};
}}

QScrollArea > QWidget > QWidget {{
    background: {bg_primary};
}}

QWidget:tooltip {{
    background: {tooltip_bg};
    color: {tooltip_text};
    border: 1px solid {tooltip_border};
}}

/* ============================================================
   ALERTS
   ============================================================ */
QFrame#alert-success {{
    background: #123a24;
    border-left: 4px solid #28a745;
    border-radius: 8px;
    padding: 8px 12px;
}}

QFrame#alert-warning {{
    background: #3a3114;
    border-left: 4px solid #ffc107;
    border-radius: 8px;
    padding: 8px 12px;
}}

QFrame#alert-danger {{
    background: #3a1a1a;
    border-left: 4px solid #dc3545;
    border-radius: 8px;
    padding: 8px 12px;
}}

QFrame#alert-success QLabel,
QFrame#alert-warning QLabel,
QFrame#alert-danger QLabel {{
    background: transparent;
    border: none;
}}

QFrame#alert-success QLabel#alert-title {{
    color: #7ee2a8;
    font-weight: 600;
    font-size: 12px;
}}

QFrame#alert-warning QLabel#alert-title {{
    color: #f5c26b;
    font-weight: 600;
    font-size: 12px;
}}

QFrame#alert-danger QLabel#alert-title {{
    color: #f08a8a;
    font-weight: 600;
    font-size: 12px;
}}

QFrame#alert-success QLabel#alert-msg,
QFrame#alert-warning QLabel#alert-msg,
QFrame#alert-danger QLabel#alert-msg {{
    color: #adb5bd;
    font-size: 11px;
}}

/* ============================================================
   CHART THEME
   ============================================================ */
QChartView {{
    background: transparent;
    border: none;
}}

/* ============================================================
   HELP BUTTON
   ============================================================ */
QPushButton#helpButton {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 {accent_primary},
        stop:1 {accent_secondary});
    color: #ffffff;
    border: none;
    border-radius: 14px;
    font-weight: bold;
    font-size: 14px;
    min-width: 30px;
    max-width: 34px;
    min-height: 26px;
    max-height: 26px;
}}

QPushButton#helpButton:hover {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 {accent_secondary},
        stop:1 #C44A63);
}}

/* ============================================================
   CHECKBOX / RADIO
   ============================================================ */
QCheckBox, QRadioButton {{
    color: {text_primary};
    spacing: 8px;
}}

QCheckBox::indicator, QRadioButton::indicator {{
    width: 18px;
    height: 18px;
    border: 2px solid {border_default};
    border-radius: 4px;
    background: {input_bg};
}}

QCheckBox::indicator:checked {{
    background: {accent_primary};
    border-color: {accent_primary};
    image: url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOSIgdmlld0JveD0iMCAwIDEyIDkiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDQuNUw0LjUgOEwxMSAxIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4K);
}}

QRadioButton::indicator {{
    border-radius: 9px;
}}

QRadioButton::indicator:checked {{
    background: {input_bg};
    border-color: {accent_primary};
    image: url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAxMiAxMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNiIgY3k9IjYiIHI9IjQiIGZpbGw9IiNBODMyNDgiLz4KPC9zdmc+);
}}
"""