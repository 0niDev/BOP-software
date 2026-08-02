"""Manufacturing View for BOP Nutraceuticals ERP."""

from PySide6.QtWidgets import QWidget, QVBoxLayout, QLabel


class ManufacturingView(QWidget):
    """Manufacturing management view."""
    
    def __init__(self):
        super().__init__()
        layout = QVBoxLayout()
        
        title = QLabel("Manufacturing Management")
        title.setStyleSheet("font-size: 18px; font-weight: bold;")
        layout.addWidget(title)
        
        info = QLabel("Manufacturing functionality - BOM, production orders, and completion.")
        layout.addWidget(info)
        
        self.setLayout(layout)
