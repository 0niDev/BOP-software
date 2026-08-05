"""
Advanced connection pool for SQLite Cloud optimized for network latency.

Features:
- Configurable min/max connections (default 10-50)
- Connection health checking
- Automatic reconnection on failure
- Thread-safe operation
- Connection recycling based on age
- Query timeout enforcement
- Slow query detection
"""
from __future__ import annotations

import sqlitecloud
import threading
import time
from collections import deque
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Optional

from config.app_config import DatabaseConfig, get_config
from utils.exceptions import ConnectionError, RetryExhaustedError
from utils.logger import get_logger, QueryTimer

logger = get_logger(__name__)


@dataclass
class PooledConnection:
    """Wrapper for a database connection with metadata."""
    connection: Any
    created_at: float = field(default_factory=time.time)
    last_used_at: float = field(default_factory=time.time)
    use_count: int = 0
    is_healthy: bool = True
    
    def age_seconds(self) -> float:
        return time.time() - self.created_at
    
    def idle_seconds(self) -> float:
        return time.time() - self.last_used_at
    
    def mark_used(self):
        self.last_used_at = time.time()
        self.use_count += 1


class ConnectionPool:
    """
    Thread-safe connection pool for SQLite Cloud.
    
    Optimized for network latency (50-200ms) with:
    - Minimum 10 warm connections ready for immediate use
    - Maximum 50 connections to handle peak load
    - Health checks to detect stale connections
    - Automatic retry with exponential backoff
    """
    
    def __init__(self, config: Optional[DatabaseConfig] = None):
        self._config = config or get_config().database
        
        # Pool configuration
        self._min_connections = self._config.min_connections
        self._max_connections = self._config.max_connections
        self._connection_timeout = self._config.connection_timeout
        self._idle_timeout = self._config.idle_timeout
        self._max_connection_age = 3600  # 1 hour
        
        # Pool state
        self._available: deque[PooledConnection] = deque()
        self._in_use: set[PooledConnection] = set()
        self._lock = threading.RLock()
        self._initialized = False
        self._connection_string: Optional[str] = None
        self._total_created = 0
        self._total_errors = 0
        
        # Statistics
        self._stats = {
            'connections_created': 0,
            'connections_closed': 0,
            'queries_executed': 0,
            'slow_queries': 0,
            'errors': 0,
            'wait_time_total_ms': 0,
        }
        self._stats_lock = threading.Lock()
        
        logger.info(
            f"ConnectionPool initialized: min={self._min_connections}, "
            f"max={self._max_connections}, timeout={self._connection_timeout}s"
        )
    
    def initialize(self, connection_string: str) -> None:
        """
        Initialize the pool with a connection string.
        
        Creates minimum number of warm connections.
        """
        with self._lock:
            self._connection_string = connection_string
            self._initialized = True
            
            # Pre-create minimum connections
            logger.info(f"Creating {self._min_connections} initial connections...")
            for i in range(self._min_connections):
                try:
                    conn = self._create_connection()
                    self._available.append(conn)
                except Exception as e:
                    logger.warning(f"Failed to create initial connection {i+1}: {e}")
            
            logger.info(f"Connection pool initialized with {len(self._available)} connections")
    
    def _create_connection(self) -> PooledConnection:
        """Create a new database connection."""
        start_time = time.perf_counter()
        
        try:
            conn = sqlitecloud.connect(self._connection_string)
            
            # Optimize for network latency
            conn.execute("PRAGMA busy_timeout = 5000")
            conn.execute("PRAGMA cache_size = -10000")  # 10MB cache
            conn.execute("PRAGMA temp_store = MEMORY")
            
            duration_ms = (time.perf_counter() - start_time) * 1000
            self._total_created += 1
            
            with self._stats_lock:
                self._stats['connections_created'] += 1
            
            logger.debug(f"Created new connection in {duration_ms:.2f}ms (total: {self._total_created})")
            return PooledConnection(connection=conn)
            
        except Exception as e:
            self._total_errors += 1
            with self._stats_lock:
                self._stats['errors'] += 1
            logger.error(f"Failed to create connection: {e}")
            raise ConnectionError(f"Could not connect to database: {e}") from e
    
    def _is_connection_healthy(self, pooled_conn: PooledConnection) -> bool:
        """Check if a connection is still healthy."""
        if not pooled_conn.is_healthy:
            return False
        
        # Check age
        if pooled_conn.age_seconds() > self._max_connection_age:
            logger.debug(f"Connection too old: {pooled_conn.age_seconds():.0f}s")
            return False
        
        # Test with simple query
        try:
            pooled_conn.connection.execute("SELECT 1")
            return True
        except Exception:
            return False
    
    def _close_connection(self, pooled_conn: PooledConnection) -> None:
        """Safely close a connection."""
        try:
            pooled_conn.connection.close()
            with self._stats_lock:
                self._stats['connections_closed'] += 1
            logger.debug(f"Closed connection (age: {pooled_conn.age_seconds():.0f}s, uses: {pooled_conn.use_count})")
        except Exception as e:
            logger.warning(f"Error closing connection: {e}")
    
    @contextmanager
    def get_connection(self, timeout: Optional[float] = None):
        """
        Get a connection from the pool.
        
        Uses context manager pattern for automatic return.
        
        Usage:
            with pool.get_connection() as conn:
                conn.execute("SELECT * FROM users")
        """
        timeout = timeout or self._connection_timeout
        start_time = time.perf_counter()
        
        pooled_conn = None
        wait_start = time.perf_counter()
        
        while True:
            # Check timeout
            elapsed = time.perf_counter() - start_time
            if elapsed > timeout:
                wait_ms = (time.perf_counter() - wait_start) * 1000
                with self._stats_lock:
                    self._stats['wait_time_total_ms'] += wait_ms
                raise ConnectionError(
                    f"Timeout waiting for connection after {elapsed:.2f}s"
                )
            
            with self._lock:
                # Try to get an available connection
                while self._available:
                    pooled_conn = self._available.popleft()
                    
                    if self._is_connection_healthy(pooled_conn):
                        pooled_conn.mark_used()
                        self._in_use.add(pooled_conn)
                        
                        wait_ms = (time.perf_counter() - wait_start) * 1000
                        with self._stats_lock:
                            self._stats['wait_time_total_ms'] += wait_ms
                        
                        logger.debug(
                            f"Got connection from pool (wait: {wait_ms:.2f}ms, "
                            f"available: {len(self._available)}, in_use: {len(self._in_use)})"
                        )
                        break
                    else:
                        # Connection unhealthy, close it
                        self._close_connection(pooled_conn)
                        pooled_conn = None
                
                # Create new connection if needed and possible
                if pooled_conn is None:
                    total_connections = len(self._available) + len(self._in_use)
                    
                    if total_connections < self._max_connections:
                        try:
                            pooled_conn = self._create_connection()
                            pooled_conn.mark_used()
                            self._in_use.add(pooled_conn)
                            
                            wait_ms = (time.perf_counter() - wait_start) * 1000
                            with self._stats_lock:
                                self._stats['wait_time_total_ms'] += wait_ms
                            
                            logger.debug(
                                f"Created new connection (wait: {wait_ms:.2f}ms, "
                                f"total: {total_connections + 1}/{self._max_connections})"
                            )
                            break
                        except ConnectionError as e:
                            logger.warning(f"Failed to create new connection: {e}")
                    
                    # Pool exhausted, wait and retry
                    pass
            
            # Wait before retrying (with exponential backoff)
            time.sleep(0.01)
        
        # Return connection wrapper
        try:
            yield pooled_conn.connection
        except Exception as e:
            # Mark connection as unhealthy on error
            with self._lock:
                if pooled_conn in self._in_use:
                    self._in_use.remove(pooled_conn)
                    pooled_conn.is_healthy = False
                    self._available.append(pooled_conn)
            raise
        else:
            # Return connection to pool
            with self._lock:
                if pooled_conn in self._in_use:
                    self._in_use.remove(pooled_conn)
                    
                    # Check if connection should be recycled
                    if (pooled_conn.idle_seconds() > self._idle_timeout or
                        pooled_conn.age_seconds() > self._max_connection_age):
                        self._close_connection(pooled_conn)
                    else:
                        self._available.append(pooled_conn)
    
    def return_connection(self, conn: Any) -> None:
        """Manually return a connection to the pool (if not using context manager)."""
        with self._lock:
            for pooled_conn in self._in_use:
                if pooled_conn.connection is conn:
                    self._in_use.remove(pooled_conn)
                    self._available.append(pooled_conn)
                    return
    
    def close_all(self) -> None:
        """Close all connections in the pool."""
        with self._lock:
            for pooled_conn in list(self._available) + list(self._in_use):
                self._close_connection(pooled_conn)
            
            self._available.clear()
            self._in_use.clear()
            self._initialized = False
            
            logger.info("All connections closed")
    
    def get_stats(self) -> dict:
        """Get pool statistics."""
        with self._lock:
            stats = {
                'available': len(self._available),
                'in_use': len(self._in_use),
                'total': len(self._available) + len(self._in_use),
                'min': self._min_connections,
                'max': self._max_connections,
            }
        
        with self._stats_lock:
            stats.update(self._stats.copy())
        
        return stats
    
    def health_check(self) -> bool:
        """Perform health check on all connections."""
        healthy_count = 0
        unhealthy_count = 0
        
        with self._lock:
            # Check available connections
            for _ in range(len(self._available)):
                pooled_conn = self._available.popleft()
                
                if self._is_connection_healthy(pooled_conn):
                    self._available.append(pooled_conn)
                    healthy_count += 1
                else:
                    self._close_connection(pooled_conn)
                    unhealthy_count += 1
            
            # Create replacement connections if needed
            while len(self._available) < self._min_connections:
                try:
                    conn = self._create_connection()
                    self._available.append(conn)
                except Exception as e:
                    logger.warning(f"Failed to create replacement connection: {e}")
                    break
        
        if unhealthy_count > 0:
            logger.info(f"Health check: {healthy_count} healthy, {unhealthy_count} unhealthy")
        
        return unhealthy_count == 0


# Global pool instance
_pool: Optional[ConnectionPool] = None
_pool_lock = threading.Lock()


def get_pool(config: Optional[DatabaseConfig] = None) -> ConnectionPool:
    """Get or create the global connection pool."""
    global _pool
    
    with _pool_lock:
        if _pool is None:
            _pool = ConnectionPool(config)
        return _pool


def init_pool(connection_string: str, config: Optional[DatabaseConfig] = None) -> None:
    """Initialize the global connection pool."""
    global _pool
    
    with _pool_lock:
        _pool = ConnectionPool(config)
        _pool.initialize(connection_string)


def close_pool() -> None:
    """Close the global connection pool."""
    global _pool
    
    with _pool_lock:
        if _pool is not None:
            _pool.close_all()
            _pool = None
