import type { Row, SqlDatabase } from "../db/types.js";
import { formatDayMonthYear } from "../domain/dateValidation.js";
import { SystemAccountCodes, type ItemType, type PartyType } from "../domain/enums.js";
import { Decimal, round2, sideOf, toStorage } from "../domain/money.js";
import { PartyRepository, type PartyRow } from "../repositories/partyRepository.js";
import { SystemAccountResolver } from "../repositories/systemAccounts.js";
import {
  AccountingService,
  type DateRangeOptions,
  type TrialBalanceRow,
} from "./accountingService.js";
import { layoutTrialBalance } from "./trialBalanceLayout.js";
import type { PlFaceLine } from "./plFace.js";
import { bsFaceLines, type BsFace } from "./bsFace.js";

export interface TrialBalanceResult {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

/**
 * First day of the books this system reports on. Anything dated 31 Oct 2026 or
 * earlier is opening stock, never consumption — a consumption report cannot be
 * asked to show it, whatever period is requested.
 */
export const CONSUMPTION_CUTOVER_DATE = "2026-11-01";

/** Inventory account code → the item type whose stock it holds. */
const INVENTORY_ITEM_TYPE_BY_CODE: Record<string, ItemType> = {
  [SystemAccountCodes.INVENTORY_RAW_MATERIALS]: "RAW_MATERIAL",
  [SystemAccountCodes.INVENTORY_PACKING_MATERIALS]: "PACKING_MATERIAL",
  [SystemAccountCodes.INVENTORY_FINISHED_GOODS]: "FINISHED_GOOD",
};

export interface ProfitAndLossResult {
  revenue: number;
  expenses: number;
  netProfit: number;
}

export interface BalanceSheetResult {
  assets: number;
  liabilities: number;
  equity: number;
  netProfit: number;
  balanced: boolean;
}

/**
 * One inventory account in the periodic-consumption report: what was on hand at
 * the start, what came in, what the count says is left, and the difference.
 */
export interface MaterialsConsumptionRow {
  itemType: ItemType | "TOTAL";
  /** Inventory balance before `from` (what the books carried in). */
  opening: number;
  /** Purchase-invoice debits dated on/after `from`. */
  purchases: number;
  /** Other debits (stock returned from reversed production orders, adjustments). */
  otherIn: number;
  /** Physical stock value right now — the closing figure. Null when the report ends in the past. */
  counted: number | null;
  /** opening + purchases + otherIn − closing. */
  consumed: number;
  /**
   * The stock-in effect of manufacturing entries posted after the period end
   * for orders dated inside it. Reopening and repacking an old order changes
   * this, so the formula reflects the edit without moving the whole history.
   */
  manufacturingEdits: number;
  /** What the inventory account says is left, for comparison with `counted`. */
  bookClosing: number;
  /** bookClosing − counted: how far the ledger has drifted from the shelf. Null when the report ends in the past. */
  difference: number | null;
}

export interface MaterialsConsumptionResult {
  from: string | null;
  /** Report end. Null means the report runs to today and closes on the count. */
  to: string | null;
  rows: MaterialsConsumptionRow[];
  total: MaterialsConsumptionRow;
}

/** One party's ledger with its closing balance, for the all-parties report. */
export interface PartyLedgerWithBalance {
  partyId: number;
  code: string;
  name: string;
  partyType: string;
  entries: LedgerEntry[];
  /** Closing balance: the last entry's running balance, else zero. */
  closingBalance: number;
}

export interface AllPartyLedgersResult {
  parties: PartyLedgerWithBalance[];
  /** Sum of every party's closing balance. */
  grandTotal: number;
}

/** One product a party bought, summed across all its sale invoices. */
export interface PartyProductRow {
  itemId: number;
  itemName: string;
  /** Total spent on this product (net of discounts and tax, as invoiced). */
  value: number;
}

/** One party's product purchases inside the party-product-sales report. */
export interface PartyProductSalesParty {
  partyId: number;
  code: string;
  name: string;
  products: PartyProductRow[];
  /** Sum of every product's value for this party. */
  total: number;
}

export interface PartyProductSalesResult {
  parties: PartyProductSalesParty[];
  grandTotal: number;
}

export interface LedgerEntry {
  date: string;
  voucherNumber: string;
  voucherType: string;
  description: string | null;
  notes: string | null;
  debit: number;
  credit: number;
  balance: number;
  /** Invoice already settled at creation (cash/bank/cheque): shown, not owed. */
  settled?: boolean;
  /** Dated before the party's opening date: shown, but the balance ignores it. */
  beforeOpening?: boolean;
}

/** Which report a party's closing balance belongs on. */
export type PartyBalanceSide = "PAYABLE" | "RECEIVABLE" | "ZERO";

/** One party's sub-ledger balance, for the Chart of Accounts. */
export interface PartyBalanceRow {
  partyId: number;
  /**
   * Control account the sub-ledger sits under, chosen by balance direction
   * (asset when the party owes us, liability when we owe them), or 0 for a
   * settled party — the page lists those under "Balanced Parties".
   */
  accountId: number;
  code: string;
  name: string;
  partyType: string;
  isActive: number;
  /** Opening balance for the requested period, debit-positive. */
  opening: number;
  /** Debits / credits posted inside the requested period. */
  debit: number;
  credit: number;
  /** Closing balance, debit-positive (what the party owes us). */
  balance: number;
  /** Direction of the closing balance: the payables / receivables split. */
  side: PartyBalanceSide;
  /** A customer in credit (prepaid) or a supplier in debit (we prepaid). */
  advance: boolean;
}

export function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export class ReportService {
  private readonly accounting: AccountingService;
  private readonly parties: PartyRepository;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.accounting = new AccountingService(db, companyId);
    this.parties = new PartyRepository(db);
  }

  /**
   * Totals come from the **closing** columns so a scoped report still balances
   * (opening + period movement), while `rows[].debit/credit` remain the
   * movement inside the requested period.
   */
  async trialBalance(opts: DateRangeOptions = {}): Promise<TrialBalanceResult> {
    const rows = await this.accounting.getTrialBalance(this.companyId, opts);
    return this.trialBalanceFrom(rows, opts.from ?? null, opts.to || null);
  }

  /** Trial balance from rows another report call already fetched. */
  async trialBalanceFrom(
    rows: TrialBalanceRow[],
    from: string | null = null,
    to: string | null = null,
  ): Promise<TrialBalanceResult> {
    await this.attachInventoryTags(rows, from, to);
    const totalDebit = rows.reduce((acc, r) => acc.plus(r.closingDebit), new Decimal(0));
    const totalCredit = rows.reduce((acc, r) => acc.plus(r.closingCredit), new Decimal(0));
    return {
      rows,
      totalDebit: toStorage(totalDebit),
      totalCredit: toStorage(totalCredit),
      balanced: totalDebit.minus(totalCredit).abs().lessThan(new Decimal("0.01")),
    };
  }

