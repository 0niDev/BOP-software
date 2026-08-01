"""Expense management widget."""
from __future__ import annotations

from PySide6.QtCore import Qt, Signal, QDate, QThread, QObject, QTimer
from PySide6.QtWidgets import (
    QComboBox,
    QDateEdit,
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QVBoxLayout,
    QWidget,
    QTableWidgetItem,
    QHeaderView,
    QDoubleSpinBox,
    QTabWidget,
)

from controllers.expense_controller import ExpenseController
from controllers.account_controller import AccountController
from models.expense import ExpenseCategory
from utils.logger import get_logger

logger = get_logger(__name__)


class ExpenseDataLoader(QObject):
    """Background worker for loading expense data."""
    data_loaded = Signal(dict)
    error_occurred = Signal(str)
    
    def __init__(self, controller, account_controller):
        super().__init__()
        self.controller = controller
        self.account_controller = account_controller
    
    def run(self):
        """Load all expense data in background."""
        try:
            # Load categories
            categories, cat_error = self.controller.list_categories()
            if cat_error:
                self.error_occurred.emit(f"Categories: {cat_error}")
                return
            
            # Load expenses
            expenses, exp_error = self.controller.list_expenses()
            if exp_error:
                self.error_occurred.emit(f"Expenses: {exp_error}")
                return
            
            self.data_loaded.emit({
                'categories': categories,
                'expenses': expenses
            })
        except Exception as e:
            self.error_occurred.emit(str(e))


class CategoryDialog(QDialog):
    """Dialog for creating/editing expense categories."""

    def __init__(self, account_controller: AccountController, category: ExpenseCategory | None = None, parent=None):
        super().__init__(parent)
        self.account_controller = account_controller
        self.category = category
        self.setWindowTitle("Edit Category" if category else "New Category")
        self.setModal(True)
        self.resize(400, 200)
        self._setup_ui()
        if category:
            self._load_category_data()
        self._load_accounts()

    def _setup_ui(self):
        layout = QVBoxLayout(self)

        form_group = QGroupBox("Category Details")
        form_layout = QFormLayout(form_group)

        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("e.g., Salaries, Electricity")
        form_layout.addRow("Name*:", self.name_input)

        self.account_combo = QComboBox()
        self.account_combo.addItem("None (Auto-create)", None)
        form_layout.addRow("Account:", self.account_combo)

        layout.addWidget(form_group)

        button_box = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel,
            Qt.Horizontal, self
        )
        button_box.accepted.connect(self.accept)
        button_box.rejected.connect(self.reject)
        layout.addWidget(button_box)

    def _load_accounts(self):
        """Load expense accounts into dropdown."""
        accounts, error = self.account_controller.list_accounts(active_only=True)
        if error:
            return

        self.account_combo.clear()
        self.account_combo.addItem("None (Auto-create)", None)

        for acc in accounts:
            if acc.account_type.value == "EXPENSE":
                self.account_combo.addItem(
                    f"{acc.account_code} - {acc.account_name}",
                    acc.id
                )

    def _load_category_data(self):
        if self.category:
            self.name_input.setText(self.category.name)
            if self.category.account_id:
                idx = self.account_combo.findData(self.category.account_id)
                if idx >= 0:
                    self.account_combo.setCurrentIndex(idx)

    def get_category_data(self) -> dict:
        return {
            "name": self.name_input.text().strip(),
            "account_id": self.account_combo.currentData(),
        }


