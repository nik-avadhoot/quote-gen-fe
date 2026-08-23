import { useState, useRef, useEffect } from "react";
import { C, sans } from "./theme.js";
import { useAuth } from "./AuthContext.jsx";

export default function AccountMenu({ onEditProfile, onChangePassword }) {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const role = profile?.role || "maker";
  const icon = role === "admin" ? "⚙" : role === "checker" ? "✓" : "👤";

  const itemStyle = { display: "block", width: "100%", textAlign: "left", padding: "8px 14px", border: "none",
    background: "none", color: C.slate, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: sans };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} title={profile?.email || ""}
        style={{ padding: "4px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600, border: "1px solid rgba(255,255,255,.25)",
          background: "rgba(255,255,255,.10)", color: C.white, cursor: "pointer", fontFamily: sans,
          display: "flex", alignItems: "center", gap: 6 }}>
        {icon} {profile?.display_name} <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, minWidth: 180, background: C.white,
          border: `1px solid ${C.border}`, borderRadius: 7, boxShadow: "0 4px 18px rgba(0,0,0,.15)", zIndex: 10001, overflow: "hidden" }}>
          <div style={{ padding: "8px 14px", fontSize: 10, color: C.slateL, borderBottom: `1px solid ${C.border}`, wordBreak: "break-all" }}>{profile?.email}</div>
          <button style={itemStyle} onClick={() => { setOpen(false); onEditProfile(); }}>👤 Edit Profile</button>
          <button style={itemStyle} onClick={() => { setOpen(false); onChangePassword(); }}>🔑 Change Password</button>
          <div style={{ borderTop: `1px solid ${C.border}` }} />
          <button style={{ ...itemStyle, color: C.red }} onClick={() => { setOpen(false); signOut(); }}>⏻ Sign out</button>
        </div>
      )}
    </div>
  );
}
