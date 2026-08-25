// ═══════════════════════════════════════════════════════════════════════════
// src/export/toB64.js — FileReader → base64 helper.
// Split out of QuotationApp.jsx (Phase 3). Used by handleTemplateLoad to
// persist an uploaded xlsx master template into localStorage.
// ═══════════════════════════════════════════════════════════════════════════

export const toB64=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(f);});
