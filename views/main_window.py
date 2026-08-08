"""
Main application window with role-based navigation.
"""
from __future__ import annotations

from PySide6.QtCore import QTimer, Qt, Signal, QPropertyAnimation, QEasingCurve
from PySide6.QtWidgets import (
    QHBoxLayout,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QStackedWidget,
    QStatusBar,
    QVBoxLayout,
    QWidget,
    QSizePolicy,
    QProgressBar,
    QGraphicsOpacityEffect,
)

from config.app_config import get_config
from controllers.auth_controller import AuthController
from models.user import User
from views.widgets.dashboard_view import DashboardView
from views.widgets.chart_of_accounts_widget import ChartOfAccountsWidget
from views.widgets.item_view import ItemView
from views.widgets.party_view import PartyView
from views.widgets.purchase_invoice_view import PurchaseInvoiceView
from views.widgets.sales_invoice_view import SalesInvoiceView
from views.widgets.manufacturing_view import ManufacturingView
from views.widgets.expense_view import ExpenseView
from views.widgets.payment_view import PaymentView
from views.widgets.banking_view import BankingView
from views.widgets.report_view import ReportView
from views.widgets.backup_view import BackupView
from views.widgets.users_view import UsersView  # We'll create this next
from views.widgets.asset_view import AssetView