  /**
   * Attach the per-tag stock breakdown to the three inventory accounts. Tag
   * membership is replayed from item_tag_history as at the report end, so a
   * past report shows the tags an item carried then. The value uses the
   * historical quantity but the batch's current unit cost (costs are not
   * versioned). Memo data only: account balances and totals are untouched.
   */
  private async attachInventoryTags(
    rows: TrialBalanceRow[],
    from: string | null,
    to: string | null,
  ): Promise<void> {
    const inventoryRows = rows.filter((row) => INVENTORY_ITEM_TYPE_BY_CODE[row.accountCode]);
    if (inventoryRows.length === 0) return;

    const values = await this.inventoryTagValues(to);
    const byType = new Map<string, Map<string, number>>();
    for (const row of values) {
      const perTag = byType.get(row.item_type) ?? new Map<string, number>();
      perTag.set(row.tag ?? "Untagged", toStorage(row.value));
      byType.set(row.item_type, perTag);
    }

    for (const row of inventoryRows) {
      const itemType = INVENTORY_ITEM_TYPE_BY_CODE[row.accountCode];
      // Finished goods show only what the invoices sold — no tag split, no count.
      if (!itemType || itemType === "FINISHED_GOOD") continue;
      const perTag = byType.get(itemType);
      if (!perTag) continue;
      row.tagBreakdown = [...perTag.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => {
          if (a.name === "Untagged") return 1;
          if (b.name === "Untagged") return -1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        });
    }

    // Finished goods report one figure: what the sales invoices sold. It is
    // built from the invoices themselves, so a sale that never relieved stock
    // still counts.
    const fgRow = inventoryRows.find(
      (row) => INVENTORY_ITEM_TYPE_BY_CODE[row.accountCode] === "FINISHED_GOOD",
    );
    if (fgRow) {
      fgRow.soldValue = await this.soldFinishedGoods(to);
    }

    // Raw and packing material get the mirror treatment: what manufacturing
    // has already taken out of the account, and what is still in the store.
    for (const row of inventoryRows) {
      const itemType = INVENTORY_ITEM_TYPE_BY_CODE[row.accountCode];
      if (itemType !== "RAW_MATERIAL" && itemType !== "PACKING_MATERIAL") continue;
      row.usedValue = await this.issuedToProduction(row.accountId, to);
    }

    // The periodic consumption (opening + purchases − closing) beside the posted
    // one. With a date range the closing is the ledger balance at `to`; without
    // a range it is today's count.
    const periodic = await this.materialsConsumption(from, to);
    for (const row of inventoryRows) {
      const itemType = INVENTORY_ITEM_TYPE_BY_CODE[row.accountCode];
      if (itemType !== "RAW_MATERIAL" && itemType !== "PACKING_MATERIAL") continue;
      const line = periodic.rows.find((candidate) => candidate.itemType === itemType);
      row.consumedValue = line?.consumed ?? 0;
      row.consumedOpening = line?.opening ?? 0;
      // The closing the consumption was measured against: the count on a live
      // report, the inventory account on a dated one.
      row.consumedClosing = line == null ? 0 : line.counted ?? line.bookClosing;
    }

    // What is behind each figure but carries no cost, so it values at zero.
    for (const row of inventoryRows) {
      const itemType = INVENTORY_ITEM_TYPE_BY_CODE[row.accountCode];
      if (!itemType || itemType === "FINISHED_GOOD") continue;
      row.unpricedItems = await this.unpricedStockItems(itemType);
    }
  }

  /** Items held in the store whose every batch has no cost, so they value at zero. */
  private async unpricedStockItems(
    itemType: ItemType,
  ): Promise<Array<{ name: string; quantity: number }>> {
    return this.db.all<{ name: string; quantity: number }>(
      `SELECT i.item_name AS name, SUM(sb.quantity_in_stock) AS quantity
         FROM stock_batches sb
         JOIN items i ON i.id = sb.item_id
        WHERE sb.is_active = 1 AND i.is_active = 1 AND i.company_id = ?
          AND i.item_type = ?
          AND sb.quantity_in_stock > 0
          AND sb.purchase_price = 0
          AND (sb.raw_unit_cost + sb.packing_unit_cost) = 0
        GROUP BY i.id, i.item_name
        ORDER BY quantity DESC`,
      [this.companyId, itemType],
    );
  }

  /**
   * Material taken out of an inventory account by manufacturing production, as
   * at `to`. Stock has no issue movements in this dataset, so the manufacturing
   * vouchers are the only record of what was consumed.
   */
  private async issuedToProduction(accountId: number, to: string | null): Promise<number> {
    const row = await this.db.get<{ value: number }>(
      `SELECT COALESCE(SUM(l.credit), 0) AS value
         FROM journal_entry_lines l
         JOIN journal_entries je ON je.id = l.journal_entry_id
        WHERE l.account_id = ? AND je.voucher_type = 'MANUFACTURING'
          ${to ? "AND date(je.entry_date) <= date(?)" : ""}`,
      to ? [accountId, to] : [accountId],
    );
    return toStorage(row?.value ?? 0);
  }

  /**
   * Value of every finished good sold as at `to`, taken from the invoices:
   * each sales-invoice line contributes its own quantity and line total. That
   * is what the goods were billed at, so it does not depend on the posting
   * code having relieved stock or on how the batches are costed.
   */
  private async soldFinishedGoods(to: string | null): Promise<number> {
    const row = await this.db.get<{ value: number }>(
      `SELECT SUM(sii.line_total) AS value
         FROM sales_invoice_items sii
         JOIN sales_invoices si ON si.id = sii.invoice_id
         JOIN items it ON it.id = sii.item_id
        WHERE it.item_type = 'FINISHED_GOOD' AND it.company_id = ?
          ${to ? "AND date(si.invoice_date) <= date(?)" : ""}`,
      to ? [this.companyId, to] : [this.companyId],
    );
    return toStorage(row?.value ?? 0);
  }

  /** Stock value by item type and tag, as at `to` (null = current stock). */
  private async inventoryTagValues(
    to: string | null,
  ): Promise<Array<{ item_type: string; tag: string | null; value: number }>> {
    if (to === null) {
      return this.db.all(
        `SELECT i.item_type, t.name AS tag,
                SUM(sb.quantity_in_stock *
                    CASE WHEN (sb.raw_unit_cost + sb.packing_unit_cost) > 0
                         THEN sb.raw_unit_cost + sb.packing_unit_cost
                         ELSE sb.purchase_price END) AS value
           FROM stock_batches sb
           JOIN items i ON i.id = sb.item_id
           LEFT JOIN item_tag_links l ON l.item_id = i.id
           LEFT JOIN item_tags t ON t.id = l.tag_id
          WHERE sb.is_active = 1 AND i.is_active = 1 AND i.company_id = ?
            AND sb.quantity_in_stock > 0
          GROUP BY i.item_type, t.id`,
        [this.companyId],
      );
    }

    return this.db.all(
      `WITH latest AS (
         SELECT h.item_id, h.tag_id, h.action,
                ROW_NUMBER() OVER (PARTITION BY h.item_id, h.tag_id
                                   ORDER BY h.changed_at DESC, h.id DESC) AS rn
           FROM item_tag_history h
          WHERE date(h.changed_at) <= date(?)
       ),
       membership AS (
         SELECT item_id, tag_id FROM latest WHERE rn = 1 AND action = 'ADD'
       ),
       qty AS (
         SELECT sb.item_id,
                CASE
                  WHEN EXISTS (SELECT 1 FROM stock_movements m0 WHERE m0.batch_id = sb.id)
                    THEN MAX(0, COALESCE((SELECT SUM(m.quantity)
                                            FROM stock_movements m
                                           WHERE m.batch_id = sb.id
                                             AND date(m.movement_date) <= date(?)), 0))
                  WHEN date(sb.received_date) <= date(?) THEN MAX(0, sb.quantity_in_stock)
                  ELSE 0
                END AS quantity,
                CASE WHEN (sb.raw_unit_cost + sb.packing_unit_cost) > 0
                     THEN sb.raw_unit_cost + sb.packing_unit_cost
                     ELSE sb.purchase_price END AS unit_cost
           FROM stock_batches sb
          WHERE sb.is_active = 1
       )
       SELECT i.item_type, t.name AS tag, SUM(q.quantity * q.unit_cost) AS value
         FROM qty q
         JOIN items i ON i.id = q.item_id
         LEFT JOIN membership m ON m.item_id = i.id
         LEFT JOIN item_tags t ON t.id = m.tag_id
        WHERE i.is_active = 1 AND i.company_id = ?
        GROUP BY i.item_type, t.id`,
      [to, to, to, this.companyId],
    );
  }

