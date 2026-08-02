"""Base model class for all data models"""

from dataclasses import dataclass, field, asdict
from typing import Any, Optional
from datetime import datetime


@dataclass
class BaseModel:
    """Base class for all model objects with common utility methods"""
    
    id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def to_dict(self) -> dict[str, Any]:
        """Convert model to dictionary"""
        result = {}
        for key, value in asdict(self).items():
            if isinstance(value, datetime):
                result[key] = value.isoformat()
            elif hasattr(value, 'value'):  # Enum
                result[key] = value.value
            else:
                result[key] = value
        return result
    
    @classmethod
    def from_row(cls, row: dict | tuple, column_names: list[str] = None) -> 'BaseModel':
        """Create model instance from database row"""
        if isinstance(row, tuple) and column_names:
            row = dict(zip(column_names, row))
        
        field_names = {f.name for f in cls.__dataclass_fields__.values()}
        kwargs = {}
        
        for name in field_names:
            if name in row:
                value = row[name]
                # Handle datetime conversion
                if isinstance(value, str) and ('at' in name.lower()):
                    try:
                        value = datetime.fromisoformat(value)
                    except (ValueError, TypeError):
                        pass
                # Handle enum conversion
                field_type = cls.__dataclass_fields__[name].type
                if hasattr(field_type, '_member_map_'):
                    if value:
                        try:
                            value = field_type(value)
                        except (ValueError, TypeError):
                            pass
                    else:
                        value = None
                kwargs[name] = value
        
        return cls(**kwargs)
    
    def update_from(self, other: 'BaseModel') -> None:
        """Update fields from another model instance"""
        for field_name in self.__dataclass_fields__:
            if hasattr(other, field_name):
                value = getattr(other, field_name)
                if value is not None:
                    setattr(self, field_name, value)
