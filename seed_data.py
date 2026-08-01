#!/usr/bin/env python3
"""
Seed database using project's services and models.
This ensures all foreign key relationships are handled correctly.
"""
import sys
import os

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
from services.banking_service import BankingService
from models.enums import AccountType, PartyType, VoucherType
from utils.security import hash_password
from datetime import datetime, timedelta
from decimal import Decimal

db = get_db()
account_service = AccountService(db)
party_service = PartyService(db)
item_service = ItemService(db)
purchase_service = PurchaseInvoiceService(db)
sales_service = SalesInvoiceService(db)
expense_service = ExpenseService(db)
banking_service = BankingService(db)


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
    """Seed chart of accounts using AccountService."""
    print("  📋 Seeding accounts...")
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
    
    for code, name, acc_type, subtype, opening in accounts:
        try:
            account_service.create_account(
                account_code=code,
                account_name=name,
                account_type=acc_type,
                opening_balance=opening,
                account_subtype=subtype
            )
        except Exception as e:
            print(f"    ⚠️ Account {code} already exists: {e}")


def seed_parties():
    """Seed parties using PartyService."""
    print("  📋 Seeding parties...")
    parties = [
        # Customers
        ('CUST-001', 'ABC Pharmacy', PartyType.CUSTOMER, 50000, 4),
        ('CUST-002', 'XYZ Medical Store', PartyType.CUSTOMER, 30000, 4),
        ('CUST-003', 'HealthCare Plus', PartyType.CUSTOMER, 45000, 4),
        ('CUST-004', 'MediLife Pharmacy', PartyType.CUSTOMER, 60000, 4),
        ('CUST-005', 'City Pharmacy', PartyType.CUSTOMER, 25000, 4),
        
        # Suppliers
        ('SUPP-001', 'MediSupply Ltd', PartyType.SUPPLIER, 100000, 14),
        ('SUPP-002', 'Pharma Distributors', PartyType.SUPPLIER, 75000, 14),
        ('SUPP-003', 'Global Pharma Impex', PartyType.SUPPLIER, 120000, 14),
        ('SUPP-004', 'Local Med Suppliers', PartyType.SUPPLIER, 40000, 14),
    ]
    
    for code, name, party_type, credit_limit, account_id in parties:
        try:
            party_service.create_party(
                code=code,
                name=name,
                party_type=party_type,
                credit_limit=credit_limit,
                account_id=account_id
            )
        except Exception as e:
            print(f"    ⚠️ Party {code} already exists: {e}")


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
    """Seed items using ItemService."""
    print("  📋 Seeding items...")
    items = [
        # Finished Goods
        ('ITEM-001', 'Paracetamol 500mg', 'Pain reliever', 'TABLET', 15.50, 25.00, 100, 1000, 1, 'FINISHED_GOOD'),
        ('ITEM-002', 'Amoxicillin 250mg', 'Antibiotic', 'CAPSULE', 8.75, 15.00, 50, 500, 1, 'FINISHED_GOOD'),
        ('ITEM-003', 'Vitamin C 1000mg', 'Vitamin supplement', 'TABLET', 22.00, 35.00, 80, 800, 2, 'FINISHED_GOOD'),
        ('ITEM-004', 'Ibuprofen 400mg', 'Anti-inflammatory', 'TABLET', 12.00, 20.00, 60, 600, 1, 'FINISHED_GOOD'),
        ('ITEM-005', 'Omeprazole 20mg', 'Acid reducer', 'CAPSULE', 18.50, 30.00, 40, 400, 1, 'FINISHED_GOOD'),
        ('ITEM-006', 'Vitamin D 2000 IU', 'Vitamin D supplement', 'TABLET', 25.00, 40.00, 30, 300, 2, 'FINISHED_GOOD'),
        ('ITEM-007', 'Cetirizine 10mg', 'Antihistamine', 'TABLET', 5.50, 10.00, 50, 500, 1, 'FINISHED_GOOD'),
        ('ITEM-008', 'Metformin 500mg', 'Diabetes medication', 'TABLET', 14.00, 22.00, 80, 800, 1, 'FINISHED_GOOD'),
        
        # Raw Materials
        ('ITEM-009', 'Paracetamol Raw', 'Raw material for tablets', 'KG', 1500.00, 0, 50, 500, 0, 'RAW_MATERIAL'),
        ('ITEM-010', 'Amoxicillin Raw', 'Raw material for capsules', 'KG', 2500.00, 0, 30, 300, 0, 'RAW_MATERIAL'),
        ('ITEM-011', 'Vitamin C Raw', 'Raw material for tablets', 'KG', 800.00, 0, 40, 400, 0, 'RAW_MATERIAL'),
        ('ITEM-012', 'Ibuprofen Raw', 'Raw material for tablets', 'KG', 1200.00, 0, 20, 200, 0, 'RAW_MATERIAL'),
        
        # Packing Materials
        ('ITEM-013', 'Blister Packs', 'For tablet packaging', 'UNIT', 5.00, 0, 500, 5000, 0, 'PACKING_MATERIAL'),
        ('ITEM-014', 'Bottles 100ml', 'For liquid products', 'UNIT', 15.00, 0, 200, 2000, 0, 'PACKING_MATERIAL'),
        ('ITEM-015', 'Labels', 'For product labeling', 'UNIT', 2.00, 0, 1000, 10000, 0, 'PACKING_MATERIAL'),
    ]
    
    for code, name, notes, unit, pp, sp, min_stock, max_stock, tax_id, item_type in items:
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
                category_id=1 if item_type == 'FINISHED_GOOD' else (6 if item_type == 'RAW_MATERIAL' else 7)
            )
        except Exception as e:
            print(f"    ⚠️ Item {code} already exists: {e}")


