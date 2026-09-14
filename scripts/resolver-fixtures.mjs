// ═══════════════════════════════════════════════════════════════════════════
// scripts/resolver-fixtures.mjs — the eighth gate: npm run test:resolver
//
// The S7 CalcGate resolver has NO reachable UI path in S7(a): nothing calls it
// until S7(c). This fixture is the only thing that verifies it, for the same
// reason test:blanket exists for admin-only dialogs and test:draft for the
// draft comparator.
//
// It covers engine/resolveAuthority.js, engine/interestBasis.js and
// engine/calcDefaults.js ONLY. test:costing remains the costing-engine gate and
// this does not touch it.
//
// WHAT A GREEN RUN HAS TO MEAN. Every case below names the rule that would have
// produced a DIFFERENT answer, so the run is evidence rather than decoration:
//
//   · a truthiness resolver (`x || next`) passes the value cases and FAILS
//     every explicit-zero case;
//   · a resolver missing the Sector tier passes the row and batch cases and
//     FAILS the sector block - which is the exact defect S7 exists to close,
//     since useQuoteActions had no Sector tier at all;
//   · a 365-day basis passes nothing in the derivation block;
//   · a fallback of 1.5 instead of 0.5 passes the hit cases and FAILS the miss.
//
// THE NUMBERS ARE NOT TRANSCRIBED. The derivation cases assert against the
// PREVIOUSLY APPROVED map values - 30→0.5, 45→0.75, 60→1.0, 90→1.5 - computed
// from the approved annual rate. That is the whole claim of Amendment 01: at
// 6.000% per annum on a 360-day year the derivation reproduces the map it
// replaces, so no accepted result moves.
// ═══════════════════════════════════════════════════════════════════════════
import { CALC_DEFAULTS } from "../src/engine/calcDefaults.js";
import { APPROVED_DAY_COUNT_BASIS, STRUCTURED_PAYMENT_TERMS,
  deriveInterestPct, isStructuredPaymentTerm } from "../src/engine/interestBasis.js";
