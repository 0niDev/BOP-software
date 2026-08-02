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
os.environ['SQLITE_CLOUD_URL'] = 'sqlitecloud://cjja8z6pvz.g4.sqlite.cloud:8860/cool-depot.sqlite?apikey=bmJZ0l1RTFCoxS0Au17c0iofzZmrDn2Db94v0YtV9Uw'
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


APP_STYLESHEET = """
/* ============================================================
   GLOBAL STYLES
   ============================================================ */
QWidget {
    font-family: 'Segoe UI', 'Microsoft YaHei', Arial, sans-serif;
    font-size: 16px;
    color: #1a1a2e;
}

QMainWindow {
    background: #f0f2f5;
}

/* ============================================================
   SIDEBAR
   ============================================================ */
#sidebar {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #1a1a2e,
        stop:1 #16213e);
    border-right: 1px solid #0f3460;
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
        stop:0 #e94560,
        stop:1 #ff6b6b);
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
    background: rgba(233, 69, 96, 0.3);
}

/* ============================================================
   LOGIN CARD
   ============================================================ */
#loginCard {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #ffffff,
        stop:1 #f8f9fa);
    border: none;
    border-radius: 16px;
}

#loginCard QLabel {
    color: #1a1a2e;
}

#loginCard QLineEdit {
    background: #f8f9fa;
    border: 2px solid #e9ecef;
    border-radius: 10px;
    padding: 12px 16px;
    font-size: 13px;
}

#loginCard QLineEdit:focus {
    border-color: #e94560;
    background: #ffffff;
}

#loginCard QPushButton {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 #e94560,
        stop:1 #ff6b6b);
    color: #ffffff;
    border: none;
    border-radius: 10px;
    padding: 12px 24px;
    font-size: 14px;
    font-weight: bold;
}

#loginCard QPushButton:hover {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 #c73652,
        stop:1 #e94560);
}

/* ============================================================
   BUTTONS
   ============================================================ */
QPushButton {
    background: #e94560;
    color: #ffffff;
    border: none;
    border-radius: 8px;
    padding: 8px 18px;
    font-weight: 500;
    font-size: 12px;
}

QPushButton:hover {
    background: #c73652;
}

QPushButton:pressed {
    background: #a82d45;
}

QPushButton:disabled {
    background: #ced4da;
    color: #6c757d;
}

QPushButton#secondary {
    background: #e9ecef;
    color: #1a1a2e;
}

QPushButton#secondary:hover {
    background: #dee2e6;
}

QPushButton#success {
    background: #2ecc71;
}

QPushButton#success:hover {
    background: #27ae60;
}

QPushButton#danger {
    background: #e74c3c;
}

QPushButton#danger:hover {
    background: #c0392b;
}

/* ============================================================
   TABLES
   ============================================================ */
QTableWidget {
    background: #ffffff;
    border: 1px solid #e9ecef;
    border-radius: 12px;
    gridline-color: #f1f3f5;
    selection-background-color: #e94560;
    selection-color: #ffffff;
    alternate-background-color: #f8f9fa;
}

QTableWidget::item {
    padding: 8px 12px;
}

QTableWidget::item:selected {
    background: #e94560;
    color: #ffffff;
}

QHeaderView::section {
    background: #f8f9fa;
    color: #495057;
    padding: 10px 12px;
    border: none;
    border-bottom: 2px solid #e9ecef;
    font-weight: 600;
    font-size: 12px;
}

/* ============================================================
   INPUTS
   ============================================================ */
QLineEdit, QComboBox, QSpinBox, QDoubleSpinBox, QDateEdit {
    background: #ffffff;
    border: 2px solid #e9ecef;
    border-radius: 8px;
    padding: 8px 12px;
    min-height: 20px;
}

QLineEdit:focus, QComboBox:focus, QSpinBox:focus, QDoubleSpinBox:focus, QDateEdit:focus {
    border-color: #e94560;
}

QComboBox::drop-down {
    border: none;
    width: 20px;
}

QComboBox::down-arrow {
    image: none;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 5px solid #6c757d;
    margin-right: 8px;
}

/* ============================================================
   GROUP BOXES
   ============================================================ */
QGroupBox {
    background: #ffffff;
    border: 1px solid #e9ecef;
    border-radius: 12px;
    margin-top: 12px;
    padding-top: 8px;
}

QGroupBox::title {
    subcontrol-origin: margin;
    left: 16px;
    padding: 0 8px;
    color: #1a1a2e;
    font-weight: 600;
    font-size: 13px;
}

/* ============================================================
   TABS
   ============================================================ */
QTabWidget::pane {
    background: #ffffff;
    border: 1px solid #e9ecef;
    border-radius: 12px;
    padding: 8px;
}

QTabBar::tab {
    background: #f8f9fa;
    color: #495057;
    padding: 10px 20px;
    border: none;
    border-radius: 8px 8px 0 0;
    margin-right: 2px;
    font-weight: 500;
}

QTabBar::tab:selected {
    background: #e94560;
    color: #ffffff;
}

QTabBar::tab:hover:!selected {
    background: #e9ecef;
}

/* ============================================================
   SCROLLBARS
   ============================================================ */
QScrollBar:vertical {
    background: #f8f9fa;
    width: 10px;
    border-radius: 5px;
}

QScrollBar::handle:vertical {
    background: #ced4da;
    border-radius: 5px;
    min-height: 30px;
}

QScrollBar::handle:vertical:hover {
    background: #adb5bd;
}

QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    height: 0px;
}

QScrollBar:horizontal {
    background: #f8f9fa;
    height: 10px;
    border-radius: 5px;
}

QScrollBar::handle:horizontal {
    background: #ced4da;
    border-radius: 5px;
    min-width: 30px;
}

QScrollBar::handle:horizontal:hover {
    background: #adb5bd;
}

QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {
    width: 0px;
}

/* ============================================================
   STATUS BAR
   ============================================================ */
QStatusBar {
    background: #ffffff;
    border-top: 1px solid #e9ecef;
    color: #6c757d;
    padding: 4px 12px;
}

/* ============================================================
   TOOLBAR
   ============================================================ */
QToolBar {
    background: #ffffff;
    border: none;
    border-bottom: 1px solid #e9ecef;
    padding: 4px 8px;
    spacing: 4px;
}

QToolBar QPushButton {
    background: transparent;
    color: #495057;
    padding: 6px 12px;
    border-radius: 6px;
}

QToolBar QPushButton:hover {
    background: #f8f9fa;
}

QToolBar QPushButton:pressed {
    background: #e9ecef;
}

/* ============================================================
   DIALOGS
   ============================================================ */
QDialog {
    background: #f8f9fa;
}

QDialog QPushButton {
    min-width: 80px;
}

/* ============================================================
   MESSAGE BOXES
   ============================================================ */
QMessageBox {
    background: #ffffff;
}

QMessageBox QPushButton {
    min-width: 80px;
}

/* ============================================================
   KPI CARDS (Dashboard)
   ============================================================ */
QFrame#kpi-card {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #ffffff,
        stop:1 #fafafa);
    border: 1px solid #e9ecef;
    border-radius: 16px;
    padding: 20px;
}

QFrame#kpi-card:hover {
    border-color: #e94560;
}

.kpi-title {
    color: #6c757d;
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.kpi-value {
    font-size: 28px;
    font-weight: bold;
    margin-top: 4px;
}

/* ============================================================
   SECTION FRAMES
   ============================================================ */
QFrame#section-frame {
    background: #ffffff;
    border: 1px solid #e9ecef;
    border-radius: 12px;
    padding: 16px;
}

.section-title {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a2e;
    padding-bottom: 8px;
    border-bottom: 2px solid #f1f3f5;
}

/* ============================================================
   ALERTS
   ============================================================ */
.alert-success {
    background: #d4edda;
    color: #155724;
    border-left: 4px solid #28a745;
    padding: 10px 14px;
    border-radius: 8px;
}

.alert-warning {
    background: #fff3cd;
    color: #856404;
    border-left: 4px solid #ffc107;
    padding: 10px 14px;
    border-radius: 8px;
}

.alert-danger {
    background: #f8d7da;
    color: #721c24;
    border-left: 4px solid #dc3545;
    padding: 10px 14px;
    border-radius: 8px;
}
#sidebar QListWidget {
    background: transparent;
    color: #a8b2d1;
    border: none;
    outline: none;
    font-size: 13px;
    padding: 4px 0;
}

#sidebar QListWidget::item {
    padding: 10px 16px;
    border-radius: 8px;
    margin: 2px 8px;
    min-height: 36px;  /* ← ADD THIS - ensures consistent item height */
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
            # Check if users table exists
            try:
                db.fetch_one("SELECT 1 FROM users LIMIT 1")
                logger.info("✅ Database already initialized, skipping migrations")
                return
            except Exception:
                pass
            run_migrations(db)
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
