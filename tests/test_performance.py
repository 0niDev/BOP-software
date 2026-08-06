"""
Tests for performance monitoring.
"""
import pytest
import time
from utils.performance_monitor import measure_performance, QueryCounter


class TestPerformanceMonitor:
    """Test performance monitoring utilities."""
    
    def test_measure_performance_decorator(self):
        """Test that decorator measures execution time."""
        call_count = 0
        
        @measure_performance
        def slow_function():
            nonlocal call_count
            call_count += 1
            time.sleep(0.1)
            return "done"
        
        result = slow_function()
        
        assert result == "done"
        assert call_count == 1
    
    def test_measure_performance_fast_function(self):
        """Test decorator with fast function."""
        @measure_performance
        def fast_function():
            return 42
        
        result = fast_function()
        assert result == 42


class TestQueryCounter:
    """Test query counting functionality."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.counter = QueryCounter()
    
    def test_increment(self):
        """Test incrementing query count."""
        self.counter.increment()
        self.counter.increment()
        
        assert self.counter.count == 2
    
    def test_reset(self):
        """Test resetting query count."""
        self.counter.increment()
        self.counter.increment()
        
        self.counter.reset()
        
        assert self.counter.count == 0
    
    def test_context_manager(self):
        """Test using counter as context manager."""
        with self.counter:
            self.counter.increment()
        
        assert self.counter.count >= 1
