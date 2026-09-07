// ═══════════════════════════════════════════════════════════════════════════
// src/lib/partyActions.js — U1 Slice A Party editing helper.
//
// docs/u1-customer-foundation-authorization-packet.md, Slice A. Same split as
// lib/customerFamilyActions.js: pure request-body builder, no network call,
// no DOM — the testable surface for a repo with no UI test harness.
//
// Scope: display_name only (Slice A's whole scope). No deactivation, no
// merge, no locations action lives here — those are separate slices/packets.
// ═══════════════════════════════════════════════════════════════════════════

export function updatePartyBody(displayName, expectedContentVersion) {
  return {
    display_name: (displayName || "").trim(),
    expected_content_version: expectedContentVersion,
  };
}
