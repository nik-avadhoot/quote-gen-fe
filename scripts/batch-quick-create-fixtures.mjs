// ═══════════════════════════════════════════════════════════════════════════
// scripts/batch-quick-create-fixtures.mjs — npm run test:batch-quick-create
//
// U1 Slice D, Batch Entry light integration, frontend proof
// (docs/u1-customer-foundation-authorization-packet.md, Slice D). Same
// convention as customer-family-actions-fixtures.mjs / party-actions-
// fixtures.mjs / customer-location-actions-fixtures.mjs: no DOM/UI test
// harness in this repo, so the testable surface is the pure logic in
// lib/batchQuickCreate.js.
//
// The point of most of these checks is NEGATIVE. Slice D's whole risk is that
// it quietly grows into referential linkage — a partyId, a locationId, a link
// object, a snapshot to go stale — which the packet says belongs to U4. The
// assertions below therefore spend more effort proving what the Batch Profile
// does NOT gain than proving what the request bodies contain.
//
// CORRECTION — Product Owner ruling, 2026-09-08. `delivery` is a FREIGHT-
// DESTINATION MASTER KEY (BatchProfileBar resolves freight[plant][delivery]
// from it), not free-text Customer Location data. The first pass wrote a
// Location label into it and disclosed the resulting zero freight rate; that
// was a misleading, commercially unsafe pricing state, and disclosure did not
// redeem it. `delivery` is now mechanically unwritable by this slice, and a
// whole section below exists to prove that a Customer Location create cannot
// reach `delivery` — or any other Batch field — by any route.
//
// The reason existing-Location SELECTION is absent is not that identifiers
// were refused. It is that no Batch field can represent a chosen Location
// without the U4 referential state this slice must not introduce, and
// borrowing `delivery` would put two incompatible commercial meanings in one
// field. Formal selection belongs to U4's Delivery Group UI.
// ═══════════════════════════════════════════════════════════════════════════
import {
  BATCH_TEXT_FIELDS, BROWSE_CAP, CREATE_CAPS,
  MATCH_THRESHOLD, applyLabelToProfile, cannotBrowseNotice, copyToBatchConfirmMessage,
  createProspectBody, createProspectConfirmMessage, createdButNotCopiedMessage,
  familyNameByPartyId, fieldTitle, identityCaveat, identityFromText,
  likelyMatches, locationCreatedNotLinkedMessage, locationLabel,
  locationNotLinkedNotice, matchScore, normalizeForMatch, partyLabel,
  partyLifecycleLabel, partyOptionParts, profileAfterProspect, proposeLocationBody,
  prospectFormProblems, prospectPlantNote, quickPickAbilities,
} from "../src/lib/batchQuickCreate.js";

// Every helper the module exports, so a re-added freight/delivery helper
// cannot slip back in unnoticed.
import * as QC from "../src/lib/batchQuickCreate.js";

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) { fails++; console.log(`FAIL  ${name}${extra ? "  " + extra : ""}`); }
  else console.log(`ok    ${name}`);
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const keys = (o) => Object.keys(o).sort();

// The shape state/useBatchState.js actually initialises and persists to
// `cbb_batchprofile`. Copied here deliberately: if that shape changes, these
// key-set assertions must be revisited rather than silently keep passing.
const PROFILE = Object.freeze({
  client: "", sector: "", plant: "", delivery: "",
  margin: 8, marginPP: 8, interest: 0.5, paymentDisc: "30", freightOverride: "",
  waste: 5, convRate: 7, wastePP: 5, convRatePP: 12.5,
  customerType: "existing", priceContext: "unknown",
});

// ── request bodies — reused from the Customer Master screens, not redefined ─

ok("prospect body: display_name is trimmed, and no family_id is sent when none is chosen",
   eq(createProspectBody("  Acme Boxes Ltd  ", null), { display_name: "Acme Boxes Ltd" }));

ok("prospect body: a chosen family_id is coerced to a number",
   eq(createProspectBody("Acme", "7"), { display_name: "Acme", family_id: 7 }));

