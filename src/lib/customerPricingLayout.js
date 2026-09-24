// ═══════════════════════════════════════════════════════════════════════════
// src/lib/customerPricingLayout.js — Customer Pricing History P0.3, the
// frontend-only presentation engine.
//
// Authority: docs/customer-pricing-history-phase-0-implementation-plan-2026-09-23.md §6.
//
// PRESENTATION ONLY. A layout decides WHERE a canonical value appears. It never
// moves a field's owner, copies an inherited value into a record, promotes a
// Line value to a Cycle or the Customer, deletes a repeated value, changes an
// API payload or pivots anything on the backend. Every function here reads the
// canonical pricing-history payload and returns display structures; nothing
// here mutates that payload.
//
// Every cell carries the canonical record it was rendered from (type, id,
// content_version) and, when editable, the canonical field it edits. An edit is
// built from that identity (cellMutation) — never from the cell's visual row or
// column, so Standard, Transposed and grouped views all send the same request.
//
// Stored state is LAYOUT PREFERENCES ONLY (field ids, zones, orientation,
// pins, grouping, date mode, view names), browser/device-local through
// lib/persist.js, keyed by authenticated user id and Customer party id. Views
// do not roam across browsers/devices and are never shared with other users.
// ═══════════════════════════════════════════════════════════════════════════
import * as persist from "./persist.js";
import {
  FREIGHT_TREATMENTS, FREQUENCIES, RATE_BASES, TAX_TREATMENTS, WASTAGE_TREATMENTS, WEIGHT_BASES,
  CYCLE_STATUSES, MEASURE_SOURCES, cycleBody, cycleFormFromRecord, cycleLabel, displayDate, equivalentRate, formatInr,
  formatPct, labelOf, lineBody, lineFormFromRecord, negotiationSummary, preferredMeasure, rateUnitLabel, scopeDisplay,
  sobDisplay, sobValue, validateCycleForm, validateLineForm,
} from "./customerPricingModel.js";

export const LAYOUT_VERSION = 1;
export const ZONES = ["rows", "columns", "details", "hidden"];
export const ZONE_LABELS = { rows: "Rows", columns: "Columns", details: "Details", hidden: "Hidden" };
export const DATE_MODES = [
  { v: "auto", l: "Initiated → agreed" },
  { v: "initiation", l: "Initiation date" },
  { v: "agreement", l: "Agreement date" },
  { v: "latest_activity", l: "Latest activity" },
  { v: "period_start", l: "Period start" },
  { v: "period_end", l: "Period end" },
];
const DATE_MODE_SET = new Set(DATE_MODES.map(d => d.v));

// ── field groups ────────────────────────────────────────────────────────────
export const FIELD_GROUPS = [
  { id: "cycle", label: "Cycle" },
  { id: "scope", label: "Scope" },
  { id: "negotiation", label: "Negotiation" },
  { id: "line", label: "Line" },
  { id: "basis", label: "Basis & Stable Term" },
  { id: "components", label: "Agreed components" },
  { id: "measures", label: "Weights & area" },
  { id: "bf", label: "BF" },
  { id: "bf_schedule", label: "BF schedule (agreed)" },
  { id: "mechanism", label: "Customer mechanism" },
];
const GROUP_IDS = new Set(FIELD_GROUPS.map(g => g.id));

// ── canonical records (the cycles/lines axis) ──────────────────────────────
// One displayed record per Pricing Line; a Cycle with no lines yet is its own
// record so it still has a place in every orientation.
export function canonicalRecords(data) {
  const out = [];
  for (const cycle of data?.cycles || []) {
    const lines = cycle.lines || [];
    if (!lines.length) out.push({ key: `cycle:${cycle.id}`, kind: "cycle", cycle, line: null });
    for (const line of lines) out.push({ key: `line:${line.id}`, kind: "line", cycle, line });
  }
  return out;
}

export function buildContext(data, { dateMode = "auto" } = {}) {
  const terms = data?.term_versions || [];
  const bfSets = data?.bf_delta_sets || [];
  return {
    mechanism: data?.mechanism || null,
    termById: Object.fromEntries(terms.map(t => [t.id, t])),
    bfById: Object.fromEntries(bfSets.map(b => [b.id, b])),
    lookups: { locations: data?.locations || [], plants: data?.plants || [] },
    skus: data?.skus || [],
    labelStyle: data?.mechanism?.period_label_style || "financial_year",
    dateMode: DATE_MODE_SET.has(dateMode) ? dateMode : "auto",
  };
}

export function recordLabel(rec, ctx) {
  const label = cycleLabel(rec.cycle, ctx.labelStyle);
  return rec.line ? `${label} · ${scopeDisplay(rec.line, ctx.lookups)}` : `${label} · no lines yet`;
}

// ── owner resolution ────────────────────────────────────────────────────────
const src = (type, rec) => (rec ? { recordType: type, recordId: rec.id, version: rec.content_version ?? null } : null);
const summaryOf = rec => negotiationSummary(rec.line?.events);

function lineUnit(rec, ctx) {
  const term = ctx.termById[rec.line?.term_version_id];
  return [term?.rate_basis ?? ctx.mechanism?.rate_basis, term?.weight_basis ?? ctx.mechanism?.weight_basis];
}

// Field spec helpers. `resolve(rec, ctx)` returns
//   { applicable, source, raw, display }
// `raw` is the canonical comparison value: null = blank, "0.00" = explicit zero.
const na = reason => ({ applicable: false, source: null, raw: null, display: reason });
const val = (source, raw, display) => ({ applicable: true, source, raw: raw ?? null,
  display: display ?? (raw === null || raw === undefined || raw === "" ? "—" : String(raw)) });

