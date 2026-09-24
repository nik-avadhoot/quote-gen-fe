// ═══════════════════════════════════════════════════════════════════════════
// src/lib/customerPricingModel.js — Customer Pricing History, pure model.
//
// Authority: docs/customer-pricing-history-phase-0-implementation-plan-2026-09-23.md.
// Framework-free and network-free so scripts/customer-pricing-fixtures.mjs can
// exercise it directly (this repo has no DOM/UI harness).
//
// MONEY IS A STRING HERE. The backend sends every INR value as an exact
// two-decimal string ("0.00", "95.50") and accepts only strings back. Nothing
// in this file turns money into a float: formatting is string work, and the
// one comparison helper compares integer paise.
//
// BLANK IS NOT ZERO. null/"" means "not recorded"; "0.00" is a deliberate
// value. Every helper below keeps that distinction.
// ═══════════════════════════════════════════════════════════════════════════

export const FREQUENCIES = [
  { v: "monthly", l: "Monthly" },
  { v: "bimonthly", l: "Every two months" },
  { v: "quarterly", l: "Quarterly" },
  { v: "half_yearly", l: "Half-yearly" },
  { v: "annual", l: "Annual" },
  { v: "ad_hoc", l: "Ad hoc / custom" },
];

export const LABEL_STYLES = [
  { v: "financial_year", l: "Indian financial year (Apr–Mar)" },
  { v: "calendar_year", l: "Calendar year" },
  { v: "custom", l: "Custom labels" },
];

export const RATE_BASES = [
  { v: "box_per_piece", l: "Delivered box rate / piece" },
  { v: "box_per_kg", l: "Delivered box rate / kg" },
  { v: "kraft_paper_per_kg", l: "Delivered Kraft paper rate / kg" },
  { v: "box_per_sqm", l: "Delivered box rate / m²" },
];
export const KG_RATE_BASES = new Set(["box_per_kg", "kraft_paper_per_kg"]);

export const WEIGHT_BASES = [
  { v: "paper_consumed", l: "Paper consumed (sheet + wastage)" },
  { v: "sheet_weight", l: "Sheet weight (box + trim)" },
  { v: "box_weight", l: "Box weight (finished)" },
];

export const TAX_TREATMENTS = [
  { v: "excluding_gst", l: "Excluding GST" },
  { v: "including_gst", l: "Including GST" },
];

// P0.4.1: SOB is a percentage OR a whole-box allocation for the Cycle (the
// Cycle is the period). The user always picks the mode; it is never inferred.
export const SOB_STATES = [
  { v: "not_captured", l: "Not yet captured" },
  { v: "undefined", l: "Customer left undefined" },
  { v: "not_applicable", l: "Not applicable" },
  { v: "percentage", l: "Percentage" },
  { v: "allocated_quantity", l: "Allocated quantity (boxes)" },
];

export const CYCLE_STATUSES = [
  { v: "open", l: "Open" },
  { v: "closed", l: "Closed" },
];

export const EVENT_TYPES = [
  { v: "avadhoot_offer", l: "Our offer" },
  { v: "customer_counter", l: "Customer counter" },
  { v: "final_agreement", l: "Final agreement" },
];

export const SOURCE_TYPES = [
  { v: "email", l: "Email" }, { v: "whatsapp", l: "WhatsApp" }, { v: "call", l: "Call" },
  { v: "meeting", l: "Meeting" }, { v: "excel", l: "Excel" }, { v: "other", l: "Other" },
];

export const labelOf = (list, v) => list.find(o => o.v === v)?.l ?? (v || "—");

// ── exact INR ──────────────────────────────────────────────────────────────

// Parse what a user typed into an exact two-decimal string, or report why not.
// "" -> { ok, value: null } (blank stays blank); "0" -> "0.00" (zero stays zero).
// A third decimal is refused, never rounded: the user must see what is stored.
export function parseInr(raw, { required = false, max = "9999999999.99" } = {}) {
  const text = String(raw ?? "").trim().replace(/,/g, "").replace(/^₹\s*/, "");
  if (text === "") return required ? { ok: false, error: "Required" } : { ok: true, value: null };
  const m = /^(\d+)(?:\.(\d{0,2}))?$/.exec(text);
  if (!m) {
    return { ok: false, error: /^\d+\.\d{3,}$/.test(text) ? "At most two decimal places" : "Enter a number (e.g. 95.50)" };
  }
  const whole = m[1].replace(/^0+(?=\d)/, "");
  const value = `${whole}.${(m[2] || "").padEnd(2, "0")}`;
  if (toPaise(value) > toPaise(max)) return { ok: false, error: `Must not exceed ${max}` };
  return { ok: true, value };
}

export function parsePct(raw, { required = false, allowZero = true } = {}) {
  const r = parseInr(raw, { required, max: "100.00" });
  if (!r.ok || r.value === null) return r;
  if (!allowZero && toPaise(r.value) === 0n) return { ok: false, error: "Must be above 0" };
  return r;
}

