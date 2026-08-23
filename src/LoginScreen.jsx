import { useState } from "react";
import { C, mono, sans } from "./theme.js";
import { useAuth } from "./AuthContext.jsx";

export default function LoginScreen() {
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
          <div style={{ width: 32, height: 32, background: C.amber, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📦</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.slate }}>
            CFB Quotation Master
            <div style={{ fontSize: 9, color: C.slateL, fontWeight: 400 }}>AVADHOOT PACKS</div>
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
      </form>
    </div>
  );
}
