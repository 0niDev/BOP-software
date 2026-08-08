"""Opening Balance Dialog - Set initial balances for accounts."""
from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QDialog,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QDoubleSpinBox,
    QPushButton,
    QMessageBox,
    QTableWidget,
    QTableWidgetItem,
    QHeaderView,
)

from database.connection import get_db
from services.accounting_service import AccountingService, JournalLine
from models.enums import VoucherType
from utils.logger import get_logger

logger = get_logger(__name__)


class OpeningBalanceDialog(QDialog):
    """Dialog for setting opening balances."""

    def __init__(self, parent=None):
        super().__init__(parent)
        logger.debug("OpeningBalanceDialog initializing...")
        self.setWindowTitle("Set Opening Balances")
        self.setModal(True)
        self.resize(600, 500)
        self.db = get_db()
        self.accounting = AccountingService(self.db)
        self.balance_inputs = {}
        self._setup_ui()
        self._load_accounts()
        logger.debug("OpeningBalanceDialog initialization completed")

    def _setup_ui(self):
        logger.debug("OpeningBalanceDialog._setup_ui() called")
        layout = QVBoxLayout(self)

        # Info label
        info = QLabel(
            "Set opening balances for your accounts.\n"
            "These will be posted as journal entries.\n\n"
            "For Asset accounts (Cash, Bank, Inventory): Enter positive numbers.\n"
            "For Liability accounts (Accounts Payable): Enter positive numbers.\n"
            "Equity will be automatically calculated."
        )
        info.setStyleSheet("background: #f8f9fa; padding: 10px; border-radius: 4px;")
        info.setWordWrap(True)
        layout.addWidget(info)

        # Accounts table
        self.table = QTableWidget()
        self.table.setColumnCount(3)
        self.table.setHorizontalHeaderLabels(["Account", "Type", "Opening Balance"])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        self.table.setAlternatingRowColors(True)
        layout.addWidget(self.table)

        # Buttons
        button_layout = QHBoxLayout()

        self.calculate_btn = QPushButton("Calculate Equity")
        self.calculate_btn.clicked.connect(self._calculate_equity)
        self.calculate_btn.setStyleSheet("background: #3498db; color: white; font-weight: bold;")
        button_layout.addWidget(self.calculate_btn)

        button_layout.addStretch()

        self.save_btn = QPushButton("Save Opening Balance")
        self.save_btn.setStyleSheet("background: #2ecc71; color: white; font-weight: bold;")
        self.save_btn.clicked.connect(self._save)
        button_layout.addWidget(self.save_btn)

        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(self.cancel_btn)

        layout.addLayout(button_layout)
        logger.debug("OpeningBalanceDialog._setup_ui() completed")

    def _load_accounts(self):
        """Load ALL accounts into table (including those with zero balance)."""
        logger.debug("OpeningBalanceDialog._load_accounts() called")
        
        # First verify company_id=1 exists
        company_check = self.db.fetch_one("SELECT id, name FROM companies WHERE id = ?", (1,))
        if company_check is None:
            logger.error("OpeningBalanceDialog._load_accounts() company_id=1 does not exist!")
            QMessageBox.critical(
                self,
                "Database Error",
                "Company ID 1 does not exist in the database.\n\n"
                "Please check your database setup."
            )
            return
        
        logger.debug(f"OpeningBalanceDialog._load_accounts() company validated: id={company_check['id']}, name={company_check['name']}")
        
        # Debug: List all available accounts in DB
        all_accounts = self.db.fetch_all("SELECT id, account_code, account_name, account_type, company_id, is_active FROM accounts ORDER BY id")
        logger.debug(f"OpeningBalanceDialog._load_accounts() total accounts in DB: {len(all_accounts)}")
        for acc in all_accounts[:10]:  # Log first 10 to avoid spam
            logger.debug(f"  Account: id={acc['id']}, code={acc['account_code']}, name={acc['account_name']}, type={acc['account_type']}, company_id={acc['company_id']}, is_active={acc['is_active']}")
        if len(all_accounts) > 10:
            logger.debug(f"  ... and {len(all_accounts) - 10} more accounts")
        
        accounts = self.db.fetch_all("""
            SELECT 
                a.id, 
                a.account_code, 
                a.account_name, 
                a.account_type,
                COALESCE(SUM(jel.debit - jel.credit), 0) as current_balance
            FROM accounts a
            LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
            LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
            WHERE a.company_id = ?
            AND a.account_type IN ('ASSET', 'LIABILITY', 'EQUITY')
            AND a.is_active = 1
            GROUP BY a.id, a.account_code, a.account_name, a.account_type
            ORDER BY 
                CASE a.account_type
                    WHEN 'ASSET' THEN 1
                    WHEN 'LIABILITY' THEN 2
                    WHEN 'EQUITY' THEN 3
                    ELSE 4
                END,
                a.account_code
        """, (1,))
        logger.debug(f"OpeningBalanceDialog._load_accounts() fetched {len(accounts)} active accounts for company_id=1")
        
        if len(accounts) == 0:
            logger.warning("OpeningBalanceDialog._load_accounts() no accounts found for company_id=1!")
            QMessageBox.warning(
                self,
                "No Accounts Found",
                "No active accounts found for the current company.\n\n"
                "Please create accounts first before setting opening balances."
            )

        self.table.setRowCount(len(accounts))
        self.balance_inputs = {}

        for row, acc in enumerate(accounts):
            # Account name with code
            name_item = QTableWidgetItem(f"{acc['account_code']} - {acc['account_name']}")
            name_item.setData(Qt.UserRole, acc['id'])
            self.table.setItem(row, 0, name_item)

            # Type
            type_item = QTableWidgetItem(acc['account_type'])
            self.table.setItem(row, 1, type_item)

            # Balance input
            balance_spin = QDoubleSpinBox()
            balance_spin.setRange(-999999999, 999999999)
            balance_spin.setDecimals(2)
            balance_spin.setPrefix("Rs. ")
            balance_spin.setValue(0.0)  # Always start from zero
            
            # Store reference
            self.balance_inputs[acc['id']] = balance_spin
            self.table.setCellWidget(row, 2, balance_spin)
            logger.debug(f"OpeningBalanceDialog._load_accounts() row {row}: id={acc['id']}, code={acc['account_code']}, type={acc['account_type']}")
            
            # CRITICAL DEBUG: Verify the account ID can be retrieved back
            retrieved_id = self.table.item(row, 0).data(Qt.UserRole)
            logger.debug(f"OpeningBalanceDialog._load_accounts() VERIFICATION: stored id={acc['id']}, retrieved id={retrieved_id}, match={acc['id'] == retrieved_id}")

        self.table.resizeColumnsToContents()
        logger.debug("OpeningBalanceDialog._load_accounts() completed")

    def _calculate_equity(self):
        """Auto-calculate equity balance based on entered values."""
        logger.debug("OpeningBalanceDialog._calculate_equity() called")
        total_debit = 0.0
        total_credit = 0.0
        equity_widget = None

        # First pass: collect all values
        for row in range(self.table.rowCount()):
            acc_id = self.table.item(row, 0).data(Qt.UserRole)
            spin = self.balance_inputs.get(acc_id)
            if spin:
                value = spin.value()
                acc_type = self.table.item(row, 1).text()
                
                if acc_type == "ASSET":
                    total_debit += value
                elif acc_type == "LIABILITY":
                    total_credit += value
                elif acc_type == "EQUITY":
                    equity_widget = spin
                logger.debug(f"OpeningBalanceDialog._calculate_equity() row {row}: acc_id={acc_id}, type={acc_type}, value={value}")

        # Calculate required equity
        # Assets = Liabilities + Equity
        # So Equity = Assets - Liabilities
        equity_needed = total_debit - total_credit
        logger.debug(f"OpeningBalanceDialog._calculate_equity() calculated: total_debit={total_debit}, total_credit={total_credit}, equity_needed={equity_needed}")

        # Set equity value
        if equity_widget is not None:
            equity_widget.setValue(equity_needed)
            
            # Show summary
            QMessageBox.information(
                self,
                "Equity Calculated",
                f"✅ Equity set to Rs. {equity_needed:,.2f}\n\n"
                f"Assets (Debit):   Rs. {total_debit:,.2f}\n"
                f"Liabilities (Credit): Rs. {total_credit:,.2f}\n"
                f"Equity needed:    Rs. {equity_needed:,.2f}"
            )
            logger.info(f"OpeningBalanceDialog._calculate_equity() equity set to {equity_needed}")
        else:
            logger.error("OpeningBalanceDialog._calculate_equity() no EQUITY account found")
            QMessageBox.warning(
                self, 
                "No Equity Account",
                "No EQUITY account found in the table.\n\n"
                "Please make sure you have an equity account like 'Owner's Equity'."
            )

    def _save(self):
        """Save opening balances as journal entry and update account opening_balance fields."""
        from accounting.system_accounts import SystemAccountCodes, SystemAccountResolver
        
        logger.debug("OpeningBalanceDialog._save() called")
        entries = []
        total_debit = 0.0
        total_credit = 0.0

        # Collect all entries
        logger.error(f"OpeningBalanceDialog._save() STARTING - iterating over {self.table.rowCount()} rows")
        for row in range(self.table.rowCount()):
            acc_id_item = self.table.item(row, 0)
            if acc_id_item is None:
                logger.error(f"OpeningBalanceDialog._save() row {row}: NO account item, skipping")
                continue
            acc_id = acc_id_item.data(Qt.UserRole)
            logger.error(f"OpeningBalanceDialog._save() row {row}: retrieved acc_id={acc_id} from table item (type={type(acc_id)})")
            
            spin = self.balance_inputs.get(acc_id)
            if spin and spin.value() != 0:
                value = spin.value()
                acc_type_item = self.table.item(row, 1)
                acc_type = acc_type_item.text() if acc_type_item else "UNKNOWN"
                logger.error(f"OpeningBalanceDialog._save() row {row}: acc_id={acc_id}, value={value}, acc_type={acc_type}")
                
                if acc_type == "ASSET":
                    entries.append({
                        "account_id": acc_id,
                        "debit": value,
                        "credit": 0,
                    })
                    total_debit += value
                    logger.error(f"OpeningBalanceDialog._save() ASSET entry added: acc_id={acc_id}, debit={value}, total_debit now={total_debit}")
                elif acc_type in ["LIABILITY", "EQUITY"]:
                    entries.append({
                        "account_id": acc_id,
                        "debit": 0,
                        "credit": value,
                    })
                    total_credit += value
                    logger.error(f"OpeningBalanceDialog._save() {acc_type} entry added: acc_id={acc_id}, credit={value}, total_credit now={total_credit}")
                else:
                    logger.error(f"OpeningBalanceDialog._save() UNKNOWN account type '{acc_type}' for acc_id={acc_id}")

        logger.error(f"OpeningBalanceDialog._save() COLLECTION COMPLETE - {len(entries)} entries: total_debit={total_debit}, total_credit={total_credit}")
        logger.error(f"OpeningBalanceDialog._save() ENTRIES DATA: {entries}")
        
        if not entries:
            logger.warning("OpeningBalanceDialog._save() no balances to save")
            QMessageBox.warning(self, "Error", "No balances to save! Please enter some values.")
            return

        # Check if balanced
        if abs(total_debit - total_credit) > 0.01:
            logger.error(f"OpeningBalanceDialog._save() not balanced: debit={total_debit}, credit={total_credit}, diff={abs(total_debit - total_credit)}")
            QMessageBox.warning(
                self,
                "Not Balanced",
                f"Total Debits: Rs. {total_debit:,.2f}\n"
                f"Total Credits: Rs. {total_credit:,.2f}\n\n"
                "The books are not balanced!\n"
                "Click 'Calculate Equity' to auto-balance, or adjust manually."
            )
            return

        logger.info(f"OpeningBalanceDialog._save() balanced entries: total_debit={total_debit}, total_credit={total_credit}, count={len(entries)}")

        # Confirm
        reply = QMessageBox.question(
            self,
            "Confirm",
            f"Post opening balance of Rs. {total_debit:,.2f}?\n\n"
            "This will create a journal entry and update account opening balances.",
            QMessageBox.Yes | QMessageBox.No
        )

        if reply != QMessageBox.Yes:
            logger.debug("OpeningBalanceDialog._save() user cancelled")
            return

        # Post journal entry
        try:
            logger.error("OpeningBalanceDialog._save() STARTING journal entry post...")
            
            # Validate all account IDs exist before creating journal lines
            logger.error(f"OpeningBalanceDialog._save() VALIDATING {len(entries)} account IDs exist in database for company_id=1")
            for entry in entries:
                acc_id = entry["account_id"]
                # Check account exists AND belongs to company_id=1
                acc_data = self.db.fetch_one(
                    "SELECT id, account_code, account_name, company_id, is_active FROM accounts WHERE id = ? AND company_id = ?", 
                    (acc_id, 1)
                )
                logger.error(f"OpeningBalanceDialog._save() validation for acc_id={acc_id}: {acc_data}")
                
                if acc_data is None:
                    logger.error(f"OpeningBalanceDialog._save() account_id={acc_id} DOES NOT EXIST or doesn't belong to company_id=1!")
                    
                    # Debug: Check if account exists at all
                    acc_check = self.db.fetch_one("SELECT id, account_code, account_name, company_id FROM accounts WHERE id = ?", (acc_id,))
                    if acc_check:
                        logger.error(f"OpeningBalanceDialog._save() Account {acc_id} EXISTS but belongs to company_id={acc_check['company_id']}, NOT company_id=1")
                    else:
                        logger.error(f"OpeningBalanceDialog._save() Account {acc_id} DOES NOT EXIST AT ALL in the database")
                    
                    # List ALL accounts
                    all_accounts = self.db.fetch_all("SELECT id, account_code, account_name, company_id FROM accounts ORDER BY id")
                    logger.error(f"OpeningBalanceDialog._save() ALL accounts in DB ({len(all_accounts)}):")
                    for acc in all_accounts:
                        logger.error(f"  Account: id={acc['id']}, code={acc['account_code']}, name={acc['account_name']}, company_id={acc['company_id']}")
                    
                    QMessageBox.critical(
                        self,
                        "Invalid Account",
                        f"Account ID {acc_id} is invalid.\n\n"
                        f"This account may not exist or may belong to a different company.\n"
                        "Please close this dialog and reload the chart of accounts."
                    )
                    return
                logger.error(f"OpeningBalanceDialog._save() account_id={acc_id} VALIDATED: code={acc_data['account_code']}, name={acc_data['account_name']}, company_id={acc_data['company_id']}, is_active={acc_data['is_active']}")
            
            logger.error("OpeningBalanceDialog._save() ALL account validations PASSED")
            
            journal_lines = []
            for entry in entries:
                logger.error(f"OpeningBalanceDialog._save() creating JournalLine: account_id={entry['account_id']}, debit={entry['debit']}, credit={entry['credit']}")
                journal_line = JournalLine(
                    account_id=entry["account_id"],
                    debit=entry["debit"],
                    credit=entry["credit"],
                    description="Opening balance"
                )
                logger.error(f"OpeningBalanceDialog._save() JournalLine created: {journal_line}")
                journal_lines.append(journal_line)
            
            logger.error(f"OpeningBalanceDialog._save() created {len(journal_lines)} journal lines: {journal_lines}")

            import datetime
            logger.error(f"OpeningBalanceDialog._save() calling post_journal_entry with voucher_type=OPENING, date={datetime.date.today().isoformat()}, lines={len(journal_lines)}")
            
            # Wrap journal entry posting in a transaction
            db = get_db()
            try:
                with db.transaction():
                    logger.error("OpeningBalanceDialog._save() STARTING transaction for journal entry")
                    self.accounting.post_journal_entry(
                        voucher_type=VoucherType.OPENING,
                        entry_date=datetime.date.today().isoformat(),
                        lines=journal_lines,
                        narration="Opening balances setup"
                    )
                    logger.error("OpeningBalanceDialog._save() journal entry posted SUCCESSFULLY within transaction")
            except Exception as e:
                logger.error(f"OpeningBalanceDialog._save() FAILED to post journal entry: {e}")
                raise
            
            logger.error("OpeningBalanceDialog._save() journal entry posted SUCCESSFULLY")
            
            # Update the accounts.opening_balance field for each account
            db = get_db()
            logger.debug(f"OpeningBalanceDialog._save() updating opening_balance for {len(entries)} accounts")
            for entry in entries:
                acc_id = entry["account_id"]
                amount = entry["debit"] if entry["debit"] > 0 else entry["credit"]
                
                # Determine sign based on account type
                acc_data = db.fetch_one("SELECT account_type FROM accounts WHERE id = ?", (acc_id,))
                if acc_data:
                    acc_type = acc_data["account_type"]
                    # For assets, debit is positive; for liabilities/equity, credit is positive
                    if acc_type == "ASSET":
                        signed_amount = amount  # Positive for assets
                    else:
                        signed_amount = amount  # Positive for liabilities/equity
                    
                    logger.debug(f"OpeningBalanceDialog._save() updating account {acc_id} (type={acc_type}) opening_balance to {signed_amount}")
                    try:
                        db.execute(
                            "UPDATE accounts SET opening_balance = ? WHERE id = ?",
                            (signed_amount, acc_id)
                        )
                        logger.debug(f"OpeningBalanceDialog._save() successfully updated account {acc_id}")
                    except Exception as e:
                        logger.error(f"OpeningBalanceDialog._save() failed to update account {acc_id}: {e}")
                        raise
                else:
                    logger.error(f"OpeningBalanceDialog._save() account {acc_id} not found in database")

            QMessageBox.information(
                self,
                "Success",
                f"✅ Opening balance of Rs. {total_debit:,.2f} posted successfully!"
            )
            logger.info(f"OpeningBalanceDialog._save() completed successfully, posted {total_debit}")
            self.accept()

        except Exception as e:
            logger.exception(f"OpeningBalanceDialog._save() failed with exception: {e}")
            QMessageBox.critical(self, "Error", f"Failed to post opening balance:\n{str(e)}")