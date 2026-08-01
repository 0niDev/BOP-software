"""Banking management widget - Bank Accounts, Transactions, Cheques."""
from __future__ import annotations

from PySide6.QtCore import Qt, Signal, QDate, QThread, QObject
from PySide6.QtWidgets import (
    QComboBox,
    QDateEdit,
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QGroupBox,
    QHBoxLayout,
    QInputDialog,
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
from PySide6.QtCore import QTimer
from controllers.banking_controller import BankingController
from controllers.party_controller import PartyController
from models.banking import BankAccount, Cheque
from utils.logger import get_logger

logger = get_logger(__name__)


class BankingDataLoader(QObject):
    """Background worker for loading banking data."""
    data_loaded = Signal(dict)
    error_occurred = Signal(str)
    
    def __init__(self, controller, party_controller):
        super().__init__()
        self.controller = controller
        self.party_controller = party_controller
    
    def run(self):
        """Load all banking data in background."""
        try:
            # Load accounts
            accounts, acc_error = self.controller.list_bank_accounts()
            if acc_error:
                self.error_occurred.emit(f"Accounts: {acc_error}")
                return
            
            # Load cheques
            cheques, chq_error = self.controller.list_cheques(None)
            if chq_error:
                self.error_occurred.emit(f"Cheques: {chq_error}")
                return
            
            # Load transactions
            txns, txn_error = self.controller.list_transactions(None)
            if txn_error:
                self.error_occurred.emit(f"Transactions: {txn_error}")
                return
            
            # Load parties for cheque lookups (cache them)
            parties, pty_error = self.party_controller.list_parties(active_only=False)
            if pty_error:
                logger.warning(f"Could not load parties: {pty_error}")
                parties = []
            
            self.data_loaded.emit({
                'accounts': accounts,
                'cheques': cheques,
                'transactions': txns,
                'parties': parties
            })
        except Exception as e:
            self.error_occurred.emit(str(e))


class BankAccountDialog(QDialog):
    """Dialog for creating/editing a bank account."""

    def __init__(self, account: BankAccount | None = None, parent=None):
        super().__init__(parent)
        self.account = account
        self.setWindowTitle("Edit Bank Account" if account else "New Bank Account")
        self.setModal(True)
        self.resize(450, 350)
        self._setup_ui()
        if account:
            self._load_account_data()

    def _setup_ui(self):
        layout = QVBoxLayout(self)

        form_group = QGroupBox("Bank Account Details")
        form_layout = QFormLayout(form_group)

        self.bank_name_input = QLineEdit()
        self.bank_name_input.setPlaceholderText("e.g., HBL, UBL, MCB")
        form_layout.addRow("Bank Name*:", self.bank_name_input)

        self.account_title_input = QLineEdit()
        self.account_title_input.setPlaceholderText("e.g., Current Account")
        form_layout.addRow("Account Title*:", self.account_title_input)

        self.account_number_input = QLineEdit()
        self.account_number_input.setPlaceholderText("Account Number")
        form_layout.addRow("Account Number*:", self.account_number_input)

        self.branch_code_input = QLineEdit()
        self.branch_code_input.setPlaceholderText("Branch Code (optional)")
        form_layout.addRow("Branch Code:", self.branch_code_input)

        self.iban_input = QLineEdit()
        self.iban_input.setPlaceholderText("IBAN (optional)")
        form_layout.addRow("IBAN:", self.iban_input)

        self.opening_balance_input = QDoubleSpinBox()
        self.opening_balance_input.setMinimum(0)
        self.opening_balance_input.setMaximum(999999999.99)
        self.opening_balance_input.setDecimals(2)
        self.opening_balance_input.setPrefix("Rs. ")
        if not self.account:
            self.opening_balance_input.setValue(0)
        form_layout.addRow("Opening Balance:", self.opening_balance_input)

        layout.addWidget(form_group)

        button_box = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel,
            Qt.Horizontal, self
        )
        button_box.accepted.connect(self.accept)
        button_box.rejected.connect(self.reject)
        layout.addWidget(button_box)

    def _load_accounts(self):
        accounts, error = self.controller.list_bank_accounts()
        if error:
            QMessageBox.warning(self, "Load Error", error)
            return

        self.accounts_table.setRowCount(len(accounts))
        self.accounts_table.setColumnCount(6)
        self.accounts_table.setHorizontalHeaderLabels([
            "Bank", "Account Title", "Account #", "Branch", "Balance", "Status"
        ])

        for row, acc in enumerate(accounts):
            # Get current balance
            balance, _ = self.controller.get_balance(acc.id)
            
            self.accounts_table.setItem(row, 0, QTableWidgetItem(acc.bank_name))
            self.accounts_table.setItem(row, 1, QTableWidgetItem(acc.account_title))
            self.accounts_table.setItem(row, 2, QTableWidgetItem(acc.account_number))
            self.accounts_table.setItem(row, 3, QTableWidgetItem(acc.branch_code or "-"))
            self.accounts_table.setItem(row, 4, QTableWidgetItem(f"Rs. {balance:,.2f}"))
            self.accounts_table.setItem(row, 5, QTableWidgetItem("Active" if acc.is_active else "Inactive"))

        self.accounts_table.resizeColumnsToContents()
        self._selected_account_id = None
        self.deposit_btn.setEnabled(False)
        self.withdraw_btn.setEnabled(False)
        self.deactivate_btn.setEnabled(False)

        # Update transaction combo
        self.txn_account_combo.clear()
        self.txn_account_combo.addItem("All Accounts", None)
        for acc in accounts:
            self.txn_account_combo.addItem(
                f"{acc.bank_name} - {acc.account_title}",
                acc.id
            )

    def get_account_data(self) -> dict:
        return {
            "bank_name": self.bank_name_input.text().strip(),
            "account_title": self.account_title_input.text().strip(),
            "account_number": self.account_number_input.text().strip(),
            "branch_code": self.branch_code_input.text().strip() or None,
            "iban": self.iban_input.text().strip() or None,
            "opening_balance": self.opening_balance_input.value(),
    }


