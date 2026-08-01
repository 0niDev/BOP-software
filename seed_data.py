#!/usr/bin/env python3
"""
High-Performance Seed Database Script
Optimized for hosted databases with batch operations and transaction grouping.
"""
import sys
import os
import time
from datetime import datetime, timedelta
from decimal import Decimal

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set environment variables
os.environ['ERP_DB_ENGINE'] = 'sqlitecloud'
os.environ['SQLITE_CLOUD_URL'] = 'sqlitecloud://cjja8z6pvz.g4.sqlite.cloud:8860/cool-depot.sqlite?apikey=bmJZ0l1RTFCoxS0Au17c0iofzZmrDn2Db94v0YtV9Uw'

from database.connection import get_db
from services.account_service import AccountService
from services.party_service import PartyService
from services.item_service import ItemService
from services.purchase_invoice_service import PurchaseInvoiceService
from services.sales_invoice_service import SalesInvoiceService
from services.expense_service import ExpenseService
from models.enums import AccountType, PartyType
from utils.security import hash_password

db = get_db()
account_service = AccountService(db)
party_service = PartyService(db)
item_service = ItemService(db)
purchase_service = PurchaseInvoiceService(db)
sales_service = SalesInvoiceService(db)
expense_service = ExpenseService(db)


def seed_companies():
    """Seed company data."""
    print("  📋 Seeding companies...")
    db.execute("""
        INSERT OR REPLACE INTO companies (id, name, address, phone, email, ntn, is_active)
        VALUES (1, 'BOP Nutraceuticals', '123 Main Street, Lahore, Pakistan', 
                '+92-42-1234567', 'info@bop.com', '1234567890', 1)
    """)


def seed_tax_rates():
    """Seed tax rates."""
    print("  📋 Seeding tax rates...")
    db.execute("""
        INSERT OR REPLACE INTO tax_rates (id, company_id, name, tax_type, rate_percent, is_active)
        VALUES 
            (1, 1, 'Sales Tax 17%', 'SALES_TAX', 17.0, 1),
            (2, 1, 'Sales Tax 10%', 'SALES_TAX', 10.0, 1),
            (3, 1, 'Withholding Tax 5%', 'WITHHOLDING_TAX', 5.0, 1)
    """)


def seed_warehouses():
    """Seed warehouses."""
    print("  📋 Seeding warehouses...")
    db.execute("""
        INSERT OR REPLACE INTO warehouses (id, company_id, code, name, address, is_default, is_active)
        VALUES 
            (1, 1, 'WH-001', 'Main Warehouse', '123 Main Street, Lahore', 1, 1),
            (2, 1, 'WH-002', 'Secondary Warehouse', '456 Secondary Road, Lahore', 0, 1)
    """)


def seed_roles():
    """Seed roles."""
    print("  📋 Seeding roles...")
    db.execute("""
        INSERT OR REPLACE INTO roles (id, name, description)
        VALUES 
            (1, 'Admin', 'Full system access'),
            (2, 'Manager', 'Can manage all business operations'),
            (3, 'Sales', 'Sales and customer management'),
            (4, 'Purchase', 'Purchase and supplier management'),
            (5, 'Inventory', 'Inventory management'),
            (6, 'Accounting', 'Accounting and reports')
    """)


def seed_permissions():
    """Seed permissions."""
    print("  📋 Seeding permissions...")
    permissions = [
        (1, 'view_dashboard', 'View Dashboard'),
        (2, 'manage_parties', 'Manage Parties'),
        (3, 'manage_items', 'Manage Items'),
        (4, 'manage_sales', 'Manage Sales'),
        (5, 'manage_purchases', 'Manage Purchases'),
        (6, 'manage_accounts', 'Manage Accounts'),
        (7, 'manage_inventory', 'Manage Inventory'),
        (8, 'manage_reports', 'View Reports'),
        (9, 'manage_users', 'Manage Users'),
        (10, 'manage_settings', 'Manage Settings'),
    ]
    for pid, code, desc in permissions:
        db.execute(
            "INSERT OR REPLACE INTO permissions (id, code, description) VALUES (?, ?, ?)",
            (pid, code, desc)
        )


