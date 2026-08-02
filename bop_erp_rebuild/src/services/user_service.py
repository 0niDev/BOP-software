"""
User Service - User management and authentication
Handles user CRUD, authentication, role assignment, and permissions.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
import hashlib
import os
import secrets

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from models.user import User, Role, Permission
from repositories.user_repository import UserRepository, RoleRepository, PermissionRepository
from database.connection_manager import get_connection


class UserServiceError(Exception):
    """Custom exception for user service errors."""
    pass


class UserService:
    """
    Handles all user management operations including:
    - User CRUD operations
    - Authentication (login/logout)
    - Password management
    - Role and permission assignment
    - Session management
    """
    
    def __init__(self, company_id: str):
        self.company_id = company_id
        self.user_repo = UserRepository()
        self.role_repo = RoleRepository()
        self.permission_repo = PermissionRepository()
    
    @staticmethod
    def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
        """
        Hash a password using PBKDF2-HMAC-SHA256.
        
        Returns:
            Tuple of (hashed_password, salt)
        """
        if salt is None:
            salt = secrets.token_hex(32)
        
        hashed = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            iterations=200000
        ).hex()
        
        return hashed, salt
    
    def create_user(
        self,
        username: str,
        email: str,
        password: str,
        full_name: str,
        role_id: str,
        phone: str = "",
        is_active: bool = True
    ) -> User:
        """
        Create a new user.
        """
        conn = None
        try:
            conn = get_connection()
            
            # Check if username exists
            existing = self.user_repo.get_by_username(conn, username, self.company_id)
            if existing:
                raise UserServiceError(f"Username {username} already exists")
            
            # Validate role
            role = self.role_repo.get_by_id(conn, role_id)
            if not role:
                raise UserServiceError(f"Role {role_id} not found")
            
            # Hash password
            hashed_password, salt = self.hash_password(password)
            
            user = User(
                id='',  # Set by repository
                company_id=self.company_id,
                username=username,
                email=email,
                password_hash=hashed_password,
                salt=salt,
                full_name=full_name,
                phone=phone,
                role_id=role_id,
                is_active=is_active,
                last_login=None,
                created_at=datetime.now()
            )
            
            self.user_repo.create(conn, user)
            self.user_repo.invalidate_cache()
            
            return user
            
        finally:
            if conn:
                conn.close()
    
    def authenticate(self, username: str, password: str) -> Optional[User]:
        """
        Authenticate a user with username and password.
        
        Returns:
            User object if successful, None otherwise
        """
        conn = None
        try:
            conn = get_connection()
            
            user = self.user_repo.get_by_username(conn, username, self.company_id)
            if not user:
                return None
            
            if not user.is_active:
                return None
            
            # Verify password
            hashed_password, _ = self.hash_password(password, user.salt)
            
            if hashed_password != user.password_hash:
                return None
            
            # Update last login
            user.last_login = datetime.now()
            self.user_repo.update(conn, user)
            
            return user
            
        finally:
            if conn:
                conn.close()
    
    def change_password(self, user_id: str, old_password: str, new_password: str) -> bool:
        """
        Change user's password.
        
        Returns:
            True if successful
        """
        conn = None
        try:
            conn = get_connection()
            
            user = self.user_repo.get_by_id(conn, user_id)
            if not user:
                raise UserServiceError("User not found")
            
            # Verify old password
            hashed_old, _ = self.hash_password(old_password, user.salt)
            if hashed_old != user.password_hash:
                raise UserServiceError("Current password is incorrect")
            
            # Hash new password
            hashed_new, salt = self.hash_password(new_password)
            
            user.password_hash = hashed_new
            user.salt = salt
            self.user_repo.update(conn, user)
            
            return True
            
        finally:
            if conn:
                conn.close()
    
    def reset_password(self, user_id: str, new_password: str) -> None:
        """
        Reset user's password (admin function).
        """
        conn = None
        try:
            conn = get_connection()
            
            user = self.user_repo.get_by_id(conn, user_id)
            if not user:
                raise UserServiceError("User not found")
            
            hashed_password, salt = self.hash_password(new_password)
            
            user.password_hash = hashed_password
            user.salt = salt
            self.user_repo.update(conn, user)
            
        finally:
            if conn:
                conn.close()
    
    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID."""
        conn = None
        try:
            conn = get_connection()
            return self.user_repo.get_by_id(conn, user_id)
        finally:
            if conn:
                conn.close()
    
    def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username."""
        conn = None
        try:
            conn = get_connection()
            return self.user_repo.get_by_username(conn, username, self.company_id)
        finally:
            if conn:
                conn.close()
    
    def get_all_users(self, is_active: bool = True) -> List[User]:
        """Get all users."""
        conn = None
        try:
            conn = get_connection()
            return self.user_repo.get_all(conn, self.company_id, is_active)
        finally:
            if conn:
                conn.close()
    
    def update_user(self, user_id: str, updates: Dict[str, Any]) -> User:
        """Update user details (excluding password)."""
        conn = None
        try:
            conn = get_connection()
            
            user = self.user_repo.get_by_id(conn, user_id)
            if not user:
                raise UserServiceError("User not found")
            
            # Prevent updating sensitive fields directly
            forbidden_fields = ['password_hash', 'salt', 'company_id']
            for field in forbidden_fields:
                updates.pop(field, None)
            
            for key, value in updates.items():
                if hasattr(user, key):
                    setattr(user, key, value)
            
            self.user_repo.update(conn, user)
            self.user_repo.invalidate_cache()
            
            return user
            
        finally:
            if conn:
                conn.close()
    
    def deactivate_user(self, user_id: str) -> None:
        """Deactivate a user."""
        self.update_user(user_id, {'is_active': False})
    
    def activate_user(self, user_id: str) -> None:
        """Activate a deactivated user."""
        self.update_user(user_id, {'is_active': True})
    
    def assign_role(self, user_id: str, role_id: str) -> User:
        """Assign a new role to a user."""
        conn = None
        try:
            conn = get_connection()
            
            # Validate role
            role = self.role_repo.get_by_id(conn, role_id)
            if not role:
                raise UserServiceError(f"Role {role_id} not found")
            
            user = self.user_repo.get_by_id(conn, user_id)
            if not user:
                raise UserServiceError("User not found")
            
            user.role_id = role_id
            self.user_repo.update(conn, user)
            
            return user
            
        finally:
            if conn:
                conn.close()
    
    def get_user_permissions(self, user_id: str) -> List[Permission]:
        """Get all permissions for a user based on their role."""
        conn = None
        try:
            conn = get_connection()
            
            user = self.user_repo.get_by_id(conn, user_id)
            if not user:
                return []
            
            role = self.role_repo.get_by_id(conn, user.role_id)
            if not role:
                return []
            
            return self.permission_repo.get_for_role(conn, role.id)
            
        finally:
            if conn:
                conn.close()
    
    def has_permission(self, user_id: str, permission_name: str) -> bool:
        """Check if user has a specific permission."""
        permissions = self.get_user_permissions(user_id)
        return any(p.name == permission_name for p in permissions)
    
    def create_role(self, name: str, description: str = "") -> Role:
        """Create a new role."""
        conn = None
        try:
            conn = get_connection()
            
            role = Role(
                id='',
                company_id=self.company_id,
                name=name,
                description=description,
                is_system_role=False,
                created_at=datetime.now()
            )
            
            self.role_repo.create(conn, role)
            self.role_repo.invalidate_cache()
            
            return role
            
        finally:
            if conn:
                conn.close()
    
    def get_all_roles(self) -> List[Role]:
        """Get all roles."""
        conn = None
        try:
            conn = get_connection()
            return self.role_repo.get_all(conn, self.company_id)
        finally:
            if conn:
                conn.close()
    
    def assign_permissions_to_role(self, role_id: str, permission_names: List[str]) -> None:
        """Assign permissions to a role."""
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            # Remove existing permissions
            self.permission_repo.remove_for_role(conn, role_id)
            
            # Add new permissions
            for perm_name in permission_names:
                # Get or create permission
                perm = self.permission_repo.get_by_name(conn, perm_name)
                if not perm:
                    perm = Permission(
                        id='',
                        name=perm_name,
                        description=f"Permission to {perm_name}",
                        created_at=datetime.now()
                    )
                    self.permission_repo.create(conn, perm)
                
                # Assign to role
                self.permission_repo.assign_to_role(conn, role_id, perm.id)
            
            conn.commit()
            self.role_repo.invalidate_cache()
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise UserServiceError(f"Failed to assign permissions: {str(e)}")
        finally:
            if conn:
                conn.close()
