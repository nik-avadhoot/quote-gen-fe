import QuotationApp from "./QuotationApp";
import LoginScreen from "./LoginScreen";
import PricingBasisScreen from "./tabs/PricingBasisScreen.jsx";
import QuotesWorkspace from "./tabs/QuotesWorkspace.jsx";
import QuoteCatalogueScreen from "./tabs/QuoteCatalogueScreen.jsx";
import MyBatchesScreen from "./tabs/MyBatchesScreen.jsx";
import SkuMasterScreen from "./tabs/SkuMasterScreen.jsx";
import ConstructionLibraryScreen from "./tabs/ConstructionLibraryScreen.jsx";
import CustomerPricingFixturePreview from "./tabs/customer-pricing/CustomerPricingFixturePreview.jsx";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import { C, sans } from "./theme.js";
import { useState } from "react";
import { AppStateProvider } from "./state/AppStateProvider.jsx";

function Gate() {
  const { profile, loading, isActive, signOut } = useAuth();
  const [fixtureIllustration, setFixtureIllustration] = useState(() => {
    if (!import.meta.env.DEV) return null;
    const requested = new URLSearchParams(window.location.search).get("fixture");
    return ["u5", "u5-inbox", "u5-history", "u3-u4", "u4-batches", "u2-skus", "u2-constructions", "p03-pricing"].includes(requested) ? requested : null;
  });

  if (loading) {
    return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.slateL, fontFamily: sans, fontSize: 13 }}>Loading…</div>;
  }
  // Local development can show the U3 composition and first U4 Batch linkage
  // without an account, but it
  // is an explicitly labelled, fixture-only presentation.  Production builds
  // have no entry to this path, and the screen issues no API call in this mode.
  if (!profile && import.meta.env.DEV && fixtureIllustration === "u3-u4") {
    return <AppStateProvider>
      <PricingBasisScreen fixtureOnly onExitFixture={() => setFixtureIllustration(null)} />
    </AppStateProvider>;
  }
  if (!profile && import.meta.env.DEV && fixtureIllustration === "u5") {
    return <AppStateProvider>
      <QuotesWorkspace fixtureOnly onExitFixture={() => setFixtureIllustration(null)} />
    </AppStateProvider>;
  }
  if (!profile && import.meta.env.DEV && fixtureIllustration === "u4-batches") {
    return <AppStateProvider>
      <MyBatchesScreen fixtureOnly onExitFixture={() => setFixtureIllustration(null)} />
    </AppStateProvider>;
  }
  if (!profile && import.meta.env.DEV && fixtureIllustration === "u5-inbox") {
    return <AppStateProvider>
      <QuoteCatalogueScreen mode="inbox" fixtureOnly onExitFixture={() => setFixtureIllustration(null)} />
    </AppStateProvider>;
  }
  if (!profile && import.meta.env.DEV && fixtureIllustration === "u5-history") {
    return <AppStateProvider>
      <QuotesWorkspace fixtureOnly initialView="history" onExitFixture={() => setFixtureIllustration(null)} />
    </AppStateProvider>;
  }
  if (!profile && import.meta.env.DEV && fixtureIllustration === "u2-skus") {
    return <AppStateProvider>
      <SkuMasterScreen fixtureOnly onExitFixture={() => setFixtureIllustration(null)} />
    </AppStateProvider>;
  }
  if (!profile && import.meta.env.DEV && fixtureIllustration === "u2-constructions") {
    return <AppStateProvider>
      <ConstructionLibraryScreen fixtureOnly initialView="adoption" onExitFixture={() => setFixtureIllustration(null)} />
    </AppStateProvider>;
  }
  // Customer Pricing History P0.3 presentation over an in-memory payload; the
  // pricing migrations are unapplied, so this is fixture-browser evidence only.
  if (!profile && import.meta.env.DEV && fixtureIllustration === "p03-pricing") {
    return <CustomerPricingFixturePreview />;
  }
  if (!profile) return <LoginScreen
    onU2ConstructionIllustration={import.meta.env.DEV ? () => setFixtureIllustration("u2-constructions") : undefined}
    onU2SkuIllustration={import.meta.env.DEV ? () => setFixtureIllustration("u2-skus") : undefined}
    onU3Illustration={import.meta.env.DEV ? () => setFixtureIllustration("u3-u4") : undefined}
    onU4CatalogueIllustration={import.meta.env.DEV ? () => setFixtureIllustration("u4-batches") : undefined}
    onU5Illustration={import.meta.env.DEV ? () => setFixtureIllustration("u5") : undefined} />;
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
