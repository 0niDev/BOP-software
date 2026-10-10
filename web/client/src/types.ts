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
  tax_rate_id: number | null;
  category_id: number | null;
  is_active: number;
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
  customer_name: string;
  customer_code: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  status: string;
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
  items: SalesInvoiceLineInput[];
  notes?: string | null;
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
  supplier_name: string;
  supplier_code: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  status: string;
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
}

export interface ExpenseResult {
  id: number;
  voucherNumber: string;
  journalEntryId: number;
}

export interface Bom {
  id: number;
  bom_name: string;
  finished_item_id: number;
  output_quantity: number;
  is_active: number;
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
}

export interface Payment {
  id: number;
  voucher_number: string;
  party_name: string;
  party_code: string;
  payment_date: string;
  payment_method: SettlementMethod;
  amount: number;
}

export interface Receipt {
  id: number;
  voucher_number: string;
  party_name: string;
  party_code: string;
  receipt_date: string;
  payment_method: SettlementMethod;
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
  debit: number;
  credit: number;
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
}
