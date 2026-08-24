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

export function useBatchState(st){
  const { constructionLib, sectorCodes, setTab, showToast } = st;

  // ── BATCH ENTRY STATE ─────────────────────────────────────────────────────
  const[batchProfile,setBatchProfile]=useState(()=>{
    try{const s=localStorage.getItem('cbb_batchprofile');return s?JSON.parse(s):{
      client:'',sector:'',plant:'',delivery:'',
      margin:8,marginPP:8,interest:0.5,paymentDisc:'30',freightOverride:'',
      waste:5,convRate:7,wastePP:5,convRatePP:12.5,customerType:'existing',priceContext:'unknown',
    };}catch(e){return{client:'',sector:'',plant:'',delivery:'',
      margin:8,marginPP:8,interest:0.5,paymentDisc:'30',freightOverride:'',
      waste:5,convRate:7,wastePP:5,convRatePP:12.5,customerType:'existing',priceContext:'unknown'};}
  });
  // Persist batchProfile on every change
  useEffect(()=>{try{localStorage.setItem('cbb_batchprofile',JSON.stringify(batchProfile));}catch(e){};},[batchProfile]);
  const[pinnedAddOns,setPinnedAddOns]=useState(()=>{
    try{const s=localStorage.getItem('cbb_pinned_addons');return s?JSON.parse(s):[];}catch(e){return[];}
  });
  const togglePinAddOn=(k)=>setPinnedAddOns(prev=>{
    const next=prev.includes(k)?prev.filter(x=>x!==k):[...prev,k].slice(-2);
    try{localStorage.setItem('cbb_pinned_addons',JSON.stringify(next));}catch(e){}
    return next;
  });
  // expandedRows: set of row ids that have sub-row open
  const[expandedRows,setExpandedRows]=useState(new Set());
  const toggleRowExpand=(id)=>setExpandedRows(prev=>{
    const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;
  });
  const[batchRows,setBatchRows]=useState([]);
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

  // ── AUTO-SAVE: batch rows ─────────────────────────────────────────────────
  // Must be declared AFTER batchRows and batchProfile (both used in dep array).
  const[autosaveBanner,setAutosaveBanner]=useState(()=>{
    try{
      const s=localStorage.getItem('cbb_batch_autosave');
      if(!s)return null;
      const{ts,rows}=JSON.parse(s);
      // Fix ④: extended to 7 days (10080 min). Friday→Monday is 72h; was 480 min (8h).
      // Data stays in localStorage regardless — this only controls banner visibility.
      const ageMin=(Date.now()-ts)/60000;
      if(ageMin>10080||!rows?.length)return null;
      const d=new Date(ts);
      const label=`${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
      return{ts,rows:rows.length,label};
    }catch(e){return null;}
  });
  useEffect(()=>{
    // Fix 3: Never let a smaller/empty batch overwrite a larger valid prior save.
    // Only write if current rows are non-empty AND >= the saved row count (or no prior save exists).
    if(!batchRows.length){
      try{
        const prev=localStorage.getItem('cbb_batch_autosave');
        if(prev){const{rows}=JSON.parse(prev);if(rows?.length>0)return;}
      }catch(e){}
    }
    try{localStorage.setItem('cbb_batch_autosave',JSON.stringify({
      ts:Date.now(),rows:batchRows,profile:batchProfile}));}catch(e){}
  },[batchRows,batchProfile]);
  const restoreAutosave=()=>{
    try{
      const s=localStorage.getItem('cbb_batch_autosave');
      if(!s)return;
      const{rows,profile}=JSON.parse(s);
      if(rows?.length)setBatchRows(rows);
      if(profile)setBatchProfile(p=>({...p,...profile}));
      setAutosaveBanner(null);
      setTab('batch');
      showToast(`✅ Restored ${rows.length} batch row(s) from autosave`,'success');
    }catch(e){showToast('❌ Could not read autosave','error');}
  };

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

  return { autoCalcPPDims, autoCodeEnabled, autoCodeSeq, autosaveBanner, batchConstrOverlay, batchConstrOverlayFilter, batchConstrOverlayQuery, batchConstrTargetRowId, batchProfile, batchResults, batchRows, constrFilter, constrQuery, expandedConstr, expandedRows, invalidateAllBatchResults, invalidateBatchRow, parseConstrQuery, pinnedAddOns, restoreAutosave, setAutoCodeEnabled, setAutoCodeSeq, setAutosaveBanner, setBatchConstrOverlay, setBatchConstrOverlayFilter, setBatchConstrOverlayQuery, setBatchConstrTargetRowId, setBatchProfile, setBatchResults, setBatchRows, setConstrFilter, setConstrQuery, setExpandedConstr, setExpandedRows, setPinnedAddOns, togglePinAddOn, toggleRowExpand };
}
