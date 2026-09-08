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

// ── location_type — the ONE list, pinned to the database constraint ────────
//
// Added by U1 Slice D after a live 500. The Slice D modal transcribed this
// list by hand and wrote `factory`, which is not one of the four values
// `ck_lv_type` on customer_location_versions permits:
//
//   CHECK (location_type IS NULL OR location_type = ANY
//          (ARRAY['plant','office','warehouse','other']))
//
// Postgres raised 23514 check_violation, which `_RPC_ERROR_MAP` does not map,
// so the route answered 500 INTERNAL_ERROR — correct behaviour for an
// unmapped code, and a client-side bug, not a backend one.
//
// The list now lives here, once, and both the Customer Families screen and the
// Batch Entry quick-pick import it. A fixture pins these exact four values, so
// a value the database would refuse cannot be reintroduced by transcription.
export const LOCATION_TYPE_OPTS = Object.freeze([
  { v: "plant", l: "Plant" },
  { v: "office", l: "Office" },
  { v: "warehouse", l: "Warehouse" },
  { v: "other", l: "Other" },
]);

export function locationTypeIsAllowed(value) {
  if (value === null || value === undefined || value === "") return true; // NULL is permitted
  return LOCATION_TYPE_OPTS.some(o => o.v === value);
}
