import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import FilterBox, { matchesQuery } from "../components/FilterBox";
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

  const [assetName, setAssetName] = useState("");
  const [assetCode, setAssetCode] = useState("1503");
  const [amount, setAmount] = useState(0);
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [paymentType, setPaymentType] = useState<(typeof PAYMENT_TYPES)[number]>("CREDIT");
  const [classification, setClassification] = useState<(typeof CLASSIFICATIONS)[number]>("NON_CURRENT");
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

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

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const total = assets.reduce((sum, asset) => sum + asset.current_balance, 0);
  const visibleAssets = assets.filter((asset) =>
    matchesQuery(query, [
      asset.account_code,
      asset.account_name,
      asset.asset_type,
      asset.account_subtype,
      asset.purchase_date,
      asset.purchase_amount,
      asset.due_date,
    ]),
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
              <th>Code</th>
              <th>Asset</th>
              <th>Classification</th>
              <th>Purchased</th>
              <th className="num">Purchase amount</th>
              <th className="num">Book value</th>
              <th>Due date</th>
            </tr>
          </thead>
          <tbody>
            {visibleAssets.map((asset) => (
              <tr key={asset.account_id}>
                <td>{asset.account_code}</td>
                <td>{asset.account_name.replace(" (Asset)", "")}</td>
                <td>{asset.asset_type ?? asset.account_subtype ?? "N/A"}</td>
                <td>{asset.purchase_date ?? "—"}</td>
                <td className="num">
                  {asset.purchase_amount == null ? "—" : money(asset.purchase_amount)}
                </td>
                <td className="num">{money(asset.current_balance)}</td>
                <td>{asset.due_date ?? "—"}</td>
              </tr>
            ))}
            {visibleAssets.length === 0 && (
              <tr>
                <td colSpan={7}>
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
        <h2>Record an asset purchase</h2>
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
            <select value={assetCode} onChange={(e) => setAssetCode(e.target.value)}>
              {codes.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.code} — {entry.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Purchase amount</label>
            <input
              type="number"
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
            <select
              value={classification}
              onChange={(e) =>
                setClassification(e.target.value as (typeof CLASSIFICATIONS)[number])
              }
            >
              {CLASSIFICATIONS.map((value) => (
                <option key={value} value={value}>
                  {value === "CURRENT" ? "Current (due within 1 year)" : "Non-current"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Payment</label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as (typeof PAYMENT_TYPES)[number])}
            >
              {PAYMENT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {value === "CREDIT" ? "Credit (pay later)" : value}
                </option>
              ))}
            </select>
          </div>
          {paymentType === "CREDIT" && (
            <div>
              <label>Supplier</label>
              <select
                value={supplierId ?? ""}
                onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">None</option>
                {suppliers.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.code} — {party.name}
                  </option>
                ))}
              </select>
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
            {busy ? "Saving…" : "Record asset"}
          </button>
        </div>
      </form>
    </>
  );
}
