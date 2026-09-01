// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/costing/SpecForm.jsx — the Costing tab's left panel (the spec form).
//
// Extracted from QuotationApp.jsx (Phase 7a).
//
// SubHdr is HOISTED to module scope. In the monolith it was declared inside a
// JSX IIFE, i.e. a component created during render — ESLint flagged it as
// react-hooks/static-components at two call sites. A component redefined every
// render remounts its subtree instead of updating it.
//
// ⚠️ This file renders the front door of every negative case: the identity
// freeze, the SET Code control, the client/sector fields the mismatch guard
// reads, and the waste/conv override inputs Case 4 depends on. Extraction here
// is STRUCTURAL ONLY — no behaviour changed.
// ═══════════════════════════════════════════════════════════════════════════
import { BOX_TYPES } from "../../data/defaults.js";
import { isPPType, sameSetCode } from "../../engine/rowType.js";
import BoxDieline from "../../components/BoxDieline.jsx";
import { Btn, Inp, SH, Sel } from "../../ui/primitives.jsx";
import { inputSt } from "../../ui/styles.js";
import { useAppState } from "../../state/AppStateContext.js";
import { C, mono, sans } from "../../theme.js";

// Sub-header: matches Paper Construction column header style exactly —
// fontSize:9, slateL, bold, uppercase, no border, marginBottom:4.
// Hoisted out of the render path — see header note.
const SubHdr=({title})=>(
  <div style={{fontSize:9,fontWeight:700,color:C.slateL,textTransform:"uppercase",
    letterSpacing:"0.09em",marginBottom:4}}>{title}</div>);

