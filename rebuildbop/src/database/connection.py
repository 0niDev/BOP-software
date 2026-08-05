"""
Main database connection layer integrating connection pool and transaction manager.

Provides a unified interface for all database operations with:
- Connection pooling (10-50 connections)
- Automatic retry on network failures
- Transaction management with savepoints
- Query timing and slow query detection
- Async support for UI responsiveness
"""
from __future__ import annotations

import os
import sqlitecloud
import threading
import time
from contextlib import contextmanager
from typing import Any, Iterator, Optional, Sequence

from config.app_config import DatabaseConfig, get_config
from database.connection_pool import ConnectionPool, get_pool, init_pool, close_pool
from database.transaction_manager import TransactionManager, get_transaction_manager
from utils.exceptions import DatabaseError
from utils.logger import get_logger, QueryTimer

logger = get_logger(__name__)


class DatabaseConnection:
    """
    Main database connection class with pooling and retry support.
    
    All database operations go through this class which provides:
    - Automatic connection pooling
    - Retry logic for network failures
    - Transaction management
    - Query timing and logging
    """
    
    def __init__(self, config: Optional[DatabaseConfig] = None):
        self._config = config or get_config().database
        self._pool: Optional[ConnectionPool] = None
        self._transaction_manager: Optional[TransactionManager] = None
        self._initialized = False
        self._lock = threading.RLock()
        
        # Initialize when first used (lazy initialization)
        logger.info("DatabaseConnection created (lazy initialization)")
    
    def initialize(self, connection_string: Optional[str] = None) -> None:
        """Initialize the connection pool."""
        with self._lock:
            if self._initialized:
                return
            
            if connection_string is None:
                connection_string = self._get_connection_string()
            
            init_pool(connection_string, self._config)
            self._pool = get_pool(self._config)
            self._transaction_manager = get_transaction_manager()
            self._initialized = True
            
            logger.info(f"DatabaseConnection initialized: {connection_string[:50]}...")
    
    def _get_connection_string(self) -> str:
        """Get connection string from config or environment."""
        connection_string = self._config.sqlite_cloud_url
        if not connection_string:
            connection_string = os.environ.get('SQLITE_CLOUD_URL')
        if not connection_string:
            raise DatabaseError(
                "SQLITE_CLOUD_URL not set. Please configure in app_config.py "
                "or set SQLITE_CLOUD_URL environment variable."
            )
        return connection_string
    
    def _ensure_initialized(self) -> None:
        """Ensure the connection is initialized."""
        if not self._initialized:
            self.initialize()
    
    @contextmanager
    def _get_connection(self):
        """Get a connection from the pool."""
        self._ensure_initialized()
        
        with self._pool.get_connection() as conn:
            yield conn
    
    def fetch_all(self, sql: str, params: Sequence[Any] = ()) -> list[dict]:
        """
        Fetch all rows from a query.
        
        Args:
            sql: SQL query string
            params: Query parameters
        
        Returns:
            List of dictionaries representing rows
        """
        self._ensure_initialized()
        
        start_time = time.perf_counter()
        
        try:
            with self._get_connection() as conn:
                cursor = conn.execute(sql, params)
                rows = cursor.fetchall()
                
                if not rows:
                    return []
                
                # Convert to list of dicts
                if isinstance(rows[0], tuple):
                    columns = [desc[0] for desc in cursor.description]
                    result = [dict(zip(columns, row)) for row in rows]
                else:
                    result = list(rows)
                
                duration_ms = (time.perf_counter() - start_time) * 1000
                
                # Log slow queries
                if duration_ms > self._config.slow_query_threshold_ms:
                    logger.warning(
                        f"Slow query: {duration_ms:.2f}ms | {sql[:100]}..."
                    )
                
                return result
                
        except sqlitecloud.Error as e:
            logger.error(f"fetch_all failed: {e} | sql={sql[:100]}")
            raise DatabaseError(str(e)) from e
    
    def fetch_one(self, sql: str, params: Sequence[Any] = ()) -> Optional[dict]:
        """
        Fetch a single row from a query.
        
        Args:
            sql: SQL query string
            params: Query parameters
        
        Returns:
            Dictionary representing row, or None if not found
        """
        self._ensure_initialized()
        
        start_time = time.perf_counter()
        
        try:
            with self._get_connection() as conn:
                cursor = conn.execute(sql, params)
                row = cursor.fetchone()
                
                if row is None:
                    return None
                
                # Convert to dict
                if isinstance(row, tuple):
                    columns = [desc[0] for desc in cursor.description]
                    result = dict(zip(columns, row))
                else:
                    result = row
                
                duration_ms = (time.perf_counter() - start_time) * 1000
                return result
                
        except sqlitecloud.Error as e:
            logger.error(f"fetch_one failed: {e} | sql={sql[:100]}")
            raise DatabaseError(str(e)) from e
    
    def execute(self, sql: str, params: Sequence[Any] = ()) -> Any:
        """
        Execute a SQL statement (INSERT, UPDATE, DELETE, etc.).
        
        Args:
            sql: SQL statement
            params: Statement parameters
        
        Returns:
            Cursor result
        """
        self._ensure_initialized()
        
        try:
            with self._get_connection() as conn:
                result = conn.execute(sql, params)
                return result
                
        except sqlitecloud.Error as e:
            logger.error(f"execute failed: {e} | sql={sql[:100]}")
            raise DatabaseError(str(e)) from e
    
    def executemany(self, sql: str, seq_of_params: Sequence[Sequence[Any]]) -> Any:
        """
        Execute a SQL statement with multiple parameter sets (batch operation).
        
        Args:
            sql: SQL statement
            seq_of_params: Sequence of parameter tuples
        
        Returns:
            Cursor result
        """
        self._ensure_initialized()
        
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                result = cursor.executemany(sql, seq_of_params)
                return result
                
        except sqlitecloud.Error as e:
            logger.error(f"executemany failed: {e} | sql={sql[:100]}")
            raise DatabaseError(str(e)) from e
    
    def last_insert_id(self) -> int:
        """Get the ID of the last inserted row."""
        self._ensure_initialized()
        
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("SELECT last_insert_rowid()")
                row = cursor.fetchone()
                return row[0] if row else 0
                
        except sqlitecloud.Error as e:
            logger.error(f"last_insert_id failed: {e}")
            raise DatabaseError(str(e)) from e
    
    @contextmanager
    def transaction(self) -> Iterator["DatabaseConnection"]:
        """
        Start a transaction context.
        
        Usage:
            with db.transaction():
                db.execute("INSERT INTO ...")
                db.execute("UPDATE ...")
        """
        self._ensure_initialized()
        
        conn = None
        try:
            with self._get_connection() as conn:
                with self._transaction_manager.transaction(conn):
                    yield self
        except Exception as e:
            logger.error(f"Transaction failed: {e}")
            raise
    
    def close(self) -> None:
        """Close all connections in the pool."""
        close_pool()
        self._initialized = False
        logger.info("Database connections closed")
    
    def get_stats(self) -> dict:
        """Get database statistics."""
        self._ensure_initialized()
        
        stats = {
            'pool': self._pool.get_stats() if self._pool else {},
            'transactions': self._transaction_manager.get_stats() if self._transaction_manager else {},
        }
        return stats


# Singleton instance
_db_instance: Optional[DatabaseConnection] = None
_db_lock = threading.Lock()


def get_db() -> DatabaseConnection:
    """Get the global database connection instance."""
    global _db_instance
    
    with _db_lock:
        if _db_instance is None:
            _db_instance = DatabaseConnection()
        return _db_instance


def init_db(connection_string: Optional[str] = None) -> DatabaseConnection:
    """Initialize the global database connection."""
    global _db_instance
    
    with _db_lock:
        _db_instance = DatabaseConnection()
        _db_instance.initialize(connection_string)
        return _db_instance


def close_db() -> None:
    """Close the global database connection."""
    global _db_instance
    
    with _db_lock:
        if _db_instance is not None:
            _db_instance.close()
            _db_instance = None
