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
from views.main_window import MainWindow
from controllers.auth_controller import AuthController
from database.connection import get_db
from database.migrations.migrator import run_migrations
from models.user import User
from utils.logger import get_logger
from views.login_view import LoginView
from views.main_window import MainWindow
from services.auto_backup import start_auto_backup, stop_auto_backup
from config.theme import get_stylesheet

logger = get_logger(__name__)

import atexit
from database.connection import close_db

import atexit

def cleanup():
    """Clean up on exit."""
    try:
        # Create backup before closing
        from database.auto_backup import auto_backup
        logger.info("Creating exit backup...")
        # auto_backup()
        logger.info("Exit backup created")
        
        logger.info("Closing database connections...")
        close_db()
        
        # Close all pooled SQLite Cloud connections
        try:
            from database.sqlitecloud_connection import SQLiteCloudConnection
            SQLiteCloudConnection.close_all()
            logger.info("SQLite Cloud connection pool closed")
        except Exception as e:
            logger.warning(f"Could not close connection pool: {e}")
        
        logger.info("Database connections closed")
    except Exception as e:
        logger.warning(f"Cleanup error: {e}")


atexit.register(cleanup)


class Application:
    def __init__(self) -> None:
        self.qt_app = QApplication(sys.argv)
        self.qt_app.setStyleSheet(get_stylesheet())
        
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
                logger.info("[OK] Database already initialized, skipping migrations")
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
