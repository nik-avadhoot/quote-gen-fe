// ═══════════════════════════════════════════════════════════════════════════
// src/lib/skuMasterFixture.js — FIXTURE ONLY SKU Master responses.
//
// Shaped exactly like the governed `/masters/skus` routes (Amendment 02) so the
// development preview exercises the real rendering paths: CDM-43 quote fields
// with blank versus zero, a proposed SKU with no Plant Item Code, replacement
// lineage, a Construction version and a Location the caller cannot read, a
// withdrawn reference, and a master SKU Set whose members carry their own
// quantity per set. Every code carries __U2_FIXTURE_ONLY__. Nothing here is
// read by, written to, or mistaken for a governed record.
// ═══════════════════════════════════════════════════════════════════════════

const NAG = { id: 7, plant_code: "NAG", name: "Nagpur" };
const PUN = { id: 8, plant_code: "PUN", name: "Pune" };
const CUSTOMER = { id: 501, customer_code: "FIX-CUST-501", display_name: "__U2_FIXTURE_ONLY__ Distillers Unit 1",
  lifecycle_state: "customer", status: "active" };
const PROSPECT = { id: 502, customer_code: null, display_name: "__U2_FIXTURE_ONLY__ Prospect",
  lifecycle_state: "prospect", status: "proposed" };
const FAMILY = { id: 202, group_customer_code: "FIX-FAM-202", name: "__U2_FIXTURE_ONLY__ Distillers", status: "active" };

const CONSTRUCTION = { construction_id: 5, construction_code: "FIX-CON-125", name: "__U2_FIXTURE_ONLY__ 3-ply C",
  construction_status: "published", version_no: 2, ply: 3, flute_f1: "C", flute_f2: null, board_gsm: 470, approved: true,
  layers: { top: { bf: "28", gsm: 150 }, flute_1: { bf: "20", gsm: 120 }, back_1: { bf: "28", gsm: 150 },
    flute_2: { bf: null, gsm: null }, back_2: { bf: null, gsm: null } } };
const BOARD_CONSTRUCTION = { construction_id: 6, construction_code: "FIX-CON-133", name: "__U2_FIXTURE_ONLY__ 3-ply B board",
  construction_status: "published", version_no: 1, ply: 3, flute_f1: "B", flute_f2: null, board_gsm: 335, approved: true,
  layers: { top: { bf: "16", gsm: 100 }, flute_1: { bf: "16", gsm: 100 }, back_1: { bf: "16", gsm: 100 },
    flute_2: { bf: null, gsm: null }, back_2: { bf: null, gsm: null } } };

const QF_BOX_V1 = { item_name: "__U2_FIXTURE_ONLY__ RS 375 ML COMMON", item_short_name: "RS 375 ML COMMON",
  item_family: "RSC", item_group: "2L+2W+F", print_quality: "As per Approved Artwork", print_technology: null,
  number_of_colours: null, colour_detail: null, cobb_value: null, stated_item_gsm: null, item_weight_kg: null,
  stated_cs: null, stated_bs: null, stated_ect: null, customer_spec_version: null };
const QF_BOX_V2 = { item_name: "__U2_FIXTURE_ONLY__ RS 375 ML COMMON", item_short_name: "RS 375 ML COMMON",
  item_family: "RSC", item_group: "2L+2W+F", print_quality: "As per Approved Artwork", print_technology: "Flexo",
  number_of_colours: 1, colour_detail: "PRM 8013 BROWN (PANTONE 490 C)", cobb_value: "NA",
  stated_item_gsm: "470 -/+ 3%", item_weight_kg: 0.3, stated_cs: "150 KGF", stated_bs: "MIN 8.5 KG/CM²",
  stated_ect: "NA", customer_spec_version: "FIX-SPEC-OCRSP3 v2" };
const QF_PLATE = { item_name: "__U2_FIXTURE_ONLY__ PLATE RS 375 ML", item_short_name: "PLATE RS 375ML 4 x 4",
  item_family: "Plate", item_group: "Board", print_quality: null, print_technology: "Unprinted", number_of_colours: 0,
  colour_detail: "NA", cobb_value: "NA", stated_item_gsm: "335", item_weight_kg: 0, stated_cs: null, stated_bs: null,
  stated_ect: "NA", customer_spec_version: null };
const QF_PARTITION = { ...QF_PLATE, item_name: "__U2_FIXTURE_ONLY__ PARTITION RS 375 ML", item_short_name: "PARTITION RS 375 ML DIE 1",
  item_family: "Partition" };

