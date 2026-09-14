import {
  automaticPricingBasisSuggestion,
  customerInterestPolicy,
  filterPricingBasisReleases,
  isValidDateOnly,
  pricingBasisOptions,
  PRICING_BASIS_ILLUSTRATION,
  releaseEligibility,
  releaseResolutionLadders,
} from "../src/lib/pricingBasisModel.js";
import {
  persistedSelectionState,
  pricingBasisDraftFromBatch,
  pricingBasisDraftIsDirty,
  setBatchPricingBasisBody,
  suggestForUnresolvedBatch,
} from "../src/lib/batchPricingBasis.js";
import { durableBatchPreparation, durableRowSelection, durableRowSpecificationEvidence,
  durableRowToLocalPreview, localPreviewState }
  from "../src/lib/batchRowModel.js";
import { readFileSync } from "node:fs";

let passed = 0;
const failures = [];

function check(condition, label) {
  if (condition) {
    passed += 1;
    console.log(`ok   - ${label}`);
  } else {
    failures.push(label);
    console.log(`FAIL - ${label}`);
  }
}

const current = PRICING_BASIS_ILLUSTRATION[0];
const future = PRICING_BASIS_ILLUSTRATION[1];

let verdict = releaseEligibility(current, "2026-09-11");
check(verdict.eligible && verdict.reason.includes("automatic default"),
  "PB-FE-1 current approved default is eligible and explained")

verdict = releaseEligibility(future, "2026-09-11");
check(!verdict.eligible && verdict.reason.includes("starts 2026-10-01"),
  "PB-FE-2 future release is not yet eligible and names its start")

verdict = releaseEligibility(future, "2026-10-15");
check(verdict.eligible && verdict.reason.includes("approved alternative"),
  "PB-FE-3 in-window approved alternative is eligible and distinguished from default")

verdict = releaseEligibility({ ...future, effective_until: "2026-10-31" }, "2026-11-01");
check(!verdict.eligible && verdict.reason.includes("ended 2026-10-31"),
  "PB-FE-4 expired release names the effective-period end")

for (const status of ["draft", "withdrawn"]) {
  verdict = releaseEligibility({ ...current, status }, "2026-09-11");
  check(!verdict.eligible && verdict.reason.toLowerCase().includes(status),
    `PB-FE-5 ${status} release is refused by status`)
}

verdict = releaseEligibility(current, "not-a-date");
check(!verdict.eligible && verdict.reason.includes("valid date"),
  "PB-FE-6 invalid date never produces an eligibility claim")
for (const impossible of ["2026-02-30", "2026-99-99", "2025-02-29", "0000-01-01"]) {
  verdict = releaseEligibility(current, impossible);
  check(!verdict.eligible && verdict.reason.includes("valid date"),
    `PB-FE-6a impossible date ${impossible} is refused without timezone conversion`)
}
check(isValidDateOnly("2024-02-29") && isValidDateOnly("2026-09-11"),
  "PB-FE-6b valid date-only and leap-day values are accepted")

check(Object.isFrozen(PRICING_BASIS_ILLUSTRATION),
  "PB-FE-7 labelled illustration collection is immutable")
check(current.id.startsWith("fixture-") && future.id.startsWith("fixture-"),
  "PB-FE-8 illustration identities are unmistakably fixture-only")
check(current.components.calculation_defaults.engine_version === "engine/qe1-7c2ceac1972460ba",
  "PB-FE-9 illustration carries the current engine identity")
check(current.components.calculation_defaults.annual_interest_pct === "6.000"
  && current.components.calculation_defaults.day_count_basis === 360,
  "PB-FE-10 annual interest is a separate visible authority")
check(future.components.sector.waste_cbb_pct === null,
  "PB-FE-11 inherited null remains distinct from an explicit zero")
check(current.components.sector.waste_pp_pct === "0.000",
  "PB-FE-12 explicit zero is preserved and presented as a governed value")
check(current.components.rate.entries.some(entry => entry.effective_material_rate === "42.1300"),
  "PB-FE-13 fixture exposes a governed effective material rate")
check(current.components.rate.entries.some(entry => entry.supplier_credit_pct === null)
  && current.components.rate.entries.some(entry => entry.supplier_credit_pct === "0.000"),
  "PB-FE-14 inherited supplier credit remains distinct from an explicit-zero exception")
check(current.components.freight.entries.some(entry => entry.explicit_zero)
  && current.components.freight.entries.some(entry => !entry.explicit_zero),
  "PB-FE-15 freight illustration distinguishes explicit zero from a priced lane")
check(["draft", "approved", "withdrawn"].every(status =>
  current.components.rate.history.some(version => version.status === status)),
  "PB-FE-16 Rate lifecycle illustration covers draft, approved and withdrawn")

