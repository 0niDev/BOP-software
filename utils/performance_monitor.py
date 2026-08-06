"""
Performance monitoring and measurement utilities.

Provides decorators, timing functions, and metrics collection
for tracking application performance against optimization targets.
"""
from __future__ import annotations

import time
import functools
from typing import Any, Callable
from contextlib import contextmanager

from utils.logger import get_logger

logger = get_logger(__name__)


# Performance thresholds (in milliseconds)
THRESHOLDS = {
    "query": {"warning": 500, "critical": 2000},
    "operation": {"warning": 2000, "critical": 5000},
    "ui_render": {"warning": 100, "critical": 500},
    "cache_miss": {"warning": 1000, "critical": 3000},
}


class PerformanceMetrics:
    """Collects and tracks performance metrics."""
    
    _instance: PerformanceMetrics | None = None
    
    def __new__(cls) -> PerformanceMetrics:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._metrics: dict[str, list[float]] = {}
            cls._instance._alerts: list[dict] = []
        return cls._instance
    
    def record(self, name: str, duration_ms: float) -> None:
        """Record a performance measurement."""
        if name not in self._metrics:
            self._metrics[name] = []
        
        # Keep only last 100 measurements per metric
        self._metrics[name].append(duration_ms)
        if len(self._metrics[name]) > 100:
            self._metrics[name] = self._metrics[name][-100:]
    
    def get_stats(self, name: str) -> dict:
        """Get statistics for a specific metric."""
        if name not in self._metrics or not self._metrics[name]:
            return {"count": 0, "avg": 0, "min": 0, "max": 0, "p95": 0}
        
        values = sorted(self._metrics[name])
        count = len(values)
        avg = sum(values) / count
        p95_idx = int(count * 0.95)
        
        return {
            "count": count,
            "avg": round(avg, 2),
            "min": round(min(values), 2),
            "max": round(max(values), 2),
            "p95": round(values[p95_idx] if p95_idx < count else values[-1], 2),
        }
    
    def add_alert(self, function: str, duration_ms: float, threshold_type: str) -> None:
        """Add a performance alert."""
        alert = {
            "timestamp": time.time(),
            "function": function,
            "duration_ms": duration_ms,
            "threshold_type": threshold_type,
        }
        self._alerts.append(alert)
        
        # Keep only last 50 alerts
        if len(self._alerts) > 50:
            self._alerts = self._alerts[-50:]
        
        logger.warning(
            f"Performance alert: {function} took {duration_ms:.2f}ms ({threshold_type})"
        )
    
    def get_recent_alerts(self, limit: int = 10) -> list[dict]:
        """Get recent performance alerts."""
        return self._alerts[-limit:]
    
    def clear(self) -> None:
        """Clear all metrics and alerts."""
        self._metrics.clear()
        self._alerts.clear()
    
    def get_all_stats(self) -> dict:
        """Get statistics for all tracked metrics."""
        return {
            name: self.get_stats(name)
            for name in self._metrics
        }


