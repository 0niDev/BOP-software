/**
 * Compact printed P&L: the note 20-29 headings only, with the operating-expense
 * lines indented under their section. Values come from the detailed custom P&L,
 * so the summary can never disagree with it.
 */
import { money } from "../lib/format";
import type { CustomReport } from "../types";

interface SummaryRow {
  name: string;
  note?: string;
  value: number;
  depth: 0 | 1;
  bold: boolean;
}

const ROWS: Array<{
  id: string;
  fallback: string;
  note?: string;
  depth?: 0 | 1;
  bold?: boolean;
}> = [
  { id: "sales-net", fallback: "Sales - Net", note: "20" },
  { id: "cost-of-sales", fallback: "Cost of Sales", note: "21" },
  { id: "gross-profit", fallback: "Gross Profit/(Loss)", bold: true },
  { id: "operating-expenses", fallback: "Operating Expenses", bold: true },
  { id: "administrative-expenses", fallback: "Administrative Expenses", note: "22", depth: 1 },
  { id: "selling-distribution", fallback: "Selling & Distribution", note: "23", depth: 1 },
  { id: "operating-profit", fallback: "Operating Profit/(Loss)", bold: true },
  { id: "other-income", fallback: "Other Income", note: "24" },
  { id: "financial-charges", fallback: "Financial Charges", note: "25" },
  { id: "others", fallback: "Others", note: "26" },
  { id: "profit-before-tax", fallback: "Profit/(Loss) Before Taxation", bold: true },
  { id: "taxation-current", fallback: "Taxation (Current)", note: "27" },
  { id: "profit-after-tax", fallback: "Profit/(Loss) After Taxation", bold: true },
  { id: "prior-year-adjustment", fallback: "Prior Year Adjustment", note: "28" },
  {
    id: "accumulated-profit-bf",
    fallback: "Acc. Profit/(Loss) B/F (y/opening)",
    note: "29",
  },
  { id: "profit-cf", fallback: "Profit/(Loss) C/F to B/Sheet", bold: true },
];

/** The summary lines in printed order. */
export function plSummaryRows(report: CustomReport): SummaryRow[] {
  const byId = new Map(report.headings.map((heading) => [heading.id, heading]));
  return ROWS.map((row) => {
    const heading = byId.get(row.id);
    return {
      name: heading?.name ?? row.fallback,
      note: heading?.note ?? row.note,
      value: heading?.value ?? 0,
      depth: row.depth ?? 0,
      bold: row.bold ?? false,
    };
  });
}

export default function ProfitLossSummary({ report }: { report: CustomReport }) {
  return (
    <div style={{ maxWidth: 680 }}>
      <table>
        <thead>
          <tr>
            <th>Heading</th>
            <th className="num">Note</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {plSummaryRows(report).map((row) => (
            <tr key={row.name + row.note} className={row.bold ? "total" : undefined}>
              <td style={{ paddingLeft: 16 + row.depth * 18 }}>{row.name}</td>
              <td className="num">{row.note ?? ""}</td>
              <td className="num">{money(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
