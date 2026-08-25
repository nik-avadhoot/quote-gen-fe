// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/DefaultsTab.jsx — sector defaults, box-type trim table, partitions.
//
// Extracted from QuotationApp.jsx (Phase 6c).
//
// newSector is now LOCAL state. The monolith carried an explicit admission at
// its declaration — "hoisted to component level (Rules of Hooks: useState
// cannot be called inside a conditional or an IIFE in JSX — doing so caused a
// blank screen when switching to Admin role)". That comment is deleted here
// because it is no longer true: this is a real component, so the Add-Sector
// form owns its own state and the IIFE constraint is gone.
//
// ⚠️ UPSTREAM OF NEGATIVE CASE 4. Sector waste/conv values feed the wastePP
// resolution in useCostingResult (_sectorForCalc → _wasteDefPP/_convDefPP).
// Nothing here changes those values or how they are read — this phase moves
// the editing UI only — but edits made on this tab do change costing output.
//
// Deliberate cross-domain reads, do NOT "clean up" — these ARE the guards:
//   * batchProfile.sector + constructionLib gate sector CODE renaming, since
//     the code is the join key across both.
//   * the same pair gates DELETION, and the source records that an earlier
//     version wrongly checked batchRows per-row instead of batchProfile
//     batch-wide.
//
// The cbb_boxtrim "Reset to Defaults" write goes through lib/persist.js, as
// routed in 4c. Do not unwrap it back to raw localStorage.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { DEFAULT_BOX_TRIM_DATA } from "../data/defaults.js";
import { setItem } from "../lib/persist.js";
import { Btn } from "../ui/primitives.jsx";
import { useAppState } from "../state/AppStateContext.js";
import { C, mono, sans } from "../theme.js";

