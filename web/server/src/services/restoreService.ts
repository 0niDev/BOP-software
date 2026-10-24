/**
 * Restore a deleted record from the audit trail.
 *
 * The DELETE audit row stores the create-input, not the raw database row, so a
 * restore re-runs the normal create path: the journal entry, stock movement and
 * any bank row are posted exactly as they were the first time. Voucher numbers
 * are re-allocated (a gap in a sequence is harmless; a missing journal entry is
 * not). The RESTORE row records which deletion was consumed so nothing is
 * restored twice.
 */
import type { SqlDatabase } from "../db/types.js";
import { ConflictError, NotFoundError, ValidationError } from "../domain/errors.js";
import { AssetService } from "./assetService.js";
import { AuditService, type AuditEntry } from "./auditService.js";
import { BankingService } from "./bankingService.js";
import { ExpenseService } from "./expenseService.js";
import { PaymentService } from "./paymentService.js";
import { ReturnsService } from "./returnsService.js";

export interface RestoreResult {
  table: string;
  id: number;
}

interface AuditDetails {
  input?: Record<string, unknown>;
  [key: string]: unknown;
}

export class RestoreService {
  private readonly audit: AuditService;
  private readonly expenses: ExpenseService;
  private readonly payments: PaymentService;
  private readonly banking: BankingService;
  private readonly returns: ReturnsService;
  private readonly assets: AssetService;

  constructor(
    db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.audit = new AuditService(db);
    this.expenses = new ExpenseService(db, companyId);
    this.payments = new PaymentService(db, companyId);
    this.banking = new BankingService(db, companyId);
    this.returns = new ReturnsService(db, companyId);
    this.assets = new AssetService(db, companyId);
  }

  listDeleted(): Promise<Array<AuditEntry & { restored: boolean }>> {
    return this.audit.listDeleted();
  }

  async restore(auditId: number, userId: number | null = null): Promise<RestoreResult> {
    const entry = await this.audit.findDeletion(auditId);
    if (!entry) throw new NotFoundError(`Deletion ${auditId} not found.`);
    if (await this.audit.wasRestored(auditId)) {
      throw new ConflictError("This record has already been restored.");
    }

    const details = this.parseDetails(entry);
    const input = details.input;
    if (!input) throw new ValidationError("This deletion has no payload to restore.");

    const id = await this.recreate(entry.entity_table, entry.entity_id, input, userId);
    await this.audit.record({
      userId,
      action: "RESTORE",
      table: entry.entity_table,
      entityId: id,
      details: { restoredAuditId: auditId },
    });
    return { table: entry.entity_table, id };
  }

  private async recreate(
    table: string,
    entityId: number | null,
    input: Record<string, unknown>,
    userId: number | null,
  ): Promise<number> {
    switch (table) {
      case "expenses":
        return (await this.expenses.createExpense({ ...input, createdBy: userId } as never)).id;

      case "expense_settlements":
        if (entityId == null) throw new ValidationError("Settlement restore has no expense id.");
        return (
          await this.expenses.payExpense(entityId, { ...input, createdBy: userId } as never)
        ).id;

      case "payments":
        return (await this.payments.paySupplier({ ...input, userId } as never)).id;

      case "receipts":
        return (await this.payments.receivePayment({ ...input, userId } as never)).id;

      case "bank_transactions": {
        const result =
          input.type === "WITHDRAWAL"
            ? await this.banking.withdraw(input as never)
            : await this.banking.deposit(input as never);
        return result.id;
      }

      case "cheques": {
        const cheque =
          input.chequeType === "RECEIVED"
            ? await this.banking.receiveCheque(input as never)
            : await this.banking.issueCheque(input as never);
        return cheque.id;
      }

      case "sales_returns":
        return (await this.returns.createSalesReturn({ ...input, createdBy: userId } as never)).id;

      case "purchase_returns":
        return (
          await this.returns.createPurchaseReturn({ ...input, createdBy: userId } as never)
        ).id;

      case "assets":
        return (await this.assets.create({ ...input } as never)).account_id;

      default:
        throw new ValidationError(`'${table}' records cannot be restored.`);
    }
  }

  private parseDetails(entry: AuditEntry): AuditDetails {
    if (!entry.details) return {};
    try {
      return JSON.parse(entry.details) as AuditDetails;
    } catch {
      throw new ValidationError("This deletion has an unreadable payload.");
    }
  }
}
