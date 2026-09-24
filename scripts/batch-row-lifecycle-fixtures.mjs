import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { durableRowToLocalPreview, openDurableRowInCosting } from "../src/lib/batchRowModel.js";
import { resolveBatchInterest } from "../src/engine/resolveAuthority.js";
import { useCostingBatchBridge } from "../src/state/useCostingBatchBridge.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const panel = fs.readFileSync(path.join(root, "src/tabs/batch/BatchWorkspacePanel.jsx"), "utf8");
let passes = 0;
const failures = [];

function check(condition, label) {
  if (condition) { passes += 1; console.log(`ok   - ${label}`); }
  else { failures.push(label); console.log(`FAIL - ${label}`); }
}

const preview = durableRowToLocalPreview({
  id: 351, content_version: 8, sku_id: 301, sku_version_id: 311, pricing_group_id: 81,
  row_type: "box", addon_printing: 0, addon_coating: null, addon_other: 12.5,
  fluting_bcf: 0, sku_version: {}, effective_construction: {},
});
check(preview.printing === 0 && preview.coating === "" && preview.other === 12.5,
  "U4-ROW-FE-1 local preview preserves deliberate zero, absent and valued add-ons distinctly");
check(preview.fluting_bcf === 0,
  "U4-ROW-FE-2 deliberate-zero fluting BCF is not mistaken for inherited blank");
check(panel.includes('placeholder="Blank · not entered"')
  && panel.includes("Add-on charges have no inheritance")
  && panel.includes('placeholder="Blank · inherit default"'),
  "U4-ROW-FE-3 editor explains the different null semantics for add-ons and fluting");
check(panel.includes("addon_printing") && panel.includes("addon_unloading")
  && panel.includes('max="0.3"'),
  "U4-ROW-FE-4 every governed add-on and the bounded fluting input is visible");
check(panel.includes("/rows/${row.id}/status")
  && panel.includes("expected_content_version: row.content_version")
  && panel.includes("Remove row") && panel.includes("Restore row"),
  "U4-ROW-FE-5 reversible row lifecycle uses the dedicated CAS route");
check(panel.includes('disabled={row.status !== "active"}')
  && panel.includes("excluded from preparation and Send candidates"),
  "U4-ROW-FE-6 removed rows remain visible but cannot preview or masquerade as active");

const governedRow = {
  id: 8801, content_version: 13, sku_id: 410, sku_version_id: 411, pricing_group_id: 92,
  row_type: "box", material_code: "EST-410", sku: { plant_item_code: "EST-410" },
  sku_version: { length_mm: 410, width_mm: 310, height_mm: 210, ups: 1, box_type: "RSC" },
  effective_construction: {
    version_id: 901,
    construction: { construction_code: "5P-BC" },
    version: { board_gsm: 620 },
  },
};
const initialState = () => ({
  localRows: [{ id: "local-durable-8801", durableRowId: 8801,
    durableRowContentVersion: 12, marker: "previous preview" }],
  results: { "local-durable-8801": { finalRate: 47.5 } },
  batchProfile: { client: "Existing customer", plant: "Existing plant", sector: "EX" },
  workspaceRequest: { requestId: "existing-request", batchId: 7, rowId: 777 },
  activeReview: { rowId: "local-existing", dirty: true },
});

for (const refusal of ["missing catalogue", "incomplete row", "cancelled dirty review"]) {
  const state = initialState();
  const before = JSON.stringify(state);
  const result = openDurableRowInCosting({
    row: governedRow,
    transition: () => false,
    commit: () => { throw new Error(`${refusal} must not commit local preview state`); },
  });
  check(!result.opened && result.preview === null && JSON.stringify(state) === before,
    `U4-ROW-FE-7 ${refusal} leaves rows, results, profile, request and active review unchanged`);
}

const successState = initialState();
const order = [];
const opened = openDurableRowInCosting({
  row: governedRow,
  existingId: "local-durable-8801",
  transition: candidate => {
    order.push("transition");
    successState.activeReview = { rowId: candidate.id, dirty: false };
    return true;
  },
  commit: candidate => {
    order.push("commit");
    successState.localRows = successState.localRows.map(item =>
      item.id === candidate.id ? candidate : item);
    delete successState.results[candidate.id];
    successState.batchProfile = { client: "Established customer", plant: "Nagpur", sector: "AUTO" };
    successState.workspaceRequest = { batchId: 71, rowId: governedRow.id, mode: "row-focus" };
  },
});
check(opened.opened && order.join(",") === "transition,commit"
  && opened.preview.durableRowId === 8801
  && opened.preview.durableRowContentVersion === 13
  && opened.preview.governedSkuId === 410
  && opened.preview.governedSkuVersionId === 411
  && opened.preview.governedPricingGroupId === 92
  && opened.preview.governedConstructionVersionId === 901
  && successState.localRows[0].marker === undefined
  && successState.results["local-durable-8801"] === undefined
  && successState.workspaceRequest.rowId === 8801
  && successState.activeReview.rowId === "local-durable-8801",
  "U4-ROW-FE-8 successful Costing entry commits only after transition and preserves every governed identity");