function mechField(id, label, key, list) {
  return { id, label, group: "mechanism", owner: "mechanism",
    resolve: (rec, ctx) => (ctx.mechanism
      ? val(src("mechanism", ctx.mechanism), ctx.mechanism[key] ?? null,
        ctx.mechanism[key] ? labelOf(list, ctx.mechanism[key]) : "Not yet captured")
      : na("No mechanism recorded")) };
}

function cycleField(id, label, get, extra = {}) {
  return { id, label, group: "cycle", owner: "cycle", ...extra,
    resolve: (rec, ctx) => { const [raw, display] = get(rec.cycle, ctx, rec); return val(src("cycle", rec.cycle), raw, display); } };
}

function lineField(id, label, group, get, extra = {}) {
  return { id, label, group, owner: "line", ...extra,
    resolve: (rec, ctx) => {
      if (!rec.line) return na("No line");
      const [raw, display] = get(rec.line, ctx, rec);
      return val(src("line", rec.line), raw, display);
    } };
}

function negotiationField(id, label, pick, render, extra = {}) {
  return { id, label, group: "negotiation", owner: "event", kind: "money", ...extra,
    resolve: (rec, ctx) => {
      if (!rec.line) return na("No line");
      const e = pick(summaryOf(rec));
      if (!e) return val(src("line", rec.line), null, "—");
      const [raw, display] = render(e, rec, ctx);
      return val(src("event", e), raw, display);
    } };
}

function termField(id, label, get, extra = {}) {
  return { id, label, group: "basis", owner: "term", ...extra,
    resolve: (rec, ctx) => {
      if (!rec.line) return na("No line");
      const term = ctx.termById[rec.line.term_version_id];
      if (!term) return na("No Stable Term");
      const [raw, display] = get(term, ctx);
      return val(src("term", term), raw, display);
    } };
}

function componentField(id, label, key) {
  return { id, label, group: "components", owner: "event", kind: "money",
    resolve: (rec) => {
      if (!rec.line) return na("No line");
      const e = summaryOf(rec).finalAgreed;
      if (!e) return val(src("line", rec.line), null, "—");
      const raw = e[key] ?? null;
      return val(src("event", e), raw, formatInr(raw));
    } };
}

// A weight/area value is owned by its own independently versioned
// customer_pricing_line_measures row, not by the line. With several sources the
// preferred one (Customer-confirmed > Costing > manual > imported) is shown and
// is the canonical source. With none, the line is named as having no record —
// no measure record is invented.
function measureField(id, label, measure, unit) {
  return { id, label, group: "measures", owner: "measure", kind: "measure",
    resolve: (rec) => {
      if (!rec.line) return na("No line");
      const m = preferredMeasure(rec.line.measures, measure);
      if (!m) return val({ ...src("line", rec.line), absent: `no ${label.toLowerCase()} recorded` }, null, "—");
      return val(src("measure", m), m.value, `${m.value} ${unit} (${labelOf(MEASURE_SOURCES, m.source).toLowerCase()})`);
    } };
}

function bfSetField(id, label, get) {
  return { id, label, group: "bf", owner: "bf_set",
    resolve: (rec, ctx) => {
      if (!rec.line) return na("No line");
      const set = ctx.bfById[rec.line.bf_delta_set_id];
      if (!set) return na("No BF set");
      const [raw, display] = get(set);
      return val(src("bf_set", set), raw, display);
    } };
}

const signedDelta = d => (String(d).startsWith("-") ? `−${formatInr(String(d).slice(1), { symbol: false })}`
  : `+${formatInr(d, { symbol: false })}`);

