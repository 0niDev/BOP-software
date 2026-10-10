/**
 * Business rules for Items, ported from services/item_service.py:
 * validation, auto-generated item codes (ITEM-00001) allocated inside the same
 * transaction as the insert so a failure leaves no gap in the sequence.
 */
import type { SqlDatabase } from "../db/types.js";
import { ConflictError, NotFoundError, ValidationError } from "../domain/errors.js";
import { SystemAccountCodes, type ItemType } from "../domain/enums.js";
import { ItemRepository, type ItemRow } from "../repositories/itemRepository.js";
import { JournalRepository } from "../repositories/journalRepository.js";
import { StockBatchRepository } from "../repositories/stockBatchRepository.js";
import { SystemAccountResolver } from "../repositories/systemAccounts.js";
import { TaxRateRepository, type TaxRateRow } from "../repositories/taxRateRepository.js";
import { AccountingService } from "./accountingService.js";

/** Inventory account per item type (mirrors accounting/system_accounts.py). */
const INVENTORY_ACCOUNT_BY_TYPE: Record<string, string> = {
  RAW_MATERIAL: "1200",
  PACKING_MATERIAL: "1210",
  FINISHED_GOOD: "1220",
};

export interface AddOpeningStockInput {
  itemId: number;
  quantity: number;
  unitCost?: number;
  batchNumber?: string | null;
  expiryDate?: string | null;
  partyId?: number | null;
  warehouseId?: number;
}

export interface OpeningStockResult {
  batchId: number;
  batchNumber: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  journalEntryId: number | null;
}

export const ITEM_UNITS = [
  "TABLET",
  "CAPSULE",
  "ML",
  "GRAM",
  "KG",
  "UNIT",
  "VIAL",
  "AMPOULE",
] as const;

export const ITEM_TYPES: readonly ItemType[] = [
  "RAW_MATERIAL",
  "PACKING_MATERIAL",
  "FINISHED_GOOD",
];

export interface CreateItemInput {
  itemName: string;
  unit?: string;
  itemCode?: string | null;
  notes?: string | null;
  purchasePrice?: number;
  sellingPrice?: number;
  minimumStock?: number;
  maximumStock?: number;
  taxRateId?: number | null;
  itemType?: ItemType;
  categoryId?: number | null;
}

export interface UpdateItemInput {
  itemName: string;
  notes?: string | null;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  minimumStock: number;
  maximumStock: number;
  taxRateId?: number | null;
  itemType: ItemType;
  categoryId?: number | null;
  isActive?: boolean;
}

interface ItemFields {
  itemName: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  minimumStock: number;
  maximumStock: number;
  itemType: string;
}

function validateCommon(fields: ItemFields): void {
  if (!fields.itemName.trim()) throw new ValidationError("Item name is required.");
  if (fields.purchasePrice < 0) throw new ValidationError("Purchase price cannot be negative.");
  if (fields.sellingPrice < 0) throw new ValidationError("Selling price cannot be negative.");
  if (fields.minimumStock < 0) throw new ValidationError("Minimum stock cannot be negative.");
  if (fields.maximumStock < 0) throw new ValidationError("Maximum stock cannot be negative.");
  if (fields.maximumStock < fields.minimumStock) {
    throw new ValidationError("Maximum stock must be >= minimum stock.");
  }
  if (!(ITEM_UNITS as readonly string[]).includes(fields.unit)) {
    throw new ValidationError(
      `Invalid unit: ${fields.unit}. Use TABLET, CAPSULE, ML, GRAM, KG, UNIT, VIAL or AMPOULE.`,
    );
  }
  if (!(ITEM_TYPES as readonly string[]).includes(fields.itemType)) {
    throw new ValidationError(`Invalid item type: ${fields.itemType}`);
  }
}

export class ItemService {
  private readonly items: ItemRepository;
  private readonly taxes: TaxRateRepository;
  private readonly journal: JournalRepository;

