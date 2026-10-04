"""
Hierarchical Trial Balance Report - Matches PharmaPro Format

Rolls up balances from leaf accounts to parent accounts using the
parent_account_id hierarchy. Shows Opening Bal, Debit, Credit, Final Balance.

Opening Balance = all posted entries before date_from (pre-period)
Current Period = posted non-OPENING entries within [date_from, date_to]
Both roll up from leaf (flat) accounts to hierarchical parents.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from collections import defaultdict

from reports.report_base import Report


# Mapping from flat account codes to PharmaPro hierarchical account codes
FLAT_TO_HIERARCHICAL = {
    # Assets
    "1000": "111",      # Cash in Hand -> Cash In Hand
    "1010": "112",      # Bank Accounts -> Bank Accounts
    "1100": "62",       # Accounts Receivable -> Customers
    "1200": "1132",     # Inventory - Raw Materials -> Stock purchased
    "1210": "1138",     # Inventory - Packing Materials -> Stock Packings
    "1220": "1133",     # Inventory - Finished Goods -> Stock sold
    "1501": "12001",    # HBL Instalment -> HBL Instalment
    "1502": "12003",    # Motor Car Instalment -> Instalment of Moter Car
    "1503": "121",      # Auto Vehicles -> Auto vehicles
    "1504": "122",      # Furniture & Fixtures -> Furniture and fixture
    "1505": "14001",    # Car Sale & Purchase -> Car Purchase Payment
    "1300": "131",      # Withholding Tax Receivable -> Salestax receivable
    "13001": "13001",   # Factory Machinery Purchase -> Factory Machinery Purchase
    
    # Liabilities
    "2000": "61",       # Accounts Payable -> Vendors
    "2100": "2100",     # Sales Tax Payable -> (self)
    
    # Revenue
    "4000": "411",      # Sales Revenue -> Gross sales value
    "4100": "412",      # Sales Returns -> Sales returned value
    
    # Expenses - COGS
    "5000": "5111",     # Cost of Goods Sold -> Actual cost of sold stock
    "5001": "5111",     # Cost of Packing Materials -> Actual cost of sold stock
    "5002": "5111",     # Cost of Raw Materials -> Actual cost of sold stock
    
    # Expenses - Sales
    "5113": "52021",    # Machine Repair -> Auto vehicles maintenance
    "5121": "5121",     # Special discount on sale -> Special discount on sale
    "5122": "5121",     # Special discount returned -> Special discount on sale
    "5123": "5123",     # Discount on recovery -> Discount on recovery
    "514": "514",       # Expired stock actual value -> Expired stock actual value
    "516": "516",       # Staff Salary Advance -> Staff Salary Advance
    "517": "52014",     # Salery Factory Staff -> Salary Factory Staff
    "518": "52015",     # Salery SalesMan -> Salary Market Staff
    "519": "52007",     # L.C MARKET EXP -> Liquid Yeast Purchase
    
    # Expenses - General Admin
    "5200": "5200",     # Manufacturing Wastage -> (no mapping)
    "52001": "52001",   # Factory Kitchen -> Factory Kitchen
    "52002": "52002",   # Zeeshan D.i / Drap -> Zeeshan D.i / Drap
    "52003": "52003",   # Womiqa Ahmad -> (no mapping)
    "52004": "52004",   # RAHEEL Adv -> (no mapping)
    "52005": "52005",   # Product Regestration Fee DRAP -> Product Regestration Fee DRAP
    "52006": "52006",   # IMRANULLAH -> (no mapping)
    "52007": "52007",   # Liquid Yeast Purchase -> Liquid Yeast Purchase
    "52008": "52008",   # Bank Alhabib L.C Account -> Bank Alhabib L.C Account
    "52009": "52009",   # Habib Car Rent -> Habib Car Rent
    "52010": "52010",   # Zafer Iqbal Profit -> Zafer Iqbal Profit
    "52011": "52011",   # Wages -> Wages
    "52014": "52014",   # Salary Factory Staff -> Salary Factory Staff
    "52015": "52015",   # Salary Market Staff -> Salary Market Staff
    "5202": "5202",     # Maintenance -> Maintenance
    "52021": "52021",   # Auto vehicles -> Auto vehicles
    "52022": "52022",   # Furniture and fixture -> Furniture and fixture
    "52023": "52023",   # Building and ground -> Building and ground
    "52024": "52024",   # Office equipment -> Office equipment
    "52025": "52025",   # Computer and software -> Computer & software
    "52026": "52026",   # Staitionary -> (no mapping)
    "5203": "5203",     # Depriciation -> Depriciation
    "5205": "5205",     # Travel & entertainment -> Travel & entertainment
    "52054": "52054",   # Entertainment -> Entertainment
    "52055": "52055",   # Gasoline charges/Maintenance -> Gasoline charges/Maintenance
    "5206": "5206",     # Shipping -> Shipping
    "52062": "52062",   # Supply expenses + Bilty -> Supply expenses + Bilty
    "52063": "52063",   # Insurance -> (no mapping)
    "5209": "5209",     # Overhead expenes -> Overhead expenes
    "520901": "520901", # Telephone and faxes -> Telephone and faxes
    "520902": "520902", # Internet expenses -> (no mapping)
    "520904": "520904", # Utitlity expenses -> Utitlity expenses
    "520905": "520905", # Advertising -> Advertising
    "520910": "520910", # Promotion public relations -> Promotion public relations
    
    # Expenses - Other
    "540": "540",       # Factory Utility Bills -> Factory Utility Bills
    "540001": "540001", # Bank Instalment -> Bank Instalment
    "54001": "54001",   # Shafeeq/ Ishaq -> Shafeeq/ Ishaq
    "542": "542",       # Overtime Factory Staf -> (no mapping)
    "543": "543",       # Choker Crush -> (no mapping)
    "544": "544",       # Foreign Tour -> Foreign Tour
    "545": "545",       # Zafer Khan Sb Travelling -> (no mapping)
    "546": "546",       # Dr.Abdul Razzaq Sb Travelling -> Dr.Abdul Razzaq Sb Travelling
    "547": "547",       # Factory Karcha -> Factory Karcha
    "548": "548",       # Shareef Machin -> Shareef Machin
    "549": "549",       # Team Expenses -> Team Expenses
    "55001": "55001",   # Car And Loader Vehciles Repair -> (no mapping)
    
    # Personal expenses
    "64002": "64002",   # Personal & House Expenses -> Personal & House Expenses
    "64008": "64008",   # Miscellaneous Expenses -> Miscellaneous Expenses
}


class HierarchicalTrialBalanceReport(Report):
    """Trial Balance with hierarchical rollup: Opening Bal, Debit, Credit, Final Balance."""

    def __init__(self):
        super().__init__()
        self.title = "Hierarchical Trial Balance"

    def generate(self) -> dict:
        has_range = bool(self.date_from and self.date_to)

        if has_range:
            # Opening = all posted entries BEFORE date_from, PLUS all OPENING vouchers (regardless of date)
            opening_cte = """
                WHERE je.is_posted = 1
                AND je.company_id = ?
                AND (je.entry_date < ? OR je.voucher_type = 'OPENING')
            """
            # Current = posted non-OPENING entries within [date_from, date_to]
            current_cte = """
                WHERE je.is_posted = 1
                AND je.company_id = ?
                AND je.voucher_type != 'OPENING'
                AND je.entry_date >= ?
                AND je.entry_date <= ?
            """
            params: tuple = (
                self.company_id, self.date_from,           # opening
                self.company_id, self.date_from, self.date_to,  # current
                self.company_id,                           # outer filter
            )
        else:
            # No date range: opening = OPENING vouchers, current = everything else
            opening_cte = """
                WHERE je.is_posted = 1
                AND je.company_id = ?
                AND je.voucher_type = 'OPENING'
            """
            current_cte = """
                WHERE je.is_posted = 1
                AND je.company_id = ?
                AND je.voucher_type != 'OPENING'
            """
            params = (self.company_id, self.company_id, self.company_id)

        # Get all accounts with their direct balances
        rows = self.db.fetch_all(f"""
            WITH opening_balances AS (
                SELECT
                    jel.account_id,
                    COALESCE(SUM(jel.debit), 0) as odr,
                    COALESCE(SUM(jel.credit), 0) as ocr
                FROM journal_entry_lines jel
                JOIN journal_entries je ON je.id = jel.journal_entry_id
                {opening_cte}
                GROUP BY jel.account_id
            ),
            current_balances AS (
                SELECT
                    jel.account_id,
                    COALESCE(SUM(jel.debit), 0) as total_debit,
                    COALESCE(SUM(jel.credit), 0) as total_credit
                FROM journal_entry_lines jel
                JOIN journal_entries je ON je.id = jel.journal_entry_id
                {current_cte}
                GROUP BY jel.account_id
            )
            SELECT
                a.id,
                a.account_code,
                a.account_name,
                a.account_type,
                a.parent_account_id,
                COALESCE(ob.odr, 0) as odr,
                COALESCE(ob.ocr, 0) as ocr,
                COALESCE(cb.total_debit, 0) as total_debit,
                COALESCE(cb.total_credit, 0) as total_credit
            FROM accounts a
            LEFT JOIN opening_balances ob ON ob.account_id = a.id
            LEFT JOIN current_balances cb ON cb.account_id = a.id
            WHERE a.company_id = ? AND a.is_active = 1
            ORDER BY a.account_code
        """, params)

        # Build account tree - include ALL accounts (hierarchical + flat)
        accounts = {}
        children = defaultdict(list)
        root_accounts = []
        code_to_id = {}

        for row in rows:
            acc = {
                'id': row['id'],
                'code': row['account_code'],
                'name': row['account_name'],
                'type': row['account_type'],
                'parent_id': row['parent_account_id'],
                'odr': Decimal(str(row['odr'])),
                'ocr': Decimal(str(row['ocr'])),
                'total_debit': Decimal(str(row['total_debit'])),
                'total_credit': Decimal(str(row['total_credit'])),
                'children': [],
                'is_flat': row['account_code'] in FLAT_TO_HIERARCHICAL,
                'hierarchical_code': FLAT_TO_HIERARCHICAL.get(row['account_code']),
            }
            accounts[row['id']] = acc
            code_to_id[row['account_code']] = row['id']
            if row['parent_account_id'] and row['parent_account_id'] in accounts:
                children[row['parent_account_id']].append(row['id'])
            elif row['parent_account_id'] is None:
                root_accounts.append(row['id'])

        # Add current period activity from flat accounts to their hierarchical targets
        # ONLY roll up current period (debit/credit), NOT opening balances
        for acc in accounts.values():
            if acc['is_flat'] and acc['hierarchical_code']:
                target_id = code_to_id.get(acc['hierarchical_code'])
                if target_id and target_id in accounts:
                    target = accounts[target_id]
                    target['total_debit'] += acc['total_debit']
                    target['total_credit'] += acc['total_credit']
                    # Don't roll up odr/ocr - opening balances computed from pre-period entries

        # Compute rollup balances (post-order traversal)
        def compute_balances(acc_id):
            acc = accounts[acc_id]
            # Start with direct balances
            odr = acc['odr']
            ocr = acc['ocr']
            total_debit = acc['total_debit']
            total_credit = acc['total_credit']

            # Add children's balances
            for child_id in children.get(acc_id, []):
                child = compute_balances(child_id)
                # For flat children, only roll up current period activity (debit/credit)
                # NOT opening balances - opening balances computed from pre-period entries
                if child.get('is_flat'):
                    total_debit += child['total_debit']
                    total_credit += child['total_credit']
                else:
                    odr += child['odr']
                    ocr += child['ocr']
                    total_debit += child['total_debit']
                    total_credit += child['total_credit']

            # Apply normal balance logic for current period
            acc_type = acc['type']
            if acc_type in ['ASSET', 'EXPENSE']:
                net = total_debit - total_credit
                if net >= 0:
                    cdr = net
                    ccr = Decimal('0')
                else:
                    cdr = Decimal('0')
                    ccr = -net
            else:
                net = total_credit - total_debit
                if net >= 0:
                    cdr = Decimal('0')
                    ccr = net
                else:
                    cdr = -net
                    ccr = Decimal('0')

            acc['odr'] = odr
            acc['ocr'] = ocr
            acc['cdr'] = cdr
            acc['ccr'] = ccr
            acc['total_debit'] = total_debit
            acc['total_credit'] = total_credit
            acc['final_dr'] = odr + cdr
            acc['final_cr'] = ocr + ccr
            acc['final_net'] = acc['final_dr'] - acc['final_cr']

            return acc

        for root_id in root_accounts:
            compute_balances(root_id)

        # Build output rows in hierarchical order - ONLY hierarchical accounts (not flat)
        output_rows = []
        total_odr = Decimal('0')
        total_ocr = Decimal('0')
        total_cdr = Decimal('0')
        total_ccr = Decimal('0')

        def add_rows(acc_id, level=0):
            nonlocal total_odr, total_ocr, total_cdr, total_ccr
            acc = accounts[acc_id]
            # Only show hierarchical accounts (not flat) with non-zero balances
            if not acc['is_flat'] and (acc['odr'] != 0 or acc['ocr'] != 0 or
                acc['cdr'] != 0 or acc['ccr'] != 0):
                output_rows.append({
                    'level': level,
                    'code': acc['code'],
                    'name': acc['name'],
                    'type': acc['type'],
                    'opening_dr': float(acc['odr']),
                    'opening_cr': float(acc['ocr']),
                    'debit': float(acc['total_debit']),
                    'credit': float(acc['total_credit']),
                    'final_dr': float(acc['final_dr']),
                    'final_cr': float(acc['final_cr']),
                    'final_net': float(acc['final_net']),
                    'is_parent': len(children.get(acc_id, [])) > 0,
                })
                if level == 0:
                    total_odr += acc['odr']
                    total_ocr += acc['ocr']
                    total_cdr += acc['cdr']
                    total_ccr += acc['ccr']

            for child_id in children.get(acc_id, []):
                add_rows(child_id, level + 1)

        for root_id in root_accounts:
            add_rows(root_id)

        grand_dr = float(total_odr + total_cdr)
        grand_cr = float(total_ocr + total_ccr)
        is_balanced = abs(grand_dr - grand_cr) < 0.01

        return {
            "title": self.title,
            "period_label": self._get_period_label(),
            "generated_at": datetime.now().isoformat(),
            "rows": output_rows,
            "total_odr": float(total_odr),
            "total_ocr": float(total_ocr),
            "total_cdr": float(total_cdr),
            "total_ccr": float(total_ccr),
            "grand_total_dr": grand_dr,
            "grand_total_cr": grand_cr,
            "is_balanced": is_balanced,
            "balance_diff": float(abs(grand_dr - grand_cr)),
        }

    def _get_period_label(self) -> str:
        if self.date_from and self.date_to:
            return f"From Date : {self.date_from},   To Date : {self.date_to}"
        elif self.date_to:
            return f"As at {self.date_to}"
        else:
            return f"As at {datetime.now().strftime('%d/%m/%Y')}"