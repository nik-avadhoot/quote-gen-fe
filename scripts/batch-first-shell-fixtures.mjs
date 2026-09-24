import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { journeyStageDisclosure, journeyState } from "../src/lib/quoteJourney.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
let passed = 0;
const failed = [];
const check = (condition, label) => {
  if (condition) { passed += 1; console.log(`ok   - ${label}`); }
  else { failed.push(label); console.log(`FAIL - ${label}`); }
};

const ui = read("src/state/useUiState.js");
const shell = read("src/tabs/batch/BatchFirstShell.jsx");
const shellCss = read("src/tabs/batch/BatchFirstShell.css");
const batchEntry = read("src/tabs/batch/BatchEntryTab.jsx");
const batchGrid = read("src/tabs/batch/BatchGrid.jsx");
const batchWorkspace = read("src/tabs/batch/BatchWorkspacePanel.jsx");
const sidebar = read("src/ui/Sidebar.jsx");
const topBar = read("src/ui/TopBar.jsx");
const topBarCss = read("src/ui/TopBar.css");
const costing = read("src/tabs/costing/CostingTab.jsx");
const costingDraft = read("src/state/useCostingDraft.js");
const quotes = read("src/tabs/QuotesWorkspace.jsx");
const governed = read("src/tabs/QuotesScreen.jsx");
const catalogue = read("src/tabs/QuoteCatalogueScreen.jsx");
const panel = read("src/tabs/batch/NewGovernedBatchPanel.jsx");
const app = read("src/App.jsx");
const account = read("src/AccountMenu.jsx");

check(ui.includes('useState("batch")'),
  "S1-1 authenticated users land in Batch Builder");
check(shell.includes('if (durableBatch?.id) return null;')
  && shell.includes("New customer quote") && shell.includes("Open active Batch")
  && !shell.includes("Awaiting action") && !shell.includes("Quick calculation")
  && !shell.includes("Approval Inbox") && !shell.includes("Documents &amp; history"),
  "S1-2 empty Batch landing contains only the primary start and saved-Batch actions");
check(batchEntry.includes("<BatchFirstShell/>")
  && shell.includes('aria-label="No active Batch"')
  && shell.includes("chooseCustomerQuote") && shell.includes('setTab("mybatches")'),
  "S1-3 empty landing starts governed work or opens the active-Batch catalogue");
check(shellCss.includes("min-height: 46px") && shellCss.includes("display: flex")
  && !shellCss.includes("grid-template-columns") && !shellCss.includes("min-height: 64px"),
  "S1-4 the empty landing is compact and the old multi-card launcher geometry is gone");
check(shell.includes('if (durableBatch?.id) return null;')
  && batchEntry.includes('style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}'),
  "S1-5 an active governed Batch removes the launcher and returns its height to the grid");

check(topBar.includes('aria-label="Active Batch journey"')
  && topBar.includes("durableBatch?.batch_reference")
  && topBar.includes("currentStage?.label") && topBar.includes("batchJourney.next.label")
  && topBar.includes("batchJourney.counts.toFix"),
  "S1-6 active Batch identity, stage, Next and blocker count share the existing header");
check(topBarCss.includes("height: 48px") && topBarCss.includes("flex: 0 0 48px")
  && topBarCss.includes("white-space: nowrap") && !topBarCss.includes("flex-wrap"),
  "S1-7 the persistent journey stays one header line rather than adding a vertical band");
check(account.includes("Download backup") && account.includes("Restore backup")
  && topBar.includes("onBackup={handleBackup} onRestore={handleRestore}")
  && !topBar.includes("⬇ Backup") && !topBar.includes("⬆ Restore"),
  "S1-8 low-frequency Backup and Restore utilities moved into the account disclosure");

const productsJourney = journeyState({ laneSelection: { lane: "customer", batchId: "7" },
  durableBatch: { id: 7 }, batchProfile: { client: "Acme" }, batchRows: [], quoteItems: [] });
const disclosed = journeyStageDisclosure(productsJourney);
check(disclosed.find(stage => stage.id === "customer")?.state === "complete"
  && disclosed.find(stage => stage.id === "products")?.state === "current"
  && disclosed.find(stage => stage.id === "document")?.disabled === true
  && disclosed.find(stage => stage.id === "document")?.reason,
  "S1-9 completed/current stages are available while every future stage is disabled with a reason");
const pricedReason = journeyStageDisclosure(journeyState({
  laneSelection: { lane: "customer", batchId: "7" }, durableBatch: { id: 7 },
  batchProfile: { client: "Acme" }, batchRows: [{ id: "1" }], batchResults: {}, quoteItems: [],
})).find(stage => stage.id === "price")?.reason;
check(pricedReason === "Calculate the included products to establish current prices.",
  "S1-9a future-stage reasons describe the active Batch rather than an already-completed prerequisite");
check(topBar.includes("if (stage.disabled) return;")
  && topBar.includes('setQuoteView("working-items")')
  && !topBar.includes("approve") && !topBar.includes("issue") && !topBar.includes("share"),
  "S1-10 stage navigation opens owning surfaces only and cannot run protected workflow transitions");

check(topBar.includes("requestExitReview?.()") && topBar.includes("activeBatchRowId")
  && topBar.includes("`batch-row-${rowId}`")
  && batchGrid.includes('id={`batch-row-${row.id}`} tabIndex={-1}'),
  "S1-11 Costing deep-dive retains its originating row and has a guarded return to that Batch row");
