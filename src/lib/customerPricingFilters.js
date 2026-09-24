// ═══════════════════════════════════════════════════════════════════════════
// src/lib/customerPricingFilters.js — Customer Pricing History P0.4 filters.
//
// Presentation only, like the layout engine: a filter narrows which canonical
// records a view SHOWS. It never edits, reorders or re-derives a record, and
// it never hides that it is active — `filtered.shown / filtered.total` travels
// with the view so summaries say "of the shown lines", not "of all lines".
// Filters are session state; they are not stored with saved layouts.
// ═══════════════════════════════════════════════════════════════════════════
import { negotiationSummary, orderedEvents, scopeDisplay } from "./customerPricingModel.js";

export const EMPTY_FILTERS = { status: "all", from: "", to: "", location: "", plant: "", text: "",
  negotiation: "all", bfGrade: "", sob: "all" };

export const NEGOTIATION_STATES = [
  { v: "all", l: "Any negotiation state" },
  { v: "none", l: "No rounds yet" },
  { v: "negotiating", l: "Negotiating (no agreement)" },
  { v: "agreed", l: "Agreed" },
];

// P0.4.1: SOB kind. "recorded" states are kept apart from each other so a
// percentage allocation is never confused with a box quantity.
export const SOB_FILTERS = [
  { v: "all", l: "Any SOB" },
  { v: "percentage", l: "SOB as a percentage" },
  { v: "allocated_quantity", l: "SOB as allocated boxes" },
  { v: "undefined", l: "SOB left undefined" },
  { v: "not_captured", l: "SOB not yet captured" },
  { v: "not_applicable", l: "SOB not applicable" },
];

export const filtersActive = f => Object.entries(EMPTY_FILTERS).some(([k, v]) => (f?.[k] ?? v) !== v);

// Line-level criteria cannot be met by a Cycle that has no line yet.
const lineLevel = f => f.location !== "" || f.plant !== "" || f.text !== "" || f.negotiation !== "all" || f.bfGrade !== ""
  || f.sob !== "all";

export function negotiationState(line) {
  const events = orderedEvents(line?.events);
  if (!events.length) return "none";
  return negotiationSummary(line.events).finalAgreed ? "agreed" : "negotiating";
}

export function recordMatches(rec, f, ctx) {
  const c = rec.cycle; const l = rec.line;
  if (f.status !== "all" && (c.status || "open") !== f.status) return false;
  // Period overlap with [from, to]; either bound may be open.
  if (f.from && c.period_end < f.from) return false;
  if (f.to && c.period_start > f.to) return false;
  if (!l) return !lineLevel(f);
  if (f.location !== "" && String(l.customer_location_id ?? "none") !== f.location) return false;
  if (f.plant !== "" && String(l.plant_id ?? "none") !== f.plant) return false;
  if (f.negotiation !== "all" && negotiationState(l) !== f.negotiation) return false;
  if (f.sob !== "all" && (l.sob_state || "not_captured") !== f.sob) return false;
  if (f.bfGrade !== "") {
    const agreed = negotiationSummary(l.events).finalAgreed;
    if (!(agreed?.bf_schedule || []).some(r => r.bf_code === f.bfGrade)) return false;
  }
  if (f.text !== "") {
    // A presentation search over what the row shows — never identity matching.
    const sku = ctx.skus.find(k => k.id === l.sku_id)?.plant_item_code || "";
    const hay = [scopeDisplay(l, ctx.lookups), sku, l.scope_text || "", l.notes || ""].join(" ").toLowerCase();
    if (!hay.includes(f.text.trim().toLowerCase())) return false;
  }
  return true;
}

export function applyFilters(view, filters) {
  const f = { ...EMPTY_FILTERS, ...(filters || {}) };
  const total = view.records.length;
  if (!filtersActive(f)) return { ...view, filtered: { active: false, shown: total, total } };
  const keep = new Set(view.records.filter(r => recordMatches(r, f, view.ctx)).map(r => r.key));
  const records = view.records.filter(r => keep.has(r.key));
  const recordGroups = view.recordGroups
    ? view.recordGroups.map(g => ({ ...g, records: g.records.filter(r => keep.has(r.key)) })).filter(g => g.records.length)
    : null;
  return { ...view, records, recordGroups, filtered: { active: true, shown: records.length, total } };
}

// The loaded change-log entries that belong to ONE line: the line itself, its
// rounds, its measures and its rounds' BF rows (found through their context).
export function changesForLine(changes, line) {
  const eventIds = new Set((line?.events || []).map(e => e.id));
  const measureIds = new Set((line?.measures || []).map(m => m.id));
  return (changes || []).filter(c =>
    (c.entity_type === "line" && c.entity_id === line.id)
    || (c.entity_type === "negotiation_event" && eventIds.has(c.entity_id))
    || (c.entity_type === "line_measure" && measureIds.has(c.entity_id))
    || c.context?.line_id === line.id
    || (c.context?.event_id != null && eventIds.has(c.context.event_id)));
}

// Choice lists come from what this Customer's records actually hold.
export function filterOptions(data, ctx) {
  const lines = (data?.cycles || []).flatMap(c => c.lines || []);
  const uniq = (xs, key) => [...new Map(xs.map(x => [key(x), x])).values()];
  const locs = uniq(lines.map(l => l.customer_location_id ?? null), x => x ?? "none");
  const plants = uniq(lines.map(l => l.plant_id ?? null), x => x ?? "none");
  const grades = [...new Set(lines.flatMap(l => negotiationSummary(l.events).finalAgreed?.bf_schedule || [])
    .map(r => r.bf_code))].sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || (a < b ? -1 : 1));
  return {
    locations: locs.map(id => ({ v: String(id ?? "none"), l: id == null ? "Any location (whole Customer)"
      : ctx.lookups.locations.find(x => x.id === id)?.location_code || `Location #${id}` })),
    plants: plants.map(id => ({ v: String(id ?? "none"), l: id == null ? "Any plant"
      : ctx.lookups.plants.find(x => x.id === id)?.plant_code || `Plant #${id}` })),
    bfGrades: grades.map(g => ({ v: g, l: `BF ${g}` })),
  };
}