const BOX_SET = { id: 51, label: "__U2_FIXTURE_ONLY__/NAG/0001", status: "confirmed",
  members: [
    { sku_id: 9101, plant_item_code: "__U2_FIXTURE_ONLY__/NAG/0001", sku_status: "active", sku_visible: true,
      role: "box", qty_per_set: 1, status: "confirmed" },
    { sku_id: 9104, plant_item_code: "__U2_FIXTURE_ONLY__/NAG/0001P1", sku_status: "proposed", sku_visible: true,
      role: "plate", qty_per_set: 2, status: "confirmed" },
    { sku_id: 9105, plant_item_code: "__U2_FIXTURE_ONLY__/NAG/0001Q1", sku_status: "proposed", sku_visible: true,
      role: "partition", qty_per_set: 1, status: "proposed" },
  ] };
const setFor = (skuId) => {
  const me = BOX_SET.members.find(m => m.sku_id === skuId);
  return me ? [{ id: BOX_SET.id, label: BOX_SET.label, status: BOX_SET.status, role: me.role,
    qty_per_set: me.qty_per_set, member_status: me.status, members: BOX_SET.members }] : [];
};

const latest = (id, versionNo, count, approved, priceDriving, cvId, spec, quoteFields) => ({
  id, version_no: versionNo, approved, is_price_driving: priceDriving, construction_version_id: cvId, ...spec,
  quote_fields: quoteFields,
});
const SPEC_BOX_V1 = { length_mm: 410, width_mm: 225, height_mm: 0, box_type: "RSC", ups: 3, spec_bs: null, spec_bct: 0, spec_ect: null };
const SPEC_BOX_V2 = { length_mm: 410, width_mm: 225, height_mm: 235, box_type: "RSC", ups: 3, spec_bs: 8.5, spec_bct: null, spec_ect: 0 };
const SPEC_PLATE = { length_mm: 1640, width_mm: 890, height_mm: null, box_type: "Board", ups: 2, spec_bs: null, spec_bct: null, spec_ect: null };
const SPEC_PARTITION = { length_mm: 870, width_mm: 695, height_mm: null, box_type: "Board", ups: 2, spec_bs: null, spec_bct: null, spec_ect: null };
const SPEC_OLD = { length_mm: 250, width_mm: 150, height_mm: 0, box_type: "RSC", ups: 1, spec_bs: null, spec_bct: null, spec_ect: null };
const SPEC_PUN = { length_mm: 410, width_mm: 310, height_mm: 220, box_type: "RSC", ups: 1, spec_bs: 14, spec_bct: 380, spec_ect: 6.2 };

const REFS_9101 = { customer_item_code: ["FIX-CIC-778"], softcomp_code: ["FIX-011145"] };

