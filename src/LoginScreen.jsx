import { useState } from "react";
import { C, mono, sans } from "./theme.js";
import { useAuth } from "./AuthContext.jsx";

export default function LoginScreen({ onU3Illustration, onU4CatalogueIllustration, onU5Illustration }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.paper, fontFamily: sans }}>
      <form onSubmit={submit} style={{ width: 320, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 28, boxShadow: "0 4px 24px rgba(0,0,0,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <div aria-hidden="true" style={{ width: 32, height: 32, background: C.amber, borderRadius: 6, display: "flex",
            alignItems: "center", justifyContent: "center", color: C.white, fontSize: 11, fontWeight: 800,
            letterSpacing: "0.04em" }}>CA</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.slate }}>
            Canvas App
            <div style={{ fontSize: 9, color: C.slateL, fontWeight: 400 }}>Quotation module · Avadhoot Packs</div>
          </div>
        </div>

        <div style={{ fontSize: 9, color: C.slateL, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Email</div>
        <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", marginBottom: 12, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: sans }} />

        <div style={{ fontSize: 9, color: C.slateL, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Password</div>
        <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", marginBottom: 16, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: mono }} />

        {error && <div style={{ fontSize: 11, color: C.red, fontWeight: 600, marginBottom: 12 }}>{error}</div>}

        <button type="submit" disabled={busy}
          style={{ width: "100%", padding: "9px 0", borderRadius: 6, border: "none", background: C.amber, color: C.white,
            fontWeight: 700, fontSize: 13, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, fontFamily: sans }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        {/* Development-only fixture previews (App.jsx passes these handlers only
            in a DEV build). Demoted below a divider as plain text links so they
            never compete with Sign in (UX policy §3). */}
        {(onU3Illustration || onU5Illustration || onU4CatalogueIllustration) && (
          <div style={{ marginTop: 18, paddingTop: 10, borderTop: `1px dashed ${C.border}` }}>
            <div style={{ fontSize: 8.5, color: C.slateL, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.06em", marginBottom: 4 }}>Developer previews · fixture data only</div>
            {[[onU3Illustration, "U3–U4 Pricing Basis"],
              [onU5Illustration, "U5 Quote evidence"],
              [onU4CatalogueIllustration, "My Batches"]].filter(([handler]) => handler).map(([handler, label]) => (
              <button key={label} type="button" onClick={handler}
                style={{ display: "block", padding: "2px 0", border: 0, background: "transparent",
                  color: C.slateL, fontSize: 10, textDecoration: "underline", cursor: "pointer", fontFamily: sans }}>
                Preview {label}
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}
