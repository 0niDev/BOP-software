"""Login window shown at application startup."""
from __future__ import annotations

from PySide6.QtCore import Qt, Signal, QThread
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
from utils.logger import get_logger

logger = get_logger(__name__)


class LoginThread(QThread):
    """Background thread for login to prevent UI freezing."""
    
    login_result = Signal(object, str)  # user, error
    
    def __init__(self, controller: AuthController, username: str, password: str):
        super().__init__()
        self.controller = controller
        self.username = username
        self.password = password
    
    def run(self):
        try:
            user, error = self.controller.login(self.username, self.password)
            self.login_result.emit(user, error or "")
        except Exception as e:
            logger.exception(f"Error in login thread: {e}")
            self.login_result.emit(None, str(e))


class LoginView(QWidget):
    """Emits `login_successful` with the authenticated User once login succeeds."""

    login_successful = Signal(object)

    def __init__(self, auth_controller: AuthController | None = None, parent=None):
        super().__init__(parent)
        self.controller = auth_controller or AuthController()
        self._login_thread = None
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

        # Disable UI during login
        self.login_button.setEnabled(False)
        self.login_button.setText("Logging in...")
        self.error_label.hide()
        
        # Start login in background thread
        if self._login_thread and self._login_thread.isRunning():
            self._login_thread.terminate()
        
        self._login_thread = LoginThread(self.controller, username, password)
        self._login_thread.login_result.connect(self._on_login_result)
        self._login_thread.start()
    
    def _on_login_result(self, user, error):
        """Handle login result from background thread."""
        self.login_button.setEnabled(True)
        self.login_button.setText("Login")
        
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