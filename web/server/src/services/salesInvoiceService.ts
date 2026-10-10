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
import { Decimal, dec, round2, toStorage, type MoneyLike } from "../domain/money.js";
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

  async createSalesInvoice(input: CreateSalesInvoiceInput): Promise<SalesInvoiceResult> {
    const companyId = input.companyId ?? this.companyId;
    const warehouseId = input.warehouseId ?? 1;

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

    // --- resolve the account the customer pays into -------------------------
    const resolver = new SystemAccountResolver(this.db, companyId);
    const revenueId = await resolver.idFor(SystemAccountCodes.SALES_REVENUE);
    const taxId = await resolver.idFor(SystemAccountCodes.SALES_TAX_PAYABLE);
    const debit = await this.resolvePaymentAccount(input, resolver, customer.id);

    // --- invoice number (explicit, or allocated from the sequence) ----------
    let invoiceNumber = input.invoiceNumber?.trim() || "";
    if (invoiceNumber) {
      if (await this.sales.invoiceNumberExists(invoiceNumber, companyId)) {
        throw new ConflictError(`Invoice number '${invoiceNumber}' already exists.`);
      }
    } else {
      invoiceNumber = await this.journal.nextVoucherNumber(companyId, "SALES");
    }

    return this.db.transaction(async () => {
      const invoiceId = await this.sales.insertInvoice({
        company_id: companyId,
        warehouse_id: warehouseId,
        invoice_number: invoiceNumber,
        customer_id: customer.id,
        invoice_date: input.invoiceDate,
        payment_type: input.paymentType,
        bank_account_id: input.bankAccountId ?? null,
        subtotal: toStorage(subtotal),
        discount_amount: toStorage(discountAmount),
        tax_amount: toStorage(taxAmount),
        total_amount: toStorage(totalAmount),
        paid_amount:
          input.paymentType === "CREDIT" ? 0 : toStorage(totalAmount),
        status: "CONFIRMED",
        notes: input.notes ?? null,
        created_by: input.createdBy ?? null,
      });

      const journalLines: JournalLineInput[] = [
        {
          accountId: debit.accountId,
          debit: totalAmount,
          partyId: debit.partyId,
          description: debit.description,
        },
        {
          accountId: revenueId,
          credit: round2(subtotal.minus(discountAmount)),
          description: "Sales revenue",
        },
      ];
      if (taxAmount.greaterThan(0)) {
        journalLines.push({ accountId: taxId, credit: taxAmount, description: "Sales tax" });
      }

      let cogsTotal = new Decimal(0);
      const cogsByType = new Map<ItemType, Decimal>();
      const inventoryCredits = new Map<number, Decimal>();

      for (const line of prepared) {
        const consumed = await this.consumeStock(line.item, warehouseId, line.quantity);
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

        await this.sales.insertItem({
          invoice_id: invoiceId,
          item_id: line.item.id,
          batch_id: consumed.batchId,
          quantity: toStorage(line.quantity),
          unit_price: toStorage(line.unitPrice),
          discount_amount: toStorage(line.discount),
          tax_amount: toStorage(line.tax),
          line_total: toStorage(line.lineTotal),
        });
      }

      await this.appendCogsLines(journalLines, resolver, cogsTotal, cogsByType, inventoryCredits);

      const journalEntryId = await this.accounting.postJournalEntry({
        voucherType: "SALES",
        entryDate: input.invoiceDate,
        lines: journalLines,
        sourceTable: "sales_invoices",
        sourceId: invoiceId,
        narration: `Sales invoice ${invoiceNumber} to ${customer.name}`,
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
            toStorage(totalAmount),
            input.invoiceDate,
            invoiceNumber,
            `Sales invoice ${invoiceNumber} - ${input.paymentType} payment`,
          ],
        );
      }

      return {
        id: invoiceId,
        invoiceNumber,
        customerId: customer.id,
        subtotal: toStorage(subtotal),
        discountAmount: toStorage(discountAmount),
        taxAmount: toStorage(taxAmount),
        totalAmount: toStorage(totalAmount),
        journalEntryId,
      };
    });
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
   * the batch that supplied the first unit and the exact cost consumed.
   */
  private async consumeStock(
    item: ItemRow,
    warehouseId: number,
    needed: Decimal,
  ): Promise<{ batchId: number; cost: Decimal }> {
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

    let remaining = needed;
    let cost = new Decimal(0);
    for (const batch of batches) {
      if (remaining.lessThanOrEqualTo(0)) break;
      const take = Decimal.min(dec(batch.quantity_in_stock), remaining);
      await this.batches.adjustQuantity(batch.id, take.negated().toNumber());
      cost = cost.plus(take.times(this.unitCost(item, batch)));
      remaining = remaining.minus(take);
    }
    return { batchId: batches[0]!.id, cost: round2(cost) };
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