ok("prospect body: carries no Batch field of any kind",
   ["client", "delivery", "batch", "batchProfile"]
     .every(k => !(k in createProspectBody("Acme", null))));

ok("location body: full shape, trimmed, blanks nulled, eligibility coerced",
   eq(proposeLocationBody({ locationType: "factory", addressText: "  12 Kalamna Rd  ",
     contactName: "", notes: "", billToEligible: false, shipToEligible: 1 }),
     { location_type: "factory", address_text: "12 Kalamna Rd", contact_name: null,
       notes: null, bill_to_eligible: false, ship_to_eligible: true }));

ok("location body: carries no Batch field of any kind",
   ["client", "delivery", "batch", "batchProfile"]
     .every(k => !(k in proposeLocationBody({ billToEligible: true }))));

// ── labels — what is copied into the free-text field ───────────────────────

ok("party label: the display_name, trimmed, with no code prefix",
   partyLabel({ id: 1, display_name: "  Acme Boxes Ltd  ", customer_code: "C-0007" })
     === "Acme Boxes Ltd");
ok("party label: an absent Party is the empty string, never 'undefined'",
   partyLabel(null) === "" && partyLabel(undefined) === "");

ok("location label: a proposed Location has no code, so its address identifies it",
   locationLabel({ id: 9, location_code: null }, { address_text: "12 Kalamna Rd" })
     === "12 Kalamna Rd");
ok("location label: a coded Location shows the code and the address",
   locationLabel({ id: 9, location_code: "C-0007-01" }, { address_text: "12 Kalamna Rd" })
     === "C-0007-01 — 12 Kalamna Rd");
ok("location label: falls back through contact, then type",
   locationLabel({ id: 9 }, { contact_name: "R. Sharma" }) === "R. Sharma"
   && locationLabel({ id: 9 }, { location_type: "warehouse" }) === "warehouse");
ok("location label: a Location with no descriptive detail at all (CDM-08 permits it) still names itself",
   locationLabel({ id: 9 }, null) === "Location 9");

// ── THE BOUNDARY: applyLabelToProfile is the only write this slice makes ────

const afterClient = applyLabelToProfile(PROFILE, "client", "Acme Boxes Ltd");

ok("apply: writes the label into the named field",
   afterClient.client === "Acme Boxes Ltd");

ok("apply: the key set is EXACTLY unchanged — no new Batch Profile field appears",
   eq(keys(afterClient), keys(PROFILE)),
   `got ${JSON.stringify(keys(afterClient))}`);

ok("apply: no partyId, locationId, link object or snapshot is introduced",
   ["partyId", "party_id", "locationId", "location_id", "clientLink", "deliveryLink",
    "link", "linkedAt", "linkedName", "stale"].every(k => !(k in afterClient)));

ok("apply: every OTHER field keeps its exact previous value",
   Object.keys(PROFILE).filter(k => k !== "client")
     .every(k => afterClient[k] === PROFILE[k]));

// THE CORRECTION, asserted first among the negatives: `delivery` carries
// freight authority and this slice may not write it under any circumstance.
ok("apply: writing `delivery` is REFUSED — the freight key is not writable here",
   applyLabelToProfile(PROFILE, "delivery", "12 Kalamna Rd") === PROFILE);

ok("apply: a refused `delivery` write leaves the freight destination exactly as it was",
   (() => {
     const seeded = { ...PROFILE, delivery: "Nagpur", freightOverride: "" };
     const after = applyLabelToProfile(seeded, "delivery", "12 Kalamna Rd");
     return after === seeded && after.delivery === "Nagpur" && after.freightOverride === "";
   })());

ok("apply: the input profile is not mutated — a new object is returned",
   PROFILE.client === "" && afterClient !== PROFILE);

// PO ruling 2026-09-18: the one-window Prospect form also sets the Batch's
// Sector and Plant, so exactly `client`, `sector` and `plant` are writable.
// Everything commercial or freight-bearing stays refused.
ok("apply: every field outside client/sector/plant is refused, profile returned untouched",
   ["margin", "delivery", "freightOverride", "customerType",
    "priceContext", "interest", "paymentDisc"]
     .every(f => applyLabelToProfile(PROFILE, f, "anything") === PROFILE));

