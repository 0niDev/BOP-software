/**
 * Sales and purchase returns.
 *
 * A return is a standalone party document: a party gives goods back (sales) or
 * receives goods back (purchase). It is not tied to an invoice; the form takes
 * the party, the item, the quantity and the unit cost directly.
 *
 * Sales return:     Dr Sales Returns (4100)     Cr AR            (party credit)
 *                   Dr Inventory (by type)      Cr COGS (by type) (stock restored)
 *                   Dr Wastage Expense (5200)   Cr COGS (by type) (goods scrapped)
 * Purchase return:  Dr Accounts Payable (2000)  Cr Inventory (by type)
 */
import type { SqlDatabase } from "../db/types.js";
import { SystemAccountCodes, type ItemType } from "../domain/enums.js";
import {
  ConflictError,
  InsufficientStockError,
  NotFoundError,
  ValidationError,
} from "../domain/errors.js";
import { Decimal, dec, round2, toQuantity, toStorage } from "../domain/money.js";
import { ItemRepository, type ItemRow } from "../repositories/itemRepository.js";
import { JournalRepository } from "../repositories/journalRepository.js";
import { PartyRepository } from "../repositories/partyRepository.js";
import { ReturnsRepository } from "../repositories/returnsRepository.js";
import { StockBatchRepository } from "../repositories/stockBatchRepository.js";
import { SystemAccountResolver } from "../repositories/systemAccounts.js";
import { AccountingService, type JournalLineInput } from "./accountingService.js";
import { AuditService } from "./auditService.js";
import { deleteJournalBySource } from "./journalEffects.js";
import { insertRow } from "../repositories/base.js";

export type ReturnDestination = "INVENTORY" | "WASTE";

export interface ReturnLineInput {
  itemId: number;
  quantity: number | string;
  unitCost: number | string;
  /** Sales returns only: restock the item or scrap it. Defaults to INVENTORY. */
  destination?: ReturnDestination;
}

export interface CreateSalesReturnInput {
  partyId: number;
  returnDate: string;
  items: readonly ReturnLineInput[];
  returnNumber?: string | null;
  notes?: string | null;
  warehouseId?: number;
  companyId?: number;
  createdBy?: number | null;
}

export interface CreatePurchaseReturnInput {
  partyId: number;
  returnDate: string;
  items: readonly ReturnLineInput[];
  returnNumber?: string | null;
  notes?: string | null;
  warehouseId?: number;
  companyId?: number;
  createdBy?: number | null;
}

export interface ReturnResult {
  id: number;
  returnNumber: string;
  totalAmount: number;
  journalEntryId: number;
}

const INVENTORY_ACCOUNT_BY_TYPE: Record<ItemType, string> = {
  RAW_MATERIAL: SystemAccountCodes.INVENTORY_RAW_MATERIALS,
  PACKING_MATERIAL: SystemAccountCodes.INVENTORY_PACKING_MATERIALS,
  FINISHED_GOOD: SystemAccountCodes.INVENTORY_FINISHED_GOODS,
};

interface PreparedLine {
  item: ItemRow;
  quantity: Decimal;
  unitCost: Decimal;
  amount: Decimal;
  destination: ReturnDestination;
}

export class ReturnsService {
  private readonly items: ItemRepository;
  private readonly parties: PartyRepository;
  private readonly batches: StockBatchRepository;
  private readonly returns: ReturnsRepository;
  private readonly journal: JournalRepository;
  private readonly accounting: AccountingService;
  private readonly audit: AuditService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.items = new ItemRepository(db);
    this.parties = new PartyRepository(db);
    this.batches = new StockBatchRepository(db);
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
    const warehouseId = input.warehouseId ?? 1;
    const party = await this.parties.requireById(input.partyId);
    if (!party.is_active) throw new ValidationError(`Party '${party.name}' is not active.`);
    if (party.party_type !== "CUSTOMER" && party.party_type !== "BOTH") {
      throw new ValidationError(`Party '${party.name}' is not a customer.`);
    }
    if (!input.items?.length) throw new ValidationError("A return needs at least one line.");

    const returnNumber = await this.resolveReturnNumber(
      input.returnNumber,
      companyId,
      "SALES_RETURN",
    );

