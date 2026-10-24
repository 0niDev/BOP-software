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
import { ConflictError, NotFoundError, ValidationError } from "../domain/errors.js";
import { dec, round2, toStorage } from "../domain/money.js";
import { AccountRepository } from "../repositories/accountRepository.js";
import { JournalRepository } from "../repositories/journalRepository.js";
import {
  PaymentRepository,
  type PaymentListRow,
  type PaymentRow,
  type ReceiptListRow,
  type ReceiptRow,
} from "../repositories/paymentRepository.js";
import { PartyRepository } from "../repositories/partyRepository.js";
import { SystemAccountResolver } from "../repositories/systemAccounts.js";
import { AccountingService } from "./accountingService.js";
import { AuditService } from "./auditService.js";
import { deleteJournalByVoucher, findJournalByVoucher } from "./journalEffects.js";

export type SettlementMethod = "CASH" | "BANK" | "CHEQUE";

export interface PaySupplierInput {
  supplierId: number;
  amount: number | string;
  paymentDate: string;
  paymentMethod: SettlementMethod;
  bankAccountId?: number | null;
  referenceNo?: string | null;
  notes?: string | null;
  purchaseInvoiceId?: number | null;
  companyId?: number;
  userId?: number | null;
}

export interface ReceivePaymentInput {
  customerId: number;
  amount: number | string;
  paymentDate: string;
  paymentMethod: SettlementMethod;
  bankAccountId?: number | null;
  referenceNo?: string | null;
  notes?: string | null;
  salesInvoiceId?: number | null;
  companyId?: number;
  userId?: number | null;
}

export interface PaymentResult {
  id: number;
  voucherNumber: string;
  journalEntryId: number;
}

export class PaymentService {
  private readonly parties: PartyRepository;
  private readonly payments: PaymentRepository;
  private readonly accounts: AccountRepository;
  private readonly journal: JournalRepository;
  private readonly accounting: AccountingService;
  private readonly audit: AuditService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.parties = new PartyRepository(db);
    this.payments = new PaymentRepository(db);
    this.accounts = new AccountRepository(db);
    this.journal = new JournalRepository(db);
    this.accounting = new AccountingService(db, companyId);
    this.audit = new AuditService(db);
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
    const bankAccountId = await this.resolveBankAccountId(
      input.paymentMethod,
      input.bankAccountId,
      companyId,
    );

