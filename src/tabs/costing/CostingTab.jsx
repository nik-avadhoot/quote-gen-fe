// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/costing/CostingTab.jsx — the two-panel Costing layout.
//
// Extracted from QuotationApp.jsx (Phase 7a). Nothing but the grid wrapper:
// a fixed 380px spec form beside a flexible output panel.
//
// C1 (START/REVIEW restructure) puts the contextual subtab strip ABOVE that
// grid, and the Costing header controls into that same strip. It is CHROME
// ONLY:
//
//  · The active subtab is DERIVED from the existing activeBatchRowId — set
//    means a Batch row is open (REVIEW), null means authoring (START). No new
//    state, no new persistence.
//  · REVIEW renders only while a row is open, and is the active subtab
//    exactly then, so the two are never both inactive.
//  · The subtabs are NOT interactive. Entering REVIEW is still Deep Dive (the
//    grid's 🔍), and leaving it is still ✕ Unlink below. Wiring a click on a
//    subtab would be an exit/enter transition — behaviour, and later commits.
//  · The control group below was RELOCATED VERBATIM out of OutputPanel.jsx,
//    which used to carry its own underlined "Costing" tab label above this
//    same set of buttons. Handlers, conditions, disabled states, titles,
//    confirm wording and order are unchanged; only the container's vertical
//    padding was trimmed (4px → 3px) to offset the strip.
//
// ⚠️ THIS MAKES NO REVIEW-SAFETY CLAIM. Deep Dive still overwrites the one
// shared spec (useCostingBatchBridge.js:56), so opening a row still destroys
// unsent START work. That is C4's job, not this strip's.
// ═══════════════════════════════════════════════════════════════════════════
import SpecForm from "./SpecForm.jsx";
import OutputPanel from "./OutputPanel.jsx";
import { INIT_SPEC } from "../../data/defaults.js";
import { Btn } from "../../ui/primitives.jsx";
import { useAppState } from "../../state/AppStateContext.js";
import { C, sans } from "../../theme.js";

// One subtab. Same visual language as the panel-header tab label this strip
// replaces: amber text over a 2px amber underline when active.
const Subtab=({label,active})=>(
  <div style={{padding:"7px 14px",fontFamily:sans,fontSize:12,fontWeight:600,
    color:active?C.amber:C.slateL,
    borderBottom:`2px solid ${active?C.amber:"transparent"}`}}>{label}</div>);