const STATIC_FIELDS = [
  cycleField("cycle.label", "Cycle", (c, ctx) => [cycleLabel(c, ctx.labelStyle), null]),
  cycleField("cycle.date", "Date", (c, ctx) => { const d = displayDate(c, c.lines, ctx.dateMode); return [d, d || "—"]; }),
  cycleField("cycle.period", "Period", c => [`${c.period_start}..${c.period_end}`, `${c.period_start} – ${c.period_end}`]),
  cycleField("cycle.frequency", "Frequency", c => [c.review_frequency ?? null, labelOf(FREQUENCIES, c.review_frequency)]),
  cycleField("cycle.initiated_on", "Initiated", c => [c.initiated_on ?? null, null]),
  cycleField("cycle.status", "Cycle status", c => [c.status ?? null, labelOf(CYCLE_STATUSES, c.status)]),
  cycleField("cycle.custom_label", "Custom label", c => [c.custom_label || null, c.custom_label || "—"],
    { edit: { recordType: "cycle", fieldId: "custom_label", input: "text" } }),
  cycleField("cycle.notes", "Cycle notes", c => [c.notes || null, c.notes || "—"],
    { edit: { recordType: "cycle", fieldId: "notes", input: "text" } }),

  lineField("line.scope", "Scope", "scope", (l, ctx) => { const s = scopeDisplay(l, ctx.lookups); return [s, s]; }),
  lineField("line.location", "Location", "scope", (l, ctx) => [l.customer_location_id ?? null,
    l.customer_location_id == null ? "Any location"
      : ctx.lookups.locations.find(x => x.id === l.customer_location_id)?.location_code || `Location #${l.customer_location_id}`]),
  lineField("line.plant", "Plant", "scope", (l, ctx) => [l.plant_id ?? null,
    l.plant_id == null ? "Any plant" : ctx.lookups.plants.find(p => p.id === l.plant_id)?.plant_code || `Plant #${l.plant_id}`]),
  lineField("line.sku", "SKU", "scope", (l, ctx) => [l.sku_id ?? null,
    l.sku_id == null ? "—" : ctx.skus.find(k => k.id === l.sku_id)?.plant_item_code || `SKU #${l.sku_id}`]),
  lineField("line.scope_text", "Item / scope text", "scope", l => [l.scope_text || null, l.scope_text || "—"],
    { edit: { recordType: "line", fieldId: "scope_text", input: "text" } }),

  negotiationField("neg.our_offer", "Our offer", s => s.ourOffer, e => [e.rate_inr ?? null, formatInr(e.rate_inr)]),
  negotiationField("neg.customer_offer", "Customer offer", s => s.customerOffer, e => [e.rate_inr ?? null, formatInr(e.rate_inr)]),
  negotiationField("neg.final_agreed", "Final agreed", s => s.finalAgreed, e => [e.rate_inr ?? null, formatInr(e.rate_inr)],
    { emphasis: true }),
  negotiationField("neg.final_date", "Agreed on", s => s.finalAgreed, e => [e.event_date ?? null, e.event_date || "—"],
    { kind: "date" }),
  negotiationField("neg.final_tax", "Agreed tax", s => s.finalAgreed,
    e => [{ tax: e.tax_treatment || null, gst: e.gst_pct ?? null },
      e.tax_treatment === "including_gst" ? `Incl. GST ${formatPct(e.gst_pct)}` : labelOf(TAX_TREATMENTS, e.tax_treatment)],
    { kind: "text" }),
  negotiationField("neg.equivalent", "Equivalent (agreed)", s => s.finalAgreed, (e, rec, ctx) => {
    const [rb, wb] = [e.rate_basis ?? lineUnit(rec, ctx)[0], e.weight_basis ?? lineUnit(rec, ctx)[1]];
    const eq = equivalentRate(e.rate_inr, rb, wb, rec.line.measures);
    return eq.available ? [`${eq.value}${eq.unit}`, `≈ ${formatInr(eq.value)} ${eq.unit}`] : [null, eq.reason];
  }, { kind: "text" }),
  lineField("neg.rounds", "Rounds", "negotiation", l => {
    const n = negotiationSummary(l.events).rounds;
    return [n, `${n} ${n === 1 ? "round" : "rounds"}`];
  }, { action: "expand" }),

  // Raw = state + only the value that state carries, so a summary never merges
  // blank, 0.00% and 0 boxes, or a percentage with a box quantity.
  lineField("line.sob", "SOB", "line", l => [sobValue(l), sobDisplay(l)],
  { edit: { recordType: "line", fieldId: "sob", input: "sob" } }),
  lineField("line.notes", "Line notes", "line", l => [l.notes || null, l.notes || "—"],
    { edit: { recordType: "line", fieldId: "notes", input: "text" } }),

  lineField("line.basis", "Basis", "basis", (l, ctx, rec) => {
    const unit = rateUnitLabel(...lineUnit(rec, ctx));
    const bf = ctx.bfById[l.bf_delta_set_id];
    const text = [unit, bf ? `BF ${bf.base_bf_code}` : ""].filter(Boolean).join(" · ");
    return [text || null, text || "—"];
  }),
  termField("term.effective", "Term effective", t => [`${t.effective_from}..${t.effective_to || ""}`,
    `v${t.version_no} · ${t.effective_from} → ${t.effective_to || "open"}`]),
  termField("term.rate_basis", "Term rate basis", t => [t.rate_basis ?? null,
    t.rate_basis ? labelOf(RATE_BASES, t.rate_basis) : "Not yet captured"]),
  termField("term.weight_basis", "Term weight basis", t => [t.weight_basis ?? null,
    t.weight_basis ? labelOf(WEIGHT_BASES, t.weight_basis) : "Not yet captured"]),
  termField("term.wastage", "Wastage", t => [{ treatment: t.wastage_treatment || null, pct: t.wastage_pct ?? null },
    t.wastage_treatment === "added_pct" ? `+${formatPct(t.wastage_pct)}` : labelOf(WASTAGE_TREATMENTS, t.wastage_treatment)]),
  termField("term.freight_treatment", "Freight treatment", t => [t.freight_treatment ?? null,
    labelOf(FREIGHT_TREATMENTS, t.freight_treatment)]),
  termField("term.conversion", "Conversion ₹/kg PC", t => [t.conversion_inr_per_kg ?? null, formatInr(t.conversion_inr_per_kg)],
    { kind: "money" }),
  termField("term.freight", "Freight ₹/kg SW", t => [t.freight_inr_per_kg ?? null, formatInr(t.freight_inr_per_kg)],
    { kind: "money" }),

  componentField("comp.kraft", "Kraft (agreed)", "component_kraft_inr"),
  componentField("comp.conversion", "Conversion (agreed)", "component_conversion_inr"),
  componentField("comp.freight", "Freight (agreed)", "component_freight_inr"),
  componentField("comp.total", "Component total", "component_total_inr"),
  componentField("comp.diff", "Reconciliation Δ", "reconciliation_diff_inr"),

  measureField("m.paper_consumed", "Paper consumed", "paper_consumed_kg", "kg"),
  measureField("m.sheet_weight", "Sheet weight", "sheet_weight_kg", "kg"),
  measureField("m.box_weight", "Box weight", "box_weight_kg", "kg"),
  measureField("m.area", "Area", "area_sqm", "m²"),

  bfSetField("bf.base", "Base BF", s => [s.base_bf_code ?? null, s.base_bf_code ? `BF ${s.base_bf_code}` : "—"]),
  bfSetField("bf.deltas", "BF deltas", s => {
    const ds = (s.deltas || []).map(d => [d.bf_code, d.delta_inr]);
    return [ds.length ? ds : null, ds.length ? ds.map(([c, d]) => `${c} ${signedDelta(d)}`).join(" · ") : "—"];
  }),

  mechField("mech.frequency", "Review frequency", "review_frequency", FREQUENCIES),
  mechField("mech.rate_basis", "Rate basis", "rate_basis", RATE_BASES),
  mechField("mech.weight_basis", "Weight basis", "weight_basis", WEIGHT_BASES),
  mechField("mech.tax", "Tax treatment", "tax_treatment", TAX_TREATMENTS),
];
for (const f of STATIC_FIELDS) if (!f.kind) f.kind = "text";

