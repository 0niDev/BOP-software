"""Item management widget - matches your actual schema exactly."""
from __future__ import annotations

from PySide6.QtCore import Qt, Signal, QThread, QTimer
from PySide6.QtGui import QFont
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
from controllers.item_controller import ItemController
from config.app_config import get_config
from models.item import Item
from utils.logger import get_logger

logger = get_logger(__name__)


class ItemLoadThread(QThread):
    """Background thread for loading items."""
    
    data_loaded = Signal(list, str)  # items, error
    
    def __init__(self, controller, active_only=True):
        super().__init__()
        self.controller = controller
        self.active_only = active_only
    
    def run(self):
        try:
            items, error = self.controller.list_items(active_only=self.active_only)
            self.data_loaded.emit(items or [], error or "")
        except Exception as e:
            logger.exception(f"Error in item load thread: {e}")
            self.data_loaded.emit([], str(e))


class StockLoadThread(QThread):
    """Background thread for loading stock for multiple items."""
    
    stocks_loaded = Signal(dict)  # item_id -> stock
    
    def __init__(self, controller, item_ids):
        super().__init__()
        self.controller = controller
        self.item_ids = item_ids
    
    def run(self):
        try:
            stocks = {}
            for item_id in self.item_ids:
                stock_result = self.controller.service.repo.db.fetch_one("""
                    SELECT COALESCE(SUM(quantity_in_stock), 0) as total
                    FROM stock_batches
                    WHERE item_id = ? AND is_active = 1
                """, (item_id,))
                stocks[item_id] = stock_result["total"] if stock_result else 0
            self.stocks_loaded.emit(stocks)
        except Exception as e:
            logger.exception(f"Error in stock load thread: {e}")
            self.stocks_loaded.emit({})