def seed_stock_batches():
    """Seed stock batches."""
    print("  📋 Seeding stock batches...")
    today = datetime.now().date()
    stock_batches = [
        (1, 1, 'BATCH-001', today - timedelta(days=30), today + timedelta(days=365), 15.50, 500),
        (2, 2, 'BATCH-002', today - timedelta(days=45), today + timedelta(days=400), 8.75, 250),
        (3, 3, 'BATCH-003', today - timedelta(days=20), today + timedelta(days=500), 22.00, 120),
        (4, 4, 'BATCH-004', today - timedelta(days=60), today + timedelta(days=350), 12.00, 350),
        (5, 5, 'BATCH-005', today - timedelta(days=15), today + timedelta(days=450), 18.50, 80),
        (6, 6, 'BATCH-006', today - timedelta(days=10), today + timedelta(days=550), 25.00, 200),
        (7, 7, 'BATCH-007', today - timedelta(days=25), today + timedelta(days=300), 5.50, 400),
        (8, 8, 'BATCH-008', today - timedelta(days=5), today + timedelta(days=600), 14.00, 300),
        (9, 9, 'RM-001', today - timedelta(days=60), today + timedelta(days=180), 1500.00, 80),
        (10, 10, 'RM-002', today - timedelta(days=75), today + timedelta(days=150), 2500.00, 50),
        (11, 11, 'RM-003', today - timedelta(days=40), today + timedelta(days=200), 800.00, 100),
        (12, 12, 'RM-004', today - timedelta(days=90), today + timedelta(days=160), 1200.00, 40),
        (13, 13, 'PK-001', today, today + timedelta(days=730), 5.00, 1000),
        (14, 14, 'PK-002', today, today + timedelta(days=730), 15.00, 500),
        (15, 15, 'PK-003', today, today + timedelta(days=730), 2.00, 2000),
    ]
    
    for item_id, warehouse_id, batch_no, mfg_date, exp_date, price, qty in stock_batches:
        db.execute("""
            INSERT OR REPLACE INTO stock_batches (item_id, warehouse_id, batch_number, 
                manufacturing_date, expiry_date, purchase_price, quantity_in_stock, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        """, (item_id, warehouse_id, batch_no, mfg_date.isoformat(), exp_date.isoformat(), price, qty))


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
    """Create sample purchase invoices."""
    print("  📋 Creating purchase invoices...")
    
    # Purchase Invoice 1: Raw Materials from MediSupply Ltd
    items = [
        {"item_id": 9, "batch_id": 9, "batch_number": "RM-001", "quantity": 50, "unit_cost": 1500.00, "discount_amount": 0, "tax_amount": 1275.00},
        {"item_id": 10, "batch_id": 10, "batch_number": "RM-002", "quantity": 20, "unit_cost": 2500.00, "discount_amount": 0, "tax_amount": 850.00},
    ]
    try:
        purchase_service.create_purchase_invoice(
            invoice_number="PI-000001",
            supplier_id=6,
            invoice_date=(datetime.now() - timedelta(days=15)).strftime("%Y-%m-%d"),
            payment_type="CREDIT",
            items=items,
            notes="Raw materials purchase"
        )
        print("    ✅ PI-000001 created")
    except Exception as e:
        print(f"    ⚠️ PI-000001: {e}")
    
    # Purchase Invoice 2: Packing Materials from Pharma Distributors
    items = [
        {"item_id": 13, "batch_id": 13, "batch_number": "PK-001", "quantity": 1000, "unit_cost": 5.00, "discount_amount": 500, "tax_amount": 765.00},
        {"item_id": 14, "batch_id": 14, "batch_number": "PK-002", "quantity": 500, "unit_cost": 15.00, "discount_amount": 500, "tax_amount": 1275.00},
    ]
    try:
        purchase_service.create_purchase_invoice(
            invoice_number="PI-000002",
            supplier_id=7,
            invoice_date=(datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d"),
            payment_type="CASH",
            items=items,
            notes="Packing materials purchase"
        )
        print("    ✅ PI-000002 created")
    except Exception as e:
        print(f"    ⚠️ PI-000002: {e}")


def create_sales_invoices():
    """Create sample sales invoices."""
    print("  📋 Creating sales invoices...")
    
    # Sales Invoice 1: ABC Pharmacy
    items = [
        {"item_id": 1, "batch_id": 1, "quantity": 100, "unit_price": 25.00, "discount_amount": 100, "tax_amount": 400.00},
        {"item_id": 3, "batch_id": 3, "quantity": 50, "unit_price": 35.00, "discount_amount": 100, "tax_amount": 280.00},
    ]
    try:
        sales_service.create_sales_invoice(
            invoice_number="SI-000001",
            customer_id=1,
            invoice_date=(datetime.now() - timedelta(days=12)).strftime("%Y-%m-%d"),
            payment_type="CREDIT",
            items=items,
            notes="Order from ABC Pharmacy"
        )
        print("    ✅ SI-000001 created")
    except Exception as e:
        print(f"    ⚠️ SI-000001: {e}")
    
    # Sales Invoice 2: XYZ Medical Store
    items = [
        {"item_id": 2, "batch_id": 2, "quantity": 80, "unit_price": 15.00, "discount_amount": 50, "tax_amount": 195.50},
        {"item_id": 5, "batch_id": 5, "quantity": 40, "unit_price": 30.00, "discount_amount": 50, "tax_amount": 195.50},
    ]
    try:
        sales_service.create_sales_invoice(
            invoice_number="SI-000002",
            customer_id=2,
            invoice_date=(datetime.now() - timedelta(days=8)).strftime("%Y-%m-%d"),
            payment_type="CASH",
            items=items,
            notes="Order from XYZ Medical Store"
        )
        print("    ✅ SI-000002 created")
    except Exception as e:
        print(f"    ⚠️ SI-000002: {e}")


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
    print("🌱 Seeding database using project services...")
    
    try:
        # Basic data
        # seed_companies()
        # seed_tax_rates()
        # seed_warehouses()
        # seed_roles()
        # seed_permissions()
        # seed_role_permissions()
        # seed_users()
        
        # # Master data
        # seed_accounts()
        # seed_parties()
        # seed_item_categories()
        # seed_items()
        # seed_stock_batches()
        # seed_bank_accounts()
        # seed_expense_categories()
        # seed_numbering_sequences()
        
        # # Transactions
        # create_purchase_invoices()
        # create_sales_invoices()
        # create_expenses()
        
        print("\n✅ Database seeding complete!")
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