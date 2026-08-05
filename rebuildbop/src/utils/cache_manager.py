"""
Multi-level cache system for optimal performance.

L1 Cache: In-memory (LRU), fastest access (~microseconds)
L2 Cache: Disk-based SQLite, shared across processes (~milliseconds)  
L3 Cache: Distributed Redis (optional), shared across nodes

Features:
- Write-through caching
- Automatic invalidation on writes
- TTL-based expiration
- LRU eviction for L1
- Batch invalidation support
"""
from __future__ import annotations

import hashlib
import json
import sqlite3
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from config.app_config import CacheConfig, get_config
from utils.exceptions import CacheError
from utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class CacheEntry:
    """Cache entry with metadata."""
    value: Any
    created_at: float = field(default_factory=time.time)
    expires_at: Optional[float] = None
    access_count: int = 0
    last_accessed: float = field(default_factory=time.time)
    
    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return time.time() > self.expires_at
    
    def touch(self):
        self.access_count += 1
        self.last_accessed = time.time()


class L1Cache:
    """
    In-memory LRU cache (Level 1).
    
    Fastest cache layer, per-process.
    """
    
    def __init__(self, max_size: int = 10000, default_ttl: int = 60):
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._lock = threading.RLock()
        self._stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0,
            'expirations': 0,
        }
        self._stats_lock = threading.Lock()
    
    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key not in self._cache:
                with self._stats_lock:
                    self._stats['misses'] += 1
                return None
            
            entry = self._cache[key]
            
            # Check expiration
            if entry.is_expired():
                del self._cache[key]
                with self._stats_lock:
                    self._stats['expirations'] += 1
                return None
            
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            entry.touch()
            
            with self._stats_lock:
                self._stats['hits'] += 1
            
            return entry.value
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        ttl = ttl or self._default_ttl
        expires_at = time.time() + ttl if ttl > 0 else None
        
        with self._lock:
            # Check if we need to evict
            if key not in self._cache and len(self._cache) >= self._max_size:
                # Evict oldest (least recently used)
                self._cache.popitem(last=False)
                with self._stats_lock:
                    self._stats['evictions'] += 1
            
            self._cache[key] = CacheEntry(
                value=value,
                expires_at=expires_at
            )
    
    def delete(self, key: str) -> bool:
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False
    
    def clear(self) -> None:
        with self._lock:
            self._cache.clear()
    
    def clear_pattern(self, pattern: str) -> int:
        """Clear all keys matching a pattern."""
        with self._lock:
            keys_to_delete = [k for k in self._cache if pattern in k]
            for key in keys_to_delete:
                del self._cache[key]
            return len(keys_to_delete)
    
    def get_stats(self) -> dict:
        with self._stats_lock:
            stats = self._stats.copy()
        
        with self._lock:
            stats['size'] = len(self._cache)
            stats['max_size'] = self._max_size
        
        return stats


class L2Cache:
    """
    Disk-based SQLite cache (Level 2).
    
    Slower than L1 but persists across processes/restarts.
    """
    
    def __init__(self, db_path: str, max_size_mb: int = 100, default_ttl: int = 300):
        self._db_path = Path(db_path)
        self._max_size_mb = max_size_mb
        self._default_ttl = default_ttl
        self._lock = threading.RLock()
        
        # Ensure directory exists
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        
        self._init_db()
    
    def _init_db(self) -> None:
        """Initialize the cache database."""
        conn = sqlite3.connect(str(self._db_path))
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS cache (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    expires_at REAL,
                    access_count INTEGER DEFAULT 0,
                    last_accessed REAL NOT NULL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at)")
            conn.commit()
        finally:
            conn.close()
    
    def _get_conn(self) -> sqlite3.Connection:
        """Get a database connection."""
        conn = sqlite3.connect(str(self._db_path), timeout=30)
        conn.row_factory = sqlite3.Row
        return conn
    
    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            conn = self._get_conn()
            try:
                cursor = conn.execute(
                    "SELECT value, expires_at FROM cache WHERE key = ?",
                    (key,)
                )
                row = cursor.fetchone()
                
                if row is None:
                    return None
                
                # Check expiration
                expires_at = row['expires_at']
                if expires_at is not None and time.time() > expires_at:
                    self.delete(key)
                    return None
                
                # Update access stats
                conn.execute(
                    "UPDATE cache SET access_count = access_count + 1, last_accessed = ? WHERE key = ?",
                    (time.time(), key)
                )
                conn.commit()
                
                return json.loads(row['value'])
            finally:
                conn.close()
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        ttl = ttl or self._default_ttl
        expires_at = time.time() + ttl if ttl > 0 else None
        now = time.time()
        
        with self._lock:
            conn = self._get_conn()
            try:
                conn.execute(
                    """INSERT OR REPLACE INTO cache 
                       (key, value, created_at, expires_at, access_count, last_accessed)
                       VALUES (?, ?, ?, ?, 0, ?)""",
                    (key, json.dumps(value), now, expires_at, now)
                )
                conn.commit()
                
                # Cleanup old entries periodically
                self._cleanup(conn)
            finally:
                conn.close()
    
    def _cleanup(self, conn: sqlite3.Connection) -> None:
        """Remove expired entries."""
        # Only cleanup every 100 operations to avoid overhead
        import random
        if random.random() > 0.01:
            return
        
        conn.execute("DELETE FROM cache WHERE expires_at IS NOT NULL AND expires_at < ?", (time.time(),))
        conn.commit()
    
    def delete(self, key: str) -> bool:
        with self._lock:
            conn = self._get_conn()
            try:
                cursor = conn.execute("DELETE FROM cache WHERE key = ?", (key,))
                conn.commit()
                return cursor.rowcount > 0
            finally:
                conn.close()
    
    def clear(self) -> None:
        with self._lock:
            conn = self._get_conn()
            try:
                conn.execute("DELETE FROM cache")
                conn.commit()
            finally:
                conn.close()
    
    def clear_pattern(self, pattern: str) -> int:
        """Clear all keys matching a pattern."""
        with self._lock:
            conn = self._get_conn()
            try:
                cursor = conn.execute(
                    "SELECT key FROM cache WHERE key LIKE ?",
                    (f"%{pattern}%",)
                )
                keys = [row['key'] for row in cursor.fetchall()]
                
                if keys:
                    placeholders = ','.join('?' * len(keys))
                    conn.execute(f"DELETE FROM cache WHERE key IN ({placeholders})", keys)
                    conn.commit()
                
                return len(keys)
            finally:
                conn.close()


