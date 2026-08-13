"""
Application entry point.

Startup sequence:
  1. Configure logging.
  2. Open the database connection and run migrations (idempotent --
     safe to run on every launch).
  3. Show the login window.
  4. On successful login, open the main window.
"""
from __future__ import annotations

import sys
import os
os.environ['ERP_DB_ENGINE'] = 'sqlitecloud'
os.environ['SQLITE_CLOUD_URL'] = 'sqlitecloud://cjja8z6pvz.g4.sqlite.cloud:8860/flint-sync.sqlite?apikey=bmJZ0l1RTFCoxS0Au17c0iofzZmrDn2Db94v0YtV9Uw'
from PySide6.QtWidgets import QApplication
from PySide6.QtGui import QFont
from views.main_window import MainWindow   # ← ADD THIS LINE
from controllers.auth_controller import AuthController
from database.connection import get_db
from database.migrations.migrator import run_migrations
from models.user import User
from utils.logger import get_logger
from views.login_view import LoginView
from views.main_window import MainWindow
from services.auto_backup import start_auto_backup, stop_auto_backup

logger = get_logger(__name__)

import atexit
from database.connection import close_db

import atexit

def cleanup():
    """Clean up on exit."""
    try:
        # Create backup before closing
        from database.auto_backup import auto_backup
        logger.info("🔄 Creating exit backup...")
        auto_backup()
        logger.info("✅ Exit backup created")
        
        logger.info("🔄 Closing database connections...")
        close_db()
        
        # Close all pooled SQLite Cloud connections
        try:
            from database.sqlitecloud_connection import SQLiteCloudConnection
            SQLiteCloudConnection.close_all()
            logger.info("✅ SQLite Cloud connection pool closed")
        except Exception as e:
            logger.warning(f"Could not close connection pool: {e}")
        
        logger.info("✅ Database connections closed")
    except Exception as e:
        logger.warning(f"Cleanup error: {e}")


atexit.register(cleanup)


