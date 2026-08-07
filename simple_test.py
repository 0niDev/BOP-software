"""
Simple Comprehensive Test Script for ERP System
Tests: Inventory, Party, Sales, Purchases
Validates: All numbers check out, catches any errors in operations
"""
from __future__ import annotations

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.connection import get_db
from services.purchase_invoice_service import PurchaseInvoiceService
from services.sales_invoice_service import SalesInvoiceService
from services.party_service import PartyService
from services.item_service import ItemService
from services.accounting_service import AccountingService
from services.dashboard_service import DashboardService
from utils.logger import get_logger
from models.enums import PartyType

logger = get_logger(__name__)

# ============================================================
# TEST RESULTS TRACKING
# ============================================================

test_results = {
    'passed': [],
    'failed': [],
    'errors': []
}

def test(name):
    """Decorator to track test results."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            try:
                print(f"\n  🧪 Testing: {name}...")
                result = func(*args, **kwargs)
                if result:
                    test_results['passed'].append(name)
                    print(f"     ✅ PASS")
                else:
                    test_results['failed'].append(name)
                    print(f"     ❌ FAIL")
                return result
            except Exception as e:
                test_results['failed'].append(name)
                test_results['errors'].append((name, str(e)))
                print(f"     ❌ ERROR: {e}")
                return False
        return wrapper
    return decorator

# ============================================================
# HELPER FUNCTIONS
# ============================================================

db = None
purchase_service = None
sales_service = None
party_service = None
item_service = None
accounting_service = None
dashboard_service = None

def init_services():
    """Initialize all services."""
    global db, purchase_service, sales_service, party_service, item_service, accounting_service, dashboard_service
    db = get_db()
    purchase_service = PurchaseInvoiceService(db)
    sales_service = SalesInvoiceService(db)
    party_service = PartyService(db)
    item_service = ItemService(db)
    accounting_service = AccountingService(db)
    dashboard_service = DashboardService(db)

def get_account_balance(account_code):
    """Get balance for an account by code."""
    from repositories.account_repository import AccountRepository
    # Clear cache to get fresh balance after each transaction
    AccountRepository._cache.clear()
    dashboard_service.invalidate_cache()  # Also clear dashboard cache
    repo = AccountRepository(db)
    account = repo.find_by_code(account_code)
    if account:
        balance = accounting_service.get_account_balance(account["id"])
        if isinstance(balance, dict):
            return float(balance.get('balance', 0))
        return float(balance)
    return 0.0

def get_inventory_value():
    """Get total inventory value."""
    # Clear dashboard cache to get fresh inventory value
    dashboard_service.invalidate_cache()
    inv = dashboard_service._get_balances(1)
    return float(inv.get('inventory', 0))

def get_party(code):
    """Get party by code."""
    parties = party_service.list_parties(active_only=True)
    for p in parties:
        if p.code == code:
            return p
    return None

def get_item(item_code):
    """Get item by code."""
    items = item_service.list_items(active_only=True)
    for i in items:
        if i.item_code == item_code:
            return i
    return None

def print_balances(title="Balances"):
    """Print current balances."""
    print(f"\n  📊 {title}:")
    print(f"     Cash (1000):  Rs. {get_account_balance('1000'):,.2f}")
    print(f"     Bank (1010):  Rs. {get_account_balance('1010'):,.2f}")
    print(f"     AR (1100):    Rs. {get_account_balance('1100'):,.2f}")
    print(f"     AP (2000):    Rs. {get_account_balance('2000'):,.2f}")
    print(f"     Inventory:    Rs. {get_inventory_value():,.2f}")

# ============================================================
# TESTS
# ============================================================

@test("Create Customer Party")
def test_create_customer():
    """Test creating a customer."""
    customer = party_service.create_party(
        name=f"Test Customer {len(party_service.list_parties(active_only=True)) + 1}",
        party_type=PartyType.CUSTOMER,
        credit_limit=50000.0,
    )
    assert customer.id > 0, "Customer ID not assigned"
    assert customer.credit_limit == 50000.0, "Credit limit mismatch"
    return True

@test("Create Supplier Party")
def test_create_supplier():
    """Test creating a supplier."""
    supplier = party_service.create_party(
        name=f"Test Supplier {len(party_service.list_parties(active_only=True)) + 1}",
        party_type=PartyType.SUPPLIER,
        credit_limit=100000.0,
    )
    assert supplier.id > 0, "Supplier ID not assigned"
    assert supplier.credit_limit == 100000.0, "Credit limit mismatch"
    return True

@test("List Parties")
def test_list_parties():
    """Test listing parties."""
    customers = party_service.list_parties(active_only=True, party_type=PartyType.CUSTOMER)
    suppliers = party_service.list_parties(active_only=True, party_type=PartyType.SUPPLIER)
    assert len(customers) >= 1, "No customers found"
    assert len(suppliers) >= 1, "No suppliers found"
    return True

@test("Inventory Items Exist")
def test_inventory_exists():
    """Test that inventory items exist."""
    items = item_service.list_items(active_only=True)
    assert len(items) >= 1, "No items found in inventory"
    return True

@test("Inventory Valuation Matches")
def test_inventory_valuation():
    """Test inventory valuation calculation."""
    dashboard_value = get_inventory_value()
    
    # Calculate from batches
    batches = db.fetch_all("""
        SELECT sb.quantity_in_stock, sb.purchase_price
        FROM stock_batches sb
        WHERE sb.is_active = 1
    """)
    
    calculated_value = sum(batch['quantity_in_stock'] * batch['purchase_price'] for batch in batches)
    
    # Allow small rounding differences
    assert abs(dashboard_value - calculated_value) < 0.01, f"Mismatch: dashboard={dashboard_value}, calculated={calculated_value}"
    return True

@test("Create Purchase Invoice (Credit)")
def test_purchase_credit():
    """Test creating purchase invoice on credit."""
    supplier = get_party("SUPP-001")
    if not supplier:
        print("     ⚠️  SUPP-001 not found, using first supplier")
        suppliers = party_service.list_parties(active_only=True, party_type=PartyType.SUPPLIER)
        supplier = suppliers[0] if suppliers else None
    
    if not supplier:
        print("     ⚠️  No supplier available, skipping test")
        return True
    
    # Find item with stock batch
    batches = db.fetch_all("SELECT item_id, purchase_price FROM stock_batches WHERE is_active = 1 LIMIT 1")
    if not batches:
        print("     ⚠️  No stock batches found, skipping test")
        return True
    
    item_id = batches[0]['item_id']
    unit_cost = float(batches[0]['purchase_price'])
    
    initial_ap = get_account_balance('2000')
    initial_inv = get_inventory_value()
    
    qty = 10
    expected_total = qty * unit_cost
    
    invoice = purchase_service.create_purchase_invoice(
        invoice_number=f"PI-TEST-{len(purchase_service.list_purchase_invoices()) + 1}",
        supplier_id=supplier.id,
        invoice_date="2026-08-07",
        payment_type="CREDIT",
        items=[{"item_id": item_id, "quantity": qty, "unit_cost": unit_cost, "discount_amount": 0, "tax_amount": 0}],
        notes="Test purchase on credit"
    )
    
    final_ap = get_account_balance('2000')
    final_inv = get_inventory_value()
    
    ap_change = final_ap - initial_ap
    inv_change = final_inv - initial_inv
    
    assert abs(ap_change - expected_total) < 0.01, f"AP change incorrect: expected {expected_total}, got {ap_change}"
    assert abs(inv_change - expected_total) < 0.01, f"Inventory change incorrect: expected {expected_total}, got {inv_change}"
    
    return True

@test("Create Purchase Invoice (Cash)")
def test_purchase_cash():
    """Test creating purchase invoice with cash."""
    supplier = get_party("SUPP-001")
    if not supplier:
        suppliers = party_service.list_parties(active_only=True, party_type=PartyType.SUPPLIER)
        supplier = suppliers[0] if suppliers else None
    
    if not supplier:
        print("     ⚠️  No supplier available, skipping test")
        return True
    
    batches = db.fetch_all("SELECT item_id, purchase_price FROM stock_batches WHERE is_active = 1 LIMIT 1")
    if not batches:
        print("     ⚠️  No stock batches found, skipping test")
        return True
    
    item_id = batches[0]['item_id']
    unit_cost = float(batches[0]['purchase_price'])
    
    initial_cash = get_account_balance('1000')
    initial_inv = get_inventory_value()
    
    qty = 5
    expected_total = qty * unit_cost
    
    invoice = purchase_service.create_purchase_invoice(
        invoice_number=f"PI-TEST-{len(purchase_service.list_purchase_invoices()) + 1}",
        supplier_id=supplier.id,
        invoice_date="2026-08-07",
        payment_type="CASH",
        items=[{"item_id": item_id, "quantity": qty, "unit_cost": unit_cost, "discount_amount": 0, "tax_amount": 0}],
        notes="Test purchase with cash"
    )
    
    final_cash = get_account_balance('1000')
    final_inv = get_inventory_value()
    
    cash_change = initial_cash - final_cash
    inv_change = final_inv - initial_inv
    
    assert abs(cash_change - expected_total) < 0.01, f"Cash change incorrect: expected {expected_total}, got {cash_change}"
    assert abs(inv_change - expected_total) < 0.01, f"Inventory change incorrect: expected {expected_total}, got {inv_change}"
    
    return True

@test("Create Sales Invoice (Credit)")
def test_sales_credit():
    """Test creating sales invoice on credit."""
    customer = get_party("CUST-001")
    if not customer:
        customers = party_service.list_parties(active_only=True, party_type=PartyType.CUSTOMER)
        customer = customers[0] if customers else None
    
    if not customer:
        print("     ⚠️  No customer available, skipping test")
        return True
    
    # Find item with stock
    batches = db.fetch_all("""
        SELECT sb.item_id, sb.purchase_price, sb.quantity_in_stock
        FROM stock_batches sb
        WHERE sb.is_active = 1 AND sb.quantity_in_stock > 0
        LIMIT 1
    """)
    
    if not batches:
        print("     ⚠️  No items with stock found, skipping test")
        return True
    
    item_id = batches[0]['item_id']
    unit_cost = float(batches[0]['purchase_price'])
    unit_price = unit_cost * 1.5  # 50% markup
    
    initial_ar = get_account_balance('1100')
    initial_inv = get_inventory_value()
    
    qty = min(5, int(batches[0]['quantity_in_stock']))  # Don't sell more than available
    if qty <= 0:
        print("     ⚠️  Insufficient stock, skipping test")
        return True
    
    expected_revenue = qty * unit_price
    expected_cogs = qty * unit_cost
    
    invoice = sales_service.create_sales_invoice(
        invoice_number=f"SI-TEST-{len(sales_service.list_sales_invoices()) + 1}",
        customer_id=customer.id,
        invoice_date="2026-08-07",
        payment_type="CREDIT",
        items=[{"item_id": item_id, "quantity": qty, "unit_price": unit_price, "discount_amount": 0, "tax_amount": 0}],
        notes="Test sale on credit"
    )
    
    final_ar = get_account_balance('1100')
    final_inv = get_inventory_value()
    
    ar_change = final_ar - initial_ar
    inv_change = initial_inv - final_inv
    
    assert abs(ar_change - expected_revenue) < 0.01, f"AR change incorrect: expected {expected_revenue}, got {ar_change}"
    # Inventory should decrease by COGS
    assert abs(inv_change - expected_cogs) < 0.01, f"Inventory change incorrect: expected {expected_cogs}, got {inv_change}"
    
    return True

@test("Create Sales Invoice (Cash)")
def test_sales_cash():
    """Test creating sales invoice with cash."""
    customer = get_party("CUST-001")
    if not customer:
        customers = party_service.list_parties(active_only=True, party_type=PartyType.CUSTOMER)
        customer = customers[0] if customers else None
    
    if not customer:
        print("     ⚠️  No customer available, skipping test")
        return True
    
    batches = db.fetch_all("""
        SELECT sb.item_id, sb.purchase_price, sb.quantity_in_stock
        FROM stock_batches sb
        WHERE sb.is_active = 1 AND sb.quantity_in_stock > 0
        LIMIT 1
    """)
    
    if not batches:
        print("     ⚠️  No items with stock found, skipping test")
        return True
    
    item_id = batches[0]['item_id']
    unit_cost = float(batches[0]['purchase_price'])
    unit_price = unit_cost * 1.5
    
    initial_cash = get_account_balance('1000')
    initial_inv = get_inventory_value()
    
    qty = min(3, int(batches[0]['quantity_in_stock']))
    if qty <= 0:
        print("     ⚠️  Insufficient stock, skipping test")
        return True
    
    expected_revenue = qty * unit_price
    expected_cogs = qty * unit_cost
    
    invoice = sales_service.create_sales_invoice(
        invoice_number=f"SI-TEST-{len(sales_service.list_sales_invoices()) + 1}",
        customer_id=customer.id,
        invoice_date="2026-08-07",
        payment_type="CASH",
        items=[{"item_id": item_id, "quantity": qty, "unit_price": unit_price, "discount_amount": 0, "tax_amount": 0}],
        notes="Test sale with cash"
    )
    
    final_cash = get_account_balance('1000')
    final_inv = get_inventory_value()
    
    cash_change = final_cash - initial_cash
    inv_change = initial_inv - final_inv
    
    assert abs(cash_change - expected_revenue) < 0.01, f"Cash change incorrect: expected {expected_revenue}, got {cash_change}"
    assert abs(inv_change - expected_cogs) < 0.01, f"Inventory change incorrect: expected {expected_cogs}, got {inv_change}"
    
    return True

# ============================================================
# MAIN
# ============================================================

def main():
    """Run all tests."""
    print("\n" + "="*70)
    print("  COMPREHENSIVE ERP TEST SCRIPT")
    print("  Testing: Inventory, Party, Sales, Purchases & Accounting")
    print("="*70)
    
    try:
        init_services()
        
        print_balances("Initial Balances")
        
        print("\n" + "="*70)
        print("  RUNNING TESTS")
        print("="*70)
        
        # Run all tests
        test_create_customer()
        test_create_supplier()
        test_list_parties()
        test_inventory_exists()
        test_inventory_valuation()
        test_purchase_credit()
        test_purchase_cash()
        test_sales_credit()
        test_sales_cash()
        
        print_balances("Final Balances")
        
        # Summary
        print("\n" + "="*70)
        print("  TEST SUMMARY")
        print("="*70)
        
        passed = len(test_results['passed'])
        failed = len(test_results['failed'])
        total = passed + failed
        
        print(f"\n  Total Tests: {total}")
        print(f"  ✅ Passed: {passed}")
        print(f"  ❌ Failed: {failed}")
        
        if test_results['errors']:
            print("\n  Errors:")
            for name, error in test_results['errors']:
                print(f"    - {name}: {error}")
        
        if failed > 0:
            print("\n  ⚠️  SOME TESTS FAILED - Review errors above")
            print("\n  This indicates bugs in the system that need fixing.")
        else:
            print("\n  🎉 ALL TESTS PASSED!")
        
        print("\n" + "="*70)
        
        sys.exit(0 if failed == 0 else 1)
        
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
