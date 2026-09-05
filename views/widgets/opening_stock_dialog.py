"""Opening Stock Dialog - add initial stock quantities for many items at once."""
from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QComboBox,
    QDialog,
    QDoubleSpinBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
)

from controllers.item_controller import ItemController
from utils.helpers import fetch_all_items_with_stock
from utils.logger import get_logger

logger = get_logger(__name__)


class StockTable(QTableWidget):
    """QTableWidget that jumps to the next row's Quantity cell on Enter."""

    QTY_COL = 4

    def __init__(self, parent=None):
        super().__init__(parent)

    def keyPressEvent(self, event):
        if event.key() in (Qt.Key_Return, Qt.Key_Enter):
            row = self.currentRow()
            if row < self.rowCount() - 1:
                self.setCurrentCell(row + 1, self.QTY_COL)
                item = self.item(row + 1, self.QTY_COL)
                if item:
                    self.editItem(item)
                return
        super().keyPressEvent(event)


class OpeningStockDialog(QDialog):
    """Bulk dialog for adding opening stock quantities to multiple items."""

    def __init__(self, item_controller: ItemController, parent=None):
        super().__init__(parent)
        self.item_controller = item_controller
        self._items = []
        self._stocks = {}
        self._loading = False
        self.setWindowTitle("Bulk Opening Stock")
        self.setModal(True)
        self.resize(1000, 620)
        self._setup_ui()
        self._load_data()

    def _setup_ui(self) -> None:
        layout = QVBoxLayout(self)

        hint = QLabel(
            "Type a quantity in the 'Add Qty' column, then press Enter to jump to the "
            "next item. When done, press 'Save All' to apply all quantities at once. "
            "Batch numbers are auto-generated when left blank."
        )
        hint.setStyleSheet("background: #242424; padding: 10px; border-radius: 4px;")
        hint.setWordWrap(True)
        layout.addWidget(hint)

        controls = QHBoxLayout()

        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Search by name or code...")
        self.search_input.textChanged.connect(self._refresh_visibility)
        controls.addWidget(self.search_input, stretch=2)

        self.type_filter = QComboBox()
        self.type_filter.addItem("All Types", None)
        self.type_filter.addItem("Raw Material", "RAW_MATERIAL")
        self.type_filter.addItem("Packing Material", "PACKING_MATERIAL")
        self.type_filter.addItem("Finished Good", "FINISHED_GOOD")
        self.type_filter.currentIndexChanged.connect(self._refresh_visibility)
        controls.addWidget(self.type_filter)

        controls.addWidget(QLabel("Unit Cost:"))
        self.cost_spin = QDoubleSpinBox()
        self.cost_spin.setMinimum(0)
        self.cost_spin.setMaximum(999999999.0)
        self.cost_spin.setValue(0.0)
        self.cost_spin.setDecimals(2)
        self.cost_spin.setPrefix("Rs. ")
        controls.addWidget(self.cost_spin)

        layout.addLayout(controls)

        self.pending_label = QLabel("Pending: 0 items")
        self.pending_label.setStyleSheet("font-weight: bold;")
        layout.addWidget(self.pending_label)

        self.table = StockTable()
        self.table.setColumnCount(6)
        self.table.setHorizontalHeaderLabels(
            ["Code", "Name", "Unit", "Current Stock", "Add Qty", "Batch No."]
        )
        self.table.horizontalHeader().setStretchLastSection(True)
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.cellChanged.connect(self._on_cell_changed)
        layout.addWidget(self.table, stretch=1)

        buttons = QHBoxLayout()
        buttons.addStretch(1)

        self.save_all_btn = QPushButton("Save All")
        self.save_all_btn.setMinimumWidth(120)
        self.save_all_btn.clicked.connect(self._on_save_all)
        buttons.addWidget(self.save_all_btn)

        self.close_btn = QPushButton("Close")
        self.close_btn.clicked.connect(self.reject)
        buttons.addWidget(self.close_btn)

        layout.addLayout(buttons)

    def _load_data(self) -> None:
        items, error = self.item_controller.list_items(active_only=True)
        if error:
            QMessageBox.warning(self, "Load Error", error)
            return

        stocks = {}
        try:
            rows = fetch_all_items_with_stock(
                db=self.item_controller.service.repo.db,
                company_id=1,
                include_inactive=False,
            )
            for row in rows:
                stocks[int(row["id"])] = float(row.get("stock_qty", 0) or 0)
        except Exception as exc:
            logger.warning("Could not load current stock: %s", exc)

        self._items = items
        self._stocks = stocks
        self._populate_table()

    def _populate_table(self) -> None:
        self._loading = True
        self.table.setRowCount(len(self._items))
        for row, item in enumerate(self._items):
            self._set_readonly(row, 0, item.item_code, item.id)
            self._set_readonly(row, 1, item.item_name)
            self._set_readonly(row, 2, item.unit)
            stock = self._stocks.get(int(item.id), 0.0)
            self._set_readonly(row, 3, f"{stock:,.2f}")

            qty_item = QTableWidgetItem("0")
            self.table.setItem(row, 4, qty_item)

            batch_item = QTableWidgetItem("")
            batch_item.setTextAlignment(Qt.AlignCenter)
            self.table.setItem(row, 5, batch_item)

        self.table.resizeColumnsToContents()
        self.table.setColumnWidth(1, 320)
        self.table.setColumnWidth(4, 90)
        self._loading = False
        self._refresh_visibility()
        self._update_pending()
        if self.table.rowCount() > 0:
            self.table.setCurrentCell(0, StockTable.QTY_COL)

    def _set_readonly(self, row: int, col: int, text: str, user_data=None) -> None:
        item = QTableWidgetItem(text)
        item.setFlags(item.flags() & ~Qt.ItemIsEditable)
        if user_data is not None:
            item.setData(Qt.UserRole, user_data)
        self.table.setItem(row, col, item)

    def _on_cell_changed(self, row: int, col: int) -> None:
        if self._loading:
            return
        if col in (StockTable.QTY_COL, 5):
            self._update_pending()

    def _update_pending(self) -> None:
        count = 0
        total = 0.0
        for row in range(self.table.rowCount()):
            qty = self._parse_float(self.table.item(row, StockTable.QTY_COL).text())
            if qty > 0:
                count += 1
                total += qty
        self.pending_label.setText(
            f"Pending: {count} item(s) | Total qty: {total:,.2f}"
        )

    def _refresh_visibility(self) -> None:
        search = self.search_input.text().lower()
        ftype = self.type_filter.currentData()
        for row, item in enumerate(self._items):
            hidden = False
            if ftype is not None and item.item_type != ftype:
                hidden = True
            if not hidden and search:
                if (
                    search not in item.item_name.lower()
                    and search not in item.item_code.lower()
                ):
                    hidden = True
            self.table.setRowHidden(row, hidden)

    @staticmethod
    def _parse_float(text: str) -> float:
        try:
            return float(text.strip())
        except (ValueError, AttributeError):
            return 0.0

    def _on_save_all(self) -> None:
        rows = []
        for row in range(self.table.rowCount()):
            qty = self._parse_float(self.table.item(row, StockTable.QTY_COL).text())
            if qty <= 0:
                continue
            item_id = self.table.item(row, 0).data(Qt.UserRole)
            batch = self.table.item(row, 5).text().strip() or None
            rows.append((item_id, qty, batch))

        if not rows:
            QMessageBox.information(self, "Nothing to Save", "No quantities entered.")
            return

        reply = QMessageBox.question(
            self,
            "Confirm Save",
            f"Save opening stock for {len(rows)} item(s)?",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )
        if reply != QMessageBox.Yes:
            return

        cost = self.cost_spin.value()
        saved = 0
        failed = 0
        errors = []
        self.save_all_btn.setEnabled(False)
        self.save_all_btn.setText("Saving...")
        try:
            for item_id, qty, batch in rows:
                success, err = self.item_controller.add_opening_stock(
                    item_id=item_id,
                    quantity=qty,
                    unit_cost=cost,
                    batch_number=batch,
                    expiry_date=None,
                    party_id=None,
                )
                if success:
                    saved += 1
                else:
                    failed += 1
                    if len(errors) < 5:
                        errors.append(f"{self._item_name(item_id)}: {err}")
        finally:
            self.save_all_btn.setEnabled(True)
            self.save_all_btn.setText("Save All")

        summary = f"Saved: {saved} item(s)"
        if failed:
            summary += f" | Failed: {failed}"
            if errors:
                summary += "\n\n" + "\n".join(errors)
        if saved:
            self._reload_stock()

        QMessageBox.information(self, "Opening Stock", summary)

    def _item_name(self, item_id: int) -> str:
        for item in self._items:
            if int(item.id) == int(item_id):
                return item.item_name
        return f"Item #{item_id}"

    def _reload_stock(self) -> None:
        stocks = {}
        try:
            rows = fetch_all_items_with_stock(
                db=self.item_controller.service.repo.db,
                company_id=1,
                include_inactive=False,
            )
            for row in rows:
                stocks[int(row["id"])] = float(row.get("stock_qty", 0) or 0)
        except Exception as exc:
            logger.warning("Could not reload current stock: %s", exc)
            return
        self._stocks = stocks
        self._loading = True
        for row, item in enumerate(self._items):
            stock = self._stocks.get(int(item.id), 0.0)
            self.table.item(row, 3).setText(f"{stock:,.2f}")
            qty_item = self.table.item(row, StockTable.QTY_COL)
            if qty_item:
                qty_item.setText("0")
            batch_item = self.table.item(row, 5)
            if batch_item:
                batch_item.setText("")
        self._loading = False
        self._update_pending()