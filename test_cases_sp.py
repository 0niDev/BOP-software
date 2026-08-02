"""Test edge cases - multiple payment type changes (FIXED)."""
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

db = get_db()
purchase_service = PurchaseInvoiceService(db)
sales_service = SalesInvoiceService(db)
party_service = PartyService(db)
item_service = ItemService(db)
accounting_service = AccountingService(db)
dashboard_service = DashboardService(db)

def get_account(code):
    from repositories.account_repository import AccountRepository
    repo = AccountRepository(db)
    return repo.find_by_code(code)

def get_item(item_code):
    items = item_service.list_items(active_only=True)
    for i in items:
        if i.item_code == item_code:
            return i
    return None

def get_party(party_code):
    parties = party_service.list_parties(active_only=True)
    for p in parties:
        if p.code == party_code:
            return p
    return None

def get_balance(account_code):
    account = get_account(account_code)
    if account:
        return accounting_service.get_account_balance(account["id"])
    return 0

def print_balances():
    """Print current balances for all key accounts."""
    print("\n" + "="*60)
    print("📊 CURRENT BALANCES")
    print("="*60)
    print(f"  Cash (1000):  Rs. {get_balance('1000'):,.2f}")
    print(f"  Bank (1010):  Rs. {get_balance('1010'):,.2f}")
    print(f"  AR (1100):    Rs. {get_balance('1100'):,.2f}")
    print(f"  AP (2000):    Rs. {get_balance('2000'):,.2f}")
    inv = dashboard_service._get_balances(1)
    print(f"  Inventory:    Rs. {inv['inventory']:,.2f}")
    print("="*60)


def test_purchase_payment_type_changes():
    """Test multiple payment type changes on purchase invoices."""
    print("\n" + "="*60)
    print("🛒 TEST: PURCHASE - MULTIPLE PAYMENT TYPE CHANGES")
    print("="*60)
    
    supplier = get_party("SUPP-001")
    item = get_item("RAW-MET-001")
    
    if not supplier or not item:
        print("❌ Test data not found. Run seed_data.py first.")
        return
    
    print(f"\n📋 Using Supplier: {supplier.name}")
    print(f"📋 Using Item: {item.item_name}")
    
    initial_cash = get_balance('1000')
    initial_ap = get_balance('2000')
    
    print("\n📊 Initial Balances:")
    print(f"  Cash: Rs. {initial_cash:,.2f}")
    print(f"  AP: Rs. {initial_ap:,.2f}")
    
    test_invoices = []
    
    # ============================================================
    # TEST: CREDIT → CASH → CREDIT (Should work)
    # ============================================================
    print("\n" + "-"*60)
    print("📋 TEST: CREDIT → CASH → CREDIT")
    print("-"*60)
    
    try:
        invoice = purchase_service.create_purchase_invoice(
            invoice_number="PI-EDGE-001",
            supplier_id=supplier.id,
            invoice_date="2026-07-23",
            payment_type="CREDIT",
            items=[{"item_id": item.id, "quantity": 10, "unit_cost": 2500, "discount_amount": 0, "tax_amount": 0}],
            notes="Test - Initial Credit"
        )
        test_invoices.append(invoice)
        print(f"  ✅ Created invoice as CREDIT: {invoice.invoice_number}")
        
        # Change to CASH
        purchase_service.update_purchase_invoice(
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            supplier_id=supplier.id,
            invoice_date="2026-07-23",
            payment_type="CASH",
            items=[{"item_id": item.id, "quantity": 10, "unit_cost": 2500, "discount_amount": 0, "tax_amount": 0}],
            notes="Test - Changed to CASH",
            status="CONFIRMED"
        )
        print(f"  ✅ Changed to CASH")
        
        # Change back to CREDIT
        purchase_service.update_purchase_invoice(
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            supplier_id=supplier.id,
            invoice_date="2026-07-23",
            payment_type="CREDIT",
            items=[{"item_id": item.id, "quantity": 10, "unit_cost": 2500, "discount_amount": 0, "tax_amount": 0}],
            notes="Test - Changed back to CREDIT",
            status="CONFIRMED"
        )
        print(f"  ✅ Changed back to CREDIT")
        
        # Verify
        final_cash = get_balance('1000')
        final_ap = get_balance('2000')
        
        if abs(final_ap - initial_ap - 25000) < 0.01:
            print("  ✅ AP correct (increased by 25,000)")
        else:
            print(f"  ❌ AP not correct. Expected: {initial_ap + 25000:.2f}, Got: {final_ap:.2f}")
            
        if abs(final_cash - initial_cash) < 0.01:
            print("  ✅ Cash correct (returned to original)")
        else:
            print(f"  ❌ Cash not correct. Expected: {initial_cash:.2f}, Got: {final_cash:.2f}")
            
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # ============================================================
    # TEST: Should NOT allow CREDIT → CASH when paid
    # ============================================================
    print("\n" + "-"*60)
    print("📋 TEST: CREDIT → CASH (Should fail if paid)")
    print("-"*60)
    
    try:
        # Create a credit invoice
        invoice2 = purchase_service.create_purchase_invoice(
            invoice_number="PI-EDGE-002",
            supplier_id=supplier.id,
            invoice_date="2026-07-23",
            payment_type="CREDIT",
            items=[{"item_id": item.id, "quantity": 5, "unit_cost": 2500, "discount_amount": 0, "tax_amount": 0}],
            notes="Test - Credit for payment test"
        )
        test_invoices.append(invoice2)
        print(f"  ✅ Created invoice as CREDIT: {invoice2.invoice_number}")
        
        # Pay it
        from services.payment_service import PaymentService
        payment_service = PaymentService(db)
        payment_service.pay_supplier(
            supplier_id=supplier.id,
            amount=invoice2.total_amount,
            payment_date="2026-07-23",
            payment_method="CASH",
            reference_no=f"PAY-{invoice2.invoice_number}",
            notes=f"Payment for {invoice2.invoice_number}",
            purchase_invoice_id=invoice2.id  # ← ADD THIS!
        )
        print(f"  ✅ Paid invoice: Rs. {invoice2.total_amount:,.2f}")
        
        # Try to change to CASH (should fail)
        try:
            purchase_service.update_purchase_invoice(
                invoice_id=invoice2.id,
                invoice_number=invoice2.invoice_number,
                supplier_id=supplier.id,
                invoice_date="2026-07-23",
                payment_type="CASH",
                items=[{"item_id": item.id, "quantity": 5, "unit_cost": 2500, "discount_amount": 0, "tax_amount": 0}],
                notes="Test - Should fail",
                status="CONFIRMED"
            )
            print("  ❌ Should have failed! Invoice is paid but changed anyway.")
        except Exception as e:
            print(f"  ✅ Correctly failed: {e}")
            
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Clean up
    print("\n🧹 Cleaning up test invoices...")
    for inv in test_invoices:
        try:
            purchase_service.delete_purchase_invoice(inv.id)
            print(f"  ✅ Deleted {inv.invoice_number}")
        except Exception as e:
            print(f"  ⚠️ Could not delete {inv.invoice_number}: {e}")
    
    print("\n✅ Purchase tests complete!")


