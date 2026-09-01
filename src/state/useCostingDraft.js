// ═══════════════════════════════════════════════════════════════════════════
// src/state/useCostingDraft.js — the persisted Costing START draft.
//
// C3. Owns spec, setSpec and s(). The store's surface is unchanged: every
// consumer reads them through useAppState().
//
// COMPOSITION POSITION IS LOAD-BEARING. This composes AFTER useBatchState and
// BEFORE useCostingResult (see AppStateProvider.jsx):
//
//  · after useBatchState, so the seed and the resolver read batchProfile STATE.
//  · before useCostingResult, which destructures spec on entry.
//
// C4 SPLIT THE REVIEW COPY OUT. Deep Dive calls openReview(), which builds a
// SESSION-ONLY reviewCopy from the batch row. The draft is not read, written or
// discarded by any REVIEW action, so entering REVIEW needs no prompt about
// START dirt — there is nothing to lose.
//
// ⚠️ ROUTING IS PER-RENDER. setSpec reads the reviewCopy of the CURRENT render,
// so a handler must never change mode and call setSpec in the same action — the
// write would land on the surface being left. Mode changes go through
// openReview / exitReview / resetDraft alone.
//
// C5 ADDED profileDraft AND THE RESOLVER.
//
//  · profileDraft holds the batch-level fields while a NEW batch is being
//    prepared and no Batch Profile exists to hold them yet. null means Costing
//    is attached to the live batch. Mode derives from it; costingContext is gone.
//  · CONTEXT-ONLY FIELDS HAVE ONE AUTHORITY AND ARE NEVER MIRRORED. The `spec`
//    the app sees is RESOLVED — the raw draft spec with the context-only fields
//    overlaid from whichever store owns them this render. Nothing is copied into
//    the draft to be read back later, so nothing can drift.
//  · SKU-EXCEPTION FIELDS STAY IN spec (margin, interest, freight, Box/PP waste
//    and conversion). A Context edit advances one ONLY while it is still
//    tracking the old default — see setContextField / applyContextCascade.
//  · specRaw is the UNRESOLVED draft spec, and exists for one reader: the G1
//    identity guards, which must still see a client/sector/plant/delivery that
//    an older persisted draft or a restored backup put there.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { INIT_SPEC } from "../data/defaults.js";
import { getItem, setItem } from "../lib/persist.js";
import { CONTEXT_ONLY_FIELDS, DRAFT_CORRUPT_KEY, DRAFT_KEY, DRAFT_VERSION,
  freshEnvelope, freshProfileDraft, freshReviewCopy, isDirty, isDraftDirty,
  isValidEnvelope, mergeSpec, nextReviewBaseline,
  shouldAdvanceSkuValue } from "./costingDraftModel.js";

