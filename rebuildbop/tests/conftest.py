"""Pytest configuration and fixtures."""
import pytest
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


@pytest.fixture(scope="session")
def test_config():
    """Test configuration fixture."""
    from config.app_config import DatabaseConfig
    
    return DatabaseConfig(
        min_connections=2,
        max_connections=5,
        connection_timeout=10,
        query_timeout=30,
        retry_attempts=2,
        slow_query_threshold_ms=50
    )


@pytest.fixture(autouse=True)
def reset_globals():
    """Reset global singletons between tests."""
    yield
    # Reset after each test
    from config.app_config import reset_config
    from utils.cache_manager import reset_cache_manager
    from database.transaction_manager import reset_transaction_manager
    
    reset_config()
    reset_cache_manager()
    reset_transaction_manager()