  /** Revenue and expenses for the period (P&L is a period statement). */
  async profitAndLoss(opts: DateRangeOptions = {}): Promise<ProfitAndLossResult> {
    const rows = await this.accounting.getTrialBalance(this.companyId, opts);
    return this.profitAndLossFrom(rows);
  }

  /** Revenue and expenses from rows another report call already fetched. */
  profitAndLossFrom(rows: readonly TrialBalanceRow[]): ProfitAndLossResult {
    let revenue = new Decimal(0);
    let expenses = new Decimal(0);
    for (const row of rows) {
      if (row.accountType === "REVENUE") revenue = revenue.plus(row.credit).minus(row.debit);
      if (row.accountType === "EXPENSE") expenses = expenses.plus(row.debit).minus(row.credit);
    }
    return {
      revenue: toStorage(revenue),
      expenses: toStorage(expenses),
      netProfit: toStorage(revenue.minus(expenses)),
    };
  }

  /**
   * Position as at a date (cumulative, so the *closing* columns are used).
   * Without `asAt` this is the position as of everything posted.
   */
  async balanceSheet(asAt?: string | null): Promise<BalanceSheetResult> {
    const rows = await this.accounting.getTrialBalance(this.companyId, { to: asAt ?? null });
    return this.balanceSheetFrom(rows);
  }

  /** Position as at a date, from rows another report call already fetched. */
  balanceSheetFrom(rows: readonly TrialBalanceRow[]): BalanceSheetResult {
    let assets = new Decimal(0);
    let liabilities = new Decimal(0);
    let equity = new Decimal(0);
    let netProfit = new Decimal(0);
    for (const row of rows) {
      const debit = new Decimal(row.closingDebit);
      const credit = new Decimal(row.closingCredit);
      switch (row.accountType) {
        case "ASSET":
          assets = assets.plus(debit).minus(credit);
          break;
        case "LIABILITY":
          liabilities = liabilities.plus(credit).minus(debit);
          break;
        case "EQUITY":
          equity = equity.plus(credit).minus(debit);
          break;
        case "REVENUE":
          netProfit = netProfit.plus(credit).minus(debit);
          break;
        case "EXPENSE":
          netProfit = netProfit.minus(debit).plus(credit);
          break;
      }
    }
    const equityWithProfit = equity.plus(netProfit);
    return {
      assets: toStorage(assets),
      liabilities: toStorage(liabilities),
      equity: toStorage(equityWithProfit),
      netProfit: toStorage(netProfit),
      balanced: assets
        .minus(liabilities)
        .minus(equityWithProfit)
        .abs()
        .lessThan(new Decimal("0.01")),
    };
  }

  /**
   * Materials consumed on the old software's periodic basis:
   * `opening + purchases − closing`.
   *
   * Without `to` the closing figure is the physical count (today's stock), so a
   * wrong BOM or an unpriced item cannot move the number — only a wrong count
   * can. With `to` the closing figure is the inventory account's balance at that
   * date, because a past count does not exist; the answer is then what the books
   * say was consumed in the period.
   *
   * The books begin on 1 November 2026. Everything dated 31 October or earlier
   * is opening stock: the period can never start before the cutover, so no
   * consumption figure ever includes a pre-November entry.
   */
  async materialsConsumption(
    from?: string | null,
    to?: string | null,
  ): Promise<MaterialsConsumptionResult> {
    const start =
      from && from > CONSUMPTION_CUTOVER_DATE ? from : CONSUMPTION_CUTOVER_DATE;
    const end = to || null;

    // A window that closes before the books begin has nothing to report.
    if (end !== null && end < CONSUMPTION_CUTOVER_DATE) {
      const empty = (
        itemType: MaterialsConsumptionRow["itemType"],
      ): MaterialsConsumptionRow => ({
        itemType,
        opening: 0,
        purchases: 0,
        otherIn: 0,
        counted: null,
        consumed: 0,
        manufacturingEdits: 0,
        bookClosing: 0,
        difference: null,
      });
      return {
        from: start,
        to: end,
        rows: [empty("RAW_MATERIAL"), empty("PACKING_MATERIAL")],
        total: empty("TOTAL"),
      };
    }

    const ledger = await this.db.all<{
      account_code: string;
      opening: number;
      purchases: number;
      other_in: number;
      correction_in: number;
      closing: number;
    }>(
      `SELECT a.account_code,
              ROUND(SUM(CASE WHEN je.entry_date < ? THEN jel.debit - jel.credit ELSE 0 END), 2) opening,
              ROUND(SUM(CASE WHEN je.entry_date >= ? AND (? IS NULL OR je.entry_date <= ?)
                              AND je.voucher_type = 'PURCHASE' THEN jel.debit ELSE 0 END), 2) purchases,
              -- A stock correction restates the account to the count; counting it
              -- as stock coming in would inflate consumption by its own amount.
              ROUND(SUM(CASE WHEN je.entry_date >= ? AND (? IS NULL OR je.entry_date <= ?)
                              AND je.voucher_type <> 'PURCHASE'
                              AND COALESCE(je.reference_no, '') NOT LIKE '%-STOCK-CORR'
                        THEN jel.debit ELSE 0 END), 2) other_in,
              ROUND(SUM(CASE WHEN je.entry_date >= ? AND (? IS NULL OR je.entry_date <= ?)
                              AND je.voucher_type <> 'PURCHASE'
                              AND COALESCE(je.reference_no, '') LIKE '%-STOCK-CORR'
                        THEN jel.debit ELSE 0 END), 2) correction_in,
              ROUND(SUM(CASE WHEN (? IS NULL OR je.entry_date <= ?)
                        THEN jel.debit - jel.credit ELSE 0 END), 2) closing
       FROM journal_entry_lines jel
       JOIN accounts a ON a.id = jel.account_id
       JOIN journal_entries je ON je.id = jel.journal_entry_id
       WHERE je.company_id = ? AND a.account_code IN (?, ?)
       GROUP BY a.id`,
      [
        // opening
        start,
        // purchases
        start,
        end,
        end,
        // other_in
        start,
        end,
        end,
        // correction_in
        start,
        end,
        end,
        // closing
        end,
        end,
        this.companyId,
        SystemAccountCodes.INVENTORY_RAW_MATERIALS,
        SystemAccountCodes.INVENTORY_PACKING_MATERIALS,
      ],
    );

    // A past count only exists for a report that ends today.
    const counted = new Map<string, number>();
    for (const row of end
      ? []
      : await this.db.all<{ item_type: string; counted: number }>(
          `SELECT i.item_type,
                  ROUND(SUM(sb.quantity_in_stock
                            * COALESCE(NULLIF(sb.purchase_price, 0), i.purchase_price, 0)), 2) counted
           FROM stock_batches sb
           JOIN items i ON i.id = sb.item_id
           WHERE i.company_id = ? AND sb.quantity_in_stock > 0 AND sb.is_active = 1
             AND i.item_type IN ('RAW_MATERIAL', 'PACKING_MATERIAL')
           GROUP BY i.item_type`,
          [this.companyId],
        )) {
      counted.set(row.item_type, Number(row.counted));
    }

    const edits = end ? await this.manufacturingEdits(start, end) : new Map<string, number>();

    const rows: MaterialsConsumptionRow[] = (
      [
        [SystemAccountCodes.INVENTORY_RAW_MATERIALS, "RAW_MATERIAL"],
        [SystemAccountCodes.INVENTORY_PACKING_MATERIALS, "PACKING_MATERIAL"],
      ] as const
    ).map(([code, itemType]) => {
      const found = ledger.find((row) => row.account_code === code);
      const opening = Number(found?.opening ?? 0);
      const purchases = Number(found?.purchases ?? 0);
      // A stock correction is a restatement, not material bought. When the
      // report closes on the count it must stay out of "stock in", or the
      // correction would inflate the consumption by its own amount. When it
      // closes on the ledger it has to be in, because the closing balance
      // contains it and the row must add up.
      const otherIn = toStorage(
        round2(Number(found?.other_in ?? 0) + (end ? Number(found?.correction_in ?? 0) : 0)),
      );
      const bookClosing = toStorage(round2(Number(found?.closing ?? 0)));
      const closing = end ? bookClosing : counted.get(itemType) ?? 0;
      return {
        itemType,
        opening,
        purchases,
        otherIn,
        counted: end ? null : closing,
        consumed: toStorage(
          round2(
            opening +
              purchases +
              Number(otherIn) +
              Number(edits.get(itemType) ?? 0) -
              closing,
          ),
        ),
        manufacturingEdits: toStorage(round2(edits.get(itemType) ?? 0)),
        bookClosing,
        difference: end ? null : toStorage(round2(bookClosing - closing)),
      };
    });

    const sum = (pick: (row: MaterialsConsumptionRow) => number): number =>
      toStorage(round2(rows.reduce((acc, row) => acc + pick(row), 0)));
    const total: MaterialsConsumptionRow = {
      itemType: "TOTAL",
      opening: sum((row) => row.opening),
      purchases: sum((row) => row.purchases),
      otherIn: sum((row) => row.otherIn),
      counted: end ? null : sum((row) => row.counted ?? 0),
      consumed: sum((row) => row.consumed),
      manufacturingEdits: sum((row) => row.manufacturingEdits),
      bookClosing: sum((row) => row.bookClosing),
      difference: end ? null : sum((row) => row.difference ?? 0),
    };

    return { from: start, to: end, rows, total };
  }

