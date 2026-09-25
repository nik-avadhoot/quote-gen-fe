// Development-only browser evidence for the S1 active-Batch layout. The query
// flag is ignored by production builds. These objects never reach an API and
// the state hooks skip local persistence while the fixture is active.
export function isS1ActiveBrowserFixture() {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  const query = new URLSearchParams(window.location.search);
  return query.get("activeBatch") === "1" && query.get("fixture")?.startsWith("s1-");
}

export function isS3GovernedBrowserFixture() {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  const query = new URLSearchParams(window.location.search);
  return query.get("activeBatch") === "1" && query.get("fixture") === "s1-maker"
    && query.get("s3") === "1";
}

export const S1_ACTIVE_BATCH = {
  id: "s1-batch-1842",
  batch_reference: "NAG/BAT/2026-27/01842",
  content_version: 4,
  customer_family: { id: "s1-family", group_customer_code: "ACME", name: "Acme Foods" },
  plant: { id: "s1-plant", plant_code: "NAG", name: "Nagpur" },
  pricing_groups: [],
  caller_holds_lock: false,
};

export const S1_ACTIVE_PROFILE = {
  client: "Acme Foods", sector: "FMCG-FOOD", plant: "Nagpur", delivery: "Nagpur",
  paymentDisc: "30", freightOverride: "", margin: 8, interest: 0.5,
};

export const S1_ACTIVE_CONSTRUCTION = {
  code: "S1-5P",
  ply: 5,
  boxType: "RSC",
  flute_F1: "B",
  flute_F2: "A",
  board_gsm: 750,
  spec_bs: 12,
  spec_bct: "",
  spec_ect: "",
  layers: {
    TOP: { code: "22", gsm: 180 },
    F1: { code: "18", gsm: 120 },
    L1: { code: "20", gsm: 150 },
    F2: { code: "18", gsm: 120 },
    L2: { code: "22", gsm: 180 },
  },
};

export const S1_ACTIVE_ROWS = Array.from({ length: 6 }, (_, index) => ({
  id: `s1-row-${index + 1}`,
  matCode: `ACME-${String(index + 1).padStart(3, "0")}`,
  product: `Customer SKU ${index + 1}`,
  itemType: "Box", setCode: `ACME-${String(index + 1).padStart(3, "0")}`,
  setCodeAssumed: false, constructionCode: "S1-5P", setAutoFill: true,
  L: 400, W: 300, H: 250, ups: 1, printing_technology: "", number_of_colours: "",
  boxType: "RSC", spec_bs: "", spec_bct: "", nosPerSet: 1,
  salesMOQ: "", volume: "", marginOverride: "", remarks: "",
  reviewed: false, autoCode: false, status: "incomplete",
}));

const S3_GROUP = {
  id: "s3-group-81", batch_id: "s3-batch-1842", label: "Main delivery",
  freight_mode: "manual", freight_basis_delivery_group_id: null, freight_manual_value: 2.75,
  payment_terms_days: 30, payment_terms_text: "30 days", interest_override_pct: null,
  status: "active", content_version: 2,
  delivery_groups: [{ id: "s3-route-91", pricing_group_id: "s3-group-81",
    batch_id: "s3-batch-1842", label: "Nagpur delivery", bill_to_location_id: "s3-loc-1",
    ship_to_location_id: "s3-loc-2", status: "active",
    bill_to_location: { id: "s3-loc-1", location_code: "ACME-BILL", status: "active" },
    ship_to_location: { id: "s3-loc-2", location_code: "ACME-NAG", status: "active" } }],
};