// ── S2 · Costing Customer and Profile authority ─────────────────────────────
// Customer A is the Batch-selected Customer. B is another member of A's Family
// and owns the established SKU. The browser-local Profile belongs to unrelated
// Customer C, whose Sector and commercial values differ from the Batch's on
// every field the review inherits. This drives the REAL transition
// (useCostingBatchBridge.loadBatchRowIntoCosting) through the real
// openDurableRowInCosting, then inspects Profile, review spec and identities.
const sectors = [
  { code: "SEC-A", marginPct: 11, wasteCBB: 4.5, convBox: 8, wastePP: 4.5, convPP: 13 },
  { code: "SEC-C", marginPct: 1.5, wasteCBB: 1, convBox: 1, wastePP: 1, convPP: 1 },
];
const customerA = { id: 501, display_name: "Customer A (Batch)", customer_code: "CUST-A",
  lifecycle_state: "established" };
const customerB = { id: 502, display_name: "Customer B (SKU owner)", customer_code: "CUST-B" };
const governedBatch = {
  id: 71, family_id: 40, customer_party_id: customerA.id, customer_party: customerA,
  family: { id: 40, name: "Family AB" },
  sector: { id: 9, sector_code: "SEC-A" },
  plant: { id: 3, plant_code: "NAG", name: "Nagpur" },
  current_profile: { waste_cbb_pct: 6.5, conv_box_rate: 9.25, margin_box_pct: null,
    waste_pp_pct: null, conv_pp_rate: null, margin_pp_pct: null },
  pricing_groups: [{ id: 92, status: "active", payment_terms_days: 60,
    delivery_groups: [{ id: 5, status: "active", ship_to_location: { location_code: "SHIP-A" } }] }],
};
const familyRow = {
  id: 8802, content_version: 4, sku_id: 610, sku_version_id: 611, pricing_group_id: 92,
  row_type: "box", material_code: "EST-610", customer: customerB,
  sku: { plant_item_code: "EST-610", party_id: customerB.id },
  sku_version: { length_mm: 300, width_mm: 200, height_mm: 150, ups: 1, box_type: "RSC" },
  effective_construction: { version_id: 931, construction: { construction_code: "3P-B" },
    version: { board_gsm: 450 } },
};
const staleProfileC = { client: "Customer C (unrelated)", sector: "SEC-C", plant: "Pune",
  delivery: "C-DOCK", customerType: "new", priceContext: "premium", paymentDisc: "15",
  interest: 0.25, freightOverride: "7.7", margin: 3, marginPP: 3, waste: 2, convRate: 4,
  wastePP: 2, convRatePP: 4 };
const catalogue = [{ code: "3P-B", ply: 3, boxType: "RSC", waste: 99, convRate: 99,
  layers: { TOP: { code: "K", gsm: 150 }, F1: { code: "F", gsm: 150 }, L1: { code: "K", gsm: 150 } } }];

function s2World({ catalogueRows = catalogue, confirm = true, reviewDirty = false } = {}) {
  const state = {
    batchProfile: structuredClone(staleProfileC),
    localRows: [{ id: "local-durable-8802", durableRowId: 8802, durableRowContentVersion: 3,
      marker: "previous preview" }, { id: "local-other", marker: "unrelated local row" }],
    results: { "local-durable-8802": { finalRate: 31 }, "local-other": { finalRate: 12 } },
    workspaceRequest: { requestId: "existing-request", batchId: 7, rowId: 777 },
    activeReview: { rowId: "local-existing", spec: { client: staleProfileC.client } },
    tab: "batch", setAutoFill: false, toasts: [], confirms: 0,
  };
  globalThis.window = { confirm: () => { state.confirms += 1; return confirm; } };
  const bridge = useCostingBatchBridge({
    activeBatchRowId: "local-existing", autoCalcPPDims: row => row, batchProfile: state.batchProfile,
    batchRows: state.localRows, constructionCatalogue: catalogueRows, reviewDirty, sectors,
    openReview: (rowId, spec) => { state.activeReview = { rowId, spec }; },
    setSetAutoFill: value => { state.setAutoFill = value; },
    setTab: tab => { state.tab = tab; },
    showToast: message => { state.toasts.push(message); },
  });
  // Mirrors BatchWorkspacePanel.openInCosting's commit (pinned by S2-PROF-6).
  const open = row => {
    const existing = state.localRows.find(item => String(item.durableRowId) === String(row.id));
    return openDurableRowInCosting({
      batch: governedBatch, row, existingId: existing?.id,
      transition: bridge.loadBatchRowIntoCosting,
      commit: (preview, targetProfile) => {
        state.localRows = existing
          ? state.localRows.map(item => item.id === existing.id ? preview : item)
          : [...state.localRows, preview];
        if (existing) delete state.results[existing.id];
        state.batchProfile = targetProfile;
        state.workspaceRequest = { batchId: governedBatch.id, mode: "row-focus", rowId: row.id };
      },
    });
  };
  return { state, open };
}
const untouched = state => {
  const { toasts, confirms, ...rest } = state;
  return JSON.stringify(rest);
};