// ── SOB allocated boxes ────────────────────────────────────────────────────
// Whole boxes as an exact decimal STRING (never a JS number in transit).
// "" -> null (blank stays blank); "0" -> "0" (zero stays zero). Grouping commas
// the user types are display, so they are dropped; anything else — a decimal
// point, a sign, an exponent — is refused, never rounded.
export const SOB_MAX_BOXES = "999999999";
export function parseBoxes(raw, { required = false } = {}) {
  const text = String(raw ?? "").trim().replace(/,/g, "");
  if (text === "") return required ? { ok: false, error: "Required" } : { ok: true, value: null };
  if (!/^\d+$/.test(text)) {
    return { ok: false, error: /^\d+\.\d*$/.test(text) ? "Whole boxes only — no decimals"
      : /^-/.test(text) ? "Boxes cannot be negative" : "Enter a whole number of boxes (e.g. 25000)" };
  }
  const value = text.replace(/^0+(?=\d)/, "");
  if (value.length > SOB_MAX_BOXES.length || (value.length === SOB_MAX_BOXES.length && value > SOB_MAX_BOXES)) {
    return { ok: false, error: "At most 999,999,999 boxes" };
  }
  return { ok: true, value };
}

// "25000" -> "25,000 boxes" (Indian grouping, like INR); "1" -> "1 box"; null -> "—".
export function formatBoxes(value) {
  if (value === null || value === undefined || value === "") return "—";
  const w = String(value);
  const grouped = w.length > 3 ? w.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + w.slice(-3) : w;
  return `${grouped} ${w === "1" ? "box" : "boxes"}`;
}

// The canonical SOB value of a line: the state plus ONLY the value that state
// carries. Summaries compare this, so 0.00% vs 0 boxes vs blank never merge.
export function sobValue(line) {
  const state = line?.sob_state || "not_captured";
  return { state, pct: state === "percentage" ? line.sob_pct ?? null : null,
    boxes: state === "allocated_quantity" ? line.sob_allocated_boxes ?? null : null };
}

// Integer paise as BigInt — exact comparison without floating point.
export function toPaise(value) {
  const [w, f = ""] = String(value).split(".");
  return BigInt(w || "0") * 100n + BigInt((f + "00").slice(0, 2));
}

// "95.5" | 95.5 | "95.50" -> "₹95.50" with Indian grouping; null -> "—".
export function formatInr(value, { symbol = true } = {}) {
  if (value === null || value === undefined || value === "") return "—";
  const s = String(value);
  const neg = s.startsWith("-");
  const [w, f = ""] = (neg ? s.slice(1) : s).split(".");
  const frac = (f + "00").slice(0, 2);
  const grouped = w.length > 3
    ? w.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + w.slice(-3)
    : w;
  return `${neg ? "-" : ""}${symbol ? "₹" : ""}${grouped}.${frac}`;
}

export function formatPct(value) {
  if (value === null || value === undefined || value === "") return "—";
  const [w, f = ""] = String(value).split(".");
  return `${w}.${(f + "00").slice(0, 2)}%`;
}

// ── Cycle labels ───────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  return { y, m, d };
}

