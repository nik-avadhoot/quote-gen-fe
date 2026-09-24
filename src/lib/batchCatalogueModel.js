export const BATCH_ACTION_NAMES = ["calculate", "send", "submit", "approve", "return", "issue"];

export function batchActionsFromBackend(reported = {}, fallbackReason = "backend_did_not_report_available") {
  return Object.fromEntries(BATCH_ACTION_NAMES.map(name => {
    const state = reported?.[name];
    return [name, state?.enabled === true
      ? { enabled: true, reason: "available" }
      : { enabled: false, reason: state?.reason || fallbackReason }];
  }));
}

const BLOCKED_BATCH_ACTIONS = batchActionsFromBackend({}, "fixture_only");

export const U4_BATCH_CATALOGUE_ILLUSTRATION = Object.freeze({
  display_limit: 50,
  results_limited: false,
  filter_scope: "displayed_newest_first",
  details_partial: true,
  partial_sections: [],
  denied_sections: ["owner_identities"],
  actions: BLOCKED_BATCH_ACTIONS,
  rows: [{
    id: "fixture-batch-9402",
    batch_reference: "__U4_FIXTURE_ONLY__/NAG/BAT/009402",
    family_id: "fixture-family-9402",
    plant_id: "fixture-plant-nag",
    owner_user_id: "fixture-maker-2",
    sector_id: "fixture-sector-fmcg",
    status: "submitted",
    content_version: 6,
    pricing_date: "2026-09-13",
    pricing_basis_release_id: "fixture-release-12",
    pricing_basis_is_deliberate: true,
    created_at: "2026-09-13T08:30:00Z",
    customer_family: { id: "fixture-family-9402", group_customer_code: "FIX-FAM-9402",
      name: "__U4_FIXTURE_ONLY__ Retail Family", status: "active" },
    plant: { id: "fixture-plant-nag", plant_code: "NAG", name: "Nagpur", status: "active" },
    sector: { id: "fixture-sector-fmcg", sector_code: "FMCG", name: "FMCG", status: "active" },
    pricing_basis_release: { id: "fixture-release-12", plant_id: "fixture-plant-nag",
      release_name: "__U4_FIXTURE_ONLY__ NAG September", status: "approved",
      effective_from: "2026-09-01", effective_until: "2026-09-30", is_automatic_default: false },
    owner: null,
    details_partial: true,
  }, {
    id: "fixture-batch-9401",
    batch_reference: "__U4_FIXTURE_ONLY__/PUN/BAT/009401",
    family_id: "fixture-family-9401",
    plant_id: "fixture-plant-pun",
    owner_user_id: "fixture-maker-1",
    sector_id: "fixture-sector-food",
    status: "working",
    content_version: 3,
    pricing_date: "2026-09-12",
    pricing_basis_release_id: "fixture-release-9",
    pricing_basis_is_deliberate: false,
    created_at: "2026-09-12T07:15:00Z",
    customer_family: { id: "fixture-family-9401", group_customer_code: "FIX-FAM-9401",
      name: "__U4_FIXTURE_ONLY__ Foods Family", status: "active" },
    plant: { id: "fixture-plant-pun", plant_code: "PUN", name: "Pune", status: "active" },
    sector: { id: "fixture-sector-food", sector_code: "FOOD", name: "Food", status: "active" },
    pricing_basis_release: { id: "fixture-release-9", plant_id: "fixture-plant-pun",
      release_name: "__U4_FIXTURE_ONLY__ PUN September", status: "approved",
      effective_from: "2026-09-01", effective_until: null, is_automatic_default: true },
    owner: { id: "fixture-maker-1", display_name: "Fixture Maker", status: "active" },
    details_partial: false,
  }, {
    id: "fixture-batch-9400",
    batch_reference: "__U4_FIXTURE_ONLY__/NAG/BAT/009400",
    family_id: "fixture-family-9402", plant_id: "fixture-plant-nag",
    owner_user_id: "fixture-maker-2", sector_id: "fixture-sector-fmcg",
    status: "issued_locked", content_version: 9, pricing_date: "2026-09-10",
    pricing_basis_release_id: "fixture-release-12", pricing_basis_is_deliberate: true,
    created_at: "2026-09-10T08:30:00Z",
    customer_family: { id: "fixture-family-9402", group_customer_code: "FIX-FAM-9402",
      name: "__U4_FIXTURE_ONLY__ Retail Family", status: "active" },
    plant: { id: "fixture-plant-nag", plant_code: "NAG", name: "Nagpur", status: "active" },
    sector: { id: "fixture-sector-fmcg", sector_code: "FMCG", name: "FMCG", status: "active" },
    pricing_basis_release: { id: "fixture-release-12", release_name: "__U4_FIXTURE_ONLY__ NAG September",
      status: "approved" },
    owner: null, details_partial: true,
  }],
});

export function searchableBatchText(row) {
  return [
    row.id, row.batch_reference, row.status, row.content_version, row.pricing_date,
    row.customer_family?.id, row.customer_family?.group_customer_code, row.customer_family?.name,
    row.plant?.id, row.plant?.plant_code, row.plant?.name,
    row.sector?.id, row.sector?.sector_code, row.sector?.name,
    row.pricing_basis_release_id, row.pricing_basis_release?.release_name,
    row.owner_user_id, row.owner?.display_name,
  ].filter(value => value !== null && value !== undefined).join(" ").toLocaleLowerCase();
}
