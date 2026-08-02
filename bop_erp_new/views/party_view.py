"""Party View for BOP Nutraceuticals ERP."""

from PySide6.QtWidgets import QWidget, QVBoxLayout, QLabel


class PartyView(QWidget):
    """Party management view."""
    
    def __init__(self):
        super().__init__()
        layout = QVBoxLayout()
        
        title = QLabel("Party Management")
        title.setStyleSheet("font-size: 18px; font-weight: bold;")
        layout.addWidget(title)
        
        info = QLabel("Party functionality - Manage customers and suppliers.")
        layout.addWidget(info)
        
        self.setLayout(layout)
