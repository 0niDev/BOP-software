import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { SqlDatabase } from "../db/types.js";
import { env } from "../env.js";
import { AppError, ConfigurationError, UnauthorizedError, ValidationError } from "../domain/errors.js";
import { isoDateSchema, optionalIsoDateSchema, validateIsoDate } from "../domain/dateValidation.js";
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
import { RestoreService } from "../services/restoreService.js";
import { ReturnsService } from "../services/returnsService.js";
import { ReportService } from "../services/reportService.js";
import { ReportXlsx, SHEET_MIME } from "../services/reportXlsx.js";
import { SalesInvoiceService } from "../services/salesInvoiceService.js";
import { SettingsService } from "../services/settingsService.js";
import type { MirrorService } from "../services/mirrorService.js";
import type { ReplicaService } from "../services/replicaService.js";
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

/** Recurrence frequency for expense items (null clears recurrence). */
const expenseFrequencySchema = z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]).nullish();

const returnSchema = z.object({
  invoiceId: z.coerce.number().int().positive(),
  returnDate: isoDateSchema,
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
  /** Extra desktop copy of every snapshot; null keeps it off (tests). */
  desktopDir?: string | null;
  /** Live local copy; when absent the mirror routes report it as unavailable. */
  mirror?: MirrorService;
  /** Cloud replica push; when absent the replica routes report it as unavailable. */
  replica?: ReplicaService;
  /**
   * Directory of a built client (`index.html` + `assets/`). When given *and* the
   * build is actually present, this process also serves the SPA — the
   * single-process production deployment. Left undefined, the app is API-only.
   */
  clientDir?: string | null;
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
  const reportXlsx = new ReportXlsx(db, companyId);
  const users = new UserService(db);
  const settings = new SettingsService(db, companyId);
  const dashboard = new DashboardService(db, companyId);
  const expenseItems = new ExpenseItemService(db, companyId);
  const assets = new AssetService(db, companyId);
  const restore = new RestoreService(db, companyId);
  const backups = new BackupService(
    db,
    options.engine ?? env.dbEngine,
    options.backupDir ?? env.backupDir,
    0,
    options.desktopDir ?? env.desktopDir,
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
    res.json(await accounts.listWithDeleteFlags(activeOnlyFlag(req)));
  });

  app.post("/api/accounts", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        accountCode: z.string().optional(),
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

  /** Hard delete — only accounts the service proved reference-free get here. */
  app.delete("/api/accounts/:id", requireAuth, async (req, res) => {
    await accounts.delete(Number(req.params.id));
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

  // The live copy: a continuously refreshed, portable SQLite file.
  app.get("/api/backup/mirror", requireAuth, async (_req, res) => {
    if (!options.mirror) throw new ConfigurationError("The live local copy is not configured.");
    res.json(await options.mirror.status());
  });

  app.post("/api/backup/mirror", requireAuth, async (_req, res) => {
    if (!options.mirror) throw new ConfigurationError("The live local copy is not configured.");
    await options.mirror.runNow();
    res.json(await options.mirror.status());
  });

  app.get("/api/backup/mirror/download", requireAuth, async (_req, res) => {
    if (!options.mirror) throw new ConfigurationError("The live local copy is not configured.");
    const file = await options.mirror.read();
    res
      .type("application/octet-stream")
      .setHeader("Content-Disposition", 'attachment; filename="erp_mirror.db"')
      .send(file);
  });

  app.get("/api/backups/:file/download", requireAuth, (req, res) => {
    const target = backups.resolve(String(req.params.file));
    res.download(target);
  });

  app.post("/api/backups/:file/restore", requireAuth, (req, res) => {
    backups.restore(String(req.params.file));
    res.json({ ok: true });
  });

  // --- cloud replica (local-primary mode) ---------------------------------
  app.get("/api/backup/replica", requireAuth, async (_req, res) => {
    if (!options.replica) throw new ConfigurationError("The cloud replica is not configured.");
    res.json(await options.replica.status());
  });

  app.post("/api/backup/replica/push", requireAuth, async (_req, res) => {
    if (!options.replica) throw new ConfigurationError("The cloud replica is not configured.");
    await options.replica.runNow();
    res.json(await options.replica.status());
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

  const assetUpdateSchema = z.object({
    assetName: z.string().min(1),
    assetCode: z.string().min(1).optional(),
    amount: z.number().positive(),
    purchaseDate: z.string().min(1),
    paymentType: z.enum(["CREDIT", "CASH", "BANK", "CHEQUE"]).optional(),
    classification: z.enum(["CURRENT", "NON_CURRENT"]).optional(),
    supplierId: z.number().int().positive().nullish(),
    dueDate: z.string().nullish(),
    notes: z.string().nullish(),
  });

  app.put("/api/assets/:id", requireAuth, async (req, res) => {
    const body = parseBody(assetUpdateSchema, req.body);
    res.json(await assets.update(Number(req.params.id), body));
  });

  app.delete("/api/assets/:id", requireAuth, async (req, res) => {
    const user = (req as Request & { user?: Session }).user;
    await assets.delete(Number(req.params.id), user?.userId ?? null);
    res.json({ ok: true });
  });

  app.post("/api/assets/:id/dispose", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        disposeDate: isoDateSchema,
        proceeds: z.coerce.number().min(0).optional(),
        notes: z.string().nullish(),
      }),
      req.body,
    );
    const user = (req as Request & { user?: Session }).user;
    res.json(
      await assets.dispose(Number(req.params.id), { ...body, userId: user?.userId ?? null }),
    );
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

  app.get("/api/sales-invoices/:id/payments", requireAuth, async (req, res) => {
    res.json(await sales.listPaymentsForInvoice(Number(req.params.id)));
  });

  app.post("/api/sales-invoices", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        customerId: z.coerce.number().int().positive(),
        invoiceDate: isoDateSchema,
        paymentType: z.enum(["CASH", "BANK", "CHEQUE", "CREDIT"]),
        invoiceNumber: z.string().min(1).nullish(),
        notes: z.string().nullish(),
        bankAccountId: z.coerce.number().int().positive().nullish(),
        warehouseId: z.coerce.number().int().positive().optional(),
        ignoreStock: z.boolean().optional(),
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

  app.put("/api/sales-invoices/:id", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        customerId: z.coerce.number().int().positive(),
        invoiceDate: isoDateSchema,
        paymentType: z.enum(["CASH", "BANK", "CHEQUE", "CREDIT"]),
        notes: z.string().nullish(),
        bankAccountId: z.coerce.number().int().positive().nullish(),
        warehouseId: z.coerce.number().int().positive().optional(),
        ignoreStock: z.boolean().optional(),
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
    res.json(
      await sales.updateSalesInvoice(Number(req.params.id), {
        ...body,
        createdBy: user?.userId ?? null,
      }),
    );
  });

  app.delete("/api/sales-invoices/:id", requireAuth, async (req, res) => {
    await sales.deleteSalesInvoice(Number(req.params.id));
    res.json({ ok: true });
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

  app.get("/api/purchase-invoices/:id/payments", requireAuth, async (req, res) => {
    res.json(await purchases.listPaymentsForInvoice(Number(req.params.id)));
  });

  app.post("/api/purchase-invoices", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        supplierId: z.coerce.number().int().positive(),
        invoiceDate: isoDateSchema,
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

  app.put("/api/purchase-invoices/:id", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        supplierId: z.coerce.number().int().positive(),
        invoiceDate: isoDateSchema,
        paymentType: z.enum(["CASH", "BANK", "CHEQUE", "CREDIT"]),
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
    res.json(
      await purchases.updatePurchaseInvoice(Number(req.params.id), {
        ...body,
        createdBy: user?.userId ?? null,
      }),
    );
  });

  app.delete("/api/purchase-invoices/:id", requireAuth, async (req, res) => {
    await purchases.deletePurchaseInvoice(Number(req.params.id));
    res.json({ ok: true });
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
        paymentDate: isoDateSchema,
        paymentMethod: z.enum(["CASH", "BANK", "CHEQUE"]),
        bankAccountId: z.coerce.number().int().positive().nullish(),
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
        paymentDate: isoDateSchema,
        paymentMethod: z.enum(["CASH", "BANK", "CHEQUE"]),
        bankAccountId: z.coerce.number().int().positive().nullish(),
        referenceNo: z.string().nullish(),
        notes: z.string().nullish(),
        salesInvoiceId: z.coerce.number().int().positive().nullish(),
      }),
      req.body,
    );
    res.status(201).json(await payments.receivePayment(body));
  });

  const paymentSchema = z.object({
    supplierId: z.coerce.number().int().positive(),
    amount: z.coerce.number().positive(),
    paymentDate: isoDateSchema,
    paymentMethod: z.enum(["CASH", "BANK", "CHEQUE"]),
    bankAccountId: z.coerce.number().int().positive().nullish(),
    referenceNo: z.string().nullish(),
    notes: z.string().nullish(),
  });

  const receiptSchema = z.object({
    customerId: z.coerce.number().int().positive(),
    amount: z.coerce.number().positive(),
    paymentDate: isoDateSchema,
    paymentMethod: z.enum(["CASH", "BANK", "CHEQUE"]),
    bankAccountId: z.coerce.number().int().positive().nullish(),
    referenceNo: z.string().nullish(),
    notes: z.string().nullish(),
  });

  app.put("/api/payments/:id", requireAuth, async (req, res) => {
    const body = parseBody(paymentSchema, req.body);
    const user = (req as Request & { user?: Session }).user;
    res.json(
      await payments.updatePayment(Number(req.params.id), {
        ...body,
        userId: user?.userId ?? null,
      }),
    );
  });

  app.delete("/api/payments/:id", requireAuth, async (req, res) => {
    const user = (req as Request & { user?: Session }).user;
    await payments.deletePayment(Number(req.params.id), user?.userId ?? null);
    res.json({ ok: true });
  });

  app.put("/api/receipts/:id", requireAuth, async (req, res) => {
    const body = parseBody(receiptSchema, req.body);
    const user = (req as Request & { user?: Session }).user;
    res.json(
      await payments.updateReceipt(Number(req.params.id), {
        ...body,
        userId: user?.userId ?? null,
      }),
    );
  });

  app.delete("/api/receipts/:id", requireAuth, async (req, res) => {
    const user = (req as Request & { user?: Session }).user;
    await payments.deleteReceipt(Number(req.params.id), user?.userId ?? null);
    res.json({ ok: true });
  });

  app.get("/api/boms", requireAuth, async (req, res) => {
    res.json(await manufacturing.listBoms(activeOnlyFlag(req)));
  });

  app.get("/api/boms/:id", requireAuth, async (req, res) => {
    res.json(await manufacturing.getBom(Number(req.params.id)));
  });

  app.post("/api/boms", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        finishedItemId: z.coerce.number().int().positive().nullish(),
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

  app.put("/api/boms/:id", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        finishedItemId: z.coerce.number().int().positive().nullish(),
        outputQuantity: z.coerce.number().positive(),
        bomName: z.string().nullish(),
        notes: z.string().nullish(),
        isActive: z.boolean().optional(),
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
    res.json(await manufacturing.updateBom(Number(req.params.id), body));
  });

  app.delete("/api/boms/:id", requireAuth, async (req, res) => {
    await manufacturing.deleteBom(Number(req.params.id));
    res.json({ ok: true });
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
        bomId: z.coerce.number().int().positive().nullish(),
        plannedQuantity: z.coerce.number().positive(),
        manufacturingDate: isoDateSchema,
        orderNumber: z.string().nullish(),
        expiryDate: optionalIsoDateSchema,
        notes: z.string().nullish(),
        warehouseId: z.coerce.number().int().positive().optional(),
        // Manual run: saves a per-unit BOM from the run's component totals.
        bomName: z.string().nullish(),
        components: z
          .array(
            z.object({
              componentItemId: z.coerce.number().int().positive(),
              quantityRequired: z.coerce.number().positive(),
              wastagePercent: z.coerce.number().min(0).max(100).optional(),
            }),
          )
          .nullish(),
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

  app.put("/api/production-orders/:id", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        bomId: z.coerce.number().int().positive(),
        plannedQuantity: z.coerce.number().positive(),
        manufacturingDate: isoDateSchema,
        expiryDate: optionalIsoDateSchema,
        notes: z.string().nullish(),
      }),
      req.body,
    );
    await manufacturing.updateProductionOrder(Number(req.params.id), body);
    res.json({ ok: true });
  });

  app.delete("/api/production-orders/:id", requireAuth, async (req, res) => {
    await manufacturing.deleteProductionOrder(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/production-orders/:id/produce", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        actualQuantity: z.coerce.number().positive(),
        wastageQuantity: z.coerce.number().min(0).optional(),
        outputBatchNumber: z.string().nullish(),
        ignoreStock: z.boolean().optional(),
      }),
      req.body,
    );
    res.json(await manufacturing.produceProduction(Number(req.params.id), body));
  });

  app.get("/api/packing-orders", requireAuth, async (_req, res) => {
    res.json(await manufacturing.listPackingOrders());
  });

  app.get("/api/packing-orders/:id", requireAuth, async (req, res) => {
    res.json(await manufacturing.getPackingOrder(Number(req.params.id)));
  });

  app.post("/api/packing-orders", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        bomId: z.coerce.number().int().positive().nullish(),
        plannedQuantity: z.coerce.number().positive(),
        manufacturingDate: isoDateSchema,
        orderNumber: z.string().nullish(),
        expiryDate: optionalIsoDateSchema,
        notes: z.string().nullish(),
        warehouseId: z.coerce.number().int().positive().optional(),
        // Manual run: saves a per-unit packing BOM from the run's totals.
        packingBomName: z.string().nullish(),
        outputItemId: z.coerce.number().int().positive().nullish(),
        unpackedItemId: z.coerce.number().int().positive().nullish(),
        unpackedQuantity: z.coerce.number().positive().nullish(),
        materials: z
          .array(
            z.object({
              componentItemId: z.coerce.number().int().positive(),
              quantityRequired: z.coerce.number().positive(),
              wastagePercent: z.coerce.number().min(0).max(100).optional(),
            }),
          )
          .nullish(),
      }),
      req.body,
    );
    const user = (req as Request & { user?: Session }).user;
    res.status(201).json(
      await manufacturing.createPackingOrder({ ...body, createdBy: user?.userId ?? null }),
    );
  });

  app.put("/api/packing-orders/:id", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        bomId: z.coerce.number().int().positive(),
        plannedQuantity: z.coerce.number().positive(),
        manufacturingDate: isoDateSchema,
        expiryDate: optionalIsoDateSchema,
        notes: z.string().nullish(),
      }),
      req.body,
    );
    await manufacturing.updatePackingOrder(Number(req.params.id), body);
    res.json({ ok: true });
  });

  app.delete("/api/packing-orders/:id", requireAuth, async (req, res) => {
    await manufacturing.deletePackingOrder(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/packing-orders/:id/start", requireAuth, async (req, res) => {
    await manufacturing.startPacking(Number(req.params.id));
    res.json({ status: "IN_PROGRESS" });
  });

  app.post("/api/packing-orders/:id/pack", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        units: z.coerce.number().positive().nullish(),
        unpackedQuantity: z.coerce.number().positive().nullish(),
        outputBatchNumber: z.string().nullish(),
        ignoreStock: z.boolean().optional(),
        materials: z
          .array(
            z.object({
              itemId: z.coerce.number().int().positive(),
              quantity: z.coerce.number().positive(),
            }),
          )
          .nullish(),
      }),
      req.body ?? {},
    );
    res.json(await manufacturing.packPackingOrder(Number(req.params.id), body));
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

  app.put("/api/expense-categories/:id", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        name: z.string().min(1).optional(),
        accountId: z.coerce.number().int().positive().nullish(),
        isActive: z.boolean().optional(),
      }),
      req.body,
    );
    res.json(await expenses.updateCategory(Number(req.params.id), body));
  });

  app.get("/api/expenses", requireAuth, async (_req, res) => {
    // Catch up any recurring bills before listing (no background scheduler).
    await expenseItems.generateDue();
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
        frequency: expenseFrequencySchema,
        nextRunDate: isoDateSchema.nullish(),
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
        frequency: expenseFrequencySchema,
        nextRunDate: isoDateSchema.nullish(),
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
        bankAccountId: z.coerce.number().int().positive().nullish(),
        expenseDate: isoDateSchema,
        payLater: z.boolean().optional(),
        dueDate: isoDateSchema.nullish(),
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
        expenseDate: isoDateSchema,
        amount: z.coerce.number().positive(),
        paymentMethod: z.enum(["CASH", "BANK", "CHEQUE"]),
        payLater: z.boolean().optional(),
        dueDate: isoDateSchema.nullish(),
        voucherNumber: z.string().nullish(),
        bankAccountId: z.coerce.number().int().positive().nullish(),
        description: z.string().nullish(),
      }),
      req.body,
    );
    const user = (req as Request & { user?: Session }).user;
    res.status(201).json(await expenses.createExpense({ ...body, createdBy: user?.userId ?? null }));
  });

  /** Settle an unpaid expense bill (Dr Accounts Payable / Cr cash|bank). */
  app.post("/api/expenses/:id/pay", requireAuth, async (req, res) => {
    const user = (req as Request & { user?: Session }).user;
    const body = parseBody(
      z.object({
        paymentMethod: z.enum(["CASH", "BANK", "CHEQUE"]),
        paymentDate: isoDateSchema.optional(),
        bankAccountId: z.coerce.number().int().positive().nullish(),
        chequeId: z.coerce.number().int().positive().nullish(),
      }),
      req.body,
    );
    res.json(
      await expenses.payExpense(Number(req.params.id), {
        ...body,
        createdBy: user?.userId ?? null,
      }),
    );
  });

  app.put("/api/expenses/:id", requireAuth, async (req, res) => {
    const body = parseBody(
      z.object({
        categoryId: z.coerce.number().int().positive(),
        expenseDate: isoDateSchema,
        amount: z.coerce.number().positive(),
        paymentMethod: z.enum(["CASH", "BANK", "CHEQUE"]),
        dueDate: isoDateSchema.nullish(),
        bankAccountId: z.coerce.number().int().positive().nullish(),
        chequeId: z.coerce.number().int().positive().nullish(),
        description: z.string().nullish(),
      }),
      req.body,
    );
    const user = (req as Request & { user?: Session }).user;
    res.json(
      await expenses.updateExpense(Number(req.params.id), {
        ...body,
        userId: user?.userId ?? null,
      }),
    );
  });

  app.delete("/api/expenses/:id", requireAuth, async (req, res) => {
    const user = (req as Request & { user?: Session }).user;
    await expenses.deleteExpense(Number(req.params.id), user?.userId ?? null);
    res.json({ ok: true });
  });

  /** Reverse the settlement of a pay-later bill (returns it to UNPAID). */
  app.delete("/api/expenses/:id/settlement", requireAuth, async (req, res) => {
    const user = (req as Request & { user?: Session }).user;
    await expenses.deleteExpenseSettlement(Number(req.params.id), user?.userId ?? null);
    res.json({ ok: true });
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
    date: isoDateSchema,
    referenceNo: z.string().nullish(),
    notes: z.string().nullish(),
  });

  app.post("/api/bank-transactions/deposit", requireAuth, async (req, res) => {
    res.status(201).json(await banking.deposit(parseBody(movementSchema, req.body)));
  });

  app.post("/api/bank-transactions/withdraw", requireAuth, async (req, res) => {
    res.status(201).json(await banking.withdraw(parseBody(movementSchema, req.body)));
  });

  app.put("/api/bank-transactions/:id", requireAuth, async (req, res) => {
    const body = parseBody(movementSchema.extend({ type: z.enum(["DEPOSIT", "WITHDRAWAL"]) }), req.body);
    const user = (req as Request & { user?: Session }).user;
    res.json(
      await banking.updateTransaction(Number(req.params.id), {
        ...body,
        userId: user?.userId ?? null,
      }),
    );
  });

  app.delete("/api/bank-transactions/:id", requireAuth, async (req, res) => {
    const user = (req as Request & { user?: Session }).user;
    await banking.deleteTransaction(Number(req.params.id), user?.userId ?? null);
    res.json({ ok: true });
  });

  app.get("/api/cheques", requireAuth, async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json(await banking.listCheques(status));
  });

  const chequeSchema = z.object({
    bankAccountId: z.coerce.number().int().positive(),
    chequeNumber: z.string().min(1),
    amount: z.coerce.number().positive(),
    chequeDate: isoDateSchema,
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

  app.put("/api/cheques/:id", requireAuth, async (req, res) => {
    const body = parseBody(chequeSchema, req.body);
    const user = (req as Request & { user?: Session }).user;
    res.json(
      await banking.updateCheque(Number(req.params.id), {
        ...body,
        userId: user?.userId ?? null,
      }),
    );
  });

  app.delete("/api/cheques/:id", requireAuth, async (req, res) => {
    const user = (req as Request & { user?: Session }).user;
    await banking.deleteCheque(Number(req.params.id), user?.userId ?? null);
    res.json({ ok: true });
  });

  app.post("/api/cheques/:id/cancel", requireAuth, async (req, res) => {
    const user = (req as Request & { user?: Session }).user;
    await banking.cancelCheque(Number(req.params.id), user?.userId ?? null);
    res.json({ ok: true });
  });

  app.get("/api/sales-returns", requireAuth, async (_req, res) => {
    res.json(await returns.listSalesReturns());
  });

  app.get("/api/sales-returns/:id", requireAuth, async (req, res) => {
    res.json(await returns.getSalesReturn(Number(req.params.id)));
  });

  app.post("/api/sales-returns", requireAuth, async (req, res) => {
    const body = parseBody(returnSchema, req.body);
    const user = (req as Request & { user?: Session }).user;
    res.status(201).json(await returns.createSalesReturn({ ...body, createdBy: user?.userId ?? null }));
  });

  app.put("/api/sales-returns/:id", requireAuth, async (req, res) => {
    const body = parseBody(returnSchema, req.body);
    const user = (req as Request & { user?: Session }).user;
    res.json(
      await returns.updateSalesReturn(Number(req.params.id), {
        ...body,
        createdBy: user?.userId ?? null,
      }),
    );
  });

  app.delete("/api/sales-returns/:id", requireAuth, async (req, res) => {
    const user = (req as Request & { user?: Session }).user;
    await returns.deleteSalesReturn(Number(req.params.id), user?.userId ?? null);
    res.json({ ok: true });
  });

  app.get("/api/purchase-returns", requireAuth, async (_req, res) => {
    res.json(await returns.listPurchaseReturns());
  });

  app.get("/api/purchase-returns/:id", requireAuth, async (req, res) => {
    res.json(await returns.getPurchaseReturn(Number(req.params.id)));
  });

  app.post("/api/purchase-returns", requireAuth, async (req, res) => {
    const body = parseBody(returnSchema, req.body);
    const user = (req as Request & { user?: Session }).user;
    res
      .status(201)
      .json(await returns.createPurchaseReturn({ ...body, createdBy: user?.userId ?? null }));
  });

  app.put("/api/purchase-returns/:id", requireAuth, async (req, res) => {
    const body = parseBody(returnSchema, req.body);
    const user = (req as Request & { user?: Session }).user;
    res.json(
      await returns.updatePurchaseReturn(Number(req.params.id), {
        ...body,
        createdBy: user?.userId ?? null,
      }),
    );
  });

  app.delete("/api/purchase-returns/:id", requireAuth, async (req, res) => {
    const user = (req as Request & { user?: Session }).user;
    await returns.deletePurchaseReturn(Number(req.params.id), user?.userId ?? null);
    res.json({ ok: true });
  });

  /** One manual journal voucher as a standalone Excel workbook. */
  app.get("/api/journal-entries/:id/export.xlsx", requireAuth, async (req, res) => {
    const file = await reportXlsx.journalVoucher(Number(req.params.id));
    res.attachment(file.fileName);
    res.type(SHEET_MIME);
    res.send(file.buffer);
  });

  /** Read any document's backing entry, e.g. sourceTable "expenses". */
  app.get("/api/journal-entries/:sourceTable/:sourceId", requireAuth, async (req, res) => {
    const entry = await accounting.getJournalEntry(
      String(req.params.sourceTable),
      Number(req.params.sourceId),
    );
    res.json(entry);
  });

  const asAtQuery = (req: Request): string | null =>
    typeof req.query.asAt === "string" && req.query.asAt ? req.query.asAt : null;

  const journalLineSchema = z.object({
    accountId: z.coerce.number().int().positive(),
    partyId: z.coerce.number().int().positive().nullish(),
    description: z.string().nullish(),
    debit: z.coerce.number().min(0).optional(),
    credit: z.coerce.number().min(0).optional(),
  });

  const manualJournalSchema = z.object({
    entryDate: isoDateSchema,
    narration: z.string().nullish(),
    referenceNo: z.string().nullish(),
    voucherNumber: z.string().nullish(),
    lines: z.array(journalLineSchema).min(2),
  });

  /** Manual journal vouchers (JV-), newest first. */
  app.get("/api/journal-entries", requireAuth, async (req, res) => {
    const { from, to } = dateRangeQuery(req);
    res.json(await accounting.listManualJournals({ from, to }));
  });

  app.post("/api/journal-entries", requireAuth, async (req, res) => {
    const user = (req as Request & { user?: Session }).user;
    const body = parseBody(manualJournalSchema, req.body);
    res
      .status(201)
      .json(
        await accounting.createManualJournal({ ...body, createdBy: user?.userId ?? null }),
      );
  });

  /** Correct a manual voucher by posting its opposite on a chosen date. */
  app.post("/api/journal-entries/:id/reverse", requireAuth, async (req, res) => {
    const user = (req as Request & { user?: Session }).user;
    const body = parseBody(
      z.object({
        reversalDate: isoDateSchema.optional(),
        narration: z.string().nullish(),
      }),
      req.body ?? {},
    );
    res.status(201).json(
      await accounting.reverseManualJournal(Number(req.params.id), {
        ...body,
        createdBy: user?.userId ?? null,
      }),
    );
  });

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

  const dateRangeQuery = (req: Request): { from?: string; to?: string } => {
    const from = typeof req.query.from === "string" && req.query.from ? req.query.from : undefined;
    const to = typeof req.query.to === "string" && req.query.to ? req.query.to : undefined;
    if (from) validateIsoDate(from);
    if (to) validateIsoDate(to);
    return { from, to };
  };

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

  // --- Excel (.xlsx) exports of the same reports --------------------------
  // One workbook per report, plus one workbook holding all four period reports.
  // The bytes come from the same services the on-screen tabs use, so a printed
  // workbook cannot disagree with the report it was printed from.
  const sendXlsx = (res: Response, fileName: string, buffer: Buffer): void => {
    // attachment() sets Content-Disposition and picks a type from the extension;
    // the explicit type() makes the Excel mime type certain.
    res.attachment(fileName);
    res.type(SHEET_MIME);
    res.send(buffer);
  };

  app.get("/api/reports/trial-balance.xlsx", requireAuth, async (req, res) => {
    const { from, to } = dateRangeQuery(req);
    const file = await reportXlsx.trialBalance({ from, to });
    sendXlsx(res, file.fileName, file.buffer);
  });

  app.get("/api/reports/profit-and-loss.xlsx", requireAuth, async (req, res) => {
    const { from, to } = dateRangeQuery(req);
    const file = await reportXlsx.profitAndLoss({ from, to });
    sendXlsx(res, file.fileName, file.buffer);
  });

  app.get("/api/reports/balance-sheet.xlsx", requireAuth, async (req, res) => {
    const file = await reportXlsx.balanceSheet({ kind: "balance-sheet", asAt: asAtQuery(req) });
    sendXlsx(res, file.fileName, file.buffer);
  });

  app.get("/api/reports/cash-book.xlsx", requireAuth, async (req, res) => {
    const { from, to } = dateRangeQuery(req);
    const file = await reportXlsx.cashBook({ from, to });
    sendXlsx(res, file.fileName, file.buffer);
  });

  app.get("/api/reports/party-ledger.xlsx", requireAuth, async (req, res) => {
    const query = parseBody(
      z.object({
        partyId: z.coerce.number().int().positive(),
        from: z.string().optional(),
        to: z.string().optional(),
      }),
      req.query,
    );
    const { from, to } = dateRangeQuery(req);
    const file = await reportXlsx.partyLedger({
      kind: "party-ledger",
      partyId: query.partyId,
      from,
      to,
    });
    sendXlsx(res, file.fileName, file.buffer);
  });

  app.get("/api/reports/export-all.xlsx", requireAuth, async (req, res) => {
    const { from, to } = dateRangeQuery(req);
    const file = await reportXlsx.all({ from, to });
    sendXlsx(res, file.fileName, file.buffer);
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

  // --- keyboard shortcuts (the desktop app's Shortcuts tab) ----------------
  app.get("/api/settings/shortcuts", requireAuth, async (_req, res) => {
    res.json(await settings.listShortcuts(companyId));
  });

  app.put("/api/settings/shortcuts/:actionId", requireAuth, async (req, res) => {
    const body = parseBody(z.object({ sequence: z.string().min(1) }), req.body);
    res.json(await settings.updateShortcut(companyId, String(req.params.actionId), body.sequence));
  });

  // Registered before `/api/settings/:group` so "shortcuts" is not read as a group.
  app.delete("/api/settings/shortcuts/:actionId", requireAuth, async (req, res) => {
    res.json(await settings.resetShortcut(companyId, String(req.params.actionId)));
  });

  app.delete("/api/settings/shortcuts", requireAuth, async (_req, res) => {
    res.json({ removed: await settings.resetAllShortcuts(companyId) });
  });

  // --- read-only database connection info (the desktop app's Database tab) --
  app.get("/api/settings/database", requireAuth, async (_req, res) => {
    res.json(await settings.databaseInfo());
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

  // --- audit trail / restore ---------------------------------------------
  app.get("/api/audit/deleted", requireAuth, async (_req, res) => {
    res.json(await restore.listDeleted());
  });

  app.post("/api/audit/:id/restore", requireAuth, async (req, res) => {
    const user = (req as Request & { user?: Session }).user;
    res.json(await restore.restore(Number(req.params.id), user?.userId ?? null));
  });

  // --- built client (single-process production mode) ----------------------
  // Only mounted when a build is configured *and* present, so a development
  // run (Vite serves the client) is never affected and a missing build degrades
  // to an API-only server instead of a confusing 404 on every page.
  const clientDir = options.clientDir ?? null;
  const clientIndex = clientDir ? path.join(clientDir, "index.html") : null;
  if (clientDir && clientIndex) {
    if (existsSync(clientIndex)) {
      app.use(
        express.static(clientDir, {
          index: false,
          setHeaders: (res, filePath) => {
            // Vite writes content-hashed filenames under assets/, so those are
            // safe to cache forever; index.html must always be revalidated or
            // clients keep loading a stale bundle after a deploy.
            const immutable = filePath.split(path.sep).includes("assets");
            res.setHeader(
              "cache-control",
              immutable ? "public, max-age=31536000, immutable" : "no-cache",
            );
          },
        }),
      );
      // SPA fallback: a GET that is not an API call returns index.html (this
      // also serves `/`, because static is mounted with `index: false`). Written
      // as a RegExp because Express 5 (path-to-regexp v8) rejects a bare "*".
      app.get(/^\/(?!api\/).*/, (_req, res) => {
        // The shell must never be cached by the browser, otherwise a deploy
        // keeps serving the previous bundle. `cacheControl: false` stops
        // sendFile() from overwriting this with its own `max-age=0` default.
        res.setHeader("cache-control", "no-cache");
        res.sendFile(clientIndex, { cacheControl: false });
      });
      console.log(`[client] serving the built client from ${clientDir}`);
    } else {
      console.warn(`[client] no build found at ${clientIndex} — serving the API only.`);
    }
  }

  // --- error handling ----------------------------------------------------
  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Unknown endpoint." } });
  });

  /**
   * Global HTTP error middleware. Express only enters this handler for errors
   * passed to `next()` or thrown inside an async route handler, so a fatal
   * database fault that escapes a route lands here rather than crashing the
   * process. `AppError` subclasses map to their intended HTTP status;
   * `DatabaseError` always surfaces as 500 because connection drops are not
   * client-correctable.
   */
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const timestamp = new Date().toISOString();
    if (err instanceof AppError) {
      // Structured log so an incident can be traced back to a specific request
      // window without piecing together the prose response body.
      console.error(
        `[${timestamp}] HTTP ${err.status} ${err.code}: ${err.message}`,
        err.details ? String(err.details) : "",
      );
      res.status(err.status).json({
        error: { code: err.code, message: err.message, details: err.details },
      });
      return;
    }

    // Unknown failure: log with a timestamp and return a safe 500.
    console.error(`[${timestamp}] internal error:`, err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    });
  });

  return app;
}
