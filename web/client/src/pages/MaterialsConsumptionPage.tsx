import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { money } from "../lib/format";
import { usePageVisible } from "../lib/pageVisibility";
import type { MaterialsConsumption } from "../types";

const LABEL: Record<string, string> = {
  RAW_MATERIAL: "Raw materials",
  PACKING_MATERIAL: "Packing materials",
  TOTAL: "Total",
};

/** The books begin here; 31 October and earlier is opening stock, never consumption. */
const CONSUMPTION_START = "2026-11-01";

function message(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * Materials consumed the way the old software counted it: what the books
 * carried in, plus everything purchased, less what is left.
 *
 * With no end date the closing figure is the live count, so a wrong BOM cannot
 * change the answer — only a wrong count can. With an end date it is the
 * inventory account's balance on that date, because no count survives in the
 * past; that view says what the books recorded for the period.
 */
export default function MaterialsConsumptionPage() {
  const [from, setFrom] = useState(CONSUMPTION_START);
  const [to, setTo] = useState("");
  const [report, setReport] = useState<MaterialsConsumption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [includeOpening, setIncludeOpening] = useState(false);
  // Which formula the page is showing: the periodic balance one, or what the
  // production and packing orders actually consumed.
  const [basis, setBasis] = useState<"periodic" | "consumption">("periodic");

  const pageVisible = usePageVisible();

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError(null);
    api
      .materialsConsumption(from || undefined, to || undefined)
      .then((result) => {
        if (!cancelled) setReport(result);
      })
      .catch((err) => {
        if (!cancelled) setError(message(err, "Failed to load the consumption report."));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, pageVisible]);

  const rows = report?.rows ?? [];
  const total = report?.total;
  const closesOnCount = report != null && report.to === null;

  const consumedOf = (row: MaterialsConsumption["rows"][number]): number =>
    includeOpening ? row.consumed : row.consumed - row.opening;

  return (
    <div className="card">
      <div className="row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
        <h2 style={{ flex: 1, margin: 0 }}>Materials consumption</h2>
        <div className="coa-tabs" role="tablist" aria-label="Consumption formula">
          {(
            [
              ["periodic", "Periodic (books)"],
              ["consumption", "Order consumption"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={basis === value}
              className={basis === value ? "active" : undefined}
              onClick={() => setBasis(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="consumption-from">From</label>
          <input
            id="consumption-from"
            type="date"
            value={from}
            min={CONSUMPTION_START}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="consumption-to">To</label>
          <input
            id="consumption-to"
            type="date"
            value={to}
            min={CONSUMPTION_START}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="consumption-opening" style={{ display: "block" }}>
            <input
              id="consumption-opening"
              type="checkbox"
              checked={includeOpening}
              onChange={(event) => setIncludeOpening(event.target.checked)}
            />{" "}
            Include opening stock
          </label>
        </div>
      </div>
      <p style={{ marginTop: 4 }}>
        {basis === "periodic" ? (
          <>
            {includeOpening ? "Opening + purchases" : "Purchases"} + other stock in + manufacturing
            edits − closing stock. <strong>Manufacturing edits</strong> carries the effect of a
            reopened or repacked order dated in this period but posted after it ended, so an old
            period picks up the edit without losing the order's original posting.{" "}
            {closesOnCount
              ? "Closing is today's physical count — so the figure does not depend on the bills of materials being right."
              : "Closing is the inventory account on the end date. Leave the end date empty to close on today's count instead."}{" "}
            Consumption starts on 1 November 2026 — anything on 31 October or earlier is opening
            stock, and it is only counted when the Include opening stock box is ticked.
          </>
        ) : (
          <>
            What the production and packing orders dated in this period actually took off the
            shelf, valued line by line at the price that line was costed at. A material drawn
            across two purchase batches costs its own price in each: 10 at 50 then 10 at 70 is
            500 + 700, not 1,000 or 1,400. Orders completed before the FIFO costing went live keep
            the single price they were posted at. Consumption starts on 1 November 2026.
          </>
        )}
      </p>
      {error && <div className="error">{error}</div>}
      {busy && !report && <p>Loading…</p>}
      {report && basis === "consumption" && (
        <>
          <table>
            <thead>
              <tr>
                <th>Materials</th>
                <th className="num">Orders</th>
                <th className="num">Quantity consumed</th>
                <th className="num">= Value consumed</th>
                <th className="num">Of which unpriced</th>
              </tr>
            </thead>
            <tbody>
              {[...rows, ...(total ? [total] : [])].map((row) => (
                <tr key={row.itemType} style={row === total ? { fontWeight: 600 } : undefined}>
                  <td>{LABEL[row.itemType] ?? row.itemType}</td>
                  <td className="num">{row.orderCount}</td>
                  <td className="num">{money(row.orderQty)}</td>
                  <td className="num">{money(row.orderValue)}</td>
                  <td className="num">{row.orderUnpricedQty ? money(row.orderUnpricedQty) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {total != null && total.orderUnpricedQty > 0 && (
            <p className="error" style={{ marginTop: 12 }}>
              {money(total.orderUnpricedQty)} of material was consumed from batches carrying no
              cost, so the value above understates it. Price those batches and reopen the orders.
            </p>
          )}
          {total != null && total.orderValue === 0 && total.orderQty === 0 && (
            <p style={{ marginTop: 12 }}>No production or packing order in this period consumed material.</p>
          )}
        </>
      )}
      {report && basis === "periodic" && (
        <>
          <table>
            <thead>
              <tr>
                <th>Materials</th>
                {includeOpening && <th className="num">Opening</th>}
                <th className="num">+ Purchases</th>
                <th className="num">+ Other stock in</th>
                <th className="num">+ Manufacturing edits</th>
                <th className="num">− Closing stock</th>
                <th className="num">= Consumed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.itemType}>
                  <td>{LABEL[row.itemType] ?? row.itemType}</td>
                  {includeOpening && <td className="num">{money(row.opening)}</td>}
                  <td className="num">{money(row.purchases)}</td>
                  <td className="num">{money(row.otherIn)}</td>
                  <td className="num">{money(row.manufacturingEdits)}</td>
                  <td className="num">{money(row.counted ?? row.bookClosing)}</td>
                  <td className="num">{money(consumedOf(row))}</td>
                </tr>
              ))}
              {total && (
                <tr style={{ fontWeight: 600 }}>
                  <td>{LABEL[total.itemType] ?? total.itemType}</td>
                  {includeOpening && <td className="num">{money(total.opening)}</td>}
                  <td className="num">{money(total.purchases)}</td>
                  <td className="num">{money(total.otherIn)}</td>
                  <td className="num">{money(total.manufacturingEdits)}</td>
                  <td className="num">{money(total.counted ?? total.bookClosing)}</td>
                  <td className="num">{money(consumedOf(total))}</td>
                </tr>
              )}
            </tbody>
          </table>
          {total && total.difference != null && Math.abs(total.difference) >= 1 && (
            <p className="error" style={{ marginTop: 12 }}>
              The inventory accounts say {money(total.bookClosing)} is left, but the counted stock
              is {money(total.counted ?? 0)} — {money(total.difference)} apart. Closing stock above
              uses the count; post the difference to bring the books in line.
            </p>
          )}
          {total && total.difference != null && Math.abs(total.difference) < 1 && (
            <p style={{ marginTop: 12 }}>
              Inventory accounts agree with the count ({money(total.counted ?? 0)}).
            </p>
          )}
        </>
      )}
    </div>
  );
}
