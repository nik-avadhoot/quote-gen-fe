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
// CORRECTION — Product Owner ruling, 2026-09-08. The first pass treated
// `client` AND `delivery` as interchangeable free text. They are not.
// `client` is genuinely free text. `delivery` is a FREIGHT-DESTINATION MASTER
// KEY: BatchProfileBar resolves freight[plant][delivery] from it to price the
// Batch. A Customer Location's label is not a key in that master, so writing
// one there made the freight lookup return 0 — a misleading and commercially
// unsafe pricing state that a confirmation dialog does not make acceptable.
// One field cannot carry two incompatible commercial meanings.
//
// So this slice writes `client` and NOTHING else. That is a decision about
// preserving correct freight authority, NOT a refusal of identifiers: formal
// Customer Location selection is deferred to U4, where a Delivery Group
// referencing real Bill-to/Ship-to Locations is the right place for it.
// Creating a Location from here remains available as an explicitly UNLINKED
// Customer Master convenience — it changes no Batch field at all.
//
// Batch Entry's `client` is an ordinary Batch Profile string persisted to
// `cbb_batchprofile` (state/useBatchState.js). This slice adds a governed way
// to PRODUCE that string. It adds no way to STORE anything else. After the
// copy, the value is indistinguishable from one typed by hand — the point,
// not a limitation:
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
// is the ONLY way this slice writes to the profile, it accepts `client` and
// nothing else, and it writes only a string. scripts/batch-quick-create-
// fixtures.mjs asserts the key set is unchanged AND that `delivery` — along
// with every other field — is refused outright.
// ═══════════════════════════════════════════════════════════════════════════
import { hasCapability } from "./capabilities.js";

// Reused, NOT duplicated — the request bodies are identical to the ones the
// Customer Families screen already sends to the same two governed routes, and
// a second copy would be a second place for them to drift.
export { createProspectBody } from "./customerFamilyActions.js";
export { proposeLocationBody } from "./customerLocationActions.js";

// The ONLY Batch Profile field this slice may write. Not a style choice —
// applyLabelToProfile refuses anything else, so a future edit cannot quietly
// widen the write surface without changing this line and failing its fixture.
// `delivery` is deliberately absent and must stay absent: it belongs to the
// freight master, and the fixtures assert that writing it is refused.
//
// WIDENED 2026-09-18 by Product Owner ruling: creating a Prospect happens in one
// window that also chooses its governed Sector and its Producing Plant, and the
// Batch takes those same choices, so `sector` and `plant` join `client`. Both are
// plain selections the Batch Profile already offers. `delivery` and every
// freight or commercial field stay unwritable, exactly as before.
export const BATCH_TEXT_FIELDS = Object.freeze(["client", "sector", "plant"]);

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
//
// POST-CORRECTION: this label is for TELLING THE USER what was created. It is
// never written into any Batch field — applyLabelToProfile would refuse
// `delivery` even if a caller tried.
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

// Returns a NEW profile with `client` replaced, or the SAME profile object
// untouched if the field is not permitted or the label is empty. Never adds a
// key, never removes one, never writes a non-string, and never writes
// `delivery` — a Location-create caller cannot reach Batch state through here.
export function applyLabelToProfile(profile, field, label) {
  const base = profile || {};
  if (!BATCH_TEXT_FIELDS.includes(field)) return base;
  const text = typeof label === "string" ? label.trim() : "";
  if (!text) return base;
  return { ...base, [field]: text };
}

// ── explicit confirmation ─────────────────────────────────────────────────

// `delivery` is deliberately NOT here: it is not a field this slice may name,
// title or write.
const FIELD_TITLES = { client: "Client", sector: "Sector", plant: "Plant" };

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

// ── Customer Location: created, explicitly NOT linked to this Batch ───────
//
// The retained convenience. It uses the governed Slice C proposal route and
// then says, plainly, that nothing about the Batch changed — because nothing
// did. There is no Batch field a Location can correctly occupy: `delivery`
// belongs to the freight master, and inventing a second field would be the
// U4 referential state this slice must not introduce.