function fyStart(y, m) { return m >= 4 ? y : y - 1; }
function fyLabel(startYear) { return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`; }

// The label is RENDERED from exact stored dates; it never replaces them.
export function cycleLabel(cycle, labelStyle = "financial_year") {
  if (!cycle) return "";
  if (cycle.custom_label) return cycle.custom_label;
  const s = parts(cycle.period_start);
  const e = parts(cycle.period_end);
  if (!s.y || !e.y) return "";
  const fy = labelStyle === "financial_year";
  switch (cycle.review_frequency) {
    case "monthly":
      return `${MONTHS[s.m - 1]} ${s.y}`;
    case "bimonthly":
      return s.y === e.y
        ? `${MONTHS[s.m - 1]}-${MONTHS[e.m - 1]} ${s.y}`
        : `${MONTHS[s.m - 1]} ${s.y}-${MONTHS[e.m - 1]} ${e.y}`;
    case "quarterly": {
      if (fy) {
        const q = Math.floor(((s.m + 8) % 12) / 3) + 1; // Apr-Jun = Q1
        return `Q${q} ${fyLabel(fyStart(s.y, s.m))}`;
      }
      return `Q${Math.floor((s.m - 1) / 3) + 1} ${s.y}`;
    }
    case "half_yearly":
      if (fy) return `${s.m >= 4 && s.m <= 9 ? "H1" : "H2"} ${fyLabel(fyStart(s.y, s.m))}`;
      return `${s.m <= 6 ? "H1" : "H2"} ${s.y}`;
    case "annual":
      return fy ? `FY ${fyLabel(fyStart(s.y, s.m))}` : `${s.y}`;
    default:
      return `${cycle.period_start} – ${cycle.period_end}`;
  }
}

// Default exact period for a new Cycle starting on `startIso`.
export function defaultPeriodEnd(frequency, startIso) {
  const { y, m } = parts(startIso);
  if (!y) return "";
  const months = { monthly: 1, bimonthly: 2, quarterly: 3, half_yearly: 6, annual: 12 }[frequency];
  if (!months) return startIso;
  const end = new Date(Date.UTC(y, m - 1 + months, 0)); // last day of the final month
  return end.toISOString().slice(0, 10);
}

// ── negotiation summary ───────────────────────────────────────────────────

// Chronology: event date, then the database's stable sequence. Voided rounds
// are history, not the current position.
export function orderedEvents(events) {
  return (events || [])
    .filter(e => e && e.status !== "voided")
    .slice()
    .sort((a, b) => (a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1
      : (a.sequence_no || 0) - (b.sequence_no || 0)));
}

// The full timeline (P0.4): EVERY round in the same chronology, voided ones
// included and marked, so history is shown as recorded — the summary above
// still ignores voided rounds.
export function timelineEvents(events) {
  return (events || [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => (a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1
      : (a.sequence_no || 0) - (b.sequence_no || 0)));
}

// Plan §4.9: FIRST Avadhoot offer, LATEST Customer counter, LATEST agreement.
export function negotiationSummary(events) {
  const ordered = orderedEvents(events);
  const ofType = t => ordered.filter(e => e.event_type === t);
  const offers = ofType("avadhoot_offer");
  const counters = ofType("customer_counter");
  const agreements = ofType("final_agreement");
  return {
    ourOffer: offers[0] || null,
    customerOffer: counters[counters.length - 1] || null,
    finalAgreed: agreements[agreements.length - 1] || null,
    rounds: ordered.length,
    lastActivity: ordered[ordered.length - 1] || null,
  };
}

// Default compact Date: initiation until agreed, agreement date afterwards.
// Other modes are layout state (P0.3), never commercial data.
export function displayDate(cycle, lines, mode = "auto") {
  const all = (lines || []).flatMap(l => orderedEvents(l.events));
  const agreements = all.filter(e => e.event_type === "final_agreement");
  const latest = xs => xs.reduce((m, e) => (!m || e.event_date > m ? e.event_date : m), null);
  switch (mode) {
    case "initiation": return cycle?.initiated_on || null;
    case "agreement": return latest(agreements);
    case "latest_activity": return latest(all);
    case "period_start": return cycle?.period_start || null;
    case "period_end": return cycle?.period_end || null;
    default: return latest(agreements) || cycle?.initiated_on || null;
  }
}

export function sobDisplay(line) {
  if (!line) return "—";
  if (line.sob_state === "percentage") return formatPct(line.sob_pct);
  if (line.sob_state === "allocated_quantity") return formatBoxes(line.sob_allocated_boxes);
  return labelOf(SOB_STATES, line.sob_state || "not_captured");
}

export function scopeDisplay(line, { locations = [], plants = [] } = {}) {
  const bits = [];
  const loc = locations.find(l => l.id === line?.customer_location_id);
  if (line?.customer_location_id) bits.push(loc?.location_code || `Location #${line.customer_location_id}`);
  const plant = plants.find(p => p.id === line?.plant_id);
  if (line?.plant_id) bits.push(plant?.plant_code || `Plant #${line.plant_id}`);
  if (line?.sku_id) bits.push(`SKU #${line.sku_id}`);
  if (line?.scope_text) bits.push(line.scope_text);
  return bits.length ? bits.join(" · ") : "Whole Customer";
}

// A kg-based rate is only comparable once its Weight Basis is known.
export function comparisonBlockedReason(mechanism) {
  if (!mechanism?.rate_basis) return "Rate basis not yet captured";
  if (KG_RATE_BASES.has(mechanism.rate_basis) && !mechanism.weight_basis) {
    return "Per-kg rate without a weight basis — comparison disabled";
  }
  return null;
}

// ── request bodies (exact keys the Flask routes read) ─────────────────────

const blankToNull = v => (v === undefined || v === null || String(v).trim() === "" ? null : v);

export function mechanismBody(form, expectedVersion) {
  return {
    expected_content_version: expectedVersion ?? null,
    review_frequency: form.review_frequency,
    period_label_style: blankToNull(form.period_label_style),
    rate_basis: blankToNull(form.rate_basis),
    weight_basis: blankToNull(form.weight_basis),
    tax_treatment: blankToNull(form.tax_treatment),
    notes: String(form.notes ?? "").trim(),
  };
}

export function cycleBody(form, expectedVersion) {
  const body = {
    period_start: form.period_start,
    period_end: form.period_end,
    initiated_on: form.initiated_on,
    review_frequency: blankToNull(form.review_frequency),
    custom_label: String(form.custom_label ?? "").trim(),
    notes: String(form.notes ?? "").trim(),
  };
  if (expectedVersion !== undefined) {
    body.expected_content_version = expectedVersion;
    body.status = blankToNull(form.status);
  }
  return body;
}

export function lineBody(form, expectedVersion) {
  const body = {
    customer_location_id: blankToNull(form.customer_location_id),
    plant_id: blankToNull(form.plant_id),
    // Always sent: the update route replaces the whole scope, so omitting it
    // would clear a line's SKU on every scope/SOB edit.
    sku_id: blankToNull(form.sku_id),
    scope_text: String(form.scope_text ?? "").trim(),
    sob_state: form.sob_state || "not_captured",
    // Only the value the chosen state carries; the other is always null.
    sob_pct: form.sob_state === "percentage" ? blankToNull(form.sob_pct) : null,
    sob_allocated_boxes: form.sob_state === "allocated_quantity" ? blankToNull(form.sob_allocated_boxes) : null,
    notes: String(form.notes ?? "").trim(),
  };
  if (expectedVersion !== undefined) body.expected_content_version = expectedVersion;
  return body;
}

