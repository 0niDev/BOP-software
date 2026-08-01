"""Simple event bus for cross-module communication."""
from __future__ import annotations

from typing import Callable, Dict, List


class EventBus:
    """Simple event bus for broadcasting events across the application."""
    
    _instance: EventBus | None = None
    _listeners: Dict[str, List[Callable]] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._listeners = {}
        return cls._instance

    def subscribe(self, event: str, callback: Callable) -> None:
        """Subscribe to an event."""
        if event not in self._listeners:
            self._listeners[event] = []
        self._listeners[event].append(callback)

    def unsubscribe(self, event: str, callback: Callable) -> None:
        """Unsubscribe from an event."""
        if event in self._listeners and callback in self._listeners[event]:
            self._listeners[event].remove(callback)

    def emit(self, event: str, data: dict = None) -> None:
        """Emit an event to all subscribers."""
        if event in self._listeners:
            for callback in self._listeners[event]:
                try:
                    callback(data)
                except Exception as e:
                    print(f"Error in event handler: {e}")

    def clear(self) -> None:
        """Clear all listeners."""
        self._listeners.clear()


# Singleton instance
event_bus = EventBus()