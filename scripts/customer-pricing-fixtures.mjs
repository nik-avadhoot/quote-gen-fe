// ═══════════════════════════════════════════════════════════════════════════
// scripts/customer-pricing-fixtures.mjs — npm run test:customer-pricing
//
// Customer Pricing History P0.1, frontend proof. Same convention as the other
// *-fixtures.mjs: no DOM harness exists, so the testable surface is the pure
// model (lib/customerPricingModel.js) plus source-shape assertions for the
// rules that live nowhere else (no browser storage of business data, the
// Family Details entry point, the idempotency key on "add a round").
//
// Each request-body case names the exact key server.py's /masters/pricing-*
// routes read — a wrong key there is a silent 400, not a crash.
// ═══════════════════════════════════════════════════════════════════════════
import {
  applicableVersions, bfSetBody, divRateByMeasure, draftFromPriorAgreed, equivalentRate, formatRate, measureBody,
  mulRateByMeasure, nextCycleBody, overrideBody, parseBfSchedule, parseMeasure, priorAgreedFor, proposeNextPeriod,
  rateUnitLabel, reconcile, referencesBody, termBody, validateTermForm, termComponentInRoundUnit, bfFloorViolations,
  blankEventForm, comparisonBlockedReason, cycleBody, cycleLabel, defaultPeriodEnd, displayDate, eventBody, formatInr,
  formatPct, lineBody, mechanismBody, negotiationSummary, parseInr, parsePct, scopeDisplay, sobDisplay,
  toPaise, validateCycleForm, validateEventForm, validateLineForm, lineFormFromRecord, cycleFormFromRecord,
} from "../src/lib/customerPricingModel.js";
import * as L from "../src/lib/customerPricingLayout.js";
import { P03_FIXTURE_DATA } from "../src/lib/customerPricingFixture.js";
import { readFileSync } from "node:fs";

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) { fails++; console.log(`FAIL  ${name}${extra ? "  " + extra : ""}`); }
  else console.log(`ok    ${name}`);
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── exact INR parsing: blank ≠ zero, no silent rounding ───────────────────
ok("parse: blank stays blank (null), not zero", eq(parseInr(""), { ok: true, value: null }));
ok("parse: explicit 0 becomes \"0.00\"", parseInr("0").value === "0.00");
ok("parse: 95.5 becomes \"95.50\"", parseInr("95.5").value === "95.50");
ok("parse: ₹ and Indian grouping are accepted", parseInr("₹1,23,456.7").value === "123456.70");
ok("parse: leading zeros normalised", parseInr("007.10").value === "7.10");
ok("parse: a third decimal is REFUSED, never rounded", !parseInr("94.555").ok
  && /two decimal/.test(parseInr("94.555").error));
ok("parse: negative refused", !parseInr("-1").ok);
ok("parse: text refused", !parseInr("abc").ok);
ok("parse: required blank refused", !parseInr(" ", { required: true }).ok);
ok("parse: max enforced exactly", !parseInr("10000000000.00").ok && parseInr("9999999999.99").ok);
ok("pct: 0 allowed and kept as 0.00", parsePct("0").value === "0.00");
ok("pct: 100.01 refused", !parsePct("100.01").ok);
ok("pct: GST cannot be 0", !parsePct("0", { allowZero: false }).ok);
ok("paise: exact integer arithmetic", toPaise("0.10") + toPaise("0.20") === toPaise("0.30"));

// ── display ────────────────────────────────────────────────────────────────
ok("format: two decimals always", formatInr("95.5") === "₹95.50" && formatInr("0.00") === "₹0.00");
ok("format: blank shows a dash, never ₹0.00", formatInr(null) === "—" && formatInr("") === "—");
ok("format: Indian grouping", formatInr("1234567.8") === "₹12,34,567.80");
ok("format: pct", formatPct("0.00") === "0.00%" && formatPct(null) === "—");

// ── Cycle labels for every frequency and FY boundary ──────────────────────
const cyc = (review_frequency, period_start, period_end, extra = {}) =>
  ({ review_frequency, period_start, period_end, ...extra });
const LABELS = [
  [cyc("monthly", "2026-09-01", "2026-09-30"), "financial_year", "Sep 2026"],
  [cyc("bimonthly", "2026-09-01", "2026-10-31"), "financial_year", "Sep-Oct 2026"],
  [cyc("bimonthly", "2026-12-01", "2027-01-31"), "financial_year", "Dec 2026-Jan 2027"],
  [cyc("quarterly", "2026-10-01", "2026-12-31"), "financial_year", "Q3 2026-27"],
  [cyc("quarterly", "2027-01-01", "2027-03-31"), "financial_year", "Q4 2026-27"],
  [cyc("quarterly", "2026-04-01", "2026-06-30"), "financial_year", "Q1 2026-27"],
  [cyc("quarterly", "2026-10-01", "2026-12-31"), "calendar_year", "Q4 2026"],
  [cyc("half_yearly", "2026-04-01", "2026-09-30"), "financial_year", "H1 2026-27"],
  [cyc("half_yearly", "2026-10-01", "2027-03-31"), "financial_year", "H2 2026-27"],
  [cyc("half_yearly", "2026-01-01", "2026-06-30"), "calendar_year", "H1 2026"],
  [cyc("annual", "2026-04-01", "2027-03-31"), "financial_year", "FY 2026-27"],
  [cyc("annual", "2027-03-01", "2028-02-29"), "financial_year", "FY 2026-27"],
  [cyc("annual", "2026-01-01", "2026-12-31"), "calendar_year", "2026"],
  [cyc("ad_hoc", "2026-09-10", "2026-11-20"), "financial_year", "2026-09-10 – 2026-11-20"],
  [cyc("monthly", "2026-09-01", "2026-09-30", { custom_label: "Diwali rate" }), "financial_year", "Diwali rate"],
];
for (const [c, style, want] of LABELS) {
  const got = cycleLabel(c, style);
  ok(`label: ${c.review_frequency} ${c.period_start} (${style}) -> ${want}`, got === want, `got ${got}`);
}
ok("period end: monthly", defaultPeriodEnd("monthly", "2026-02-01") === "2026-02-28");
ok("period end: quarterly", defaultPeriodEnd("quarterly", "2026-10-01") === "2026-12-31");
ok("period end: annual across leap year", defaultPeriodEnd("annual", "2027-03-01") === "2028-02-29");
ok("period end: ad hoc keeps the start", defaultPeriodEnd("ad_hoc", "2026-09-10") === "2026-09-10");

// ── negotiation summary: first offer, latest counter, latest agreement ────
const events = [
  { id: 5, event_type: "final_agreement", event_date: "2026-08-30", sequence_no: 5, rate_inr: "95.25" },
  { id: 4, event_type: "customer_counter", event_date: "2026-08-28", sequence_no: 4, rate_inr: "94.00" },
  { id: 1, event_type: "avadhoot_offer", event_date: "2026-08-25", sequence_no: 1, rate_inr: "100.00" },
  { id: 3, event_type: "avadhoot_offer", event_date: "2026-08-28", sequence_no: 3, rate_inr: "97.00" },
  { id: 2, event_type: "customer_counter", event_date: "2026-08-27", sequence_no: 2, rate_inr: "90.50" },
  { id: 6, event_type: "customer_counter", event_date: "2026-09-02", sequence_no: 6, rate_inr: "1.00", status: "voided" },
];
const s = negotiationSummary(events);
ok("summary: Our offer is the FIRST Avadhoot offer", s.ourOffer.id === 1 && s.ourOffer.rate_inr === "100.00");
ok("summary: Customer offer is the LATEST counter (same-date tie broken by sequence)", s.customerOffer.id === 4);
ok("summary: Final agreed is the latest agreement", s.finalAgreed.id === 5);
ok("summary: voided rounds never become the current position", s.rounds === 5);
const s0 = negotiationSummary([]);
ok("summary: no rounds -> nothing claimed", s0.ourOffer === null && s0.customerOffer === null && s0.finalAgreed === null);
const zero = negotiationSummary([{ id: 9, event_type: "avadhoot_offer", event_date: "2026-09-01", sequence_no: 1, rate_inr: "0.00" }]);
ok("summary: a 0.00 offer is an offer, and renders ₹0.00", zero.ourOffer && formatInr(zero.ourOffer.rate_inr) === "₹0.00");

// ── display-date modes before/after agreement ─────────────────────────────
const cycle = { initiated_on: "2026-08-20", period_start: "2026-09-01", period_end: "2026-09-30" };
const before = [{ events: events.filter(e => e.event_type !== "final_agreement") }];
const after = [{ events }];
ok("date: default is initiation date until agreed", displayDate(cycle, before) === "2026-08-20");
ok("date: default is agreement date once agreed", displayDate(cycle, after) === "2026-08-30");
ok("date: latest activity ignores voided rounds", displayDate(cycle, after, "latest_activity") === "2026-08-30");
ok("date: period start / end modes", displayDate(cycle, after, "period_start") === "2026-09-01"
  && displayDate(cycle, after, "period_end") === "2026-09-30");
ok("date: agreement mode before agreement is blank, not the initiation date",
  displayDate(cycle, before, "agreement") === null);

// ── SOB: undefined vs 0% vs not captured vs not applicable ───────────────
ok("sob: percentage 0.00 shows 0.00%", sobDisplay({ sob_state: "percentage", sob_pct: "0.00" }) === "0.00%");
ok("sob: undefined is named, not 0%", sobDisplay({ sob_state: "undefined", sob_pct: null }) === "Customer left undefined");
ok("sob: not captured is named", sobDisplay({ sob_state: "not_captured" }) === "Not yet captured");
ok("sob: not applicable is named", sobDisplay({ sob_state: "not_applicable" }) === "Not applicable");
ok("sob form: percentage requires a %", !validateLineForm({ sob_state: "percentage", sob_pct: "" }).ok);
ok("sob form: percentage 0 is valid and normalised", validateLineForm({ sob_state: "percentage", sob_pct: "0" }).normalised.sob_pct === "0.00");
ok("sob body: a % is never sent unless percentage",
  lineBody({ sob_state: "undefined", sob_pct: "10" }).sob_pct === null);

// ── rate/weight basis comparison gate ─────────────────────────────────────
ok("basis: per-kg without weight basis disables comparison",
  /disabled/.test(comparisonBlockedReason({ rate_basis: "box_per_kg", weight_basis: null })));
ok("basis: per-piece needs no weight basis", comparisonBlockedReason({ rate_basis: "box_per_piece" }) === null);
ok("basis: uncaptured rate basis says so", /not yet captured/i.test(comparisonBlockedReason({ rate_basis: null })));

// ── request bodies: exact keys ────────────────────────────────────────────
ok("body: mechanism create sends expected_content_version null",
  mechanismBody({ review_frequency: "monthly", rate_basis: "" }, undefined).expected_content_version === null
  && mechanismBody({ review_frequency: "monthly", rate_basis: "" }).rate_basis === null);
ok("body: mechanism update carries the version read", mechanismBody({ review_frequency: "monthly" }, 3).expected_content_version === 3);
const cb = cycleBody({ period_start: "2026-10-01", period_end: "2026-10-31", initiated_on: "2026-09-25" });
ok("body: create cycle has no CAS key", !("expected_content_version" in cb) && cb.period_start === "2026-10-01");
ok("body: update cycle carries CAS", cycleBody({ period_start: "a", period_end: "b", initiated_on: "c" }, 2).expected_content_version === 2);
const eb = eventBody({ event_type: "customer_counter", event_date: "2026-08-31", rate_inr: "0.00",
  tax_treatment: "excluding_gst", gst_pct: "18" }, { clientRequestId: "k" });
ok("body: add round sends money as a string, zero kept", eb.rate_inr === "0.00" && typeof eb.rate_inr === "string");
ok("body: GST % is dropped for an ex-GST round", eb.gst_pct === null);
ok("body: add round carries the idempotency key and no CAS", eb.client_request_id === "k" && !("expected_content_version" in eb));
ok("body: correction carries CAS", eventBody({ event_type: "x", rate_inr: "1.00" }, { expectedVersion: 4 }).expected_content_version === 4);
ok("validate: GST-inclusive round needs a GST %",
  !validateEventForm({ event_type: "avadhoot_offer", event_date: "2026-09-01", rate_inr: "10", tax_treatment: "including_gst", gst_pct: "" }).ok);
ok("validate: rate normalised to two decimals before send",
  validateEventForm({ event_type: "avadhoot_offer", event_date: "2026-09-01", rate_inr: "10.5" }).normalised.rate_inr === "10.50");
ok("validate: inverted period refused", !validateCycleForm({ period_start: "2026-10-31", period_end: "2026-10-01", initiated_on: "2026-10-01" }).ok);
ok("scope: whole Customer when nothing narrows it", scopeDisplay({}) === "Whole Customer");
ok("scope: free text retained, no invented identity", scopeDisplay({ scope_text: "Trays" }) === "Trays");

// ── correction pass: mechanism tax default, Cycle edit body ─────────────
const inclForm = blankEventForm({ tax_treatment: "including_gst" }, "2026-09-23");
ok("tax default: an including-GST mechanism opens a new round including GST",
  inclForm.tax_treatment === "including_gst" && inclForm.event_date === "2026-09-23");
ok("tax default: that round then requires a GST %",
  !validateEventForm({ ...inclForm, event_type: "avadhoot_offer", rate_inr: "10" }).ok
  && validateEventForm({ ...inclForm, event_type: "avadhoot_offer", rate_inr: "10", gst_pct: "18" }).ok);
ok("tax default: the user may override one round to excluding GST",
  validateEventForm({ ...inclForm, event_type: "avadhoot_offer", rate_inr: "10", tax_treatment: "excluding_gst" }).ok
  && eventBody({ ...inclForm, tax_treatment: "excluding_gst", gst_pct: "18" }).gst_pct === null);
ok("tax default: no mechanism falls back to excluding GST", blankEventForm(null).tax_treatment === "excluding_gst");
const edited = cycleBody({ review_frequency: "monthly", period_start: "2026-09-01", period_end: "2026-09-30",
  initiated_on: "2026-08-24", custom_label: " Sep revised ", status: "closed", notes: " n " }, 1);
ok("cycle edit: body carries dates, initiation, label, status, notes and the CAS version",
  edited.expected_content_version === 1 && edited.status === "closed" && edited.custom_label === "Sep revised"
  && edited.initiated_on === "2026-08-24" && edited.notes === "n" && edited.period_end === "2026-09-30");
const workspace = readFileSync(new URL("../src/tabs/customer-pricing/CustomerPricingHistory.jsx", import.meta.url), "utf8");
ok("cycle edit: the form PATCHes the Cycle with its pinned base version and keeps the draft on conflict",
  /function CycleEditForm/.test(workspace) && /pricingPaths\.cycle\(cycle\.id\), cycleBody\(form, baseVersion\), "PATCH"/.test(workspace)
  && /VersionNotice baseVersion=\{baseVersion\} latestVersion=\{cycle\.content_version\}/.test(workspace));
ok("tax default: the add-round form is seeded from the mechanism",
  /blankEventForm\(mechanism, today\(\)\)/.test(readFileSync(new URL("../src/tabs/customer-pricing/PricingLineDetail.jsx", import.meta.url), "utf8"))
  && /<PricingLineDetail[^>]*\bmechanism=\{mechanism\}/.test(workspace));


// ═══ P0.2 — commercial mechanisms ═══════════════════════════════════════════
// basis labels: every INR/kg value names its weight basis
ok("basis: per kg shows the weight basis", rateUnitLabel("box_per_kg", "paper_consumed") === "/kg paper consumed"
  && formatRate("54.26", "kraft_paper_per_kg", "sheet_weight") === "₹54.26 /kg sheet weight");
