import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import NumberInput from "../components/NumberInput";
import SearchableSelect from "../components/SearchableSelect";
import { usePageVisible } from "../lib/pageVisibility";
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

  const pageVisible = usePageVisible();

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, search, showInactive, pageVisible]);

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
            <input
              data-search
              className="filter-box"
              placeholder="Search name, code or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label>Type</label>
            <SearchableSelect
              value={typeFilter}
              onChange={setTypeFilter}
              placeholder="Type"
              options={[
                { value: "", label: "All" },
                { value: "CUSTOMER", label: "Customers" },
                { value: "SUPPLIER", label: "Suppliers" },
              ]}
            />
          </div>
          <div>
            <label>Show</label>
            <SearchableSelect
              value={showInactive ? "all" : "active"}
              onChange={(next) => setShowInactive(next === "all")}
              placeholder="Show"
              options={[
                { value: "active", label: "Active only" },
                { value: "all", label: "Include inactive" },
              ]}
            />
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
            <SearchableSelect
              value={draft.partyType}
              onChange={(next) => set("partyType", next as PartyType)}
              placeholder="Type"
              options={[
                { value: "CUSTOMER", label: "CUSTOMER" },
                { value: "SUPPLIER", label: "SUPPLIER" },
                { value: "BOTH", label: "BOTH" },
              ]}
            />
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
            <SearchableSelect
              value={draft.customerCategory}
              onChange={(next) => set("customerCategory", next)}
              placeholder="None"
              emptyText="No matching category"
              options={[
                { value: "", label: "None" },
                ...CATEGORIES.map((c) => ({ value: c, label: c })),
              ]}
            />
          </div>
          <div>
            <label>Credit limit</label>
            <NumberInput
              min="0"
              step="0.01"
              value={draft.creditLimit}
              onChange={(e) => set("creditLimit", Number(e.target.value))}
              style={{ width: 120 }}
            />
          </div>
          <div>
            <label>Linked account</label>
            <SearchableSelect
              value={draft.accountId == null ? "" : String(draft.accountId)}
              onChange={(next) => set("accountId", next ? Number(next) : null)}
              placeholder="None"
              emptyText="No matching account"
              options={[
                { value: "", label: "None" },
                ...relevantAccounts.map((account) => ({
                  value: String(account.id),
                  label: `${account.account_code} — ${account.account_name}`,
                })),
              ]}
            />
          </div>
          {editing && (
            <div>
              <label>Status</label>
              <SearchableSelect
                value={draft.isActive ? "1" : "0"}
                onChange={(next) => set("isActive", next === "1")}
                placeholder="Status"
                options={[
                  { value: "1", label: "Active" },
                  { value: "0", label: "Inactive" },
                ]}
              />
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
