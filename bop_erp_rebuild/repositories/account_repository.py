"""Account repository for Chart of Accounts"""

from repositories.base_repository import BaseRepository
from models.account import Account, AccountType
from database import db


class AccountRepository(BaseRepository[Account]):
    """Repository for Account operations"""
    
    def __init__(self):
        super().__init__(Account, 'accounts')
    
    def get_by_code(self, code: str, company_id: int) -> Account | None:
        """Get account by code and company"""
        return self.get_all("code = ? AND company_id = ?", (code, company_id))[0] \
            if self.exists("code = ? AND company_id = ?", (code, company_id)) else None
    
    def get_by_company(self, company_id: int) -> list[Account]:
        """Get all accounts for a company"""
        return self.get_all("company_id = ?", (company_id,), "code")
    
    def get_by_type(self, account_type: AccountType, company_id: int) -> list[Account]:
        """Get accounts by type for a company"""
        return self.get_all(
            "account_type = ? AND company_id = ?",
            (account_type.value, company_id),
            "code"
        )
    
    def get_balance_sheet_accounts(self, company_id: int) -> list[Account]:
        """Get all balance sheet accounts"""
        types = [t.value for t in AccountType.balance_sheet_types()]
        placeholders = ','.join(['?' for _ in types])
        return self.get_all(
            f"account_type IN ({placeholders}) AND company_id = ?",
            (*types, company_id),
            "code"
        )
    
    def get_profit_loss_accounts(self, company_id: int) -> list[Account]:
        """Get all profit and loss accounts"""
        types = [t.value for t in AccountType.profit_loss_types()]
        placeholders = ','.join(['?' for _ in types])
        return self.get_all(
            f"account_type IN ({placeholders}) AND company_id = ?",
            (*types, company_id),
            "code"
        )
    
    def get_parent_accounts(self, company_id: int) -> list[Account]:
        """Get all parent (group) accounts"""
        return self.get_all(
            "is_group = ? AND company_id = ?",
            (1, company_id),
            "code"
        )
    
    def get_child_accounts(self, parent_id: int) -> list[Account]:
        """Get all child accounts under a parent"""
        return self.get_all("parent_id = ?", (parent_id,), "code")
    
    def get_bank_accounts(self, company_id: int) -> list[Account]:
        """Get all bank accounts"""
        return self.get_all(
            "is_bank_account = ? AND company_id = ?",
            (1, company_id),
            "name"
        )
    
    def get_tree(self, company_id: int) -> list[dict]:
        """Get account hierarchy as tree structure"""
        accounts = self.get_by_company(company_id)
        
        # Build tree
        tree = []
        children_map = {}
        
        for acc in accounts:
            children_map[acc.id] = []
        
        for acc in accounts:
            if acc.parent_id and acc.parent_id in children_map:
                children_map[acc.parent_id].append(acc)
            else:
                tree.append(acc)
        
        return self._format_tree(tree, children_map)
    
    def _format_tree(self, accounts: list[Account], children_map: dict) -> list[dict]:
        """Format accounts into tree structure"""
        result = []
        for acc in accounts:
            node = {
                'id': acc.id,
                'code': acc.code,
                'name': acc.name,
                'type': acc.account_type.value,
                'children': self._format_tree(children_map.get(acc.id, []), children_map)
            }
            result.append(node)
        return result
    
    def update_balance(self, account_id: int, balance: float) -> bool:
        """Update account balance"""
        db.execute(
            "UPDATE accounts SET current_balance = ? WHERE id = ?",
            (balance, account_id)
        )
        self._invalidate_cache(account_id)
        return True
    
    def get_accounts_with_balance(self, company_id: int) -> list[Account]:
        """Get all accounts with calculated balances from journal entries"""
        query = """
            SELECT 
                a.id,
                a.code,
                a.name,
                a.account_type,
                a.parent_id,
                a.company_id,
                a.is_group,
                a.opening_balance,
                COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0) as calculated_balance
            FROM accounts a
            LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id
            LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.is_posted = 1
            WHERE a.company_id = ?
            GROUP BY a.id
        """
        rows = db.fetch_all(query, (company_id,))
        
        accounts = []
        for row in rows:
            acc = Account.from_row(row)
            acc.current_balance = row['calculated_balance'] + acc.opening_balance
            accounts.append(acc)
        
        return accounts
