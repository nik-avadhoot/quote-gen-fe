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
//
// ── SCREEN SPACE ──────────────────────────────────────────────────────────
// ONE toolbar with the count and the read-only statement; 26px rows with the
// plant code frozen. "Your access" and "Assigned" are separate one-line
// columns instead of two lines in one cell, and the Assigned column exists
// only for an administrator, exactly as the read does. Full lists stay on
// hover when a cell is truncated.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { apiFetch } from "../lib/apiClient.js";
import { classifyResponse } from "../lib/backendError.js";
import { hasCapability, loadAssignedUserNames, ownPlantAccessLabels } from "../lib/capabilities.js";
import { AccessDeniedState, EmptyState, LoadingState } from "../ui/appStates.jsx";
import { LifecycleBadge, PermanentCode, ProvenanceTag } from "../ui/dataDisplay.jsx";
import { ScreenFooter, ToolbarLabel } from "../ui/screenChrome.jsx";
import { denseCell, denseHead, denseTable, frozenCell, toolbar } from "../ui/screenStandards.js";
import { C, T, sans } from "../theme.js";

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

  const activeCount = state.plants.filter(p => p.status === "active").length;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0, fontFamily: sans,
      background: C.cream }}>
      <div role="toolbar" aria-label="Producing Plants controls" style={toolbar}>
        <ToolbarLabel title="Creating, editing or retiring a Producing Plant is not part of this phase.">Read-only</ToolbarLabel>
        <span style={{ fontSize: T.label, color: C.slateL }}>
          Creating, editing or retiring a Producing Plant is not part of this phase.</span>
        <span style={{ flex: "1 1 auto" }} />
        <span style={{ fontSize: T.label, color: C.slateL, whiteSpace: "nowrap" }}>
          {state.plants.length} plant{state.plants.length === 1 ? "" : "s"} · {activeCount} active</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: C.white }}>
        <table style={denseTable}>
          <thead>
            <tr>
              <th scope="col" style={{ ...denseHead, ...frozenCell(false, true) }}>Code</th>
              <th scope="col" style={denseHead}>Name</th>
              <th scope="col" style={denseHead}>Status</th>
              <th scope="col" style={denseHead}>Your access</th>
              {assignedNames && <th scope="col" style={denseHead}>Assigned</th>}
            </tr>
          </thead>
          <tbody>
            {state.plants.map(p => {
              const mine = ownPlantAccessLabels(profile, p.plant_code);
              const others = assignedNames ? (assignedNames[p.plant_code] || []) : null;
              const mineText = mine.length ? mine.join(", ") : "No access";
              const othersText = others && (others.length ? others.join(", ") : "nobody");
              return (
                <tr key={p.plant_code} style={{ height: 26 }}>
                  <td style={frozenCell(false)}><PermanentCode code={p.plant_code} /></td>
                  <td style={{ ...denseCell, color: C.slateM }}>{p.name}</td>
                  <td style={denseCell}><LifecycleBadge status={p.status} /></td>
                  <td style={{ ...denseCell, maxWidth: 360, color: mine.length ? C.slateM : C.slateL }} title={mineText}>
                    {mineText}</td>
                  {others && <td style={{ ...denseCell, maxWidth: 420, color: others.length ? C.slateM : C.slateL }}
                    title={othersText}>{othersText}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ScreenFooter right={isAdministrator
        ? (assignedNames ? "Assigned shows active people only" : "Assigned people not shown — not loaded or not available")
        : "Assigned people are visible to administrators only"}>
        <ProvenanceTag kind="governed" />
        <span>Producing Plants · your access comes from your own profile</span>
      </ScreenFooter>
    </div>
  );
}