export const STATIC_FIELD_IDS = STATIC_FIELDS.map(f => f.id);
const STATIC_BY_ID = new Map(STATIC_FIELDS.map(f => [f.id, f]));

// One agreed BF grade rate: the final agreement's OWN snapshotted schedule
// (derived or override), so a later BF set change never alters it here.
const BF_FIELD = /^bf:([0-9]{1,3}[A-Z]{0,4})$/;
function bfGradeField(code) {
  return { id: `bf:${code}`, label: `BF ${code}`, group: "bf_schedule", owner: "event", kind: "money", dynamic: true,
    resolve: (rec) => {
      if (!rec.line) return na("No line");
      const e = summaryOf(rec).finalAgreed;
      if (!e) return val(src("line", rec.line), null, "—");
      const row = (e.bf_schedule || []).find(r => r.bf_code === code);
      if (!row) return val(src("event", e), null, "—");
      const raw = row.effective_rate_inr ?? null;
      return val(src("event", e), raw, `${formatInr(raw)}${row.is_override ? " override" : row.is_base ? " base" : ""}`);
    } };
}

// Static fields + one field per BF grade that appears in a line's FINAL
// AGREEMENT schedule (grade order: numeric, then code). A grade quoted only in
// an offer or counter is not an agreed rate and gets no agreed-BF field.
export function buildFieldRegistry(data) {
  const codes = new Set();
  for (const c of data?.cycles || []) {
    for (const l of c.lines || []) {
      for (const r of negotiationSummary(l.events).finalAgreed?.bf_schedule || []) if (r?.bf_code) codes.add(r.bf_code);
    }
  }
  const sorted = [...codes].filter(c => BF_FIELD.test(`bf:${c}`))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || (a < b ? -1 : a > b ? 1 : 0));
  const fields = [...STATIC_FIELDS, ...sorted.map(bfGradeField)];
  return { fields, byId: new Map(fields.map(f => [f.id, f])) };
}

export const STATIC_REGISTRY = buildFieldRegistry(null);

// ── cells ───────────────────────────────────────────────────────────────────
// A cell = one canonical value at one (record, field). `ref` is present only
// on an editable cell whose owning record exists: canonical record type, id,
// canonical field id and the CAS version it was rendered from.
export function cellFor(field, rec, ctx) {
  const r = field.resolve(rec, ctx);
  const edit = field.edit && r.applicable && r.source?.recordType === field.edit.recordType ? field.edit : null;
  return {
    recordKey: rec.key, fieldId: field.id, applicable: r.applicable, raw: r.raw, display: r.display,
    source: r.source,
    ref: edit ? { recordType: r.source.recordType, recordId: r.source.recordId, fieldId: edit.fieldId,
      version: r.source.version } : null,
    input: edit?.input || null,
  };
}

// Blank, explicit zero and every distinct value stay distinct.
export function comparisonKey(raw) {
  return raw === null || raw === undefined || raw === "" ? "∅" : JSON.stringify(raw);
}

// ── common-value summaries ─────────────────────────────────────────────────
// One value ONLY when every applicable canonical value is identical (blank and
// 0.00 are different values). Otherwise "Mixed values" plus the contributing
// canonical records. Several displayed rows that share one owning record (the
// same Cycle, Stable Term or mechanism) count as that record once.
export function summarizeField(field, records, ctx) {
  const bySource = new Map();
  let notApplicable = 0;
  for (const rec of records) {
    const cell = cellFor(field, rec, ctx);
    if (!cell.applicable) { notApplicable += 1; continue; }
    const id = `${cell.source.recordType}:${cell.source.recordId}`;
    const hit = bySource.get(id);
    if (hit) hit.usedBy.push(recordLabel(rec, ctx));
    else bySource.set(id, { ...cell.source, key: comparisonKey(cell.raw), raw: cell.raw, display: cell.display,
      usedBy: [recordLabel(rec, ctx)] });
  }
  const contributors = [...bySource.values()];
  if (!contributors.length) return { state: "none", display: "Not applicable", contributors, notApplicable };
  const keys = new Set(contributors.map(c => c.key));
  if (keys.size === 1) {
    const one = contributors[0];
    return { state: "common", display: one.display, raw: one.raw, blank: one.key === "∅", contributors, notApplicable };
  }
  return { state: "mixed", display: "Mixed values", contributors, notApplicable };
}

// A requested Mixed-values disclosure, re-derived from the CURRENT view so it
// never shows stale records and disappears once its field or group is gone.
// request = { kind: "details", fieldId } | { kind: "group", groupKey, fieldId }
export function resolveDisclosure(request, view) {
  if (!request) return null;
  if (request.kind === "details") {
    const f = view.details.find(x => x.id === request.fieldId);
    return f ? { key: `details|${f.id}`, title: f.label, summary: summarizeField(f, view.records, view.ctx) } : null;
  }
  if (request.kind === "group") {
    const g = view.recordGroups?.find(x => x.key === request.groupKey);
    const f = view.fields.find(x => x.id === request.fieldId);
    return g && f ? { key: `group|${g.key}|${f.id}`, title: `${f.label} — ${view.groupField.label}: ${g.label}`,
      summary: summarizeField(f, g.records, view.ctx) } : null;
  }
  return null;
}

