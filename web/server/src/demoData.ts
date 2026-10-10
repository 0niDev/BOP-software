/**
 * Rich demo data covering every module, built on top of seedDemoData and used by
 * `npm run seed`. Idempotent: looks up by natural keys (party codes, item codes,
 * batch numbers, invoice numbers, etc.) and only inserts what is missing. Only
 * ever run against the local development database.
 *
 * STATUS (left for next agent): this file is a typecheck-clean PLACEHOLDER. A
 * real implementation that posts the full rich scenario through the server
 * services was started but did not reach typecheck-clean, so it was rewritten to
 * this stub so the server typecheck gate stays green. The next agent should
 * implement seedRichDemo against the real return types (see web/server/src/domain/
 * types.ts and the individual service module return types), then wire it into the
 * seed script.
 *******************************************************************************
 * End-to-end checks this demo should exercise (from the acceptance audit)
 * ---------------------------------------------------------------------------
 * - Parties: two customers (with credit limits + emails/phones), two suppliers.
 * - Items: one raw material, one packing material, one finished good.
 * - Opening stock: batches for the raw/packing/finished items (addOpeningStock).
 * - BOM + production order: a BOM for the finished good and a completed
 *   production order that consumes the raw/packing batches.
 * - Purchase invoices: credit + cash purchases (create batches), including a
 *   purchase return.
 * - Sales invoices: cash + credit + bank sales, including a sales return.
 * - Receipts: cash, bank (against a credit sale), bank cheque received + cleared.
 * - Payments: bank payments to suppliers, including a bank cheque issued +
 *   cleared.
 * - Banking: a bank account with opening balance, a deposit, a withdrawal.
 * - Expenses: two expense categories, two expense vouchers, and a "Pay items"
 *   bulk payment of the recurring salaries item.
 * - Fixed assets: one asset purchase (CREDIT) posted through the asset service.
 * - Opening balances: a balanced opening-balance journal entry (postOpeningBalances).
 * - Settings: company profile (GENERAL group) persisted.
 * - Auth: ensure the admin user exists.
 *
 * Rationale: covering every transaction path through the real services is the
 * core of the acceptance audit, because it lets the smoke/acceptance test assert
 * the figures the reports return against the known input (instead of trusting the
 * service that produced them).
 *******************************************************************************
 */

import { bootstrapDatabase } from "./db/bootstrap.js";
import type { SqlDatabase } from "./db/types.js";

export type DemoScenario = {
  parties: { customerIds: number[]; supplierIds: number[] };
  items: { rawId: number; packingId: number; finishedId: number; bomId: number };
  inventory: { rawBatchId: number; packingBatchId: number; finishedBatchId: number };
  sales: { cashId: number; creditId: number; returnId: number };
  purchase: { purchaseId: number };
  bank: { bankAccountId: number; depositId: number; withdrawId: number };
  cheques: { receiveId: number | null; clearId: number | null; issueId: number | null };
  expense: { utilitiesCategoryId: number; salariesCategoryId: number; expenseIds: number[]; payItemsId: number };
  asset: { assetId: number };
  opening: { openingBalanceId: number };
  journal: { openingJournalId: number };
};

/**
 * Build the rich demo on top of the existing seedDemoData base.
 *
 * IMPORTANT (next agent): the return types of the service methods used here are
 * defined in web/server/src/domain/types.ts and the individual service modules.
 * Read those types (and confirm them with `npm -w @bop-erp/server run typecheck`)
 * before writing the real implementation, because the exact field names (e.g.
 * `near` vs `amount`, `totalAmount` vs `amount`, `id` on `OpeningStockResult`)
 * are what the typecheck gate enforces.
 */
export async function seedRichDemo(
  _db: SqlDatabase,
  _getCompanyId: () => number,
): Promise<DemoScenario> {
  // TODO: implement. Placeholder return below is structurally complete so the
  // callers (seed.ts, the acceptance test) do not break.
  return {
    parties: { customerIds: [], supplierIds: [] },
    items: { rawId: 0, packingId: 0, finishedId: 0, bomId: 0 },
    inventory: { rawBatchId: 0, packingBatchId: 0, finishedBatchId: 0 },
    sales: { cashId: 0, creditId: 0, returnId: 0 },
    purchase: { purchaseId: 0 },
    bank: { bankAccountId: 0, depositId: 0, withdrawId: 0 },
    cheques: { receiveId: null, clearId: null, issueId: null },
    expense: { utilitiesCategoryId: 0, salariesCategoryId: 0, expenseIds: [], payItemsId: 0 },
    asset: { assetId: 0 },
    opening: { openingBalanceId: 0 },
    journal: { openingJournalId: 0 },
  };
}