export function useCostingDraft(st){
  const { batchProfile, batchRows, setAutoFill, setSetAutoFill } = st;

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
          profileDraft:env.profileDraft,
          baseline:mergeSpec(INIT_SPEC,env.baseline)};
      }
      // Unparseable, unknown version, or a shape that parses but is not a draft.
      // Preserve the raw blob before the write-through effect below replaces it.
      // Same idempotent pattern as useBatchState.js:56-72.
      try{ setItem(DRAFT_CORRUPT_KEY,raw); }
      catch{ /* storage unavailable — nothing further to do */ }
    }
    const seeded={...INIT_SPEC,
      plant:batchProfile?.plant||"",
      delivery:batchProfile?.delivery||""};
    return freshEnvelope(seeded);
  });

  useEffect(()=>{
    try{ setItem(DRAFT_KEY,JSON.stringify(draft)); }
    catch{ /* storage unavailable - the draft simply does not survive this reload */ }
  },[draft]);

  const[reviewCopy,setReviewCopy]=useState(null);
  const inReview=reviewCopy!==null;
  const profileDraft=draft.profileDraft;

  const activeBatchRowId=inReview?reviewCopy.rowId:null;
  const reviewDirty=inReview&&isDirty(reviewCopy.spec,reviewCopy.baseline);
  const draftDirty=isDraftDirty(draft.spec,draft.baseline,profileDraft);

  // ── THE ONE CONTEXT AUTHORITY ───────────────────────────────────────────
  // Reviewing a real row reads the live profile; preparing a new batch reads the
  // draft profile; otherwise the live profile. One source per render.
  const contextValues=inReview?batchProfile
    :(profileDraft!==null?profileDraft.values:batchProfile);

  // ── THE BATCH DEFAULTS SKU EXCEPTIONS ARE MEASURED AGAINST ──────────────
  // null means "no committed batch context", and the sector master is then the
  // only authority — exactly what _hasCommittedBatch meant before C5.
  const batchDefaults=inReview?batchProfile
    :(profileDraft!==null?profileDraft.values
      :(batchRows.length>0?batchProfile:null));

  const specRaw=inReview?reviewCopy.spec:draft.spec;
  // The resolved spec every consumer sees.
  const spec=(()=>{
    const out={...specRaw};
    CONTEXT_ONLY_FIELDS.forEach(k=>{
      const v=contextValues?contextValues[k]:undefined;
      out[k]=(v===undefined||v===null)?(INIT_SPEC[k]??""):v;
    });
    // Freight is a SKU exception WITH a batch fallback: an explicit SKU value
    // wins, a blank inherits the batch figure, and calcCosting falls back to the
    // matrix when that is blank too.
    const skuFr=specRaw.freightOverride;
    if(skuFr===""||skuFr==null)
      out.freightOverride=(contextValues&&contextValues.freightOverride)||"";
    return out;
  })();

  const setSpec=next=>{
    if(inReview)setReviewCopy(rc=>rc===null?rc:({...rc,
      spec:typeof next==='function'?next(rc.spec):next}));
    else setDraft(d=>({...d,
      spec:typeof next==='function'?next(d.spec):next}));
  };
  const s=(k,v)=>setSpec(p=>{
    const ks=k.split(".");
    if(ks.length===1)return{...p,[k]:v};
    if(ks[0]==="layers")return{...p,layers:{...p.layers,[ks[1]]:{...p.layers[ks[1]],[ks[2]]:v}}};
    return p;
  });

  // ── C4 · REVIEW ─────────────────────────────────────────────────────────
  // prev carries setAutoFill only. profileDraft is NOT snapshotted: REVIEW never
  // writes it, so there is nothing to restore.
  const openReview=(rowId,rowSpec)=>
    setReviewCopy(freshReviewCopy(rowId,rowSpec,{setAutoFill}));
  const exitReview=()=>{
    if(reviewCopy)setSetAutoFill(reviewCopy.prev.setAutoFill);
    setReviewCopy(null);
  };
  const markReviewPushed=(pushedFields,constructionFormalised)=>
    setReviewCopy(rc=>rc===null?rc:({...rc,
      baseline:nextReviewBaseline(rc.baseline,rc.spec,pushedFields,constructionFormalised)}));

  // ── C5 · DRAFT LIFECYCLE ────────────────────────────────────────────────
  // One operation per transition, each landing a CLEAN result in a single state
  // update: baseline := the spec it just wrote, and the profile draft carrying
  // its own matching baseline.
  const resetDraft=(nextSpec,nextProfileValues)=>setDraft(()=>({
    v:DRAFT_VERSION,
    spec:nextSpec,
    profileDraft:nextProfileValues?freshProfileDraft(nextProfileValues):null,
    baseline:nextSpec}));

  // Send succeeded: the batch row is the durable record, so the draft is clean
  // against what it just produced. A new-batch draft has been written through to
  // the profile by the caller and becomes null here.
  const markDraftSent=()=>setDraft(d=>({...d,profileDraft:null,baseline:d.spec}));

  // A Context-bar edit. ONE action: the batch value always moves; the SKU value
  // follows only while it was still tracking the old default.
  const setContextField=(key,value,skuKey)=>setDraft(d=>{
    if(d.profileDraft===null)return d;            // read-only mode writes nothing
    const prevDefault=d.profileDraft.values[key];
    const values={...d.profileDraft.values,[key]:value};
    const spec2=(skuKey&&shouldAdvanceSkuValue(d.spec[skuKey],prevDefault))
      ?{...d.spec,[skuKey]:value}:d.spec;
    return {...d,spec:spec2,profileDraft:{...d.profileDraft,values}};
  });

  // Cascades reproduced from Batch Entry (sector → waste/conv, plant/delivery →
  // freight, payment → interest). Each writes several batch values at once and
  // advances only the SKU values still tracking them.
  const applyContextCascade=(patch,skuMap)=>setDraft(d=>{
    if(d.profileDraft===null)return d;
    const prev=d.profileDraft.values;
    const values={...prev,...patch};
    let spec2=d.spec;
    Object.entries(skuMap||{}).forEach(([batchKey,skuKey])=>{
      if(!(batchKey in patch))return;
      if(shouldAdvanceSkuValue(spec2[skuKey],prev[batchKey]))
        spec2={...spec2,[skuKey]:patch[batchKey]};
    });
    return {...d,spec:spec2,profileDraft:{...d.profileDraft,values}};
  });

  return { activeBatchRowId, applyContextCascade, batchDefaults, contextValues,
    draftDirty, exitReview, markDraftSent, markReviewPushed, openReview,
    profileDraft, resetDraft, reviewDirty, s, setContextField, setSpec, spec,
    specRaw };
}
