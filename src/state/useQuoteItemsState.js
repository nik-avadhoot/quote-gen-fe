// ═══════════════════════════════════════════════════════════════════════════
// src/state/useQuoteItemsState.js
//
// Quote Items: the finalised item list, quote header fields and the
// xlsx template. Also owns the three file-input refs.
//
// Extracted verbatim from QuotationApp.jsx (Phase 4). The bodies below are
// byte-identical to the monolith; only the surrounding closure changed.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";

export function useQuoteItemsState(st){
  const { profile } = st;

  const[items,setItems]=useState(()=>{try{const s=localStorage.getItem('cbb_quoteitems');return s?JSON.parse(s):[];}catch(e){return[];}}); // saved quote items
  const[savedQuotes,setSavedQuotes]=useState({}); // per-customer saved drafts
  const importRef=useRef(),templateRef=useRef(),restoreRef=useRef();
  // Lazy init rather than a mount effect: setting state inside useEffect on
  // mount triggers a second render and trips react-hooks/set-state-in-effect.
  // Mirrors how templateB64 below already reads the same key.
  const[templateLoaded,setTemplateLoaded]=useState(()=>{
    try{return !!localStorage.getItem('cbb_template');}catch(e){return false;}
  });
  const today=new Date().toISOString().split('T')[0];
  const[quoteDate,setQuoteDate]=useState(today);
  const[effectiveFrom,setEffectiveFrom]=useState('');
  const[effectiveTo,setEffectiveTo]=useState('');
  const[quoteRef,setQuoteRef]=useState(()=>{
    const d=new Date();
    return`QR-${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,"0")}-001`;
  });
  const makerName=profile?.display_name||""; // sourced from the logged-in account, not free text
  const[templateB64,setTemplateB64]=useState(()=>{try{return localStorage.getItem('cbb_template')||null;}catch(e){return null;}});
  useEffect(()=>{try{localStorage.setItem('cbb_quoteitems',JSON.stringify(items));}catch(e){}},[items]);

  return { effectiveFrom, effectiveTo, importRef, items, makerName, quoteDate, quoteRef, restoreRef, savedQuotes, setEffectiveFrom, setEffectiveTo, setItems, setQuoteDate, setQuoteRef, setSavedQuotes, setTemplateB64, setTemplateLoaded, templateB64, templateLoaded, templateRef, today };
}
