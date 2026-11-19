/**
 * Printed Profit & Loss face.
 *
 * The paper layout is fixed here: the line order, wording, indentation and note
 * numbers never come from the editable template, so the statement always prints
 * the same way and cannot be edited from the report. Heading edits belong to the
 * notes (Notes page) and only change the notes.
 */
import { Fragment } from "react";
import { moneySide } from "../lib/format";
import type { CustomReport } from "../types";

interface FaceLine {
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

const FACE_LINES: FaceLine[] = [
  { headingId: "sales-net", label: "Sales - Net", note: "20" },
  { headingId: "cost-of-sales", label: "Cost of Sales", note: "21" },
  { headingId: "gross-profit", label: "Gross Profit/(Loss)", depth: 1, bold: true },
  { headingId: "operating-expenses", label: "Operating Expenses", noAmount: true },
  { headingId: "administrative-expenses", label: "Administrative Expenses", note: "22", depth: 1 },
  { headingId: "selling-distribution-expenses", label: "Selling & Distribution", note: "23", depth: 1 },
  { headingId: "operating-profit", label: "Operating Profit/(Loss)", bold: true },
  { headingId: "other-income", label: "Other Income", note: "24" },
  { headingId: "financial-charges", label: "Financial Charges", note: "25" },
  { headingId: "others", label: "Others", note: "26" },
  { headingId: "profit-before-tax", label: "Profit/(Loss) Before Taxation", depth: 1, bold: true },
  { headingId: "taxation-current", label: "Taxation (Current)", note: "27" },
  { headingId: "profit-after-tax", label: "Profit/(Loss) After Taxation", depth: 1, bold: true },
  { headingId: "prior-year-adjustment", label: "Prior Year Adjustment", note: "28", depth: 1 },
  {
    headingId: "accumulated-profit-bf",
    label: "Acc. Profit/(Loss) B/F (y/opening)",
    note: "29",
    depth: 1,
  },
  { headingId: "profit-cf", label: "Profit/(Loss) C/F to B/Sheet", depth: 1, bold: true },
];

/** Read-only printed P&L. Values come from the fixed face; nothing is editable. */
export default function PLFace({ report }: { report: CustomReport }) {
  const source = report.face ?? report.headings;
  const byId = new Map(source.map((heading) => [heading.id, heading]));

  return (
    <div style={{ maxWidth: 720 }}>
      <table className="pl-face">
        <thead>
          <tr>
            <th>Description</th>
            <th className="num">Amount</th>
            <th className="num">Note</th>
          </tr>
        </thead>
        <tbody>
          {FACE_LINES.map((line) => {
            const heading = line.headingId ? byId.get(line.headingId) : undefined;
            return (
              <Fragment key={line.headingId ?? line.label}>
                <tr className={line.bold ? "total" : undefined}>
                  <td style={{ paddingLeft: 16 * (1 + (line.depth ?? 0)) }}>{line.label}</td>
                  <td className="num">
                    {line.noAmount ? "" : heading ? moneySide(heading.value, heading.side) : "—"}
                  </td>
                  <td className="num">{line.note ?? ""}</td>
                </tr>
              </Fragment>
            );
          })}
          <tr>
            <td colSpan={3} style={{ paddingTop: 24 }}>
              <em>*** End of Report ***</em>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
