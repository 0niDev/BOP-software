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
import { JournalRepository } from "../repositories/journalRepository.js";
import { AccountingService, type JournalLineInput } from "./accountingService.js";
import { assignDisplayCodes } from "./displayCodes.js";

export const ACCOUNT_TYPES: readonly AccountType[] = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
];

export interface CreateAccountInput {
  /** Blank/omitted → auto-generated (AC-00001 style), like customers/items. */
  accountCode?: string;
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

export interface OpeningBalanceEntry {
  accountId: number;
  debit?: number;
  credit?: number;
}

export interface OpeningBalanceResult {
  journalEntryId: number;
  totalDebit: number;
  totalCredit: number;
  accountsUpdated: number;
}

export type AccountWithDeleteFlags = AccountRow & {
  can_delete: boolean;
  delete_blockers: string[];
  /** Hierarchical display code (1 / 11 / 111); account_code stays the real one. */
  display_code: string;
};

/**
 * Codes that must never be hard-deleted:
 *  - the engine posts to these by name (enums.ts SystemAccountCodes plus the
 *    opening-equity/expense-fallback/disposal/COGS-map codes in the services);
 *  - the remaining bootstrap seeds are "UI-locked" system accounts.
 * The import's own is_system_account=1 rows deliberately aren't in this set —
 * they are cleanup targets — so deletion eligibility always comes from
 * PROTECTED_CODES + reference checks, never from the DB flag.
 */
const PROTECTED_CODES: ReadonlySet<string> = new Set([
  ...Object.values(SystemAccountCodes),
  "3000", // opening-balance equity posting (accountService)
  "6000", // default expense posting (expenseService)
  "6900", // gain/loss on asset disposal (assetService)
  "5001", // COGS map: PACKING_MATERIAL
  "5002", // COGS map: RAW_MATERIAL
  "1300", "2200", "5100", "5300", "1500", "1501", "1502", "1503", "1504", "1505", // bootstrap seeds (server/src/db/bootstrap.ts)
]);

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

  /** Same rows as list(), plus hard-delete eligibility for the CoA UI. */
  async listWithDeleteFlags(activeOnly = true): Promise<AccountWithDeleteFlags[]> {
    const [rows, blockers] = await Promise.all([
      this.accounts.listForCompany(this.companyId, activeOnly),
      this.accounts.deleteBlockers(this.companyId),
    ]);
    const displayCodes = assignDisplayCodes(
      rows.map((row) => ({
        id: row.id,
        parentAccountId: row.parent_account_id,
        accountCode: row.account_code,
        isActive: row.is_active === 1,
      })),
    );
    return rows.map((row) => {
      const reasons: string[] = [];
      if (PROTECTED_CODES.has(row.account_code)) reasons.push("system account");
      reasons.push(...(blockers.get(row.id) ?? []));
      return {
        ...row,
        can_delete: reasons.length === 0,
        delete_blockers: reasons,
        display_code: displayCodes.get(row.id) ?? row.account_code,
      };
    });
  }

  async get(id: number): Promise<AccountRow> {
    const account = await this.accounts.findById(id);
    if (!account) throw new NotFoundError("Account not found.");
    return account;
  }

