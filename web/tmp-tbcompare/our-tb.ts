import { writeFileSync } from "node:fs";
import { createDatabase, closeDb } from "../server/src/db/index.js";
import { ReportService } from "../server/src/services/reportService.js";
import { layoutTrialBalance } from "../server/src/services/trialBalanceLayout.js";

const db = createDatabase();
const svc = new ReportService(db, 1);
const report = await svc.trialBalance({ from: "2026-11-01", to: "2026-11-15" });
const sections = layoutTrialBalance(report.rows);

const out = {
  from: "2026-11-01",
  to: "2026-11-15",
  totalDebit: report.totalDebit,
  totalCredit: report.totalCredit,
  balanced: report.balanced,
  sections: sections.map((s) => ({
    type: s.type,
    label: s.label,
    closingDebit: s.closingDebit,
    closingCredit: s.closingCredit,
    rows: s.rows.map((r) => ({
      accountCode: r.accountCode,
      displayCode: r.displayCode,
      accountName: r.accountName,
      accountType: r.accountType,
      depth: r.depth,
      hasChildren: r.hasChildren,
      openingDebit: r.openingDebit,
      openingCredit: r.openingCredit,
      debit: r.debit,
      credit: r.credit,
      closingDebit: r.closingDebit,
      closingCredit: r.closingCredit,
      tagBreakdown: r.tagBreakdown ?? [],
      soldValue: r.soldValue ?? null,
      usedValue: r.usedValue ?? null,
      consumedValue: r.consumedValue ?? null,
    })),
  })),
};
writeFileSync("tmp-tbcompare/ours.json", JSON.stringify(out, null, 1));
console.log(
  `rows=${report.rows.length} totalDr=${report.totalDebit} totalCr=${report.totalCredit} balanced=${report.balanced}`,
);
await closeDb();
