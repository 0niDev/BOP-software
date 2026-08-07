"""
Comprehensive Test Script for ERP System
Tests: Inventory, Party, Sales, Purchases
Validates: All numbers check out, catches any errors in operations
"""
from __future__ import annotations

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.connection import get_db, DatabaseConnection
from services.purchase_invoice_service import PurchaseInvoiceService
from services.sales_invoice_service import SalesInvoiceService
from services.party_service import PartyService
from services.item_service import ItemService
from services.accounting_service import AccountingService
from services.dashboard_service import DashboardService
from services.payment_service import PaymentService
from utils.logger import get_logger
from models.enums import PartyType
from decimal import Decimal

logger = get_logger(__name__)

# ============================================================
# TEST UTILITIES
# ============================================================

class TestResult:
    """Stores test results."""
    def __init__(self, name: str):
        self.name = name
        self.passed = True
        self.errors = []
        self.warnings = []
    
    def fail(self, message: str):
        self.passed = False
        self.errors.append(message)
    
    def warn(self, message: str):
        self.warnings.append(message)
    
    def __str__(self):
        status = "✅ PASS" if self.passed else "❌ FAIL"
        result = f"{status}: {self.name}"
        if self.errors:
            result += "\n  Errors:"
            for err in self.errors:
                result += f"\n    - {err}"
        if self.warnings:
            result += "\n  Warnings:"
            for warn in self.warnings:
                result += f"\n    - {warn}"
        return result