// ── layouts ─────────────────────────────────────────────────────────────────
// Stored shape (v1). `fields` is the ordered field axis: columns in Standard,
// rows in Transposed. The records axis occupies the other zone; a field placed
// there becomes `recordGroupBy` (records grouped by that field's value).
const LAYOUT_KEYS = ["v", "orientation", "fields", "details", "hidden", "recordGroupBy", "pinned", "grouped",
  "collapsed", "dateMode"];

const isFieldId = id => typeof id === "string" && (STATIC_BY_ID.has(id) || BF_FIELD.test(id));
const expandTokens = (list, registry) => list.flatMap(id => {
  const m = /^@group:(.+)$/.exec(id);
  return m ? registry.fields.filter(f => f.group === m[1]).map(f => f.id) : [id];
});

// Validate and canonicalise a layout. Returns null for anything structurally
// wrong (wrong version, wrong types) — the caller then falls back to Standard.
// Unknown field ids are dropped; each field lives in exactly one place; static
// fields the layout never mentions are hidden.
export function normalizeLayout(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (raw.v !== LAYOUT_VERSION) return null;
  if (raw.orientation !== "standard" && raw.orientation !== "transposed") return null;
  for (const k of ["fields", "details", "hidden", "pinned", "collapsed"]) {
    if (raw[k] !== undefined && !Array.isArray(raw[k])) return null;
  }
  const seen = new Set();
  const take = list => (list || []).filter(id => isFieldId(id) && !seen.has(id) && seen.add(id));
  const recordGroupBy = isFieldId(raw.recordGroupBy) ? raw.recordGroupBy : null;
  if (recordGroupBy) seen.add(recordGroupBy);
  const fields = take(raw.fields);
  const details = take(raw.details);
  const hidden = take(raw.hidden);
  for (const id of STATIC_FIELD_IDS) if (!seen.has(id)) { hidden.push(id); seen.add(id); }
  const onAxis = new Set(fields);
  return {
    v: LAYOUT_VERSION,
    orientation: raw.orientation,
    fields, details, hidden, recordGroupBy,
    pinned: [...new Set((raw.pinned || []).filter(id => onAxis.has(id)))],
    grouped: raw.grouped === true,
    collapsed: [...new Set((raw.collapsed || []).filter(g => GROUP_IDS.has(g)))],
    dateMode: DATE_MODE_SET.has(raw.dateMode) ? raw.dateMode : "auto",
  };
}

// A field present in this Customer's data but absent from the stored layout
// (a BF grade first agreed after the view was saved) is shown beside its group
// siblings, or hidden when it has none. Not persisted until the user edits.
export function placeUnplaced(layout, registry) {
  const placed = new Set([...layout.fields, ...layout.details, ...layout.hidden,
    ...(layout.recordGroupBy ? [layout.recordGroupBy] : [])]);
  const out = { ...layout, fields: [...layout.fields], details: [...layout.details], hidden: [...layout.hidden] };
  for (const f of registry.fields) {
    if (placed.has(f.id)) continue;
    const zone = ["fields", "details", "hidden"].find(z => out[z].some(id => registry.byId.get(id)?.group === f.group))
      || "hidden";
    const list = out[zone];
    const lastSibling = list.map(id => registry.byId.get(id)?.group).lastIndexOf(f.group);
    list.splice(lastSibling < 0 ? list.length : lastSibling + 1, 0, f.id);
    placed.add(f.id);
  }
  return out;
}

export function serializeLayout(layout) {
  const out = {};
  for (const k of LAYOUT_KEYS) out[k] = layout[k];
  return out;
}

export const layoutsEqual = (a, b) => JSON.stringify(serializeLayout(a)) === JSON.stringify(serializeLayout(b));

// ── presets ─────────────────────────────────────────────────────────────────
const MECH_DETAILS = ["mech.frequency", "mech.rate_basis", "mech.weight_basis", "mech.tax"];
export const PRESETS = [
  { id: "standard", label: "Standard", spec: {
    orientation: "standard", pinned: ["cycle.label"],
    fields: ["cycle.label", "cycle.date", "line.scope", "line.basis", "neg.our_offer", "neg.customer_offer",
      "neg.final_agreed", "line.sob", "neg.rounds"],
    details: MECH_DETAILS } },
  { id: "negotiation", label: "Negotiation", spec: {
    orientation: "standard", grouped: true, pinned: ["cycle.label", "line.scope"],
    fields: ["cycle.label", "cycle.date", "line.scope", "neg.our_offer", "neg.customer_offer", "neg.final_agreed",
      "neg.final_date", "neg.final_tax", "neg.equivalent", "neg.rounds", "line.sob"],
    details: [...MECH_DETAILS, "term.rate_basis", "term.weight_basis"] } },
  { id: "bf_schedule", label: "BF Schedule", spec: {
    orientation: "transposed", pinned: ["cycle.label"],
    fields: ["cycle.label", "line.scope", "bf.base", "neg.final_agreed", "@group:bf_schedule", "neg.rounds"],
    details: ["bf.deltas", "mech.rate_basis", "mech.weight_basis"] } },
  { id: "location_comparison", label: "Location Comparison", spec: {
    orientation: "standard", recordGroupBy: "line.location", pinned: ["cycle.label"],
    fields: ["cycle.label", "line.plant", "line.sku", "line.scope_text", "neg.final_agreed", "neg.equivalent",
      "m.paper_consumed", "line.sob", "neg.rounds"],
    details: [...MECH_DETAILS, "term.conversion", "term.freight"] } },
  { id: "annual_terms", label: "Annual Terms", spec: {
    orientation: "standard", grouped: true, pinned: ["cycle.label"],
    fields: ["cycle.label", "cycle.period", "line.scope", "term.effective", "term.rate_basis", "term.weight_basis",
      "term.wastage", "term.freight_treatment", "term.conversion", "term.freight", "bf.base", "bf.deltas", "neg.rounds"],
    details: MECH_DETAILS } },
];
export const STANDARD_PRESET_ID = "standard";

