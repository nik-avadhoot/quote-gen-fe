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
import BoxDieline from "../../components/BoxDieline.jsx";
import { C, T, mono } from "../../theme.js";

// Kept at module scope so moving the table near the top does not create a
// component during render. Its row order is the engine's existing order.
const LayerDetail=({r,card})=>(
  <div style={{...card,marginBottom:0,minWidth:0,padding:"8px 9px"}}>
    <div style={{fontSize:T.label,fontWeight:700,color:C.slateM,textTransform:"uppercase",
      letterSpacing:"0.07em",marginBottom:5}}>Layer Detail</div>
    <table style={{width:"100%",fontSize:T.body,borderCollapse:"collapse"}}>
      <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
        {["Layer","Grade","GSM","TU","Consumed","Sheet Wt","Rate","Cost"].map(h=>(
          <th key={h} style={{padding:"2px 3px",fontSize:T.label,color:C.slateL,textTransform:"uppercase",
            textAlign:h==="Layer"?"left":"center",fontWeight:600}}>{h}</th>))}
      </tr></thead>
      <tbody>{r.rowDetails.filter(x=>x.wt>0).map(x=>(
        <tr key={x.k} style={{borderBottom:`1px solid ${C.border}`}}>
          <td style={{padding:"3px",fontWeight:700,color:C.slateM,fontFamily:mono}}>{x.k}</td>
          <td style={{padding:"3px",textAlign:"center",fontFamily:mono}}>{x.code}</td>
          <td style={{padding:"3px",textAlign:"center",fontFamily:mono}}>{x.gsm}</td>
          <td style={{padding:"3px",textAlign:"center",color:C.slateL,fontFamily:mono}}>{x.tu?.toFixed(2)||"1.00"}</td>
          <td style={{padding:"3px",textAlign:"center",fontFamily:mono}}>{(x.wt*1000).toFixed(0)}g</td>
          <td style={{padding:"3px",textAlign:"center",fontFamily:mono,color:C.slateL}}>{(x.ws*1000).toFixed(0)}g</td>
          <td style={{padding:"3px",textAlign:"center",fontFamily:mono}}>₹{x.rate?.toFixed(2)}</td>
          <td style={{padding:"3px",textAlign:"center",fontWeight:700,fontFamily:mono}}>₹{x.cost?.toFixed(2)}</td>
        </tr>))}
        <tr style={{background:C.paper}}>
          <td style={{padding:"4px 5px",fontWeight:700,fontSize:T.label,color:C.slateM}}>TOTAL</td>
          <td style={{padding:"3px 5px",textAlign:"center",lineHeight:1.3}}>
            <div style={{fontSize:T.micro,color:C.slateL,textTransform:"uppercase"}}>Calc BS</div>
            <div style={{fontWeight:800,fontFamily:mono,color:C.amber,fontSize:T.value}}>{r.calcBS}</div>
          </td>
          <td style={{padding:"3px 5px",textAlign:"center",lineHeight:1.3}}>
            <div style={{fontSize:T.micro,color:C.slateL,textTransform:"uppercase"}}>Calc GSM</div>
            <div style={{fontWeight:800,fontFamily:mono,color:C.slateM,fontSize:T.value}}>{r.calcGSM}</div>
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
);

