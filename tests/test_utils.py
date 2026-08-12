"""Unit tests for utilities: security, helpers, exceptions, logger config."""
from __future__ import annotations

import pytest

from utils.security import hash_password, verify_password
from utils.helpers import (
    format_currency,
    format_date,
    format_datetime,
    safe_get,
    validate_required_fields,
    validate_numeric_field,
    validate_date_range,
)
from utils.exceptions import (
    ERPException,
    DatabaseError,
    RecordNotFoundError,
    ValidationError,
    DuplicateRecordError,
    InsufficientStockError,
    UnbalancedJournalEntryError,
    AuthenticationError,
    AuthorizationError,
    ConfigurationError,
)


# ---------------------------------------------------------------------------
# Security / password hashing
# ---------------------------------------------------------------------------

class TestSecurity:
    def test_hash_password_returns_salt_and_hash(self):
        salt, pwd_hash = hash_password("secret")
        assert salt
        assert pwd_hash
        assert salt != pwd_hash

    def test_hash_is_deterministic_given_salt(self):
        salt, h1 = hash_password("secret", "a" * 32)
        _, h2 = hash_password("secret", "a" * 32)
        assert h1 == h2

    def test_verify_password_success(self):
        salt, pwd_hash = hash_password("admin123")
        assert verify_password("admin123", salt, pwd_hash) is True

    def test_verify_password_wrong(self):
        salt, pwd_hash = hash_password("admin123")
        assert verify_password("wrong", salt, pwd_hash) is False

    def test_salt_is_random_across_calls(self):
        s1, _ = hash_password("x")
        s2, _ = hash_password("x")
        assert s1 != s2


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class TestFormatCurrency:
    def test_pkr(self):
        assert format_currency(1234.5) == "Rs. 1,234.50"

    def test_usd(self):
        assert format_currency(99.0, currency="USD") == "$99.00"

    def test_none_becomes_zero(self):
        assert format_currency(None) == "Rs. 0.00"

    def test_invalid_string(self):
        assert format_currency("garbage") == "Rs. 0.00"


class TestFormatDate:
    def test_none(self):
        assert format_date(None) == ""

    def test_string_roundtrip(self):
        assert format_date("2026-08-12") == "2026-08-12"

    def test_invalid_string_passthrough(self):
        assert format_date("not-a-date") == "not-a-date"

    def test_custom_format(self):
        from datetime import date
        assert format_date(date(2026, 1, 5), "%d/%m/%Y") == "05/01/2026"


class TestFormatDatetime:
    def test_none(self):
        assert format_datetime(None) == ""

    def test_datetime_default(self):
        from datetime import datetime
        assert format_datetime(datetime(2026, 8, 12, 9, 30)) == "2026-08-12 09:30"


class TestSafeGet:
    def test_missing_key(self):
        assert safe_get({}, "x", "fallback") == "fallback"

    def test_none_obj(self):
        assert safe_get(None, "x", 5) == 5

    def test_cast(self):
        assert safe_get({"n": "42"}, "n", cast_type=int) == 42

    def test_cast_failure_uses_default(self):
        assert safe_get({"n": "abc"}, "n", default=0, cast_type=int) == 0


class TestValidators:
    def test_required_fields_ok(self):
        ok, errors = validate_required_fields({"name": "x", "code": "y"}, ["name", "code"])
        assert ok is True and errors == []

    def test_required_fields_missing(self):
        ok, errors = validate_required_fields({"name": "x"}, ["name", "code"])
        assert ok is False
        assert len(errors) == 1

    def test_blank_string_is_missing(self):
        ok, errors = validate_required_fields({"name": "  "}, ["name"])
        assert ok is False

    def test_numeric_valid(self):
        ok, err = validate_numeric_field(10, "Qty", min_value=0)
        assert ok is True and err is None

    def test_numeric_zero_disallowed(self):
        ok, err = validate_numeric_field(0, "Qty", allow_zero=False)
        assert ok is False

    def test_numeric_below_min(self):
        ok, err = validate_numeric_field(3, "Qty", min_value=5)
        assert ok is False

    def test_date_range_valid(self):
        from datetime import date
        ok, err = validate_date_range(date(2026, 1, 1), date(2026, 1, 2))
        assert ok is True

    def test_date_range_inverted(self):
        from datetime import date
        ok, err = validate_date_range(date(2026, 1, 2), date(2026, 1, 1))
        assert ok is False


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class TestExceptions:
    def test_hierarchy(self):
        assert issubclass(DatabaseError, ERPException)
        assert issubclass(ValidationError, ERPException)
        assert issubclass(AuthenticationError, ERPException)

    def test_specific_subclasses(self):
        for cls in (
            RecordNotFoundError,
            DuplicateRecordError,
            InsufficientStockError,
            UnbalancedJournalEntryError,
            AuthorizationError,
            ConfigurationError,
        ):
            assert issubclass(cls, ERPException)

    def test_exception_message(self):
        e = ValidationError("Bad input")
        assert str(e) == "Bad input"
