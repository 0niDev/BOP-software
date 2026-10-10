import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, getToken } from "../api";
import { applyTheme, THEMES } from "../theme";
import type { BackupStatus } from "../types";

/** Picker lists ported from settings_view.py. */
const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "SAR", "AED"];
const DATE_FORMATS = ["yyyy-MM-dd", "dd/MM/yyyy", "MM/dd/yyyy", "dd.MM.yyyy"];

function message(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SettingsPage() {
  const [theme, setTheme] = useState<string>("dark");
  const [companyName, setCompanyName] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [dateFormat, setDateFormat] = useState("yyyy-MM-dd");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const [backups, setBackups] = useState<BackupStatus | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);

  async function loadBackups(): Promise<void> {
    try {
      setBackups(await api.backupStatus());
    } catch (err) {
      setError(message(err, "Failed to load backup status."));
    }
  }

  async function runBackup(): Promise<void> {
    setError(null);
    setNotice(null);
    setBackupBusy(true);
    try {
      const result = await api.runBackup();
      setNotice(`Backed up to ${result.file} (${formatBytes(result.bytes)}).`);
      await loadBackups();
    } catch (err) {
      setError(message(err, "Backup failed."));
    } finally {
      setBackupBusy(false);
    }
  }

  async function download(file: string): Promise<void> {
    try {
      const blob = await api.downloadBackup(file);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(message(err, "Download failed."));
    }
  }

  useEffect(() => {
    void loadBackups();
    api
      .settings()
      .then((all) => {
        const value = all.APPEARANCE?.theme_name;
        if (typeof value === "string") setTheme(value);
        const general = all.GENERAL ?? {};
        if (typeof general.company_name === "string") setCompanyName(general.company_name);
        if (typeof general.currency === "string") setCurrency(general.currency);
        if (typeof general.date_format === "string") setDateFormat(general.date_format);
        setLoaded(true);
      })
      .catch((err) => setError(message(err, "Failed to load settings.")));
  }, []);

  async function saveTheme(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await api.saveSettings("APPEARANCE", { theme_name: theme });
      applyTheme(theme);
      setNotice("Appearance settings saved.");
    } catch (err) {
      setError(message(err, "Failed to save the theme."));
    } finally {
      setBusy(false);
    }
  }

  async function saveCompany(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!companyName.trim()) {
      setError("Company name is required.");
      return;
    }
    setBusy(true);
    try {
      await api.saveSettings("GENERAL", {
        company_name: companyName.trim(),
        currency,
        date_format: dateFormat,
      });
      setNotice("Company profile saved.");
    } catch (err) {
      setError(message(err, "Failed to save the company profile."));
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setNotice("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(message(err, "Failed to change the password."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && <div className="error">{error}</div>}
      {notice && (
        <div className="badge" style={{ display: "inline-block" }}>
          {notice}
        </div>
      )}

      <form className="card" onSubmit={saveTheme}>
        <h2>Appearance</h2>
        {!loaded && <p style={{ opacity: 0.7 }}>Loading settings…</p>}
        <div className="row">
          <div>
            <label>Theme</label>
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              {THEMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <button className="primary" type="submit" disabled={busy || !loaded}>
            Save theme
          </button>
        </div>
      </form>

      <form className="card" onSubmit={saveCompany}>
        <h2>Company profile</h2>
        {!loaded && <p style={{ opacity: 0.7 }}>Loading settings…</p>}
        <div className="row">
          <div style={{ flex: "1 1 320px" }}>
            <label>Company name</label>
            <input
              style={{ width: "100%" }}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>
          <div>
            <label>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Date format</label>
            <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
              {DATE_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
          </div>
          <button className="primary" type="submit" disabled={busy || !loaded}>
            Save profile
          </button>
        </div>
        <p style={{ opacity: 0.7, fontSize: 12, marginBottom: 0 }}>
          Stored in the <code>GENERAL</code> settings group, exactly like the desktop app.
        </p>
      </form>

      <div className="card">
        <div className="row" style={{ alignItems: "center" }}>
          <h2 style={{ flex: 1, margin: 0 }}>
            Backups{" "}
            {backups && <span className="badge">{backups.count} snapshot(s)</span>}{" "}
            {backups && !backups.supported && <span className="badge">provider-managed</span>}
          </h2>
          <button
            className="primary"
            onClick={() => void runBackup()}
            disabled={backupBusy || backups?.supported === false}
          >
            {backupBusy ? "Backing up…" : "Back up now"}
          </button>
        </div>
        {backups && (
          <p style={{ opacity: 0.7, fontSize: 12 }}>
            Engine <strong>{backups.engine}</strong> · folder <code>{backups.directory}</code> ·{" "}
            {formatBytes(backups.totalBytes)} used
            {backups.supported
              ? ". Snapshots are written live with VACUUM INTO; restoring needs the server stopped."
              : ". The hosted database is snapshotted by the provider, so local snapshots are disabled."}
          </p>
        )}
        <table>
          <thead>
            <tr>
              <th>Snapshot</th>
              <th className="num">Size</th>
              <th>Taken</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(backups?.backups ?? []).map((entry) => (
              <tr key={entry.file}>
                <td>{entry.file}</td>
                <td className="num">{formatBytes(entry.bytes)}</td>
                <td>{entry.modifiedAt.slice(0, 19).replace("T", " ")}</td>
                <td>
                  <button onClick={() => void download(entry.file)}>Download</button>
                </td>
              </tr>
            ))}
            {(backups?.backups ?? []).length === 0 && (
              <tr>
                <td colSpan={4}>
                  {backups?.supported === false
                    ? "Local snapshots are disabled for this engine."
                    : "No snapshots yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form className="card" onSubmit={changePassword}>
        <h2>Change your password</h2>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <div>
            <label>Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <label>New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label>Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <button className="primary" type="submit" disabled={busy || !getToken()}>
            Change password
          </button>
        </div>
      </form>
    </>
  );
}