const s3Row = (id, code, item, version, construction) => ({
  id, lineage_id: `lineage-${id}`, batch_id: "s3-batch-1842", plant_id: "s1-plant",
  pricing_group_id: S3_GROUP.id, sku_id: `sku-${id}`, sku_version_id: `sku-version-${id}`,
  proposed_construction_version_id: null, material_code: code, row_type: "box",
  waste_override_pct: null, margin_override_pct: null, conv_override_rate: null,
  freight_override: null, sales_moq: 1000, volume: 5000, status: "active",
  content_version: version, addon_printing: null, addon_stitching: null,
  addon_coating: null, addon_handling: null, addon_moq_charge: null,
  addon_packing: null, addon_other: null, addon_unloading: null, fluting_bcf: null,
  customer: { id: "s3-party-501", customer_code: "ACME", display_name: "Acme Foods" },
  sku: { id: `sku-${id}`, party_id: "s3-party-501", plant_item_code: code, status: "active" },
  sku_version: { id: `sku-version-${id}`, version_no: version, length_mm: 400,
    width_mm: 300, height_mm: 250, box_type: "RSC", ups: 1, item_name: item },
  effective_construction: { version_id: `construction-version-${id}`, origin: "sku_version",
    details_partial: false, version: { id: `construction-version-${id}`, board_gsm: 750 },
    construction: { id: `construction-${id}`, construction_code: construction,
      name: "5 ply B/A", status: "published" } },
});

export const S3_GOVERNED_BATCH = {
  id: "s3-batch-1842", batch_reference: "NAG/BAT/2026-27/01842", content_version: 14,
  family_id: "s1-family", customer_party_id: "s3-party-501", plant_id: "s1-plant",
  owner_user_id: "s1-maker", sector_id: "s3-sector", status: "working",
  pricing_date: "2026-09-24", pricing_basis_release_id: "s3-release-11",
  pricing_basis_is_deliberate: false, caller_id: "s1-maker", caller_holds_lock: true,
  family: { id: "s1-family", group_customer_code: "ACME", name: "Acme Foods", status: "active" },
  customer_party: { id: "s3-party-501", customer_code: "ACME", display_name: "Acme Foods",
    lifecycle_state: "customer", status: "active" },
  plant: { id: "s1-plant", plant_code: "NAG", name: "Nagpur", status: "active" },
  owner: { id: "s1-maker", display_name: "S1 Maker", status: "active" },
  sector: { id: "s3-sector", sector_code: "FMCG-FOOD", name: "FMCG Food", status: "active" },
  pricing_basis_release: { id: "s3-release-11", release_name: "Nagpur September 2026",
    name: "Nagpur September 2026", status: "approved" },
  current_profile: { id: "s3-profile", version_no: 3, conv_box_rate: 7,
    waste_cbb_pct: 5, margin_box_pct: 8, conv_pp_rate: 12.5, waste_pp_pct: 5,
    margin_pp_pct: 8 },
  edit_lock: { id: "s3-lock", holder_user_id: "s1-maker", heartbeat_at: "2026-09-24T10:00:00+05:30",
    holder: { id: "s1-maker", display_name: "S1 Maker", status: "active" } },
  collaborators: [], family_sectors: [], pricing_groups: [S3_GROUP],
  batch_rows: [s3Row("s3-row-351", "ACME-001", "Pizza box", 3, "S1-5P"),
    s3Row("s3-row-352", "ACME-002", "Display carton", 2, "S1-5P")],
  batch_sets: [], available_skus: [], available_constructions: [], details_partial: false,
  fixture_readiness: {
    batch_id: "s3-batch-1842", batch_content_version: 14, mutation: "none",
    evaluated_at: "2026-09-24T10:05:00+05:30", can_calculate: true, can_send: false,
    rows: [
      { row_id: "s3-row-351", pricing_group_id: "s3-group-81", status: "ready", freshness: "fresh" },
      { row_id: "s3-row-352", pricing_group_id: "s3-group-81", status: "ready", freshness: "not_calculated" },
    ],
    blockers: [{ scope: "row", code: "not_calculated", field: "calculation",
      row_id: "s3-row-352", pricing_group_id: "s3-group-81", blocks: ["send"],
      message: "Not calculated yet. Recalculate before Send." }],
  },
};