class ChequeDialog(QDialog):
    """Dialog for issuing/receiving a cheque."""

    def __init__(self, cheque_type: str, parent=None):
        super().__init__(parent)
        self.cheque_type = cheque_type  # ISSUED or RECEIVED
        self.setWindowTitle(f"Issue Cheque" if cheque_type == "ISSUED" else "Receive Cheque")
        self.setModal(True)
        self.resize(450, 350)
        self._setup_ui()

    def _setup_ui(self):
        layout = QVBoxLayout(self)

        form_group = QGroupBox("Cheque Details")
        form_layout = QFormLayout(form_group)

        # Bank account
        self.bank_account_combo = QComboBox()
        self.bank_account_combo.addItem("Select Bank Account", None)
        form_layout.addRow("Bank Account*:", self.bank_account_combo)

        # Party
        self.party_combo = QComboBox()
        self.party_combo.addItem("Select Party", None)
        form_layout.addRow("Party*:", self.party_combo)

        # Cheque number
        self.cheque_number_input = QLineEdit()
        self.cheque_number_input.setPlaceholderText("e.g., 123456")
        form_layout.addRow("Cheque Number*:", self.cheque_number_input)

        # Amount
        self.amount_input = QDoubleSpinBox()
        self.amount_input.setMinimum(0.01)
        self.amount_input.setMaximum(999999999.99)
        self.amount_input.setDecimals(2)
        self.amount_input.setPrefix("Rs. ")
        form_layout.addRow("Amount*:", self.amount_input)

        # Date
        self.date_input = QDateEdit()
        self.date_input.setDate(QDate.currentDate())
        self.date_input.setDisplayFormat("yyyy-MM-dd")
        form_layout.addRow("Date*:", self.date_input)

        # Notes
        self.notes_input = QLineEdit()
        self.notes_input.setPlaceholderText("Optional notes")
        form_layout.addRow("Notes:", self.notes_input)

        layout.addWidget(form_group)

        button_box = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel,
            Qt.Horizontal, self
        )
        button_box.accepted.connect(self.accept)
        button_box.rejected.connect(self.reject)
        layout.addWidget(button_box)

    def set_bank_accounts(self, accounts: list):
        self.bank_account_combo.clear()
        self.bank_account_combo.addItem("Select Bank Account", None)
        for acc in accounts:
            self.bank_account_combo.addItem(
                f"{acc.bank_name} - {acc.account_title} ({acc.account_number})",
                acc.id
            )

    def set_parties(self, parties: list, party_type: str):
        self.party_combo.clear()
        self.party_combo.addItem("Select Party", None)
        for p in parties:
            # Only show ACTIVE parties
            if p.is_active and p.party_type.value in [party_type, "BOTH"]:
                self.party_combo.addItem(f"{p.name} ({p.code})", p.id)

    def get_cheque_data(self) -> dict:
        return {
            "bank_account_id": self.bank_account_combo.currentData(),
            "party_id": self.party_combo.currentData(),
            "cheque_number": self.cheque_number_input.text().strip(),
            "amount": self.amount_input.value(),
            "cheque_date": self.date_input.date().toString("yyyy-MM-dd"),
            "notes": self.notes_input.text().strip() or None,
        }