ok("apply: exactly client, sector and plant are writable — `delivery` is not on the list",
   eq(BATCH_TEXT_FIELDS, ["client", "sector", "plant"]) && !BATCH_TEXT_FIELDS.includes("delivery"));

ok("apply: a sector or plant write changes only that field",
   (() => {
     const s = applyLabelToProfile(PROFILE, "sector", "TEXTILE");
     const p = applyLabelToProfile(PROFILE, "plant", "Nagpur");
     return s.sector === "TEXTILE" && p.plant === "Nagpur"
       && Object.keys(PROFILE).filter(k => k !== "sector").every(k => s[k] === PROFILE[k])
       && Object.keys(PROFILE).filter(k => k !== "plant").every(k => p[k] === PROFILE[k]);
   })());

// ── the one-window Prospect form ───────────────────────────────────────────

ok("prospect form: name, Sector and Plant are all required",
   eq(prospectFormProblems({ name: " ", sectorId: "", plantId: "" }).length, 3)
   && prospectFormProblems({ name: "Indo Rama", sectorId: "276", plantId: "1" }).length === 0
   && prospectFormProblems({ name: "Indo Rama", sectorId: "276", plantId: "" }).length === 1
   && prospectFormProblems({ name: "Indo Rama", sectorId: "", plantId: "1" }).length === 1);

ok("prospect body: the chosen Sector is sent as sector_id, which the backend requires for a new Family",
   eq(createProspectBody("Indo Rama", null, "276"), { display_name: "Indo Rama", sector_id: 276 }));

ok("prospect → Batch: Client, Sector and Plant are set; delivery and freight never move",
   (() => {
     const seeded = { ...PROFILE, delivery: "Nagpur", freightOverride: "" };
     const after = profileAfterProspect(seeded, { name: "Indo Rama", sectorCode: "TEXTILE", plantName: "Nagpur" },
       { sectorCodes: ["TEXTILE", "PAINTS"], plantNames: ["Nagpur", "Pune", "Kolkata"] });
     return after.client === "Indo Rama" && after.sector === "TEXTILE" && after.plant === "Nagpur"
       && after.delivery === "Nagpur" && after.freightOverride === "" && eq(keys(after), keys(seeded));
   })());

ok("prospect → Batch: a Sector or Plant the Batch Profile cannot display is not written",
   (() => {
     const after = profileAfterProspect(PROFILE, { name: "Indo Rama", sectorCode: "NEWCODE", plantName: "Khed" },
       { sectorCodes: ["TEXTILE"], plantNames: ["Nagpur"] });
     return after.client === "Indo Rama" && after.sector === "" && after.plant === "";
   })());

ok("prospect form: the Plant note says it is not yet stored on the Customer Family",
   /Amendment 06/.test(prospectPlantNote("Nagpur")) && /not built yet/.test(prospectPlantNote("Nagpur")));

ok("apply: an empty or whitespace-only label writes nothing",
   applyLabelToProfile(PROFILE, "client", "") === PROFILE
   && applyLabelToProfile(PROFILE, "client", "   ") === PROFILE);

ok("apply: a non-string label writes nothing — only text ever reaches Batch state",
   applyLabelToProfile(PROFILE, "client", 42) === PROFILE
   && applyLabelToProfile(PROFILE, "client", { id: 7 }) === PROFILE
   && applyLabelToProfile(PROFILE, "client", null) === PROFILE);

ok("apply: the written value is a plain trimmed string, not an object",
   typeof applyLabelToProfile(PROFILE, "client", "  Acme  ").client === "string"
   && applyLabelToProfile(PROFILE, "client", "  Acme  ").client === "Acme");

// A pre-existing Batch profile — one saved before Slice D existed, or one
// hand-typed — must stay valid and must stay editable afterwards.
const preExisting = { ...PROFILE, client: "Typed by hand", delivery: "Nagpur", sector: "FMCG" };