export function presetLayout(id, registry = STATIC_REGISTRY) {
  const preset = PRESETS.find(p => p.id === id) || PRESETS[0];
  const s = preset.spec;
  return placeUnplaced(normalizeLayout({ v: LAYOUT_VERSION, orientation: s.orientation,
    fields: expandTokens(s.fields, registry), details: expandTokens(s.details || [], registry), hidden: [],
    recordGroupBy: s.recordGroupBy || null, pinned: s.pinned || [], grouped: !!s.grouped, collapsed: [],
    dateMode: "auto" }), registry);
}

export const standardLayout = registry => presetLayout(STANDARD_PRESET_ID, registry);

// Every id a preset names must be a registered field (or a known group token).
export function presetProblems(preset) {
  const s = preset.spec;
  const ids = [...s.fields, ...(s.details || []), ...(s.pinned || []), ...(s.recordGroupBy ? [s.recordGroupBy] : [])];
  return ids.filter(id => {
    const m = /^@group:(.+)$/.exec(id);
    return m ? !GROUP_IDS.has(m[1]) : !STATIC_BY_ID.has(id);
  });
}

// ── layout operations (drag/drop and the accessible menu share these) ──────
export const fieldAxisZone = layout => (layout.orientation === "transposed" ? "rows" : "columns");
export const recordAxisZone = layout => (layout.orientation === "transposed" ? "columns" : "rows");

export function zoneOf(layout, fieldId) {
  if (layout.recordGroupBy === fieldId) return recordAxisZone(layout);
  if (layout.fields.includes(fieldId)) return fieldAxisZone(layout);
  if (layout.details.includes(fieldId)) return "details";
  if (layout.hidden.includes(fieldId)) return "hidden";
  return null;
}

// The four zones as displayed: the records axis appears as "@records".
export function layoutZones(layout) {
  const fieldAxis = fieldAxisZone(layout);
  return {
    [fieldAxis]: layout.fields,
    [recordAxisZone(layout)]: ["@records", ...(layout.recordGroupBy ? [layout.recordGroupBy] : [])],
    details: layout.details,
    hidden: layout.hidden,
  };
}

function listKey(layout, zone) {
  if (zone === fieldAxisZone(layout)) return "fields";
  if (zone === "details" || zone === "hidden") return zone;
  return null;
}

// op: { type: "move", fieldId, zone, before }   before = field id to insert
//        in front of, or null to append. Moving into the records-axis zone
//        groups the records by that field (the previous grouping field goes
//        to Hidden).
//     { type: "pin" | "unpin", fieldId }   { type: "transpose" }
//     { type: "group" | "ungroup" }        { type: "collapse" | "expand", groupId }
//     { type: "dateMode", mode }
export function applyLayoutOp(layout, op) {
  const L = { ...layout, fields: [...layout.fields], details: [...layout.details], hidden: [...layout.hidden],
    pinned: [...layout.pinned], collapsed: [...layout.collapsed] };
  switch (op?.type) {
    case "move": {
      const { fieldId, zone } = op;
      if (!isFieldId(fieldId) || !ZONES.includes(zone) || !zoneOf(layout, fieldId)) return layout;
      const target = listKey(L, zone);
      const before = op.before ?? null;
      if (before === fieldId) return layout;
      for (const k of ["fields", "details", "hidden"]) L[k] = L[k].filter(id => id !== fieldId);
      if (L.recordGroupBy === fieldId) L.recordGroupBy = null;
      if (target) {
        const list = L[target];
        const at = before === null ? -1 : list.indexOf(before);
        list.splice(at < 0 ? list.length : at, 0, fieldId);
      } else {
        if (L.recordGroupBy) L.hidden.push(L.recordGroupBy);
        L.recordGroupBy = fieldId;
      }
      L.pinned = L.pinned.filter(id => L.fields.includes(id));
      return L;
    }
    case "pin":
      if (!L.fields.includes(op.fieldId) || L.pinned.includes(op.fieldId)) return layout;
      L.pinned.push(op.fieldId);
      return L;
    case "unpin":
      if (!L.pinned.includes(op.fieldId)) return layout;
      L.pinned = L.pinned.filter(id => id !== op.fieldId);
      return L;
    case "transpose":
      L.orientation = L.orientation === "transposed" ? "standard" : "transposed";
      return L;
    case "group": L.grouped = true; return L;
    case "ungroup": L.grouped = false; return L;
    case "collapse":
      if (!GROUP_IDS.has(op.groupId) || L.collapsed.includes(op.groupId)) return layout;
      L.collapsed.push(op.groupId);
      return L;
    case "expand":
      L.collapsed = L.collapsed.filter(g => g !== op.groupId);
      return L;
    case "dateMode":
      if (!DATE_MODE_SET.has(op.mode)) return layout;
      L.dateMode = op.mode;
      return L;
    default:
      return layout;
  }
}

// What a drop does: dropping a field on zone Z (onto chip `beforeId`, or onto
// the zone's empty space) is exactly a "move" op.
export function dropOp(fieldId, zone, beforeId = null) {
  return { type: "move", fieldId, zone, before: beforeId === "@records" ? null : beforeId };
}

