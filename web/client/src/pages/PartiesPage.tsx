import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import type { Account, Party, PartyType } from "../types";

interface Draft {
  name: string;
  code: string;
  partyType: PartyType;
  creditLimit: number;
  phone: string;
  address: string;
  email: string;
  accountId: number | null;
  customerCategory: string;
  isActive: boolean;
}

const EMPTY_DRAFT: Draft = {
  name: "",
  code: "",
  partyType: "CUSTOMER",
  creditLimit: 0,
  phone: "",
  address: "",
  email: "",
  accountId: null,
  customerCategory: "",
  isActive: true,
};

const CATEGORIES = ["FARMER", "INDIVIDUAL", "BUSINESS"] as const;

function money(value: number): string {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function message(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export default function PartiesPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<Party | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(): Promise<void> {
    try {
      const [partyList, accountList] = await Promise.all([
        api.parties({
          type: (typeFilter || undefined) as "CUSTOMER" | "SUPPLIER" | undefined,
          search: search || undefined,
          activeOnly: !showInactive,
        }),
        api.accounts(),
      ]);
      setParties(partyList);
      setAccounts(accountList);
    } catch (err) {
      setError(message(err, "Failed to load parties."));
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, search, showInactive]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startEdit(party: Party): void {
    setEditing(party);
    setError(null);
    setNotice(null);
    setDraft({
      name: party.name,
      code: party.code,
      partyType: party.party_type,
      creditLimit: party.credit_limit,
      phone: party.phone ?? "",
      address: party.address ?? "",
      email: party.email ?? "",
      accountId: party.account_id,
      customerCategory: party.customer_category ?? "",
      isActive: party.is_active === 1,
    });
  }

  function cancel(): void {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    void refresh();
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!draft.name.trim()) {
      setError("Party name is required.");
      return;
    }
    setBusy(true);
    try {
      const common = {
        name: draft.name.trim(),
        creditLimit: draft.creditLimit,
        accountId: draft.accountId,
        phone: draft.phone || null,
        address: draft.address || null,
        email: draft.email || null,
        customerCategory: draft.customerCategory || null,
      };
      if (editing) {
        await api.updateParty(editing.id, {
          ...common,
          partyType: draft.partyType,
          isActive: draft.isActive,
        });
        setNotice(`Updated ${editing.code}.`);
      } else {
        const created = await api.createParty({
          ...common,
          partyType: draft.partyType,
          code: draft.code.trim() || null,
        });
        setNotice(`Created ${created.code} — ${created.name}.`);
      }
      cancel();
    } catch (err) {
      setError(message(err, "Failed to save the party."));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(party: Party): Promise<void> {
    setError(null);
    setNotice(null);
    try {
      await api.deactivateParty(party.id);
      setNotice(`Deactivated ${party.code}.`);
      await refresh();
    } catch (err) {
      setError(message(err, "Failed to deactivate the party."));
    }
  }

  const relevantAccounts = accounts.filter((account) =>
    draft.partyType === "CUSTOMER"
      ? account.account_type === "ASSET"
      : draft.partyType === "SUPPLIER"
        ? account.account_type === "LIABILITY"
        : true,
  );

  return (
    <>
      <div className="card">
        <div className="row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
          <h2 style={{ flex: 1, margin: 0 }}>Customers &amp; Suppliers</h2>
          <div>
            <label>Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <label>Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All</option>
              <option value="CUSTOMER">Customers</option>
              <option value="SUPPLIER">Suppliers</option>
            </select>
          </div>
          <div>
            <label>Show</label>
            <select
              value={showInactive ? "all" : "active"}
              onChange={(e) => setShowInactive(e.target.value === "all")}
            >
              <option value="active">Active only</option>
              <option value="all">Include inactive</option>
            </select>
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        {notice && (
          <div className="badge" style={{ display: "inline-block" }}>
            {notice}
          </div>
        )}
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Phone</th>
              <th>Category</th>
              <th className="num">Credit limit</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {parties.map((party) => (
              <tr key={party.id}>
                <td>{party.code}</td>
                <td>{party.name}</td>
                <td>{party.party_type}</td>
                <td>{party.phone ?? "—"}</td>
                <td>{party.customer_category ?? "—"}</td>
                <td className="num">{money(party.credit_limit)}</td>
                <td>
                  <span className="badge">{party.is_active ? "Active" : "Inactive"}</span>
                </td>
                <td>
                  <button onClick={() => startEdit(party)}>Edit</button>{" "}
                  {party.is_active === 1 && (
                    <button onClick={() => void deactivate(party)}>Deactivate</button>
                  )}
                </td>
              </tr>
            ))}
            {parties.length === 0 && !error && (
              <tr>
                <td colSpan={8}>No parties match the current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form className="card" onSubmit={submit}>
        <h2>{editing ? `Edit party — ${editing.code}` : "Add party"}</h2>
        <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label>Code (blank = auto)</label>
            <input
              value={draft.code}
              onChange={(e) => set("code", e.target.value)}
              disabled={Boolean(editing)}
              placeholder="CUST-00001"
            />
          </div>
          <div>
            <label>Name</label>
            <input value={draft.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label>Type</label>
            <select
              value={draft.partyType}
              onChange={(e) => set("partyType", e.target.value as PartyType)}
            >
              <option value="CUSTOMER">CUSTOMER</option>
              <option value="SUPPLIER">SUPPLIER</option>
              <option value="BOTH">BOTH</option>
            </select>
          </div>
          <div>
            <label>Phone</label>
            <input value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <label>Address</label>
            <input value={draft.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div>
            <label>Email</label>
            <input value={draft.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <label>Category</label>
            <select
              value={draft.customerCategory}
              onChange={(e) => set("customerCategory", e.target.value)}
            >
              <option value="">None</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Credit limit</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.creditLimit}
              onChange={(e) => set("creditLimit", Number(e.target.value))}
              style={{ width: 120 }}
            />
          </div>
          <div>
            <label>Linked account</label>
            <select
              value={draft.accountId ?? ""}
              onChange={(e) => set("accountId", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">None</option>
              {relevantAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_code} — {account.account_name}
                </option>
              ))}
            </select>
          </div>
          {editing && (
            <div>
              <label>Status</label>
              <select
                value={draft.isActive ? "1" : "0"}
                onChange={(e) => set("isActive", e.target.value === "1")}
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
          )}
          <button className="primary" type="submit" disabled={busy}>
            {editing ? "Save changes" : "Add party"}
          </button>
          {editing && (
            <button type="button" onClick={cancel}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </>
  );
}
