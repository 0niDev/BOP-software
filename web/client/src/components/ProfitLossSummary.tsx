/**
 * Compact printed P&L: a flat copy of the saved custom headings in their own
 * order, subtotals bold. Values come from the detailed custom P&L, so the
 * summary can never disagree with it.
 */
import { money } from "../lib/format";
import type { CustomReport } from "../types";

export interface SummaryRow {
  name: string;
  note?: string;
  value: number;
  bold: boolean;
}

/** The summary lines, mirroring the edited headings. */
export function plSummaryRows(report: CustomReport): SummaryRow[] {
  return report.headings.map((heading) => ({
    name: heading.name,
    note: heading.note,
    value: heading.value,
    bold: heading.kind === "subtotal",
  }));
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
          {plSummaryRows(report).map((row, index) => (
            <tr key={index} className={row.bold ? "total" : undefined}>
              <td style={{ paddingLeft: 16 }}>{row.name}</td>
              <td className="num">{row.note ?? ""}</td>
              <td className="num">{money(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
