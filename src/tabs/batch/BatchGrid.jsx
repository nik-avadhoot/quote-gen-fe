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
import { BOX_TYPES, PRINTING_TECHNOLOGIES } from "../../data/defaults.js";
import { buildSpecFromRow, checkSpecCompliance } from "../../engine/costing.js";
import { resolveBatchCommercialDefaults } from "../../engine/resolveAuthority.js";
import { isPPType, sameSetCode } from "../../engine/rowType.js";
import { findDivergence, isDiverged } from "../../lib/overrideDivergence.js";
import { isUsableConstruction } from "../../lib/constructionIdentity.js";
import { Btn } from "../../ui/primitives.jsx";
import { compactGridRowSt } from "../../ui/styles.js";
import { STATUS_DISPLAY, constrAutoName } from "../../lib/constructionName.js";
import { canPinAddOn, MAX_PINNED_ADD_ONS } from "../../lib/pinnedAddOns.js";
import { batchDeliveryGridEntries, deliverySectionItemCount } from "../../lib/batchDeliverySections.js";
import { durableRowToLocalPreview } from "../../lib/batchRowModel.js";
import { C, T, mono, sans } from "../../theme.js";
import { useAppState } from "../../state/AppStateContext.js";

const BASE_GRID_COLUMN_COUNT=37;

function DeliverySectionHeader({ section, colSpan, onManage, onWorkspace }) {
  const itemCount = deliverySectionItemCount(section);
  const pricingLabel = section.pricingGroup?.label
    || (section.pricingGroup?.id == null ? "No Pricing Group" : `Pricing Group #${section.pricingGroup.id}`);
  return <tr className={`batch-grid-delivery-header is-${section.status}`}>
    <td colSpan={colSpan}>
      <div className="batch-grid-delivery-line">
        <span className="batch-grid-delivery-kicker">Delivery Group</span>
        <strong>{section.label}</strong>
        <span className="batch-grid-delivery-path">{section.detail}</span>
        <span className="batch-grid-delivery-pricing">{pricingLabel}</span>
        <span className="batch-grid-delivery-count">{itemCount} item{itemCount === 1 ? "" : "s"}</span>
        {section.isFreightBasis && <b>Freight basis</b>}
        <span className="batch-grid-delivery-actions">
          {section.pricingGroup && <button type="button" onClick={() => onWorkspace("row-create", section)}>
            + Item
          </button>}
          <button type="button" onClick={() => onWorkspace("set-manage", section)}>SETs</button>
          {section.route && <button type="button" onClick={() => onManage("edit", section)}>Edit</button>}
          <button type="button" onClick={() => onManage(section.pricingGroup ? "create" : "manage", section)}>
            {section.pricingGroup ? "+ Delivery Group" : "Manage Delivery Groups"}
          </button>
        </span>
      </div>
    </td>
  </tr>;
}

