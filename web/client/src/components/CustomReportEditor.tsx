/**
 * Editor for the custom P&L / balance-sheet headings.
 *
 * Each heading either sums picked CoA nodes or is a signed subtotal of the
 * account headings. The draft lives here until Save, so Cancel can never leave
 * a half-edited template behind.
 */
import { useState } from "react";
import AccountTreePicker from "./AccountTreePicker";
import type {
  Account,
  AccountType,
  CustomHeading,
  CustomReportKind,
} from "../types";

interface Props {
  kind: CustomReportKind;
  accounts: Account[];
  headings: CustomHeading[];
  busy: boolean;
  error: string | null;
  onSave: (headings: CustomHeading[]) => void;
  onCancel: () => void;
}

const TYPES: Record<CustomReportKind, AccountType[]> = {
  PL: ["REVENUE", "EXPENSE"],
  BS: ["ASSET", "LIABILITY", "EQUITY"],
};

export default function CustomReportEditor({
  kind,
  accounts,
  headings,
  busy,
  error,
  onSave,
  onCancel,
}: Props) {
  const [draft, setDraft] = useState<CustomHeading[]>(headings);
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  function update(id: string, patch: Partial<CustomHeading>): void {
    setDraft((current) =>
      current.map((heading) => (heading.id === id ? { ...heading, ...patch } : heading)),
    );
  }

  function remove(id: string): void {
    setDraft((current) =>
      current
        .filter((heading) => heading.id !== id)
        .map((heading) =>
          heading.kind === "subtotal"
            ? { ...heading, parts: heading.parts.filter((part) => part.headingId !== id) }
            : heading,
        ),
    );
    setPickerFor((current) => (current === id ? null : current));
  }

  function add(): void {
    const next = Math.max(0, ...draft.map((heading) => Number(heading.id.replace(/\D/g, "")) || 0)) + 1;
    setDraft((current) => [
      ...current,
      { id: `h${next}`, name: `Heading ${next}`, kind: "accounts", accountIds: [], parts: [] },
    ]);
  }

  function setKind(heading: CustomHeading, value: "accounts" | "subtotal"): void {
    if (value === heading.kind) return;
    update(heading.id, {
      kind: value,
      accountIds: [],
      excludedAccountIds: undefined,
      parts: [],
      ...(value === "subtotal" ? { basis: undefined } : {}),
    });
  }

  function signOf(heading: CustomHeading, partId: string): 0 | 1 | -1 {
    return heading.parts.find((part) => part.headingId === partId)?.sign ?? 0;
  }

  function setSign(heading: CustomHeading, partId: string, sign: 0 | 1 | -1): void {
    const parts = heading.parts.filter((part) => part.headingId !== partId);
    if (sign !== 0) parts.push({ headingId: partId, sign });
    update(heading.id, { parts });
  }

  return (
    <div>
      {draft.map((heading, headingIndex) => (
        <div key={heading.id} className="card" style={{ marginBottom: 8 }}>
          <div className="row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label>Heading name</label>
              <input
                value={heading.name}
                onChange={(event) => update(heading.id, { name: event.target.value })}
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ width: 70 }}>
              <label>Note</label>
              <input
                value={heading.note ?? ""}
                maxLength={20}
                onChange={(event) =>
                  update(heading.id, { note: event.target.value.trim() || undefined })
                }
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label>Value</label>
              <select
                value={heading.kind}
                onChange={(event) => setKind(heading, event.target.value as "accounts" | "subtotal")}
              >
                <option value="accounts">Sum of selected accounts</option>
                <option value="subtotal">Subtotal of headings</option>
              </select>
            </div>
            <button onClick={() => remove(heading.id)} disabled={busy} title="Delete this heading">
              Delete
            </button>
          </div>

          {heading.kind === "accounts" ? (
            <>
              <button
                onClick={() => setPickerFor(pickerFor === heading.id ? null : heading.id)}
                style={{ marginTop: 8 }}
              >
                {pickerFor === heading.id
                  ? "Hide accounts"
                  : `Select accounts (${heading.accountIds.length} picked${
                      heading.excludedAccountIds?.length
                        ? `, ${heading.excludedAccountIds.length} excluded`
                        : ""
                    })`}
              </button>
              {pickerFor === heading.id && (
                <div style={{ marginTop: 8 }}>
                  <AccountTreePicker
                    accounts={accounts}
                    types={heading.basis === "opening" ? ["EQUITY"] : TYPES[kind]}
                    selected={heading.accountIds}
                    onChange={(accountIds) => update(heading.id, { accountIds })}
                    excluded={heading.excludedAccountIds ?? []}
                    onExcludedChange={(excludedAccountIds) =>
                      update(heading.id, { excludedAccountIds })
                    }
                    netProfit={kind === "BS"}
                    openingProfit={heading.basis === "opening"}
                  />
                  {heading.basis === "opening" && (
                    <p style={{ opacity: 0.7, fontSize: 12, margin: "6px 0 0" }}>
                      Uses balances carried into the selected From date.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="row" style={{ flexWrap: "wrap", gap: 12, marginTop: 8 }}>
              {draft
                .filter(
                  (other, otherIndex) =>
                    other.id !== heading.id &&
                    (other.kind === "accounts" || otherIndex < headingIndex),
                )
                .map((other) => {
                  const sign = signOf(heading, other.id);
                  return (
                    <div key={other.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span>{other.name}</span>
                      <button
                        className={sign === 1 ? "primary" : undefined}
                        onClick={() => setSign(heading, other.id, sign === 1 ? 0 : 1)}
                        disabled={busy}
                        title={`Add ${other.name}`}
                      >
                        +
                      </button>
                      <button
                        className={sign === -1 ? "primary" : undefined}
                        onClick={() => setSign(heading, other.id, sign === -1 ? 0 : -1)}
                        disabled={busy}
                        title={`Subtract ${other.name}`}
                      >
                        −
                      </button>
                    </div>
                  );
                })}
              {draft.filter(
                (other, otherIndex) =>
                  other.id !== heading.id &&
                  (other.kind === "accounts" || otherIndex < headingIndex),
              ).length === 0 && (
                <p style={{ opacity: 0.7, margin: 0 }}>
                  Add an account heading first, then come back to build the subtotal.
                </p>
              )}
            </div>
          )}
        </div>
      ))}

      {error && <div className="error">{error}</div>}

      <div className="row" style={{ flexWrap: "wrap" }}>
        <button className="primary" onClick={() => onSave(draft)} disabled={busy}>
          {busy ? "Saving…" : "Save headings"}
        </button>
        <button onClick={add} disabled={busy}>
          + Add heading
        </button>
        <button onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
