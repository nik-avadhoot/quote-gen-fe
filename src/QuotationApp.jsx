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
import ProducingPlantsScreen from "./tabs/ProducingPlantsScreen.jsx";
import CustomerFamiliesScreen from "./tabs/CustomerFamiliesScreen.jsx";

// ── Shell chrome (Phase 8 refactor) ──────────────────────────────────────
import Sidebar from "./ui/Sidebar.jsx";
import ToastStack from "./ui/ToastStack.jsx";
import TopBar from "./ui/TopBar.jsx";
import { C, sans } from "./theme.js";

// ── State layer (Phase 4 refactor) ───────────────────────────────────────
import { AppStateProvider } from "./state/AppStateProvider.jsx";
import { useAppState } from "./state/AppStateContext.js";
import { hasCapability } from "./lib/capabilities.js";
import { isFeatureEnabled } from "./lib/featureFlags.js";

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

// What is left here is chrome that belongs to no tab: <ToastStack/>, two modals,
// and the tab switch itself. The autosave banner was removed with D-5 - batchRows
// now hydrates on mount, so there is nothing left for it to offer.
// Components below this line take NO props for shared state - they each call
// useAppState() directly. Do not reintroduce prop-drilling from here.
function QuotationApp(){
  const st = useAppState();
  const { profile, role, setShowChangePassword, setShowProfile,
    showChangePassword, showProfile, showToast, tab } = st;

  // ── MAIN RENDER ───────────────────────────────────────────────────────────
  return(
    <>
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
          {tab==="plants"&&isFeatureEnabled("u1_producing_plants")&&<ProducingPlantsScreen/>}
          {tab==="families"&&isFeatureEnabled("u1_customer_families")&&hasCapability(profile,"read_party_master")&&<CustomerFamiliesScreen/>}
        </div>
      </div>
    </div>
    <ToastStack/>
    {showProfile&&<ProfileModal onClose={()=>setShowProfile(false)} showToast={showToast}/>}
    {showChangePassword&&<ChangePasswordModal onClose={()=>setShowChangePassword(false)} showToast={showToast}/>}
  </>
  );
}
