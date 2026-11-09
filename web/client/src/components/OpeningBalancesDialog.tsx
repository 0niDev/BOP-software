import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import NumberInput from "./NumberInput";
import type { OpeningBalanceChange, Party } from "../types";

interface Props {
  onClose: () => void;
  /** Parent refresh after a save or delete. */
  onSaved: () => void;
}

const EMPTY_LINE = { debit: 0, credit: 0 };

function money(value: number): string {
  return value.toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: string): string {
  if (!value) return "—";
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
}

function message(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * Opening balances live in their own dialog: set or update per-party balances
 * on a cutover date, and review the saved changes. A wrong change can be
 * deleted while it is still the newest one for its parties; that restores the
 * previous balances instead of just zeroing them.
 */
export default function OpeningBalancesDialog({ onClose, onSaved }: Props) {
  const [tab, setTab] = useState<"edit" | "history">("edit");
  const [parties, setParties] = useState<Party[]>([]);
  const [changes, setChanges] = useState<OpeningBalanceChange[]>([]);
  const [opening, setOpening] = useState<Record<number, { debit: number; credit: number }>>({});
  const [openingDate, setOpeningDate] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function refresh(): Promise<void> {
    const [partyList, changeList] = await Promise.all([
      api.parties({ activeOnly: false }),
      api.openingBalanceChanges(),
    ]);
    setParties(partyList);
    setChanges(changeList);
    setOpening(
      Object.fromEntries(
        partyList.map((party) => [
          party.id,
          party.opening_balance >= 0
            ? { debit: party.opening_balance, credit: 0 }
            : { debit: 0, credit: -party.opening_balance },
        ]),
      ),
    );
    const storedDate = partyList.find((party) => party.opening_balance_date)
      ?.opening_balance_date;
    if (storedDate) setOpeningDate(storedDate);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch (err) {
        if (!cancelled) setError(message(err, "Failed to load opening balances."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleParties = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return parties;
    return parties.filter(
      (party) =>
        party.name.toLowerCase().includes(query) ||
        party.code.toLowerCase().includes(query),
    );
  }, [parties, search]);

  function setLine(partyId: number, line: { debit: number; credit: number }): void {
    setOpening((current) => ({ ...current, [partyId]: line }));
  }

  async function saveOpeningBalances(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!openingDate) {
      setError("Choose the date the opening balances are carried forward from.");
      return;
    }

    const entries = parties
      .map((party) => {
        const line = opening[party.id] ?? EMPTY_LINE;
        return { party, ...line, signed: line.debit - line.credit };
      })
      .filter(
        (row) =>
          row.signed !== row.party.opening_balance ||
          (row.party.opening_balance_date ?? "") !== openingDate,
      )
      .map(({ party, debit, credit }) => ({ partyId: party.id, debit, credit }));

    if (entries.length === 0) {
      setError("No opening balance changes to save.");
      return;
    }

    setBusy(true);
    try {
      const result = await api.postPartyOpeningBalances(entries, openingDate);
      setNotice(
        `Posted opening balances as at ${formatDate(result.openingDate)}: debit ` +
          `${money(result.totalDebit)} / credit ${money(result.totalCredit)} across ` +
          `${result.partiesUpdated} party(ies).`,
      );
      await refresh();
      onSaved();
      setTab("history");
    } catch (err) {
      setError(message(err, "Failed to save opening balances."));
    } finally {
      setBusy(false);
    }
  }

  async function deleteChange(change: OpeningBalanceChange): Promise<void> {
    if (
      !window.confirm(
        `Delete opening-balance change ${change.voucherNumber} dated ` +
          `${formatDate(change.entryDate)}? The affected parties return to their previous ` +
          `opening balances.`,
      )
    ) {
      return;
    }
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const result = await api.deleteOpeningBalanceChange(change.journalEntryId);
      setNotice(
        `Deleted ${change.voucherNumber}; restored ${result.partiesUpdated} party balance(s).`,
      );
      await refresh();
      onSaved();
    } catch (err) {
      setError(message(err, "Failed to delete the opening-balance change."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label="Opening balances"
      >
        <div className="row" style={{ alignItems: "flex-start", marginBottom: 4 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0 }}>Opening balances</h2>
            <p className="sub" style={{ margin: "5px 0 0" }}>
              Debit = the party owes you. Credit = you owe the party. Balances are carried
              forward from the opening date; invoices dated on or after it update the party&apos;s
              credit, while earlier invoices do not.
            </p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        {notice && (
          <div className="badge" style={{ display: "inline-block", marginTop: 12 }}>
            {notice}
          </div>
        )}

        <div className="coa-tabs" role="tablist" style={{ marginTop: 16 }}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "edit"}
            className={tab === "edit" ? "active" : undefined}
            onClick={() => setTab("edit")}
          >
            Set balances
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "history"}
            className={tab === "history" ? "active" : undefined}
            onClick={() => setTab("history")}
          >
            Change history{changes.length > 0 ? ` (${changes.length})` : ""}
          </button>
        </div>

        {loading ? (
          <p className="sub">Loading opening balances…</p>
        ) : tab === "edit" ? (
          <form onSubmit={saveOpeningBalances}>
            <div className="row" style={{ alignItems: "flex-end", marginBottom: 12 }}>
              <div>
                <label>Opening date</label>
                <input
                  type="date"
                  value={openingDate}
                  onChange={(event) => setOpeningDate(event.target.value)}
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <label>Search parties</label>
                <input
                  className="filter-box"
                  placeholder="Filter by name or code…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <button className="primary" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save opening balances"}
              </button>
            </div>

            <p className="sub" style={{ marginTop: 0 }}>
              Every save is kept in Change history. If a value is wrong, delete that change and
              add the corrected balance — the party returns to its previous opening first.
            </p>

            <div className="modal-scroll">
              <table style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Party</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th className="num">Debit</th>
                    <th className="num">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleParties.map((party) => {
                    const line = opening[party.id] ?? EMPTY_LINE;
                    return (
                      <tr key={party.id}>
                        <td>{party.code}</td>
                        <td>{party.name}</td>
                        <td>{party.party_type}</td>
                        <td>
                          <span className="badge">
                            {party.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="num">
                          <NumberInput
                            min="0"
                            step="0.01"
                            aria-label={`Opening debit for ${party.name}`}
                            value={line.debit}
                            onChange={(event) =>
                              setLine(party.id, {
                                debit: Number(event.target.value),
                                credit: 0,
                              })
                            }
                            style={{ width: 140, textAlign: "right" }}
                          />
                        </td>
                        <td className="num">
                          <NumberInput
                            min="0"
                            step="0.01"
                            aria-label={`Opening credit for ${party.name}`}
                            value={line.credit}
                            onChange={(event) =>
                              setLine(party.id, {
                                debit: 0,
                                credit: Number(event.target.value),
                              })
                            }
                            style={{ width: 140, textAlign: "right" }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {visibleParties.length === 0 && (
                    <tr>
                      <td colSpan={6} className="sub">
                        No parties match this search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </form>
        ) : changes.length === 0 ? (
          <p className="sub">No opening-balance changes have been saved yet.</p>
        ) : (
          <div>
            {changes.map((change) => (
              <div className="opening-change" key={change.journalEntryId}>
                <div className="opening-change-head">
                  <h3>{formatDate(change.entryDate)}</h3>
                  <span className="badge">{change.voucherNumber}</span>
                  <span className="sub">Posted {formatDateTime(change.createdAt)}</span>
                  <span style={{ flex: 1 }} />
                  <button
                    type="button"
                    disabled={busy || !change.deletable}
                    title={
                      change.deletable
                        ? "Delete this change and restore the previous balances"
                        : "A newer change exists for the parties in this change"
                    }
                    onClick={() => void deleteChange(change)}
                  >
                    Delete change
                  </button>
                </div>

                <table style={{ minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Party</th>
                      <th>Status</th>
                      <th className="num">Debit</th>
                      <th className="num">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {change.parties.map((party) => (
                      <tr key={party.partyId}>
                        <td>{party.partyCode}</td>
                        <td>{party.partyName}</td>
                        <td>
                          {party.cleared ? (
                            <span className="badge">Cleared</span>
                          ) : (
                            <span className="sub">Set</span>
                          )}
                        </td>
                        <td className="num">
                          {party.cleared ? "—" : money(party.debit)}
                        </td>
                        <td className="num">
                          {party.cleared ? "—" : money(party.credit)}
                        </td>
                      </tr>
                    ))}
                    <tr className="total">
                      <td colSpan={3}>Total</td>
                      <td className="num">{money(change.totalDebit)}</td>
                      <td className="num">{money(change.totalCredit)}</td>
                    </tr>
                  </tbody>
                </table>

                {!change.deletable && (
                  <p className="sub" style={{ margin: "8px 0 0" }}>
                    Cannot delete: a newer change exists for {change.blockedBy.join(", ")}.
                    Delete the newer change first.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
