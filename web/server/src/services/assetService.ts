/**
 * Fixed assets, ported from views/widgets/asset_view.py.
 *
 * An asset is a fixed-asset account (code 1501-1506) plus an `asset_details`
 * row and a purchase journal entry: Dr the asset account, Cr Accounts Payable
 * (2000, with the supplier) for credit purchases or Cash (1000) / Bank (1010).
 */
import type { SqlDatabase } from "../db/types.js";
import { ConflictError, NotFoundError, ValidationError } from "../domain/errors.js";
import { dec, round2, toStorage } from "../domain/money.js";
import { AccountRepository } from "../repositories/accountRepository.js";
import { AssetRepository, type AssetRow } from "../repositories/assetRepository.js";
import { SystemAccountResolver } from "../repositories/systemAccounts.js";
import { AccountService } from "./accountService.js";
import { AccountingService, type JournalLineInput } from "./accountingService.js";
import { AuditService } from "./auditService.js";
import { deleteJournalBySource } from "./journalEffects.js";

/** The asset account codes offered by the dialog, in its order. */
export const ASSET_CODES: ReadonlyArray<{ code: string; label: string }> = [
  { code: "1501", label: "Furniture & Fixtures" },
  { code: "1502", label: "Office Equipment" },
  { code: "1503", label: "Plant & Machinery" },
  { code: "1504", label: "Motor Vehicles" },
  { code: "1505", label: "Buildings" },
  { code: "1506", label: "Other Fixed Assets" },
];

export type AssetClassification = "CURRENT" | "NON_CURRENT";
export type AssetPaymentType = "CREDIT" | "CASH" | "BANK" | "CHEQUE";

export interface CreateAssetInput {
  assetName: string;
  assetCode: string;
  amount: number;
  purchaseDate: string;
  paymentType?: AssetPaymentType;
  classification?: AssetClassification;
  supplierId?: number | null;
  dueDate?: string | null;
  notes?: string | null;
}

