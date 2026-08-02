"""Accounting View for BOP Nutraceuticals ERP."""

from PySide6.QtWidgets import QWidget, QVBoxLayout, QLabel


class AccountingView(QWidget):
    """Accounting management view."""
    
    def __init__(self):
        super().__init__()
        layout = QVBoxLayout()
        
        title = QLabel("Accounting Management")
        title.setStyleSheet("font-size: 18px; font-weight: bold;")
        layout.addWidget(title)
        
        info = QLabel("Accounting functionality - Journal entries, reports, and ledgers.")
        layout.addWidget(info)
        
        self.setLayout(layout)
