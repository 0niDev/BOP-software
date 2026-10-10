/**
 * Banking service. Port of services/banking_service.py.
 *
 * All bank accounts link to the single Chart-of-Accounts "Bank Accounts"
 * entry (1010), so consolidated reporting works.
 *
 *   createBankAccount  opening balance:  Dr 1010  Cr Retained Earnings 3100 (OPENING)
 *   deposit:                             Dr 1010  Cr Cash 1000
 *   withdraw:                            Dr Cash 1000  Cr 1010
 *   clearCheque (ISSUED):                Dr AP 2000 (party)  Cr 1010
 *   clearCheque (RECEIVED):              Dr 1010  Cr AR 1100 (party)
 */
import type { SqlDatabase } from "../db/types.js";
import { SystemAccountCodes } from "../domain/enums.js";
import { ConflictError, NotFoundError, ValidationError } from "../domain/errors.js";
import { dec, round2, toStorage } from "../domain/money.js";
import {
  BankingRepository,
  type BankAccountRow,
  type BankTransactionRow,
  type ChequeRow,
} from "../repositories/bankingRepository.js";
import { AccountRepository } from "../repositories/accountRepository.js";
import { JournalRepository } from "../repositories/journalRepository.js";
import { SystemAccountResolver } from "../repositories/systemAccounts.js";
import { AccountingService, type JournalLineInput } from "./accountingService.js";

export interface CreateBankAccountInput {
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  openingBalance?: number | string;
  branchCode?: string | null;
  iban?: string | null;
  companyId?: number;
}

export interface BankMovementInput {
  bankAccountId: number;
  amount: number | string;
  date: string;
  referenceNo?: string | null;
  notes?: string | null;
}

export interface ChequeInput {
  bankAccountId: number;
  chequeNumber: string;
  amount: number | string;
  chequeDate: string;
  partyId?: number | null;
  notes?: string | null;
}