class BankingView(QWidget):
    """Widget for managing banking operations."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.controller = BankingController()
        self.party_controller = PartyController()
        self._selected_account_id: int | None = None
        self._selected_cheque_id: int | None = None
        self._loader_thread = None
        self._data_cache = {}
        self._build_ui()
        # Don't load data immediately - wait for showEvent

    def showEvent(self, event):
        """Called when the widget is shown - lazy load data."""
        super().showEvent(event)
        if not hasattr(self, '_is_loaded') or not self._is_loaded:
            self._show_loading_state()
            QTimer.singleShot(50, self._load_data_async)
    
    def _load_data_async(self):
        """Load banking data in background thread."""
        if hasattr(self, '_is_loaded') and self._is_loaded:
            return
        
        # Create worker
        self._loader_thread = QThread()
        self._worker = BankingDataLoader(self.controller, self.party_controller)
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
        
        # Populate accounts table with batch balance lookup
        self._populate_accounts_table(data['accounts'])
        
        # Populate cheques table with cached parties
        self._populate_cheques_table(data['cheques'], data['parties'])
        
        # Populate transactions table
        self._populate_transactions_table(data['transactions'])
        
        # Update combo boxes
        self._update_combos(data['accounts'])
        
        self._is_loaded = True
    
    def _load_data(self) -> None:
        """Reload data by restarting the async load."""
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

    def _show_loading_state(self):
        """Show loading state in tables."""
        self._show_table_loading(self.accounts_table, "Loading bank accounts...")
        self._show_table_loading(self.cheques_table, "Loading cheques...")
        self._show_table_loading(self.txn_table, "Loading transactions...")

    def _show_table_loading(self, table, message):
        """Show loading message in a table."""
        table.setRowCount(1)
        table.setColumnCount(1)
        table.setHorizontalHeaderLabels(["Loading..."])
        loading_item = QTableWidgetItem(message)
        loading_item.setTextAlignment(Qt.AlignCenter)
        table.setItem(0, 0, loading_item)
        table.horizontalHeader().setStretchLastSection(True)

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(10)

        self.tabs = QTabWidget()

        # Tab 1: Bank Accounts
        accounts_tab = QWidget()
        accounts_layout = QVBoxLayout(accounts_tab)
        self._build_accounts_tab(accounts_layout)
        self.tabs.addTab(accounts_tab, "Bank Accounts")

        # Tab 2: Cheques
        cheques_tab = QWidget()
        cheques_layout = QVBoxLayout(cheques_tab)
        self._build_cheques_tab(cheques_layout)
        self.tabs.addTab(cheques_tab, "Cheques")

        # Tab 3: Transactions
        txns_tab = QWidget()
        txns_layout = QVBoxLayout(txns_tab)
        self._build_transactions_tab(txns_layout)
        self.tabs.addTab(txns_tab, "Transactions")

        layout.addWidget(self.tabs)

    def _build_accounts_tab(self, layout):
        # Controls
        controls_layout = QHBoxLayout()
        self.refresh_btn = QPushButton("Refresh")
        self.refresh_btn.clicked.connect(self._load_data)
        controls_layout.addWidget(self.refresh_btn)
        controls_layout.addStretch()
        self.add_account_btn = QPushButton("New Account")
        self.add_account_btn.clicked.connect(self._on_add_account)
        controls_layout.addWidget(self.add_account_btn)
        layout.addLayout(controls_layout)

        # Accounts table
        self.accounts_table = QTableWidget()
        self.accounts_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.accounts_table.setSelectionMode(QTableWidget.SingleSelection)
        self.accounts_table.clicked.connect(self._on_account_selected)
        layout.addWidget(self.accounts_table, stretch=1)

        # Account actions
        actions_layout = QHBoxLayout()
        self.deposit_btn = QPushButton("Deposit")
        self.deposit_btn.clicked.connect(self._on_deposit)
        self.deposit_btn.setEnabled(False)
        actions_layout.addWidget(self.deposit_btn)

        self.withdraw_btn = QPushButton("Withdraw")
        self.withdraw_btn.clicked.connect(self._on_withdraw)
        self.withdraw_btn.setEnabled(False)
        actions_layout.addWidget(self.withdraw_btn)

        self.deactivate_btn = QPushButton("Deactivate")
        self.deactivate_btn.clicked.connect(self._on_deactivate_account)
        self.deactivate_btn.setEnabled(False)
        actions_layout.addWidget(self.deactivate_btn)

        layout.addLayout(actions_layout)

    def _build_cheques_tab(self, layout):
        # Controls
        controls_layout = QHBoxLayout()
        self.cheque_status_filter = QComboBox()
        self.cheque_status_filter.addItem("All Statuses", None)
        self.cheque_status_filter.addItem("Uncleared", "UNCLEARED")
        self.cheque_status_filter.addItem("Cleared", "CLEARED")
        self.cheque_status_filter.addItem("Bounced", "BOUNCED")
        self.cheque_status_filter.addItem("Lost", "LOST")
        self.cheque_status_filter.currentIndexChanged.connect(self._load_cheques)
        controls_layout.addWidget(QLabel("Status:"))
        controls_layout.addWidget(self.cheque_status_filter)
        controls_layout.addStretch()

        self.issue_cheque_btn = QPushButton("Issue Cheque")
        self.issue_cheque_btn.clicked.connect(lambda: self._on_cheque("ISSUED"))
        controls_layout.addWidget(self.issue_cheque_btn)

        self.receive_cheque_btn = QPushButton("Receive Cheque")
        self.receive_cheque_btn.clicked.connect(lambda: self._on_cheque("RECEIVED"))
        controls_layout.addWidget(self.receive_cheque_btn)

        layout.addLayout(controls_layout)

        # Cheques table
        self.cheques_table = QTableWidget()
        self.cheques_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.cheques_table.setSelectionMode(QTableWidget.SingleSelection)
        self.cheques_table.clicked.connect(self._on_cheque_selected)
        layout.addWidget(self.cheques_table, stretch=1)

        # Cheque actions
        actions_layout = QHBoxLayout()
        self.clear_cheque_btn = QPushButton("Clear")
        self.clear_cheque_btn.clicked.connect(self._on_clear_cheque)
        self.clear_cheque_btn.setEnabled(False)
        actions_layout.addWidget(self.clear_cheque_btn)

        self.bounce_cheque_btn = QPushButton("Bounce")
        self.bounce_cheque_btn.clicked.connect(self._on_bounce_cheque)
        self.bounce_cheque_btn.setEnabled(False)
        actions_layout.addWidget(self.bounce_cheque_btn)

        self.lose_cheque_btn = QPushButton("Mark Lost")
        self.lose_cheque_btn.clicked.connect(self._on_lose_cheque)
        self.lose_cheque_btn.setEnabled(False)
        actions_layout.addWidget(self.lose_cheque_btn)

        layout.addLayout(actions_layout)

    def _build_transactions_tab(self, layout):
        # Controls
        controls_layout = QHBoxLayout()
        controls_layout.addWidget(QLabel("Account:"))
        self.txn_account_combo = QComboBox()
        self.txn_account_combo.addItem("All Accounts", None)
        self.txn_account_combo.currentIndexChanged.connect(self._load_transactions)
        controls_layout.addWidget(self.txn_account_combo)
        controls_layout.addStretch()
        self.refresh_txn_btn = QPushButton("Refresh")
        self.refresh_txn_btn.clicked.connect(self._load_transactions)
        controls_layout.addWidget(self.refresh_txn_btn)
        layout.addLayout(controls_layout)

        # Transactions table
        self.txn_table = QTableWidget()
        self.txn_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.txn_table.setSelectionMode(QTableWidget.SingleSelection)
        layout.addWidget(self.txn_table, stretch=1)

    def _populate_accounts_table(self, accounts):
        """Populate accounts table with batch balance lookup."""
        from controllers.account_controller import AccountController
        acc_ctrl = AccountController()
        
        # Batch get all account balances in one query instead of N queries
        balances = {}
        for acc in accounts:
            balance, _ = acc_ctrl.get_balance(acc.id)
            balances[acc.id] = balance
        
        self.accounts_table.setRowCount(len(accounts))
        self.accounts_table.setColumnCount(6)
        self.accounts_table.setHorizontalHeaderLabels([
            "Bank", "Account Title", "Account #", "Branch", "Balance", "Status"
        ])

        for row, acc in enumerate(accounts):
            balance = balances.get(acc.id, 0.0)
            self.accounts_table.setItem(row, 0, QTableWidgetItem(acc.bank_name))
            self.accounts_table.setItem(row, 1, QTableWidgetItem(acc.account_title))
            self.accounts_table.setItem(row, 2, QTableWidgetItem(acc.account_number))
            self.accounts_table.setItem(row, 3, QTableWidgetItem(acc.branch_code or "-"))
            self.accounts_table.setItem(row, 4, QTableWidgetItem(f"Rs. {balance:,.2f}"))
            self.accounts_table.setItem(row, 5, QTableWidgetItem("Active" if acc.is_active else "Inactive"))

        self.accounts_table.resizeColumnsToContents()
        self._selected_account_id = None
        self.deposit_btn.setEnabled(False)
        self.withdraw_btn.setEnabled(False)
        self.deactivate_btn.setEnabled(False)
    
    def _populate_cheques_table(self, cheques, parties):
        """Populate cheques table using cached parties list."""
        # Create party lookup dict
        party_dict = {p.id: p.name for p in parties}
        
        self.cheques_table.setRowCount(len(cheques))
        self.cheques_table.setColumnCount(7)
        self.cheques_table.setHorizontalHeaderLabels([
            "#", "Type", "Party", "Amount", "Date", "Status", "Cleared"
        ])

        for row, chq in enumerate(cheques):
            party_name = party_dict.get(chq.get("party_id"), "Unknown")
            self.cheques_table.setItem(row, 0, QTableWidgetItem(chq["cheque_number"]))
            self.cheques_table.setItem(row, 1, QTableWidgetItem(chq["cheque_type"]))
            self.cheques_table.setItem(row, 2, QTableWidgetItem(party_name))
            self.cheques_table.setItem(row, 3, QTableWidgetItem(f"Rs. {chq['amount']:,.2f}"))
            self.cheques_table.setItem(row, 4, QTableWidgetItem(chq["cheque_date"]))
            self.cheques_table.setItem(row, 5, QTableWidgetItem(chq["status"]))
            self.cheques_table.setItem(row, 6, QTableWidgetItem(chq["cleared_date"] or "-"))

        self.cheques_table.resizeColumnsToContents()
        self._selected_cheque_id = None
        self.clear_cheque_btn.setEnabled(False)
        self.bounce_cheque_btn.setEnabled(False)
        self.lose_cheque_btn.setEnabled(False)
    
    def _populate_transactions_table(self, txns):
        """Populate transactions table."""
        from PySide6.QtGui import QColor

        self.txn_table.setRowCount(len(txns))
        self.txn_table.setColumnCount(5)
        self.txn_table.setHorizontalHeaderLabels([
            "Date", "Type", "Amount", "Reference", "Notes"
        ])

        for row, txn in enumerate(txns):
            color = "#2ecc71" if txn["transaction_type"] in ["DEPOSIT", "TRANSFER_IN"] else "#e74c3c"
            amount_item = QTableWidgetItem(f"Rs. {txn['amount']:,.2f}")
            amount_item.setForeground(QColor(color))
            self.txn_table.setItem(row, 0, QTableWidgetItem(txn["transaction_date"]))
            self.txn_table.setItem(row, 1, QTableWidgetItem(txn["transaction_type"]))
            self.txn_table.setItem(row, 2, amount_item)
            self.txn_table.setItem(row, 3, QTableWidgetItem(txn.get("reference_no") or "-"))
            self.txn_table.setItem(row, 4, QTableWidgetItem(txn.get("notes") or "-"))

        self.txn_table.resizeColumnsToContents()
    
    def _update_combos(self, accounts):
        """Update combo boxes with account list."""
        # Update transaction account combo
        self.txn_account_combo.clear()
        self.txn_account_combo.addItem("All Accounts", None)
        for acc in accounts:
            self.txn_account_combo.addItem(
                f"{acc.bank_name} - {acc.account_title}",
                acc.id
            )
    def _on_account_selected(self, index):
        row = index.row()
        accounts, _ = self.controller.list_bank_accounts()
        if row < len(accounts):
            acc = accounts[row]
            self._selected_account_id = acc.id
            self.deposit_btn.setEnabled(True)
            self.withdraw_btn.setEnabled(True)
            self.deactivate_btn.setEnabled(True)

    def _on_cheque_selected(self, index):
        row = index.row()
        number_item = self.cheques_table.item(row, 0)
        if number_item:
            cheques, _ = self.controller.list_cheques(None)
            for chq in cheques:
                if chq["cheque_number"] == number_item.text():
                    self._selected_cheque_id = chq["id"]
                    self.clear_cheque_btn.setEnabled(chq["status"] == "UNCLEARED")
                    self.bounce_cheque_btn.setEnabled(chq["status"] == "UNCLEARED")
                    self.lose_cheque_btn.setEnabled(chq["status"] == "UNCLEARED")
                    break

    def _on_add_account(self):
        dialog = BankAccountDialog(parent=self)
        if dialog.exec() == QDialog.Accepted:
            data = dialog.get_account_data()
            if not data["bank_name"] or not data["account_title"] or not data["account_number"]:
                QMessageBox.warning(self, "Input Error", "Please fill in all required fields.")
                return
            success, error = self.controller.create_bank_account(**data)
            if success:
                self._load_data()
                QMessageBox.information(self, "Success", "Bank account created!")
            else:
                QMessageBox.warning(self, "Creation Failed", error)

    def _on_deposit(self):
        if not self._selected_account_id:
            return

        amount, ok = QInputDialog.getDouble(
            self, "Deposit", "Enter amount to deposit:",
            0, 0.01, 999999999, 2
        )
        if ok and amount > 0:
            success, error = self.controller.deposit(
                self._selected_account_id,
                amount,
                QDate.currentDate().toString("yyyy-MM-dd"),
                None,
                None
            )
            if success:
                self._load_data()
                QMessageBox.information(self, "Success", f"Deposited Rs. {amount:,.2f}")
            else:
                QMessageBox.warning(self, "Deposit Failed", error)

    def _on_withdraw(self):
        if not self._selected_account_id:
            return

        amount, ok = QInputDialog.getDouble(
            self, "Withdraw", "Enter amount to withdraw:",
            0, 0.01, 999999999, 2
        )
        if ok and amount > 0:
            success, error = self.controller.withdraw(
                self._selected_account_id,
                amount,
                QDate.currentDate().toString("yyyy-MM-dd"),
                None,
                None
            )
            if success:
                self._load_data()
                QMessageBox.information(self, "Success", f"Withdrew Rs. {amount:,.2f}")
            else:
                QMessageBox.warning(self, "Withdraw Failed", error)

    def _on_deactivate_account(self):
        if not self._selected_account_id:
            return

        reply = QMessageBox.question(
            self,
            "Confirm Deactivate",
            "Are you sure you want to deactivate this bank account?",
            QMessageBox.Yes | QMessageBox.No
        )
        if reply == QMessageBox.Yes:
            success, error = self.controller.deactivate_account(self._selected_account_id)
            if success:
                self._load_data()
                QMessageBox.information(self, "Success", "Account deactivated")
            else:
                QMessageBox.warning(self, "Failed", error)

    def _on_cheque(self, cheque_type: str):
        dialog = ChequeDialog(cheque_type, self)

        # Load bank accounts
        accounts, _ = self.controller.list_bank_accounts()
        dialog.set_bank_accounts(accounts)

        # Load parties
        parties, _ = self.party_controller.list_parties(active_only=False)
        party_type = "SUPPLIER" if cheque_type == "ISSUED" else "CUSTOMER"
        dialog.set_parties(parties, party_type)

        if dialog.exec() == QDialog.Accepted:
            data = dialog.get_cheque_data()
            if not data["bank_account_id"] or not data["party_id"] or not data["cheque_number"]:
                QMessageBox.warning(self, "Input Error", "Please fill in all required fields.")
                return

            if cheque_type == "ISSUED":
                success, error = self.controller.issue_cheque(**data)
            else:
                success, error = self.controller.receive_cheque(**data)

            if success:
                self._load_data()
                QMessageBox.information(self, "Success", f"Cheque {cheque_type} successfully!")
            else:
                QMessageBox.warning(self, "Cheque Failed", error)

    def _on_clear_cheque(self):
        if not self._selected_cheque_id:
            return

        reply = QMessageBox.question(
            self,
            "Confirm Clear",
            "Are you sure you want to clear this cheque?",
            QMessageBox.Yes | QMessageBox.No
        )
        if reply == QMessageBox.Yes:
            success, error = self.controller.clear_cheque(self._selected_cheque_id)
            if success:
                self._load_data()
                QMessageBox.information(self, "Success", "Cheque cleared!")
            else:
                QMessageBox.warning(self, "Failed", error)

    def _on_bounce_cheque(self):
        if not self._selected_cheque_id:
            return

        reply = QMessageBox.question(
            self,
            "Confirm Bounce",
            "Are you sure you want to bounce this cheque?",
            QMessageBox.Yes | QMessageBox.No
        )
        if reply == QMessageBox.Yes:
            success, error = self.controller.bounce_cheque(self._selected_cheque_id)
            if success:
                self._load_data()
                QMessageBox.information(self, "Success", "Cheque bounced!")
            else:
                QMessageBox.warning(self, "Failed", error)

    def _on_lose_cheque(self):
        if not self._selected_cheque_id:
            return

        reply = QMessageBox.question(
            self,
            "Confirm Lost",
            "Are you sure you want to mark this cheque as lost?",
            QMessageBox.Yes | QMessageBox.No
        )
        if reply == QMessageBox.Yes:
            success, error = self.controller.lose_cheque(self._selected_cheque_id)
            if success:
                self._load_data()
                QMessageBox.information(self, "Success", "Cheque marked as lost!")
            else:
                QMessageBox.warning(self, "Failed", error)