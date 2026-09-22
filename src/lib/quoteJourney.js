// ═══════════════════════════════════════════════════════════════════════════
// src/lib/quoteJourney.js — the commercial journey, as one pure model.
//
// WHY THIS EXISTS
// The application already knows everything a Maker needs in order to answer
// "where am I, what is this button going to do, and what is left?". It just
// never says it in one place: the governed lane has `durableBatchPreparation`
// (batchRowModel.js) and a readiness panel, while the local lane discovers its
// blockers only AFTER the click, inside `calculateAll` / `sendAllToQuoteItems`,
// and reports them as toasts that disappear
// (cost-calculation-journey-ux-review-2026-09-22.md, CC-10/CC-13/CC-29).
//
// So this module is the LOCAL lane's equivalent of `durableBatchPreparation`,
// plus the small amount of arithmetic that names the stage of the journey.
//
// ── THE ONE RULE THAT MAKES THIS SAFE ──────────────────────────────────────
// `localWorkBlockers` is not a second opinion about readiness. It is THE
// implementation: `useQuoteActions.calculateAll` and `sendAllToQuoteItems`
// call it and refuse on exactly what it returns, in exactly its order, with
// exactly its `message`. A blocker shown in the toolbar and a blocker raised
// by the click are therefore the same object by construction, and cannot
// drift apart the way a duplicated checklist would.
//
// The two CONFIRMATIONS (client mismatch, Cobb-without-coating) deliberately
// stay in `useQuoteActions`: they are `window.confirm` prompts the Maker may
// answer "proceed" to, not refusals, so they are not readiness facts.
//
// ── LANES AND AUTHORITY ────────────────────────────────────────────────────
// CDM-02 settles the authority, and this module only reports it:
//   • START is a private browser-local scratchpad;
//   • durable work begins only through explicit Create New Batch;
//   • Batch Entry alone calculates;
//   • Atomic Send freezes a complete Quote candidate.
// Nothing here decides anything. It renames already-settled state into the
// words a salesperson uses, so the interface can stop asking the user to
// infer the lane from which screen they happen to be standing on.
//
// Pure: no React, no state, no persistence, no network. Everything arrives as
// an argument, so the fixtures (scripts/journey-fixtures.mjs) can drive it.
// ═══════════════════════════════════════════════════════════════════════════

// ── Lanes ──────────────────────────────────────────────────────────────────
// WHICH LANE THE WORK IS IN IS A CHOICE THE USER MAKES, NOT A FACT WE INFER.
//
// The first version of this module read `durableBatch?.id ? governed : local`.
// That is wrong in the one case that matters: a Maker who opens a governed
// Batch to look at it, then does a quick private calculation, had their private
// work described as a Customer quote. Binding a Batch is not consent, and a
// screen that says "Customer quote" over browser-local rows is lying about
// authority.
//
// So the lane has TWO inputs and the strictest one wins:
//
//   1. an EXPLICIT, persisted selection the user made ("quick" | "customer");
//   2. the actual authority of the artifact in front of them.
//
// A selection alone can never manufacture authority: choosing "Customer quote"
// puts the work in `customer_pending` until a governed Batch has actually been
// created or opened and bound to that selection. Only then does the interface
// say "Customer quote". This is the rule that keeps user confirmation a choice
// of WORKFLOW rather than a grant of authority.
export const LANES = {
  undecided: {
    id: "undecided", label: "Lane not chosen", provenance: "local", governed: false,
    authority: "Choose whether this is a private quick calculation or a customer quote",
  },
  quick: {
    id: "quick", label: "Quick calculation", provenance: "local", governed: false,
    authority: "This browser only — no Quote reference, no persisted calculation evidence",
  },
  // Chosen, but the governed Batch does not exist or is not bound yet. It must
  // never render as governed: nothing is saved against a customer yet.
  customer_pending: {
    id: "customer_pending", label: "Customer quote — not started", provenance: "local", governed: false,
    authority: "You chose the customer-quote workflow, but no governed Batch has been created or opened yet",
  },
  customer: {
    id: "customer", label: "Customer quote", provenance: "governed", governed: true,
    authority: "Saved against a Customer and Plant. Calculation and Send are governed operations, and are separate from approval and sharing",
  },
};