// The accessible menu equivalent of every drag, per field. Each entry carries
// the SAME op a drag would produce.
export function fieldMenuActions(layout, fieldId) {
  const zone = zoneOf(layout, fieldId);
  if (!zone) return [];
  const out = [];
  const axis = fieldAxisZone(layout);
  const recs = recordAxisZone(layout);
  const moveTo = { [axis]: layout.orientation === "transposed" ? "Show as a row" : "Show as a column",
    [recs]: layout.orientation === "transposed" ? "Group record columns by this" : "Group record rows by this",
    details: "Move to Details", hidden: "Hide" };
  for (const z of [axis, recs, "details", "hidden"]) {
    if (z !== zone) out.push({ id: `to-${z}`, label: `${moveTo[z]} (${ZONE_LABELS[z]})`, op: dropOp(fieldId, z, null) });
  }
  const key = listKey(layout, zone);
  if (key) {
    const list = layout[key];
    const i = list.indexOf(fieldId);
    if (i > 0) {
      out.push({ id: "first", label: "Move to start", op: dropOp(fieldId, zone, list[0]) });
      out.push({ id: "earlier", label: "Move earlier", op: dropOp(fieldId, zone, list[i - 1]) });
    }
    if (i < list.length - 1) {
      out.push({ id: "later", label: "Move later", op: dropOp(fieldId, zone, list[i + 2] ?? null) });
      out.push({ id: "last", label: "Move to end", op: dropOp(fieldId, zone, null) });
    }
  }
  if (zone === axis) {
    out.push(layout.pinned.includes(fieldId)
      ? { id: "unpin", label: "Unpin", op: { type: "unpin", fieldId } }
      : { id: "pin", label: layout.orientation === "transposed" ? "Pin row" : "Pin column", op: { type: "pin", fieldId } });
  }
  return out;
}

// ── view ────────────────────────────────────────────────────────────────────
// The visible field axis: pinned first, then (when grouped) contiguous by
// group in first-appearance order; a collapsed group shows only its lead field.
export function axisFields(layout, registry) {
  const known = layout.fields.filter(id => registry.byId.has(id));
  const pinned = known.filter(id => layout.pinned.includes(id));
  let rest = known.filter(id => !layout.pinned.includes(id));
  let bands = [{ groupId: null, ids: rest }];
  if (layout.grouped) {
    const order = [];
    const byGroup = new Map();
    for (const id of rest) {
      const g = registry.byId.get(id).group;
      if (!byGroup.has(g)) { byGroup.set(g, []); order.push(g); }
      byGroup.get(g).push(id);
    }
    bands = order.map(g => {
      const ids = byGroup.get(g);
      const collapsed = layout.collapsed.includes(g);
      return { groupId: g, ids: collapsed ? ids.slice(0, 1) : ids, hiddenCount: collapsed ? ids.length - 1 : 0, collapsed };
    });
    rest = bands.flatMap(b => b.ids);
  }
  const all = [...pinned, ...rest].map(id => registry.byId.get(id));
  return { fields: all, pinnedCount: pinned.length,
    bands: [...(pinned.length ? [{ groupId: "pinned", ids: pinned, pinned: true }] : []), ...bands] };
}

export function buildView(data, layout, registry = buildFieldRegistry(data)) {
  const ctx = buildContext(data, { dateMode: layout.dateMode });
  const records = canonicalRecords(data);
  const axis = axisFields(layout, registry);
  let recordGroups = null;
  const groupField = layout.recordGroupBy && registry.byId.get(layout.recordGroupBy);
  let ordered = records;
  if (groupField) {
    const groups = new Map();
    for (const rec of records) {
      const cell = cellFor(groupField, rec, ctx);
      const key = cell.applicable ? comparisonKey(cell.raw) : "n/a";
      if (!groups.has(key)) groups.set(key, { key, label: cell.applicable ? cell.display : "Not applicable", records: [] });
      groups.get(key).records.push(rec);
    }
    recordGroups = [...groups.values()];
    ordered = recordGroups.flatMap(g => g.records);
  }
  return {
    orientation: layout.orientation, ctx, records: ordered, recordGroups, groupField: groupField || null,
    fields: axis.fields, bands: axis.bands, pinnedCount: axis.pinnedCount,
    details: layout.details.filter(id => registry.byId.has(id)).map(id => registry.byId.get(id)),
  };
}

// The grid as a matrix of cells. Standard: records × fields; Transposed:
// fields × records. cells[r][c] always carries its own record + field
// identity, so nothing downstream needs to know the orientation.
export function gridMatrix(view) {
  const { fields, records, ctx } = view;
  if (view.orientation === "transposed") {
    return { rowAxis: "fields", rows: fields.map(f => f.id), cols: records.map(r => r.key),
      cells: fields.map(f => records.map(rec => cellFor(f, rec, ctx))) };
  }
  return { rowAxis: "records", rows: records.map(r => r.key), cols: fields.map(f => f.id),
    cells: records.map(rec => fields.map(f => cellFor(f, rec, ctx))) };
}

// ── editing through any layout ─────────────────────────────────────────────
// Builds the request from the cell's canonical identity — record type, id,
// field and the CAS version the cell was rendered from — never from where the
// cell sits. It opens the record's full edit form (the same helper the line /
// cycle edit forms use), changes one field, and returns the existing route's
// exact body. `route` = [pricingPaths key, id].
function findRecord(data, recordType, recordId) {
  for (const c of data?.cycles || []) {
    if (recordType === "cycle" && c.id === recordId) return c;
    if (recordType === "line") {
      const l = (c.lines || []).find(x => x.id === recordId);
      if (l) return l;
    }
  }
  return null;
}

