import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import FilterBox, { matchesQuery } from "../components/FilterBox";
import NumberInput from "../components/NumberInput";
import SearchableSelect from "../components/SearchableSelect";
import { SortTh, sortRows, type SortState } from "../components/Sort";
import { formatDate } from "../lib/format";
import { usePageVisible } from "../lib/pageVisibility";
import type { Asset, Party } from "../types";

const PAYMENT_TYPES = ["CREDIT", "CASH", "BANK", "CHEQUE"] as const;
const CLASSIFICATIONS = ["NON_CURRENT", "CURRENT"] as const;

function money(value: number): string {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function message(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [codes, setCodes] = useState<Array<{ code: string; label: string }>>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);

  const [assetName, setAssetName] = useState("");
  const [assetCode, setAssetCode] = useState("1503");
  const [amount, setAmount] = useState(0);
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [paymentType, setPaymentType] = useState<(typeof PAYMENT_TYPES)[number]>("CREDIT");
  const [classification, setClassification] = useState<(typeof CLASSIFICATIONS)[number]>("NON_CURRENT");
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  /** Account being edited in the form; null = recording a new purchase. */
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);

  // Disposal dialog
  const [disposeTarget, setDisposeTarget] = useState<Asset | null>(null);
  const [disposeDate, setDisposeDate] = useState(today);
  const [proceeds, setProceeds] = useState(0);
  const [disposeNotes, setDisposeNotes] = useState("");

  async function refresh(): Promise<void> {
    try {
      const [assetList, codeList, supplierList] = await Promise.all([
        api.assets(),
        api.assetCodes(),
        api.parties({ type: "SUPPLIER" }),
      ]);
      setAssets(assetList);
      setCodes(codeList);
      setSuppliers(supplierList);
      if (codeList.length > 0 && !codeList.some((c) => c.code === assetCode)) {
        setAssetCode(codeList[0]!.code);
      }
    } catch (err) {
      setError(message(err, "Failed to load assets."));
    }
  }

  const pageVisible = usePageVisible();

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageVisible]);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!assetName.trim()) {
      setError("Asset name is required.");
      return;
    }
    if (amount <= 0) {
      setError("Enter a purchase amount greater than 0.");
      return;
    }
    setBusy(true);
    try {
      if (editingAccountId != null) {
        await api.updateAsset(editingAccountId, {
          assetName: assetName.trim(),
          amount,
          purchaseDate,
          paymentType,
          classification,
          supplierId: paymentType === "CREDIT" ? supplierId : null,
          dueDate: classification === "CURRENT" ? dueDate || null : null,
          notes: notes || null,
        });
        setNotice(`Asset updated — ${money(amount)} (${paymentType.toLowerCase()}).`);
        setEditingAccountId(null);
      } else {
        const created = await api.createAsset({
          assetName: assetName.trim(),
          assetCode,
          amount,
          purchaseDate,
          paymentType,
          classification,
          supplierId: paymentType === "CREDIT" ? supplierId : null,
          dueDate: classification === "CURRENT" ? dueDate || null : null,
          notes: notes || null,
        });
        setNotice(
          `Recorded ${created.account_code} — ${money(amount)} (${paymentType.toLowerCase()}).`,
        );
      }
      setAssetName("");
      setAmount(0);
      setNotes("");
      setDueDate("");
      await refresh();
    } catch (err) {
      setError(message(err, "Failed to record the asset."));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(asset: Asset): void {
    setError(null);
    setNotice(null);
    setEditingAccountId(asset.account_id);
    setAssetName(asset.account_name.replace(" (Asset)", ""));
    setAssetCode(asset.account_code);
    setAmount(asset.purchase_amount ?? 0);
    setPurchaseDate(asset.purchase_date ?? today());
    setPaymentType(asset.supplier_id != null ? "CREDIT" : "CASH");
    setClassification(
      (asset.asset_type ?? asset.account_subtype) === "CURRENT" ? "CURRENT" : "NON_CURRENT",
    );
    setSupplierId(asset.supplier_id ?? null);
    setDueDate(asset.due_date ?? "");
    setNotes(asset.notes ?? "");
  }

  async function removeAsset(asset: Asset): Promise<void> {
    if (!window.confirm(`Delete ${asset.account_name.replace(" (Asset)", "")}? Its purchase entry is reversed.`)) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await api.deleteAsset(asset.account_id);
      setNotice("Asset deleted.");
      if (editingAccountId === asset.account_id) setEditingAccountId(null);
      await refresh();
    } catch (err) {
      setError(message(err, "Failed to delete the asset."));
    }
  }

  async function submitDisposal(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!disposeTarget) return;
    setError(null);
    setBusy(true);
    try {
      const result = await api.disposeAsset(disposeTarget.account_id, {
        disposeDate,
        proceeds,
        notes: disposeNotes.trim() || null,
      });
      setNotice(
        `${disposeTarget.account_name.replace(" (Asset)", "")} disposed — ${
          result.gainLoss < 0 ? "loss" : "gain"
        } ${money(Math.abs(result.gainLoss))}.`,
      );
      setDisposeTarget(null);
      setProceeds(0);
      setDisposeNotes("");
      await refresh();
    } catch (err) {
      setError(message(err, "Failed to dispose of the asset."));
    } finally {
      setBusy(false);
    }
  }

  const total = assets.reduce((sum, asset) => sum + asset.current_balance, 0);
  const visibleAssets = sortRows(
    assets.filter((asset) =>
      matchesQuery(query, [
        asset.account_code,
        asset.account_name,
        asset.asset_type,
        asset.account_subtype,
        asset.purchase_date,
        asset.purchase_amount,
        asset.due_date,
      ]),
    ),
    sort,
    (asset, key) => {
      switch (key) {
        case "code":
          return asset.account_code;
        case "asset":
          return asset.account_name;
        case "classification":
          return asset.asset_type ?? asset.account_subtype;
        case "purchased":
          return asset.purchase_date;
        case "purchase":
          return asset.purchase_amount;
        case "book":
          return asset.current_balance;
        case "due":
          return asset.due_date;
        default:
          return "";
      }
    },
  );

  return (
    <>
      <div className="card">
        <div className="row" style={{ alignItems: "center" }}>
          <h2 style={{ flex: 1, margin: 0 }}>
            Fixed Assets <span className="badge">Book value {money(total)}</span>
          </h2>
          <FilterBox value={query} onChange={setQuery} />
        </div>
        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        {notice && (
          <div className="badge" style={{ display: "inline-block", marginTop: 12 }}>
            {notice}
          </div>
        )}
        <table>
          <thead>
            <tr>
              <SortTh label="Code" sortKey="code" sort={sort} setSort={setSort} />
              <SortTh label="Asset" sortKey="asset" sort={sort} setSort={setSort} />
              <SortTh label="Classification" sortKey="classification" sort={sort} setSort={setSort} />
              <SortTh label="Purchased" sortKey="purchased" sort={sort} setSort={setSort} />
              <SortTh label="Purchase amount" sortKey="purchase" sort={sort} setSort={setSort} className="num" />
              <SortTh label="Book value" sortKey="book" sort={sort} setSort={setSort} className="num" />
              <SortTh label="Due date" sortKey="due" sort={sort} setSort={setSort} />
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleAssets.map((asset) => (
              <tr key={asset.account_id}>
                <td>{asset.account_code}</td>
                <td>{asset.account_name.replace(" (Asset)", "")}</td>
                <td>{asset.asset_type ?? asset.account_subtype ?? "N/A"}</td>
                <td>{formatDate(asset.purchase_date) || "—"}</td>
                <td className="num">
                  {asset.purchase_amount == null ? "—" : money(asset.purchase_amount)}
                </td>
                <td className="num">{money(asset.current_balance)}</td>
                <td>{formatDate(asset.due_date) || "—"}</td>
                <td>
                  <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <button type="button" onClick={() => startEdit(asset)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setDisposeTarget(asset);
                        setDisposeDate(today());
                        setProceeds(0);
                        setDisposeNotes("");
                      }}
                    >
                      Dispose
                    </button>
                    <button type="button" onClick={() => void removeAsset(asset)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visibleAssets.length === 0 && (
              <tr>
                <td colSpan={8}>
                  {assets.length === 0
                    ? "No fixed asset accounts."
                    : "No assets match this filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p style={{ opacity: 0.7, fontSize: 12, marginBottom: 0 }}>
          Each asset is a chart-of-accounts entry under <code>15xx</code>; recording a purchase posts
          Dr asset / Cr credit-or-cash. A code can only describe one asset record (1501–1506).
        </p>
      </div>

      <form className="card" onSubmit={submit}>
        <h2>{editingAccountId != null ? "Edit asset purchase" : "Record an asset purchase"}</h2>
        <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label>Asset name</label>
            <input
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="e.g. Production Machinery"
            />
          </div>
          <div>
            <label>Asset code</label>
            <SearchableSelect
              value={assetCode}
              onChange={setAssetCode}
              placeholder="Search code…"
              emptyText="No matching code"
              disabled={editingAccountId != null}
              options={codes.map((entry) => ({
                value: entry.code,
                label: `${entry.code} — ${entry.label}`,
              }))}
            />
          </div>
          <div>
            <label>Purchase amount</label>
            <NumberInput
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              style={{ width: 140 }}
            />
          </div>
          <div>
            <label>Purchase date</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>
          <div>
            <label>Classification</label>
            <SearchableSelect
              value={classification}
              onChange={(next) => setClassification(next as (typeof CLASSIFICATIONS)[number])}
              placeholder="Classification"
              options={CLASSIFICATIONS.map((value) => ({
                value,
                label: value === "CURRENT" ? "Current (due within 1 year)" : "Non-current",
              }))}
            />
          </div>
          <div>
            <label>Payment</label>
            <SearchableSelect
              value={paymentType}
              onChange={(next) => setPaymentType(next as (typeof PAYMENT_TYPES)[number])}
              placeholder="Payment"
              options={PAYMENT_TYPES.map((value) => ({
                value,
                label: value === "CREDIT" ? "Credit (pay later)" : value,
              }))}
            />
          </div>
          {paymentType === "CREDIT" && (
            <div>
              <label>Supplier</label>
              <SearchableSelect
                value={supplierId == null ? "" : String(supplierId)}
                onChange={(next) => setSupplierId(next ? Number(next) : null)}
                placeholder="None"
                emptyText="No matching supplier"
                options={[
                  { value: "", label: "None" },
                  ...suppliers.map((party) => ({
                    value: String(party.id),
                    label: `${party.code} — ${party.name}`,
                  })),
                ]}
              />
            </div>
          )}
          {classification === "CURRENT" && (
            <div>
              <label>Due date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          )}
          <div>
            <label>Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : editingAccountId != null ? "Save changes" : "Record asset"}
          </button>
          {editingAccountId != null && (
            <button type="button" onClick={() => setEditingAccountId(null)}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {disposeTarget && (
        <div className="modal-overlay" role="presentation">
          <form className="modal" role="dialog" aria-modal="true" onSubmit={submitDisposal}>
            <h2>Dispose of {disposeTarget.account_name.replace(" (Asset)", "")}</h2>
            <p className="sub" style={{ marginTop: 0 }}>
              Book value {money(disposeTarget.current_balance)}. The difference to the proceeds goes
              to Gain / Loss on Asset Disposal (6900).
            </p>
            <div className="row">
              <div>
                <label>Disposal date</label>
                <input
                  type="date"
                  value={disposeDate}
                  onChange={(e) => setDisposeDate(e.target.value)}
                />
              </div>
              <div>
                <label>Proceeds (cash)</label>
                <NumberInput
                  min="0"
                  step="0.01"
                  value={proceeds}
                  onChange={(e) => setProceeds(Number(e.target.value))}
                />
              </div>
            </div>
            <div>
              <label>Notes</label>
              <input value={disposeNotes} onChange={(e) => setDisposeNotes(e.target.value)} />
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button type="button" onClick={() => setDisposeTarget(null)}>
                Cancel
              </button>
              <button className="primary" type="submit" disabled={busy}>
                {busy ? "Disposing…" : "Dispose"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
