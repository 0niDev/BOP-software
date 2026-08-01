"""Party management widget - follows the same pattern as ChartOfAccountsWidget."""
from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QColor, QFont
from PySide6.QtWidgets import (
    QComboBox,
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
)
from database.connection import invalidate_db_cache
from PySide6.QtCore import QTimer
from controllers.party_controller import PartyController
from config.app_config import get_config
from models.enums import PartyType
from models.party import Party
from utils.logger import get_logger

logger = get_logger(__name__)


class PartyView(QWidget):
    """Widget for managing parties (customers/suppliers)."""
    
    party_created = Signal(Party)
    party_updated = Signal(Party)
    party_deleted = Signal(int)  # ← ADDED: Emits party ID on deletion

    def __init__(self, party_controller: PartyController | None = None, parent=None):
        super().__init__(parent)
        self.controller = party_controller or PartyController()
        self._selected_party_id: int | None = None
        self._build_ui()
        self._load_parties()

    def _build_ui(self) -> None:
        """Builds the UI"""
        layout = QVBoxLayout(self)
        layout.setSpacing(10)

        # -- Search and filter controls -----------------------------------------
        controls_layout = QHBoxLayout()
        
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Search by name or code...")
        self.search_input.textChanged.connect(self._on_search_changed)
        controls_layout.addWidget(self.search_input, stretch=2)

        self.type_filter = QComboBox()
        self.type_filter.addItem("All Types", None)
        self.type_filter.addItem("Customer", PartyType.CUSTOMER)
        self.type_filter.addItem("Supplier", PartyType.SUPPLIER)
        self.type_filter.addItem("Both", PartyType.BOTH)
        self.type_filter.currentIndexChanged.connect(self._on_filter_changed)
        controls_layout.addWidget(self.type_filter)
        
        layout.addLayout(controls_layout)

        # -- Party table ---------------------------------------------------------
        self.table = QTableWidget()
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.setSelectionMode(QTableWidget.SingleSelection)
        self.table.clicked.connect(self._on_table_clicked)
        layout.addWidget(self.table, stretch=1)

        # -- Form for add/edit ---------------------------------------------------
        form_group = QGroupBox("Party Details")
        form_layout = QFormLayout(form_group)


        self.code_input = QLineEdit()
        self.code_input.setPlaceholderText("Auto-generated on save")
        self.code_input.setReadOnly(True)  # ← ADD THIS
        self.code_input.setStyleSheet("background: #f0f0f0; color: #666;")
        form_layout.addRow("Code:", self.code_input)  # ← No more "*" required

        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("Full party name")
        form_layout.addRow("Name*:", self.name_input)

        self.type_input = QComboBox()
        self.type_input.addItem("Customer", PartyType.CUSTOMER)
        self.type_input.addItem("Supplier", PartyType.SUPPLIER)
        self.type_input.addItem("Both", PartyType.BOTH)
        form_layout.addRow("Type*:", self.type_input)

        self.credit_input = QLineEdit()
        self.credit_input.setPlaceholderText("0.0")
        form_layout.addRow("Credit Limit:", self.credit_input)

        self.account_input = QLineEdit()
        self.account_input.setPlaceholderText("e.g., 1100 for A/R")
        form_layout.addRow("Account Code:", self.account_input)

        button_layout = QHBoxLayout()
        self.save_button = QPushButton("Save")
        self.save_button.clicked.connect(self._on_save_clicked)
        # ← CHANGED: Clear button now Add button
        self.add_button = QPushButton("Add")  # ← WAS: self.clear_button = QPushButton("Clear")
        self.add_button.clicked.connect(self._on_add_clicked)  # ← WAS: self.clear_button.clicked.connect(self._on_clear_clicked)
        self.edit_button = QPushButton("Edit")
        self.edit_button.clicked.connect(self._on_edit_clicked)
        self.edit_button.setEnabled(False)  # Disabled until selection
        
        self.delete_button = QPushButton("Delete")
        self.delete_button.clicked.connect(self._on_delete_clicked)
        self.delete_button.setEnabled(False)  # Disabled until selection
        
        button_layout.addWidget(self.save_button)
        button_layout.addWidget(self.add_button)  # ← WAS: button_layout.addWidget(self.clear_button)
        button_layout.addWidget(self.edit_button)
        button_layout.addWidget(self.delete_button)
        # ← END CHANGED
        
        form_layout.addRow(button_layout)

        layout.addWidget(form_group)

    def showEvent(self, event):
        """Called when the widget is shown - lazy load data."""
        super().showEvent(event)
        if not hasattr(self, '_is_loaded') or not self._is_loaded:
            self._show_loading_state()
            QTimer.singleShot(50, self._load_parties)

    def _show_loading_state(self):
        """Show loading state in the table."""
        self.table.setRowCount(1)
        self.table.setColumnCount(1)
        self.table.setHorizontalHeaderLabels(["Loading..."])
        loading_item = QTableWidgetItem("🔄 Loading parties...")
        loading_item.setTextAlignment(Qt.AlignCenter)
        self.table.setItem(0, 0, loading_item)
        self.table.horizontalHeader().setStretchLastSection(True)
    def _load_parties(self) -> None:
        """Loads parties into table."""
        parties, error = self.controller.list_parties(
            active_only=False,  # Show all so user can see active/inactive
            party_type=self.type_filter.currentData()
        )
        
        if error:
            QMessageBox.warning(self, "Load Error", error)
            return

        self.table.setRowCount(len(parties))
        self.table.setColumnCount(6)  # ← Add one more column
        self.table.setHorizontalHeaderLabels(["Code", "Name", "Type", "Credit Limit", "Account", "Status"])
        
        for row, party in enumerate(parties):
            self.table.setItem(row, 0, QTableWidgetItem(party.code))
            self.table.setItem(row, 1, QTableWidgetItem(party.name))
            self.table.setItem(row, 2, QTableWidgetItem(party.party_type.value))
            self.table.setItem(row, 3, QTableWidgetItem(f"{party.credit_limit:.2f}"))
            self.table.setItem(row, 4, QTableWidgetItem(str(party.account_id or "")))
            
            # Status column with color
            status = "Active" if party.is_active else "Inactive"
            status_item = QTableWidgetItem(status)
            if party.is_active:
                status_item.setForeground(QColor("#2ecc71"))  # Green
            else:
                status_item.setForeground(QColor("#e74c3c"))  # Red
            self.table.setItem(row, 5, status_item)
        
        self.table.resizeColumnsToContents()
        self._selected_party_id = None
        self._clear_form()

    def _on_search_changed(self, text: str) -> None:
        """Filters table based on search text"""
        for row in range(self.table.rowCount()):
            matches = False
            for col in [0, 1]:  # Code and Name columns
                item = self.table.item(row, col)
                if item and text.lower() in item.text().lower():
                    matches = True
                    break
            self.table.setRowHidden(row, not matches)

    def _on_filter_changed(self, index: int) -> None:
        """Reloads when party type filter changes"""
        self._load_parties()

    def _on_table_clicked(self, index) -> None:
        """Loads selected party into form for editing"""
        row = index.row()
        code_item = self.table.item(row, 0)
        if not code_item:
            return
            
        parties, _ = self.controller.list_parties(active_only=False)
        party = next((p for p in parties if p.code == code_item.text()), None)
        
        if party:
            self._selected_party_id = party.id
            self.code_input.setText(party.code)  # ← Shows but can't edit
            self.name_input.setText(party.name)
            self.type_input.setCurrentText(party.party_type.value)
            self.type_input.setEnabled(False)  # Type can't change once created
            self.credit_input.setText(str(party.credit_limit))
            self.account_input.setText(str(party.account_id or ""))
            self.save_button.setText("Update")
            self.edit_button.setEnabled(True)
            self.delete_button.setEnabled(True)

    def _clear_form(self) -> None:
        """Resets form to default state"""
        self.code_input.clear()
        self.code_input.setPlaceholderText("Auto-generated on save")
        self.name_input.clear()
        self.type_input.setCurrentIndex(0)
        self.type_input.setEnabled(True)
        self.credit_input.setText("0")
        self.account_input.clear()
        self.save_button.setText("Save")
        self._selected_party_id = None
        self.edit_button.setEnabled(False)
        self.delete_button.setEnabled(False)
        self.name_input.setFocus()  # ← Focus on name, not code

