"""
Database connection layer - Direct SQLite Cloud connection with pooling.
"""
from __future__ import annotations

import sqlitecloud
import sqlite3
import threading
import time
from contextlib import contextmanager
from typing import Any, Iterator, Sequence

from config.app_config import DatabaseConfig, get_config
from utils.exceptions import DatabaseError
from utils.logger import get_logger

logger = get_logger(__name__)


# ============================================================
# CONNECTION POOL
# ============================================================

class ConnectionPool:
    """Thread-safe connection pool for SQLite Cloud."""
    
    def __init__(self, max_connections: int = 5):
        self.max_connections = max_connections
        self._connections: list = []
        self._lock = threading.Lock()
        self._connection_string: str | None = None
        self._is_initialized = False
    
    def initialize(self, connection_string: str) -> None:
        with self._lock:
            self._connection_string = connection_string
            self._is_initialized = True
            logger.info(f"Connection pool initialized with {self.max_connections} connections")
    
    def get_connection(self):
        with self._lock:
            if not self._is_initialized:
                raise RuntimeError("Connection pool not initialized. Call initialize() first.")
            
            while self._connections:
                conn = self._connections.pop()
                try:
                    conn.execute("SELECT 1")
                    return conn
                except Exception:
                    pass
            
            if not self._connection_string:
                raise RuntimeError("Connection string not set")
            return sqlitecloud.connect(self._connection_string)
    
    def return_connection(self, conn) -> None:
        if conn is None:
            return
        with self._lock:
            if len(self._connections) < self.max_connections:
                self._connections.append(conn)
            else:
                try:
                    conn.close()
                except Exception:
                    pass
    
    def close_all(self) -> None:
        with self._lock:
            for conn in self._connections:
                try:
                    conn.close()
                except Exception:
                    pass
            self._connections.clear()
            self._is_initialized = False


_pool = ConnectionPool(max_connections=5)


def init_pool(connection_string: str) -> None:
    _pool.initialize(connection_string)


def get_pool() -> ConnectionPool:
    return _pool


# ============================================================
# DATABASE CONNECTION ABSTRACT CLASS
# ============================================================

class DatabaseConnection:
    def execute(self, sql: str, params: Sequence[Any] = ()) -> Any:
        raise NotImplementedError

    def fetch_one(self, sql: str, params: Sequence[Any] = ()) -> dict | None:
        raise NotImplementedError

    def fetch_all(self, sql: str, params: Sequence[Any] = ()) -> list[dict]:
        raise NotImplementedError

    def executemany(self, sql: str, seq_of_params: Sequence[Sequence[Any]]) -> Any:
        raise NotImplementedError

    @contextmanager
    def transaction(self) -> Iterator["DatabaseConnection"]:
        raise NotImplementedError

    def last_insert_id(self) -> int:
        raise NotImplementedError

    def close(self) -> None:
        raise NotImplementedError


# ============================================================
# SQLITE CLOUD CONNECTION - DIRECT MODE
# ============================================================

class SQLiteCloudConnection(DatabaseConnection):
    """SQLite Cloud implementation with connection pooling - direct mode."""
    
    def __init__(self, config: DatabaseConfig | None = None):
        self._config = config or get_config().database
        self._connection_string = self._get_connection_string()
        init_pool(self._connection_string)
        logger.info("✅ SQLiteCloudConnection initialized (direct mode)")

    def _get_connection_string(self) -> str:
        import os
        connection_string = self._config.sqlite_cloud_url
        if not connection_string:
            connection_string = os.environ.get('SQLITE_CLOUD_URL')
        if not connection_string:
            raise DatabaseError("SQLITE_CLOUD_URL not set")
        return connection_string

    def _get_cached_connection(self):
        return get_pool().get_connection()

    def _return_connection(self, conn):
        get_pool().return_connection(conn)

    def fetch_all(self, sql: str, params: Sequence[Any] = ()) -> list[dict]:
        """Fetch all - direct connection."""
        conn = self._get_cached_connection()
        try:
            cursor = conn.execute(sql, params)
            rows = cursor.fetchall()
            if not rows:
                return []
            if isinstance(rows[0], tuple):
                columns = [desc[0] for desc in cursor.description]
                return [dict(zip(columns, row)) for row in rows]
            return rows
        finally:
            self._return_connection(conn)

    def fetch_one(self, sql: str, params: Sequence[Any] = ()) -> dict | None:
        """Fetch one - direct connection."""
        conn = self._get_cached_connection()
        try:
            cursor = conn.execute(sql, params)
            row = cursor.fetchone()
            if row is None:
                return None
            if isinstance(row, tuple):
                columns = [desc[0] for desc in cursor.description]
                return dict(zip(columns, row))
            return row
        finally:
            self._return_connection(conn)

    def execute(self, sql: str, params: Sequence[Any] = ()):
        """Execute SQL - direct connection."""
        conn = self._get_cached_connection()
        try:
            return conn.execute(sql, params)
        except Exception as exc:
            logger.error("SQL execute failed: %s | sql=%s", exc, sql)
            raise DatabaseError(str(exc)) from exc
        finally:
            self._return_connection(conn)

    def executemany(self, sql: str, seq_of_params: Sequence[Sequence[Any]]):
        """Execute many - direct connection."""
        conn = self._get_cached_connection()
        try:
            cursor = conn.cursor()
            cursor.executemany(sql, seq_of_params)
            return cursor
        finally:
            self._return_connection(conn)

    def last_insert_id(self) -> int:
        conn = self._get_cached_connection()
        try:
            cursor = conn.execute("SELECT last_insert_rowid()")
            return cursor.fetchone()[0]
        finally:
            self._return_connection(conn)

    @contextmanager
    def transaction(self) -> Iterator["SQLiteCloudConnection"]:
        conn = self._get_cached_connection()
        try:
            conn.execute("BEGIN")
            yield self
            conn.execute("COMMIT")
        except Exception as exc:
            conn.execute("ROLLBACK")
            logger.error("Transaction rolled back: %s", exc)
            raise
        finally:
            self._return_connection(conn)

    def close(self) -> None:
        get_pool().close_all()
        logger.info("SQLite Cloud connections closed")