export default function CostingTab(){
  const {
    setSpec, setSetAutoFill, setSpecCommitted,
    costingContext, setCostingContext, activeBatchRowId, setActiveBatchRowId,
    batchRows, _sendReady,
    sendCostingToBatch, specFromProfile, specForNewBatch,
  } = useAppState();
  const inReview=!!activeBatchRowId;
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,background:C.cream,flexShrink:0}}>
        <Subtab label="START" active={!inReview}/>
        {inReview&&<Subtab label="REVIEW" active/>}
        <div style={{marginLeft:"auto",padding:"3px 8px",display:"flex",gap:6,alignItems:"center"}}>
          {/* Unlink — shown only in REVIEW mode (activeBatchRowId set). Moved from left panel bottom. */}
          {activeBatchRowId&&<Btn ch="✕ Unlink" v="ghost" sm onClick={()=>{
            if(!window.confirm(
              "Unlink will exit this review.\n\n"+
              "Client/Sector/Mat Code/SKU will be cleared. Construction and output specs will be carried forward as starting defaults for the next SKU.\n\n"+
              "Any unsaved Costing changes will be lost. Continue?"
            ))return;
            setSpec(specFromProfile());
            setActiveBatchRowId(null);
            setSpecCommitted(false);
            setCostingContext("same-batch"); // returning from REVIEW to same-batch workspace
          }}/>}
          {/* C12: Context badge — visible when BatchEntry has rows, distinguishes same-batch vs new-batch */}
          {batchRows.length>0&&(
            <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:3,
              background:costingContext==="new-batch"?"#EEF4FB":"#FFF8ED",
              color:costingContext==="new-batch"?"#2E6094":C.amberD,
              border:`1px solid ${costingContext==="new-batch"?"#6A9FD4":C.amber}44`,
              whiteSpace:"nowrap"}}>
              {costingContext==="new-batch"
                ?`✦ Scratchpad · ${batchRows.length} row${batchRows.length!==1?"s":""} parked in Batch Entry`
                :`🔗 Batch active · ${batchRows.length} row${batchRows.length!==1?"s":""}`}
            </span>)}
          {/* C13: Send button — disabled when new-batch context would hard-block */}
          {(()=>{
            const _newBatchBlocked=costingContext==="new-batch"&&batchRows.length>0;
            const _disabled=!!activeBatchRowId||!_sendReady||_newBatchBlocked;
            return(
            <button onClick={activeBatchRowId?undefined:sendCostingToBatch}
              disabled={_disabled}
              title={activeBatchRowId?"Unavailable while reviewing an existing Batch row. Unlink the review first."
                :_newBatchBlocked?"Scratchpad context — go to Batch Entry → + New Batch to clear the old batch first"
                :_sendReady?"Send this spec to Batch Entry as a new row"
                :"Complete dimensions and paper layers first — see panel"}
              style={{padding:"6px 14px",borderRadius:6,border:"none",fontFamily:sans,
                fontSize:12,fontWeight:700,
                cursor:_disabled?"not-allowed":"pointer",
                background:_disabled?"#C0C0C0":C.amber,
                color:"white",letterSpacing:"0.01em",
                opacity:_disabled?0.55:1,transition:"all 0.15s"}}>
              → Send to Batch Entry
            </button>);
          })()}
          <Btn ch="Start new SKU" v="ghost" sm
            disabled={!!activeBatchRowId}
            title={activeBatchRowId?"Unavailable while reviewing an existing Batch row. Unlink the review first to start a new SKU."
              :costingContext==="new-batch"?"Start a fresh scratchpad SKU — retains construction, reads nothing from the parked BatchEntry batch"
              :"Start a fresh Costing spec seeded from the current Batch Profile"}
            onClick={activeBatchRowId?undefined:()=>{
              // costingContext is intentionally NOT changed — Start New SKU preserves current context
              setSpec(costingContext==="new-batch"?specForNewBatch():specFromProfile());
              setSpecCommitted(false);setSetAutoFill(true);}}/>
          {/* Costing + New Batch: non-destructive independent scratchpad context. Does NOT clear BatchEntry. */}
          <Btn ch="+ New Batch" v="ghost" sm
            disabled={!!activeBatchRowId}
            title={activeBatchRowId?"Unavailable while reviewing an existing Batch row."
              :"Start an independent scratchpad context. BatchEntry rows remain completely untouched."}
            onClick={activeBatchRowId?undefined:()=>{
              if(batchRows.length>0&&!window.confirm(
                "Start a new scratchpad batch context in Costing?\n\n"+
                `Your existing Batch Entry batch (${batchRows.length} row${batchRows.length!==1?"s":""}) remains completely untouched.\n\n`+
                "To import this new work into Batch Entry, go to Batch Entry → + New Batch first.\n\n"+
                "OK = Start scratchpad / Cancel = Stay"
              ))return;
              setSpec({...INIT_SPEC,plant:"",delivery:""});
              setCostingContext("new-batch");
              setSpecCommitted(false);
              setSetAutoFill(true);
            }}/>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"380px 1fr",flex:1,minHeight:0,overflow:"hidden"}}>
        <div style={{borderRight:`1px solid ${C.border}`,overflow:"hidden",
          display:"flex",flexDirection:"column"}}><SpecForm/></div>
        <div style={{overflow:"hidden",display:"flex",flexDirection:"column"}}><OutputPanel/></div>
      </div>
    </div>
  );
}
