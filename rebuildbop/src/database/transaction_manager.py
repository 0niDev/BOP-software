"""
Transaction manager with savepoints, retry logic, and automatic rollback.

Features:
- Nested transactions via savepoints
- Automatic retry with exponential backoff
- Rollback on any exception
- Transaction timeout enforcement
- Deadlock detection and resolution
"""
from __future__ import annotations

import random
import sqlitecloud
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Optional, TypeVar

from config.app_config import DatabaseConfig, get_config
from utils.exceptions import RetryExhaustedError, TransactionError
from utils.logger import get_logger

logger = get_logger(__name__)


class IsolationLevel(Enum):
    """Transaction isolation levels."""
    READ_UNCOMMITTED = "READ UNCOMMITTED"
    READ_COMMITTED = "READ COMMITTED"
    REPEATABLE_READ = "REPEATABLE READ"
    SERIALIZABLE = "SERIALIZABLE"


@dataclass
class TransactionConfig:
    """Configuration for a transaction."""
    timeout: float = 60.0  # Maximum transaction duration
    max_retries: int = 3  # Maximum retry attempts
    base_delay: float = 0.1  # Initial delay between retries (seconds)
    max_delay: float = 10.0  # Maximum delay between retries
    isolation_level: IsolationLevel = IsolationLevel.READ_COMMITTED
    read_only: bool = False


T = TypeVar('T')


