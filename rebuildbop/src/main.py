#!/usr/bin/env python3
"""
Main entry point for the Pharmaceutical ERP system.

This is the rebuilt version optimized for SQLite Cloud with:
- Connection pooling (10-50 connections)
- Multi-level caching (L1/L2)
- Batch operations for reduced round-trips
- Async UI operations
"""
from __future__ import annotations

import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt

from config.app_config import get_config
from database.connection import init_db, close_db
from utils.logger import get_logger

logger = get_logger(__name__)


def main():
    """Main application entry point."""
    # Parse command line arguments
    import argparse
    parser = argparse.ArgumentParser(description='Pharmaceutical ERP System')
    parser.add_argument('--init-db', action='store_true', help='Initialize database')
    parser.add_argument('--config', type=str, help='Path to config file')
    args = parser.parse_args()
    
    # Get configuration
    config = get_config()
    logger.info(f"Starting {config.app_name} v{config.app_version}")
    logger.info(f"Database engine: {config.database.engine}")
    logger.info(f"Connection pool: min={config.database.min_connections}, max={config.database.max_connections}")
    
    # Initialize database connection
    try:
        db = init_db()
        logger.info("Database connection initialized")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        print(f"\nError: Could not connect to database.\n")
        print(f"Please set SQLITE_CLOUD_URL environment variable:")
        print(f"  export SQLITE_CLOUD_URL='sqlitecloud://user:pass@host:port/dbname'\n")
        sys.exit(1)
    
    # Create Qt application
    app = QApplication(sys.argv)
    app.setApplicationName(config.app_name)
    app.setStyle('Fusion')
    
    # Set global font
    font = app.font()
    font.setPointSize(10)
    app.setFont(font)
    
    # TODO: Create and show main window
    # from views.main_window import MainWindow
    # window = MainWindow()
    # window.show()
    
    # For now, just show a message
    from PySide6.QtWidgets import QMessageBox
    QMessageBox.information(
        None,
        config.app_name,
        f"Welcome to {config.app_name}\n\n"
        f"Version: {config.app_version}\n"
        f"Database: {config.database.engine}\n\n"
        f"This is the rebuilt version optimized for SQLite Cloud.\n"
        f"Full UI implementation coming soon."
    )
    
    # Run application
    exit_code = app.exec()
    
    # Cleanup
    close_db()
    logger.info("Application shutdown complete")
    
    sys.exit(exit_code)


if __name__ == '__main__':
    main()
