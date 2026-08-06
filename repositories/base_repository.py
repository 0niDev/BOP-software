"""
Generic base repository with three-tier caching support.

Every entity-specific repository (AccountRepository, ItemRepository,
PartyRepository, ...) extends this class and gets consistent CRUD,
consistent error handling, batch operations, and a single injected 
DatabaseConnection -- so switching the underlying engine later means 
changing database/connection.py only, never any repository.

Caching Strategy:
- L1: Instance-level cache (fastest, per-repository)
- L2: Session-level cache (shared across repositories)
- L3: Global cache (for expensive operations via decorator)
"""
from __future__ import annotations

import time
from typing import Any, Generic, TypeVar, Sequence

from database.connection import DatabaseConnection, get_db
from utils.exceptions import DatabaseError, RecordNotFoundError
from utils.logger import get_logger
from utils.cache_manager import SessionCache, invalidate_on_change

T = TypeVar("T")

logger = get_logger(__name__)


class BaseRepository(Generic[T]):
    #: Must be overridden by subclasses with the physical table name.
    table_name: str = ""
    #: Primary key column name.
    pk_column: str = "id"
    
    # L1 Cache: Class-level cache shared across all instances
    _cache: dict[str, tuple[Any, float]] = {}
    _cache_ttl: int = 30  # 30 seconds cache TTL
    _cache_enabled: bool = True

    def __init__(self, db: DatabaseConnection | None = None):
        if not self.table_name:
            raise ValueError(f"{self.__class__.__name__} must define table_name")
        self.db = db or get_db()
        self.logger = get_logger(self.__class__.__module__)
        self._l2_cache = SessionCache()  # L2 session cache
    
    def _get_cache_key(self, method: str, *args) -> str:
        """Generate cache key from method name and arguments."""
        return f"{self.table_name}:{method}:{args}"
    
    def _get_cached(self, key: str) -> Any | None:
        """Get value from L1 cache if not expired."""
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
        """Set value in L1 cache."""
        if self._cache_enabled:
            self._cache[key] = (value, time.time())
    
    def _get_l2_cached(self, key: str) -> Any | None:
        """Get value from L2 (session) cache."""
        return self._l2_cache.get(key)
    
    def _set_l2_cached(self, key: str, value: Any, ttl: int = 60) -> None:
        """Set value in L2 (session) cache."""
        self._l2_cache.set(key, value, ttl=ttl)
    
    def _invalidate_cache(self, pattern: str | None = None) -> None:
        """Invalidate L1 and L2 cache entries matching pattern."""
        # Invalidate L1 cache
        if pattern is None:
            keys_to_delete = [k for k in self._cache if k.startswith(f"{self.table_name}:")]
            for key in keys_to_delete:
                del self._cache[key]
        else:
            keys_to_delete = [k for k in self._cache if pattern in k]
            for key in keys_to_delete:
                if key in self._cache:
                    del self._cache[key]
        
        # Invalidate L2 cache
        invalidate_on_change(self.table_name)
    
    @classmethod
    def clear_all_cache(cls) -> None:
        """Clear entire L1 repository cache."""
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
    
    # ------------------------------------------------------------------
    # Batch Operations (Optimization: reduce N+1 queries)
    # ------------------------------------------------------------------
    def find_by_ids(self, ids: list[int]) -> list[dict]:
        """Find multiple records by IDs in a single query."""
        if not ids:
            return []
        
        placeholders = ", ".join("?" for _ in ids)
        sql = f"SELECT * FROM {self.table_name} WHERE {self.pk_column} IN ({placeholders})"
        return self.db.fetch_all(sql, tuple(ids))
    
    def find_all_where(
        self, 
        where_clause: str, 
        params: tuple = (), 
        order_by: str | None = None,
        limit: int | None = None
    ) -> list[dict]:
        """Find all records matching a WHERE clause with optional ordering and limit."""
        sql = f"SELECT * FROM {self.table_name} WHERE {where_clause}"
        if order_by:
            sql += f" ORDER BY {order_by}"
        if limit:
            sql += f" LIMIT {limit}"
        return self.db.fetch_all(sql, params)
    
    def insert_batch(self, data_list: list[dict[str, Any]]) -> list[int]:
        """Insert multiple records in a single batch operation."""
        if not data_list:
            return []
        
        ids = []
        columns = list(data_list[0].keys())
        placeholders = ", ".join("?" for _ in columns)
        col_list = ", ".join(columns)
        sql = f"INSERT INTO {self.table_name} ({col_list}) VALUES ({placeholders})"
        
        try:
            with self.db.transaction():
                values_list = [tuple(data[col] for col in columns) for data in data_list]
                self.db.executemany(sql, values_list)
                
                # Get inserted IDs
                for _ in data_list:
                    ids.append(self.db.last_insert_id())
            
            self._invalidate_cache()  # Clear cache after batch insert
            return ids
        except DatabaseError:
            self.logger.exception("Batch insert failed on %s", self.table_name)
            raise
    
    def update_batch(self, updates: list[tuple[int, dict[str, Any]]]) -> None:
        """
        Update multiple records in a single batch operation.
        
        Args:
            updates: List of (record_id, data_dict) tuples
        """
        if not updates:
            return
        
        try:
            with self.db.transaction():
                for record_id, data in updates:
                    if not data:
                        continue
                    set_clause = ", ".join(f"{col} = ?" for col in data.keys())
                    sql = f"UPDATE {self.table_name} SET {set_clause} WHERE {self.pk_column} = ?"
                    self.db.execute(sql, tuple(data.values()) + (record_id,))
            
            self._invalidate_cache()  # Clear cache after batch update
        except DatabaseError:
            self.logger.exception("Batch update failed on %s", self.table_name)
            raise
    
    def delete_batch(self, ids: list[int]) -> None:
        """Delete multiple records by IDs in a single query."""
        if not ids:
            return
        
        placeholders = ", ".join("?" for _ in ids)
        sql = f"DELETE FROM {self.table_name} WHERE {self.pk_column} IN ({placeholders})"
        self.db.execute(sql, tuple(ids))
        self._invalidate_cache()  # Clear cache after batch delete