const ROWS = [
  { id: 9101, plant_item_code: "__U2_FIXTURE_ONLY__/NAG/0001", status: "active", replacement_sku_id: null,
    content_version: 2, pricing_portfolio: "Strategic", plant: NAG, party_id: 501, customer: CUSTOMER, family: FAMILY, version_count: 2,
    latest_version: latest(91012, 2, 2, false, false, 41, SPEC_BOX_V2, QF_BOX_V2), construction: CONSTRUCTION,
    references: REFS_9101, locations: [{ location_id: 601, location_code: "FIX-LOC-601", scope: "master", status: "approved" },
      { location_id: 602, location_code: null, scope: "batch_only", status: "proposed" }], sets: setFor(9101) },
  { id: 9102, plant_item_code: null, status: "proposed", replacement_sku_id: null, content_version: 1, pricing_portfolio: "Transactional",
    plant: NAG, party_id: 501, customer: CUSTOMER, family: FAMILY, version_count: 0, latest_version: null,
    construction: null, references: {}, locations: [], sets: [] },
  { id: 9103, plant_item_code: "__U2_FIXTURE_ONLY__/NAG/0003", status: "discontinued", replacement_sku_id: 9101,
    content_version: 4, pricing_portfolio: "Transactional", plant: NAG, party_id: 502, customer: PROSPECT, family: null, version_count: 1,
    latest_version: latest(91031, 1, 1, true, true, 43, SPEC_OLD, { ...QF_BOX_V1, item_short_name: "OLD RS 375" }),
    construction: null, references: { legacy_plant_item_code: ["FIX-RET-0003"] },
    locations: [{ location_id: 603, location_code: null, scope: "master", status: "withdrawn" }],
    sets: [] },
  { id: 9104, plant_item_code: "__U2_FIXTURE_ONLY__/NAG/0001P1", status: "proposed", replacement_sku_id: null,
    content_version: 1, pricing_portfolio: "Strategic", plant: NAG, party_id: 501, customer: CUSTOMER, family: FAMILY, version_count: 1,
    latest_version: latest(91041, 1, 1, false, true, 44, SPEC_PLATE, QF_PLATE), construction: BOARD_CONSTRUCTION,
    references: {}, locations: [], sets: setFor(9104) },
  { id: 9105, plant_item_code: "__U2_FIXTURE_ONLY__/NAG/0001Q1", status: "proposed", replacement_sku_id: null,
    content_version: 1, pricing_portfolio: "Strategic", plant: NAG, party_id: 501, customer: CUSTOMER, family: FAMILY, version_count: 1,
    latest_version: latest(91051, 1, 1, false, true, 44, SPEC_PARTITION, QF_PARTITION), construction: BOARD_CONSTRUCTION,
    references: {}, locations: [], sets: setFor(9105) },
  { id: 9201, plant_item_code: "__U2_FIXTURE_ONLY__/PUN/0001", status: "active", replacement_sku_id: null,
    content_version: 1, pricing_portfolio: "Transactional", plant: PUN, party_id: 501, customer: CUSTOMER, family: FAMILY, version_count: 1,
    latest_version: latest(92011, 1, 1, true, true, 41, SPEC_PUN, { ...QF_BOX_V2, print_technology: "CMYK", number_of_colours: 4 }),
    construction: CONSTRUCTION, references: {}, locations: [], sets: [] },
];

const VISIBLE = { customer: "visible", construction: "visible", plant_adoption: "visible", locations: "visible", sets: "visible" };
const PENDING_NONE = { quote_fields: false, sku_sets: false, pricing_portfolio: false };
const common = { schema_pending: PENDING_NONE, mode: "governed_read_only", authority: "caller_token_rls_only", mutations: "none" };
const header = row => ({ id: row.id, plant_item_code: row.plant_item_code, status: row.status,
  pricing_portfolio: row.pricing_portfolio,
  replacement_sku_id: row.replacement_sku_id, content_version: row.content_version, plant: row.plant,
  party_id: row.party_id, customer: row.customer, family: row.family });
const detailVersion = (id, versionNo, approved, priceDriving, cvId, spec, quoteFields, construction, adoption) => ({
  id, version_no: versionNo, is_price_driving: priceDriving, approved, specification: spec, quote_fields: quoteFields,
  construction_version_id: cvId, construction, plant_adoption: adoption });

