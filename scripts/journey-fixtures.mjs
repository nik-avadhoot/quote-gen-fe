// ═══════════════════════════════════════════════════════════════════════════
// scripts/journey-fixtures.mjs — the commercial journey model, and the
// promise that the toolbar's readiness and the action's refusal are one thing.
//
// Two kinds of check, deliberately separated:
//
//   JR-1..JR-49  BEHAVIOUR. lib/quoteJourney.js is pure, so it is imported and
//                driven with real arguments. These are the ones that would
//                catch a wrong blocker, a wrong order, a lane that claims an
//                authority it does not have, or a stage that lies.
//
//   JR-50..JR-66 SOURCE SHAPE, like the other UX gates in this repository.
//                They prove the wiring the behaviour checks cannot see: that
//                the refusing actions call the shared model rather than keeping
//                a private copy of the rules, that the lane is persisted rather
//                than inferred, and that every control the Next action names
//                actually exists to be focused.
//
// THE OLD JR-18, JR-19 AND JR-20b WERE REPLACED, NOT KEPT. They asserted the
// first version's behaviour: that a bound governed Batch made the lane governed
// (JR-19), that a fully calculated batch pointed at the Quotes screen (JR-18),
// and a checklist with no partial-calculation state at all (JR-20b). All three
// were the defects this increment exists to remove, so preserving them would
// have preserved the bugs. Their replacements are JR-17/JR-19 (the lane is
// chosen, never inferred), JR-41 (Next points at the real Send control) and
// JR-36..JR-38 (partial calculation is a visible readiness problem).
//
// Run: npm run test:journey
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FOCUS, LANE_CHOICES, LANES, STAGES, artifactContext, calculatedRowCount, firstRefusal,
  journeyState, laneSelectionApplies, localWorkBlockers, resolveLane, revisionShareability,
  sendReadiness,
} from "../src/lib/quoteJourney.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

const actions = read("src/state/useQuoteActions.js");
const topBar = read("src/ui/TopBar.jsx");
const grid = read("src/tabs/batch/BatchGrid.jsx");
const costing = read("src/tabs/costing/CostingTab.jsx");
const laneSlice = read("src/state/useQuoteLane.js");
const provider = read("src/state/AppStateProvider.jsx");
const newBatch = read("src/tabs/batch/NewGovernedBatchPanel.jsx");
const governedView = read("src/tabs/QuotesScreen.jsx");
const historyView = read("src/tabs/QuoteCatalogueScreen.jsx");
const bridge = read("src/state/useCostingBatchBridge.js");

let passes = 0;
const failures = [];
function check(condition, label) {
  if (condition) { passes += 1; console.log(`ok   - ${label}`); }
  else { failures.push(label); console.log(`FAIL - ${label}`); }
}

// ── Fixture world ──────────────────────────────────────────────────────────
// A usable construction has a grade and a positive GSM on every structural
// layer; the real predicate lives in lib/constructionIdentity.js and is passed
// in, so this file states the SHAPE it expects rather than re-implementing it.
const usable = entry => entry?.complete === true;
const CATALOGUE = [
  { code: "CON-1", complete: true },
  { code: "CON-2", complete: false },
];
const ROUTED = { client: "Indo Rama", sector: "FMCG", plant: "NAG", delivery: "Nagpur" };
const row = (id, over = {}) => ({ id, itemType: "Box", constructionCode: "CON-1",
  matCode: `M${id}`, ...over });

// ── JR-1..JR-10 · blockers ─────────────────────────────────────────────────
check(localWorkBlockers({ batchRows: [row(1)], batchProfile: ROUTED,
  constructionCatalogue: CATALOGUE, isUsableConstruction: usable }).length === 0,
  "JR-1 a routed batch of one complete row has no blockers");

