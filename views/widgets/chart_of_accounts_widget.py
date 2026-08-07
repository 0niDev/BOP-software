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
from utils.logger import get_logger

logger = get_logger(__name__)


class AccountDialog(QDialog):
    """Add/Edit dialog for a single account."""

    def __init__(self, accounts: list[Account], account: Account | None = None, parent=None):
        super().__init__(parent)
        logger.debug(f"AccountDialog initialized with account={account.account_name if account else 'None'}, parent={parent}")
        self.setWindowTitle("Edit Account" if account else "New Account")
        self.setMinimumWidth(380)
        self._existing = account
        self._all_accounts = accounts
        logger.debug(f"AccountDialog: _existing={self._existing}, _all_accounts count={len(accounts)}")

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
        opening_val = account.opening_balance if account else 0.0
        logger.debug(f"AccountDialog: setting opening_balance_input to {opening_val} for account {account.account_name if account else 'new'}")
        self.opening_balance_input.setValue(opening_val)
        layout.addRow("Opening Balance", self.opening_balance_input)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addRow(buttons)

    def values(self) -> dict:
        vals = {
            "account_code": self.code_input.text().strip(),
            "account_name": self.name_input.text().strip(),
            "account_type": self.type_combo.currentData(),
            "parent_account_id": self.parent_combo.currentData(),
            "opening_balance": self.opening_balance_input.value(),
        }
        logger.debug(f"AccountDialog.values() returning: {vals}")
        return vals


