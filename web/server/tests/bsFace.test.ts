import { describe, expect, it } from "vitest";
import { customerAdvancesFrom, resolveBsFace } from "../src/services/bsFace.js";
import type { CustomReportResult, CustomReportHeadingResult } from "../src/services/customReportService.js";

function heading(id: string, value: number, side: "Dr" | "Cr" | "" = "Dr"): CustomReportHeadingResult {
  return {
    id,
    name: id,
    kind: "accounts",
    accountIds: [],
    parts: [],
    value,
    side,
    rows: [],
  };
}

/** A balanced account report: assets 800 = liabilities 350 + equity 450. */
function sampleReport(): CustomReportResult {
  return {
    kind: "BS",
    headings: [
      heading("fixed-assets", 0),
      heading("leased-assets", 0),
      heading("inventory", 0),
      heading("receivables", 500),
      heading("cash-bank", 200),
      heading("other-current-assets", 100),
      heading("non-current-liabilities", 0, "Cr"),
      heading("current-liabilities", 300, "Cr"),
      heading("taxes-other", 50, "Cr"),
      heading("equity-capital", 400, "Cr"),
      heading("net-profit", 50, "Cr"),
    ],
    unassigned: { value: 0, side: "", rows: [] },
    footer: [
      { label: "Assets", value: 800, side: "Dr" },
      { label: "Liabilities", value: 350, side: "Cr" },
      { label: "Equity (incl. net profit)", value: 450, side: "Cr" },
      { label: "Net profit", value: 50, side: "Cr" },
    ],
    balanced: true,
  };
}

describe("balance-sheet party split", () => {
  it("counts only customers in credit as advances", () => {
    const advances = customerAdvancesFrom([
      { partyType: "CUSTOMER", side: "PAYABLE", balance: -120 },
      { partyType: "CUSTOMER", side: "RECEIVABLE", balance: 500 },
      { partyType: "SUPPLIER", side: "PAYABLE", balance: -300 },
      { partyType: "SUPPLIER", side: "RECEIVABLE", balance: 40 },
      { partyType: "CUSTOMER", side: "ZERO", balance: 0 },
    ]);
    expect(advances).toBe(120);
  });

  it("grosses receivables by advances, keeps supplier payables at the control, and stays balanced", () => {
    const face = resolveBsFace(sampleReport(), {
      customerReceivable: 620,
      customerAdvances: 120,
      supplierPayable: 300,
    });

    const line = (label: string) =>
      [...face.left, ...face.right].find((entry) => entry.label === label);

    expect(line("Customer receivables")?.value).toBe(620);
    expect(line("Supplier payables")?.value).toBe(300);
    expect(line("Customer advances")?.value).toBe(120);
    // Both totals carry the same advances gross-up and agree with the books.
    expect(face.totalAssets.value).toBe(920);
    expect(face.totalEquityLiabilities.value).toBe(920);
    expect(face.balanced).toBe(true);
  });
});
