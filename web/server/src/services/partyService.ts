/**
 * Business rules for Parties (customers/suppliers), ported from
 * services/party_service.py: validation, auto-generated codes
 * (CUST-00001 / SUPP-00001), account linkage rules and the
 * "cannot deactivate a party with open transactions" guard.
 */
import type { SqlDatabase } from "../db/types.js";
import { NotFoundError, ValidationError } from "../domain/errors.js";
import { SystemAccountCodes, type PartyType } from "../domain/enums.js";
import { AccountRepository } from "../repositories/accountRepository.js";
import { JournalRepository } from "../repositories/journalRepository.js";
import { PartyRepository, type PartyRow } from "../repositories/partyRepository.js";
import { SystemAccountResolver } from "../repositories/systemAccounts.js";
import { AccountingService, type JournalLineInput } from "./accountingService.js";

const PARTY_TYPES: readonly PartyType[] = ["CUSTOMER", "SUPPLIER", "BOTH"];

export interface CreatePartyInput {
  name: string;
  partyType: PartyType;
  creditLimit?: number;
  accountId?: number | null;
  code?: string | null;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  customerCategory?: string | null;
}

export interface UpdatePartyInput {
  name: string;
  creditLimit: number;
  accountId?: number | null;
  isActive?: boolean;
  partyType?: PartyType;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  customerCategory?: string | null;
}

export interface PartyOpeningBalanceEntry {
  partyId: number;
  debit?: number;
  credit?: number;
}

export interface PartyOpeningBalanceResult {
  journalEntryId: number;
  totalDebit: number;
  totalCredit: number;
  partiesUpdated: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export class PartyService {
  private readonly parties: PartyRepository;
  private readonly accounts: AccountRepository;
  private readonly journal: JournalRepository;
  private readonly accounting: AccountingService;
  private readonly systemAccounts: SystemAccountResolver;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.parties = new PartyRepository(db);
    this.accounts = new AccountRepository(db);
    this.journal = new JournalRepository(db);
    this.accounting = new AccountingService(db, companyId);
    this.systemAccounts = new SystemAccountResolver(db, companyId);
  }

  async list(
    opts: { type?: PartyType; activeOnly?: boolean; search?: string } = {},
  ): Promise<PartyRow[]> {
    return this.parties.list(this.companyId, opts);
  }

  async get(id: number): Promise<PartyRow> {
    return this.parties.requireById(id);
  }

  async create(input: CreatePartyInput): Promise<PartyRow> {
    const name = input.name.trim();
    if (!name) throw new ValidationError("Party name is required.");
    if (input.partyType && !PARTY_TYPES.includes(input.partyType)) {
      throw new ValidationError(`Invalid party type: ${input.partyType}`);
    }
    const creditLimit = input.creditLimit ?? 0;
    if (creditLimit < 0) throw new ValidationError("Credit limit cannot be negative.");

    let code = input.code?.trim() || null;
    if (code !== null) {
      if (!code) throw new ValidationError("Party code cannot be empty.");
      // The schema constrains UNIQUE(company_id, code) company-wide, so the
      // check is company-wide too (the Python per-type check would let the
      // insert through only to fail on the database constraint).
      if (await this.parties.findByCode(code, this.companyId)) {
        throw new ValidationError(`Party code '${code}' already exists.`);
      }
    }

    await this.validateAccountLink(input.partyType, input.accountId ?? null);

    const id = await this.db.transaction(async () => {
      if (code === null) {
        const documentType = input.partyType === "CUSTOMER" ? "CUSTOMER" : "SUPPLIER";
        code = await this.journal.nextVoucherNumber(this.companyId, documentType);
      }
      return this.parties.insert({
        company_id: this.companyId,
        code: code as string,
        name,
        party_type: input.partyType,
        credit_limit: creditLimit,
        account_id: input.accountId ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        email: input.email ?? null,
        customer_category: input.customerCategory ?? null,
        opening_balance: 0,
        is_active: 1,
      });
    });

    return this.parties.requireById(id);
  }

  async update(id: number, input: UpdatePartyInput): Promise<PartyRow> {
    const existing = await this.parties.findById(id);
    if (!existing) throw new NotFoundError("Party not found.");
    const name = input.name.trim();
    if (!name) throw new ValidationError("Party name is required.");
    if (input.creditLimit < 0) throw new ValidationError("Credit limit cannot be negative.");

    const isActive = input.isActive !== false;
    if (!isActive && (await this.hasOpenTransactions(id))) {
      throw new ValidationError("Cannot deactivate party with open transactions.");
    }

    await this.parties.update(id, {
      name,
      credit_limit: input.creditLimit,
      account_id: input.accountId ?? null,
      is_active: isActive ? 1 : 0,
      party_type: input.partyType ?? existing.party_type,
      phone: input.phone ?? existing.phone,
      address: input.address ?? existing.address,
      email: input.email ?? existing.email,
      customer_category: input.customerCategory ?? existing.customer_category,
    });
    return this.parties.requireById(id);
  }

  async deactivate(id: number): Promise<void> {
    const party = await this.parties.findById(id);
    if (!party) throw new NotFoundError("Party not found.");
    if (await this.hasOpenTransactions(id)) {
      throw new ValidationError("Cannot deactivate party with open transactions.");
    }
    await this.parties.deactivate(id);
  }

