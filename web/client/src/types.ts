/** Types mirroring the server's JSON API responses. */

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
export type PartyType = "CUSTOMER" | "SUPPLIER" | "BOTH";
export type PaymentType = "CASH" | "BANK" | "CHEQUE" | "CREDIT";

export interface User {
  id: number;
  username: string;
  fullName: string;
  roleName: string | null;
}

export interface Account {
  id: number;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  account_subtype: string | null;
  parent_account_id: number | null;
  opening_balance: number;
  is_system_account: number;
  is_active: number;
  /** Present on GET /api/accounts: may be hard-deleted (zero references). */
  can_delete?: boolean;
  delete_blockers?: string[];
  /** Hierarchical display code; account_code stays the real one. */
  display_code?: string;
}

export interface Party {
  id: number;
  code: string;
  name: string;
  party_type: PartyType;
  customer_category: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  opening_balance: number;
  /** Invoices before this date do not move the party ledger balance. */
  opening_balance_date: string | null;
  credit_limit: number;
  account_id: number | null;
  is_active: number;
}

/** A party's closing sub-ledger balance, listed under its control account. */
export interface PartyBalance {
  partyId: number;
  accountId: number;
  code: string;
  name: string;
  partyType: PartyType;
  isActive: number;
  /** Debit-positive: what the party owes us. */
  balance: number;
}

export interface OpeningBalanceChangeParty {
  partyId: number;
  partyCode: string;
  partyName: string;
  debit: number;
  credit: number;
  /** True when this change set the party's opening balance back to zero. */
  cleared: boolean;
}

export interface OpeningBalanceChange {
  journalEntryId: number;
  entryDate: string;
  voucherNumber: string;
  createdAt: string;
  totalDebit: number;
  totalCredit: number;
  /** False once a newer change exists for any party in this change. */
  deletable: boolean;
  blockedBy: string[];
  parties: OpeningBalanceChangeParty[];
}

export interface Item {
  id: number;
  item_code: string;
  item_name: string;
  unit: string;
  item_type: string;
  selling_price: number;
  purchase_price: number;
  notes: string | null;
  minimum_stock: number;
  maximum_stock: number;
  /** On-hand quantity across active batches (returned by the items list). */
  current_stock: number;
  /** Comma-joined tag names, e.g. "bottle, cap". Null when untagged. */
  tags: string | null;
  tax_rate_id: number | null;
  category_id: number | null;
  is_active: number;
}

export interface Asset {
  account_id: number;
  account_code: string;
  account_name: string;
  account_subtype: string | null;
  opening_balance: number;
  created_at: string;
  asset_type: string | null;
  purchase_amount: number | null;
  purchase_date: string | null;
  supplier_id: number | null;
  due_date: string | null;
  notes: string | null;
  current_balance: number;
}

export interface ItemTag {
  id: number;
  name: string;
}

/** One reversible "zero out the stock ledger" run. */
export interface StockLedgerReset {
  id: number;
  company_id: number;
  reason: string | null;
  batch_count: number;
  total_quantity: number;
  total_value: number;
  snapshot_file: string | null;
  created_by: number | null;
  created_at: string;
  restored_at: string | null;
  restored_by: number | null;
}

export interface TaxRate {
  id: number;
  name: string;
  tax_type: "SALES_TAX" | "WITHHOLDING_TAX";
  rate_percent: number;
  is_active: number;
}

export const ITEM_UNITS = [
  "G",
  "ML",
  "KG",
  "LIT",
  "GRAM",
  "UNIT",
  "TABLET",
  "CAPSULE",
  "VIAL",
  "AMPOULE",
] as const;

export const ITEM_TYPES = ["RAW_MATERIAL", "PACKING_MATERIAL", "FINISHED_GOOD"] as const;

export interface SalesInvoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  payment_type: PaymentType;
  customer_id: number;
  bank_account_id: number | null;
  customer_name: string;
  customer_code: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  status: string;
  notes: string | null;
}

export interface SalesInvoiceLineInput {
  itemId: number;
  quantity: number;
  unitPrice: number;
  taxAmount?: number;
}

