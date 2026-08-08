#!/usr/bin/env python3
"""
Test script to verify purchase invoice update error fix.

This script tests the fix for the TypeError that occurred when updating
a purchase invoice due to the Party model not having the customer_category
field that exists in the database.

Error fixed:
    TypeError: __init__() got an unexpected keyword argument 'customer_category'

The issue was that the Party dataclass model was missing fields that exist
in the database schema (customer_category and opening_balance). When the
purchase_invoice_service.py tried to create a Party object from a dict
returned by the repository, it would fail because the dict contained
these extra fields.
"""

import os
import sys
from pathlib import Path
from unittest.mock import Mock, MagicMock, patch

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

def print_section(title):
    """Print a formatted section header."""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)

def print_result(test_name, passed, details=""):
    """Print test result."""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status}: {test_name}")
    if details:
        print(f"   Details: {details}")
    return passed

# Track test results
test_results = []

# ============================================================================
# TEST 1: Party model accepts customer_category field
# ============================================================================
print_section("TEST 1: Party Model Has customer_category Field")

try:
    from models.party import Party
    from models.enums import PartyType
    
    # Create a Party with customer_category=None (typical for suppliers)
    supplier = Party(
        id=1,
        company_id=1,
        code='SUP001',
        name='Test Supplier',
        party_type=PartyType.SUPPLIER,
        credit_limit=10000.0,
        account_id=2,
        customer_category=None  # This should work now
    )
    
    passed = supplier.customer_category is None
    test_results.append(print_result(
        "Party model accepts customer_category=None",
        passed,
        f"customer_category={supplier.customer_category}"
    ))
    
except Exception as e:
    test_results.append(print_result(
        "Party model customer_category field",
        False,
        f"Exception: {e}"
    ))
    import traceback
    traceback.print_exc()

# ============================================================================
# TEST 2: Party model accepts customer_category with value
# ============================================================================
print_section("TEST 2: Party Model With customer_category Value")

try:
    from models.party import Party
    from models.enums import PartyType
    
    # Create a Party with customer_category set (typical for customers)
    customer = Party(
        id=2,
        company_id=1,
        code='CUST001',
        name='Test Customer',
        party_type=PartyType.CUSTOMER,
        credit_limit=5000.0,
        account_id=1,
        customer_category='INDIVIDUAL'  # Valid category
    )
    
    passed = customer.customer_category == 'INDIVIDUAL'
    test_results.append(print_result(
        "Party model accepts customer_category='INDIVIDUAL'",
        passed,
        f"customer_category={customer.customer_category}"
    ))
    
except Exception as e:
    test_results.append(print_result(
        "Party model customer_category value",
        False,
        f"Exception: {e}"
    ))
    import traceback
    traceback.print_exc()

# ============================================================================
# TEST 3: Party model accepts opening_balance field
# ============================================================================
print_section("TEST 3: Party Model Has opening_balance Field")

try:
    from models.party import Party
    from models.enums import PartyType
    
    # Create a Party with opening_balance
    party = Party(
        id=3,
        company_id=1,
        code='PARTY001',
        name='Test Party',
        party_type=PartyType.BOTH,
        credit_limit=1000.0,
        account_id=1,
        opening_balance=500.0  # This should work now
    )
    
    passed = party.opening_balance == 500.0
    test_results.append(print_result(
        "Party model accepts opening_balance=500.0",
        passed,
        f"opening_balance={party.opening_balance}"
    ))
    
except Exception as e:
    test_results.append(print_result(
        "Party model opening_balance field",
        False,
        f"Exception: {e}"
    ))
    import traceback
    traceback.print_exc()

# ============================================================================
# TEST 4: Party can be created from dict with customer_category (main fix)
# ============================================================================
print_section("TEST 4: Party from Dict with customer_category")