ok("pre-existing profile: unchanged key set after a Slice D write",
   eq(keys(applyLabelToProfile(preExisting, "client", "Acme Boxes Ltd")), keys(preExisting)));

ok("pre-existing profile: a Slice D write then a manual edit is just another string write",
   (() => {
     const viaSliceD = applyLabelToProfile(preExisting, "client", "Acme Boxes Ltd");
     const thenTyped = { ...viaSliceD, client: "Acme Boxes Ltd (Nagpur unit)" };
     return thenTyped.client === "Acme Boxes Ltd (Nagpur unit)"
       && eq(keys(thenTyped), keys(preExisting));
   })());

ok("pre-existing profile: nothing in Slice D can distinguish a copied value from a typed one",
   applyLabelToProfile(PROFILE, "client", "Acme").client
     === ({ ...PROFILE, client: "Acme" }).client);

ok("round-trip: a Slice D profile survives JSON persistence with no new keys",
   (() => {
     const after = applyLabelToProfile(preExisting, "client", "Acme Boxes Ltd");
     const round = JSON.parse(JSON.stringify(after));
     return eq(keys(round), keys(preExisting))
       && round.client === "Acme Boxes Ltd"
       && round.delivery === preExisting.delivery;
   })());

// ── explicit confirmation ─────────────────────────────────────────────────

const confirmMsg = copyToBatchConfirmMessage("client", "Acme Boxes Ltd", "Old Name Ltd");
ok("confirm: names the field", confirmMsg.includes("Client"));
ok("confirm: quotes the exact text that will be written", confirmMsg.includes('"Acme Boxes Ltd"'));
ok("confirm: quotes the text being replaced", confirmMsg.includes('"Old Name Ltd"'));
ok("confirm: says plainly that no link is stored", /no link .* is stored/i.test(confirmMsg));
ok("confirm: says the value stays editable by hand", /edit or clear it by hand/i.test(confirmMsg));

const confirmBlank = copyToBatchConfirmMessage("client", "Acme Boxes Ltd", "");
ok("confirm: with no current text, does not claim to replace anything",
   !/replaces/i.test(confirmBlank) && confirmBlank.includes("Client"));
ok("confirm: whitespace-only current text is treated as no current text",
   !/replaces/i.test(copyToBatchConfirmMessage("client", "Acme", "   ")));

ok("field titles: Client reads as its UI label, and Delivery is not a title this slice owns",
   fieldTitle("client") === "Client" && fieldTitle("delivery") === "delivery");

// Cancel after a real create: the governed row exists and saying nothing
// would let the user believe Cancel undid it.
const cancelMsg = createdButNotCopiedMessage("Client", "Acme Boxes Ltd");
ok("cancel copy: states the governed record still exists",
   /still there/i.test(cancelMsg) && cancelMsg.includes("Acme Boxes Ltd"));
ok("cancel copy: states the Batch text was left unchanged",
   /left unchanged/i.test(cancelMsg));

// ── capability distinction — create and browse are NOT the same authority ──

const maker = { group_capabilities: [], plant_capabilities: { NAG: ["make_quote"] } };
const master = { group_capabilities: ["read_party_master", "manage_customer_master"], plant_capabilities: {} };
const reader = { group_capabilities: ["read_party_master"], plant_capabilities: {} };
const nobody = { group_capabilities: [], plant_capabilities: {} };

ok("capability: a make_quote-only Maker CAN quick-create",
   quickPickAbilities(maker).canCreate === true);
ok("capability: a make_quote-only Maker CANNOT browse existing master rows",
   quickPickAbilities(maker).canBrowse === false);
ok("capability: the fully authorised persona can do both",
   quickPickAbilities(master).canCreate === true && quickPickAbilities(master).canBrowse === true);
ok("capability: read_party_master alone browses but does not create",
   quickPickAbilities(reader).canBrowse === true && quickPickAbilities(reader).canCreate === false);
ok("capability: neither capability means neither ability — deny by default",
   quickPickAbilities(nobody).canCreate === false && quickPickAbilities(nobody).canBrowse === false);
