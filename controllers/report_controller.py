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
            # generate() already computes data["parties_summary"] (date-filtered
            # via set_date_range); do not rebuild it here — the duplicate query
            # doubled Trial Balance runtime at scale.
            data = report.generate()

            return data, None
        except ERPException as exc:
            return None, str(exc)
        except Exception:
            logger.exception("Unexpected error generating trial balance")
            return None, "An unexpected error occurred."

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

    def get_party_ledger(self, party_id: int, date_from: str | None = None,
                         date_to: str | None = None) -> tuple[dict | None, str | None]:
        """Generate Party Ledger."""
        try:
            report = PartyLedgerReport(party_id)
            if date_from and date_to:
                report.set_date_range(date_from, date_to)
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