"""
Cache management utilities for the ERP system.

Provides centralized cache control with three-tier caching strategy:
- L1: Per-repository instance cache (fastest, no locking)
- L2: Session-level shared cache (cross-repository sharing)
- L3: Global application-wide cache (expensive operations)

Also provides invalidation triggers and monitoring.
"""
from __future__ import annotations

import time
from typing import Any
from collections import OrderedDict
from functools import wraps

from utils.logger import get_logger

logger = get_logger(__name__)


class LRUCache:
    """Thread-safe LRU cache for global caching (L3)."""
    
    def __init__(self, maxsize: int = 1000):
        self._cache: OrderedDict = OrderedDict()
        self._maxsize = maxsize
        self._hits = 0
        self._misses = 0
    
    def get(self, key: str) -> Any | None:
        if key in self._cache:
            self._hits += 1
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            value, expires = self._cache[key]
            if expires is None or time.time() < expires:
                return value
            else:
                del self._cache[key]
        else:
            self._misses += 1
        return None
    
    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        expires = time.time() + ttl if ttl else None
        if key in self._cache:
            self._cache.move_to_end(key)
        self._cache[key] = (value, expires)
        
        # Evict oldest if over capacity
        while len(self._cache) > self._maxsize:
            self._cache.popitem(last=False)
    
    def delete(self, key: str) -> None:
        if key in self._cache:
            del self._cache[key]
    
    def clear(self) -> None:
        self._cache.clear()
        self._hits = 0
        self._misses = 0
    
    def stats(self) -> dict:
        total = self._hits + self._misses
        hit_ratio = (self._hits / total * 100) if total > 0 else 0
        return {
            "size": len(self._cache),
            "maxsize": self._maxsize,
            "hits": self._hits,
            "misses": self._misses,
            "hit_ratio": f"{hit_ratio:.1f}%"
        }


# L2 Session-level cache (shared across all repositories)
class SessionCache:
    """Session-level cache shared across all repository instances (L2)."""
    
    _instance: SessionCache | None = None
    
    def __new__(cls) -> SessionCache:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._cache: dict[str, tuple[Any, float]] = {}
            cls._instance._lock = False  # Simple flag for thread safety
        return cls._instance
    
    def get(self, key: str) -> Any | None:
        if key in self._cache:
            value, timestamp = self._cache[key]
            # Check TTL (default 60 seconds for L2)
            if time.time() - timestamp < 60:
                return value
            else:
                del self._cache[key]
        return None
    
    def set(self, key: str, value: Any, ttl: int = 60) -> None:
        self._cache[key] = (value, time.time())
    
    def delete(self, key: str) -> None:
        if key in self._cache:
            del self._cache[key]
    
    def clear(self) -> None:
        self._cache.clear()
    
    def clear_pattern(self, pattern: str) -> None:
        """Clear all keys matching a pattern."""
        keys_to_delete = [k for k in self._cache if pattern in k]
        for key in keys_to_delete:
            del self._cache[key]
    
    def stats(self) -> dict:
        return {"size": len(self._cache)}


# L3 Global cache for expensive operations
_global_cache = LRUCache(maxsize=1000)


def cached(cache: LRUCache = None, ttl: int = 300):
    """Decorator for caching expensive function results (L3 cache)."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Create cache key from function name and arguments
            key_parts = [func.__name__]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            cache_key = ":".join(key_parts)
            
            # Try to get from cache
            result = (cache or _global_cache).get(cache_key)
            if result is not None:
                logger.debug(f"Cache hit for {func.__name__}")
                return result
            
            # Compute and cache
            result = func(*args, **kwargs)
            (cache or _global_cache).set(cache_key, result, ttl=ttl)
            logger.debug(f"Cache miss for {func.__name__}, computed and cached")
            return result
        return wrapper
    return decorator


class CacheManager:
    """Centralized cache management for all repositories (L1, L2, L3)."""
    
    @staticmethod
    def clear_all() -> None:
        """Clear all repository caches (L1, L2, L3)."""
        from repositories.base_repository import BaseRepository
        BaseRepository.clear_all_cache()
        SessionCache()._instance.clear() if SessionCache._instance else None
        _global_cache.clear()
        logger.info("All caches (L1, L2, L3) cleared")
    
    @staticmethod
    def clear_l1() -> None:
        """Clear only L1 (repository instance) cache."""
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
        """Enable or disable L1 caching globally."""
        from repositories.base_repository import BaseRepository
        BaseRepository._cache_enabled = enabled
        logger.info(f"L1 caching {'enabled' if enabled else 'disabled'}")
    
    @staticmethod
    def set_ttl(seconds: int) -> None:
        """Set global L1 cache TTL in seconds."""
        from repositories.base_repository import BaseRepository
        BaseRepository._cache_ttl = seconds
        logger.info(f"L1 cache TTL set to {seconds} seconds")
    
    @staticmethod
    def get_stats() -> dict:
        """Get comprehensive cache statistics for all levels."""
        from repositories.base_repository import BaseRepository
        return {
            "l1_cached_entries": len(BaseRepository._cache),
            "l1_ttl_seconds": BaseRepository._cache_ttl,
            "l1_enabled": BaseRepository._cache_enabled,
            "l2_size": SessionCache().stats()["size"] if SessionCache._instance else 0,
            "l3_stats": _global_cache.stats(),
        }
    
    @staticmethod
    def get_l2_cache() -> SessionCache:
        """Get the L2 session cache instance."""
        return SessionCache()
    
    @staticmethod
    def get_l3_cache() -> LRUCache:
        """Get the L3 global cache instance."""
        return _global_cache


def invalidate_on_change(table_name: str, record_id: int | None = None) -> None:
    """
    Invalidate L1 and L2 cache when data changes.
    
    Args:
        table_name: Name of the table that changed
        record_id: Optional specific record ID that changed
    """
    from repositories.base_repository import BaseRepository
    
    # Invalidate L1 cache
    pattern = f"{table_name}:"
    keys_to_delete = [k for k in BaseRepository._cache if k.startswith(pattern)]
    for key in keys_to_delete:
        del BaseRepository._cache[key]
    
    # Invalidate L2 cache
    SessionCache().clear_pattern(pattern)
    
    if record_id:
        logger.debug(f"Cache invalidated for {table_name}:{record_id}")
    else:
        logger.debug(f"Cache invalidated for all {table_name}")


def invalidate_table_cache(table_name: str) -> None:
    """Convenience function to invalidate all cache for a table."""
    invalidate_on_change(table_name)
