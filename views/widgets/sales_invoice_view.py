"""
Sales Invoice management widget - with Customer Search.
"""
from __future__ import annotations

from PySide6.QtCore import Qt, Signal, QDate, QThread, QTimer
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
)

from controllers.payment_controller import PaymentController
from controllers.sales_invoice_controller import SalesInvoiceController
from controllers.party_controller import PartyController
from controllers.item_controller import ItemController
from controllers.banking_controller import BankingController
from database.connection import get_db
from models.sales_invoice import SalesInvoice
from utils.logger import get_logger

logger = get_logger(__name__)


class InvoiceLoadThread(QThread):
    """Background thread for loading invoices."""
    
    data_loaded = Signal(list, str)  # invoices, error
    
    def __init__(self, controller, status=None):
        super().__init__()
        self.controller = controller
        self.status = status
    
    def run(self):
        try:
            invoices, error = self.controller.list_sales_invoices(status=self.status)
            self.data_loaded.emit(invoices or [], error or "")
        except Exception as e:
            logger.exception(f"Error in invoice load thread: {e}")
            self.data_loaded.emit([], str(e))


class CustomerLoadThread(QThread):
    """Background thread for loading customers."""
    
    data_loaded = Signal(list, str)  # customers, error
    
    def __init__(self, controller):
        super().__init__()
        self.controller = controller
    
    def run(self):
        try:
            parties, error = self.controller.list_parties(active_only=True)
            self.data_loaded.emit(parties or [], error or "")
        except Exception as e:
            logger.exception(f"Error in customer load thread: {e}")
            self.data_loaded.emit([], str(e))


class ItemLoadThread(QThread):
    """Background thread for loading items in dialog."""
    
    data_loaded = Signal(list, str)  # items, error
    
    def __init__(self, controller):
        super().__init__()
        self.controller = controller
    
    def run(self):
        try:
            items, error = self.controller.list_items(active_only=True)
            self.data_loaded.emit(items or [], error or "")
        except Exception as e:
            logger.exception(f"Error in item load thread: {e}")
            self.data_loaded.emit([], str(e))


