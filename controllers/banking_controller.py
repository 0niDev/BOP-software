"""Controller for Banking."""
from __future__ import annotations

from models.banking import BankAccount
from services.banking_service import BankingService
from utils.exceptions import ERPException
from utils.logger import get_logger

logger = get_logger(__name__)


class BankingController:
    def __init__(self, banking_service: BankingService | None = None):
        self.service = banking_service or BankingService()

    def list_bank_accounts(self):
        """List all bank accounts as BankAccount objects."""
        try:
            rows = self.service.account_repo.find_all_for_company()
            accounts = [BankAccount.from_row(row) for row in rows]
            return accounts, None
        except Exception as e:
            logger.exception("Error listing bank accounts")
            return [], str(e)

    def create_bank_account(self, bank_name, account_title, account_number,
                           branch_code=None, iban=None, opening_balance=0):
        try:
            acc = self.service.create_bank_account(
                bank_name, account_title, account_number,
                opening_balance, branch_code, iban
            )
            return True, None
        except ERPException as e:
            return False, str(e)

    def deposit(self, account_id, amount, date, ref, notes):
        try:
            self.service.deposit(account_id, amount, date, ref, notes)
            return True, None
        except ERPException as e:
            return False, str(e)

    def withdraw(self, account_id, amount, date, ref, notes):
        try:
            self.service.withdraw(account_id, amount, date, ref, notes)
            return True, None
        except ERPException as e:
            return False, str(e)

    def deactivate_account(self, account_id):
        try:
            self.service.account_repo.deactivate(account_id)
            return True, None
        except Exception as e:
            return False, str(e)

    def list_cheques(self, status=None):
        try:
            return self.service.list_cheques(status), None
        except Exception as e:
            return [], str(e)

    def issue_cheque(self, bank_account_id, party_id, cheque_number, amount, cheque_date, notes=None):
        try:
            self.service.issue_cheque(bank_account_id, party_id, cheque_number, amount, cheque_date, notes)
            return True, None
        except ERPException as e:
            return False, str(e)

    def receive_cheque(self, bank_account_id, party_id, cheque_number, amount, cheque_date, notes=None):
        try:
            self.service.receive_cheque(bank_account_id, party_id, cheque_number, amount, cheque_date, notes)
            return True, None
        except ERPException as e:
            return False, str(e)

    def clear_cheque(self, cheque_id):
        try:
            self.service.clear_cheque(cheque_id)
            return True, None
        except ERPException as e:
            return False, str(e)

    def bounce_cheque(self, cheque_id):
        try:
            self.service.bounce_cheque(cheque_id)
            return True, None
        except ERPException as e:
            return False, str(e)

    def lose_cheque(self, cheque_id):
        try:
            self.service.lose_cheque(cheque_id)
            return True, None
        except ERPException as e:
            return False, str(e)

    def list_transactions(self, account_id=None):
        try:
            if account_id:
                txns = self.service.txn_repo.find_by_bank_account(account_id)
            else:
                txns = self.service.txn_repo.find_all()
            return txns, None
        except Exception as e:
            return [], str(e)
        
    def get_balance(self, account_id: int) -> tuple[float, str | None]:
        """Get current balance of a bank account."""
        try:
            balance = self.service.get_balance(account_id)
            return balance, None
        except Exception as e:
            logger.exception(f"Error getting balance: {e}")
            return 0.0, str(e)
