// ═══════════════════════════════════════════════════════════════════════════
// src/state/AppStateProvider.jsx
//
// Composes the domain slices into one store. ONE provider, deliberately:
// nesting several would make the nesting order load-bearing and would leave
// cross-slice actions straddling provider boundaries.
//
// `st` is a plain accumulator. Each hook is called unconditionally, in a fixed
// order, and reads the slices already merged into `st` - so a slice may only
// depend on one composed ABOVE it. The order below is dependency-driven, not
// cosmetic; the comments record what forces each position.
//
// Every consumer re-renders when any slice changes. That is fine and still a
// large improvement: from Phase 7 only one tab is mounted at a time.
// ═══════════════════════════════════════════════════════════════════════════
import { AppStateContext } from "./AppStateContext.js";
import { useUiState } from "./useUiState.js";
import { useMastersState } from "./useMastersState.js";
import { useCostingState } from "./useCostingState.js";
import { useQuoteItemsState } from "./useQuoteItemsState.js";
import { useBatchState } from "./useBatchState.js";
import { useCostingDraft } from "./useCostingDraft.js";
import { useCostingResult } from "./useCostingResult.js";
import { useBatchInvalidation } from "./useBatchInvalidation.js";
import { useCostingBatchBridge } from "./useCostingBatchBridge.js";
import { useQuoteActions } from "./useQuoteActions.js";

export function AppStateProvider({ children }){
  const st = {};

  Object.assign(st, useUiState());            // FIRST: showToast is used by every slice below
  Object.assign(st, useMastersState());       // no deps
  Object.assign(st, useCostingState());       // no deps
  Object.assign(st, useQuoteItemsState(st));  // needs profile (ui)
  Object.assign(st, useBatchState(st));       // needs sectorCodes + constructionLib (masters), setTab/showToast (ui)
  Object.assign(st, useCostingDraft(st));     // C3: owns spec/s(); C4: owns reviewCopy + derived activeBatchRowId. AFTER useBatchState (seeds from batchProfile state), BEFORE useCostingResult (consumes spec)
  Object.assign(st, useCostingResult(st));    // needs spec (draft), masters, batchRows/batchProfile (batch)
  useBatchInvalidation(st);                   // AFTER masters AND batch: reads both, calls invalidateAllBatchResults
  Object.assign(st, useCostingBatchBridge(st)); // AFTER useCostingResult: consumes resolveSpecWasteConv
  Object.assign(st, useQuoteActions(st));     // AFTER everything: reads r/missing (derived) and restoreRef (items)

  return <AppStateContext.Provider value={st}>{children}</AppStateContext.Provider>;
}
