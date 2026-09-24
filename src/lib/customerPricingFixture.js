// ═══════════════════════════════════════════════════════════════════════════
// src/lib/customerPricingFixture.js — FIXTURE ONLY Customer Pricing History.
//
// A development-only, in-memory payload shaped like GET
// /masters/parties/<id>/pricing-history (P0.1 + P0.2) so the P0.3 layout
// engine can be seen without the unapplied pricing migrations. Every label
// carries __P03_FIXTURE_ONLY__. It proves presentation only — never database
// persistence, authorization or concurrency. Also used by the pure-model
// fixtures (scripts/customer-pricing-fixtures.mjs).
// ═══════════════════════════════════════════════════════════════════════════
import { paiseToString, toSignedPaise } from "./customerPricingModel.js";

const TAG = "__P03_FIXTURE_ONLY__";

export const P03_FIXTURE_PARTY = { id: 9501, display_name: `${TAG} Snacks Customer`, lifecycle_state: "customer" };
export const P03_FIXTURE_PROFILE = { id: "p03-fixture-user", display_name: "P0.3 Fixture User",
  email: "p03@fixture.invalid", active: true, role: "maker", group_capabilities: [],
  plant_capabilities: { NAG: ["read_party_master"] } };

const bfRow = (code, base, delta, override = null) => {
  const derived = delta === null ? base : paiseToString(toSignedPaise(base) + toSignedPaise(delta));
  return { bf_code: code, is_base: delta === null, delta_inr: delta, derived_rate_inr: derived,
    override_rate_inr: override, is_override: override !== null, effective_rate_inr: override ?? derived };
};

const ev = (id, seq, type, date, rate, extra = {}) => ({ id, sequence_no: seq, event_type: type, event_date: date,
  rate_inr: rate, tax_treatment: "excluding_gst", gst_pct: null, status: "active", content_version: 1,
  rate_basis: "kraft_paper_per_kg", weight_basis: "paper_consumed", base_bf_code: null, bf_schedule: [],
  components_recorded: [], component_kraft_inr: null, component_conversion_inr: null, component_freight_inr: null,
  component_total_inr: null, reconciliation_diff_inr: null, source_type: "email", source_date: date,
  source_ref: `${TAG} thread`, notes: "", ...extra });

const agreed = (id, seq, date, rate, bf, extra = {}) => ev(id, seq, "final_agreement", date, rate, {
  base_bf_code: "18", bf_schedule: bf, components_recorded: ["kraft", "conversion", "freight"], ...extra });

