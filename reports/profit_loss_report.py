# profit_loss_report.py
"""Profit & Loss Statement Report - OPTIMIZED with single query."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from reports.report_base import Report


class ProfitLossReport(Report):
    """Profit & Loss Statement - Revenue minus Expenses - OPTIMIZED."""

    def __init__(self):
        super().__init__()
        self.title = "Profit & Loss Statement"

    def generate(self) -> dict:
        """Generate P&L report with ONE query."""
        date_from = self.date_from or datetime.now().replace(day=1).strftime("%Y-%m-%d")
        date_to = self.date_to or datetime.now().strftime("%Y-%m-%d")
        company_id = 1

        # ONE QUERY - gets all revenue and expense accounts
        rows = self.db.fetch_all("""
            SELECT 
                a.id,
                a.account_code,
                a.account_name,
                a.account_type,
                COALESCE(SUM(jel.credit - jel.debit), 0) as balance
            FROM accounts a
            LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
            LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
            WHERE a.company_id = ?
            AND a.account_type IN ('REVENUE', 'EXPENSE')
            AND a.is_active = 1
            AND je.is_posted = 1
            AND je.entry_date >= ? AND je.entry_date <= ?
            GROUP BY a.id
            HAVING balance != 0
            ORDER BY a.account_code
        """, (company_id, date_from, date_to))

        sales = []
        other_income = []
        cost_of_sales = []
        general_admin = []
        selling_dist = []
        other_operating = []
        finance_cost = []
        
        total_sales = Decimal('0')
        total_cogs = Decimal('0')
        total_general_admin = Decimal('0')
        total_selling_dist = Decimal('0')
        total_other_operating = Decimal('0')
        total_finance = Decimal('0')
        total_other_income = Decimal('0')

        for row in rows:
            amount = Decimal(str(row['balance']))
            code = row['account_code']
            name = row['account_name'].lower()
            
            item = {
                "code": code,
                "name": row['account_name'],
                "amount": float(amount),
                "_amount": amount
            }
            
            if row['account_type'] == 'REVENUE':
                if code.startswith('40'):
                    sales.append(item)
                    total_sales += amount
                else:
                    other_income.append(item)
                    total_other_income += amount
            else:  # EXPENSE
                if code.startswith('5'):
                    cost_of_sales.append(item)
                    total_cogs += amount
                elif code.startswith('6'):
                    general_admin.append(item)
                    total_general_admin += amount
                elif code.startswith('7'):
                    selling_dist.append(item)
                    total_selling_dist += amount
                elif 'interest' in name or 'finance' in name or 'bank' in name:
                    finance_cost.append(item)
                    total_finance += amount
                else:
                    other_operating.append(item)
                    total_other_operating += amount

        total_sales_float = float(total_sales)
        total_cogs_float = float(total_cogs)
        gross_profit = total_sales_float - total_cogs_float
        total_operating_expenses = float(total_general_admin + total_selling_dist + total_other_operating)
        total_other_income_float = float(total_other_income)
        profit_from_operations = gross_profit - total_operating_expenses + total_other_income_float
        total_finance_float = float(total_finance)
        net_profit = profit_from_operations - total_finance_float

        return {
            "title": "Profit & Loss Statement",
            "date_from": date_from,
            "date_to": date_to,
            "generated_at": datetime.now().isoformat(),
            "period_label": f"Period: {date_from} to {date_to}",
            "sales": sales,
            "total_sales": total_sales_float,
            "cost_of_sales": cost_of_sales,
            "total_cost_of_sales": total_cogs_float,
            "gross_profit": gross_profit,
            "general_admin": general_admin,
            "total_general_admin": float(total_general_admin),
            "selling_distribution": selling_dist,
            "total_selling_distribution": float(total_selling_dist),
            "other_operating": other_operating,
            "total_other_operating": float(total_other_operating),
            "total_operating_expenses": total_operating_expenses,
            "other_income": other_income,
            "total_other_income": total_other_income_float,
            "profit_from_operations": profit_from_operations,
            "finance_cost": finance_cost,
            "total_finance_cost": total_finance_float,
            "profit_before_tax": profit_from_operations - total_finance_float,
            "net_profit": net_profit,
            "is_profit": net_profit >= 0,
            "expenses": cost_of_sales + general_admin + selling_dist + other_operating + finance_cost,
            "all_expenses": cost_of_sales + general_admin + selling_dist + other_operating + finance_cost,
            "total_expenses": total_cogs_float + total_operating_expenses + total_finance_float,
            "revenue": sales,
            "total_revenue": total_sales_float,
        }