export default function DefaultsTab(){
  const {
    role, showToast, sectors, setSectors, boxTrim, setBoxTrim,
    partitionsMaster, setPartitionsMaster, batchProfile, constructionLib,
  } = useAppState();
  const[newSector,setNewSector]=useState({code:"",name:"",wasteCBB:5,wastePP:5,convBox:7,convPP:12.5,specLang:"BS"});

  return(
    <div style={{overflowY:"auto",height:"100%",padding:20}}>
      {/* SECTOR DEFAULTS */}
      <div style={{marginBottom:28}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.slate}}>Sector Defaults</div>
            <div style={{fontSize:11,color:C.slateL}}>Editable by Admin. Selecting a sector in Costing tab auto-populates Waste%, Conv rates.</div>
          </div>
          {role!=="admin"&&<span style={{fontSize:11,color:C.slateL}}>Switch to Admin to edit</span>}
          {role==="admin"&&<span style={{fontSize:11,color:C.green,fontWeight:600}}>⚙ Admin — edit enabled</span>}
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:800}}>
            <thead><tr style={{background:C.slateM}}>
              {["Sector Code","Sector Name","Waste% (CBB)","Waste% (P&P)","Conv Rs/kg (Box)","Conv Rs/kg (P&P)","Spec Language",...(role==="admin"?[""]:[])].map(h=>(
                <th key={h} style={{padding:"7px 10px",color:C.white,fontSize:10,fontWeight:600,
                  textAlign:h==="Sector Code"||h==="Sector Name"?"left":"center",whiteSpace:"pre"}}>{h}</th>))}
            </tr></thead>
            <tbody>
              {sectors.map((row,i)=>{
                const upd=(field,val)=>setSectors(prev=>prev.map((r,j)=>j===i?{...r,[field]:val}:r));
                const EditNum=({field,w=60})=>role==="admin"
                  ?<input type="number" step="0.5" value={row[field]} onChange={e=>upd(field,+e.target.value)}
                     style={{width:w,padding:"3px 5px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center",fontFamily:mono}}/>
                  :<span style={{fontFamily:mono}}>{row[field]}</span>;
                const EditStr=({field,w=80})=>role==="admin"
                  ?<input type="text" value={row[field]} onChange={e=>upd(field,e.target.value)}
                     style={{width:w,padding:"3px 5px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}/>
                  :<span>{row[field]}</span>;
                return<tr key={row.code} style={{background:i%2?C.cream:C.white}}>
                  <td style={{padding:"5px 8px",fontWeight:700,color:C.slateM,fontFamily:mono,fontSize:11}}>
                    {role==="admin"&&(()=>{
                      // Code is the join key across batchProfile.sector and constructionLib.sector.
                      // Editing it character-by-character orphans every reference at the first keystroke.
                      // Allow edit only while the code is unreferenced — covers typo-fixing just after
                      // adding. Once referenced, show as read-only with a title hint.
                      const isReferenced=batchProfile.sector===row.code||
                        constructionLib.some(c=>c.sector===row.code);
                      return isReferenced
                        ?<span style={{fontFamily:mono,fontWeight:700,fontSize:11,
                            cursor:"not-allowed",borderBottom:`1px dashed ${C.border}`}}
                            title={`Code locked — referenced by ${batchProfile.sector===row.code?"the active Batch Profile":""}`+
                              `${constructionLib.some(c=>c.sector===row.code)?` ${constructionLib.filter(c=>c.sector===row.code).length} construction(s)`:""}. `+
                              `To rename, first re-assign all references, then edit the code.`}>
                          {row.code}
                        </span>
                        :<input type="text" value={row.code}
                            onChange={e=>upd("code",e.target.value.toUpperCase())}
                            title="Code is editable while unreferenced. Will lock once used."
                            style={{width:90,padding:"3px 5px",border:`1px solid ${C.border}`,borderRadius:4,
                              fontSize:11,fontFamily:mono,fontWeight:700,textTransform:"uppercase"}}/>;
                    })()}
                    {role!=="admin"&&<span>{row.code}</span>}
                  </td>
                  <td style={{padding:"5px 8px",color:C.slateL,fontSize:11}}><EditStr field="name" w={160}/></td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}><EditNum field="wasteCBB"/>%</td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}><EditNum field="wastePP"/>%</td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}><EditNum field="convBox" w={65}/></td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}><EditNum field="convPP" w={65}/></td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}><EditStr field="specLang" w={80}/></td>
                  {role==="admin"&&<td style={{padding:"4px 6px",textAlign:"center"}}>
                    <button onClick={()=>{
                      // Delete guard: check batchProfile and constructionLib usage
                      // Bug fix: old guard used batchRows.filter(r=>batchProfile.sector===row.code)
                      // — predicate never referenced r, so .length = all rows or 0.
                      // Correct: check batchProfile.sector directly (batch-wide, not per row).
                      const profileUses=batchProfile.sector===row.code;
                      const inConstr=constructionLib.filter(c=>c.sector===row.code).length;
                      const msg=`Delete sector [${row.code}]?`
                        +(profileUses?`\n⚠️ Active Batch Profile uses this sector.`:"")
                        +(inConstr>0?`\n⚠️ ${inConstr} construction(s) reference this sector.`:"")
                        +"\nThis cannot be undone.";
                      if(window.confirm(msg))setSectors(prev=>prev.filter((_,j)=>j!==i));
                    }} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:15,padding:"0 4px"}}>×</button>
                  </td>}
                </tr>;})}
            </tbody>
          </table>
        </div>
        {role==="admin"&&<div style={{marginTop:8,fontSize:10,color:C.slateL}}>
          Changes apply immediately. Selecting a sector in the Costing form auto-fills Waste% (CBB) and Conv Rs/kg (Box).</div>}
        {role==="admin"&&(()=>{
          const ns=newSector;
          const setNs=setNewSector;
          const codeOk=ns.code.trim()&&!sectors.find(s=>s.code===ns.code.trim().toUpperCase());
          return<div style={{display:"flex",gap:6,alignItems:"center",marginTop:8,flexWrap:"wrap"}}>
            <span style={{fontSize:10,fontWeight:700,color:C.slateM}}>+ Add Sector:</span>
            {[["Code",60,"code"],[" Name",120,"name"]].map(([lbl,w,k])=>
              <input key={k} type="text" placeholder={lbl} value={ns[k]}
                onChange={e=>setNs(p=>({...p,[k]:k==="code"?e.target.value.toUpperCase():e.target.value}))}
                style={{width:w,padding:"3px 6px",border:`1px solid ${codeOk||!ns.code?C.border:C.red}`,
                  borderRadius:4,fontSize:11,fontFamily:k==="code"?mono:sans}}/>)}
            {[["Waste%",48,"wasteCBB",0.5],["WastePP%",48,"wastePP",0.5],
              ["ConvBox",52,"convBox",0.5],["ConvPP",52,"convPP",0.5]].map(([lbl,w,k,step])=>
              <input key={k} type="number" step={step} placeholder={lbl} value={ns[k]}
                onChange={e=>setNs(p=>({...p,[k]:+e.target.value}))}
                style={{width:w,padding:"3px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,fontFamily:mono,textAlign:"center"}}/>)}
            <input type="text" placeholder="SpecLang" value={ns.specLang}
              onChange={e=>setNs(p=>({...p,specLang:e.target.value}))}
              style={{width:70,padding:"3px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}/>
            <button disabled={!codeOk} onClick={()=>{
              setSectors(prev=>[...prev,{...ns,code:ns.code.trim().toUpperCase()}]);
              setNs({code:"",name:"",wasteCBB:5,wastePP:5,convBox:7,convPP:12.5,specLang:"BS"});
              showToast(`✅ Sector [${ns.code.toUpperCase()}] added`,'success');
            }} style={{padding:"4px 10px",borderRadius:4,border:"none",
              background:codeOk?C.green:"#CCC",color:C.white,fontSize:11,fontWeight:700,
              cursor:codeOk?"pointer":"not-allowed"}}>+ Add</button>
            {ns.code&&!codeOk&&sectors.find(s=>s.code===ns.code.toUpperCase())&&
              <span style={{fontSize:10,color:C.red}}>Code already exists</span>}
          </div>;
        })()}
      </div>

      {/* BOX TYPE TRIM DEFAULTS */}
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.slate}}>Box Type Trim Defaults</div>
            <div style={{fontSize:11,color:C.slateL}}>Auto-fills trim margins in the Costing form when box type is selected. Override per SKU if needed.</div>
          </div>
        </div>
        <table style={{borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:C.slateM}}>
            {["Box Type","3-ply Dkl","3-ply Cut","5-ply Dkl","5-ply Cut","Deckle Formula","Cutting Formula"].map(h=>(
              <th key={h} style={{padding:"7px 14px",color:C.white,fontSize:10,fontWeight:600,
                textAlign:h==="Box Type"?"left":"center"}}>{h}</th>))}
          </tr></thead>
          <tbody>
            {Object.entries(boxTrim).map(([bt,t],i)=>{
              const upd=(field,val)=>setBoxTrim(prev=>({...prev,[bt]:{...prev[bt],[field]:+val}}));
              const TCell=({field})=>role==="admin"
                ?<input type="number" step="1" value={t[field]} onChange={e=>upd(field,e.target.value)}
                   style={{width:70,padding:"3px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:12,textAlign:"center",fontFamily:mono}}/>
                :<span style={{fontFamily:mono,fontWeight:600}}>{t[field]}</span>;
              return<tr key={bt} style={{background:i%2?C.cream:C.white}}>
                <td style={{padding:"5px 14px",fontWeight:700,color:C.slateM}}>{bt}</td>
                <td style={{padding:"4px 10px",textAlign:"center"}}><TCell field="d3"/></td>
                <td style={{padding:"4px 10px",textAlign:"center"}}><TCell field="c3"/></td>
                <td style={{padding:"4px 10px",textAlign:"center"}}><TCell field="d5"/></td>
                <td style={{padding:"4px 10px",textAlign:"center"}}><TCell field="c5"/></td>
                <td style={{padding:"4px 8px",fontSize:9,color:C.slateL,fontStyle:"italic"}}>{t.deckleF||"—"}</td>
                <td style={{padding:"4px 8px",fontSize:9,color:C.slateL,fontStyle:"italic"}}>{t.cuttingF||"—"}</td>
              </tr>;})}
          </tbody>
        </table>
        {role!=="admin"&&<div style={{marginTop:8,fontSize:11,color:C.amberD,padding:"6px 10px",background:"#FFF8ED",borderRadius:6}}>
          Switch to Admin role to edit trim margins.</div>}
        <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center"}}>
          {role==="admin"&&<button onClick={()=>{
            const fresh={...DEFAULT_BOX_TRIM_DATA};
            setBoxTrim(fresh);
            try{setItem('cbb_boxtrim',JSON.stringify(fresh));}catch(e){}
            }} style={{padding:"4px 12px",borderRadius:5,border:`1px solid ${C.border}`,
              background:C.white,color:C.slateM,fontSize:11,cursor:"pointer",fontWeight:600}}>
            ↺ Reset to Defaults</button>}
          <div style={{fontSize:10,color:C.slateL}}>
            PP: trim=0 · Board: trim=10mm · Custom: 0 · Changes are saved automatically.</div>
        </div>
      </div>

      {/* PARTITIONS MASTER */}
      <div style={{marginTop:24,paddingTop:20,borderTop:`1px solid ${C.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.slate}}>Partitions Master — Alcobev Glass SKU</div>
            <div style={{fontSize:11,color:C.slateL}}>Nos per set by SKU type. Auto-fills Nos/Set when Glass SKU is selected in the SET config for Partition-L and Partition-W rows.</div>
          </div>
          {role==="admin"&&<Btn ch="+ Add SKU" v="success" sm onClick={()=>setPartitionsMaster(prev=>[...prev,{skuType:"New SKU",lwise:1,wwise:1}])}/>}
        </div>
        <table style={{borderCollapse:"collapse",fontSize:12,minWidth:480}}>
          <thead><tr style={{background:C.slateM}}>
            {["SKU Type","Part-L (Length-wise nos)","Part-W (Width-wise nos)",...(role==="admin"?[""]:[])]
              .map(h=><th key={h} style={{padding:"7px 14px",color:C.white,fontSize:10,fontWeight:600,textAlign:h==="SKU Type"?"left":"center"}}>{h}</th>)}
          </tr></thead>
          <tbody>{partitionsMaster.map((row,i)=>(
            <tr key={i} style={{background:i%2?C.cream:C.white}}>
              <td style={{padding:"5px 14px",fontWeight:600,color:C.slateM}}>
                {role==="admin"?<input value={row.skuType} onChange={e=>setPartitionsMaster(prev=>prev.map((r,j)=>j===i?{...r,skuType:e.target.value}:r))}
                  style={{border:`1px solid ${C.border}`,borderRadius:4,padding:"3px 7px",fontSize:12,width:140}}/>
                :row.skuType}
              </td>
              {["lwise","wwise"].map(field=>(
                <td key={field} style={{padding:"4px 14px",textAlign:"center"}}>
                  {role==="admin"?<input type="number" min="0" step="1" value={row[field]}
                    onChange={e=>setPartitionsMaster(prev=>prev.map((r,j)=>j===i?{...r,[field]:+e.target.value}:r))}
                    style={{width:60,padding:"3px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:12,textAlign:"center",fontFamily:mono}}/>
                  :<span style={{fontFamily:mono,fontWeight:700,fontSize:13}}>{row[field]}</span>}
                </td>))}
              {role==="admin"&&<td style={{padding:"3px 4px",textAlign:"center"}}>
                <button onClick={()=>setPartitionsMaster(prev=>prev.filter((_,j)=>j!==i))}
                  style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:16}}>×</button>
              </td>}
            </tr>))}
          </tbody>
        </table>
        {role!=="admin"&&<div style={{marginTop:8,fontSize:11,color:C.amberD,padding:"6px 10px",background:"#FFF8ED",borderRadius:6}}>
          Switch to Admin to edit the Partitions Master.</div>}
      </div>
    </div>
  );
}
