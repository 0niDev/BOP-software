"""Chart of Accounts screen: list + create/edit accounts, live balances."""
from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QDoubleSpinBox,
    QFormLayout,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from views.widgets.opening_balance_dialog import OpeningBalanceDialog
from controllers.account_controller import AccountController
from models.account import Account
from models.enums import AccountType


class AccountDialog(QDialog):
    """Add/Edit dialog for a single account."""

    def __init__(self, accounts: list[Account], account: Account | None = None, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Edit Account" if account else "New Account")
        self.setMinimumWidth(380)
        self._existing = account
        self._all_accounts = accounts

        layout = QFormLayout(self)

        self.code_input = QLineEdit(account.account_code if account else "")
        self.code_input.setEnabled(account is None)  # code immutable after creation
        layout.addRow("Account Code*", self.code_input)

        self.name_input = QLineEdit(account.account_name if account else "")
        layout.addRow("Account Name*", self.name_input)

        self.type_combo = QComboBox()
        for t in AccountType:
            self.type_combo.addItem(t.label, t)
        if account:
            idx = self.type_combo.findData(account.account_type)
            self.type_combo.setCurrentIndex(max(idx, 0))
            self.type_combo.setEnabled(False)  # type immutable after creation
        layout.addRow("Account Type*", self.type_combo)

        self.parent_combo = QComboBox()
        self.parent_combo.addItem("(None - Top Level)", None)
        for acc in accounts:
            if account and acc.id == account.id:
                continue
            self.parent_combo.addItem(f"{acc.account_code} - {acc.account_name}", acc.id)
        if account and account.parent_account_id:
            idx = self.parent_combo.findData(account.parent_account_id)
            if idx >= 0:
                self.parent_combo.setCurrentIndex(idx)
        layout.addRow("Parent Account", self.parent_combo)

        self.opening_balance_input = QDoubleSpinBox()
        self.opening_balance_input.setRange(-1_000_000_000, 1_000_000_000)
        self.opening_balance_input.setDecimals(2)
        self.opening_balance_input.setValue(account.opening_balance if account else 0.0)
        layout.addRow("Opening Balance", self.opening_balance_input)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addRow(buttons)

    def values(self) -> dict:
        return {
            "account_code": self.code_input.text().strip(),
            "account_name": self.name_input.text().strip(),
            "account_type": self.type_combo.currentData(),
            "parent_account_id": self.parent_combo.currentData(),
            "opening_balance": self.opening_balance_input.value(),
        }


class ChartOfAccountsWidget(QWidget):
    COLUMNS = ["Code", "Name", "Type", "Parent", "Opening Balance", "Current Balance", "Status"]

    def __init__(self, controller: AccountController | None = None, parent=None):
        super().__init__(parent)
        self.controller = controller or AccountController()
        self._accounts: list[Account] = []
        self._build_ui()
        self.refresh()

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)

        header_row = QHBoxLayout()
        title = QLabel("Chart of Accounts")
        title.setStyleSheet("font-size: 16px; font-weight: bold;")
        header_row.addWidget(title)
        header_row.addStretch()

        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Search by code or name...")
        self.search_input.textChanged.connect(self._apply_filter)
        header_row.addWidget(self.search_input)

        # ← ADD OPENING BALANCE BUTTON
        opening_btn = QPushButton("💰 Opening Balance")
        opening_btn.clicked.connect(self._on_opening_balance)
        opening_btn.setStyleSheet("background: #3498db; color: white; font-weight: bold;")
        header_row.addWidget(opening_btn)

        add_btn = QPushButton("+ New Account")
        add_btn.clicked.connect(self._on_add)
        header_row.addWidget(add_btn)

        edit_btn = QPushButton("Edit")
        edit_btn.clicked.connect(self._on_edit)
        header_row.addWidget(edit_btn)

        deactivate_btn = QPushButton("Deactivate")
        deactivate_btn.clicked.connect(self._on_deactivate)
        header_row.addWidget(deactivate_btn)

        refresh_btn = QPushButton("Refresh")
        refresh_btn.clicked.connect(self.refresh)
        header_row.addWidget(refresh_btn)

        layout.addLayout(header_row)

        # ... rest of the code

        self.table = QTableWidget(0, len(self.COLUMNS))
        self.table.setHorizontalHeaderLabels(self.COLUMNS)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.setEditTriggers(QTableWidget.NoEditTriggers)
        layout.addWidget(self.table)

    def refresh(self) -> None:
        # Load accounts asynchronously to keep UI responsive
        from PySide6.QtCore import QThread, Signal
        
        class AccountLoader(QThread):
            finished = Signal(list, str)
            
            def __init__(self, controller):
                super().__init__()
                self.controller = controller
                
            def run(self):
                accounts, error = self.controller.list_accounts(active_only=False)
                self.finished.emit(accounts, error or "")
        
        # Disable UI during load
        self.table.setEnabled(False)
        self._loader = AccountLoader(self.controller)
        self._loader.finished.connect(self._on_load_complete)
        self._loader.start()
    
    def _on_load_complete(self, accounts, error):
        """Handle completed account load."""
        if error:
            from PySide6.QtWidgets import QMessageBox
            QMessageBox.warning(self, "Error", error)
            self.table.setEnabled(True)
            return
        
        self._accounts = sorted(accounts, key=lambda a: a.account_code)
        self._populate_table(self._accounts)
        self.table.setEnabled(True)

    def _populate_table(self, accounts: list[Account]) -> None:
        by_id = {a.id: a for a in self._accounts}
        self.table.setRowCount(len(accounts))
        for row, acc in enumerate(accounts):
            parent_label = ""
            if acc.parent_account_id and acc.parent_account_id in by_id:
                parent_label = by_id[acc.parent_account_id].account_code

            values = [
                acc.account_code,
                acc.account_name,
                acc.account_type.label,
                parent_label,
                f"{acc.opening_balance:,.2f}",
                f"{acc.current_balance:,.2f}",
                "Active" if acc.is_active else "Inactive",
            ]
            for col, value in enumerate(values):
                item = QTableWidgetItem(str(value))
                item.setData(Qt.UserRole, acc.id)
                if col in (4, 5):
                    item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
                self.table.setItem(row, col, item)

    def _apply_filter(self, text: str) -> None:
        text = text.strip().lower()
        if not text:
            self._populate_table(self._accounts)
            return
        filtered = [
            a for a in self._accounts
            if text in a.account_code.lower() or text in a.account_name.lower()
        ]
        self._populate_table(filtered)

    def _selected_account(self) -> Account | None:
        row = self.table.currentRow()
        if row < 0:
            return None
        account_id = self.table.item(row, 0).data(Qt.UserRole)
        return next((a for a in self._accounts if a.id == account_id), None)

    def _on_add(self) -> None:
        """Add new account."""
        dialog = AccountDialog(self._accounts, parent=self)
        if dialog.exec() != QDialog.Accepted:
            return
        values = dialog.values()
        
        # Get account_type as string from dialog
        account_type = values["account_type"]
        if hasattr(account_type, 'value'):
            account_type = account_type.value
        
        success, error = self.controller.create_account(
            account_code=values["account_code"],
            account_name=values["account_name"],
            account_type=account_type,  # Pass as string
            parent_account_id=values["parent_account_id"],
            opening_balance=values["opening_balance"],
        )
        if not success:
            QMessageBox.warning(self, "Could not create account", error)
            return
        self.refresh()


    def _on_edit(self) -> None:
        account = self._selected_account()
        if account is None:
            QMessageBox.information(self, "No selection", "Select an account to edit.")
            return
        dialog = AccountDialog(self._accounts, account=account, parent=self)
        if dialog.exec() != QDialog.Accepted:
            return
        values = dialog.values()
        success, error = self.controller.update_account(
            account_id=account.id,
            account_name=values["account_name"],
            opening_balance=values["opening_balance"],
            parent_account_id=values["parent_account_id"],
            is_active=account.is_active,
        )
        if not success:
            QMessageBox.warning(self, "Could not update account", error)
            return
        self.refresh()

    def _on_deactivate(self) -> None:
        account = self._selected_account()
        if account is None:
            QMessageBox.information(self, "No selection", "Select an account to deactivate.")
            return
        confirm = QMessageBox.question(
            self, "Confirm", f"Deactivate account '{account.account_name}'?"
        )
        if confirm != QMessageBox.Yes:
            return
        success, error = self.controller.deactivate_account(account.id)
        if not success:
            QMessageBox.warning(self, "Could not deactivate account", error)
            return
        self.refresh()
    def _on_opening_balance(self):
        """Open opening balance dialog."""
        dialog = OpeningBalanceDialog(self)
        dialog.exec()