"""User, Role, and Permission models for authentication and authorization"""

from dataclasses import dataclass, field
from typing import Optional, List
from datetime import datetime
from models.base import BaseModel


@dataclass
class Permission(BaseModel):
    """System permission entity"""
    
    name: str = ""
    code: str = ""
    description: str = ""
    module: str = ""
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT UNIQUE NOT NULL,
            description TEXT,
            module TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """


@dataclass
class Role(BaseModel):
    """User role entity"""
    
    name: str = ""
    code: str = ""
    description: str = ""
    company_id: int = 0
    is_system: bool = False
    permissions: List[int] = field(default_factory=list)
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT UNIQUE NOT NULL,
            description TEXT,
            company_id INTEGER NOT NULL,
            is_system INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
        """


@dataclass
class RolePermission(BaseModel):
    """Mapping between roles and permissions"""
    
    role_id: int = 0
    permission_id: int = 0
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS role_permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role_id INTEGER NOT NULL,
            permission_id INTEGER NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
            FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
            UNIQUE(role_id, permission_id)
        )
        """


@dataclass
class User(BaseModel):
    """System user entity"""
    
    username: str = ""
    password_hash: str = ""
    email: str = ""
    full_name: str = ""
    phone: str = ""
    role_id: int = 0
    company_id: int = 0
    is_active: bool = True
    last_login: Optional[datetime] = None
    failed_attempts: int = 0
    locked_until: Optional[datetime] = None
    
    @classmethod
    def get_create_table_sql(cls) -> str:
        return """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT UNIQUE,
            full_name TEXT,
            phone TEXT,
            role_id INTEGER NOT NULL,
            company_id INTEGER NOT NULL,
            is_active INTEGER DEFAULT 1,
            last_login TEXT,
            failed_attempts INTEGER DEFAULT 0,
            locked_until TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (role_id) REFERENCES roles(id),
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
        """
