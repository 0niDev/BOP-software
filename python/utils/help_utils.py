"""Shared Help button for module tabs."""
from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QMessageBox, QPushButton


def create_help_button(module_title: str, help_html: str) -> QPushButton:
    """Create a '?' Help button that shows module usage guidance.

    Args:
        module_title: Short title used for the button tooltip and dialog title.
        help_html: Rich-text (HTML) help content shown when clicked.
    """
    btn = QPushButton("?")
    btn.setObjectName("helpButton")
    btn.setToolTip(f"Help - {module_title}")
    btn.setFixedWidth(34)
    btn.clicked.connect(lambda: show_help(module_title, help_html))
    return btn


def show_help(module_title: str, help_html: str) -> None:
    """Display the help content in a modal dialog."""
    box = QMessageBox()
    box.setWindowTitle(f"Help - {module_title}")
    box.setIcon(QMessageBox.Information)
    box.setTextFormat(Qt.RichText)
    box.setText(help_html)
    box.setStandardButtons(QMessageBox.Ok)
    box.exec()