class MainWindow(QMainWindow):
    # All available navigation items with their module key
    ALL_NAV_ITEMS = [
        ("Dashboard", "dashboard", DashboardView),
        ("Chart of Accounts", "chart_of_accounts", ChartOfAccountsWidget),
        ("Opening Balance", "opening_balance", None),
        ("Party Management", "parties", PartyView),
        ("Inventory", "inventory", ItemView),
        ("Sales", "sales", SalesInvoiceView),
        ("Purchases", "purchases", PurchaseInvoiceView),
        ("Manufacturing", "manufacturing", ManufacturingView),
        ("Expenses", "expenses", ExpenseView),
        ("Assets", "assets", AssetView),  # ← NOW A PAGE (not dialog)
        ("Payments", "payments", PaymentView),
        ("Banking", "banking", BankingView),
        ("Reports", "reports", ReportView),
        ("Backup", "backup", BackupView),
        ("Users", "users", UsersView),
        ("Settings", "settings", None),
    ]

    def __init__(self, user: User, auth_controller: AuthController, lazy_load: bool = True, parent=None):
        super().__init__(parent)
        self.user = user
        self.auth_controller = auth_controller
        self._pages: dict[str, QWidget] = {}
        self._nav_items = self._get_filtered_nav_items()
        self._loading_overlay = None  # Overlay for invoice creation
        
        # Build UI fast - no data loading
        self._build_ui()
        
    def load_initial_data(self):
        """Load data AFTER window is shown."""
        if self._is_loaded:
            return
        
        self._is_loaded = True
        self.statusBar().showMessage("Loading data...")
        
        # Load the first page
        if self.nav_list.count() > 0:
            current = self.nav_list.currentItem()
            if current:
                key = current.data(Qt.UserRole)
                self._load_page(key)
        
        self.statusBar().showMessage(f"Logged in as {self.user.username} ({self.user.role_name})")
    def _get_filtered_nav_items(self) -> list[tuple[str, str, type | None]]:
        """Filter navigation items based on user permissions."""
        filtered = []
        for label, key, view_class in self.ALL_NAV_ITEMS:
            if self.user.can_access(key):
                filtered.append((label, key, view_class))
        return filtered

    def _build_ui(self) -> None:
        cfg = get_config()
        self.setWindowTitle(f"{cfg.app_name} — {self.user.full_name} ({self.user.role_name})")
        self.resize(1400, 900)

        central = QWidget()
        root_layout = QHBoxLayout(central)
        root_layout.setContentsMargins(0, 0, 0, 0)
        root_layout.setSpacing(0)

        # -- Sidebar --------------------------------------------------
        sidebar = QWidget()
        sidebar.setFixedWidth(240)
        sidebar.setObjectName("sidebar")
        sidebar_layout = QVBoxLayout(sidebar)
        sidebar_layout.setContentsMargins(0, 0, 0, 0)
        sidebar_layout.setSpacing(0)

        brand = QLabel("BOP Nutraceuticals")
        brand.setWordWrap(True)
        brand.setAlignment(Qt.AlignCenter)
        brand.setStyleSheet("""
            font-weight: bold;
            font-size: 14px;
            padding: 16px 8px;
            color: #ffffff;
            background: rgba(255, 255, 255, 0.05);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        """)
        brand.setFixedHeight(60)
        sidebar_layout.addWidget(brand)

        self.nav_list = QListWidget()
        self.nav_list.setFrameShape(QListWidget.NoFrame)
        self.nav_list.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.nav_list.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.nav_list.setSizePolicy(QSizePolicy.Preferred, QSizePolicy.Expanding)

        self.nav_list.setStyleSheet("""
            QListWidget::item {
                padding: 8px 16px;
                margin: 1px 4px;
            }
        """)

        # Add filtered navigation items
        for label, key, _ in self._nav_items:
            item = QListWidgetItem(label)
            item.setData(Qt.UserRole, key)
            self.nav_list.addItem(item)
        
        self.nav_list.currentItemChanged.connect(self._on_nav_changed)

        sidebar_layout.addWidget(self.nav_list, 1)

        # User info at bottom of sidebar
        user_info = QLabel(f"👤 {self.user.full_name}\n{self.user.role_name}")
        user_info.setWordWrap(True)
        user_info.setAlignment(Qt.AlignCenter)
        user_info.setStyleSheet("""
            color: #a8b2d1;
            padding: 8px 16px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            font-size: 11px;
        """)
        sidebar_layout.addWidget(user_info)

        logout_btn = QPushButton("Logout")
        logout_btn.setFixedHeight(40)
        logout_btn.clicked.connect(self._on_logout)
        sidebar_layout.addWidget(logout_btn)

        # -- Content stack ---------------------------------------------
        self.stack = QStackedWidget()

        root_layout.addWidget(sidebar)
        root_layout.addWidget(self.stack, stretch=1)

        self.setCentralWidget(central)
        self.setStatusBar(QStatusBar())
        self.statusBar().showMessage(f"Logged in as {self.user.username} ({self.user.role_name})")

        # Select first item
        if self.nav_list.count() > 0:
            self.nav_list.setCurrentRow(0)

    def _on_nav_changed(self, current: QListWidgetItem, _previous) -> None:
        if current is None:
            return
        key = current.data(Qt.UserRole)
        
        # Handle special case for Opening Balance dialog
        if key == "opening_balance":
            from views.widgets.opening_balance_dialog import OpeningBalanceDialog
            dialog = OpeningBalanceDialog(self)
            dialog.exec()
            # Stay on current page
            return
        
        page = self._get_or_create_page(key)
        self.stack.setCurrentWidget(page)
        self.statusBar().showMessage(f"Viewing: {current.text()}")

    def _get_or_create_page(self, key: str) -> QWidget:
        # Handle dialog-only items
        if key == "opening_balance":
            from views.widgets.opening_balance_dialog import OpeningBalanceDialog
            dialog = OpeningBalanceDialog(self)
            dialog.exec()
            placeholder = QWidget()
            layout = QVBoxLayout(placeholder)
            layout.setAlignment(Qt.AlignCenter)
            label = QLabel("✅ Opening Balance set successfully!")
            label.setStyleSheet("color: #2ecc71; font-size: 16px;")
            layout.addWidget(label)
            return placeholder

        # REMOVE the assets special case - it's now a normal page

        if key in self._pages:
            return self._pages[key]

        # Find the view class for this key
        view_class = None
        for label, k, vc in self._nav_items:
            if k == key:
                view_class = vc
                break

        if view_class:
            page = view_class()
        else:
            placeholder = QWidget()
            layout = QVBoxLayout(placeholder)
            layout.setAlignment(Qt.AlignCenter)
            label = QLabel(f"'{key.replace('_', ' ').title()}' module")
            label.setStyleSheet("color: #888; font-size: 13px;")
            layout.addWidget(label)
            page = placeholder

        self._pages[key] = page
        self.stack.addWidget(page)
        return page

    def show_loading_overlay(self, message: str = "Processing...") -> None:
        """Show a loading overlay to block user interaction during critical operations."""
        if self._loading_overlay is None:
            # Create overlay widget
            self._loading_overlay = QWidget(self)
            self._loading_overlay.setObjectName("loadingOverlay")
            self._loading_overlay.setStyleSheet("""
                QWidget#loadingOverlay {
                    background-color: rgba(0, 0, 0, 180);
                }
            """)
            
            # Layout for overlay
            overlay_layout = QVBoxLayout(self._loading_overlay)
            overlay_layout.setAlignment(Qt.AlignCenter)
            
            # Loading label
            loading_label = QLabel(message)
            loading_label.setStyleSheet("""
                color: #ffffff;
                font-size: 18px;
                font-weight: bold;
                padding: 20px;
            """)
            loading_label.setAlignment(Qt.AlignCenter)
            overlay_layout.addWidget(loading_label)
            
            # Progress bar (indeterminate)
            progress_bar = QProgressBar()
            progress_bar.setRange(0, 0)  # Indeterminate mode
            progress_bar.setFixedWidth(300)
            progress_bar.setStyleSheet("""
                QProgressBar {
                    background-color: rgba(255, 255, 255, 50);
                    border-radius: 10px;
                    padding: 3px;
                }
                QProgressBar::chunk {
                    background-color: #3498db;
                    border-radius: 7px;
                }
            """)
            overlay_layout.addWidget(progress_bar)
            
            # Set geometry to cover entire window
            self._loading_overlay.setGeometry(self.rect())
            self._loading_overlay.raise_()
            self._loading_overlay.show()
            
            # Fade in animation
            opacity_effect = QGraphicsOpacityEffect(self._loading_overlay)
            self._loading_overlay.setGraphicsEffect(opacity_effect)
            fade_in = QPropertyAnimation(opacity_effect, b"opacity")
            fade_in.setDuration(200)
            fade_in.setStartValue(0.0)
            fade_in.setEndValue(1.0)
            fade_in.setEasingCurve(QEasingCurve.InOutQuad)
            fade_in.start()
        else:
            # Update message if overlay already exists
            label = self._loading_overlay.findChild(QLabel)
            if label:
                label.setText(message)
            self._loading_overlay.raise_()

    def hide_loading_overlay(self) -> None:
        """Hide the loading overlay."""
        if self._loading_overlay:
            # Fade out animation
            opacity_effect = self._loading_overlay.graphicsEffect()
            if opacity_effect:
                fade_out = QPropertyAnimation(opacity_effect, b"opacity")
                fade_out.setDuration(200)
                fade_out.setStartValue(1.0)
                fade_out.setEndValue(0.0)
                fade_out.setEasingCurve(QEasingCurve.InOutQuad)
                fade_out.finished.connect(self._on_overlay_hidden)
                fade_out.start()
            else:
                self._loading_overlay.deleteLater()
                self._loading_overlay = None
    
    def _on_overlay_hidden(self):
        """Called when overlay fade-out animation completes."""
        if self._loading_overlay:
            self._loading_overlay.deleteLater()
            self._loading_overlay = None

    def resizeEvent(self, event):
        """Handle window resize to adjust overlay."""
        super().resizeEvent(event)
        if self._loading_overlay:
            self._loading_overlay.setGeometry(self.rect())


    def _on_logout(self) -> None:
        confirm = QMessageBox.question(self, "Logout", "Are you sure you want to logout?")
        if confirm == QMessageBox.Yes:
            self.auth_controller.logout()
            self.close()