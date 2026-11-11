/**
 * Chart of Accounts business rules, ported from services/account_service.py.
 *
 * An opening balance is a value stored on the account itself (signed by the
 * account's normal balance) and folded into the account's balance by the
 * repositories. Nothing is posted against equity, so an unbalanced set of
 * openings shows as an unbalanced trial balance instead of being hidden.
 */
import type { SqlDatabase } from "../db/types.js";
import { SystemAccountCodes, type AccountType } from "../domain/enums.js";
import { NotFoundError, ValidationError } from "../domain/errors.js";
import { AccountRepository, type AccountRow } from "../repositories/accountRepository.js";
import { JournalRepository } from "../repositories/journalRepository.js";
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

export class AccountService {
  private readonly accounts: AccountRepository;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.accounts = new AccountRepository(db);
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
      return this.accounts.insert({
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

    await this.accounts.update(id, {
      account_name: accountName,
      opening_balance: input.openingBalance,
      parent_account_id: input.parentAccountId ?? null,
      is_active: input.isActive === false ? 0 : 1,
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
}