  private readonly batches: StockBatchRepository;
  private readonly accounts: SystemAccountResolver;
  private readonly accounting: AccountingService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
    private readonly warehouseId = 1,
  ) {
    this.items = new ItemRepository(db);
    this.taxes = new TaxRateRepository(db);
    this.journal = new JournalRepository(db);
    this.batches = new StockBatchRepository(db);
    this.accounts = new SystemAccountResolver(db, companyId);
    this.accounting = new AccountingService(db, companyId);
  }

  async list(
    opts: { activeOnly?: boolean; search?: string; itemType?: ItemType } = {},
  ): Promise<ItemRow[]> {
    return this.items.list(this.companyId, opts);
  }

  async get(id: number): Promise<ItemRow> {
    return this.items.requireById(id);
  }

  async taxRates(): Promise<TaxRateRow[]> {
    return this.taxes.list(this.companyId);
  }

  async create(input: CreateItemInput): Promise<ItemRow> {
    const unit = input.unit ?? "UNIT";
    const itemType = input.itemType ?? "FINISHED_GOOD";
    const purchasePrice = input.purchasePrice ?? 0;
    const sellingPrice = input.sellingPrice ?? 0;
    const minimumStock = input.minimumStock ?? 0;
    const maximumStock = input.maximumStock ?? 0;

    validateCommon({
      itemName: input.itemName,
      unit,
      purchasePrice,
      sellingPrice,
      minimumStock,
      maximumStock,
      itemType,
    });

    let itemCode = input.itemCode?.trim() || null;
    if (itemCode !== null) {
      if (!itemCode) throw new ValidationError("Item code cannot be empty.");
      if (await this.items.findByCode(itemCode, this.companyId)) {
        throw new ValidationError(`Item code '${itemCode}' already exists.`);
      }
    }

    await this.validateTaxRate(input.taxRateId ?? null);

    const id = await this.db.transaction(async () => {
      // Code generation joins the transaction so the sequence rolls back with
      // the insert on failure -- no gaps (mirrors the Python service).
      if (itemCode === null) {
        itemCode = await this.journal.nextVoucherNumber(this.companyId, "ITEM");
      }
      return this.items.insert({
        company_id: this.companyId,
        item_code: itemCode as string,
        item_name: input.itemName.trim(),
        unit,
        item_type: itemType,
        purchase_price: purchasePrice,
        selling_price: sellingPrice,
        minimum_stock: minimumStock,
        maximum_stock: maximumStock,
        tax_rate_id: input.taxRateId ?? null,
        category_id: input.categoryId ?? null,
        notes: input.notes ?? null,
        is_active: 1,
      });
    });

    return this.items.requireById(id);
  }

  async update(id: number, input: UpdateItemInput): Promise<ItemRow> {
    await this.items.requireById(id);

    validateCommon({
      itemName: input.itemName,
      unit: input.unit,
      purchasePrice: input.purchasePrice,
      sellingPrice: input.sellingPrice,
      minimumStock: input.minimumStock,
      maximumStock: input.maximumStock,
      itemType: input.itemType,
    });

    await this.validateTaxRate(input.taxRateId ?? null);

    await this.items.update(id, {
      item_name: input.itemName.trim(),
      notes: input.notes ?? null,
      unit: input.unit,
      purchase_price: input.purchasePrice,
      selling_price: input.sellingPrice,
      minimum_stock: input.minimumStock,
      maximum_stock: input.maximumStock,
      tax_rate_id: input.taxRateId ?? null,
      item_type: input.itemType,
      category_id: input.categoryId ?? null,
      is_active: input.isActive === false ? 0 : 1,
    });
    return this.items.requireById(id);
  }

  async deactivate(id: number): Promise<void> {
    const item = await this.items.findById(id);
    if (!item) throw new NotFoundError("Item not found.");
    await this.items.deactivate(id);
  }

  /**
   * Opening stock for an item, ported from ItemService.add_opening_stock:
   * creates a batch plus an OPENING stock movement, and -- when a supplier is
   * given -- posts an OPENING journal entry debiting the item's inventory
   * account (1200/1210/1220 by item type) and crediting Accounts Payable (2000)
   * for the party, so the books stay balanced.
   */
  async addOpeningStock(input: AddOpeningStockInput): Promise<OpeningStockResult> {
    const quantity = input.quantity;
    const unitCost = input.unitCost ?? 0;
    if (quantity <= 0) throw new ValidationError("Quantity must be greater than 0.");
    if (unitCost < 0) throw new ValidationError("Unit cost cannot be negative.");

    const item = await this.items.findById(input.itemId);
    if (!item) throw new ValidationError("Item does not exist.");

    const warehouseId = input.warehouseId ?? this.warehouseId;
    const totalValue = quantity * unitCost;
    const batchNumber =
      input.batchNumber?.trim() ||
      `OPEN-${item.item_code}-${new Date().toISOString().replace(/\D/g, "").slice(0, 17)}`;

    return this.db.transaction(async () => {
      if (await this.batches.findByNumber(item.id, warehouseId, batchNumber)) {
        throw new ConflictError(
          `Batch '${batchNumber}' already exists for this item in this warehouse.`,
        );
      }

      const batchId = await this.batches.insert({
        item_id: item.id,
        warehouse_id: warehouseId,
        batch_number: batchNumber,
        manufacturing_date: new Date().toISOString().slice(0, 10),
        expiry_date: input.expiryDate ?? null,
        purchase_price: unitCost,
        raw_unit_cost: unitCost,
        packing_unit_cost: 0,
        quantity_in_stock: quantity,
        received_date: new Date().toISOString().slice(0, 10),
        is_active: 1,
      });

      await this.db.run(
        `INSERT INTO stock_movements
           (item_id, batch_id, warehouse_id, movement_type, quantity, unit_cost, movement_date, notes)
         VALUES (?, ?, ?, 'OPENING', ?, ?, datetime('now'), ?)`,
        [item.id, batchId, warehouseId, quantity, unitCost, `Opening stock - ${item.item_name}`],
      );

      let journalEntryId: number | null = null;
      if (input.partyId != null && totalValue > 0) {
        const inventoryCode = INVENTORY_ACCOUNT_BY_TYPE[item.item_type] ?? "1200";
        const inventoryAccount = await this.accounts.idFor(inventoryCode);
        const payableAccount = await this.accounts.idFor(SystemAccountCodes.ACCOUNTS_PAYABLE);
        journalEntryId = await this.accounting.postJournalEntry({
          voucherType: "OPENING",
          entryDate: new Date().toISOString().slice(0, 10),
          lines: [
            {
              accountId: inventoryAccount,
              debit: totalValue,
              description: `Opening stock - ${item.item_name}`,
            },
            {
              accountId: payableAccount,
              credit: totalValue,
              partyId: input.partyId,
              description: `Opening stock credit - ${item.item_name}`,
            },
          ],
          narration: `Opening stock for ${item.item_name}`,
          sourceTable: "stock_batches",
          sourceId: batchId,
          companyId: this.companyId,
        });
      }

      return { batchId, batchNumber, quantity, unitCost, totalValue, journalEntryId };
    });
  }

  private async validateTaxRate(taxRateId: number | null): Promise<void> {
    if (taxRateId == null) return;
    const taxRate = await this.taxes.findById(taxRateId);
    if (!taxRate) throw new ValidationError("Tax rate does not exist.");
    if (taxRate.company_id !== this.companyId) {
      throw new ValidationError("Tax rate belongs to different company.");
    }
    if (taxRate.tax_type !== "SALES_TAX") {
      throw new ValidationError("Tax rate must be sales tax type.");
    }
  }
}