export function eventBody(form, { expectedVersion, clientRequestId } = {}) {
  const including = form.tax_treatment === "including_gst";
  const body = {
    event_type: form.event_type,
    event_date: form.event_date,
    rate_inr: blankToNull(form.rate_inr),
    tax_treatment: form.tax_treatment || "excluding_gst",
    gst_pct: including ? blankToNull(form.gst_pct) : null,
    // P0.2 component breakup: blank = not recorded, "0.00" = a deliberate zero.
    kraft_inr: blankToNull(form.kraft_inr),
    conversion_inr: blankToNull(form.conversion_inr),
    freight_inr: blankToNull(form.freight_inr),
    source_type: blankToNull(form.source_type),
    source_date: blankToNull(form.source_date),
    source_ref: String(form.source_ref ?? "").trim(),
    notes: String(form.notes ?? "").trim(),
  };
  if (expectedVersion !== undefined) body.expected_content_version = expectedVersion;
  if (clientRequestId) body.client_request_id = clientRequestId;
  return body;
}

// A new round opens with the Customer mechanism's tax treatment: an
// including-GST Customer opens including GST (so the GST % is asked for); the
// user may still override the treatment for that one round.
export function blankEventForm(mechanism, today) {
  return { event_type: "", event_date: today || "", rate_inr: "",
    tax_treatment: mechanism?.tax_treatment || "excluding_gst", gst_pct: "",
    kraft_inr: "", conversion_inr: "", freight_inr: "",
    source_type: "", source_date: "", source_ref: "", notes: "" };
}

// Client-side validation of an event form. Advisory only: the route and the
// database refuse the same shapes regardless of what this says.
export function validateEventForm(form) {
  const errors = {};
  if (!form.event_type) errors.event_type = "Choose who made this offer";
  if (!form.event_date) errors.event_date = "Date required";
  const rate = parseInr(form.rate_inr, { required: true });
  if (!rate.ok) errors.rate_inr = rate.error;
  const components = {};
  for (const key of ["kraft_inr", "conversion_inr", "freight_inr"]) {
    const parsed = parseInr(form[key]);
    if (!parsed.ok) errors[key] = parsed.error;
    else components[key] = parsed.value ?? "";
  }
  if (form.tax_treatment === "including_gst") {
    const gst = parsePct(form.gst_pct, { required: true, allowZero: false });
    if (!gst.ok) errors.gst_pct = gst.error;
  }
  return { ok: Object.keys(errors).length === 0, errors,
    normalised: { ...form, ...components, rate_inr: rate.ok ? rate.value : form.rate_inr,
      gst_pct: form.tax_treatment === "including_gst" ? parsePct(form.gst_pct).value ?? form.gst_pct : null } };
}

export function validateLineForm(form) {
  const errors = {};
  const pct = form.sob_state === "percentage" ? parsePct(form.sob_pct, { required: true }) : { ok: true, value: null };
  const boxes = form.sob_state === "allocated_quantity" ? parseBoxes(form.sob_allocated_boxes, { required: true })
    : { ok: true, value: null };
  if (!pct.ok) errors.sob_pct = pct.error;
  if (!boxes.ok) errors.sob_allocated_boxes = boxes.error;
  return { ok: Object.keys(errors).length === 0, errors,
    normalised: { ...form, sob_pct: pct.ok ? pct.value : null, sob_allocated_boxes: boxes.ok ? boxes.value : null } };
}

export function validateCycleForm(form) {
  const errors = {};
  if (!form.period_start) errors.period_start = "Required";
  if (!form.period_end) errors.period_end = "Required";
  if (form.period_start && form.period_end && form.period_end < form.period_start) {
    errors.period_end = "Ends before it starts";
  }
  if (!form.initiated_on) errors.initiated_on = "Required";
  return { ok: Object.keys(errors).length === 0, errors };
}

// The edit form a stored record opens as. The line/cycle edit forms AND the
// P0.3 grid cell editor both start here, so an edit made through any layout
// sends the same full body the form would (the update routes replace every
// field, so a partial body would clear the untouched ones).
export function lineFormFromRecord(line) {
  return {
    customer_location_id: line.customer_location_id ?? "", plant_id: line.plant_id ?? "",
    sku_id: line.sku_id ?? "",
    scope_text: line.scope_text ?? "", sob_state: line.sob_state || "not_captured", sob_pct: line.sob_pct ?? "",
    sob_allocated_boxes: line.sob_allocated_boxes ?? "",
    notes: line.notes ?? "",
  };
}

export function cycleFormFromRecord(cycle) {
  return {
    review_frequency: cycle.review_frequency, period_start: cycle.period_start, period_end: cycle.period_end,
    initiated_on: cycle.initiated_on, custom_label: cycle.custom_label || "", status: cycle.status || "open",
    notes: cycle.notes || "",
  };
}


// ═══════════════════════════════════════════════════════════════════════════
// P0.2 — commercial mechanisms
//
// Units follow the settled Costing engine (src/engine/costing.js), which this
// module never changes: Conversion is INR per kg of Paper Consumed (Paper
// Consumed includes wastage); Freight is INR per kg of Sheet Weight (Sheet
// Weight excludes wastage); weights are kg per box and area m² per box, both
// to four decimals. Every conversion below is exact BigInt arithmetic with
// half-up rounding to paise — no float ever touches money.
// ═══════════════════════════════════════════════════════════════════════════

export const WASTAGE_TREATMENTS = [
  { v: "added_pct", l: "Added as % over the weight" },
  { v: "included_in_weight", l: "Already included in the weight" },
  { v: "not_applicable", l: "Not applicable" },
  { v: "not_captured", l: "Not yet captured" },
];

