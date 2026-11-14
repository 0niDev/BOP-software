import { Fragment } from "react";
import { money } from "../lib/format";
import type { CustomReport, CustomReportRow } from "../types";

/**
 * "Notes to accounts" for the Listing page: the detailed custom P&L restated as
 * headings only. Each custom heading is a bold row; the chart-of-accounts header
 * accounts under it follow, indented, each showing the total of every account
 * nested beneath it. Leaf accounts, codes and level markers are left out, so the
 * tree reads by indentation alone.
 */

/** Subtree total of each header row: its own balance plus every descendant's. */
export function headerTotals(rows: CustomReportRow[]): Map<number, number> {
  const totals = new Map<number, number>();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || !row.isHeader) continue;
    let sum = row.value;
    for (let j = i + 1; j < rows.length; j += 1) {
      const child = rows[j];
      if (!child || child.depth <= row.depth) break;
      sum += child.value;
    }
    totals.set(row.accountId, sum);
  }
  return totals;
}

export default function PLNotes({ report }: { report: CustomReport }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Heading</th>
          <th className="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        {report.headings.map((heading) => {
          const totals = headerTotals(heading.rows);
          const headers = heading.rows.filter((row) => row.isHeader);
          return (
            <Fragment key={heading.id}>
              <tr className="total">
                <td>{heading.name}</td>
                <td className="num">{money(heading.value)}</td>
              </tr>
              {headers.map((row) => (
                <tr key={`${heading.id}-${row.accountId}`}>
                  <td style={{ paddingLeft: 16 + row.depth * 16 }}>{row.name}</td>
                  <td className="num">{money(totals.get(row.accountId) ?? 0)}</td>
                </tr>
              ))}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
