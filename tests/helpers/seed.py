"""Seed data for tests through the same service layer the UI uses.

Using the real services (the same code the Save buttons invoke) keeps setup
honest while letting each test focus on the flow under test.
"""
from __future__ import annotations

from models.enums import PartyType

CUSTOMER = PartyType.CUSTOMER
SUPPLIER = PartyType.SUPPLIER


def _party_service(db=None):
    from services.party_service import PartyService
    return PartyService(db)


def _item_service(db=None):
    from services.item_service import ItemService
    return ItemService(db)


def _banking_service(db=None):
    from services.banking_service import BankingService
    return BankingService(db)


def _account_service(db=None):
    from services.account_service import AccountService
    return AccountService(db)


def make_party(db, name: str, party_type: PartyType, credit_limit: float = 0.0):
    svc = _party_service(db)
    return svc.create_party(name=name, party_type=party_type, credit_limit=credit_limit)


def customer(db, name: str):
    return make_party(db, name, CUSTOMER)


def supplier(db, name: str):
    return make_party(db, name, SUPPLIER)


def make_item(db, name: str, item_type: str = "FINISHED_GOOD", unit: str = "UNIT",
              purchase_price: float = 0.0, selling_price: float = 0.0):
    svc = _item_service(db)
    return svc.create_item(
        item_name=name, unit=unit, item_type=item_type,
        purchase_price=purchase_price, selling_price=selling_price,
    )


def add_stock(db, item_id: int, quantity: float, unit_cost: float = 0.0,
              batch_number: str | None = None, supplier_id: int | None = None,
              expiry_date: str | None = None):
    """Add opening stock. Pass supplier_id to post the OPENING inventory journal."""
    svc = _item_service(db)
    svc.add_opening_stock(
        item_id=item_id, quantity=quantity, unit_cost=unit_cost,
        batch_number=batch_number, party_id=supplier_id,
        expiry_date=expiry_date,
    )


def make_bank_account(db, bank_name: str = "HBL", account_title: str = "Main",
                      account_number: str = "1234567890", opening_balance: float = 0.0):
    svc = _banking_service(db)
    return svc.create_bank_account(
        bank_name=bank_name, account_title=account_title,
        account_number=account_number, opening_balance=opening_balance,
    )


def make_supplier_with_stocked_item(db, name: str = "Vendor Ltd"):
    """Supplier + an FG item already stocked via a supplier opening journal."""
    sup = supplier(db, name)
    it = make_item(db, f"{name} Goods", purchase_price=50.0, selling_price=100.0)
    add_stock(db, it.id, 1000, unit_cost=50.0, supplier_id=sup.id, batch_number=f"B-{sup.id}")
    return sup, it


def make_customer_and_stocked_item(db, customer_name: str = "Acme Corp", item_name: str = "Widget"):
    """Stand-alone customer (O/R) + a stocked FINISHED_GOOD sold on credit catalog."""
    cust = customer(db, customer_name)
    it = make_item(db, item_name, purchase_price=30.0, selling_price=70.0)
    add_stock(db, it.id, 500, unit_cost=30.0, batch_number=f"W-{cust.id}")
    return cust, it


def find_item(db, name: str) -> dict:
    return db.fetch_one("SELECT * FROM items WHERE item_name = ?", (name,))


def items_count(db, table: str) -> int:
    row = db.fetch_one(f"SELECT COUNT(*) AS n FROM {table}")
    return int(row["n"])