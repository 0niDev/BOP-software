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
import { UnbalancedJournalEntryError, ConflictError, NotFoundError, ValidationError } from "../domain/errors.js";
import { Decimal, round2, toStorage, type MoneyLike } from "../domain/money.js";
import { AccountRepository } from "../repositories/accountRepository.js";
import { JournalRepository, type JournalLineRow } from "../repositories/journalRepository.js";
import { assignDisplayCodes } from "./displayCodes.js";

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
  /** Manual vouchers may post straight to a header (a level-3 account that
   * still has sub-accounts); every document path stays leaf-only. */
  allowGroupAccounts?: boolean;
}

export interface ManualJournalLineInput {
  accountId: number;
  partyId?: number | null;
  description?: string | null;
  debit?: MoneyLike;
  credit?: MoneyLike;
}

export interface CreateManualJournalInput {
  entryDate: string;
  narration?: string | null;
  referenceNo?: string | null;
  voucherNumber?: string | null;
  lines: ManualJournalLineInput[];
  companyId?: number;
  createdBy?: number | null;
}

export interface ManualJournalResult {
  id: number;
  voucherNumber: string;
}

export interface TrialBalanceRow {
  accountId: number;
  accountCode: string;
  /** Hierarchical display code (1 / 11 / 111); accountCode stays the real one. */
  displayCode: string;
  accountName: string;
  accountType: AccountType;
  /** CoA parent, so the report can nest sub-accounts like the CoA page. */
  parentAccountId: number | null;
  /** Balance carried into the period (`from` exclusive). */
  openingDebit: number;
  openingCredit: number;
  /** Movement inside the period (the classic trial-balance columns). */
  debit: number;
  credit: number;
  /** Opening + period, placed in the account's normal column. */
  closingDebit: number;
  closingCredit: number;
}

export interface DateRangeOptions {
  from?: string | null;
  to?: string | null;
}

