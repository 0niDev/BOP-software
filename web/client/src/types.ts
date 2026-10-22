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
  credit_limit: number;
  account_id: number | null;
  is_active: number;
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

export interface TaxRate {
  id: number;
  name: string;
  tax_type: "SALES_TAX" | "WITHHOLDING_TAX";
  rate_percent: number;
  is_active: number;
}

export const ITEM_UNITS = [
  "TABLET",
  "CAPSULE",
  "ML",
  "GRAM",
  "KG",
  "UNIT",
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
}

export interface ExpenseCategory {
  id: number;
  name: string;
  account_id: number | null;
  is_active: number;
}

export interface Expense {
  id: number;
  voucher_number: string;
  category_name: string;
  expense_date: string;
  amount: number;
  payment_method: SettlementMethod;
  /** `UNPAID` = pay-later bill sitting on Accounts Payable. */
  status: "PAID" | "UNPAID";
  due_date: string | null;
}

export interface ExpenseResult {
  id: number;
  voucherNumber: string;
  journalEntryId: number;
}

/** Auto-generation interval for a recurring expense item. */
export type ExpenseFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";

/** A recurring expense payee/bill within a category ("Pay Items"). */
export interface ExpenseItem {
  id: number;
  company_id: number;
  category_id: number;
  name: string;
  amount: number | null;
  frequency: ExpenseFrequency | null;
  next_run_date: string | null;
  is_active: number;
  created_at: string;
  updated_at: string | null;
}

export interface Bom {
  id: number;
  bom_name: string;
  finished_item_id: number;
  output_quantity: number;
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
  /** Units still unpacked, i.e. how much of this order is left to pack. */
  unpacked_quantity?: number;
}

export interface Payment {
  id: number;
  voucher_number: string;
  party_name: string;
  party_code: string;
  payment_date: string;
  payment_method: SettlementMethod;
  bank_account_id: number | null;
  amount: number;
}

export interface Receipt {
  id: number;
  voucher_number: string;
  party_name: string;
  party_code: string;
  receipt_date: string;
  payment_method: SettlementMethod;
  bank_account_id: number | null;
  amount: number;
}

export interface PaymentResult {
  id: number;
  voucherNumber: string;
  journalEntryId: number;
}

export interface TrialBalanceRow {
  accountId: number;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  openingDebit: number;
  openingCredit: number;
  debit: number;
  credit: number;
  closingDebit: number;
  closingCredit: number;
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

export interface LedgerEntry {
  date: string;
  voucherNumber: string;
  voucherType: string;
  description: string | null;
  notes: string | null;
  debit: number;
  credit: number;
  balance: number;
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
