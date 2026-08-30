// ═══════════════════════════════════════════════════════════════════════════
// src/state/useCostingState.js
//
// The Costing tab's workspace flags: the SET auto-fill switch, the AI notes,
// which batch row is under review, which batch context Costing is in, and
// whether the spec has been sent.
//
// C3 MOVED THE SPEC OUT. spec, setSpec and s() now live in
// useCostingDraft.js, which composes after useBatchState so it can seed from
// batchProfile state and persist the draft. The cross-slice coupling that used
// to be documented here - reading cbb_batchprofile through getItem() because
// this slice composes before the batch slice - went with them.
//
// This file stays deliberately, as a thin slice. Do not absorb it.
//
// Extracted verbatim from QuotationApp.jsx (Phase 4); what remains below is
// still byte-identical to the monolith.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";

export function useCostingState(){
  const[setAutoFill,setSetAutoFill]=useState(true); // "Part of a SET" switch — ON=apply existing auto-fill, OFF=leave SetCode blank
  const[costingContext,setCostingContext]=useState("same-batch"); // "same-batch"|"new-batch" — which batch context Costing is currently operating in
  const[aiNotes,setAiNotes]=useState("");
  const[activeBatchRowId,setActiveBatchRowId]=useState(null);
  // specCommitted: true after sendCostingToBatch successfully appends a row,
  // cleared by Start New SKU / Unlink / loadItem / loadBatchRowIntoCosting / New Batch.
  // Session/UI state only — not persisted, not backed up.
  const[specCommitted,setSpecCommitted]=useState(false);
  return { activeBatchRowId, aiNotes, costingContext, setActiveBatchRowId, setAiNotes, setAutoFill, setCostingContext, setSetAutoFill, setSpecCommitted, specCommitted };
}
