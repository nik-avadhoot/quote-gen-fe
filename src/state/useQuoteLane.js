// ═══════════════════════════════════════════════════════════════════════════
// src/state/useQuoteLane.js — the explicit, persisted lane choice.
//
// WHAT THIS OWNS
// One question the user answers once per piece of quote work: is this a
// private Quick calculation, or a Customer quote going through the governed
// workflow? The answer is persisted with the working context (`cbb_quote_lane`,
// through the lib/persist.js seam) so it survives navigation, a reload and
// reopening a Batch.
//
// WHAT THIS DOES NOT DO — and the reason the file exists at all
// It never grants authority. Choosing "Customer quote" records an INTENT; the
// lane only reads as governed once a governed Batch has actually been created
// or opened and its id matches the id stored with the selection
// (`resolveLane`, lib/quoteJourney.js). Until then the work is still
// browser-local and the interface says so. User confirmation picks a workflow;
// the database decides what is authoritative.
//
// COMPOSITION
// Must be composed AFTER usePricingBasisState (needs `durableBatch`),
// useBatchState (needs `batchRows`/`setBatchResults`) and useCostingBatchBridge
// (needs `startNewBatch`), and BEFORE useQuoteActions, which reads the resolved
// selection into the journey model.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import { getItem, setItem } from "../lib/persist.js";
import { laneSelectionApplies } from "../lib/quoteJourney.js";
import { isS1ActiveBrowserFixture, S1_ACTIVE_BATCH } from "../lib/s1BrowserFixture.js";

const LANE_KEY = "cbb_quote_lane";

function readSelection() {
  try {
    const raw = getItem(LANE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Only the two real answers are honoured. Anything else — a hand-edited
    // key, a value from a future build — reads as "never chosen", which makes
    // the interface ask rather than assume.
    return parsed?.lane === "quick" || parsed?.lane === "customer" ? parsed : null;
  } catch { return null; }
}

export function useQuoteLane(st) {
  const { batchRows, durableBatch, invalidateAllBatchResults, setNewBatchDialogOpen,
    showToast } = st;
  const [laneSelection, setLaneSelectionState] = useState(() =>
    isS1ActiveBrowserFixture()
      ? { lane: "customer", batchId: String(S1_ACTIVE_BATCH.id), chosenAt: 1 }
      : readSelection());
  // A promotion in flight: the user chose Customer quote and the governed Batch
  // creation panel is open. Held in a ref because it must survive the renders
  // between opening the panel and the Batch coming back, without causing any.
  const promotionRef = useRef(null);

  const persist = useCallback(next => {
    setLaneSelectionState(next);
    try {
      if (next) setItem(LANE_KEY, JSON.stringify(next));
      else setItem(LANE_KEY, "");
    } catch { /* storage unavailable — the choice just won't survive a reload */ }
  }, []);

  // ── The choice ────────────────────────────────────────────────────────────
  const chooseQuick = useCallback(() => {
    promotionRef.current = null;
    persist({ lane: "quick", batchId: null, chosenAt: Date.now() });
  }, [persist]);

  // Choosing "Customer quote" records the intent and opens governed creation.
  // It deliberately does NOT bind a Batch: `resolveLane` keeps the lane in
  // `customer_pending` — visibly not governed — until one exists.
  const chooseCustomerQuote = useCallback(({ promote = false } = {}) => {
    promotionRef.current = promote
      ? { rowCount: Array.isArray(batchRows) ? batchRows.length : 0 }
      : null;
    persist({ lane: "customer", batchId: null, chosenAt: Date.now() });
    setNewBatchDialogOpen?.(true);
  }, [batchRows, persist, setNewBatchDialogOpen]);

  // ── Transitions ───────────────────────────────────────────────────────────
  // True while a promotion is in flight, so the governed-creation panel can ask
  // completeNewBatchStart to KEEP the local rows instead of clearing them, and
  // can say so in its own impact summary before the user commits.
  const isPromoting = useCallback(() => !!promotionRef.current, []);

  // Called by the governed-creation panel once a Batch actually exists. This is
  // the ONLY place a selection becomes governed.
  const bindGovernedBatch = useCallback(batch => {
    if (!batch?.id) return;
    persist({ lane: "customer", batchId: String(batch.id), chosenAt: Date.now() });
    const promotion = promotionRef.current;
    promotionRef.current = null;
    if (promotion?.rowCount) {
      // The inputs were carried over; their LOCAL results were not, and must
      // not be. A browser-local number cannot become governed evidence by
      // being looked at inside a governed Batch (CDM-02, CDM-22) — it has to
      // be produced by the trusted executor. Clearing them here is what makes
      // "copy the inputs, require governed recalculation" true rather than a
      // sentence in a tooltip.
      invalidateAllBatchResults?.();
      showToast?.(
        `Inputs kept for ${batch.batch_reference}. Local prices were cleared — `
        + "create the governed rows in the Batch workspace and run governed Calculate.",
        "info", 9000);
    }
  }, [invalidateAllBatchResults, persist, showToast]);

  // Customer quote -> Quick. The governed Batch is left exactly as it is: this
  // changes which lane the user is WORKING in, never the governed record.
  const returnToQuickCalculation = useCallback(() => {
    promotionRef.current = null;
    persist({ lane: "quick", batchId: null, chosenAt: Date.now() });
  }, [persist]);

  // New work: forget the previous answer so the next piece of work is asked
  // again rather than inheriting a customer, a lane or a Batch binding.
  const clearLaneSelection = useCallback(() => {
    promotionRef.current = null;
    persist(null);
  }, [persist]);

  // ── Reopening ─────────────────────────────────────────────────────────────
  // Opening a governed Batch while the customer-quote workflow is already the
  // chosen lane restores that context silently — the user is not asked again,
  // and the selection follows to whichever governed Batch they opened.
  //
  // THE GUARD THAT MATTERS is the first early return: this never fires while the
  // lane is `quick` or unchosen. A Maker working privately who opens a governed
  // Batch to look at it keeps their private lane, which is the inference this
  // whole model exists to prevent. Re-binding is only ever a move WITHIN a lane
  // the user already chose, never a move into one.
  useEffect(() => {
    if (!durableBatch?.id) return;
    if (laneSelection?.lane !== "customer") return;
    if (laneSelectionApplies(laneSelection, durableBatch)) return;
    if (promotionRef.current) return; // a promotion binds through bindGovernedBatch
    persist({ ...laneSelection, batchId: String(durableBatch.id), chosenAt: Date.now() });
  }, [durableBatch, laneSelection, persist]);

  return { bindGovernedBatch, chooseCustomerQuote, chooseQuick, clearLaneSelection,
    isPromoting, laneSelection, returnToQuickCalculation };
}
