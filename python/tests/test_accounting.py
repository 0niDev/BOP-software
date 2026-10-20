"""Tests for the double-entry accounting engine: AccountingService,
JournalLine validation, AccountService, and SystemAccountResolver."""
from __future__ import annotations

import pytest

from accounting.system_accounts import SystemAccountCodes, SystemAccountResolver
from models.enums import AccountType, VoucherType
from repositories.account_repository import AccountRepository
from services.accounting_service import AccountingService, JournalLine
from services.account_service import AccountService
from utils.exceptions import (
    ValidationError, UnbalancedJournalEntryError, ConfigurationError,
    DuplicateRecordError,
)


@pytest.fixture()
def svc(qa_db):
    return AccountingService(qa_db)


@pytest.fixture()
def acct_svc(qa_db):
    return AccountService(qa_db)


def _account_ids(qa_db, codes):
    repo = AccountRepository(qa_db)
    return {code: repo.find_by_code(code)["id"] for code in codes}


class TestJournalLine:
    def test_valid_line(self):
        line = JournalLine(account_id=1, debit=100)
        assert line.debit == 100 and line.credit == 0

    def test_cannot_have_both_debit_and_credit(self):
        with pytest.raises(ValidationError):
            JournalLine(account_id=1, debit=10, credit=10)

    def test_negative_amounts_rejected(self):
        with pytest.raises(ValidationError):
            JournalLine(account_id=1, debit=-1)
        with pytest.raises(ValidationError):
            JournalLine(account_id=1, credit=-5)


class TestAccountingServicePosting:
    def test_posts_balanced_entry(self, qa_db, svc):
        ids = _account_ids(qa_db, ["1000", "4000"])
        entry_id = svc.post_journal_entry(
            voucher_type=VoucherType.JOURNAL,
            entry_date="2026-01-02",
            lines=[
                JournalLine(account_id=ids["1000"], debit=500, description="cash in"),
                JournalLine(account_id=ids["4000"], credit=500, description="revenue"),
            ],
            narration="Test entry",
        )
        row = qa_db.fetch_one("SELECT * FROM journal_entries WHERE id=?", (entry_id,))
        assert row is not None
        assert row["is_posted"] == 1
        assert row["voucher_type"] == "JOURNAL"
        assert row["voucher_number"].startswith("JV-")

    def test_less_than_two_lines_rejected(self, svc):
        with pytest.raises(ValidationError):
            svc.post_journal_entry(
                voucher_type=VoucherType.JOURNAL,
                entry_date="2026-01-02",
                lines=[JournalLine(account_id=1, debit=50)],
            )

    def test_unbalanced_entry_rejected(self, qa_db, svc):
        ids = _account_ids(qa_db, ["1000", "4000"])
        with pytest.raises(UnbalancedJournalEntryError):
            svc.post_journal_entry(
                voucher_type=VoucherType.JOURNAL,
                entry_date="2026-01-02",
                lines=[
                    JournalLine(account_id=ids["1000"], debit=100),
                    JournalLine(account_id=ids["4000"], credit=99),
                ],
            )

    def test_voucher_numbers_increment(self, qa_db, svc):
        ids = _account_ids(qa_db, ["1000", "4000"])
        for _ in range(3):
            svc.post_journal_entry(
                voucher_type=VoucherType.JOURNAL,
                entry_date="2026-01-02",
                lines=[
                    JournalLine(account_id=ids["1000"], debit=10),
                    JournalLine(account_id=ids["4000"], credit=10),
                ],
            )
        numbers = [
            r["voucher_number"] for r in qa_db.fetch_all(
                "SELECT voucher_number FROM journal_entries WHERE voucher_type='JOURNAL' ORDER BY id"
            )
        ]
        assert len(set(numbers)) == 3
        nums = [int(n.split("-")[1]) for n in numbers]
        assert nums == sorted(nums)

    def test_get_journal_entry_by_source(self, qa_db, svc):
        ids = _account_ids(qa_db, ["1000", "4000"])
        entry_id = svc.post_journal_entry(
            voucher_type=VoucherType.SALES,
            entry_date="2026-01-02",
            lines=[
                JournalLine(account_id=ids["1000"], debit=200),
                JournalLine(account_id=ids["4000"], credit=200),
            ],
            source_table="sales_invoices", source_id=42,
        )
        entry = svc.get_journal_entry("sales_invoices", 42)
        assert entry is not None and entry["id"] == entry_id
        assert len(entry["lines"]) == 2
        assert svc.get_journal_entry("sales_invoices", 999) is None


class TestAccountService:
    def test_create_account(self, acct_svc):
        account = acct_svc.create_account(
            account_code="9990", account_name="Test Expense",
            account_type=AccountType.EXPENSE, account_subtype="OTHER",
        )
        assert account.id is not None
        assert account.is_active is True

    def test_create_duplicate_code_raises(self, acct_svc):
        acct_svc.create_account("8880", "First", AccountType.ASSET)
        with pytest.raises((DuplicateRecordError, ValidationError)):
            acct_svc.create_account("8880", "Second", AccountType.ASSET)

    def test_create_blank_code_raises(self, acct_svc):
        with pytest.raises(ValidationError):
            acct_svc.create_account("  ", "X", AccountType.ASSET)

    def test_list_and_by_type(self, acct_svc):
        acct_svc.create_account("7770", "OpEx", AccountType.EXPENSE)
        acct_svc.create_account("7780", "OpEx2", AccountType.EXPENSE)
        accounts = acct_svc.list_accounts()
        codes = {a.account_code for a in accounts}
        assert {"7770", "7780"} <= codes
        expense = acct_svc.list_by_type(AccountType.EXPENSE)
        assert "7770" in {a.account_code for a in expense}

    def test_get_account(self, acct_svc):
        account = acct_svc.create_account("6660", "Find", AccountType.ASSET)
        fetched = acct_svc.get_account(account.id)
        assert fetched.account_name == "Find"

    def test_deactivate_system_account_raises(self, acct_svc, qa_db):
        system = AccountRepository(qa_db).find_by_code("1000")
        with pytest.raises(ValidationError):
            acct_svc.deactivate_account(system["id"])

    def test_deactivate_custom_account(self, acct_svc):
        account = acct_svc.create_account("5550", "Temp", AccountType.EXPENSE)
        acct_svc.deactivate_account(account.id)
        assert acct_svc.get_account(account.id).is_active is False

    def test_opening_balance_posts_journal(self, qa_db, acct_svc):
        from helpers import books
        account = acct_svc.create_account(
            "5540", "OB Account", AccountType.ASSET, opening_balance=1000.0
        )
        # opening balance should create an OPENING journal: debit asset / credit equity
        asset_bal = books.ledger_balance(qa_db, "5540")
        assert abs(asset_bal - 1000.0) < 0.01
        books.assert_books_balanced(qa_db)


class TestSystemAccountResolver:
    def test_resolves_seeded_codes(self, qa_db):
        resolver = SystemAccountResolver(qa_db)
        assert resolver.id_for("1000") == AccountRepository(qa_db).find_by_code("1000")["id"]

    def test_missing_code_raises(self, qa_db):
        resolver = SystemAccountResolver(qa_db)
        qa_db.execute("DELETE FROM accounts WHERE account_code='9999'")
        with pytest.raises(ConfigurationError):
            resolver.id_for("9999")

    def test_system_codes_constants(self):
        assert SystemAccountCodes.CASH_IN_HAND == "1000"
        assert SystemAccountCodes.ACCOUNTS_PAYABLE == "2000"
        assert SystemAccountCodes.RETAINED_EARNINGS == "3100"