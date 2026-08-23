import QuotationApp from "./QuotationApp";
import LoginScreen from "./LoginScreen";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import { C, sans } from "./theme.js";

function Gate() {
  const { profile, loading, isActive, signOut } = useAuth();

  if (loading) {
    return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.slateL, fontFamily: sans, fontSize: 13 }}>Loading…</div>;
  }
  if (!profile) return <LoginScreen />;
  if (!isActive) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: sans, background: C.paper }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.red }}>Account deactivated</div>
        <div style={{ fontSize: 12, color: C.slateM }}>Contact your Admin to restore access.</div>
        <button onClick={signOut} style={{ marginTop: 8, padding: "7px 16px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, color: C.slateM, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Sign out</button>
      </div>
    );
  }
  return <QuotationApp />;
}

function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

export default App;
