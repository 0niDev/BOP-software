"""
Base repository with advanced features for SQLite Cloud optimization.

Features:
- Batch operations for reduced round-trips
- Multi-level caching integration
- Pagination support
- Relation loading (eager/lazy)
- Find by IDs (batch fetch)
"""
from __future__ import annotations

import time
from typing import Any, Generic, List, Optional, TypeVar

from database.connection import DatabaseConnection, get_db
from utils.cache_manager import CacheManager, get_cache_manager
from utils.exceptions import RecordNotFoundError
from utils.logger import get_logger

T = TypeVar("T")

logger = get_logger(__name__)


class BaseRepository(Generic[T]):
    """
    Enhanced base repository with batch operations and caching.
    
    All entity-specific repositories extend this class.
    """
    
    table_name: str = ""
    pk_column: str = "id"
    
    def __init__(self, db: Optional[DatabaseConnection] = None):
        if not self.table_name:
            raise ValueError(f"{self.__class__.__name__} must define table_name")
        
        self.db = db or get_db()
        self._cache: CacheManager = get_cache_manager()
        self._logger = get_logger(self.__class__.__module__)
    
    # ==================== CACHE HELPERS ====================
    
    def _get_cache_key(self, method: str, *args) -> str:
        """Generate cache key from method name and arguments."""
        return f"{self.table_name}:{method}:{args}"
    
    def _invalidate_cache(self, pattern: Optional[str] = None) -> None:
        """Invalidate cache entries for this table."""
        self._cache.invalidate(self.table_name)
    
    # ==================== SINGLE RECORD OPERATIONS ====================
    
    def find_by_id(self, record_id: int) -> Optional[dict]:
        """Find a single record by ID with caching."""
        cache_key = self._get_cache_key("find_by_id", record_id)
        cached = self._cache.get(cache_key)
        
        if cached is not None:
            self._logger.debug(f"Cache hit: {cache_key}")
            return cached
        
        sql = f"SELECT * FROM {self.table_name} WHERE {self.pk_column} = ?"
        result = self.db.fetch_one(sql, (record_id,))
        
        if result is not None:
            self._cache.set(cache_key, result)
        
        return result
    
    def get_by_id(self, record_id: int) -> dict:
        """Get a record by ID or raise RecordNotFoundError."""
        row = self.find_by_id(record_id)
        if row is None:
            raise RecordNotFoundError(self.table_name, record_id)
        return row
    
    # ==================== BATCH OPERATIONS ====================
    
    def find_by_ids(self, ids: List[int]) -> List[dict]:
        """
        Find multiple records by IDs in a single query.
        
        This reduces N round-trips to 1, critical for network latency.
        """
        if not ids:
            return []
        
        # Check cache first
        cached_results = {}
        uncached_ids = []
        
        for id_ in ids:
            cache_key = self._get_cache_key("find_by_id", id_)
            cached = self._cache.get(cache_key)
            if cached is not None:
                cached_results[id_] = cached
            else:
                uncached_ids.append(id_)
        
        # Fetch uncached records in single query
        if uncached_ids:
            placeholders = ','.join('?' * len(uncached_ids))
            sql = f"SELECT * FROM {self.table_name} WHERE {self.pk_column} IN ({placeholders})"
            rows = self.db.fetch_all(sql, uncached_ids)
            
            # Cache results
            for row in rows:
                record_id = row[self.pk_column]
                cache_key = self._get_cache_key("find_by_id", record_id)
                self._cache.set(cache_key, row)
                cached_results[record_id] = row
        
        # Return in original order
        return [cached_results.get(id_) for id_ in ids if id_ in cached_results]
    
    def insert_batch(self, data_list: List[dict]) -> List[int]:
        """
        Insert multiple records in a single batch operation.
        
        Reduces N round-trips to 1 for bulk inserts.
        """
        if not data_list:
            return []
        
        columns = list(data_list[0].keys())
        placeholders = ','.join('?' * len(columns))
        col_list = ', '.join(columns)
        sql = f"INSERT INTO {self.table_name} ({col_list}) VALUES ({placeholders})"
        
        # Prepare parameter sequences
        params_list = [tuple(row[col] for col in columns) for row in data_list]
        
        self.db.executemany(sql, params_list)
        
        # Get last inserted IDs (SQLite specific)
        # Note: For truly batch ID retrieval, you'd need ROWID per insert
        last_id = self.db.last_insert_id()
        start_id = last_id - len(data_list) + 1
        ids = list(range(start_id, last_id + 1))
        
        # Invalidate cache
        self._invalidate_cache()
        
        self._logger.info(f"Batch insert: {len(data_list)} records into {self.table_name}")
        return ids
    
    def update_batch(self, updates: List[dict], id_field: str = "id") -> int:
        """
        Update multiple records efficiently.
        
        Args:
            updates: List of dicts with id_field and fields to update
            id_field: Name of the ID field (default "id")
        
        Returns:
            Number of records updated
        """
        if not updates:
            return 0
        
        count = 0
        batch_size = 100  # Process in batches
        
        for i in range(0, len(updates), batch_size):
            batch = updates[i:i + batch_size]
            
            for update_data in batch:
                record_id = update_data.pop(id_field, None)
                if record_id is None:
                    continue
                
                self.update(record_id, update_data)
                count += 1
        
        self._logger.info(f"Batch update: {count} records in {self.table_name}")
        return count
    
    def delete_batch(self, ids: List[int]) -> int:
        """Delete multiple records in a single query."""
        if not ids:
            return 0
        
        placeholders = ','.join('?' * len(ids))
        sql = f"DELETE FROM {self.table_name} WHERE {self.pk_column} IN ({placeholders})"
        
        self.db.execute(sql, ids)
        self._invalidate_cache()
        
        self._logger.info(f"Batch delete: {len(ids)} records from {self.table_name}")
        return len(ids)
    
    # ==================== QUERY OPERATIONS ====================
    
    def find_all(
        self,
        active_only: bool = False,
        order_by: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> List[dict]:
        """Find all records with optional filtering and pagination."""
        conditions = []
        params = []
        
        if active_only:
            conditions.append("is_active = 1")
        
        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)
        
        order_clause = ""
        if order_by:
            order_clause = f"ORDER BY {order_by}"
        
        limit_clause = ""
        if limit is not None:
            limit_clause = f"LIMIT {limit}"
            if offset is not None:
                limit_clause += f" OFFSET {offset}"
        
        sql = f"SELECT * FROM {self.table_name} {where_clause} {order_clause} {limit_clause}"
        
        cache_key = self._get_cache_key("find_all", active_only, order_by, limit, offset)
        cached = self._cache.get(cache_key)
        
        if cached is not None:
            return cached
        
        result = self.db.fetch_all(sql, params)
        self._cache.set(cache_key, result)
        
        return result
    
    def find_with_pagination(
        self,
        page: int = 1,
        page_size: int = 50,
        order_by: Optional[str] = None,
        **filters
    ) -> dict:
        """
        Find records with pagination.
        
        Returns:
            dict with 'items', 'total', 'page', 'page_size', 'total_pages'
        """
        # Build WHERE clause from filters
        conditions = []
        params = []
        
        for key, value in filters.items():
            if value is not None:
                conditions.append(f"{key} = ?")
                params.append(value)
        
        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)
        
        # Get total count
        count_sql = f"SELECT COUNT(*) as cnt FROM {self.table_name} {where_clause}"
        total_result = self.db.fetch_one(count_sql, params)
        total = total_result['cnt'] if total_result else 0
        
        # Calculate pagination
        offset = (page - 1) * page_size
        order_clause = f"ORDER BY {order_by}" if order_by else ""
        
        # Get page items
        items_sql = f"""
            SELECT * FROM {self.table_name} 
            {where_clause} 
            {order_clause}
            LIMIT ? OFFSET ?
        """
        items_params = params + [page_size, offset]
        items = self.db.fetch_all(items_sql, items_params)
        
        return {
            'items': items,
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size if total > 0 else 0
        }
    
    def count(self, where_clause: str = "", params: tuple = ()) -> int:
        """Count records matching criteria."""
        sql = f"SELECT COUNT(*) as cnt FROM {self.table_name}"
        if where_clause:
            sql += f" WHERE {where_clause}"
        
        result = self.db.fetch_one(sql, params)
        return result['cnt'] if result else 0
    
    # ==================== CRUD OPERATIONS ====================
    
    def insert(self, data: dict) -> int:
        """Insert a single record."""
        columns = list(data.keys())
        placeholders = ','.join('?' * len(columns))
        col_list = ', '.join(columns)
        sql = f"INSERT INTO {self.table_name} ({col_list}) VALUES ({placeholders})"
        
        try:
            self.db.execute(sql, tuple(data.values()))
            record_id = self.db.last_insert_id()
            
            # Invalidate cache
            self._invalidate_cache()
            
            return record_id
        except Exception as e:
            self._logger.exception(f"Insert failed on {self.table_name}")
            raise
    
    def update(self, record_id: int, data: dict) -> None:
        """Update a single record."""
        if not data:
            return
        
        set_clause = ', '.join(f"{col} = ?" for col in data.keys())
        sql = f"UPDATE {self.table_name} SET {set_clause} WHERE {self.pk_column} = ?"
        
        try:
            self.db.execute(sql, tuple(data.values()) + (record_id,))
            
            # Invalidate cache
            self._invalidate_cache()
            
            # Update specific cache entry if it exists
            cache_key = self._get_cache_key("find_by_id", record_id)
            self._cache.delete(cache_key)
            
        except Exception as e:
            self._logger.exception(f"Update failed on {self.table_name} id={record_id}")
            raise
    
    def delete(self, record_id: int) -> None:
        """Physical delete a record."""
        sql = f"DELETE FROM {self.table_name} WHERE {self.pk_column} = ?"
        self.db.execute(sql, (record_id,))
        
        # Invalidate cache
        self._invalidate_cache()
    
    def deactivate(self, record_id: int) -> None:
        """Soft delete by setting is_active = 0."""
        self.update(record_id, {"is_active": 0})
    
    def exists(self, record_id: int) -> bool:
        """Check if a record exists."""
        return self.find_by_id(record_id) is not None
    
    # ==================== RELATION LOADING ====================
    
    def load_relations(
        self,
        records: List[dict],
        relation_map: dict,
        eager: bool = True
    ) -> List[dict]:
        """
        Load related records for a list of parent records.
        
        Args:
            records: List of parent records
            relation_map: Dict mapping relation name to (foreign_table, foreign_key, local_key)
            eager: If True, use batch loading; if False, lazy load per record
        
        Returns:
            Records with relations attached
        
        Example:
            relation_map = {
                'customer': ('parties', 'customer_id', 'id'),
                'items': ('sales_invoice_items', 'sales_invoice_id', 'id')
            }
        """
        if not records or not eager:
            return records
        
        for relation_name, (foreign_table, foreign_key, local_key) in relation_map.items():
            # Collect all foreign keys
            foreign_keys = [r.get(local_key) for r in records if r.get(local_key)]
            
            if not foreign_keys:
                continue
            
            # Batch load all related records
            placeholders = ','.join('?' * len(foreign_keys))
            sql = f"SELECT * FROM {foreign_table} WHERE {foreign_key} IN ({placeholders})"
            related_rows = self.db.fetch_all(sql, foreign_keys)
            
            # Group by foreign key
            grouped = {}
            for row in related_rows:
                fk_value = row[foreign_key]
                if fk_value not in grouped:
                    grouped[fk_value] = []
                grouped[fk_value].append(row)
            
            # Attach to parent records
            for record in records:
                local_value = record.get(local_key)
                setattr(record, relation_name, grouped.get(local_value, []))
        
        return records
