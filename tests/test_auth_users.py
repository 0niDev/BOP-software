"""Tests for auth/session: AuthService, UserRepository, RoleRepository and the
AuthController login/logout/change-password flows."""
from __future__ import annotations

import pytest

from authentication.auth_service import AuthService
from repositories.user_repository import UserRepository, RoleRepository
from utils.exceptions import AuthenticationError, ValidationError


@pytest.fixture()
def svc(qa_db):
    return AuthService(qa_db)


class TestUserRepository:
    def test_find_by_username(self, qa_db):
        repo = UserRepository(qa_db)
        row = repo.find_by_username("admin")
        assert row is not None
        assert row["role_name"] == "Admin"
        assert repo.find_by_username("ghost") is None

    def test_find_all_with_roles(self, qa_db):
        repo = UserRepository(qa_db)
        rows = repo.find_all_with_roles()
        assert any(r["username"] == "admin" for r in rows)

    def test_update_last_login(self, qa_db):
        repo = UserRepository(qa_db)
        uid = qa_db.fetch_one("SELECT id FROM users WHERE username='admin'")["id"]
        repo.update_last_login(uid)
        row = qa_db.fetch_one("SELECT last_login_at FROM users WHERE id=?", (uid,))
        assert row["last_login_at"] is not None

    def test_update_password(self, qa_db):
        repo = UserRepository(qa_db)
        uid = qa_db.fetch_one("SELECT id FROM users WHERE username='admin'")["id"]
        repo.update_password(uid, "aabb", "ccdd")
        row = qa_db.fetch_one("SELECT password_hash, password_salt FROM users WHERE id=?", (uid,))
        assert row["password_hash"] == "ccdd"
        assert row["password_salt"] == "aabb"


class TestRoleRepository:
    def test_find_by_name(self, qa_db):
        repo = RoleRepository(qa_db)
        assert repo.find_by_name("Admin")["name"] == "Admin"
        assert repo.find_by_name("Manager")["name"] == "Manager"
        assert repo.find_by_name("Nope") is None


class TestAuthService:
    def test_login_admin(self, svc):
        user = svc.login("admin", "admin123")
        assert user.username == "admin"
        assert user.role_name == "Admin"
        assert svc.current_user.username == "admin"

    def test_login_strips_username(self, svc):
        user = svc.login("  admin  ", "admin123")
        assert user is not None

    def test_login_wrong_password(self, svc):
        with pytest.raises(AuthenticationError):
            svc.login("admin", "wrong")

    def test_login_unknown_user(self, svc):
        with pytest.raises(AuthenticationError):
            svc.login("nobody", "nopass")

    def test_logout(self, svc):
        svc.login("admin", "admin123")
        assert svc.current_user is not None
        svc.logout()
        assert svc.current_user is None

    def test_change_password(self, svc, admin_user_id):
        svc.login("admin", "admin123")
        svc.change_password(admin_user_id, "admin123", "newpass1")
        # old password no longer works
        with pytest.raises(AuthenticationError):
            svc.login("admin", "admin123")
        # new password works
        assert svc.login("admin", "newpass1") is not None

    def test_change_password_requires_length(self, svc, admin_user_id):
        with pytest.raises(ValidationError):
            svc.change_password(admin_user_id, "admin123", "short")

    def test_change_password_wrong_current(self, svc, admin_user_id):
        with pytest.raises(AuthenticationError):
            svc.change_password(admin_user_id, "not-the-current", "newpass1")


class TestAuthController:
    def test_login_matches_ui_contract(self, qa_db):
        from controllers.auth_controller import AuthController
        ctrl = AuthController()
        user, error = ctrl.login("admin", "admin123")
        assert user is not None
        assert error is None

    def test_login_failure_returns_error(self, qa_db):
        from controllers.auth_controller import AuthController
        ctrl = AuthController()
        user, error = ctrl.login("admin", "bad")
        assert user is None
        assert error is not None

    def test_current_user(self, qa_db):
        from controllers.auth_controller import AuthController
        ctrl = AuthController()
        ctrl.login("admin", "admin123")
        assert ctrl.current_user is not None

    def test_logout(self, qa_db):
        from controllers.auth_controller import AuthController
        ctrl = AuthController()
        ctrl.login("admin", "admin123")
        ctrl.logout()
        assert ctrl.current_user is None

    def test_get_all_users(self, qa_db):
        from controllers.auth_controller import AuthController
        ctrl = AuthController()
        users = ctrl.get_all_users()
        assert any(u["username"] == "admin" for u in users)

    def test_reset_password(self, qa_db, admin_user_id):
        from controllers.auth_controller import AuthController
        ctrl = AuthController()
        ok, err = ctrl.reset_password(admin_user_id, "reset123")
        assert ok is True and err is None
        assert AuthController().login("admin", "reset123")[0] is not None