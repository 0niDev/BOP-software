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
      `SELECT r.*, p.name AS party_name
       FROM sales_returns r JOIN parties p ON p.id = r.party_id
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
      `SELECT r.*, p.name AS party_name
       FROM purchase_returns r JOIN parties p ON p.id = r.party_id
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

  // --- edit / delete support --------------------------------------------
  async findSalesReturnById(id: number): Promise<Row | undefined> {
    return this.db.get<Row>("SELECT * FROM sales_returns WHERE id = ?", [id]);
  }

  async findPurchaseReturnById(id: number): Promise<Row | undefined> {
    return this.db.get<Row>("SELECT * FROM purchase_returns WHERE id = ?", [id]);
  }

  async listSalesReturnItems(returnId: number): Promise<Row[]> {
    return this.db.all<Row>(
      `SELECT ri.*, i.item_name, i.item_code
       FROM sales_return_items ri JOIN items i ON i.id = ri.item_id
       WHERE ri.return_id = ? ORDER BY ri.id`,
      [returnId],
    );
  }

  async listPurchaseReturnItems(returnId: number): Promise<Row[]> {
    return this.db.all<Row>(
      `SELECT ri.*, i.item_name, i.item_code
       FROM purchase_return_items ri JOIN items i ON i.id = ri.item_id
       WHERE ri.return_id = ? ORDER BY ri.id`,
      [returnId],
    );
  }

  async deleteSalesReturn(id: number): Promise<void> {
    await this.db.run("DELETE FROM sales_return_items WHERE return_id = ?", [id]);
    await this.db.run("DELETE FROM sales_returns WHERE id = ?", [id]);
  }

  async deletePurchaseReturn(id: number): Promise<void> {
    await this.db.run("DELETE FROM purchase_return_items WHERE return_id = ?", [id]);
    await this.db.run("DELETE FROM purchase_returns WHERE id = ?", [id]);
  }
}