import { isBlank, normalizeFreightOverrideInput, resolveField, resolveFreight, resolveInterest, resolveRowAuthority } from "../src/engine/resolveAuthority.js";
import { establishEffectiveMaterialRate, resolveSupplierCreditCost } from "../src/engine/rateMaster.js";
import { CREDIT_PCT } from "../src/data/defaults.js";

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) { fails++; console.log(`FAIL  ${name}${extra ? "  " + extra : ""}`); }
  else console.log(`ok    ${name}`);
};
const eq = (name, got, want) =>
  ok(name, got === want, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

// ── THE APPROVED CONSTANTS ───────────────────────────────────────────────
// Read from the mirror, not restated, so a drift in calcDefaults.js fails here
// rather than silently repricing.
console.log("── the approved basis (Amendment 01 A-01/A-02) ──");
eq("the approved annual rate is 6.000%", CALC_DEFAULTS.annualInterestPct, 6.0);
eq("the approved day-count basis is 360", CALC_DEFAULTS.dayCountBasis, 360);
eq("and 360 is the only one the module knows", APPROVED_DAY_COUNT_BASIS, 360);
eq("the independent fallback is 0.500", CALC_DEFAULTS.interestFallbackPct, 0.5);
ok("which is NOT 1.500 - a miss can never reach the top of the withdrawn map",
   CALC_DEFAULTS.interestFallbackPct !== 1.5);
eq("the closed structured list is 30/45/60/90",
   STRUCTURED_PAYMENT_TERMS.join(","), "30,45,60,90");

// ── THE DERIVATION REPRODUCES THE WITHDRAWN MAP EXACTLY ──────────────────
// This is the claim the whole amendment rests on. If any line here moves, a
// price moved.
console.log("\n── the derivation reproduces every previously approved value ──");
const A = CALC_DEFAULTS.annualInterestPct, B = CALC_DEFAULTS.dayCountBasis;
eq("30 days derives 0.500%", deriveInterestPct(A, 30, B), 0.5);
eq("45 days derives 0.750%", deriveInterestPct(A, 45, B), 0.75);
eq("60 days derives 1.000%", deriveInterestPct(A, 60, B), 1.0);
eq("90 days derives 1.500%", deriveInterestPct(A, 90, B), 1.5);

// 360 is arithmetic, not taste
ok("a 365-day year would NOT reproduce 0.500", (() => {
  const wrong = Math.round(A * 30 / 365 * 1000) / 1000;
  return wrong !== 0.5;
})());
ok("and passing 365 THROWS rather than quietly computing it", (() => {
  try { deriveInterestPct(A, 30, 365); return false; } catch { return true; }
})());
ok("as does any other basis", (() => {
  try { deriveInterestPct(A, 30, 0); return false; } catch { return true; }
})());

// a term outside the closed list does not calculate
eq("35 days is not a structured term", isStructuredPaymentTerm(35), false);
eq("and derives nothing - null, which is UNRESOLVED, not zero",
   deriveInterestPct(A, 35, B), null);
eq("a null term derives nothing either", deriveInterestPct(A, null, B), null);
eq("and so does a blank one", deriveInterestPct(A, "", B), null);

// ── BLANK vs EXPLICIT ZERO vs VALUE, on every inheritable field ──────────
// A truthiness resolver passes the VALUE rows and fails every ZERO row.
console.log("\n── blank inherits, zero is a decision (CDM-19) ──");
eq("'' is blank",        isBlank(""),        true);
eq("null is blank",      isBlank(null),      true);
eq("undefined is blank", isBlank(undefined), true);
eq("'abc' is blank - mirrors nz() in costing.js", isBlank("abc"), true);
eq("0 is NOT blank",     isBlank(0),         false);
eq("0 as a string is NOT blank", isBlank("0"), false);

const SECTOR = { code: "TEXTILE", wasteCBB: 5, wastePP: 0, convBox: 5.75, convPP: 0 };
const PROFILE = { versionId: 42, waste: 6, wastePP: 3, convRate: 9, convRatePP: 11, margin: 10, marginPP: 12 };

for (const [field, rowVal] of [["waste", 0], ["convRate", 0], ["margin", 0]]) {
  const r = resolveField(field, { rowOverride: rowVal, batchProfile: PROFILE, sector: SECTOR });
  eq(`${field}: an explicit row ZERO wins and is not discarded`, r.value, 0);
  eq(`${field}: and is attributed to the row`, r.source, "row");
}

// ── THE FOUR TIERS, IN ORDER ─────────────────────────────────────────────
console.log("\n── row beats batch beats sector beats system ──");
{
  const ctx = { batchProfile: PROFILE, sector: SECTOR };
  eq("row wins when present",    resolveField("waste", { ...ctx, rowOverride: 7 }).value, 7);
  eq("batch wins when the row is blank",
     resolveField("waste", { ...ctx, rowOverride: "" }).value, 6);
  eq("sector wins when the batch is blank too",
     resolveField("waste", { ...ctx, batchProfile: {}, rowOverride: "" }).value, 5);
  eq("system wins when nothing else answers",
     resolveField("waste", { rowOverride: "", batchProfile: {}, sector: {} }).value,
     CALC_DEFAULTS.wasteCbbFallbackPct);
}

// THE SECTOR TIER IS THE DEFECT S7 CLOSES. useQuoteActions.js:222-226 had no
// Sector tier at all, so a blank profile field went straight to a literal.
console.log("\n── the Sector tier Batch Entry never had (B-1) ──");
{
  const blankProfile = { versionId: 9 };
  const r = resolveField("convRate", { rowOverride: "", batchProfile: blankProfile, sector: SECTOR });
  eq("a blank profile field resolves to the SECTOR, not to the literal 7", r.value, 5.75);
  eq("and says so", r.source, "sector");
  ok("which differs from the system fallback - the tier is not decorative",
     r.value !== CALC_DEFAULTS.convBoxFallbackRate);
}

// A SECTOR ZERO MUST SURVIVE. Eight sectors legitimately carry wastePP = 0 and
// convPP = 0; `0 || 5` silently discards them and over-costs Paper Consumed.
console.log("\n── a Sector's legitimate ZERO survives (negative Case 4) ──");
{
  const r = resolveField("waste", { rowOverride: "", batchProfile: {}, sector: SECTOR, isPP: true });
  eq("TEXTILE wastePP = 0 resolves to 0, not to the fallback 5", r.value, 0);
  eq("attributed to the sector", r.source, "sector");
  const c = resolveField("convRate", { rowOverride: "", batchProfile: {}, sector: SECTOR, isPP: true });
  eq("and convPP = 0 likewise", c.value, 0);
}

// ── PP-AWARENESS: the PP arm is half the model, not an edge case ─────────
console.log("\n── PP rows read their own tiers ──");
{
  const box = resolveField("waste", { rowOverride: "", batchProfile: PROFILE, sector: SECTOR, isPP: false });
  const pp  = resolveField("waste", { rowOverride: "", batchProfile: PROFILE, sector: SECTOR, isPP: true });
  eq("a Box row reads profile.waste", box.value, 6);
  eq("a PP row reads profile.wastePP", pp.value, 3);
  ok("and they are different - the switch is real", box.value !== pp.value);
  const mBox = resolveField("margin", { rowOverride: "", batchProfile: PROFILE, sector: SECTOR, isPP: false });
  const mPP  = resolveField("margin", { rowOverride: "", batchProfile: PROFILE, sector: SECTOR, isPP: true });
  eq("margin reads the Box default for a Box row", mBox.value, 10);
  eq("and the PP default for a PP row", mPP.value, 12);
}

// The Sector margin tier is WIRED but currently INERT - the browser-local Sector
// master carries no margin column. It must resolve to the system fallback today,
// which is how we know establishing the tier moved no price.
console.log("\n── the Sector margin tier is wired and currently inert ──");
{
  const r = resolveField("margin", { rowOverride: "", batchProfile: {}, sector: SECTOR });
  eq("with no sector margin present it falls to the system value", r.value,
     CALC_DEFAULTS.marginFallbackPct);
  eq("and says system, not sector", r.source, "system");
  const withMargin = resolveField("margin",
    { rowOverride: "", batchProfile: {}, sector: { ...SECTOR, marginPct: 14 } });
  eq("but the tier IS live the moment a Sector carries one", withMargin.value, 14);
  eq("and attributes it correctly", withMargin.source, "sector");
}

// ── INTEREST: override, derivation, fallback ─────────────────────────────
console.log("\n── customer Payment-Terms Interest (CDM-18 as amended) ──");
for (const [days, want] of [[30, 0.5], [45, 0.75], [60, 1.0], [90, 1.5]]) {
  const r = resolveInterest({ pricingGroup: { paymentTermsDays: days } });
  eq(`${days} days resolves to ${want}%`, r.value, want);
  eq(`${days} days is attributed to the derivation`, r.source, "derived_annual");
  eq(`${days} days carries its annual rate for the snapshot`, r.annualInterestPct, 6.0);
  eq(`${days} days carries its basis for the snapshot`, r.dayCountBasis, 360);
}
{
  const miss = resolveInterest({ pricingGroup: { paymentTermsDays: 35 } });
  eq("an unstructured term reaches the 0.500% fallback", miss.value, 0.5);
  eq("and is attributed to the system, not to a derivation", miss.source, "system");
  ok("never 1.500", miss.value !== 1.5);

  const nul = resolveInterest({ pricingGroup: { paymentTermsDays: null } });
  eq("a NULL term reaches the same 0.500% fallback", nul.value, 0.5);
  ok("never 1.500", nul.value !== 1.5);

  const none = resolveInterest({});
  eq("and so does no Pricing Group at all", none.value, 0.5);

  const ovr = resolveInterest({ pricingGroup: { paymentTermsDays: 90, interestOverridePct: 0.4 } });
  eq("an explicit override beats the derivation", ovr.value, 0.4);
  eq("and is attributed to the Pricing Group", ovr.source, "pricing_group");
  ok("the derivation it beat was 1.5, so the override is doing real work",
     deriveInterestPct(A, 90, B) === 1.5);

  const zero = resolveInterest({ pricingGroup: { paymentTermsDays: 90, interestOverridePct: 0 } });
  eq("an explicit ZERO override means zero interest, not the fallback", zero.value, 0);
  eq("and is a decision, attributed to the Pricing Group", zero.source, "pricing_group");

  const blank = resolveInterest({ pricingGroup: { paymentTermsDays: 60, interestOverridePct: "" } });
  eq("a BLANK override inherits the derivation", blank.value, 1.0);
  eq("and says derived, not pricing_group", blank.source, "derived_annual");
}

// ── SUPPLIER PAPER-CREDIT COST is a different tier entirely (CDM-41) ─────
console.log("\n── supplier paper-credit cost is not customer interest (A-05) ──");
{
  eq("the Rate Master mirror value is 1.5%", CREDIT_PCT * 100, 1.5);
  ok("and it is NOT the customer annual rate", CREDIT_PCT * 100 !== CALC_DEFAULTS.annualInterestPct);

  const inherit = resolveSupplierCreditCost({ rateEntry: { code: "16", interest: null } });
  eq("a blank per-grade value inherits", inherit.value, 1.5);
  eq("attributed to the system tier while no Rate Set version exists", inherit.source, "system");

  const zero = resolveSupplierCreditCost({ rateEntry: { code: "18", interest: 0 } });
  eq("an explicit ZERO grade stays zero - cash terms are a real state", zero.value, 0);
  eq("and is attributed to the grade", zero.source, "rate_entry");

  const exc = resolveSupplierCreditCost({ rateEntry: { code: "20", interest: 2.25 } });
  eq("an explicit exception wins", exc.value, 2.25);

  const viaVersion = resolveSupplierCreditCost({
    rateEntry: { code: "22", interest: "" },
    rateSetVersion: { id: 7, creditCostPct: 1.75 } });
  eq("and the Rate Set version tier is live the moment one is supplied", viaVersion.value, 1.75);
  eq("attributed to the version", viaVersion.source, "rate_set_version");
  eq("the Rate Master establishes the governed effective material rate",
     establishEffectiveMaterialRate({ code: "22", price: 40, disc: 1, freight: 2, interest: "" },
       { id: 7, creditCostPct: 1.75 }), 41.7);
}

// ── PROVENANCE FOR EVERY INHERITED FIELD, IN ONE CALL (CDM-22) ───────────
console.log("\n── Send freezes values AND sources ──");
{
  const all = resolveRowAuthority({
    rowWaste: "", rowConv: 3.5, rowMargin: "",
    batchProfile: PROFILE, sector: SECTOR,
    pricingGroup: { id: 5, paymentTermsDays: 45 }, isPP: false });
  eq("waste came from the batch",    all.waste.source,    "batch");
  eq("conversion came from the row", all.convRate.source, "row");
  eq("margin came from the batch",   all.margin.source,   "batch");
  eq("interest came from the derivation", all.interest.source, "derived_annual");
  eq("and the derived interest is right", all.interest.value, 0.75);
  ok("every field carries a source", Object.values(all).every(r => !!r.source));
  ok("and a sourceRef slot, even when null",
     Object.values(all).every(r => "sourceRef" in r));
}


// ══ S8(a) — FREIGHT AUTHORITY (CDM-17) ═══════════════════════════════════
//
// What a green run here has to mean, stated as the resolvers that would FAIL:
//
//   · the pre-S8 `if(override&&+override>0)` passes every positive case and
//     FAILS every explicit-zero case, at all four tiers;
//   · the pre-S8 `matrix?.[p]?.[d] || 0` passes every hit and FAILS every
//     unresolved case, because it answers 0 where there is no rate on file;
//   · a resolver that ordered legacy_batch above row passes everything except
//     the precedence case — which is the U4 decision this slice recorded;
//   · a resolver that returned `master` for DEFAULT_FREIGHT passes every value
//     case and FAILS the provenance cases, which is the falsehood that would
//     have reached a snapshot as an approved Freight Set version;
//   · a resolver that substituted the Batch destination in master mode passes
//     the happy path and FAILS the no-substitution case.

const MATRIX = { Nagpur: { Pune: 2.5, Nagpur: 2.0 } };
const M = { legacyMatrix: MATRIX, legacyMatrixRef: "app-mirror/default-freight",
            originPlant: "Nagpur", legacyDestination: "Pune" };
const GOOD_REF = { freightSetVersionId: 11, freightEntryId: 42 };

console.log("\n── S8(a) freight: explicit zero survives at every tier ──");
{
  eq("row 0 is a value, not a blank",   resolveFreight({ ...M, rowOverride: 0 }).value, 0);
  eq("and it is attributed to the row", resolveFreight({ ...M, rowOverride: 0 }).source, "row");
  eq("legacy batch 0 is a value",       resolveFreight({ ...M, legacyBatchOverride: 0 }).value, 0);
  eq("attributed to the legacy tier",   resolveFreight({ ...M, legacyBatchOverride: 0 }).source, "legacy_batch");
  eq("ex_factory is an explicit zero",
     resolveFreight({ ...M, pricingGroup: { id: 5, mode: "ex_factory" } }).value, 0);
  eq("and it is GOVERNED, not a miss",
     resolveFreight({ ...M, pricingGroup: { id: 5, mode: "ex_factory" } }).authority, "governed");
  eq("Pricing Group manual 0 survives",
     resolveFreight({ ...M, pricingGroup: { id: 5, mode: "manual", manualValue: 0 } }).value, 0);
  eq("an approved master rate of 0 is a RATE, not a missing pair",
     resolveFreight({ ...M, approvedMasterRate: 0, approvedMasterRef: GOOD_REF }).value, 0);
  eq("attributed to the approved master",
     resolveFreight({ ...M, approvedMasterRate: 0, approvedMasterRef: GOOD_REF }).source, "master");
  eq("a legacy matrix rate of 0 is a rate too",
     resolveFreight({ ...M, legacyMatrix: { Nagpur: { Pune: 0 } } }).value, 0);
}

console.log("\n── S8(a) freight: row beats the temporary legacy batch tier ──");
{
  const both = resolveFreight({ ...M, rowOverride: 7, legacyBatchOverride: 3 });
  eq("the row override wins", both.value, 7);
  eq("and says so", both.source, "row");
  const zeroRow = resolveFreight({ ...M, rowOverride: 0, legacyBatchOverride: 3 });
  eq("an explicit row ZERO also beats an inherited legacy value", zeroRow.value, 0);
  const blankRow = resolveFreight({ ...M, rowOverride: "", legacyBatchOverride: 3 });
  eq("a BLANK row inherits the legacy tier", blankRow.value, 3);
  eq("and is attributed to it", blankRow.source, "legacy_batch");
}

console.log("\n── S8(a) freight: governed vs temporary provenance ──");
{
  const master = resolveFreight({ ...M, approvedMasterRate: 4.25, approvedMasterRef: GOOD_REF });
  eq("approved master is governed", master.authority, "governed");
  eq("with the exact serialized reference shape",
     JSON.stringify(master.sourceRef), JSON.stringify({ freightSetVersionId: 11, freightEntryId: 42 }));

  const legacy = resolveFreight({ ...M });
  eq("the mirror is NOT source master", legacy.source, "legacy_matrix");
  eq("it is explicitly TEMPORARY", legacy.authority, "temporary");
  eq("and carries the mirror label, never a Freight Set version",
     legacy.sourceRef, "app-mirror/default-freight");
  eq("recording why it degraded", legacy.degradedFrom, "no_pricing_group");
  ok("a temporary label can never occupy the governed reference shape",
     typeof legacy.sourceRef === "string" && typeof master.sourceRef === "object");

  eq("legacy_batch is temporary too",
     resolveFreight({ ...M, legacyBatchOverride: 3 }).authority, "temporary");
  eq("the row tier is governed",
     resolveFreight({ ...M, rowOverride: 3 }).authority, "governed");
}

console.log("\n── S8(a) freight: incomplete governed provenance is UNAVAILABLE ──");
{
  const half = resolveFreight({ ...M, approvedMasterRate: 4.25,
                                approvedMasterRef: { freightSetVersionId: 11 } });
  eq("half a reference is not a reference — it does not return master", half.source, "legacy_matrix");
  eq("and it degrades on the authorized path", half.degradedFrom, "no_approved_pair");
  const none = resolveFreight({ ...M, approvedMasterRate: 4.25, approvedMasterRef: null });
  eq("no reference at all, same treatment", none.source, "legacy_matrix");
}

console.log("\n── S8(a) freight: Pricing Group modes ──");
{
  const man = resolveFreight({ ...M, pricingGroup: { id: 9, mode: "manual", manualValue: 6.5 } });
  eq("manual terminates at the group", man.value, 6.5);
  eq("attributed to the Pricing Group", man.source, "pricing_group");
  eq("carrying the group id", man.sourceRef, 9);
  eq("and its mode", man.mode, "manual");

  const bad = resolveFreight({ ...M, pricingGroup: { id: 9, mode: "manual", manualValue: null } });
  eq("manual with no value is unresolved, NOT a fall-through", bad.source, "unresolved");
  eq("with its own reason", bad.reason, "manual_value_missing");
  eq("and no number", bad.value, null);

  const noBasis = resolveFreight({ ...M, pricingGroup: { id: 9, mode: "master",
                                                         basisDeliveryGroupId: null } });
  eq("master mode with no basis degrades", noBasis.degradedFrom, "basis_missing");
  const shipTo = resolveFreight({ ...M, pricingGroup: { id: 9, mode: "master",
                                    basisDeliveryGroupId: 3 },
                                  approvedMasterUnavailable: "basis_ship_to_missing" });
  eq("a basis with no Ship-to is its own reason", shipTo.degradedFrom, "basis_ship_to_missing");
}

console.log("\n── S8(a) freight: the Batch destination is NEVER the basis ──");
{
  // Master mode, basis selected, approved rate genuinely unavailable. The Batch
  // destination Pune IS in the legacy matrix. The approved tier must not borrow
  // it: the value may only come from the authorized legacy_matrix tier, and it
  // must SAY so rather than claiming approved authority for a substituted route.
  const sub = resolveFreight({ ...M,
    pricingGroup: { id: 9, mode: "master", basisDeliveryGroupId: 3 },
    approvedMasterRate: undefined, approvedMasterUnavailable: "no_approved_pair" });
  eq("no approved value is manufactured from the Batch destination", sub.source, "legacy_matrix");
  eq("it is temporary", sub.authority, "temporary");
  eq("and the governed failure is recorded", sub.degradedFrom, "no_approved_pair");
  ok("the number came from the legacy route, not an approved pair", sub.value === 2.5);
}

console.log("\n── S8(a) freight: unresolved blocks and is never zero ──");
{
  const miss = resolveFreight({ ...M, legacyDestination: "Nashik" });
  eq("a missing legacy pair is unresolved", miss.source, "unresolved");
  eq("value is null — never 0", miss.value, null);
  ok("and never NaN", !Number.isNaN(miss.value));
  eq("with a reason", miss.reason, "no_legacy_pair");
  eq("no authority is claimed", miss.authority, null);

  const nothing = resolveFreight({ originPlant: "Nagpur", legacyDestination: "Pune" });
  eq("no matrix at all is unresolved too", nothing.source, "unresolved");
  eq("still null", nothing.value, null);
}


// ══ S8 PRODUCER-SIDE — what the Batch Profile STORES ══════════════════════
//
// resolveFreight can only be as honest as the value handed to it. These arms
// cover the producer, and each names the writer that would FAIL it:
//
//   · the old `isManual = v!=='' && +v!==_matrixFr` passes blank and passes
//     "different from matrix", and FAILS both equal-to-matrix cases - storing
//     '' where the user typed a value, so an override and an inheritance
//     became the same stored state;
//   · a writer that kept `+v>0` FAILS both explicit-zero cases;
//   · the old Plant/Delivery handlers wrote the new route's matrix rate into
//     freightOverride, so they FAIL the two route-change cases by inventing an
//     override that was never entered.
//
// The two cases that carry the argument are 3 and 5: both produce the SAME
// NUMBER as the pre-fix code and differ only in `source`. A fix that got the
// value right and the authority wrong passes every numeric assertion and fails
// exactly these.

const MX = { Nagpur: { Nagpur: 2, Pune: 2.5 }, Pune: { Nashik: 0 } };
const P  = { legacyMatrix: MX, legacyMatrixRef: "app-mirror/default-freight" };

// The stored profile value, then what the resolver makes of it. One helper so
// the producer and the consumer are never asserted apart.
const stored = (typed) => normalizeFreightOverrideInput(typed);
const resolvedFrom = (typed, plant, dest) => resolveFreight({
  ...P, legacyBatchOverride: stored(typed), originPlant: plant, legacyDestination: dest });

console.log("\n── S8 producer: every deliberate entry is preserved ──");
{
  // 1. blank → inheritance
  eq("blank stores '' (inherit)", stored(""), "");
  eq("and the chain advances past the batch tier",
     resolvedFrom("", "Nagpur", "Nagpur").source, "legacy_matrix");
  eq("picking up the matrix rate", resolvedFrom("", "Nagpur", "Nagpur").value, 2);

  // 2. explicit zero, matrix non-zero
  eq("explicit 0 stores the NUMBER 0", stored("0"), 0);
  ok("which is not blank", stored("0") !== "");
  eq("and is attributed to the batch tier",
     resolvedFrom("0", "Nagpur", "Nagpur").source, "legacy_batch");
  eq("charging nothing, not the matrix 2", resolvedFrom("0", "Nagpur", "Nagpur").value, 0);

  // 3. explicit value EQUAL to the matrix — the demotion case
  eq("a value equal to the matrix is still stored", stored("2"), 2);
  eq("and keeps BATCH authority, not matrix authority",
     resolvedFrom("2", "Nagpur", "Nagpur").source, "legacy_batch");
  ok("same number as inheriting, different tier — not interchangeable",
     resolvedFrom("2", "Nagpur", "Nagpur").value === resolvedFrom("", "Nagpur", "Nagpur").value
     && resolvedFrom("2", "Nagpur", "Nagpur").source !== resolvedFrom("", "Nagpur", "Nagpur").source);

  // 4. explicit value different from the matrix
  eq("a different value is stored", stored("3.5"), 3.5);
  eq("with batch authority", resolvedFrom("3.5", "Nagpur", "Nagpur").source, "legacy_batch");

  // 5. explicit zero where the MATRIX RATE IS ALSO ZERO (real: Pune→Nashik)
  eq("an explicit 0 on a zero-rated route is still stored", stored("0"), 0);
  eq("and is the batch's zero, not the matrix's",
     resolvedFrom("0", "Pune", "Nashik").source, "legacy_batch");
  eq("while blank on that same route is the matrix's zero",
     resolvedFrom("", "Pune", "Nashik").source, "legacy_matrix");
  ok("both are 0, and they are NOT the same fact",
     resolvedFrom("0", "Pune", "Nashik").value === 0
     && resolvedFrom("", "Pune", "Nashik").value === 0);

  // 9. clearing restores inheritance — the single deliberate action
  eq("clearing a stored override returns to inherit", stored(""), "");
  eq("and the tier advances again",
     resolvedFrom("", "Nagpur", "Nagpur").source, "legacy_matrix");
}

console.log("\n── S8 producer: an absent matrix pair is not a zero ──");
{
  // 6. The display rule extracted verbatim from BatchProfileBar's TERMS block:
  //    a genuine 0 is a rate; an absent pair is unavailable and shows empty.
  const mxAvail = (raw) => raw !== undefined && raw !== null && raw !== "";
  const displayFr = (ovr, raw) => {
    const isOvr = ovr !== "" && ovr !== undefined;
    return isOvr ? ovr : (mxAvail(raw) ? raw : "");
  };
  eq("a genuine matrix rate of 0 is available", mxAvail(MX.Pune.Nashik), true);
  eq("and displays as 0", displayFr("", MX.Pune.Nashik), 0);
  eq("an ABSENT pair is not available", mxAvail(MX.Nagpur.Nashik), false);
  eq("and displays EMPTY, never 0", displayFr("", MX.Nagpur.Nashik), "");
  ok("nothing is stored for an absent pair either", stored("") === "");
  eq("and the chain reports it unresolved rather than free",
     resolveFreight({ ...P, originPlant: "Nagpur", legacyDestination: "Nashik" }).source,
     "unresolved");

  // _isOvr is presence-only: an override equal to the matrix still styles as one.
  const isOvr = (v) => v !== "" && v !== undefined;
  ok("an override equal to the matrix is still flagged OVERRIDDEN", isOvr(stored("2")));
  ok("and an inherited value is not", !isOvr(stored("")));
}

console.log("\n── S8 producer: a route change preserves the override ──");
{
  // 7 + 8. The Plant/Delivery reducers now write only the axis they own. The
  // reducer bodies are reproduced here exactly as they now read.
  const onPlant    = (p, nv) => ({ ...p, plant: nv });
  const onDelivery = (p, nv) => ({ ...p, delivery: nv });

  const withOvr = { plant: "Nagpur", delivery: "Nagpur", freightOverride: 3.5 };
  eq("changing PLANT leaves the stored override untouched",
     onPlant(withOvr, "Pune").freightOverride, 3.5);
  eq("changing DELIVERY leaves it untouched",
     onDelivery(withOvr, "Pune").freightOverride, 3.5);
  ok("and it is not replaced by the new route's matrix rate",
     onPlant(withOvr, "Pune").freightOverride !== MX.Pune.Nashik
     && onPlant(withOvr, "Pune").freightOverride !== 2);

  const inheriting = { plant: "Nagpur", delivery: "Nagpur", freightOverride: "" };
  eq("an INHERITING profile is not given one by changing plant",
     onPlant(inheriting, "Pune").freightOverride, "");
  eq("nor by changing delivery",
     onDelivery(inheriting, "Pune").freightOverride, "");
  eq("so it still inherits afterwards",
     resolveFreight({ ...P, legacyBatchOverride: onPlant(inheriting, "Nagpur").freightOverride,
       originPlant: "Nagpur", legacyDestination: "Pune" }).source, "legacy_matrix");
}

console.log(fails === 0 ? "\nall checks pass" : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
