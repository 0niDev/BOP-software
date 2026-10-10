/**
 * Chart of Accounts business rules, ported from services/account_service.py.
 *
 * Opening balances are never left dangling: every non-zero opening balance is
 * posted immediately as an OPENING journal entry against the system
 * "Retained Earnings" account (3100), so the accounting equation stays valid
 * at all times. Changing an opening balance later posts an adjusting entry.
 */
import type { SqlDatabase } from "../db/types.js";
import { isDebitNormal, SystemAccountCodes, type AccountType } from "../domain/enums.js";
import { NotFoundError, ValidationError } from "../domain/errors.js";
import { AccountRepository, type AccountRow } from "../repositories/accountRepository.js";
import { SystemAccountResolver } from "../repositories/systemAccounts.js";
import { AccountingService, type JournalLineInput } from "./accountingService.js";

export const ACCOUNT_TYPES: readonly AccountType[] = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
];

export interface CreateAccountInput {
  accountCode: string;
  accountName: string;
  accountType: AccountType | string;
  parentAccountId?: number | null;
  openingBalance?: number;
  accountSubtype?: string | null;
}

export interface UpdateAccountInput {
  accountName: string;
  openingBalance: number;
  parentAccountId?: number | null;
  isActive?: boolean;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export class AccountService {
  private readonly accounts: AccountRepository;
  private readonly accounting: AccountingService;
  private readonly systemAccounts: SystemAccountResolver;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.accounts = new AccountRepository(db);
    this.accounting = new AccountingService(db, companyId);
    this.systemAccounts = new SystemAccountResolver(db, companyId);
  }

  async list(activeOnly = true): Promise<AccountRow[]> {
    return this.accounts.listForCompany(this.companyId, activeOnly);
  }

  async get(id: number): Promise<AccountRow> {
    const account = await this.accounts.findById(id);
    if (!account) throw new NotFoundError("Account not found.");
    return account;
  }

  async create(input: CreateAccountInput): Promise<AccountRow> {
    const accountCode = input.accountCode.trim();
    const accountName = input.accountName.trim();
    if (!accountCode) throw new ValidationError("Account code is required.");
    if (!accountName) throw new ValidationError("Account name is required.");
    if (!(ACCOUNT_TYPES as readonly string[]).includes(input.accountType)) {
      throw new ValidationError(`Invalid account type: ${input.accountType}`);
    }
    const accountType = input.accountType as AccountType;
    if (await this.accounts.codeExists(accountCode, this.companyId)) {
      throw new ValidationError(`Account code '${accountCode}' already exists.`);
    }

    const parentAccountId = input.parentAccountId ?? null;
    if (parentAccountId != null) {
      const parent = await this.accounts.findById(parentAccountId);
      if (!parent) throw new ValidationError("Selected parent account does not exist.");
      if (parent.account_type !== accountType) {
        throw new ValidationError(
          "A sub-account must have the same account type as its parent.",
        );
      }
    }

    const openingBalance = input.openingBalance ?? 0;

    const id = await this.db.transaction(async () => {
      const newId = await this.accounts.insert({
        company_id: this.companyId,
        account_code: accountCode,
        account_name: accountName,
        account_type: accountType,
        parent_account_id: parentAccountId,
        account_subtype: input.accountSubtype ?? null,
        opening_balance: openingBalance,
        is_system_account: 0,
        is_active: 1,
      });
      if (openingBalance) {
        await this.postOpeningBalance(
          { id: newId, account_code: accountCode, account_name: accountName, account_type: accountType, opening_balance: openingBalance },
          openingBalance,
        );
      }
      return newId;
    });

    return this.get(id);
  }

  async update(id: number, input: UpdateAccountInput): Promise<AccountRow> {
    const existing = await this.accounts.findById(id);
    if (!existing) throw new NotFoundError("Account not found.");
    if (existing.is_system_account && input.isActive === false) {
      throw new ValidationError("System accounts cannot be deactivated.");
    }
    const accountName = input.accountName.trim();
    if (!accountName) throw new ValidationError("Account name is required.");

    const oldOpening = Number(existing.opening_balance);
    const newOpening = input.openingBalance;

    await this.db.transaction(async () => {
      await this.accounts.update(id, {
        account_name: accountName,
        opening_balance: newOpening,
        parent_account_id: input.parentAccountId ?? null,
        is_active: input.isActive === false ? 0 : 1,
      });
      if (Math.abs(newOpening - oldOpening) > 0.01) {
        await this.adjustOpeningBalance(
          { ...existing, account_name: accountName },
          newOpening - oldOpening,
        );
      }
    });

    return this.get(id);
  }

  async deactivate(id: number): Promise<void> {
    const account = await this.accounts.findById(id);
    if (!account) throw new NotFoundError("Account not found.");
    if (account.is_system_account) {
      throw new ValidationError("System accounts cannot be deactivated.");
    }
    const children = await this.accounts.findChildren(id);
    if (children.some((child) => child.is_active)) {
      throw new ValidationError(
        "Cannot deactivate an account that has active sub-accounts.",
      );
    }
    await this.accounts.deactivate(id);
  }

  /** OPENING entry: this account +/- against Retained Earnings (3100). */
  private async postOpeningBalance(
    account: {
      id: number;
      account_code: string;
      account_name: string;
      account_type: AccountType;
      opening_balance: number;
    },
    openingBalance: number,
  ): Promise<void> {
    const equityAccountId = await this.systemAccounts.idFor(
      SystemAccountCodes.RETAINED_EARNINGS,
    );
    // Skip when the account *is* the equity account, which would post a
    // self-referencing entry while seeding equity's own opening balance.
    if (account.id === equityAccountId) return;

    await this.postAgainstEquity(
      {
        accountId: account.id,
        accountType: account.account_type,
        amount: Math.abs(openingBalance),
        increases: openingBalance > 0,
        equityAccountId,
      },
      account,
      `Opening balance for ${account.account_code} - ${account.account_name}`,
    );
  }

  private async adjustOpeningBalance(account: AccountRow, adjustment: number): Promise<void> {
    if (Math.abs(adjustment) < 0.01) return;
    const equityAccountId = await this.systemAccounts.idFor(
      SystemAccountCodes.RETAINED_EARNINGS,
    );
    await this.postAgainstEquity(
      {
        accountId: account.id,
        accountType: account.account_type,
        amount: Math.abs(adjustment),
        increases: adjustment > 0,
        equityAccountId,
      },
      account,
      `Adjustment to opening balance for ${account.account_code} - ${account.account_name}`,
    );
  }

  private async postAgainstEquity(
    args: {
      accountId: number;
      accountType: AccountType;
      amount: number;
      increases: boolean;
      equityAccountId: number;
    },
    account: { account_code: string; account_name: string },
    narration: string,
  ): Promise<void> {
    const { accountId, accountType, amount, increases, equityAccountId } = args;
    const debitNormal = isDebitNormal(accountType);
    const sameDebit = debitNormal === increases;

    const thisLine: JournalLineInput = sameDebit
      ? { accountId, debit: amount }
      : { accountId, credit: amount };
    const equityLine: JournalLineInput = sameDebit
      ? { accountId: equityAccountId, credit: amount }
      : { accountId: equityAccountId, debit: amount };

    await this.accounting.postJournalEntry({
      voucherType: "OPENING",
      entryDate: today(),
      lines: [thisLine, equityLine],
      narration,
      sourceTable: "accounts",
      sourceId: accountId,
      companyId: this.companyId,
    });
  }
}
