import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { api, ApiError } from "../api";
import FilterBox, { matchesQuery } from "../components/FilterBox";
import NumberInput from "../components/NumberInput";
import { formatDate } from "../lib/format";
import { usePageVisible } from "../lib/pageVisibility";
import type { Item } from "../types";

function message(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

const TYPE_ORDER = ["RAW_MATERIAL", "PACKING_MATERIAL", "FINISHED_GOOD"] as const;
const TYPE_LABEL: Record<string, string> = {
  RAW_MATERIAL: "Raw materials",
  PACKING_MATERIAL: "Packing materials",
  FINISHED_GOOD: "Finished goods",
};

/**
 * Missing-prices tool: every active item whose purchase price is still 0, with
 * an inline cost per unit. Save writes them in one call. The list is whatever
 * is currently unpriced, so it stays useful whenever new items come in without
 * a cost.
 */
export default function ItemPricesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [prices, setPrices] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(): Promise<void> {
    try {
      setItems(await api.items({ activeOnly: true, unpriced: true }));
    } catch (err) {
      setError(message(err, "Failed to load items."));
    }
  }

  const pageVisible = usePageVisible();
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageVisible]);

  const unpriced = items;

  // Search only narrows what is shown; saving and counting still cover the full
  // unpriced list, so a typed price is never silently dropped by a filter.
  const visible = useMemo(
    () => unpriced.filter((item) => matchesQuery(search, [item.item_name, item.item_code])),
    [unpriced, search],
  );

  const grouped = useMemo(
    () =>
      TYPE_ORDER.map((type) => ({
        type,
        items: visible.filter((item) => item.item_type === type),
      })).filter((group) => group.items.length > 0),
    [visible],
  );

  const firstId = grouped[0]?.items[0]?.id;

  const enteredCount = useMemo(
    () => Object.values(prices).filter((value) => value > 0).length,
    [prices],
  );

  function setPrice(id: number) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      setPrices((current) => ({ ...current, [id]: Number.isFinite(value) ? value : 0 }));
    };
  }

  async function save(): Promise<void> {
    setError(null);
    setNotice(null);
    const entries = unpriced
      .filter((item) => (prices[item.id] ?? 0) > 0)
      .map((item) => ({ id: item.id, purchasePrice: prices[item.id]! }));
    if (entries.length === 0) {
      setError("Enter at least one price to save.");
      return;
    }
    setBusy(true);
    try {
      const result = await api.setItemPrices(entries);
      setNotice(`Saved ${result.updated} price${result.updated === 1 ? "" : "s"}.`);
      setPrices({});
      await refresh();
    } catch (err) {
      setError(message(err, "Failed to save prices."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
        <h2 style={{ flex: 1, margin: 0 }}>Missing prices</h2>
        <div>
          <label>Search</label>
          <FilterBox value={search} onChange={setSearch} placeholder="Search item or code…" />
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || enteredCount === 0}
          title="Save every entered price to the items above"
        >
          {busy ? "Saving…" : `Save ${enteredCount} price${enteredCount === 1 ? "" : "s"}`}
        </button>
      </div>
      <p style={{ marginTop: 4 }}>
        {unpriced.length} item{unpriced.length === 1 ? "" : "s"} with no purchase price. Type a
        cost per unit and save — anything left blank stays unpriced.
      </p>
      {error && <div className="error">{error}</div>}
      {notice && (
        <div className="badge" style={{ display: "inline-block" }}>
          {notice}
        </div>
      )}
      {unpriced.length === 0 && !error ? (
        <p>All active items have a purchase price. Nothing to do here.</p>
      ) : unpriced.length > 0 && visible.length === 0 ? (
        <p>No items match the search.</p>
      ) : (
        grouped.map((group) => (
          <section key={group.type}>
            <h3 style={{ margin: "16px 0 8px" }}>
              {TYPE_LABEL[group.type]} ({group.items.length})
            </h3>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Unit</th>
                  <th>Last consumed</th>
                  <th className="num">Purchase price</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.item_name}</td>
                    <td>{item.unit}</td>
                    <td>{formatDate(item.last_consumed_at) || "—"}</td>
                    <td className="num">
                      <NumberInput
                        value={prices[item.id] ?? 0}
                        onChange={setPrice(item.id)}
                        placeholder="0.00"
                        aria-label={`${item.item_name} purchase price`}
                        autoFocus={item.id === firstId}
                        style={{ width: 120 }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </div>
  );
}
