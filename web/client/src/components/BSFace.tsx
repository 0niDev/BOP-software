/**
 * Printed Balance Sheet face.
 *
 * A fixed two-column classified statement from the server (BS_FACE): Assets on
 * the left (non-current above current), Equity & Liabilities on the right
 * (non-current, current, then equity). Each group line expands to the accounts
 * behind it. Heading edits belong to the notes and never change this layout.
 */
import { Fragment, useState } from "react";
import { moneySide } from "../lib/format";
import type { BsFaceLine, CustomReport } from "../types";

function amount(value: number, side: "Dr" | "Cr" | "" = ""): string {
  return value === 0 ? "—" : moneySide(value, side);
}

function Column({
  title,
  lines,
  total,
  expanded,
  toggle,
}: {
  title: string;
  lines: BsFaceLine[];
  total: BsFaceLine;
  expanded: Set<string>;
  toggle: (id: string) => void;
}) {
  return (
    <table className="bs-face-table">
      <thead>
        <tr>
          <th>{title}</th>
          <th className="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => {
          const key = line.headingId ?? line.label;
          const open = expanded.has(key);
          const section = line.noAmount === true;
          return (
            <Fragment key={key}>
              <tr className={section ? "bs-section" : line.bold ? "total" : undefined}>
                <td style={{ paddingLeft: 12 * (line.depth ?? 0) }}>
                  {line.rows.length > 0 && !section ? (
                    <button
                      type="button"
                      className="coa-toggle"
                      aria-expanded={open}
                      title={open ? "Collapse" : "Expand"}
                      onClick={() => toggle(key)}
                    >
                      {open ? "▾" : "▸"}
                    </button>
                  ) : (
                    <span className="coa-toggle-spacer" />
                  )}
                  {line.label}
                </td>
                <td className="num">{section ? "" : amount(line.value, line.side)}</td>
              </tr>
              {open &&
                line.rows.map((row) => (
                  <tr key={`${key}-${row.accountId}`}>
                    <td style={{ paddingLeft: 24 + 16 * row.depth }}>{row.name}</td>
                    <td className="num">{amount(row.value, row.side)}</td>
                  </tr>
                ))}
            </Fragment>
          );
        })}
        <tr className="total">
          <td>{total.label}</td>
          <td className="num">{amount(total.value, total.side)}</td>
        </tr>
      </tbody>
    </table>
  );
}

export default function BSFace({ report }: { report: CustomReport }) {
  const face = report.bsFace;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string): void =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  if (!face) return null;
  return (
    <div className="bs-face">
      <Column
        title={face.leftTitle}
        lines={face.left}
        total={face.totalAssets}
        expanded={expanded}
        toggle={toggle}
      />
      <Column
        title={face.rightTitle}
        lines={face.right}
        total={face.totalEquityLiabilities}
        expanded={expanded}
        toggle={toggle}
      />
    </div>
  );
}
