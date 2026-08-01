"""Asset Dialog - Log fixed assets with liability."""
from __future__ import annotations

from PySide6.QtCore import Qt, QDate
from PySide6.QtWidgets import (
    QDialog,
    QVBoxLayout,
    QFormLayout,
    QGroupBox,
    QLineEdit,
    QDoubleSpinBox,
    QDateEdit,
    QDialogButtonBox,
    QMessageBox,
    QComboBox,
    QLabel,
)

from database.connection import get_db
from services.accounting_service import AccountingService, JournalLine
from models.enums import VoucherType
from utils.logger import get_logger

logger = get_logger(__name__)


class AssetDialog(QDialog):
    """Dialog for logging fixed asset purchases with liability."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.db = get_db()
        self.accounting = AccountingService(self.db)
        self.setWindowTitle("Log Fixed Asset")
        self.setModal(True)
        self.resize(500, 420)
        self._setup_ui()

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

        # Payment Details
        payment_group = QGroupBox("Payment Details")
        payment_layout = QFormLayout(payment_group)

        self.payment_method_combo = QComboBox()
        self.payment_method_combo.addItem("Credit (Pay Later)", "CREDIT")
        self.payment_method_combo.addItem("Cash", "CASH")
        self.payment_method_combo.addItem("Bank", "BANK")
        self.payment_method_combo.addItem("Cheque", "CHEQUE")
        payment_layout.addRow("Payment Method:", self.payment_method_combo)

        self.supplier_input = QLineEdit()
        self.supplier_input.setPlaceholderText("Supplier name (for Credit)")
        payment_layout.addRow("Supplier Name:", self.supplier_input)

        self.due_date_input = QDateEdit()
        self.due_date_input.setDate(QDate.currentDate().addMonths(1))
        self.due_date_input.setDisplayFormat("yyyy-MM-dd")
        self.due_date_input.setVisible(False)
        payment_layout.addRow("Due Date:", self.due_date_input)

        # Show due date only for Credit
        self.payment_method_combo.currentTextChanged.connect(self._on_payment_method_changed)

        layout.addWidget(asset_group)
        layout.addWidget(payment_group)

        # Info label
        self.info_label = QLabel(
            "💡 This will create a Fixed Asset account and post a journal entry.\n"
            "The asset will appear on your Balance Sheet."
        )
        self.info_label.setStyleSheet("color: #666; font-size: 11px; padding: 8px; background: #f8f9fa; border-radius: 4px;")
        self.info_label.setWordWrap(True)
        layout.addWidget(self.info_label)

        # Buttons
        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self._on_save)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def _on_payment_method_changed(self, text: str):
        """Show/hide due date based on payment method."""
        self.due_date_input.setVisible(text == "Credit (Pay Later)")

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
        payment_method = self.payment_method_combo.currentData()
        supplier_name = self.supplier_input.text().strip()

        # Create asset account if needed
        existing = self.db.fetch_one(
            "SELECT id FROM accounts WHERE account_code = ?", (asset_code,)
        )

        if existing:
            asset_id = existing["id"]
        else:
            from services.account_service import AccountService
            from models.enums import AccountType
            account_service = AccountService(self.db)
            asset = account_service.create_account(
                account_code=asset_code,
                account_name=f"{name} (Asset)",
                account_type=AccountType.ASSET,
                opening_balance=0,
            )
            asset_id = asset.id
            logger.info(f"Created asset account: {asset_code} - {name}")

        # Determine credit account
        credit_account = None
        credit_description = ""

        if payment_method == "CREDIT":
            # Use Accounts Payable
            credit_account = self.db.fetch_one(
                "SELECT id FROM accounts WHERE account_code = '2000'"
            )
            credit_description = f"Liability for {name}"
            if supplier_name:
                credit_description = f"Liability for {name} - {supplier_name}"

            # Create supplier if provided
            if supplier_name:
                existing_supplier = self.db.fetch_one(
                    "SELECT id FROM parties WHERE name = ? AND party_type = 'SUPPLIER'",
                    (supplier_name,)
                )
                if not existing_supplier:
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
                else:
                    supplier_id = existing_supplier["id"]

        elif payment_method == "CASH":
            credit_account = self.db.fetch_one(
                "SELECT id FROM accounts WHERE account_code = '1000'"
            )
            credit_description = "Cash payment"
        elif payment_method in ["BANK", "CHEQUE"]:
            credit_account = self.db.fetch_one(
                "SELECT id FROM accounts WHERE account_code = '1010'"
            )
            credit_description = "Bank payment"

        if not credit_account:
            QMessageBox.warning(self, "Error", "Payment account not found.")
            return

        # Post journal entry
        try:
            lines = [
                JournalLine(
                    account_id=asset_id,
                    debit=amount,
                    credit=0,
                    description=f"Purchase: {name}",
                ),
                JournalLine(
                    account_id=credit_account["id"],
                    debit=0,
                    credit=amount,
                    party_id=supplier_id if payment_method == "CREDIT" else None,
                    description=credit_description,
                ),
            ]

            self.accounting.post_journal_entry(
                voucher_type=VoucherType.JOURNAL,
                entry_date=entry_date,
                lines=lines,
                narration=f"Asset purchase: {name} - Rs. {amount:,.2f}",
            )

            QMessageBox.information(
                self,
                "Success",
                f"✅ Asset '{name}' logged!\n\n"
                f"Amount: Rs. {amount:,.2f}\n"
                f"Asset Account: {asset_code}\n"
                f"Payment Method: {payment_method}\n"
                f"Supplier: {supplier_name or 'N/A'}\n\n"
                f"The asset will appear on your Balance Sheet."
            )
            self.accept()

        except Exception as e:
            logger.exception(f"Error creating asset: {e}")
            QMessageBox.critical(self, "Error", f"Failed to log asset:\n{str(e)}")