  async create(input: CreateAccountInput): Promise<AccountRow> {
    let accountCode = input.accountCode?.trim() ?? "";
    const accountName = input.accountName.trim();
    if (!accountName) throw new ValidationError("Account name is required.");
    if (!(ACCOUNT_TYPES as readonly string[]).includes(input.accountType)) {
      throw new ValidationError(`Invalid account type: ${input.accountType}`);
    }
    const accountType = input.accountType as AccountType;
    if (accountCode && (await this.accounts.codeExists(accountCode, this.companyId))) {
      throw new ValidationError(`Account code '${accountCode}' already exists.`);
    }

    const parentAccountId = input.parentAccountId ?? null;
    await this.assertParentUsable(parentAccountId, accountType, null);

    const openingBalance = input.openingBalance ?? 0;

    const id = await this.db.transaction(async () => {
      if (!accountCode) {
        // Same allocator as customers/items; sequence guarantees a free code.
        const generated = await new JournalRepository(this.db).nextVoucherNumber(this.companyId, "ACCOUNT");
        accountCode = generated;
      }
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
    // Re-parenting (or clearing a parent) is validated; keeping the current
    // parent is always allowed so legacy deep accounts stay editable.
    if ((input.parentAccountId ?? null) !== existing.parent_account_id) {
      await this.assertParentUsable(input.parentAccountId ?? null, existing.account_type, id);
    }

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

  /**
   * Hard delete for chart cleanup: removes the row entirely. Only valid for
   * accounts with zero postings, zero family links and no active children —
   * eligibility is recomputed here so the UI badge can never drift from the
   * server's answer.
   */
  async delete(id: number): Promise<void> {
    const account = await this.accounts.findById(id);
    if (!account || account.company_id !== this.companyId) {
      throw new NotFoundError("Account not found.");
    }
    if (PROTECTED_CODES.has(account.account_code)) {
      throw new ValidationError("System accounts cannot be deleted.");
    }
    const blockers = await this.accounts.deleteBlockers(this.companyId);
    const reasons = blockers.get(id) ?? [];
    if (reasons.length > 0) {
      throw new ValidationError(
        `Cannot delete ${account.account_code}: ${reasons.join(", ")}.`,
      );
    }
    await this.accounts.remove(id);
  }

  /**
   * Bulk opening balances, ported from views/widgets/opening_balance_dialog.py:
   * the entered amounts are posted as ONE balanced OPENING journal entry and the
   * `accounts.opening_balance` display column is refreshed for each account.
   * (The display column is still never added into balances -- the posted entry
   * is the single source of truth, see the class comment.)
   */
  async postOpeningBalances(entries: readonly OpeningBalanceEntry[]): Promise<OpeningBalanceResult> {
    const clean = entries
      .map((entry) => ({
        accountId: entry.accountId,
        debit: Math.abs(entry.debit ?? 0),
        credit: Math.abs(entry.credit ?? 0),
      }))
      .filter((entry) => entry.debit !== 0 || entry.credit !== 0);

    if (clean.length === 0) {
      throw new ValidationError("No opening balances to save.");
    }

    let totalDebit = 0;
    let totalCredit = 0;
    const resolved: Array<{ entry: (typeof clean)[number]; account: AccountRow }> = [];
    for (const entry of clean) {
      if (entry.debit !== 0 && entry.credit !== 0) {
        throw new ValidationError("An opening balance line cannot be both debit and credit.");
      }
      const account = await this.accounts.findById(entry.accountId);
      if (!account || account.company_id !== this.companyId) {
        throw new ValidationError(`Account ${entry.accountId} does not exist.`);
      }
      totalDebit += entry.debit;
      totalCredit += entry.credit;
      resolved.push({ entry, account });
    }

    if (Math.abs(totalDebit - totalCredit) > 0.01 || totalDebit === 0) {
      throw new ValidationError(
        `Opening balances are not balanced: debit=${totalDebit.toFixed(2)}, credit=${totalCredit.toFixed(2)}.`,
      );
    }

    const journalEntryId = await this.db.transaction(async () => {
      const id = await this.accounting.postJournalEntry({
        voucherType: "OPENING",
        entryDate: today(),
        lines: resolved.map(({ entry }) => ({
          accountId: entry.accountId,
          debit: entry.debit,
          credit: entry.credit,
          description: "Opening balance",
        })),
        narration: "Opening balances",
        sourceTable: "accounts",
        companyId: this.companyId,
      });
      for (const { entry, account } of resolved) {
        const debitNormal = isDebitNormal(account.account_type);
        const signed = debitNormal ? entry.debit - entry.credit : entry.credit - entry.debit;
        await this.accounts.update(account.id, { opening_balance: signed });
      }
      return id;
    });

    return {
      journalEntryId,
      totalDebit,
      totalCredit,
      accountsUpdated: resolved.length,
    };
  }

  /**
   * Validate a proposed parent: it must exist in this company, be active, be
   * of the same type, and not be the edited account itself or one of its
   * descendants (cycle-free tree).
   */
  private async assertParentUsable(
    parentAccountId: number | null,
    accountType: AccountType,
    selfId: number | null,
  ): Promise<void> {
    if (parentAccountId == null) return;
    const parent = await this.accounts.findById(parentAccountId);
    if (!parent || parent.company_id !== this.companyId) {
      throw new ValidationError("Selected parent account does not exist.");
    }
    if (parent.is_active !== 1) {
      throw new ValidationError("Selected parent account is inactive.");
    }
    if (parent.account_type !== accountType) {
      throw new ValidationError(
        "A sub-account must have the same account type as its parent.",
      );
    }

    // Walk to the root: rejects cycles (self-parent / descendant loops).
    let cursor: AccountRow | undefined = parent;
    const seen = new Set<number>();
    while (cursor) {
      if (seen.has(cursor.id)) {
        throw new ValidationError("The account hierarchy contains a cycle.");
      }
      seen.add(cursor.id);
      if (selfId !== null && cursor.id === selfId) {
        throw new ValidationError(
          "An account cannot be placed under itself or one of its own sub-accounts.",
        );
      }
      cursor =
        cursor.parent_account_id == null
          ? undefined
          : await this.accounts.findById(cursor.parent_account_id);
    }
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
