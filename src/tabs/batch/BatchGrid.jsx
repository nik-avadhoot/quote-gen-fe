// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/batch/BatchGrid.jsx — the SKU grid: toolbar + table + sub-rows.
//
// Extracted from QuotationApp.jsx (Phase 7b). Structural move only.
//
// ⚠️ DELIBERATE RESTRAINT — this file is LEFT AS ONE FILE ON PURPOSE. Do not
// "tidy" any of the following. Each is load-bearing:
//
//   • The frozen columns carry cumulative `left:` offsets (0, 28, 52, 140,
//     258, …). They are brittle and positional; changing one shifts the rest.
//   • Rows render inside <Fragment key={row.id}> — NOT <>. A shorthand
//     fragment cannot take a key, and CLAUDE.md §5 bans <> inside table rows.
//   • The expanded sub-row is an IIFE and STAYS an IIFE.
//   • `upd` / `updC` are defined per-row inside .map(). They are plain
//     functions, not hooks, and belong there.
//   • The toolbar IIFE RETURNS AN ARRAY AND CHAINS .map() INSIDE ITSELF.
//     That is the CORRECT pattern per CLAUDE.md §5 — splitting the call from
//     the .map() renders raw objects as children and crashes React.
//
// Never reflow this file, never run Prettier or eslint --fix over it.
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment, useMemo, useRef } from "react";
import { BOX_TYPES } from "../../data/defaults.js";
import { buildSpecFromRow, checkSpecCompliance } from "../../engine/costing.js";
import { isPPType, sameSetCode } from "../../engine/rowType.js";
import { findDivergence, hasDivergence } from "../../lib/overrideDivergence.js";
import { Btn } from "../../ui/primitives.jsx";
import { STATUS_DISPLAY, constrAutoName } from "../../lib/constructionName.js";
import { C, mono, sans } from "../../theme.js";
import { useAppState } from "../../state/AppStateContext.js";

