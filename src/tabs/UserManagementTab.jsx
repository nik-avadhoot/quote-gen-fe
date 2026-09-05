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

const inputStyle = { padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 12, fontFamily: sans };

// Plant assignment is a selection from the Plant Master, never typed. The old
// free-text field let an administrator invent a plant that does not exist and
// silently grant nothing; the database now refuses that outright (the
// pgrant_active_plant_only trigger), so offering a text box would only produce
// errors the user cannot act on.
function PlantPicker({ plants, selected, disabled, onChange }) {
  const active = plants.filter(p => p.status === "active");
  const toggle = (code) => {
    const next = selected.includes(code)
      ? selected.filter(c => c !== code)
      : [...selected, code];
    onChange(next);
  };
  if (!active.length) return <span style={{ fontSize: 11, color: C.slateL }}>No active plants</span>;
  return (
    <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {active.map(p => (
        <label key={p.plant_code} title={p.name}
          style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: C.slateM, cursor: disabled ? "default" : "pointer" }}>
          <input type="checkbox" disabled={disabled} checked={selected.includes(p.plant_code)}
            onChange={() => toggle(p.plant_code)} />
          {p.plant_code}
        </label>
      ))}
    </span>
  );
}

// Read-only on purpose. The canonical brief seeds `plants` and approves no
// create/edit/deactivate operation for it, so Plant Master maintenance is
// deferred rather than invented here, and the panel says so instead of leaving
// an administrator hunting for a button that should not exist yet.
function PlantMasterPanel({ plants }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 12, background: C.white, border: `1px solid ${C.border}`, borderRadius: 7 }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ ...btnStyle("outline"), width: "100%", textAlign: "left", borderRadius: 7, border: "none", background: "transparent", padding: "9px 12px" }}>
        {open ? "▾" : "▸"} Plant Master — {plants.filter(p => p.status === "active").length} active
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ color: C.slateM }}>
                {["Code", "Name", "Status"].map(h => (
                  <th key={h} style={{ padding: "4px 8px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plants.map(p => (
                <tr key={p.plant_code} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "5px 8px", fontFamily: mono, fontSize: 12, fontWeight: 700, color: C.slate }}>{p.plant_code}</td>
                  <td style={{ padding: "5px 8px", fontSize: 12, color: C.slateM }}>{p.name}</td>
                  <td style={{ padding: "5px 8px", fontSize: 11, fontWeight: 700, color: p.status === "active" ? C.green : C.slateL }}>
                    {p.status === "active" ? "● Active" : "○ Inactive"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 8, fontSize: 11, color: C.slateL }}>
            Read-only. Adding, editing or retiring a plant is not part of this phase —
            removing a user&apos;s plant assignment does not deactivate the plant.
          </div>
        </div>
      )}
    </div>
  );
}

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
          I&apos;ve saved this — Close
        </button>
      </div>
    </div>
  );
}