  /**
   * The edit delta for orders dated in the period: the net stock-in effect of
   * the first reversal posted after the period end and everything after it.
   * The original posting stays where it was, so this adds only what the
   * reopen/repack changed, not the whole consumption again.
   */
  private async manufacturingEdits(
    from: string,
    to: string,
  ): Promise<Map<string, number>> {
    const rows = await this.db.all<{ account_code: string; adjustment: number }>(
      `SELECT a.account_code, ROUND(SUM(jel.credit - jel.debit), 2) adjustment
         FROM journal_entry_lines jel
         JOIN accounts a ON a.id = jel.account_id
         JOIN journal_entries je ON je.id = jel.journal_entry_id
         JOIN (
           SELECT 'production_orders' AS source_table, id AS source_id, manufacturing_date
             FROM production_orders
            WHERE company_id = ?
           UNION ALL
           SELECT 'packing_orders', id, manufacturing_date
             FROM packing_orders
            WHERE company_id = ?
         ) o ON o.source_table = je.source_table AND o.source_id = je.source_id
        WHERE je.company_id = ?
          AND a.account_code IN (?, ?)
          AND o.manufacturing_date >= ?
          AND o.manufacturing_date <= ?
          AND je.entry_date > ?
          AND je.id >= (
            SELECT MIN(rev.id) FROM journal_entries rev
             WHERE rev.source_table = je.source_table
               AND rev.source_id = je.source_id
               AND rev.narration LIKE 'Reversal%'
               AND rev.entry_date > ?
          )
        GROUP BY a.account_code`,
      [
        this.companyId,
        this.companyId,
        this.companyId,
        SystemAccountCodes.INVENTORY_RAW_MATERIALS,
        SystemAccountCodes.INVENTORY_PACKING_MATERIALS,
        from,
        to,
        to,
        to,
      ],
    );
    const map = new Map<string, number>();
    for (const row of rows) {
      const itemType =
        row.account_code === SystemAccountCodes.INVENTORY_RAW_MATERIALS
          ? "RAW_MATERIAL"
          : "PACKING_MATERIAL";
      map.set(itemType, Number(row.adjustment));
    }
    return map;
  }

