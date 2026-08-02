// Dashboard Service - Summary statistics and KPIs
// DEBUG: Provides data for main dashboard widgets

import { dbConnection } from '../utils/database';
import { debugLog, errorLog } from '../config';

export interface DashboardSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  pendingOrders: number;
  lowStockItems: number;
  recentActivities: Array<{
    date: string;
    description: string;
    amount: number;
  }>;
}

/**
 * Dashboard Service
 * DEBUG: Aggregates key metrics for dashboard display
 */
export class DashboardService {
  /**
   * Get dashboard summary for a company
   */
  async getDashboardSummary(companyId: number): Promise<DashboardSummary> {
    debugLog('DashboardService', `Fetching dashboard summary for company ${companyId}`);

    try {
      const [
        totalRevenue,
        totalExpenses,
        pendingOrders,
        lowStockItems,
      ] = await Promise.all([
        this.getTotalRevenue(companyId),
        this.getTotalExpenses(companyId),
        this.getPendingOrdersCount(companyId),
        this.getLowStockItemsCount(companyId),
      ]);

      const netProfit = totalRevenue - totalExpenses;

      const recentActivities = await this.getRecentActivities(companyId);

      const summary: DashboardSummary = {
        totalRevenue,
        totalExpenses,
        netProfit,
        pendingOrders,
        lowStockItems,
        recentActivities,
      };

      debugLog('DashboardService', 'Dashboard summary calculated', summary);
      return summary;
    } catch (error) {
      errorLog('DashboardService', 'Failed to fetch dashboard summary', error);
      throw error;
    }
  }

  /**
   * Calculate total revenue from sales invoices
   */
  private async getTotalRevenue(companyId: number): Promise<number> {
    try {
      const results = await dbConnection.query<{ total: number }>(
        `SELECT COALESCE(SUM(total_amount), 0) as total
         FROM sales_invoices
         WHERE company_id = ? AND status = 'CONFIRMED'`,
        [companyId]
      );

      const revenue = results[0]?.total || 0;
      debugLog('DashboardService', `Total revenue: ${revenue}`);
      return revenue;
    } catch (error) {
      errorLog('DashboardService', 'Failed to calculate revenue', error);
      return 0;
    }
  }

  /**
   * Calculate total expenses from purchase invoices and expenses
   */
  private async getTotalExpenses(companyId: number): Promise<number> {
    try {
      const [purchases, expenses] = await Promise.all([
        dbConnection.query<{ total: number }>(
          `SELECT COALESCE(SUM(total_amount), 0) as total
           FROM purchase_invoices
           WHERE company_id = ? AND status = 'CONFIRMED'`,
          [companyId]
        ),
        dbConnection.query<{ total: number }>(
          `SELECT COALESCE(SUM(amount), 0) as total
           FROM expenses
           WHERE company_id = ? AND status = 'CONFIRMED'`,
          [companyId]
        ),
      ]);

      const totalExpenses = (purchases[0]?.total || 0) + (expenses[0]?.total || 0);
      debugLog('DashboardService', `Total expenses: ${totalExpenses}`);
      return totalExpenses;
    } catch (error) {
      errorLog('DashboardService', 'Failed to calculate expenses', error);
      return 0;
    }
  }

  /**
   * Count pending production orders
   */
  private async getPendingOrdersCount(companyId: number): Promise<number> {
    try {
      const results = await dbConnection.query<{ count: number }>(
        `SELECT COUNT(*) as count
         FROM production_orders
         WHERE company_id = ? AND status = 'IN_PROGRESS'`,
        [companyId]
      );

      const count = results[0]?.count || 0;
      debugLog('DashboardService', `Pending orders: ${count}`);
      return count;
    } catch (error) {
      errorLog('DashboardService', 'Failed to count pending orders', error);
      return 0;
    }
  }

  /**
   * Count items with stock below reorder level
   */
  private async getLowStockItemsCount(companyId: number): Promise<number> {
    try {
      const results = await dbConnection.query<{ count: number }>(
        `SELECT COUNT(DISTINCT i.id) as count
         FROM items i
         LEFT JOIN stock_batches sb ON i.id = sb.item_id AND sb.quantity_in_stock > 0
         WHERE i.company_id = ?
         AND i.is_active = 1
         GROUP BY i.id, i.reorder_level
         HAVING COALESCE(SUM(sb.quantity_in_stock), 0) < i.reorder_level`,
        [companyId]
      );

      const count = results.length || 0;
      debugLog('DashboardService', `Low stock items: ${count}`);
      return count;
    } catch (error) {
      errorLog('DashboardService', 'Failed to count low stock items', error);
      return 0;
    }
  }

  /**
   * Get recent activities (sales, purchases, payments)
   */
  private async getRecentActivities(companyId: number): Promise<Array<{
    date: string;
    description: string;
    amount: number;
  }>> {
    try {
      // Get recent sales invoices
      const sales = await dbConnection.query<any>(
        `SELECT date, invoice_number as description, total_amount as amount, 'SALE' as type
         FROM sales_invoices
         WHERE company_id = ? AND status = 'CONFIRMED'
         ORDER BY date DESC
         LIMIT 5`,
        [companyId]
      );

      // Get recent purchase invoices
      const purchases = await dbConnection.query<any>(
        `SELECT date, invoice_number as description, total_amount as amount, 'PURCHASE' as type
         FROM purchase_invoices
         WHERE company_id = ? AND status = 'CONFIRMED'
         ORDER BY date DESC
         LIMIT 5`,
        [companyId]
      );

      // Combine and sort
      const allActivities = [...sales, ...purchases]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10)
        .map(item => ({
          date: item.date,
          description: `${item.type}: ${item.description}`,
          amount: item.amount,
        }));

      debugLog('DashboardService', `Found ${allActivities.length} recent activities`);
      return allActivities;
    } catch (error) {
      errorLog('DashboardService', 'Failed to fetch recent activities', error);
      return [];
    }
  }
}

console.log('[DashboardService] Dashboard service initialized');