# views/widgets/party_view.py

    def _on_save_clicked(self) -> None:
        """Handles save/update button click"""
        name = self.name_input.text().strip()
        party_type_value = self.type_input.currentData()
        
        try:
            credit_limit = float(self.credit_input.text() or "0")
        except ValueError:
            QMessageBox.warning(self, "Input Error", "Credit limit must be a number.")
            return
            
        account_code = self.account_input.text().strip()
        account_id = None
        if account_code:
            # TODO: Replace with proper account lookup when needed
            pass

        if self._selected_party_id is None:
            from models.enums import PartyType
            party_type = PartyType(party_type_value)
            
            # ✅ DO NOT send code - it will be auto-generated!
            success, error = self.controller.create_party(
                name=name,
                party_type=party_type,
                credit_limit=credit_limit,
                account_id=account_id,
                # code is NOT sent here - auto-generated!
            )
            if success:
                self._load_parties()
                self._clear_form()
                QMessageBox.information(self, "Success", 
                    "Party created successfully! Code was auto-generated.")
            else:
                QMessageBox.warning(self, "Creation Failed", error)
        else:
            # Update existing party
            success, error = self.controller.update_party(
                party_id=self._selected_party_id,
                name=name,
                credit_limit=credit_limit,
                account_id=account_id,
                is_active=True,
            )
            if success:
                self._load_parties()
                self._clear_form()
            else:
                QMessageBox.warning(self, "Update Failed", error)
        
        invalidate_db_cache()  # Clear all cache
    # ← NEW METHODS ADDED HERE
    def _on_edit_clicked(self) -> None:
        """Handles explicit edit button click"""
        if self._selected_party_id is not None:
            # Simulate table click to populate form
            items = self.table.selectedItems()
            if items:
                row = items[0].row()
                index = self.table.model().index(row, 0)
                self._on_table_clicked(index)

    def _on_delete_clicked(self) -> None:
        """Handles delete button click with confirmation"""
        if self._selected_party_id is None:
            QMessageBox.warning(self, "Selection Error", "Please select a party to delete.")
            return

        reply = QMessageBox.question(
            self, 
            "Confirm Delete", 
            f"Are you sure you want to deactivate party '{self.code_input.text()}'?\n\n"
            "This will soft-delete the party (preserving transaction history).",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )

        if reply == QMessageBox.Yes:
            success, error = self.controller.deactivate_party(self._selected_party_id)
            if success:
                self.party_deleted.emit(self._selected_party_id)
                self._load_parties()
                self._clear_form()
            else:
                QMessageBox.warning(self, "Delete Failed", error)
        invalidate_db_cache()  #
    # ← END NEW METHODS

    # ← CHANGED: Method renamed from _on_clear_clicked to _on_add_clicked
    def _on_add_clicked(self) -> None:
        """Clears form for adding a new entry"""
        self._clear_form()
        # Enable fields for new entry
        self.code_input.setEnabled(True)
        self.type_input.setEnabled(True)
    # ← END CHANGED

