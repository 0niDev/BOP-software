"""
Centralized stylesheet for BOP Nutraceuticals application.
Professional, clean design suitable for a nutraceuticals/pharmaceutical company.
"""

# Color Palette - Professional Healthcare/Nutraceuticals Theme
COLORS = {
    # Primary colors
    "primary": "#2E7D32",        # Deep green - main brand color
    "primary_dark": "#1B5E20",   # Darker green for hover states
    "primary_light": "#4CAF50",  # Lighter green for accents
    
    # Secondary colors
    "secondary": "#1976D2",      # Professional blue
    "secondary_dark": "#0D47A1", # Darker blue
    "secondary_light": "#42A5F5", # Lighter blue
    
    # Neutral colors
    "background": "#F5F7FA",     # Light gray-blue background
    "surface": "#FFFFFF",        # White surfaces/cards
    "surface_alt": "#FAFAFA",    # Alternate surface color
    
    # Text colors
    "text_primary": "#1A1A2E",   # Dark text for headings
    "text_secondary": "#546E7A", # Medium text
    "text_muted": "#90A4AE",     # Muted/disabled text
    
    # Status colors
    "success": "#2E7D32",        # Green for positive values
    "warning": "#F57C00",        # Orange for warnings
    "error": "#D32F2F",          # Red for errors/negative values
    "info": "#1976D2",           # Blue for information
    
    # Borders
    "border": "#E0E0E0",         # Light border
    "border_focus": "#2E7D32",   # Focused border color
}


