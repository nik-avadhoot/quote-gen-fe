import { Fragment } from "react";

import UserManagementTab from "./UserManagementTab.jsx";
import ChangePasswordModal from "./ChangePasswordModal.jsx";
import ProfileModal from "./ProfileModal.jsx";
import AccountMenu from "./AccountMenu.jsx";

// ── Engine & Data ─────────────────────────────────────────────────────────
import { CREDIT_PCT, PLANTS, BOX_TYPES, DEFAULT_BOX_TRIM_DATA, INIT_SPEC } from "./data/defaults.js";
import { buildSpecFromRow, checkSpecCompliance } from "./engine/costing.js";
import { isPPType } from "./engine/rowType.js";

// ── Export modules (Phase 3 refactor) ─────────────────────────────────────
import { exportFromTemplate } from "./export/excel.js";
import { exportAllPDF } from "./export/pdf.js";

// ── Presentation (Phase 3 refactor) ───────────────────────────────────────
import { Inp, Sel, Btn, SH, KN } from "./ui/primitives.jsx";
import { inputSt } from "./ui/styles.js";
import BoxDieline from "./components/BoxDieline.jsx";
import { C, mono, sans } from "./theme.js";

// ── State layer (Phase 4 refactor) ────────────────────────────────────────
import { AppStateProvider } from "./state/AppStateProvider.jsx";
import { useAppState } from "./state/AppStateContext.js";

/* ═══ MAIN APP ═════════════════════════════════════════════════════════════ */

// App is a thin shell: it mounts the store, then renders the tab chrome.
// All state and every handler live in src/state/ - see AppStateProvider.jsx
// for the composition order and what forces it.
export default function App(){
  return (
    <AppStateProvider>
      <QuotationApp/>
    </AppStateProvider>
  );
}

