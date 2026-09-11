"""Reusable live-filter search bar for table views.

Drop one of these above any QTableWidget and it filters the rows *in place*
(case-insensitive substring across every column) as the user types, without
touching each view's data layer.  It is keyboard friendly:

* Typing filters immediately (no submit required).
* ``Enter``/``Return`` emits :attr:`SearchBar.submitted` so a view can act on
  the selected/visible row (e.g. open it).
* ``Esc`` clears the query and restores every row.
* ``focus_search()`` moves focus here and selects the text (wired to Ctrl+F).
"""

from __future__ import annotations

from typing import Optional

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import QHBoxLayout, QLabel, QLineEdit, QWidget


class SearchBar(QWidget):
    """A QLineEdit that live-filters an attached QTableWidget row set."""

    # Emitted with the current query text whenever the query changes.
    searchChanged = Signal(str)
    # Emitted with the current query text when Enter/Return is pressed.
    submitted = Signal(str)

    _SEARCH_CSS = """
        QLineEdit#searchInput {
            background: #1f1f2a;
            color: #e0e0e0;
            border: 1px solid #3a3a4a;
            border-radius: 8px;
            padding: 7px 10px;
            selection-background-color: #8B1A2B;
            selection-color: #ffffff;
        }
        QLineEdit#searchInput:focus {
            border: 1px solid #8B1A2B;
            background: #26263a;
        }
        QLabel#searchIcon { color: #9aa4b8; font-size: 14px; }
    """

    def __init__(self, placeholder: str = "Type to filter…", parent: Optional[QWidget] = None):
        super().__init__(parent)
        self.setStyleSheet(self._SEARCH_CSS)

        self.input = QLineEdit()
        self.input.setObjectName("searchInput")
        self.input.setPlaceholderText(placeholder)
        self.input.setClearButtonEnabled(True)
        self.input.setStyleSheet("background: transparent;")
        self.input.textChanged.connect(self._on_text_changed)
        self.input.returnPressed.connect(self._on_return_pressed)

        icon = QLabel("🔍")
        icon.setObjectName("searchIcon")

        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(6)
        layout.addWidget(icon)
        layout.addWidget(self.input, 1)

        self._table = None

    # ------------------------------------------------------------------ #
    #  public API
    # ------------------------------------------------------------------ #
    def attach_table(self, table) -> None:
        """Attach a QTableWidget to live-filter in place."""
        if self._table is table:
            return
        self._table = table
        self._apply_filter(self.input.text())

    def focus_search(self) -> None:
        """Move keyboard focus here and highlight existing text."""
        self.input.setFocus()
        self.input.selectAll()

    def clear(self) -> None:
        self.input.clear()

    def query(self) -> str:
        return self.input.text()

    # ------------------------------------------------------------------ #
    #  internals
    # ------------------------------------------------------------------ #
    def _on_text_changed(self, text: str) -> None:
        self._apply_filter(text)
        self.searchChanged.emit(text)

    def _on_return_pressed(self) -> None:
        self.submitted.emit(self.input.text())

    def _apply_filter(self, text: str) -> None:
        if self._table is None:
            return
        needle = text.strip().lower()
        table = self._table
        row_count = table.rowCount()
        if row_count <= 0:
            return
        col_count = table.columnCount()
        visible_any = False
        for row in range(row_count):
            match = self._row_matches(table, row, col_count, needle)
            table.setRowHidden(row, not match)
            if match:
                visible_any = True
        # Keep a sane keyboard starting point: select the first visible row.
        if visible_any:
            for row in range(row_count):
                if not table.isRowHidden(row):
                    table.selectRow(row)
                    break
        else:
            table.clearSelection()

    @staticmethod
    def _row_matches(table, row: int, col_count: int, needle: str) -> bool:
        if not needle:
            return True
        for col in range(col_count):
            item = table.item(row, col)
            if item is not None and needle in str(item.text()).lower():
                return True
        return False


def install_search_bar(
    layout,
    table,
    placeholder: str = "Type to filter…",
) -> SearchBar:
    """Insert a SearchBar immediately above *table* in a QVBox layout.

    ``layout`` must be the ``QVBoxLayout`` that owns *table* (the dashboard and
    content views all store one as ``layout``/``expense_layout`` etc.).  Returns
    the created :class:`SearchBar`.
    """
    bar = SearchBar(placeholder=placeholder)
    bar.attach_table(table)
    index = layout.indexOf(table)
    if index >= 0:
        layout.insertWidget(index, bar)
    else:
        layout.addWidget(bar)
    return bar