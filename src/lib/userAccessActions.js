// ═══════════════════════════════════════════════════════════════════════════
// src/lib/userAccessActions.js — U1 Users/Access (UA-1 + UA-4) pure helpers.
//
// Same split as customerFamilyActions.js / customerLocationActions.js: request
// bodies, canonicalisation, scope validation and confirm copy, with no network
// call — the testable surface in a repo with no DOM/UI harness (CLAUDE.md).
//
// THE AUTHORITY IS THE CAPABILITY SET, NOT A ROLE.
//
// `role` is a DERIVED PRESENTATION LABEL and nothing else. It is rendered
// read-only and is never sent anywhere: an editable role could express only
// `administer_users` plus one operational capability per plant, so using it to
// build a complete desired set would silently revoke the nine capabilities it
// cannot represent. That is why the backend's role/plant PATCH branch is gone.
//
// The write is always a COMPLETE REPLACEMENT of the effective capability set,
// carrying `expected_content_version`. There is deliberately no partial-update
// mode: a null collection is ambiguous between "clear this dimension" and
// "leave it alone", and the editor always holds the full current set because it
// just displayed it.
// ═══════════════════════════════════════════════════════════════════════════

// The catalogue, pinned to public.capabilities by scripts/user-access-fixtures
// .mjs. Read from the database (capability_key, scope_kind), not invented — the
// Slice D `location_type` defect was a hand-transcribed list that the database
// refused, and a capability key is exactly the same kind of value.
export const GROUP_CAPABILITIES = Object.freeze([
  { key: "administer_users", label: "Administer users", note: "Invitation, grants, settings" },
  { key: "read_party_master", label: "Read Customer Master", note: "Families, Parties, Locations" },
  { key: "manage_customer_master", label: "Manage Customer Master", note: "Write Family/Party/Location" },
  { key: "read_construction_library", label: "Read Construction Library", note: "Constructions and versions" },
  { key: "manage_construction_library", label: "Manage Construction Library", note: "Publish Constructions" },
  { key: "declare_cutover", label: "Declare cutover", note: "Declare Formal Data Cutover" },
]);

export const PLANT_CAPABILITIES = Object.freeze([
  { key: "plant_access", label: "Plant access", note: "Baseline read of a plant's data" },
  { key: "make_quote", label: "Make quotes", note: "Maker" },
  { key: "check_quote", label: "Check quotes", note: "Checker" },
  { key: "manage_sku_master", label: "Manage SKUs", note: "SKU publication" },
  { key: "adopt_construction_for_plant", label: "Adopt Constructions", note: "Adopt a Construction version" },
  { key: "propose_commercial_master", label: "Propose commercial masters", note: "" },
  { key: "approve_commercial_master", label: "Approve commercial masters", note: "" },
]);

const GROUP_KEYS = new Set(GROUP_CAPABILITIES.map(c => c.key));
const PLANT_KEYS = new Set(PLANT_CAPABILITIES.map(c => c.key));

export function isGroupCapability(key) { return GROUP_KEYS.has(key); }
export function isPlantCapability(key) { return PLANT_KEYS.has(key); }

// ── canonicalisation — distinct and sorted, so re-submitting the same set in a
// different order is recognised as unchanged and never bumps content_version ──

export function canonicalGroupSet(keys) {
  return [...new Set((Array.isArray(keys) ? keys : []).filter(isGroupCapability))].sort();
}