ok("basis: per kg without a weight basis says so", rateUnitLabel("box_per_kg", null) === "/kg (weight basis not set)");
ok("basis: per piece / per m²", rateUnitLabel("box_per_piece") === "/piece" && rateUnitLabel("box_per_sqm") === "/m²");

// exact measures and paise arithmetic
ok("measure: 4 decimals kept, 5 refused, zero refused, blank stays blank",
  parseMeasure("0.452").value === "0.4520" && !parseMeasure("0.12345").ok && !parseMeasure("0").ok
  && parseMeasure("").value === null);
ok("exact: rate × weight rounds half-up to paise", mulRateByMeasure("54.26", "0.4520") === 2453n); // 24.52552 -> 24.53
ok("exact: rate ÷ weight rounds half-up to paise", divRateByMeasure("24.53", "0.4520") === 5427n); // 54.2699 -> 54.27
ok("exact: no float drift on 0.10 × 3", mulRateByMeasure("0.10", "3.0000") === 30n);

// equivalent comparisons: only when the needed weight/area exists
const measures = [
  { measure: "paper_consumed_kg", source: "costing_snapshot", value: "0.4520", status: "active" },
  { measure: "paper_consumed_kg", source: "customer_confirmed", value: "0.4600", status: "active" },
  { measure: "area_sqm", source: "manual", value: "0.8000", status: "withdrawn" },
];
const eqKg = equivalentRate("54.26", "kraft_paper_per_kg", "paper_consumed", measures);
ok("equivalent: per-kg -> per-piece uses the Customer-confirmed weight and says so",
  eqKg.available && eqKg.value === "24.96" && /customer-confirmed/.test(eqKg.note));   // 54.26 × 0.46 = 24.9596
const eqNoWeight = equivalentRate("54.26", "box_per_kg", "sheet_weight", measures);
ok("equivalent: a missing weight disables the comparison with a reason (never zero)",
  !eqNoWeight.available && /No sheet weight recorded/.test(eqNoWeight.reason) && eqNoWeight.value === undefined);
ok("equivalent: per-kg without a weight basis is disabled",
  !equivalentRate("54.26", "box_per_kg", null, measures).available);
ok("equivalent: a withdrawn area does not count as recorded",
  !equivalentRate("30.00", "box_per_sqm", null, measures).available);
const eqPiece = equivalentRate("24.53", "box_per_piece", "paper_consumed", [measures[0]]);
ok("equivalent: per-piece -> per-kg of the selected basis", eqPiece.available && eqPiece.value === "54.27"
  && eqPiece.unit === "/kg paper consumed");

// component reconciliation: recorded total kept, difference shown exactly
const rec = reconcile("54.26", { kraft_inr: "45.00", conversion_inr: "8.00", freight_inr: "1.25" });
ok("reconcile: component total and difference are exact", rec.total === "54.25" && rec.diff === "0.01");
ok("reconcile: an explicit 0.00 component counts; blank does not",
  reconcile("10.00", { kraft_inr: "10.00", conversion_inr: "0", freight_inr: "" }).total === "10.00"
  && reconcile("10.00", {}).total === null);
ok("reconcile: negative difference when components exceed the total",
  reconcile("50.00", { kraft_inr: "45.00", conversion_inr: "8.00" }).diff === "-3.00");
ok("event body: components travel as strings, blank as null",
  eventBody({ event_type: "x", rate_inr: "54.26", kraft_inr: "45.00", conversion_inr: "", freight_inr: "0.00" })
    .kraft_inr === "45.00"
  && eventBody({ event_type: "x", rate_inr: "54.26", conversion_inr: "" }).conversion_inr === null
  && eventBody({ event_type: "x", rate_inr: "1", freight_inr: "0.00" }).freight_inr === "0.00");
ok("event form: a three-decimal component is refused",
  !validateEventForm({ event_type: "avadhoot_offer", event_date: "2026-09-01", rate_inr: "10", kraft_inr: "1.555" }).ok);

// Stable Term / BF applicability mirrors the database rule
const versions = [
  { id: 1, status: "active", version_no: 1, customer_location_id: null, plant_id: null, effective_from: "2026-04-01", effective_to: "2026-09-30" },
  { id: 2, status: "active", version_no: 2, customer_location_id: null, plant_id: null, effective_from: "2026-10-01", effective_to: null },
  { id: 3, status: "active", version_no: 1, customer_location_id: null, plant_id: 1, effective_from: "2026-04-01", effective_to: null },
  { id: 4, status: "withdrawn", version_no: 3, customer_location_id: null, plant_id: null, effective_from: "2026-10-01", effective_to: null },
];
ok("applicable: only versions active at the cycle start for a same-or-wider scope",
  eq(applicableVersions(versions, { plant_id: null }, { period_start: "2026-10-01" }).map(v => v.id), [2]));
ok("applicable: a plant line sees its plant version first, then the whole-Customer one",
  eq(applicableVersions(versions, { plant_id: 1 }, { period_start: "2026-10-01" }).map(v => v.id), [3, 2]));
ok("term form: wastage added needs a %; explicit 0 conversion kept",
  !validateTermForm({ effective_from: "2026-10-01", wastage_treatment: "added_pct", wastage_pct: "" }).ok
  && validateTermForm({ effective_from: "2026-10-01", wastage_treatment: "not_captured", conversion_inr_per_kg: "0" })
    .normalised.conversion_inr_per_kg === "0.00");
const tb = termBody({ effective_from: "2026-10-01", wastage_treatment: "included_in_weight", wastage_pct: "3",
  conversion_inr_per_kg: "9.00", freight_inr_per_kg: "" }, { closePrior: true });
ok("term body: create carries scope + explicit close_prior; % dropped unless added",
  tb.close_prior === true && tb.wastage_pct === null && tb.freight_inr_per_kg === null && "plant_id" in tb
  && !("expected_content_version" in tb));
const tc = termBody({ effective_from: "2026-10-01", status: "withdrawn" }, { expectedVersion: 3 });
ok("term body: correction carries CAS + status and no scope", tc.expected_content_version === 3
  && tc.status === "withdrawn" && !("plant_id" in tc) && !("close_prior" in tc));

// BF schedule entry
const bfs = parseBfSchedule("16:-1\n20:+1.5, 22gy:3.25;24:0", "18");
ok("BF: signed exact deltas, upper-cased grades, explicit 0.00 kept",
  bfs.ok && eq(bfs.deltas, [{ bf_code: "16", delta_inr: "-1.00" }, { bf_code: "20", delta_inr: "1.50" },
    { bf_code: "22GY", delta_inr: "3.25" }, { bf_code: "24", delta_inr: "0.00" }]));
ok("BF: base listed in its own schedule refused", !parseBfSchedule("18:+1", "18").ok);
ok("BF: duplicate grade refused", !parseBfSchedule("20:1\n20:2", "18").ok);
ok("BF: three-decimal delta refused", !parseBfSchedule("20:1.555", "18").ok);
ok("BF: -0 is not a negative delta", parseBfSchedule("20:-0", "18").deltas[0].delta_inr === "0.00");
ok("BF body: explicit close_prior and the parsed schedule",
  bfSetBody({ effective_from: "2026-10-01", base_bf_code: " 18 " }, bfs.deltas, { closePrior: true }).base_bf_code === "18");

// line scope: SKU always sent so a scope edit can never clear it
ok("line body: sku_id always sent (blank -> null)",
  lineBody({ sku_id: "987" }).sku_id === "987" && lineBody({}).sku_id === null && "sku_id" in lineBody({}, 2));
ok("references/measure/override bodies: exact keys",
  eq(referencesBody("52", "", 2), { expected_content_version: 2, term_version_id: "52", bf_delta_set_id: null })
  && eq(measureBody("area_sqm", "manual", "", 1, " x "), { measure: "area_sqm", source: "manual", value: null,
    expected_content_version: 1, notes: "x" })
  && eq(overrideBody("20", "", 3), { bf_code: "20", override_rate_inr: null, expected_content_version: 3 }));

// Start next cycle: proposed dates, structure only, prior agreed stays locked
ok("next: monthly proposes the following month", eq(proposeNextPeriod({ period_start: "2026-09-01",
  period_end: "2026-09-30" }, "monthly"), { period_start: "2026-10-01", period_end: "2026-10-31" }));
ok("next: quarterly across FY boundary", eq(proposeNextPeriod({ period_start: "2027-01-01",
  period_end: "2027-03-31" }, "quarterly"), { period_start: "2027-04-01", period_end: "2027-06-30" }));
ok("next: ad hoc keeps the prior span", eq(proposeNextPeriod({ period_start: "2026-09-10",
  period_end: "2026-09-19" }, "ad_hoc"), { period_start: "2026-09-20", period_end: "2026-09-29" }));
const nb = nextCycleBody({ period_start: "2026-10-01", period_end: "2026-10-31", initiated_on: "2026-09-24",
  custom_label: " ", rate_inr: "99.00" });
ok("next: the request carries no rate, offer or SOB",
  eq(Object.keys(nb).sort(), ["custom_label", "initiated_on", "period_end", "period_start"]));
const priorLine = { id: 21, events: [
  { id: 1, event_type: "avadhoot_offer", event_date: "2026-08-25", sequence_no: 1, rate_inr: "56.00" },
  { id: 2, event_type: "final_agreement", event_date: "2026-08-30", sequence_no: 2, rate_inr: "54.25",
    component_kraft_inr: "45.00", component_conversion_inr: "8.00", component_freight_inr: "1.25" }] };
const newLine = { id: 31, prior_line_id: 21, events: [] };
const prior = priorAgreedFor(newLine, [priorLine, newLine]);
ok("next: the new line links the prior agreed round as context", prior.agreed.id === 2);
ok("next: a new line's first-offer summary stays blank (no silent carry-forward)",
  negotiationSummary(newLine.events).ourOffer === null);
ok("next: a blank round form never contains the prior rate", blankEventForm({}, "2026-10-02").rate_inr === "");
const copied = draftFromPriorAgreed(prior.agreed, { tax_treatment: "excluding_gst" }, "2026-10-02");
ok("next: explicit copy fills a DRAFT offer with the prior agreed rate and components",
  copied.rate_inr === "54.25" && copied.kraft_inr === "45.00" && copied.event_type === "avadhoot_offer"
  && /copied from prior agreed/.test(copied.notes));

// ── P0.2 correction: Stable-Term components converted into the ROUND's unit ──
// Term: conversion ₹8.00/kg Paper Consumed, freight ₹1.25/kg Sheet Weight.
const T8 = { conversion_inr_per_kg: "8.00", freight_inr_per_kg: "1.25" };
const M = [
  { measure: "paper_consumed_kg", source: "costing_snapshot", value: "0.4520", status: "active" },
  { measure: "paper_consumed_kg", source: "customer_confirmed", value: "0.4600", status: "active" },
  { measure: "sheet_weight_kg", source: "manual", value: "0.4200", status: "active" },
  { measure: "box_weight_kg", source: "costing_snapshot", value: "0.4116", status: "active" },
  { measure: "area_sqm", source: "imported", value: "0.8000", status: "active" },
];
const conv = (kind, rb, wb, ms = M, term = T8) => termComponentInRoundUnit(term, kind, rb, wb, ms);
ok("component: per piece — conversion 8.00 × 0.4600 PC = 3.68",
  conv("conversion", "box_per_piece", null).value === "3.68");
ok("component: per piece — freight 1.25 × 0.4200 SW = 0.525 rounds HALF-UP to 0.53",
  conv("freight", "box_per_piece", null).value === "0.53");
ok("component: per kg Paper Consumed — conversion stays 8.00, freight 0.525/0.46 = 1.14",
  conv("conversion", "box_per_kg", "paper_consumed").value === "8.00"
  && conv("freight", "box_per_kg", "paper_consumed").value === "1.14");
ok("component: per kg Sheet Weight — conversion 3.68/0.42 = 8.76, freight stays 1.25",
  conv("conversion", "kraft_paper_per_kg", "sheet_weight").value === "8.76"
  && conv("freight", "kraft_paper_per_kg", "sheet_weight").value === "1.25");
ok("component: per kg Box Weight — conversion 3.68/0.4116 = 8.94, freight 0.525/0.4116 = 1.28",
  conv("conversion", "box_per_kg", "box_weight").value === "8.94"
  && conv("freight", "box_per_kg", "box_weight").value === "1.28");
ok("component: per m² — conversion 3.68/0.80 = 4.60, freight 0.525/0.80 = 0.66",
  conv("conversion", "box_per_sqm", null).value === "4.60" && conv("freight", "box_per_sqm", null).value === "0.66");
const costingOnly = M.filter(m => m.source !== "customer_confirmed");
const viaCosting = conv("conversion", "box_per_piece", null, costingOnly);
ok("component: source precedence — Customer-confirmed PC is used and named; without it Costing is used and named",
  /customer-confirmed/.test(conv("conversion", "box_per_piece", null).note)
  && viaCosting.value === "3.62" && /costing snapshot/.test(viaCosting.note));
const noSheet = M.filter(m => m.measure !== "sheet_weight_kg");
ok("component: missing NUMERATOR measure leaves freight unfilled with the reason, conversion still converts",
  !conv("freight", "box_per_piece", null, noSheet).available
  && /No sheet weight recorded/.test(conv("freight", "box_per_piece", null, noSheet).reason)
  && conv("freight", "box_per_piece", null, noSheet).value === undefined
  && conv("conversion", "box_per_piece", null, noSheet).available);
const noArea = M.filter(m => m.measure !== "area_sqm");
ok("component: missing DENOMINATOR (area) leaves it unfilled with the reason",
  !conv("conversion", "box_per_sqm", null, noArea).available
  && /no area/.test(conv("conversion", "box_per_sqm", null, noArea).reason));
ok("component: missing DENOMINATOR (basis weight) leaves it unfilled with the reason",
  /no sheet weight recorded to express it per kg/.test(conv("conversion", "box_per_kg", "sheet_weight", noSheet).reason));
ok("component: per-kg round without a weight basis is unavailable, never guessed",
  /no weight basis/.test(conv("conversion", "box_per_kg", null).reason));
ok("component: explicit zero Stable-Term value converts to 0.00 (not blank)",
  conv("conversion", "box_per_piece", null, M, { conversion_inr_per_kg: "0.00" }).value === "0.00");
ok("component: a blank Stable-Term value is unavailable, never zero",
  !conv("freight", "box_per_piece", null, M, { freight_inr_per_kg: null }).available);
ok("component: a withdrawn measure is not used",
  !conv("freight", "box_per_piece", null,
    [{ measure: "sheet_weight_kg", source: "manual", value: "0.42", status: "withdrawn" }]).available);
const rec2 = reconcile("12.21", { kraft_inr: "8.00", conversion_inr: conv("conversion", "box_per_piece", null).value,
  freight_inr: conv("freight", "box_per_piece", null).value });
ok("component: converted components reconcile in the round's unit", rec2.total === "12.21" && rec2.diff === "0.00");

// ── P0.2 correction: no derived BF rate below ₹0.00 ──
const deltasNeg = [{ bf_code: "16", delta_inr: "-1.00" }, { bf_code: "14", delta_inr: "-1.25" }, { bf_code: "20", delta_inr: "2.00" }];
ok("BF floor: a negative delta is fine while the result stays ≥ 0 (1.00 − 1.00 = 0.00)",
  eq(bfFloorViolations("1.25", deltasNeg), []) && !bfFloorViolations("1.00", deltasNeg).includes("16"));
ok("BF floor: a delta that would take the derived rate below 0 is flagged",
  eq(bfFloorViolations("1.00", deltasNeg), ["14"]));
ok("BF floor: no rate or no schedule flags nothing", eq(bfFloorViolations("", deltasNeg), []) && eq(bfFloorViolations("1", []), []));

