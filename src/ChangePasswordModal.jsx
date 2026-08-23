import { useState } from "react";
import { C, mono, sans } from "./theme.js";
import { apiFetch } from "./lib/apiClient.js";

export default function ChangePasswordModal({ onClose, showToast }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match");
      return;
    }
    setBusy(true);
    try {
      const resp = await apiFetch("/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Could not change password");
      showToast("✅ Password changed", "success");
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = { width: "100%", boxSizing: "border-box", padding: "8px 10px", marginBottom: 12, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: mono };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,43,58,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
      <form onSubmit={submit} style={{ width: 320, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, boxShadow: "0 8px 32px rgba(0,0,0,.2)", fontFamily: sans }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.slate, marginBottom: 16 }}>Change Password</div>

        <div style={{ fontSize: 9, color: C.slateL, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Current password</div>
        <input type="password" required autoFocus value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={inputStyle} />

        <div style={{ fontSize: 9, color: C.slateL, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>New password</div>
        <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputStyle} />

        <div style={{ fontSize: 9, color: C.slateL, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Confirm new password</div>
        <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} />

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
