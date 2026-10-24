/**
 * Expense service. Port of services/expense_service.py.
 *
 * createExpense posts:  Dr expense account (category account, or 6000)
 *                       Cr cash (1000) / bank (1010)
 */
import type { SqlDatabase } from "../db/types.js";
import { SystemAccountCodes } from "../domain/enums.js";
import { ConflictError, NotFoundError, ValidationError } from "../domain/errors.js";
import { dec, round2, toStorage } from "../domain/money.js";
import { AccountRepository } from "../repositories/accountRepository.js";
import {
  ExpenseRepository,
  type ExpenseCategoryRow,
  type ExpenseListRow,
} from "../repositories/expenseRepository.js";
import { JournalRepository } from "../repositories/journalRepository.js";
import { SystemAccountResolver } from "../repositories/systemAccounts.js";
import { AccountingService } from "./accountingService.js";
import { AuditService } from "./auditService.js";
import { deleteJournalBySource } from "./journalEffects.js";

export type ExpensePaymentMethod = "CASH" | "BANK" | "CHEQUE";

export interface CreateExpenseInput {
  categoryId: number;
  expenseDate: string;
  amount: number | string;
  paymentMethod: ExpensePaymentMethod;
  /** Record as an unpaid bill (Dr expense / Cr Accounts Payable) instead of paying now. */
  payLater?: boolean;
  dueDate?: string | null;
  voucherNumber?: string | null;
  bankAccountId?: number | null;
  chequeId?: number | null;
  description?: string | null;
  companyId?: number;
  createdBy?: number | null;
}

export interface UpdateExpenseCategoryInput {
  name?: string;
  /** Ledger account for the category; `null` restores the 6000 fallback. */
  accountId?: number | null;
  isActive?: boolean;
}

export interface UpdateExpenseInput {
  categoryId: number;
  expenseDate: string;
  amount: number | string;
  paymentMethod: ExpensePaymentMethod;
  dueDate?: string | null;
  bankAccountId?: number | null;
  chequeId?: number | null;
  description?: string | null;
  companyId?: number;
  userId?: number | null;
}

export interface PayExpenseInput {
  paymentMethod: ExpensePaymentMethod;
  paymentDate?: string;
  bankAccountId?: number | null;
  chequeId?: number | null;
  companyId?: number;
  createdBy?: number | null;
}

export interface ExpenseResult {
  id: number;
  voucherNumber: string;
  journalEntryId: number;
}