def seed_role_permissions():
    """Seed role permissions."""
    print("  📋 Seeding role permissions...")
    # Admin gets all permissions
    for pid in range(1, 11):
        db.execute(
            "INSERT OR REPLACE INTO role_permissions (role_id, permission_id) VALUES (1, ?)",
            (pid,)
        )
    # Manager gets most permissions
    for pid in [1, 2, 3, 4, 5, 6, 7, 8]:
        db.execute(
            "INSERT OR REPLACE INTO role_permissions (role_id, permission_id) VALUES (2, ?)",
            (pid,)
        )


def seed_users():
    """Seed users."""
    print("  📋 Seeding users...")
    salt, pwd_hash = hash_password("admin123")
    db.execute("""
        INSERT OR REPLACE INTO users (id, username, password_hash, password_salt, full_name, email, role_id, is_active)
        VALUES (1, 'admin', ?, ?, 'System Administrator', 'admin@bop.com', 1, 1)
    """, (pwd_hash, salt))
    
    salt2, pwd_hash2 = hash_password("manager123")
    db.execute("""
        INSERT OR REPLACE INTO users (id, username, password_hash, password_salt, full_name, email, role_id, is_active)
        VALUES (2, 'manager', ?, ?, 'Operations Manager', 'manager@bop.com', 2, 1)
    """, (pwd_hash2, salt2))
    
    salt3, pwd_hash3 = hash_password("sales123")
    db.execute("""
        INSERT OR REPLACE INTO users (id, username, password_hash, password_salt, full_name, email, role_id, is_active)
        VALUES (3, 'sales', ?, ?, 'Sales Representative', 'sales@bop.com', 3, 1)
    """, (pwd_hash3, salt3))