ok("capability: an absent or malformed profile is a denial, not a guess",
   quickPickAbilities(null).canCreate === false && quickPickAbilities(null).canBrowse === false
   && quickPickAbilities({}).canCreate === false && quickPickAbilities({}).canBrowse === false);
ok("capability: the create condition mirrors the DB's own OR, not a narrower invention",
   eq(CREATE_CAPS, ["manage_customer_master", "make_quote"]));
ok("capability: browsing is gated on the group capability the GET route checks",
   BROWSE_CAP === "read_party_master");

// ── Customer Location: created in the Customer Master, LINKED TO NOTHING ───
//
// The retained convenience. These checks exist to prove a negative: the create
// path cannot reach `delivery`, cannot reach any other Batch field, and leaves
// no selected-Location state for anything to consume later.

const SEEDED = Object.freeze({ ...PROFILE, client: "Bharat Foods (typed by hand)",
  delivery: "Nagpur", plant: "NAG", freightOverride: "" });

ok("location create: the request body carries no Batch field and no Batch reference",
   (() => {
     const body = proposeLocationBody({ locationType: "factory", addressText: "12 Kalamna Rd",
       billToEligible: false, shipToEligible: true });
     return ["client", "delivery", "freight", "freightOverride", "plant", "batch",
             "batchProfile", "sector"].every(k => !(k in body));
   })());

ok("location create: proposing a Location cannot change `delivery` — it is not writable at all",
   applyLabelToProfile(SEEDED, "delivery",
     locationLabel({ id: 9, location_code: null }, { address_text: "12 Kalamna Rd" })) === SEEDED);

ok("location create: the freight destination and freight override are untouched",
   (() => {
     const lbl = locationLabel({ id: 9 }, { address_text: "12 Kalamna Rd" });
     const after = applyLabelToProfile(SEEDED, "delivery", lbl);
     return after.delivery === "Nagpur" && after.freightOverride === ""
       && after.plant === "NAG";
   })());

ok("location create: NO Batch field of any kind can be reached with a Location label",
   (() => {
     const lbl = locationLabel({ id: 9 }, { address_text: "12 Kalamna Rd" });
     return Object.keys(SEEDED).every(f => {
       const after = applyLabelToProfile(SEEDED, f, lbl);
       // client/sector/plant are the only legitimate targets, and a Location
       // label is never offered to them by the UI — but even there, delivery
       // and the key set do not move.
       if (BATCH_TEXT_FIELDS.includes(f)) return after.delivery === SEEDED.delivery
         && eq(keys(after), keys(SEEDED));
       return after === SEEDED;
     });
   })());

ok("location create: a Location label written to `client` still leaves the key set unchanged",
   eq(keys(applyLabelToProfile(SEEDED, "client", "12 Kalamna Rd")), keys(SEEDED)));

const notLinked = locationCreatedNotLinkedMessage("12 Kalamna Rd", "Acme Boxes Ltd");
ok("location copy: names the Location and its owning Party",
   notLinked.includes("12 Kalamna Rd") && notLinked.includes("Acme Boxes Ltd"));
ok("location copy: says it was created in the Customer Master",
   /Customer Master/i.test(notLinked));
ok("location copy: states plainly that it is NOT linked to this Batch",
   /NOT linked to this Batch/i.test(notLinked));
ok("location copy: names Delivery and freight as unchanged, rather than staying vague",
   /Delivery, freight and every other Batch field are unchanged/i.test(notLinked));
ok("location copy: does not claim Delivery was set",
   !/Delivery (?:is |was |has been )?set/i.test(notLinked));

const notice = locationNotLinkedNotice();
ok("location notice: warns BEFORE the create, not only after",
   /does not set/i.test(notice) && /does not affect freight/i.test(notice));
ok("location notice: says Delivery remains a freight destination",
   /freight destination/i.test(notice));
ok("location notice: points forward to Delivery Groups rather than implying a gap",
   /Delivery Groups/i.test(notice));

// ── the removed freight-disclosure helpers must stay removed ───────────────
//
// The first pass shipped deliveryLabelIsOffFreightMatrix()/deliveryFreight-
// Warning(), which existed ONLY to disclose the zero-rate consequence of
// writing a Location into `delivery`. With that write gone they have no honest
// purpose, and their return would signal the unsafe path had been reinstated.

