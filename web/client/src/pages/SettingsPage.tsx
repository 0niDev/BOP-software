import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, getToken } from "../api";

const THEMES = ["dark", "light", "system", "custom"] as const;

function message(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export default function SettingsPage() {
  const [theme, setTheme] = useState<string>("dark");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .settings()
      .then((all) => {
        const value = all.APPEARANCE?.theme_name;
        if (typeof value === "string") setTheme(value);
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
      setNotice("Appearance settings saved.");
    } catch (err) {
      setError(message(err, "Failed to save the theme."));
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
