import { writeFileSync } from "node:fs";
import { LocalSqliteDatabase } from "../server/src/db/localSqlite.js";
import { seedDemoData } from "../server/src/seedData.js";
import { ReportPdf } from "../server/src/services/reportPdf.js";
import { SalesInvoiceService } from "../server/src/services/salesInvoiceService.js";

const db = new LocalSqliteDatabase(":memory:");
const ids = await seedDemoData(db);
const sales = new SalesInvoiceService(db);
await sales.createSalesInvoice({
  customerId: ids.customerId,
  invoiceDate: "2026-10-20",
  paymentType: "CREDIT",
  items: [{ itemId: ids.itemId, quantity: 2, unitPrice: 150 }],
});
await sales.createSalesInvoice({
  customerId: ids.supplierId,
  invoiceDate: "2026-10-20",
  paymentType: "CREDIT",
  items: [{ itemId: ids.itemId, quantity: 1, unitPrice: 9 }],
});
const pdf = new ReportPdf(db);
const file = await pdf.chartOfAccounts();
writeFileSync("/tmp/coa-sample.pdf", file.buffer);
console.log(file.fileName, file.buffer.length);
await db.close();