export const P03_FIXTURE_DATA = {
  mechanism: { id: 1, review_frequency: "monthly", period_label_style: "financial_year",
    rate_basis: "kraft_paper_per_kg", weight_basis: "paper_consumed", tax_treatment: "excluding_gst",
    notes: `${TAG} base BF 18 with agreed deltas`, content_version: 3 },
  locations: [{ id: 11, location_code: "FIX-PUNE" }, { id: 12, location_code: "FIX-KOLKATA" }],
  plants: [{ id: 7, plant_code: "NAG", name: "Nagpur" }, { id: 8, plant_code: "PUN", name: "Pune" }],
  skus: [{ id: 9101, plant_id: 7, plant_item_code: "FIX/NAG/0001" }],
  term_versions: [
    { id: 52, version_no: 1, content_version: 1, status: "active", customer_location_id: null, plant_id: null,
      effective_from: "2026-04-01", effective_to: null, rate_basis: "kraft_paper_per_kg", weight_basis: "paper_consumed",
      wastage_treatment: "added_pct", wastage_pct: "3.00", freight_treatment: "delivered_included",
      conversion_inr_per_kg: "8.00", freight_inr_per_kg: "1.25" },
    { id: 53, version_no: 1, content_version: 2, status: "active", customer_location_id: null, plant_id: 8,
      effective_from: "2026-04-01", effective_to: null, rate_basis: "kraft_paper_per_kg", weight_basis: "paper_consumed",
      wastage_treatment: "added_pct", wastage_pct: "3.00", freight_treatment: "delivered_included",
      conversion_inr_per_kg: "8.50", freight_inr_per_kg: "0.00" },
  ],
  bf_delta_sets: [
    { id: 61, version_no: 1, content_version: 1, status: "active", customer_location_id: null, plant_id: null,
      effective_from: "2026-04-01", effective_to: null, base_bf_code: "18",
      deltas: [{ bf_code: "16", delta_inr: "-1.00" }, { bf_code: "20", delta_inr: "1.50" }, { bf_code: "22", delta_inr: "3.25" }] },
  ],
  cycles: [
    { id: 6, review_frequency: "monthly", period_start: "2026-10-01", period_end: "2026-10-31", initiated_on: "2026-09-24",
      custom_label: "", status: "open", notes: "", content_version: 1, lines: [] },
    { id: 5, review_frequency: "monthly", period_start: "2026-09-01", period_end: "2026-09-30", initiated_on: "2026-08-22",
      custom_label: "", status: "open", notes: `${TAG} Kraft revised`, content_version: 2, lines: [
        { id: 31, cycle_id: 5, customer_location_id: 11, plant_id: 7, sku_id: null, scope_text: "", notes: "",
          sob_state: "percentage", sob_pct: "60.00", term_version_id: 52, bf_delta_set_id: 61, prior_line_id: 21,
          content_version: 4,
          measures: [
            { id: 701, line_id: 31, measure: "paper_consumed_kg", source: "customer_confirmed", value: "0.4600",
              status: "active", content_version: 2 },
            { id: 702, line_id: 31, measure: "paper_consumed_kg", source: "costing_snapshot", value: "0.4520",
              status: "active", content_version: 1 },
            { id: 703, line_id: 31, measure: "sheet_weight_kg", source: "manual", value: "0.4200", status: "active",
              content_version: 1 },
            { id: 704, line_id: 31, measure: "area_sqm", source: "manual", value: "0.8000", status: "withdrawn",
              content_version: 3 }],
          events: [
            ev(301, 1, "avadhoot_offer", "2026-08-25", "56.00"),
            ev(306, 5, "customer_counter", "2026-08-26", "52.00", { status: "voided", content_version: 2,
              void_reason: "entered against the wrong line", notes: `${TAG} counter noted from a call` }),
            ev(302, 2, "customer_counter", "2026-08-27", "53.50", { content_version: 2 }),
            ev(303, 3, "avadhoot_offer", "2026-08-28", "55.00", { base_bf_code: "18",
              bf_schedule: [bfRow("18", "55.00", null), bfRow("24", "55.00", "4.50")] }),
            agreed(304, 4, "2026-08-30", "54.25", [bfRow("16", "54.25", "-1.00"), bfRow("18", "54.25", null),
              bfRow("20", "54.25", "1.50"), bfRow("22", "54.25", "3.25", "57.00")],
            { component_kraft_inr: "45.00", component_conversion_inr: "8.00", component_freight_inr: "1.25",
              component_total_inr: "54.25", reconciliation_diff_inr: "0.00" }),
          ] },
        { id: 32, cycle_id: 5, customer_location_id: 12, plant_id: 8, sku_id: null, scope_text: "", notes: "",
          sob_state: "percentage", sob_pct: "0.00", term_version_id: 53, bf_delta_set_id: 61, prior_line_id: 22,
          content_version: 1,
          measures: [{ id: 711, line_id: 32, measure: "paper_consumed_kg", source: "costing_snapshot", value: "0.4520",
            status: "active", content_version: 1 }],
          events: [
            ev(311, 1, "avadhoot_offer", "2026-08-25", "56.50"),
            agreed(312, 2, "2026-08-29", "54.25", [bfRow("16", "54.25", "-1.00"), bfRow("18", "54.25", null),
              bfRow("20", "54.25", "1.50"), bfRow("22", "54.25", "3.25")],
            { component_kraft_inr: "45.75", component_conversion_inr: "8.50", component_freight_inr: "0.00",
              component_total_inr: "54.25", reconciliation_diff_inr: "0.00" }),
          ] },
        { id: 33, cycle_id: 5, customer_location_id: 11, plant_id: 7, sku_id: 9101, scope_text: "Trays", notes: "",
          sob_state: "undefined", sob_pct: null, term_version_id: 52, bf_delta_set_id: null, prior_line_id: null,
          content_version: 2, measures: [], events: [] },
      ] },
    { id: 4, review_frequency: "monthly", period_start: "2026-08-01", period_end: "2026-08-31", initiated_on: "2026-07-24",
      custom_label: "", status: "closed", notes: "", content_version: 3, lines: [
        { id: 21, cycle_id: 4, customer_location_id: 11, plant_id: 7, sku_id: null, scope_text: "", notes: "",
          sob_state: "percentage", sob_pct: "55.00", term_version_id: 52, bf_delta_set_id: 61, prior_line_id: null,
          content_version: 2, measures: [],
          events: [
            ev(201, 1, "avadhoot_offer", "2026-07-25", "55.00"),
            agreed(202, 2, "2026-07-30", "53.75", [bfRow("16", "53.75", "-1.00"), bfRow("18", "53.75", null),
              bfRow("20", "53.75", "1.50"), bfRow("22", "53.75", "3.25")]),
          ] },
        { id: 22, cycle_id: 4, customer_location_id: 12, plant_id: 8, sku_id: null, scope_text: "", notes: "",
          // P0.4.1: SOB as a fixed box allocation for the (August) Cycle.
          sob_state: "allocated_quantity", sob_pct: null, sob_allocated_boxes: "25000", term_version_id: 53,
          bf_delta_set_id: 61, prior_line_id: null, content_version: 1, measures: [],
          events: [agreed(211, 1, "2026-07-29", "54.00", [bfRow("16", "54.00", "-1.00"), bfRow("18", "54.00", null),
            bfRow("20", "54.00", "1.50"), bfRow("22", "54.00", "3.25")])] },
      ] },
  ],
  cycles_truncated: false,
  cycle_limit: 60,
};