/** Place a signed normal balance into the debit/credit columns. */
function place(
  normal: Decimal,
  debitNormal: boolean,
): { debit: Decimal; credit: Decimal } {
  if (normal.greaterThanOrEqualTo(0)) {
    return debitNormal
      ? { debit: normal, credit: new Decimal(0) }
      : { debit: new Decimal(0), credit: normal };
  }
  const positive = normal.negated();
  return debitNormal
    ? { debit: new Decimal(0), credit: positive }
    : { debit: positive, credit: new Decimal(0) };
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
    if (!input.allowGroupAccounts) {
      await this.assertPostable(companyId, prepared.map(({ line }) => line.accountId));
    }

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

  /**
   * A manual journal voucher: free-form balanced lines posted straight to the
   * ledger, numbered JV- through the JOURNAL_VOUCHER sequence. Unlike every
   * other posting path there is no business document — the entry is its own
   * source, so `source_id` self-references after insert and the ledger lookup
   * route resolves it like any other voucher.
   */
  async createManualJournal(
    input: CreateManualJournalInput,
  ): Promise<ManualJournalResult> {
    const companyId = input.companyId ?? this.companyId;
    if (!input.entryDate) throw new ValidationError("Entry date is required.");
    if (input.lines.length < 2) {
      throw new ValidationError("A journal voucher needs at least two lines.");
    }

    const lines: JournalLineInput[] = input.lines.map((line, index) => {
      const debit = round2(line.debit ?? 0);
      const credit = round2(line.credit ?? 0);
      if (debit.isZero() && credit.isZero()) {
        throw new ValidationError(`Line ${index + 1} needs a debit or a credit amount.`);
      }
      return {
        accountId: line.accountId,
        partyId: line.partyId ?? null,
        description: line.description ?? null,
        debit,
        credit,
      };
    });

    const voucherNumber = input.voucherNumber?.trim() || null;
    if (voucherNumber && (await this.journal.voucherExists(companyId, voucherNumber))) {
      throw new ConflictError(`Journal voucher '${voucherNumber}' already exists.`);
    }

    return this.db.transaction(async () => {
      const id = await this.postJournalEntry({
        voucherType: "JOURNAL",
        entryDate: input.entryDate,
        voucherNumber,
        referenceNo: input.referenceNo ?? null,
        narration: input.narration ?? null,
        lines,
        sourceTable: "journal_entries",
        companyId,
        createdBy: input.createdBy ?? null,
        allowGroupAccounts: true,
      });
      await this.db.run("UPDATE journal_entries SET source_id = ? WHERE id = ?", [id, id]);
      const row = await this.journal.findById(id);
      return { id, voucherNumber: String(row?.voucher_number ?? "") };
    });
  }

  /** Manual vouchers, newest first; auto-posted JOURNAL entries are excluded. */
  async listManualJournals(options: DateRangeOptions = {}): Promise<Record<string, unknown>[]> {
    return this.journal.listManual(this.companyId, options.from, options.to);
  }

  /**
   * Post the opposite of a manual voucher on a chosen date. Posted entries are
   * immutable, so reversal is the correction path (Zoho/ERPNext behaviour).
   * Entries owned by another document (expenses, banking, assets) are refused —
   * those are corrected through their own module.
   */
  async reverseManualJournal(
    id: number,
    input: { reversalDate?: string; narration?: string | null; createdBy?: number | null } = {},
  ): Promise<ManualJournalResult> {
    const companyId = this.companyId;
    const entry = await this.journal.findById(id);
    if (!entry) throw new NotFoundError(`Journal entry ${id} not found.`);
    if (entry.voucher_type !== "JOURNAL" || entry.source_table !== "journal_entries") {
      throw new ValidationError(
        "Only manual journal vouchers can be reversed here — correct the source document instead.",
      );
    }

    const original = await this.journal.findLinesForEntry(id);
    const reversalDate = input.reversalDate || new Date().toISOString().slice(0, 10);

    return this.db.transaction(async () => {
      const reversalId = await this.postJournalEntry({
        voucherType: "JOURNAL",
        entryDate: reversalDate,
        referenceNo: String(entry.voucher_number),
        narration: input.narration ?? `Reversal of ${entry.voucher_number}`,
        lines: original.map((line) => ({
          accountId: Number(line.account_id),
          partyId: line.party_id == null ? null : Number(line.party_id),
          description: (line.description as string | null) ?? null,
          debit: Number(line.credit),
          credit: Number(line.debit),
        })),
        sourceTable: "journal_entries",
        companyId,
        createdBy: input.createdBy ?? null,
        allowGroupAccounts: true,
      });
      await this.db.run("UPDATE journal_entries SET source_id = ? WHERE id = ?", [
        reversalId,
        reversalId,
      ]);
      const row = await this.journal.findById(reversalId);
      return { id: reversalId, voucherNumber: String(row?.voucher_number ?? "") };
    });
  }

  /**
   * A group/header account (one that has active sub-accounts) must never
   * receive journal lines: the balance belongs to the leaf account, and
   * posting to both would double-count as soon as balances roll up through
   * the hierarchy. One query per entry keeps this cheap and catches every
   * posting path (vouchers, expenses, opening balances, ...).
   */
  private async assertPostable(companyId: number, accountIds: readonly number[]): Promise<void> {
    const groups = await this.accounts.findGroupIds(companyId);
    if (groups.size === 0) return;
    for (const accountId of new Set(accountIds)) {
      if (!groups.has(accountId)) continue;
      const account = await this.accounts.findById(accountId);
      throw new ValidationError(
        `Account ${account?.account_code ?? accountId} "${account?.account_name ?? ""}" has sub-accounts — post to a ledger sub-account instead.`,
      );
    }
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
   * One query returns every account with its posted opening / period / closing
   * figures. Passing `from`/`to` scopes the *movement* columns to that period
   * while the opening columns carry everything before `from`.
   *
   * Active accounts are always listed; deactivated accounts are listed only
   * while they still carry posted movement. The original Python app filtered
   * exclusively on `is_active = 1`, which silently unbalanced the trial
   * balance as soon as an account with a balance was deactivated (its journal
   * lines stayed behind but the account disappeared from the report).
   */
  async getTrialBalance(
    companyId = this.companyId,
    opts: DateRangeOptions = {},
  ): Promise<TrialBalanceRow[]> {
    const from = opts.from ?? null;
    const to = opts.to ?? null;
    const rows = await this.db.all<{
      id: number;
      account_code: string;
      account_name: string;
      account_type: AccountType;
      parent_account_id: number | null;
      is_active: number;
      period_debit: number;
      period_credit: number;
      opening_debit: number;
      opening_credit: number;
    }>(
      // Plain `?` placeholders only (the hosted SQLite Cloud driver is not
      // exercised by the local tests, and `?NNN` support there is unverified).
      `SELECT a.id, a.account_code, a.account_name, a.account_type, a.parent_account_id,
              a.is_active,
              COALESCE(SUM(CASE WHEN je.is_posted = 1
                  AND (? IS NULL OR je.entry_date >= ?)
                  AND (? IS NULL OR je.entry_date <= ?)
                  THEN jel.debit ELSE 0 END), 0) AS period_debit,
              COALESCE(SUM(CASE WHEN je.is_posted = 1
                  AND (? IS NULL OR je.entry_date >= ?)
                  AND (? IS NULL OR je.entry_date <= ?)
                  THEN jel.credit ELSE 0 END), 0) AS period_credit,
              COALESCE(SUM(CASE WHEN je.is_posted = 1
                  AND ? IS NOT NULL AND je.entry_date < ?
                  THEN jel.debit ELSE 0 END), 0) AS opening_debit,
              COALESCE(SUM(CASE WHEN je.is_posted = 1
                  AND ? IS NOT NULL AND je.entry_date < ?
                  THEN jel.credit ELSE 0 END), 0) AS opening_credit
       FROM accounts a
       LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
       LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
       WHERE a.company_id = ?
       GROUP BY a.id, a.account_code, a.account_name, a.account_type, a.parent_account_id,
                a.is_active
       HAVING a.is_active = 1
           OR SUM(CASE WHEN je.is_posted = 1 THEN jel.debit ELSE 0 END) <> 0
           OR SUM(CASE WHEN je.is_posted = 1 THEN jel.credit ELSE 0 END) <> 0
       ORDER BY a.account_code`,
      [from, from, to, to, from, from, to, to, from, from, from, from, companyId],
    );

    const displayCodes = assignDisplayCodes(
      rows.map((row) => ({
        id: row.id,
        parentAccountId: row.parent_account_id,
        accountCode: row.account_code,
        isActive: row.is_active === 1,
      })),
    );

    return rows.map((row) => {
      const debitNormal = isDebitNormal(row.account_type);
      const normalise = (debit: number, credit: number): Decimal => {
        // Balance in the account's normal sign (assets/expenses debit-positive,
        // everything else credit-positive).
        const raw = new Decimal(debit).minus(new Decimal(credit));
        return debitNormal ? raw : raw.negated();
      };

      const opening = place(
        normalise(Number(row.opening_debit ?? 0), Number(row.opening_credit ?? 0)),
        debitNormal,
      );
      const period = place(
        normalise(Number(row.period_debit ?? 0), Number(row.period_credit ?? 0)),
        debitNormal,
      );
      const closing = place(
        normalise(
          Number(row.opening_debit ?? 0) + Number(row.period_debit ?? 0),
          Number(row.opening_credit ?? 0) + Number(row.period_credit ?? 0),
        ),
        debitNormal,
      );

      return {
        accountId: row.id,
        accountCode: row.account_code,
        displayCode: displayCodes.get(row.id) ?? row.account_code,
        accountName: row.account_name,
        accountType: row.account_type,
        parentAccountId: row.parent_account_id ?? null,
        openingDebit: toStorage(opening.debit),
        openingCredit: toStorage(opening.credit),
        debit: toStorage(period.debit),
        credit: toStorage(period.credit),
        closingDebit: toStorage(closing.debit),
        closingCredit: toStorage(closing.credit),
      };
    });
  }
}
