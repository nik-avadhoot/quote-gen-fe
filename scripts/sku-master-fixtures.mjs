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
// entry and the mount, and that the screen is read-only.
//
// U2-SKU-FE-67+ guard the ONE SEARCH BOX: it covers the six identity factors
// and nothing else, words narrow rather than widen, the screen says which
// factors were actually reached, and an empty answer distinguishes "nothing
// matched" from "nothing is visible to you".
import fs from "node:fs";
import {
  NOT_VISIBLE, PANEL_FOCUS, PENDING, SPEC_FIELD_KEYS, SPLIT_DEFAULT, UNAVAILABLE, adoptionLabel, applicabilityLocationLabel,
  canOpenSkuMaster, clampSplit, constructionLabel, customerLabel, dimensionSummary, familyLabel, formatMeasure,
  gridCellText, latestVersionFacts, normaliseSkuCatalogue, panelLayout, plantItemCodeLabel, qtyPerSetText, replacementLabel,
  SEARCH_FIELD_LABELS, SKU_SEARCH_FIELDS, SKU_SEARCH_MAX_TERMS, schemaPendingNotice, searchCoverageNotice,
  searchScanNotice, searchScopeHint, skuCatalogueQuery, skuEmptyState, skuPlantScope,
  skuSearchTerms, skuSearchValidation, skuSetGroups, skuSetView,
  specFieldCell, specRowFromCatalogue, specRowFromDetail, specificationRows, unrecordedFieldsNotice, visibilityText,
} from "../src/lib/skuMasterModel.js";
import { SKU_FIXTURE_DETAILS, fixtureSkuCatalogue } from "../src/lib/skuMasterFixture.js";
import {
  PRINT_TECHNOLOGIES, PRODUCTION_BACKLOG, PRODUCTION_BACKLOG_COUNT, SKU_SPEC_FIELD_COUNT, SKU_SPEC_GROUPS,
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
check(SKU_SPEC_FIELD_COUNT === 39 && fields.length === 39 && sheetFields.length === 36
  && fields.filter(f => f.origin === "new").map(f => f.key).join() === "PT,NC"
  && fields.filter(f => f.origin === "app").map(f => f.key).join() === "LC",
  "U2-SKU-FE-22 SKU Master holds 39 fields: 36 SPEC columns, Print Technology, Number of Colours and the app lifecycle");
check(SKU_SPEC_GROUPS.map(g => g.label).join(" | ")
  === "Identity & Linking | STD Carton Specification | STD Internal Dimensions | STD Board & Paper Composition | Conversion · Deckle · Sheet Sizing | Status & Governance",
  "U2-SKU-FE-23 fields keep the SPEC sheet groups in sheet order");
check(SKU_SPEC_GROUPS.every(g => g.fields.every((f, i) => i === 0 || f.order > g.fields[i - 1].order)),
  "U2-SKU-FE-24 fields keep sheet order inside each group");
check(fields.map(f => f.key).join() === "A,B,C,D,E,F,G,H,I,J,K,L,N,PT,NC,O,AA,AE,AF,AG,AI,AJ,AK,AL,AM,AN,AO,AP,AQ,AR,AS,AT,AU,AV,AW,BH,LC,DX,DZ",
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
const sidebar = read("../src/ui/Sidebar.jsx");
const shell = read("../src/QuotationApp.jsx");
const app = read("../src/App.jsx");
const flags = read("../src/lib/featureFlags.js");
check(sidebar.includes('isFeatureEnabled("u2_sku_master")&&canOpenSkuMaster(profile)')
  && shell.includes('tab==="skus"&&isFeatureEnabled("u2_sku_master")&&canOpenSkuMaster(profile)&&<SkuMasterScreen/>'),
  "U2-SKU-FE-45 the same flag and capability gate the nav entry and the mount");
check(/"u2_sku_master"\]/.test(flags.replace(/\s+/g, "")) && flags.includes("import.meta.env.DEV ? DEV_DEFAULTS"),
  "U2-SKU-FE-46 the destination is on only in the development floor; production stays default-off");
check(app.includes("import.meta.env.DEV && fixtureIllustration === \"u2-skus\"") && app.includes("<SkuMasterScreen fixtureOnly"),
  "U2-SKU-FE-47 the fixture preview exists only in a development build without a signed-in profile");
const apiCalls = screen.match(/apiFetch\(([^)]*)\)/g) || [];
check(apiCalls.length === 2 && apiCalls.every(call => !call.includes("method"))
  && !/runMutation|method:\s*"(POST|PATCH|PUT|DELETE)"/.test(screen),
  "U2-SKU-FE-48 the screen issues exactly two GET reads and no mutation");
check(!/>\s*(Create|New SKU|Edit|Approve|Publish|Discontinue|Reactivate|Add reference|Add to set|Withdraw)\s*</.test(screen),
  "U2-SKU-FE-49 no dead create, edit, approve, discontinue or set-membership control is rendered");
check(screen.indexOf("if (fixtureOnly)") !== -1 && screen.indexOf("if (fixtureOnly)") < screen.indexOf("apiFetch(query)")
  && screen.includes("U2 · FIXTURE ONLY"),
  "U2-SKU-FE-50 fixture mode is labelled and short-circuits before any request");
