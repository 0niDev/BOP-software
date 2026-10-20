"""Pure unit tests - no database. Cover models, enums, security, exceptions,
event bus, cache manager and the pure helper functions."""
from __future__ import annotations

import pytest
from datetime import date, datetime

from models.enums import (
    AccountType, PartyType, PaymentMethod, VoucherType, DocumentStatus,
)
from models.user import UserRole, User, Role


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TestEnums:
    def test_account_type_labels(self):
        assert AccountType.ASSET.label == "Asset"
        assert AccountType.REVENUE.label == "Revenue"

    def test_normal_balance(self):
        assert AccountType.ASSET.normal_balance_is_debit is True
        assert AccountType.EXPENSE.normal_balance_is_debit is True
        assert AccountType.LIABILITY.normal_balance_is_debit is False
        assert AccountType.EQUITY.normal_balance_is_debit is False
        assert AccountType.REVENUE.normal_balance_is_debit is False

    def test_party_type_values(self):
        assert PartyType.CUSTOMER.value == "CUSTOMER"
        assert PartyType.BOTH.value == "BOTH"

    def test_payment_method_members(self):
        assert {m.value for m in PaymentMethod} == {"CASH", "BANK", "CHEQUE", "CREDIT"}

    def test_voucher_type_members(self):
        assert VoucherType.SALES.value == "SALES"
        assert VoucherType.MANUFACTURING.value == "MANUFACTURING"
        assert VoucherType.OPENING.value == "OPENING"

    def test_document_status_values(self):
        assert DocumentStatus.DRAFT.value == "DRAFT"
        assert DocumentStatus.CONFIRMED.value == "CONFIRMED"


# ---------------------------------------------------------------------------
# User / Role model + permission logic
# ---------------------------------------------------------------------------

class TestUserModel:
    def test_role_permissions_by_role(self):
        perms = UserRole.ADMIN.permissions
        assert "users" in perms and "dashboard" in perms
        assert "sales" in UserRole.ACCOUNTANT.permissions
        assert "manufacturing" in UserRole.PRODUCTION_MANAGER.permissions
        assert set(UserRole.VIEWER.permissions) == {"dashboard", "reports"}

    def test_unknown_role_falls_back_to_viewer(self):
        user = User(id=1, username="x", full_name="X", role_id=99, role_name="Nope")
        assert user.permissions == UserRole.VIEWER.permissions

    def test_from_row(self):
        row = {
            "id": 2, "username": "alice", "full_name": "Alice", "role_id": 1,
            "role_name": "Accountant", "email": "a@b.c", "is_active": 1,
            "last_login_at": "2024-01-01 10:00:00",
        }
        u = User.from_row(row)
        assert u.id == 2
        assert u.email == "a@b.c"
        assert u.is_active is True
        assert u.can_access("sales") is True
        assert u.can_access("users") is False

    def test_can_access(self):
        u = User(id=1, username="a", full_name="A", role_id=1, role_name="Admin")
        assert u.can_access("reports")
        assert not u.can_access("does_not_exist")

    def test_role_dataclass(self):
        r = Role(id=1, name="Admin", description="Full access")
        assert r.name == "Admin"
        assert Role(2, "Manager") == Role(2, "Manager")
# ---------------------------------------------------------------------------
# Security (hashing / verification)
# ---------------------------------------------------------------------------

class TestSecurity:
    def test_hash_password_returns_salt_and_hash(self):
        from utils.security import hash_password
        salt, pwd_hash = hash_password("s3cret")
        assert len(salt) == 32  # 16 bytes hex
        assert pwd_hash  # non-empty

    def test_salt_is_random(self):
        from utils.security import hash_password
        s1, _ = hash_password("pw")
        s2, _ = hash_password("pw")
        assert s1 != s2

    def test_deterministic_with_fixed_salt(self):
        from utils.security import hash_password
        s1, h1 = hash_password("pw", "aabb")
        s2, h2 = hash_password("pw", "aabb")
        assert s1 == s2 == "aabb"
        assert h1 == h2

    def test_verify_password_correct(self):
        from utils.security import hash_password, verify_password
        salt, pwd_hash = hash_password("my-password")
        assert verify_password("my-password", salt, pwd_hash) is True

    def test_verify_password_wrong(self):
        from utils.security import hash_password, verify_password
        salt, pwd_hash = hash_password("my-password")
        assert verify_password("wrong", salt, pwd_hash) is False