def seed_accounts():
    """Seed chart of accounts using batch insert for performance."""
    print("  📋 Seeding accounts...")
    
    # Check existing accounts first
    existing = db.execute("SELECT account_code FROM accounts").fetchall()
    existing_codes = set(row[0] for row in existing)
    
    accounts = [
        # ASSETS (1000-1999)
        ('1000', 'Cash in Hand', AccountType.ASSET, 'Current Asset', 50000.00),
        ('1010', 'Bank Accounts', AccountType.ASSET, 'Current Asset', 200000.00),
        ('1020', 'Petty Cash', AccountType.ASSET, 'Current Asset', 10000.00),
        ('1100', 'Accounts Receivable', AccountType.ASSET, 'Current Asset', 75000.00),
        ('1200', 'Inventory Raw Materials', AccountType.ASSET, 'Current Asset', 150000.00),
        ('1210', 'Inventory Packing Materials', AccountType.ASSET, 'Current Asset', 50000.00),
        ('1220', 'Inventory Finished Goods', AccountType.ASSET, 'Current Asset', 200000.00),
        ('1300', 'Withholding Tax Receivable', AccountType.ASSET, 'Current Asset', 5000.00),
        ('1501', 'Furniture & Fixtures', AccountType.ASSET, 'Fixed Asset', 100000.00),
        ('1502', 'Office Equipment', AccountType.ASSET, 'Fixed Asset', 150000.00),
        ('1503', 'Plant & Machinery', AccountType.ASSET, 'Fixed Asset', 500000.00),
        ('1504', 'Motor Vehicles', AccountType.ASSET, 'Fixed Asset', 300000.00),
        ('1505', 'Buildings', AccountType.ASSET, 'Fixed Asset', 2000000.00),
        
        # LIABILITIES (2000-2999)
        ('2000', 'Accounts Payable', AccountType.LIABILITY, 'Current Liability', 45000.00),
        ('2100', 'Sales Tax Payable', AccountType.LIABILITY, 'Current Liability', 25000.00),
        ('2200', 'Withholding Tax Payable', AccountType.LIABILITY, 'Current Liability', 5000.00),
        ('2300', 'Bank Loans', AccountType.LIABILITY, 'Long Term Liability', 500000.00),
        
        # EQUITY (3000-3999)
        ('3000', "Owner's Equity", AccountType.EQUITY, 'Equity', 300000.00),
        ('3100', 'Retained Earnings', AccountType.EQUITY, 'Equity', 100000.00),
        
        # REVENUE (4000-4999)
        ('4000', 'Sales Revenue', AccountType.REVENUE, 'Revenue', 0.00),
        ('4100', 'Sales Returns', AccountType.REVENUE, 'Revenue', 0.00),
        ('4200', 'Other Income', AccountType.REVENUE, 'Revenue', 0.00),
        
        # EXPENSES (5000-7999)
        ('5000', 'Cost of Goods Sold', AccountType.EXPENSE, 'Expense', 0.00),
        ('5100', 'Purchase Returns', AccountType.EXPENSE, 'Expense', 0.00),
        ('5200', 'Manufacturing Wastage', AccountType.EXPENSE, 'Expense', 0.00),
        ('5300', 'Inventory Loss', AccountType.EXPENSE, 'Expense', 0.00),
        ('6000', 'Salaries & Wages', AccountType.EXPENSE, 'Expense', 0.00),
        ('6100', 'Rent & Utilities', AccountType.EXPENSE, 'Expense', 0.00),
        ('6200', 'Marketing & Advertising', AccountType.EXPENSE, 'Expense', 0.00),
        ('6300', 'Transport & Freight', AccountType.EXPENSE, 'Expense', 0.00),
        ('6400', 'Insurance', AccountType.EXPENSE, 'Expense', 0.00),
        ('6500', 'Office Supplies', AccountType.EXPENSE, 'Expense', 0.00),
        ('6600', 'Repairs & Maintenance', AccountType.EXPENSE, 'Expense', 0.00),
        ('6700', 'Professional Services', AccountType.EXPENSE, 'Expense', 0.00),
        ('6800', 'Travel & Entertainment', AccountType.EXPENSE, 'Expense', 0.00),
        ('7000', 'Selling & Distribution', AccountType.EXPENSE, 'Expense', 0.00),
        ('7100', 'Administrative Expenses', AccountType.EXPENSE, 'Expense', 0.00),
        ('7200', 'Bank Charges', AccountType.EXPENSE, 'Expense', 0.00),
        ('7300', 'Interest Expense', AccountType.EXPENSE, 'Expense', 0.00),
    ]
    
    # Filter out existing accounts
    new_accounts = [(code, name, acc_type, subtype, opening) 
                    for code, name, acc_type, subtype, opening in accounts 
                    if code not in existing_codes]
    
    if not new_accounts:
        print("    ✅ All accounts already exist")
        return
    
    # Batch insert new accounts
    with db.transaction():
        for code, name, acc_type, subtype, opening in new_accounts:
            account_service.create_account(
                account_code=code,
                account_name=name,
                account_type=acc_type,
                opening_balance=opening,
                account_subtype=subtype
            )
    print(f"    ✅ Created {len(new_accounts)} accounts")


