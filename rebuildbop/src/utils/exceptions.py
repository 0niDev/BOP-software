"""
Custom exceptions for the ERP system.
"""
from __future__ import annotations


class ERPError(Exception):
    """Base exception for all ERP errors."""
    pass


class DatabaseError(ERPError):
    """Database operation failed."""
    pass


class ConnectionError(ERPError):
    """Database connection failed."""
    pass


class TransactionError(DatabaseError):
    """Transaction failed."""
    pass


class RecordNotFoundError(ERPError):
    """Requested record not found."""
    def __init__(self, entity_type: str, record_id: int | None = None):
        self.entity_type = entity_type
        self.record_id = record_id
        message = f"{entity_type} not found"
        if record_id is not None:
            message += f" (id={record_id})"
        super().__init__(message)


class ValidationError(ERPError):
    """Business rule validation failed."""
    pass


class InsufficientStockError(ValidationError):
    """Insufficient stock for operation."""
    pass


class DuplicateRecordError(ERPError):
    """Attempt to create duplicate record."""
    pass


class AuthenticationError(ERPError):
    """Authentication failed."""
    pass


class AuthorizationError(ERPError):
    """User not authorized for operation."""
    pass


class CacheError(ERPError):
    """Cache operation failed."""
    pass


class NetworkError(ERPError):
    """Network operation failed."""
    pass


class RetryExhaustedError(NetworkError):
    """All retry attempts exhausted."""
    def __init__(self, operation: str, attempts: int, last_error: Exception):
        self.operation = operation
        self.attempts = attempts
        self.last_error = last_error
        super().__init__(
            f"Operation '{operation}' failed after {attempts} attempts. "
            f"Last error: {last_error}"
        )
