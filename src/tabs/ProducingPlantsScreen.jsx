// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/ProducingPlantsScreen.jsx — read-only Producing Plant screen.
//
// U1 (post-S7 handover §9.3). Uses the accepted, already-governed
// `/masters/plants` route unchanged (the same one UserManagementTab.jsx's
// embedded PlantMasterPanel already calls — see the U0 report §4). Deliberately
// its own screen rather than a further edit to UserManagementTab.jsx: that
// file's panel is left exactly as it is for this pass, so a proven, tested
// screen is not disturbed to deliver this one. Extracting PlantMasterPanel
// into a shared component (so the two stop duplicating the same fetch) is
// flagged as a follow-up cleanup, not done here.
//
// Read-only by construction: no create/edit/retire control exists on this
// screen, matching the canonical brief's deferral of Plant Master
// maintenance. Timezone is deliberately not fetched or shown.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { apiFetch } from "../lib/apiClient.js";
import { classifyResponse } from "../lib/backendError.js";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import { LifecycleBadge, PermanentCode } from "../ui/dataDisplay.jsx";
import { C, sans } from "../theme.js";

export default function ProducingPlantsScreen() {
  const { isActive } = useAuth();
  const [state, setState] = useState({ status: "loading", plants: [] });

  useEffect(() => {
    if (!isActive) return; // an inactive session never issues the request
    let cancelled = false;
    (async () => {
      let resp, data;
      try {
        resp = await apiFetch("/masters/plants");
        data = await resp.json().catch(() => ({}));
      } catch {
        if (!cancelled) setState({ status: "error", plants: [] });
        return;
      }
      if (cancelled) return;
      const outcome = classifyResponse({ ok: resp.ok, status: resp.status, data });
      if (outcome.kind === "ok") setState({ status: "ok", plants: data.plants || [] });
      else if (outcome.kind === "access-denied") setState({ status: "denied", plants: [] });
      else setState({ status: "error", plants: [] });
    })();
    return () => { cancelled = true; };
  }, [isActive]);

  if (!isActive) return <AccessDeniedState reason="Your account is deactivated." />;
  if (state.status === "loading") return <LoadingState label="Loading Producing Plants…" />;
  if (state.status === "denied") return <AccessDeniedState reason="You do not have access to the Plant Master." />;
  if (state.status === "error") return <AccessDeniedState reason="The Plant Master could not be loaded." />;
  if (!state.plants.length) return <EmptyState title="No Producing Plants" hint="None are recorded yet." />;

  return (
    <div style={{ padding: 20, fontFamily: sans }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.slate, marginBottom: 2 }}>Producing Plants</div>
      <div style={{ fontSize: 11, color: C.slateL, marginBottom: 14 }}>
        Read-only. Creating, editing or retiring a Producing Plant is not part of this phase.
      </div>
      <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 520 }}>
        <thead>
          <tr style={{ color: C.slateM }}>
            {["Code", "Name", "Status"].map(h => (
              <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", borderBottom: `2px solid ${C.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state.plants.map(p => (
            <tr key={p.plant_code} style={{ borderTop: `1px solid ${C.border}` }}>
              <td style={{ padding: "7px 10px" }}><PermanentCode code={p.plant_code} /></td>
              <td style={{ padding: "7px 10px", fontSize: 12, color: C.slateM }}>{p.name}</td>
              <td style={{ padding: "7px 10px" }}><LifecycleBadge status={p.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
