"""
Authentication service.

Only one accountant uses the system today, but this is written as a
real username/password login against the `users` table (not a stub),
so Admin/Manager/Storekeeper/Production Manager roles and per-user
permissions (already modeled in roles/permissions/role_permissions)
can be turned on later without changing this module's public API.
"""
from __future__ import annotations

from database.connection import DatabaseConnection, get_db
from models.user import User
from repositories.user_repository import UserRepository
from utils.exceptions import AuthenticationError, ValidationError
from utils.logger import get_logger
from utils.security import hash_password, verify_password

logger = get_logger(__name__)


class AuthService:
    def __init__(self, db: DatabaseConnection | None = None):
        self.db = db or get_db()
        self.user_repo = UserRepository(self.db)
        self._current_user: User | None = None

    @property
    def current_user(self) -> User | None:
        return self._current_user

    def login(self, username: str, password: str) -> User:
        row = self.user_repo.find_by_username(username.strip())
        if row is None or not row["is_active"]:
            logger.warning("Failed login attempt for username=%s", username)
            raise AuthenticationError("Invalid username or password.")

        if not verify_password(password, row["password_salt"], row["password_hash"]):
            logger.warning("Failed login attempt for username=%s", username)
            raise AuthenticationError("Invalid username or password.")
        
        self.user_repo.update_last_login(row["id"])
        user = User.from_row(row)
        self._current_user = user
        logger.info("User '%s' logged in (role=%s)", user.username, user.role_name)
        return user

    def logout(self) -> None:
        if self._current_user:
            logger.info("User '%s' logged out", self._current_user.username)
        self._current_user = None

    def change_password(self, user_id: int, old_password: str, new_password: str) -> None:
        row = self.user_repo.get_by_id(user_id)
        if not verify_password(old_password, row["password_salt"], row["password_hash"]):
            raise AuthenticationError("Current password is incorrect.")
        if len(new_password) < 6:
            raise ValidationError("New password must be at least 6 characters.")
        salt, pwd_hash = hash_password(new_password)
        self.user_repo.update_password(user_id, salt, pwd_hash)
        logger.info("Password changed for user id=%s", user_id)
