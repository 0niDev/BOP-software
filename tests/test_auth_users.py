"""Authentication, users & role navigation (headless - same code the UI calls)."""
from __future__ import annotations

import pytest

from helpers import books


def test_login_success_admin(qa_db):
    from controllers.auth_controller import AuthController

    c = AuthController()
    user, err = c.login("admin", "admin123")
    assert err is None
    assert user is not None and user.username == "admin"
    assert c.current_user is not None


def test_login_wrong_password_fails(qa_db):
    from controllers.auth_controller import AuthController

    user, err = AuthController().login("admin", "wrong-password")
    assert user is None
    assert "Invalid username or password." in err


def test_login_unknown_user_fails(qa_db):
    from controllers.auth_controller import AuthController

    user, err = AuthController().login("ghost", "x")
    assert user is None and err


def test_logout_clears_current_user(qa_db, auth):
    controller, user = auth
    assert controller.current_user is not None
    controller.logout()
    assert controller.current_user is None


def test_create_update_reset_deactivate_user(qa_db):
    from controllers.auth_controller import AuthController

    c = AuthController()
    ok, err = c.create_user("manager1", "Manager One", "secret1", "Manager", "m@x.com")
    assert ok, err
    row = qa_db.fetch_one("SELECT id, role_id FROM users WHERE username='manager1'")
    uid = row["id"]
    # role assigned to Manager
    role = qa_db.fetch_one("SELECT name FROM roles WHERE id=?", (row["role_id"],))
    assert role["name"] == "Manager"

    ok, err = c.update_user(uid, "Manager One Renamed", "m2@x.com", "Accountant", True)
    assert ok, err
    assert qa_db.fetch_one("SELECT full_name FROM users WHERE id=?", (uid,))["full_name"] == "Manager One Renamed"

    ok, err = c.reset_password(uid, "newpass1")
    assert ok, err
    ok, err = c.reset_password(uid, "123")  # too short
    assert not ok and "at least 6" in err

    # new password now logs in
    u2, err2 = c.login("manager1", "newpass1")
    assert u2 is not None and err2 is None
    c.logout()


def test_duplicate_username_rejected(qa_db):
    from controllers.auth_controller import AuthController

    ok, err = AuthController().create_user("admin", "Other", "secret1", "Manager")
    assert not ok
    assert "already exists" in err


def test_all_seeded_roles_present(qa_db):
    names = {r["name"] for r in qa_db.fetch_all("SELECT name FROM roles")}
    assert {"Admin", "Accountant", "Manager", "Storekeeper", "Production Manager"} <= names


def test_role_nav_permissions():
    from models.user import UserRole

    assert "reports" in UserRole.VIEWER.permissions and "sales" not in UserRole.VIEWER.permissions
    assert "users" in UserRole.ADMIN.permissions and "users" not in UserRole.ACCOUNTANT.permissions
    assert "manufacturing" in UserRole.PRODUCTION_MANAGER.permissions
    assert "inventory" in UserRole.STOREKEEPER.permissions


def test_last_login_updated(qa_db, auth):
    controller, user = auth
    row = qa_db.fetch_one("SELECT last_login_at FROM users WHERE id=?", (user.id,))
    assert row["last_login_at"] is not None


def test_auth_users_table_crud_leaves_books_balanced(qa_db):
    from controllers.auth_controller import AuthController

    AuthController().create_user("temp", "Temp User", "secret1", "Storekeeper")
    AuthController().update_user(
        qa_db.fetch_one("SELECT id FROM users WHERE username='temp'")["id"],
        "Temp Two", None, "Storekeeper", False)
    books.assert_books_balanced(qa_db)
