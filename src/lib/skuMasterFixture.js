// ═══════════════════════════════════════════════════════════════════════════
// src/lib/skuMasterFixture.js — FIXTURE ONLY SKU Master responses.
//
// Shaped exactly like the governed `/masters/skus` routes so the development
// preview exercises the real rendering paths: blank versus zero, a proposed
// SKU with no Plant Item Code, replacement lineage, a Construction version
// and a Location the caller cannot read, a withdrawn reference, and the
// declared-unrecorded printing fields. Every code carries __U2_FIXTURE_ONLY__.
// Nothing here is read by, written to, or mistaken for a governed record.
// ═══════════════════════════════════════════════════════════════════════════

const NAG = { id: 7, plant_code: "NAG", name: "Nagpur" };
const PUN = { id: 8, plant_code: "PUN", name: "Pune" };
const CUSTOMER = { id: 501, customer_code: "FIX-CUST-501", display_name: "__U2_FIXTURE_ONLY__ Distillers Unit 1",
  lifecycle_state: "customer", status: "active" };
const PROSPECT = { id: 502, customer_code: null, display_name: "__U2_FIXTURE_ONLY__ Prospect",
  lifecycle_state: "prospect", status: "proposed" };
const FAMILY = { id: 202, group_customer_code: "FIX-FAM-202", name: "__U2_FIXTURE_ONLY__ Distillers", status: "active" };

const ROWS = [
  { id: 9101, plant_item_code: "__U2_FIXTURE_ONLY__/NAG/0001", status: "active", replacement_sku_id: null,
    content_version: 2, plant: NAG, party_id: 501, customer: CUSTOMER, family: FAMILY, version_count: 2,
    latest_version: { id: 91012, version_no: 2, approved: false, is_price_driving: false,
      length_mm: 300, width_mm: 200, height_mm: null, box_type: "RSC" } },
  { id: 9102, plant_item_code: null, status: "proposed", replacement_sku_id: null, content_version: 1,
    plant: NAG, party_id: 501, customer: CUSTOMER, family: FAMILY, version_count: 0, latest_version: null },
  { id: 9103, plant_item_code: "__U2_FIXTURE_ONLY__/NAG/0003", status: "discontinued", replacement_sku_id: 9101,
    content_version: 4, plant: NAG, party_id: 502, customer: PROSPECT, family: null, version_count: 1,
    latest_version: { id: 91031, version_no: 1, approved: true, is_price_driving: true,
      length_mm: 250, width_mm: 150, height_mm: 0, box_type: "RSC" } },
  { id: 9201, plant_item_code: "__U2_FIXTURE_ONLY__/PUN/0001", status: "active", replacement_sku_id: null,
    content_version: 1, plant: PUN, party_id: 501, customer: CUSTOMER, family: FAMILY, version_count: 1,
    latest_version: { id: 92011, version_no: 1, approved: true, is_price_driving: true,
      length_mm: 410, width_mm: 310, height_mm: 220, box_type: "RSC" } },
];

const VISIBLE = { customer: "visible", construction: "visible", plant_adoption: "visible", locations: "visible" };
const UNRECORDED = ["printing_technology", "number_of_colours"];
const header = row => ({ id: row.id, plant_item_code: row.plant_item_code, status: row.status,
  replacement_sku_id: row.replacement_sku_id, content_version: row.content_version, plant: row.plant,
  party_id: row.party_id, customer: row.customer, family: row.family });
const common = { unrecorded_specification_fields: UNRECORDED, mode: "governed_read_only",
  authority: "caller_token_rls_only", mutations: "none" };

const CONSTRUCTION = { construction_id: 5, construction_code: "FIX-CON-125", name: "__U2_FIXTURE_ONLY__ 5-ply BC",
  construction_status: "published", version_no: 2, ply: 5, flute_f1: "B", flute_f2: "A", board_gsm: 780, approved: true };

