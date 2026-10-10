import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { SqlDatabase } from "../db/types.js";
import { env } from "../env.js";
import { AppError, UnauthorizedError, ValidationError } from "../domain/errors.js";
import { AccountingService } from "../services/accountingService.js";
import { AccountService } from "../services/accountService.js";
import { AssetService } from "../services/assetService.js";
import { BackupService } from "../services/backupService.js";
import { AuthService } from "../services/authService.js";
import { DashboardService } from "../services/dashboardService.js";
import { ItemService } from "../services/itemService.js";
import { PartyService } from "../services/partyService.js";
import { BankingService } from "../services/bankingService.js";
import { ExpenseItemService } from "../services/expenseItemService.js";
import { ExpenseService } from "../services/expenseService.js";
import { ManufacturingService } from "../services/manufacturingService.js";
import { PaymentService } from "../services/paymentService.js";
import { PurchaseInvoiceService } from "../services/purchaseInvoiceService.js";
import { ReturnsService } from "../services/returnsService.js";
import { ReportService } from "../services/reportService.js";
import { SalesInvoiceService } from "../services/salesInvoiceService.js";
import { SettingsService } from "../services/settingsService.js";
import { UserService } from "../services/userService.js";

/** Minimal in-memory session store. Replace with JWT/DB sessions later. */
interface Session {
  userId: number;
  username: string;
  expiresAt: number;
}
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Invalid request payload.", result.error.issues);
  }
  return result.data;
}

const returnSchema = z.object({
  invoiceId: z.coerce.number().int().positive(),
  returnDate: z.string().min(1),
  returnNumber: z.string().nullish(),
  notes: z.string().nullish(),
  items: z
    .array(
      z.object({
        invoiceItemId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().positive(),
      }),
    )
    .min(1),
});

export interface AppOptions {
  /** Database engine name, so the backup routes know whether snapshots apply. */
  engine?: string;
  /** Where snapshots are written. */
  backupDir?: string;
}

