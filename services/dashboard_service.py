"""
Dashboard service - fetches all data for the dashboard with lazy loading.
"""
from __future__ import annotations

import time
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, Any

from database.connection import DatabaseConnection, get_db
from repositories.account_repository import AccountRepository
from repositories.item_repository import ItemRepository
from repositories.party_repository import PartyRepository
from repositories.sales_invoice_repository import SalesInvoiceRepository
from repositories.purchase_invoice_repository import PurchaseInvoiceRepository
from repositories.stock_batch_repository import StockBatchRepository
from utils.logger import get_logger

logger = get_logger(__name__)


class DashboardService:
    """Service for fetching dashboard data with caching."""

    def __init__(self, db: DatabaseConnection | None = None):
        self.db = db or get_db()
        self.account_repo = AccountRepository(self.db)
        self.item_repo = ItemRepository(self.db)
        self.party_repo = PartyRepository(self.db)
        self.sales_repo = SalesInvoiceRepository(self.db)
        self.purchase_repo = PurchaseInvoiceRepository(self.db)
        self.stock_repo = StockBatchRepository(self.db)
        
        # Cache
        self._cache: Dict[str, Any] = {}
        self._cache_time: Dict[str, float] = {}
        self._cache_ttl = 60  # 60 seconds cache

    def _get_cached(self, key: str, loader, force: bool = False):
        """Get cached data or load if expired."""
        if not force:
            if key in self._cache:
                if time.time() - self._cache_time.get(key, 0) < self._cache_ttl:
                    return self._cache[key]
        
        try:
            data = loader()
            self._cache[key] = data
            self._cache_time[key] = time.time()
            return data
        except Exception as e:
            logger.exception(f"Error loading {key}: {e}")
            return self._cache.get(key, None)

    def invalidate_cache(self):
        """Clear all cached data."""
        self._cache.clear()
        self._cache_time.clear()
        logger.info("Dashboard cache cleared")

    def get_dashboard_data(self, company_id: int = 1) -> dict:
        """Get dashboard data with minimal queries - OPTIMIZED."""
        
        cache_key = f"dashboard_{company_id}"
        
        # Check cache
        if cache_key in self._cache:
            if time.time() - self._cache_time.get(cache_key, 0) < self._cache_ttl:
                logger.info(f"✅ Dashboard cache hit for {cache_key}")
                return self._cache[cache_key]
        
        logger.info(f"🔄 Dashboard cache miss, fetching from DB...")
        today = datetime.now().date().isoformat()
        month_start = datetime.now().date().replace(day=1).isoformat()
        
        try:
            # ============================================================
            # ONE BIG QUERY - all essential data
            # ============================================================
            result = self.db.fetch_one("""
                WITH 
                today_stats AS (
                    SELECT 
                        COALESCE(SUM(CASE WHEN si.status != 'CANCELLED' THEN si.total_amount ELSE 0 END), 0) as sales_total,
                        COUNT(CASE WHEN si.status != 'CANCELLED' THEN 1 END) as sales_count,
                        COALESCE(SUM(CASE WHEN pi.status != 'CANCELLED' THEN pi.total_amount ELSE 0 END), 0) as purchases_total,
                        COUNT(CASE WHEN pi.status != 'CANCELLED' THEN 1 END) as purchases_count
                    FROM (SELECT 1) 
                    LEFT JOIN sales_invoices si ON si.company_id = ? AND date(si.invoice_date) = date(?)
                    LEFT JOIN purchase_invoices pi ON pi.company_id = ? AND date(pi.invoice_date) = date(?)
                ),
                balances AS (
                    SELECT 
                        COALESCE(SUM(CASE WHEN a.account_code IN ('1000', '1020') THEN jel.debit - jel.credit ELSE 0 END), 0) as cash,
                        COALESCE(SUM(CASE WHEN a.account_code = '1010' THEN jel.debit - jel.credit ELSE 0 END), 0) as bank,
                        COALESCE(SUM(CASE WHEN a.account_code = '1100' THEN jel.debit - jel.credit ELSE 0 END), 0) as receivable,
                        COALESCE(SUM(CASE WHEN a.account_code = '2000' THEN jel.credit - jel.debit ELSE 0 END), 0) as payable
                    FROM journal_entries je
                    JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
                    JOIN accounts a ON a.id = jel.account_id
                    WHERE je.is_posted = 1 AND je.company_id = ?
                ),
                monthly_pl AS (
                    SELECT 
                        COALESCE(SUM(CASE WHEN a.account_type = 'REVENUE' THEN jel.credit ELSE 0 END), 0) as revenue,
                        COALESCE(SUM(CASE WHEN a.account_type = 'EXPENSE' THEN jel.debit ELSE 0 END), 0) as expenses
                    FROM journal_entries je
                    JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
                    JOIN accounts a ON a.id = jel.account_id
                    WHERE je.is_posted = 1 AND je.company_id = ?
                    AND je.entry_date >= ? AND je.entry_date <= ?
                ),
                inventory_total AS (
                    SELECT COALESCE(SUM(sb.quantity_in_stock * sb.purchase_price), 0) as inventory_value
                    FROM stock_batches sb
                    JOIN items i ON i.id = sb.item_id
                    WHERE sb.is_active = 1 AND i.is_active = 1 AND i.company_id = ?
                ),
                total_items_count AS (
                    SELECT COUNT(*) as count
                    FROM items
                    WHERE company_id = ? AND is_active = 1
                )
                SELECT 
                    ts.sales_total, ts.sales_count,
                    ts.purchases_total, ts.purchases_count,
                    b.cash, b.bank, b.receivable, b.payable,
                    mp.revenue, mp.expenses,
                    iv.inventory_value,
                    tc.count as total_items
                FROM today_stats ts
                CROSS JOIN balances b
                CROSS JOIN monthly_pl mp
                CROSS JOIN inventory_total iv
                CROSS JOIN total_items_count tc
            """, (
                company_id, today, company_id, today,  # today_stats
                company_id,  # balances
                company_id, month_start, today,  # monthly_pl
                company_id,  # inventory_total
                company_id,  # total_items_count
            ))
            
            if not result:
                logger.warning("⚠️ No result from main dashboard query")
                result = {}
            
            logger.info("✅ Main dashboard query completed")
            
            # ============================================================
            # Recent transactions (one query, not 5 separate ones)
            # ============================================================
            recent = self.db.fetch_all("""
                SELECT * FROM (
                    SELECT 
                        si.invoice_number as reference,
                        si.invoice_date as date,
                        'Sales' as type,
                        si.total_amount as amount,
                        p.name as party_name,
                        1 as sort_order
                    FROM sales_invoices si
                    JOIN parties p ON p.id = si.customer_id
                    WHERE si.company_id = ? AND si.status != 'CANCELLED'
                    UNION ALL
                    SELECT 
                        pi.invoice_number,
                        pi.invoice_date,
                        'Purchases',
                        pi.total_amount,
                        p.name,
                        2
                    FROM purchase_invoices pi
                    JOIN parties p ON p.id = pi.supplier_id
                    WHERE pi.company_id = ? AND pi.status != 'CANCELLED'
                    UNION ALL
                    SELECT 
                        p.voucher_number,
                        p.payment_date,
                        'Payment',
                        p.amount,
                        pa.name,
                        3
                    FROM payments p
                    JOIN parties pa ON pa.id = p.party_id
                    WHERE p.company_id = ?
                    UNION ALL
                    SELECT 
                        r.voucher_number,
                        r.receipt_date,
                        'Receipt',
                        r.amount,
                        pa.name,
                        4
                    FROM receipts r
                    JOIN parties pa ON pa.id = r.party_id
                    WHERE r.company_id = ?
                    UNION ALL
                    SELECT 
                        e.voucher_number,
                        e.expense_date,
                        'Expense',
                        e.amount,
                        ec.name,
                        5
                    FROM expenses e
                    JOIN expense_categories ec ON ec.id = e.category_id
                    WHERE e.company_id = ?
                )
                ORDER BY date DESC
                LIMIT 15
            """, (company_id, company_id, company_id, company_id, company_id))
            
            logger.info(f"✅ Fetched {len(recent)} recent transactions")
            
            # ============================================================
            # Low stock (one query)
            # ============================================================
            low_stock = self.db.fetch_all("""
                SELECT 
                    i.item_code, i.item_name, 
                    COALESCE(SUM(sb.quantity_in_stock), 0) as current_stock,
                    i.minimum_stock
                FROM items i
                LEFT JOIN stock_batches sb ON sb.item_id = i.id AND sb.is_active = 1
                WHERE i.company_id = ? AND i.is_active = 1
                GROUP BY i.id
                HAVING current_stock < i.minimum_stock
                ORDER BY (current_stock / i.minimum_stock) ASC
                LIMIT 10
            """, (company_id,))
            
            logger.info(f"✅ Found {len(low_stock)} low stock items")
            
            # ============================================================
            # Expiring items (one query)
            # ============================================================
            expiring = self.db.fetch_all("""
                SELECT 
                    i.item_code,
                    i.item_name,
                    sb.batch_number,
                    sb.expiry_date,
                    sb.quantity_in_stock
                FROM stock_batches sb
                JOIN items i ON i.id = sb.item_id
                WHERE sb.is_active = 1 
                AND i.is_active = 1
                AND i.company_id = ?
                AND sb.expiry_date IS NOT NULL
                AND date(sb.expiry_date) <= date(?, '+30 days')
                ORDER BY sb.expiry_date ASC
                LIMIT 10
            """, (company_id, today))
            
            logger.info(f"✅ Found {len(expiring)} expiring items")
            
            # ============================================================
            # Build the data dictionary
            # ============================================================
            data = {
                "today": {
                    "sales_total": float(result.get("sales_total", 0)),
                    "sales_count": int(result.get("sales_count", 0)),
                    "purchases_total": float(result.get("purchases_total", 0)),
                    "purchases_count": int(result.get("purchases_count", 0)),
                },
                "balances": {
                    "cash": float(result.get("cash", 0)),
                    "bank": float(result.get("bank", 0)),
                    "inventory": float(result.get("inventory_value", 0)),
                    "total": float(result.get("cash", 0)) + float(result.get("bank", 0)) + float(result.get("inventory_value", 0)),
                },
                "receivables_payables": {
                    "receivable": float(result.get("receivable", 0)),
                    "payable": float(result.get("payable", 0)),
                },
                "profit_loss": {
                    "revenue": float(result.get("revenue", 0)),
                    "expenses": float(result.get("expenses", 0)),
                    "profit": float(result.get("revenue", 0)) - float(result.get("expenses", 0)),
                    "is_profit": float(result.get("revenue", 0)) > float(result.get("expenses", 0)),
                },
                "recent_transactions": recent,
                "inventory": {
                    "total_items": int(result.get("total_items", 0)),
                    "low_stock_count": len(low_stock),
                    "low_stock_items": low_stock,
                    "expiring_count": len(expiring),
                    "expiring_items": expiring,
                },
                "alerts": {
                    "count": 0,
                    "alerts": [],
                },
            }
            
            # ============================================================
            # Build alerts (without extra queries)
            # ============================================================
            alerts = []
            
            # Low stock alerts
            for item in low_stock[:5]:
                alerts.append({
                    "type": "warning",
                    "title": f"Low Stock: {item['item_code']}",
                    "message": f"{item['item_name']} - Current: {item['current_stock']:.2f}, Min: {item['minimum_stock']:.2f}",
                })
            
            # Expiring alerts
            for batch in expiring[:3]:
                alerts.append({
                    "type": "danger",
                    "title": f"Expiring Soon: {batch['batch_number']}",
                    "message": f"{batch['item_name']} - Expires: {batch['expiry_date']}",
                })
            
            if not alerts:
                alerts.append({
                    "type": "success",
                    "title": "All Clear!",
                    "message": "No critical alerts at this time.",
                })
            
            data["alerts"] = {
                "count": len(alerts),
                "alerts": alerts,
            }
            
            # ============================================================
            # Cache the data
            # ============================================================
            self._cache[cache_key] = data
            self._cache_time[cache_key] = time.time()
            
            logger.info(f"✅ Dashboard data built and cached")
            
            return data
            
        except Exception as e:
            logger.exception(f"❌ Error fetching dashboard data: {e}")
            # Return empty data on error
            return {
                "today": {"sales_total": 0, "sales_count": 0, "purchases_total": 0, "purchases_count": 0},
                "balances": {"cash": 0, "bank": 0, "inventory": 0, "total": 0},
                "receivables_payables": {"receivable": 0, "payable": 0},
                "profit_loss": {"revenue": 0, "expenses": 0, "profit": 0, "is_profit": True},
                "recent_transactions": [],
                "inventory": {"total_items": 0, "low_stock_count": 0, "low_stock_items": [], "expiring_count": 0, "expiring_items": []},
                "alerts": {"count": 1, "alerts": [{"type": "danger", "title": "Error", "message": str(e)}]},
            }

    def load_heavy_data(self, company_id: int = 1) -> dict:
        """Load heavy dashboard data (call in background) - DEPRECATED, use get_dashboard_data instead."""
        return self.get_dashboard_data(company_id)

    # ============================================================
    # LEGACY METHODS - Kept for backward compatibility
    # ============================================================

    def _get_today_summary(self, today: datetime, company_id: int) -> dict:
        """Legacy method - use get_dashboard_data instead."""
        today_str = today.strftime("%Y-%m-%d")
        cache_key = f"today_{company_id}_{today_str}"
        return self._get_cached(cache_key, lambda: self._do_get_today_summary(today_str, company_id))

    def _do_get_today_summary(self, today_str: str, company_id: int) -> dict:
        sales = self.db.fetch_one("""
            SELECT 
                COALESCE(SUM(total_amount), 0) as total,
                COUNT(*) as count
            FROM sales_invoices
            WHERE company_id = ? 
            AND date(invoice_date) = date(?)
            AND status != 'CANCELLED'
        """, (company_id, today_str))

        purchases = self.db.fetch_one("""
            SELECT 
                COALESCE(SUM(total_amount), 0) as total,
                COUNT(*) as count
            FROM purchase_invoices
            WHERE company_id = ? 
            AND date(invoice_date) = date(?)
            AND status != 'CANCELLED'
        """, (company_id, today_str))

        return {
            "sales_total": float(sales["total"]) if sales and sales["total"] else 0.0,
            "sales_count": int(sales["count"]) if sales and sales["count"] else 0,
            "purchases_total": float(purchases["total"]) if purchases and purchases["total"] else 0.0,
            "purchases_count": int(purchases["count"]) if purchases and purchases["count"] else 0,
        }

    def _get_monthly_summary(self, month_start: datetime, today: datetime, company_id: int) -> dict:
        """Legacy method - use get_dashboard_data instead."""
        cache_key = f"monthly_{company_id}_{month_start.isoformat()}_{today.isoformat()}"
        return self._get_cached(cache_key, lambda: self._do_get_monthly_summary(month_start, today, company_id))

    def _do_get_monthly_summary(self, month_start: datetime, today: datetime, company_id: int) -> dict:
        month_start_str = month_start.isoformat()
        today_str = today.isoformat()

        sales = self.db.fetch_one("""
            SELECT COALESCE(SUM(total_amount), 0) as total
            FROM sales_invoices
            WHERE company_id = ?
            AND invoice_date >= ? AND invoice_date <= ?
            AND status != 'CANCELLED'
        """, (company_id, month_start_str, today_str))

        purchases = self.db.fetch_one("""
            SELECT COALESCE(SUM(total_amount), 0) as total
            FROM purchase_invoices
            WHERE company_id = ?
            AND invoice_date >= ? AND invoice_date <= ?
            AND status != 'CANCELLED'
        """, (company_id, month_start_str, today_str))

        expenses = self.db.fetch_one("""
            SELECT COALESCE(SUM(amount), 0) as total
            FROM expenses
            WHERE company_id = ?
            AND expense_date >= ? AND expense_date <= ?
        """, (company_id, month_start_str, today_str))

        sales_total = float(sales["total"]) if sales and sales["total"] else 0.0
        purchases_total = float(purchases["total"]) if purchases and purchases["total"] else 0.0
        expenses_total = float(expenses["total"]) if expenses and expenses["total"] else 0.0

        return {
            "sales_total": sales_total,
            "purchases_total": purchases_total,
            "expenses_total": expenses_total,
            "net_profit": sales_total - purchases_total - expenses_total,
        }

    def _get_balances(self, company_id: int) -> dict:
        """Legacy method - use get_dashboard_data instead."""
        cache_key = f"balances_{company_id}"
        return self._get_cached(cache_key, lambda: self._do_get_balances(company_id))

    def _do_get_balances(self, company_id: int) -> dict:
        # Cash balance
        cash_account = self.account_repo.find_by_code("1000", company_id)
        cash_balance = 0.0
        if cash_account:
            cash_balance = float(self.account_repo.get_current_balance(cash_account["id"]))

        # Petty cash
        petty_cash = self.account_repo.find_by_code("1020", company_id)
        if petty_cash:
            cash_balance += float(self.account_repo.get_current_balance(petty_cash["id"]))

        # Bank balance
        bank_balance = 0.0
        coa_bank = self.account_repo.find_by_code("1010", company_id)
        if coa_bank:
            bank_balance = float(self.account_repo.get_current_balance(coa_bank["id"]))

        # Inventory value
        inventory_value = self.db.fetch_one("""
            SELECT COALESCE(SUM(sb.quantity_in_stock * sb.purchase_price), 0) as total
            FROM stock_batches sb
            JOIN items i ON i.id = sb.item_id
            WHERE sb.is_active = 1 AND i.is_active = 1
        """)
        inv_total = float(inventory_value["total"]) if inventory_value and inventory_value["total"] else 0.0

        return {
            "cash": cash_balance,
            "bank": bank_balance,
            "inventory": inv_total,
            "total": cash_balance + bank_balance + inv_total,
        }

    def _get_receivables_payables(self, company_id: int) -> dict:
        """Legacy method - use get_dashboard_data instead."""
        cache_key = f"receivables_{company_id}"
        return self._get_cached(cache_key, lambda: self._do_get_receivables_payables(company_id))

    def _do_get_receivables_payables(self, company_id: int) -> dict:
        ar = self.account_repo.find_by_code("1100", company_id)
        ar_balance = 0.0
        if ar:
            ar_balance = float(self.account_repo.get_current_balance(ar["id"]))
        
        ap = self.account_repo.find_by_code("2000", company_id)
        ap_balance = 0.0
        if ap:
            ap_balance = float(self.account_repo.get_current_balance(ap["id"]))
        
        return {
            "receivable": ar_balance if ar_balance > 0 else 0.0,
            "payable": ap_balance if ap_balance > 0 else 0.0,
        }

    def _get_inventory_summary(self, company_id: int) -> dict:
        """Legacy method - use get_dashboard_data instead."""
        cache_key = f"inventory_{company_id}"
        return self._get_cached(cache_key, lambda: self._do_get_inventory_summary(company_id))

    def _do_get_inventory_summary(self, company_id: int) -> dict:
        total_items = self.item_repo.count("company_id = ? AND is_active = 1", (company_id,))

        low_stock = self.db.fetch_all("""
            SELECT i.id, i.item_code, i.item_name, i.minimum_stock,
                   COALESCE(SUM(sb.quantity_in_stock), 0) as current_stock
            FROM items i
            LEFT JOIN stock_batches sb ON sb.item_id = i.id AND sb.is_active = 1
            WHERE i.company_id = ? AND i.is_active = 1
            GROUP BY i.id
            HAVING current_stock < i.minimum_stock
            ORDER BY (current_stock / i.minimum_stock) ASC
            LIMIT 10
        """, (company_id,))

        expiring = self.stock_repo.get_expiring_batches(30)

        return {
            "total_items": total_items,
            "low_stock_count": len(low_stock),
            "low_stock_items": low_stock,
            "expiring_count": len(expiring),
            "expiring_items": expiring,
        }

    def _get_alerts(self, company_id: int) -> dict:
        """Legacy method - use get_dashboard_data instead."""
        cache_key = f"alerts_{company_id}"
        return self._get_cached(cache_key, lambda: self._do_get_alerts(company_id))

    def _do_get_alerts(self, company_id: int) -> dict:
        alerts = []

        low_stock = self.db.fetch_all("""
            SELECT i.item_code, i.item_name, 
                   COALESCE(SUM(sb.quantity_in_stock), 0) as current_stock,
                   i.minimum_stock
            FROM items i
            LEFT JOIN stock_batches sb ON sb.item_id = i.id AND sb.is_active = 1
            WHERE i.company_id = ? AND i.is_active = 1
            GROUP BY i.id
            HAVING current_stock < i.minimum_stock
            ORDER BY (current_stock / i.minimum_stock) ASC
            LIMIT 5
        """, (company_id,))

        for item in low_stock:
            alerts.append({
                "type": "warning",
                "title": f"Low Stock: {item['item_code']}",
                "message": f"{item['item_name']} - Current: {item['current_stock']:.2f}, Min: {item['minimum_stock']:.2f}",
            })

        expiring = self.stock_repo.get_expiring_batches(15)
        for batch in expiring[:3]:
            alerts.append({
                "type": "danger",
                "title": f"Expiring Soon: {batch['batch_number']}",
                "message": f"{batch['item_name']} - Expires: {batch['expiry_date']}",
            })

        if not alerts:
            alerts.append({
                "type": "success",
                "title": "All Clear!",
                "message": "No critical alerts at this time.",
            })

        return {"count": len(alerts), "alerts": alerts}

    def _get_recent_transactions(self, company_id: int) -> list:
        """Legacy method - use get_dashboard_data instead."""
        cache_key = f"transactions_{company_id}"
        return self._get_cached(cache_key, lambda: self._do_get_recent_transactions(company_id))

    def _do_get_recent_transactions(self, company_id: int) -> list:
        sales = self.db.fetch_all("""
            SELECT 
                si.invoice_number as reference,
                si.invoice_date as date,
                'Sales' as type,
                si.total_amount as amount,
                p.name as party_name
            FROM sales_invoices si
            JOIN parties p ON p.id = si.customer_id
            WHERE si.company_id = ? AND si.status != 'CANCELLED'
            ORDER BY si.invoice_date DESC, si.id DESC
            LIMIT 10
        """, (company_id,))

        purchases = self.db.fetch_all("""
            SELECT 
                pi.invoice_number as reference,
                pi.invoice_date as date,
                'Purchases' as type,
                pi.total_amount as amount,
                p.name as party_name
            FROM purchase_invoices pi
            JOIN parties p ON p.id = pi.supplier_id
            WHERE pi.company_id = ? AND pi.status != 'CANCELLED'
            ORDER BY pi.invoice_date DESC, pi.id DESC
            LIMIT 10
        """, (company_id,))

        payments = self.db.fetch_all("""
            SELECT 
                p.voucher_number as reference,
                p.payment_date as date,
                'Payment' as type,
                p.amount as amount,
                pa.name as party_name
            FROM payments p
            JOIN parties pa ON pa.id = p.party_id
            WHERE p.company_id = ?
            ORDER BY p.payment_date DESC, p.id DESC
            LIMIT 10
        """, (company_id,))

        receipts = self.db.fetch_all("""
            SELECT 
                r.voucher_number as reference,
                r.receipt_date as date,
                'Receipt' as type,
                r.amount as amount,
                pa.name as party_name
            FROM receipts r
            JOIN parties pa ON pa.id = r.party_id
            WHERE r.company_id = ?
            ORDER BY r.receipt_date DESC, r.id DESC
            LIMIT 10
        """, (company_id,))

        expenses = self.db.fetch_all("""
            SELECT 
                e.voucher_number as reference,
                e.expense_date as date,
                'Expense' as type,
                e.amount as amount,
                ec.name as party_name
            FROM expenses e
            JOIN expense_categories ec ON ec.id = e.category_id
            WHERE e.company_id = ?
            ORDER BY e.expense_date DESC, e.id DESC
            LIMIT 10
        """, (company_id,))

        all_transactions = list(sales) + list(purchases) + list(payments) + list(receipts) + list(expenses)
        
        for txn in all_transactions:
            if txn["date"] is None:
                txn["date"] = "1970-01-01"
        
        all_transactions.sort(key=lambda x: x["date"] if x["date"] else "1970-01-01", reverse=True)

        return all_transactions[:15]

    def _get_profit_loss(self, month_start: datetime, today: datetime, company_id: int) -> dict:
        """Legacy method - use get_dashboard_data instead."""
        cache_key = f"profitloss_{company_id}_{month_start.isoformat()}_{today.isoformat()}"
        return self._get_cached(cache_key, lambda: self._do_get_profit_loss(month_start, today, company_id))

    def _do_get_profit_loss(self, month_start: datetime, today: datetime, company_id: int) -> dict:
        month_start_str = month_start.isoformat()
        today_str = today.isoformat()

        revenue = self.db.fetch_one("""
            SELECT COALESCE(SUM(jel.credit), 0) as total
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.id = jel.journal_entry_id
            JOIN accounts a ON a.id = jel.account_id
            WHERE je.company_id = ?
            AND a.account_type = 'REVENUE'
            AND je.is_posted = 1
            AND je.entry_date >= ? AND je.entry_date <= ?
        """, (company_id, month_start_str, today_str))

        expenses = self.db.fetch_one("""
            SELECT COALESCE(SUM(jel.debit), 0) as total
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.id = jel.journal_entry_id
            JOIN accounts a ON a.id = jel.account_id
            WHERE je.company_id = ?
            AND a.account_type = 'EXPENSE'
            AND je.is_posted = 1
            AND je.entry_date >= ? AND je.entry_date <= ?
        """, (company_id, month_start_str, today_str))

        total_revenue = float(revenue["total"]) if revenue and revenue["total"] else 0.0
        total_expenses = float(expenses["total"]) if expenses and expenses["total"] else 0.0

        return {
            "revenue": total_revenue,
            "expenses": total_expenses,
            "profit": total_revenue - total_expenses,
            "is_profit": total_revenue > total_expenses,
        }