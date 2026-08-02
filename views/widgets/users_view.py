"""User management widget - Admin only."""
from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QComboBox,
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
)

from controllers.auth_controller import AuthController
from database.connection import get_db
from models.user import User, UserRole
from utils.security import hash_password
from utils.logger import get_logger

logger = get_logger(__name__)


class UserDialog(QDialog):
    """Dialog for creating/editing a user."""

    def __init__(self, user: User | None = None, parent=None):
        super().__init__(parent)
        self.user = user
        self.setWindowTitle("Edit User" if user else "New User")
        self.setModal(True)
        self.resize(400, 350)
        self._setup_ui()
        if user:
            self._load_user_data()

    def _setup_ui(self):
        layout = QVBoxLayout(self)

        form_group = QGroupBox("User Details")
        form_layout = QFormLayout(form_group)

        self.username_input = QLineEdit()
        self.username_input.setPlaceholderText("Username")
        form_layout.addRow("Username*:", self.username_input)

        self.full_name_input = QLineEdit()
        self.full_name_input.setPlaceholderText("Full Name")
        form_layout.addRow("Full Name*:", self.full_name_input)

        self.email_input = QLineEdit()
        self.email_input.setPlaceholderText("Email (optional)")
        form_layout.addRow("Email:", self.email_input)

        self.password_input = QLineEdit()
        self.password_input.setPlaceholderText("Password (min 6 characters)")
        self.password_input.setEchoMode(QLineEdit.Password)
        if self.user:
            self.password_input.setPlaceholderText("Leave blank to keep current password")
        form_layout.addRow("Password:", self.password_input)

        self.role_combo = QComboBox()
        for role in UserRole:
            self.role_combo.addItem(role.value, role)
        form_layout.addRow("Role*:", self.role_combo)

        self.active_check = QComboBox()
        self.active_check.addItem("Active", True)
        self.active_check.addItem("Inactive", False)
        form_layout.addRow("Status:", self.active_check)

        layout.addWidget(form_group)

        button_box = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel,
            Qt.Horizontal, self
        )
        button_box.accepted.connect(self.accept)
        button_box.rejected.connect(self.reject)
        layout.addWidget(button_box)

    def _load_user_data(self):
        if self.user:
            self.username_input.setText(self.user.username)
            self.username_input.setEnabled(False)  # Can't change username
            self.full_name_input.setText(self.user.full_name)
            self.email_input.setText(self.user.email or "")
            
            idx = self.role_combo.findData(UserRole(self.user.role_name))
            if idx >= 0:
                self.role_combo.setCurrentIndex(idx)
            
            idx = self.active_check.findData(self.user.is_active)
            if idx >= 0:
                self.active_check.setCurrentIndex(idx)

    def get_user_data(self) -> dict:
        return {
            "username": self.username_input.text().strip(),
            "full_name": self.full_name_input.text().strip(),
            "email": self.email_input.text().strip() or None,
            "password": self.password_input.text() or None,
            "role": self.role_combo.currentData(),
            "is_active": self.active_check.currentData(),
        }