ok("no delivery/freight write helper survives in the module's exports",
   !("deliveryLabelIsOffFreightMatrix" in QC) && !("deliveryFreightWarning" in QC));

ok("no exported helper names `delivery` as something this slice writes",
   Object.keys(QC).every(k => !/^delivery/i.test(k)));

// ═══════════════════════════════════════════════════════════════════════════
// CORRECTION 2 — Product Owner ruling, 2026-09-08: `client` is a GOVERNED
// SELECTION, not unrestricted free text.
//
// Free text is the starting point for creating a client that does not exist;
// thereafter the control is a searchable Customer/Prospect Master dropdown.
// What is STORED is unchanged — one plain display_name string, the temporary
// U1 representation of that selection. It is not a foreign key and these
// fixtures assert, repeatedly, that nothing pretends it is one.
// ═══════════════════════════════════════════════════════════════════════════

const PARTIES = [
  { id: 1, display_name: "Acme Boxes Ltd", lifecycle_state: "customer",
    customer_code: "C-0007", status: "active" },
  { id: 2, display_name: "Acme Boxes Private Limited", lifecycle_state: "prospect",
    customer_code: null, status: "active" },
  { id: 3, display_name: "Zenith Foods", lifecycle_state: "prospect",
    customer_code: null, status: "active" },
  { id: 4, display_name: "Nagpur Distillers", lifecycle_state: "customer",
    customer_code: "G0080-001", status: "active" },
  { id: 5, display_name: "Nagpur Distillers", lifecycle_state: "prospect",
    customer_code: null, status: "active" },   // a deliberate duplicate NAME
];
const FAMILIES = [{ id: 10, name: "Acme Group" }, { id: 11, name: "Zenith Group" }];
const MEMBERSHIPS = [
  { party_id: 1, family_id: 10, is_current: true },
  { party_id: 2, family_id: 10, is_current: false },  // history, must not show
  { party_id: 3, family_id: 11, is_current: true },
];

// ── normalisation: spelling variations must not read as different customers ─

ok("normalize: case, punctuation and legal suffixes fold together",
   normalizeForMatch("Acme Boxes Pvt. Ltd.") === normalizeForMatch("acme boxes private limited"));
ok("normalize: genuinely different names do NOT fold together",
   normalizeForMatch("Acme Boxes") !== normalizeForMatch("Zenith Foods"));
ok("normalize: an empty or absent value is the empty string, never a crash",
   normalizeForMatch(null) === "" && normalizeForMatch(undefined) === ""
   && normalizeForMatch("   ") === "");

ok("score: an exact normalised match scores 1",
   matchScore("Acme Boxes Ltd", "acme boxes limited") === 1);
ok("score: unrelated names score below the threshold",
   matchScore("Zenith Foods", "Acme Boxes Ltd") < MATCH_THRESHOLD);

// ── the duplicate guard (ruling item 6) ───────────────────────────────────

ok("duplicates: a spelling variation surfaces the existing records BEFORE creation",
   (() => {
     const m = likelyMatches("Acme Boxs Pvt Ltd", PARTIES);
     return m.length >= 2 && m.slice(0, 2).every(x => x.party.display_name.startsWith("Acme Boxes"));
   })());

ok("duplicates: matches are ranked, best first",
   (() => {
     const m = likelyMatches("Acme Boxes Ltd", PARTIES);
     return m.length > 0 && m[0].party.id === 1 && m[0].score >= m[m.length - 1].score;
   })());

ok("duplicates: an unrelated name surfaces nothing to confuse the user",
   likelyMatches("Kolkata Paper Mills", PARTIES).length === 0);

ok("duplicates: empty text and a missing party list are both safe",
   likelyMatches("", PARTIES).length === 0 && likelyMatches("Acme", null).length === 0);

ok("create confirm: names the record, and says how many similar ones exist",
   (() => {
     const msg = createProspectConfirmMessage("Acme Boxs", 2);
     return msg.includes('"Acme Boxs"') && /2 similar records already exist/i.test(msg);
   })());
