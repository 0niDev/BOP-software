// Enum definitions for type safety across the application
// DEBUG: Mirrors Python enums exactly

// Account Types - Chart of Accounts classification
export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
}

// Party Types - Customer/Supplier classification
export enum PartyType {
  CUSTOMER = 'CUSTOMER',
  SUPPLIER = 'SUPPLIER',
  BOTH = 'BOTH',
}

// Item Types - Product classification
export enum ItemType {
  RAW_MATERIAL = 'RAW_MATERIAL',
  PACKING_MATERIAL = 'PACKING_MATERIAL',
  FINISHED_GOOD = 'FINISHED_GOOD',
}

// Voucher Types - Document numbering sequences
export enum VoucherType {
  JOURNAL = 'JOURNAL',
  SALES = 'SALES',
  SALES_RETURN = 'SALES_RETURN',
  PURCHASE = 'PURCHASE',
  PURCHASE_RETURN = 'PURCHASE_RETURN',
  PAYMENT = 'PAYMENT',
  RECEIPT = 'RECEIPT',
  MANUFACTURING = 'MANUFACTURING',
  STOCK_ADJUSTMENT = 'STOCK_ADJUSTMENT',
  OPENING = 'OPENING',
}

// Document Status - Lifecycle states
export enum DocumentStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

// User Roles - Predefined roles with specific permissions
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  ACCOUNTANT = 'ACCOUNTANT',
  SALES = 'SALES',
  WAREHOUSE = 'WAREHOUSE',
  OPERATOR = 'OPERATOR',
}

// Permission Codes - Granular access control
export enum PermissionCode {
  // Sales
  VIEW_SALES_INVOICE = 'view_sales_invoice',
  CREATE_SALES_INVOICE = 'create_sales_invoice',
  EDIT_SALES_INVOICE = 'edit_sales_invoice',
  DELETE_SALES_INVOICE = 'delete_sales_invoice',
  
  // Purchase
  VIEW_PURCHASE_INVOICE = 'view_purchase_invoice',
  CREATE_PURCHASE_INVOICE = 'create_purchase_invoice',
  EDIT_PURCHASE_INVOICE = 'edit_purchase_invoice',
  DELETE_PURCHASE_INVOICE = 'delete_purchase_invoice',
  
  // Manufacturing
  VIEW_PRODUCTION_ORDER = 'view_production_order',
  CREATE_PRODUCTION_ORDER = 'create_production_order',
  COMPLETE_PRODUCTION_ORDER = 'complete_production_order',
  
  // Accounting
  VIEW_JOURNAL_ENTRY = 'view_journal_entry',
  CREATE_JOURNAL_ENTRY = 'create_journal_entry',
  POST_JOURNAL_ENTRY = 'post_journal_entry',
  VIEW_REPORTS = 'view_reports',
  
  // Inventory
  VIEW_STOCK = 'view_stock',
  ADJUST_STOCK = 'adjust_stock',
  
  // Parties
  VIEW_PARTIES = 'view_parties',
  CREATE_PARTIES = 'create_parties',
  EDIT_PARTIES = 'edit_parties',
  
  // Users
  VIEW_USERS = 'view_users',
  CREATE_USERS = 'create_users',
  EDIT_USERS = 'edit_users',
  DELETE_USERS = 'delete_users',
}

// Production Order Status
export enum ProductionStatus {
  DRAFT = 'DRAFT',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// Payment Types
export enum PaymentType {
  CASH = 'CASH',
  BANK = 'BANK',
  CHEQUE = 'CHEQUE',
  CREDIT = 'CREDIT',
}

// Bank Transaction Types
export enum BankTransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
}

console.log('[Enums] All enum definitions loaded');
console.log('[Enums] AccountType:', Object.keys(AccountType).length, 'values');
console.log('[Enums] VoucherType:', Object.keys(VoucherType).length, 'values');
console.log('[Enums] PermissionCode:', Object.keys(PermissionCode).length, 'values');