export function canonicalPlantMap(map) {
  const out = {};
  for (const [code, keys] of Object.entries(map || {})) {
    const canon = [...new Set((Array.isArray(keys) ? keys : []).filter(isPlantCapability))].sort();
    if (canon.length) out[code] = canon;   // a plant with no capabilities is simply absent
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

// Two capability states are equal when their canonical forms are equal. Used to
// disable Save on a no-op, so an idempotent request is not even sent.
export function sameCapabilityState(a, b) {
  return JSON.stringify([canonicalGroupSet(a?.group), canonicalPlantMap(a?.plant)])
      === JSON.stringify([canonicalGroupSet(b?.group), canonicalPlantMap(b?.plant)]);
}

// ── the request body — a complete replacement, always versioned ────────────

export function setCapabilitiesBody(expectedContentVersion, groupKeys, plantMap) {
  return {
    expected_content_version: expectedContentVersion,
    group_capabilities: canonicalGroupSet(groupKeys),
    plant_capabilities: canonicalPlantMap(plantMap),
  };
}

// ── the derived role label — presentation only ─────────────────────────────
//
// Mirrors the backend's derive_role exactly. It is a summary of the capability
// set, never an input to it. A user holding check_quote at one plant and
// make_quote at another reads as "Checker", because that is the higher of the
// two operational capabilities they hold somewhere.
export function deriveRoleLabel(groupKeys, plantMap) {
  const group = Array.isArray(groupKeys) ? groupKeys : [];
  if (group.includes("administer_users")) return "Administrator";
  for (const keys of Object.values(plantMap || {})) {
    if (Array.isArray(keys) && keys.includes("check_quote")) return "Checker";
  }
  return "Maker";
}

// ── confirm copy — names the user and what actually changes ────────────────

export function capabilityChangeSummary(before, after) {
  const b = canonicalGroupSet(before?.group), a = canonicalGroupSet(after?.group);
  const granted = a.filter(k => !b.includes(k));
  const revoked = b.filter(k => !a.includes(k));
  const bp = canonicalPlantMap(before?.plant), ap = canonicalPlantMap(after?.plant);
  const plantChanges = [];
  for (const code of new Set([...Object.keys(bp), ...Object.keys(ap)])) {
    const was = bp[code] || [], now = ap[code] || [];
    if (JSON.stringify(was) !== JSON.stringify(now)) plantChanges.push(code);
  }
  return { granted, revoked, plantChanges };
}

export function confirmCapabilityChange(displayName, before, after) {
  const { granted, revoked, plantChanges } = capabilityChangeSummary(before, after);
  const bits = [];
  if (granted.length) bits.push(`grant ${granted.join(", ")}`);
  if (revoked.length) bits.push(`revoke ${revoked.join(", ")}`);
  if (plantChanges.length) bits.push(`change plant permissions at ${plantChanges.join(", ")}`);
  const what = bits.length ? bits.join("; ") : "make no change";
  return `Replace the complete permission set for "${displayName}"? This will ${what}. `
    + `Permissions take effect on their next request — the database decides access, not this screen.`;
}

// ── the last-administrator rule, in words a person can act on ──────────────
//
// The database refuses this with 22023, which maps to the broad public code
// TRANSITION_NOT_ALLOWED. That code stays as it is; the UI supplies the reason,
// because "transition not allowed" tells an administrator nothing about what to
// do next.
export function removesLastAdministrator(user, nextGroupKeys, activeAdministratorIds) {
  const stillAdmin = canonicalGroupSet(nextGroupKeys).includes("administer_users");
  if (stillAdmin) return false;
  const others = (activeAdministratorIds || []).filter(id => id !== user?.id);
  return others.length === 0;
}

export function lastAdministratorMessage() {
  return "At least one active administrator must remain. Grant administer_users to another "
    + "active user first, then remove it here.";
}

// ── UA-5: activation and deactivation ──────────────────────────────────────
//
// The same invariant, reached by the other path. It reads differently because
// the remedy is the same but the thing being attempted is not: nothing is being
// "removed here", and saying so would send an administrator to the permission
// editor for a problem they hit on the Deactivate button.
export function deactivatesLastAdministrator(user, activeAdministratorIds) {
  const holdsIt = (user?.group_capabilities || []).includes("administer_users");
  if (!holdsIt || !user?.active) return false;
  return (activeAdministratorIds || []).filter(id => id !== user?.id).length === 0;
}

export function lastAdministratorDeactivationMessage() {
  return "At least one active administrator must remain. This is the only one, so deactivating "
    + "them would leave nobody able to manage users. Grant administer_users to another active "
    + "user first.";
}

// What deactivation actually DOES, in the words a person needs before they
// press it. Both halves matter: an administrator hesitates over this button
// because they are unsure whether it destroys anything. It does not.
export function deactivationConsequence() {
  return "They will not be able to sign in or use the application until the account is "
    + "reactivated. Nothing is deleted: their quotes, approvals and every record they created "
    + "stay exactly as they are, still attributed to them.";
}

export function confirmDeactivation(displayName) {
  return `Deactivate "${displayName}"? ${deactivationConsequence()} Their permissions are left `
    + `untouched, so reactivating restores the same access.`;
}

export function confirmReactivation(displayName) {
  return `Reactivate "${displayName}"? They will be able to sign in again, with exactly the `
    + `permissions they hold now — reactivating grants nothing on its own.`;
}

// The status write carries a version for the same reason the capability write
// does: without it, two administrators holding the same list both act and the
// second silently overwrites the first. The database refuses a stale version
// with PT409, which reaches this screen as a 409.
export function setStatusBody(expectedContentVersion, active) {
  return { active: !!active, expected_content_version: expectedContentVersion };
}

export function staleStatusMessage(displayName) {
  return `"${displayName}" was changed somewhere else while this list was open. Their current `
    + `state has been reloaded — check it and apply your change again if it is still what you `
    + `want.`;
}

export function statusChangeSummary(user) {
  return user?.active
    ? { verb: "Deactivate", danger: true }
    : { verb: "Reactivate", danger: false };
}

// The database refuses a last-administrator removal or deactivation with 22023,
// which the route maps to the broad public code TRANSITION_NOT_ALLOWED (HTTP
// 422) and classifyResponse reports as kind 'validation'. That code is shared
// with several unrelated refusals and is deliberately NOT narrowed - so the
// reason has to be supplied here, where the caller knows what it was
// attempting. "Transition not allowed" tells an administrator nothing about
// what to do next; lastAdministratorMessage() does.
//
// Returns null when this rule does not apply, so the caller falls back to the
// server's own message.
export function refusalReason(outcome, { deactivatingLastAdministrator = false,
                                         removingLastAdministrator = false } = {}) {
  if (!outcome || outcome.kind !== "validation") return null;
  if (deactivatingLastAdministrator) return lastAdministratorDeactivationMessage();
  if (removingLastAdministrator) return lastAdministratorMessage();
  return null;
}

// ── stale-conflict copy — reload and re-decide, never a silent retry ───────

export function staleCapabilityMessage(displayName) {
  return `"${displayName}" was changed somewhere else while you were editing. Their current `
    + `permissions have been reloaded — check them and apply your change again if it is still `
    + `what you want.`;
}