class UsersView(QWidget):
    """Widget for managing users (Admin only)."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.db = get_db()
        self._selected_user_id: int | None = None
        self._build_ui()
        self._load_users()

    def showEvent(self, event):
        """Called when the widget is shown (tab selected)."""
        super().showEvent(event)
        self._load_users()
        print("[R] Users View refreshed")

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(10)

        # Title
        title = QLabel("👥 User Management")
        title.setStyleSheet("font-size: 18px; font-weight: bold;")
        layout.addWidget(title)

        # Controls
        controls_layout = QHBoxLayout()
        
        self.refresh_btn = QPushButton("Refresh")
        self.refresh_btn.clicked.connect(self._load_users)
        controls_layout.addWidget(self.refresh_btn)
        
        controls_layout.addStretch()
        
        self.add_btn = QPushButton("+ New User")
        self.add_btn.clicked.connect(self._on_add_user)
        self.add_btn.setStyleSheet("background: #2ecc71; color: white; font-weight: bold;")
        controls_layout.addWidget(self.add_btn)
        
        layout.addLayout(controls_layout)

        # Users table
        self.table = QTableWidget()
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.setSelectionMode(QTableWidget.SingleSelection)
        self.table.clicked.connect(self._on_table_clicked)
        layout.addWidget(self.table, stretch=1)

        # Actions
        actions_layout = QHBoxLayout()
        
        self.edit_btn = QPushButton("Edit")
        self.edit_btn.clicked.connect(self._on_edit_user)
        self.edit_btn.setEnabled(False)
        actions_layout.addWidget(self.edit_btn)
        
        self.reset_password_btn = QPushButton("Reset Password")
        self.reset_password_btn.clicked.connect(self._on_reset_password)
        self.reset_password_btn.setEnabled(False)
        actions_layout.addWidget(self.reset_password_btn)
        
        self.deactivate_btn = QPushButton("Deactivate")
        self.deactivate_btn.clicked.connect(self._on_deactivate_user)
        self.deactivate_btn.setEnabled(False)
        actions_layout.addWidget(self.deactivate_btn)
        
        layout.addLayout(actions_layout)

    def _load_users(self):
        """Load users into table."""
        users = self.db.fetch_all("""
            SELECT u.*, r.name as role_name
            FROM users u
            JOIN roles r ON r.id = u.role_id
            ORDER BY u.username
        """)

        self.table.setRowCount(len(users))
        self.table.setColumnCount(5)
        self.table.setHorizontalHeaderLabels([
            "Username", "Full Name", "Email", "Role", "Status"
        ])

        from PySide6.QtGui import QColor

        for row, user in enumerate(users):
            self.table.setItem(row, 0, QTableWidgetItem(user["username"]))
            self.table.setItem(row, 1, QTableWidgetItem(user["full_name"]))
            self.table.setItem(row, 2, QTableWidgetItem(user["email"] or "-"))
            self.table.setItem(row, 3, QTableWidgetItem(user["role_name"]))
            
            status_item = QTableWidgetItem("Active" if user["is_active"] else "Inactive")
            if user["is_active"]:
                status_item.setForeground(QColor("#2ecc71"))
            else:
                status_item.setForeground(QColor("#e74c3c"))
            self.table.setItem(row, 4, status_item)

        self.table.resizeColumnsToContents()
        self._selected_user_id = None
        self.edit_btn.setEnabled(False)
        self.reset_password_btn.setEnabled(False)
        self.deactivate_btn.setEnabled(False)

    def _on_table_clicked(self, index):
        """Handle table click."""
        row = index.row()
        username_item = self.table.item(row, 0)
        if not username_item:
            return
        
        users = self.db.fetch_all("SELECT id, username FROM users")
        for u in users:
            if u["username"] == username_item.text():
                self._selected_user_id = u["id"]
                self.edit_btn.setEnabled(True)
                self.reset_password_btn.setEnabled(True)
                self.deactivate_btn.setEnabled(True)
                break

    def _get_user(self, user_id: int) -> dict | None:
        """Get user by ID."""
        return self.db.fetch_one("SELECT * FROM users WHERE id = ?", (user_id,))

    def _on_add_user(self):
        """Add new user."""
        dialog = UserDialog(parent=self)
        if dialog.exec() == QDialog.Accepted:
            data = dialog.get_user_data()
            
            if not data["username"] or not data["full_name"]:
                QMessageBox.warning(self, "Input Error", "Username and Full Name are required.")
                return
            
            if not data["password"] or len(data["password"]) < 6:
                QMessageBox.warning(self, "Input Error", "Password must be at least 6 characters.")
                return
            
            # Check if username exists
            existing = self.db.fetch_one(
                "SELECT id FROM users WHERE username = ?", (data["username"],)
            )
            if existing:
                QMessageBox.warning(self, "Error", f"Username '{data['username']}' already exists.")
                return
            
            # Get role ID
            role = self.db.fetch_one("SELECT id FROM roles WHERE name = ?", (data["role"],))
            if not role:
                QMessageBox.warning(self, "Error", "Role not found.")
                return
            
            # Hash password
            salt, pwd_hash = hash_password(data["password"])
            
            # Insert user
            self.db.execute("""
                INSERT INTO users (username, full_name, email, password_hash, password_salt, role_id, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                data["username"],
                data["full_name"],
                data["email"],
                pwd_hash,
                salt,
                role["id"],
                1 if data["is_active"] else 0,
            ))
            
            self._load_users()
            QMessageBox.information(self, "Success", f"User '{data['username']}' created successfully!")

    def _on_edit_user(self):
        """Edit selected user."""
        if not self._selected_user_id:
            return
        
        user_data = self._get_user(self._selected_user_id)
        if not user_data:
            return
        
        # Get role name
        role = self.db.fetch_one("SELECT name FROM roles WHERE id = ?", (user_data["role_id"],))
        
        user = User(
            id=user_data["id"],
            username=user_data["username"],
            full_name=user_data["full_name"],
            role_id=user_data["role_id"],
            role_name=role["name"] if role else None,
            email=user_data["email"],
            is_active=bool(user_data["is_active"]),
            last_login_at=user_data.get("last_login_at"),
        )
        
        dialog = UserDialog(user, self)
        if dialog.exec() == QDialog.Accepted:
            data = dialog.get_user_data()
            
            if not data["full_name"]:
                QMessageBox.warning(self, "Input Error", "Full Name is required.")
                return
            
            # Get role ID
            role = self.db.fetch_one("SELECT id FROM roles WHERE name = ?", (data["role"],))
            if not role:
                QMessageBox.warning(self, "Error", "Role not found.")
                return
            
            # Update user
            update_data = {
                "full_name": data["full_name"],
                "email": data["email"],
                "role_id": role["id"],
                "is_active": 1 if data["is_active"] else 0,
            }
            
            # Update password if provided
            if data["password"] and len(data["password"]) >= 6:
                salt, pwd_hash = hash_password(data["password"])
                update_data["password_hash"] = pwd_hash
                update_data["password_salt"] = salt
            
            # Build SQL
            set_clause = ", ".join([f"{k} = ?" for k in update_data.keys()])
            values = list(update_data.values()) + [self._selected_user_id]
            
            self.db.execute(f"UPDATE users SET {set_clause} WHERE id = ?", tuple(values))
            
            self._load_users()
            QMessageBox.information(self, "Success", f"User '{user.username}' updated successfully!")

    def _on_reset_password(self):
        """Reset password for selected user."""
        if not self._selected_user_id:
            return
        
        user = self._get_user(self._selected_user_id)
        if not user:
            return
        
        # Ask for new password
        from PySide6.QtWidgets import QInputDialog
        password, ok = QInputDialog.getText(
            self,
            "Reset Password",
            f"Enter new password for '{user['username']}':",
            QLineEdit.Password
        )
        
        if ok and password:
            if len(password) < 6:
                QMessageBox.warning(self, "Error", "Password must be at least 6 characters.")
                return
            
            salt, pwd_hash = hash_password(password)
            self.db.execute(
                "UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?",
                (pwd_hash, salt, self._selected_user_id)
            )
            
            QMessageBox.information(self, "Success", f"Password reset for '{user['username']}'!")

    def _on_deactivate_user(self):
        """Deactivate selected user."""
        if not self._selected_user_id:
            return
        
        user = self._get_user(self._selected_user_id)
        if not user:
            return
        
        # Don't allow deactivating yourself
        from views.main_window import MainWindow
        if user["username"] == self.window().user.username:
            QMessageBox.warning(self, "Error", "You cannot deactivate your own account.")
            return
        
        reply = QMessageBox.question(
            self,
            "Confirm Deactivate",
            f"Are you sure you want to deactivate user '{user['username']}'?",
            QMessageBox.Yes | QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            new_status = 0 if user["is_active"] else 1
            self.db.execute(
                "UPDATE users SET is_active = ? WHERE id = ?",
                (new_status, self._selected_user_id)
            )
            self._load_users()
            status = "activated" if new_status else "deactivated"
            QMessageBox.information(self, "Success", f"User '{user['username']}' {status}!")