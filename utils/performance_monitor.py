"""
Performance monitoring utilities for the ERP system.

Provides decorators and tools for measuring query performance,
detecting slow operations, and generating performance reports.
"""
from __future__ import annotations

import time
import functools
from typing import Callable, Any
from contextlib import contextmanager

from utils.logger import get_logger

logger = get_logger(__name__)


# Performance thresholds (in milliseconds)
QUERY_WARNING_THRESHOLD = 500  # Log warning if query takes > 500ms
QUERY_CRITICAL_THRESHOLD = 2000  # Log critical if query takes > 2s
OPERATION_WARNING_THRESHOLD = 2000  # Log warning if operation takes > 2s
OPERATION_CRITICAL_THRESHOLD = 5000  # Log critical if operation takes > 5s


class PerformanceMonitor:
    """Centralized performance monitoring."""
    
    _instance: PerformanceMonitor | None = None
    
    def __new__(cls) -> PerformanceMonitor:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.metrics: dict[str, list[float]] = {}
            cls._instance.slow_queries: list[dict] = []
            cls._instance.enabled = True
        return cls._instance
    
    def record_metric(self, name: str, duration_ms: float) -> None:
        """Record a performance metric."""
        if not self.enabled:
            return
        
        if name not in self.metrics:
            self.metrics[name] = []
        
        self.metrics[name].append(duration_ms)
        
        # Keep only last 1000 measurements per metric
        if len(self.metrics[name]) > 1000:
            self.metrics[name] = self.metrics[name][-1000:]
    
    def record_slow_query(self, sql: str, duration_ms: float, params: tuple = ()) -> None:
        """Record a slow query for analysis."""
        if not self.enabled:
            return
        
        self.slow_queries.append({
            'sql': sql[:200],  # Truncate long queries
            'duration_ms': duration_ms,
            'params': str(params)[:100],
            'timestamp': time.time()
        })
        
        # Keep only last 100 slow queries
        if len(self.slow_queries) > 100:
            self.slow_queries = self.slow_queries[-100:]
    
    def get_stats(self) -> dict:
        """Get performance statistics."""
        stats = {}
        for name, durations in self.metrics.items():
            if durations:
                stats[name] = {
                    'count': len(durations),
                    'avg_ms': sum(durations) / len(durations),
                    'min_ms': min(durations),
                    'max_ms': max(durations),
                    'p95_ms': sorted(durations)[int(len(durations) * 0.95)] if len(durations) >= 20 else durations[-1]
                }
        return stats
    
    def get_slow_queries(self) -> list[dict]:
        """Get list of slow queries."""
        return self.slow_queries.copy()
    
    def clear_metrics(self) -> None:
        """Clear all recorded metrics."""
        self.metrics.clear()
        self.slow_queries.clear()
    
    def enable(self) -> None:
        """Enable performance monitoring."""
        self.enabled = True
        logger.info("Performance monitoring enabled")
    
    def disable(self) -> None:
        """Disable performance monitoring."""
        self.enabled = False
        logger.info("Performance monitoring disabled")