class SalesItemSelectionDialog(QDialog):
    """Dialog for selecting an item with search."""
    
    def __init__(self, item_controller: ItemController, parent=None):
        super().__init__(parent)
        self.item_controller = item_controller
        self.all_items = []
        self.selected_item = None
        self.quantity = 1.0
        self.unit_price = 0.0
        self.discount_amount = 0.0
        self.tax_amount = 0.0
        self._item_load_thread = None
        self.setWindowTitle("Add Item to Invoice")
        self.setModal(True)
        self.resize(500, 450)
        self._setup_ui()
        self._load_items_async()

    def _setup_ui(self) -> None:
        layout = QVBoxLayout(self)
        
        # Search Bar
        search_layout = QHBoxLayout()
        search_label = QLabel("Search:")
        search_label.setStyleSheet("font-weight: bold;")
        search_layout.addWidget(search_label)
        
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Type to search items by name or code...")
        self.search_input.textChanged.connect(self._filter_items)
        search_layout.addWidget(self.search_input)
        layout.addLayout(search_layout)
        
        # Item selection
        item_group = QGroupBox("Item Selection")
        item_layout = QFormLayout(item_group)
        
        self.item_combo = QComboBox()
        self.item_combo.addItem("Select Item", None)
        self.item_combo.setEditable(True)
        self.item_combo.setInsertPolicy(QComboBox.NoInsert)
        item_layout.addRow("Item*:", self.item_combo)
        
        item_group.setLayout(item_layout)
        layout.addWidget(item_group)
        
        # Quantity and pricing
        pricing_group = QGroupBox("Quantity & Pricing")
        pricing_layout = QFormLayout(pricing_group)
        
        self.quantity_spin = QDoubleSpinBox()
        self.quantity_spin.setMinimum(0.01)
        self.quantity_spin.setMaximum(999999.99)
        self.quantity_spin.setValue(1.0)
        self.quantity_spin.setDecimals(2)
        pricing_layout.addRow("Quantity*:", self.quantity_spin)
        
        self.unit_price_spin = QDoubleSpinBox()
        self.unit_price_spin.setMinimum(0.0)
        self.unit_price_spin.setMaximum(999999.99)
        self.unit_price_spin.setValue(0.0)
        self.unit_price_spin.setDecimals(2)
        pricing_layout.addRow("Unit Price*:", self.unit_price_spin)
        
        self.discount_spin = QDoubleSpinBox()
        self.discount_spin.setMinimum(0.0)
        self.discount_spin.setMaximum(999999.99)
        self.discount_spin.setValue(0.0)
        self.discount_spin.setDecimals(2)
        pricing_layout.addRow("Discount Amount:", self.discount_spin)
        
        self.tax_spin = QDoubleSpinBox()
        self.tax_spin.setMinimum(0.0)
        self.tax_spin.setMaximum(999999.99)
        self.tax_spin.setValue(0.0)
        self.tax_spin.setDecimals(2)
        pricing_layout.addRow("Tax Amount:", self.tax_spin)
        
        pricing_group.setLayout(pricing_layout)
        layout.addWidget(pricing_group)
        
        button_box = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel,
            Qt.Horizontal, self
        )
        button_box.accepted.connect(self.accept)
        button_box.rejected.connect(self.reject)
        layout.addWidget(button_box)
        
        self.item_combo.currentIndexChanged.connect(self._on_item_selected)
        self.quantity_spin.valueChanged.connect(self._calculate_line_total)
        self.unit_price_spin.valueChanged.connect(self._calculate_line_total)
        self.discount_spin.valueChanged.connect(self._calculate_line_total)
        self.tax_spin.valueChanged.connect(self._calculate_line_total)
        
        self.line_total_label = QLabel("Line Total: 0.00")
        self.line_total_label.setStyleSheet("font-weight: bold; font-size: 12px; color: #2ecc71;")
        layout.addWidget(self.line_total_label)

    def _load_items_async(self) -> None:
        """Load items asynchronously using background thread."""
        if self._item_load_thread and self._item_load_thread.isRunning():
            self._item_load_thread.terminate()
        
        self._item_load_thread = ItemLoadThread(self.item_controller)
        self._item_load_thread.data_loaded.connect(self._on_items_loaded)
        self._item_load_thread.start()
    
    def _on_items_loaded(self, items, error):
        """Handle items loaded from background thread."""
        if error:
            logger.error(f"Error loading items in dialog: {error}")
            return
        
        self.all_items = items
        self._populate_combo(items)

    def _load_items(self) -> None:
        """Synchronous fallback (kept for compatibility)."""
        items, error = self.item_controller.list_items(active_only=True)
        if error:
            QMessageBox.warning(self, "Load Error", error)
            return
        self.all_items = items
        self._populate_combo(items)

    def _populate_combo(self, items: list) -> None:
        self.item_combo.clear()
        self.item_combo.addItem("Select Item", None)
        for item in items:
            display = f"{item.item_code} - {item.item_name} ({item.unit})"
            self.item_combo.addItem(display, item.id)

    def _filter_items(self, text: str) -> None:
        text = text.lower().strip()
        if not text:
            self._populate_combo(self.all_items)
            return
        filtered = []
        for item in self.all_items:
            if (text in item.item_code.lower() or 
                text in item.item_name.lower() or
                text in item.unit.lower()):
                filtered.append(item)
        self._populate_combo(filtered)
        if len(filtered) == 1:
            self.item_combo.setCurrentIndex(1)

    def _on_item_selected(self, index: int) -> None:
        item_id = self.item_combo.itemData(index)
        if item_id:
            item, error = self.item_controller.get_item(item_id)
            if error:
                QMessageBox.warning(self, "Load Error", error)
                self.selected_item = None
            else:
                self.selected_item = item
                if hasattr(item, 'selling_price') and item.selling_price > 0:
                    self.unit_price_spin.setValue(item.selling_price)
                self._calculate_line_total()
        else:
            self.selected_item = None
            self._calculate_line_total()

    def _calculate_line_total(self) -> None:
        quantity = self.quantity_spin.value()
        unit_price = self.unit_price_spin.value()
        discount = self.discount_spin.value()
        tax = self.tax_spin.value()
        line_total = (quantity * unit_price) - discount + tax
        self.line_total_label.setText(f"Line Total: {line_total:.2f}")

    def get_item_data(self) -> dict | None:
        if not self.selected_item:
            return None
        return {
            "item_id": self.selected_item.id,
            "item_name": self.selected_item.item_name,
            "item_code": self.selected_item.item_code,
            "quantity": self.quantity_spin.value(),
            "unit_price": self.unit_price_spin.value(),
            "discount_amount": self.discount_spin.value(),
            "tax_amount": self.tax_spin.value(),
            "line_total": (self.quantity_spin.value() * self.unit_price_spin.value()) 
                         - self.discount_spin.value() + self.tax_spin.value()
        }


