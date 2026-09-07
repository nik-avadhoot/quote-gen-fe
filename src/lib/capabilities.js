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
