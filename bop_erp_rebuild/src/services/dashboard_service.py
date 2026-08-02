"""
Dashboard Service - Business intelligence and KPI reporting
Provides summary statistics, charts data, and key metrics.
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime, timedelta
from decimal import Decimal

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.accounting_service import AccountingService
from services.inventory_service import InventoryService
from services.sales_invoice_service import SalesInvoiceService
from services.purchase_invoice_service import PurchaseInvoiceService
from services.party_service import PartyService
from database.connection_manager import get_connection


class DashboardService:
    """
    Provides dashboard widgets and business intelligence data including:
    - Key performance indicators (KPIs)
    - Sales trends
    - Purchase trends
    - Inventory status
    - Receivables/Payables aging
    - Cash flow summary
    """
    
    def __init__(self, company_id: str):
        self.company_id = company_id
        self.accounting_service = AccountingService(company_id)
        self.inventory_service = InventoryService(company_id)
        self.sales_service = SalesInvoiceService(company_id)
        self.purchase_service = PurchaseInvoiceService(company_id)
        self.party_service = PartyService(company_id)
    
    def get_kpi_summary(self, as_of_date: Optional[date] = None) -> Dict[str, Any]:
        """
        Get key performance indicators summary.
        """
        if as_of_date is None:
            as_of_date = date.today()
        
        # Financial KPIs
        trial_balance = self.accounting_service.get_trial_balance(as_of_date)
        
        total_assets = Decimal('0')
        total_liabilities = Decimal('0')
        total_equity = Decimal('0')
        total_income = Decimal('0')
        total_expenses = Decimal('0')
        
        for entry in trial_balance:
            account_type = entry.get('account_type')
            balance = entry.get('closing_balance', Decimal('0'))
            
            # Simplified classification
            if entry['account_code'].startswith('1'):
                total_assets += balance
            elif entry['account_code'].startswith('2'):
                total_liabilities += balance
            elif entry['account_code'].startswith('3'):
                total_equity += balance
            elif entry['account_code'].startswith('4'):
                total_income += balance
            elif entry['account_code'].startswith('5'):
                total_expenses += balance
        
        # Calculate net profit
        net_profit = total_income - total_expenses
        
        # Get counts
        conn = None
        try:
            conn = get_connection()
            
            # These would query the respective repositories
            customer_count = 0  # party_repo.count_customers(conn, company_id)
            supplier_count = 0  # party_repo.count_suppliers(conn, company_id)
            item_count = 0  # item_repo.count_active(conn, company_id)
            
        finally:
            if conn:
                conn.close()
        
        # Inventory value
        stock_summary = self.inventory_service.get_stock_summary()
        inventory_value = sum(item['total_value'] for item in stock_summary)
        
        return {
            'as_of_date': as_of_date,
            'financial': {
                'total_assets': total_assets,
                'total_liabilities': total_liabilities,
                'total_equity': total_equity,
                'net_profit': net_profit,
                'total_income': total_income,
                'total_expenses': total_expenses
            },
            'operational': {
                'customer_count': customer_count,
                'supplier_count': supplier_count,
                'item_count': item_count,
                'inventory_value': inventory_value
            },
            'ratios': {
                'current_ratio': total_assets / total_liabilities if total_liabilities > 0 else None,
                'profit_margin': (net_profit / total_income * 100) if total_income > 0 else None,
                'return_on_equity': (net_profit / total_equity * 100) if total_equity > 0 else None
            }
        }
    
    def get_sales_trend(self, months: int = 12) -> List[Dict[str, Any]]:
        """
        Get sales trend for the last N months.
        """
        end_date = date.today()
        start_date = end_date - timedelta(days=months * 30)
        
        # Group sales by month
        sales_register = self.sales_service.get_sales_register(start_date, end_date)
        
        monthly_sales: Dict[str, Decimal] = {}
        
        for sale in sales_register:
            month_key = sale['date'].strftime('%Y-%m')
            if month_key not in monthly_sales:
                monthly_sales[month_key] = Decimal('0')
            monthly_sales[month_key] += sale['grand_total']
        
        # Format for chart
        trend_data = [
            {
                'month': month,
                'sales': amount
            }
            for month, amount in sorted(monthly_sales.items())
        ]
        
        return trend_data
    
    def get_purchase_trend(self, months: int = 12) -> List[Dict[str, Any]]:
        """
        Get purchase trend for the last N months.
        """
        end_date = date.today()
        start_date = end_date - timedelta(days=months * 30)
        
        purchase_register = self.purchase_service.get_purchase_register(start_date, end_date)
        
        monthly_purchases: Dict[str, Decimal] = {}
        
        for purchase in purchase_register:
            month_key = purchase['date'].strftime('%Y-%m')
            if month_key not in monthly_purchases:
                monthly_purchases[month_key] = Decimal('0')
            monthly_purchases[month_key] += purchase['grand_total']
        
        trend_data = [
            {
                'month': month,
                'purchases': amount
            }
            for month, amount in sorted(monthly_purchases.items())
        ]
        
        return trend_data
    
    def get_inventory_status(self) -> Dict[str, Any]:
        """
        Get current inventory status including low stock alerts.
        """
        stock_summary = self.inventory_service.get_stock_summary()
        
        # Would need to compare with reorder levels from items
        low_stock_items = []
        out_of_stock_items = []
        
        for item in stock_summary:
            if item['total_quantity'] == 0:
                out_of_stock_items.append({
                    'item_code': item['item_code'],
                    'item_name': item['item_name'],
                    'category': item['category']
                })
            # Would check against reorder_level here
        
        total_inventory_value = sum(item['total_value'] for item in stock_summary)
        
        return {
            'total_items': len(stock_summary),
            'total_value': total_inventory_value,
            'out_of_stock_count': len(out_of_stock_items),
            'out_of_stock_items': out_of_stock_items[:10],  # Top 10
            'low_stock_count': len(low_stock_items),
            'low_stock_items': low_stock_items[:10]  # Top 10
        }
    
    def get_receivables_payables_summary(self) -> Dict[str, Any]:
        """
        Get summary of accounts receivable and payable.
        """
        aging_report = self.party_service.get_aging_report(date.today())
        
        total_receivables = sum(item['total_balance'] for item in aging_report)
        current_receivables = sum(item['current'] for item in aging_report)
        overdue_receivables = sum(
            item['days_1_30'] + item['days_31_60'] + item['days_61_90'] + item['days_over_90']
            for item in aging_report
        )
        
        # Calculate DSO (Days Sales Outstanding)
        # DSO = (Accounts Receivable / Total Credit Sales) * Number of Days
        # Simplified calculation
        dso = None  # Would need credit sales data
        
        return {
            'receivables': {
                'total': total_receivables,
                'current': current_receivables,
                'overdue': overdue_receivables,
                'aging_breakdown': {
                    'current': current_receivables,
                    '1_30_days': sum(item['days_1_30'] for item in aging_report),
                    '31_60_days': sum(item['days_31_60'] for item in aging_report),
                    '61_90_days': sum(item['days_61_90'] for item in aging_report),
                    'over_90_days': sum(item['days_over_90'] for item in aging_report)
                }
            },
            'payables': {
                # Similar structure for payables (would query suppliers)
                'total': Decimal('0'),
                'current': Decimal('0'),
                'overdue': Decimal('0')
            },
            'dso': dso
        }
    
    def get_cash_flow_summary(self, months: int = 3) -> Dict[str, Any]:
        """
        Get cash flow summary for recent period.
        """
        end_date = date.today()
        start_date = end_date - timedelta(days=months * 30)
        
        # Get cash book data
        cash_book = []  # payment_service.get_cash_book(start_date, end_date)
        
        total_receipts = Decimal('0')
        total_payments = Decimal('0')
        
        operating_cash_flow = Decimal('0')
        investing_cash_flow = Decimal('0')
        financing_cash_flow = Decimal('0')
        
        # Classify cash flows (simplified)
        # In production, would classify based on account mappings
        
        return {
            'period': {
                'start': start_date,
                'end': end_date
            },
            'cash_flows': {
                'operating': operating_cash_flow,
                'investing': investing_cash_flow,
                'financing': financing_cash_flow
            },
            'net_change': operating_cash_flow + investing_cash_flow + financing_cash_flow,
            'opening_balance': Decimal('0'),  # Would get from prior period
            'closing_balance': Decimal('0')  # Would calculate
        }
    
    def get_top_customers(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get top customers by sales volume.
        """
        # Get all sales for the year
        year_start = date(date.today().year, 1, 1)
        sales_register = self.sales_service.get_sales_register(year_start, date.today())
        
        # Aggregate by customer
        customer_sales: Dict[str, Decimal] = {}
        
        for sale in sales_register:
            customer_id = sale.get('customer_id', '')
            if customer_id not in customer_sales:
                customer_sales[customer_id] = Decimal('0')
            customer_sales[customer_id] += sale['grand_total']
        
        # Sort and return top N
        sorted_customers = sorted(
            customer_sales.items(),
            key=lambda x: x[1],
            reverse=True
        )[:limit]
        
        return [
            {
                'customer_id': cid,
                'total_sales': amount,
                'percentage': None  # Would calculate percentage of total
            }
            for cid, amount in sorted_customers
        ]
    
    def get_top_items(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get top selling items by quantity/value.
        """
        # Would query sales invoice items aggregated by item
        # Simplified implementation
        
        return []
    
    def get_dashboard_widgets(self) -> Dict[str, Any]:
        """
        Get complete dashboard data for all widgets.
        """
        return {
            'kpi_summary': self.get_kpi_summary(),
            'inventory_status': self.get_inventory_status(),
            'receivables_payables': self.get_receivables_payables_summary(),
            'sales_trend': self.get_sales_trend(6),
            'purchase_trend': self.get_purchase_trend(6),
            'top_customers': self.get_top_customers(5),
            'cash_flow': self.get_cash_flow_summary(1)
        }
