"""
Core double-entry accounting engine.

Every other service that needs to record money movement (sales,
purchases, payments, receipts, manufacturing, stock adjustments)
calls `AccountingService.post_journal_entry(...)` instead of touching
journal_entries/journal_entry_lines directly. This is what guarantees:

  1. Every entry is balanced (sum(debit) == sum(credit)) before it is
     ever written to disk.
  2. Every entry gets a sequential, gap-free voucher number per type.
  3. Every entry is traceable back to its originating document via
     source_table/source_id.

Business modules should never import repositories.journal_repository
directly -- they go through this service.
"""
from __future__ import annotations

from dataclasses import dataclass

from database.connection import DatabaseConnection, get_db
from models.enums import VoucherType
from repositories.account_repository import AccountRepository
from repositories.journal_repository import JournalRepository
from utils.exceptions import UnbalancedJournalEntryError, ValidationError
from utils.logger import get_logger

logger = get_logger(__name__)

_ROUNDING_TOLERANCE = 0.01


@dataclass
class JournalLine:
    account_id: int
    debit: float = 0.0
    credit: float = 0.0
    party_id: int | None = None
    description: str | None = None

    def __post_init__(self) -> None:
        if self.debit and self.credit:
            raise ValidationError("A journal line cannot have both debit and credit.")
        if self.debit < 0 or self.credit < 0:
            raise ValidationError("Journal line amounts cannot be negative.")


class AccountingService:
    def __init__(self, db: DatabaseConnection | None = None):
        self.db = db or get_db()
        self.journal_repo = JournalRepository(self.db)
        self.account_repo = AccountRepository(self.db)

    def post_journal_entry(
        self,
        *,
        voucher_type: VoucherType,
        entry_date: str,
        lines: list[JournalLine],
        narration: str | None = None,
        reference_no: str | None = None,
        source_table: str | None = None,
        source_id: int | None = None,
        created_by: int | None = None,
        company_id: int = 1,
        voucher_number: str | None = None,
    ) -> int:
        """
        Validates and writes one balanced journal entry. Returns the new
        journal_entries.id. Must be called from within a `db.transaction()`
        block owned by the caller when it accompanies other writes (e.g.
        inserting the sales invoice row), so the document and its
        accounting entry commit or roll back together.
        """
        if len(lines) < 2:
            raise ValidationError("A journal entry needs at least two lines.")

        total_debit = round(sum(l.debit for l in lines), 2)
        total_credit = round(sum(l.credit for l in lines), 2)
        if abs(total_debit - total_credit) > _ROUNDING_TOLERANCE:
            raise UnbalancedJournalEntryError(
                f"Journal entry not balanced: debit={total_debit}, credit={total_credit}"
            )

        voucher_number = voucher_number or self.journal_repo.next_voucher_number(
            company_id, voucher_type.value
        )

        header = {
            "company_id": company_id,
            "voucher_number": voucher_number,
            "voucher_type": voucher_type.value,
            "entry_date": entry_date,
            "reference_no": reference_no,
            "narration": narration,
            "source_table": source_table,
            "source_id": source_id,
            "is_posted": 1,
            "created_by": created_by,
        }
        line_dicts = [
            {
                "account_id": l.account_id,
                "party_id": l.party_id,
                "debit": round(l.debit, 2),
                "credit": round(l.credit, 2),
                "description": l.description,
            }
            for l in lines
        ]
        entry_id = self.journal_repo.insert_entry(header, line_dicts)
        logger.info(
            "Posted journal entry #%s (%s) voucher=%s amount=%.2f",
            entry_id, voucher_type.value, voucher_number, total_debit,
        )
        return entry_id

    def get_account_balance(self, account_id: int) -> float:
        return self.account_repo.get_current_balance(account_id)

    def get_trial_balance(self, company_id: int = 1) -> list[dict]:
        accounts = self.account_repo.find_all_for_company(company_id)
        rows = []
        for acc in accounts:
            balance = self.account_repo.get_current_balance(acc["id"])
            debit_normal = acc["account_type"] in ("ASSET", "EXPENSE")
            rows.append(
                {
                    "account_code": acc["account_code"],
                    "account_name": acc["account_name"],
                    "account_type": acc["account_type"],
                    "debit": balance if debit_normal and balance >= 0 else
                             (-balance if not debit_normal and balance < 0 else 0),
                    "credit": balance if not debit_normal and balance >= 0 else
                              (-balance if debit_normal and balance < 0 else 0),
                }
            )
        return rows
