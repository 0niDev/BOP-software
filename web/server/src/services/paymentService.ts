/**
 * Payment / receipt service. Port of services/payment_service.py.
 *
 * paySupplier:        Dr Accounts Payable        Cr Cash/Bank
 * receivePayment:     Dr Cash/Bank               Cr Accounts Receivable
 *
 * Both link the journal line to the party and optionally update the paid
 * amount of the referenced invoice.
 */
import type { SqlDatabase } from "../db/types.js";
import { SystemAccountCodes } from "../domain/enums.js";
import { NotFoundError, ValidationError } from "../domain/errors.js";
import { dec, round2, toStorage } from "../domain/money.js";
import { JournalRepository } from "../repositories/journalRepository.js";
import {
  PaymentRepository,
  type PaymentListRow,
  type ReceiptListRow,
} from "../repositories/paymentRepository.js";
import { PartyRepository } from "../repositories/partyRepository.js";
import { SystemAccountResolver } from "../repositories/systemAccounts.js";
import { AccountingService } from "./accountingService.js";

export type SettlementMethod = "CASH" | "BANK" | "CHEQUE";

export interface PaySupplierInput {
  supplierId: number;
  amount: number | string;
  paymentDate: string;
  paymentMethod: SettlementMethod;
  referenceNo?: string | null;
  notes?: string | null;
  purchaseInvoiceId?: number | null;
  companyId?: number;
}

export interface ReceivePaymentInput {
  customerId: number;
  amount: number | string;
  paymentDate: string;
  paymentMethod: SettlementMethod;
  referenceNo?: string | null;
  notes?: string | null;
  salesInvoiceId?: number | null;
  companyId?: number;
}

export interface PaymentResult {
  id: number;
  voucherNumber: string;
  journalEntryId: number;
}

