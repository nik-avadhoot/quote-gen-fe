import ChangePasswordModal from "./ChangePasswordModal.jsx";
import ProfileModal from "./ProfileModal.jsx";

// ── Tabs (Phase 6 refactor) ──────────────────────────────────────────────
import FreightTab from "./tabs/FreightTab.jsx";
import RateMasterTab from "./tabs/RateMasterTab.jsx";
import DefaultsTab from "./tabs/DefaultsTab.jsx";
import ConstructionLibTab from "./tabs/ConstructionLibTab.jsx";
import QuoteItemsTab from "./tabs/QuoteItemsTab.jsx";
import CostingTab from "./tabs/costing/CostingTab.jsx";
import BatchEntryTab from "./tabs/batch/BatchEntryTab.jsx";
import UserManagementTab from "./tabs/UserManagementTab.jsx";

// ── Shell chrome (Phase 8 refactor) ──────────────────────────────────────
import Sidebar from "./ui/Sidebar.jsx";
import ToastStack from "./ui/ToastStack.jsx";
import TopBar from "./ui/TopBar.jsx";
import { C, sans } from "./theme.js";

// ── State layer (Phase 4 refactor) ───────────────────────────────────────
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

// What is left here is chrome that belongs to no tab: the autosave banner, the
// toast stack (now ui/ToastStack.jsx), two modals, and the tab switch itself.
// Components below this line take NO props for shared state - they each call
// useAppState() directly. Do not reintroduce prop-drilling from here.
function QuotationApp(){
  const st = useAppState();
  const { autosaveBanner, restoreAutosave, role, setAutosaveBanner,
    setShowChangePassword, setShowProfile, showChangePassword, showProfile, showToast,
    tab } = st;

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
      <Sidebar/>
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        <TopBar/>
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
    <ToastStack/>
    {showProfile&&<ProfileModal onClose={()=>setShowProfile(false)} showToast={showToast}/>}
    {showChangePassword&&<ChangePasswordModal onClose={()=>setShowChangePassword(false)} showToast={showToast}/>}
  </>
  );
}
