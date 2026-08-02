"""Views package for BOP Nutraceuticals ERP."""

from .login_view import LoginView
from .main_window import MainWindow
from .dashboard_view import DashboardView
from .sales_invoice_view import SalesInvoiceView
from .purchase_invoice_view import PurchaseInvoiceView
from .inventory_view import InventoryView
from .manufacturing_view import ManufacturingView
from .accounting_view import AccountingView
from .party_view import PartyView
from .item_view import ItemView
from .user_view import UserView
from .reports_view import ReportsView

__all__ = [
    'LoginView',
    'MainWindow',
    'DashboardView',
    'SalesInvoiceView',
    'PurchaseInvoiceView',
    'InventoryView',
    'ManufacturingView',
    'AccountingView',
    'PartyView',
    'ItemView',
    'UserView',
    'ReportsView'
]