const screen = readFileSync(new URL("../src/tabs/PricingBasisScreen.jsx", import.meta.url), "utf8");
check(screen.includes("Governed composition") && !screen.includes("Approved composition"),
  "PB-FE-17 composition heading does not overstate draft or withdrawn status")
check(screen.includes("Supplier-credit values shown here are not Batch Calculate inputs")
  && screen.includes("effective material rate only"),
  "PB-FE-18 Rate Master derivation is visibly separated from the Batch boundary")
check(screen.includes("no vehicle-class dimension")
  && screen.includes("origin plant × destination Ship-to"),
  "PB-FE-19 freight dimensions match the canonical schema without invented vehicle fields")

const ladders = releaseResolutionLadders(current.components);
const ppWaste = ladders.find(ladder => ladder.key === "waste_pp");
check(ppWaste.releaseSource === "sector"
  && ppWaste.tiers.find(tier => tier.source === "sector").value === "0.000",
  "PB-FE-20 explicit-zero Sector value terminates the release-side ladder")
const missingCbb = releaseResolutionLadders(future.components)
  .find(ladder => ladder.key === "waste_cbb");
check(missingCbb.releaseSource === "unresolved"
  && missingCbb.tiers.find(tier => tier.source === "sector").state === "inherit"
  && missingCbb.tiers.find(tier => tier.source === "system").state === "unavailable",
  "PB-FE-21 blank Sector plus unavailable Calculation Default stays unresolved")

const interest = customerInterestPolicy(current.components.calculation_defaults);
check(interest.state === "governed" && interest.annual_interest_pct === "6.000"
  && interest.day_count_basis === 360,
  "PB-FE-22 annual interest policy is a governed derivation input")
check(interest.examples.map(example => example.effective_interest_pct).join(",") === "0.5,0.75,1,1.5",
  "PB-FE-23 structured customer terms derive independently at 30/45/60/90 days")
check(interest.interest_fallback_pct === "0.500"
  && interest.interest_fallback_pct !== current.components.rate.credit_cost_pct,
  "PB-FE-24 customer-interest fallback remains separate from supplier credit")
check(customerInterestPolicy(null).state === "unavailable",
  "PB-FE-25 caller-hidden Calculation Default never produces an inferred interest value")
check(screen.includes("Batch Profile override")
  && screen.includes("Pricing Group is not a tier for these fields"),
  "PB-FE-26 canonical Batch Profile and Pricing Group tiers are not conflated")
check(screen.includes("Customer Payment-Term Interest")
  && screen.includes("supplier paper-credit cost belongs only to upstream"),
  "PB-FE-27 customer interest is visibly separate from supplier-credit derivation")
check(screen.includes("View Sector & Default details")
  && ladders.every(ladder => ladder.tiers.some(tier => tier.label === "Unresolved / missing")),
  "PB-FE-28 Sector/default drill-down exposes the complete inheritance ladder")
check(screen.includes("Pricing Basis Release plant:")
  && screen.includes("Same-plant composition is database-enforced")
  && screen.includes("Owning plant:"),
  "PB-FE-29 Release, Rate and Freight plant ownership is prominent and accurately enforced")
check(screen.includes("The Freight Set owner shown above is not the lane origin")
  && screen.includes("MISSING LANES · ABSENT, NOT ZERO")
  && current.components.freight.missing_destinations.length === 1,
  "PB-FE-30 Freight ownership, lane origin and missing destination remain distinct")

const currentOptions = pricingBasisOptions(PRICING_BASIS_ILLUSTRATION, "NAG", "2026-09-11");
check(currentOptions[0].release.id === "fixture-current"
  && currentOptions[0].eligibility.eligible
  && currentOptions.some(option => option.release.status === "draft" && !option.eligibility.eligible)
  && currentOptions.some(option => option.release.status === "withdrawn" && !option.eligibility.eligible),
  "PB-FE-31 Batch selector orders the eligible default first and retains unavailable lifecycle evidence")
check(automaticPricingBasisSuggestion(currentOptions)?.id === "fixture-current",
  "PB-FE-32 exactly one eligible automatic default is suggested")
check(automaticPricingBasisSuggestion([
  currentOptions[0],
  { ...currentOptions[0], release: { ...currentOptions[0].release, id: "ambiguous-default" } },
]) === null,
  "PB-FE-33 ambiguous automatic defaults are never silently selected")
check(pricingBasisOptions(PRICING_BASIS_ILLUSTRATION, "PNQ", "2026-09-11").length === 0,
  "PB-FE-34 Batch selector never crosses the selected plant")

