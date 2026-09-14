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

// D3 — a Family name that is empty, whitespace-only, or not a string at all is
// not proposable. Extracted here rather than left inline in the modal so the
// rule has a testable surface (scripts/customer-family-actions-fixtures.mjs);
// the screen uses it to disable the button AND to show an inline message, so
// the two can never disagree.
//
// This is a usability pre-check, NOT the authority. The Flask route still
// refuses a blank name with INVALID_INPUT, and app_private.propose_customer_
// family raises 22023 for one regardless of what any client sends — verified
// directly against the live database, not assumed.
export function familyNameIsBlank(name) {
  return typeof name !== "string" || name.trim() === "";
}

export function proposeFamilyBody(name, sectorId) {
  return { name: (name || "").trim(), sector_id: Number(sectorId) };
}

export function createProspectBody(displayName, familyId, sectorId) {
  const body = { display_name: (displayName || "").trim() };
  if (familyId !== null && familyId !== undefined && familyId !== "") {
    body.family_id = Number(familyId);
  }
  if (sectorId !== null && sectorId !== undefined && sectorId !== "") {
    body.sector_id = Number(sectorId);
  }
  return body;
}

export function addFamilySectorBody(sectorId, expectedContentVersion) {
  return {
    sector_id: Number(sectorId),
    expected_content_version: expectedContentVersion,
  };
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

// ── U1 external references — READ-ONLY presentation helpers ────────────────
//
// The canonical requirement (data-model-frontend-design-plan.md §6 U1,
// "Customers and Prospects — external references") was recorded as an
// outstanding gap by u1-customer-foundation-authorization-packet.md: the read
// route did not return `party_external_references` at all. It now does, and
// these helpers turn that payload into something a person can read.
//
// READ ONLY. There is deliberately no body builder here, because there is no
// create/edit/retire/delete operation to build one for — propose/edit remain
// Deferred by that same packet. Adding one later is a separate authorisation,
// not an extension of this.

// The three values `ck_pxr_kind` permits, in the database's own order.
export const EXTERNAL_REF_KIND_LABELS = {
  legacy_customer_code: "Legacy customer code",
  customer_item_ref: "Customer item reference",
  other: "Other",
};

// An unrecognised kind is shown verbatim rather than hidden or relabelled:
// the check constraint should make it impossible, and silently swallowing one
// would hide a real data problem behind a tidy screen.
export function externalRefKindLabel(kind) {
  return EXTERNAL_REF_KIND_LABELS[kind] || kind || "Unknown";
}

// Groups by `party_id` and orders DETERMINISTICALLY — kind, then value, then
// id — so the same payload always renders in the same order regardless of
// what order PostgREST returned the rows in. Rows without a party_id are
// dropped: they cannot be attributed to a Customer/Prospect, and guessing
// would be worse than omitting them.
export function groupExternalReferencesByParty(rows) {
  const byParty = {};
  for (const row of rows || []) {
    if (!row || row.party_id === undefined || row.party_id === null) continue;
    (byParty[row.party_id] ||= []).push(row);
  }
  for (const list of Object.values(byParty)) {
    list.sort((a, b) =>
      String(a.ref_kind || "").localeCompare(String(b.ref_kind || ""))
      || String(a.ref_value || "").localeCompare(String(b.ref_value || ""))
      || (a.id || 0) - (b.id || 0));
  }
  return byParty;
}