ok("create confirm: with no similar records, it does not invent a duplicate warning",
   !/similar/i.test(createProspectConfirmMessage("Brand New Ltd", 0)));
ok("create confirm: states this creates a PROSPECT and that graduating is separate",
   (() => {
     const msg = createProspectConfirmMessage("Brand New Ltd", 0);
     return /as a new Prospect/i.test(msg) && /graduating it to a Customer/i.test(msg)
       && /separate action/i.test(msg);
   })());

// ── identity from text: usability, never proof (ruling items 7 and 8) ─────

ok("identity: exactly one governed record with that name reads as 'one'",
   (() => {
     const r = identityFromText("Zenith Foods", PARTIES);
     return r.kind === "one" && r.exact.length === 1 && r.exact[0].id === 3;
   })());

// This is the conservative behaviour, deliberately pinned. "Acme Boxes Ltd"
// and "Acme Boxes Private Limited" are two DIFFERENT governed rows whose names
// normalise identically once the legal suffix is folded. The control must not
// pick one — it reports AMBIGUOUS and asks the user to select, which is the
// whole point of refusing to assert identity from text.
ok("identity: two rows differing only by legal suffix are AMBIGUOUS, never auto-resolved",
   (() => {
     const r = identityFromText("Acme Boxes Ltd", PARTIES);
     return r.kind === "ambiguous" && r.exact.length === 2
       && r.exact.map(p => p.id).sort().join(",") === "1,2";
   })());

ok("identity: TWO records sharing a name is AMBIGUOUS — text cannot choose",
   (() => {
     const r = identityFromText("Nagpur Distillers", PARTIES);
     return r.kind === "ambiguous" && r.exact.length === 2;
   })());

ok("identity: a near miss reads as 'possible', not as a match",
   identityFromText("Acme Boxs", PARTIES).kind === "possible");

ok("identity: text resembling nothing reads as 'unmatched'",
   identityFromText("Kolkata Paper Mills", PARTIES).kind === "unmatched");

ok("identity: blank text is unmatched, and never claims a record",
   identityFromText("", PARTIES).kind === "unmatched"
   && identityFromText("   ", PARTIES).exact.length === 0);

ok("identity: with no master list loaded, nothing is asserted",
   identityFromText("Acme Boxes Ltd", []).kind === "unmatched"
   && identityFromText("Acme Boxes Ltd", null).kind === "unmatched");

ok("identity: the result carries NO partyId or id claim — it returns rows, not an identity",
   (() => {
     const r = identityFromText("Acme Boxes Ltd", PARTIES);
     return !("partyId" in r) && !("party_id" in r) && !("id" in r)
       && Array.isArray(r.exact) && Array.isArray(r.matches);
   })());

// The caveat wording is the promise this slice makes to the user. If it ever
// starts asserting identity, these fail.
ok("caveat 'one': says likely match and stores the NAME only — never a link",
   (() => {
     const c = identityCaveat("one");
     return /likely match/i.test(c) && /not a stored link/i.test(c)
       && !/\bis the\b.*\brecord\b/i.test(c);
   })());
ok("caveat 'ambiguous': says the text cannot say which, and asks for a selection",
   (() => {
     const c = identityCaveat("ambiguous", 2);
     return c.includes("2") && /cannot say which/i.test(c) && /Select/i.test(c);
   })());
ok("caveat 'possible': offers select-or-create rather than assuming",
   /select one, or create/i.test(identityCaveat("possible")));
ok("caveat 'unmatched': says plainly it is not a Customer Master record",
   /Not a Customer Master record/i.test(identityCaveat("unmatched")));
ok("caveat: no wording anywhere claims the Batch stores a link or a key",
   ["one", "ambiguous", "possible", "unmatched"]
     .every(k => !/foreign key|linked to|stores a link|is linked/i.test(identityCaveat(k, 2))));

// ── result rows carry enough to tell records apart (ruling item 3) ─────────

const famOf = familyNameByPartyId(MEMBERSHIPS, FAMILIES);