def seed_parties():
    """Seed parties with FK check to avoid errors."""
    print("  📋 Seeding parties...")
    
    # Get existing party codes
    existing = db.execute("SELECT code FROM parties").fetchall()
    existing_codes = set(row[0] for row in existing)
    
    # Get valid account IDs for customers (asset accounts) and suppliers (liability accounts)
    customer_accounts = db.execute("SELECT id FROM accounts WHERE account_type = 'ASSET' LIMIT 5").fetchall()
    supplier_accounts = db.execute("SELECT id FROM accounts WHERE account_type = 'LIABILITY' LIMIT 5").fetchall()
    
    if not customer_accounts or not supplier_accounts:
        print("    ⚠️ No valid accounts found for parties")
        return
    
    customer_account_ids = [row[0] for row in customer_accounts]
    supplier_account_ids = [row[0] for row in supplier_accounts]
    
    parties = [
        # Customers
        ('CUST-001', 'ABC Pharmacy', PartyType.CUSTOMER, 50000, customer_account_ids[0]),
        ('CUST-002', 'XYZ Medical Store', PartyType.CUSTOMER, 30000, customer_account_ids[0] if len(customer_account_ids) == 1 else customer_account_ids[1]),
        ('CUST-003', 'HealthCare Plus', PartyType.CUSTOMER, 45000, customer_account_ids[0]),
        ('CUST-004', 'MediLife Pharmacy', PartyType.CUSTOMER, 60000, customer_account_ids[0]),
        ('CUST-005', 'City Pharmacy', PartyType.CUSTOMER, 25000, customer_account_ids[0]),
        
        # Suppliers
        ('SUPP-001', 'MediSupply Ltd', PartyType.SUPPLIER, 100000, supplier_account_ids[0]),
        ('SUPP-002', 'Pharma Distributors', PartyType.SUPPLIER, 75000, supplier_account_ids[0] if len(supplier_account_ids) == 1 else supplier_account_ids[1]),
        ('SUPP-003', 'Global Pharma Impex', PartyType.SUPPLIER, 120000, supplier_account_ids[0]),
        ('SUPP-004', 'Local Med Suppliers', PartyType.SUPPLIER, 40000, supplier_account_ids[0]),
    ]
    
    created = 0
    for code, name, party_type, credit_limit, account_id in parties:
        if code in existing_codes:
            continue
        try:
            party_service.create_party(
                code=code,
                name=name,
                party_type=party_type,
                credit_limit=credit_limit,
                account_id=account_id
            )
            created += 1
        except Exception as e:
            print(f"    ⚠️ Party {code}: {e}")
    
    if created > 0:
        print(f"    ✅ Created {created} parties")
    else:
        print("    ✅ All parties already exist")


def seed_item_categories():
    """Seed item categories."""
    print("  📋 Seeding item categories...")
    categories = [
        (1, 'Tablets'),
        (2, 'Capsules'),
        (3, 'Liquids'),
        (4, 'Injectables'),
        (5, 'Topical'),
        (6, 'Raw Materials'),
        (7, 'Packaging'),
    ]
    for cat_id, name in categories:
        db.execute(
            "INSERT OR REPLACE INTO item_categories (id, company_id, name) VALUES (?, 1, ?)",
            (cat_id, name)
        )