// The two choices, in the words of the outcome rather than of the data model.
// One place, so the chooser, the confirmations and the fixtures agree.
export const LANE_CHOICES = [
  { id: "quick", label: "Quick calculation",
    summary: "Work privately in this browser",
    detail: "Nothing is saved against a customer. No Quote reference, no persisted calculation evidence, and it can never be approved or shared as a quote.",
  },
  { id: "customer", label: "Customer quote",
    summary: "Save against a customer and use the governed quote workflow",
    detail: "Creates or opens a governed Batch with a permanent Batch reference. Calculation and Send are governed operations; approval and sharing are separate steps after that.",
  },
];

/**
 * The lane the interface may truthfully display.
 *
 * @param {object|null} selection    persisted `{lane, batchId}`, or null if never chosen
 * @param {object|null} durableBatch the governed Batch currently bound, if any
 */
export function resolveLane(selection, durableBatch) {
  const chosen = selection?.lane;
  if (chosen !== "quick" && chosen !== "customer") return LANES.undecided;
  if (chosen === "quick") return LANES.quick;
  // "customer" chosen: it only becomes governed once a Batch is bound AND that
  // Batch is the one the selection was made for. A selection recorded against
  // Batch 7 must not silently adopt Batch 9 that someone opened to look at.
  const bound = durableBatch?.id != null
    && String(selection.batchId ?? "") === String(durableBatch.id);
  return bound ? LANES.customer : LANES.customer_pending;
}

// Is this lane selection still about the work in front of the user? A selection
// carries the Batch it was made for; new work with no Batch must not inherit a
// previous customer's governed selection.
export function laneSelectionApplies(selection, durableBatch) {
  if (!selection?.lane) return false;
  if (selection.lane === "quick") return true;
  return durableBatch?.id != null
    && String(selection.batchId ?? "") === String(durableBatch.id);
}

// ── Artifact authority ─────────────────────────────────────────────────────
// The Quotes area shows three different things: local Working Quote Items, a
// governed Quote revision, and a historical revision. Each has its OWN
// provenance, and none of them is "whatever lane the current Batch Builder work
// happens to be in". Showing the current lane over an immutable 2026 revision
// would attribute the wrong authority to frozen evidence.
//
// CDM-24: approval and Issue to Customer are separate, and download alone never
// proves issuance. So "may be shared" and "has been shared" are two facts.
export function revisionShareability(revision) {
  if (!revision) return { shareable: false, shared: false,
    reason: "No Quote revision is open." };
  const status = revision.workflow_status || "draft";
  const standing = revision.standing || "current";
  const shared = !!revision.issued_at;
  if (standing === "voided" || status === "voided") {
    return { shareable: false, shared, reason: "This revision is voided." };
  }
  if (status !== "approved" && status !== "issued") {
    return { shareable: false, shared,
      reason: `This revision is ${status.replaceAll("_", " ")}. A customer quote may be shared only after Checker approval.` };
  }
  if (standing === "superseded") {
    return { shareable: false, shared,
      reason: "A later revision has superseded this one. Share the current revision instead." };
  }
  return { shareable: true, shared,
    reason: shared ? "Approved and already issued to the customer."
      : "Approved and current — this is the revision a customer may be given." };
}

/**
 * The provenance cue for whatever artifact a Quotes view is displaying.
 * `kind` is "working" | "governed" | "history"; `revision` is required for the
 * latter two and is the ONLY thing that decides their authority.
 */