export const FREIGHT_TREATMENTS = [
  { v: "delivered_included", l: "Delivered (freight included)" },
  { v: "ex_factory_separate", l: "Ex-factory, freight separate" },
  { v: "not_captured", l: "Not yet captured" },
];

export const MEASURES = [
  { v: "paper_consumed_kg", l: "Paper consumed", unit: "kg" },
  { v: "sheet_weight_kg", l: "Sheet weight", unit: "kg" },
  { v: "box_weight_kg", l: "Box weight", unit: "kg" },
  { v: "area_sqm", l: "Area", unit: "m²" },
];

export const MEASURE_SOURCES = [
  { v: "customer_confirmed", l: "Customer-confirmed" },
  { v: "costing_snapshot", l: "Costing snapshot" },
  { v: "manual", l: "Manual" },
  { v: "imported", l: "Imported" },
];

// Which recorded value a comparison uses when several sources exist. A
// presentation rule only (reversible): every value stays stored and shown.
export const MEASURE_PRECEDENCE = ["customer_confirmed", "costing_snapshot", "manual", "imported"];

const WEIGHT_MEASURE = { paper_consumed: "paper_consumed_kg", sheet_weight: "sheet_weight_kg", box_weight: "box_weight_kg" };
const WEIGHT_SHORT = { paper_consumed: "kg paper consumed", sheet_weight: "kg sheet weight", box_weight: "kg box weight" };

// The unit an INR value means. Every INR/kg value is shown with its weight basis.
export function rateUnitLabel(rateBasis, weightBasis) {
  switch (rateBasis) {
    case "box_per_piece": return "/piece";
    case "box_per_sqm": return "/m²";
    case "box_per_kg":
    case "kraft_paper_per_kg":
      return weightBasis ? `/${WEIGHT_SHORT[weightBasis]}` : "/kg (weight basis not set)";
    default: return "";
  }
}

export function formatRate(value, rateBasis, weightBasis) {
  if (value === null || value === undefined || value === "") return "—";
  const unit = rateUnitLabel(rateBasis, weightBasis);
  return `${formatInr(value)}${unit ? " " + unit : ""}`;
}

// ── exact measures (4 dp) and paise arithmetic ──────────────────────────────
export function parseMeasure(raw) {
  const text = String(raw ?? "").trim();
  if (text === "") return { ok: true, value: null };
  const m = /^(\d+)(?:\.(\d{0,4}))?$/.exec(text);
  if (!m) return { ok: false, error: /^\d+\.\d{5,}$/.test(text) ? "At most four decimal places" : "Enter a number" };
  const value = `${m[1].replace(/^0+(?=\d)/, "")}.${(m[2] || "").padEnd(4, "0")}`;
  if (toUnits4(value) === 0n) return { ok: false, error: "Must be above 0 — leave blank if not known" };
  return { ok: true, value };
}

export function toUnits4(value) {
  const [w, f = ""] = String(value).split(".");
  return BigInt(w || "0") * 10000n + BigInt((f + "0000").slice(0, 4));
}

