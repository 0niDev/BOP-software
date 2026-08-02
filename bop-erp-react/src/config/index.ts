// SQLiteCloud Database Configuration
// DEBUG: Initializing database connection configuration

export const DB_CONFIG = {
  connectionString: "sqlitecloud://cjja8z6pvz.g4.sqlite.cloud:8860/auth.sqlitecloud?apikey=bmJZ0l1RTFCoxS0Au17c0iofzZmrDn2Db94v0YtV9Uw",
  poolSize: 10,
  connectionTimeout: 30000,
  queryTimeout: 60000,
  retryAttempts: 3,
  retryDelay: 1000,
};

// Account Codes - Chart of Accounts
// DEBUG: These are critical for all accounting operations
export const ACCOUNT_CODES = {
  // Assets
  CASH: '1000',
  BANK: '1010',
  ACCOUNTS_RECEIVABLE: '1100',
  INVENTORY_RAW_MATERIALS: '1200',
  INVENTORY_PACKING_MATERIALS: '1210',
  INVENTORY_FINISHED_GOODS: '1220',
  
  // Liabilities
  ACCOUNTS_PAYABLE: '2000',
  TAX_PAYABLE: '2100',
  
  // Equity
  SHARE_CAPITAL: '3000',
  RETAINED_EARNINGS: '3100',
  
  // Revenue
  SALES_REVENUE: '4000',
  
  // Expenses
  COST_OF_GOODS_SOLD: '5000',
  OPERATING_EXPENSES: '5100',
  WASTAGE_EXPENSE: '5200',
} as const;

// Voucher Types for document numbering
// DEBUG: Used in numbering_sequences table
export const VOUCHER_TYPES = {
  JOURNAL: 'JOURNAL',
  SALES: 'SALES',
  SALES_RETURN: 'SALES_RETURN',
  PURCHASE: 'PURCHASE',
  PURCHASE_RETURN: 'PURCHASE_RETURN',
  PAYMENT: 'PAYMENT',
  RECEIPT: 'RECEIPT',
  MANUFACTURING: 'MANUFACTURING',
  STOCK_ADJUSTMENT: 'STOCK_ADJUSTMENT',
  OPENING: 'OPENING',
} as const;

// Document Status lifecycle
// DEBUG: DRAFT -> CONFIRMED -> (optional) CANCELLED
export const DOCUMENT_STATUS = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
} as const;

// Party Types
// DEBUG: CUSTOMER, SUPPLIER, or BOTH
export const PARTY_TYPES = {
  CUSTOMER: 'CUSTOMER',
  SUPPLIER: 'SUPPLIER',
  BOTH: 'BOTH',
} as const;

// Item Types
// DEBUG: RAW_MATERIAL, PACKING_MATERIAL, FINISHED_GOOD
export const ITEM_TYPES = {
  RAW_MATERIAL: 'RAW_MATERIAL',
  PACKING_MATERIAL: 'PACKING_MATERIAL',
  FINISHED_GOOD: 'FINISHED_GOOD',
} as const;

// Account Types for Chart of Accounts
// DEBUG: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
export const ACCOUNT_TYPES = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'EXPENSE',
} as const;

// User Roles with predefined permissions
// DEBUG: 6 predefined roles
export const USER_ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  ACCOUNTANT: 'ACCOUNTANT',
  SALES: 'SALES',
  WAREHOUSE: 'WAREHOUSE',
  OPERATOR: 'OPERATOR',
} as const;

// Permission codes for RBAC
// DEBUG: Granular access control
export const PERMISSIONS = {
  // Sales
  VIEW_SALES_INVOICE: 'view_sales_invoice',
  CREATE_SALES_INVOICE: 'create_sales_invoice',
  EDIT_SALES_INVOICE: 'edit_sales_invoice',
  DELETE_SALES_INVOICE: 'delete_sales_invoice',
  
  // Purchase
  VIEW_PURCHASE_INVOICE: 'view_purchase_invoice',
  CREATE_PURCHASE_INVOICE: 'create_purchase_invoice',
  EDIT_PURCHASE_INVOICE: 'edit_purchase_invoice',
  DELETE_PURCHASE_INVOICE: 'delete_purchase_invoice',
  
  // Manufacturing
  VIEW_PRODUCTION_ORDER: 'view_production_order',
  CREATE_PRODUCTION_ORDER: 'create_production_order',
  COMPLETE_PRODUCTION_ORDER: 'complete_production_order',
  
  // Accounting
  VIEW_JOURNAL_ENTRY: 'view_journal_entry',
  CREATE_JOURNAL_ENTRY: 'create_journal_entry',
  POST_JOURNAL_ENTRY: 'post_journal_entry',
  VIEW_REPORTS: 'view_reports',
  
  // Inventory
  VIEW_STOCK: 'view_stock',
  ADJUST_STOCK: 'adjust_stock',
  
  // Parties
  VIEW_PARTIES: 'view_parties',
  CREATE_PARTIES: 'create_parties',
  EDIT_PARTIES: 'edit_parties',
  
  // Users
  VIEW_USERS: 'view_users',
  CREATE_USERS: 'create_users',
  EDIT_USERS: 'edit_users',
  DELETE_USERS: 'delete_users',
} as const;

// Cache Configuration
// DEBUG: 30-second TTL for repository cache
export const CACHE_CONFIG = {
  TTL_SECONDS: 30,
  MAX_SIZE: 1000,
} as const;

// Application Settings
export const APP_SETTINGS = {
  COMPANY_ID: 1, // Default company for multi-company support
  DATE_FORMAT: 'YYYY-MM-DD',
  DATETIME_FORMAT: 'YYYY-MM-DD HH:mm:ss',
  DECIMAL_PRECISION: 2,
  PASSWORD_HASH_ITERATIONS: 200000, // PBKDF2-HMAC-SHA256
} as const;

// Debug logging utility
// DEBUG: Extensive debug statements throughout the application
export const debugLog = (module: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DEBUG] [${module}] ${message}`, data || '');
};

// Error logging utility
export const errorLog = (module: string, message: string, error?: any) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [ERROR] [${module}] ${message}`, error || '');
};

// Warning logging utility
export const warnLog = (module: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.warn(`[${timestamp}] [WARN] [${module}] ${message}`, data || '');
};

console.log('[CONFIG] Database and application configuration loaded');
console.log('[CONFIG] SQLiteCloud connection string configured');
console.log('[CONFIG] Account codes mapped:', Object.keys(ACCOUNT_CODES).length);
console.log('[CONFIG] Voucher types defined:', Object.keys(VOUCHER_TYPES).length);
