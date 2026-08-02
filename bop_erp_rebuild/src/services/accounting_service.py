"""
Accounting Service - Core double-entry bookkeeping engine
All financial transactions must go through this service to maintain GL integrity.
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
import uuid

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from models.account import Account, JournalEntry, JournalEntryLine, AccountType, VoucherType
from repositories.account_repository import AccountRepository, JournalEntryRepository
from database.connection_manager import get_connection


class AccountingServiceError(Exception):
    """Custom exception for accounting service errors."""
    pass


class AccountingService:
    """
    Handles all double-entry accounting operations.
    Ensures every transaction has equal debits and credits.
    """
    
    def __init__(self, company_id: str):
        self.company_id = company_id
        self.account_repo = AccountRepository()
        self.je_repo = JournalEntryRepository()
    
    def create_journal_entry(
        self,
        voucher_type: VoucherType,
        voucher_no: str,
        voucher_date: date,
        lines: List[Dict[str, Any]],
        description: str = "",
        reference: str = "",
        posted: bool = True
    ) -> JournalEntry:
        """
        Create a journal entry with validation.
        
        Args:
            voucher_type: Type of voucher (Sales, Purchase, Payment, etc.)
            voucher_no: Reference voucher number
            voucher_date: Date of the transaction
            lines: List of dicts with account_code, debit, credit, party_id (optional)
            description: Narration for the entry
            reference: External reference
            posted: Whether to post immediately
            
        Returns:
            Created JournalEntry
            
        Raises:
            AccountingServiceError: If debits != credits or accounts invalid
        """
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            # Validate and calculate totals
            total_debit = Decimal('0')
            total_credit = Decimal('0')
            
            for line in lines:
                debit = Decimal(str(line.get('debit', 0))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                credit = Decimal(str(line.get('credit', 0))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                
                # Validate account exists
                account = self.account_repo.get_by_code(conn, line['account_code'], self.company_id)
                if not account:
                    raise AccountingServiceError(f"Account {line['account_code']} not found")
                
                # Validate account is active
                if not account.is_active:
                    raise AccountingServiceError(f"Account {line['account_code']} is inactive")
                
                total_debit += debit
                total_credit += credit
            
            # Ensure balanced entry
            if total_debit != total_credit:
                raise AccountingServiceError(
                    f"Journal entry unbalanced: Debits={total_debit}, Credits={total_credit}"
                )
            
            if total_debit == 0:
                raise AccountingServiceError("Journal entry cannot have zero amount")
            
            # Create journal entry header
            je_id = str(uuid.uuid4())
            je = JournalEntry(
                id=je_id,
                company_id=self.company_id,
                voucher_type=voucher_type,
                voucher_no=voucher_no,
                voucher_date=voucher_date,
                description=description,
                reference=reference,
                total_amount=total_debit,
                is_posted=posted,
                created_by=None,  # Set by controller
                created_at=datetime.now()
            )
            
            # Save header
            self.je_repo.create(conn, je)
            
            # Create and save lines
            created_lines: List[JournalEntryLine] = []
            for idx, line in enumerate(lines):
                debit = Decimal(str(line.get('debit', 0))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                credit = Decimal(str(line.get('credit', 0))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                
                je_line = JournalEntryLine(
                    id=str(uuid.uuid4()),
                    journal_entry_id=je_id,
                    line_no=idx + 1,
                    account_code=line['account_code'],
                    debit=debit,
                    credit=credit,
                    party_id=line.get('party_id'),
                    narration=line.get('narration', '')
                )
                created_lines.append(je_line)
                self.je_repo.create_line(conn, je_line)
            
            conn.commit()
            
            # Invalidate cache
            self.account_repo.invalidate_cache()
            self.je_repo.invalidate_cache()
            
            return je
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise AccountingServiceError(f"Failed to create journal entry: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def reverse_journal_entry(self, journal_entry_id: str, reversal_date: date, reason: str) -> JournalEntry:
        """
        Reverse a journal entry by creating an opposite entry.
        
        Args:
            journal_entry_id: ID of entry to reverse
            reversal_date: Date of reversal
            reason: Reason for reversal
            
        Returns:
            Reversal JournalEntry
        """
        conn = None
        try:
            conn = get_connection()
            
            # Get original entry
            original = self.je_repo.get_by_id(conn, journal_entry_id)
            if not original:
                raise AccountingServiceError(f"Journal entry {journal_entry_id} not found")
            
            if original.is_reversed:
                raise AccountingServiceError(f"Journal entry {journal_entry_id} is already reversed")
            
            # Get original lines
            lines = self.je_repo.get_lines(conn, journal_entry_id)
            
            # Create reversal lines (swap debit/credit)
            reversal_lines = []
            for line in lines:
                reversal_lines.append({
                    'account_code': line.account_code,
                    'debit': float(line.credit),
                    'credit': float(line.debit),
                    'party_id': line.party_id,
                    'narration': f"Reversal: {line.narration}"
                })
            
            # Create reversal entry
            reversal = self.create_journal_entry(
                voucher_type=VoucherType.JOURNAL,
                voucher_no=f"REV-{original.voucher_no}",
                voucher_date=reversal_date,
                lines=reversal_lines,
                description=f"Reversal of {original.voucher_no}: {reason}",
                reference=original.id,
                posted=True
            )
            
            # Mark original as reversed
            original.is_reversed = True
            original.reversed_at = datetime.now()
            self.je_repo.update(conn, original)
            
            conn.commit()
            return reversal
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise AccountingServiceError(f"Failed to reverse journal entry: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def get_account_balance(self, account_code: str, as_of_date: Optional[date] = None) -> Decimal:
        """
        Calculate account balance up to a specific date.
        
        Args:
            account_code: Account code to check
            as_of_date: Balance as of this date (None for current)
            
        Returns:
            Net balance (positive for debit balance, negative for credit)
        """
        conn = None
        try:
            conn = get_connection()
            
            account = self.account_repo.get_by_code(conn, account_code, self.company_id)
            if not account:
                raise AccountingServiceError(f"Account {account_code} not found")
            
            entries = self.je_repo.get_account_entries(
                conn, 
                account_code, 
                self.company_id,
                as_of_date
            )
            
            balance = Decimal('0')
            for entry in entries:
                if entry.debit > 0:
                    balance += entry.debit
                if entry.credit > 0:
                    balance -= entry.credit
            
            # For liability, equity, income accounts: normal balance is credit
            if account.account_type in [AccountType.LIABILITY, AccountType.EQUITY, AccountType.INCOME]:
                return -balance
            
            return balance
            
        finally:
            if conn:
                conn.close()
    
    def get_trial_balance(self, as_of_date: Optional[date] = None) -> List[Dict[str, Any]]:
        """
        Generate trial balance report.
        
        Returns:
            List of accounts with opening, debit, credit, and closing balances
        """
        conn = None
        try:
            conn = get_connection()
            
            accounts = self.account_repo.get_all_active(conn, self.company_id)
            trial_balance = []
            
            total_debit = Decimal('0')
            total_credit = Decimal('0')
            
            for account in accounts:
                entries = self.je_repo.get_account_entries(
                    conn,
                    account.code,
                    self.company_id,
                    as_of_date
                )
                
                debit_total = sum(e.debit for e in entries)
                credit_total = sum(e.credit for e in entries)
                
                closing_balance = debit_total - credit_total
                
                # Adjust for account type
                if account.account_type in [AccountType.LIABILITY, AccountType.EQUITY, AccountType.INCOME]:
                    closing_balance = credit_total - debit_total
                
                if closing_balance != 0:
                    trial_balance.append({
                        'account_code': account.code,
                        'account_name': account.name,
                        'account_type': account.account_type,
                        'debit': debit_total if closing_balance >= 0 else Decimal('0'),
                        'credit': credit_total if closing_balance < 0 else Decimal('0'),
                        'closing_balance': closing_balance
                    })
                    
                    if closing_balance >= 0:
                        total_debit += closing_balance
                    else:
                        total_credit += abs(closing_balance)
            
            # Add totals row
            trial_balance.append({
                'account_code': 'TOTAL',
                'account_name': 'Total',
                'account_type': None,
                'debit': total_debit,
                'credit': total_credit,
                'closing_balance': Decimal('0')
            })
            
            return trial_balance
            
        finally:
            if conn:
                conn.close()
    
    def get_party_ledger(self, party_id: str, from_date: date, to_date: date) -> List[Dict[str, Any]]:
        """
        Get ledger for a specific party (customer/supplier).
        
        Args:
            party_id: Party ID
            from_date: Start date
            to_date: End date
            
        Returns:
            List of transactions with running balance
        """
        conn = None
        try:
            conn = get_connection()
            
            entries = self.je_repo.get_party_entries(
                conn,
                party_id,
                self.company_id,
                from_date,
                to_date
            )
            
            ledger = []
            balance = Decimal('0')
            
            for entry in entries:
                if entry.debit > 0:
                    balance += entry.debit
                if entry.credit > 0:
                    balance -= entry.credit
                
                ledger.append({
                    'date': entry.voucher_date,
                    'voucher_type': entry.voucher_type,
                    'voucher_no': entry.voucher_no,
                    'description': entry.description,
                    'debit': entry.debit,
                    'credit': entry.credit,
                    'balance': balance
                })
            
            return ledger
            
        finally:
            if conn:
                conn.close()
