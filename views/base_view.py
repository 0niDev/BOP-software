"""Base view with automatic refresh support."""
from __future__ import annotations

from PySide6.QtWidgets import QWidget

from utils.event_bus import event_bus


class BaseView(QWidget):
    """Base view that automatically refreshes when data changes."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._refresh_callback = None
        self._setup_event_listeners()

    def _setup_event_listeners(self):
        """Setup event listeners for refresh events."""
        # Listen for data change events
        event_bus.subscribe("data_changed", self._on_data_changed)
        event_bus.subscribe("party_changed", self._on_data_changed)
        event_bus.subscribe("item_changed", self._on_data_changed)
        event_bus.subscribe("invoice_changed", self._on_data_changed)

    def _on_data_changed(self, data: dict = None):
        """Called when data changes anywhere in the system."""
        print(f"🔄 Data changed: {data} - Refreshing {self.__class__.__name__}")
        if hasattr(self, 'refresh'):
            self.refresh()
        elif hasattr(self, '_load_data'):
            self._load_data()

    def refresh(self):
        """Override this method in child classes to refresh data."""
        pass

    def closeEvent(self, event):
        """Clean up event listeners on close."""
        event_bus.unsubscribe("data_changed", self._on_data_changed)
        event_bus.unsubscribe("party_changed", self._on_data_changed)
        event_bus.unsubscribe("item_changed", self._on_data_changed)
        event_bus.unsubscribe("invoice_changed", self._on_data_changed)
        super().closeEvent(event)