const selector = readFileSync(new URL("../src/tabs/batch/BatchPricingBasisSelector.jsx", import.meta.url), "utf8");
const batchEntry = readFileSync(new URL("../src/tabs/batch/BatchEntryTab.jsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../src/tabs/batch/BatchPricingBasisWorkspace.jsx", import.meta.url), "utf8");
const workspacePanel = readFileSync(new URL("../src/tabs/batch/BatchWorkspacePanel.jsx", import.meta.url), "utf8");
const pricingCard = readFileSync(new URL("../src/tabs/batch/BatchPricingCard.jsx", import.meta.url), "utf8");
const profileBar = readFileSync(new URL("../src/tabs/batch/BatchProfileBar.jsx", import.meta.url), "utf8");
const appCss = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const newBatchPanel = readFileSync(new URL("../src/tabs/batch/NewGovernedBatchPanel.jsx", import.meta.url), "utf8");
const pricingState = readFileSync(new URL("../src/state/usePricingBasisState.js", import.meta.url), "utf8");
const costingBridge = readFileSync(new URL("../src/state/useCostingBatchBridge.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../src/ui/Sidebar.jsx", import.meta.url), "utf8");
check(selector.includes("Session-only U3 selection · durable linkage begins in U4")
  || selector.includes("Session-only U3 selection · open a governed Batch for durable U4 linkage")
  && selector.includes("does not enable governed Calculate or Send until a Batch is opened")
  && batchEntry.includes("<BatchPricingCard"),
  "PB-FE-35 Batch Entry retains the U3 read selector and exposes the durable U4 workspace")
check(selector.includes("/masters/pricing-basis-releases")
  && !selector.includes("approve_pricing_basis_release")
  && !selector.includes("set_batch_pricing_basis")
  && !selector.includes("localStorage"),
  "PB-FE-36 selector uses only the caller-scoped read API and no browser mutation or persistence path")
check(selector.includes("No hidden Release is inferred")
  && selector.includes("No caller-visible Releases exist")
  && selector.includes("The governed catalogue could not be reached"),
  "PB-FE-37 denied, empty and error states remain distinct")
check(screen.includes("<BatchPricingCard fixtureOnly fallbackPlantCode=\"NAG\"")
  && pricingCard.includes("<BatchPricingBasisWorkspace compact")
  && workspace.includes("FIXTURE ONLY")
  && selector.includes("FIXTURE ONLY"),
  "PB-FE-38 the selector has an unmistakably isolated fixture-browser path")

const eligibleCatalogue = filterPricingBasisReleases(PRICING_BASIS_ILLUSTRATION, {
  plantCode: "NAG", asOf: "2026-10-15", scope: "eligible",
});
check(eligibleCatalogue.map(release => release.id).join(",")
  === "fixture-alternative,fixture-current",
  "PB-FE-39 brief catalogue shows only eligible Releases in newest-effective order")
check(filterPricingBasisReleases(PRICING_BASIS_ILLUSTRATION, {
  asOf: "2026-10-15", scope: "withdrawn",
}).map(release => release.id).join(",") === "fixture-withdrawn-release",
  "PB-FE-40 lifecycle filters isolate withdrawn history")
check(filterPricingBasisReleases(PRICING_BASIS_ILLUSTRATION, {
  asOf: "2026-10-15", scope: "all", query: "export",
}).map(release => release.id).join(",") === "fixture-alternative",
  "PB-FE-41 governed Release-name search finds a customer-focused naming convention without inferring a relationship")
check(filterPricingBasisReleases(PRICING_BASIS_ILLUSTRATION, {
  asOf: "2026-10-15", scope: "all", query: "fixture-current",
}).map(release => release.id).join(",") === "fixture-current",
  "PB-FE-42 permanent Release identity is searchable")
check(screen.includes("Brief catalogue view. Details and governed composition open only when requested.")
  && screen.includes("Show 50 more")
  && screen.includes("Results limited to the first")
  && screen.includes("not the complete matching catalogue")
  && screen.includes("Eligible on date")
  && screen.includes("All lifecycle states"),
  "PB-FE-43 catalogue defaults brief, filters by commercial state and bounds rendered rows")
check(screen.includes("Customer-focused Releases are found by governed Release name; no customer relationship is inferred."),
  "PB-FE-44 customer-focus organization does not invent a Customer foreign key")

check(screen.includes("LIFECYCLE CHRONOLOGY")
  && screen.includes("COMMERCIAL EFFECTIVE PERIOD · NOT LIFECYCLE")
  && screen.includes("Approved as automatic default")
  && screen.includes("Approved as alternative")
  && screen.includes("former default/alternative role is not retained")
  && screen.includes("does not assert replacement lineage"),
  "PB-FE-45 Release lifecycle chronology is distinct from effective dates and invents no replacement link")