check(batchWorkspace.includes("const openInCosting = row =>")
  && batchWorkspace.includes("openDurableRowInCosting({")
  && batchWorkspace.includes("transition: loadBatchRowIntoCosting")
  && batchWorkspace.includes("commitLocalPreview(row, preview, existing, targetProfile)")
  && batchWorkspace.includes("Open in Costing"),
  "S2-1 a selected durable row opens Costing only through its existing local-preview review bridge");
check(topBar.includes("reviewRow?.durableRowId")
  && topBar.includes('mode: "row-focus"')
  && batchWorkspace.includes('id={`batch-workspace-row-${row.id}`} tabIndex={-1}')
  && batchWorkspace.includes("target?.focus?.({ preventScroll: true })"),
  "S2-2 guarded Costing return reopens and focuses the exact originating durable row");
const openInCostingStart = batchWorkspace.indexOf("const openInCosting = row =>");
const openInCostingHandler = batchWorkspace.slice(openInCostingStart,
  batchWorkspace.indexOf("\n  };", openInCostingStart) + 5);
// S3 superseded the S2 claim "the deep-dive adds no governed mutation path":
// OPENING a durable row in Costing still writes nothing (no mutation in the
// open handler), and the ONE governed return is the explicit Apply, which
// reaches the row only through lib/governedRowReturn.js.
check(costing.includes("Governed row review · Apply to Batch row")
  && batchWorkspace.includes("Governed state is unchanged")
  && !openInCostingHandler.includes("runMutation") && !openInCostingHandler.includes("apiFetch"),
  "S2-3 opening the deep-dive writes nothing; the governed return is only the explicit Apply to Batch row");
check(costingDraft.includes("const requestExitReview=()=>{")
  && costingDraft.includes("if(reviewDirty)") && costingDraft.includes("window.confirm(")
  && costing.includes("requestExitReview") && sidebar.includes("st.requestExitReview?.()"),
  "S1-12 Costing strip, shared header and navigation reuse one review-dirty confirmation");
check(sidebar.includes('if(t==="costing")st.returnToQuickCalculation?.();')
  && sidebar.indexOf("st.requestExitReview?.()") < sidebar.indexOf('if(t==="costing")st.returnToQuickCalculation?.();'),
  "S1-13 Quick Calculation cannot relabel a live review before its guarded exit succeeds");
check(topBar.includes('const isPrivateQuick = tab === "costing" && !activeBatchRowId;')
  && topBar.includes("Private · no Batch context")
  && topBar.includes("const showBatchContext = isDeepDive ||"),
  "S1-14 private Quick Calculation explicitly has no Batch journey while deep-dive retains it");

check(topBar.includes('if (next.surface === "items")')
  && topBar.includes('setQuoteView("working-items");')
  && topBar.indexOf('setQuoteView("working-items");') < topBar.indexOf('setTab("items");'),
  "S1-15 Review the customer document always opens Working Quote Items, even after History");
check(quotes.includes('view === "working-items"') && quotes.includes('kind: "working"')
  && governed.includes('kind: "governed"') && catalogue.includes("revisionId: selectedRevision.id")
  && catalogue.includes("revisionNumber: selectedRevision.revision_number"),
  "S1-16 Working, Governed and History publish distinct context with exact revision identity where one exists");
check(topBar.includes("quoteHeaderContext?.quoteReference")
  && topBar.includes("quoteHeaderContext?.revisionId")
  && topBar.includes("showBatchContext") && topBar.includes("showQuoteContext"),
  "S1-17 Batch identity and Quote revision identity remain separate header claims");

check(ui.includes("batchFocusMode") && topBar.includes("if (batchFocusMode) setBatchFocusMode(false);")
  && topBar.includes("focusControl(next.focus || FOCUS.workspace)")
  && batchEntry.includes("focusModeRef.current=focusMode"),
  "S1-18 focus-mode Next restores the target before focusing it instead of silently doing nothing");
check(sidebar.includes('hasCapability(profile,"check_quote")')
  && !sidebar.includes('pending("AI","Approval Inbox"')
  && sidebar.indexOf('item("batch"') < sidebar.indexOf('item("costing"')
  && sidebar.includes('["Reference data"') && sidebar.includes('["Administration"'),
  "S1-19 Maker, Approver and Admin navigation keeps Approval capability-gated and secondary areas collapsed");
check(app.includes('"s1-maker", "s1-approver", "s1-admin"')
  && app.includes("<AuthFixtureProvider profile={fixtureProfile}>")
  && app.includes("import.meta.env.DEV") && app.includes("NO AUTHORITY OR API WRITES"),
  "S1-20 Maker, Approver and Admin browser profiles remain development-only and labelled");
check(topBarCss.includes("min-width: 0") && topBarCss.includes("overflow: hidden")
  && batchEntry.includes('overflow:"hidden"') && batchGrid.includes('overflowX:"auto"'),
  "S1-21 the 1366px shell contains page overflow while the wide product grid owns horizontal scrolling");
check(!shell.includes("apiFetch") && !shell.includes("runMutation")
  && !topBar.includes("apiFetch") && !topBar.includes("runMutation"),
  "S1-22 the corrected shell remains presentation/navigation only with no new authority path");
check(panel.includes("const cancel = () =>") && panel.includes("!laneSelection.batchId")
  && panel.match(/onClick=\{cancel\}/g)?.length === 2,
  "S1-23 cancelling a new customer-Quote path still clears only its pending intent");

console.log(`\n${passed} passed, ${failed.length} failed`);
if (failed.length) process.exit(1);
console.log("Batch-first shell fixture gate PASS");
