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
  voucherNumber?: string | null;
  bankAccountId?: number | null;
  chequeId?: number | null;
  description?: string | null;
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
    const paymentAccountId =
      input.paymentMethod === "CASH"
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
}