const persistedBatch = {
  id: 71, batch_reference: "NAG/BAT/2026-27/00071", content_version: 7,
  pricing_date: "2026-10-15", pricing_basis_release_id: "fixture-alternative",
  pricing_basis_is_deliberate: true,
  plant: { id: "fixture-nag", plant_code: "NAG", name: "Nagpur" },
};
const persistedDraft = pricingBasisDraftFromBatch(persistedBatch);
check(persistedDraft.pricingDate === "2026-10-15"
  && persistedDraft.releaseId === "fixture-alternative"
  && persistedDraft.selectionMode === "deliberate",
  "U4-FE-1 persisted Batch Pricing Date, Release identity and deliberate mode hydrate the editor")
check(suggestForUnresolvedBatch(persistedBatch, PRICING_BASIS_ILLUSTRATION) === null
  && suggestForUnresolvedBatch({ ...persistedBatch, pricing_basis_release_id: null,
    pricing_date: "2026-09-11" }, PRICING_BASIS_ILLUSTRATION)?.id === "fixture-current",
  "U4-FE-2 automatic default is suggested only for a Batch with no persisted selection")

const movedDateDraft = { ...persistedDraft, pricingDate: "2027-01-01" };
const movedState = persistedSelectionState(persistedBatch, PRICING_BASIS_ILLUSTRATION, movedDateDraft);
check(movedState.selected.id === "fixture-alternative" && !movedState.eligible
  && movedState.warning.includes("persisted selection is retained"),
  "U4-FE-3 date change recalculates eligibility without replacing a deliberate Release")
const withdrawnDraft = { ...persistedDraft, releaseId: "fixture-withdrawn-release" };
check(persistedSelectionState(persistedBatch, PRICING_BASIS_ILLUSTRATION, withdrawnDraft)
  .warning.includes("Withdrawn releases are not eligible"),
  "U4-FE-4 withdrawn persisted Release is warned and never substituted")
check(pricingBasisDraftIsDirty(persistedBatch, movedDateDraft)
  && setBatchPricingBasisBody(persistedBatch, persistedDraft).release_id === "fixture-alternative",
  "U4-FE-5 deliberate save carries CAS version, date and exact Release identity")
check(setBatchPricingBasisBody(persistedBatch,
  { ...persistedDraft, selectionMode: "automatic_default" }).release_id === null,
  "U4-FE-6 reverting to the automatic default is an explicit null governed-RPC instruction")

const governedSku = {
  id: 301, plant_item_code: "NAG-SKU-301", status: "active",
  customer: { id: 201, customer_code: "CUST-201", display_name: "Fixture Customer" },
  versions: [{ id: 311, version_no: 2, construction_version_id: 321,
    length_mm: 400, width_mm: 300, height_mm: 250, box_type: "RSC", ups: 1,
    spec_bs: 8, spec_bct: 120, spec_ect: 32,
    construction: { id: 331, construction_code: "5P-180-22", name: "Fixture 5 ply" } }],
};
const governedRow = {
  id: 351, lineage_id: 9301, content_version: 2, pricing_group_id: 81,
  sku_id: 301, sku_version_id: 311, material_code: "NAG-SKU-301", row_type: "box",
  sku: governedSku, customer: governedSku.customer, sku_version: governedSku.versions[0],
  effective_construction: { version_id: 321, origin: "sku_version",
    version: { id: 321, board_gsm: 720 }, construction: governedSku.versions[0].construction },
  sales_moq: 1000, volume: 5000,
};
check(durableRowSelection([governedSku], 301, 311).version.construction_version_id === 321,
  "U4-FE-30 durable row selection resolves exact IDs rather than rendered labels")
const localPreview = durableRowToLocalPreview(governedRow, "local-351");
check(localPreview.durableRowId === 351 && localPreview.durableRowContentVersion === 2
  && localPreview.governedSkuVersionId === 311 && localPreview.governedConstructionVersionId === 321
  && localPreview.constructionCode === "5P-180-22" && localPreview.L === 400
  && localPreview.board_gsm === 720,
  "U4-FE-31 local preview copy retains governed source IDs and immutable SKU-Version inputs")
check(localPreviewState(governedRow, [], {}).state === "not-copied"
  && localPreviewState(governedRow, [localPreview], {}).state === "ready"
  && localPreviewState(governedRow, [localPreview], { "local-351": { price: 1 } }).state === "previewed"
  && localPreviewState({ ...governedRow, content_version: 3 }, [localPreview], {}).state === "source-changed",
  "U4-FE-32 local-preview freshness distinguishes absent, copied, previewed and changed governed source")
const previewResult = { calcBS: 7, calcGSM: 700 };
const specificationEvidence = durableRowSpecificationEvidence(governedRow, [localPreview],
  { "local-351": previewResult });
