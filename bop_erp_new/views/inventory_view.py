"""Inventory View for BOP Nutraceuticals ERP."""

from PySide6.QtWidgets import QWidget, QVBoxLayout, QLabel


class InventoryView(QWidget):
    """Inventory management view."""
    
    def __init__(self):
        super().__init__()
        layout = QVBoxLayout()
        
        title = QLabel("Inventory Management")
        title.setStyleSheet("font-size: 18px; font-weight: bold;")
        layout.addWidget(title)
        
        info = QLabel("Inventory functionality - View stock, transfers, and adjustments.")
        layout.addWidget(info)
        
        self.setLayout(layout)
