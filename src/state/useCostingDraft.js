// ═══════════════════════════════════════════════════════════════════════════
// src/state/useCostingDraft.js — the persisted Costing START draft.
//
// C3. Owns spec, setSpec and s(), which were useState/closures in
// useCostingState.js until now. The store's surface is unchanged: every
// consumer reads them through useAppState() and none was touched.
//
// COMPOSITION POSITION IS LOAD-BEARING. This composes AFTER useBatchState and
// BEFORE useCostingResult (see AppStateProvider.jsx):
//
//  · after useBatchState, so the seed reads batchProfile STATE. That retires
//    the coupling documented in useCostingState.js, which read cbb_batchprofile
//    through getItem() directly for one reason only — it composed before the
//    batch slice existed and had no other way to see the profile.
//  · before useCostingResult, which destructures spec on entry.
//
// Verified safe to move: nothing composed above this point reads spec or s() —
// useUiState, useMastersState, useQuoteItemsState ({profile} only) and
// useBatchState ({constructionLib, sectorCodes} only) contain no reference to
// either.
//
// C4 SPLIT THE REVIEW COPY OUT. Deep Dive no longer touches the draft: it
// calls openReview(), which builds a SESSION-ONLY reviewCopy from the batch
// row. The draft is not read, written or discarded by any REVIEW action, so
// entering REVIEW needs no prompt about START dirt — there is nothing to lose.
//
// spec/setSpec/s() route to the ACTIVE SURFACE: the review copy while
// reviewing, the draft otherwise. That is why no component changed.
//
// ⚠️ ROUTING IS PER-RENDER. setSpec reads the reviewCopy of the CURRENT
// render, so a handler must never change mode and call setSpec in the same
// action — the write would land on the surface being left. Mode changes go
// through openReview/exitReview alone, and nothing else writes a spec.
//
// activeBatchRowId is DERIVED from reviewCopy.rowId. It is not stored twice,
// so the two cannot disagree.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { INIT_SPEC } from "../data/defaults.js";
import { getItem, setItem } from "../lib/persist.js";
import { DRAFT_CORRUPT_KEY, DRAFT_KEY, DRAFT_VERSION, freshEnvelope,
  freshReviewCopy, isDirty, isValidEnvelope, mergeSpec,
  nextReviewBaseline } from "./costingDraftModel.js";

export function useCostingDraft(st){
  const { batchProfile, costingContext, setAutoFill, setCostingContext, setSetAutoFill } = st;

  const[draft,setDraft]=useState(()=>{
    const raw=getItem(DRAFT_KEY);
    if(raw){
      let env;
      try{ env=JSON.parse(raw); }catch{ env=null; }
      if(isValidEnvelope(env)){
        // Merge BOTH sides identically. Merging only the spec would materialise
        // a key on one side and report a draft as dirty that nobody edited.
        return {v:DRAFT_VERSION,
          spec:mergeSpec(INIT_SPEC,env.spec),
          profileDraft:null,
          baseline:mergeSpec(INIT_SPEC,env.baseline)};
      }
      // Unparseable, unknown version, or a shape that parses but is not a
      // draft. Preserve the raw blob before the write-through effect below
      // replaces it, so it stays recoverable by hand. Same pattern as
      // useBatchState.js:56-72: writing the same string twice is idempotent,
      // which matters because StrictMode invokes this initialiser twice. A
      // later, different corruption overwrites the earlier preserved copy —
      // exactly as the batch autosave behaves.
      try{ setItem(DRAFT_CORRUPT_KEY,raw); }
      catch{ /* storage unavailable — nothing further to do */ }
    }
    // No draft: seed as before — INIT_SPEC plus plant/delivery from the live
    // profile. Deliberately still only those two fields; widening the seed
    // would be a behaviour change beyond moving the state.
    const seeded={...INIT_SPEC,
      plant:batchProfile?.plant||"",
      delivery:batchProfile?.delivery||""};
    return freshEnvelope(seeded);
  });

  // Write-through on every change, mirroring batchProfile (useBatchState.js:32)
  // and items (useQuoteItemsState.js:35). No debounce: nothing in this app
  // debounces a persisted slice, and adding one here would be a mechanism
  // nobody asked for.
  useEffect(()=>{
    try{ setItem(DRAFT_KEY,JSON.stringify(draft)); }
    catch{ /* storage unavailable - the draft simply does not survive this reload */ }
  },[draft]);

  // ── C4 · THE REVIEW COPY ───────────────────────────────────────
  // Session only. No storage key, and deliberately outside the write-through
  // effect above: a reload lands in START with the draft intact, and unpushed
  // REVIEW changes are lost by design.
  const[reviewCopy,setReviewCopy]=useState(null);
  const inReview=reviewCopy!==null;

  // The row under review IS the pointer. Nothing stores it a second time.
  const activeBatchRowId=inReview?reviewCopy.rowId:null;
  // Unpushed REVIEW changes exist. Gates the exit confirm and the replace
  // confirm; the draft's own baseline is never consulted here.
  const reviewDirty=inReview&&isDirty(reviewCopy.spec,reviewCopy.baseline);

  const spec=inReview?reviewCopy.spec:draft.spec;
  // Accepts a value or an updater, because both forms are in use: setSpec(sp)
  // at useCostingBatchBridge.js:55 and setSpec(p=>({...p,...})) in SpecForm.
  // Routes to the active surface - see the per-render warning in the header.
  const setSpec=next=>{
    if(inReview)setReviewCopy(rc=>rc===null?rc:({...rc,
      spec:typeof next==='function'?next(rc.spec):next}));
    else setDraft(d=>({...d,
      spec:typeof next==='function'?next(d.spec):next}));
  };
  // Dotted-path setter, moved verbatim from useCostingState.js. Two path
  // shapes only — a top-level key, or layers.<K>.<field>; anything else
  // returns the spec unchanged. costingDraftModel.mergeSpec depends on that
  // being exhaustive.
  const s=(k,v)=>setSpec(p=>{
    const ks=k.split(".");
    if(ks.length===1)return{...p,[k]:v};
    if(ks[0]==="layers")return{...p,layers:{...p.layers,[ks[1]]:{...p.layers[ks[1]],[ks[2]]:v}}};
    return p;
  });

  // Deep Dive. Captures START's workspace flags BEFORE the caller overwrites
  // them, which is why prev is read here and not passed in.
  const openReview=(rowId,rowSpec)=>
    setReviewCopy(freshReviewCopy(rowId,rowSpec,{setAutoFill,costingContext}));

  // Discard the copy and restore what START was working with. Read from the
  // current render rather than inside the updater: a state updater must stay
  // pure, and StrictMode invokes it twice.
  const exitReview=()=>{
    if(reviewCopy){
      setSetAutoFill(reviewCopy.prev.setAutoFill);
      setCostingContext(reviewCopy.prev.costingContext);
    }
    setReviewCopy(null);
  };

  // After a successful Push. NOT baseline := spec: the baseline tracks what was
  // formalised THROUGH BATCH ENTRY. Declining the shared-Construction update
  // leaves those fields dirty, so exiting still warns and a later accepting
  // Push is what makes REVIEW clean. See nextReviewBaseline.
  const markReviewPushed=(pushedFields,constructionFormalised)=>
    setReviewCopy(rc=>rc===null?rc:({...rc,
      baseline:nextReviewBaseline(rc.baseline,rc.spec,pushedFields,constructionFormalised)}));

  return { activeBatchRowId, exitReview, markReviewPushed, openReview,
    reviewDirty, s, setSpec, spec };
}
