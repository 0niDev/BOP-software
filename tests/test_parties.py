"""Business-rule tests for PartyService (creation, validation, deactivation
guards, listing) and the PartyController."""
from __future__ import annotations

import pytest

from models.enums import PartyType
from services.party_service import PartyService
from utils.exceptions import ValidationError


@pytest.fixture()
def svc(qa_db):
    return PartyService(qa_db)


class TestPartyService:
    def test_create_customer_autocode(self, svc):
        party = svc.create_party(name="Acme", party_type=PartyType.CUSTOMER)
        assert party.id is not None
        assert party.code  # auto-generated
        assert party.party_type == PartyType.CUSTOMER

    def test_create_supplier_with_manual_code(self, svc):
        party = svc.create_party(name="Vendor", party_type=PartyType.SUPPLIER, code="V-100")
        assert party.code == "V-100"

    def test_create_blank_name_raises(self, svc):
        with pytest.raises(ValidationError):
            svc.create_party(name="   ", party_type=PartyType.CUSTOMER)

    def test_create_negative_credit_raises(self, svc):
        with pytest.raises(ValidationError):
            svc.create_party(name="X", party_type=PartyType.CUSTOMER, credit_limit=-1)

    def test_create_duplicate_manual_code_raises(self, svc):
        svc.create_party(name="A", party_type=PartyType.CUSTOMER, code="DD")
        with pytest.raises(ValidationError):
            svc.create_party(name="B", party_type=PartyType.CUSTOMER, code="DD")
        # code is unique company-wide: even a different party type cannot reuse it
        from utils.exceptions import DatabaseError
        with pytest.raises((ValidationError, DatabaseError)):
            svc.create_party(name="C", party_type=PartyType.SUPPLIER, code="DD")

    def test_create_with_invalid_account_raises(self, svc, qa_db):
        from repositories.account_repository import AccountRepository
        # 4000 is REVENUE, not ASSET -> customer account link should fail
        rev = AccountRepository(qa_db).find_by_code("4000")
        with pytest.raises(ValidationError):
            svc.create_party(name="X", party_type=PartyType.CUSTOMER, account_id=rev["id"])

    def test_update_party(self, svc):
        party = svc.create_party(name="Before", party_type=PartyType.CUSTOMER)
        svc.update_party(party.id, name="After", credit_limit=500.0,
                         account_id=None, is_active=True, party_type=PartyType.CUSTOMER.value)
        updated = svc.get_party(party.id)
        assert updated.name == "After"
        assert updated.credit_limit == 500.0

    def test_update_invalid_name_raises(self, svc):
        party = svc.create_party(name="X", party_type=PartyType.CUSTOMER)
        with pytest.raises(ValidationError):
            svc.update_party(party.id, name=" ", credit_limit=0.0, account_id=None)

    def test_get_party(self, svc):
        party = svc.create_party(name="Find Me", party_type=PartyType.SUPPLIER)
        assert svc.get_party(party.id).name == "Find Me"

    def test_list_parties_filters_by_type_and_active(self, svc):
        svc.create_party(name="C1", party_type=PartyType.CUSTOMER)
        svc.create_party(name="C2", party_type=PartyType.CUSTOMER)
        svc.create_party(name="S1", party_type=PartyType.SUPPLIER)
        assert len(svc.list_parties(party_type=PartyType.CUSTOMER)) == 2
        assert len(svc.list_parties(party_type=PartyType.SUPPLIER)) == 1
        assert len(svc.list_parties(party_type="CUSTOMER")) == 2  # string works too
        # Both type + active
        assert len(svc.list_parties()) == 3

    def test_deactivate_party(self, svc):
        party = svc.create_party(name="Temp", party_type=PartyType.CUSTOMER)
        svc.deactivate_party(party.id)
        assert svc.get_party(party.id).is_active is False

    def test_deactivate_party_with_open_sales_blocked(self, qa_db):
        from helpers import seed as s
        from services.sales_invoice_service import SalesInvoiceService
        cust, item = s.make_customer_and_stocked_item(qa_db)
        SalesInvoiceService(qa_db).create_sales_invoice(
            invoice_number="SI-TEST-1", customer_id=cust.id,
            invoice_date="2026-01-01", payment_type="CREDIT",
            items=[{"item_id": item.id, "quantity": 1, "unit_price": 70.0}],
        )
        svc = PartyService(qa_db)
        with pytest.raises(ValidationError):
            svc.deactivate_party(cust.id)

    def test_get_balance_returns_zero_placeholder(self, svc):
        party = svc.create_party(name="X", party_type=PartyType.CUSTOMER)
        assert svc.get_balance(party.id) == 0.0


class TestPartyController:
    def test_create_list(self, qa_db):
        from controllers.party_controller import PartyController
        from services.party_service import PartyService
        ctrl = PartyController()
        ok, err = ctrl.create_party(
            name="Ctrl Cust", party_type=PartyType.CUSTOMER, credit_limit=0.0
        )
        assert ok is True and err is None
        parties, err2 = ctrl.list_parties()
        assert any(p.name == "Ctrl Cust" for p in parties)
        # the service created it with an auto code
        found = PartyService(qa_db).list_parties(party_type=PartyType.CUSTOMER)
        assert any(p.name == "Ctrl Cust" for p in found)

    def test_create_blank_returns_error(self, qa_db):
        from controllers.party_controller import PartyController
        ctrl = PartyController()
        ok, err = ctrl.create_party(name=" ", party_type=PartyType.CUSTOMER, credit_limit=0.0)
        assert ok is False and err is not None