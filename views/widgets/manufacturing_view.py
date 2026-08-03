"""Manufacturing management widget - BOM and Production Orders."""
from __future__ import annotations

from PySide6.QtCore import Qt, Signal, QDate, QThread, QObject, QTimer
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
    QTabWidget,
    QSpinBox,
)

from controllers.manufacturing_controller import ManufacturingController
from controllers.item_controller import ItemController
from models.bill_of_materials import BillOfMaterials
from models.production_order import ProductionOrder
from utils.logger import get_logger

logger = get_logger(__name__)


class ManufacturingDataLoader(QObject):
    """Background worker for loading manufacturing data."""
    data_loaded = Signal(dict)
    error_occurred = Signal(str)
    
    def __init__(self, controller, item_controller):
        super().__init__()
        self.controller = controller
        self.item_controller = item_controller
    
    def run(self):
        """Load all manufacturing data in background."""
        try:
            # Load BOMs
            boms, bom_error = self.controller.list_boms(active_only=None)
            if bom_error:
                self.error_occurred.emit(f"BOMs: {bom_error}")
                return
            
            # Load production orders
            orders, order_error = self.controller.list_production_orders(status=None)
            if order_error:
                self.error_occurred.emit(f"Orders: {order_error}")
                return
            
            # Load items for lookups
            items, item_error = self.item_controller.list_items(active_only=False)
            if item_error:
                logger.warning(f"Could not load items: {item_error}")
                items = []
            
            self.data_loaded.emit({
                'boms': boms,
                'orders': orders,
                'items': items
            })
        except Exception as e:
            self.error_occurred.emit(str(e))

# views/widgets/manufacturing_view.py - BOMDialog

