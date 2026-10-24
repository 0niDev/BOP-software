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
import { Decimal, dec, round2, toQuantity, toStorage } from "../domain/money.js";
import { ItemRepository } from "../repositories/itemRepository.js";
import { JournalRepository } from "../repositories/journalRepository.js";
import { PurchaseRepository } from "../repositories/purchaseRepository.js";
import { ReturnsRepository } from "../repositories/returnsRepository.js";
import { SalesRepository } from "../repositories/salesRepository.js";
import { StockBatchRepository } from "../repositories/stockBatchRepository.js";
import { SystemAccountResolver } from "../repositories/systemAccounts.js";
import { AccountingService, type JournalLineInput } from "./accountingService.js";
import { AuditService } from "./auditService.js";
import { deleteJournalBySource } from "./journalEffects.js";
import { insertRow } from "../repositories/base.js";

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

/**
 * COGS accounts by item type, identical to the sales-invoice mapping. A return
 * must reverse the *same* COGS account the sale debited, otherwise a sale +
 * full return leaves a residual in two different expense accounts instead of
 * netting to zero.
 */
const COGS_ACCOUNT_BY_TYPE: Record<ItemType, string> = {
  FINISHED_GOOD: "5000",
  PACKING_MATERIAL: "5001",
  RAW_MATERIAL: "5002",
};

