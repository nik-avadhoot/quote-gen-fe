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
// C5 DELETED costingContext. Which batch context Costing is in is DERIVED from
// whether a profileDraft exists (useCostingDraft.js), so the flag and the thing
// it described can no longer disagree.
//
// C4 MOVED activeBatchRowId OUT TOO, and it is no longer state anywhere: it is
// DERIVED from reviewCopy.rowId in useCostingDraft.js. Storing the row pointer
// beside the review copy that defines it would be two sources of truth for
// "am I in REVIEW", able to disagree at any of the four sites that used to set
// it.
//
// This file stays deliberately, as a thin slice. Do not absorb it.
//
// Extracted verbatim from QuotationApp.jsx (Phase 4); what remains below is
// still byte-identical to the monolith.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";

export function useCostingState(){
  const[setAutoFill,setSetAutoFill]=useState(true); // "Part of a SET" switch — ON=apply existing auto-fill, OFF=leave SetCode blank
  const[aiNotes,setAiNotes]=useState("");
  // specCommitted: true after sendCostingToBatch successfully appends a row,
  // cleared by Start New SKU / New Batch.
  //
  // C4: Deep Dive STOPPED clearing it. Every reader is SpecForm, always as
  // (activeBatchRowId||specCommitted) or (!activeBatchRowId&&specCommitted)
  // (:57, :68, :80, :82), so while a row is under review the flag is masked and
  // cannot render — clearing it only leaked out the far side, releasing START's
  // identity freeze after a Deep Dive round trip. loadItem is gone entirely.
  // Session/UI state only — not persisted, not backed up.
  const[specCommitted,setSpecCommitted]=useState(false);
  return { aiNotes, setAiNotes, setAutoFill, setSetAutoFill, setSpecCommitted, specCommitted };
}
