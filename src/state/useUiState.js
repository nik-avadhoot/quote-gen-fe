// ═══════════════════════════════════════════════════════════════════════════
// src/state/useUiState.js
//
// App chrome + transient tab-local UI state.
// Must be composed FIRST: showToast is referenced by handlers across every
// other slice. All the form-scratch state that once lived here is now local
// to the tabs extracted in Phase 6.
//
// Extracted verbatim from QuotationApp.jsx (Phase 4). The bodies below are
// byte-identical to the monolith; only the surrounding closure changed.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { getItem, setItem } from "../lib/persist.js";

export function useUiState(){
  const{profile,signOut}=useAuth();
  const role=profile?.role||"maker"; // maker | admin | checker — sourced from the logged-in account
  const[showChangePassword,setShowChangePassword]=useState(false);
  const[showProfile,setShowProfile]=useState(false);
  const[sidebarCollapsed,setSidebarCollapsed]=useState(()=>getItem('qgos_sidebar_collapsed')==='1');
  useEffect(()=>{try{setItem('qgos_sidebar_collapsed',sidebarCollapsed?'1':'0');}catch(e){}},[sidebarCollapsed]);
  const[tab,setTab]=useState("costing");
  // Construction Library view state. Deliberately SHARED, not local to the tab —
  // see the header note in tabs/ConstructionLibTab.jsx. Filter and search are
  // "I've narrowed my view" state and must survive a tab switch; the library is
  // meant to grow into a deep reference set, so re-typing a search every time the
  // user glances at Batch Entry is friction that scales with the data.
  const[clTabQuery,setClTabQuery]=useState('');
  const[clTabFilter,setClTabFilter]=useState({sector:'',client:'',status:'active'});
  const[toasts,setToasts]=useState([]);
  // Toast ids were Date.now(), so two toasts raised inside one millisecond shared
  // an id: React logged "two children with the same key" and the first toast's
  // dismiss timer filtered BOTH out. Observed during C3 verification, on the
  // Send-to-Batch-Entry path that raises several at once.
  //
  // COLLISION-RESISTANT, not collision-proof - randomUUID has a negligible but
  // non-zero collision probability, and the fallback's 40 bits of randomness is
  // weaker still. That is far below the rate at which anything else here fails.
  //
  // Deliberately NOT a module-level counter: Vite replaces this module on HMR
  // while toasts raised by the previous instance are still mounted, so a counter
  // restarts at zero and collides with them. This holds no state at all.
  // randomUUID needs a secure context, which localhost and the deployment both
  // are; the fallback covers anything that is not.
  const newToastId=()=>
    (globalThis.crypto?.randomUUID?.()
      ??`${Date.now()}-${Math.random().toString(36).slice(2,10)}`);
  const showToast=(msg,type='success',dur=2800)=>{
    const id=newToastId();
    setToasts(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),dur);
  };
  // D-12: remove one toast early, on click. The showToast timer above still
  // fires afterwards and filters an id that is already gone — a harmless no-op,
  // so there is nothing to cancel.
  const dismissToast=id=>setToasts(p=>p.filter(t=>t.id!==id));

  return { clTabFilter, clTabQuery, dismissToast, profile, role, setShowChangePassword, setClTabFilter, setClTabQuery, setShowProfile, setSidebarCollapsed, setTab, setToasts, showChangePassword, showProfile, showToast, sidebarCollapsed, signOut, tab, toasts };
}
