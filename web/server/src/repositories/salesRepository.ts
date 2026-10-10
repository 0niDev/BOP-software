import type { Row, SqlDatabase } from "../db/types.js";
import type { DocumentStatus, PaymentMethod } from "../domain/enums.js";
import { insertRow, type InsertData } from "./base.js";

export interface SalesInvoiceRow {
  id: number;
  company_id: number;
  warehouse_id: number;
  invoice_number: string;
  customer_id: number;
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

export interface SalesInvoiceListRow extends SalesInvoiceRow {
  customer_name: string;
  customer_code: string;
}

export class SalesRepository {
  constructor(private readonly db: SqlDatabase) {}

  async invoiceNumberExists(invoiceNumber: string, companyId = 1): Promise<boolean> {
    const row = await this.db.get<{ id: number }>(
      "SELECT id FROM sales_invoices WHERE company_id = ? AND invoice_number = ?",
      [companyId, invoiceNumber],
    );
    return row !== undefined;
  }

  async insertInvoice(data: InsertData): Promise<number> {
    return insertRow(this.db, "sales_invoices", data);
  }

  async insertItem(data: InsertData): Promise<number> {
    return insertRow(this.db, "sales_invoice_items", data);
  }

  async findById(id: number): Promise<SalesInvoiceRow | undefined> {
    return this.db.get<SalesInvoiceRow>("SELECT * FROM sales_invoices WHERE id = ?", [id]);
  }

  async findItems(invoiceId: number): Promise<Row[]> {
    return this.db.all<Row>(
      `SELECT sii.*, i.item_code, i.item_name, i.unit
       FROM sales_invoice_items sii
       JOIN items i ON i.id = sii.item_id
       WHERE sii.invoice_id = ?
       ORDER BY sii.id`,
      [invoiceId],
    );
  }

  async list(
    companyId = 1,
    opts: { limit?: number; offset?: number; search?: string; status?: DocumentStatus } = {},
  ): Promise<SalesInvoiceListRow[]> {
    let sql = `
      SELECT si.*, p.name AS customer_name, p.code AS customer_code
      FROM sales_invoices si
      JOIN parties p ON p.id = si.customer_id
      WHERE si.company_id = ?`;
    const params: Array<string | number> = [companyId];
    if (opts.status) {
      sql += " AND si.status = ?";
      params.push(opts.status);
    }
    if (opts.search) {
      sql += " AND (si.invoice_number LIKE ? OR p.name LIKE ?)";
      const like = `%${opts.search}%`;
      params.push(like, like);
    }
    sql += " ORDER BY si.invoice_date DESC, si.id DESC LIMIT ? OFFSET ?";
    params.push(opts.limit ?? 100, opts.offset ?? 0);
    return this.db.all<SalesInvoiceListRow>(sql, params);
  }

  async count(companyId = 1): Promise<number> {
    const row = await this.db.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM sales_invoices WHERE company_id = ?",
      [companyId],
    );
    return Number(row?.n ?? 0);
  }
}
