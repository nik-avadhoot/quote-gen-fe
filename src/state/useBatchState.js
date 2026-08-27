// ═══════════════════════════════════════════════════════════════════════════
// src/state/useBatchState.js
//
// Batch Entry: profile, rows, cached results, grid UI state and the
// autosave. parseConstrQuery is UNWIRED - see its own note below.
//
// Extracted verbatim from QuotationApp.jsx (Phase 4). The bodies below are
// byte-identical to the monolith; only the surrounding closure changed.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { getItem, setItem } from "../lib/persist.js";

export function useBatchState(st){
  // D-5: setTab and showToast were used ONLY by restoreAutosave, which the
  // hydrate-on-mount change removed. This hook no longer depends on the ui slice
  // at all — see the composition-order note in docs/post-split-state.md §2, which
  // still lists that dependency.
  const { constructionLib, sectorCodes } = st;

  // ── BATCH ENTRY STATE ─────────────────────────────────────────────────────
  const[batchProfile,setBatchProfile]=useState(()=>{
    try{const s=getItem('cbb_batchprofile');return s?JSON.parse(s):{
      client:'',sector:'',plant:'',delivery:'',
      margin:8,marginPP:8,interest:0.5,paymentDisc:'30',freightOverride:'',
      waste:5,convRate:7,wastePP:5,convRatePP:12.5,customerType:'existing',priceContext:'unknown',
    };}catch(e){return{client:'',sector:'',plant:'',delivery:'',
      margin:8,marginPP:8,interest:0.5,paymentDisc:'30',freightOverride:'',
      waste:5,convRate:7,wastePP:5,convRatePP:12.5,customerType:'existing',priceContext:'unknown'};}
  });
  // Persist batchProfile on every change
  useEffect(()=>{try{setItem('cbb_batchprofile',JSON.stringify(batchProfile));}catch(e){};},[batchProfile]);
  const[pinnedAddOns,setPinnedAddOns]=useState(()=>{
    try{const s=getItem('cbb_pinned_addons');return s?JSON.parse(s):[];}catch(e){return[];}
  });
  const togglePinAddOn=(k)=>setPinnedAddOns(prev=>{
    const next=prev.includes(k)?prev.filter(x=>x!==k):[...prev,k].slice(-2);
    try{setItem('cbb_pinned_addons',JSON.stringify(next));}catch(e){}
    return next;
  });
  // expandedRows: set of row ids that have sub-row open
  const[expandedRows,setExpandedRows]=useState(new Set());
  const toggleRowExpand=(id)=>setExpandedRows(prev=>{
    const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;
  });
  // ── D-5: hydrate batchRows from the autosave ──────────────────────────────
  // Before this, batchRows started EMPTY while the rows sat in localStorage, and
  // the recovery banner was the only route back to them. That divergence — not
  // the write that followed it — was the defect: every subsequent write was
  // "legitimate" by any count rule while persisting a state the user never chose.
  //
  // Rows only. batchProfile hydrates from cbb_batchprofile above and remains the
  // single source for profile; the profile snapshot inside the autosave is
  // deliberately NOT read here, so no second source of truth is introduced.
  const[batchRows,setBatchRows]=useState(()=>{
    try{
      const s=getItem('cbb_batch_autosave');
      if(!s)return[];
      const{rows}=JSON.parse(s);
      return Array.isArray(rows)?rows:[];
    }catch{
      // Corrupt blob. Preserve it ONCE before the effect below overwrites it, so
      // it stays recoverable by hand. This is preservation, not a guard: nothing
      // is blocked and no divergence is reintroduced. Idempotent, which matters
      // because StrictMode invokes this initialiser twice in development.
      try{
        const raw=getItem('cbb_batch_autosave');
        if(raw)setItem('cbb_batch_autosave_corrupt',raw);
      }catch{ /* storage unavailable — nothing further to do */ }
      return[];
    }
  });
  const[batchResults,setBatchResults]=useState({});
  const[expandedConstr,setExpandedConstr]=useState(null);
  const[constrFilter,setConstrFilter]=useState({sector:'',client:'',status:'active'});
  const[constrQuery,setConstrQuery]=useState('');
  // Slide-over overlay state for Batch Entry (selection-only)
  const[batchConstrOverlay,setBatchConstrOverlay]=useState(false); // overlay open?
  const[batchConstrTargetRowId,setBatchConstrTargetRowId]=useState(null); // which row
  const[batchConstrOverlayQuery,setBatchConstrOverlayQuery]=useState('');
  const[batchConstrOverlayFilter,setBatchConstrOverlayFilter]=useState({sector:'',client:''});
  // Construction Library tab state

  // D-5: the age of the batch AS LOADED at mount, for display only.
  // Deliberately captured once and never updated: it describes what was loaded at
  // the start of this session, which stays true regardless of later edits. There is
  // NO behaviour attached to it anywhere — see the note at its render site in
  // BatchProfileBar.jsx. The old 7-day gate hid rows; this only mentions them.
  // ── AUTO-SAVE: batch rows ─────────────────────────────────────────────────
  // Must be declared AFTER batchRows and batchProfile (both used in dep array).
  useEffect(()=>{
    // D-5: NO GUARD. batchRows hydrates on mount above, so an empty batch here
    // means the batch IS empty — either storage held nothing, or the user emptied
    // it deliberately. Both must persist.
    //
    // The removed guard could not distinguish those, and never did: the effect
    // fires on every intermediate state, so deleting N rows one at a time wrote
    // N-1, N-2 … 1 straight through it and only blocked the final transition to 0.
    // Its ONLY effective firing was at mount — the one case hydration eliminates.
    // Observed: deleting all 8 rows left a 1-row residue in storage.
    try{setItem('cbb_batch_autosave',JSON.stringify({
      ts:Date.now(),rows:batchRows,profile:batchProfile}));}catch{ /* storage full or unavailable */ }
  },[batchRows,batchProfile]);

  // Conversational filter parser — no AI tokens, pure local regex/keyword matching.
  // Parses a free-text query like "active alcobev ITC BS>8 GSM 700-750 Cobb 125"
  // and sets the filter state exactly as the dropdowns + range inputs would.
  const parseConstrQuery=(q)=>{
    if(!q.trim()){setConstrFilter({sector:'',client:'',status:'active'});return;}
    const lower=q.toLowerCase();
    const next={sector:'',client:'',status:'active',
      gsm_min:'',gsm_max:'',bs_min:'',bct_min:'',ect_min:'',cobb_max:''};
    // Status
    if(/\barchived\b/.test(lower))next.status='archived';
    else if(/\ball\b/.test(lower))next.status='all';
    else if(/\bactive\b/.test(lower))next.status='active';
    // Sector — match against known sector codes
    const sectorMatch=sectorCodes.find(s=>lower.includes(s.toLowerCase()));
    if(sectorMatch)next.sector=sectorMatch;
    // Client — match against existing clients in library
    const clients=[...new Set(constructionLib.map(c=>c.client||'').filter(Boolean))];
    const clientMatch=clients.find(cl=>lower.includes(cl.toLowerCase()));
    if(clientMatch)next.client=clientMatch;
    // Spec ranges — GSM x-y or GSM>x or GSM>=x
    const gsmRange=q.match(/gsm\s*(\d+)\s*[-–to]+\s*(\d+)/i);
    const gsmMin=q.match(/gsm\s*[>≥>=]+\s*(\d+)/i);
    const gsmMax=q.match(/gsm\s*[<≤<=]+\s*(\d+)/i);
    if(gsmRange){next.gsm_min=gsmRange[1];next.gsm_max=gsmRange[2];}
    else{if(gsmMin)next.gsm_min=gsmMin[1];if(gsmMax)next.gsm_max=gsmMax[1];}
    // BS
    const bsMin=q.match(/bs\s*[>≥>=]+\s*(\d+\.?\d*)/i)||q.match(/bs\s+(\d+\.?\d*)/i);
    if(bsMin)next.bs_min=bsMin[1];
    // BCT
    const bctMin=q.match(/bct\s*[>≥>=]+\s*(\d+\.?\d*)/i)||q.match(/bct\s+(\d+\.?\d*)/i);
    if(bctMin)next.bct_min=bctMin[1];
    // ECT
    const ectMin=q.match(/ect\s*[>≥>=]+\s*(\d+\.?\d*)/i)||q.match(/ect\s+(\d+\.?\d*)/i);
    if(ectMin)next.ect_min=ectMin[1];
    // Cobb — "Cobb 125" or "Cobb<=125" or "Cobb max 125"
    const cobbMax=q.match(/cobb\s*(?:max|[<≤<=]+)?\s*(\d+)/i);
    if(cobbMax)next.cobb_max=cobbMax[1];
    setConstrFilter(next);
  };
  const[autoCodeEnabled,setAutoCodeEnabled]=useState(false);
  const[autoCodeSeq,setAutoCodeSeq]=useState(1);
  const autoCalcPPDims=(row)=>{
    if(row.itemType==="Box"||!row.itemType)return row;
    // Gate 1: unconfirmed SET Code — do not apply auto-dims
    if(row.setCodeAssumed)return row;
    const needsL=row.L===""||row.L==null;
    const needsW=row.W===""||row.W==null;
    if(!needsL&&!needsW)return row;
    const rowSetCode=(row.setCode||"").trim();
    // Gate 2: explicitly cleared SET Code (blank, not assumed) — standalone row, no auto-dims
    if(!rowSetCode)return row;
    const idx=batchRows.findIndex(r=>r.id===row.id);
    // Only accept a parent Box with the same confirmed SET Code
    const parentBox=[...batchRows.slice(0,idx)].reverse().find(r=>
      r.itemType==="Box"&&!r.setCodeAssumed&&(r.setCode||"").trim()===rowSetCode);
    if(!parentBox)return row;
    const patch={};
    if(row.itemType==="Plate"){
      if(needsL&&parentBox.L)patch.L=+parentBox.L-5;
      if(needsW&&parentBox.W)patch.W=+parentBox.W-5;
    } else if(row.itemType==="Part-L"){
      if(needsL&&parentBox.L)patch.L=+parentBox.L-5;
      if(needsW&&parentBox.H)patch.W=+parentBox.H-15;
    } else if(row.itemType==="Part-W"){
      if(needsL&&parentBox.W)patch.L=+parentBox.W-5;
      if(needsW&&parentBox.H)patch.W=+parentBox.H-15;
    }
    return Object.keys(patch).length?{...row,...patch}:row;
  };
  // ── FIX 1: Staleness invalidation ────────────────────────────────────────────
  // Row-level: clears only the affected row's result when a costing-relevant field changes.
  // Profile/master level: clears all results (called on profile, rates, freight, construction changes).
  // Non-costing fields (product name, matCode, remarks, setCode, spec_bs/bct/ect) do NOT invalidate.
  const invalidateBatchRow=(rowId)=>setBatchResults(prev=>{
    if(!prev[rowId])return prev;
    const next={...prev};delete next[rowId];return next;
  });
  const invalidateAllBatchResults=()=>setBatchResults({});

  return { autoCalcPPDims, autoCodeEnabled, autoCodeSeq, batchConstrOverlay, batchConstrOverlayFilter, batchConstrOverlayQuery, batchConstrTargetRowId, batchProfile, batchResults, batchRows, constrFilter, constrQuery, expandedConstr, expandedRows, invalidateAllBatchResults, invalidateBatchRow, parseConstrQuery, pinnedAddOns, setAutoCodeEnabled, setAutoCodeSeq, setBatchConstrOverlay, setBatchConstrOverlayFilter, setBatchConstrOverlayQuery, setBatchConstrTargetRowId, setBatchProfile, setBatchResults, setBatchRows, setConstrFilter, setConstrQuery, setExpandedConstr, setExpandedRows, setPinnedAddOns, togglePinAddOn, toggleRowExpand };
}
