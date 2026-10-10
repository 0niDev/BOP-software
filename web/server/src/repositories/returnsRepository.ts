import type { Row, SqlDatabase } from "../db/types.js";
import { insertRow, type InsertData } from "./base.js";

export class ReturnsRepository {
  constructor(private readonly db: SqlDatabase) {}

  // --- sales returns -----------------------------------------------------
  async insertSalesReturn(data: InsertData): Promise<number> {
    return insertRow(this.db, "sales_returns", data);
  }

  async insertSalesReturnItem(data: InsertData): Promise<number> {
    return insertRow(this.db, "sales_return_items", data);
  }

  async listSalesReturns(companyId = 1): Promise<Row[]> {
    return this.db.all<Row>(
      `SELECT r.*, s.invoice_number
       FROM sales_returns r JOIN sales_invoices s ON s.id = r.invoice_id
       WHERE r.company_id = ? ORDER BY r.return_date DESC, r.id DESC LIMIT 200`,
      [companyId],
    );
  }

  async salesReturnNumberExists(returnNumber: string, companyId = 1): Promise<boolean> {
    const row = await this.db.get<{ id: number }>(
      "SELECT id FROM sales_returns WHERE company_id = ? AND return_number = ?",
      [companyId, returnNumber],
    );
    return row !== undefined;
  }

  // --- purchase returns --------------------------------------------------
  async insertPurchaseReturn(data: InsertData): Promise<number> {
    return insertRow(this.db, "purchase_returns", data);
  }

  async insertPurchaseReturnItem(data: InsertData): Promise<number> {
    return insertRow(this.db, "purchase_return_items", data);
  }

  async listPurchaseReturns(companyId = 1): Promise<Row[]> {
    return this.db.all<Row>(
      `SELECT r.*, p.invoice_number
       FROM purchase_returns r JOIN purchase_invoices p ON p.id = r.invoice_id
       WHERE r.company_id = ? ORDER BY r.return_date DESC, r.id DESC LIMIT 200`,
      [companyId],
    );
  }

  async purchaseReturnNumberExists(returnNumber: string, companyId = 1): Promise<boolean> {
    const row = await this.db.get<{ id: number }>(
      "SELECT id FROM purchase_returns WHERE company_id = ? AND return_number = ?",
      [companyId, returnNumber],
    );
    return row !== undefined;
  }
}