export function createApp(
  db: SqlDatabase,
  companyId = 1,
  options: AppOptions = {},
): express.Express {
  const app = express();
  const sessions = new Map<string, Session>();

  const auth = new AuthService(db);
  const accounts = new AccountService(db, companyId);
  const parties = new PartyService(db, companyId);
  const items = new ItemService(db, companyId);
  const sales = new SalesInvoiceService(db, companyId);
  const purchases = new PurchaseInvoiceService(db, companyId);
  const payments = new PaymentService(db, companyId);
  const manufacturing = new ManufacturingService(db, companyId);
  const expenses = new ExpenseService(db, companyId);
  const banking = new BankingService(db, companyId);
  const returns = new ReturnsService(db, companyId);
  const accounting = new AccountingService(db, companyId);
  const reports = new ReportService(db, companyId);
  const users = new UserService(db);
  const settings = new SettingsService(db);
  const dashboard = new DashboardService(db, companyId);
  const expenseItems = new ExpenseItemService(db, companyId);
  const assets = new AssetService(db, companyId);
  const backups = new BackupService(
    db,
    options.engine ?? env.dbEngine,
    options.backupDir ?? env.backupDir,
  );

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/auth/login", async (req, res) => {
    const body = parseBody(
      z.object({ username: z.string().min(1), password: z.string().min(1) }),
      req.body,
    );
    const user = await auth.login(body.username, body.password);
    const token = randomUUID();
    sessions.set(token, {
      userId: user.id,
      username: user.username,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    res.json({ token, user });
  });

  // --- everything below requires a valid session -------------------------
  const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const session = token ? sessions.get(token) : undefined;
    if (!session || session.expiresAt < Date.now()) {
      if (token) sessions.delete(token);
      next(new UnauthorizedError("Missing or expired session."));
      return;
    }
    (req as Request & { user?: Session }).user = session;
    next();
  };

  /** `?activeOnly=false` includes deactivated rows; anything else means true. */
  const activeOnlyFlag = (req: Request): boolean => req.query.activeOnly !== "false";
  const searchFlag = (req: Request): string | undefined =>
    typeof req.query.search === "string" && req.query.search.trim()
      ? req.query.search.trim()
      : undefined;

  /** Aggregated landing-page figures (no cache: the queries are index-backed
   *  and always current, unlike the Python app's 5-minute in-process cache). */
  app.get("/api/dashboard", requireAuth, async (_req, res) => {
    res.json(await dashboard.get());
  });

  // --- chart of accounts -------------------------------------------------
  app.get("/api/accounts", requireAuth, async (req, res) => {
    res.json(await accounts.list(activeOnlyFlag(req)));
  });

  app.post("/api/accounts", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        accountCode: z.string().min(1),
        accountName: z.string().min(1),
        accountType: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
        parentAccountId: z.number().int().positive().nullish(),
        openingBalance: z.number().optional(),
        accountSubtype: z.string().nullish(),
      }),
      req.body,
    );
    res.status(201).json(await accounts.create(body));
  });

  app.put("/api/accounts/:id", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        accountName: z.string().min(1),
        openingBalance: z.number(),
        parentAccountId: z.number().int().positive().nullish(),
        isActive: z.boolean().optional(),
      }),
      req.body,
    );
    res.json(await accounts.update(Number(req.params.id), body));
  });

  app.post("/api/accounts/:id/deactivate", requireAuth, async (req, res) => {
    await accounts.deactivate(Number(req.params.id));
    res.json({ ok: true });
  });

  /** Bulk opening balances -> one balanced OPENING journal entry. */
  app.post("/api/accounts/opening-balances", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        entries: z
          .array(
            z.object({
              accountId: z.number().int().positive(),
              debit: z.number().optional(),
              credit: z.number().optional(),
            }),
          )
          .min(1),
      }),
      req.body,
    );
    res.status(201).json(await accounts.postOpeningBalances(body.entries));
  });

  // --- backups -----------------------------------------------------------
  app.get("/api/backup/status", requireAuth, async (_req, res) => {
    res.json(await backups.status());
  });

  app.post("/api/backup", requireAuth, async (_req, res) => {
    res.status(201).json(await backups.run());
  });

  app.get("/api/backups/:file/download", requireAuth, (req, res) => {
    const target = backups.resolve(String(req.params.file));
    res.download(target);
  });

  app.post("/api/backups/:file/restore", requireAuth, (req, res) => {
    backups.restore(String(req.params.file));
    res.json({ ok: true });
  });

  // --- fixed assets ------------------------------------------------------
  app.get("/api/assets", requireAuth, async (_req, res) => {
    res.json(await assets.list());
  });

  app.get("/api/asset-codes", requireAuth, (_req, res) => {
    res.json(assets.codes());
  });

  app.post("/api/assets", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        assetName: z.string().min(1),
        assetCode: z.string().min(1),
        amount: z.number().positive(),
        purchaseDate: z.string().min(1),
        paymentType: z.enum(["CREDIT", "CASH", "BANK", "CHEQUE"]).optional(),
        classification: z.enum(["CURRENT", "NON_CURRENT"]).optional(),
        supplierId: z.number().int().positive().nullish(),
        dueDate: z.string().nullish(),
        notes: z.string().nullish(),
      }),
      req.body,
    );
    res.status(201).json(await assets.create(body));
  });

  // --- parties (customers / suppliers) -----------------------------------
  app.get("/api/parties", requireAuth, async (req, res) => {
    const type = req.query.type;
    res.json(
      await parties.list({
        type: type === "CUSTOMER" || type === "SUPPLIER" ? type : undefined,
        activeOnly: activeOnlyFlag(req),
        search: searchFlag(req),
      }),
    );
  });

  app.post("/api/parties", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        name: z.string().min(1),
        partyType: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]),
        code: z.string().nullish(),
        creditLimit: z.number().nonnegative().optional(),
        accountId: z.number().int().positive().nullish(),
        phone: z.string().nullish(),
        address: z.string().nullish(),
        email: z.email().nullish(),
        customerCategory: z.enum(["FARMER", "INDIVIDUAL", "BUSINESS"]).nullish(),
      }),
      req.body,
    );
    res.status(201).json(await parties.create(body));
  });

  app.put("/api/parties/:id", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        name: z.string().min(1),
        creditLimit: z.number().nonnegative(),
        accountId: z.number().int().positive().nullish(),
        isActive: z.boolean().optional(),
        partyType: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]).optional(),
        phone: z.string().nullish(),
        address: z.string().nullish(),
        email: z.email().nullish(),
        customerCategory: z.enum(["FARMER", "INDIVIDUAL", "BUSINESS"]).nullish(),
      }),
      req.body,
    );
    res.json(await parties.update(Number(req.params.id), body));
  });

  app.post("/api/parties/:id/deactivate", requireAuth, async (req, res) => {
    await parties.deactivate(Number(req.params.id));
    res.json({ ok: true });
  });

  // --- items -------------------------------------------------------------
  app.get("/api/items", requireAuth, async (req, res) => {
    const type = req.query.type;
    res.json(
      await items.list({
        activeOnly: activeOnlyFlag(req),
        search: searchFlag(req),
        itemType:
          type === "RAW_MATERIAL" || type === "PACKING_MATERIAL" || type === "FINISHED_GOOD"
            ? type
            : undefined,
      }),
    );
  });

  app.get("/api/tax-rates", requireAuth, async (_req, res) => {
    res.json(await items.taxRates());
  });

  app.post("/api/items", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        itemName: z.string().min(1),
        unit: z.string().optional(),
        itemCode: z.string().nullish(),
        notes: z.string().nullish(),
        purchasePrice: z.number().nonnegative().optional(),
        sellingPrice: z.number().nonnegative().optional(),
        minimumStock: z.number().nonnegative().optional(),
        maximumStock: z.number().nonnegative().optional(),
        taxRateId: z.number().int().positive().nullish(),
        itemType: z.enum(["RAW_MATERIAL", "PACKING_MATERIAL", "FINISHED_GOOD"]).optional(),
        categoryId: z.number().int().positive().nullish(),
      }),
      req.body,
    );
    res.status(201).json(await items.create(body));
  });

  app.put("/api/items/:id", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        itemName: z.string().min(1),
        notes: z.string().nullish(),
        unit: z.string().min(1),
        purchasePrice: z.number().nonnegative(),
        sellingPrice: z.number().nonnegative(),
        minimumStock: z.number().nonnegative(),
        maximumStock: z.number().nonnegative(),
        taxRateId: z.number().int().positive().nullish(),
        itemType: z.enum(["RAW_MATERIAL", "PACKING_MATERIAL", "FINISHED_GOOD"]),
        categoryId: z.number().int().positive().nullish(),
        isActive: z.boolean().optional(),
      }),
      req.body,
    );
    res.json(await items.update(Number(req.params.id), body));
  });

  app.post("/api/items/:id/deactivate", requireAuth, async (req, res) => {
    await items.deactivate(Number(req.params.id));
    res.json({ ok: true });
  });

  /** Opening stock: creates the batch + OPENING movement, and an OPENING entry
   *  against A/P when a supplier is supplied. */
  app.post("/api/items/:id/opening-stock", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        quantity: z.number().positive(),
        unitCost: z.number().nonnegative().optional(),
        batchNumber: z.string().nullish(),
        expiryDate: z.string().nullish(),
        partyId: z.number().int().positive().nullish(),
        warehouseId: z.number().int().positive().optional(),
      }),
      req.body,
    );
    res.status(201).json(await items.addOpeningStock({ itemId: Number(req.params.id), ...body }));
  });

  app.get("/api/sales-invoices", requireAuth, async (req, res) => {
    const query = parseBody(
      z.object({
        limit: z.coerce.number().int().min(1).max(500).optional(),
        offset: z.coerce.number().int().min(0).optional(),
        search: z.string().optional(),
      }),
      req.query,
    );
    res.json(await sales.list(query));
  });

  app.get("/api/sales-invoices/:id", requireAuth, async (req, res) => {
    res.json(await sales.getById(Number(req.params.id)));
  });

  app.post("/api/sales-invoices", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        customerId: z.coerce.number().int().positive(),
        invoiceDate: z.string().min(1),
        paymentType: z.enum(["CASH", "BANK", "CHEQUE", "CREDIT"]),
        invoiceNumber: z.string().min(1).nullish(),
        notes: z.string().nullish(),
        bankAccountId: z.coerce.number().int().positive().nullish(),
        warehouseId: z.coerce.number().int().positive().optional(),
        items: z
          .array(
            z.object({
              itemId: z.coerce.number().int().positive(),
              quantity: z.coerce.number().positive(),
              unitPrice: z.coerce.number().min(0),
              discountAmount: z.coerce.number().min(0).optional(),
              taxAmount: z.coerce.number().min(0).optional(),
            }),
          )
          .min(1),
      }),
      req.body,
    );
    const user = (req as Request & { user?: Session }).user;
    const invoice = await sales.createSalesInvoice({ ...body, createdBy: user?.userId ?? null });
    res.status(201).json(invoice);
  });

  app.get("/api/purchase-invoices", requireAuth, async (req, res) => {
    const query = parseBody(
      z.object({
        limit: z.coerce.number().int().min(1).max(500).optional(),
        offset: z.coerce.number().int().min(0).optional(),
        search: z.string().optional(),
      }),
      req.query,
    );
    res.json(await purchases.list(query));
  });

  app.get("/api/purchase-invoices/:id", requireAuth, async (req, res) => {
    res.json(await purchases.getById(Number(req.params.id)));
  });

  app.post("/api/purchase-invoices", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        supplierId: z.coerce.number().int().positive(),
        invoiceDate: z.string().min(1),
        paymentType: z.enum(["CASH", "BANK", "CHEQUE", "CREDIT"]),
        invoiceNumber: z.string().min(1).nullish(),
        notes: z.string().nullish(),
        bankAccountId: z.coerce.number().int().positive().nullish(),
        warehouseId: z.coerce.number().int().positive().optional(),
        items: z
          .array(
            z.object({
              itemId: z.coerce.number().int().positive(),
              quantity: z.coerce.number().positive(),
              unitCost: z.coerce.number().min(0),
              discountAmount: z.coerce.number().min(0).optional(),
              taxAmount: z.coerce.number().min(0).optional(),
              batchNumber: z.string().nullish(),
              manufacturingDate: z.string().nullish(),
              expiryDate: z.string().nullish(),
            }),
          )
          .min(1),
      }),
      req.body,
    );
    const user = (req as Request & { user?: Session }).user;
    const invoice = await purchases.createPurchaseInvoice({ ...body, createdBy: user?.userId ?? null });
    res.status(201).json(invoice);
  });

  app.get("/api/payments", requireAuth, async (_req, res) => {
    res.json(await payments.listPayments());
  });

  app.get("/api/receipts", requireAuth, async (_req, res) => {
    res.json(await payments.listReceipts());
  });

  app.post("/api/payments", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        supplierId: z.coerce.number().int().positive(),
        amount: z.coerce.number().positive(),
        paymentDate: z.string().min(1),
        paymentMethod: z.enum(["CASH", "BANK", "CHEQUE"]),
        referenceNo: z.string().nullish(),
        notes: z.string().nullish(),
        purchaseInvoiceId: z.coerce.number().int().positive().nullish(),
      }),
      req.body,
    );
    res.status(201).json(await payments.paySupplier(body));
  });

  app.post("/api/receipts", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        customerId: z.coerce.number().int().positive(),
        amount: z.coerce.number().positive(),
        paymentDate: z.string().min(1),
        paymentMethod: z.enum(["CASH", "BANK", "CHEQUE"]),
        referenceNo: z.string().nullish(),
        notes: z.string().nullish(),
        salesInvoiceId: z.coerce.number().int().positive().nullish(),
      }),
      req.body,
    );
    res.status(201).json(await payments.receivePayment(body));
  });

  app.get("/api/boms", requireAuth, async (_req, res) => {
    res.json(await manufacturing.listBoms());
  });

  app.get("/api/boms/:id", requireAuth, async (req, res) => {
    res.json(await manufacturing.getBom(Number(req.params.id)));
  });

  app.post("/api/boms", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        finishedItemId: z.coerce.number().int().positive(),
        outputQuantity: z.coerce.number().positive(),
        bomName: z.string().nullish(),
        notes: z.string().nullish(),
        components: z
          .array(
            z.object({
              componentItemId: z.coerce.number().int().positive(),
              quantityRequired: z.coerce.number().positive(),
              wastagePercent: z.coerce.number().min(0).max(100).optional(),
            }),
          )
          .min(1),
      }),
      req.body,
    );
    res.status(201).json(await manufacturing.createBom(body));
  });

  app.get("/api/production-orders", requireAuth, async (_req, res) => {
    res.json(await manufacturing.listProductionOrders());
  });

  app.get("/api/production-orders/:id", requireAuth, async (req, res) => {
    res.json(await manufacturing.getProductionOrder(Number(req.params.id)));
  });

  app.post("/api/production-orders", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        bomId: z.coerce.number().int().positive(),
        plannedQuantity: z.coerce.number().positive(),
        manufacturingDate: z.string().min(1),
        orderNumber: z.string().nullish(),
        expiryDate: z.string().nullish(),
        notes: z.string().nullish(),
        warehouseId: z.coerce.number().int().positive().optional(),
      }),
      req.body,
    );
    const user = (req as Request & { user?: Session }).user;
    res.status(201).json(
      await manufacturing.createProductionOrder({ ...body, createdBy: user?.userId ?? null }),
    );
  });

  app.post("/api/production-orders/:id/start", requireAuth, async (req, res) => {
    await manufacturing.startProduction(Number(req.params.id));
    res.json({ status: "IN_PROGRESS" });
  });

  app.post("/api/production-orders/:id/complete", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        actualQuantity: z.coerce.number().positive(),
        wastageQuantity: z.coerce.number().min(0).optional(),
        outputBatchNumber: z.string().nullish(),
      }),
      req.body,
    );
    res.json(await manufacturing.completeProduction(Number(req.params.id), body));
  });

  app.get("/api/expense-categories", requireAuth, async (_req, res) => {
    res.json(await expenses.listCategories());
  });

  app.post("/api/expense-categories", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        name: z.string().min(1),
        accountId: z.coerce.number().int().positive().nullish(),
      }),
      req.body,
    );
    res.status(201).json(await expenses.createCategory(body.name, body.accountId));
  });

  app.get("/api/expenses", requireAuth, async (_req, res) => {
    res.json(await expenses.listExpenses());
  });

  // --- recurring expense items ("Pay Items") -----------------------------
  app.get("/api/expense-items", requireAuth, async (req, res) => {
    const categoryId =
      typeof req.query.categoryId === "string" && req.query.categoryId
        ? Number(req.query.categoryId)
        : undefined;
    res.json(
      await expenseItems.list({ categoryId, activeOnly: activeOnlyFlag(req) }),
    );
  });

  app.post("/api/expense-items", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        categoryId: z.number().int().positive(),
        name: z.string().min(1),
        amount: z.number().nonnegative().nullish(),
      }),
      req.body,
    );
    res.status(201).json(await expenseItems.create(body));
  });

  app.put("/api/expense-items/:id", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        name: z.string().nullish(),
        amount: z.number().nonnegative().nullish(),
      }),
      req.body,
    );
    res.json(await expenseItems.update(Number(req.params.id), body));
  });

  app.post("/api/expense-items/:id/deactivate", requireAuth, async (req, res) => {
    await expenseItems.deactivate(Number(req.params.id));
    res.json({ ok: true });
  });

  /** Bulk payment: one expense voucher per selected item. */
  app.post("/api/expense-items/pay", requireAuth, async (req, res) => {
    const session = (req as Request & { user?: Session }).user;
    const body = parseBody(
      z.object({
        categoryId: z.number().int().positive(),
        paymentMethod: z.enum(["CASH", "BANK", "CHEQUE"]),
        expenseDate: z.string().min(1),
        selections: z
          .array(
            z.object({
              itemId: z.number().int().positive(),
              amount: z.number(),
              description: z.string().nullish(),
            }),
          )
          .min(1),
      }),
      req.body,
    );
    res.status(201).json(
      await expenseItems.payItems({ ...body, createdBy: session?.userId ?? null }),
    );
  });

  app.post("/api/expenses", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        categoryId: z.coerce.number().int().positive(),
        expenseDate: z.string().min(1),
        amount: z.coerce.number().positive(),
        paymentMethod: z.enum(["CASH", "BANK", "CHEQUE"]),
        voucherNumber: z.string().nullish(),
        bankAccountId: z.coerce.number().int().positive().nullish(),
        description: z.string().nullish(),
      }),
      req.body,
    );
    const user = (req as Request & { user?: Session }).user;
    res.status(201).json(await expenses.createExpense({ ...body, createdBy: user?.userId ?? null }));
  });

  app.get("/api/bank-accounts", requireAuth, async (_req, res) => {
    res.json(await banking.listBankAccounts());
  });

  app.post("/api/bank-accounts", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        bankName: z.string().min(1),
        accountTitle: z.string().min(1),
        accountNumber: z.string().min(1),
        openingBalance: z.coerce.number().min(0).optional(),
        branchCode: z.string().nullish(),
        iban: z.string().nullish(),
      }),
      req.body,
    );
    res.status(201).json(await banking.createBankAccount(body));
  });

  app.get("/api/bank-accounts/:id/balance", requireAuth, async (req, res) => {
    res.json({ balance: await banking.getBalance(Number(req.params.id)) });
  });

  app.get("/api/bank-transactions", requireAuth, async (_req, res) => {
    res.json(await banking.listTransactions());
  });

  const movementSchema = z.object({
    bankAccountId: z.coerce.number().int().positive(),
    amount: z.coerce.number().positive(),
    date: z.string().min(1),
    referenceNo: z.string().nullish(),
    notes: z.string().nullish(),
  });

  app.post("/api/bank-transactions/deposit", requireAuth, async (req, res) => {
    res.status(201).json(await banking.deposit(parseBody(movementSchema, req.body)));
  });

  app.post("/api/bank-transactions/withdraw", requireAuth, async (req, res) => {
    res.status(201).json(await banking.withdraw(parseBody(movementSchema, req.body)));
  });

  app.get("/api/cheques", requireAuth, async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json(await banking.listCheques(status));
  });

  const chequeSchema = z.object({
    bankAccountId: z.coerce.number().int().positive(),
    chequeNumber: z.string().min(1),
    amount: z.coerce.number().positive(),
    chequeDate: z.string().min(1),
    partyId: z.coerce.number().int().positive().nullish(),
    notes: z.string().nullish(),
  });

  app.post("/api/cheques/issue", requireAuth, async (req, res) => {
    res.status(201).json(await banking.issueCheque(parseBody(chequeSchema, req.body)));
  });

  app.post("/api/cheques/receive", requireAuth, async (req, res) => {
    res.status(201).json(await banking.receiveCheque(parseBody(chequeSchema, req.body)));
  });

  app.post("/api/cheques/:id/clear", requireAuth, async (req, res) => {
    res.json(await banking.clearCheque(Number(req.params.id)));
  });

  app.post("/api/cheques/:id/bounce", requireAuth, async (req, res) => {
    await banking.bounceCheque(Number(req.params.id));
    res.json({ status: "BOUNCED" });
  });

  app.post("/api/cheques/:id/lose", requireAuth, async (req, res) => {
    await banking.loseCheque(Number(req.params.id));
    res.json({ status: "LOST" });
  });

  app.get("/api/sales-returns", requireAuth, async (_req, res) => {
    res.json(await returns.listSalesReturns());
  });

  app.post("/api/sales-returns", requireAuth, async (req, res) => {
    const body = parseBody(returnSchema, req.body);
    const user = (req as Request & { user?: Session }).user;
    res.status(201).json(await returns.createSalesReturn({ ...body, createdBy: user?.userId ?? null }));
  });

  app.get("/api/purchase-returns", requireAuth, async (_req, res) => {
    res.json(await returns.listPurchaseReturns());
  });

  app.post("/api/purchase-returns", requireAuth, async (req, res) => {
    const body = parseBody(returnSchema, req.body);
    const user = (req as Request & { user?: Session }).user;
    res
      .status(201)
      .json(await returns.createPurchaseReturn({ ...body, createdBy: user?.userId ?? null }));
  });

  app.get("/api/journal-entries/:sourceTable/:sourceId", requireAuth, async (req, res) => {
    const entry = await accounting.getJournalEntry(
      String(req.params.sourceTable),
      Number(req.params.sourceId),
    );
    res.json(entry);
  });

  const asAtQuery = (req: Request): string | null =>
    typeof req.query.asAt === "string" && req.query.asAt ? req.query.asAt : null;

  app.get("/api/reports/trial-balance", requireAuth, async (req, res) => {
    const { from, to } = dateRangeQuery(req);
    res.json(await reports.trialBalance({ from, to }));
  });

  app.get("/api/reports/profit-and-loss", requireAuth, async (req, res) => {
    const { from, to } = dateRangeQuery(req);
    res.json(await reports.profitAndLoss({ from, to }));
  });

  app.get("/api/reports/balance-sheet", requireAuth, async (req, res) => {
    res.json(await reports.balanceSheet(asAtQuery(req)));
  });

  const dateRangeQuery = (req: Request): { from?: string; to?: string } => ({
    from: typeof req.query.from === "string" && req.query.from ? req.query.from : undefined,
    to: typeof req.query.to === "string" && req.query.to ? req.query.to : undefined,
  });

  app.get("/api/reports/party-ledger", requireAuth, async (req, res) => {
    const query = parseBody(
      z.object({
        partyId: z.coerce.number().int().positive(),
        from: z.string().optional(),
        to: z.string().optional(),
      }),
      req.query,
    );
    res.json(await reports.partyLedger(query.partyId, dateRangeQuery(req).from, dateRangeQuery(req).to));
  });

  app.get("/api/reports/cash-book", requireAuth, async (req, res) => {
    const { from, to } = dateRangeQuery(req);
    res.json(await reports.cashBook(from, to));
  });

  app.get("/api/reports/trial-balance.csv", requireAuth, async (req, res) => {
    const { from, to } = dateRangeQuery(req);
    res.type("text/csv").send(await reports.trialBalanceCsv({ from, to }));
  });

  // "Export all reports" for one period (trial balance + P&L + balance sheet +
  // cash book) in a single CSV — the web counterpart of the desktop export of
  // every report for a month/year.
  app.get("/api/reports/export-all.csv", requireAuth, async (req, res) => {
    const { from, to } = dateRangeQuery(req);
    res.type("text/csv").send(await reports.exportAllCsv({ from, to }));
  });

  // --- administration: users, roles, settings ---------------------------
  app.get("/api/users", requireAuth, async (_req, res) => {
    res.json(await users.list());
  });

  app.post("/api/users", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        username: z.string().min(1),
        fullName: z.string().min(1),
        password: z.string().min(1),
        roleName: z.string().min(1),
        email: z.email().nullish(),
        isActive: z.boolean().optional(),
      }),
      req.body,
    );
    res.status(201).json(await users.create(body));
  });

  app.put("/api/users/:id", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        fullName: z.string().min(1),
        email: z.email().nullish(),
        roleName: z.string().min(1),
        isActive: z.boolean(),
        password: z.string().nullish(),
      }),
      req.body,
    );
    res.json(await users.update(Number(req.params.id), body));
  });

  app.post("/api/users/:id/reset-password", requireAuth, async (req, res) => {
    const body = parseBody(z.object({ newPassword: z.string().min(1) }), req.body);
    await users.resetPassword(Number(req.params.id), body.newPassword);
    res.json({ ok: true });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    const session = (req as Request & { user?: Session }).user;
    if (!session) throw new UnauthorizedError("Missing or expired session.");
    const body = parseBody(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(1),
      }),
      req.body,
    );
    await auth.changePassword(session.userId, body.currentPassword, body.newPassword);
    res.json({ ok: true });
  });

  app.get("/api/roles", requireAuth, async (_req, res) => {
    res.json(await users.roles());
  });

  app.get("/api/settings", requireAuth, async (req, res) => {
    const group = typeof req.query.group === "string" && req.query.group ? req.query.group : undefined;
    res.json(
      group ? await settings.getGroup(companyId, group) : await settings.getAll(companyId),
    );
  });

  app.put("/api/settings", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        group: z.string().min(1),
        settings: z.record(z.string(), z.unknown()),
      }),
      req.body,
    );
    res.json(await settings.setGroup(companyId, body.group, body.settings));
  });

  app.delete("/api/settings/:group", requireAuth, async (req, res) => {
    const group = String(req.params.group);
    const removed = await settings.deleteGroup(companyId, group);
    res.json({ group, removed });
  });

  // --- error handling ----------------------------------------------------
  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Unknown endpoint." } });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.status).json({
        error: { code: err.code, message: err.message, details: err.details },
      });
      return;
    }
    // eslint-disable-next-line no-console
    console.error("Unhandled error:", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    });
  });

  return app;
}