class TransactionManager:
    """
    Manages database transactions with advanced features.
    
    Features:
    - Savepoints for nested transactions
    - Automatic retry on deadlock/serialization failure
    - Exponential backoff with jitter
    - Timeout enforcement
    - Statistics tracking
    """
    
    def __init__(self, config: Optional[TransactionConfig] = None):
        self._config = config or TransactionConfig()
        self._active_transactions: dict[int, str] = {}  # thread_id -> savepoint_name
        self._lock = threading.RLock()
        self._stats = {
            'transactions_started': 0,
            'transactions_committed': 0,
            'transactions_rolled_back': 0,
            'savepoints_created': 0,
            'retries_performed': 0,
            'deadlocks_detected': 0,
        }
        self._stats_lock = threading.Lock()
    
    def _calculate_delay(self, attempt: int) -> float:
        """Calculate delay with exponential backoff and jitter."""
        delay = min(
            self._config.base_delay * (2 ** attempt),
            self._config.max_delay
        )
        # Add jitter (±10%)
        jitter = delay * 0.1 * (random.random() * 2 - 1)
        return delay + jitter
    
    def _is_retryable_error(self, error: Exception) -> bool:
        """Check if an error is retryable."""
        error_str = str(error).upper()
        
        # SQLite Cloud / SQLite retryable errors
        retryable_patterns = [
            'DATABASE IS LOCKED',
            'BUSY',
            'DEADLOCK',
            'SERIALIZATION',
            'TIMEOUT',
            'CONNECTION RESET',
            'NETWORK',
        ]
        
        return any(pattern in error_str for pattern in retryable_patterns)
    
    @contextmanager
    def transaction(self, conn: Any, config: Optional[TransactionConfig] = None):
        """
        Start a transaction with optional savepoint support.
        
        Usage:
            with manager.transaction(conn) as tx_conn:
                tx_conn.execute("INSERT INTO ...")
                # Nested transaction
                with manager.transaction(conn) as nested_conn:
                    nested_conn.execute("UPDATE ...")
        """
        cfg = config or self._config
        thread_id = threading.get_ident()
        start_time = time.perf_counter()
        
        # Check if we're already in a transaction (nested)
        with self._lock:
            is_nested = thread_id in self._active_transactions
            
            if is_nested:
                # Create savepoint for nested transaction
                savepoint_name = f"sp_{thread_id}_{int(time.time() * 1000)}"
                conn.execute(f"SAVEPOINT {savepoint_name}")
                self._active_transactions[thread_id] = savepoint_name
                
                with self._stats_lock:
                    self._stats['savepoints_created'] += 1
                
                logger.debug(f"Created savepoint: {savepoint_name}")
            else:
                # Start top-level transaction
                conn.execute("BEGIN")
                self._active_transactions[thread_id] = "__top_level__"
                
                with self._stats_lock:
                    self._stats['transactions_started'] += 1
                
                logger.debug("Started transaction")
        
        try:
            yield conn
            
            # Check timeout
            elapsed = time.perf_counter() - start_time
            if elapsed > cfg.timeout:
                raise TransactionError(
                    f"Transaction timeout after {elapsed:.2f}s (limit: {cfg.timeout}s)"
                )
            
            # Commit
            with self._lock:
                if is_nested:
                    savepoint_name = self._active_transactions.get(thread_id)
                    if savepoint_name:
                        conn.execute(f"RELEASE {savepoint_name}")
                        del self._active_transactions[thread_id]
                        logger.debug(f"Released savepoint: {savepoint_name}")
                else:
                    conn.execute("COMMIT")
                    with self._stats_lock:
                        self._stats['transactions_committed'] += 1
                    logger.debug(f"Committed transaction ({elapsed*1000:.2f}ms)")
                    
        except Exception as e:
            # Rollback
            with self._lock:
                if is_nested:
                    savepoint_name = self._active_transactions.get(thread_id)
                    if savepoint_name:
                        conn.execute(f"ROLLBACK TO {savepoint_name}")
                        del self._active_transactions[thread_id]
                        logger.debug(f"Rolled back to savepoint: {savepoint_name}")
                else:
                    conn.execute("ROLLBACK")
                    with self._stats_lock:
                        self._stats['transactions_rolled_back'] += 1
                    logger.warning(f"Rolled back transaction: {e}")
            
            # Re-raise if not a retryable error or retries exhausted
            raise
    
    def execute_with_retry(
        self,
        conn: Any,
        operation: Callable[..., T],
        *args,
        **kwargs
    ) -> T:
        """
        Execute an operation with automatic retry on failure.
        
        Args:
            conn: Database connection
            operation: Callable to execute
            *args: Positional arguments for operation
            **kwargs: Keyword arguments for operation
        
        Returns:
            Result of the operation
        
        Raises:
            RetryExhaustedError: If all retries fail
        """
        last_error = None
        
        for attempt in range(self._config.max_retries + 1):
            try:
                return operation(*args, **kwargs)
                
            except Exception as e:
                last_error = e
                
                if not self._is_retryable_error(e):
                    logger.error(f"Non-retryable error: {e}")
                    raise
                
                if attempt == self._config.max_retries:
                    logger.error(f"All {self._config.max_retries} retries exhausted")
                    raise RetryExhaustedError(
                        operation.__name__,
                        self._config.max_retries + 1,
                        e
                    ) from e
                
                # Wait before retrying
                delay = self._calculate_delay(attempt)
                logger.warning(
                    f"Retryable error on attempt {attempt + 1}: {e}. "
                    f"Retrying in {delay:.2f}s..."
                )
                
                with self._stats_lock:
                    self._stats['retries_performed'] += 1
                
                time.sleep(delay)
        
        # Should never reach here
        raise RetryExhaustedError(
            operation.__name__,
            self._config.max_retries + 1,
            last_error
        )
    
    def get_stats(self) -> dict:
        """Get transaction statistics."""
        with self._stats_lock:
            stats = self._stats.copy()
        
        with self._lock:
            stats['active_transactions'] = len(self._active_transactions)
        
        return stats


# Global transaction manager instance
_manager: Optional[TransactionManager] = None
_manager_lock = threading.Lock()


def get_transaction_manager(config: Optional[TransactionConfig] = None) -> TransactionManager:
    """Get or create the global transaction manager."""
    global _manager
    
    with _manager_lock:
        if _manager is None:
            _manager = TransactionManager(config)
        return _manager


def reset_transaction_manager() -> None:
    """Reset the global transaction manager."""
    global _manager
    
    with _manager_lock:
        _manager = None
