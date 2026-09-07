// ═══════════════════════════════════════════════════════════════════════════
// src/lib/capabilities.js — capability-aware navigation/action gating.
//
// U1 shared foundation (post-S7 handover §9.2). RLS is the enforcement
// boundary (data-model-frontend-design-plan.md §2.1) — everything here is a
// USABILITY aid that hides a control or nav entry a caller could not
// exercise anyway, never the reason an action is safe.
//
// The backend today (`derive_role()` in server.py) collapses the full
// plant-scoped capability-grant model down to one of "admin" | "checker" |
// "maker" on `profile.role` — see the U0 report §5.1. This module is
// written against the RICHER shape the backend does not return yet
// (`profile.capabilities`, a flat array of capability keys the caller holds
// anywhere) and degrades to the role string when that shape is absent, so
// call sites do not have to know which shape they got.
// ═══════════════════════════════════════════════════════════════════════════

// role -> the capability keys that role is known to imply, for the
// degraded path only. This is intentionally the SAME collapsing the backend
// already does (admin > checker > maker) — it adds no new authority
// distinction the backend does not already grant; it only lets the
// degraded path answer hasCapability() without a new field to read.
const ROLE_IMPLIES = {
  admin: ["administer_users", "check_quote", "make_quote", "read_party_master"],
  checker: ["check_quote", "make_quote", "read_party_master"],
  maker: ["make_quote"],
};

export function hasCapability(profile, key) {
  if (!profile) return false;
  if (Array.isArray(profile.capabilities)) {
    return profile.capabilities.includes(key);
  }
  const implied = ROLE_IMPLIES[profile.role] || [];
  return implied.includes(key);
}

// Plant-scoped form. Degrades to the flat check above when the backend has
// not returned per-plant detail (see the U0 report §5.1) — that is a real
// loss of precision (a Checker at NAG reads as a Checker everywhere), named
// explicitly here rather than silently assumed correct.
export function hasCapabilityAtPlant(profile, key, plantCode) {
  if (!profile) return false;
  if (profile.capabilitiesByPlant && plantCode) {
    const atPlant = profile.capabilitiesByPlant[plantCode] || [];
    return atPlant.includes(key);
  }
  return hasCapability(profile, key);
}

export function useCapability(profile, key) {
  return hasCapability(profile, key);
}
