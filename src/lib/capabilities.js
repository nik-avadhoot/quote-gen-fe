// ═══════════════════════════════════════════════════════════════════════════
// src/lib/capabilities.js — capability-aware navigation/action gating.
//
// U1 shared foundation (post-S7 handover S9.2), corrected after the U0/U1
// review. RLS is the enforcement boundary (data-model-frontend-design-plan.md
// S2.1) — everything here is a USABILITY aid that hides a control or nav
// entry a caller could not exercise anyway, never the reason an action is
// safe.
//
// CORRECTION: the first pass invented field names (`profile.capabilities`,
// `profile.capabilitiesByPlant`) and a role-implies-capability fallback that
// could grant a capability never actually held. Both were wrong.
// `caller_context.resolve_caller()` (quote-gen-be) already returns the real
// shape on every /auth/login, /auth/refresh and /auth/me response, and
// always has:
//   profile.group_capabilities   — flat array of capability keys, group-wide
//   profile.plant_capabilities   — { [plant_code]: [capability keys] }
// This was missed during U0 discovery (only server.py's admin routes were
// read, not caller_context.py) and is corrected here rather than left as an
// aspirational shape the backend was asked to grow into.
//
// DENY BY DEFAULT. There is no role-based inference any more: an absent or
// malformed profile, or a capability neither list mentions, is a denial, not
// a guess. A legacy screen may keep reading `profile.role` directly for now
// (UserManagementTab.jsx's own admin gate is untouched by this file), but no
// NEW capability check may be satisfied by a role string.
// ═══════════════════════════════════════════════════════════════════════════

export function hasCapability(profile, key) {
  if (!profile || !key) return false;
  const groupCaps = Array.isArray(profile.group_capabilities) ? profile.group_capabilities : [];
  if (groupCaps.includes(key)) return true;
  const byPlant = profile.plant_capabilities;
  if (byPlant && typeof byPlant === "object") {
    for (const caps of Object.values(byPlant)) {
      if (Array.isArray(caps) && caps.includes(key)) return true;
    }
  }
  return false;
}

// Plant-scoped form: true only if the caller holds `key` AT that specific
// plant code. Deliberately does NOT fall back to the flat check — a group
// capability (e.g. administer_users) is not a plant capability, and a caller
// with make_quote at NAG must not read as holding it at PUN.
export function hasCapabilityAtPlant(profile, key, plantCode) {
  if (!profile || !key || !plantCode) return false;
  const byPlant = profile.plant_capabilities;
  const atPlant = byPlant && typeof byPlant === "object" ? byPlant[plantCode] : null;
  return Array.isArray(atPlant) && atPlant.includes(key);
}

export function useCapability(profile, key) {
  return hasCapability(profile, key);
}

// ── Producing Plant "relevant assignments" ─────────────────────────────────
//
// data-model-frontend-design-plan.md §6 U1 asks the Producing Plants screen to
// show "code, name, status and relevant assignments". It means user-to-plant
// ACCESS assignments, and the two helpers below are the whole testable surface
// of that.
//
// The authority line is drawn by the DATABASE, not by this screen, and the
// helpers exist to keep the frontend on the right side of it:
//   • `plants_select` is `using ( true )` — ANY authenticated user may read the
//     Plant Master. So the plant rows themselves are public to the app.
//   • `pgrant_select` is `using ( app_user_id = current_app_user()
//     OR has_group_cap('administer_users') )` — a caller may read plant grants
//     for THEMSELVES only, unless they administer users.
// So "your own access" needs no request at all (it is already in the resolved
// profile), and anything naming OTHER people is administrator-only by the
// database's own rule. No aggregate count and no privileged function is
// offered here, because either would mean reading around `pgrant_select`.

import { PLANT_CAPABILITIES } from "./userAccessActions.js";

// The caller's OWN capabilities at one plant, as display labels, in the
// canonical PLANT_CAPABILITIES order (never the order the server happened to
// return). An empty array means "No access" — the screen says so in words.
// Reads only the already-resolved profile: this issues no request, so a user
// with no authority over other people still sees something true about
// themselves.
export function ownPlantAccessLabels(profile, plantCode) {
  if (!profile || !plantCode) return [];
  const byPlant = profile.plant_capabilities;
  const held = byPlant && typeof byPlant === "object" ? byPlant[plantCode] : null;
  if (!Array.isArray(held)) return [];
  return PLANT_CAPABILITIES.filter(c => held.includes(c.key)).map(c => c.label);
}

// Projects an /admin/users response to the MINIMAL display shape —
// { [plant_code]: [display_name, …] } — and nothing else. Called the moment
// the response arrives, so `email`, `last_sign_in_at`, `active`,
// `group_capabilities` and every other field are dropped before they can reach
// component state, let alone the screen.
//
// Deactivated accounts are excluded. That is not a status display: listing
// somebody who cannot sign in as a current assignee of a plant would simply be
// untrue.
export function assignedUserNamesByPlant(users) {
  const byPlant = {};
  for (const u of users || []) {
    if (!u || u.active !== true) continue;
    const name = u.display_name;
    const plants = u.plant_capabilities;
    if (!name || !plants || typeof plants !== "object") continue;
    for (const [code, caps] of Object.entries(plants)) {
      if (!Array.isArray(caps) || !caps.length) continue;
      (byPlant[code] ||= []).push(name);
    }
  }
  for (const list of Object.values(byPlant)) {
    list.sort((a, b) => a.localeCompare(b));
  }
  return byPlant;
}

// The optional administrator read, as one testable function rather than logic
// buried in an effect. `fetchUsers` is injected so a fixture can prove the
// things that matter most here WITHOUT a DOM harness:
//
//   • a non-administrator never calls it at all — the spy records zero calls,
//     which is stronger than asserting the response was ignored. The request
//     is not made and then hidden;
//   • every failure — 403, any non-ok status, a thrown network error, or
//     malformed JSON — returns null, never a partial or empty map.
//
// null means "no administrator view". The caller renders its own-access
// information regardless, so losing this read costs the names line and never
// the Plant Master.
export async function loadAssignedUserNames({ profile, isActive, fetchUsers }) {
  if (isActive === false) return null;
  if (!hasCapability(profile, "administer_users")) return null;
  try {
    const resp = await fetchUsers();
    if (!resp || !resp.ok) return null;
    // NOT `.catch(() => ({}))`. Swallowing a parse failure into an empty
    // object would render "Assigned: nobody" on every plant - stating as fact
    // something we do not know. Unknown must stay null.
    const data = await resp.json();
    if (!data || !Array.isArray(data.users)) return null;
    return assignedUserNamesByPlant(data.users);
  } catch {
    return null;
  }
}
