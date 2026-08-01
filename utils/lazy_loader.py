"""
Lazy loading utilities for slow operations.
"""
from __future__ import annotations

import time
from functools import wraps
from typing import Any, Callable, Dict, List
from PySide6.QtCore import QTimer, QThread, Signal, QObject


class LazyLoader:
    """Cache results with timeout."""
    
    def __init__(self, timeout_seconds: int = 60):
        self._cache: Dict[str, Any] = {}
        self._cache_time: Dict[str, float] = {}
        self._timeout = timeout_seconds
        self._loading: Dict[str, bool] = {}
        self._listeners: Dict[str, List[Callable]] = {}
    
    def get(self, key: str, loader: Callable, force: bool = False) -> Any:
        """Get cached data or load if expired."""
        if not force and key in self._cache:
            if time.time() - self._cache_time.get(key, 0) < self._timeout:
                return self._cache[key]
        
        # Check if already loading
        if self._loading.get(key, False):
            return None
        
        # Load data
        self._loading[key] = True
        try:
            data = loader()
            self._cache[key] = data
            self._cache_time[key] = time.time()
            self._notify(key, data)
            return data
        finally:
            self._loading[key] = False
    
    def invalidate(self, key: str):
        """Clear cache for a key."""
        if key in self._cache:
            del self._cache[key]
        if key in self._cache_time:
            del self._cache_time[key]
    
    def clear(self):
        """Clear all cache."""
        self._cache.clear()
        self._cache_time.clear()
    
    def on_change(self, key: str, callback: Callable):
        """Register callback for when data changes."""
        if key not in self._listeners:
            self._listeners[key] = []
        self._listeners[key].append(callback)
    
    def _notify(self, key: str, data: Any):
        """Notify listeners of data change."""
        for callback in self._listeners.get(key, []):
            try:
                callback(data)
            except Exception as e:
                print(f"Error in lazy loader callback: {e}")


class BackgroundWorker(QThread):
    """Run tasks in background thread."""
    
    finished = Signal(object)
    error = Signal(str)
    
    def __init__(self, func: Callable, *args, **kwargs):
        super().__init__()
        self.func = func
        self.args = args
        self.kwargs = kwargs
    
    def run(self):
        try:
            result = self.func(*self.args, **self.kwargs)
            self.finished.emit(result)
        except Exception as e:
            self.error.emit(str(e))


def lazy_loader(timeout: int = 60):
    """Decorator for lazy loading methods."""
    def decorator(func):
        _cache = {}
        _cache_time = {}
        
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            key = f"{func.__name__}_{args}_{kwargs}"
            
            # Check cache
            if key in _cache:
                if time.time() - _cache_time.get(key, 0) < timeout:
                    return _cache[key]
            
            # Load data
            result = func(self, *args, **kwargs)
            _cache[key] = result
            _cache_time[key] = time.time()
            return result
        
        # Add cache control methods
        wrapper.invalidate = lambda: _cache.clear()
        return wrapper
    
    return decorator


# Global lazy loader instance
data_loader = LazyLoader(timeout_seconds=30)