def seed_items():
    """Seed items with FK checks to avoid errors."""
    print("  📋 Seeding items...")
    
    # Check existing items
    existing = db.execute("SELECT item_code FROM items").fetchall()
    existing_codes = set(row[0] for row in existing)
    
    # Check tax rates exist
    tax_rates = db.execute("SELECT id FROM tax_rates").fetchall()
    if not tax_rates:
        print("    ⚠️ No tax rates found, skipping items")
        return
    
    tax_ids = [row[0] for row in tax_rates]
    
    # Check categories exist
    categories = db.execute("SELECT id FROM item_categories").fetchall()
    category_map = {1: 'FINISHED_GOOD', 6: 'RAW_MATERIAL', 7: 'PACKING_MATERIAL'}
    valid_cat_ids = set(row[0] for row in categories)
    
    items = [
        # Finished Goods
        ('ITEM-001', 'Paracetamol 500mg', 'Pain reliever', 'TABLET', 15.50, 25.00, 100, 1000, tax_ids[0] if tax_ids else None, 'FINISHED_GOOD', 1),
        ('ITEM-002', 'Amoxicillin 250mg', 'Antibiotic', 'CAPSULE', 8.75, 15.00, 50, 500, tax_ids[0] if tax_ids else None, 'FINISHED_GOOD', 1),
        ('ITEM-003', 'Vitamin C 1000mg', 'Vitamin supplement', 'TABLET', 22.00, 35.00, 80, 800, tax_ids[1] if len(tax_ids) > 1 else tax_ids[0], 'FINISHED_GOOD', 1),
        ('ITEM-004', 'Ibuprofen 400mg', 'Anti-inflammatory', 'TABLET', 12.00, 20.00, 60, 600, tax_ids[0] if tax_ids else None, 'FINISHED_GOOD', 1),
        ('ITEM-005', 'Omeprazole 20mg', 'Acid reducer', 'CAPSULE', 18.50, 30.00, 40, 400, tax_ids[0] if tax_ids else None, 'FINISHED_GOOD', 1),
        ('ITEM-006', 'Vitamin D 2000 IU', 'Vitamin D supplement', 'TABLET', 25.00, 40.00, 30, 300, tax_ids[1] if len(tax_ids) > 1 else tax_ids[0], 'FINISHED_GOOD', 1),
        ('ITEM-007', 'Cetirizine 10mg', 'Antihistamine', 'TABLET', 5.50, 10.00, 50, 500, tax_ids[0] if tax_ids else None, 'FINISHED_GOOD', 1),
        ('ITEM-008', 'Metformin 500mg', 'Diabetes medication', 'TABLET', 14.00, 22.00, 80, 800, tax_ids[0] if tax_ids else None, 'FINISHED_GOOD', 1),
        
        # Raw Materials
        ('ITEM-009', 'Paracetamol Raw', 'Raw material for tablets', 'KG', 1500.00, 0, 50, 500, None, 'RAW_MATERIAL', 6),
        ('ITEM-010', 'Amoxicillin Raw', 'Raw material for capsules', 'KG', 2500.00, 0, 30, 300, None, 'RAW_MATERIAL', 6),
        ('ITEM-011', 'Vitamin C Raw', 'Raw material for tablets', 'KG', 800.00, 0, 40, 400, None, 'RAW_MATERIAL', 6),
        ('ITEM-012', 'Ibuprofen Raw', 'Raw material for tablets', 'KG', 1200.00, 0, 20, 200, None, 'RAW_MATERIAL', 6),
        
        # Packing Materials
        ('ITEM-013', 'Blister Packs', 'For tablet packaging', 'UNIT', 5.00, 0, 500, 5000, None, 'PACKING_MATERIAL', 7),
        ('ITEM-014', 'Bottles 100ml', 'For liquid products', 'UNIT', 15.00, 0, 200, 2000, None, 'PACKING_MATERIAL', 7),
        ('ITEM-015', 'Labels', 'For product labeling', 'UNIT', 2.00, 0, 1000, 10000, None, 'PACKING_MATERIAL', 7),
    ]
    
    created = 0
    for code, name, notes, unit, pp, sp, min_stock, max_stock, tax_id, item_type, cat_id in items:
        if code in existing_codes:
            continue
        
        # Skip if category doesn't exist
        if cat_id not in valid_cat_ids:
            continue
            
        try:
            item_service.create_item(
                item_code=code,
                item_name=name,
                notes=notes,
                unit=unit,
                purchase_price=pp,
                selling_price=sp,
                minimum_stock=min_stock,
                maximum_stock=max_stock,
                tax_rate_id=tax_id,
                item_type=item_type,
                category_id=cat_id
            )
            created += 1
        except Exception as e:
            print(f"    ⚠️ Item {code}: {e}")
    
    if created > 0:
        print(f"    ✅ Created {created} items")
    else:
        print("    ✅ All items already exist")