# ---------------------------------------------------------------------------
# Exception hierarchy
# ---------------------------------------------------------------------------

class TestExceptions:
    def test_hierarchy(self):
        from utils.exceptions import (
            ERPException, DatabaseError, RecordNotFoundError, ValidationError,
            DuplicateRecordError, InsufficientStockError,
            UnbalancedJournalEntryError, AuthenticationError, AuthorizationError,
            ConfigurationError,
        )
        for cls in (
            DatabaseError, RecordNotFoundError, ValidationError,
            DuplicateRecordError, InsufficientStockError,
            UnbalancedJournalEntryError, AuthenticationError, AuthorizationError,
            ConfigurationError,
        ):
            assert issubclass(cls, ERPException)

    def test_validation_error_message(self):
        from utils.exceptions import ValidationError
        e = ValidationError("bad input")
        assert str(e) == "bad input"


# ---------------------------------------------------------------------------
# Event bus (singleton pub/sub)
# ---------------------------------------------------------------------------

class TestEventBus:
    def test_subscribe_emit(self):
        from utils.event_bus import EventBus
        bus = EventBus()
        bus.clear()
        received = []
        bus.subscribe("item.saved", lambda data: received.append(data))
        bus.emit("item.saved", {"id": 1})
        assert received == [{"id": 1}]
        bus.clear()

    def test_emit_without_subscriber_is_noop(self):
        from utils.event_bus import EventBus
        EventBus().clear()
        EventBus().emit("nobody.home", {"x": 1})  # should not raise
        EventBus().clear()

    def test_unsubscribe(self):
        from utils.event_bus import EventBus
        bus = EventBus()
        bus.clear()
        calls = []

        def cb(data):
            calls.append(data)

        bus.subscribe("e", cb)
        bus.emit("e", 1)
        bus.unsubscribe("e", cb)
        bus.emit("e", 2)
        assert calls == [1]
        bus.clear()

    def test_handler_exception_swallowed(self):
        from utils.event_bus import EventBus
        bus = EventBus()
        bus.clear()
        calls = []

        def bad(data):
            raise RuntimeError("boom")

        def good(data):
            calls.append(data)

        bus.subscribe("e", bad)
        bus.subscribe("e", good)
        bus.emit("e", "x")
        assert calls == ["x"]
        bus.clear()


# ---------------------------------------------------------------------------
# Pure helper functions (formatting / validation / safe_get)
# ---------------------------------------------------------------------------

