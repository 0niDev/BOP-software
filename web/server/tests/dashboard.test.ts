import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DashboardService } from "../src/services/dashboardService.js";
import { ExpenseService } from "../src/services/expenseService.js";
import { ItemService } from "../src/services/itemService.js";
import { PartyService } from "../src/services/partyService.js";
import { PaymentService } from "../src/services/paymentService.js";
import { PurchaseInvoiceService } from "../src/services/purchaseInvoiceService.js";
import { SalesInvoiceService } from "../src/services/salesInvoiceService.js";
import { closeDb, freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let dashboard: DashboardService;
let sales: SalesInvoiceService;
let purchases: PurchaseInvoiceService;
let payments: PaymentService;
let expenses: ExpenseService;
let items: ItemService;
let parties: PartyService;

const TODAY = new Date().toISOString().slice(0, 10);

beforeEach(async () => {
  ctx = await freshDb();
  dashboard = new DashboardService(ctx.db);
  sales = new SalesInvoiceService(ctx.db);
  purchases = new PurchaseInvoiceService(ctx.db);
  payments = new PaymentService(ctx.db);
  expenses = new ExpenseService(ctx.db);
  items = new ItemService(ctx.db);
  parties = new PartyService(ctx.db);
});
afterEach(async () => {
  await closeDb(ctx.db);
});

describe("DashboardService", () => {
  it("returns a zeroed dashboard with an all-clear alert on a fresh database", async () => {
    const data = await dashboard.get();
    expect(data.today).toEqual({
      salesTotal: 0,
      salesCount: 0,
      purchasesTotal: 0,
      purchasesCount: 0,
    });
    expect(data.balances).toEqual({ cash: 0, bank: 0, inventory: 100000, total: 100000 });
    expect(data.receivablesPayables).toEqual({ receivable: 0, payable: 0 });
    expect(data.profitLoss).toEqual({ revenue: 0, expenses: 0, profit: 0, isProfit: false });
    expect(data.recentTransactions).toEqual([]);
    // The seeded demo batch carries 1000 units at 100.00.
    expect(data.inventory.totalItems).toBe(1);
    expect(data.alerts.count).toBe(1);
    expect(data.alerts.alerts[0]!.title).toBe("All Clear!");
    expect(data.monthlyTrend).toHaveLength(6);
  });

  it("sums today's sales and purchases and reports month-to-date P&L", async () => {
    await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: TODAY,
      paymentType: "CASH",
      items: [{ itemId: ctx.ids.itemId, quantity: 5, unitPrice: 150 }],
    });
    await purchases.createPurchaseInvoice({
      supplierId: ctx.ids.supplierId,
      invoiceDate: TODAY,
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 2, unitCost: 100 }],
    });
    const category = await expenses.createCategory("Dashboard Expense");
    await expenses.createExpense({
      categoryId: category.id,
      expenseDate: TODAY,
      amount: 25,
      paymentMethod: "CASH",
    });

    const data = await dashboard.get();
    expect(data.today.salesTotal).toBe(750);
    expect(data.today.salesCount).toBe(1);
    expect(data.today.purchasesTotal).toBe(200);
    expect(data.today.purchasesCount).toBe(1);

    // Cash: 750 sale - 25 expense (+ the purchase went to A/P).
    expect(data.balances.cash).toBe(725);
    // Payables: the credit purchase.
    expect(data.receivablesPayables.payable).toBe(200);

    // Month-to-date P&L matches the report service's view. Expenses include
    // the COGS posted by the sale (5 x 100 cost = 500) plus the 25 expense.
    expect(data.profitLoss.revenue).toBe(750);
    expect(data.profitLoss.expenses).toBe(525);
    expect(data.profitLoss.profit).toBe(225);
    expect(data.profitLoss.isProfit).toBe(true);

    const thisMonth = data.monthlyTrend.at(-1)!;
    expect(thisMonth.month).toBe(`${TODAY.slice(0, 7)}-01`);
    expect(thisMonth.revenue).toBe(750);
    expect(thisMonth.expenses).toBe(525);
    expect(thisMonth.profit).toBe(225);

    expect(data.recentTransactions.length).toBeGreaterThanOrEqual(3);
    expect(data.recentTransactions.map((t) => t.type)).toContain("Sales");
  });

  it("shows receivables for a credit sale and clears them on receipt", async () => {
    await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: TODAY,
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 2, unitPrice: 150 }],
    });
    let data = await dashboard.get();
    expect(data.receivablesPayables.receivable).toBe(300);
    expect(data.balances.cash).toBe(0);

    await payments.receivePayment({
      customerId: ctx.ids.customerId,
      amount: 300,
      paymentDate: TODAY,
      paymentMethod: "CASH",
    });
    data = await dashboard.get();
    expect(data.receivablesPayables.receivable).toBe(0);
    expect(data.balances.cash).toBe(300);
  });

  it("raises alerts for low stock and for batches expiring within 30 days", async () => {
    // Push the demo item's minimum above its on-hand quantity.
    const item = await items.get(ctx.ids.itemId);
    await items.update(item.id, {
      itemName: item.item_name,
      unit: item.unit,
      purchasePrice: item.purchase_price,
      sellingPrice: item.selling_price,
      minimumStock: 5_000,
      maximumStock: 10_000,
      itemType: item.item_type,
    });
    // A batch expiring in 10 days.
    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    await ctx.db.run(
      `INSERT INTO stock_batches
         (item_id, warehouse_id, batch_number, expiry_date, purchase_price,
          raw_unit_cost, packing_unit_cost, quantity_in_stock, received_date, is_active)
       VALUES (?, 1, 'EXPIRING-1', ?, 50, 50, 0, 20, ?, 1)`,
      [ctx.ids.itemId, soon, TODAY],
    );

    const data = await dashboard.get();
    expect(data.inventory.lowStockCount).toBe(1);
    expect(data.inventory.lowStockItems[0]!.itemCode).toBe("DEMO-FG");
    expect(data.inventory.expiringCount).toBe(1);
    expect(data.inventory.expiringItems[0]!.batchNumber).toBe("EXPIRING-1");

    const titles = data.alerts.alerts.map((a) => a.title);
    expect(titles).toContain("Low Stock: DEMO-FG");
    expect(titles).toContain("Expiring Soon: EXPIRING-1");
    expect(data.alerts.alerts.some((a) => a.type === "warning")).toBe(true);
    expect(data.alerts.alerts.some((a) => a.type === "danger")).toBe(true);
  });

  it("lists the newest transactions across modules, newest first", async () => {
    await parties.create({ name: "Dashboard Customer", partyType: "CUSTOMER" });
    await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: TODAY,
      paymentType: "CASH",
      items: [{ itemId: ctx.ids.itemId, quantity: 1, unitPrice: 150 }],
    });
    const category = await expenses.createCategory("Later Expense");
    await expenses.createExpense({
      categoryId: category.id,
      expenseDate: TODAY,
      amount: 10,
      paymentMethod: "CASH",
    });

    const data = await dashboard.get();
    const types = data.recentTransactions.map((t) => t.type);
    expect(types).toContain("Sales");
    expect(types).toContain("Expense");
    const dates = data.recentTransactions.map((t) => t.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});
