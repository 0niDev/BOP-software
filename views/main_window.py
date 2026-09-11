"""
Main application window with role-based navigation.
"""
from __future__ import annotations

from PySide6.QtCore import QTimer, Qt, Signal, QPropertyAnimation, QEasingCurve
from PySide6.QtWidgets import (
    QDialog,
    QHBoxLayout,
    QLabel,
    QLineEdit,
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
from PySide6.QtGui import QShortcut, QKeySequence

from config.app_config import get_config
from controllers.auth_controller import AuthController
from models.user import User
from utils.event_bus import event_bus
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

        # Keyboard-first layer: global shortcuts + module finder.
        self._setup_shortcuts()
        
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
        brand.setObjectName("brand")
        brand.setStyleSheet("""
            font-weight: 700;
            font-size: 15px;
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

        # Add filtered navigation items
        for label, key, _ in self._nav_items:
            item = QListWidgetItem(label)
            item.setData(Qt.UserRole, key)
            self.nav_list.addItem(item)
        
        self.nav_list.currentItemChanged.connect(self._on_nav_changed)

        # Type-ahead module finder (keyboard first: Ctrl+F / click to focus,
        # type, then Enter to jump).
        self.nav_filter = QLineEdit()
        self.nav_filter.setPlaceholderText("Find module…  (Ctrl+F)")
        self.nav_filter.setClearButtonEnabled(True)
        self.nav_filter.setObjectName("navFilter")
        self.nav_filter.setStyleSheet(
            "QLineEdit#navFilter {"
            "  background: #1f1f2a; color: #e0e0e0; border: 1px solid #3a3a4a;"
            "  border-radius: 8px; padding: 6px 10px;}"
            "QLineEdit#navFilter:focus { border: 1px solid #8B1A2B; }"
        )
        self.nav_filter.setFixedHeight(34)
        self.nav_filter.textChanged.connect(self._filter_nav)
        self.nav_filter.returnPressed.connect(self._on_nav_filter_accepted)
        sidebar_layout.addWidget(self.nav_filter)

        sidebar_layout.addWidget(self.nav_list, 1)

        # User info at bottom of sidebar
        user_info = QLabel(f"{self.user.full_name}\n{self.user.role_name}")
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
            label.setStyleSheet("color: #9b9b9b; font-size: 13px;")
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
                    background-color: rgba(0, 0, 0, 200);
                }
            """)
            
            # Layout for overlay
            overlay_layout = QVBoxLayout(self._loading_overlay)
            overlay_layout.setAlignment(Qt.AlignCenter)
            
            # Loading label - larger and more prominent
            loading_label = QLabel(message)
            loading_label.setStyleSheet("""
                color: #ffffff;
                font-size: 22px;
                font-weight: bold;
                padding: 30px;
            """)
            loading_label.setAlignment(Qt.AlignCenter)
            overlay_layout.addWidget(loading_label)
            
            # Progress bar (indeterminate) - larger
            progress_bar = QProgressBar()
            progress_bar.setRange(0, 0)  # Indeterminate mode
            progress_bar.setFixedWidth(400)
            progress_bar.setFixedHeight(20)
            progress_bar.setStyleSheet("""
                QProgressBar {
                    background-color: rgba(255, 255, 255, 60);
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
            
            # NO fade-in animation - show instantly for immediate feedback
            # Overlay is now immediately visible and interactive-blocking
        else:
            # Update message if overlay already exists
            label = self._loading_overlay.findChild(QLabel)
            if label:
                label.setText(message)
            self._loading_overlay.raise_()

    def hide_loading_overlay(self) -> None:
        """Hide the loading overlay."""
        if self._loading_overlay:
            # NO fade-out animation - hide instantly for immediate feedback
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

    # ================================================================
    #  Keyboard-first layer
    # ================================================================
    def _setup_shortcuts(self) -> None:
        """Register global keyboard shortcuts (window-level context)."""
        from functools import partial

        # Ctrl+1..9, Ctrl+0 → jump to module by position in the nav list.
        for i in range(10):
            seq = "Ctrl+0" if i == 9 else f"Ctrl+{i + 1}"
            QShortcut(QKeySequence(seq), self,
                      partial(self._goto_index, i), Qt.WindowShortcut)

        QShortcut(QKeySequence("Ctrl+Tab"), self, self._goto_next, Qt.WindowShortcut)
        QShortcut(QKeySequence("Ctrl+Shift+Tab"), self, self._goto_prev,
                  Qt.WindowShortcut)
        QShortcut(QKeySequence("Ctrl+R"), self, self._refresh_current,
                  Qt.WindowShortcut)
        QShortcut(QKeySequence("Ctrl+F"), self, self._focus_search,
                  Qt.WindowShortcut)
        QShortcut(QKeySequence("Ctrl+N"), self, self._create_new,
                  Qt.WindowShortcut)
        QShortcut(QKeySequence("Ctrl+K"), self, self._open_palette,
                  Qt.WindowShortcut)

    def _current_page(self):
        return self.stack.currentWidget()

    def _nav_row_for_key(self, key: str) -> int:
        for r in range(self.nav_list.count()):
            it = self.nav_list.item(r)
            if it is not None and it.data(Qt.UserRole) == key:
                return r
        return -1

    def _goto_key(self, key: str) -> bool:
        row = self._nav_row_for_key(key)
        if row >= 0:
            self.nav_list.setCurrentRow(row)
            return True
        return False

    def _goto_index(self, index: int) -> None:
        n = self.nav_list.count()
        if n == 0:
            return
        self.nav_list.setCurrentRow(index % n)

    def _goto_next(self) -> None:
        n = self.nav_list.count()
        if n == 0:
            return
        self.nav_list.setCurrentRow((self.nav_list.currentRow() + 1) % n)

    def _goto_prev(self) -> None:
        n = self.nav_list.count()
        if n == 0:
            return
        self.nav_list.setCurrentRow((self.nav_list.currentRow() - 1) % n)

    def _filter_nav(self, text: str) -> None:
        """Hide non-matching sidebar modules as the user types."""
        needle = text.strip().lower()
        for r in range(self.nav_list.count()):
            it = self.nav_list.item(r)
            label = it.text().lower() if it else ""
            self.nav_list.setRowHidden(r, bool(needle and needle not in label))

    def _on_nav_filter_accepted(self) -> None:
        """Enter in the module finder → jump to the first visible module."""
        current = self.nav_list.currentRow()
        n = self.nav_list.count()
        if 0 <= current < n and not self.nav_list.isRowHidden(current):
            self.nav_filter.selectAll()
            return
        for r in range(n):
            if not self.nav_list.isRowHidden(r):
                self.nav_list.setCurrentRow(r)
                break

    def _refresh_current(self) -> None:
        """Ctrl+R: reload the currently visible page (best effort)."""
        page = self._current_page()
        if page is not None:
            for name in ("refresh", "_load_data", "_load_assets", "_load_payments",
                         "_load_expenses", "_load_parties_async", "_load_users"):
                fn = getattr(page, name, None)
                if callable(fn):
                    try:
                        fn()
                    except Exception:
                        continue
                    self.statusBar().showMessage("Refreshed", 2000)
                    return
        # Fallback: ping the shared event bus so BaseView subclasses refresh.
        event_bus.emit("data_changed", {"force": True})
        self.statusBar().showMessage("Refreshed", 2000)

    def _focus_search(self) -> None:
        """Ctrl+F: focus the search box on the current page (or the module finder)."""
        page = self._current_page()
        if page is not None:
            # Dedicated SearchBar widget integration.
            bar = getattr(page, "search_bar", None)
            if bar is not None and hasattr(bar, "focus_search"):
                bar.focus_search()
                return
            # Inline search QLineEdit (sales, purchases, parties, items, accounts…).
            si = getattr(page, "search_input", None)
            if si is not None:
                try:
                    si.setFocus()
                    si.selectAll()
                    return
                except Exception:
                    pass
            for le in page.findChildren(QLineEdit):
                ph = (le.placeholderText() or "").lower()
                if "search" in ph or "filter" in ph or "find" in ph:
                    le.setFocus()
                    le.selectAll()
                    return
        # Default to the sidebar module finder.
        self.nav_filter.setFocus()
        self.nav_filter.selectAll()

    def _create_new(self) -> None:
        """Ctrl+N: start creating a new record on the current page (best effort)."""
        page = self._current_page()
        if page is None:
            return
        for name in ("trigger_create_new", "create_new", "_on_add_new",
                     "_on_add_asset", "_on_add_expense", "_on_add_user",
                     "_on_add_clicked", "_on_add"):
            fn = getattr(page, name, None)
            if callable(fn):
                try:
                    fn()
                except Exception:
                    continue
                return

    def _open_palette(self) -> None:
        """Ctrl+K: command palette — type to filter modules, Enter to jump."""
        if getattr(self, "_palette_open", False):
            return
        items = []
        for r in range(self.nav_list.count()):
            it = self.nav_list.item(r)
            if it is not None:
                items.append((it.text(), it.data(Qt.UserRole)))
        if not items:
            return
        self._palette_open = True
        try:
            dialog = ModuleJumpDialog(items, self)
            dialog.select_callback = self._goto_key
            dialog.exec()
        finally:
            self._palette_open = False

    def _on_logout(self) -> None:
        confirm = QMessageBox.question(self, "Logout", "Are you sure you want to logout?")
        if confirm == QMessageBox.Yes:
            self.auth_controller.logout()
            self.close()

class ModuleJumpDialog(QDialog):
    """Compact command palette: type to filter modules, Enter to jump, Esc to close.

    Arrows and Enter keep working even while the search box has focus (routed
    through an application-level event filter installed only for the lifetime
    of the dialog).
    """

    def __init__(self, items, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Jump to module — Ctrl+K")
        self.setModal(True)
        self.setMinimumSize(380, 340)
        self._items = items                      # list of (label, key)
        self.select_callback = None
        self._done = False
        self._event_filter = None

        self.setStyleSheet("QDialog { background: #141418; }")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(14, 14, 14, 10)
        layout.setSpacing(8)

        self.search = QLineEdit()
        self.search.setPlaceholderText("Type a module name, then Enter…")
        self.search.setClearButtonEnabled(True)
        self.search.setStyleSheet(
            "QLineEdit { background:#1f1f2a; color:#e0e0e0;"
            "  border:1px solid #3a3a4a; border-radius:8px; padding:9px;}"
            "QLineEdit:focus { border:1px solid #8B1A2B; background:#26263a; }"
        )
        self.search.textChanged.connect(self._filter)
        layout.addWidget(self.search)

        self.list = QListWidget()
        self.list.setFrameShape(QListWidget.NoFrame)
        self.list.setStyleSheet(
            "QListWidget { background:#141418; color:#e0e0e0;"
            "  border:1px solid #2a2a3a; }"
            "QListWidget::item { height:36px; padding:7px; color:#c6cde0; }"
            "QListWidget::item:selected { background:#8B1A2B; color:#ffffff; }"
        )
        self.list.itemDoubleClicked.connect(lambda _it: self._accept())
        layout.addWidget(self.list, 1)

        hint = QLabel("↑↓ navigate      Enter jump      Esc close")
        hint.setStyleSheet("color:#8a94ad; font-size:11px;")
        layout.addWidget(hint)

        self._rebuild(self._items)
        if self.list.count():
            self.list.setCurrentRow(0)
        self.search.setFocus()

        self._install_key_filter()

    # ------------------------------------------------------------------ #
    def _install_key_filter(self) -> None:
        from PySide6.QtCore import QEvent, QObject
        from PySide6.QtWidgets import QApplication

        class _Filter(QObject):
            def __init__(self, dlg):
                super().__init__()
                self._d = dlg

            def eventFilter(self, _target, event):
                d = self._d
                if not d.isVisible():
                    return False
                if event.type() == QEvent.Type.KeyPress:
                    key = event.key()
                    if key == Qt.Key.Key_Down:
                        d._move(1); event.accept(); return True
                    if key == Qt.Key.Key_Up:
                        d._move(-1); event.accept(); return True
                    if key in (Qt.Key.Key_Return, Qt.Key.Key_Enter):
                        d._accept(); event.accept(); return True
                    if key == Qt.Key.Key_Escape:
                        d.reject(); event.accept(); return True
                return False

        self._event_filter = _Filter(self)
        QApplication.instance().installEventFilter(self._event_filter)
        self.finished.connect(self._remove_key_filter)

    def _remove_key_filter(self, _result) -> None:
        from PySide6.QtWidgets import QApplication
        if self._event_filter is not None:
            QApplication.instance().removeEventFilter(self._event_filter)
            self._event_filter = None

    # ------------------------------------------------------------------ #
    def _rebuild(self, items) -> None:
        self.list.clear()
        for label, key in items:
            it = QListWidgetItem(label)
            it.setData(Qt.UserRole, key)
            self.list.addItem(it)

    def _filter(self, text: str) -> None:
        needle = text.strip().lower()
        if not needle:
            self._rebuild(self._items)
        else:
            self._rebuild(
                [x for x in self._items
                 if needle in x[0].lower() or needle in (x[1] or "").lower()]
            )
        if self.list.count():
            self.list.setCurrentRow(0)

    def _move(self, delta: int) -> None:
        n = self.list.count()
        if n == 0:
            return
        idx = self.list.currentRow()
        if idx < 0:
            idx = 0
        self.list.setCurrentRow((idx + delta) % n)

    def _accept(self) -> None:
        if self._done:
            return
        current = self.list.currentItem()
        if current is None:
            return
        self._done = True
        key = current.data(Qt.UserRole)
        if self.select_callback is not None:
            try:
                self.select_callback(key)
            except Exception:
                pass
        self.accept()
