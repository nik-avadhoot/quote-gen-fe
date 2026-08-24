// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/FreightTab.jsx — plant × location freight matrix (Rs/kg).
//
// Extracted from QuotationApp.jsx (Phase 6a). Follows the UserManagementTab
// pattern: own file, local state, inline styles, store access via useAppState().
//
// newLocation is now LOCAL state. In the monolith it had to be declared at the
// top of App() — thousands of lines from its only consumer — because Rules of
// Hooks forbid useState inside the JSX const this tab used to be. Being a real
// component is what makes it local, and that is the point of this phase.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { PLANTS } from "../data/defaults.js";
import { Btn } from "../ui/primitives.jsx";
import { useAppState } from "../state/AppStateContext.js";
import { C, mono } from "../theme.js";

export default function FreightTab(){
  const { role, locations, setLocations, freight, setFreight } = useAppState();
  const[newLocation,setNewLocation]=useState("");

  return(
    <div style={{padding:20,overflowY:"auto",height:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:C.slate,marginBottom:2}}>Freight Rate Matrix</div>
          <div style={{fontSize:11,color:C.slateL}}>Rs/kg from plant to delivery location. 3 plants: Nagpur · Pune · Kolkata</div>
        </div>
        {role==="admin"
          ?<span style={{fontSize:11,color:C.green,fontWeight:600}}>⚙ Admin — add/edit/delete enabled</span>
          :<span style={{fontSize:11,color:C.slateL}}>Switch to Admin to edit</span>}
      </div>
      {role==="admin"&&<div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,
        padding:"10px 12px",background:C.cream,borderRadius:7,border:`1px solid ${C.border}`}}>
        <span style={{fontSize:11,fontWeight:600,color:C.slateM}}>Add Location:</span>
        <input value={newLocation} onChange={e=>setNewLocation(e.target.value)}
          placeholder="e.g. Surat" style={{padding:"5px 9px",borderRadius:5,
            border:`1px solid ${C.border}`,fontSize:12,width:140}}/>
        <Btn ch="+ Add Row" v="success" sm disabled={!newLocation||locations.includes(newLocation)}
          onClick={()=>{
            setLocations(prev=>[...prev,newLocation]);
            setFreight(prev=>{const nf={...prev};
              PLANTS.forEach(p=>{nf[p]={...(nf[p]||{}),[newLocation]:0};});return nf;});
            setNewLocation("");}}/>
        <span style={{fontSize:10,color:C.slateL}}>Click cell to edit rates. × to delete a row.</span>
      </div>}
      <table style={{borderCollapse:"collapse",fontSize:12}}>
        <thead><tr>
          <th style={{padding:"7px 14px",background:C.slateM,color:C.white,textAlign:"left",
            fontSize:10,fontWeight:600,minWidth:140}}>Delivery ↓ / Plant →</th>
          {PLANTS.map(p=><th key={p} style={{padding:"7px 14px",background:C.amber,color:C.white,
            fontSize:10,fontWeight:600,minWidth:96,textAlign:"center"}}>{p}</th>)}
          {role==="admin"&&<th style={{padding:"7px 8px",background:C.slateM,color:"transparent",
            fontSize:10,width:30}}> </th>}
        </tr></thead>
        <tbody>{locations.map((loc,li)=>(
          <tr key={loc} style={{background:li%2?C.cream:C.white}}>
            <td style={{padding:"5px 14px",fontWeight:600,color:C.slateM}}>{loc}</td>
            {PLANTS.map(plant=>(
              <td key={plant} style={{padding:"3px 8px",textAlign:"center"}}>
                {role==="admin"
                  ?<input type="number" step="0.5" value={freight[plant]?.[loc]??0}
                     onChange={e=>setFreight(prev=>({...prev,[plant]:{...(prev[plant]||{}),[loc]:+e.target.value}}))}
                     style={{width:68,padding:"3px 6px",border:`1px solid ${C.border}`,borderRadius:4,
                       fontSize:12,textAlign:"center",fontFamily:mono}}/>
                  :<span style={{fontFamily:mono,color:C.slateM,fontSize:12}}>{freight[plant]?.[loc]??0}</span>}
              </td>))}
            {role==="admin"&&<td style={{padding:"3px 4px",textAlign:"center"}}>
              <button onClick={()=>{
                  setLocations(prev=>prev.filter(l=>l!==loc));
                  setFreight(prev=>{const nf={...prev};
                    PLANTS.forEach(p=>{const pl={...(nf[p]||{})};delete pl[loc];nf[p]=pl;});return nf;});}}
                style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:16,lineHeight:1}}>×</button>
            </td>}
          </tr>))}
        </tbody>
      </table>
      {role!=="admin"&&<div style={{marginTop:10,fontSize:11,color:C.amberD,
        padding:"7px 10px",background:"#FFF8ED",borderRadius:6}}>
        Switch to Admin role to add, edit or delete locations.</div>}
    </div>
  );
}
