"""Main entry point for BOP Nutraceuticals ERP."""

import sys
from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt

from config.database import DatabaseManager, init_database
from controllers.auth_controller import AuthController
from services.user_service import UserService
from views.login_view import LoginView
from views.main_window import MainWindow


class Application:
    """Main application class."""
    
    def __init__(self):
        self.app = QApplication(sys.argv)
        self.app.setStyle('Fusion')
        
        # Initialize database
        self.db_manager = DatabaseManager()
        init_database(self.db_manager.get_connection())
        
        # Initialize services and controllers
        self.user_service = UserService(self.db_manager)
        self.auth_controller = AuthController(self.user_service)
        
        # Views
        self.login_view = None
        self.main_window = None
        
        self.setup_login()
    
    def setup_login(self):
        """Setup login view."""
        self.login_view = LoginView()
        self.login_view.login_requested.connect(self.handle_login)
        self.login_view.show()
    
    def handle_login(self, username: str, password: str):
        """Handle login request."""
        self.login_view.set_enabled(False)
        
        success, message = self.auth_controller.login(username, password)
        
        if success:
            self.login_view.close()
            self.show_main_window()
        else:
            self.login_view.show_error(message)
            self.login_view.set_enabled(True)
    
    def show_main_window(self):
        """Show main application window."""
        current_user = self.auth_controller.get_current_user()
        self.main_window = MainWindow(current_user)
        self.main_window.logout_requested.connect(self.handle_logout)
        self.main_window.show()
        
        # Load dashboard data
        self.load_dashboard()
    
    def handle_logout(self):
        """Handle logout request."""
        self.auth_controller.logout()
        self.main_window.close()
        self.setup_login()
    
    def load_dashboard(self):
        """Load dashboard data."""
        if not self.auth_controller.current_user:
            return
        
        # Get company ID from user (assuming single company for now)
        company_id = self.auth_controller.current_user.company_id
        
        from controllers.dashboard_controller import DashboardController
        from services.dashboard_service import DashboardService
        from services.sales_invoice_service import SalesInvoiceService
        from services.purchase_invoice_service import PurchaseInvoiceService
        from services.inventory_service import InventoryService
        from services.accounting_service import AccountingService
        
        dashboard_controller = DashboardController(
            DashboardService(self.db_manager),
            SalesInvoiceService(self.db_manager),
            PurchaseInvoiceService(self.db_manager),
            InventoryService(self.db_manager),
            AccountingService(self.db_manager)
        )
        
        kpi_data = dashboard_controller.get_kpi_summary(company_id)
        transactions = dashboard_controller.get_recent_transactions(company_id)
        
        if self.main_window:
            self.main_window.refresh_dashboard(kpi_data, transactions)
    
    def run(self):
        """Run the application."""
        sys.exit(self.app.exec())


if __name__ == "__main__":
    app = Application()
    app.run()
