"""
Test fixtures and utilities.
"""
import os
import sys
import pytest

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Set environment variables for testing
os.environ['ERP_DB_ENGINE'] = 'sqlitecloud'
os.environ['SQLITE_CLOUD_URL'] = 'sqlitecloud://cjja8z6pvz.g4.sqlite.cloud:8860/cool-depot.sqlite?apikey=bmJZ0l1RTFCoxS0Au17c0iofzZmrDn2Db94v0YtV9Uw'


@pytest.fixture(scope="session")
def test_db():
    """Get database connection for tests."""
    from database.connection import get_db
    db = get_db()
    yield db


@pytest.fixture
def sample_party_data():
    """Sample party data for testing."""
    return {
        'name': 'Test Customer',
        'code': 'TEST001',
        'party_type': 'CUSTOMER',
        'is_active': 1,
        'contact_number': '1234567890',
        'email': 'test@example.com',
        'address': 'Test Address'
    }


@pytest.fixture
def sample_item_data():
    """Sample item data for testing."""
    return {
        'name': 'Test Item',
        'code': 'ITEM001',
        'unit_of_measure': 'PCS',
        'is_active': 1,
        'standard_rate': 100.00,
        'tax_rate_id': 1
    }


@pytest.fixture
def sample_account_data():
    """Sample account data for testing."""
    return {
        'account_name': 'Test Account',
        'account_code': 'TEST001',
        'account_type': 'ASSET',
        'is_active': 1,
        'parent_account_id': None
    }


@pytest.fixture
def cleanup():
    """Cleanup fixture to remove test data."""
    created_ids = []
    
    def _cleanup(table, record_id):
        created_ids.append((table, record_id))
    
    yield _cleanup
    
    # Cleanup after test
    from database.connection import get_db
    db = get_db()
    for table, record_id in reversed(created_ids):
        try:
            db.execute(f"DELETE FROM {table} WHERE id = ?", (record_id,))
        except Exception:
            pass  # Ignore cleanup errors
