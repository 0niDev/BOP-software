import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { api, ApiError, getToken } from "../api";
import SearchableSelect from "../components/SearchableSelect";
import { DATE_FORMATS, formatDate, setDateFormat } from "../lib/format";
import { shortcutsChanged } from "../shortcuts";
import { applyTheme, THEMES } from "../theme";
import type { BackupStatus, DatabaseInfo, MirrorStatus, ShortcutEntry } from "../types";

/** Picker lists ported from settings_view.py. */
const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "SAR", "AED"];

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
  const [dateFormat, setDateFormatValue] = useState("dd/MM/yyyy");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const [backups, setBackups] = useState<BackupStatus | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [mirror, setMirror] = useState<MirrorStatus | null>(null);
  const [mirrorBusy, setMirrorBusy] = useState(false);

  const [shortcuts, setShortcuts] = useState<ShortcutEntry[]>([]);
  const [shortcutFilter, setShortcutFilter] = useState("");
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState("");

  const [database, setDatabase] = useState<DatabaseInfo | null>(null);

  async function loadShortcuts(): Promise<void> {
    try {
      setShortcuts(await api.shortcuts());
    } catch (err) {
      setError(message(err, "Failed to load shortcuts."));
    }
  }

  /** Turn the keys the user just pressed into a Qt-style sequence. */
  function captureShortcutKeys(event: KeyboardEvent<HTMLInputElement>, actionId: string): void {
    event.preventDefault();
    if (event.key === "Escape") {
      setEditingShortcut(null);
      setDraftKey("");
      return;
    }
    if (event.key === "Enter") {
      void saveShortcut(actionId);
      return;
    }
    if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) return;
    const parts: string[] = [];
    if (event.ctrlKey) parts.push("Ctrl");
    if (event.altKey) parts.push("Alt");
    if (event.shiftKey) parts.push("Shift");
    parts.push(event.key.length === 1 ? event.key.toUpperCase() : event.key);
    setDraftKey(parts.join("+"));
  }

  async function saveShortcut(actionId: string): Promise<void> {
    setError(null);
    setNotice(null);
    const sequence = draftKey.trim();
    if (!sequence) {
      setError("A shortcut key is required.");
      return;
    }
    try {
      await api.updateShortcut(actionId, sequence);
      setEditingShortcut(null);
      setDraftKey("");
      await loadShortcuts();
      shortcutsChanged();
      setNotice(`Shortcut saved: ${sequence}.`);
    } catch (err) {
      setError(message(err, "Failed to update the shortcut."));
    }
  }

  async function resetShortcut(actionId: string): Promise<void> {
    setError(null);
    setNotice(null);
    try {
      await api.resetShortcut(actionId);
      setEditingShortcut(null);
      await loadShortcuts();
      shortcutsChanged();
    } catch (err) {
      setError(message(err, "Failed to reset the shortcut."));
    }
  }

  async function resetAllShortcuts(): Promise<void> {
    setError(null);
    setNotice(null);
    try {
      const { removed } = await api.resetAllShortcuts();
      setEditingShortcut(null);
      await loadShortcuts();
      shortcutsChanged();
      setNotice(`Reset ${removed} shortcut(s) to their defaults.`);
    } catch (err) {
      setError(message(err, "Failed to reset the shortcuts."));
    }
  }

  async function loadBackups(): Promise<void> {
    try {
      setBackups(await api.backupStatus());
      setMirror(await api.mirrorStatus());
    } catch (err) {
      setError(message(err, "Failed to load backup status."));
    }
  }

  async function syncMirror(): Promise<void> {
    setError(null);
    setNotice(null);
    setMirrorBusy(true);
    try {
      const result = await api.syncMirror();
      setMirror(result);
      setNotice(`Local copy refreshed (${formatBytes(result.bytes)}).`);
    } catch (err) {
      setError(message(err, "Could not refresh the local copy."));
    } finally {
      setMirrorBusy(false);
    }
  }

  async function downloadLive(): Promise<void> {
    try {
      const blob = await api.downloadMirror();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "erp_mirror.db";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(message(err, "Download failed."));
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
    void loadShortcuts();
    void api.databaseInfo().then(setDatabase).catch(() => undefined);
    api
      .settings()
      .then((all) => {
        const value = all.APPEARANCE?.theme_name;
        if (typeof value === "string") setTheme(value);
        const general = all.GENERAL ?? {};
        if (typeof general.company_name === "string") setCompanyName(general.company_name);
        if (typeof general.currency === "string") setCurrency(general.currency);
        if (typeof general.date_format === "string") setDateFormatValue(general.date_format);
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
      setDateFormat(dateFormat);
      setNotice("Company profile saved.");
    } catch (err) {
      setError(message(err, "Failed to save the company profile."));
    } finally {
      setBusy(false);
    }
  }

  const needle = shortcutFilter.trim().toLowerCase();
  const visibleShortcuts = needle
    ? shortcuts.filter(
        (entry) =>
          entry.description.toLowerCase().includes(needle) ||
          entry.category.toLowerCase().includes(needle) ||
          entry.currentSequence.toLowerCase().includes(needle),
      )
    : shortcuts;

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
            <SearchableSelect
              value={theme}
              onChange={setTheme}
              placeholder="Theme"
              options={THEMES.map((name) => ({ value: name, label: name }))}
            />
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
            <SearchableSelect
              value={currency}
              onChange={setCurrency}
              placeholder="Currency"
              options={CURRENCIES.map((code) => ({ value: code, label: code }))}
            />
          </div>
          <div>
            <label>Date format</label>
            <SearchableSelect
              value={dateFormat}
              onChange={setDateFormatValue}
              placeholder="Date format"
              options={DATE_FORMATS.map((format) => ({ value: format, label: format }))}
            />
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
            Shortcuts <span className="badge">{shortcuts.length} actions</span>
          </h2>
          <input
            placeholder="Filter shortcuts…"
            value={shortcutFilter}
            onChange={(e) => setShortcutFilter(e.target.value)}
            style={{ width: 220 }}
          />
          <button onClick={() => void resetAllShortcuts()} disabled={shortcuts.length === 0}>
            Reset all to defaults
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Category</th>
              <th>Current key</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {visibleShortcuts.map((entry) => (
              <tr key={entry.actionId}>
                <td>{entry.description}</td>
                <td>{entry.category}</td>
                <td>
                  <code>{entry.currentSequence}</code>
                  {entry.currentSequence !== entry.defaultSequence && (
                    <span style={{ opacity: 0.6 }}> (default {entry.defaultSequence})</span>
                  )}
                </td>
                <td>
                  {editingShortcut === entry.actionId ? (
                    <div className="row">
                      <input
                        autoFocus
                        readOnly
                        value={draftKey}
                        placeholder="Press keys…"
                        onKeyDown={(event) => captureShortcutKeys(event, entry.actionId)}
                        style={{ width: 150 }}
                      />
                      <button className="primary" onClick={() => void saveShortcut(entry.actionId)}>
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingShortcut(null);
                          setDraftKey("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="row">
                      <button
                        onClick={() => {
                          setEditingShortcut(entry.actionId);
                          setDraftKey(entry.currentSequence);
                        }}
                      >
                        Edit
                      </button>
                      {entry.currentSequence !== entry.defaultSequence && (
                        <button onClick={() => void resetShortcut(entry.actionId)}>Reset</button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {visibleShortcuts.length === 0 && (
              <tr>
                <td colSpan={4}>No shortcut matches this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
        <p style={{ opacity: 0.7, fontSize: 12, marginBottom: 0 }}>
          Stored in the <code>SHORTCUTS</code> settings group in the same format as the
          desktop app. Module jumps, module next/previous and focusing the search box are
          live here; copy/paste/undo, Ctrl+S and Ctrl+W are handled by the browser.
        </p>
      </div>

      <div className="card">
        <h2>Database</h2>
        {database ? (
          <table>
            <tbody>
              <tr>
                <th>Engine</th>
                <td>{database.engine}</td>
              </tr>
              <tr>
                <th>Connection</th>
                <td>
                  <code>{database.location}</code>
                </td>
              </tr>
              <tr>
                <th>Configured by</th>
                <td>
                  <code>{database.source}</code>
                </td>
              </tr>
              <tr>
                <th>SQLite version</th>
                <td>{database.sqliteVersion}</td>
              </tr>
              <tr>
                <th>Company / currency</th>
                <td>
                  {database.companyId} / {database.currency}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p style={{ opacity: 0.7 }}>Loading connection information…</p>
        )}
        <p style={{ color: "var(--warning, #f39c12)", fontSize: 12, marginBottom: 0 }}>
          ⚠️ The connection is read from the environment when the server starts, so changing
          it (<code>web/.env</code> or <code>SQLITE_CLOUD_URL</code>) needs a restart. Credentials
          stay in the environment and are never stored in settings.
        </p>
      </div>

      <div className="card">
        <div className="row" style={{ alignItems: "center" }}>
          <h2 style={{ flex: 1, margin: 0 }}>
            Local copy{" "}
            {mirror?.exists && <span className="badge">{formatBytes(mirror.bytes)}</span>}{" "}
            {mirror?.pending && <span className="badge">syncing…</span>}
          </h2>
          <button onClick={() => void syncMirror()} disabled={mirrorBusy || !mirror}>
            {mirrorBusy ? "Syncing…" : "Sync now"}
          </button>
          <button onClick={() => void downloadLive()} disabled={!mirror?.exists}>
            Download
          </button>
        </div>
        {mirror ? (
          <>
            <p style={{ opacity: 0.7, fontSize: 12 }}>
              {mirror.enabled
                ? mirror.exists
                  ? `Refreshed ${mirror.lagSeconds ?? 0}s ago, then again shortly after every change. `
                  : "No copy written yet. "
                : "Automatic refresh is off (ERP_LIVE_MIRROR=0). "}
              Saved on the server at <code>{mirror.path}</code>.
            </p>
            {mirror.pcDirectory ? (
              <p
                style={{
                  fontSize: 12,
                  marginBottom: 0,
                  color: mirror.pcError ? "var(--warning, #f39c12)" : undefined,
                  opacity: mirror.pcError ? 1 : 0.7,
                }}
              >
                {mirror.pcError
                  ? `⚠ Could not save to your computer (${mirror.pcDirectory}): ${mirror.pcError}`
                  : `Copied to your computer (${mirror.pcDirectory})${
                      mirror.pcUpdatedAt
                        ? ` at ${formatDate(mirror.pcUpdatedAt, true)}`
                        : ""
                    }.`}
              </p>
            ) : (
              <p style={{ opacity: 0.7, fontSize: 12, marginBottom: 0 }}>
                Set <code>ERP_PC_MIRROR_DIR</code> to also push this file to a folder on your
                computer.
              </p>
            )}
            {mirror.lastError && (
              <p style={{ color: "var(--warning, #f39c12)", fontSize: 12, marginBottom: 0 }}>
                Last error: {mirror.lastError}
              </p>
            )}
          </>
        ) : (
          <p style={{ opacity: 0.7 }}>Loading the local copy…</p>
        )}
      </div>

      <div className="card">
        <div className="row" style={{ alignItems: "center" }}>
          <h2 style={{ flex: 1, margin: 0 }}>
            Backups{" "}
            {backups && <span className="badge">{backups.count} snapshot(s)</span>}
          </h2>
          <button
            className="primary"
            onClick={() => void runBackup()}
            disabled={backupBusy}
          >
            {backupBusy ? "Backing up…" : "Back up now"}
          </button>
        </div>
        {backups && (
          <p style={{ opacity: 0.7, fontSize: 12 }}>
            Engine <strong>{backups.engine}</strong> · folder <code>{backups.directory}</code> ·{" "}
            {formatBytes(backups.totalBytes)} used. Snapshots are portable SQLite files; restoring
            needs the server stopped or the provider's restore.
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
                <td>{formatDate(entry.modifiedAt, true)}</td>
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
