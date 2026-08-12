"""Dashboard widget - main home screen."""
from __future__ import annotations

import shiboken6
from PySide6.QtCore import (
    QCoreApplication,
    QEvent,
    QMargins,
    Qt,
    QThread,
    Signal,
)
from PySide6.QtGui import QColor, QPainter
from PySide6.QtWidgets import (
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QScrollArea,
    QVBoxLayout,
    QWidget,
    QFrame,
    QSizePolicy,
)

from PySide6.QtCharts import (
    QChart,
    QChartView,
    QPieSeries,
    QBarSeries,
    QBarSet,
    QBarCategoryAxis,
    QValueAxis,
)

from controllers.dashboard_controller import DashboardController
from utils.logger import get_logger

logger = get_logger(__name__)


class DashboardLoadThread(QThread):
    """Background thread for loading dashboard data."""
    
    data_loaded = Signal(dict, str)  # data, error
    
    def __init__(self, controller: DashboardController, force_refresh: bool = False):
        super().__init__()
        self.controller = controller
        self.force_refresh = force_refresh
    
    def run(self):
        try:
            if self.force_refresh:
                data, error = self.controller.refresh_dashboard_data()
            else:
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
        # NOTE: Auto-refresh disabled to prevent connection pool conflicts with user operations
        # Users should manually click Refresh button to update dashboard

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
        title.setObjectName("section-title")
        title.setStyleSheet("font-size: 20px; border-bottom: none; padding-bottom: 0;")
        header_layout.addWidget(title)
        header_layout.addStretch()
        
        self.last_updated_label = QLabel("Last updated: --")
        self.last_updated_label.setObjectName("kpi-sub")
        header_layout.addWidget(self.last_updated_label)
        header_layout.addSpacing(12)
        
        self.refresh_btn = QPushButton("Refresh")
        self.refresh_btn.setObjectName("secondary")
        self.refresh_btn.setCursor(Qt.PointingHandCursor)
        self.refresh_btn.clicked.connect(lambda: self._load_data(force=True))
        header_layout.addWidget(self.refresh_btn)
        
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
        """Recursively clear a layout, destroying widgets and nested sub-layouts.

        The layout object passed in is NOT deleted (callers hold a permanent
        reference to the root layout); only its children and nested sub-layouts
        are torn down.
        """
        if layout is None:
            return
        while layout.count():
            item = layout.takeAt(0)
            widget = item.widget()
            if widget:
                widget.deleteLater()
            elif item.layout():
                sub = item.layout()
                self._clear_layout(sub)
                sub.deleteLater()
        self._flush_deferred_deletes()

    def _flush_deferred_deletes(self):
        """Force destruction of widgets scheduled with deleteLater().

        deleteLater() only takes effect once the deferred-delete events are
        processed. Without a real event-loop turn (e.g. when refreshes fire
        back-to-back), orphaned widgets stay alive and stacked, which makes
        graphs "grow" on every dashboard refresh.
        """
        QCoreApplication.sendPostedEvents(None, QEvent.DeferredDelete)

    def _load_data(self, force: bool = False):
        """Load dashboard data asynchronously."""
        logger.info("🔄 LOADING DASHBOARD DATA")
        
        # Reset loaded flag if forcing refresh (e.g., from refresh button)
        if force:
            self._is_loaded = False
        
        # Cancel any existing load thread
        old_thread = self._load_thread
        self._load_thread = None
        if old_thread is not None and shiboken6.isValid(old_thread):
            if old_thread.isRunning():
                logger.warning("⚠️ Previous load thread still running, terminating...")
                old_thread.terminate()
                old_thread.wait(1000)  # Wait up to 1 second
            # Always disconnect old signal to prevent multiple calls,
            # even if the thread already finished and emitted a queued signal
            try:
                old_thread.data_loaded.disconnect(self._on_data_loaded)
            except (RuntimeError, TypeError):
                pass
            old_thread.deleteLater()
        
        # Update UI to show loading state
        self.last_updated_label.setText("Last updated: Loading...")
        self.refresh_btn.setEnabled(False)
        self.refresh_btn.setText("Loading...")
        
        # Start new load thread with force_refresh flag
        self._load_thread = DashboardLoadThread(self.controller, force_refresh=force)
        self._load_thread.data_loaded.connect(self._on_data_loaded)
        self._load_thread.finished.connect(self._on_load_finished)
        self._load_thread.start()

    def _on_load_finished(self):
        """Clear the finished load thread so we never touch a dead wrapper."""
        sender = self.sender()
        if sender is not None and sender is self._load_thread:
            self._load_thread = None
        if sender is not None and shiboken6.isValid(sender):
            sender.deleteLater()
    
    def _on_data_loaded(self, data, error):
        """Handle dashboard data loaded from background thread."""
        # Mark as loaded regardless of error/success
        self._is_loaded = True
        
        # Re-enable refresh button
        self.refresh_btn.setEnabled(True)
        self.refresh_btn.setText("Refresh")
        
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
        self._clear_layout(self.content_layout)
        self._flush_deferred_deletes()
        
        # 1. KPI Cards
        self._add_kpi_cards(data)
        
        # 2. Charts
        self._add_charts(data)
        
        # 3. Today's Summary
        self._add_today_summary(data)
        
        # 4. Recent Transactions
        self._add_recent_transactions(data)
        
        # 5. Alerts
        self._add_alerts(data)
        
        # 6. Low Stock and Expiring (side by side)
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
        for c in range(3):
            grid.setColumnStretch(c, 1)
        
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
            card.setObjectName("kpi-card")
            card.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
            
            layout = QVBoxLayout(card)
            layout.setSpacing(6)
            
            title_label = QLabel(title)
            title_label.setObjectName("kpi-title")
            layout.addWidget(title_label)
            
            value_label = QLabel(value)
            value_label.setObjectName("kpi-value")
            value_label.setStyleSheet(f"color: {color};")
            layout.addWidget(value_label)
            
            grid.addWidget(card, row, col)
            col += 1
            if col > 2:
                col = 0
                row += 1
        
        # Add grid to content
        self.content_layout.addLayout(grid)

    def _add_charts(self, data):
        """Add charts row: asset allocation donut + revenue vs expense trend."""
        row = QWidget()
        row_layout = QHBoxLayout(row)
        row_layout.setSpacing(12)
        row_layout.setContentsMargins(0, 0, 0, 0)

        balances = data.get("balances", {})
        trend = data.get("monthly_trend", [])

        # -- Asset allocation donut --
        donut_frame = QFrame()
        donut_frame.setObjectName("section-frame")
        donut_layout = QVBoxLayout(donut_frame)
        donut_layout.setSpacing(8)

        donut_title = QLabel("Asset Allocation")
        donut_title.setObjectName("section-title")
        donut_layout.addWidget(donut_title)

        series = QPieSeries()
        series.setHoleSize(0.55)
        series.setPieSize(0.72)
        slices = [
            ("Cash", balances.get("cash", 0), "#2ecc71"),
            ("Bank", balances.get("bank", 0), "#3498db"),
            ("Inventory", balances.get("inventory", 0), "#9b59b6"),
        ]
        for label, value, color in slices:
            sl = series.append(f"{label}", max(float(value or 0), 0.0001))
            sl.setColor(QColor(color))
            sl.setLabelVisible(True)
            sl.setLabelColor(QColor("#adb5bd"))
            sl.setLabelFont(self.font())

        chart = QChart()
        chart.addSeries(series)
        chart.setBackgroundVisible(False)
        chart.setMargins(QMargins(0, 0, 0, 0))
        chart.legend().setVisible(True)
        chart.legend().setAlignment(Qt.AlignBottom)
        chart.legend().setLabelColor(QColor("#adb5bd"))
        chart.legend().setFont(self.font())

        view = QChartView(chart)
        view.setRenderHint(QPainter.Antialiasing)
        view.setMinimumHeight(260)
        donut_layout.addWidget(view)

        row_layout.addWidget(donut_frame, 1)

        # -- Revenue vs expenses trend --
        trend_frame = QFrame()
        trend_frame.setObjectName("section-frame")
        trend_layout = QVBoxLayout(trend_frame)
        trend_layout.setSpacing(8)

        trend_title = QLabel("Revenue vs Expenses (6 Months)")
        trend_title.setObjectName("section-title")
        trend_layout.addWidget(trend_title)

        if trend:
            months = []
            revenue_set = QBarSet("Revenue")
            expense_set = QBarSet("Expenses")
            revenue_set.setColor(QColor("#2ecc71"))
            expense_set.setColor(QColor("#e74c3c"))

            for entry in trend:
                month_str = str(entry.get("month", ""))
                months.append(month_str[5:7] + "/" + month_str[:4] if len(month_str) >= 7 else month_str)
                revenue_set.append(float(entry.get("revenue", 0)))
                expense_set.append(float(entry.get("expenses", 0)))

            bar_series = QBarSeries()
            bar_series.append(revenue_set)
            bar_series.append(expense_set)
            bar_series.setBarWidth(0.55)

            bar_chart = QChart()
            bar_chart.addSeries(bar_series)
            bar_chart.setBackgroundVisible(False)
            bar_chart.setMargins(QMargins(0, 0, 0, 0))

            axis_x = QBarCategoryAxis()
            axis_x.append(months)
            axis_x.setLabelsColor(QColor("#adb5bd"))
            axis_x.setLabelsFont(self.font())

            axis_y = QValueAxis()
            axis_y.setLabelFormat("%.0f")
            axis_y.setLabelsColor(QColor("#adb5bd"))
            axis_y.setLabelsFont(self.font())
            axis_y.setGridLineColor(QColor("#2a2a2a"))
            axis_y.setLineVisible(False)

            bar_chart.addAxis(axis_x, Qt.AlignBottom)
            bar_chart.addAxis(axis_y, Qt.AlignLeft)
            bar_series.attachAxis(axis_x)
            bar_series.attachAxis(axis_y)
            bar_chart.legend().setVisible(True)
            bar_chart.legend().setAlignment(Qt.AlignBottom)
            bar_chart.legend().setLabelColor(QColor("#adb5bd"))
            bar_chart.legend().setFont(self.font())

            bar_view = QChartView(bar_chart)
            bar_view.setRenderHint(QPainter.Antialiasing)
            bar_view.setMinimumHeight(260)
            trend_layout.addWidget(bar_view)
        else:
            empty = QLabel("No monthly data available.")
            empty.setObjectName("kpi-sub")
            empty.setAlignment(Qt.AlignCenter)
            trend_layout.addWidget(empty)

        row_layout.addWidget(trend_frame, 1)

        self.content_layout.addWidget(row)

    def _add_today_summary(self, data):
        """Add today's summary section."""
        today = data.get("today", {})
        
        frame = QFrame()
        frame.setObjectName("section-frame")
        
        layout = QVBoxLayout(frame)
        layout.setSpacing(10)
        
        title = QLabel("Today's Summary")
        title.setObjectName("section-title")
        layout.addWidget(title)
        
        # Stats row
        stats_layout = QHBoxLayout()
        stats_layout.setSpacing(12)
        
        stats = [
            ("Sales", today.get("sales_total", 0), today.get("sales_count", 0), "#2ecc71"),
            ("Purchases", today.get("purchases_total", 0), today.get("purchases_count", 0), "#e74c3c"),
        ]
        
        for label, total, count, color in stats:
            stat_frame = QFrame()
            stat_frame.setObjectName("sub-card")
            stat_frame.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
            
            stat_layout = QVBoxLayout(stat_frame)
            stat_layout.setSpacing(2)
            
            label_widget = QLabel(label)
            label_widget.setObjectName("kpi-title")
            stat_layout.addWidget(label_widget)
            
            amount = QLabel(f"Rs. {total:,.0f}")
            amount.setObjectName("kpi-value")
            amount.setStyleSheet(f"font-size: 20px; color: {color};")
            stat_layout.addWidget(amount)
            
            count_widget = QLabel(f"{count} transactions")
            count_widget.setObjectName("kpi-sub")
            stat_layout.addWidget(count_widget)
            
            stats_layout.addWidget(stat_frame)
        
        stats_layout.addStretch()
        layout.addLayout(stats_layout)
        
        self.content_layout.addWidget(frame)

    def _add_recent_transactions(self, data):
        """Add recent transactions section."""
        transactions = data.get("recent_transactions", [])
        
        frame = QFrame()
        frame.setObjectName("section-frame")
        
        layout = QVBoxLayout(frame)
        layout.setSpacing(10)
        
        title = QLabel("Recent Transactions")
        title.setObjectName("section-title")
        layout.addWidget(title)
        
        if not transactions:
            text = QLabel("No recent transactions.")
            text.setObjectName("kpi-sub")
            text.setStyleSheet("padding: 10px;")
            layout.addWidget(text)
        else:
            for txn in transactions[:10]:
                txn_widget = QWidget()
                txn_layout = QHBoxLayout(txn_widget)
                txn_layout.setContentsMargins(0, 2, 0, 2)
                txn_layout.setSpacing(12)
                
                type_colors = {
                    "Sales": "#2ecc71",
                    "Receipt": "#2ecc71",
                    "Purchases": "#e74c3c",
                    "Payment": "#e74c3c",
                    "Expense": "#f39c12",
                }
                color = type_colors.get(txn["type"], "#888")
                
                type_label = QLabel(txn["type"])
                type_label.setStyleSheet(f"color: {color}; font-weight: 600;")
                type_label.setFixedWidth(100)
                txn_layout.addWidget(type_label)
                
                party_label = QLabel(txn.get("party_name", "Unknown"))
                party_label.setStyleSheet("color: #e8e8e8;")
                party_label.setMinimumWidth(120)
                txn_layout.addWidget(party_label)
                
                amount_label = QLabel(f"Rs. {txn['amount']:,.2f}")
                amount_label.setStyleSheet("color: #e8e8e8; font-weight: 500;")
                amount_label.setMinimumWidth(100)
                txn_layout.addWidget(amount_label)
                
                date_label = QLabel(txn["date"])
                date_label.setObjectName("kpi-sub")
                txn_layout.addWidget(date_label)
                txn_layout.addStretch()
                
                line = QFrame()
                line.setFrameShape(QFrame.HLine)
                line.setStyleSheet("background: #242424;")
                layout.addWidget(line)
                layout.addWidget(txn_widget)
        
        self.content_layout.addWidget(frame)

    def _add_alerts(self, data):
        """Add alerts section."""
        alerts = data.get("alerts", {})
        alert_list = alerts.get("alerts", [])
        
        frame = QFrame()
        frame.setObjectName("section-frame")
        
        layout = QVBoxLayout(frame)
        layout.setSpacing(10)
        
        title = QLabel("Alerts")
        title.setObjectName("section-title")
        layout.addWidget(title)
        
        if not alert_list:
            text = QLabel("No alerts!")
            text.setStyleSheet("color: #2ecc71; padding: 10px;")
            layout.addWidget(text)
        else:
            for alert in alert_list[:5]:
                alert_type = alert.get("type", "success")
                if alert_type not in ("danger", "warning", "success"):
                    alert_type = "success"
                
                alert_widget = QFrame()
                alert_widget.setObjectName(f"alert-{alert_type}")
                
                alert_layout = QVBoxLayout(alert_widget)
                alert_layout.setSpacing(2)
                alert_layout.setContentsMargins(12, 8, 12, 8)
                
                title_label = QLabel(alert['title'])
                title_label.setObjectName("alert-title")
                alert_layout.addWidget(title_label)
                
                msg_label = QLabel(alert['message'])
                msg_label.setObjectName("alert-msg")
                msg_label.setWordWrap(True)
                alert_layout.addWidget(msg_label)
                
                layout.addWidget(alert_widget)
        
        self.content_layout.addWidget(frame)

    def _add_low_stock_expiring(self, data):
        """Add low stock and expiring items section."""
        inventory = data.get("inventory", {})
        low_stock = inventory.get("low_stock_items", [])
        expiring = inventory.get("expiring_items", [])
        
        frame = QFrame()
        frame.setObjectName("section-frame")
        
        layout = QVBoxLayout(frame)
        layout.setSpacing(10)
        
        cols_layout = QHBoxLayout()
        cols_layout.setSpacing(12)
        
        # Left: Low Stock
        left_frame = QFrame()
        left_frame.setObjectName("sub-card")
        left_layout = QVBoxLayout(left_frame)
        left_layout.setSpacing(4)
        
        left_title = QLabel("Low Stock Items")
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
        
        cols_layout.addWidget(left_frame, 1)
        
        # Right: Expiring Soon
        right_frame = QFrame()
        right_frame.setObjectName("sub-card")
        right_layout = QVBoxLayout(right_frame)
        right_layout.setSpacing(4)
        
        right_title = QLabel("Expiring Soon")
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
        
        cols_layout.addWidget(right_frame, 1)
        
        layout.addLayout(cols_layout)
        self.content_layout.addWidget(frame)

    def refresh(self):
        """Public refresh method."""
        self._load_data()
        
    def _show_empty_state(self):
        """Show empty state when no data is available."""
        # Clear existing widgets
        self._clear_layout(self.content_layout)
        self._flush_deferred_deletes()
        
        # Show welcome message
        label = QLabel("Welcome to BOP Nutraceuticals!\n\nStart by adding:\n• Chart of Accounts\n• Parties (Customers & Suppliers)\n• Items (Inventory)\n• Purchase Invoices\n• Sales Invoices")
        label.setAlignment(Qt.AlignCenter)
        label.setStyleSheet("font-size: 16px; color: #adb5bd; padding: 50px;")
        self.content_layout.addWidget(label)