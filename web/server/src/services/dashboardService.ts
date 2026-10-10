/**
 * Dashboard aggregates, ported from services/dashboard_service.py:
 * today's sales/purchases, cash & bank balances, receivables/payables,
 * month-to-date P&L, inventory value, low-stock and expiring-batch alerts,
 * recent transactions and a 6-month revenue/expense trend.
 */
import type { Row, SqlDatabase } from "../db/types.js";
import { toStorage } from "../domain/money.js";

export interface DashboardToday {
  salesTotal: number;
  salesCount: number;
  purchasesTotal: number;
  purchasesCount: number;
}

export interface DashboardBalances {
  cash: number;
  bank: number;
  inventory: number;
  total: number;
}

export interface DashboardReceivablesPayables {
  receivable: number;
  payable: number;
}

export interface DashboardProfitLoss {
  revenue: number;
  expenses: number;
  profit: number;
  isProfit: boolean;
}

export interface RecentTransaction {
  reference: string;
  date: string;
  type: string;
  amount: number;
  partyName: string | null;
}

export interface LowStockItem {
  itemCode: string;
  itemName: string;
  currentStock: number;
  minimumStock: number;
}

export interface ExpiringItem {
  itemCode: string;
  itemName: string;
  batchNumber: string;
  expiryDate: string | null;
  quantityInStock: number;
}

export interface DashboardAlert {
  type: "warning" | "danger" | "success";
  title: string;
  message: string;
}

export interface TrendPoint {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface DashboardData {
  today: DashboardToday;
  balances: DashboardBalances;
  receivablesPayables: DashboardReceivablesPayables;
  profitLoss: DashboardProfitLoss;
  recentTransactions: RecentTransaction[];
  inventory: {
    totalItems: number;
    lowStockCount: number;
    lowStockItems: LowStockItem[];
    expiringCount: number;
    expiringItems: ExpiringItem[];
  };
  alerts: { count: number; alerts: DashboardAlert[] };
  monthlyTrend: TrendPoint[];
}

const RECENT_LIMIT = 15;
const LOW_STOCK_LIMIT = 10;
const EXPIRING_LIMIT = 10;

export class DashboardService {
  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {}

  async get(): Promise<DashboardData> {
    // The Python app rounded all of these to pennies for display; keeping that
    // here means the API numbers are stable and match the reports.
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = `${today.slice(0, 7)}-01`;

    const sales = await this.db.get<{ total: number; count: number }>(
      `SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS count
       FROM sales_invoices
       WHERE company_id = ? AND date(invoice_date) = date(?) AND status != 'CANCELLED'`,
      [this.companyId, today],
    );
    const purchases = await this.db.get<{ total: number; count: number }>(
      `SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS count
       FROM purchase_invoices
       WHERE company_id = ? AND date(invoice_date) = date(?) AND status != 'CANCELLED'`,
      [this.companyId, today],
    );

    const balances = await this.db.get<{
      cash: number;
      bank: number;
      receivable: number;
      payable: number;
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN a.account_code IN ('1000','1020') THEN jel.debit - jel.credit ELSE 0 END), 0) AS cash,
         COALESCE(SUM(CASE WHEN a.account_code = '1010' THEN jel.debit - jel.credit ELSE 0 END), 0) AS bank,
         COALESCE(SUM(CASE WHEN a.account_code = '1100' THEN jel.debit - jel.credit ELSE 0 END), 0) AS receivable,
         COALESCE(SUM(CASE WHEN a.account_code = '2000' THEN jel.credit - jel.debit ELSE 0 END), 0) AS payable
       FROM journal_entries je
       JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
       JOIN accounts a ON a.id = jel.account_id
       WHERE je.is_posted = 1 AND je.company_id = ?`,
      [this.companyId],
    );

    const monthPl = await this.db.get<{ revenue: number; expenses: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN a.account_type = 'REVENUE' THEN jel.credit ELSE 0 END), 0) AS revenue,
         COALESCE(SUM(CASE WHEN a.account_type = 'EXPENSE' THEN jel.debit ELSE 0 END), 0) AS expenses
       FROM journal_entries je
       JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
       JOIN accounts a ON a.id = jel.account_id
       WHERE je.is_posted = 1 AND je.company_id = ?
         AND je.entry_date >= ? AND je.entry_date <= ?`,
      [this.companyId, monthStart, today],
    );

