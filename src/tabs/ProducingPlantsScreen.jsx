// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/ProducingPlantsScreen.jsx — read-only Producing Plant screen.
//
// U1 (post-S7 handover §9.3). Uses the accepted, already-governed
// `/masters/plants` route unchanged (see the U0 report §4).
//
// This is now the ONLY Plant Master view. It was built alongside
// UserManagementTab.jsx's embedded PlantMasterPanel rather than replacing it,
// so a proven screen was not disturbed to deliver this one; UA-7 has since
// removed that panel, ending the duplication. Users/Access still fetches
// `/masters/plants` for PlantPicker, CapabilityMatrix and orphan adoption —
// plant ASSIGNMENT never depended on the panel, and still does not.
//
// Read-only by construction: no create/edit/retire control exists on this
// screen, matching the canonical brief's deferral of Plant Master
// maintenance. Timezone is deliberately not fetched or shown.
//
// ── "Relevant assignments" (canonical §6 U1) ───────────────────────────────
// The plan asks for "code, name, status and relevant assignments". Two
// sources, because the DATABASE draws the line between them:
//
//   Your own access  — from the already-resolved profile. NO request: a
//     caller may read their own plant grants anyway (`pgrant_select`), and
//     the profile already carries them. Shows "No access" when unassigned.
//
//   Assigned people  — administrator-only, from /admin/users, fetched ONLY
//     when the caller holds administer_users. `pgrant_select` refuses other
//     people's grants to everyone else, so a non-administrator does not make
//     this request at all rather than making it and hiding the answer. The
//     response is projected to display names alone before it reaches state -
//     no email, last sign-in, account status, id or unrelated capability.
//
// The names read is OPTIONAL: any failure leaves it null and the screen keeps
// rendering own-access. null ("not available") is deliberately distinct from
// an empty map ("nobody is assigned") - conflating them would state as fact
// something unknown. No aggregate count and no privileged function is offered,
// as either would mean reading around `pgrant_select`. This screen adds no
// backend, RLS, policy, capability or migration change.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { apiFetch } from "../lib/apiClient.js";
import { classifyResponse } from "../lib/backendError.js";
import { hasCapability, loadAssignedUserNames, ownPlantAccessLabels } from "../lib/capabilities.js";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import { LifecycleBadge, PermanentCode } from "../ui/dataDisplay.jsx";
import { C, sans } from "../theme.js";

export default function ProducingPlantsScreen() {
  const { isActive, profile } = useAuth();
  const [state, setState] = useState({ status: "loading", plants: [] });
  // null = no administrator view (either the caller is not an administrator, or
  // the optional read failed). Never an empty object in that case, so "not
  // available" and "nobody is assigned" stay distinguishable.
  const [assignedNames, setAssignedNames] = useState(null);

  const isAdministrator = hasCapability(profile, "administer_users");

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

  // The administrator-only read, in its OWN effect and behind the capability.
  // A non-administrator never reaches apiFetch at all — the request is not
  // made and then hidden, because `pgrant_select` would refuse it anyway and
  // asking would be a request the caller has no authority to make.
  //
  // Optional by construction: every failure path leaves `assignedNames` null
  // and touches nothing else, so a 403 or an outage costs the administrator
  // the names column and never the Plant Master itself.
  useEffect(() => {
    if (!isActive || !isAdministrator) return;
    let cancelled = false;
    (async () => {
      // Projected inside loadAssignedUserNames, before anything reaches state:
      // only display names survive. email, last_sign_in_at, active and
      // group_capabilities are dropped at the boundary, not at render time.
      const names = await loadAssignedUserNames({
        profile, isActive, fetchUsers: () => apiFetch("/admin/users"),
      });
      if (!cancelled) setAssignedNames(names);
    })();
    return () => { cancelled = true; };
  }, [isActive, isAdministrator, profile]);

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
      <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 760 }}>
        <thead>
          <tr style={{ color: C.slateM }}>
            {["Code", "Name", "Status", "Assignments"].map(h => (
              <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", borderBottom: `2px solid ${C.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state.plants.map(p => {
            const mine = ownPlantAccessLabels(profile, p.plant_code);
            const others = assignedNames ? (assignedNames[p.plant_code] || []) : null;
            return (
              <tr key={p.plant_code} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: "7px 10px" }}><PermanentCode code={p.plant_code} /></td>
                <td style={{ padding: "7px 10px", fontSize: 12, color: C.slateM }}>{p.name}</td>
                <td style={{ padding: "7px 10px" }}><LifecycleBadge status={p.status} /></td>
                <td style={{ padding: "7px 10px", fontSize: 11, color: C.slateM }}>
                  <div>
                    <span style={{ color: C.slateL }}>You: </span>
                    {mine.length
                      ? mine.join(", ")
                      : <span style={{ color: C.slateL }}>No access</span>}
                  </div>
                  {others && (
                    <div style={{ marginTop: 2, color: C.slateL }}>
                      {others.length
                        ? `Assigned: ${others.join(", ")}`
                        : "Assigned: nobody"}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
