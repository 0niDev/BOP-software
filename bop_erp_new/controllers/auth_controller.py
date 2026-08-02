"""Authentication Controller for BOP Nutraceuticals ERP."""

from typing import Optional, Tuple
from PySide6.QtWidgets import QMessageBox
from services.user_service import UserService
from models.user import User, UserRole


class AuthController:
    """Controller for authentication and authorization."""
    
    def __init__(self, user_service: UserService):
        self.user_service = user_service
        self.current_user: Optional[User] = None
        self.is_authenticated = False
    
    def login(self, username: str, password: str) -> Tuple[bool, str]:
        """
        Authenticate user with username and password.
        
        Returns:
            Tuple of (success: bool, message: str)
        """
        try:
            user = self.user_service.authenticate(username, password)
            
            if user:
                self.current_user = user
                self.is_authenticated = True
                return True, f"Welcome, {user.full_name}!"
            else:
                return False, "Invalid username or password."
                
        except Exception as e:
            return False, f"Login error: {str(e)}"
    
    def logout(self) -> bool:
        """Log out current user."""
        self.current_user = None
        self.is_authenticated = False
        return True
    
    def get_current_user(self) -> Optional[User]:
        """Get currently logged in user."""
        return self.current_user
    
    def has_permission(self, permission: str) -> bool:
        """Check if current user has specific permission."""
        if not self.current_user:
            return False
        
        return self.user_service.has_permission(
            self.current_user.id, 
            permission
        )
    
    def has_role(self, role: UserRole) -> bool:
        """Check if current user has specific role."""
        if not self.current_user:
            return False
        
        return self.current_user.role == role
    
    def can_access_module(self, module: str) -> bool:
        """Check if user can access specific module."""
        if not self.current_user:
            return False
        
        # Module to permission mapping
        module_permissions = {
            'dashboard': ['view_dashboard'],
            'sales': ['view_sales_invoice', 'create_sales_invoice'],
            'purchase': ['view_purchase_invoice', 'create_purchase_invoice'],
            'inventory': ['view_stock', 'manage_stock'],
            'manufacturing': ['view_production', 'create_production'],
            'accounting': ['view_journal', 'create_journal'],
            'parties': ['view_party', 'manage_party'],
            'items': ['view_item', 'manage_item'],
            'users': ['view_user', 'manage_user'],
            'reports': ['view_reports']
        }
        
        permissions = module_permissions.get(module, [])
        return any(self.has_permission(p) for p in permissions)
    
    def get_accessible_modules(self) -> list:
        """Get list of modules accessible to current user."""
        if not self.current_user:
            return []
        
        all_modules = [
            'dashboard', 'sales', 'purchase', 'inventory',
            'manufacturing', 'accounting', 'parties', 'items',
            'users', 'reports'
        ]
        
        return [m for m in all_modules if self.can_access_module(m)]