def get_stylesheet() -> str:
    """Return the complete application stylesheet."""
    return f"""
/* =====================================================
   BOP NUTRACEUTICALS - APPLICATION THEME
   Professional Healthcare/Pharmaceutical Design
   ===================================================== */

/* === GLOBAL STYLES === */
QWidget {{
    font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
    font-size: 13px;
    color: {COLORS["text_primary"]};
    background-color: {COLORS["background"]};
}}

QMainWindow {{
    background-color: {COLORS["background"]};
}}

/* === SCROLLBARS === */
QScrollBar:vertical {{
    background-color: {COLORS["surface"]};
    width: 10px;
    border-radius: 5px;
    margin: 0px;
}}

QScrollBar::handle:vertical {{
    background-color: {COLORS["text_muted"]};
    border-radius: 5px;
    min-height: 20px;
}}

QScrollBar::handle:vertical:hover {{
    background-color: {COLORS["text_secondary"]};
}}

QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
    height: 0px;
}}

QScrollBar:horizontal {{
    background-color: {COLORS["surface"]};
    height: 10px;
    border-radius: 5px;
    margin: 0px;
}}

QScrollBar::handle:horizontal {{
    background-color: {COLORS["text_muted"]};
    border-radius: 5px;
    min-width: 20px;
}}

QScrollBar::handle:horizontal:hover {{
    background-color: {COLORS["text_secondary"]};
}}

QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {{
    width: 0px;
}}

/* === BUTTONS === */
QPushButton {{
    background-color: {COLORS["primary"]};
    color: {COLORS["surface"]};
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    font-weight: 500;
    font-size: 13px;
    min-height: 16px;
}}

QPushButton:hover {{
    background-color: {COLORS["primary_dark"]};
}}

QPushButton:pressed {{
    background-color: {COLORS["primary_dark"]};
    padding-top: 9px;
    padding-bottom: 7px;
}}

QPushButton:disabled {{
    background-color: {COLORS["text_muted"]};
    color: {COLORS["surface_alt"]};
}}

QPushButton#refreshBtn, QPushButton#RefreshButton {{
    background-color: {COLORS["secondary"]};
}}

QPushButton#refreshBtn:hover, QPushButton#RefreshButton:hover {{
    background-color: {COLORS["secondary_dark"]};
}}

QPushButton#dangerBtn, QPushButton#DangerButton, QPushButton#deleteBtn {{
    background-color: {COLORS["error"]};
}}

QPushButton#dangerBtn:hover, QPushButton#DangerButton:hover, QPushButton#deleteBtn:hover {{
    background-color: #B71C1C;
}}

/* === INPUT FIELDS === */
QLineEdit {{
    background-color: {COLORS["surface"]};
    border: 1px solid {COLORS["border"]};
    border-radius: 6px;
    padding: 8px 12px;
    color: {COLORS["text_primary"]};
    selection-background-color: {COLORS["primary"]};
    selection-color: {COLORS["surface"]};
}}

QLineEdit:focus {{
    border: 2px solid {COLORS["border_focus"]};
    padding: 7px 11px;
}}

QLineEdit:disabled {{
    background-color: {COLORS["surface_alt"]};
    color: {COLORS["text_muted"]};
}}

QLineEdit::placeholder {{
    color: {COLORS["text_muted"]};
}}

/* === COMBO BOXES === */
QComboBox {{
    background-color: {COLORS["surface"]};
    border: 1px solid {COLORS["border"]};
    border-radius: 6px;
    padding: 8px 12px;
    color: {COLORS["text_primary"]};
    min-height: 16px;
}}

QComboBox:focus {{
    border: 2px solid {COLORS["border_focus"]};
    padding: 7px 11px;
}}

QComboBox::drop-down {{
    border: none;
    width: 24px;
    padding-right: 8px;
}}

QComboBox::down-arrow {{
    image: none;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid {COLORS["text_secondary"]};
    margin-right: 8px;
}}

QComboBox QAbstractItemView {{
    background-color: {COLORS["surface"]};
    border: 1px solid {COLORS["border"]};
    border-radius: 6px;
    selection-background-color: {COLORS["primary"]};
    selection-color: {COLORS["surface"]};
    outline: none;
    padding: 4px;
}}

QComboBox QAbstractItemView::item {{
    min-height: 30px;
    padding: 4px 8px;
    border-radius: 4px;
}}

/* === TABLES === */
QTableWidget {{
    background-color: {COLORS["surface"]};
    border: 1px solid {COLORS["border"]};
    border-radius: 8px;
    gridline-color: {COLORS["border"]};
    selection-background-color: rgba(46, 125, 50, 0.1);
    selection-color: {COLORS["text_primary"]};
    outline: none;
}}

QTableWidget::item {{
    padding: 8px;
    border-bottom: 1px solid {COLORS["border"]};
}}

QTableWidget::item:selected {{
    background-color: rgba(46, 125, 50, 0.15);
    color: {COLORS["text_primary"]};
}}

QTableWidget::item:hover {{
    background-color: {COLORS["surface_alt"]};
}}

QHeaderView::section {{
    background-color: {COLORS["surface_alt"]};
    color: {COLORS["text_secondary"]};
    font-weight: 600;
    font-size: 12px;
    padding: 10px 8px;
    border: none;
    border-bottom: 2px solid {COLORS["border"]};
    border-right: 1px solid {COLORS["border"]};
}}

QHeaderView::section:first {{
    border-top-left-radius: 8px;
}}

QHeaderView::section:last {{
    border-top-right-radius: 8px;
    border-right: none;
}}

QHeaderView::section:hover {{
    background-color: {COLORS["border"]};
}}

/* === TAB WIDGETS === */
QTabWidget::pane {{
    border: 1px solid {COLORS["border"]};
    border-radius: 8px;
    background-color: {COLORS["surface"]};
    top: -1px;
}}

QTabBar::tab {{
    background-color: {COLORS["surface_alt"]};
    color: {COLORS["text_secondary"]};
    padding: 10px 20px;
    margin-right: 2px;
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    font-weight: 500;
}}

QTabBar::tab:selected {{
    background-color: {COLORS["surface"]};
    color: {COLORS["primary"]};
    border-bottom: 2px solid {COLORS["primary"]};
}}

QTabBar::tab:hover:!selected {{
    background-color: {COLORS["border"]};
}}

/* === LABELS === */
QLabel {{
    color: {COLORS["text_primary"]};
    background-color: transparent;
}}

QLabel#titleLabel {{
    font-size: 18px;
    font-weight: 700;
    color: {COLORS["text_primary"]};
}}

QLabel#subtitleLabel {{
    font-size: 13px;
    color: {COLORS["text_secondary"]};
}}

QLabel#headingLabel {{
    font-size: 16px;
    font-weight: 600;
    color: {COLORS["text_primary"]};
}}

/* === GROUP BOXES === */
QGroupBox {{
    font-weight: 600;
    color: {COLORS["text_primary"]};
    border: 1px solid {COLORS["border"]};
    border-radius: 8px;
    margin-top: 12px;
    padding-top: 12px;
    background-color: {COLORS["surface"]};
}}

QGroupBox::title {{
    subcontrol-origin: margin;
    left: 12px;
    padding: 0 8px;
    color: {COLORS["primary"]};
}}

/* === CHECK BOXES === */
QCheckBox {{
    color: {COLORS["text_primary"]};
    spacing: 8px;
}}

QCheckBox::indicator {{
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1px solid {COLORS["border"]};
    background-color: {COLORS["surface"]};
}}

QCheckBox::indicator:checked {{
    background-color: {COLORS["primary"]};
    border: 1px solid {COLORS["primary"]};
}}

QCheckBox::indicator:hover {{
    border: 2px solid {COLORS["primary"]};
}}

/* === RADIO BUTTONS === */
QRadioButton {{
    color: {COLORS["text_primary"]};
    spacing: 8px;
}}

QRadioButton::indicator {{
    width: 18px;
    height: 18px;
    border-radius: 9px;
    border: 1px solid {COLORS["border"]};
    background-color: {COLORS["surface"]};
}}

QRadioButton::indicator:checked {{
    background-color: {COLORS["surface"]};
    border: 5px solid {COLORS["primary"]};
}}

QRadioButton::indicator:hover {{
    border: 2px solid {COLORS["primary"]};
}}

/* === SPIN BOXES === */
QDoubleSpinBox, QSpinBox {{
    background-color: {COLORS["surface"]};
    border: 1px solid {COLORS["border"]};
    border-radius: 6px;
    padding: 8px 12px;
    color: {COLORS["text_primary"]};
}}

QDoubleSpinBox:focus, QSpinBox:focus {{
    border: 2px solid {COLORS["border_focus"]};
    padding: 7px 11px;
}}

QDoubleSpinBox::up-button, QSpinBox::up-button,
QDoubleSpinBox::down-button, QSpinBox::down-button {{
    width: 20px;
    border: none;
    background-color: {COLORS["surface_alt"]};
    border-radius: 4px;
    margin: 2px;
}}

QDoubleSpinBox::up-button:hover, QSpinBox::up-button:hover,
QDoubleSpinBox::down-button:hover, QSpinBox::down-button:hover {{
    background-color: {COLORS["border"]};
}}

/* === DATE/TIME EDITORS === */
QDateEdit, QTimeEdit, QDateTimeEdit {{
    background-color: {COLORS["surface"]};
    border: 1px solid {COLORS["border"]};
    border-radius: 6px;
    padding: 8px 12px;
    color: {COLORS["text_primary"]};
    min-height: 16px;
}}

QDateEdit:focus, QTimeEdit:focus, QDateTimeEdit:focus {{
    border: 2px solid {COLORS["border_focus"]};
    padding: 7px 11px;
}}

QDateEdit::drop-down, QTimeEdit::drop-down, QDateTimeEdit::drop-down {{
    border: none;
    width: 24px;
    padding-right: 8px;
}}

/* === PROGRESS BARS === */
QProgressBar {{
    background-color: {COLORS["border"]};
    border: none;
    border-radius: 6px;
    height: 8px;
    text-align: center;
    color: transparent;
}}

QProgressBar::chunk {{
    background-color: {COLORS["primary"]};
    border-radius: 6px;
}}

/* === TOOL TIPS === */
QToolTip {{
    background-color: {COLORS["text_primary"]};
    color: {COLORS["surface"]};
    border: none;
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 12px;
}}

/* === STATUS BAR === */
QStatusBar {{
    background-color: {COLORS["surface"]};
    border-top: 1px solid {COLORS["border"]};
    color: {COLORS["text_secondary"]};
    font-size: 12px;
    padding: 4px 8px;
}}

QStatusBar::item {{
    border: none;
}}

/* === MENU BARS === */
QMenuBar {{
    background-color: {COLORS["surface"]};
    border-bottom: 1px solid {COLORS["border"]};
    color: {COLORS["text_primary"]};
    padding: 4px 0;
}}

QMenuBar::item {{
    padding: 6px 12px;
    border-radius: 4px;
    background-color: transparent;
}}

QMenuBar::item:selected {{
    background-color: {COLORS["border"]};
}}

QMenuBar::item:pressed {{
    background-color: {COLORS["primary"]};
    color: {COLORS["surface"]};
}}

QMenu {{
    background-color: {COLORS["surface"]};
    border: 1px solid {COLORS["border"]};
    border-radius: 6px;
    padding: 4px;
}}

QMenu::item {{
    padding: 8px 32px 8px 16px;
    border-radius: 4px;
}}

QMenu::item:selected {{
    background-color: {COLORS["primary"]};
    color: {COLORS["surface"]};
}}

QMenu::separator {{
    height: 1px;
    background-color: {COLORS["border"]};
    margin: 4px 0;
}}

/* === LIST WIDGETS === */
QListWidget {{
    background-color: {COLORS["surface"]};
    border: 1px solid {COLORS["border"]};
    border-radius: 8px;
    outline: none;
    padding: 4px;
}}

QListWidget::item {{
    padding: 8px 12px;
    border-radius: 6px;
    margin: 2px 4px;
}}

QListWidget::item:selected {{
    background-color: {COLORS["primary"]};
    color: {COLORS["surface"]};
}}

QListWidget::item:hover:!selected {{
    background-color: {COLORS["surface_alt"]};
}}

/* === TREE WIDGETS === */
QTreeWidget {{
    background-color: {COLORS["surface"]};
    border: 1px solid {COLORS["border"]};
    border-radius: 8px;
    outline: none;
}}

QTreeWidget::item {{
    padding: 6px;
    border-radius: 4px;
}}

QTreeWidget::item:selected {{
    background-color: {COLORS["primary"]};
    color: {COLORS["surface"]};
}}

QTreeWidget::item:hover:!selected {{
    background-color: {COLORS["surface_alt"]};
}}

QTreeWidget::branch {{
    background-color: {COLORS["surface"]};
}}

QTreeWidget::branch:has-children:!has-siblings:closed,
QTreeWidget::branch:closed:has-children:has-siblings {{
    border-image: none;
}}

/* === TEXT EDITORS === */
QTextEdit, QPlainTextEdit {{
    background-color: {COLORS["surface"]};
    border: 1px solid {COLORS["border"]};
    border-radius: 6px;
    padding: 8px 12px;
    color: {COLORS["text_primary"]};
    selection-background-color: {COLORS["primary"]};
    selection-color: {COLORS["surface"]};
}}

QTextEdit:focus, QPlainTextEdit:focus {{
    border: 2px solid {COLORS["border_focus"]};
    padding: 7px 11px;
}}

/* === FRAMES === */
QFrame {{
    background-color: transparent;
}}

QFrame[frameShape="4"] {{  /* HLine */
    background-color: {COLORS["border"]};
    max-height: 1px;
}}

QFrame[frameShape="5"] {{  /* VLine */
    background-color: {COLORS["border"]};
    max-width: 1px;
}}

/* === SLIDERS === */
QSlider::groove:horizontal {{
    background-color: {COLORS["border"]};
    height: 6px;
    border-radius: 3px;
}}

QSlider::handle:horizontal {{
    background-color: {COLORS["primary"]};
    width: 16px;
    height: 16px;
    margin: -5px 0;
    border-radius: 8px;
}}

QSlider::handle:horizontal:hover {{
    background-color: {COLORS["primary_dark"]};
}}

QSlider::groove:vertical {{
    background-color: {COLORS["border"]};
    width: 6px;
    border-radius: 3px;
}}

QSlider::handle:vertical {{
    background-color: {COLORS["primary"]};
    width: 16px;
    height: 16px;
    margin: 0 -5px;
    border-radius: 8px;
}}

QSlider::handle:vertical:hover {{
    background-color: {COLORS["primary_dark"]};
}}

/* === DOCK WIDGETS === */
QDockWidget {{
    titlebar-close-icon: none;
    titlebar-normal-icon: none;
}}

QDockWidget::title {{
    background-color: {COLORS["surface_alt"]};
    padding: 8px;
    border-bottom: 1px solid {COLORS["border"]};
    font-weight: 600;
}}

QDockWidget {{
    border: 1px solid {COLORS["border"]};
    border-radius: 8px;
    background-color: {COLORS["surface"]};
}}

/* === DIALOG BUTTON BOX === */
QDialogButtonBox {{
    button-layout: 2;  /* Center buttons */
}}

QDialogButtonBox QPushButton {{
    min-width: 80px;
}}

/* === CALendars === */
QCalendarWidget {{
    background-color: {COLORS["surface"]};
    border: 1px solid {COLORS["border"]};
    border-radius: 8px;
}}

QCalendarWidget QToolButton {{
    background-color: {COLORS["surface_alt"]};
    color: {COLORS["text_primary"]};
    border: none;
    border-radius: 4px;
    padding: 8px;
    font-weight: 600;
}}

QCalendarWidget QToolButton:hover {{
    background-color: {COLORS["border"]};
}}

QCalendarWidget QMenu {{
    background-color: {COLORS["surface"]};
    border: 1px solid {COLORS["border"]};
    border-radius: 6px;
}}

QCalendarWidget QSpinBox {{
    background-color: {COLORS["surface"]};
    border: 1px solid {COLORS["border"]};
    border-radius: 4px;
    padding: 4px;
}}

QCalendarWidget QWidget#qt_calendar_navigationbar {{
    background-color: {COLORS["surface_alt"]};
    border-bottom: 1px solid {COLORS["border"]};
}}

QCalendarWidget QTableView {{
    background-color: {COLORS["surface"]};
    selection-background-color: {COLORS["primary"]};
    selection-color: {COLORS["surface"]};
    outline: none;
}}

QCalendarWidget QTableView::item {{
    padding: 4px;
    border-radius: 4px;
}}

QCalendarWidget QTableView::item:selected {{
    background-color: {COLORS["primary"]};
    color: {COLORS["surface"]};
}}

/* === SPECIFIC COMPONENT STYLES === */

/* Card-style frames for dashboard KPIs */
QFrame#kpiCard, QFrame.kpi-card {{
    background-color: {COLORS["surface"]};
    border: 1px solid {COLORS["border"]};
    border-radius: 12px;
    padding: 15px;
}}

/* Sidebar navigation */
QWidget#sidebar {{
    background-color: {COLORS["primary_dark"]};
    border-right: 1px solid rgba(255, 255, 255, 0.1);
}}

/* Login card */
QFrame#loginCard {{
    background-color: {COLORS["surface"]};
    border: 1px solid {COLORS["border"]};
    border-radius: 16px;
    padding: 32px;
}}

/* Success/Error labels */
QLabel#successLabel {{
    color: {COLORS["success"]};
    font-weight: 600;
}}

QLabel#errorLabel {{
    color: {COLORS["error"]};
    font-weight: 600;
}}

QLabel#warningLabel {{
    color: {COLORS["warning"]};
    font-weight: 600;
}}

/* Table row alternating colors */
QTableWidget::item:alternate {{
    background-color: {COLORS["surface_alt"]};
}}
"""


def apply_stylesheet(widget):
    """Apply the BOP Nutraceuticals stylesheet to a widget."""
    widget.setStyleSheet(get_stylesheet())