export default function SpecForm(){
  const {
    spec, s, setAutoFill, setSetAutoFill, activeBatchRowId,
    aiNotes, setAiNotes, showToast, card,
    gradeCodes, partitionsMaster, freight,
    constructionLib, batchDefaults, batchRows, items,
    r, _sendReady, _wasteDefBox, _wasteDefPP, _convDefBox, _convDefPP,
    pushCostingToBatchRow,
  } = useAppState();

  return(
    <div style={{overflowY:"auto",height:"100%",padding:"10px 10px 24px"}}>
      {aiNotes&&<div style={{background:aiNotes.startsWith("✅")?C.greenL:C.redL,
        border:`1px solid ${aiNotes.startsWith("✅")?C.green:C.red}33`,
        borderRadius:6,padding:"8px 12px",marginBottom:10,fontSize:11,
        color:aiNotes.startsWith("✅")?C.green:C.red}}>
        {aiNotes}<button onClick={()=>setAiNotes("")}
          style={{float:"right",background:"none",border:"none",cursor:"pointer",color:"inherit",fontSize:14}}>×</button>
      </div>}
      <div style={card}>
        <SH title="Product & SET"/>
        {/* C6 REMOVED THE IDENTITY-FREEZE BANNER. Both of its branches claimed
            "Client and Sector locked" in a card that no longer holds either field:
            C5 moved them to the Batch Context bar, which is read-only whenever
            Costing is attached to a batch or reviewing a row. What remains true is
            said where it applies - Mat Code renders locked with its own tooltip in
            REVIEW, and the REVIEW banner lower in this form names the row, its Mat
            Code and the Push rule. Do not reintroduce a flag to bring this back. */}
        {/* C5 visual pass: the "Part of a SET" card was merged in here. The SET
            switch is now a field in row 1 beside the two identity fields, and the
            SET fields follow as row 2 - one card, two rows, instead of two cards
            with a header each. Every handler below is unchanged. */}
        <div style={{display:"grid",gridTemplateColumns:"92px 1fr",gap:"4px 7px",marginBottom:5}}>
          {/* C5: Client and Sector moved to the Batch Context bar. They are batch-level
              fields with ONE authority now, so the copies that lived here are gone rather
              than duplicated. Material Code and SKU/Product below are SKU-level and stay. */}
          {/* Material Code — frozen in REVIEW only; editable in START (including after Send) */}
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",whiteSpace:"nowrap"}}>Mat Code</div>
              {!activeBatchRowId&&<button onClick={()=>{
                const cli=(spec.client||"SKU").replace(/[^A-Za-z0-9]/g,"").substring(0,4).toUpperCase();
                const d=new Date();const ym=String(d.getFullYear()).slice(-2)+String(d.getMonth()+1).padStart(2,"0");
                const mc=cli+ym+"-"+String(Math.floor(Math.random()*900)+100);
                s("material_code",mc);
                if(setAutoFill&&(!spec.rowType||spec.rowType==="Box"))s("setCode",mc);
                showToast("Code: "+mc,'info',1800);
              }} style={{background:"none",border:"none",cursor:"pointer",fontSize:9,color:C.amber,fontWeight:700,padding:0}}>⚡ Auto</button>}
            </div>
            {activeBatchRowId
              ?<div style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,
                  fontSize:11,color:C.slateM,background:"#F5F5F5",cursor:"not-allowed",fontFamily:mono}}
                  title="Mat Code locked — reviewing existing Batch row. Unlink to create a new SKU.">
                {spec.material_code||"—"}
              </div>
              :<Inp value={spec.material_code} onChange={v=>{
                s("material_code",v);
                if(setAutoFill&&(!spec.rowType||spec.rowType==="Box")&&(spec.setCode===""||spec.setCode===spec.material_code))
                  s("setCode",v);
              }} placeholder="e.g. LT700"/>}
          </div>
          {/* SKU / Product — always editable; in REVIEW it is pushable via the Push button */}
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>
              SKU / Product *{activeBatchRowId&&<span style={{fontSize:8,color:C.green,marginLeft:4,fontWeight:400}}>(pushable)</span>}
            </div>
            <Inp value={spec.product} onChange={v=>s("product",v)}/>
          </div>
        </div>
        {/* Row 2 — Part of SET | SET Code | Set Role | Nos/Set. SET Code and
            Nos/Set are fixed by ruling; Part of SET sits at 52px, which is exactly
            what its label measures, so Set Role absorbs the difference - ruled at
            a 36% reduction with the standard 7px gap kept. */}
        <div style={{display:"grid",gridTemplateColumns:"52px 92px 1fr 50px",gap:"0 7px",marginBottom:4}}>
          {/* Part of a SET — the switch that used to be this card's header. Same
              handler, same semantics; only its position changed. */}
          <div>
            <label htmlFor="setAutoFillChk"
              style={{fontSize:9,color:setAutoFill?C.amber:C.slateL,fontWeight:600,
                textTransform:"uppercase",marginBottom:2,display:"block",
                textAlign:"center",cursor:"pointer",whiteSpace:"nowrap"}}>
              Part of SET
            </label>
            <div style={{display:"flex",justifyContent:"center",alignItems:"center",
              height:26,border:`1px solid ${setAutoFill?C.amber:C.border}`,borderRadius:4,
              background:setAutoFill?"#FFF8ED":C.white}}>
              <input type="checkbox" id="setAutoFillChk" checked={setAutoFill}
                onChange={e=>{
                  const on=e.target.checked;
                  setSetAutoFill(on);
                  if(!on){s("setCode","");}
                  else if(!spec.rowType||spec.rowType==="Box")s("setCode",spec.material_code||"");
                }}
                style={{accentColor:C.amber,cursor:"pointer",width:13,height:13,margin:0}}/>
            </div>
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2,textAlign:"center"}}>SET Code</div>
            <Inp value={spec.setCode} onChange={v=>s("setCode",v.toUpperCase())} placeholder="e.g. A"/>
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2,textAlign:"center"}}>Set Role</div>
            <Sel value={spec.rowType} onChange={v=>{
              s("rowType",v);
              if(v==="Plate"||v==="Part-L"||v==="Part-W"){
                s("boxType","PP");
                // Do NOT clear skuType — Glass SKU Type is SET-level context, persists across role changes.
                // Part-L / Part-W: re-derive qtyPerSet from partitionsMaster for the new role.
                // Plate: do NOT modify qtyPerSet — Plate Nos/Set is at the Maker's discretion.
                if((v==="Part-L"||v==="Part-W")&&spec.skuType){
                  const _pm=partitionsMaster.find(x=>x.skuType===spec.skuType);
                  if(_pm) s("qtyPerSet",v==="Part-L"?_pm.lwise:_pm.wwise);
                }
              } else if(v==="Box"){s("boxType","RSC");}
            }}
              opts={[{v:"Box",l:"Main Box"},{v:"Plate",l:"Plate"},{v:"Part-L",l:"Partition-L"},{v:"Part-W",l:"Partition-W"},{v:"Other",l:"Other"}]}/>
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2,textAlign:"center"}}>
              Nos/Set
            </div>
            <input value={spec.qtyPerSet??1} type="number" min="1" step="1"
              onChange={e=>s("qtyPerSet",Math.max(1,+e.target.value||1))}
              style={{width:"100%",padding:"4px 5px",border:`1px solid ${spec.qtyPerSet>1?C.amber:C.border}`,
                borderRadius:4,fontSize:11,textAlign:"center",boxSizing:"border-box",
                fontWeight:spec.qtyPerSet>1?700:400,color:spec.qtyPerSet>1?C.amberD:C.slate}}/>
            {spec.qtyPerSet>1&&<div style={{fontSize:8,color:C.amberD,marginTop:1,textAlign:"center"}}>
              ×{spec.qtyPerSet} in SET rate</div>}
          </div>
        </div>
        {/* Auto-dims from parent Box: search batchRows first (primary), then items (legacy fallback) */}
        {spec.rowType!=="RS4"&&spec.setCode&&(()=>{
          const sc=spec.setCode; // D-7: normalisation belongs to sameSetCode, not here
          // Issue 3 fix: parent Box is in batchRows (primary workflow path).
          // items (Quote Items) is the legacy path — kept as fallback only.
          const parent=
            batchRows.find(r=>sameSetCode(r.setCode,sc)&&(r.itemType||"Box")==="Box")||
            items.find(i=>sameSetCode(i.spec.setCode,sc)&&i.spec.rowType==="Box");
          if(!parent)return null;
          const pL=parent.L??parent.spec?.L;
          const pW=parent.W??parent.spec?.W;
          const pH=parent.H??parent.spec?.H;
          if(!pL||!pW||!pH)return null;
          const hints={Plate:`Plate: L=${+pL-5}mm, W=${+pW-5}mm`,
            "Part-L":`Part-L: L=${+pL-5}mm, W=${+pH-15}mm`,"Part-W":`Part-W: L=${+pW-5}mm, W=${+pH-15}mm`};
          const srcLabel=parent.matCode||parent.spec?.material_code||"parent Box";
          return<div style={{padding:"8px 10px",background:C.greenL,borderRadius:6,
            fontSize:11,color:C.green,marginTop:-4}}>
            <strong>Auto-dims from {srcLabel}:</strong> {hints[spec.rowType]||""}
            <Btn ch="Apply" v="success" sm style={{marginLeft:8}} onClick={()=>{
              if(spec.rowType==="Plate"){s("L",+pL-5);s("W",+pW-5);}
              else if(spec.rowType==="Part-L"){s("L",+pL-5);s("W",+pH-15);}
              else if(spec.rowType==="Part-W"){s("L",+pW-5);s("W",+pH-15);}
            }}/>
          </div>;
        })()}
        {/* Glass SKU Type — Alcobev partitions only */}
        {spec.sector==="ALCOBEV"&&(spec.rowType==="Part-L"||spec.rowType==="Part-W")&&<div style={{marginTop:6,padding:"8px 10px",background:"#EEF4FB",border:"1px solid #6A9FD433",borderRadius:6}}>
          <div style={{fontSize:9,color:"#2E6094",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>
            Glass SKU Type <span style={{fontSize:8,fontWeight:400}}>(auto-fills Nos/Set)</span>
          </div>
          <Sel value={spec.skuType||""} onChange={v=>{
            s("skuType",v);
            const pm=partitionsMaster.find(x=>x.skuType===v);
            if(pm){s("qtyPerSet",spec.rowType==="Part-L"?pm.lwise:pm.wwise);}
          }} opts={[{v:"",l:"— select SKU type —"},...partitionsMaster.map(x=>({v:x.skuType,l:x.skuType}))]}/>
          {spec.skuType&&(()=>{
            const pm=partitionsMaster.find(x=>x.skuType===spec.skuType);
            return pm?<div style={{fontSize:9,color:"#2E6094",marginTop:3}}>
              L-wise: {pm.lwise} pcs · W-wise: {pm.wwise} pcs →
              <b style={{color:C.amber,marginLeft:4}}>Nos/Set = {spec.rowType==="Part-L"?pm.lwise:pm.wwise}</b>
            </div>:null;
          })()}
        </div>}
      </div>

      {/* G6: Construction cue — shown when SET Role is non-Box and construction is non-blank.
          Derived from current values; no state tracking needed. This is a reminder only —
          it does NOT imply the retained construction is correct for this role. The Maker
          must confirm or change it. Box→PP does not require different construction;
          Part-L→Part-W does not require the same construction. */}
      {!activeBatchRowId&&(spec.rowType&&spec.rowType!=="Box")&&(
        spec.layers?.TOP?.code||spec.layers?.F1?.code||spec.layers?.L1?.code
      )&&<div style={{background:"#FFF8ED",border:`1px solid ${C.amber}`,borderRadius:5,
          padding:"6px 10px",marginBottom:4,fontSize:10,color:C.amberD,lineHeight:1.5}}>
        ⚠️ <b>Construction inherited from previous item</b> — confirm or change before sending.
        The retained construction is a starting default only, not a recommendation for this SET role.
      </div>}
      <div style={card}>
        <SH title="Dimensions & Construction"/>
        {/* Row 1: L W H Ups Dim */}
        <div style={{display:"grid",gridTemplateColumns:"62px 62px 62px 1fr 56px",gap:"4px 5px",marginBottom:4}}>
          {[["L","L (mm)"],["W","W (mm)"],["H","H (mm)"]].map(([k,lbl])=>(
            <div key={k}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>{lbl}</div>
              <Inp value={spec[k]} onChange={v=>s(k,v)} type="number"/>
            </div>))}
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Ups</div>
            <Inp value={spec.ups} onChange={v=>s("ups",+v)} type="number"/>
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Dim</div>
            <Sel value={spec.dimType} onChange={v=>s("dimType",v)} opts={["ID","OD"]}/>
          </div>
        </div>
        {/* Row 2: Box Type Ply F1 F2 — Box Type 1fr (fills available width), PLY 68px (fits 3-ply/5-ply) */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 68px 58px 58px",gap:"4px 5px",marginBottom:2}}>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Box Type</div>
            <Sel value={spec.boxType} onChange={v=>s("boxType",v)} opts={BOX_TYPES}/>
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Ply</div>
            <Sel value={spec.ply} onChange={v=>s("ply",+v)} opts={[{v:3,l:"3-ply"},{v:5,l:"5-ply"}]}/>
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>F1 Flute</div>
            <Sel value={spec.flute_F1} onChange={v=>s("flute_F1",v)} opts={["A","B","C","E"]}/>
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>F2 Flute</div>
            <Sel value={spec.flute_F2} onChange={v=>s("flute_F2",v)}
              opts={[{v:"",l:"—"},...["A","B","C","E"].map(f=>({v:f,l:f}))]}/>
          </div>
        </div>
      </div>
      {/* ── Live Die-line Preview ── */}
      {(spec.L&&spec.W&&spec.H)&&(
      <div style={{background:"#FAFAFA",borderRadius:6,border:"1px solid #E8E0D4",padding:"8px 10px",marginBottom:4}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontSize:9,fontWeight:700,color:"#9A7B4A",textTransform:"uppercase",letterSpacing:"0.07em"}}>
            Die-Line Preview
          </span>
          <span style={{fontSize:8,color:"#AAA"}}>
            {spec.boxType==="Die-R"||spec.boxType==="Die-S"
              ? "⚠ Approximation only — use customer KLD for die-cut SKUs"
              : `Flat blank: ${Math.round(2*(+spec.L||0)+(2*(+spec.W||0))+Math.max((+spec.W||0)*0.1,15))}×${Math.round((+spec.H||0)+2*Math.min((+spec.W||0)/2,(+spec.H||0)))} mm (RSC est.)`
            }
          </span>
        </div>
        <div style={{overflowX:"auto"}}>
          <BoxDieline L={spec.L} W={spec.W} H={spec.H}
            boxType={spec.boxType||"RSC"} dimType={spec.dimType} ups={spec.ups}/>
        </div>
      </div>)}
      <div style={card}>
        <SH title="Paper Construction"/>
        <div style={{display:"grid",gridTemplateColumns:"72px 1fr 80px 52px",gap:"3px 5px",
          fontSize:9,color:C.slateL,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>
          <div>Layer</div><div>Grade</div><div style={{textAlign:"center"}}>GSM</div><div style={{textAlign:"center"}}>Flute</div>
        </div>
        {[["TOP","TOP Liner",false,null],["F1","F1 Medium",true,"flute_F1"],
          ["L1","L1 Liner",false,null],["F2","F2 Medium",true,"flute_F2"],["L2","L2 Liner",false,null]]
        .map(([k,lbl,isF,fk])=>(
          <div key={k} style={{display:"grid",gridTemplateColumns:"72px 1fr 80px 52px",gap:"3px 5px",
            marginBottom:4,alignItems:"center"}}>
            <div style={{fontSize:11,fontWeight:600,color:C.slateM}}>{lbl}</div>
            <select value={spec.layers[k]?.code||""} onChange={e=>s(`layers.${k}.code`,e.target.value)}
              style={{...inputSt,fontFamily:mono,fontSize:11}}>
              {gradeCodes.map(c=><option key={c} value={c}>{c||"— select —"}</option>)}
            </select>
            <Inp value={spec.layers[k]?.gsm||""} onChange={v=>s(`layers.${k}.gsm`,v)} type="number" placeholder="GSM"/>
            {isF?<Sel value={spec[fk]||""} onChange={v=>s(fk,v)}
              opts={[{v:"",l:"—"},...["A","B","C","E"].map(f=>({v:f,l:f}))]}/>
            :<div style={{textAlign:"center",fontSize:11,color:C.slateL}}>—</div>}
          </div>))}
      </div>
      <div style={card}>
        <SH title="Board Specifications"/>
        {(()=>{
          // Tolerance order cycles on click: min → avg → max → min
          const TOL_SEQ=["min","avg","max"];
          const TOL_LABEL={min:"Min",avg:"Avg",max:"Max"}; // abbreviated to fit panel width
          const TC={min:"#3B82F6",avg:"#9B6F2F",max:"#C0392B"};
          const cobbV=spec.spec_cobb?+spec.spec_cobb:null;
          const cobbWarn=cobbV&&cobbV<=125;
          const sheetG=r?Math.round(r.wtSheet*1000):null;
          const estG=r?Math.round(r.estimatedBoxWt*1000):null;
          const reqG=spec.reqBoxWt&&+spec.reqBoxWt>0?+spec.reqBoxWt:null;
          const diffPct=reqG&&estG?Math.abs(estG-reqG)/reqG:null;
          const wtOk=diffPct!==null&&diffPct<=0.015;
          // Input row: flex with value taking 1fr and chip fixed 36px
          // Label sits above as a separate flex row — no wasted spacer column
          // Cycling chip — inline, right of value field
          const TolChip=({tk,def})=>{
            const tol=spec[tk]||def;
            const isDefault=tol===def;
            const next=TOL_SEQ[(TOL_SEQ.indexOf(tol)+1)%3];
            return(
              <button onClick={()=>s(tk,next)}
                title={`Tolerance: ${TOL_LABEL[tol]}${tol==="avg"?" ±5%":""} — click to cycle`}
                style={{flexShrink:0,width:28,padding:"1px 2px",
                  borderRadius:3,border:`1px solid ${isDefault?"#D8D8D8":TC[tol]}`,
                  background:isDefault?"#F4F4F4":TC[tol]+"18",
                  color:isDefault?"#AAA":TC[tol],
                  fontSize:6.5,fontWeight:isDefault?400:700,
                  cursor:"pointer",lineHeight:1.4,whiteSpace:"nowrap",
                  textAlign:"center",display:"block"}}>
                {TOL_LABEL[tol]}
              </button>);
          };
          const LEFT=[
            {k:"board_gsm",lbl:"GSM", unit:"g/m²",   stp:5,   def:"avg"},
            {k:"spec_bs",  lbl:"BS",  unit:"kg/cm²",  stp:0.25,def:"min"},
            {k:"spec_cobb",lbl:"Cobb",unit:"g/m²",   stp:5,   def:"max"},
          ];
          const RIGHT=[
            {k:"spec_ect",   lbl:"ECT",    unit:"kN/m", stp:0.25,def:"min"},
            {k:"spec_bct",   lbl:"BCT",    unit:"kgf",  stp:5,   def:"min"},
            {k:"reqBoxWt",   lbl:"Net Wt", unit:"g",    stp:1,   def:"avg"},
          ];
          // Row: label+unit inline on left (baseline-aligned), input+chip right-aligned.
          // inpColSt: marginRight:2 keeps chip 2px inside column edge.
          // RIGHT map overrides with marginLeft:-3 to pull that bundle leftward.
          const rowSt={display:"flex",alignItems:"center",gap:4,marginBottom:3};
          const lblColSt={flex:"0 0 38%",minWidth:0,display:"flex",alignItems:"baseline",gap:3,flexWrap:"nowrap",paddingLeft:2};
          const inpColSt={display:"flex",gap:3,alignItems:"center",marginRight:2};
          return(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px",marginBottom:4}}>
                {/* LEFT: GSM · BS · Cobb */}
                <div>
                  <SubHdr title="Board"/>
                  {LEFT.map(({k,lbl,unit,stp,def},i)=>{
                    const tk=k+"_tol";
                    const tol=spec[tk]||def;
                    const isDefault=tol===def;
                    const hasVal=spec[k]&&+spec[k]>0;
                    const isCobbWarn=k==="spec_cobb"&&cobbWarn;
                    return(
                    <div key={k} style={{...rowSt,marginBottom:i<2?3:0}}>
                      <div style={lblColSt}>
                        <span style={{fontSize:10,fontWeight:600,color:C.slateM,lineHeight:1}}>{lbl}</span>
                        <span style={{fontSize:7,color:C.slateL,lineHeight:1}}>{unit}</span>
                      </div>
                      <div style={inpColSt}>
                        <Inp value={spec[k]??""} type="number" step={stp}
                          onChange={v=>s(k,v)}
                          st={{textAlign:"right",width:64,boxSizing:"border-box",padding:"3px 5px",
                            borderColor:isCobbWarn?C.amber:hasVal&&!isDefault?TC[tol]:undefined,
                            background:isCobbWarn?"#FFF8ED":undefined}}/>
                        <TolChip tk={tk} def={def}/>
                      </div>
                    </div>);
                  })}
                  {/* Cobb remark — sits flush under left panel, only when triggered */}
                  {cobbWarn&&<div style={{fontSize:8,color:C.amber,marginTop:4,lineHeight:1.3}}>
                    Cobb&#8804;125 → confirm Coating</div>}
                </div>
                {/* RIGHT: ECT · BCT · Net Wt — unified, no separator before Net Wt */}
                <div>
                  <SubHdr title="Performance"/>
                  {RIGHT.map(({k,lbl,unit,stp,def},i)=>{
                    const tk=k+"_tol";
                    const tol=spec[tk]||def;
                    const isDefault=tol===def;
                    const isNetWt=k==="reqBoxWt";
                    const val=isNetWt?spec.reqBoxWt:spec[k];
                    const hasVal=val&&+val>0;
                    const onChange=isNetWt?(v=>s("reqBoxWt",v)):(v=>s(k,v));
                    return(
                    <div key={k} style={{...rowSt,marginBottom:i<2?3:0}}>
                      <div style={lblColSt}>
                        <span style={{fontSize:10,fontWeight:600,color:C.slateM,lineHeight:1}}>{lbl}</span>
                        <span style={{fontSize:7,color:C.slateL,lineHeight:1}}>{unit}</span>
                      </div>
                      <div style={{...inpColSt,marginLeft:-3}}>
                        <Inp value={val??""} type="number" step={stp}
                          onChange={onChange}
                          st={{textAlign:"right",width:64,boxSizing:"border-box",padding:"3px 5px",
                            borderColor:hasVal&&!isDefault?TC[tol]:undefined}}/>
                        <TolChip tk={tk} def={def}/>
                      </div>
                    </div>);
                  })}
                  {/* Weight remarks — sits flush under right panel */}
                  {(sheetG||estG||reqG)&&<div style={{fontSize:8,color:C.slateM,marginTop:4,lineHeight:1.3}}>
                    {sheetG&&<span>Sheet: <b style={{fontFamily:mono,color:C.slate}}>{sheetG} g</b></span>}
                    {estG&&<span style={{marginLeft:6}}>Est: <b style={{fontFamily:mono,color:C.green}}>{estG} g</b>
                      {spec.boxType!=="RSC"&&<span style={{color:C.orange,fontSize:7,marginLeft:2}}>&#9888; verify</span>}
                    </span>}
                    {reqG&&estG&&<span style={{marginLeft:6,color:wtOk?C.green:C.red,fontWeight:600}}>
                      {wtOk?"On target":"\u26A0 "+(diffPct*100).toFixed(1)+"%"}
                    </span>}
                  </div>}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
      <div style={card}>
        <SH title="Commercial Intelligence"/>
        {/* Volume + MOQ — compact 2-col layout */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 8px",marginBottom:5}}>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>
              Volume (nos/month) <span style={{color:C.red}}>*</span></div>
            <Inp value={spec.volume} onChange={v=>s("volume",v)} type="number" step="100" placeholder="boxes/mo"/>
            {r?.calcMOQ&&<div style={{fontSize:9,color:C.slateL,marginTop:2,display:"flex",gap:4}}>
              {[1,2,3].map(m=><button key={m} onClick={()=>s("volume",r.calcMOQ*m)}
                style={{padding:"2px 7px",borderRadius:4,fontSize:9,cursor:"pointer",border:`1px solid ${C.border}`,
                  background:+spec.volume===r.calcMOQ*m?C.amberL:C.white,
                  color:+spec.volume===r.calcMOQ*m?C.amberD:C.slateL}}>{m}×MOQ</button>)}
            </div>}
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>
              Proposed MOQ (boxes)</div>
            <div style={{display:"flex",gap:4,alignItems:"center"}}>
              <Inp value={spec.salesMOQ} onChange={v=>s("salesMOQ",v)} type="number" placeholder="boxes"/>
              {r?.calcMOQ&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:5,whiteSpace:"nowrap",
                background:spec.salesMOQ&&+spec.salesMOQ<r.calcMOQ?C.redL:C.greenL,
                color:spec.salesMOQ&&+spec.salesMOQ<r.calcMOQ?C.red:C.green,fontWeight:700}}>
                Min {r.calcMOQ.toLocaleString()}</span>}
            </div>
            {r?.calcMOQ&&<div style={{fontSize:9,color:C.slateL,marginTop:2}}>
              {r.moqKg.toLocaleString()} kg ÷ {r.wt.toFixed(3)} kg/box</div>}
          </div>
        </div>
        {/* C5: Customer Type, Price Context and Payment Discipline moved to the
            Batch Context bar. Payment Terms still derives Interest there, by the
            same map this block used. */}
        <label style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",fontSize:11,color:C.slateL}}>
          <input type="checkbox" checked={spec.isRepeat} onChange={e=>s("isRepeat",e.target.checked)}
            style={{width:13,height:13,accentColor:C.amber}}/>
          Repeat customer / same SKU
        </label>
      </div>
      <div style={card}>
        <SH title="Commercial Parameters"/>
        {/* ── C5 · SKU COMMERCIAL TABLE ────────────────────────────────────
            Same commercial-table grammar as the Batch Context bar above, one
            level down: PP on row 1, Box on row 2.

            ROW-TYPE BEHAVIOUR IS SOURCE-TRUTH, NOT PRESENTATION. The engine
            reads ONE pair per row - costing.js:47-48,
            effWaste = isPP ? wastePP : waste - and Push formalises only that
            pair. So:

              · the APPLICABLE row is editable and sourced from the SKU (spec);
              · the OTHER row is READ-ONLY and shows the corresponding BATCH
                CONTEXT default, because that is what the other row type would
                cost with. It is not an override, cannot be typed into, and is
                never formalised from this SKU.

            The SKU's single Margin is shown on the applicable row only; the
            inactive row shows the batch Margin default for that type. No value
            is duplicated across both rows.

            ⚠️ FREIGHT AND INTEREST SIT IN A SEPARATE GROUP, NOT A FOURTH
            COLUMN OF THIS MATRIX. They are per-SKU exceptions that belong to
            the whole row, not to PP or to Box: Freight is NOT a PP figure and
            Interest is NOT a Box figure. Sharing the two lines is a COMPACT
            LAYOUT DEVICE ONLY, which is why they carry their own heading and
            their own bordered group, and why that group wraps BELOW the matrix
            at narrow widths instead of being crushed into it. */}
        {(()=>{
          const isPP=isPPType(spec.rowType||"Box");
          const bd=batchDefaults||{};
          const effWaste=isPP?_wasteDefPP:_wasteDefBox;
          const effConv=isPP?_convDefPP:_convDefBox;
          const wKey=isPP?"wastePP":"waste";
          const cKey=isPP?"convRatePP":"convRate";
          const ovW=spec[wKey]!==""&&spec[wKey]!=null&&+spec[wKey]!==+effWaste;
          const ovC=spec[cKey]!==""&&spec[cKey]!=null&&+spec[cKey]!==+effConv;
          const mgnOvr=spec.margin!==""&&spec.margin!=null&&+spec.margin!==(bd.margin??8);

          const mxFr=freight?.[spec.plant]?.[spec.delivery];
          const hasMx=mxFr!=null;
          const mxVal=hasMx?+mxFr:null;
          const frOvr=spec.freightOverride!==""&&spec.freightOverride!=null&&+spec.freightOverride>0;
          const intOvr=spec.interest!==""&&spec.interest!=null&&+spec.interest!==(bd.interest??0.5);

          const hdrCell={fontSize:8,fontWeight:700,color:C.slateL,textAlign:"center",
            textTransform:"uppercase",letterSpacing:"0.04em"};
          const rowCell={fontSize:9,fontWeight:700,color:C.slateL,whiteSpace:"nowrap"};
          const box={width:"100%",padding:"3px 4px",borderRadius:4,fontSize:11,
            textAlign:"center",boxSizing:"border-box",lineHeight:1.2};
          const live=(key,ph,isOvr,extra)=>(
            <input value={spec[key]??""} type="number" step="0.25"
              onChange={e=>s(key,e.target.value)}
              placeholder={ph!=null?String(ph):""}
              title={isOvr?`SKU exception — effective: ${spec[key]}`:`Batch default in effect: ${ph}`}
              style={{...box,border:`1px solid ${isOvr?C.amber:C.border}`,
                background:isOvr?"#FFF8ED":C.white,...(extra||{})}}/>);
          // lineHeight is pinned so a read-only cell is exactly as tall as an
          // input; without it the div inherits the app root's ~26px line box and
          // the inactive row stands proud of the active one.
          const dead=(val,what)=>(
            <div title={`${what} does not apply to this ${isPP?"PP":"Box"} SKU — shown from Batch Context, not costed here`}
              style={{...box,border:`1px solid ${C.border}`,background:"#F5F5F5",
                color:C.slateL,cursor:"not-allowed"}}>
              {val===""||val==null?"—":val}</div>);

          const ppRow=isPP
            ?[live(cKey,effConv,ovC),live(wKey,effWaste,ovW),live("margin",bd.margin??8,mgnOvr)]
            :[dead(bd.convRatePP,"PP conversion"),dead(bd.wastePP,"PP waste"),dead(bd.marginPP,"PP margin")];
          const boxRow=isPP
            ?[dead(bd.convRate,"Box conversion"),dead(bd.waste,"Box waste"),dead(bd.margin,"Box margin")]
            :[live(cKey,effConv,ovC),live(wKey,effWaste,ovW),live("margin",bd.margin??8,mgnOvr)];

          return(
          <div style={{display:"flex",gap:6,alignItems:"flex-start",flexWrap:"wrap",marginBottom:6}}>

            {/* the Box/PP matrix — the only place row type means anything */}
            <div style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 1fr",
              columnGap:5,rowGap:3,alignItems:"center",flex:"1 1 212px",minWidth:208}}>
              <div style={hdrCell}/><div style={hdrCell}>Conv</div>
              <div style={hdrCell}>Waste %</div><div style={hdrCell}>Mgn %</div>
              <div style={{...rowCell,color:isPP?C.amberD:C.slateL}}>PP</div>{ppRow}
              <div style={{...rowCell,color:isPP?C.slateL:C.amberD}}>Box</div>{boxRow}
            </div>

            {/* SKU exceptions — their own group, sharing the two lines only to
                save height. Wraps below the matrix when the column narrows. */}
            <div style={{flex:"0 0 auto",width:86,border:`1px solid ${C.border}`,
              borderRadius:5,background:C.cream,padding:"3px 3px 4px",
              display:"grid",gridTemplateColumns:"auto 32px",columnGap:3,rowGap:3,
              alignItems:"center"}}>
              <div style={{...hdrCell,gridColumn:"1 / -1"}}>SKU exception</div>
              <span style={rowCell} title="Freight Rs/kg">Freight
                {frOvr&&<span style={{color:C.amber,fontWeight:700}}> ↑</span>}
                {!hasMx&&!frOvr&&<span style={{color:C.red}}> ⚠</span>}</span>
              <input type="number" step="0.25" min="0" value={spec.freightOverride??""}
                onChange={e=>s("freightOverride",e.target.value)}
                placeholder={hasMx?String(mxVal):"— no rate"}
                title={frOvr?`SKU exception — batch/matrix: ${hasMx?mxVal+" Rs/kg":"no entry"}`
                  :hasMx?`Batch/matrix: ${mxVal} Rs/kg (${spec.plant||"?"} → ${spec.delivery||"?"})`
                  :`No freight rate for ${spec.plant||"?"}→${spec.delivery||"?"}. Enter a manual exception.`}
                style={{...box,fontFamily:mono,
                  border:`1px solid ${frOvr?C.amber:(!hasMx&&!frOvr)?C.red:C.border}`,
                  background:frOvr?"#FFF8ED":C.white}}/>
              <span style={rowCell} title="Interest %">Interest
                {intOvr&&<span style={{color:C.amber,fontWeight:700}}> ↑</span>}</span>
              <input type="number" step="0.25" value={spec.interest??""}
                onChange={e=>s("interest",e.target.value)}
                placeholder={String(bd.interest??0.5)}
                title={intOvr?`SKU exception — batch default: ${bd.interest??0.5}`
                  :`Batch default in effect: ${bd.interest??0.5}`}
                style={{...box,border:`1px solid ${intOvr?C.amber:C.border}`,
                  background:intOvr?"#FFF8ED":C.white}}/>
            </div>
          </div>);
        })()}
        <div style={{fontSize:9,color:C.slateL,textAlign:"center",lineHeight:1.5}}>
          Batch defaults live in <b>Batch Context</b> above. Values here are
          <b> SKU exceptions</b> for this row; Payment Terms follow the batch.
        </div>
      </div>
      <div style={card}>
        <div style={{fontSize:9,fontWeight:700,color:C.amber,textTransform:"uppercase",letterSpacing:"0.09em",borderBottom:`1px solid ${C.amber}`,paddingBottom:3,marginBottom:8,display:"flex",alignItems:"baseline",justifyContent:"center",gap:6}}>
          <span>Add-on Costs</span>
          {(()=>{
            const LABELS={printing:"Print",stitching:"Stitch",coating:"Coat",
              handling:"Hdlg",moqCharge:"MOQ±",packing:"Pack",other:"Other",unloading:"Unload"};
            const active=Object.entries(LABELS).filter(([k])=>spec[k]&&+spec[k]>0)
              .map(([k,l])=>`${l} ₹${(+spec[k]).toFixed(0)}`);
            return active.length?<span style={{fontSize:8,fontWeight:400,color:C.amber,textTransform:"none",letterSpacing:0}}>({active.join(" · ")})</span>:null;
          })()}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"5px 8px"}}>
          {[["printing","Printing","Rs/pc"],["stitching","Stitching","Rs/pc"],["coating","Coating","Rs/pc"],["handling","Non-Std Hdlg","Rs/pc"],
            ["moqCharge","MOQ Chg","Rs/pc"],["packing","Packing","Rs/pc"],["other","Other","Rs/pc"],["unloading","Unloading","Rs/pc"]].map(([k,lbl,unit])=>(
            <div key={k}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:1}}>{lbl}</div>
              <div style={{display:"flex",alignItems:"center",gap:2}}>
                <input value={spec[k]??0} type="number" step="0.25" onChange={e=>s(k,+e.target.value)}
                  style={{width:"100%",padding:"4px 5px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center",boxSizing:"border-box",fontFamily:mono}}/>
                <span style={{fontSize:9,color:C.slateL,whiteSpace:"nowrap"}}>{unit}</span>
              </div>
            </div>))}
        </div>
      </div>
      {/* ── SinglePointQuoteFinalization: Costing is analysis-only ── */}
      {activeBatchRowId
        ? (()=>{
            // BH-1: detect if construction fields in Costing differ from the library entry
            // for the active batch row. If so, warn the Maker before they navigate away.
            const _activeRow=batchRows.find(r=>r.id===activeBatchRowId);
            const _libEntry=_activeRow?constructionLib.find(c=>c.code===_activeRow.constructionCode):null;
            const _constrChanged=_libEntry&&(
              +spec.ply!==+_libEntry.ply||
              spec.boxType!==_libEntry.boxType||
              spec.flute_F1!==_libEntry.flute_F1||
              spec.flute_F2!==_libEntry.flute_F2||
              JSON.stringify(spec.layers||{})!==JSON.stringify(_libEntry.layers||{})
            );
            return(<>
              {/* A2b: visible banner naming the linked row — Maker always knows which row is under review */}
              <div style={{background:"#EEF4FB",border:"1px solid #2E6094",borderRadius:5,
                  padding:"6px 10px",marginBottom:4,fontSize:11,color:"#2E6094",lineHeight:1.5}}>
                🔍 <b>Reviewing Batch Row {batchRows.indexOf(_activeRow)+1}</b>
                {_activeRow?.matCode?<> [{_activeRow.matCode}]</>:null}
                {_activeRow?.product?<span style={{fontWeight:400}}> — {_activeRow.product}</span>:null}
                <span style={{fontWeight:400,marginLeft:4,fontSize:10}}>
                  · Changes apply only on Push
                </span>
              </div>
              {_constrChanged&&<div style={{
                  background:"#FFF8ED",border:`1px solid ${C.amber}`,borderRadius:5,
                  padding:"6px 10px",marginBottom:4,fontSize:11,color:C.amberD,lineHeight:1.5}}>
                ⚠️ Construction changes not yet saved to Batch row <b>[{_activeRow?.matCode||"?"}]</b>.
                Push to apply, or Unlink to discard.
              </div>}
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button onClick={pushCostingToBatchRow}
                  style={{flex:1,padding:"9px",borderRadius:6,border:"none",fontFamily:sans,
                    fontSize:13,fontWeight:700,cursor:"pointer",
                    background:C.green,color:"white",letterSpacing:"0.02em"}}>
                  ↑ Push to Row {batchRows.indexOf(_activeRow)+1}{_activeRow?.matCode?` [${_activeRow.matCode}]`:""}
                </button>

              </div>
            </>);
          })()
        : (()=>{
            // Readiness state is hoisted (_sendReady etc.) — reference directly
            return(
            <div style={{borderRadius:7,border:`1px solid ${_sendReady?"#2E6094":"#C0A000"}`,
              background:_sendReady?"#EEF4FB":"#FFFBEA",
              padding:"10px 12px",marginTop:4}}>
              <div style={{fontSize:11,fontWeight:700,
                color:_sendReady?"#2E6094":"#7A4500",marginBottom:4}}>
                {_sendReady?"✅ Ready to send to Batch Entry":"⚠️ Costing → Batch Entry"}
              </div>
              <div style={{fontSize:10,color:_sendReady?"#2E6094":"#7A4500",lineHeight:1.5}}>
                {_sendReady
                  ?"Use → Send to Batch Entry in the header to create a batch row."
                  :"Resolve the items shown in the right panel to enable Send."}
              </div>
            </div>);
          })()}
    </div>
  );
}
