import type { Row, SqlDatabase } from "../db/types.js";
import { formatDayMonthYear } from "../domain/dateValidation.js";
import { SystemAccountCodes, type ItemType } from "../domain/enums.js";
import { Decimal, toStorage } from "../domain/money.js";
import { PartyRepository, type PartyRow } from "../repositories/partyRepository.js";
import { SystemAccountResolver } from "../repositories/systemAccounts.js";
import {
  AccountingService,
  type DateRangeOptions,
  type TrialBalanceRow,
} from "./accountingService.js";
import { layoutTrialBalance } from "./trialBalanceLayout.js";

export interface TrialBalanceResult {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

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
  /** Closing balance, debit-positive (what the party owes us). */
  balance: number;
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
    await this.attachInventoryTags(rows, opts.to || null);
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
      if (!itemType) continue;
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

    // Finished goods are split on the report: everything the invoices sold,
    // and what is physically left. A sold unit is sold whether or not the
    // posting code remembered to relieve it, so the sold figure is built from
    // the sales invoices themselves.
    const fgRow = inventoryRows.find(
      (row) => INVENTORY_ITEM_TYPE_BY_CODE[row.accountCode] === "FINISHED_GOOD",
    );
    if (fgRow) fgRow.soldValue = await this.soldFinishedGoods(to);

    // Raw and packing material get the mirror treatment: what manufacturing
    // has already taken out of the account, and what is still in the store.
    for (const row of inventoryRows) {
      const itemType = INVENTORY_ITEM_TYPE_BY_CODE[row.accountCode];
      if (itemType !== "RAW_MATERIAL" && itemType !== "PACKING_MATERIAL") continue;
      row.usedValue = await this.issuedToProduction(row.accountId, to);
    }

