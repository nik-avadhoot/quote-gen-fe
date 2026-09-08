// ═══════════════════════════════════════════════════════════════════════════
// src/lib/batchQuickCreate.js — U1 Slice D, Batch Entry light integration.
//
// docs/u1-customer-foundation-authorization-packet.md, Slice D. Same split as
// lib/customerFamilyActions.js / lib/partyActions.js / lib/customerLocation-
// Actions.js: pure helpers with no network call, because this repo has no
// DOM/UI test harness (CLAUDE.md) and the testable surface therefore has to be
// the logic, not the component.
//
// WHAT THIS SLICE IS, STATED AS A BOUNDARY RATHER THAN AS A FEATURE.
//
// Batch Entry's `client` and `delivery` are ordinary Batch Profile strings
// persisted to `cbb_batchprofile` (state/useBatchState.js). This slice adds a
// governed way to PRODUCE one of those strings. It adds no way to STORE
// anything else. After the copy, the value is indistinguishable from one typed
// by hand — which is the point, not a limitation:
//
//   * no `partyId`, no `locationId`, no link object, no snapshot;
//   * no staleness concept, because no state is left that could go stale;
//   * no new key on the Batch Profile, and no new localStorage key;
//   * no Delivery Group, no migration helper, no U4 resolver.
//
// The packet's own words: an earlier draft carried `clientLink`/`deliveryLink`
// objects with staleness detection and a `resolveLinkForMigration` helper, and
// all of it was removed as referential linkage in substance — a persistent
// pointer from Batch state to a governed identity, with its own consistency
// rules — which belongs to U4's durable Batch Workspace, not here.
//
// applyLabelToProfile() below is the mechanical guarantee of that boundary: it
// is the ONLY way this slice writes to the profile, it accepts only the two
// named fields, and it writes only a string. scripts/batch-quick-create-
// fixtures.mjs asserts the resulting object's key set is unchanged.
// ═══════════════════════════════════════════════════════════════════════════
import { hasCapability } from "./capabilities.js";

// Reused, NOT duplicated — the request bodies are identical to the ones the
// Customer Families screen already sends to the same two governed routes, and
// a second copy would be a second place for them to drift.
export { createProspectBody } from "./customerFamilyActions.js";
export { proposeLocationBody } from "./customerLocationActions.js";

// The only two Batch Profile fields this slice may write. Not a style choice —
// applyLabelToProfile refuses anything else, so a future edit cannot quietly
// widen the write surface without changing this line and failing its fixture.
export const BATCH_TEXT_FIELDS = Object.freeze(["client", "delivery"]);

// Capabilities, mirroring the backend's own conditions rather than inventing a
// narrower frontend rule:
//   create — `manage_customer_master` OR `make_quote` at any active plant,
//            the DB's own OR condition for create_minimal_prospect and
//            propose_customer_location (server.py).
//   browse — `read_party_master`, a GROUP capability, checked explicitly by
//            GET /masters/customer-families, which returns 403 rather than an
//            empty list so denial is never dressed up as "nothing exists".
export const CREATE_CAPS = Object.freeze(["manage_customer_master", "make_quote"]);
export const BROWSE_CAP = "read_party_master";

// These two are genuinely independent, and the honest case this function
// exists to represent is `make_quote`-only: such a caller MAY quick-create a
// Prospect and propose a Location for it, and MAY NOT list existing ones. The
// UI must show that as two different answers, not hide creation because
// browsing failed, and not offer a browse list that will 403.
export function quickPickAbilities(profile) {
  return {
    canCreate: CREATE_CAPS.some(cap => hasCapability(profile, cap)),
    canBrowse: hasCapability(profile, BROWSE_CAP),
  };
}

// ── labels — what actually gets copied into the free-text field ────────────

// Literally the Party's display_name, per the packet ("sets `client` = the
// returned display_name"). Deliberately NOT prefixed with the customer_code: a
// freshly created Prospect has no code yet, so a coded and an uncoded label
// would read as two different conventions in the same field, and the field is
// free text whose only consumer is a human.
export function partyLabel(party) {
  if (!party) return "";
  return (party.display_name || "").trim();
}

// A Location has no single natural name. The permanent code is preferred when
// one has been minted, but a *proposed* Location has none — assign-code is a
// separate later action — so the descriptive detail the user just entered is
// what identifies it. Falls back to the surrogate id only when a Location
// carries no descriptive detail at all, which CDM-08 explicitly permits.
export function locationLabel(location, version) {
  const code = (location?.location_code || "").trim();
  const descriptive = (version?.address_text || "").trim()
    || (version?.contact_name || "").trim()
    || (version?.location_type || "").trim();
  if (code && descriptive) return `${code} — ${descriptive}`;
  if (code) return code;
  if (descriptive) return descriptive;
  return location?.id ? `Location ${location.id}` : "";
}

// ── the write — the whole of this slice's effect on Batch state ────────────

// Returns a NEW profile with exactly one string field replaced, or the SAME
// profile object untouched if the field is not one of the two permitted ones
// or the label is empty. Never adds a key, never removes one, never writes a
// non-string.
export function applyLabelToProfile(profile, field, label) {
  const base = profile || {};
  if (!BATCH_TEXT_FIELDS.includes(field)) return base;
  const text = typeof label === "string" ? label.trim() : "";
  if (!text) return base;
  return { ...base, [field]: text };
}

// ── explicit confirmation ─────────────────────────────────────────────────

const FIELD_TITLES = { client: "Client", delivery: "Delivery" };

export function fieldTitle(field) {
  return FIELD_TITLES[field] || field;
}

// Names the field, quotes the exact text that will be written, quotes what it
// replaces, and says plainly that nothing durable is being linked — because a
// user who believes this creates a relationship would reasonably expect the
// Batch to follow later Customer Master edits, and it will not.
export function copyToBatchConfirmMessage(field, label, currentText) {
  const title = fieldTitle(field);
  const current = (currentText || "").trim();
  return `Set ${title} to "${label}"?`
    + (current ? ` This replaces the current text "${current}".` : "")
    + ` ${title} stays an ordinary free-text Batch value: no link to the governed record is stored,`
    + ` and you can edit or clear it by hand afterwards.`;
}

// Shown when a governed record was created and the user then cancels the copy.
// The creation is real and already committed — saying nothing would leave the
// user thinking Cancel undid it.
export function createdButNotCopiedMessage(what, label) {
  return `"${label}" was created in the Customer Master and is still there. Only the Batch ${what}`
    + ` text was left unchanged.`;
}

// ── freight consequence of a Delivery label (disclosure, not a rule) ───────
//
// `delivery` is not purely decorative: BatchProfileBar reads
// freight[plant][delivery] to show the matrix freight rate. A governed
// Customer Location's label is not a key in that freight master, so the matrix
// rate reads as 0 — exactly as it already does when no Delivery is selected.
// This is a real consequence of writing a Location name into this field, so
// the UI states it before the copy rather than letting a rate silently drop.
export function deliveryLabelIsOffFreightMatrix(label, freightLocations) {
  const text = (label || "").trim();
  if (!text) return false;
  return !(Array.isArray(freightLocations) ? freightLocations : []).includes(text);
}

export function deliveryFreightWarning(label) {
  return `"${label}" is not one of the freight master's destinations, so the freight matrix rate`
    + ` will read 0 for it — the same as an unset Delivery. Enter the freight rate by hand, or pick`
    + ` a freight destination from the list instead.`;
}
