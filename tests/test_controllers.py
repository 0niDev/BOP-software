"""Controller tests: thin facades translate service errors into (result, error)."""
from __future__ import annotations

import pytest

from models.enums import PartyType
from utils.exceptions import ERPException, ValidationError
from controllers.party_controller import PartyController
from controllers.dashboard_controller import DashboardController
from controllers.item_controller import ItemController


class _FakePartyService:
    """Stub service to exercise controller error mapping without a DB."""

    def __init__(self, fail=False):
        self.fail = fail
        self.calls = 0

    def create_party(self, **kwargs):
        self.calls += 1
        if self.fail:
            raise ValidationError("boom")
        from models.party import Party
        return Party(code="TST-1", name=kwargs["name"], party_type=kwargs["party_type"])

    def list_parties(self, **kwargs):
        if self.fail:
            raise ValidationError("list boom")
        from models.party import Party
        return [Party(code="TST-1", name="X", party_type=PartyType.CUSTOMER)]

    def update_party(self, *args, **kwargs):
        if self.fail:
            raise ValidationError("update boom")
        return None

    def deactivate_party(self, *args, **kwargs):
        if self.fail:
            raise ValidationError("deactivate boom")
        return None


class _FakeDashboardService:
    def __init__(self, fail=False):
        self.fail = fail

    def get_dashboard_data(self, force_refresh=False):
        if self.fail:
            raise ValidationError("dashboard boom")
        return {"balances": {"cash": 1}}


class TestPartyController:
    def test_create_success(self):
        ctrl = PartyController(party_service=_FakePartyService())
        ok, err = ctrl.create_party(name="X", party_type=PartyType.CUSTOMER, credit_limit=0)
        assert ok is True and err is None

    def test_create_error_maps_to_tuple(self):
        ctrl = PartyController(party_service=_FakePartyService(fail=True))
        ok, err = ctrl.create_party(name="X", party_type=PartyType.CUSTOMER, credit_limit=0)
        assert ok is False
        assert err == "boom"

    def test_unexpected_error_has_fallback(self):
        class Exploding(_FakePartyService):
            def create_party(self, **kwargs):
                raise RuntimeError("unexpected")

        ctrl = PartyController(party_service=Exploding())
        ok, err = ctrl.create_party(name="X", party_type=PartyType.CUSTOMER, credit_limit=0)
        assert ok is False
        assert "unexpected" in err.lower()

    def test_list_success(self):
        ctrl = PartyController(party_service=_FakePartyService())
        parties, err = ctrl.list_parties()
        assert err is None
        assert len(parties) == 1

    def test_list_error(self):
        ctrl = PartyController(party_service=_FakePartyService(fail=True))
        parties, err = ctrl.list_parties()
        assert parties == []
        assert err == "list boom"


class TestDashboardController:
    def test_get_data_success(self):
        ctrl = DashboardController(dashboard_service=_FakeDashboardService())
        data, err = ctrl.get_dashboard_data()
        assert err is None
        assert data["balances"]["cash"] == 1

    def test_get_data_error(self):
        ctrl = DashboardController(dashboard_service=_FakeDashboardService(fail=True))
        data, err = ctrl.get_dashboard_data()
        assert data is None
        assert err == "dashboard boom"

    def test_refresh_data(self):
        ctrl = DashboardController(dashboard_service=_FakeDashboardService())
        data, err = ctrl.refresh_dashboard_data()
        assert err is None
        assert "balances" in data


class TestItemController:
    def test_controller_constructs_with_service(self):
        # Ensure the real controller accepts an injected service (sanity)
        ctrl = ItemController(item_service=None)
        assert ctrl is not None
