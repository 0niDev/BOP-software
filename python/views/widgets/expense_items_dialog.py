"""Dialog for managing and bulk-paying per-category expense items.

Lets the user maintain a list of recurring items under any expense category
(e.g. salary payees: Editor, Janitor; or bills: Electricity, Rent) and pay
any subset in one go -- one expense voucher per selected item.
"""
from __future__ import annotations

from PySide6.QtCore import Qt, QDate, QThread, Signal
from PySide6.QtWidgets import (
    QAbstractItemView,
    QAbstractSpinBox,
    QComboBox,
    QDateEdit,
    QDialog,
    QDoubleSpinBox,
    QFrame,
    QHBoxLayout,
    QLabel,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
)

from controllers.expense_item_controller import ExpenseItemController
from models.expense import ExpenseCategory
from utils.help_utils import create_help_button
from utils.logger import get_logger

logger = get_logger(__name__)

PAY_ITEMS_HELP = """
<h3>Pay Items</h3>
<p>Manage recurring items for a category and pay any of them at once.</p>
<ul>
    <li><b>Add Item</b> - add a person or bill (e.g. Editor, Electricity) to the category.</li>
    <li><b>Amount</b> - edit the amount before paying (leave for later if unsure).</li>
    <li>Tick the items to pay, choose a payment method and date, then <b>Pay Selected</b>.</li>
    <li>Each selected item becomes its own expense voucher (cash/bank posted automatically).</li>
</ul>
"""

COL_PAY = 0
COL_NAME = 1
COL_AMOUNT = 2
COL_NOTE = 3


class PayWorker(QThread):
    """Background thread that executes the bulk payment without freezing the UI."""

    finished = Signal(object, str)  # (vouchers_list_or_None, error_string)

    def __init__(self, controller, kwargs, parent=None):
        super().__init__(parent)
        self._controller = controller
        self._kwargs = kwargs

    def run(self):
        try:
            vouchers, error = self._controller.pay_items(**self._kwargs)
            self.finished.emit(vouchers, error or "")
        except Exception as exc:
            logger.exception("PayWorker error")
            self.finished.emit(None, str(exc))


