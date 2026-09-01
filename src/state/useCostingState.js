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
// C6 DELETED specCommitted. The identity freeze it drove had ALREADY stopped
// existing at C5: Client and Sector left SpecForm for the Batch Context bar,
// where they are read-only whenever Costing is attached to a batch or reviewing
// a row. The flag survived C5 driving nothing but a banner that still claimed
// those fields were locked here. Nothing replaces it - the read-only rule lives
// in the Context bar's own mode test, not in a flag.
//
// This also closes the Send-then-reload asymmetry: the spec persisted while the
// flag did not, so a reload silently released a freeze the Maker had been shown.
// There is no freeze and no flag to be asymmetric about.
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
  return { aiNotes, setAiNotes, setAutoFill, setSetAutoFill };
}
