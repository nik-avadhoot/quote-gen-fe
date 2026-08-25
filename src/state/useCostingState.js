// ═══════════════════════════════════════════════════════════════════════════
// src/state/useCostingState.js
//
// The Costing tab scratchpad: the live spec, its dotted-path setter s(),
// and the flags linking Costing to a batch row.
//
// Extracted verbatim from QuotationApp.jsx (Phase 4). The bodies below are
// byte-identical to the monolith; only the surrounding closure changed.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { INIT_SPEC } from "../data/defaults.js";
import { getItem } from "../lib/persist.js";

export function useCostingState(){
  // CROSS-SLICE COUPLING, deliberate and load-bearing.
  //
  // This seeds plant/delivery from the batch profile by reading
  // cbb_batchprofile via getItem() DIRECTLY, rather than from
  // batchProfile state. That is not an oversight and must not be "cleaned up"
  // into a state read: useCostingState composes BEFORE useBatchState (see
  // AppStateProvider.jsx), so batchProfile does not exist yet at this point.
  // The storage read is the only way this initialiser can see the profile.
  //
  // Verbatim from the monolith, so not a Phase 4 regression - but in the
  // monolith it was one useState among many and read as incidental. Here it is
  // a real dependency from the costing slice onto the batch slice's storage
  // key, and it is why cbb_batchprofile cannot move to Supabase (plan item 4c
  // / the persist seam) without revisiting this initialiser.
  const[spec,setSpec]=useState(()=>{
    try{
      const bp=JSON.parse(getItem('cbb_batchprofile')||'{"plant":"","delivery":""}');
      return{...INIT_SPEC,plant:bp.plant||"",delivery:bp.delivery||""};
    }catch(e){return{...INIT_SPEC,plant:"",delivery:""};}
  });
  const[setAutoFill,setSetAutoFill]=useState(true); // "Part of a SET" switch — ON=apply existing auto-fill, OFF=leave SetCode blank
  const[costingContext,setCostingContext]=useState("same-batch"); // "same-batch"|"new-batch" — which batch context Costing is currently operating in
  const[aiNotes,setAiNotes]=useState("");
  const[activeBatchRowId,setActiveBatchRowId]=useState(null);
  // specCommitted: true after sendCostingToBatch successfully appends a row,
  // cleared by Start New SKU / Unlink / loadItem / loadBatchRowIntoCosting / New Batch.
  // Session/UI state only — not persisted, not backed up.
  const[specCommitted,setSpecCommitted]=useState(false);
  const s=(k,v)=>setSpec(p=>{
    const ks=k.split(".");
    if(ks.length===1)return{...p,[k]:v};
    if(ks[0]==="layers")return{...p,layers:{...p.layers,[ks[1]]:{...p.layers[ks[1]],[ks[2]]:v}}};
    return p;
  });

  return { activeBatchRowId, aiNotes, costingContext, s, setActiveBatchRowId, setAiNotes, setAutoFill, setCostingContext, setSetAutoFill, setSpec, setSpecCommitted, spec, specCommitted };
}
