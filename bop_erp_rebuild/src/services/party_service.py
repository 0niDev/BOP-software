"""
Party Service - Customer and Supplier management
Handles party (customer/supplier) operations and balance tracking.
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from models.party import Party, PartyType, ContactPerson
from repositories.party_repository import PartyRepository
from services.accounting_service import AccountingService
from database.connection_manager import get_connection


class PartyServiceError(Exception):
    """Custom exception for party service errors."""
    pass


class PartyService:
    """
    Handles all party (customer/supplier) operations including:
    - Party CRUD operations
    - Balance tracking
    - Credit limit management
    - Contact person management
    """
    
    def __init__(self, company_id: str):
        self.company_id = company_id
        self.party_repo = PartyRepository()
        self.accounting_service = AccountingService(company_id)
    
    def create_party(
        self,
        name: str,
        party_type: PartyType,
        code: str,
        email: str = "",
        phone: str = "",
        address: str = "",
        gst_no: str = "",
        pan_no: str = "",
        credit_limit: Decimal = Decimal('0'),
        payment_terms_days: int = 30,
        is_active: bool = True
    ) -> Party:
        """
        Create a new party (customer or supplier).
        """
        conn = None
        try:
            conn = get_connection()
            
            # Check if code already exists
            existing = self.party_repo.get_by_code(conn, code, self.company_id)
            if existing:
                raise PartyServiceError(f"Party code {code} already exists")
            
            party = Party(
                id='',  # Will be set by repository
                company_id=self.company_id,
                party_type=party_type,
                code=code,
                name=name,
                email=email,
                phone=phone,
                address=address,
                gst_no=gst_no,
                pan_no=pan_no,
                credit_limit=credit_limit,
                payment_terms_days=payment_terms_days,
                is_active=is_active,
                created_at=datetime.now()
            )
            
            self.party_repo.create(conn, party)
            self.party_repo.invalidate_cache()
            
            return party
            
        finally:
            if conn:
                conn.close()
    
    def update_party(self, party_id: str, updates: Dict[str, Any]) -> Party:
        """
        Update an existing party.
        """
        conn = None
        try:
            conn = get_connection()
            
            party = self.party_repo.get_by_id(conn, party_id)
            if not party:
                raise PartyServiceError(f"Party {party_id} not found")
            
            # Apply updates
            for key, value in updates.items():
                if hasattr(party, key):
                    setattr(party, key, value)
            
            self.party_repo.update(conn, party)
            self.party_repo.invalidate_cache()
            
            return party
            
        finally:
            if conn:
                conn.close()
    
    def get_party_by_id(self, party_id: str) -> Optional[Party]:
        """
        Get party by ID.
        """
        conn = None
        try:
            conn = get_connection()
            return self.party_repo.get_by_id(conn, party_id)
        finally:
            if conn:
                conn.close()
    
    def get_party_by_code(self, code: str) -> Optional[Party]:
        """
        Get party by code.
        """
        conn = None
        try:
            conn = get_connection()
            return self.party_repo.get_by_code(conn, code, self.company_id)
        finally:
            if conn:
                conn.close()
    
    def get_all_parties(
        self,
        party_type: Optional[PartyType] = None,
        is_active: bool = True
    ) -> List[Party]:
        """
        Get all parties with optional filters.
        """
        conn = None
        try:
            conn = get_connection()
            return self.party_repo.get_all(conn, self.company_id, party_type, is_active)
        finally:
            if conn:
                conn.close()
    
    def get_customers(self) -> List[Party]:
        """
        Get all customers.
        """
        return self.get_all_parties(PartyType.CUSTOMER, True)
    
    def get_suppliers(self) -> List[Party]:
        """
        Get all suppliers.
        """
        return self.get_all_parties(PartyType.SUPPLIER, True)
    
    def get_party_balance(self, party_id: str, as_of_date: Optional[date] = None) -> Decimal:
        """
        Get outstanding balance for a party.
        Positive = receivable (customer owes us)
        Negative = payable (we owe supplier)
        """
        conn = None
        try:
            conn = get_connection()
            
            party = self.party_repo.get_by_id(conn, party_id)
            if not party:
                raise PartyServiceError(f"Party {party_id} not found")
            
            # Get party's account code from their record
            # For now, use default based on party type
            if party.party_type == PartyType.CUSTOMER:
                account_code = '1100-AR'  # Accounts Receivable
            else:
                account_code = '2100-AP'  # Accounts Payable
            
            # Get balance from accounting service filtered by party
            balance = self.accounting_service.get_account_balance(account_code, as_of_date)
            
            # This would need to be enhanced to filter by specific party
            # For now, returning simplified calculation
            return balance
            
        finally:
            if conn:
                conn.close()
    
    def get_party_ledger(
        self,
        party_id: str,
        from_date: date,
        to_date: date
    ) -> List[Dict[str, Any]]:
        """
        Get detailed ledger for a party.
        """
        conn = None
        try:
            conn = get_connection()
            
            party = self.party_repo.get_by_id(conn, party_id)
            if not party:
                raise PartyServiceError(f"Party {party_id} not found")
            
            # Get ledger entries from accounting service
            # This would query journal entries linked to this party
            ledger = self.accounting_service.get_party_ledger(party_id, from_date, to_date)
            
            return ledger
            
        finally:
            if conn:
                conn.close()
    
    def check_credit_limit(self, party_id: str, additional_amount: Decimal) -> bool:
        """
        Check if adding additional amount would exceed credit limit.
        
        Returns:
            True if within limit, False if exceeded
        """
        conn = None
        try:
            conn = get_connection()
            
            party = self.party_repo.get_by_id(conn, party_id)
            if not party:
                raise PartyServiceError(f"Party {party_id} not found")
            
            if party.credit_limit <= 0:
                return True  # No limit set
            
            current_balance = self.get_party_balance(party_id)
            
            if party.party_type == PartyType.CUSTOMER:
                # For customers, check if balance + additional exceeds limit
                return (current_balance + additional_amount) <= party.credit_limit
            else:
                return True  # Credit limit typically for customers only
            
        finally:
            if conn:
                conn.close()
    
    def add_contact_person(
        self,
        party_id: str,
        name: str,
        designation: str,
        email: str = "",
        phone: str = ""
    ) -> ContactPerson:
        """
        Add a contact person to a party.
        """
        conn = None
        try:
            conn = get_connection()
            
            party = self.party_repo.get_by_id(conn, party_id)
            if not party:
                raise PartyServiceError(f"Party {party_id} not found")
            
            contact = ContactPerson(
                id='',
                party_id=party_id,
                name=name,
                designation=designation,
                email=email,
                phone=phone,
                is_primary=False,
                created_at=datetime.now()
            )
            
            # Would save to contact_persons table
            # Simplified for now
            
            return contact
            
        finally:
            if conn:
                conn.close()
    
    def get_party_summary(self, party_id: str) -> Dict[str, Any]:
        """
        Get comprehensive summary for a party.
        """
        party = self.get_party_by_id(party_id)
        if not party:
            return {}
        
        balance = self.get_party_balance(party_id)
        
        return {
            'party': party,
            'balance': balance,
            'credit_limit': party.credit_limit,
            'available_credit': party.credit_limit - balance if party.credit_limit > 0 else None,
            'payment_terms_days': party.payment_terms_days
        }
    
    def get_aging_report(self, as_of_date: date) -> List[Dict[str, Any]]:
        """
        Get accounts receivable aging report.
        Buckets: Current, 1-30 days, 31-60 days, 61-90 days, >90 days
        """
        conn = None
        try:
            conn = get_connection()
            
            customers = self.get_customers()
            aging_report = []
            
            for customer in customers:
                ledger = self.get_party_ledger(customer.id, date(1900, 1, 1), as_of_date)
                
                balance = Decimal('0')
                current = Decimal('0')
                days_1_30 = Decimal('0')
                days_31_60 = Decimal('0')
                days_61_90 = Decimal('0')
                days_over_90 = Decimal('0')
                
                for entry in ledger:
                    balance = entry['balance']
                    days_overdue = (as_of_date - entry['date']).days
                    
                    if days_overdue <= 0:
                        current += entry['debit'] - entry['credit']
                    elif days_overdue <= 30:
                        days_1_30 += entry['debit'] - entry['credit']
                    elif days_overdue <= 60:
                        days_31_60 += entry['debit'] - entry['credit']
                    elif days_overdue <= 90:
                        days_61_90 += entry['debit'] - entry['credit']
                    else:
                        days_over_90 += entry['debit'] - entry['credit']
                
                if balance != 0:
                    aging_report.append({
                        'party_id': customer.id,
                        'party_name': customer.name,
                        'total_balance': balance,
                        'current': current,
                        'days_1_30': days_1_30,
                        'days_31_60': days_31_60,
                        'days_61_90': days_61_90,
                        'days_over_90': days_over_90
                    })
            
            return aging_report
            
        finally:
            if conn:
                conn.close()