check(specificationEvidence.status === "review"
  && specificationEvidence.targets.bs === 8
  && specificationEvidence.targets.gsm === 720
  && specificationEvidence.targets.bct === 120
  && specificationEvidence.gaps.some(gap => gap.field === "Bursting Strength" && gap.severity === "high"),
  "U4-FE-32a specification evidence uses the existing engine checker and preserves unsupported targets")
const preparationBatch = {
  pricing_basis_release_id: 11, current_profile: { id: 41 },
  batch_rows: [{ ...governedRow, status: "active" }],
  pricing_groups: [{ id: 81, status: "active", freight_mode: "master",
    freight_basis_delivery_group_id: 91, delivery_groups: [{ id: 91, status: "active",
      bill_to_location_id: 101, ship_to_location_id: 102 }] }],
};
const preparation = durableBatchPreparation(preparationBatch, [localPreview],
  { "local-351": previewResult }, { 351: { status: "ready" } });
check(preparation.status === "specification_review" && preparation.rowCount === 1
  && preparation.completeRouteCount === 1 && preparation.previewed === 1
  && preparation.resolved === 1 && preparation.specificationReview === 1,
  "U4-FE-32b Batch preparation keeps durable structure, local preview, governed evidence and specification review separate")
check(durableBatchPreparation({ ...preparationBatch,
  batch_rows: [{ ...governedRow, status: "active", content_version: 3 }] }, [localPreview], {}, {}).status
    === "source_changed"
  && durableBatchPreparation({ ...preparationBatch, pricing_groups: [{ id: 81, status: "active",
    freight_mode: "master", freight_basis_delivery_group_id: null, delivery_groups: [] }] }, [], {}, {})
    .status === "incomplete",
  "U4-FE-32c stale local copies and structurally incomplete routes never become ready")
check(durableBatchPreparation({ ...preparationBatch, pricing_groups: [{ id: 81, status: "active",
  freight_mode: "master", freight_basis_delivery_group_id: 92, delivery_groups: [
    { id: 91, status: "active", bill_to_location_id: 101, ship_to_location_id: 102 },
    { id: 92, status: "active", bill_to_location_id: 101, ship_to_location_id: null },
  ] }] }, [localPreview], { "local-351": previewResult }, {}).structuralBlockers
  .includes("A master-freight Pricing Group has no complete freight-basis route"),
  "U4-FE-32d a different complete route cannot disguise an incomplete selected freight basis")
check(workspacePanel.includes("/row-options")
  && workspacePanel.includes("/rows/${row.id}")
  && workspacePanel.includes("Copy to local preview")
  && workspacePanel.includes("No caller-visible durable rows")
  && workspacePanel.includes("no governed record was written"),
  "U4-FE-33 durable row UI exposes live, fixture, empty and local-preview boundaries")
check(workspace.includes("/batches/pricing-basis?reference=")
  && workspace.includes("runMutation(`/batches/${batch.id}/pricing-basis`")
  && workspace.includes("Reopen persisted selection")
  && workspace.includes("governed RPC completed"),
  "U4-FE-7 production workspace opens, mutates through the backend RPC route and reopens")
check(!workspace.includes("localStorage") && !workspace.includes(".table(")
  && workspace.includes("FIXTURE-ONLY · isolated demonstration · no database writes"),
  "U4-FE-8 browser neither writes tables directly nor disguises fixture persistence")
check(selector.includes("durableState.warning")
  && selector.includes("Calculate and Atomic Send are available in the Batch workspace")
  && !selector.includes("supplier_credit"),
  "U4-FE-9 ineligible evidence is retained while Calculate/Send and supplier-credit inputs stay outside U4")
check(batchEntry.includes("batch-workspace-profile-card")
  && batchEntry.includes("<BatchPricingCard")
  && pricingCard.includes("batch-pricing-header-card")
  && pricingCard.includes(">PRICING</div>")
  && pricingCard.includes("<BatchPricingBasisWorkspace compact")
  && !batchEntry.includes("batch-workspace-pricing-slot")
  && batchEntry.indexOf("<BatchGrid") > batchEntry.indexOf("batch-workspace-profile-card"),
  "U4-FE-10 Batch reference and Pricing Basis controls live in an independent PRICING profile-header card")
check(appCss.includes("@media (min-width: 1280px)")
  && appCss.includes(".batch-profile-pricing-card {\n  width: 340px;")
  && appCss.includes("flex: 0 0 340px;")
  && !appCss.includes(".batch-workspace-pricing-slot")
  && !appCss.includes("right: 29.5%")
  && appCss.includes("responsive layout uses CSS")
  && appCss.includes(".batch-pricing-card-rail")
  && appCss.includes("writing-mode: vertical-rl")
  && workspace.includes("batchOpenControls={batchOpenControls}")
  && selector.includes("batch-pb-date-row")
  && selector.includes("batch-pb-release-row")
  && selector.includes("batch-pb-governed-actions")
  && selector.includes("batch-pb-selector-compact"),
  "U4-FE-11 desktop PRICING is a narrow three-row card beside merged COMMERCIALS with Open Batch on the date row")
