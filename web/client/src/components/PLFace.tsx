/**
 * Printed Profit & Loss face.
 *
 * The paper layout is fixed by the server (PL_FACE_LINES): the line order,
 * wording, indentation and note numbers never come from the editable template,
 * so the statement always prints the same way. Heading edits belong to the
 * notes (Notes page) and only change the notes.
 */
import { Fragment } from "react";
import { moneySide } from "../lib/format";
import type { CustomReport } from "../types";

/** Read-only printed P&L. Values come from the fixed face; nothing is editable. */
export default function PLFace({ report }: { report: CustomReport }) {
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
          {(report.face ?? []).map((line) => (
            <Fragment key={line.headingId ?? line.label}>
              <tr className={line.bold ? "total" : undefined}>
                <td style={{ paddingLeft: 16 * (1 + (line.depth ?? 0)) }}>{line.label}</td>
                <td className="num">
                  {line.noAmount ? "" : moneySide(line.value, line.side)}
                </td>
                <td className="num">{line.note ?? ""}</td>
              </tr>
            </Fragment>
          ))}
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