export function artifactContext({ kind, revision = null } = {}) {
  if (kind === "working") {
    return { kind, provenance: "local", label: "Working items",
      authority: "Kept in this browser only — not a governed Quote revision, and never shareable as one",
      shareable: false, shared: false };
  }
  const { shareable, shared, reason } = revisionShareability(revision);
  return {
    kind, provenance: "immutable",
    label: revision ? `Revision ${revision.revision_number ?? "—"}` : "No revision open",
    authority: revision
      ? `Frozen evidence · ${(revision.workflow_status || "draft").replaceAll("_", " ")}`
        + `${revision.standing ? ` · ${revision.standing}` : ""}`
      : "Select a Quote revision to see its recorded authority",
    shareable, shared, reason,
  };
}

// ── Stages ─────────────────────────────────────────────────────────────────
// The commercial journey, named once. `surface` is the destination that owns
// the stage, so "what should I do next" can also answer "where".
export const STAGES = [
  { id: "customer", label: "Customer", surface: "batch",
    question: "Who am I quoting?" },
  { id: "products", label: "Products", surface: "batch",
    question: "Which products and quantities are included?" },
  { id: "price", label: "Price", surface: "batch",
    question: "What does it cost, and is the calculation current?" },
  { id: "review", label: "Review", surface: "batch",
    question: "What is incomplete or unsafe?" },
  { id: "document", label: "Customer document", surface: "items",
    question: "What will the customer receive?" },
  { id: "approval", label: "Approval", surface: "items",
    question: "Does this require approval before it is shared?" },
  { id: "shared", label: "Shared", surface: "items",
    question: "Has this exact revision been shared?" },
];

export const stageIndex = id => STAGES.findIndex(stage => stage.id === id);

// ── Blocker vocabulary ─────────────────────────────────────────────────────
// `gate` says which action a blocker stops. `calculate` blockers also stop
// Send, because an uncalculated row cannot become a Quote Item; `send`
// blockers do not stop Calculate, which is how the Maker clears them.
//
// `message` is the exact text the refusing action raises. It lives here so the
// toolbar's list and the toast cannot describe the same refusal differently.
const rowLabel = (row, rows) => `Row ${rows.indexOf(row) + 1}${row.matCode ? ` [${row.matCode}]` : ""}`;

/**
 * Every reason the local lane cannot proceed, in the order the actions check
 * them. Callers pass their own helpers so this module imports no engine code.
 *
 * @param {object}   args
 * @param {Array}    args.batchRows
 * @param {object}   args.batchProfile
 * @param {Array}    args.constructionCatalogue
 * @param {function} args.isUsableConstruction  (entry) => boolean
 * @param {function} args.rowStatus             (row) => status string
 * @returns {Array<{code,gate,title,message,rows}>}
 */
