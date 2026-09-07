// ═══════════════════════════════════════════════════════════════════════════
// src/lib/customerLocationActions.js — U1 Slice C Customer Location helpers.
//
// docs/u1-customer-foundation-authorization-packet.md, Slice C. Same split as
// lib/customerFamilyActions.js / lib/partyActions.js: pure request-body
// builders and confirm-dialog copy, no network call — the testable surface
// for a repo with no DOM/UI test harness.
//
// Scope: propose (with eligibility fixed at that point), edit descriptive
// detail (new version), approve, retire, assign the permanent code. There is
// deliberately NO eligibility-change helper here — post-proposal eligibility
// change is Product-Owner-blocked, not designed, per the packet's Slice C.
// ═══════════════════════════════════════════════════════════════════════════

export function proposeLocationBody({ locationType, addressText, contactName, notes,
  billToEligible, shipToEligible }) {
  return {
    location_type: locationType || null,
    address_text: (addressText || "").trim() || null,
    contact_name: (contactName || "").trim() || null,
    notes: (notes || "").trim() || null,
    bill_to_eligible: !!billToEligible,
    ship_to_eligible: !!shipToEligible,
  };
}

export function updateLocationBody({ addressText, contactName, notes }, expectedContentVersion) {
  return {
    address_text: (addressText || "").trim() || null,
    contact_name: (contactName || "").trim() || null,
    notes: (notes || "").trim() || null,
    expected_content_version: expectedContentVersion,
  };
}

export function approveLocationBody(expectedContentVersion) {
  return { expected_content_version: expectedContentVersion };
}

export function retireLocationBody(expectedContentVersion) {
  return { expected_content_version: expectedContentVersion };
}

// assign-code takes no body — the location id is in the URL and the
// operation is idempotent (no CAS parameter exists to carry).

// ── confirm-dialog copy ──────────────────────────────────────────────────

export function retireLocationConfirmMessage(locationLabel) {
  return `Retire "${locationLabel}"? It stays visible in history but can no longer be selected as `
    + `a Bill-to or Ship-to destination.`;
}

// ── descriptive-completeness indicator (CDM-08: "details may remain
// incomplete") — a display concern only, no schema involved ────────────────

export function hasIncompleteDetails(currentVersion) {
  if (!currentVersion) return true;
  return !currentVersion.address_text && !currentVersion.contact_name && !currentVersion.notes;
}
