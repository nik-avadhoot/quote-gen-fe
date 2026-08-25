// ═══ src/ui/Sidebar.jsx — app navigation rail ══════════════════════════
//
// Extracted from QuotationApp.jsx (Phase 8). Structural move only.
//
// NAV_ITEMS travels WITH the sidebar rather than living in a constants file:
// two of its entries carry live counts (items.length, constructionLib.length)
// and one is role-gated, so it is derived state, not configuration. Adding a
// master tab is still a one-line change - it is just a line in here.
// ════════════════════════════════════════════════════════════════════════
import { useAppState } from "../state/AppStateContext.js";
import { C, sans } from "../theme.js";

export default function Sidebar(){
  const { constructionLib, items, role, setSidebarCollapsed, setTab,
    sidebarCollapsed, tab } = useAppState();
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
  return(
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
}
