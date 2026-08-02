"""User, Role, and Permission repositories"""

from repositories.base_repository import BaseRepository
from models.user import User, Role, Permission, RolePermission
from database import db


class PermissionRepository(BaseRepository[Permission]):
    """Repository for Permission operations"""
    
    def __init__(self):
        super().__init__(Permission, 'permissions')
    
    def get_by_code(self, code: str) -> Permission | None:
        """Get permission by code"""
        return self.get_all("code = ?", (code,))[0] if self.exists("code = ?", (code,)) else None
    
    def get_by_module(self, module: str) -> list[Permission]:
        """Get all permissions for a module"""
        return self.get_all("module = ?", (module,), "name")


class RoleRepository(BaseRepository[Role]):
    """Repository for Role operations"""
    
    def __init__(self):
        super().__init__(Role, 'roles')
    
    def get_by_code(self, code: str, company_id: int) -> Role | None:
        """Get role by code and company"""
        roles = self.get_all("code = ? AND company_id = ?", (code, company_id))
        return roles[0] if roles else None
    
    def get_by_company(self, company_id: int) -> list[Role]:
        """Get all roles for a company"""
        return self.get_all("company_id = ?", (company_id,), "name")
    
    def get_permissions(self, role_id: int) -> list[int]:
        """Get permission IDs for a role"""
        rows = db.fetch_all(
            "SELECT permission_id FROM role_permissions WHERE role_id = ?",
            (role_id,)
        )
        return [row['permission_id'] for row in rows]
    
    def set_permissions(self, role_id: int, permission_ids: list[int]) -> bool:
        """Set permissions for a role"""
        with db.transaction() as cursor:
            # Remove existing permissions
            cursor.execute("DELETE FROM role_permissions WHERE role_id = ?", (role_id,))
            
            # Add new permissions
            for perm_id in permission_ids:
                cursor.execute(
                    "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
                    (role_id, perm_id)
                )
        
        self._invalidate_cache(role_id)
        return True
    
    def has_permission(self, role_id: int, permission_code: str) -> bool:
        """Check if a role has a specific permission"""
        query = """
            SELECT rp.id FROM role_permissions rp
            JOIN permissions p ON rp.permission_id = p.id
            WHERE rp.role_id = ? AND p.code = ?
        """
        result = db.fetch_one(query, (role_id, permission_code))
        return result is not None


class UserRepository(BaseRepository[User]):
    """Repository for User operations"""
    
    def __init__(self):
        super().__init__(User, 'users')
    
    def get_by_username(self, username: str) -> User | None:
        """Get user by username"""
        return self.get_all("username = ?", (username,))[0] \
            if self.exists("username = ?", (username,)) else None
    
    def get_by_email(self, email: str) -> User | None:
        """Get user by email"""
        users = self.get_all("email = ?", (email,))
        return users[0] if users else None
    
    def get_by_company(self, company_id: int) -> list[User]:
        """Get all users for a company"""
        return self.get_all("company_id = ?", (company_id,), "full_name")
    
    def get_active_users(self, company_id: int) -> list[User]:
        """Get all active users for a company"""
        return self.get_all("company_id = ? AND is_active = ?", (company_id, 1), "full_name")
    
    def validate_credentials(self, username: str, password_hash: str) -> User | None:
        """Validate user credentials"""
        user = self.get_by_username(username)
        if user and user.password_hash == password_hash and user.is_active:
            # Check if account is locked
            from datetime import datetime
            if user.locked_until and user.locked_until > datetime.now():
                return None
            return user
        return None
    
    def update_login(self, user_id: int) -> bool:
        """Update last login timestamp"""
        from datetime import datetime
        now = datetime.now().isoformat()
        db.execute(
            "UPDATE users SET last_login = ?, failed_attempts = 0 WHERE id = ?",
            (now, user_id)
        )
        self._invalidate_cache(user_id)
        return True
    
    def record_failed_attempt(self, user_id: int, lock_minutes: int = 30) -> bool:
        """Record a failed login attempt"""
        from datetime import datetime, timedelta
        user = self.get_by_id(user_id)
        if not user:
            return False
        
        new_attempts = user.failed_attempts + 1
        locked_until = None
        
        if new_attempts >= 5:
            locked_until = (datetime.now() + timedelta(minutes=lock_minutes)).isoformat()
        
        db.execute(
            """UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?""",
            (new_attempts, locked_until, user_id)
        )
        self._invalidate_cache(user_id)
        return True
    
    def unlock_account(self, user_id: int) -> bool:
        """Unlock a user account"""
        db.execute(
            "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?",
            (user_id,)
        )
        self._invalidate_cache(user_id)
        return True
