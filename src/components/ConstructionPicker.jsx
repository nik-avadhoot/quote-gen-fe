// Shared, selection-only Construction Library slide-over.
//
// Batch Builder and Costing START use the same search, filters, preview and
// usability boundary. Their write semantics remain in their thin wrappers:
// Batch Builder links a row; Costing copies a construction into its draft.
import { constrAutoName } from "../lib/constructionName.js";
import { isUsableConstruction } from "../lib/constructionIdentity.js";
import { C, mono } from "../theme.js";

export default function ConstructionPicker({
  open, constructions, query, onQueryChange, filter, onFilterChange,
  selectedCode, contextLabel, onClose, onOpenLibrary, onSelect,
  // Optional in-place creation. `onCreate` is absent wherever the caller may
  // not create one, and `createPanel` is what that caller renders in its place
  // — the picker itself decides nothing about authority or destination.
  onCreate, createPanel,
}){
  if(!open)return null;
  const oq=(query||'').toLowerCase();
  const of=filter||{};
  const activeConstructions=(constructions||[]).filter(c=>(c.status||'active')==='active');
  const usableActiveConstructions=activeConstructions.filter(isUsableConstruction);
  const filtered=usableActiveConstructions.filter(c=>{
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
    return (c.code||'').toLowerCase().includes(oq)||autoN.includes(oq)||
      (c.name||'').toLowerCase().includes(oq)||(c.sector||'').toLowerCase().includes(oq)||
      (c.client||'').toLowerCase().includes(oq);
  });
  const hasFilters=query||of.sector||of.client||of.gsm_min||of.gsm_max||
    of.bs_min||of.bct_min||of.ect_min||of.cobb_max;
  const hasSpecFilters=of.gsm_min||of.gsm_max||of.bs_min||of.bct_min||of.ect_min||of.cobb_max;
  const clearFilters=()=>{
    onQueryChange('');
    onFilterChange({sector:'',client:''});
  };

  return <>
    <div onClick={onClose} style={{position:"absolute",top:0,left:0,right:400,bottom:0,zIndex:199,
      background:"rgba(0,0,0,0.15)",cursor:"pointer"}}/>
    <section role="dialog" aria-modal="true" aria-label="Choose existing construction"
      style={{position:"absolute",top:0,right:0,bottom:0,width:400,zIndex:200,
        display:"flex",flexDirection:"column",background:C.white,
        borderLeft:`2px solid ${C.amber}`,boxShadow:"-4px 0 24px rgba(0,0,0,.18)"}}>
      <div style={{padding:"10px 14px",background:C.slateM,display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,fontWeight:700,color:C.amber}}>📚 Construction Library</div>
          {contextLabel&&<div style={{fontSize:10,color:"rgba(255,255,255,.6)",marginTop:1,
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>↳ {contextLabel}</div>}
        </div>
        {onCreate&&<button onClick={onCreate} title="Add a governed Construction for this Batch's plant"
          style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${C.green}`,
            background:"transparent",color:C.green,fontSize:10,fontWeight:700,cursor:"pointer"}}>
          + New
        </button>}
        <button onClick={onOpenLibrary} title="Open full Construction Library tab"
          style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${C.amber}`,
            background:"transparent",color:C.amber,fontSize:10,fontWeight:700,cursor:"pointer"}}>
          ⬡ Full Library
        </button>
        <button onClick={onClose} aria-label="Close construction picker"
          style={{background:"none",border:"none",color:"rgba(255,255,255,.6)",cursor:"pointer",
            fontSize:18,lineHeight:1,padding:"0 2px"}}>×</button>
      </div>

      {createPanel&&<div style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}`,
        background:C.cream,flexShrink:0,maxHeight:"60%",overflow:"auto"}}>{createPanel}</div>}

      <div style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}`,background:C.cream,flexShrink:0}}>
        <input value={query||''} onChange={e=>onQueryChange(e.target.value)}
          placeholder="Search code, name, sector, client…"
          style={{width:"100%",padding:"5px 8px",border:`1px solid ${query?C.amber:C.border}`,
            borderRadius:5,fontSize:11,boxSizing:"border-box",marginBottom:6}}/>
        <div style={{display:"flex",gap:5,marginBottom:5}}>
          <select value={of.sector||''}
            onChange={e=>onFilterChange(p=>({...p,sector:e.target.value,client:''}))}
            style={{flex:1,padding:"3px 6px",border:`1px solid ${of.sector?C.amber:C.border}`,
              borderRadius:4,fontSize:10,color:C.slate,background:C.white}}>
            <option value="">All Sectors</option>
            {[...new Set(usableActiveConstructions.map(c=>c.sector||'').filter(Boolean))].sort()
              .map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <select value={of.client||''}
            onChange={e=>onFilterChange(p=>({...p,client:e.target.value}))}
            style={{flex:1,padding:"3px 6px",border:`1px solid ${of.client?C.amber:C.border}`,
              borderRadius:4,fontSize:10,color:C.slate,background:C.white}}>
            <option value="">All Clients</option>
            {[...new Set(usableActiveConstructions
              .filter(c=>!of.sector||(c.sector||'')===of.sector)
              .map(c=>c.client||'').filter(Boolean))].sort()
              .map(client=><option key={client} value={client}>{client}</option>)}
          </select>
          {hasFilters&&<button onClick={clearFilters}
            style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${C.red}33`,
              background:"transparent",color:C.red,fontSize:10,cursor:"pointer",fontWeight:600}}>✕ Clear</button>}
        </div>
        <button onClick={()=>onFilterChange(p=>({...p,_showSpec:!p._showSpec}))}
          style={{fontSize:9,color:hasSpecFilters?C.amber:C.slateL,background:"none",border:"none",
            cursor:"pointer",padding:"1px 0",fontWeight:hasSpecFilters?700:400,width:"100%",textAlign:"left"}}>
          {of._showSpec?"▴":"▾"} Filter by STD specs{hasSpecFilters?' (active)':''}
        </button>
        {of._showSpec&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"3px 6px",
          marginTop:4,padding:"6px 8px",background:C.white,borderRadius:4,border:`1px solid ${C.border}`}}>
          {[["gsm_min","GSM ≥"],["gsm_max","GSM ≤"],["bs_min","BS ≥"],
            ["bct_min","BCT ≥"],["ect_min","ECT ≥"],["cobb_max","Cobb ≤"]].map(([key,label])=>(
            <div key={key} style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={{fontSize:8,color:C.slateL,whiteSpace:"nowrap",minWidth:40}}>{label}</span>
              <input type="number" step={0.25} value={of[key]||''}
                onChange={e=>onFilterChange(p=>({...p,[key]:e.target.value}))}
                style={{flex:1,padding:"2px 4px",border:`1px solid ${of[key]?C.amber:C.border}`,
                  borderRadius:3,fontSize:9,textAlign:"center"}}/>
            </div>))}
        </div>}
        <div style={{fontSize:9,color:C.slateL,marginTop:4}}>
          {filtered.length} of {usableActiveConstructions.length} usable shown
          {activeConstructions.length>usableActiveConstructions.length
            ?` · ${activeConstructions.length-usableActiveConstructions.length} incomplete hidden`:''}
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"8px 12px"}}>
        {filtered.length===0&&<div style={{textAlign:"center",color:C.slateL,padding:"24px 0",fontSize:12}}>
          <div>No matching constructions</div>
          <button onClick={onOpenLibrary} style={{background:"none",border:"none",color:C.amber,
            cursor:"pointer",textDecoration:"underline",fontSize:10,marginTop:8}}>
            → Create one in the Construction Library tab
          </button>
        </div>}
        {filtered.map(c=>{
          const autoN=constrAutoName(c);
          const isSelected=selectedCode===c.code;
          return <button type="button" key={c.code} onClick={()=>onSelect(c)}
            style={{display:"block",width:"100%",padding:"8px 10px",marginBottom:5,borderRadius:6,
              cursor:"pointer",textAlign:"left",border:`1px solid ${isSelected?C.amber:C.border}`,
              background:isSelected?C.amberL:C.white,transition:"background 0.15s"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
              <span style={{fontWeight:800,color:C.amber,fontFamily:mono,fontSize:13,
                flexShrink:0,minWidth:26}}>{c.code}</span>
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
              <span style={{fontSize:10,color:C.amber,fontWeight:700,flexShrink:0}}>
                {isSelected?'Selected':'Select →'}
              </span>
            </div>
          </button>;
        })}
      </div>

      <div style={{padding:"8px 12px",borderTop:`1px solid ${C.border}`,background:C.cream,flexShrink:0}}>
        <div style={{fontSize:10,color:C.slateL,textAlign:"center"}}>
          To create or edit constructions, use the{' '}
          <button onClick={onOpenLibrary} style={{background:"none",border:"none",color:C.amber,
            cursor:"pointer",textDecoration:"underline",fontSize:10,fontWeight:700}}>
            Construction Library tab
          </button>
        </div>
      </div>
    </section>
  </>;
}
