"""Ledger-level assertions used to "monitor" the books after every action.

These query the DB directly (bypassing repository caches) so they always see
the true state regardless of in-app caching.
"""
from __future__ import annotations

from helpers.local_connection import LocalSqliteConnection

Ledger = LocalSqliteConnection

_LINES = """
    SELECT a.account_code AS code, a.account_name AS name,
           jel.debit, jel.credit, jel.party_id, je.voucher_type, je.voucher_number
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN accounts a ON a.id = jel.account_id
    WHERE je.is_posted = 1
"""


def raw(db, sql: str, params=()):
    return db.fetch_all(sql, params)


def count(db, table: str, where: str = "", params=()) -> int:
    row = db.fetch_one(f"SELECT COUNT(*) AS n FROM {table} {where}".rstrip(), params)
    return int(row["n"]) if row else 0


def rows(db, table: str, where: str = "", params=()):
    return db.fetch_all(f"SELECT * FROM {table} {where}".rstrip(), params)


def one(db, table: str, where: str = "1=1", params=()):
    return db.fetch_one(f"SELECT * FROM {table} WHERE {where}".rstrip(), params)


def ledger_balance(db, code: str) -> float:
    """Debit - Credit for an account code across posted entries."""
    row = db.fetch_one(
        _LINES + " AND a.account_code = ? GROUP BY a.account_code",
        (code,),
    )
    if not row:
        return 0.0
    return round(float(row["debit"] or 0) - float(row["credit"] or 0), 2)


def ar_balance(db) -> float:
    return ledger_balance(db, "1100")


def ap_balance(db) -> float:
    return -ledger_balance(db, "2000")  # credit-normal


def cash_balance(db) -> float:
    return ledger_balance(db, "1000")


def bank_balance(db) -> float:
    return ledger_balance(db, "1010")


def inventory_value(db) -> float:
    return sum(ledger_balance(db, c) for c in ("1200", "1210", "1220"))


def revenue_total(db) -> float:
    return -sum(ledger_balance(db, c) for c in ("4000",))  # credit-normal


def co2_total(db) -> float:
    return sum(ledger_balance(db, c) for c in ("5000", "5001"))


def total_debits(db) -> float:
    return round(float(db.fetch_one("SELECT COALESCE(SUM(debit),0) s FROM journal_entry_lines")["s"]), 2)


def total_credits(db) -> float:
    return round(float(db.fetch_one("SELECT COALESCE(SUM(credit),0) s FROM journal_entry_lines")["s"]), 2)


def books_balanced(db, tolerance: float = 0.01) -> bool:
    return abs(total_debits(db) - total_credits(db)) <= tolerance


def assert_books_balanced(db):
    """Trial-Balance invariant: every posted journal entry must be internally balanced."""
    import pytest

    entries = db.fetch_all(
        """
        SELECT je.id, je.voucher_number, je.voucher_type,
               ROUND(COALESCE(SUM(jel.debit),0),2) d,
               ROUND(COALESCE(SUM(jel.credit),0),2) c
        FROM journal_entries je
        LEFT JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
        WHERE je.is_posted = 1
        GROUP BY je.id
        """
    )
    bad = [e for e in entries if abs(float(e["d"]) - float(e["c"])) > 0.01]
    assert not bad, (
        "Unbalanced posted journal entries: "
        + "; ".join(
            f"{e['voucher_type']} {e['voucher_number']} (#{e['id']}) Dr={e['d']} Cr={e['c']}"
            for e in bad
        )
    )


def balance_sheet_check(db):
    """Assets == Liabilities + Equity from the live ledger."""
    asset = sum(ledger_balance(db, code) for code in ("1000", "1010", "1100", "1200", "1210", "1220", "1300"))
    # all 15xx assets too
    for row in db.fetch_all("SELECT account_code FROM accounts WHERE account_type='ASSET'"):
        code = row["account_code"]
        if code[:2] == "15":
            asset += ledger_balance(db, code)
    liability = -ledger_balance(db, "2000") - sum(ledger_balance(db, code) for code in ("2100", "2200"))
    equity = -sum(ledger_balance(db, code) for code in ("3000", "3100"))
    equity += sum(ledger_balance(db, code) for code in ("4000", "4100"))  # net rev
    equity -= sum(ledger_balance(db, code) for code in ("5000", "5001", "5100", "5200", "5300", "6000"))
    return round(asset, 2), round(liability + equity, 2)


def journal_entries_for(db, source_table: str, source_id: int) -> list[dict]:
    return db.fetch_all(
        "SELECT * FROM journal_entries WHERE source_table=? AND source_id=? ORDER BY id",
        (source_table, source_id),
    )


def bank_transactions_for(db, reference: str = None, account_id: int | None = None) -> list[dict]:
    sql = "SELECT * FROM bank_transactions WHERE 1=1"
    params = []
    if reference:
        sql += " AND reference_no = ?"
        params.append(reference)
    if account_id:
        sql += " AND bank_account_id = ?"
        params.append(account_id)
    sql += " ORDER BY id"
    return db.fetch_all(sql, tuple(params))
