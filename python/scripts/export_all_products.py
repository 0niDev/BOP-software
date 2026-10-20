"""Export all products from PharmaPro Full Export and current DB into one Excel file.

Output: EXPORTS/All_Products.xlsx
Sheets: PharmaPro Export, Current DB
"""
from __future__ import annotations

import csv
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from utils.env_loader import setup_import_env
setup_import_env()

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from database.connection import get_db

EXPORT_DIR = os.path.join(ROOT, "PharmaPro_FullExport")
OUT_DIR = os.path.join(ROOT, "EXPORTS")

TYPE_LABEL = {
    "00": "Finished Good",
    "01": "Raw Material",
    "02": "Packing Material",
    "03": "Semi-Finished (Bulk)",
}

TITLE_FILL = PatternFill("solid", fgColor="1F3864")
TITLE_FONT = Font(bold=True, color="FFFFFF", size=11)
THIN = Side(style="thin", color="BFBFBF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def write_header(ws, headers, widths):
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for col, text in enumerate(headers, 1):
        c = ws.cell(row=1, column=col, value=text)
        c.font = TITLE_FONT
        c.fill = TITLE_FILL
        c.border = BORDER
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[1].height = 28
    ws.freeze_panes = "A2"


def main():
    wb = Workbook()

    # ---- Sheet 1: PharmaPro Export ----
    ws1 = wb.active
    ws1.title = "PharmaPro Export"

    path = os.path.join(EXPORT_DIR, "Products.csv")
    with open(path, encoding="utf-8-sig") as f:
        old_rows = list(csv.DictReader(f))

    headers = ["ID", "Product Name", "Type", "Packing", "Purchase Price",
               "Trade Price", "Retail Price", "Min Stock", "Active"]
    widths = [10, 45, 20, 12, 16, 16, 16, 12, 10]
    write_header(ws1, headers, widths)

    for i, r in enumerate(old_rows, 2):
        pid = r["ProductId"].strip().zfill(5)
        cid = (r.get("CompanyId") or "").strip()
        vals = [
            pid,
            (r.get("ProductName") or "").strip(),
            TYPE_LABEL.get(cid, "Other"),
            (r.get("Packing") or "").strip(),
            r.get("PurchasePrice", "0"),
            r.get("TradePrice", "0"),
            r.get("RetailPrice", "0"),
            r.get("MinStockLevel", "0"),
            r.get("IsActive", "True"),
        ]
        for col, v in enumerate(vals, 1):
            c = ws1.cell(row=i, column=col, value=v)
            c.border = BORDER

    ws1.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(old_rows)+1}"
    print(f"PharmaPro Export: {len(old_rows)} products")

    # ---- Sheet 2: Current DB ----
    ws2 = wb.create_sheet("Current DB")

    db = get_db()
    rows = db.fetch_all(
        "SELECT item_code, item_name, item_type, unit, purchase_price, "
        "selling_price, minimum_stock, maximum_stock, is_active FROM items "
        "WHERE is_active = 1 "
        "ORDER BY item_code"
    )

    headers2 = ["Code", "Product Name", "Item Type", "Unit", "Purchase Price",
                 "Selling Price", "Min Stock", "Max Stock", "Active"]
    widths2 = [12, 45, 20, 10, 16, 16, 12, 12, 10]
    write_header(ws2, headers2, widths2)

    for i, row in enumerate(rows, 2):
        vals = [
            (row["item_code"] or "").strip(),
            (row["item_name"] or "").strip(),
            row["item_type"] or "",
            row["unit"] or "",
            row["purchase_price"] or 0,
            row["selling_price"] or 0,
            row["minimum_stock"] or 0,
            row["maximum_stock"] or 0,
            "Yes" if row["is_active"] else "No",
        ]
        for col, v in enumerate(vals, 1):
            c = ws2.cell(row=i, column=col, value=v)
            c.border = BORDER

    ws2.auto_filter.ref = f"A1:{get_column_letter(len(headers2))}{len(rows)+1}"
    print(f"Current DB: {len(rows)} products")

    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, "All_Products.xlsx")
    wb.save(out)
    print(f"Saved: {out}")


if __name__ == "__main__":
    main()
