"""Party repository for customers and suppliers"""

from repositories.base_repository import BaseRepository
from models.party import Party, PartyType
from database import db


class PartyRepository(BaseRepository[Party]):
    """Repository for Party operations"""
    
    def __init__(self):
        super().__init__(Party, 'parties')
    
    def get_by_code(self, code: str, company_id: int) -> Party | None:
        """Get party by code and company"""
        return self.get_all("code = ? AND company_id = ?", (code, company_id))[0] \
            if self.exists("code = ? AND company_id = ?", (code, company_id)) else None
    
    def get_by_company(self, company_id: int) -> list[Party]:
        """Get all parties for a company"""
        return self.get_all("company_id = ?", (company_id,), "name")
    
    def get_customers(self, company_id: int) -> list[Party]:
        """Get all customers for a company"""
        return self.get_all(
            "company_id = ? AND (party_type = ? OR party_type = ?)",
            (company_id, PartyType.CUSTOMER.value, PartyType.BOTH.value),
            "name"
        )
    
    def get_suppliers(self, company_id: int) -> list[Party]:
        """Get all suppliers for a company"""
        return self.get_all(
            "company_id = ? AND (party_type = ? OR party_type = ?)",
            (company_id, PartyType.SUPPLIER.value, PartyType.BOTH.value),
            "name"
        )
    
    def get_active_parties(self, company_id: int) -> list[Party]:
        """Get all active parties"""
        return self.get_all("company_id = ? AND is_active = ?", (company_id, 1), "name")
    
    def search_parties(self, company_id: int, search_term: str) -> list[Party]:
        """Search parties by name, code, or contact info"""
        return self.search(search_term, ['name', 'code', 'phone', 'mobile', 'email'])
    
    def update_balance(self, party_id: int, balance: float) -> bool:
        """Update party balance"""
        db.execute(
            "UPDATE parties SET current_balance = ? WHERE id = ?",
            (balance, party_id)
        )
        self._invalidate_cache(party_id)
        return True
    
    def get_party_ledger(self, party_id: int, company_id: int) -> list[dict]:
        """Get complete ledger for a party with all transactions"""
        query = """
            SELECT 
                je.date,
                je.voucher_number,
                je.voucher_type,
                jel.narration,
                jel.debit,
                jel.credit,
                CASE 
                    WHEN jel.debit > 0 THEN 'Dr'
                    ELSE 'Cr'
                END as type
            FROM journal_entry_lines jel
            JOIN journal_entries je ON jel.journal_entry_id = je.id
            WHERE jel.party_id = ? AND je.company_id = ? AND je.is_posted = 1
            ORDER BY je.date, je.voucher_number
        """
        return db.fetch_all(query, (party_id, company_id))
    
    def get_outstanding_invoices(self, party_id: int, company_id: int) -> list[dict]:
        """Get all outstanding invoices for a party"""
        # Sales invoices (receivables)
        sales_query = """
            SELECT 
                id, invoice_number, date, total_amount, amount_paid,
                balance_amount, 'Sales' as type
            FROM sales_invoices
            WHERE party_id = ? AND company_id = ? AND balance_amount > 0
            ORDER BY date
        """
        
        # Purchase invoices (payables)
        purchase_query = """
            SELECT 
                id, invoice_number, date, total_amount, amount_paid,
                balance_amount, 'Purchase' as type
            FROM purchase_invoices
            WHERE party_id = ? AND company_id = ? AND balance_amount > 0
            ORDER BY date
        """
        
        sales_rows = db.fetch_all(sales_query, (party_id, company_id))
        purchase_rows = db.fetch_all(purchase_query, (party_id, company_id))
        
        return sales_rows + purchase_rows
