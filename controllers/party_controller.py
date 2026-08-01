# controllers/party_controller.py
"""Controller for Parties screen - translates service errors to UI messages."""
from __future__ import annotations

from models.party import Party
from models.enums import PartyType
from services.party_service import PartyService
from utils.exceptions import ERPException
from utils.logger import get_logger

logger = get_logger(__name__)


class PartyController:
    def __init__(self, party_service: PartyService | None = None):
        # ✅ FIX: Set self.service
        self.service = party_service or PartyService()  # ← THIS WAS MISSING!

    def create_party(
        self,
        name: str,
        party_type: PartyType,
        credit_limit: float,
        account_id: int | None = None,
        code: str | None = None,  # ✅ Make it optional
    ) -> tuple[bool, str | None]:
        """Attempts to create party with optional code (auto-generated if not provided)."""
        try:
            self.service.create_party(
                name=name,
                party_type=party_type,
                credit_limit=credit_limit,
                account_id=account_id,
                code=code,  # Pass through (None = auto-generate)
            )
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error creating party")
            return False, "An unexpected error occurred while creating the party."

    def update_party(
        self,
        party_id: int,
        name: str,
        credit_limit: float,
        account_id: int | None,
        is_active: bool = True,
        party_type: str | None = None,
    ) -> tuple[bool, str | None]:
        """Attempts to update party"""
        try:
            self.service.update_party(
                party_id, name, credit_limit, account_id, is_active, party_type
            )
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error updating party")
            return False, "An unexpected error occurred while updating the party."

    def deactivate_party(self, party_id: int) -> tuple[bool, str | None]:
        """Attempts to deactivate party"""
        try:
            self.service.deactivate_party(party_id)
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error deactivating party")
            return False, "An unexpected error occurred."

    def list_parties(
        self, 
        active_only: bool = True,
        party_type: str | None = None
    ) -> tuple[list[Party], str | None]:
        """Lists parties."""
        try:
            # Convert string to enum if needed
            from models.enums import PartyType
            party_type_enum = None
            if party_type:
                try:
                    party_type_enum = PartyType(party_type)
                except ValueError:
                    party_type_enum = party_type
            
            parties = self.service.list_parties(
                active_only=active_only, 
                party_type=party_type_enum
            )
            return parties, None
        except ERPException as exc:
            return [], str(exc)
        except Exception:
            logger.exception("Unexpected error listing parties")
            return [], "An unexpected error occurred while loading parties."    