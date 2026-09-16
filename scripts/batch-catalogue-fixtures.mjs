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
const standards = fs.readFileSync(path.join(root, "src/ui/screenStandards.js"), "utf8");
const css = fs.readFileSync(path.join(root, "src/index.css"), "utf8");
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
check(screen.includes('aria-label="Search displayed Batches"') && screen.includes('aria-label="Batch state"')
  && screen.includes('aria-label="Producing Plant"') && screen.includes('aria-label="Batch owner"')
  && screen.includes("It cannot reach Batches outside the window the server returned"),
"U4-CAT-FE-10 displayed-window search, state, Plant and Owner filters exist, and the search states what it cannot reach");
check(screen.includes("caller-visible Batches only")
  && screen.includes("Search and filters cannot reach older Batches")
  && screen.includes("in the returned window"),
"U4-CAT-FE-11 a bounded result never implies server-wide search completeness");
check(screen.includes("#${row.id} · content v${row.content_version}")
  && screen.includes("#${row.family_id}") && screen.includes("#${row.plant_id}")
  && screen.includes("#${row.sector_id}") && screen.includes("#${row.pricing_basis_release_id}")
  && screen.includes("#${row.owner_user_id}") && /function rowDetail/.test(screen),
"U4-CAT-FE-12 exact internal identities stay visible - moved into the row disclosure, never dropped");
check(shell.includes('tab==="mybatches"') && shell.includes("<MyBatchesScreen/>")
  && sidebar.includes('item("mybatches","MB","My Batches"'),
"U4-CAT-FE-13 My Batches is routed in the authenticated Work navigation");
check(app.includes('fixtureIllustration === "u4-batches"')
  && app.includes("<MyBatchesScreen fixtureOnly") && app.includes("import.meta.env.DEV"),
"U4-CAT-FE-14 fixture browser entry is development-only and explicitly labelled");
// ───────────────────────────── the shared screen-space standard (UX policy)
check(!screen.includes("<h1") && !screen.includes("<h2") && !screen.includes("batch-catalogue-header")
  && !css.includes(".batch-catalogue-header"),
"U4-CAT-FE-15 no page header under the TopBar, and its stylesheet rules are removed rather than left dead");
check((screen.match(/role="toolbar"/g) || []).length === 1
  && screen.includes('from "../ui/screenStandards.js"') && !/const toolbar = {/.test(screen)
  && standards.includes("export const TOOLBAR_MIN_HEIGHT = 43"),
"U4-CAT-FE-16 exactly one toolbar, at the one shared height, declared in the shared module");
check(screen.includes("<PendingActions actions={PENDING_WORKFLOW}")
  && screen.includes('const PENDING_WORKFLOW = ["Submit", "Approve", "Return", "Issue"]')
  && !screen.includes("quote-disabled-actions"),
"U4-CAT-FE-17 the activation-blocked actions ride inside that toolbar, still visible and still disabled");
check(screen.includes('<details style={{ position: "relative" }}>')
  && screen.includes('menuSummary(owner !== "all")') && screen.includes("Clear all filters"),
"U4-CAT-FE-18 secondary filters sit in a disclosure, not permanently on the toolbar");
check(screen.includes("frozenCell(selected)") && screen.includes("frozenCell(false, true)")
  && screen.includes("height: 26") && standards.includes('position: "sticky", left: 0'),
"U4-CAT-FE-19 rows are 26px with the Batch reference frozen while the rest scrolls sideways");
check(screen.includes("<RowDisclosure open={open}") && screen.includes("rowDetail(row).map"),
"U4-CAT-FE-20 secondary facts open in an expanded row, so a compact row is never made taller by them");
check(screen.includes("<ScreenFooter") && (screen.match(/<ProvenanceTag/g) || []).length === 2
  && screen.indexOf("<ScreenFooter") < screen.indexOf('<ProvenanceTag kind="governed" />'),
"U4-CAT-FE-21 provenance and the legend are stated once in the footer, not repeated on every row");
check(screen.includes('import { C, T, sans } from "../theme.js"') && !/fontSize: (?!T.)[0-9]/.test(screen),
"U4-CAT-FE-22 every type size is a T token, never a hardcoded off-scale pixel value");
check(screen.includes('<PanelFocusToggle panel="list"') && screen.includes("usePanelFocus()")
  && screen.includes("onKeyDown={exitFocusOnEscape}") && !/requestFullscreen|fullscreenElement/.test(screen),
"U4-CAT-FE-23 the list can fill the screen area through the shared icon, inside the app window only");

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
console.log("U4 My Batches fixture gate PASS");