def test_sales_payment_type_changes():
    """Test multiple payment type changes on sales invoices."""
    print("\n" + "="*60)
    print("🧾 TEST: SALES - MULTIPLE PAYMENT TYPE CHANGES")
    print("="*60)
    
    customer = get_party("CUST-001")
    item = get_item("PARA-500MG")
    
    if not customer or not item:
        print("❌ Test data not found. Run seed_data.py first.")
        return
    
    print(f"\n📋 Using Customer: {customer.name}")
    print(f"📋 Using Item: {item.item_name}")
    
    initial_cash = get_balance('1000')
    initial_ar = get_balance('1100')
    
    print("\n📊 Initial Balances:")
    print(f"  Cash: Rs. {initial_cash:,.2f}")
    print(f"  AR: Rs. {initial_ar:,.2f}")
    
    test_invoices = []
    
    # ============================================================
    # TEST: CREDIT → CASH (Should fail if paid)
    # ============================================================
    print("\n" + "-"*60)
    print("📋 TEST: CREDIT → CASH (Should fail if paid)")
    print("-"*60)
    
    try:
        invoice = sales_service.create_sales_invoice(
            invoice_number="SI-EDGE-001",
            customer_id=customer.id,
            invoice_date="2026-07-23",
            payment_type="CREDIT",
            items=[{"item_id": item.id, "quantity": 10, "unit_price": 75, "discount_amount": 0, "tax_amount": 0}],
            notes="Test - Initial Credit"
        )
        test_invoices.append(invoice)
        print(f"  ✅ Created invoice as CREDIT: {invoice.invoice_number}")
        
        # Receive payment
        from services.payment_service import PaymentService
        payment_service = PaymentService(db)
        payment_service.receive_payment(
            customer_id=customer.id,
            amount=invoice.total_amount,
            payment_date="2026-07-23",
            payment_method="CASH",
            reference_no=f"REC-{invoice.invoice_number}",
            notes=f"Payment for {invoice.invoice_number}",
            sales_invoice_id=invoice.id  # ← ADD THIS!
        )
        print(f"  ✅ Received payment of Rs. {invoice.total_amount:,.2f}")
        
        # Try to change to CASH (should fail)
        try:
            sales_service.update_sales_invoice(
                invoice_id=invoice.id,
                invoice_number=invoice.invoice_number,
                customer_id=customer.id,
                invoice_date="2026-07-23",
                payment_type="CASH",
                items=[{"item_id": item.id, "quantity": 10, "unit_price": 75, "discount_amount": 0, "tax_amount": 0}],
                notes="Test - Should fail",
                status="CONFIRMED"
            )
            print("  ❌ Should have failed! Invoice is paid but changed anyway.")
        except Exception as e:
            print(f"  ✅ Correctly failed: {e}")
            
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Clean up
    print("\n🧹 Cleaning up test invoices...")
    for inv in test_invoices:
        try:
            sales_service.delete_sales_invoice(inv.id)
            print(f"  ✅ Deleted {inv.invoice_number}")
        except Exception as e:
            print(f"  ⚠️ Could not delete {inv.invoice_number}: {e}")
    
    print("\n✅ Sales tests complete!")


def run_all_tests():
    """Run all edge case tests."""
    print("\n" + "="*60)
    print("🧪 RUNNING EDGE CASE TESTS")
    print("="*60)
    
    print_balances()
    test_purchase_payment_type_changes()
    test_sales_payment_type_changes()
    print_balances()
    
    print("\n" + "="*60)
    print("✅ ALL TESTS COMPLETE")
    print("="*60)


if __name__ == "__main__":
    run_all_tests()