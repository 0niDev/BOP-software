"""Base repository with caching and common CRUD operations"""

from typing import Optional, List, Dict, Any, TypeVar, Generic
from datetime import datetime
import logging
from database import db
from models.base import BaseModel

logger = logging.getLogger(__name__)

T = TypeVar('T', bound=BaseModel)


class BaseRepository(Generic[T]):
    """Generic base repository with caching and CRUD operations"""
    
    def __init__(self, model_class: type[T], table_name: str):
        self.model_class = model_class
        self.table_name = table_name
        self._cache: Dict[int, tuple[datetime, T]] = {}
        self._cache_ttl_seconds = 30
    
    def _is_cache_valid(self, key: int) -> bool:
        """Check if cached item is still valid"""
        if key not in self._cache:
            return False
        timestamp, _ = self._cache[key]
        return (datetime.now() - timestamp).total_seconds() < self._cache_ttl_seconds
    
    def _invalidate_cache(self, key: int = None) -> None:
        """Invalidate cache for specific key or all keys"""
        if key is not None and key in self._cache:
            del self._cache[key]
        elif key is None:
            self._cache.clear()
    
    def get_by_id(self, id: int) -> Optional[T]:
        """Get a single record by ID with caching"""
        # Check cache first
        if self._is_cache_valid(id):
            return self._cache[id][1]
        
        query = f"SELECT * FROM {self.table_name} WHERE id = ?"
        row = db.fetch_one(query, (id,))
        
        if row:
            model = self.model_class.from_row(row)
            self._cache[id] = (datetime.now(), model)
            return model
        return None
    
    def get_all(self, where_clause: str = None, params: tuple = (), 
                order_by: str = "id", limit: int = None) -> List[T]:
        """Get all records with optional filtering"""
        query = f"SELECT * FROM {self.table_name}"
        
        if where_clause:
            query += f" WHERE {where_clause}"
        
        query += f" ORDER BY {order_by}"
        
        if limit:
            query += f" LIMIT {limit}"
        
        rows = db.fetch_all(query, params)
        return [self.model_class.from_row(row) for row in rows]
    
    def get_count(self, where_clause: str = None, params: tuple = ()) -> int:
        """Get count of records with optional filtering"""
        query = f"SELECT COUNT(*) as count FROM {self.table_name}"
        
        if where_clause:
            query += f" WHERE {where_clause}"
        
        result = db.fetch_one(query, params)
        return result['count'] if result else 0
    
    def create(self, model: T) -> int:
        """Create a new record"""
        columns = []
        placeholders = []
        values = []
        
        for field_name, field_obj in model.__dataclass_fields__.items():
            value = getattr(model, field_name)
            
            # Skip id, created_at, updated_at (auto-managed)
            if field_name in ['id', 'created_at', 'updated_at']:
                continue
            
            # Skip list fields (handled separately)
            if isinstance(value, list):
                continue
            
            # Handle enum types
            if hasattr(value, 'value'):
                value = value.value
            
            # Handle datetime
            if isinstance(value, datetime):
                value = value.isoformat()
            
            columns.append(field_name)
            placeholders.append('?')
            values.append(value)
        
        columns_str = ', '.join(columns)
        placeholders_str = ', '.join(placeholders)
        
        query = f"""
            INSERT INTO {self.table_name} ({columns_str})
            VALUES ({placeholders_str})
        """
        
        db.execute(query, tuple(values))
        new_id = db.get_last_insert_id()
        model.id = new_id
        
        # Set timestamps
        model.created_at = datetime.now()
        model.updated_at = datetime.now()
        
        # Update cache
        self._cache[new_id] = (datetime.now(), model)
        
        logger.info(f"Created {self.table_name} record with ID {new_id}")
        return new_id
    
    def update(self, model: T) -> bool:
        """Update an existing record"""
        if not model.id:
            raise ValueError("Cannot update model without ID")
        
        set_clauses = []
        values = []
        
        for field_name, field_obj in model.__dataclass_fields__.items():
            # Skip id and auto-managed fields
            if field_name in ['id', 'created_at']:
                continue
            
            value = getattr(model, field_name)
            
            # Skip list fields (handled separately)
            if isinstance(value, list):
                continue
            
            # Handle enum types
            if hasattr(value, 'value'):
                value = value.value
            
            # Handle datetime
            if isinstance(value, datetime):
                value = value.isoformat()
            
            set_clauses.append(f"{field_name} = ?")
            values.append(value)
        
        # Add updated_at
        model.updated_at = datetime.now()
        set_clauses.append("updated_at = ?")
        values.append(model.updated_at.isoformat())
        
        values.append(model.id)
        
        set_clause = ', '.join(set_clauses)
        query = f"""
            UPDATE {self.table_name}
            SET {set_clause}
            WHERE id = ?
        """
        
        rows_affected = db.execute(query, tuple(values))
        
        # Invalidate cache
        self._invalidate_cache(model.id)
        
        logger.info(f"Updated {self.table_name} record with ID {model.id}")
        return rows_affected > 0
    
    def delete(self, id: int) -> bool:
        """Delete a record by ID"""
        query = f"DELETE FROM {self.table_name} WHERE id = ?"
        rows_affected = db.execute(query, (id,))
        
        # Invalidate cache
        self._invalidate_cache(id)
        
        logger.info(f"Deleted {self.table_name} record with ID {id}")
        return rows_affected > 0
    
    def exists(self, where_clause: str, params: tuple = ()) -> bool:
        """Check if any record matches the condition"""
        count = self.get_count(where_clause, params)
        return count > 0
    
    def search(self, search_term: str, search_columns: List[str]) -> List[T]:
        """Search across multiple columns"""
        conditions = [f"{col} LIKE ?" for col in search_columns]
        where_clause = " OR ".join(conditions)
        params = tuple([f"%{search_term}%"] * len(search_columns))
        return self.get_all(where_clause, params)
