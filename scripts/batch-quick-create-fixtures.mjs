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
  BATCH_TEXT_FIELDS, BROWSE_CAP, CREATE_CAPS, applyLabelToProfile,
  copyToBatchConfirmMessage, createProspectBody, createdButNotCopiedMessage,
  fieldTitle, locationCreatedNotLinkedMessage, locationLabel,
  locationNotLinkedNotice, partyLabel, proposeLocationBody, quickPickAbilities,
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

ok("apply: every field outside `client` is refused, profile returned untouched",
   ["sector", "plant", "margin", "delivery", "freightOverride", "customerType",
    "priceContext", "interest", "paymentDisc"]
     .every(f => applyLabelToProfile(PROFILE, f, "anything") === PROFILE));

ok("apply: `client` is the ONLY writable field — `delivery` is not on the list",
   eq(BATCH_TEXT_FIELDS, ["client"]) && !BATCH_TEXT_FIELDS.includes("delivery"));

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
       // `client` is the one legitimate target, and a Location label would
       // never be offered to it by the UI — but even there, nothing else moves.
       if (f === "client") return after.delivery === SEEDED.delivery
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

console.log();
console.log(fails === 0 ? "all checks pass" : `${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