# ============================================================
# LOCAL SQLITE CONNECTION (for migration/fallback)
# ============================================================

class SQLiteConnection(DatabaseConnection):
    """SQLite implementation for local database."""
    
    def __init__(self, config: DatabaseConfig | None = None):
        self._config = config or get_config().database
        self._local = threading.local()

    def _get_conn(self) -> sqlite3.Connection:
        conn = getattr(self._local, "conn", None)
        if conn is None:
            try:
                conn = sqlite3.connect(
                    self._config.sqlite_path,
                    detect_types=sqlite3.PARSE_DECLTYPES,
                    isolation_level=None,
                )
                conn.row_factory = sqlite3.Row
                if self._config.foreign_keys:
                    conn.execute("PRAGMA foreign_keys = ON")
                conn.execute("PRAGMA journal_mode = WAL")
                self._local.conn = conn
            except sqlite3.Error as exc:
                logger.error("Failed to open SQLite connection: %s", exc)
                raise DatabaseError(f"Could not connect to database: {exc}") from exc
        return conn

    def execute(self, sql: str, params: Sequence[Any] = ()) -> sqlite3.Cursor:
        conn = self._get_conn()
        try:
            return conn.execute(sql, params)
        except sqlite3.Error as exc:
            logger.error("SQL execute failed: %s | sql=%s", exc, sql)
            raise DatabaseError(str(exc)) from exc

    def executemany(self, sql: str, seq_of_params: Sequence[Sequence[Any]]) -> sqlite3.Cursor:
        conn = self._get_conn()
        try:
            return conn.executemany(sql, seq_of_params)
        except sqlite3.Error as exc:
            logger.error("SQL executemany failed: %s | sql=%s", exc, sql)
            raise DatabaseError(str(exc)) from exc

    def fetch_one(self, sql: str, params: Sequence[Any] = ()) -> dict | None:
        cur = self.execute(sql, params)
        row = cur.fetchone()
        return dict(row) if row is not None else None

    def fetch_all(self, sql: str, params: Sequence[Any] = ()) -> list[dict]:
        cur = self.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]

    def last_insert_id(self) -> int:
        return self._get_conn().execute("SELECT last_insert_rowid()").fetchone()[0]

    @contextmanager
    def transaction(self) -> Iterator["SQLiteConnection"]:
        conn = self._get_conn()
        nested = getattr(self._local, "in_transaction", False)
        if not nested:
            conn.execute("BEGIN")
            self._local.in_transaction = True
        else:
            conn.execute("SAVEPOINT nested_sp")
        try:
            yield self
            if not nested:
                conn.execute("COMMIT")
            else:
                conn.execute("RELEASE nested_sp")
        except Exception as exc:
            if not nested:
                conn.execute("ROLLBACK")
            else:
                conn.execute("ROLLBACK TO nested_sp")
            logger.error("Transaction rolled back: %s", exc)
            raise
        finally:
            if not nested:
                self._local.in_transaction = False

    def close(self) -> None:
        conn = getattr(self._local, "conn", None)
        if conn is not None:
            conn.close()
            self._local.conn = None


# ============================================================
# FACTORY AND SINGLETON
# ============================================================

def create_connection(config: DatabaseConfig | None = None) -> DatabaseConnection:
    cfg = config or get_config().database
    if cfg.engine == "sqlite":
        return SQLiteConnection(cfg)
    elif cfg.engine == "sqlitecloud":
        return SQLiteCloudConnection(cfg)
    elif cfg.engine == "mysql":
        raise DatabaseError("MySQL support not implemented yet")
    elif cfg.engine == "postgresql":
        raise DatabaseError("PostgreSQL support not implemented yet")
    raise DatabaseError(f"Unsupported database engine: {cfg.engine}")


_db_instance: DatabaseConnection | None = None


def get_db() -> DatabaseConnection:
    global _db_instance
    if _db_instance is None:
        _db_instance = create_connection()
    return _db_instance


def close_db() -> None:
    global _db_instance
    if _db_instance is not None:
        _db_instance.close()
        _db_instance = None
# Add this function near the bottom of connection.py, before the closing

def invalidate_db_cache(pattern: str = None) -> None:
    """Invalidate the query cache."""
    # Since we're in direct mode, this just logs a message
    logger.info(f"Cache invalidate called (direct mode): {pattern or 'all'}")
    # If you want to implement actual cache clearing, add it here