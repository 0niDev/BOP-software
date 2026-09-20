"""
Re-allocate DV expense journal_entry_lines from parent accounts 6000/6100
to their specific 5xxx sub-accounts.

Narration format (created by import_dv_expenses.py):
    DV {old_acct}|{date}|{amt} (Imported from PharmaPro DV)

The old_acct inside the narration is used to determine which sub-account
the line should be moved to.

This script is idempotent: running it multiple times is safe because it
only touches lines that still reference 6000 or 6100.
"""
from __future__ import annotations

import re
import sys
import time

from utils.env_loader import setup_import_env
setup_import_env()

from database.connection import get_db, close_db

# ---- Account mappings (old PharmaPro code -> new ERP sub-account code) ----

G_A_ACCOUNTS = {
    "54001", "52023", "64002", "52014", "52009", "52010", "52005",
    "52002", "52062", "52001", "52055", "64008", "5211001", "52054",
    "546", "540001", "55001", "52024", "520907", "52022", "5113",
    "540", "547",
}

SELLING_ACCOUNTS = {
    "52015", "548", "549", "519", "544",
}

FIXED_ASSET_MAP = {
    "12001": "1501",
    "12002": "1503",
    "12003": "1502",
    "1211": "1503",
    "1221": "1504",
    "14001": "1505",
}

# Parent account -> set of old codes that should map to sub-accounts of it
MAP_TO_PARENT = {
    "6000": G_A_ACCOUNTS,
    "6100": SELLING_ACCOUNTS,
}

