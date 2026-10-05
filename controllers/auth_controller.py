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
        return self.auth_service.list_users()

    def get_user(self, user_id: int) -> dict | None:
        """Get one user (with role name) or None."""
        return self.auth_service.get_user(user_id)

    def create_user(self, username: str, full_name: str, password: str,
                    role_name: str, email: str | None = None,
                    is_active: bool = True) -> tuple[bool, str | None]:
        """Create a new user."""
        try:
            self.auth_service.create_user(username, full_name, password,
                                          role_name, email, is_active)
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error creating user")
            return False, "An unexpected error occurred."

    def update_user(self, user_id: int, full_name: str, email: str | None,
                    role_name: str, is_active: bool) -> tuple[bool, str | None]:
        """Update a user."""
        try:
            self.auth_service.update_user(user_id, full_name, email,
                                          role_name, is_active)
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error updating user")
            return False, "An unexpected error occurred."

    def reset_password(self, user_id: int, new_password: str) -> tuple[bool, str | None]:
        """Reset user password."""
        try:
            self.auth_service.reset_password(user_id, new_password)
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error resetting password")
            return False, "An unexpected error occurred."