check(localWorkBlockers({ batchRows: [], batchProfile: {},
  constructionCatalogue: CATALOGUE, isUsableConstruction: usable })
  .map(b => b.code).join() === "route_unresolved",
  "JR-2 an unrouted batch is blocked on the route, and on nothing it does not have");

const assumed = localWorkBlockers({
  batchRows: [row(1), row(2, { itemType: "Plate", setCodeAssumed: true })],
  batchProfile: ROUTED, constructionCatalogue: CATALOGUE, isUsableConstruction: usable });
check(assumed.length === 1 && assumed[0].code === "set_code_assumed"
  && assumed[0].gate === "calculate" && assumed[0].rows.join() === "2"
  && assumed[0].message.includes("Row 2 [M2]"),
  "JR-3 an assumed SET Code on a non-Box row blocks Calculate and names that row");

check(localWorkBlockers({ batchRows: [row(1, { itemType: "Box", setCodeAssumed: true })],
  batchProfile: ROUTED, constructionCatalogue: CATALOGUE, isUsableConstruction: usable })
  .length === 0,
  "JR-4 an assumed SET Code on a Box row is not a blocker — a Box is its own SET");

const broken = localWorkBlockers({ batchRows: [row(1, { constructionCode: "CON-2" })],
  batchProfile: ROUTED, constructionCatalogue: CATALOGUE, isUsableConstruction: usable });
check(broken.length === 1 && broken[0].code === "construction_incomplete"
  && broken[0].gate === "calculate" && broken[0].sendMessage.includes("Cannot send"),
  "JR-5 an incomplete Construction blocks Calculate, and carries its own distinct Send wording");

check(localWorkBlockers({ batchRows: [row(1, { constructionCode: "CON-ABSENT" })],
  batchProfile: ROUTED, constructionCatalogue: CATALOGUE, isUsableConstruction: usable })
  .length === 0,
  "JR-6 a row whose Construction is not in the catalogue at all is NOT the incomplete-Construction blocker");

const stale = localWorkBlockers({ batchRows: [row(1), row(2)], batchProfile: ROUTED,
  constructionCatalogue: CATALOGUE, isUsableConstruction: usable,
  rowStatus: r => (r.id === 2 ? "stale" : "draft") });
check(stale.length === 1 && stale[0].code === "results_stale" && stale[0].gate === "send"
  && stale[0].rows.join() === "2",
  "JR-7 a stale row blocks Send only — Calculate is how the Maker clears it");

check(localWorkBlockers({ batchRows: [row(1)], batchProfile: ROUTED,
  constructionCatalogue: CATALOGUE, isUsableConstruction: usable, rowStatus: null })
  .length === 0,
  "JR-8 with no rowStatus supplied the stale check is skipped, never guessed");

const many = localWorkBlockers({
  batchRows: [row(1, { constructionCode: "CON-2" }), row(2, { itemType: "Plate", setCodeAssumed: true })],
  batchProfile: {}, constructionCatalogue: CATALOGUE, isUsableConstruction: usable,
  rowStatus: () => "stale" });
check(many.map(b => b.code).join() === "set_code_assumed,construction_incomplete,route_unresolved,results_stale",
  "JR-9 blockers come back in one fixed register order, so the list and the refusal agree");

check(many.every(b => typeof b.duration === "number" && b.title && b.message),
  "JR-10 every blocker carries the title the toolbar shows and the exact message and duration the toast raises");

// ── JR-11..JR-14 · refusals ────────────────────────────────────────────────
check(firstRefusal(many, "calculate").code === "set_code_assumed",
  "JR-11 Calculate refuses on the first CALCULATE-gate blocker");
check(firstRefusal(many, "send").code === "set_code_assumed",
  "JR-12 Send refuses on the first blocker of EITHER gate");
check(firstRefusal([many[1]], "send").text === many[1].sendMessage
  && firstRefusal([many[1]], "calculate").text === many[1].message,
  "JR-13 the refusal text is the Send wording for Send and the Calculate wording for Calculate");