class SalesInvoiceView(QWidget):
    """Widget for managing sales invoices with customer search."""
    
    invoice_created = Signal(SalesInvoice)
    invoice_updated = Signal(SalesInvoice)
    invoice_deleted = Signal(int)

    def __init__(self, 
                 sales_invoice_controller: SalesInvoiceController | None = None,
                 party_controller: PartyController | None = None,
                 item_controller: ItemController | None = None,
                 parent=None):
        super().__init__(parent)
        self.invoice_controller = sales_invoice_controller or SalesInvoiceController()
        self.party_controller = party_controller or PartyController()
        self.item_controller = item_controller or ItemController()
        self.banking_controller = BankingController()
        self.payment_controller = PaymentController()
        self._selected_invoice_id: int | None = None
        self._invoice_items: list[dict] = []
        self._all_customers = []  # Store all customers for filtering
        self._invoices_cache = []
        self._customers_cache = []
        self._invoice_load_thread = None
        self._customer_load_thread = None
        self._build_ui()
        # Don't load immediately - wait for showEvent

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setSpacing(10)

        # Search and filter controls
        controls_layout = QHBoxLayout()
        
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Search by invoice number or customer...")
        self.search_input.textChanged.connect(self._on_search_changed)
        controls_layout.addWidget(self.search_input, stretch=2)

        self.status_filter = QComboBox()
        self.status_filter.addItem("All Statuses", None)
        self.status_filter.addItem("Confirmed", "CONFIRMED")
        self.status_filter.addItem("Cancelled", "CANCELLED")
        self.status_filter.currentIndexChanged.connect(self._on_filter_changed)
        controls_layout.addWidget(self.status_filter)
        
        layout.addLayout(controls_layout)

        # Invoice table
        self.table = QTableWidget()
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.setSelectionMode(QTableWidget.SingleSelection)
        self.table.clicked.connect(self._on_table_clicked)
        layout.addWidget(self.table, stretch=1)

        # Form for add/edit
        form_group = QGroupBox("Sales Invoice Details")
        form_layout = QFormLayout(form_group)

        self.invoice_number_input = QLineEdit()
        self.invoice_number_input.setPlaceholderText("e.g., SI-2026-001")
        self.invoice_number_input.setReadOnly(True)
        form_layout.addRow("Invoice Number*:", self.invoice_number_input)

        # Customer with search
        customer_layout = QVBoxLayout()
        customer_layout.setSpacing(2)
        
        self.customer_search = QLineEdit()
        self.customer_search.setPlaceholderText("🔍 Search customers by name or code...")
        self.customer_search.textChanged.connect(self._filter_customers)
        customer_layout.addWidget(self.customer_search)
        
        self.customer_input = QComboBox()
        self.customer_input.addItem("Select Customer", None)
        customer_layout.addWidget(self.customer_input)
        
        form_layout.addRow("Customer*:", customer_layout)

        self.date_input = QDateEdit()
        self.date_input.setDate(QDate.currentDate())
        self.date_input.setDisplayFormat("yyyy-MM-dd")
        form_layout.addRow("Invoice Date*:", self.date_input)

        self.payment_type_input = QComboBox()
        self.payment_type_input.addItem("Cash", "CASH")
        self.payment_type_input.addItem("Bank", "BANK")
        self.payment_type_input.addItem("Cheque", "CHEQUE")
        self.payment_type_input.addItem("Credit", "CREDIT")
        self.payment_type_input.currentIndexChanged.connect(self._on_payment_type_changed)
        form_layout.addRow("Payment Type*:", self.payment_type_input)

        self.bank_account_input = QComboBox()
        self.bank_account_input.addItem("Select Bank Account", None)
        self.bank_account_input.setVisible(False)
        form_layout.addRow("Bank Account:", self.bank_account_input)

        self.notes_input = QLineEdit()
        self.notes_input.setPlaceholderText("Optional notes")
        form_layout.addRow("Notes:", self.notes_input)

        # Invoice Items Table
        items_group = QGroupBox("Invoice Items")
        items_layout = QVBoxLayout(items_group)
        
        self.items_table = QTableWidget()
        self.items_table.setColumnCount(6)
        self.items_table.setHorizontalHeaderLabels([
            "Item", "Quantity", "Unit Price", "Discount", "Tax", "Line Total"
        ])
        self.items_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.items_table.itemSelectionChanged.connect(self._update_remove_button_state)
        items_layout.addWidget(self.items_table)
        
        items_controls = QHBoxLayout()
        self.add_item_button = QPushButton("Add Item")
        self.add_item_button.clicked.connect(self._on_add_item_clicked)
        self.remove_item_button = QPushButton("Remove Item")
        self.remove_item_button.clicked.connect(self._on_remove_item_clicked)
        self.remove_item_button.setEnabled(False)
        items_controls.addWidget(self.add_item_button)
        items_controls.addWidget(self.remove_item_button)
        items_layout.addLayout(items_controls)
        
        form_layout.addRow(items_group)

        # Main buttons
        button_layout = QHBoxLayout()
        self.save_button = QPushButton("Save")
        self.save_button.clicked.connect(self._on_save_clicked)
        self.clear_button = QPushButton("Clear")
        self.clear_button.clicked.connect(self._on_clear_clicked)

        self.edit_button = QPushButton("Edit")
        self.edit_button.clicked.connect(self._on_edit_clicked)
        self.edit_button.setEnabled(False)

        self.delete_button = QPushButton("Delete")
        self.delete_button.clicked.connect(self._on_delete_clicked)
        self.delete_button.setEnabled(False)

        self.receive_button = QPushButton("Receive Payment")
        self.receive_button.clicked.connect(self._on_receive_payment)
        self.receive_button.setEnabled(False)
        self.receive_button.setStyleSheet("background: #2ecc71; color: white; font-weight: bold;")

        button_layout.addWidget(self.save_button)
        button_layout.addWidget(self.clear_button)
        button_layout.addWidget(self.edit_button)
        button_layout.addWidget(self.delete_button)
        button_layout.addWidget(self.receive_button)

        form_layout.addRow(button_layout)

        layout.addWidget(form_group)

    def showEvent(self, event):
        """Called when the widget is shown - lazy load data."""
        super().showEvent(event)
        if not hasattr(self, '_is_loaded') or not self._is_loaded:
            self._load_customers_async()
            self._load_invoices_async()
            self._clear_form()
            self._is_loaded = True
    
    def _load_invoices_async(self):
        """Load invoices asynchronously using background thread."""
        if self._invoice_load_thread and self._invoice_load_thread.isRunning():
            self._invoice_load_thread.terminate()
        
        self._invoice_load_thread = InvoiceLoadThread(
            self.invoice_controller, 
            status=self.status_filter.currentData()
        )
        self._invoice_load_thread.data_loaded.connect(self._on_invoices_loaded)
        self._invoice_load_thread.start()
    
    def _on_invoices_loaded(self, invoices, error):
        """Handle invoices loaded from background thread."""
        if error:
            QMessageBox.warning(self, "Load Error", error)
            return
        
        logger.info(f"Loaded {len(invoices)} invoices")
        self._invoices_cache = invoices
        self._populate_invoice_table()
    
    def _load_invoices(self):
        """Synchronous wrapper for backward compatibility."""
        self._load_invoices_async()
    
    def _populate_invoice_table(self):
        """Populate invoice table with cached data."""
        invoices = self._invoices_cache
        
        self.table.setRowCount(len(invoices))
        self.table.setColumnCount(7)
        self.table.setHorizontalHeaderLabels([
            "Invoice #", "Customer", "Date", "Total", "Paid", "Status", "Actions"
        ])
        
        for row, invoice in enumerate(invoices):
            self.table.setItem(row, 0, QTableWidgetItem(invoice.invoice_number))
            customer_name = "Unknown"
            for p in self._customers_cache:
                if p.id == invoice.customer_id:
                    customer_name = p.name
                    break
            self.table.setItem(row, 1, QTableWidgetItem(customer_name))
            self.table.setItem(row, 2, QTableWidgetItem(invoice.invoice_date))
            self.table.setItem(row, 3, QTableWidgetItem(f"{invoice.total_amount:.2f}"))
            self.table.setItem(row, 4, QTableWidgetItem(f"{invoice.paid_amount:.2f}"))
            self.table.setItem(row, 5, QTableWidgetItem(invoice.status))
            self.table.setItem(row, 6, QTableWidgetItem("View"))
        
        self.table.resizeColumnsToContents()
        self._selected_invoice_id = None
    
    def _load_customers_async(self):
        """Load customers asynchronously using background thread."""
        if self._customer_load_thread and self._customer_load_thread.isRunning():
            self._customer_load_thread.terminate()
        
        self._customer_load_thread = CustomerLoadThread(self.party_controller)
        self._customer_load_thread.data_loaded.connect(self._on_customers_loaded)
        self._customer_load_thread.start()
    
    def _load_customers(self):
        """Synchronous wrapper for backward compatibility."""
        self._load_customers_async()
    
    def _on_customers_loaded(self, parties, error):
        """Handle customers loaded from background thread."""
        if error:
            logger.error(f"Error loading customers: {error}")
            return
        
        logger.info(f"Loaded {len(parties)} customers")
        self._customers_cache = parties
        self._all_customers = parties
        self._populate_customer_dropdown()
    
    def _populate_customer_dropdown(self):
        """Populate customer dropdown with cached data."""
        self.customer_input.clear()
        self.customer_input.addItem("Select Customer", None)
        for party in self._customers_cache:
            if party.party_type in ["CUSTOMER", "BOTH"]:
                display = f"{party.name} ({party.code})"
                self.customer_input.addItem(display, party.id)

    def _filter_customers(self, text: str) -> None:
        text = text.lower().strip()
        current_data = self.customer_input.currentData()
        
        self.customer_input.clear()
        self.customer_input.addItem("Select Customer", None)
        
        for party in self._all_customers:
            if party.party_type in ["CUSTOMER", "BOTH"]:
                if not text or text in party.name.lower() or text in party.code.lower():
                    display = f"{party.name} ({party.code})"
                    self.customer_input.addItem(display, party.id)
        
        if current_data:
            idx = self.customer_input.findData(current_data)
            if idx >= 0:
                self.customer_input.setCurrentIndex(idx)

    def _load_bank_accounts(self) -> None:
        accounts, error = self.banking_controller.list_bank_accounts()
        if error:
            return
        self.bank_account_input.clear()
        self.bank_account_input.addItem("Select Bank Account", None)
        for acc in accounts:
            if acc.is_active:
                self.bank_account_input.addItem(
                    f"{acc.bank_name} - {acc.account_title} ({acc.account_number})",
                    acc.id
                )

    def _on_payment_type_changed(self, index: int) -> None:
        payment_type = self.payment_type_input.currentData()
        if payment_type in ["BANK", "CHEQUE"]:
            self.bank_account_input.setVisible(True)
            self._load_bank_accounts()
        else:
            self.bank_account_input.setVisible(False)
            self.bank_account_input.setCurrentIndex(0)

    def _on_search_changed(self, text: str) -> None:
        for row in range(self.table.rowCount()):
            matches = False
            for col in [0, 1]:
                item = self.table.item(row, col)
                if item and text.lower() in item.text().lower():
                    matches = True
                    break
            self.table.setRowHidden(row, not matches)

    def _on_filter_changed(self, index: int) -> None:
        self._load_invoices()

    def _on_table_clicked(self, index) -> None:
        row = index.row()
        invoice_number_item = self.table.item(row, 0)
        if not invoice_number_item:
            return
            
        invoices, _ = self.invoice_controller.list_sales_invoices(
            status=self.status_filter.currentData()
        )
        invoice_number = invoice_number_item.text()
        invoice = next((inv for inv in invoices if inv.invoice_number == invoice_number), None)
        
        if invoice:
            self._selected_invoice_id = invoice.id
            self.invoice_number_input.setText(invoice.invoice_number)
            
            idx = self.customer_input.findData(invoice.customer_id)
            if idx >= 0:
                self.customer_input.setCurrentIndex(idx)
            
            self.date_input.setDate(QDate.fromString(invoice.invoice_date, "yyyy-MM-dd"))
            
            idx = self.payment_type_input.findData(invoice.payment_type)
            if idx >= 0:
                self.payment_type_input.setCurrentIndex(idx)
            
            self.notes_input.setText(invoice.notes or "")
            self._load_invoice_items(invoice.id)
            
            self.save_button.setText("Update")
            self.edit_button.setEnabled(True)
            self.delete_button.setEnabled(True)
            
            remaining = invoice.total_amount - invoice.paid_amount
            is_credit = invoice.payment_type == "CREDIT"
            has_balance = remaining > 0.01
            is_active = invoice.status != "CANCELLED"
            
            self.receive_button.setEnabled(is_credit and has_balance and is_active)
            
            if not is_credit:
                self.receive_button.setToolTip("Only credit invoices can be paid")
            elif not has_balance:
                self.receive_button.setToolTip("This invoice is already fully paid")
            elif not is_active:
                self.receive_button.setToolTip("Cannot pay a cancelled invoice")
            else:
                self.receive_button.setToolTip(f"Receive remaining: Rs. {remaining:,.2f}")

    def _load_invoice_items(self, invoice_id: int) -> None:
        items = self.invoice_controller.service.item_repo.find_by_invoice_id(invoice_id)
        self._invoice_items = items
        
        self.items_table.setRowCount(len(items))
        for row, item in enumerate(items):
            display_name = f"{item.get('item_name', 'Unknown')} ({item.get('item_code', '')})"
            item_name_item = QTableWidgetItem(display_name)
            item_name_item.setData(Qt.UserRole, item.get("item_id"))
            self.items_table.setItem(row, 0, item_name_item)
            self.items_table.setItem(row, 1, QTableWidgetItem(f"{item.get('quantity', 0):.2f}"))
            self.items_table.setItem(row, 2, QTableWidgetItem(f"{item.get('unit_price', 0):.2f}"))
            self.items_table.setItem(row, 3, QTableWidgetItem(f"{item.get('discount_amount', 0):.2f}"))
            self.items_table.setItem(row, 4, QTableWidgetItem(f"{item.get('tax_amount', 0):.2f}"))
            self.items_table.setItem(row, 5, QTableWidgetItem(f"{item.get('line_total', 0):.2f}"))
        
        self.items_table.resizeColumnsToContents()

    def _on_add_item_clicked(self) -> None:
        dialog = SalesItemSelectionDialog(self.item_controller, self)
        if dialog.exec() == QDialog.Accepted:
            item_data = dialog.get_item_data()
            if item_data:
                self._invoice_items.append(item_data)
                self._update_items_table()
                self._update_remove_button_state()

    def _on_remove_item_clicked(self) -> None:
        selected_items = self.items_table.selectedItems()
        if not selected_items:
            return
        row = selected_items[0].row()
        if 0 <= row < len(self._invoice_items):
            del self._invoice_items[row]
            self._update_items_table()
            self._update_remove_button_state()

    def _on_save_clicked(self):
        invoice_number = self.invoice_number_input.text().strip()
        if not invoice_number:
            from database.connection import get_db
            from repositories.journal_repository import JournalRepository
            journal_repo = JournalRepository(get_db())
            invoice_number = journal_repo.next_voucher_number(1, "SALES_INVOICE")
            self.invoice_number_input.setText(invoice_number)
        
        customer_id = self.customer_input.currentData()
        if customer_id is None:
            QMessageBox.warning(self, "Input Error", "Please select a customer.")
            return
            
        invoice_date = self.date_input.date().toString("yyyy-MM-dd")
        payment_type = self.payment_type_input.currentData()
        if payment_type is None:
            QMessageBox.warning(self, "Input Error", "Please select a payment type.")
            return
        
        bank_account_id = None
        if payment_type in ["BANK", "CHEQUE"]:
            bank_account_id = self.bank_account_input.currentData()
            if bank_account_id is None:
                QMessageBox.warning(self, "Input Error", "Please select a bank account.")
                return
            
        notes = self.notes_input.text().strip() or None
        
        items = []
        for row in range(self.items_table.rowCount()):
            item_name_item = self.items_table.item(row, 0)
            quantity_item = self.items_table.item(row, 1)
            unit_price_item = self.items_table.item(row, 2)
            discount_item = self.items_table.item(row, 3)
            tax_item = self.items_table.item(row, 4)
            
            if not all([item_name_item, quantity_item, unit_price_item, discount_item, tax_item]):
                continue
                
            try:
                item_id = item_name_item.data(Qt.UserRole)
                items.append({
                    "item_id": item_id,
                    "quantity": float(quantity_item.text()),
                    "unit_price": float(unit_price_item.text()),
                    "discount_amount": float(discount_item.text()),
                    "tax_amount": float(tax_item.text()),
                })
            except (ValueError, AttributeError, TypeError):
                continue
        
        if not items:
            QMessageBox.warning(self, "Input Error", "Please add at least one item to the invoice.")
            return
        
        if self._selected_invoice_id is None:
            success, error = self.invoice_controller.create_sales_invoice(
                invoice_number=invoice_number,
                customer_id=customer_id,
                invoice_date=invoice_date,
                payment_type=payment_type,
                items=items,
                notes=notes,
                bank_account_id=bank_account_id,
            )
            if success:
                invoices, _ = self.invoice_controller.list_sales_invoices()
                created_invoice = next(
                    (inv for inv in invoices if inv.invoice_number == invoice_number), 
                    None
                )
                if created_invoice:
                    self.invoice_created.emit(created_invoice)
                self._load_invoices()
                self._clear_form()
            else:
                QMessageBox.warning(self, "Creation Failed", error)
        else:
            success, error = self.invoice_controller.update_sales_invoice(
                invoice_id=self._selected_invoice_id,
                invoice_number=invoice_number,
                customer_id=customer_id,
                invoice_date=invoice_date,
                payment_type=payment_type,
                items=items,
                notes=notes,
                status="CONFIRMED",
                bank_account_id=bank_account_id,
            )
            if success:
                invoices, _ = self.invoice_controller.list_sales_invoices()
                updated_invoice = next(
                    (inv for inv in invoices if inv.id == self._selected_invoice_id), 
                    None
                )
                if updated_invoice:
                    self.invoice_updated.emit(updated_invoice)
                self._load_invoices()
                self._clear_form()
            else:
                QMessageBox.warning(self, "Update Failed", error)

    def _on_edit_clicked(self) -> None:
        if self._selected_invoice_id is not None:
            items = self.table.selectedItems()
            if items:
                row = items[0].row()
                index = self.table.model().index(row, 0)
                self._on_table_clicked(index)

    def _on_delete_clicked(self) -> None:
        if self._selected_invoice_id is None:
            QMessageBox.warning(self, "Selection Error", "Please select an invoice to delete.")
            return

        reply = QMessageBox.question(
            self, 
            "Confirm Delete", 
            f"Are you sure you want to cancel invoice '{self.invoice_number_input.text()}'?\n\n"
            "This will reverse the accounting entry and mark the invoice as cancelled.",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )

        if reply == QMessageBox.Yes:
            success, error = self.invoice_controller.delete_sales_invoice(self._selected_invoice_id)
            if success:
                self.invoice_deleted.emit(self._selected_invoice_id)
                self._load_invoices()
                self._clear_form()
            else:
                QMessageBox.warning(self, "Delete Failed", error)

    def _on_clear_clicked(self) -> None:
        self._clear_form()

    def _clear_form(self):
        self.invoice_number_input.setText("")
        self.invoice_number_input.setPlaceholderText("Auto-generated on save")
        self.invoice_number_input.setReadOnly(True)
        
        self.customer_search.clear()
        self.customer_input.setCurrentIndex(0)
        self.date_input.setDate(QDate.currentDate())
        self.payment_type_input.setCurrentIndex(3)
        self.bank_account_input.setVisible(False)
        self.bank_account_input.setCurrentIndex(0)
        self.notes_input.clear()
        self.items_table.setRowCount(0)
        self._invoice_items = []
        self.save_button.setText("Save")
        self._selected_invoice_id = None
        self.edit_button.setEnabled(False)
        self.delete_button.setEnabled(False)
        self.receive_button.setEnabled(False)
        self.invoice_number_input.setFocus()

    def _update_items_table(self) -> None:
        self.items_table.setRowCount(len(self._invoice_items))
        for row, item in enumerate(self._invoice_items):
            item_name_item = QTableWidgetItem(item.get("item_name", ""))
            item_name_item.setData(Qt.UserRole, item.get("item_id"))
            self.items_table.setItem(row, 0, item_name_item)
            self.items_table.setItem(row, 1, QTableWidgetItem(f"{item.get('quantity', 0):.2f}"))
            self.items_table.setItem(row, 2, QTableWidgetItem(f"{item.get('unit_price', 0):.2f}"))
            self.items_table.setItem(row, 3, QTableWidgetItem(f"{item.get('discount_amount', 0):.2f}"))
            self.items_table.setItem(row, 4, QTableWidgetItem(f"{item.get('tax_amount', 0):.2f}"))
            self.items_table.setItem(row, 5, QTableWidgetItem(f"{item.get('line_total', 0):.2f}"))
        
        self.items_table.resizeColumnsToContents()
        self._update_remove_button_state()

    def _update_remove_button_state(self) -> None:
        has_selection = len(self.items_table.selectedItems()) > 0
        self.remove_item_button.setEnabled(has_selection)

    def _on_receive_payment(self):
        if not self._selected_invoice_id:
            QMessageBox.warning(self, "Selection Error", "Please select an invoice to receive payment.")
            return
        
        invoices, _ = self.invoice_controller.list_sales_invoices()
        invoice = next((inv for inv in invoices if inv.id == self._selected_invoice_id), None)
        if not invoice:
            QMessageBox.warning(self, "Error", "Invoice not found.")
            return
        
        if invoice.paid_amount >= invoice.total_amount:
            QMessageBox.information(self, "Already Paid", "This invoice is already fully paid.")
            return
        
        if invoice.status == "CANCELLED":
            QMessageBox.warning(self, "Error", "Cannot receive payment for a cancelled invoice.")
            return
        
        if invoice.payment_type != "CREDIT":
            QMessageBox.warning(self, "Error", "Only credit invoices can receive payments.")
            return
        
        remaining = invoice.total_amount - invoice.paid_amount
        customer_name = self._get_customer_name(invoice.customer_id)
        
        dialog = QDialog(self)
        dialog.setWindowTitle(f"Receive Payment - {invoice.invoice_number}")
        dialog.setModal(True)
        dialog.resize(450, 400)
        
        layout = QVBoxLayout(dialog)
        
        form_group = QGroupBox("Payment Details")
        form_layout = QFormLayout(form_group)
        
        info_label = QLabel(
            f"Invoice: {invoice.invoice_number}\n"
            f"Customer: {customer_name}\n"
            f"Total: Rs. {invoice.total_amount:,.2f}\n"
            f"Paid: Rs. {invoice.paid_amount:,.2f}\n"
            f"Remaining: Rs. {remaining:,.2f}"
        )
        info_label.setStyleSheet("background: #f8f9fa; padding: 10px; border-radius: 4px;")
        form_layout.addRow(info_label)
        
        amount_input = QDoubleSpinBox()
        amount_input.setMinimum(0.01)
        amount_input.setMaximum(remaining)
        amount_input.setValue(remaining)
        amount_input.setDecimals(2)
        amount_input.setPrefix("Rs. ")
        form_layout.addRow("Amount:", amount_input)
        
        method_combo = QComboBox()
        method_combo.addItem("Cash", "CASH")
        method_combo.addItem("Bank", "BANK")
        method_combo.addItem("Cheque", "CHEQUE")
        form_layout.addRow("Payment Method:", method_combo)
        
        date_input = QDateEdit()
        date_input.setDate(QDate.currentDate())
        date_input.setDisplayFormat("yyyy-MM-dd")
        form_layout.addRow("Date:", date_input)
        
        ref_input = QLineEdit()
        ref_input.setPlaceholderText("Optional reference")
        form_layout.addRow("Reference:", ref_input)
        
        notes_input = QLineEdit()
        notes_input.setPlaceholderText("Optional notes")
        form_layout.addRow("Notes:", notes_input)
        
        layout.addWidget(form_group)
        
        button_box = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel,
            Qt.Horizontal, dialog
        )
        button_box.accepted.connect(dialog.accept)
        button_box.rejected.connect(dialog.reject)
        layout.addWidget(button_box)
        
        if dialog.exec() == QDialog.Accepted:
            amount = amount_input.value()
            method = method_combo.currentData()
            date = date_input.date().toString("yyyy-MM-dd")
            reference = ref_input.text().strip() or invoice.invoice_number
            notes = notes_input.text().strip() or None
            
            success, error = self.payment_controller.receive_payment(
                customer_id=invoice.customer_id,
                amount=amount,
                payment_date=date,
                payment_method=method,
                reference_no=reference,
                notes=notes,
                sales_invoice_id=invoice.id,
            )
            
            if success:
                new_paid = invoice.paid_amount + amount
                self.invoice_controller.service.invoice_repo.update(
                    invoice.id,
                    {"paid_amount": new_paid}
                )
                QMessageBox.information(self, "Success", f"Payment of Rs. {amount:,.2f} received successfully!")
                self._load_invoices()
                self._clear_form()
            else:
                QMessageBox.warning(self, "Payment Failed", error)

    def _get_customer_name(self, customer_id: int) -> str:
        parties, _ = self.party_controller.list_parties(active_only=False)
        for p in parties:
            if p.id == customer_id:
                return p.name
        return "Unknown"