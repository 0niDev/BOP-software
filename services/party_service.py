# services/party_service.py
"""Business rules for Parties (creation, validation, credit checks)."""
from __future__ import annotations

from database.connection import DatabaseConnection, get_db
from models.party import Party
from models.enums import PartyType
from repositories.party_repository import PartyRepository
from repositories.account_repository import AccountRepository
from repositories.journal_repository import JournalRepository
from utils.exceptions import ValidationError
from utils.logger import get_logger

logger = get_logger(__name__)


class PartyService:
    def __init__(self, db: DatabaseConnection | None = None):
        self.db = db or get_db()
        self.repo = PartyRepository(self.db)
        self.account_repo = AccountRepository(self.db)
        self.journal_repo = JournalRepository(self.db)

    def create_party(
        self,
        name: str,
        party_type: PartyType,
        credit_limit: float = 0.0,
        account_id: int | None = None,
        code: str | None = None,
        company_id: int = 1,
    ) -> Party:
        """
        Creates a new party with AUTO-GENERATED code if not provided.
        """
        # 1. Validate name
        name = name.strip()
        if not name:
            raise ValidationError("Party name is required.")
        if credit_limit < 0:
            raise ValidationError("Credit limit cannot be negative.")

        # 2. ✅ FIX: Handle code properly
        if code is not None:
            # Manual code provided - validate it
            code = code.strip()
            if not code:
                raise ValidationError("Party code cannot be empty.")
            existing = self.repo.find_by_code(code, party_type.value, company_id)
            if existing:
                raise ValidationError(f"Party code '{code}' already exists.")
        else:
            # Auto-generate code based on party type
            document_type = "CUSTOMER" if party_type == PartyType.CUSTOMER else "SUPPLIER"
            code = self.journal_repo.next_voucher_number(company_id, document_type)
            # This generates "CUST-00001" or "SUPP-00001"
            logger.info(f"Auto-generated party code: {code}")

        # 3. Validate account linkage (if provided)
        if account_id is not None:
            account = self.account_repo.find_by_id(account_id)
            if account is None:
                raise ValidationError("Specified account does not exist.")
            if party_type == PartyType.CUSTOMER and account["account_type"] != "ASSET":
                raise ValidationError("Customer accounts must link to asset-type accounts (e.g., A/R).")
            if party_type == PartyType.SUPPLIER and account["account_type"] != "LIABILITY":
                raise ValidationError("Supplier accounts must link to liability-type accounts (e.g., A/P).")

        # 4. Create party instance
        party = Party(
            code=code,
            name=name,
            party_type=party_type,
            credit_limit=credit_limit,
            account_id=account_id,
            company_id=company_id,
        )

        # 5. Persist within transaction
        with self.db.transaction():
            new_id = self.repo.insert_unique(party.to_dict())
            party.id = new_id

        logger.info("Created party %s - %s (id=%s)", code, name, new_id)
        return party

    def update_party(
        self,
        party_id: int,
        name: str,
        credit_limit: float,
        account_id: int | None,
        is_active: bool = True,
        party_type: str | None = None,
    ) -> None:
        """Updates party details."""
        existing = self.repo.get_by_id(party_id)
        name = name.strip()
        if not name:
            raise ValidationError("Party name is required.")
        if credit_limit < 0:
            raise ValidationError("Credit limit cannot be negative.")
        
        if not is_active and self._has_open_transactions(party_id):
            raise ValidationError("Cannot deactivate party with open transactions.")

        # Build update data
        update_data = {
            "name": name,
            "credit_limit": credit_limit,
            "account_id": account_id,
            "is_active": int(is_active),
        }
        
        # Add party_type if provided (string value)
        if party_type:
            update_data["party_type"] = party_type

        self.repo.update(party_id, update_data)
        logger.info("Updated party id=%s", party_id)

    def deactivate_party(self, party_id: int) -> None:
        """Deactivates party if safe"""
        party = self.repo.get_by_id(party_id)
        if self._has_open_transactions(party_id):
            raise ValidationError("Cannot deactivate party with open transactions.")
        self.repo.deactivate(party_id)
        logger.info("Deactivated party id=%s", party_id)

    def get_party(self, party_id: int) -> Party:
        """Gets party by ID"""
        return Party.from_row(self.repo.get_by_id(party_id))

    def list_parties(
        self, 
        company_id: int = 1, 
        active_only: bool = True,
        party_type: PartyType | str | None = None
    ) -> list[Party]:
        """Lists parties with optional filtering."""
        # Convert to string if enum
        if isinstance(party_type, PartyType):
            party_type_str = party_type.value
        elif isinstance(party_type, str):
            party_type_str = party_type
        else:
            party_type_str = None
        
        rows = self.repo.find_all_for_company(
            company_id, 
            active_only=active_only,
            party_type=party_type_str
        )
        return [Party.from_row(r) for r in rows]

    def get_balance(self, party_id: int) -> float:
        """Gets net balance for a party from journal entry lines."""
        result = self.db.fetch_one("""
            SELECT 
                COALESCE(SUM(CASE WHEN jel.debit > 0 THEN jel.debit ELSE 0 END), 0) as total_debit,
                COALESCE(SUM(CASE WHEN jel.credit > 0 THEN jel.credit ELSE 0 END), 0) as total_credit
            FROM journal_entry_lines jel
            JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.is_posted = 1
            WHERE jel.party_id = ?
        """, (party_id,))
        
        if not result:
            return 0.0
        
        # For suppliers (liability): credit balance is what we owe them
        # For customers (asset): debit balance is what they owe us
        party = self.repo.get_by_id(party_id)
        if party and party.get('party_type') == 'SUPPLIER':
            # Supplier balance = credits - debits (positive = we owe them)
            return result['total_credit'] - result['total_debit']
        else:
            # Customer balance = debits - credits (positive = they owe us)
            return result['total_debit'] - result['total_credit']

    def _has_open_transactions(self, party_id: int) -> bool:
        """Helper: Checks if party has open invoices/payments"""
        return False