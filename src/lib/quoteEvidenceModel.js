export const U5_QUOTE_ILLUSTRATION = {
  id: "fixture-family-9301",
  batch_id: "fixture-batch-9301",
  quote_reference: "__U5_FIXTURE_ONLY__/Q/9301",
  status: "active",
  created_at: "2026-09-10T09:30:00Z",
  created_by_actor: { id: "fixture-maker", display_name: "Fixture Maker", status: "active" },
  details_partial: false,
  partial_sections: [],
  denied_sections: [],
  batch: {
    id: "fixture-batch-9301", batch_reference: "__U5_FIXTURE_ONLY__/BAT/9301",
    status: "sent", pricing_date: "2026-09-10", pricing_basis_release_id: "fixture-release-9301",
    pricing_basis_is_deliberate: true,
    plant: { id: "fixture-plant", plant_code: "NAG", name: "Nagpur" },
    customer_family: { id: "fixture-family", group_customer_code: "__U5_FIXTURE_ONLY__", name: "Fixture Customer Family" },
  },
  actions: Object.fromEntries([
    "calculate", "send", "submit", "approve", "return", "withdraw", "issue",
    "create_revision", "amend", "reprice",
  ].map(name => [name, { enabled: false, reason: "backend_activation_pending" }])),
  revisions: [
    {
      id: "fixture-revision-1", revision_no: 1, source_revision_id: null,
      workflow_status: "approved", standing: "superseded", quote_date: "2026-09-10",
      offer_validity_to: "2026-10-10", created_at: "2026-09-10T09:30:00Z",
      created_by_actor: { display_name: "Fixture Maker" },
      approved_at: "2026-09-10T11:00:00Z", approved_by_actor: { display_name: "Fixture Checker" },
      issued_at: null, issued_by_actor: null, return_note: null,
      workflow_events: [
        { id: "f-e1", event_type: "submitted", occurred_at: "2026-09-10T10:00:00Z", actor: { display_name: "Fixture Maker" } },
        { id: "f-e2", event_type: "approved", occurred_at: "2026-09-10T11:00:00Z", actor: { display_name: "Fixture Checker" } },
        { id: "f-e3", event_type: "superseded", occurred_at: "2026-09-11T11:30:00Z", actor: { display_name: "Fixture Checker" } },
      ],
      customer_outcomes: [{ id: "f-o1", outcome: "awaiting_response", occurred_at: "2026-09-10T11:05:00Z", recorded_by_actor: { display_name: "Fixture Maker" } }],
      items: [{
        id: "fixture-item-1", batch_row_lineage_id: "fixture-lineage-1", pricing_group_id: "fixture-pricing-group-1",
        calculation_snapshot_id: "fixture-snapshot-1",
        delivery_groups: [{ id: "fixture-link-1", delivery_group_id: "fixture-delivery-1" }],
        calculation_snapshot: {
          id: "fixture-snapshot-1", schema_version: 1,
          engine_version: "engine/qe1-7c2ceac1972460ba", rounding_rule_version: "qe1-rounding-v1",
          pricing_basis_release_id: "fixture-release-9301", calculation_default_version_id: "fixture-default-7",
          pricing_date: "2026-09-10", effective_waste_pct: 5, waste_source: "batch",
          effective_conv_rate: 7, conv_source: "batch", effective_margin_pct: 8, margin_source: "sector",
          effective_interest_pct: 0.5, interest_source: "derived_annual",
          effective_freight: 0, freight_source: "master", freight_authority: "governed",
          freight_set_version_id: "fixture-freight-3", freight_entry_id: "fixture-entry-zero",
          total_cost: 38.4, final_rate: 42.2, rate_per_kg: 42.2, calc_moq: 1000,
          calculation_fingerprint: "fixture-calc-fingerprint-r1",
          presentation_fingerprint: "fixture-presentation-fingerprint-r1",
          calculated_at: "2026-09-10T09:55:00Z", calculated_by_actor: { display_name: "Fixture Maker" },
          effective_inputs: { material_rate: 31.25, material_rate_source: "governed_effective_material_rate", customer_payment_interest_pct: 0.5 },
          results: { final_rate: 42.2, rate_per_kg: 42.2, specification: { bs: { status: "pass", actual: 8.4, target: 8 } } },
        },
      }],
    },
    {
      id: "fixture-revision-2", revision_no: 2, source_revision_id: "fixture-revision-1",
      workflow_status: "issued", standing: "current", quote_date: "2026-09-11",
      offer_validity_to: "2026-10-11", addressee_name: "Fixture Buying Team",
      addressee_details: { line_1: "Fixture registered office", city: "Nagpur" },
      created_at: "2026-09-11T09:15:00Z",
      created_by_actor: { display_name: "Fixture Maker" },
      approved_at: "2026-09-11T11:30:00Z", approved_by_actor: { display_name: "Fixture Checker" },
      issued_at: "2026-09-11T12:00:00Z", issued_by_actor: { display_name: "Fixture Maker" },
      return_note: "Revision followed a separate return and adoption path.",
      workflow_events: [
        { id: "f-e4", event_type: "returned", occurred_at: "2026-09-11T09:45:00Z", actor: { display_name: "Fixture Checker" }, note: "Clarify delivery basis" },
        { id: "f-e5", event_type: "submitted", occurred_at: "2026-09-11T11:00:00Z", actor: { display_name: "Fixture Maker" } },
        { id: "f-e6", event_type: "approved", occurred_at: "2026-09-11T11:30:00Z", actor: { display_name: "Fixture Checker" } },
        { id: "f-e7", event_type: "issued", occurred_at: "2026-09-11T12:00:00Z", actor: { display_name: "Fixture Maker" } },
      ],
      customer_outcomes: [
        { id: "f-o2", outcome: "awaiting_response", occurred_at: "2026-09-11T12:00:00Z", recorded_by_actor: { display_name: "Fixture Maker" } },
        { id: "f-o3", outcome: "accepted", acceptance_date: "2026-09-14", acceptance_reference: "FIXTURE-PO-9301",
          note: "Fixture acceptance evidence.", occurred_at: "2026-09-14T08:30:00Z", recorded_by_actor: { display_name: "Fixture Maker" } },
      ],
      items: [{
        id: "fixture-item-2", batch_row_lineage_id: "fixture-lineage-1", pricing_group_id: "fixture-pricing-group-1",
        calculation_snapshot_id: "fixture-snapshot-2",
        delivery_groups: [{ id: "fixture-link-2", delivery_group_id: "fixture-delivery-1" }],
        calculation_snapshot: {
          id: "fixture-snapshot-2", schema_version: 1,
          engine_version: "engine/qe1-7c2ceac1972460ba", rounding_rule_version: "qe1-rounding-v1",
          pricing_basis_release_id: "fixture-release-9301", calculation_default_version_id: "fixture-default-7",
          pricing_date: "2026-09-11", effective_waste_pct: 5, waste_source: "batch",
          effective_conv_rate: 7, conv_source: "batch", effective_margin_pct: 8, margin_source: "sector",
          effective_interest_pct: 0.5, interest_source: "derived_annual",
          effective_freight: 0, freight_source: "master", freight_authority: "governed",
          freight_set_version_id: "fixture-freight-3", freight_entry_id: "fixture-entry-zero",
          total_cost: 39.1, final_rate: 43.1, rate_per_kg: 43.1, calc_moq: 1000,
          calculation_fingerprint: "fixture-calc-fingerprint-r2",
          presentation_fingerprint: "fixture-presentation-fingerprint-r2",
          calculated_at: "2026-09-11T10:55:00Z", calculated_by_actor: { display_name: "Fixture Maker" },
          effective_inputs: { material_rate: 32, material_rate_source: "governed_effective_material_rate", customer_payment_interest_pct: 0.5 },
          results: { final_rate: 43.1, rate_per_kg: 43.1, specification: { bs: { status: "pass", actual: 8.4, target: 8 } } },
        },
      }],
    },
  ],
};