export function paiseToString(paise) {
  const neg = paise < 0n;
  const abs = neg ? -paise : paise;
  return `${neg ? "-" : ""}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
}

// Signed INR string ("-1.25") to paise.
export function toSignedPaise(value) {
  const s = String(value);
  return s.startsWith("-") ? -toPaise(s.slice(1)) : toPaise(s);
}

// rate (2dp) × measure (4dp) -> paise, half-up.
export function mulRateByMeasure(rate, measure) {
  const product = toPaise(rate) * toUnits4(measure);          // paise × 1e-4
  return (product + 5000n) / 10000n;
}

// rate (2dp) ÷ measure (4dp) -> paise per unit, half-up.
export function divRateByMeasure(rate, measure) {
  const num = toPaise(rate) * 10000n;
  const den = toUnits4(measure);
  return (2n * num + den) / (2n * den);
}

export function preferredMeasure(measures, measure) {
  const active = (measures || []).filter(m => m.measure === measure && m.status !== "withdrawn");
  for (const source of MEASURE_PRECEDENCE) {
    const hit = active.find(m => m.source === source);
    if (hit) return hit;
  }
  return null;
}

// An equivalent view of an agreed/offered rate. Available ONLY when the needed
// weight or area is recorded; a missing input disables it with a reason and is
// never treated as zero or inferred.
export function equivalentRate(rate, rateBasis, weightBasis, measures) {
  if (rate === null || rate === undefined || rate === "") return { available: false, reason: "No rate recorded" };
  const sourceLabel = m => labelOf(MEASURE_SOURCES, m.source).toLowerCase();
  if (rateBasis === "box_per_kg" || rateBasis === "kraft_paper_per_kg") {
    if (!weightBasis) return { available: false, reason: "Per-kg rate without a weight basis — comparison disabled" };
    const m = preferredMeasure(measures, WEIGHT_MEASURE[weightBasis]);
    if (!m) return { available: false, reason: `No ${labelOf(MEASURES, WEIGHT_MEASURE[weightBasis]).toLowerCase()} recorded — per-piece comparison disabled` };
    return { available: true, value: paiseToString(mulRateByMeasure(rate, m.value)), unit: "/piece",
      note: `at ${m.value} ${WEIGHT_SHORT[weightBasis]} (${sourceLabel(m)})` };
  }
  if (rateBasis === "box_per_sqm") {
    const m = preferredMeasure(measures, "area_sqm");
    if (!m) return { available: false, reason: "No area recorded — per-piece comparison disabled" };
    return { available: true, value: paiseToString(mulRateByMeasure(rate, m.value)), unit: "/piece",
      note: `at ${m.value} m² (${sourceLabel(m)})` };
  }
  if (rateBasis === "box_per_piece") {
    if (!weightBasis) return { available: false, reason: "Choose a weight basis to compare per kg" };
    const m = preferredMeasure(measures, WEIGHT_MEASURE[weightBasis]);
    if (!m) return { available: false, reason: `No ${labelOf(MEASURES, WEIGHT_MEASURE[weightBasis]).toLowerCase()} recorded — per-kg comparison disabled` };
    return { available: true, value: paiseToString(divRateByMeasure(rate, m.value)),
      unit: `/${WEIGHT_SHORT[weightBasis]}`, note: `at ${m.value} kg (${sourceLabel(m)})` };
  }
  return { available: false, reason: "Rate basis not yet captured" };
}

// ── Stable-Term components converted into the ROUND's unit ────────────────
// A Stable Term states Conversion per kg of Paper Consumed and Freight per kg
// of Sheet Weight (Costing). A round's components must share the round's own
// unit, or the reconciliation against the recorded total is meaningless. So:
//   per-piece component = ₹/kg × numerator weight (kg/box)
//   round unit:  /piece -> as is;  /m² -> ÷ area (m²/box);
//                /kg <basis> -> ÷ the weight of that basis (kg/box).
// One exact rational, rounded ONCE, half-up, to paise. A missing measure,
// area or weight basis leaves the component unfilled with a precise reason.
const COMPONENT_SOURCES = {
  conversion: { field: "conversion_inr_per_kg", numerator: "paper_consumed_kg", label: "conversion" },
  freight: { field: "freight_inr_per_kg", numerator: "sheet_weight_kg", label: "freight" },
};

function roundHalfUpDiv(num, den) {
  return (2n * num + den) / (2n * den);
}

export function roundUnitDenominator(rateBasis, weightBasis, measures) {
  if (!rateBasis) return { ok: false, reason: "the round's rate basis is not captured" };
  if (rateBasis === "box_per_piece") return { ok: true, units: 10000n, note: null };
  if (rateBasis === "box_per_sqm") {
    const area = preferredMeasure(measures, "area_sqm");
    if (!area) return { ok: false, reason: "no area (m²/box) recorded to express it per m²" };
    return { ok: true, units: toUnits4(area.value), note: `÷ ${area.value} m² (${labelOf(MEASURE_SOURCES, area.source).toLowerCase()})` };
  }
  if (!weightBasis) return { ok: false, reason: "the round's per-kg rate has no weight basis" };
  const m = preferredMeasure(measures, WEIGHT_MEASURE[weightBasis]);
  if (!m) return { ok: false, reason: `no ${labelOf(MEASURES, WEIGHT_MEASURE[weightBasis]).toLowerCase()} recorded to express it per kg` };
  return { ok: true, units: toUnits4(m.value), note: `÷ ${m.value} kg ${labelOf(MEASURES, m.measure).toLowerCase()} (${labelOf(MEASURE_SOURCES, m.source).toLowerCase()})` };
}

export function termComponentInRoundUnit(term, kind, rateBasis, weightBasis, measures) {
  const spec = COMPONENT_SOURCES[kind];
  const perKg = term?.[spec.field];
  if (perKg === null || perKg === undefined || perKg === "") {
    return { available: false, reason: `The Stable Term has no ${spec.label} value` };
  }
  const num = preferredMeasure(measures, spec.numerator);
  if (!num) {
    return { available: false,
      reason: `No ${labelOf(MEASURES, spec.numerator).toLowerCase()} recorded to convert ${spec.label} per box` };
  }
  const den = roundUnitDenominator(rateBasis, weightBasis, measures);
  if (!den.ok) return { available: false, reason: `Cannot express ${spec.label} in this round's unit: ${den.reason}` };
  const paise = roundHalfUpDiv(toPaise(perKg) * toUnits4(num.value), den.units);
  return { available: true, value: paiseToString(paise),
    note: `${formatInr(perKg)}/kg × ${num.value} kg ${labelOf(MEASURES, num.measure).toLowerCase()} `
      + `(${labelOf(MEASURE_SOURCES, num.source).toLowerCase()})${den.note ? " " + den.note : ""}` };
}

// BF grades whose derived rate (base rate + signed delta) would fall below
// ₹0.00. A usability pre-check only: the database refuses the same round.
export function bfFloorViolations(rate, deltas) {
  if (rate === null || rate === undefined || rate === "") return [];
  const base = toPaise(rate);
  return (deltas || []).filter(d => d.delta_inr != null && base + toSignedPaise(d.delta_inr) < 0n)
    .map(d => d.bf_code);
}

// Client-side preview of the component reconciliation (the server computes
// the stored answer the same exact way). Never replaces the recorded total.
export function reconcile(rate, components) {
  const present = ["kraft_inr", "conversion_inr", "freight_inr"]
    .map(k => components?.[k]).filter(v => v !== null && v !== undefined && v !== "");
  if (!present.length) return { total: null, diff: null };
  const total = present.reduce((sum, v) => sum + toPaise(v), 0n);
  const diff = rate === null || rate === undefined || rate === "" ? null : toPaise(rate) - total;
  return { total: paiseToString(total), diff: diff === null ? null : paiseToString(diff) };
}