export class AssetService {
  private readonly assets: AssetRepository;
  private readonly accounts: AccountRepository;
  private readonly accountService: AccountService;
  private readonly accounting: AccountingService;
  private readonly systemAccounts: SystemAccountResolver;
  private readonly audit: AuditService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.assets = new AssetRepository(db);
    this.accounts = new AccountRepository(db);
    this.accountService = new AccountService(db, companyId);
    this.accounting = new AccountingService(db, companyId);
    this.systemAccounts = new SystemAccountResolver(db, companyId);
    this.audit = new AuditService(db);
  }

  async list(): Promise<AssetRow[]> {
    return this.assets.list(this.companyId);
  }

  /** The dialog's code catalogue, for the client's dropdown. */
  codes(): ReadonlyArray<{ code: string; label: string }> {
    return ASSET_CODES;
  }

  async create(input: CreateAssetInput): Promise<AssetRow> {
    const name = input.assetName.trim();
    if (!name) throw new ValidationError("Asset name is required.");
    if (!(input.amount > 0)) throw new ValidationError("Please enter a valid amount.");
    if (!ASSET_CODES.some((entry) => entry.code === input.assetCode)) {
      throw new ValidationError(`Invalid asset code: ${input.assetCode}`);
    }
    const paymentType = input.paymentType ?? "CREDIT";
    if (!["CREDIT", "CASH", "BANK", "CHEQUE"].includes(paymentType)) {
      throw new ValidationError("Invalid payment method.");
    }
    const classification = input.classification ?? "NON_CURRENT";
    if (!["CURRENT", "NON_CURRENT"].includes(classification)) {
      throw new ValidationError("Invalid classification.");
    }

    // Reuse the account when the code already exists (asset_details is
    // UNIQUE(account_id), so one asset record per code -- as in Python).
    let account = await this.accounts.findByCode(input.assetCode, this.companyId);
    if (!account) {
      account = await this.accountService.create({
        accountCode: input.assetCode,
        accountName: `${name} (Asset)`,
        accountType: "ASSET",
        accountSubtype: classification,
      });
    } else if (!account.is_active) {
      // A deleted asset left its account hidden; buying it back (or restoring
      // the deletion) has to put it back on the list.
      await this.accounts.update(account.id, { is_active: 1 });
    }

    const creditAccountId =
      paymentType === "CREDIT"
        ? await this.systemAccounts.idFor("2000")
        : paymentType === "CASH"
          ? await this.systemAccounts.idFor("1000")
          : await this.systemAccounts.idFor("1010");

    await this.db.transaction(async () => {
      await this.accounting.postJournalEntry({
        voucherType: "JOURNAL",
        entryDate: input.purchaseDate,
        lines: [
          {
            accountId: account.id,
            debit: input.amount,
            description: `Asset purchase: ${name}`,
          },
          {
            accountId: creditAccountId,
            credit: input.amount,
            partyId: paymentType === "CREDIT" ? (input.supplierId ?? null) : null,
            description: `Asset purchase: ${name}`,
          },
        ],
        narration: `Asset purchase - ${name}`,
        sourceTable: "asset_details",
        sourceId: account.id,
        companyId: this.companyId,
      });

      await this.assets.upsertDetails({
        account_id: account.id,
        asset_type: classification,
        purchase_amount: input.amount,
        purchase_date: input.purchaseDate,
        supplier_id: input.supplierId ?? null,
        due_date: input.dueDate ?? null,
        notes: input.notes ?? null,
      });
    });

    const created = (await this.assets.list(this.companyId)).find(
      (row) => row.account_id === account.id,
    );
    if (!created) throw new NotFoundError("Asset was saved but could not be re-read.");
    return created;
  }

  /**
   * Edit an asset's purchase details. The old purchase journal is replaced so
   * the asset account always carries exactly one purchase entry. Assets with
   * any other ledger activity (depreciation, disposals) are refused.
   */
  async update(
    accountId: number,
    input: Omit<CreateAssetInput, "assetCode"> & { assetCode?: string },
  ): Promise<AssetRow> {
    const name = input.assetName?.trim();
    if (!name) throw new ValidationError("Asset name is required.");
    const amount = round2(input.amount);
    if (amount.lessThanOrEqualTo(0)) throw new ValidationError("Please enter a valid amount.");
    if (!input.purchaseDate) throw new ValidationError("Purchase date is required.");
    const paymentType = input.paymentType ?? "CREDIT";
    const classification = input.classification ?? "NON_CURRENT";

    const account = await this.requireAssetAccount(accountId);
    const details = await this.assets.findDetailsByAccount(accountId);
    if (!details) throw new ValidationError("Only assets recorded in this module can be edited.");
    await this.assertOnlyPurchaseEntries(accountId);

    const creditAccountId =
      paymentType === "CREDIT"
        ? await this.systemAccounts.idFor("2000")
        : paymentType === "CASH"
          ? await this.systemAccounts.idFor("1000")
          : await this.systemAccounts.idFor("1010");

    await this.db.transaction(async () => {
      await deleteJournalBySource(this.db, "asset_details", accountId);
      await this.accounts.update(accountId, {
        account_name: `${name} (Asset)`,
        account_subtype: classification,
      });
      await this.assets.upsertDetails({
        account_id: accountId,
        asset_type: classification,
        purchase_amount: toStorage(amount),
        purchase_date: input.purchaseDate,
        supplier_id: input.supplierId ?? null,
        due_date: input.dueDate ?? null,
        notes: input.notes ?? null,
      });
      await this.accounting.postJournalEntry({
        voucherType: "JOURNAL",
        entryDate: input.purchaseDate,
        lines: [
          { accountId, debit: amount, description: `Asset purchase: ${name}` },
          {
            accountId: creditAccountId,
            credit: amount,
            partyId: paymentType === "CREDIT" ? (input.supplierId ?? null) : null,
            description: `Asset purchase: ${name}`,
          },
        ],
        narration: `Asset purchase - ${name}`,
        sourceTable: "asset_details",
        sourceId: accountId,
        companyId: this.companyId,
      });
      await this.audit.record({
        userId: null,
        action: "UPDATE",
        table: "assets",
        entityId: accountId,
        details: { before: { ...details, account_code: account.account_code }, after: input },
      });
    });

    const updated = (await this.assets.list(this.companyId)).find(
      (row) => row.account_id === accountId,
    );
    if (!updated) throw new NotFoundError("Asset was saved but could not be re-read.");
    return updated;
  }

  /**
   * Delete an asset: remove its purchase journal and details, then hide the
   * account. Refused once any other entry touches the account, so a disposed
   * or depreciated asset cannot silently lose its history.
   */
  async delete(accountId: number, userId: number | null = null): Promise<void> {
    const account = await this.requireAssetAccount(accountId);
    const details = await this.assets.findDetailsByAccount(accountId);
    if (!details) throw new ValidationError("Only assets recorded in this module can be deleted.");
    await this.assertOnlyPurchaseEntries(accountId);
    const paymentType = await this.purchasePaymentType(accountId);

    await this.db.transaction(async () => {
      await deleteJournalBySource(this.db, "asset_details", accountId);
      await this.db.run("DELETE FROM asset_details WHERE account_id = ?", [accountId]);
      await this.accounts.deactivate(accountId);
      await this.audit.record({
        userId,
        action: "DELETE",
        table: "assets",
        entityId: accountId,
        details: {
          input: {
            assetName: account.account_name.replace(/ \(Asset\)$/, ""),
            assetCode: account.account_code,
            amount: details.purchase_amount,
            purchaseDate: details.purchase_date,
            classification: details.asset_type,
            supplierId: details.supplier_id,
            dueDate: details.due_date,
            notes: details.notes,
            paymentType,
          },
        },
      });
    });
  }

  /**
   * Dispose of an asset: credit the asset at book value, debit the proceeds and
   * put the difference to 6900 Gain/Loss on Asset Disposal, then hide the account.
   */
  async dispose(
    accountId: number,
    input: { disposeDate: string; proceeds?: number | string; notes?: string | null; userId?: number | null },
  ): Promise<{ journalEntryId: number; gainLoss: number }> {
    const account = await this.requireAssetAccount(accountId);
    const details = await this.assets.findDetailsByAccount(accountId);
    if (!details) throw new ValidationError("Only assets recorded in this module can be disposed.");
    if (!input.disposeDate) throw new ValidationError("Disposal date is required.");

    const bookValue = dec(await this.accounts.getCurrentBalance(accountId));
    if (bookValue.lessThanOrEqualTo(0)) {
      throw new ValidationError("Asset has no book value left to dispose.");
    }
    const proceeds = round2(input.proceeds ?? 0);
    if (proceeds.lessThan(0)) throw new ValidationError("Proceeds cannot be negative.");

    const cashId = await this.systemAccounts.idFor("1000");
    const gainLossId = await this.systemAccounts.idFor("6900");
    const difference = round2(proceeds.minus(bookValue));
    const lines: JournalLineInput[] = [
      {
        accountId,
        credit: bookValue,
        description: `Asset disposal: ${account.account_name}`,
      },
    ];
    if (proceeds.greaterThan(0)) {
      lines.push({
        accountId: cashId,
        debit: proceeds,
        description: `Asset disposal proceeds: ${account.account_name}`,
      });
    }
    if (difference.greaterThan(0)) {
      lines.push({
        accountId: gainLossId,
        credit: difference,
        description: "Gain on asset disposal",
      });
    } else if (difference.lessThan(0)) {
      lines.push({
        accountId: gainLossId,
        debit: round2(difference.abs()),
        description: "Loss on asset disposal",
      });
    }

    return this.db.transaction(async () => {
      const journalEntryId = await this.accounting.postJournalEntry({
        voucherType: "JOURNAL",
        entryDate: input.disposeDate,
        lines,
        narration: `Asset disposal - ${account.account_name}`,
        sourceTable: "asset_disposals",
        sourceId: accountId,
        companyId: this.companyId,
      });
      await this.db.run("DELETE FROM asset_details WHERE account_id = ?", [accountId]);
      await this.accounts.deactivate(accountId);
      await this.audit.record({
        userId: input.userId ?? null,
        action: "DISPOSE",
        table: "assets",
        entityId: accountId,
        details: {
          input: { ...input, proceeds: toStorage(proceeds) },
          bookValue: toStorage(bookValue),
          gainLoss: toStorage(difference),
          notes: input.notes ?? null,
        },
      });
      return { journalEntryId, gainLoss: toStorage(difference) };
    });
  }

  private async requireAssetAccount(accountId: number) {
    const account = await this.accounts.findById(accountId);
    if (
      !account ||
      account.account_type !== "ASSET" ||
      !account.account_code.startsWith("15")
    ) {
      throw new NotFoundError(`Asset ${accountId} not found.`);
    }
    return account;
  }

  /** True when every journal line on the account came from its purchase entry. */
  private async assertOnlyPurchaseEntries(accountId: number): Promise<void> {
    const row = await this.db.get<{ count: number }>(
      `SELECT COUNT(*) AS count
         FROM journal_entry_lines jel
         JOIN journal_entries je ON je.id = jel.journal_entry_id
        WHERE jel.account_id = ?
          AND NOT (je.source_table = 'asset_details' AND je.source_id = ?)`,
      [accountId, accountId],
    );
    if (Number(row?.count ?? 0) > 0) {
      throw new ConflictError(
        "This asset has ledger entries beyond its purchase. Dispose of it instead of editing or deleting it.",
      );
    }
  }

  /** How the purchase was settled, read back from the entry it credited. */
  private async purchasePaymentType(accountId: number): Promise<string> {
    const row = await this.db.get<{ account_code: string }>(
      `SELECT a.account_code
         FROM journal_entry_lines jel
         JOIN journal_entries je ON je.id = jel.journal_entry_id
         JOIN accounts a ON a.id = jel.account_id
        WHERE je.source_table = 'asset_details' AND je.source_id = ?
          AND jel.credit > 0
        LIMIT 1`,
      [accountId],
    );
    switch (row?.account_code) {
      case "1000":
        return "CASH";
      case "1010":
        return "BANK";
      default:
        return "CREDIT";
    }
  }
}