check(workspace.includes("Permanent Batch reference")
  && workspace.includes("batch-pb-workspace-meta")
  && selector.includes("Pricing date")
  && selector.includes("Governed Release")
  && selector.includes("batch-pb-mode"),
  "U4-FE-12 compact profile controls retain Batch, plant, version, date, Release and selection-mode identities")
check(profileBar.includes("Commercials (including Terms)")
  && profileBar.includes("gridColumn:\"2 / -1\"")
  && profileBar.includes("gridTemplateColumns:\"52px 52px 52px\"")
  && profileBar.includes("gridTemplateRows:\"8px 23px 23px minmax(0, 1fr)\"")
  && profileBar.includes("rowGap:0")
  && profileBar.includes("alignSelf:\"stretch\",alignContent:\"end\"")
  && profileBar.includes("display:\"grid\",gap:3,minWidth:0")
  && profileBar.includes("padding:\"2px 0 1px\"")
  && profileBar.includes("height:17")
  && profileBar.includes("Freight Rs/kg</span>")
  && profileBar.includes(">PT</span>")
  && profileBar.includes(">Interest</span>")
  && !profileBar.includes(">Terms</span>"),
  "U4-FE-13 commercial terms form a compact independently bordered third row with no subsection header")
check(workspace.includes("setWorkspaceOpen(true)")
  && workspace.includes("View durable Batch identity, profile, people and groups")
  && workspacePanel.includes("apiFetch(`/batches/${batchId}/workspace`)")
  && workspacePanel.includes("runMutation")
  && workspacePanel.includes("/delivery-groups")
  && workspacePanel.includes("/freight-basis")
  && !workspacePanel.includes(".table("),
  "U4-FE-14 durable workspace reads and changes Delivery Groups only through authenticated backend routes")
check(appCss.includes(".batch-workspace-panel-scrim")
  && appCss.includes("position: fixed")
  && appCss.includes("justify-content: flex-end")
  && workspacePanel.includes("role=\"dialog\"")
  && workspacePanel.includes("aria-modal=\"true\""),
  "U4-FE-15 workspace details overlay the grid instead of consuming its permanent height")
check(workspacePanel.includes("Partial caller-visible result")
  && workspacePanel.includes("Denied:")
  && workspacePanel.includes("Hidden values have not been inferred")
  && workspacePanel.includes("No fixture was substituted"),
  "U4-FE-16 partial, denied and unavailable live reads remain explicit")
check(workspacePanel.includes("explicit zero")
  && workspacePanel.includes("inherits downstream")
  && workspacePanel.includes("role=\"Bill-to\"")
  && workspacePanel.includes("role=\"Ship-to\"")
  && workspacePanel.includes("selected Ship-to supplies the freight destination"),
  "U4-FE-17 blank/zero and freight-destination/Customer-Location meanings remain distinct")
check(workspace.includes("__U4_FIXTURE_ONLY__")
  && workspacePanel.includes("FIXTURE ONLY · isolated presentation")
  && workspacePanel.includes("trusted executor and the database writer")
  && !workspacePanel.includes("supplier_credit"),
  "U4-FE-18 fixture evidence is permanent-labelled and unavailable workflow remains honest")
check(workspacePanel.includes("+ Add delivery route")
  && workspacePanel.includes("Edit delivery route")
  && workspacePanel.includes("New route in Pricing Group")
  && workspacePanel.includes("Delivery routes inside one Pricing Group share its price")
  && workspace.includes("FIX-SHIP-9302"),
  "U4-FE-19 Location 1 can be completed and Location 2 added beneath the same Pricing Group")
check(workspacePanel.includes("item.status === \"active\" && item.bill_to_eligible === true")
  && workspacePanel.includes("item.status === \"active\" && item.ship_to_eligible === true")
  && workspacePanel.includes("Bill-to Location")
  && workspacePanel.includes("Ship-to Location"),
  "U4-FE-20 Bill-to and Ship-to choices are separate and limited to active eligible Locations")
check(workspacePanel.includes("disabled={!batch.caller_holds_lock || busy}")
  && workspacePanel.includes("Editing requires the active governed Batch lock")
  && workspacePanel.includes("expected_content_version: group.content_version"),
  "U4-FE-21 route writes are lock-gated and freight-basis selection carries its CAS version")
check(workspacePanel.includes("fixtureMutation")
  && workspacePanel.includes("Fixture-only change saved in memory")
  && workspace.includes("caller_holds_lock: true")
  && workspacePanel.includes("no governed record was written"),
  "U4-FE-22 fixture route interaction is isolated in memory and never presented as governed persistence")