try:
    from models.party import Party
    from models.enums import PartyType
    
    # This simulates what happens in purchase_invoice_service.py line 489
    # The repository returns a dict with all DB columns including customer_category
    supplier_dict = {
        'id': 1,
        'company_id': 1,
        'code': 'SUP001',
        'name': 'Test Supplier',
        'party_type': 'SUPPLIER',
        'customer_category': None,  # This caused the original error
        'phone': '123456789',
        'address': 'Test Address',
        'email': 'supplier@test.com',
        'opening_balance': 0.0,
        'credit_limit': 10000.0,
        'account_id': 2,
        'is_active': 1,
        'created_at': '2026-08-09'
    }
    
    # This is the exact pattern used in purchase_invoice_service.py
    supplier = Party(**supplier_dict) if isinstance(supplier_dict, dict) else supplier_dict
    
    passed = supplier.name == 'Test Supplier' and supplier.customer_category is None
    test_results.append(print_result(
        "Party created from dict with customer_category field",
        passed,
        f"name={supplier.name}, customer_category={supplier.customer_category}"
    ))
    
except Exception as e:
    test_results.append(print_result(
        "Party from dict with customer_category",
        False,
        f"Exception: {e}"
    ))
    import traceback
    traceback.print_exc()

# ============================================================================
# TEST 5: Party.from_row handles customer_category correctly
# ============================================================================
print_section("TEST 5: Party.from_row with customer_category")

try:
    from models.party import Party
    from models.enums import PartyType
    
    # Simulate a row returned from the database
    db_row = {
        'id': 1,
        'company_id': 1,
        'code': 'SUP001',
        'name': 'DB Supplier',
        'party_type': 'SUPPLIER',
        'customer_category': None,
        'phone': '123456789',
        'address': 'Address',
        'email': 'db@test.com',
        'opening_balance': 100.0,
        'credit_limit': 10000.0,
        'account_id': 2,
        'is_active': 1,
        'created_at': '2026-08-09'
    }
    
    party = Party.from_row(db_row)
    
    passed = (
        party.name == 'DB Supplier' and
        party.customer_category is None and
        party.opening_balance == 100.0
    )
    test_results.append(print_result(
        "Party.from_row handles customer_category and opening_balance",
        passed,
        f"name={party.name}, customer_category={party.customer_category}, opening_balance={party.opening_balance}"
    ))
    
except Exception as e:
    test_results.append(print_result(
        "Party.from_row method",
        False,
        f"Exception: {e}"
    ))
    import traceback
    traceback.print_exc()

# ============================================================================
# TEST 6: Party.to_dict includes new fields
# ============================================================================
print_section("TEST 6: Party.to_dict Includes New Fields")

try:
    from models.party import Party
    from models.enums import PartyType
    
    party = Party(
        id=1,
        company_id=1,
        code='TEST001',
        name='Test Party',
        party_type=PartyType.SUPPLIER,
        credit_limit=1000.0,
        account_id=2,
        opening_balance=250.0,
        customer_category='BUSINESS'
    )
    
    party_dict = party.to_dict()
    
    has_opening = 'opening_balance' in party_dict and party_dict['opening_balance'] == 250.0
    has_category = 'customer_category' in party_dict and party_dict['customer_category'] == 'BUSINESS'
    
    passed = has_opening and has_category
    test_results.append(print_result(
        "Party.to_dict includes opening_balance and customer_category",
        passed,
        f"opening_balance={party_dict.get('opening_balance')}, customer_category={party_dict.get('customer_category')}"
    ))
    
except Exception as e:
    test_results.append(print_result(
        "Party.to_dict method",
        False,
        f"Exception: {e}"
    ))
    import traceback
    traceback.print_exc()

# ============================================================================
# TEST 7: Integration test - simulate purchase invoice service pattern
# ============================================================================
print_section("TEST 7: Purchase Invoice Service Pattern Simulation")

