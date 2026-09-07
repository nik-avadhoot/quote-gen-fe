// ═══════════════════════════════════════════════════════════════════════════
// src/lib/customerFamilyActions.js — U1 Customer Family mutation helpers.
//
// Pure, framework-free request-body builders and confirm-dialog copy for the
// nine governed mutation actions (docs/u1-customer-family-mutations-packet.md
// §§8-9). Kept separate from CustomerFamiliesScreen.jsx so this logic has a
// testable surface without a DOM/UI harness — this repo has none (see
// CLAUDE.md) — the same reason lib/capabilities.js is split from
// CapabilityGate.jsx and proven by scripts/capabilities-fixtures.mjs.
//
// Nothing here calls the network. Every function takes plain values and
// returns a plain object (a request body) or a string (confirm-dialog copy).
// The actual apiFetch() call and classifyResponse() handling live in the
// screen component, which is what a browser, not a Node fixture, can exercise.
// ═══════════════════════════════════════════════════════════════════════════

export function proposeFamilyBody(name) {
  return { name: (name || "").trim() };
}

export function createProspectBody(displayName, familyId) {
  const body = { display_name: (displayName || "").trim() };
  if (familyId !== null && familyId !== undefined && familyId !== "") {
    body.family_id = Number(familyId);
  }
  return body;
}

export function updateFamilyNameBody(name, expectedContentVersion) {
  return { name: (name || "").trim(), expected_content_version: expectedContentVersion };
}

export function approveFamilyBody(expectedContentVersion) {
  return { expected_content_version: expectedContentVersion };
}

export function addAliasBody(alias) {
  return { alias: (alias || "").trim() };
}

export function updateAliasBody(alias, expectedContentVersion) {
  return { alias: (alias || "").trim(), expected_content_version: expectedContentVersion };
}

export function retireAliasBody(expectedContentVersion) {
  return { expected_content_version: expectedContentVersion };
}

export function mergeBody(survivorId, retiredId, expectedSurvivorVersion, expectedRetiredVersion) {
  return {
    survivor_id: survivorId,
    retired_id: retiredId,
    expected_survivor_version: expectedSurvivorVersion,
    expected_retired_version: expectedRetiredVersion,
  };
}

export function reassignBody(partyId, newFamilyId, expectedContentVersion, effectiveDate) {
  const body = {
    party_id: partyId,
    new_family_id: newFamilyId,
    expected_content_version: expectedContentVersion,
  };
  if (effectiveDate) body.effective_date = effectiveDate;
  return body;
}

export function graduateBody(partyId) {
  return { party_id: partyId };
}

// ── confirm-dialog copy — names the entities, states irreversibility where
// the schema makes it true, never a generic "are you sure?" ─────────────────

export function mergeConfirmMessage(survivorName, retiredName) {
  return `Merge "${retiredName}" into "${survivorName}"? This cannot be undone — no un-merge `
    + `operation exists. "${retiredName}" will be retired and its name kept as a searchable `
    + `alias on "${survivorName}".`;
}

export function reassignConfirmMessage(partyName, fromFamilyName, toFamilyName) {
  return `Move "${partyName}" from "${fromFamilyName}" to "${toFamilyName}"? `
    + `The current membership becomes history; a new one starts on the effective date.`;
}

export function graduateConfirmMessage(partyName) {
  return `Graduate "${partyName}" to a Customer? This mints a permanent Customer Code that cannot `
    + `be reassigned by graduating again.`;
}

export function retireAliasConfirmMessage(alias) {
  return `Retire the alias "${alias}"? It stays visible in history but will no longer match a search.`;
}

// ── effective-date usability pre-check — a hint only; the server's own rule
// (not preceding the CURRENT membership's effective_from) is authoritative
// and is re-checked there regardless of what this returns ──────────────────

export function effectiveDatePrecedesMembership(effectiveDate, currentMembershipStartDate) {
  if (!effectiveDate || !currentMembershipStartDate) return false;
  // Both are ISO yyyy-mm-dd strings from <input type="date">/the API, so a
  // plain lexicographic comparison is a correct date comparison.
  return effectiveDate < currentMembershipStartDate;
}
