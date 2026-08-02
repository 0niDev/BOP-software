"""Dashboard Controller for BOP Nutraceuticals ERP."""

from typing import Dict, List, Any
from datetime import date, timedelta
from services.dashboard_service import DashboardService
from services.sales_invoice_service import SalesInvoiceService
from services.purchase_invoice_service import PurchaseInvoiceService
from services.inventory_service import InventoryService
from services.accounting_service import AccountingService


class DashboardController:
    """Controller for dashboard data and KPIs."""
    
    def __init__(
        self,
        dashboard_service: DashboardService,
        sales_service: SalesInvoiceService,
        purchase_service: PurchaseInvoiceService,
        inventory_service: InventoryService,
        accounting_service: AccountingService
    ):
        self.dashboard_service = dashboard_service
        self.sales_service = sales_service
        self.purchase_service = purchase_service
        self.inventory_service = inventory_service
        self.accounting_service = accounting_service
    
    def get_kpi_summary(self, company_id: str) -> Dict[str, Any]:
        """Get key performance indicators for dashboard."""
        try:
            today = date.today()
            month_start = today.replace(day=1)
            
            # Sales KPIs
            month_sales = self.sales_service.get_sales_register(
                company_id=company_id,
                from_date=month_start,
                to_date=today
            )
            total_sales = sum(inv.grand_total for inv in month_sales)
            
            # Purchase KPIs
            month_purchases = self.purchase_service.get_purchase_register(
                company_id=company_id,
                from_date=month_start,
                to_date=today
            )
            total_purchases = sum(inv.grand_total for inv in month_purchases)
            
            # Inventory KPIs
            low_stock_items = self.inventory_service.get_low_stock_items(
                company_id=company_id,
                threshold=10
            )
            
            # Cash position
            cash_balance = self.accounting_service.get_account_balance_by_code(
                company_id=company_id,
                account_code='1-1000'  # Cash account
            )
            
            return {
                'total_sales_mtd': total_sales,
                'total_purchases_mtd': total_purchases,
                'gross_profit_mtd': total_sales - total_purchases,
                'low_stock_count': len(low_stock_items),
                'cash_balance': cash_balance,
                'pending_orders': 0,  # TODO: Implement when orders are added
                'overdue_receivables': 0,  # TODO: Calculate from aging
                'overdue_payables': 0  # TODO: Calculate from aging
            }
        except Exception as e:
            return {
                'error': str(e),
                'total_sales_mtd': 0,
                'total_purchases_mtd': 0,
                'gross_profit_mtd': 0,
                'low_stock_count': 0,
                'cash_balance': 0,
                'pending_orders': 0,
                'overdue_receivables': 0,
                'overdue_payables': 0
            }
    
    def get_recent_transactions(self, company_id: str, limit: int = 10) -> List[Dict]:
        """Get recent transactions for dashboard."""
        try:
            transactions = []
            
            # Recent sales invoices
            sales = self.sales_service.get_sales_register(
                company_id=company_id,
                from_date=date.today() - timedelta(days=30),
                to_date=date.today()
            )[-limit:]
            
            for inv in reversed(sales):
                transactions.append({
                    'type': 'Sales Invoice',
                    'number': inv.invoice_number,
                    'party': inv.party_name,
                    'amount': inv.grand_total,
                    'date': inv.invoice_date,
                    'status': inv.status.value
                })
            
            # Recent purchase invoices
            purchases = self.purchase_service.get_purchase_register(
                company_id=company_id,
                from_date=date.today() - timedelta(days=30),
                to_date=date.today()
            )[-limit:]
            
            for inv in reversed(purchases):
                transactions.append({
                    'type': 'Purchase Invoice',
                    'number': inv.invoice_number,
                    'party': inv.party_name,
                    'amount': inv.grand_total,
                    'date': inv.invoice_date,
                    'status': inv.status.value
                })
            
            # Sort by date and return most recent
            transactions.sort(key=lambda x: x['date'], reverse=True)
            return transactions[:limit]
            
        except Exception as e:
            return []
    
    def get_inventory_status(self, company_id: str) -> Dict[str, Any]:
        """Get inventory status summary."""
        try:
            all_items = self.inventory_service.get_all_stock_items(company_id)
            
            total_items = len(all_items)
            out_of_stock = sum(1 for item in all_items if item.quantity <= 0)
            low_stock = sum(1 for item in all_items if 0 < item.quantity <= 10)
            healthy_stock = total_items - out_of_stock - low_stock
            
            return {
                'total_items': total_items,
                'out_of_stock': out_of_stock,
                'low_stock': low_stock,
                'healthy_stock': healthy_stock,
                'items': all_items
            }
        except Exception as e:
            return {
                'error': str(e),
                'total_items': 0,
                'out_of_stock': 0,
                'low_stock': 0,
                'healthy_stock': 0,
                'items': []
            }
    
    def get_cash_flow_summary(self, company_id: str) -> Dict[str, Any]:
        """Get cash flow summary for dashboard."""
        try:
            today = date.today()
            month_start = today.replace(day=1)
            
            # Get cash book for the month
            cash_book = self.accounting_service.get_cash_book(
                company_id=company_id,
                from_date=month_start,
                to_date=today,
                bank_account_id=None
            )
            
            total_receipts = sum(entry.amount for entry in cash_book if entry.debit_amount > 0)
            total_payments = sum(entry.amount for entry in cash_book if entry.credit_amount > 0)
            
            return {
                'opening_balance': 0,  # TODO: Calculate opening balance
                'total_receipts': total_receipts,
                'total_payments': total_payments,
                'closing_balance': total_receipts - total_payments,
                'transactions': cash_book
            }
        except Exception as e:
            return {
                'error': str(e),
                'opening_balance': 0,
                'total_receipts': 0,
                'total_payments': 0,
                'closing_balance': 0,
                'transactions': []
            }
