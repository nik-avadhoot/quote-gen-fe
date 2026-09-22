// U2 SKU Master frontend fixture gate (Canonical Amendment 02).
//
// Run: npm run test:sku-master
//
// Proves the field registry keeps CDM-43 exactly (the quote and costing fields
// in SPEC sheet groups and order, the production backlog listed apart, Partition
// and Plate retired), that every field renders through one honest rule (blank
// vs zero, hidden vs unavailable vs migration pending), that SKU Sets come from
// governed membership with a quantity per member (CDM-44), that the split view
// is clamped, that the destination is flag- and capability-gated at both the nav
// entry and the mount, and that every write lives behind a named governed control.
//
// U2-SKU-FE-88+ guard the CDM-45 PRICING PORTFOLIO: a closed, mandatory
// vocabulary that is RECORDED ONLY - shown and filterable, and reaching no
// pricing decision at all until an approved rate mechanism consumes it. It has
// no edit affordance, because the SKU Master has no governed write path.
//
// U2-SKU-FE-67+ guard the ONE SEARCH BOX: it covers the seven identity factors
// and nothing else, words narrow rather than widen, the screen says which
// factors were actually reached, and an empty answer distinguishes "nothing
// matched" from "nothing is visible to you".
import fs from "node:fs";
import {
  NOT_VISIBLE, PANEL_FOCUS, PENDING, SPEC_FIELD_KEYS, SPLIT_DEFAULT, UNAVAILABLE, adoptionLabel, applicabilityLocationLabel,
  canOpenSkuMaster, clampSplit, constructionLabel, customerLabel, dimensionSummary, familyLabel, formatMeasure,
  gridCellText, latestVersionFacts, normaliseSkuCatalogue, panelLayout, plantItemCodeLabel, qtyPerSetText, replacementLabel,
  PRICING_PORTFOLIO_NOTE, SEARCH_FIELD_LABELS, SKU_SEARCH_FIELDS, SKU_SEARCH_MAX_TERMS,
  schemaPendingNotice, searchCoverageNotice,
  searchScanNotice, searchScopeHint, skuCatalogueQuery, skuEmptyState, skuPlantScope,
  skuSearchTerms, skuSearchValidation, skuSetGroups, skuSetView,
  specFieldCell, specRowFromCatalogue, specRowFromDetail, specificationRows, unrecordedFieldsNotice, visibilityText,
} from "../src/lib/skuMasterModel.js";
import { SKU_FIXTURE_DETAILS, fixtureSkuCatalogue } from "../src/lib/skuMasterFixture.js";
import {
  SKU_APPLICABILITY_PENDING, SKU_EDIT_FIELDS, SKU_FIELD_CLASS, SKU_OPS_FIXTURE, SKU_OPS_PENDING, SKU_OP_CONFIRM,
  SKU_SET_PENDING,
  buildFieldChanges, fieldEditability, parseFieldInput, replacementCandidates, skuApplicabilityMode,
  skuLifecycleActions, skuOpsAuthority, skuOpsMode, skuProposalPlants, skuSetMode,
  versionChangeVerdict, versionEditPlan, versionFieldValues,
} from "../src/lib/skuGovernedOps.js";
import {
  COLUMN_FILTERS, FILTERABLE_COLUMN_COUNT, columnFilterAvailability, columnFilterParam, columnFilterScanNotice,
  columnFilterSummary, columnFilterValidation, fixtureCellMatches, sharedFilterFromState, sharedStateFromFilter,
} from "../src/lib/skuColumnFilters.js";
import {
  PRICING_PORTFOLIOS, PRINT_TECHNOLOGIES, PRODUCTION_BACKLOG, PRODUCTION_BACKLOG_COUNT,
  SKU_SPEC_FIELD_COUNT, SKU_SPEC_GROUPS,
} from "../src/lib/skuSpecRegistry.js";

let passes = 0;
const failures = [];
const check = (condition, label) => {
  if (condition) { passes += 1; console.log(`ok   - ${label}`); }
  else { failures.push(label); console.log(`FAIL - ${label}`); }
};
const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");

// ─────────────────────────────────────────────────────────── scope and access
const maker = { plant_capabilities: { NAG: ["make_quote", "plant_access"], PUN: ["make_quote"] },
  group_capabilities: ["read_party_master"] };
check(JSON.stringify(skuPlantScope(maker)) === JSON.stringify(["NAG"]),
  "U2-SKU-FE-1 catalogue scope is plant_access plants only; make_quote does not widen it");
check(canOpenSkuMaster(maker) && !canOpenSkuMaster({ plant_capabilities: { NAG: ["make_quote"] },
  group_capabilities: ["read_party_master", "administer_users"] }) && !canOpenSkuMaster(null),
  "U2-SKU-FE-2 a group capability or a missing profile never opens the SKU Master");

// ─────────────────────────────────────────────────────────────── query shape
check(skuCatalogueQuery({}) === "/masters/skus"
  && skuCatalogueQuery({ plant: "NAG", status: "", q: "  IT_0 ", familyId: 202, partyId: "" })
    === "/masters/skus?plant=NAG&q=IT_0&family_id=202",
  "U2-SKU-FE-3 only filters with values reach the server query, trimmed");
check(skuSearchValidation("NAG-IT/0001") === null && skuSearchValidation("50%") !== null
  && skuSearchValidation("a,b") !== null && skuSearchValidation("A".repeat(61)) !== null,
  "U2-SKU-FE-4 search is validated with the same character and length rule as the route");

// ──────────────────────────────────────────────────────────── blank vs zero
check(formatMeasure(0, " mm") === "0 mm" && formatMeasure("0.00") === "0"
  && formatMeasure(null) === "Not recorded" && formatMeasure(undefined) === "Not recorded"
  && formatMeasure("") === "Not recorded",
  "U2-SKU-FE-5 an explicit zero renders 0 and a missing value renders Not recorded");
check(dimensionSummary({ length_mm: 300, width_mm: 200, height_mm: null }) === "L 300 × W 200 × H — mm"
  && dimensionSummary({ length_mm: 250, width_mm: 150, height_mm: 0 }) === "L 250 × W 150 × H 0 mm"
  && dimensionSummary({}) === "Dimensions not recorded" && dimensionSummary(null) === "No version recorded",
  "U2-SKU-FE-6 dimension summaries keep blank and zero distinct");
const spec = Object.fromEntries(specificationRows({ length_mm: 300, height_mm: 0, spec_bs: null,
  spec_bct: 0, ups: 2, box_type: "RSC" }));
check(spec.Height === "0 mm" && spec.BS === "Not recorded" && spec.BCT === "0" && spec.ECT === "Not recorded"
  && spec.Ups === "2" && spec["Box type"] === "RSC",
  "U2-SKU-FE-7 specification rows preserve explicit zero and missing values exactly");

// ─────────────────────────────────────────────────── visibility, never guesses
check(visibilityText("visible") === null && visibilityText("not_visible_to_caller") === NOT_VISIBLE
  && visibilityText("unavailable") === UNAVAILABLE && visibilityText(undefined) === UNAVAILABLE
  && visibilityText("schema_pending") === PENDING,
  "U2-SKU-FE-8 hidden, failed and pending reads have distinct honest wording; an unknown state is unavailable");
const customer = { customer_code: null, display_name: "Prospect Ltd" };
check(customerLabel(customer, "visible") === "No Customer Code · Prospect Ltd"
  && customerLabel(null, "visible") === UNAVAILABLE
  && customerLabel(customer, "not_visible_to_caller") === NOT_VISIBLE
  && customerLabel(customer, "unavailable") === UNAVAILABLE,
  "U2-SKU-FE-9 customer identity is shown only when visible, and a missing row is never blank");