def measure_performance(threshold_warning: float = QUERY_WARNING_THRESHOLD,
                       threshold_critical: float = QUERY_CRITICAL_THRESHOLD,
                       log_level: str = 'query') -> Callable:
    """
    Decorator to measure function/method performance.
    
    Args:
        threshold_warning: Warning threshold in ms
        threshold_critical: Critical threshold in ms
        log_level: Type of operation ('query', 'operation', 'service')
    
    Returns:
        Decorated function with performance measurement
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            start_time = time.perf_counter()
            
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration_ms = (time.perf_counter() - start_time) * 1000
                
                # Record metric
                monitor = PerformanceMonitor()
                monitor.record_metric(f"{func.__module__}:{func.__name__}", duration_ms)
                
                # Log based on threshold
                if duration_ms > threshold_critical:
                    logger.critical(
                        f"🔴 CRITICAL: {func.__name__} took {duration_ms:.2f}ms "
                        f"(threshold: {threshold_critical}ms)"
                    )
                    if log_level == 'query' and args:
                        monitor.record_slow_query(str(args[0]) if args else '', duration_ms)
                elif duration_ms > threshold_warning:
                    logger.warning(
                        f"🟡 SLOW: {func.__name__} took {duration_ms:.2f}ms "
                        f"(threshold: {threshold_warning}ms)"
                    )
                else:
                    logger.debug(f"⚡ {func.__name__} completed in {duration_ms:.2f}ms")
        
        return wrapper
    return decorator


@contextmanager
def measure_block(operation_name: str, threshold_ms: float = QUERY_WARNING_THRESHOLD):
    """
    Context manager for measuring code block performance.
    
    Usage:
        with measure_block("Loading accounts"):
            accounts = load_accounts()
    
    Args:
        operation_name: Name of the operation being measured
        threshold_ms: Warning threshold in milliseconds
    """
    start_time = time.perf_counter()
    try:
        yield
    finally:
        duration_ms = (time.perf_counter() - start_time) * 1000
        
        monitor = PerformanceMonitor()
        monitor.record_metric(operation_name, duration_ms)
        
        if duration_ms > threshold_ms:
            logger.warning(
                f"🟡 SLOW OPERATION: {operation_name} took {duration_ms:.2f}ms"
            )
        else:
            logger.debug(f"✅ {operation_name} completed in {duration_ms:.2f}ms")


class QueryCounter:
    """Track number of queries executed."""
    
    _instance: QueryCounter | None = None
    
    def __new__(cls) -> QueryCounter:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.count = 0
            cls._instance.enabled = True
        return cls._instance
    
    def increment(self) -> None:
        """Increment query counter."""
        if self.enabled:
            self.count += 1
    
    def reset(self) -> None:
        """Reset query counter."""
        self.count = 0
    
    def get_count(self) -> int:
        """Get current query count."""
        return self.count
    
    def enable(self) -> None:
        """Enable query counting."""
        self.enabled = True
    
    def disable(self) -> None:
        """Disable query counting."""
        self.enabled = False


def track_queries(func: Callable) -> Callable:
    """Decorator to track number of queries in a function."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs) -> Any:
        counter = QueryCounter()
        counter.reset()
        
        try:
            result = func(*args, **kwargs)
            query_count = counter.get_count()
            
            if query_count > 10:
                logger.warning(
                    f"⚠️ High query count ({query_count}) in {func.__name__}"
                )
            else:
                logger.debug(f"📊 {func.__name__} executed {query_count} queries")
            
            return result
        finally:
            counter.reset()
    
    return wrapper


def get_performance_report() -> str:
    """Generate a human-readable performance report."""
    monitor = PerformanceMonitor()
    stats = monitor.get_stats()
    
    if not stats:
        return "No performance metrics recorded yet."
    
    report_lines = [
        "=" * 60,
        "PERFORMANCE REPORT",
        "=" * 60,
        ""
    ]
    
    # Sort by average duration (slowest first)
    sorted_stats = sorted(
        stats.items(),
        key=lambda x: x[1]['avg_ms'],
        reverse=True
    )[:20]  # Top 20 slowest
    
    for name, metrics in sorted_stats:
        report_lines.append(
            f"{name.split(':')[-1]:40s} | "
            f"Avg: {metrics['avg_ms']:7.2f}ms | "
            f"Min: {metrics['min_ms']:7.2f}ms | "
            f"Max: {metrics['max_ms']:7.2f}ms | "
            f"P95: {metrics['p95_ms']:7.2f}ms | "
            f"Count: {metrics['count']:5d}"
        )
    
    report_lines.append("")
    report_lines.append("=" * 60)
    
    slow_queries = monitor.get_slow_queries()
    if slow_queries:
        report_lines.append(f"SLOW QUERIES ({len(slow_queries)} total):")
        report_lines.append("-" * 60)
        for sq in slow_queries[-10:]:  # Last 10 slow queries
            report_lines.append(
                f"  [{sq['duration_ms']:.2f}ms] {sq['sql']}"
            )
    
    report_lines.append("=" * 60)
    
    return "\n".join(report_lines)


def print_performance_report() -> None:
    """Print performance report to logs."""
    report = get_performance_report()
    logger.info(f"\n{report}")
