import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  orderedQuoteRevisions, quoteActor, quoteRevisionLabel, U5_QUOTE_CATALOGUE_ILLUSTRATIONS,
  U5_QUOTE_ILLUSTRATION, U5_SUBMITTED_QUOTE_ILLUSTRATION,
} from "../src/lib/quoteEvidenceModel.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const screen = fs.readFileSync(path.join(root, "src/tabs/QuotesScreen.jsx"), "utf8");
const workspace = fs.readFileSync(path.join(root, "src/tabs/QuotesWorkspace.jsx"), "utf8");
const catalogueScreen = fs.readFileSync(path.join(root, "src/tabs/QuoteCatalogueScreen.jsx"), "utf8");
const myBatches = fs.readFileSync(path.join(root, "src/tabs/MyBatchesScreen.jsx"), "utf8");
const batchWorkspace = fs.readFileSync(path.join(root, "src/tabs/batch/BatchWorkspacePanel.jsx"), "utf8");
const quoteActions = fs.readFileSync(path.join(root, "src/state/useQuoteActions.js"), "utf8");
const uiState = fs.readFileSync(path.join(root, "src/state/useUiState.js"), "utf8");
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

const revisions = orderedQuoteRevisions(U5_QUOTE_ILLUSTRATION.revisions);
const current = revisions[0];
const snapshot = current.items[0].calculation_snapshot;

check(U5_QUOTE_ILLUSTRATION.quote_reference.includes("__U5_FIXTURE_ONLY__"),
  "U5-FE-1 fixture identity is permanently conspicuous");
check(current.revision_no === 2 && current.standing === "current"
  && revisions[1].standing === "superseded",
  "U5-FE-2 revision chronology distinguishes current and superseded standing");
check(quoteRevisionLabel({ revision_no: null }) === "Unnumbered draft"
  && quoteRevisionLabel(current) === "Revision 2",
  "U5-FE-3 numbered and pre-approval revision identities remain distinct");
check(quoteActor(current.approved_by_actor, null) === "Fixture Checker"
  && quoteActor(null, 41) === "User #41",
  "U5-FE-4 actor attribution is shown only from visible actor data or exact identity");
check(snapshot.engine_version === "engine/qe1-7c2ceac1972460ba"
  && snapshot.calculation_fingerprint && snapshot.presentation_fingerprint,
  "U5-FE-5 immutable engine and both fingerprints remain visible");
check(snapshot.effective_inputs.material_rate_source === "governed_effective_material_rate"
  && !("supplier_credit" in snapshot.effective_inputs),
  "U5-FE-6 frozen Batch inputs retain the effective material boundary without supplier-credit input");
check(Object.values(U5_QUOTE_ILLUSTRATION.actions).every(action =>
  action.enabled === false && action.reason === "backend_activation_pending"),
  "U5-FE-7 every mutation remains disabled for deferred backend activation");
check(Object.keys(U5_QUOTE_ILLUSTRATION.actions).join(",")
  === "calculate,send,submit,approve,return,withdraw,issue,create_revision,amend,reprice"
  && screen.includes('"Calculate", "Send", "Submit"')
  && screen.includes('"Create revision", "Amend", "Reprice"'),
  "U5-FE-7a the complete accepted workflow stays visible and activation-blocked");
check(screen.includes("/quotes/workspace?reference=") && screen.includes("encodeURIComponent"),
  "U5-FE-8 authenticated mode uses the read-only backend route by encoded permanent reference");
check(!screen.includes(".rpc(") && !screen.includes("supabase") && !screen.includes("service_role"),
  "U5-FE-9 the browser screen has no direct database or privileged function path");
check(screen.includes("No fixture was substituted") && screen.includes("Caller-visible evidence is partial")
  && screen.includes("AccessDeniedState") && screen.includes("Quote not found"),
  "U5-FE-10 error, denied, partial and empty states remain visibly distinct");
check(screen.includes("Current Batch and master values never replace snapshot evidence")
  && screen.includes("Frozen effective inputs and results"),
  "U5-FE-11 the UI labels frozen evidence and refuses current-value reinterpretation");
check(app.includes("fixtureIllustration === \"u5\"") && app.includes("QuotesWorkspace fixtureOnly"),
  "U5-FE-12 development fixture entry is isolated from the authenticated journey");
