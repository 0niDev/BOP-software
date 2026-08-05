"""
Advanced logging with performance monitoring and slow query detection.
"""
from __future__ import annotations

import logging
import sys
import time
from contextlib import contextmanager
from functools import wraps
from pathlib import Path
from typing import Any, Callable, Optional

from config.app_config import get_config


class PerformanceFormatter(logging.Formatter):
    """Custom formatter that includes performance metrics."""
    
    def format(self, record: logging.LogRecord) -> str:
        # Add performance info if present
        if hasattr(record, 'duration_ms'):
            record.duration = f"{record.duration_ms:.2f}ms"
        if hasattr(record, 'query_type'):
            record.query_type_str = f"[{record.query_type}]"
        return super().format(record)


def setup_logger(name: str, level: Optional[str] = None) -> logging.Logger:
    """
    Set up a logger with performance monitoring capabilities.
    
    Args:
        name: Logger name (usually __name__)
        level: Override log level
    
    Returns:
        Configured logger instance
    """
    config = get_config()
    log_level = level or config.logging.level
    
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    
    # Avoid duplicate handlers
    if logger.handlers:
        return logger
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    
    # File handler
    try:
        file_handler = logging.FileHandler(config.logging.log_file)
        file_handler.setLevel(logging.DEBUG)
    except (IOError, OSError):
        file_handler = None
    
    # Formatter with performance info
    formatter = PerformanceFormatter(config.logging.fmt)
    console_handler.setFormatter(formatter)
    
    logger.addHandler(console_handler)
    if file_handler:
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger


def get_logger(name: str) -> logging.Logger:
    """Get or create a logger instance."""
    return setup_logger(name)


class QueryTimer:
    """Context manager for timing database queries."""
    
    def __init__(self, logger: logging.Logger, sql: str, threshold_ms: Optional[float] = None):
        self.logger = logger
        self.sql = sql[:100] + "..." if len(sql) > 100 else sql
        self.threshold_ms = threshold_ms
        
    def __enter__(self):
        self.start_time = time.perf_counter()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration_ms = (time.perf_counter() - self.start_time) * 1000
        query_type = self.sql.split()[0].upper() if self.sql else "UNKNOWN"
        
        # Log slow queries
        config = get_config()
        threshold = self.threshold_ms or config.database.slow_query_threshold_ms
        
        if duration_ms > threshold:
            self.logger.warning(
                f"Slow query detected: {duration_ms:.2f}ms | {query_type} | {self.sql}",
                extra={'duration_ms': duration_ms, 'query_type': query_type}
            )
        elif config.database.enable_query_logging:
            self.logger.debug(
                f"Query executed: {duration_ms:.2f}ms | {query_type} | {self.sql}",
                extra={'duration_ms': duration_ms, 'query_type': query_type}
            )


def timed_operation(logger_name: str, operation_name: Optional[str] = None):
    """
    Decorator to time and log function execution.
    
    Args:
        logger_name: Name of the logger to use
        operation_name: Optional custom name for the operation
    
    Returns:
        Decorated function
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            logger = get_logger(logger_name)
            op_name = operation_name or func.__name__
            
            start_time = time.perf_counter()
            try:
                result = func(*args, **kwargs)
                duration_ms = (time.perf_counter() - start_time) * 1000
                
                logger.info(
                    f"Operation '{op_name}' completed in {duration_ms:.2f}ms",
                    extra={'duration_ms': duration_ms}
                )
                return result
            except Exception as e:
                duration_ms = (time.perf_counter() - start_time) * 1000
                logger.error(
                    f"Operation '{op_name}' failed after {duration_ms:.2f}ms: {e}",
                    extra={'duration_ms': duration_ms}
                )
                raise
        return wrapper
    return decorator


@contextmanager
def log_operation_context(logger: logging.Logger, operation: str, **extra_info: Any):
    """
    Context manager for logging operation start/end with timing.
    
    Usage:
        with log_operation_context(logger, "Creating invoice", invoice_id=123):
            # do work
            pass
    """
    start_time = time.perf_counter()
    logger.debug(f"Starting operation: {operation}", extra=extra_info)
    
    try:
        yield
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.info(
            f"Completed operation: {operation}",
            extra={**extra_info, 'duration_ms': duration_ms}
        )
    except Exception as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.error(
            f"Failed operation: {operation} - {e}",
            extra={**extra_info, 'duration_ms': duration_ms}
        )
        raise


class SlowQueryDetector:
    """Detects and logs slow database queries."""
    
    def __init__(self, threshold_ms: float = 100.0):
        self.threshold_ms = threshold_ms
        self.slow_queries: list[dict] = []
    
    def record_query(self, sql: str, duration_ms: float, params: tuple = ()) -> None:
        """Record a query execution."""
        if duration_ms > self.threshold_ms:
            query_info = {
                'sql': sql,
                'duration_ms': duration_ms,
                'params': params,
                'timestamp': time.time()
            }
            self.slow_queries.append(query_info)
            
            # Keep only last 1000 slow queries
            if len(self.slow_queries) > 1000:
                self.slow_queries = self.slow_queries[-1000:]
    
    def get_report(self) -> str:
        """Generate a report of slow queries."""
        if not self.slow_queries:
            return "No slow queries detected."
        
        report_lines = [
            f"Slow Query Report (threshold: {self.threshold_ms}ms)",
            f"Total slow queries: {len(self.slow_queries)}",
            "=" * 60
        ]
        
        # Group by SQL pattern
        from collections import Counter
        sql_counts = Counter(q['sql'] for q in self.slow_queries)
        
        for sql, count in sql_counts.most_common(10):
            avg_duration = sum(
                q['duration_ms'] for q in self.slow_queries if q['sql'] == sql
            ) / count
            
            report_lines.append(f"\nSQL ({count}x, avg {avg_duration:.2f}ms):")
            report_lines.append(f"  {sql[:200]}")
        
        return "\n".join(report_lines)
