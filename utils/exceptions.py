"""
Application-wide exception hierarchy.

Using specific exception types (instead of bare Exception / generic
errors) lets controllers and the UI layer show meaningful messages
and lets services catch precisely what they expect to fail.
"""
from __future__ import annotations


class ERPException(Exception):
    """Base class for every application-specific exception."""


class DatabaseError(ERPException):
    """Raised when a database operation fails."""


class RecordNotFoundError(ERPException):
    """Raised when a lookup by id/code finds nothing."""


class ValidationError(ERPException):
    """Raised when input data fails business validation rules."""


class DuplicateRecordError(ERPException):
    """Raised when a unique constraint (code, name, etc.) is violated."""


class InsufficientStockError(ERPException):
    """Raised when a sale/consumption exceeds available stock."""


class UnbalancedJournalEntryError(ERPException):
    """Raised when a journal entry's debits and credits do not match."""


class AuthenticationError(ERPException):
    """Raised when login credentials are invalid."""


class AuthorizationError(ERPException):
    """Raised when a user lacks permission for an action."""


class ConfigurationError(ERPException):
    """Raised when required configuration/settings are missing or invalid."""
