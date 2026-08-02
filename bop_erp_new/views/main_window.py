"""Main Window for BOP Nutraceuticals ERP."""

from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QStackedWidget, QMenuBar, QMenu, QAction, 
    QToolBar, QLabel, QPushButton, QMessageBox
)
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont, QIcon

from .dashboard_view import DashboardView


class MainWindow(QMainWindow):
    """Main application window."""
    
    logout_requested = Signal()
    
    def __init__(self, current_user=None):
        super().__init__()
        self.current_user = current_user
        self.setWindowTitle("BOP Nutraceuticals ERP")
        self.setMinimumSize(1200, 800)
        self.setup_ui()
        self.create_menu_bar()
        self.create_toolbar()
    
    def setup_ui(self):
        """Setup main window UI."""
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout()
        main_layout.setSpacing(0)
        main_layout.setContentsMargins(0, 0, 0, 0)
        
        # Header
        header = QWidget()
        header.setStyleSheet("""
            QWidget {
                background-color: #2c3e50;
                padding: 10px;
            }
        """)
        header_layout = QHBoxLayout()
        
        logo_label = QLabel("BOP Nutraceuticals")
        logo_font = QFont()
        logo_font.setPointSize(14)
        logo_font.setBold(True)
        logo_label.setFont(logo_font)
        logo_label.setStyleSheet("color: white;")
        header_layout.addWidget(logo_label)
        
        header_layout.addStretch()
        
        if self.current_user:
            user_label = QLabel(f"Logged in as: {self.current_user.full_name} ({self.current_user.role.value})")
            user_label.setStyleSheet("color: #ecf0f1;")
            header_layout.addWidget(user_label)
        
        self.logout_button = QPushButton("Logout")
        self.logout_button.setStyleSheet("""
            QPushButton {
                background-color: #e74c3c;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
            }
            QPushButton:hover {
                background-color: #c0392b;
            }
        """)
        self.logout_button.clicked.connect(self.logout_requested.emit)
        header_layout.addWidget(self.logout_button)
        
        header.setLayout(header_layout)
        main_layout.addWidget(header)
        
        # Content area with sidebar
        content_widget = QWidget()
        content_layout = QHBoxLayout()
        content_layout.setSpacing(0)
        
        # Sidebar navigation
        sidebar = self.create_sidebar()
        content_layout.addWidget(sidebar)
        
        # Stacked widget for views
        self.stack = QStackedWidget()
        self.stack.setStyleSheet("background-color: #ecf0f1;")
        
        # Add dashboard as first view
        self.dashboard_view = DashboardView()
        self.stack.addWidget(self.dashboard_view)
        
        # Placeholder for other views
        placeholder = QLabel("Select a module from the sidebar")
        placeholder.setAlignment(Qt.AlignCenter)
        placeholder.setStyleSheet("font-size: 18px; color: #7f8c8d;")
        self.stack.addWidget(placeholder)
        
        content_layout.addWidget(self.stack, 1)
        content_widget.setLayout(content_layout)
        main_layout.addWidget(content_widget)
        
        central_widget.setLayout(main_layout)
    
    def create_sidebar(self):
        """Create sidebar navigation."""
        sidebar = QWidget()
        sidebar.setMaximumWidth(200)
        sidebar.setStyleSheet("""
            QWidget {
                background-color: #34495e;
            }
        """)
        
        layout = QVBoxLayout()
        layout.setSpacing(10)
        layout.setContentsMargins(10, 20, 10, 20)
        
        # Navigation buttons
        nav_buttons = [
            ("Dashboard", 0),
            ("Sales", 1),
            ("Purchase", 2),
            ("Inventory", 3),
            ("Manufacturing", 4),
            ("Accounting", 5),
            ("Parties", 6),
            ("Items", 7),
            ("Users", 8),
            ("Reports", 9)
        ]
        
        self.nav_buttons = []
        for text, index in nav_buttons:
            btn = QPushButton(text)
            btn.setStyleSheet("""
                QPushButton {
                    background-color: transparent;
                    color: #ecf0f1;
                    text-align: left;
                    padding: 12px;
                    border: none;
                    border-radius: 4px;
                }
                QPushButton:hover {
                    background-color: #2c3e50;
                }
                QPushButton:pressed {
                    background-color: #1abc9c;
                }
            """)
            btn.clicked.connect(lambda checked, i=index: self.stack.setCurrentIndex(max(1, i)))
            layout.addWidget(btn)
            self.nav_buttons.append(btn)
        
        layout.addStretch()
        sidebar.setLayout(layout)
        return sidebar
    
    def create_menu_bar(self):
        """Create menu bar."""
        menubar = self.menuBar()
        
        # File menu
        file_menu = menubar.addMenu("&File")
        
        logout_action = QAction("&Logout", self)
        logout_action.triggered.connect(self.logout_requested.emit)
        file_menu.addAction(logout_action)
        
        exit_action = QAction("E&xit", self)
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        # Help menu
        help_menu = menubar.addMenu("&Help")
        
        about_action = QAction("&About", self)
        about_action.triggered.connect(self.show_about)
        help_menu.addAction(about_action)
    
    def create_toolbar(self):
        """Create toolbar."""
        toolbar = QToolBar("Main Toolbar")
        toolbar.setMovable(False)
        self.addToolBar(toolbar)
    
    def show_about(self):
        """Show about dialog."""
        QMessageBox.about(
            self,
            "About BOP Nutraceuticals ERP",
            "BOP Nutraceuticals ERP System\nVersion 1.0\n\nA complete ERP solution for nutraceutical manufacturing."
        )
    
    def refresh_dashboard(self, kpi_data: dict, transactions: list):
        """Refresh dashboard with new data."""
        if hasattr(self, 'dashboard_view'):
            self.dashboard_view.update_kpis(kpi_data)
            self.dashboard_view.update_recent_transactions(transactions)
