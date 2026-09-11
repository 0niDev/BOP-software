"""
tests.py - Full-system integration test script for the BOP Pharmaceutical ERP.

Every scenario below calls the EXACT controller/service functions that the
application's buttons run (e.g. clicking "Save" on a sales invoice invokes
SalesInvoiceController.create_sales_invoice - that is exactly what this script
calls).  Nothing touches the live SQLite Cloud database: each test gets a fresh
throwaway LOCAL SQLite file seeded with the real migrations.

Each test writes its own ERP log to tests/_logs/<test>.log and the logs also
stream to the console.  Known bugs are asserted as "BUG-CONFIRMED".

Usage:
    python tests.py                 # run everything
    python tests.py sales purchase  # only tests whose name contains these words
"""
from __future__ import annotations

import datetime
import io
import logging
import os
import re
import shutil
import sys
import tempfile
import time
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TESTS_DIR = ROOT / "tests"
LOG_DIR = TESTS_DIR / "_logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
for p in (str(ROOT), str(TESTS_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

os.environ["ERP_DB_ENGINE"] = "sqlitecloud"
os.environ["SQLITE_CLOUD_URL"] = "sqlitecloud://127.0.0.1:1/DO-NOT-CONNECT?apikey=none"

for _s in (sys.stdout, sys.stderr):
    if _s is not None:
        try:
            _s.reconfigure(errors="backslashreplace")
        except Exception:
            pass


# =====================================================================
# helpers re-exported so scenarios read naturally
# =====================================================================
def today() -> str:
    return datetime.date.today().isoformat()


def today_minus(days: int) -> str:
    return (datetime.date.today() - datetime.timedelta(days=days)).isoformat()


def new_db():
    """Create a fresh local DB, run the real migrations, point get_db() at it."""
    import database.connection as dbconn
    from database.migrations.add_expense_items import run_expense_items_migration
    from database.migrations.add_material_cost_columns import run_column_migration
    from database.migrations.add_temp_bom import run_temp_bom_migration
    from database.migrations.migrator import Migrator
    from helpers.local_connection import LocalSqliteConnection

    fd, path = tempfile.mkstemp(suffix=".qa.db")
    os.close(fd)
    conn = LocalSqliteConnection(path)
    Migrator(conn).run()
    run_column_migration(conn)
    run_expense_items_migration(conn)
    run_temp_bom_migration(conn)
    dbconn._db_instance = conn

    # Each scenario uses a fresh DB whose primary keys restart at 1, so any
    # row cached during an earlier scenario would be silently wrong now.
    from repositories.base_repository import BaseRepository
    from utils.cache_manager import SessionCache, _global_cache
    BaseRepository._cache.clear()
    SessionCache().clear()
    _global_cache.clear()
    return conn, path


def close_db(conn, path):
    import database.connection as dbconn
    try:
        conn.close()
    except Exception:
        pass
    dbconn._db_instance = None
    try:
        os.remove(path)
    except OSError:
        pass


def approx(a, b, tol=0.01):
    return abs(float(a) - float(b)) <= tol


def r2(x):
    return round(float(x), 2)


# ledger helpers
def bal(db, code):  # Dr - Cr for account code (credit-normal => negative)
    r = db.fetch_one(
        "SELECT COALESCE(SUM(jel.debit),0)-COALESCE(SUM(jel.credit),0) b "
        "FROM journal_entry_lines jel JOIN journal_entries je ON je.id=jel.journal_entry_id "
        "JOIN accounts a ON a.id=jel.account_id WHERE je.is_posted=1 AND a.account_code=?",
        (code,))
    return round(float(r["b"]), 2)


def cash(db): return bal(db, "1000")
def bank(db): return bal(db, "1010")
def ar(db): return bal(db, "1100")
def ap(db): return -bal(db, "2000")
def inv(db): return bal(db, "1200") + bal(db, "1210") + bal(db, "1220")


def entries_balanced(db):
    rows = db.fetch_all(
        "SELECT je.voucher_number v, je.voucher_type t, "
        "ROUND(SUM(jel.debit),2) d, ROUND(SUM(jel.credit),2) c "
        "FROM journal_entries je LEFT JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id "
        "WHERE je.is_posted=1 GROUP BY je.id")
    bad = [r for r in rows if abs(r["d"] - r["c"]) > 0.01]
    assert not bad, "Unbalanced entries: " + "; ".join(f"{r['t']} {r['v']} D{r['d']}/C{r['c']}" for r in bad)


def bank_txns(db, ref=None):
    sql = "SELECT * FROM bank_transactions WHERE 1=1"
    params = []
    if ref:
        sql += " AND reference_no=?"
        params.append(ref)
    return db.fetch_all(sql + " ORDER BY id", tuple(params))


def monitor(db, parties=()):
    """Run the report + dashboard functions the UI buttons call; assert no errors."""
    from controllers.dashboard_controller import DashboardController
    from controllers.report_controller import ReportController

    rc = ReportController()
    tb, err = rc.get_trial_balance()
    assert err is None, f"TB: {err}"
    assert tb["is_balanced"] is True
    pl, err = rc.get_profit_loss("2000-01-01", "2100-01-01")
    assert err is None, f"P&L: {err}"
    bs, err = rc.get_balance_sheet()
    assert err is None, f"BS: {err}"
    assert bs["is_balanced"] is True
    cb, err = rc.get_cash_book("2000-01-01", "2100-01-01")
    assert err is None, f"Cash book: {err}"
    for pid in parties:
        data, err = rc.get_party_ledger(pid)
        assert err is None, f"Party ledger: {err}"
    dash, err = DashboardController().get_dashboard_data()
    assert err is None, f"Dashboard: {err}"
    entries_balanced(db)
    return {"trial": tb, "pl": pl, "bs": bs, "cash_book": cb, "dashboard": dash}


# seeding through the real services (same code the Save buttons call)
def make_party(name, ptype, credit=0.0):
    from models.enums import PartyType
    from services.party_service import PartyService
    return PartyService().create_party(name=name, party_type=PartyType(ptype), credit_limit=credit)


def make_item(name, itype="FINISHED_GOOD", unit="UNIT", cost=0.0, sell=0.0):
    from services.item_service import ItemService
    return ItemService().create_item(item_name=name, unit=unit, item_type=itype,
                                     purchase_price=cost, selling_price=sell)


def add_stock(item_id, qty, unit_cost=0.0, supplier_id=None):
    from services.item_service import ItemService
    ItemService().add_opening_stock(item_id=item_id, quantity=qty, unit_cost=unit_cost,
                                    party_id=supplier_id)


def make_bank(acc_no="1234567890", opening=0.0):
    from services.banking_service import BankingService
    return BankingService().create_bank_account("HBL", "Main Bank", acc_no, opening)


def item_id(db, name):
    return db.fetch_one("SELECT id FROM items WHERE item_name=?", (name,))["id"]


def party_id(db, name):
    return db.fetch_one("SELECT id FROM parties WHERE name=?", (name,))["id"]


def fg_setup(tag):
    """supplier + stocked finished-good item (FG)."""
    sup = make_party(f"{tag} Supplier", "SUPPLIER")
    item = make_item(f"{tag} Item", "FINISHED_GOOD", "UNIT", 50.0, 100.0)
    add_stock(item.id, 1000, 50.0, sup.id)
    return sup, item


def raw_setup(tag):
    """supplier + stocked raw-material item."""
    sup = make_party(f"{tag} Supplier", "SUPPLIER")
    item = make_item(f"{tag} Raw", "RAW_MATERIAL", "KG", 30.0, 0.0)
    return sup, item


# =====================================================================
# test registry
# =====================================================================
SUITE: list[tuple[str, object, str | None]] = []


def test(name, expected_bug=None):
    def deco(fn):
        SUITE.append((name, fn, expected_bug))
        return fn
    return deco


# =====================================================================
# AUTH & USERS (Login / Users buttons' code paths)
# =====================================================================
@test("auth: valid admin login")
def _(db):
    from controllers.auth_controller import AuthController
    c = AuthController()
    user, err = c.login("admin", "admin123")
    assert err is None and user and user.username == "admin"
    assert c.current_user is not None


@test("auth: wrong password rejected")
def _(db):
    from controllers.auth_controller import AuthController
    u, e = AuthController().login("admin", "nope")
    assert u is None and "Invalid username or password." in e


@test("users: create -> update -> reset -> deactivate -> login")
def _(db):
    from controllers.auth_controller import AuthController
    c = AuthController()
    ok, e = c.create_user("mgr", "Mgr", "secret1", "Manager", "m@x.com")
    assert ok, e
    uid = db.fetch_one("SELECT id FROM users WHERE username='mgr'")["id"]
    ok, e = c.update_user(uid, "Mgr Renamed", None, "Manager", True)
    assert ok, e
    ok, e = c.reset_password(uid, "newpass1")
    assert ok, e
    u, e = c.login("mgr", "newpass1")
    assert u and not e
    c.logout()


@test("users: duplicate + short password rejected")
def _(db):
    from controllers.auth_controller import AuthController
    c = AuthController()
    ok, e = c.create_user("admin", "dup", "secret1", "Manager")
    assert not ok and "already exists" in e
    # the UI (not the controller) enforces >=6 on create; ensure a valid short user
    # can still be created and that reset_password() enforces the minimum.
    ok, e = c.create_user("shortpw", "Short", "12345", "Manager")
    assert ok, e
    uid = db.fetch_one("SELECT id FROM users WHERE username='shortpw'")["id"]
    ok, e = c.reset_password(uid, "123")
    assert not ok and "at least 6" in e


@test("roles: seeded roles + permission map")
def _(db):
    names = {r["name"] for r in db.fetch_all("SELECT name FROM roles")}
    assert {"Admin", "Accountant", "Manager", "Storekeeper", "Production Manager"} <= names
    from models.user import UserRole
    assert "users" in UserRole.ADMIN.permissions and "users" not in UserRole.ACCOUNTANT.permissions


# =====================================================================
# CHART OF ACCOUNTS + OPENING BALANCE
# =====================================================================
@test("coa: list seeded chart")
def _(db):
    from controllers.account_controller import AccountController
    accs, err = AccountController().list_accounts(active_only=False)
    assert err is None
    codes = {a.account_code for a in accs}
    assert {"1000", "1010", "1100", "2000", "3100", "4000", "5000", "6000"} <= codes


@test("coa: create asset account w/ opening posts journal + monitors")
def _(db):
    from controllers.account_controller import AccountController
    c = AccountController()
    ok, e = c.create_account("1507", "Test Equipment", "ASSET", None, 5000.0)
    assert ok, e
    assert bal(db, "1507") == 5000.0
    assert bal(db, "3100") == -5000.0
    monitor(db)


@test("coa: duplicate code / blank name rejected")
def _(db):
    from controllers.account_controller import AccountController
    c = AccountController()
    ok, e = c.create_account("1000", "dup", "ASSET", None, 0)
    assert not ok
    ok, e = c.create_account("1512", "", "ASSET", None, 0)
    assert not ok and "name" in e


@test("coa: update changes name + adjusting opening entry")
def _(db):
    from controllers.account_controller import AccountController
    c = AccountController()
    ok, e = c.create_account("1510", "Old", "ASSET", None, 1000.0)
    assert ok, e
    aid = db.fetch_one("SELECT id FROM accounts WHERE account_code='1510'")["id"]
    ok, e = c.update_account(aid, "New", 3000.0, None, True)
    assert ok, e
    assert bal(db, "1510") == 3000.0
    monitor(db)


@test("coa: system account cannot be deactivated; custom can")
def _(db):
    from controllers.account_controller import AccountController
    c = AccountController()
    cash_id = db.fetch_one("SELECT id FROM accounts WHERE account_code='1000'")["id"]
    ok, e = c.update_account(cash_id, "Cash", 0.0, None, False)
    assert not ok and "System accounts" in e
    ok, e = c.create_account("1511", "Custom", "ASSET", None, 0)
    assert ok
    aid = db.fetch_one("SELECT id FROM accounts WHERE account_code='1511'")["id"]
    ok, e = c.deactivate_account(aid)
    assert ok, e
    assert db.fetch_one("SELECT is_active FROM accounts WHERE id=?", (aid,))["is_active"] == 0


@test("opening balance: dialog math posts balanced OPENING entry")
def _(db):
    from models.enums import VoucherType
    from services.accounting_service import AccountingService, JournalLine
    from controllers.account_controller import AccountController
    c = AccountController()
    for code, name, typ in [("1507", "OB A", "ASSET"), ("1510", "OB B", "ASSET"),
                            ("2001", "OB L", "LIABILITY"), ("3005", "OB E", "EQUITY")]:
        ok, e = c.create_account(code, name, typ, None, 0.0)
        assert ok, e
    def cid(code): return db.fetch_one("SELECT id FROM accounts WHERE account_code=?", (code,))["id"]
    entries = [{"account_id": cid("1507"), "debit": 25000.0, "credit": 0.0},
               {"account_id": cid("1510"), "debit": 15000.0, "credit": 0.0},
               {"account_id": cid("2001"), "debit": 0.0, "credit": 12000.0}]
    eq = sum(e["debit"] - e["credit"] for e in entries)
    entries.append({"account_id": cid("3005"), "debit": 0.0, "credit": eq})
    acc = AccountingService(db)
    lines = [JournalLine(account_id=e["account_id"], debit=e["debit"], credit=e["credit"],
                         description="Opening balance") for e in entries]
    with db.transaction():
        acc.post_journal_entry(voucher_type=VoucherType.OPENING,
                               entry_date=today(), lines=lines, narration="Opening balances setup")
        for e in entries:
            amt = e["debit"] or e["credit"]
            db.execute("UPDATE accounts SET opening_balance=? WHERE id=?", (amt, e["account_id"]))
    assert bal(db, "3005") == -28000.0
    monitor(db)


# =====================================================================
# PARTIES & ITEMS / OPENING STOCK
# =====================================================================
@test("party: create customer/supplier/both with auto codes")
def _(db):
    from controllers.party_controller import PartyController
    from models.enums import PartyType
    c = PartyController()
    assert c.create_party("Acme", PartyType.CUSTOMER, 100000.0)[0]
    assert c.create_party("Vendor", PartyType.SUPPLIER, 50000.0)[0]
    assert c.create_party("BothCo", PartyType.BOTH, 0.0)[0]
    rows = db.fetch_all("SELECT code, party_type FROM parties ORDER BY name")
    assert rows[0]["code"].startswith("CUST-") or rows[0]["code"].startswith("SUPP-")
    assert {r["party_type"] for r in rows} == {"CUSTOMER", "SUPPLIER", "BOTH"}


@test("party: validation errors surfaced")
def _(db):
    from controllers.party_controller import PartyController
    from models.enums import PartyType
    c = PartyController()
    ok, e = c.create_party("", PartyType.CUSTOMER, 0)
    assert not ok and "required" in e
    ok, e = c.create_party("Neg", PartyType.CUSTOMER, -1)
    assert not ok and "negative" in e
    assert c.create_party("X", PartyType.CUSTOMER, 0, code="CUST-777")[0]
    ok, e = c.create_party("Y", PartyType.CUSTOMER, 0, code="CUST-777")
    assert not ok and "already exists" in e


@test("party: update + deactivate")
def _(db):
    from controllers.party_controller import PartyController
    from models.enums import PartyType
    c = PartyController()
    c.create_party("Upd", PartyType.SUPPLIER, 100)
    pid = party_id(db, "Upd")
    assert c.update_party(pid, "Upd2", 250.0, None, True)[0]
    assert c.deactivate_party(pid)[0]
    assert db.fetch_one("SELECT is_active FROM parties WHERE id=?", (pid,))["is_active"] == 0


@test("items: create + validation")
def _(db):
    from controllers.item_controller import ItemController
    c = ItemController()
    assert c.create_item("Syrup", None, "ML", 30, 60, 5, 50, None, "FINISHED_GOOD", None)[0]
    ok, e = c.create_item("", None, "ML", 0, 0, 0, 0, None, "FINISHED_GOOD", None)
    assert not ok
    ok, e = c.create_item("BadUnit", None, "BUCKET", 0, 0, 0, 0, None, "FINISHED_GOOD", None)
    assert not ok and "Invalid unit" in e
    row = db.fetch_one("SELECT item_code FROM items WHERE item_name='Syrup'")
    assert row["item_code"].startswith("ITEM-")


@test("items: opening stock posts inventory journal")
def _(db):
    from controllers.item_controller import ItemController
    c = ItemController()
    assert c.create_item("Powder", None, "KG", 40, 80, 0, 0, None, "RAW_MATERIAL", None)[0]
    iid = item_id(db, "Powder")
    sup = make_party("Stock Sup", "SUPPLIER")
    ok, e = c.add_opening_stock(iid, 100, unit_cost=40.0, party_id=sup.id)
    assert ok, e
    b = db.fetch_one("SELECT quantity_in_stock FROM stock_batches WHERE item_id=?", (iid,))
    assert b["quantity_in_stock"] == 100.0
    assert bal(db, "1200") == 4000.0
    monitor(db, parties=[sup.id])


@test("items: update + deactivate")
def _(db):
    from controllers.item_controller import ItemController
    c = ItemController()
    assert c.create_item("Editable", None, "UNIT", 10, 20, 0, 0, None, "FINISHED_GOOD", None)[0]
    iid = item_id(db, "Editable")
    ok, e = c.update_item(iid, "Editable2", None, "UNIT", 15, 25, 0, 100, None, "FINISHED_GOOD", None, True)
    assert ok, e
    assert c.deactivate_item(iid)[0]
    assert db.fetch_one("SELECT is_active FROM items WHERE id=?", (iid,))["is_active"] == 0


# =====================================================================
# SALES INVOICE payment-type matrix
# =====================================================================
def sales_items(item, qty=2, price=100.0, tax=0.0, discount=0.0):
    return [{"item_id": item.id, "quantity": qty, "unit_price": price,
             "discount_amount": discount, "tax_amount": tax}]


def create_sale(db, cust, item, ptype, number, items=None, bank_id=None):
    from controllers.sales_invoice_controller import SalesInvoiceController
    items = items or sales_items(item)
    ok, e = SalesInvoiceController().create_sales_invoice(
        number, cust.id, today(), ptype, items, None, bank_id)
    assert ok, e
    return db.fetch_one("SELECT id FROM sales_invoices WHERE invoice_number=?", (number,))


def update_sale(db, inv_id, number, cust, item, ptype, bank_id=None):
    from controllers.sales_invoice_controller import SalesInvoiceController
    ok, e = SalesInvoiceController().update_sales_invoice(
        inv_id, number, cust.id, today(), ptype, sales_items(item), None, "CONFIRMED", bank_id)
    assert ok, e


@test("sales: cash sale posts cash/revenue/COGS & stock down")
def _(db):
    cust = make_party("Cash Buyer", "CUSTOMER")
    _, item = fg_setup("CashSale")
    create_sale(db, cust, item, "CASH", "SI-CASH-1")
    assert cash(db) == 200.0
    assert bal(db, "4000") == -200.0
    q = db.fetch_one("SELECT SUM(quantity_in_stock) s FROM stock_batches WHERE is_active=1")["s"]
    assert q == 998.0
    # opening stock journal put 1000*50 into 1220; sale credits 2*50 more
    assert bal(db, "1220") == 50000.0 - 100.0
    assert bal(db, "5000") == 100.0
    monitor(db, parties=[cust.id])


@test("sales: credit sale creates receivable, receive payment clears it")
def _(db):
    from controllers.payment_controller import PaymentController
    cust = make_party("Credit Buyer", "CUSTOMER")
    _, item = fg_setup("CreditSale")
    inv = create_sale(db, cust, item, "CREDIT", "SI-CR-1")
    assert ar(db) == 200.0 and cash(db) == 0.0
    ok, e = PaymentController().receive_payment(
        cust.id, 200.0, today(), "CASH", "SI-CR-1", None, sales_invoice_id=inv["id"])
    assert ok, e
    assert cash(db) == 200.0 and ar(db) == 0.0
    paid = db.fetch_one("SELECT paid_amount FROM sales_invoices WHERE id=?", (inv["id"],))["paid_amount"]
    assert paid == 200.0
    monitor(db, parties=[cust.id])


@test("sales: overpayment blocked")
def _(db):
    from controllers.payment_controller import PaymentController
    cust = make_party("Overpay Buyer", "CUSTOMER")
    _, item = fg_setup("Overpay")
    inv = create_sale(db, cust, item, "CREDIT", "SI-OV-1")
    ok, e = PaymentController().receive_payment(
        cust.id, 99999.0, today(), "CASH", None, None, sales_invoice_id=inv["id"])
    assert not ok and ("exceeds" in e.lower() or "outstanding" in e.lower() or "balance" in e.lower())


@test("sales: bank/cheque sale records deposit")
def _(db):
    expected_bank = 0.0
    for ptype in ("BANK", "CHEQUE"):
        make_bank(acc_no=ptype + "00001")
        cust = make_party(ptype + " Buyer", "CUSTOMER")
        _, item = fg_setup(ptype + "Sale")
        ba = db.fetch_one("SELECT id FROM bank_accounts WHERE account_number=?", (ptype + "00001",))
        create_sale(db, cust, item, ptype, f"SI-{ptype}-1", bank_id=ba["id"])
        expected_bank += 200.0
        assert bank(db) == expected_bank
        tx = bank_txns(db, f"SI-{ptype}-1")
        assert len(tx) == 1 and tx[0]["transaction_type"] == "DEPOSIT"


@test("sales: switch CASH->CREDIT (first edit) moves money correctly")
def _(db):
    cust = make_party("Flip Buyer", "CUSTOMER")
    _, item = fg_setup("Flip")
    inv = create_sale(db, cust, item, "CASH", "SI-FLIP-1")
    assert cash(db) == 200.0
    update_sale(db, inv["id"], "SI-FLIP-1", cust, item, "CREDIT")
    assert cash(db) == 0.0 and ar(db) == 200.0
    monitor(db)


@test("sales: switch CREDIT->CASH (first edit) clears AR")
def _(db):
    cust = make_party("Flip2 Buyer", "CUSTOMER")
    _, item = fg_setup("Flip2")
    inv = create_sale(db, cust, item, "CREDIT", "SI-FLIP2-1")
    update_sale(db, inv["id"], "SI-FLIP2-1", cust, item, "CASH")
    assert cash(db) == 200.0 and ar(db) == 0.0


@test("sales: CASH->CREDIT->CASH round trip leaves no phantom AR")
def _(db):
    cust = make_party("RT Buyer", "CUSTOMER")
    _, item = fg_setup("RT")
    inv = create_sale(db, cust, item, "CASH", "SI-RT-1")
    update_sale(db, inv["id"], "SI-RT-1", cust, item, "CREDIT")
    assert ar(db) == 200.0
    update_sale(db, inv["id"], "SI-RT-1", cust, item, "CASH")
    assert cash(db) == 200.0, "cash must be restored"
    assert ar(db) == 0.0, "no phantom AR expected"


@test("sales: CASH->BANK (first edit) posts deposit and moves funds")
def _(db):
    make_bank(acc_no="9000000001")
    ba = db.fetch_one("SELECT id FROM bank_accounts WHERE account_number='9000000001'")
    cust = make_party("BankFlip Buyer", "CUSTOMER")
    _, item = fg_setup("BankFlip")
    inv = create_sale(db, cust, item, "CASH", "SI-BF-1")
    update_sale(db, inv["id"], "SI-BF-1", cust, item, "BANK", bank_id=ba["id"])
    assert cash(db) == 0.0 and bank(db) == 200.0
    assert len(bank_txns(db)) == 1


@test("sales: BANK->CASH removes stale deposit")
def _(db):
    make_bank(acc_no="9000000002")
    ba = db.fetch_one("SELECT id FROM bank_accounts WHERE account_number='9000000002'")
    cust = make_party("DepBug Buyer", "CUSTOMER")
    _, item = fg_setup("DepBug")
    inv = create_sale(db, cust, item, "BANK", "SI-DB-1", bank_id=ba["id"])
    assert len(bank_txns(db)) == 1
    update_sale(db, inv["id"], "SI-DB-1", cust, item, "CASH")
    assert cash(db) == 200.0 and bank(db) == 0.0
    assert len(bank_txns(db)) == 0


@test("sales: repeated BANK edits do not duplicate deposits")
def _(db):
    make_bank(acc_no="9000000003")
    ba = db.fetch_one("SELECT id FROM bank_accounts WHERE account_number='9000000003'")
    cust = make_party("Dup Buyer", "CUSTOMER")
    _, item = fg_setup("Dup")
    inv = create_sale(db, cust, item, "BANK", "SI-DUP-1", bank_id=ba["id"])
    update_sale(db, inv["id"], "SI-DUP-1", cust, item, "BANK", bank_id=ba["id"])
    update_sale(db, inv["id"], "SI-DUP-1", cust, item, "BANK", bank_id=ba["id"])
    assert len(bank_txns(db)) == 1 and bank(db) == 200.0


@test("sales: taxed invoice posts tax payable and balances")
def _(db):
    cust = make_party("Tax Buyer", "CUSTOMER")
    _, item = fg_setup("TaxSale")
    create_sale(db, cust, item, "CASH", "SI-TAX-1", items=sales_items(item, tax=20.0))
    assert cash(db) == 220.0
    assert bal(db, "2100") == -20.0


@test("sales: delete/cancel invoice reverses books")
def _(db):
    from controllers.sales_invoice_controller import SalesInvoiceController
    cust = make_party("Cancel Buyer", "CUSTOMER")
    _, item = fg_setup("CancelSale")
    inv = create_sale(db, cust, item, "CASH", "SI-CAN-1")
    ok, e = SalesInvoiceController().delete_sales_invoice(inv["id"])
    assert ok, e
    assert db.fetch_one("SELECT status FROM sales_invoices WHERE id=?", (inv["id"],))["status"] == "CANCELLED"
    assert cash(db) == 0.0


@test("sales: validation - no stock / inactive customer / no items")
def _(db):
    from controllers.sales_invoice_controller import SalesInvoiceController
    cust = make_party("NoStock Buyer", "CUSTOMER")
    item = make_item("NoStock Item", "FINISHED_GOOD", "UNIT", 50.0, 100.0)  # no stock
    ok, e = SalesInvoiceController().create_sales_invoice(
        "SI-NS-1", cust.id, today(), "CASH", sales_items(item), None)
    assert not ok and "stock" in e.lower()
    ok, e = SalesInvoiceController().create_sales_invoice("SI-NS-2", 99999, today(), "CASH",
                                                          sales_items(item), None)
    assert not ok and e is not None


# =====================================================================
# PURCHASE INVOICE payment-type matrix
# =====================================================================
def purchase_items(item, qty=10, price=30.0, tax=0.0):
    return [{"item_id": item.id, "quantity": qty, "unit_cost": price,
             "discount_amount": 0.0, "tax_amount": tax}]


def create_purchase(db, sup, item, ptype, number, bank_id=None):
    from controllers.purchase_invoice_controller import PurchaseInvoiceController
    ok, e = PurchaseInvoiceController().create_purchase_invoice(
        number, sup.id, today(), ptype, purchase_items(item), None, bank_id)
    assert ok, e
    return db.fetch_one("SELECT id FROM purchase_invoices WHERE invoice_number=?", (number,))


def update_purchase(db, inv_id, number, sup, item, ptype, bank_id=None):
    from controllers.purchase_invoice_controller import PurchaseInvoiceController
    ok, e = PurchaseInvoiceController().update_purchase_invoice(
        inv_id, number, sup.id, today(), ptype, purchase_items(item), None, "CONFIRMED", bank_id)
    assert ok, e


@test("purchases: cash purchase raises inventory, lowers cash")
def _(db):
    sup, item = raw_setup("CashPur")
    cust = make_party("A Buyer", "CUSTOMER")
    create_purchase(db, sup, item, "CASH", "PI-CASH-1")
    assert cash(db) == -300.0
    assert bal(db, "1200") == 300.0
    q = db.fetch_one("SELECT SUM(quantity_in_stock) s FROM stock_batches WHERE is_active=1")["s"]
    assert q == 10.0
    monitor(db, parties=[sup.id])


@test("purchases: credit purchase raises AP; pay supplier clears it")
def _(db):
    from controllers.payment_controller import PaymentController
    sup, item = raw_setup("CreditPur")
    inv = create_purchase(db, sup, item, "CREDIT", "PI-CR-1")
    assert ap(db) == 300.0
    ok, e = PaymentController().pay_supplier(
        sup.id, 300.0, today(), "CASH", "PI-CR-1", None, purchase_invoice_id=inv["id"])
    assert ok, e
    assert ap(db) == 0.0 and cash(db) == -300.0
    paid = db.fetch_one("SELECT paid_amount FROM purchase_invoices WHERE id=?", (inv["id"],))["paid_amount"]
    assert paid == 300.0


@test("purchases: bank purchase records withdrawal")
def _(db):
    make_bank(acc_no="8000000001")
    ba = db.fetch_one("SELECT id FROM bank_accounts WHERE account_number='8000000001'")
    sup, item = raw_setup("BankPur")
    create_purchase(db, sup, item, "BANK", "PI-BK-1", bank_id=ba["id"])
    assert bank(db) == -300.0
    tx = bank_txns(db, "PI-BK-1")
    assert len(tx) == 1 and tx[0]["transaction_type"] == "WITHDRAWAL"


@test("purchases: switch CASH->CREDIT (first edit)")
def _(db):
    sup, item = raw_setup("PurFlip")
    inv = create_purchase(db, sup, item, "CASH", "PI-FLIP-1")
    assert cash(db) == -300.0
    update_purchase(db, inv["id"], "PI-FLIP-1", sup, item, "CREDIT")
    assert cash(db) == 0.0 and ap(db) == 300.0


@test("purchases: CASH->CREDIT->CASH leaves no phantom AP")
def _(db):
    sup, item = raw_setup("PurRT")
    inv = create_purchase(db, sup, item, "CASH", "PI-RT-1")
    update_purchase(db, inv["id"], "PI-RT-1", sup, item, "CREDIT")
    assert ap(db) == 300.0
    update_purchase(db, inv["id"], "PI-RT-1", sup, item, "CASH")
    assert cash(db) == -300.0 and ap(db) == 0.0


@test("purchases: BANK->CASH removes stale withdrawal")
def _(db):
    make_bank(acc_no="8000000002")
    ba = db.fetch_one("SELECT id FROM bank_accounts WHERE account_number='8000000002'")
    sup, item = raw_setup("PurDepBug")
    inv = create_purchase(db, sup, item, "BANK", "PI-DB-1", bank_id=ba["id"])
    assert len(bank_txns(db)) == 1
    update_purchase(db, inv["id"], "PI-DB-1", sup, item, "CASH")
    assert cash(db) == -300.0 and bank(db) == 0.0
    assert len(bank_txns(db)) == 0


@test("purchases: repeated BANK edits do not duplicate withdrawals")
def _(db):
    make_bank(acc_no="8000000003")
    ba = db.fetch_one("SELECT id FROM bank_accounts WHERE account_number='8000000003'")
    sup, item = raw_setup("PurDup")
    inv = create_purchase(db, sup, item, "BANK", "PI-DUP-1", bank_id=ba["id"])
    update_purchase(db, inv["id"], "PI-DUP-1", sup, item, "BANK", bank_id=ba["id"])
    update_purchase(db, inv["id"], "PI-DUP-1", sup, item, "BANK", bank_id=ba["id"])
    assert len(bank_txns(db)) == 1 and bank(db) == -300.0


@test("purchases: taxed purchase posts correctly")
def _(db):
    sup, item = raw_setup("TaxPur")
    from controllers.purchase_invoice_controller import PurchaseInvoiceController
    ok, e = PurchaseInvoiceController().create_purchase_invoice(
        "PI-TAX-1", sup.id, today(), "CASH", purchase_items(item, tax=15.0), None)
    assert ok, e
    assert bal(db, "2100") == -15.0


@test("purchases: delete/cancel invoice reverses books")
def _(db):
    from controllers.purchase_invoice_controller import PurchaseInvoiceController
    sup, item = raw_setup("PurCancel")
    inv = create_purchase(db, sup, item, "CASH", "PI-CAN-1")
    ok, e = PurchaseInvoiceController().delete_purchase_invoice(inv["id"])
    assert ok, e
    assert db.fetch_one("SELECT status FROM purchase_invoices WHERE id=?", (inv["id"],))["status"] == "CANCELLED"
    assert cash(db) == 0.0


# =====================================================================
# BANKING (deposit / withdraw / cheques)
# =====================================================================
@test("banking: create account, deposit, withdraw")
def _(db):
    from controllers.banking_controller import BankingController
    b = BankingController()
    ok, e = b.create_bank_account("HBL", "Current", "7000000001", 0)
    assert ok, e
    accs, err = b.list_bank_accounts()
    assert err is None and any(a.account_number == "7000000001" for a in accs)
    acc = db.fetch_one("SELECT id FROM bank_accounts WHERE account_number='7000000001'")
    ok, e = b.deposit(acc["id"], 500.0, today(), "D1", None)
    assert ok, e
    bl, err = b.get_balance(acc["id"])
    assert err is None and bl == 500.0
    assert cash(db) == -500.0 and bank(db) == 500.0
    ok, e = b.withdraw(acc["id"], 200.0, today(), "W1", None)
    assert ok, e
    assert bank(db) == 300.0 and cash(db) == -300.0
    monitor(db)


@test("banking: cannot withdraw more than balance")
def _(db):
    from controllers.banking_controller import BankingController
    from helpers import seed as _seed
    b = BankingController()
    acc = _seed.make_bank_account("HBL", "Current", "7000000002", 0)
    ok, e = b.withdraw(acc.id, 500.0, today(), None, None)
    assert not ok and ("balance" in e.lower() or "available" in e.lower())


@test("banking: issue & clear & bounce cheques")
def _(db):
    from controllers.banking_controller import BankingController
    from helpers import seed as _seed
    b = BankingController()
    bankacc = _seed.make_bank_account("HBL", "Main", "7000000003", 10000.0)
    sup = _seed.supplier("Cheque Party")
    ok, e = b.issue_cheque(bankacc.id, sup.id, "CHQ-1001", 4000.0, today())
    assert ok, e
    rows = b.list_cheques(status="UNCLEARED")[0]
    cheque = [c for c in rows if c["cheque_number"] == "CHQ-1001"][0]
    ok, e = b.clear_cheque(cheque["id"])
    assert ok, e
    status = db.fetch_one("SELECT status FROM cheques WHERE id=?", (cheque["id"],))["status"]
    assert status == "CLEARED"
    assert bank(db) == 6000.0     # opening 10000 - 4000 cleared
    assert bal(db, "2000") == 4000.0  # Dr Accounts Payable on clearing issued cheque
    ok, e = b.issue_cheque(bankacc.id, sup.id, "CHQ-2002", 500.0, today())
    assert ok
    rows = b.list_cheques(status="UNCLEARED")[0]
    cheque2 = [c for c in rows if c["cheque_number"] == "CHQ-2002"][0]
    ok, e = b.bounce_cheque(cheque2["id"])
    assert ok, e
    assert db.fetch_one("SELECT status FROM cheques WHERE id=?", (cheque2["id"],))["status"] == "BOUNCED"
    monitor(db)


# =====================================================================
# EXPENSES
# =====================================================================
@test("expenses: category + cash expense posts and monthly summary")
def _(db):
    from controllers.expense_controller import ExpenseController
    c = ExpenseController()
    ok, e = c.create_category("Salaries")
    assert ok, e
    cat = db.fetch_one("SELECT id FROM expense_categories WHERE name='Salaries'")
    ok, e = c.create_expense("EV-100", cat["id"], today(), 5000.0, "CASH", description="payroll")
    assert ok, e
    assert cash(db) == -5000.0
    assert bal(db, "6000") == 5000.0
    summary, err = c.get_monthly_summary(datetime.date.today().year, datetime.date.today().month)
    assert err is None and summary and summary.get("total") == 5000.0
    monitor(db)


@test("expenses: bank expense lowers bank")
def _(db):
    from controllers.expense_controller import ExpenseController
    c = ExpenseController()
    c.create_category("Electricity")
    cat = db.fetch_one("SELECT id FROM expense_categories WHERE name='Electricity'")
    ok, e = c.create_expense("EV-200", cat["id"], today(), 800.0, "BANK", description="bill")
    assert ok, e
    assert bank(db) == -800.0 and bal(db, "6000") == 800.0


@test("expenses: delete expense should reverse journal")
def _(db):
    from controllers.expense_controller import ExpenseController
    c = ExpenseController()
    c.create_category("Rent")
    cat = db.fetch_one("SELECT id FROM expense_categories WHERE name='Rent'")
    ok, e = c.create_expense("EV-300", cat["id"], today(), 2000.0, "CASH", description="rent")
    assert ok
    exp = db.fetch_one("SELECT id FROM expenses WHERE voucher_number='EV-300'")
    ok, e = c.delete_expense(exp["id"])
    assert ok, e
    assert cash(db) == 0.0, "cash must be restored by reversal"
    assert db.fetch_one("SELECT COUNT(*) n FROM expenses WHERE voucher_number='EV-300'")["n"] == 0


# =====================================================================
# MANUFACTURING (BOM + production order)
# =====================================================================
@test("manufacturing: BOM + production complete consumes & produces stock")
def _(db):
    from controllers.manufacturing_controller import ManufacturingController
    mc = ManufacturingController()
    fg = make_item("Tablet 500mg", "FINISHED_GOOD", "TABLET", 0, 100)
    raw = make_item("API Powder", "RAW_MATERIAL", "KG", 10.0, 0)
    pack = make_item("Blister Foil", "PACKING_MATERIAL", "UNIT", 2.0, 0)
    add_stock(raw.id, 1000, 10.0)
    add_stock(pack.id, 1000, 2.0)
    ok, e = mc.create_bom(fg.id, 1.0, [
        {"component_item_id": raw.id, "quantity_required": 0.05, "wastage_percent": 10},
        {"component_item_id": pack.id, "quantity_required": 1.0, "wastage_percent": 0},
    ])
    assert ok, e
    bom = db.fetch_one("SELECT id FROM bill_of_materials WHERE finished_item_id=?", (fg.id,))
    ok, e = mc.create_production_order("PO-9001", bom["id"], 100.0, today(), today())
    assert ok, e
    po = db.fetch_one("SELECT id, status FROM production_orders WHERE order_number='PO-9001'")
    assert po["status"] == "DRAFT"
    ok, e = mc.start_production(po["id"])
    assert ok, e
    ok, e = mc.complete_production(po["id"], actual_quantity=100.0, wastage_quantity=0.0,
                                   output_batch_number="BATCH-PO-9001")
    assert ok, e
    po = db.fetch_one("SELECT status FROM production_orders WHERE order_number='PO-9001'")
    assert po["status"] == "COMPLETED"
    raw_qty = db.fetch_one("SELECT SUM(quantity_in_stock) s FROM stock_batches WHERE item_id=?",
                           (raw.id,))["s"]
    assert raw_qty == 1000.0 - 5.5  # 100*0.05 =5 + 10% wastage .5
    fg_qty = db.fetch_one("SELECT SUM(quantity_in_stock) s FROM stock_batches WHERE item_id=?",
                          (fg.id,))["s"]
    assert fg_qty == 100.0
    monitor(db)


# =====================================================================
# EXPENSE ITEMS (Pay Items feature), ASSETS, extra edge cases
# =====================================================================
@test("expense items: recurring pay items create vouchers & post")
def _(db):
    from controllers.expense_controller import ExpenseController
    from controllers.expense_item_controller import ExpenseItemController
    ec = ExpenseController()
    assert ec.create_category("Salaries")[0]
    cat = db.fetch_one("SELECT id FROM expense_categories WHERE name='Salaries'")
    ic = ExpenseItemController()
    it1, e = ic.create_item(cat["id"], "Emp A", 1000.0)
    assert it1 is not None and not e, e
    it2, e = ic.create_item(cat["id"], "Emp B", 1500.0)
    assert it2 is not None and not e
    vouchers, err = ic.pay_items(1, cat["id"],
                                 [{"item_id": it1.id, "amount": 1000.0, "description": None},
                                  {"item_id": it2.id, "amount": 1500.0, "description": None}],
                                 "CASH", today())
    assert err is None and vouchers and len(vouchers) == 2
    assert cash(db) == -2500.0
    assert db.fetch_one("SELECT COUNT(*) n FROM expenses WHERE expense_date=? AND category_id=?",
                        (today(), cat["id"]))["n"] == 2
    monitor(db)


@test("assets: add fixed asset posts Dr asset / Cr cash")
def _(db):
    from models.enums import VoucherType
    from services.account_service import AccountService
    from services.accounting_service import AccountingService, JournalLine

    acc = AccountService(db)
    asset = acc.create_account("1503", "Plant & Machinery", "ASSET", None, 0.0)
    cash_id = db.fetch_one("SELECT id FROM accounts WHERE account_code='1000'")["id"]
    acct = AccountingService(db)
    with db.transaction():
        acct.post_journal_entry(voucher_type=VoucherType.JOURNAL, entry_date=today(),
                                lines=[JournalLine(account_id=asset.id, debit=250000.0, credit=0,
                                                   description="Asset purchase: Mixer"),
                                       JournalLine(account_id=cash_id, debit=0, credit=250000.0,
                                                   description="Payment: cash")],
                                narration="Asset purchase: Mixer")
        db.execute("INSERT INTO asset_details (account_id, asset_type, purchase_amount, purchase_date) "
                   "VALUES (?, 'NON_CURRENT', 250000.0, ?)", (asset.id, today()))
    assert bal(db, "1503") == 250000.0
    assert cash(db) == -250000.0
    assert db.fetch_one("SELECT COUNT(*) n FROM asset_details")["n"] == 1
    monitor(db)


@test("sales: discount reduces receivable/cash by net amount")
def _(db):
    cust = make_party("Disc Buyer", "CUSTOMER")
    _, item = fg_setup("Disc")
    items = [{"item_id": item.id, "quantity": 2, "unit_price": 100.0,
              "discount_amount": 25.0, "tax_amount": 0.0}]
    from controllers.sales_invoice_controller import SalesInvoiceController
    ok, e = SalesInvoiceController().create_sales_invoice(
        "SI-DISC-1", cust.id, today(), "CASH", items, None)
    assert ok, e
    assert cash(db) == 175.0 and ar(db) == 0.0
    assert bal(db, "4000") == -175.0  # revenue net of discount
    monitor(db)


@test("party: deactivating party with open invoices must be blocked")
def _(db):
    from controllers.party_controller import PartyController
    from models.enums import PartyType
    pc = PartyController()
    assert pc.create_party("Owed Customer", PartyType.CUSTOMER, 0.0)[0]
    pid = party_id(db, "Owed Customer")

    # seed an item with stock so a real credit invoice can be raised for that customer
    item = make_item("Owed Goods", "FINISHED_GOOD", "UNIT", 50.0, 100.0)
    add_stock(item.id, 100, 50.0, make_party("Owed Sup", "SUPPLIER").id)

    from controllers.sales_invoice_controller import SalesInvoiceController
    ok, e = SalesInvoiceController().create_sales_invoice(
        "SI-OWE-1", pid, today(), "CREDIT",
        [{"item_id": item.id, "quantity": 1, "unit_price": 100.0,
          "discount_amount": 0.0, "tax_amount": 0.0}], None)
    assert ok, e
    ok, e = pc.deactivate_party(pid)
    assert not ok, "should not deactivate a party with open transactions"


# =====================================================================
# BATCH 2 - DEEP EDGE CASES (accounting core, invoices, mfg, banking...)
# =====================================================================
def dash_kpis(db):
    from controllers.dashboard_controller import DashboardController
    data, err = DashboardController().get_dashboard_data()
    assert err is None
    return data


@test("accounting: single-line journal rejected")
def _(db):
    from models.enums import VoucherType
    from services.accounting_service import AccountingService, JournalLine
    cash_id = db.fetch_one("SELECT id FROM accounts WHERE account_code='1000'")["id"]
    try:
        AccountingService(db).post_journal_entry(voucher_type=VoucherType.JOURNAL,
                                                 entry_date=today(),
                                                 lines=[JournalLine(account_id=cash_id, debit=100.0, credit=0.0)])
    except Exception as e:
        assert "at least" in str(e).lower() or "line" in str(e).lower()
    else:
        raise AssertionError("single-line entry should have been rejected")


@test("accounting: unbalanced journal rejected")
def _(db):
    from models.enums import VoucherType
    from services.accounting_service import AccountingService, JournalLine
    c1 = db.fetch_one("SELECT id FROM accounts WHERE account_code='1000'")["id"]
    c4 = db.fetch_one("SELECT id FROM accounts WHERE account_code='4000'")["id"]
    try:
        AccountingService(db).post_journal_entry(
            voucher_type=VoucherType.JOURNAL, entry_date=today(),
            lines=[JournalLine(account_id=c1, debit=100.0, credit=0.0),
                   JournalLine(account_id=c4, debit=0.0, credit=50.0)])
    except Exception as e:
        assert "balance" in str(e).lower()
    else:
        raise AssertionError("unbalanced entry should have been rejected")


@test("accounting: balanced journal posts + voucher numbering monotonic")
def _(db):
    from models.enums import VoucherType
    from services.accounting_service import AccountingService, JournalLine
    ids = {c: db.fetch_one("SELECT id FROM accounts WHERE account_code=?", (c,))["id"]
           for c in ("1000", "4000")}
    svc = AccountingService(db)
    for i in range(3):
        svc.post_journal_entry(voucher_type=VoucherType.JOURNAL, entry_date=today(),
                               lines=[JournalLine(account_id=ids["1000"], debit=10.0, credit=0.0),
                                      JournalLine(account_id=ids["4000"], debit=0.0, credit=10.0)],
                               narration=f"test {i}")
    nums = [r["voucher_number"] for r in
            db.fetch_all("SELECT voucher_number FROM journal_entries WHERE voucher_type='JOURNAL' ORDER BY id")]
    assert len(nums) == 3 and len(set(nums)) == 3
    assert books_where_monotonic(nums)
    entries_balanced(db)


def books_where_monotonic(vouchers):
    # JV-00001 < JV-00002 < ...
    parsed = []
    for v in vouchers:
        try:
            parsed.append(int(v.split("-")[-1]))
        except (ValueError, IndexError):
            return False
    return parsed == sorted(parsed) and len(set(parsed)) == len(parsed)


@test("sales: exact stock depletion then refusal")
def _(db):
    from controllers.sales_invoice_controller import SalesInvoiceController as C
    cust = make_party("Drain Buyer", "CUSTOMER")
    sup, item = fg_setup("DrainSale")
    # only 2 units available in a separate tiny batch
    add_stock(item.id, 2, 50.0, supplier_id=sup.id)  # extra batch on same item => total 1002
    # drain all available of that dedicated batch is awkward - use a fresh item
    item2 = make_item("Drain2 Item", "FINISHED_GOOD", "UNIT", 50.0, 100.0)
    add_stock(item2.id, 2, 50.0, supplier_id=sup.id)
    def items(q): return [{"item_id": item2.id, "quantity": q, "unit_price": 100.0,
                           "discount_amount": 0.0, "tax_amount": 0.0}]
    ok, e = C().create_sales_invoice("SI-DR1", cust.id, today(), "CASH", items(2), None)
    assert ok, e
    q = db.fetch_one("SELECT SUM(quantity_in_stock) s FROM stock_batches WHERE item_id=?", (item2.id,))["s"]
    assert q == 0.0
    ok, e = C().create_sales_invoice("SI-DR2", cust.id, today(), "CASH", items(1), None)
    assert not ok, f"expected rejection, ok={ok}, err={e}"


@test("sales: zero/negative quantity and negative price rejected")
def _(db):
    from controllers.sales_invoice_controller import SalesInvoiceController as C
    cust = make_party("Neg Buyer", "CUSTOMER")
    sup, item = fg_setup("NegSale")
    for label, qty, price in (("q0", 0, 100.0), ("qneg", -1, 100.0), ("pneg", 1, -5.0)):
        ok, e = C().create_sales_invoice(f"SI-{label}", cust.id, today(), "CASH",
                                         [{"item_id": item.id, "quantity": qty,
                                           "unit_price": price, "discount_amount": 0.0,
                                           "tax_amount": 0.0}], None)
        assert not ok, f"{label} should be rejected"


@test("sales: discount larger than subtotal rejected (negative line)")
def _(db):
    from controllers.sales_invoice_controller import SalesInvoiceController as C
    cust = make_party("BigDisc Buyer", "CUSTOMER")
    sup, item = fg_setup("BigDisc")
    ok, e = C().create_sales_invoice("SI-BD", cust.id, today(), "CASH",
                                     [{"item_id": item.id, "quantity": 1, "unit_price": 100.0,
                                       "discount_amount": 150.0, "tax_amount": 0.0}], None)
    assert not ok


@test("sales: mixed-type multi-line invoice posts per-type COGS")
def _(db):
    from controllers.sales_invoice_controller import SalesInvoiceController as C
    cust = make_party("Mix Buyer", "CUSTOMER")
    sup = make_party("Mix Sup", "SUPPLIER")
    fg = make_item("Mix FG", "FINISHED_GOOD", "UNIT", 50.0, 100.0)
    pk = make_item("Mix Pack", "PACKING_MATERIAL", "UNIT", 10.0, 20.0)
    rm = make_item("Mix Raw", "RAW_MATERIAL", "KG", 5.0, 15.0)
    add_stock(fg.id, 100, 50.0, supplier_id=sup.id)
    add_stock(pk.id, 100, 10.0, supplier_id=sup.id)
    add_stock(rm.id, 100, 5.0, supplier_id=sup.id)
    ok, e = C().create_sales_invoice(
        "SI-MIX", cust.id, today(), "CASH",
        [{"item_id": fg.id, "quantity": 2, "unit_price": 100.0, "discount_amount": 0.0, "tax_amount": 0.0},
         {"item_id": pk.id, "quantity": 3, "unit_price": 20.0, "discount_amount": 0.0, "tax_amount": 0.0},
         {"item_id": rm.id, "quantity": 4, "unit_price": 15.0, "discount_amount": 0.0, "tax_amount": 0.0}], None)
    assert ok, e
    assert cash(db) == 200.0 + 60.0 + 60.0
    assert bal(db, "5000") == 100.0 + 20.0   # FG(2*50) + raw(4*5)
    assert bal(db, "5001") == 30.0           # packing 3*10
    assert bal(db, "1200") == 500.0 - 20.0   # raw opening 100*5
    assert bal(db, "1210") == 1000.0 - 30.0  # packing opening 100*10
    assert bal(db, "1220") == 5000.0 - 100.0 # FG opening 100*50
    monitor(db, parties=[cust.id])


@test("sales: duplicate invoice number rejected")
def _(db):
    from controllers.sales_invoice_controller import SalesInvoiceController as C
    cust = make_party("DupInv Buyer", "CUSTOMER")
    sup, item = fg_setup("DupInv")
    ok, e = C().create_sales_invoice("SI-DUPINV", cust.id, today(), "CASH",
                                     [{"item_id": item.id, "quantity": 1, "unit_price": 100.0,
                                       "discount_amount": 0.0, "tax_amount": 0.0}], None)
    assert ok, e
    ok, e = C().create_sales_invoice("SI-DUPINV", cust.id, today(), "CASH",
                                     [{"item_id": item.id, "quantity": 1, "unit_price": 100.0,
                                       "discount_amount": 0.0, "tax_amount": 0.0}], None)
    assert not ok


@test("sales: first-edit changing quantity keeps stock + ledger correct")
def _(db):
    cust = make_party("QtyEdit Buyer", "CUSTOMER")
    sup, item = fg_setup("QtyEdit")
    from controllers.sales_invoice_controller import SalesInvoiceController as C
    inv = create_sale(db, cust, item, "CASH", "SI-QE")  # qty2@100
    qty_now = lambda: db.fetch_one(
        "SELECT SUM(quantity_in_stock) s FROM stock_batches WHERE item_id=?", (item.id,))["s"]
    assert qty_now() == 998.0
    # update to qty 5 (same price) - first edit reverses & reposts
    from controllers.sales_invoice_controller import SalesInvoiceController as C2
    ok, e = C2().update_sales_invoice(inv["id"], "SI-QE", cust.id, today(), "CASH",
                                      [{"item_id": item.id, "quantity": 5, "unit_price": 100.0,
                                        "discount_amount": 0.0, "tax_amount": 0.0}], None, "CONFIRMED", None)
    assert ok, e
    assert qty_now() == 995.0
    assert cash(db) == 500.0
    assert bal(db, "5000") == 250.0
    entries_balanced(db)


@test("sales: first-edit switching customer moves receivable")
def _(db):
    from controllers.sales_invoice_controller import SalesInvoiceController as C
    cust_a = make_party("SwitchOut Customer", "CUSTOMER")
    cust_b = make_party("SwitchIn Customer", "CUSTOMER")
    sup, item = fg_setup("SwitchCust")
    ok, e = C().create_sales_invoice("SI-SW", cust_a.id, today(), "CREDIT",
                                     [{"item_id": item.id, "quantity": 1, "unit_price": 100.0,
                                       "discount_amount": 0.0, "tax_amount": 0.0}], None)
    assert ok, e
    inv = db.fetch_one("SELECT id FROM sales_invoices WHERE invoice_number='SI-SW'")
    ok, e = C().update_sales_invoice(inv["id"], "SI-SW", cust_b.id, today(), "CREDIT",
                                     [{"item_id": item.id, "quantity": 1, "unit_price": 100.0,
                                       "discount_amount": 0.0, "tax_amount": 0.0}], None, "CONFIRMED", None)
    assert ok, e
    # AR total unchanged but the party on the AR line is now customer B
    assert ar(db) == 100.0
    parties_on_ar = db.fetch_all(
        "SELECT DISTINCT p.name FROM journal_entry_lines jel "
        "JOIN journal_entries je ON je.id=jel.journal_entry_id "
        "JOIN accounts a ON a.id=jel.account_id "
        "JOIN parties p ON p.id=jel.party_id "
        "WHERE a.account_code='1100' AND jel.party_id IS NOT NULL")
    names = {r["name"] for r in parties_on_ar}
    # after edit both old and new party lines exist; assert both appear
    assert names == {"SwitchOut Customer", "SwitchIn Customer"}, names
    entries_balanced(db)


@test("sales: update with insufficient stock fails cleanly & leaves books intact")
def _(db):
    from controllers.sales_invoice_controller import SalesInvoiceController as C
    cust = make_party("OverEdit Buyer", "CUSTOMER")
    sup, item = fg_setup("OverEdit")  # 1000 stock
    ok, e = C().create_sales_invoice("SI-OE", cust.id, today(), "CASH",
                                     [{"item_id": item.id, "quantity": 2, "unit_price": 100.0,
                                       "discount_amount": 0.0, "tax_amount": 0.0}], None)
    assert ok, e
    inv = db.fetch_one("SELECT id FROM sales_invoices WHERE invoice_number='SI-OE'")
    before = (cash(db), bal(db, "5000"))
    ok, e = C().update_sales_invoice(inv["id"], "SI-OE", cust.id, today(), "CASH",
                                     [{"item_id": item.id, "quantity": 5000, "unit_price": 100.0,
                                       "discount_amount": 0.0, "tax_amount": 0.0}], None, "CONFIRMED", None)
    assert not ok and "stock" in e.lower()
    assert (cash(db), bal(db, "5000")) == before, "failed update must not change the books"
    q = db.fetch_one("SELECT SUM(quantity_in_stock) s FROM stock_batches WHERE item_id=?",
                     (item.id,))["s"]
    assert q == 998.0


@test("sales: cash invoice cannot receive payment (fully paid guard)")
def _(db):
    from controllers.payment_controller import PaymentController
    cust = make_party("CashNoPay Buyer", "CUSTOMER")
    sup, item = fg_setup("CashNoPay")
    inv = create_sale(db, cust, item, "CASH", "SI-CNP")
    ok, e = PaymentController().receive_payment(cust.id, 200.0, today(), "CASH", None, None,
                                                sales_invoice_id=inv["id"])
    assert not ok  # nothing outstanding / not a credit invoice


@test("sales: edit of a direct RAW-material sale must keep COGS on 1200")
def _(db):
    from controllers.sales_invoice_controller import SalesInvoiceController as C
    cust = make_party("RawEdit Buyer", "CUSTOMER")
    sup = make_party("RawEdit Sup", "SUPPLIER")
    raw = make_item("RawEdit Item", "RAW_MATERIAL", "KG", 50.0, 100.0)
    add_stock(raw.id, 1000, 50.0, supplier_id=sup.id)
    inv = create_sale(db, cust, raw, "CASH", "SI-RAWED")  # direct raw sale 2 @100
    assert bal(db, "1200") == 50000.0 - 100.0
    assert bal(db, "1220") == 0.0
    # payment-type-only edit (first edit)
    update_sale(db, inv["id"], "SI-RAWED", cust, raw, "CREDIT")
    assert bal(db, "1200") == 50000.0 - 100.0, "COGS must stay against raw inventory 1200"
    assert bal(db, "1220") == 0.0, "Finished Goods 1220 must not be touched"
    entries_balanced(db)


@test("purchases: negative qty/price, empty items, duplicate number rejected")
def _(db):
    from controllers.purchase_invoice_controller import PurchaseInvoiceController as C
    sup, item = raw_setup("PurEdge")
    def items(q=10, price=30.0):
        return [{"item_id": item.id, "quantity": q, "unit_cost": price,
                 "discount_amount": 0.0, "tax_amount": 0.0}]
    ok, e = C().create_purchase_invoice("PI-E1", sup.id, today(), "CASH", items(q=0), None)
    assert not ok
    ok, e = C().create_purchase_invoice("PI-E2", sup.id, today(), "CASH", items(q=-2), None)
    assert not ok
    ok, e = C().create_purchase_invoice("PI-E3", sup.id, today(), "CASH", items(price=-1), None)
    assert not ok
    ok, e = C().create_purchase_invoice("PI-E4", sup.id, today(), "CASH", [], None)
    assert not ok
    assert C().create_purchase_invoice("PI-DUP", sup.id, today(), "CASH", items(), None)[0]
    ok, e = C().create_purchase_invoice("PI-DUP", sup.id, today(), "CASH", items(), None)
    assert not ok


@test("purchases: mixed raw + FG purchase splits inventory accounts")
def _(db):
    from controllers.purchase_invoice_controller import PurchaseInvoiceController as C
    sup = make_party("MixPur Sup", "SUPPLIER")
    rm = make_item("MixPur Raw", "RAW_MATERIAL", "KG", 30.0, 0.0)
    fg = make_item("MixPur FG", "FINISHED_GOOD", "UNIT", 50.0, 0.0)
    ok, e = C().create_purchase_invoice(
        "PI-MIX", sup.id, today(), "CREDIT",
        [{"item_id": rm.id, "quantity": 10, "unit_cost": 30.0, "discount_amount": 0.0, "tax_amount": 0.0},
         {"item_id": fg.id, "quantity": 4, "unit_cost": 50.0, "discount_amount": 0.0, "tax_amount": 0.0}], None)
    assert ok, e
    assert bal(db, "1200") == 300.0
    assert bal(db, "1220") == 200.0
    assert ap(db) == 500.0
    monitor(db, parties=[sup.id])


@test("purchases: first-edit changing quantity adjusts stock & payable")
def _(db):
    from controllers.purchase_invoice_controller import PurchaseInvoiceController as C
    sup, item = raw_setup("PurQtyEdit")
    inv = create_purchase(db, sup, item, "CREDIT", "PI-QE")  # 10 @30 = 300
    assert ap(db) == 300.0
    ok, e = C().update_purchase_invoice(inv["id"], "PI-QE", sup.id, today(), "CREDIT",
                                        [{"item_id": item.id, "quantity": 25, "unit_cost": 30.0,
                                          "discount_amount": 0.0, "tax_amount": 0.0}], None, "CONFIRMED", None)
    assert ok, e
    q = db.fetch_one("SELECT SUM(quantity_in_stock) s FROM stock_batches WHERE item_id=?",
                     (item.id,))["s"]
    assert q == 25.0
    assert ap(db) == 750.0
    entries_balanced(db)


@test("purchases: first-edit switching supplier moves payable")
def _(db):
    from controllers.purchase_invoice_controller import PurchaseInvoiceController as C
    sup_a = make_party("SupA", "SUPPLIER")
    sup_b = make_party("SupB", "SUPPLIER")
    item = make_item("PurSwitch Raw", "RAW_MATERIAL", "KG", 30.0, 0.0)
    ok, e = C().create_purchase_invoice("PI-SW", sup_a.id, today(), "CREDIT",
                                        [{"item_id": item.id, "quantity": 10, "unit_cost": 30.0,
                                          "discount_amount": 0.0, "tax_amount": 0.0}], None)
    assert ok, e
    inv = db.fetch_one("SELECT id FROM purchase_invoices WHERE invoice_number='PI-SW'")
    ok, e = C().update_purchase_invoice(inv["id"], "PI-SW", sup_b.id, today(), "CREDIT",
                                        [{"item_id": item.id, "quantity": 10, "unit_cost": 30.0,
                                          "discount_amount": 0.0, "tax_amount": 0.0}], None, "CONFIRMED", None)
    assert ok, e
    assert ap(db) == 300.0
    parties_on_ap = db.fetch_all(
        "SELECT DISTINCT p.name name FROM journal_entry_lines jel "
        "JOIN journal_entries je ON je.id=jel.journal_entry_id "
        "JOIN accounts a ON a.id=jel.account_id JOIN parties p ON p.id=jel.party_id "
        "WHERE a.account_code='2000' AND jel.party_id IS NOT NULL")
    # after switching supplier the new supplier should appear on the AP lines
    assert "SupB" in {r["name"] for r in parties_on_ap}, names


@test("purchases: update with duplicate/missing item does not corrupt books")
def _(db):
    from controllers.purchase_invoice_controller import PurchaseInvoiceController as C
    sup, item = raw_setup("PurBadUpd")
    inv = create_purchase(db, sup, item, "CASH", "PI-BAD")
    before = (cash(db), inv["id"])
    ok, e = C().update_purchase_invoice(inv["id"], "PI-BAD", sup.id, today(), "CASH",
                                        [{"item_id": 999999, "quantity": 5, "unit_cost": 30.0,
                                          "discount_amount": 0.0, "tax_amount": 0.0}], None, "CONFIRMED", None)
    assert not ok
    assert cash(db) == before[0]


@test("purchases: discount purchase totals net")
def _(db):
    from controllers.purchase_invoice_controller import PurchaseInvoiceController as C
    sup, item = raw_setup("PurDisc")
    ok, e = C().create_purchase_invoice("PI-DSC", sup.id, today(), "CREDIT",
                                        [{"item_id": item.id, "quantity": 10, "unit_cost": 30.0,
                                          "discount_amount": 50.0, "tax_amount": 0.0}], None)
    assert ok, e
    assert ap(db) == 250.0
    inv = db.fetch_one("SELECT total_amount t FROM purchase_invoices WHERE invoice_number='PI-DSC'")
    assert inv["t"] == 250.0


@test("manufacturing: BOM validation edges")
def _(db):
    from controllers.manufacturing_controller import ManufacturingController as mc_import
    mc = mc_import()
    fg = make_item("Mfg FG Edge", "FINISHED_GOOD", "UNIT")
    rm = make_item("Mfg RM Edge", "RAW_MATERIAL", "KG")
    other_fg = make_item("Mfg FG Other", "FINISHED_GOOD", "UNIT")
    ok, e = mc.create_bom(fg.id, 1.0, [])  # no components
    assert not ok
    ok, e = mc.create_bom(fg.id, 0.0, [{"component_item_id": rm.id, "quantity_required": 1.0,
                                        "wastage_percent": 0}])
    assert not ok
    ok, e = mc.create_bom(fg.id, 1.0, [{"component_item_id": other_fg.id, "quantity_required": 1.0,
                                        "wastage_percent": 0}])
    assert not ok  # component must be raw/packing
    ok, e = mc.create_bom(fg.id, 1.0, [{"component_item_id": rm.id, "quantity_required": 1.0,
                                        "wastage_percent": 0}], bom_name="DUPE-BOM")
    assert ok, e
    ok, e = mc.create_bom(fg.id, 1.0, [{"component_item_id": rm.id, "quantity_required": 1.0,
                                        "wastage_percent": 0}], bom_name="DUPE-BOM")
    assert not ok and "exists" in e.lower()
    ok, e = mc.create_bom(fg.id, 1.0, [{"component_item_id": rm.id, "quantity_required": 1.0,
                                        "wastage_percent": 120}])
    assert not ok  # wastage > 100


@test("manufacturing: production order edges")
def _(db):
    from controllers.manufacturing_controller import ManufacturingController as mc_import
    mc = mc_import()
    fg = make_item("Mfg PO FG", "FINISHED_GOOD", "UNIT")
    rm = make_item("Mfg PO RM", "RAW_MATERIAL", "KG")
    add_stock(rm.id, 100, 10.0)
    ok, e = mc.create_bom(fg.id, 1.0, [{"component_item_id": rm.id, "quantity_required": 0.1,
                                        "wastage_percent": 0}])
    assert ok, e
    bom = db.fetch_one("SELECT id FROM bill_of_materials WHERE finished_item_id=?", (fg.id,))
    ok, e = mc.create_production_order("PO-EDGE", bom["id"], 0.0, today(), today())
    assert not ok  # planned quantity must be > 0
    ok, e = mc.create_production_order("PO-EDGE", bom["id"], 10.0, today(), today())
    assert ok, e
    ok, e = mc.create_production_order("PO-EDGE", bom["id"], 10.0, today(), today())
    assert not ok  # duplicate order number
    ok, e = mc.delete_production_order(db.fetch_one("SELECT id FROM production_orders "
                                                    "WHERE order_number='PO-EDGE'")["id"])
    assert ok, e  # draft deletable
    ok, e = mc.create_production_order("PO-EDGE2", bom["id"], 10.0, today(), today())
    assert ok, e
    po = db.fetch_one("SELECT id FROM production_orders WHERE order_number='PO-EDGE2'")
    ok, e = mc.complete_production(po["id"], actual_quantity=10.0)  # DRAFT cannot complete
    assert not ok
    ok, e = mc.start_production(po["id"])
    assert ok, e
    ok, e = mc.complete_production(po["id"], actual_quantity=0.0)
    assert not ok
    ok, e = mc.cancel_production_order(po["id"])
    assert ok, e
    ok, e = mc.complete_production(po["id"], actual_quantity=10.0)  # cancelled cannot complete
    assert not ok


@test("manufacturing: complete fails cleanly when raw stock insufficient")
def _(db):
    from controllers.manufacturing_controller import ManufacturingController as mc_import
    mc = mc_import()
    fg = make_item("Mfg Hungry FG", "FINISHED_GOOD", "UNIT")
    rm = make_item("Mfg Hungry RM", "RAW_MATERIAL", "KG")
    add_stock(rm.id, 0.5, 10.0)  # not enough for order
    ok, e = mc.create_bom(fg.id, 1.0, [{"component_item_id": rm.id, "quantity_required": 1.0,
                                        "wastage_percent": 0}])
    assert ok, e
    bom = db.fetch_one("SELECT id FROM bill_of_materials WHERE finished_item_id=?", (fg.id,))
    ok, e = mc.create_production_order("PO-HUNGRY", bom["id"], 1.0, today(), today())
    assert ok, e
    po = db.fetch_one("SELECT id FROM production_orders WHERE order_number='PO-HUNGRY'")
    ok, e = mc.start_production(po["id"])
    assert ok, e
    ok, e = mc.complete_production(po["id"], actual_quantity=1.0)
    assert not ok and "stock" in e.lower()
    status = db.fetch_one("SELECT status FROM production_orders WHERE id=?", (po["id"],))["status"]
    assert status == "IN_PROGRESS"
    rm_left = db.fetch_one("SELECT SUM(quantity_in_stock) s FROM stock_batches WHERE item_id=?",
                           (rm.id,))["s"]
    assert rm_left == 0.5, "nothing should be consumed on failed completion"


@test("expenses: edge validations")
def _(db):
    from controllers.expense_controller import ExpenseController
    c = ExpenseController()
    c.create_category("Salaries")
    cat = db.fetch_one("SELECT id FROM expense_categories WHERE name='Salaries'")
    ok, e = c.create_expense("EV-0A", cat["id"], today(), 0.0, "CASH")
    assert not ok
    ok, e = c.create_expense("EV-0B", cat["id"], today(), -5.0, "CASH")
    assert not ok
    ok, e = c.create_expense("EV-0C", cat["id"], today(), 100.0, "BITCOIN")
    assert not ok
    ok, e = c.create_expense("EV-0D", cat["id"], today(), 100.0, "CASH")
    assert ok, e
    ok, e = c.create_expense("EV-0D", cat["id"], today(), 100.0, "CASH")  # dup voucher
    assert not ok
    # deactivate category -> cannot create expense
    c.update_category(cat["id"], "Salaries", None, False)
    ok, e = c.create_expense("EV-0E", cat["id"], today(), 100.0, "CASH")
    assert not ok and "active" in e.lower()


@test("banking: deposit/withdraw amount validation + duplicate account number")
def _(db):
    from controllers.banking_controller import BankingController as B
    b = B()
    ok, e = b.create_bank_account("HBL", "Main", "7099888777")
    assert ok, e
    acc = db.fetch_one("SELECT id FROM bank_accounts WHERE account_number='7099888777'")
    ok, e = b.deposit(acc["id"], 0.0, today(), None, None)
    assert not ok
    ok, e = b.deposit(acc["id"], -50.0, today(), None, None)
    assert not ok
    ok, e = b.withdraw(acc["id"], 0.0, today(), None, None)
    assert not ok
    ok, e = b.create_bank_account("HBL", "Other", "7099888777")  # duplicate number
    assert not ok and "already exists" in e.lower()


@test("banking: received customer cheque clearing settles AR")
def _(db):
    from controllers.banking_controller import BankingController as B
    b = B()
    make_bank("7099777666")
    bankacc = db.fetch_one("SELECT id FROM bank_accounts WHERE account_number='7099777666'")
    cust = make_party("Chq Recv Customer", "CUSTOMER")
    sup, item = fg_setup("ChqRecv")
    # create an AR first (credit sale 200)
    from controllers.sales_invoice_controller import SalesInvoiceController as C
    ok, e = C().create_sales_invoice("SI-CHQRECV", cust.id, today(), "CREDIT",
                                     [{"item_id": item.id, "quantity": 2, "unit_price": 100.0,
                                       "discount_amount": 0.0, "tax_amount": 0.0}], None)
    assert ok, e
    assert ar(db) == 200.0
    ok, e = b.receive_cheque(bankacc["id"], cust.id, "CHQR-1", 200.0, today())
    assert ok, e
    chq = db.fetch_one("SELECT id FROM cheques WHERE cheque_number='CHQR-1'")
    ok, e = b.clear_cheque(chq["id"])
    assert ok, e
    assert bank(db) == 200.0 and ar(db) == 0.0
    tx = bank_txns(db, "CHQR-1")
    assert len(tx) == 1 and tx[0]["transaction_type"] == "DEPOSIT"
    entries_balanced(db)


@test("banking: state-machine rejects re-clear / re-bounce")
def _(db):
    from controllers.banking_controller import BankingController as B
    b = B()
    make_bank("7099333222")
    bankacc = db.fetch_one("SELECT id FROM bank_accounts WHERE account_number='7099333222'")
    sup = make_party("ChqState Sup", "SUPPLIER")
    ok, e = b.issue_cheque(bankacc["id"], sup.id, "CHQS-1", 100.0, today())
    assert ok, e
    chq = db.fetch_one("SELECT id, status FROM cheques WHERE cheque_number='CHQS-1'")
    assert chq["status"] == "UNCLEARED"
    # cannot clear - no balance
    ok, e = b.clear_cheque(chq["id"])
    assert not ok and "balance" in e.lower()
    ok, e = b.bounce_cheque(chq["id"])
    assert ok, e
    ok, e = b.bounce_cheque(chq["id"])  # already bounced
    assert not ok
    ok, e = b.clear_cheque(chq["id"])   # bounced cannot clear
    assert not ok
    ok, e = b.lose_cheque(chq["id"])    # bounced cannot mark lost
    assert not ok


@test("party: negative credit limit & duplicate manual code & reopen after reactivate")
def _(db):
    from controllers.party_controller import PartyController as P
    from models.enums import PartyType as PT
    p = P()
    ok, e = p.create_party("NegLtd", PT.CUSTOMER, -1)
    assert not ok and "negative" in e.lower()
    # reactivation path used by the Users-style toggle is at DB level for parties
    assert p.create_party("Toggle Party", PT.SUPPLIER, 0.0)[0]
    pid = party_id(db, "Toggle Party")
    assert p.deactivate_party(pid)[0]
    assert p.update_party(pid, "Toggle Party", 0.0, None, True)[0]  # re-activate
    assert db.fetch_one("SELECT is_active FROM parties WHERE id=?", (pid,))["is_active"] == 1


@test("items: same batch number cannot be added twice to same item")
def _(db):
    from controllers.item_controller import ItemController as I
    ic = I()
    assert ic.create_item("DupBatch Item", None, "KG", 10.0, 0.0, 0, 0, None, "RAW_MATERIAL", None)[0]
    iid = item_id(db, "DupBatch Item")
    ok, e = ic.add_opening_stock(iid, 10, unit_cost=5.0, batch_number="BATCH-X")
    assert ok, e
    ok, e = ic.add_opening_stock(iid, 5, unit_cost=5.0, batch_number="BATCH-X")
    assert not ok  # duplicate (item, warehouse, batch) must be rejected


# =====================================================================
# DASHBOARD + CASHBOOK numeric consistency across a whole day
# =====================================================================
@test("dashboard: KPI numbers equal ledger after mixed transactions")
def _(db):
    from controllers.expense_controller import ExpenseController
    from controllers.sales_invoice_controller import SalesInvoiceController as C
    from controllers.payment_controller import PaymentController

    cust_cash = make_party("Dash Cash Customer", "CUSTOMER")
    cust_credit = make_party("Dash Credit Customer", "CUSTOMER")
    sup, item = fg_setup("DashFG")
    # cash sale 200
    assert C().create_sales_invoice("SI-DASH1", cust_cash.id, today(), "CASH",
                                    [{"item_id": item.id, "quantity": 2, "unit_price": 100.0,
                                      "discount_amount": 0.0, "tax_amount": 0.0}], None)[0]
    # credit sale 300 (qty3)
    assert C().create_sales_invoice("SI-DASH2", cust_credit.id, today(), "CREDIT",
                                    [{"item_id": item.id, "quantity": 3, "unit_price": 100.0,
                                      "discount_amount": 0.0, "tax_amount": 0.0}], None)[0]
    # receive part of the credit sale in cash
    inv2 = db.fetch_one("SELECT id FROM sales_invoices WHERE invoice_number='SI-DASH2'")
    assert PaymentController().receive_payment(cust_credit.id, 100.0, today(), "CASH",
                                               None, None, sales_invoice_id=inv2["id"])[0]
    # cash expense
    ec = ExpenseController()
    assert ec.create_category("Dash Expense")[0]
    cat = db.fetch_one("SELECT id FROM expense_categories WHERE name='Dash Expense'")
    assert ec.create_expense("EV-DASH", cat["id"], today(), 40.0, "CASH", description="x")[0]

    d = dash_kpis(db)
    assert d["balances"]["cash"] == cash(db)
    assert d["balances"]["bank"] == bank(db)
    assert d["balances"]["inventory"] == inv(db)
    assert d["receivables_payables"]["receivable"] == ar(db)
    assert d["receivables_payables"]["payable"] == ap(db)
    assert d["today"]["sales_total"] == 500.0
    assert d["today"]["purchases_total"] == 0.0
    # profit = revenue - cogs - operating expenses
    expected_profit = 500.0 - 250.0 - 40.0
    assert approx(d["profit_loss"]["profit"], expected_profit)
    monitor(db, parties=[cust_cash.id, cust_credit.id])


@test("reports: cash book closing balance equals cash ledger")
def _(db):
    from controllers.expense_controller import ExpenseController
    from controllers.report_controller import ReportController
    # +200 cash sale, +100 received, -40 cash expense => cash ledger 260
    cust = make_party("CashBook Customer", "CUSTOMER")
    sup, item = fg_setup("CashBookFG")
    from controllers.sales_invoice_controller import SalesInvoiceController as C
    from controllers.payment_controller import PaymentController
    assert C().create_sales_invoice("SI-CB1", cust.id, today(), "CASH",
                                    [{"item_id": item.id, "quantity": 2, "unit_price": 100.0,
                                      "discount_amount": 0.0, "tax_amount": 0.0}], None)[0]
    assert C().create_sales_invoice("SI-CB2", cust.id, today(), "CREDIT",
                                    [{"item_id": item.id, "quantity": 1, "unit_price": 100.0,
                                      "discount_amount": 0.0, "tax_amount": 0.0}], None)[0]
    inv = db.fetch_one("SELECT id FROM sales_invoices WHERE invoice_number='SI-CB2'")
    assert PaymentController().receive_payment(cust.id, 100.0, today(), "CASH", None, None,
                                               sales_invoice_id=inv["id"])[0]
    ec = ExpenseController()
    assert ec.create_category("CashBook Exp")[0]
    cat = db.fetch_one("SELECT id FROM expense_categories WHERE name='CashBook Exp'")
    assert ec.create_expense("EV-CB", cat["id"], today(), 40.0, "CASH")[0]

    assert cash(db) == 260.0
    rc = ReportController()
    cb, err = rc.get_cash_book("2000-01-01", "2100-01-01")
    assert err is None
    assert r2(cb["closing_balance"]) == r2(cash(db))
    assert r2(cb["total_received"]) == r2(300.0)
    assert r2(cb["total_paid"]) == r2(40.0)


@test("reports: P&L figures match ledger after sales + expenses")
def _(db):
    from controllers.expense_controller import ExpenseController
    from controllers.report_controller import ReportController
    cust = make_party("PL Customer", "CUSTOMER")
    sup, item = fg_setup("PLFG")
    from controllers.sales_invoice_controller import SalesInvoiceController as C
    assert C().create_sales_invoice("SI-PL1", cust.id, today(), "CASH",
                                    [{"item_id": item.id, "quantity": 10, "unit_price": 100.0,
                                      "discount_amount": 0.0, "tax_amount": 0.0}], None)[0]
    ec = ExpenseController()
    assert ec.create_category("PL Admin")[0]
    cat = db.fetch_one("SELECT id FROM expense_categories WHERE name='PL Admin'")
    assert ec.create_expense("EV-PL", cat["id"], today(), 300.0, "CASH")[0]

    rc = ReportController()
    pl, err = rc.get_profit_loss("2000-01-01", "2100-01-01")
    assert err is None
    assert approx(pl["total_sales"], 1000.0)
    assert approx(pl["total_cost_of_sales"], 500.0)   # 10 * 50
    assert approx(pl["total_general_admin"], 300.0)
    assert approx(pl["gross_profit"], 500.0)
    assert approx(pl["net_profit"], 200.0)
    assert pl["is_profit"] is True
    monitor(db)


# =====================================================================
# BATCH 3 - COVERAGE GAPS (list/get, BOM mgmt, expense items, banking, etc.)
# =====================================================================

# --- SALES / PURCHASE list + get ---

@test("sales: list_sales_invoices + get_sales_invoice return correct data")
def _(db):
    from controllers.sales_invoice_controller import SalesInvoiceController as C
    cust = make_party("List Buyer", "CUSTOMER")
    _, item = fg_setup("ListSale")
    create_sale(db, cust, item, "CASH", "SI-LST-1")
    create_sale(db, cust, item, "CASH", "SI-LST-2")
    c = C()
    invs, err = c.list_sales_invoices()
    assert err is None and len(invs) >= 2
    nums = {i.invoice_number for i in invs}
    assert "SI-LST-1" in nums and "SI-LST-2" in nums
    inv_id = db.fetch_one("SELECT id FROM sales_invoices WHERE invoice_number='SI-LST-1'")["id"]
    inv, err = c.get_sales_invoice(inv_id)
    assert err is None and inv is not None
    assert inv.invoice_number == "SI-LST-1"
    assert inv.total_amount == 200.0


@test("sales: list_sales_invoices filtered by status")
def _(db):
    from controllers.sales_invoice_controller import SalesInvoiceController as C
    cust = make_party("StFilter Buyer", "CUSTOMER")
    _, item = fg_setup("StFilterSale")
    create_sale(db, cust, item, "CASH", "SI-STF-1")
    c = C()
    confirmed, err = c.list_sales_invoices(status="CONFIRMED")
    assert err is None
    assert any(i.invoice_number == "SI-STF-1" for i in confirmed)
    cancelled, err = c.list_sales_invoices(status="CANCELLED")
    assert err is None
    assert not any(i.invoice_number == "SI-STF-1" for i in cancelled)


@test("purchases: list_purchase_invoices + get_purchase_invoice return correct data")
def _(db):
    from controllers.purchase_invoice_controller import PurchaseInvoiceController as C
    sup, item = raw_setup("ListPur")
    create_purchase(db, sup, item, "CASH", "PI-LST-1")
    create_purchase(db, sup, item, "CASH", "PI-LST-2")
    c = C()
    invs, err = c.list_purchase_invoices()
    assert err is None and len(invs) >= 2
    nums = {i.invoice_number for i in invs}
    assert "PI-LST-1" in nums and "PI-LST-2" in nums
    inv_id = db.fetch_one("SELECT id FROM purchase_invoices WHERE invoice_number='PI-LST-1'")["id"]
    inv, err = c.get_purchase_invoice(inv_id)
    assert err is None and inv is not None
    assert inv.invoice_number == "PI-LST-1"
    assert inv.total_amount == 300.0


@test("purchases: list_purchase_invoices filtered by status")
def _(db):
    from controllers.purchase_invoice_controller import PurchaseInvoiceController as C
    sup, item = raw_setup("StFilterPur")
    create_purchase(db, sup, item, "CASH", "PI-STF-1")
    c = C()
    confirmed, err = c.list_purchase_invoices(status="CONFIRMED")
    assert err is None
    assert any(i.invoice_number == "PI-STF-1" for i in confirmed)


# --- BANK-BASED PAYMENTS ---

@test("payments: bank receive_payment increases bank not cash")
def _(db):
    from controllers.payment_controller import PaymentController
    cust = make_party("BankPay Buyer", "CUSTOMER")
    _, item = fg_setup("BankPay")
    inv = create_sale(db, cust, item, "CREDIT", "SI-BPAY-1")
    assert ar(db) == 200.0
    ok, e = PaymentController().receive_payment(
        cust.id, 200.0, today(), "BANK", "SI-BPAY-1", None, sales_invoice_id=inv["id"])
    assert ok, e
    assert ar(db) == 0.0 and bank(db) == 200.0 and cash(db) == 0.0
    paid = db.fetch_one("SELECT paid_amount FROM sales_invoices WHERE id=?", (inv["id"],))["paid_amount"]
    assert paid == 200.0
    monitor(db, parties=[cust.id])


@test("payments: bank pay_supplier decreases bank not cash")
def _(db):
    from controllers.payment_controller import PaymentController
    sup, item = raw_setup("BankPurPay")
    inv = create_purchase(db, sup, item, "CREDIT", "PI-BPAY-1")
    assert ap(db) == 300.0
    ok, e = PaymentController().pay_supplier(
        sup.id, 300.0, today(), "BANK", "PI-BPAY-1", None, purchase_invoice_id=inv["id"])
    assert ok, e
    assert ap(db) == 0.0 and bank(db) == -300.0 and cash(db) == 0.0
    paid = db.fetch_one("SELECT paid_amount FROM purchase_invoices WHERE id=?", (inv["id"],))["paid_amount"]
    assert paid == 300.0
    monitor(db, parties=[sup.id])


@test("payments: negative amount rejected for receive and pay")
def _(db):
    from controllers.payment_controller import PaymentController
    cust = make_party("NegAmt Buyer", "CUSTOMER")
    sup = make_party("NegAmt Sup", "SUPPLIER")
    pc = PaymentController()
    ok, e = pc.receive_payment(cust.id, -10.0, today(), "CASH", None, None)
    assert not ok and "greater than 0" in e.lower()
    ok, e = pc.pay_supplier(sup.id, -10.0, today(), "CASH", None, None)
    assert not ok and "greater than 0" in e.lower()


@test("payments: pay_supplier to a customer rejected")
def _(db):
    from controllers.payment_controller import PaymentController
    cust = make_party("NotASupplier", "CUSTOMER")
    ok, e = PaymentController().pay_supplier(cust.id, 100.0, today(), "CASH", None, None)
    assert not ok and "supplier" in e.lower()


@test("payments: receive_payment from a supplier rejected")
def _(db):
    from controllers.payment_controller import PaymentController
    sup = make_party("NotACustomer", "SUPPLIER")
    ok, e = PaymentController().receive_payment(sup.id, 100.0, today(), "CASH", None, None)
    assert not ok and "customer" in e.lower()


@test("payments: partial bank receive payment reduces AR correctly")
def _(db):
    from controllers.payment_controller import PaymentController
    cust = make_party("Partial Buyer", "CUSTOMER")
    _, item = fg_setup("PartialBP")
    inv = create_sale(db, cust, item, "CREDIT", "SI-PART-1")  # 200
    assert ar(db) == 200.0
    ok, e = PaymentController().receive_payment(
        cust.id, 50.0, today(), "BANK", None, None, sales_invoice_id=inv["id"])
    assert ok, e
    assert ar(db) == 150.0
    assert bank(db) == 50.0
    paid = db.fetch_one("SELECT paid_amount FROM sales_invoices WHERE id=?", (inv["id"],))["paid_amount"]
    assert paid == 50.0


# --- EXPENSE ITEM CRUD ---

@test("expense items: create -> update -> delete -> list lifecycle")
def _(db):
    from controllers.expense_controller import ExpenseController
    from controllers.expense_item_controller import ExpenseItemController
    ec = ExpenseController()
    assert ec.create_category("Payroll")[0]
    cat = db.fetch_one("SELECT id FROM expense_categories WHERE name='Payroll'")
    ic = ExpenseItemController()
    it1, e = ic.create_item(cat["id"], "Emp Alpha", 5000.0)
    assert it1 is not None and not e
    it2, e = ic.create_item(cat["id"], "Emp Beta", 7000.0)
    assert it2 is not None and not e
    # list
    items, err = ic.list_items(cat["id"])
    assert err is None and len(items) == 2
    names = {i.name for i in items}
    assert "Emp Alpha" in names and "Emp Beta" in names
    # update
    ok, e = ic.update_item(it1.id, "Emp Alpha Updated", 5500.0)
    assert ok, e
    updated, _ = ic.list_items(cat["id"])
    alpha = [i for i in updated if i.id == it1.id][0]
    assert alpha.name == "Emp Alpha Updated" and alpha.amount == 5500.0
    # delete
    ok, e = ic.delete_item(it2.id)
    assert ok, e
    remaining, _ = ic.list_items(cat["id"])
    assert len(remaining) == 1


@test("expense items: pay_items with BANK method posts to bank")
def _(db):
    from controllers.expense_controller import ExpenseController
    from controllers.expense_item_controller import ExpenseItemController
    ec = ExpenseController()
    assert ec.create_category("Utilities")[0]
    cat = db.fetch_one("SELECT id FROM expense_categories WHERE name='Utilities'")
    ic = ExpenseItemController()
    it1, _ = ic.create_item(cat["id"], "Electricity Bill", 800.0)
    vouchers, err = ic.pay_items(1, cat["id"],
                                 [{"item_id": it1.id, "amount": 800.0, "description": None}],
                                 "BANK", today())
    assert err is None and vouchers and len(vouchers) == 1
    assert bank(db) == -800.0
    assert bal(db, "6000") == 800.0
    monitor(db)


# --- EXPENSE CATEGORY MANAGEMENT ---

@test("expense categories: list_categories + update_category + delete_category")
def _(db):
    from controllers.expense_controller import ExpenseController
    c = ExpenseController()
    ok, e = c.create_category("Travel")
    assert ok, e
    ok, e = c.create_category("Meals")
    assert ok, e
    cats, err = c.list_categories()
    assert err is None and len(cats) >= 2
    names = {cat.name for cat in cats}
    assert "Travel" in names and "Meals" in names
    travel = db.fetch_one("SELECT id FROM expense_categories WHERE name='Travel'")
    ok, e = c.update_category(travel["id"], "Travel Updated", None, True)
    assert ok, e
    cats2, _ = c.list_categories()
    assert any(cat.name == "Travel Updated" for cat in cats2)
    # delete (deactivate) - only works if no expenses
    meals = db.fetch_one("SELECT id FROM expense_categories WHERE name='Meals'")
    ok, e = c.delete_category(meals["id"])
    assert ok, e
    assert db.fetch_one("SELECT is_active FROM expense_categories WHERE id=?", (meals["id"],))["is_active"] == 0


@test("expense categories: delete_category with existing expenses blocked")
def _(db):
    from controllers.expense_controller import ExpenseController
    c = ExpenseController()
    c.create_category("HasExpenses")
    cat = db.fetch_one("SELECT id FROM expense_categories WHERE name='HasExpenses'")
    c.create_expense("EV-DEL-1", cat["id"], today(), 100.0, "CASH")
    ok, e = c.delete_category(cat["id"])
    assert not ok


@test("expenses: list_expenses with date and category filters")
def _(db):
    from controllers.expense_controller import ExpenseController
    c = ExpenseController()
    c.create_category("FilterCat1")
    c.create_category("FilterCat2")
    cat1 = db.fetch_one("SELECT id FROM expense_categories WHERE name='FilterCat1'")
    cat2 = db.fetch_one("SELECT id FROM expense_categories WHERE name='FilterCat2'")
    c.create_expense("EV-F1", cat1["id"], today(), 100.0, "CASH")
    c.create_expense("EV-F2", cat1["id"], today_minus(10), 200.0, "CASH")
    c.create_expense("EV-F3", cat2["id"], today(), 300.0, "CASH")
    # filter by date range (today only)
    expenses, err = c.list_expenses(date_from=today(), date_to=today())
    assert err is None
    vouchers = {e.get("voucher_number", e.get("voucherNumber", "")) for e in expenses}
    assert "EV-F1" in vouchers and "EV-F3" in vouchers and "EV-F2" not in vouchers
    # filter by category
    expenses2, _ = c.list_expenses(date_from=today_minus(20), date_to=today(), category_id=cat1["id"])
    vouchers2 = {e.get("voucher_number", e.get("voucherNumber", "")) for e in expenses2}
    assert "EV-F1" in vouchers2 and "EV-F3" not in vouchers2


@test("expenses: get_expense returns correct record")
def _(db):
    from controllers.expense_controller import ExpenseController
    c = ExpenseController()
    c.create_category("GetCat")
    cat = db.fetch_one("SELECT id FROM expense_categories WHERE name='GetCat'")
    c.create_expense("EV-G1", cat["id"], today(), 750.0, "CASH", description="test get")
    exp_id = db.fetch_one("SELECT id FROM expenses WHERE voucher_number='EV-G1'")["id"]
    exp, err = c.get_expense(exp_id)
    assert err is None and exp is not None
    assert exp.voucher_number == "EV-G1" or getattr(exp, "voucher_number", None) == "EV-G1"


# --- MANUFACTURING BOM MANAGEMENT ---

@test("manufacturing: list_boms + get_bom + update_bom + deactivate_bom")
def _(db):
    from controllers.manufacturing_controller import ManufacturingController as MC
    mc = MC()
    fg = make_item("BomMgmt FG", "FINISHED_GOOD", "UNIT", 0, 100)
    rm1 = make_item("BomMgmt RM1", "RAW_MATERIAL", "KG", 10.0, 0)
    rm2 = make_item("BomMgmt RM2", "RAW_MATERIAL", "KG", 5.0, 0)
    ok, e = mc.create_bom(fg.id, 1.0, [
        {"component_item_id": rm1.id, "quantity_required": 2.0, "wastage_percent": 0},
    ], bom_name="BOM-MGMT-1")
    assert ok, e
    # list
    boms, err = mc.list_boms()
    assert err is None
    assert any(b.bom_name == "BOM-MGMT-1" for b in boms)
    # get
    bom = db.fetch_one("SELECT id FROM bill_of_materials WHERE finished_item_id=?", (fg.id,))
    got, err = mc.get_bom(bom["id"])
    assert err is None and got is not None
    assert got.bom_name == "BOM-MGMT-1"
    # update: change components
    ok, e = mc.update_bom(bom["id"], "BOM-MGMT-1-UPD", fg.id, 1.0, [
        {"component_item_id": rm1.id, "quantity_required": 3.0, "wastage_percent": 0},
        {"component_item_id": rm2.id, "quantity_required": 1.0, "wastage_percent": 5},
    ], None)
    assert ok, e
    got2, _ = mc.get_bom(bom["id"])
    assert got2.bom_name == "BOM-MGMT-1-UPD"
    # deactivate
    ok, e = mc.deactivate_bom(bom["id"])
    assert ok, e
    assert db.fetch_one("SELECT is_active FROM bill_of_materials WHERE id=?", (bom["id"],))["is_active"] == 0


@test("manufacturing: list_production_orders + get_production_order")
def _(db):
    from controllers.manufacturing_controller import ManufacturingController as MC
    mc = MC()
    fg = make_item("POMgmt FG", "FINISHED_GOOD", "UNIT", 0, 100)
    rm = make_item("POMgmt RM", "RAW_MATERIAL", "KG", 10.0, 0)
    add_stock(rm.id, 500, 10.0)
    ok, e = mc.create_bom(fg.id, 1.0, [
        {"component_item_id": rm.id, "quantity_required": 0.1, "wastage_percent": 0},
    ], bom_name="BOM-PO-MGMT")
    assert ok, e
    bom = db.fetch_one("SELECT id FROM bill_of_materials WHERE bom_name='BOM-PO-MGMT'")
    ok, e = mc.create_production_order("PO-MGMT-1", bom["id"], 10.0, today(), today())
    assert ok, e
    ok, e = mc.create_production_order("PO-MGMT-2", bom["id"], 20.0, today(), today())
    assert ok, e
    # list all
    orders, err = mc.list_production_orders()
    assert err is None
    nums = {o.order_number for o in orders}
    assert "PO-MGMT-1" in nums and "PO-MGMT-2" in nums
    # list filtered
    drafts, _ = mc.list_production_orders(status="DRAFT")
    assert all(o.status == "DRAFT" for o in drafts)
    # get
    po_id = db.fetch_one("SELECT id FROM production_orders WHERE order_number='PO-MGMT-1'")["id"]
    got, err = mc.get_production_order(po_id)
    assert err is None and got is not None
    assert got.order_number == "PO-MGMT-1"


# --- BANKING LIST / DEACTIVATE / TRANSACTIONS / LOSE CHEQUE ---

@test("banking: list_bank_accounts returns created accounts")
def _(db):
    from controllers.banking_controller import BankingController
    b = BankingController()
    ok, e = b.create_bank_account("HBL", "Savings", "6000000001", 1000.0)
    assert ok, e
    ok, e = b.create_bank_account("UBL", "Current", "6000000002", 5000.0)
    assert ok, e
    accs, err = b.list_bank_accounts()
    assert err is None and len(accs) >= 2
    acc_nums = {a.account_number for a in accs}
    assert "6000000001" in acc_nums and "6000000002" in acc_nums


@test("banking: deactivate_bank_account works")
def _(db):
    from controllers.banking_controller import BankingController
    b = BankingController()
    ok, e = b.create_bank_account("HBL", "DeactivateMe", "6000000003", 0)
    assert ok, e
    acc = db.fetch_one("SELECT id FROM bank_accounts WHERE account_number='6000000003'")
    ok, e = b.deactivate_account(acc["id"])
    assert ok, e
    assert db.fetch_one("SELECT is_active FROM bank_accounts WHERE id=?", (acc["id"],))["is_active"] == 0


@test("banking: list_transactions returns deposits and withdrawals")
def _(db):
    from controllers.banking_controller import BankingController
    b = BankingController()
    ok, e = b.create_bank_account("HBL", "TxnTest", "6000000004", 0)
    assert ok, e
    acc = db.fetch_one("SELECT id FROM bank_accounts WHERE account_number='6000000004'")
    b.deposit(acc["id"], 1000.0, today(), "D-TEST", None)
    b.withdraw(acc["id"], 200.0, today(), "W-TEST", None)
    txns, err = b.list_transactions(acc["id"])
    assert len(txns) >= 2
    types = {t["transaction_type"] for t in txns}
    assert "DEPOSIT" in types and "WITHDRAWAL" in types
    monitor(db)


@test("banking: lose_cheque marks cheque as LOST")
def _(db):
    from controllers.banking_controller import BankingController
    from helpers import seed as _seed
    b = BankingController()
    bankacc = _seed.make_bank_account("HBL", "LoseTest", "6000000005", 5000.0)
    sup = _seed.supplier("LoseCheque Sup")
    ok, e = b.issue_cheque(bankacc.id, sup.id, "CHQ-LOSE-1", 500.0, today())
    assert ok, e
    chq = db.fetch_one("SELECT id FROM cheques WHERE cheque_number='CHQ-LOSE-1'")
    ok, e = b.lose_cheque(chq["id"])
    assert ok, e
    assert db.fetch_one("SELECT status FROM cheques WHERE id=?", (chq["id"],))["status"] == "LOST"


@test("banking: list_cheques by status returns correct set")
def _(db):
    from controllers.banking_controller import BankingController
    from helpers import seed as _seed
    b = BankingController()
    bankacc = _seed.make_bank_account("HBL", "ListChq", "6000000006", 20000.0)
    sup = _seed.supplier("ListChq Sup")
    b.issue_cheque(bankacc.id, sup.id, "CHQ-LST-1", 1000.0, today())
    b.issue_cheque(bankacc.id, sup.id, "CHQ-LST-2", 2000.0, today())
    uncl, _ = b.list_cheques(status="UNCLEARED")
    assert len(uncl) >= 2
    nums = {c["cheque_number"] for c in uncl}
    assert "CHQ-LST-1" in nums and "CHQ-LST-2" in nums
    cleared, _ = b.list_cheques(status="CLEARED")
    assert not any(c["cheque_number"] == "CHQ-LST-1" for c in cleared)


# --- PARTY LIST FILTERING ---

@test("party: list_parties filters by active and party_type")
def _(db):
    from controllers.party_controller import PartyController
    from models.enums import PartyType
    c = PartyController()
    c.create_party("Filter Cust A", PartyType.CUSTOMER, 0)
    c.create_party("Filter Sup A", PartyType.SUPPLIER, 0)
    c.create_party("Filter Both A", PartyType.BOTH, 0)
    pid = party_id(db, "Filter Both A")
    c.deactivate_party(pid)
    # active only
    active, err = c.list_parties(active_only=True)
    assert err is None
    active_names = {p.name for p in active}
    assert "Filter Both A" not in active_names
    assert "Filter Cust A" in active_names
    # filter by type
    customers, err = c.list_parties(party_type="CUSTOMER")
    assert err is None
    cust_names = {p.name for p in customers}
    assert "Filter Cust A" in cust_names
    assert "Filter Sup A" not in cust_names


# --- ITEM LIST / GET / TAX RATES ---

@test("items: list_items + get_item work correctly")
def _(db):
    from controllers.item_controller import ItemController
    c = ItemController()
    c.create_item("ListItem1", None, "UNIT", 10, 20, 0, 0, None, "FINISHED_GOOD", None)
    c.create_item("ListItem2", None, "KG", 15, 30, 0, 0, None, "RAW_MATERIAL", None)
    items, err = c.list_items()
    assert err is None
    names = {i.item_name for i in items}
    assert "ListItem1" in names and "ListItem2" in names
    iid = item_id(db, "ListItem1")
    item, err = c.get_item(iid)
    assert err is None and item is not None
    assert item.item_name == "ListItem1"
    not_found, err = c.get_item(999999)
    assert not_found is None


@test("items: get_tax_rates_for_dropdown returns without error")
def _(db):
    from controllers.item_controller import ItemController
    rates, err = ItemController().get_tax_rates_for_dropdown()
    assert err is None
    assert isinstance(rates, list)


@test("items: list_items active_only filter excludes deactivated")
def _(db):
    from controllers.item_controller import ItemController
    c = ItemController()
    c.create_item("ActiveItem", None, "UNIT", 10, 20, 0, 0, None, "FINISHED_GOOD", None)
    c.create_item("DeactItem", None, "UNIT", 10, 20, 0, 0, None, "FINISHED_GOOD", None)
    iid = item_id(db, "DeactItem")
    c.deactivate_item(iid)
    active, _ = c.list_items(active_only=True)
    active_names = {i.item_name for i in active}
    assert "ActiveItem" in active_names
    assert "DeactItem" not in active_names


# --- ACCOUNT GET_BALANCE + LIST FILTERING ---

@test("accounts: get_balance returns correct balance for an account")
def _(db):
    from controllers.account_controller import AccountController
    c = AccountController()
    cash_id = db.fetch_one("SELECT id FROM accounts WHERE account_code='1000'")["id"]
    bal_val, err = c.get_balance(cash_id)
    assert err is None
    assert bal_val == cash(db)


@test("accounts: list_accounts active_only excludes deactivated")
def _(db):
    from controllers.account_controller import AccountController
    c = AccountController()
    c.create_account("1520", "Temp Account", "ASSET", None, 0)
    aid = db.fetch_one("SELECT id FROM accounts WHERE account_code='1520'")["id"]
    c.deactivate_account(aid)
    active, err = c.list_accounts(active_only=True)
    assert err is None
    codes = {a.account_code for a in active}
    assert "1520" not in codes
    all_accs, _ = c.list_accounts(active_only=False)
    all_codes = {a.account_code for a in all_accs}
    assert "1520" in all_codes


# --- REPORT: PARTY LEDGER STANDALONE ---

@test("reports: party ledger shows correct transactions for a customer")
def _(db):
    from controllers.report_controller import ReportController
    from controllers.sales_invoice_controller import SalesInvoiceController as C
    from controllers.payment_controller import PaymentController
    cust = make_party("LedgerCust", "CUSTOMER")
    _, item = fg_setup("LedgerSale")
    create_sale(db, cust, item, "CREDIT", "SI-LED-1")
    inv = db.fetch_one("SELECT id FROM sales_invoices WHERE invoice_number='SI-LED-1'")
    PaymentController().receive_payment(cust.id, 50.0, today(), "CASH", None, None,
                                        sales_invoice_id=inv["id"])
    rc = ReportController()
    data, err = rc.get_party_ledger(cust.id)
    assert err is None and data is not None
    # should have at least 2 entries: invoice + partial payment
    assert len(data.get("entries", [])) >= 2 or len(data.get("transactions", [])) >= 2


# --- BACKUP / RESTORE SMOKE ---

@test("backup: get_backup_status returns dict without error")
def _(db):
    from controllers.backup_controller import BackupController
    bc = BackupController()
    status, err = bc.get_backup_status()
    assert err is None
    assert isinstance(status, dict)


# --- MIGRATION / SCHEMA INTEGRITY ---

@test("schema: all expected tables exist after migration")
def _(db):
    tables = {r["name"] for r in db.fetch_all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
    required = {
        "users", "roles", "accounts", "journal_entries", "journal_entry_lines",
        "parties", "items", "stock_batches", "sales_invoices", "sales_invoice_items",
        "purchase_invoices", "purchase_invoice_items", "payments", "receipts",
        "expenses", "expense_categories", "bank_accounts", "bank_transactions",
        "cheques", "bill_of_materials", "bom_components", "production_orders",
        "production_consumption", "asset_details", "tax_rates",
    }
    missing = required - tables
    assert not missing, f"Missing tables: {missing}"


@test("schema: expense_items table exists with correct columns")
def _(db):
    cols = {r["name"] for r in db.fetch_all("PRAGMA table_info(expense_items)")}
    assert {"id", "category_id", "name", "amount", "is_active"} <= cols


@test("schema: bill_of_materials has is_temp column for temporary BOMs")
def _(db):
    cols = {r["name"] for r in db.fetch_all("PRAGMA table_info(bill_of_materials)")}
    assert "is_temp" in cols


# =====================================================================
# run everything
# =====================================================================
def _run(name, fn, expected_bug):
    t0 = time.time()
    conn, path = new_db()
    buf = io.StringIO()
    root = logging.getLogger("erp")
    handler = logging.StreamHandler(buf)
    handler.setFormatter(logging.Formatter("%(levelname)-7s | %(name)s | %(message)s"))
    root.addHandler(handler)
    try:
        fn(conn)
        ok = True
        err = None
    except Exception:
        ok = False
        err = traceback.format_exc(limit=6)
    finally:
        root.removeHandler(handler)
        close_db(conn, path)
    log_name = re.sub(r"[^A-Za-z0-9_.-]+", "_", name) + ".log"
    (LOG_DIR / log_name).write_text(buf.getvalue(), encoding="utf-8")
    dt = time.time() - t0
    if ok:
        if expected_bug:
            return "PASS", f"(expected-bug NOT reproduced!) {expected_bug}", dt, log_name
        return "PASS", "", dt, log_name
    if expected_bug:
        return "BUG", f"CONFIRMED: {expected_bug}", dt, log_name
    return "FAIL", err, dt, log_name


def main(argv=None):
    argv = list(sys.argv[1:]) if argv is None else list(argv)
    filters = [a.lower() for a in argv if not a.startswith("-")]
    total = passed = bugs = failed = 0
    print("=" * 100)
    print("BOP PHARMACEUTICAL ERP - FULL-SYSTEM TEST SCRIPT")
    print(f"{datetime.datetime.now():%Y-%m-%d %H:%M:%S}  | filters={filters or 'ALL'}")
    print("=" * 100)
    for name, fn, expected_bug in SUITE:
        if filters and not any(f in name.lower() for f in filters):
            continue
        total += 1
        status, detail, dt, log = _run(name, fn, expected_bug)
        if status == "PASS":
            passed += 1
            line = f"PASS  [{dt:5.1f}s] {name}"
        elif status == "BUG":
            bugs += 1
            line = f"BUG   [{dt:5.1f}s] {name}  <-- CONFIRMED KNOWN BUG"
        else:
            failed += 1
            line = f"FAIL  [{dt:5.1f}s] {name}"
        print(line)
        if status == "FAIL":
            print("-" * 100)
            print(detail)
            print("-" * 100)
        print(f"         log: {log}  {('| ' + detail) if detail and status == 'BUG' else ''}")
    print("=" * 100)
    print(f"TOTAL: {total}   PASS: {passed}   BUG-CONFIRMED: {bugs}   FAIL: {failed}")
    if total and (passed + bugs) == total and failed == 0:
        print("RESULT: ALL GREEN")
    else:
        print("RESULT: FAILURES PRESENT")
    print(f"Per-test logs: {LOG_DIR}")
    print("=" * 100)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
