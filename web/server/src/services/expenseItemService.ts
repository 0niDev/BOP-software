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
import {
  ExpenseItemRepository,
  type ExpenseFrequency,
  type ExpenseItemRow,
} from "../repositories/expenseItemRepository.js";
import { ExpenseRepository } from "../repositories/expenseRepository.js";
import { ExpenseService, type ExpensePaymentMethod } from "./expenseService.js";

const FREQUENCIES: readonly ExpenseFrequency[] = ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"];

export interface CreateExpenseItemInput {
  categoryId: number;
  name: string;
  amount?: number | null;
  frequency?: ExpenseFrequency | null;
  nextRunDate?: string | null;
}

export interface UpdateExpenseItemInput {
  name?: string | null;
  amount?: number | null;
  frequency?: ExpenseFrequency | null;
  nextRunDate?: string | null;
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
  /** Record unpaid bills on Accounts Payable instead of paying now. */
  payLater?: boolean;
  dueDate?: string | null;
  bankAccountId?: number | null;
  createdBy?: number | null;
}

export interface PayItemsResult {
  voucherNumbers: string[];
  totalPaid: number;
}

function nowStamp(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

/** A recurring item needs a frequency, a first run date and a fixed amount. */
function checkSchedule(
  frequency: ExpenseFrequency | null,
  nextRunDate: string | null,
  amount: number | null,
): void {
  if (!frequency) return;
  if (!FREQUENCIES.includes(frequency)) throw new ValidationError("Invalid frequency.");
  if (!nextRunDate) {
    throw new ValidationError("A next run date is required for recurring items.");
  }
  if (amount == null || amount <= 0) {
    throw new ValidationError("Recurring items need a positive amount.");
  }
}

/** Move an ISO date forward by `count` recurrence intervals, clamping short months. */
function advanceDate(isoDate: string, frequency: ExpenseFrequency, count = 1): string {
  const [year, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  if (frequency === "WEEKLY") {
    return new Date(Date.UTC(year, month - 1, day + 7 * count)).toISOString().slice(0, 10);
  }
  const per = frequency === "MONTHLY" ? 1 : frequency === "QUARTERLY" ? 3 : 12;
  const shifted = new Date(Date.UTC(year, month - 1 + per * count, 1));
  const targetYear = shifted.getUTCFullYear();
  const targetMonth = shifted.getUTCMonth() + 1;
  // Day 0 of the following month is the last day of the target month (Feb 29 -> Feb 28).
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
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
    const frequency = input.frequency ?? null;
    const nextRunDate = input.nextRunDate ?? null;
    checkSchedule(frequency, nextRunDate, input.amount ?? null);
    const id = await this.items.insert({
      company_id: this.companyId,
      category_id: input.categoryId,
      name,
      amount: input.amount ?? null,
      frequency,
      next_run_date: frequency ? nextRunDate : null,
      is_active: 1,
    });
    return this.items.requireById(id);
  }

  async update(id: number, input: UpdateExpenseItemInput): Promise<ExpenseItemRow> {
    const existing = await this.items.requireById(id);
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
    if (input.frequency !== undefined) data.frequency = input.frequency;
    if (input.nextRunDate !== undefined) data.next_run_date = input.nextRunDate;

    const frequency =
      input.frequency !== undefined ? input.frequency : existing.frequency;
    const nextRunDate =
      input.nextRunDate !== undefined ? input.nextRunDate : existing.next_run_date;
    checkSchedule(
      frequency,
      nextRunDate,
      input.amount !== undefined ? input.amount : existing.amount,
    );
    // Turning recurrence off also clears the schedule.
    if (!frequency) {
      data.next_run_date = null;
    }

    if (Object.keys(data).length === 0) return existing;
    data.updated_at = nowStamp();
    await this.items.update(id, data);
    return this.items.requireById(id);
  }

  async deactivate(id: number): Promise<void> {
    const item = await this.items.findById(id);
    if (!item) throw new NotFoundError("Expense item not found.");
    await this.items.deactivate(id);
  }

  /**
   * Generate every recurring bill that is due on or before `onDate` as an
   * unpaid (pay-later) expense, then advance the item's next run date. Idempotent
   * by construction: the insert and the date advance commit in one transaction,
   * and the catch-up loop runs on read (GET /api/expenses), so a server that was
   * off simply catches up on the next request — no scheduler needed.
   */
  async generateDue(onDate = new Date().toISOString().slice(0, 10)): Promise<{ voucherNumbers: string[] }> {
    const due = await this.items.listDue(this.companyId, onDate);
    const voucherNumbers: string[] = [];

    for (const item of due) {
      if (!item.frequency || !item.next_run_date) continue;
      const amount = Number(item.amount ?? 0);
      // No fixed amount => still a manual "Pay items" entry, never auto-generated.
      if (amount <= 0) continue;

      await this.db.transaction(async () => {
        const anchor = item.next_run_date as string;
        const frequency = item.frequency as ExpenseFrequency;
        let run = anchor;
        let occurrence = 0;
        while (run <= onDate) {
          const result = await this.expenses.createExpense({
            categoryId: item.category_id,
            expenseDate: run,
            amount,
            paymentMethod: "BANK",
            payLater: true,
            dueDate: run,
            description: item.name,
          });
          voucherNumbers.push(result.voucherNumber);
          // Advance from the anchored first run date, not the clamped previous
          // occurrence, so a bill on the 31st returns to the 31st after February.
          occurrence += 1;
          run = advanceDate(anchor, frequency, occurrence);
        }
        await this.items.update(item.id, { next_run_date: run, updated_at: nowStamp() });
      });
    }

    return { voucherNumbers };
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
          payLater: input.payLater === true,
          dueDate: input.payLater ? input.dueDate ?? null : null,
          bankAccountId: input.payLater ? null : input.bankAccountId ?? null,
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
