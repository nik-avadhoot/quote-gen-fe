import { useState } from "react";
import { C, mono, sans } from "./theme.js";
import { apiFetch, refreshSession } from "./lib/apiClient.js";
import { useAuth } from "./AuthContext.jsx";

export default function ProfileModal({ onClose, showToast }) {
  const { profile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [plant, setPlant] = useState(profile?.plant || "");
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
        body: JSON.stringify({ display_name: displayName.trim(), plant: plant.trim() }),
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

  const inputStyle = { width: "100%", boxSizing: "border-box", padding: "8px 10px", marginBottom: 12, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: sans };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,43,58,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
      <form onSubmit={submit} style={{ width: 320, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, boxShadow: "0 8px 32px rgba(0,0,0,.2)", fontFamily: sans }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.slate, marginBottom: 4 }}>Edit Profile</div>
        <div style={{ fontSize: 10, color: C.slateL, fontFamily: mono, marginBottom: 16, wordBreak: "break-all" }}>{profile?.email}</div>

        <div style={{ fontSize: 9, color: C.slateL, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Display name</div>
        <input required autoFocus value={displayName} onChange={e => setDisplayName(e.target.value)} style={inputStyle} />

        <div style={{ fontSize: 9, color: C.slateL, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Plant</div>
        <input value={plant} onChange={e => setPlant(e.target.value)} placeholder="e.g. Nagpur" style={inputStyle} />

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