class TestHelperFunctions:
    def test_format_currency_pkr(self):
        from utils.helpers import format_currency
        assert format_currency(1234.5) == "Rs. 1,234.50"
        assert format_currency(0) == "Rs. 0.00"

    def test_format_currency_other(self):
        from utils.helpers import format_currency
        assert format_currency(5, "USD") == "$5.00"
        assert format_currency(5, "EUR") == "€5.00"
        assert format_currency(5, "ABC") == "ABC 5.00"

    def test_format_currency_handles_none_and_junk(self):
        from utils.helpers import format_currency
        assert format_currency(None) == "Rs. 0.00"
        assert format_currency("not-a-number") == "Rs. 0.00"

    def test_format_date(self):
        from utils.helpers import format_date
        assert format_date(date(2024, 3, 5)) == "2024-03-05"
        assert format_date("2024-03-05") == "2024-03-05"
        assert format_date(None) == ""
        assert format_date("not-a-date") == "not-a-date"

    def test_format_date_custom_fmt(self):
        from utils.helpers import format_date
        assert format_date(date(2024, 3, 5), "%d/%m/%Y") == "05/03/2024"

    def test_format_datetime(self):
        from utils.helpers import format_datetime
        assert format_datetime(datetime(2024, 3, 5, 9, 30)) == "2024-03-05 09:30"
        assert format_datetime(date(2024, 3, 5)) == "2024-03-05 00:00"
        assert format_datetime(None) == ""
        assert format_datetime("garbage") == "garbage"

    def test_safe_get(self):
        from utils.helpers import safe_get
        d = {"a": 1, "b": "12"}
        assert safe_get(d, "a") == 1
        assert safe_get(d, "missing", default="D") == "D"
        assert safe_get(None, "a", default="D") == "D"
        assert safe_get(d, "b", cast_type=int) == 12
        assert safe_get(d, "missing", cast_type=int, default=-1) == -1

    def test_validate_required_fields(self):
        from utils.helpers import validate_required_fields
        ok, errors = validate_required_fields({"name": "x", "code": "C1"}, ["name", "code"])
        assert ok is True and errors == []
        ok, errors = validate_required_fields({"name": "x"}, ["name", "code"])
        assert ok is False
        assert any("Code" in e for e in errors)
        ok, errors = validate_required_fields({"name": "  "}, ["name"])
        assert ok is False

    def test_validate_numeric_field(self):
        from utils.helpers import validate_numeric_field
        assert validate_numeric_field(5, "qty") == (True, None)
        assert validate_numeric_field("3.5", "qty")[0] is True
        assert validate_numeric_field("abc", "qty")[0] is False
        assert validate_numeric_field(0, "qty", allow_zero=False)[0] is False
        assert validate_numeric_field(2, "qty", min_value=3)[0] is False
        assert validate_numeric_field(2, "qty", min_value=1, max_value=5)[0] is True

    def test_validate_date_range(self):
        from utils.helpers import validate_date_range
        assert validate_date_range(date(2024, 1, 1), date(2024, 1, 10)) == (True, None)
        ok, err = validate_date_range(date(2024, 2, 1), date(2024, 1, 1))
        assert ok is False and "From Date" in err

    def test_get_current_company_id(self):
        from utils.helpers import get_current_company_id
        assert get_current_company_id(None) == 1


# ---------------------------------------------------------------------------
# Cache manager (L1 / L2 / L3)
# ---------------------------------------------------------------------------

class TestCache:
    def test_session_cache_roundtrip(self):
        from utils.cache_manager import SessionCache
        c = SessionCache()
        c.clear()
        assert c.get("k") is None
        c.set("k", {"v": 1}, ttl=60)
        assert c.get("k") == {"v": 1}
        c.clear()
        assert c.get("k") is None

    def test_session_cache_expiry(self):
        from utils.cache_manager import SessionCache
        c = SessionCache()
        c.clear()
        c._session_cache["k"] = {"value": "v", "expires": 0}
        assert c.get("k") is None
        c.clear()

    def test_session_cache_invalidate_pattern(self):
        from utils.cache_manager import SessionCache
        c = SessionCache()
        c.clear()
        c.set("accounts:list", 1)
        c.set("items:list", 2)
        c.invalidate_pattern("accounts:")
        assert c.get("accounts:list") is None
        assert c.get("items:list") == 2
        c.clear()

    def test_lru_cache(self):
        from utils.cache_manager import LRUCache
        c = LRUCache(maxsize=2)
        c.set("a", 1)
        c.set("b", 2)
        c.set("c", 3)  # evicts 'a'
        assert c.get("a") is None
        assert c.get("b") == 2
        assert c.get("c") == 3
        assert len(c) == 2

    def test_cached_global_decorator(self):
        from utils.cache_manager import cached_global, _global_cache
        _global_cache.clear()
        calls = []

        @cached_global(ttl=300)
        def expensive(x):
            calls.append(x)
            return x * 2

        assert expensive(3) == 6
        assert expensive(3) == 6
        assert calls == [3]  # called only once
        _global_cache.clear()

    def test_clear_all(self):
        from utils.cache_manager import CacheManager
        CacheManager.clear_all()  # should not raise