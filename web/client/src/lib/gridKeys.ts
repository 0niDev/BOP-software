/**
 * Arrow/Enter navigation inside a line-item table.
 *
 * Tab already walks the fields in document order; this adds the desktop-ERP
 * habit of ↑/↓ (and Enter) moving to the same column in the row above/below,
 * so a user filling quantities never reaches for the mouse.
 */
import type { KeyboardEvent } from "react";

const FIELD = "input:not([disabled]), select:not([disabled]), textarea:not([disabled])";

/** The field in the same column of the neighbouring row, else any field there. */
export function nextRowField(field: HTMLElement, step: -1 | 1): HTMLElement | null {
  const cell = field.closest("td");
  const row = cell?.closest("tr");
  const rows = row?.parentElement ? Array.from(row.parentElement.children) : [];
  if (!cell || !row || rows.length === 0) return null;

  const column = Array.from(row.children).indexOf(cell);
  for (let i = rows.indexOf(row) + step; i >= 0 && i < rows.length; i += step) {
    const targetRow = rows[i] as HTMLElement;
    const targetCell = targetRow.children[column] as HTMLElement | undefined;
    const next =
      targetCell?.querySelector<HTMLElement>(FIELD) ?? targetRow.querySelector<HTMLElement>(FIELD);
    if (next) return next;
  }
  return null;
}

/**
 * onKeyDown handler for a table body of fields. Enter behaves like ↓ so the
 * amount column can be filled with one hand; on the last row it is swallowed
 * instead of submitting the form by accident.
 */
export function moveRowFocus(event: KeyboardEvent<HTMLElement>): void {
  if (event.defaultPrevented) return; // a widget inside the cell already used the key
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter") return;

  const field = event.target as HTMLElement | null;
  if (!field || !["INPUT", "SELECT", "TEXTAREA"].includes(field.tagName)) return;
  if (!field.closest("td")) return;

  const next = nextRowField(field, event.key === "ArrowUp" ? -1 : 1);
  event.preventDefault();
  next?.focus();
}
