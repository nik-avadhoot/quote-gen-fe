// Development-only P0.3 preview (`?fixture=p03-pricing`): the real Customer
// Pricing History workspace over an in-memory canonical payload. It proves the
// presentation layer only — not persistence, authorization or concurrency. No
// request is sent by the grid; the layout itself is stored like any user's,
// under the fixture user's own key.
import { useState } from "react";
import { C, T, sans } from "../../theme.js";
import { P03_FIXTURE_CHANGES, P03_FIXTURE_DATA, P03_FIXTURE_PARTY } from "../../lib/customerPricingFixture.js";
import CustomerPricingHistory from "./CustomerPricingHistory.jsx";

const FIXTURE = { data: P03_FIXTURE_DATA, changes: P03_FIXTURE_CHANGES };

export default function CustomerPricingFixturePreview() {
  const [toast, setToast] = useState(null);
  return (
    <div style={{ fontFamily: sans, background: C.paper, minHeight: "100vh", padding: 12, boxSizing: "border-box" }}>
      <div role="note" style={{ border: `1px solid ${C.amber}`, background: C.amberL, borderRadius: 6, padding: "4px 10px",
        marginBottom: 8, fontSize: T.label, color: C.amberD }}>
        <strong>P0.3 · FIXTURE ONLY</strong> — in-memory representative payload; nothing is read from or written to the
        backend. This shows presentation only; it does not prove database persistence, authorization or concurrency.
      </div>
      <div style={{ fontSize: T.body, fontWeight: 700, marginBottom: 6 }}>{P03_FIXTURE_PARTY.display_name}</div>
      <CustomerPricingHistory party={P03_FIXTURE_PARTY} fixture={FIXTURE}
        showToast={(message) => setToast(message)} />
      {toast && (
        <div role="status" style={{ position: "fixed", right: 12, bottom: 12, background: C.slate, color: C.white,
          padding: "5px 10px", borderRadius: 6, fontSize: T.label }} onClick={() => setToast(null)}>{toast}</div>
      )}
    </div>
  );
}