export default function BatchGrid({ focusMode = false, onToggleFocusMode }){
  const {activeBatchRowId,addBatchRow,autoCalcPPDims,autoCodeEnabled,autoCodeSeq,
    batchProfile,batchResults,batchRows,calculateAll,constructionLib,copyCostingToProfile,durableBatch,expandedRows,freight,
    generateCode,generateMissingCodes,getBatchRowStatus,invalidateAllBatchResults,
    invalidateBatchRow,loadBatchRowIntoCosting,partitionsMaster,pinnedAddOns,sectors,
    sendAllToQuoteItems,setAutoCodeEnabled,setBatchConstrOverlay,
    setBatchConstrOverlayFilter,setBatchConstrOverlayQuery,setBatchConstrTargetRowId,
    setBatchProfile,setBatchRows,setBatchWorkspaceRequest,showToast,startNewBatch,togglePinAddOn,toggleRowExpand}=useAppState();
  // D-26: the SET Code value as it stood when the input took focus, so blur can
  // tell an edit from a tab-through and only re-resolve Nos/Set on a real change.
  //
  // Declared HERE, at the top level of the component — NOT inside the row .map()
  // where it is used. Hooks in a .map() break the Rules of Hooks and have caused
  // blank-screen crashes in this file before (see CLAUDE.md). One ref serves every
  // row because only one input holds focus at a time.
  const _setCodeAtFocus=useRef("");
  const _profileDefaults=useMemo(()=>resolveBatchCommercialDefaults(batchProfile,
    sectors.find(sector=>sector.code===batchProfile.sector)),[batchProfile,sectors]);

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
    // Every entry carries its group's BASELINE so findDivergence can name the odd
    // ones out rather than the whole group — a row still on the baseline was not
    // changed by anyone and must not be marked.
    const build=(baseOf,valOf)=>findDivergence(batchRows.map((r,i)=>{
      const base=baseOf(r);
      return {label:String(i+1),group:isPP(r)?"PP":"Box",baseline:base,value:valOf(r,base)};
    }));
    // WAVE 3 removed buildQuote and profFreight with the two quote-level
    // entries below. Divergence exists to warn that the workbook holds ONE slot
    // per group while rows disagree - and rows can no longer disagree about
    // Freight or Interest, because there is one Batch value and no row override.
    // Waste and Conv keep theirs: those ARE still per-row.
    return {
      // Box/PP-pair level — the effective value is the override, else the profile default
      waste:build(r=>isPP(r)?_profileDefaults.wastePP:_profileDefaults.waste,
                  (r,b)=>set(r,"wasteConv_waste")?r.wasteConv_waste:b),
      conv: build(r=>isPP(r)?_profileDefaults.convRatePP:_profileDefaults.convRate,
                  (r,b)=>set(r,"wasteConv_conv")?r.wasteConv_conv:b),
    };
  },[batchRows,_profileDefaults]);
  const _deliveryGridEntries=useMemo(
    ()=>batchDeliveryGridEntries(durableBatch,batchRows),[durableBatch,batchRows]);
  const openDeliveryManager=(mode,section)=>{
    if(!durableBatch?.id){
      showToast("⚠️ Start or open a governed Batch before adding Delivery Groups.","info",6000);
      return;
    }
    setBatchWorkspaceRequest({requestId:Date.now(),batchId:durableBatch.id,mode,
      pricingGroupId:section.pricingGroup?.id??null,
      deliveryGroupId:mode==="edit"?section.route?.id??null:null});
  };
  const openWorkspaceAction=(mode,section,detail={})=>{
    if(!durableBatch?.id){
      showToast("⚠️ Start or open a governed Batch before managing durable rows or SETs.","info",6000);
      return;
    }
    setBatchWorkspaceRequest({requestId:Date.now(),batchId:durableBatch.id,mode,
      pricingGroupId:section.pricingGroup?.id??null,...detail});
  };
  const copyDurableToGrid=durableRow=>{
    const existing=batchRows.find(item=>String(item.durableRowId)===String(durableRow.id));
    const preview=durableRowToLocalPreview(durableRow,existing?.id||`local-durable-${durableRow.id}`);
    setBatchRows(current=>existing
      ?current.map(item=>item.id===existing.id?preview:item)
      :[...current,preview]);
    if(existing) invalidateBatchRow(existing.id);
    setBatchProfile(current=>({
      ...current,
      client:durableRow.customer?.display_name||current.client,
      plant:durableBatch?.plant?.name||durableBatch?.plant?.plant_code||current.plant,
      sector:durableBatch?.sector?.sector_code||current.sector,
    }));
    showToast("Loaded exact governed row inputs into the local preview grid. No calculation was persisted.",
      "success",6500);
  };
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
          alignItems:"center",flexWrap:"nowrap",background:C.cream,flexShrink:0}}>
          <Btn ch="⚡ Calculate All" v="primary" sm onClick={calculateAll}
            disabled={batchRows.length===0||constructionLib.length===0}
            style={{whiteSpace:"nowrap",flexShrink:0}}/>
          <Btn ch="→ Send All to Quote Items" v="success" sm onClick={sendAllToQuoteItems}
            disabled={Object.keys(batchResults).length===0}
            style={{whiteSpace:"nowrap",flexShrink:0}}/>
          <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
            {/* Profile actions, moved here from the Batch Profile bar. Same handlers. */}
            <button type="button" onClick={copyCostingToProfile}
              title="Import the current Costing profile"
              style={{padding:"4px 9px",borderRadius:5,border:"none",background:"#2E6094",
                color:C.white,fontSize:T.label,cursor:"pointer",fontWeight:700,whiteSpace:"nowrap"}}>
              ↓ Import profile
            </button>
            <button type="button" onClick={startNewBatch}
              title="Start a new Batch"
              style={{padding:"4px 9px",borderRadius:5,border:`1px solid ${C.amber}`,background:C.white,
                color:C.amberD,fontSize:T.label,cursor:"pointer",fontWeight:700,whiteSpace:"nowrap"}}>
              + New batch
            </button>
            <button type="button" aria-pressed={focusMode} onClick={onToggleFocusMode}
              style={{padding:"4px 9px",borderRadius:5,border:`1px solid ${focusMode?C.green:C.border}`,
                background:focusMode?C.greenL:C.white,color:focusMode?C.green:C.slateM,
                fontSize:T.label,cursor:"pointer",fontWeight:700,whiteSpace:"nowrap"}}>
              {focusMode?"Exit focus":"Focus mode"}
            </button>
            <details style={{position:"relative",flexShrink:0}}>
              <summary style={{padding:"4px 9px",borderRadius:5,border:`1px solid ${C.border}`,
                background:C.white,color:C.slateM,fontSize:T.label,cursor:"pointer",fontWeight:700,
                whiteSpace:"nowrap",listStyle:"none"}}>Code tools ▾</summary>
              <div style={{position:"absolute",right:0,top:"calc(100% + 6px)",zIndex:20,
                width:230,padding:9,border:`1px solid ${C.border}`,borderRadius:7,
                background:C.white,boxShadow:"0 8px 22px rgba(28,43,58,.18)",
                display:"grid",gap:7}}>
                <label style={{display:"flex",alignItems:"center",gap:5,fontSize:T.body,color:C.slateM,cursor:"pointer"}}>
                  <input type="checkbox" checked={autoCodeEnabled} onChange={e=>setAutoCodeEnabled(e.target.checked)}
                    style={{accentColor:C.amber}}/>
                  Auto-code new rows
                </label>
                {autoCodeEnabled&&<button onClick={generateMissingCodes}
                  style={{padding:"4px 9px",borderRadius:5,border:`1px solid ${C.amber}`,
                    background:C.amberL,color:C.amberD,fontSize:T.body,cursor:"pointer",fontWeight:600}}>
                  ↯ Generate Missing Codes</button>}
                <span style={{fontSize:T.label,color:C.slateL}}>Next format: {generateCode(autoCodeSeq)}</span>
              </div>
            </details>
          </div>
          <button onClick={()=>{setBatchConstrOverlay(true);setBatchConstrTargetRowId(null);setBatchConstrOverlayQuery('');setBatchConstrOverlayFilter({sector:'',client:'',});}}
            style={{padding:"3px 10px",borderRadius:5,border:`1px solid ${C.amber}`,
              background:C.amberL,color:C.amberD,fontSize:11,cursor:"pointer",fontWeight:700,
              whiteSpace:"nowrap",flexShrink:0}}>
            📚 Construction Library ({constructionLib.filter(c=>(c.status||'active')==='active').length} active)
          </button>
          <div style={{borderLeft:`1px solid ${C.border}`,paddingLeft:8,display:"flex",gap:6,flexShrink:0}}>
            {["Box","Plate","Part-L","Part-W"].map(t=>(
              <button key={t} onClick={()=>addBatchRow(t)}
                style={{padding:"3px 9px",borderRadius:5,border:`1px solid ${C.border}`,
                  background:C.white,color:C.slateM,fontSize:11,cursor:"pointer",fontWeight:600,
                  whiteSpace:"nowrap",flexShrink:0}}>
                 + {t}</button>))}
          </div>
        </div>

        {/* The grid */}
        {_deliveryGridEntries.length===0
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
                    const CENTER_COLS=["L","W","H","Ups","Colours","Print Tech","Nos/Set","Std GSM","Std BS","Std BCT","Std ECT","Std Cobb","Std Box Wt","Sales MOQ","Vol/mo","Waste%","Conv Rs/kg","Margin%","Sheet Wt","Rate/SET (₹)","MOQ","Rate/kg (₹)","Calc GSM","Calc BS","Est Box Wt"];
                    return ["St","#","Mat Code","SKU / Product","SET Role","SET Code","Nos/Set","Box Type","Paper Construction","L","W","H","Ups",
                      "Colours","Print Tech","Std GSM","Std BS","Std BCT","Std ECT","Std Cobb","Std Box Wt",
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
                      {AO_LABELS[k]||k}<br/><span style={{fontSize:8,fontWeight:400,opacity:0.7}}>Rs/pc 📌</span></th>;})}
                  <th style={{padding:"6px 4px",color:C.white,fontSize:9,minWidth:52,textAlign:"center"}}>▾ more</th>
                </tr>
              </thead>
              <tbody>
                {_deliveryGridEntries.map(entry=>{
                  const {row,durableRow,section,startsSection}=entry;
                  const sectionHeader=startsSection
                    ?<DeliverySectionHeader section={section} colSpan={BASE_GRID_COLUMN_COUNT+pinnedAddOns.length}
                        onManage={openDeliveryManager} onWorkspace={openWorkspaceAction}/>:null;
                  if(!row){
                    const durableLabel=durableRow
                      ?durableRow.material_code||durableRow.sku?.plant_item_code||`SKU #${durableRow.sku_id}`
                      :"No item rows assigned";
                    return <Fragment key={`${section.key}:durable:${durableRow?.id||"empty"}`}>
                      {sectionHeader}
                      <tr className="batch-grid-durable-placeholder">
                        <td colSpan={BASE_GRID_COLUMN_COUNT+pinnedAddOns.length}>
                          <div className="batch-grid-durable-placeholder-line">
                            <strong>{durableLabel}</strong>
                            <span>{durableRow
                              ?`Durable row #${durableRow.id} is relevant to this route but is not loaded in the working grid.`
                              :"This Pricing Group has no relevant item rows yet."}</span>
                            {durableRow&&<button type="button" onClick={()=>copyDurableToGrid(durableRow)}
                              title="Create a local preview copy. The governed row and calculation remain unchanged.">
                              Load into grid
                            </button>}
                          </div>
                        </td>
                      </tr>
                    </Fragment>;
                  }
                  const ri=Math.max(0,batchRows.findIndex(item=>item.id===row.id));
                  const res=batchResults[row.id];
                  const governedRow=row.durableRowId==null?null:(durableBatch?.batch_rows||[]).find(item=>
                    String(item.id)===String(row.durableRowId));
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
                  const isAssumed=!!row.setCodeAssumed;
                  const isNonBox=row.itemType!=="Box";
                  // D-26: THE RESOLUTION, LIFTED OUT OF THE CONTROL. One plain
                  // per-row function serves both the expanded-row Confirm action
                  // and SET Code blur. It is deliberately not a hook.
                  const applyGlassSKUNos=()=>{
                    // Glass SKU auto-fill for ALCOBEV Part-L / Part-W rows
                    if(batchProfile.sector==="ALCOBEV"&&(row.itemType==="Part-L"||row.itemType==="Part-W")){
                      const confirmedSetCode=(row.setCode||"").trim();
                      const parentBox=batchRows.find(r=>
                        r.itemType==="Box"&&!r.setCodeAssumed&&sameSetCode(r.setCode,confirmedSetCode)); // D-7
                      // D-1: parent wins, this row is the fallback. Parts can be
                      // sent from Costing before the Box exists, and an assumed
                      // parent remains excluded from the resolution predicate.
                      const effGlassSKU=parentBox?.glassSKUType||row.glassSKUType||"";
                      if(effGlassSKU){
                        const pm=partitionsMaster.find(x=>x.skuType===effGlassSKU);
                        if(pm){
                          const nos=row.itemType==="Part-L"?pm.lwise:pm.wwise;
                          updC("nosPerSet",nos);
                          showToast(`🍶 Nos/Set auto-filled: ${nos} (${effGlassSKU})`,'success',3000);
                        }
                      }else if(parentBox&&!parentBox.glassSKUType){
                        showToast("⚠️ Glass SKU Type not yet set on the parent Box — set it first to auto-fill Nos/Set",'info',5000);
                      }
                    }
                  };
                  const handleConfirm=()=>{
                    upd("setCodeAssumed",false);
                    applyGlassSKUNos();
                  };
                  const handleClear=()=>{
                    upd("setCode","");
                    upd("setCodeAssumed",false);
                    invalidateAllBatchResults();
                  };
                  const dimRow=autoCalcPPDims(row);
                  const comp=res&&buildSpecFromRow(dimRow,constructionLib.find(c=>c.code===row.constructionCode),batchProfile)
                    ?checkSpecCompliance(buildSpecFromRow(dimRow,constructionLib.find(c=>c.code===row.constructionCode),batchProfile),res):[];
                  return(<Fragment key={`${section.key}:row:${row.id}`}>
                    {sectionHeader}
                    <tr style={{...compactGridRowSt,background:isActive?"#EEF4FB":ri%2?C.cream:C.white,
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
                        <div style={{position:"relative",display:"inline-block"}}>
                          <input type="checkbox" checked={!!row.setAutoFill}
                            onChange={e=>{
                              const on=e.target.checked;
                              upd("setAutoFill",on);
                              if(!on){
                                upd("setCode","");
                                upd("setCodeAssumed",false);
                                invalidateAllBatchResults();
                              }else if((row.itemType||"Box")==="Box"){
                                upd("setCode",row.matCode||"");
                                invalidateAllBatchResults();
                              }else{
                                const ri2=batchRows.findIndex(r=>r.id===row.id);
                                const parentBox=[...batchRows.slice(0,ri2)].reverse().find(r=>r.itemType==="Box"&&r.matCode&&!r.setCodeAssumed);
                                if(parentBox){upd("setCode",parentBox.setCode||parentBox.matCode||"");upd("setCodeAssumed",true);invalidateAllBatchResults();}
                              }
                            }}
                            style={{position:"absolute",left:3,top:"50%",transform:"translateY(-50%)",
                              accentColor:"#9A7B4A",cursor:"pointer",width:10,height:10,zIndex:1}}/>
                          <input value={row.setCode||""} placeholder="SET code"
                            // D-26: resolve on BLUR, not onChange — onChange fires per keystroke
                            // and would resolve against half-typed codes.
                            // ⚠️ ONLY when the code actually CHANGED during this focus.
                            onFocus={e=>{_setCodeAtFocus.current=e.target.value;}}
                            onBlur={e=>{if(e.target.value!==_setCodeAtFocus.current)applyGlassSKUNos();}}
                            onChange={e=>{
                              // SET Code is cross-row; changing it can alter another
                              // row's auto-derived dimensions, so invalidate all.
                              upd("setCode",e.target.value);
                              invalidateAllBatchResults();
                              if(isAssumed)upd("setCodeAssumed",false);
                            }}
                            style={{width:76,padding:"2px 14px 2px 18px",
                              border:`1px solid ${isAssumed?"#E8830A":C.border}`,
                              borderRadius:3,fontSize:10,fontFamily:mono,
                              background:isAssumed?"#FFF8ED":C.white}}/>
                          {isAssumed&&isNonBox&&<span aria-label="SET Code is assumed; expand this row to confirm or clear it"
                            title="Assumed SET Code — expand this row to confirm or clear"
                            style={{position:"absolute",right:4,top:"50%",transform:"translateY(-50%)",
                              width:10,height:10,borderRadius:"50%",background:C.amber,color:C.white,
                              fontSize:7,fontWeight:800,lineHeight:"10px",textAlign:"center"}}>!</span>}
                        </div>
                      </td>
                      {/* Nos/Set — Glass-SKU detail stays in the expanded row */}
                      <td style={{padding:"3px 4px",textAlign:"center",minWidth:50}}>
                        {inpC("nosPerSet",40,"number")}
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
                          const constructionUsable=!!ce&&isUsableConstruction(ce);
                          return(
                          <button
                            onClick={()=>{
                              setBatchConstrOverlay(true);
                              setBatchConstrTargetRowId(row.id);
                              setBatchConstrOverlayQuery('');
                              setBatchConstrOverlayFilter({sector:'',client:''});
                            }}
                            title={constructionUsable?`[${ce.code}] ${autoN} — click to change`
                              :ce?`[${ce.code}] is incomplete — select a construction with grade/BF and GSM for every required layer`
                              :"Click to select a construction"}
                            style={{width:156,padding:"3px 6px",
                              border:`1px solid ${constructionUsable?C.border:C.red}`,
                              borderRadius:3,fontSize:9,textAlign:"left",cursor:"pointer",
                              background:constructionUsable?C.white:"#FFF5F5",
                              color:constructionUsable?C.slateM:C.red,
                              fontFamily:mono,display:"flex",alignItems:"center",gap:4}}>
                            {constructionUsable
                              ?<><span style={{color:C.amber,fontWeight:800}}>{row.constructionCode}</span>
                                <span style={{fontSize:8,color:C.slateL,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>
                                  {autoN.substring(0,22)}{autoN.length>22?"…":""}</span></>
                              :<span style={{fontSize:9}}>{ce?`⚠ ${ce.code} incomplete`:"— pick construction 📚"}</span>}
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
                      {/* Descriptive SKU printing specification — row-owned and
                          intentionally non-calculation-driving. Placement is fixed
                          after Ups and before the standard output specifications. */}
                      <td style={{padding:"3px 4px",textAlign:"center",minWidth:54}}>
                        <input type="number" min="0" step="1" value={row.number_of_colours??""}
                          aria-label="Number of colours"
                          onChange={e=>{
                            const raw=e.target.value;
                            if(raw===""){upd("number_of_colours","");return;}
                            if(/^\d+$/.test(raw))upd("number_of_colours",+raw);
                          }}
                          style={{width:44,padding:"2px 4px",border:`1px solid ${C.border}`,
                            borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono}}/>
                      </td>
                      <td style={{padding:"3px 4px",textAlign:"center",minWidth:72}}>
                        <select value={row.printing_technology??""}
                          aria-label="Print technology"
                          onChange={e=>upd("printing_technology",e.target.value)}
                          style={{width:68,padding:"2px 3px",border:`1px solid ${C.border}`,
                            borderRadius:3,fontSize:9,background:C.white,color:C.slate}}>
                          <option value="">—</option>
                          {PRINTING_TECHNOLOGIES.map(technology=><option key={technology} value={technology}>{technology}</option>)}
                        </select>
                      </td>
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
                          const profVal=isPP?_profileDefaults.wastePP:_profileDefaults.waste;
                          const isOvr=row.wasteConv_waste!==""&&row.wasteConv_waste!=null;
                          return<input type="number" step="0.25" value={row.wasteConv_waste??""}
                            placeholder={String(profVal)}
                            onChange={e=>updC("wasteConv_waste",e.target.value===""?"":+e.target.value)}
                            title={`${isPP?"PP":"Box"} Waste% — profile default: ${profVal}%${isOvr?" | OVERRIDDEN":""}`
                              +_divTitle(_divergence.waste.find(d=>d.group===(isPP?"PP":"Box")),"Waste%")}
                            style={{width:44,padding:"2px 4px",border:`1px solid ${isOvr?C.amber:C.border}`,
                              borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                              background:isOvr?"#FFF8ED":C.white,
                              ..._divStyle(isDiverged(_divergence.waste,isPP?"PP":"Box",
                                isOvr?row.wasteConv_waste:profVal,profVal))}}/>;
                        })()}
                      </td>
                      {/* Conv Rs/kg override */}
                      <td style={{padding:"3px 4px",textAlign:"center",minWidth:58}}>
                        {(()=>{
                          const isPP=isPPType(row.itemType); // R-2
                          const profVal=isPP?_profileDefaults.convRatePP:_profileDefaults.convRate;
                          const isOvr=row.wasteConv_conv!==""&&row.wasteConv_conv!=null;
                          return<input type="number" step="0.25" value={row.wasteConv_conv??""}
                            placeholder={String(profVal)}
                            onChange={e=>updC("wasteConv_conv",e.target.value===""?"":+e.target.value)}
                            title={`${isPP?"PP":"Box"} Conv Rs/kg — profile default: ${profVal}${isOvr?" | OVERRIDDEN":""}`
                              +_divTitle(_divergence.conv.find(d=>d.group===(isPP?"PP":"Box")),"Conv Rs/kg")}
                            style={{width:50,padding:"2px 4px",border:`1px solid ${isOvr?C.amber:C.border}`,
                              borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                              background:isOvr?"#FFF8ED":C.white,
                              ..._divStyle(isDiverged(_divergence.conv,isPP?"PP":"Box",
                                isOvr?row.wasteConv_conv:profVal,profVal))}}/>;
                        })()}
                      </td>
                      {/* Margin% */}
                      <td style={{padding:"3px 4px",textAlign:"center",minWidth:58}}>
                        <input type="number" step="0.25" value={row.marginOverride??""}
                          placeholder={String(
                            (row.itemType==="Plate"||row.itemType==="Part-L"||row.itemType==="Part-W")
                              ?_profileDefaults.marginPP
                              :_profileDefaults.margin
                          )}
                          onChange={e=>updC("marginOverride",e.target.value===""?"":+e.target.value)}
                          title={row.marginOverride!=null&&row.marginOverride!==""?"Row override":`Inherits: ${(row.itemType==="Plate"||row.itemType==="Part-L"||row.itemType==="Part-W")?_profileDefaults.marginPP:_profileDefaults.margin}% from Batch/Sector defaults`}
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
                        {governedRow&&<button type="button"
                          onClick={()=>openWorkspaceAction("row-edit",section,{rowId:governedRow.id})}
                          title={`Edit governed row #${governedRow.id}`}
                          style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:C.amber,padding:"0 3px",fontWeight:800}}>G</button>}
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
                      const totalCols=BASE_GRID_COLUMN_COUNT+pinnedAddOns.length;
                      const profInt=batchProfile.interest??0.5;
                      const profFr=batchProfile.freightOverride||freight?.[batchProfile.plant]?.[batchProfile.delivery]||0;
                      const res2=batchResults[row.id];
                      return(
                      <tr style={{background:ri%2?"#F5F0E8":"#F8F5EF"}}>
                        <td colSpan={totalCols} style={{padding:"6px 16px 8px 8px",borderBottom:`2px solid ${C.amber}44`}}>
                          {governedRow&&<div className="batch-grid-governed-row-actions">
                            <span>Governed row #{governedRow.id} · v{governedRow.content_version} · {governedRow.status}</span>
                            <button type="button" onClick={()=>openWorkspaceAction("row-edit",section,{rowId:governedRow.id})}>
                              Edit governed row
                            </button>
                            <button type="button" onClick={()=>openWorkspaceAction("row-status",section,{
                              rowId:governedRow.id,rowStatus:governedRow.status==="active"?"removed":"active"})}>
                              {governedRow.status==="active"?"Remove governed row":"Restore governed row"}
                            </button>
                            <button type="button" onClick={()=>openWorkspaceAction("set-manage",section,{rowId:governedRow.id})}>
                              SET membership
                            </button>
                          </div>}
                          <div style={{display:"flex",gap:24,flexWrap:"wrap",alignItems:"flex-start",justifyContent:"flex-end"}}>
                            {/* Conditional SET confirmation belongs here so the compact
                                row remains a constant height. The handlers and the
                                parent-resolution chain are unchanged. */}
                            {isAssumed&&isNonBox&&(
                              <div style={{minWidth:190}}>
                                <div style={{fontSize:T.label,color:C.amberD,fontWeight:700,
                                  textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>
                                  ⚠ Assumed SET Code</div>
                                <div style={{display:"flex",alignItems:"center",gap:5}}>
                                  <span style={{padding:"3px 7px",border:`1px solid ${C.amber}`,
                                    borderRadius:4,background:C.amberL,color:C.amberD,
                                    fontFamily:mono,fontSize:T.body,fontWeight:700}}>{row.setCode||"—"}</span>
                                  <button onClick={handleConfirm}
                                    style={{padding:"3px 7px",border:`1px solid ${C.green}`,
                                      borderRadius:4,background:C.greenL,color:C.green,
                                      fontSize:T.label,fontWeight:700,cursor:"pointer"}}>Confirm</button>
                                  <button onClick={handleClear}
                                    style={{padding:"3px 7px",border:`1px solid ${C.red}55`,
                                      borderRadius:4,background:C.redL,color:C.red,
                                      fontSize:T.label,cursor:"pointer"}}>Clear</button>
                                </div>
                              </div>)}
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
                                    {(()=>{
                                      const isPinned=pinnedAddOns.includes(k);
                                      const canPin=canPinAddOn(pinnedAddOns,k);
                                      const title=isPinned
                                        ?"Unpin from main grid"
                                        :canPin
                                          ?`Pin to main grid (max ${MAX_PINNED_ADD_ONS})`
                                          :`Two add-ons are already pinned. Unpin one before pinning ${lbl}.`;
                                      return <button type="button" onClick={()=>togglePinAddOn(k)}
                                        disabled={!canPin} aria-pressed={isPinned}
                                        aria-label={isPinned?`Unpin ${lbl} from main grid`:`Pin ${lbl} to main grid`}
                                        title={title}
                                        style={{background:"none",border:"none",cursor:canPin?"pointer":"not-allowed",fontSize:12,
                                          color:isPinned?C.amber:C.slateL,
                                          opacity:canPin?1:0.3,
                                          padding:"0 2px"}}>{isPinned?"📌✓":"📌"}</button>;
                                    })()}
                                  </div>))}
                              </div>
                            </div>
                            {/* WAVE 3 · FREIGHT AND INTEREST ARE BATCH-LEVEL ONLY.
                                The two row-override editors stood here. They are
                                gone, not hidden: no input, no handler, and nothing
                                in this file writes either key. What remains is a
                                read-only statement of the figures this row is
                                actually costed at, so the Maker can still see them
                                without hunting for the Batch Profile bar. Same
                                shape as Costing's own preview after C7a. */}
                            <div>
                              <div style={{fontSize:9,color:C.slateL,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>
                                From Batch Profile</div>
                              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                                <div style={{display:"flex",alignItems:"center",gap:5}}>
                                  <span style={{fontSize:9,color:C.slateL,minWidth:68}}>Interest%</span>
                                  <span title="Batch-level. Edit it in the Batch Profile bar above."
                                    style={{width:52,padding:"2px 4px",border:`1px solid ${C.border}`,
                                      borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                                      background:"#EFEFEF",color:C.slateL,boxSizing:"border-box"}}>{profInt}</span>
                                </div>
                                <div style={{display:"flex",alignItems:"center",gap:5}}>
                                  <span style={{fontSize:9,color:C.slateL,minWidth:68}}>Freight Rs/kg</span>
                                  <span title="Batch-level: the profile figure, else the plant × location matrix. Edit it in the Batch Profile bar above."
                                    style={{width:52,padding:"2px 4px",border:`1px solid ${C.border}`,
                                      borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                                      background:"#EFEFEF",color:C.slateL,boxSizing:"border-box"}}>{profFr}</span>
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
