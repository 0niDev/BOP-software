import { Fragment } from "react";
import { money } from "../lib/format";
import type { CustomReport } from "../types";

function amount(value: number): string {
  return value === 0 ? "—" : money(value);
}

/**
 * The custom P&L / balance sheet: one bold heading row with its total, the
 * picked accounts and their sub-accounts beneath, then the unassigned line and
 * the standard-report totals so the custom view can be checked against them.
 */
export default function CustomReportTable({ report }: { report: CustomReport }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Heading / Account</th>
          <th>Code</th>
          <th className="num">Amount</th>
          <th className="num">Note</th>
        </tr>
      </thead>
      <tbody>
        {report.headings.map((heading) => (
          <Fragment key={heading.id}>
            <tr className="total">
              <td colSpan={2}>{heading.name}</td>
              <td className="num">{amount(heading.value)}</td>
              <td className="num">{heading.note ?? ""}</td>
            </tr>
            {heading.rows.map((row) => (
              <tr key={`${heading.id}-${row.accountId}`}>
                <td
                  style={{
                    paddingLeft: 16 + row.depth * 14,
                    fontWeight: row.selected ? 600 : 400,
                  }}
                >
                  {row.name}
                </td>
                <td>
                  <span className="coa-code">{row.code}</span>
                </td>
                <td className="num">{amount(row.value)}</td>
                <td />
              </tr>
            ))}
          </Fragment>
        ))}
        {report.unassigned.rows.length > 0 && (
          <>
            <tr className="total">
              <td colSpan={2}>Unassigned (not in any heading)</td>
              <td className="num">{amount(report.unassigned.value)}</td>
              <td />
            </tr>
            {report.unassigned.rows.map((row) => (
              <tr key={`unassigned-${row.accountId}`}>
                <td style={{ paddingLeft: 16 }}>{row.name}</td>
                <td>
                  <span className="coa-code">{row.code}</span>
                </td>
                <td className="num">{amount(row.value)}</td>
                <td />
              </tr>
            ))}
          </>
        )}
        {report.headings.length === 0 && report.unassigned.rows.length === 0 && (
          <tr>
            <td colSpan={4}>No headings yet — use “Edit headings” to add one.</td>
          </tr>
        )}
      </tbody>
      <tfoot>
        {report.footer.map((line) => (
          <tr key={line.label} className="total">
            <td colSpan={2}>{line.label}</td>
            <td className="num">{money(line.value)}</td>
            <td />
          </tr>
        ))}
        {report.balanced !== null && (
          <tr>
            <td colSpan={4}>
              <span className="badge">{report.balanced ? "Balanced" : "OUT OF BALANCE"}</span>
            </td>
          </tr>
        )}
      </tfoot>
    </table>
  );
}
