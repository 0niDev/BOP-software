/**
 * Sales invoice service.
 *
 * Faithful port of the create path in services/sales_invoice_service.py:
 * validate customer/items/payment, compute totals in exact decimal, deduct
 * stock FIFO, and post a single balanced journal entry that recognises
 * revenue, tax and cost of goods sold -- all inside one transaction so the
 * document, its stock movement and its accounting entry commit together.
 */
import type { SqlDatabase } from "../db/types.js";
import { PAYMENT_METHODS, SystemAccountCodes, type ItemType, type PaymentMethod } from "../domain/enums.js";
import {
  ConflictError,
  InsufficientStockError,
  NotFoundError,
  ValidationError,
} from "../domain/errors.js";
import { Decimal, dec, round2, toQuantity, toStorage, type MoneyLike } from "../domain/money.js";
import { insertRow } from "../repositories/base.js";
import { ItemRepository, type ItemRow } from "../repositories/itemRepository.js";
import { PartyRepository } from "../repositories/partyRepository.js";
import { JournalRepository } from "../repositories/journalRepository.js";
import {
  SalesRepository,
  type SalesInvoiceListRow,
  type SalesInvoiceRow,
} from "../repositories/salesRepository.js";
import { StockBatchRepository, type StockBatchRow } from "../repositories/stockBatchRepository.js";
import { SystemAccountResolver } from "../repositories/systemAccounts.js";
import { AccountingService, type JournalLineInput } from "./accountingService.js";

export interface SalesInvoiceItemInput {
  itemId: number;
  quantity: MoneyLike;
  unitPrice: MoneyLike;
  discountAmount?: MoneyLike;
  taxAmount?: MoneyLike;
}

export interface CreateSalesInvoiceInput {
  customerId: number;
  invoiceDate: string;
  paymentType: PaymentMethod;
  items: readonly SalesInvoiceItemInput[];
  invoiceNumber?: string | null;
  notes?: string | null;
  warehouseId?: number;
  bankAccountId?: number | null;
  createdBy?: number | null;
  companyId?: number;
  /**
   * Skip stock validation and deduction. Used when invoices are entered before
   * opening stock exists: the invoice posts with no COGS or stock movement.
   */
  ignoreStock?: boolean;
}

export interface SalesInvoiceResult {
  id: number;
  invoiceNumber: string;
  customerId: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  journalEntryId: number;
}

interface PreparedLine {
  item: ItemRow;
  quantity: Decimal;
  unitPrice: Decimal;
  discount: Decimal;
  tax: Decimal;
  lineTotal: Decimal;
}

interface PreparedSalesInvoice {
  prepared: PreparedLine[];
  subtotal: Decimal;
  discountAmount: Decimal;
  taxAmount: Decimal;
  totalAmount: Decimal;
  customerName: string;
}


/** One batch's share of a consumed line. A line can span several FIFO batches. */
interface StockConsumption {
  batchId: number;
  quantity: Decimal;
  cost: Decimal;
}

/** COGS / inventory account codes by item type (mirrors the Python mapping). */
const COGS_ACCOUNT_BY_TYPE: Record<ItemType, string> = {
  FINISHED_GOOD: "5000",
  PACKING_MATERIAL: "5001",
  RAW_MATERIAL: "5002",
};
const INVENTORY_ACCOUNT_BY_TYPE: Record<ItemType, string> = {
  FINISHED_GOOD: SystemAccountCodes.INVENTORY_FINISHED_GOODS,
  PACKING_MATERIAL: SystemAccountCodes.INVENTORY_PACKING_MATERIALS,
  RAW_MATERIAL: SystemAccountCodes.INVENTORY_RAW_MATERIALS,
};

