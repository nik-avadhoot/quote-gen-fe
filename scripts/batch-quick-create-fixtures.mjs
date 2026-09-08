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
// ═══════════════════════════════════════════════════════════════════════════
import {
  BATCH_TEXT_FIELDS, BROWSE_CAP, CREATE_CAPS, applyLabelToProfile,
  copyToBatchConfirmMessage, createProspectBody, createdButNotCopiedMessage,
  deliveryFreightWarning, deliveryLabelIsOffFreightMatrix, fieldTitle,
  locationLabel, partyLabel, proposeLocationBody, quickPickAbilities,
} from "../src/lib/batchQuickCreate.js";

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

ok("apply: writing `delivery` touches only `delivery`",
   (() => {
     const after = applyLabelToProfile(PROFILE, "delivery", "12 Kalamna Rd");
     return after.delivery === "12 Kalamna Rd" && after.client === PROFILE.client
       && eq(keys(after), keys(PROFILE));
   })());

ok("apply: the input profile is not mutated — a new object is returned",
   PROFILE.client === "" && afterClient !== PROFILE);

ok("apply: a field outside the two permitted ones is refused, profile returned untouched",
   applyLabelToProfile(PROFILE, "sector", "Acme") === PROFILE
   && applyLabelToProfile(PROFILE, "plant", "NAG") === PROFILE
   && applyLabelToProfile(PROFILE, "margin", "99") === PROFILE);

ok("apply: only the two free-text fields are permitted at all",
   eq(BATCH_TEXT_FIELDS, ["client", "delivery"]));

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
     const after = applyLabelToProfile(preExisting, "delivery", "12 Kalamna Rd");
     const round = JSON.parse(JSON.stringify(after));
     return eq(keys(round), keys(preExisting)) && round.delivery === "12 Kalamna Rd";
   })());

// ── explicit confirmation ─────────────────────────────────────────────────

const confirmMsg = copyToBatchConfirmMessage("client", "Acme Boxes Ltd", "Old Name Ltd");
ok("confirm: names the field", confirmMsg.includes("Client"));
ok("confirm: quotes the exact text that will be written", confirmMsg.includes('"Acme Boxes Ltd"'));
ok("confirm: quotes the text being replaced", confirmMsg.includes('"Old Name Ltd"'));
ok("confirm: says plainly that no link is stored", /no link .* is stored/i.test(confirmMsg));
ok("confirm: says the value stays editable by hand", /edit or clear it by hand/i.test(confirmMsg));

const confirmBlank = copyToBatchConfirmMessage("delivery", "12 Kalamna Rd", "");
ok("confirm: with no current text, does not claim to replace anything",
   !/replaces/i.test(confirmBlank) && confirmBlank.includes("Delivery"));
ok("confirm: whitespace-only current text is treated as no current text",
   !/replaces/i.test(copyToBatchConfirmMessage("client", "Acme", "   ")));

ok("field titles: the two fields read as their UI labels",
   fieldTitle("client") === "Client" && fieldTitle("delivery") === "Delivery");

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

// ── freight disclosure — a real consequence of writing a Location name into
//    `delivery`, which BatchProfileBar reads as a freight matrix key ────────

const FREIGHT_LOCS = ["Nagpur", "Pune", "Kolkata"];
ok("freight: a governed Location label is off the freight master",
   deliveryLabelIsOffFreightMatrix("12 Kalamna Rd", FREIGHT_LOCS) === true);
ok("freight: an ordinary freight destination is not flagged",
   deliveryLabelIsOffFreightMatrix("Nagpur", FREIGHT_LOCS) === false);
ok("freight: an empty Delivery is not flagged — there is nothing to warn about",
   deliveryLabelIsOffFreightMatrix("", FREIGHT_LOCS) === false);
ok("freight: a missing master list does not crash and does not claim a match",
   deliveryLabelIsOffFreightMatrix("Nagpur", null) === true);
ok("freight warning: names the value and says the rate reads 0",
   (() => {
     const w = deliveryFreightWarning("12 Kalamna Rd");
     return w.includes("12 Kalamna Rd") && /read 0/i.test(w) && /by hand/i.test(w);
   })());

console.log();
console.log(fails === 0 ? "all checks pass" : `${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