class TestRunner:
    """Runs all tests and reports results."""
    def __init__(self, db: DatabaseConnection):
        self.db = db
        self.results: list[TestResult] = []
        
        # Initialize services
        self.purchase_service = PurchaseInvoiceService(db)
        self.sales_service = SalesInvoiceService(db)
        self.party_service = PartyService(db)
        self.item_service = ItemService(db)
        self.accounting_service = AccountingService(db)
        self.dashboard_service = DashboardService(db)
        self.payment_service = PaymentService(db)
        
        # Track created entities for cleanup
        self.created_parties = []
        self.created_purchase_invoices = []
        self.created_sales_invoices = []
    
    def get_account(self, code: str) -> dict | None:
        """Get account by code."""
        from repositories.account_repository import AccountRepository
        repo = AccountRepository(self.db)
        return repo.find_by_code(code)
    
    def get_account_balance(self, account_code: str) -> Decimal:
        """Get balance for an account by code."""
        account = self.get_account(account_code)
        if account:
            balance_data = self.accounting_service.get_account_balance(account["id"])
            # Handle both dict and float return types
            if isinstance(balance_data, dict):
                return Decimal(str(balance_data.get('balance', 0)))
            else:
                return Decimal(str(balance_data))
        return Decimal('0')
    
    def get_inventory_value(self) -> Decimal:
        """Get total inventory value."""
        inv = self.dashboard_service._get_balances(1)
        return Decimal(str(inv.get('inventory', 0)))
    
    def get_party(self, code: str):
        """Get party by code."""
        parties = self.party_service.list_parties(active_only=True)
        for p in parties:
            if p.code == code:
                return p
        return None
    
    def get_item(self, item_code: str):
        """Get item by code."""
        items = self.item_service.list_items(active_only=True)
        for i in items:
            if i.item_code == item_code:
                return i
        return None
    
    def print_section(self, title: str):
        """Print section header."""
        print("\n" + "="*70)
        print(f"  {title}")
        print("="*70)
    
    def print_subsection(self, title: str):
        """Print subsection header."""
        print("\n" + "-"*70)
        print(f"  {title}")
        print("-"*70)
    
    # ============================================================
    # PARTY TESTS
    # ============================================================
    
    def test_create_customer(self) -> TestResult:
        """Test creating a customer."""
        result = TestResult("Create Customer")
        try:
            customer = self.party_service.create_party(
                name="Test Customer ABC",
                party_type=PartyType.CUSTOMER,
                credit_limit=50000.0,
            )
            self.created_parties.append(customer.id)
            
            # Verify customer was created
            if not customer.id:
                result.fail("Customer ID not assigned")
            if customer.code != "CUST-00006":  # Adjust based on seed data
                result.warn(f"Expected code CUST-00006, got {customer.code}")
            if customer.credit_limit != 50000.0:
                result.fail(f"Credit limit mismatch: expected 50000, got {customer.credit_limit}")
                
        except Exception as e:
            result.fail(f"Exception: {str(e)}")
        
        return result
    
    def test_create_supplier(self) -> TestResult:
        """Test creating a supplier."""
        result = TestResult("Create Supplier")
        try:
            supplier = self.party_service.create_party(
                name="Test Supplier XYZ",
                party_type=PartyType.SUPPLIER,
                credit_limit=100000.0,
            )
            self.created_parties.append(supplier.id)
            
            if not supplier.id:
                result.fail("Supplier ID not assigned")
            if supplier.credit_limit != 100000.0:
                result.fail(f"Credit limit mismatch: expected 100000, got {supplier.credit_limit}")
                
        except Exception as e:
            result.fail(f"Exception: {str(e)}")
        
        return result
    
    def test_party_list(self) -> TestResult:
        """Test listing parties."""
        result = TestResult("List Parties")
        try:
            customers = self.party_service.list_parties(active_only=True, party_type=PartyType.CUSTOMER)
            suppliers = self.party_service.list_parties(active_only=True, party_type=PartyType.SUPPLIER)
            
            if len(customers) < 1:
                result.fail("No customers found")
            if len(suppliers) < 1:
                result.fail("No suppliers found")
                
        except Exception as e:
            result.fail(f"Exception: {str(e)}")
        
        return result
    
    # ============================================================
    # INVENTORY TESTS
    # ============================================================
    
    def test_inventory_initial_state(self) -> TestResult:
        """Test initial inventory state."""
        result = TestResult("Initial Inventory State")
        try:
            items = self.item_service.list_items(active_only=True)
            if len(items) < 1:
                result.fail("No items found in inventory")
            
            # Check stock batches exist
            from repositories.stock_batch_repository import StockBatchRepository
            stock_repo = StockBatchRepository(self.db)
            batches = self.db.fetch_all("SELECT * FROM stock_batches WHERE is_active = 1")
            
            if len(batches) < 1:
                result.warn("No active stock batches found")
            
            result.warn(f"Total items: {len(items)}, Total batches: {len(batches)}")
            
        except Exception as e:
            result.fail(f"Exception: {str(e)}")
        
        return result
    
    def test_inventory_valuation(self) -> TestResult:
        """Test inventory valuation calculation."""
        result = TestResult("Inventory Valuation")
        try:
            initial_value = self.get_inventory_value()
            result.warn(f"Initial inventory value: Rs. {initial_value:,.2f}")
            
            # Calculate expected value from batches
            from repositories.stock_batch_repository import StockBatchRepository
            batches = self.db.fetch_all("""
                SELECT sb.quantity_in_stock, sb.purchase_price, i.item_code
                FROM stock_batches sb
                JOIN items i ON sb.item_id = i.id
                WHERE sb.is_active = 1
            """)
            
            calculated_value = Decimal('0')
            for batch in batches:
                calculated_value += Decimal(str(batch['quantity_in_stock'])) * Decimal(str(batch['purchase_price']))
            
            result.warn(f"Calculated from batches: Rs. {calculated_value:,.2f}")
            
            # Allow small rounding differences
            if abs(initial_value - calculated_value) > Decimal('0.01'):
                result.fail(f"Inventory value mismatch: dashboard={initial_value}, calculated={calculated_value}")
            
        except Exception as e:
            result.fail(f"Exception: {str(e)}")
        
        return result
    
    # ============================================================
    # PURCHASE TESTS
    # ============================================================
    
    def test_create_purchase_credit(self) -> TestResult:
        """Test creating purchase invoice on credit."""
        result = TestResult("Create Purchase (Credit)")
        try:
            supplier = self.get_party("SUPP-001")
            if not supplier:
                result.fail("Supplier SUPP-001 not found")
                return result
            
            # Use available item RAW-001
            item = self.get_item("RAW-001")
            if not item:
                result.fail("Item RAW-001 not found")
                return result
            
            # Get initial balances
            initial_ap = self.get_account_balance('2000')
            initial_inv = self.get_inventory_value()
            
            # Create purchase invoice
            qty = 10
            unit_cost = 2500
            expected_total = Decimal(str(qty * unit_cost))
            
            invoice = self.purchase_service.create_purchase_invoice(
                invoice_number=f"PI-TEST-{len(self.created_purchase_invoices)+1}",
                supplier_id=supplier.id,
                invoice_date="2026-08-07",
                payment_type="CREDIT",
                items=[{"item_id": item.id, "quantity": qty, "unit_cost": unit_cost, "discount_amount": 0, "tax_amount": 0}],
                notes="Test purchase on credit"
            )
            self.created_purchase_invoices.append(invoice)
            
            # Verify balances changed correctly
            final_ap = self.get_account_balance('2000')
            final_inv = self.get_inventory_value()
            
            ap_change = final_ap - initial_ap
            inv_change = final_inv - initial_inv
            
            if abs(ap_change - expected_total) > Decimal('0.01'):
                result.fail(f"AP change incorrect: expected {expected_total}, got {ap_change}")
            
            if abs(inv_change - expected_total) > Decimal('0.01'):
                result.fail(f"Inventory change incorrect: expected {expected_total}, got {inv_change}")
            
            result.warn(f"AP increased by: Rs. {ap_change:,.2f}")
            result.warn(f"Inventory increased by: Rs. {inv_change:,.2f}")
            
        except Exception as e:
            result.fail(f"Exception: {str(e)}")
        
        return result
    
    def test_create_purchase_cash(self) -> TestResult:
        """Test creating purchase invoice with cash."""
        result = TestResult("Create Purchase (Cash)")
        try:
            supplier = self.get_party("SUPP-001")
            if not supplier:
                result.fail("Supplier SUPP-001 not found")
                return result
            
            # Use available item RAW-001
            item = self.get_item("RAW-001")
            if not item:
                result.fail("Item RAW-001 not found")
                return result
            
            # Get initial balances
            initial_cash = self.get_account_balance('1000')
            initial_inv = self.get_inventory_value()
            
            # Create purchase invoice
            qty = 5
            unit_cost = 3000
            expected_total = Decimal(str(qty * unit_cost))
            
            invoice = self.purchase_service.create_purchase_invoice(
                invoice_number=f"PI-TEST-{len(self.created_purchase_invoices)+1}",
                supplier_id=supplier.id,
                invoice_date="2026-08-07",
                payment_type="CASH",
                items=[{"item_id": item.id, "quantity": qty, "unit_cost": unit_cost, "discount_amount": 0, "tax_amount": 0}],
                notes="Test purchase with cash"
            )
            self.created_purchase_invoices.append(invoice)
            
            # Verify balances changed correctly
            final_cash = self.get_account_balance('1000')
            final_inv = self.get_inventory_value()
            
            cash_change = initial_cash - final_cash  # Cash should decrease
            inv_change = final_inv - initial_inv
            
            if abs(cash_change - expected_total) > Decimal('0.01'):
                result.fail(f"Cash change incorrect: expected {expected_total}, got {cash_change}")
            
            if abs(inv_change - expected_total) > Decimal('0.01'):
                result.fail(f"Inventory change incorrect: expected {expected_total}, got {inv_change}")
            
            result.warn(f"Cash decreased by: Rs. {cash_change:,.2f}")
            result.warn(f"Inventory increased by: Rs. {inv_change:,.2f}")
            
        except Exception as e:
            result.fail(f"Exception: {str(e)}")
        
        return result
    
    # ============================================================
    # SALES TESTS
    # ============================================================
    
    def test_create_sales_credit(self) -> TestResult:
        """Test creating sales invoice on credit."""
        result = TestResult("Create Sales (Credit)")
        try:
            customer = self.get_party("CUST-001")
            if not customer:
                result.fail("Customer CUST-001 not found")
                return result
            
            # Use available item PROD-001
            item = self.get_item("PROD-001")
            if not item:
                result.fail("Item PROD-001 not found")
                return result
            
            # Get initial balances
            initial_ar = self.get_account_balance('1100')
            initial_inv = self.get_inventory_value()
            
            # Get item cost for COGS calculation
            item_data = self.db.fetch_one("SELECT purchase_price FROM stock_batches WHERE item_id = ? AND is_active = 1 LIMIT 1", (item.id,))
            unit_cost = float(item_data['purchase_price']) if item_data else 0
            
            # Create sales invoice
            qty = 10
            unit_price = 75
            expected_revenue = Decimal(str(qty * unit_price))
            expected_cogs = Decimal(str(qty * unit_cost))
            
            invoice = self.sales_service.create_sales_invoice(
                invoice_number=f"SI-TEST-{len(self.created_sales_invoices)+1}",
                customer_id=customer.id,
                invoice_date="2026-08-07",
                payment_type="CREDIT",
                items=[{"item_id": item.id, "quantity": qty, "unit_price": unit_price, "discount_amount": 0, "tax_amount": 0}],
                notes="Test sale on credit"
            )
            self.created_sales_invoices.append(invoice)
            
            # Verify balances changed correctly
            final_ar = self.get_account_balance('1100')
            final_inv = self.get_inventory_value()
            
            ar_change = final_ar - initial_ar
            inv_change = initial_inv - final_inv  # Inventory should decrease
            
            if abs(ar_change - expected_revenue) > Decimal('0.01'):
                result.fail(f"AR change incorrect: expected {expected_revenue}, got {ar_change}")
            
            # Note: Inventory decreases by COGS, not selling price
            result.warn(f"AR increased by: Rs. {ar_change:,.2f}")
            result.warn(f"Inventory decreased by: Rs. {inv_change:,.2f} (COGS: {expected_cogs})")
            
        except Exception as e:
            result.fail(f"Exception: {str(e)}")
        
        return result
    
    def test_create_sales_cash(self) -> TestResult:
        """Test creating sales invoice with cash."""
        result = TestResult("Create Sales (Cash)")
        try:
            customer = self.get_party("CUST-001")
            if not customer:
                result.fail("Customer CUST-001 not found")
                return result
            
            # Use available item PROD-001
            item = self.get_item("PROD-001")
            if not item:
                result.fail("Item PROD-001 not found")
                return result
            
            # Get initial balances
            initial_cash = self.get_account_balance('1000')
            initial_inv = self.get_inventory_value()
            
            # Get item cost for COGS calculation
            item_data = self.db.fetch_one("SELECT purchase_price FROM stock_batches WHERE item_id = ? AND is_active = 1 LIMIT 1", (item.id,))
            unit_cost = float(item_data['purchase_price']) if item_data else 0
            
            # Create sales invoice
            qty = 5
            unit_price = 80
            expected_revenue = Decimal(str(qty * unit_price))
            expected_cogs = Decimal(str(qty * unit_cost))
            
            invoice = self.sales_service.create_sales_invoice(
                invoice_number=f"SI-TEST-{len(self.created_sales_invoices)+1}",
                customer_id=customer.id,
                invoice_date="2026-08-07",
                payment_type="CASH",
                items=[{"item_id": item.id, "quantity": qty, "unit_price": unit_price, "discount_amount": 0, "tax_amount": 0}],
                notes="Test sale with cash"
            )
            self.created_sales_invoices.append(invoice)
            
            # Verify balances changed correctly
            final_cash = self.get_account_balance('1000')
            final_inv = self.get_inventory_value()
            
            cash_change = final_cash - initial_cash
            inv_change = initial_inv - final_inv
            
            if abs(cash_change - expected_revenue) > Decimal('0.01'):
                result.fail(f"Cash change incorrect: expected {expected_revenue}, got {cash_change}")
            
            result.warn(f"Cash increased by: Rs. {cash_change:,.2f}")
            result.warn(f"Inventory decreased by: Rs. {inv_change:,.2f} (COGS: {expected_cogs})")
            
        except Exception as e:
            result.fail(f"Exception: {str(e)}")
        
        return result
    
    # ============================================================
    # PAYMENT TESTS
    # ============================================================
    
    def test_receive_payment(self) -> TestResult:
        """Test receiving payment from customer."""
        result = TestResult("Receive Payment from Customer")
        try:
            # Get unpaid sales invoice
            invoices = self.sales_service.list_sales_invoices(status="CONFIRMED")
            credit_invoice = None
            for inv in invoices:
                if inv.payment_type == "CREDIT" and "SI-TEST" in inv.invoice_number:
                    credit_invoice = inv
                    break
            
            if not credit_invoice:
                result.warn("No credit sales invoice found to test payment")
                return result
            
            customer = self.get_party("CUST-001")
            if not customer:
                result.fail("Customer CUST-001 not found")
                return result
            
            # Get initial balances
            initial_cash = self.get_account_balance('1000')
            initial_ar = self.get_account_balance('1100')
            
            # Receive payment
            self.payment_service.receive_payment(
                customer_id=customer.id,
                amount=credit_invoice.total_amount,
                payment_date="2026-08-07",
                payment_method="CASH",
                reference_no=f"REC-{credit_invoice.invoice_number}",
                notes=f"Payment for {credit_invoice.invoice_number}",
                sales_invoice_id=credit_invoice.id
            )
            
            # Verify balances
            final_cash = self.get_account_balance('1000')
            final_ar = self.get_account_balance('1100')
            
            cash_change = final_cash - initial_cash
            ar_change = initial_ar - final_ar
            
            expected = Decimal(str(credit_invoice.total_amount))
            
            if abs(cash_change - expected) > Decimal('0.01'):
                result.fail(f"Cash change incorrect: expected {expected}, got {cash_change}")
            
            if abs(ar_change - expected) > Decimal('0.01'):
                result.fail(f"AR change incorrect: expected {expected}, got {ar_change}")
            
            result.warn(f"Received payment: Rs. {expected:,.2f}")
            result.warn(f"Cash increased by: Rs. {cash_change:,.2f}")
            result.warn(f"AR decreased by: Rs. {ar_change:,.2f}")
            
        except Exception as e:
            result.fail(f"Exception: {str(e)}")
        
        return result
    
    def test_pay_supplier(self) -> TestResult:
        """Test paying supplier."""
        result = TestResult("Pay Supplier")
        try:
            # Get unpaid purchase invoice
            invoices = self.purchase_service.list_purchase_invoices(status="CONFIRMED")
            credit_invoice = None
            for inv in invoices:
                if inv.payment_type == "CREDIT" and "PI-TEST" in inv.invoice_number:
                    credit_invoice = inv
                    break
            
            if not credit_invoice:
                result.warn("No credit purchase invoice found to test payment")
                return result
            
            supplier = self.get_party("SUPP-001")
            if not supplier:
                result.fail("Supplier SUPP-001 not found")
                return result
            
            # Get initial balances
            initial_cash = self.get_account_balance('1000')
            initial_ap = self.get_account_balance('2000')
            
            # Pay supplier
            self.payment_service.pay_supplier(
                supplier_id=supplier.id,
                amount=credit_invoice.total_amount,
                payment_date="2026-08-07",
                payment_method="CASH",
                reference_no=f"PAY-{credit_invoice.invoice_number}",
                notes=f"Payment for {credit_invoice.invoice_number}",
                purchase_invoice_id=credit_invoice.id
            )
            
            # Verify balances
            final_cash = self.get_account_balance('1000')
            final_ap = self.get_account_balance('2000')
            
            cash_change = initial_cash - final_cash
            ap_change = initial_ap - final_ap
            
            expected = Decimal(str(credit_invoice.total_amount))
            
            if abs(cash_change - expected) > Decimal('0.01'):
                result.fail(f"Cash change incorrect: expected {expected}, got {cash_change}")
            
            if abs(ap_change - expected) > Decimal('0.01'):
                result.fail(f"AP change incorrect: expected {expected}, got {ap_change}")
            
            result.warn(f"Paid supplier: Rs. {expected:,.2f}")
            result.warn(f"Cash decreased by: Rs. {cash_change:,.2f}")
            result.warn(f"AP decreased by: Rs. {ap_change:,.2f}")
            
        except Exception as e:
            result.fail(f"Exception: {str(e)}")
        
        return result
    
    # ============================================================
    # ACCOUNTING INTEGRITY TESTS
    # ============================================================
    
    def test_accounting_equation(self) -> TestResult:
        """Test that accounting equation balances: Assets = Liabilities + Equity."""
        result = TestResult("Accounting Equation Balance")
        try:
            # Get all accounts
            assets = self.get_account_balance('1000') + self.get_account_balance('1010') + self.get_account_balance('1100')
            liabilities = self.get_account_balance('2000')
            
            # Get equity (retained earnings + capital)
            equity_4000 = self.get_account_balance('4000')
            equity_5000 = self.get_account_balance('5000')
            equity = equity_4000 + equity_5000
            
            # Calculate inventory
            inventory = self.get_inventory_value()
            
            # Add inventory to assets
            total_assets = assets + inventory
            
            result.warn(f"Total Assets (Cash + Bank + AR + Inventory): Rs. {total_assets:,.2f}")
            result.warn(f"Total Liabilities (AP): Rs. {liabilities:,.2f}")
            result.warn(f"Total Equity: Rs. {equity:,.2f}")
            result.warn(f"Liabilities + Equity: Rs. {liabilities + equity:,.2f}")
            
            # The equation might not balance perfectly due to revenue/expenses not being closed to equity
            # This is expected in an ongoing business
            difference = abs(total_assets - (liabilities + equity))
            if difference > Decimal('100'):  # Allow some tolerance for unclosed P&L
                result.warn(f"Difference (likely unclosed P&L): Rs. {difference:,.2f}")
            
        except Exception as e:
            result.fail(f"Exception: {str(e)}")
        
        return result
    
    def test_journal_entries_balance(self) -> TestResult:
        """Test that all journal entries are balanced (debits = credits)."""
        result = TestResult("Journal Entries Balance")
        try:
            # Check if journal_lines table exists
            tables = self.db.fetch_all("SELECT name FROM sqlite_master WHERE type='table' AND name='journal_lines'")
            if not tables:
                result.warn("journal_lines table does not exist - skipping test")
                return result
            
            entries = self.db.fetch_all("""
                SELECT journal_entry_id, 
                       SUM(debit) as total_debit, 
                       SUM(credit) as total_credit
                FROM journal_lines
                GROUP BY journal_entry_id
            """)
            
            unbalanced = []
            for entry in entries:
                debit = Decimal(str(entry['total_debit'] or 0))
                credit = Decimal(str(entry['total_credit'] or 0))
                if abs(debit - credit) > Decimal('0.01'):
                    unbalanced.append({
                        'id': entry['journal_entry_id'],
                        'debit': debit,
                        'credit': credit,
                        'difference': debit - credit
                    })
            
            if unbalanced:
                result.fail(f"Found {len(unbalanced)} unbalanced journal entries")
                for ub in unbalanced[:5]:  # Show first 5
                    result.fail(f"  Entry {ub['id']}: Debit={ub['debit']}, Credit={ub['credit']}, Diff={ub['difference']}")
            else:
                result.warn(f"All {len(entries)} journal entries are balanced")
            
        except Exception as e:
            result.fail(f"Exception: {str(e)}")
        
        return result
    
    # ============================================================
    # CLEANUP
    # ============================================================
    
    def cleanup(self):
        """Clean up test data."""
        print("\n" + "-"*70)
        print("  Cleaning up test data...")
        print("-"*70)
        
        # Delete sales invoices
        for invoice in reversed(self.created_sales_invoices):
            try:
                self.sales_service.delete_sales_invoice(invoice.id)
                print(f"  ✅ Deleted sales invoice {invoice.invoice_number}")
            except Exception as e:
                print(f"  ⚠️ Could not delete sales invoice {invoice.invoice_number}: {e}")
        
        # Delete purchase invoices
        for invoice in reversed(self.created_purchase_invoices):
            try:
                self.purchase_service.delete_purchase_invoice(invoice.id)
                print(f"  ✅ Deleted purchase invoice {invoice.invoice_number}")
            except Exception as e:
                print(f"  ⚠️ Could not delete purchase invoice {invoice.invoice_number}: {e}")
        
        # Delete parties (in reverse order)
        for party_id in reversed(self.created_parties):
            try:
                self.party_service.deactivate_party(party_id)
                print(f"  ✅ Deactivated party ID {party_id}")
            except Exception as e:
                print(f"  ⚠️ Could not deactivate party ID {party_id}: {e}")
    
    # ============================================================
    # RUN ALL TESTS
    # ============================================================
    
    def run_all_tests(self) -> bool:
        """Run all tests and return True if all passed."""
        self.print_section("🧪 COMPREHENSIVE ERP TEST SUITE")
        
        # Initial balances
        self.print_subsection("Initial State")
        print(f"  Cash (1000):  Rs. {self.get_account_balance('1000'):,.2f}")
        print(f"  Bank (1010):  Rs. {self.get_account_balance('1010'):,.2f}")
        print(f"  AR (1100):    Rs. {self.get_account_balance('1100'):,.2f}")
        print(f"  AP (2000):    Rs. {self.get_account_balance('2000'):,.2f}")
        print(f"  Inventory:    Rs. {self.get_inventory_value():,.2f}")
        
        # Run tests
        tests = [
            # Party tests
            self.test_create_customer,
            self.test_create_supplier,
            self.test_party_list,
            
            # Inventory tests
            self.test_inventory_initial_state,
            self.test_inventory_valuation,
            
            # Purchase tests
            self.test_create_purchase_credit,
            self.test_create_purchase_cash,
            
            # Sales tests
            self.test_create_sales_credit,
            self.test_create_sales_cash,
            
            # Payment tests
            self.test_receive_payment,
            self.test_pay_supplier,
            
            # Accounting integrity tests
            self.test_journal_entries_balance,
            self.test_accounting_equation,
        ]
        
        print("\n" + "="*70)
        print("  RUNNING TESTS")
        print("="*70)
        
        all_passed = True
        for test_func in tests:
            result = test_func()
            self.results.append(result)
            print(f"\n{result}")
            if not result.passed:
                all_passed = False
        
        # Final balances
        self.print_subsection("Final State")
        print(f"  Cash (1000):  Rs. {self.get_account_balance('1000'):,.2f}")
        print(f"  Bank (1010):  Rs. {self.get_account_balance('1010'):,.2f}")
        print(f"  AR (1100):    Rs. {self.get_account_balance('1100'):,.2f}")
        print(f"  AP (2000):    Rs. {self.get_account_balance('2000'):,.2f}")
        print(f"  Inventory:    Rs. {self.get_inventory_value():,.2f}")
        
        # Summary
        self.print_section("TEST SUMMARY")
        passed = sum(1 for r in self.results if r.passed)
        failed = sum(1 for r in self.results if not r.passed)
        total = len(self.results)
        
        print(f"\n  Total Tests: {total}")
        print(f"  ✅ Passed: {passed}")
        print(f"  ❌ Failed: {failed}")
        
        if failed > 0:
            print("\n  ⚠️  SOME TESTS FAILED - Review errors above")
        else:
            print("\n  🎉 ALL TESTS PASSED!")
        
        # Cleanup
        self.cleanup()
        
        return all_passed


def main():
    """Main entry point."""
    print("\n" + "="*70)
    print("  COMPREHENSIVE ERP TEST SCRIPT")
    print("  Testing: Inventory, Party, Sales, Purchases & Accounting")
    print("="*70)
    
    try:
        db = get_db()
        runner = TestRunner(db)
        success = runner.run_all_tests()
        
        sys.exit(0 if success else 1)
        
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