check(screen.includes('<ProvenanceTag kind="governed" />') && screen.includes('<ProvenanceTag kind="local" />')
  && !/printingTechnology|printing_technology|numberOfColours/.test(screen),
  "U2-SKU-FE-51 governed data is distinguished from local data, and local printing metadata is never borrowed");
check(screen.includes('verdict.kind === "access-denied"') && screen.includes("AccessDeniedState")
  && screen.includes("resp.status === 404"),
  "U2-SKU-FE-52 a denial renders as access denied and an invisible SKU as not visible, never as an empty list");
check(screen.includes('role="separator"') && screen.includes("onPointerDown={startDrag}")
  && screen.includes("onDoubleClick={() => setSplit(SPLIT_DEFAULT)}") && screen.includes("clampSplit(")
  && screen.includes("onKeyDown={nudgeSplit}") && screen.includes("useState(SPLIT_DEFAULT)"),
  "U2-SKU-FE-53 the divider opens at 50 : 50, drags and moves by keyboard within the clamp, and resets on double-click");
check(screen.includes("SKU_SPEC_GROUPS") && screen.includes("PRODUCTION_BACKLOG") && screen.includes("specFieldCell(c.key, row, ctx)")
  && screen.includes("specFieldCell(f.key, row, ctx)"),
  "U2-SKU-FE-54 grid and deep-dive both render from the registry through the one field rule");

check(screen.includes('onClick={() => toggleFocus("list")}') && screen.includes('onClick={() => toggleFocus("detail")}')
  && screen.includes('aria-pressed={focusPanel === "list"}') && screen.includes('aria-pressed={focusPanel === "detail"}')
  && screen.includes("layout.showList &&") && screen.includes("layout.showDetail &&") && screen.includes("layout.showDivider &&"),
  "U2-SKU-FE-58 each panel has its own focus toggle, and focus hides the other panel and the divider");
check(screen.includes("setSidebarCollapsed(true)") && screen.includes("setSidebarCollapsed(sidebarBeforeFocus.current)")
  && (screen.match(/setSidebarCollapsed\(sidebarBeforeFocus\.current\)/g) || []).length === 2,
  "U2-SKU-FE-59 focus collapses the app navigation and restores it on exit and when the screen unmounts");
check(screen.includes('e.key === "Escape" && focusRef.current') && screen.includes("onKeyDown={exitFocusOnEscape}")
  && !/requestFullscreen|fullscreenElement|window\.addEventListener\("keydown"/.test(screen),
  "U2-SKU-FE-60 Escape exits focus through a screen-scoped handler; the browser Fullscreen API is never used");
check(screen.includes('disabled={selectedId == null && focusPanel !== "detail"}')
  && screen.includes('focusPanel === "detail" ? 3'),
  "U2-SKU-FE-61 detail focus needs a selected SKU and spreads fields across three columns");
check(app.includes("<AppStateProvider>\n      <SkuMasterScreen fixtureOnly"),
  "U2-SKU-FE-62 the fixture preview mounts inside the app state provider like the other previews");

// ───────────────────────────────────────────── expand icons and header density
const icons = read("../src/ui/icons.jsx");
const standards = read("../src/ui/screenStandards.js");
check(icons.includes("export const ExpandIcon") && icons.includes("export const CollapseIcon")
  && icons.includes('"aria-hidden": true') && icons.includes('stroke: "currentColor"'),
  "U2-SKU-FE-63 expand and collapse are decorative stroke icons that take the button colour");
check(screen.includes('aria-label={focusPanel === "list" ? "Collapse list" : "Expand list"}')
  && screen.includes('aria-label={focusPanel === "detail" ? "Collapse detail" : "Expand detail"}')
  && (screen.match(/<ExpandIcon size=\{14\} \/>/g) || []).length === 2
  && (screen.match(/<CollapseIcon size=\{14\} \/>/g) || []).length === 2
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
  "customer_item_code", "softcomp_code", "customer_name"])
  && Object.keys(SEARCH_FIELD_LABELS).length === SKU_SEARCH_FIELDS.length
  && SKU_SEARCH_FIELDS.every(f => typeof SEARCH_FIELD_LABELS[f] === "string"),
  "U2-SKU-FE-67 the box covers exactly the six identity factors, each with a name a reader would use");
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

// The fixture preview searches the same six factors and nothing else.
const fixtureIds = q => fixtureSkuCatalogue({ q }).skus.map(r => r.id);
check(fixtureIds("__U2_FIXTURE_ONLY__/NAG/0001Q1").length === 1 && fixtureIds("PARTITION").length === 1
  && fixtureIds("FIX-CIC-778").length === 1 && fixtureIds("FIX-011145").length === 1
  && fixtureIds("Distillers Unit 1").length > 0,
  "U2-SKU-FE-81 the preview finds a SKU by code, name, Customer Item Code, SoftComp Code and Customer name");
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

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
console.log("U2 SKU Master frontend fixture gate PASS");