const DielineCard=({spec,card})=>(
  <div style={{...card,padding:"8px 10px",marginBottom:0,background:"#FAFAFA",minWidth:0,
    display:"flex",flexDirection:"column"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:3}}>
      <span style={{fontSize:T.label,fontWeight:700,color:"#9A7B4A",textTransform:"uppercase",letterSpacing:"0.07em"}}>
        Die-Line Preview
      </span>
      <span style={{fontSize:T.micro,color:"#888",textAlign:"right",lineHeight:1.25}}>
        {spec.boxType==="Die-R"||spec.boxType==="Die-S"
          ? "⚠ Approximation only — use customer KLD for die-cut SKUs"
          : `Flat blank: ${Math.round(2*(+spec.L||0)+(2*(+spec.W||0))+Math.max((+spec.W||0)*0.1,15))}×${Math.round((+spec.H||0)+2*Math.min((+spec.W||0)/2,(+spec.H||0)))} mm (RSC est.)`
        }
      </span>
    </div>
    <div style={{overflowX:"auto",display:"flex",alignItems:"center",flex:1,minHeight:0}}>
      <BoxDieline L={spec.L} W={spec.W} H={spec.H}
        boxType={spec.boxType||"RSC"} dimType={spec.dimType} ups={spec.ups}
        fluid style={{margin:"0 auto",width:"100%",height:"auto"}}/>
    </div>
  </div>
);

const sliderShell={height:92,display:"flex",alignItems:"center",justifyContent:"center"};
const verticalSlider={width:92,transform:"rotate(-90deg)",accentColor:C.amber};
const percentInput={width:54,padding:"4px 5px",border:`1px solid ${C.border}`,borderRadius:5,
  background:C.white,color:C.amberD,fontFamily:mono,fontSize:T.value,fontWeight:700,textAlign:"right"};

const MarginControl=({spec,s,r,card,marginSugg})=>(
  <div style={{...card,marginBottom:0,padding:"8px 7px",minWidth:0,textAlign:"center"}}>
    <div style={{fontSize:T.label,fontWeight:700,color:C.slateM,textTransform:"uppercase",
      letterSpacing:"0.06em"}}>Margin</div>
    <div style={{fontSize:T.value,fontWeight:700,color:C.slate,fontFamily:mono,marginTop:2}}>
      ₹{r.finalRate.toFixed(2)}</div>
    <div style={sliderShell}>
      <input type="range" min={0} max={20} step={0.5} value={spec.margin}
        aria-label="Margin percentage" onChange={e=>s("margin",+e.target.value)} style={verticalSlider}/>
    </div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4,marginBottom:5}}>
      <input type="number" min={0} max={20} step={0.5} value={spec.margin}
        aria-label="Margin percentage value" onChange={e=>s("margin",Math.min(20,Math.max(0,+e.target.value)))}
        style={percentInput}/>
      <span style={{fontSize:T.value,fontWeight:700,color:C.amberD}}>%</span>
    </div>
    {marginSugg.suggested!==+spec.margin&&(spec.customerType!=="existing"||spec.volume||spec.priceContext!=="unknown")&&(
      <button onClick={()=>s("margin",marginSugg.suggested)} title={`Base 8%${marginSugg.adjustments.map(a=>" · "+a).join("")}${marginSugg.risk?" · "+marginSugg.risk:""}`}
        style={{width:"100%",marginTop:5,padding:"3px 2px",borderRadius:5,fontSize:T.micro,cursor:"pointer",
          border:`1px solid ${C.green}`,background:C.greenL,color:C.green,fontWeight:700}}>
        ✦ Use {marginSugg.suggested}%</button>)}
    {marginSugg.adjustments.length>0&&<details style={{marginTop:4,fontSize:T.micro,color:C.slateL,
      lineHeight:1.3,textAlign:"left"}}>
      <summary style={{cursor:"pointer",whiteSpace:"nowrap"}}>Why {marginSugg.suggested}%?</summary>
      <div style={{marginTop:3,padding:"4px",background:C.cream,borderRadius:4}}>
        Base 8%{marginSugg.adjustments.map(a=>" · "+a).join("")}
        {marginSugg.risk&&<span style={{color:C.amberD,fontWeight:600}}> · {marginSugg.risk}</span>}
      </div>
    </details>}
  </div>
);

