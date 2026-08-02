"""Asset management widget - view and log fixed assets."""
from __future__ import annotations

from PySide6.QtCore import Qt, QDate, Signal
from PySide6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QHeaderView,
    QMessageBox,
    QDialog,
    QFormLayout,
    QGroupBox,
    QLineEdit,
    QDoubleSpinBox,
    QDateEdit,
    QComboBox,
    QDialogButtonBox,
)

from database.connection import get_db
from services.accounting_service import AccountingService, JournalLine
from models.enums import VoucherType, AccountType
from utils.logger import get_logger
from services.account_service import AccountService

logger = get_logger(__name__)


class AssetDialog(QDialog):
    """Dialog for adding a fixed asset with due date tracking."""

    def __init__(self, parent=None, asset_id: int | None = None):
        super().__init__(parent)
        self.db = get_db()
        self.accounting = AccountingService(self.db)
        self.asset_id = asset_id
        self.setWindowTitle("Edit Asset" if asset_id else "Add Fixed Asset")
        self.setModal(True)
        self.resize(550, 500)
        self._setup_ui()
        if asset_id:
            self._load_asset_data()

    def _setup_ui(self):
        layout = QVBoxLayout(self)

        # Asset Details
        asset_group = QGroupBox("Asset Details")
        asset_layout = QFormLayout(asset_group)

        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("e.g., Production Machinery")
        asset_layout.addRow("Asset Name*:", self.name_input)

        self.code_combo = QComboBox()
        self.code_combo.addItem("Furniture & Fixtures", "1501")
        self.code_combo.addItem("Office Equipment", "1502")
        self.code_combo.addItem("Plant & Machinery", "1503")
        self.code_combo.addItem("Motor Vehicles", "1504")
        self.code_combo.addItem("Buildings", "1505")
        self.code_combo.addItem("Other Fixed Assets", "1506")
        asset_layout.addRow("Asset Type:", self.code_combo)

        self.amount_input = QDoubleSpinBox()
        self.amount_input.setMinimum(0.01)
        self.amount_input.setMaximum(999999999.99)
        self.amount_input.setDecimals(2)
        self.amount_input.setPrefix("Rs. ")
        asset_layout.addRow("Purchase Amount*:", self.amount_input)

        self.date_input = QDateEdit()
        self.date_input.setDate(QDate.currentDate())
        self.date_input.setDisplayFormat("yyyy-MM-dd")
        asset_layout.addRow("Purchase Date:", self.date_input)

        # Asset Classification (Current vs Non-Current)
        self.classification_combo = QComboBox()
        self.classification_combo.addItem("Current Asset (Due within 1 year)", "CURRENT")
        self.classification_combo.addItem("Non-Current Asset (Due after 1 year)", "NON_CURRENT")
        asset_layout.addRow("Classification:", self.classification_combo)

        layout.addWidget(asset_group)

        # Payment Details
        payment_group = QGroupBox("Payment Details")
        payment_layout = QFormLayout(payment_group)

        self.payment_combo = QComboBox()
        self.payment_combo.addItem("Credit (Pay Later)", "CREDIT")
        self.payment_combo.addItem("Cash", "CASH")
        self.payment_combo.addItem("Bank", "BANK")
        self.payment_combo.addItem("Cheque", "CHEQUE")
        payment_layout.addRow("Payment Method:", self.payment_combo)

        self.supplier_input = QLineEdit()
        self.supplier_input.setPlaceholderText("Supplier name (for Credit)")
        payment_layout.addRow("Supplier Name:", self.supplier_input)

        self.due_date_input = QDateEdit()
        self.due_date_input.setDate(QDate.currentDate().addMonths(1))
        self.due_date_input.setDisplayFormat("yyyy-MM-dd")
        payment_layout.addRow("Due Date:", self.due_date_input)

        self.payment_combo.currentTextChanged.connect(
            lambda t: self.due_date_input.setVisible(t == "Credit (Pay Later)")
        )
        self.due_date_input.setVisible(False)

        layout.addWidget(payment_group)

        # Info label
        info = QLabel(
            "💡 This will create a Fixed Asset account and post a journal entry.\n"
            "Current Asset = Due within 1 year | Non-Current = Due after 1 year\n"
            "The asset will appear on your Balance Sheet."
        )
        info.setStyleSheet("color: #666; font-size: 11px; padding: 8px; background: #f8f9fa; border-radius: 4px;")
        info.setWordWrap(True)
        layout.addWidget(info)

        # Buttons
        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self._on_save)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def _load_asset_data(self):
        """Load existing asset data for editing."""
        asset = self.db.fetch_one("SELECT * FROM accounts WHERE id = ?", (self.asset_id,))
        if asset:
            self.name_input.setText(asset["account_name"].replace(" (Asset)", ""))
            
            # Get asset details
            details = self.db.fetch_one(
                "SELECT * FROM asset_details WHERE account_id = ?", (self.asset_id,)
            )
            if details:
                self.amount_input.setValue(details["purchase_amount"])
                self.date_input.setDate(QDate.fromString(details["purchase_date"], "yyyy-MM-dd"))
                
                idx = self.classification_combo.findData(details["asset_type"])
                if idx >= 0:
                    self.classification_combo.setCurrentIndex(idx)
                
                if details["due_date"]:
                    self.due_date_input.setDate(QDate.fromString(details["due_date"], "yyyy-MM-dd"))
                    self.due_date_input.setVisible(True)
                    self.payment_combo.setCurrentText("Credit (Pay Later)")

    def _on_save(self):
        """Save the asset."""
        name = self.name_input.text().strip()
        if not name:
            QMessageBox.warning(self, "Error", "Please enter an asset name.")
            return

        amount = self.amount_input.value()
        if amount <= 0:
            QMessageBox.warning(self, "Error", "Please enter a valid amount.")
            return

        asset_code = self.code_combo.currentData()
        entry_date = self.date_input.date().toString("yyyy-MM-dd")
        payment_method = self.payment_combo.currentData()
        supplier_name = self.supplier_input.text().strip()
        classification = self.classification_combo.currentData()
        due_date = self.due_date_input.date().toString("yyyy-MM-dd") if self.due_date_input.isVisible() else None

        # Create asset account
        existing = self.db.fetch_one(
            "SELECT id FROM accounts WHERE account_code = ?", (asset_code,)
        )

        if existing:
            asset_id = existing["id"]
        else:
            account_service = AccountService(self.db)
            asset = account_service.create_account(
                account_code=asset_code,
                account_name=f"{name} (Asset)",
                account_type=AccountType.ASSET,
                opening_balance=0,
                account_subtype=classification,
            )
            asset_id = asset.id
            logger.info(f"Created asset account: {asset_code} - {name}")

        # Create supplier if provided
        supplier_id = None
        if supplier_name:
            existing_supplier = self.db.fetch_one(
                "SELECT id FROM parties WHERE name = ? AND party_type = 'SUPPLIER'",
                (supplier_name,)
            )
            if existing_supplier:
                supplier_id = existing_supplier["id"]
            else:
                from services.party_service import PartyService
                from models.enums import PartyType
                party_service = PartyService(self.db)
                party = party_service.create_party(
                    code=f"SUPP-{supplier_name[:5].upper()}",
                    name=supplier_name,
                    party_type=PartyType.SUPPLIER,
                    credit_limit=amount,
                )
                supplier_id = party.id

        # Get credit account
        if payment_method == "CREDIT":
            credit_account = self.db.fetch_one(
                "SELECT id FROM accounts WHERE account_code = '2000'"
            )
            credit_desc = f"Liability for {name}"
            if supplier_name:
                credit_desc = f"Liability for {name} - {supplier_name}"
        elif payment_method == "CASH":
            credit_account = self.db.fetch_one(
                "SELECT id FROM accounts WHERE account_code = '1000'"
            )
            credit_desc = "Cash payment"
        else:
            credit_account = self.db.fetch_one(
                "SELECT id FROM accounts WHERE account_code = '1010'"
            )
            credit_desc = "Bank payment"

        if not credit_account:
            QMessageBox.warning(self, "Error", "Payment account not found.")
            return

        # Post journal entry
        try:
            self.accounting.post_journal_entry(
                voucher_type=VoucherType.JOURNAL,
                entry_date=entry_date,
                lines=[
                    JournalLine(account_id=asset_id, debit=amount, credit=0, description=f"Purchase: {name}"),
                    JournalLine(
                        account_id=credit_account["id"],
                        debit=0,
                        credit=amount,
                        party_id=supplier_id if payment_method == "CREDIT" else None,
                        description=credit_desc,
                    ),
                ],
                narration=f"Asset purchase: {name} - Rs. {amount:,.2f} ({classification})",
            )

            # Save asset details
            self.db.execute("""
                INSERT INTO asset_details (
                    account_id, asset_type, purchase_amount, purchase_date,
                    supplier_id, due_date, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                asset_id,
                classification,
                amount,
                entry_date,
                supplier_id,
                due_date,
                f"Asset: {name}",
            ))

            QMessageBox.information(
                self,
                "Success",
                f"✅ Asset '{name}' logged!\n\n"
                f"Amount: Rs. {amount:,.2f}\n"
                f"Asset Code: {asset_code}\n"
                f"Classification: {classification}\n"
                f"Payment: {payment_method}\n"
                f"Supplier: {supplier_name or 'N/A'}\n"
                f"Due Date: {due_date or 'N/A'}\n\n"
                f"The asset will appear on your Balance Sheet."
            )
            self.accept()

        except Exception as e:
            logger.exception(f"Error creating asset: {e}")
            QMessageBox.critical(self, "Error", f"Failed: {str(e)}")


class AssetView(QWidget):
    """Asset management widget."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.db = get_db()
        self._build_ui()
        self._load_assets()

    def _build_ui(self):
        layout = QVBoxLayout(self)

        # Header
        header = QHBoxLayout()
        title = QLabel("📦 Fixed Assets")
        title.setStyleSheet("font-size: 18px; font-weight: bold;")
        header.addWidget(title)
        header.addStretch()

        self.refresh_btn = QPushButton("Refresh")
        self.refresh_btn.clicked.connect(self._load_assets)
        header.addWidget(self.refresh_btn)

        self.add_btn = QPushButton("+ Add Asset")
        self.add_btn.clicked.connect(self._on_add_asset)
        self.add_btn.setStyleSheet("background: #2ecc71; color: white; font-weight: bold;")
        header.addWidget(self.add_btn)

        layout.addLayout(header)

        # Table
        self.table = QTableWidget()
        self.table.setColumnCount(7)
        self.table.setHorizontalHeaderLabels([
            "Code", "Asset Name", "Type", "Classification", "Amount", "Due Date", "Date"
        ])
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.setSelectionMode(QTableWidget.SingleSelection)
        layout.addWidget(self.table)

    def _load_assets(self):
        """Load asset accounts into table with current balance."""
        assets = self.db.fetch_all("""
            SELECT 
                a.id, 
                a.account_code, 
                a.account_name, 
                a.account_subtype,
                a.opening_balance,
                a.created_at,
                ad.asset_type,
                ad.purchase_amount,
                ad.due_date,
                COALESCE(SUM(jel.debit - jel.credit), 0) as current_balance
            FROM accounts a
            LEFT JOIN asset_details ad ON ad.account_id = a.id
            LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
            LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
            WHERE a.account_type = 'ASSET'
            AND a.account_code LIKE '15%'
            AND a.is_active = 1
            AND (je.is_posted = 1 OR je.is_posted IS NULL)
            GROUP BY a.id
            ORDER BY a.account_code
        """)

        self.table.setRowCount(len(assets))
        for row, asset in enumerate(assets):
            balance = asset["current_balance"] or asset["purchase_amount"] or asset["opening_balance"] or 0
            classification = asset["asset_type"] or asset["account_subtype"] or "N/A"
            
            self.table.setItem(row, 0, QTableWidgetItem(asset["account_code"]))
            self.table.setItem(row, 1, QTableWidgetItem(asset["account_name"].replace(" (Asset)", "")))
            self.table.setItem(row, 2, QTableWidgetItem(asset["account_subtype"] or "-"))
            self.table.setItem(row, 3, QTableWidgetItem(classification))
            self.table.setItem(row, 4, QTableWidgetItem(f"Rs. {balance:,.2f}"))
            self.table.setItem(row, 5, QTableWidgetItem(asset["due_date"] or "N/A"))
            self.table.setItem(row, 6, QTableWidgetItem(asset["created_at"][:10] if asset["created_at"] else "-"))

        self.table.resizeColumnsToContents()

    def _on_add_asset(self):
        """Add new asset."""
        dialog = AssetDialog(self)
        if dialog.exec() == QDialog.Accepted:
            self._load_assets()