check(pricingState.includes("durableBatch")
  && batchEntry.includes("key={durableBatch?.id || \"unbound\"}")
  && costingBridge.includes("const startNewBatch=()=>setNewBatchDialogOpen(true)")
  && costingBridge.includes("const completeNewBatchStart=(governedBatch=null)=>")
  && costingBridge.includes("profileValue('waste_cbb_pct',5)")
  && costingBridge.includes("interest:governedBatch?null:0.5"),
  "U4-FE-23 one durable Batch binding joins the header, grid reset and workspace without clearing on the first click")
check(newBatchPanel.includes('apiFetch("/batches/create-options")')
  && newBatchPanel.includes('runMutation("/batches"')
  && newBatchPanel.includes("family_id: Number(familyId)")
  && newBatchPanel.includes("plant_id: Number(plantId)")
  && newBatchPanel.includes("sector_id: Number(sectorId)")
  && newBatchPanel.includes("const ready = state.status === \"ready\" && familyId && plantId && sectorId")
  && !newBatchPanel.includes(".table("),
  "U4-FE-24 governed creation uses caller-scoped options and the existing Batch RPC wrapper only")
check(newBatchPanel.includes("Find Customer Family or member Customer")
  && newBatchPanel.includes("member.display_name")
  && newBatchPanel.includes("member.customer_code")
  && newBatchPanel.includes("make-quote authority")
  && newBatchPanel.includes("Sector classification is denied")
  && newBatchPanel.includes("availableSectors")
  && newBatchPanel.includes("first attached Sector is suggested")
  && newBatchPanel.includes("guidance and inheritance follow the selected Sector only"),
  "U4-FE-25 creation presents exact Family/member/Plant identity and restricts the Batch to one attached Sector")
check(workspacePanel.includes("Customer Family Sectors")
  && workspacePanel.includes("This Batch uses one only")
  && workspacePanel.includes("BATCH SECTOR")
  && workspace.includes("sector_ids: [\"fixture-sector-9301\", \"fixture-sector-9302\"]"),
  "U4-FE-29 workspace separates the Family's multiple Sectors from its one selected Batch Sector")
check(workspace.includes("/lock/heartbeat")
  && workspace.includes("window.setInterval(heartbeat, 60_000)")
  && workspace.includes("/lock/release")
  && workspacePanel.includes("/lock/acquire")
  && workspacePanel.includes("Acquire edit lock"),
  "U4-FE-26 an open durable Batch keeps, releases and can reacquire its governed edit lock")
check(newBatchPanel.indexOf("if (fixtureOnly) {") < newBatchPanel.indexOf('runMutation("/batches"')
  && newBatchPanel.includes("Create fixture Batch in memory")
  && newBatchPanel.includes("no authoritative read or write")
  && workspace.includes("FIXTURE/NOT-ALLOCATED/U4/NEW")
  && workspace.includes("default groups and lock are ready to inspect"),
  "U4-FE-27 fixture creation is permanently labelled, in-memory and separated before the live mutation path")
check(app.includes("<AppStateProvider>")
  && app.includes("<PricingBasisScreen fixtureOnly")
  && workspace.includes("fixtureWorkspace={batch}")
  && workspace.includes("+ New fixture Batch"),
  "U4-FE-28 the development illustration has the same state context and exposes its newly created default groups")
check(workspacePanel.includes('runMutation(`/batches/${batch.id}/profile`')
  && workspacePanel.includes("expected_content_version: contentVersion")
  && workspacePanel.includes("Blank inherits; 0 is an explicit override")
  && workspacePanel.includes("Create profile revision"),
  "U4-FE-34 Batch Profile revision preserves blank/zero semantics and uses only the governed backend route")
check(workspacePanel.includes('runMutation(`/batches/${batch.id}/sets`')
  && workspacePanel.includes('runMutation(`/batches/${batch.id}/sets/${setItem.id}/memberships`')
  && workspacePanel.includes("database-derived")
  && workspacePanel.includes("This SET remains dissolved")
  && workspace.includes("FIX-SET-9301"),
  "U4-FE-35 SET identity, membership and active/dissolved state are explicit on the fixture surface")