def seed_stock_batches():
    """Seed stock batches using batch insert for performance - only for existing items."""
    print("  📋 Seeding stock batches (batch mode)...")
    today = datetime.now().date()
    
    # First, get existing item IDs to avoid FK errors
    existing_items = db.execute("SELECT id FROM items").fetchall()
    existing_item_ids = set(row[0] for row in existing_items)
    
    if not existing_item_ids:
        print("    ⚠️ No items found, skipping stock batches")
        return
    
    # Only create batches for items that exist
    stock_batches = []
    batch_configs = [
        ('BATCH-001', 30, 365, 15.50, 500),
        ('BATCH-002', 45, 400, 8.75, 250),
        ('BATCH-003', 20, 500, 22.00, 120),
        ('BATCH-004', 60, 350, 12.00, 350),
        ('BATCH-005', 15, 450, 18.50, 80),
        ('BATCH-006', 10, 550, 25.00, 200),
        ('BATCH-007', 25, 300, 5.50, 400),
        ('BATCH-008', 5, 600, 14.00, 300),
    ]
    
    # Assign batches to existing items (cycle through available items)
    item_list = list(existing_item_ids)
    for i, (batch_no, days_ago, days_expiry, price, qty) in enumerate(batch_configs):
        if i < len(item_list):
            item_id = item_list[i % len(item_list)]
            stock_batches.append((
                item_id, 1, batch_no,
                today - timedelta(days=days_ago),
                today + timedelta(days=days_expiry),
                price, qty
            ))
    
    if not stock_batches:
        print("    ⚠️ No batches created")
        return
    
    # Use single transaction with executemany for 10x faster inserts
    with db.transaction():
        db.executemany("""
            INSERT OR REPLACE INTO stock_batches (item_id, warehouse_id, batch_number, 
                manufacturing_date, expiry_date, purchase_price, quantity_in_stock, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        """, [(item_id, wh_id, batch_no, mfg.isoformat(), exp.isoformat(), price, qty) 
              for item_id, wh_id, batch_no, mfg, exp, price, qty in stock_batches])
    print(f"    ✅ Inserted {len(stock_batches)} stock batches")


def seed_bank_accounts():
    """Seed bank accounts."""
    print("  📋 Seeding bank accounts...")
    db.execute("""
        INSERT OR REPLACE INTO bank_accounts (id, company_id, account_id, bank_name, 
            account_title, account_number, branch_code, iban, opening_balance, is_active)
        VALUES 
            (1, 1, 2, 'HBL', 'Current Account', '123456789', '001', 'PK00HBL123456789', 200000.00, 1),
            (2, 1, 2, 'UBL', 'Business Account', '987654321', '002', 'PK00UBL987654321', 100000.00, 1)
    """)


def seed_expense_categories():
    """Seed expense categories."""
    print("  📋 Seeding expense categories...")
    categories = [
        (1, 'Salaries & Wages', 27),
        (2, 'Rent & Utilities', 28),
        (3, 'Marketing & Advertising', 29),
        (4, 'Transport & Freight', 30),
        (5, 'Insurance', 31),
        (6, 'Office Supplies', 32),
        (7, 'Repairs & Maintenance', 33),
        (8, 'Professional Services', 34),
        (9, 'Travel & Entertainment', 35),
        (10, 'Bank Charges', 38),
    ]
    for cat_id, name, acc_id in categories:
        db.execute(
            "INSERT OR REPLACE INTO expense_categories (id, company_id, name, account_id, is_active) VALUES (?, 1, ?, ?, 1)",
            (cat_id, name, acc_id)
        )


