// ═══════════════════════════════════════════════════════════════════════════
// src/state/useUiState.js
//
// App chrome + transient tab-local UI state.
// Must be composed FIRST: showToast is referenced by handlers across every
// other slice. The clTab* trio lives here
// only until Phase 6 makes them local state inside their extracted tabs.
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
  const[toasts,setToasts]=useState([]);
  const showToast=(msg,type='success',dur=2800)=>{
    const id=Date.now();
    setToasts(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),dur);
  };
  const[clTabQuery,setClTabQuery]=useState('');
  const[clTabFilter,setClTabFilter]=useState({sector:'',client:'',status:'active'});
  const[clTabExpandedConstr,setClTabExpandedConstr]=useState(null);

  return { clTabExpandedConstr, clTabFilter, clTabQuery, profile, role, setClTabExpandedConstr, setClTabFilter, setClTabQuery, setShowChangePassword, setShowProfile, setSidebarCollapsed, setTab, setToasts, showChangePassword, showProfile, showToast, sidebarCollapsed, signOut, tab, toasts };
}