check(firstRefusal(localWorkBlockers({ batchRows: [row(1)], batchProfile: ROUTED,
  constructionCatalogue: CATALOGUE, isUsableConstruction: usable }), "send") === null,
  "JR-14 nothing to fix means no refusal object at all");

// ── JR-15..JR-24 · the lane is CHOSEN, never inferred ──────────────────────
const BATCH7 = { id: 7, batch_reference: "NAG/BAT/25-26/7" };
const BATCH9 = { id: 9, batch_reference: "NAG/BAT/25-26/9" };
const pickQuick = { lane: "quick", batchId: null };
const pickCustomer = batchId => ({ lane: "customer", batchId });

check(resolveLane(null, null).id === "undecided"
  && resolveLane(undefined, BATCH7).id === "undecided",
  "JR-15 with no selection the lane is undecided — a bound Batch does not answer the question");

check(resolveLane(pickQuick, null).id === "quick"
  && resolveLane(pickQuick, null).governed === false,
  "JR-16 an explicit Quick selection is the private lane");

// The requirement this whole model exists for.
check(resolveLane(pickQuick, BATCH7).id === "quick"
  && resolveLane(pickQuick, BATCH7).governed === false
  && resolveLane(pickQuick, BATCH7).provenance === "local",
  "JR-17 explicit Quick STAYS local even with a governed Batch bound elsewhere in state");

check(resolveLane(pickCustomer(null), null).id === "customer_pending"
  && resolveLane(pickCustomer(null), null).governed === false,
  "JR-18 choosing Customer quote without a created Batch cannot display governed authority");

check(resolveLane(pickCustomer("7"), BATCH7).id === "customer"
  && resolveLane(pickCustomer("7"), BATCH7).governed === true
  && resolveLane(pickCustomer(7), BATCH7).governed === true,
  "JR-19 the lane becomes governed only once the chosen Batch actually exists and is bound");

check(resolveLane(pickCustomer("7"), BATCH9).id === "customer_pending",
  "JR-20 until a Batch is bound to the selection itself, the lane cannot read as governed");

// The complementary guard, on the effect rather than the resolver: re-binding
// only ever moves WITHIN the customer lane. A quick-lane Maker who opens a
// governed Batch keeps their private lane.
check(laneSlice.includes('if (laneSelection?.lane !== "customer") return;')
  && laneSlice.indexOf('if (laneSelection?.lane !== "customer") return;')
    < laneSlice.indexOf("laneSelectionApplies(laneSelection, durableBatch)"),
  "JR-20a re-binding never fires in the quick or unchosen lane, so opening a Batch cannot promote private work");

check(resolveLane({ lane: "nonsense" }, BATCH7).id === "undecided"
  && resolveLane({ lane: null }, BATCH7).id === "undecided",
  "JR-21 an unrecognised stored value reads as never chosen, so the interface asks rather than assumes");

check(laneSelectionApplies(pickQuick, null) === true
  && laneSelectionApplies(pickCustomer("7"), BATCH7) === true
  && laneSelectionApplies(pickCustomer("7"), BATCH9) === false
  && laneSelectionApplies(pickCustomer("7"), null) === false
  && laneSelectionApplies(null, BATCH7) === false,
  "JR-22 a customer selection applies only to the Batch it was made for — new work inherits nothing");

check(LANE_CHOICES.length === 2
  && LANE_CHOICES[0].id === "quick" && LANE_CHOICES[0].summary === "Work privately in this browser"
  && LANE_CHOICES[1].id === "customer"
  && LANE_CHOICES[1].summary === "Save against a customer and use the governed quote workflow"
  && LANE_CHOICES.every(choice => choice.detail.length > 40),
  "JR-23 both choices are offered in outcome language, each with its consequence stated");

check(LANES.quick.provenance === "local" && LANES.customer_pending.provenance === "local"
  && LANES.undecided.provenance === "local" && LANES.customer.provenance === "governed"
  && LANES.customer_pending.governed === false,
  "JR-24 only the bound customer lane is governed; pending and undecided are local, whatever was chosen");