  /**
   * Transaction ledger for a party, with a running balance.
   *
   * The party's opening balance is carried forward from its opening date: the
   * OPENING journal lines themselves are excluded (the stored opening already
   * represents them, so re-saving or moving the date cannot double-count) and
   * one synthetic "Opening balance" row seeds the balance. Invoices dated
   * before that date are still listed but never move the balance; on/after the
   * date counts. Payments, receipts and exports inherit this.
   */
  async partyLedger(partyId: number, from?: string, to?: string): Promise<LedgerEntry[]> {
    const party = await this.parties.requireById(partyId);
    const openingDate = await this.partyOpeningDate(party);
    const openingBalance = new Decimal(Number(party.opening_balance ?? 0));

    let sql = `
      SELECT je.entry_date AS date, je.id AS entry_id, je.voucher_number, je.voucher_type,
             COALESCE(jel.description, je.narration) AS description,
             COALESCE(si.notes, pi.notes, pay.notes, rc.notes) AS notes,
             jel.debit, jel.credit,
             CASE WHEN (si.payment_type IS NOT NULL AND si.payment_type <> 'CREDIT')
                    OR (pi.payment_type IS NOT NULL AND pi.payment_type <> 'CREDIT')
                    OR (ex.status = 'PAID' AND ex.settlement_journal_entry_id IS NULL)
                  THEN 1 ELSE 0 END AS settled
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      LEFT JOIN sales_invoices si
             ON je.source_table = 'sales_invoices' AND si.id = je.source_id
      LEFT JOIN purchase_invoices pi
             ON je.source_table = 'purchase_invoices' AND pi.id = je.source_id
      LEFT JOIN expenses ex
             ON je.source_table = 'expenses' AND ex.id = je.source_id
      -- Payment/receipt entries carry no source link; their voucher number is
      -- unique per company and type, so it is the join key.
      LEFT JOIN payments pay
             ON je.voucher_type = 'PAYMENT' AND pay.company_id = je.company_id
            AND pay.voucher_number = je.voucher_number
      LEFT JOIN receipts rc
             ON je.voucher_type = 'RECEIPT' AND rc.company_id = je.company_id
            AND rc.voucher_number = je.voucher_number
      WHERE jel.party_id = ? AND je.is_posted = 1
        AND NOT (je.voucher_type = 'OPENING' AND je.source_table = 'parties')`;
    const params: Array<string | number> = [partyId];
    // A requested start later than the opening date still needs the lines in
    // between, so the opening row can carry their net balance into the window.
    if (from && openingDate) {
      sql += " AND je.entry_date >= ?";
      params.push(from < openingDate ? from : openingDate);
    } else if (from) {
      sql += " AND je.entry_date >= ?";
      params.push(from);
    }
    if (to) {
      sql += " AND je.entry_date <= ?";
      params.push(to);
    }
    sql += " ORDER BY je.entry_date, je.id";
    const rows = await this.db.all<Row>(sql, params);
    const inWindow = rows.filter((row) => !from || String(row.date ?? "") >= from);

    let openingRow: Row | null = null;
    if (openingDate) {
      let carried = openingBalance;
      let openingRowDate = openingDate;
      if (from && from > openingDate) {
        // Fold everything between the opening date and the window start into
        // the opening row so a period view still starts at the right balance.
        for (const row of rows) {
          if (String(row.date ?? "") >= from) break;
          if (Number(row.settled ?? 0) === 0) {
            carried = carried
              .plus(new Decimal(Number(row.debit ?? 0)))
              .minus(new Decimal(Number(row.credit ?? 0)));
          }
        }
        openingRowDate = from;
      }
      openingRow = {
        date: openingRowDate,
        entry_id: 0,
        voucher_number: "",
        voucher_type: "OPENING",
        description: "Opening balance",
        notes: null,
        debit: toStorage(carried.greaterThan(0) ? carried : new Decimal(0)),
        credit: toStorage(carried.lessThan(0) ? carried.abs() : new Decimal(0)),
        settled: 0,
        synthetic: 1,
      };
    }

    const combined: Row[] = openingRow ? [openingRow, ...inWindow] : inWindow;
    combined.sort((a, b) => {
      const dateA = String(a.date ?? "");
      const dateB = String(b.date ?? "");
      if (dateA !== dateB) return dateA < dateB ? -1 : 1;
      const syntheticA = Number(a.synthetic ?? 0);
      const syntheticB = Number(b.synthetic ?? 0);
      if (syntheticA !== syntheticB) return syntheticB - syntheticA;
      return Number(a.entry_id ?? 0) - Number(b.entry_id ?? 0);
    });
    return this.withRunningBalance(combined, { openingDate });
  }

  /**
   * The party's cutover date: the stored column, or — for openings posted
   * before this feature existed — the date of its latest OPENING entry.
   */
  private async partyOpeningDate(party: PartyRow): Promise<string | null> {
    if (party.opening_balance_date) return String(party.opening_balance_date);
    if (Number(party.opening_balance ?? 0) === 0) return null;
    const row = await this.db.get<{ entry_date: string | null }>(
      `SELECT MAX(je.entry_date) AS entry_date
         FROM journal_entry_lines jel
         JOIN journal_entries je ON je.id = jel.journal_entry_id
        WHERE jel.party_id = ? AND je.is_posted = 1
          AND je.voucher_type = 'OPENING' AND je.source_table = 'parties'`,
      [party.id],
    );
    const fallback = String(party.created_at ?? "").slice(0, 10);
    return row?.entry_date ?? (fallback || null);
  }

  /**
   * Closing balance of every party, so the Chart of Accounts can list the
   * sub-ledger under Accounts Receivable / Payable. Three queries total (every
   * party, every party line, the OPENING cutover dates) and the same rules as
   * partyLedger(): the stored opening seeds the balance, OPENING entries are
   * excluded, and settled (cash/bank invoice or paid expense) or pre-opening
   * lines do not move it.
   *
   * Placement follows the balance, not the party type: debit (party owes us,
   * or we pre-paid a supplier) is an asset, credit (we owe them — a customer
   * advance, or a supplier payable) is a liability, and a zero balance gets
   * accountId 0.
   *
   * With `from` / `to` the same rules become a period report: lines before
   * `from` fold into the opening balance, lines up to `to` into the period,
   * and the stored opening counts as a line on the party's cutover date.
   */
  async partyBalances(from?: string, to?: string): Promise<PartyBalanceRow[]> {
    const parties = await this.parties.list(this.companyId, { activeOnly: false });
    if (parties.length === 0) return [];

    const resolver = new SystemAccountResolver(this.db, this.companyId);
    const receivableId = await resolver.idFor(SystemAccountCodes.ACCOUNTS_RECEIVABLE);
    const payableId = await resolver.idFor(SystemAccountCodes.ACCOUNTS_PAYABLE);
    // 1550002 is imported, not seeded: tolerate its absence by leaving a
    // supplier advance on the payable side, as it was before.
    const advanceAccount = await this.db.get<{ id: number }>(
      "SELECT id FROM accounts WHERE account_code = '1550002' AND company_id = ?",
      [this.companyId],
    );
    const advanceToSuppliersId = advanceAccount?.id ?? payableId;

    const lines = await this.db.all<{
      party_id: number;
      date: string;
      debit: number;
      credit: number;
      settled: number;
    }>(
      `SELECT jel.party_id, je.entry_date AS date, jel.debit, jel.credit,
              CASE WHEN (si.payment_type IS NOT NULL AND si.payment_type <> 'CREDIT')
                     OR (pi.payment_type IS NOT NULL AND pi.payment_type <> 'CREDIT')
                     OR (ex.status = 'PAID' AND ex.settlement_journal_entry_id IS NULL)
                   THEN 1 ELSE 0 END AS settled
         FROM journal_entry_lines jel
         JOIN journal_entries je ON je.id = jel.journal_entry_id
         LEFT JOIN sales_invoices si
                ON je.source_table = 'sales_invoices' AND si.id = je.source_id
         LEFT JOIN purchase_invoices pi
                ON je.source_table = 'purchase_invoices' AND pi.id = je.source_id
         LEFT JOIN expenses ex
                ON je.source_table = 'expenses' AND ex.id = je.source_id
        WHERE jel.party_id IS NOT NULL AND je.is_posted = 1 AND je.company_id = ?
          AND NOT (je.voucher_type = 'OPENING' AND je.source_table = 'parties')`,
      [this.companyId],
    );
    const openDates = new Map(
      (
        await this.db.all<{ party_id: number; date: string }>(
          `SELECT jel.party_id, MAX(je.entry_date) AS date
             FROM journal_entry_lines jel
             JOIN journal_entries je ON je.id = jel.journal_entry_id
            WHERE je.is_posted = 1 AND je.company_id = ?
              AND je.voucher_type = 'OPENING' AND je.source_table = 'parties'
            GROUP BY jel.party_id`,
          [this.companyId],
        )
      ).map((row) => [Number(row.party_id), String(row.date)]),
    );

    const linesByParty = new Map<number, typeof lines>();
    for (const line of lines) {
      const key = Number(line.party_id);
      linesByParty.set(key, [...(linesByParty.get(key) ?? []), line]);
    }

    return parties.map((party) => {
      const stored = new Decimal(Number(party.opening_balance ?? 0));
      const openingDate =
        party.opening_balance_date ??
        (stored.isZero()
          ? null
          : openDates.get(party.id) ?? (String(party.created_at ?? "").slice(0, 10) || null));
      let opening = new Decimal(0);
      const period = { debit: new Decimal(0), credit: new Decimal(0) };

      const addPeriod = (signed: Decimal): void => {
        if (signed.isNegative()) period.credit = period.credit.plus(signed.abs());
        else period.debit = period.debit.plus(signed);
      };

      // The stored balance is a line dated at the party's cutover. A report
      // with no start date shows it as the opening, as the CoA always has.
      if (!from) {
        if (!to || openingDate === null || openingDate <= to) opening = opening.plus(stored);
      } else if (openingDate !== null && from > openingDate) {
        opening = opening.plus(stored);
      } else if (openingDate !== null && (!to || openingDate <= to)) {
        addPeriod(stored);
      }

      for (const line of linesByParty.get(party.id) ?? []) {
        if (Number(line.settled) === 1) continue;
        const date = String(line.date ?? "");
        if (openingDate !== null && date < openingDate) continue;
        const signed = new Decimal(Number(line.debit ?? 0)).minus(
          new Decimal(Number(line.credit ?? 0)),
        );
        if (!from) {
          addPeriod(signed);
        } else if (date < from) {
          opening = opening.plus(signed);
        } else if (!to || date <= to) {
          addPeriod(signed);
        }
      }

      const balance = opening.plus(period.debit).minus(period.credit);
      const side: PartyBalanceSide = balance.isZero()
        ? "ZERO"
        : balance.isNegative()
          ? "PAYABLE"
          : "RECEIVABLE";
      const accountId =
        side === "ZERO"
          ? 0
          : side === "PAYABLE"
            ? payableId
            : party.party_type === "SUPPLIER"
              ? advanceToSuppliersId
              : receivableId;
      return {
        partyId: party.id,
        accountId,
        code: party.code,
        name: party.name,
        partyType: party.party_type,
        isActive: party.is_active,
        opening: toStorage(opening),
        debit: toStorage(period.debit),
        credit: toStorage(period.credit),
        balance: toStorage(balance),
        side,
        advance:
          (party.party_type === "CUSTOMER" && side === "PAYABLE") ||
          (party.party_type === "SUPPLIER" && side === "RECEIVABLE"),
      };
    });
  }

