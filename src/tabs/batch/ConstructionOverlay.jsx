// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/batch/ConstructionOverlay.jsx — Batch Entry's slide-over library.
//
// Extracted from QuotationApp.jsx (Phase 7b). Structural move only.
//
// In the monolith this was `{batchConstrOverlay&&(()=>{ … })()}`. The IIFE is
// now the component body and the visibility test is an early `return null`,
// which is exactly equivalent: the IIFE never ran when the flag was false.
// useAppState() is the only hook and it precedes the early return, so the
// Rules of Hooks are satisfied.
//
// ⚠️ DELIBERATE DEVIATION FROM THE PLAN. The plan said "IIFE → component with
// local query/filter state". The query and filter stay in the store. Making
// them local would reset them when the overlay closes, which is a BEHAVIOUR
// change wearing a structural commit's clothes — the exact thing the
// one-concern-per-commit rule exists to stop. If that reset is wanted, it is
// its own commit with its own verification.
// ═══════════════════════════════════════════════════════════════════════════
import { constrAutoName } from "../../lib/constructionName.js";
import { C, mono } from "../../theme.js";
import { useAppState } from "../../state/AppStateContext.js";

export default function ConstructionOverlay(){
  const {batchConstrOverlay,batchConstrOverlayFilter,batchConstrOverlayQuery,
    batchConstrTargetRowId,batchRows,constructionLib,invalidateBatchRow,
    setBatchConstrOverlay,setBatchConstrOverlayFilter,setBatchConstrOverlayQuery,
    setBatchConstrTargetRowId,setBatchRows,setTab,showToast}=useAppState();
  if(!batchConstrOverlay) return null;
  // Apply overlay-specific filter (sector + client + query)
  const oq=batchConstrOverlayQuery.toLowerCase();
  const of=batchConstrOverlayFilter;
  const overlayLibFiltered=constructionLib.filter(c=>{
    if((c.status||'active')!=='active')return false;
    if(of.sector&&(c.sector||'')!==of.sector)return false;
    if(of.client&&(c.client||'')!==of.client)return false;
    if(of.gsm_min&&+c.board_gsm<+of.gsm_min)return false;
    if(of.gsm_max&&+c.board_gsm>+of.gsm_max)return false;
    if(of.bs_min&&+c.spec_bs<+of.bs_min)return false;
    if(of.bct_min&&+c.spec_bct<+of.bct_min)return false;
    if(of.ect_min&&+c.spec_ect<+of.ect_min)return false;
    if(of.cobb_max&&c.spec_cobb&&+c.spec_cobb>+of.cobb_max)return false;
    if(!oq)return true;
    const autoN=constrAutoName(c).toLowerCase();
    return c.code.toLowerCase().includes(oq)||autoN.includes(oq)||
      (c.name||'').toLowerCase().includes(oq)||
      (c.sector||'').toLowerCase().includes(oq)||
      (c.client||'').toLowerCase().includes(oq);
  });
  const closeOverlay=()=>{setBatchConstrOverlay(false);setBatchConstrTargetRowId(null);setBatchConstrOverlayQuery('');};
  const targetRow=batchConstrTargetRowId?batchRows.find(r=>r.id===batchConstrTargetRowId):null;
  return(<>
    {/* Click-outside backdrop — closes overlay when clicking the dimmed area */}
    <div onClick={closeOverlay}
      style={{position:"absolute",top:0,left:0,right:400,bottom:0,zIndex:199,
        background:"rgba(0,0,0,0.15)",cursor:"pointer"}}/>
  <div style={{position:"absolute",top:0,right:0,bottom:0,width:400,zIndex:200,
    display:"flex",flexDirection:"column",
    background:C.white,borderLeft:`2px solid ${C.amber}`,
    boxShadow:"-4px 0 24px rgba(0,0,0,.18)"}}>
    {/* Overlay header */}
    <div style={{padding:"10px 14px",background:C.slateM,display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
      <div style={{flex:1}}>
        <div style={{fontSize:12,fontWeight:700,color:C.amber}}>📚 Construction Library</div>
        {targetRow&&<div style={{fontSize:10,color:"rgba(255,255,255,.6)",marginTop:1}}>
          ↳ Applying to row: {targetRow.matCode||"—"} · {targetRow.product||"unnamed"}</div>}
      </div>
      <button onClick={()=>setTab("constrlib")}
        title="Open full Construction Library tab"
        style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${C.amber}`,
          background:"transparent",color:C.amber,fontSize:10,fontWeight:700,cursor:"pointer"}}>
        ⬡ Full Library
      </button>
      <button onClick={()=>{setBatchConstrOverlay(false);setBatchConstrTargetRowId(null);setBatchConstrOverlayQuery('');}}
        style={{background:"none",border:"none",color:"rgba(255,255,255,.6)",cursor:"pointer",fontSize:18,lineHeight:1,padding:"0 2px"}}>×</button>
    </div>
    {/* Search + Filter */}
    <div style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}`,background:C.cream,flexShrink:0}}>
      <input value={batchConstrOverlayQuery}
        onChange={e=>setBatchConstrOverlayQuery(e.target.value)}
        placeholder="Search code, name, sector, client…"
        style={{width:"100%",padding:"5px 8px",border:`1px solid ${batchConstrOverlayQuery?C.amber:C.border}`,
          borderRadius:5,fontSize:11,boxSizing:"border-box",marginBottom:6}}/>
      <div style={{display:"flex",gap:5,marginBottom:5}}>
        <select value={of.sector} onChange={e=>setBatchConstrOverlayFilter(p=>({...p,sector:e.target.value,client:''}))}
          style={{flex:1,padding:"3px 6px",border:`1px solid ${of.sector?C.amber:C.border}`,borderRadius:4,fontSize:10,color:C.slate,background:C.white}}>
          <option value="">All Sectors</option>
          {[...new Set(constructionLib.filter(c=>(c.status||'active')==='active').map(c=>c.sector||'').filter(Boolean))].sort()
            .map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <select value={of.client} onChange={e=>setBatchConstrOverlayFilter(p=>({...p,client:e.target.value}))}
          style={{flex:1,padding:"3px 6px",border:`1px solid ${of.client?C.amber:C.border}`,borderRadius:4,fontSize:10,color:C.slate,background:C.white}}>
          <option value="">All Clients</option>
          {[...new Set(constructionLib
            .filter(c=>(c.status||'active')==='active'&&(!of.sector||(c.sector||'')===of.sector))
            .map(c=>c.client||'').filter(Boolean))].sort()
            .map(cl=><option key={cl} value={cl}>{cl}</option>)}
        </select>
        {(batchConstrOverlayQuery||of.sector||of.client||of.gsm_min||of.gsm_max||of.bs_min||of.bct_min||of.ect_min||of.cobb_max)&&
          <button onClick={()=>{setBatchConstrOverlayQuery('');setBatchConstrOverlayFilter({sector:'',client:''});}}
            style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${C.red}33`,
              background:"transparent",color:C.red,fontSize:10,cursor:"pointer",fontWeight:600}}>✕ Clear</button>}
      </div>
      {/* STD spec filter — inline expand toggle */}
      {(()=>{
        const hasSpec=of.gsm_min||of.gsm_max||of.bs_min||of.bct_min||of.ect_min||of.cobb_max;
        return(<>
          <button onClick={()=>setBatchConstrOverlayFilter(p=>({...p,_showSpec:!p._showSpec}))}
            style={{fontSize:9,color:hasSpec?C.amber:C.slateL,background:"none",border:"none",
              cursor:"pointer",padding:"1px 0",fontWeight:hasSpec?700:400,width:"100%",textAlign:"left"}}>
            {of._showSpec?"▴":"▾"} Filter by STD specs{hasSpec?" (active)":""}
          </button>
          {of._showSpec&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"3px 6px",marginTop:4,
              padding:"6px 8px",background:C.white,borderRadius:4,border:`1px solid ${C.border}`}}>
              {[["gsm_min","GSM ≥"],["gsm_max","GSM ≤"],["bs_min","BS ≥"],
                ["bct_min","BCT ≥"],["ect_min","ECT ≥"],["cobb_max","Cobb ≤"]].map(([k,lbl])=>(
                <div key={k} style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:8,color:C.slateL,whiteSpace:"nowrap",minWidth:40}}>{lbl}</span>
                  <input type="number" step={0.25} value={of[k]||""}
                    onChange={e=>setBatchConstrOverlayFilter(p=>({...p,[k]:e.target.value}))}
                    style={{flex:1,padding:"2px 4px",border:`1px solid ${of[k]?C.amber:C.border}`,
                      borderRadius:3,fontSize:9,textAlign:"center"}}/>
                </div>))}
            </div>)}
        </>);
      })()}
      <div style={{fontSize:9,color:C.slateL,marginTop:4}}>{overlayLibFiltered.length} of {constructionLib.filter(c=>(c.status||'active')==='active').length} active shown</div>
    </div>
    {/* Scrollable construction list */}
    <div style={{flex:1,overflowY:"auto",padding:"8px 12px"}}>
      {overlayLibFiltered.length===0&&(
        <div style={{textAlign:"center",color:C.slateL,padding:"24px 0",fontSize:12}}>
          <div>No matching constructions</div>
          <div style={{fontSize:10,marginTop:8}}>
            <button onClick={()=>{setBatchConstrOverlay(false);setTab("constrlib");}}
              style={{background:"none",border:"none",color:C.amber,cursor:"pointer",textDecoration:"underline",fontSize:10}}>
              → Create one in the Construction Library tab
            </button>
          </div>
        </div>)}
      {overlayLibFiltered.map(c=>{
        const autoN=constrAutoName(c);
        const isSelected=batchConstrTargetRowId&&
          batchRows.find(r=>r.id===batchConstrTargetRowId)?.constructionCode===c.code;
        return(
        <div key={c.code}
          onClick={()=>{
            if(!batchConstrTargetRowId)return;
            // Fix 1: invalidate stale result for this row when construction changes
            invalidateBatchRow(batchConstrTargetRowId);
            setBatchRows(prev=>prev.map(r=>{
              if(r.id!==batchConstrTargetRowId)return r;
              const patch={constructionCode:c.code};
              // Auto-fill spec fields from construction entry
              if(c.board_gsm)patch.board_gsm=c.board_gsm;
              else if(c.layers){
                const _TUF={A:1.51,B:1.37,C:1.47,E:1.31};
                const _ly=c.layers||{};
                const _cGSM=(+(_ly.TOP?.gsm)||0)+(+(_ly.F1?.gsm)||0)*(_TUF[c.flute_F1||'B']||1)
                  +(+(_ly.L1?.gsm)||0)+(+(_ly.F2?.gsm)||0)*(_TUF[c.flute_F2||'A']||1)+(+(_ly.L2?.gsm)||0);
                if(_cGSM>0)patch.board_gsm=Math.round(_cGSM);
              }
              if(c.spec_bs)patch.spec_bs=c.spec_bs;
              if(c.spec_bct)patch.spec_bct=c.spec_bct;
              if(c.spec_ect)patch.spec_ect=c.spec_ect;
              return{...r,...patch};
            }));
            showToast(`✅ [${c.code}] ${autoN} applied`,'success');
            setBatchConstrOverlay(false);
            setBatchConstrTargetRowId(null);
            setBatchConstrOverlayQuery('');
          }}
          style={{padding:"8px 10px",marginBottom:5,borderRadius:6,cursor:"pointer",
            border:`1px solid ${isSelected?C.amber:C.border}`,
            background:isSelected?C.amberL:C.white,
            transition:"background 0.15s"}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
            <span style={{fontWeight:800,color:C.amber,fontFamily:mono,fontSize:13,flexShrink:0,minWidth:26}}>{c.code}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,fontWeight:700,color:C.slateM,lineHeight:1.3}}>{autoN}</div>
              {c.name&&c.name!==autoN&&<div style={{fontSize:9,color:C.slateL,fontStyle:"italic",marginTop:1}}>{c.name}</div>}
              <div style={{display:"flex",gap:3,marginTop:3,flexWrap:"wrap"}}>
                {c.sector&&<span style={{fontSize:8,background:C.amberL,color:C.amberD,borderRadius:3,padding:"1px 4px"}}>{c.sector}</span>}
                {c.client&&<span style={{fontSize:8,background:"#EEF4FB",color:"#2E6094",borderRadius:3,padding:"1px 4px"}}>{c.client}</span>}
                {c.spec_bs&&<span style={{fontSize:8,background:"#F0FFF4",color:C.green,borderRadius:3,padding:"1px 4px"}}>BS≥{c.spec_bs}</span>}
                {c.board_gsm&&<span style={{fontSize:8,background:C.cream,color:C.slateM,borderRadius:3,padding:"1px 4px"}}>{c.board_gsm}gsm</span>}
              </div>
            </div>
            <div style={{fontSize:10,color:C.amber,fontWeight:700,flexShrink:0}}>Select →</div>
          </div>
        </div>);
      })}
    </div>
    {/* Overlay footer */}
    <div style={{padding:"8px 12px",borderTop:`1px solid ${C.border}`,background:C.cream,flexShrink:0}}>
      <div style={{fontSize:10,color:C.slateL,textAlign:"center"}}>
        To create or edit constructions, use the{" "}
        <button onClick={()=>{setBatchConstrOverlay(false);setTab("constrlib");}}
          style={{background:"none",border:"none",color:C.amber,cursor:"pointer",textDecoration:"underline",fontSize:10,fontWeight:700}}>
          Construction Library tab
        </button>
      </div>
    </div>
  </div></>);
}