    return this.db.transaction(async () => {
      const resolver = new SystemAccountResolver(this.db, companyId);
      const prepared = await this.prepareLines(input.items);
      let netTotal = new Decimal(0);
      let wasteTotal = new Decimal(0);
      const inventoryDebits = new Map<number, Decimal>();

      for (const line of prepared) {
        netTotal = netTotal.plus(line.amount);
        if (line.destination === "WASTE") {
          wasteTotal = wasteTotal.plus(line.amount);
        } else {
          const inventoryId = await resolver.idFor(
            INVENTORY_ACCOUNT_BY_TYPE[line.item.item_type],
          );
          inventoryDebits.set(
            inventoryId,
            (inventoryDebits.get(inventoryId) ?? new Decimal(0)).plus(line.amount),
          );
        }
      }

      const returnId = await this.returns.insertSalesReturn({
        company_id: companyId,
        return_number: returnNumber,
        party_id: party.id,
        return_date: input.returnDate,
        total_amount: toStorage(netTotal),
        notes: input.notes ?? null,
        created_by: input.createdBy ?? null,
      });

      for (const [index, line] of prepared.entries()) {
        let batchId: number | null = null;
        if (line.destination === "INVENTORY") {
          batchId = await this.restoreBatch(
            line,
            `RET-${returnNumber}-${index + 1}`,
            warehouseId,
            input.returnDate,
          );
          await insertRow(this.db, "stock_movements", {
            item_id: line.item.id,
            batch_id: batchId,
            warehouse_id: warehouseId,
            movement_type: "SALE_RETURN",
            quantity: toQuantity(line.quantity),
            unit_cost: toStorage(line.unitCost),
            reference_table: "sales_returns",
            reference_id: returnId,
            movement_date: input.returnDate,
            notes: `Sales return ${returnNumber}`,
            created_by: input.createdBy ?? null,
          });
        }
        await this.returns.insertSalesReturnItem({
          return_id: returnId,
          item_id: line.item.id,
          batch_id: batchId,
          quantity: toQuantity(line.quantity),
          unit_cost: toStorage(line.unitCost),
          destination: line.destination,
          line_total: toStorage(line.amount),
        });
      }

      const journalLines: JournalLineInput[] = [
        {
          accountId: await resolver.idFor(SystemAccountCodes.SALES_RETURNS),
          debit: netTotal,
          description: `Sales return ${returnNumber}`,
        },
        {
          accountId: await resolver.idFor(SystemAccountCodes.ACCOUNTS_RECEIVABLE),
          credit: netTotal,
          partyId: party.id,
          description: `Sales return ${returnNumber}`,
        },
      ];
      for (const [inventoryId, amount] of inventoryDebits) {
        journalLines.push({ accountId: inventoryId, debit: amount, description: "Restore inventory" });
      }
      if (wasteTotal.greaterThan(0)) {
        journalLines.push({
          accountId: await resolver.idFor(SystemAccountCodes.MANUFACTURING_WASTAGE_EXPENSE),
          debit: wasteTotal,
          description: "Returned goods scrapped",
        });
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
    const warehouseId = input.warehouseId ?? 1;
    const party = await this.parties.requireById(input.partyId);
    if (!party.is_active) throw new ValidationError(`Party '${party.name}' is not active.`);
    if (party.party_type !== "SUPPLIER" && party.party_type !== "BOTH") {
      throw new ValidationError(`Party '${party.name}' is not a supplier.`);
    }
    if (!input.items?.length) throw new ValidationError("A return needs at least one line.");

    const returnNumber = await this.resolveReturnNumber(
      input.returnNumber,
      companyId,
      "PURCHASE_RETURN",
    );

    return this.db.transaction(async () => {
      const resolver = new SystemAccountResolver(this.db, companyId);
      const prepared = await this.prepareLines(input.items);
      let netTotal = new Decimal(0);
      const inventoryCredits = new Map<number, Decimal>();

      for (const line of prepared) {
        netTotal = netTotal.plus(line.amount);
        const inventoryId = await resolver.idFor(
          INVENTORY_ACCOUNT_BY_TYPE[line.item.item_type],
        );
        inventoryCredits.set(
          inventoryId,
          (inventoryCredits.get(inventoryId) ?? new Decimal(0)).plus(line.amount),
        );
      }

      const returnId = await this.returns.insertPurchaseReturn({
        company_id: companyId,
        return_number: returnNumber,
        party_id: party.id,
        return_date: input.returnDate,
        total_amount: toStorage(netTotal),
        notes: input.notes ?? null,
        created_by: input.createdBy ?? null,
      });

      for (const line of prepared) {
        await this.consumeStock(line, warehouseId, returnId, returnNumber, input);
        await this.returns.insertPurchaseReturnItem({
          return_id: returnId,
          item_id: line.item.id,
          batch_id: null,
          quantity: toQuantity(line.quantity),
          unit_cost: toStorage(line.unitCost),
          line_total: toStorage(line.amount),
        });
      }

      const journalLines: JournalLineInput[] = [];
      for (const [inventoryId, amount] of inventoryCredits) {
        journalLines.push({ accountId: inventoryId, credit: amount, description: "Return to supplier" });
      }
      journalLines.push({
        accountId: await resolver.idFor(SystemAccountCodes.ACCOUNTS_PAYABLE),
        debit: netTotal,
        partyId: party.id,
        description: `Purchase return ${returnNumber}`,
      });

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

  /** Delete a sales return: remove its stock and journal. */
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
            partyId: existing.party_id,
            returnDate: existing.return_date,
            notes: existing.notes,
            returnNumber: existing.return_number,
            items: items.map((item) => ({
              itemId: item.item_id,
              quantity: item.quantity,
              unitCost: item.unit_cost,
              destination: item.destination,
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
            partyId: existing.party_id,
            returnDate: existing.return_date,
            notes: existing.notes,
            returnNumber: existing.return_number,
            items: items.map((item) => ({
              itemId: item.item_id,
              quantity: item.quantity,
              unitCost: item.unit_cost,
            })),
          },
        },
      });
    });
  }

  /** Validate and price every line, loading each item once. */
  private async prepareLines(lines: readonly ReturnLineInput[]): Promise<PreparedLine[]> {
    const prepared: PreparedLine[] = [];
    for (const line of lines) {
      const item = await this.items.requireById(line.itemId);
      if (!item.is_active) {
        throw new ValidationError(`Item '${item.item_name}' is not active.`);
      }
      const quantity = dec(line.quantity);
      if (quantity.lessThanOrEqualTo(0)) {
        throw new ValidationError(`Quantity for '${item.item_name}' must be greater than zero.`);
      }
      const unitCost = dec(line.unitCost);
      if (unitCost.lessThan(0)) {
        throw new ValidationError(`Unit cost for '${item.item_name}' cannot be negative.`);
      }
      const destination = line.destination ?? "INVENTORY";
      if (destination !== "INVENTORY" && destination !== "WASTE") {
        throw new ValidationError(`Invalid return destination '${destination}'.`);
      }
      prepared.push({
        item,
        quantity,
        unitCost,
        amount: round2(quantity.times(unitCost)),
        destination,
      });
    }
    return prepared;
  }

  /**
   * Add returned goods back to stock. A return batch is reused on edit (same
   * number) so deleting and re-creating a return cannot duplicate a batch.
   */
  private async restoreBatch(
    line: PreparedLine,
    batchNumber: string,
    warehouseId: number,
    returnDate: string,
  ): Promise<number> {
    const existing = await this.batches.findByNumber(line.item.id, warehouseId, batchNumber);
    if (existing) {
      await this.batches.addToBatch(existing.id, toQuantity(line.quantity), {
        purchasePrice: toStorage(line.unitCost),
        rawUnitCost: 0,
        packingUnitCost: 0,
      });
      return existing.id;
    }
    return this.batches.insert({
      item_id: line.item.id,
      warehouse_id: warehouseId,
      batch_number: batchNumber,
      purchase_price: toStorage(line.unitCost),
      raw_unit_cost: 0,
      packing_unit_cost: 0,
      quantity_in_stock: toQuantity(line.quantity),
      received_date: returnDate,
      is_active: 1,
    });
  }

  /** Take a purchase return out of FIFO batches and record each movement. */
  private async consumeStock(
    line: PreparedLine,
    warehouseId: number,
    returnId: number,
    returnNumber: string,
    input: CreatePurchaseReturnInput,
  ): Promise<void> {
    const batches = await this.batches.listAvailableFifo(line.item.id, warehouseId);
    const available = batches.reduce((sum, batch) => sum.plus(dec(batch.quantity_in_stock)), new Decimal(0));
    if (available.lessThan(line.quantity)) {
      throw new InsufficientStockError(
        `Not enough stock for '${line.item.item_name}': need ${line.quantity.toString()}, have ${available.toString()}.`,
      );
    }
    let remaining = line.quantity;
    for (const batch of batches) {
      if (remaining.lessThanOrEqualTo(0)) break;
      const take = Decimal.min(remaining, dec(batch.quantity_in_stock));
      if (take.lessThanOrEqualTo(0)) continue;
      await this.batches.adjustQuantity(batch.id, -toQuantity(take));
      await insertRow(this.db, "stock_movements", {
        item_id: line.item.id,
        batch_id: batch.id,
        warehouse_id: warehouseId,
        movement_type: "PURCHASE_RETURN",
        quantity: -toQuantity(take),
        unit_cost: toStorage(line.unitCost),
        reference_table: "purchase_returns",
        reference_id: returnId,
        movement_date: input.returnDate,
        notes: `Purchase return ${returnNumber}`,
        created_by: input.createdBy ?? null,
      });
      remaining = remaining.minus(take);
    }
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

  /** Negate every stock movement the return wrote. */
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

  /** Allocate the next document number, or reject a duplicate manual one. */
  private async resolveReturnNumber(
    requested: string | null | undefined,
    companyId: number,
    documentType: "SALES_RETURN" | "PURCHASE_RETURN",
  ): Promise<string> {
    const trimmed = requested?.trim() || "";
    if (trimmed) {
      const exists =
        documentType === "SALES_RETURN"
          ? await this.returns.salesReturnNumberExists(trimmed, companyId)
          : await this.returns.purchaseReturnNumberExists(trimmed, companyId);
      if (exists) throw new ConflictError(`Return number '${trimmed}' already exists.`);
      return trimmed;
    }
    return this.journal.nextVoucherNumber(companyId, documentType);
  }
}
