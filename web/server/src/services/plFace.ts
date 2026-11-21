/**
 * The printed Profit & Loss face.
 *
 * The paper layout is fixed: line order, wording, indentation and note numbers
 * never come from the editable notes template. The screen and every P&L export
 * read this list, so a workbook cannot disagree with the report it was printed
 * from.
 */
import type { CustomReportHeadingResult, CustomReportRow } from "./customReportService.js";

export interface PlFaceLineSpec {
  /** Heading whose value this line prints; omitted for section/end lines. */
  headingId?: string;
  label: string;
  /** Printed note/reference number, right-aligned. */
  note?: string;
  /** 0 sits on the left margin, 1 prints under the section above it. */
  depth?: number;
  bold?: boolean;
  /** A caption line (Operating Expenses) prints no figure of its own. */
  noAmount?: boolean;
}

export interface PlFaceLine extends PlFaceLineSpec {
  value: number;
  side: "Dr" | "Cr" | "";
  /** Account rows behind the line, for "include account detail" exports. */
  rows: CustomReportRow[];
}

export const PL_FACE_LINES: readonly PlFaceLineSpec[] = [
  { headingId: "sales-net", label: "Sales - Net", note: "20" },
  { headingId: "cost-of-sales", label: "Cost of Sales", note: "21" },
  { headingId: "gross-profit", label: "Gross Profit/(Loss)", depth: 1, bold: true },
  { headingId: "operating-expenses", label: "Operating Expenses", noAmount: true },
  {
    headingId: "administrative-expenses",
    label: "Administrative Expenses",
    note: "22",
    depth: 1,
  },
  {
    headingId: "selling-distribution-expenses",
    label: "Selling & Distribution",
    note: "23",
    depth: 1,
  },
  { headingId: "operating-profit", label: "Operating Profit/(Loss)", bold: true },
  { headingId: "other-income", label: "Other Income", note: "24" },
  { headingId: "financial-charges", label: "Financial Charges", note: "25" },
  { headingId: "others", label: "Others", note: "26" },
  {
    headingId: "profit-before-tax",
    label: "Profit/(Loss) Before Taxation",
    depth: 1,
    bold: true,
  },
  { headingId: "taxation-current", label: "Taxation (Current)", note: "27" },
  {
    headingId: "profit-after-tax",
    label: "Profit/(Loss) After Taxation",
    depth: 1,
    bold: true,
  },
  { headingId: "prior-year-adjustment", label: "Prior Year Adjustment", note: "28", depth: 1 },
  {
    headingId: "accumulated-profit-bf",
    label: "Acc. Profit/(Loss) B/F (y/opening)",
    note: "29",
    depth: 1,
  },
  { headingId: "profit-cf", label: "Profit/(Loss) C/F to B/Sheet", depth: 1, bold: true },
];

/** Resolve the fixed face onto the values from the default-template headings. */
export function resolvePlFace(
  headings: readonly CustomReportHeadingResult[],
): PlFaceLine[] {
  const byId = new Map(headings.map((heading) => [heading.id, heading]));
  return PL_FACE_LINES.map((line) => {
    const heading = line.headingId ? byId.get(line.headingId) : undefined;
    return {
      ...line,
      value: heading?.value ?? 0,
      side: heading?.side ?? "",
      rows: heading?.rows ?? [],
    };
  });
}