export function locationCreatedNotLinkedMessage(locLabel, partyName) {
  return `Location "${locLabel}" was created in the Customer Master under "${partyName}".`
    + ` It is NOT linked to this Batch: Delivery, freight and every other Batch field are`
    + ` unchanged. Delivery remains a freight destination, chosen from its own list.`
}

// Shown beside the create form, before the user commits to it, so the absence
// of a Batch effect is stated up front rather than only reported afterwards.
export function locationNotLinkedNotice() {
  return `Creating a Location here records it in the Customer Master only. It does not set`
    + ` Delivery and does not affect freight — Delivery is a freight destination, and`
    + ` choosing a Location for a Batch arrives with Delivery Groups in a later stage.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// CORRECTION 2 — Product Owner ruling, 2026-09-08. `client` is a GOVERNED
// SELECTION, not unrestricted free text.
//
// Intended behaviour: free text is the STARTING POINT for creating a client
// that does not exist yet. Once created — and for every client that already
// exists — the control is a searchable Customer/Prospect Master dropdown, and
// users select governed records instead of retyping arbitrary strings.
//
// WHAT IS STILL STORED, AND WHY IT IS ONLY THE DISPLAY NAME.
//
// The Batch keeps `client` as a plain string. That string is the TEMPORARY U1
// REPRESENTATION of a governed selection. It is not a foreign key, must never
// be described as one, and U4 introduces the durable Batch identity
// relationship.
//
// It stays the bare `display_name` — not "name · code" — because that value is
// consumed as customer-facing output and as an identifier prefix:
//   export/pdf.js:30              "To: <client>" on the quote sent to the customer
//   export/excel.js:275           written into the CBB+PP sheet
//   export/excel.js:179           the downloaded filename
//   state/useQuoteActions.js:396  first 4 characters become the SKU code prefix
// Appending a Customer Code or lifecycle marker would corrupt all four.
//
// THE LIMITATION, RECORDED EXPLICITLY FOR U4 (do not paper over it):
//   * a display name is NOT an identity. Two Parties may legitimately share
//     one, and identityFromText() reports that as AMBIGUOUS rather than
//     picking one;
//   * a later rename of the governed Party does not reach a Batch string
//     written earlier, and nothing here pretends otherwise;
//   * therefore, on reload, text is resolved for USABILITY only — to show what
//     it probably refers to — and never treated as proof of identity.
// U4 must resolve identity itself from whatever text exists; it cannot assume
// a U1 string uniquely designates a Party.
// ═══════════════════════════════════════════════════════════════════════════

// Legal-form noise that should not make two spellings look like two different
// customers. Deliberately conservative: it folds suffixes, not words that
// distinguish real businesses.
const LEGAL_NOISE = /\b(pvt|private|ltd|limited|llp|inc|incorporated|co|company|corp|corporation|and)\b/g;

export function normalizeForMatch(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[.,'"()[\]{}\-_/\\&+]+/g, " ")
    .replace(LEGAL_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchTokens(text) {
  return normalizeForMatch(text).split(" ").filter(Boolean);
}

// 1.0 exact (after normalisation) · 0.8 one contains the other · otherwise the
// Dice coefficient over word tokens. Deliberately simple and explainable: this
// decides what to SHOW a user before they create a duplicate, never what to
// store, and never identity.
export function matchScore(text, candidateName) {
  const a = normalizeForMatch(text), b = normalizeForMatch(candidateName);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.8;
  const ta = matchTokens(text), tb = matchTokens(candidateName);
  if (!ta.length || !tb.length) return 0;
  const setB = new Set(tb);
  const shared = ta.filter(t => setB.has(t)).length;
  return (2 * shared) / (ta.length + tb.length);
}

export const MATCH_THRESHOLD = 0.34;

// Ranked candidates for "did you mean?" — the duplicate guard required before
// any create. Never auto-selects; the caller must show these and let a human
// decide.
export function likelyMatches(text, parties, { limit = 6, threshold = MATCH_THRESHOLD } = {}) {
  if (!text || !Array.isArray(parties)) return [];
  return parties
    .map(party => ({ party, score: matchScore(text, party.display_name) }))
    .filter(m => m.score >= threshold)
    .sort((a, b) => b.score - a.score
      || (a.party.display_name || "").localeCompare(b.party.display_name || ""))
    .slice(0, limit);
}

// What a stored string can honestly be said to refer to. The `kind` values are
// deliberately not booleans, because "one exact match" and "two exact matches"
// demand different words on screen, and neither is proof of identity.
//
//   'unmatched' — no governed record resembles this text
//   'possible'  — resembles one or more, none exactly
//   'one'       — exactly one governed record has this name
//   'ambiguous' — SEVERAL governed records share this name; text cannot choose
export function identityFromText(text, parties) {
  const t = (text || "").trim();
  if (!t) return { kind: "unmatched", exact: [], matches: [] };
  const rows = Array.isArray(parties) ? parties : [];
  const norm = normalizeForMatch(t);
  const exact = rows.filter(p => normalizeForMatch(p.display_name) === norm);
  const matches = likelyMatches(t, rows);
  if (exact.length === 1) return { kind: "one", exact, matches };
  if (exact.length > 1) return { kind: "ambiguous", exact, matches };
  if (matches.length) return { kind: "possible", exact, matches };
  return { kind: "unmatched", exact: [], matches: [] };
}

// The words shown beside the field. Every one of them stops short of asserting
// identity — that is the whole point of this function existing.
export function identityCaveat(kind, count = 0) {
  switch (kind) {
    case "one":
      return "Matches one Customer Master record by name. The Batch stores the name only, "
        + "so this is a likely match, not a stored link.";
    case "ambiguous":
      return `${count} Customer Master records share this name — the text alone cannot say which. `
        + "Select the intended record to be sure.";
    case "possible":
      return "No exact Customer Master match. Similar records exist — select one, or create a "
        + "new Prospect.";
    case "unmatched":
    default:
      return "Not a Customer Master record. Create it as a Prospect, or select an existing record.";
  }
}

// ── result rows — enough to tell two records apart safely ──────────────────

export function partyLifecycleLabel(party) {
  const state = (party?.lifecycle_state || "").trim();
  if (state) return state.charAt(0).toUpperCase() + state.slice(1);
  return party?.customer_code ? "Customer" : "Prospect";
}

// display name · lifecycle · Customer Code where present · Family where known.
// Returned as parts, not one string, so the UI can weight them and so the
// fixtures can assert each piece independently.
export function partyOptionParts(party, familyName) {
  return {
    name: (party?.display_name || "").trim(),
    lifecycle: partyLifecycleLabel(party),
    code: (party?.customer_code || "").trim() || null,
    family: (familyName || "").trim() || null,
    inactive: party?.status === "inactive",
  };
}

// Family context for each Party, from the CURRENT membership only — a
// superseded membership is history and must not be shown as present context.
export function familyNameByPartyId(memberships, families) {
  const byId = Object.fromEntries((families || []).map(f => [f.id, f]));
  const out = {};
  for (const m of memberships || []) {
    if (!m.is_current) continue;
    const fam = byId[m.family_id];
    if (fam) out[m.party_id] = fam.name;
  }
  return out;
}

// The Sector a selected Customer brings to the Batch: its current Family's
// Sector when there is exactly one. Several Sectors are ambiguous and none is
// chosen; the Maker picks on the Batch.
export function familySectorCodes(partyId, { memberships, familySectors, sectors }) {
  const current = (memberships || []).find(m => m.is_current && m.party_id === partyId);
  if (!current) return [];
  const codeById = Object.fromEntries((sectors || []).map(s => [s.id, s.sector_code]));
  return [...new Set((familySectors || [])
    .filter(fs => fs.family_id === current.family_id)
    .map(fs => codeById[fs.sector_id])
    .filter(Boolean))];
}

// ── the create path ───────────────────────────────────────────────────────
//
// A genuinely new Batch-side client is created as a governed PROSPECT through
// `create_minimal_prospect`. That is the whole of the create surface here.
//
// Graduation to a Customer — which mints the permanent Customer Code — is a
// separate governed Customer Master action requiring `manage_customer_master`
// (`graduate_customer_party`). It is deliberately not reachable from Batch
// Entry: minting a permanent code is a Customer Master decision, not a side
// effect of starting a quote (Product Owner decision, 2026-09-08; recorded in
// data-model-frontend-design-plan.md §2.2).
//
// There is therefore no "create as Customer" option to expose, and no flag
// saying so — the UI simply offers the supported governed action. See the
// design plan for why, rather than a constant asserting it here.

// ── the one-window Prospect form (PO ruling 2026-09-18) ────────────────────

// The Batch Profile's own Customer Type options. A just-created Prospect
// defaults to "new"; the value only feeds the margin suggestion.
export const CUSTOMER_TYPE_OPTS = Object.freeze([
  { v: "new", l: "New" }, { v: "existing", l: "Existing" },
  { v: "strategic", l: "Strategic" }, { v: "spot", l: "Spot" },
]);
const CUSTOMER_TYPES = CUSTOMER_TYPE_OPTS.map(o => o.v);

// Everything the window needs before Create is enabled. The database requires a
// Sector for every Family; the Producing Plant is required by the Product
// Owner's plant-assignment rule (Amendment 06); a Batch cannot be priced
// without its delivery destination.
export function prospectFormProblems({ name, sectorId, plantId, delivery, customerType }) {
  const problems = [];
  if (!(typeof name === "string" && name.trim())) problems.push("name");
  if (!sectorId) problems.push("sector");
  if (!plantId) problems.push("plant");
  if (!delivery) problems.push("delivery");
  if (!CUSTOMER_TYPES.includes(customerType)) problems.push("customerType");
  return problems;
}

// The Batch Profile after a Prospect is created from the window. Client is
// always written. Every other value is written only when it is one of the
// options the Batch Profile itself offers, so a select never holds a value it
// cannot display and `delivery` can only ever be a real freight destination —
// never a Location label (applyLabelToProfile still refuses `delivery`).
export function profileAfterProspect(profile, { name, sectorCode, plantName, delivery, customerType },
  { sectorCodes, plantNames, deliveryOptions }) {
  let next = applyLabelToProfile(profile, "client", name);
  if (sectorCode && (sectorCodes || []).includes(sectorCode)) {
    next = applyLabelToProfile(next, "sector", sectorCode);
  }
  if (plantName && (plantNames || []).includes(plantName)) {
    next = applyLabelToProfile(next, "plant", plantName);
  }
  if (delivery && (deliveryOptions || []).includes(delivery)) next = { ...next, delivery };
  if (CUSTOMER_TYPES.includes(customerType)) next = { ...next, customerType };
  return next;
}

export function createProspectConfirmMessage(name, matchCount) {
  const dupe = matchCount > 0
    ? ` ${matchCount} similar record${matchCount === 1 ? "" : "s"} already `
      + `exist${matchCount === 1 ? "s" : ""} — check the list above before creating a duplicate.`
    : "";
  return `Create "${name}" as a new Prospect in the Customer Master?` + dupe
    + " It is created as a Prospect; graduating it to a Customer with a permanent Customer Code"
    + " is a separate action in Customer Families.";
}

// Shown wherever the caller may create but may NOT browse. It must not imply
// that typed text is already governed.
export function cannotBrowseNotice() {
  return "You cannot search the Customer Master, so this text is not known to be a governed "
    + "record. You can create it as a new Prospect; selecting an existing one needs the "
    + "read_party_master capability.";
}
