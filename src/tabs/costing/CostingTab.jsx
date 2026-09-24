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
import ConstructionPicker from "../../components/ConstructionPicker.jsx";
import { Btn } from "../../ui/primitives.jsx";
import { useState } from "react";
import { useAppState } from "../../state/AppStateContext.js";
import { applyConstructionToSpec, isUsableConstruction } from "../../lib/constructionIdentity.js";
import { constrAutoName } from "../../lib/constructionName.js";
import { C, T, sans } from "../../theme.js";

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
    activeBatchRowId, batchRows, discardNewDraft,
    constructionCatalogue, newDraftKeepClient, newDraftNewClient, profileDraft,
    requestExitReview, sendCostingToBatch, setSpec, setTab, showToast, spec, startNewSku, _sendReady,
  } = useAppState();
  const inReview=!!activeBatchRowId;
  const reviewRow=batchRows.find(row=>row.id===activeBatchRowId);
  const durableReview=reviewRow?.durableRowId!=null;
  // C5: new-batch is DERIVED from the draft profile's existence, not a flag.
  const newBatch=profileDraft!==null;
  const [draftMenu,setDraftMenu]=useState(false);
  const [constructionPickerOpen,setConstructionPickerOpen]=useState(false);
  const [constructionQuery,setConstructionQuery]=useState('');
  const [constructionFilter,setConstructionFilter]=useState({sector:'',client:''});

  const closeConstructionPicker=()=>{
    setConstructionPickerOpen(false);
    setConstructionQuery('');
  };
  const openConstructionPicker=()=>{
    const candidates=constructionCatalogue.filter(c=>(c.status||'active')==='active'&&isUsableConstruction(c));
    const sector=spec.sector&&candidates.some(c=>(c.sector||'')===spec.sector)?spec.sector:'';
    const clientPool=sector?candidates.filter(c=>(c.sector||'')===sector):candidates;
    const client=spec.client&&clientPool.some(c=>(c.client||'')===spec.client)?spec.client:'';
    setConstructionQuery('');
    setConstructionFilter({sector,client});
    setConstructionPickerOpen(true);
  };
  const selectConstruction=construction=>{
    setSpec(current=>applyConstructionToSpec(current,construction));
    showToast(`✅ [${construction.code}] ${constrAutoName(construction)} applied to Costing START`,'success',4500);
    closeConstructionPicker();
  };
  const openFullLibrary=()=>{closeConstructionPicker();setTab('constrlib');};

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,background:C.cream,flexShrink:0}}>
        <Subtab label="QUICK CALCULATION" active={!inReview}
          onClick={inReview?requestExitReview:undefined}
          title={inReview?"Leave this review and return to your Costing draft":undefined}/>
        {inReview&&<Subtab label="COSTING DEEP-DIVE" active/>}
        {/* CDM-02 says this screen is a private browser-local scratchpad, and
            CC-24 records that nothing on it ever says so. One permanent line
            does, in the strip that already exists, rather than a banner. */}
        <span title={inReview
          ? durableReview
            ? "A session-only review copied from the exact durable Batch row. Push updates its local preview only; governed state changes only through the existing explicit governed actions."
            : "A review copy of an existing Batch row. It lives for this session only — reload and unpushed changes are gone."
          : "Your own working draft, kept in this browser. Nothing here is a Quote until it is added to a batch, and no customer can be shown it."}
          style={{alignSelf:"center",marginLeft:8,padding:"2px 7px",borderRadius:999,
            fontSize:T.micro,fontWeight:800,letterSpacing:"0.05em",textTransform:"uppercase",
            whiteSpace:"nowrap",color:C.amberD,background:C.amberL,
            border:`1px dashed ${C.amber}`}}>
          {inReview
            ? durableReview ? "Session copy · Push updates local preview" : "Session copy · not saved until Push"
            : "Private draft · this browser only"}</span>
        <div title={[spec.client,spec.material_code,spec.product].filter(Boolean).join(" · ")||"New SKU"}
          style={{alignSelf:"center",minWidth:0,maxWidth:"min(460px,38vw)",marginLeft:8,
            padding:"4px 10px",borderRadius:4,background:"#29465b",color:C.white,
            border:"1px solid #3a6078",fontFamily:sans,fontSize:T.body,fontWeight:650,letterSpacing:"0.01em",
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {[spec.client,spec.material_code,spec.product].filter(Boolean).join(" · ")||"New SKU"}
        </div>
        <div style={{marginLeft:"auto",padding:"3px 8px",display:"flex",gap:6,alignItems:"center"}}>
          {/* The review exit — shown only in REVIEW mode (activeBatchRowId set). Moved from
              left panel bottom. Was labelled "Unlink"; renamed to the user's intent (CC-25),
              same requestExitReview handler and the same single confirm rule. */}
          {activeBatchRowId&&<Btn ch="✕ Close review" v="ghost" sm onClick={requestExitReview}/>}
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
              title={activeBatchRowId?"Unavailable while reviewing an existing Batch row. Close the review first."
                :_newBatchBlocked?"Scratchpad context — go to Batch Entry → + New Batch to clear the old batch first"
                :_sendReady?"Add this SKU to the Batch Builder grid as a new row. It stays in this browser until a governed Batch is created."
                :"Complete dimensions and paper layers first — see panel"}
              style={{padding:"6px 14px",borderRadius:6,border:"none",fontFamily:sans,
                fontSize:12,fontWeight:700,
                cursor:_disabled?"not-allowed":"pointer",
                background:_disabled?"#C0C0C0":C.amber,
                color:"white",letterSpacing:"0.01em",
                opacity:_disabled?0.55:1,transition:"all 0.15s"}}>
              → Add to batch
            </button>);
          })()}
          <Btn ch="Start new SKU" v="ghost" sm
            disabled={!!activeBatchRowId}
            title={activeBatchRowId?"Unavailable while reviewing an existing Batch row. Close the review first to start a new SKU."
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
      <ConstructionPicker open={constructionPickerOpen&&!inReview} constructions={constructionCatalogue}
        query={constructionQuery} onQueryChange={setConstructionQuery}
        filter={constructionFilter} onFilterChange={setConstructionFilter}
        selectedCode={spec.constructionCode||''}
        contextLabel={`Applying to Costing START: ${spec.material_code||spec.product||'new SKU'}`}
        onClose={closeConstructionPicker} onOpenLibrary={openFullLibrary}
        onSelect={selectConstruction}/>
      {/* C5 · Batch Context — the relocated batch-level fields, sticky by
          structure: outside both scroll containers, so it stays put while the
          SKU form and the output panel scroll. */}
      <BatchContextBar/>
      <div style={{display:"grid",gridTemplateColumns:"380px 1fr",flex:1,minHeight:0,overflow:"hidden"}}>
        <div style={{borderRight:`1px solid ${C.border}`,overflow:"hidden",
          display:"flex",flexDirection:"column"}}><SpecForm onChooseConstruction={openConstructionPicker}/></div>
        <div style={{overflow:"hidden",display:"flex",flexDirection:"column"}}><OutputPanel/></div>
      </div>
    </div>
  );
}
