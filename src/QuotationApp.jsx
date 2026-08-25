import UserManagementTab from "./UserManagementTab.jsx";
import ChangePasswordModal from "./ChangePasswordModal.jsx";
import ProfileModal from "./ProfileModal.jsx";
import AccountMenu from "./AccountMenu.jsx";

// ── Engine & Data ─────────────────────────────────────────────────────────

// ── Export modules (Phase 3 refactor) ─────────────────────────────────────

// ── Presentation (Phase 3 refactor) ───────────────────────────────────────

// ── Tabs (Phase 6 refactor) ───────────────────────────────────────────────
import FreightTab from "./tabs/FreightTab.jsx";
import RateMasterTab from "./tabs/RateMasterTab.jsx";
import DefaultsTab from "./tabs/DefaultsTab.jsx";
import ConstructionLibTab from "./tabs/ConstructionLibTab.jsx";
import QuoteItemsTab from "./tabs/QuoteItemsTab.jsx";
import CostingTab from "./tabs/costing/CostingTab.jsx";
import BatchEntryTab from "./tabs/batch/BatchEntryTab.jsx";
import { C, sans } from "./theme.js";

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
  const { autosaveBanner, constructionLib, handleBackup, handleRestore,
    handleRestoreFile, items, restoreAutosave, restoreRef, role,
    setAutosaveBanner, setShowChangePassword, setShowProfile, setSidebarCollapsed, setTab,
    showChangePassword, showProfile, showToast, sidebarCollapsed, tab, toasts } = st;

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
          {tab==="batch"&&<BatchEntryTab/>}
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