class BOMDialog(QDialog):
    """Dialog for creating/editing a Bill of Materials."""
    
    def __init__(self, item_controller: ItemController, bom: BillOfMaterials | None = None, parent=None):
        super().__init__(parent)
        self.item_controller = item_controller
        self.bom = bom
        self.components: list[dict] = []
        self.setWindowTitle("Edit BOM" if bom else "New Bill of Materials")
        self.setModal(True)
        self.resize(600, 500)
        self._setup_ui()
        self._load_items()
        if bom:
            self._load_bom_data()

    def _setup_ui(self) -> None:
        layout = QVBoxLayout(self)
        
        # Main form
        form_group = QGroupBox("BOM Details")
        form_layout = QFormLayout(form_group)
        
        # ✅ BOM Name - Auto-generated, read-only
        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("Auto-generated on save")
        self.name_input.setReadOnly(True)
        self.name_input.setStyleSheet("background: #f0f0f0; color: #666;")
        form_layout.addRow("BOM Name:", self.name_input)
        
        self.finished_item_combo = QComboBox()
        self.finished_item_combo.addItem("Select Finished Item", None)
        form_layout.addRow("Finished Item*:", self.finished_item_combo)
        
        self.output_quantity_spin = QDoubleSpinBox()
        self.output_quantity_spin.setMinimum(0.01)
        self.output_quantity_spin.setMaximum(999999.99)
        self.output_quantity_spin.setValue(1.0)
        self.output_quantity_spin.setDecimals(2)
        form_layout.addRow("Output Quantity*:", self.output_quantity_spin)
        
        self.notes_input = QLineEdit()
        self.notes_input.setPlaceholderText("Optional notes")
        form_layout.addRow("Notes:", self.notes_input)
        
        layout.addWidget(form_group)
        
        # Components section (same as before)
        comp_group = QGroupBox("Components")
        comp_layout = QVBoxLayout(comp_group)
        
        self.components_table = QTableWidget()
        self.components_table.setColumnCount(4)
        self.components_table.setHorizontalHeaderLabels([
            "Component", "Quantity Required", "Wastage %", "Action"
        ])
        self.components_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        comp_layout.addWidget(self.components_table)
        
        # Add component controls (same as before)
        comp_controls = QHBoxLayout()
        
        self.component_item_combo = QComboBox()
        self.component_item_combo.setMinimumWidth(200)
        self.component_item_combo.addItem("Select Component", None)
        comp_controls.addWidget(self.component_item_combo)
        
        self.component_qty_spin = QDoubleSpinBox()
        self.component_qty_spin.setMinimum(0.01)
        self.component_qty_spin.setMaximum(999999.99)
        self.component_qty_spin.setValue(1.0)
        self.component_qty_spin.setDecimals(2)
        self.component_qty_spin.setPrefix("Qty: ")
        comp_controls.addWidget(self.component_qty_spin)
        
        self.component_wastage_spin = QDoubleSpinBox()
        self.component_wastage_spin.setMinimum(0)
        self.component_wastage_spin.setMaximum(100)
        self.component_wastage_spin.setValue(0)
        self.component_wastage_spin.setDecimals(1)
        self.component_wastage_spin.setPrefix("Waste: ")
        self.component_wastage_spin.setSuffix("%")
        comp_controls.addWidget(self.component_wastage_spin)
        
        self.add_component_btn = QPushButton("Add Component")
        self.add_component_btn.clicked.connect(self._on_add_component)
        comp_controls.addWidget(self.add_component_btn)
        
        comp_layout.addLayout(comp_controls)
        layout.addWidget(comp_group)
        
        # Buttons
        button_box = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel,
            Qt.Horizontal, self
        )
        button_box.accepted.connect(self.accept)
        button_box.rejected.connect(self.reject)
        layout.addWidget(button_box)

    def _load_bom_data(self) -> None:
        """Load BOM data for editing."""
        if self.bom:
            self.name_input.setText(self.bom.bom_name)  # Show the auto-generated name
            self.output_quantity_spin.setValue(self.bom.output_quantity)
            self.notes_input.setText(self.bom.notes or "")
            
            # Set finished item
            idx = self.finished_item_combo.findData(self.bom.finished_item_id)
            if idx >= 0:
                self.finished_item_combo.setCurrentIndex(idx)
            
            # Load components
            self.components = []
            for comp in self.bom.components:
                self.components.append({
                    "component_item_id": comp.component_item_id,
                    "quantity_required": comp.quantity_required,
                    "wastage_percent": comp.wastage_percent,
                })
            self._update_components_table()

    def get_bom_data(self) -> dict | None:
        """Get BOM data from the dialog."""
        # ✅ BOM name is auto-generated - don't require it
        finished_item_id = self.finished_item_combo.currentData()
        if not finished_item_id:
            QMessageBox.warning(self, "Selection Error", "Please select a finished item.")
            return None
        
        if not self.components:
            QMessageBox.warning(self, "Component Error", "Please add at least one component.")
            return None
        
        return {
            "bom_name": None,  # ← Will auto-generate in service
            "finished_item_id": finished_item_id,
            "output_quantity": self.output_quantity_spin.value(),
            "components": self.components,
            "notes": self.notes_input.text().strip() or None,
        }
    def _load_items(self) -> None:
        """Load items into dropdowns."""
        items, error = self.item_controller.list_items(active_only=True)
        if error:
            QMessageBox.warning(self, "Load Error", error)
            return
        
        # DEBUG: Print all items
        print("\n" + "="*60)
        print("DEBUG: ALL ITEMS LOADED IN BOM DIALOG")
        print("="*60)
        for item in items:
            print(f"  {item.item_code:15} | {item.item_name[:30]:30} | {item.item_type}")
        print("="*60)
        
        # Finished items
        self.finished_item_combo.clear()
        self.finished_item_combo.addItem("Select Finished Item", None)
        finished_count = 0
        for item in items:
            if item.item_type == "FINISHED_GOOD":
                self.finished_item_combo.addItem(
                    f"{item.item_name} ({item.item_code})", item.id
                )
                finished_count += 1
                print(f"  ✅ Finished: {item.item_code}")
        
        # Component items (raw materials and packing materials)
        self.component_item_combo.clear()
        self.component_item_combo.addItem("Select Component", None)
        component_count = 0
        for item in items:
            if item.item_type in ["RAW_MATERIAL", "PACKING_MATERIAL"]:
                self.component_item_combo.addItem(
                    f"{item.item_name} ({item.item_code})", item.id
                )
                component_count += 1
                print(f"  ✅ Component: {item.item_code}")
        
        print(f"\n📊 Summary: {finished_count} finished, {component_count} components")
        print("="*60)

    def _on_add_component(self) -> None:
        """Add a component to the list."""
        item_id = self.component_item_combo.currentData()
        if not item_id:
            QMessageBox.warning(self, "Selection Error", "Please select a component item.")
            return
        
        quantity = self.component_qty_spin.value()
        if quantity <= 0:
            QMessageBox.warning(self, "Input Error", "Quantity must be greater than 0.")
            return
        
        wastage = self.component_wastage_spin.value()
        
        # Check for duplicate
        for comp in self.components:
            if comp["component_item_id"] == item_id:
                QMessageBox.warning(self, "Duplicate", "This component is already in the list.")
                return
        
        self.components.append({
            "component_item_id": item_id,
            "quantity_required": quantity,
            "wastage_percent": wastage,
        })
        self._update_components_table()
        
        # Reset inputs
        self.component_item_combo.setCurrentIndex(0)
        self.component_qty_spin.setValue(1.0)
        self.component_wastage_spin.setValue(0)

    def _update_components_table(self) -> None:
        """Update the components table."""
        self.components_table.setRowCount(len(self.components))
        
        for row, comp in enumerate(self.components):
            # Get item name
            item_name = "Unknown"
            for i in range(self.component_item_combo.count()):
                if self.component_item_combo.itemData(i) == comp["component_item_id"]:
                    item_name = self.component_item_combo.itemText(i)
                    break
            
            self.components_table.setItem(row, 0, QTableWidgetItem(item_name))
            self.components_table.setItem(row, 1, QTableWidgetItem(f"{comp['quantity_required']:.2f}"))
            self.components_table.setItem(row, 2, QTableWidgetItem(f"{comp['wastage_percent']:.1f}%"))
            
            # Remove button
            remove_btn = QPushButton("Remove")
            remove_btn.clicked.connect(lambda checked, r=row: self._remove_component(r))
            self.components_table.setCellWidget(row, 3, remove_btn)

    def _remove_component(self, row: int) -> None:
        """Remove a component from the list."""
        del self.components[row]
        self._update_components_table()



