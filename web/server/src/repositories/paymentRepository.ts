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

  /**
   * Look for a settlement that is an exact repeat of the one about to be
   * posted: same company, party, date, method, amount and reference. Posting
   * is then idempotent, so a double-click or a client retry cannot disburse
   * cash twice. Only settles keyed by a reference can be deduplicated — without
   * one there is nothing to tell two genuine same-day payments apart.
   *
   * The reference lives on the journal entry (the one structured place it is
   * stored), so the two tables are joined on the shared voucher number.
   */
  async findDuplicate(
    table: "payments" | "receipts",
    dateColumn: "payment_date" | "receipt_date",
    companyId: number,
    partyId: number,
    date: string,
    method: PaymentMethod,
    amount: number,
    referenceNo: string | null,
  ): Promise<{ id: number; voucher_number: string } | undefined> {
    if (!referenceNo) return undefined;
    return this.db.get<{ id: number; voucher_number: string }>(
      `SELECT d.id, d.voucher_number
         FROM ${table} d
         JOIN journal_entries je
           ON je.company_id = d.company_id AND je.voucher_number = d.voucher_number
        WHERE d.company_id = ? AND d.party_id = ? AND d.${dateColumn} = ?
          AND d.payment_method = ? AND ABS(d.amount - ?) < 0.005
          AND je.reference_no = ?
        LIMIT 1`,
      [companyId, partyId, date, method, amount, referenceNo],
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
