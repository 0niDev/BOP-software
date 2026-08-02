"""Party Controller for BOP Nutraceuticals ERP."""

from typing import List, Optional, Dict, Any
from datetime import date
from decimal import Decimal
from models.party import Party, PartyType
from services.party_service import PartyService


class PartyController:
    """Controller for party (customer/supplier) operations."""
    
    def __init__(self, party_service: PartyService):
        self.party_service = party_service
    
    def create_party(
        self,
        company_id: str,
        name: str,
        party_type: PartyType,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        address: Optional[str] = None,
        gst_number: Optional[str] = None,
        credit_limit: Optional[Decimal] = None,
        opening_balance: Decimal = Decimal('0.00'),
        narration: str = ""
    ) -> tuple[bool, str, Optional[Party]]:
        """Create a new party."""
        try:
            party = self.party_service.create_party(
                company_id=company_id,
                name=name,
                party_type=party_type,
                email=email,
                phone=phone,
                address=address,
                gst_number=gst_number,
                credit_limit=credit_limit,
                opening_balance=opening_balance,
                narration=narration
            )
            
            if party:
                return True, f"Party {party.name} created successfully.", party
            else:
                return False, "Failed to create party.", None
                
        except Exception as e:
            return False, f"Error creating party: {str(e)}", None
    
    def get_party(self, party_id: str) -> Optional[Party]:
        """Get party by ID."""
        try:
            return self.party_service.get_party(party_id)
        except Exception:
            return None
    
    def update_party(
        self,
        party_id: str,
        name: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        address: Optional[str] = None,
        gst_number: Optional[str] = None,
        credit_limit: Optional[Decimal] = None
    ) -> tuple[bool, str]:
        """Update existing party."""
        try:
            result = self.party_service.update_party(
                party_id=party_id,
                name=name,
                email=email,
                phone=phone,
                address=address,
                gst_number=gst_number,
                credit_limit=credit_limit
            )
            
            if result:
                return True, "Party updated successfully."
            else:
                return False, "Failed to update party."
                
        except Exception as e:
            return False, f"Error updating party: {str(e)}"
    
    def get_all_parties(
        self,
        company_id: str,
        party_type: Optional[PartyType] = None
    ) -> List[Party]:
        """Get all parties for a company."""
        try:
            return self.party_service.get_all_parties(company_id, party_type)
        except Exception:
            return []
    
    def get_customers(self, company_id: str) -> List[Party]:
        """Get all customers."""
        try:
            return self.party_service.get_all_parties(company_id, PartyType.CUSTOMER)
        except Exception:
            return []
    
    def get_suppliers(self, company_id: str) -> List[Party]:
        """Get all suppliers."""
        try:
            return self.party_service.get_all_parties(company_id, PartyType.SUPPLIER)
        except Exception:
            return []
    
    def get_party_outstanding(self, company_id: str, party_id: str) -> Decimal:
        """Get outstanding balance for a party."""
        try:
            return self.party_service.get_party_outstanding(company_id, party_id)
        except Exception:
            return Decimal('0.00')
    
    def get_party_ledger(
        self,
        company_id: str,
        party_id: str,
        from_date: date,
        to_date: date
    ) -> List[Dict[str, Any]]:
        """Get ledger for a party."""
        try:
            return self.party_service.get_party_ledger(
                company_id=company_id,
                party_id=party_id,
                from_date=from_date,
                to_date=to_date
            )
        except Exception:
            return []
    
    def get_accounts_receivable(
        self,
        company_id: str,
        as_of_date: date
    ) -> List[Dict[str, Any]]:
        """Get accounts receivable aging report."""
        try:
            return self.party_service.get_accounts_receivable(company_id, as_of_date)
        except Exception:
            return []
    
    def get_accounts_payable(
        self,
        company_id: str,
        as_of_date: date
    ) -> List[Dict[str, Any]]:
        """Get accounts payable aging report."""
        try:
            return self.party_service.get_accounts_payable(company_id, as_of_date)
        except Exception:
            return []
    
    def search_parties(
        self,
        company_id: str,
        search_term: str,
        party_type: Optional[PartyType] = None
    ) -> List[Party]:
        """Search parties by name or code."""
        try:
            return self.party_service.search_parties(
                company_id=company_id,
                search_term=search_term,
                party_type=party_type
            )
        except Exception:
            return []