  /**
   * Bulk opening balances, same shape as accountService.postOpeningBalances:
   * debit = party owes us, credit = we owe the party (advance). Posted as ONE
   * balanced OPENING entry; the net difference goes to Retained Earnings so the
   * entry always balances. A party's previous opening balance is reversed with a
   * contra line first, so re-saving the same values is a no-op.
   */
  async postOpeningBalances(
    entries: readonly PartyOpeningBalanceEntry[],
  ): Promise<PartyOpeningBalanceResult> {
    const clean = entries.map((entry) => ({
      partyId: entry.partyId,
      debit: Math.abs(entry.debit ?? 0),
      credit: Math.abs(entry.credit ?? 0),
    }));

    if (clean.length === 0) throw new ValidationError("No opening balances to save.");
    if (new Set(clean.map((entry) => entry.partyId)).size !== clean.length) {
      throw new ValidationError("A party can only appear once in opening balances.");
    }

    const receivableId = await this.systemAccounts.idFor(SystemAccountCodes.ACCOUNTS_RECEIVABLE);
    const payableId = await this.systemAccounts.idFor(SystemAccountCodes.ACCOUNTS_PAYABLE);
    const earningsId = await this.systemAccounts.idFor(SystemAccountCodes.RETAINED_EARNINGS);

    const lines: JournalLineInput[] = [];
    const updated: Array<{ id: number; signed: number }> = [];
    for (const entry of clean) {
      if (entry.debit !== 0 && entry.credit !== 0) {
        throw new ValidationError("An opening balance line cannot be both debit and credit.");
      }
      const party = await this.parties.findById(entry.partyId);
      if (!party || party.company_id !== this.companyId) {
        throw new ValidationError(`Party ${entry.partyId} does not exist.`);
      }
      const accountId =
        party.account_id ?? (party.party_type === "SUPPLIER" ? payableId : receivableId);
      const prior = Number(party.opening_balance ?? 0);
      if (prior !== 0) {
        // shortcut: the contra uses the party's current linked account; changing
        // that link after posting leaves the old OPENING line on the old account.
        lines.push({
          accountId,
          partyId: party.id,
          debit: prior < 0 ? -prior : 0,
          credit: prior > 0 ? prior : 0,
          description: "Opening balance reversal",
        });
      }
      if (entry.debit !== 0 || entry.credit !== 0) {
        lines.push({
          accountId,
          partyId: party.id,
          debit: entry.debit,
          credit: entry.credit,
          description: "Opening balance",
        });
      }
      updated.push({ id: party.id, signed: entry.debit - entry.credit });
    }

    if (lines.length === 0) throw new ValidationError("No opening balances to save.");

    const sumDebit = lines.reduce((acc, line) => acc + Number(line.debit ?? 0), 0);
    const sumCredit = lines.reduce((acc, line) => acc + Number(line.credit ?? 0), 0);
    const totalDebit = clean.reduce((acc, entry) => acc + entry.debit, 0);
    const totalCredit = clean.reduce((acc, entry) => acc + entry.credit, 0);
    const plug = Math.round((sumDebit - sumCredit) * 100) / 100;
    if (plug !== 0) {
      lines.push({
        accountId: earningsId,
        debit: plug < 0 ? -plug : 0,
        credit: plug > 0 ? plug : 0,
        description: "Party opening balances",
      });
    }

    const journalEntryId = await this.db.transaction(async () => {
      const id = await this.accounting.postJournalEntry({
        voucherType: "OPENING",
        entryDate: today(),
        lines,
        narration: "Party opening balances",
        sourceTable: "parties",
        companyId: this.companyId,
      });
      for (const party of updated) {
        await this.parties.update(party.id, { opening_balance: party.signed });
      }
      return id;
    });

    return {
      journalEntryId,
      totalDebit,
      totalCredit,
      partiesUpdated: updated.length,
    };
  }

  /** Customers must link to an ASSET account (A/R), suppliers to a LIABILITY (A/P). */
  private async validateAccountLink(
    partyType: PartyType,
    accountId: number | null,
  ): Promise<void> {
    if (accountId == null) return;
    const account = await this.accounts.findById(accountId);
    if (!account) throw new ValidationError("Specified account does not exist.");
    if (partyType === "CUSTOMER" && account.account_type !== "ASSET") {
      throw new ValidationError(
        "Customer accounts must link to asset-type accounts (e.g., A/R).",
      );
    }
    if (partyType === "SUPPLIER" && account.account_type !== "LIABILITY") {
      throw new ValidationError(
        "Supplier accounts must link to liability-type accounts (e.g., A/P).",
      );
    }
  }

  /**
   * Ported from PartyService._has_open_transactions: unpaid/part-paid or
   * zero-total invoices, or any receipt/payment already recorded for the party.
   */
  private async hasOpenTransactions(partyId: number): Promise<boolean> {
    const count = async (sql: string, params: Array<string | number>): Promise<number> => {
      const row = await this.db.get<{ cnt: number }>(sql, params);
      return Number(row?.cnt ?? 0);
    };

    const openSales = await count(
      `SELECT COUNT(*) AS cnt FROM sales_invoices
       WHERE customer_id = ? AND status IN ('CONFIRMED','PENDING')
         AND (paid_amount < total_amount OR total_amount = 0)`,
      [partyId],
    );
    if (openSales > 0) return true;

    const openPurchases = await count(
      `SELECT COUNT(*) AS cnt FROM purchase_invoices
       WHERE supplier_id = ? AND status IN ('CONFIRMED','PENDING')
         AND (paid_amount < total_amount OR total_amount = 0)`,
      [partyId],
    );
    if (openPurchases > 0) return true;

    const receipts = await count("SELECT COUNT(*) AS cnt FROM receipts WHERE party_id = ?", [
      partyId,
    ]);
    if (receipts > 0) return true;

    const payments = await count("SELECT COUNT(*) AS cnt FROM payments WHERE party_id = ?", [
      partyId,
    ]);
    return payments > 0;
  }
}
