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
from controllers.item_controller import ItemController
from config.app_config import get_config
from models.item import Item
from utils.logger import get_logger
from utils.helpers import fetch_all_items_with_stock, format_currency

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
            # Use centralized helper function for consistency
            from utils.helpers import fetch_all_items_with_stock
            
            logger.debug(f"StockLoadThread: Fetching stock for item_ids={self.item_ids}")
            logger.debug(f"StockLoadThread: item_ids types={[type(x) for x in self.item_ids]}")
            
            # Fetch all items with stock in one optimized query
            items = fetch_all_items_with_stock(
                db=self.controller.service.repo.db,
                company_id=1,
                include_inactive=False
            )
            
            logger.debug(f"StockLoadThread: fetch_all_items_with_stock returned {len(items)} items")
            for item in items:
                logger.debug(f"  Item {item['id']}: {item['name']} - stock_qty={item.get('stock_qty', 0)}")
            
            # Build stock map for requested item IDs only
            stocks = {}
            # Convert item_ids to set of ints for faster lookup
            requested_ids = set(int(x) for x in self.item_ids)
            logger.debug(f"StockLoadThread: requested_ids={requested_ids}")
            
            for item in items:
                item_id = int(item['id'])
                if item_id in requested_ids:
                    stock_val = float(item.get('stock_qty', 0) or 0)
                    stocks[item_id] = stock_val
                    logger.debug(f"StockLoadThread: Added item {item_id} to stocks map with value {stock_val}")
            
            # Ensure all requested item_ids have an entry (even if 0)
            for item_id in requested_ids:
                if item_id not in stocks:
                    stocks[item_id] = 0.0
                    logger.debug(f"StockLoadThread: Item {item_id} not in results, setting stock to 0.0")
            
            logger.info(f"Loaded stocks for {len(stocks)} items using helper: {stocks}")
            self.stocks_loaded.emit(stocks)
            
        except Exception as e:
            logger.exception(f"Error in stock load thread: {e}")
            self.stocks_loaded.emit({})