// The destructure below is deliberately exhaustive and flat. Keeping it in one
// place means the JSX beneath is byte-identical to the pre-Phase-4 monolith,
// so this commit's diff is "state moved out, one destructure added" - nothing
// else. Tabs extracted in later phases call useAppState() directly instead.
function QuotationApp(){
  const st = useAppState();
  const {
    _convDefBox, _convDefPP, _sendReady, _wasteDefBox, _wasteDefPP, activeBatchRowId,
    addBatchRow, aiNotes, autoCalcPPDims, autoCodeEnabled, autoCodeSeq, autosaveBanner,
    batchConstrOverlay, batchConstrOverlayFilter, batchConstrOverlayQuery,
    batchConstrTargetRowId, batchProfile, batchResults, batchRows, blanketDisc,
    blanketInterest, boxTrim, calculateAll, card, clTabExpandedConstr, clTabFilter,
    clTabQuery, compliance, constructionLib, costingContext, effectiveFrom, effectiveTo,
    expandedRows, freight, freightBands, generateCode, generateMissingCodes,
    getBatchRowStatus, gradeCodes, gyPremHigh, gyPremLow, handleBackup, handleRestore,
    handleRestoreFile, handleTemplateLoad, importConstrFromSpec, invalidateAllBatchResults,
    invalidateBatchRow, items, loadBatchRowIntoCosting, loadItem, locations, makerName,
    marginSugg, missing, newGrade, newLocation, newSector, osSaving, partitionsMaster,
    pinnedAddOns, pushCostingToBatchRow, quoteDate, quoteRef, r, rateUpdatedAt, rates,
    removeItem, restoreAutosave, restoreRef, role, s, savedQuotes, sectorCodes, sectors,
    sendAllToQuoteItems, sendCostingToBatch, setActiveBatchRowId, setAiNotes,
    setAutoCodeEnabled, setAutoFill, setAutosaveBanner, setBatchConstrOverlay,
    setBatchConstrOverlayFilter, setBatchConstrOverlayQuery, setBatchConstrTargetRowId,
    setBatchProfile, setBatchResults, setBatchRows, setBlanketDisc, setBlanketInterest,
    setBoxTrim, setClTabExpandedConstr, setClTabFilter, setClTabQuery, setConstructionLib,
    setCostingContext, setEffectiveFrom, setEffectiveTo, setExpandedRows, setFreight,
    setFreightBands, setGyPremHigh, setGyPremLow, setItems, setLocations, setNewGrade,
    setNewLocation, setNewSector, setPartitionsMaster, setQuoteDate, setQuoteRef, setRates,
    setSavedQuotes, setSectors, setSetAutoFill, setShowChangePassword, setShowProfile,
    setSidebarCollapsed, setSpec, setSpecCommitted, setTab, showChangePassword, showProfile,
    showToast, sidebarCollapsed, spec, specCommitted, specForNewBatch, specFromProfile, tab,
    templateB64, templateLoaded, templateRef, toasts, togglePinAddOn, toggleRowExpand,
    touchRateDate,
  } = st;

  const NAV_ITEMS=[
    ["costing","📊","Costing"],
    ["items","📋","Quote Items",items.length],
    ["batch","🗂","Batch Entry"],
    ["constrlib","📚","Construction Library",constructionLib.length],
    ["rates","💰","Rate Master"],
    ["freight","🚚","Freight Rates"],
    ["defaults","🛠","Defaults"],
    ...(role==="admin"?[["users","👥","Users"]]:[]),
  ];
  const sidebar=(
    <div style={{background:C.slate,display:"flex",flexDirection:"column",flexShrink:0,
      width:sidebarCollapsed?56:200,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 14px",
        borderBottom:`2px solid ${C.amber}`,height:48,boxSizing:"border-box"}}>
        <div style={{width:28,height:28,flexShrink:0,background:C.amber,borderRadius:6,display:"flex",
          alignItems:"center",justifyContent:"center",fontSize:14}}>📦</div>
        {!sidebarCollapsed&&<div style={{color:C.white,fontWeight:700,fontSize:12,lineHeight:1.2,whiteSpace:"nowrap"}}>
          CFB Quotation Master
          <div style={{fontSize:8,color:"rgba(255,255,255,.4)",fontWeight:400}}>AVADHOOT PACKS</div>
        </div>}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
        {NAV_ITEMS.map(([t,icon,l,count])=>(
          <button key={t} onClick={()=>setTab(t)} title={sidebarCollapsed?l:undefined}
            style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:sidebarCollapsed?"10px 0":"10px 16px",
              justifyContent:sidebarCollapsed?"center":"flex-start",border:"none",background:tab===t?"rgba(217,123,46,.15)":"none",
              borderLeft:tab===t?`3px solid ${C.amber}`:"3px solid transparent",
              fontFamily:sans,fontSize:12,fontWeight:600,cursor:"pointer",
              color:tab===t?C.amber:"rgba(255,255,255,.6)"}}>
            <span style={{fontSize:15,flexShrink:0}}>{icon}</span>
            {!sidebarCollapsed&&<span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
              {l}{!!count&&` (${count})`}</span>}
            {sidebarCollapsed&&!!count&&<span style={{position:"absolute",marginLeft:14,marginTop:-14,
              background:C.amber,color:C.white,borderRadius:8,fontSize:8,padding:"1px 4px"}}>{count}</span>}
          </button>))}
      </div>
      <button onClick={()=>setSidebarCollapsed(v=>!v)} title={sidebarCollapsed?"Expand sidebar":"Collapse sidebar"}
        style={{padding:"10px 0",border:"none",borderTop:`1px solid rgba(255,255,255,.1)`,
          background:"none",color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:13}}>
        {sidebarCollapsed?"»":"« Collapse"}
      </button>
    </div>
  );

  // ── TOP BAR (account + backup/restore) ───────────────────────────────────
  const topBar=(
    <div style={{background:C.slate,display:"flex",alignItems:"center",padding:"0 16px",
      height:48,borderBottom:`2px solid ${C.amber}`,flexShrink:0,gap:8}}>
      <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
        <AccountMenu onEditProfile={()=>setShowProfile(true)} onChangePassword={()=>setShowChangePassword(true)}/>
        <button onClick={handleBackup} title="Download a full backup of all app data (rates, freight, sectors, constructions, partitions)"
          style={{padding:"4px 10px",borderRadius:5,fontSize:11,fontWeight:600,border:"1px solid rgba(255,255,255,.25)",
            background:"rgba(255,255,255,.10)",color:"rgba(255,255,255,.80)",cursor:"pointer",fontFamily:sans}}>
          ⬇ Backup
        </button>
        <button onClick={handleRestore} title="Restore all app data from a previously downloaded backup file"
          style={{padding:"4px 10px",borderRadius:5,fontSize:11,fontWeight:600,border:"1px solid rgba(255,255,255,.25)",
            background:"rgba(255,255,255,.10)",color:"rgba(255,255,255,.80)",cursor:"pointer",fontFamily:sans}}>
          ⬆ Restore
        </button>
        <input ref={restoreRef} type="file" accept="application/json" style={{display:"none"}}
          onChange={handleRestoreFile}/>
      </div>
    </div>
  );

  // ── SPEC FORM (left panel) ─────────────────────────────────────────────────
  const specForm=(
    <div style={{overflowY:"auto",height:"100%",padding:"10px 10px 24px"}}>
      {aiNotes&&<div style={{background:aiNotes.startsWith("✅")?C.greenL:C.redL,
        border:`1px solid ${aiNotes.startsWith("✅")?C.green:C.red}33`,
        borderRadius:6,padding:"8px 12px",marginBottom:10,fontSize:11,
        color:aiNotes.startsWith("✅")?C.green:C.red}}>
        {aiNotes}<button onClick={()=>setAiNotes("")}
          style={{float:"right",background:"none",border:"none",cursor:"pointer",color:"inherit",fontSize:14}}>×</button>
      </div>}
      <div style={card}>
        <SH title="Client & Product"/>
        {/* Identity freeze — batch-wide fields (Client, Sector) are locked once a batch row exists.
            G3/G5: MatCode is locked only in REVIEW (activeBatchRowId set) so the Maker can set a new
            MatCode for the next SET component after Send. SKU/Product is always editable and pushable.
            Exit from START lock: click "Start new SKU" (clears specCommitted).
            Exit from REVIEW lock: "↑ Push" or "✕ Unlink". */}
        {(activeBatchRowId||specCommitted)&&<div style={{
            background:"#FFF8ED",border:`1px solid ${C.amber}`,borderRadius:5,
            padding:"5px 10px",marginBottom:5,fontSize:10,color:C.amberD,lineHeight:1.5}}>
          {activeBatchRowId
            ?`🔒 Reviewing Batch Row ${batchRows.indexOf(batchRows.find(r=>r.id===activeBatchRowId))+1} — Client, Sector and Mat Code locked. SKU/Product editable. Push changes or ✕ Unlink.`
            :`🔒 SKU sent to Batch Entry — Client and Sector locked to this batch. Edit Mat Code and SKU/Product for the next item, or click "Start new SKU" to reset.`}
        </div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 8px",marginBottom:5}}>
          {/* Client — frozen in both REVIEW and START-after-Send */}
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Client *</div>
            {(activeBatchRowId||specCommitted)
              ?<div style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,
                  fontSize:11,color:C.slateM,background:"#F5F5F5",cursor:"not-allowed"}}
                  title={activeBatchRowId?"Locked — reviewing existing Batch row":"Locked to batch — click Start new SKU to change"}>
                {spec.client||"—"}
              </div>
              :<Inp value={spec.client} onChange={v=>s("client",v)}/>}
          </div>
          {/* Sector — frozen in both REVIEW and START-after-Send */}
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Sector
              {activeBatchRowId&&<span style={{fontSize:8,color:C.amber,marginLeft:4,fontWeight:400}}>(from Profile)</span>}
              {(!activeBatchRowId&&specCommitted)&&<span style={{fontSize:8,color:C.amber,marginLeft:4,fontWeight:400}}>(locked to batch)</span>}
            </div>
            {(activeBatchRowId||specCommitted)
              ?<div style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,
                  fontSize:11,color:C.slateM,background:"#F5F5F5",cursor:"not-allowed"}}
                  title={activeBatchRowId?"Sector is a batch-wide field. Change it in the Batch Profile, not here.":"Locked to batch — click Start new SKU to change"}>
                {spec.sector||"—"}
              </div>
              :<Sel value={spec.sector||""} onChange={v=>{
                const sd=sectors.find(x=>x.code===v);
                setSpec(p=>({...p,sector:v,
                  ...(sd?{waste:sd.wasteCBB,convRate:sd.convBox,
                           wastePP:sd.wastePP,convRatePP:sd.convPP}:{})}));
              }} opts={[{v:"",l:"— select —"},...sectorCodes.map(sc=>({v:sc,l:sc}))]}/>}
          </div>
          {/* Material Code — frozen in REVIEW only; editable in START (including after Send) */}
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase"}}>Material Code</div>
              {!activeBatchRowId&&<button onClick={()=>{
                const cli=(spec.client||"SKU").replace(/[^A-Za-z0-9]/g,"").substring(0,4).toUpperCase();
                const d=new Date();const ym=String(d.getFullYear()).slice(-2)+String(d.getMonth()+1).padStart(2,"0");
                const mc=cli+ym+"-"+String(Math.floor(Math.random()*900)+100);
                s("material_code",mc);
                if(setAutoFill&&(!spec.rowType||spec.rowType==="Box"))s("setCode",mc);
                showToast("Code: "+mc,'info',1800);
              }} style={{background:"none",border:"none",cursor:"pointer",fontSize:9,color:C.amber,fontWeight:700,padding:0}}>⚡ Auto</button>}
            </div>
            {activeBatchRowId
              ?<div style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,
                  fontSize:11,color:C.slateM,background:"#F5F5F5",cursor:"not-allowed",fontFamily:mono}}
                  title="Mat Code locked — reviewing existing Batch row. Unlink to create a new SKU.">
                {spec.material_code||"—"}
              </div>
              :<Inp value={spec.material_code} onChange={v=>{
                s("material_code",v);
                if(setAutoFill&&(!spec.rowType||spec.rowType==="Box")&&(spec.setCode===""||spec.setCode===spec.material_code))
                  s("setCode",v);
              }} placeholder="e.g. LT700"/>}
          </div>
          {/* SKU / Product — always editable; in REVIEW it is pushable via the Push button */}
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>
              SKU / Product *{activeBatchRowId&&<span style={{fontSize:8,color:C.green,marginLeft:4,fontWeight:400}}>(pushable)</span>}
            </div>
            <Inp value={spec.product} onChange={v=>s("product",v)}/>
          </div>
        </div>

      </div>
      <div style={card}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,borderBottom:`1px solid ${C.amber}`,paddingBottom:3,marginBottom:7}}>
          <input type="checkbox" id="setAutoFillChk" checked={setAutoFill}
            onChange={e=>{
              const on=e.target.checked;
              setSetAutoFill(on);
              if(!on){s("setCode","");}
              else if(!spec.rowType||spec.rowType==="Box")s("setCode",spec.material_code||"");
            }}
            style={{accentColor:C.amber,cursor:"pointer",width:11,height:11}}/>
          <label htmlFor="setAutoFillChk" style={{fontSize:9,fontWeight:700,color:C.amber,textTransform:"uppercase",letterSpacing:"0.09em",cursor:"pointer",margin:0}}>
            Part of a SET
          </label>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"90px 1fr 72px",gap:"0 7px",marginBottom:4}}>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>SET Code</div>
            <Inp value={spec.setCode} onChange={v=>s("setCode",v.toUpperCase())} placeholder="e.g. A"/>
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Set Role</div>
            <Sel value={spec.rowType} onChange={v=>{
              s("rowType",v);
              if(v==="Plate"||v==="Part-L"||v==="Part-W"){
                s("boxType","PP");
                // Do NOT clear skuType — Glass SKU Type is SET-level context, persists across role changes.
                // Part-L / Part-W: re-derive qtyPerSet from partitionsMaster for the new role.
                // Plate: do NOT modify qtyPerSet — Plate Nos/Set is at the Maker's discretion.
                if((v==="Part-L"||v==="Part-W")&&spec.skuType){
                  const _pm=partitionsMaster.find(x=>x.skuType===spec.skuType);
                  if(_pm) s("qtyPerSet",v==="Part-L"?_pm.lwise:_pm.wwise);
                }
              } else if(v==="Box"){s("boxType","RSC");}
            }}
              opts={[{v:"Box",l:"Main Box"},{v:"Plate",l:"Plate"},{v:"Part-L",l:"Partition-L"},{v:"Part-W",l:"Partition-W"},{v:"Other",l:"Other"}]}/>
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>
              Nos/Set <span style={{fontSize:8,fontWeight:400,color:C.slateL}}>pcs</span>
            </div>
            <input value={spec.qtyPerSet??1} type="number" min="1" step="1"
              onChange={e=>s("qtyPerSet",Math.max(1,+e.target.value||1))}
              style={{width:"100%",padding:"4px 5px",border:`1px solid ${spec.qtyPerSet>1?C.amber:C.border}`,
                borderRadius:4,fontSize:11,textAlign:"center",boxSizing:"border-box",
                fontWeight:spec.qtyPerSet>1?700:400,color:spec.qtyPerSet>1?C.amberD:C.slate}}/>
            {spec.qtyPerSet>1&&<div style={{fontSize:8,color:C.amberD,marginTop:1,textAlign:"center"}}>
              ×{spec.qtyPerSet} in SET rate</div>}
          </div>
        </div>
        {/* Auto-dims from parent Box: search batchRows first (primary), then items (legacy fallback) */}
        {spec.rowType!=="RS4"&&spec.setCode&&(()=>{
          const sc=(spec.setCode||"").trim().toUpperCase();
          // Issue 3 fix: parent Box is in batchRows (primary workflow path).
          // items (Quote Items) is the legacy path — kept as fallback only.
          const parent=
            batchRows.find(r=>(r.setCode||"").trim().toUpperCase()===sc&&(r.itemType||"Box")==="Box")||
            items.find(i=>(i.spec.setCode||"").trim().toUpperCase()===sc&&i.spec.rowType==="Box");
          if(!parent)return null;
          const pL=parent.L??parent.spec?.L;
          const pW=parent.W??parent.spec?.W;
          const pH=parent.H??parent.spec?.H;
          if(!pL||!pW||!pH)return null;
          const hints={Plate:`Plate: L=${+pL-5}mm, W=${+pW-5}mm`,
            "Part-L":`Part-L: L=${+pL-5}mm, W=${+pH-15}mm`,"Part-W":`Part-W: L=${+pW-5}mm, W=${+pH-15}mm`};
          const srcLabel=parent.matCode||parent.spec?.material_code||"parent Box";
          return<div style={{padding:"8px 10px",background:C.greenL,borderRadius:6,
            fontSize:11,color:C.green,marginTop:-4}}>
            <strong>Auto-dims from {srcLabel}:</strong> {hints[spec.rowType]||""}
            <Btn ch="Apply" v="success" sm style={{marginLeft:8}} onClick={()=>{
              if(spec.rowType==="Plate"){s("L",+pL-5);s("W",+pW-5);}
              else if(spec.rowType==="Part-L"){s("L",+pL-5);s("W",+pH-15);}
              else if(spec.rowType==="Part-W"){s("L",+pW-5);s("W",+pH-15);}
            }}/>
          </div>;
        })()}
        {/* Glass SKU Type — Alcobev partitions only */}
        {spec.sector==="ALCOBEV"&&(spec.rowType==="Part-L"||spec.rowType==="Part-W")&&<div style={{marginTop:6,padding:"8px 10px",background:"#EEF4FB",border:"1px solid #6A9FD433",borderRadius:6}}>
          <div style={{fontSize:9,color:"#2E6094",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>
            Glass SKU Type <span style={{fontSize:8,fontWeight:400}}>(auto-fills Nos/Set)</span>
          </div>
          <Sel value={spec.skuType||""} onChange={v=>{
            s("skuType",v);
            const pm=partitionsMaster.find(x=>x.skuType===v);
            if(pm){s("qtyPerSet",spec.rowType==="Part-L"?pm.lwise:pm.wwise);}
          }} opts={[{v:"",l:"— select SKU type —"},...partitionsMaster.map(x=>({v:x.skuType,l:x.skuType}))]}/>
          {spec.skuType&&(()=>{
            const pm=partitionsMaster.find(x=>x.skuType===spec.skuType);
            return pm?<div style={{fontSize:9,color:"#2E6094",marginTop:3}}>
              L-wise: {pm.lwise} pcs · W-wise: {pm.wwise} pcs →
              <b style={{color:C.amber,marginLeft:4}}>Nos/Set = {spec.rowType==="Part-L"?pm.lwise:pm.wwise}</b>
            </div>:null;
          })()}
        </div>}
      </div>

      {/* G6: Construction cue — shown when SET Role is non-Box and construction is non-blank.
          Derived from current values; no state tracking needed. This is a reminder only —
          it does NOT imply the retained construction is correct for this role. The Maker
          must confirm or change it. Box→PP does not require different construction;
          Part-L→Part-W does not require the same construction. */}
      {!activeBatchRowId&&(spec.rowType&&spec.rowType!=="Box")&&(
        spec.layers?.TOP?.code||spec.layers?.F1?.code||spec.layers?.L1?.code
      )&&<div style={{background:"#FFF8ED",border:`1px solid ${C.amber}`,borderRadius:5,
          padding:"6px 10px",marginBottom:4,fontSize:10,color:C.amberD,lineHeight:1.5}}>
        ⚠️ <b>Construction inherited from previous item</b> — confirm or change before sending.
        The retained construction is a starting default only, not a recommendation for this SET role.
      </div>}
      <div style={card}>
        <SH title="Dimensions & Construction"/>
        {/* Row 1: L W H Ups Dim */}
        <div style={{display:"grid",gridTemplateColumns:"62px 62px 62px 1fr 56px",gap:"4px 5px",marginBottom:4}}>
          {[["L","L (mm)"],["W","W (mm)"],["H","H (mm)"]].map(([k,lbl])=>(
            <div key={k}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>{lbl}</div>
              <Inp value={spec[k]} onChange={v=>s(k,v)} type="number"/>
            </div>))}
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Ups</div>
            <Inp value={spec.ups} onChange={v=>s("ups",+v)} type="number"/>
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Dim</div>
            <Sel value={spec.dimType} onChange={v=>s("dimType",v)} opts={["ID","OD"]}/>
          </div>
        </div>
        {/* Row 2: Box Type Ply F1 F2 — Box Type 1fr (fills available width), PLY 68px (fits 3-ply/5-ply) */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 68px 58px 58px",gap:"4px 5px",marginBottom:2}}>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Box Type</div>
            <Sel value={spec.boxType} onChange={v=>s("boxType",v)} opts={BOX_TYPES}/>
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Ply</div>
            <Sel value={spec.ply} onChange={v=>s("ply",+v)} opts={[{v:3,l:"3-ply"},{v:5,l:"5-ply"}]}/>
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>F1 Flute</div>
            <Sel value={spec.flute_F1} onChange={v=>s("flute_F1",v)} opts={["A","B","C","E"]}/>
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>F2 Flute</div>
            <Sel value={spec.flute_F2} onChange={v=>s("flute_F2",v)}
              opts={[{v:"",l:"—"},...["A","B","C","E"].map(f=>({v:f,l:f}))]}/>
          </div>
        </div>
      </div>
      {/* ── Live Die-line Preview ── */}
      {(spec.L&&spec.W&&spec.H)&&(
      <div style={{background:"#FAFAFA",borderRadius:6,border:"1px solid #E8E0D4",padding:"8px 10px",marginBottom:4}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontSize:9,fontWeight:700,color:"#9A7B4A",textTransform:"uppercase",letterSpacing:"0.07em"}}>
            Die-Line Preview
          </span>
          <span style={{fontSize:8,color:"#AAA"}}>
            {spec.boxType==="Die-R"||spec.boxType==="Die-S"
              ? "⚠ Approximation only — use customer KLD for die-cut SKUs"
              : `Flat blank: ${Math.round(2*(+spec.L||0)+(2*(+spec.W||0))+Math.max((+spec.W||0)*0.1,15))}×${Math.round((+spec.H||0)+2*Math.min((+spec.W||0)/2,(+spec.H||0)))} mm (RSC est.)`
            }
          </span>
        </div>
        <div style={{overflowX:"auto"}}>
          <BoxDieline L={spec.L} W={spec.W} H={spec.H}
            boxType={spec.boxType||"RSC"} dimType={spec.dimType} ups={spec.ups}/>
        </div>
      </div>)}
      <div style={card}>
        <SH title="Paper Construction"/>
        <div style={{display:"grid",gridTemplateColumns:"72px 1fr 80px 52px",gap:"3px 5px",
          fontSize:9,color:C.slateL,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>
          <div>Layer</div><div>Grade</div><div style={{textAlign:"center"}}>GSM</div><div style={{textAlign:"center"}}>Flute</div>
        </div>
        {[["TOP","TOP Liner",false,null],["F1","F1 Medium",true,"flute_F1"],
          ["L1","L1 Liner",false,null],["F2","F2 Medium",true,"flute_F2"],["L2","L2 Liner",false,null]]
        .map(([k,lbl,isF,fk])=>(
          <div key={k} style={{display:"grid",gridTemplateColumns:"72px 1fr 80px 52px",gap:"3px 5px",
            marginBottom:4,alignItems:"center"}}>
            <div style={{fontSize:11,fontWeight:600,color:C.slateM}}>{lbl}</div>
            <select value={spec.layers[k]?.code||""} onChange={e=>s(`layers.${k}.code`,e.target.value)}
              style={{...inputSt,fontFamily:mono,fontSize:11}}>
              {gradeCodes.map(c=><option key={c} value={c}>{c||"— select —"}</option>)}
            </select>
            <Inp value={spec.layers[k]?.gsm||""} onChange={v=>s(`layers.${k}.gsm`,v)} type="number" placeholder="GSM"/>
            {isF?<Sel value={spec[fk]||""} onChange={v=>s(fk,v)}
              opts={[{v:"",l:"—"},...["A","B","C","E"].map(f=>({v:f,l:f}))]}/>
            :<div style={{textAlign:"center",fontSize:11,color:C.slateL}}>—</div>}
          </div>))}
      </div>
      <div style={card}>
        <SH title="Board Specifications"/>
        {(()=>{
          // Tolerance order cycles on click: min → avg → max → min
          const TOL_SEQ=["min","avg","max"];
          const TOL_LABEL={min:"Min",avg:"Avg",max:"Max"}; // abbreviated to fit panel width
          const TC={min:"#3B82F6",avg:"#9B6F2F",max:"#C0392B"};
          const cobbV=spec.spec_cobb?+spec.spec_cobb:null;
          const cobbWarn=cobbV&&cobbV<=125;
          const sheetG=r?Math.round(r.wtSheet*1000):null;
          const estG=r?Math.round(r.estimatedBoxWt*1000):null;
          const reqG=spec.reqBoxWt&&+spec.reqBoxWt>0?+spec.reqBoxWt:null;
          const diffPct=reqG&&estG?Math.abs(estG-reqG)/reqG:null;
          const wtOk=diffPct!==null&&diffPct<=0.015;
          // Input row: flex with value taking 1fr and chip fixed 36px
          // Label sits above as a separate flex row — no wasted spacer column
          // Cycling chip — inline, right of value field
          const TolChip=({tk,def})=>{
            const tol=spec[tk]||def;
            const isDefault=tol===def;
            const next=TOL_SEQ[(TOL_SEQ.indexOf(tol)+1)%3];
            return(
              <button onClick={()=>s(tk,next)}
                title={`Tolerance: ${TOL_LABEL[tol]}${tol==="avg"?" ±5%":""} — click to cycle`}
                style={{flexShrink:0,width:28,padding:"1px 2px",
                  borderRadius:3,border:`1px solid ${isDefault?"#D8D8D8":TC[tol]}`,
                  background:isDefault?"#F4F4F4":TC[tol]+"18",
                  color:isDefault?"#AAA":TC[tol],
                  fontSize:6.5,fontWeight:isDefault?400:700,
                  cursor:"pointer",lineHeight:1.4,whiteSpace:"nowrap",
                  textAlign:"center",display:"block"}}>
                {TOL_LABEL[tol]}
              </button>);
          };
          const LEFT=[
            {k:"board_gsm",lbl:"GSM", unit:"g/m²",   stp:5,   def:"avg"},
            {k:"spec_bs",  lbl:"BS",  unit:"kg/cm²",  stp:0.25,def:"min"},
            {k:"spec_cobb",lbl:"Cobb",unit:"g/m²",   stp:5,   def:"max"},
          ];
          const RIGHT=[
            {k:"spec_ect",   lbl:"ECT",    unit:"kN/m", stp:0.25,def:"min"},
            {k:"spec_bct",   lbl:"BCT",    unit:"kgf",  stp:5,   def:"min"},
            {k:"reqBoxWt",   lbl:"Net Wt", unit:"g",    stp:1,   def:"avg"},
          ];
          // Row: label+unit inline on left (baseline-aligned), input+chip right-aligned.
          // inpColSt: marginRight:2 keeps chip 2px inside column edge.
          // RIGHT map overrides with marginLeft:-3 to pull that bundle leftward.
          const rowSt={display:"flex",alignItems:"center",gap:4,marginBottom:3};
          const lblColSt={flex:"0 0 38%",minWidth:0,display:"flex",alignItems:"baseline",gap:3,flexWrap:"nowrap",paddingLeft:2};
          const inpColSt={display:"flex",gap:3,alignItems:"center",marginRight:2};
          // Sub-header: matches Paper Construction column header style exactly —
          // fontSize:9, slateL, bold, uppercase, no border, marginBottom:4.
          const SubHdr=({title})=>(
            <div style={{fontSize:9,fontWeight:700,color:C.slateL,textTransform:"uppercase",
              letterSpacing:"0.09em",marginBottom:4}}>{title}</div>);
          return(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px",marginBottom:4}}>
                {/* LEFT: GSM · BS · Cobb */}
                <div>
                  <SubHdr title="Board"/>
                  {LEFT.map(({k,lbl,unit,stp,def},i)=>{
                    const tk=k+"_tol";
                    const tol=spec[tk]||def;
                    const isDefault=tol===def;
                    const hasVal=spec[k]&&+spec[k]>0;
                    const isCobbWarn=k==="spec_cobb"&&cobbWarn;
                    return(
                    <div key={k} style={{...rowSt,marginBottom:i<2?3:0}}>
                      <div style={lblColSt}>
                        <span style={{fontSize:10,fontWeight:600,color:C.slateM,lineHeight:1}}>{lbl}</span>
                        <span style={{fontSize:7,color:C.slateL,lineHeight:1}}>{unit}</span>
                      </div>
                      <div style={inpColSt}>
                        <Inp value={spec[k]??""} type="number" step={stp}
                          onChange={v=>s(k,v)}
                          st={{textAlign:"right",width:64,boxSizing:"border-box",padding:"3px 5px",
                            borderColor:isCobbWarn?C.amber:hasVal&&!isDefault?TC[tol]:undefined,
                            background:isCobbWarn?"#FFF8ED":undefined}}/>
                        <TolChip tk={tk} def={def}/>
                      </div>
                    </div>);
                  })}
                  {/* Cobb remark — sits flush under left panel, only when triggered */}
                  {cobbWarn&&<div style={{fontSize:8,color:C.amber,marginTop:4,lineHeight:1.3}}>
                    Cobb&#8804;125 → confirm Coating</div>}
                </div>
                {/* RIGHT: ECT · BCT · Net Wt — unified, no separator before Net Wt */}
                <div>
                  <SubHdr title="Performance"/>
                  {RIGHT.map(({k,lbl,unit,stp,def},i)=>{
                    const tk=k+"_tol";
                    const tol=spec[tk]||def;
                    const isDefault=tol===def;
                    const isNetWt=k==="reqBoxWt";
                    const val=isNetWt?spec.reqBoxWt:spec[k];
                    const hasVal=val&&+val>0;
                    const onChange=isNetWt?(v=>s("reqBoxWt",v)):(v=>s(k,v));
                    return(
                    <div key={k} style={{...rowSt,marginBottom:i<2?3:0}}>
                      <div style={lblColSt}>
                        <span style={{fontSize:10,fontWeight:600,color:C.slateM,lineHeight:1}}>{lbl}</span>
                        <span style={{fontSize:7,color:C.slateL,lineHeight:1}}>{unit}</span>
                      </div>
                      <div style={{...inpColSt,marginLeft:-3}}>
                        <Inp value={val??""} type="number" step={stp}
                          onChange={onChange}
                          st={{textAlign:"right",width:64,boxSizing:"border-box",padding:"3px 5px",
                            borderColor:hasVal&&!isDefault?TC[tol]:undefined}}/>
                        <TolChip tk={tk} def={def}/>
                      </div>
                    </div>);
                  })}
                  {/* Weight remarks — sits flush under right panel */}
                  {(sheetG||estG||reqG)&&<div style={{fontSize:8,color:C.slateM,marginTop:4,lineHeight:1.3}}>
                    {sheetG&&<span>Sheet: <b style={{fontFamily:mono,color:C.slate}}>{sheetG} g</b></span>}
                    {estG&&<span style={{marginLeft:6}}>Est: <b style={{fontFamily:mono,color:C.green}}>{estG} g</b>
                      {spec.boxType!=="RSC"&&<span style={{color:C.orange,fontSize:7,marginLeft:2}}>&#9888; verify</span>}
                    </span>}
                    {reqG&&estG&&<span style={{marginLeft:6,color:wtOk?C.green:C.red,fontWeight:600}}>
                      {wtOk?"On target":"\u26A0 "+(diffPct*100).toFixed(1)+"%"}
                    </span>}
                  </div>}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
      <div style={card}>
        <SH title="Commercial Intelligence"/>
        {/* Volume + MOQ — compact 2-col layout */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 8px",marginBottom:5}}>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>
              Volume (nos/month) <span style={{color:C.red}}>*</span></div>
            <Inp value={spec.volume} onChange={v=>s("volume",v)} type="number" step="100" placeholder="boxes/mo"/>
            {r?.calcMOQ&&<div style={{fontSize:9,color:C.slateL,marginTop:2,display:"flex",gap:4}}>
              {[1,2,3].map(m=><button key={m} onClick={()=>s("volume",r.calcMOQ*m)}
                style={{padding:"2px 7px",borderRadius:4,fontSize:9,cursor:"pointer",border:`1px solid ${C.border}`,
                  background:+spec.volume===r.calcMOQ*m?C.amberL:C.white,
                  color:+spec.volume===r.calcMOQ*m?C.amberD:C.slateL}}>{m}×MOQ</button>)}
            </div>}
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>
              Proposed MOQ (boxes)</div>
            <div style={{display:"flex",gap:4,alignItems:"center"}}>
              <Inp value={spec.salesMOQ} onChange={v=>s("salesMOQ",v)} type="number" placeholder="boxes"/>
              {r?.calcMOQ&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:5,whiteSpace:"nowrap",
                background:spec.salesMOQ&&+spec.salesMOQ<r.calcMOQ?C.redL:C.greenL,
                color:spec.salesMOQ&&+spec.salesMOQ<r.calcMOQ?C.red:C.green,fontWeight:700}}>
                Min {r.calcMOQ.toLocaleString()}</span>}
            </div>
            {r?.calcMOQ&&<div style={{fontSize:9,color:C.slateL,marginTop:2}}>
              {r.moqKg.toLocaleString()} kg ÷ {r.wt.toFixed(3)} kg/box</div>}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6,marginBottom:4}}>
          <div>
            <div style={{fontSize:9,fontWeight:600,color:C.slateL,textTransform:"uppercase",marginBottom:2}}>Customer Type</div>
            <Sel value={spec.customerType} onChange={v=>s("customerType",v)}
              opts={[{v:"strategic",l:"Strategic / Key Account"},{v:"new",l:"New Customer"},
                {v:"existing",l:"Existing Customer"},{v:"spot",l:"Spot / One-time"}]}/>
          </div>
          <div>
            <div style={{fontSize:9,fontWeight:600,color:C.slateL,textTransform:"uppercase",marginBottom:2}}>Price Context</div>
            <Sel value={spec.priceContext} onChange={v=>s("priceContext",v)}
              opts={[{v:"sensitive",l:"Price sensitive (street price known)"},{v:"unknown",l:"Price unknown"},
                {v:"premium",l:"Premium / quality buyer"},{v:"tender",l:"Tender / bid"}]}/>
          </div>
        </div>
        <div style={{marginBottom:4}}>
          <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>
            Payment Discipline
          </div>
          <select value={spec.paymentDisc||"30"}
            onChange={e=>{
              s("paymentDisc",e.target.value);
              const m={"30":0.5,"45":0.75,"60":1.0,"90":1.5};
              s("interest",m[e.target.value]||1.5);
            }}
            style={{...inputSt,color:C.slateM}}>
            <option value="30">Prompt — ≤ 30 days (Interest: 0.5%)</option>
            <option value="45">Moderate — ≤ 45 days (Interest: 0.75%)</option>
            <option value="60">Delayed — ≤ 60 days (Interest: 1.0%)</option>
            <option value="90">Chronic — ≤ 90 days (Interest: 1.5%)</option>
          </select>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",fontSize:11,color:C.slateL}}>
          <input type="checkbox" checked={spec.isRepeat} onChange={e=>s("isRepeat",e.target.checked)}
            style={{width:13,height:13,accentColor:C.amber}}/>
          Repeat customer / same SKU
        </label>
      </div>
      <div style={card}>
        <SH title="Commercial Parameters"/>
        {/* B2: Plant and Delivery are batch-wide fields — in REVIEW mode (activeBatchRowId set)
            buildSpecFromRow reads prof.plant/delivery, never spec.*. Show read-only in REVIEW. */}
        {/* Layout: Row 1 — Plant | Delivery | Freight */}
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.7fr) minmax(0,1.7fr) minmax(0,1fr)",gap:"4px 8px",marginBottom:5}}>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Avadhoot Plant</div>
            {activeBatchRowId
              ?<div style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,
                  fontSize:11,color:C.slateM,background:"#F5F5F5",cursor:"not-allowed"}}
                  title="Plant is a batch-wide field. Change it in the Batch Profile.">{spec.plant||"—"}</div>
              :<Sel value={spec.plant} onChange={v=>s("plant",v)} opts={PLANTS} ph="— select —"/>}
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Client Plant</div>
            {activeBatchRowId
              ?<div style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,
                  fontSize:11,color:C.slateM,background:"#F5F5F5",cursor:"not-allowed"}}
                  title="Delivery is a batch-wide field. Change it in the Batch Profile.">{spec.delivery||"—"}</div>
              :<Sel value={spec.delivery} onChange={v=>s("delivery",v)} opts={locations} ph="— select —"/>}
          </div>
          <div>
            {/* Freight: matrix value shown as placeholder. Override field stays blank = inherit.
                Missing combination shown as "— no rate" so the Maker knows to enter manually. */}
            {(()=>{
              const _mxFr=freight?.[spec.plant]?.[spec.delivery];
              const _hasMx=_mxFr!=null;
              const _mxVal=_hasMx?+_mxFr:null;
              const _isOvr=spec.freightOverride!==""&&spec.freightOverride!=null&&+spec.freightOverride>0;
              return(
              <div>
                <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2,whiteSpace:"nowrap"}}>
                  Freight Rs/kg{_isOvr&&<span style={{fontSize:8,color:C.amber,marginLeft:3,fontWeight:700}}>↑</span>}{!_hasMx&&!_isOvr&&<span style={{fontSize:9,color:C.red,marginLeft:3}}>⚠</span>}
                </div>
                <input type="number" step="0.25" min="0"
                  value={spec.freightOverride??""}
                  onChange={e=>s("freightOverride",e.target.value)}
                  placeholder={_hasMx?String(_mxVal):"— no rate"}
                  title={_isOvr?`Override active — matrix: ${_hasMx?_mxVal+" Rs/kg":"no entry"}`
                    :_hasMx?`Matrix: ${_mxVal} Rs/kg (${spec.plant||"?"} → ${spec.delivery||"?"})`
                    :`No freight rate for ${spec.plant||"?"}→${spec.delivery||"?"}. Enter a manual override.`}
                  style={{width:"100%",padding:"4px 5px",border:`1px solid ${_isOvr?C.amber:(!_hasMx&&!_isOvr)?C.red:C.border}`,
                    borderRadius:4,fontSize:11,textAlign:"center",boxSizing:"border-box",
                    background:_isOvr?"#FFF8ED":C.white,fontFamily:mono}}/>
              </div>);
            })()}
          </div>
        </div>
        {/* Row 2 — Waste | Conv | Margin | Interest. Placeholder shows effective inherited value.
            Input stays blank = inherit. Explicit entry = override (amber border). */}
        {(()=>{
          const isPP=isPPType(spec.rowType||"Box");
          const _effWaste=isPP?_wasteDefPP:_wasteDefBox;
          const _effConv=isPP?_convDefPP:_convDefBox;
          const _wKey=isPP?"wastePP":"waste";
          const _cKey=isPP?"convRatePP":"convRate";
          const _isOvW=spec[_wKey]!==""&&spec[_wKey]!=null&&+spec[_wKey]!==+_effWaste;
          const _isOvC=spec[_cKey]!==""&&spec[_cKey]!=null&&+spec[_cKey]!==+_effConv;
          const mgnOvr=spec.margin!==""&&spec.margin!=null&&+spec.margin!==(batchProfile.margin??8);
          const intOvr=spec.interest!==""&&spec.interest!=null&&+spec.interest!==(batchProfile.interest??0.5);
          const fld=(label,key,placeholder,isOvr)=>(
            <div>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2,display:"flex",justifyContent:"center",gap:4}}>
                <span>{label}{isPP&&(key==="wastePP"||key==="convRatePP")?<span style={{fontSize:7,fontWeight:400}}> PP</span>:null}</span>
                {isOvr&&<span style={{fontSize:8,color:C.amber,fontWeight:400}}>↑</span>}
              </div>
              <input value={spec[key]??""} type="number" step="0.25" onChange={e=>s(key,e.target.value)}
                placeholder={placeholder!=null?String(placeholder):""}
                title={isOvr?`Override — effective: ${spec[key]}`:`Effective: ${placeholder}`}
                style={{width:"100%",padding:"4px 5px",border:`1px solid ${isOvr?C.amber:C.border}`,
                  borderRadius:4,fontSize:11,textAlign:"center",boxSizing:"border-box",
                  background:isOvr?"#FFF8ED":C.white}}/>
            </div>
          );
          return(
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"4px 8px",marginBottom:5}}>
            {fld("Waste %",_wKey,_effWaste,_isOvW)}
            {fld("Conv Rs/kg",_cKey,_effConv,_isOvC)}
            {fld("Margin %","margin",batchProfile.margin??8,mgnOvr)}
            {fld("Interest %","interest",batchProfile.interest??0.5,intOvr)}
          </div>);
        })()}
      </div>
      <div style={card}>
        <div style={{fontSize:9,fontWeight:700,color:C.amber,textTransform:"uppercase",letterSpacing:"0.09em",borderBottom:`1px solid ${C.amber}`,paddingBottom:3,marginBottom:8,display:"flex",alignItems:"baseline",justifyContent:"center",gap:6}}>
          <span>Add-on Costs</span>
          {(()=>{
            const LABELS={printing:"Print",stitching:"Stitch",coating:"Coat",
              handling:"Hdlg",moqCharge:"MOQ±",packing:"Pack",other:"Other",unloading:"Unload"};
            const active=Object.entries(LABELS).filter(([k])=>spec[k]&&+spec[k]>0)
              .map(([k,l])=>`${l} ₹${(+spec[k]).toFixed(0)}`);
            return active.length?<span style={{fontSize:8,fontWeight:400,color:C.amber,textTransform:"none",letterSpacing:0}}>({active.join(" · ")})</span>:null;
          })()}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"5px 8px"}}>
          {[["printing","Printing","Rs/pc"],["stitching","Stitching","Rs/pc"],["coating","Coating","Rs/pc"],["handling","Non-Std Hdlg","Rs/pc"],
            ["moqCharge","MOQ Chg","Rs/pc"],["packing","Packing","Rs/pc"],["other","Other","Rs/pc"],["unloading","Unloading","Rs/pc"]].map(([k,lbl,unit])=>(
            <div key={k}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:1}}>{lbl}</div>
              <div style={{display:"flex",alignItems:"center",gap:2}}>
                <input value={spec[k]??0} type="number" step="0.25" onChange={e=>s(k,+e.target.value)}
                  style={{width:"100%",padding:"4px 5px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center",boxSizing:"border-box",fontFamily:mono}}/>
                <span style={{fontSize:9,color:C.slateL,whiteSpace:"nowrap"}}>{unit}</span>
              </div>
            </div>))}
        </div>
      </div>
      {/* ── SinglePointQuoteFinalization: Costing is analysis-only ── */}
      {activeBatchRowId
        ? (()=>{
            // BH-1: detect if construction fields in Costing differ from the library entry
            // for the active batch row. If so, warn the Maker before they navigate away.
            const _activeRow=batchRows.find(r=>r.id===activeBatchRowId);
            const _libEntry=_activeRow?constructionLib.find(c=>c.code===_activeRow.constructionCode):null;
            const _constrChanged=_libEntry&&(
              +spec.ply!==+_libEntry.ply||
              spec.boxType!==_libEntry.boxType||
              spec.flute_F1!==_libEntry.flute_F1||
              spec.flute_F2!==_libEntry.flute_F2||
              JSON.stringify(spec.layers||{})!==JSON.stringify(_libEntry.layers||{})
            );
            return(<>
              {/* A2b: visible banner naming the linked row — Maker always knows which row is under review */}
              <div style={{background:"#EEF4FB",border:"1px solid #2E6094",borderRadius:5,
                  padding:"6px 10px",marginBottom:4,fontSize:11,color:"#2E6094",lineHeight:1.5}}>
                🔍 <b>Reviewing Batch Row {batchRows.indexOf(_activeRow)+1}</b>
                {_activeRow?.matCode?<> [{_activeRow.matCode}]</>:null}
                {_activeRow?.product?<span style={{fontWeight:400}}> — {_activeRow.product}</span>:null}
                <span style={{fontWeight:400,marginLeft:4,fontSize:10}}>
                  · Changes apply only on Push
                </span>
              </div>
              {_constrChanged&&<div style={{
                  background:"#FFF8ED",border:`1px solid ${C.amber}`,borderRadius:5,
                  padding:"6px 10px",marginBottom:4,fontSize:11,color:C.amberD,lineHeight:1.5}}>
                ⚠️ Construction changes not yet saved to Batch row <b>[{_activeRow?.matCode||"?"}]</b>.
                Push to apply, or Unlink to discard.
              </div>}
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button onClick={pushCostingToBatchRow}
                  style={{flex:1,padding:"9px",borderRadius:6,border:"none",fontFamily:sans,
                    fontSize:13,fontWeight:700,cursor:"pointer",
                    background:C.green,color:"white",letterSpacing:"0.02em"}}>
                  ↑ Push to Row {batchRows.indexOf(_activeRow)+1}{_activeRow?.matCode?` [${_activeRow.matCode}]`:""}
                </button>

              </div>
            </>);
          })()
        : (()=>{
            // Readiness state is hoisted (_sendReady etc.) — reference directly
            return(
            <div style={{borderRadius:7,border:`1px solid ${_sendReady?"#2E6094":"#C0A000"}`,
              background:_sendReady?"#EEF4FB":"#FFFBEA",
              padding:"10px 12px",marginTop:4}}>
              <div style={{fontSize:11,fontWeight:700,
                color:_sendReady?"#2E6094":"#7A4500",marginBottom:4}}>
                {_sendReady?"✅ Ready to send to Batch Entry":"⚠️ Costing → Batch Entry"}
              </div>
              <div style={{fontSize:10,color:_sendReady?"#2E6094":"#7A4500",lineHeight:1.5}}>
                {_sendReady
                  ?"Use → Send to Batch Entry in the header to create a batch row."
                  :"Resolve the items shown in the right panel to enable Send."}
              </div>
            </div>);
          })()}
    </div>
  );

  // ── OUTPUT PANEL (right) ──────────────────────────────────────────────────
  const outputPanel=(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,background:C.cream,flexShrink:0}}>
        <div style={{padding:"9px 14px",fontFamily:sans,fontSize:12,fontWeight:600,
          color:C.amber,borderBottom:`2px solid ${C.amber}`}}>Costing</div>
        <div style={{marginLeft:"auto",padding:"4px 8px",display:"flex",gap:6,alignItems:"center"}}>
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
      <div style={{flex:1,overflowY:"auto",padding:12}}>
        {/* Diagnostics — Blockers (left) + Warnings (right) always side-by-side for equal height.
             Plant warning injected locally (plant/delivery not in costing.js checkMissingInfo). */}
        {(()=>{
          const _extraWarnings=[];
          if(!spec.plant||!spec.delivery) _extraWarnings.push("Avadhoot Plant & Client Plant not selected");
          const _allWarnings=[...missing.warnings,..._extraWarnings];
          if(missing.blockers.length===0&&_allWarnings.length===0) return null;
          return(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
            {/* Left col — Blockers */}
            <div style={{background:C.redL,border:`1px solid ${C.red}33`,borderRadius:6,padding:"8px 10px"}}>
              <div style={{fontSize:10,fontWeight:700,color:C.red,marginBottom:3}}>
                ❌ {missing.blockers.length} BLOCKER{missing.blockers.length>1?"S":""}</div>
              {missing.blockers.length>0
                ? missing.blockers.map((b,i)=><div key={i} style={{fontSize:10,color:C.red,paddingLeft:3}}>
                    · {b.replace(" — enter at least one layer","")}
                  </div>)
                : <div style={{fontSize:10,color:C.red,paddingLeft:3,opacity:.5}}>None</div>}
            </div>
            {/* Right col — Warnings */}
            <div style={{background:"#FFF8ED",border:`1px solid ${C.amber}44`,borderRadius:6,padding:"8px 10px"}}>
              <div style={{fontSize:10,fontWeight:700,color:C.amberD,marginBottom:3}}>
                ⚠️ {_allWarnings.length} WARNING{_allWarnings.length>1?"S":""}</div>
              {_allWarnings.length>0
                ? _allWarnings.map((w,i)=><div key={i} style={{fontSize:10,color:C.amberD,paddingLeft:3}}>· {w}</div>)
                : <div style={{fontSize:10,color:C.amberD,paddingLeft:3,opacity:.5}}>None</div>}
            </div>
          </div>);
        })()}
        {missing.blockers.length===0&&r&&<div style={{marginBottom:8,fontSize:11,color:C.green,fontWeight:600}}>
          ✅ Ready to quote{missing.warnings.length>0?` (${missing.warnings.length} warning${missing.warnings.length>1?"s":""} noted)`:""}</div>}
        {!r&&<div style={{padding:"16px 0"}}>
          <div style={{fontSize:12,fontWeight:600,color:C.slateM,marginBottom:12,textAlign:"center"}}>
            Complete these fields to generate costing</div>
          {[["📐","Dimensions","L × W × H in mm (Costing form → Dimensions)"],
            ["📄","Paper Construction","Select grade + GSM for at least TOP, F1 and L1 layers"],
            ["🏭","Commercial","Avadhoot Plant + Client Plant + Monthly Volume (nos/month)"],
            ["💰","Rates","Verify Rate Master prices are current — use Rate Master tab"],
          ].map(([icon,title,desc])=>(
            <div key={title} style={{display:"flex",gap:10,padding:"9px 12px",marginBottom:6,
              background:C.white,border:`1px solid ${C.border}`,borderRadius:7,alignItems:"flex-start"}}>
              <div style={{fontSize:18,flexShrink:0}}>{icon}</div>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:C.slate,marginBottom:2}}>{title}</div>
                <div style={{fontSize:11,color:C.slateL,lineHeight:1.45}}>{desc}</div>
              </div>
            </div>))}
        </div>}

        {r&&<>
          {/* Key numbers */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:10}}>
            <KN label="Final Rate" val={`₹${r.finalRate.toFixed(2)}`} hl
              sub={+spec.qtyPerSet>1?`×${spec.qtyPerSet} nos/set = ₹${(r.finalRate*(+spec.qtyPerSet)).toFixed(2)}/set`:"MROUND 0.05 · excl GST"}/>
            <KN label="Rate/kg (landed)" val={`₹${r.ratePerKg.toFixed(2)}`} sub="Sheet Wt basis · incl freight"/>
            <KN label="Paper Consumed" val={`${(r.wt*1000).toFixed(0)} g`}
              sub={+spec.qtyPerSet>1
                ?`×${spec.qtyPerSet} = ${((r.wt*(+spec.qtyPerSet))*1000).toFixed(0)}g total · Sheet Wt: ${(r.wtSheet*1000).toFixed(0)}g`
                :`Sheet Wt (excl waste): ${(r.wtSheet*1000).toFixed(0)} g`}/>
            <KN label="Calc MOQ" val={r.calcMOQ.toLocaleString()}
              sub={spec.salesMOQ?`Sales: ${(+spec.salesMOQ).toLocaleString()} ${+spec.salesMOQ<r.calcMOQ?"⚠️ below min":"✅"}`:`${r.moqKg.toLocaleString()} kg`}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:10}}>
            <KN label="Deckle" val={r.deckle+"mm"}/>
            <KN label="Cutting" val={r.cutting+"mm"}/>
            <KN label="Calc BS" val={r.calcBS} sub={spec.spec_bs?`Std: ${spec.spec_bs}`:"no std set"}/>
            <KN label="Calc GSM" val={r.calcGSM} sub={spec.board_gsm?`Std: ${spec.board_gsm}`:"no std set"}/>
          </div>

          {/* Spec compliance */}
          {compliance.length>0&&<div style={{...card,padding:12,marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:700,color:C.slateM,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Specification Check</div>
            <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                {["Field","Std","Calc","Gap","Status","Action"].map(h=>(
                  <th key={h} style={{padding:"3px 7px",fontSize:9,color:C.slateL,
                    textTransform:"uppercase",textAlign:h==="Field"?"left":"center",fontWeight:600}}>{h}</th>))}
              </tr></thead>
              <tbody>{compliance.map((item,i)=>{
                const over=item.type==="over",high=item.severity==="high";
                const col=high?C.red:over?C.amberD:C.red;
                return<tr key={i} style={{background:i%2?C.cream:C.white}}>
                  <td style={{padding:"5px 7px",fontWeight:600,color:C.slateM}}>{item.field}</td>
                  <td style={{padding:"5px 7px",textAlign:"center",fontFamily:mono}}>{item.std} {item.unit}</td>
                  <td style={{padding:"5px 7px",textAlign:"center",fontFamily:mono}}>{item.calc} {item.unit}</td>
                  <td style={{padding:"5px 7px",textAlign:"center",fontWeight:700,color:col,fontFamily:mono}}>
                    {item.pct>0?"+":""}{item.pct}%</td>
                  <td style={{padding:"5px 7px",textAlign:"center"}}>
                    <span style={{background:high?C.redL:over?"#FFF8ED":C.redL,color:col,
                      padding:"2px 7px",borderRadius:10,fontSize:9,fontWeight:700}}>
                      {high?"❌ UNDER":over?"⚠️ OVER":"❌ UNDER"}</span></td>
                  <td style={{padding:"5px 7px",textAlign:"center",fontSize:10,color:over&&osSaving?C.green:C.slateL}}>
                    {over&&osSaving&&item.field.includes("Burst")
                      ?<><b>Save ₹{osSaving.saving}/box</b><br/><span style={{fontSize:9}}>{osSaving.note}</span></>
                      :high?"Upgrade needed":"Review"}
                  </td>
                </tr>;})}
              </tbody>
            </table>
          </div>}

          {/* Margin slider — min 0 */}
          <div style={{...card,padding:"10px 12px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:11,fontWeight:600,color:C.slateM,minWidth:50}}>Margin %</span>
              <input type="range" min={0} max={20} step={0.5} value={spec.margin}
                onChange={e=>s("margin",+e.target.value)} style={{flex:1,accentColor:C.amber}}/>
              <span style={{fontSize:15,fontWeight:800,color:C.amber,minWidth:34,textAlign:"right",fontFamily:mono}}>
                {spec.margin}%</span>
              <span style={{fontSize:13,fontWeight:700,color:C.slate,fontFamily:mono}}>→ ₹{r.finalRate.toFixed(2)}</span>
            </div>
            <div style={{display:"flex",gap:5,marginTop:7,flexWrap:"wrap",alignItems:"center"}}>
              {[0,6,8,10,12,15].map(m=><button key={m} onClick={()=>s("margin",m)}
                style={{padding:"3px 9px",borderRadius:5,fontSize:11,cursor:"pointer",
                  border:`1px solid ${+spec.margin===m?C.amber:C.border}`,
                  background:+spec.margin===m?C.amberL:C.white,
                  color:+spec.margin===m?C.amberD:C.slateL,fontWeight:+spec.margin===m?700:400}}>{m}%</button>)}
              {marginSugg.suggested!==+spec.margin&&(spec.customerType!=="existing"||spec.volume||spec.priceContext!=="unknown")&&(
                <button onClick={()=>s("margin",marginSugg.suggested)} style={{padding:"3px 10px",
                  borderRadius:5,fontSize:11,cursor:"pointer",border:`1px solid ${C.green}`,
                  background:C.greenL,color:C.green,fontWeight:700}}>
                  ✦ Suggested: {marginSugg.suggested}%</button>)}
            </div>
            {marginSugg.adjustments.length>0&&<div style={{marginTop:7,padding:"7px 9px",
              background:C.cream,borderRadius:5,fontSize:10,color:C.slateL,lineHeight:1.6}}>
              <b style={{color:C.slateM}}>Suggested: {marginSugg.suggested}%</b> — base 8%{marginSugg.adjustments.map(a=>" · "+a).join("")}
              {marginSugg.risk&&<span style={{marginLeft:6,color:C.amberD,fontWeight:600}}> {marginSugg.risk}</span>}
            </div>}
          </div>

          {/* Cost breakdown */}
          <div style={card}>
            <div style={{fontSize:10,fontWeight:700,color:C.slateM,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Cost Build-up</div>
            <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
              <tbody>
                {[["Material Cost (Paper Consumed)",r.mat],
                  ["Conversion",r.conv],
                  r.addOns>0&&[`Add-on Costs${(()=>{
                      const AL={printing:"Print",stitching:"Stitch",coating:"Coat",
                        handling:"Hdlg",moqCharge:"MOQ±",packing:"Pack",other:"Other",unloading:"Unload"};
                      const active=Object.entries(AL).filter(([k])=>spec[k]&&+spec[k]>0)
                        .map(([k,l])=>`${l} ₹${(+spec[k]).toFixed(2)}`);
                      return active.length?" ("+active.join("·")+")":"";
                    })()}`,r.addOns],
                  ["Interest",r.intC],
                  [`Freight (${r.frRate} Rs/kg)`,r.fr],
                  ["Margin ("+spec.margin+"%)",r.marginAmt]].filter(Boolean).map(([l,v])=>(
                  <tr key={l} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:"5px 0",color:C.slateM,fontSize:11}}>{l}</td>
                    <td style={{padding:"5px 0",textAlign:"right",fontWeight:600,fontFamily:mono,width:72}}>₹{(+(v??0)).toFixed(2)}</td>
                    <td style={{padding:"5px 0",textAlign:"right",fontFamily:mono,fontSize:10,color:C.amberD,width:60}}>
                      {r.wtSheet>0?`₹${(v/r.wtSheet).toFixed(2)}/kg`:"—"}</td>
                    <td style={{padding:"5px 0 5px 6px",width:80}}>
                      <div style={{height:4,borderRadius:2,background:C.paper}}>
                        <div style={{height:"100%",background:l.includes("Margin")?C.amber:C.slateM,borderRadius:2,
                          width:Math.min(100,v/r.finalRate*100).toFixed(0)+"%"}}/></div></td>
                    <td style={{padding:"5px 0",textAlign:"right",fontSize:10,color:C.slateL,width:28,fontFamily:mono}}>
                      {(v/r.finalRate*100).toFixed(0)}%</td>
                  </tr>))}
                <tr style={{borderTop:`2px solid ${C.amber}`}}>
                  <td style={{padding:"7px 0 3px",fontWeight:800,color:C.amber,fontSize:15,fontFamily:mono}} colSpan={2}>₹{r.finalRate.toFixed(2)}</td>
                  <td colSpan={2} style={{padding:"7px 0 3px",textAlign:"right",fontSize:10,color:C.slateL}}>LANDED RATE · excl GST</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Fluting BS Contribution Slider */}
          <div style={{...card,padding:"9px 12px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:11,fontWeight:600,color:C.slateM,minWidth:170}}>
                Fluting BS Contribution</span>
              <input type="range" min={0} max={30} step={1}
                value={Math.round((spec.flutingBCF!=null?spec.flutingBCF:0.10)*100)}
                onChange={e=>s("flutingBCF",+e.target.value/100)}
                style={{flex:1,accentColor:C.amber}}/>
              <span style={{fontSize:13,fontWeight:800,color:C.amber,minWidth:36,textAlign:"right",fontFamily:mono}}>
                {Math.round((spec.flutingBCF!=null?spec.flutingBCF:0.10)*100)}%</span>
            </div>
            <div style={{display:"flex",gap:5,marginTop:7}}>
              {[0,10,20,30].map(pct=>{
                const cur=Math.round((spec.flutingBCF!=null?spec.flutingBCF:0.10)*100);
                return<button key={pct} onClick={()=>s("flutingBCF",pct/100)}
                  style={{padding:"3px 9px",borderRadius:5,fontSize:11,cursor:"pointer",
                    border:`1px solid ${cur===pct?C.amber:C.border}`,
                    background:cur===pct?C.amberL:C.white,
                    color:cur===pct?C.amberD:C.slateL,fontWeight:cur===pct?700:400}}>
                  {pct}%</button>;})}
            </div>
            <div style={{fontSize:10,color:C.slateL,marginTop:5}}>
              Liner BCF = 1 always. Flute BCF = slider value. Formula: BS = Σ(BF_adj × BCF × GSM ÷ 1000).</div>
          </div>

          {/* Layer detail */}
          <div style={card}>
            <div style={{fontSize:10,fontWeight:700,color:C.slateM,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Layer Detail</div>
            <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                {["Layer","BF / Grade","GSM","TU","Paper Consumed","Sheet Wt","Rate","Cost"].map(h=>(
                  <th key={h} style={{padding:"3px 5px",fontSize:9,color:C.slateL,textTransform:"uppercase",
                    textAlign:h==="Layer"?"left":"center",fontWeight:600}}>{h}</th>))}
              </tr></thead>
              <tbody>{r.rowDetails.filter(x=>x.wt>0).map(x=>(
                <tr key={x.k} style={{borderBottom:`1px solid ${C.border}`}}>
                  <td style={{padding:"4px 5px",fontWeight:700,color:C.slateM,fontFamily:mono}}>{x.k}</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontFamily:mono}}>{x.code}</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontFamily:mono}}>{x.gsm}</td>
                  <td style={{padding:"4px 5px",textAlign:"center",color:C.slateL,fontFamily:mono}}>{x.tu?.toFixed(2)||"1.00"}</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontFamily:mono}}>{(x.wt*1000).toFixed(0)}g</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontFamily:mono,color:C.slateL}}>{(x.ws*1000).toFixed(0)}g</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontFamily:mono}}>₹{x.rate?.toFixed(2)}</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontWeight:700,fontFamily:mono}}>₹{x.cost?.toFixed(2)}</td>
                </tr>))}
                <tr style={{background:C.paper}}>
                  <td style={{padding:"4px 5px",fontWeight:700,fontSize:10,color:C.slateM}}>TOTAL</td>
                  <td style={{padding:"3px 5px",textAlign:"center",lineHeight:1.3}}>
                    <div style={{fontSize:8,color:C.slateL,textTransform:"uppercase"}}>Calc BS</div>
                    <div style={{fontWeight:800,fontFamily:mono,color:C.amber,fontSize:12}}>{r.calcBS}</div>
                  </td>
                  <td style={{padding:"3px 5px",textAlign:"center",lineHeight:1.3}}>
                    <div style={{fontSize:8,color:C.slateL,textTransform:"uppercase"}}>Calc GSM</div>
                    <div style={{fontWeight:800,fontFamily:mono,color:C.slateM,fontSize:12}}>{r.calcGSM}</div>
                  </td>
                  <td/>
                  <td style={{padding:"4px 5px",textAlign:"center",fontWeight:700,fontFamily:mono}}>{(r.wt*1000).toFixed(0)}g</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontWeight:700,fontFamily:mono,color:C.slateL}}>{(r.wtSheet*1000).toFixed(0)}g</td>
                  <td/>
                  <td style={{padding:"4px 5px",textAlign:"center",fontWeight:700,fontFamily:mono}}>₹{(r.mat||0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>}

      </div>
    </div>
  );

  // ── QUOTE ITEMS TAB ───────────────────────────────────────────────────────

  // ── BATCH ENTRY TAB ───────────────────────────────────────────────────────
  const STATUS_DISPLAY={
    "incomplete":{icon:"🔴",label:"Incomplete",col:C.red},
    "draft-uncalc":{icon:"⚪",label:"Not calculated",col:C.slateL},
    "stale":{icon:"🔄",label:"Stale — recalculate",col:"#E8830A"},
    "draft":{icon:"🟡",label:"Draft",col:C.amberD},
    "reviewed":{icon:"🟢",label:"Reviewed",col:C.green},
    "override":{icon:"🔵",label:"Override",col:"#2E6094"},
    "spec-gap":{icon:"⚠️",label:"Spec gap",col:C.red},
  };
  // Spec-derived construction name — includes all applicable output parameters
  // Format: [Ply][Flutes] · [ActiveSpecs: GSM/BS/BCT/ECT/Cobb] · [PaperGrades/GSM layers]
  const constrAutoName=(c)=>{
    const ply=c.ply||5;
    const flutes=`${c.flute_F1||'B'}${ply===5&&c.flute_F2?c.flute_F2:''}`;
    const bfLayers=[c.layers?.TOP?.code,c.layers?.F1?.code,c.layers?.L1?.code,
      ...(ply===5?[c.layers?.F2?.code,c.layers?.L2?.code]:[])].filter(Boolean);
    const bfStr=bfLayers.length?bfLayers.join('/'):'—';
    // Layer GSM summary e.g. 180/150/180/150/180
    const gsmLayers=[c.layers?.TOP?.gsm,c.layers?.F1?.gsm,c.layers?.L1?.gsm,
      ...(ply===5?[c.layers?.F2?.gsm,c.layers?.L2?.gsm]:[])].filter(Boolean);
    const gsmStr=gsmLayers.length?gsmLayers.join('/'):null;
    const gradesGSM=[bfStr,gsmStr].filter(Boolean).join(' ');
    // Active specs (board-level)
    const gsm=c.board_gsm&&+c.board_gsm>0?`${+c.board_gsm}gsm`:'';
    const bs=c.spec_bs&&+c.spec_bs>0?`BS${(+c.spec_bs).toFixed(1)}`:'';
    const bct=c.spec_bct&&+c.spec_bct>0?`BCT${(+c.spec_bct).toFixed(0)}`:'';
    const ect=c.spec_ect&&+c.spec_ect>0?`ECT${(+c.spec_ect).toFixed(1)}`:'';
    const cobb=c.spec_cobb&&+c.spec_cobb>0?`Cobb≤${+c.spec_cobb}`:'';
    const specs=[gsm,bs,bct,ect,cobb].filter(Boolean).join(' ');
    // Order: [ply+flutes] · [active specs] · [grades+gsm layers]
    return [`${ply}p${flutes}`,specs,gradesGSM].filter(Boolean).join(' · ');
  };

  const batchEntryTab=(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {/* ── BATCH PROFILE BAR — compact 3-section card + action column ─────── */}
      <div style={{background:"#FEF8F0",borderBottom:`2px solid ${C.amber}`,
        padding:"4px 12px 4px",flexShrink:0,display:"flex",gap:8,alignItems:"stretch"}}>

        {/* ── SECTION LABEL ── */}
        <div style={{display:"flex",alignItems:"center",marginRight:2}}>
          <span style={{color:C.amber,fontWeight:800,fontSize:10,textTransform:"uppercase",
            letterSpacing:"0.1em",writingMode:"vertical-rl",transform:"rotate(180deg)",
            whiteSpace:"nowrap"}}>Batch Profile</span>
        </div>

        {/* ── 1. CUSTOMER DETAILS — 3 × 2 grid (label | field) ── */}
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,
          padding:"4px 8px 4px 4px",display:"flex",flexDirection:"row",gap:6,alignItems:"stretch"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",width:14,flexShrink:0}}>
            <span style={{color:C.amber,fontWeight:700,fontSize:7.5,textTransform:"uppercase",
              letterSpacing:"0.12em",writingMode:"vertical-rl",transform:"rotate(180deg)",
              whiteSpace:"nowrap"}}>Customer</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto 1fr",
            columnGap:5,rowGap:3,alignItems:"center"}}>
            {/* Row 1: Client | Sector */}
            <span style={{fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"}}>Client</span>
            <input value={batchProfile.client||""} onChange={e=>setBatchProfile(p=>({...p,client:e.target.value}))}
              style={{padding:"2px 6px",borderRadius:3,border:`1px solid ${C.border}`,
                fontSize:10,background:C.white,color:C.slate,width:90,minWidth:0}}/>
            <span style={{fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"}}>Sector</span>
            <select value={batchProfile.sector||""} onChange={e=>{
                const v=e.target.value;
                const sd=sectors.find(x=>x.code===v);
                setBatchProfile(p=>({...p,sector:v,
                  waste:sd?sd.wasteCBB:5,convRate:sd?sd.convBox:7,
                  wastePP:sd?sd.wastePP:5,convRatePP:sd?sd.convPP:12.5,
                }));
              }} style={{padding:"2px 4px",borderRadius:3,border:`1px solid ${C.border}`,
                fontSize:9,background:C.white,color:C.slate,cursor:"pointer",minWidth:0,width:90}}>
              <option value="">— select —</option>
              {sectorCodes.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            {/* Row 2: Plant | Delivery */}
            <span style={{fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"}}>Plant</span>
            <select value={batchProfile.plant||""} onChange={e=>{
                const nv=e.target.value;
                setBatchProfile(p=>{
                  const newP={...p,plant:nv};
                  const fr=freight?.[nv]?.[p.delivery];
                  if(fr!==undefined) newP.freightOverride=fr;
                  return newP;
                });
              }} style={{padding:"2px 4px",borderRadius:3,border:`1px solid ${C.border}`,
                fontSize:9,background:C.white,color:C.slate,cursor:"pointer",minWidth:0,width:90}}>
              <option value="">— select —</option>
              {PLANTS.map(o=><option key={o} value={o}>{o}</option>)}
            </select>
            <span style={{fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"}}>Delivery</span>
            <select value={batchProfile.delivery||""} onChange={e=>{
                const nv=e.target.value;
                setBatchProfile(p=>{
                  const newP={...p,delivery:nv};
                  const fr=freight?.[p.plant]?.[nv];
                  if(fr!==undefined) newP.freightOverride=fr;
                  return newP;
                });
              }} style={{padding:"2px 4px",borderRadius:3,border:`1px solid ${C.border}`,
                fontSize:9,background:C.white,color:C.slate,cursor:"pointer",minWidth:0,width:90}}>
              <option value="">— select —</option>
              {locations.map(o=><option key={o} value={o}>{o}</option>)}
            </select>
            {/* Row 3: Cust Type | Price Context */}
            <span style={{fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"}}>Cust Type</span>
            <select value={batchProfile.customerType||'existing'}
              onChange={e=>setBatchProfile(p=>({...p,customerType:e.target.value}))}
              style={{padding:"2px 4px",borderRadius:3,border:`1px solid ${C.border}`,
                fontSize:9,background:C.white,color:C.slate,cursor:"pointer",minWidth:0,width:90}}>
              <option value="existing">Existing</option>
              <option value="new">New</option>
              <option value="strategic">Strategic</option>
              <option value="spot">Spot</option>
            </select>
            <span style={{fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"}}>Price Ctx</span>
            <select value={batchProfile.priceContext||'unknown'}
              onChange={e=>setBatchProfile(p=>({...p,priceContext:e.target.value}))}
              style={{padding:"2px 4px",borderRadius:3,border:`1px solid ${C.border}`,
                fontSize:9,background:C.white,color:C.slate,cursor:"pointer",minWidth:0,width:90}}>
              <option value="unknown">Unknown</option>
              <option value="sensitive">Sensitive</option>
              <option value="premium">Premium</option>
              <option value="tender">Tender</option>
            </select>
          </div>
        </div>

        {/* ── 2. COMMERCIALS — header row + 2 data rows ── */}
        {(()=>{
          const sd=sectors.find(x=>x.code===batchProfile.sector);
          const defConvBox=sd?sd.convBox:7;
          const defConvPP=sd?sd.convPP:12.5;
          const defWstBox=sd?sd.wasteCBB:5;
          const defWstPP=sd?sd.wastePP:5;
          const isOvr=(key,def)=>{const v=batchProfile[key];return v!==undefined&&v!==null&&v!==''&&+v!==def;};
          const numField=(key,_w,def,step)=>{
            const ovr=isOvr(key,def);
            return<input type="number" step={step||0.25} value={batchProfile[key]??""}
              onChange={e=>{
                const raw=e.target.value;
                // Fix ②: blank on ANY numField (margin, waste, conv) must restore to sector default.
                // Previously only margin/marginPP were guarded — waste/conv went to 0 when cleared.
                if(raw===""||raw===null){setBatchProfile(p=>({...p,[key]:def}));return;}
                setBatchProfile(p=>({...p,[key]:+raw}));
              }}
              title={ovr?`Overriding sector default (${def})`:`Sector default: ${def}`}
              style={{width:"100%",padding:"2px 3px",borderRadius:3,textAlign:"center",
                boxSizing:"border-box",minWidth:0,
                border:`1px solid ${ovr?C.amber:C.border}`,
                background:ovr?"#FFF8ED":C.white,fontSize:10,color:C.slate}}/>;
          };
          const hdr={fontSize:8,fontWeight:700,color:C.slateL,textAlign:"center",textTransform:"uppercase",letterSpacing:"0.04em"};
          const lbl={fontSize:9,fontWeight:700,color:C.slateL,whiteSpace:"nowrap"};
          return(
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,
            padding:"4px 8px 4px 4px",display:"flex",flexDirection:"row",gap:6,alignItems:"stretch"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",width:14,flexShrink:0}}>
              <span style={{color:C.amber,fontWeight:700,fontSize:7.5,textTransform:"uppercase",
                letterSpacing:"0.12em",writingMode:"vertical-rl",transform:"rotate(180deg)",
                whiteSpace:"nowrap"}}>Commercials</span>
            </div>
            {/* Header + data rows grid — relative columns, 5px gap */}
            <div style={{display:"grid",gridTemplateColumns:"24px 1fr 1fr 1fr",
              columnGap:5,rowGap:2,alignItems:"center",minWidth:0}}>
              <div style={hdr}/>
              <div style={hdr}>Conv</div>
              <div style={hdr}>Wst%</div>
              <div style={hdr}>Mgn%</div>
              {/* Box row */}
              <div style={lbl}>Box</div>
              {numField("convRate",50,defConvBox)}
              {numField("waste",48,defWstBox)}
              {numField("margin",46,8)}
              {/* PP row */}
              <div style={lbl}>PP</div>
              {numField("convRatePP",50,defConvPP)}
              {numField("wastePP",48,defWstPP)}
              {numField("marginPP",46,8)}
            </div>
          </div>);
        })()}

        {/* ── 3. TERMS — Freight + Payment·Interest ── */}
        {(()=>{
          const _matrixFr=freight?.[batchProfile.plant]?.[batchProfile.delivery]??0;
          const _isOvr=batchProfile.freightOverride!==''&&batchProfile.freightOverride!==undefined;
          const _displayFr=_isOvr?batchProfile.freightOverride:_matrixFr;
          const DISC_MAP={"30":"0.5%","45":"0.75%","60":"1.0%","90":"1.5%"};
          const lbl={fontSize:9,fontWeight:700,color:C.slateL,whiteSpace:"nowrap"};
          return(
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,
            padding:"4px 8px 4px 4px",display:"flex",flexDirection:"row",gap:6,alignItems:"stretch"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",width:14,flexShrink:0}}>
              <span style={{color:C.amber,fontWeight:700,fontSize:7.5,textTransform:"uppercase",
                letterSpacing:"0.12em",writingMode:"vertical-rl",transform:"rotate(180deg)",
                whiteSpace:"nowrap"}}>Terms</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"auto 1fr",
              columnGap:8,rowGap:4,alignItems:"center"}}>
              {/* Freight */}
              <span style={lbl}>Freight</span>
              <div style={{display:"flex",alignItems:"center",gap:3}}>
                <input type="number" step="0.25" min="0" value={_displayFr}
                  onChange={e=>{
                    const v=e.target.value;
                    const n=v===''?'':+v;
                    const isManual=v!==''&&+v!==_matrixFr;
                    setBatchProfile(p=>({...p,freightOverride:isManual?n:''}));
                  }}
                  style={{width:44,padding:"2px 4px",borderRadius:3,textAlign:"center",
                    border:`1px solid ${_isOvr?C.amber:C.border}`,
                    background:_isOvr?"#FFF8ED":C.white,fontSize:10,color:C.slate}}
                  title={`Freight Rs/kg — matrix: ${_matrixFr}${_isOvr?" | OVERRIDDEN":""}`}/>
                <span style={{fontSize:8,color:C.slateL}}>Rs/kg</span>
              </div>
              {/* Payment Terms → Interest (linked) */}
              <span style={lbl} title="Payment Terms → auto-sets Interest %">PT · Int</span>
              <select value={batchProfile.paymentDisc||"30"}
                onChange={e=>{
                  const m={"30":0.5,"45":0.75,"60":1.0,"90":1.5};
                  setBatchProfile(p=>({...p,paymentDisc:e.target.value,interest:m[e.target.value]||1.5}));
                }}
                style={{padding:"2px 4px",borderRadius:3,border:`1px solid ${C.border}`,
                  fontSize:9,background:C.white,color:C.slate,cursor:"pointer"}}
                title={`Interest auto-set: ${DISC_MAP[batchProfile.paymentDisc||"30"]}`}>
                <option value="30">≤30d · 0.5%</option>
                <option value="45">≤45d · 0.75%</option>
                <option value="60">≤60d · 1.0%</option>
                <option value="90">≤90d · 1.5%</option>
              </select>
            </div>
          </div>);
        })()}

        {/* ── 4. ACTIONS — Import + New Batch ── */}
        <div style={{display:"flex",flexDirection:"column",gap:4,
          justifyContent:"center",marginLeft:"auto",flexShrink:0}}>
          <div style={{border:`1px solid ${C.border}`,borderRadius:6,
            padding:"4px 7px",background:C.white}}>
            <div style={{fontSize:7.5,color:C.slateL,fontWeight:700,textTransform:"uppercase",
              letterSpacing:"0.06em",textAlign:"center",marginBottom:3}}>Import from Costing</div>
            <div style={{display:"flex",gap:4}}>
              <button onClick={()=>{
                  // C11: block Profile import when Costing is in scratchpad context and old batch exists
                  if(costingContext==="new-batch"&&batchRows.length>0){
                    showToast("❌ Scratchpad context — cannot overwrite the existing Batch Profile.\n\nUse Batch Entry → + New Batch to clear the old batch first.",'error',6000);
                    return;
                  }
                  const isBoxRow=!spec.rowType||spec.rowType==="Box";
                  const srcMargin=typeof spec.margin==="number"?spec.margin:8;
                  const srcInterest=typeof spec.interest==="number"?spec.interest:0.5;
                  setBatchProfile(p=>({...p,
                    client:spec.client||p.client,sector:spec.sector||p.sector,
                    plant:spec.plant||p.plant,delivery:spec.delivery||p.delivery,
                    margin:isBoxRow?srcMargin:(typeof p.margin==="number"?p.margin:8),
                    marginPP:!isBoxRow?srcMargin:(typeof p.marginPP==="number"?p.marginPP:8),
                    interest:srcInterest,
                    paymentDisc:spec.paymentDisc||p.paymentDisc,
                    freightOverride:spec.freightOverride||p.freightOverride,
                    waste:spec.waste??p.waste??5,convRate:spec.convRate??p.convRate??7,
                    wastePP:spec.wastePP??p.wastePP??5,convRatePP:spec.convRatePP??p.convRatePP??12.5,
                    customerType:spec.customerType||p.customerType||'existing',
                    priceContext:spec.priceContext||p.priceContext||'unknown',
                  }));
                  showToast(isBoxRow?"✅ Box profile imported":"✅ PP profile imported",'success');
                }}
                style={{flex:1,padding:"4px 0",borderRadius:4,border:"none",
                  background:"#2E6094",color:C.white,fontSize:10,fontWeight:600,cursor:"pointer"}}>
                ↓ Profile
              </button>
              <button onClick={importConstrFromSpec}
                style={{flex:1,padding:"4px 0",borderRadius:4,border:"none",
                  background:C.amber,color:C.white,fontSize:10,fontWeight:600,cursor:"pointer"}}>
                + Constr
              </button>
            </div>
          </div>
          <button onClick={()=>{
            // Fix 5: also clear Quote Items on New Batch so prior customer's data cannot leak
          if(!window.confirm("Start a new batch? This will clear the current profile, all SKU rows, results, and Quote Items."))return;
            const fresh={client:'',sector:'',plant:'',delivery:'',
              margin:8,marginPP:8,interest:0.5,paymentDisc:'30',freightOverride:'',
              waste:5,convRate:7,wastePP:5,convRatePP:12.5,
              customerType:'existing',priceContext:'unknown'};
            setBatchProfile(fresh);
            setBatchRows([]);
            setBatchResults({});
            setExpandedRows(new Set());
            setActiveBatchRowId(null);
            setSpecCommitted(false); // Costing identity fields become editable again
            setItems([]); // Fix 5: clear Quote Items so new customer starts clean
            // Batch Entry cleared → Costing re-attaches to the now-empty batch (same-batch context)
            // Also reset Costing spec so the panel reflects the fresh state immediately
            setCostingContext("same-batch");
            setSpec({...INIT_SPEC,plant:"",delivery:""});
            setSetAutoFill(true);
            showToast("✅ New batch started — Quote Items cleared",'success');
          }} style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${C.amber}`,
            background:C.white,color:C.amber,fontSize:10,fontWeight:700,cursor:"pointer",
            textAlign:"center"}}>
            + New Batch
          </button>
        </div>

      </div>

      {/* ── Batch Entry Slide-Over Overlay: Construction Library ── */}
      {batchConstrOverlay&&(()=>{
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
      })()}

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
                            // Confirm handler: clears assumed flag, triggers auto-dims + Glass SKU fill
                            const handleConfirm=()=>{
                              upd("setCodeAssumed",false);
                              // Glass SKU auto-fill for ALCOBEV Part-L / Part-W rows
                              if(batchProfile.sector==="ALCOBEV"&&(row.itemType==="Part-L"||row.itemType==="Part-W")){
                                const confirmedSetCode=(row.setCode||"").trim();
                                const parentBox=batchRows.find(r=>
                                  r.itemType==="Box"&&!r.setCodeAssumed&&(r.setCode||"").trim()===confirmedSetCode);
                                if(parentBox&&parentBox.glassSKUType){
                                  const pm=partitionsMaster.find(x=>x.skuType===parentBox.glassSKUType);
                                  if(pm){
                                    const nos=row.itemType==="Part-L"?pm.lwise:pm.wwise;
                                    updC("nosPerSet",nos); // row-scoped: nosPerSet changes this row's SET rate
                                    showToast(`🍶 Nos/Set auto-filled: ${nos} (${parentBox.glassSKUType})`,'success',3000);
                                  }
                                } else if(parentBox&&!parentBox.glassSKUType){
                                  showToast(`⚠️ Glass SKU Type not yet set on the parent Box — set it first to auto-fill Nos/Set`,'info',5000);
                                }
                              }
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
                              title={`${isPP?"PP":"Box"} Waste% — profile default: ${profVal}%${isOvr?" | OVERRIDDEN":""}`}
                              style={{width:44,padding:"2px 4px",border:`1px solid ${isOvr?C.amber:C.border}`,
                                borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                                background:isOvr?"#FFF8ED":C.white}}/>;
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
                              title={`${isPP?"PP":"Box"} Conv Rs/kg — profile default: ${profVal}${isOvr?" | OVERRIDDEN":""}`}
                              style={{width:50,padding:"2px 4px",border:`1px solid ${isOvr?C.amber:C.border}`,
                                borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                                background:isOvr?"#FFF8ED":C.white}}/>;
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
                                  (r.setCode||"").trim()===(row.setCode||"").trim());
                                return(
                                <div style={{minWidth:160}}>
                                  <div style={{fontSize:9,color:"#2E6094",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>
                                    🍶 Glass SKU Type</div>
                                  <div style={{fontSize:11,color:parentBox?.glassSKUType?"#2E6094":C.slateL,
                                    padding:"3px 8px",border:"1px solid #6A9FD433",borderRadius:4,background:"#EEF4FB"}}>
                                    {parentBox?.glassSKUType||"— set on Main Box row —"}
                                  </div>
                                  <div style={{fontSize:9,color:C.slateL,marginTop:2}}>
                                    Nos/Set: <b style={{color:C.amber}}>{row.nosPerSet||1}</b>
                                    {parentBox?.glassSKUType&&" (inherited from Main Box)"}
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
                                      title={`Profile default: ${profInt}%${isIntOvr?" | OVERRIDDEN":""}`}
                                      style={{width:52,padding:"2px 4px",border:`1px solid ${isIntOvr?C.amber:C.border}`,
                                        borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                                        background:isIntOvr?"#FFF8ED":C.white}}/>
                                    {isIntOvr&&<button onClick={()=>updC("interestOverride","")}
                                      style={{background:"none",border:"none",color:C.slateL,cursor:"pointer",fontSize:10}}>✕</button>}
                                  </div>
                                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                                    <span style={{fontSize:9,color:C.slateL,minWidth:68}}>Freight Rs/kg</span>
                                    <input type="number" step="0.25" value={row.freightRowOverride??""}
                                      placeholder={String(profFr)}
                                      onChange={e=>updC("freightRowOverride",e.target.value===""?"":+e.target.value)}
                                      title={`Profile freight: ${profFr}${isFrOvr?" | OVERRIDDEN":""}`}
                                      style={{width:52,padding:"2px 4px",border:`1px solid ${isFrOvr?C.amber:C.border}`,
                                        borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                                        background:isFrOvr?"#FFF8ED":C.white}}/>
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
    </div>
  );
  // ── end batchEntryTab ─────────────────────────────────────────────────────

  // ── CONSTRUCTION LIBRARY TAB ─────────────────────────────────────────────
  const constructionLibTab=(()=>{
    // Filter logic for the full tab
    const applyClTabFilter=c=>{
      if(clTabFilter.status!=='all'&&(c.status||'active')!==clTabFilter.status)return false;
      if(clTabFilter.sector&&(c.sector||'')!==clTabFilter.sector)return false;
      if(clTabFilter.client&&(c.client||'')!==clTabFilter.client)return false;
      if(clTabFilter.gsm_min&&+c.board_gsm<+clTabFilter.gsm_min)return false;
      if(clTabFilter.gsm_max&&+c.board_gsm>+clTabFilter.gsm_max)return false;
      if(clTabFilter.bs_min&&+c.spec_bs<+clTabFilter.bs_min)return false;
      if(clTabFilter.bct_min&&+c.spec_bct<+clTabFilter.bct_min)return false;
      if(clTabFilter.ect_min&&+c.spec_ect<+clTabFilter.ect_min)return false;
      if(clTabFilter.cobb_max&&c.spec_cobb&&+c.spec_cobb>+clTabFilter.cobb_max)return false;
      // text search
      if(clTabQuery){
        const q=clTabQuery.toLowerCase();
        const autoN=constrAutoName(c).toLowerCase();
        if(!c.code.toLowerCase().includes(q)&&!autoN.includes(q)&&
           !(c.name||'').toLowerCase().includes(q)&&
           !(c.sector||'').toLowerCase().includes(q)&&
           !(c.client||'').toLowerCase().includes(q))return false;
      }
      return true;
    };
    const filtered=constructionLib.filter(applyClTabFilter);
    const activeCount=constructionLib.filter(c=>(c.status||'active')==='active').length;
    const archivedCount=constructionLib.filter(c=>(c.status||'active')==='archived').length;
    const hasFilter=clTabFilter.status!=='active'||clTabFilter.sector||clTabFilter.client||
      clTabFilter.gsm_min||clTabFilter.gsm_max||clTabFilter.bs_min||clTabFilter.bct_min||
      clTabFilter.ect_min||clTabFilter.cobb_max||clTabQuery;
    return(
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      {/* LEFT SIDEBAR: Filters + Stats */}
      <div style={{width:240,flexShrink:0,borderRight:`1px solid ${C.border}`,overflowY:"auto",
        padding:"14px 12px",background:C.cream,display:"flex",flexDirection:"column",gap:8}}>
        <div style={{fontSize:13,fontWeight:700,color:C.slate}}>Construction Library</div>
        {/* Stats strip */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
          {[["Total",constructionLib.length,C.slateM],["Active",activeCount,C.green],
            ["Archived",archivedCount,C.slateL],
            ["Sectors",[...new Set(constructionLib.map(c=>c.sector||'').filter(Boolean))].length,C.amber]].map(([l,v,col])=>(
            <div key={l} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 10px",textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:800,color:col,fontFamily:mono}}>{v}</div>
              <div style={{fontSize:9,color:C.slateL,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
            </div>))}
        </div>
        {/* Search */}
        <div style={{position:"relative"}}>
          <input value={clTabQuery} onChange={e=>setClTabQuery(e.target.value)}
            placeholder="Search code, name, sector, client…"
            style={{width:"100%",padding:"5px 22px 5px 8px",border:`1px solid ${clTabQuery?C.amber:C.border}`,
              borderRadius:5,fontSize:11,boxSizing:"border-box"}}/>
          {clTabQuery&&<button onClick={()=>setClTabQuery('')}
            style={{position:"absolute",right:4,top:"50%",transform:"translateY(-50%)",
              background:"none",border:"none",cursor:"pointer",fontSize:11,color:C.slateL}}>✕</button>}
        </div>
        {/* Status filter */}
        <div>
          <div style={{fontSize:9,fontWeight:700,color:C.slateL,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Status</div>
          <div style={{display:"flex",gap:3}}>
            {["active","archived","all"].map(s=>(
              <button key={s} onClick={()=>setClTabFilter(p=>({...p,status:s}))}
                style={{flex:1,padding:"3px 0",borderRadius:4,fontSize:10,fontWeight:600,cursor:"pointer",
                  border:`1px solid ${clTabFilter.status===s?C.amber:C.border}`,
                  background:clTabFilter.status===s?C.amber:C.white,
                  color:clTabFilter.status===s?C.white:C.slateL,textTransform:"capitalize"}}>
                {s}</button>))}
          </div>
        </div>
        {/* Sector */}
        <div>
          <div style={{fontSize:9,fontWeight:700,color:C.slateL,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Sector</div>
          <select value={clTabFilter.sector||''} onChange={e=>setClTabFilter(p=>({...p,sector:e.target.value,client:''}))}
            style={{width:"100%",padding:"4px 6px",border:`1px solid ${clTabFilter.sector?C.amber:C.border}`,borderRadius:4,fontSize:11,color:C.slate,background:C.white}}>
            <option value="">All Sectors</option>
            {[...new Set(constructionLib.map(c=>c.sector||'').filter(Boolean))].sort()
              .map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {/* Client */}
        <div>
          <div style={{fontSize:9,fontWeight:700,color:C.slateL,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Client</div>
          <select value={clTabFilter.client||''} onChange={e=>setClTabFilter(p=>({...p,client:e.target.value}))}
            style={{width:"100%",padding:"4px 6px",border:`1px solid ${clTabFilter.client?C.amber:C.border}`,borderRadius:4,fontSize:11,color:C.slate,background:C.white}}>
            <option value="">All Clients</option>
            {[...new Set(constructionLib
              .filter(c=>!clTabFilter.sector||(c.sector||'')===clTabFilter.sector)
              .map(c=>c.client||'').filter(Boolean))].sort()
              .map(cl=><option key={cl} value={cl}>{cl}</option>)}
          </select>
        </div>
        {/* Spec range filters */}
        <div>
          <div style={{fontSize:9,fontWeight:700,color:C.slateL,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Spec Ranges</div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {[["gsm_min","GSM ≥"],["gsm_max","GSM ≤"],["bs_min","BS ≥"],
              ["bct_min","BCT ≥"],["ect_min","ECT ≥"],["cobb_max","Cobb ≤"]].map(([k,lbl])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:9,color:C.slateL,minWidth:52}}>{lbl}</span>
                <input type="number" step={0.25} value={clTabFilter[k]||''}
                  onChange={e=>setClTabFilter(p=>({...p,[k]:e.target.value}))}
                  style={{flex:1,padding:"3px 5px",border:`1px solid ${clTabFilter[k]?C.amber:C.border}`,
                    borderRadius:4,fontSize:10,textAlign:"center"}}/>
              </div>))}
          </div>
        </div>
        {hasFilter&&<button onClick={()=>{setClTabFilter({sector:'',client:'',status:'active'});setClTabQuery('');}}
          style={{padding:"4px",borderRadius:5,border:`1px solid ${C.red}33`,
            background:"transparent",color:C.red,fontSize:10,cursor:"pointer",fontWeight:600}}>
          ✕ Clear all filters
        </button>}
        <div style={{fontSize:9,color:C.slateL,borderTop:`1px solid ${C.border}`,paddingTop:6,marginTop:4}}>
          {filtered.length}/{constructionLib.length} shown
        </div>
      </div>

      {/* RIGHT: Library entries */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Toolbar */}
        <div style={{padding:"8px 16px",borderBottom:`1px solid ${C.border}`,
          display:"flex",gap:8,alignItems:"center",background:C.cream,flexShrink:0}}>
          <button onClick={()=>{
            // Fix 14: first unused letter, not array.length — prevents code reuse after deletions
            const _LETTERS="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const _used=new Set(constructionLib.map(c=>c.code));
            const code=_LETTERS.split("").find(l=>!_used.has(l))||`C${constructionLib.length}`;
            const newEntry={code,name:"",boxType:"RSC",ply:5,
              flute_F1:"B",flute_F2:"A",
              layers:{TOP:{code:"",gsm:""},F1:{code:"",gsm:""},
                L1:{code:"",gsm:""},F2:{code:"",gsm:""},L2:{code:"",gsm:""}},
              waste:null,convRate:null,wastePP:null,convRatePP:null,
              sector:batchProfile.sector||"",client:batchProfile.client||"",status:"active",
              mill_preferences:{TOP:{grade:"",mill:""},F1:{grade:"",mill:""},L1:{grade:"",mill:""},
                F2:{grade:"",mill:""},L2:{grade:"",mill:""}}};
            setConstructionLib(prev=>[...prev,newEntry]);
            setClTabExpandedConstr(String(constructionLib.length));
            setClTabFilter({sector:'',client:'',status:'active'});
            setClTabQuery('');
          }} style={{padding:"5px 14px",borderRadius:6,border:"none",
            background:C.green,color:C.white,fontSize:12,fontWeight:700,cursor:"pointer"}}>
            + New Construction
          </button>
          <button onClick={()=>{
            // ── Duplicate check: exact match on all 5 STDs + Sector ──────────
            // If an existing construction matches on board_gsm, spec_bs, spec_bct,
            // spec_ect, spec_cobb AND sector, it is the same construction regardless
            // of client. Prompt user to add client to the existing entry instead.
            const incomingSector=spec.sector||batchProfile.sector||"";
            const toStr=v=>(v===undefined||v===null||v===""?"":String(v).trim());
            const duplicate=constructionLib.find(c=>
              toStr(c.board_gsm)===toStr(spec.board_gsm)&&
              toStr(c.spec_bs)===toStr(spec.spec_bs)&&
              toStr(c.spec_bct)===toStr(spec.spec_bct)&&
              toStr(c.spec_ect)===toStr(spec.spec_ect)&&
              toStr(c.spec_cobb)===toStr(spec.spec_cobb)&&
              toStr(c.sector)===toStr(incomingSector)
            );
            if(duplicate){
              const incomingClient=spec.client||batchProfile.client||"";
              const existingClient=duplicate.client||"";
              const msg=incomingClient&&incomingClient!==existingClient
                ?`A construction with identical STDs (GSM: ${duplicate.board_gsm||"—"}, BS: ${duplicate.spec_bs||"—"}, BCT: ${duplicate.spec_bct||"—"}, ECT: ${duplicate.spec_ect||"—"}, Cobb: ${duplicate.spec_cobb||"—"}) and sector "${duplicate.sector||"—"}" already exists as [${duplicate.code}].\n\nClient identity is not a reason to create a duplicate construction.\n\nClick OK to add "${incomingClient}" to existing [${duplicate.code}]'s client field instead.`
                :`A construction with identical STDs and sector already exists as [${duplicate.code}].\n\nNo duplicate will be created.`;
              if(incomingClient&&incomingClient!==existingClient){
                if(window.confirm(msg)){
                  // Add incoming client to existing construction's client field
                  const mergedClient=existingClient?`${existingClient}, ${incomingClient}`:incomingClient;
                  setConstructionLib(prev=>prev.map(c=>c.code===duplicate.code?{...c,client:mergedClient}:c));
                  // Expand the existing entry so user can review
                  const idx=constructionLib.findIndex(c=>c.code===duplicate.code);
                  setClTabExpandedConstr(String(idx));
                  setClTabFilter({sector:'',client:'',status:'active'});
                  setClTabQuery('');
                  showToast(`✅ Client "${incomingClient}" added to existing [${duplicate.code}]`,'success',4000);
                }
              } else {
                window.alert(msg);
                // Highlight the existing entry
                const idx=constructionLib.findIndex(c=>c.code===duplicate.code);
                setClTabExpandedConstr(String(idx));
              }
              return; // always stop — never create the duplicate
            }
            // ── No duplicate — proceed with import ───────────────────────────
            // Fix 14: first unused letter, not array.length
            const _ltrs="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const _usedC=new Set(constructionLib.map(c=>c.code));
            const nextCode=_ltrs.split("").find(l=>!_usedC.has(l))||`C${constructionLib.length}`;
            const newConstr={
              code:nextCode,name:"",
              boxType:spec.boxType||"RSC",ply:spec.ply||5,
              flute_F1:spec.flute_F1||"B",flute_F2:spec.flute_F2||"A",
              layers:JSON.parse(JSON.stringify(spec.layers||{})),
              board_gsm:spec.board_gsm||"",spec_bs:spec.spec_bs||"",
              spec_bct:spec.spec_bct||"",spec_ect:spec.spec_ect||"",
              waste:null,convRate:null,wastePP:null,convRatePP:null,
              sector:incomingSector,
              client:spec.client||batchProfile.client||"",
              status:"active",
              mill_preferences:{TOP:{grade:"",mill:""},F1:{grade:"",mill:""},L1:{grade:"",mill:""},
                F2:{grade:"",mill:""},L2:{grade:"",mill:""}},
            };
            setConstructionLib(prev=>[...prev,newConstr]);
            setClTabExpandedConstr(String(constructionLib.length));
            showToast(`✅ Imported as [${nextCode}] — review and save`,'success');
          }} style={{padding:"5px 14px",borderRadius:6,border:`1px solid ${C.amber}`,
            background:C.amberL,color:C.amberD,fontSize:12,fontWeight:700,cursor:"pointer"}}>
            ↓ Import from Costing
          </button>
          <div style={{fontSize:11,color:C.slateL,marginLeft:4}}>
            {constructionLib.length===0?"Library is empty — create your first construction."
              :`${filtered.length} construction${filtered.length!==1?"s":""} shown`}
          </div>
        </div>

        {/* Scrollable entries */}
        <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
          {constructionLib.length===0&&(
            <div style={{textAlign:"center",padding:"40px 0",color:C.slateL}}>
              <div style={{fontSize:32,marginBottom:10}}>🏗</div>
              <div style={{fontSize:14,fontWeight:600,color:C.slateM,marginBottom:6}}>No constructions yet</div>
              <div style={{fontSize:12}}>Click "+ New Construction" above to build your first construction profile,<br/>
                or switch to Costing tab, set up a paper construction, then click "↓ Import from Costing".</div>
            </div>)}

          {filtered.length===0&&constructionLib.length>0&&(
            <div style={{textAlign:"center",padding:"32px 0",color:C.slateL}}>
              <div style={{fontSize:13,fontWeight:600}}>No matches</div>
              <div style={{fontSize:11,marginTop:4}}>Try clearing filters on the left</div>
            </div>)}

          {filtered.map(c=>{
            const ci=constructionLib.indexOf(c);
            const expandKey=String(ci);
            const autoN=constrAutoName(c);
            const isArchived=(c.status||'active')==='archived';
            // Traceability: which batch rows use this construction
            const batchUses=batchRows.filter(r=>r.constructionCode===c.code);
            return(
            <div key={expandKey} style={{marginBottom:8,border:`1px solid ${clTabExpandedConstr===expandKey?C.amber:C.border}`,
              borderRadius:7,opacity:isArchived?0.65:1,background:C.white}}>
              {/* Header row */}
              <div style={{display:"flex",alignItems:"flex-start",padding:"10px 14px",
                background:clTabExpandedConstr===expandKey?C.amberL:C.white,
                borderRadius:clTabExpandedConstr===expandKey?"7px 7px 0 0":"7px",
                cursor:"pointer"}}
                onClick={()=>setClTabExpandedConstr(clTabExpandedConstr===expandKey?null:expandKey)}>
                {/* Code badge */}
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,marginRight:10,flexShrink:0}}>
                  <span style={{fontWeight:900,color:C.amber,fontFamily:mono,fontSize:15,lineHeight:1}}>{c.code}</span>
                  {isArchived&&<span style={{fontSize:7,color:C.slateL,background:"#eee",borderRadius:2,padding:"0 3px",textTransform:"uppercase"}}>arch</span>}
                </div>
                {/* Auto-name + tags */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.slateM,lineHeight:1.3}}>{autoN}</div>
                  {c.name&&<div style={{fontSize:10,color:C.slateL,fontStyle:"italic",marginTop:1}}>{c.name}</div>}
                  <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
                    {c.sector&&<span style={{fontSize:9,background:C.amberL,color:C.amberD,borderRadius:3,padding:"1px 5px"}}>{c.sector}</span>}
                    {c.client&&<span style={{fontSize:9,background:"#EEF4FB",color:"#2E6094",borderRadius:3,padding:"1px 5px"}}>{c.client}</span>}
                    {c.spec_bs&&<span style={{fontSize:9,background:"#F0FFF4",color:C.green,borderRadius:3,padding:"1px 5px"}}>BS≥{c.spec_bs}</span>}
                    {c.spec_bct&&<span style={{fontSize:9,background:"#F0FFF4",color:C.green,borderRadius:3,padding:"1px 5px"}}>BCT≥{c.spec_bct}kgf</span>}
                    {c.board_gsm&&<span style={{fontSize:9,background:C.cream,color:C.slateM,borderRadius:3,padding:"1px 5px"}}>{c.board_gsm}gsm</span>}
                    {batchUses.length>0&&<span style={{fontSize:9,background:"#EEF4FB",color:"#2E6094",borderRadius:3,padding:"1px 5px"}}>
                      ↳ {batchUses.length} batch row{batchUses.length>1?"s":""}</span>}
                  </div>
                </div>
                {/* Actions */}
                <div style={{display:"flex",gap:4,flexShrink:0,marginLeft:8,alignItems:"center"}}>
                  <button onClick={e=>{e.stopPropagation();
                    setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,status:isArchived?"active":"archived"}:x));}}
                    title={isArchived?"Restore":"Archive"}
                    style={{background:"none",border:`1px solid ${C.border}`,borderRadius:4,
                      color:C.slateL,cursor:"pointer",fontSize:11,padding:"3px 6px"}}>
                    {isArchived?"↩ Restore":"📦 Archive"}</button>
                  <button onClick={e=>{e.stopPropagation();
                    // Fix 14: name affected batch rows before deleting — batchUses already computed
                    const msg=batchUses.length>0
                      ?`Delete construction [${c.code}]?\n\n⚠️ ${batchUses.length} batch row(s) use this construction:\n${batchUses.map(r=>`  · ${r.matCode||"(no code)"} ${r.product?`— ${r.product}`:""}`).join("\n")}\n\nThose rows will lose their construction and be dropped by Send All. This cannot be undone.`
                      :`Delete construction [${c.code}]? This cannot be undone.`;
                    if(window.confirm(msg)){
                      setConstructionLib(prev=>prev.filter((_,j)=>j!==ci));
                      if(clTabExpandedConstr===expandKey)setClTabExpandedConstr(null);
                    }}}
                    style={{background:"none",border:`1px solid ${C.red}44`,borderRadius:4,
                      color:C.red,cursor:"pointer",fontSize:11,padding:"3px 6px"}}>Delete</button>
                  <span style={{fontSize:11,color:C.slateL}}>{clTabExpandedConstr===expandKey?"▴":"▾"}</span>
                </div>
              </div>

              {/* Expanded editor */}
              {clTabExpandedConstr===expandKey&&(
              <div style={{padding:"14px 16px",borderTop:`1px solid ${C.border}`,background:"#FAFAFA",
                borderRadius:"0 0 7px 7px"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 20px"}}>
                  {/* Left col: Identity + Tagging */}
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:"uppercase",
                      letterSpacing:"0.07em",marginBottom:8,borderBottom:`1px solid ${C.border}`,paddingBottom:4}}>
                      Identity &amp; Classification
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:"5px 10px",alignItems:"center"}}>
                      {[["Code","code"],["Label","name"]].map(([lbl,k])=>(
                        <Fragment key={k}>
                          <div style={{fontSize:10,color:C.slateL,fontWeight:600}}>{lbl}</div>
                          <input value={c[k]||""} onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,[k]:e.target.value}:x))}
                            style={{padding:"4px 8px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}/>
                        </Fragment>))}
                      <div style={{fontSize:10,color:C.slateL,fontWeight:600}}>Sector</div>
                      <select value={c.sector||""} onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,sector:e.target.value}:x))}
                        style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:10,color:C.slate}}>
                        <option value="">— any —</option>
                        {sectorCodes.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                      <div style={{fontSize:10,color:C.slateL,fontWeight:600}}>Client</div>
                      <input value={c.client||""} placeholder="e.g. Indorama, ITC"
                        onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,client:e.target.value}:x))}
                        style={{padding:"4px 8px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}/>
                      <div style={{fontSize:10,color:C.slateL,fontWeight:600}}>Status</div>
                      <select value={c.status||"active"} onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,status:e.target.value}:x))}
                        style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,color:C.slate}}>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    {/* Std specs */}
                    <div style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:"uppercase",
                      letterSpacing:"0.07em",margin:"12px 0 8px",borderBottom:`1px solid ${C.border}`,paddingBottom:4}}>
                      Standard Specification
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:"5px 10px",alignItems:"center"}}>
                      {[["board_gsm","Board GSM","g/m²"],["spec_bs","BS NLT","kg/cm²"],
                        ["spec_bct","BCT NLT","kgf"],["spec_ect","ECT NLT","kN/m"],
                        ["spec_cobb","Cobb Max","g/m²"]].map(([fk,lbl,unit])=>(
                        <Fragment key={fk}>
                          <div style={{fontSize:10,color:C.slateL}}>{lbl} <span style={{fontSize:8}}>({unit})</span></div>
                          <input type="number" step={fk==="board_gsm"?5:0.25} value={c[fk]||""}
                            onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,[fk]:e.target.value}:x))}
                            style={{padding:"4px 8px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,width:100}}
                            placeholder={lbl}/>
                        </Fragment>))}
                    </div>
                    {/* Traceability */}
                    {batchUses.length>0&&(
                      <div style={{marginTop:12,padding:"7px 10px",background:"#EEF4FB",
                        border:"1px solid #6A9FD433",borderRadius:5}}>
                        <div style={{fontSize:9,fontWeight:700,color:"#2E6094",marginBottom:3}}>
                          ↳ Used in current Batch Entry ({batchUses.length} row{batchUses.length>1?"s":""})</div>
                        {batchUses.map(r=>(
                          <div key={r.id} style={{fontSize:9,color:"#2E6094",paddingLeft:6}}>
                            · {r.matCode||"—"} {r.product?`— ${r.product}`:""}</div>))}
                      </div>)}
                  </div>

                  {/* Right col: Construction + Paper Layers */}
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:"uppercase",
                      letterSpacing:"0.07em",marginBottom:8,borderBottom:`1px solid ${C.border}`,paddingBottom:4}}>
                      Construction
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:"5px 10px",alignItems:"center",marginBottom:10}}>
                      <div style={{fontSize:10,color:C.slateL}}>Ply</div>
                      <select value={c.ply||5} onChange={e=>{
                        const newPly=+e.target.value;
                        // Fix 7: switching to 3-ply must clear F2/L2 layers — leaving them causes ~40-60% overcost
                        if(newPly===3&&(c.layers?.F2?.code||c.layers?.F2?.gsm||c.layers?.L2?.code||c.layers?.L2?.gsm)){
                          if(!window.confirm("Switch to 3-ply? F2 and L2 layer data will be cleared. This prevents overcost from unused layers."))return;
                          setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,ply:3,flute_F2:"",
                            layers:{...x.layers,F2:{code:"",gsm:""},L2:{code:"",gsm:""}}}:x));
                        } else {
                          setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,ply:newPly}:x));
                        }
                      }}
                        style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}>
                        <option value={3}>3-ply</option><option value={5}>5-ply</option>
                      </select>
                      <div style={{fontSize:10,color:C.slateL}}>Box Type</div>
                      <select value={c.boxType||"RSC"} onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,boxType:e.target.value}:x))}
                        style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}>
                        {BOX_TYPES.map(b=><option key={b} value={b}>{b}</option>)}
                      </select>
                      <div style={{fontSize:10,color:C.slateL}}>F1 Flute</div>
                      <select value={c.flute_F1||"B"} onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,flute_F1:e.target.value}:x))}
                        style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}>
                        {["A","B","C","E"].map(f=><option key={f} value={f}>{f}</option>)}
                      </select>
                      {+c.ply===5&&<Fragment>
                        <div style={{fontSize:10,color:C.slateL}}>F2 Flute</div>
                        <select value={c.flute_F2||"A"} onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,flute_F2:e.target.value}:x))}
                          style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}>
                          {["A","B","C","E"].map(f=><option key={f} value={f}>{f}</option>)}
                        </select>
                      </Fragment>}
                    </div>
                    <div style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:"uppercase",
                      letterSpacing:"0.07em",marginBottom:6,borderBottom:`1px solid ${C.border}`,paddingBottom:4}}>
                      Paper Layers
                    </div>
                    {[["TOP","TOP Liner",false],["F1","F1 Medium",true],["L1","L1 Liner",false],
                      ...(+c.ply===5?[["F2","F2 Medium",true],["L2","L2 Liner",false]]:[])].map(([lk,llbl])=>(
                      <div key={lk} style={{display:"grid",gridTemplateColumns:"60px 1fr 70px",gap:"3px 6px",marginBottom:4,alignItems:"center"}}>
                        <div style={{fontSize:10,color:C.slateL,fontWeight:600}}>{llbl}</div>
                        <select value={(c.layers||{})[lk]?.code||""}
                          onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,layers:{...x.layers,[lk]:{...(x.layers?.[lk]||{}),code:e.target.value}}}:x))}
                          style={{padding:"3px 5px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:10,fontFamily:mono}}>
                          <option value="">—</option>{rates.map(r=><option key={r.code} value={r.code}>{r.code}</option>)}
                        </select>
                        <input type="number" placeholder="GSM" value={(c.layers||{})[lk]?.gsm||""}
                          onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,layers:{...x.layers,[lk]:{...(x.layers?.[lk]||{}),gsm:e.target.value}}}:x))}
                          style={{padding:"3px 5px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:10,textAlign:"center"}}/>
                      </div>))}
                  </div>
                </div>
              </div>)}
            </div>);
          })}
        </div>
      </div>
    </div>);
  })();

  const itemsTab=(
    <div style={{padding:20,overflowY:"auto",height:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:C.slate}}>Quote Items</div>
          <div style={{fontSize:11,color:C.slateL}}>{items.length} item{items.length!==1?"s":""} in this session</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",
        background:templateLoaded?"#EBF7F1":"#FFF8ED",borderRadius:7,marginBottom:12,
        border:`1px solid ${templateLoaded?"#2A7550":"#D97B2E"}44`}}>
        <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",
          padding:"7px 14px",borderRadius:6,fontSize:12,fontWeight:700,flexShrink:0,
          background:templateLoaded?"#2A7550":"#D97B2E",color:"white"}}>
          {templateLoaded?"✅ Template Loaded":"📂 Load Master Template (.xlsx)"}
          <input ref={templateRef} type="file" accept=".xlsx" style={{display:"none"}}
            onChange={handleTemplateLoad}/>
        </label>
        <div style={{fontSize:11,color:templateLoaded?"#2A7550":"#B5641F",lineHeight:1.4}}>
          {templateLoaded
            ?"Exports will use your master format — all formulas, formatting and sheet structure preserved. Click to replace."
            :"Upload CFB_Quotation_Master_v6_1.xlsx once. All exports will retain exact formulas, formatting and cross-sheet references."}
        </div>
      </div>

      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {/* Quote Reference + Maker + Dates */}
          <div style={{display:"flex",gap:6,alignItems:"center",padding:"5px 10px",
            background:C.cream,border:`1px solid ${C.border}`,borderRadius:6,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase"}}>Quote Ref</div>
              <input value={quoteRef} onChange={e=>setQuoteRef(e.target.value)}
                style={{border:"none",background:"transparent",fontWeight:700,fontFamily:mono,
                  fontSize:12,color:C.slate,width:120}}/>
            </div>
            <div style={{width:1,height:16,background:C.border}}/>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase"}}>Maker</div>
              <span style={{fontSize:11,color:C.slateM,width:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{makerName}</span>
            </div>
            <div style={{width:1,height:16,background:C.border}}/>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"3px 8px",borderRadius:5,
              background:C.cream,border:`1px solid ${C.border}`}}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase"}}>Quoted</div>
              <input type="date" value={quoteDate} onChange={e=>setQuoteDate(e.target.value)}
                style={{border:"none",background:"transparent",fontSize:11,color:C.slate,fontFamily:mono,cursor:"pointer",width:110}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"3px 8px",borderRadius:5,
              background:(effectiveFrom||effectiveTo)?"#EBF7F1":C.cream,
              border:`1px solid ${effectiveFrom||effectiveTo?C.green:C.border}`}}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",whiteSpace:"nowrap"}}>
                Price Valid</div>
              <input type="date" value={effectiveFrom} onChange={e=>setEffectiveFrom(e.target.value)}
                style={{border:"none",background:"transparent",fontSize:11,color:C.slate,fontFamily:mono,cursor:"pointer",width:110}}
                title="Effective From"/>
              <span style={{fontSize:10,color:C.slateL}}>—</span>
              <input type="date" value={effectiveTo} onChange={e=>setEffectiveTo(e.target.value)}
                style={{border:"none",background:"transparent",fontSize:11,color:C.slate,fontFamily:mono,cursor:"pointer",width:110}}
                title="Effective To"/>
            </div>
          </div>
          {items.length>0&&(()=>{
            const canExport=quoteRef.trim()&&makerName.trim();
            const exportTip=!quoteRef.trim()?"Quote Ref is required before export":!makerName.trim()?"Your account has no display name set — contact an Admin":"";
            // Fix 11: Capacity limits — v7 template supports max 44 CBB data rows and 30 OFFER rows
            const CBB_MAX=44;
            const OFFER_MAX=30;
            // Fix ③: offerCount corrected — server.py writes ALL items (Box + Plate + Part) sequentially
            // into CBB rows 7…7+len−1, regardless of type. The prior Box-only filter was wrong:
            // 20 Box + 20 Plate = 40 total rows, cbbCount=40 ≤ 44 ✓, but OFFER only mirrors rows 7–36 (30 rows).
            // The correct check is simply items.length for both sheets.
            const cbbCount=items.length;
            const offerCount=items.length; // same limit — server writes all types into the same row band
            const capacityOk=cbbCount<=CBB_MAX&&offerCount<=OFFER_MAX;
            const capacityMsg=cbbCount>CBB_MAX
              ?`❌ Too many items: ${cbbCount} rows exceed the template capacity of ${CBB_MAX} CBB rows. Split the quote into multiple exports.`
              :offerCount>OFFER_MAX
              ?`❌ Too many Box items: ${offerCount} Box rows exceed the OFFER sheet capacity of ${OFFER_MAX}. Split the quote.`
              :"";
            // B3: SET completeness check — warn if any SET has a Box but no Plate/Partition
            const checkSETCompleteness=()=>{
              const setCodes=[...new Set(items.filter(i=>i.spec?.setCode&&i.spec.setCode.trim()).map(i=>i.spec.setCode.trim()))];
              const incomplete=setCodes.filter(sc=>{
                const inSet=items.filter(i=>(i.spec?.setCode||'').trim()===sc);
                const hasBox=inSet.some(i=>(i.spec?.rowType||'Box')==='Box');
                const hasPP=inSet.some(i=>['Plate','Part-L','Part-W'].includes(i.spec?.rowType||''));
                return hasBox&&!hasPP;
              });
              if(incomplete.length>0){
                return window.confirm(`⚠ SET completeness warning:\n\nThe following SET codes have a Box row but no Plate or Partition rows:\n${incomplete.join(', ')}\n\nExport anyway?`);
              }
              return true;
            };
            return(<>
              {!capacityOk&&<div style={{padding:"6px 12px",background:C.redL,border:`1px solid ${C.red}44`,
                borderRadius:5,fontSize:11,color:C.red,fontWeight:600,marginBottom:4}}>
                {capacityMsg}
              </div>}
              <div title={capacityOk?exportTip:capacityMsg} style={{display:"inline-block"}}>
                <Btn ch={templateLoaded?"↓ Export (Master Format)":"↓ Export All to Excel"}
                  v="success"
                  disabled={!canExport||!capacityOk}
                  onClick={()=>{if(checkSETCompleteness())exportFromTemplate(items,rates,freight,templateB64,{quoteRef,makerName,quoteDate,effectiveFrom,effectiveTo,marginPP:batchProfile.marginPP??8},msg=>showToast(msg,'error',8000));}}
                  style={(!canExport||!capacityOk)?{opacity:0.45,cursor:"not-allowed"}:{}}/>
              </div>
              <div title={capacityOk?exportTip:capacityMsg} style={{display:"inline-block"}}>
                <Btn ch="↓ PDF (All SKUs)" v="info"
                  disabled={!canExport}
                  onClick={()=>{if(checkSETCompleteness())exportAllPDF(items,{quoteRef,makerName,paymentDisc:batchProfile.paymentDisc||"30",effectiveTo});}}
                  style={!canExport?{opacity:0.45,cursor:"not-allowed"}:{}}/>
              </div>
              {!canExport&&<span style={{fontSize:10,color:C.red,fontWeight:600}}>{exportTip}</span>}
            </>);
          })()}

          {/* Fix 12: Re-import Excel button removed — the parseImportedExcel function reads
              wrong columns throughout (margin from Total Cost column etc.) and produces
              confidently wrong items. Disabled pre-beta; re-enable after column mapping is fixed.
          <label style={{padding:"8px 16px",borderRadius:6,fontSize:13,fontWeight:600,
            cursor:"pointer",background:C.white,color:C.slateM,border:`1px solid ${C.border}`}}>
            ↑ Re-import Excel
            <input ref={importRef} type="file" accept=".xlsx,.xls" style={{display:"none"}}
              onChange={handleImport}/>
          </label> */}
          {items.length>0&&<Btn ch="Clear All" v="danger" sm onClick={()=>{
            if(window.confirm("Clear all items? They will be lost unless exported."))setItems([]);}}/>}
          {Object.keys(savedQuotes).length>0&&<Btn ch={`📁 Drafts (${Object.keys(savedQuotes).length})`}
            v="secondary" sm onClick={()=>{
              const names=Object.keys(savedQuotes).join(", ");
              const pick=window.prompt(`Saved drafts: ${names}\n\nType client name to restore:`);
              if(pick&&savedQuotes[pick]){setItems(savedQuotes[pick].items);
                setSavedQuotes(prev=>{const n={...prev};delete n[pick];return n;});}}}/>}
        </div>
      </div>
      {items.length===0&&<div style={{textAlign:"center",color:C.slateL,marginTop:60,fontSize:13}}>
        No items yet. Add rows in <button onClick={()=>setTab("batch")} style={{background:"none",border:"none",color:C.amber,fontWeight:700,cursor:"pointer",fontSize:13,textDecoration:"underline"}}>Batch Entry</button>, calculate, then click "Send All to Quote Items".
      </div>}
      {items.length>0&&<>
      {(()=>{
        const setMap={};const standalone=[];
        items.forEach(item=>{
          const sc=(item.spec.setCode||"").trim().toUpperCase();
          if(sc){if(!setMap[sc])setMap[sc]=[];setMap[sc].push(item);}else standalone.push(item);
        });
        const IRw=({item,bg})=>{const{spec:is,result:ir}=item;return(
          <tr key={item.id} style={{background:bg,cursor:"pointer"}} onClick={()=>loadItem(item)}>
            <td style={{padding:"5px 10px"}}>
              {is.setCode&&<span style={{fontSize:9,background:C.amber,color:C.white,padding:"1px 5px",borderRadius:3,marginRight:4}}>{is.setCode}</span>}
              {is.rowType!=="Box"&&<span style={{fontSize:9,color:C.slateL,marginRight:3}}>({is.rowType})</span>}
              <span style={{fontFamily:mono,fontSize:11}}>{is.material_code||"—"}</span>
            </td>
            <td style={{padding:"5px 10px",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{is.product||"—"}</td>
            <td style={{padding:"5px 10px",fontFamily:mono,fontSize:11}}>{is.L&&is.W?`${is.L}×${is.W}${is.H?"×"+is.H:""}`:""}</td>
            <td style={{padding:"5px 10px"}}>{is.ply}p {is.flute_F1||"—"}{(+is.ply===5&&is.flute_F2)?"/"+is.flute_F2:""}</td>
            <td style={{padding:"5px 10px",fontFamily:mono}}>{is.spec_bs||"—"}</td>
            <td style={{padding:"5px 10px",fontFamily:mono,color:ir&&is.spec_bs?Math.abs(ir.calcBS-+is.spec_bs)/+is.spec_bs>0.05?C.orange:C.green:C.slateL}}>{ir?.calcBS||"—"}</td>
            <td style={{padding:"5px 10px",textAlign:"center",fontFamily:mono,color:C.slateL,fontSize:11}}>{ir?(ir.wtSheet*1000).toFixed(0)+"g":"—"}</td>
            <td style={{padding:"5px 10px",textAlign:"center",fontWeight:800,color:C.amber,fontFamily:mono}}>
              {ir?`₹${ir.finalRate.toFixed(2)}`:"—"}
              {ir&&(+is.qtyPerSet||1)>1&&<div style={{fontSize:9,color:C.slateL,fontWeight:400,marginTop:1}}>
                ×{is.qtyPerSet} = ₹{(ir.finalRate*(+is.qtyPerSet||1)).toFixed(2)}
              </div>}
            </td>
            <td style={{padding:"5px 10px",textAlign:"center",fontFamily:mono,fontSize:11}}>{ir?ir.calcMOQ.toLocaleString():"—"}</td>
            <td style={{padding:"4px 4px"}} onClick={e=>{e.stopPropagation();removeItem(item.id);}}>
              <button style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:16}}>×</button>
            </td>
          </tr>);};
        return<div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:860}}>
            <thead><tr style={{background:C.slateM}}>
              {["Mat Code / Type","SKU","Dims","Construction","Std BS","Calc BS","Sheet Wt","Final Rate","MOQ",""].map(h=>(
                <th key={h} style={{padding:"7px 10px",color:C.white,fontSize:10,fontWeight:600,
                  textAlign:["Final Rate","MOQ","Sheet Wt"].includes(h)?"center":"left"}}>{h}</th>))}
            </tr></thead>
            <tbody>
              {standalone.map((item,i)=><IRw key={item.id} item={item} bg={i%2?C.cream:C.white}/>)}
              {Object.entries(setMap).map(([sc,si])=>[
                <tr key={sc+"-h"} style={{background:C.slateM}}>
                  <td colSpan={10} style={{padding:"5px 10px",color:C.amber,fontWeight:700,fontSize:11}}>
                    📦 SET: {sc} &nbsp;·&nbsp; {si.length} item{si.length>1?"s":""} &nbsp;·&nbsp;
                    <span style={{fontFamily:mono}}>SET Rate: ₹{si.filter(i=>i.result).reduce((s,i)=>s+i.result.finalRate*(+i.spec.qtyPerSet||1),0).toFixed(2)}/set</span>
                  </td>
                </tr>,
                ...si.map((item,i)=><IRw key={item.id} item={item} bg={i%2?"#F5F0EC":C.cream}/>),
                <tr key={sc+"-f"} style={{background:"#EBE3D8"}}>
                  <td colSpan={7} style={{padding:"4px 10px",fontSize:10,fontWeight:600,color:C.slateM}}>
                    SET {sc} total ({si.filter(i=>i.result).length} items costed)</td>
                  <td style={{padding:"4px 10px",textAlign:"center",fontWeight:800,color:C.amberD,fontFamily:mono}}>
                    ₹{si.filter(i=>i.result).reduce((s,i)=>s+i.result.finalRate*(+i.spec.qtyPerSet||1),0).toFixed(2)}</td>
                  <td colSpan={2}/>
                </tr>
              ])}
            </tbody>
          </table>
        </div>;
      })()}
        <div style={{marginTop:10,fontSize:11,color:C.slateL,padding:"8px 12px",
          background:C.cream,borderRadius:6}}>
          Click any row to load it into the Costing tab for deep-dive analysis.
          To revise a rate, go to Batch Entry → adjust → Calculate All → Send All to Quote Items again.
          Re-import: export to Excel, make manual revisions, then use "Re-import Excel" to bring back revised items.
        </div>
      </>}
    </div>
  );


  // ── DEFAULTS TAB ──────────────────────────────────────────────────────────
  const defaultsTab=(
    <div style={{overflowY:"auto",height:"100%",padding:20}}>
      {/* SECTOR DEFAULTS */}
      <div style={{marginBottom:28}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.slate}}>Sector Defaults</div>
            <div style={{fontSize:11,color:C.slateL}}>Editable by Admin. Selecting a sector in Costing tab auto-populates Waste%, Conv rates.</div>
          </div>
          {role!=="admin"&&<span style={{fontSize:11,color:C.slateL}}>Switch to Admin to edit</span>}
          {role==="admin"&&<span style={{fontSize:11,color:C.green,fontWeight:600}}>⚙ Admin — edit enabled</span>}
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:800}}>
            <thead><tr style={{background:C.slateM}}>
              {["Sector Code","Sector Name","Waste% (CBB)","Waste% (P&P)","Conv Rs/kg (Box)","Conv Rs/kg (P&P)","Spec Language",...(role==="admin"?[""]:[])].map(h=>(
                <th key={h} style={{padding:"7px 10px",color:C.white,fontSize:10,fontWeight:600,
                  textAlign:h==="Sector Code"||h==="Sector Name"?"left":"center",whiteSpace:"pre"}}>{h}</th>))}
            </tr></thead>
            <tbody>
              {sectors.map((row,i)=>{
                const upd=(field,val)=>setSectors(prev=>prev.map((r,j)=>j===i?{...r,[field]:val}:r));
                const EditNum=({field,w=60})=>role==="admin"
                  ?<input type="number" step="0.5" value={row[field]} onChange={e=>upd(field,+e.target.value)}
                     style={{width:w,padding:"3px 5px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center",fontFamily:mono}}/>
                  :<span style={{fontFamily:mono}}>{row[field]}</span>;
                const EditStr=({field,w=80})=>role==="admin"
                  ?<input type="text" value={row[field]} onChange={e=>upd(field,e.target.value)}
                     style={{width:w,padding:"3px 5px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}/>
                  :<span>{row[field]}</span>;
                return<tr key={row.code} style={{background:i%2?C.cream:C.white}}>
                  <td style={{padding:"5px 8px",fontWeight:700,color:C.slateM,fontFamily:mono,fontSize:11}}>
                    {role==="admin"&&(()=>{
                      // Code is the join key across batchProfile.sector and constructionLib.sector.
                      // Editing it character-by-character orphans every reference at the first keystroke.
                      // Allow edit only while the code is unreferenced — covers typo-fixing just after
                      // adding. Once referenced, show as read-only with a title hint.
                      const isReferenced=batchProfile.sector===row.code||
                        constructionLib.some(c=>c.sector===row.code);
                      return isReferenced
                        ?<span style={{fontFamily:mono,fontWeight:700,fontSize:11,
                            cursor:"not-allowed",borderBottom:`1px dashed ${C.border}`}}
                            title={`Code locked — referenced by ${batchProfile.sector===row.code?"the active Batch Profile":""}`+
                              `${constructionLib.some(c=>c.sector===row.code)?` ${constructionLib.filter(c=>c.sector===row.code).length} construction(s)`:""}. `+
                              `To rename, first re-assign all references, then edit the code.`}>
                          {row.code}
                        </span>
                        :<input type="text" value={row.code}
                            onChange={e=>upd("code",e.target.value.toUpperCase())}
                            title="Code is editable while unreferenced. Will lock once used."
                            style={{width:90,padding:"3px 5px",border:`1px solid ${C.border}`,borderRadius:4,
                              fontSize:11,fontFamily:mono,fontWeight:700,textTransform:"uppercase"}}/>;
                    })()}
                    {role!=="admin"&&<span>{row.code}</span>}
                  </td>
                  <td style={{padding:"5px 8px",color:C.slateL,fontSize:11}}><EditStr field="name" w={160}/></td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}><EditNum field="wasteCBB"/>%</td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}><EditNum field="wastePP"/>%</td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}><EditNum field="convBox" w={65}/></td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}><EditNum field="convPP" w={65}/></td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}><EditStr field="specLang" w={80}/></td>
                  {role==="admin"&&<td style={{padding:"4px 6px",textAlign:"center"}}>
                    <button onClick={()=>{
                      // Delete guard: check batchProfile and constructionLib usage
                      // Bug fix: old guard used batchRows.filter(r=>batchProfile.sector===row.code)
                      // — predicate never referenced r, so .length = all rows or 0.
                      // Correct: check batchProfile.sector directly (batch-wide, not per row).
                      const profileUses=batchProfile.sector===row.code;
                      const inConstr=constructionLib.filter(c=>c.sector===row.code).length;
                      const msg=`Delete sector [${row.code}]?`
                        +(profileUses?`\n⚠️ Active Batch Profile uses this sector.`:"")
                        +(inConstr>0?`\n⚠️ ${inConstr} construction(s) reference this sector.`:"")
                        +"\nThis cannot be undone.";
                      if(window.confirm(msg))setSectors(prev=>prev.filter((_,j)=>j!==i));
                    }} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:15,padding:"0 4px"}}>×</button>
                  </td>}
                </tr>;})}
            </tbody>
          </table>
        </div>
        {role==="admin"&&<div style={{marginTop:8,fontSize:10,color:C.slateL}}>
          Changes apply immediately. Selecting a sector in the Costing form auto-fills Waste% (CBB) and Conv Rs/kg (Box).</div>}
        {role==="admin"&&(()=>{
          // newSector state is hoisted to component level (Rules of Hooks:
          // useState cannot be called inside a conditional or an IIFE in JSX —
          // doing so caused a blank screen when switching to Admin role).
          const ns=newSector;
          const setNs=setNewSector;
          const codeOk=ns.code.trim()&&!sectors.find(s=>s.code===ns.code.trim().toUpperCase());
          return<div style={{display:"flex",gap:6,alignItems:"center",marginTop:8,flexWrap:"wrap"}}>
            <span style={{fontSize:10,fontWeight:700,color:C.slateM}}>+ Add Sector:</span>
            {[["Code",60,"code"],[" Name",120,"name"]].map(([lbl,w,k])=>
              <input key={k} type="text" placeholder={lbl} value={ns[k]}
                onChange={e=>setNs(p=>({...p,[k]:k==="code"?e.target.value.toUpperCase():e.target.value}))}
                style={{width:w,padding:"3px 6px",border:`1px solid ${codeOk||!ns.code?C.border:C.red}`,
                  borderRadius:4,fontSize:11,fontFamily:k==="code"?mono:sans}}/>)}
            {[["Waste%",48,"wasteCBB",0.5],["WastePP%",48,"wastePP",0.5],
              ["ConvBox",52,"convBox",0.5],["ConvPP",52,"convPP",0.5]].map(([lbl,w,k,step])=>
              <input key={k} type="number" step={step} placeholder={lbl} value={ns[k]}
                onChange={e=>setNs(p=>({...p,[k]:+e.target.value}))}
                style={{width:w,padding:"3px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,fontFamily:mono,textAlign:"center"}}/>)}
            <input type="text" placeholder="SpecLang" value={ns.specLang}
              onChange={e=>setNs(p=>({...p,specLang:e.target.value}))}
              style={{width:70,padding:"3px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}/>
            <button disabled={!codeOk} onClick={()=>{
              setSectors(prev=>[...prev,{...ns,code:ns.code.trim().toUpperCase()}]);
              setNs({code:"",name:"",wasteCBB:5,wastePP:5,convBox:7,convPP:12.5,specLang:"BS"});
              showToast(`✅ Sector [${ns.code.toUpperCase()}] added`,'success');
            }} style={{padding:"4px 10px",borderRadius:4,border:"none",
              background:codeOk?C.green:"#CCC",color:C.white,fontSize:11,fontWeight:700,
              cursor:codeOk?"pointer":"not-allowed"}}>+ Add</button>
            {ns.code&&!codeOk&&sectors.find(s=>s.code===ns.code.toUpperCase())&&
              <span style={{fontSize:10,color:C.red}}>Code already exists</span>}
          </div>;
        })()}
      </div>

      {/* BOX TYPE TRIM DEFAULTS */}
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.slate}}>Box Type Trim Defaults</div>
            <div style={{fontSize:11,color:C.slateL}}>Auto-fills trim margins in the Costing form when box type is selected. Override per SKU if needed.</div>
          </div>
        </div>
        <table style={{borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:C.slateM}}>
            {["Box Type","3-ply Dkl","3-ply Cut","5-ply Dkl","5-ply Cut","Deckle Formula","Cutting Formula"].map(h=>(
              <th key={h} style={{padding:"7px 14px",color:C.white,fontSize:10,fontWeight:600,
                textAlign:h==="Box Type"?"left":"center"}}>{h}</th>))}
          </tr></thead>
          <tbody>
            {Object.entries(boxTrim).map(([bt,t],i)=>{
              const upd=(field,val)=>setBoxTrim(prev=>({...prev,[bt]:{...prev[bt],[field]:+val}}));
              const TCell=({field})=>role==="admin"
                ?<input type="number" step="1" value={t[field]} onChange={e=>upd(field,e.target.value)}
                   style={{width:70,padding:"3px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:12,textAlign:"center",fontFamily:mono}}/>
                :<span style={{fontFamily:mono,fontWeight:600}}>{t[field]}</span>;
              return<tr key={bt} style={{background:i%2?C.cream:C.white}}>
                <td style={{padding:"5px 14px",fontWeight:700,color:C.slateM}}>{bt}</td>
                <td style={{padding:"4px 10px",textAlign:"center"}}><TCell field="d3"/></td>
                <td style={{padding:"4px 10px",textAlign:"center"}}><TCell field="c3"/></td>
                <td style={{padding:"4px 10px",textAlign:"center"}}><TCell field="d5"/></td>
                <td style={{padding:"4px 10px",textAlign:"center"}}><TCell field="c5"/></td>
                <td style={{padding:"4px 8px",fontSize:9,color:C.slateL,fontStyle:"italic"}}>{t.deckleF||"—"}</td>
                <td style={{padding:"4px 8px",fontSize:9,color:C.slateL,fontStyle:"italic"}}>{t.cuttingF||"—"}</td>
              </tr>;})}
          </tbody>
        </table>
        {role!=="admin"&&<div style={{marginTop:8,fontSize:11,color:C.amberD,padding:"6px 10px",background:"#FFF8ED",borderRadius:6}}>
          Switch to Admin role to edit trim margins.</div>}
        <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center"}}>
          {role==="admin"&&<button onClick={()=>{
            const fresh={...DEFAULT_BOX_TRIM_DATA};
            setBoxTrim(fresh);
            try{localStorage.setItem('cbb_boxtrim',JSON.stringify(fresh));}catch(e){}
            }} style={{padding:"4px 12px",borderRadius:5,border:`1px solid ${C.border}`,
              background:C.white,color:C.slateM,fontSize:11,cursor:"pointer",fontWeight:600}}>
            ↺ Reset to Defaults</button>}
          <div style={{fontSize:10,color:C.slateL}}>
            PP: trim=0 · Board: trim=10mm · Custom: 0 · Changes are saved automatically.</div>
        </div>
      </div>

      {/* PARTITIONS MASTER */}
      <div style={{marginTop:24,paddingTop:20,borderTop:`1px solid ${C.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.slate}}>Partitions Master — Alcobev Glass SKU</div>
            <div style={{fontSize:11,color:C.slateL}}>Nos per set by SKU type. Auto-fills Nos/Set when Glass SKU is selected in the SET config for Partition-L and Partition-W rows.</div>
          </div>
          {role==="admin"&&<Btn ch="+ Add SKU" v="success" sm onClick={()=>setPartitionsMaster(prev=>[...prev,{skuType:"New SKU",lwise:1,wwise:1}])}/>}
        </div>
        <table style={{borderCollapse:"collapse",fontSize:12,minWidth:480}}>
          <thead><tr style={{background:C.slateM}}>
            {["SKU Type","Part-L (Length-wise nos)","Part-W (Width-wise nos)",...(role==="admin"?[""]:[])]
              .map(h=><th key={h} style={{padding:"7px 14px",color:C.white,fontSize:10,fontWeight:600,textAlign:h==="SKU Type"?"left":"center"}}>{h}</th>)}
          </tr></thead>
          <tbody>{partitionsMaster.map((row,i)=>(
            <tr key={i} style={{background:i%2?C.cream:C.white}}>
              <td style={{padding:"5px 14px",fontWeight:600,color:C.slateM}}>
                {role==="admin"?<input value={row.skuType} onChange={e=>setPartitionsMaster(prev=>prev.map((r,j)=>j===i?{...r,skuType:e.target.value}:r))}
                  style={{border:`1px solid ${C.border}`,borderRadius:4,padding:"3px 7px",fontSize:12,width:140}}/>
                :row.skuType}
              </td>
              {["lwise","wwise"].map(field=>(
                <td key={field} style={{padding:"4px 14px",textAlign:"center"}}>
                  {role==="admin"?<input type="number" min="0" step="1" value={row[field]}
                    onChange={e=>setPartitionsMaster(prev=>prev.map((r,j)=>j===i?{...r,[field]:+e.target.value}:r))}
                    style={{width:60,padding:"3px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:12,textAlign:"center",fontFamily:mono}}/>
                  :<span style={{fontFamily:mono,fontWeight:700,fontSize:13}}>{row[field]}</span>}
                </td>))}
              {role==="admin"&&<td style={{padding:"3px 4px",textAlign:"center"}}>
                <button onClick={()=>setPartitionsMaster(prev=>prev.filter((_,j)=>j!==i))}
                  style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:16}}>×</button>
              </td>}
            </tr>))}
          </tbody>
        </table>
        {role!=="admin"&&<div style={{marginTop:8,fontSize:11,color:C.amberD,padding:"6px 10px",background:"#FFF8ED",borderRadius:6}}>
          Switch to Admin to edit the Partitions Master.</div>}
      </div>
    </div>
  );

  // ── RATE MASTER TAB ───────────────────────────────────────────────────────
  const rateTab=(
    <div style={{padding:16,overflowY:"auto",height:"100%"}}>

      {/* ── Strip 1: Price Rules ──────────────────────────────────────────── */}
      <div style={{background:"#EEF4FB",border:"1px solid #6A9FD4",borderRadius:8,
        padding:"10px 14px",marginBottom:10}}>
        {/* Row 1: all bulk controls */}
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"nowrap",overflowX:"auto"}}>
          {/* GY Premiums */}
          <span style={{fontSize:10,fontWeight:700,color:"#2E6094",whiteSpace:"nowrap"}}>GY Premium</span>
          {[["16–24BF",gyPremLow,setGyPremLow],["28–35BF",gyPremHigh,setGyPremHigh]].map(([lbl,val,setter])=>(
            <div key={lbl} style={{display:"flex",alignItems:"center",gap:2}}>
              <span style={{fontSize:9,color:C.slateL,whiteSpace:"nowrap"}}>{lbl}</span>
              <input type="number" step="0.25" value={val} disabled={role!=="admin"}
                onChange={e=>setter(+e.target.value)}
                style={{width:46,padding:"3px 4px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center",fontFamily:mono}}/>
            </div>))}
          {role==="admin"&&<button onClick={()=>{
            let _n=0;setRates(prev=>prev.map(gr=>{
              if(!gr.code.endsWith("GY"))return gr;
              const bf=parseInt(gr.code)||0;
              const nat=prev.find(x=>x.code===gr.code.replace("GY",""));
              if(!nat)return gr;_n++;
              return{...gr,price:+(nat.price+(bf<=24?gyPremLow:gyPremHigh)).toFixed(2)};
            }));touchRateDate();showToast(`GY applied — ${_n} grades`,"info");
          }} style={{padding:"3px 8px",borderRadius:5,border:"none",background:"#2E6094",
            color:C.white,fontSize:9,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>Apply GY</button>}

          <div style={{width:1,height:22,background:"#6A9FD4",flexShrink:0}}/>

          {/* Freight by BF Band */}
          <span style={{fontSize:10,fontWeight:700,color:"#2E6094",whiteSpace:"nowrap"}}>Freight</span>
          {[
            {lbl:"16–20BF",codes:["16","18","20","20GY"]},
            {lbl:"22–28BF",codes:["22","24","28","22GY","24GY","28GY","26HRCT"]},
            {lbl:"35BF+",codes:["35","35GY","25WTL","14DUP","40VKL"]},
          ].map((b,bi)=>(
            <div key={b.lbl} style={{display:"flex",alignItems:"center",gap:2}}>
              <span style={{fontSize:9,color:C.slateL,whiteSpace:"nowrap"}}>{b.lbl}</span>
              <input type="number" step="0.25" min="0" value={freightBands[bi]||0}
                onChange={e=>{const nv=[...freightBands];nv[bi]=+e.target.value;setFreightBands(nv);}}
                style={{width:40,padding:"3px 4px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center"}}
                disabled={role!=="admin"}/>
              {role==="admin"&&<button onClick={()=>{
                setRates(prev=>prev.map(r=>b.codes.includes(r.code)?{...r,freight:freightBands[bi]||0}:r));
                touchRateDate();showToast(`Freight ₹${freightBands[bi]||0}/kg → ${b.lbl}`,'info');
              }} style={{padding:"2px 5px",borderRadius:4,border:`1px solid ${C.amber}`,
                background:C.amberL,color:C.amberD,fontSize:9,cursor:"pointer",fontWeight:700}}>→</button>}
            </div>))}

          <div style={{width:1,height:22,background:"#6A9FD4",flexShrink:0}}/>

          {/* Blanket Discount */}
          <span style={{fontSize:10,fontWeight:700,color:"#2E6094",whiteSpace:"nowrap"}}>Disc</span>
          <input type="number" step="0.25" value={blanketDisc} disabled={role!=="admin"}
            onChange={e=>setBlanketDisc(+e.target.value)}
            style={{width:44,padding:"3px 4px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center",fontFamily:mono}}/>
          {role==="admin"&&<button onClick={()=>{
            setRates(prev=>prev.map(r=>({...r,disc:blanketDisc})));
            touchRateDate();showToast(`Disc ₹${blanketDisc}/kg → all`,'info');
          }} style={{padding:"2px 7px",borderRadius:4,border:`1px solid ${C.border}`,
            background:C.white,color:C.slateM,fontSize:9,fontWeight:600,cursor:"pointer"}}>All</button>}

          <div style={{width:1,height:22,background:"#6A9FD4",flexShrink:0}}/>

          {/* Blanket Interest (credit cost %) */}
          <span style={{fontSize:10,fontWeight:700,color:"#2E6094",whiteSpace:"nowrap"}}>Credit%</span>
          <input type="number" step="0.25" value={blanketInterest} disabled={role!=="admin"}
            onChange={e=>setBlanketInterest(+e.target.value)}
            style={{width:44,padding:"3px 4px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center",fontFamily:mono}}/>
          {role==="admin"&&<button onClick={()=>{
            setRates(prev=>prev.map(r=>({...r,interest:blanketInterest})));
            touchRateDate();showToast(`Credit ${blanketInterest}% → all grades`,'info');
          }} style={{padding:"2px 7px",borderRadius:4,border:`1px solid ${C.border}`,
            background:C.white,color:C.slateM,fontSize:9,fontWeight:600,cursor:"pointer"}}>All</button>}
        </div>

        {/* Row 2: footnote + date */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:5}}>
          <div style={{fontSize:9,color:"#6A9FD4"}}>
            GSM surcharge applied per layer during costing (not in Rate Master Eff Rate): &lt;100=+₹4 · =100=+₹1.5 · &gt;200=+₹1 &nbsp;|&nbsp;
            Example: 22BF=₹{rates.find(r=>r.code==="22")?.price||"—"} + GY₹{gyPremLow} → 22GY=₹{rates.find(r=>r.code==="22")?(rates.find(r=>r.code==="22").price+gyPremLow).toFixed(2):"—"}
          </div>
          <div style={{fontSize:9,color:C.slateL,textAlign:"right",whiteSpace:"nowrap",marginLeft:12}}>
            {rateUpdatedAt?<><b style={{color:"#2E6094"}}>Updated:</b> {rateUpdatedAt}</>:"Rate date not set"}
            {role==="admin"&&<> · <button onClick={touchRateDate}
              style={{background:"none",border:"none",color:"#2E6094",cursor:"pointer",fontSize:9,textDecoration:"underline",padding:0}}>
              Mark today</button></>}
          </div>
        </div>
      </div>

      {/* ── Strip 2: Add Grade (admin only) ───────────────────────────────── */}
      {role==="admin"&&<div style={{display:"flex",gap:6,alignItems:"center",
        background:C.cream,border:`1px solid ${C.border}`,borderRadius:7,
        padding:"7px 12px",marginBottom:10}}>
        <span style={{fontSize:10,fontWeight:700,color:C.amber,whiteSpace:"nowrap"}}>+ New Grade</span>
        {[
          {k:"code",ph:"Code e.g. 30GY",w:90},
          {k:"desc",ph:"Short description",w:180},
          {k:"price",ph:"Price",w:70,t:"number"},
          {k:"disc",ph:"Disc",w:55,t:"number"},
          {k:"freight",ph:"Freight",w:60,t:"number"},
        ].map(({k,ph,w,t="text"})=>(
          <input key={k} type={t} step={t==="number"?"0.25":undefined}
            value={newGrade[k]??""} placeholder={ph}
            onChange={e=>setNewGrade(g=>({...g,[k]:t==="number"?+e.target.value:e.target.value}))}
            style={{width:w,padding:"4px 7px",border:`1px solid ${C.border}`,borderRadius:5,
              fontSize:11,fontFamily:k==="code"||t==="number"?mono:sans}}/>))}
        <button onClick={()=>{
          if(!newGrade.code||!newGrade.price){showToast("Code and Price required",'error');return;}
          if(rates.find(r=>r.code===newGrade.code)){showToast("Grade code already exists",'error');return;}
          setRates(prev=>[...prev,{...newGrade,freight:newGrade.freight||0}]);
          touchRateDate();
          setNewGrade({code:"",desc:"",price:"",disc:1.5,freight:0});
        }} style={{padding:"4px 14px",borderRadius:5,border:"none",background:C.green,
          color:C.white,fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
          Add Grade</button>
        <span style={{fontSize:9,color:C.slateL,marginLeft:4}}>Eff Rate = Price + Credit% − Disc + Freight</span>
      </div>}

      {/* ── Rate Master table ─────────────────────────────────────────────── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <div style={{fontSize:13,fontWeight:700,color:C.slate}}>Rate Master
          <span style={{fontSize:10,fontWeight:400,color:C.slateL,marginLeft:8}}>
            {rates.length} grades · effective rates used in all costing</span>
        </div>
        {role==="admin"&&<span style={{fontSize:10,color:C.green,fontWeight:600}}>⚙ Admin — edit enabled</span>}
      </div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <thead><tr style={{background:C.slateM}}>
          {["Grade","Description","Paper Price","Credit %","Discount","Freight","Eff Rate",...(role==="admin"?[""]:[])].map(h=>(
            <th key={h} style={{padding:"6px 8px",color:C.white,fontSize:10,fontWeight:600,
              textAlign:["Paper Price","Credit %","Discount","Freight","Eff Rate"].includes(h)?"center":"left"}}>{h}</th>))}
        </tr></thead>
        <tbody>{rates.map((row,i)=>{
          const gCreditPct=(row.interest!=null&&row.interest!=='')?+row.interest/100:CREDIT_PCT;
          const eff=row.price?+(row.price+row.price*gCreditPct-(row.disc||0)+(row.freight||0)).toFixed(2):0;
          const fld=(k,w,step=0.5)=>role==="admin"
            ?<input value={row[k]??0} type="number" step={step}
               onChange={e=>{setRates(prev=>prev.map((r,j)=>j===i?{...r,[k]:+e.target.value}:r));touchRateDate();}}
               style={{width:w,padding:"3px 5px",border:`1px solid ${k==="freight"&&(row.freight||0)>0?C.amber:C.border}`,
                 borderRadius:4,fontSize:11,textAlign:"center",fontFamily:mono,
                 background:k==="freight"&&(row.freight||0)>0?"#FFF8ED":C.white}}/>
            :<span style={{fontFamily:mono,color:k==="freight"&&(row.freight||0)>0?C.amberD:C.slateL}}>
               {row[k]||"—"}</span>;
          return<tr key={row.code} style={{background:i%2?C.cream:C.white,borderBottom:`1px solid ${C.border}22`}}>
            <td style={{padding:"4px 8px",fontWeight:700,color:C.slateM,fontFamily:mono,fontSize:12}}>{row.code}</td>
            <td style={{padding:"4px 8px",color:C.slateL,fontSize:11,maxWidth:200}}>{row.desc}</td>
            <td style={{padding:"4px 8px",textAlign:"center"}}>{fld("price",65,0.5)}</td>
            <td style={{padding:"4px 6px",textAlign:"center"}}>
              {role==="admin"
                ?<input value={row.interest??1.5} type="number" step="0.25" min="0" max="5"
                   onChange={e=>{setRates(prev=>prev.map((r,j)=>j===i?{...r,interest:+e.target.value}:r));touchRateDate();}}
                   style={{width:46,padding:"3px 4px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center",fontFamily:mono}}
                   title="Credit cost % for this grade"/>
                :<span style={{fontFamily:mono,color:C.slateL,fontSize:11}}>{(row.interest??1.5).toFixed(2)}%</span>}
            </td>
            <td style={{padding:"4px 8px",textAlign:"center"}}>{fld("disc",55,0.25)}</td>
            <td style={{padding:"4px 8px",textAlign:"center"}}>{fld("freight",52,0.25)}</td>
            <td style={{padding:"4px 8px",textAlign:"center",fontWeight:700,color:C.green,fontFamily:mono,fontSize:12}}
              title={`${row.price} + credit(${row.interest??1.5}%)${(row.price*gCreditPct).toFixed(2)} - disc${row.disc||0} + fr${row.freight||0}`}>
              {eff}</td>
            {role==="admin"&&<td style={{padding:"3px 4px",textAlign:"center"}}>
              <button onClick={()=>{
                // Fix 6: count constructions using this grade before deleting
                const usedIn=constructionLib.filter(c=>
                  Object.values(c.layers||{}).some(l=>l.code===row.code)).length;
                const msg=usedIn>0
                  ?`Delete grade [${row.code}]? It is used in ${usedIn} construction(s). Rows using it will show ₹0 material cost. This cannot be undone.`
                  :`Delete grade [${row.code}]? This cannot be undone.`;
                if(window.confirm(msg))setRates(prev=>prev.filter((_,j)=>j!==i));
              }}
                style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:15}}>×</button>
            </td>}
          </tr>;})}
        </tbody>
      </table>
    </div>
  );
  // ── FREIGHT RATES TAB ─────────────────────────────────────────────────────
  const freightTab=(
    <div style={{padding:20,overflowY:"auto",height:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:C.slate,marginBottom:2}}>Freight Rate Matrix</div>
          <div style={{fontSize:11,color:C.slateL}}>Rs/kg from plant to delivery location. 3 plants: Nagpur · Pune · Kolkata</div>
        </div>
        {role==="admin"
          ?<span style={{fontSize:11,color:C.green,fontWeight:600}}>⚙ Admin — add/edit/delete enabled</span>
          :<span style={{fontSize:11,color:C.slateL}}>Switch to Admin to edit</span>}
      </div>
      {role==="admin"&&<div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,
        padding:"10px 12px",background:C.cream,borderRadius:7,border:`1px solid ${C.border}`}}>
        <span style={{fontSize:11,fontWeight:600,color:C.slateM}}>Add Location:</span>
        <input value={newLocation} onChange={e=>setNewLocation(e.target.value)}
          placeholder="e.g. Surat" style={{padding:"5px 9px",borderRadius:5,
            border:`1px solid ${C.border}`,fontSize:12,width:140}}/>
        <Btn ch="+ Add Row" v="success" sm disabled={!newLocation||locations.includes(newLocation)}
          onClick={()=>{
            setLocations(prev=>[...prev,newLocation]);
            setFreight(prev=>{const nf={...prev};
              PLANTS.forEach(p=>{nf[p]={...(nf[p]||{}),[newLocation]:0};});return nf;});
            setNewLocation("");}}/>
        <span style={{fontSize:10,color:C.slateL}}>Click cell to edit rates. × to delete a row.</span>
      </div>}
      <table style={{borderCollapse:"collapse",fontSize:12}}>
        <thead><tr>
          <th style={{padding:"7px 14px",background:C.slateM,color:C.white,textAlign:"left",
            fontSize:10,fontWeight:600,minWidth:140}}>Delivery ↓ / Plant →</th>
          {PLANTS.map(p=><th key={p} style={{padding:"7px 14px",background:C.amber,color:C.white,
            fontSize:10,fontWeight:600,minWidth:96,textAlign:"center"}}>{p}</th>)}
          {role==="admin"&&<th style={{padding:"7px 8px",background:C.slateM,color:"transparent",
            fontSize:10,width:30}}> </th>}
        </tr></thead>
        <tbody>{locations.map((loc,li)=>(
          <tr key={loc} style={{background:li%2?C.cream:C.white}}>
            <td style={{padding:"5px 14px",fontWeight:600,color:C.slateM}}>{loc}</td>
            {PLANTS.map(plant=>(
              <td key={plant} style={{padding:"3px 8px",textAlign:"center"}}>
                {role==="admin"
                  ?<input type="number" step="0.5" value={freight[plant]?.[loc]??0}
                     onChange={e=>setFreight(prev=>({...prev,[plant]:{...(prev[plant]||{}),[loc]:+e.target.value}}))}
                     style={{width:68,padding:"3px 6px",border:`1px solid ${C.border}`,borderRadius:4,
                       fontSize:12,textAlign:"center",fontFamily:mono}}/>
                  :<span style={{fontFamily:mono,color:C.slateM,fontSize:12}}>{freight[plant]?.[loc]??0}</span>}
              </td>))}
            {role==="admin"&&<td style={{padding:"3px 4px",textAlign:"center"}}>
              <button onClick={()=>{
                  setLocations(prev=>prev.filter(l=>l!==loc));
                  setFreight(prev=>{const nf={...prev};
                    PLANTS.forEach(p=>{const pl={...(nf[p]||{})};delete pl[loc];nf[p]=pl;});return nf;});}}
                style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:16,lineHeight:1}}>×</button>
            </td>}
          </tr>))}
        </tbody>
      </table>
      {role!=="admin"&&<div style={{marginTop:10,fontSize:11,color:C.amberD,
        padding:"7px 10px",background:"#FFF8ED",borderRadius:6}}>
        Switch to Admin role to add, edit or delete locations.</div>}
    </div>
  );


  // ── MAIN RENDER ───────────────────────────────────────────────────────────
  return(
    <>
    {autosaveBanner&&(
      <div style={{position:"fixed",top:0,left:0,right:0,zIndex:10000,
        background:C.amberD,color:C.white,padding:"8px 16px",
        display:"flex",alignItems:"center",gap:10,fontSize:12,fontWeight:600}}>
        <span>🕐 Unsaved batch work found from {autosaveBanner.label} ({autosaveBanner.rows} row{autosaveBanner.rows!==1?"s":""}). Restore it?</span>
        <button onClick={restoreAutosave}
          style={{padding:"3px 12px",borderRadius:4,border:"none",background:C.white,
            color:C.amberD,fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:sans}}>Restore</button>
        <button onClick={()=>setAutosaveBanner(null)}
          style={{padding:"3px 10px",borderRadius:4,border:"1px solid rgba(255,255,255,.4)",
            background:"transparent",color:C.white,fontSize:11,cursor:"pointer",fontFamily:sans}}>Dismiss</button>
      </div>)}
    <div style={{display:"flex",flexDirection:"row",height:"100vh",width:"100%",overflow:"hidden",
      background:C.cream,fontFamily:sans}}>
      {sidebar}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        {topBar}
        <div style={{flex:1,overflow:"hidden",position:"relative"}}>
          {tab==="costing"&&(
            <div style={{display:"grid",gridTemplateColumns:"380px 1fr",height:"100%",overflow:"hidden"}}>
              <div style={{borderRight:`1px solid ${C.border}`,overflow:"hidden",
                display:"flex",flexDirection:"column"}}>{specForm}</div>
              <div style={{overflow:"hidden",display:"flex",flexDirection:"column"}}>{outputPanel}</div>
            </div>)}
          {tab==="items"&&itemsTab}
          {tab==="batch"&&batchEntryTab}
          {tab==="constrlib"&&constructionLibTab}
          {tab==="rates"&&rateTab}
          {tab==="defaults"&&defaultsTab}
          {tab==="freight"&&freightTab}
          {tab==="users"&&role==="admin"&&<UserManagementTab showToast={showToast}/>}
        </div>
      </div>
    </div>
    {toasts.length>0&&<div style={{position:"fixed",top:68,right:20,zIndex:9999,display:"flex",flexDirection:"column",gap:7,pointerEvents:"none"}}>{toasts.map(t=>(<div key={t.id} style={{padding:"10px 18px",borderRadius:8,fontSize:12,fontWeight:700,color:"white",boxShadow:"0 4px 18px rgba(0,0,0,.2)",maxWidth:300,background:t.type==="success"?C.green:t.type==="error"?C.red:C.amberD}}>{t.msg}</div>))}</div>}
    {showProfile&&<ProfileModal onClose={()=>setShowProfile(false)} showToast={showToast}/>}
    {showChangePassword&&<ChangePasswordModal onClose={()=>setShowChangePassword(false)} showToast={showToast}/>}
  </>
  );
}