export const U5_SUBMITTED_QUOTE_ILLUSTRATION = {
  ...U5_QUOTE_ILLUSTRATION,
  id: "fixture-family-submitted-9301",
  quote_reference: null,
  batch_id: "fixture-batch-submitted-9301",
  batch: {
    ...U5_QUOTE_ILLUSTRATION.batch,
    id: "fixture-batch-submitted-9301",
    batch_reference: "__U5_FIXTURE_ONLY__/BAT/SUBMITTED-9301",
  },
  revisions: [{
    ...U5_QUOTE_ILLUSTRATION.revisions[1],
    id: "fixture-revision-submitted-9301",
    family_id: "fixture-family-submitted-9301",
    revision_no: null,
    source_revision_id: null,
    workflow_status: "submitted",
    standing: null,
    addressee_name: null,
    addressee_details: null,
    approved_at: null,
    approved_by_actor: null,
    issued_at: null,
    issued_by_actor: null,
    return_note: null,
    created_at: "2026-09-13T08:00:00Z",
    workflow_events: [{
      id: "f-e-submitted", event_type: "submitted",
      occurred_at: "2026-09-13T08:15:00Z", actor: { display_name: "Fixture Maker" },
    }],
    customer_outcomes: [],
  }],
};

const FIXTURE_CATALOGUE_ACTIONS = Object.fromEntries([
  "approve", "return", "withdraw", "issue", "create_revision",
].map(name => [name, { enabled: false, reason: "backend_activation_pending" }]));