// ── JR-25..JR-32 · shareability belongs to a REVISION, never to a lane ─────
const rev = over => ({ id: 1, revision_number: 2, workflow_status: "draft",
  standing: "current", issued_at: null, ...over });

check(journeyState({ laneSelection: pickCustomer("7"), durableBatch: BATCH7 }).shareable === undefined,
  "JR-25 journeyState no longer reports shareable at all — it is not a property of a lane");

check(revisionShareability(rev({ workflow_status: "approved" })).shareable === true
  && revisionShareability(rev({ workflow_status: "draft" })).shareable === false
  && revisionShareability(rev({ workflow_status: "submitted" })).shareable === false,
  "JR-26 only an approved (or issued) revision may be described as shareable");

check(revisionShareability(rev({ workflow_status: "approved", standing: "superseded" })).shareable === false
  && revisionShareability(rev({ workflow_status: "approved", standing: "voided" })).shareable === false
  && revisionShareability(rev({ workflow_status: "issued", standing: "current" })).shareable === true,
  "JR-27 a superseded or voided revision is not shareable however it was approved");

const issuedRevision = revisionShareability(rev({ workflow_status: "issued",
  issued_at: "2026-09-11T12:00:00Z" }));
check(issuedRevision.shared === true && issuedRevision.shareable === true
  && revisionShareability(rev({ workflow_status: "approved" })).shared === false,
  "JR-28 'may be shared' and 'has been shared' are two separate facts (CDM-24)");

check(revisionShareability(null).shareable === false && revisionShareability(null).shared === false,
  "JR-29 no revision open is not shareable, and says so rather than defaulting to true");

// A governed Batch with no approved revision at all.
check(journeyState({ laneSelection: pickCustomer("7"), durableBatch: BATCH7,
  batchProfile: ROUTED, batchRows: [row(1)], batchResults: { 1: {} } }).lane.governed === true
  && revisionShareability(null).shareable === false,
  "JR-30 a governed Batch without an approved, frozen revision is not shareable");

check(artifactContext({ kind: "working" }).provenance === "local"
  && artifactContext({ kind: "working" }).shareable === false
  && artifactContext({ kind: "governed", revision: rev({ workflow_status: "approved" }) }).provenance === "immutable"
  && artifactContext({ kind: "governed", revision: rev({ workflow_status: "approved" }) }).shareable === true
  && artifactContext({ kind: "history", revision: rev({ workflow_status: "draft" }) }).shareable === false,
  "JR-31 each Quotes view gets its OWN artifact context — working, governed and history are independent");

check(artifactContext({ kind: "governed", revision: null }).shareable === false
  && artifactContext({ kind: "governed", revision: null }).label === "No revision open",
  "JR-32 a governed view with nothing selected claims no authority");

// ── JR-33..JR-40 · truthful result counts and readiness ────────────────────
const twoRows = [row(1), row(2)];

check(calculatedRowCount(twoRows, { 1: { rate: 10 }, 2: null }) === 1
  && calculatedRowCount(twoRows, { 1: { rate: 10 }, 2: undefined }) === 1
  && calculatedRowCount(twoRows, {}) === 0
  && calculatedRowCount(twoRows, { 1: { rate: 10 }, 2: { rate: 11 } }) === 2,
  "JR-33 a null or missing result is not counted merely because its key exists");

// The key count says 2 and the truth is 1 — the exact shape of the old defect.
check(Object.keys({ 1: { rate: 10 }, 2: null }).length === 2
  && calculatedRowCount(twoRows, { 1: { rate: 10 }, 2: null }) === 1,
  "JR-34 the refused-row case that made Object.keys(batchResults).length wrong is real, not hypothetical");

