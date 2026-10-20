"""
Import old PharmaPro Trial Balance opening balances as OPENING journal entries
to the hierarchical accounts (1, 11, 111, 113, 12, etc.) so the hierarchical
TB matches the old system.
"""
from __future__ import annotations

import csv
import os
import sys
import time

from utils.env_loader import setup_import_env
setup_import_env()

from database.connection import get_db, close_db
from repositories.journal_repository import JournalRepository
from services.accounting_service import AccountingService, JournalLine
from models.enums import VoucherType
import datetime as dt

# Old TB opening balances (from the PharmaPro TB output)
# Format: account_code -> (opening_debit, opening_credit)
OLD_TB_OPENINGS = {
    # Assets
    "1": (142409378.66, 0),           # Assets
    "11": (67016329.66, 0),           # Current Assets
    "111": (31145838.25, 0),          # Cash In Hand
    "112": (0, 0),                    # Bank Accounts - not shown in TB
    "113": (35870491.41, 0),          # Inventory
    "1131": (35502550.50, 0),         # Opening stock
    "1132": (79057181.34, 0),         # Stock purchased
    "1133": (0, 72467770.63),         # Stock sold (CR)
    "1136": (0, 6221469.80),          # Stock expired (CR)
    "1137": (0, 0.01),                # Stock Productions (CR)
    "1138": (0.01, 0),                # Stock Packings (DR)
    "12": (73312549.00, 0),           # Fixed Assets
    "12001": (8527315.00, 0),         # HBL Instalment
    "12002": (1116100.00, 0),         # Instalment of Moter Bike
    "12003": (53455150.00, 0),        # Instalment of Moter Car
    "121": (6411500.00, 0),           # Auto vehicles
    "1211": (6411500.00, 0),          # Auto vehicles: Original value
    "122": (660000.00, 0),            # Furniture and fixture
    "1221": (660000.00, 0),           # Fur and Fix: Original value
    "123": (3142484.00, 0),           # Building and grounds
    "1231": (3142484.00, 0),          # Building and G: Original value
    "13": (2080500.00, 0),            # Other assets
    "13001": (2080500.00, 0),         # Factory Machinery Purchase
    
    # Liabilities
    "2": (17324000.00, 0),            # Liabilities (DR in old TB!)
    "21": (17324000.00, 0),           # Short term liabilities
    "21001": (760000.00, 0),          # Atta Lab
    "21002": (700000.00, 0),          # Anaiyat Aluminium Door
    "21003": (3900000.00, 0),         # Raja Waheed Kashmir Poultry
    "21004": (2500000.00, 0),         # Rana Asad
    "21006": (9264000.00, 0),         # Loan Return
    "21007": (200000.00, 0),          # Dr Khalid Arain
    "21008": (0, 1000000.00),         # Riaz Karachi (CR)
    
    # Revenue
    "4": (0, 300915650.07),           # Revenue (CR)
    "41": (0, 300915650.07),          # Net Sales
    "411": (0, 308503097.07),         # Gross sales value
    "412": (7587447.00, 0),           # Sales returned value (DR)
    
    # Expenses
    "5": (139341046.43, 0),           # Expense
    "51": (98207126.43, 0),           # Sales expenses
    "511": (72467770.63, 0),          # Cost ofgoods sold
    "5111": (80055217.63, 0),         # Actual cost of sold stock
    "5112": (0, 7587447.00),          # Actual cost of returned stock (CR)
    "512": (9628720.00, 0),           # Discounts
    "5121": (5309604.00, 0),          # Special discount on sale
    "5123": (4319116.00, 0),          # Discount on recovery
    "514": (6221469.80, 0),           # Expired stock actual value
    "516": (631000.00, 0),            # Staff Salary Advance
    "517": (4485000.00, 0),           # Salery Factory Staff
    "518": (4773166.00, 0),           # Salery SalesMan
    "52": (33525979.00, 0),           # General and admin expenses
    "52001": (1014420.00, 0),         # Factory Kitchen
    "52002": (2234500.00, 0),         # Zeeshan D.i / Drap
    "52005": (600000.00, 0),          # Product Regestration Fee DRAP
    "5202": (12689597.00, 0),         # Maintenance
    "52022": (152700.00, 0),          # Furniture and fixture
    "52023": (11780297.00, 0),        # Building and ground
    "5205": (3042750.00, 0),          # Travel & entertainment
    "52054": (1341700.00, 0),         # Entertainment
    "52055": (1381050.00, 0),         # Gasoline charges/Maintenance
    "5206": (884020.00, 0),           # Shipping
    "52062": (884020.00, 0),          # Supply expenses + Bilty
    "54": (7607941.00, 0),            # Other expenses
    "540": (586800.00, 0),            # Factory Utility Bills
    "54001": (0, 67095723.00),        # Shafeeq/ Ishaq (CR!)
    "544": (695000.00, 0),            # Foreign Tour
    "546": (1332300.00, 0),           # Dr.Abdul Razzaq Sb Travelling
    "547": (1922853.00, 0),           # Factory Karcha
    "548": (344000.00, 0),            # Shareef Machin
    "549": (1758088.00, 0),           # Team Expenses
    
    # Parties (Customers/Vendors) - from old TB
    "61": (0, 6449752.59),            # Vendors (CR)
    "62": (3813170.07, 0),            # Customers (DR)
    "63": (561500.00, 0),             # Salesmen
    "64": (33109607.00, 0),           # Personal
    "64002": (16510107.00, 0),        # DR.Abdul Razzaq Sb
    "64003": (816000.00, 0),          # LOAN
    "64004": (3000000.00, 0),         # Rana Anwaar
    "64005": (670500.00, 0),          # Rana Shezad
    "64006": (600000.00, 0),          # Mrs.Zahida Toba tek
    "64007": (213000.00, 0),          # Mrs.Farah
    "64008": (250000.00, 0),          # DR,ARSHAD Q.D.S
    "64009": (500000.00, 0),          # Riaz Bhai
    "64010": (10250000.00, 0),        # Rana ASHRAF
    "64011": (0, 300000.00),          # Abdul Rehman (CR)
}

