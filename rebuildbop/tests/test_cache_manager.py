"""Unit tests for the cache manager."""
import pytest
import time
from unittest.mock import Mock, patch

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from utils.cache_manager import L1Cache, L2Cache, CacheManager, get_cache_manager, reset_cache_manager


class TestL1Cache:
    """Test cases for L1 in-memory cache."""
    
    def test_get_returns_none_for_missing_key(self):
        """Test that get returns None for non-existent key."""
        cache = L1Cache()
        assert cache.get("nonexistent") is None
    
    def test_set_and_get(self):
        """Test basic set and get operations."""
        cache = L1Cache()
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"
    
    def test_lru_eviction(self):
        """Test LRU eviction when cache is full."""
        cache = L1Cache(max_size=3)
        
        # Fill cache
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        cache.set("key3", "value3")
        
        # Access key1 to make it recently used
        cache.get("key1")
        
        # Add new key - should evict key2 (least recently used)
        cache.set("key4", "value4")
        
        # key2 should be evicted
        assert cache.get("key2") is None
        
        # Other keys should still exist
        assert cache.get("key1") == "value1"
        assert cache.get("key3") == "value3"
        assert cache.get("key4") == "value4"
    
    def test_expiration(self):
        """Test TTL-based expiration."""
        cache = L1Cache(default_ttl=1)  # 1 second TTL
        
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"
        
        # Wait for expiration
        time.sleep(1.1)
        
        # Should be expired
        assert cache.get("key1") is None
    
    def test_delete(self):
        """Test delete operation."""
        cache = L1Cache()
        cache.set("key1", "value1")
        
        assert cache.delete("key1") is True
        assert cache.get("key1") is None
        assert cache.delete("key1") is False  # Already deleted
    
    def test_clear(self):
        """Test clear operation."""
        cache = L1Cache()
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        
        cache.clear()
        
        assert cache.get("key1") is None
        assert cache.get("key2") is None
    
    def test_clear_pattern(self):
        """Test pattern-based clearing."""
        cache = L1Cache()
        cache.set("accounts:1", {"id": 1})
        cache.set("accounts:2", {"id": 2})
        cache.set("parties:1", {"id": 1})
        
        count = cache.clear_pattern("accounts")
        
        assert count == 2
        assert cache.get("accounts:1") is None
        assert cache.get("accounts:2") is None
        assert cache.get("parties:1") is not None
    
    def test_stats_tracking(self):
        """Test statistics tracking."""
        cache = L1Cache()
        
        cache.set("key1", "value1")
        cache.get("key1")  # Hit
        cache.get("key1")  # Hit
        cache.get("nonexistent")  # Miss
        
        stats = cache.get_stats()
        
        assert stats['hits'] == 2
        assert stats['misses'] == 1
        assert stats['size'] == 1


class TestL2Cache:
    """Test cases for L2 disk-based cache."""
    
    @pytest.fixture
    def temp_db_path(self, tmp_path):
        """Create temporary database path."""
        return str(tmp_path / "test_cache.db")
    
    def test_get_returns_none_for_missing_key(self, temp_db_path):
        """Test that get returns None for non-existent key."""
        cache = L2Cache(temp_db_path)
        assert cache.get("nonexistent") is None
    
    def test_set_and_get(self, temp_db_path):
        """Test basic set and get operations."""
        cache = L2Cache(temp_db_path)
        cache.set("key1", {"name": "test"})
        result = cache.get("key1")
        assert result == {"name": "test"}
    
    def test_persistence_across_instances(self, temp_db_path):
        """Test that data persists across cache instances."""
        # Create cache and set value
        cache1 = L2Cache(temp_db_path)
        cache1.set("key1", "persistent_value")
        
        # Create new cache instance
        cache2 = L2Cache(temp_db_path)
        
        # Value should still be there
        assert cache2.get("key1") == "persistent_value"
    
    def test_expiration(self, temp_db_path):
        """Test TTL-based expiration."""
        cache = L2Cache(temp_db_path, default_ttl=1)
        
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"
        
        time.sleep(1.1)
        
        assert cache.get("key1") is None
    
    def test_delete(self, temp_db_path):
        """Test delete operation."""
        cache = L2Cache(temp_db_path)
        cache.set("key1", "value1")
        
        assert cache.delete("key1") is True
        assert cache.get("key1") is None


class TestCacheManager:
    """Test cases for unified CacheManager."""
    
    def setup_method(self):
        """Reset cache before each test."""
        reset_cache_manager()
    
    def teardown_method(self):
        """Clean up after each test."""
        reset_cache_manager()
    
    def test_get_miss_returns_none(self):
        """Test cache miss returns None."""
        manager = CacheManager()
        assert manager.get("test", "key") is None
    
    def test_write_through_caching(self):
        """Test write-through caching to both L1 and L2."""
        manager = CacheManager()
        
        manager.set("test", {"data": "value"}, key="mykey")
        
        # Should be retrievable
        result = manager.get("test", "mykey")
        assert result == {"data": "value"}
    
    def test_invalidation_by_pattern(self):
        """Test pattern-based invalidation."""
        manager = CacheManager()
        
        manager.set("accounts", {"id": 1}, id="1")
        manager.set("accounts", {"id": 2}, id="2")
        manager.set("parties", {"id": 1}, id="1")
        
        count = manager.invalidate("accounts")
        
        assert count >= 2
        assert manager.get("accounts", "1") is None
        assert manager.get("accounts", "2") is None
    
    def test_l1_populated_from_l2_on_hit(self):
        """Test that L1 is populated when L2 has a hit."""
        manager = CacheManager()
        
        # Set value (goes to both L1 and L2)
        manager.set("test", "value", key="key1")
        
        # Clear L1 only
        manager._l1_cache.clear()
        
        # Get should hit L2 and repopulate L1
        result = manager.get("test", "key1")
        assert result == "value"
        
        # Next get should hit L1
        l1_stats = manager._l1_cache.get_stats()
        assert l1_stats['hits'] >= 1


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