// Keys left behind by rows that have since been deleted.
check(calculatedRowCount([row(1)], { 1: { rate: 10 }, 99: { rate: 12 } }) === 1,
  "JR-35 a result left behind by a deleted row is not counted either");

const partial = sendReadiness([], { rowCount: 2, calculated: 1 });
check(partial.state === "partial" && partial.canSend === true
  && partial.items.length === 1 && partial.items[0].code === "results_incomplete"
  && partial.summary === "Send 1 of 2 rows"
  && !partial.summary.includes("Ready"),
  "JR-36 one calculated row out of two is a visible readiness problem, never 'Ready to send'");

check(partial.items[0].message.includes("leave 1 row out of the customer document")
  && partial.items[0].blocksSend === false,
  "JR-37 the partial item says what Send would actually do — create some items and leave rows out");

check(sendReadiness([], { rowCount: 2, calculated: 0 }).canSend === false
  && sendReadiness([], { rowCount: 2, calculated: 0 }).items[0].code === "not_calculated"
  && sendReadiness([], { rowCount: 2, calculated: 2 }).state === "ready"
  && sendReadiness([], { rowCount: 2, calculated: 2 }).items.length === 0
  && sendReadiness([], { rowCount: 0, calculated: 0 }).state === "empty",
  "JR-38 the other readiness states are unchanged: nothing calculated blocks, everything calculated is ready");

const blockedReadiness = sendReadiness(many, { rowCount: 2, calculated: 2 });
check(blockedReadiness.state === "blocked" && blockedReadiness.canSend === false
  && blockedReadiness.summary === `${blockedReadiness.items.length} to fix before sending`
  && firstRefusal(many, "send") !== null,
  "JR-39 a refusal makes the summary and the Send control agree that Send is not permitted");

check(journeyState({ laneSelection: pickQuick, batchProfile: ROUTED, batchRows: twoRows,
  batchResults: { 1: { rate: 10 }, 2: null } }).counts.toFix === 1,
  "JR-40 the count the TopBar renders comes from that same readiness list, so it cannot disagree");

// ── JR-41..JR-46 · the Next action points at something real ────────────────
const readyLocal = journeyState({ laneSelection: pickQuick, batchProfile: ROUTED,
  batchRows: [row(1)], batchResults: { 1: { rate: 10 } }, quoteItems: [] });
check(readyLocal.next.surface === "batch" && readyLocal.next.focus === FOCUS.send
  && readyLocal.next.label === "Send the rows to Quote Items",
  "JR-41 fully calculated rows with no Quote Items point at the Send control, on the screen that has it");

const unchosen = journeyState({ batchProfile: ROUTED, batchRows: [row(1)] });
check(unchosen.next.focus === FOCUS.lane
  && unchosen.next.label === "Choose how this work is saved",
  "JR-42 with no lane chosen the next action is the choice itself, focusing the lane control");

check(journeyState({ laneSelection: pickCustomer(null), batchProfile: ROUTED,
  batchRows: [row(1)] }).next.label === "Create or open the governed Batch",
  "JR-43 a pending customer-quote selection is told the Batch does not exist yet");

const halfDone = journeyState({ laneSelection: pickQuick, batchProfile: ROUTED,
  batchRows: twoRows, batchResults: { 1: { rate: 10 } } });
check(halfDone.next.focus === FOCUS.calculate
  && halfDone.next.label === "Calculate the remaining rows",
  "JR-44 a partly calculated batch is sent back to Calculate, not forward to the document");

const governedReady = journeyState({ laneSelection: pickCustomer("7"), durableBatch: BATCH7,
  batchProfile: ROUTED, batchRows: [row(1)], batchResults: { 1: {} }, quoteItems: [{}] });
check(governedReady.next.surface === "batch" && governedReady.next.focus === FOCUS.workspace
  && governedReady.lane.governed === true,
  "JR-45 the governed lane is pointed at the Batch workspace, where governed Calculate and Send live");