# ============================================================
#   BLACK THEME - Global QSS stylesheet
# ============================================================
APP_STYLESHEET = """
/* ============================================================
   GLOBAL STYLES
   ============================================================ */
QWidget {
    font-family: 'Segoe UI', 'Microsoft YaHei', Arial, sans-serif;
    font-size: 16px;
    color: #e0e0e0;
}

QMainWindow {
    background: #0c0c0c;
}

QScrollArea, QStackedWidget {
    background: #0c0c0c;
}

QScrollArea > QWidget > QWidget {
    background: #0c0c0c;
}

QWidget:tooltip {
    background: #222222;
    color: #e0e0e0;
    border: 1px solid #3a3a3a;
}

/* ============================================================
   SIDEBAR
   ============================================================ */
#sidebar {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #000000,
        stop:1 #151515);
    border-right: 1px solid #2a2a2a;
}

#sidebar QLabel {
    color: #ffffff;
    font-size: 14px;
    font-weight: bold;
    padding: 12px 16px;
}

#sidebar QListWidget {
    background: transparent;
    color: #a8b2d1;
    border: none;
    outline: none;
    font-size: 13px;
}

#sidebar QListWidget::item {
    padding: 10px 16px;
    border-radius: 8px;
    margin: 2px 8px;
}

#sidebar QListWidget::item:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
}

#sidebar QListWidget::item:selected {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 #8B1A2B,
        stop:1 #A83248);
    color: #ffffff;
}

#sidebar QPushButton {
    background: rgba(255, 255, 255, 0.08);
    color: #a8b2d1;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 10px 16px;
    margin: 4px 12px 12px 12px;
    font-weight: 500;
}

#sidebar QPushButton:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #ffffff;
}

#sidebar QPushButton:pressed {
    background: rgba(139, 26, 43, 0.35);
}

/* ============================================================
   LOGIN CARD
   ============================================================ */
#loginCard {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #1c1c1c,
        stop:1 #141414);
    border: 1px solid #2a2a2a;
    border-radius: 16px;
}

#loginCard QLabel {
    color: #e0e0e0;
}

#loginCard QLineEdit {
    background: #222222;
    border: 1px solid #3a3a3a;
    border-radius: 10px;
    padding: 12px 16px;
    font-size: 13px;
    color: #e0e0e0;
}

#loginCard QLineEdit:focus {
    border-color: #8B1A2B;
    background: #262626;
}

#loginCard QPushButton {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 #8B1A2B,
        stop:1 #A83248);
    color: #ffffff;
    border: none;
    border-radius: 10px;
    padding: 12px 24px;
    font-size: 14px;
    font-weight: bold;
}

#loginCard QPushButton:hover {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 #701320,
        stop:1 #8B1A2B);
}

/* ============================================================
   BUTTONS
   ============================================================ */
QPushButton {
    background: #2b2b2b;
    color: #e0e0e0;
    border: 1px solid #3a3a3a;
    border-radius: 8px;
    padding: 8px 18px;
    font-weight: 500;
    font-size: 12px;
}

QPushButton:hover {
    background: #363636;
    border-color: #4a4a4a;
}

QPushButton:pressed {
    background: #242424;
}

QPushButton:disabled {
    background: #1f1f1f;
    color: #6c757d;
    border-color: #2a2a2a;
}

QPushButton#primary {
    background: #3498db;
    border-color: #3498db;
    color: #ffffff;
}

QPushButton#primary:hover {
    background: #2980b9;
    border-color: #2980b9;
}

QPushButton#accent {
    background: #8B1A2B;
    border-color: #8B1A2B;
    color: #ffffff;
}

QPushButton#accent:hover {
    background: #701320;
    border-color: #701320;
}

QPushButton#secondary {
    background: transparent;
    color: #adb5bd;
    border: 1px solid #3a3a3a;
}

QPushButton#secondary:hover {
    background: #2b2b2b;
    color: #e0e0e0;
}

QPushButton#success {
    background: #27ae60;
    border-color: #27ae60;
    color: #ffffff;
}

QPushButton#success:hover {
    background: #219653;
    border-color: #219653;
}

QPushButton#danger {
    background: #e74c3c;
    border-color: #e74c3c;
    color: #ffffff;
}

QPushButton#danger:hover {
    background: #c0392b;
    border-color: #c0392b;
}

/* ============================================================
   TABLES
   ============================================================ */
QTableWidget {
    background: #161616;
    border: 1px solid #2a2a2a;
    border-radius: 12px;
    gridline-color: #262626;
    selection-background-color: #8B1A2B;
    selection-color: #ffffff;
    alternate-background-color: #1b1b1b;
    color: #e0e0e0;
}

QTableWidget::item {
    padding: 8px 12px;
    color: #e0e0e0;
}

QTableWidget::item:selected {
    background: #8B1A2B;
    color: #ffffff;
}

QHeaderView::section {
    background: #1f1f1f;
    color: #adb5bd;
    padding: 10px 12px;
    border: none;
    border-bottom: 2px solid #2a2a2a;
    font-weight: 600;
    font-size: 12px;
}

QTableCornerButton::section {
    background: #1f1f1f;
    border: none;
}

/* ============================================================
   INPUTS
   ============================================================ */
QLineEdit, QComboBox, QSpinBox, QDoubleSpinBox, QDateEdit, QTextEdit, QPlainTextEdit {
    background: #222222;
    border: 1px solid #3a3a3a;
    border-radius: 8px;
    padding: 8px 12px;
    min-height: 20px;
    color: #e0e0e0;
    selection-background-color: #8B1A2B;
    selection-color: #ffffff;
}

QLineEdit:focus, QComboBox:focus, QSpinBox:focus, QDoubleSpinBox:focus,
QDateEdit:focus, QTextEdit:focus, QPlainTextEdit:focus {
    border-color: #8B1A2B;
}

QLineEdit:disabled, QComboBox:disabled {
    background: #1a1a1a;
    color: #6c757d;
}

QComboBox::drop-down {
    border: none;
    width: 20px;
}

QComboBox::down-arrow {
    image: none;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 5px solid #adb5bd;
    margin-right: 8px;
}

QComboBox QAbstractItemView {
    background: #222222;
    color: #e0e0e0;
    border: 1px solid #3a3a3a;
    selection-background-color: #8B1A2B;
    selection-color: #ffffff;
}

QAbstractSpinBox::up-button, QAbstractSpinBox::down-button {
    background: #2b2b2b;
    border: none;
}

QCalendarWidget QWidget {
    alternate-background-color: #222222;
    background: #1a1a1a;
    color: #e0e0e0;
}

/* ============================================================
   GROUP BOXES
   ============================================================ */
QGroupBox {
    background: #161616;
    border: 1px solid #2a2a2a;
    border-radius: 12px;
    margin-top: 12px;
    padding-top: 8px;
    color: #e0e0e0;
}

QGroupBox::title {
    subcontrol-origin: margin;
    left: 16px;
    padding: 0 8px;
    color: #adb5bd;
    font-weight: 600;
    font-size: 13px;
}

/* ============================================================
   TABS
   ============================================================ */
QTabWidget::pane {
    background: #161616;
    border: 1px solid #2a2a2a;
    border-radius: 12px;
    padding: 8px;
}

QTabBar::tab {
    background: #1f1f1f;
    color: #adb5bd;
    padding: 10px 20px;
    border: none;
    border-radius: 8px 8px 0 0;
    margin-right: 2px;
    font-weight: 500;
}

QTabBar::tab:selected {
    background: #8B1A2B;
    color: #ffffff;
}

QTabBar::tab:hover:!selected {
    background: #2b2b2b;
    color: #e0e0e0;
}

/* ============================================================
   SCROLLBARS
   ============================================================ */
QScrollBar:vertical {
    background: #1a1a1a;
    width: 10px;
    border-radius: 5px;
}

QScrollBar::handle:vertical {
    background: #3a3a3a;
    border-radius: 5px;
    min-height: 30px;
}

QScrollBar::handle:vertical:hover {
    background: #4a4a4a;
}

QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    height: 0px;
}

QScrollBar:horizontal {
    background: #1a1a1a;
    height: 10px;
    border-radius: 5px;
}

QScrollBar::handle:horizontal {
    background: #3a3a3a;
    border-radius: 5px;
    min-width: 30px;
}

QScrollBar::handle:horizontal:hover {
    background: #4a4a4a;
}

QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {
    width: 0px;
}

/* ============================================================
   STATUS BAR
   ============================================================ */
QStatusBar {
    background: #141414;
    border-top: 1px solid #2a2a2a;
    color: #adb5bd;
    padding: 4px 12px;
}

QStatusBar QLabel {
    color: #adb5bd;
}

QStatusBar::item {
    border: none;
}

/* ============================================================
   TOOLBAR
   ============================================================ */
QToolBar {
    background: #141414;
    border: none;
    border-bottom: 1px solid #2a2a2a;
    padding: 4px 8px;
    spacing: 4px;
}

QToolBar QPushButton {
    background: transparent;
    color: #adb5bd;
    padding: 6px 12px;
    border-radius: 6px;
}

QToolBar QPushButton:hover {
    background: #2b2b2b;
    color: #ffffff;
}

QToolBar QPushButton:pressed {
    background: #333333;
}

/* ============================================================
   DIALOGS
   ============================================================ */
QDialog {
    background: #121212;
}

QDialog QLabel {
    color: #e0e0e0;
}

/* ============================================================
   MESSAGE BOXES
   ============================================================ */
QMessageBox {
    background: #1a1a1a;
}

QMessageBox QLabel {
    color: #e0e0e0;
}

/* ============================================================
   KPI CARDS (Dashboard)
   ============================================================ */
QFrame#kpi-card {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #1f1f1f,
        stop:1 #1a1a1a);
    border: 1px solid #2a2a2a;
    border-radius: 14px;
    padding: 16px 18px;
}

QFrame#kpi-card:hover {
    border-color: #8B1A2B;
}

QLabel#kpi-title {
    color: #adb5bd;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.6px;
}

QLabel#kpi-value {
    font-size: 24px;
    font-weight: bold;
    color: #e0e0e0;
}

QLabel#kpi-sub {
    color: #6c757d;
    font-size: 11px;
}

/* ============================================================
   SECTION FRAMES
   ============================================================ */
QFrame#section-frame {
    background: #161616;
    border: 1px solid #2a2a2a;
    border-radius: 12px;
    padding: 16px;
}

QLabel#section-title {
    font-size: 13px;
    font-weight: 600;
    color: #e0e0e0;
    padding-bottom: 8px;
    border-bottom: 1px solid #2a2a2a;
}

QFrame#sub-card {
    background: #1f1f1f;
    border: 1px solid #2a2a2a;
    border-radius: 10px;
    padding: 10px 14px;
}

/* ============================================================
   ALERTS
   ============================================================ */
QFrame#alert-success {
    background: #123a24;
    border-left: 4px solid #28a745;
    border-radius: 8px;
    padding: 8px 12px;
}

QFrame#alert-warning {
    background: #3a3114;
    border-left: 4px solid #ffc107;
    border-radius: 8px;
    padding: 8px 12px;
}

QFrame#alert-danger {
    background: #3a1a1a;
    border-left: 4px solid #dc3545;
    border-radius: 8px;
    padding: 8px 12px;
}

QFrame#alert-success QLabel,
QFrame#alert-warning QLabel,
QFrame#alert-danger QLabel {
    background: transparent;
    border: none;
}

QFrame#alert-success QLabel#alert-title {
    color: #7ee2a8;
    font-weight: 600;
    font-size: 12px;
}

QFrame#alert-warning QLabel#alert-title {
    color: #f5c26b;
    font-weight: 600;
    font-size: 12px;
}

QFrame#alert-danger QLabel#alert-title {
    color: #f08a8a;
    font-weight: 600;
    font-size: 12px;
}

QFrame#alert-success QLabel#alert-msg,
QFrame#alert-warning QLabel#alert-msg,
QFrame#alert-danger QLabel#alert-msg {
    color: #adb5bd;
    font-size: 11px;
}

/* ============================================================
   CHART THEME (QtCharts)
   ============================================================ */
QChartView {
    background: transparent;
    border: none;
}

/* ============================================================
   HELP BUTTON
   ============================================================ */
QPushButton#helpButton {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 #8B1A2B,
        stop:1 #A83248);
    color: #ffffff;
    border: none;
    border-radius: 14px;
    font-weight: bold;
    font-size: 14px;
    min-width: 30px;
    max-width: 34px;
    min-height: 26px;
    max-height: 26px;
}

QPushButton#helpButton:hover {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 #A83248,
        stop:1 #C44A63);
}
"""