export function localWorkBlockers({ batchRows = [], batchProfile = {},
  constructionCatalogue = [], isUsableConstruction = () => true, rowStatus = null } = {}) {
  const blockers = [];

  // 1. SET Codes — an assumed SET Code on a non-Box row is a guess about which
  //    pieces belong together, so it may not reach a price at all.
  const unconfirmed = batchRows.filter(row => row.itemType !== "Box" && row.setCodeAssumed);
  if (unconfirmed.length) {
    const list = unconfirmed.map(row => rowLabel(row, batchRows)).join(", ");
    blockers.push({ code: "set_code_assumed", gate: "calculate", duration: 6000,
      title: `Confirm ${unconfirmed.length} assumed SET Code${unconfirmed.length === 1 ? "" : "s"}`,
      message: `⚠️ Confirm SET Codes first: ${list} — click the orange ! in its SET Code`,
      rows: unconfirmed.map(row => row.id) });
  }

  // 2. Constructions — a construction that exists but is missing grade/BF or a
  //    positive GSM on a structural layer cannot be costed.
  const incomplete = batchRows.filter(row => {
    const entry = constructionCatalogue.find(item => item.code === row.constructionCode);
    return entry && !isUsableConstruction(entry);
  });
  if (incomplete.length) {
    const list = incomplete.map(row => rowLabel(row, batchRows)).join(", ");
    blockers.push({ code: "construction_incomplete", gate: "calculate", duration: 7000,
      title: `Complete ${incomplete.length} Construction${incomplete.length === 1 ? "" : "s"}`,
      message: `❌ Incomplete construction — paper grade/BF and positive GSM are required on every structural layer: ${list}`,
      sendMessage: `❌ Cannot send: incomplete construction on ${list}. Select a construction with grade/BF and positive GSM on every structural layer.`,
      rows: incomplete.map(row => row.id) });
  }

  // 3. Route — the workbook needs a Producing Plant and a Client Plant before
  //    anything can be presented as a quote.
  if (!batchProfile.plant || !batchProfile.delivery) {
    blockers.push({ code: "route_unresolved", gate: "send", duration: 5000,
      title: "Set Producing Plant and Client Plant",
      message: "❌ Select Avadhoot Plant and Client Plant in the Batch Profile before sending to Quote Items",
      rows: [] });
  }

  // 4. Stale results — inputs changed after the last calculation, so the
  //    figures on screen are not the figures those inputs produce.
  if (typeof rowStatus === "function") {
    const stale = batchRows.filter(row => rowStatus(row) === "stale");
    if (stale.length) {
      const list = stale.map(row => rowLabel(row, batchRows)).join(", ");
      blockers.push({ code: "results_stale", gate: "send", duration: 6000,
        title: `Recalculate ${stale.length} changed row${stale.length === 1 ? "" : "s"}`,
        message: `🔄 Stale results — run Calculate All first. Affected: ${list}`,
        rows: stale.map(row => row.id) });
    }
  }

  return blockers;
}

// The refusal the action raises, or null when nothing refuses it. `gate` is
// "calculate" or "send"; Send is stopped by both kinds, Calculate by its own.
export function firstRefusal(blockers, gate) {
  const relevant = gate === "send" ? blockers
    : blockers.filter(blocker => blocker.gate === "calculate");
  const refusal = relevant[0];
  if (!refusal) return null;
  return { ...refusal,
    text: gate === "send" && refusal.sendMessage ? refusal.sendMessage : refusal.message };
}

// How many of these rows actually have a usable result RIGHT NOW.
//
// Never `Object.keys(batchResults).length`. That map keeps a key for every row
// Calculate All touched, including rows it refused (`newResults[row.id]=null`),
// and it keeps keys for rows that have since been deleted. A two-row batch
// where one row was refused has two keys and one price, so the key count said
// "calculated" while Send silently skipped half the batch.
export function calculatedRowCount(batchRows = [], batchResults = {}) {
  return batchRows.filter(row => batchResults?.[row.id]).length;
}

// Everything the Maker must still deal with before Send, as ONE list, so the
// toolbar's "N to fix" and the TopBar's "N to fix" are the same N.
//
// Two items live here rather than in `localWorkBlockers`, and for the same
// reason: neither is a refusal Send raises. Putting either in the blocker
// register would make `firstRefusal` hand back a message the action never
// shows, which is precisely the drift this module exists to prevent.
//
//   • `not_calculated`     — the condition that DISABLES Send.
//   • `results_incomplete` — Send is permitted, but it will leave the rows
//                            without a result OUT of the customer document and
//                            report them afterwards. That is correct behaviour
//                            (a row refused for unresolved freight must not
//                            block the rest of the batch), but a batch that
//                            silently drops rows must never be called "ready".
export function sendChecklist(blockers = [], { rowCount = 0, calculated = 0 } = {}) {
  if (!rowCount) return [];
  if (calculated === 0) {
    return [{ code: "not_calculated", title: "Calculate the batch first",
      message: `None of the ${rowCount} row${rowCount === 1 ? "" : "s"} has a price yet. Run Calculate All.`,
      blocksSend: true },
    ...blockers];
  }
  if (calculated < rowCount) {
    const missing = rowCount - calculated;
    return [{ code: "results_incomplete",
      title: `${missing} row${missing === 1 ? "" : "s"} still ${missing === 1 ? "has" : "have"} no price`,
      message: `Send would create ${calculated} item${calculated === 1 ? "" : "s"} and leave ${missing} row${missing === 1 ? "" : "s"} out of the customer document. Run Calculate All, or fix the ${missing === 1 ? "row" : "rows"} it refused.`,
      blocksSend: false },
    ...blockers];
  }
  return blockers;
}