check(Object.values(FOCUS).every(id => typeof id === "string" && id.startsWith("journey-"))
  && new Set(Object.values(FOCUS)).size === Object.keys(FOCUS).length,
  "JR-46 every focus target is a distinct, namespaced control id");

// ── JR-47..JR-49 · stage stays truthful in mixed states ────────────────────
check(journeyState({ laneSelection: pickQuick, batchProfile: ROUTED, batchRows: twoRows,
  batchResults: {}, quoteItems: [{}, {}] }).stage === "products",
  "JR-47 leftover Quote Items cannot advance the stage past the current batch");

check(journeyState({ laneSelection: pickCustomer("7"), durableBatch: BATCH7,
  batchProfile: ROUTED, batchRows: twoRows, batchResults: { 1: { rate: 10 }, 2: null },
  quoteItems: [{}] }).stage === "price",
  "JR-48 a governed lane does not lift the stage either — the batch is still part-calculated");

check(STAGES.length === 7 && STAGES.every(s => s.id && s.label && s.question && s.surface)
  && STAGES[0].id === "customer" && STAGES[STAGES.length - 1].id === "shared",
  "JR-49 the stage list runs from the customer to the shared revision, and every stage states its question");

// ── JR-50..JR-66 · the wiring, and the words on the controls ───────────────
check(actions.includes('import { calculatedRowCount, firstRefusal, journeyState, localWorkBlockers, sendReadiness } from "../lib/quoteJourney.js"')
  && actions.includes("firstRefusal(localWorkBlockers({batchRows,batchProfile,")
  && actions.includes('firstRefusal(localBlockers(),"send")'),
  "JR-50 calculateAll and sendAllToQuoteItems refuse THROUGH the shared model");

check(!actions.includes("Confirm SET Codes first:")
  && !actions.includes("Stale results — run Calculate All first")
  && !actions.includes("Select Avadhoot Plant and Client Plant in the Batch Profile"),
  "JR-51 no refusal message survives as a second copy inside useQuoteActions");

check(actions.includes("const localBlockers=()=>localWorkBlockers(")
  && actions.indexOf("const getBatchRowStatus=") < actions.indexOf("const localBlockers="),
  "JR-52 localBlockers is defined below getBatchRowStatus, which its stale check calls");

check(actions.includes("window.confirm(`Quote Items currently has")
  && actions.includes("Cobb ≤ 125 g/m² — Missing Coating Charge"),
  "JR-53 the two CONFIRMATIONS stay in the action — they are prompts the Maker may accept, not readiness facts");

check(actions.includes("const journey=journeyState({laneSelection,durableBatch,")
  && actions.includes("const quoteReadiness=sendReadiness(quoteBlockers,")
  && actions.includes("calculated:calculatedRowCount(batchRows,batchResults)")
  && !/calculated:Object\.keys\(batchResults\)\.length/.test(actions),
  "JR-54 the shell's readiness is built from the truthful row count, never from the results map's keys");

check(!grid.includes("Object.keys(batchResults).length===0")
  && grid.includes("disabled={!quoteReadiness.canSend}")
  && grid.includes("<SendReadiness readiness={quoteReadiness}/>"),
  "JR-55 the Send button and the readiness chip read ONE verdict, so they cannot describe different behaviour");

check(topBar.includes("journey.counts.toFix") && topBar.includes("journey.readiness.canSend")
  && grid.includes("readiness.items.map"),
  "JR-56 the TopBar count and the toolbar list come from exactly the same checklist");

check(laneSlice.includes('const LANE_KEY = "cbb_quote_lane"')
  && laneSlice.includes('from "../lib/persist.js"')
  && laneSlice.includes('parsed?.lane === "quick" || parsed?.lane === "customer"'),
  "JR-57 the lane choice is persisted through the one persistence seam, and only real answers are honoured");

