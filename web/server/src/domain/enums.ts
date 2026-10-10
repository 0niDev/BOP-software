/**
 * Domain enumerations. Values are identical to the strings already stored
 * in the SQLite Cloud database (and to models/enums.py) so the new backend
 * reads and writes the same data the Python app produced.
 */

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
export const ACCOUNT_TYPES: readonly AccountType[] = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
];

/** Assets and expenses increase on the debit side; the rest on credit. */
export function isDebitNormal(accountType: AccountType): boolean {
  return accountType === "ASSET" || accountType === "EXPENSE";
}

export type PartyType = "CUSTOMER" | "SUPPLIER" | "BOTH";
export const PARTY_TYPES: readonly PartyType[] = ["CUSTOMER", "SUPPLIER", "BOTH"];

export type PaymentMethod = "CASH" | "BANK" | "CHEQUE" | "CREDIT";
export const PAYMENT_METHODS: readonly PaymentMethod[] = ["CASH", "BANK", "CHEQUE", "CREDIT"];

export type VoucherType =
  | "JOURNAL"
  | "SALES"
  | "SALES_RETURN"
  | "PURCHASE"
  | "PURCHASE_RETURN"
  | "PAYMENT"
  | "RECEIPT"
  | "MANUFACTURING"
  | "STOCK_ADJUSTMENT"
  | "OPENING";

export type DocumentStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

/**
 * System account codes the accounting engine posts against. Resolved by
 * code (never by numeric id) exactly like accounting/system_accounts.py.
 */
export const SystemAccountCodes = {
  CASH_IN_HAND: "1000",
  BANK_ACCOUNTS: "1010",
  ACCOUNTS_RECEIVABLE: "1100",
  INVENTORY_RAW_MATERIALS: "1200",
  INVENTORY_PACKING_MATERIALS: "1210",
  INVENTORY_FINISHED_GOODS: "1220",
  ACCOUNTS_PAYABLE: "2000",
  SALES_TAX_PAYABLE: "2100",
  RETAINED_EARNINGS: "3100",
  SALES_REVENUE: "4000",
  SALES_RETURNS: "4100",
  COST_OF_GOODS_SOLD: "5000",
  MANUFACTURING_WASTAGE_EXPENSE: "5200",
} as const;

export type ItemType = "RAW_MATERIAL" | "PACKING_MATERIAL" | "FINISHED_GOOD";
