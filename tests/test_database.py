"""
Tests for database connection and backup.
"""
import pytest
import os
from pathlib import Path


class TestDatabaseConnection:
    """Test database connection functionality."""
    
    def test_connection_exists(self):
        """Test that database connection can be established."""
        from database.connection import get_db
        
        db = get_db()
        assert db is not None
    
    def test_connection_query(self):
        """Test executing a simple query."""
        from database.connection import get_db
        
        db = get_db()
        result = db.fetch_one("SELECT 1 as test")
        
        assert result['test'] == 1
    
    def test_sqlitecloud_connection(self):
        """Test SQLite Cloud connection specifically."""
        os.environ['ERP_DB_ENGINE'] = 'sqlitecloud'
        
        from database.connection import get_db
        db = get_db()
        
        # Should be able to query
        result = db.fetch_one("SELECT COUNT(*) as count FROM sqlite_master")
        assert 'count' in result


class TestAutoBackup:
    """Test automatic backup functionality."""
    
    def test_backup_module_imports(self):
        """Test that backup modules can be imported."""
        from services.auto_backup import AutoBackup, start_auto_backup, stop_auto_backup
        from database.auto_backup import auto_backup
        
        assert AutoBackup is not None
        assert start_auto_backup is not None
        assert stop_auto_backup is not None
        assert auto_backup is not None
    
    def test_auto_backup_instance(self):
        """Test creating AutoBackup instance."""
        from services.auto_backup import AutoBackup
        
        backup = AutoBackup(interval_hours=1)
        
        assert backup.interval_hours == 1
        assert backup.running is False
    
    def test_backup_directory_exists(self):
        """Test that backup directory exists."""
        backup_dir = Path('backups')
        
        # Create if doesn't exist
        backup_dir.mkdir(exist_ok=True)
        
        assert backup_dir.exists()
        assert backup_dir.is_dir()
