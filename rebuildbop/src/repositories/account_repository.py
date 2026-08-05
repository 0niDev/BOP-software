"""
Account repository for chart of accounts management.

Optimized for SQLite Cloud with:
- Batch operations for reduced round-trips
- Multi-level caching
- Hierarchical account loading
"""
from __future__ import annotations

from typing import List, Optional

from database.connection import DatabaseConnection, get_db
from repositories.base_repository import BaseRepository
from utils.cache_manager import get_cache_manager
from utils.logger import get_logger

logger = get_logger(__name__)


class AccountRepository(BaseRepository):
    """Repository for chart of accounts operations."""
    
    table_name = "accounts"
    pk_column = "id"
    
    def __init__(self, db: Optional[DatabaseConnection] = None):
        super().__init__(db)
        self._cache = get_cache_manager()
    
    def find_by_code(self, account_code: str) -> Optional[dict]:
        """Find account by account code."""
        cache_key = f"{self.table_name}:find_by_code:{account_code}"
        cached = self._cache.get(cache_key)
        
        if cached is not None:
            return cached
        
        sql = f"SELECT * FROM {self.table_name} WHERE account_code = ?"
        result = self.db.fetch_one(sql, (account_code,))
        
        if result is not None:
            self._cache.set(cache_key, result)
        
        return result
    
    def find_children(self, parent_account_id: int) -> List[dict]:
        """Find all child accounts of a parent account."""
        cache_key = f"{self.table_name}:children:{parent_account_id}"
        cached = self._cache.get(cache_key)
        
        if cached is not None:
            return cached
        
        sql = f"""
            SELECT * FROM {self.table_name} 
            WHERE parent_account_id = ? AND is_active = 1
            ORDER BY account_code
        """
        result = self.db.fetch_all(sql, (parent_account_id,))
        
        self._cache.set(cache_key, result)
        return result
    
    def find_by_type(self, account_type: str) -> List[dict]:
        """Find all accounts of a specific type."""
        cache_key = f"{self.table_name}:type:{account_type}"
        cached = self._cache.get(cache_key)
        
        if cached is not None:
            return cached
        
        sql = f"""
            SELECT * FROM {self.table_name} 
            WHERE account_type = ? AND is_active = 1
            ORDER BY account_code
        """
        result = self.db.fetch_all(sql, (account_type,))
        
        self._cache.set(cache_key, result)
        return result
    
    def find_hierarchy(self, root_account_id: Optional[int] = None) -> List[dict]:
        """
        Load entire account hierarchy starting from root or specific account.
        
        Uses recursive CTE for efficient hierarchical query.
        """
        if root_account_id is None:
            # Find root accounts (no parent)
            root_accounts = self.find_all(order_by="account_code")
            return root_accounts
        
        # Use recursive CTE for hierarchy
        sql = """
            WITH RECURSIVE account_tree AS (
                SELECT id, account_code, account_name, parent_account_id, 
                       account_type, account_subtype, 0 as level
                FROM accounts
                WHERE id = ?
                
                UNION ALL
                
                SELECT a.id, a.account_code, a.account_name, a.parent_account_id,
                       a.account_type, a.account_subtype, at.level + 1
                FROM accounts a
                INNER JOIN account_tree at ON a.parent_account_id = at.id
                WHERE a.is_active = 1
            )
            SELECT * FROM account_tree ORDER BY level, account_code
        """
        return self.db.fetch_all(sql, (root_account_id,))
    
    def find_with_balances(
        self, 
        from_date: str, 
        to_date: str,
        account_ids: Optional[List[int]] = None
    ) -> List[dict]:
        """
        Find accounts with their balances for a date range.
        
        Calculates debit/credit balances from journal entry lines.
        """
        account_filter = ""
        params = [from_date, to_date]
        
        if account_ids:
            placeholders = ','.join('?' * len(account_ids))
            account_filter = f"AND a.id IN ({placeholders})"
            params.extend(account_ids)
        
        sql = f"""
            SELECT 
                a.*,
                COALESCE(SUM(CASE WHEN jel.debit > 0 THEN jel.debit ELSE 0 END), 0) as total_debit,
                COALESCE(SUM(CASE WHEN jel.credit > 0 THEN jel.credit ELSE 0 END), 0) as total_credit,
                COALESCE(SUM(jel.debit - jel.credit), 0) as balance
            FROM {self.table_name} a
            LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id
            LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
            WHERE je.entry_date BETWEEN ? AND ?
            AND a.is_active = 1
            {account_filter}
            GROUP BY a.id
            ORDER BY a.account_code
        """
        
        return self.db.fetch_all(sql, params)
    
    def get_account_balance(
        self, 
        account_id: int, 
        from_date: Optional[str] = None,
        to_date: Optional[str] = None
    ) -> float:
        """Get balance for a specific account."""
        date_filter = ""
        params = [account_id]
        
        if from_date and to_date:
            date_filter = "AND je.entry_date BETWEEN ? AND ?"
            params.extend([from_date, to_date])
        
        sql = f"""
            SELECT COALESCE(SUM(jel.debit - jel.credit), 0) as balance
            FROM journal_entry_lines jel
            INNER JOIN journal_entries je ON jel.journal_entry_id = je.id
            WHERE jel.account_id = ?
            {date_filter}
        """
        
        result = self.db.fetch_one(sql, params)
        return result['balance'] if result else 0.0
    
    def create_account_with_hierarchy(
        self, 
        account_data: dict,
        parent_account_id: Optional[int] = None
    ) -> int:
        """Create account and update hierarchy if needed."""
        # Validate parent exists if specified
        if parent_account_id is not None:
            parent = self.find_by_id(parent_account_id)
            if parent is None:
                raise ValueError(f"Parent account {parent_account_id} not found")
            account_data['parent_account_id'] = parent_account_id
        
        account_id = self.insert(account_data)
        
        # Invalidate cache for parent's children
        if parent_account_id:
            self._cache.invalidate(f"{self.table_name}:children:{parent_account_id}")
        
        logger.info(f"Created account {account_id} under parent {parent_account_id}")
        return account_id
    
    def update_account_hierarchy(
        self, 
        account_id: int, 
        new_parent_id: Optional[int] = None
    ) -> None:
        """Update account's parent in hierarchy."""
        # Check for circular reference
        if new_parent_id is not None:
            children = self.find_children(account_id)
            if any(child['id'] == new_parent_id for child in children):
                raise ValueError("Cannot set parent to a child account (circular reference)")
        
        self.update(account_id, {'parent_account_id': new_parent_id})
        
        # Invalidate affected caches
        self._cache.invalidate(f"{self.table_name}:children:")
    
    def find_system_accounts(self) -> List[dict]:
        """Find all system accounts (non-deletable)."""
        sql = f"""
            SELECT * FROM {self.table_name}
            WHERE is_system_account = 1 AND is_active = 1
            ORDER BY account_code
        """
        return self.db.fetch_all(sql)
    
    def count_by_type(self, account_type: str) -> int:
        """Count accounts by type."""
        return self.count("account_type = ? AND is_active = 1", (account_type,))
