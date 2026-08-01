"""Login window shown at application startup."""
from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QFrame,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from config.app_config import get_config
from controllers.auth_controller import AuthController
from models.user import User


class LoginView(QWidget):
    """Emits `login_successful` with the authenticated User once login succeeds."""

    login_successful = Signal(object)

    def __init__(self, auth_controller: AuthController | None = None, parent=None):
        super().__init__(parent)
        self.controller = auth_controller or AuthController()
        self._build_ui()

    def _build_ui(self) -> None:
        self.setWindowTitle(get_config().app_name)
        self.setMinimumSize(420, 460)

        outer = QVBoxLayout(self)
        outer.setAlignment(Qt.AlignCenter)

        card = QFrame()
        card.setObjectName("loginCard")
        card.setFixedWidth(340)
        card_layout = QVBoxLayout(card)
        card_layout.setSpacing(14)
        card_layout.setContentsMargins(32, 32, 32, 32)

        title = QLabel(get_config().app_name)
        title.setWordWrap(True)
        title.setAlignment(Qt.AlignCenter)
        # ✅ Use constructor with size - NO setPointSize
        title_font = QFont("Segoe UI", 14, QFont.Bold)
        title.setFont(title_font)
        card_layout.addWidget(title)

        subtitle = QLabel("Sign in to continue")
        subtitle.setAlignment(Qt.AlignCenter)
        subtitle.setStyleSheet("color: #666;")
        card_layout.addWidget(subtitle)
        card_layout.addSpacing(10)

        self.username_input = QLineEdit()
        self.username_input.setPlaceholderText("Username")
        card_layout.addWidget(self.username_input)

        self.password_input = QLineEdit()
        self.password_input.setPlaceholderText("Password")
        self.password_input.setEchoMode(QLineEdit.Password)
        self.password_input.returnPressed.connect(self._on_login_clicked)
        card_layout.addWidget(self.password_input)

        self.error_label = QLabel("")
        self.error_label.setStyleSheet("color: #c0392b;")
        self.error_label.setWordWrap(True)
        self.error_label.hide()
        card_layout.addWidget(self.error_label)

        self.login_button = QPushButton("Login")
        self.login_button.setDefault(True)
        self.login_button.clicked.connect(self._on_login_clicked)
        card_layout.addWidget(self.login_button)

        outer.addWidget(card, alignment=Qt.AlignCenter)

    def _on_login_clicked(self) -> None:
        username = self.username_input.text().strip()
        password = self.password_input.text()

        if not username or not password:
            self._show_error("Please enter both username and password.")
            return

        self.login_button.setEnabled(False)
        user, error = self.controller.login(username, password)
        self.login_button.setEnabled(True)

        if error:
            self._show_error(error)
            self.password_input.clear()
            self.password_input.setFocus()
            return

        self.error_label.hide()
        self.login_successful.emit(user)

    def _show_error(self, message: str) -> None:
        self.error_label.setText(message)
        self.error_label.show()