const canonicalNavigation = [
  "Start Costing", "Batch Builder", "My Batches", "Approval Inbox", "Quotes",
  "Customer Families", "Customers and Prospects", "Construction Library", "Plant Construction Adoption",
  "SKUs", "Commercial Policies", "Rate Masters", "Freight Masters", "Pricing Basis Releases",
  "Plant Configuration", "Users & Access", "Producing Plants", "Audit History",
];
check(["Workspace", "Customer Masters", "Product Masters", "Commercial Masters", "Plant Capabilities",
  "Administration"].every(section => sidebar.includes(`["${section}"`))
  && canonicalNavigation.every(label => sidebar.includes(`"${label}"`))
  && sidebar.includes('"Governed evidence, working items and Quote History"')
  && sidebar.includes("if (entry.pending)")
  && !sidebar.includes('setTab("workflow")'),
  "U4-FE-36 canonical navigation names every planned destination while routing only implemented screens")
check(sidebar.includes("openSections")
  && sidebar.includes('aria-expanded={openSections.has(section)}')
  && sidebar.includes('new Set([activeSection || "Workspace"])')
  && sidebar.includes('detail === "Future" ? "Future"')
  && sidebar.includes('detail.includes("Backend activation") ? "Activation"')
  && sidebar.includes("sidebar-nav-count")
  && appCss.includes(".sidebar-shell")
  && appCss.includes(".sidebar-nav-section.is-current")
  && appCss.includes(".sidebar-nav-pending small"),
  "U4-FE-36a navigation uses a compact active-section accordion and restrained status tags")
const productMastersMenu = sidebar.slice(
  sidebar.indexOf('["Product Masters"'), sidebar.indexOf('["Commercial Masters"'));
check(productMastersMenu.includes(':[pending("CL","Construction Library"')
  && productMastersMenu.includes('pending("PA","Plant Construction Adoption"')
  && productMastersMenu.includes('pending("SK","SKUs"')
  && productMastersMenu.includes('Versions, specifications and Location applicability included')
  && !productMastersMenu.includes('pending("SV","SKU Versions"')
  && !productMastersMenu.includes('pending("SL","SKU–Location Applicability"')
  && !productMastersMenu.includes('pending("SR","Specification Reference"')
  && sidebar.includes('detail === "Capability required" ? "Restricted"'),
  "U4-FE-36b Product Masters remains visible and SKU functions do not become redundant destinations")
check(sidebar.includes('pending("CP","Customers and Prospects","Locations and External References included")')
  && !sidebar.includes('pending("CL","Customer Locations"')
  && !sidebar.includes('pending("ER","External References"')
  && sidebar.includes('item("defaults","CP","Commercial Policies"')
  && sidebar.includes('Sectors, Calculation Defaults and Annual Interest Basis')
  && sidebar.includes('pending("PC","Plant Configuration"')
  && sidebar.includes('Flute Profiles, Machines, Stations and Process Routes included')
  && sidebar.includes('item("users","UA","Users & Access"')
  && sidebar.includes('Users, Plant Assignments, Capabilities, Invitations and Orphan Recovery'),
  "U4-FE-36c task-oriented consolidation preserves Customer hierarchy and governed subfunctions")
check(workspacePanel.includes("waste_override_pct")
  && workspacePanel.includes("margin_override_pct")
  && workspacePanel.includes("conv_override_rate")
  && workspacePanel.includes("freight_override")
  && workspacePanel.includes("Blank continues the ladder; zero stops it")
  && workspacePanel.includes("Resolve values & freshness")
  && workspacePanel.includes('/rows/${row.id}/effective-inputs')
  && workspacePanel.includes("No persisted governed calculation")
  && workspacePanel.includes("Fresh · calculation and presentation match")
  && workspacePanel.includes("Calculation fresh · presentation changed")
  && workspacePanel.includes("Calculation stale · recalculate before Send")
  && workspacePanel.includes("Freshness unavailable · calculation evidence denied")
  && workspacePanel.includes("Supplier-credit terms are not Batch Calculate inputs")
  && !workspacePanel.includes(".rpc(")
  && !workspacePanel.includes(".table("),
  "U4-FE-37 row overrides, governed effective sources and all freshness states stay behind backend routes")
check(workspacePanel.includes("Preparation and readiness")
  && workspacePanel.includes("Durable structure, local preview and governed evidence are reported separately")
  && workspacePanel.includes("Atomic Send creates one immutable, unnumbered draft candidate")
  && workspacePanel.includes("durableRowSpecificationEvidence")
  && workspacePanel.includes("BCT and ECT are preserved specification references")
  && appCss.includes(".batch-workspace-preparation-grid")
  && appCss.includes(".batch-workspace-spec-evidence"),
  "U4-FE-37a readiness and supported specification checks remain concise and commercially honest")
check(workspace.includes('freshness: "not_calculated"')
  && workspace.includes('freshness: "calculation_stale"')
  && workspace.includes('waste: { value: 0, source: "row" }')
  && !workspace.includes("supplier_credit"),
  "U4-FE-38 fixture evidence distinguishes not-calculated, stale and explicit zero without supplier-credit inputs")

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
console.log("pricing-basis frontend fixtures PASS");