check(familyLabel(null, "visible") === "No current Family" && familyLabel({ name: "F", group_customer_code: "FAM-1" },
  "visible") === "FAM-1 · F" && familyLabel({ name: "F" }, "not_visible_to_caller") === NOT_VISIBLE,
  "U2-SKU-FE-10 the Family label follows the same visibility rule");
check(constructionLabel({ construction_version_id: 42, construction: null }, "not_visible_to_caller")
  === `Construction version #42 · ${NOT_VISIBLE}`
  && constructionLabel({ construction_version_id: 42, construction: null }, "visible")
  === `Construction version #42 · ${UNAVAILABLE}`
  && constructionLabel({ construction: { construction_code: "CON-1", version_no: 2, ply: 5, flute_f1: "B",
    flute_f2: null, board_gsm: 0 } }, "visible") === "CON-1 v2 · 5-ply · F1 B · board 0 gsm",
  "U2-SKU-FE-11 an unreadable Construction keeps its exact version identity with a reason, never a substitute");
check(adoptionLabel({ plant_adoption: null }, "visible") === "Plant adoption unavailable"
  && adoptionLabel({ plant_adoption: [] }, "unavailable") === "Plant adoption unavailable"
  && adoptionLabel({ plant_adoption: [] }, "visible") === "Not adopted at this SKU's plant"
  && adoptionLabel({ plant_adoption: ["adopted"] }, "visible") === "Adopted at this SKU's plant",
  "U2-SKU-FE-12 a failed adoption read never reads as 'not adopted'");
check(applicabilityLocationLabel({ location_id: 602, location: null }, "not_visible_to_caller")
  === `Location #602 · ${NOT_VISIBLE}`
  && applicabilityLocationLabel({ location_id: 601, location: { location_code: "LOC-601" } }, "visible") === "LOC-601",
  "U2-SKU-FE-13 Location applicability names the Location only when it was read");
check(replacementLabel({}, null) === null
  && replacementLabel({ replaced_by: { plant_item_code: "NAG-1" } }, 101) === "Replaced by NAG-1"
  && replacementLabel({ replaced_by: null, replacement_visible: false }, 999) === `Replacement recorded · ${NOT_VISIBLE}`,
  "U2-SKU-FE-14 replacement lineage is linked, never silently substituted or hidden");
check(plantItemCodeLabel(null) === "Plant Item Code not assigned" && plantItemCodeLabel("NAG-1") === "NAG-1",
  "U2-SKU-FE-15 an unassigned Plant Item Code is stated, never a manufactured placeholder code");
check(unrecordedFieldsNotice(["printing_technology", "number_of_colours"])
  === "Printing Technology and Number of colours are not yet recorded on governed SKU versions."
  && unrecordedFieldsNotice([]) === null,
  "U2-SKU-FE-16 the unrecorded-fields wording stays available for responses that declare it");
const normal = normaliseSkuCatalogue({});
check(normal.skus.length === 0 && normal.truncated === false && normal.customerVisibility === "unavailable"
  && JSON.stringify(normal.schemaPending) === "{}",
  "U2-SKU-FE-17 a response without visibility is treated as unavailable, not visible");
check(latestVersionFacts({ latest_version: null }).join() === "No versions"
  && latestVersionFacts({ version_count: 2, latest_version: { version_no: 2, approved: false,
    length_mm: 1, width_mm: 2, height_mm: 0, box_type: "RSC" } }).join(" · ")
    === "v2 of 2 · unapproved · L 1 × W 2 × H 0 mm · RSC",
  "U2-SKU-FE-18 catalogue rows summarise the latest immutable version honestly");

// ───────────────────────────────────────────────────────────────── fixtures
const fixtureRows = fixtureSkuCatalogue().skus;
const allFixtureCodes = [
  ...fixtureRows.map(row => row.plant_item_code).filter(Boolean),
  ...Object.values(SKU_FIXTURE_DETAILS).flatMap(d => [d.sku.plant_item_code,
    ...d.lineage.replaces.map(r => r.plant_item_code), ...(d.sets || []).map(s => s.label)]).filter(Boolean),
];
check(allFixtureCodes.length > 0 && allFixtureCodes.every(code => code.includes("__U2_FIXTURE_ONLY__")),
  "U2-SKU-FE-19 every fixture SKU and SKU Set code is marked __U2_FIXTURE_ONLY__");
check(fixtureSkuCatalogue({ plant: "NAG", status: "active" }).skus.map(r => r.id).join() === "9101"
  && fixtureSkuCatalogue({ q: "pun/" }).skus.map(r => r.id).join() === "9201"
  && fixtureSkuCatalogue({ familyId: "202" }).skus.every(r => r.family?.id === 202),
  "U2-SKU-FE-20 the fixture catalogue applies the documented filters");
check(Object.values(SKU_FIXTURE_DETAILS).every(d => d.mutations === "none")
  && SKU_FIXTURE_DETAILS[9101].versions[0].specification.height_mm === 0
  && SKU_FIXTURE_DETAILS[9104].versions[0].specification.height_mm === null
  && SKU_FIXTURE_DETAILS[9103].detail_visibility.construction === "not_visible_to_caller",
  "U2-SKU-FE-21 fixture details exercise zero, blank and not-visible paths");

// ────────────────────────────────────────── CDM-43 field registry (Amendment 02)
const fields = SKU_SPEC_GROUPS.flatMap(g => g.fields);
const sheetFields = fields.filter(f => f.origin === "sheet");
check(SKU_SPEC_FIELD_COUNT === 40 && fields.length === 40 && sheetFields.length === 36
  && fields.filter(f => f.origin === "new").map(f => f.key).join() === "PT,NC"
  && fields.filter(f => f.origin === "app").map(f => f.key).join() === "LC,PF",
  "U2-SKU-FE-22 SKU Master holds 40 fields: 36 SPEC columns, Print Technology, Number of Colours, the app lifecycle and the pricing portfolio");
check(SKU_SPEC_GROUPS.map(g => g.label).join(" | ")
  === "Identity & Linking | STD Carton Specification | STD Internal Dimensions | STD Board & Paper Composition | Conversion · Deckle · Sheet Sizing | Status & Governance",
  "U2-SKU-FE-23 fields keep the SPEC sheet groups in sheet order");
check(SKU_SPEC_GROUPS.every(g => g.fields.every((f, i) => i === 0 || f.order > g.fields[i - 1].order)),
  "U2-SKU-FE-24 fields keep sheet order inside each group");
check(fields.map(f => f.key).join() === "A,B,C,D,E,F,G,H,I,J,K,L,N,PT,NC,O,AA,AE,AF,AG,AI,AJ,AK,AL,AM,AN,AO,AP,AQ,AR,AS,AT,AU,AV,AW,BH,LC,PF,DX,DZ",
  "U2-SKU-FE-25 the stored field list is exactly the ruled quote and costing set, Cobb included");
const backlogSheets = PRODUCTION_BACKLOG.flatMap(g => g.columns.map(c => c.sheet));
check(PRODUCTION_BACKLOG_COUNT === 94 && backlogSheets.length === 94
  && !backlogSheets.some(s => sheetFields.some(f => f.sheet === s)),
  "U2-SKU-FE-26 the other 94 SPEC columns are a separate production backlog with no overlap");
const retired = /^(C[P-Z]|D[A-U])$/;
check(!backlogSheets.some(s => retired.test(s)) && !sheetFields.some(f => retired.test(f.sheet)),
  "U2-SKU-FE-27 Partition (CP–DF) and Plate (DG–DU) columns appear in neither list");
check(["IZ", "DY", "EA"].every(s => PRODUCTION_BACKLOG.flatMap(g => g.columns).find(c => c.sheet === s)?.note),
  "U2-SKU-FE-28 superseded columns (Pc per set, Item Status, Discontinued Date) say what replaced them");