class ExpenseItemsDialog(QDialog):
    """Manage + bulk-pay items for a single expense category."""

    items_paid = Signal()

    def __init__(
        self,
        categories: list[ExpenseCategory],
        default_category_id: int | None = None,
        company_id: int = 1,
        created_by: int | None = None,
        parent=None,
    ):
        super().__init__(parent)
        self.controller = ExpenseItemController()
        self.categories = categories
        self.company_id = company_id
        self.created_by = created_by
        self._default_category_id = default_category_id
        self._pay_worker: PayWorker | None = None
        self.setWindowTitle("Pay Items")
        self.setModal(True)
        self.resize(620, 520)
        self._build_ui()
        self._load_items()

    # ------------------------------------------------------------------
    # UI
    # ------------------------------------------------------------------

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(10)

        # Header
        header = QHBoxLayout()
        title = QLabel("Pay Items")
        title.setStyleSheet("font-size: 18px; font-weight: bold;")
        header.addWidget(title)
        header.addStretch()
        header.addWidget(create_help_button("Pay Items", PAY_ITEMS_HELP))
        layout.addLayout(header)

        # Category selector
        cat_row = QHBoxLayout()
        cat_row.addWidget(QLabel("Category:"))
        self.category_combo = QComboBox()
        for cat in self.categories:
            self.category_combo.addItem(cat.name, cat.id)
        if self._default_category_id is not None:
            idx = self.category_combo.findData(self._default_category_id)
            if idx >= 0:
                self.category_combo.setCurrentIndex(idx)
        self.category_combo.currentIndexChanged.connect(self._load_items)
        cat_row.addWidget(self.category_combo, 1)
        layout.addLayout(cat_row)

        # Items table
        frame = QFrame()
        frame.setObjectName("section-frame")
        frame_layout = QVBoxLayout(frame)
        frame_layout.setSpacing(8)

        self.table = QTableWidget()
        self.table.setColumnCount(4)
        self.table.setHorizontalHeaderLabels(["Pay", "Name", "Amount", "Note"])
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.setSelectionMode(QAbstractItemView.ExtendedSelection)
        self.table.setColumnWidth(COL_PAY, 44)
        self.table.setColumnWidth(COL_NAME, 150)
        self.table.setColumnWidth(COL_AMOUNT, 140)
        self.table.horizontalHeader().setStretchLastSection(True)
        frame_layout.addWidget(self.table)
        layout.addWidget(frame, 1)

        # Row action buttons
        row_btns = QHBoxLayout()
        self.add_item_btn = QPushButton("Add Item")
        self.add_item_btn.clicked.connect(self._on_add_item)
        self.delete_item_btn = QPushButton("Delete Selected")
        self.delete_item_btn.clicked.connect(self._on_delete_selected)
        row_btns.addWidget(self.add_item_btn)
        row_btns.addWidget(self.delete_item_btn)
        row_btns.addStretch()
        layout.addLayout(row_btns)

        # Payment controls
        pay_row = QHBoxLayout()
        pay_row.addWidget(QLabel("Payment:"))
        self.method_combo = QComboBox()
        self.method_combo.addItem("Cash", "CASH")
        self.method_combo.addItem("Bank", "BANK")
        self.method_combo.addItem("Cheque", "CHEQUE")
        pay_row.addWidget(self.method_combo)

        pay_row.addWidget(QLabel("Date:"))
        self.date_edit = QDateEdit()
        self.date_edit.setDate(QDate.currentDate())
        self.date_edit.setDisplayFormat("yyyy-MM-dd")
        pay_row.addWidget(self.date_edit)
        pay_row.addStretch()

        self.pay_btn = QPushButton("Pay Selected")
        self.pay_btn.setObjectName("primary")
        self.pay_btn.clicked.connect(self._on_pay_selected)
        pay_row.addWidget(self.pay_btn)

        self.close_btn = QPushButton("Close")
        self.close_btn.clicked.connect(self.reject)
        pay_row.addWidget(self.close_btn)
        layout.addLayout(pay_row)

    # ------------------------------------------------------------------
    # Data
    # ------------------------------------------------------------------

    def _current_category_id(self) -> int | None:
        return self.category_combo.currentData()

    def _load_items(self):
        category_id = self._current_category_id()
        self.table.setRowCount(0)
        if category_id is None:
            return
        items, error = self.controller.list_items(category_id)
        if error:
            QMessageBox.warning(self, "Error", error)
            return
        for item in items:
            self._add_item_row(
                item_id=item.id,
                name=item.name,
                amount=0.0,
                note="",
                checked=True,
            )

    def _add_item_row(self, item_id=None, name="", amount=0.0, note="", checked=True):
        row = self.table.rowCount()
        self.table.insertRow(row)

        pay_item = QTableWidgetItem()
        pay_item.setFlags(Qt.ItemIsEnabled | Qt.ItemIsUserCheckable)
        pay_item.setCheckState(Qt.Checked if checked else Qt.Unchecked)
        pay_item.setData(Qt.UserRole, item_id)
        pay_item.setData(Qt.UserRole + 1, name)   # original name for dirty check
        pay_item.setData(Qt.UserRole + 2, amount)  # original amount for dirty check
        self.table.setItem(row, COL_PAY, pay_item)

        name_item = QTableWidgetItem(name)
        self.table.setItem(row, COL_NAME, name_item)

        amount_spin = QDoubleSpinBox()
        amount_spin.setButtonSymbols(QAbstractSpinBox.NoButtons)
        amount_spin.setRange(0, 999999999.99)
        amount_spin.setDecimals(2)
        amount_spin.setPrefix("Rs. ")
        amount_spin.setMinimumWidth(140)
        amount_spin.setValue(float(amount))
        self.table.setCellWidget(row, COL_AMOUNT, amount_spin)

        note_item = QTableWidgetItem(note)
        self.table.setItem(row, COL_NOTE, note_item)

    def _on_add_item(self):
        self._add_item_row(checked=True)
        # Focus the new row's name cell for quick typing
        row = self.table.rowCount() - 1
        if row >= 0:
            self.table.setCurrentCell(row, COL_NAME)
            self.table.editItem(self.table.item(row, COL_NAME))

    def _on_delete_selected(self):
        rows = sorted(
            {i.row() for i in self.table.selectionModel().selectedRows()}, reverse=True
        )
        if not rows:
            QMessageBox.information(self, "Delete", "Select a row to delete first.")
            return
        for row in rows:
            pay_item = self.table.item(row, COL_PAY)
            item_id = pay_item.data(Qt.UserRole) if pay_item else None
            if item_id is not None:
                self.controller.delete_item(item_id)
            self.table.removeRow(row)

    # ------------------------------------------------------------------
    # Pay
    # ------------------------------------------------------------------

    def _on_pay_selected(self):
        category_id = self._current_category_id()
        if category_id is None:
            QMessageBox.warning(self, "Error", "Select a category first.")
            return

        selections: list[dict] = []
        skipped_zero: list[str] = []
        for row in range(self.table.rowCount()):
            pay_item = self.table.item(row, COL_PAY)
            if not pay_item or pay_item.checkState() != Qt.Checked:
                continue
            name = (self.table.item(row, COL_NAME).text() if self.table.item(row, COL_NAME) else "").strip()
            spin = self.table.cellWidget(row, COL_AMOUNT)
            amount = float(spin.value()) if spin else 0.0
            note = (self.table.item(row, COL_NOTE).text() if self.table.item(row, COL_NOTE) else "").strip()

            if amount <= 0:
                if name:
                    skipped_zero.append(name)
                continue
            if not name:
                QMessageBox.warning(self, "Input Error", "Each paid item needs a name.")
                return

            item_id = pay_item.data(Qt.UserRole)
            if item_id is None:
                created, error = self.controller.create_item(category_id, name, amount)
                if error:
                    QMessageBox.warning(self, "Error", f"Could not add '{name}': {error}")
                    return
                item_id = created.id
            else:
                orig_name = pay_item.data(Qt.UserRole + 1) or ""
                orig_amount = float(pay_item.data(Qt.UserRole + 2) or 0.0)
                if name != orig_name:
                    self.controller.update_item(item_id, name=name)
                # Amount persistence handled by pay_items service — no extra write needed

            selections.append(
                {"item_id": item_id, "amount": amount, "description": note or name}
            )

        if skipped_zero:
            QMessageBox.information(
                self,
                "Skipped",
                "Skipped items with zero amount: " + ", ".join(skipped_zero),
            )

        if not selections:
            QMessageBox.warning(
                self, "Nothing to pay", "Tick at least one item with an amount greater than 0."
            )
            return

        # Disable controls while processing
        self.pay_btn.setEnabled(False)
        self.close_btn.setEnabled(False)

        # Show loading overlay on MainWindow
        main_window = self._find_main_window()
        if main_window:
            main_window.show_loading_overlay("Processing payments...")

        # Run payment in background thread
        pay_kwargs = dict(
            company_id=self.company_id,
            category_id=category_id,
            selections=selections,
            payment_method=self.method_combo.currentData(),
            expense_date=self.date_edit.date().toString("yyyy-MM-dd"),
            created_by=self.created_by,
        )
        self._pay_worker = PayWorker(self.controller, pay_kwargs)
        self._pay_worker.finished.connect(self._on_pay_result)
        self._pay_worker.start()

    # ------------------------------------------------------------------
    # Async result handlers
    # ------------------------------------------------------------------

    def _on_pay_result(self, vouchers, error):
        """Handle payment result from background thread (runs on main thread)."""
        main_window = self._find_main_window()
        if main_window:
            main_window.hide_loading_overlay()

        self.pay_btn.setEnabled(True)
        self.close_btn.setEnabled(True)
        self._pay_worker = None

        if error:
            QMessageBox.critical(self, "Payment Failed", error)
            return

        QMessageBox.information(
            self,
            "Payment Successful",
            f"Paid {len(vouchers)} item(s).\nVouchers: {', '.join(vouchers)}",
        )
        self.items_paid.emit()
        self.accept()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _find_main_window(self):
        """Walk up the parent chain to find the MainWindow instance."""
        widget = self.parent()
        while widget is not None:
            from views.main_window import MainWindow
            if isinstance(widget, MainWindow):
                return widget
            widget = widget.parent() if hasattr(widget, "parent") else None
        return None