check(app.includes("import.meta.env.DEV") && app.includes("URLSearchParams")
  && app.includes("\"u5-inbox\"") && app.includes("\"u5-history\""),
  "U5-FE-13 direct browser evidence entry remains development-only and explicitly selected");

const inbox = U5_QUOTE_CATALOGUE_ILLUSTRATIONS.inbox;
const history = U5_QUOTE_CATALOGUE_ILLUSTRATIONS.history;
check(inbox.rows.length === 1 && inbox.rows[0].quote_reference === null
  && inbox.rows[0].revision_no === null && inbox.rows[0].workflow_status === "submitted",
  "U5-FE-14 Approval Inbox preserves the pre-approval, unnumbered candidate state");
check(U5_SUBMITTED_QUOTE_ILLUSTRATION.quote_reference === null
  && U5_SUBMITTED_QUOTE_ILLUSTRATION.revisions[0].standing === null,
  "U5-FE-15 submitted evidence does not invent a permanent reference or standing");
check(history.rows.map(row => row.revision_no).join(",") === "2,1"
  && history.rows.map(row => row.standing).join(",") === "current,superseded",
  "U5-FE-16 Quote History retains newest-first revision standing");
check(Object.values(inbox.actions).every(action => !action.enabled
  && action.reason === "backend_activation_pending"),
  "U5-FE-17 catalogue fixture keeps all workflow mutations activation-blocked");
check(catalogueScreen.includes("/quotes/catalogue?view=${mode}")
  && catalogueScreen.includes("/quotes/workspace?revision_id=${encodeURIComponent(revisionId)}"),
  "U5-FE-18 authenticated catalogues use caller-scoped summary and exact revision evidence routes");
check(!catalogueScreen.includes(".rpc(") && !catalogueScreen.includes("supabase")
  && !catalogueScreen.includes("service_role"),
  "U5-FE-19 catalogue browser code has no direct database or privileged function path");
check(catalogueScreen.includes("Allocated on first approval")
  && catalogueScreen.includes("No hidden identity has been inferred"),
  "U5-FE-20 pre-approval identity and caller-visible partial data are described truthfully");
check(catalogueScreen.includes("caller-visible records only")
  && catalogueScreen.includes("This is not the complete catalogue")
  && catalogueScreen.includes("in the returned window"),
  "U5-FE-21 a bounded 50-row result never implies catalogue completeness");
check(catalogueScreen.includes("AccessDeniedState") && catalogueScreen.includes("EmptyState")
  && catalogueScreen.includes("No fixture was substituted"),
  "U5-FE-22 loading, denied, empty and error paths remain distinct without fallback fixtures");
check(shell.includes('tab==="approvalinbox"') && shell.includes('mode="inbox"')
  && shell.includes('tab==="items"') && shell.includes("<QuotesWorkspace/>")
  && !shell.includes('tab==="quotehistory"'),
  "U5-FE-23 Approval Inbox remains routed while Quote History is consolidated into Quotes");
check(sidebar.includes('item("approvalinbox"') && sidebar.includes('hasCapability(profile,"check_quote")')
  && sidebar.includes('item("items"') && !sidebar.includes('item("quotehistory"')
  && workspace.includes('{ id: "history", label: "History", name: "Quote History", provenance: "immutable" }')
  && workspace.includes('<QuoteCatalogueScreen mode="history"'),
  "U5-FE-24 Approval Inbox stays capability-aware and Quote History is the third Quotes tab");
check(uiState.includes('const[quoteView,setQuoteView]=useState("working-items")')
  && workspace.includes("const view = fixtureOnly ? fixtureView : quoteView")
  && /setQuoteView\("working-items"\);\s*setTab\("items"\);/.test(quoteActions),
  "U5-FE-25 Send to Quote explicitly lands on Working Quote Items");
check(workspace.indexOf('{ id: "working-items"')<workspace.indexOf('{ id: "governed"')
  && workspace.includes('name: "Working Quote Items"') && workspace.includes('name: "Governed Quote evidence"')
  && workspace.includes("${option.name} —")
  && workspace.includes('initialView = "working-items"'),
  "U5-FE-26 Working Quote Items is the first and default Quotes view");
check(workspace.includes("initialRevisionId={fixtureOnly ? null : quoteWorkspaceRequest?.revisionId}")
  && workspace.includes("requestId={fixtureOnly ? null : quoteWorkspaceRequest?.requestId}"),
  "U5-FE-27 Quotes consumes only the authenticated Atomic Send revision handoff");