check(JSON.stringify(PRINT_TECHNOLOGIES) === JSON.stringify(["Flexo", "CMYK", "Offset", "Unprinted"]),
  "U2-SKU-FE-29 the Print Technology vocabulary is exactly Flexo / CMYK / Offset / Unprinted");
check([...SPEC_FIELD_KEYS].sort().join() === fields.map(f => f.key).sort().join(),
  "U2-SKU-FE-30 every registry field has exactly one renderer, and no renderer lacks a field");
check(fields.filter(f => f.authority === "construction").map(f => f.key).join() === "I,J,K,L,AI,AJ,AK,AL,AM,AN,AO,AP,AQ,AR",
  "U2-SKU-FE-31 ply, flutes and board layers are marked as Construction authority (CDM-13)");

// ─────────────────────────────────────────────────────────── field cells
const box = specRowFromDetail(SKU_FIXTURE_DETAILS[9101]);
const boxCtx = { visibility: SKU_FIXTURE_DETAILS[9101].detail_visibility, schemaPending: SKU_FIXTURE_DETAILS[9101].schema_pending };
const cellOf = (key, row = box, ctx = boxCtx) => specFieldCell(key, row, ctx);
check(cellOf("PT").text === "Flexo" && cellOf("NC").text === "1" && cellOf("AA").state === "na" && cellOf("AT").text === "0.3",
  "U2-SKU-FE-32 stored printing, Cobb and weight fields render from the latest version");
const plate = specRowFromDetail(SKU_FIXTURE_DETAILS[9104]);
check(specFieldCell("NC", plate, boxCtx).text === "0" && specFieldCell("AT", plate, boxCtx).text === "0"
  && specFieldCell("AG", plate, boxCtx).state === "blank" && specFieldCell("N", plate, boxCtx).text === "Not recorded",
  "U2-SKU-FE-33 zero colours and zero weight render 0 while a missing height or print quality reads Not recorded");
check(cellOf("J").text === "C" && cellOf("I").text === "3" && cellOf("AJ").text === "150" && cellOf("AO").state === "blank",
  "U2-SKU-FE-34 Construction ply, flute type and layers render from the Construction version, blank layers stay blank");
const hiddenCon = specRowFromDetail(SKU_FIXTURE_DETAILS[9103]);
const hiddenCtx = { visibility: SKU_FIXTURE_DETAILS[9103].detail_visibility, schemaPending: {} };
check(specFieldCell("I", hiddenCon, hiddenCtx).state === "hidden" && specFieldCell("AI", hiddenCon, hiddenCtx).text === NOT_VISIBLE
  && specFieldCell("I", { ...box, construction: null }, boxCtx).text === `Construction version #41 · ${UNAVAILABLE}`,
  "U2-SKU-FE-35 Construction fields say not visible or unavailable, never a guessed value");
check(cellOf("B", box, { visibility: {}, schemaPending: { quote_fields: true } }).text === PENDING
  && specFieldCell("PT", { ...box, version: { ...box.version, quote_fields: null } }, boxCtx).state === "pending"
  && gridCellText(cellOf("B", box, { schemaPending: { quote_fields: true } })) === "pending",
  "U2-SKU-FE-36 a field whose storage is not activated reads pending, never Not recorded");
check(cellOf("F").text === "FIX-CIC-778" && cellOf("DZ").text === "FIX-011145"
  && cellOf("A").text === `FIX-LOC-601, Location #602`
  && specFieldCell("A", hiddenCon, hiddenCtx).text === `Location #603 · ${NOT_VISIBLE}`,
  "U2-SKU-FE-37 active references and Location applicability render; withdrawn references and unreadable codes do not pretend");
check(cellOf("LC").text === "active" && cellOf("D").text === "__U2_FIXTURE_ONLY__/NAG/0001"
  && specFieldCell("D", specRowFromDetail(SKU_FIXTURE_DETAILS[9102]), boxCtx).text === "Plant Item Code not assigned"
  && specFieldCell("AE", specRowFromDetail(SKU_FIXTURE_DETAILS[9102]), boxCtx).text === "No SKU version",
  "U2-SKU-FE-38 lifecycle, Plant Item Code and a SKU without versions render honestly");
const catRow = specRowFromCatalogue(fixtureRows.find(r => r.id === 9101));
check(["B", "PT", "AE", "I", "AJ", "BH", "DX", "DZ", "A"].every(k =>
  specFieldCell(k, catRow, { visibility: fixtureSkuCatalogue().detail_visibility }).text
  === specFieldCell(k, box, boxCtx).text),
  "U2-SKU-FE-39 a catalogue row and its detail render every shared field identically");
check(schemaPendingNotice({ quote_fields: true, sku_sets: true }).includes("SKU Sets") && schemaPendingNotice({}) === null,
  "U2-SKU-FE-40 the pending notice names what is not stored yet, and is absent when nothing is pending");

// ──────────────────────────────────────────────────────── CDM-44 SKU Sets
const view = skuSetView(SKU_FIXTURE_DETAILS[9104].sets, 9104);
check(view.length === 1 && view[0].role === "Plate" && view[0].qty === "× 2"
  && view[0].members.map(m => m.role).join() === "Box,Plate,Partition"
  && view[0].members.find(m => m.isCurrent).skuId === 9104,
  "U2-SKU-FE-41 a SKU shows its set, its own role and quantity per set, and every member in role order");
check(qtyPerSetText(1.5) === "× 1.5" && qtyPerSetText(null) === "quantity per set not recorded"
  && skuSetView([{ id: 1, label: "S", members: [{ sku_id: 7, sku_visible: false, role: "plate", qty_per_set: 1 }] }], 1)[0]
    .members[0].code === `SKU #7 · ${NOT_VISIBLE}`,
  "U2-SKU-FE-42 quantity per set keeps blank apart, and a member the caller cannot read is not named");
const groups = skuSetGroups(fixtureRows.map(specRowFromCatalogue).concat([{ id: 1, sets: null }]));
check(groups.map(g => g.label).join(" | ").startsWith("SKU Set __U2_FIXTURE_ONLY__/NAG/0001 · confirmed")
  && groups.find(g => g.key === "set-51").rows.map(r => r.id).join() === "9101,9104,9105"
  && groups.some(g => g.label === "Not in a SKU Set") && groups.some(g => g.label === "SKU Set membership unavailable"),
  "U2-SKU-FE-43 grid grouping uses governed membership, with honest headings for no set and unavailable sets");

// ─────────────────────────────────────────────────────────────── split view
check(SPLIT_DEFAULT === 50 && clampSplit(10) === 25 && clampSplit(90) === 75 && clampSplit(61.6) === 62
  && clampSplit("x") === 50,
  "U2-SKU-FE-44 the split opens at 50 : 50 and stays between 25 % and 75 %");

// ───────────────────────────────────────────────────────────── panel focus
const both = panelLayout(62, null);
const listFocus = panelLayout(62, "list");
const detailFocus = panelLayout(62, "detail");
check(both.showList && both.showDetail && both.showDivider && both.listWidth === "calc(62% - 3.5px)"
  && panelLayout(90, null).listWidth === "calc(75% - 3.5px)",
  "U2-SKU-FE-55 without focus both panels and the divider show at the clamped split");
check(listFocus.showList && !listFocus.showDetail && !listFocus.showDivider && listFocus.listWidth === "100%"
  && !detailFocus.showList && detailFocus.showDetail && !detailFocus.showDivider,
  "U2-SKU-FE-56 focusing a panel fills the area with it and hides the other panel and the divider");
