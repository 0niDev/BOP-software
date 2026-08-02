"""Purchase Invoice View for BOP Nutraceuticals ERP."""

from PySide6.QtWidgets import QWidget, QVBoxLayout, QLabel


class PurchaseInvoiceView(QWidget):
    """Purchase Invoice management view."""
    
    def __init__(self):
        super().__init__()
        layout = QVBoxLayout()
        
        title = QLabel("Purchase Invoice Management")
        title.setStyleSheet("font-size: 18px; font-weight: bold;")
        layout.addWidget(title)
        
        info = QLabel("Purchase invoice functionality - Create, view, and manage purchase invoices.")
        layout.addWidget(info)
        
        self.setLayout(layout)