export class PaymentService {
  private readonly parties: PartyRepository;
  private readonly payments: PaymentRepository;
  private readonly journal: JournalRepository;
  private readonly accounting: AccountingService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.parties = new PartyRepository(db);
    this.payments = new PaymentRepository(db);
    this.journal = new JournalRepository(db);
    this.accounting = new AccountingService(db, companyId);
  }

  async listPayments(): Promise<PaymentListRow[]> {
    return this.payments.listPayments(this.companyId);
  }

  async listReceipts(): Promise<ReceiptListRow[]> {
    return this.payments.listReceipts(this.companyId);
  }

  /** Record a payment to a supplier (Dr AP, Cr cash/bank). */
  async paySupplier(input: PaySupplierInput): Promise<PaymentResult> {
    const companyId = input.companyId ?? this.companyId;
    const supplier = await this.parties.requireById(input.supplierId);
    if (supplier.party_type !== "SUPPLIER" && supplier.party_type !== "BOTH") {
      throw new ValidationError(`Cannot pay '${supplier.name}' (${supplier.party_type}).`);
    }
    const amount = round2(input.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new ValidationError("Amount must be greater than 0.");
    }

    const resolver = new SystemAccountResolver(this.db, companyId);
    const apId = await resolver.idFor(SystemAccountCodes.ACCOUNTS_PAYABLE);
    const paymentAccountId = await this.settlementAccount(resolver, input.paymentMethod);

    const voucherNumber = await this.journal.nextVoucherNumber(companyId, "PAYMENT");

    return this.db.transaction(async () => {
      const journalEntryId = await this.accounting.postJournalEntry({
        voucherType: "PAYMENT",
        entryDate: input.paymentDate,
        voucherNumber,
        lines: [
          {
            accountId: apId,
            debit: amount,
            partyId: supplier.id,
            description: `Payment to ${supplier.name}`,
          },
          {
            accountId: paymentAccountId,
            credit: amount,
            description: `Payment to ${supplier.name}`,
          },
        ],
        narration: `Payment to ${supplier.name}${input.referenceNo ? ` - ${input.referenceNo}` : ""}`,
        companyId,
        createdBy: null,
      });

      const id = await this.payments.insertPayment({
        company_id: companyId,
        voucher_number: voucherNumber,
        party_id: supplier.id,
        payment_date: input.paymentDate,
        payment_method: input.paymentMethod,
        amount: toStorage(amount),
        notes: input.notes ?? null,
      });

      if (input.purchaseInvoiceId) {
        await this.payments.addPurchaseInvoicePaid(input.purchaseInvoiceId, toStorage(amount));
      }

      return { id, voucherNumber, journalEntryId };
    });
  }

  /** Record a payment received from a customer (Dr cash/bank, Cr AR). */
  async receivePayment(input: ReceivePaymentInput): Promise<PaymentResult> {
    const companyId = input.companyId ?? this.companyId;
    const customer = await this.parties.requireById(input.customerId);
    if (customer.party_type !== "CUSTOMER" && customer.party_type !== "BOTH") {
      throw new ValidationError(`'${customer.name}' is not a customer.`);
    }
    const amount = round2(input.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new ValidationError("Amount must be greater than 0.");
    }

    // Guard against over-collection / collecting a cash invoice.
    if (input.salesInvoiceId) {
      const invoice = await this.db.get<{
        total_amount: number;
        paid_amount: number;
        payment_type: string;
      }>(
        "SELECT total_amount, paid_amount, payment_type FROM sales_invoices WHERE id = ?",
        [input.salesInvoiceId],
      );
      if (!invoice) throw new NotFoundError(`Sales invoice ${input.salesInvoiceId} not found.`);
      if (invoice.payment_type === "CASH") {
        throw new ValidationError(
          "Cannot receive payment for a CASH invoice - it was settled at creation.",
        );
      }
      const outstanding = dec(invoice.total_amount).minus(dec(invoice.paid_amount));
      if (amount.greaterThan(outstanding)) {
        throw new ValidationError(
          `Payment amount exceeds the outstanding balance of ${outstanding.toFixed(2)}.`,
        );
      }
    }

    const resolver = new SystemAccountResolver(this.db, companyId);
    const arId = await resolver.idFor(SystemAccountCodes.ACCOUNTS_RECEIVABLE);
    const receiptAccountId = await this.settlementAccount(resolver, input.paymentMethod);

    const voucherNumber = await this.journal.nextVoucherNumber(companyId, "RECEIPT");

    return this.db.transaction(async () => {
      const journalEntryId = await this.accounting.postJournalEntry({
        voucherType: "RECEIPT",
        entryDate: input.paymentDate,
        voucherNumber,
        lines: [
          {
            accountId: receiptAccountId,
            debit: amount,
            description: `Payment from ${customer.name}`,
          },
          {
            accountId: arId,
            credit: amount,
            partyId: customer.id,
            description: `Payment from ${customer.name}`,
          },
        ],
        narration: `Receipt from ${customer.name}${input.referenceNo ? ` - ${input.referenceNo}` : ""}`,
        companyId,
        createdBy: null,
      });

      const id = await this.payments.insertReceipt({
        company_id: companyId,
        voucher_number: voucherNumber,
        party_id: customer.id,
        receipt_date: input.paymentDate,
        payment_method: input.paymentMethod,
        amount: toStorage(amount),
        notes: input.notes ?? null,
      });

      if (input.salesInvoiceId) {
        await this.payments.addSalesInvoicePaid(input.salesInvoiceId, toStorage(amount));
      }

      return { id, voucherNumber, journalEntryId };
    });
  }

  private async settlementAccount(
    resolver: SystemAccountResolver,
    method: SettlementMethod,
  ): Promise<number> {
    if (method === "CASH") return resolver.idFor(SystemAccountCodes.CASH_IN_HAND);
    if (method === "BANK" || method === "CHEQUE") {
      return resolver.idFor(SystemAccountCodes.BANK_ACCOUNTS);
    }
    throw new ValidationError("Invalid payment method.");
  }
}