// source shape for P0.2 UI rules
const lineDetail = readFileSync(new URL("../src/tabs/customer-pricing/PricingLineDetail.jsx", import.meta.url), "utf8");
const basisSrc = readFileSync(new URL("../src/tabs/customer-pricing/LineCommercialBasis.jsx", import.meta.url), "utf8");
ok("shape: the prior agreed copy is an explicit button, not an automatic prefill",
  /Copy prior agreed to draft offer/.test(basisSrc) && /initial=\{draft \|\| blankEventForm\(mechanism, today\(\)\)\}/.test(lineDetail));
ok("shape: Stable-Term component prefill is an explicit, CONVERTED button (no literal ₹/kg copy)",
  /Fill converted Stable-Term conversion\/freight/.test(lineDetail) && /termComponentInRoundUnit/.test(lineDetail)
  && !/conversion_inr: term\?\.conversion_inr_per_kg/.test(lineDetail));
ok("shape: workspace offers Start next cycle and the Stable Terms panel",
  /Start next cycle/.test(workspace) && /<StableTermsPanel/.test(workspace));
// P0.3 legitimately adds transpose and drag/drop; the P0.4 clipboard engine
// must still be absent from every pricing module (checked again below).
// P0.4 adds clipboard paste; what must hold is that the workspace, line detail
// and commercial-basis panel never read the clipboard or send a pasted value.
ok("shape: the workspace and line forms never read the clipboard themselves",
  !/clipboardData/.test([workspace, lineDetail, basisSrc].join("\n").replace(/^\s*\/\/.*$/gm, "")));

// ── source shape ──────────────────────────────────────────────────────────
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const pricingSources = ["src/lib/customerPricingModel.js", "src/lib/customerPricingActions.js",
  "src/tabs/customer-pricing/CustomerPricingHistory.jsx", "src/tabs/customer-pricing/PricingLineDetail.jsx",
  "src/tabs/customer-pricing/pricingFormBits.jsx", "src/tabs/customer-pricing/pricingStyles.js",
  "src/tabs/customer-pricing/StableTermsPanel.jsx", "src/tabs/customer-pricing/LineCommercialBasis.jsx",
  "src/tabs/customer-pricing/BfScheduleTable.jsx", "src/tabs/customer-pricing/PricingMatrix.jsx",
  "src/tabs/customer-pricing/LayoutToolbar.jsx", "src/tabs/customer-pricing/LayoutZonesPanel.jsx",
  "src/tabs/customer-pricing/DetailsSummary.jsx", "src/tabs/customer-pricing/CustomerPricingFixturePreview.jsx",
  "src/lib/customerPricingFixture.js"].map(read).join("\n");
// P0.3: exactly ONE pricing module touches browser storage — the layout
// engine, through persist.js, for layout preferences (behaviour proven in
// the P0.3 section). Every business-data module stays storage-free.
ok("shape: no pricing-history data in browser storage (business modules)",
  !/localStorage|sessionStorage|indexedDB|persist\.js|cbb_/.test(pricingSources.replace(/^\s*\/\/.*$/gm, "")));
const layoutSrc = read("src/lib/customerPricingLayout.js").replace(/^\s*\/\/.*$/gm, "");
const layoutHookSrc = read("src/tabs/customer-pricing/useCustomerPricingLayout.js").replace(/^\s*\/\/.*$/gm, "");
ok("shape: the layout engine reaches storage only through persist.js, never localStorage directly",
  /import \* as persist from "\.\/persist\.js"/.test(layoutSrc)
  && !/localStorage|sessionStorage|indexedDB|cbb_/.test(layoutSrc + layoutHookSrc)
  && !/persist\.js/.test(layoutHookSrc));
// P0.4: the clipboard is read in exactly two places — the grid and the BF
// schedule paste box — and both hand the text to the preview model only.
const pasteUi = ["src/tabs/customer-pricing/PricingMatrix.jsx", "src/tabs/customer-pricing/BfPastePanel.jsx",
  "src/tabs/customer-pricing/PastePreviewPanel.jsx", "src/tabs/customer-pricing/usePasteSubmit.js",
  "src/lib/customerPricingPaste.js", "src/lib/customerPricingFilters.js"].map(read).join("\n").replace(/^\s*\/\/.*$/gm, "");
const allPricingFiles = ["src/lib/customerPricingModel.js", "src/lib/customerPricingActions.js",
  "src/lib/customerPricingLayout.js", "src/lib/customerPricingPaste.js", "src/lib/customerPricingFilters.js",
  "src/lib/customerPricingFixture.js",
  ...["CustomerPricingHistory.jsx", "PricingLineDetail.jsx", "pricingFormBits.jsx", "pricingStyles.js",
    "StableTermsPanel.jsx", "LineCommercialBasis.jsx", "BfScheduleTable.jsx", "PricingMatrix.jsx", "LayoutToolbar.jsx",
    "LayoutZonesPanel.jsx", "DetailsSummary.jsx", "CustomerPricingFixturePreview.jsx", "useCustomerPricingLayout.js",
    "PastePreviewPanel.jsx", "BfPastePanel.jsx", "usePasteSubmit.js", "PricingFilters.jsx", "ChangeHistoryPanel.jsx",
    "useChangeHistory.js"].map(f => `src/tabs/customer-pricing/${f}`)];
const readers = allPricingFiles.filter(f => /clipboardData/.test(read(f).replace(/^\s*\/\/.*$/gm, "")));
ok("shape: the clipboard is read only by the grid and the BF paste box",
  eq(readers, ["src/tabs/customer-pricing/PricingMatrix.jsx", "src/tabs/customer-pricing/BfPastePanel.jsx"]),
  readers.join(", "));
ok("shape: P0.4 modules keep pricing data out of browser storage too",
  !/localStorage|sessionStorage|indexedDB|persist\.js|cbb_/.test(pasteUi));