ok("row: a Customer shows its name, lifecycle, Customer Code and Family",
   (() => {
     const p = partyOptionParts(PARTIES[0], famOf[1]);
     return p.name === "Acme Boxes Ltd" && p.lifecycle === "Customer"
       && p.code === "C-0007" && p.family === "Acme Group";
   })());

ok("row: a Prospect shows no Customer Code rather than an empty string",
   partyOptionParts(PARTIES[1], famOf[2]).code === null);

ok("row: family context comes from the CURRENT membership only — history is not shown",
   famOf[2] === undefined && famOf[1] === "Acme Group");

ok("row: an inactive party is flagged so it cannot be picked unknowingly",
   partyOptionParts({ display_name: "X", status: "inactive" }).inactive === true);

ok("row: lifecycle falls back sensibly when the field is absent",
   partyLifecycleLabel({ customer_code: "C-1" }) === "Customer"
   && partyLifecycleLabel({}) === "Prospect");

// ── the create path, and the gap it refuses to simulate ───────────────────

// The create surface is proven by what the module OFFERS, not by a constant
// asserting what it does not. There is one create body and it is the Prospect
// one; nothing here can mint a Customer Code.
ok("create path: the only create body this control sends is the Prospect one",
   eq(createProspectBody("Brand New Ltd", null), { display_name: "Brand New Ltd" }));

ok("create path: the create body carries no lifecycle or customer_code claim",
   (() => {
     const b = createProspectBody("Brand New Ltd", null);
     return !("lifecycle_state" in b) && !("customer_code" in b) && !("graduate" in b);
   })());

ok("create path: the module exposes NO graduate/customer-create helper at all — "
   + "minting a permanent Customer Code is a Customer Master action, not a Batch one",
   Object.keys(QC).every(k => !/graduate|createCustomer|customerCreate/i.test(k)));

ok("create path: the confirm copy tells the user creation yields a Prospect and that "
   + "graduation is separate, which is where the boundary is actually communicated",
   (() => {
     const m = createProspectConfirmMessage("Brand New Ltd", 0);
     return /as a new Prospect/i.test(m) && /separate action in Customer Families/i.test(m);
   })());

// ── capability distinction (ruling: no fake dropdown, no false governance) ─

ok("capability notice: a non-browsing caller is told the text is NOT known to be governed",
   (() => {
     const n = cannotBrowseNotice();
     return /not known to be a governed record/i.test(n) && /read_party_master/.test(n);
   })());
ok("capability notice: it still offers the create path that caller DOES hold",
   /create it as a new Prospect/i.test(cannotBrowseNotice()));
ok("capability notice: it never claims a dropdown or a match is available",
   !/dropdown|matches|select an existing record below/i.test(cannotBrowseNotice()));

// ── the storage boundary, restated against the new control ────────────────

ok("storage: selecting a governed record writes the display_name ONLY",
   partyLabel(PARTIES[0]) === "Acme Boxes Ltd");

ok("storage: the written label never embeds the Customer Code or lifecycle",
   (() => {
     const l = partyLabel(PARTIES[0]);
     return !l.includes("C-0007") && !/customer/i.test(l);
   })());

ok("storage: a selection writes to `client` and adds no identity field",
   (() => {
     const before = { ...PROFILE, client: "old" };
     const after = applyLabelToProfile(before, "client", partyLabel(PARTIES[0]));
     return after.client === "Acme Boxes Ltd"
       && eq(keys(after), keys(before))
       && ["partyId", "party_id", "clientPartyId", "clientLink", "partyRef", "governedId"]
            .every(k => !(k in after));
   })());

ok("storage: `delivery` remains unwritable by the Client control",
   applyLabelToProfile(PROFILE, "delivery", "Acme Boxes Ltd") === PROFILE);

ok("storage: two records sharing a name produce the SAME string — which is exactly why "
   + "the string is not an identity, and why U4 must resolve it",
   partyLabel(PARTIES[3]) === partyLabel(PARTIES[4]));

console.log();
console.log(fails === 0 ? "all checks pass" : `${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
