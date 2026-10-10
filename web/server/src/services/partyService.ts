/**
 * Business rules for Parties (customers/suppliers), ported from
 * services/party_service.py: validation, auto-generated codes
 * (CUST-00001 / SUPP-00001), account linkage rules and the
 * "cannot deactivate a party with open transactions" guard.
 */
import type { SqlDatabase } from "../db/types.js";
import { NotFoundError, ValidationError } from "../domain/errors.js";
import type { PartyType } from "../domain/enums.js";
import { AccountRepository } from "../repositories/accountRepository.js";
import { JournalRepository } from "../repositories/journalRepository.js";
import { PartyRepository, type PartyRow } from "../repositories/partyRepository.js";

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

export class PartyService {
  private readonly parties: PartyRepository;
  private readonly accounts: AccountRepository;
  private readonly journal: JournalRepository;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.parties = new PartyRepository(db);
    this.accounts = new AccountRepository(db);
    this.journal = new JournalRepository(db);
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
