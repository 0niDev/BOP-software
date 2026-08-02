"""Payment management widget."""
from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QHBoxLayout,
    QLabel,
    QPushButton,
    QTableWidget,
    QVBoxLayout,
    QWidget,
    QTableWidgetItem,
)

from database.connection import get_db


class PaymentView(QWidget):
    """Widget for viewing payments."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._build_ui()
        self._load_payments()

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(10)

        # Title
        title = QLabel("[BALANCE] Payments")
        title.setStyleSheet("font-size: 18px; font-weight: bold;")
        layout.addWidget(title)

        # Payments Table
        self.table = QTableWidget()
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.setSelectionMode(QTableWidget.SingleSelection)
        layout.addWidget(self.table, stretch=1)

        # Refresh button
        refresh_btn = QPushButton("Refresh")
        refresh_btn.clicked.connect(self._load_payments)
        layout.addWidget(refresh_btn)

    def _load_payments(self):
        """Load payments into table."""
        db = get_db()
        payments = db.fetch_all("""
            SELECT 
                p.voucher_number,
                p.payment_date,
                p.payment_method,
                p.amount,
                p.notes,
                pa.name as supplier_name
            FROM payments p
            JOIN parties pa ON pa.id = p.party_id
            ORDER BY p.created_at DESC
        """)

        self.table.setRowCount(len(payments))
        self.table.setColumnCount(5)
        self.table.setHorizontalHeaderLabels([
            "Voucher #", "Date", "Supplier", "Amount", "Method"
        ])

        for row, pay in enumerate(payments):
            self.table.setItem(row, 0, QTableWidgetItem(pay["voucher_number"]))
            self.table.setItem(row, 1, QTableWidgetItem(pay["payment_date"]))
            self.table.setItem(row, 2, QTableWidgetItem(pay["supplier_name"]))
            self.table.setItem(row, 3, QTableWidgetItem(f"Rs. {pay['amount']:,.2f}"))
            self.table.setItem(row, 4, QTableWidgetItem(pay["payment_method"]))

        self.table.resizeColumnsToContents()