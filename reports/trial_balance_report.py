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
        rows = self.db.fetch_all("""
            WITH opening_balances AS (
                SELECT 
                    jel.account_id,
                    COALESCE(SUM(jel.debit), 0) as odr,
                    COALESCE(SUM(jel.credit), 0) as ocr
                FROM journal_entry_lines jel
                JOIN journal_entries je ON je.id = jel.journal_entry_id
                WHERE je.voucher_type = 'OPENING' AND je.is_posted = 1
                GROUP BY jel.account_id
            ),
            current_balances AS (
                SELECT 
                    jel.account_id,
                    COALESCE(SUM(jel.debit), 0) as total_debit,
                    COALESCE(SUM(jel.credit), 0) as total_credit
                FROM journal_entry_lines jel
                JOIN journal_entries je ON je.id = jel.journal_entry_id
                WHERE je.is_posted = 1 
                AND je.company_id = ?
                AND je.voucher_type != 'OPENING'
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
        """, (self.company_id, self.company_id))
        
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
            
            acc_type = row['account_type']
            
            # CDR/CCR should ONLY contain current period transactions, NOT opening balances
            # Opening balances stay in ODR/OCR columns
            if acc_type in ['ASSET', 'EXPENSE']:
                # For assets/expenses: normal balance is debit
                cdr = total_debit
                ccr = total_credit
            else:
                # For liabilities/equity/revenue: normal balance is credit
                cdr = total_debit
                ccr = total_credit
            
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
        
        # Check if balanced
        is_balanced = abs(float(total_cdr) - float(total_ccr)) < 0.01
        
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
            "is_balanced": is_balanced,
            "balance_diff": float(abs(total_cdr - total_ccr)),
        }

    # =================================================================
    # HELPER METHODS
    # =================================================================

    def _build_parties_summary(self) -> list[dict]:
        """
        Build parties summary from journal entries.
        Note: Opening balances at account level don't have party information,
        so we only show current period transactions for parties.
        """
        params = [self.company_id]
        date_filter = ""
        if self.date_from and self.date_to:
            date_filter = "AND je.entry_date >= ? AND je.entry_date <= ?"
            params.extend([self.date_from, self.date_to])

        parties_data = self.db.fetch_all(f"""
            SELECT 
                p.id as party_id,
                p.code as party_code,
                p.name as party_name,
                p.party_type,
                jel.account_id,
                jel.debit,
                jel.credit,
                je.entry_date,
                a.account_type
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.id = jel.journal_entry_id
            JOIN parties p ON p.id = jel.party_id
            JOIN accounts a ON a.id = jel.account_id
            WHERE je.is_posted = 1
            AND je.company_id = ?
            AND jel.party_id IS NOT NULL
            {date_filter}
            ORDER BY p.name, je.entry_date
        """, tuple(params))
        
        if not parties_data:
            return []
        
        # Group by party
        party_map = {}
        
        for row in parties_data:
            party_id = row['party_id']
            
            if party_id not in party_map:
                party_map[party_id] = {
                    'party_id': party_id,
                    'party_code': row['party_code'],
                    'party_name': row['party_name'],
                    'party_type': row['party_type'],
                    'opening_debit': 0.0,  # Cannot determine opening balance by party
                    'opening_credit': 0.0,  # Opening balances don't have party info
                    'current_debit': 0.0,
                    'current_credit': 0.0,
                }
            
            # Current period transactions only (opening balances don't have party info)
            debit = row['debit'] or 0.0
            credit = row['credit'] or 0.0
            
            party_map[party_id]['current_debit'] += debit
            party_map[party_id]['current_credit'] += credit
        
        # Build result list
        result = []
        for party_id, data in party_map.items():
            net = data['current_debit'] - data['current_credit']
            
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