// An administrator changing someone else's login email must say why. The reason
// is recorded in the audit trail; the addresses themselves are not.
function EmailChangeModal({ user, onDone, onClose, showToast }) {
  const [newEmail, setNewEmail] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const resp = await apiFetch(`/admin/users/${user.id}/email`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_email: newEmail.trim(), reason: reason.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Could not change the email");
      showToast(
        data.pending_verification
          ? "✅ Email updated — the new address still needs confirming. Sessions revoked."
          : `✅ Email updated. ${data.sessions_revoked || 0} session(s) revoked.`,
        "success", 8000);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,43,58,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
      <form onSubmit={submit} style={{ width: 380, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, boxShadow: "0 8px 32px rgba(0,0,0,.2)", fontFamily: sans }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.slate, marginBottom: 4 }}>Change login email</div>
        <div style={{ fontSize: 11, color: C.slateM, marginBottom: 14 }}>
          For <strong>{user.display_name}</strong>. Their identity, history, plants and
          capabilities are unchanged. Their existing sessions will be revoked.
        </div>
        <input required type="email" placeholder="New email address" value={newEmail}
          onChange={e => setNewEmail(e.target.value)} style={{ ...inputStyle, width: "100%", marginBottom: 8 }} />
        <input required placeholder="Reason (recorded in the audit trail)" value={reason}
          onChange={e => setReason(e.target.value)} style={{ ...inputStyle, width: "100%", marginBottom: 12 }} />
        {error && <div style={{ color: C.red, fontSize: 11, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={busy} style={{ ...btnStyle("primary"), flex: 1 }}>{busy ? "Changing…" : "Change email"}</button>
          <button type="button" onClick={onClose} style={btnStyle("outline")}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function NewUserForm({ plants, onCreated, showToast }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("maker");
  const [selectedPlants, setSelectedPlants] = useState([]);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const resp = await apiFetch("/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(), display_name: displayName.trim(), role,
          plants: selectedPlants,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Could not create user");
      setEmail(""); setDisplayName(""); setRole("maker"); setSelectedPlants([]);
      onCreated(data);
    } catch (err) {
      showToast("❌ " + err.message, "error", 8000);
    } finally {
      setBusy(false);
    }
  };

  // A Maker or Checker with no plant can sign in and do nothing. Said here as
  // well as enforced by the backend, so the rule is visible before submitting.
  const needsPlant = (role === "maker" || role === "checker") && selectedPlants.length === 0;

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: 12, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 7, marginBottom: 12 }}>
      <input required type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ ...inputStyle, width: 200 }} />
      <input required placeholder="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ ...inputStyle, width: 140 }} />
      <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <PlantPicker plants={plants} selected={selectedPlants} onChange={setSelectedPlants} />
      <button type="submit" disabled={busy || needsPlant} style={btnStyle("primary")}>{busy ? "Creating…" : "+ Add User"}</button>
      {needsPlant && <span style={{ fontSize: 11, color: C.red }}>A {role} needs at least one plant</span>}
    </form>
  );
}

function UserRow({ user, plants, isSelf, onChanged, onCredential, onChangeEmail, showToast }) {
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

  // Sends the WHOLE intended set. The backend reconciles it, so unrelated
  // assignments are preserved rather than replaced.
  const assigned = user.plants || (user.plant ? [user.plant] : []);

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
      <td style={{ padding: "6px 8px" }}>
        <PlantPicker plants={plants} selected={assigned} disabled={busy}
          onChange={next => patch({ plants: next })} />
      </td>
      <td style={{ padding: "6px 8px", fontSize: 10, color: C.slateL, fontFamily: mono }}>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "never"}</td>
      <td style={{ padding: "6px 8px" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: user.active ? C.green : C.red }}>{user.active ? "● Active" : "○ Inactive"}</span>
      </td>
      <td style={{ padding: "6px 8px", display: "flex", gap: 6 }}>
        <button disabled={busy} onClick={() => onChangeEmail(user)} style={btnStyle("outline")}>Change email</button>
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
  const [plants, setPlants] = useState([]);
  const [error, setError] = useState("");
  const [credential, setCredential] = useState(null); // {display_name, email, temp_password} | null
  const [emailTarget, setEmailTarget] = useState(null);

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
        const [uResp, pResp] = await Promise.all([
          apiFetch("/admin/users"),
          apiFetch("/masters/plants"),
        ]);
        const uData = await uResp.json();
        if (!uResp.ok) throw new Error(uData.error || "Could not load users");
        const pData = pResp.ok ? await pResp.json() : { plants: [] };
        if (!cancelled) { setUsers(uData.users); setPlants(pData.plants || []); }
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
      <PlantMasterPanel plants={plants} />
      <NewUserForm plants={plants} onCreated={handleCreated} showToast={showToast} />
      {error && <div style={{ color: C.red, fontSize: 12, marginBottom: 10 }}>{error}</div>}
      {users && (
        <table style={{ width: "100%", borderCollapse: "collapse", background: C.white, border: `1px solid ${C.border}`, borderRadius: 7 }}>
          <thead>
            <tr style={{ background: C.slateM, color: C.white }}>
              {["Name", "Email", "Role", "Plants", "Last sign-in", "Status", ""].map(h => (
                <th key={h} style={{ padding: "7px 8px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <UserRow key={u.id} user={u} plants={plants} isSelf={u.id === profile?.id}
                onChanged={load} onCredential={setCredential} onChangeEmail={setEmailTarget}
                showToast={showToast} />
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
      {emailTarget && (
        <EmailChangeModal
          user={emailTarget}
          showToast={showToast}
          onDone={() => { setEmailTarget(null); load(); }}
          onClose={() => setEmailTarget(null)}
        />
      )}
    </div>
  );
}