check(PANEL_FOCUS.join() === "list,detail",
  "U2-SKU-FE-57 exactly the list and the detail panel can take focus");

// ──────────────────────────────────────────────────── gating and read-only
const screen = read("../src/tabs/SkuMasterScreen.jsx");
const actionsUi = read("../src/tabs/sku/SkuGovernedActions.jsx");
const sidebar = read("../src/ui/Sidebar.jsx");
const shell = read("../src/QuotationApp.jsx");
const app = read("../src/App.jsx");
const flags = read("../src/lib/featureFlags.js");
const icons = read("../src/ui/icons.jsx");
const standards = read("../src/ui/screenStandards.js");
const chrome = read("../src/ui/screenChrome.jsx");
check(sidebar.includes('isFeatureEnabled("u2_sku_master")&&canOpenSkuMaster(profile)')
  && shell.includes('tab==="skus"&&isFeatureEnabled("u2_sku_master")&&canOpenSkuMaster(profile)&&<SkuMasterScreen/>'),
  "U2-SKU-FE-45 the same flag and capability gate the nav entry and the mount");
// Stale since the 2026-09-18 localhost/Vercel parity ruling and repaired on
// 2026-09-22: there is no DEV_DEFAULTS branch any more. BUILD_DEFAULTS is the
// one set applied to EVERY build, and production adds only limited_beta — so
// the claim under test is now that the destination ships everywhere and that
// production adds nothing else behind it.
check(flags.includes('"u2_sku_master"') && /const BUILD_DEFAULTS = \[/.test(flags)
  && /const PRODUCTION_DEFAULTS = \["limited_beta"\]/.test(flags)
  && !flags.includes("DEV_DEFAULTS"),
  "U2-SKU-FE-46 the destination is in the one build set; production adds only limited_beta");
check(app.includes("import.meta.env.DEV && fixtureIllustration === \"u2-skus\"") && app.includes("<SkuMasterScreen fixtureOnly"),
  "U2-SKU-FE-47 the fixture preview exists only in a development build without a signed-in profile");
const apiCalls = screen.match(/apiFetch\(([^)]*)\)/g) || [];
check(apiCalls.length === 2 && apiCalls.every(call => !call.includes("method"))
  && !/runMutation|method:\s*"(POST|PATCH|PUT|DELETE)"/.test(screen),
  "U2-SKU-FE-48 the screen itself issues exactly two GET reads; every governed write lives in SkuGovernedActions (Amendment 04)");
check(actionsUi.includes("SkuSetControls") && actionsUi.includes("/masters/sku-sets")
  && actionsUi.includes("internal SKU identity")
  && actionsUi.includes("SkuApplicabilityControls")
  && actionsUi.includes("Quote-specific batch_only rows remain read-only here.")
  && actionsUi.includes("/location-applicabilities"),
  "U2-SKU-FE-49 SKU Set and master-applicability writes are named governed controls; batch_only remains read-only here");
check(screen.indexOf("if (fixtureOnly)") !== -1 && screen.indexOf("if (fixtureOnly)") < screen.indexOf("apiFetch(query)")
  && screen.includes("U2 · FIXTURE ONLY"),
  "U2-SKU-FE-50 fixture mode is labelled and short-circuits before any request");
check(screen.includes('<ProvenanceTag kind="governed" />') && screen.includes('<ProvenanceTag kind="local" />')
  && !/printingTechnology|printing_technology|numberOfColours/.test(screen),
  "U2-SKU-FE-51 governed data is distinguished from local data, and local printing metadata is never borrowed");
check(screen.includes('verdict.kind === "access-denied"') && screen.includes("AccessDeniedState")
  && screen.includes("resp.status === 404"),
  "U2-SKU-FE-52 a denial renders as access denied and an invisible SKU as not visible, never as an empty list");
check(screen.includes('<PanelDivider label="Resize SKU list and SKU detail"') && screen.includes("onPointerDown={startDrag}")
  && screen.includes("onReset={() => setSplit(SPLIT_DEFAULT)}") && screen.includes("onKeyDown={nudgeSplit}")
  && screen.includes("useSplitPanels(SPLIT_DEFAULT)"),
  "U2-SKU-FE-53 the divider opens at 50 : 50, drags and moves by keyboard within the clamp, and resets on double-click");
check(screen.includes("SKU_SPEC_GROUPS") && screen.includes("PRODUCTION_BACKLOG") && screen.includes("specFieldCell(c.key, row, ctx)")
  && screen.includes("specFieldCell(f.key, row, ctx)"),
  "U2-SKU-FE-54 grid and deep-dive both render from the registry through the one field rule");

check(screen.includes('<PanelFocusToggle panel="list" noun="list" focused={focusPanel === "list"} onToggle={toggleFocus} />')
  && screen.includes('<PanelFocusToggle panel="detail" noun="detail" focused={focusPanel === "detail"} onToggle={toggleFocus}')
  && screen.includes("layout.showList &&") && screen.includes("layout.showDetail &&") && screen.includes("layout.showDivider &&"),
  "U2-SKU-FE-58 each panel has its own focus toggle, and focus hides the other panel and the divider");
check(screen.includes("usePanelFocus()") && standards.includes("setSidebarCollapsed(true)")
  && standards.includes("setSidebarCollapsed(sidebarBeforeFocus.current)"),
  "U2-SKU-FE-59 focus collapses the app navigation and restores it on exit and when the screen unmounts");