class ChartOfAccountsWidget(QWidget):
    COLUMNS = ["Code", "Name", "Type", "Parent", "Opening Balance", "Current Balance", "Status"]

    def __init__(self, controller: AccountController | None = None, parent=None):
        super().__init__(parent)
        logger.debug("ChartOfAccountsWidget initializing...")
        self.controller = controller or AccountController()
        self._accounts: list[Account] = []
        self._build_ui()
        logger.debug("ChartOfAccountsWidget calling refresh()")
        self.refresh()

    def _build_ui(self) -> None:
        logger.debug("ChartOfAccountsWidget._build_ui() called")
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
        logger.debug("ChartOfAccountsWidget._build_ui() completed")

    def refresh(self) -> None:
        # Load accounts asynchronously to keep UI responsive
        logger.debug("ChartOfAccountsWidget.refresh() called")
        from PySide6.QtCore import QThread, Signal
        
        # Clean up any existing loader thread
        if hasattr(self, '_loader') and self._loader is not None:
            logger.debug("ChartOfAccountsWidget.refresh(): cleaning up existing loader thread")
            if self._loader.isRunning():
                logger.debug("ChartOfAccountsWidget.refresh(): waiting for existing loader to finish")
                self._loader.wait(1000)  # Wait up to 1 second for thread to finish
            self._loader.deleteLater()
            logger.debug("ChartOfAccountsWidget.refresh(): existing loader cleaned up")
        
        class AccountLoader(QThread):
            finished = Signal(list, str)
            
            def __init__(self, controller):
                super().__init__()
                self.controller = controller
                logger.debug("AccountLoader initialized")
                
            def run(self):
                logger.debug("AccountLoader.run() starting - calling controller.list_accounts()")
                accounts, error = self.controller.list_accounts(active_only=False)
                logger.debug(f"AccountLoader.run() completed - got {len(accounts)} accounts, error={error}")
                self.finished.emit(accounts, error or "")
        
        # Disable UI during load
        logger.debug("Disabling table during load")
        self.table.setEnabled(False)
        self._loader = AccountLoader(self.controller)
        self._loader.finished.connect(self._on_load_complete)
        self._loader.finished.connect(self._loader.deleteLater)  # Auto-cleanup when done
        self._loader.start()
        logger.debug("AccountLoader started")
    
    def _on_load_complete(self, accounts, error):
        """Handle completed account load."""
        logger.debug(f"_on_load_complete called with {len(accounts)} accounts, error={error}")
        if error:
            logger.error(f"_on_load_complete received error: {error}")
            from PySide6.QtWidgets import QMessageBox
            QMessageBox.warning(self, "Error", error)
            self.table.setEnabled(True)
            return
        
        self._accounts = sorted(accounts, key=lambda a: a.account_code)
        logger.debug(f"_on_load_complete: sorted {len(self._accounts)} accounts, calling _populate_table")
        self._populate_table(self._accounts)
        self.table.setEnabled(True)
        logger.debug("_on_load_complete completed")

    def _populate_table(self, accounts: list[Account]) -> None:
        logger.debug(f"_populate_table called with {len(accounts)} accounts")
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
            logger.debug(f"_populate_table row {row}: code={acc.account_code}, name={acc.account_name}, opening_balance={acc.opening_balance}, current_balance={acc.current_balance}")
            for col, value in enumerate(values):
                item = QTableWidgetItem(str(value))
                item.setData(Qt.UserRole, acc.id)
                if col in (4, 5):
                    item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
                self.table.setItem(row, col, item)
        logger.debug(f"_populate_table completed - populated {len(accounts)} rows")

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
        logger.debug("_on_add called")
        dialog = AccountDialog(self._accounts, parent=self)
        logger.debug("_on_add: showing dialog")
        if dialog.exec() != QDialog.Accepted:
            logger.debug("_on_add: dialog rejected/cancelled")
            return
        values = dialog.values()
        logger.debug(f"_on_add: dialog accepted, values={values}")
        
        # Get account_type as string from dialog
        account_type = values["account_type"]
        if hasattr(account_type, 'value'):
            account_type = account_type.value
        
        logger.debug(f"_on_add: calling controller.create_account with opening_balance={values['opening_balance']}")
        success, error = self.controller.create_account(
            account_code=values["account_code"],
            account_name=values["account_name"],
            account_type=account_type,  # Pass as string
            parent_account_id=values["parent_account_id"],
            opening_balance=values["opening_balance"],
        )
        if not success:
            logger.error(f"_on_add: create_account failed with error: {error}")
            QMessageBox.warning(self, "Could not create account", error)
            return
        logger.info(f"_on_add: account created successfully, refreshing")
        self.refresh()


    def _on_edit(self) -> None:
        logger.debug("_on_edit called")
        account = self._selected_account()
        if account is None:
            logger.debug("_on_edit: no account selected")
            QMessageBox.information(self, "No selection", "Select an account to edit.")
            return
        logger.debug(f"_on_edit: editing account id={account.id}, name={account.account_name}, opening_balance={account.opening_balance}")
        dialog = AccountDialog(self._accounts, account=account, parent=self)
        logger.debug("_on_edit: showing dialog")
        if dialog.exec() != QDialog.Accepted:
            logger.debug("_on_edit: dialog rejected/cancelled")
            return
        values = dialog.values()
        logger.debug(f"_on_edit: dialog accepted, values={values}")
        success, error = self.controller.update_account(
            account_id=account.id,
            account_name=values["account_name"],
            opening_balance=values["opening_balance"],
            parent_account_id=values["parent_account_id"],
            is_active=account.is_active,
        )
        if not success:
            logger.error(f"_on_edit: update_account failed with error: {error}")
            QMessageBox.warning(self, "Could not update account", error)
            return
        logger.info(f"_on_edit: account updated successfully, refreshing")
        self.refresh()

    def _on_deactivate(self) -> None:
        logger.debug("_on_deactivate called")
        account = self._selected_account()
        if account is None:
            logger.debug("_on_deactivate: no account selected")
            QMessageBox.information(self, "No selection", "Select an account to deactivate.")
            return
        confirm = QMessageBox.question(
            self, "Confirm", f"Deactivate account '{account.account_name}'?"
        )
        if confirm != QMessageBox.Yes:
            logger.debug("_on_deactivate: user cancelled")
            return
        logger.debug(f"_on_deactivate: deactivating account id={account.id}")
        success, error = self.controller.deactivate_account(account.id)
        if not success:
            logger.error(f"_on_deactivate: failed with error: {error}")
            QMessageBox.warning(self, "Could not deactivate account", error)
            return
        logger.info(f"_on_deactivate: account deactivated successfully, refreshing")
        self.refresh()
    def _on_opening_balance(self):
        """Open opening balance dialog."""
        logger.debug("_on_opening_balance called")
        dialog = OpeningBalanceDialog(self)
        logger.debug("_on_opening_balance: showing dialog")
        result = dialog.exec()
        logger.debug(f"_on_opening_balance: dialog closed with result={result}")
        if result == QDialog.Accepted:
            logger.info("_on_opening_balance: opening balance saved, refreshing")
            self.refresh()