class ItemSaveThread(QThread):
    """Background thread for saving/creating items."""
    
    save_completed = Signal(bool, str, object)  # success, error_message, item_or_none
    
    def __init__(self, controller, is_update=False, **kwargs):
        super().__init__()
        self.controller = controller
        self.is_update = is_update
        self.kwargs = kwargs
        # Ensure thread cleans up properly after finishing
        self.finished.connect(self.deleteLater)
    
    def run(self):
        try:
            if self.is_update:
                success, error = self.controller.update_item(**self.kwargs)
                self.save_completed.emit(success, error or "", None)
            else:
                success, error = self.controller.create_item(**self.kwargs)
                # For create, we don't pass the item back since controller doesn't return it
                self.save_completed.emit(success, error or "", None)
        except Exception as e:
            logger.exception(f"Error in item save thread: {e}")
            self.save_completed.emit(False, str(e), None)


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
        self._stocks_loaded = False  # Track if stock loading has completed
        self._load_thread = None
        self._stock_thread = None
        self._save_threads = []  # Keep strong references to prevent GC crash
        self._is_saving = False
        self._is_loaded = False  # Track if initial data load has completed
        self._build_ui()
        # Don't load immediately - wait for showEvent

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
        """Handles save/update button click - runs in background thread."""
        # Prevent multiple saves at once
        if self._is_saving:
            logger.warning("Save operation already in progress")
            return
        
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

        # Disable save button briefly (1 sec max), but keep form active for continuous entry
        self._set_save_enabled(False)
        
        if self._selected_item_id is None:
            # ✅ Create new item - code is AUTO-GENERATED
            save_thread = ItemSaveThread(
                self.controller,
                is_update=False,
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
        else:
            # Update existing item
            save_thread = ItemSaveThread(
                self.controller,
                is_update=True,
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
        
        save_thread.save_completed.connect(self._on_save_completed)
        # Keep reference in list to prevent garbage collection during rapid saves
        self._save_threads.append(save_thread)
        # Clean up reference when thread finishes
        save_thread.finished.connect(lambda: self._cleanup_save_thread(save_thread))
        save_thread.start()
    
    def _cleanup_save_thread(self, thread):
        """Remove finished thread from references list."""
        if thread in self._save_threads:
            self._save_threads.remove(thread)
    
    def _set_save_enabled(self, enabled: bool):
        """Disable save button briefly (1 sec max) to prevent double-clicks, but keep form active."""
        self._is_saving = not enabled
        self.save_button.setEnabled(enabled)
        
        if not enabled:
            original_text = "Save" if self._selected_item_id is None else "Update"
            self.save_button.setText("⏳ Saving...")
            # Re-enable after 1 second max so user can continue working
            QTimer.singleShot(1000, lambda: self._restore_save_button(original_text))
    
    def _restore_save_button(self, original_text: str):
        """Restore save button text and enable it after brief delay."""
        self.save_button.setText(original_text)
        self.save_button.setEnabled(True)
        self._is_saving = False
    
    def _on_save_completed(self, success: bool, error: str, item):
        """Handle save completion from background thread."""
        # Button auto-enables after 1 sec, but ensure correct text
        original_text = "Save" if self._selected_item_id is None else "Update"
        if "⏳" in self.save_button.text():
            self.save_button.setText(original_text)
        # If save finished before timeout, ensure button is enabled
        if not self.save_button.isEnabled():
            self.save_button.setEnabled(True)
            self._is_saving = False
        
        if success:
            if self._selected_item_id is None:
                # For new items, clear form immediately for fast entry
                # This clears the form right after the auto-generated code message
                self._clear_form()
                self.name_input.setFocus()
            else:
                # For updates, show confirmation and clear selection
                self._clear_form()
                QMessageBox.information(self, "Success", "Item updated successfully!")
        else:
            # On error, also ensure button is re-enabled immediately
            self.save_button.setEnabled(True)
            self._is_saving = False
            self.save_button.setText(original_text)
            QMessageBox.warning(self, "Operation Failed", error or "An error occurred.")

    # Add this temporary method to add test stock
    def _add_test_stock(self):
        """Add test stock batches for items"""
        try:
            # Get first item
            items, _ = self.controller.list_items(active_only=False)
            if not items:
                return
                
            # Add stock batch for first item
            self.controller.service.repo.db.execute("""
                INSERT INTO stock_batches 
                (item_id, warehouse_id, batch_number, quantity_in_stock, is_active)
                VALUES (?, 1, 'TEST001', 100, 1)
            """, (items[0].id,))
            
            # Add stock batch for second item
            if len(items) > 1:
                self.controller.service.repo.db.execute("""
                    INSERT INTO stock_batches 
                    (item_id, warehouse_id, batch_number, quantity_in_stock, is_active)
                    VALUES (?, 1, 'TEST002', 50, 1)
                """, (items[1].id,))
                
            logger.info("Test stock added successfully")
            # DO NOT auto-refresh - user must press Refresh button manually
            
        except Exception as e:
            logger.error(f"Error adding test stock: {e}")


    def showEvent(self, event):
        """Called when the widget is shown - lazy load data."""
        """Debug method to check stock query"""
        try:
            # Check if stock_batches table has data
            count = self.controller.service.repo.db.fetch_one("""
                SELECT COUNT(*) as count FROM stock_batches
            """)
            logger.info(f"Total stock batches: {count['count'] if count else 0}")
            
            # Check for any stock data
            sample = self.controller.service.repo.db.fetch_one("""
                SELECT * FROM stock_batches LIMIT 5
            """)
            logger.info(f"Sample stock: {sample}")
            
        except Exception as e:
            logger.error(f"Debug error: {e}")
        super().showEvent(event)
        if not self._is_loaded:
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
        
        # Reset flags for fresh load
        self._stocks_loaded = False
        self._stocks_cache = {}
        
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
            # No items, mark as loaded and populate empty table
            self._stocks_loaded = True
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
        self._stocks_loaded = True
        self._populate_table()
    
    def _populate_table(self):
        """Populate the table with cached data."""
        items = self._items_cache
        
        # Check if we have stock data loaded (even if empty dict means no stock batches exist)
        has_stock_data = hasattr(self, '_stocks_loaded') and self._stocks_loaded
        
        # Use the pre-loaded stocks cache instead of querying synchronously
        stock_map = self._stocks_cache if self._stocks_cache else {}
        
        if not has_stock_data and items:
            # If stocks weren't loaded yet, show placeholder and trigger async load
            self.table.setRowCount(len(items))
            self.table.setColumnCount(10)
            self.table.setHorizontalHeaderLabels([
                "Code", "Name", "Notes", "Unit", "Purchase Price", 
                "Selling Price", "Current Stock", "Min Stock", "Max Stock", "Tax Rate"
            ])
            for row, item in enumerate(items):
                self.table.setItem(row, 0, QTableWidgetItem(item.item_code))
                self.table.setItem(row, 1, QTableWidgetItem(item.item_name))
                self.table.setItem(row, 2, QTableWidgetItem(item.notes or ""))
                self.table.setItem(row, 3, QTableWidgetItem(item.unit))
                self.table.setItem(row, 4, QTableWidgetItem(f"{item.purchase_price:.2f}"))
                self.table.setItem(row, 5, QTableWidgetItem(f"{item.selling_price:.2f}"))
                self.table.setItem(row, 6, QTableWidgetItem("..."))
                self.table.setItem(row, 7, QTableWidgetItem(f"{item.minimum_stock:.2f}"))
                self.table.setItem(row, 8, QTableWidgetItem(f"{item.maximum_stock:.2f}"))
                tax_rate_name = "None"
                if item.tax_rate_id:
                    tax_rate_name = f"ID:{item.tax_rate_id}"
                self.table.setItem(row, 9, QTableWidgetItem(tax_rate_name))
            self.table.resizeColumnsToContents()
            # Trigger stock load if not already done
            item_ids = [item.id for item in items]
            self._load_stocks_async(item_ids)
            return
        
        logger.info(f"Loaded stock for {len(stock_map)} items: {stock_map}")

        self.table.setRowCount(len(items))
        self.table.setColumnCount(10)
        self.table.setHorizontalHeaderLabels([
            "Code", "Name", "Notes", "Unit", "Purchase Price", 
            "Selling Price", "Current Stock", "Min Stock", "Max Stock", "Tax Rate"
        ])

        for row, item in enumerate(items):
            # Debug: Log item.id type and value
            logger.debug(f"Row {row}: item.id={item.id} (type={type(item.id)}), looking up in stock_map keys={list(stock_map.keys())}")
            
            # Try both int and string lookup to handle type mismatches
            current_stock = stock_map.get(item.id, stock_map.get(str(item.id), stock_map.get(int(item.id), 0.0)))
            
            logger.debug(f"Row {row}: current_stock={current_stock}")

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
            
            # Fix: Use findData instead of setCurrentText for item_type
            # because setCurrentText looks for display text, not data value
            item_type_idx = self.item_type_input.findData(item.item_type)
            if item_type_idx >= 0:
                self.item_type_input.setCurrentIndex(item_type_idx)
            
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
                # DO NOT auto-refresh - user must press Refresh button manually
                self._clear_form()
            else:
                QMessageBox.warning(self, "Delete Failed", error)

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

    def keyPressEvent(self, event):
        """Handle Enter key to save when creating new items."""
        if event.key() == Qt.Key_Return or event.key() == Qt.Key_Enter:
            # Only trigger save on Enter when creating (not updating) and not already saving
            if self._selected_item_id is None and not self._is_saving:
                self._on_save_clicked()
            else:
                # For other cases, pass the event to parent class
                super().keyPressEvent(event)
        else:
            super().keyPressEvent(event)