check(catalogueScreen.includes("openedRequestRef")
  && catalogueScreen.includes("openRevision(initialRevisionId)")
  && catalogueScreen.includes("Opened by exact revision identity"),
  "U5-FE-28 an exact sent revision opens even when it is outside the displayed catalogue window");
check(workspace.includes("initialBatchId={fixtureOnly ? null : quoteWorkspaceRequest?.batchId}")
  && catalogueScreen.includes("/quotes/workspace?batch_id=${encodeURIComponent(batchId)}")
  && catalogueScreen.includes("Opened from exact Batch identity"),
  "U5-FE-29 a durable Batch identity resolves its newest caller-visible linked revision");
check(myBatches.includes(">Quote evidence</button>") && myBatches.includes("Open the linked immutable Quote evidence")
  && myBatches.includes("batch-catalogue-${row.id}-${Date.now()}")
  && batchWorkspace.includes("Linked immutable Quote evidence")
  && batchWorkspace.includes("batch-workspace-${batch.id}-${Date.now()}"),
  "U5-FE-30 My Batches and the reopened Batch workspace both expose the durable Quote handoff");
check(catalogueScreen.includes('detail.status === "empty"')
  && catalogueScreen.includes("No linked Quote evidence is visible")
  && catalogueScreen.includes("No identity or current Batch value was inferred"),
  "U5-FE-31 an absent or RLS-hidden Batch link remains an explicit empty result without inference");
check(screen.includes("Frozen issue presentation") && screen.includes("Frozen addressee details")
  && screen.includes("Recorded withdrawal reason") && screen.includes("Recorded void reason")
  && screen.includes("voided_by_actor"),
  "U5-FE-32 frozen presentation and exceptional standing evidence are no longer silently omitted");
check(current.addressee_details.city === "Nagpur"
  && current.customer_outcomes.at(-1).acceptance_reference === "FIXTURE-PO-9301"
  && screen.includes("Acceptance date") && screen.includes("acceptance_reference")
  && screen.includes("rounding_rule_version") && screen.includes("effective_interest_pct"),
  "U5-FE-33 immutable snapshot and customer-outcome evidence retain their stored supporting fields");
check(current.items[0].calculation_snapshot_id === current.items[0].calculation_snapshot.id
  && screen.includes("pricing group {identity(item.pricing_group_id)}")
  && screen.includes('label="Snapshot link"')
  && screen.includes('label="Snapshot schema"')
  && screen.includes('label="Freight Set Version"')
  && screen.includes('identity(snapshot.freight_set_version_id)')
  && screen.includes('label="Freight Entry"')
  && screen.includes('identity(snapshot.freight_entry_id)')
  && screen.includes('children ?? "—"'),
  "U5-FE-33a frozen Items expose exact persisted and governed version identities");
check(screen.includes("Open current Batch")
  && screen.includes("Current mutable Batch state · separate from this frozen Quote evidence")
  && screen.includes("Source Batch could not be opened"),
  "U5-FE-34 immutable Quote evidence exposes a clearly separated source-Batch return path");
check(workspace.includes("/batches/${encodeURIComponent(batch.id)}/pricing-basis")
  && workspace.includes("/batches/${encodeURIComponent(batch.id)}/workspace")
  && workspace.includes("setDurableBatch") && workspace.includes('mode: "quote-source-read"')
  && workspace.includes("setBatchWorkspaceRequest") && workspace.includes('setTab("batch")'),
  "U5-FE-35 the reverse handoff reopens exact caller-visible Batch state before navigating");
check(workspace.includes("durableBatch.caller_holds_lock")
  && workspace.includes("current edit lock can be released safely")
  && !workspace.includes(".rpc(") && !workspace.includes("service_role")
  && !workspace.includes("method:"),
  "U5-FE-36 Quote-to-Batch navigation preserves the held-lock guard and remains read-only");
// ───────────────────────────── the shared screen-space standard (UX policy)
check(!catalogueScreen.includes("<h1") && !screen.includes("<h1") && !workspace.includes("<h1")
  && !css.includes(".quote-catalogue-header") && !css.includes(".quotes-screen-header")
  && !css.includes(".quote-disabled-actions") && !css.includes(".quotes-view-switch"),
  "U5-FE-37 no page header under the TopBar on any Quotes view, and the dead rules left the stylesheet with it");
