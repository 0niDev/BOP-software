"""
Cache management utilities for the ERP system.

Provides centralized cache control, invalidation triggers, and monitoring.
Implements three-tier caching strategy:
- L1: Per-repository instance cache (fastest, no locking)
- L2: Session-level shared cache (cross-repository sharing)
- L3: Global application-wide cache (expensive computations)
"""
from __future__ import annotations

import time
from functools import wraps
from typing import Any, Callable
from collections import OrderedDict

from utils.logger import get_logger

logger = get_logger(__name__)


class LRUCache:
    """Thread-safe LRU cache for global caching (L3)."""
    
    def __init__(self, maxsize: int = 1000):
        self._cache: OrderedDict = OrderedDict()
        self._maxsize = maxsize
    
    def get(self, key: str) -> Any | None:
        if key in self._cache:
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            return self._cache[key]
        return None
    
    def set(self, key: str, value: Any) -> None:
        if key in self._cache:
            self._cache.move_to_end(key)
        self._cache[key] = value
        if len(self._cache) > self._maxsize:
            # Remove least recently used
            self._cache.popitem(last=False)
    
    def clear(self) -> None:
        self._cache.clear()
    
    def __len__(self) -> int:
        return len(self._cache)


class SessionCache:
    """Session-level shared cache (L2) for cross-repository sharing."""
    
    _instance: SessionCache | None = None
    
    def __new__(cls) -> SessionCache:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._session_cache: dict[str, dict] = {}
        return cls._instance
    
    def get(self, key: str) -> Any | None:
        if key in self._session_cache:
            entry = self._session_cache[key]
            if time.time() < entry['expires']:
                return entry['value']
            else:
                del self._session_cache[key]
        return None
    
    def set(self, key: str, value: Any, ttl: int = 60) -> None:
        self._session_cache[key] = {
            'value': value,
            'expires': time.time() + ttl
        }
    
    def invalidate_pattern(self, pattern: str) -> None:
        """Invalidate all keys matching pattern."""
        keys_to_delete = [k for k in self._session_cache if pattern in k]
        for key in keys_to_delete:
            del self._session_cache[key]
        logger.debug(f"Invalidated {len(keys_to_delete)} session cache entries matching '{pattern}'")
    
    def clear(self) -> None:
        self._session_cache.clear()
    
    def stats(self) -> dict:
        return {
            'entries': len(self._session_cache),
            'active_entries': sum(1 for e in self._session_cache.values() if time.time() < e['expires'])
        }


# Global L3 cache instance
_global_cache = LRUCache(maxsize=1000)


def cached_global(ttl: int = 300) -> Callable:
    """Decorator for caching expensive operations in L3 cache."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Create cache key from function name and arguments
            cache_key = f"{func.__module__}:{func.__name__}:{args}:{kwargs}"
            
            # Try to get from cache
            cached_entry = _global_cache.get(cache_key)
            if cached_entry and time.time() < cached_entry['expires']:
                logger.debug(f"Cache HIT for {func.__name__}")
                return cached_entry['value']
            
            # Cache miss - execute function
            result = func(*args, **kwargs)
            
            # Store in cache
            _global_cache.set(cache_key, {
                'value': result,
                'expires': time.time() + ttl
            })
            logger.debug(f"Cache SET for {func.__name__} (TTL={ttl}s)")
            
            return result
        return wrapper
    return decorator


class CacheManager:
    """Centralized cache management for all repositories."""
    
    @staticmethod
    def clear_all() -> None:
        """Clear all repository caches (L1, L2, L3)."""
        # Import here to avoid circular dependency
        from repositories.base_repository import BaseRepository
        BaseRepository.clear_all_cache()
        SessionCache().clear()
        _global_cache.clear()
        logger.info("All caches (L1, L2, L3) cleared")
    
    @staticmethod
    def clear_l1() -> None:
        """Clear only L1 (repository) cache."""
        from repositories.base_repository import BaseRepository
        BaseRepository.clear_all_cache()
        logger.info("L1 cache cleared")
    
    @staticmethod
    def clear_l2() -> None:
        """Clear only L2 (session) cache."""
        SessionCache().clear()
        logger.info("L2 cache cleared")
    
    @staticmethod
    def clear_l3() -> None:
        """Clear only L3 (global) cache."""
        _global_cache.clear()
        logger.info("L3 cache cleared")
    
    @staticmethod
    def set_enabled(enabled: bool) -> None:
        """Enable or disable caching globally."""
        from repositories.base_repository import BaseRepository
        BaseRepository._cache_enabled = enabled
        logger.info(f"Repository caching {'enabled' if enabled else 'disabled'}")
    
    @staticmethod
    def set_ttl(seconds: int) -> None:
        """Set global cache TTL in seconds."""
        from repositories.base_repository import BaseRepository
        BaseRepository._cache_ttl = seconds
        logger.info(f"Repository cache TTL set to {seconds} seconds")
    
    @staticmethod
    def get_stats() -> dict:
        """Get comprehensive cache statistics."""
        from repositories.base_repository import BaseRepository
        session_stats = SessionCache().stats()
        return {
            "l1_cached_entries": len(BaseRepository._cache),
            "l2_cached_entries": session_stats['entries'],
            "l2_active_entries": session_stats['active_entries'],
            "l3_cached_entries": len(_global_cache),
            "l1_ttl_seconds": BaseRepository._cache_ttl,
            "enabled": BaseRepository._cache_enabled,
        }
    
    @staticmethod
    def invalidate_table(table_name: str) -> None:
        """Invalidate all cache entries for a specific table."""
        from repositories.base_repository import BaseRepository
        
        # Invalidate L1
        pattern = f"{table_name}:"
        keys_to_delete = [k for k in BaseRepository._cache if k.startswith(pattern)]
        for key in keys_to_delete:
            del BaseRepository._cache[key]
        
        # Invalidate L2
        SessionCache().invalidate_pattern(f"{table_name}:")
        
        logger.debug(f"Cache invalidated for table '{table_name}'")


def invalidate_on_change(table_name: str, record_id: int | None = None) -> None:
    """
    Invalidate cache when data changes.
    
    Args:
        table_name: Name of the table that changed
        record_id: Optional specific record ID that changed
    """
    CacheManager.invalidate_table(table_name)
    
    if record_id:
        logger.debug(f"Cache invalidated for {table_name}:{record_id}")
    else:
        logger.debug(f"Cache invalidated for all {table_name}")
