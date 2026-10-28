import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api";
import FilterBox, { matchesQuery } from "../components/FilterBox";
import SearchableSelect from "../components/SearchableSelect";
import { formatDate } from "../lib/format";
import { moveRowFocus } from "../lib/gridKeys";
import { saveBlob } from "../lib/download";
import type {
  Account,
  JournalEntryDetail,
  ManualJournalEntry,
} from "../types";

/** One editable line in the new-voucher dialog. Amounts stay strings so the
 * inputs can be cleared without snapping to 0 mid-typing. */
interface DraftLine {
  accountId: number;
  /** Group account the account must sit under; 0 = search every account. */
  parentId: number;
  description: string;
  debit: string;
  credit: string;
}

function newLine(): DraftLine {
  return { accountId: 0, parentId: 0, description: "", debit: "", credit: "" };
}

/** Append an empty line that inherits the narration of the row above, so a
 * run of lines with the same description does not have to be retyped. The
 * copy is a plain value — editing it never rewrites the row above. */
export function withNewLine(lines: readonly DraftLine[]): DraftLine[] {
  const previous = lines[lines.length - 1];
  return [...lines, { ...newLine(), description: previous?.description ?? "" }];
}

function money(value: number): string {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function message(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/** "1120 — Marketing". Plain names only: the Group column already says which
 * branch a line belongs to. */
export function accountLabel(account: Account): string {
  return `${account.account_code} — ${account.account_name}`;
}

/** Tree depth of every account: 1 for a root, one more per parent link. */
export function accountDepths(accounts: readonly Account[]): Map<number, number> {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const depths = new Map<number, number>();
  for (const account of accounts) {
    let depth = 1;
    const seen = new Set<number>([account.id]);
    let current =
      account.parent_account_id == null ? undefined : byId.get(account.parent_account_id);
    // `seen` keeps malformed parent cycles from looping forever.
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      depth += 1;
      current = current.parent_account_id == null ? undefined : byId.get(current.parent_account_id);
    }
    depths.set(account.id, depth);
  }
  return depths;
}

/** Accounts a journal line may hit: ledger (leaf) accounts at level 3 or
 * deeper. Headers are not listed, but a level-3 header can still be used by
 * leaving the account blank and picking it as the group. */
export function postableAccounts(
  accounts: readonly Account[],
  depths: ReadonlyMap<number, number> = accountDepths(accounts),
): Account[] {
  const parentIds = new Set(
    accounts.map((account) => account.parent_account_id).filter((id): id is number => id != null),
  );
  return accounts.filter(
    (account) => !parentIds.has(account.id) && (depths.get(account.id) ?? 0) >= 3,
  );
}

/** The account a draft line posts to: the picked account, or — when the
 * account is left blank — the group itself, as long as that group is a
 * level-3-or-deeper account. Narrowing by "Assets" alone posts nowhere. */
export function journalLineAccountId(
  line: { accountId: number; parentId: number },
  depths: ReadonlyMap<number, number>,
): number {
  if (line.accountId) return line.accountId;
  return (depths.get(line.parentId) ?? 0) >= 3 ? line.parentId : 0;
}

/** Every account id below `rootId`, at any depth (not `rootId` itself). */
export function subtreeIds(accounts: readonly Account[], rootId: number): Set<number> {
  const childrenOf = new Map<number, number[]>();
  for (const account of accounts) {
    if (account.parent_account_id == null) continue;
    const list = childrenOf.get(account.parent_account_id) ?? [];
    list.push(account.id);
    childrenOf.set(account.parent_account_id, list);
  }
  const ids = new Set<number>();
  const stack = [...(childrenOf.get(rootId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop() as number;
    if (ids.has(id)) continue;
    ids.add(id);
    stack.push(...(childrenOf.get(id) ?? []));
  }
  return ids;
}

export default function JournalVouchersPage() {
  const [entries, setEntries] = useState<ManualJournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(() => [newLine(), newLine()]);
  // Focus the first field of a line only when it was just added, not on open.
  const justAdded = useRef(false);

  const [detail, setDetail] = useState<JournalEntryDetail | null>(null);
  const [reverseTarget, setReverseTarget] = useState<ManualJournalEntry | null>(null);
  const [reverseDate, setReverseDate] = useState(today);
  const [exporting, setExporting] = useState<number | null>(null);

  async function refresh(): Promise<void> {
    try {
      const [entryList, accountList] = await Promise.all([api.journalEntries(), api.accounts()]);
      setEntries(entryList);
      setAccounts(accountList);
    } catch (err) {
      setError(message(err, "Failed to load journal vouchers."));
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only ledger accounts at level 3 or deeper can take journal lines (the
  // server rejects groups too). Headers stay listable as the Group column.
  const depths = accountDepths(accounts);
  const postable = postableAccounts(accounts, depths);
  const parentIds = new Set(
    accounts.map((account) => account.parent_account_id).filter((id): id is number => id != null),
  );
  const accountOptions = postable.map((account) => ({
    value: String(account.id),
    label: accountLabel(account),
  }));

  // Group accounts are the ones allowed in the first column; picking one
  // narrows the account list to its branch. Levels 1–2 (Assets, Current
  // Assets, …) are too coarse to post into, so only depth-3 groups and
  // deeper show up — level 4 only when it still has children.
  const groupOptions = accounts
    .filter(
      (account) =>
        parentIds.has(account.id) && (depths.get(account.id) ?? 0) >= 3,
    )
    .map((account) => ({ value: String(account.id), label: accountLabel(account) }));
  const optionsUnder = new Map<number, typeof accountOptions>();
  for (const group of groupOptions) {
    const ids = subtreeIds(accounts, Number(group.value));
    optionsUnder.set(
      Number(group.value),
      accountOptions.filter((option) => ids.has(Number(option.value))),
    );
  }

  const totalDebit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100;
  const balanced = difference === 0 && totalDebit > 0;

  function updateLine(index: number, patch: Partial<DraftLine>): void {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function closeDialog(): void {
    setDialogOpen(false);
    setDate(today());
    setNarration("");
    setLines([newLine(), newLine()]);
  }

  async function submit(): Promise<void> {
    setError(null);
    setNotice(null);
    const active = lines.filter((line) => Number(line.debit) > 0 || Number(line.credit) > 0);
    if (active.length < 2) {
      setError("A journal voucher needs at least two lines with amounts.");
      return;
    }
    if (active.some((line) => !journalLineAccountId(line, depths))) {
      setError("Every line with an amount needs an account, or a level-3 group.");
      return;
    }
    if (active.some((line) => Number(line.debit) > 0 && Number(line.credit) > 0)) {
      setError("A line takes a debit or a credit, not both.");
      return;
    }
    if (!balanced) {
      setError(`Debits and credits must match (out of balance by ${money(Math.abs(difference))}).`);
      return;
    }
    setBusy(true);
    try {
      const created = await api.createJournalEntry({
        entryDate: date,
        narration: narration.trim() || null,
        lines: active.map((line) => ({
          accountId: journalLineAccountId(line, depths),
          description: line.description.trim() || null,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
        })),
      });
      setNotice(`Posted ${created.voucherNumber} (${money(totalDebit)}).`);
      closeDialog();
      await refresh();
    } catch (err) {
      setError(message(err, "Failed to post the journal voucher."));
    } finally {
      setBusy(false);
    }
  }

  async function view(entry: ManualJournalEntry): Promise<void> {
    setError(null);
    if (detail?.id === entry.id) {
      setDetail(null);
      return;
    }
    try {
      setDetail(await api.journalEntry(entry.id));
    } catch (err) {
      setError(message(err, "Failed to load the entry."));
    }
  }

  async function exportVoucher(entry: ManualJournalEntry): Promise<void> {
    setError(null);
    setExporting(entry.id);
    try {
      const blob = await api.journalVoucherXlsx(entry.id);
      saveBlob(blob, `journal-voucher_${entry.voucher_number}.xlsx`);
    } catch (err) {
      setError(message(err, "Failed to export the voucher."));
    } finally {
      setExporting(null);
    }
  }

  async function reverse(): Promise<void> {
    if (!reverseTarget) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const created = await api.reverseJournalEntry(reverseTarget.id, {
        reversalDate: reverseDate,
      });
      setNotice(`Reversed ${reverseTarget.voucher_number} with ${created.voucherNumber}.`);
      setReverseTarget(null);
      await refresh();
    } catch (err) {
      setError(message(err, "Failed to reverse the voucher."));
    } finally {
      setBusy(false);
    }
  }

  const visible = entries.filter((entry) =>
    matchesQuery(query, [
      entry.voucher_number,
      entry.entry_date,
      entry.narration,
      entry.reference_no,
      entry.total_debit,
    ]),
  );

  return (
    <>
      <div className="card">
        <div className="row" style={{ alignItems: "center" }}>
          <h2 style={{ flex: 1, margin: 0 }}>Journal Vouchers</h2>
          <button
            className="primary"
            type="button"
            onClick={() => {
              justAdded.current = false;
              setDialogOpen(true);
            }}
          >
            New voucher
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        {notice && (
          <div className="badge" style={{ display: "inline-block" }}>
            {notice}
          </div>
        )}
      </div>

      {dialogOpen && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeDialog();
          }}
        >
          <div
            className="modal modal-wide"
            role="dialog"
            aria-modal="true"
            aria-label="New journal voucher"
          >
            <div className="row" style={{ alignItems: "center", marginBottom: 8 }}>
              <h2 style={{ flex: 1, margin: 0 }}>New journal voucher</h2>
              <button type="button" onClick={closeDialog}>
                Close
              </button>
            </div>
            <p className="sub" style={{ marginTop: 0 }}>
              Debit at least one account and credit at least one for the same total.
              Pick a group first to narrow the account list to that branch — or leave the
              account blank to post to the group itself when it is a level-3 entry.
              Posted vouchers cannot be edited — reverse one to correct it.
            </p>
            {error && <div className="error">{error}</div>}

            <div className="row">
              <div>
                <label>Date</label>
                <input type="date" autoFocus value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Narration</label>
                <input
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  placeholder="What is this adjustment for?"
                />
              </div>
            </div>

            <div className="modal-scroll">
              <table style={{ marginTop: 12 }} onKeyDown={moveRowFocus}>
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Account</th>
                    <th>Description</th>
                    <th className="num">Debit</th>
                    <th className="num">Credit</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={index}>
                      <td style={{ minWidth: 200 }}>
                        <SearchableSelect
                          value={String(line.parentId)}
                          onChange={(next) =>
                            updateLine(index, { parentId: Number(next), accountId: 0 })
                          }
                          placeholder="Any group..."
                          emptyText="No matching group"
                          options={groupOptions}
                          ariaLabel={`Line ${index + 1} group`}
                        />
                      </td>
                      <td style={{ minWidth: 220 }}>
                        <SearchableSelect
                          value={String(line.accountId)}
                          autoFocus={justAdded.current && index === lines.length - 1}
                          onChange={(next) => updateLine(index, { accountId: Number(next) })}
                          placeholder="Select account or leave blank"
                          emptyText="No matching account"
                          options={optionsUnder.get(line.parentId) ?? accountOptions}
                        />
                      </td>
                      <td>
                        <input
                          value={line.description}
                          onChange={(e) => updateLine(index, { description: e.target.value })}
                          placeholder="Line description"
                          aria-label={`Line ${index + 1} description`}
                        />
                      </td>
                      <td className="num">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.debit}
                          onChange={(e) => updateLine(index, { debit: e.target.value })}
                          aria-label={`Line ${index + 1} debit`}
                          style={{ width: 120, textAlign: "right" }}
                        />
                      </td>
                      <td className="num">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.credit}
                          onChange={(e) => updateLine(index, { credit: e.target.value })}
                          aria-label={`Line ${index + 1} credit`}
                          style={{ width: 120, textAlign: "right" }}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          aria-label={`Remove line ${index + 1}`}
                          disabled={lines.length <= 2}
                          onClick={() =>
                            setLines((current) => current.filter((_, i) => i !== index))
                          }
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>
                      <button
                        type="button"
                        onClick={() => {
                          justAdded.current = true;
                          setLines(withNewLine);
                        }}
                      >
                        Add line
                      </button>
                    </td>
                    <td className="num">
                      <strong>{money(totalDebit)}</strong>
                    </td>
                    <td className="num">
                      <strong>{money(totalCredit)}</strong>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="row" style={{ alignItems: "center", marginTop: 12 }}>
              <span className="sub" style={{ flex: 1 }}>
                {balanced
                  ? "In balance."
                  : `Out of balance by ${money(Math.abs(difference))}.`}
              </span>
              <button
                className="primary"
                type="button"
                disabled={busy || !balanced}
                onClick={() => void submit()}
              >
                {busy ? "Posting…" : "Post voucher"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reverseTarget && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setReverseTarget(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setReverseTarget(null);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-label="Reverse journal voucher">
            <h2 style={{ marginTop: 0 }}>Reverse {reverseTarget.voucher_number}</h2>
            <p className="sub" style={{ marginTop: 0 }}>
              Posts the opposite entry for {money(reverseTarget.total_debit)}. The original stays in
              the ledger.
            </p>
            {error && <div className="error">{error}</div>}
            <div>
              <label>Reversal date</label>
              <input
                type="date"
                autoFocus
                value={reverseDate}
                onChange={(e) => setReverseDate(e.target.value)}
              />
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button type="button" onClick={() => setReverseTarget(null)}>
                Cancel
              </button>
              <button className="primary" type="button" disabled={busy} onClick={() => void reverse()}>
                {busy ? "Posting…" : "Post reversal"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="row" style={{ alignItems: "center" }}>
          <h2 style={{ flex: 1, margin: 0 }}>
            Manual vouchers{" "}
            <span className="badge">
              {visible.length} of {entries.length}
            </span>
          </h2>
          <FilterBox value={query} onChange={setQuery} />
        </div>
        <table>
          <thead>
            <tr>
              <th>Voucher</th>
              <th>Date</th>
              <th>Narration</th>
              <th>Reference</th>
              <th className="num">Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.voucher_number}</td>
                <td>{formatDate(entry.entry_date)}</td>
                <td>{entry.narration ?? "—"}</td>
                <td>{entry.reference_no ?? "—"}</td>
                <td className="num">{money(Number(entry.total_debit))}</td>
                <td>
                  <button type="button" onClick={() => void view(entry)}>
                    {detail?.id === entry.id ? "Hide" : "View"}
                  </button>{" "}
                  <button
                    type="button"
                    disabled={exporting === entry.id}
                    onClick={() => void exportVoucher(entry)}
                  >
                    {exporting === entry.id ? "Preparing…" : "Excel"}
                  </button>{" "}
                  <button type="button" onClick={() => setReverseTarget(entry)}>
                    Reverse
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6}>
                  {entries.length === 0
                    ? "No manual journal vouchers yet."
                    : "No vouchers match this filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {detail && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ marginBottom: 4 }}>{detail.voucher_number} — lines</h3>
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Description</th>
                  <th className="num">Debit</th>
                  <th className="num">Credit</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((line, index) => (
                  <tr key={index}>
                    <td>
                      {line.account_code} — {line.account_name}
                    </td>
                    <td>{line.description ?? "—"}</td>
                    <td className="num">{Number(line.debit) ? money(Number(line.debit)) : ""}</td>
                    <td className="num">{Number(line.credit) ? money(Number(line.credit)) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
