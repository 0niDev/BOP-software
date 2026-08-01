"""Data access for users/roles."""
from __future__ import annotations

from repositories.base_repository import BaseRepository


class UserRepository(BaseRepository):
    table_name = "users"

    def find_by_username(self, username: str) -> dict | None:
        sql = f"SELECT u.*, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.username = '{username}'"
        return self.db.fetch_one(sql)

    def find_all_with_roles(self) -> list[dict]:
        return self.db.fetch_all(
            "SELECT u.*, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.username"
        )

    def update_last_login(self, user_id: int) -> None:
        self.db.execute(
            "UPDATE users SET last_login_at = datetime('now') WHERE id = ?", (user_id,)
        )

    def update_password(self, user_id: int, salt_hex: str, hash_hex: str) -> None:
        self.update(user_id, {"password_hash": hash_hex, "password_salt": salt_hex})


class RoleRepository(BaseRepository):
    table_name = "roles"

    def find_by_name(self, name: str) -> dict | None:
        return self.db.fetch_one("SELECT * FROM roles WHERE name = ?", (name,)) 