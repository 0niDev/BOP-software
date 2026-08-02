"""Accounting Controller for BOP Nutraceuticals ERP."""

from typing import List, Optional, Dict, Any
from datetime import date
from decimal import Decimal
from models.journal_entry import JournalEntry, VoucherType
from models.account import Account, AccountType
from services.accounting_service import AccountingService


class AccountingController:
    """Controller for accounting operations."""
    
    def __init__(self, accounting_service: AccountingService):
        self.accounting_service = accounting_service
    
    # Journal Entry Operations
    
    def create_journal_entry(
        self,
        company_id: str,
        voucher_type: VoucherType,
        entries: List[Dict[str, Any]],
        posting_date: date,
        narration: str = "",
        auto_balance: bool = True
    ) -> tuple[bool, str, Optional[JournalEntry]]:
        """Create a new journal entry."""
        try:
            je = self.accounting_service.create_journal_entry(
                company_id=company_id,
                voucher_type=voucher_type,
                entries=entries,
                posting_date=posting_date,
                narration=narration,
                auto_balance=auto_balance
            )
            
            if je:
                return True, f"Journal entry {je.voucher_number} created.", je
            else:
                return False, "Failed to create journal entry.", None
                
        except Exception as e:
            return False, f"Error creating journal entry: {str(e)}", None
    
    def get_journal_entry(self, je_id: str) -> Optional[JournalEntry]:
        """Get journal entry by ID."""
        try:
            return self.accounting_service.get_journal_entry(je_id)
        except Exception:
            return None
    
    def cancel_journal_entry(self, je_id: str, reason: str = "") -> tuple[bool, str]:
        """Cancel a journal entry."""
        try:
            result = self.accounting_service.cancel_journal_entry(je_id, reason)
            
            if result:
                return True, "Journal entry cancelled."
            else:
                return False, "Failed to cancel journal entry."
                
        except Exception as e:
            return False, f"Error cancelling journal entry: {str(e)}"
    
    def get_general_ledger(
        self,
        company_id: str,
        account_id: str,
        from_date: date,
        to_date: date
    ) -> List[Dict[str, Any]]:
        """Get general ledger for an account."""
        try:
            return self.accounting_service.get_general_ledger(
                company_id=company_id,
                account_id=account_id,
                from_date=from_date,
                to_date=to_date
            )
        except Exception:
            return []
    
    # Trial Balance
    
    def get_trial_balance(
        self,
        company_id: str,
        as_of_date: date
    ) -> List[Dict[str, Any]]:
        """Get trial balance report."""
        try:
            return self.accounting_service.get_trial_balance(
                company_id=company_id,
                as_of_date=as_of_date
            )
        except Exception:
            return []
    
    # Profit & Loss
    
    def get_profit_and_loss(
        self,
        company_id: str,
        from_date: date,
        to_date: date
    ) -> Dict[str, Any]:
        """Get profit and loss statement."""
        try:
            return self.accounting_service.get_profit_and_loss(
                company_id=company_id,
                from_date=from_date,
                to_date=to_date
            )
        except Exception:
            return {}
    
    # Balance Sheet
    
    def get_balance_sheet(
        self,
        company_id: str,
        as_of_date: date
    ) -> Dict[str, Any]:
        """Get balance sheet."""
        try:
            return self.accounting_service.get_balance_sheet(
                company_id=company_id,
                as_of_date=as_of_date
            )
        except Exception:
            return {}
    
    # Party Ledger
    
    def get_party_ledger(
        self,
        company_id: str,
        party_id: str,
        from_date: date,
        to_date: date
    ) -> List[Dict[str, Any]]:
        """Get party ledger report."""
        try:
            return self.accounting_service.get_party_ledger(
                company_id=company_id,
                party_id=party_id,
                from_date=from_date,
                to_date=to_date
            )
        except Exception:
            return []
    
    # Cash Book
    
    def get_cash_book(
        self,
        company_id: str,
        from_date: date,
        to_date: date,
        bank_account_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get cash book report."""
        try:
            return self.accounting_service.get_cash_book(
                company_id=company_id,
                from_date=from_date,
                to_date=to_date,
                bank_account_id=bank_account_id
            )
        except Exception:
            return []
    
    # Account Operations
    
    def get_account_by_code(self, company_id: str, account_code: str) -> Optional[Account]:
        """Get account by code."""
        try:
            return self.accounting_service.get_account_by_code(company_id, account_code)
        except Exception:
            return None
    
    def get_account_balance(self, account_id: str) -> Decimal:
        """Get current balance for an account."""
        try:
            return self.accounting_service.get_account_balance(account_id)
        except Exception:
            return Decimal('0.00')
    
    def get_account_balance_by_code(self, company_id: str, account_code: str) -> Decimal:
        """Get current balance for an account by code."""
        try:
            return self.accounting_service.get_account_balance_by_code(company_id, account_code)
        except Exception:
            return Decimal('0.00')
    
    def get_all_accounts(self, company_id: str) -> List[Account]:
        """Get all accounts for a company."""
        try:
            return self.accounting_service.get_all_accounts(company_id)
        except Exception:
            return []
    
    def get_accounts_by_type(
        self,
        company_id: str,
        account_type: AccountType
    ) -> List[Account]:
        """Get accounts by type."""
        try:
            return self.accounting_service.get_accounts_by_type(company_id, account_type)
        except Exception:
            return []
    
    # Financial Year
    
    def get_current_financial_year(self, company_id: str) -> Dict[str, date]:
        """Get current financial year dates."""
        try:
            return self.accounting_service.get_current_financial_year(company_id)
        except Exception:
            return {'start_date': date.today().replace(month=4, day=1), 
                    'end_date': date.today().replace(month=3, day=31, year=date.today().year+1)}
