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

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.accounts = new AccountRepository(db);
    this.expenses = new ExpenseRepository(db);
    this.journal = new JournalRepository(db);
    this.accounting = new AccountingService(db, companyId);
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
}