// ── Stable Terms / BF sets applicability ────────────────────────────────────
function inScope(version, line) {
  return (version.customer_location_id == null || version.customer_location_id === line?.customer_location_id)
    && (version.plant_id == null || version.plant_id === line?.plant_id);
}
function coversDate(version, date) {
  return version.effective_from <= date && (version.effective_to == null || version.effective_to >= date);
}

// Versions a line may reference: active, scope same-or-wider, covering the
// Cycle start. Narrowest scope first. Mirrors cph_set_line_references.
export function applicableVersions(versions, line, cycle) {
  const rank = v => (v.customer_location_id != null ? 2 : 0) + (v.plant_id != null ? 1 : 0);
  return (versions || [])
    .filter(v => v.status === "active" && inScope(v, line) && cycle?.period_start && coversDate(v, cycle.period_start))
    .sort((a, b) => rank(b) - rank(a) || b.version_no - a.version_no);
}

export function scopeLabel(version, { locations = [], plants = [] } = {}) {
  const bits = [];
  if (version.customer_location_id != null) {
    bits.push(locations.find(l => l.id === version.customer_location_id)?.location_code || `Location #${version.customer_location_id}`);
  }
  if (version.plant_id != null) bits.push(plants.find(p => p.id === version.plant_id)?.plant_code || `Plant #${version.plant_id}`);
  return bits.length ? bits.join(" · ") : "Whole Customer";
}

export function effectiveLabel(version) {
  return `${version.effective_from} → ${version.effective_to || "open"}`;
}

export function termSummary(term) {
  if (!term) return "No Stable Term";
  const wastage = term.wastage_treatment === "added_pct"
    ? `wastage +${formatPct(term.wastage_pct)}` : labelOf(WASTAGE_TREATMENTS, term.wastage_treatment).toLowerCase();
  const conv = term.conversion_inr_per_kg == null ? "conversion —" : `conversion ${formatInr(term.conversion_inr_per_kg)}/kg paper consumed`;
  const freight = term.freight_inr_per_kg == null ? "freight —" : `freight ${formatInr(term.freight_inr_per_kg)}/kg sheet weight`;
  return [labelOf(FREIGHT_TREATMENTS, term.freight_treatment), wastage, conv, freight].join(" · ");
}

