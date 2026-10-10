/**
 * Core double-entry accounting engine.
 *
 * Every module that records money movement goes through postJournalEntry()
 * instead of touching journal_entries/journal_entry_lines directly, which
 * guarantees: entries are balanced before they are written, voucher numbers
 * are sequential per type, and every entry is traceable to its source
 * document. This mirrors services/accounting_service.py.
 */
import type { SqlDatabase } from "../db/types.js";
import { isDebitNormal, type AccountType, type VoucherType } from "../domain/enums.js";
import { UnbalancedJournalEntryError, ValidationError } from "../domain/errors.js";
import { Decimal, round2, toStorage, type MoneyLike } from "../domain/money.js";
import { AccountRepository } from "../repositories/accountRepository.js";
import { JournalRepository, type JournalLineRow } from "../repositories/journalRepository.js";

const ROUNDING_TOLERANCE = "0.01";

export interface JournalLineInput {
  accountId: number;
  debit?: MoneyLike;
  credit?: MoneyLike;
  partyId?: number | null;
  description?: string | null;
}

export interface PostJournalEntryInput {
  voucherType: VoucherType;
  entryDate: string;
  lines: readonly JournalLineInput[];
  narration?: string | null;
  referenceNo?: string | null;
  sourceTable?: string | null;
  sourceId?: number | null;
  createdBy?: number | null;
  companyId?: number;
  voucherNumber?: string | null;
}

export interface TrialBalanceRow {
  accountId: number;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debit: number;
  credit: number;
}

export class AccountingService {
  private readonly journal: JournalRepository;
  private readonly accounts: AccountRepository;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.journal = new JournalRepository(db);
    this.accounts = new AccountRepository(db);
  }

  /**
   * Validate and write one balanced journal entry, returning its id. Callers
   * that need atomicity must wrap this in db.transaction() together with the
   * document it belongs to.
   */
  async postJournalEntry(input: PostJournalEntryInput): Promise<number> {
    const lines = input.lines;
    if (lines.length < 2) {
      throw new ValidationError("A journal entry needs at least two lines.");
    }

    const prepared = lines.map((line) => {
      const debit = round2(line.debit ?? 0);
      const credit = round2(line.credit ?? 0);
      if (debit.isNegative() || credit.isNegative()) {
        throw new ValidationError("Journal line amounts cannot be negative.");
      }
      if (!debit.isZero() && !credit.isZero()) {
        throw new ValidationError("A journal line cannot have both debit and credit.");
      }
      return { line, debit, credit };
    });

    const totalDebit = prepared.reduce((acc, p) => acc.plus(p.debit), new Decimal(0));
    const totalCredit = prepared.reduce((acc, p) => acc.plus(p.credit), new Decimal(0));
    if (totalDebit.minus(totalCredit).abs().greaterThan(new Decimal(ROUNDING_TOLERANCE))) {
      throw new UnbalancedJournalEntryError(
        `Journal entry not balanced: debit=${totalDebit.toFixed(2)}, credit=${totalCredit.toFixed(2)}`,
      );
    }

    const companyId = input.companyId ?? this.companyId;
    const voucherNumber =
      input.voucherNumber ??
      (await this.journal.nextVoucherNumber(companyId, input.voucherType));

    const rows: JournalLineRow[] = prepared.map(({ line, debit, credit }) => ({
      account_id: line.accountId,
      debit: toStorage(debit),
      credit: toStorage(credit),
      party_id: line.partyId ?? null,
      description: line.description ?? null,
    }));

    return this.journal.insertEntry(
      {
        company_id: companyId,
        voucher_number: voucherNumber,
        voucher_type: input.voucherType,
        entry_date: input.entryDate,
        reference_no: input.referenceNo ?? null,
        narration: input.narration ?? null,
        source_table: input.sourceTable ?? null,
        source_id: input.sourceId ?? null,
        is_posted: 1,
        created_by: input.createdBy ?? null,
      },
      rows,
    );
  }

  async getJournalEntry(sourceTable: string, sourceId: number): Promise<Record<string, unknown> | null> {
    const entry = await this.journal.findBySource(sourceTable, sourceId);
    if (!entry) return null;
    const lines = await this.journal.findLinesForEntry(Number(entry.id));
    return { ...entry, lines };
  }

  async getAccountBalance(accountId: number): Promise<number> {
    return this.accounts.getCurrentBalance(accountId);
  }

  /**
   * One query returns every account with its posted debit/credit totals.
   *
   * Active accounts are always listed; deactivated accounts are listed only
   * while they still carry posted movement. The original Python app filtered
   * exclusively on `is_active = 1`, which silently unbalanced the trial
   * balance as soon as an account with a balance was deactivated (its journal
   * lines stayed behind but the account disappeared from the report).
   */
  async getTrialBalance(companyId = this.companyId): Promise<TrialBalanceRow[]> {
    const rows = await this.db.all<{
      id: number;
      account_code: string;
      account_name: string;
      account_type: AccountType;
      total_debit: number;
      total_credit: number;
    }>(
      `SELECT a.id, a.account_code, a.account_name, a.account_type,
              COALESCE(SUM(CASE WHEN je.is_posted = 1 THEN jel.debit ELSE 0 END), 0) AS total_debit,
              COALESCE(SUM(CASE WHEN je.is_posted = 1 THEN jel.credit ELSE 0 END), 0) AS total_credit
       FROM accounts a
       LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
       LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
       WHERE a.company_id = ?
       GROUP BY a.id, a.account_code, a.account_name, a.account_type, a.is_active
       HAVING a.is_active = 1
           OR SUM(CASE WHEN je.is_posted = 1 THEN jel.debit ELSE 0 END) <> 0
           OR SUM(CASE WHEN je.is_posted = 1 THEN jel.credit ELSE 0 END) <> 0
       ORDER BY a.account_code`,
      [companyId],
    );

    return rows.map((row) => {
      const raw = new Decimal(row.total_debit).minus(new Decimal(row.total_credit));
      const debitNormal = isDebitNormal(row.account_type);
      // Balance expressed with the account's normal sign (assets/expenses are
      // debit-positive, everything else credit-positive), then placed in the
      // matching column -- a positive revenue balance is a *credit*.
      const normal = debitNormal ? raw : raw.negated();
      let debit = new Decimal(0);
      let credit = new Decimal(0);
      if (normal.greaterThanOrEqualTo(0)) {
        if (debitNormal) debit = normal;
        else credit = normal;
      } else if (debitNormal) {
        credit = normal.negated();
      } else {
        debit = normal.negated();
      }
      return {
        accountId: row.id,
        accountCode: row.account_code,
        accountName: row.account_name,
        accountType: row.account_type,
        debit: toStorage(debit),
        credit: toStorage(credit),
      };
    });
  }
}
