"""Tests for BankingService (bank accounts, deposits, withdrawals, cheques)
and the BankingController."""
from __future__ import annotations

import pytest

from services.banking_service import BankingService
from utils.exceptions import ValidationError


@pytest.fixture()
def svc(qa_db):
    return BankingService(qa_db)


class TestBankAccounts:
    def test_create_bank_account(self, svc):
        account = svc.create_bank_account(
            bank_name="HBL", account_title="Main", account_number="1234567890",
            opening_balance=1000.0,
        )
        assert account.id is not None
        assert account.opening_balance == 1000.0

    def test_create_blank_bank_name_raises(self, svc):
        with pytest.raises(ValidationError):
            svc.create_bank_account(bank_name="  ", account_title="X", account_number="1")

    def test_get_balance_equals_opening(self, svc):
        account = svc.create_bank_account(
            bank_name="UBL", account_title="Savings", account_number="111", opening_balance=5000.0
        )
        assert svc.get_balance(account.id) == 5000.0

    def test_deposit_increases_balance(self, svc):
        account = svc.create_bank_account("MCB", "A", "222", opening_balance=100.0)
        svc.deposit(account.id, amount=50, transaction_date="2026-01-01", reference_no="R1")
        assert svc.get_balance(account.id) == 150.0

    def test_withdraw_decreases_balance(self, svc):
        account = svc.create_bank_account("NBP", "A", "333", opening_balance=100.0)
        svc.withdraw(account.id, amount=30, transaction_date="2026-01-01", reference_no="R2")
        assert svc.get_balance(account.id) == 70.0

    def test_invalid_transaction_amount_raises(self, svc):
        account = svc.create_bank_account("ABL", "A", "444", opening_balance=0)
        with pytest.raises(ValidationError):
            svc.deposit(account.id, amount=0, transaction_date="2026-01-01")
        with pytest.raises(ValidationError):
            svc.deposit(account.id, amount=-10, transaction_date="2026-01-01")

    def test_deposit_records_transaction_and_journal(self, qa_db, svc):
        from helpers import books
        account = svc.create_bank_account("BK", "A", "555", opening_balance=0)
        svc.deposit(account.id, amount=200, transaction_date="2026-01-02", reference_no="D1")
        txn = qa_db.fetch_one("SELECT * FROM bank_transactions WHERE bank_account_id=?", (account.id,))
        assert txn is not None and txn["transaction_type"] == "DEPOSIT"
        # deposit debits bank (1010)
        assert abs(books.ledger_balance(qa_db, "1010") - 200.0) < 0.01
        books.assert_books_balanced(qa_db)


class TestCheques:
    def _setup(self, qa_db):
        from helpers import seed as s
        bank = s.make_bank_account(qa_db, "HBL", account_title="Main", account_number="123")
        sup = s.supplier(qa_db, "Cheque Supplier")
        cust = s.customer(qa_db, "Cheque Customer")
        return bank, sup, cust

    def test_issue_cheque(self, qa_db, svc):
        bank, sup, _ = self._setup(qa_db)
        cheque = svc.issue_cheque(
            bank_account_id=bank.id, party_id=sup.id, cheque_number="CHK-001",
            amount=1000, cheque_date="2026-01-05",
        )
        assert cheque is not None and cheque.cheque_type == "ISSUED"
        assert cheque.status == "UNCLEARED"

    def test_receive_cheque(self, qa_db, svc):
        bank, _, cust = self._setup(qa_db)
        cheque = svc.receive_cheque(
            bank_account_id=bank.id, party_id=cust.id, cheque_number="CHK-002",
            amount=500, cheque_date="2026-01-06",
        )
        assert cheque.cheque_type == "RECEIVED"

    def test_list_cheques_filters_by_status(self, qa_db, svc):
        bank, sup, _ = self._setup(qa_db)
        svc.issue_cheque(bank.id, sup.id, "CHK-A", 10, "2026-01-01")
        svc.issue_cheque(bank.id, sup.id, "CHK-B", 20, "2026-01-02")
        assert len(svc.list_cheques(status="UNCLEARED")) == 2
        assert len(svc.list_cheques(status="CLEARED")) == 0
        assert len(svc.list_cheques()) == 2

    def test_cheque_clears_when_funds_available(self, qa_db, svc):
        bank, sup, _ = self._setup(qa_db)
        svc.deposit(bank.id, amount=200, transaction_date="2026-01-01")
        cheque = svc.issue_cheque(bank.id, sup.id, "CHK-LC", 100, "2026-01-01")
        svc.clear_cheque(cheque.id)
        assert qa_db.fetch_one("SELECT status FROM cheques WHERE id=?", (cheque.id,))["status"] == "CLEARED"

    def test_cheque_clear_requires_balance(self, qa_db, svc):
        bank, sup, _ = self._setup(qa_db)
        cheque = svc.issue_cheque(bank.id, sup.id, "CHK-NOBAL", 100, "2026-01-01")
        with pytest.raises(ValidationError):
            svc.clear_cheque(cheque.id)

    def test_cheque_can_bounce(self, qa_db, svc):
        bank, sup, _ = self._setup(qa_db)
        cheque = svc.issue_cheque(bank.id, sup.id, "CHK-BNCE", 100, "2026-01-01")
        svc.bounce_cheque(cheque.id)
        assert qa_db.fetch_one("SELECT status FROM cheques WHERE id=?", (cheque.id,))["status"] == "BOUNCED"

    def test_cheque_can_be_marked_lost(self, qa_db, svc):
        bank, _, cust = self._setup(qa_db)
        cheque = svc.receive_cheque(bank.id, cust.id, "CHK-LOST", 50, "2026-01-01")
        svc.lose_cheque(cheque.id)
        assert qa_db.fetch_one("SELECT status FROM cheques WHERE id=?", (cheque.id,))["status"] == "LOST"


class TestBankingController:
    def test_create_account_via_controller(self, qa_db):
        from controllers.banking_controller import BankingController
        ctrl = BankingController()
        # signature: (bank_name, account_title, account_number, branch_code, iban, opening_balance)
        ok, err = ctrl.create_bank_account("HBL", "Title", "1234567", None, None, 0.0)
        assert ok is True and err is None
        accounts, err2 = ctrl.list_bank_accounts()
        assert err2 is None
        assert any(a.bank_name == "HBL" for a in accounts)

    def test_get_balance_contract(self, qa_db):
        from controllers.banking_controller import BankingController
        from helpers import seed as s
        bank = s.make_bank_account(qa_db, "HBL", account_title="X", account_number="1", opening_balance=7)
        ctrl = BankingController()
        balance, err = ctrl.get_balance(bank.id)
        assert err is None
        assert balance == 7.0