export class SalesInvoiceService {
  private readonly parties: PartyRepository;
  private readonly items: ItemRepository;
  private readonly batches: StockBatchRepository;
  private readonly sales: SalesRepository;
  private readonly journal: JournalRepository;
  private readonly accounting: AccountingService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.parties = new PartyRepository(db);
    this.items = new ItemRepository(db);
    this.batches = new StockBatchRepository(db);
    this.sales = new SalesRepository(db);
    this.journal = new JournalRepository(db);
    this.accounting = new AccountingService(db, companyId);
  }

  async list(
    opts: { limit?: number; offset?: number; search?: string } = {},
  ): Promise<SalesInvoiceListRow[]> {
    return this.sales.list(this.companyId, opts);
  }

  async getById(id: number): Promise<{ invoice: SalesInvoiceRow; items: Record<string, unknown>[] }> {
    const invoice = await this.sales.findById(id);
    if (!invoice) throw new NotFoundError(`Sales invoice ${id} not found.`);
    const items = await this.sales.findItems(id);
    return { invoice, items };
  }

  /**
   * Receipts that settled this invoice, for the "delete the payments first"
   * dialog. Allocations are authoritative; receipts recorded before allocations
   * existed have no link, so same-customer receipts are offered as a fallback.
   */
  async listPaymentsForInvoice(id: number): Promise<Array<Record<string, unknown>>> {
    const invoice = await this.sales.findById(id);
    if (!invoice) throw new NotFoundError(`Sales invoice ${id} not found.`);
    const allocated = await this.db.all<Record<string, unknown>>(
      `SELECT r.* FROM receipts r
         JOIN receipt_allocations a ON a.receipt_id = r.id
        WHERE a.sales_invoice_id = ?
        ORDER BY r.receipt_date DESC`,
      [id],
    );
    if (allocated.length > 0) return allocated;
    return this.db.all<Record<string, unknown>>(
      "SELECT * FROM receipts WHERE company_id = ? AND party_id = ? ORDER BY receipt_date DESC",
      [invoice.company_id, invoice.customer_id],
    );
  }

  /** A credit invoice with money against it cannot be edited or cancelled. */
  private assertUnpaid(invoice: SalesInvoiceRow, action: string): void {
    if (invoice.payment_type === "CREDIT" && dec(invoice.paid_amount).greaterThan(0)) {
      throw new ConflictError(
        `Invoice ${invoice.invoice_number} has payments recorded (${Number(invoice.paid_amount).toFixed(2)}). Delete the payments before you ${action} it.`,
      );
    }
  }

  /**
   * A returned invoice still has sales_returns rows pointing at its line ids,
   * so deleting the lines would trip the foreign key. Refuse cleanly instead.
   */
  private async assertNoReturns(
    invoice: { id: number; invoice_number: string },
    action: string,
  ): Promise<void> {
    const row = await this.db.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM sales_returns WHERE invoice_id = ?",
      [invoice.id],
    );
    if (Number(row?.n ?? 0) > 0) {
      throw new ConflictError(
        `Invoice ${invoice.invoice_number} has sales returns. Delete the returns before you ${action} it.`,
      );
    }
  }

  private async prepare(input: CreateSalesInvoiceInput): Promise<PreparedSalesInvoice> {
    if (!PAYMENT_METHODS.includes(input.paymentType)) {
      throw new ValidationError(`Invalid payment type '${input.paymentType}'.`);
    }
    if (!input.items || input.items.length === 0) {
      throw new ValidationError("A sales invoice needs at least one line item.");
    }
    if (!input.invoiceDate) {
      throw new ValidationError("Invoice date is required.");
    }

    const customer = await this.parties.requireById(input.customerId);
    if (!customer.is_active) {
      throw new ValidationError(`Customer '${customer.name}' is not active.`);
    }
    if (customer.party_type !== "CUSTOMER" && customer.party_type !== "BOTH") {
      throw new ValidationError(`Party '${customer.name}' is not a customer.`);
    }

    const prepared: PreparedLine[] = [];
    for (const raw of input.items) {
      const item = await this.items.requireById(raw.itemId);
      if (!item.is_active) {
        throw new ValidationError(`Item '${item.item_name}' is not active.`);
      }
      const quantity = dec(raw.quantity);
      if (quantity.lessThanOrEqualTo(0)) {
        throw new ValidationError(`Quantity for '${item.item_name}' must be greater than zero.`);
      }
      const unitPrice = dec(raw.unitPrice);
      if (unitPrice.lessThan(0)) {
        throw new ValidationError(`Unit price for '${item.item_name}' cannot be negative.`);
      }
      const discount = round2(raw.discountAmount ?? 0);
      const tax = round2(raw.taxAmount ?? 0);
      const lineTotal = round2(quantity.times(unitPrice).minus(discount).plus(tax));
      prepared.push({ item, quantity, unitPrice, discount, tax, lineTotal });
    }

    const subtotal = round2(
      prepared.reduce((acc, l) => acc.plus(l.quantity.times(l.unitPrice)), new Decimal(0)),
    );
    const discountAmount = round2(
      prepared.reduce((acc, l) => acc.plus(l.discount), new Decimal(0)),
    );
    const taxAmount = round2(prepared.reduce((acc, l) => acc.plus(l.tax), new Decimal(0)));
    const totalAmount = round2(subtotal.minus(discountAmount).plus(taxAmount));

    return { prepared, subtotal, discountAmount, taxAmount, totalAmount, customerName: customer.name };
  }

  async createSalesInvoice(input: CreateSalesInvoiceInput): Promise<SalesInvoiceResult> {
    const companyId = input.companyId ?? this.companyId;
    const warehouseId = input.warehouseId ?? 1;
    const ctx = await this.prepare(input);

    // --- invoice number (explicit, or allocated from the sequence) ----------
    let invoiceNumber = input.invoiceNumber?.trim() || "";
    if (invoiceNumber) {
      if (await this.sales.invoiceNumberExists(invoiceNumber, companyId)) {
        throw new ConflictError(`Invoice number '${invoiceNumber}' already exists.`);
      }
    }

    return this.db.transaction(async () => {
      // Allocate the number inside the transaction: a shortfall discovered while
      // consuming stock, or any other failure while writing the document, then
      // rolls the sequence back with it instead of burning a number.
      if (!invoiceNumber) {
        invoiceNumber = await this.journal.nextVoucherNumber(companyId, "SALES");
      }
      const invoiceId = await this.sales.insertInvoice({
        company_id: companyId,
        warehouse_id: warehouseId,
        invoice_number: invoiceNumber,
        customer_id: input.customerId,
        invoice_date: input.invoiceDate,
        payment_type: input.paymentType,
        bank_account_id: input.bankAccountId ?? null,
        subtotal: toStorage(ctx.subtotal),
        discount_amount: toStorage(ctx.discountAmount),
        tax_amount: toStorage(ctx.taxAmount),
        total_amount: toStorage(ctx.totalAmount),
        paid_amount: input.paymentType === "CREDIT" ? 0 : toStorage(ctx.totalAmount),
        status: "CONFIRMED",
        notes: input.notes ?? null,
        created_by: input.createdBy ?? null,
      });

      const journalEntryId = await this.postEffects(
        invoiceId,
        invoiceNumber,
        input,
        ctx,
        warehouseId,
        companyId,
      );

      return {
        id: invoiceId,
        invoiceNumber,
        customerId: input.customerId,
        subtotal: toStorage(ctx.subtotal),
        discountAmount: toStorage(ctx.discountAmount),
        taxAmount: toStorage(ctx.taxAmount),
        totalAmount: toStorage(ctx.totalAmount),
        journalEntryId,
      };
    });
  }

  /**
   * Edit an existing invoice: reverse its journal, stock and bank effects, then
   * re-post the replacement lines under the same invoice number — atomically.
   */
  async updateSalesInvoice(
    id: number,
    input: CreateSalesInvoiceInput,
  ): Promise<SalesInvoiceResult> {
    const existing = await this.sales.findById(id);
    if (!existing) throw new NotFoundError(`Sales invoice ${id} not found.`);
    if (existing.status === "CANCELLED") {
      throw new ValidationError("A cancelled invoice cannot be edited.");
    }
    this.assertUnpaid(existing, "edit");
    await this.assertNoReturns(existing, "edit");
    const companyId = input.companyId ?? this.companyId;
    const warehouseId = input.warehouseId ?? existing.warehouse_id;
    const ctx = await this.prepare(input);

    return this.db.transaction(async () => {
      await this.clearEffects(id, existing.invoice_number);
      await this.sales.updateInvoice(id, {
        warehouse_id: warehouseId,
        customer_id: input.customerId,
        invoice_date: input.invoiceDate,
        payment_type: input.paymentType,
        bank_account_id: input.bankAccountId ?? null,
        subtotal: toStorage(ctx.subtotal),
        discount_amount: toStorage(ctx.discountAmount),
        tax_amount: toStorage(ctx.taxAmount),
        total_amount: toStorage(ctx.totalAmount),
        paid_amount: input.paymentType === "CREDIT" ? 0 : toStorage(ctx.totalAmount),
        status: "CONFIRMED",
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      });

      const journalEntryId = await this.postEffects(
        id,
        existing.invoice_number,
        input,
        ctx,
        warehouseId,
        companyId,
      );
      return {
        id,
        invoiceNumber: existing.invoice_number,
        customerId: input.customerId,
        subtotal: toStorage(ctx.subtotal),
        discountAmount: toStorage(ctx.discountAmount),
        taxAmount: toStorage(ctx.taxAmount),
        totalAmount: toStorage(ctx.totalAmount),
        journalEntryId,
      };
    });
  }

  /** Cancel an invoice and reverse its journal, stock and bank effects. */
  async deleteSalesInvoice(id: number): Promise<void> {
    const existing = await this.sales.findById(id);
    if (!existing) throw new NotFoundError(`Sales invoice ${id} not found.`);
    if (existing.status === "CANCELLED") return;
    this.assertUnpaid(existing, "cancel");
    await this.assertNoReturns(existing, "cancel");
    await this.db.transaction(async () => {
      await this.clearEffects(id, existing.invoice_number);
      await this.sales.updateInvoice(id, {
        status: "CANCELLED",
        updated_at: new Date().toISOString(),
      });
    });
  }

  /** Remove every accounting, stock and bank trace of an invoice. */
  private async clearEffects(invoiceId: number, invoiceNumber: string): Promise<void> {
    await this.db.run(
      `DELETE FROM journal_entry_lines WHERE journal_entry_id IN
         (SELECT id FROM journal_entries WHERE source_table = 'sales_invoices' AND source_id = ?)`,
      [invoiceId],
    );
    await this.db.run(
      "DELETE FROM journal_entries WHERE source_table = 'sales_invoices' AND source_id = ?",
      [invoiceId],
    );

    const rows = await this.db.all<{ batch_id: number | null; quantity: number }>(
      "SELECT batch_id, quantity FROM sales_invoice_items WHERE invoice_id = ?",
      [invoiceId],
    );
    for (const row of rows) {
      if (row.batch_id != null) {
        await this.batches.adjustQuantity(row.batch_id, toQuantity(dec(row.quantity)));
      }
    }
    await this.db.run(
      "DELETE FROM stock_movements WHERE reference_table = 'sales_invoices' AND reference_id = ?",
      [invoiceId],
    );
    await this.db.run("DELETE FROM sales_invoice_items WHERE invoice_id = ?", [invoiceId]);
    await this.db.run("DELETE FROM bank_transactions WHERE reference_no = ?", [invoiceNumber]);
  }

  /** Stock, journal and bank side of a confirmed sales invoice. */
  private async postEffects(
    invoiceId: number,
    invoiceNumber: string,
    input: CreateSalesInvoiceInput,
    ctx: PreparedSalesInvoice,
    warehouseId: number,
    companyId: number,
  ): Promise<number> {
    const resolver = new SystemAccountResolver(this.db, companyId);
    const revenueId = await resolver.idFor(SystemAccountCodes.SALES_REVENUE);
    const taxId = await resolver.idFor(SystemAccountCodes.SALES_TAX_PAYABLE);
    const debit = await this.resolvePaymentAccount(input, resolver, input.customerId);

    const journalLines: JournalLineInput[] = [
      {
        accountId: debit.accountId,
        debit: ctx.totalAmount,
        partyId: debit.partyId,
        description: debit.description,
      },
      {
        accountId: revenueId,
        credit: round2(ctx.subtotal.minus(ctx.discountAmount)),
        description: "Sales revenue",
      },
    ];
    if (ctx.taxAmount.greaterThan(0)) {
      journalLines.push({ accountId: taxId, credit: ctx.taxAmount, description: "Sales tax" });
    }

    let cogsTotal = new Decimal(0);
    const cogsByType = new Map<ItemType, Decimal>();
    const inventoryCredits = new Map<number, Decimal>();

    for (const line of ctx.prepared) {
      let shares: Array<{ batchId: number | null; quantity: Decimal; cost: Decimal }>;
      if (input.ignoreStock) {
        // No stock entered yet: record the line alone, no batches or COGS.
        shares = [{ batchId: null, quantity: line.quantity, cost: new Decimal(0) }];
      } else {
        // A line can span several FIFO batches; record every batch share so a
        // later return restores the right batch and COGS nets to zero.
        const consumed = await this.consumeStock(line.item, warehouseId, line.quantity);
        shares = consumed.shares;
        cogsTotal = cogsTotal.plus(consumed.cost);
        cogsByType.set(
          line.item.item_type,
          (cogsByType.get(line.item.item_type) ?? new Decimal(0)).plus(consumed.cost),
        );
        const inventoryCode = INVENTORY_ACCOUNT_BY_TYPE[line.item.item_type];
        const inventoryId = await resolver.idFor(inventoryCode);
        inventoryCredits.set(
          inventoryId,
          (inventoryCredits.get(inventoryId) ?? new Decimal(0)).plus(consumed.cost),
        );
      }

      for (const share of shares) {
        await this.sales.insertItem({
          invoice_id: invoiceId,
          item_id: line.item.id,
          batch_id: share.batchId,
          quantity: toQuantity(share.quantity),
          unit_price: toStorage(line.unitPrice),
          discount_amount: toStorage(line.discount),
          tax_amount: toStorage(line.tax),
          line_total: toStorage(line.lineTotal),
        });
        if (share.batchId === null) continue;
        // Stock movement (negative: stock leaving the warehouse).
        await insertRow(this.db, "stock_movements", {
          item_id: line.item.id,
          batch_id: share.batchId,
          warehouse_id: warehouseId,
          movement_type: "SALE",
          quantity: -toQuantity(share.quantity),
          unit_cost: share.quantity.isZero()
            ? 0
            : toStorage(share.cost.dividedBy(share.quantity)),
          reference_table: "sales_invoices",
          reference_id: invoiceId,
          movement_date: input.invoiceDate,
          notes: `Sales invoice ${invoiceNumber}`,
          created_by: input.createdBy ?? null,
        });
      }
    }

    if (!input.ignoreStock) {
      await this.appendCogsLines(journalLines, resolver, cogsTotal, cogsByType, inventoryCredits);
    }

    const journalEntryId = await this.accounting.postJournalEntry({
      voucherType: "SALES",
      voucherNumber: invoiceNumber,
      entryDate: input.invoiceDate,
      lines: journalLines,
      sourceTable: "sales_invoices",
      sourceId: invoiceId,
      narration: `Sales invoice ${invoiceNumber} to ${ctx.customerName}`,
      companyId,
      createdBy: input.createdBy ?? null,
    });

    // Record the deposit for BANK/CHEQUE sales (mirrors the Python app).
    if (
      (input.paymentType === "BANK" || input.paymentType === "CHEQUE") &&
      input.bankAccountId
    ) {
      await this.db.run(
        `INSERT INTO bank_transactions
           (bank_account_id, transaction_type, amount, transaction_date, reference_no, notes, created_at)
         VALUES (?, 'DEPOSIT', ?, ?, ?, ?, datetime('now'))`,
        [
          input.bankAccountId,
          toStorage(ctx.totalAmount),
          input.invoiceDate,
          invoiceNumber,
          `Sales invoice ${invoiceNumber} - ${input.paymentType} payment`,
        ],
      );
    }

    return journalEntryId;
  }

  /** Determine which account is debited for the amount the customer pays. */
  private async resolvePaymentAccount(
    input: CreateSalesInvoiceInput,
    resolver: SystemAccountResolver,
    customerId: number,
  ): Promise<{ accountId: number; partyId: number | null; description: string }> {
    if (input.paymentType === "CREDIT") {
      return {
        accountId: await resolver.idFor(SystemAccountCodes.ACCOUNTS_RECEIVABLE),
        partyId: customerId,
        description: "Credit sale",
      };
    }
    if (input.paymentType === "CASH") {
      return {
        accountId: await resolver.idFor(SystemAccountCodes.CASH_IN_HAND),
        partyId: null,
        description: "Cash sale",
      };
    }
    // BANK / CHEQUE
    if (input.bankAccountId) {
      const bank = await this.db.get<{ account_id: number; bank_name: string }>(
        "SELECT account_id, bank_name FROM bank_accounts WHERE id = ?",
        [input.bankAccountId],
      );
      if (!bank) throw new ValidationError("Selected bank account not found.");
      return {
        accountId: bank.account_id,
        partyId: null,
        description: `${input.paymentType} sale - ${bank.bank_name}`,
      };
    }
    return {
      accountId: await resolver.idFor(SystemAccountCodes.BANK_ACCOUNTS),
      partyId: null,
      description: `${input.paymentType} sale`,
    };
  }

  /**
   * Consume `needed` units of stock FIFO across the item's batches, returning
   * every batch share consumed and the exact cost consumed. A line that spans
   * several batches is split across them so a later return restores the right
   * batch and COGS nets to zero.
   */
  private async consumeStock(
    item: ItemRow,
    warehouseId: number,
    needed: Decimal,
  ): Promise<{ shares: StockConsumption[]; cost: Decimal }> {
    const batches = await this.batches.listAvailableFifo(item.id, warehouseId);
    if (batches.length === 0) {
      throw new ValidationError(
        `No stock batch found for item '${item.item_name}' in warehouse ${warehouseId}.`,
      );
    }
    const available = batches.reduce((acc, b) => acc.plus(dec(b.quantity_in_stock)), new Decimal(0));
    if (available.lessThan(needed)) {
      throw new InsufficientStockError(
        `Insufficient stock for '${item.item_name}': need ${needed.toString()}, available ${available.toString()}.`,
      );
    }

    const shares: StockConsumption[] = [];
    let remaining = needed;
    let cost = new Decimal(0);
    for (const batch of batches) {
      if (remaining.lessThanOrEqualTo(0)) break;
      const take = Decimal.min(dec(batch.quantity_in_stock), remaining);
      await this.batches.adjustQuantity(batch.id, -toQuantity(take));
      const shareCost = round2(take.times(this.unitCost(item, batch)));
      cost = cost.plus(shareCost);
      remaining = remaining.minus(take);
      shares.push({ batchId: batch.id, quantity: take, cost: shareCost });
    }
    return { shares, cost: round2(cost) };
  }

  /** Best available unit cost for a batch, falling back to the item price. */
  private unitCost(item: ItemRow, batch: StockBatchRow): Decimal {
    const composed = dec(batch.raw_unit_cost).plus(dec(batch.packing_unit_cost));
    if (composed.greaterThan(0)) return composed;
    if (dec(batch.purchase_price).greaterThan(0)) return dec(batch.purchase_price);
    return dec(item.purchase_price);
  }

  private async appendCogsLines(
    lines: JournalLineInput[],
    resolver: SystemAccountResolver,
    cogsTotal: Decimal,
    cogsByType: Map<ItemType, Decimal>,
    inventoryCredits: Map<number, Decimal>,
  ): Promise<void> {
    if (cogsTotal.lessThanOrEqualTo(0)) {
      throw new ValidationError("Sales invoice produced zero COGS. Check that stock batches have valid costs.");
    }
    for (const [itemType, amount] of cogsByType) {
      if (amount.lessThanOrEqualTo(0)) continue;
      const code = COGS_ACCOUNT_BY_TYPE[itemType];
      // 5002 (raw material COGS) is not always seeded; fall back to 5000.
      let accountId: number;
      try {
        accountId = await resolver.idFor(code);
      } catch {
        accountId = await resolver.idFor(SystemAccountCodes.COST_OF_GOODS_SOLD);
      }
      lines.push({ accountId, debit: amount, description: `COGS (${itemType})` });
    }
    for (const [inventoryId, amount] of inventoryCredits) {
      lines.push({ accountId: inventoryId, credit: amount, description: "Reduce inventory" });
    }
  }
}
