"""Dashboard View for BOP Nutraceuticals ERP."""

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
    QGridLayout, QFrame, QScrollArea
)
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from decimal import Decimal


class KPICard(QFrame):
    """KPI Card widget."""
    
    def __init__(self, title: str, value: str, color: str = "#3498db"):
        super().__init__()
        self.setStyleSheet(f"""
            QFrame {{
                background-color: white;
                border-radius: 10px;
                padding: 15px;
                border: 2px solid {color};
            }}
        """)
        
        layout = QVBoxLayout()
        
        title_label = QLabel(title)
        title_font = QFont()
        title_font.setPointSize(10)
        title_label.setFont(title_font)
        title_label.setStyleSheet("color: #7f8c8d;")
        layout.addWidget(title_label)
        
        value_label = QLabel(value)
        value_font = QFont()
        value_font.setPointSize(18)
        value_font.setBold(True)
        value_label.setFont(value_font)
        value_label.setStyleSheet(f"color: {color};")
        layout.addWidget(value_label)
        
        self.setLayout(layout)


class DashboardView(QWidget):
    """Main dashboard view."""
    
    def __init__(self):
        super().__init__()
        self.setup_ui()
    
    def setup_ui(self):
        """Setup dashboard UI."""
        main_layout = QVBoxLayout()
        main_layout.setSpacing(20)
        main_layout.setContentsMargins(20, 20, 20, 20)
        
        # Title
        title = QLabel("Dashboard")
        title_font = QFont()
        title_font.setPointSize(16)
        title_font.setBold(True)
        title.setFont(title_font)
        main_layout.addWidget(title)
        
        # KPI Grid
        kpi_frame = QFrame()
        kpi_layout = QGridLayout()
        kpi_layout.setSpacing(15)
        
        self.kpi_cards = {}
        
        # Create KPI cards
        kpis = [
            ("Sales MTD", "₹0.00", "#2ecc71"),
            ("Purchases MTD", "₹0.00", "#e74c3c"),
            ("Gross Profit", "₹0.00", "#3498db"),
            ("Cash Balance", "₹0.00", "#f39c12"),
            ("Low Stock Items", "0", "#9b59b6"),
            ("Pending Orders", "0", "#1abc9c")
        ]
        
        for i, (title, value, color) in enumerate(kpis):
            card = KPICard(title, value, color)
            row = i // 3
            col = i % 3
            kpi_layout.addWidget(card, row, col)
            self.kpi_cards[title] = card
        
        kpi_frame.setLayout(kpi_layout)
        main_layout.addWidget(kpi_frame)
        
        # Recent Transactions
        recent_frame = QFrame()
        recent_frame.setStyleSheet("""
            QFrame {
                background-color: white;
                border-radius: 10px;
                padding: 15px;
                border: 1px solid #bdc3c7;
            }
        """)
        
        recent_layout = QVBoxLayout()
        
        recent_title = QLabel("Recent Transactions")
        recent_title_font = QFont()
        recent_title_font.setPointSize(12)
        recent_title_font.setBold(True)
        recent_title.setFont(recent_title_font)
        recent_layout.addWidget(recent_title)
        
        self.recent_transactions_label = QLabel("No recent transactions")
        self.recent_transactions_label.setAlignment(Qt.AlignTop | Qt.AlignLeft)
        recent_layout.addWidget(self.recent_transactions_label)
        
        recent_frame.setLayout(recent_layout)
        main_layout.addWidget(recent_frame)
        
        # Scroll area for content
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll_content = QWidget()
        scroll_content.setLayout(main_layout)
        scroll.setWidget(scroll_content)
        
        outer_layout = QVBoxLayout()
        outer_layout.addWidget(scroll)
        self.setLayout(outer_layout)
    
    def update_kpis(self, kpi_data: dict):
        """Update KPI cards with data."""
        if 'total_sales_mtd' in kpi_data:
            self._update_card_value("Sales MTD", f"₹{kpi_data['total_sales_mtd']:,.2f}")
        
        if 'total_purchases_mtd' in kpi_data:
            self._update_card_value("Purchases MTD", f"₹{kpi_data['total_purchases_mtd']:,.2f}")
        
        if 'gross_profit_mtd' in kpi_data:
            self._update_card_value("Gross Profit", f"₹{kpi_data['gross_profit_mtd']:,.2f}")
        
        if 'cash_balance' in kpi_data:
            self._update_card_value("Cash Balance", f"₹{kpi_data['cash_balance']:,.2f}")
        
        if 'low_stock_count' in kpi_data:
            self._update_card_value("Low Stock Items", str(kpi_data['low_stock_count']))
    
    def _update_card_value(self, title: str, value: str):
        """Update a specific KPI card value."""
        if title in self.kpi_cards:
            card = self.kpi_cards[title]
            layout = card.layout()
            if layout and layout.count() >= 2:
                value_label = layout.itemAt(1).widget()
                if value_label:
                    value_label.setText(value)
    
    def update_recent_transactions(self, transactions: list):
        """Update recent transactions display."""
        if not transactions:
            self.recent_transactions_label.setText("No recent transactions")
            return
        
        text = ""
        for tx in transactions[:10]:
            text += f"{tx.get('date', '')} - {tx.get('type', '')} #{tx.get('number', '')} - {tx.get('party', '')}: ₹{tx.get('amount', 0):,.2f}\n"
        
        self.recent_transactions_label.setText(text)
