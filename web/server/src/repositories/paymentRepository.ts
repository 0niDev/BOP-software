import type { SqlDatabase } from "../db/types.js";
import type { PaymentMethod } from "../domain/enums.js";
import { insertRow, type InsertData } from "./base.js";

export interface PaymentRow {
  id: number;
  company_id: number;
  voucher_number: string;
  party_id: number;
  payment_date: string;
  payment_method: PaymentMethod;
  bank_account_id: number | null;
  amount: number;
  notes: string | null;
  created_at: string;
}

export interface ReceiptRow extends Omit<PaymentRow, "payment_date"> {
  receipt_date: string;
}

export interface PaymentListRow extends PaymentRow {
  party_name: string;
  party_code: string;
}

export interface ReceiptListRow extends ReceiptRow {
  party_name: string;
  party_code: string;
}

export class PaymentRepository {
  constructor(private readonly db: SqlDatabase) {}

  async insertPayment(data: InsertData): Promise<number> {
    return insertRow(this.db, "payments", data);
  }

  async insertReceipt(data: InsertData): Promise<number> {
    return insertRow(this.db, "receipts", data);
  }

  async listPayments(companyId = 1, limit = 100): Promise<PaymentListRow[]> {
    return this.db.all<PaymentListRow>(
      `SELECT pay.*, p.name AS party_name, p.code AS party_code
       FROM payments pay JOIN parties p ON p.id = pay.party_id
       WHERE pay.company_id = ?
       ORDER BY pay.payment_date DESC, pay.id DESC LIMIT ?`,
      [companyId, limit],
    );
  }

  async listReceipts(companyId = 1, limit = 100): Promise<ReceiptListRow[]> {
    return this.db.all<ReceiptListRow>(
      `SELECT r.*, p.name AS party_name, p.code AS party_code
       FROM receipts r JOIN parties p ON p.id = r.party_id
       WHERE r.company_id = ?
       ORDER BY r.receipt_date DESC, r.id DESC LIMIT ?`,
      [companyId, limit],
    );
  }

  async addPurchaseInvoicePaid(invoiceId: number, amount: number): Promise<void> {
    await this.db.run(
      "UPDATE purchase_invoices SET paid_amount = paid_amount + ? WHERE id = ?",
      [amount, invoiceId],
    );
  }

  async addSalesInvoicePaid(invoiceId: number, amount: number): Promise<void> {
    await this.db.run(
      "UPDATE sales_invoices SET paid_amount = paid_amount + ? WHERE id = ?",
      [amount, invoiceId],
    );
  }
}