export class ExpenseService {
  private readonly accounts: AccountRepository;
  private readonly expenses: ExpenseRepository;
  private readonly journal: JournalRepository;
  private readonly accounting: AccountingService;
  private readonly audit: AuditService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.accounts = new AccountRepository(db);
    this.expenses = new ExpenseRepository(db);
    this.journal = new JournalRepository(db);
    this.accounting = new AccountingService(db, companyId);
    this.audit = new AuditService(db);
  }

  async listCategories(): Promise<ExpenseCategoryRow[]> {
    return this.expenses.listCategories(this.companyId);
  }

  async createCategory(
    name: string,
    accountId?: number | null,
  ): Promise<{ id: number; name: string }> {
    const clean = name.trim();
    if (!clean) throw new ValidationError("Category name is required.");
    if (await this.expenses.categoryNameExists(clean, this.companyId)) {
      throw new ConflictError(`Category '${clean}' already exists.`);
    }
    if (accountId) {
      const account = await this.accounts.findById(accountId);
      if (!account) throw new NotFoundError(`Account ${accountId} not found.`);
      if (account.account_type !== "EXPENSE") {
        throw new ValidationError("Account must be of type EXPENSE.");
      }
    }
    const id = await this.expenses.insertCategory({
      company_id: this.companyId,
      name: clean,
      account_id: accountId ?? null,
      is_active: 1,
    });
    return { id, name: clean };
  }

  /**
   * Edit a category. Relinking it to another ledger account also re-posts the
   * journal entry of every expense already recorded in it, so the trial balance
   * reflects the new account immediately instead of only for future expenses.
   */
  async updateCategory(
    id: number,
    input: UpdateExpenseCategoryInput,
  ): Promise<{ category: ExpenseCategoryRow; reposted: number }> {
    const category = await this.expenses.findCategoryById(id);
    if (!category) throw new NotFoundError(`Expense category ${id} not found.`);

    const name = (input.name ?? category.name).trim();
    if (!name) throw new ValidationError("Category name is required.");
    if (name !== category.name && (await this.expenses.categoryNameExists(name, this.companyId))) {
      throw new ConflictError(`Category '${name}' already exists.`);
    }

    const accountId = input.accountId === undefined ? category.account_id : input.accountId;
    if (accountId != null) {
      const account = await this.accounts.findById(accountId);
      if (!account) throw new NotFoundError(`Account ${accountId} not found.`);
      if (account.account_type !== "EXPENSE") {
        throw new ValidationError("Account must be of type EXPENSE.");
      }
    }
    const isActive =
      input.isActive === undefined ? Boolean(category.is_active) : input.isActive;
    const accountChanged = accountId !== category.account_id;

    return this.db.transaction(async () => {
      await this.expenses.updateCategory(id, {
        name,
        account_id: accountId,
        is_active: isActive ? 1 : 0,
      });
      const reposted = accountChanged ? await this.repostCategoryExpenses(id, accountId, name) : 0;
      return { category: (await this.expenses.findCategoryById(id))!, reposted };
    });
  }

  private async repostCategoryExpenses(
    categoryId: number,
    accountId: number | null,
    categoryName: string,
  ): Promise<number> {
    const resolver = new SystemAccountResolver(this.db, this.companyId);
    const expenseAccountId = accountId ?? (await resolver.idFor("6000"));
    const rows = await this.expenses.listExpensesForCategory(this.companyId, categoryId);

    for (const expense of rows) {
      const paymentAccountId =
        expense.status === "UNPAID"
          ? await resolver.idFor(SystemAccountCodes.ACCOUNTS_PAYABLE)
          : expense.payment_method === "CASH"
            ? await resolver.idFor(SystemAccountCodes.CASH_IN_HAND)
            : await resolver.idFor(SystemAccountCodes.BANK_ACCOUNTS);

      await deleteJournalBySource(this.db, "expenses", expense.id);
      await this.accounting.postJournalEntry({
        voucherType: "JOURNAL",
        entryDate: expense.expense_date,
        lines: [
          {
            accountId: expenseAccountId,
            debit: expense.amount,
            description: expense.description ?? `Expense: ${categoryName}`,
          },
          {
            accountId: paymentAccountId,
            credit: expense.amount,
            description: `Payment for: ${categoryName}`,
          },
        ],
        sourceTable: "expenses",
        sourceId: expense.id,
        narration: `Expense voucher ${expense.voucher_number}: ${categoryName}`,
        companyId: this.companyId,
        createdBy: expense.created_by,
      });
    }
    return rows.length;
  }

  async listExpenses(): Promise<ExpenseListRow[]> {
    return this.expenses.listExpenses(this.companyId);
  }

  async createExpense(input: CreateExpenseInput): Promise<ExpenseResult> {
    const companyId = input.companyId ?? this.companyId;
    const amount = round2(input.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new ValidationError("Amount must be greater than 0.");
    }
    if (!["CASH", "BANK", "CHEQUE"].includes(input.paymentMethod)) {
      throw new ValidationError("Invalid payment method.");
    }
    if (!input.expenseDate) throw new ValidationError("Expense date is required.");

    const category = await this.expenses.findCategoryById(input.categoryId);
    if (!category) throw new NotFoundError(`Expense category ${input.categoryId} not found.`);
    if (!category.is_active) throw new ValidationError("Category is not active.");

    const resolver = new SystemAccountResolver(this.db, companyId);
    // Fall back to General & Administrative Expenses (6000) when the category
    // has no account linked, mirroring the Python service.
    const expenseAccountId = category.account_id ?? (await resolver.idFor("6000"));
    // Pay-later bills sit on Accounts Payable until payExpense() settles them.
    const payLater = input.payLater === true;
    const paymentAccountId = payLater
      ? await resolver.idFor(SystemAccountCodes.ACCOUNTS_PAYABLE)
      : input.paymentMethod === "CASH"
        ? await resolver.idFor(SystemAccountCodes.CASH_IN_HAND)
        : await resolver.idFor(SystemAccountCodes.BANK_ACCOUNTS);

    let voucherNumber = input.voucherNumber?.trim() || "";
    if (voucherNumber) {
      if (await this.expenses.voucherExists(voucherNumber, companyId)) {
        throw new ConflictError(`Expense voucher '${voucherNumber}' already exists.`);
      }
    } else {
      voucherNumber = await this.journal.nextVoucherNumber(companyId, "EXPENSE_VOUCHER");
    }

    return this.db.transaction(async () => {
      const id = await this.expenses.insertExpense({
        company_id: companyId,
        voucher_number: voucherNumber,
        category_id: category.id,
        expense_date: input.expenseDate,
        amount: toStorage(amount),
        payment_method: input.paymentMethod,
        status: payLater ? "UNPAID" : "PAID",
        due_date: payLater ? input.dueDate ?? null : null,
        bank_account_id: input.bankAccountId ?? null,
        cheque_id: input.chequeId ?? null,
        description: input.description ?? null,
        created_by: input.createdBy ?? null,
      });

      const journalEntryId = await this.accounting.postJournalEntry({
        voucherType: "JOURNAL",
        entryDate: input.expenseDate,
        lines: [
          {
            accountId: expenseAccountId,
            debit: amount,
            description: input.description ?? `Expense: ${category.name}`,
          },
          {
            accountId: paymentAccountId,
            credit: amount,
            description: `Payment for: ${category.name}`,
          },
        ],
        sourceTable: "expenses",
        sourceId: id,
        narration: `Expense voucher ${voucherNumber}: ${category.name}`,
        companyId,
        createdBy: input.createdBy ?? null,
      });

      return { id, voucherNumber, journalEntryId };
    });
  }

  /**
   * Settle an unpaid expense bill: Dr Accounts Payable / Cr cash|bank. One
   * full payment per bill — the UNPAID status check is the overpayment guard.
   */
  async payExpense(id: number, input: PayExpenseInput): Promise<ExpenseResult> {
    if (!["CASH", "BANK", "CHEQUE"].includes(input.paymentMethod)) {
      throw new ValidationError("Invalid payment method.");
    }
    const companyId = input.companyId ?? this.companyId;
    const paymentDate = input.paymentDate || new Date().toISOString().slice(0, 10);

    return this.db.transaction(async () => {
      const expense = await this.expenses.findExpenseById(id);
      if (!expense) throw new NotFoundError(`Expense ${id} not found.`);
      if (expense.status !== "UNPAID") {
        throw new ConflictError(`Expense ${expense.voucher_number} is already paid.`);
      }

      const resolver = new SystemAccountResolver(this.db, companyId);
      const apId = await resolver.idFor(SystemAccountCodes.ACCOUNTS_PAYABLE);
      const paymentAccountId =
        input.paymentMethod === "CASH"
          ? await resolver.idFor(SystemAccountCodes.CASH_IN_HAND)
          : await resolver.idFor(SystemAccountCodes.BANK_ACCOUNTS);

      const journalEntryId = await this.accounting.postJournalEntry({
        voucherType: "PAYMENT",
        entryDate: paymentDate,
        lines: [
          {
            accountId: apId,
            debit: expense.amount,
            description: `Settle expense ${expense.voucher_number}`,
          },
          {
            accountId: paymentAccountId,
            credit: expense.amount,
            description: `Payment of expense ${expense.voucher_number}`,
          },
        ],
        // A separate source table so the bill's original journal entry (source
        // table "expenses") stays the single entry for that expense id.
        sourceTable: "expense_settlements",
        sourceId: expense.id,
        narration: `Expense payment ${expense.voucher_number}`,
        companyId,
        createdBy: input.createdBy ?? null,
      });

      await this.db.run(
        `UPDATE expenses
            SET status = 'PAID', settlement_journal_entry_id = ?, updated_at = datetime('now')
          WHERE id = ?`,
        [journalEntryId, expense.id],
      );

      return { id: expense.id, voucherNumber: expense.voucher_number, journalEntryId };
    });
  }

  /**
   * Edit a recorded expense. The old journal entry is removed and the corrected
   * one posted in the same transaction, so the expense account and the cash /
   * bank / A/P credit always move together. A settled pay-later bill must have
   * its settlement reversed first (mirrors the invoice payment rule).
   */
  async updateExpense(id: number, input: UpdateExpenseInput): Promise<ExpenseResult> {
    const existing = await this.expenses.findExpenseById(id);
    if (!existing) throw new NotFoundError(`Expense ${id} not found.`);
    if (existing.settlement_journal_entry_id != null) {
      throw new ConflictError(
        `Expense ${existing.voucher_number} has a settlement. Reverse the settlement first.`,
      );
    }

    const amount = round2(input.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new ValidationError("Amount must be greater than 0.");
    }
    if (!["CASH", "BANK", "CHEQUE"].includes(input.paymentMethod)) {
      throw new ValidationError("Invalid payment method.");
    }
    if (!input.expenseDate) throw new ValidationError("Expense date is required.");
    const category = await this.expenses.findCategoryById(input.categoryId);
    if (!category) throw new NotFoundError(`Expense category ${input.categoryId} not found.`);
    if (!category.is_active) throw new ValidationError("Category is not active.");

    const companyId = input.companyId ?? this.companyId;
    const resolver = new SystemAccountResolver(this.db, companyId);
    const expenseAccountId = category.account_id ?? (await resolver.idFor("6000"));
    const payLater = existing.status === "UNPAID";
    const paymentAccountId = payLater
      ? await resolver.idFor(SystemAccountCodes.ACCOUNTS_PAYABLE)
      : input.paymentMethod === "CASH"
        ? await resolver.idFor(SystemAccountCodes.CASH_IN_HAND)
        : await resolver.idFor(SystemAccountCodes.BANK_ACCOUNTS);

    return this.db.transaction(async () => {
      await deleteJournalBySource(this.db, "expenses", id);
      await this.expenses.updateExpense(id, {
        category_id: category.id,
        expense_date: input.expenseDate,
        amount: toStorage(amount),
        payment_method: input.paymentMethod,
        due_date: payLater ? (input.dueDate ?? existing.due_date) : null,
        bank_account_id: input.bankAccountId ?? null,
        cheque_id: input.chequeId ?? null,
        description: input.description ?? null,
        updated_at: new Date().toISOString(),
      });

      const journalEntryId = await this.accounting.postJournalEntry({
        voucherType: "JOURNAL",
        entryDate: input.expenseDate,
        lines: [
          {
            accountId: expenseAccountId,
            debit: amount,
            description: input.description ?? `Expense: ${category.name}`,
          },
          {
            accountId: paymentAccountId,
            credit: amount,
            description: `Payment for: ${category.name}`,
          },
        ],
        sourceTable: "expenses",
        sourceId: id,
        narration: `Expense voucher ${existing.voucher_number}: ${category.name}`,
        companyId,
        createdBy: input.userId ?? null,
      });

      await this.audit.record({
        userId: input.userId ?? null,
        action: "UPDATE",
        table: "expenses",
        entityId: id,
        details: {
          before: existing,
          after: { ...input, amount: toStorage(amount) },
        },
      });

      return { id, voucherNumber: existing.voucher_number, journalEntryId };
    });
  }

  /** Delete an expense and remove its journal entry from the ledger. */
  async deleteExpense(id: number, userId: number | null = null): Promise<void> {
    const existing = await this.expenses.findExpenseById(id);
    if (!existing) throw new NotFoundError(`Expense ${id} not found.`);
    if (existing.settlement_journal_entry_id != null) {
      throw new ConflictError(
        `Expense ${existing.voucher_number} has a settlement. Reverse the settlement first.`,
      );
    }

    await this.db.transaction(async () => {
      await deleteJournalBySource(this.db, "expenses", id);
      await this.expenses.deleteExpense(id);
      await this.audit.record({
        userId,
        action: "DELETE",
        table: "expenses",
        entityId: id,
        details: {
          voucherNumber: existing.voucher_number,
          input: {
            categoryId: existing.category_id,
            expenseDate: existing.expense_date,
            amount: existing.amount,
            paymentMethod: existing.payment_method,
            payLater: existing.status === "UNPAID",
            dueDate: existing.due_date,
            bankAccountId: existing.bank_account_id,
            description: existing.description,
          },
        },
      });
    });
  }

  /**
   * Reverse a pay-later settlement: the settlement journal is removed and the
   * bill returns to UNPAID, which restores the Accounts Payable balance.
   */
  async deleteExpenseSettlement(id: number, userId: number | null = null): Promise<void> {
    const existing = await this.expenses.findExpenseById(id);
    if (!existing) throw new NotFoundError(`Expense ${id} not found.`);
    if (existing.settlement_journal_entry_id == null) {
      throw new ValidationError(`Expense ${existing.voucher_number} has no settlement to reverse.`);
    }

    const settlementJournalId = existing.settlement_journal_entry_id;
    await this.db.transaction(async () => {
      // Detach the bill before removing the entry it points at: the FK would
      // reject the delete otherwise.
      await this.expenses.updateExpense(id, {
        status: "UNPAID",
        settlement_journal_entry_id: null,
        updated_at: new Date().toISOString(),
      });
      await deleteJournalBySource(this.db, "expense_settlements", id);
      await this.audit.record({
        userId,
        action: "DELETE",
        table: "expense_settlements",
        entityId: id,
        details: {
          voucherNumber: existing.voucher_number,
          settlementJournalId,
          input: {
            paymentMethod: existing.payment_method,
            paymentDate: existing.expense_date,
            bankAccountId: existing.bank_account_id,
          },
        },
      });
    });
  }
}
