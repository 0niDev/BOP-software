import { Fragment } from "react";
import { moneySide, type Side } from "../lib/format";
import type { CustomReport, CustomReportHeading, CustomReportRow } from "../types";

/**
 * Printed "Notes to the Accounts": one block per printed note, the full account
 * detail underneath and a numbered breakdown for each header account
 * (21.01, 21.02, …), ending with `*** End of Report ***`.
 *
 * P&L face lines that carry no note (Gross Profit, …) are left out — they are
 * report lines, not notes.
 */

/** An amount with the side it sits on. */
export interface SidedAmount {
  value: number;
  side: Side | "";
}

/** Debit-positive figure of a line, so its side follows from its sign. */
function debitOf(line: { value: number; side?: Side | "" }): number {
  return line.side === "Cr" ? -line.value : line.value;
}

/** Side of a debit-positive total; "" at zero. */
function sideOfTotal(value: number): Side | "" {
  if (value === 0) return "";
  return value > 0 ? "Dr" : "Cr";
}

/** Subtree total of each header row: its own balance plus every descendant's. */
export function headerTotals(rows: CustomReportRow[]): Map<number, SidedAmount> {
  const totals = new Map<number, SidedAmount>();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || !row.isHeader) continue;
    let sum = row.value;
    let debit = debitOf(row);
    for (let j = i + 1; j < rows.length; j += 1) {
      const child = rows[j];
      if (!child || child.depth <= row.depth) break;
      sum += child.value;
      debit += debitOf(child);
    }
    totals.set(row.accountId, { value: sum, side: sideOfTotal(debit) });
  }
  return totals;
}

export interface NoteBlockRow {
  /** Printed reference (21.01) or "" for a plain detail line. */
  note: string;
  name: string;
  amount: number;
  /** Side the amount sits on; "" when it is zero. */
  side: Side | "";
  /** Indentation level under the block header. */
  depth: number;
}

export interface NoteBlock {
  note: string;
  title: string;
  total: number;
  /** Side the block total sits on; "" when it is zero. */
  totalSide: Side | "";
  rows: NoteBlockRow[];
}

/**
 * Group the custom P&L headings into printed notes. Headings sharing a note
 * form one block; a noted subtotal (Cost of Revenue, …) supplies the title and
 * total, otherwise the block title is its first account heading and the body
 * sums to the total.
 */
export function noteBlocks(report: CustomReport): NoteBlock[] {
  const groups = new Map<string, CustomReportHeading[]>();
  for (const heading of report.headings) {
    const note = heading.note?.trim() ?? "";
    if (!note && heading.kind === "subtotal") continue;
    const key = note || `#${heading.id}`;
    const list = groups.get(key);
    if (list) list.push(heading);
    else groups.set(key, [heading]);
  }

  const blocks: NoteBlock[] = [];
  for (const group of groups.values()) {
    const note = group[0]?.note?.trim() ?? "";
    const subtotal = group.find((heading) => heading.kind === "subtotal");
    const accounts = group.filter((heading) => heading.kind === "accounts");
    const title = subtotal?.name ?? accounts[0]?.name ?? "";
    const total = subtotal
      ? subtotal.value
      : accounts.reduce((sum, heading) => sum + heading.value, 0);
    const totalSide: Side | "" = subtotal
      ? subtotal.side
      : sideOfTotal(accounts.reduce((sum, heading) => sum + debitOf(heading), 0));

    // No printed note: keep every row of the tree inline so nothing is lost.
    if (!note) {
      const rows = accounts.flatMap((heading) =>
        heading.rows.map((row) => ({
          note: "",
          name: row.name,
          amount: row.value,
          side: row.side,
          depth: row.depth,
        })),
      );
      blocks.push({ note, title, total, totalSide, rows });
      continue;
    }

    // Depth-0 header accounts get a sub-note number and their own breakdown.
    const sections = accounts.flatMap((heading) => {
      const totals = headerTotals(heading.rows);
      return heading.rows.flatMap((row, index) =>
        row.depth === 0 && row.isHeader
          ? [
              {
                row,
                index,
                total: totals.get(row.accountId) ?? { value: row.value, side: row.side },
                rows: heading.rows,
              },
            ]
          : [],
      );
    });
    const refs = new Map(
      sections.map((section, index) => [
        section.row,
        `${note}.${String(index + 1).padStart(2, "0")}`,
      ]),
    );
    const totals = new Map(sections.map((section) => [section.row, section.total]));

    const rows: NoteBlockRow[] = [];
    for (const heading of accounts) {
      for (const row of heading.rows.filter((candidate) => candidate.depth === 0)) {
        const subtree = totals.get(row);
        rows.push({
          note: refs.get(row) ?? "",
          name: row.name,
          amount: subtree?.value ?? row.value,
          side: subtree?.side ?? row.side,
          depth: 0,
        });
      }
    }
    for (const section of sections) {
      rows.push({
        note: refs.get(section.row) ?? "",
        name: section.row.name,
        amount: section.total.value,
        side: section.total.side,
        depth: 0,
      });
      for (let i = section.index + 1; i < section.rows.length; i += 1) {
        const child = section.rows[i]!;
        if (child.depth <= section.row.depth) break;
        rows.push({
          note: "",
          name: child.name,
          amount: child.value,
          side: child.side,
          depth: child.depth - section.row.depth,
        });
      }
    }
    blocks.push({ note, title, total, totalSide, rows });
  }
  return blocks;
}

export default function PLNotes({ report }: { report: CustomReport }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Note</th>
          <th>Particulars</th>
          <th className="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        {noteBlocks(report).map((block, blockIndex) => (
          <Fragment key={`${block.note}-${blockIndex}`}>
            <tr className="total">
              <td>{block.note ? `Note No : ${block.note}` : ""}</td>
              <td>{block.title}</td>
              <td className="num">{moneySide(block.total, block.totalSide)}</td>
            </tr>
            {block.rows.map((row, rowIndex) => (
              <tr key={`${block.note}-${blockIndex}-${rowIndex}`}>
                <td>{row.note}</td>
                <td style={{ paddingLeft: 16 * (1 + row.depth) }}>{row.name}</td>
                <td className="num">{moneySide(row.amount, row.side)}</td>
              </tr>
            ))}
          </Fragment>
        ))}
        <tr className="total">
          <td colSpan={2}>*** End of Report ***</td>
          <td />
        </tr>
      </tbody>
    </table>
  );
}
