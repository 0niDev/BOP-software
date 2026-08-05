"""Unit tests for the base repository."""
import pytest
import time
from unittest.mock import Mock, MagicMock, patch

# Import the classes to test
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from repositories.base_repository import BaseRepository
from utils.cache_manager import CacheManager, get_cache_manager, reset_cache_manager
from database.connection import DatabaseConnection


class TestEntityRepository(BaseRepository):
    """Test implementation of BaseRepository."""
    table_name = "test_entities"
    pk_column = "id"


@pytest.fixture
def mock_db():
    """Create a mock database connection."""
    db = Mock(spec=DatabaseConnection)
    db.fetch_one = Mock(return_value=None)
    db.fetch_all = Mock(return_value=[])
    db.execute = Mock(return_value=None)
    db.executemany = Mock(return_value=None)
    db.last_insert_id = Mock(return_value=1)
    return db


@pytest.fixture
def repository(mock_db):
    """Create a test repository instance."""
    return TestEntityRepository(db=mock_db)


@pytest.fixture
def sample_data():
    """Sample test data."""
    return {
        'id': 1,
        'name': 'Test Entity',
        'is_active': 1,
        'created_at': '2024-01-01'
    }


class TestBaseRepository:
    """Test cases for BaseRepository."""
    
    def test_init_requires_table_name(self):
        """Test that table_name must be defined."""
        class BadRepository(BaseRepository):
            pass
        
        with pytest.raises(ValueError, match="must define table_name"):
            BadRepository()
    
    def test_find_by_id_returns_none_when_not_found(self, repository, mock_db):
        """Test find_by_id returns None for non-existent record."""
        mock_db.fetch_one.return_value = None
        
        result = repository.find_by_id(999)
        
        assert result is None
        mock_db.fetch_one.assert_called_once()
    
    def test_find_by_id_returns_record_when_found(self, repository, mock_db, sample_data):
        """Test find_by_id returns record when found."""
        mock_db.fetch_one.return_value = sample_data
        
        result = repository.find_by_id(1)
        
        assert result == sample_data
        mock_db.fetch_one.assert_called_once_with(
            "SELECT * FROM test_entities WHERE id = ?", (1,)
        )
    
    def test_get_by_id_raises_on_not_found(self, repository, mock_db):
        """Test get_by_id raises RecordNotFoundError when not found."""
        from utils.exceptions import RecordNotFoundError
        mock_db.fetch_one.return_value = None
        
        with pytest.raises(RecordNotFoundError):
            repository.get_by_id(999)
    
    def test_find_by_ids_batch_operation(self, repository, mock_db):
        """Test find_by_ids uses single query for multiple IDs."""
        mock_db.fetch_all.return_value = [
            {'id': 1, 'name': 'Entity 1'},
            {'id': 2, 'name': 'Entity 2'},
            {'id': 3, 'name': 'Entity 3'}
        ]
        
        result = repository.find_by_ids([1, 2, 3])
        
        assert len(result) == 3
        # Verify single query was used
        mock_db.fetch_all.assert_called_once()
        call_args = mock_db.fetch_all.call_args[0][0]
        assert 'IN' in call_args  # Uses IN clause
    
    def test_find_by_ids_empty_list(self, repository, mock_db):
        """Test find_by_ids with empty list."""
        result = repository.find_by_ids([])
        
        assert result == []
        mock_db.fetch_all.assert_not_called()
    
    def test_insert_batch_reduces_round_trips(self, repository, mock_db):
        """Test insert_batch uses executemany for efficiency."""
        data_list = [
            {'name': 'Entity 1', 'is_active': 1},
            {'name': 'Entity 2', 'is_active': 1},
            {'name': 'Entity 3', 'is_active': 1}
        ]
        
        repository.insert_batch(data_list)
        
        mock_db.executemany.assert_called_once()
    
    def test_delete_batch_uses_single_query(self, repository, mock_db):
        """Test delete_batch uses single DELETE with IN clause."""
        ids = [1, 2, 3, 4, 5]
        
        repository.delete_batch(ids)
        
        mock_db.execute.assert_called_once()
        call_args = mock_db.execute.call_args[0][0]
        assert 'IN' in call_args
    
    def test_find_with_pagination_returns_correct_structure(self, repository, mock_db):
        """Test pagination returns correct structure."""
        mock_db.fetch_one.return_value = {'cnt': 100}
        mock_db.fetch_all.return_value = [{'id': i, 'name': f'Entity {i}'} for i in range(1, 51)]
        
        result = repository.find_with_pagination(page=1, page_size=50)
        
        assert 'items' in result
        assert 'total' in result
        assert 'page' in result
        assert 'page_size' in result
        assert 'total_pages' in result
        assert result['total'] == 100
        assert result['page'] == 1
        assert result['total_pages'] == 2
    
    def test_count_returns_integer(self, repository, mock_db):
        """Test count returns integer."""
        mock_db.fetch_one.return_value = {'cnt': 42}
        
        result = repository.count()
        
        assert result == 42
        assert isinstance(result, int)
    
    def test_update_invalidates_cache(self, repository, mock_db):
        """Test update invalidates cache."""
        repository.update(1, {'name': 'Updated'})
        
        mock_db.execute.assert_called_once()
    
    def test_deactivate_sets_is_active_to_zero(self, repository, mock_db):
        """Test deactivate sets is_active to 0."""
        repository.deactivate(1)
        
        mock_db.execute.assert_called_once()
        call_args = mock_db.execute.call_args[0]
        assert call_args[1]['is_active'] == 0
    
    def test_exists_returns_boolean(self, repository, mock_db):
        """Test exists returns boolean."""
        mock_db.fetch_one.side_effect = [
            {'id': 1},  # First call returns record
            None        # Second call returns None
        ]
        
        assert repository.exists(1) is True
        assert repository.exists(999) is False


class TestCachingBehavior:
    """Test caching behavior in BaseRepository."""
    
    def setup_method(self):
        """Reset cache before each test."""
        reset_cache_manager()
    
    def teardown_method(self):
        """Clean up after each test."""
        reset_cache_manager()
    
    def test_find_by_id_caches_result(self, repository, mock_db, sample_data):
        """Test that find_by_id caches results."""
        mock_db.fetch_one.return_value = sample_data
        
        # First call - should hit database
        result1 = repository.find_by_id(1)
        
        # Second call - should use cache
        result2 = repository.find_by_id(1)
        
        # Database should only be called once
        assert mock_db.fetch_one.call_count == 1
        assert result1 == result2 == sample_data
    
    def test_update_clears_cache_entry(self, repository, mock_db, sample_data):
        """Test that update clears cached entry."""
        mock_db.fetch_one.return_value = sample_data
        
        # Populate cache
        repository.find_by_id(1)
        
        # Update record
        repository.update(1, {'name': 'Updated'})
        
        # Next fetch should hit database
        mock_db.fetch_one.reset_mock()
        repository.find_by_id(1)
        
        assert mock_db.fetch_one.called


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