export const SKU_FIXTURE_DETAILS = {
  9101: { ...common, sku: header(ROWS[0]), detail_visibility: VISIBLE,
    versions: [
      { id: 91011, version_no: 1, is_price_driving: true, approved: true,
        specification: { length_mm: 300, width_mm: 200, height_mm: 0, box_type: "RSC", ups: 1,
          spec_bs: null, spec_bct: 0, spec_ect: null },
        construction_version_id: 41, construction: CONSTRUCTION, plant_adoption: ["adopted"] },
      { id: 91012, version_no: 2, is_price_driving: false, approved: false,
        specification: { length_mm: 300, width_mm: 200, height_mm: null, box_type: "RSC", ups: 2,
          spec_bs: 12.5, spec_bct: null, spec_ect: 0 },
        construction_version_id: 42, construction: null, plant_adoption: [] },
    ],
    external_references: [
      { id: 1, reference_kind: "customer_item_code", reference_value: "FIX-CIC-778", status: "active" },
      { id: 2, reference_kind: "alias", reference_value: "Old fixture carton", status: "withdrawn" },
    ],
    location_applicability: [
      { id: 11, location_id: 601, scope: "master", status: "approved", approved: true,
        location: { location_code: "FIX-LOC-601", status: "active", bill_to_eligible: true, ship_to_eligible: true } },
      { id: 12, location_id: 602, scope: "batch_only", status: "proposed", approved: false, location: null },
    ],
    lineage: { replaced_by: null, replacement_visible: true,
      replaces: [{ id: 9103, plant_item_code: "__U2_FIXTURE_ONLY__/NAG/0003", status: "discontinued" }] } },
  9102: { ...common, sku: header(ROWS[1]), detail_visibility: VISIBLE, versions: [], external_references: [],
    location_applicability: [], lineage: { replaced_by: null, replacement_visible: true, replaces: [] } },
  9103: { ...common, sku: header(ROWS[2]),
    detail_visibility: { customer: "visible", construction: "not_visible_to_caller", plant_adoption: "unavailable",
      locations: "not_visible_to_caller" },
    versions: [
      { id: 91031, version_no: 1, is_price_driving: true, approved: true,
        specification: { length_mm: 250, width_mm: 150, height_mm: 0, box_type: "RSC", ups: 1,
          spec_bs: null, spec_bct: null, spec_ect: null },
        construction_version_id: 41, construction: null, plant_adoption: null },
    ],
    external_references: [],
    location_applicability: [{ id: 13, location_id: 603, scope: "master", status: "withdrawn", approved: true, location: null }],
    lineage: { replaced_by: { id: 9101, plant_item_code: "__U2_FIXTURE_ONLY__/NAG/0001", status: "active" },
      replacement_visible: true, replaces: [] } },
  9201: { ...common, sku: header(ROWS[3]), detail_visibility: VISIBLE,
    versions: [
      { id: 92011, version_no: 1, is_price_driving: true, approved: true,
        specification: { length_mm: 410, width_mm: 310, height_mm: 220, box_type: "RSC", ups: 1,
          spec_bs: 14, spec_bct: 380, spec_ect: 6.2 },
        construction_version_id: 41, construction: CONSTRUCTION, plant_adoption: ["adopted"] },
    ],
    external_references: [], location_applicability: [],
    lineage: { replaced_by: null, replacement_visible: true, replaces: [] } },
};

// Fixture-only stand-in for the database filtering the governed route does.
export function fixtureSkuCatalogue({ plant, status, q, familyId, partyId } = {}) {
  const search = (q || "").trim().toLowerCase();
  const skus = ROWS.filter(row => (!plant || row.plant.plant_code === plant)
    && (!status || row.status === status)
    && (!search || (row.plant_item_code || "").toLowerCase().includes(search))
    && (!familyId || row.family?.id === Number(familyId))
    && (!partyId || row.party_id === Number(partyId)));
  return { skus, truncated: false, limit: 200, plant_scope: ["NAG", "PUN"],
    filters: { plant: plant || null, status: status || null, q: search || null,
      party_id: partyId || null, family_id: familyId || null },
    detail_visibility: { customer: "visible" }, ...common };
}
