"""T3.x Chart of Accounts + T4.x Opening Balance (headless; button-handler functions)."""
from __future__ import annotations

import datetime

import pytest

from helpers import books, monitor


@pytest.fixture()
def acct():
    from controllers.account_controller import AccountController
    return AccountController()


def _code_id(qa_db, code):
    return qa_db.fetch_one("SELECT id FROM accounts WHERE account_code=?", (code,))["id"]


def test_list_accounts_returns_seeded_chart(acct):
    accounts, err = acct.list_accounts(active_only=False)
    assert err is None and accounts
    codes = {a.account_code for a in accounts}
    assert {"1000", "1010", "1100", "2000", "3100", "4000", "5000", "6000"} <= codes


def test_create_account_with_opening_balance_posts_journal(qa_db, acct):
    ok, err = acct.create_account("1507", "Test Equipment", "ASSET", None, 5000.0)
    assert ok, err
    assert books.ledger_balance(qa_db, "1507") == pytest.approx(5000.0)
    assert books.ledger_balance(qa_db, "3100") == pytest.approx(-5000.0)
    row = qa_db.fetch_one("SELECT opening_balance FROM accounts WHERE account_code='1507'")
    assert row["opening_balance"] == pytest.approx(5000.0)
    books.assert_books_balanced(qa_db)
    monitor.monitor_reports(qa_db)


def test_create_liability_account_with_opening_balance(qa_db, acct):
    ok, err = acct.create_account("2001", "Test Loan", "LIABILITY", None, 2000.0)
    assert ok, err
    # liability opening is credit-normal -> ledger balance negative in Dr-Cr convention
    assert books.ledger_balance(qa_db, "2001") == pytest.approx(-2000.0)
    books.assert_books_balanced(qa_db)


def test_duplicate_account_code_rejected(qa_db, acct):
    ok, err = acct.create_account("1000", "Another Cash", "ASSET", None, 0)
    assert not ok
    assert "already exists" in err or "duplicate" in err.lower()


def test_create_account_requires_code_and_name(qa_db, acct):
    ok, err = acct.create_account("", "No Code", "ASSET", None, 0)
    assert not ok
    ok, err = acct.create_account("1509", "", "ASSET", None, 0)
    assert not ok and "name" in err


def test_update_account_name_and_opening_adjustment(qa_db, acct):
    ok, err = acct.create_account("1510", "Old Machine", "ASSET", None, 1000.0)
    assert ok, err
    acc_id = _code_id(qa_db, "1510")
    before = books.ledger_balance(qa_db, "1510")
    ok, err = acct.update_account(acc_id, "New Machine", 3000.0, None, True)
    assert ok, err
    assert qa_db.fetch_one("SELECT account_name FROM accounts WHERE id=?", (acc_id,))["account_name"] == "New Machine"
    # adjustment 2000 more debited to asset against retained earnings
    assert books.ledger_balance(qa_db, "1510") == pytest.approx(before + 2000.0)
    books.assert_books_balanced(qa_db)


def test_system_account_cannot_be_deactivated(qa_db, acct):
    cash_id = _code_id(qa_db, "1000")
    ok, err = acct.update_account(cash_id, "Cash", 0.0, None, False)
    assert not ok and "System accounts cannot be deactivated." in err


def test_deactivate_custom_account(acct):
    ok, err = acct.create_account("1511", "Old Asset", "ASSET", None, 0)
    assert ok
    acc_id = _code_id(acct.service.db, "1511")
    ok, err = acct.deactivate_account(acc_id)
    assert ok, err
    assert acct.service.db.fetch_one("SELECT is_active FROM accounts WHERE id=?", (acc_id,))["is_active"] == 0


def test_opening_balance_dialog_math_and_posting(qa_db):
    """Replicates OpeningBalanceDialog._save exactly (services + field update)."""
    from accounting.system_accounts import SystemAccountCodes, SystemAccountResolver
    from models.enums import VoucherType
    from services.accounting_service import AccountingService, JournalLine

    acct = AccountController()
    # fresh setup: assets 40k, liabilities 12k => equity 28k
    for code, name, typ, amt in [
        ("1507", "OB Asset A", "ASSET", 25000.0),
        ("1510", "OB Asset B", "ASSET", 15000.0),
        ("2001", "OB Loan", "LIABILITY", 12000.0),
        ("3005", "OB Equity", "EQUITY", 0.0),
    ]:
        ok, err = acct.create_account(code, name, typ, None, 0.0)
        assert ok, err

    # mimic the dialog: assets listed (dr), liabilities+equity listed (cr)
    entries = [
        {"account_id": _code_id(qa_db, "1507"), "debit": 25000.0, "credit": 0.0},
        {"account_id": _code_id(qa_db, "1510"), "debit": 15000.0, "credit": 0.0},
        {"account_id": _code_id(qa_db, "2001"), "debit": 0.0, "credit": 12000.0},
    ]
    equity_id = _code_id(qa_db, "3005")
    equity_amount = sum(e["debit"] for e in entries) - sum(e["credit"] for e in entries)
    entries.append({"account_id": equity_id, "debit": 0.0, "credit": equity_amount})

    accounting = AccountingService(qa_db)
    lines = [JournalLine(account_id=e["account_id"], debit=e["debit"], credit=e["credit"],
                         description="Opening balance") for e in entries]
    with qa_db.transaction():
        accounting.post_journal_entry(voucher_type=VoucherType.OPENING,
                                      entry_date=datetime.date.today().isoformat(),
                                      lines=lines, narration="Opening balances setup")
        for e in entries:
            amount = e["debit"] if e["debit"] > 0 else e["credit"]
            qa_db.execute("UPDATE accounts SET opening_balance=? WHERE id=?",
                          (amount, e["account_id"]))

    assert books.ledger_balance(qa_db, "3005") == pytest.approx(-28000.0)
    assert books.ledger_balance(qa_db, "1507") == pytest.approx(25000.0)
    books.assert_books_balanced(qa_db)
    mon = monitor.monitor_reports(qa_db)
    # balance sheet balances and shows these assets
    assert mon["trial"]["is_balanced"] is True
