/**
 * Sales and purchase returns.
 *
 * The original Python app defined the sales_returns / purchase_returns tables
 * but exposed no create path, so this is a clean implementation rather than a
 * line-by-line port.
 *
 * Sales return:     Dr Sales Returns (4100)     Cr AR/Cash      (net sale reversed)
 *                   Dr Inventory (by type)      Cr COGS (5000)  (cost restored)
 * Purchase return:  Dr Accounts Payable (2000)  Cr Inventory (by type)
 */
import type { SqlDatabase } from "../db/types.js";
import { SystemAccountCodes, type ItemType } from "../domain/enums.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../domain/errors.js";
import { Decimal, dec, round2, toStorage } from "../domain/money.js";
import { ItemRepository } from "../repositories/itemRepository.js";
import { JournalRepository } from "../repositories/journalRepository.js";
import { PurchaseRepository } from "../repositories/purchaseRepository.js";
import { ReturnsRepository } from "../repositories/returnsRepository.js";
import { SalesRepository } from "../repositories/salesRepository.js";
import { StockBatchRepository } from "../repositories/stockBatchRepository.js";
import { SystemAccountResolver } from "../repositories/systemAccounts.js";
import { AccountingService, type JournalLineInput } from "./accountingService.js";

export interface ReturnLineInput {
  /** sales_invoice_items.id or purchase_invoice_items.id */
  invoiceItemId: number;
  quantity: number | string;
}

export interface CreateSalesReturnInput {
  invoiceId: number;
  returnDate: string;
  items: readonly ReturnLineInput[];
  returnNumber?: string | null;
  notes?: string | null;
  companyId?: number;
  createdBy?: number | null;
}

export interface CreatePurchaseReturnInput {
  invoiceId: number;
  returnDate: string;
  items: readonly ReturnLineInput[];
  returnNumber?: string | null;
  notes?: string | null;
  companyId?: number;
  createdBy?: number | null;
}

export interface ReturnResult {
  id: number;
  returnNumber: string;
  totalAmount: number;
  journalEntryId: number;
}

/** Columns we read from an invoice line when building a return. */
interface InvoiceItemRow {
  id: number;
  item_id: number;
  batch_id: number | null;
  quantity: number;
  line_total: number;
}

const INVENTORY_ACCOUNT_BY_TYPE: Record<ItemType, string> = {
  RAW_MATERIAL: SystemAccountCodes.INVENTORY_RAW_MATERIALS,
  PACKING_MATERIAL: SystemAccountCodes.INVENTORY_PACKING_MATERIALS,
  FINISHED_GOOD: SystemAccountCodes.INVENTORY_FINISHED_GOODS,
};

