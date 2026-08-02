"""Login View for BOP Nutraceuticals ERP."""

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
    QLineEdit, QPushButton, QMessageBox, QFrame
)
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont


class LoginView(QWidget):
    """Login screen view."""
    
    login_requested = Signal(str, str)  # username, password
    
    def __init__(self):
        super().__init__()
        self.setWindowTitle("BOP Nutraceuticals ERP - Login")
        self.setMinimumSize(400, 300)
        self.setup_ui()
    
    def setup_ui(self):
        """Setup the login UI."""
        layout = QVBoxLayout()
        layout.setSpacing(20)
        layout.setContentsMargins(40, 40, 40, 40)
        
        # Title
        title_label = QLabel("BOP Nutraceuticals ERP")
        title_label.setAlignment(Qt.AlignCenter)
        title_font = QFont()
        title_font.setPointSize(18)
        title_font.setBold(True)
        title_label.setFont(title_font)
        layout.addWidget(title_label)
        
        subtitle = QLabel("Please login to continue")
        subtitle.setAlignment(Qt.AlignCenter)
        layout.addWidget(subtitle)
        
        layout.addSpacing(20)
        
        # Username field
        username_label = QLabel("Username:")
        layout.addWidget(username_label)
        
        self.username_input = QLineEdit()
        self.username_input.setPlaceholderText("Enter username")
        self.username_input.returnPressed.connect(self.on_login)
        layout.addWidget(self.username_input)
        
        # Password field
        password_label = QLabel("Password:")
        layout.addWidget(password_label)
        
        self.password_input = QLineEdit()
        self.password_input.setPlaceholderText("Enter password")
        self.password_input.setEchoMode(QLineEdit.Password)
        self.password_input.returnPressed.connect(self.on_login)
        layout.addWidget(self.password_input)
        
        layout.addSpacing(10)
        
        # Login button
        self.login_button = QPushButton("Login")
        self.login_button.setMinimumHeight(40)
        self.login_button.clicked.connect(self.on_login)
        layout.addWidget(self.login_button)
        
        # Status label
        self.status_label = QLabel("")
        self.status_label.setAlignment(Qt.AlignCenter)
        self.status_label.setStyleSheet("color: red;")
        layout.addWidget(self.status_label)
        
        self.setLayout(layout)
    
    def on_login(self):
        """Handle login button click."""
        username = self.username_input.text().strip()
        password = self.password_input.text()
        
        if not username:
            self.status_label.setText("Please enter username")
            return
        
        if not password:
            self.status_label.setText("Please enter password")
            return
        
        self.login_requested.emit(username, password)
    
    def show_error(self, message: str):
        """Show error message."""
        self.status_label.setText(message)
    
    def clear_fields(self):
        """Clear input fields."""
        self.username_input.clear()
        self.password_input.clear()
        self.status_label.setText("")
        self.username_input.setFocus()
    
    def set_enabled(self, enabled: bool):
        """Enable or disable the form."""
        self.username_input.setEnabled(enabled)
        self.password_input.setEnabled(enabled)
        self.login_button.setEnabled(enabled)
