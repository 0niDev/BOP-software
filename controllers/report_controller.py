"""Controller for Reports."""
from __future__ import annotations

from reports.trial_balance_report import TrialBalanceReport
from reports.profit_loss_report import ProfitLossReport
from reports.balance_sheet_report import BalanceSheetReport
from reports.party_ledger_report import PartyLedgerReport
from reports.cash_book_report import CashBookReport
from database.connection import get_db
from utils.exceptions import ERPException
from utils.logger import get_logger

logger = get_logger(__name__)


class ReportController:
    """Controller for generating reports."""

    def __init__(self):
        self.db = get_db()

    def get_trial_balance(self) -> tuple[dict | None, str | None]:
        """Generate Trial Balance."""
        try:
            report = TrialBalanceReport()
            data = report.generate()
            
            # Add parties summary from controller (using the same date range)
            parties_summary = self._build_parties_summary(
                report.date_from,
                report.date_to
            )
            data["parties_summary"] = parties_summary
            
            return data, None
        except ERPException as exc:
            return None, str(exc)
        except Exception:
            logger.exception("Unexpected error generating trial balance")
            return None, "An unexpected error occurred."

    def _build_parties_summary(self, date_from: str | None = None, date_to: str | None = None) -> list[dict]:
        """Build parties summary from journal entries.
        Note: Opening balances at account level don't have party information,
        so we only show current period transactions for parties."""
        
        params = [1]  # company_id = 1
        date_filter = ""
        
        if date_from and date_to:
            date_filter = "AND je.entry_date >= ? AND je.entry_date <= ?"
            params.extend([date_from, date_to])

        parties_data = self.db.fetch_all(f"""
            SELECT 
                p.id as party_id,
                p.code as party_code,
                p.name as party_name,
                p.party_type,
                jel.account_id,
                jel.debit,
                jel.credit,
                je.entry_date,
                a.account_type
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.id = jel.journal_entry_id
            JOIN parties p ON p.id = jel.party_id
            JOIN accounts a ON a.id = jel.account_id
            WHERE je.is_posted = 1
            AND je.company_id = ?
            AND jel.party_id IS NOT NULL
            {date_filter}
            ORDER BY p.name, je.entry_date
        """, tuple(params))
        
        if not parties_data:
            return []
        
        # Group by party
        party_map = {}
        
        for row in parties_data:
            party_id = row['party_id']
            
            if party_id not in party_map:
                party_map[party_id] = {
                    'party_id': party_id,
                    'party_code': row['party_code'],
                    'party_name': row['party_name'],
                    'party_type': row['party_type'],
                    'opening_debit': 0.0,  # Cannot determine opening balance by party
                    'opening_credit': 0.0,  # Opening balances don't have party info
                    'current_debit': 0.0,
                    'current_credit': 0.0,
                }
            
            # Current period transactions only (opening balances don't have party info)
            debit = row['debit'] or 0.0
            credit = row['credit'] or 0.0
            
            party_map[party_id]['current_debit'] += debit
            party_map[party_id]['current_credit'] += credit
        
        # Build result list
        result = []
        for party_id, data in party_map.items():
            net = data['current_debit'] - data['current_credit']
            
            if net > 0.01:
                balance_type = 'Receivable'
            elif net < -0.01:
                balance_type = 'Payable'
            else:
                balance_type = 'Zero'
            
            result.append({
                'party_id': data['party_id'],
                'party_code': data['party_code'],
                'party_name': data['party_name'],
                'party_type': data['party_type'],
                'opening_debit': round(data['opening_debit'], 2),
                'opening_credit': round(data['opening_credit'], 2),
                'current_debit': round(data['current_debit'], 2),
                'current_credit': round(data['current_credit'], 2),
                'net_balance': round(net, 2),
                'balance_type': balance_type,
            })
        
        result.sort(key=lambda x: x['party_name'])
        return result

    def get_profit_loss(self, date_from: str, date_to: str) -> tuple[dict | None, str | None]:
        """Generate Profit & Loss Statement."""
        try:
            report = ProfitLossReport()
            report.set_date_range(date_from, date_to)
            data = report.generate()
            return data, None
        except ERPException as exc:
            return None, str(exc)
        except Exception:
            logger.exception("Unexpected error generating P&L")
            return None, "An unexpected error occurred."

    def get_balance_sheet(self) -> tuple[dict | None, str | None]:
        """Generate Balance Sheet."""
        try:
            report = BalanceSheetReport()
            data = report.generate()
            return data, None
        except ERPException as exc:
            return None, str(exc)
        except Exception:
            logger.exception("Unexpected error generating balance sheet")
            return None, "An unexpected error occurred."

# In report_controller.py - get_party_ledger method

    def get_party_ledger(self, party_id: int) -> tuple[dict | None, str | None]:
        """Generate Party Ledger."""
        try:
            report = PartyLedgerReport(party_id)
            # ✅ Set date range if available
            if hasattr(self, 'date_from') and self.date_from:
                report.set_date_range(self.date_from, self.date_to)
            data = report.generate()
            return data, None
        except ERPException as exc:
            return None, str(exc)
        except Exception:
            logger.exception("Unexpected error generating party ledger")
            return None, "An unexpected error occurred."
    def get_cash_book(self, date_from: str, date_to: str) -> tuple[dict | None, str | None]:
        """Generate Cash Book."""
        try:
            report = CashBookReport()
            report.set_date_range(date_from, date_to)
            data = report.generate()
            return data, None
        except ERPException as exc:
            return None, str(exc)
        except Exception:
            logger.exception("Unexpected error generating cash book")
            return None, "An unexpected error occurred."