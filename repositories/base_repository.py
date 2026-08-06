"""
Generic base repository.

Every entity-specific repository (AccountRepository, ItemRepository,
PartyRepository, ...) extends this class and gets consistent CRUD,
consistent error handling, and a single injected DatabaseConnection --
so switching the underlying engine later means changing
database/connection.py only, never any repository.
"""
from __future__ import annotations

import time
from typing import Any, Generic, TypeVar

from database.connection import DatabaseConnection, get_db
from utils.exceptions import DatabaseError, RecordNotFoundError
from utils.logger import get_logger

T = TypeVar("T")

logger = get_logger(__name__)


class BaseRepository(Generic[T]):
    #: Must be overridden by subclasses with the physical table name.
    table_name: str = ""
    #: Primary key column name.
    pk_column: str = "id"
    
    # Class-level cache shared across all instances
    _cache: dict[str, tuple[Any, float]] = {}
    _cache_ttl: int = 30  # 30 seconds cache TTL
    _cache_enabled: bool = True

    def __init__(self, db: DatabaseConnection | None = None):
        if not self.table_name:
            raise ValueError(f"{self.__class__.__name__} must define table_name")
        self.db = db or get_db()
        self.logger = get_logger(self.__class__.__module__)
    
    def _get_cache_key(self, method: str, *args) -> str:
        """Generate cache key from method name and arguments."""
        return f"{self.table_name}:{method}:{args}"
    
    def _get_cached(self, key: str) -> Any | None:
        """Get value from cache if not expired."""
        if not self._cache_enabled:
            return None
        if key in self._cache:
            value, timestamp = self._cache[key]
            if time.time() - timestamp < self._cache_ttl:
                return value
            else:
                del self._cache[key]
        return None
    
    def _set_cached(self, key: str, value: Any) -> None:
        """Set value in cache."""
        if self._cache_enabled:
            self._cache[key] = (value, time.time())
    
    def _invalidate_cache(self, pattern: str | None = None) -> None:
        """Invalidate cache entries matching pattern."""
        if pattern is None:
            # Clear all cache for this table
            keys_to_delete = [k for k in self._cache if k.startswith(f"{self.table_name}:")]
            for key in keys_to_delete:
                del self._cache[key]
        else:
            # Clear specific pattern
            keys_to_delete = [k for k in self._cache if pattern in k]
            for key in keys_to_delete:
                if key in self._cache:
                    del self._cache[key]
    
    @classmethod
    def clear_all_cache(cls) -> None:
        """Clear entire repository cache."""
        cls._cache.clear()

    # ------------------------------------------------------------------
    # Generic CRUD
    # ------------------------------------------------------------------
    def find_by_id(self, record_id: int) -> dict | None:
        cache_key = self._get_cache_key("find_by_id", record_id)
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached
        
        result = self.db.fetch_one(
            f"SELECT * FROM {self.table_name} WHERE {self.pk_column} = ?", (record_id,)
        )
        if result is not None:
            self._set_cached(cache_key, result)
        return result

    def get_by_id(self, record_id: int) -> dict:
        row = self.find_by_id(record_id)
        if row is None:
            raise RecordNotFoundError(
                f"{self.table_name} record with id={record_id} not found"
            )
        return row

    def find_all(self, active_only: bool = False, order_by: str | None = None) -> list[dict]:
        cache_key = self._get_cache_key("find_all", active_only, order_by)
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached
        
        sql = f"SELECT * FROM {self.table_name}"
        if active_only:
            sql += " WHERE is_active = 1"
        if order_by:
            sql += f" ORDER BY {order_by}"
        result = self.db.fetch_all(sql)
        self._set_cached(cache_key, result)
        return result

    def insert(self, data: dict[str, Any]) -> int:
        columns = list(data.keys())
        placeholders = ", ".join("?" for _ in columns)
        col_list = ", ".join(columns)
        sql = f"INSERT INTO {self.table_name} ({col_list}) VALUES ({placeholders})"
        try:
            self.db.execute(sql, tuple(data.values()))
            self._invalidate_cache()  # Clear cache after insert
            return self.db.last_insert_id()
        except DatabaseError:
            self.logger.exception("Insert failed on %s", self.table_name)
            raise

    def update(self, record_id: int, data: dict[str, Any]) -> None:
        if not data:
            return
        set_clause = ", ".join(f"{col} = ?" for col in data.keys())
        sql = f"UPDATE {self.table_name} SET {set_clause} WHERE {self.pk_column} = ?"
        try:
            self.db.execute(sql, tuple(data.values()) + (record_id,))
            self._invalidate_cache()  # Clear cache after update
        except DatabaseError:
            self.logger.exception("Update failed on %s id=%s", self.table_name, record_id)
            raise

    def delete(self, record_id: int) -> None:
        """Physical delete -- prefer `deactivate` for business entities."""
        self.db.execute(
            f"DELETE FROM {self.table_name} WHERE {self.pk_column} = ?", (record_id,)
        )
        self._invalidate_cache()  # Clear cache after delete

    def deactivate(self, record_id: int) -> None:
        """Soft delete -- preserves history/ledger integrity."""
        self.update(record_id, {"is_active": 0})

    def exists(self, record_id: int) -> bool:
        return self.find_by_id(record_id) is not None

    def count(self, where_clause: str = "", params: tuple = ()) -> int:
        sql = f"SELECT COUNT(*) c FROM {self.table_name}"
        if where_clause:
            sql += f" WHERE {where_clause}"
        row = self.db.fetch_one(sql, params)
        return row["c"] if row else 0