const BsControl=({spec,s,card})=>{
  const current=Math.round((spec.flutingBCF!=null?spec.flutingBCF:0.10)*100);
  return(
    <div style={{...card,marginBottom:0,padding:"8px 7px",minWidth:0,textAlign:"center",
      display:"flex",flexDirection:"column"}}>
      <div style={{fontSize:T.label,fontWeight:700,color:C.slateM,textTransform:"uppercase",
        letterSpacing:"0.05em",lineHeight:1.25}}>Fluting BS</div>
      <div style={sliderShell}>
        <input type="range" min={0} max={30} step={1} value={current}
          aria-label="Fluting BS contribution" onChange={e=>s("flutingBCF",+e.target.value/100)}
          style={verticalSlider}/>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4,marginBottom:5}}>
        <input type="number" min={0} max={30} step={1} value={current}
          aria-label="Fluting BS percentage value"
          onChange={e=>s("flutingBCF",Math.min(30,Math.max(0,+e.target.value))/100)} style={percentInput}/>
        <span style={{fontSize:T.value,fontWeight:700,color:C.amberD}}>%</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:3,marginBottom:5}}>
        {[0,10,20,30].map(pct=><button key={pct} onClick={()=>s("flutingBCF",pct/100)}
          aria-pressed={current===pct}
          style={{padding:"3px 2px",borderRadius:5,fontSize:T.label,cursor:"pointer",minWidth:0,
            border:`1px solid ${current===pct?C.amber:C.border}`,
            background:current===pct?C.amberL:C.white,
            color:current===pct?C.amberD:C.slateL,fontWeight:current===pct?700:400}}>{pct}%</button>)}
      </div>
      <details style={{fontSize:T.micro,color:C.slateL,marginTop:"auto",paddingTop:5,
        lineHeight:1.25,textAlign:"left"}}>
        <summary style={{cursor:"pointer",whiteSpace:"nowrap"}}>BS formula</summary>
        <div style={{marginTop:3,padding:"4px",background:C.cream,borderRadius:4}}>
          Liner BCF = 1. Flute BCF = slider. BS = Σ(BF_adj × BCF × GSM ÷ 1000).
        </div>
      </details>
    </div>
  );
};

