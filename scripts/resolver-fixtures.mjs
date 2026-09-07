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
import { isBlank, resolveField, resolveInterest, resolveRowAuthority,
  resolveSupplierCreditCost } from "../src/engine/resolveAuthority.js";
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
  eq("the versioned system value is 1.5%", CALC_DEFAULTS.supplierCreditCostPct, 1.5);
  ok("derived from CREDIT_PCT, not restated beside it",
     CALC_DEFAULTS.supplierCreditCostPct / 100 === CREDIT_PCT);
  ok("and it is NOT the customer annual rate",
     CALC_DEFAULTS.supplierCreditCostPct !== CALC_DEFAULTS.annualInterestPct);

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

console.log(fails === 0 ? "\nall checks pass" : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
