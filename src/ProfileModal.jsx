import { useState } from "react";
import { C, mono, sans } from "./theme.js";
import { apiFetch, refreshSession } from "./lib/apiClient.js";
import { useAuth } from "./AuthContext.jsx";

const inputStyle = { width: "100%", boxSizing: "border-box", padding: "8px 10px", marginBottom: 12, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: sans };
const labelStyle = { fontSize: 9, color: C.slateL, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 };

// Self-service change of the Supabase Auth login identity.
//
// The current password is re-verified by the backend immediately before the
// change: holding a valid session proves you authenticated at some point, which
// is not the same as being the account holder right now. The change then runs
// through Supabase's own verification flow, so success here means "confirmation
// sent", not "email changed" - and the panel says exactly that.
function EmailChangeSection({ currentEmail, showToast }) {
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");

  const submit = async () => {
    setError(""); setBusy(true);
    try {
      const resp = await apiFetch("/auth/me/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_email: newEmail.trim(), current_password: password }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Could not change your email");
      setPassword(""); setNewEmail("");
      setPending(data.message || "Check your inbox to confirm the change.");
      if (!data.pending_verification) {
        await refreshSession();
        showToast("✅ Login email updated", "success");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (pending) {
    return (
      <div style={{ padding: "10px 12px", background: C.cream, border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.slate, marginBottom: 3 }}>Verification pending</div>
        <div style={{ fontSize: 11, color: C.slateM }}>{pending}</div>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        style={{ background: "none", border: "none", padding: 0, marginBottom: 12, color: C.slateM, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: sans, textDecoration: "underline" }}>
        Change login email
      </button>
    );
  }

  return (
    <div style={{ padding: "10px 12px", background: C.cream, border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 12 }}>
      <div style={labelStyle}>New login email</div>
      <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
        style={{ ...inputStyle, marginBottom: 8 }} />
      <div style={labelStyle}>Current password</div>
      <input type="password" value={password} onChange={e => setPassword(e.target.value)}
        autoComplete="current-password" style={{ ...inputStyle, marginBottom: 8 }} />
      {error && <div style={{ fontSize: 11, color: C.red, fontWeight: 600, marginBottom: 8 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={busy || !newEmail.trim() || !password} onClick={submit}
          style={{ flex: 1, padding: "7px 0", borderRadius: 6, border: "none", background: C.amber, color: C.white, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: sans, opacity: busy ? 0.6 : 1 }}>
          {busy ? "Sending…" : "Send confirmation"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(""); }}
          style={{ padding: "7px 12px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, color: C.slateM, fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: sans }}>
          Cancel
        </button>
      </div>
      <div style={{ fontSize: 10, color: C.slateL, marginTop: 8 }}>
        Your account, history and plant access stay exactly as they are. Currently {currentEmail}.
      </div>
    </div>
  );
}

export default function ProfileModal({ onClose, showToast }) {
  const { profile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!displayName.trim()) {
      setError("Display name cannot be empty");
      return;
    }
    setBusy(true);
    try {
      const resp = await apiFetch("/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Could not update profile");
      await refreshSession(); // pulls the updated profile into AuthContext
      showToast("✅ Profile updated", "success");
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Plant access is a capability grant an administrator makes (CDM-05/CDM-05-A),
  // not a field you type about yourself. The backend has always refused a
  // self-edit here; showing it as an editable box only invited the attempt.
  const plants = profile?.plants?.length ? profile.plants : (profile?.plant ? [profile.plant] : []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,43,58,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
      <form onSubmit={submit} style={{ width: 340, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, boxShadow: "0 8px 32px rgba(0,0,0,.2)", fontFamily: sans }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.slate, marginBottom: 4 }}>Edit Profile</div>
        <div style={{ fontSize: 10, color: C.slateL, fontFamily: mono, marginBottom: 16, wordBreak: "break-all" }}>{profile?.email}</div>

        <div style={labelStyle}>Display name</div>
        <input required autoFocus value={displayName} onChange={e => setDisplayName(e.target.value)} style={inputStyle} />

        <div style={labelStyle}>Login email</div>
        <EmailChangeSection currentEmail={profile?.email} showToast={showToast} />

        <div style={labelStyle}>Plant access</div>
        <div style={{ ...inputStyle, background: C.cream, color: C.slateM, fontFamily: mono, fontSize: 12 }}>
          {plants.length ? plants.join(", ") : "None assigned"}
        </div>
        <div style={{ fontSize: 10, color: C.slateL, marginTop: -6, marginBottom: 12 }}>
          Assigned by an administrator from the Plant Master.
        </div>

        {error && <div style={{ fontSize: 11, color: C.red, fontWeight: 600, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: "9px 0", borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, color: C.slateM, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: sans }}>
            Cancel
          </button>
          <button type="submit" disabled={busy}
            style={{ flex: 1, padding: "9px 0", borderRadius: 6, border: "none", background: C.amber, color: C.white,
              fontWeight: 700, fontSize: 13, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, fontFamily: sans }}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
