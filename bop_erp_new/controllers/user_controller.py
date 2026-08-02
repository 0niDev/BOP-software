"""User Controller for BOP Nutraceuticals ERP."""

from typing import List, Optional
from models.user import User, UserRole
from services.user_service import UserService


class UserController:
    """Controller for user management operations."""
    
    def __init__(self, user_service: UserService):
        self.user_service = user_service
    
    def create_user(
        self,
        company_id: str,
        username: str,
        password: str,
        full_name: str,
        email: str,
        role: UserRole,
        phone: Optional[str] = None,
        is_active: bool = True
    ) -> tuple[bool, str, Optional[User]]:
        """Create a new user."""
        try:
            user = self.user_service.create_user(
                company_id=company_id,
                username=username,
                password=password,
                full_name=full_name,
                email=email,
                role=role,
                phone=phone,
                is_active=is_active
            )
            
            if user:
                return True, f"User {user.full_name} created successfully.", user
            else:
                return False, "Failed to create user.", None
                
        except Exception as e:
            return False, f"Error creating user: {str(e)}", None
    
    def get_user(self, user_id: str) -> Optional[User]:
        """Get user by ID."""
        try:
            return self.user_service.get_user(user_id)
        except Exception:
            return None
    
    def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username."""
        try:
            return self.user_service.get_user_by_username(username)
        except Exception:
            return None
    
    def update_user(
        self,
        user_id: str,
        full_name: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        role: Optional[UserRole] = None,
        is_active: Optional[bool] = None
    ) -> tuple[bool, str]:
        """Update existing user."""
        try:
            result = self.user_service.update_user(
                user_id=user_id,
                full_name=full_name,
                email=email,
                phone=phone,
                role=role,
                is_active=is_active
            )
            
            if result:
                return True, "User updated successfully."
            else:
                return False, "Failed to update user."
                
        except Exception as e:
            return False, f"Error updating user: {str(e)}"
    
    def change_password(
        self,
        user_id: str,
        old_password: str,
        new_password: str
    ) -> tuple[bool, str]:
        """Change user password."""
        try:
            result = self.user_service.change_password(
                user_id=user_id,
                old_password=old_password,
                new_password=new_password
            )
            
            if result:
                return True, "Password changed successfully."
            else:
                return False, "Failed to change password. Old password may be incorrect."
                
        except Exception as e:
            return False, f"Error changing password: {str(e)}"
    
    def reset_password(
        self,
        user_id: str,
        new_password: str
    ) -> tuple[bool, str]:
        """Reset user password (admin function)."""
        try:
            result = self.user_service.reset_password(
                user_id=user_id,
                new_password=new_password
            )
            
            if result:
                return True, "Password reset successfully."
            else:
                return False, "Failed to reset password."
                
        except Exception as e:
            return False, f"Error resetting password: {str(e)}"
    
    def get_all_users(self, company_id: str) -> List[User]:
        """Get all users for a company."""
        try:
            return self.user_service.get_all_users(company_id)
        except Exception:
            return []
    
    def get_users_by_role(
        self,
        company_id: str,
        role: UserRole
    ) -> List[User]:
        """Get users by role."""
        try:
            return self.user_service.get_users_by_role(company_id, role)
        except Exception:
            return []
    
    def deactivate_user(self, user_id: str) -> tuple[bool, str]:
        """Deactivate a user."""
        try:
            result = self.user_service.deactivate_user(user_id)
            
            if result:
                return True, "User deactivated successfully."
            else:
                return False, "Failed to deactivate user."
                
        except Exception as e:
            return False, f"Error deactivating user: {str(e)}"
    
    def activate_user(self, user_id: str) -> tuple[bool, str]:
        """Activate a user."""
        try:
            result = self.user_service.activate_user(user_id)
            
            if result:
                return True, "User activated successfully."
            else:
                return False, "Failed to activate user."
                
        except Exception as e:
            return False, f"Error activating user: {str(e)}"
    
    def get_user_permissions(self, user_id: str) -> List[str]:
        """Get all permissions for a user."""
        try:
            return self.user_service.get_user_permissions(user_id)
        except Exception:
            return []
    
    def has_permission(self, user_id: str, permission: str) -> bool:
        """Check if user has specific permission."""
        try:
            return self.user_service.has_permission(user_id, permission)
        except Exception:
            return False