class ManufacturingView(QWidget):
    """Widget for managing manufacturing operations."""
    
    bom_created = Signal(BillOfMaterials)
    bom_updated = Signal(BillOfMaterials)
    order_created = Signal(ProductionOrder)
    order_completed = Signal(ProductionOrder)

    def __init__(self, 
                 manufacturing_controller: ManufacturingController | None = None,
                 item_controller: ItemController | None = None,
                 parent=None):
        super().__init__(parent)
        self.controller = manufacturing_controller or ManufacturingController()
        self.item_controller = item_controller or ItemController()
        self._selected_bom_id: int | None = None
        self._selected_order_id: int | None = None
        self._loader_thread = None
        self._data_cache = {}
        self._build_ui()
        # Don't load immediately - wait for showEvent

    def showEvent(self, event):
        """Called when the widget is shown (tab selected)."""
        super().showEvent(event)
        if not hasattr(self, '_is_loaded') or not self._is_loaded:
            self._show_loading_state()
            QTimer.singleShot(50, self._load_data_async)
    
    def _show_loading_state(self):
        """Show loading state in tables."""
        self.bom_table.setRowCount(1)
        self.bom_table.setColumnCount(1)
        self.bom_table.setHorizontalHeaderLabels(["Loading..."])
        loading_item = QTableWidgetItem("Loading BOMs...")
        loading_item.setTextAlignment(Qt.AlignCenter)
        self.bom_table.setItem(0, 0, loading_item)
        
        self.order_table.setRowCount(1)
        self.order_table.setColumnCount(1)
        self.order_table.setHorizontalHeaderLabels(["Loading..."])
        loading_item2 = QTableWidgetItem("Loading Production Orders...")
        loading_item2.setTextAlignment(Qt.AlignCenter)
        self.order_table.setItem(0, 0, loading_item2)
    
    def _load_data_async(self):
        """Load manufacturing data in background thread."""
        if hasattr(self, '_is_loaded') and self._is_loaded:
            return
        
        # Create worker
        self._loader_thread = QThread()
        self._worker = ManufacturingDataLoader(self.controller, self.item_controller)
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
        
        # Populate BOMs with cached items
        self._populate_boms(data['boms'], data['items'])
        
        # Populate production orders
        self._populate_orders(data['orders'])
        
        self._is_loaded = True
    
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

    def _build_ui(self) -> None:
        """Builds the UI."""
        layout = QVBoxLayout(self)
        layout.setSpacing(10)

        # Tabs for BOM and Production Orders
        self.tabs = QTabWidget()
        
        # Tab 1: Bill of Materials
        bom_tab = QWidget()
        bom_layout = QVBoxLayout(bom_tab)
        self._build_bom_tab(bom_layout)
        self.tabs.addTab(bom_tab, "Bill of Materials")
        
        # Tab 2: Production Orders
        order_tab = QWidget()
        order_layout = QVBoxLayout(order_tab)
        self._build_order_tab(order_layout)
        self.tabs.addTab(order_tab, "Production Orders")
        
        layout.addWidget(self.tabs)

    def _build_bom_tab(self, layout: QVBoxLayout) -> None:
        """Build the BOM tab."""
        # Controls
        controls_layout = QHBoxLayout()
        
        self.bom_search = QLineEdit()
        self.bom_search.setPlaceholderText("Search BOMs...")
        self.bom_search.textChanged.connect(self._on_bom_search)
        controls_layout.addWidget(self.bom_search)
        
        self.bom_active_filter = QComboBox()
        self.bom_active_filter.addItem("All", None)
        self.bom_active_filter.addItem("Active", True)
        self.bom_active_filter.addItem("Inactive", False)
        self.bom_active_filter.currentIndexChanged.connect(self._load_boms)
        controls_layout.addWidget(self.bom_active_filter)
        
        layout.addLayout(controls_layout)
        
        # BOM Table
        self.bom_table = QTableWidget()
        self.bom_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.bom_table.setSelectionMode(QTableWidget.SingleSelection)
        self.bom_table.clicked.connect(self._on_bom_table_clicked)
        layout.addWidget(self.bom_table, stretch=1)
        
        # BOM Buttons
        bom_buttons = QHBoxLayout()
        
        self.add_bom_btn = QPushButton("New BOM")
        self.add_bom_btn.clicked.connect(self._on_add_bom)
        bom_buttons.addWidget(self.add_bom_btn)
        
        self.edit_bom_btn = QPushButton("Edit BOM")
        self.edit_bom_btn.clicked.connect(self._on_edit_bom)
        self.edit_bom_btn.setEnabled(False)
        bom_buttons.addWidget(self.edit_bom_btn)
        
        self.delete_bom_btn = QPushButton("Delete BOM")
        self.delete_bom_btn.clicked.connect(self._on_delete_bom)
        self.delete_bom_btn.setEnabled(False)
        bom_buttons.addWidget(self.delete_bom_btn)
        
        layout.addLayout(bom_buttons)

    def _build_order_tab(self, layout: QVBoxLayout) -> None:
        """Build the Production Orders tab."""
        # Controls
        controls_layout = QHBoxLayout()
        
        self.order_search = QLineEdit()
        self.order_search.setPlaceholderText("Search orders...")
        self.order_search.textChanged.connect(self._on_order_search)
        controls_layout.addWidget(self.order_search)
        
        self.order_status_filter = QComboBox()
        self.order_status_filter.addItem("All", None)
        self.order_status_filter.addItem("Draft", "DRAFT")
        self.order_status_filter.addItem("In Progress", "IN_PROGRESS")
        self.order_status_filter.addItem("Completed", "COMPLETED")
        self.order_status_filter.addItem("Cancelled", "CANCELLED")
        self.order_status_filter.currentIndexChanged.connect(self._load_orders)
        controls_layout.addWidget(self.order_status_filter)
        
        layout.addLayout(controls_layout)
        
        # Order Table
        self.order_table = QTableWidget()
        self.order_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.order_table.setSelectionMode(QTableWidget.SingleSelection)
        self.order_table.clicked.connect(self._on_order_table_clicked)
        layout.addWidget(self.order_table, stretch=1)
        
        # Order Buttons
        order_buttons = QHBoxLayout()
        
        self.add_order_btn = QPushButton("New Order")
        self.add_order_btn.clicked.connect(self._on_add_order)
        order_buttons.addWidget(self.add_order_btn)
        
        self.start_order_btn = QPushButton("Start Production")
        self.start_order_btn.clicked.connect(self._on_start_order)
        self.start_order_btn.setEnabled(False)
        order_buttons.addWidget(self.start_order_btn)
        
        self.complete_order_btn = QPushButton("Complete")
        self.complete_order_btn.clicked.connect(self._on_complete_order)
        self.complete_order_btn.setEnabled(False)
        order_buttons.addWidget(self.complete_order_btn)
        
        self.cancel_order_btn = QPushButton("Cancel")
        self.cancel_order_btn.clicked.connect(self._on_cancel_order)
        self.cancel_order_btn.setEnabled(False)
        order_buttons.addWidget(self.cancel_order_btn)
        
        self.delete_order_btn = QPushButton("Delete")
        self.delete_order_btn.clicked.connect(self._on_delete_order)
        self.delete_order_btn.setEnabled(False)
        order_buttons.addWidget(self.delete_order_btn)
        
        layout.addLayout(order_buttons)

    # ===================================================================
    # BOM Methods
    # ===================================================================

    def _populate_boms(self, boms, items) -> None:
        """Populate BOMs table with cached items."""
        # Create item lookup dict
        item_dict = {i.id: i.item_name for i in items}
        
        self.bom_table.setRowCount(len(boms))
        self.bom_table.setColumnCount(5)
        self.bom_table.setHorizontalHeaderLabels([
            "Name", "Finished Item", "Output Qty", "Components", "Status"
        ])
        
        for row, bom in enumerate(boms):
            # Get finished item name from cache
            item_name = item_dict.get(bom.finished_item_id, "Unknown")
            
            self.bom_table.setItem(row, 0, QTableWidgetItem(bom.bom_name))
            self.bom_table.setItem(row, 1, QTableWidgetItem(item_name))
            self.bom_table.setItem(row, 2, QTableWidgetItem(f"{bom.output_quantity:.2f}"))
            self.bom_table.setItem(row, 3, QTableWidgetItem(str(len(bom.components))))
            self.bom_table.setItem(row, 4, QTableWidgetItem("Active" if bom.is_active else "Inactive"))
        
        self.bom_table.resizeColumnsToContents()
        self._selected_bom_id = None
        self.edit_bom_btn.setEnabled(False)
        self.delete_bom_btn.setEnabled(False)
    
    def _populate_orders(self, orders) -> None:
        """Populate production orders table."""
        self.order_table.setRowCount(len(orders))
        self.order_table.setColumnCount(7)
        self.order_table.setHorizontalHeaderLabels([
            "Order #", "BOM", "Planned", "Actual", "Status", "Date", "Batch"
        ])
        
        for row, order in enumerate(orders):
            # Get BOM name from bom_id
            bom, _ = self.controller.get_bom(order.bom_id)
            bom_name = bom.bom_name if bom else "-"
            
            self.order_table.setItem(row, 0, QTableWidgetItem(order.order_number))
            self.order_table.setItem(row, 1, QTableWidgetItem(bom_name))
            self.order_table.setItem(row, 2, QTableWidgetItem(f"{order.planned_quantity:.2f}"))
            self.order_table.setItem(row, 3, QTableWidgetItem(f"{order.actual_quantity:.2f}"))
            self.order_table.setItem(row, 4, QTableWidgetItem(order.status.replace("_", " ").title()))
            self.order_table.setItem(row, 5, QTableWidgetItem(order.manufacturing_date))
            self.order_table.setItem(row, 6, QTableWidgetItem(order.output_batch_number or "-"))
        
        self.order_table.resizeColumnsToContents()
        self._selected_order_id = None
        self.complete_order_btn.setEnabled(False)

    def _on_bom_search(self, text: str) -> None:
        """Filter BOM table."""
        for row in range(self.bom_table.rowCount()):
            matches = False
            item = self.bom_table.item(row, 0)
            if item and text.lower() in item.text().lower():
                matches = True
            self.bom_table.setRowHidden(row, not matches)
    
    def _load_boms(self) -> None:
        """Reload BOMs by restarting the async load."""
        self._is_loaded = False
        self._show_loading_state()
        QTimer.singleShot(50, self._load_data_async)

    def _on_bom_table_clicked(self, index) -> None:
        """Handle BOM table click."""
        row = index.row()
        name_item = self.bom_table.item(row, 0)
        if not name_item:
            return
        
        boms, _ = self.controller.list_boms(active_only=None)
        bom = next((b for b in boms if b.bom_name == name_item.text()), None)
        
        if bom:
            self._selected_bom_id = bom.id
            self.edit_bom_btn.setEnabled(True)
            self.delete_bom_btn.setEnabled(True)

    def _on_add_bom(self) -> None:
        """Add new BOM."""
        dialog = BOMDialog(self.item_controller, parent=self)
        if dialog.exec() == QDialog.Accepted:
            data = dialog.get_bom_data()
            success, error = self.controller.create_bom(**data)
            if success:
                self._load_boms()
            else:
                QMessageBox.warning(self, "Creation Failed", error)

    def _on_edit_bom(self) -> None:
        """Edit selected BOM."""
        if not self._selected_bom_id:
            return
        
        bom, error = self.controller.get_bom(self._selected_bom_id)
        if error:
            QMessageBox.warning(self, "Load Error", error)
            return
        
        dialog = BOMDialog(self.item_controller, bom, self)
        if dialog.exec() == QDialog.Accepted:
            data = dialog.get_bom_data()
            success, error = self.controller.update_bom(
                bom_id=self._selected_bom_id,
                **data
            )
            if success:
                self._load_boms()
            else:
                QMessageBox.warning(self, "Update Failed", error)

    def _on_delete_bom(self) -> None:
        """Delete selected BOM."""
        if not self._selected_bom_id:
            return
        
        reply = QMessageBox.question(
            self,
            "Confirm Delete",
            "Are you sure you want to deactivate this BOM?",
            QMessageBox.Yes | QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            success, error = self.controller.deactivate_bom(self._selected_bom_id)
            if success:
                self._load_boms()
            else:
                QMessageBox.warning(self, "Delete Failed", error)

    # ===================================================================
    # Production Order Methods
    # ===================================================================

    def _load_orders(self) -> None:
        """Load production orders into table."""
        status = self.order_status_filter.currentData()
        orders, error = self.controller.list_production_orders(status=status)
        
        if error:
            QMessageBox.warning(self, "Load Error", error)
            return
        
        self.order_table.setRowCount(len(orders))
        self.order_table.setColumnCount(7)
        self.order_table.setHorizontalHeaderLabels([
            "Order #", "BOM", "Planned", "Actual", "Status", "Date", "Batch"
        ])
        
        for row, order in enumerate(orders):
            # Get BOM name
            bom, _ = self.controller.get_bom(order.bom_id)
            bom_name = bom.bom_name if bom else "Unknown"
            
            self.order_table.setItem(row, 0, QTableWidgetItem(order.order_number))
            self.order_table.setItem(row, 1, QTableWidgetItem(bom_name))
            self.order_table.setItem(row, 2, QTableWidgetItem(f"{order.planned_quantity:.2f}"))
            self.order_table.setItem(row, 3, QTableWidgetItem(f"{order.actual_quantity:.2f}"))
            self.order_table.setItem(row, 4, QTableWidgetItem(order.status.replace("_", " ").title()))
            self.order_table.setItem(row, 5, QTableWidgetItem(order.manufacturing_date))
            self.order_table.setItem(row, 6, QTableWidgetItem(order.output_batch_number or "-"))
        
        self.order_table.resizeColumnsToContents()
        self._selected_order_id = None
        self.start_order_btn.setEnabled(False)
        self.complete_order_btn.setEnabled(False)
        self.cancel_order_btn.setEnabled(False)
        self.delete_order_btn.setEnabled(False)

    def _on_order_search(self, text: str) -> None:
        """Filter order table."""
        for row in range(self.order_table.rowCount()):
            matches = False
            item = self.order_table.item(row, 0)
            if item and text.lower() in item.text().lower():
                matches = True
            self.order_table.setRowHidden(row, not matches)

    def _on_order_table_clicked(self, index) -> None:
        """Handle order table click."""
        row = index.row()
        order_item = self.order_table.item(row, 0)
        if not order_item:
            return
        
        orders, _ = self.controller.list_production_orders(status=None)
        order = next((o for o in orders if o.order_number == order_item.text()), None)
        
        if order:
            self._selected_order_id = order.id
            
            # Enable/disable buttons based on status
            self.start_order_btn.setEnabled(order.status == "DRAFT")
            self.complete_order_btn.setEnabled(order.status == "IN_PROGRESS")
            self.cancel_order_btn.setEnabled(order.status in ["DRAFT", "IN_PROGRESS"])
            self.delete_order_btn.setEnabled(order.status == "DRAFT")

    def _on_add_order(self) -> None:
        """Add new production order."""
        # Get BOMs for dropdown
        boms, _ = self.controller.list_boms(active_only=True)
        if not boms:
            QMessageBox.warning(self, "No BOMs", "Please create a BOM first.")
            return
        
        # Create simple dialog for order creation
        dialog = QDialog(self)
        dialog.setWindowTitle("New Production Order")
        dialog.setModal(True)
        dialog.resize(400, 300)
        
        layout = QFormLayout(dialog)
        
        order_number_input = QLineEdit()
        order_number_input.setPlaceholderText("e.g., PROD-2026-001")
        layout.addRow("Order Number*:", order_number_input)
        
        bom_combo = QComboBox()
        for bom in boms:
            # Get finished item name
            items, _ = self.item_controller.list_items(active_only=False)
            item_name = next((i.item_name for i in items if i.id == bom.finished_item_id), "Unknown")
            bom_combo.addItem(f"{bom.bom_name} ({item_name})", bom.id)
        layout.addRow("BOM*:", bom_combo)
        
        planned_qty_spin = QDoubleSpinBox()
        planned_qty_spin.setMinimum(0.01)
        planned_qty_spin.setMaximum(999999.99)
        planned_qty_spin.setValue(1.0)
        planned_qty_spin.setDecimals(2)
        layout.addRow("Planned Quantity*:", planned_qty_spin)
        
        date_input = QDateEdit()
        date_input.setDate(QDate.currentDate())
        date_input.setDisplayFormat("yyyy-MM-dd")
        layout.addRow("Manufacturing Date*:", date_input)
        
        expiry_input = QDateEdit()
        expiry_input.setDate(QDate.currentDate().addYears(2))
        expiry_input.setDisplayFormat("yyyy-MM-dd")
        layout.addRow("Expiry Date:", expiry_input)
        
        notes_input = QLineEdit()
        notes_input.setPlaceholderText("Optional notes")
        layout.addRow("Notes:", notes_input)
        
        button_box = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel,
            Qt.Horizontal, dialog
        )
        button_box.accepted.connect(dialog.accept)
        button_box.rejected.connect(dialog.reject)
        layout.addRow(button_box)
        
        if dialog.exec() == QDialog.Accepted:
            order_number = order_number_input.text().strip()
            if not order_number:
                QMessageBox.warning(self, "Input Error", "Order number is required.")
                return
            
            bom_id = bom_combo.currentData()
            if not bom_id:
                QMessageBox.warning(self, "Input Error", "Please select a BOM.")
                return
            
            success, error = self.controller.create_production_order(
                order_number=order_number,
                bom_id=bom_id,
                planned_quantity=planned_qty_spin.value(),
                manufacturing_date=date_input.date().toString("yyyy-MM-dd"),
                expiry_date=expiry_input.date().toString("yyyy-MM-dd"),
                notes=notes_input.text().strip() or None,
            )
            
            if success:
                self._load_orders()
            else:
                QMessageBox.warning(self, "Creation Failed", error)

    def _on_start_order(self) -> None:
        """Start production order."""
        if not self._selected_order_id:
            return
        
        reply = QMessageBox.question(
            self,
            "Confirm Start",
            "Are you sure you want to start this production order?",
            QMessageBox.Yes | QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            success, error = self.controller.start_production(self._selected_order_id)
            if success:
                self._load_orders()
            else:
                QMessageBox.warning(self, "Start Failed", error)

    def _on_complete_order(self) -> None:
        """Complete production order."""
        if not self._selected_order_id:
            return
        
        # Get order details
        order, error = self.controller.get_production_order(self._selected_order_id)
        if error:
            QMessageBox.warning(self, "Load Error", error)
            return
        
        # Create completion dialog
        dialog = QDialog(self)
        dialog.setWindowTitle("Complete Production Order")
        dialog.setModal(True)
        dialog.resize(400, 250)
        
        layout = QFormLayout(dialog)
        
        actual_qty_spin = QDoubleSpinBox()
        actual_qty_spin.setMinimum(0.01)
        actual_qty_spin.setMaximum(order.planned_quantity * 2)
        actual_qty_spin.setValue(order.planned_quantity)
        actual_qty_spin.setDecimals(2)
        layout.addRow("Actual Quantity*:", actual_qty_spin)
        
        wastage_qty_spin = QDoubleSpinBox()
        wastage_qty_spin.setMinimum(0)
        wastage_qty_spin.setMaximum(999999.99)
        wastage_qty_spin.setValue(0)
        wastage_qty_spin.setDecimals(2)
        layout.addRow("Wastage Quantity:", wastage_qty_spin)
        
        batch_input = QLineEdit()
        batch_input.setPlaceholderText("e.g., BATCH-001")
        batch_input.setText(f"BATCH-{order.order_number}")
        layout.addRow("Output Batch Number:", batch_input)
        
        button_box = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel,
            Qt.Horizontal, dialog
        )
        button_box.accepted.connect(dialog.accept)
        button_box.rejected.connect(dialog.reject)
        layout.addRow(button_box)
        
        if dialog.exec() == QDialog.Accepted:
            success, error = self.controller.complete_production(
                order_id=self._selected_order_id,
                actual_quantity=actual_qty_spin.value(),
                wastage_quantity=wastage_qty_spin.value(),
                output_batch_number=batch_input.text().strip() or None,
            )
            
            if success:
                self._load_orders()
            else:
                QMessageBox.warning(self, "Completion Failed", error)

    def _on_cancel_order(self) -> None:
        """Cancel production order."""
        if not self._selected_order_id:
            return
        
        reply = QMessageBox.question(
            self,
            "Confirm Cancel",
            "Are you sure you want to cancel this production order?",
            QMessageBox.Yes | QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            success, error = self.controller.cancel_production_order(self._selected_order_id)
            if success:
                self._load_orders()
            else:
                QMessageBox.warning(self, "Cancel Failed", error)

    def _on_delete_order(self) -> None:
        """Delete production order (only DRAFT)."""
        if not self._selected_order_id:
            return
        
        reply = QMessageBox.question(
            self,
            "Confirm Delete",
            "Are you sure you want to delete this production order?",
            QMessageBox.Yes | QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            success, error = self.controller.delete_production_order(self._selected_order_id)
            if success:
                self._load_orders()
            else:
                QMessageBox.warning(self, "Delete Failed", error)