ok("shape: no money parseFloat/Number() in the pricing modules",
  !/parseFloat|Number\(\s*(form|e|line|value)/.test(pricingSources));
ok("shape: transport is apiFetch (caller token), never a Supabase client",
  /from "\.\/apiClient\.js"/.test(read("src/lib/customerPricingActions.js")) && !/supabase/i.test(read("src/lib/customerPricingActions.js").replace(/^\s*\/\/.*$/gm, "")));
const screen = read("src/tabs/CustomerFamiliesScreen.jsx");
ok("shape: Family Details mounts the workspace behind the feature flag",
  /isFeatureEnabled\("customer_pricing_history"\)/.test(screen) && /<CustomerPricingHistory party=\{party\}/.test(screen));
ok("shape: the pricing grid is its own module, not inlined in the Family screen",
  !/negotiationSummary|pricingMutation/.test(screen));
ok("shape: feature flag is enabled by the explicit Beta activation step",
  /BUILD_DEFAULTS = \[[^\]]*customer_pricing_history/.test(read("src/lib/featureFlags.js"))
  && /DEVELOPMENT_DEFAULTS = \[\]/.test(read("src/lib/featureFlags.js")));
ok("shape: add-round reuses one request id until success",
  /setRequestId\(newClientRequestId\(\)\)/.test(read("src/tabs/customer-pricing/PricingLineDetail.jsx")));

// ═══ P0.3 — flexible presentation (frontend-only layout engine) ═════════════
// Every case runs against the representative canonical payload the fixture
// preview shows. Presentation only: none of this proves persistence or auth.
const data3 = structuredClone(P03_FIXTURE_DATA);
const data3Json = JSON.stringify(data3);
const reg3 = L.buildFieldRegistry(data3);
const std3 = L.standardLayout(reg3);
const run = (layout, ...ops) => ops.reduce((acc, op) => L.applyLayoutOp(acc, op), layout);
const viewOf = layout => L.buildView(data3, layout, reg3);
const ident = c => JSON.stringify({ r: c.recordKey, f: c.fieldId, s: c.source, ref: c.ref, raw: c.raw, d: c.display });
const mapping = layout => {
  const m = L.gridMatrix(viewOf(layout));
  const out = new Map();
  m.cells.forEach(row => row.forEach(c => out.set(`${c.recordKey}|${c.fieldId}`, ident(c))));
  return out;
};
const sameMapping = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
// All requests the visible editable cells would send (keyed by canonical ref).
const payloads = layout => {
  const out = new Map();
  for (const row of L.gridMatrix(viewOf(layout)).cells) {
    for (const c of row) if (c.ref) out.set(JSON.stringify(c.ref), JSON.stringify(L.cellMutation(c.ref, L.cellEditorValue(c.ref, data3), data3)));
  }
  return out;
};

// 0. Standard reproduces the P0.1/P0.2 compact grid exactly.
ok("P0.3 standard: same nine columns, same order as the P0.1/P0.2 grid",
  eq(viewOf(std3).fields.map(f => f.label),
    ["Cycle", "Date", "Scope", "Basis", "Our offer", "Customer offer", "Final agreed", "SOB", "Rounds"]));
ok("P0.3 standard: Our/Customer/Final use first offer, latest counter, latest agreement",
  (() => { const v = viewOf(std3); const rec = v.records.find(r => r.key === "line:31");
    const at = id => L.cellFor(reg3.byId.get(id), rec, v.ctx).raw;
    return at("neg.our_offer") === "56.00" && at("neg.customer_offer") === "53.50" && at("neg.final_agreed") === "54.25"; })());

// 1. Transposing twice restores the same canonical mapping.
const tr1 = run(std3, { type: "transpose" });
const tr2 = run(tr1, { type: "transpose" });
ok("P0.3 transpose: twice returns the identical layout", L.layoutsEqual(tr2, std3));
const mS = L.gridMatrix(viewOf(std3));
const mT = L.gridMatrix(viewOf(tr1));
ok("P0.3 transpose: rows and columns swap (records × fields -> fields × records)",
  eq(mS.rows, mT.cols) && eq(mS.cols, mT.rows) && mS.rowAxis === "records" && mT.rowAxis === "fields");
ok("P0.3 transpose: cell [r][c] in Standard is cell [c][r] in Transposed, same canonical identity",
  mS.cells.every((row, r) => row.every((c, k) => ident(c) === ident(mT.cells[k][r]))));
ok("P0.3 transpose: the canonical mapping after transposing twice equals the original",
  sameMapping(mapping(tr2), mapping(std3)));
const grouped3 = run(std3, { type: "group" }, { type: "move", fieldId: "line.sob", zone: "columns", before: "cycle.date" });
ok("P0.3 transpose: also an identity on a grouped, reordered layout",
  sameMapping(mapping(run(grouped3, { type: "transpose" }, { type: "transpose" })), mapping(grouped3)));

// 2. Hide/show, reorder, pin, group, ungroup: no canonical data or payload change.
const basePayloads = payloads(std3);
const opsSeq = [
  { type: "move", fieldId: "neg.our_offer", zone: "hidden", before: null },
  { type: "move", fieldId: "line.sob", zone: "columns", before: "cycle.label" },
  { type: "pin", fieldId: "line.scope" },
  { type: "group" },
  { type: "collapse", groupId: "negotiation" },
  { type: "move", fieldId: "cycle.notes", zone: "columns", before: null },
  { type: "move", fieldId: "line.scope_text", zone: "columns", before: null },
];
const arranged = run(std3, ...opsSeq);
ok("P0.3 arrange: the canonical pricing payload is byte-identical after arranging and rendering",
  (viewOf(arranged), L.gridMatrix(viewOf(arranged)), JSON.stringify(data3) === data3Json));
const arrangedPayloads = payloads(arranged);
ok("P0.3 arrange: every editable cell still in view sends the same request as in Standard",
  [...basePayloads].every(([ref, body]) => !arrangedPayloads.has(ref) || arrangedPayloads.get(ref) === body)
  && [...arrangedPayloads.keys()].filter(k => basePayloads.has(k)).length > 0);
ok("P0.3 arrange: newly shown editable fields carry their own canonical record, not the row's neighbour",
  [...arrangedPayloads.keys()].map(k => JSON.parse(k)).some(r => r.recordType === "cycle" && r.fieldId === "notes")
  && [...arrangedPayloads.keys()].map(k => JSON.parse(k)).some(r => r.recordType === "line" && r.fieldId === "scope_text"));
const ungrouped = run(std3, { type: "group" }, { type: "collapse", groupId: "negotiation" }, { type: "expand", groupId: "negotiation" }, { type: "ungroup" });
ok("P0.3 group -> ungroup: field order and mapping unchanged", eq(ungrouped.fields, std3.fields) && sameMapping(mapping(ungrouped), mapping(std3)));
const hiddenShown = run(std3, { type: "move", fieldId: "line.basis", zone: "hidden", before: null },
  { type: "move", fieldId: "line.basis", zone: "columns", before: "neg.our_offer" });
ok("P0.3 hide -> show: restores the same place and mapping", eq(hiddenShown.fields, std3.fields)
  && sameMapping(mapping(hiddenShown), mapping(std3)));
const pinned = run(std3, { type: "pin", fieldId: "neg.final_agreed" });
ok("P0.3 pin: moves the column to the front visually; stored field order and every cell unchanged",
  viewOf(pinned).fields.map(f => f.id).indexOf("neg.final_agreed") === 1 && eq(pinned.fields, std3.fields)
  && sameMapping(mapping(pinned), mapping(std3)));
ok("P0.3 pin/unpin: unpin restores the layout", L.layoutsEqual(run(pinned, { type: "unpin", fieldId: "neg.final_agreed" }), std3));
ok("P0.3 collapse: a collapsed group shows its lead field and counts the rest",
  (() => { const v = viewOf(run(std3, { type: "group" }, { type: "collapse", groupId: "negotiation" }));
    const band = v.bands.find(b => b.groupId === "negotiation");
    return band.ids.length === 1 && band.hiddenCount === 3 && !v.fields.some(f => f.id === "neg.final_agreed"); })());
ok("P0.3 layout: a layout holds field ids and flags only — no pricing value",
  !/54\.25|56\.00|FIX-|Trays|__P03/.test(JSON.stringify(L.serializeLayout(arranged))));

// 3. Dragging and its accessible-menu equivalent produce the same layout.
let dragChecks = 0; let dragFails = [];
const dragFor = (layout, fieldId, actionId) => {
  const zone = L.zoneOf(layout, fieldId);
  const list = zone === L.fieldAxisZone(layout) ? layout.fields : zone === "details" || zone === "hidden" ? layout[zone] : [];
  const i = list.indexOf(fieldId);
  const to = /^to-(.+)$/.exec(actionId);
  if (to) return L.dropOp(fieldId, to[1], null);                       // drop on the zone's empty space
  if (actionId === "first") return L.dropOp(fieldId, zone, list[0]);   // drop on the first chip
  if (actionId === "earlier") return L.dropOp(fieldId, zone, list[i - 1]);
  if (actionId === "later") return L.dropOp(fieldId, zone, list[i + 2] ?? null);
  if (actionId === "last") return L.dropOp(fieldId, zone, null);
  return null;
};
for (const layout of [std3, tr1, L.presetLayout("location_comparison", reg3)]) {
  for (const f of reg3.fields) {
    for (const a of L.fieldMenuActions(layout, f.id)) {
      const drag = dragFor(layout, f.id, a.id);
      if (!drag) continue;
      dragChecks += 1;
      if (!L.layoutsEqual(L.applyLayoutOp(layout, a.op), L.applyLayoutOp(layout, drag))) dragFails.push(`${f.id}/${a.id}`);
    }
  }
}
ok(`P0.3 drag = menu: ${dragChecks} drag/menu pairs over Standard, Transposed and grouped layouts give identical layouts`,
  dragChecks > 300 && !dragFails.length, dragFails.slice(0, 5).join(", "));
ok("P0.3 drag = menu: every visible/hidden/details field offers a menu route to every other zone",
  reg3.fields.every(f => L.fieldMenuActions(std3, f.id).filter(a => a.id.startsWith("to-")).length === 3));
ok("P0.3 drag into the records zone groups records by that field (and the menu says so)",
  (() => { const menu = L.fieldMenuActions(std3, "line.plant").find(a => a.id === "to-rows");
    const a = L.applyLayoutOp(std3, menu.op); const b = L.applyLayoutOp(std3, L.dropOp("line.plant", "rows", "@records"));
    return /Group record rows/.test(menu.label) && a.recordGroupBy === "line.plant" && L.layoutsEqual(a, b); })());

// 4. Blank, explicit zero and differing values -> correct common / Mixed.
const freightData = values => ({ mechanism: { id: 1, content_version: 1 }, cycles: [{ id: 1, period_start: "2026-09-01",
  period_end: "2026-09-30", review_frequency: "monthly", content_version: 1,
  lines: values.map((v, i) => ({ id: 100 + i, content_version: 1, events: [{ id: 900 + i, event_type: "final_agreement",
    event_date: "2026-09-02", sequence_no: 1, rate_inr: "10.00", content_version: 1, component_freight_inr: v }] })) }] });
const freightSummary = values => { const d = freightData(values); return L.summarizeField(L.STATIC_REGISTRY.byId.get("comp.freight"),
  L.canonicalRecords(d), L.buildContext(d)); };
const allZero = freightSummary(["0.00", "0.00", "0.00"]);
ok("P0.3 summary: all explicit ₹0.00 is a common value ₹0.00, not blank", allZero.state === "common"
  && allZero.display === "₹0.00" && allZero.blank === false && allZero.raw === "0.00");
const allBlank = freightSummary([null, null]);
ok("P0.3 summary: all blank is a common BLANK, never ₹0.00", allBlank.state === "common" && allBlank.blank === true
  && allBlank.display === "—");
const zeroBlank = freightSummary(["0.00", null, "0.00"]);
ok("P0.3 summary: explicit zero and blank differ -> Mixed values", zeroBlank.state === "mixed"
  && zeroBlank.display === "Mixed values" && zeroBlank.raw === undefined);
const differing = freightSummary(["1.25", "1.20"]);
ok("P0.3 summary: differing values -> Mixed values, no value claimed", differing.state === "mixed"
  && differing.raw === undefined && differing.contributors.length === 2);
ok("P0.3 summary: identical values -> one common value", freightSummary(["1.25", "1.25"]).display === "₹1.25");
const sob3 = L.summarizeField(reg3.byId.get("line.sob"), L.canonicalRecords(data3).filter(r => r.line?.id === 32 || r.line?.id === 21), L.buildContext(data3));
ok("P0.3 summary: SOB percentage 0.00% vs 55.00% is Mixed; 0% is never blank",
  sob3.state === "mixed" && sob3.contributors.some(c => c.display === "0.00%"));

// 5. Mixed disclosure names the contributing canonical records.
const ctx3 = L.buildContext(data3);
const sepRecords = L.canonicalRecords(data3).filter(r => r.cycle.id === 5);
const conv3 = L.summarizeField(reg3.byId.get("term.conversion"), sepRecords, ctx3);
ok("P0.3 disclosure: Stable-Term conversion across Sep lines is Mixed, naming term 52 (v1) and term 53 (v2)",
  conv3.state === "mixed" && eq(conv3.contributors.map(c => [c.recordType, c.recordId, c.version, c.display]),
    [["term", 52, 1, "₹8.00"], ["term", 53, 2, "₹8.50"]]));
ok("P0.3 disclosure: each contributor lists the displayed lines that use it (term 52 -> lines 31 and 33)",
  conv3.contributors[0].usedBy.length === 2 && conv3.contributors[1].usedBy.length === 1);
const bf22 = L.summarizeField(reg3.byId.get("bf:22"), sepRecords, ctx3);
ok("P0.3 disclosure: BF 22 agreed (override 57.00 vs derived 57.50) is Mixed and names rounds 304 and 312",
  bf22.state === "mixed" && eq(bf22.contributors.filter(c => c.recordType === "event").map(c => c.recordId), [304, 312]));
const cycleNotes = L.summarizeField(reg3.byId.get("cycle.notes"), sepRecords, ctx3);
ok("P0.3 disclosure: a Cycle value shown on three lines is ONE canonical record -> common, not repeated",
  cycleNotes.state === "common" && cycleNotes.contributors.length === 1 && cycleNotes.contributors[0].recordType === "cycle");
// ── P0.3 correction: weight/area values belong to their own measure records ──
const pcField = reg3.byId.get("m.paper_consumed");
const recOf = key => L.canonicalRecords(data3).find(r => r.key === key);
const pc31 = L.cellFor(pcField, recOf("line:31"), ctx3);
ok("P0.3 measure: a shown weight's canonical source is its measure record (id 701, v2), not the pricing line",
  eq(pc31.source, { recordType: "measure", recordId: 701, version: 2 }) && pc31.raw === "0.4600" && pc31.ref === null);
ok("P0.3 measure: the preferred source wins — Customer-confirmed 701 over Costing snapshot 702 on the same line",
  /customer-confirmed/.test(pc31.display) && pc31.source.recordId !== 702);
const pcSum = L.summarizeField(pcField, sepRecords, ctx3);
ok("P0.3 measure: Mixed disclosure names the exact measure records and versions, and the line lacking one",
  pcSum.state === "mixed" && eq(pcSum.contributors.map(c => [c.recordType, c.recordId, c.version, c.raw]),
    [["measure", 701, 2, "0.4600"], ["measure", 711, 1, "0.4520"], ["line", 33, 2, null]]));
ok("P0.3 measure: each contributor still lists the pricing lines that use it",
  eq(pcSum.contributors.map(c => c.usedBy), [["Sep 2026 · FIX-PUNE · NAG"], ["Sep 2026 · FIX-KOLKATA · PUN"],
    ["Sep 2026 · FIX-PUNE · NAG · SKU #9101 · Trays"]]));
ok("P0.3 measure: an absent measure is the line saying 'none recorded' — blank, never an invented measure record",
  pcSum.contributors[2].absent === "no paper consumed recorded" && pcSum.contributors[2].display === "—"
  && !pcSum.contributors.some(c => c.recordType === "measure" && c.recordId == null));
const noConfirmed = structuredClone(data3);
noConfirmed.cycles[1].lines[0].measures = noConfirmed.cycles[1].lines[0].measures.filter(m => m.id !== 701);
const pcCosting = L.cellFor(pcField, L.canonicalRecords(noConfirmed).find(r => r.key === "line:31"), L.buildContext(noConfirmed));
ok("P0.3 measure: without the Customer-confirmed value the Costing snapshot record (702 v1) becomes the source",
  eq(pcCosting.source, { recordType: "measure", recordId: 702, version: 1 }) && pcCosting.raw === "0.4520");
const area31 = L.cellFor(reg3.byId.get("m.area"), recOf("line:31"), ctx3);
ok("P0.3 measure: a withdrawn value (area 704) is unavailable — blank on the line, record 704 never claimed",
  area31.source.recordType === "line" && area31.source.recordId === 31 && area31.raw === null
  && /no area recorded/.test(area31.source.absent));
const measureData = vals => ({ mechanism: { id: 1, content_version: 1 }, cycles: [{ id: 1, period_start: "2026-09-01",
  period_end: "2026-09-30", review_frequency: "monthly", content_version: 1,
  lines: vals.map((v, i) => ({ id: 100 + i, content_version: 1, events: [], measures: v === null ? []
    : [{ id: 800 + i, line_id: 100 + i, measure: "box_weight_kg", source: "manual", value: v, status: "active", content_version: 1 }] })) }] });
const bwSummary = vals => { const d = measureData(vals); return L.summarizeField(L.STATIC_REGISTRY.byId.get("m.box_weight"),
  L.canonicalRecords(d), L.buildContext(d)); };
ok("P0.3 measure: blank vs a zero value stays Mixed (the database refuses 0 measures; a zero is still never blank)",
  bwSummary(["0.0000", null]).state === "mixed" && bwSummary([null, null]).blank === true
  && bwSummary(["0.4116", "0.4200"]).state === "mixed" && bwSummary(["0.4116"]).display.startsWith("0.4116 kg"));
const same = bwSummary(["0.4116", "0.4116"]);
ok("P0.3 measure: identical values on two lines are one common value that still names both measure records",
  same.state === "common" && same.raw === "0.4116" && eq(same.contributors.map(c => [c.recordType, c.recordId]),
    [["measure", 800], ["measure", 801]]));
ok("P0.3 measure: the Details disclosure resolves to the measure records",
  eq(L.resolveDisclosure({ kind: "details", fieldId: "m.paper_consumed" },
    viewOf(run(std3, { type: "move", fieldId: "m.paper_consumed", zone: "details", before: null })))
    .summary.contributors.filter(c => c.recordType === "measure").map(c => c.recordId), [701, 711]));
ok("P0.3 measure: the disclosure labels the record type in words",
  /measure: "Weight\/area record"/.test(read("src/tabs/customer-pricing/DetailsSummary.jsx")));

// ── P0.3 correction: agreed-BF fields come from FINAL agreements only ──
const offer303 = data3.cycles[1].lines[0].events.find(e => e.id === 303);
ok("P0.3 BF: the fixture has a grade (24) quoted only in an earlier OFFER",
  offer303.event_type === "avadhoot_offer" && offer303.bf_schedule.some(r => r.bf_code === "24")
  && !data3.cycles.flatMap(c => c.lines).flatMap(l => l.events).some(e => e.event_type === "final_agreement"
    && e.bf_schedule.some(r => r.bf_code === "24")));
ok("P0.3 BF: the registry has every agreed grade (16, 18, 20, 22) and no offer-only grade",
  eq(reg3.fields.filter(f => f.dynamic).map(f => f.id), ["bf:16", "bf:18", "bf:20", "bf:22"]) && !reg3.byId.has("bf:24"));
const bfLayout = L.presetLayout("bf_schedule", reg3);
const bfPlaced = [...bfLayout.fields, ...bfLayout.details, ...bfLayout.hidden];
ok("P0.3 BF: the BF Schedule preset shows every agreed grade and never the offer-only grade 24",
  ["bf:16", "bf:18", "bf:20", "bf:22"].every(id => bfLayout.fields.includes(id)) && !bfPlaced.includes("bf:24")
  && !L.gridMatrix(viewOf(bfLayout)).rows.includes("bf:24"));
const bfCell = (key, code) => L.cellFor(reg3.byId.get(`bf:${code}`), recOf(key), ctx3);
ok("P0.3 BF: agreed grades map to the line's final agreement round (override and derived kept distinct)",
  eq([bfCell("line:31", "22").source.recordId, bfCell("line:31", "22").raw], [304, "57.00"])
  && eq([bfCell("line:32", "22").source.recordId, bfCell("line:32", "22").raw], [312, "57.50"])
  && eq([bfCell("line:21", "16").source.recordId, bfCell("line:21", "16").raw], [202, "52.75"])
  && bfCell("line:31", "18").display.endsWith("base"));
const offersOnly = structuredClone(data3);
for (const c of offersOnly.cycles) for (const l of c.lines) l.events = l.events.filter(e => e.event_type !== "final_agreement");
ok("P0.3 BF: with no final agreements, no agreed-BF field exists even though offers carry schedules",
  L.buildFieldRegistry(offersOnly).fields.filter(f => f.dynamic).length === 0);
ok("P0.3 BF: a line still negotiating (no agreement) shows its agreed-BF cells blank, not the offer's rate",
  bfCell("line:33", "22").raw === null);

const locLayout = L.presetLayout("location_comparison", reg3);
const locV = viewOf(locLayout);
const reqD = { kind: "details", fieldId: "term.conversion" };
const puneKey = locV.recordGroups.find(g => g.label === "FIX-PUNE").key;
const resolvedG = L.resolveDisclosure({ kind: "group", groupKey: puneKey, fieldId: "neg.final_agreed" }, locV);
ok("P0.3 disclosure: re-derived from the current view — a group's Mixed lists that group's rounds only",
  L.resolveDisclosure(reqD, locV).summary.state === "mixed" && resolvedG.summary.state === "mixed"
  && eq(resolvedG.summary.contributors.filter(c => c.recordType === "event").map(c => c.recordId), [304, 202]));
ok("P0.3 disclosure: disappears when its field leaves Details or its group no longer exists",
  L.resolveDisclosure(reqD, viewOf(run(locLayout, { type: "move", fieldId: "term.conversion", zone: "hidden", before: null }))) === null
  && L.resolveDisclosure({ kind: "group", groupKey: puneKey, fieldId: "neg.final_agreed" }, viewOf(std3)) === null);
ok("P0.3 disclosure: not-applicable records are counted, not treated as blank",
  L.summarizeField(reg3.byId.get("bf.base"), sepRecords, ctx3).notApplicable === 1);

// 6. Named layouts are isolated by authenticated user and Customer.
const memStore = () => { const m = new Map(); return { m, getItem: k => (m.has(k) ? m.get(k) : null),
  setItem: (k, v) => { m.set(k, String(v)); return true; } }; };
const store = memStore();
const stateWith = (name, layout) => ({ current: layout, active: { kind: "named", name }, named: { [name]: layout } });
L.saveLayoutState("u-101", 9501, stateWith("Alpha view", tr1), store);
L.saveLayoutState("u-202", 9501, stateWith("Beta view", arranged), store);
L.saveLayoutState("u-101", 9502, stateWith("Other customer", std3), store);
const a1 = L.loadLayoutState("u-101", 9501, store);
const b1 = L.loadLayoutState("u-202", 9501, store);
const a2 = L.loadLayoutState("u-101", 9502, store);
ok("P0.3 isolation: three (user, Customer) pairs -> three separate keys", store.m.size === 3
  && [...store.m.keys()].every(k => k.startsWith(`${L.LAYOUT_STORAGE_PREFIX}:`)));
ok("P0.3 isolation: each user sees only their own named views for that Customer",
  eq(Object.keys(a1.named), ["Alpha view"]) && eq(Object.keys(b1.named), ["Beta view"]) && eq(Object.keys(a2.named), ["Other customer"]));
ok("P0.3 isolation: the restored layout is the one that user saved", L.layoutsEqual(a1.current, tr1)
  && L.layoutsEqual(b1.current, arranged) && a1.active.name === "Alpha view");
ok("P0.3 isolation: a user never gets another Customer's or user's view",
  L.loadLayoutState("u-303", 9501, store).fallback === null && eq(L.loadLayoutState("u-303", 9501, store).named, {}));
const noUser = memStore();
ok("P0.3 isolation: without an authenticated identity nothing is stored (session only)",
  L.saveLayoutState(null, 9501, stateWith("x", std3), noUser) === false && noUser.m.size === 0
  && L.layoutStorageKey(undefined, 9501) === null && L.layoutStorageKey("u-1", "") === null);

// 7. Corrupt, obsolete and malformed stored layouts fall back to Standard.
const fallbackFor = text => { const s = memStore(); s.setItem(L.layoutStorageKey("u-9", 1), text); return L.loadLayoutState("u-9", 1, s); };
const corrupt = fallbackFor("{not json");
ok("P0.3 fallback: unparseable storage -> Standard, flagged corrupt", corrupt.fallback === "corrupt"
  && L.layoutsEqual(corrupt.current, L.standardLayout()));
ok("P0.3 fallback: an older layout version -> Standard, flagged obsolete",
  fallbackFor(JSON.stringify({ v: 0, current: { orientation: "standard", fields: [] } })).fallback === "obsolete"
  && fallbackFor(JSON.stringify({ current: {} })).fallback === "obsolete");
ok("P0.3 fallback: a wrong-shape current layout -> Standard, flagged invalid",
  fallbackFor(JSON.stringify({ v: 1, current: { v: 1, orientation: "sideways", fields: [] } })).fallback === "invalid"
  && fallbackFor(JSON.stringify({ v: 1, current: { v: 1, orientation: "standard", fields: "cycle.label" } })).fallback === "invalid");
ok("P0.3 fallback: JSON of the wrong type (array / null / number) -> Standard",
  ["[]", "null", "42"].every(t => fallbackFor(t).fallback === "corrupt"));
const partial = fallbackFor(JSON.stringify({ v: 1, active: { kind: "named", name: "Bad" },
  current: { v: 1, orientation: "standard", fields: ["cycle.label", "no.such.field", "cycle.label", "neg.final_agreed"] },
  named: { Good: L.serializeLayout(tr1), Bad: { v: 99 } } }));
ok("P0.3 fallback: unknown/duplicate field ids are dropped; a bad named view is dropped, a good one kept",
  eq(partial.current.fields, ["cycle.label", "neg.final_agreed"]) && eq(Object.keys(partial.named), ["Good"])
  && partial.active.kind === "custom" && partial.current.hidden.includes("neg.our_offer"));
ok("P0.3 fallback: a missing key is simply Standard (not an error)", L.loadLayoutState("u-9", 1, memStore()).fallback === null);
ok("P0.3 fallback: an unavailable browser storage (throws) still yields Standard",
  L.layoutsEqual(L.loadLayoutState("u-9", 1, { getItem: () => null, setItem: () => false }).current, L.standardLayout()));

// 8. Reset restores the standard layout.
ok("P0.3 reset: after arranging, reset equals the standard Customer-pricing layout",
  L.layoutsEqual(L.presetLayout(L.STANDARD_PRESET_ID, reg3), std3) && !L.layoutsEqual(arranged, std3)
  && L.layoutsEqual(L.standardLayout(reg3), L.normalizeLayout(JSON.parse(JSON.stringify(L.serializeLayout(std3))))));
const hookSrc = layoutHookSrc;
ok("P0.3 reset: the hook's reset chooses the Standard preset", /reset = useCallback\(registry => choosePreset\(STANDARD_PRESET_ID, registry\)/.test(hookSrc));

// 9. Each shipped preset resolves to valid registered fields.
ok("P0.3 presets: the four shipped presets plus Standard", eq(L.PRESETS.map(p => p.label),
  ["Standard", "Negotiation", "BF Schedule", "Location Comparison", "Annual Terms"]));
for (const p of L.PRESETS) {
  const layout = L.presetLayout(p.id, reg3);
  const placed = [...layout.fields, ...layout.details, ...layout.hidden, ...(layout.recordGroupBy ? [layout.recordGroupBy] : [])];
  ok(`P0.3 preset ${p.label}: every named id is registered, every field placed exactly once`,
    L.presetProblems(p).length === 0 && placed.every(id => reg3.byId.has(id))
    && new Set(placed).size === placed.length && L.STATIC_FIELD_IDS.every(id => placed.includes(id))
    && viewOf(layout).fields.length > 0, L.presetProblems(p).join(","));
}
const bfPreset = L.presetLayout("bf_schedule", reg3);
ok("P0.3 preset BF Schedule: transposed, with one row per agreed BF grade (16, 18, 20, 22)",
  bfPreset.orientation === "transposed" && ["bf:16", "bf:18", "bf:20", "bf:22"].every(id => bfPreset.fields.includes(id)));
const locView = viewOf(L.presetLayout("location_comparison", reg3));
ok("P0.3 preset Location Comparison: records grouped by Location (Pune, Kolkata, and the lineless Oct cycle)",
  eq(locView.recordGroups.map(g => g.label), ["Not applicable", "FIX-PUNE", "FIX-KOLKATA"]));
ok("P0.3 preset: a typo in a preset would be caught", L.presetProblems({ spec: { fields: ["neg.final_agred", "@group:nope"] } }).length === 2);

// 10. An edit through Transposed or grouped view = the Standard edit.
const findCell = (layout, recordKey, fieldId) => {
  const m = L.gridMatrix(viewOf(layout));
  for (const row of m.cells) for (const c of row) if (c.recordKey === recordKey && c.fieldId === fieldId) return c;
  return null;
};
const sobInput = { sob_state: "percentage", sob_pct: "0" };
const views10 = { standard: std3, transposed: tr1, grouped: run(L.presetLayout("location_comparison", reg3), { type: "group" }),
  transposedGrouped: run(L.presetLayout("location_comparison", reg3), { type: "group" }, { type: "transpose" }) };
const sobMutations = Object.fromEntries(Object.entries(views10).map(([k, layout]) =>
  [k, L.cellMutation(findCell(layout, "line:32", "line.sob")?.ref, sobInput, data3)]));
const line32 = data3.cycles[1].lines[1];
const viaForm = lineBody(validateLineForm({ ...lineFormFromRecord(line32), ...sobInput }).normalised, line32.content_version);
ok("P0.3 edit: SOB on line 32 through Standard, Transposed, grouped and transposed-grouped sends ONE identical request",
  Object.values(sobMutations).every(m => m.ok && eq(m, sobMutations.standard)));
ok("P0.3 edit: that request is exactly the Edit-scope/SOB form's PATCH (same route, body, CAS version)",
  sobMutations.standard.method === "PATCH" && eq(sobMutations.standard.route, ["line", 32])
  && eq(sobMutations.standard.body, viaForm) && sobMutations.standard.body.expected_content_version === 1
  && sobMutations.standard.body.sob_pct === "0.00" && sobMutations.standard.body.sku_id === null);
const cycMuts = Object.values(views10).map(layout => run(layout, { type: "move", fieldId: "cycle.custom_label", zone: L.fieldAxisZone(layout), before: null }))
  .map(layout => L.cellMutation(findCell(layout, "line:33", "cycle.custom_label").ref, "Sep revised", data3));
ok("P0.3 edit: a Cycle field edited from any line's cell targets the Cycle (id 5, CAS v2), identically in every view",
  cycMuts.every(m => eq(m, cycMuts[0])) && eq(cycMuts[0].route, ["cycle", 5]) && cycMuts[0].body.expected_content_version === 2
  && eq(cycMuts[0].body, cycleBody({ ...cycleFormFromRecord(data3.cycles[1]), custom_label: "Sep revised" }, 2)));
const mT10 = L.gridMatrix(viewOf(tr1));
ok("P0.3 edit: in the transposed matrix every cell's target is its own record, i.e. its column's record",
  mT10.cells.every(row => row.every((c, k) => c.recordKey === mT10.cols[k]
    && (!c.ref || `${c.ref.recordType}:${c.ref.recordId}` === c.recordKey || c.ref.recordType === "cycle"))));
const reversed = structuredClone(data3);
reversed.cycles.reverse(); reversed.cycles.forEach(c => c.lines.reverse());
const refFromStd = findCell(std3, "line:32", "line.sob").ref;
ok("P0.3 edit: the target never follows visual position — reordering the records leaves the request unchanged",
  eq(L.cellMutation(refFromStd, sobInput, reversed), sobMutations.standard)
  && L.gridMatrix(L.buildView(reversed, std3, reg3)).cells[0][0].recordKey !== L.gridMatrix(viewOf(std3)).cells[0][0].recordKey);
ok("P0.3 edit: a CAS version is the one the cell was rendered from, never re-read at save time",
  (() => { const bumped = structuredClone(data3); bumped.cycles[1].lines[1].content_version = 7;
    return L.cellMutation(refFromStd, sobInput, bumped).body.expected_content_version === 1; })());
ok("P0.3 edit: validation is the form's — a percentage SOB without a % is refused before any request",
  !L.cellMutation(refFromStd, { sob_state: "percentage", sob_pct: "" }, data3).ok);
ok("P0.3 edit: summary/derived cells (rates, labels, Stable-Term values) are never grid-editable",
  ["neg.final_agreed", "cycle.label", "term.conversion", "bf:22", "mech.rate_basis"].every(id =>
    !findCell(run(std3, { type: "move", fieldId: id, zone: "columns", before: null }), "line:31", id).ref));
ok("P0.3 edit: the workspace commits through cellMutation + pricingPaths, the same transport as the forms",
  /cellMutation\(ref, input, state\.data\)/.test(workspace) && /pricingPaths\[m\.route\[0\]\]\(m\.route\[1\]\)/.test(workspace)
  && /pricingMutation\(path, m\.body, m\.method\)/.test(workspace));
ok("P0.3 edit: the line and cycle edit forms open from the same record->form helpers",
  /useState\(\(\) => lineFormFromRecord\(line\)\)/.test(lineDetail) && /useState\(\(\) => cycleFormFromRecord\(cycle\)\)/.test(workspace));

// 11. No pricing-history commercial data is written to browser storage.
const store11 = memStore();
const named11 = { Negotiation: L.presetLayout("negotiation", reg3), BF: bfPreset, Mine: arranged };
L.saveLayoutState("u-101", 9501, { current: views10.transposedGrouped, active: { kind: "named", name: "Mine" }, named: named11 }, store11);
const stored = [...store11.m.values()].join("\n");
const commercial = [];
(function collect(v) {
  if (v && typeof v === "object") { Object.values(v).forEach(collect); return; }
  // Controlled vocabulary (snake_case enums such as "paper_consumed") is not
  // commercial data and legitimately appears inside field ids.
  if (typeof v === "string" && v.length >= 3 && !/^[a-z_]+$/.test(v)) commercial.push(v);
})(data3);
ok("P0.3 storage: none of the payload's commercial strings (rates, codes, notes, dates, scopes) is stored",
  commercial.length > 40 && commercial.every(s => !stored.includes(s)), commercial.filter(s => stored.includes(s)).slice(0, 3).join(" | "));
const allowed = new Set(["v", "active", "current", "named", "kind", "id", "name", "orientation", "fields", "details",
  "hidden", "recordGroupBy", "pinned", "grouped", "collapsed", "dateMode", "Negotiation", "BF", "Mine"]);
const keysOf = v => (v && typeof v === "object" ? (Array.isArray(v) ? v.flatMap(keysOf)
  : Object.entries(v).flatMap(([k, x]) => [k, ...keysOf(x)])) : []);
ok("P0.3 storage: the stored document holds only layout keys (versioned), under the qgos_cph_layout key",
  keysOf(JSON.parse(stored)).every(k => allowed.has(k)) && JSON.parse(stored).v === L.LAYOUT_VERSION
  && [...store11.m.keys()].every(k => k === "qgos_cph_layout:u-101:9501"));
ok("P0.3 storage: a stored layout's strings are field ids, zone/flag values and view names only",
  (function strings(v) { return v && typeof v === "object" ? Object.values(v).flatMap(strings) : typeof v === "string" ? [v] : []; })(JSON.parse(stored))
    .every(s => /^(cycle|line|neg|term|comp|m|bf|mech)\.[a-z_]+$|^bf:[0-9A-Z]+$|^(standard|transposed|auto|named|negotiation)$|^(Negotiation|BF|Mine)$/.test(s)));
ok("P0.3 storage: the pricing payload itself is untouched by the whole P0.3 run", JSON.stringify(data3) === data3Json);

// ═══ P0.4 — Excel paste, filters, timeline and change history ═══════════════
// Pure-model level. Server re-validation, binding and atomic apply are proved
// by the backend route gate and the database rehearsal, not here.
const P = await import("../src/lib/customerPricingPaste.js");
const F = await import("../src/lib/customerPricingFilters.js");
const { P03_FIXTURE_CHANGES } = await import("../src/lib/customerPricingFixture.js");
const { timelineEvents } = await import("../src/lib/customerPricingModel.js");
const d4 = structuredClone(P03_FIXTURE_DATA);
const d4Json = JSON.stringify(d4);
const reg4 = L.buildFieldRegistry(d4);
const view4 = layout => L.buildView(d4, layout, reg4);
const inlineKeys = v => v.records.filter(r => r.line).map(r => r.key);
const plan4 = ({ layout, text, anchor, decisions, options, visibleKeys }) => {
  const v = view4(layout);
  const entries = P.mapPaste({ rows: P.parseClipboard(text).rows, view: v, visibleKeys: visibleKeys || (v.orientation === "standard" && !v.recordGroups ? inlineKeys(v) : v.records.map(r => r.key)), anchor });
  return P.buildPastePlan({ entries, data: d4, ctx: v.ctx, decisions, options: { roundDate: "2026-09-02", ...options } });
};
const targetsOf = plan => plan.cells.filter(c => c.record && String(c.text).trim())
  .map(c => `${c.record.key}|${c.field.id}|${c.text}`).sort();

// clipboard
const clip = P.parseClipboard("a\tb\r\n\"multi\nline\"\t\"say \"\"hi\"\"\"\r\n");
ok("P0.4 clipboard: Excel/Sheets TSV — CRLF rows, quoted multi-line cells, doubled quotes, no phantom last row",
  eq(clip.rows, [["a", "b"], ["multi\nline", "say \"hi\""]]));
ok("P0.4 clipboard: ragged rows are padded, never shifted", eq(P.parseClipboard("1\t2\n3").rows, [["1", "2"], ["3", ""]]));
ok("P0.4 clipboard: an oversized block is refused, not truncated",
  P.parseClipboard(Array(81).fill(Array(50).fill("x").join("\t")).join("\n")).error !== null);

// typed parsers
ok("P0.4 dates: ISO and day-first Indian forms", P.parsePasteDate("2026-08-30").value === "2026-08-30"
  && P.parsePasteDate("30/08/2026").value === "2026-08-30" && P.parsePasteDate("30-Aug-2026").value === "2026-08-30");
ok("P0.4 dates: a month-first US date or an Excel serial is refused, never swapped or guessed",
  !P.parsePasteDate("08/30/2026").ok && !P.parsePasteDate("46264").ok && !P.parsePasteDate("31/02/2026").ok);
ok("P0.4 SOB: %, explicit 0%, and the named states", eq(P.parsePasteSob("60%").value,
  { sob_state: "percentage", sob_pct: "60.00", sob_allocated_boxes: null })
  && P.parsePasteSob("0%").value.sob_pct === "0.00" && P.parsePasteSob("N/A").value.sob_state === "not_applicable"
  && P.parsePasteSob("Customer left undefined").value.sob_state === "undefined" && !P.parsePasteSob("100.5%").ok
  && !P.parsePasteSob("sixty").ok);

// Standard vs Transposed vs regrouped: identical canonical targets
const std4 = L.standardLayout(reg4);
const anchor4 = { recordKey: "line:31", fieldId: "line.sob" };
const sPlan = plan4({ layout: std4, text: "70%\t\n15%\t", anchor: anchor4 });
const tPlan = plan4({ layout: L.applyLayoutOp(std4, { type: "transpose" }), text: "70%\t15%", anchor: anchor4 });
ok("P0.4 mapping: Standard (lines down) and Transposed (lines across) reach the same records and fields",
  eq(targetsOf(sPlan).map(t => t.split("|").slice(0, 2).join("|")), ["line:31|line.sob", "line:32|line.sob"])
  && eq(targetsOf(sPlan), targetsOf(tPlan)));
ok("P0.4 mapping: … and produce the identical operations (same record ids, CAS versions, payload)",
  eq(sPlan.ops, tPlan.ops) && eq(sPlan.ops.map(o => [o.line_id, o.expected_version]), [[31, 4], [32, 1]]));
const regrouped = [{ type: "group" }, { type: "move", fieldId: "line.sob", zone: "columns", before: "cycle.label" },
  { type: "pin", fieldId: "neg.final_agreed" }].reduce((l, op) => L.applyLayoutOp(l, op), std4);
const gPlan = plan4({ layout: regrouped, text: "70%\n15%", anchor: anchor4 });
ok("P0.4 mapping: regrouped / reordered / pinned layouts do not move the paste targets",
  eq(gPlan.ops, sPlan.ops));
const hidden = L.applyLayoutOp(std4, { type: "move", fieldId: "line.sob", zone: "hidden", before: null });
const hPlan = plan4({ layout: hidden, text: "70%", anchor: { recordKey: "line:31", fieldId: "neg.rounds" } });
ok("P0.4 mapping: a hidden field is never written — the pasted column lands on the visible field there (a non-target)",
  hPlan.ops.length === 0 && hPlan.cells[0].field.id === "neg.rounds" && hPlan.cells[0].status === "not-target");
const locLayout4 = L.presetLayout("location_comparison", reg4);
const locView4 = view4(locLayout4);
const puneOnly = locView4.recordGroups.filter(g => g.label !== "FIX-KOLKATA").flatMap(g => g.records).map(r => r.key);
const cPlan = plan4({ layout: locLayout4, text: "90%\n91%", anchor: { recordKey: "line:33", fieldId: "line.sob" }, visibleKeys: puneOnly });
ok("P0.4 mapping: a collapsed record group is skipped, exactly as rendered",
  eq(targetsOf(cPlan).map(t => t.split("|")[0]), ["line:21", "line:33"].sort()));

// blank vs clear vs zero, INR exactness
const notesLayout = L.applyLayoutOp(std4, { type: "move", fieldId: "cycle.notes", zone: "columns", before: null });
const blankPlan = plan4({ layout: notesLayout, text: "\n", anchor: { recordKey: "line:31", fieldId: "cycle.notes" } });
ok("P0.4 blank: a blank cell over a recorded value changes nothing", blankPlan.ops.length === 0
  && blankPlan.cells[0].status === "blank" && blankPlan.cells[0].canClear);
const clearPlan = plan4({ layout: notesLayout, text: "\n", anchor: { recordKey: "line:31", fieldId: "cycle.notes" },
  decisions: { clear: new Set(["0:0"]) } });
ok("P0.4 clear: an explicit Clear erases ONLY that field of that record",
  eq(clearPlan.ops, [{ op: "update_cycle", cycle_id: 5, expected_version: 2, set: { notes: null } }]));
const zeroPlan = plan4({ layout: std4, text: "0%", anchor: { recordKey: "line:33", fieldId: "line.sob" } });
ok("P0.4 zero: explicit 0% survives as a percentage 0.00, never blank",
  eq(zeroPlan.ops[0].set, { sob_state: "percentage", sob_pct: "0.00", sob_allocated_boxes: null }));
const inrPlan = plan4({ layout: std4, text: "₹1,234.5", anchor: { recordKey: "line:32", fieldId: "neg.customer_offer" } });
ok("P0.4 INR: grouping and ₹ accepted, normalised to exact 2dp, pasted as a NEW round (history not overwritten)",
  inrPlan.ops[0].op === "add_round" && inrPlan.ops[0].rate_inr === "1234.50" && inrPlan.ops[0].line_id === 32
  && inrPlan.ops[0].event_date === "2026-09-02" && /₹1,234\.5/.test(inrPlan.ops[0].source_ref));
const badInr = plan4({ layout: std4, text: "54.555", anchor: { recordKey: "line:32", fieldId: "neg.customer_offer" } });
ok("P0.4 INR: a third decimal is invalid and yields no operation", badInr.cells[0].status === "invalid"
  && badInr.ops.length === 0 && badInr.blocking === 1);
const firstOffer = plan4({ layout: std4, text: "57.00", anchor: { recordKey: "line:31", fieldId: "neg.our_offer" } });
ok("P0.4 rounds: the recorded FIRST offer is never replaced by paste", firstOffer.cells[0].status === "invalid"
  && firstOffer.ops.length === 0);
const sameRate = plan4({ layout: std4, text: "54.25", anchor: { recordKey: "line:31", fieldId: "neg.final_agreed" } });
ok("P0.4 rounds: pasting the current value is Unchanged, not a new round", sameRate.cells[0].status === "unchanged"
  && sameRate.ops.length === 0);

// non-targets
for (const fid of ["neg.rounds", "line.basis", "cycle.label", "cycle.date"]) {
  const p = plan4({ layout: std4, text: "x", anchor: { recordKey: "line:31", fieldId: fid } });
  ok(`P0.4 non-target: ${fid} is derived/summary and never a write target`, p.cells[0].status === "not-target" && !p.ops.length);
}
ok("P0.4 non-target: Stable-Term, mechanism, BF-grade and measure fields name where to edit them instead",
  /Stable Terms/.test(P.notTargetReason(reg4.byId.get("term.conversion")))
  && /BF schedule/.test(P.notTargetReason(reg4.byId.get("bf:22")))
  && /per source/.test(P.notTargetReason(reg4.byId.get("m.paper_consumed"))));

// identities: exact only, never fuzzy; unresolved can stay free text
const idLayout = L.presetLayout("location_comparison", reg4);
const idStd = [{ type: "move", fieldId: "line.location", zone: "columns", before: "cycle.label" }]
  .reduce((l, op) => L.applyLayoutOp(l, op), L.standardLayout(reg4));
const newRowAnchor = { recordKey: "line:31", fieldId: "line.location" };
const five = "\n\n\n\n\n"; // five blank rows over the existing lines (31, 32, 33, 21, 22)
const newRow = t => plan4({ layout: idStd, text: `${five}${t}`, anchor: newRowAnchor, options: { newLineCycleId: "5" } });
const exact = newRow("FIX-KOLKATA");
ok("P0.4 identity: an exact Location code on a new row links that Location",
  exact.ops.some(o => o.op === "create_line" && o.customer_location_id === 12));
for (const t of ["fix-kolkata", "FIX-KOLKATA ", "FIX-KOLKATTA", "Kolkata"]) {
  const p = newRow(t);
  const linked = p.ops.some(o => o.op === "create_line" && o.customer_location_id != null);
  ok(`P0.4 identity: "${t}" ${t === "FIX-KOLKATA " ? "(trailing space trimmed) links" : "never auto-links"}`,
    t === "FIX-KOLKATA " ? linked : !linked && p.cells.some(c => c.status === "unresolved"));
}
const keep = plan4({ layout: idStd, text: `${five}Kolkata`, anchor: newRowAnchor, options: { newLineCycleId: "5" },
  decisions: { keepAsText: new Set(["5:0"]) } });
const keptOp = keep.ops.find(o => o.op === "create_line");
ok("P0.4 identity: an unresolved code kept as free text becomes item scope — NO identity is invented",
  keptOp && keptOp.customer_location_id === null && keptOp.plant_id === null && keptOp.sku_id === null
  && keptOp.scope_text === "Kolkata" && keep.cells.find(c => c.key === "5:0").status === "free-text");
const twoLocs = structuredClone(d4); twoLocs.locations.push({ id: 13, location_code: "FIX-PUNE" });
ok("P0.4 identity: two records sharing a code are AMBIGUOUS and blocked",
  P.resolveIdentity("customer_location_id", "FIX-PUNE", twoLocs).status === "ambiguous");
const mism = plan4({ layout: idStd, text: "FIX-KOLKATA", anchor: newRowAnchor });
ok("P0.4 identity: pasting a different Location over an EXISTING line never changes its scope (blocked)",
  mism.cells[0].status === "identity-mismatch" && mism.ops.length === 0 && mism.blocking === 1);

// free-text scope and deterministic duplicates on new lines
const scopeStd = L.applyLayoutOp(std4, { type: "move", fieldId: "line.scope_text", zone: "columns", before: "cycle.label" });
const scopeAnchor = { recordKey: "line:31", fieldId: "line.scope_text" };
const ft = plan4({ layout: scopeStd, text: `${five}Printed trays\t`, anchor: scopeAnchor, options: { newLineCycleId: "5" } });
ok("P0.4 free text: a new line's item text is retained as scope text, with no invented identity",
  eq(ft.ops.find(o => o.op === "create_line"), { op: "create_line", key: "n1", cycle_id: 5, customer_location_id: null,
    plant_id: null, sku_id: null, scope_text: "Printed trays" }));
const dupRows = `${five}Lids\n lids \nTrays`;
const dupA = plan4({ layout: scopeStd, text: dupRows, anchor: scopeAnchor, options: { newLineCycleId: "5" } });
const dupB = plan4({ layout: scopeStd, text: dupRows, anchor: scopeAnchor, options: { newLineCycleId: "5" } });
const dupStatus = p => p.cells.filter(c => !c.record && String(c.text).trim()).map(c => `${c.key}:${c.status}`);
ok("P0.4 duplicates: the SECOND of two same-scope new rows is the duplicate (case/space-insensitive), every time",
  eq(dupStatus(dupA), ["5:0:free-text", "6:0:duplicate", "7:0:free-text"]) && eq(dupStatus(dupA), dupStatus(dupB)));
ok("P0.4 duplicates: exact scope includes Location/Plant/SKU — whole-Customer 'Trays' is NOT line 33's Pune·NAG·SKU 'Trays'",
  dupA.cells.find(c => c.key === "7:0").status === "free-text");
const wholeTrays = structuredClone(d4);
Object.assign(wholeTrays.cycles[1].lines[2], { customer_location_id: null, plant_id: null, sku_id: null });
const wtView = L.buildView(wholeTrays, scopeStd, reg4);
const wtPlan = P.buildPastePlan({ entries: P.mapPaste({ rows: P.parseClipboard(`${five}TRAYS`).rows, view: wtView,
  visibleKeys: wtView.records.filter(r => r.line).map(r => r.key), anchor: scopeAnchor }), data: wholeTrays, ctx: wtView.ctx,
  options: { newLineCycleId: "5", roundDate: "2026-09-02" } });
ok("P0.4 duplicates: a new row with EXACTLY an existing active line's scope in that Cycle is a duplicate",
  wtPlan.cells.find(c => c.key === "5:0").status === "duplicate" && !wtPlan.ops.length);
ok("P0.4 duplicates: blocked rows yield no operation; the clean ones still do",
  dupA.ops.filter(o => o.op === "create_line").length === 2 && dupA.blocking === 1);
ok("P0.4 new lines: without a chosen Cycle nothing is created and the preview says why",
  plan4({ layout: scopeStd, text: `${five}Lids`, anchor: scopeAnchor, options: { newLineCycleId: "" } }).ops.length === 0
  && plan4({ layout: scopeStd, text: `${five}Lids`, anchor: scopeAnchor, options: { newLineCycleId: "" } }).planIssues.length === 1);

// conflict and invalid cells cannot slip through
const twoLines = plan4({ layout: notesLayout, text: "A\nB", anchor: { recordKey: "line:31", fieldId: "cycle.notes" } });
ok("P0.4 conflict: different values pasted for one Cycle field from two of its lines are blocked, not last-wins",
  twoLines.cells.slice(0, 2).every(c => c.status === "conflict") && !twoLines.ops.some(o => o.op === "update_cycle"));
const mixed = plan4({ layout: std4, text: "70%\nabc", anchor: anchor4 });
ok("P0.4 invalid: an invalid cell blocks Apply and contributes no operation; valid cells are still previewed",
  mixed.blocking === 1 && eq(mixed.ops.map(o => o.line_id), [31]));
ok("P0.4 one batch: the whole paste is ONE request body — never one request per cell",
  eq(Object.keys(P.pasteRequestBody(sPlan)), ["operations"]) && P.pasteRequestBody(sPlan).operations.length === 2);
const issueCells = P.issuesToCells(sPlan, [{ index: 1, code: "STALE_VERSION", message: "the Line changed" }]);
ok("P0.4 server issues map back to the exact pasted cell that produced the operation",
  issueCells.size === 1 && issueCells.has("1:0") && issueCells.get("1:0").code === "STALE_VERSION");
ok("P0.4 CAS: every update carries the version the preview was built from",
  sPlan.ops.every(o => o.expected_version === d4.cycles.flatMap(c => c.lines).find(l => l.id === o.line_id).content_version));

// BF schedule paste
const ev312 = d4.cycles[1].lines[1].events.find(e => e.id === 312);
const ev304 = d4.cycles[1].lines[0].events.find(e => e.id === 304);
const bfp = (event, text, extra = {}) => P.buildBfPastePlan({ event, rows: P.parseClipboard(text).rows, ...extra });
const bp1 = bfp(ev312, "20\t55.75\n22\t57.00");
ok("P0.4 BF: grade-keyed rows; a value equal to the derived rate stays derived (no override)",
  bp1.mode === "grade-keyed" && bp1.items[0].status === "unchanged" && bp1.items[0].derived === "55.75");
ok("P0.4 BF: a value different from the derived rate is NEVER silently an override (blocked without consent)",
  bp1.items[1].status === "needs-override-consent" && bp1.ops.length === 0 && bp1.blocking === 1);
const bp2 = bfp(ev312, "20\t55.75\n22\t57.00", { options: { acceptOverrides: true } });
ok("P0.4 BF: with explicit consent it is an override on exactly that round and version",
  eq(bp2.ops, [{ op: "set_bf_override", event_id: 312, expected_version: 1, bf_code: "22", override_rate_inr: "57.00" }])
  && eq(bp2.target, { eventId: 312, version: 1, sequence: 2 }));
const bp3 = bfp(ev304, "22\t57.50");
ok("P0.4 BF: re-pasting the derived rate over an existing override keeps the override unless Clear is chosen",
  bp3.items[0].status === "matches-derived" && bp3.ops.length === 0);
const bp4 = bfp(ev304, "22\t57.50", { decisions: { clear: new Set(["bf:0"]) } });
ok("P0.4 BF: explicit Clear returns that grade to derived (override null), derived and override kept distinct",
  eq(bp4.ops, [{ op: "set_bf_override", event_id: 304, expected_version: 1, bf_code: "22", override_rate_inr: null }]));
const bp5 = bfp(ev312, "24\t60.00\n20\t56.00\n20\t56.10\n18\t55.00", { options: { acceptOverrides: true } });
ok("P0.4 BF: a grade outside the round's snapshot, a duplicate grade and a changed base BF are all blocked",
  eq(bp5.items.map(i => i.status), ["unresolved", "override", "duplicate", "invalid"]) && bp5.blocking === 3);
ok("P0.4 BF: grade codes match exactly (case only) — '22gy' is not '22'",
  bfp(ev312, "22gy\t1.00").items[0].status === "unresolved");
const bp6 = bfp(ev312, "53.25\n54.25\n55.75", { anchorGrade: "16" });
ok("P0.4 BF: a single column is laid on the schedule rows from the chosen grade",
  bp6.mode === "positional" && eq(bp6.items.map(i => [i.grade, i.status]), [["16", "unchanged"], ["18", "unchanged"], ["20", "unchanged"]]));

// filters
const fv = f => F.applyFilters(view4(std4), { ...F.EMPTY_FILTERS, ...f });
ok("P0.4 filters: Location narrows to its lines and says shown-of-total; a lineless Cycle is not shown as a match",
  eq(fv({ location: "12" }).records.map(r => r.key), ["line:32", "line:22"]) && eq(fv({ location: "12" }).filtered,
    { active: true, shown: 2, total: 6 }));
ok("P0.4 filters: negotiation state, BF grade, status and period", eq(fv({ negotiation: "none" }).records.map(r => r.key), ["line:33"])
  && eq(fv({ negotiation: "agreed", bfGrade: "22" }).records.map(r => r.key), ["line:31", "line:32", "line:21", "line:22"])
  && eq(fv({ status: "closed" }).records.map(r => r.cycle.id), [4, 4]) && fv({ from: "2026-10-01" }).records.length === 1);
ok("P0.4 filters: SKU / item search is a display search over what the row shows (SKU code, scope text)",
  eq(fv({ text: "fix/nag/0001" }).records.map(r => r.key), ["line:33"]) && eq(fv({ text: "trays" }).records.map(r => r.key), ["line:33"]));
ok("P0.4 filters: no filter means no narrowing and it says so; canonical data untouched",
  eq(fv({}).filtered, { active: false, shown: 6, total: 6 }) && JSON.stringify(d4) === d4Json);
ok("P0.4 filters: a summary over the filtered view speaks only for the shown lines (never claims hidden ones)",
  L.summarizeField(reg4.byId.get("line.plant"), fv({ location: "12" }).records, view4(std4).ctx).state === "common");

// timeline + change history
const line31 = d4.cycles[1].lines[0];
ok("P0.4 timeline: every round in chronology including the VOIDED one; the summary still ignores it",
  eq(timelineEvents(line31.events).map(e => e.id), [301, 306, 302, 303, 304])
  && negotiationSummary(line31.events).customerOffer.id === 302 && negotiationSummary(line31.events).rounds === 4);
ok("P0.4 history: a line's entries include its own, its rounds' and voids — from the one loaded page (no per-row reads)",
  eq(F.changesForLine(P03_FIXTURE_CHANGES.changes, line31).map(c => c.id), [9004, 9003, 9002])
  && F.changesForLine(P03_FIXTURE_CHANGES.changes, d4.cycles[1].lines[1]).length === 0);
const histSrc = read("src/tabs/customer-pricing/ChangeHistoryPanel.jsx") + read("src/tabs/customer-pricing/useChangeHistory.js");
ok("P0.4 history states: denied, unavailable, failed+retry, partial (older pages / hidden names) and stale are each said",
  /cannot read this change history/.test(histSrc) && /not activated in this environment/.test(histSrc)
  && /Retry/.test(histSrc) && /older entries exist/.test(histSrc) && /not visible to you/.test(histSrc)
  && /changed since this was read/.test(histSrc));
ok("P0.4 history: an actor the caller cannot read is shown as missing, never guessed",
  /name not visible to you/.test(histSrc) && /c\.actor_name \|\|/.test(histSrc));
const lineDetail4 = read("src/tabs/customer-pricing/PricingLineDetail.jsx");
ok("P0.4 timeline: voided rounds are shown and cannot be corrected; corrections show their version",
  /timelineEvents\(line\.events\)/.test(lineDetail4) && /!isCorrecting && !isVoiding && !voided/.test(lineDetail4) && /corrected, v/.test(lineDetail4));

// transport shape: one pair, not per cell
const submitSrc = read("src/tabs/customer-pricing/usePasteSubmit.js");
ok("P0.4 transport: paste uses exactly the preview and apply routes, once each per action",
  (submitSrc.match(/pricingMutation\(/g) || []).length === 2 && /pastePreview/.test(submitSrc) && /pasteApply/.test(submitSrc)
  && !/pricingMutation|apiFetch/.test(read("src/lib/customerPricingPaste.js")));
ok("P0.4 transport: apply sends only the prepared preview id and digest",
  /\{ preview_id: previewId, digest \}/.test(submitSrc));
ok("P0.4 drafts: every failure keeps the pasted draft — the text lives in the panel, not in the submit state",
  /useState\(input\.text\)/.test(read("src/tabs/customer-pricing/PastePreviewPanel.jsx"))
  && /Your pasted draft and decisions are kept/.test(read("src/tabs/customer-pricing/PastePreviewPanel.jsx")));
ok("P0.4: the canonical fixture payload is unchanged by the whole P0.4 run", JSON.stringify(d4) === d4Json);

// ═══ P0.4.1 — SOB as a percentage OR an allocated box quantity ═════════════
// Pure-model level. Route validation, the DB check constraints, CAS, audit and
// atomic paste apply are proved by the backend gate and the rollback rehearsal.
{
  const M = await import("../src/lib/customerPricingModel.js");
  const { parseBoxes, formatBoxes, sobValue } = M;

  // exact whole boxes: blank ≠ 0, nothing rounded, nothing beyond the bound
  ok("P0.4.1 boxes: blank stays blank, explicit 0 stays \"0\", grouping typed by the user is display only",
    eq(parseBoxes(""), { ok: true, value: null }) && parseBoxes("0").value === "0"
    && parseBoxes("25,000").value === "25000" && parseBoxes("007").value === "7");
  ok("P0.4.1 boxes: fractional, negative, exponent and unit text are refused, never rounded",
    ["12.5", "12.0", "-1", "1e3", "25000 boxes", "abc"].every(t => !parseBoxes(t).ok)
    && /no decimals/.test(parseBoxes("12.5").error) && /negative/.test(parseBoxes("-1").error));
  ok("P0.4.1 boxes: the bound is exact and an unsafe JS integer is refused without precision loss",
    parseBoxes("999999999").value === "999999999" && !parseBoxes("1000000000").ok
    && !parseBoxes("9007199254740993").ok && typeof parseBoxes("999999999").value === "string");
  ok("P0.4.1 boxes: displayed as boxes with Indian grouping; 0 and 1 read naturally",
    formatBoxes("25000") === "25,000 boxes" && formatBoxes("0") === "0 boxes" && formatBoxes("1") === "1 box"
    && formatBoxes("2500000") === "25,00,000 boxes" && formatBoxes(null) === "—");
  ok("P0.4.1 labels: 40.00%, 25,000 boxes, 0 boxes and the three named states",
    sobDisplay({ sob_state: "percentage", sob_pct: "40.00" }) === "40.00%"
    && sobDisplay({ sob_state: "allocated_quantity", sob_allocated_boxes: "25000" }) === "25,000 boxes"
    && sobDisplay({ sob_state: "allocated_quantity", sob_allocated_boxes: "0" }) === "0 boxes"
    && sobDisplay({ sob_state: "not_captured" }) === "Not yet captured"
    && sobDisplay({ sob_state: "undefined" }) === "Customer left undefined"
    && sobDisplay({ sob_state: "not_applicable" }) === "Not applicable");

  // 1. mutually exclusive in the form and body
  ok("P0.4.1 form: allocated quantity requires boxes; fractional / negative boxes are refused",
    !validateLineForm({ sob_state: "allocated_quantity", sob_allocated_boxes: "" }).ok
    && validateLineForm({ sob_state: "allocated_quantity", sob_allocated_boxes: "12.5" }).errors.sob_allocated_boxes
    && !validateLineForm({ sob_state: "allocated_quantity", sob_allocated_boxes: "-4" }).ok);
  const pctLeft = validateLineForm({ sob_state: "percentage", sob_pct: "40", sob_allocated_boxes: "900" }).normalised;
  const boxLeft = validateLineForm({ sob_state: "allocated_quantity", sob_pct: "40", sob_allocated_boxes: "25,000" }).normalised;
  ok("P0.4.1 body: only the chosen mode's value is sent; the other is null even if a stale value sits in the form",
    lineBody(pctLeft).sob_pct === "40.00" && lineBody(pctLeft).sob_allocated_boxes === null
    && lineBody(boxLeft).sob_allocated_boxes === "25000" && lineBody(boxLeft).sob_pct === null
    && lineBody({ sob_state: "undefined", sob_pct: "5", sob_allocated_boxes: "5" }).sob_pct === null
    && lineBody({ sob_state: "undefined", sob_pct: "5", sob_allocated_boxes: "5" }).sob_allocated_boxes === null);

  // 2. blank, 0.00% and 0 boxes stay distinct
  const keys = [{ sob_state: "not_captured" }, { sob_state: "percentage", sob_pct: "0.00" },
    { sob_state: "allocated_quantity", sob_allocated_boxes: "0" }, { sob_state: "undefined" }]
    .map(l => L.comparisonKey(sobValue(l)));
  ok("P0.4.1 compare: not captured, 0.00%, 0 boxes and undefined are four different canonical values",
    new Set(keys).size === 4);

  // 5. Standard, Transposed and grouped editing: same line, payload and CAS
  const boxInput = { sob_state: "allocated_quantity", sob_pct: "", sob_allocated_boxes: "0" };
  const boxMuts = Object.entries(views10).map(([k, layout]) =>
    [k, L.cellMutation(findCell(layout, "line:32", "line.sob")?.ref, boxInput, data3)]);
  const viaForm32 = lineBody(validateLineForm({ ...lineFormFromRecord(line32), ...boxInput }).normalised, line32.content_version);
  ok("P0.4.1 edit: 0 boxes on line 32 via Standard, Transposed, grouped and transposed-grouped is ONE identical request",
    boxMuts.every(([, m]) => m.ok && eq(m, boxMuts[0][1])));
  ok("P0.4.1 edit: … and it is the line form's PATCH: line 32, CAS v1, boxes \"0\", % null, scope ids unchanged",
    eq(boxMuts[0][1].route, ["line", 32]) && eq(boxMuts[0][1].body, viaForm32)
    && boxMuts[0][1].body.expected_content_version === 1 && boxMuts[0][1].body.sob_allocated_boxes === "0"
    && boxMuts[0][1].body.sob_pct === null && boxMuts[0][1].body.customer_location_id === 12
    && boxMuts[0][1].body.plant_id === 8 && boxMuts[0][1].body.sku_id === null);
  ok("P0.4.1 edit: the grid editor opens with the line's stored box quantity; a fractional one is refused before any request",
    L.cellEditorValue({ recordType: "line", recordId: 22, fieldId: "sob" }, data3).sob_allocated_boxes === "25000"
    && !L.cellMutation(refFromStd, { sob_state: "allocated_quantity", sob_allocated_boxes: "2.5" }, data3).ok);

  // 6/7. common vs Mixed summaries, and the contributing line records
  const d41 = structuredClone(P03_FIXTURE_DATA);
  const sep = d41.cycles.find(c => c.id === 5).lines;
  const setSob = (line, state, pct = null, boxes = null) => Object.assign(line, { sob_state: state, sob_pct: pct,
    sob_allocated_boxes: boxes });
  const reg41 = L.buildFieldRegistry(d41);
  const sobOf = () => L.summarizeField(reg41.byId.get("line.sob"),
    L.canonicalRecords(d41).filter(r => r.cycle.id === 5), L.buildContext(d41));
  sep.forEach(l => setSob(l, "allocated_quantity", null, "25000"));
  const common = sobOf();
  setSob(sep[0], "percentage", "40.00"); setSob(sep[1], "allocated_quantity", null, "40");
  const pctVsBoxes = sobOf();
  sep.forEach(l => setSob(l, "allocated_quantity", null, "25000")); setSob(sep[1], "allocated_quantity", null, "30000");
  const boxesDiffer = sobOf();
  sep.forEach(l => setSob(l, "percentage", "40.00")); setSob(sep[1], "percentage", "45.00");
  const pctDiffer = sobOf();
  sep.forEach(l => setSob(l, "not_captured")); setSob(sep[1], "allocated_quantity", null, "0");
  const blankVsZeroBoxes = sobOf();
  sep.forEach(l => setSob(l, "percentage", "0.00")); setSob(sep[1], "allocated_quantity", null, "0");
  const zeroPctVsZeroBoxes = sobOf();
  ok("P0.4.1 summary: the same box quantity on every line is ONE common value (25,000 boxes)",
    common.state === "common" && common.display === "25,000 boxes");
  ok("P0.4.1 summary: 40.00% vs 40 boxes is Mixed — a percentage is never merged with a quantity",
    pctVsBoxes.state === "mixed" && pctVsBoxes.contributors.some(c => c.display === "40.00%")
    && pctVsBoxes.contributors.some(c => c.display === "40 boxes"));
  ok("P0.4.1 summary: differing box quantities and differing percentages are each Mixed",
    boxesDiffer.state === "mixed" && pctDiffer.state === "mixed");
  ok("P0.4.1 summary: blank vs 0 boxes and 0.00% vs 0 boxes are Mixed, never a common zero",
    blankVsZeroBoxes.state === "mixed" && zeroPctVsZeroBoxes.state === "mixed"
    && zeroPctVsZeroBoxes.contributors.some(c => c.display === "0.00%")
    && zeroPctVsZeroBoxes.contributors.some(c => c.display === "0 boxes"));
  ok("P0.4.1 disclosure: a Mixed SOB names each contributing canonical LINE record with its version",
    eq(pctVsBoxes.contributors.map(c => [c.recordType, c.recordId, c.version]),
      sep.map(l => ["line", l.id, l.content_version])));

  // 8. Start next cycle carries neither SOB value (the DB resets it; see the rehearsal)
  ok("P0.4.1 next cycle: the request carries no SOB state, % or box quantity",
    !Object.keys(nextCycleBody({ period_start: "2026-10-01", period_end: "2026-10-31", initiated_on: "2026-09-24",
      sob_state: "allocated_quantity", sob_allocated_boxes: "25000", sob_pct: "40" })).some(k => /sob/.test(k)));

  // paste: %, boxes and ambiguity
  ok("P0.4.1 paste parse: \"%\" is only a percentage and \"boxes\" only a quantity",
    eq(P.parsePasteSob("40%").value, { sob_state: "percentage", sob_pct: "40.00", sob_allocated_boxes: null })
    && eq(P.parsePasteSob("25,000 boxes").value, { sob_state: "allocated_quantity", sob_pct: null, sob_allocated_boxes: "25000" })
    && P.parsePasteSob("1 box").value.sob_allocated_boxes === "1"
    && eq(P.parsePasteSob("0 boxes").value, { sob_state: "allocated_quantity", sob_pct: null, sob_allocated_boxes: "0" })
    && eq(P.parsePasteSob("0%").value, { sob_state: "percentage", sob_pct: "0.00", sob_allocated_boxes: null }));
  ok("P0.4.1 paste parse: a bare number is AMBIGUOUS until a mode is chosen; the choice decides, nothing is guessed",
    P.parsePasteSob("40").ok === false && P.parsePasteSob("40").status === "ambiguous" && P.parsePasteSob("0").status === "ambiguous"
    && P.parsePasteSob("40", "percentage").value.sob_pct === "40.00"
    && P.parsePasteSob("40", "allocated_quantity").value.sob_allocated_boxes === "40"
    && !P.parsePasteSob("12.5", "allocated_quantity").ok && P.parsePasteSob("12.5", "percentage").ok);
  ok("P0.4.1 paste parse: fractional, negative and out-of-range box quantities are refused",
    !P.parsePasteSob("12.5 boxes").ok && !P.parsePasteSob("-3 boxes").ok && !P.parsePasteSob("1000000000 boxes").ok
    && !P.parsePasteSob("150%").ok);

  const at22 = { recordKey: "line:22", fieldId: "line.sob" };
  const blank22 = plan4({ layout: std4, text: "\n", anchor: at22 });
  ok("P0.4.1 paste blank: a blank cell over 25,000 boxes changes nothing (Clear is offered, not applied)",
    blank22.ops.length === 0 && blank22.cells[0].status === "blank" && blank22.cells[0].canClear);
  const clear22 = plan4({ layout: std4, text: "\n", anchor: at22, decisions: { clear: new Set(["0:0"]) } });
  ok("P0.4.1 paste clear: an explicit Clear empties BOTH values and returns SOB to Not yet captured, line 22 only",
    eq(clear22.ops, [{ op: "update_line", line_id: 22, expected_version: 1,
      set: { sob_state: "not_captured", sob_pct: null, sob_allocated_boxes: null } }])
    && clear22.cells[0].before === "25,000 boxes" && clear22.cells[0].after === "Not yet captured");
  const zero22 = plan4({ layout: std4, text: "0 boxes", anchor: at22 });
  ok("P0.4.1 paste zero: explicit 0 boxes survives as quantity zero (and clears nothing else)",
    eq(zero22.ops[0].set, { sob_state: "allocated_quantity", sob_pct: null, sob_allocated_boxes: "0" })
    && zero22.cells[0].after === "0 boxes");
  const same22 = plan4({ layout: std4, text: "25,000 boxes", anchor: at22 });
  ok("P0.4.1 paste: the recorded quantity pasted again is Unchanged, not a write", same22.ops.length === 0
    && same22.cells[0].status === "unchanged");
  const pctPlan = plan4({ layout: std4, text: "40%", anchor: at22 });
  const boxPlan = plan4({ layout: std4, text: "40 boxes", anchor: at22 });
  ok("P0.4.1 paste: 40% and 40 boxes cannot be confused — different states, only one value each",
    pctPlan.ops[0].set.sob_state === "percentage" && pctPlan.ops[0].set.sob_pct === "40.00"
    && pctPlan.ops[0].set.sob_allocated_boxes === null
    && boxPlan.ops[0].set.sob_state === "allocated_quantity" && boxPlan.ops[0].set.sob_allocated_boxes === "40"
    && boxPlan.ops[0].set.sob_pct === null);
  const amb = plan4({ layout: std4, text: "40", anchor: at22 });
  ok("P0.4.1 paste ambiguity: a bare 40 is blocked, offers the explicit choice, and sends nothing",
    amb.cells[0].status === "ambiguous" && amb.cells[0].sobModeChoice && amb.ops.length === 0 && amb.blocking === 1);
  const asBoxes = plan4({ layout: std4, text: "40", anchor: at22, decisions: { sobAsBoxes: new Set(["0:0"]) } });
  const asPct = plan4({ layout: std4, text: "40", anchor: at22, decisions: { sobAsPct: new Set(["0:0"]) } });
  ok("P0.4.1 paste ambiguity: resolved only by the user's choice — Treat as boxes / Treat as %",
    asBoxes.blocking === 0 && asBoxes.ops[0].set.sob_allocated_boxes === "40" && asBoxes.cells[0].sobModeChoice
    && asPct.blocking === 0 && asPct.ops[0].set.sob_pct === "40.00" && asPct.ops[0].set.sob_allocated_boxes === null);
  const two = plan4({ layout: std4, text: "40%\n0 boxes", anchor: { recordKey: "line:31", fieldId: "line.sob" } });
  ok("P0.4.1 paste batch: two lines of SOB are two operations in ONE plan / one request body, each with its own CAS",
    eq(two.ops.map(o => [o.op, o.line_id, o.expected_version, o.set.sob_state]),
      [["update_line", 31, 4, "percentage"], ["update_line", 32, 1, "allocated_quantity"]])
    && eq(P.pasteRequestBody(two), { operations: two.ops }));
  const transposedTwo = plan4({ layout: L.applyLayoutOp(std4, { type: "transpose" }), text: "40%\t0 boxes",
    anchor: { recordKey: "line:31", fieldId: "line.sob" } });
  ok("P0.4.1 paste mapping: the same SOB paste through Transposed produces the identical operations",
    eq(transposedTwo.ops, two.ops));
  const lastKey = inlineKeys(view4(std4)).at(-1);
  const newRow = plan4({ layout: std4, text: "25,000 boxes", anchor: { recordKey: lastKey, fieldId: "line.sob" },
    visibleKeys: [lastKey], options: { newLineCycleId: "5" } });
  const newRow2 = plan4({ layout: std4, text: "x\n25,000 boxes", anchor: { recordKey: lastKey, fieldId: "line.sob" },
    visibleKeys: [lastKey], options: { newLineCycleId: "5" } });
  const created = newRow2.ops.find(o => o.op === "create_line");
  ok("P0.4.1 paste identity: a quantity on a new row manufactures no Location, Plant or SKU",
    newRow.ops.every(o => o.op !== "create_line") && created && created.customer_location_id === null
    && created.plant_id === null && created.sku_id === null && created.sob_allocated_boxes === "25000"
    && created.sob_pct === null);

  // filters
  ok("P0.4.1 filters: percentage, allocated boxes and the named states are separate choices",
    eq(fv({ sob: "allocated_quantity" }).records.map(r => r.key), ["line:22"])
    && eq(fv({ sob: "percentage" }).records.map(r => r.key).sort(), ["line:21", "line:31", "line:32"])
    && eq(fv({ sob: "undefined" }).records.map(r => r.key), ["line:33"])
    && fv({ sob: "not_captured" }).records.length === 0 && F.filtersActive({ ...F.EMPTY_FILTERS, sob: "percentage" }));

  // history, UI surfaces
  const hist41 = read("src/tabs/customer-pricing/ChangeHistoryPanel.jsx");
  ok("P0.4.1 history: SOB mode, % and boxes are labelled in words; blank stays —, from the one loaded page",
    /sob_state: "SOB mode"/.test(hist41) && /sob_allocated_boxes: "SOB allocated boxes"/.test(hist41)
    && /formatBoxes/.test(hist41) && F.changesForLine(P03_FIXTURE_CHANGES.changes, d4.cycles[2].lines[1])
      .some(c => c.fields.some(f => f.field === "sob_allocated_boxes" && f.after === "25000")));
  const uiSrc = ["PricingMatrix.jsx", "PricingLineDetail.jsx", "CustomerPricingHistory.jsx"]
    .map(f => read(`src/tabs/customer-pricing/${f}`));
  ok("P0.4.1 UI: the grid editor, line form and new-line form each offer an explicit allocated-boxes input",
    uiSrc.every(s => /sob_state === "allocated_quantity"/.test(s) && /sob_allocated_boxes/.test(s)
      && !/"defined"/.test(s)));
  ok("P0.4.1 UI: the paste preview offers Treat as % / Treat as boxes for a bare SOB number",
    /Treat as %/.test(read("src/tabs/customer-pricing/PastePreviewPanel.jsx"))
    && /Treat as boxes/.test(read("src/tabs/customer-pricing/PastePreviewPanel.jsx")));
  ok("P0.4.1: no retired \"defined\" SOB state survives in the pricing modules",
    !["src/lib/customerPricingModel.js", "src/lib/customerPricingLayout.js", "src/lib/customerPricingPaste.js",
      "src/lib/customerPricingFixture.js"].some(f => /"defined"/.test(read(f))));
  ok("P0.4.1: the canonical fixture payload is unchanged by the P0.4.1 run", JSON.stringify(d4) === d4Json);
}

// ═══ P0.5 — Beta-laptop (1366x768) qualification regression ═══════════════
// Measured in the fixture browser: the expanded negotiation timeline was
// 1,497px wide inside a 1,325px matrix at 1366px, pushing the round actions
// and the BF-schedule paste box off-screen. The three wide text columns are
// capped (full text stays in the hover title), which measured 1,281px.
{
  const tl = read("src/tabs/customer-pricing/PricingLineDetail.jsx");
  const capOf = re => Number((tl.match(re) || [])[1] ?? 999);
  const caps = [capOf(/maxWidth: (\d+) \}\} title=\{componentsCell\(e\)\}/),
    capOf(/maxWidth: (\d+) \}\} title=\{\[labelOf\(SOURCE_TYPES/), capOf(/maxWidth: (\d+) \}\} title=\{\[e\.notes/)];
  ok("P0.5 laptop: the timeline's Components, Source and Notes columns are capped at <= 160px (fits 1366x768)",
    caps.length >= 3 && caps.every(w => w <= 160));
  ok("P0.5 laptop: a capped Source cell still discloses its full text on hover",
    /title=\{\[labelOf\(SOURCE_TYPES, e\.source_type\), e\.source_date, e\.source_ref\]/.test(tl));
}

// ═══ P0.5 — Void a negotiation round (governed, audited, never a delete) ════
// Pure model + source shape. The DB status-only change, freeze, CAS and audit
// atomicity are proved by tests/cph_p0_5_void_rehearsal.sql; the route by
// tests/test_customer_pricing_p0_5_void_routes.py.
{
  const M = await import("../src/lib/customerPricingModel.js");
  const { validateVoidReason, voidRoundBody, timelineEvents: tlEvents, priorAgreedFor: priorFor } = M;

  ok("P0.5 void reason: blank, two characters and 501 characters are refused before any request",
    !validateVoidReason("").ok && !validateVoidReason("   ").ok && !validateVoidReason(" ab ").ok
    && !validateVoidReason("x".repeat(501)).ok && validateVoidReason("x".repeat(500)).ok);
  ok("P0.5 void reason: trimmed, and the body names exactly the Customer, the version read and the reason",
    validateVoidReason("  wrong line  ").value === "wrong line"
    && eq(voidRoundBody(9501, 4, "  wrong line "), { party_id: 9501, expected_content_version: 4, reason: "wrong line" }));
  ok("P0.5 void route: POST /masters/pricing-events/<id>/void (a sub-resource of the event, never DELETE)",
    /voidEvent: eventId => `\/masters\/pricing-events\/\$\{eventId\}\/void`/.test(read("src/lib/customerPricingActions.js")));

  // summaries recalculate from ACTIVE rounds only; chronology keeps every round
  const r = (id, seq, type, date, rate, status = "active") => ({ id, sequence_no: seq, event_type: type, event_date: date,
    rate_inr: rate, status });
  const rounds = [r(1, 1, "avadhoot_offer", "2026-08-01", "56.00"), r(2, 2, "avadhoot_offer", "2026-08-02", "55.50"),
    r(3, 3, "customer_counter", "2026-08-03", "52.00"), r(4, 4, "customer_counter", "2026-08-04", "53.00"),
    r(5, 5, "final_agreement", "2026-08-05", "54.00"), r(6, 6, "final_agreement", "2026-08-06", "54.25")];
  const voidIds = (...ids) => rounds.map(e => (ids.includes(e.id) ? { ...e, status: "voided" } : e));
  const s0 = negotiationSummary(rounds);
  const sOffer = negotiationSummary(voidIds(1));
  const sCounter = negotiationSummary(voidIds(4));
  const sFinal = negotiationSummary(voidIds(6));
  const sNoFinal = negotiationSummary(voidIds(5, 6));
  ok("P0.5 void summary: a voided first offer hands 'Our offer' to the next ACTIVE offer",
    s0.ourOffer.id === 1 && sOffer.ourOffer.id === 2);
  ok("P0.5 void summary: a voided latest counter hands 'Customer offer' to the previous active counter",
    s0.customerOffer.id === 4 && sCounter.customerOffer.id === 3);
  ok("P0.5 void summary: voiding the current final agreement reveals the previous ACTIVE final agreement",
    s0.finalAgreed.id === 6 && sFinal.finalAgreed.id === 5 && sFinal.finalAgreed.rate_inr === "54.00");
  ok("P0.5 void summary: with every final agreement voided the line has NO agreement (blank, no rate restored)",
    sNoFinal.finalAgreed === null && sNoFinal.ourOffer.id === 1);
  const tl = tlEvents(voidIds(1, 4, 6));
  ok("P0.5 void chronology: voided rounds stay in the timeline, in place, with their numbers and rates",
    eq(tl.map(e => [e.id, e.sequence_no, e.status]), [[1, 1, "voided"], [2, 2, "active"], [3, 3, "active"],
      [4, 4, "voided"], [5, 5, "active"], [6, 6, "voided"]]) && tl[0].rate_inr === "56.00");

  // the compact grid cell and the prior-cycle comparison follow the active rounds
  const dv = structuredClone(P03_FIXTURE_DATA);
  const sep31 = dv.cycles.find(c => c.id === 5).lines.find(l => l.id === 31);
  sep31.events.find(e => e.id === 304).status = "voided";
  const regv = L.buildFieldRegistry(dv);
  const recv = L.canonicalRecords(dv).find(x => x.key === "line:31");
  const finalCell = L.cellFor(regv.byId.get("neg.final_agreed"), recv, L.buildContext(dv));
  ok("P0.5 void grid: the voided final agreement leaves the compact Final agreed blank (not its old ₹54.25)",
    finalCell.raw === null && finalCell.display === "—");
  ok("P0.5 void grid: agreed-BF fields no longer read the voided agreement's schedule",
    !regv.byId.has("bf:22") || L.cellFor(regv.byId.get("bf:22"), recv, L.buildContext(dv)).raw == null);
  const oct = { id: 99, prior_line_id: 31, events: [] };
  ok("P0.5 void prior: the next Cycle's locked comparison reports no active agreement (null, never the voided rate)",
    priorFor(oct, [sep31, oct]).agreed === null);
  ok("P0.5 void prior: the locked panel says 'No active agreement' and names a voided agreement honestly",
    /No active agreement in the prior cycle/.test(read("src/tabs/customer-pricing/LineCommercialBasis.jsx"))
    && /a voided agreement is kept in its history/.test(read("src/tabs/customer-pricing/LineCommercialBasis.jsx")));

  // UI source shape: deliberate, confirmed, reason kept, frozen after, no send in fixture mode
  const pld = read("src/tabs/customer-pricing/PricingLineDetail.jsx");
  ok("P0.5 void UI: 'Void round' sits beside Correct and is offered only on an ACTIVE round",
    /!isCorrecting && !isVoiding && !voided && <button type="button"\s+style=\{\{ \.\.\.rowButton, color: C\.red/.test(pld)
    && />Void round<\/button>/.test(pld));
  ok("P0.5 void UI: the confirmation shows event type, date and rate and requires the reason",
    /labelOf\(EVENT_TYPES, event\.event_type\)/.test(pld) && /event\.event_date/.test(pld) && /rateText/.test(pld)
    && /validateVoidReason\(voiding\.reason\)/.test(pld) && /aria-label="Void reason"/.test(pld));
  ok("P0.5 void UI: a failed or stale response keeps the panel and the typed reason; only success closes it",
    /setVoiding\(s => \(s \? \{ \.\.\.s, busy: false, error \} : s\)\)/.test(pld)
    && /if \(res\.ok\) \{[\s\S]{0,200}setVoiding\(null\);\s*onChanged\(\);/.test(pld)
    && /your reason is kept/i.test(pld));
  ok("P0.5 void UI: stale can be re-confirmed against the latest version without retyping",
    /Use latest version/.test(pld) && /baseVersion: e\.content_version, error: null/.test(pld));
  ok("P0.5 void UI: fixture mode shows the request and sends nothing",
    /if \(fixture\) \{ setVoiding\(s => \(\{ \.\.\.s, error: null, fixtureRequest:[\s\S]{0,80}return; \}[\s\S]{0,120}await pricingMutation\(path, body, "POST"\)/.test(pld));
  ok("P0.5 void UI: the voided row keeps its original details and shows the void reason",
    /Voided: \{e\.void_reason\}/.test(pld) && /VOIDED<\/span>/.test(pld));
  const bfSrc = read("src/tabs/customer-pricing/BfScheduleTable.jsx");
  ok("P0.5 void UI: a voided round's BF schedule offers no Override, Change override or Paste BF rates",
    /const locked = event\.status === "voided"/.test(bfSrc) && /row\.is_base \|\| locked \? null/.test(bfSrc)
    && /partyId && !locked && <button/.test(bfSrc));
  ok("P0.5 void transport: ROUND_VOIDED is its own outcome, not mistaken for a stale version",
    /data\?\.error_code === "ROUND_VOIDED" \? "voided"/.test(read("src/lib/customerPricingActions.js")));
  ok("P0.5 void history: the change log labels the status change and the void reason in words",
    /status: "Status", void_reason: "Void reason"/.test(read("src/tabs/customer-pricing/ChangeHistoryPanel.jsx"))
    && P03_FIXTURE_CHANGES.changes.find(c => c.id === 9004).fields.some(f => f.field === "void_reason"));
  ok("P0.5 void: no delete path exists anywhere in the pricing frontend",
    !/method:\s*"DELETE"|, "DELETE"\)/.test(pld + bfSrc + read("src/lib/customerPricingActions.js")));
  ok("P0.5 void UI: a void's own version bump is not labelled a correction (only v3+ on a voided round)",
    /e\.content_version > \(voided \? 2 : 1\)/.test(pld));
  ok("P0.5 void UI (1366): the row actions wrap BF under Correct · Void round instead of widening the timeline",
    /display: "inline-flex", flexWrap: "wrap", gap: 4, minWidth: 116, maxWidth: 120/.test(pld)
    && (pld.match(/maxWidth: 144 \}\} title=/g) || []).length === 3);
}

console.log(fails ? `\n${fails} FAILED` : "\ncustomer pricing fixtures PASS");
process.exit(fails ? 1 : 0);