export class ReturnsService {
  private readonly items: ItemRepository;
  private readonly batches: StockBatchRepository;
  private readonly sales: SalesRepository;
  private readonly purchases: PurchaseRepository;
  private readonly returns: ReturnsRepository;
  private readonly journal: JournalRepository;
  private readonly accounting: AccountingService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.items = new ItemRepository(db);
    this.batches = new StockBatchRepository(db);
    this.sales = new SalesRepository(db);
    this.purchases = new PurchaseRepository(db);
    this.returns = new ReturnsRepository(db);
    this.journal = new JournalRepository(db);
    this.accounting = new AccountingService(db, companyId);
  }

  async listSalesReturns(): Promise<Record<string, unknown>[]> {
    return this.returns.listSalesReturns(this.companyId);
  }

  async listPurchaseReturns(): Promise<Record<string, unknown>[]> {
    return this.returns.listPurchaseReturns(this.companyId);
  }

  async createSalesReturn(input: CreateSalesReturnInput): Promise<ReturnResult> {
    const companyId = input.companyId ?? this.companyId;
    const invoice = await this.sales.findById(input.invoiceId);
    if (!invoice) throw new NotFoundError(`Sales invoice ${input.invoiceId} not found.`);
    if (invoice.status === "CANCELLED") {
      throw new ValidationError("Cannot return a cancelled invoice.");
    }
    if (!input.items?.length) throw new ValidationError("A return needs at least one line.");

    const invoiceItems = (await this.sales.findItems(invoice.id)) as unknown as InvoiceItemRow[];
    const invoiceItemsById = new Map(invoiceItems.map((row) => [row.id, row]));

    const resolver = new SystemAccountResolver(this.db, companyId);
    const salesReturnsId = await resolver.idFor(SystemAccountCodes.SALES_RETURNS);
    const cogsId = await resolver.idFor(SystemAccountCodes.COST_OF_GOODS_SOLD);
    const settleId =
      invoice.payment_type === "CREDIT"
        ? await resolver.idFor(SystemAccountCodes.ACCOUNTS_RECEIVABLE)
        : await resolver.idFor(SystemAccountCodes.CASH_IN_HAND);

    let returnNumber = input.returnNumber?.trim() || "";
    if (returnNumber) {
      if (await this.returns.salesReturnNumberExists(returnNumber, companyId)) {
        throw new ConflictError(`Return number '${returnNumber}' already exists.`);
      }
    } else {
      returnNumber = await this.journal.nextVoucherNumber(companyId, "SALES_RETURN");
    }

    return this.db.transaction(async () => {
      let netTotal = new Decimal(0);
      let costTotal = new Decimal(0);
      const inventoryCredits = new Map<number, Decimal>();
      const returnLines: Array<{ invoiceItemId: number; quantity: Decimal; amount: Decimal }> = [];

      for (const line of input.items) {
        const item = invoiceItemsById.get(line.invoiceItemId);
        if (!item) {
          throw new NotFoundError(`Invoice line ${line.invoiceItemId} not found on this invoice.`);
        }
        const quantity = dec(line.quantity);
        const soldQty = dec(item.quantity);
        if (quantity.lessThanOrEqualTo(0) || quantity.greaterThan(soldQty)) {
          throw new ValidationError(
            `Return quantity for line ${line.invoiceItemId} must be between 0 and ${soldQty.toString()}.`,
          );
        }
        const unitNet = dec(item.line_total).dividedBy(soldQty);
        const amount = round2(quantity.times(unitNet));
        netTotal = netTotal.plus(amount);

        // Restore stock and reverse the cost of goods sold.
        const itemRow = await this.items.requireById(item.item_id);
        let unitCost = dec(itemRow.purchase_price);
        if (item.batch_id != null) {
          await this.batches.adjustQuantity(item.batch_id, quantity.toNumber());
          const batch = await this.batches.findById(item.batch_id);
          if (batch) {
            const composed = dec(batch.raw_unit_cost).plus(dec(batch.packing_unit_cost));
            if (composed.greaterThan(0)) unitCost = composed;
            else if (dec(batch.purchase_price).greaterThan(0)) unitCost = dec(batch.purchase_price);
          }
        }
        const cost = round2(quantity.times(unitCost));
        costTotal = costTotal.plus(cost);
        const inventoryId = await resolver.idFor(INVENTORY_ACCOUNT_BY_TYPE[itemRow.item_type]);
        inventoryCredits.set(inventoryId, (inventoryCredits.get(inventoryId) ?? new Decimal(0)).plus(cost));

        returnLines.push({ invoiceItemId: line.invoiceItemId, quantity, amount });
      }

      const returnId = await this.returns.insertSalesReturn({
        company_id: companyId,
        return_number: returnNumber,
        invoice_id: invoice.id,
        return_date: input.returnDate,
        total_amount: toStorage(netTotal),
        notes: input.notes ?? null,
        created_by: input.createdBy ?? null,
      });

      for (const line of returnLines) {
        await this.returns.insertSalesReturnItem({
          return_id: returnId,
          invoice_item_id: line.invoiceItemId,
          quantity: toStorage(line.quantity),
          line_total: toStorage(line.amount),
        });
      }

      const journalLines: JournalLineInput[] = [
        { accountId: salesReturnsId, debit: netTotal, description: `Sales return ${returnNumber}` },
        {
          accountId: settleId,
          credit: netTotal,
          partyId: invoice.payment_type === "CREDIT" ? invoice.customer_id : null,
          description: `Sales return ${returnNumber}`,
        },
      ];
      if (costTotal.greaterThan(0)) {
        journalLines.push({ accountId: cogsId, credit: costTotal, description: "Reverse COGS" });
        for (const [inventoryId, amount] of inventoryCredits) {
          journalLines.push({ accountId: inventoryId, debit: amount, description: "Restore inventory" });
        }
      }

      const journalEntryId = await this.accounting.postJournalEntry({
        voucherType: "SALES_RETURN",
        entryDate: input.returnDate,
        lines: journalLines,
        sourceTable: "sales_returns",
        sourceId: returnId,
        narration: `Sales return ${returnNumber}`,
        companyId,
        createdBy: input.createdBy ?? null,
      });

      return { id: returnId, returnNumber, totalAmount: toStorage(netTotal), journalEntryId };
    });
  }

  async createPurchaseReturn(input: CreatePurchaseReturnInput): Promise<ReturnResult> {
    const companyId = input.companyId ?? this.companyId;
    const invoice = await this.purchases.findById(input.invoiceId);
    if (!invoice) throw new NotFoundError(`Purchase invoice ${input.invoiceId} not found.`);
    if (!input.items?.length) throw new ValidationError("A return needs at least one line.");

    const invoiceItems = (await this.purchases.findItems(invoice.id)) as unknown as InvoiceItemRow[];
    const invoiceItemsById = new Map(invoiceItems.map((row) => [row.id, row]));

    const resolver = new SystemAccountResolver(this.db, companyId);
    const apId = await resolver.idFor(SystemAccountCodes.ACCOUNTS_PAYABLE);

    let returnNumber = input.returnNumber?.trim() || "";
    if (returnNumber) {
      if (await this.returns.purchaseReturnNumberExists(returnNumber, companyId)) {
        throw new ConflictError(`Return number '${returnNumber}' already exists.`);
      }
    } else {
      returnNumber = await this.journal.nextVoucherNumber(companyId, "PURCHASE_RETURN");
    }

    return this.db.transaction(async () => {
      let netTotal = new Decimal(0);
      const inventoryDebits = new Map<number, Decimal>();
      const returnLines: Array<{ invoiceItemId: number; quantity: Decimal; amount: Decimal }> = [];

      for (const line of input.items) {
        const item = invoiceItemsById.get(line.invoiceItemId);
        if (!item) {
          throw new NotFoundError(`Invoice line ${line.invoiceItemId} not found on this invoice.`);
        }
        const quantity = dec(line.quantity);
        const soldQty = dec(item.quantity);
        if (quantity.lessThanOrEqualTo(0) || quantity.greaterThan(soldQty)) {
          throw new ValidationError(
            `Return quantity for line ${line.invoiceItemId} must be between 0 and ${soldQty.toString()}.`,
          );
        }
        const amount = round2(quantity.times(dec(item.line_total).dividedBy(soldQty)));
        netTotal = netTotal.plus(amount);

        // Remove the returned stock from its batch.
        if (item.batch_id != null) {
          await this.batches.adjustQuantity(item.batch_id, quantity.negated().toNumber());
        }
        const itemRow = await this.items.requireById(item.item_id);
        const inventoryId = await resolver.idFor(INVENTORY_ACCOUNT_BY_TYPE[itemRow.item_type]);
        inventoryDebits.set(inventoryId, (inventoryDebits.get(inventoryId) ?? new Decimal(0)).plus(amount));

        returnLines.push({ invoiceItemId: line.invoiceItemId, quantity, amount });
      }

      const returnId = await this.returns.insertPurchaseReturn({
        company_id: companyId,
        return_number: returnNumber,
        invoice_id: invoice.id,
        return_date: input.returnDate,
        total_amount: toStorage(netTotal),
        notes: input.notes ?? null,
        created_by: input.createdBy ?? null,
      });

      for (const line of returnLines) {
        await this.returns.insertPurchaseReturnItem({
          return_id: returnId,
          invoice_item_id: line.invoiceItemId,
          quantity: toStorage(line.quantity),
          line_total: toStorage(line.amount),
        });
      }

      const journalLines: JournalLineInput[] = [
        {
          accountId: apId,
          debit: netTotal,
          partyId: invoice.supplier_id,
          description: `Purchase return ${returnNumber}`,
        },
      ];
      for (const [inventoryId, amount] of inventoryDebits) {
        journalLines.push({ accountId: inventoryId, credit: amount, description: "Return to supplier" });
      }

      const journalEntryId = await this.accounting.postJournalEntry({
        voucherType: "PURCHASE_RETURN",
        entryDate: input.returnDate,
        lines: journalLines,
        sourceTable: "purchase_returns",
        sourceId: returnId,
        narration: `Purchase return ${returnNumber}`,
        companyId,
        createdBy: input.createdBy ?? null,
      });

      return { id: returnId, returnNumber, totalAmount: toStorage(netTotal), journalEntryId };
    });
  }
}