    // What is behind each figure but carries no cost, so it values at zero.
    for (const row of inventoryRows) {
      const itemType = INVENTORY_ITEM_TYPE_BY_CODE[row.accountCode];
      if (!itemType) continue;
      row.unpricedItems =
        itemType === "FINISHED_GOOD"
          ? await this.unpricedProductionInputs()
          : await this.unpricedStockItems(itemType);
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
   * Inputs pulled into production and packing runs that carry no cost anywhere:
   * no purchase price and no costed batch. Their value never reached the
   * finished goods made from them.
   */
  private async unpricedProductionInputs(): Promise<Array<{ name: string; quantity: number }>> {
    return this.db.all<{ name: string; quantity: number }>(
      `WITH runs AS (
         SELECT bom_id, actual_quantity FROM production_orders WHERE actual_quantity > 0
         UNION ALL
         SELECT bom_id, actual_quantity FROM packing_orders WHERE actual_quantity > 0
       )
       SELECT i.item_name AS name,
              SUM(bc.quantity_required * r.actual_quantity / NULLIF(b.output_quantity, 0)) AS quantity
         FROM runs r
         JOIN bill_of_materials b ON b.id = r.bom_id
         JOIN bom_components bc ON bc.bom_id = b.id
         JOIN items i ON i.id = bc.component_item_id
        WHERE i.company_id = ?
          AND NOT EXISTS (
                SELECT 1 FROM purchase_invoice_items p
                 WHERE p.item_id = i.id AND p.unit_cost > 0)
          AND NOT EXISTS (
                SELECT 1 FROM stock_batches sb
                 WHERE sb.item_id = i.id
                   AND (sb.purchase_price > 0 OR (sb.raw_unit_cost + sb.packing_unit_cost) > 0))
        GROUP BY i.id, i.item_name
        ORDER BY quantity DESC`,
      [this.companyId],
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
   * Cost of every finished good sold as at `to`, taken from the invoices: each
   * sales-invoice line contributes its own quantity at that item's average
   * intake cost (purchases, production runs and opening stock). Quantities come
   * from the invoice, so sales posted without a stock movement are still
   * counted; only the cost has to be looked up.
   */
  private async soldFinishedGoods(to: string | null): Promise<number> {
    const row = await this.db.get<{ value: number }>(
      `WITH intake AS (
         SELECT m.item_id,
                SUM(m.quantity * m.unit_cost) / NULLIF(SUM(m.quantity), 0) AS unit_cost
           FROM stock_movements m
          WHERE m.movement_type IN ('PURCHASE','PRODUCTION_IN','OPENING')
            AND m.quantity > 0 AND m.unit_cost > 0
            ${to ? "AND date(m.movement_date) <= date(?)" : ""}
          GROUP BY m.item_id
       )
       SELECT COALESCE(SUM(sii.quantity * COALESCE(cost.unit_cost, 0)), 0) AS value
         FROM sales_invoice_items sii
         JOIN sales_invoices si ON si.id = sii.invoice_id
         JOIN items it ON it.id = sii.item_id
         LEFT JOIN intake cost ON cost.item_id = sii.item_id
        WHERE it.item_type = 'FINISHED_GOOD' AND it.company_id = ?
          ${to ? "AND date(si.invoice_date) <= date(?)" : ""}`,
      to ? [to, this.companyId, to] : [this.companyId],
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
                  WHEN date(sb.received_date) <= date(?) THEN sb.quantity_in_stock
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
   */
  async partyBalances(): Promise<PartyBalanceRow[]> {
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
      const opening = new Decimal(Number(party.opening_balance ?? 0));
      const openingDate =
        party.opening_balance_date ??
        (opening.isZero()
          ? null
          : openDates.get(party.id) ?? (String(party.created_at ?? "").slice(0, 10) || null));
      let balance = opening;
      for (const line of linesByParty.get(party.id) ?? []) {
        if (Number(line.settled) === 1) continue;
        if (openingDate !== null && String(line.date ?? "") < openingDate) continue;
        balance = balance
          .plus(new Decimal(Number(line.debit ?? 0)))
          .minus(new Decimal(Number(line.credit ?? 0)));
      }
      const accountId =
        balance.isZero()
          ? 0
          : balance.isNegative()
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
        balance: toStorage(balance),
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
    opts: { showOpening?: boolean } = {},
  ): Promise<AllPartyLedgersResult> {
    const parties = await this.parties.list(this.companyId, { activeOnly: true });
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
    const tags = row.tagBreakdown ?? [];
    if (tags.length === 0) return [];
    const stock = tags.reduce((total, tag) => total.plus(tag.value), new Decimal(0));
    const line = (name: string, value: number): string =>
      ["", label(name), "", "", "", "", "", value.toFixed(2), ""].join(",");
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
  async exportAllCsv(opts: DateRangeOptions = {}): Promise<string> {
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
    const pl = await this.profitAndLoss(opts);
    lines.push(`Profit & Loss (${csvEscape(periodLabel)})`);
    lines.push("Revenue,Expenses,Net Profit");
    lines.push([pl.revenue.toFixed(2), pl.expenses.toFixed(2), pl.netProfit.toFixed(2)].join(","));
    lines.push("");

    // --- Balance sheet (position as at the period end) ------------------
    const bs = await this.balanceSheet(to);
    lines.push(`Balance Sheet (as at ${csvEscape(formatDayMonthYear(to) || "today")})`);
    lines.push("Assets,Liabilities,Equity (incl. net profit),Net Profit,Balanced");
    lines.push(
      [
        bs.assets.toFixed(2),
        bs.liabilities.toFixed(2),
        bs.equity.toFixed(2),
        bs.netProfit.toFixed(2),
        bs.balanced ? "YES" : "NO",
      ].join(","),
    );
    lines.push("");

    // --- Cash book -----------------------------------------------------
    const cash = await this.cashBook(from ?? undefined, to ?? undefined);
    lines.push(`Cash Book (${csvEscape(periodLabel)})`);
    lines.push("Date,Voucher,Type,Description,Debit,Credit,Balance");
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
        ].join(","),
      );
    }
    return lines.join("\n");
  }
}
