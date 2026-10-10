import type {
  Account,
  AccountType,
  Asset,
  BackupStatus,
  BalanceSheet,
  BankAccount,
  BankTransaction,
  Bom,
  Cheque,
  LedgerEntry,
  CreatedPurchaseInvoice,
  CreatedSalesInvoice,
  CreatePurchaseInvoiceRequest,
  CreateSalesInvoiceRequest,
  DashboardData,
  Expense,
  ExpenseCategory,
  ExpenseItem,
  ExpenseResult,
  Item,
  Party,
  PartyType,
  Payment,
  PaymentResult,
  ProductionOrder,
  ProfitAndLoss,
  PurchaseInvoice,
  Receipt,
  Role,
  SalesInvoice,
  SettingsGroups,
  SettlementMethod,
  TaxRate,
  TrialBalance,
  User,
  UserRow,
} from "./types";

const TOKEN_KEY = "bop-erp.token";

/** `?from=&to=` for the report endpoints, omitting empty values. */
function periodQuery(from?: string, to?: string): string {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const suffix = params.toString();
  return suffix ? `?${suffix}` : "";
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function requestText(path: string): Promise<string> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const res = await fetch(path, { headers });
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(text || res.statusText, res.status);
  }
  return text;
}

async function requestBlob(path: string): Promise<Blob> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const res = await fetch(path, { headers });
  if (!res.ok) {
    throw new ApiError((await res.text()) || res.statusText, res.status);
  }
  return res.blob();
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data?.error?.message ?? res.statusText;
    throw new ApiError(message, res.status, data?.error?.code);
  }
  return data as T;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  accounts: (activeOnly = true) =>
    request<Account[]>(`/api/accounts${activeOnly ? "" : "?activeOnly=false"}`),
  createAccount: (body: {
    accountCode: string;
    accountName: string;
    accountType: AccountType;
    parentAccountId?: number | null;
    openingBalance?: number;
    accountSubtype?: string | null;
  }) => request<Account>("/api/accounts", { method: "POST", body: JSON.stringify(body) }),
  updateAccount: (
    id: number,
    body: {
      accountName: string;
      openingBalance: number;
      parentAccountId?: number | null;
      isActive?: boolean;
    },
  ) => request<Account>(`/api/accounts/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deactivateAccount: (id: number) =>
    request<{ ok: boolean }>(`/api/accounts/${id}/deactivate`, { method: "POST" }),
  postOpeningBalances: (entries: Array<{ accountId: number; debit?: number; credit?: number }>) =>
    request<{
      journalEntryId: number;
      totalDebit: number;
      totalCredit: number;
      accountsUpdated: number;
    }>("/api/accounts/opening-balances", {
      method: "POST",
      body: JSON.stringify({ entries }),
    }),
  parties: (opts: { type?: "CUSTOMER" | "SUPPLIER"; search?: string; activeOnly?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (opts.type) params.set("type", opts.type);
    if (opts.search) params.set("search", opts.search);
    if (opts.activeOnly === false) params.set("activeOnly", "false");
    const suffix = params.toString();
    return request<Party[]>(`/api/parties${suffix ? `?${suffix}` : ""}`);
  },
  createParty: (body: {
    name: string;
    partyType: PartyType;
    code?: string | null;
    creditLimit?: number;
    accountId?: number | null;
    phone?: string | null;
    address?: string | null;
    email?: string | null;
    customerCategory?: string | null;
  }) => request<Party>("/api/parties", { method: "POST", body: JSON.stringify(body) }),
  updateParty: (
    id: number,
    body: {
      name: string;
      creditLimit: number;
      accountId?: number | null;
      isActive?: boolean;
      partyType?: PartyType;
      phone?: string | null;
      address?: string | null;
      email?: string | null;
      customerCategory?: string | null;
    },
  ) => request<Party>(`/api/parties/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deactivateParty: (id: number) =>
    request<{ ok: boolean }>(`/api/parties/${id}/deactivate`, { method: "POST" }),
  items: (opts: { search?: string; type?: Item["item_type"]; activeOnly?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (opts.search) params.set("search", opts.search);
    if (opts.type) params.set("type", opts.type);
    if (opts.activeOnly === false) params.set("activeOnly", "false");
    const suffix = params.toString();
    return request<Item[]>(`/api/items${suffix ? `?${suffix}` : ""}`);
  },
  taxRates: () => request<TaxRate[]>("/api/tax-rates"),
  createItem: (body: {
    itemName: string;
    unit?: string;
    itemCode?: string | null;
    notes?: string | null;
    purchasePrice?: number;
    sellingPrice?: number;
    minimumStock?: number;
    maximumStock?: number;
    taxRateId?: number | null;
    itemType?: Item["item_type"];
    categoryId?: number | null;
  }) => request<Item>("/api/items", { method: "POST", body: JSON.stringify(body) }),
  updateItem: (
    id: number,
    body: {
      itemName: string;
      unit: string;
      notes?: string | null;
      purchasePrice: number;
      sellingPrice: number;
      minimumStock: number;
      maximumStock: number;
      taxRateId?: number | null;
      itemType: Item["item_type"];
      categoryId?: number | null;
      isActive?: boolean;
    },
  ) => request<Item>(`/api/items/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deactivateItem: (id: number) =>
    request<{ ok: boolean }>(`/api/items/${id}/deactivate`, { method: "POST" }),
  addOpeningStock: (
    itemId: number,
    body: {
      quantity: number;
      unitCost?: number;
      batchNumber?: string | null;
      expiryDate?: string | null;
      partyId?: number | null;
    },
  ) =>
    request<{
      batchId: number;
      batchNumber: string;
      totalValue: number;
      journalEntryId: number | null;
    }>(`/api/items/${itemId}/opening-stock`, { method: "POST", body: JSON.stringify(body) }),
  salesInvoices: (search?: string) =>
    request<SalesInvoice[]>(
      `/api/sales-invoices${search ? `?search=${encodeURIComponent(search)}` : ""}`,
    ),
  createSalesInvoice: (body: CreateSalesInvoiceRequest) =>
    request<CreatedSalesInvoice>("/api/sales-invoices", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  purchaseInvoices: (search?: string) =>
    request<PurchaseInvoice[]>(
      `/api/purchase-invoices${search ? `?search=${encodeURIComponent(search)}` : ""}`,
    ),
  createPurchaseInvoice: (body: CreatePurchaseInvoiceRequest) =>
    request<CreatedPurchaseInvoice>("/api/purchase-invoices", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  payments: () => request<Payment[]>("/api/payments"),
  receipts: () => request<Receipt[]>("/api/receipts"),
  paySupplier: (body: {
    supplierId: number;
    amount: number;
    paymentDate: string;
    paymentMethod: SettlementMethod;
    notes?: string | null;
  }) =>
    request<PaymentResult>("/api/payments", { method: "POST", body: JSON.stringify(body) }),
  receivePayment: (body: {
    customerId: number;
    amount: number;
    paymentDate: string;
    paymentMethod: SettlementMethod;
    notes?: string | null;
  }) =>
    request<PaymentResult>("/api/receipts", { method: "POST", body: JSON.stringify(body) }),
  salesReturns: () => request<Record<string, unknown>[]>("/api/sales-returns"),
  createSalesReturn: (body: {
    invoiceId: number;
    returnDate: string;
    items: { invoiceItemId: number; quantity: number }[];
  }) =>
    request<{ id: number; returnNumber: string; totalAmount: number }>("/api/sales-returns", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  purchaseReturns: () => request<Record<string, unknown>[]>("/api/purchase-returns"),
  createPurchaseReturn: (body: {
    invoiceId: number;
    returnDate: string;
    items: { invoiceItemId: number; quantity: number }[];
  }) =>
    request<{ id: number; returnNumber: string; totalAmount: number }>("/api/purchase-returns", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  bankAccounts: () => request<BankAccount[]>("/api/bank-accounts"),
  createBankAccount: (body: {
    bankName: string;
    accountTitle: string;
    accountNumber: string;
    openingBalance?: number;
  }) => request<BankAccount>("/api/bank-accounts", { method: "POST", body: JSON.stringify(body) }),
  bankTransactions: () => request<BankTransaction[]>("/api/bank-transactions"),
  deposit: (body: { bankAccountId: number; amount: number; date: string }) =>
    request<{ id: number }>("/api/bank-transactions/deposit", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  withdraw: (body: { bankAccountId: number; amount: number; date: string }) =>
    request<{ id: number }>("/api/bank-transactions/withdraw", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  cheques: (status?: string) =>
    request<Cheque[]>(`/api/cheques${status ? `?status=${status}` : ""}`),
  issueCheque: (body: {
    bankAccountId: number;
    chequeNumber: string;
    amount: number;
    chequeDate: string;
    partyId?: number;
  }) => request<Cheque>("/api/cheques/issue", { method: "POST", body: JSON.stringify(body) }),
  receiveCheque: (body: {
    bankAccountId: number;
    chequeNumber: string;
    amount: number;
    chequeDate: string;
    partyId?: number;
  }) => request<Cheque>("/api/cheques/receive", { method: "POST", body: JSON.stringify(body) }),
  clearCheque: (id: number) =>
    request<{ journalEntryId: number }>(`/api/cheques/${id}/clear`, { method: "POST" }),
  bounceCheque: (id: number) =>
    request<{ status: string }>(`/api/cheques/${id}/bounce`, { method: "POST" }),
  expenseCategories: () => request<ExpenseCategory[]>("/api/expense-categories"),
  createExpenseCategory: (name: string) =>
    request<{ id: number; name: string }>("/api/expense-categories", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  expenses: () => request<Expense[]>("/api/expenses"),
  expenseItems: (categoryId?: number) =>
    request<ExpenseItem[]>(
      `/api/expense-items${categoryId ? `?categoryId=${categoryId}` : ""}`,
    ),
  createExpenseItem: (body: { categoryId: number; name: string; amount?: number | null }) =>
    request<ExpenseItem>("/api/expense-items", { method: "POST", body: JSON.stringify(body) }),
  updateExpenseItem: (id: number, body: { name?: string | null; amount?: number | null }) =>
    request<ExpenseItem>(`/api/expense-items/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deactivateExpenseItem: (id: number) =>
    request<{ ok: boolean }>(`/api/expense-items/${id}/deactivate`, { method: "POST" }),
  payExpenseItems: (body: {
    categoryId: number;
    paymentMethod: SettlementMethod;
    expenseDate: string;
    selections: Array<{ itemId: number; amount: number; description?: string | null }>;
  }) =>
    request<{ voucherNumbers: string[]; totalPaid: number }>("/api/expense-items/pay", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createExpense: (body: {
    categoryId: number;
    expenseDate: string;
    amount: number;
    paymentMethod: SettlementMethod;
    description?: string | null;
  }) => request<ExpenseResult>("/api/expenses", { method: "POST", body: JSON.stringify(body) }),
  boms: () => request<Bom[]>("/api/boms"),
  createBom: (body: {
    finishedItemId: number;
    outputQuantity: number;
    components: { componentItemId: number; quantityRequired: number; wastagePercent?: number }[];
  }) => request<{ id: number; bomName: string }>("/api/boms", { method: "POST", body: JSON.stringify(body) }),
  productionOrders: () => request<ProductionOrder[]>("/api/production-orders"),
  createProductionOrder: (body: {
    bomId: number;
    plannedQuantity: number;
    manufacturingDate: string;
  }) =>
    request<{ id: number; orderNumber: string }>("/api/production-orders", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  startProduction: (id: number) =>
    request<{ status: string }>(`/api/production-orders/${id}/start`, { method: "POST" }),
  completeProduction: (id: number, body: { actualQuantity: number; outputBatchNumber?: string }) =>
    request<{ id: number; productionCost: number }>(`/api/production-orders/${id}/complete`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  trialBalance: (from?: string, to?: string) =>
    request<TrialBalance>(`/api/reports/trial-balance${periodQuery(from, to)}`),
  profitAndLoss: (from?: string, to?: string) =>
    request<ProfitAndLoss>(`/api/reports/profit-and-loss${periodQuery(from, to)}`),
  balanceSheet: (asAt?: string) =>
    request<BalanceSheet>(
      `/api/reports/balance-sheet${asAt ? `?asAt=${encodeURIComponent(asAt)}` : ""}`,
    ),
  partyLedger: (partyId: number, from?: string, to?: string) => {
    const params = new URLSearchParams({ partyId: String(partyId) });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return request<LedgerEntry[]>(`/api/reports/party-ledger?${params.toString()}`);
  },
  cashBook: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const suffix = params.toString();
    return request<LedgerEntry[]>(`/api/reports/cash-book${suffix ? `?${suffix}` : ""}`);
  },
  trialBalanceCsv: (from?: string, to?: string) =>
    requestText(`/api/reports/trial-balance.csv${periodQuery(from, to)}`),
  exportAllCsv: (from?: string, to?: string) =>
    requestText(`/api/reports/export-all.csv${periodQuery(from, to)}`),
  dashboard: () => request<DashboardData>("/api/dashboard"),

  // --- fixed assets -----------------------------------------------------
  assets: () => request<Asset[]>("/api/assets"),
  assetCodes: () => request<Array<{ code: string; label: string }>>("/api/asset-codes"),
  createAsset: (body: {
    assetName: string;
    assetCode: string;
    amount: number;
    purchaseDate: string;
    paymentType?: "CREDIT" | "CASH" | "BANK" | "CHEQUE";
    classification?: "CURRENT" | "NON_CURRENT";
    supplierId?: number | null;
    dueDate?: string | null;
    notes?: string | null;
  }) => request<Asset>("/api/assets", { method: "POST", body: JSON.stringify(body) }),

  // --- administration: users, roles, settings -------------------------
  users: () => request<UserRow[]>("/api/users"),
  roles: () => request<Role[]>("/api/roles"),
  createUser: (body: {
    username: string;
    fullName: string;
    password: string;
    roleName: string;
    email?: string | null;
    isActive?: boolean;
  }) => request<UserRow>("/api/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (
    id: number,
    body: {
      fullName: string;
      roleName: string;
      isActive: boolean;
      email?: string | null;
      password?: string | null;
    },
  ) => request<UserRow>(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  resetUserPassword: (id: number, newPassword: string) =>
    request<{ ok: boolean }>(`/api/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ newPassword }),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  settings: () => request<SettingsGroups>("/api/settings"),

  // --- backups ----------------------------------------------------------
  backupStatus: () => request<BackupStatus>("/api/backup/status"),
  runBackup: () =>
    request<{ file: string; bytes: number; createdAt: string }>("/api/backup", { method: "POST" }),
  downloadBackup: (file: string) =>
    requestBlob(`/api/backups/${encodeURIComponent(file)}/download`),
  saveSettings: (group: string, settings: Record<string, unknown>) =>
    request<Record<string, unknown>>("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ group, settings }),
    }),
};
