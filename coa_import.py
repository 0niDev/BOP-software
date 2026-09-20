"""
Import chart of accounts from PharmaPro_FullExport/ChartOfAccounts.csv into the
target database. Skips accounts that already exist (account_code + company_id).
Converts PharmaPro account types to BOP account types.
"""

import csv
import os
import sys
import time

from utils.env_loader import setup_import_env
setup_import_env()

from database.connection import get_db, close_db

COA_FILE = "PharmaPro_FullExport/ChartOfAccounts.csv"

# PharmaPro AccountType -> BOP account_type mapping
TYPE_MAP = {
    "Asset": "ASSET",
    "Liability": "LIABILITY",
    "Equity": "EQUITY",
    "Income": "REVENUE",
    "Expense": "EXPENSE",
}

SUBTYPE_MAP = {
    "Asset": {
        "Current Asset": "CURRENT_ASSET",
        "Fixed Asset": "NON_CURRENT_ASSET",
    },
    "Liability": {
        "Current Liability": "CURRENT_LIABILITY",
        "Non-current Liability": "NON_CURRENT_LIABILITY",
    },
}

def main() -> None:
    t0 = time.time()
    log = lambda msg: print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)
    
    if not os.path.exists(COA_FILE):
        log(f"FATAL: {COA_FILE} not found. Ensure the PharmaPro_FullExport folder exists.")
        sys.exit(1)
    
    log(f"Reading COA from {COA_FILE}")
    rows = []
    with open(COA_FILE, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            code = (row["AccountNo"] or "").strip()
            name = (row["AccountName"] or "").strip()
            ptype = (row.get("AccountType") or "").strip()
            subtype = (row.get("AccountDepth") or "").strip()
            
            if not code or not name:
                continue
            
            bop_type = TYPE_MAP.get(ptype)
            if not bop_type:
                log(f"  WARNING: unknown account type '{ptype}' for {code} {name} — skipping")
                continue
            
            # Determine subtype
            bop_subtype = None
            if ptype in SUBTYPE_MAP and subtype in SUBTYPE_MAP[ptype]:
                bop_subtype = SUBTYPE_MAP[ptype][subtype]
            elif ptype in ("ASSET", "LIABILITY"):
                bop_subtype = "CURRENT_ASSET" if ptype == "ASSET" else "CURRENT_LIABILITY"
            
            # Skip system header accounts (depth 0-1) that are just categories
            # Keep real accounts (depth 2+) and system accounts
            depth = int(row.get("AccountDepth") or 0)
            is_system = (row.get("IsPosted") or "").strip().lower() == "true" or code in ("1000", "1010", "1100", "1200", "1210", "1220", "1300", "2000", "2100", "2200", "3000", "3100", "4000", "4100", "5000", "5001", "5100", "5200", "5300", "6000")
            
            rows.append({
                "code": code,
                "name": name,
                "type": bop_type,
                "subtype": bop_subtype,
                "depth": depth,
                "is_system": is_system,
            })
    
    log(f"Parsed {len(rows)} accounts from COA file")
    
    db = get_db()
    created = 0
    skipped = 0
    failed = 0
    
    for acc in rows:
        # Check if account exists
        existing = db.fetch_one(
            "SELECT id, account_name FROM accounts WHERE company_id = 1 AND account_code = ?",
            (acc["code"],)
        )
        if existing:
            if existing["account_name"] != acc["name"]:
                db.execute(
                    "UPDATE accounts SET account_name = ? WHERE id = ?",
                    (acc["name"], existing["id"])
                )
                log(f"  UPD   {acc['code']} {acc['name']}")
                skipped += 1
            else:
                log(f"  SKIP  {acc['code']} {acc['name']}")
                skipped += 1
            continue
        
        try:
            db.execute(
                """
                INSERT INTO accounts
                    (company_id, account_code, account_name, account_type,
                     account_subtype, is_system_account, is_active)
                VALUES (1, ?, ?, ?, ?, ?, 1)
                """,
                (acc["code"], acc["name"], acc["type"], acc["subtype"], int(acc["is_system"]))
            )
            log(f"  ADD   {acc['code']} {acc['name']} ({acc['type']})")
            created += 1
        except Exception as e:
            log(f"  FAIL  {acc['code']} {acc['name']}: {e}")
            failed += 1
    
    close_db()
    
    log(f"\n===== SUMMARY =====")
    log(f"Created: {created}")
    log(f"Skipped/Updated: {skipped}")
    log(f"Failed:  {failed}")
    log(f"Elapsed: {time.time()-t0:.1f}s")


if __name__ == "__main__":
    main()
