"""Business rules for Banking - accounts, transactions, cheques."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from database.connection import DatabaseConnection, get_db
from models.enums import VoucherType
from models.banking import BankAccount, BankTransaction, Cheque
from repositories.banking_repository import (
    BankAccountRepository,
    BankTransactionRepository,
    ChequeRepository
)
from repositories.account_repository import AccountRepository
from repositories.party_repository import PartyRepository
from services.accounting_service import AccountingService, JournalLine
from utils.exceptions import ValidationError
from utils.logger import get_logger

logger = get_logger(__name__)


class BankingService:
    """Service for banking operations."""

    def __init__(self, db: DatabaseConnection | None = None):
        self.db = db or get_db()
        self.account_repo = BankAccountRepository(self.db)
        self.txn_repo = BankTransactionRepository(self.db)
        self.cheque_repo = ChequeRepository(self.db)
        self.accounting_repo = AccountRepository(self.db)
        self.party_repo = PartyRepository(self.db)
        self.accounting_service = AccountingService(self.db)

    # ======================================================================
    # Bank Accounts
    # ======================================================================
    def create_bank_account(
        self,
        bank_name: str,
        account_title: str,
        account_number: str,
        opening_balance: float = 0.0,
        branch_code: str | None = None,
        iban: str | None = None,
        company_id: int = 1,
    ) -> BankAccount:
        """Create a bank account with automatic Chart of Accounts entry."""
        # Validate inputs
        if not bank_name.strip():
            raise ValidationError("Bank name is required.")
        if not account_title.strip():
            raise ValidationError("Account title is required.")
        if not account_number.strip():
            raise ValidationError("Account number is required.")
        if opening_balance < 0:
            raise ValidationError("Opening balance cannot be negative.")
        
        # ✅ CHECK FOR DUPLICATE ACCOUNT NUMBER
        existing = self.account_repo.find_by_account_number(account_number.strip(), company_id)
        if existing:
            raise ValidationError(f"Bank account number '{account_number}' already exists.")

        # Find or create Bank account in Chart of Accounts
        bank_acc = self.accounting_repo.find_by_code("1010")
        if not bank_acc:
            from services.account_service import AccountService
            from models.enums import AccountType
            acc_service = AccountService(self.db)
            bank_acc = acc_service.create_account(
                account_code="1010",
                account_name="Bank Accounts",
                account_type=AccountType.ASSET,
                opening_balance=0,
            )
            account_id = bank_acc.id
        else:
            account_id = bank_acc["id"]

        account = BankAccount(
            bank_name=bank_name.strip(),
            account_title=account_title.strip(),
            account_number=account_number.strip(),
            account_id=account_id,
            opening_balance=opening_balance,
            branch_code=branch_code,
            iban=iban,
            company_id=company_id,
        )

        with self.db.transaction():
            account.id = self.account_repo.insert(account.to_dict())

            # Post opening balance if > 0
            if opening_balance > 0:
                self._post_bank_balance(account.id, opening_balance, "Opening balance")

        logger.info("Created bank account: %s - %s", bank_name, account_title)
        return account


    def _post_bank_balance(self, bank_account_id: int, amount: float, description: str):
        """Post a journal entry for bank balance changes."""
        bank_account = self.account_repo.get_by_id(bank_account_id)
        if not bank_account:
            raise ValidationError("Bank account not found.")

        # Get the Chart of Accounts bank account
        coa_bank = self.accounting_repo.get_by_id(bank_account["account_id"])
        if not coa_bank:
            raise ValidationError("Bank account not found in Chart of Accounts.")

        # Get equity account for opening balance
        equity = self.accounting_repo.find_by_code("3000")
        if not equity:
            raise ValidationError("Equity account (3000) not found.")

        self.accounting_service.post_journal_entry(
            voucher_type=VoucherType.JOURNAL,
            entry_date=datetime.now().date().isoformat(),
            lines=[
                JournalLine(account_id=coa_bank["id"], debit=amount, credit=0, description=description),
                JournalLine(account_id=equity["id"], debit=0, credit=amount, description=description),
            ],
            narration=f"Bank account opening balance: {bank_account['bank_name']}"
        )

    # ======================================================================
    # Bank Transactions
    # ======================================================================

    def deposit(
        self,
        bank_account_id: int,
        amount: float,
        transaction_date: str,
        reference_no: str | None = None,
        notes: str | None = None,
    ) -> BankTransaction:
        """Deposit money into bank account."""
        return self._record_transaction(
            bank_account_id, "DEPOSIT", amount, transaction_date, reference_no, notes
        )

    def withdraw(
        self,
        bank_account_id: int,
        amount: float,
        transaction_date: str,
        reference_no: str | None = None,
        notes: str | None = None,
    ) -> BankTransaction:
        """Withdraw money from bank account."""
        return self._record_transaction(
            bank_account_id, "WITHDRAWAL", amount, transaction_date, reference_no, notes
        )

    def _record_transaction(
        self,
        bank_account_id: int,
        txn_type: str,
        amount: float,
        transaction_date: str,
        reference_no: str | None = None,
        notes: str | None = None,
    ) -> BankTransaction:
        """Record a bank transaction with journal entry."""
        if amount <= 0:
            raise ValidationError("Amount must be greater than 0.")

        bank_account = self.account_repo.get_by_id(bank_account_id)
        if not bank_account:
            raise ValidationError("Bank account not found.")
        
        # ✅ ADD BALANCE CHECK FOR WITHDRAWALS
        if txn_type == "WITHDRAWAL":
            current_balance = self.get_balance(bank_account_id)
            if amount > current_balance:
                raise ValidationError(
                    f"Insufficient balance. Available: Rs. {current_balance:,.2f}, "
                    f"Requested: Rs. {amount:,.2f}"
                )

        coa_bank = self.accounting_repo.get_by_id(bank_account["account_id"])
        if not coa_bank:
            raise ValidationError("Bank account not found in Chart of Accounts.")

        # For deposit: Debit Bank, Credit Cash
        # For withdrawal: Debit Cash, Credit Bank
        if txn_type == "DEPOSIT":
            cash = self.accounting_repo.find_by_code("1000")
            if not cash:
                raise ValidationError("Cash account (1000) not found.")
            lines = [
                JournalLine(account_id=coa_bank["id"], debit=amount, credit=0, description=f"Deposit - {reference_no or ''}"),
                JournalLine(account_id=cash["id"], debit=0, credit=amount, description=f"Deposit - {reference_no or ''}"),
            ]
        elif txn_type == "WITHDRAWAL":
            cash = self.accounting_repo.find_by_code("1000")
            if not cash:
                raise ValidationError("Cash account (1000) not found.")
            lines = [
                JournalLine(account_id=cash["id"], debit=amount, credit=0, description=f"Withdrawal - {reference_no or ''}"),
                JournalLine(account_id=coa_bank["id"], debit=0, credit=amount, description=f"Withdrawal - {reference_no or ''}"),
            ]
        else:
            raise ValidationError("Invalid transaction type.")

        with self.db.transaction():
            # Post journal entry
            entry_id = self.accounting_service.post_journal_entry(
                voucher_type=VoucherType.JOURNAL,
                entry_date=transaction_date,
                lines=lines,
                narration=f"Bank {txn_type}: {reference_no or ''}"
            )

            # Record transaction
            txn = BankTransaction(
                bank_account_id=bank_account_id,
                transaction_type=txn_type,
                amount=amount,
                transaction_date=transaction_date,
                reference_no=reference_no,
                notes=notes,
                journal_entry_id=entry_id,
            )
            txn.id = self.txn_repo.insert(txn.to_dict())

        logger.info("Bank %s: Rs. %.2f", txn_type, amount)
        return txn
    # ======================================================================
    # Cheques
    # ======================================================================

    def issue_cheque(
        self,
        bank_account_id: int,
        party_id: int,
        cheque_number: str,
        amount: float,
        cheque_date: str,
        notes: str | None = None,
        company_id: int = 1,
    ) -> Cheque:
        """Issue a cheque to a supplier."""
        return self._create_cheque(
            bank_account_id, party_id, cheque_number, amount, cheque_date,
            "ISSUED", notes, company_id
        )

    def receive_cheque(
        self,
        bank_account_id: int,
        party_id: int,
        cheque_number: str,
        amount: float,
        cheque_date: str,
        notes: str | None = None,
        company_id: int = 1,
    ) -> Cheque:
        """Receive a cheque from a customer."""
        return self._create_cheque(
            bank_account_id, party_id, cheque_number, amount, cheque_date,
            "RECEIVED", notes, company_id
        )

    def _create_cheque(
        self,
        bank_account_id: int,
        party_id: int,
        cheque_number: str,
        amount: float,
        cheque_date: str,
        cheque_type: str,
        notes: str | None = None,
        company_id: int = 1,
    ) -> Cheque:
        """Create a cheque."""
        if not cheque_number.strip():
            raise ValidationError("Cheque number is required.")
        if amount <= 0:
            raise ValidationError("Amount must be greater than 0.")

        # Validate party exists
        party = self.party_repo.get_by_id(party_id)
        if not party:
            raise ValidationError("Party does not exist.")

        # Validate bank account
        bank_account = self.account_repo.get_by_id(bank_account_id)
        if not bank_account:
            raise ValidationError("Bank account not found.")

        cheque = Cheque(
            bank_account_id=bank_account_id,
            party_id=party_id,
            cheque_number=cheque_number.strip(),
            cheque_type=cheque_type,
            amount=amount,
            cheque_date=cheque_date,
            status="UNCLEARED",
            notes=notes,
            company_id=company_id,
        )

        with self.db.transaction():
            cheque.id = self.cheque_repo.insert(cheque.to_dict())

        logger.info("%s cheque #%s for Rs. %.2f", cheque_type, cheque_number, amount)
        return cheque

    def clear_cheque(self, cheque_id: int) -> None:
        """Clear a cheque (money received/paid) with balance check."""
        cheque = self.cheque_repo.get_by_id(cheque_id)
        if not cheque:
            raise ValidationError("Cheque not found.")
        if cheque["status"] != "UNCLEARED":
            raise ValidationError(f"Cheque is already {cheque['status']}.")

        # ✅ ADD BALANCE CHECK FOR ISSUED CHEQUES
        if cheque["cheque_type"] == "ISSUED":
            current_balance = self.get_balance(cheque["bank_account_id"])
            if cheque["amount"] > current_balance:
                raise ValidationError(
                    f"Insufficient balance to clear cheque #{cheque['cheque_number']}. "
                    f"Available: Rs. {current_balance:,.2f}, "
                    f"Cheque: Rs. {cheque['amount']:,.2f}"
                )

        # Get bank account
        bank_account = self.account_repo.get_by_id(cheque["bank_account_id"])
        coa_bank = self.accounting_repo.get_by_id(bank_account["account_id"])

        # Get the other account (party)
        party = self.party_repo.get_by_id(cheque["party_id"])
        
        if cheque["cheque_type"] == "ISSUED":
            # Issued cheque clearing: money leaves bank
            if party["party_type"] in ["SUPPLIER", "BOTH"]:
                ap = self.accounting_repo.find_by_code("2000")
                lines = [
                    JournalLine(account_id=ap["id"], debit=cheque["amount"], credit=0, party_id=cheque["party_id"]),
                    JournalLine(account_id=coa_bank["id"], debit=0, credit=cheque["amount"]),
                ]
                narration = f"Cheque #{cheque['cheque_number']} cleared - Payment to {party['name']}"
                txn_type = "WITHDRAWAL"
            else:
                raise ValidationError("Can only clear cheques for suppliers.")
        else:
            # Received cheque clearing: money comes to bank
            if party["party_type"] in ["CUSTOMER", "BOTH"]:
                ar = self.accounting_repo.find_by_code("1100")
                lines = [
                    JournalLine(account_id=coa_bank["id"], debit=cheque["amount"], credit=0),
                    JournalLine(account_id=ar["id"], debit=0, credit=cheque["amount"], party_id=cheque["party_id"]),
                ]
                narration = f"Cheque #{cheque['cheque_number']} cleared - Received from {party['name']}"
                txn_type = "DEPOSIT"
            else:
                raise ValidationError("Can only clear cheques for customers.")

        with self.db.transaction():
            # Post journal entry
            entry_id = self.accounting_service.post_journal_entry(
                voucher_type=VoucherType.JOURNAL,
                entry_date=datetime.now().date().isoformat(),
                lines=lines,
                narration=narration
            )

            # Record bank transaction
            txn = BankTransaction(
                bank_account_id=cheque["bank_account_id"],
                transaction_type=txn_type,
                amount=cheque["amount"],
                transaction_date=datetime.now().date().isoformat(),
                reference_no=cheque["cheque_number"],
                notes=narration,
                journal_entry_id=entry_id,
            )
            self.txn_repo.insert(txn.to_dict())

            # Update cheque status
            self.cheque_repo.update(
                cheque_id,
                {
                    "status": "CLEARED",
                    "cleared_date": datetime.now().date().isoformat(),
                }
            )

        logger.info("Cheque #%s cleared - recorded in transactions", cheque["cheque_number"])


    def bounce_cheque(self, cheque_id: int) -> None:
        """Bounce a cheque (no accounting entry, just status change)."""
        cheque = self.cheque_repo.get_by_id(cheque_id)
        if not cheque:
            raise ValidationError("Cheque not found.")
        if cheque["status"] != "UNCLEARED":
            raise ValidationError(f"Cheque is already {cheque['status']}.")

        self.cheque_repo.update(cheque_id, {"status": "BOUNCED"})
        logger.info("Cheque #%s bounced", cheque["cheque_number"])
    def lose_cheque(self, cheque_id: int) -> None:
        """Mark a cheque as lost."""
        cheque = self.cheque_repo.get_by_id(cheque_id)
        if not cheque:
            raise ValidationError("Cheque not found.")

        self.cheque_repo.update(cheque_id, {"status": "LOST"})
        logger.info("Cheque #%s marked as lost", cheque["cheque_number"])

    def list_cheques(self, status: str | None = None) -> list[dict]:
        """List cheques with optional status filter."""
        if status:
            return self.cheque_repo.find_by_status(status)
        return self.cheque_repo.find_all_for_company()
    
    def get_balance(self, bank_account_id: int) -> float:
        """Get current balance of a specific bank account."""
        # Get the bank account
        bank_account = self.account_repo.get_by_id(bank_account_id)
        if not bank_account:
            return 0.0
        
        # Get balance from bank_transactions for THIS specific bank account
        result = self.db.fetch_one("""
            SELECT 
                COALESCE(SUM(CASE WHEN transaction_type IN ('DEPOSIT', 'TRANSFER_IN') THEN amount ELSE 0 END), 0) as deposits,
                COALESCE(SUM(CASE WHEN transaction_type IN ('WITHDRAWAL', 'TRANSFER_OUT') THEN amount ELSE 0 END), 0) as withdrawals
            FROM bank_transactions
            WHERE bank_account_id = ?
        """, (bank_account_id,))
        
        opening_balance = bank_account.get("opening_balance", 0) or 0
        deposits = result["deposits"] if result else 0
        withdrawals = result["withdrawals"] if result else 0
        
        balance = float(opening_balance + deposits - withdrawals)
        
        print(f"🏦 Bank {bank_account['bank_name']}: Opening={opening_balance}, Deposits={deposits}, Withdrawals={withdrawals}, Balance={balance}")
        
        return balance








