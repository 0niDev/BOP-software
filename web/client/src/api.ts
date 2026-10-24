import type {
  Account,
  AccountType,
  Asset,
  BackupStatus,
  BalanceSheet,
  BankAccount,
  BankTransaction,
  Bom,
  BomComponent,
  Cheque,
  LedgerEntry,
  MirrorStatus,
  CreatedPurchaseInvoice,
  CreatedSalesInvoice,
  CreatePurchaseInvoiceRequest,
  CreateSalesInvoiceRequest,
  DashboardData,
  DatabaseInfo,
  DeletedRecord,
  Expense,
  ExpenseCategory,
  ExpenseFrequency,
  ExpenseItem,
  ExpenseResult,
  JournalEntryDetail,
  JournalEntryResult,
  ManualJournalEntry,
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
  ShortcutEntry,
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

/**
 * Routes where a 401 is a *credential* error, not a dead session: a bad
 * password (login) or a wrong current password (change-password). Treating
 * those as an expired session would reload the page and throw away the inline
 * "invalid credentials" message — and on the login page it would loop.
 */
const CREDENTIAL_ROUTES = new Set(["/api/auth/login", "/api/auth/change-password"]);

/**
 * The server keeps sessions in memory (12h TTL, lost on restart) while the
 * browser keeps the token in localStorage, so a stored token can outlive its
 * session. On a 401 from a normal endpoint, drop the dead token and replace the
 * current history entry with the app's own URL: App re-mounts with no token and
 * renders the login page, and `replace` (not assign) keeps the dead page out of
 * the back button.
 */
function endExpiredSession(res: Response, path: string): void {
  if (res.status !== 401 || CREDENTIAL_ROUTES.has(path)) return;
  setToken(null);
  window.location.replace(`${window.location.pathname}${window.location.search}`);
}

async function requestText(path: string): Promise<string> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const res = await fetch(path, { headers });
  endExpiredSession(res, path);
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
  endExpiredSession(res, path);
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
  endExpiredSession(res, path);
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
  salesInvoice: (id: number) =>
    request<{ invoice: SalesInvoice; items: Record<string, unknown>[] }>(
      `/api/sales-invoices/${id}`,
    ),
  createSalesInvoice: (body: CreateSalesInvoiceRequest) =>
    request<CreatedSalesInvoice>("/api/sales-invoices", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateSalesInvoice: (id: number, body: CreateSalesInvoiceRequest) =>
    request<CreatedSalesInvoice>(`/api/sales-invoices/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteSalesInvoice: (id: number) =>
    request<{ ok: boolean }>(`/api/sales-invoices/${id}`, { method: "DELETE" }),
  purchaseInvoices: (search?: string) =>
    request<PurchaseInvoice[]>(
      `/api/purchase-invoices${search ? `?search=${encodeURIComponent(search)}` : ""}`,
    ),
  purchaseInvoice: (id: number) =>
    request<{ invoice: PurchaseInvoice; items: Record<string, unknown>[] }>(
      `/api/purchase-invoices/${id}`,
    ),
  createPurchaseInvoice: (body: CreatePurchaseInvoiceRequest) =>
    request<CreatedPurchaseInvoice>("/api/purchase-invoices", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updatePurchaseInvoice: (id: number, body: CreatePurchaseInvoiceRequest) =>
    request<CreatedPurchaseInvoice>(`/api/purchase-invoices/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deletePurchaseInvoice: (id: number) =>
    request<{ ok: boolean }>(`/api/purchase-invoices/${id}`, { method: "DELETE" }),
  payments: () => request<Payment[]>("/api/payments"),
  receipts: () => request<Receipt[]>("/api/receipts"),
  paySupplier: (body: {
    supplierId: number;
    amount: number;
    paymentDate: string;
    paymentMethod: SettlementMethod;
    bankAccountId?: number | null;
    notes?: string | null;
    /** Links the payment to an invoice so its paid_amount moves. */
    purchaseInvoiceId?: number | null;
  }) =>
    request<PaymentResult>("/api/payments", { method: "POST", body: JSON.stringify(body) }),
  receivePayment: (body: {
    customerId: number;
    amount: number;
    paymentDate: string;
    paymentMethod: SettlementMethod;
    bankAccountId?: number | null;
    notes?: string | null;
    /** Links the receipt to an invoice so its paid_amount moves. */
    salesInvoiceId?: number | null;
  }) =>
    request<PaymentResult>("/api/receipts", { method: "POST", body: JSON.stringify(body) }),
  updatePayment: (
    id: number,
    body: {
      supplierId: number;
      amount: number;
      paymentDate: string;
      paymentMethod: SettlementMethod;
      bankAccountId?: number | null;
      notes?: string | null;
    },
  ) =>
    request<PaymentResult>(`/api/payments/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deletePayment: (id: number) =>
    request<{ ok: boolean }>(`/api/payments/${id}`, { method: "DELETE" }),
  updateReceipt: (
    id: number,
    body: {
      customerId: number;
      amount: number;
      paymentDate: string;
      paymentMethod: SettlementMethod;
      bankAccountId?: number | null;
      notes?: string | null;
    },
  ) =>
    request<PaymentResult>(`/api/receipts/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteReceipt: (id: number) =>
    request<{ ok: boolean }>(`/api/receipts/${id}`, { method: "DELETE" }),
  /** Receipts/payments attached to an invoice, for the delete dialog. */
  invoicePayments: (kind: "sales" | "purchase", id: number) =>
    request<Array<Record<string, unknown>>>(
      `/api/${kind}-invoices/${id}/payments`,
    ),
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
  salesReturn: (id: number) =>
    request<{ return: Record<string, unknown>; items: Record<string, unknown>[] }>(
      `/api/sales-returns/${id}`,
    ),
  updateSalesReturn: (
    id: number,
    body: {
      invoiceId: number;
      returnDate: string;
      items: { invoiceItemId: number; quantity: number }[];
      notes?: string | null;
    },
  ) =>
    request<{ id: number; returnNumber: string; totalAmount: number }>(`/api/sales-returns/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteSalesReturn: (id: number) =>
    request<{ ok: boolean }>(`/api/sales-returns/${id}`, { method: "DELETE" }),
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
  purchaseReturn: (id: number) =>
    request<{ return: Record<string, unknown>; items: Record<string, unknown>[] }>(
      `/api/purchase-returns/${id}`,
    ),
  updatePurchaseReturn: (
    id: number,
    body: {
      invoiceId: number;
      returnDate: string;
      items: { invoiceItemId: number; quantity: number }[];
      notes?: string | null;
    },
  ) =>
    request<{ id: number; returnNumber: string; totalAmount: number }>(
      `/api/purchase-returns/${id}`,
      { method: "PUT", body: JSON.stringify(body) },
    ),
  deletePurchaseReturn: (id: number) =>
    request<{ ok: boolean }>(`/api/purchase-returns/${id}`, { method: "DELETE" }),
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
  updateBankTransaction: (
    id: number,
    body: {
      type: "DEPOSIT" | "WITHDRAWAL";
      bankAccountId: number;
      amount: number;
      date: string;
      referenceNo?: string | null;
      notes?: string | null;
    },
  ) =>
    request<{ id: number }>(`/api/bank-transactions/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteBankTransaction: (id: number) =>
    request<{ ok: boolean }>(`/api/bank-transactions/${id}`, { method: "DELETE" }),
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
  updateCheque: (
    id: number,
    body: {
      bankAccountId: number;
      chequeNumber: string;
      amount: number;
      chequeDate: string;
      partyId?: number | null;
      notes?: string | null;
    },
  ) => request<Cheque>(`/api/cheques/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteCheque: (id: number) =>
    request<{ ok: boolean }>(`/api/cheques/${id}`, { method: "DELETE" }),
  cancelCheque: (id: number) =>
    request<{ ok: boolean }>(`/api/cheques/${id}/cancel`, { method: "POST" }),
  expenseCategories: () => request<ExpenseCategory[]>("/api/expense-categories"),
  createExpenseCategory: (name: string, accountId?: number | null) =>
    request<{ id: number; name: string }>("/api/expense-categories", {
      method: "POST",
      body: JSON.stringify({ name, accountId }),
    }),
  /** Relinking the account re-posts every existing expense in the category. */
  updateExpenseCategory: (
    id: number,
    body: { name?: string; accountId?: number | null; isActive?: boolean },
  ) =>
    request<{ category: ExpenseCategory; reposted: number }>(
      `/api/expense-categories/${id}`,
      { method: "PUT", body: JSON.stringify(body) },
    ),
  expenses: () => request<Expense[]>("/api/expenses"),
  expenseItems: (categoryId?: number) =>
    request<ExpenseItem[]>(
      `/api/expense-items${categoryId ? `?categoryId=${categoryId}` : ""}`,
    ),
  createExpenseItem: (body: {
    categoryId: number;
    name: string;
    amount?: number | null;
    frequency?: ExpenseFrequency | null;
    nextRunDate?: string | null;
  }) =>
    request<ExpenseItem>("/api/expense-items", { method: "POST", body: JSON.stringify(body) }),
  updateExpenseItem: (
    id: number,
    body: {
      name?: string | null;
      amount?: number | null;
      frequency?: ExpenseFrequency | null;
      nextRunDate?: string | null;
    },
  ) =>
    request<ExpenseItem>(`/api/expense-items/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deactivateExpenseItem: (id: number) =>
    request<{ ok: boolean }>(`/api/expense-items/${id}/deactivate`, { method: "POST" }),
  payExpenseItems: (body: {
    categoryId: number;
    paymentMethod: SettlementMethod;
    bankAccountId?: number | null;
    expenseDate: string;
    payLater?: boolean;
    dueDate?: string | null;
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
    payLater?: boolean;
    dueDate?: string | null;
    bankAccountId?: number | null;
    description?: string | null;
  }) => request<ExpenseResult>("/api/expenses", { method: "POST", body: JSON.stringify(body) }),
  payExpense: (
    id: number,
    body: {
      paymentMethod: SettlementMethod;
      paymentDate?: string;
      bankAccountId?: number | null;
    },
  ) =>
    request<ExpenseResult>(`/api/expenses/${id}/pay`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateExpense: (
    id: number,
    body: {
      categoryId: number;
      expenseDate: string;
      amount: number;
      paymentMethod: SettlementMethod;
      dueDate?: string | null;
      bankAccountId?: number | null;
      description?: string | null;
    },
  ) =>
    request<ExpenseResult>(`/api/expenses/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteExpense: (id: number) =>
    request<{ ok: boolean }>(`/api/expenses/${id}`, { method: "DELETE" }),
  deleteExpenseSettlement: (id: number) =>
    request<{ ok: boolean }>(`/api/expenses/${id}/settlement`, { method: "DELETE" }),
  journalEntries: (params?: { from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    const suffix = query.toString();
    return request<ManualJournalEntry[]>(`/api/journal-entries${suffix ? `?${suffix}` : ""}`);
  },
  journalEntry: (id: number) =>
    request<JournalEntryDetail>(`/api/journal-entries/journal_entries/${id}`),
  createJournalEntry: (body: {
    entryDate: string;
    narration?: string | null;
    referenceNo?: string | null;
    voucherNumber?: string | null;
    lines: Array<{
      accountId: number;
      partyId?: number | null;
      description?: string | null;
      debit?: number;
      credit?: number;
    }>;
  }) =>
    request<JournalEntryResult>("/api/journal-entries", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  reverseJournalEntry: (id: number, body: { reversalDate?: string; narration?: string | null }) =>
    request<JournalEntryResult>(`/api/journal-entries/${id}/reverse`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  journalVoucherXlsx: (id: number) =>
    requestBlob(`/api/journal-entries/${id}/export.xlsx`),
  boms: (activeOnly = true) =>
    request<Bom[]>(`/api/boms${activeOnly ? "" : "?activeOnly=false"}`),
  bom: (id: number) =>
    request<{ bom: Bom; components: BomComponent[] }>(`/api/boms/${id}`),
  createBom: (body: {
    finishedItemId: number;
    outputQuantity: number;
    components: { componentItemId: number; quantityRequired: number; wastagePercent?: number }[];
  }) => request<{ id: number; bomName: string }>("/api/boms", { method: "POST", body: JSON.stringify(body) }),
  updateBom: (
    id: number,
    body: {
      finishedItemId: number;
      outputQuantity: number;
      components: { componentItemId: number; quantityRequired: number; wastagePercent?: number }[];
      bomName?: string | null;
      notes?: string | null;
      isActive?: boolean;
    },
  ) =>
    request<{ id: number; bomName: string }>(`/api/boms/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteBom: (id: number) =>
    request<{ ok: boolean }>(`/api/boms/${id}`, { method: "DELETE" }),
  productionOrders: () => request<ProductionOrder[]>("/api/production-orders"),
  createProductionOrder: (body: {
    /** Omit for a temporary (one-use) production, which builds its own BOM. */
    bomId?: number | null;
    plannedQuantity: number;
    manufacturingDate: string;
    orderNumber?: string;
    tempFinishedItemId?: number | null;
    tempComponents?: {
      componentItemId: number;
      quantityRequired: number;
      wastagePercent?: number;
    }[] | null;
  }) =>
    request<{ id: number; orderNumber: string; bomId: number }>("/api/production-orders", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  startProduction: (id: number) =>
    request<{ status: string }>(`/api/production-orders/${id}/start`, { method: "POST" }),
  updateProductionOrder: (
    id: number,
    body: {
      bomId: number;
      plannedQuantity: number;
      manufacturingDate: string;
      expiryDate?: string | null;
      notes?: string | null;
    },
  ) =>
    request<{ ok: boolean }>(`/api/production-orders/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteProductionOrder: (id: number) =>
    request<{ ok: boolean }>(`/api/production-orders/${id}`, { method: "DELETE" }),
  completeProduction: (id: number, body: {
    actualQuantity: number;
    outputBatchNumber?: string;
    ignoreStock?: boolean;
  }) =>
    request<{ id: number; productionCost: number }>(`/api/production-orders/${id}/complete`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  produceProduction: (id: number, body: {
    actualQuantity: number;
    wastageQuantity?: number;
    outputBatchNumber?: string;
    ignoreStock?: boolean;
  }) =>
    request<{ id: number; productionCost: number }>(`/api/production-orders/${id}/produce`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  packProduction: (id: number, body: {
    outputBatchNumber?: string;
    ignoreStock?: boolean;
    quantity?: number;
    packSize?: number;
    materials?: { itemId: number; quantity: number }[];
  }) =>
    request<{ id: number; productionCost: number; packingBomName?: string }>(
      `/api/production-orders/${id}/pack`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
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

  // --- Excel (.xlsx) exports of the same reports ------------------------
  trialBalanceXlsx: (from?: string, to?: string) =>
    requestBlob(`/api/reports/trial-balance.xlsx${periodQuery(from, to)}`),
  profitAndLossXlsx: (from?: string, to?: string) =>
    requestBlob(`/api/reports/profit-and-loss.xlsx${periodQuery(from, to)}`),
  balanceSheetXlsx: (asAt?: string) =>
    requestBlob(
      `/api/reports/balance-sheet.xlsx${asAt ? `?asAt=${encodeURIComponent(asAt)}` : ""}`,
    ),
  cashBookXlsx: (from?: string, to?: string) =>
    requestBlob(`/api/reports/cash-book.xlsx${periodQuery(from, to)}`),
  partyLedgerXlsx: (partyId: number, from?: string, to?: string) => {
    const params = new URLSearchParams({ partyId: String(partyId) });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return requestBlob(`/api/reports/party-ledger.xlsx?${params.toString()}`);
  },
  exportAllXlsx: (from?: string, to?: string) =>
    requestBlob(`/api/reports/export-all.xlsx${periodQuery(from, to)}`),
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
  updateAsset: (
    id: number,
    body: {
      assetName: string;
      amount: number;
      purchaseDate: string;
      paymentType?: "CREDIT" | "CASH" | "BANK" | "CHEQUE";
      classification?: "CURRENT" | "NON_CURRENT";
      supplierId?: number | null;
      dueDate?: string | null;
      notes?: string | null;
    },
  ) => request<Asset>(`/api/assets/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteAsset: (id: number) =>
    request<{ ok: boolean }>(`/api/assets/${id}`, { method: "DELETE" }),
  disposeAsset: (
    id: number,
    body: { disposeDate: string; proceeds?: number; notes?: string | null },
  ) =>
    request<{ journalEntryId: number; gainLoss: number }>(`/api/assets/${id}/dispose`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // --- audit / restore -------------------------------------------------
  deletedRecords: () => request<DeletedRecord[]>("/api/audit/deleted"),
  restoreRecord: (id: number) =>
    request<{ table: string; id: number }>(`/api/audit/${id}/restore`, { method: "POST" }),

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
  shortcuts: () => request<ShortcutEntry[]>("/api/settings/shortcuts"),
  updateShortcut: (actionId: string, sequence: string) =>
    request<ShortcutEntry>(`/api/settings/shortcuts/${encodeURIComponent(actionId)}`, {
      method: "PUT",
      body: JSON.stringify({ sequence }),
    }),
  resetShortcut: (actionId: string) =>
    request<ShortcutEntry>(`/api/settings/shortcuts/${encodeURIComponent(actionId)}`, {
      method: "DELETE",
    }),
  resetAllShortcuts: () =>
    request<{ removed: number }>("/api/settings/shortcuts", { method: "DELETE" }),
  databaseInfo: () => request<DatabaseInfo>("/api/settings/database"),

  // --- backups ----------------------------------------------------------
  backupStatus: () => request<BackupStatus>("/api/backup/status"),
  runBackup: () =>
    request<{ file: string; bytes: number; createdAt: string }>("/api/backup", { method: "POST" }),
  downloadBackup: (file: string) =>
    requestBlob(`/api/backups/${encodeURIComponent(file)}/download`),
  mirrorStatus: () => request<MirrorStatus>("/api/backup/mirror"),
  syncMirror: () => request<MirrorStatus>("/api/backup/mirror", { method: "POST" }),
  downloadMirror: () => requestBlob("/api/backup/mirror/download"),
  saveSettings: (group: string, settings: Record<string, unknown>) =>
    request<Record<string, unknown>>("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ group, settings }),
    }),
};