// Change-log page shaped like GET /masters/parties/<id>/pricing-history/changes.
export const P03_FIXTURE_CHANGES = {
  has_more: true, next_before_id: 9001, actor_names_partial: true, limit: 50,
  changes: [
    { id: 9005, entity_type: "line", entity_id: 22, operation: "update", content_version: 1,
      occurred_at: "2026-07-29T11:00:00Z", actor_app_user_id: 44, actor_name: `${TAG} Pricing Lead`,
      context: { cycle_id: 4 }, fields: [
        { field: "sob_allocated_boxes", before: null, after: "25000" },
        { field: "sob_state", before: "not_captured", after: "allocated_quantity" }] },
    { id: 9004, entity_type: "negotiation_event", entity_id: 306, operation: "update", content_version: 2,
      occurred_at: "2026-08-27T10:05:00Z", actor_app_user_id: 44, actor_name: `${TAG} Pricing Lead`,
      context: { line_id: 31 }, fields: [{ field: "status", before: "active", after: "voided" },
        { field: "void_reason", before: null, after: "entered against the wrong line" }] },
    { id: 9003, entity_type: "negotiation_event", entity_id: 302, operation: "update", content_version: 2,
      occurred_at: "2026-08-27T09:40:00Z", actor_app_user_id: 45, actor_name: null,
      context: { line_id: 31 }, fields: [{ field: "rate_inr", before: "53.00", after: "53.50" }] },
    { id: 9002, entity_type: "line", entity_id: 31, operation: "update", content_version: 4,
      occurred_at: "2026-08-30T12:00:00Z", actor_app_user_id: 44, actor_name: `${TAG} Pricing Lead`,
      context: { cycle_id: 5 }, fields: [{ field: "sob_pct", before: "55.00", after: "60.00" }] },
  ],
};