class Application:
    def __init__(self) -> None:
        self.qt_app = QApplication(sys.argv)
        self.qt_app.setStyleSheet(APP_STYLESHEET)
        
        # Set font - NO setPointSize
        font = QFont("Segoe UI", 16)
        self.qt_app.setFont(font)
        
        self.auth_controller = AuthController()
        self.login_view: LoginView | None = None
        self.main_window: MainWindow | None = None
        
        # Start auto-backup
        logger.info("Starting auto-backup service...")
        start_auto_backup(interval_hours=24)
    def run(self) -> int:
        try:
            logger.info("Starting application...")
            self._initialize_database()
            self._show_login()

            return self.qt_app.exec()
        except Exception as e:
            logger.exception("Fatal error: %s", e)
            return 1
        finally:
            # Clean shutdown - stop auto-backup
            logger.info("Shutting down auto-backup service...")
            stop_auto_backup()

    def _initialize_database(self) -> None:
        try:
            db = get_db()
            # Eagerly open a few pooled connections in the background so the
            # first UI queries don't pay the TCP/TLS handshake latency.
            try:
                import threading
                from database.connection import get_pool
                threading.Thread(target=lambda: get_pool().warm_up(count=3), daemon=True).start()
            except Exception:
                pass
            # Check if users table exists
            try:
                db.fetch_one("SELECT 1 FROM users LIMIT 1")
                logger.info("✅ Database already initialized, skipping migrations")
                # Idempotent column migration - runs on existing databases too
                from database.migrations.add_material_cost_columns import run_column_migration
                run_column_migration(db)
                from database.migrations.add_expense_items import run_expense_items_migration
                run_expense_items_migration(db)
                return
            except Exception:
                pass
            run_migrations(db)
            # Idempotent column migration - ensures new cost columns/accounts exist
            from database.migrations.add_material_cost_columns import run_column_migration
            run_column_migration(db)
            from database.migrations.add_expense_items import run_expense_items_migration
            run_expense_items_migration(db)
        except Exception:
            logger.exception("Fatal error initializing database")
            raise
    def _show_login(self) -> None:
        self.login_view = LoginView(self.auth_controller)
        self.login_view.login_successful.connect(self._on_login_successful)
        self.login_view.show()
    from PySide6.QtCore import QTimer  # ← Add this impo
    def _on_login_successful(self, user: User) -> None:
        # Create main window but don't load data yet
        self.main_window = MainWindow(user, self.auth_controller, lazy_load=True)
        self.main_window.show()  # ← Show IMMEDIATELY
        
        if self.login_view:
            self.login_view.close()
            self.login_view = None
        
        # Load data AFTER window is shown


def main() -> int:
    app = Application()
    return app.run()


if __name__ == "__main__":
    sys.exit(main())