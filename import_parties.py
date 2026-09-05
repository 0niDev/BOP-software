"""One-off import of parties from PharmaPro_Export/Parties.csv.

Maps old PharmaPro party records to the new ERP schema:
  AccountNo      -> code
  PartyName      -> name
  IsCustomer/V   -> party_type (CUSTOMER / SUPPLIER / BOTH)
  CustomerType   -> customer_category (Retailer->BUSINESS, Doctor/Other->INDIVIDUAL)
  CreditLimit    -> credit_limit
  Phone1/Mobile  -> phone
  EMail          -> email
  City+Address   -> address
  IsActive       -> is_active

Customers are linked to A/R (1100), suppliers to A/P (2000).
Existing parties (matched by code + party_type) are skipped.
"""
from __future__ import annotations

import csv
import os

os.environ["ERP_LOG_LEVEL"] = "CRITICAL"
os.environ["ERP_DB_ENGINE"] = "sqlitecloud"
os.environ["SQLITE_CLOUD_URL"] = (
    "sqlitecloud://cjja8z6pvz.g4.sqlite.cloud:8860/erp_backup_20260820_023705.db?apikey=bmJZ0l1RTFCoxS0Au17c0iofzZmrDn2Db94v0YtV9Uw"
)

from database.connection import get_db, close_db
from models.enums import PartyType
from services.party_service import PartyService
from repositories.account_repository import AccountRepository

SOURCE_FILE = "PharmaPro_Export/Parties.csv"

CUSTOMER_CATEGORY_MAP = {
    "RETAILER": "BUSINESS",
    "DOCTOR": "INDIVIDUAL",
    "OTHER": "INDIVIDUAL",
}


def _to_bool(value: str) -> bool:
    return str(value).strip().lower() in ("true", "1", "yes")


def _first_non_empty(*values: str) -> str | None:
    for v in values:
        if v is not None and str(v).strip():
            return str(v).strip()
    return None


def _combine_address(city: str, address: str) -> str | None:
    city = (city or "").strip()
    address = (address or "").strip()
    if city and address:
        return f"{city}, {address}"
    return city or address or None


def parse_parties(path: str) -> list[dict]:
    parties: list[dict] = []
    with open(path, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            is_customer = _to_bool(row.get("IsCustomer", ""))
            is_vendor = _to_bool(row.get("IsVendor", ""))
            if is_customer and is_vendor:
                party_type = PartyType.BOTH
            elif is_customer:
                party_type = PartyType.CUSTOMER
            elif is_vendor:
                party_type = PartyType.SUPPLIER
            else:
                continue

            customer_type = (row.get("CustomerType") or "").strip().upper()
            parties.append(
                {
                    "code": (row.get("AccountNo") or "").strip(),
                    "name": (row.get("PartyName") or "").strip(),
                    "party_type": party_type,
                    "customer_category": CUSTOMER_CATEGORY_MAP.get(customer_type),
                    "credit_limit": float(row.get("CreditLimit") or 0),
                    "phone": _first_non_empty(
                        row.get("Phone1"), row.get("Mobile"), row.get("Phone2"), row.get("Phone3")
                    ),
                    "email": _first_non_empty(row.get("EMail")),
                    "address": _combine_address(row.get("City"), row.get("Address")),
                    "is_active": _to_bool(row.get("IsActive", "True")),
                }
            )
    return parties


def main() -> None:
    parties = parse_parties(SOURCE_FILE)
    print(f"Parsed {len(parties)} parties from {SOURCE_FILE}")

    db = get_db()
    service = PartyService(db)
    account_repo = AccountRepository(db)

    ar = account_repo.find_by_code("1100")
    ap = account_repo.find_by_code("2000")
    if ar is None or ap is None:
        print("FATAL: Required A/R (1100) or A/P (2000) account is missing.")
        close_db()
        return
    ar_id, ap_id = ar["id"], ap["id"]
    print(f"Using A/R account id={ar_id}, A/P account id={ap_id}")

    existing_rows = db.fetch_all(
        "SELECT code, party_type FROM parties WHERE company_id = 1"
    )
    existing = {(r["code"], r["party_type"]) for r in existing_rows}
    print(f"Found {len(existing)} existing parties; skipping duplicates")

    created = 0
    skipped = 0
    failed = 0

    for p in parties:
        if (p["code"], p["party_type"].value) in existing:
            print(f"  SKIP  {p['code']} {p['name']} (already exists)")
            skipped += 1
            continue
        try:
            account_id = None
            if p["party_type"] == PartyType.CUSTOMER:
                account_id = ar_id
            elif p["party_type"] == PartyType.SUPPLIER:
                account_id = ap_id

            party = service.create_party(
                name=p["name"],
                party_type=p["party_type"],
                credit_limit=p["credit_limit"],
                account_id=account_id,
                code=p["code"],
            )

            service.repo.update(
                party.id,
                {
                    "phone": p["phone"],
                    "email": p["email"],
                    "address": p["address"],
                    "customer_category": p["customer_category"],
                    "is_active": int(p["is_active"]),
                },
            )
            print(f"  ADD   {p['code']} {p['name']}")
            created += 1
            existing.add((p["code"], p["party_type"].value))
        except Exception as exc:
            print(f"  FAIL  {p['code']} {p['name']}: {exc}")
            failed += 1

    print("\n===== SUMMARY =====")
    print(f"Created: {created}")
    print(f"Skipped: {skipped}")
    print(f"Failed:  {failed}")

    close_db()


if __name__ == "__main__":
    main()
