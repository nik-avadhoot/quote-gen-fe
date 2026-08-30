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
// ⚠️ THERE IS STILL EXACTLY ONE SPEC. Deep Dive overwrites it
// (useCostingBatchBridge.js:56), so opening a Batch row still destroys unsent
// START work — and now that the spec is persisted, the row-derived state
// SURVIVES A RELOAD instead of being washed out by one. Nothing new is lost
// and nothing became recoverable; the accidental cleanup stopped. Splitting
// reviewCopy from the draft is C4, and REVIEW is not safe until it lands.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { INIT_SPEC } from "../data/defaults.js";
import { getItem, setItem } from "../lib/persist.js";
import { DRAFT_CORRUPT_KEY, DRAFT_KEY, DRAFT_VERSION, freshEnvelope,
  isValidEnvelope, mergeSpec } from "./costingDraftModel.js";

export function useCostingDraft(st){
  const { batchProfile } = st;

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

  const spec=draft.spec;
  // Accepts a value or an updater, because both forms are in use: setSpec(sp)
  // at useCostingBatchBridge.js:55 and setSpec(p=>({...p,...})) in SpecForm.
  const setSpec=next=>setDraft(d=>({...d,
    spec:typeof next==='function'?next(d.spec):next}));
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

  return { s, setSpec, spec };
}