def seed_numbering_sequences():
    """Seed numbering sequences."""
    print("  📋 Seeding numbering sequences...")
    sequences = [
        ('SALES_INVOICE', 'SI-', 1, 6),
        ('PURCHASE_INVOICE', 'PI-', 1, 6),
        ('ITEM', 'ITEM-', 1, 5),
        ('BOM', 'BOM-', 1, 5),
        ('PRODUCTION_ORDER', 'PROD-', 1, 6),
        ('PAYMENT', 'PAY-', 1, 6),
        ('RECEIPT', 'REC-', 1, 6),
        ('CUSTOMER', 'CUST-', 1, 5),
        ('SUPPLIER', 'SUPP-', 1, 5),
    ]
    for doc_type, prefix, next_num, padding in sequences:
        db.execute("""
            INSERT OR REPLACE INTO numbering_sequences (company_id, document_type, prefix, next_number, padding)
            VALUES (1, ?, ?, ?, ?)
        """, (doc_type, prefix, next_num, padding))


def create_purchase_invoices():
    """Create sample purchase invoices - simplified for speed."""
    print("  📋 Creating purchase invoices...")
    print("    ⏭️ Skipping (invoices can be created manually)")


def create_sales_invoices():
    """Create sample sales invoices - simplified for speed."""
    print("  📋 Creating sales invoices...")
    print("    ⏭️ Skipping (invoices can be created manually)")


def create_expenses():
    """Create sample expenses."""
    print("  📋 Creating expenses...")
    expenses = [
        ("EXP-000001", 1, datetime.now() - timedelta(days=30), 150000.00, "BANK", "Monthly salaries"),
        ("EXP-000002", 2, datetime.now() - timedelta(days=25), 25000.00, "BANK", "Monthly rent"),
        ("EXP-000003", 4, datetime.now() - timedelta(days=20), 5000.00, "CASH", "Transport charges"),
        ("EXP-000004", 6, datetime.now() - timedelta(days=15), 3000.00, "CASH", "Office supplies"),
        ("EXP-000005", 7, datetime.now() - timedelta(days=10), 2000.00, "CASH", "Maintenance"),
        ("EXP-000006", 3, datetime.now() - timedelta(days=8), 10000.00, "BANK", "Marketing campaign"),
        ("EXP-000007", 5, datetime.now() - timedelta(days=5), 4000.00, "BANK", "Insurance premium"),
        ("EXP-000008", 9, datetime.now() - timedelta(days=3), 1500.00, "CASH", "Travel expenses"),
        ("EXP-000009", 8, datetime.now() - timedelta(days=2), 5000.00, "BANK", "Legal fees"),
        ("EXP-000010", 10, datetime.now() - timedelta(days=1), 200.00, "BANK", "Bank charges"),
    ]
    
    for voucher, cat_id, date, amount, method, desc in expenses:
        try:
            expense_service.create_expense(
                voucher_number=voucher,
                category_id=cat_id,
                expense_date=date.strftime("%Y-%m-%d"),
                amount=amount,
                payment_method=method,
                description=desc
            )
        except Exception as e:
            print(f"    ⚠️ {voucher}: {e}")
    print("    ✅ Expenses created")


def main():
    print("🌱 Seeding database with high-performance batch operations...")
    start_time = time.time()
    
    try:
        # Basic data (uncomment to reseed)
        seed_companies()
        seed_tax_rates()
        seed_warehouses()
        seed_roles()
        seed_permissions()
        seed_role_permissions()
        seed_users()
        
        # Master data only - skip transactions for speed
        seed_accounts()
        seed_parties()
        seed_item_categories()
        seed_items()
        seed_stock_batches()
        seed_bank_accounts()
        seed_expense_categories()
        seed_numbering_sequences()
        
        elapsed = time.time() - start_time
        print("\n✅ Database seeding complete!")
        print("=" * 50)
        print(f"⏱️  Total time: {elapsed:.2f} seconds")
        print("=" * 50)
        print("📊 SUMMARY")
        print("=" * 50)
        print("🔑 Login Credentials:")
        print("  admin    / admin123   (Full access)")
        print("  manager  / manager123 (Manager access)")
        print("  sales    / sales123   (Sales access)")
        print("=" * 50)
        
    except Exception as e:
        print(f"❌ Error seeding database: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()