# Narration patterns: DV or JV {old_acct}|{date}|{amt} (Imported from PharmaPro ...)
NARRATION_RE = re.compile(r"(?:DV|JV)\s+(\S+?)\|(\S+?)\|([\d.]+)\s+\(Imported from PharmaPro")


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def main() -> None:
    t0 = time.time()
    db = get_db()

    # ------------------------------------------------------------------
    # 1. Fetch existing sub-accounts (all 5xxx and asset 15xx codes)
    # ------------------------------------------------------------------
    rows = db.fetch_all(
        "SELECT id, account_code, account_name FROM accounts WHERE is_active = 1"
    )
    code_to_id: dict[str, int] = {}
    for r in rows:
        code_to_id[r["account_code"]] = r["id"]

    # Log what we found
    sub_accounts_5xxx = {c: i for c, i in code_to_id.items() if c.startswith("5")}
    asset_accounts = {c: i for c, i in code_to_id.items() if c.startswith("15")}
    log(f"Found {len(sub_accounts_5xxx)} sub-accounts (5xxx), {len(asset_accounts)} asset accounts (15xx)")

    # Show which mapped codes exist / are missing
    all_mapped_codes = G_A_ACCOUNTS | SELLING_ACCOUNTS | set(FIXED_ASSET_MAP.values())
    missing_codes = sorted(c for c in all_mapped_codes if c not in code_to_id)
    if missing_codes:
        log(f"WARNING: {len(missing_codes)} mapped sub-accounts do NOT exist in DB: {missing_codes}")
    else:
        log("All mapped sub-accounts exist in DB.")

    # Resolve parent account IDs
    parent_6000_id = code_to_id.get("6000")
    parent_6100_id = code_to_id.get("6100")
    if not parent_6000_id or not parent_6100_id:
        log(f"FATAL: Parent accounts missing (6000={parent_6000_id}, 6100={parent_6100_id})")
        close_db()
        sys.exit(1)
    parent_ids = {parent_6000_id, parent_6100_id}

    # ------------------------------------------------------------------
    # 2. Find all journal_entry_lines on 6000 or 6100
    # ------------------------------------------------------------------
    jel_rows = db.fetch_all(
        """
        SELECT jel.id AS jel_id,
               jel.account_id AS current_acct_id,
               jel.debit,
               jel.credit,
               jel.description,
               je.id AS je_id,
               je.narration,
               je.voucher_number,
               je.entry_date
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel.journal_entry_id
        WHERE jel.account_id IN (?, ?)
        """,
        (parent_6000_id, parent_6100_id),
    )
    log(f"Found {len(jel_rows)} journal_entry_lines on accounts 6000/6100")

    if not jel_rows:
        log("Nothing to do.")
        close_db()
        return

    # ------------------------------------------------------------------
    # 3. Parse narrations and determine target sub-accounts
    # ------------------------------------------------------------------
    to_update: list[dict] = []   # {jel_id, old_acct_id, new_acct_id, new_code, old_code, amount}
    skipped_narration: list[dict] = []
    skipped_no_mapping: list[dict] = []
    skipped_missing_sub: list[dict] = []

    for r in jel_rows:
        narr = r["narration"] or ""
        m = NARRATION_RE.search(narr)
        if not m:
            skipped_narration.append(r)
            continue

        old_acct_code = m.group(1)
        amount = float(m.group(3))

        # Determine parent of this line (6000 or 6100)
        current_acct_id = r["current_acct_id"]
        current_parent_code = None
        if current_acct_id == parent_6000_id:
            current_parent_code = "6000"
        elif current_acct_id == parent_6100_id:
            current_parent_code = "6100"

        # Find which parent mapping set contains old_acct_code
        target_new_code = None

        # Check G&A mapping (6000 sub-accounts)
        if old_acct_code in G_A_ACCOUNTS:
            target_new_code = old_acct_code
        elif old_acct_code in SELLING_ACCOUNTS:
            target_new_code = old_acct_code
        elif old_acct_code in FIXED_ASSET_MAP:
            target_new_code = FIXED_ASSET_MAP[old_acct_code]
        else:
            # old_acct_code not in any mapping
            skipped_no_mapping.append({
                **r,
                "old_acct_code": old_acct_code,
            })
            continue

        # Resolve target sub-account ID
        new_acct_id = code_to_id.get(target_new_code)
        if not new_acct_id:
            skipped_missing_sub.append({
                **r,
                "old_acct_code": old_acct_code,
                "target_code": target_new_code,
            })
            continue

        # Skip if already pointing to the right account
        if current_acct_id == new_acct_id:
            continue

        to_update.append({
            "jel_id": r["jel_id"],
            "old_acct_id": current_acct_id,
            "new_acct_id": new_acct_id,
            "new_code": target_new_code,
            "old_code": old_acct_code,
            "amount": amount,
            "voucher_number": r["voucher_number"],
        })

    log(f"Lines to reallocate: {len(to_update)}")
    log(f"Skipped (no narration match): {len(skipped_narration)}")
    log(f"Skipped (old code not in mapping): {len(skipped_no_mapping)}")
    log(f"Skipped (target sub-account missing): {len(skipped_missing_sub)}")

    # ------------------------------------------------------------------
    # 4. Execute updates in a single transaction
    # ------------------------------------------------------------------
    if not to_update:
        log("Nothing to update.")
        close_db()
        return

    updated = 0
    errors = 0
    try:
        with db.transaction():
            # Batch update: group by target account_id
            from collections import defaultdict
            batch_by_target = defaultdict(list)
            for item in to_update:
                batch_by_target[item["new_acct_id"]].append(item["jel_id"])

            for new_acct_id, jel_ids in batch_by_target.items():
                placeholders = ",".join("?" * len(jel_ids))
                db.execute(
                    f"UPDATE journal_entry_lines SET account_id = ? WHERE id IN ({placeholders})",
                    [new_acct_id] + jel_ids,
                )
                updated += len(jel_ids)
                log(f"  Updated {len(jel_ids)} lines -> account {new_acct_id}")
    except Exception as exc:
        log(f"Transaction failed: {exc}")
        close_db()
        sys.exit(1)

    # ------------------------------------------------------------------
    # 5. Summary report
    # ------------------------------------------------------------------
    print("\n===== MIGRATION SUMMARY =====", flush=True)
    print(f"Lines updated:      {updated}", flush=True)
    print(f"Lines failed:       {errors}", flush=True)
    print(f"Skipped (no narr):  {len(skipped_narration)}", flush=True)
    print(f"Skipped (no map):   {len(skipped_no_mapping)}", flush=True)
    print(f"Skipped (no sub):   {len(skipped_missing_sub)}", flush=True)

    if to_update:
        print("\n--- Reallocation details ---", flush=True)
        from collections import defaultdict
        by_target = defaultdict(lambda: {"count": 0, "total": 0.0})
        for item in to_update:
            key = f"{item['old_code']} -> {item['new_code']}"
            by_target[key]["count"] += 1
            by_target[key]["total"] += item["amount"]
        for key in sorted(by_target):
            info = by_target[key]
            print(f"  {key}: {info['count']} lines, total {info['total']:,.2f}", flush=True)

    if skipped_no_mapping:
        print("\n--- Unmapped old codes (no target sub-account) ---", flush=True)
        unmapped_codes = sorted(set(i["old_acct_code"] for i in skipped_no_mapping))
        for code in unmapped_codes:
            count = sum(1 for i in skipped_no_mapping if i["old_acct_code"] == code)
            print(f"  {code}: {count} lines", flush=True)

    if skipped_missing_sub:
        print("\n--- Missing sub-accounts (target code does not exist in DB) ---", flush=True)
        missing = sorted(set(i["target_code"] for i in skipped_missing_sub))
        for code in missing:
            count = sum(1 for i in skipped_missing_sub if i["target_code"] == code)
            print(f"  {code}: {count} lines", flush=True)

    print(f"\nElapsed: {time.time() - t0:.1f}s", flush=True)
    close_db()


if __name__ == "__main__":
    main()
