"""Controller for authentication flows. Keeps AuthService errors -> UI-friendly."""
from __future__ import annotations

from authentication.auth_service import AuthService
from models.user import User
from utils.exceptions import ERPException
from utils.logger import get_logger

logger = get_logger(__name__)


class AuthController:
    def __init__(self, auth_service: AuthService | None = None):
        self.auth_service = auth_service or AuthService()

    def login(self, username: str, password: str) -> tuple[User | None, str | None]:
        """Returns (user, error_message). Exactly one of the two is None."""
        try:
            user = self.auth_service.login(username, password)
            return user, None
        except ERPException as exc:
            return None, str(exc)
        except Exception:
            logger.exception("Unexpected error during login")
            return None, "An unexpected error occurred. Please try again."

    def logout(self) -> None:
        self.auth_service.logout()

    @property
    def current_user(self) -> User | None:
        return self.auth_service.current_user
    
    def get_all_users(self) -> list[dict]:
        """Get all users (for admin)."""
        from database.connection import get_db
        db = get_db()
        return db.fetch_all("""
            SELECT u.*, r.name as role_name
            FROM users u
            JOIN roles r ON r.id = u.role_id
            ORDER BY u.username
        """)
    
    def create_user(self, username: str, full_name: str, password: str, 
                    role_name: str, email: str | None = None) -> tuple[bool, str | None]:
        """Create a new user."""
        from database.connection import get_db
        from utils.security import hash_password
        
        db = get_db()
        
        # Check if username exists
        existing = db.fetch_one("SELECT id FROM users WHERE username = ?", (username,))
        if existing:
            return False, f"Username '{username}' already exists."
        
        # Get role
        role = db.fetch_one("SELECT id FROM roles WHERE name = ?", (role_name,))
        if not role:
            return False, f"Role '{role_name}' not found."
        
        # Hash password
        salt, pwd_hash = hash_password(password)
        
        # Insert user
        db.execute("""
            INSERT INTO users (username, full_name, email, password_hash, password_salt, role_id)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (username, full_name, email, pwd_hash, salt, role["id"]))
        
        logger.info(f"Created user: {username} ({role_name})")
        return True, None
    
    def update_user(self, user_id: int, full_name: str, email: str | None,
                    role_name: str, is_active: bool) -> tuple[bool, str | None]:
        """Update a user."""
        from database.connection import get_db
        
        db = get_db()
        
        # Get role
        role = db.fetch_one("SELECT id FROM roles WHERE name = ?", (role_name,))
        if not role:
            return False, f"Role '{role_name}' not found."
        
        db.execute("""
            UPDATE users 
            SET full_name = ?, email = ?, role_id = ?, is_active = ?
            WHERE id = ?
        """, (full_name, email, role["id"], 1 if is_active else 0, user_id))
        
        logger.info(f"Updated user id={user_id}")
        return True, None
    
    def reset_password(self, user_id: int, new_password: str) -> tuple[bool, str | None]:
        """Reset user password."""
        from database.connection import get_db
        from utils.security import hash_password
        
        if len(new_password) < 6:
            return False, "Password must be at least 6 characters."
        
        db = get_db()
        salt, pwd_hash = hash_password(new_password)
        
        db.execute("""
            UPDATE users SET password_hash = ?, password_salt = ?
            WHERE id = ?
        """, (pwd_hash, salt, user_id))
        
        logger.info(f"Reset password for user id={user_id}")
        return True, None