/**
 * End-to-end smoke test. Boots the real Express app against a *fresh*
 * throwaway local database and drives it through the HTTP interface exactly
 * as the browser client would: login -> create a sales invoice -> read the
 * trial balance, P&L and the posted journal entry.
 *
 * The database path is set before any config module is imported, so every run
 * starts from an empty schema (making the absolute-value assertions valid) and
 * never touches the real development or hosted database.
 */
import { rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import path from "node:path";

const dbFile = path.resolve(process.cwd(), "data", `smoke-${process.pid}.sqlite`);
process.env.ERP_DB_ENGINE = "local";
process.env.ERP_LOCAL_DB = dbFile;

let failures = 0;

function check(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  PASS  ${message}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${message}`);
  }
}

async function json(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main(): Promise<void> {
  const { getDb, closeDb } = await import("./db/index.js");
  const { env } = await import("./env.js");
  const { createApp } = await import("./http/app.js");
  const { seedDemoData } = await import("./seedData.js");

  const db = getDb();
  const ids = await seedDemoData(db);
  // Snapshots go to a throwaway directory so the smoke run never litters
  // web/backups.
  const backupDir = path.resolve(process.cwd(), "data", `smoke-backups-${process.pid}`);
  const app = createApp(db, env.companyId, { engine: "local", backupDir });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;

  try {
    console.log("SMOKE TEST (HTTP)\n");

    const health = await fetch(`${base}/api/health`);
    check(health.ok, "GET /api/health returns 200");

    const login = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
    });
    check(login.ok, "POST /api/auth/login authenticates admin/admin123");
    const { token } = (await json(login)) as { token: string };
    check(typeof token === "string" && token.length > 0, "login returns a session token");
    const headers = { authorization: `Bearer ${token}` };

    check(
      (await fetch(`${base}/api/sales-invoices`)).status === 401,
      "unauthenticated request is rejected",
    );

    const parties = await fetch(`${base}/api/parties?type=CUSTOMER`, { headers });
    const partyList = (await json(parties)) as unknown[];
    check(parties.ok && Array.isArray(partyList), "GET /api/parties returns a list");

    const create = await fetch(`${base}/api/sales-invoices`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        customerId: ids.customerId,
        invoiceDate: "2026-10-08",
        paymentType: "CASH",
        items: [{ itemId: ids.itemId, quantity: 5, unitPrice: 150 }],
      }),
    });
    check(create.status === 201, "POST /api/sales-invoices creates an invoice (201)");
    const invoice = (await json(create)) as {
      id: number;
      invoiceNumber: string;
      totalAmount: number;
      journalEntryId: number;
    };
    check(invoice.totalAmount === 750, `invoice total is 750 (got ${invoice.totalAmount})`);
    check(invoice.journalEntryId > 0, "a journal entry was posted");
    console.log(`  invoice ${invoice.invoiceNumber} total ${invoice.totalAmount}`);

    const tb = (await json(await fetch(`${base}/api/reports/trial-balance`, { headers }))) as {
      totalDebit: number;
      totalCredit: number;
      balanced: boolean;
    };
    check(
      tb.balanced === true,
      `trial balance is balanced (debit ${tb.totalDebit} = credit ${tb.totalCredit})`,
    );

    const je = (await json(
      await fetch(`${base}/api/journal-entries/sales_invoices/${invoice.id}`, { headers }),
    )) as { lines: Array<{ account_code: string; debit: number; credit: number }> };
    check(Array.isArray(je.lines) && je.lines.length >= 4, "journal entry has revenue + COGS lines");
    const debitSum = je.lines.reduce((a, l) => a + l.debit, 0);
    const creditSum = je.lines.reduce((a, l) => a + l.credit, 0);
    check(Math.abs(debitSum - creditSum) < 0.005, `journal lines balance (${debitSum} vs ${creditSum})`);

    const pl = (await json(await fetch(`${base}/api/reports/profit-and-loss`, { headers }))) as {
      revenue: number;
      expenses: number;
      netProfit: number;
    };
    check(pl.revenue === 750, `P&L revenue is 750 (got ${pl.revenue})`);
    check(pl.expenses === 500, `P&L COGS is 500 (got ${pl.expenses})`);
    check(pl.netProfit === 250, `P&L net profit is 250 (got ${pl.netProfit})`);

    // --- purchase invoice (the counterpart module) ----------------------
    const purchase = await fetch(`${base}/api/purchase-invoices`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        supplierId: ids.supplierId,
        invoiceDate: "2026-10-08",
        paymentType: "CREDIT",
        items: [{ itemId: ids.itemId, quantity: 2, unitCost: 100, batchNumber: "SMOKE-PUR" }],
      }),
    });
    check(purchase.status === 201, "POST /api/purchase-invoices creates a purchase (201)");
    const purchaseBody = (await json(purchase)) as { invoiceNumber: string; totalAmount: number };
    check(
      purchaseBody.totalAmount === 200,
      `purchase total is 200 (got ${purchaseBody.totalAmount})`,
    );

    const tb2 = (await json(
      await fetch(`${base}/api/reports/trial-balance`, { headers }),
    )) as { balanced: boolean };
    check(tb2.balanced === true, "trial balance still balanced after the purchase");

    // --- receipt from a customer ----------------------------------------
    const receipt = await fetch(`${base}/api/receipts`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        customerId: ids.customerId,
        amount: 100,
        paymentDate: "2026-10-08",
        paymentMethod: "CASH",
      }),
    });
    check(receipt.status === 201, "POST /api/receipts records a receipt (201)");
    const receiptBody = (await json(receipt)) as { voucherNumber: string };
    check(/^RV-\d+$/.test(receiptBody.voucherNumber), `receipt voucher is numbered (${receiptBody.voucherNumber})`);

    const tb3 = (await json(
      await fetch(`${base}/api/reports/trial-balance`, { headers }),
    )) as { balanced: boolean };
    check(tb3.balanced === true, "trial balance still balanced after the receipt");

    // --- expense voucher ------------------------------------------------
    const categoryRes = await fetch(`${base}/api/expense-categories`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "Smoke Expense" }),
    });
    check(categoryRes.status === 201, "POST /api/expense-categories creates a category (201)");
    const category = (await json(categoryRes)) as { id: number };

    const expenseRes = await fetch(`${base}/api/expenses`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        categoryId: category.id,
        expenseDate: "2026-10-08",
        amount: 25,
        paymentMethod: "CASH",
      }),
    });
    check(expenseRes.status === 201, "POST /api/expenses records an expense (201)");
    const expense = (await json(expenseRes)) as { voucherNumber: string };
    check(/^EV-\d+$/.test(expense.voucherNumber), `expense voucher is numbered (${expense.voucherNumber})`);

    const tb4 = (await json(
      await fetch(`${base}/api/reports/trial-balance`, { headers }),
    )) as { balanced: boolean };
    check(tb4.balanced === true, "trial balance still balanced after the expense");

    // --- administration: roles, users, settings --------------------------
    const roles = (await json(await fetch(`${base}/api/roles`, { headers }))) as Array<{
      name: string;
    }>;
    check(
      Array.isArray(roles) && roles.some((r) => r.name === "Admin"),
      "GET /api/roles lists the seeded roles",
    );

    const userList = (await json(await fetch(`${base}/api/users`, { headers }))) as Array<
      Record<string, unknown> & { username: string }
    >;
    check(
      Array.isArray(userList) && userList.some((u) => u.username === "admin"),
      "GET /api/users lists the admin user",
    );
    check(
      userList.every((u) => !("password_hash" in u) && !("password_salt" in u)),
      "user listing never exposes password material",
    );

    const newUserPayload = {
      username: "smokeuser",
      fullName: "Smoke User",
      password: "smokepass1",
      roleName: "Accountant",
      email: "smoke@example.com",
    };
    const newUserRes = await fetch(`${base}/api/users`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(newUserPayload),
    });
    check(newUserRes.status === 201, `POST /api/users creates a user (${newUserRes.status})`);
    const newUser = (await json(newUserRes)) as { id: number; username: string };

    const dupRes = await fetch(`${base}/api/users`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(newUserPayload),
    });
    check(dupRes.status === 409, `duplicate username is rejected (${dupRes.status})`);

    const updateRes = await fetch(`${base}/api/users/${newUser.id}`, {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Smoke User Renamed",
        roleName: "Manager",
        isActive: true,
        email: "smoke@example.com",
      }),
    });
    const updated = (await json(updateRes)) as { full_name: string; role_name: string };
    check(
      updateRes.status === 200 && updated.role_name === "Manager",
      `PUT /api/users/:id updates the profile (${updateRes.status}, role ${updated.role_name})`,
    );

    const resetRes = await fetch(`${base}/api/users/${newUser.id}/reset-password`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ newPassword: "changed123" }),
    });
    check(resetRes.status === 200, `password reset succeeds (${resetRes.status})`);

    const reloginRes = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "smokeuser", password: "changed123" }),
    });
    const relogin = (await json(reloginRes)) as { token: string };
    check(
      reloginRes.status === 200 && Boolean(relogin.token),
      `reset password lets the user log in (${reloginRes.status})`,
    );
    const userHeaders = {
      authorization: `Bearer ${relogin.token}`,
      "content-type": "application/json",
    };

    const wrongChange = await fetch(`${base}/api/auth/change-password`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ currentPassword: "nope", newPassword: "changed456" }),
    });
    check(wrongChange.status === 401, `wrong current password is rejected (${wrongChange.status})`);

    const changeRes = await fetch(`${base}/api/auth/change-password`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ currentPassword: "changed123", newPassword: "changed456" }),
    });
    check(changeRes.status === 200, `change-password succeeds (${changeRes.status})`);

    const settingsAll = (await json(await fetch(`${base}/api/settings`, { headers }))) as Record<
      string,
      Record<string, unknown>
    >;
    check(
      settingsAll?.APPEARANCE?.theme_name === "dark",
      "GET /api/settings returns grouped settings (theme dark)",
    );

    const putSettings = await fetch(`${base}/api/settings`, {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ group: "REPORTS", settings: { default_format: "csv" } }),
    });
    check(putSettings.status === 200, `PUT /api/settings writes a group (${putSettings.status})`);

    const group = (await json(
      await fetch(`${base}/api/settings?group=REPORTS`, { headers }),
    )) as Record<string, unknown>;
    check(group?.default_format === "csv", "settings group reads back the saved value");

    const badTheme = await fetch(`${base}/api/settings`, {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ group: "APPEARANCE", settings: { theme_name: "neon" } }),
    });
    check(badTheme.status === 400, `invalid theme is rejected (${badTheme.status})`);

    // Company profile (GENERAL group) round-trips like the desktop Settings tab.
    const putGeneral = await fetch(`${base}/api/settings`, {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        group: "GENERAL",
        settings: { company_name: "Smoke Labs", currency: "USD", date_format: "dd/MM/yyyy" },
      }),
    });
    const general = (await json(putGeneral)) as Record<string, unknown>;
    check(
      putGeneral.status === 200 && general.company_name === "Smoke Labs" && general.currency === "USD",
      `company profile saves and reads back (${putGeneral.status})`,
    );

    // --- master data: accounts, parties, items ---------------------------
    const post = (path: string, body: unknown) =>
      fetch(`${base}${path}`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(body),
      });

    const newAccountRes = await post("/api/accounts", {
      accountCode: "1050",
      accountName: "Petty Cash",
      accountType: "ASSET",
      openingBalance: 250,
    });
    check(newAccountRes.status === 201, `POST /api/accounts creates an account (${newAccountRes.status})`);
    const newAccount = (await json(newAccountRes)) as { id: number; account_code: string };
    check(
      newAccount.account_code === "1050",
      `new account keeps its code (${newAccount.account_code})`,
    );

    const dupAccountRes = await post("/api/accounts", {
      accountCode: "1050",
      accountName: "Duplicate",
      accountType: "ASSET",
    });
    check(dupAccountRes.status === 400, `duplicate account code is rejected (${dupAccountRes.status})`);

    const accountList = (await json(await fetch(`${base}/api/accounts`, { headers }))) as Array<{
      id: number;
      account_code: string;
    }>;
    const systemAccountId = accountList.find((a) => a.account_code === "1000")!.id;
    const payableAccountId = accountList.find((a) => a.account_code === "2000")!.id;
    const protectRes = await post(`/api/accounts/${systemAccountId}/deactivate`, {});
    check(protectRes.status === 400, `system account cannot be deactivated (${protectRes.status})`);

    const deactivateAccountRes = await post(`/api/accounts/${newAccount.id}/deactivate`, {});
    check(deactivateAccountRes.status === 200, `account deactivation succeeds (${deactivateAccountRes.status})`);

    const customerRes = await post("/api/parties", {
      name: "Smoke Customer",
      partyType: "CUSTOMER",
      creditLimit: 1000,
    });
    check(customerRes.status === 201, `POST /api/parties creates a customer (${customerRes.status})`);
    const customer = (await json(customerRes)) as { id: number; code: string };
    check(/^CUST-\d{5}$/.test(customer.code), `customer code auto-generated (${customer.code})`);

    const supplierRes = await post("/api/parties", {
      name: "Smoke Supplier",
      partyType: "SUPPLIER",
    });
    const supplier = (await json(supplierRes)) as { id: number; code: string };
    check(
      supplierRes.status === 201 && /^SUPP-\d{5}$/.test(supplier.code),
      `supplier code auto-generated (${supplier.code})`,
    );

    const badPartyRes = await post("/api/parties", {
      name: "Bad Customer",
      partyType: "CUSTOMER",
      accountId: payableAccountId, // A/P is a LIABILITY; customers must link to an ASSET
    });
    check(
      badPartyRes.status === 400,
      `customer linked to a liability account is rejected (${badPartyRes.status})`,
    );

    const updatePartyRes = await fetch(`${base}/api/parties/${customer.id}`, {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "Smoke Customer Renamed", creditLimit: 2500, isActive: true }),
    });
    const updatedParty = (await json(updatePartyRes)) as { credit_limit: number };
    check(
      updatePartyRes.status === 200 && updatedParty.credit_limit === 2500,
      `PUT /api/parties/:id updates the party (${updatePartyRes.status})`,
    );

    const itemRes = await post("/api/items", {
      itemName: "Smoke Item",
      unit: "ML",
      purchasePrice: 10,
      sellingPrice: 15,
      minimumStock: 5,
      maximumStock: 100,
    });
    check(itemRes.status === 201, `POST /api/items creates an item (${itemRes.status})`);
    const item = (await json(itemRes)) as { id: number; item_code: string; item_type: string };
    check(/^ITEM-\d{5}$/.test(item.item_code), `item code auto-generated (${item.item_code})`);
    check(item.item_type === "FINISHED_GOOD", `item type defaults to FINISHED_GOOD (${item.item_type})`);

    const badItemRes = await post("/api/items", { itemName: "Bad Unit", unit: "PACKET" });
    check(badItemRes.status === 400, `invalid item unit is rejected (${badItemRes.status})`);

    const updateItemRes = await fetch(`${base}/api/items/${item.id}`, {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        itemName: "Smoke Item Renamed",
        unit: "ML",
        purchasePrice: 12,
        sellingPrice: 18,
        minimumStock: 5,
        maximumStock: 100,
        itemType: "FINISHED_GOOD",
      }),
    });
    const updatedItem = (await json(updateItemRes)) as { selling_price: number };
    check(
      updateItemRes.status === 200 && updatedItem.selling_price === 18,
      `PUT /api/items/:id updates the item (${updateItemRes.status})`,
    );

    const searchRes = (await json(
      await fetch(`${base}/api/items?search=Smoke`, { headers }),
    )) as Array<{ item_name: string }>;
    check(
      Array.isArray(searchRes) && searchRes.some((i) => i.item_name === "Smoke Item Renamed"),
      "GET /api/items?search= filters by name",
    );

    const deactivateItemRes = await post(`/api/items/${item.id}/deactivate`, {});
    check(deactivateItemRes.status === 200, `item deactivation succeeds (${deactivateItemRes.status})`);
    const activeItems = (await json(
      await fetch(`${base}/api/items`, { headers }),
    )) as Array<{ id: number }>;
    check(
      !activeItems.some((i) => i.id === item.id),
      "deactivated item is hidden from the active list",
    );

    const tb5 = (await json(
      await fetch(`${base}/api/reports/trial-balance`, { headers }),
    )) as { balanced: boolean };
    check(tb5.balanced === true, "trial balance still balanced after master-data changes");

    // --- dashboard --------------------------------------------------------
    const dashboardRes = await fetch(`${base}/api/dashboard`, { headers });
    check(dashboardRes.status === 200, `GET /api/dashboard returns 200 (${dashboardRes.status})`);
    const dashboard = (await json(dashboardRes)) as {
      balances: { inventory: number };
      inventory: { totalItems: number };
      recentTransactions: Array<{ type: string }>;
      alerts: { count: number };
      monthlyTrend: Array<{ month: string }>;
    };
    check(
      dashboard.balances.inventory > 0 && dashboard.inventory.totalItems >= 1,
      `dashboard reports inventory value (${dashboard.balances.inventory})`,
    );
    check(
      dashboard.recentTransactions.some((t) => t.type === "Sales"),
      "dashboard lists the smoke sale in recent transactions",
    );
    check(dashboard.alerts.count >= 1, `dashboard returns alerts (${dashboard.alerts.count})`);
    check(
      Array.isArray(dashboard.monthlyTrend) && dashboard.monthlyTrend.length === 6,
      `dashboard returns a 6-month trend (${dashboard.monthlyTrend?.length})`,
    );

    // --- opening stock ----------------------------------------------------
    const openingStockRes = await post(`/api/items/${item.id}/opening-stock`, {
      quantity: 25,
      unitCost: 12,
    });
    check(
      openingStockRes.status === 201,
      `POST /api/items/:id/opening-stock creates a batch (${openingStockRes.status})`,
    );
    const openingStock = (await json(openingStockRes)) as {
      batchNumber: string;
      totalValue: number;
      journalEntryId: number | null;
    };
    check(
      openingStock.journalEntryId === null && openingStock.totalValue === 300,
      `opening stock without a supplier posts no entry (${openingStock.totalValue})`,
    );

    const openingStockPartyRes = await post(`/api/items/${item.id}/opening-stock`, {
      quantity: 10,
      unitCost: 20,
      partyId: supplier.id,
    });
    const openingStockParty = (await json(openingStockPartyRes)) as { journalEntryId: number | null };
    check(
      openingStockPartyRes.status === 201 && Number(openingStockParty.journalEntryId) > 0,
      `opening stock with a supplier posts an OPENING entry (${openingStockParty.journalEntryId})`,
    );

    // --- bulk opening balances -------------------------------------------
    const openingBalancesRes = await post("/api/accounts/opening-balances", {
      entries: [
        { accountId: accountList.find((a) => a.account_code === "1100")!.id, debit: 5_000 },
        { accountId: accountList.find((a) => a.account_code === "3100")!.id, credit: 5_000 },
      ],
    });
    check(
      openingBalancesRes.status === 201,
      `POST /api/accounts/opening-balances posts (${openingBalancesRes.status})`,
    );

    const unbalancedRes = await post("/api/accounts/opening-balances", {
      entries: [{ accountId: accountList.find((a) => a.account_code === "1100")!.id, debit: 100 }],
    });
    check(unbalancedRes.status === 400, `unbalanced opening balances rejected (${unbalancedRes.status})`);

    // --- recurring expense items ("Pay Items") ---------------------------
    const expenseItemRes = await post("/api/expense-items", {
      categoryId: category.id,
      name: "Smoke Payee",
      amount: 0,
    });
    check(
      expenseItemRes.status === 201,
      `POST /api/expense-items creates an item (${expenseItemRes.status})`,
    );
    const expenseItem = (await json(expenseItemRes)) as { id: number; name: string };

    const dupExpenseItemRes = await post("/api/expense-items", {
      categoryId: category.id,
      name: "Smoke Payee",
    });
    check(
      dupExpenseItemRes.status === 409,
      `duplicate expense item rejected (${dupExpenseItemRes.status})`,
    );

    const listExpenseItems = (await json(
      await fetch(`${base}/api/expense-items?categoryId=${category.id}`, { headers }),
    )) as Array<{ id: number }>;
    check(
      listExpenseItems.some((i) => i.id === expenseItem.id),
      "GET /api/expense-items lists items for the category",
    );

    const payItemsRes = await post("/api/expense-items/pay", {
      categoryId: category.id,
      paymentMethod: "CASH",
      expenseDate: "2026-10-09",
      selections: [
        { itemId: expenseItem.id, amount: 1_500 },
        { itemId: expenseItem.id, amount: 0 },
      ],
    });
    check(payItemsRes.status === 201, `POST /api/expense-items/pay pays items (${payItemsRes.status})`);
    const payItems = (await json(payItemsRes)) as { voucherNumbers: string[]; totalPaid: number };
    check(
      payItems.voucherNumbers.length === 1 && payItems.totalPaid === 1_500,
      `bulk payment created 1 voucher for ${payItems.totalPaid} (zero amount skipped)`,
    );
    // The paid amount is remembered on the item.
    const refreshedItems = (await json(
      await fetch(`${base}/api/expense-items?categoryId=${category.id}`, { headers }),
    )) as Array<{ id: number; amount: number | null }>;
    check(
      refreshedItems.find((i) => i.id === expenseItem.id)?.amount === 1_500,
      "paid amount is stored on the expense item",
    );

    // --- fixed assets -----------------------------------------------------
    const assetRes = await post("/api/assets", {
      assetName: "Smoke Machinery",
      assetCode: "1503",
      amount: 120_000,
      purchaseDate: "2026-10-09",
      paymentType: "CREDIT",
      classification: "NON_CURRENT",
      supplierId: supplier.id,
    });
    check(assetRes.status === 201, `POST /api/assets records an asset (${assetRes.status})`);
    const asset = (await json(assetRes)) as {
      account_code: string;
      current_balance: number;
      purchase_amount: number;
    };
    check(
      asset.current_balance === 120_000 && asset.purchase_amount === 120_000,
      `asset book value is 120000 (${asset.current_balance})`,
    );

    const badAssetRes = await post("/api/assets", {
      assetName: "Bad Asset",
      assetCode: "1503",
      amount: 0,
      purchaseDate: "2026-10-09",
    });
    check(badAssetRes.status === 400, `zero-amount asset rejected (${badAssetRes.status})`);

    const assetsList = (await json(await fetch(`${base}/api/assets`, { headers }))) as Array<{
      account_code: string;
      current_balance: number;
    }>;
    check(
      assetsList.some((a) => a.account_code === "1503" && a.current_balance === 120_000),
      "GET /api/assets lists the asset with its book value",
    );

    // --- backups ----------------------------------------------------------
    const backupBefore = (await json(
      await fetch(`${base}/api/backup/status`, { headers }),
    )) as { supported: boolean; count: number };
    check(
      backupBefore.supported === true && backupBefore.count === 0,
      "GET /api/backup/status starts empty",
    );

    const backupRes = await post("/api/backup", {});
    check(backupRes.status === 201, `POST /api/backup writes a snapshot (${backupRes.status})`);
    const backup = (await json(backupRes)) as { file: string; bytes: number };
    check(backup.bytes > 0, `snapshot has content (${backup.bytes} bytes)`);

    const backupAfter = (await json(
      await fetch(`${base}/api/backup/status`, { headers }),
    )) as { count: number; latest: string | null; backups: Array<{ file: string }> };
    check(backupAfter.count === 1, `backup status counts the snapshot (${backupAfter.count})`);
    check(backupAfter.latest === backup.file, `latest backup is ${backupAfter.latest}`);

    const downloadRes = await fetch(`${base}/api/backups/${backup.file}/download`, { headers });
    check(downloadRes.status === 200, `snapshot downloads (${downloadRes.status})`);
    check(
      /attachment/.test(downloadRes.headers.get("content-disposition") ?? ""),
      "download is sent as an attachment",
    );

    const restoreRes = await post(`/api/backups/${backup.file}/restore`, {});
    check(
      restoreRes.status === 400,
      `restore is refused while the server is live (${restoreRes.status})`,
    );
    const badRestoreRes = await post("/api/backups/not-a-backup.txt/restore", {});
    check(badRestoreRes.status === 400, `invalid backup name rejected (${badRestoreRes.status})`);

    // --- export all reports (single CSV) ----------------------------------
    const exportRes = await fetch(
      `${base}/api/reports/export-all.csv?from=2026-10-01&to=2026-10-31`,
      { headers },
    );
    const exportCsv = await exportRes.text();
    check(
      exportRes.status === 200 && exportRes.headers.get("content-type")?.includes("text/csv") === true,
      `GET /api/reports/export-all.csv returns CSV (${exportRes.status})`,
    );
    check(
      ["Trial Balance", "Profit & Loss", "Balance Sheet", "Cash Book"].every((section) =>
        exportCsv.includes(section),
      ),
      "the export contains all four reports",
    );
    check(
      exportCsv.includes(",YES"),
      "the exported balance sheet is marked balanced",
    );

    const tbFinal = (await json(
      await fetch(`${base}/api/reports/trial-balance`, { headers }),
    )) as { balanced: boolean; totalDebit: number; totalCredit: number };
    check(
      tbFinal.balanced === true && tbFinal.totalDebit === tbFinal.totalCredit,
      `trial balance balanced after every module ran (${tbFinal.totalDebit} = ${tbFinal.totalCredit})`,
    );
  } finally {
    server.close();
    await closeDb();
    for (const suffix of ["", "-wal", "-shm"]) {
      await rm(`${dbFile}${suffix}`, { force: true }).catch(() => undefined);
    }
    await rm(backupDir, { recursive: true, force: true }).catch(() => undefined);
  }

  console.log("");
  if (failures > 0) {
    console.error(`SMOKE FAILED: ${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("SMOKE OK: all checks passed.");
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