export const U5_QUOTE_CATALOGUE_ILLUSTRATIONS = {
  inbox: {
    view: "inbox", display_limit: 50, results_limited: false,
    details_partial: false, partial_sections: [], denied_sections: [],
    actions: FIXTURE_CATALOGUE_ACTIONS,
    rows: [{
      id: "fixture-revision-submitted-9301",
      quote_family_id: "fixture-family-submitted-9301",
      quote_reference: null,
      revision_no: null,
      workflow_status: "submitted",
      standing: null,
      quote_date: "2026-09-13",
      created_at: "2026-09-13T08:00:00Z",
      created_by_actor: { display_name: "Fixture Maker" },
      batch_reference: "__U5_FIXTURE_ONLY__/BAT/SUBMITTED-9301",
      batch_status: "sent",
      plant: { plant_code: "NAG", name: "Nagpur" },
      customer_family: { group_customer_code: "__U5_FIXTURE_ONLY__", name: "Fixture Customer Family" },
      item_count: 1,
    }],
  },
  history: {
    view: "history", display_limit: 50, results_limited: false,
    details_partial: false, partial_sections: [], denied_sections: [],
    actions: FIXTURE_CATALOGUE_ACTIONS,
    rows: [...U5_QUOTE_ILLUSTRATION.revisions].reverse().map(revision => ({
      id: revision.id,
      quote_family_id: U5_QUOTE_ILLUSTRATION.id,
      quote_reference: U5_QUOTE_ILLUSTRATION.quote_reference,
      revision_no: revision.revision_no,
      workflow_status: revision.workflow_status,
      standing: revision.standing,
      quote_date: revision.quote_date,
      created_at: revision.created_at,
      created_by_actor: revision.created_by_actor,
      approved_at: revision.approved_at,
      approved_by_actor: revision.approved_by_actor,
      issued_at: revision.issued_at,
      issued_by_actor: revision.issued_by_actor,
      batch_reference: U5_QUOTE_ILLUSTRATION.batch.batch_reference,
      batch_status: U5_QUOTE_ILLUSTRATION.batch.status,
      plant: U5_QUOTE_ILLUSTRATION.batch.plant,
      customer_family: U5_QUOTE_ILLUSTRATION.batch.customer_family,
      item_count: revision.items.length,
    })),
  },
};

export function orderedQuoteRevisions(revisions = []) {
  return [...revisions].sort((a, b) => {
    const ar = a.revision_no ?? Number.MAX_SAFE_INTEGER;
    const br = b.revision_no ?? Number.MAX_SAFE_INTEGER;
    return br - ar || String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });
}

export function quoteRevisionLabel(revision) {
  return revision?.revision_no == null ? "Unnumbered draft" : `Revision ${revision.revision_no}`;
}

export function quoteActor(actor, fallbackId) {
  return actor?.display_name || (fallbackId == null ? "Not recorded" : `User #${fallbackId}`);
}