check((catalogueScreen.match(/role="toolbar"/g) || []).length === 2
  && (screen.match(/role="toolbar"/g) || []).length === 1
  && (workspace.match(/role="toolbar"/g) || []).length === 1
  && standards.includes("export const TOOLBAR_MIN_HEIGHT = 43")
  && !/const toolbar = {/.test(catalogueScreen) && !/const toolbar = {/.test(screen),
  "U5-FE-38 one toolbar per panel, every one at the single shared height from the shared module");
check(workspace.includes("toolbarLead={viewSwitch}")
  && (workspace.match(/toolbarLead={viewSwitch}/g) || []).length === 2
  && catalogueScreen.includes("{toolbarLead}") && screen.includes("{toolbarLead}")
  && !workspace.includes('className="quotes-view-switch"'),
  "U5-FE-39 the Quotes view switch rides inside the active view's own toolbar, not in a band of its own");
check(catalogueScreen.includes("<PendingActions actions={PENDING_WORKFLOW}")
  && screen.includes("<PendingActions actions={ACTION_LABELS}")
  && catalogueScreen.includes('"Approve", "Return", "Withdraw", "Issue", "Create revision"')
  && !catalogueScreen.includes("quote-disabled-actions") && !screen.includes("quote-disabled-actions"),
  "U5-FE-40 the activation-blocked actions stay visible and disabled inside that toolbar, never hidden or rebanded");
check(catalogueScreen.includes("<PanelDivider") && catalogueScreen.includes("useSplitPanels()")
  && catalogueScreen.includes("panelLayout(split, focusPanel)")
  && catalogueScreen.includes("layout.showList &&") && catalogueScreen.includes("layout.showDetail &&")
  && catalogueScreen.includes("layout.showDivider &&"),
  "U5-FE-41 evidence opens as its own panel beside the list, so the two no longer share one scroll");
check(catalogueScreen.includes('<PanelFocusToggle panel="list"')
  && catalogueScreen.includes('<PanelFocusToggle panel="detail"')
  && catalogueScreen.includes("usePanelFocus()") && catalogueScreen.includes("onKeyDown={exitFocusOnEscape}")
  && !/requestFullscreen|fullscreenElement/.test(catalogueScreen),
  "U5-FE-42 either panel can fill the screen area through the shared icon, inside the app window only");
check(catalogueScreen.includes("frozenCell(selected)") && catalogueScreen.includes("frozenCell(false, true)")
  && catalogueScreen.includes("height: 26") && standards.includes('position: "sticky", left: 0'),
  "U5-FE-43 catalogue rows are 26px with the Quote identity frozen while the rest scrolls sideways");
check(catalogueScreen.includes("<RowDisclosure open={open}") && catalogueScreen.includes("rowDetail(row).map")
  && catalogueScreen.includes('["Revision identity", `#${row.id}`]')
  && catalogueScreen.includes('["Standing", row.standing || "Not allocated"]'),
  "U5-FE-44 revision identity, standing and timestamps moved into the row disclosure rather than being dropped");
check(catalogueScreen.includes("<ScreenFooter") && screen.includes("<ScreenFooter") && workspace.includes("<ScreenFooter")
  && catalogueScreen.includes("never edited in place"),
  "U5-FE-45 provenance is stated once per view in a footer, not repeated on every row");
check(catalogueScreen.includes('import { C, T, mono, sans } from "../theme.js"')
  && screen.includes('import { C, T, mono, sans } from "../theme.js"')
  && !/fontSize: (?!T.)[0-9]/.test(catalogueScreen) && !/fontSize: (?!T.)[0-9]/.test(workspace),
  "U5-FE-46 every type size on these views is a T token, never a hardcoded off-scale pixel value");
check(catalogueScreen.indexOf("<PendingActions") > catalogueScreen.indexOf('aria-label="Quote evidence controls"')
  && catalogueScreen.includes('role="group" aria-label="Split"')
  && catalogueScreen.indexOf('role="group" aria-label="Split"') < catalogueScreen.indexOf('aria-label="Quote evidence controls"'),
  "U5-FE-47 workflow actions sit with the revision they act on, and the split presets in the list disclosure, so neither toolbar wraps at 50:50");

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
console.log("U5 Quote evidence fixture gate PASS");