try:
    from models.party import Party
    from models.enums import PartyType
    
    # Simulate the exact scenario from purchase_invoice_service.py
    def get_supplier_from_repo(supplier_id):
        """Simulates party_repo.get_by_id() returning a dict"""
        return {
            'id': supplier_id,
            'company_id': 1,
            'code': 'SUP001',
            'name': 'ABC Suppliers',
            'party_type': 'SUPPLIER',
            'customer_category': None,
            'phone': '555-0100',
            'address': 'Supplier St',
            'email': 'abc@suppliers.com',
            'opening_balance': 0.0,
            'credit_limit': 50000.0,
            'account_id': 2,
            'is_active': 1,
            'created_at': '2026-08-09'
        }
    
    # This is the exact pattern from line 486-489 of purchase_invoice_service.py
    supplier_id = 1
    supplier_dict = get_supplier_from_repo(supplier_id)
    
    if not supplier_dict:
        raise ValueError(f"Supplier {supplier_id} not found")
    
    supplier = Party(**supplier_dict) if isinstance(supplier_dict, dict) else supplier_dict
    
    # Verify we can access supplier properties for logging
    supplier_name = supplier.name
    supplier_code = supplier.code
    
    passed = supplier_name == 'ABC Suppliers' and supplier_code == 'SUP001'
    test_results.append(print_result(
        "Purchase invoice service pattern works without TypeError",
        passed,
        f"supplier={supplier_name}, code={supplier_code}"
    ))
    
except TypeError as e:
    # This is the specific error we're fixing
    test_results.append(print_result(
        "Purchase invoice service pattern",
        False,
        f"TypeError (THIS IS THE BUG): {e}"
    ))
    import traceback
    traceback.print_exc()
except Exception as e:
    test_results.append(print_result(
        "Purchase invoice service pattern",
        False,
        f"Exception: {e}"
    ))
    import traceback
    traceback.print_exc()

# ============================================================================
# TEST 8: Database integration test (if DB available)
# ============================================================================
print_section("TEST 8: Database Integration Test")

try:
    from database.connection import get_db
    from repositories.party_repository import PartyRepository
    from models.party import Party
    
    db = get_db()
    repo = PartyRepository(db)
    
    # Get the supplier we created earlier
    supplier_dict = repo.get_by_id(1)
    
    if supplier_dict:
        # Try to create Party from the actual DB record
        supplier = Party(**supplier_dict) if isinstance(supplier_dict, dict) else supplier_dict
        
        passed = supplier.id == 1 and hasattr(supplier, 'customer_category')
        test_results.append(print_result(
            "Party created from actual database record",
            passed,
            f"id={supplier.id}, name={supplier.name}, customer_category={supplier.customer_category}"
        ))
    else:
        test_results.append(print_result(
            "Party created from actual database record",
            False,
            "No test data found in database (run init_db.py first)"
        ))
    
except ImportError as e:
    test_results.append(print_result(
        "Database integration test",
        False,
        f"Import error (sqlitecloud may not be installed): {e}"
    ))
except Exception as e:
    test_results.append(print_result(
        "Database integration test",
        False,
        f"Exception: {e}"
    ))
    import traceback
    traceback.print_exc()

# ============================================================================
# SUMMARY
# ============================================================================
print_section("TEST SUMMARY")

total_tests = len(test_results)
passed_tests = sum(1 for r in test_results if r)
failed_tests = total_tests - passed_tests

print(f"\nTotal Tests: {total_tests}")
print(f"Passed: {passed_tests}")
print(f"Failed: {failed_tests}")

if failed_tests == 0:
    print("\n🎉 All tests passed! The customer_category TypeError is fixed.")
else:
    print(f"\n⚠️  {failed_tests} test(s) failed")
    print("\nFailed tests:")
    for i, result in enumerate(test_results, 1):
        if not result:
            print(f"  {i}. Test #{i}")

print("\n" + "=" * 70)

# Exit with appropriate code
sys.exit(0 if failed_tests == 0 else 1)