// ── Start next cycle ────────────────────────────────────────────────────────
function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// The proposed next period: the day after the prior one ends, at the
// Customer's configured frequency. The user may adjust before creating.
export function proposeNextPeriod(priorCycle, frequency) {
  if (!priorCycle?.period_end) return { period_start: "", period_end: "" };
  const start = addDays(priorCycle.period_end, 1);
  if (!frequency || frequency === "ad_hoc") {
    const [ys, ms, ds] = priorCycle.period_start.split("-").map(Number);
    const [ye, me, de] = priorCycle.period_end.split("-").map(Number);
    const span = Math.round((Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / 86400000);
    return { period_start: start, period_end: addDays(start, span) };
  }
  return { period_start: start, period_end: defaultPeriodEnd(frequency, start) };
}

export function nextCycleBody(form) {
  return {
    period_start: form.period_start,
    period_end: form.period_end,
    initiated_on: form.initiated_on,
    custom_label: String(form.custom_label ?? "").trim(),
  };
}

// Prior agreed values are LOCKED comparison context; they never become a new
// offer unless the user explicitly asks. This builds that explicit draft.
export function priorAgreedFor(line, allLines) {
  if (!line?.prior_line_id) return null;
  const prior = (allLines || []).find(l => l.id === line.prior_line_id);
  if (!prior) return { missing: true };
  return { line: prior, agreed: negotiationSummary(prior.events).finalAgreed };
}

// ── P0.5: void a negotiation round ─────────────────────────────────────────
// A void keeps the round exactly as recorded, marks it and stops it counting as
// the current position. The reason is required; the Customer being viewed and
// the version the round was read at travel with it (route: POST …/void).
export const VOID_REASON_MIN = 3;
export const VOID_REASON_MAX = 500;
export function validateVoidReason(raw) {
  const value = String(raw ?? "").trim();
  if (value.length < VOID_REASON_MIN) return { ok: false, error: `Give a reason (at least ${VOID_REASON_MIN} characters)` };
  if (value.length > VOID_REASON_MAX) return { ok: false, error: `At most ${VOID_REASON_MAX} characters` };
  return { ok: true, value };
}
export function voidRoundBody(partyId, expectedVersion, reason) {
  return { party_id: partyId, expected_content_version: expectedVersion, reason: String(reason ?? "").trim() };
}

export function draftFromPriorAgreed(agreed, mechanism, today) {
  const blank = blankEventForm(mechanism, today);
  if (!agreed) return blank;
  return { ...blank, event_type: "avadhoot_offer", rate_inr: agreed.rate_inr ?? "",
    tax_treatment: agreed.tax_treatment || blank.tax_treatment, gst_pct: agreed.gst_pct ?? "",
    kraft_inr: agreed.component_kraft_inr ?? "", conversion_inr: agreed.component_conversion_inr ?? "",
    freight_inr: agreed.component_freight_inr ?? "",
    notes: `Draft copied from prior agreed ${agreed.event_date}` };
}

// ── P0.2 request bodies ─────────────────────────────────────────────────────
export function termBody(form, { expectedVersion, closePrior } = {}) {
  const body = {
    effective_from: form.effective_from,
    effective_to: blankToNull(form.effective_to),
    rate_basis: blankToNull(form.rate_basis),
    weight_basis: blankToNull(form.weight_basis),
    wastage_treatment: form.wastage_treatment || "not_captured",
    wastage_pct: form.wastage_treatment === "added_pct" ? blankToNull(form.wastage_pct) : null,
    freight_treatment: form.freight_treatment || "not_captured",
    conversion_inr_per_kg: blankToNull(form.conversion_inr_per_kg),
    freight_inr_per_kg: blankToNull(form.freight_inr_per_kg),
    source_type: blankToNull(form.source_type),
    source_date: blankToNull(form.source_date),
    source_ref: String(form.source_ref ?? "").trim(),
    notes: String(form.notes ?? "").trim(),
  };
  if (expectedVersion !== undefined) {
    body.expected_content_version = expectedVersion;
    body.status = form.status || "active";
  } else {
    body.customer_location_id = blankToNull(form.customer_location_id);
    body.plant_id = blankToNull(form.plant_id);
    body.close_prior = closePrior === true;
  }
  return body;
}

export function validateTermForm(form) {
  const errors = {};
  if (!form.effective_from) errors.effective_from = "Required";
  if (form.effective_to && form.effective_from && form.effective_to < form.effective_from) errors.effective_to = "Ends before it starts";
  if (form.wastage_treatment === "added_pct") {
    const pct = parsePct(form.wastage_pct, { required: true });
    if (!pct.ok) errors.wastage_pct = pct.error;
  }
  const normalised = { ...form };
  for (const key of ["conversion_inr_per_kg", "freight_inr_per_kg"]) {
    const parsed = parseInr(form[key]);
    if (!parsed.ok) errors[key] = parsed.error; else normalised[key] = parsed.value ?? "";
  }
  if (form.wastage_treatment === "added_pct" && !errors.wastage_pct) normalised.wastage_pct = parsePct(form.wastage_pct).value;
  return { ok: Object.keys(errors).length === 0, errors, normalised };
}

// Parse "20:+1.50, 16:-1, 22GY:3.25" (or one per line) into signed exact deltas.
export function parseBfSchedule(text, baseBf) {
  const base = String(baseBf || "").trim().toUpperCase();
  const deltas = []; const seen = new Set(); const errors = [];
  for (const raw of String(text || "").split(/[\n,;]+/)) {
    const part = raw.trim();
    if (!part) continue;
    const m = /^([0-9]{1,3}[A-Za-z]{0,4})\s*[:=]\s*([+-]?)(\d+(?:\.\d{0,2})?)$/.exec(part);
    if (!m) { errors.push(`"${part}" — use GRADE:DELTA, e.g. 20:+1.50`); continue; }
    const code = m[1].toUpperCase();
    if (code === base) { errors.push(`${code} is the base BF — it carries no delta`); continue; }
    if (seen.has(code)) { errors.push(`${code} is listed twice`); continue; }
    seen.add(code);
    const parsed = parseInr(m[3]);
    deltas.push({ bf_code: code, delta_inr: `${m[2] === "-" && toPaise(parsed.value) !== 0n ? "-" : ""}${parsed.value}` });
  }
  if (!/^[0-9]{1,3}[A-Z]{0,4}$/.test(base)) errors.unshift("Base BF must be a paper grade code such as 18 or 22GY");
  if (!deltas.length && !errors.length) errors.push("List at least one other BF and its delta");
  return { ok: errors.length === 0, deltas, errors };
}

export function bfSetBody(form, deltas, { closePrior } = {}) {
  return {
    customer_location_id: blankToNull(form.customer_location_id),
    plant_id: blankToNull(form.plant_id),
    effective_from: form.effective_from,
    effective_to: blankToNull(form.effective_to),
    close_prior: closePrior === true,
    base_bf_code: String(form.base_bf_code || "").trim().toUpperCase(),
    deltas,
    source_type: blankToNull(form.source_type),
    source_date: blankToNull(form.source_date),
    source_ref: String(form.source_ref ?? "").trim(),
    notes: String(form.notes ?? "").trim(),
  };
}

export function bfSetCorrectionBody(form, expectedVersion) {
  return {
    expected_content_version: expectedVersion,
    status: form.status || "active",
    effective_from: form.effective_from,
    effective_to: blankToNull(form.effective_to),
    source_type: blankToNull(form.source_type),
    source_date: blankToNull(form.source_date),
    source_ref: String(form.source_ref ?? "").trim(),
    notes: String(form.notes ?? "").trim(),
  };
}

export function referencesBody(termId, bfSetId, expectedVersion) {
  return { expected_content_version: expectedVersion, term_version_id: blankToNull(termId),
    bf_delta_set_id: blankToNull(bfSetId) };
}

export function measureBody(measure, source, value, expectedVersion, notes) {
  return { measure, source, value: blankToNull(value), expected_content_version: expectedVersion ?? null,
    notes: String(notes ?? "").trim() };
}

export function overrideBody(bfCode, overrideRate, expectedVersion) {
  return { bf_code: bfCode, override_rate_inr: blankToNull(overrideRate), expected_content_version: expectedVersion };
}
