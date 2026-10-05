# party_ledger_report.py - OPTIMIZED VERSION

"""Party Ledger Report - Fixed for both Customers and Suppliers - OPTIMIZED."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from reports.report_base import Report


class PartyLedgerReport(Report):
    """Party Ledger - all transactions for a party (Customer OR Supplier)."""

    def __init__(self, party_id: int):
        super().__init__()
        self.party_id = party_id
        self.title = "Party Ledger"

    def generate(self) -> dict:
        """Generate party ledger with correct balance calculation - OPTIMIZED."""
        # ONE QUERY for party details
        party = self.db.fetch_one("""
            SELECT 
                p.id, p.code, p.name, p.party_type, p.account_id
            FROM parties p
            WHERE p.id = ?
        """, (self.party_id,))

        if not party:
            return {"error": "Party not found"}

        # Determine party type
        is_customer = party["party_type"] in ["CUSTOMER", "BOTH"]
        is_supplier = party["party_type"] in ["SUPPLIER", "BOTH"]

        # Opening balance = this party's own pre-period OPENING vouchers - the
        # same journal-only source TB/BS use (the accounts opening-balance
        # column is legacy and those reports ignore it; reading it here made
        # the report families disagree). In-range OPENING lines appear in
        # transactions.
        opening_balance = Decimal("0")
        if self.date_from:
            row = self.db.fetch_one("""
                SELECT COALESCE(SUM(jel.debit - jel.credit), 0) AS ob
                FROM journal_entry_lines jel
                JOIN journal_entries je ON je.id = jel.journal_entry_id
                WHERE jel.party_id = ? AND je.voucher_type = 'OPENING'
                  AND je.is_posted = 1 AND je.entry_date < ?
            """, (self.party_id, self.date_from))
            net = Decimal(str(row["ob"] if row else 0))
            opening_balance = net if is_customer else -net

        # ONE QUERY for ALL transactions
        params = [self.party_id]
        date_filter = ""

        if self.date_from and self.date_to:
            date_filter = "AND je.entry_date >= ? AND je.entry_date <= ?"
            params.extend([self.date_from, self.date_to])

        transactions = self.db.fetch_all(f"""
            SELECT 
                je.entry_date,
                je.voucher_number,
                je.voucher_type,
                jel.debit,
                jel.credit,
                jel.description,
                a.account_code,
                a.account_name
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.id = jel.journal_entry_id
            JOIN accounts a ON a.id = jel.account_id
            WHERE jel.party_id = ? AND je.is_posted = 1
            {date_filter}
            ORDER BY je.entry_date, je.id
        """, tuple(params))

        # Calculate running balance
        balance = opening_balance
        result_transactions = []
        total_debit = Decimal('0')
        total_credit = Decimal('0')

        for txn in transactions:
            debit = Decimal(str(txn["debit"] or 0))
            credit = Decimal(str(txn["credit"] or 0))

            if is_customer:
                balance += debit - credit
            elif is_supplier:
                balance += credit - debit
            else:
                balance += debit - credit

            total_debit += debit
            total_credit += credit

            result_transactions.append({
                "date": txn["entry_date"],
                "date_formatted": self.format_date(txn["entry_date"]),
                "voucher_number": txn["voucher_number"],
                "voucher_type": txn["voucher_type"],
                "debit": float(debit),
                "credit": float(credit),
                "description": txn["description"] or txn["voucher_type"],
                "account_code": txn["account_code"],
                "account_name": txn["account_name"],
                "balance": float(balance),
                "amount": float(debit + credit),
            })

        # Determine final balance type
        if balance > 0.01:
            if is_customer:
                balance_label = "Receivable (Customer owes us)"
                balance_type = "Receivable"
            else:
                balance_label = "Payable (We owe supplier)"
                balance_type = "Payable"
        elif balance < -0.01:
            if is_customer:
                balance_label = "Credit Balance (Customer overpaid)"
                balance_type = "Credit Balance"
            else:
                balance_label = "Debit Balance (Supplier owes us / Overpayment)"
                balance_type = "Debit Balance"
        else:
            balance_label = "Zero Balance"
            balance_type = "Zero"

        return {
            "title": f"Party Ledger - {party['name']} ({party['code']})",
            "party": party,
            "party_type": party["party_type"],
            "is_customer": is_customer,
            "is_supplier": is_supplier,
            "transactions": result_transactions,
            "opening_balance": float(opening_balance),
            "closing_balance": float(balance),
            "balance_type": balance_type,
            "balance_label": balance_label,
            "total_debit": float(total_debit),
            "total_credit": float(total_credit),
        }