check(laneSlice.includes("const bindGovernedBatch = useCallback(batch => {")
  && laneSlice.includes("if (!batch?.id) return;")
  && newBatch.includes("bindGovernedBatch?.(data.batch);")
  && newBatch.indexOf("completeNewBatchStart(data.batch);") < newBatch.indexOf("bindGovernedBatch?.(data.batch);"),
  "JR-58 a selection becomes governed in ONE place, and only after the Batch actually came back");

check(laneSlice.includes("invalidateAllBatchResults?.();")
  && laneSlice.includes("promotionRef.current")
  && /Local prices were cleared/.test(laneSlice)
  && laneSlice.includes("const isPromoting = useCallback(() => !!promotionRef.current, []);"),
  "JR-59 promoting local work into a Customer quote clears the local prices and requires governed recalculation");

// The half that a toast cannot prove: the rows really are kept, and the results
// really are cleared, by the function that does the clearing.
check(bridge.includes("const completeNewBatchStart=(governedBatch=null,{keepLocalInputs=false}={})=>{")
  && bridge.includes("if(!keepLocalInputs)setBatchRows([]);")
  && /ALWAYS cleared, including on a promotion/.test(bridge)
  && bridge.includes("setBatchResults({});")
  && bridge.includes("client:batchProfile.client,delivery:batchProfile.delivery,"),
  "JR-59a a promotion KEEPS the rows and the customer/route, and clears every local price");

check(newBatch.includes("completeNewBatchStart(data.batch, { keepLocalInputs: isPromoting?.() === true });")
  && newBatch.includes("Keeps your SKU rows as inputs and keeps the customer and route."),
  "JR-59b the creation panel passes the promotion through and states which of the two outcomes applies");

check(newBatch.includes("returnToQuickCalculation?.();"),
  "JR-60 backing out of governed creation drops the customer-quote intent rather than leaving it pending");

check(laneSlice.includes("laneSelectionApplies(laneSelection, durableBatch)")
  && laneSlice.includes("if (promotionRef.current) return;")
  && laneSlice.includes("const clearLaneSelection ="),
  "JR-61 reopening a Batch the selection already covers does not ask again; new work clears the selection");

check(grid.includes("<LaneControl lane={journey.lane}")
  && grid.includes("id={FOCUS.lane}") && grid.includes("id={FOCUS.send}")
  && grid.includes("id={FOCUS.calculate}") && grid.includes("id={FOCUS.workspace}"),
  "JR-62 every control the Next action names exists on the toolbar and carries its id");

check(topBar.includes("document.getElementById(focus)") && topBar.includes("el.focus({ preventScroll: true })")
  && topBar.includes('const JOURNEY_TABS = new Set(["costing", "batch"])')
  && topBar.includes('quoteView === "working-items"'),
  "JR-63 Next focuses the named control, and the journey cue is absent from the governed and history views");

check(governedView.includes("<ShareabilityNote {...revisionShareability(revision)} />")
  && historyView.includes("<ShareabilityNote {...revisionShareability(selectedRevision)} />")
  && !governedView.includes("journey.lane") && !historyView.includes("journey.lane"),
  "JR-64 governed and history views state their OWN revision's authority, never the current work's lane");

check(costing.includes("Private draft · this browser only")
  && costing.includes("Session copy · not saved until Push")
  && costing.includes('ch="✕ Close review"') && !costing.includes('ch="✕ Unlink"')
  && costing.includes("→ Add to batch"),
  "JR-65 Costing says it is a private draft, and its exit and handoff verbs name the user's outcome");

check(provider.includes("Object.assign(st, useQuoteLane(st));")
  && provider.indexOf("useQuoteLane(st)") < provider.indexOf("useQuoteActions(st)")
  && provider.indexOf("usePricingBasisState()") < provider.indexOf("useQuoteLane(st)"),
  "JR-66 the lane slice is composed after the Batch binding it reads and before the journey that consumes it");

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
console.log("Quote journey fixture gate PASS");
