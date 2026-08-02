"""Reports View for BOP Nutraceuticals ERP."""

from PySide6.QtWidgets import QWidget, QVBoxLayout, QLabel


class ReportsView(QWidget):
    """Reports view."""
    
    def __init__(self):
        super().__init__()
        layout = QVBoxLayout()
        
        title = QLabel("Reports")
        title.setStyleSheet("font-size: 18px; font-weight: bold;")
        layout.addWidget(title)
        
        info = QLabel("Reports functionality - Financial reports, registers, and exports.")
        layout.addWidget(info)
        
        self.setLayout(layout)