export interface CreateSalesInvoiceRequest {
  customerId: number;
  invoiceDate: string;
  paymentType: PaymentType;
  bankAccountId?: number | null;
  items: SalesInvoiceLineInput[];
  notes?: string | null;
  ignoreStock?: boolean;
}

export interface CreatedSalesInvoice {
  id: number;
  invoiceNumber: string;
  totalAmount: number;
  journalEntryId: number;
}

export interface PurchaseInvoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  payment_type: PaymentType;
  supplier_id: number;
  bank_account_id: number | null;
  supplier_name: string;
  supplier_code: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  status: string;
  notes: string | null;
}

export interface PurchaseInvoiceLineInput {
  itemId: number;
  quantity: number;
  unitCost: number;
  taxAmount?: number;
  batchNumber?: string | null;
}

export interface CreatePurchaseInvoiceRequest {
  supplierId: number;
  invoiceDate: string;
  paymentType: PaymentType;
  bankAccountId?: number | null;
  items: PurchaseInvoiceLineInput[];
  notes?: string | null;
}

export interface CreatedPurchaseInvoice {
  id: number;
  invoiceNumber: string;
  totalAmount: number;
  journalEntryId: number;
}

export type SettlementMethod = "CASH" | "BANK" | "CHEQUE";

export interface BankAccount {
  id: number;
  bank_name: string;
  account_title: string;
  account_number: string;
  branch_code: string | null;
  iban: string | null;
  opening_balance: number;
  is_active: number;
}

export interface BankTransaction {
  id: number;
  bank_account_id: number;
  transaction_type: string;
  amount: number;
  transaction_date: string;
  reference_no: string | null;
  notes: string | null;
  /** NULL = raised by an invoice/cheque, so it is edited through that document. */
  journal_entry_id: number | null;
}

export interface Cheque {
  id: number;
  bank_account_id: number;
  party_id: number | null;
  cheque_number: string;
  cheque_type: "ISSUED" | "RECEIVED";
  amount: number;
  cheque_date: string;
  status: string;
  cleared_date: string | null;
  notes: string | null;
}

export interface Expense {
  id: number;
  voucher_number: string;
  /** Legacy rows recorded under the retired category system; new rows are null. */
  category_id: number | null;
  category_name: string | null;
  /** COA account the expense posts Dr to. */
  account_id: number | null;
  /** Resolved posting account for display (legacy rows fall back to their category / 6000). */
  ledger_code: string;
  ledger_name: string;
  expense_date: string;
  amount: number;
  payment_method: SettlementMethod;
  /** `UNPAID` = pay-later bill sitting on Accounts Payable. */
  status: "PAID" | "UNPAID";
  due_date: string | null;
  settlement_journal_entry_id: number | null;
  bank_account_id: number | null;
  cheque_id: number | null;
  /** Party tagged on the expense's payment / A/P line. */
  party_id: number | null;
  description: string | null;
}

export interface ExpenseResult {
  id: number;
  voucherNumber: string;
  journalEntryId: number;
}

/** A manual journal voucher row (list view). */
export interface ManualJournalEntry {
  id: number;
  voucher_number: string;
  entry_date: string;
  narration: string | null;
  reference_no: string | null;
  total_debit: number;
  line_count: number;
}

export interface JournalEntryLine {
  account_id: number;
  account_code: string;
  account_name: string;
  party_id: number | null;
  debit: number;
  credit: number;
  description: string | null;
}

/** Full entry returned by GET /api/journal-entries/journal_entries/:id. */
export interface JournalEntryDetail {
  id: number;
  voucher_number: string;
  entry_date: string;
  narration: string | null;
  reference_no: string | null;
  lines: JournalEntryLine[];
}

export interface JournalEntryResult {
  id: number;
  voucherNumber: string;
}

export interface Bom {
  id: number;
  bom_name: string;
  finished_item_id: number;
  output_quantity: number;
  phase?: string | null;
  is_active: number;
}

export interface BomComponent {
  id: number;
  bom_id: number;
  component_item_id: number;
  quantity_required: number;
  wastage_percent: number;
}