// What the Send control is permitted to do, in one sentence, derived from the
// SAME checklist the toolbar renders. The toolbar's summary, the TopBar's count
// and the button's enabled state all read this, so they cannot describe three
// different behaviours.
export function sendReadiness(blockers = [], { rowCount = 0, calculated = 0 } = {}) {
  const items = sendChecklist(blockers, { rowCount, calculated });
  if (!rowCount) return { state: "empty", items, canSend: false, summary: "No rows yet" };
  const refusal = firstRefusal(blockers, "send");
  if (calculated === 0) {
    return { state: "blocked", items, canSend: false,
      summary: "Calculate before sending" };
  }
  if (refusal) {
    return { state: "blocked", items, canSend: false,
      summary: `${items.length} to fix before sending` };
  }
  if (calculated < rowCount) {
    return { state: "partial", items, canSend: true,
      summary: `Send ${calculated} of ${rowCount} rows` };
  }
  return { state: "ready", items, canSend: true, summary: "Ready to send" };
}

// Control names the shell can focus. Strings rather than refs so the pure model
// stays pure and the fixtures can assert them.
export const FOCUS = {
  lane: "journey-lane-control",
  calculate: "journey-calculate-control",
  send: "journey-send-control",
  workspace: "journey-workspace-control",
};

// ── Stage and next action ──────────────────────────────────────────────────
// Derived only from state that already exists. The governed lane's own
// readiness stays with `durableBatchPreparation`; this reports which lane the
// user chose, how far the current work has got, and what it still owes.
/**
 * @param {object} args
 * @param {object|null} args.laneSelection     persisted `{lane, batchId}` or null
 * @param {object|null} args.durableBatch      bound governed Batch, if any
 * @param {Array}  args.batchRows
 * @param {object} args.batchResults           { [rowId]: result|null }
 * @param {object} args.batchProfile
 * @param {Array}  args.quoteItems             local Working Quote Items
 * @param {Array}  args.blockers               from localWorkBlockers
 * @param {boolean} args.hasScratchDraft       a START draft exists but no rows
 */
