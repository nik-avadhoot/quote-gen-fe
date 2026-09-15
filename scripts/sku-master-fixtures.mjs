// U2 SKU Master frontend fixture gate.
//
// Run: npm run test:sku-master
//
// Proves the presentation model never invents a value (blank vs zero, hidden
// vs unavailable, declared-unrecorded printing fields), that the catalogue
// scope mirrors plant_access, that the destination is flag- and capability-
// gated at BOTH the nav entry and the mount, and that the screen is read-only.
import fs from "node:fs";
import {
  NOT_VISIBLE, UNAVAILABLE, adoptionLabel, applicabilityLocationLabel, canOpenSkuMaster, constructionLabel,
  customerLabel, dimensionSummary, familyLabel, formatMeasure, latestVersionFacts, normaliseSkuCatalogue,
  plantItemCodeLabel, replacementLabel, skuCatalogueQuery, skuPlantScope, skuSearchValidation,
  specificationRows, unrecordedFieldsNotice, visibilityText,
} from "../src/lib/skuMasterModel.js";
import { SKU_FIXTURE_DETAILS, fixtureSkuCatalogue } from "../src/lib/skuMasterFixture.js";

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
  && visibilityText("unavailable") === UNAVAILABLE && visibilityText(undefined) === UNAVAILABLE,
  "U2-SKU-FE-8 hidden and failed reads have distinct honest wording; an unknown state is unavailable");
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
  "U2-SKU-FE-16 Printing Technology and colour count are declared unrecorded, not rendered as values");
const normal = normaliseSkuCatalogue({});
check(normal.skus.length === 0 && normal.truncated === false && normal.customerVisibility === "unavailable",
  "U2-SKU-FE-17 a response without visibility is treated as unavailable, not visible");
check(latestVersionFacts({ latest_version: null }).join() === "No versions"
  && latestVersionFacts({ version_count: 2, latest_version: { version_no: 2, approved: false,
    length_mm: 1, width_mm: 2, height_mm: 0, box_type: "RSC" } }).join(" · ")
    === "v2 of 2 · unapproved · L 1 × W 2 × H 0 mm · RSC",
  "U2-SKU-FE-18 catalogue rows summarise the latest immutable version honestly");

// ───────────────────────────────────────────────────────────────── fixtures
const allFixtureCodes = [
  ...fixtureSkuCatalogue().skus.map(row => row.plant_item_code).filter(Boolean),
  ...Object.values(SKU_FIXTURE_DETAILS).flatMap(d => [d.sku.plant_item_code,
    ...d.lineage.replaces.map(r => r.plant_item_code)]).filter(Boolean),
];
check(allFixtureCodes.length > 0 && allFixtureCodes.every(code => code.includes("__U2_FIXTURE_ONLY__")),
  "U2-SKU-FE-19 every fixture SKU code is marked __U2_FIXTURE_ONLY__");
check(fixtureSkuCatalogue({ plant: "NAG", status: "active" }).skus.map(r => r.id).join() === "9101"
  && fixtureSkuCatalogue({ q: "pun/" }).skus.map(r => r.id).join() === "9201"
  && fixtureSkuCatalogue({ familyId: "202" }).skus.every(r => r.family?.id === 202),
  "U2-SKU-FE-20 the fixture catalogue applies the documented filters");
check(Object.values(SKU_FIXTURE_DETAILS).every(d => d.mutations === "none")
  && SKU_FIXTURE_DETAILS[9101].versions[0].specification.height_mm === 0
  && SKU_FIXTURE_DETAILS[9101].versions[1].specification.height_mm === null
  && SKU_FIXTURE_DETAILS[9103].detail_visibility.construction === "not_visible_to_caller",
  "U2-SKU-FE-21 fixture details exercise zero, blank and not-visible paths");

// ──────────────────────────────────────────────────── gating and read-only
const screen = read("../src/tabs/SkuMasterScreen.jsx");
const sidebar = read("../src/ui/Sidebar.jsx");
const shell = read("../src/QuotationApp.jsx");
const app = read("../src/App.jsx");
const flags = read("../src/lib/featureFlags.js");
check(sidebar.includes('isFeatureEnabled("u2_sku_master")&&canOpenSkuMaster(profile)')
  && shell.includes('tab==="skus"&&isFeatureEnabled("u2_sku_master")&&canOpenSkuMaster(profile)&&<SkuMasterScreen/>'),
  "U2-SKU-FE-22 the same flag and capability gate the nav entry and the mount");
check(/"u2_sku_master"\]/.test(flags.replace(/\s+/g, "")) && flags.includes("import.meta.env.DEV ? DEV_DEFAULTS"),
  "U2-SKU-FE-23 the destination is on only in the development floor; production stays default-off");
check(app.includes('fixtureIllustration === "u2-skus"') && app.includes("import.meta.env.DEV && fixtureIllustration === \"u2-skus\"")
  && app.includes("<SkuMasterScreen fixtureOnly"),
  "U2-SKU-FE-24 the fixture preview exists only in a development build without a signed-in profile");
const apiCalls = screen.match(/apiFetch\(([^)]*)\)/g) || [];
check(apiCalls.length === 2 && apiCalls.every(call => !call.includes("method"))
  && !/runMutation|method:\s*"(POST|PATCH|PUT|DELETE)"/.test(screen),
  "U2-SKU-FE-25 the screen issues exactly two GET reads and no mutation");
check(!/>\s*(Create|New SKU|Edit|Approve|Publish|Discontinue|Reactivate|Add reference|Withdraw)\s*</.test(screen),
  "U2-SKU-FE-26 no dead create, edit, approve or discontinue control is rendered");
check(screen.indexOf("if (fixtureOnly)") !== -1
  && screen.indexOf("if (fixtureOnly)") < screen.indexOf("apiFetch(query)")
  && screen.includes("U2 · FIXTURE ONLY"),
  "U2-SKU-FE-27 fixture mode is labelled and short-circuits before any request");
check(screen.includes('<ProvenanceTag kind="governed" />') && screen.includes('<ProvenanceTag kind="local" />')
  && !/printingTechnology|printing_technology|numberOfColours/.test(screen),
  "U2-SKU-FE-28 governed data is distinguished from local data, and local printing metadata is never borrowed");
check(screen.includes('verdict.kind === "access-denied"') && screen.includes("AccessDeniedState")
  && screen.includes("resp.status === 404"),
  "U2-SKU-FE-29 a denial renders as access denied and an invisible SKU as not visible, never as an empty list");

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
console.log("U2 SKU Master frontend fixture gate PASS");
