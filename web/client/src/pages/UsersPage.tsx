import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import type { Role, UserRow } from "../types";

interface Draft {
  username: string;
  fullName: string;
  email: string;
  roleName: string;
  password: string;
  isActive: boolean;
}

const EMPTY_DRAFT: Draft = {
  username: "",
  fullName: "",
  email: "",
  roleName: "",
  password: "",
  isActive: true,
};

function message(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function when(value: string | null): string {
  if (!value) return "—";
  return value.slice(0, 19).replace("T", " ");
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [resetFor, setResetFor] = useState<UserRow | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh(): Promise<void> {
    try {
      const [userList, roleList] = await Promise.all([api.users(), api.roles()]);
      setUsers(userList);
      setRoles(roleList);
      setDraft((current) => ({
        ...current,
        roleName: current.roleName || roleList[0]?.name || "",
      }));
    } catch (err) {
      setError(message(err, "Failed to load users."));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function set<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startEdit(user: UserRow): void {
    setEditing(user);
    setResetFor(null);
    setError(null);
    setNotice(null);
    setDraft({
      username: user.username,
      fullName: user.full_name,
      email: user.email ?? "",
      roleName: user.role_name ?? "",
      password: "",
      isActive: user.is_active === 1,
    });
  }

  function cancel(): void {
    setEditing(null);
    setResetFor(null);
    setResetPassword("");
    setDraft(EMPTY_DRAFT);
    setError(null);
    void refresh();
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!draft.fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!draft.roleName) {
      setError("Select a role.");
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await api.updateUser(editing.id, {
          fullName: draft.fullName.trim(),
          email: draft.email.trim() || null,
          roleName: draft.roleName,
          isActive: draft.isActive,
          password: draft.password || null,
        });
        setNotice(`Updated ${editing.username}.`);
      } else {
        if (!draft.username.trim()) {
          setError("Username is required.");
          setBusy(false);
          return;
        }
        if (!draft.password) {
          setError("Password is required.");
          setBusy(false);
          return;
        }
        await api.createUser({
          username: draft.username.trim(),
          fullName: draft.fullName.trim(),
          email: draft.email.trim() || null,
          password: draft.password,
          roleName: draft.roleName,
          isActive: draft.isActive,
        });
        setNotice(`Created ${draft.username.trim()}.`);
      }
      cancel();
    } catch (err) {
      setError(message(err, "Failed to save the user."));
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!resetFor) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await api.resetUserPassword(resetFor.id, resetPassword);
      setNotice(`Password reset for ${resetFor.username}.`);
      setResetFor(null);
      setResetPassword("");
    } catch (err) {
      setError(message(err, "Failed to reset the password."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card">
        <h2>Users &amp; Roles</h2>
        {error && <div className="error">{error}</div>}
        {notice && (
          <div className="badge" style={{ display: "inline-block" }}>
            {notice}
          </div>
        )}
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Full name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.full_name}</td>
                <td>{user.email ?? "—"}</td>
                <td>{user.role_name ?? "—"}</td>
                <td>
                  <span className="badge">{user.is_active ? "Active" : "Disabled"}</span>
                </td>
                <td>{when(user.last_login_at)}</td>
                <td>
                  <button onClick={() => startEdit(user)}>Edit</button>{" "}
                  <button
                    onClick={() => {
                      setResetFor(user);
                      setEditing(null);
                      setError(null);
                      setResetPassword("");
                    }}
                  >
                    Reset password
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && !error && (
              <tr>
                <td colSpan={7}>No users.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {resetFor && (
        <form className="card" onSubmit={submitReset}>
          <h2>
            Reset password — <code>{resetFor.username}</code>
          </h2>
          <div className="row">
            <div>
              <label>New password</label>
              <input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                autoFocus
              />
            </div>
            <button className="primary" type="submit" disabled={busy}>
              Reset password
            </button>
            <button type="button" onClick={cancel}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <form className="card" onSubmit={submit}>
        <h2>{editing ? `Edit user — ${editing.username}` : "Add user"}</h2>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <div>
            <label>Username</label>
            <input
              value={draft.username}
              onChange={(e) => set("username", e.target.value)}
              disabled={Boolean(editing)}
            />
          </div>
          <div>
            <label>Full name</label>
            <input value={draft.fullName} onChange={(e) => set("fullName", e.target.value)} />
          </div>
          <div>
            <label>Email</label>
            <input
              type="email"
              value={draft.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div>
            <label>Role</label>
            <select value={draft.roleName} onChange={(e) => set("roleName", e.target.value)}>
              <option value="">Select...</option>
              {roles.map((role) => (
                <option key={role.id} value={role.name}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>{editing ? "New password (optional)" : "Password"}</label>
            <input
              type="password"
              value={draft.password}
              onChange={(e) => set("password", e.target.value)}
            />
          </div>
          <div>
            <label>Status</label>
            <select
              value={draft.isActive ? "1" : "0"}
              onChange={(e) => set("isActive", e.target.value === "1")}
            >
              <option value="1">Active</option>
              <option value="0">Disabled</option>
            </select>
          </div>
          <button className="primary" type="submit" disabled={busy}>
            {editing ? "Save changes" : "Add user"}
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