const refusals = [
  ["missing Construction catalogue", { catalogueRows: [] }, familyRow],
  ["incomplete row", {}, { ...familyRow, effective_construction: {} }],
  ["cancelled dirty-review confirmation", { confirm: false, reviewDirty: true }, familyRow],
];
for (const [label, options, row] of refusals) {
  const { state, open } = s2World(options);
  const before = untouched(state);
  const result = open(row);
  check(!result.opened && result.preview === null && untouched(state) === before
    && state.batchProfile.client === staleProfileC.client
    && (label.startsWith("cancelled") ? state.confirms === 1 : state.toasts.length === 1),
    `S2-PROF-1 ${label} leaves stale Customer C Profile, rows, results, request and review untouched`);
}

const s2 = s2World();
const s2Opened = s2.open(familyRow);
const profile = s2.state.batchProfile;
const reviewSpec = s2.state.activeReview.spec;
const expectedInterest = resolveBatchInterest({ paymentDisc: "60", interest: null }).value;
check(s2Opened.opened && profile === s2Opened.targetProfile
  && profile.client === customerA.display_name && reviewSpec.client === customerA.display_name
  && profile.client !== customerB.display_name && reviewSpec.client !== customerB.display_name,
  "S2-PROF-2 successful entry keeps Batch Customer A in the Profile and review, never SKU owner B");
check(profile.sector === "SEC-A" && profile.plant === "Nagpur" && profile.delivery === "SHIP-A"
  && profile.paymentDisc === "60" && profile.customerType === "existing"
  && profile.interest === null && profile.freightOverride === ""
  && profile.waste === 6.5 && profile.convRate === 9.25 && profile.margin === null
  && !Object.values(profile).includes(staleProfileC.client),
  "S2-PROF-3 stale Customer C Profile is replaced wholesale by the governed Batch Profile");
check(reviewSpec.sector === "SEC-A" && reviewSpec.plant === "Nagpur" && reviewSpec.delivery === "SHIP-A"
  && reviewSpec.waste === 6.5 && reviewSpec.convRate === 9.25 && reviewSpec.margin === 11
  && reviewSpec.interest === expectedInterest
  && expectedInterest !== resolveBatchInterest(staleProfileC).value
  && reviewSpec.freightOverride === "" && reviewSpec.paymentDisc === "60",
  "S2-PROF-4 review margin, waste, conversion, interest and freight derive from the governed Batch, not C");
const s2Preview = s2.state.localRows.find(item => item.durableRowId === 8802);
check(s2Preview === s2Opened.preview && s2Preview.id === "local-durable-8802"
  && s2Preview.durableRowContentVersion === 4 && s2Preview.governedSkuId === 610
  && s2Preview.governedSkuVersionId === 611 && s2Preview.governedPricingGroupId === 92
  && s2Preview.governedConstructionVersionId === 931 && s2Preview.product === "EST-610"
  && s2.state.activeReview.rowId === "local-durable-8802"
  && s2.state.results["local-durable-8802"] === undefined && s2.state.results["local-other"].finalRate === 12
  && s2.state.localRows.some(item => item.marker === "unrelated local row")
  && s2.state.workspaceRequest.rowId === 8802 && s2.state.workspaceRequest.batchId === 71
  && s2.state.workspaceRequest.mode === "row-focus" && s2.state.tab === "costing",
  "S2-PROF-5 durable row, content version, SKU, SKU Version, Pricing Group and Construction Version survive");
const commitStart = panel.indexOf("const commitLocalPreview = (row, preview, existing, targetProfile) =>");
const commitBody = panel.slice(commitStart, panel.indexOf("const copyToLocalPreview", commitStart));
check(commitStart > 0 && commitBody.includes("setBatchProfile(targetProfile);")
  && !panel.includes("row.customer?.display_name || current.client")
  && panel.includes("commit: (preview, targetProfile) => {")
  && panel.includes("commitLocalPreview(row, preview, existing, freshBatchProfileValues(batch))")
  && panel.includes('<Identity label="Customer" value={row.customer?.display_name'),
  "S2-PROF-6 panel commits only the governed target Profile; SKU owner stays visible as row identity");

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
console.log("U4 durable-row input and lifecycle fixture gate PASS");