  /**
   * Every active party's full ledger in one report: per party the entries and
   * closing balance, plus the grand total of all closing balances. Reuses
   * partyLedger() so the figures match the single-party report exactly. With
   * `showOpening` (off by default) the synthetic opening row is dropped and
   * balances are recomputed from zero, so the report shows period activity
   * only.
   */
  async allPartyLedgers(
    from?: string,
    to?: string,
    opts: { showOpening?: boolean; partyType?: PartyType } = {},
  ): Promise<AllPartyLedgersResult> {
    const parties = await this.parties.list(this.companyId, {
      activeOnly: true,
      type: opts.partyType,
    });
    const result: PartyLedgerWithBalance[] = [];
    let grandTotal = new Decimal(0);
    for (const party of parties) {
      const ledger = await this.partyLedger(party.id, from, to);
      const entries =
        opts.showOpening === true
          ? ledger
          : ledger.filter((entry) => entry.voucherType !== "OPENING");
      // Parties with nothing on their ledger carry no information here.
      if (entries.length === 0) continue;
      if (opts.showOpening !== true) {
        let balance = new Decimal(0);
        for (const entry of entries) {
          if (!entry.settled && !entry.beforeOpening) {
            balance = balance
              .plus(new Decimal(entry.debit))
              .minus(new Decimal(entry.credit));
          }
          entry.balance = toStorage(balance);
        }
      }
      const last = entries[entries.length - 1];
      if (!last) continue;
      const closing = new Decimal(last.balance);
      grandTotal = grandTotal.plus(closing);
      result.push({
        partyId: party.id,
        code: party.code,
        name: party.name,
        partyType: party.party_type,
        entries,
        closingBalance: toStorage(closing),
      });
    }
    return { parties: result, grandTotal: toStorage(grandTotal) };
  }

  /**
   * What every party bought: one row per product they appear on across all
   * their confirmed sale invoices, with the party's total spend and the grand
   * total. Repeated purchases of the same product collapse into one summed row.
   * Sales returns are netted in: they reduce the same party/product row, so a
   * product can carry a negative value when more came back than went out.
   */
  async partyProductSales(from?: string, to?: string): Promise<PartyProductSalesResult> {
    const salesParams: Array<string | number> = [this.companyId];
    let salesSql = `
      SELECT si.customer_id AS party_id, sii.item_id AS item_id,
             sii.line_total AS value
      FROM sales_invoice_items sii
      JOIN sales_invoices si ON si.id = sii.invoice_id
      WHERE si.company_id = ? AND si.status = 'CONFIRMED'`;
    if (from) {
      salesSql += " AND si.invoice_date >= ?";
      salesParams.push(from);
    }
    if (to) {
      salesSql += " AND si.invoice_date <= ?";
      salesParams.push(to);
    }

    // A return gives value back, so it enters the union negated.
    const returnParams: Array<string | number> = [this.companyId];
    let returnSql = `
      SELECT sr.party_id AS party_id, sri.item_id AS item_id,
             -sri.line_total AS value
      FROM sales_return_items sri
      JOIN sales_returns sr ON sr.id = sri.return_id
      WHERE sr.company_id = ?`;
    if (from) {
      returnSql += " AND sr.return_date >= ?";
      returnParams.push(from);
    }
    if (to) {
      returnSql += " AND sr.return_date <= ?";
      returnParams.push(to);
    }

    const sql = `
      SELECT p.id AS party_id, p.code AS party_code, p.name AS party_name,
             i.id AS item_id, i.item_name,
             SUM(lines.value) AS value
      FROM (${salesSql} UNION ALL ${returnSql}) lines
      JOIN parties p ON p.id = lines.party_id
      JOIN items i ON i.id = lines.item_id
      GROUP BY p.id, i.id ORDER BY p.name, p.code, i.item_name`;
    const rows = await this.db.all<Row>(sql, [...salesParams, ...returnParams]);

    const parties = new Map<number, PartyProductSalesParty>();
    let grandTotal = new Decimal(0);
    for (const row of rows) {
      const partyId = Number(row.party_id);
      let party = parties.get(partyId);
      if (!party) {
        party = {
          partyId,
          code: String(row.party_code ?? ""),
          name: String(row.party_name ?? ""),
          products: [],
          total: 0,
        };
        parties.set(partyId, party);
      }
      const value = new Decimal(Number(row.value ?? 0));
      party.products.push({
        itemId: Number(row.item_id),
        itemName: String(row.item_name ?? ""),
        value: toStorage(value),
      });
      party.total = toStorage(new Decimal(party.total).plus(value));
      grandTotal = grandTotal.plus(value);
    }
    return { parties: [...parties.values()], grandTotal: toStorage(grandTotal) };
  }