export function cellMutation(ref, input, data) {
  if (!ref) return { ok: false, errors: { _: "This value is not editable here" } };
  const record = findRecord(data, ref.recordType, ref.recordId);
  if (!record) return { ok: false, errors: { _: "The record is no longer in this view — reload" } };
  if (ref.recordType === "line") {
    const form = lineFormFromRecord(record);
    if (ref.fieldId === "sob") {
      form.sob_state = input?.sob_state || "not_captured";
      form.sob_pct = input?.sob_pct ?? "";
      form.sob_allocated_boxes = input?.sob_allocated_boxes ?? "";
    }
    else if (ref.fieldId === "scope_text" || ref.fieldId === "notes") form[ref.fieldId] = input ?? "";
    else return { ok: false, errors: { _: "Unknown line field" } };
    const check = validateLineForm(form);
    if (!check.ok) return { ok: false, errors: check.errors };
    return { ok: true, method: "PATCH", route: ["line", record.id], body: lineBody(check.normalised, ref.version) };
  }
  if (ref.recordType === "cycle") {
    const form = cycleFormFromRecord(record);
    if (ref.fieldId === "custom_label" || ref.fieldId === "notes") form[ref.fieldId] = input ?? "";
    else return { ok: false, errors: { _: "Unknown cycle field" } };
    const check = validateCycleForm(form);
    if (!check.ok) return { ok: false, errors: check.errors };
    return { ok: true, method: "PATCH", route: ["cycle", record.id], body: cycleBody(form, ref.version) };
  }
  return { ok: false, errors: { _: "Unknown record type" } };
}

// Initial editor value for a cell, from the canonical record.
export function cellEditorValue(ref, data) {
  const record = ref && findRecord(data, ref.recordType, ref.recordId);
  if (!record) return null;
  if (ref.fieldId === "sob") {
    return { sob_state: record.sob_state || "not_captured", sob_pct: record.sob_pct ?? "",
      sob_allocated_boxes: record.sob_allocated_boxes ?? "" };
  }
  return record[ref.fieldId] ?? "";
}

// ── browser-local persistence (layout preferences only) ────────────────────
export const LAYOUT_STORAGE_PREFIX = "qgos_cph_layout";
export const MAX_NAMED_VIEWS = 20;
export const MAX_VIEW_NAME = 40;
const SAFE_ID = /^[A-Za-z0-9_.@-]{1,80}$/;

// Keyed by authenticated user AND Customer party. No stable identity → no key
// → nothing is stored (the layout lasts for the session only).
export function layoutStorageKey(userId, partyId) {
  const u = userId === null || userId === undefined ? "" : String(userId);
  const p = partyId === null || partyId === undefined ? "" : String(partyId);
  if (!SAFE_ID.test(u) || !/^[0-9]{1,18}$/.test(p)) return null;
  return `${LAYOUT_STORAGE_PREFIX}:${encodeURIComponent(u)}:${p}`;
}

export function cleanViewName(name) {
  const n = String(name ?? "").replace(/\s+/g, " ").trim();
  return n && n.length <= MAX_VIEW_NAME ? n : null;
}

const fallbackState = reason => ({ current: standardLayout(), active: { kind: "preset", id: STANDARD_PRESET_ID },
  named: {}, fallback: reason });

// Anything unreadable, obsolete or malformed falls back to Standard. It can
// never affect pricing data: this reads and writes one layout-only key.
export function loadLayoutState(userId, partyId, store = persist) {
  const key = layoutStorageKey(userId, partyId);
  if (!key) return fallbackState(null);
  const text = store.getItem(key);
  if (text === null || text === undefined) return fallbackState(null);
  let parsed;
  try { parsed = JSON.parse(text); } catch { return fallbackState("corrupt"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallbackState("corrupt");
  if (parsed.v !== LAYOUT_VERSION) return fallbackState("obsolete");
  const current = normalizeLayout(parsed.current);
  if (!current) return fallbackState("invalid");
  const named = {};
  if (parsed.named && typeof parsed.named === "object" && !Array.isArray(parsed.named)) {
    for (const [name, raw] of Object.entries(parsed.named).slice(0, MAX_NAMED_VIEWS)) {
      const clean = cleanViewName(name);
      const layout = clean && normalizeLayout(raw);
      if (layout) named[clean] = layout;
    }
  }
  let active = { kind: "custom" };
  const a = parsed.active;
  if (a?.kind === "preset" && PRESETS.some(p => p.id === a.id)) active = { kind: "preset", id: a.id };
  else if (a?.kind === "named" && named[a.name]) active = { kind: "named", name: a.name };
  return { current, active, named, fallback: null };
}

// Writes ONLY the whitelisted layout keys, view names and the active view.
export function serializeLayoutState(state) {
  const named = {};
  for (const [name, layout] of Object.entries(state.named || {}).slice(0, MAX_NAMED_VIEWS)) {
    const clean = cleanViewName(name);
    if (clean && layout) named[clean] = serializeLayout(layout);
  }
  const a = state.active || {};
  const active = a.kind === "preset" ? { kind: "preset", id: a.id }
    : a.kind === "named" && named[a.name] ? { kind: "named", name: a.name } : { kind: "custom" };
  return JSON.stringify({ v: LAYOUT_VERSION, active, current: serializeLayout(state.current), named });
}

export function saveLayoutState(userId, partyId, state, store = persist) {
  const key = layoutStorageKey(userId, partyId);
  if (!key) return false;
  return store.setItem(key, serializeLayoutState(state));
}