    // Stock value, falling back to the inventory GL accounts when no batches
    // carry a cost (mirrors the COALESCE(subquery, subquery) in Python).
    const inventoryRow = await this.db.get<{ value: number | null }>(
      `SELECT
         COALESCE(
           (SELECT SUM(sb.quantity_in_stock * sb.purchase_price)
            FROM stock_batches sb
            JOIN items i ON i.id = sb.item_id
            WHERE sb.is_active = 1 AND i.is_active = 1 AND i.company_id = ?
              AND sb.quantity_in_stock > 0),
           (SELECT COALESCE(SUM(jel.debit - jel.credit), 0)
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.id = jel.journal_entry_id
            JOIN accounts a ON a.id = jel.account_id
            WHERE je.is_posted = 1 AND je.company_id = ?
              AND a.account_code IN ('1200','1210','1220'))
         ) AS value`,
      [this.companyId, this.companyId],
    );

    const itemCount = await this.db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM items WHERE company_id = ? AND is_active = 1",
      [this.companyId],
    );

    const recentRows = await this.db.all<Row>(
      `SELECT * FROM (
         SELECT si.invoice_number AS reference, si.invoice_date AS date, 'Sales' AS type,
                si.total_amount AS amount, p.name AS party_name
         FROM sales_invoices si JOIN parties p ON p.id = si.customer_id
         WHERE si.company_id = ? AND si.status != 'CANCELLED'
         UNION ALL
         SELECT pi.invoice_number, pi.invoice_date, 'Purchases', pi.total_amount, p.name
         FROM purchase_invoices pi JOIN parties p ON p.id = pi.supplier_id
         WHERE pi.company_id = ? AND pi.status != 'CANCELLED'
         UNION ALL
         SELECT pay.voucher_number, pay.payment_date, 'Payment', pay.amount, pa.name
         FROM payments pay JOIN parties pa ON pa.id = pay.party_id
         WHERE pay.company_id = ?
         UNION ALL
         SELECT r.voucher_number, r.receipt_date, 'Receipt', r.amount, pa.name
         FROM receipts r JOIN parties pa ON pa.id = r.party_id
         WHERE r.company_id = ?
         UNION ALL
         SELECT e.voucher_number, e.expense_date, 'Expense', e.amount, ec.name
         FROM expenses e JOIN expense_categories ec ON ec.id = e.category_id
         WHERE e.company_id = ?
       )
       ORDER BY date DESC, reference DESC
       LIMIT ${RECENT_LIMIT}`,
      [this.companyId, this.companyId, this.companyId, this.companyId, this.companyId],
    );

    const lowStockRows = await this.db.all<Row>(
      `SELECT i.item_code, i.item_name,
              COALESCE(SUM(sb.quantity_in_stock), 0) AS current_stock,
              i.minimum_stock
       FROM items i
       LEFT JOIN stock_batches sb ON sb.item_id = i.id AND sb.is_active = 1
       WHERE i.company_id = ? AND i.is_active = 1
       GROUP BY i.id, i.item_code, i.item_name, i.minimum_stock
       HAVING current_stock < i.minimum_stock
       ORDER BY CASE WHEN i.minimum_stock > 0 THEN current_stock / i.minimum_stock ELSE 0 END ASC
       LIMIT ${LOW_STOCK_LIMIT}`,
      [this.companyId],
    );

    const expiringRows = await this.db.all<Row>(
      `SELECT i.item_code, i.item_name, sb.batch_number, sb.expiry_date, sb.quantity_in_stock
       FROM stock_batches sb
       JOIN items i ON i.id = sb.item_id
       WHERE sb.is_active = 1 AND i.is_active = 1 AND i.company_id = ?
         AND sb.expiry_date IS NOT NULL
         AND date(sb.expiry_date) <= date(?, '+30 days')
       ORDER BY sb.expiry_date ASC
       LIMIT ${EXPIRING_LIMIT}`,
      [this.companyId, today],
    );

    const lowStockItems: LowStockItem[] = lowStockRows.map((row) => ({
      itemCode: String(row.item_code ?? ""),
      itemName: String(row.item_name ?? ""),
      currentStock: toStorage(Number(row.current_stock ?? 0)),
      minimumStock: toStorage(Number(row.minimum_stock ?? 0)),
    }));

    const expiringItems: ExpiringItem[] = expiringRows.map((row) => ({
      itemCode: String(row.item_code ?? ""),
      itemName: String(row.item_name ?? ""),
      batchNumber: String(row.batch_number ?? ""),
      expiryDate: row.expiry_date == null ? null : String(row.expiry_date),
      quantityInStock: toStorage(Number(row.quantity_in_stock ?? 0)),
    }));

    const cash = toStorage(Number(balances?.cash ?? 0));
    const bank = toStorage(Number(balances?.bank ?? 0));
    const inventory = toStorage(Number(inventoryRow?.value ?? 0));
    const revenue = toStorage(Number(monthPl?.revenue ?? 0));
    const expenses = toStorage(Number(monthPl?.expenses ?? 0));
    const profit = toStorage(revenue - expenses);

    const alerts: DashboardAlert[] = [];
    for (const item of lowStockItems.slice(0, 5)) {
      alerts.push({
        type: "warning",
        title: `Low Stock: ${item.itemCode}`,
        message: `${item.itemName} - Current: ${item.currentStock.toFixed(2)}, Min: ${item.minimumStock.toFixed(2)}`,
      });
    }
    for (const batch of expiringItems.slice(0, 3)) {
      alerts.push({
        type: "danger",
        title: `Expiring Soon: ${batch.batchNumber}`,
        message: `${batch.itemName} - Expires: ${batch.expiryDate ?? "unknown"}`,
      });
    }
    if (alerts.length === 0) {
      alerts.push({
        type: "success",
        title: "All Clear!",
        message: "No critical alerts at this time.",
      });
    }

    return {
      today: {
        salesTotal: toStorage(Number(sales?.total ?? 0)),
        salesCount: Number(sales?.count ?? 0),
        purchasesTotal: toStorage(Number(purchases?.total ?? 0)),
        purchasesCount: Number(purchases?.count ?? 0),
      },
      balances: { cash, bank, inventory, total: toStorage(cash + bank + inventory) },
      receivablesPayables: {
        receivable: toStorage(Number(balances?.receivable ?? 0)),
        payable: toStorage(Number(balances?.payable ?? 0)),
      },
      profitLoss: { revenue, expenses, profit, isProfit: revenue > expenses },
      recentTransactions: recentRows.map((row) => ({
        reference: String(row.reference ?? ""),
        date: String(row.date ?? ""),
        type: String(row.type ?? ""),
        amount: toStorage(Number(row.amount ?? 0)),
        partyName: row.party_name == null ? null : String(row.party_name),
      })),
      inventory: {
        totalItems: Number(itemCount?.count ?? 0),
        lowStockCount: lowStockItems.length,
        lowStockItems,
        expiringCount: expiringItems.length,
        expiringItems,
      },
      alerts: { count: alerts.length, alerts },
      monthlyTrend: await this.monthlyTrend(),
    };
  }

  /** Revenue/expenses/profit per month for the last `months` months. */
  async monthlyTrend(months = 6): Promise<TrendPoint[]> {
    const offset = Math.max(0, months - 1);
    const rows = await this.db.all<Row>(
      `WITH RECURSIVE months(month_start) AS (
         SELECT date('now', 'start of month', '-${offset} months')
         UNION ALL
         SELECT date(month_start, '+1 month') FROM months
         WHERE month_start < date('now', 'start of month')
       )
       SELECT m.month_start AS month,
              COALESCE(SUM(CASE WHEN a.account_type = 'REVENUE' THEN jel.credit ELSE 0 END), 0) AS revenue,
              COALESCE(SUM(CASE WHEN a.account_type = 'EXPENSE' THEN jel.debit ELSE 0 END), 0) AS expenses
       FROM months m
       LEFT JOIN journal_entries je
         ON je.is_posted = 1 AND je.company_id = ?
         AND date(je.entry_date) >= m.month_start
         AND date(je.entry_date) < date(m.month_start, '+1 month')
       LEFT JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
       LEFT JOIN accounts a ON a.id = jel.account_id
       GROUP BY m.month_start
       ORDER BY m.month_start ASC`,
      [this.companyId],
    );

    return rows.map((row) => {
      const revenue = toStorage(Number(row.revenue ?? 0));
      const expenses = toStorage(Number(row.expenses ?? 0));
      return {
        month: String(row.month ?? ""),
        revenue,
        expenses,
        profit: toStorage(revenue - expenses),
      };
    });
  }
}
