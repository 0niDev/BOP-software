"""
Party repository for customer/vendor/supplier management.

Optimized for SQLite Cloud with:
- Batch operations for reduced round-trips
- Multi-level caching
- Balance calculations
"""
from __future__ import annotations

from typing import List, Optional

from database.connection import DatabaseConnection, get_db
from repositories.base_repository import BaseRepository
from utils.cache_manager import get_cache_manager
from utils.logger import get_logger

logger = get_logger(__name__)


class PartyRepository(BaseRepository):
    """Repository for party (customer/vendor/supplier) operations."""
    
    table_name = "parties"
    pk_column = "id"
    
    def __init__(self, db: Optional[DatabaseConnection] = None):
        super().__init__(db)
        self._cache = get_cache_manager()
    
    def find_by_code(self, party_code: str) -> Optional[dict]:
        """Find party by code."""
        cache_key = f"{self.table_name}:find_by_code:{party_code}"
        cached = self._cache.get(cache_key)
        
        if cached is not None:
            return cached
        
        sql = f"SELECT * FROM {self.table_name} WHERE code = ?"
        result = self.db.fetch_one(sql, (party_code,))
        
        if result is not None:
            self._cache.set(cache_key, result)
        
        return result
    
    def find_by_type(self, party_type: str) -> List[dict]:
        """Find all parties of a specific type (CUSTOMER, SUPPLIER, BOTH)."""
        cache_key = f"{self.table_name}:type:{party_type}"
        cached = self._cache.get(cache_key)
        
        if cached is not None:
            return cached
        
        sql = f"""
            SELECT * FROM {self.table_name} 
            WHERE party_type = ? AND is_active = 1
            ORDER BY name
        """
        result = self.db.fetch_all(sql, (party_type,))
        
        self._cache.set(cache_key, result)
        return result
    
    def find_customers(self) -> List[dict]:
        """Find all customers."""
        return self.find_by_type("CUSTOMER")
    
    def find_suppliers(self) -> List[dict]:
        """Find all suppliers."""
        return self.find_by_type("SUPPLIER")
    
    def search_parties(
        self, 
        search_term: str, 
        party_type: Optional[str] = None,
        limit: int = 50
    ) -> List[dict]:
        """
        Search parties by name or code.
        
        Uses LIKE for fuzzy matching.
        """
        type_filter = ""
        params = [f"%{search_term}%", f"%{search_term}%"]
        
        if party_type:
            type_filter = "AND party_type = ?"
            params.append(party_type)
        
        sql = f"""
            SELECT * FROM {self.table_name}
            WHERE (name LIKE ? OR code LIKE ?)
            AND is_active = 1
            {type_filter}
            ORDER BY name
            LIMIT ?
        """
        params.append(limit)
        
        return self.db.fetch_all(sql, params)
    
    def get_party_balance(
        self, 
        party_id: int, 
        as_of_date: Optional[str] = None
    ) -> float:
        """
        Get current balance for a party (receivable/payable).
        
        Positive balance = receivable (customer owes us)
        Negative balance = payable (we owe supplier)
        """
        date_filter = ""
        params = [party_id]
        
        if as_of_date:
            date_filter = "AND je.entry_date <= ?"
            params.append(as_of_date)
        
        # Calculate balance from journal entries
        # For customers: debit increases balance (they owe us)
        # For suppliers: credit increases balance (we owe them)
        sql = f"""
            SELECT COALESCE(SUM(jel.debit - jel.credit), 0) as balance
            FROM journal_entry_lines jel
            INNER JOIN journal_entries je ON jel.journal_entry_id = je.id
            WHERE jel.party_id = ?
            AND je.is_posted = 1
            {date_filter}
        """
        
        result = self.db.fetch_one(sql, params)
        return result['balance'] if result else 0.0
    
    def find_with_balances(
        self, 
        party_type: Optional[str] = None,
        as_of_date: Optional[str] = None
    ) -> List[dict]:
        """
        Find all parties with their current balances.
        """
        type_filter = ""
        date_filter = ""
        params = []
        
        if party_type:
            type_filter = "AND p.party_type = ?"
            params.append(party_type)
        
        if as_of_date:
            date_filter = "AND je.entry_date <= ?"
            params.append(as_of_date)
        
        sql = f"""
            SELECT 
                p.*,
                COALESCE(SUM(CASE WHEN jel.debit > 0 THEN jel.debit ELSE 0 END), 0) as total_debit,
                COALESCE(SUM(CASE WHEN jel.credit > 0 THEN jel.credit ELSE 0 END), 0) as total_credit,
                COALESCE(SUM(jel.debit - jel.credit), 0) as balance
            FROM {self.table_name} p
            LEFT JOIN journal_entry_lines jel ON p.id = jel.party_id
            LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
                AND je.is_posted = 1
                {f'AND je.entry_date <= ?' if as_of_date else ''}
            WHERE p.is_active = 1
            {type_filter}
            GROUP BY p.id
            ORDER BY p.name
        """
        
        return self.db.fetch_all(sql, params)
    
    def check_credit_limit(
        self, 
        customer_id: int, 
        additional_amount: float = 0.0
    ) -> tuple[bool, float, float]:
        """
        Check if a customer is within their credit limit.
        
        Returns:
            tuple: (is_within_limit, current_balance, credit_limit)
        """
        party = self.find_by_id(customer_id)
        
        if party is None:
            raise ValueError(f"Customer {customer_id} not found")
        
        current_balance = self.get_party_balance(customer_id)
        credit_limit = party.get('credit_limit', 0.0)
        
        # Check if new transaction would exceed limit
        new_balance = current_balance + additional_amount
        is_within_limit = new_balance <= credit_limit
        
        return (is_within_limit, current_balance, credit_limit)
    
    def create_party_with_account(
        self, 
        party_data: dict,
        account_id: Optional[int] = None
    ) -> int:
        """Create party and optionally link to account."""
        if account_id is not None:
            # Verify account exists
            from repositories.account_repository import AccountRepository
            account_repo = AccountRepository(self.db)
            
            if not account_repo.exists(account_id):
                raise ValueError(f"Account {account_id} not found")
            
            party_data['account_id'] = account_id
        
        party_id = self.insert(party_data)
        logger.info(f"Created party {party_id}: {party_data.get('name')}")
        return party_id
    
    def find_parties_without_accounts(self) -> List[dict]:
        """Find parties that don't have linked accounts."""
        sql = f"""
            SELECT * FROM {self.table_name}
            WHERE account_id IS NULL
            AND is_active = 1
            ORDER BY name
        """
        return self.db.fetch_all(sql)
    
    def count_by_type(self, party_type: str) -> int:
        """Count parties by type."""
        return self.count("party_type = ? AND is_active = 1", (party_type,))
    
    def update_party_balance_cache(
        self, 
        party_id: int, 
        balance: float
    ) -> None:
        """Update cached balance for a party."""
        cache_key = f"{self.table_name}:balance:{party_id}"
        self._cache.set(cache_key, balance)
    
    def invalidate_party_caches(self, party_id: int) -> None:
        """Invalidate all caches related to a party."""
        self._invalidate_cache(f"{self.table_name}:{party_id}")
        self._cache.invalidate(f"{self.table_name}:balance:{party_id}")