export const SKU_FIXTURE_DETAILS = {
  9101: { ...common, sku: header(ROWS[0]), detail_visibility: VISIBLE,
    versions: [
      detailVersion(91011, 1, true, true, 42, SPEC_BOX_V1, QF_BOX_V1, null, []),
      detailVersion(91012, 2, false, false, 41, SPEC_BOX_V2, QF_BOX_V2, CONSTRUCTION, ["adopted"]),
    ],
    external_references: [
      { id: 1, reference_kind: "customer_item_code", reference_value: "FIX-CIC-778", status: "active" },
      { id: 2, reference_kind: "alias", reference_value: "Old fixture carton", status: "withdrawn" },
      { id: 3, reference_kind: "softcomp_code", reference_value: "FIX-011145", status: "active" },
    ],
    location_applicability: [
      { id: 11, location_id: 601, scope: "master", status: "approved", approved: true,
        location: { location_code: "FIX-LOC-601", status: "active", bill_to_eligible: true, ship_to_eligible: true } },
      { id: 12, location_id: 602, scope: "batch_only", status: "proposed", approved: false, location: null },
    ],
    lineage: { replaced_by: null, replacement_visible: true,
      replaces: [{ id: 9103, plant_item_code: "__U2_FIXTURE_ONLY__/NAG/0003", status: "discontinued" }] },
    sets: setFor(9101) },
  9102: { ...common, sku: header(ROWS[1]), detail_visibility: VISIBLE, versions: [], external_references: [],
    location_applicability: [], lineage: { replaced_by: null, replacement_visible: true, replaces: [] }, sets: [] },
  9103: { ...common, sku: header(ROWS[2]),
    detail_visibility: { customer: "visible", construction: "not_visible_to_caller", plant_adoption: "unavailable",
      locations: "not_visible_to_caller", sets: "visible" },
    versions: [detailVersion(91031, 1, true, true, 43, SPEC_OLD, { ...QF_BOX_V1, item_short_name: "OLD RS 375" }, null, null)],
    external_references: [
      { id: 4, reference_kind: "legacy_plant_item_code", reference_value: "FIX-RET-0003", status: "active" },
    ],
    location_applicability: [{ id: 13, location_id: 603, scope: "master", status: "withdrawn", approved: true, location: null }],
    lineage: { replaced_by: { id: 9101, plant_item_code: "__U2_FIXTURE_ONLY__/NAG/0001", status: "active" },
      replacement_visible: true, replaces: [] },
    sets: [] },
  9104: { ...common, sku: header(ROWS[3]), detail_visibility: VISIBLE,
    versions: [detailVersion(91041, 1, false, true, 44, SPEC_PLATE, QF_PLATE, BOARD_CONSTRUCTION, [])],
    external_references: [], location_applicability: [],
    lineage: { replaced_by: null, replacement_visible: true, replaces: [] }, sets: setFor(9104) },
  9105: { ...common, sku: header(ROWS[4]), detail_visibility: VISIBLE,
    versions: [detailVersion(91051, 1, false, true, 44, SPEC_PARTITION, QF_PARTITION, BOARD_CONSTRUCTION, [])],
    external_references: [], location_applicability: [],
    lineage: { replaced_by: null, replacement_visible: true, replaces: [] }, sets: setFor(9105) },
  9201: { ...common, sku: header(ROWS[5]), detail_visibility: VISIBLE,
    versions: [detailVersion(92011, 1, true, true, 41, SPEC_PUN, { ...QF_BOX_V2, print_technology: "CMYK", number_of_colours: 4 },
      CONSTRUCTION, ["adopted"])],
    external_references: [], location_applicability: [],
    lineage: { replaced_by: null, replacement_visible: true, replaces: [] }, sets: [] },
};

// The seven identity factors the one search box covers, and nothing else -
// deliberately NOT lifecycle, plant, portfolio or any specification value.
// The fixture reads the latest version only, where the governed route searches
// every version's Item Name; that is a fixture simplification, not a rule.
const identityText = row => [
  row.plant_item_code,
  row.latest_version?.quote_fields?.item_name,
  row.latest_version?.quote_fields?.item_short_name,
  ...(row.references?.customer_item_code || []),
  ...(row.references?.softcomp_code || []),
  ...(row.references?.legacy_plant_item_code || []),
  row.customer?.display_name,
].filter(Boolean).join(" ").toLowerCase();

// Fixture-only stand-in for the database filtering the governed route does.
export function fixtureSkuCatalogue({ plant, status, q, portfolio, familyId, partyId } = {}) {
  const terms = fixtureSearchTerms(q);
  const skus = ROWS.filter(row => (!plant || row.plant.plant_code === plant)
    && (!status || row.status === status)
    // A dropdown, deliberately NOT part of the one identity search box.
    && (!portfolio || row.pricing_portfolio === portfolio)
    // Every word must match somewhere: words narrow, they never widen.
    && terms.every(term => identityText(row).includes(term.toLowerCase()))
    && (!familyId || row.family?.id === Number(familyId))
    && (!partyId || row.party_id === Number(partyId)));
  return { skus, truncated: false, limit: 200, plant_scope: ["NAG", "PUN"],
    filters: { plant: plant || null, status: status || null, q: (q || "").trim() || null,
      portfolio: portfolio || null, party_id: partyId || null, family_id: familyId || null },
    // The fixture carries every identity factor, so all seven are searched.
    search: terms.length ? { q: (q || "").trim(), terms, executed: true, scan_truncated: false, degraded: false,
      fields: { plant_item_code: "searched", item_name: "searched", item_short_name: "searched",
        customer_item_code: "searched", softcomp_code: "searched", legacy_plant_item_code: "searched",
        customer_name: "searched" } } : null,
    detail_visibility: { customer: "visible", construction: "visible", references: "visible", locations: "visible", sets: "visible" },
    ...common };
}

function fixtureSearchTerms(q) {
  const seen = new Set();
  const terms = [];
  for (const word of (q || "").trim().split(/\s+/).filter(Boolean)) {
    const key = word.toLowerCase();
    if (!seen.has(key)) { seen.add(key); terms.push(word); }
  }
  return terms;
}
