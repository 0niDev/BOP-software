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
        self.setMinimumSize(450, 520)
        self.setStyleSheet("""
            LoginView {
                background-color: #F5F7FA;
            }
        """)

        outer = QVBoxLayout(self)
        outer.setAlignment(Qt.AlignCenter)
        outer.setContentsMargins(20, 20, 20, 20)

        card = QFrame()
        card.setObjectName("loginCard")
        card.setFixedWidth(380)
        card_layout = QVBoxLayout(card)
        card_layout.setSpacing(16)
        card_layout.setContentsMargins(40, 40, 40, 40)

        # Brand logo/title area
        brand_title = QLabel("BOP NUTRACEUTICALS")
        brand_title.setWordWrap(True)
        brand_title.setAlignment(Qt.AlignCenter)
        brand_title.setStyleSheet("""
            color: #2E7D32;
            font-size: 22px;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-bottom: 4px;
        """)
        card_layout.addWidget(brand_title)

        brand_subtitle = QLabel("Accounts Software")
        brand_subtitle.setAlignment(Qt.AlignCenter)
        brand_subtitle.setStyleSheet("""
            color: #546E7A;
            font-size: 12px;
            font-weight: 400;
            letter-spacing: 0.5px;
            margin-top: 0px;
        """)
        card_layout.addWidget(brand_subtitle)

        # Separator line
        separator = QFrame()
        separator.setFrameShape(QFrame.HLine)
        separator.setStyleSheet("""
            background-color: #E0E0E0;
            max-height: 1px;
            min-height: 1px;
        """)
        card_layout.addWidget(separator)
        card_layout.addSpacing(10)

        subtitle = QLabel("Sign in to your account")
        subtitle.setAlignment(Qt.AlignCenter)
        subtitle.setStyleSheet("""
            color: #546E7A;
            font-size: 13px;
            margin-bottom: 8px;
        """)
        card_layout.addWidget(subtitle)
        card_layout.addSpacing(5)

        # Username field
        username_label = QLabel("Username")
        username_label.setStyleSheet("""
            color: #1A1A2E;
            font-weight: 500;
            font-size: 12px;
            margin-bottom: 4px;
        """)
        card_layout.addWidget(username_label)
        
        self.username_input = QLineEdit()
        self.username_input.setPlaceholderText("Enter your username")
        self.username_input.setStyleSheet("""
            QLineEdit {
                background-color: #FFFFFF;
                border: 1px solid #E0E0E0;
                border-radius: 6px;
                padding: 10px 14px;
                font-size: 13px;
                color: #1A1A2E;
            }
            QLineEdit:focus {
                border: 2px solid #2E7D32;
                padding: 9px 13px;
            }
            QLineEdit::placeholder {
                color: #90A4AE;
            }
        """)
        card_layout.addWidget(self.username_input)

        card_layout.addSpacing(5)

        # Password field
        password_label = QLabel("Password")
        password_label.setStyleSheet("""
            color: #1A1A2E;
            font-weight: 500;
            font-size: 12px;
            margin-bottom: 4px;
        """)
        card_layout.addWidget(password_label)
        
        self.password_input = QLineEdit()
        self.password_input.setPlaceholderText("Enter your password")
        self.password_input.setEchoMode(QLineEdit.Password)
        self.password_input.returnPressed.connect(self._on_login_clicked)
        self.password_input.setStyleSheet("""
            QLineEdit {
                background-color: #FFFFFF;
                border: 1px solid #E0E0E0;
                border-radius: 6px;
                padding: 10px 14px;
                font-size: 13px;
                color: #1A1A2E;
            }
            QLineEdit:focus {
                border: 2px solid #2E7D32;
                padding: 9px 13px;
            }
            QLineEdit::placeholder {
                color: #90A4AE;
            }
        """)
        card_layout.addWidget(self.password_input)

        card_layout.addSpacing(10)

        self.error_label = QLabel("")
        self.error_label.setStyleSheet("""
            color: #D32F2F;
            font-size: 12px;
            font-weight: 500;
            background-color: #FFEBEE;
            border-radius: 6px;
            padding: 8px 12px;
        """)
        self.error_label.setWordWrap(True)
        self.error_label.hide()
        card_layout.addWidget(self.error_label)

        card_layout.addSpacing(10)

        self.login_button = QPushButton("Sign In")
        self.login_button.setDefault(True)
        self.login_button.setCursor(Qt.PointingHandCursor)
        self.login_button.clicked.connect(self._on_login_clicked)
        self.login_button.setStyleSheet("""
            QPushButton {
                background-color: #2E7D32;
                color: #FFFFFF;
                border: none;
                border-radius: 6px;
                padding: 12px 24px;
                font-size: 14px;
                font-weight: 600;
                letter-spacing: 0.5px;
            }
            QPushButton:hover {
                background-color: #1B5E20;
            }
            QPushButton:pressed {
                background-color: #1B5E20;
            }
            QPushButton:disabled {
                background-color: #BDBDBD;
                color: #757575;
            }
        """)
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