class ItemView(QWidget):
    """Widget for managing items (products)."""
    
    item_created = Signal(Item)
    item_updated = Signal(Item)
    item_deleted = Signal(int)  # Emits item ID on deletion

    def __init__(self, item_controller: ItemController | None = None, parent=None):
        super().__init__(parent)
        self.controller = item_controller or ItemController()
        self._selected_item_id: int | None = None
        self._items_cache = []
        self._stocks_cache = {}
        self._load_thread = None
        self._stock_thread = None
        self._build_ui()
        # Don't load immediately - wait for showEvent
    # views/widgets/item_view.py - Update the form and save logic

    def _build_ui(self) -> None:
        """Builds the UI - matches your actual items table schema"""
        layout = QVBoxLayout(self)
        layout.setSpacing(10)

        # -- Search and filter controls -----------------------------------------
        controls_layout = QHBoxLayout()
        
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Search by name or code...")
        self.search_input.textChanged.connect(self._on_search_changed)
        controls_layout.addWidget(self.search_input, stretch=2)

        self.refresh_btn = QPushButton("Refresh")
        self.refresh_btn.setFixedWidth(100)
        self.refresh_btn.clicked.connect(self._load_items_async)
        controls_layout.addWidget(self.refresh_btn)

        layout.addLayout(controls_layout)

        # -- Item table ---------------------------------------------------------
        self.table = QTableWidget()
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.setSelectionMode(QTableWidget.SingleSelection)
        self.table.clicked.connect(self._on_table_clicked)
        layout.addWidget(self.table, stretch=1)

        # -- Form for add/edit ---------------------------------------------------
        form_group = QGroupBox("Item Details")
        form_layout = QFormLayout(form_group)

        # ✅ Make code read-only (auto-generated)
        self.code_input = QLineEdit()
        self.code_input.setPlaceholderText("Auto-generated on save")
        self.code_input.setReadOnly(True)
        self.code_input.setStyleSheet("background: #f0f0f0; color: #666;")
        form_layout.addRow("Code:", self.code_input)

        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("Full item name")
        form_layout.addRow("Name*:", self.name_input)

        self.notes_input = QLineEdit()
        self.notes_input.setPlaceholderText("Optional notes")
        form_layout.addRow("Notes:", self.notes_input)

        self.unit_input = QComboBox()
        self.unit_input.addItem("TABLET", "TABLET")
        self.unit_input.addItem("CAPSULE", "CAPSULE")
        self.unit_input.addItem("ML", "ML")
        self.unit_input.addItem("GRAM", "GRAM")
        self.unit_input.addItem("KG", "KG")
        self.unit_input.addItem("UNIT", "UNIT")
        self.unit_input.addItem("VIAL", "VIAL")
        self.unit_input.addItem("AMPOULE", "AMPOULE")
        form_layout.addRow("Unit*:", self.unit_input)

        self.purchase_price_input = QLineEdit()
        self.purchase_price_input.setPlaceholderText("0.00")
        form_layout.addRow("Purchase Price:", self.purchase_price_input)

        self.selling_price_input = QLineEdit()
        self.selling_price_input.setPlaceholderText("0.00")
        form_layout.addRow("Selling Price:", self.selling_price_input)

        self.min_stock_input = QLineEdit()
        self.min_stock_input.setPlaceholderText("0")
        form_layout.addRow("Minimum Stock:", self.min_stock_input)

        self.max_stock_input = QLineEdit()
        self.max_stock_input.setPlaceholderText("0")
        form_layout.addRow("Maximum Stock:", self.max_stock_input)

        self.tax_rate_input = QComboBox()
        self.tax_rate_input.addItem("None", None)
        form_layout.addRow("Tax Rate:", self.tax_rate_input)

        self.item_type_input = QComboBox()
        self.item_type_input.addItem("Raw Material", "RAW_MATERIAL")
        self.item_type_input.addItem("Packing Material", "PACKING_MATERIAL")
        self.item_type_input.addItem("Finished Good", "FINISHED_GOOD")
        form_layout.addRow("Item Type*:", self.item_type_input)

        self.category_input = QComboBox()
        self.category_input.addItem("None", None)
        form_layout.addRow("Category:", self.category_input)

        button_layout = QHBoxLayout()
        self.save_button = QPushButton("Save")
        self.save_button.clicked.connect(self._on_save_clicked)
        self.clear_button = QPushButton("Add")
        self.clear_button.clicked.connect(self._on_add_clicked)
        
        self.edit_button = QPushButton("Edit")
        self.edit_button.clicked.connect(self._on_edit_clicked)
        self.edit_button.setEnabled(False)
        
        self.delete_button = QPushButton("Delete")
        self.delete_button.clicked.connect(self._on_delete_clicked)
        self.delete_button.setEnabled(False)
        
        button_layout.addWidget(self.save_button)
        button_layout.addWidget(self.clear_button)
        button_layout.addWidget(self.edit_button)
        button_layout.addWidget(self.delete_button)
        
        form_layout.addRow(button_layout)

        layout.addWidget(form_group)


    def _on_save_clicked(self) -> None:
        """Handles save/update button click"""
        # ✅ Code is auto-generated - no need to validate it
        item_name = self.name_input.text().strip()
        notes = self.notes_input.text().strip() or None
        unit = self.unit_input.currentData()
           
        try:
            purchase_price = float(self.purchase_price_input.text() or "0")
        except ValueError:
            QMessageBox.warning(self, "Input Error", "Purchase price must be a number.")
            return
            
        try:
            selling_price = float(self.selling_price_input.text() or "0")
        except ValueError:
            QMessageBox.warning(self, "Input Error", "Selling price must be a number.")
            return
            
        try:
            minimum_stock = float(self.min_stock_input.text() or "0")
        except ValueError:
            QMessageBox.warning(self, "Input Error", "Minimum stock must be a number.")
            return
            
        try:
            maximum_stock = float(self.max_stock_input.text() or "0")
        except ValueError:
            QMessageBox.warning(self, "Input Error", "Maximum stock must be a number.")
            return
            
        tax_rate_id = self.tax_rate_input.currentData()
        item_type = self.item_type_input.currentData()
        category_id = self.category_input.currentData()

        if self._selected_item_id is None:
            # ✅ Create new item - code is AUTO-GENERATED
            success, error = self.controller.create_item(
                # item_code is NOT sent - auto-generated!
                item_name=item_name,
                notes=notes,
                unit=unit,
                purchase_price=purchase_price,
                selling_price=selling_price,
                minimum_stock=minimum_stock,
                maximum_stock=maximum_stock,
                tax_rate_id=tax_rate_id,
                item_type=item_type,
                category_id=category_id,
            )
            if success:
                self._load_items()
                self._clear_form()
                QMessageBox.information(self, "Success", 
                    "Item created successfully! Code was auto-generated.")
            else:
                QMessageBox.warning(self, "Creation Failed", error)
        else:
            # Update existing item
            success, error = self.controller.update_item(
                item_id=self._selected_item_id,
                item_name=item_name,
                notes=notes,
                unit=unit,
                purchase_price=purchase_price,
                selling_price=selling_price,
                minimum_stock=minimum_stock,
                maximum_stock=maximum_stock,
                tax_rate_id=tax_rate_id,
                item_type=item_type,
                category_id=category_id,
                is_active=True
            )
            if success:
                self._load_items()
                self._clear_form()
            else:
                QMessageBox.warning(self, "Update Failed", error)
        invalidate_db_cache()  #

    def showEvent(self, event):
        """Called when the widget is shown - lazy load data."""
        super().showEvent(event)
        if not hasattr(self, '_is_loaded') or not self._is_loaded:
            self._show_loading_state()
            QTimer.singleShot(50, self._load_items_async)

    def _show_loading_state(self):
        """Show loading state in the table."""
        self.table.setRowCount(1)
        self.table.setColumnCount(1)
        self.table.setHorizontalHeaderLabels(["Loading..."])
        loading_item = QTableWidgetItem("🔄 Loading items...")
        loading_item.setTextAlignment(Qt.AlignCenter)
        self.table.setItem(0, 0, loading_item)
        self.table.horizontalHeader().setStretchLastSection(True)
    
    def _load_items_async(self):
        """Load items asynchronously using background thread."""
        # Cancel previous thread if still running
        if self._load_thread and self._load_thread.isRunning():
            self._load_thread.terminate()
        
        self._load_thread = ItemLoadThread(self.controller, active_only=True)
        self._load_thread.data_loaded.connect(self._on_items_loaded)
        self._load_thread.start()
    
    def _load_items(self):
        """Synchronous wrapper for backward compatibility (e.g., refresh button)."""
        self._load_items_async()
    
    def _on_items_loaded(self, items, error):
        """Handle items loaded from background thread."""
        if error:
            QMessageBox.warning(self, "Load Error", error)
            return
        
        logger.info(f"Loaded {len(items)} items")
        self._items_cache = items
        
        # Now load stocks in background
        item_ids = [item.id for item in items]
        if item_ids:
            self._load_stocks_async(item_ids)
        else:
            self._populate_table()
    
    def _load_stocks_async(self, item_ids):
        """Load stock quantities asynchronously."""
        if self._stock_thread and self._stock_thread.isRunning():
            self._stock_thread.terminate()
        
        self._stock_thread = StockLoadThread(self.controller, item_ids)
        self._stock_thread.stocks_loaded.connect(self._on_stocks_loaded)
        self._stock_thread.start()
    
    def _on_stocks_loaded(self, stocks):
        """Handle stocks loaded from background thread."""
        self._stocks_cache = stocks
        self._populate_table()
    
    def _populate_table(self):
        """Populate the table with cached data."""
        items = self._items_cache
        stocks = self._stocks_cache
        
        self.table.setRowCount(len(items))
        self.table.setColumnCount(10)
        self.table.setHorizontalHeaderLabels([
            "Code", "Name", "Notes", "Unit", "Purchase Price", 
            "Selling Price", "Current Stock", "Min Stock", "Max Stock", "Tax Rate"
        ])
        
        for row, item in enumerate(items):
            current_stock = stocks.get(item.id, 0)
            
            self.table.setItem(row, 0, QTableWidgetItem(item.item_code))
            self.table.setItem(row, 1, QTableWidgetItem(item.item_name))
            self.table.setItem(row, 2, QTableWidgetItem(item.notes or ""))
            self.table.setItem(row, 3, QTableWidgetItem(item.unit))
            self.table.setItem(row, 4, QTableWidgetItem(f"{item.purchase_price:.2f}"))
            self.table.setItem(row, 5, QTableWidgetItem(f"{item.selling_price:.2f}"))
            self.table.setItem(row, 6, QTableWidgetItem(f"{current_stock:.2f}"))
            self.table.setItem(row, 7, QTableWidgetItem(f"{item.minimum_stock:.2f}"))
            self.table.setItem(row, 8, QTableWidgetItem(f"{item.maximum_stock:.2f}"))
            
            tax_rate_name = "None"
            if item.tax_rate_id:
                tax_rate_name = f"ID:{item.tax_rate_id}"
            self.table.setItem(row, 9, QTableWidgetItem(tax_rate_name))
        
        self.table.resizeColumnsToContents()
        self._selected_item_id = None
        self._clear_form()
        self._populate_dropdowns()
        self._is_loaded = True

    def _populate_dropdowns(self) -> None:
        """Populates tax rates and categories dropdowns"""
        tax_rates, error = self.controller.get_tax_rates_for_dropdown()
        if error:
            QMessageBox.warning(self, "Load Error", error)
            return
            
        # Populate tax rates
        self.tax_rate_input.clear()
        self.tax_rate_input.addItem("None", None)
        for tr in tax_rates:
            if tr["tax_type"] == "SALES_TAX":
                self.tax_rate_input.addItem(
                    f"{tr['name']} ({tr['rate_percent']}%)", 
                    tr["id"]
                )
        
        # Populate categories
        self.category_input.clear()
        self.category_input.addItem("None", None)

    def _on_search_changed(self, text: str) -> None:
        """Filters table based on search text"""
        for row in range(self.table.rowCount()):
            matches = False
            for col in [0, 1]:
                item = self.table.item(row, col)
                if item and text.lower() in item.text().lower():
                    matches = True
                    break
            self.table.setRowHidden(row, not matches)

    def _on_table_clicked(self, index) -> None:
        """Loads selected item into form for editing"""
        row = index.row()
        code_item = self.table.item(row, 0)
        if not code_item:
            return
            
        items, _ = self.controller.list_items(active_only=False)
        item = next((i for i in items if i.item_code == code_item.text()), None)
        
        if item:
            self._selected_item_id = item.id
            self.code_input.setText(item.item_code)
            self.name_input.setText(item.item_name)
            self.notes_input.setText(item.notes or "")
            self.unit_input.setCurrentText(item.unit)
            self.purchase_price_input.setText(f"{item.purchase_price:.2f}")
            self.selling_price_input.setText(f"{item.selling_price:.2f}")
            self.min_stock_input.setText(f"{item.minimum_stock:.2f}")
            self.max_stock_input.setText(f"{item.maximum_stock:.2f}")
            
            if item.tax_rate_id:
                index = self.tax_rate_input.findData(item.tax_rate_id)
                if index >= 0:
                    self.tax_rate_input.setCurrentIndex(index)
            
            self.item_type_input.setCurrentText(item.item_type)
            
            if item.category_id:
                index = self.category_input.findData(item.category_id)
                if index >= 0:
                    self.category_input.setCurrentIndex(index)
            
            self.save_button.setText("Update")
            self.edit_button.setEnabled(True)
            self.delete_button.setEnabled(True)

    def _on_edit_clicked(self) -> None:
        """Handles explicit edit button click"""
        if self._selected_item_id is not None:
            items = self.table.selectedItems()
            if items:
                row = items[0].row()
                index = self.table.model().index(row, 0)
                self._on_table_clicked(index)

    def _on_delete_clicked(self) -> None:
        """Handles delete button click with confirmation"""
        if self._selected_item_id is None:
            QMessageBox.warning(self, "Selection Error", "Please select an item to delete.")
            return

        reply = QMessageBox.question(
            self, 
            "Confirm Delete", 
            f"Are you sure you want to deactivate item '{self.code_input.text()}'?\n\n"
            "This will soft-delete the item (preserving transaction history).",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )

        if reply == QMessageBox.Yes:
            success, error = self.controller.deactivate_item(self._selected_item_id)
            if success:
                self.item_deleted.emit(self._selected_item_id)
                self._load_items()
                self._clear_form()
            else:
                QMessageBox.warning(self, "Delete Failed", error)
        invalidate_db_cache()  #
    def _on_add_clicked(self) -> None:
        """Clears form for adding a new entry"""
        self._clear_form()
        self._populate_dropdowns()

    def _clear_form(self) -> None:
        """Resets form to default state"""
        self.code_input.clear()
        self.name_input.clear()
        self.notes_input.clear()
        self.unit_input.setCurrentIndex(0)
        self.purchase_price_input.setText("0")
        self.selling_price_input.setText("0")
        self.min_stock_input.setText("0")
        self.max_stock_input.setText("0")
        self.tax_rate_input.setCurrentIndex(0)
        self.item_type_input.setCurrentIndex(2)
        self.category_input.setCurrentIndex(0)
        self.save_button.setText("Save")
        self._selected_item_id = None
        
        self.edit_button.setEnabled(False)
        self.delete_button.setEnabled(False)
        
        self.code_input.setFocus()