"""Company repository"""

from repositories.base_repository import BaseRepository
from models.company import Company


class CompanyRepository(BaseRepository[Company]):
    """Repository for Company operations"""
    
    def __init__(self):
        super().__init__(Company, 'companies')
    
    def get_by_code(self, code: str) -> Company | None:
        """Get company by code"""
        return self.get_all("code = ?", (code,))[0] if self.exists("code = ?", (code,)) else None
    
    def get_active_companies(self) -> list[Company]:
        """Get all active companies"""
        return self.get_all("is_active = ?", (1,), "name")
    
    def get_company_with_balance(self, company_id: int) -> Company | None:
        """Get company with updated balance information"""
        company = self.get_by_id(company_id)
        if company:
            # Could add additional balance calculations here
            pass
        return company
