"""
Trial Balance Report - Professional 6-Column Format with Hierarchical Codes

SIX COLUMNS (DO NOT CHANGE):
1. Code     - 6-digit hierarchical account code
2. Name     - Account description
3. ODR      - Opening Debit Balance
4. OCR      - Opening Credit Balance
5. CDR      - Current Debit Balance
6. CCR      - Current Credit Balance

ACCOUNT TYPES:
- ASSET    : Debit normal balance (PERMANENT)
- EXPENSE  : Debit normal balance (TEMPORARY)
- LIABILITY: Credit normal balance (PERMANENT)
- EQUITY   : Credit normal balance (PERMANENT)
- REVENUE  : Credit normal balance (TEMPORARY)
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from reports.report_base import Report


class TrialBalanceReport(Report):
    """Trial Balance with 6 columns: Code, Name, ODR, OCR, CDR, CCR + Parties Summary."""

    def __init__(self):
        super().__init__()
        self.title = "Trial Balance"

    # =================================================================
    # MAIN GENERATE METHOD
    # =================================================================
    def generate(self) -> dict:
        """Generate Trial Balance with 6-column format and parties summary."""

        # OPTIMIZED: ONE QUERY for all accounts with their balances
        #
        # Without a date range (legacy behaviour):
        #   - ODR/OCR = OPENING voucher totals
        #   - CDR/CCR = all other posted entries
        # With a date range:
        #   - ODR/OCR = everything posted BEFORE date_from (incl. OPENING vouchers)
        #   - CDR/CCR = posted non-OPENING entries within [date_from, date_to]
        #
        # FIX: both CTEs now consistently filter by company_id, and params
        # are bound in the exact order the placeholders appear.
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
                self.company_id, self.date_from,                 # opening CTE
                self.company_id, self.date_from, self.date_to,    # current CTE
                self.company_id,                                  # outer accounts filter
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
            # FIX: three company_id params — opening CTE, current CTE, outer filter
            params = (self.company_id, self.company_id, self.company_id)

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

        result_rows = []
        total_odr = Decimal('0')
        total_ocr = Decimal('0')
        total_cdr = Decimal('0')
        total_ccr = Decimal('0')
        grouped = {}

        for row in rows:
            odr = Decimal(str(row['odr']))
            ocr = Decimal(str(row['ocr']))
            total_debit = Decimal(str(row['total_debit']))
            total_credit = Decimal(str(row['total_credit']))

            if odr == 0 and ocr == 0 and total_debit == 0 and total_credit == 0:
                continue

            acc_type = row['account_type']

            # FIX: Opening balances stay in ODR/OCR.
            # CDR/CCR must contain ONLY the net current-period movement,
            # reported in the account's normal-balance column. This ensures
            # accounts whose period debits equal period credits (e.g. Cost of
            # Goods Sold cleared against inventory) still appear correctly.
            if acc_type in ['ASSET', 'EXPENSE']:
                # Debit-normal accounts
                net = total_debit - total_credit
                if net >= 0:
                    cdr = net
                    ccr = Decimal('0')
                else:
                    cdr = Decimal('0')
                    ccr = -net
            else:
                # Credit-normal accounts (LIABILITY, EQUITY, REVENUE)
                net = total_credit - total_debit
                if net >= 0:
                    cdr = Decimal('0')
                    ccr = net
                else:
                    cdr = -net
                    ccr = Decimal('0')

            total_odr += odr
            total_ocr += ocr
            total_cdr += cdr
            total_ccr += ccr

            r = {
                "code": row['account_code'],
                "name": row['account_name'],
                "account_type": acc_type,
                "odr": float(odr),
                "ocr": float(ocr),
                "cdr": float(cdr),
                "ccr": float(ccr),
                "is_permanent": acc_type in ["ASSET", "LIABILITY", "EQUITY"],
                "normal_balance": "DEBIT" if acc_type in ["ASSET", "EXPENSE"] else "CREDIT",
            }
            result_rows.append(r)

            if acc_type not in grouped:
                grouped[acc_type] = []
            grouped[acc_type].append(r)

        # Build parties summary
        parties_summary = self._build_parties_summary()

        # Check if balanced (compare combined opening + current on each side)
        grand_dr = float(total_odr + total_cdr)
        grand_cr = float(total_ocr + total_ccr)
        is_balanced = abs(grand_dr - grand_cr) < 0.01

        return {
            "title": self.title,
            "period_label": self._get_period_label(),
            "generated_at": datetime.now().isoformat(),
            "rows": result_rows,
            "grouped_rows": grouped,
            "parties_summary": parties_summary,
            "total_odr": float(total_odr),
            "total_ocr": float(total_ocr),
            "total_cdr": float(total_cdr),
            "total_ccr": float(total_ccr),
            "grand_total_dr": grand_dr,
            "grand_total_cr": grand_cr,
            "is_balanced": is_balanced,
            "balance_diff": float(abs(grand_dr - grand_cr)),
        }

    # =================================================================
    # HELPER METHODS
    # =================================================================

    def _build_parties_summary(self) -> list[dict]:
        """Build parties summary from journal entries.

        OPENING-voucher party lines (per-party opening balances imported from
        PharmaPro) are shown in the Opening columns; all other posted party lines
        (optionally date-filtered) are shown in the Current columns.
        Net Balance = (Opening + Current) Dr - (Opening + Current) Cr.
        """
        # ---- Opening balances: OPENING vouchers that carry a party ----
        opening_rows = self.db.fetch_all("""
            SELECT
                p.id as party_id,
                p.code as party_code,
                p.name as party_name,
                p.party_type,
                COALESCE(SUM(jel.debit), 0) as odr,
                COALESCE(SUM(jel.credit), 0) as ocr
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.id = jel.journal_entry_id
            JOIN parties p ON p.id = jel.party_id
            WHERE je.is_posted = 1
              AND je.company_id = ?
              AND jel.party_id IS NOT NULL
              AND je.voucher_type = 'OPENING'
            GROUP BY p.id
        """, (self.company_id,))

        # ---- Current balances: all posted non-OPENING party lines ----
        params = [self.company_id]
        current_filter = ""
        if self.date_from and self.date_to:
            current_filter = "AND je.entry_date >= ? AND je.entry_date <= ?"
            params.extend([self.date_from, self.date_to])

        current_rows = self.db.fetch_all(f"""
            SELECT
                p.id as party_id,
                p.code as party_code,
                p.name as party_name,
                p.party_type,
                COALESCE(SUM(jel.debit), 0) as tdr,
                COALESCE(SUM(jel.credit), 0) as tcr
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.id = jel.journal_entry_id
            JOIN parties p ON p.id = jel.party_id
            WHERE je.is_posted = 1
              AND je.company_id = ?
              AND jel.party_id IS NOT NULL
              AND je.voucher_type != 'OPENING'
              {current_filter}
            GROUP BY p.id
        """, tuple(params))

        if not opening_rows and not current_rows:
            return []

        party_map = {}
        for row in opening_rows:
            pid = row['party_id']
            d = party_map.setdefault(pid, {
                'party_id': pid,
                'party_code': row['party_code'],
                'party_name': row['party_name'],
                'party_type': row['party_type'],
                'opening_debit': 0.0,
                'opening_credit': 0.0,
                'current_debit': 0.0,
                'current_credit': 0.0,
            })
            d['opening_debit'] += row['odr'] or 0.0
            d['opening_credit'] += row['ocr'] or 0.0

        for row in current_rows:
            pid = row['party_id']
            d = party_map.setdefault(pid, {
                'party_id': pid,
                'party_code': row['party_code'],
                'party_name': row['party_name'],
                'party_type': row['party_type'],
                'opening_debit': 0.0,
                'opening_credit': 0.0,
                'current_debit': 0.0,
                'current_credit': 0.0,
            })
            d['current_debit'] += row['tdr'] or 0.0
            d['current_credit'] += row['tcr'] or 0.0

        result = []
        for pid, data in party_map.items():
            net = (data['opening_debit'] + data['current_debit']) - \
                  (data['opening_credit'] + data['current_credit'])

            if net > 0.01:
                balance_type = 'Receivable'
            elif net < -0.01:
                balance_type = 'Payable'
            else:
                balance_type = 'Zero'

            result.append({
                'party_id': data['party_id'],
                'party_code': data['party_code'],
                'party_name': data['party_name'],
                'party_type': data['party_type'],
                'opening_debit': round(data['opening_debit'], 2),
                'opening_credit': round(data['opening_credit'], 2),
                'current_debit': round(data['current_debit'], 2),
                'current_credit': round(data['current_credit'], 2),
                'net_balance': round(net, 2),
                'balance_type': balance_type,
            })

        result.sort(key=lambda x: x['party_name'])
        return result

    def _get_period_label(self) -> str:
        """Get formatted period label."""
        if self.date_from and self.date_to:
            return f"For the period {self.date_from} to {self.date_to}"
        elif self.date_to:
            return f"As at {self.date_to}"
        else:
            return f"As at {datetime.now().strftime('%B %d, %Y')}"