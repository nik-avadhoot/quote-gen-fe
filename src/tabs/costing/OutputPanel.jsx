// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/costing/OutputPanel.jsx — the Costing tab's right panel.
//
// Extracted from QuotationApp.jsx (Phase 7a). Blockers/warnings, the key-number
// tiles, the margin slider, the cost build-up and the layer detail.
//
// ⚠️ C1 moved this panel's header bar OUT — its underlined "Costing" tab
// label, the two-context badge, ✕ Unlink, → Send to Batch Entry, Start new SKU
// and + New Batch now live in the START/REVIEW strip in CostingTab.jsx. The
// controls were relocated verbatim; nothing about them changed here. What is
// left is the scrolling output body alone.
// ═══════════════════════════════════════════════════════════════════════════
import { KN } from "../../ui/primitives.jsx";
import { useAppState } from "../../state/AppStateContext.js";
import { C, mono } from "../../theme.js";

export default function OutputPanel(){
  const {
    spec, s, card, profileDraft,
    r, missing, compliance, marginSugg, osSaving,
  } = useAppState();

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{flex:1,overflowY:"auto",padding:12}}>
        {/* Diagnostics — Blockers (left) + Warnings (right) always side-by-side for equal height.
             Plant warning injected locally (plant/delivery not in costing.js checkMissingInfo). */}
        {(()=>{
          const _extraWarnings=[];
          // C5: Producing Plant and Delivery are owned by Batch Context now, so
          // the guidance has to point at the surface that actually owns them -
          // which differs by mode. Telling a Maker preparing a new batch to go
          // and edit the Batch Profile would send them to a profile that does
          // not exist yet.
          if(!spec.plant||!spec.delivery) _extraWarnings.push(
            profileDraft!==null
              ?"Producing Plant & Delivery not set — set them in Batch Context above"
              :"Producing Plant & Delivery not set — use Edit Batch Profile in Batch Entry");
          const _allWarnings=[...missing.warnings,..._extraWarnings];
          if(missing.blockers.length===0&&_allWarnings.length===0) return null;
          return(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
            {/* Left col — Blockers */}
            <div style={{background:C.redL,border:`1px solid ${C.red}33`,borderRadius:6,padding:"8px 10px"}}>
              <div style={{fontSize:10,fontWeight:700,color:C.red,marginBottom:3}}>
                ❌ {missing.blockers.length} BLOCKER{missing.blockers.length>1?"S":""}</div>
              {missing.blockers.length>0
                ? missing.blockers.map((b,i)=><div key={i} style={{fontSize:10,color:C.red,paddingLeft:3}}>
                    · {b.replace(" — enter at least one layer","")}
                  </div>)
                : <div style={{fontSize:10,color:C.red,paddingLeft:3,opacity:.5}}>None</div>}
            </div>
            {/* Right col — Warnings */}
            <div style={{background:"#FFF8ED",border:`1px solid ${C.amber}44`,borderRadius:6,padding:"8px 10px"}}>
              <div style={{fontSize:10,fontWeight:700,color:C.amberD,marginBottom:3}}>
                ⚠️ {_allWarnings.length} WARNING{_allWarnings.length>1?"S":""}</div>
              {_allWarnings.length>0
                ? _allWarnings.map((w,i)=><div key={i} style={{fontSize:10,color:C.amberD,paddingLeft:3}}>· {w}</div>)
                : <div style={{fontSize:10,color:C.amberD,paddingLeft:3,opacity:.5}}>None</div>}
            </div>
          </div>);
        })()}
        {missing.blockers.length===0&&r&&<div style={{marginBottom:8,fontSize:11,color:C.green,fontWeight:600}}>
          ✅ Ready to quote{missing.warnings.length>0?` (${missing.warnings.length} warning${missing.warnings.length>1?"s":""} noted)`:""}</div>}
        {!r&&<div style={{padding:"16px 0"}}>
          <div style={{fontSize:12,fontWeight:600,color:C.slateM,marginBottom:12,textAlign:"center"}}>
            Complete these fields to generate costing</div>
          {[["📐","Dimensions","L × W × H in mm (Costing form → Dimensions)"],
            ["📄","Paper Construction","Select grade + GSM for at least TOP, F1 and L1 layers"],
            ["🏭","Commercial","Producing Plant + Delivery (Batch Context) + Monthly Volume (nos/month)"],
            ["💰","Rates","Verify Rate Master prices are current — use Rate Master tab"],
          ].map(([icon,title,desc])=>(
            <div key={title} style={{display:"flex",gap:10,padding:"9px 12px",marginBottom:6,
              background:C.white,border:`1px solid ${C.border}`,borderRadius:7,alignItems:"flex-start"}}>
              <div style={{fontSize:18,flexShrink:0}}>{icon}</div>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:C.slate,marginBottom:2}}>{title}</div>
                <div style={{fontSize:11,color:C.slateL,lineHeight:1.45}}>{desc}</div>
              </div>
            </div>))}
        </div>}

        {r&&<>
          {/* Key numbers */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:10}}>
            <KN label="Final Rate" val={`₹${r.finalRate.toFixed(2)}`} hl
              sub={+spec.qtyPerSet>1?`×${spec.qtyPerSet} nos/set = ₹${(r.finalRate*(+spec.qtyPerSet)).toFixed(2)}/set`:"MROUND 0.05 · excl GST"}/>
            <KN label="Rate/kg (landed)" val={`₹${r.ratePerKg.toFixed(2)}`} sub="Sheet Wt basis · incl freight"/>
            <KN label="Paper Consumed" val={`${(r.wt*1000).toFixed(0)} g`}
              sub={+spec.qtyPerSet>1
                ?`×${spec.qtyPerSet} = ${((r.wt*(+spec.qtyPerSet))*1000).toFixed(0)}g total · Sheet Wt: ${(r.wtSheet*1000).toFixed(0)}g`
                :`Sheet Wt (excl waste): ${(r.wtSheet*1000).toFixed(0)} g`}/>
            <KN label="Calc MOQ" val={r.calcMOQ.toLocaleString()}
              sub={spec.salesMOQ?`Sales: ${(+spec.salesMOQ).toLocaleString()} ${+spec.salesMOQ<r.calcMOQ?"⚠️ below min":"✅"}`:`${r.moqKg.toLocaleString()} kg`}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:10}}>
            <KN label="Deckle" val={r.deckle+"mm"}/>
            <KN label="Cutting" val={r.cutting+"mm"}/>
            <KN label="Calc BS" val={r.calcBS} sub={spec.spec_bs?`Std: ${spec.spec_bs}`:"no std set"}/>
            <KN label="Calc GSM" val={r.calcGSM} sub={spec.board_gsm?`Std: ${spec.board_gsm}`:"no std set"}/>
          </div>

          {/* Spec compliance */}
          {compliance.length>0&&<div style={{...card,padding:12,marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:700,color:C.slateM,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Specification Check</div>
            <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                {["Field","Std","Calc","Gap","Status","Action"].map(h=>(
                  <th key={h} style={{padding:"3px 7px",fontSize:9,color:C.slateL,
                    textTransform:"uppercase",textAlign:h==="Field"?"left":"center",fontWeight:600}}>{h}</th>))}
              </tr></thead>
              <tbody>{compliance.map((item,i)=>{
                const over=item.type==="over",high=item.severity==="high";
                const col=high?C.red:over?C.amberD:C.red;
                return<tr key={i} style={{background:i%2?C.cream:C.white}}>
                  <td style={{padding:"5px 7px",fontWeight:600,color:C.slateM}}>{item.field}</td>
                  <td style={{padding:"5px 7px",textAlign:"center",fontFamily:mono}}>{item.std} {item.unit}</td>
                  <td style={{padding:"5px 7px",textAlign:"center",fontFamily:mono}}>{item.calc} {item.unit}</td>
                  <td style={{padding:"5px 7px",textAlign:"center",fontWeight:700,color:col,fontFamily:mono}}>
                    {item.pct>0?"+":""}{item.pct}%</td>
                  <td style={{padding:"5px 7px",textAlign:"center"}}>
                    <span style={{background:high?C.redL:over?"#FFF8ED":C.redL,color:col,
                      padding:"2px 7px",borderRadius:10,fontSize:9,fontWeight:700}}>
                      {high?"❌ UNDER":over?"⚠️ OVER":"❌ UNDER"}</span></td>
                  <td style={{padding:"5px 7px",textAlign:"center",fontSize:10,color:over&&osSaving?C.green:C.slateL}}>
                    {over&&osSaving&&item.field.includes("Burst")
                      ?<><b>Save ₹{osSaving.saving}/box</b><br/><span style={{fontSize:9}}>{osSaving.note}</span></>
                      :high?"Upgrade needed":"Review"}
                  </td>
                </tr>;})}
              </tbody>
            </table>
          </div>}

          {/* Margin slider — min 0 */}
          <div style={{...card,padding:"10px 12px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:11,fontWeight:600,color:C.slateM,minWidth:50}}>Margin %</span>
              <input type="range" min={0} max={20} step={0.5} value={spec.margin}
                onChange={e=>s("margin",+e.target.value)} style={{flex:1,accentColor:C.amber}}/>
              <span style={{fontSize:15,fontWeight:800,color:C.amber,minWidth:34,textAlign:"right",fontFamily:mono}}>
                {spec.margin}%</span>
              <span style={{fontSize:13,fontWeight:700,color:C.slate,fontFamily:mono}}>→ ₹{r.finalRate.toFixed(2)}</span>
            </div>
            <div style={{display:"flex",gap:5,marginTop:7,flexWrap:"wrap",alignItems:"center"}}>
              {[0,6,8,10,12,15].map(m=><button key={m} onClick={()=>s("margin",m)}
                style={{padding:"3px 9px",borderRadius:5,fontSize:11,cursor:"pointer",
                  border:`1px solid ${+spec.margin===m?C.amber:C.border}`,
                  background:+spec.margin===m?C.amberL:C.white,
                  color:+spec.margin===m?C.amberD:C.slateL,fontWeight:+spec.margin===m?700:400}}>{m}%</button>)}
              {marginSugg.suggested!==+spec.margin&&(spec.customerType!=="existing"||spec.volume||spec.priceContext!=="unknown")&&(
                <button onClick={()=>s("margin",marginSugg.suggested)} style={{padding:"3px 10px",
                  borderRadius:5,fontSize:11,cursor:"pointer",border:`1px solid ${C.green}`,
                  background:C.greenL,color:C.green,fontWeight:700}}>
                  ✦ Suggested: {marginSugg.suggested}%</button>)}
            </div>
            {marginSugg.adjustments.length>0&&<div style={{marginTop:7,padding:"7px 9px",
              background:C.cream,borderRadius:5,fontSize:10,color:C.slateL,lineHeight:1.6}}>
              <b style={{color:C.slateM}}>Suggested: {marginSugg.suggested}%</b> — base 8%{marginSugg.adjustments.map(a=>" · "+a).join("")}
              {marginSugg.risk&&<span style={{marginLeft:6,color:C.amberD,fontWeight:600}}> {marginSugg.risk}</span>}
            </div>}
          </div>

          {/* Cost breakdown */}
          <div style={card}>
            <div style={{fontSize:10,fontWeight:700,color:C.slateM,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Cost Build-up</div>
            <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
              <tbody>
                {[["Material Cost (Paper Consumed)",r.mat],
                  ["Conversion",r.conv],
                  r.addOns>0&&[`Add-on Costs${(()=>{
                      const AL={printing:"Print",stitching:"Stitch",coating:"Coat",
                        handling:"Hdlg",moqCharge:"MOQ±",packing:"Pack",other:"Other",unloading:"Unload"};
                      const active=Object.entries(AL).filter(([k])=>spec[k]&&+spec[k]>0)
                        .map(([k,l])=>`${l} ₹${(+spec[k]).toFixed(2)}`);
                      return active.length?" ("+active.join("·")+")":"";
                    })()}`,r.addOns],
                  ["Interest",r.intC],
                  [`Freight (${r.frRate} Rs/kg)`,r.fr],
                  ["Margin ("+spec.margin+"%)",r.marginAmt]].filter(Boolean).map(([l,v])=>(
                  <tr key={l} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:"5px 0",color:C.slateM,fontSize:11}}>{l}</td>
                    <td style={{padding:"5px 0",textAlign:"right",fontWeight:600,fontFamily:mono,width:72}}>₹{(+(v??0)).toFixed(2)}</td>
                    <td style={{padding:"5px 0",textAlign:"right",fontFamily:mono,fontSize:10,color:C.amberD,width:60}}>
                      {r.wtSheet>0?`₹${(v/r.wtSheet).toFixed(2)}/kg`:"—"}</td>
                    <td style={{padding:"5px 0 5px 6px",width:80}}>
                      <div style={{height:4,borderRadius:2,background:C.paper}}>
                        <div style={{height:"100%",background:l.includes("Margin")?C.amber:C.slateM,borderRadius:2,
                          width:Math.min(100,v/r.finalRate*100).toFixed(0)+"%"}}/></div></td>
                    <td style={{padding:"5px 0",textAlign:"right",fontSize:10,color:C.slateL,width:28,fontFamily:mono}}>
                      {(v/r.finalRate*100).toFixed(0)}%</td>
                  </tr>))}
                <tr style={{borderTop:`2px solid ${C.amber}`}}>
                  <td style={{padding:"7px 0 3px",fontWeight:800,color:C.amber,fontSize:15,fontFamily:mono}} colSpan={2}>₹{r.finalRate.toFixed(2)}</td>
                  <td colSpan={2} style={{padding:"7px 0 3px",textAlign:"right",fontSize:10,color:C.slateL}}>LANDED RATE · excl GST</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Fluting BS Contribution Slider */}
          <div style={{...card,padding:"9px 12px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:11,fontWeight:600,color:C.slateM,minWidth:170}}>
                Fluting BS Contribution</span>
              <input type="range" min={0} max={30} step={1}
                value={Math.round((spec.flutingBCF!=null?spec.flutingBCF:0.10)*100)}
                onChange={e=>s("flutingBCF",+e.target.value/100)}
                style={{flex:1,accentColor:C.amber}}/>
              <span style={{fontSize:13,fontWeight:800,color:C.amber,minWidth:36,textAlign:"right",fontFamily:mono}}>
                {Math.round((spec.flutingBCF!=null?spec.flutingBCF:0.10)*100)}%</span>
            </div>
            <div style={{display:"flex",gap:5,marginTop:7}}>
              {[0,10,20,30].map(pct=>{
                const cur=Math.round((spec.flutingBCF!=null?spec.flutingBCF:0.10)*100);
                return<button key={pct} onClick={()=>s("flutingBCF",pct/100)}
                  style={{padding:"3px 9px",borderRadius:5,fontSize:11,cursor:"pointer",
                    border:`1px solid ${cur===pct?C.amber:C.border}`,
                    background:cur===pct?C.amberL:C.white,
                    color:cur===pct?C.amberD:C.slateL,fontWeight:cur===pct?700:400}}>
                  {pct}%</button>;})}
            </div>
            <div style={{fontSize:10,color:C.slateL,marginTop:5}}>
              Liner BCF = 1 always. Flute BCF = slider value. Formula: BS = Σ(BF_adj × BCF × GSM ÷ 1000).</div>
          </div>

          {/* Layer detail */}
          <div style={card}>
            <div style={{fontSize:10,fontWeight:700,color:C.slateM,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Layer Detail</div>
            <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                {["Layer","BF / Grade","GSM","TU","Paper Consumed","Sheet Wt","Rate","Cost"].map(h=>(
                  <th key={h} style={{padding:"3px 5px",fontSize:9,color:C.slateL,textTransform:"uppercase",
                    textAlign:h==="Layer"?"left":"center",fontWeight:600}}>{h}</th>))}
              </tr></thead>
              <tbody>{r.rowDetails.filter(x=>x.wt>0).map(x=>(
                <tr key={x.k} style={{borderBottom:`1px solid ${C.border}`}}>
                  <td style={{padding:"4px 5px",fontWeight:700,color:C.slateM,fontFamily:mono}}>{x.k}</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontFamily:mono}}>{x.code}</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontFamily:mono}}>{x.gsm}</td>
                  <td style={{padding:"4px 5px",textAlign:"center",color:C.slateL,fontFamily:mono}}>{x.tu?.toFixed(2)||"1.00"}</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontFamily:mono}}>{(x.wt*1000).toFixed(0)}g</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontFamily:mono,color:C.slateL}}>{(x.ws*1000).toFixed(0)}g</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontFamily:mono}}>₹{x.rate?.toFixed(2)}</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontWeight:700,fontFamily:mono}}>₹{x.cost?.toFixed(2)}</td>
                </tr>))}
                <tr style={{background:C.paper}}>
                  <td style={{padding:"4px 5px",fontWeight:700,fontSize:10,color:C.slateM}}>TOTAL</td>
                  <td style={{padding:"3px 5px",textAlign:"center",lineHeight:1.3}}>
                    <div style={{fontSize:8,color:C.slateL,textTransform:"uppercase"}}>Calc BS</div>
                    <div style={{fontWeight:800,fontFamily:mono,color:C.amber,fontSize:12}}>{r.calcBS}</div>
                  </td>
                  <td style={{padding:"3px 5px",textAlign:"center",lineHeight:1.3}}>
                    <div style={{fontSize:8,color:C.slateL,textTransform:"uppercase"}}>Calc GSM</div>
                    <div style={{fontWeight:800,fontFamily:mono,color:C.slateM,fontSize:12}}>{r.calcGSM}</div>
                  </td>
                  <td/>
                  <td style={{padding:"4px 5px",textAlign:"center",fontWeight:700,fontFamily:mono}}>{(r.wt*1000).toFixed(0)}g</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontWeight:700,fontFamily:mono,color:C.slateL}}>{(r.wtSheet*1000).toFixed(0)}g</td>
                  <td/>
                  <td style={{padding:"4px 5px",textAlign:"center",fontWeight:700,fontFamily:mono}}>₹{(r.mat||0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>}

      </div>
    </div>
  );
}
