"""
Tests for caching system.
"""
import pytest
import time
from utils.cache_manager import SessionCache, LRUCache, invalidate_on_change


class TestSessionCache:
    """Test L2 session-level cache."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.cache = SessionCache()
    
    def test_set_and_get(self):
        """Test basic set and get operations."""
        self.cache.set('test_key', 'test_value')
        
        value = self.cache.get('test_key')
        assert value == 'test_value'
    
    def test_ttl_expiration(self):
        """Test that cache entries expire after TTL."""
        self.cache.set('expiring_key', 'value', ttl=1)
        
        # Should exist immediately
        assert self.cache.get('expiring_key') == 'value'
        
        # Wait for expiration
        time.sleep(1.5)
        
        # Should be expired
        assert self.cache.get('expiring_key') is None
    
    def test_clear(self):
        """Test clearing the cache."""
        self.cache.set('key1', 'value1')
        self.cache.set('key2', 'value2')
        
        self.cache.clear()
        
        assert self.cache.get('key1') is None
        assert self.cache.get('key2') is None


class TestLRUCache:
    """Test L3 global LRU cache."""
    
    def test_lru_eviction(self):
        """Test LRU eviction when max size reached."""
        cache = LRUCache(maxsize=3)
        
        # Add 4 items to a cache with maxsize 3
        cache.set('key1', 'value1')
        cache.set('key2', 'value2')
        cache.set('key3', 'value3')
        cache.set('key4', 'value4')
        
        # First key should be evicted (LRU)
        assert cache.get('key1') is None
        assert cache.get('key4') == 'value4'
    
    def test_ttl_in_lru_cache(self):
        """Test TTL functionality in LRU cache."""
        cache = LRUCache(maxsize=10)
        
        cache.set('expiring', 'value', ttl=1)
        assert cache.get('expiring') == 'value'
        
        time.sleep(1.5)
        assert cache.get('expiring') is None


class TestCacheInvalidation:
    """Test cache invalidation patterns."""
    
    def test_invalidate_on_change(self):
        """Test that invalidate_on_change clears related cache."""
        from repositories.base_repository import BaseRepository
        
        # Set some cache
        BaseRepository._cache['parties:test_key'] = ('value', time.time())
        
        # Invalidate
        invalidate_on_change('parties')
        
        # Cache should be cleared
        assert 'parties:test_key' not in BaseRepository._cache