from views.base_view import BaseView
class ExpenseView(QWidget):
    """Widget for managing expenses."""

    expense_created = Signal(dict)
    expense_deleted = Signal(int)

    def __init__(self, expense_controller: ExpenseController | None = None, parent=None):
        super().__init__(parent)
        self.controller = expense_controller or ExpenseController()
        self.account_controller = AccountController()
        self._selected_expense_id: int | None = None
        self._selected_category_id: int | None = None
        self._categories: list[ExpenseCategory] = []
        self._loader_thread = None
        self._data_cache = {}
        self._build_ui()
        # Don't load immediately - wait for showEvent

    def showEvent(self, event):
        """Called when the widget is shown - lazy load data."""
        super().showEvent(event)
        if not hasattr(self, '_is_loaded') or not self._is_loaded:
            self._show_loading_state()
            QTimer.singleShot(50, self._load_data_async)
    
    def _show_loading_state(self):
        """Show loading state in tables."""
        self.table.setRowCount(1)
        self.table.setColumnCount(1)
        self.table.setHorizontalHeaderLabels(["Loading..."])
        loading_item = QTableWidgetItem("Loading expenses...")
        loading_item.setTextAlignment(Qt.AlignCenter)
        self.table.setItem(0, 0, loading_item)
        
        self.category_table.setRowCount(1)
        self.category_table.setColumnCount(1)
        self.category_table.setHorizontalHeaderLabels(["Loading..."])
        loading_item2 = QTableWidgetItem("Loading categories...")
        loading_item2.setTextAlignment(Qt.AlignCenter)
        self.category_table.setItem(0, 0, loading_item2)
    
    def _load_data_async(self):
        """Load expense data in background thread."""
        if hasattr(self, '_is_loaded') and self._is_loaded:
            return
        
        # Create worker
        self._loader_thread = QThread()
        self._worker = ExpenseDataLoader(self.controller, self.account_controller)
        self._worker.moveToThread(self._loader_thread)
        
        # Connect signals
        self._loader_thread.started.connect(self._worker.run)
        self._worker.data_loaded.connect(self._on_data_loaded)
        self._worker.error_occurred.connect(self._on_load_error)
        self._worker.data_loaded.connect(self._loader_thread.quit)
        self._worker.error_occurred.connect(self._loader_thread.quit)
        
        # Cleanup
        self._worker.data_loaded.connect(self._cleanup_loader)
        self._worker.error_occurred.connect(self._cleanup_loader)
        
        # Start thread
        self._loader_thread.start()
    
    def _on_data_loaded(self, data):
        """Handle loaded data - update UI on main thread."""
        self._data_cache = data
        
        # Populate categories
        self._populate_categories(data['categories'])
        
        # Populate expenses
        self._populate_expenses(data['expenses'])
        
        self._is_loaded = True
    
    def _load_expenses(self) -> None:
        """Reload expenses by restarting the async load."""
        self._is_loaded = False
        self._show_loading_state()
        QTimer.singleShot(50, self._load_data_async)
    
    def _on_load_error(self, error_msg):
        """Handle loading error."""
        QMessageBox.warning(self, "Load Error", f"Failed to load data: {error_msg}")
        self._is_loaded = True  # Prevent retry loop
    
    def _cleanup_loader(self):
        """Cleanup loader thread."""
        if self._loader_thread and self._loader_thread.isRunning():
            self._loader_thread.quit()
            self._loader_thread.wait(3000)
        self._loader_thread = None
        self._worker = None


    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(10)

        # Tabs
        self.tabs = QTabWidget()

        # Tab 1: Expenses
        expense_tab = QWidget()
        expense_layout = QVBoxLayout(expense_tab)
        self._build_expense_tab(expense_layout)
        self.tabs.addTab(expense_tab, "Expenses")

        # Tab 2: Categories
        category_tab = QWidget()
        category_layout = QVBoxLayout(category_tab)
        self._build_category_tab(category_layout)
        self.tabs.addTab(category_tab, "Categories")

        layout.addWidget(self.tabs)

    def _build_expense_tab(self, layout):
        # Filters
        filter_layout = QHBoxLayout()

        self.date_from = QDateEdit()
        from PySide6.QtCore import QDate
        current = QDate.currentDate()
        self.date_from.setDate(QDate(current.year(), current.month(), 1))
        self.date_from.setDisplayFormat("yyyy-MM-dd")
        filter_layout.addWidget(QLabel("From:"))
        filter_layout.addWidget(self.date_from)

        self.date_to = QDateEdit()
        self.date_to.setDate(QDate.currentDate())
        self.date_to.setDisplayFormat("yyyy-MM-dd")
        filter_layout.addWidget(QLabel("To:"))
        filter_layout.addWidget(self.date_to)

        self.category_filter = QComboBox()
        self.category_filter.addItem("All Categories", None)
        filter_layout.addWidget(self.category_filter)

        self.filter_btn = QPushButton("Filter")
        self.filter_btn.clicked.connect(self._load_expenses)
        filter_layout.addWidget(self.filter_btn)

        layout.addLayout(filter_layout)

        # Expense Table
        self.table = QTableWidget()
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.setSelectionMode(QTableWidget.SingleSelection)
        self.table.clicked.connect(self._on_table_clicked)
        layout.addWidget(self.table, stretch=1)

        # Buttons
        button_layout = QHBoxLayout()

        self.add_btn = QPushButton("New Expense")
        self.add_btn.clicked.connect(self._on_add_expense)
        button_layout.addWidget(self.add_btn)

        self.delete_btn = QPushButton("Delete")
        self.delete_btn.clicked.connect(self._on_delete_expense)
        self.delete_btn.setEnabled(False)
        button_layout.addWidget(self.delete_btn)

        self.report_btn = QPushButton("Monthly Report")
        self.report_btn.clicked.connect(self._show_monthly_report)
        button_layout.addWidget(self.report_btn)

        layout.addLayout(button_layout)

    def _build_category_tab(self, layout):
        # Category Table
        self.category_table = QTableWidget()
        self.category_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.category_table.setSelectionMode(QTableWidget.SingleSelection)
        self.category_table.clicked.connect(self._on_category_table_clicked)
        layout.addWidget(self.category_table, stretch=1)

        # Category Buttons
        button_layout = QHBoxLayout()

        self.add_cat_btn = QPushButton("New Category")
        self.add_cat_btn.clicked.connect(self._on_add_category)
        button_layout.addWidget(self.add_cat_btn)

        self.edit_cat_btn = QPushButton("Edit Category")
        self.edit_cat_btn.clicked.connect(self._on_edit_category)
        self.edit_cat_btn.setEnabled(False)
        button_layout.addWidget(self.edit_cat_btn)

        self.delete_cat_btn = QPushButton("Delete Category")
        self.delete_cat_btn.clicked.connect(self._on_delete_category)
        self.delete_cat_btn.setEnabled(False)
        button_layout.addWidget(self.delete_cat_btn)

        layout.addLayout(button_layout)

    def _populate_categories(self, categories):
        """Populate categories from cached data."""
        self._categories = categories

        # Update category filter
        self.category_filter.clear()
        self.category_filter.addItem("All Categories", None)
        for cat in categories:
            self.category_filter.addItem(cat.name, cat.id)

        # Update category table
        self.category_table.setRowCount(len(categories))
        self.category_table.setColumnCount(3)
        self.category_table.setHorizontalHeaderLabels(["Name", "Account", "Status"])

        for row, cat in enumerate(categories):
            self.category_table.setItem(row, 0, QTableWidgetItem(cat.name))
            self.category_table.setItem(row, 1, QTableWidgetItem(str(cat.account_id or "-")))
            self.category_table.setItem(row, 2, QTableWidgetItem("Active" if cat.is_active else "Inactive"))

        self.category_table.resizeColumnsToContents()
        
        # Clear selection state
        self._selected_category_id = None
        self.edit_cat_btn.setEnabled(False)
        self.delete_cat_btn.setEnabled(False)
    
    def _populate_expenses(self, expenses):
        """Populate expenses table from cached data."""
        self.table.setRowCount(len(expenses))
        self.table.setColumnCount(6)
        self.table.setHorizontalHeaderLabels([
            "Voucher #", "Date", "Category", "Amount", "Payment", "Description"
        ])

        for row, exp in enumerate(expenses):
            self.table.setItem(row, 0, QTableWidgetItem(exp["voucher_number"]))
            self.table.setItem(row, 1, QTableWidgetItem(exp["expense_date"]))
            self.table.setItem(row, 2, QTableWidgetItem(exp["category_name"]))
            self.table.setItem(row, 3, QTableWidgetItem(f"{exp['amount']:,.2f}"))
            self.table.setItem(row, 4, QTableWidgetItem(exp["payment_method"]))
            self.table.setItem(row, 5, QTableWidgetItem(exp.get("description", "") or "-"))

        self.table.resizeColumnsToContents()
        self._selected_expense_id = None
        self.delete_btn.setEnabled(False)

    def _on_category_table_clicked(self, index):
        """Handle category table click - enable edit/delete buttons."""
        row = index.row()
        if row < 0:
            return
        
        name_item = self.category_table.item(row, 0)
        if not name_item:
            return
        
        # Find the category
        category = next((c for c in self._categories if c.name == name_item.text()), None)
        if category:
            self.edit_cat_btn.setEnabled(True)
            self.delete_cat_btn.setEnabled(True)
            self._selected_category_id = category.id
        else:
            self.edit_cat_btn.setEnabled(False)
            self.delete_cat_btn.setEnabled(False)

    def _on_table_clicked(self, index):
        row = index.row()
        voucher_item = self.table.item(row, 0)
        if not voucher_item:
            return

        # Find the expense by voucher number
        expenses, _ = self.controller.list_expenses()
        expense = next((e for e in expenses if e["voucher_number"] == voucher_item.text()), None)

        if expense:
            self._selected_expense_id = expense["id"]
            self.delete_btn.setEnabled(True)

    def _on_add_expense(self):
        # Create expense dialog
        dialog = QDialog(self)
        dialog.setWindowTitle("New Expense")
        dialog.setModal(True)
        dialog.resize(500, 400)

        layout = QVBoxLayout(dialog)

        form_group = QGroupBox("Expense Details")
        form_layout = QFormLayout(form_group)

        # Voucher Number
        voucher_input = QLineEdit()
        voucher_input.setPlaceholderText("e.g., EXP-2026-001")
        form_layout.addRow("Voucher Number*:", voucher_input)

        # Date
        date_input = QDateEdit()
        date_input.setDate(QDate.currentDate())
        date_input.setDisplayFormat("yyyy-MM-dd")
        form_layout.addRow("Date*:", date_input)

        # Category
        category_combo = QComboBox()
        for cat in self._categories:
            category_combo.addItem(cat.name, cat.id)
        form_layout.addRow("Category*:", category_combo)

        # Amount
        amount_input = QDoubleSpinBox()
        amount_input.setMinimum(0.01)
        amount_input.setMaximum(999999999.99)
        amount_input.setDecimals(2)
        amount_input.setPrefix("Rs. ")
        form_layout.addRow("Amount*:", amount_input)

        # Payment Method
        payment_combo = QComboBox()
        payment_combo.addItem("Cash", "CASH")
        payment_combo.addItem("Bank", "BANK")
        payment_combo.addItem("Cheque", "CHEQUE")
        form_layout.addRow("Payment Method*:", payment_combo)

        # Description
        desc_input = QLineEdit()
        desc_input.setPlaceholderText("Optional description")
        form_layout.addRow("Description:", desc_input)

        layout.addWidget(form_group)

        button_box = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel,
            Qt.Horizontal, dialog
        )
        button_box.accepted.connect(dialog.accept)
        button_box.rejected.connect(dialog.reject)
        layout.addWidget(button_box)

        if dialog.exec() == QDialog.Accepted:
            voucher = voucher_input.text().strip()
            if not voucher:
                QMessageBox.warning(self, "Input Error", "Voucher number is required.")
                return

            success, error = self.controller.create_expense(
                voucher_number=voucher,
                category_id=category_combo.currentData(),
                expense_date=date_input.date().toString("yyyy-MM-dd"),
                amount=amount_input.value(),
                payment_method=payment_combo.currentData(),
                description=desc_input.text().strip() or None,
            )

            if success:
                self._load_expenses()
                QMessageBox.information(self, "Success", "Expense created successfully!")
            else:
                QMessageBox.warning(self, "Creation Failed", error)

    def _on_delete_expense(self):
        if not self._selected_expense_id:
            return

        reply = QMessageBox.question(
            self,
            "Confirm Delete",
            "Are you sure you want to delete this expense?",
            QMessageBox.Yes | QMessageBox.No
        )

        if reply == QMessageBox.Yes:
            success, error = self.controller.delete_expense(self._selected_expense_id)
            if success:
                self._load_expenses()
                QMessageBox.information(self, "Success", "Expense deleted successfully!")
            else:
                QMessageBox.warning(self, "Delete Failed", error)

    def _show_monthly_report(self):
        # Get current month/year from filters
        date = self.date_from.date()
        year = date.year()
        month = date.month()

        print(f"📊 Monthly Report Request: {year}-{month}")  # DEBUG
        
        summary, error = self.controller.get_monthly_summary(year, month)
        
        print(f"📊 Summary: {summary}")  # DEBUG
        print(f"📊 Error: {error}")  # DEBUG
        
        if error:
            QMessageBox.warning(self, "Report Error", error)
            return

        # Check if we have data
        if not summary:
            QMessageBox.information(self, "No Data", "No data returned from service.")
            return
        
        if not summary.get("categories") or summary.get("total", 0) == 0:  # ← FIXED: safer check
            QMessageBox.information(self, "No Data", f"No expenses found for {summary.get('month', 'this month')}.")
            return

        # Show report in a dialog
        report_dialog = QDialog(self)
        report_dialog.setWindowTitle(f"Monthly Expense Report - {summary.get('month', f'{month:02d}/{year}')}")
        report_dialog.setModal(True)
        report_dialog.resize(500, 400)

        layout = QVBoxLayout(report_dialog)

        # Total
        total_label = QLabel(f"<h2>Total Expenses: Rs. {summary['total']:,.2f}</h2>")
        total_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(total_label)

        # Category breakdown
        table = QTableWidget()
        table.setRowCount(len(summary["categories"]))
        table.setColumnCount(3)
        table.setHorizontalHeaderLabels(["Category", "Amount", "Percentage"])

        for row, cat in enumerate(summary["categories"]):
            table.setItem(row, 0, QTableWidgetItem(cat["name"]))
            table.setItem(row, 1, QTableWidgetItem(f"Rs. {cat['amount']:,.2f}"))
            table.setItem(row, 2, QTableWidgetItem(f"{cat['percentage']:.1f}%"))

        table.resizeColumnsToContents()
        layout.addWidget(table)

        button_box = QDialogButtonBox(QDialogButtonBox.Ok)
        button_box.accepted.connect(report_dialog.accept)
        layout.addWidget(button_box)

        report_dialog.exec()

    def _on_add_category(self):
        dialog = CategoryDialog(self.account_controller, parent=self)
        if dialog.exec() == QDialog.Accepted:
            data = dialog.get_category_data()
            if not data["name"]:
                QMessageBox.warning(self, "Input Error", "Category name is required.")
                return

            success, error = self.controller.create_category(
                name=data["name"],
                account_id=data["account_id"],
            )

            if success:
                self._load_categories()
                QMessageBox.information(self, "Success", "Category created successfully!")
            else:
                QMessageBox.warning(self, "Creation Failed", error)

    def _on_edit_category(self):
        """Edit selected category."""
        if not self._selected_category_id:
            QMessageBox.warning(self, "Selection Error", "Please select a category to edit.")
            return

        # Get the category
        category = next((c for c in self._categories if c.id == self._selected_category_id), None)
        if not category:
            QMessageBox.warning(self, "Error", "Category not found.")
            return

        dialog = CategoryDialog(self.account_controller, category, self)
        if dialog.exec() == QDialog.Accepted:
            data = dialog.get_category_data()
            if not data["name"]:
                QMessageBox.warning(self, "Input Error", "Category name is required.")
                return

            success, error = self.controller.update_category(
                category_id=category.id,
                name=data["name"],
                account_id=data["account_id"],
                is_active=True,
            )

            if success:
                self._load_categories()
                QMessageBox.information(self, "Success", "Category updated successfully!")
            else:
                QMessageBox.warning(self, "Update Failed", error)

    def _on_delete_category(self):
        """Delete selected category."""
        if not self._selected_category_id:
            QMessageBox.warning(self, "Selection Error", "Please select a category to delete.")
            return

        # Get the category
        category = next((c for c in self._categories if c.id == self._selected_category_id), None)
        if not category:
            QMessageBox.warning(self, "Error", "Category not found.")
            return

        reply = QMessageBox.question(
            self,
            "Confirm Delete",
            f"Are you sure you want to deactivate category '{category.name}'?\n\nThis will soft-delete the category.",
            QMessageBox.Yes | QMessageBox.No
        )

        if reply == QMessageBox.Yes:
            success, error = self.controller.delete_category(category.id)
            if success:
                self._load_categories()
                self.edit_cat_btn.setEnabled(False)
                self.delete_cat_btn.setEnabled(False)
                self._selected_category_id = None
                QMessageBox.information(self, "Success", "Category deleted successfully!")
            else:
                QMessageBox.warning(self, "Delete Failed", error)