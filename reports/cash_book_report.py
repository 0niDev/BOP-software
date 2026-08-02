"""Cash Book Report - OPTIMIZED."""
from __future__ import annotations

from datetime import datetime

from reports.report_base import Report


class CashBookReport(Report):
    """Cash Book - all cash and bank transactions - OPTIMIZED."""

    def __init__(self):
        super().__init__()
        self.title = "Cash Book"

    def generate(self) -> dict:
        """Generate cash book with ONE query."""
        date_from = self.date_from or datetime.now().replace(day=1).strftime("%Y-%m-%d")
        date_to = self.date_to or datetime.now().strftime("%Y-%m-%d")

        # ONE QUERY - gets all cash and bank transactions
        rows = self.db.fetch_all("""
            SELECT 
                je.entry_date,
                je.voucher_number,
                je.voucher_type,
                jel.debit,
                jel.credit,
                jel.description,
                a.account_code
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.id = jel.journal_entry_id
            JOIN accounts a ON a.id = jel.account_id
            WHERE je.is_posted = 1
            AND a.account_code IN ('1000', '1010')
            AND je.entry_date >= ? AND je.entry_date <= ?
            ORDER BY je.entry_date, je.id
        """, (date_from, date_to))

        cash_in = 0.0
        cash_out = 0.0
        transactions = []

        for row in rows:
            if row['debit'] and row['debit'] > 0:
                cash_in += row['debit']
                transactions.append({
                    "date": self.format_date(row["entry_date"]),
                    "voucher": row['voucher_number'],
                    "description": row['description'] or row['voucher_type'],
                    "account": row['account_code'],
                    "received": round(row['debit'], 2),
                    "paid": 0,
                    "balance": round(cash_in - cash_out, 2)
                })
            elif row['credit'] and row['credit'] > 0:
                cash_out += row['credit']
                transactions.append({
                    "date": self.format_date(row["entry_date"]),
                    "voucher": row['voucher_number'],
                    "description": row['description'] or row['voucher_type'],
                    "account": row['account_code'],
                    "received": 0,
                    "paid": round(row['credit'], 2),
                    "balance": round(cash_in - cash_out, 2)
                })

        return {
            "title": self.title,
            "date_from": date_from,
            "date_to": date_to,
            "opening_balance": 0,
            "transactions": transactions,
            "total_received": round(cash_in, 2),
            "total_paid": round(cash_out, 2),
            "closing_balance": round(cash_in - cash_out, 2)
        }