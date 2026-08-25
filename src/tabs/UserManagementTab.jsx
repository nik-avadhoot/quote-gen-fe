import { useState, useEffect } from "react";
import { C, mono, sans } from "../theme.js";
import { apiFetch } from "../lib/apiClient.js";
import { useAuth } from "../AuthContext.jsx";

const ROLES = ["maker", "checker", "admin"];

const btnStyle = (variant) => ({
  padding: "5px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: sans,
  border: variant === "outline" ? `1px solid ${C.border}` : "none",
  background: variant === "danger" ? C.red : variant === "outline" ? C.white : C.amber,
  color: variant === "outline" ? C.slateM : C.white,
});

// Shown after creating a user or resetting a password — stays on screen until
// explicitly closed (no toast, no timeout) since this is the only time the
// password is ever visible. Losing it here means the account is locked out.
function CredentialModal({ displayName, email, password, onClose }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      // clipboard API unavailable — the password is still selectable text below
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,43,58,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
      <div style={{ width: 360, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, boxShadow: "0 8px 32px rgba(0,0,0,.2)", fontFamily: sans }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.slate, marginBottom: 4 }}>Temporary password set</div>
        <div style={{ fontSize: 11, color: C.slateM, marginBottom: 14 }}>
          For <strong>{displayName}</strong> ({email}). Share this with them now — it will not be shown again.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: C.cream, border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 14 }}>
          <span style={{ flex: 1, fontFamily: mono, fontSize: 14, fontWeight: 700, color: C.slate, userSelect: "all", wordBreak: "break-all" }}>{password}</span>
          <button type="button" onClick={copy} style={btnStyle("outline")}>{copied ? "Copied ✓" : "Copy"}</button>
        </div>
        <button type="button" onClick={onClose} style={{ width: "100%", padding: "9px 0", borderRadius: 6, border: "none", background: C.amber, color: C.white, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: sans }}>
          I've saved this — Close
        </button>
      </div>
    </div>
  );
}

function NewUserForm({ onCreated, showToast }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("maker");
  const [plant, setPlant] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const resp = await apiFetch("/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), display_name: displayName.trim(), role, plant: plant.trim() || null }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Could not create user");
      setEmail(""); setDisplayName(""); setRole("maker"); setPlant("");
      onCreated(data);
    } catch (err) {
      showToast("❌ " + err.message, "error", 8000);
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = { padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: sans };

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: 12, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 7, marginBottom: 12 }}>
      <input required type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ ...inputStyle, width: 200 }} />
      <input required placeholder="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ ...inputStyle, width: 140 }} />
      <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <input placeholder="Plant (optional)" value={plant} onChange={e => setPlant(e.target.value)} style={{ ...inputStyle, width: 110 }} />
      <button type="submit" disabled={busy} style={btnStyle("primary")}>{busy ? "Creating…" : "+ Add User"}</button>
    </form>
  );
}

function UserRow({ user, isSelf, onChanged, onCredential, showToast }) {
  const [busy, setBusy] = useState(false);

  const patch = async (body) => {
    setBusy(true);
    try {
      const resp = await apiFetch(`/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Update failed");
      onChanged();
    } catch (err) {
      showToast("❌ " + err.message, "error", 8000);
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    setBusy(true);
    try {
      const resp = await apiFetch(`/admin/users/${user.id}/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Reset failed");
      onCredential({ display_name: user.display_name, email: user.email, temp_password: data.temp_password });
    } catch (err) {
      showToast("❌ " + err.message, "error", 8000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr style={{ borderBottom: `1px solid ${C.border}`, opacity: busy ? 0.5 : 1 }}>
      <td style={{ padding: "6px 8px", fontSize: 12, fontWeight: 600, color: C.slate }}>{user.display_name}{isSelf && <span style={{ color: C.slateL, fontWeight: 400 }}> (you)</span>}</td>
      <td style={{ padding: "6px 8px", fontSize: 11, color: C.slateM, fontFamily: mono }}>{user.email}</td>
      <td style={{ padding: "6px 8px" }}>
        <select value={user.role} disabled={busy || isSelf} onChange={e => patch({ role: e.target.value })}
          style={{ fontSize: 11, padding: "3px 6px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: sans }}>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </td>
      <td style={{ padding: "6px 8px", fontSize: 11, color: C.slateM }}>{user.plant || "—"}</td>
      <td style={{ padding: "6px 8px", fontSize: 10, color: C.slateL, fontFamily: mono }}>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "never"}</td>
      <td style={{ padding: "6px 8px" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: user.active ? C.green : C.red }}>{user.active ? "● Active" : "○ Inactive"}</span>
      </td>
      <td style={{ padding: "6px 8px", display: "flex", gap: 6 }}>
        <button disabled={busy} onClick={resetPassword} style={btnStyle("outline")}>Reset password</button>
        <button disabled={busy || isSelf} onClick={() => patch({ active: !user.active })} style={btnStyle(user.active ? "danger" : "outline")}>
          {user.active ? "Deactivate" : "Activate"}
        </button>
      </td>
    </tr>
  );
}

export default function UserManagementTab({ showToast }) {
  const { profile } = useAuth();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [credential, setCredential] = useState(null); // {display_name, email, temp_password} | null

  const load = async () => {
    try {
      const resp = await apiFetch("/admin/users");
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Could not load users");
      setUsers(data.users);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await apiFetch("/admin/users");
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Could not load users");
        if (!cancelled) setUsers(data.users);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCreated = (data) => {
    load();
    if (data.temp_password) setCredential(data);
  };

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.slate, marginBottom: 10 }}>User Management</div>
      <NewUserForm onCreated={handleCreated} showToast={showToast} />
      {error && <div style={{ color: C.red, fontSize: 12, marginBottom: 10 }}>{error}</div>}
      {users && (
        <table style={{ width: "100%", borderCollapse: "collapse", background: C.white, border: `1px solid ${C.border}`, borderRadius: 7 }}>
          <thead>
            <tr style={{ background: C.slateM, color: C.white }}>
              {["Name", "Email", "Role", "Plant", "Last sign-in", "Status", ""].map(h => (
                <th key={h} style={{ padding: "7px 8px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <UserRow key={u.id} user={u} isSelf={u.id === profile?.id} onChanged={load} onCredential={setCredential} showToast={showToast} />
            ))}
          </tbody>
        </table>
      )}
      {credential && (
        <CredentialModal
          displayName={credential.display_name}
          email={credential.email}
          password={credential.temp_password}
          onClose={() => setCredential(null)}
        />
      )}
    </div>
  );
}