export class ReturnsService {
  private readonly items: ItemRepository;
  private readonly batches: StockBatchRepository;
  private readonly sales: SalesRepository;
  private readonly purchases: PurchaseRepository;
  private readonly returns: ReturnsRepository;
  private readonly journal: JournalRepository;
  private readonly accounting: AccountingService;
  private readonly audit: AuditService;

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
    this.audit = new AuditService(db);
  }

  async listSalesReturns(): Promise<Record<string, unknown>[]> {
    return this.returns.listSalesReturns(this.companyId);
  }

  async listPurchaseReturns(): Promise<Record<string, unknown>[]> {
    return this.returns.listPurchaseReturns(this.companyId);
  }

  async getSalesReturn(
    id: number,
  ): Promise<{ return: Record<string, unknown>; items: Record<string, unknown>[] }> {
    const row = await this.returns.findSalesReturnById(id);
    if (!row) throw new NotFoundError(`Sales return ${id} not found.`);
    return { return: row, items: await this.returns.listSalesReturnItems(id) };
  }

  async getPurchaseReturn(
    id: number,
  ): Promise<{ return: Record<string, unknown>; items: Record<string, unknown>[] }> {
    const row = await this.returns.findPurchaseReturnById(id);
    if (!row) throw new NotFoundError(`Purchase return ${id} not found.`);
    return { return: row, items: await this.returns.listPurchaseReturnItems(id) };
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
      const cogsByType = new Map<ItemType, Decimal>();
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
          await this.batches.adjustQuantity(item.batch_id, toQuantity(quantity));
          const batch = await this.batches.findById(item.batch_id);
          if (batch) {
            const composed = dec(batch.raw_unit_cost).plus(dec(batch.packing_unit_cost));
            if (composed.greaterThan(0)) unitCost = composed;
            else if (dec(batch.purchase_price).greaterThan(0)) unitCost = dec(batch.purchase_price);
          }
        }
        const cost = round2(quantity.times(unitCost));
        costTotal = costTotal.plus(cost);
        cogsByType.set(
          itemRow.item_type,
          (cogsByType.get(itemRow.item_type) ?? new Decimal(0)).plus(cost),
        );
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
          quantity: toQuantity(line.quantity),
          line_total: toStorage(line.amount),
        });
      }

      // Record stock movements for the return (restore stock to batch).
      for (const line of input.items) {
        const item = invoiceItemsById.get(line.invoiceItemId);
        if (item?.batch_id != null) {
          await insertRow(this.db, "stock_movements", {
            item_id: item.item_id,
            batch_id: item.batch_id,
            warehouse_id: invoice.warehouse_id ?? 1,
            movement_type: "SALE_RETURN",
            quantity: line.quantity,
            unit_cost: 0,
            reference_table: "sales_returns",
            reference_id: returnId,
            movement_date: input.returnDate,
            notes: `Sales return ${returnNumber}`,
            created_by: input.createdBy ?? null,
          });
        }
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
        for (const [itemType, amount] of cogsByType) {
          if (amount.lessThanOrEqualTo(0)) continue;
          journalLines.push({
            accountId: await this.cogsAccountId(resolver, itemType),
            credit: amount,
            description: `Reverse COGS (${itemType})`,
          });
        }
        for (const [inventoryId, amount] of inventoryCredits) {
          journalLines.push({ accountId: inventoryId, debit: amount, description: "Restore inventory" });
        }
      }

      const journalEntryId = await this.accounting.postJournalEntry({
        voucherType: "SALES_RETURN",
        voucherNumber: returnNumber,
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

    // Cash/Bank purchases are refunded to the payment account; only CREDIT
    // purchases use A/P. A return on a cash invoice credits the refund account
    // (a refund); a credit purchase debits A/P (a receivable reduction).
    const isCredit = invoice.payment_type === "CREDIT";
    const refundAccountId = isCredit
      ? apId
      : invoice.payment_type === "CASH"
        ? await resolver.idFor(SystemAccountCodes.CASH_IN_HAND)
        : await this.resolveBankAccount(invoice.bank_account_id);

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
          await this.batches.adjustQuantity(item.batch_id, -toQuantity(quantity));
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
          quantity: toQuantity(line.quantity),
          line_total: toStorage(line.amount),
        });
      }

      // Record stock movements for the return (remove stock from batch).
      for (const line of input.items) {
        const item = invoiceItemsById.get(line.invoiceItemId);
        if (item?.batch_id != null) {
          await insertRow(this.db, "stock_movements", {
            item_id: item.item_id,
            batch_id: item.batch_id,
            warehouse_id: invoice.warehouse_id ?? 1,
            movement_type: "PURCHASE_RETURN",
            quantity: -toQuantity(line.quantity),
            unit_cost: 0,
            reference_table: "purchase_returns",
            reference_id: returnId,
            movement_date: input.returnDate,
            notes: `Purchase return ${returnNumber}`,
            created_by: input.createdBy ?? null,
          });
        }
      }

      // A purchase return: inventory is credited (goods back in stock), and the
      // offset is A/P for CREDIT purchases, or the original cash/bank account
      // for CASH/BANK purchases (a refund, not an A/P credit).
      const journalLines: JournalLineInput[] = [];
      for (const [inventoryId, amount] of inventoryDebits) {
        journalLines.push({ accountId: inventoryId, credit: amount, description: "Return to supplier" });
      }
      if (isCredit) {
        journalLines.push({
          accountId: apId,
          debit: netTotal,
          partyId: invoice.supplier_id,
          description: `Purchase return ${returnNumber}`,
        });
      } else {
        journalLines.push({
          accountId: refundAccountId,
          debit: netTotal,
          partyId: null,
          description: `Refund for purchase return ${returnNumber}`,
        });
      }

      const journalEntryId = await this.accounting.postJournalEntry({
        voucherType: "PURCHASE_RETURN",
        voucherNumber: returnNumber,
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

  /** Edit a sales return in place: reverse the old one, re-post with its number. */
  async updateSalesReturn(id: number, input: CreateSalesReturnInput): Promise<ReturnResult> {
    const existing = await this.returns.findSalesReturnById(id);
    if (!existing) throw new NotFoundError(`Sales return ${id} not found.`);

    return this.db.transaction(async () => {
      await this.clearSalesReturn(id);
      const result = await this.createSalesReturn({
        ...input,
        returnNumber: String(existing.return_number),
        companyId: input.companyId ?? Number(existing.company_id),
      });
      await this.audit.record({
        userId: input.createdBy ?? null,
        action: "UPDATE",
        table: "sales_returns",
        entityId: result.id,
        details: { before: existing, after: input },
      });
      return result;
    });
  }

  /** Delete a sales return: pull the returned stock back out and remove the journal. */
  async deleteSalesReturn(id: number, userId: number | null = null): Promise<void> {
    const existing = await this.returns.findSalesReturnById(id);
    if (!existing) throw new NotFoundError(`Sales return ${id} not found.`);
    const items = await this.returns.listSalesReturnItems(id);

    await this.db.transaction(async () => {
      await this.clearSalesReturn(id);
      await this.audit.record({
        userId,
        action: "DELETE",
        table: "sales_returns",
        entityId: id,
        details: {
          returnNumber: existing.return_number,
          input: {
            invoiceId: existing.invoice_id,
            returnDate: existing.return_date,
            notes: existing.notes,
            returnNumber: existing.return_number,
            items: items.map((item) => ({
              invoiceItemId: item.invoice_item_id,
              quantity: item.quantity,
            })),
          },
        },
      });
    });
  }

  /** Edit a purchase return in place. */
  async updatePurchaseReturn(
    id: number,
    input: CreatePurchaseReturnInput,
  ): Promise<ReturnResult> {
    const existing = await this.returns.findPurchaseReturnById(id);
    if (!existing) throw new NotFoundError(`Purchase return ${id} not found.`);

    return this.db.transaction(async () => {
      await this.clearPurchaseReturn(id);
      const result = await this.createPurchaseReturn({
        ...input,
        returnNumber: String(existing.return_number),
        companyId: input.companyId ?? Number(existing.company_id),
      });
      await this.audit.record({
        userId: input.createdBy ?? null,
        action: "UPDATE",
        table: "purchase_returns",
        entityId: result.id,
        details: { before: existing, after: input },
      });
      return result;
    });
  }

  /** Delete a purchase return: put the stock back and remove the journal. */
  async deletePurchaseReturn(id: number, userId: number | null = null): Promise<void> {
    const existing = await this.returns.findPurchaseReturnById(id);
    if (!existing) throw new NotFoundError(`Purchase return ${id} not found.`);
    const items = await this.returns.listPurchaseReturnItems(id);

    await this.db.transaction(async () => {
      await this.clearPurchaseReturn(id);
      await this.audit.record({
        userId,
        action: "DELETE",
        table: "purchase_returns",
        entityId: id,
        details: {
          returnNumber: existing.return_number,
          input: {
            invoiceId: existing.invoice_id,
            returnDate: existing.return_date,
            notes: existing.notes,
            returnNumber: existing.return_number,
            items: items.map((item) => ({
              invoiceItemId: item.invoice_item_id,
              quantity: item.quantity,
            })),
          },
        },
      });
    });
  }

  /** Reverse a return's stock movements, journal entry and rows. */
  private async clearSalesReturn(id: number): Promise<void> {
    await this.reverseStockMovements("sales_returns", id);
    await deleteJournalBySource(this.db, "sales_returns", id);
    await this.returns.deleteSalesReturn(id);
  }

  private async clearPurchaseReturn(id: number): Promise<void> {
    await this.reverseStockMovements("purchase_returns", id);
    await deleteJournalBySource(this.db, "purchase_returns", id);
    await this.returns.deletePurchaseReturn(id);
  }

  /**
   * Negate every stock movement the return wrote: a sales return put quantity
   * back on the batch (delete takes it out), a purchase return took it off
   * (delete puts it back).
   */
  private async reverseStockMovements(referenceTable: string, referenceId: number): Promise<void> {
    const movements = await this.db.all<{ id: number; batch_id: number | null; quantity: number }>(
      `SELECT id, batch_id, quantity FROM stock_movements
        WHERE reference_table = ? AND reference_id = ?`,
      [referenceTable, referenceId],
    );
    for (const movement of movements) {
      if (movement.batch_id != null) {
        await this.batches.adjustQuantity(movement.batch_id, -Number(movement.quantity));
      }
    }
    await this.db.run("DELETE FROM stock_movements WHERE reference_table = ? AND reference_id = ?", [
      referenceTable,
      referenceId,
    ]);
  }

  /** COGS account for an item type, falling back to 5000 when it is not seeded. */
  private async cogsAccountId(
    resolver: SystemAccountResolver,
    itemType: ItemType,
  ): Promise<number> {
    try {
      return await resolver.idFor(COGS_ACCOUNT_BY_TYPE[itemType]);
    } catch {
      return resolver.idFor(SystemAccountCodes.COST_OF_GOODS_SOLD);
    }
  }

  /** Resolve a purchase's bank account to its GL account id. */
  private async resolveBankAccount(bankAccountId: number | null): Promise<number> {
    if (!bankAccountId) {
      throw new ValidationError("Purchase invoice references a missing bank account.");
    }
    const bank = await this.db.get<{ account_id: number }>(
      "SELECT account_id FROM bank_accounts WHERE id = ?",
      [bankAccountId],
    );
    if (!bank) throw new ValidationError(`Bank account ${bankAccountId} not found.`);
    return bank.account_id;
  }
}
