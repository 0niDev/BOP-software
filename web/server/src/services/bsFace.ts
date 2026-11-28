/**
 * The printed Balance Sheet face.
 *
 * Like the P&L face, the paper layout is fixed: the two columns, the order of
 * the sections, the labels and the totals never come from the editable notes
 * template. Account lines come from the default (classified) template; the
 * receivables / payables lines are grossed up from the party sub-ledger:
 * customer advances (customers in credit) sit inside Accounts Receivable, so
 * the face adds them back to receivables and shows them as a liability. Both
 * sides grow by the same amount, so the sheet always stays in balance.
 */
import type { CustomReportResult, CustomReportRow } from "./customReportService.js";

/** The figures behind the gross receivables / payables split. */
export interface PartySplit {
  /** Accounts Receivable control, grossed up by customer advances. */
  customerReceivable: number;
  /** Customers in credit — advances we owe them. */
  customerAdvances: number;
  /** Accounts Payable control (suppliers we owe, net of prepayments). */
  supplierPayable: number;
}

export const EMPTY_PARTY_SPLIT: PartySplit = {
  customerReceivable: 0,
  customerAdvances: 0,
  supplierPayable: 0,
};

/** The fields of a party-balance row this split needs. */
interface PartyBalanceLike {
  partyType: string;
  side: "PAYABLE" | "RECEIVABLE" | "ZERO";
  balance: number;
}

/** Customers in credit: the advances netted inside Accounts Receivable. */
export function customerAdvancesFrom(balances: readonly PartyBalanceLike[]): number {
  let total = 0;
  for (const row of balances) {
    // "BOTH" parties do not occur in the chart; if one appears it counts as a
    // customer, the conservative trade default.
    if (row.side === "PAYABLE" && row.partyType !== "SUPPLIER") {
      total += Math.abs(row.balance);
    }
  }
  return total;
}

export interface BsFaceLineSpec {
  /** Heading whose value this line prints; omitted for section/total lines. */
  headingId?: string;
  /** Party-sub-ledger figure this line prints (the gross payables split). */
  party?: keyof PartySplit;
  label: string;
  /** Printed note/reference number, right-aligned. */
  note?: string;
  /** 0 sits on the column margin, 1 prints under the section above it. */
  depth?: number;
  bold?: boolean;
  /** A section caption (Non-current assets) prints no figure of its own. */
  noAmount?: boolean;
  /** Party lines only: the side the figure naturally sits on. */
  partySide?: "Dr" | "Cr";
}

export interface BsFaceLine extends BsFaceLineSpec {
  value: number;
  side: "Dr" | "Cr" | "";
  /** Account rows behind the line, for "include account detail" / expand. */
  rows: CustomReportRow[];
}

export interface BsFace {
  leftTitle: string;
  rightTitle: string;
  left: BsFaceLine[];
  right: BsFaceLine[];
  totalAssets: BsFaceLine;
  totalEquityLiabilities: BsFaceLine;
  balanced: boolean;
}

/** Assets column, non-current above current, receivables shown gross. */
export const BS_FACE_LEFT: readonly BsFaceLineSpec[] = [
  { label: "Non-current assets", noAmount: true, bold: true },
  { headingId: "fixed-assets", label: "Fixed assets", depth: 1 },
  { headingId: "leased-assets", label: "Leased assets", depth: 1 },
  { label: "Current assets", noAmount: true, bold: true },
  { headingId: "inventory", label: "Inventory", depth: 1 },
  { party: "customerReceivable", label: "Customer receivables", depth: 1, partySide: "Dr", note: "4" },
  { headingId: "cash-bank", label: "Cash & bank", depth: 1 },
  { headingId: "other-current-assets", label: "Other current assets", depth: 1 },
];

/** Equity & liabilities column, payables split, then equity. */
export const BS_FACE_RIGHT: readonly BsFaceLineSpec[] = [
  { label: "Non-current liabilities", noAmount: true, bold: true },
  { headingId: "non-current-liabilities", label: "Long term liabilities", depth: 1 },
  { label: "Current liabilities", noAmount: true, bold: true },
  { party: "supplierPayable", label: "Supplier payables", depth: 1, partySide: "Cr", note: "8" },
  { party: "customerAdvances", label: "Customer advances", depth: 1, partySide: "Cr", note: "8" },
  { headingId: "taxes-other", label: "Taxes & other current liabilities", depth: 1 },
  { label: "Equity", noAmount: true, bold: true },
  { headingId: "equity-capital", label: "Capital & earnings", depth: 1 },
  { headingId: "net-profit", label: "Net profit (P&L)", depth: 1 },
];

/** The face lines in reading order (left column, its total, right column, its total). */
export function bsFaceLines(face: BsFace): BsFaceLine[] {
  return [...face.left, face.totalAssets, ...face.right, face.totalEquityLiabilities];
}

/** Resolve the fixed face onto the default template and the party split. */
export function resolveBsFace(
  report: CustomReportResult,
  split: PartySplit = EMPTY_PARTY_SPLIT,
): BsFace {
  const byId = new Map(report.headings.map((heading) => [heading.id, heading]));
  const resolve = (spec: BsFaceLineSpec): BsFaceLine => {
    if (spec.party) {
      const value = split[spec.party];
      return {
        ...spec,
        value,
        side: value === 0 ? "" : (spec.partySide ?? (value > 0 ? "Dr" : "Cr")),
        rows: [],
      };
    }
    const heading = spec.headingId ? byId.get(spec.headingId) : undefined;
    return {
      ...spec,
      note: spec.note ?? heading?.note,
      value: heading?.value ?? 0,
      side: heading?.side ?? "",
      rows: heading?.rows ?? [],
    };
  };
  const left = BS_FACE_LEFT.map(resolve);
  const right = BS_FACE_RIGHT.map(resolve);

  // Totals come from the standard account footers plus the advances gross-up,
  // so they always agree with the books (and stay balanced) even if a legacy
  // sub-ledger drifts from its control account.
  const footer = new Map(report.footer.map((line) => [line.label, line.value]));
  const sumAssets = (footer.get("Assets") ?? 0) + split.customerAdvances;
  const sumLiabilities =
    (footer.get("Liabilities") ?? 0) +
    (footer.get("Equity (incl. net profit)") ?? 0) +
    split.customerAdvances;

  return {
    leftTitle: "Assets",
    rightTitle: "Equity & Liabilities",
    left,
    right,
    totalAssets: {
      label: "Total assets",
      bold: true,
      value: sumAssets,
      side: sumAssets === 0 ? "" : sumAssets > 0 ? "Dr" : "Cr",
      rows: [],
    },
    totalEquityLiabilities: {
      label: "Total equity & liabilities",
      bold: true,
      value: sumLiabilities,
      side: sumLiabilities === 0 ? "" : sumLiabilities > 0 ? "Cr" : "Dr",
      rows: [],
    },
    balanced: Math.abs(sumAssets - sumLiabilities) < 0.01,
  };
}