export function journeyState({ laneSelection = null, durableBatch = null, batchRows = [],
  batchResults = {}, batchProfile = {}, quoteItems = [], blockers = [],
  hasScratchDraft = false } = {}) {
  const lane = resolveLane(laneSelection, durableBatch);
  const calculated = calculatedRowCount(batchRows, batchResults);
  const sendBlockers = blockers;
  const calcBlockers = blockers.filter(blocker => blocker.gate === "calculate");
  const readiness = sendReadiness(sendBlockers,
    { rowCount: batchRows.length, calculated });

  // The stage is the FURTHEST point the CURRENT work has actually reached, not
  // the screen the user happens to be on. A screen is a place; a stage is a
  // fact.
  //
  // Each step requires the one before it. Written as a ladder rather than a
  // series of independent overwrites because the overwriting version could
  // claim a late stage on an early batch: Working Quote Items outlive the rows
  // that produced them (they persist in `cbb_quoteitems`), so a NEW batch with
  // two uncalculated rows read as "Customer document" while the next action
  // correctly said "Confirm 1 assumed SET Code". A stage that disagrees with
  // the next action is worse than no stage at all.
  const batchComplete = batchRows.length > 0 && calculated === batchRows.length
    && sendBlockers.length === 0;
  let stage = "customer";
  if (batchProfile.client) stage = "products";
  if (stage === "products" && calculated > 0) stage = "price";
  if (stage === "price" && batchComplete) stage = "review";
  if (stage === "review" && quoteItems.length) stage = "document";

  // One next action, phrased as an outcome and located on a surface. The
  // branches are ordered by what the Maker must do FIRST, so the first true one
  // is always the earliest unfinished thing.
  //
  // `focus` names a control on that surface. A Next action that navigates
  // somewhere the required control ISN'T is worse than none: "Build the
  // customer document" used to send the Maker to an empty Working Quote Items
  // view, while the control that fills it — Send All to Quote Items — stayed
  // behind on Batch Builder.
  let next;
  if (!laneSelection?.lane) {
    next = { label: "Choose how this work is saved", surface: "batch",
      focus: FOCUS.lane,
      detail: "A quick calculation stays private in this browser. A customer quote is saved against the customer and goes through approval." };
  } else if (lane.id === "customer_pending") {
    next = { label: "Create or open the governed Batch", surface: "batch",
      focus: FOCUS.lane,
      detail: "You chose the customer-quote workflow. Nothing is governed until the Batch exists — until then this is still browser-local work." };
  } else if (!batchProfile.client) {
    next = { label: "Name the customer you are quoting", surface: "batch",
      detail: "Open Batch Profile and set the Customer, Sector and route." };
  } else if (!batchRows.length) {
    next = { label: "Add the products being quoted", surface: "batch",
      detail: hasScratchDraft
        ? "Your Start Costing draft is not in the batch yet — send it to Batch Builder, or add a row directly."
        : "Add a Box, Plate or Partition row in Batch Builder." };
  } else if (calcBlockers.length) {
    next = { label: calcBlockers[0].title, surface: "batch", detail: calcBlockers[0].message };
  } else if (calculated === 0) {
    next = { label: "Calculate the batch", surface: "batch", focus: FOCUS.calculate,
      detail: `None of the ${batchRows.length} rows has a price yet.` };
  } else if (sendBlockers.length) {
    next = { label: sendBlockers[0].title, surface: "batch", detail: sendBlockers[0].message };
  } else if (calculated < batchRows.length) {
    next = { label: "Calculate the remaining rows", surface: "batch", focus: FOCUS.calculate,
      detail: `${batchRows.length - calculated} of ${batchRows.length} rows have no current result. Sending now would leave them out of the customer document.` };
  } else if (!quoteItems.length) {
    // STAYS ON BATCH BUILDER. The control that builds the document is here.
    next = { label: "Send the rows to Quote Items", surface: "batch", focus: FOCUS.send,
      detail: "Send All to Quote Items is on this toolbar. It builds the working items the Excel and PDF are produced from." };
  } else if (lane.governed) {
    next = { label: "Open the governed Batch workspace", surface: "batch", focus: FOCUS.workspace,
      detail: "Governed Calculate and Atomic Send happen in the Batch workspace. Submit, approval and sharing are separate steps after that." };
  } else {
    next = { label: "Review the customer document", surface: "items",
      detail: "This is a quick calculation — it carries no governed Quote reference and cannot be approved or shared as a quote." };
  }

  return {
    lane, stage, stageLabel: STAGES[stageIndex(stage)]?.label || "",
    stages: STAGES, next, readiness,
    counts: { rows: batchRows.length, calculated, items: quoteItems.length,
      blockers: sendBlockers.length,
      // The number the shell shows. Same list the Batch Builder toolbar
      // renders, so the two cannot disagree.
      toFix: readiness.items.length },
    // Deliberately NOT on this object any more. Whether something may be shown
    // to a customer is a property of an approved, current Quote REVISION
    // (CDM-21, CDM-24) — never of the lane the Maker happens to be working in.
    // Ask `revisionShareability(revision)` or `artifactContext(...)`.
  };
}

