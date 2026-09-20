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

    def get_trial_balance(
        self,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> tuple[dict | None, str | None]:
        """Generate Trial Balance for an optional date range."""
        try:
            report = TrialBalanceReport()
            if date_from and date_to:
                report.set_date_range(date_from, date_to)
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

        OPENING-voucher party lines (per-party opening balances imported from
        PharmaPro) are shown in the Opening columns; all other posted party lines
        (optionally date-filtered) are shown in the Current columns.
        Net Balance = (Opening + Current) Dr - (Opening + Current) Cr.
        """
        # ---- Opening balances: OPENING vouchers that carry a party ----
        opening_rows = self.db.fetch_all("""
            SELECT
                p.id as party_id,
                p.code as party_code,
                p.name as party_name,
                p.party_type,
                COALESCE(SUM(jel.debit), 0) as odr,
                COALESCE(SUM(jel.credit), 0) as ocr
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.id = jel.journal_entry_id
            JOIN parties p ON p.id = jel.party_id
            WHERE je.is_posted = 1
              AND je.company_id = ?
              AND jel.party_id IS NOT NULL
              AND je.voucher_type = 'OPENING'
            GROUP BY p.id
        """, (1,))

        # ---- Current balances: all posted non-OPENING party lines ----
        params = [1]  # company_id = 1
        current_filter = ""
        if date_from and date_to:
            current_filter = "AND je.entry_date >= ? AND je.entry_date <= ?"
            params.extend([date_from, date_to])

        current_rows = self.db.fetch_all(f"""
            SELECT
                p.id as party_id,
                p.code as party_code,
                p.name as party_name,
                p.party_type,
                COALESCE(SUM(jel.debit), 0) as tdr,
                COALESCE(SUM(jel.credit), 0) as tcr
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.id = jel.journal_entry_id
            JOIN parties p ON p.id = jel.party_id
            WHERE je.is_posted = 1
              AND je.company_id = ?
              AND jel.party_id IS NOT NULL
              AND je.voucher_type != 'OPENING'
              {current_filter}
            GROUP BY p.id
        """, tuple(params))

        if not opening_rows and not current_rows:
            return []

        party_map = {}
        for row in opening_rows:
            pid = row['party_id']
            d = party_map.setdefault(pid, {
                'party_id': pid,
                'party_code': row['party_code'],
                'party_name': row['party_name'],
                'party_type': row['party_type'],
                'opening_debit': 0.0,
                'opening_credit': 0.0,
                'current_debit': 0.0,
                'current_credit': 0.0,
            })
            d['opening_debit'] += row['odr'] or 0.0
            d['opening_credit'] += row['ocr'] or 0.0

        for row in current_rows:
            pid = row['party_id']
            d = party_map.setdefault(pid, {
                'party_id': pid,
                'party_code': row['party_code'],
                'party_name': row['party_name'],
                'party_type': row['party_type'],
                'opening_debit': 0.0,
                'opening_credit': 0.0,
                'current_debit': 0.0,
                'current_credit': 0.0,
            })
            d['current_debit'] += row['tdr'] or 0.0
            d['current_credit'] += row['tcr'] or 0.0

        result = []
        for pid, data in party_map.items():
            net = (data['opening_debit'] + data['current_debit']) - \
                  (data['opening_credit'] + data['current_credit'])

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

    def get_balance_sheet(self, date_to: str | None = None) -> tuple[dict | None, str | None]:
        """Generate Balance Sheet as at date_to (or as of today if not given)."""
        try:
            report = BalanceSheetReport()
            if date_to:
                report.date_to = date_to
            data = report.generate()
            return data, None
        except ERPException as exc:
            return None, str(exc)
        except Exception:
            logger.exception("Unexpected error generating balance sheet")
            return None, "An unexpected error occurred."

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