    return this.db.transaction(async () => {
      // Idempotency: refuse a second identical settlement (same reference) so a
      // double-click or client retry cannot disburse the same money twice.
      const duplicate = await this.payments.findDuplicate(
        "payments",
        "payment_date",
        companyId,
        supplier.id,
        input.paymentDate,
        input.paymentMethod,
        toStorage(amount),
        input.referenceNo ?? null,
      );
      if (duplicate) {
        throw new ConflictError(
          `Payment already recorded as ${duplicate.voucher_number} (reference '${input.referenceNo}').`,
        );
      }

      // Overpayment is allowed: anything beyond the invoice's outstanding
      // balance is an advance to the supplier. The client shows a warning; it
      // does not block the payment.
      if (input.purchaseInvoiceId) {
        const invoice = await this.db.get<{ id: number }>(
          "SELECT id FROM purchase_invoices WHERE id = ?",
          [input.purchaseInvoiceId],
        );
        if (!invoice) throw new NotFoundError(`Purchase invoice ${input.purchaseInvoiceId} not found.`);
      }

      // Bank/cheque settlements cannot disburse more than the bank holds.
      if (input.paymentMethod === "BANK" || input.paymentMethod === "CHEQUE") {
        const bankBalance = dec(await this.accounts.getCurrentBalance(paymentAccountId));
        if (amount.greaterThan(bankBalance)) {
          throw new ValidationError(
            `Insufficient bank funds: balance ${bankBalance.toFixed(2)}, payment ${amount.toFixed(2)}.`,
          );
        }
      }

      // Allocate the voucher number only once the settlement is certain to be
      // written. Allocating earlier (as this used to) meant a rejection — a
      // duplicate reference, an over-payment or insufficient bank funds — burned
      // the number and left a hole in the sequence, because the upsert had
      // already committed before the transaction rolled back.
      const voucherNumber = await this.journal.nextVoucherNumber(companyId, "PAYMENT");

      const journalEntryId = await this.accounting.postJournalEntry({
        voucherType: "PAYMENT",
        entryDate: input.paymentDate,
        voucherNumber,
        referenceNo: input.referenceNo ?? null,
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
        bank_account_id: bankAccountId,
        amount: toStorage(amount),
        notes: input.notes ?? null,
      });

      if (input.purchaseInvoiceId) {
        // Record the link so deleting this payment can put the invoice's
        // paid_amount back exactly as it was.
        await this.payments.insertPaymentAllocation(
          id,
          input.purchaseInvoiceId,
          toStorage(amount),
        );
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

    const resolver = new SystemAccountResolver(this.db, companyId);
    const arId = await resolver.idFor(SystemAccountCodes.ACCOUNTS_RECEIVABLE);
    const receiptAccountId = await this.settlementAccount(resolver, input.paymentMethod);
    const bankAccountId = await this.resolveBankAccountId(
      input.paymentMethod,
      input.bankAccountId,
      companyId,
    );

    return this.db.transaction(async () => {
      // Idempotency: refuse a second identical receipt (same reference) so a
      // retry cannot double-count the same collection.
      const duplicate = await this.payments.findDuplicate(
        "receipts",
        "receipt_date",
        companyId,
        customer.id,
        input.paymentDate,
        input.paymentMethod,
        toStorage(amount),
        input.referenceNo ?? null,
      );
      if (duplicate) {
        throw new ConflictError(
          `Receipt already recorded as ${duplicate.voucher_number} (reference '${input.referenceNo}').`,
        );
      }

      // A cash invoice is already settled; over-collection is allowed as an
      // advance (the client warns, it does not block).
      if (input.salesInvoiceId) {
        const invoice = await this.db.get<{ payment_type: string }>(
          "SELECT payment_type FROM sales_invoices WHERE id = ?",
          [input.salesInvoiceId],
        );
        if (!invoice) throw new NotFoundError(`Sales invoice ${input.salesInvoiceId} not found.`);
        if (invoice.payment_type === "CASH") {
          throw new ValidationError(
            "Cannot receive payment for a CASH invoice - it was settled at creation.",
          );
        }
      }

      // See paySupplier: the number is allocated inside the transaction so a
      // rejected receipt cannot burn one.
      const voucherNumber = await this.journal.nextVoucherNumber(companyId, "RECEIPT");

      const journalEntryId = await this.accounting.postJournalEntry({
        voucherType: "RECEIPT",
        entryDate: input.paymentDate,
        voucherNumber,
        referenceNo: input.referenceNo ?? null,
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
        bank_account_id: bankAccountId,
        amount: toStorage(amount),
        notes: input.notes ?? null,
      });

      if (input.salesInvoiceId) {
        await this.payments.insertReceiptAllocation(id, input.salesInvoiceId, toStorage(amount));
        await this.payments.addSalesInvoicePaid(input.salesInvoiceId, toStorage(amount));
      }

      return { id, voucherNumber, journalEntryId };
    });
  }

  /**
   * Edit a supplier payment. The old journal entry and row are replaced inside
   * one transaction, so the ledger never keeps a stale disbursement. Payments
   * already allocated to an invoice must be deleted instead — re-pointing an
   * allocation would silently move paid_amount between invoices.
   */
  async updatePayment(id: number, input: PaySupplierInput): Promise<PaymentResult> {
    const existing = await this.payments.findPaymentById(id);
    if (!existing) throw new NotFoundError(`Payment ${id} not found.`);
    const allocations = await this.payments.listPaymentAllocations(id);
    if (allocations.length > 0) {
      throw new ConflictError(
        `Payment ${existing.voucher_number} is applied to an invoice. Delete it and record the corrected payment instead.`,
      );
    }
    const journalRow = await findJournalByVoucher(
      this.db,
      existing.company_id,
      existing.voucher_number,
    );

    return this.db.transaction(async () => {
      await deleteJournalByVoucher(this.db, existing.company_id, existing.voucher_number);
      await this.payments.deletePayment(id);
      const result = await this.paySupplier({
        ...input,
        companyId: existing.company_id,
        purchaseInvoiceId: null,
      });
      await this.audit.record({
        userId: input.userId ?? null,
        action: "UPDATE",
        table: "payments",
        entityId: result.id,
        details: {
          before: existing,
          beforeReferenceNo: (journalRow?.reference_no as string | null) ?? null,
          after: { ...input, voucherNumber: result.voucherNumber },
        },
      });
      return result;
    });
  }

  /** Delete a supplier payment, its journal entry and its invoice allocation. */
  async deletePayment(id: number, userId: number | null = null): Promise<void> {
    const existing = await this.payments.findPaymentById(id);
    if (!existing) throw new NotFoundError(`Payment ${id} not found.`);
    await this.reversePayment(
      "payments",
      existing,
      await this.payments.listPaymentAllocations(id),
      userId,
    );
  }

  /** Edit a customer receipt (same rules as updatePayment). */
  async updateReceipt(id: number, input: ReceivePaymentInput): Promise<PaymentResult> {
    const existing = await this.payments.findReceiptById(id);
    if (!existing) throw new NotFoundError(`Receipt ${id} not found.`);
    const allocations = await this.payments.listReceiptAllocations(id);
    if (allocations.length > 0) {
      throw new ConflictError(
        `Receipt ${existing.voucher_number} is applied to an invoice. Delete it and record the corrected receipt instead.`,
      );
    }
    const journalRow = await findJournalByVoucher(
      this.db,
      existing.company_id,
      existing.voucher_number,
    );

    return this.db.transaction(async () => {
      await deleteJournalByVoucher(this.db, existing.company_id, existing.voucher_number);
      await this.payments.deleteReceipt(id);
      const result = await this.receivePayment({
        ...input,
        companyId: existing.company_id,
        salesInvoiceId: null,
      });
      await this.audit.record({
        userId: input.userId ?? null,
        action: "UPDATE",
        table: "receipts",
        entityId: result.id,
        details: {
          before: existing,
          beforeReferenceNo: (journalRow?.reference_no as string | null) ?? null,
          after: { ...input, voucherNumber: result.voucherNumber },
        },
      });
      return result;
    });
  }

  /** Delete a customer receipt, its journal entry and its invoice allocation. */
  async deleteReceipt(id: number, userId: number | null = null): Promise<void> {
    const existing = await this.payments.findReceiptById(id);
    if (!existing) throw new NotFoundError(`Receipt ${id} not found.`);
    await this.reversePayment(
      "receipts",
      existing,
      await this.payments.listReceiptAllocations(id),
      userId,
    );
  }

  /** Shared delete path for payments and receipts. */
  private async reversePayment(
    table: "payments" | "receipts",
    existing: PaymentRow | ReceiptRow,
    allocations: Array<{ id: number; purchase_invoice_id?: number; sales_invoice_id?: number; allocated_amount: number }>,
    userId: number | null,
  ): Promise<void> {
    const isPayment = table === "payments";
    const journalRow = await findJournalByVoucher(
      this.db,
      existing.company_id,
      existing.voucher_number,
    );
    const invoiceId = isPayment
      ? (allocations[0]?.purchase_invoice_id ?? null)
      : (allocations[0]?.sales_invoice_id ?? null);

    await this.db.transaction(async () => {
      for (const allocation of allocations) {
        if (isPayment) {
          await this.payments.subtractPurchaseInvoicePaid(
            allocation.purchase_invoice_id as number,
            allocation.allocated_amount,
          );
        } else {
          await this.payments.subtractSalesInvoicePaid(
            allocation.sales_invoice_id as number,
            allocation.allocated_amount,
          );
        }
        await this.payments.deleteAllocation(
          isPayment ? "payment_allocations" : "receipt_allocations",
          allocation.id,
        );
      }
      await deleteJournalByVoucher(this.db, existing.company_id, existing.voucher_number);
      if (isPayment) await this.payments.deletePayment(existing.id);
      else await this.payments.deleteReceipt(existing.id);

      await this.audit.record({
        userId,
        action: "DELETE",
        table,
        entityId: existing.id,
        details: {
          voucherNumber: existing.voucher_number,
          input: isPayment
            ? {
                supplierId: existing.party_id,
                amount: existing.amount,
                paymentDate: (existing as PaymentRow).payment_date,
                paymentMethod: existing.payment_method,
                bankAccountId: existing.bank_account_id,
                referenceNo: (journalRow?.reference_no as string | null) ?? null,
                notes: existing.notes,
                purchaseInvoiceId: invoiceId,
              }
            : {
                customerId: existing.party_id,
                amount: existing.amount,
                paymentDate: (existing as ReceiptRow).receipt_date,
                paymentMethod: existing.payment_method,
                bankAccountId: existing.bank_account_id,
                referenceNo: (journalRow?.reference_no as string | null) ?? null,
                notes: existing.notes,
                salesInvoiceId: invoiceId,
              },
        },
      });
    });
  }

  /**
   * Which physical bank a BANK/CHEQUE settlement came from. Every bank account
   * shares the one Chart-of-Accounts "Bank Accounts" entry, so this is recorded
   * for reconciliation only; CASH carries no bank.
   */
  private async resolveBankAccountId(
    method: SettlementMethod,
    bankAccountId: number | null | undefined,
    companyId: number,
  ): Promise<number | null> {
    if (method === "CASH" || bankAccountId == null) return null;
    const bank = await this.db.get<{ id: number }>(
      "SELECT id FROM bank_accounts WHERE id = ? AND company_id = ?",
      [bankAccountId, companyId],
    );
    if (!bank) throw new ValidationError(`Bank account ${bankAccountId} not found.`);
    return bankAccountId;
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
