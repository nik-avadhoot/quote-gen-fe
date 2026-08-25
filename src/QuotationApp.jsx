import { Fragment } from "react";

import UserManagementTab from "./UserManagementTab.jsx";
import ChangePasswordModal from "./ChangePasswordModal.jsx";
import ProfileModal from "./ProfileModal.jsx";
import AccountMenu from "./AccountMenu.jsx";

// ── Engine & Data ─────────────────────────────────────────────────────────
import { PLANTS, BOX_TYPES } from "./data/defaults.js";
import { buildSpecFromRow, checkSpecCompliance } from "./engine/costing.js";
import { isPPType } from "./engine/rowType.js";

// ── Export modules (Phase 3 refactor) ─────────────────────────────────────

// ── Presentation (Phase 3 refactor) ───────────────────────────────────────
import { Btn } from "./ui/primitives.jsx";
import { STATUS_DISPLAY, constrAutoName } from "./lib/constructionName.js";

// ── Tabs (Phase 6 refactor) ───────────────────────────────────────────────
import FreightTab from "./tabs/FreightTab.jsx";
import RateMasterTab from "./tabs/RateMasterTab.jsx";
import DefaultsTab from "./tabs/DefaultsTab.jsx";
import ConstructionLibTab from "./tabs/ConstructionLibTab.jsx";
import QuoteItemsTab from "./tabs/QuoteItemsTab.jsx";
import CostingTab from "./tabs/costing/CostingTab.jsx";
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
    startNewBatch,
    copyCostingToProfile,
    activeBatchRowId,
    addBatchRow, autoCalcPPDims, autoCodeEnabled, autoCodeSeq, autosaveBanner,
    batchConstrOverlay, batchConstrOverlayFilter, batchConstrOverlayQuery,
    batchConstrTargetRowId, batchProfile, batchResults, batchRows, calculateAll, constructionLib, expandedRows, freight, generateCode, generateMissingCodes,
    getBatchRowStatus, handleBackup, handleRestore,
    handleRestoreFile, importConstrFromSpec, invalidateAllBatchResults,
    invalidateBatchRow, items, loadBatchRowIntoCosting, locations, partitionsMaster,
    pinnedAddOns, restoreAutosave, restoreRef, role, sectorCodes, sectors,
    sendAllToQuoteItems, setAutoCodeEnabled, setAutosaveBanner, setBatchConstrOverlay,
    setBatchConstrOverlayFilter, setBatchConstrOverlayQuery, setBatchConstrTargetRowId,
    setBatchProfile, setBatchRows, setShowChangePassword, setShowProfile,
    setSidebarCollapsed, setTab, showChangePassword, showProfile,
    showToast, sidebarCollapsed, tab,
    toasts, togglePinAddOn, toggleRowExpand,
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

  // ── BATCH ENTRY TAB ───────────────────────────────────────────────────────

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
              <button onClick={copyCostingToProfile}
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
          <button onClick={startNewBatch}
            style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${C.amber}`,
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
          {tab==="costing"&&<CostingTab/>}
          {tab==="items"&&<QuoteItemsTab/>}
          {tab==="batch"&&batchEntryTab}
          {tab==="constrlib"&&<ConstructionLibTab/>}
          {tab==="rates"&&<RateMasterTab/>}
          {tab==="defaults"&&<DefaultsTab/>}
          {tab==="freight"&&<FreightTab/>}
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
