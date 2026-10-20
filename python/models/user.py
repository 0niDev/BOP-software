"""User / Role domain models."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

class UserRole(str, Enum):
    """User roles with their permissions."""
    ADMIN = "Admin"
    ACCOUNTANT = "Accountant"
    MANAGER = "Manager"
    STOREKEEPER = "Storekeeper"
    PRODUCTION_MANAGER = "Production Manager"
    VIEWER = "Viewer"  # ← ADD THIS

    @property
    def permissions(self) -> list[str]:
        """Get permissions for this role."""
        permissions_map = {
            UserRole.ADMIN: [
                "dashboard", "chart_of_accounts", "opening_balance", "parties",
                "inventory", "sales", "purchases", "manufacturing", "expenses",
                "assets", "payments", "banking", "reports", "backup", "settings", "users"
            ],
            UserRole.ACCOUNTANT: [
                "dashboard", "chart_of_accounts", "parties", "inventory", "sales", "purchases",
                "expenses", "payments", "banking", "reports"
            ],
            UserRole.MANAGER: [
                "dashboard", "parties", "inventory", "sales", "purchases",
                "manufacturing", "expenses", "reports"
            ],
            UserRole.STOREKEEPER: [
                "dashboard", "inventory", "purchases", "manufacturing"
            ],
            UserRole.PRODUCTION_MANAGER: [
                "inventory", "manufacturing"
            ],
            UserRole.VIEWER: [
                "dashboard", "reports"
            ],
        }
        return permissions_map.get(self, [])


@dataclass
class Role:
    id: int
    name: str
    description: str | None = None


@dataclass
class User:
    id: int
    username: str
    full_name: str
    role_id: int
    role_name: str | None = None
    email: str | None = None
    is_active: bool = True
    last_login_at: str | None = None

    @staticmethod
    def from_row(row: dict) -> "User":
        return User(
            id=row["id"],
            username=row["username"],
            full_name=row["full_name"],
            role_id=row["role_id"],
            role_name=row.get("role_name"),
            email=row.get("email"),
            is_active=bool(row["is_active"]),
            last_login_at=row.get("last_login_at"),
        )
    
    @property
    def permissions(self) -> list[str]:
        """Get permissions for this user's role."""
        try:
            role = UserRole(self.role_name)
            return role.permissions
        except (ValueError, TypeError):
            # Default to viewer if role not found
            return UserRole.VIEWER.permissions
    
    def can_access(self, module_key: str) -> bool:
        """Check if user can access a specific module."""
        return module_key in self.permissions