def measure_performance(
    metric_type: str = "operation",
    log_level: str = "info",
    alert_on_slow: bool = True
) -> Callable:
    """
    Decorator to measure function performance.
    
    Args:
        metric_type: Type of metric ("query", "operation", "ui_render", "cache_miss")
        log_level: Logging level ("debug", "info", "warning")
        alert_on_slow: Whether to alert on slow operations
    
    Usage:
        @measure_performance(metric_type="query")
        def fetch_data():
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            start = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration_ms = (time.time() - start) * 1000
                metrics = PerformanceMetrics()
                metrics.record(f"{func.__module__}.{func.__name__}", duration_ms)
                
                # Check thresholds
                thresholds = THRESHOLDS.get(metric_type, {})
                warning_threshold = thresholds.get("warning", 2000)
                critical_threshold = thresholds.get("critical", 5000)
                
                if alert_on_slow:
                    if duration_ms >= critical_threshold:
                        metrics.add_alert(func.__name__, duration_ms, "CRITICAL")
                    elif duration_ms >= warning_threshold:
                        metrics.add_alert(func.__name__, duration_ms, "WARNING")
                
                # Log based on level
                if log_level == "debug":
                    logger.debug(f"Performance: {func.__name__} took {duration_ms:.2f}ms")
                elif log_level == "info":
                    logger.info(f"Performance: {func.__name__} took {duration_ms:.2f}ms")
                elif duration_ms >= warning_threshold:
                    logger.warning(
                        f"Slow operation: {func.__name__} took {duration_ms:.2f}ms"
                    )
        
        return wrapper
    return decorator


@contextmanager
def measure_context(name: str, metric_type: str = "operation"):
    """
    Context manager for measuring code block performance.
    
    Usage:
        with measure_context("data_processing"):
            # ... code to measure
    """
    start = time.time()
    try:
        yield
    finally:
        duration_ms = (time.time() - start) * 1000
        metrics = PerformanceMetrics()
        metrics.record(name, duration_ms)
        
        thresholds = THRESHOLDS.get(metric_type, {})
        warning_threshold = thresholds.get("warning", 2000)
        critical_threshold = thresholds.get("critical", 5000)
        
        if duration_ms >= critical_threshold:
            metrics.add_alert(name, duration_ms, "CRITICAL")
            logger.critical(f"Critical performance issue: {name} took {duration_ms:.2f}ms")
        elif duration_ms >= warning_threshold:
            metrics.add_alert(name, duration_ms, "WARNING")
            logger.warning(f"Slow operation: {name} took {duration_ms:.2f}ms")
        else:
            logger.debug(f"Performance: {name} took {duration_ms:.2f}ms")


class QueryCounter:
    """Track number of database queries per operation."""
    
    _instance: QueryCounter | None = None
    
    def __new__(cls) -> QueryCounter:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._counts: dict[str, int] = {}
            cls._instance._current_operation: str | None = None
        return cls._instance
    
    def start_operation(self, operation_name: str) -> None:
        """Start tracking queries for an operation."""
        self._current_operation = operation_name
        self._counts[operation_name] = 0
    
    def increment(self) -> None:
        """Increment query count for current operation."""
        if self._current_operation:
            self._counts[self._current_operation] += 1
    
    def get_count(self, operation_name: str) -> int:
        """Get query count for an operation."""
        return self._counts.get(operation_name, 0)
    
    def end_operation(self) -> int:
        """End current operation and return query count."""
        if self._current_operation:
            count = self._counts[self._current_operation]
            
            # Alert if too many queries
            if count > 50:
                logger.warning(
                    f"High query count: {self._current_operation} used {count} queries"
                )
            
            self._current_operation = None
            return count
        return 0
    
    def clear(self) -> None:
        """Clear all query counts."""
        self._counts.clear()
        self._current_operation = None


def track_queries(func: Callable) -> Callable:
    """Decorator to track database queries in a function."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs) -> Any:
        counter = QueryCounter()
        counter.start_operation(func.__name__)
        try:
            return func(*args, **kwargs)
        finally:
            count = counter.end_operation()
            logger.debug(f"Query count for {func.__name__}: {count}")
    return wrapper


def get_performance_summary() -> dict:
    """Get a summary of all performance metrics."""
    metrics = PerformanceMetrics()
    return {
        "stats": metrics.get_all_stats(),
        "recent_alerts": metrics.get_recent_alerts(5),
        "thresholds": THRESHOLDS,
    }


def check_performance_targets() -> dict:
    """
    Check if current performance meets optimization targets.
    
    Returns dict with pass/fail status for each target.
    """
    metrics = PerformanceMetrics()
    
    targets = {
        "dashboard_load": {"target_ms": 1000, "metric": "dashboard.get_dashboard_data"},
        "invoice_creation": {"target_ms": 500, "metric": "sales_invoice.create_invoice"},
        "report_generation": {"target_ms": 2000, "metric": "report.generate"},
        "search_operation": {"target_ms": 200, "metric": "search.execute"},
    }
    
    results = {}
    for name, config in targets.items():
        stats = metrics.get_stats(config["metric"])
        if stats["count"] > 0:
            passed = stats["p95"] <= config["target_ms"]
            results[name] = {
                "passed": passed,
                "target_ms": config["target_ms"],
                "actual_p95_ms": stats["p95"],
                "avg_ms": stats["avg"],
            }
        else:
            results[name] = {
                "passed": True,  # No data yet
                "target_ms": config["target_ms"],
                "actual_p95_ms": 0,
                "avg_ms": 0,
                "note": "No measurements yet",
            }
    
    return results
