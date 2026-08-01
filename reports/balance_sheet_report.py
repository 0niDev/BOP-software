"""Balance Sheet Report - OPTIMIZED with single query."""
from __future__ import annotations

from datetime import datetime

from reports.report_base import Report


class BalanceSheetReport(Report):
    """Balance Sheet - Assets = Liabilities + Equity - OPTIMIZED."""

    def __init__(self):
        super().__init__()
        self.title = "Balance Sheet"

    def generate(self) -> dict:
        """Generate Balance Sheet with ONE query."""
        company_id = 1

        # ONE QUERY - gets all accounts with balances
        rows = self.db.fetch_all("""
            SELECT 
                a.account_code,
                a.account_name,
                a.account_type,
                COALESCE(SUM(jel.debit - jel.credit), 0) as balance
            FROM accounts a
            LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
            LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.is_posted = 1
            WHERE a.company_id = ? AND a.is_active = 1
            GROUP BY a.id
            HAVING balance != 0
            ORDER BY a.account_code
        """, (company_id,))

        assets = []
        liabilities = []
        equity = []
        revenue = []
        expenses = []

        for row in rows:
            item = {
                "code": row['account_code'],
                "name": row['account_name'],
                "balance": round(row['balance'], 2)
            }
            if row['account_type'] == 'ASSET':
                assets.append(item)
            elif row['account_type'] == 'LIABILITY':
                liabilities.append(item)
            elif row['account_type'] == 'EQUITY':
                equity.append(item)
            elif row['account_type'] == 'REVENUE':
                revenue.append(item)
            elif row['account_type'] == 'EXPENSE':
                expenses.append(item)

        # Calculate retained earnings (profit/loss)
        total_revenue = sum(r['balance'] for r in revenue)
        total_expenses = sum(e['balance'] for e in expenses)
        retained_earnings = total_revenue - total_expenses

        # Separate current and non-current assets (code < 2000 = current)
        current_assets = []
        non_current_assets = []
        for a in assets:
            try:
                code_num = int(a['code'])
            except:
                code_num = 0
            if code_num < 2000:
                current_assets.append(a)
            else:
                non_current_assets.append(a)

        # Separate current and non-current liabilities (code < 3000 = current)
        current_liabilities = []
        non_current_liabilities = []
        for l in liabilities:
            try:
                code_num = int(l['code'])
            except:
                code_num = 0
            if code_num < 3000:
                current_liabilities.append(l)
            else:
                non_current_liabilities.append(l)

        total_current_assets = sum(a['balance'] for a in current_assets)
        total_non_current_assets = sum(a['balance'] for a in non_current_assets)
        total_assets = total_current_assets + total_non_current_assets

        total_current_liabilities = sum(l['balance'] for l in current_liabilities)
        total_non_current_liabilities = sum(l['balance'] for l in non_current_liabilities)
        total_liabilities = total_current_liabilities + total_non_current_liabilities

        total_equity = sum(e['balance'] for e in equity) + retained_earnings
        total_liabilities_and_equity = total_liabilities + total_equity

        # Calculate share capital
        share_capital = 0
        for eq in equity:
            if 'owner' in eq['name'].lower() or 'share capital' in eq['name'].lower():
                share_capital += eq['balance']

        is_balanced = abs(total_assets - total_liabilities_and_equity) < 0.01

        return {
            "title": "Balance Sheet",
            "as_at": datetime.now().strftime("%B %d, %Y"),
            "non_current_assets": non_current_assets,
            "total_non_current_assets": round(total_non_current_assets, 2),
            "current_assets": current_assets,
            "total_current_assets": round(total_current_assets, 2),
            "total_assets": round(total_assets, 2),
            "equity": equity,
            "total_equity": round(total_equity, 2),
            "retained_earnings": round(retained_earnings, 2),
            "issued_capital": round(share_capital, 2),
            "authorised_capital": round(share_capital, 2),
            "non_current_liabilities": non_current_liabilities,
            "total_non_current_liabilities": round(total_non_current_liabilities, 2),
            "current_liabilities": current_liabilities,
            "total_current_liabilities": round(total_current_liabilities, 2),
            "total_liabilities": round(total_liabilities, 2),
            "total_liabilities_and_equity": round(total_liabilities_and_equity, 2),
            "is_balanced": is_balanced
        }