  /**
   * What every party supplied: one row per product across all their confirmed
   * purchase invoices, with the party's total spend and the grand total. The
   * mirror of partyProductSales() for the buying side. Purchase returns are
   * netted in: they reduce the same party/product row, so a product can carry a
   * negative value when more came back than went in.
   */
  async partyProductPurchases(from?: string, to?: string): Promise<PartyProductSalesResult> {
    const purchaseParams: Array<string | number> = [this.companyId];
    let purchaseSql = `
      SELECT pi.supplier_id AS party_id, pii.item_id AS item_id,
             pii.line_total AS value
      FROM purchase_invoice_items pii
      JOIN purchase_invoices pi ON pi.id = pii.invoice_id
      WHERE pi.company_id = ? AND pi.status = 'CONFIRMED'`;
    if (from) {
      purchaseSql += " AND pi.invoice_date >= ?";
      purchaseParams.push(from);
    }
    if (to) {
      purchaseSql += " AND pi.invoice_date <= ?";
      purchaseParams.push(to);
    }

    // A return gives value back, so it enters the union negated.
    const returnParams: Array<string | number> = [this.companyId];
    let returnSql = `
      SELECT pr.party_id AS party_id, pri.item_id AS item_id,
             -pri.line_total AS value
      FROM purchase_return_items pri
      JOIN purchase_returns pr ON pr.id = pri.return_id
      WHERE pr.company_id = ?`;
    if (from) {
      returnSql += " AND pr.return_date >= ?";
      returnParams.push(from);
    }
    if (to) {
      returnSql += " AND pr.return_date <= ?";
      returnParams.push(to);
    }

    const sql = `
      SELECT p.id AS party_id, p.code AS party_code, p.name AS party_name,
             i.id AS item_id, i.item_name,
             SUM(lines.value) AS value
      FROM (${purchaseSql} UNION ALL ${returnSql}) lines
      JOIN parties p ON p.id = lines.party_id
      JOIN items i ON i.id = lines.item_id
      GROUP BY p.id, i.id ORDER BY p.name, p.code, i.item_name`;
    const rows = await this.db.all<Row>(sql, [...purchaseParams, ...returnParams]);

    const parties = new Map<number, PartyProductSalesParty>();
    let grandTotal = new Decimal(0);
    for (const row of rows) {
      const partyId = Number(row.party_id);
      let party = parties.get(partyId);
      if (!party) {
        party = {
          partyId,
          code: String(row.party_code ?? ""),
          name: String(row.party_name ?? ""),
          products: [],
          total: 0,
        };
        parties.set(partyId, party);
      }
      const value = new Decimal(Number(row.value ?? 0));
      party.products.push({
        itemId: Number(row.item_id),
        itemName: String(row.item_name ?? ""),
        value: toStorage(value),
      });
      party.total = toStorage(new Decimal(party.total).plus(value));
      grandTotal = grandTotal.plus(value);
    }
    return { parties: [...parties.values()], grandTotal: toStorage(grandTotal) };
  }

  /** Cash book: every posted movement on the Cash in Hand account. */
  async cashBook(from?: string, to?: string): Promise<LedgerEntry[]> {
    let sql = `
      SELECT je.entry_date AS date, je.voucher_number, je.voucher_type,
             COALESCE(jel.description, je.narration) AS description,
             jel.debit, jel.credit
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      JOIN accounts a ON a.id = jel.account_id
      WHERE a.account_code = '1000' AND je.is_posted = 1`;
    const params: Array<string | number> = [];
    if (from) {
      sql += " AND je.entry_date >= ?";
      params.push(from);
    }
    if (to) {
      sql += " AND je.entry_date <= ?";
      params.push(to);
    }
    sql += " ORDER BY je.entry_date, je.id";
    return this.withRunningBalance(await this.db.all<Row>(sql, params));
  }

  private withRunningBalance(
    rows: Row[],
    opts: { openingDate?: string | null } = {},
  ): LedgerEntry[] {
    let balance = new Decimal(0);
    const openingDate = opts.openingDate ?? null;
    return rows.map((row) => {
      const debit = new Decimal(Number(row.debit ?? 0));
      const credit = new Decimal(Number(row.credit ?? 0));
      const settled = Number(row.settled ?? 0) === 1;
      const beforeOpening =
        openingDate !== null && String(row.date ?? "") < openingDate;
      // A settled invoice line (cash/bank/cheque) is informational only: it
      // must not move the running balance, which tracks what the party owes.
      // A line dated before the party's opening is likewise already reflected
      // in its opening balance.
      if (!settled && !beforeOpening) balance = balance.plus(debit).minus(credit);
      return {
        date: String(row.date ?? ""),
        voucherNumber: String(row.voucher_number ?? ""),
        voucherType: String(row.voucher_type ?? ""),
        description: row.description == null ? null : String(row.description),
        notes: row.notes == null ? null : String(row.notes),
        debit: toStorage(debit),
        credit: toStorage(credit),
        balance: toStorage(balance),
        settled,
        ...(beforeOpening ? { beforeOpening: true } : {}),
      };
    });
  }

  /**
   * Memo lines printed under an inventory account: one per tag, then the gap
   * between the tag total (stock, per batch) and the account's GL balance.
   * `label` applies the caller's escaping and indentation.
   */
  private inventoryMemoCsv(
    row: TrialBalanceRow,
    label: (text: string) => string,
  ): string[] {
    const line = (name: string, value: number): string =>
      ["", label(name), "", "", "", "", "", value.toFixed(2), ""].join(",");
    // Finished goods report one figure: what the invoices sold.
    if (row.soldValue != null) {
      return [line("↳ Sold FG (per invoices)", row.soldValue)];
    }
    const tags = row.tagBreakdown ?? [];
    if (tags.length === 0) return [];
    const stock = tags.reduce((total, tag) => total.plus(tag.value), new Decimal(0));
    return [
      ...tags.map((tag) => line(`↳ ${tag.name}`, tag.value)),
      line("Difference (stock - GL)", toStorage(stock.minus(row.closingDebit))),
    ];
  }

  /** CSV lines for the "Unpriced items" breakdown under an inventory account. */
  private unpricedCsvRows(
    row: TrialBalanceRow,
    label: (text: string) => string,
  ): string[] {
    const items = row.unpricedItems ?? [];
    if (items.length === 0) return [];
    const line = (name: string, qty: number): string =>
      ["", label(`Unpriced items (${items.length})`), "", "", "", "", "", "", ""].join(",");
    const itemLine = (item: { name: string; quantity: number }): string =>
      ["", label(`  ${item.name}`), "", "", "", "", "", item.quantity.toFixed(2), ""].join(",");
    return [
      line("", items.length),
      ...items.map(itemLine),
    ];
  }