export interface ProductionOrder {
  id: number;
  order_number: string;
  bom_id: number;
  planned_quantity: number;
  actual_quantity: number;
  status: string;
  manufacturing_date: string;
  production_cost: number;
  output_batch_number: string | null;
}

export interface PackingOrder {
  id: number;
  order_number: string;
  bom_id: number;
  /** Items/packages planned. */
  planned_quantity: number;
  actual_quantity: number;
  status: string;
  manufacturing_date: string;
  production_cost: number;
  output_batch_number: string | null;
}

export interface Payment {
  id: number;
  voucher_number: string;
  party_id: number;
  party_name: string;
  party_code: string;
  payment_date: string;
  payment_method: SettlementMethod;
  bank_account_id: number | null;
  amount: number;
  notes: string | null;
}

export interface Receipt {
  id: number;
  voucher_number: string;
  party_id: number;
  party_name: string;
  party_code: string;
  receipt_date: string;
  payment_method: SettlementMethod;
  bank_account_id: number | null;
  amount: number;
  notes: string | null;
}

export interface PaymentResult {
  id: number;
  voucherNumber: string;
  journalEntryId: number;
}

export interface TrialBalanceRow {
  accountId: number;
  accountCode: string;
  /** Hierarchical display code; older payloads omit it, fall back to accountCode. */
  displayCode?: string;
  accountName: string;
  accountType: AccountType;
  /** CoA parent; older payloads omit it, which simply reads as a root account. */
  parentAccountId?: number | null;
  openingDebit: number;
  openingCredit: number;
  debit: number;
  credit: number;
  closingDebit: number;
  closingCredit: number;
  /** Inventory-account memo lines: stock value per tag as at the report end. */
  tagBreakdown?: Array<{ name: string; value: number }>;
  /** Finished goods only: cost sales have already relieved (not stock any more). */
  soldValue?: number;
  usedValue?: number;
  unpricedItems?: Array<{ name: string; quantity: number }>;
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

export interface ProfitAndLoss {
  revenue: number;
  expenses: number;
  netProfit: number;
}

export interface BalanceSheet {
  assets: number;
  liabilities: number;
  equity: number;
  netProfit: number;
  balanced: boolean;
}

/** Which statement a custom heading template belongs to. */
export type CustomReportKind = "PL" | "BS";

export interface CustomHeadingPart {
  headingId: string;
  sign: 1 | -1;
}

export interface CustomHeading {
  id: string;
  name: string;
  /** Printed note/reference number, e.g. 20-29 on the printed P&L. */
  note?: string;
  /** "accounts" sums CoA nodes; "subtotal" adds/subtracts other headings. */
  kind: "accounts" | "subtotal";
  /** P&L only: "opening" reads balances carried into the period. */
  basis?: "opening";
  accountIds: number[];
  /** Account headings only: subtrees left out of this heading. */
  excludedAccountIds?: number[];
  parts: CustomHeadingPart[];
}

export interface CustomReportRow {
  accountId: number;
  code: string;
  name: string;
  depth: number;
  value: number;
  selected: boolean;
  isHeader: boolean;
}

export interface CustomReportHeading extends CustomHeading {
  value: number;
  rows: CustomReportRow[];
}

export interface CustomReport {
  kind: CustomReportKind;
  headings: CustomReportHeading[];
  unassigned: { value: number; rows: CustomReportRow[] };
  footer: Array<{ label: string; value: number }>;
  balanced: boolean | null;
}

/** Every report the reports page shows, from a single request. */
export interface ReportsBundle {
  trialBalance: TrialBalance;
  profitAndLoss: ProfitAndLoss;
  balanceSheet: BalanceSheet;
  customPl: CustomReport;
  customBs: CustomReport;
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
  /** Invoice settled at creation (cash/bank/cheque): shown, not owed. */
  settled?: boolean;
  /** Dated before the party's opening date: shown, but the balance ignores it. */
  beforeOpening?: boolean;
}

/** One party's ledger + closing balance inside the all-parties report. */
export interface PartyLedgerWithBalance {
  partyId: number;
  code: string;
  name: string;
  partyType: string;
  entries: LedgerEntry[];
  closingBalance: number;
}

export interface AllPartyLedgers {
  parties: PartyLedgerWithBalance[];
  grandTotal: number;
}

/** One product a party bought, summed across all its sale invoices. */
export interface PartyProductRow {
  itemId: number;
  itemName: string;
  value: number;
}

export interface PartyProductSalesParty {
  partyId: number;
  code: string;
  name: string;
  products: PartyProductRow[];
  total: number;
}

export interface PartyProductSales {
  parties: PartyProductSalesParty[];
  grandTotal: number;
}

export interface UserRow {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  role_id: number;
  role_name: string | null;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
}

export interface Role {
  id: number;
  name: string;
  description: string | null;
}

/** GET /api/settings: group name -> { key -> value }. */
export type SettingsGroups = Record<string, Record<string, unknown>>;

/** One keyboard action from the server's ported shortcut catalogue. */
export interface ShortcutEntry {
  actionId: string;
  description: string;
  category: string;
  context: string;
  defaultSequence: string;
  currentSequence: string;
}

/** GET /api/settings/database: read-only connection summary. */
export interface DatabaseInfo {
  engine: string;
  location: string;
  source: string;
  sqliteVersion: string;
  restartRequired: boolean;
  companyId: number;
  currency: string;
}

export interface BackupFile {
  file: string;
  bytes: number;
  modifiedAt: string;
}

export interface BackupStatus {
  engine: string;
  directory: string;
  supported: boolean;
  exists: boolean;
  count: number;
  latest: string | null;
  totalBytes: number;
  backups: BackupFile[];
}

/** GET /api/backup/mirror: the continuously refreshed local copy. */
export interface MirrorStatus {
  enabled: boolean;
  path: string;
  exists: boolean;
  bytes: number;
  updatedAt: string | null;
  lagSeconds: number | null;
  pending: boolean;
  lastError: string | null;
  pcDirectory: string | null;
  pcUpdatedAt: string | null;
  pcError: string | null;
}

/** GET /api/backup/replica: how fresh the SQLite Cloud copy is. */
export interface ReplicaStatus {
  enabled: boolean;
  dryRun: boolean;
  intervalMinutes: number;
  lastPushAt: string | null;
  secondsAgo: number | null;
  pending: boolean;
  dirty: boolean;
  lastError: string | null;
  lastRows: number;
  lastBytes: number;
  lastDurationMs: number;
}

export interface DashboardData {
  today: {
    salesTotal: number;
    salesCount: number;
    purchasesTotal: number;
    purchasesCount: number;
  };
  balances: { cash: number; bank: number; inventory: number; total: number };
  receivablesPayables: { receivable: number; payable: number };
  profitLoss: { revenue: number; expenses: number; profit: number; isProfit: boolean };
  recentTransactions: Array<{
    reference: string;
    date: string;
    type: string;
    amount: number;
    partyName: string | null;
  }>;
  inventory: {
    totalItems: number;
    lowStockCount: number;
    lowStockItems: Array<{
      itemCode: string;
      itemName: string;
      currentStock: number;
      minimumStock: number;
    }>;
    expiringCount: number;
    expiringItems: Array<{
      itemCode: string;
      itemName: string;
      batchNumber: string;
      expiryDate: string | null;
      quantityInStock: number;
    }>;
  };
  alerts: {
    count: number;
    alerts: Array<{ type: "warning" | "danger" | "success"; title: string; message: string }>;
  };
  monthlyTrend: Array<{ month: string; revenue: number; expenses: number; profit: number }>;
  /** Best sellers, ranked by revenue (dashboard service). */
  topItems: Array<{
    itemCode: string;
    itemName: string;
    quantity: number;
    revenue: number;
    customers: number;
  }>;
  /** Sales mix by customer, ranked by revenue (dashboard service). */
  salesByCustomer: Array<{ partyName: string; revenue: number; invoices: number }>;
}

/** One row of the audit trail's deleted-records screen. */
export interface DeletedRecord {
  id: number;
  user_id: number | null;
  action: "DELETE";
  entity_table: string;
  entity_id: number | null;
  details: string | null;
  created_at: string;
  restored: boolean;
}
