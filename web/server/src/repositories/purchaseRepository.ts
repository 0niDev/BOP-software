import type { Row, SqlDatabase } from "../db/types.js";
import type { DocumentStatus, PaymentMethod } from "../domain/enums.js";
import { insertRow, type InsertData } from "./base.js";

export interface PurchaseInvoiceRow {
  id: number;
  company_id: number;
  warehouse_id: number;
  invoice_number: string;
  supplier_id: number;
  invoice_date: string;
  payment_type: PaymentMethod;
  bank_account_id: number | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  status: DocumentStatus;
  notes: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface PurchaseInvoiceListRow extends PurchaseInvoiceRow {
  supplier_name: string;
  supplier_code: string;
}

export class PurchaseRepository {
  constructor(private readonly db: SqlDatabase) {}

  async invoiceNumberExists(invoiceNumber: string, companyId = 1): Promise<boolean> {
    const row = await this.db.get<{ id: number }>(
      "SELECT id FROM purchase_invoices WHERE company_id = ? AND invoice_number = ?",
      [companyId, invoiceNumber],
    );
    return row !== undefined;
  }

  async insertInvoice(data: InsertData): Promise<number> {
    return insertRow(this.db, "purchase_invoices", data);
  }

  async insertItem(data: InsertData): Promise<number> {
    return insertRow(this.db, "purchase_invoice_items", data);
  }

  async findById(id: number): Promise<PurchaseInvoiceRow | undefined> {
    return this.db.get<PurchaseInvoiceRow>("SELECT * FROM purchase_invoices WHERE id = ?", [id]);
  }

  async findItems(invoiceId: number): Promise<Row[]> {
    return this.db.all<Row>(
      `SELECT pii.*, i.item_code, i.item_name, i.unit
       FROM purchase_invoice_items pii
       JOIN items i ON i.id = pii.item_id
       WHERE pii.invoice_id = ?
       ORDER BY pii.id`,
      [invoiceId],
    );
  }

  async list(
    companyId = 1,
    opts: { limit?: number; offset?: number; search?: string } = {},
  ): Promise<PurchaseInvoiceListRow[]> {
    let sql = `
      SELECT pi.*, p.name AS supplier_name, p.code AS supplier_code
      FROM purchase_invoices pi
      JOIN parties p ON p.id = pi.supplier_id
      WHERE pi.company_id = ?`;
    const params: Array<string | number> = [companyId];
    if (opts.search) {
      sql += " AND (pi.invoice_number LIKE ? OR p.name LIKE ?)";
      const like = `%${opts.search}%`;
      params.push(like, like);
    }
    sql += " ORDER BY pi.invoice_date DESC, pi.id DESC LIMIT ? OFFSET ?";
    params.push(opts.limit ?? 100, opts.offset ?? 0);
    return this.db.all<PurchaseInvoiceListRow>(sql, params);
  }
}