const CostBuildUp=({r,spec,card,freightTag})=>{
  const addOnLabel=r.addOns>0&&(()=>{
    const labels={printing:"Print",stitching:"Stitch",coating:"Coat",handling:"Hdlg",
      moqCharge:"MOQ±",packing:"Pack",other:"Other",unloading:"Unload"};
    const active=Object.entries(labels).filter(([key])=>spec[key]&&+spec[key]>0)
      .map(([key,label])=>`${label} ₹${(+spec[key]).toFixed(2)}`);
    return `Add-ons${active.length?` (${active.join("·")})`:""}`;
  })();
  const rows=[["Material",r.mat],["Conversion",r.conv],
    addOnLabel&&[addOnLabel,r.addOns],["Interest",r.intC],
    [`Freight (${r.frRate} Rs/kg${freightTag})`,r.fr],[`Margin (${spec.margin}%)`,r.marginAmt]].filter(Boolean);

  return(
    <div style={{...card,marginBottom:0,padding:"8px 10px",minWidth:0}}>
      <div style={{fontSize:T.label,fontWeight:700,color:C.slateM,textTransform:"uppercase",
        letterSpacing:"0.07em",marginBottom:5}}>Cost Build-up</div>
      <table style={{width:"100%",fontSize:T.body,borderCollapse:"collapse",tableLayout:"fixed"}}>
        <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
          {["Component","₹ / box","₹ / kg","Share"].map((heading,index)=><th key={heading}
            style={{padding:"2px 3px",fontSize:T.micro,color:C.slateL,textTransform:"uppercase",
              textAlign:index===0?"left":"right",fontWeight:600,width:index===0?"48%":index===3?"18%":undefined}}>
            {heading}</th>)}
        </tr></thead>
        <tbody>{rows.map(([label,value])=>{
          const share=r.finalRate>0?value/r.finalRate*100:0;
          return <tr key={label} style={{borderBottom:`1px solid ${C.border}`}}>
            <td title={label} style={{padding:"4px 3px",color:C.slateM,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</td>
            <td style={{padding:"4px 3px",textAlign:"right",fontWeight:600,fontFamily:mono}}>₹{(+(value??0)).toFixed(2)}</td>
            <td style={{padding:"4px 3px",textAlign:"right",fontFamily:mono,color:C.amberD}}>
              {r.wtSheet>0?`₹${(value/r.wtSheet).toFixed(2)}`:"—"}</td>
            <td style={{padding:"4px 3px"}}>
              <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"flex-end"}}>
                <div style={{height:4,borderRadius:2,background:C.paper,flex:1,minWidth:18}}>
                  <div style={{height:"100%",background:label.startsWith("Margin")?C.amber:C.slateM,borderRadius:2,
                    width:Math.min(100,share).toFixed(0)+"%"}}/></div>
                <span style={{fontSize:T.micro,color:C.slateL,fontFamily:mono,minWidth:22,textAlign:"right"}}>{share.toFixed(0)}%</span>
              </div>
            </td>
          </tr>;})}
          <tr style={{borderTop:`2px solid ${C.amber}`}}>
            <td style={{padding:"6px 3px 2px",fontWeight:800,color:C.amber,fontSize:T.title,fontFamily:mono}}>
              ₹{r.finalRate.toFixed(2)}</td>
            <td colSpan={3} style={{padding:"6px 3px 2px",textAlign:"right",fontSize:T.micro,color:C.slateL}}>
              LANDED RATE · excl GST</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default function OutputPanel(){
  const {
    spec, s, card, profileDraft,
    r, missing, compliance, marginSugg, osSaving, freightResolution,
  } = useAppState();

  // S8(a). Name the tier the freight number actually came from, at the number.
  // A rate from the temporary legacy mirror must never read as approved
  // authority, and an explicit zero must be legible AS a zero someone chose
  // rather than as a blank. Absent (flag off) renders exactly as before.
  const freightTag=(()=>{
    if(!freightResolution)return"";
    switch(freightResolution.source){
      case"row":           return" · row override";
      case"legacy_batch":  return" · Batch override (temporary)";
      case"pricing_group": return freightResolution.mode==="ex_factory"
                                    ?" · ex-factory":" · Pricing Group (manual)";
      case"master":        return" · approved Master";
      case"legacy_matrix": return" · temporary legacy matrix";
      default:             return"";
    }
  })();
  const hasInputProgress=[spec.L,spec.W,spec.H,spec.volume,
    spec.layers?.TOP?.code,spec.layers?.TOP?.gsm,spec.layers?.F1?.code,
    spec.layers?.F1?.gsm,spec.layers?.L1?.code,spec.layers?.L1?.gsm]
    .some(value=>value!==""&&value!==null&&value!==undefined);

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{flex:1,overflowY:"auto",padding:12}}>
        {/* KLD is a read-only consequence of the dimensions. Keep it in the
            output column; SpecForm remains the sole editor of its inputs. */}
        {!r&&(spec.L&&spec.W&&spec.H)&&<div style={{marginBottom:10}}>
          <DielineCard spec={spec} card={card}/>
        </div>}
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
        {!r&&<div style={{padding:hasInputProgress?"5px 0":"16px 0"}}>
          <div style={{fontSize:T.value,fontWeight:600,color:C.slateM,
            marginBottom:hasInputProgress?6:12,textAlign:hasInputProgress?"left":"center"}}>
            Complete these fields to generate costing</div>
          {hasInputProgress
            ?<div style={{...card,padding:"5px 9px"}}>
              {missing.blockers.map((item,i)=><div key={item}
                style={{padding:"3px 0",borderBottom:i<missing.blockers.length-1?`1px solid ${C.border}`:"none",
                  fontSize:T.body,color:C.slateM,lineHeight:1.35}}>
                <span style={{color:C.red,marginRight:6}}>•</span>
                {item.replace(" — enter at least one layer","")}
              </div>)}
            </div>
            :[["📐","Dimensions","L × W × H in mm (Costing form → Dimensions)"],
              ["📄","Paper Construction","Select grade + GSM for at least TOP, F1 and L1 layers"],
              ["🏭","Commercial","Producing Plant + Delivery (Batch Context) + Monthly Volume (nos/month)"],
              ["💰","Rates","Verify Rate Master prices are current — use Rate Master tab"],
            ].map(([icon,title,desc])=>(
              <div key={title} style={{display:"flex",gap:10,padding:"9px 12px",marginBottom:6,
                background:C.white,border:`1px solid ${C.border}`,borderRadius:7,alignItems:"flex-start"}}>
                <div style={{fontSize:18,flexShrink:0}}>{icon}</div>
                <div>
                  <div style={{fontSize:T.value,fontWeight:700,color:C.slate,marginBottom:2}}>{title}</div>
                  <div style={{fontSize:T.body,color:C.slateL,lineHeight:1.45}}>{desc}</div>
                </div>
              </div>))}
        </div>}

        {r&&<>
          {/* The one-tenth control rail keeps the box's primary outputs wide
              and at the top without giving the slider disproportionate space. */}
          <div style={{display:"grid",gridTemplateColumns:"minmax(96px,1fr) minmax(0,9fr)",gap:10,
            alignItems:"stretch",marginBottom:10}}>
            <MarginControl spec={spec} s={s} r={r} card={card} marginSugg={marginSugg}/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:7,minWidth:0}}>
              <KN label="Final Rate" val={`₹${r.finalRate.toFixed(2)}`} hl
                sub={+spec.qtyPerSet>1?`×${spec.qtyPerSet} nos/set = ₹${(r.finalRate*(+spec.qtyPerSet)).toFixed(2)}/set`:"MROUND 0.05 · excl GST"}/>
              <KN label="Rate/kg (landed)" val={`₹${r.ratePerKg.toFixed(2)}`} sub="Sheet Wt basis · incl freight"/>
              <KN label="Paper Consumed" val={`${(r.wt*1000).toFixed(0)} g`}
                sub={+spec.qtyPerSet>1
                  ?`×${spec.qtyPerSet} = ${((r.wt*(+spec.qtyPerSet))*1000).toFixed(0)}g total · Sheet Wt: ${(r.wtSheet*1000).toFixed(0)}g`
                  :`Sheet Wt (excl waste): ${(r.wtSheet*1000).toFixed(0)} g`}/>
              <KN label="Calc MOQ" val={r.calcMOQ.toLocaleString()}
                sub={spec.salesMOQ?`Sales: ${(+spec.salesMOQ).toLocaleString()} ${+spec.salesMOQ<r.calcMOQ?"⚠️ below min":"✅"}`:`${r.moqKg.toLocaleString()} kg`}/>
              <KN label="Deckle" val={r.deckle+"mm"}/>
              <KN label="Cutting" val={r.cutting+"mm"}/>
              <KN label="Calc BS" val={r.calcBS} sub={spec.spec_bs?`Std: ${spec.spec_bs}`:"no std set"}/>
              <KN label="Calc GSM" val={r.calcGSM} sub={spec.board_gsm?`Std: ${spec.board_gsm}`:"no std set"}/>
            </div>
          </div>

          {/* Physical identity and its resulting cost sit on the same line. */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,
            alignItems:"stretch",marginBottom:10}}>
            <DielineCard spec={spec} card={card}/>
            <CostBuildUp r={r} spec={spec} card={card} freightTag={freightTag}/>
          </div>

          {/* BS is the layer calculation control, so it shares the row with
              the compact layer result rather than consuming a full-width row. */}
          <div style={{display:"grid",gridTemplateColumns:"minmax(96px,1fr) minmax(0,9fr)",gap:10,
            alignItems:"stretch",marginBottom:10}}>
            <BsControl spec={spec} s={s} card={card}/>
            <LayerDetail r={r} card={card}/>
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

        </>}

      </div>
    </div>
  );
}
