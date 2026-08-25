// ═══════════════════════════════════════════════════════════════════════════
// src/ui/primitives.jsx — shared inline-styled form/UI primitives.
//
// Split out of QuotationApp.jsx (Phase 3). Inline styles only, per project
// convention: no CSS files, no Tailwind, no className styling.
//
// Stateless and hook-free - safe to render anywhere.
// ═══════════════════════════════════════════════════════════════════════════
import { C, mono } from "../theme.js";
import { inputSt } from "./styles.js";

export const Inp=({value,onChange,placeholder,type="text",st={},step})=>
  <input value={value??""} type={type} step={step} onChange={e=>onChange(e.target.value)}
    placeholder={placeholder} style={{...inputSt,...st}}/>;
export const Sel=({value,onChange,opts,ph=""})=>
  <select value={value??""} onChange={e=>onChange(e.target.value)}
    style={{...inputSt,color:(value!==undefined&&value!==null&&value!=="")?C.slate:C.slateL}}>
    {ph&&<option value="">{ph}</option>}
    {opts.map(o=><option key={o.v??o} value={o.v??o}>{o.l??o}</option>)}
  </select>;
export const Btn=({ch,onClick,v="primary",sm,full,disabled,style:sx={}})=>{
  const vs={primary:{background:C.amber,color:C.white},
    secondary:{background:C.white,color:C.slateM,border:`1px solid ${C.border}`},
    ghost:{background:"transparent",color:C.slateL,border:"none"},
    success:{background:C.green,color:C.white},danger:{background:C.red,color:C.white},
    info:{background:"#2E6094",color:C.white}};
  return<button onClick={disabled?undefined:onClick} style={{
    padding:sm?"5px 12px":"8px 16px",borderRadius:6,fontSize:sm?11:13,fontWeight:600,
    cursor:disabled?"not-allowed":"pointer",border:"none",width:full?"100%":"auto",
    opacity:disabled?.45:1,...vs[v],...sx}}>{ch}</button>;
};
export const SH=({title,sub})=>(
  <div style={{borderBottom:`1px solid ${C.amber}`,paddingBottom:3,marginBottom:8}}>
    <div style={{fontSize:9,fontWeight:700,color:C.amber,textTransform:"uppercase",letterSpacing:"0.09em"}}>{title}</div>
    {sub&&<div style={{fontSize:10,color:C.slateL,marginTop:1}}>{sub}</div>}
  </div>);
// latent: form-row wrapper. No call site today - the Costing tab lays its
// fields out inline. Retained as a reachable export rather than deleted.
export const FR=({label,required,children,hint,cols})=>(
  <div style={{marginBottom:5}}>
    <label style={{fontSize:10,fontWeight:600,color:C.slateM,textTransform:"uppercase",
      letterSpacing:"0.06em",display:"block",marginBottom:3}}>
      {label}{required&&<span style={{color:C.red}}> *</span>}</label>
    {cols?<div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:6}}>{children}</div>:children}
    {hint&&<div style={{fontSize:10,color:C.slateL,marginTop:2}}>{hint}</div>}
  </div>);
export const KN=({label,val,hl,sub})=>(
  <div style={{textAlign:"center",padding:"9px 6px",background:hl?C.amber:C.white,
    borderRadius:7,border:`1px solid ${hl?"transparent":C.border}`}}>
    <div style={{fontSize:hl?17:14,fontWeight:800,color:hl?C.white:C.slate,fontFamily:mono}}>{val||"—"}</div>
    {sub&&<div style={{fontSize:9,color:hl?"rgba(255,255,255,.7)":C.slateL,marginTop:1}}>{sub}</div>}
    <div style={{fontSize:9,fontWeight:600,color:hl?"rgba(255,255,255,.6)":C.slateL,
      marginTop:2,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</div>
  </div>);
