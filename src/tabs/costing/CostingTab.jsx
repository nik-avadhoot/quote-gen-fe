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
//  · C4 made START interactive while reviewing. Clicking START and clicking
//    ✕ Unlink are the SAME action — both call requestExitReview(), so they
//    share one confirm rule and one restoration path and cannot drift apart.
//    REVIEW stays non-interactive: it is the active tab whenever it renders.
//  · Entering REVIEW is still Deep Dive from the Batch Entry grid.
//  · The control group below was RELOCATED VERBATIM out of OutputPanel.jsx,
//    which used to carry its own underlined "Costing" tab label above this
//    same set of buttons. Handlers, conditions, disabled states, titles,
//    confirm wording and order are unchanged; only the container's vertical
//    padding was trimmed (4px → 3px) to offset the strip.
//
// C4 landed the review-copy split, so exiting REVIEW no longer rebuilds START:
// the draft was never touched and is simply revealed again. The old Unlink
// confirm promised the opposite — that Client/Sector/Mat Code would be cleared
// and construction carried forward — because it called setSpec(specFromProfile()),
// which reads the REVIEWED row's construction. That call and that wording are
// gone; do not reintroduce either.
// ═══════════════════════════════════════════════════════════════════════════
import SpecForm from "./SpecForm.jsx";
import OutputPanel from "./OutputPanel.jsx";
import BatchContextBar from "./BatchContextBar.jsx";
import { Btn } from "../../ui/primitives.jsx";
import { useState } from "react";
import { useAppState } from "../../state/AppStateContext.js";
import { C, sans } from "../../theme.js";

// One subtab. Same visual language as the panel-header tab label this strip
// replaces: amber text over a 2px amber underline when active.
const Subtab=({label,active,onClick,title})=>(
  <div onClick={onClick} title={title}
    style={{padding:"7px 14px",fontFamily:sans,fontSize:12,fontWeight:600,
    color:active?C.amber:C.slateL,
    cursor:onClick?"pointer":"default",
    borderBottom:`2px solid ${active?C.amber:"transparent"}`}}>{label}</div>);

export default function CostingTab(){
  const {
    activeBatchRowId, batchRows, discardNewDraft, exitReview,
    newDraftKeepClient, newDraftNewClient, profileDraft, reviewDirty,
    sendCostingToBatch, startNewSku, _sendReady,
  } = useAppState();
  const inReview=!!activeBatchRowId;
  // C5: new-batch is DERIVED from the draft profile's existence, not a flag.
  const newBatch=profileDraft!==null;
  const [draftMenu,setDraftMenu]=useState(false);

  // C4 - X1. The ONE exit path, shared by the Unlink button and the START
  // subtab. Confirms only when the review copy has unpushed changes; the
  // persisted START draft is never consulted, because exiting cannot harm it.
  // exitReview() also restores the workspace flags Deep Dive overwrote.
  const requestExitReview=()=>{
    if(reviewDirty){
      const _n=batchRows.findIndex(r=>r.id===activeBatchRowId)+1;
      if(!window.confirm(
        `Discard unpushed changes to Batch Row ${_n}?\n\n`+
        "Your Costing draft is untouched and will reappear as you left it.\n\n"+
        "OK = discard review changes  |  Cancel = stay in REVIEW"
      ))return;
    }
    exitReview();
  };
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,background:C.cream,flexShrink:0}}>
        <Subtab label="START" active={!inReview}
          onClick={inReview?requestExitReview:undefined}
          title={inReview?"Leave this review and return to your Costing draft":undefined}/>
        {inReview&&<Subtab label="REVIEW" active/>}
        <div style={{marginLeft:"auto",padding:"3px 8px",display:"flex",gap:6,alignItems:"center"}}>
          {/* Unlink — shown only in REVIEW mode (activeBatchRowId set). Moved from left panel bottom. */}
          {activeBatchRowId&&<Btn ch="✕ Unlink" v="ghost" sm onClick={requestExitReview}/>}
          {/* C12: Context badge — visible when BatchEntry has rows, distinguishes same-batch vs new-batch */}
          {batchRows.length>0&&(
            <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:3,
              background:newBatch?"#EEF4FB":"#FFF8ED",
              color:newBatch?"#2E6094":C.amberD,
              border:`1px solid ${newBatch?"#6A9FD4":C.amber}44`,
              whiteSpace:"nowrap"}}>
              {newBatch
                ?`✦ Scratchpad · ${batchRows.length} row${batchRows.length!==1?"s":""} parked in Batch Entry`
                :`🔗 Batch active · ${batchRows.length} row${batchRows.length!==1?"s":""}`}
            </span>)}
          {/* C13: Send button — disabled when new-batch context would hard-block */}
          {(()=>{
            const _newBatchBlocked=newBatch&&batchRows.length>0;
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
              :"Another SKU in this batch — construction and board specs carry forward"}
            onClick={activeBatchRowId?undefined:startNewSku}/>
          {/* C5: New Draft replaces "+ New Batch". Two ruled choices, and the
              parked Batch Entry batch is untouched by either. */}
          <div style={{position:"relative"}}>
            <Btn ch="New Draft ▾" v="ghost" sm
              disabled={!!activeBatchRowId}
              title={activeBatchRowId?"Unavailable while reviewing an existing Batch row."
                :"Start a new batch. The current Batch Entry batch stays parked and untouched."}
              onClick={activeBatchRowId?undefined:()=>setDraftMenu(m=>!m)}/>
            {draftMenu&&!activeBatchRowId&&(
              <div style={{position:"absolute",right:0,top:"100%",marginTop:3,zIndex:50,
                background:C.white,border:`1px solid ${C.border}`,borderRadius:6,
                boxShadow:"0 4px 14px rgba(0,0,0,.14)",minWidth:230,overflow:"hidden"}}>
                {[["Keep current client",newDraftKeepClient,
                   "Retains client and editable sector, plant, delivery and commercials. Clears construction and board specs."],
                  ["New client",newDraftNewClient,
                   "Clears customer and batch context, construction, board specs and commercials."]]
                  .map(([label,fn,hint])=>(
                  <div key={label} onClick={()=>{setDraftMenu(false);fn();}} title={hint}
                    style={{padding:"7px 11px",fontFamily:sans,fontSize:11,cursor:"pointer",
                      color:C.slate,borderBottom:`1px solid ${C.border}`}}>
                    New batch — {label}
                  </div>))}
              </div>)}
          </div>
          {/* X3 — only while a new-batch draft exists. */}
          {newBatch&&<Btn ch="Discard new draft" v="ghost" sm
            disabled={!!activeBatchRowId}
            title={activeBatchRowId?"Unavailable while reviewing an existing Batch row."
              :"Discard this new-batch draft and return to a clean START on the current batch."}
            onClick={activeBatchRowId?undefined:discardNewDraft}/>}
        </div>
      </div>
      {/* C5 · Batch Context — the relocated batch-level fields, sticky by
          structure: outside both scroll containers, so it stays put while the
          SKU form and the output panel scroll. */}
      <BatchContextBar/>
      <div style={{display:"grid",gridTemplateColumns:"380px 1fr",flex:1,minHeight:0,overflow:"hidden"}}>
        <div style={{borderRight:`1px solid ${C.border}`,overflow:"hidden",
          display:"flex",flexDirection:"column"}}><SpecForm/></div>
        <div style={{overflow:"hidden",display:"flex",flexDirection:"column"}}><OutputPanel/></div>
      </div>
    </div>
  );
}