class CacheManager:
    """
    Unified cache manager coordinating L1, L2, and L3 caches.
    
    Implements write-through caching with read-through fallback.
    """
    
    def __init__(self, config: Optional[CacheConfig] = None):
        self._config = config or get_config().cache
        
        # Initialize cache layers
        self._l1_enabled = self._config.l1_enabled
        self._l2_enabled = self._config.l2_enabled
        
        self._l1_cache = L1Cache(
            max_size=self._config.l1_max_size,
            default_ttl=self._config.l1_ttl_seconds
        ) if self._l1_enabled else None
        
        self._l2_cache = L2Cache(
            db_path=self._config.l2_path,
            max_size_mb=self._config.l2_max_size_mb,
            default_ttl=self._config.l2_ttl_seconds
        ) if self._l2_enabled else None
        
        logger.info(
            f"CacheManager initialized: L1={self._l1_enabled}, L2={self._l2_enabled}"
        )
    
    def _make_key(self, prefix: str, *args) -> str:
        """Generate a cache key from prefix and arguments."""
        key_parts = [prefix]
        for arg in args:
            if isinstance(arg, (list, tuple, dict)):
                key_parts.append(hashlib.md5(json.dumps(arg, sort_keys=True).encode()).hexdigest()[:8])
            else:
                key_parts.append(str(arg))
        return ':'.join(key_parts)
    
    def get(self, prefix: str, *args) -> Optional[Any]:
        """
        Get value from cache (L1 -> L2 fallback).
        
        Args:
            prefix: Cache key prefix (usually table_name:method)
            *args: Arguments to form the full key
        
        Returns:
            Cached value or None
        """
        key = self._make_key(prefix, *args)
        
        # Try L1 first
        if self._l1_cache:
            value = self._l1_cache.get(key)
            if value is not None:
                logger.debug(f"L1 cache hit: {key}")
                return value
        
        # Try L2
        if self._l2_cache:
            value = self._l2_cache.get(key)
            if value is not None:
                logger.debug(f"L2 cache hit: {key}")
                # Populate L1
                if self._l1_cache:
                    self._l1_cache.set(key, value)
                return value
        
        logger.debug(f"Cache miss: {key}")
        return None
    
    def set(self, prefix: str, value: Any, ttl: Optional[int] = None, *args) -> None:
        """
        Set value in cache (write-through to all enabled layers).
        
        Args:
            prefix: Cache key prefix
            value: Value to cache
            ttl: Time-to-live in seconds (optional)
            *args: Arguments to form the full key
        """
        key = self._make_key(prefix, *args)
        
        # Set in L1
        if self._l1_cache:
            self._l1_cache.set(key, value, ttl)
        
        # Set in L2
        if self._l2_cache:
            self._l2_cache.set(key, value, ttl)
        
        logger.debug(f"Cache set: {key}")
    
    def delete(self, prefix: str, *args) -> None:
        """Delete a specific key from all cache layers."""
        key = self._make_key(prefix, *args)
        
        if self._l1_cache:
            self._l1_cache.delete(key)
        
        if self._l2_cache:
            self._l2_cache.delete(key)
        
        logger.debug(f"Cache delete: {key}")
    
    def invalidate(self, pattern: str) -> int:
        """
        Invalidate all cache entries matching a pattern.
        
        Args:
            pattern: Pattern to match (e.g., "accounts:*" or just "accounts")
        
        Returns:
            Number of entries invalidated
        """
        count = 0
        
        if self._l1_cache:
            count += self._l1_cache.clear_pattern(pattern)
        
        if self._l2_cache:
            count += self._l2_cache.clear_pattern(pattern)
        
        logger.info(f"Cache invalidated: {pattern} ({count} entries)")
        return count
    
    def clear_all(self) -> None:
        """Clear all cache entries."""
        if self._l1_cache:
            self._l1_cache.clear()
        
        if self._l2_cache:
            self._l2_cache.clear()
        
        logger.info("All caches cleared")
    
    def get_stats(self) -> dict:
        """Get cache statistics."""
        stats = {
            'l1_enabled': self._l1_enabled,
            'l2_enabled': self._l2_enabled,
        }
        
        if self._l1_cache:
            stats['l1'] = self._l1_cache.get_stats()
        
        return stats


# Global cache manager instance
_cache_manager: Optional[CacheManager] = None
_cache_lock = threading.Lock()


def get_cache_manager(config: Optional[CacheConfig] = None) -> CacheManager:
    """Get or create the global cache manager."""
    global _cache_manager
    
    with _cache_lock:
        if _cache_manager is None:
            _cache_manager = CacheManager(config)
        return _cache_manager


def reset_cache_manager() -> None:
    """Reset the global cache manager."""
    global _cache_manager
    
    with _cache_lock:
        _cache_manager = None
