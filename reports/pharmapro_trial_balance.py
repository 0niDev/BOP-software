"""
Old-Style PharmaPro Trial Balance Report
Rolls up NEW flat codes into full OLD PharmaPro hierarchy with parent aggregation.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from reports.report_base import Report


# Direct mapping: NEW flat code -> OLD PharmaPro LEAF code (most specific)
NEW_TO_OLD_MAP = {
    # Assets - Cash & Bank
    "1000": "111",      # Cash in Hand
    "1010": "112",      # Bank Accounts
    
    # Assets - A/R
    "1100": "11",       # A/R -> Current Assets (will roll up)
    
    # Assets - Inventory
    "1200": "11321",    # Raw Materials -> Purchase stock value
    "1210": "1138002",  # Packing Materials -> Actual Cost Of Finish Goods
    "1220": "11331",    # Finished Goods -> Sold stock original value
    
    # Assets - Fixed Assets
    "1501": "12001",    # HBL Instalment
    "1502": "12002",    # Motor Car Instalment
    "1503": "1211",     # Auto Vehicles
    "1504": "1221",     # Furniture & Fixtures
    "1505": "14001",    # Car Sale & Purchase
    
    # Liabilities
    "2000": "21",       # A/P -> Short term liabilities
    
    # Equity
    "3100": "3",        # Retained Earnings -> Owner's Equity
    
    # Revenue
    "4000": "411",      # Sales Revenue -> Gross sales value
    "4100": "412",      # Sales Returns -> Sales returned value
    
    # COGS / Inventory adjustments
    "5000": "5111",     # COGS -> Actual cost of sold stock
    "5001": "1138001",  # Packing COGS -> Actual Cost Of Packing Consume
    "5002": "1137001",  # Raw Material COGS -> Actual Cost Of Consume Stock
    
    # Expenses
    "5113": "5121",
    "519": "5121",
    "5121": "5121",
    "52001": "52001",
    "52002": "52002",
    "52003": "52002",
    "52004": "52004",
    "52005": "52005",
    "52006": "52006",
    "52007": "52007",
    "52008": "52008",
    "52009": "52008",
    "52010": "52001",
    "52011": "52011",
    "52014": "52011",
    "52015": "52011",
    "52022": "52022",
    "52023": "52023",
    "52024": "52024",
    "52054": "52054",
    "52055": "52055",
    "52062": "52062",
    "520907": "52007",
    "5211001": "52011",
    "540": "540",
    "540001": "540001",
    "54001": "54001",
    "544": "544",
    "546": "546",
    "547": "547",
    "548": "548",
    "549": "549",
    "55001": "540",
    "64002": "64002",
    "64008": "64008",
}

# Complete PharmaPro hierarchy: code -> (name, parent)
PHARMAPRO_HIERARCHY = {
    "1": ("Assets", None),
    "11": ("Current Assets", "1"),
    "111": ("Cash In Hand", "11"),
    "112": ("Bank Accounts", "11"),
    "113": ("Inventory", "11"),
    "1131": ("Opening stock", "113"),
    "1132": ("Stock purchased", "113"),
    "11321": ("Purchase stock value", "1132"),
    "11322": ("Returned stock value", "1132"),
    "1133": ("Stock sold", "113"),
    "11331": ("Sold stock original value", "1133"),
    "11332": ("Returned stock original value", "1133"),
    "1134": ("Stock got from expiry claims", "113"),
    "1135": ("Stock given for expiry claims", "113"),
    "1136": ("Stock expired", "113"),
    "1137": ("Stock Productions", "113"),
    "1137001": ("Actual Cost Of Consume Stock", "1137"),
    "1137002": ("Actual Cost Of Produce Stock", "1137"),
    "1138": ("Stock Packings", "113"),
    "1138001": ("Actual Cost Of Packing Consume", "1138"),
    "1138002": ("Actual Cost Of Finish Goods", "1138"),
    "12": ("Fixed Assets", "1"),
    "121": ("Auto vehicles", "12"),
    "1211": ("Auto vehicles: Original value", "121"),
    "122": ("Furniture and fixture", "12"),
    "1221": ("Fur and Fix: Original value", "122"),
    "123": ("Building and grounds", "12"),
    "1231": ("Building and G: Original value", "123"),
    "13": ("Other assets", "1"),
    "13001": ("Factory Machinery Purchase", "13"),
    "14": ("Car Purchase Payment", "1"),
    "14001": ("Car Sale And Purchase", "14"),
    "12001": ("HBL Instalment", "12"),
    "12002": ("Instalment of Moter Bike", "12"),
    "12003": ("Instalment of Moter Car", "12"),
    
    "2": ("Liabilities", None),
    "21": ("Short term liabilities", "2"),
    "21001": ("Atta Lab", "21"),
    "21002": ("Anaiyat Aluminium Door", "21"),
    "21003": ("Raja Waheed Kashmir Poultry", "21"),
    "21004": ("Rana Asad", "21"),
    "21006": ("Loan Return", "21"),
    "21007": ("Dr Khalid Arain", "21"),
    "21008": ("Riaz Karachi", "21"),
    
    "3": ("Owner's Equity", None),
    "3100": ("Retained Earnings", "3"),
    
    "4": ("Revenue", None),
    "41": ("Net Sales", "4"),
    "411": ("Gross sales value", "41"),
    "412": ("Sales returned value", "41"),
    
    "5": ("Expense", None),
    "51": ("Sales expenses", "5"),
    "511": ("Cost of goods sold", "51"),
    "5111": ("Actual cost of sold stock", "511"),
    "5112": ("Actual cost of returned stock", "511"),
    "512": ("Discounts", "51"),
    "5121": ("Special discount on sale", "512"),
    "5123": ("Discount on recovery", "512"),
    "514": ("Expired stock actual value", "51"),
    "516": ("Staff Salary Advance", "51"),
    "517": ("Salery Factory Staff", "51"),
    "518": ("Salery SalesMan", "51"),
    "52": ("General and admin expenses", "5"),
    "52001": ("Factory Kitchen", "52"),
    "52002": ("Zeeshan D.i / Drap", "52"),
    "52003": ("Womiqa Ahmad", "52"),
    "52004": ("RAHEEL Adv", "52"),
    "52005": ("Product Regestration Fee DRAP", "52"),
    "52006": ("IMRANULLAH (Labour inspecter)", "52"),
    "52007": ("Liquid Yeast Purchase", "52"),
    "52008": ("Bank Alhabib L.C Account", "52"),
    "5201": ("Payroll", "52"),
    "52011": ("Wages", "5201"),
    "5202": ("Maintenance", "52"),
    "52021": ("Auto vehicles", "5202"),
    "52022": ("Furniture and fixture", "5202"),
    "52023": ("Building and ground", "5202"),
    "52054": ("Entertainment", "52"),
    "52055": ("Gasoline charges/Maintenance", "52"),
    "52062": ("Supply expenses + Bilty", "52"),
    "540": ("Factory Utility Bills", "5"),
    "540001": ("Bank Instalment", "540"),
    "54001": ("Shafeeq/ Ishaq", "540"),
    "544": ("Foreign Tour", "5"),
    "546": ("Dr.Abdul Razzaq Sb Travelling", "5"),
    "547": ("Factory Karcha", "5"),
    "548": ("Shareef Machin", "5"),
    "549": ("Team Expenses", "5"),
    "64002": ("Personal & House Expenses", "5"),
    "64008": ("Miscellaneous Expenses", "5"),
}


class PharmaProTrialBalanceReport(Report):
    """Trial Balance using old PharmaPro hierarchical account codes with full parent rollup."""

    def __init__(self):
        super().__init__()
        self.title = "BOP NUTRACEUTICALS - Trial Balance"

    def generate(self) -> dict:
        has_range = bool(self.date_from and self.date_to)

        if has_range:
            opening_cte = """
                WHERE je.is_posted = 1
                AND je.company_id = ?
                AND (je.voucher_type = 'OPENING' OR je.entry_date < ?)
            """
            current_cte = """
                WHERE je.is_posted = 1
                AND je.company_id = ?
                AND je.voucher_type != 'OPENING'
                AND je.entry_date >= ?
                AND je.entry_date <= ?
            """
            params: tuple = (
                self.company_id, self.date_from,
                self.company_id, self.date_from, self.date_to,
                self.company_id,
            )
        else:
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

        # Get balances for NEW flat codes
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
                a.account_code,
                a.account_name,
                a.account_type,
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

        # Step 1: Accumulate balances by OLD LEAF code
        leaf_balances = {}
        for row in rows:
            new_code = row['account_code']
            old_code = NEW_TO_OLD_MAP.get(new_code)
            if not old_code:
                continue
            odr = Decimal(str(row['odr']))
            ocr = Decimal(str(row['ocr']))
            total_debit = Decimal(str(row['total_debit']))
            total_credit = Decimal(str(row['total_credit']))

            if odr == 0 and ocr == 0 and total_debit == 0 and total_credit == 0:
                continue

            acc_type = row['account_type']
            if acc_type in ['ASSET', 'EXPENSE']:
                net = total_debit - total_credit
                cdr = net if net >= 0 else Decimal('0')
                ccr = -net if net < 0 else Decimal('0')
            else:
                net = total_credit - total_debit
                cdr = -net if net < 0 else Decimal('0')
                ccr = net if net >= 0 else Decimal('0')

            if old_code not in leaf_balances:
                leaf_balances[old_code] = {"odr": Decimal('0'), "ocr": Decimal('0'), "cdr": Decimal('0'), "ccr": Decimal('0'), "type": acc_type}
            leaf_balances[old_code]["odr"] += odr
            leaf_balances[old_code]["ocr"] += ocr
            leaf_balances[old_code]["cdr"] += cdr
            leaf_balances[old_code]["ccr"] += ccr
            if len(old_code) > len(str(leaf_balances[old_code].get("type", ""))):
                leaf_balances[old_code]["type"] = acc_type

        # Step 2: Build full hierarchy with rollup
        # Start with all hierarchy codes, initialize from leaf_balances
        all_balances = {}
        for code in PHARMAPRO_HIERARCHY:
            all_balances[code] = {"odr": Decimal('0'), "ocr": Decimal('0'), "cdr": Decimal('0'), "ccr": Decimal('0'), "type": "ASSET"}

        # Populate leaf balances
        for code, bal in leaf_balances.items():
            if code in all_balances:
                all_balances[code]["odr"] = bal["odr"]
                all_balances[code]["ocr"] = bal["ocr"]
                all_balances[code]["cdr"] = bal["cdr"]
                all_balances[code]["ccr"] = bal["ccr"]
                all_balances[code]["type"] = bal["type"]

        # Step 3: Roll up from leaves to root (process deepest first)
        codes_by_depth = sorted(all_balances.keys(), key=lambda x: -len(x))
        for code in codes_by_depth:
            parent = PHARMAPRO_HIERARCHY.get(code, ("", ""))[1]
            if parent and parent in all_balances:
                all_balances[parent]["odr"] += all_balances[code]["odr"]
                all_balances[parent]["ocr"] += all_balances[code]["ocr"]
                all_balances[parent]["cdr"] += all_balances[code]["cdr"]
                all_balances[parent]["ccr"] += all_balances[code]["ccr"]

        # Step 4: Build display hierarchy (only codes with non-zero balances)
        def has_balance(code):
            bal = all_balances[code]
            return bal["odr"] != 0 or bal["ocr"] != 0 or bal["cdr"] != 0 or bal["ccr"] != 0

        def build_display_tree(parent_code=None):
            children = []
            for code, (name, parent) in PHARMAPRO_HIERARCHY.items():
                if parent == parent_code:
                    # Include if has balance OR has descendants with balance
                    has_bal = has_balance(code)
                    has_kids = any(has_balance(k) for k, (_, p) in PHARMAPRO_HIERARCHY.items() if p == code)
                    if has_bal or has_kids:
                        children.append(code)
            children.sort(key=lambda x: (len(x), x))
            result = []
            for code in children:
                if has_balance(code):
                    result.append(code)
                result.extend(build_display_tree(code))
            return result

        display_order = build_display_tree(None)

        # Step 5: Generate output rows
        rows_output = []
        for code in display_order:
            name = PHARMAPRO_HIERARCHY.get(code, ("", ""))[0]
            if not name:
                continue
            bal = all_balances[code]
            odr, ocr, cdr, ccr = bal["odr"], bal["ocr"], bal["cdr"], bal["ccr"]
            acc_type = bal.get("type", "ASSET")

            if odr == 0 and ocr == 0 and cdr == 0 and ccr == 0:
                continue

            is_debit_normal = acc_type in ['ASSET', 'EXPENSE']

            final_dr = odr + cdr
            final_cr = ocr + ccr

            if is_debit_normal:
                if final_dr >= final_cr:
                    final_balance = f"{float(final_dr - final_cr):,.2f} DR"
                else:
                    final_balance = f"{float(final_cr - final_dr):,.2f} CR"
            else:
                if final_cr >= final_dr:
                    final_balance = f"{float(final_cr - final_dr):,.2f} CR"
                else:
                    final_balance = f"{float(final_dr - final_cr):,.2f} DR"

            level = 0
            temp = code
            while temp in PHARMAPRO_HIERARCHY and PHARMAPRO_HIERARCHY[temp][1]:
                level += 1
                temp = PHARMAPRO_HIERARCHY[temp][1]
            indent = "  " * level
            rows_output.append({
                "code": code,
                "name": f"{indent}{name}",
                "odr": float(odr),
                "ocr": float(ocr),
                "cdr": float(cdr),
                "ccr": float(ccr),
                "final_balance": final_balance,
            })

        # Totals: sum root accounts only (1, 2, 4, 5, 3) to avoid double-counting
        root_codes = ["1", "2", "3", "4", "5"]
        total_odr = sum(Decimal(str(all_balances[c]["odr"])) for c in root_codes if c in all_balances)
        total_ocr = sum(Decimal(str(all_balances[c]["ocr"])) for c in root_codes if c in all_balances)
        total_cdr = sum(Decimal(str(all_balances[c]["cdr"])) for c in root_codes if c in all_balances)
        total_ccr = sum(Decimal(str(all_balances[c]["ccr"])) for c in root_codes if c in all_balances)

        grand_dr = float(total_odr + total_cdr)
        grand_cr = float(total_ocr + total_ccr)
        is_balanced = abs(grand_dr - grand_cr) < 0.01

        return {
            "title": "BOP NUTRACEUTICALS - Trial Balance",
            "period_label": f"From Date : {self.date_from or '01/01/2026'},   To Date : {self.date_to or datetime.now().strftime('%d/%m/%Y')}",
            "generated_at": datetime.now().isoformat(),
            "rows": rows_output,
            "total_odr": float(total_odr),
            "total_ocr": float(total_ocr),
            "total_cdr": float(total_cdr),
            "total_ccr": float(total_ccr),
            "grand_total_dr": grand_dr,
            "grand_total_cr": grand_cr,
            "is_balanced": is_balanced,
            "balance_diff": float(abs(grand_dr - grand_cr)),
        }


if __name__ == "__main__":
    from utils.env_loader import setup_import_env
    setup_import_env()

    report = PharmaProTrialBalanceReport()
    report.set_date_range("2026-01-01", "2027-04-14")
    result = report.generate()

    print(f"{result['title']}")
    print(f"{result['period_label']}")
    print()
    print(f"{'ACCOUNT NO':<15} {'ACCOUNT NAME':<50} {'OPENING BAL':>20} {'DEBIT':>20} {'CREDIT':>20} {'FINAL BALANCE':>20}")
    print("-" * 145)
    for r in result['rows']:
        opening = ""
        if r['odr'] > 0:
            opening = f"{r['odr']:>20,.2f} DR"
        elif r['ocr'] > 0:
            opening = f"{r['ocr']:>20,.2f} CR"

        debit = f"{r['cdr']:>20,.2f}" if r['cdr'] > 0 else ""
        credit = f"{r['ccr']:>20,.2f}" if r['ccr'] > 0 else ""

        print(f"{r['code']:<15} {r['name']:<50} {opening:>20} {debit:>20} {credit:>20} {r['final_balance']:>20}")

    print("-" * 145)
    print(f"TOTALS{'':<64} {result['total_odr']:>20,.2f} {result['total_cdr']:>20,.2f} {result['total_ccr']:>20,.2f}")
    print(f"Balanced: {result['is_balanced']}, Diff: {result['balance_diff']:,.2f}")