  /**
   * Trial balance rendered as CSV for download/export, including the opening,
   * period and closing columns an accountant expects.
   */
  async trialBalanceCsv(opts: DateRangeOptions = {}): Promise<string> {
    const { rows, totalDebit, totalCredit } = await this.trialBalance(opts);
    const escape = csvEscape;
    const lines = [
      "Account Code,Account Name,Type,Opening Debit,Opening Credit,Debit,Credit,Closing Debit,Closing Credit",
    ];
    const hasMovement = (row: TrialBalanceRow): boolean =>
      row.openingDebit !== 0 ||
      row.openingCredit !== 0 ||
      row.debit !== 0 ||
      row.credit !== 0 ||
      row.closingDebit !== 0 ||
      row.closingCredit !== 0;
    for (const row of rows) {
      if (opts.showZero !== true && !hasMovement(row)) continue;
      lines.push(
        [
          escape(row.accountCode),
          escape(row.accountName),
          row.accountType,
          row.openingDebit.toFixed(2),
          row.openingCredit.toFixed(2),
          row.debit.toFixed(2),
          row.credit.toFixed(2),
          row.closingDebit.toFixed(2),
          row.closingCredit.toFixed(2),
        ].join(","),
      );
      if (opts.showUnpriced === true) {
        lines.push(...this.inventoryMemoCsv(row, (text) => escape(`  ${text}`)));
        lines.push(...this.unpricedCsvRows(row, (text) => escape(`  ${text}`)));
      } else {
        lines.push(...this.inventoryMemoCsv(row, (text) => escape(`  ${text}`)));
      }
    }
    lines.push(
      ["", "", "TOTAL", "", "", "", "", totalDebit.toFixed(2), totalCredit.toFixed(2)].join(
        ",",
      ),
    );
    return lines.join("\n");
  }

  /**
   * "Export all reports" ported from report_view._generate_all_report_html:
   * the four tab reports for one period, concatenated into a single CSV (the
   * web equivalent of the Python "one workbook" export). Every section is
   * produced by the same services the individual tabs use, so the numbers
   * cannot drift.
   */
  async exportAllCsv(
    opts: DateRangeOptions = {},
    plFace?: readonly PlFaceLine[],
    bsFace?: BsFace,
  ): Promise<string> {
    const from = opts.from ?? null;
    const to = opts.to ?? null;
    const periodLabel = `${formatDayMonthYear(from) || "start"} to ${formatDayMonthYear(to) || "today"}`;
    const lines: string[] = [
      `BOP Nutraceuticals ERP — all reports,${csvEscape(periodLabel)}`,
      "",
    ];

    // --- Trial balance -------------------------------------------------
    // Laid out like the CoA page: type sections in CoA order, sub-accounts
    // indented under their parent, and a closing subtotal per section.
    const { rows, totalDebit, totalCredit } = await this.trialBalance(opts);
    lines.push(`Trial Balance (${csvEscape(periodLabel)})`);
    lines.push(
      "Account Code,Account Name,Type,Opening Debit,Opening Credit,Debit,Credit,Closing Debit,Closing Credit",
    );
    for (const section of layoutTrialBalance(rows)) {
      lines.push(
        [`${section.label.toUpperCase()} (${section.rows.length})`, ...Array(8).fill("")].join(","),
      );
      for (const row of section.rows) {
        lines.push(
          [
            csvEscape(row.displayCode),
            csvEscape(`${"  ".repeat(row.depth)}${row.accountName}`),
            row.accountType,
            row.openingDebit.toFixed(2),
            row.openingCredit.toFixed(2),
            row.debit.toFixed(2),
            row.credit.toFixed(2),
            row.closingDebit.toFixed(2),
            row.closingCredit.toFixed(2),
          ].join(","),
        );
        lines.push(
          ...this.inventoryMemoCsv(row, (text) =>
            csvEscape(`${"  ".repeat(row.depth + 1)}${text}`),
          ),
        );
        if (opts.showUnpriced === true) {
          lines.push(
            ...this.unpricedCsvRows(row, (text) =>
              csvEscape(`${"  ".repeat(row.depth + 1)}${text}`),
            ),
          );
        }
      }
      lines.push(
        [
          "",
          csvEscape(`Total ${section.label}`),
          ...Array(5).fill(""),
          section.closingDebit.toFixed(2),
          section.closingCredit.toFixed(2),
        ].join(","),
      );
    }
    lines.push(
      ["", "", "TOTAL", "", "", "", "", totalDebit.toFixed(2), totalCredit.toFixed(2)].join(","),
    );
    lines.push("");

    // --- Profit & loss (period movement) -------------------------------
    lines.push(`Profit & Loss (${csvEscape(periodLabel)})`);
    if (plFace) {
      // The printed face the website shows, line for line.
      lines.push("Description,Amount,Dr/Cr,Note");
      for (const face of plFace) {
        lines.push(
          [
            csvEscape(`${"  ".repeat(face.depth ?? 0)}${face.label}`),
            face.noAmount ? "" : face.value.toFixed(2),
            face.noAmount ? "" : face.side,
            csvEscape(face.note ?? ""),
          ].join(","),
        );
      }
    } else {
      const pl = await this.profitAndLoss(opts);
      lines.push("Revenue,Dr/Cr,Expenses,Dr/Cr,Net Profit,Dr/Cr");
      lines.push(
        [
          pl.revenue.toFixed(2),
          "Cr",
          pl.expenses.toFixed(2),
          "Dr",
          pl.netProfit.toFixed(2),
          pl.netProfit >= 0 ? "Cr" : "Dr",
        ].join(","),
      );
    }
    lines.push("");

    // --- Balance sheet (position as at the period end) ------------------
    const bs = await this.balanceSheet(to);
    lines.push(`Balance Sheet (as at ${csvEscape(formatDayMonthYear(to) || "today")})`);
    if (bsFace) {
      // The classified two-column face the website shows, line for line.
      lines.push("Description,Amount,Dr/Cr,Note");
      for (const face of bsFaceLines(bsFace)) {
        lines.push(
          [
            csvEscape(face.label),
            face.noAmount ? "" : face.value.toFixed(2),
            face.noAmount ? "" : face.side,
            csvEscape(face.note ?? ""),
          ].join(","),
        );
      }
    } else {
      lines.push(
        "Assets,Dr/Cr,Liabilities,Dr/Cr,Equity (incl. net profit),Dr/Cr,Net Profit,Dr/Cr,Balanced",
      );
      lines.push(
        [
          bs.assets.toFixed(2),
          "Dr",
          bs.liabilities.toFixed(2),
          "Cr",
          bs.equity.toFixed(2),
          "Cr",
          bs.netProfit.toFixed(2),
          bs.netProfit >= 0 ? "Cr" : "Dr",
          bs.balanced ? "YES" : "NO",
        ].join(","),
      );
    }
    lines.push("");

    // --- Cash book -----------------------------------------------------
    const cash = await this.cashBook(from ?? undefined, to ?? undefined);
    lines.push(`Cash Book (${csvEscape(periodLabel)})`);
    lines.push("Date,Voucher,Type,Description,Debit,Credit,Balance,Dr/Cr");
    for (const entry of cash) {
      lines.push(
        [
          formatDayMonthYear(entry.date),
          csvEscape(entry.voucherNumber),
          csvEscape(entry.voucherType),
          csvEscape(entry.description ?? ""),
          entry.debit.toFixed(2),
          entry.credit.toFixed(2),
          entry.balance.toFixed(2),
          sideOf(entry.balance),
        ].join(","),
      );
    }
    return lines.join("\n");
  }
}