ENTRY_DATE = "2025-07-01"  # Start of fiscal year


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def main():
    t0 = time.time()
    
    db = get_db()
    journal_repo = JournalRepository(db)
    accounting = AccountingService(db)
    
    # Get Retained Earnings account (3100) as the counter account
    re = db.fetch_one("SELECT id FROM accounts WHERE account_code = '3100' AND company_id = 1")
    if not re:
        log("FATAL: Retained Earnings (3100) not found")
        close_db()
        return
    re_id = re["id"]
    log(f"Using Retained Earnings account id={re_id}")
    
    # Verify all accounts exist
    missing = []
    for code in OLD_TB_OPENINGS:
        acc = db.fetch_one("SELECT id FROM accounts WHERE account_code = ? AND company_id = 1", (code,))
        if not acc:
            missing.append(code)
    
    if missing:
        log(f"WARNING: {len(missing)} accounts not found: {missing[:20]}")
    
    # Build journal entries
    journal_headers = []
    journal_lines = []
    voucher_numbers = journal_repo.next_voucher_numbers(1, "OPENING", len(OLD_TB_OPENINGS))
    
    created = 0
    for i, (code, (odr, ocr)) in enumerate(OLD_TB_OPENINGS.items()):
        net = odr - ocr
        if abs(net) < 0.01:
            continue
            
        acc = db.fetch_one("SELECT id, account_type FROM accounts WHERE account_code = ? AND company_id = 1", (code,))
        if not acc:
            continue
            
        acc_id = acc["id"]
        acc_type = acc["account_type"]
        
        # Determine debit/credit based on normal balance
        debit_normal = acc_type in ("ASSET", "EXPENSE")
        
        if net > 0:
            # Positive net = debit balance for debit-normal, credit for credit-normal
            if debit_normal:
                this_line = JournalLine(account_id=acc_id, debit=abs(net))
                equity_line = JournalLine(account_id=re_id, credit=abs(net))
            else:
                this_line = JournalLine(account_id=acc_id, credit=abs(net))
                equity_line = JournalLine(account_id=re_id, debit=abs(net))
        else:
            # Negative net
            if debit_normal:
                this_line = JournalLine(account_id=acc_id, credit=abs(net))
                equity_line = JournalLine(account_id=re_id, debit=abs(net))
            else:
                this_line = JournalLine(account_id=acc_id, debit=abs(net))
                equity_line = JournalLine(account_id=re_id, credit=abs(net))
        
        journal_lines.append([
            {"account_id": this_line.account_id, "debit": this_line.debit, "credit": this_line.credit, "description": this_line.description},
            {"account_id": equity_line.account_id, "debit": equity_line.debit, "credit": equity_line.credit, "description": equity_line.description},
        ])
        journal_headers.append({
            "company_id": 1,
            "voucher_number": voucher_numbers[i],
            "voucher_type": VoucherType.OPENING.value,
            "entry_date": ENTRY_DATE,
            "narration": f"Old TB opening balance {code} (PharmaPro import)",
            "source_table": None,
            "source_id": None,
            "is_posted": 1,
            "created_by": None,
        })
        created += 1
    
    log(f"Creating {created} OPENING journal entries...")
    
    try:
        with db.transaction():
            journal_repo.insert_entries_bulk(journal_headers, journal_lines)
        log(f"Successfully created {created} opening balance entries")
    except Exception as e:
        log(f"FATAL: {e}")
        close_db()
        return
    
    print("\n===== SUMMARY =====")
    print(f"Created: {created}")
    print(f"Elapsed: {time.time() - t0:.1f}s")
    
    close_db()


if __name__ == "__main__":
    main()