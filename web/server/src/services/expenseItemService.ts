/**
 * Recurring expense items and the "Pay Items" bulk payment, ported from
 * services/expense_item_service.py.
 *
 * Each selected item is paid as its own expense voucher (Dr category expense
 * account, Cr cash/bank) — identical accounting to a normal expense, because
 * ExpenseService.createExpense already resolves the category account with the
 * 6000 fallback. The Python version hand-rolled one batched transaction; here
 * the calls are wrapped in a single outer transaction so they commit atomically.
 */
import type { SqlDatabase } from "../db/types.js";
import { ConflictError, NotFoundError, ValidationError } from "../domain/errors.js";
import { ExpenseItemRepository, type ExpenseItemRow } from "../repositories/expenseItemRepository.js";
import { ExpenseRepository } from "../repositories/expenseRepository.js";
import { ExpenseService, type ExpensePaymentMethod } from "./expenseService.js";

export interface CreateExpenseItemInput {
  categoryId: number;
  name: string;
  amount?: number | null;
}

export interface UpdateExpenseItemInput {
  name?: string | null;
  amount?: number | null;
}

export interface PayItemSelection {
  itemId: number;
  amount: number;
  description?: string | null;
}

export interface PayItemsInput {
  categoryId: number;
  selections: readonly PayItemSelection[];
  paymentMethod: ExpensePaymentMethod;
  expenseDate: string;
  createdBy?: number | null;
}

export interface PayItemsResult {
  voucherNumbers: string[];
  totalPaid: number;
}

function nowStamp(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

export class ExpenseItemService {
  private readonly items: ExpenseItemRepository;
  private readonly categories: ExpenseRepository;
  private readonly expenses: ExpenseService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.items = new ExpenseItemRepository(db);
    this.categories = new ExpenseRepository(db);
    this.expenses = new ExpenseService(db, companyId);
  }

  async list(opts: { categoryId?: number; activeOnly?: boolean } = {}): Promise<ExpenseItemRow[]> {
    return this.items.list(this.companyId, opts);
  }

  async get(id: number): Promise<ExpenseItemRow> {
    return this.items.requireById(id);
  }

  async create(input: CreateExpenseItemInput): Promise<ExpenseItemRow> {
    const name = (input.name ?? "").trim();
    if (!name) throw new ValidationError("Item name is required.");
    if (input.amount != null && input.amount < 0) {
      throw new ValidationError("Amount cannot be negative.");
    }
    const category = await this.categories.findCategoryById(input.categoryId);
    if (!category || category.company_id !== this.companyId) {
      throw new ValidationError("Expense category does not exist.");
    }
    if (await this.items.findByName(input.categoryId, name, this.companyId)) {
      throw new ConflictError(`Item '${name}' already exists in this category.`);
    }
    const id = await this.items.insert({
      company_id: this.companyId,
      category_id: input.categoryId,
      name,
      amount: input.amount ?? null,
      is_active: 1,
    });
    return this.items.requireById(id);
  }

  async update(id: number, input: UpdateExpenseItemInput): Promise<ExpenseItemRow> {
    await this.items.requireById(id);
    const data: Record<string, string | number | null> = {};
    if (input.name != null) {
      const name = input.name.trim();
      if (!name) throw new ValidationError("Item name is required.");
      data.name = name;
    }
    if (input.amount != null) {
      if (input.amount < 0) throw new ValidationError("Amount cannot be negative.");
      data.amount = input.amount;
    }
    if (Object.keys(data).length === 0) return this.items.requireById(id);
    data.updated_at = nowStamp();
    await this.items.update(id, data);
    return this.items.requireById(id);
  }

  async deactivate(id: number): Promise<void> {
    const item = await this.items.findById(id);
    if (!item) throw new NotFoundError("Expense item not found.");
    await this.items.deactivate(id);
  }

  /** Pay the selected items, one expense voucher each. */
  async payItems(input: PayItemsInput): Promise<PayItemsResult> {
    if (!["CASH", "BANK", "CHEQUE"].includes(input.paymentMethod)) {
      throw new ValidationError("Invalid payment method.");
    }

    if (input.selections.length === 0) {
      throw new ValidationError("No items selected to pay.");
    }
    const valid = input.selections.filter((selection) => Number(selection.amount) > 0);
    // BANK and CHEQUE both settle from the bank account (1010), as in Python.
    if (valid.length === 0) {
      throw new ValidationError("No valid amounts to pay (all selected amounts are zero).");
    }

    const category = await this.categories.findCategoryById(input.categoryId);
    if (!category) throw new ValidationError("Expense category does not exist.");
    if (!category.is_active) throw new ValidationError("Category is not active.");

    const voucherNumbers: string[] = [];
    let totalPaid = 0;

    await this.db.transaction(async () => {
      for (const selection of valid) {
        const item = await this.items.requireById(selection.itemId);
        if (item.category_id !== input.categoryId) {
          throw new ValidationError(
            `Item '${item.name}' does not belong to the selected category.`,
          );
        }
        const description = (selection.description ?? "").trim() || item.name;
        const result = await this.expenses.createExpense({
          categoryId: input.categoryId,
          expenseDate: input.expenseDate,
          amount: selection.amount,
          paymentMethod: input.paymentMethod,
          description,
          createdBy: input.createdBy ?? null,
        });
        voucherNumbers.push(result.voucherNumber);
        totalPaid += Number(selection.amount);
        await this.items.update(item.id, {
          amount: Number(selection.amount),
          updated_at: nowStamp(),
        });
      }
    });

    return { voucherNumbers, totalPaid };
  }
}
