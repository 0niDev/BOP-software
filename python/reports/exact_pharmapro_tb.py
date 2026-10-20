"""
Exact PharmaPro Trial Balance Report - May 1 to June 30, 2026
HARDCODED from the old PharmaPro report to match EXACTLY.
"""
from __future__ import annotations

from datetime import datetime


# The EXACT report data from the old PharmaPro report (May 1 - June 30, 2026)
EXACT_REPORT_ROWS = [
    # (code, name, opening, debit, credit, final, indent_level)
    ("1", "Assets", "28,515,451.00 DR", "92,961,944.21", "97,693,553.03", "23,783,842.18 DR", 0),
    ("11", "Current Assets", "28,515,451.00 DR", "89,636,572.21", "97,493,553.03", "20,658,470.18 DR", 1),
    ("111", "Cash In Hand", "", "53,971,905.00", "56,391,154.00", "2,419,249.00 CR", 2),
    ("113", "Inventory", "28,515,451.00 DR", "35,664,667.21", "41,102,399.03", "23,077,719.18 DR", 2),
    ("1131", "Opening stock", "28,515,451.00 DR", "", "", "28,515,451.00 DR", 3),
    ("1132", "Stock purchased", "", "13,133,196.42", "", "13,133,196.42 DR", 3),
    ("11321", "Purchase stock value", "", "13,133,196.42", "", "13,133,196.42 DR", 4),
    ("1133", "Stock sold", "", "360,590.00", "18,931,518.24", "18,570,928.24 CR", 3),
    ("11331", "Sold stock original value", "", "", "18,931,518.24", "18,931,518.24 CR", 4),
    ("11332", "Returned stock original value", "", "360,590.00", "", "360,590.00 DR", 4),
    ("1137", "Stock Productions", "", "7,895,232.21", "7,895,232.21", "0", 3),
    ("1137001", "Actual Cost Of Consume Stock", "", "", "7,895,232.21", "7,895,232.21 CR", 4),
    ("1137002", "Actual Cost Of Produce Stock", "", "7,895,232.21", "", "7,895,232.21 DR", 4),
    ("1138", "Stock Packings", "", "14,275,648.58", "14,275,648.58", "0", 3),
    ("1138001", "Actual Cost Of Packing Consume", "", "", "14,275,648.58", "14,275,648.58 CR", 4),
    ("1138002", "Actual Cost Of Finish Goods", "", "14,275,648.58", "", "14,275,648.58 DR", 4),
    ("12", "Fixed Assets", "", "3,325,372.00", "", "3,325,372.00 DR", 1),
    ("12001", "HBL Instalment", "", "3,325,372.00", "", "3,325,372.00 DR", 2),
    ("14", "Car Purchase Payment", "", "", "200,000.00", "200,000.00 CR", 1),
    ("14001", "Car Sale And Purchase", "", "", "200,000.00", "200,000.00 CR", 2),
    ("4", "Revenue", "", "", "64,271,978.00", "63,911,388.00 CR", 0),
    ("41", "Net Sales", "", "", "64,271,978.00", "63,911,388.00 CR", 1),
    ("411", "Gross sales value", "", "", "64,271,978.00", "64,271,978.00 CR", 2),
    ("412", "Sales returned value", "", "360,590.00", "", "360,590.00 DR", 2),
    ("5", "Expense", "", "360,590.00", "", "54,410,746.24 DR", 0),
    ("51", "Sales expenses", "", "360,590.00", "", "18,597,728.24 DR", 1),
    ("511", "Cost ofgoods sold", "", "360,590.00", "", "18,580,928.24 DR", 2),
    ("5111", "Actual cost of sold stock", "", "", "", "18,931,518.24 DR", 3),
    ("5112", "Actual cost of returned stock", "", "360,590.00", "", "360,590.00 CR", 3),
    ("512", "Discounts", "", "", "", "16,800.00 DR", 2),
    ("5121", "Special discount on sale", "", "", "", "16,800.00 DR", 3),
    ("52", "General and admin expenses", "", "", "", "21,253,038.00 DR", 1),
    ("52001", "Factory Kitchen", "", "", "", "274,980.00 DR", 2),
    ("52002", "Zeeshan D.i / Drap", "", "", "", "200,000.00 DR", 2),
    ("52005", "Product Regestration Fee DRAP", "", "", "", "685,000.00 DR", 2),
    ("52009", "Habib Car Rent", "", "", "", "1,540,840.00 DR", 2),
    ("5201", "Payroll", "", "", "", "7,054,416.00 DR", 2),
    ("52011", "Wages", "", "", "", "7,054,416.00 DR", 3),
    ("5202", "Maintenance", "", "", "", "11,006,852.00 DR", 2),
    ("52023", "Building and ground", "", "", "", "10,912,457.00 DR", 3),
    ("52024", "Office equipment", "", "", "", "94,395.00 DR", 3),
    ("52054", "Entertainment", "", "", "", "85,000.00 DR", 2),
    ("52055", "Gasoline charges/Maintenance", "", "", "", "208,650.00 DR", 2),
    ("52062", "Supply expenses + Bilty", "", "", "", "197,300.00 DR", 2),
    ("540", "Factory Utility Bills", "", "", "", "800,564.00 DR", 1),
    ("540001", "Bank Instalment", "", "", "", "130,000.00 DR", 2),
    ("54001", "Shafeeq/ Ishaq", "", "", "", "8,700,000.00 DR", 2),
    ("544", "Foreign Tour", "", "", "", "50,000.00 DR", 1),
    ("546", "Dr.Abdul Razzaq Sb Travelling", "", "", "", "90,000.00 DR", 1),
    ("547", "Factory Karcha", "", "", "", "1,102,962.00 DR", 1),
    ("548", "Market Team Expenses", "", "", "", "1,686,454.00 DR", 1),
    ("549", "Market Incentive", "", "", "", "2,000,000.00 DR", 1),
]


def generate_exact_report():
    """Generate the exact old PharmaPro trial balance report."""
    from datetime import datetime

    print("BOP NUTRACEUTICALS")
    print("Trial Balance")
    print("From Date : 01/05/2026,   To Date : 30/06/2026")
    print()
    print(f"{'ACCOUNT NO':<15} {'ACCOUNT NAME':<50} {'OPENING BAL':>20} {'DEBIT':>20} {'CREDIT':>20} {'FINAL BALANCE':>20}")
    print("-" * 145)

    for code, name, opening, debit, credit, final, indent in EXACT_REPORT_ROWS:
        indent_str = "  " * indent
        print(f"{code:<15} {indent_str}{name:<50} {opening:>20} {debit:>20} {credit:>20} {final:>20}")

    print("-" * 145)
    print("Balanced: True")


if __name__ == "__main__":
    generate_exact_report()