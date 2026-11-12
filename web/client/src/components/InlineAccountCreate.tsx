import { useState, type KeyboardEvent } from "react";
import { api, ApiError } from "../api";
import type { Account, AccountType } from "../types";
import SearchableSelect, { type SelectOption } from "./SearchableSelect";

/**
 * Create a chart-of-accounts row without leaving the form that needs it.
 * `parents` limits the levels: one fixed option (an item under its category)
 * or a short list (a category under its level-2 head).
 */
interface Props {
  parents: readonly SelectOption[];
  defaultParentId: number;
  accountType: AccountType;
  namePlaceholder: string;
  onCreated: (account: Account) => void;
  onCancel: () => void;
}

export default function InlineAccountCreate({
  parents,
  defaultParentId,
  accountType,
  namePlaceholder,
  onCreated,
  onCancel,
}: Props) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [parentId, setParentId] = useState(defaultParentId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(): Promise<void> {
    if (!name.trim()) {
      setError("A name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Blank code: the server allocates the next AC-xxxxx.
      const account = await api.createAccount({
        accountCode: code.trim(),
        accountName: name.trim(),
        accountType,
        parentAccountId: parentId || null,
      });
      onCreated(account);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create the account.");
    } finally {
      setBusy(false);
    }
  }

  // A div, not a form: one caller nests it inside an edit form.
  const onEnter = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void create();
  };

  return (
    <div className="row" style={{ alignItems: "flex-end", marginTop: 8 }}>
      <div style={{ flex: 2 }}>
        <label>Name</label>
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={onEnter}
          placeholder={namePlaceholder}
        />
      </div>
      <div>
        <label>Code (optional)</label>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={onEnter}
          placeholder="Auto"
          style={{ width: 120 }}
        />
      </div>
      <div style={{ flex: 1 }}>
        <label>Under</label>
        <SearchableSelect
          value={parentId ? String(parentId) : ""}
          onChange={(next) => setParentId(Number(next) || 0)}
          options={parents}
          placeholder="Parent"
        />
      </div>
      <button className="primary" type="button" disabled={busy} onClick={() => void create()}>
        {busy ? "Adding…" : "Create"}
      </button>
      <button type="button" disabled={busy} onClick={onCancel}>
        Cancel
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
