import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { U4_BATCH_CATALOGUE_ILLUSTRATION, searchableBatchText } from "../src/lib/batchCatalogueModel.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const screen = fs.readFileSync(path.join(root, "src/tabs/MyBatchesScreen.jsx"), "utf8");
const app = fs.readFileSync(path.join(root, "src/App.jsx"), "utf8");
const shell = fs.readFileSync(path.join(root, "src/QuotationApp.jsx"), "utf8");
const sidebar = fs.readFileSync(path.join(root, "src/ui/Sidebar.jsx"), "utf8");
let passes = 0;
const failures = [];

function check(condition, label) {
  if (condition) { passes += 1; console.log(`ok   - ${label}`); }
  else { failures.push(label); console.log(`FAIL - ${label}`); }
}

const catalogue = U4_BATCH_CATALOGUE_ILLUSTRATION;
const first = catalogue.rows[0];
check(first.batch_reference.includes("__U4_FIXTURE_ONLY__")
  && catalogue.rows.every(row => row.batch_reference.includes("__U4_FIXTURE_ONLY__")),
"U4-CAT-FE-1 every fixture Batch identity is permanently conspicuous");
check(first.customer_family.group_customer_code === "FIX-FAM-9402"
  && first.plant.plant_code === "NAG" && first.sector.sector_code === "FMCG",
"U4-CAT-FE-2 fixture preserves exact Family, Plant and selected Sector identities");
check(first.pricing_basis_release_id === "fixture-release-12"
  && first.pricing_basis_is_deliberate === true && first.pricing_date === "2026-09-13",
"U4-CAT-FE-3 fixture preserves exact Pricing Basis identity, mode and date");
check(searchableBatchText(first).includes("retail family")
  && searchableBatchText(first).includes("fixture-release-12")
  && searchableBatchText(first).includes("submitted"),
"U4-CAT-FE-4 displayed-record search covers operational identities and status");
check(Object.values(catalogue.actions).every(action => !action.enabled
  && action.reason === "backend_activation_pending"),
"U4-CAT-FE-5 Calculate, Send and workflow fixture actions remain activation-blocked");
check(screen.includes('apiFetch("/batches/catalogue")')
  && !screen.includes(".rpc(") && !screen.includes("service_role") && !screen.includes("supabase"),
"U4-CAT-FE-6 authenticated catalogue uses one backend read and no direct privileged path");
check(screen.includes("/pricing-basis") && screen.includes("/workspace")
  && screen.includes('setDurableBatch({ ...workspaceData.batch') && screen.includes('setTab("batch")'),
"U4-CAT-FE-7 selected Batch reopens through existing caller-scoped APIs and binds Batch Builder");
check(screen.includes("durableBatch.caller_holds_lock")
  && screen.includes("Close ${durableBatch.batch_reference} in Batch Builder first"),
"U4-CAT-FE-8 switching cannot orphan a currently held Batch edit lock");
check(screen.includes("AccessDeniedState") && screen.includes("EmptyState")
  && screen.includes("No fixture was substituted") && screen.includes("Catalogue detail is partial"),
"U4-CAT-FE-9 loading, empty, denied, partial and error paths remain truthful and distinct");
check(screen.includes("Find in displayed records") && screen.includes('aria-label="Batch status"')
  && screen.includes('aria-label="Producing Plant"'),
"U4-CAT-FE-10 concise displayed-window search, status and Plant filters are available");
check(screen.includes("Results are limited to the newest")
  && screen.includes("Search and filters cannot reach older Batches"),
"U4-CAT-FE-11 a bounded result never implies server-wide search completeness");
check(screen.includes("Batch #{row.id}") && screen.includes("Family #{row.family_id}")
  && screen.includes("Plant #{row.plant_id}") && screen.includes("Sector #${row.sector_id}")
  && screen.includes("Release #${row.pricing_basis_release_id}"),
"U4-CAT-FE-12 exact internal identities are visible rather than parsed from labels");
check(shell.includes('tab==="mybatches"') && shell.includes("<MyBatchesScreen/>")
  && sidebar.includes('item("mybatches","MB","My Batches"'),
"U4-CAT-FE-13 My Batches is routed in the authenticated Work navigation");
check(app.includes('fixtureIllustration === "u4-batches"')
  && app.includes("<MyBatchesScreen fixtureOnly") && app.includes("import.meta.env.DEV"),
"U4-CAT-FE-14 fixture browser entry is development-only and explicitly labelled");

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
console.log("U4 My Batches fixture gate PASS");
