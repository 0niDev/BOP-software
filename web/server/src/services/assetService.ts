/**
 * Fixed assets, ported from views/widgets/asset_view.py.
 *
 * An asset is a fixed-asset account (code 1501-1506) plus an `asset_details`
 * row and a purchase journal entry: Dr the asset account, Cr Accounts Payable
 * (2000, with the supplier) for credit purchases or Cash (1000) / Bank (1010).
 */
import type { SqlDatabase } from "../db/types.js";
import { NotFoundError, ValidationError } from "../domain/errors.js";
import { AccountRepository } from "../repositories/accountRepository.js";
import { AssetRepository, type AssetRow } from "../repositories/assetRepository.js";
import { SystemAccountResolver } from "../repositories/systemAccounts.js";
import { AccountService } from "./accountService.js";
import { AccountingService } from "./accountingService.js";

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

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.assets = new AssetRepository(db);
    this.accounts = new AccountRepository(db);
    this.accountService = new AccountService(db, companyId);
    this.accounting = new AccountingService(db, companyId);
    this.systemAccounts = new SystemAccountResolver(db, companyId);
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
}
