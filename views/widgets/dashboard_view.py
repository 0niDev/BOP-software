"""Dashboard widget - main home screen."""
from __future__ import annotations

from PySide6.QtCore import Qt, QTimer, QThread, Signal
from PySide6.QtWidgets import (
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QMessageBox,
    QPushButton,
    QScrollArea,
    QVBoxLayout,
    QWidget,
    QFrame,
)

from controllers.dashboard_controller import DashboardController
from utils.logger import get_logger

logger = get_logger(__name__)


class DashboardLoadThread(QThread):
    """Background thread for loading dashboard data."""
    
    data_loaded = Signal(dict, str)  # data, error
    
    def __init__(self, controller: DashboardController):
        super().__init__()
        self.controller = controller
    
    def run(self):
        try:
            data, error = self.controller.get_dashboard_data()
            self.data_loaded.emit(data or {}, error or "")
        except Exception as e:
            logger.exception(f"Error in dashboard load thread: {e}")
            self.data_loaded.emit({}, str(e))


class DashboardView(QWidget):
    """Main dashboard view."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.controller = DashboardController()
        self._load_thread = None
        self._is_loaded = False  # Track if data has been loaded
        self._build_ui()
        # Don't load on init - wait for showEvent

        # Auto-refresh every 60 seconds
        self.timer = QTimer()
        self.timer.timeout.connect(self._load_data)
        self.timer.start(60000)

    def showEvent(self, event):
        """Called when the widget is shown (tab selected)."""
        super().showEvent(event)
        # Only load if not already loaded or if user manually refreshed
        if not self._is_loaded:
            self._load_data()
            self._is_loaded = True
        logger.info("🔄 Dashboard View refreshed on show")

    def _build_ui(self):
        """Build the dashboard UI."""
        # Main layout
        main_layout = QVBoxLayout(self)
        main_layout.setSpacing(10)
        main_layout.setContentsMargins(10, 10, 10, 10)

        # -- Header with Refresh button --
        header_widget = QWidget()
        header_layout = QHBoxLayout(header_widget)
        header_layout.setContentsMargins(0, 0, 0, 0)
        
        title = QLabel("Dashboard")
        title.setStyleSheet("font-size: 20px; font-weight: bold;")
        header_layout.addWidget(title)
        header_layout.addStretch()
        
        self.refresh_btn = QPushButton("Refresh")
        self.refresh_btn.clicked.connect(self._load_data)
        self.refresh_btn.setFixedWidth(100)
        header_layout.addWidget(self.refresh_btn)
        
        self.last_updated_label = QLabel("Last updated: --")
        self.last_updated_label.setStyleSheet("color: #888; font-size: 11px;")
        header_layout.addWidget(self.last_updated_label)
        
        main_layout.addWidget(header_widget)

        # -- Scroll Area --
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QScrollArea.NoFrame)
        
        # Content widget
        self.content_widget = QWidget()
        self.content_layout = QVBoxLayout(self.content_widget)
        self.content_layout.setSpacing(10)
        self.content_layout.setContentsMargins(0, 0, 0, 0)
        
        scroll.setWidget(self.content_widget)
        main_layout.addWidget(scroll)

    def _clear_layout(self, layout):
        """Recursively clear a layout."""
        if layout is None:
            return
        while layout.count():
            item = layout.takeAt(0)
            widget = item.widget()
            if widget:
                widget.deleteLater()
            elif item.layout():
                self._clear_layout(item.layout())

    def _load_data(self):
        """Load dashboard data asynchronously."""
        logger.info("🔄 LOADING DASHBOARD DATA")
        
        # Cancel any existing load thread
        if self._load_thread and self._load_thread.isRunning():
            self._load_thread.terminate()
            self._load_thread.wait()
        
        # Start new load thread
        self._load_thread = DashboardLoadThread(self.controller)
        self._load_thread.data_loaded.connect(self._on_data_loaded)
        self._load_thread.start()
    
    def _on_data_loaded(self, data, error):
        """Handle dashboard data loaded from background thread."""
        if error:
            logger.error(f"❌ Error: {error}")
            self._show_empty_state()
            return
        
        if not data:
            logger.warning("❌ No data returned")
            self._show_empty_state()
            return
        
        # Update last updated
        from datetime import datetime
        self.last_updated_label.setText(f"Last updated: {datetime.now().strftime('%H:%M:%S')}")
        
        # Clear existing widgets
        while self.content_layout.count():
            item = self.content_layout.takeAt(0)
            widget = item.widget()
            if widget:
                widget.deleteLater()
            elif item.layout():
                self._clear_layout(item.layout())
        
        # 1. KPI Cards
        self._add_kpi_cards(data)
        
        # 2. Today's Summary
        self._add_today_summary(data)
        
        # 3. Recent Transactions
        self._add_recent_transactions(data)
        
        # 4. Alerts
        self._add_alerts(data)
        
        # 5. Low Stock and Expiring (side by side)
        self._add_low_stock_expiring(data)
        
        # Add stretch at the end
        self.content_layout.addStretch()

    def _add_kpi_cards(self, data):
        """Add KPI cards."""
        balances = data.get("balances", {})
        receivables = data.get("receivables_payables", {})
        profit_loss = data.get("profit_loss", {})
        
        # Create a grid for KPI cards
        grid = QGridLayout()
        grid.setSpacing(10)
        
        kpi_data = [
            ("Cash in Hand", f"Rs. {balances.get('cash', 0):,.0f}", "#2ecc71"),
            ("Bank Balance", f"Rs. {balances.get('bank', 0):,.0f}", "#3498db"),
            ("Inventory Value", f"Rs. {balances.get('inventory', 0):,.0f}", "#9b59b6"),
            ("Receivables", f"Rs. {receivables.get('receivable', 0):,.0f}", "#e67e22"),
            ("Payables", f"Rs. {receivables.get('payable', 0):,.0f}", "#e74c3c"),
            ("Monthly Profit", f"Rs. {profit_loss.get('profit', 0):,.0f}", 
             "#1abc9c" if profit_loss.get('profit', 0) >= 0 else "#e74c3c"),
        ]
        
        row = 0
        col = 0
        for title, value, color in kpi_data:
            card = QFrame()
            card.setStyleSheet(f"""
                QFrame {{
                    background: white;
                    border: 1px solid #e9ecef;
                    border-radius: 12px;
                    padding: 15px;
                }}
            """)
            
            layout = QVBoxLayout(card)
            layout.setSpacing(2)
            
            title_label = QLabel(title)
            title_label.setStyleSheet("color: #6c757d; font-size: 12px; font-weight: 500;")
            layout.addWidget(title_label)
            
            value_label = QLabel(value)
            value_label.setStyleSheet(f"color: {color}; font-size: 22px; font-weight: bold;")
            layout.addWidget(value_label)
            
            grid.addWidget(card, row, col)
            col += 1
            if col > 2:
                col = 0
                row += 1
        
        # Add grid to content
        self.content_layout.addLayout(grid)

    def _add_today_summary(self, data):
        """Add today's summary section."""
        today = data.get("today", {})
        
        frame = QFrame()
        frame.setStyleSheet("""
            QFrame {
                background: white;
                border: 1px solid #e9ecef;
                border-radius: 12px;
                padding: 15px;
            }
        """)
        
        layout = QVBoxLayout(frame)
        layout.setSpacing(10)
        
        title = QLabel("Today's Summary")
        title.setStyleSheet("font-size: 14px; font-weight: 600; color: #1a1a2e;")
        layout.addWidget(title)
        
        # Stats row
        stats_layout = QHBoxLayout()
        stats_layout.setSpacing(20)
        
        stats = [
            ("Sales", today.get("sales_total", 0), today.get("sales_count", 0), "#2ecc71"),
            ("Purchases", today.get("purchases_total", 0), today.get("purchases_count", 0), "#e74c3c"),
        ]
        
        for label, total, count, color in stats:
            stat_frame = QFrame()
            stat_frame.setStyleSheet(f"""
                QFrame {{
                    background: #f8f9fa;
                    border-radius: 8px;
                    padding: 10px 15px;
                }}
            """)
            
            stat_layout = QVBoxLayout(stat_frame)
            stat_layout.setSpacing(2)
            
            label_widget = QLabel(label)
            label_widget.setStyleSheet("color: #666; font-size: 12px;")
            stat_layout.addWidget(label_widget)
            
            amount = QLabel(f"Rs. {total:,.0f}")
            amount.setStyleSheet(f"color: {color}; font-size: 18px; font-weight: bold;")
            stat_layout.addWidget(amount)
            
            count_widget = QLabel(f"{count} transactions")
            count_widget.setStyleSheet("color: #888; font-size: 11px;")
            stat_layout.addWidget(count_widget)
            
            stats_layout.addWidget(stat_frame)
        
        stats_layout.addStretch()
        layout.addLayout(stats_layout)
        
        self.content_layout.addWidget(frame)

    def _add_recent_transactions(self, data):
        """Add recent transactions section."""
        transactions = data.get("recent_transactions", [])
        
        frame = QFrame()
        frame.setStyleSheet("""
            QFrame {
                background: white;
                border: 1px solid #e9ecef;
                border-radius: 12px;
                padding: 15px;
            }
        """)
        
        layout = QVBoxLayout(frame)
        layout.setSpacing(10)
        
        title = QLabel("Recent Transactions")
        title.setStyleSheet("font-size: 14px; font-weight: 600; color: #1a1a2e;")
        layout.addWidget(title)
        
        if not transactions:
            text = QLabel("No recent transactions.")
            text.setStyleSheet("color: #888; padding: 10px;")
            layout.addWidget(text)
        else:
            for txn in transactions[:10]:
                txn_widget = QWidget()
                txn_layout = QHBoxLayout(txn_widget)
                txn_layout.setContentsMargins(0, 4, 0, 4)
                
                type_colors = {
                    "Sales": "#2ecc71",
                    "Receipt": "#2ecc71",
                    "Purchases": "#e74c3c",
                    "Payment": "#e74c3c",
                    "Expense": "#f39c12",
                }
                color = type_colors.get(txn["type"], "#888")
                
                type_label = QLabel(txn["type"])
                type_label.setStyleSheet(f"color: {color}; font-weight: bold;")
                type_label.setFixedWidth(100)
                txn_layout.addWidget(type_label)
                
                party_label = QLabel(txn.get("party_name", "Unknown"))
                party_label.setStyleSheet("color: #333;")
                party_label.setMinimumWidth(120)
                txn_layout.addWidget(party_label)
                
                amount_label = QLabel(f"Rs. {txn['amount']:,.2f}")
                amount_label.setStyleSheet("color: #333; font-weight: 500;")
                amount_label.setMinimumWidth(100)
                txn_layout.addWidget(amount_label)
                
                date_label = QLabel(txn["date"])
                date_label.setStyleSheet("color: #888; font-size: 11px;")
                txn_layout.addWidget(date_label)
                
                line = QFrame()
                line.setFrameShape(QFrame.HLine)
                line.setStyleSheet("background: #eee;")
                layout.addWidget(line)
                layout.addWidget(txn_widget)
        
        self.content_layout.addWidget(frame)

    def _add_alerts(self, data):
        """Add alerts section."""
        alerts = data.get("alerts", {})
        alert_list = alerts.get("alerts", [])
        
        frame = QFrame()
        frame.setStyleSheet("""
            QFrame {
                background: white;
                border: 1px solid #e9ecef;
                border-radius: 12px;
                padding: 15px;
            }
        """)
        
        layout = QVBoxLayout(frame)
        layout.setSpacing(10)
        
        title = QLabel("Alerts")
        title.setStyleSheet("font-size: 14px; font-weight: 600; color: #1a1a2e;")
        layout.addWidget(title)
        
        if not alert_list:
            text = QLabel("No alerts!")
            text.setStyleSheet("color: #2ecc71; padding: 10px;")
            layout.addWidget(text)
        else:
            for alert in alert_list[:5]:
                color = {
                    "danger": "#e74c3c",
                    "warning": "#f39c12",
                    "success": "#2ecc71",
                }.get(alert.get("type", "success"), "#2ecc71")
                
                alert_widget = QFrame()
                alert_widget.setStyleSheet(f"""
                    QFrame {{
                        background: #f8f9fa;
                        border-left: 4px solid {color};
                        border-radius: 4px;
                        padding: 8px 12px;
                        margin: 2px 0;
                    }}
                """)
                
                alert_layout = QVBoxLayout(alert_widget)
                alert_layout.setSpacing(2)
                
                title_label = QLabel(alert['title'])
                title_label.setStyleSheet("font-weight: 600; color: #333; font-size: 12px;")
                alert_layout.addWidget(title_label)
                
                msg_label = QLabel(alert['message'])
                msg_label.setStyleSheet("color: #666; font-size: 11px;")
                alert_layout.addWidget(msg_label)
                
                layout.addWidget(alert_widget)
        
        self.content_layout.addWidget(frame)

    def _add_low_stock_expiring(self, data):
        """Add low stock and expiring items section."""
        inventory = data.get("inventory", {})
        low_stock = inventory.get("low_stock_items", [])
        expiring = inventory.get("expiring_items", [])
        
        frame = QFrame()
        frame.setStyleSheet("""
            QFrame {
                background: white;
                border: 1px solid #e9ecef;
                border-radius: 12px;
                padding: 15px;
            }
        """)
        
        layout = QVBoxLayout(frame)
        layout.setSpacing(10)
        
        cols_layout = QHBoxLayout()
        cols_layout.setSpacing(20)
        
        # Left: Low Stock
        left_frame = QFrame()
        left_frame.setStyleSheet("""
            QFrame {
                background: #f8f9fa;
                border-radius: 8px;
                padding: 10px;
            }
        """)
        left_layout = QVBoxLayout(left_frame)
        
        left_title = QLabel("⚠️ Low Stock Items")
        left_title.setStyleSheet("font-weight: 600; color: #e74c3c;")
        left_layout.addWidget(left_title)
        
        if not low_stock:
            left_text = QLabel("All items are well-stocked!")
            left_text.setStyleSheet("color: #2ecc71; padding: 5px;")
            left_layout.addWidget(left_text)
        else:
            for item in low_stock[:5]:
                item_label = QLabel(f"{item['item_code']}: {item['current_stock']:.0f} / Min: {item['minimum_stock']:.0f}")
                item_label.setStyleSheet("padding: 2px 0; font-size: 12px;")
                left_layout.addWidget(item_label)
        
        cols_layout.addWidget(left_frame)
        
        # Right: Expiring Soon
        right_frame = QFrame()
        right_frame.setStyleSheet("""
            QFrame {
                background: #f8f9fa;
                border-radius: 8px;
                padding: 10px;
            }
        """)
        right_layout = QVBoxLayout(right_frame)
        
        right_title = QLabel("📅 Expiring Soon")
        right_title.setStyleSheet("font-weight: 600; color: #f39c12;")
        right_layout.addWidget(right_title)
        
        if not expiring:
            right_text = QLabel("No items expiring soon!")
            right_text.setStyleSheet("color: #2ecc71; padding: 5px;")
            right_layout.addWidget(right_text)
        else:
            for item in expiring[:5]:
                item_label = QLabel(f"{item['item_code']}: {item['expiry_date']}")
                item_label.setStyleSheet("padding: 2px 0; font-size: 12px;")
                right_layout.addWidget(item_label)
        
        cols_layout.addWidget(right_frame)
        
        layout.addLayout(cols_layout)
        self.content_layout.addWidget(frame)

    def refresh(self):
        """Public refresh method."""
        self._load_data()
        
    def _show_empty_state(self):
        """Show empty state when no data is available."""
        # Clear existing widgets
        while self.content_layout.count():
            item = self.content_layout.takeAt(0)
            widget = item.widget()
            if widget:
                widget.deleteLater()
            elif item.layout():
                self._clear_layout(item.layout())
        
        # Show welcome message
        label = QLabel("Welcome to Pharma ERP!\n\nStart by adding:\n• Chart of Accounts\n• Parties (Customers & Suppliers)\n• Items (Inventory)\n• Purchase Invoices\n• Sales Invoices")
        label.setAlignment(Qt.AlignCenter)
        label.setStyleSheet("font-size: 16px; color: #666; padding: 50px;")
        self.content_layout.addWidget(label)