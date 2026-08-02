"""Sales Invoice View for BOP Nutraceuticals ERP."""

from PySide6.QtWidgets import QWidget, QVBoxLayout, QLabel


class SalesInvoiceView(QWidget):
    """Sales Invoice management view."""
    
    def __init__(self):
        super().__init__()
        layout = QVBoxLayout()
        
        title = QLabel("Sales Invoice Management")
        title.setStyleSheet("font-size: 18px; font-weight: bold;")
        layout.addWidget(title)
        
        info = QLabel("Sales invoice functionality - Create, view, and manage sales invoices.")
        layout.addWidget(info)
        
        self.setLayout(layout)