check(standards.includes('e.key === "Escape" && focusRef.current') && screen.includes("onKeyDown={exitFocusOnEscape}")
  && !/requestFullscreen|fullscreenElement|window\.addEventListener\("keydown"/.test(screen),
  "U2-SKU-FE-60 Escape exits focus through a screen-scoped handler; the browser Fullscreen API is never used");
check(screen.includes('disabled={selectedId == null} disabledTitle="Select a SKU first"')
  && screen.includes('focusPanel === "detail" ? 3'),
  "U2-SKU-FE-61 detail focus needs a selected SKU and spreads fields across three columns");
check(app.includes("<AppStateProvider>\n      <SkuMasterScreen fixtureOnly"),
  "U2-SKU-FE-62 the fixture preview mounts inside the app state provider like the other previews");

// ───────────────────────────────────────────── expand icons and header density
check(icons.includes("export const ExpandIcon") && icons.includes("export const CollapseIcon")
  && icons.includes('"aria-hidden": true') && icons.includes('stroke: "currentColor"'),
  "U2-SKU-FE-63 expand and collapse are decorative stroke icons that take the button colour");
check(screen.includes('<PanelFocusToggle panel="list" noun="list"')
  && screen.includes('<PanelFocusToggle panel="detail" noun="detail"')
  && chrome.includes('aria-label={focused ? `Collapse ${noun}` : `Expand ${noun}`}')
  && chrome.includes('focused ? <CollapseIcon size={14} /> : <ExpandIcon size={14} />')
  && !/>\s*(Focus list|Focus detail|Exit focus)\s*</.test(screen),
  "U2-SKU-FE-64 each panel's focus toggle is an expand / collapse icon with an accessible name, not a text button");
check(!screen.includes("<h2") && !screen.includes("<h1") && (screen.match(/role="toolbar"/g) || []).length === 2
  && screen.includes('from "../ui/screenStandards.js"') && !/const toolbar = {/.test(screen)
  && standards.includes("export const TOOLBAR_MIN_HEIGHT = 43")
  && standards.includes("minHeight: TOOLBAR_MIN_HEIGHT") && !standards.includes("minHeight: 39"),
  "U2-SKU-FE-65 no page title under the TopBar; each panel has exactly one toolbar, at the ONE shared height");
check((screen.match(/<details style=\{\{ position: "relative" \}\}>/g) || []).length === 2
  && screen.includes("Filters{moreFilters ?") && screen.includes("Columns{hiddenGroups.length ?")
  && screen.includes('aria-label="Refresh SKU list"') && screen.includes("read at ${readAt"),
  "U2-SKU-FE-66 secondary filters and column groups sit in disclosures, and the read time rides on the refresh icon");

// ──────────────────────────────── one search box over identity factors only
check(JSON.stringify(SKU_SEARCH_FIELDS) === JSON.stringify(["plant_item_code", "item_name", "item_short_name",
  "customer_item_code", "softcomp_code", "legacy_plant_item_code", "customer_name"])
  && Object.keys(SEARCH_FIELD_LABELS).length === SKU_SEARCH_FIELDS.length
  && SKU_SEARCH_FIELDS.every(f => typeof SEARCH_FIELD_LABELS[f] === "string"),
  "U2-SKU-FE-67 the box covers exactly the seven identity factors, each with a name a reader would use");
const hint = searchScopeHint();
check(SKU_SEARCH_FIELDS.every(f => hint.includes(SEARCH_FIELD_LABELS[f]))
  && /identity only/i.test(hint) && /every word must match/i.test(hint)
  && /lifecycle, plant and specification/i.test(hint),
  "U2-SKU-FE-68 the box states what it searches, that words narrow, and what it deliberately does not search");

check(JSON.stringify(skuSearchTerms("  Pernod  pernod   375 ")) === JSON.stringify(["Pernod", "375"])
  && skuSearchTerms("").length === 0 && skuSearchTerms(null).length === 0,
  "U2-SKU-FE-69 words are split and de-duplicated case-insensitively, so a repeat costs no extra read");
check(skuSearchValidation("pernod 375") === null
  && skuSearchValidation("a b c d e f") === `Search is limited to ${SKU_SEARCH_MAX_TERMS} words.`
  && skuSearchValidation("a a a a a a") === null
  && skuSearchValidation("50%") !== null && skuSearchValidation("A".repeat(61)) !== null,
  "U2-SKU-FE-70 the box enforces the route's own character, length and word rules before asking");
check(skuCatalogueQuery({ q: "  pernod 375  " }) === "/masters/skus?q=pernod+375",
  "U2-SKU-FE-71 the whole phrase goes to the server; nothing is matched in the browser");

// The server says what it reached; the screen repeats it in words.
const ALL_SEARCHED = Object.fromEntries(SKU_SEARCH_FIELDS.map(f => [f, "searched"]));
check(searchCoverageNotice({ executed: true, fields: ALL_SEARCHED }) === null
  && searchCoverageNotice({ executed: false, fields: ALL_SEARCHED }) === null
  && searchCoverageNotice(null) === null,
  "U2-SKU-FE-72 a search that reached every identity factor says nothing extra");
const degraded = searchCoverageNotice({ executed: true, fields: { ...ALL_SEARCHED,
  item_name: "schema_pending", item_short_name: "schema_pending", customer_name: "not_visible_to_caller" } });
check(degraded.includes("Item Name and Item Short Name were not searched because their storage is not activated yet")
  && degraded.includes("Customer name was not searched because you may not read the Customer master")
  && degraded.includes("A SKU matching only on those was not found here."),
  "U2-SKU-FE-73 an unreachable factor is named with its reason - the search degrades visibly, never silently");
check(searchCoverageNotice({ executed: true, fields: { ...ALL_SEARCHED, softcomp_code: "unavailable" } })
  .includes("SoftComp Code was not searched because that read did not succeed"),
  "U2-SKU-FE-74 a failed factor read is distinct from one that has no storage and one that is not visible");
check(searchScanNotice({ scan_truncated: true }).includes("partial")
  && searchScanNotice({ scan_truncated: false }) === null && searchScanNotice(null) === null,
  "U2-SKU-FE-75 reaching the scan bound is reported as a partial answer, never as a complete one");

const noScope = skuEmptyState({ plantScope: [] });
const noMatch = skuEmptyState({ plantScope: ["NAG"], search: { executed: true, terms: ["pernod", "375"], fields: ALL_SEARCHED } });
const filtered = skuEmptyState({ plantScope: ["NAG"], anyFilter: true });
const nothing = skuEmptyState({ plantScope: ["NAG"] });
check(noScope.title !== noMatch.title && noMatch.title !== filtered.title && filtered.title !== nothing.title,
  "U2-SKU-FE-76 four empty answers stay four distinct claims, never one 'no results'");
check(/no plant is in your access scope/i.test(noScope.title) && /visibility\s+limit/i.test(noScope.hint),
  "U2-SKU-FE-77 no plant access is stated as a visibility limit, not as an empty master");
check(noMatch.title.includes('"pernod" + "375"') && /visible to you/i.test(noMatch.title)
  && noMatch.hint.includes("Lifecycle, plant") && /cannot see reads the same as one that does not exist/i.test(noMatch.hint),
  "U2-SKU-FE-78 'no match' names the words, says it speaks only for what you can see, and what was not searched");
check(skuEmptyState({ plantScope: ["NAG"], search: { executed: true, terms: ["x"],
  fields: { ...ALL_SEARCHED, item_name: "schema_pending", item_short_name: "schema_pending" } } })
  .hint.includes("storage is not activated yet"),
  "U2-SKU-FE-79 an empty answer from a degraded search carries the reason, not a bare 'no match'");

check(normaliseSkuCatalogue({ search: { executed: true, terms: ["a"] } }).search.executed === true
  && normaliseSkuCatalogue({}).search === null,
  "U2-SKU-FE-80 the search report is carried through normalisation, and its absence is null");

// The fixture preview searches the same seven factors and nothing else.
const fixtureIds = q => fixtureSkuCatalogue({ q }).skus.map(r => r.id);
check(fixtureIds("__U2_FIXTURE_ONLY__/NAG/0001Q1").length === 1 && fixtureIds("PARTITION").length === 1
  && fixtureIds("FIX-CIC-778").length === 1 && fixtureIds("FIX-011145").length === 1
  && fixtureIds("Distillers Unit 1").length > 0,
  "U2-SKU-FE-81 the preview finds a SKU by code, name, Customer Item Code, SoftComp Code and Customer name");
check(JSON.stringify(fixtureIds("FIX-RET-0003")) === JSON.stringify([9103])
  && SEARCH_FIELD_LABELS.legacy_plant_item_code === "Legacy Plant Item Code"
  && searchScopeHint().includes("Legacy Plant Item Code"),
  "U2-SKU-FE-81a a retired (legacy) Plant Item Code finds its SKU, and the box says it searches it");
check(/const FROZEN = \["D", "C"\];/.test(screen)
  && screen.includes("...FROZEN.map(key => registryCols.find(c => c.key === key))")
  && screen.includes("boxShadow: c.key === FROZEN[0]"),
  "U2-SKU-FE-81b the Plant Item Code is the FIRST frozen column and leads the grid, carrying the lifecycle rail");
check(fixtureIds("RSC").length === 0 && fixtureIds("2L+2W+F").length === 0
  && fixtureIds("discontinued").length === 0 && fixtureIds("Pune").length === 0,
  "U2-SKU-FE-82 a specification, lifecycle or plant value is NOT an identity factor and matches nothing");
const wide = fixtureIds("Distillers");
const narrow = fixtureIds("Distillers 375");
check(wide.length > narrow.length && narrow.every(id => wide.includes(id)) && narrow.length > 0,
  "U2-SKU-FE-83 a second word narrows the answer to a subset - words never widen it");
check(fixtureSkuCatalogue({ q: "Distillers 375" }).search.terms.length === 2
  && fixtureSkuCatalogue({}).search === null,
  "U2-SKU-FE-84 the preview reports its own search reach in the governed response shape");

check(screen.includes('aria-label="Search SKU identity"') && !screen.includes('aria-label="Search Plant Item Code"')
  && !screen.includes('placeholder="Plant Item Code… ↵"')
  && (screen.match(/<input type="search"/g) || []).length === 1,
  "U2-SKU-FE-85 one box, named for identity - the Plant-Item-Code-only box is gone");
check(screen.includes("title={searchError || searchScopeHint()}")
  && screen.includes("searchCoverageNotice(catalogue.search)") && screen.includes("searchScanNotice(catalogue.search)")
  && screen.includes('role="status"') && screen.includes("Search reach"),
  "U2-SKU-FE-86 the screen shows the box's reach on hover and its shortfall as a visible strip");
check(screen.includes("skuEmptyState({ search: catalogue.search, anyFilter")
  && !screen.includes('title="No governed SKUs match."'),
  "U2-SKU-FE-87 the empty state comes from the one honest rule, not a fixed sentence");

// ─────────────────────────── CDM-45 pricing portfolio: recorded only (Amendment 03)
check(JSON.stringify(PRICING_PORTFOLIOS) === JSON.stringify(["Transactional", "Strategic"]),
  "U2-SKU-FE-88 the portfolio vocabulary is exactly Transactional and Strategic, and closed");
const pfField = SKU_SPEC_GROUPS.flatMap(g => g.fields).find(f => f.key === "PF");
check(pfField && pfField.origin === "app" && pfField.sheet === null
  && SKU_SPEC_GROUPS.find(g => g.id === "status").fields.some(f => f.key === "PF")
  && /no pricing rule/i.test(pfField.use),
  "U2-SKU-FE-89 it is an app-owned Status & Governance field - no SPEC column carries it - and it says it decides no price");

// Mandatory means every row has one; the model never invents or blanks it.
check(fixtureRows.every(row => PRICING_PORTFOLIOS.includes(row.pricing_portfolio)),
  "U2-SKU-FE-90 every SKU carries a portfolio - the preview has no unclassified row, because the model has no such state");
check(specRowFromCatalogue(fixtureRows[0]).pricing_portfolio === fixtureRows[0].pricing_portfolio
  && specRowFromDetail(SKU_FIXTURE_DETAILS[9101]).pricing_portfolio === "Strategic",
  "U2-SKU-FE-91 the catalogue row and the detail carry it through the same normalisation");
const pfCell = specFieldCell("PF", specRowFromCatalogue(fixtureRows[0]), { schemaPending: {} });
check(pfCell.state === "value" && pfCell.text === "Strategic",
  "U2-SKU-FE-92 a recorded portfolio renders as its exact value");
const pfPending = specFieldCell("PF", specRowFromCatalogue(fixtureRows[0]), { schemaPending: { pricing_portfolio: true } });
check(pfPending.state === "pending" && pfPending.text === PENDING,
  "U2-SKU-FE-93 unactivated storage reads as pending, never as an unclassified or blank portfolio");
check(schemaPendingNotice({ pricing_portfolio: true }).includes("the pricing portfolio"),
  "U2-SKU-FE-94 the pending notice names the portfolio among what is not activated");

// A dropdown, and never part of the one identity search box.
check(skuCatalogueQuery({ portfolio: "Strategic" }) === "/masters/skus?portfolio=Strategic"
  && skuCatalogueQuery({ q: "Strategic" }) === "/masters/skus?q=Strategic",
  "U2-SKU-FE-95 portfolio travels as its own server filter, not as a search term");
check(!SKU_SEARCH_FIELDS.includes("pricing_portfolio")
  && fixtureSkuCatalogue({ q: "Strategic" }).skus.length === 0
  && fixtureSkuCatalogue({ portfolio: "Strategic" }).skus.length === 3,
  "U2-SKU-FE-96 the identity box does NOT match a portfolio; the dropdown does");

// It creates no pricing rule, and offers no way to change it.
check(/recorded only/i.test(PRICING_PORTFOLIO_NOTE) && /no rate, margin or discount/i.test(PRICING_PORTFOLIO_NOTE),
  "U2-SKU-FE-97 the C-04 boundary is stated where the field is presented");
check(!/portfolio/i.test(read("../src/engine/costing.js")),
  "U2-SKU-FE-98 the costing engine does not read the portfolio at all");
check(screen.includes('aria-label="Pricing Portfolio"') && screen.includes("disabled={portfolioPending}"),
  "U2-SKU-FE-99 the screen filters by portfolio and disables that filter while its storage is pending");
check(!screen.includes("apiFetch(`/masters/skus`, { method")
  && actionsUi.includes("`/masters/skus/${sku.id}/pricing-portfolio`")
  && actionsUi.includes("Recorded only — no price is set from it (CDM-45).")
  && skuLifecycleActions({ id: 1, status: "active", pricing_portfolio: "Strategic" }, [], { propose: true, manage: false })
       .every(a => a.id !== "set_portfolio"),
  "U2-SKU-FE-100 the portfolio changes only through its governed operation, offered only to manage_sku_master, and sets no price (repointed for Amendment 04)");
// ──────────────────────── column-header filters (rulings 2026-09-16)
const registryKeys = SKU_SPEC_GROUPS.flatMap(g => g.fields.map(f => f.key));
check(registryKeys.every(key => COLUMN_FILTERS[key]) && Object.keys(COLUMN_FILTERS).length === registryKeys.length
  && FILTERABLE_COLUMN_COUNT === 39 && COLUMN_FILTERS.J.derived && !COLUMN_FILTERS.J.field,
  "U2-SKU-FE-101 every one of the 40 registry columns is classified: 39 filterable, Flute Type derived with its reason");
check(Object.values(COLUMN_FILTERS).filter(s => s.field).every(s =>
  (s.type === "text" && s.ops.includes("contains")) || (s.type === "number" && s.ops[0] === "between")
  || (s.type === "enum" && s.ops[0] === "in" && s.values.length > 0)),
  "U2-SKU-FE-102 operators follow the ruled types: text contains, numbers between, closed vocabularies a value list");
const filterPendingCtx = { visibility: { customer: "visible", construction: "visible", locations: "visible" },
  schemaPending: { quote_fields: true, pricing_portfolio: true } };
check(!columnFilterAvailability("B", filterPendingCtx).available && /migration pending/.test(columnFilterAvailability("B", filterPendingCtx).reason)
  && !columnFilterAvailability("DZ", filterPendingCtx).available && !columnFilterAvailability("PF", filterPendingCtx).available
  && columnFilterAvailability("AE", filterPendingCtx).available && columnFilterAvailability("D", filterPendingCtx).available,
  "U2-SKU-FE-103 a column with no storage yet offers no filter and says why; stored columns still filter");
const filterHiddenCtx = { visibility: { customer: "not_visible_to_caller", construction: "not_visible_to_caller",
  locations: "not_visible_to_caller" }, schemaPending: {} };
check(["E", "A", "I", "AJ"].every(k => !columnFilterAvailability(k, filterHiddenCtx).available
  && /Not visible to this caller/.test(columnFilterAvailability(k, filterHiddenCtx).reason))
  && columnFilterAvailability("F", filterHiddenCtx).available,
  "U2-SKU-FE-104 a column whose master the caller may not read offers no filter, never an answer RLS would falsify");
check(columnFilterValidation("AE", { op: "between", value: ["", ""] }) && columnFilterValidation("AE", { op: "between", value: ["5", "1"] })
  && columnFilterValidation("D", { op: "contains", value: "<x>" }) && columnFilterValidation("PT", { op: "in", value: ["Laser"] })
  && columnFilterValidation("AE", { op: "between", value: ["300", ""] }) === null
  && columnFilterValidation("D", { op: "blank", value: null }) === null,
  "U2-SKU-FE-105 the header refuses locally exactly what the route refuses");
check(columnFilterParam("AE", { op: "between", value: ["300", ""] }) === "length_mm:between:300,"
  && columnFilterParam("PT", { op: "in", value: ["Flexo", "CMYK"] }) === "print_technology:in:Flexo|CMYK"
  && columnFilterParam("D", { op: "blank" }) === "plant_item_code:blank"
  && skuCatalogueQuery({ columns: { AE: { op: "between", value: ["300", "400"] }, D: { op: "contains", value: "NAG" } } })
    === "/masters/skus?f=plant_item_code%3Acontains%3ANAG&f=length_mm%3Abetween%3A300%2C400",
  "U2-SKU-FE-106 filters travel to the server as f=field:op:value in registry order; nothing is filtered in the browser");
check(skuCatalogueQuery({ status: "active" }) === "/masters/skus?status=active"
  && skuCatalogueQuery({ status: "active|proposed" }) === "/masters/skus?f=status%3Ain%3Aactive%7Cproposed"
  && sharedStateFromFilter(sharedFilterFromState("active|proposed")) === "active|proposed"
  && COLUMN_FILTERS.LC.shared === "status" && COLUMN_FILTERS.PF.shared === "portfolio",
  "U2-SKU-FE-107 lifecycle and portfolio are ONE state shared by the toolbar control and the header");
check(columnFilterSummary("Length", { op: "between", value: ["300", ""] }) === "Length ≥ 300"
  && columnFilterScanNotice([{ field: "length_mm", scan_truncated: true }], () => "Length").includes("scan limit")
  && columnFilterScanNotice([{ field: "length_mm", scan_truncated: false }], () => "Length") === null
  && normaliseSkuCatalogue({ column_filters: [{ field: "x" }] }).columnFilters.length === 1,
  "U2-SKU-FE-108 a filter that reached its scan cap is reported as a partial answer, never a complete one");
check(fixtureCellMatches({ op: "blank" }, { state: "blank" }) && !fixtureCellMatches({ op: "blank" }, { state: "value", text: "0" })
  && fixtureCellMatches({ op: "between", value: ["0", "0"] }, { state: "value", text: "0" })
  && !fixtureCellMatches({ op: "not_blank" }, { state: "pending" }),
  "U2-SKU-FE-109 blank and zero stay distinct in filtering; a pending cell is not 'not blank'");
check(fixtureSkuCatalogue({ columns: { D: { op: "blank" } } }).skus.map(r => r.id).join() === "9102"
  && fixtureSkuCatalogue({ status: "active|discontinued" }).skus.every(r => r.status !== "proposed")
  && fixtureSkuCatalogue({ columns: { D: { op: "blank" } } }).column_filters[0].field === "plant_item_code",
  "U2-SKU-FE-110 the labelled preview applies the same operators and reports them like the route");
check(screen.includes("availability={key => columnFilterAvailability(key, filterCtx)}")
  && screen.includes("disabled={!available || blockedByLimit}") && screen.includes("title={!available ? reason")
  && screen.includes("<ColumnFilterMenu") && screen.includes("Matches each SKU's latest version.")
  && screen.includes("Blank is not zero") && screen.includes("Filter reach")
  && !/requestFullscreen/.test(screen),
  "U2-SKU-FE-111 every header carries a funnel that is disabled with its reason when it cannot filter, and reach is reported");
check(skuEmptyState({ plantScope: ["NAG"], anyFilter: true, columnSummaries: ["Length ≥ 300"] }).hint.includes("Length ≥ 300")
  && skuEmptyState({ plantScope: ["NAG"], anyFilter: true }).hint.includes("latest version"),
  "U2-SKU-FE-112 an empty filtered answer names the column filters and says version columns read the latest version");
check(JSON.stringify(SKU_SEARCH_FIELDS) === JSON.stringify(["plant_item_code", "item_name", "item_short_name",
  "customer_item_code", "softcomp_code", "legacy_plant_item_code", "customer_name"]),
  "U2-SKU-FE-113 the identity search box is unchanged by the header filters - still identity only");
// ──────────────────────── governed editing by due authority (Amendment 04)
const opsByClass = cls => Object.entries(SKU_FIELD_CLASS).filter(([, c]) => c === cls).map(([f]) => f).sort().join();
check(opsByClass("new_sku") === ["box_type", "construction_version_id", "height_mm", "length_mm", "spec_bct", "spec_bs", "spec_ect",
  "stated_bs", "stated_cs", "stated_ect", "stated_item_gsm", "width_mm"].join()
  && opsByClass("price_driving_version") === "cobb_value,item_weight_kg,ups"
  && opsByClass("version") === ["colour_detail", "customer_spec_version", "item_family", "item_group", "item_name",
    "item_short_name", "number_of_colours", "print_quality", "print_technology"].join()
  && SKU_EDIT_FIELDS.every(d => SKU_FIELD_CLASS[d.field]) && !SKU_EDIT_FIELDS.some(d => /plant|party|customer$/.test(d.field)),
  "U2-SKU-FE-114 the field classes mirror D2 exactly, and plant and Customer are no editable field at all");
const opsProfileAt = caps => ({ plant_capabilities: { NAG: caps } });
check(JSON.stringify(skuOpsAuthority(opsProfileAt(["plant_access", "make_quote"]), "NAG")) === JSON.stringify({ manage: false, propose: true })
  && JSON.stringify(skuOpsAuthority(opsProfileAt(["plant_access", "manage_sku_master"]), "NAG")) === JSON.stringify({ manage: true, propose: true })
  && JSON.stringify(skuOpsAuthority(opsProfileAt(["plant_access"]), "NAG")) === JSON.stringify({ manage: false, propose: false })
  && !skuOpsAuthority(opsProfileAt(["manage_sku_master"]), "PUN").manage
  && JSON.stringify(skuProposalPlants({ plant_capabilities: { NAG: ["make_quote"], PUN: ["plant_access"] } }, ["NAG", "PUN"])) === '["NAG"]',
  "U2-SKU-FE-115 authority is read at the SKU's own plant: a Maker may propose, only manage_sku_master manages (D1)");
check(skuOpsMode({ authority: { propose: false } }).state === "none"
  && skuOpsMode({ fixtureOnly: true, authority: { propose: true } }).reason === SKU_OPS_FIXTURE
  && skuOpsMode({ schemaPending: { governed_operations: true }, authority: { propose: true } }).reason === SKU_OPS_PENDING
  && skuOpsMode({ authority: { propose: true } }).state === "live" && /Schema activation pending/.test(SKU_OPS_PENDING),
  "U2-SKU-FE-116 no authority shows nothing; pending activation and the fixture show controls DISABLED with the reason (D11)");
check(skuApplicabilityMode({ authority: { manage: false } }).state === "none"
  && skuApplicabilityMode({ fixtureOnly: true, authority: { manage: true } }).reason === SKU_OPS_FIXTURE
  && skuApplicabilityMode({ schemaPending: { location_applicability_operations: true }, authority: { manage: true } }).reason === SKU_APPLICABILITY_PENDING
  && skuApplicabilityMode({ authority: { manage: true } }).state === "live",
  "U2-SKU-FE-116a only manage_sku_master receives master-applicability controls; fixture and pending modes disable them visibly");
check(skuSetMode({ authority: { manage: false } }).state === "none"
  && skuSetMode({ fixtureOnly: true, authority: { manage: true } }).reason === SKU_OPS_FIXTURE
  && skuSetMode({ schemaPending: { sku_set_operations: true }, authority: { manage: true } }).reason === SKU_SET_PENDING
  && skuSetMode({ authority: { manage: true } }).state === "live"
  && /Schema activation pending/.test(SKU_SET_PENDING),
  "U2-SKU-FE-116b only manage_sku_master receives SKU Set controls; fixture and pending modes disable them visibly");
const opsMaker = skuLifecycleActions({ id: 5, status: "proposed", plant_item_code: null, pricing_portfolio: "Strategic" },
  [{ id: 50, version_no: 1, approved: false }], { propose: true, manage: false }).map(a => a.id);
const opsNpdProposed = skuLifecycleActions({ id: 5, status: "proposed", plant_item_code: null, pricing_portfolio: "Strategic" },
  [{ id: 50, version_no: 1, approved: false }], { propose: true, manage: true });
check(opsMaker.join() === "edit_version"
  && opsNpdProposed.map(a => a.id).join() === "edit_version,approve_version,assign_code,publish,withdraw,set_portfolio"
  && opsNpdProposed.find(a => a.id === "publish").enabled === false
  && opsNpdProposed.find(a => a.id === "publish").reason === "Assign the Plant Item Code first.",
  "U2-SKU-FE-117 a Maker is offered only the draft; a manager is offered approve, code, publish (blocked with its reason), withdraw and portfolio (D1, D3)");
const opsNpdActive = skuLifecycleActions({ id: 5, status: "active", plant_item_code: "N-1", pricing_portfolio: "Strategic" },
  [{ id: 50, version_no: 1, approved: true }], { propose: true, manage: true }).map(a => a.id);
const opsNpdDisc = skuLifecycleActions({ id: 5, status: "discontinued", plant_item_code: "N-1", pricing_portfolio: "Strategic" },
  [{ id: 50, version_no: 1, approved: true }], { propose: true, manage: true });
check(opsNpdActive.join() === "edit_version,discontinue,set_portfolio" && !opsNpdActive.includes("assign_code")
  && opsNpdDisc.map(a => a.id).join() === "edit_version,reactivate,set_portfolio"
  && opsNpdDisc.find(a => a.id === "edit_version").enabled === false,
  "U2-SKU-FE-118 the lifecycle offers exactly the ruled transitions for each state; a discontinued SKU takes no version (D4)");
const opsPlan1 = versionEditPlan([{ id: 1, version_no: 1, approved: false }]);
const opsPlan2 = versionEditPlan([{ id: 1, version_no: 1, approved: true }, { id: 2, version_no: 2, approved: false }]);
const opsPlanNew = versionEditPlan([{ id: 1, version_no: 1, approved: true }]);
check(opsPlan1.mode === "edit_draft" && opsPlan2.mode === "edit_draft" && opsPlan2.base.id === 1 && opsPlanNew.mode === "new_version"
  && fieldEditability("length_mm", opsPlan1).editable && !fieldEditability("length_mm", opsPlan2).editable
  && !fieldEditability("construction_version_id", opsPlanNew).editable && fieldEditability("item_name", opsPlanNew).editable
  && /NEW SKU/.test(fieldEditability("box_type", opsPlanNew).reason),
  "U2-SKU-FE-119 a never-approved first draft edits any field in place; afterwards a new-SKU field is locked with its reason (D2)");
const opsBase = versionFieldValues({ construction_version_id: 41, specification: { length_mm: 300, ups: 1, height_mm: 0 },
  quote_fields: { item_name: "A", cobb_value: null } });
check(opsBase.height_mm === 0 && opsBase.cobb_value === null && opsBase.construction_version_id === 41
  && !versionChangeVerdict(opsPlanNew, opsBase, { width_mm: 210 }, false).ok
  && /price-driving/.test(versionChangeVerdict(opsPlanNew, opsBase, { cobb_value: "32" }, false).message)
  && versionChangeVerdict(opsPlanNew, opsBase, { cobb_value: "32" }, true).ok
  && versionChangeVerdict(opsPlanNew, opsBase, { item_name: "B" }, false).ok
  && !versionChangeVerdict(opsPlanNew, opsBase, {}, false).ok,
  "U2-SKU-FE-120 the editor says before sending whether a change is a new SKU, needs price-driving, or is a version (D2)");
const opsLenDef = SKU_EDIT_FIELDS.find(d => d.field === "length_mm");
const opsNameDef = SKU_EDIT_FIELDS.find(d => d.field === "item_name");
const opsUpsDef = SKU_EDIT_FIELDS.find(d => d.field === "ups");
check(parseFieldInput(opsLenDef, "0").value === 0 && parseFieldInput(opsLenDef, "").value === null && parseFieldInput(opsLenDef, "-1").error
  && parseFieldInput(opsNameDef, "  ").value === null && parseFieldInput(opsNameDef, " A ").value === "A"
  && parseFieldInput(opsUpsDef, "0").error && parseFieldInput(opsUpsDef, "").error
  && JSON.stringify(buildFieldChanges({ height_mm: "0", item_name: "" }, { height_mm: null, item_name: null }).fields) === '{"height_mm":0}',
  "U2-SKU-FE-121 blank is not recorded and zero is a value; unchanged fields are never sent");
const opsSku = { id: 1, status: "active", plant: { plant_code: "NAG" }, party_id: 501 };
check(replacementCandidates(opsSku, [
  { id: 1, status: "active", plant: { plant_code: "NAG" }, party_id: 501 },
  { id: 2, status: "active", plant: { plant_code: "NAG" }, party_id: 501 },
  { id: 3, status: "active", plant: { plant_code: "PUN" }, party_id: 501 },
  { id: 4, status: "active", plant: { plant_code: "NAG" }, party_id: 777 },
  { id: 5, status: "proposed", plant: { plant_code: "NAG" }, party_id: 501 }]).map(r => r.id).join() === "2"
  && /never be changed, released or reissued/.test(SKU_OP_CONFIRM.assign_code("N-9"))
  && /stays Proposed until it is published/.test(SKU_OP_CONFIRM.assign_code("N-9"))
  && /linked, never substituted/.test(SKU_OP_CONFIRM.discontinue("N-9"))
  && /sets no price/.test(SKU_OP_CONFIRM.set_portfolio("N-9", "Strategic")),
  "U2-SKU-FE-122 a replacement is only a different active SKU of the same plant and Customer; confirms state the consequence (D3, D4)");
check(actionsUi.includes("expected_content_version: plan.version.content_version")
  && actionsUi.includes("expected_content_version: data.sku.content_version")
  && (actionsUi.match(/runMutation\(/g) || []).length >= 4 && !/\.rpc\(|service_role|supabase/.test(actionsUi)
  && actionsUi.includes("if (!live || busy) return;") && actionsUi.includes("{!live && <DisabledNote reason={mode.reason} />}"),
  "U2-SKU-FE-123 every write carries the token it read, goes through a governed route, and does nothing unless live (D8, D11)");
check(actionsUi.includes("skuOpsBody(sku.content_version, { location_id: Number(locationId) })")
  && actionsUi.includes("skuOpsBody(row.content_version, needsReason ? { reason: reason.trim() } : {})")
  && actionsUi.includes('row.status === "proposed" ? "approve"')
  && actionsUi.includes('row.status === "approved" ? "withdraw" : "reactivate"'),
  "U2-SKU-FE-123a applicability proposal uses the SKU token; every existing-row transition uses its own token and ruled lifecycle");
check(screen.includes("skuOpsAuthority(profile, detailData?.sku?.plant?.plant_code)")
  && screen.includes('detailMode.state === "live" && <SkuVersionEditor')
  && screen.includes('title="History"') && screen.includes("It arrives with the governed SKU operations."),
  "U2-SKU-FE-124 the screen reads authority at the SKU's plant, opens the editor only when live, and shows the append-only history (D9)");
console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
console.log("U2 SKU Master frontend fixture gate PASS");