export class BankingService {
  private readonly banks: BankingRepository;
  private readonly accounts: AccountRepository;
  private readonly journal: JournalRepository;
  private readonly accounting: AccountingService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.banks = new BankingRepository(db);
    this.accounts = new AccountRepository(db);
    this.journal = new JournalRepository(db);
    this.accounting = new AccountingService(db, companyId);
  }

  async listBankAccounts(): Promise<BankAccountRow[]> {
    return this.banks.listBankAccounts(this.companyId);
  }

  async getBalance(bankAccountId: number): Promise<number> {
    const account = await this.banks.findBankAccountById(bankAccountId);
    if (!account) throw new NotFoundError(`Bank account ${bankAccountId} not found.`);
    return this.accounts.getCurrentBalance(account.account_id);
  }

  async createBankAccount(input: CreateBankAccountInput): Promise<BankAccountRow> {
    const companyId = input.companyId ?? this.companyId;
    const bankName = input.bankName?.trim();
    const accountTitle = input.accountTitle?.trim();
    const accountNumber = input.accountNumber?.trim();
    if (!bankName) throw new ValidationError("Bank name is required.");
    if (!accountTitle) throw new ValidationError("Account title is required.");
    if (!accountNumber) throw new ValidationError("Account number is required.");
    if (await this.banks.findBankAccountByNumber(accountNumber, companyId)) {
      throw new ConflictError(`Bank account number '${accountNumber}' already exists.`);
    }
    const openingBalance = round2(input.openingBalance ?? 0);
    if (openingBalance.lessThan(0)) {
      throw new ValidationError("Opening balance cannot be negative.");
    }

    const resolver = new SystemAccountResolver(this.db, companyId);
    const coaBankId = await resolver.idFor(SystemAccountCodes.BANK_ACCOUNTS);

    return this.db.transaction(async () => {
      const id = await this.banks.insertBankAccount({
        company_id: companyId,
        account_id: coaBankId,
        bank_name: bankName,
        account_title: accountTitle,
        account_number: accountNumber,
        branch_code: input.branchCode ?? null,
        iban: input.iban ?? null,
        opening_balance: toStorage(openingBalance),
        is_active: 1,
      });

      if (openingBalance.greaterThan(0)) {
        await this.accounting.postJournalEntry({
          voucherType: "OPENING",
          entryDate: new Date().toISOString().slice(0, 10),
          lines: [
            { accountId: coaBankId, debit: openingBalance, description: "Opening balance" },
            {
              accountId: await resolver.idFor(SystemAccountCodes.RETAINED_EARNINGS),
              credit: openingBalance,
              description: "Opening balance",
            },
          ],
          narration: `Bank account opening balance: ${bankName}`,
          companyId,
        });
      }

      const created = await this.banks.findBankAccountById(id);
      return created!;
    });
  }

  async deposit(input: BankMovementInput): Promise<{ id: number; journalEntryId: number }> {
    return this.movement(input, "DEPOSIT");
  }

  async withdraw(input: BankMovementInput): Promise<{ id: number; journalEntryId: number }> {
    return this.movement(input, "WITHDRAWAL");
  }

  private async movement(
    input: BankMovementInput,
    type: "DEPOSIT" | "WITHDRAWAL",
  ): Promise<{ id: number; journalEntryId: number }> {
    const amount = round2(input.amount);
    if (amount.lessThanOrEqualTo(0)) throw new ValidationError("Amount must be greater than 0.");
    const account = await this.banks.findBankAccountById(input.bankAccountId);
    if (!account) throw new NotFoundError(`Bank account ${input.bankAccountId} not found.`);

    const resolver = new SystemAccountResolver(this.db, this.companyId);
    const cashId = await resolver.idFor(SystemAccountCodes.CASH_IN_HAND);
    const description = `${type === "DEPOSIT" ? "Deposit" : "Withdrawal"}${input.referenceNo ? ` - ${input.referenceNo}` : ""}`;

    const lines: JournalLineInput[] =
      type === "DEPOSIT"
        ? [
            { accountId: account.account_id, debit: amount, description },
            { accountId: cashId, credit: amount, description },
          ]
        : [
            { accountId: cashId, debit: amount, description },
            { accountId: account.account_id, credit: amount, description },
          ];

    return this.db.transaction(async () => {
      const journalEntryId = await this.accounting.postJournalEntry({
        voucherType: "JOURNAL",
        entryDate: input.date,
        lines,
        narration: description,
        companyId: this.companyId,
      });
      const id = await this.banks.insertTransaction({
        bank_account_id: account.id,
        transaction_type: type,
        amount: toStorage(amount),
        transaction_date: input.date,
        reference_no: input.referenceNo ?? null,
        notes: input.notes ?? null,
        journal_entry_id: journalEntryId,
      });
      return { id, journalEntryId };
    });
  }

  async listTransactions(): Promise<BankTransactionRow[]> {
    return this.banks.listTransactions(this.companyId);
  }

  async listCheques(status?: string): Promise<ChequeRow[]> {
    return this.banks.listCheques(this.companyId, status);
  }

  async issueCheque(input: ChequeInput): Promise<ChequeRow> {
    return this.createCheque(input, "ISSUED");
  }

  async receiveCheque(input: ChequeInput): Promise<ChequeRow> {
    return this.createCheque(input, "RECEIVED");
  }

  private async createCheque(input: ChequeInput, type: "ISSUED" | "RECEIVED"): Promise<ChequeRow> {
    const account = await this.banks.findBankAccountById(input.bankAccountId);
    if (!account) throw new NotFoundError(`Bank account ${input.bankAccountId} not found.`);
    const amount = round2(input.amount);
    if (amount.lessThanOrEqualTo(0)) throw new ValidationError("Cheque amount must be greater than 0.");
    if (!input.chequeNumber?.trim()) throw new ValidationError("Cheque number is required.");

    const id = await this.banks.insertCheque({
      company_id: this.companyId,
      bank_account_id: account.id,
      party_id: input.partyId ?? null,
      cheque_number: input.chequeNumber.trim(),
      cheque_type: type,
      amount: toStorage(amount),
      cheque_date: input.chequeDate,
      status: "UNCLEARED",
      notes: input.notes ?? null,
    });
    const created = await this.banks.findChequeById(id);
    return created!;
  }

  /** Clear a cheque, posting the cash movement and updating its status. */
  async clearCheque(chequeId: number): Promise<{ journalEntryId: number }> {
    const cheque = await this.banks.findChequeById(chequeId);
    if (!cheque) throw new NotFoundError(`Cheque ${chequeId} not found.`);
    if (cheque.status !== "UNCLEARED") {
      throw new ValidationError(`Cheque is already '${cheque.status}'.`);
    }
    const account = await this.banks.findBankAccountById(cheque.bank_account_id);
    if (!account) throw new NotFoundError("Bank account for cheque not found.");

    const resolver = new SystemAccountResolver(this.db, this.companyId);
    const amount = dec(cheque.amount);
    const lines: JournalLineInput[] =
      cheque.cheque_type === "ISSUED"
        ? [
            {
              accountId: await resolver.idFor(SystemAccountCodes.ACCOUNTS_PAYABLE),
              debit: amount,
              partyId: cheque.party_id,
              description: `Cheque ${cheque.cheque_number} issued`,
            },
            { accountId: account.account_id, credit: amount, description: `Cheque ${cheque.cheque_number}` },
          ]
        : [
            { accountId: account.account_id, debit: amount, description: `Cheque ${cheque.cheque_number}` },
            {
              accountId: await resolver.idFor(SystemAccountCodes.ACCOUNTS_RECEIVABLE),
              credit: amount,
              partyId: cheque.party_id,
              description: `Cheque ${cheque.cheque_number} received`,
            },
          ];

    return this.db.transaction(async () => {
      const journalEntryId = await this.accounting.postJournalEntry({
        voucherType: "JOURNAL",
        entryDate: new Date().toISOString().slice(0, 10),
        lines,
        narration: `Cheque ${cheque.cheque_number} cleared`,
        companyId: this.companyId,
      });
      await this.banks.updateCheque(chequeId, {
        status: "CLEARED",
        cleared_date: new Date().toISOString().slice(0, 10),
      });
      return { journalEntryId };
    });
  }

  async bounceCheque(chequeId: number): Promise<void> {
    await this.setChequeStatus(chequeId, "BOUNCED");
  }

  async loseCheque(chequeId: number): Promise<void> {
    await this.setChequeStatus(chequeId, "LOST");
  }

  private async setChequeStatus(chequeId: number, status: string): Promise<void> {
    const cheque = await this.banks.findChequeById(chequeId);
    if (!cheque) throw new NotFoundError(`Cheque ${chequeId} not found.`);
    await this.banks.updateCheque(chequeId, { status });
  }
}
