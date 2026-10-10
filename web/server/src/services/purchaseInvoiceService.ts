/**
 * Purchase invoice service. Faithful port of the create path in
 * services/purchase_invoice_service.py: validate supplier/items/payment,
 * compute totals in exact decimal, increase stock, and post one balanced
 * journal entry splitting the inventory debit by item type and crediting
 * cash/bank/accounts-payable.
 */
import type { SqlDatabase } from "../db/types.js";
import { PAYMENT_METHODS, SystemAccountCodes, type ItemType, type PaymentMethod } from "../domain/enums.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../domain/errors.js";
import { Decimal, dec, round2, toStorage, type MoneyLike } from "../domain/money.js";
import { ItemRepository, type ItemRow } from "../repositories/itemRepository.js";
import { PartyRepository } from "../repositories/partyRepository.js";
import { JournalRepository } from "../repositories/journalRepository.js";
import {
  PurchaseRepository,
  type PurchaseInvoiceListRow,
  type PurchaseInvoiceRow,
} from "../repositories/purchaseRepository.js";
import { StockBatchRepository } from "../repositories/stockBatchRepository.js";
import { SystemAccountResolver } from "../repositories/systemAccounts.js";
import { AccountingService, type JournalLineInput } from "./accountingService.js";

export interface PurchaseInvoiceItemInput {
  itemId: number;
  quantity: MoneyLike;
  unitCost: MoneyLike;
  discountAmount?: MoneyLike;
  taxAmount?: MoneyLike;
  batchNumber?: string | null;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
}

export interface CreatePurchaseInvoiceInput {
  supplierId: number;
  invoiceDate: string;
  paymentType: PaymentMethod;
  items: readonly PurchaseInvoiceItemInput[];
  invoiceNumber?: string | null;
  notes?: string | null;
  warehouseId?: number;
  bankAccountId?: number | null;
  createdBy?: number | null;
  companyId?: number;
}

export interface PurchaseInvoiceResult {
  id: number;
  invoiceNumber: string;
  supplierId: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  journalEntryId: number;
}

interface PreparedLine {
  item: ItemRow;
  quantity: Decimal;
  unitCost: Decimal;
  discount: Decimal;
  tax: Decimal;
  lineTotal: Decimal;
  batchNumber: string | null;
  manufacturingDate: string | null;
  expiryDate: string | null;
}

const INVENTORY_ACCOUNT_BY_TYPE: Record<ItemType, string> = {
  RAW_MATERIAL: SystemAccountCodes.INVENTORY_RAW_MATERIALS,
  PACKING_MATERIAL: SystemAccountCodes.INVENTORY_PACKING_MATERIALS,
  FINISHED_GOOD: SystemAccountCodes.INVENTORY_FINISHED_GOODS,
};