export default function BatchGrid(){
  const {activeBatchRowId,addBatchRow,autoCalcPPDims,autoCodeEnabled,autoCodeSeq,
    batchProfile,batchResults,batchRows,calculateAll,constructionLib,expandedRows,freight,
    generateCode,generateMissingCodes,getBatchRowStatus,invalidateAllBatchResults,
    invalidateBatchRow,loadBatchRowIntoCosting,partitionsMaster,pinnedAddOns,
    sendAllToQuoteItems,setAutoCodeEnabled,setBatchConstrOverlay,
    setBatchConstrOverlayFilter,setBatchConstrOverlayQuery,setBatchConstrTargetRowId,
    setBatchRows,showToast,togglePinAddOn,toggleRowExpand}=useAppState();
  // D-26: the SET Code value as it stood when the input took focus, so blur can
  // tell an edit from a tab-through and only re-resolve Nos/Set on a real change.
  //
  // Declared HERE, at the top level of the component — NOT inside the row .map()
  // where it is used. Hooks in a .map() break the Rules of Hooks and have caused
  // blank-screen crashes in this file before (see CLAUDE.md). One ref serves every
  // row because only one input holds focus at a time.
  const _setCodeAtFocus=useRef("");

  // ── D-28: which parameters DISAGREE across rows that share one export slot ──
  // The workbook holds one interest/freight for the whole quote, and one waste/conv
  // per Box and per PP. A row-level override reaches the document only if every row
  // in its group agrees. We flag DIVERGENCE, not override — amber already means
  // "this row overrides the profile" and that signal is kept.
  //
  // Declared HERE for the same reason as _setCodeAtFocus above: hooks must not run
  // inside the row .map(). One memo serves every row.
  const _divergence=useMemo(()=>{
    const isPP=r=>isPPType(r.itemType);
    const set=(r,k)=>r[k]!==""&&r[k]!=null;
    const ent=(group,value)=>({group,value});
    return {
      // Box/PP-pair level — the effective value is the override, else the profile default
      waste:findDivergence(batchRows.map((r,i)=>({label:String(i+1),
        ...ent(isPP(r)?"PP":"Box",
          set(r,"wasteConv_waste")?r.wasteConv_waste
            :(isPP(r)?(batchProfile.wastePP??5):(batchProfile.waste??5)))}))),
      conv:findDivergence(batchRows.map((r,i)=>({label:String(i+1),
        ...ent(isPP(r)?"PP":"Box",
          set(r,"wasteConv_conv")?r.wasteConv_conv
            :(isPP(r)?(batchProfile.convRatePP??12.5):(batchProfile.convRate??7)))}))),
      // Quote level — one slot for every row, so the group is constant
      interest:findDivergence(batchRows.map((r,i)=>({label:String(i+1),
        ...ent("",set(r,"interestOverride")?r.interestOverride:(batchProfile.interest??0.5))}))),
      freight:findDivergence(batchRows.map((r,i)=>({label:String(i+1),
        ...ent("",set(r,"freightRowOverride")?r.freightRowOverride
          :(batchProfile.freightOverride||freight?.[batchProfile.plant]?.[batchProfile.delivery]||0))}))),
    };
  },[batchRows,batchProfile,freight]);
  // Shared marker: red border + a ⚠ line in the tooltip. Amber (override) is untouched.
  const _divStyle=d=>d?{border:`1px solid ${C.red}`,background:"#FFF1F0"}:null;
  const _divTitle=(d,label,unit)=>d
    ?`\n⚠ ${d.group==="PP"?"PP rows":d.group==="Box"?"Box rows":"Rows"} disagree on ${label} (${d.values.join(", ")}). `
     +`The workbook holds ONE ${d.group?d.group+" ":""}${label} ${d.group?"":"for the whole quote "}`
     +`— the others will not reach the quote.${unit||""}`
    :"";
  return(
    <div style={{display:"flex",flex:1,overflow:"hidden",position:"relative"}}>
      {/* FULL WIDTH: SKU Grid (Construction Library now in overlay + separate tab) */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Ghost left panel placeholder — REMOVED. The old 300px Construction Library
            panel has been replaced by:
            1. A slide-over overlay (opened per-row or via toolbar button)
            2. The standalone Construction Library tab */}
        {/* ↓↓↓ old LEFT panel content REMOVED ↓↓↓ */}
        {/* Grid toolbar */}
        <div style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:8,
          alignItems:"center",flexWrap:"wrap",background:C.cream,flexShrink:0}}>
          <Btn ch="⚡ Calculate All" v="primary" sm onClick={calculateAll}
            disabled={batchRows.length===0||constructionLib.length===0}/>
          <Btn ch="→ Send All to Quote Items" v="success" sm onClick={sendAllToQuoteItems}
            disabled={Object.keys(batchResults).length===0}/>
          <button onClick={()=>{setBatchConstrOverlay(true);setBatchConstrTargetRowId(null);setBatchConstrOverlayQuery('');setBatchConstrOverlayFilter({sector:'',client:'',});}}
            style={{padding:"3px 10px",borderRadius:5,border:`1px solid ${C.amber}`,
              background:C.amberL,color:C.amberD,fontSize:11,cursor:"pointer",fontWeight:700}}>
            📚 Construction Library ({constructionLib.filter(c=>(c.status||'active')==='active').length} active)
          </button>
          <div style={{borderLeft:`1px solid ${C.border}`,paddingLeft:8,display:"flex",gap:6}}>
            {["Box","Plate","Part-L","Part-W"].map(t=>(
              <button key={t} onClick={()=>addBatchRow(t)}
                style={{padding:"3px 9px",borderRadius:5,border:`1px solid ${C.border}`,
                  background:C.white,color:C.slateM,fontSize:11,cursor:"pointer",fontWeight:600}}>
                + {t}</button>))}
          </div>
          <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
            <label style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:C.slateM,cursor:"pointer"}}>
              <input type="checkbox" checked={autoCodeEnabled} onChange={e=>setAutoCodeEnabled(e.target.checked)}
                style={{accentColor:C.amber}}/>
              Auto-code
            </label>
            {autoCodeEnabled&&<button onClick={generateMissingCodes}
              style={{padding:"3px 9px",borderRadius:5,border:`1px solid ${C.amber}`,
                background:C.amberL,color:C.amberD,fontSize:11,cursor:"pointer",fontWeight:600}}>
              ↯ Generate Missing Codes</button>}
            <span style={{fontSize:10,color:C.slateL}}>Format: {generateCode(autoCodeSeq)}</span>
          </div>
        </div>

        {/* The grid */}
        {batchRows.length===0
          ?<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              height:"100%",color:C.slateL,gap:10}}>
              <div style={{fontSize:32}}>📋</div>
              <div style={{fontSize:13,fontWeight:600,color:C.slateM}}>No SKUs yet</div>
              <div style={{fontSize:11}}>Click + Box, + Plate etc above to add rows. First 5 columns (Status → SET Role) are frozen while you scroll right.</div>
            </div>
          :<div style={{flex:1,overflowX:"auto",overflowY:"auto"}}>
            <table style={{borderCollapse:"collapse",fontSize:11,minWidth:1400,width:"100%"}}>
              <thead style={{position:"sticky",top:0,zIndex:5}}>
                <tr style={{background:C.slateM}}>
                  {(()=>{
                    // First 5 columns are frozen (sticky). Cumulative left offsets:
                    // St=28 | #=24 | MatCode=88 | SKU=118 | SETRole=78
                    const FROZEN={
                      "St":      {left:0,   width:28},
                      "#":       {left:28,  width:24},
                      "Mat Code":{left:52,  width:88},
                      "SKU / Product":{left:140, width:118},
                      "SET Role":{left:258, width:78, borderRight:true},
                    };
                    const CENTER_COLS=["L","W","H","Ups","Nos/Set","Std GSM","Std BS","Std BCT","Std ECT","Std Cobb","Std Box Wt","Sales MOQ","Vol/mo","Waste%","Conv Rs/kg","Margin%","Sheet Wt","Rate/SET (₹)","MOQ","Rate/kg (₹)","Calc GSM","Calc BS","Est Box Wt"];
                    return ["St","#","Mat Code","SKU / Product","SET Role","SET Code","Nos/Set","Box Type","Paper Construction","L","W","H","Ups",
                      "Std GSM","Std BS","Std BCT","Std ECT","Std Cobb","Std Box Wt",
                      "Sales MOQ","Vol/mo","Waste%","Conv Rs/kg","Margin%","Remarks",
                      "Sheet Wt","Final Rate (₹)","Rate/SET (₹)","MOQ","Rate/kg (₹)","Calc GSM","Calc BS","Est Box Wt","All Spec OK"
                    ].map(h=>{
                      const fr=FROZEN[h];
                      return<th key={h} style={{
                        padding:"6px 5px",color:C.white,fontSize:9,fontWeight:600,
                        textAlign:CENTER_COLS.includes(h)?"center":"left",
                        whiteSpace:"nowrap",
                        borderRight:fr?.borderRight?`2px solid ${C.amber}44`:`1px solid ${C.slateL}44`,
                        ...(fr?{
                          position:"sticky",left:fr.left,zIndex:6,
                          background:C.slateM,
                          boxShadow:fr.borderRight?"2px 0 6px rgba(0,0,0,.18)":undefined,
                        }:{}),
                      }}>{h}</th>;
                    });
                  })()}
                  {pinnedAddOns.map(k=>{
                    const AO_LABELS={printing:"Print",stitching:"Stitch",coating:"Coat",handling:"Hdlg",moqCharge:"MOQ Chg",packing:"Pack",other:"Other",unloading:"Unlod"};
                    return<th key={`pin_${k}`} style={{padding:"6px 4px",color:C.amber,fontSize:9,fontWeight:600,textAlign:"center",whiteSpace:"nowrap",borderRight:`1px solid ${C.slateL}44`,background:"#3a2a10"}}>
                      {AO_LABELS[k]||k}<br/><span style={{fontSize:8,fontWeight:400,opacity:0.7}}>Rs/pc ⊕</span></th>;})}
                  <th style={{padding:"6px 4px",color:C.white,fontSize:9,minWidth:52,textAlign:"center"}}>▾ more</th>
                </tr>
              </thead>
              <tbody>
                {batchRows.map((row,ri)=>{
                  const res=batchResults[row.id];
                  const st=getBatchRowStatus(row);
                  const sd=STATUS_DISPLAY[st]||STATUS_DISPLAY["draft-uncalc"];
                  const isActive=activeBatchRowId===row.id;
                  const upd=(k,v)=>setBatchRows(prev=>prev.map(r=>r.id===row.id?{...r,[k]:v}:r));
                  // Fix 1: updC = update a costing-relevant field AND clear this row's stale result.
                  const updC=(k,v)=>{upd(k,v);invalidateBatchRow(row.id);};
                  const inp=(k,w=50,type="text")=>(
                    <input type={type} value={row[k]??""} step={type==="number"?"0.25":undefined}
                      onChange={e=>upd(k,type==="number"?+e.target.value:e.target.value)}
                      style={{width:w,padding:"2px 4px",border:`1px solid ${C.border}`,
                        borderRadius:3,fontSize:10,textAlign:type==="number"?"center":"left",
                        fontFamily:type==="number"?mono:sans}}/>
                  );
                  // Fix ⑤: inpC = same as inp but uses updC (invalidates row result on change).
                  // Used for nosPerSet — changes SET rate — and any other costing-relevant simple inputs.
                  const inpC=(k,w=50,type="text")=>(
                    <input type={type} value={row[k]??""} step={type==="number"?"0.25":undefined}
                      onChange={e=>updC(k,type==="number"?+e.target.value:e.target.value)}
                      style={{width:w,padding:"2px 4px",border:`1px solid ${C.border}`,
                        borderRadius:3,fontSize:10,textAlign:type==="number"?"center":"left",
                        fontFamily:type==="number"?mono:sans}}/>
                  );
                  const dimRow=autoCalcPPDims(row);
                  const comp=res&&buildSpecFromRow(dimRow,constructionLib.find(c=>c.code===row.constructionCode),batchProfile)
                    ?checkSpecCompliance(buildSpecFromRow(dimRow,constructionLib.find(c=>c.code===row.constructionCode),batchProfile),res):[];
                  const bsOk=comp.length===0?"✅":comp.some(c=>c.severity==="high")?"❌":"⚠️";
                  return(<Fragment key={row.id}>
                    <tr style={{background:isActive?"#EEF4FB":ri%2?C.cream:C.white,
                      borderBottom:`1px solid ${C.border}44`}}>
                      {/* ── FROZEN COL 1: Status (left:0, w:28) — click to expand/collapse sub-row ── */}
                      <td onClick={()=>toggleRowExpand(row.id)}
                        title={expandedRows.has(row.id)?`Collapse sub-row (${sd.label})`:`Expand sub-row: add-ons, overrides, cost build-up (${sd.label})`}
                        style={{padding:"3px 4px",textAlign:"center",width:28,minWidth:28,
                          position:"sticky",left:0,zIndex:3,cursor:"pointer",
                          background:expandedRows.has(row.id)
                            ?`${C.amber}22`
                            :isActive?"#EEF4FB":ri%2?C.cream:C.white,
                          borderBottom:expandedRows.has(row.id)?`2px solid ${C.amber}`:undefined}}>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                          <span>{sd.icon}</span>
                          <span style={{fontSize:7,color:expandedRows.has(row.id)?C.amber:C.slateL,lineHeight:1}}>
                            {expandedRows.has(row.id)?"▴":"▾"}
                          </span>
                        </div>
                      </td>
                      {/* ── FROZEN COL 2: Row # (left:28, w:24) ── */}
                      <td style={{padding:"3px 4px",color:C.slateL,fontWeight:600,width:24,minWidth:24,
                        position:"sticky",left:28,zIndex:3,
                        background:isActive?"#EEF4FB":ri%2?C.cream:C.white}}>
                        {ri+1}</td>
                      {/* ── FROZEN COL 3: Mat Code (left:52, w:88) ── */}
                      <td style={{padding:"2px 3px",width:88,minWidth:88,
                        position:"sticky",left:52,zIndex:3,
                        background:isActive?"#EEF4FB":ri%2?C.cream:C.white}}>
                        <div style={{display:"flex",gap:2,alignItems:"center"}}>
                          <input value={row.matCode||""} style={{width:72,padding:"2px 4px",border:`1px solid ${C.border}`,borderRadius:3,fontSize:10,fontFamily:mono}}
                            onChange={e=>{
                              const mc=e.target.value;
                              upd("matCode",mc);
                              // Main Box: keep SET Code in sync with Mat Code as long as they
                              // are currently equal (user hasn't manually diverged them).
                              if(row.setAutoFill&&(row.itemType||"Box")==="Box"&&(row.setCode===""||row.setCode===row.matCode)){
                                upd("setCode",mc);
                                invalidateAllBatchResults(); // cross-row: Part rows use Box setCode for auto-dim lookup
                              }
                            }}/>
                          {row.autoCode&&<span title="Auto-generated" style={{fontSize:9,color:C.amber}}>⚡</span>}
                        </div>
                      </td>
                      {/* ── FROZEN COL 4: SKU / Product (left:140, w:118) ── */}
                      <td style={{padding:"2px 3px",width:118,minWidth:118,
                        position:"sticky",left:140,zIndex:3,
                        background:isActive?"#EEF4FB":ri%2?C.cream:C.white}}>
                        <input type="text" value={row.product||""} onChange={e=>upd("product",e.target.value)}
                          style={{width:108,padding:"2px 4px",border:`1px solid ${C.border}`,borderRadius:3,fontSize:10}}/>
                      </td>
                      {/* ── FROZEN COL 5: SET Role (left:258, w:78) — disabled when no SET Code ── */}
                      <td style={{padding:"2px 3px",width:78,minWidth:78,
                        position:"sticky",left:258,zIndex:3,
                        borderRight:`2px solid ${C.amber}55`,
                        boxShadow:"2px 0 6px rgba(0,0,0,.18)",
                        background:isActive?"#EEF4FB":ri%2?C.cream:C.white}}>
                        {(()=>{
                          // SET Role is only meaningful when a SET Code exists and is confirmed.
                          // When SET Code is blank (explicitly cleared), role = NA, dropdown disabled.
                          const hasSetCode=(row.setCode||"").trim()!=="";
                          const isNA=!hasSetCode;
                          return(
                          <select value={isNA?"NA":row.itemType||"Box"}
                            disabled={isNA}
                            onChange={e=>{
                              // Fix ⑤: SET Role change switches boxType, deckle path, waste/conv source,
                              // and margin source — must invalidate the stale result.
                              const v=e.target.value;updC("itemType",v);
                              if(v==="Plate"||v==="Part-L"||v==="Part-W"){updC("boxType","PP");}
                              else if(v==="Box"){updC("boxType","RSC");}
                            }}
                            title={isNA?"SET Code is cleared — this row is standalone (no SET role)":undefined}
                            style={{padding:"2px 3px",border:`1px solid ${isNA?"#CCC":C.border}`,
                              borderRadius:3,fontSize:9,width:70,
                              background:isNA?"#F5F5F5":"",
                              color:isNA?"#999":C.slate,
                              cursor:isNA?"not-allowed":"pointer"}}>
                            {isNA&&<option value="NA">— N/A —</option>}
                            {[{v:"Box",l:"Main Box"},{v:"Plate",l:"Liner Plate"},{v:"Part-L",l:"Partition-L"},{v:"Part-W",l:"Partition-W"},{v:"Other",l:"Other"}]
                              .map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
                          </select>);
                        })()}
                      </td>
                      {/* SET Code — with "Part of a SET" switch + assumed indicator + confirm/clear for non-Box rows */}
                      <td style={{padding:"3px 4px",minWidth:86}}>
                        {(()=>{
                          const isAssumed=!!row.setCodeAssumed;
                          const isNonBox=row.itemType!=="Box";
                          // D-26: THE RESOLUTION, LIFTED OUT OF THE CONTROL.
                          // This used to live inside handleConfirm only — and handleConfirm renders
                          // only while setCodeAssumed is true. Typing in the SET Code field clears
                          // that flag below, which removes the confirm control from the DOM, so a
                          // Maker who TYPED a code got auto-dims (they run on render, via
                          // autoCalcPPDims) and SILENTLY NO Nos/Set. Two behaviours resolving the
                          // same parent, one of them reachable only through a control that typing
                          // destroys.
                          //
                          // One resolution, two entry points: the confirm button, and blur of the
                          // SET Code input.
                          const applyGlassSKUNos=()=>{
                            // Glass SKU auto-fill for ALCOBEV Part-L / Part-W rows
                            if(batchProfile.sector==="ALCOBEV"&&(row.itemType==="Part-L"||row.itemType==="Part-W")){
                              const confirmedSetCode=(row.setCode||"").trim();
                              const parentBox=batchRows.find(r=>
                                r.itemType==="Box"&&!r.setCodeAssumed&&sameSetCode(r.setCode,confirmedSetCode)); // D-7
                              // D-1: parent wins, this row is the fallback. Parts can be sent from
                              // Costing before the Box exists, and a Box with setCodeAssumed===true is
                              // excluded by the predicate above — so the parent is often simply absent.
                              // Precedence rule, not a second source of truth: the Part carries the SET's
                              // value forward until the head exists.
                              const effGlassSKU=parentBox?.glassSKUType||row.glassSKUType||"";
                              if(effGlassSKU){
                                const pm=partitionsMaster.find(x=>x.skuType===effGlassSKU);
                                if(pm){
                                  const nos=row.itemType==="Part-L"?pm.lwise:pm.wwise;
                                  updC("nosPerSet",nos); // row-scoped: nosPerSet changes this row's SET rate
                                  showToast(`🍶 Nos/Set auto-filled: ${nos} (${effGlassSKU})`,'success',3000);
                                }
                              } else if(parentBox&&!parentBox.glassSKUType){
                                showToast(`⚠️ Glass SKU Type not yet set on the parent Box — set it first to auto-fill Nos/Set`,'info',5000);
                              }
                            }
                          };
                          // Confirm handler: clears assumed flag, triggers auto-dims + Glass SKU fill
                          const handleConfirm=()=>{
                            upd("setCodeAssumed",false);
                            applyGlassSKUNos();
                          };
                          // Clear handler: blank SET Code, mark as standalone, disable SET Role
                          const handleClear=()=>{
                            upd("setCode","");
                            upd("setCodeAssumed",false);
                            invalidateAllBatchResults(); // cross-row: Part rows use this Box's setCode for auto-dim lookup
                          };
                          return(
                          <div style={{display:"flex",flexDirection:"column",gap:1}}>
                            <div style={{position:"relative",display:"inline-block"}}>
                              <input type="checkbox" checked={!!row.setAutoFill}
                                onChange={e=>{
                                  const on=e.target.checked;
                                  upd("setAutoFill",on);
                                  if(!on){
                                    upd("setCode","");
                                    upd("setCodeAssumed",false);
                                    invalidateAllBatchResults();
                                  } else {
                                    // Restore default: Box→own matCode; PP→nearest preceding confirmed Box setCode
                                    if((row.itemType||"Box")==="Box"){
                                      upd("setCode",row.matCode||"");
                                      invalidateAllBatchResults();
                                    } else {
                                      const ri2=batchRows.findIndex(r=>r.id===row.id);
                                      const parentBox=[...batchRows.slice(0,ri2)].reverse().find(r=>r.itemType==="Box"&&r.matCode&&!r.setCodeAssumed);
                                      if(parentBox){upd("setCode",parentBox.setCode||parentBox.matCode||"");upd("setCodeAssumed",true);invalidateAllBatchResults();}
                                    }
                                  }
                                }}
                                style={{position:"absolute",left:3,top:"50%",transform:"translateY(-50%)",
                                  accentColor:"#9A7B4A",cursor:"pointer",width:10,height:10,zIndex:1}}/>
                              <input value={row.setCode||""} placeholder="SET code"
                                // D-26: resolve on BLUR, not onChange — onChange fires per keystroke
                                // and would resolve against half-typed codes.
                                //
                                // ⚠️ ONLY when the code actually CHANGED during this focus. Without
                                // that guard, tabbing through the field re-runs the resolution and
                                // overwrites a Nos/Set the Maker set deliberately — materialising
                                // over an explicit value, the same hazard as D-9 and D-16.
                                onFocus={e=>{_setCodeAtFocus.current=e.target.value;}}
                                onBlur={e=>{if(e.target.value!==_setCodeAtFocus.current)applyGlassSKUNos();}}
                                onChange={e=>{
                                  // setCode is cross-row: autoCalcPPDims finds a Part row's parent Box by matching
                                  // r.setCode across all batch rows. Changing any setCode can alter another row's
                                  // auto-derived dims — invalidateBatchRow(row.id) is insufficient.
                                  upd("setCode",e.target.value);
                                  invalidateAllBatchResults();
                                  if(isAssumed)upd("setCodeAssumed",false);
                                }}
                                style={{width:76,padding:"2px 4px 2px 18px",
                                  border:`1px solid ${isAssumed?"#E8830A":C.border}`,
                                  borderRadius:3,fontSize:10,fontFamily:mono,
                                  background:isAssumed?"#FFF8ED":C.white}}/>
                            </div>
                            {isAssumed&&isNonBox&&(
                              <div style={{display:"flex",gap:2,alignItems:"center"}}>
                                <span style={{fontSize:7,color:"#E8830A",fontWeight:700,letterSpacing:"0.03em"}}>⚠ assumed</span>
                                <button onClick={handleConfirm}
                                  title="Confirm this SET Code is correct"
                                  style={{fontSize:8,color:C.green,background:"none",border:`1px solid ${C.green}`,
                                    borderRadius:2,cursor:"pointer",padding:"0 3px",lineHeight:1.4,fontWeight:700}}>✓</button>
                                <button onClick={handleClear}
                                  title="Clear SET Code — this item is standalone, not part of a SET"
                                  style={{fontSize:8,color:C.red,background:"none",border:`1px solid ${C.red}33`,
                                    borderRadius:2,cursor:"pointer",padding:"0 3px",lineHeight:1.4}}>✕</button>
                              </div>)}
                          </div>);
                        })()}
                      </td>
                      {/* Nos/Set — shows 🍶 badge for ALCOBEV Part rows with glassSKUType set */}
                      <td style={{padding:"3px 4px",textAlign:"center",minWidth:50}}>
                        {(()=>{
                          const isAlcoPart=batchProfile.sector==="ALCOBEV"&&(row.itemType==="Part-L"||row.itemType==="Part-W");
                          return(
                          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                            {inpC("nosPerSet",40,"number")}
                            {isAlcoPart&&row.glassSKUType&&(
                              <span style={{fontSize:7,color:"#2E6094",background:"#EEF4FB",
                                borderRadius:2,padding:"0 3px",whiteSpace:"nowrap",maxWidth:44,
                                overflow:"hidden",textOverflow:"ellipsis"}}
                                title={`Glass SKU: ${row.glassSKUType}`}>
                                🍶 {row.glassSKUType.substring(0,8)}
                              </span>)}
                          </div>);
                        })()}
                      </td>
                      {/* Box Type */}
                      <td style={{padding:"3px 4px",minWidth:58}}>
                        <select value={row.boxType||"RSC"} onChange={e=>updC("boxType",e.target.value)}
                          style={{padding:"2px 3px",border:`1px solid ${C.border}`,borderRadius:3,fontSize:9,width:54}}>
                          {BOX_TYPES.map(bt=><option key={bt} value={bt}>{bt}</option>)}
                        </select>
                      </td>
                      {/* Paper Construction — opens slide-over overlay for selection */}
                      <td style={{padding:"3px 4px",minWidth:164}}>
                        {(()=>{
                          const ce=row.constructionCode?constructionLib.find(c=>c.code===row.constructionCode):null;
                          const autoN=ce?constrAutoName(ce):"";
                          return(
                          <button
                            onClick={()=>{
                              setBatchConstrOverlay(true);
                              setBatchConstrTargetRowId(row.id);
                              setBatchConstrOverlayQuery('');
                              setBatchConstrOverlayFilter({sector:'',client:''});
                            }}
                            title={ce?`[${ce.code}] ${autoN} — click to change`:"Click to select a construction"}
                            style={{width:156,padding:"3px 6px",
                              border:`1px solid ${row.constructionCode?C.border:C.red}`,
                              borderRadius:3,fontSize:9,textAlign:"left",cursor:"pointer",
                              background:row.constructionCode?C.white:"#FFF5F5",
                              color:row.constructionCode?C.slateM:C.red,
                              fontFamily:mono,display:"flex",alignItems:"center",gap:4}}>
                            {row.constructionCode
                              ?<><span style={{color:C.amber,fontWeight:800}}>{row.constructionCode}</span>
                                <span style={{fontSize:8,color:C.slateL,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>
                                  {autoN.substring(0,22)}{autoN.length>22?"…":""}</span></>
                              :<span style={{fontSize:9}}>— pick construction 📚</span>}
                          </button>);
                        })()}
                      </td>
                      {/* L W H Ups — L/W show a live auto-calc placeholder for Plate/Partition rows
                          left blank (derived from the nearest preceding Box row) */}
                      {["L","W","H","ups"].map(k=>{
                        const isAutoDim=(k==="L"||k==="W")&&row.itemType!=="Box"&&(row[k]===""||row[k]==null);
                        const autoVal=isAutoDim?autoCalcPPDims(row)[k]:null;
                        // B6: dimension range validation for L/W/H (not ups)
                        const isDimField=k==="L"||k==="W"||k==="H";
                        const dimVal=row[k]!==""&&row[k]!=null?+row[k]:null;
                        const dimInvalid=isDimField&&dimVal!=null&&(dimVal<=0||dimVal>2500);
                        const dimTip=dimInvalid?`⚠ ${k}=${dimVal}mm is outside valid range (1–2500mm) — please verify`:"";
                        return(
                          <td key={k} style={{padding:"3px 4px",textAlign:"center",minWidth:52}}>
                            {isAutoDim
                              ?<input type="number" step="0.25" value=""
                                  placeholder={autoVal!=null?`↳${autoVal}`:"—"}
                                  onChange={e=>updC(k,e.target.value===""?"":+e.target.value)}
                                  title={autoVal!=null?`Auto-calculated from parent Box row: ${autoVal}mm (type a value to override)`:"No parent Box row found to auto-calculate from"}
                                  style={{width:44,padding:"2px 4px",border:`1px dashed ${C.border}`,
                                    borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,color:C.slateL}}/>
                              :<input type="number" step="0.25" value={row[k]??""}
                                  onChange={e=>updC(k,e.target.value===""?"":+e.target.value)}
                                  title={dimTip||undefined}
                                  style={{width:44,padding:"2px 4px",
                                    border:`1px solid ${dimInvalid?C.red:C.border}`,
                                    borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                                    background:dimInvalid?C.redL:C.white,
                                    color:dimInvalid?C.red:undefined}}/>}
                          </td>);
                      })}
                      {/* Std specs: Board GSM, BS, BCT, ECT, Cobb, Box Wt */}
                      {["board_gsm","spec_bs","spec_bct","spec_ect"].map(k=>(
                        <td key={k} style={{padding:"3px 4px",textAlign:"center",minWidth:50}}>
                          {inp(k,44,"number")}</td>))}
                      {/* Std Cobb — amber flag when ≤125 */}
                      <td style={{padding:"3px 4px",textAlign:"center",minWidth:54}}>
                        <input type="number" step={5} value={row.spec_cobb??""}
                          onChange={e=>upd("spec_cobb",e.target.value===""?"":+e.target.value)}
                          title={(()=>{const cv=row.spec_cobb?+row.spec_cobb:null;return cv&&cv<=125?"⚠️ Cobb Max "+cv+" — moisture-sensitive, confirm Coating add-on":cv&&cv<=155?"Cobb Max "+cv+" g/m² — standard":"Cobb (g/m² Max) — leave blank if not specified";})()}
                          style={{width:44,padding:"2px 4px",
                            border:`1px solid ${row.spec_cobb&&+row.spec_cobb<=125?C.amber:C.border}`,
                            borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                            background:row.spec_cobb&&+row.spec_cobb<=125?"#FFF8ED":C.white}}/>
                      </td>
                      <td style={{padding:"3px 4px",textAlign:"center",minWidth:52}}>
                        {inp("reqBoxWt",44,"number")}</td>
                      {/* Commercial */}
                      <td style={{padding:"3px 4px",textAlign:"center",minWidth:70}}>{inp("salesMOQ",58,"number")}</td>
                      <td style={{padding:"3px 4px",textAlign:"center",minWidth:62}}>{inp("volume",52,"number")}</td>
                      {/* Waste% override (context-interpreted: Box or PP based on row type) */}
                      <td style={{padding:"3px 4px",textAlign:"center",minWidth:52}}>
                        {(()=>{
                          const isPP=isPPType(row.itemType); // R-2
                          const profVal=isPP?(batchProfile.wastePP??5):(batchProfile.waste??5);
                          const isOvr=row.wasteConv_waste!==""&&row.wasteConv_waste!=null;
                          return<input type="number" step="0.25" value={row.wasteConv_waste??""}
                            placeholder={String(profVal)}
                            onChange={e=>updC("wasteConv_waste",e.target.value===""?"":+e.target.value)}
                            title={`${isPP?"PP":"Box"} Waste% — profile default: ${profVal}%${isOvr?" | OVERRIDDEN":""}`
                              +_divTitle(_divergence.waste.find(d=>d.group===(isPP?"PP":"Box")),"Waste%")}
                            style={{width:44,padding:"2px 4px",border:`1px solid ${isOvr?C.amber:C.border}`,
                              borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                              background:isOvr?"#FFF8ED":C.white,
                              ..._divStyle(hasDivergence(_divergence.waste,isPP?"PP":"Box"))}}/>;
                        })()}
                      </td>
                      {/* Conv Rs/kg override */}
                      <td style={{padding:"3px 4px",textAlign:"center",minWidth:58}}>
                        {(()=>{
                          const isPP=isPPType(row.itemType); // R-2
                          const profVal=isPP?(batchProfile.convRatePP??12.5):(batchProfile.convRate??7);
                          const isOvr=row.wasteConv_conv!==""&&row.wasteConv_conv!=null;
                          return<input type="number" step="0.25" value={row.wasteConv_conv??""}
                            placeholder={String(profVal)}
                            onChange={e=>updC("wasteConv_conv",e.target.value===""?"":+e.target.value)}
                            title={`${isPP?"PP":"Box"} Conv Rs/kg — profile default: ${profVal}${isOvr?" | OVERRIDDEN":""}`
                              +_divTitle(_divergence.conv.find(d=>d.group===(isPP?"PP":"Box")),"Conv Rs/kg")}
                            style={{width:50,padding:"2px 4px",border:`1px solid ${isOvr?C.amber:C.border}`,
                              borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                              background:isOvr?"#FFF8ED":C.white,
                              ..._divStyle(hasDivergence(_divergence.conv,isPP?"PP":"Box"))}}/>;
                        })()}
                      </td>
                      {/* Margin% */}
                      <td style={{padding:"3px 4px",textAlign:"center",minWidth:58}}>
                        <input type="number" step="0.25" value={row.marginOverride??""}
                          placeholder={String(
                            (row.itemType==="Plate"||row.itemType==="Part-L"||row.itemType==="Part-W")
                              ?(batchProfile.marginPP??batchProfile.margin??8)
                              :(batchProfile.margin??8)
                          )}
                          onChange={e=>updC("marginOverride",e.target.value===""?"":+e.target.value)}
                          title={row.marginOverride!=null&&row.marginOverride!==""?"Row override":`Inherits: ${(row.itemType==="Plate"||row.itemType==="Part-L"||row.itemType==="Part-W")?(batchProfile.marginPP??batchProfile.margin??8):(batchProfile.margin??8)}% from profile`}
                          style={{width:46,padding:"2px 4px",border:`1px solid ${row.marginOverride!=null&&row.marginOverride!==""?C.amber:C.border}`,
                            borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                            background:row.marginOverride!=null&&row.marginOverride!==""?"#FFF8ED":C.white}}/>
                      </td>
                      <td style={{padding:"3px 4px",minWidth:100}}>{inp("remarks",88)}</td>
                      {/* Outputs: SheetWt > FinalRate > Rate/SET > MOQ > Rate/kg > CalcGSM > CalcBS > EstBoxWt > AllSpecOK */}
                      <td style={{padding:"3px 6px",textAlign:"center",fontFamily:mono,fontSize:10,color:C.slateL}}>
                        {res?(res.wtSheet*1000).toFixed(0)+"g":"—"}</td>
                      <td style={{padding:"3px 6px",textAlign:"center",fontWeight:800,color:C.amber,fontFamily:mono}}>
                        {res?`₹${res.finalRate.toFixed(2)}`:"—"}
                        {/* Fix 6: flag ₹0 material cost — usually means a paper grade was deleted */}
                        {res&&(res.mat||0)<0.001&&<span title="⚠️ Material cost is ₹0 — check paper grades in Rate Master" style={{fontSize:9,color:C.red,marginLeft:3}}>⚠️0</span>}
                      </td>
                      {/* Issue 5: Rate/SET = finalRate × nosPerSet. Shows SET contribution of this component.
                          Layout: ×N on left (multiplier tag), ₹rate on right (number always right-aligned).
                          When nosPerSet=1, rate renders alone right-aligned — no multiplier shown. */}
                      <td style={{padding:"3px 6px",textAlign:"right",fontWeight:800,
                        color:(+row.nosPerSet||1)>1?"#0F766E":C.amber,fontFamily:mono,
                        background:(+row.nosPerSet||1)>1?"#F0FAFA":undefined,whiteSpace:"nowrap"}}>
                        {(+row.nosPerSet||1)>1
                          ?<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:4}}>
                              <span style={{fontSize:8,fontWeight:500,color:"#0F766E",opacity:0.75,letterSpacing:"0.02em"}}>×{row.nosPerSet}</span>
                              <span>{res?`₹${(res.finalRate*(+row.nosPerSet||1)).toFixed(2)}`:"—"}</span>
                            </div>
                          :<>{res?`₹${(res.finalRate).toFixed(2)}`:"—"}</>}
                      </td>
                      <td style={{padding:"3px 6px",textAlign:"center",fontFamily:mono,fontSize:10}}>
                        {res?res.calcMOQ.toLocaleString():"—"}</td>
                      <td style={{padding:"3px 6px",textAlign:"center",fontFamily:mono,fontSize:10,color:C.slateL}}>
                        {res?`₹${res.ratePerKg.toFixed(2)}`:"—"}</td>
                      <td style={{padding:"3px 6px",textAlign:"center",fontFamily:mono,fontSize:10,color:C.slateM}}>
                        {res?res.calcGSM:"—"}</td>
                      <td style={{padding:"3px 6px",textAlign:"center",fontFamily:mono,fontSize:10,
                        color:comp.some(c=>c.field.includes("Burst"))?(comp.find(c=>c.field.includes("Burst"))?.severity==="high"?C.red:C.orange):C.slateM}}>
                        {res?.calcBS||"—"}</td>
                      <td style={{padding:"3px 6px",textAlign:"center",fontFamily:mono,fontSize:10,color:C.slateM}}>
                        {res?(res.wtSheet*1000*0.98).toFixed(0)+"g":"—"}</td>
                      <td style={{padding:"3px 6px",textAlign:"center",fontSize:12}}>
                        {(()=>{
                          // Fix 10: three distinct states —
                          //   "—"  : no customer specs entered (nothing to check — not "all OK")
                          //   "⚪" : row not yet calculated (cannot assess)
                          //   ✅/⚠️/❌ : result exists AND specs are present
                          const hasSpecs=row.spec_bs||row.spec_bct||row.spec_ect||row.board_gsm||row.reqBoxWt;
                          if(!hasSpecs)return<span title="No customer specs entered — nothing to check" style={{color:C.slateL,fontSize:11}}>—</span>;
                          if(!res)return<span title="Not calculated — run Calculate All first">⚪</span>;
                          const sp2=buildSpecFromRow(autoCalcPPDims(row),constructionLib.find(c=>c.code===row.constructionCode),batchProfile);
                          if(!sp2)return"—";
                          const aC=checkSpecCompliance(sp2,res);
                          const wtOk=(!row.reqBoxWt||!+row.reqBoxWt)||Math.abs(res.wtSheet*1000*0.98-(+row.reqBoxWt))/(+row.reqBoxWt)<=0.015;
                          const noHigh=!aC.some(c=>c.severity==="high");
                          return(wtOk&&noHigh)?"✅":aC.some(c=>c.severity==="high")?"❌":"⚠️";
                        })()}
                      </td>
                      {/* Pinned add-on cells */}
                      {pinnedAddOns.map(k=>(
                        <td key={`pin_${k}`} style={{padding:"3px 4px",textAlign:"center",minWidth:52}}>
                          <input type="number" step="0.25" value={(row.addOns||{})[k]??""}
                            onChange={e=>updC("addOns",{...(row.addOns||{}),[k]:e.target.value===""?"":+e.target.value})}
                            style={{width:44,padding:"2px 4px",border:`1px solid ${(row.addOns||{})[k]?C.amber:C.border}`,
                              borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                              background:(row.addOns||{})[k]?"#FFF8ED":C.white}}/>
                        </td>))}
                      {/* Actions + expand toggle */}
                      <td style={{padding:"3px 4px",textAlign:"center",whiteSpace:"nowrap",minWidth:52}}>
                        <button onClick={()=>toggleRowExpand(row.id)}
                          title={expandedRows.has(row.id)?"Collapse sub-row":"Expand: add-ons, interest, freight, cost breakdown"}
                          style={{background:"none",border:`1px solid ${expandedRows.has(row.id)?C.amber:C.border}`,
                            borderRadius:3,cursor:"pointer",fontSize:11,color:expandedRows.has(row.id)?C.amber:C.slateL,
                            padding:"1px 4px",marginRight:3}}>
                          {expandedRows.has(row.id)?"▴":"▾"}</button>
                        <button onClick={()=>loadBatchRowIntoCosting(row)} title="Deep-dive in Costing"
                          style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.slateL,padding:"0 3px"}}>🔍</button>
                        <button onClick={()=>setBatchRows(prev=>prev.filter(r=>r.id!==row.id))}
                          style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.red,padding:"0 3px"}}>×</button>
                      </td>
                    </tr>
                    {/* ── Expandable sub-row ── */}
                    {expandedRows.has(row.id)&&(()=>{
                      const AO_FIELDS=[
                        ["printing","Printing"],["stitching","Stitching"],["coating","Coating"],["handling","Handling"],
                        ["moqCharge","MOQ Chg"],["packing","Packing"],["other","Other"],["unloading","Unloading"]];
                      const ao=row.addOns||{};
                      const totalCols=31+pinnedAddOns.length; // match main row colspan
                      const isPP=isPPType(row.itemType); // R-2
                      const profInt=batchProfile.interest??0.5;
                      const profFr=batchProfile.freightOverride||freight?.[batchProfile.plant]?.[batchProfile.delivery]||0;
                      const isIntOvr=row.interestOverride!==""&&row.interestOverride!=null;
                      const isFrOvr=row.freightRowOverride!==""&&row.freightRowOverride!=null;
                      const res2=batchResults[row.id];
                      return(
                      <tr style={{background:ri%2?"#F5F0E8":"#F8F5EF"}}>
                        <td colSpan={totalCols} style={{padding:"6px 16px 8px 8px",borderBottom:`2px solid ${C.amber}44`}}>
                          <div style={{display:"flex",gap:24,flexWrap:"wrap",alignItems:"flex-start",justifyContent:"flex-end"}}>
                            {/* ── Glass SKU Type (ALCOBEV Main Box) ── */}
                            {batchProfile.sector==="ALCOBEV"&&row.itemType==="Box"&&(
                              <div style={{minWidth:200}}>
                                <div style={{fontSize:9,color:"#2E6094",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>
                                  🍶 Glass SKU Type</div>
                                <select value={row.glassSKUType||""}
                                  onChange={e=>{
                                    const v=e.target.value;
                                    upd("glassSKUType",v);
                                    // No auto-fill here — propagation happens when Part rows confirm their SET Code
                                  }}
                                  style={{padding:"3px 6px",border:`1px solid ${row.glassSKUType?"#2E6094":C.border}`,
                                    borderRadius:4,fontSize:11,color:C.slate,background:row.glassSKUType?"#EEF4FB":C.white,
                                    width:"100%"}}>
                                  <option value="">— select glass SKU type —</option>
                                  {partitionsMaster.map(x=><option key={x.skuType} value={x.skuType}>{x.skuType}</option>)}
                                </select>
                                {row.glassSKUType&&(()=>{
                                  const pm=partitionsMaster.find(x=>x.skuType===row.glassSKUType);
                                  return pm?<div style={{fontSize:9,color:"#2E6094",marginTop:3}}>
                                    Part-L: {pm.lwise} pcs · Part-W: {pm.wwise} pcs
                                    <span style={{fontSize:8,color:C.slateL,marginLeft:4}}>
                                      (auto-fills Nos/Set on Part rows when their SET Code is confirmed)
                                    </span>
                                  </div>:null;
                                })()}
                              </div>)}
                            {/* ── Glass SKU read-only for Part rows ── */}
                            {batchProfile.sector==="ALCOBEV"&&(row.itemType==="Part-L"||row.itemType==="Part-W")&&(()=>{
                              const parentBox=batchRows.find(r=>
                                r.itemType==="Box"&&!r.setCodeAssumed&&
                                sameSetCode(r.setCode,row.setCode)); // D-7
                              // D-1: same precedence as the auto-fill above.
                              const effGlassSKU=parentBox?.glassSKUType||row.glassSKUType||"";
                              return(
                              <div style={{minWidth:160}}>
                                <div style={{fontSize:9,color:"#2E6094",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>
                                  🍶 Glass SKU Type</div>
                                <div style={{fontSize:11,color:effGlassSKU?"#2E6094":C.slateL,
                                  padding:"3px 8px",border:"1px solid #6A9FD433",borderRadius:4,background:"#EEF4FB"}}>
                                  {effGlassSKU||"— set on Main Box row —"}
                                </div>
                                <div style={{fontSize:9,color:C.slateL,marginTop:2}}>
                                  Nos/Set: <b style={{color:C.amber}}>{row.nosPerSet||1}</b>
                                  {parentBox?.glassSKUType
                                    ?" (inherited from Main Box)"
                                    :effGlassSKU?" (from Costing — Main Box not yet set)":""}
                                </div>
                              </div>);
                            })()}
                            {/* Add-ons grid */}
                            <div>
                              <div style={{fontSize:9,color:C.amber,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>
                                Add-on Costs (Rs/pc)</div>
                              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"4px 10px"}}>
                                {AO_FIELDS.map(([k,lbl])=>(
                                  <div key={k} style={{display:"flex",alignItems:"center",gap:4}}>
                                    <span style={{fontSize:9,color:C.slateL,whiteSpace:"nowrap",minWidth:56}}>{lbl}</span>
                                    <input type="number" step="0.01" value={ao[k]??""}
                                      onChange={e=>updC("addOns",{...ao,[k]:e.target.value===""?"":+e.target.value})}
                                      style={{width:52,padding:"2px 4px",border:`1px solid ${ao[k]?C.amber:C.border}`,
                                        borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                                        background:ao[k]?"#FFF8ED":C.white}}/>
                                    <button onClick={()=>togglePinAddOn(k)}
                                      title={pinnedAddOns.includes(k)?"Unpin from main grid":"Pin to main grid (max 2)"}
                                      style={{background:"none",border:"none",cursor:"pointer",fontSize:12,
                                        color:pinnedAddOns.includes(k)?C.amber:C.slateL,
                                        opacity:(!pinnedAddOns.includes(k)&&pinnedAddOns.length>=2)?0.3:1,
                                        padding:"0 2px"}}>⊕</button>
                                  </div>))}
                              </div>
                            </div>
                            {/* Interest + Freight overrides */}
                            <div>
                              <div style={{fontSize:9,color:C.amber,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>
                                Row Overrides</div>
                              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                                <div style={{display:"flex",alignItems:"center",gap:5}}>
                                  <span style={{fontSize:9,color:C.slateL,minWidth:68}}>Interest%</span>
                                  <input type="number" step="0.25" value={row.interestOverride??""}
                                    placeholder={String(profInt)}
                                    onChange={e=>updC("interestOverride",e.target.value===""?"":+e.target.value)}
                                    title={`Profile default: ${profInt}%${isIntOvr?" | OVERRIDDEN":""}`
                                      +_divTitle(_divergence.interest[0],"Interest%")}
                                    style={{width:52,padding:"2px 4px",border:`1px solid ${isIntOvr?C.amber:C.border}`,
                                      borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                                      background:isIntOvr?"#FFF8ED":C.white,
                                      ..._divStyle(hasDivergence(_divergence.interest))}}/>
                                  {isIntOvr&&<button onClick={()=>updC("interestOverride","")}
                                    style={{background:"none",border:"none",color:C.slateL,cursor:"pointer",fontSize:10}}>✕</button>}
                                </div>
                                <div style={{display:"flex",alignItems:"center",gap:5}}>
                                  <span style={{fontSize:9,color:C.slateL,minWidth:68}}>Freight Rs/kg</span>
                                  <input type="number" step="0.25" value={row.freightRowOverride??""}
                                    placeholder={String(profFr)}
                                    onChange={e=>updC("freightRowOverride",e.target.value===""?"":+e.target.value)}
                                    title={`Profile freight: ${profFr}${isFrOvr?" | OVERRIDDEN":""}`
                                      +_divTitle(_divergence.freight[0],"Freight Rs/kg")}
                                    style={{width:52,padding:"2px 4px",border:`1px solid ${isFrOvr?C.amber:C.border}`,
                                      borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                                      background:isFrOvr?"#FFF8ED":C.white,
                                      ..._divStyle(hasDivergence(_divergence.freight))}}/>
                                  {isFrOvr&&<button onClick={()=>updC("freightRowOverride","")}
                                    style={{background:"none",border:"none",color:C.slateL,cursor:"pointer",fontSize:10}}>✕</button>}
                                </div>
                              </div>
                            </div>
                            {/* Cost build-up */}
                            {res2&&(()=>{
                              const tot=res2.total||0;
                              const wt=res2.wtSheet||1; // Sheet weight for /kg calc
                              const items2=[
                                ["Mat",res2.mat],["Conv",res2.conv],["Add-ons",res2.addOns],
                                ["Int",res2.intC],["Freight",res2.fr],["Margin",res2.marginAmt]];
                              return(
                              <div>
                                <div style={{fontSize:9,color:C.amber,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>
                                  Cost Build-up</div>
                                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                                  {items2.map(([lbl,v])=>(
                                    <div key={lbl} style={{textAlign:"center",minWidth:42}}>
                                      <div style={{fontSize:8,color:C.slateL,marginBottom:1}}>{lbl}</div>
                                      <div style={{fontSize:11,fontWeight:700,fontFamily:mono,color:C.slateM}}>
                                        ₹{((v||0)/wt).toFixed(2)}<span style={{fontSize:8,fontWeight:400}}>/kg</span></div>
                                      <div style={{fontSize:8,color:C.slateL}}>{tot>0?((v||0)/tot*100).toFixed(0):0}%</div>
                                      <div style={{fontSize:8,color:C.slateL,opacity:0.6}}>₹{(v||0).toFixed(3)}/pc</div>
                                    </div>))}
                                  <div style={{borderLeft:`1px solid ${C.amber}`,paddingLeft:10,textAlign:"center"}}>
                                    <div style={{fontSize:8,color:C.amber,marginBottom:1}}>FINAL</div>
                                    <div style={{fontSize:13,fontWeight:800,fontFamily:mono,color:C.amber}}>
                                      ₹{res2.ratePerKg?.toFixed(2)}<span style={{fontSize:9,fontWeight:400}}>/kg</span></div>
                                    <div style={{fontSize:10,fontWeight:600,fontFamily:mono,color:C.amberD}}>
                                      ₹{res2.finalRate?.toFixed(2)}<span style={{fontSize:8,fontWeight:400}}>/pc</span></div>
                                  </div>
                                </div>
                              </div>);
                            })()}
                          </div>
                        </td>
                      </tr>);
                    })()}
                  </Fragment>);
                })}
              </tbody>
            </table>
          </div>}
      </div>
    </div>
  );
}
