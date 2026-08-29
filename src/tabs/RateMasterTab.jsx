// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/RateMasterTab.jsx — paper grade rates and the pricing rules strip.
//
// Extracted from QuotationApp.jsx (Phase 6b).
//
// newGrade is now LOCAL state — same story as newLocation in 6a: it was
// declared at the top of App(), thousands of lines from its only consumer,
// purely because Rules of Hooks forbid useState inside a JSX const.
//
// Deliberate cross-domain read, do NOT "clean up": the grade delete button
// reads constructionLib to count how many constructions use the grade before
// confirming (Fix 6). A masters tab reading the construction library is the
// point of that guard, not a smell.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { buildBlanketConfirm, gyAffected } from "../lib/blanketConfirm.js";
import { CREDIT_PCT } from "../data/defaults.js";
import { useAppState } from "../state/AppStateContext.js";
import { C, mono, sans } from "../theme.js";

export default function RateMasterTab(){
  const {
    role, showToast, rates, setRates, rateUpdatedAt, touchRateDate,
    gyPremLow, setGyPremLow, gyPremHigh, setGyPremHigh,
    blanketDisc, setBlanketDisc, blanketInterest, setBlanketInterest,
    freightBands, setFreightBands, constructionLib,
  } = useAppState();
  const[newGrade,setNewGrade]=useState({code:"",desc:"",price:"",disc:1.5});

  return(
    <div style={{padding:16,overflowY:"auto",height:"100%"}}>

      {/* ── Strip 1: Price Rules ──────────────────────────────────────────── */}
      <div style={{background:"#EEF4FB",border:"1px solid #6A9FD4",borderRadius:8,
        padding:"10px 14px",marginBottom:10}}>
        {/* Row 1: all bulk controls */}
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"nowrap",overflowX:"auto"}}>
          {/* GY Premiums */}
          <span style={{fontSize:10,fontWeight:700,color:"#2E6094",whiteSpace:"nowrap"}}>GY Premium</span>
          {[["16–24BF",gyPremLow,setGyPremLow],["28–35BF",gyPremHigh,setGyPremHigh]].map(([lbl,val,setter])=>(
            <div key={lbl} style={{display:"flex",alignItems:"center",gap:2}}>
              <span style={{fontSize:9,color:C.slateL,whiteSpace:"nowrap"}}>{lbl}</span>
              <input type="number" step="0.25" value={val} disabled={role!=="admin"}
                onChange={e=>setter(+e.target.value)}
                style={{width:46,padding:"3px 4px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center",fontFamily:mono}}/>
            </div>))}
          {role==="admin"&&<button onClick={()=>{
            // D-8b: the affected set is computed BEFORE the write, by the same helper
            // the updater uses. It used to be counted inside setRates, so the number
            // existed only afterwards — too late for a confirm, and a second count
            // could have drifted from the first.
            const _hits=gyAffected(rates,gyPremLow,gyPremHigh);
            const _c=buildBlanketConfirm({kind:"recalc",label:"GY prices",
              affected:_hits.length,total:rates.length,
              affectedCodes:_hits.map(h=>h.code),
              detail:`Each GY grade's price is overwritten with its natural grade's price plus the band premium — ₹${gyPremLow} for 16–24BF, ₹${gyPremHigh} for 28–35BF.`});
            if(!_c.actionable){showToast(_c.text,"info",5000);return;}
            if(!window.confirm(_c.text))return;
            const _by=new Map(_hits.map(h=>[h.code,h.to]));
            setRates(prev=>prev.map(gr=>_by.has(gr.code)?{...gr,price:_by.get(gr.code)}:gr));
            touchRateDate();showToast(`GY applied — ${_hits.length} grades`,"info");
          }} style={{padding:"3px 8px",borderRadius:5,border:"none",background:"#2E6094",
            color:C.white,fontSize:9,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>Apply GY</button>}

          <div style={{width:1,height:22,background:"#6A9FD4",flexShrink:0}}/>

          {/* Freight by BF Band */}
          <span style={{fontSize:10,fontWeight:700,color:"#2E6094",whiteSpace:"nowrap"}}>Freight</span>
          {[
            {lbl:"16–20BF",codes:["16","18","20","20GY"]},
            {lbl:"22–28BF",codes:["22","24","28","22GY","24GY","28GY","26HRCT"]},
            {lbl:"35BF+",codes:["35","35GY","25WTL","14DUP","40VKL"]},
          ].map((b,bi)=>(
            <div key={b.lbl} style={{display:"flex",alignItems:"center",gap:2}}>
              <span style={{fontSize:9,color:C.slateL,whiteSpace:"nowrap"}}>{b.lbl}</span>
              <input type="number" step="0.25" min="0" value={freightBands[bi]||0}
                onChange={e=>{const nv=[...freightBands];nv[bi]=+e.target.value;setFreightBands(nv);}}
                style={{width:40,padding:"3px 4px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center"}}
                disabled={role!=="admin"}/>
              {role==="admin"&&<button onClick={()=>{
                setRates(prev=>prev.map(r=>b.codes.includes(r.code)?{...r,freight:freightBands[bi]||0}:r));
                touchRateDate();showToast(`Freight ₹${freightBands[bi]||0}/kg → ${b.lbl}`,'info');
              }} style={{padding:"2px 5px",borderRadius:4,border:`1px solid ${C.amber}`,
                background:C.amberL,color:C.amberD,fontSize:9,cursor:"pointer",fontWeight:700}}>→</button>}
            </div>))}

          <div style={{width:1,height:22,background:"#6A9FD4",flexShrink:0}}/>

          {/* Blanket Discount */}
          <span style={{fontSize:10,fontWeight:700,color:"#2E6094",whiteSpace:"nowrap"}}>Disc</span>
          <input type="number" step="0.25" value={blanketDisc} disabled={role!=="admin"}
            onChange={e=>setBlanketDisc(+e.target.value)}
            style={{width:44,padding:"3px 4px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center",fontFamily:mono}}/>
          {role==="admin"&&<button onClick={()=>{
            // D-8b: one click rewrote every grade with no confirmation.
            const _c=buildBlanketConfirm({kind:"set",label:"Discount",
              valueText:`₹${(+blanketDisc).toFixed(2)}/kg`,
              affected:rates.length,total:rates.length,
              currentValues:rates.map(r=>({text:`${r.desc||r.code} ₹${(+r.disc||0).toFixed(2)}`,value:+r.disc||0}))});
            if(!_c.actionable){showToast(_c.text,'info',5000);return;}
            if(!window.confirm(_c.text))return;
            setRates(prev=>prev.map(r=>({...r,disc:blanketDisc})));
            touchRateDate();showToast(`Disc ₹${blanketDisc}/kg → all`,'info');
          }} style={{padding:"2px 7px",borderRadius:4,border:`1px solid ${C.border}`,
            background:C.white,color:C.slateM,fontSize:9,fontWeight:600,cursor:"pointer"}}>All</button>}

          <div style={{width:1,height:22,background:"#6A9FD4",flexShrink:0}}/>

          {/* Blanket Interest (credit cost %) */}
          <span style={{fontSize:10,fontWeight:700,color:"#2E6094",whiteSpace:"nowrap"}}>Credit%</span>
          <input type="number" step="0.25" value={blanketInterest} disabled={role!=="admin"}
            onChange={e=>setBlanketInterest(+e.target.value)}
            style={{width:44,padding:"3px 4px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center",fontFamily:mono}}/>
          {role==="admin"&&<button onClick={()=>{
            // D-8b: as above — every grade, one click, no confirmation.
            const _c=buildBlanketConfirm({kind:"set",label:"Credit%",
              valueText:`${(+blanketInterest).toFixed(2)}%`,
              affected:rates.length,total:rates.length,
              currentValues:rates.map(r=>({text:`${r.desc||r.code} ${(+r.interest||0).toFixed(2)}%`,value:+r.interest||0}))});
            if(!_c.actionable){showToast(_c.text,'info',5000);return;}
            if(!window.confirm(_c.text))return;
            setRates(prev=>prev.map(r=>({...r,interest:blanketInterest})));
            touchRateDate();showToast(`Credit ${blanketInterest}% → all grades`,'info');
          }} style={{padding:"2px 7px",borderRadius:4,border:`1px solid ${C.border}`,
            background:C.white,color:C.slateM,fontSize:9,fontWeight:600,cursor:"pointer"}}>All</button>}
        </div>

        {/* Row 2: footnote + date */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:5}}>
          <div style={{fontSize:9,color:"#6A9FD4"}}>
            GSM surcharge applied per layer during costing (not in Rate Master Eff Rate): &lt;100=+₹4 · =100=+₹1.5 · &gt;200=+₹1 &nbsp;|&nbsp;
            Example: 22BF=₹{rates.find(r=>r.code==="22")?.price||"—"} + GY₹{gyPremLow} → 22GY=₹{rates.find(r=>r.code==="22")?(rates.find(r=>r.code==="22").price+gyPremLow).toFixed(2):"—"}
          </div>
          <div style={{fontSize:9,color:C.slateL,textAlign:"right",whiteSpace:"nowrap",marginLeft:12}}>
            {rateUpdatedAt?<><b style={{color:"#2E6094"}}>Updated:</b> {rateUpdatedAt}</>:"Rate date not set"}
            {role==="admin"&&<> · <button onClick={touchRateDate}
              style={{background:"none",border:"none",color:"#2E6094",cursor:"pointer",fontSize:9,textDecoration:"underline",padding:0}}>
              Mark today</button></>}
          </div>
        </div>
      </div>

      {/* ── Strip 2: Add Grade (admin only) ───────────────────────────────── */}
      {role==="admin"&&<div style={{display:"flex",gap:6,alignItems:"center",
        background:C.cream,border:`1px solid ${C.border}`,borderRadius:7,
        padding:"7px 12px",marginBottom:10}}>
        <span style={{fontSize:10,fontWeight:700,color:C.amber,whiteSpace:"nowrap"}}>+ New Grade</span>
        {[
          {k:"code",ph:"Code e.g. 30GY",w:90},
          {k:"desc",ph:"Short description",w:180},
          {k:"price",ph:"Price",w:70,t:"number"},
          {k:"disc",ph:"Disc",w:55,t:"number"},
          {k:"freight",ph:"Freight",w:60,t:"number"},
        ].map(({k,ph,w,t="text"})=>(
          <input key={k} type={t} step={t==="number"?"0.25":undefined}
            value={newGrade[k]??""} placeholder={ph}
            onChange={e=>setNewGrade(g=>({...g,[k]:t==="number"?+e.target.value:e.target.value}))}
            style={{width:w,padding:"4px 7px",border:`1px solid ${C.border}`,borderRadius:5,
              fontSize:11,fontFamily:k==="code"||t==="number"?mono:sans}}/>))}
        <button onClick={()=>{
          if(!newGrade.code||!newGrade.price){showToast("Code and Price required",'error');return;}
          if(rates.find(r=>r.code===newGrade.code)){showToast("Grade code already exists",'error');return;}
          setRates(prev=>[...prev,{...newGrade,freight:newGrade.freight||0}]);
          touchRateDate();
          setNewGrade({code:"",desc:"",price:"",disc:1.5,freight:0});
        }} style={{padding:"4px 14px",borderRadius:5,border:"none",background:C.green,
          color:C.white,fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
          Add Grade</button>
        <span style={{fontSize:9,color:C.slateL,marginLeft:4}}>Eff Rate = Price + Credit% − Disc + Freight</span>
      </div>}

      {/* ── Rate Master table ─────────────────────────────────────────────── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <div style={{fontSize:13,fontWeight:700,color:C.slate}}>Rate Master
          <span style={{fontSize:10,fontWeight:400,color:C.slateL,marginLeft:8}}>
            {rates.length} grades · effective rates used in all costing</span>
        </div>
        {role==="admin"&&<span style={{fontSize:10,color:C.green,fontWeight:600}}>⚙ Admin — edit enabled</span>}
      </div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <thead><tr style={{background:C.slateM}}>
          {["Grade","Description","Paper Price","Credit %","Discount","Freight","Eff Rate",...(role==="admin"?[""]:[])].map(h=>(
            <th key={h} style={{padding:"6px 8px",color:C.white,fontSize:10,fontWeight:600,
              textAlign:["Paper Price","Credit %","Discount","Freight","Eff Rate"].includes(h)?"center":"left"}}>{h}</th>))}
        </tr></thead>
        <tbody>{rates.map((row,i)=>{
          const gCreditPct=(row.interest!=null&&row.interest!=='')?+row.interest/100:CREDIT_PCT;
          const eff=row.price?+(row.price+row.price*gCreditPct-(row.disc||0)+(row.freight||0)).toFixed(2):0;
          const fld=(k,w,step=0.5)=>role==="admin"
            ?<input value={row[k]??0} type="number" step={step}
               onChange={e=>{setRates(prev=>prev.map((r,j)=>j===i?{...r,[k]:+e.target.value}:r));touchRateDate();}}
               style={{width:w,padding:"3px 5px",border:`1px solid ${k==="freight"&&(row.freight||0)>0?C.amber:C.border}`,
                 borderRadius:4,fontSize:11,textAlign:"center",fontFamily:mono,
                 background:k==="freight"&&(row.freight||0)>0?"#FFF8ED":C.white}}/>
            :<span style={{fontFamily:mono,color:k==="freight"&&(row.freight||0)>0?C.amberD:C.slateL}}>
               {row[k]||"—"}</span>;
          return<tr key={row.code} style={{background:i%2?C.cream:C.white,borderBottom:`1px solid ${C.border}22`}}>
            <td style={{padding:"4px 8px",fontWeight:700,color:C.slateM,fontFamily:mono,fontSize:12}}>{row.code}</td>
            <td style={{padding:"4px 8px",color:C.slateL,fontSize:11,maxWidth:200}}>{row.desc}</td>
            <td style={{padding:"4px 8px",textAlign:"center"}}>{fld("price",65,0.5)}</td>
            <td style={{padding:"4px 6px",textAlign:"center"}}>
              {role==="admin"
                ?<input value={row.interest??1.5} type="number" step="0.25" min="0" max="5"
                   onChange={e=>{setRates(prev=>prev.map((r,j)=>j===i?{...r,interest:+e.target.value}:r));touchRateDate();}}
                   style={{width:46,padding:"3px 4px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center",fontFamily:mono}}
                   title="Credit cost % for this grade"/>
                :<span style={{fontFamily:mono,color:C.slateL,fontSize:11}}>{(row.interest??1.5).toFixed(2)}%</span>}
            </td>
            <td style={{padding:"4px 8px",textAlign:"center"}}>{fld("disc",55,0.25)}</td>
            <td style={{padding:"4px 8px",textAlign:"center"}}>{fld("freight",52,0.25)}</td>
            <td style={{padding:"4px 8px",textAlign:"center",fontWeight:700,color:C.green,fontFamily:mono,fontSize:12}}
              title={`${row.price} + credit(${row.interest??1.5}%)${(row.price*gCreditPct).toFixed(2)} - disc${row.disc||0} + fr${row.freight||0}`}>
              {eff}</td>
            {role==="admin"&&<td style={{padding:"3px 4px",textAlign:"center"}}>
              <button onClick={()=>{
                // Fix 6: count constructions using this grade before deleting
                const usedIn=constructionLib.filter(c=>
                  Object.values(c.layers||{}).some(l=>l.code===row.code)).length;
                const msg=usedIn>0
                  ?`Delete grade [${row.code}]? It is used in ${usedIn} construction(s). Rows using it will show ₹0 material cost. This cannot be undone.`
                  :`Delete grade [${row.code}]? This cannot be undone.`;
                if(window.confirm(msg))setRates(prev=>prev.filter((_,j)=>j!==i));
              }}
                style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:15}}>×</button>
            </td>}
          </tr>;})}
        </tbody>
      </table>
    </div>
  );
}