export class PurchaseInvoiceService {
  private readonly parties: PartyRepository;
  private readonly items: ItemRepository;
  private readonly batches: StockBatchRepository;
  private readonly purchases: PurchaseRepository;
  private readonly journal: JournalRepository;
  private readonly accounting: AccountingService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.parties = new PartyRepository(db);
    this.items = new ItemRepository(db);
    this.batches = new StockBatchRepository(db);
    this.purchases = new PurchaseRepository(db);
    this.journal = new JournalRepository(db);
    this.accounting = new AccountingService(db, companyId);
  }

  async list(
    opts: { limit?: number; offset?: number; search?: string } = {},
  ): Promise<PurchaseInvoiceListRow[]> {
    return this.purchases.list(this.companyId, opts);
  }

  async getById(
    id: number,
  ): Promise<{ invoice: PurchaseInvoiceRow; items: Record<string, unknown>[] }> {
    const invoice = await this.purchases.findById(id);
    if (!invoice) throw new NotFoundError(`Purchase invoice ${id} not found.`);
    const items = await this.purchases.findItems(id);
    return { invoice, items };
  }

  async createPurchaseInvoice(input: CreatePurchaseInvoiceInput): Promise<PurchaseInvoiceResult> {
    const companyId = input.companyId ?? this.companyId;
    const warehouseId = input.warehouseId ?? 1;

    if (!PAYMENT_METHODS.includes(input.paymentType)) {
      throw new ValidationError(`Invalid payment type '${input.paymentType}'.`);
    }
    if (!input.items || input.items.length === 0) {
      throw new ValidationError("A purchase invoice needs at least one line item.");
    }
    if (!input.invoiceDate) {
      throw new ValidationError("Invoice date is required.");
    }

    const supplier = await this.parties.requireById(input.supplierId);
    if (!supplier.is_active) {
      throw new ValidationError(`Supplier '${supplier.name}' is not active.`);
    }
    if (supplier.party_type !== "SUPPLIER" && supplier.party_type !== "BOTH") {
      throw new ValidationError(`Party '${supplier.name}' is not a supplier.`);
    }

    const prepared: PreparedLine[] = [];
    for (const raw of input.items) {
      const item = await this.items.requireById(raw.itemId);
      const quantity = dec(raw.quantity);
      if (quantity.lessThanOrEqualTo(0)) {
        throw new ValidationError(`Quantity for '${item.item_name}' must be greater than zero.`);
      }
      const unitCost = dec(raw.unitCost);
      if (unitCost.lessThan(0)) {
        throw new ValidationError(`Unit cost for '${item.item_name}' cannot be negative.`);
      }
      const discount = round2(raw.discountAmount ?? 0);
      const tax = round2(raw.taxAmount ?? 0);
      const lineTotal = round2(quantity.times(unitCost).minus(discount).plus(tax));
      prepared.push({
        item,
        quantity,
        unitCost,
        discount,
        tax,
        lineTotal,
        batchNumber: raw.batchNumber?.trim() || null,
        manufacturingDate: raw.manufacturingDate ?? null,
        expiryDate: raw.expiryDate ?? null,
      });
    }

    const subtotal = round2(
      prepared.reduce((acc, l) => acc.plus(l.quantity.times(l.unitCost)), new Decimal(0)),
    );
    const discountAmount = round2(prepared.reduce((acc, l) => acc.plus(l.discount), new Decimal(0)));
    const taxAmount = round2(prepared.reduce((acc, l) => acc.plus(l.tax), new Decimal(0)));
    const totalAmount = round2(subtotal.minus(discountAmount).plus(taxAmount));

    const resolver = new SystemAccountResolver(this.db, companyId);
    const taxId = await resolver.idFor(SystemAccountCodes.SALES_TAX_PAYABLE);
    const credit = await this.resolvePaymentAccount(input, resolver, supplier.id);

    // Inventory debit is split by item type, so aggregate line totals per type.
    const typeTotals = new Map<ItemType, Decimal>();
    for (const line of prepared) {
      typeTotals.set(
        line.item.item_type,
        (typeTotals.get(line.item.item_type) ?? new Decimal(0)).plus(line.lineTotal),
      );
    }

    let invoiceNumber = input.invoiceNumber?.trim() || "";
    if (invoiceNumber) {
      if (await this.purchases.invoiceNumberExists(invoiceNumber, companyId)) {
        throw new ConflictError(`Invoice number '${invoiceNumber}' already exists.`);
      }
    } else {
      invoiceNumber = await this.journal.nextVoucherNumber(companyId, "PURCHASE");
    }

    return this.db.transaction(async () => {
      const invoiceId = await this.purchases.insertInvoice({
        company_id: companyId,
        warehouse_id: warehouseId,
        invoice_number: invoiceNumber,
        supplier_id: supplier.id,
        invoice_date: input.invoiceDate,
        payment_type: input.paymentType,
        bank_account_id: input.bankAccountId ?? null,
        subtotal: toStorage(subtotal),
        discount_amount: toStorage(discountAmount),
        tax_amount: toStorage(taxAmount),
        total_amount: toStorage(totalAmount),
        paid_amount: input.paymentType === "CREDIT" ? 0 : toStorage(totalAmount),
        status: "CONFIRMED",
        notes: input.notes ?? null,
        created_by: input.createdBy ?? null,
      });

      const journalLines: JournalLineInput[] = [];
      for (const [itemType, amount] of typeTotals) {
        if (amount.lessThanOrEqualTo(0)) continue;
        journalLines.push({
          accountId: await resolver.idFor(INVENTORY_ACCOUNT_BY_TYPE[itemType]),
          debit: amount,
          description: `Inventory purchase - ${itemType.replace(/_/g, " ")}`,
        });
      }
      if (taxAmount.greaterThan(0)) {
        journalLines.push({ accountId: taxId, credit: taxAmount, description: "Input tax on purchases" });
      }
      journalLines.push({
        accountId: credit.accountId,
        credit: round2(totalAmount.minus(taxAmount)),
        partyId: credit.partyId,
        description: credit.description,
      });

      for (const line of prepared) {
        const batchId = await this.upsertBatch(line, warehouseId);
        await this.purchases.insertItem({
          invoice_id: invoiceId,
          item_id: line.item.id,
          batch_id: batchId,
          batch_number: line.batchNumber,
          manufacturing_date: line.manufacturingDate,
          expiry_date: line.expiryDate,
          quantity: toStorage(line.quantity),
          unit_cost: toStorage(line.unitCost),
          discount_amount: toStorage(line.discount),
          tax_amount: toStorage(line.tax),
          line_total: toStorage(line.lineTotal),
        });
      }

      const journalEntryId = await this.accounting.postJournalEntry({
        voucherType: "PURCHASE",
        entryDate: input.invoiceDate,
        lines: journalLines,
        sourceTable: "purchase_invoices",
        sourceId: invoiceId,
        narration: `Purchase invoice ${invoiceNumber}`,
        companyId,
        createdBy: input.createdBy ?? null,
      });

      if (
        (input.paymentType === "BANK" || input.paymentType === "CHEQUE") &&
        input.bankAccountId
      ) {
        await this.db.run(
          `INSERT INTO bank_transactions
             (bank_account_id, transaction_type, amount, transaction_date, reference_no, notes, created_at)
           VALUES (?, 'WITHDRAWAL', ?, ?, ?, ?, datetime('now'))`,
          [
            input.bankAccountId,
            toStorage(totalAmount),
            input.invoiceDate,
            invoiceNumber,
            `Purchase invoice ${invoiceNumber} - ${input.paymentType} payment`,
          ],
        );
      }

      return {
        id: invoiceId,
        invoiceNumber,
        supplierId: supplier.id,
        subtotal: toStorage(subtotal),
        discountAmount: toStorage(discountAmount),
        taxAmount: toStorage(taxAmount),
        totalAmount: toStorage(totalAmount),
        journalEntryId,
      };
    });
  }

  private async resolvePaymentAccount(
    input: CreatePurchaseInvoiceInput,
    resolver: SystemAccountResolver,
    supplierId: number,
  ): Promise<{ accountId: number; partyId: number | null; description: string }> {
    if (input.paymentType === "CREDIT") {
      return {
        accountId: await resolver.idFor(SystemAccountCodes.ACCOUNTS_PAYABLE),
        partyId: supplierId,
        description: "Supplier credit",
      };
    }
    if (input.paymentType === "CASH") {
      return {
        accountId: await resolver.idFor(SystemAccountCodes.CASH_IN_HAND),
        partyId: null,
        description: "Cash payment",
      };
    }
    if (input.bankAccountId) {
      const bank = await this.db.get<{ account_id: number; bank_name: string }>(
        "SELECT account_id, bank_name FROM bank_accounts WHERE id = ?",
        [input.bankAccountId],
      );
      if (!bank) throw new ValidationError("Selected bank account not found.");
      return {
        accountId: bank.account_id,
        partyId: null,
        description: `${input.paymentType} payment - ${bank.bank_name}`,
      };
    }
    return {
      accountId: await resolver.idFor(SystemAccountCodes.BANK_ACCOUNTS),
      partyId: null,
      description: `${input.paymentType} payment`,
    };
  }

  /** Find the batch by number (adding to it) or create it, mirroring the Python helper. */
  private async upsertBatch(line: PreparedLine, warehouseId: number): Promise<number> {
    const batchNumber =
      line.batchNumber ?? `PURCHASE-${line.item.id}-${Date.now().toString()}`;
    const existing = await this.batches.findByNumber(line.item.id, warehouseId, batchNumber);
    if (existing) {
      await this.batches.adjustQuantity(existing.id, toStorage(line.quantity));
      return existing.id;
    }
    return this.batches.insert({
      item_id: line.item.id,
      warehouse_id: warehouseId,
      batch_number: batchNumber,
      manufacturing_date: line.manufacturingDate,
      expiry_date: line.expiryDate,
      purchase_price: toStorage(line.unitCost),
      quantity_in_stock: toStorage(line.quantity),
      is_active: 1,
    });
  }
}
