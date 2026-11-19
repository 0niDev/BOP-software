import { writeFileSync } from "node:fs";
import { createDatabase, closeDb } from "../server/src/db/index.js";
import { ReportService } from "../server/src/services/reportService.js";

const db = createDatabase();
const svc = new ReportService(db, 1);

const ranges = [
  { name: "oct", from: "2026-10-01", to: "2026-10-31" },
  { name: "nov1_15", from: "2026-11-01", to: "2026-11-15" },
  { name: "all", from: undefined, to: undefined },
];

const out = {};
for (const r of ranges) {
  const report = await svc.trialBalance({ from: r.from, to: r.to });
  out[r.name] = {
    totalDebit: report.totalDebit,
    totalCredit: report.totalCredit,
    rows: report.rows.map((x) => ({
      accountCode: x.accountCode,
      displayCode: x.displayCode,
      accountName: x.accountName,
      type: x.accountType,
      od: x.openingDebit,
      oc: x.openingCredit,
      pd: x.debit,
      pc: x.credit,
      cd: x.closingDebit,
      cc: x.closingCredit,
    })),
  };
  console.log(r.name, report.totalDebit, report.totalCredit, report.rows.length);
}
writeFileSync("tmp-tbcompare/ours-ranges.json", JSON.stringify(out, null, 1));
await closeDb();
