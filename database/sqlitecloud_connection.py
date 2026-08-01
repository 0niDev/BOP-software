"""
SQLite Cloud connection - shared SQLite database over network.
"""
from __future__ import annotations

import os
import time
import sqlitecloud
from contextlib import contextmanager
from typing import Any, Iterator, Sequence

from config.app_config import DatabaseConfig, get_config
from utils.exceptions import DatabaseError
from utils.logger import get_logger

logger = get_logger(__name__)


class SQLiteCloudConnection:
    """SQLite Cloud implementation - multiple instances share one database."""
    
    def __init__(self, config: DatabaseConfig | None = None):
        self._config = config or get_config().database
        self._conn = None
        self._connect()

    def _connect(self) -> None:
        """Establish SQLite Cloud connection with retry."""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                connection_string = self._config.sqlite_cloud_url
                if not connection_string:
                    connection_string = os.environ.get('SQLITE_CLOUD_URL')
                
                if not connection_string:
                    raise DatabaseError("SQLITE_CLOUD_URL not set")
                
                self._conn = sqlitecloud.connect(connection_string)
                self._conn.execute("PRAGMA foreign_keys = ON")
                self._conn.execute("PRAGMA journal_mode = WAL")
                logger.info("Connected to SQLite Cloud database")
                return
            except Exception as exc:
                if attempt < max_retries - 1:
                    logger.warning(f"Connection attempt {attempt+1} failed, retrying...")
                    time.sleep(1)
                else:
                    raise DatabaseError(f"Could not connect to SQLite Cloud: {exc}") from exc

    def _ensure_connection(self):
        if self._conn is None:
            self._connect()

    def execute(self, sql: str, params: Sequence[Any] = ()):
        self._ensure_connection()
        max_retries = 3
        for attempt in range(max_retries):
            try:
                return self._conn.execute(sql, params)
            except Exception as exc:
                if "write" in str(exc).lower() and attempt < max_retries - 1:
                    logger.warning(f"Write error, retrying... (attempt {attempt+1})")
                    time.sleep(0.5)
                    self._ensure_connection()
                    continue
                logger.error("SQL execute failed: %s | sql=%s", exc, sql)
                raise DatabaseError(str(exc)) from exc

    def fetch_one(self, sql: str, params: Sequence[Any] = ()) -> dict | None:
        cursor = self.execute(sql, params)
        row = cursor.fetchone()
        if row is None:
            return None
        if isinstance(row, tuple):
            columns = [desc[0] for desc in cursor.description]
            return dict(zip(columns, row))
        return row

    def fetch_all(self, sql: str, params: Sequence[Any] = ()) -> list[dict]:
        cursor = self.execute(sql, params)
        rows = cursor.fetchall()
        if not rows:
            return []
        if isinstance(rows[0], tuple):
            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in rows]
        return rows

    def executemany(self, sql: str, seq_of_params: Sequence[Sequence[Any]]):
        self._ensure_connection()
        cursor = self._conn.cursor()
        cursor.executemany(sql, seq_of_params)
        return cursor

    def last_insert_id(self) -> int:
        """Get the last inserted row ID."""
        self._ensure_connection()
        cursor = self._conn.execute("SELECT last_insert_rowid()")
        return cursor.fetchone()[0]

    @contextmanager
    def transaction(self):
        self._ensure_connection()
        try:
            self._conn.execute("BEGIN")
            yield self
            self._conn.execute("COMMIT")
        except Exception as exc:
            self._conn.execute("ROLLBACK")
            logger.error("Transaction rolled back: %s", exc)
            raise

    def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None