// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/costing/BatchContextBar.jsx — Costing's Batch Context.
//
// C5. THIS CREATES NO FIELD AND NO DATA. It is the existing batch-level fields,
// relocated out of SpecForm's scattered cards into one compact sticky bar.
//
// VISUAL GRAMMAR IS BATCH ENTRY'S, deliberately: compact horizontal summaries
// while closed, replaced by rotated section-label rails — Customer ·
// Commercials · Terms — when opened. Expanded content uses the same grids
// BatchProfileBar uses (auto 1fr auto 1fr for identity, a 24px + three-column
// table for the Box/PP commercials, auto 1fr for terms). The same instrument at
// two levels; a Maker who can read the Batch Profile can read this.
//
// TWO MODES, ONE LAYOUT, ONE AUTHORITY:
//
//  · new-batch START — editable, writing profileDraft.values directly. There is
//    no Batch Profile yet, so this IS where those fields live.
//  · same-batch START and REVIEW — the SAME cells with every control replaced by
//    a read-only chip over the live batchProfile. No focusable data editor
//    exists in that mode; Edit Batch Profile is the only tab stop.
//
// Sticky by structure: between the START/REVIEW strip and the panels, outside
// both scroll containers, so it stays put while SKU inputs scroll.
//
// S7(c). The Payment → Interest rule is Batch Entry's, and it changed in both
// places at once: choosing a term no longer rewrites Interest from a map. The
// term is the INPUT and the percentage is a RESOLVED OUTPUT, derived from the
// approved annual rate. Interest still has no independent editor here; what it
// shows is now the RESOLVED value and its source, not a stored literal.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { PLANTS } from "../../data/defaults.js";
import { resolveField, resolveInterest } from "../../engine/resolveAuthority.js";
import { useAppState } from "../../state/AppStateContext.js";
import { normalizeProfileOverrideInput } from "../../state/costingDraftModel.js";
import { C, T } from "../../theme.js";
import { SummaryRow } from "../../ui/dataDisplay.jsx";

// S7(c) SITE 5. PAY_INTEREST is gone: it was the second copy of the withdrawn
// map, and the `|| 1.5` beside it was the forbidden fallback CDM-18 names
// explicitly. The options no longer quote a percentage either, because the
// percentage is not a property of the term any more - it is derived, and the
// read-out shows it once, resolved, with its source.
const PAY_OPTS=[["30","≤30d"],["45","≤45d"],["60","≤60d"],["90","≤90d"]];
const CUST_OPTS=[["existing","Existing"],["new","New"],["strategic","Strategic"],["spot","Spot"]];
const PRICE_OPTS=[["unknown","Unknown"],["sensitive","Sensitive"],["premium","Premium"],["tender","Tender"]];

const txt=v=>(v===""||v===null||v===undefined)?"—":String(v);

// Batch Entry's own type scale, reused verbatim.
const lbl={fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"};
const rowLbl={fontSize:9,fontWeight:700,color:C.slateL,whiteSpace:"nowrap"};
const hdr={fontSize:8,fontWeight:700,color:C.slateL,textAlign:"center",
  textTransform:"uppercase",letterSpacing:"0.04em"};
const sectionLabel={color:C.amber,fontWeight:700,fontSize:7.5,textTransform:"uppercase",
  letterSpacing:"0.12em",whiteSpace:"nowrap"};
const card={background:C.white,border:`1px solid ${C.border}`,borderRadius:6,
  padding:"4px 8px 4px 4px",display:"flex",flexDirection:"row",gap:6,
  alignItems:"stretch",flexShrink:0};
// The app's established read-only idiom, sized to occupy the same cell an input
// would, so the two modes are one layout rather than two.
const chip=ovr=>({padding:"2px 6px",borderRadius:3,fontSize:10,whiteSpace:"nowrap",
  border:`1px solid ${ovr?C.amber:C.border}`,background:ovr?"#FFF8ED":"#F5F5F5",
  color:ovr?C.amberD:C.slate,textAlign:"center",boxSizing:"border-box",
  minWidth:0,overflow:"hidden",textOverflow:"ellipsis"});
const inp=(ovr,w)=>({padding:"2px 4px",borderRadius:3,fontSize:10,width:w,minWidth:0,
  boxSizing:"border-box",border:`1px solid ${ovr?C.amber:C.border}`,
  background:ovr?"#FFF8ED":C.white,color:C.slate});

export default function BatchContextBar(){
  const { activeBatchRowId, applyContextCascade, contextValues, freight, locations,
    missing, profileDraft, r, sectorCodes, sectors, setContextField, setTab } = useAppState();

  // Same label behaviour as BatchProfileBar: the band label opens every card
  // when all are closed and collapses all otherwise. Presentation only.
  const [openCards,setOpenCards]=useState({customer:false,commercials:false,terms:false});
  const anyCardOpen=Object.values(openCards).some(Boolean);
  const setCardOpen=key=>open=>setOpenCards(current=>({...current,[key]:open}));
  const toggleAllCards=()=>{
    const next=!anyCardOpen;
    setOpenCards({customer:next,commercials:next,terms:next});
  };

  // Editable ONLY while preparing a new batch. REVIEW is always read-only over
  // the live profile — contextValues already returns batchProfile there, and a
  // review copy must never be able to edit batch context.
  const editable=profileDraft!==null&&!activeBatchRowId;
  const v=contextValues||{};

  // Override marking, identical rule to BatchProfileBar — and identical BECAUSE
  // both now ask the same resolver instead of each restating the chain. This
  // block used to spell out `sector ?? literal` by hand and to note that "margin
  // is not sector-derived, so it compares against the literal 8"; margin has a
  // Sector tier in CDM-19 and now goes through it, which resolves to the same 8
  // today because the browser-local Sector master carries no margin column.
  const sd=sectors.find(x=>x.code===v.sector);
  const _inh=(field,isPP)=>resolveField(field,
    {rowOverride:'',batchProfile:{},sector:sd,isPP}).value;
  const def={convRate:_inh('convRate',false),waste:_inh('waste',false),
    convRatePP:_inh('convRate',true),wastePP:_inh('waste',true),
    margin:_inh('margin',false),marginPP:_inh('margin',true)};
  // Any stored value is an override, even one that equals the inherited number:
  // it is still a value someone typed and it still survives a Sector change.
  // Same rule as BatchProfileBar, for the same reason.
  const isOvr=k=>{const x=v[k];return x!==undefined&&x!==null&&x!=='';};
  const tip=k=>isOvr(k)
    ?`Override — stored on this Batch. Clear it to inherit ${def[k]}`
    :`Inherited: ${def[k]}. Nothing is stored on this Batch for this field`;

  const matrixFr=freight?.[v.plant]?.[v.delivery]??0;
  const frOvr=v.freightOverride!==''&&v.freightOverride!==undefined&&v.freightOverride!==null;
  const frShown=frOvr?v.freightOverride:matrixFr;
  const interestResolution=resolveInterest({pricingGroup:{
    paymentTermsDays:v.paymentDisc, interestOverridePct:v.interest}});
  const interestOvr=interestResolution.source==="pricing_group";
  const termsOverrideCount=Number(frOvr)+Number(interestOvr);

  // ── writers (new-batch only) ────────────────────────────────────────────
  // Each is ONE action: the batch value moves, and the SKU value follows only
  // while it was still tracking the old default.
  // S7(c) SITE 3. The mirror of Batch Entry's Sector select: it stamped the same
  // four numbers into the context cascade. It now moves the Sector alone and lets
  // the resolver answer, which is also what makes the two surfaces agree.
  const pickSector=code=>applyContextCascade({sector:code});
  const pickPlace=(key,val)=>{
    const plant=key==="plant"?val:v.plant, deliv=key==="delivery"?val:v.delivery;
    const fr=freight?.[plant]?.[deliv];
    // C7a: no skuMap - freight is not a Costing-editable SKU exception any more,
    // so there is no SKU copy to advance.
    applyContextCascade(fr===undefined?{[key]:val}:{[key]:val,freightOverride:fr});
  };
  // C7a: no skuMap for interest, for the same reason as freight above.
  // S7(c) SITE 5. Writes the TERM only. An explicit Interest override survives a
  // Payment Terms change (CDM-18), so this must not touch it.
  const pickPayment=code=>applyContextCascade({paymentDisc:code});

  // Plain FUNCTIONS, not components: a component declared inside render gets a
  // new identity every render, so React would remount the input on every
  // keystroke and focus would jump out of the field.
  const sel=(val,opts,onPick,w)=>editable
    ?<select value={val??""} onChange={e=>onPick(e.target.value)}
       style={{...inp(false,w),cursor:"pointer"}}>
       {opts.map(o=><option key={o[0]} value={o[0]}>{o[1]}</option>)}
     </select>
    :<span style={chip(false)}>{(opts.find(o=>o[0]===val)||[null,txt(val)])[1]}</span>;
  const num=k=>editable
    ?<input type="number" step="0.25" value={v[k]??""} title={tip(k)}
       placeholder={def[k]==null?"":String(def[k])}
       onChange={e=>setContextField(k,normalizeProfileOverrideInput(e.target.value),
         k==="marginPP"?null:k)}
       style={{...inp(isOvr(k),"100%"),textAlign:"center"}}/>
    :<span style={chip(isOvr(k))} title={tip(k)}>
       {txt(isOvr(k)?v[k]:def[k])}</span>;
  const commercialOverrideCount=["convRate","waste","margin","convRatePP","wastePP","marginPP"]
    .filter(isOvr).length;
  const effective=k=>isOvr(k)?v[k]:def[k];

  return(
    <div style={{background:"#FEF8F0",borderBottom:`2px solid ${C.amber}`,
      padding:"4px 12px",flexShrink:0,display:"flex",gap:8,alignItems:"stretch",
      lineHeight:1.25,overflowX:"auto"}}>

      {/* ── BAND LABEL ── */}
      <div style={{display:"flex",alignItems:anyCardOpen?"stretch":"center",marginRight:2,flexShrink:0}}>
        <button type="button" onClick={toggleAllCards} aria-expanded={anyCardOpen}
          title={anyCardOpen?"Collapse all context cards":"Open all context cards"}
          style={{color:C.amber,fontWeight:800,textTransform:"uppercase",whiteSpace:"nowrap",
            background:C.amberL,border:`1px solid ${C.amber}55`,borderRadius:4,cursor:"pointer",
            fontFamily:"inherit",lineHeight:1,
            ...(anyCardOpen
              ?{writingMode:"vertical-rl",transform:"rotate(180deg)",fontSize:T.micro,
                letterSpacing:"0.08em",padding:"6px 4px"}
              :{fontSize:T.label,letterSpacing:"0.1em",padding:"3px 6px"})}}>
          {editable?"New Batch":"Context"}</button>
      </div>

      {/* ── 1. CUSTOMER — 3 × 2 grid, Batch Entry's field order ── */}
      <SummaryRow title="Customer"
        facts={[v.client||"No client",v.sector||"No sector",
          [v.plant,v.delivery].filter(Boolean).join(" → ")||"Route unresolved"]}
        status={editable?"Editable":(v.customerType||"existing").replace(/^./,c=>c.toUpperCase())}
        statusTone={editable?"warning":"neutral"}
        expanded={openCards.customer} onExpandedChange={setCardOpen("customer")}
        verticalTitleWhenExpanded titleStyle={sectionLabel}
        style={{minWidth:300,maxWidth:420,flex:"1 1 360px",alignSelf:"stretch"}}
        contentStyle={{padding:0}}>
      <div style={{...card,border:0,borderRadius:0,padding:"4px 8px"}}>
        <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto 1fr",
          columnGap:5,rowGap:3,alignItems:"center"}}>
          <span style={lbl}>Client</span>
          {editable
            ?<input value={v.client??""} onChange={e=>setContextField("client",e.target.value)}
               style={inp(false,96)}/>
            :<span style={{...chip(false),textAlign:"left"}}>{txt(v.client)}</span>}
          <span style={lbl}>Sector</span>
          {sel(v.sector,[["","— select —"],...sectorCodes.map(c=>[c,c])],pickSector,92)}

          <span style={lbl}>Producing Plant</span>
          {sel(v.plant,[["","— select —"],...PLANTS.map(x=>[x,x])],x=>pickPlace("plant",x),92)}
          <span style={lbl}>Delivery</span>
          {sel(v.delivery,[["","— select —"],...locations.map(x=>[x,x])],x=>pickPlace("delivery",x),92)}

          <span style={lbl}>Cust Type</span>
          {sel(v.customerType||"existing",CUST_OPTS,x=>setContextField("customerType",x),92)}
          <span style={lbl}>Price Ctx</span>
          {sel(v.priceContext||"unknown",PRICE_OPTS,x=>setContextField("priceContext",x),92)}
        </div>
      </div>
      </SummaryRow>

      {/* ── 2. COMMERCIALS — header row + Box and PP data rows ── */}
      <SummaryRow title="Commercials"
        facts={[`Box ${effective("convRate")}/${effective("waste")}/${effective("margin")}`,
          `PP ${effective("convRatePP")}/${effective("wastePP")}/${effective("marginPP")}`]}
        status={commercialOverrideCount?`${commercialOverrideCount} override${commercialOverrideCount===1?"":"s"}`:"Inherited"}
        statusTone={commercialOverrideCount?"warning":"neutral"}
        expanded={openCards.commercials} onExpandedChange={setCardOpen("commercials")}
        verticalTitleWhenExpanded titleStyle={sectionLabel}
        style={{minWidth:260,maxWidth:340,flex:"1 1 300px",alignSelf:"stretch"}}
        contentStyle={{padding:0}}>
      <div style={{...card,border:0,borderRadius:0,padding:"4px 8px"}}>
        <div style={{display:"grid",gridTemplateColumns:"24px 52px 52px 52px",
          columnGap:5,rowGap:3,alignItems:"center",minWidth:0}}>
          <div style={hdr}/><div style={hdr}>Conv</div><div style={hdr}>Wst%</div><div style={hdr}>Mgn%</div>
          <div style={rowLbl}>Box</div>{num("convRate")}{num("waste")}{num("margin")}
          <div style={rowLbl}>PP</div>{num("convRatePP")}{num("wastePP")}{num("marginPP")}
        </div>
      </div>
      </SummaryRow>

      {/* ── 3. TERMS — Freight + Payment·Interest ── */}
      <SummaryRow title="Terms"
        facts={[`Fr ${frShown===''||frShown==null?"—":frShown}`,`PT ≤${v.paymentDisc||"30"}d`,`Int ${interestResolution.value}%`]}
        status={termsOverrideCount?`${termsOverrideCount} override${termsOverrideCount===1?"":"s"}`:"Inherited"}
        statusTone={termsOverrideCount?"warning":"neutral"}
        expanded={openCards.terms} onExpandedChange={setCardOpen("terms")}
        verticalTitleWhenExpanded titleStyle={sectionLabel}
        style={{minWidth:220,flexShrink:0,alignSelf:"stretch"}}
        contentStyle={{padding:0}}>
        <div style={{...card,border:0,borderRadius:0,padding:"4px 8px"}}>
        <div style={{display:"grid",gridTemplateColumns:"auto 1fr",
          columnGap:8,rowGap:4,alignItems:"center",flex:1}}>
          <span style={rowLbl}>Freight</span>
          <div style={{display:"flex",alignItems:"center",gap:3}}>
            {editable
              ?<input type="number" step="0.25" min="0" value={frShown??""}
                 title={`Freight Rs/kg — matrix: ${matrixFr}${frOvr?" | OVERRIDDEN":""}`}
                 onChange={e=>{const raw=e.target.value;
                   const manual=raw!==''&&+raw!==matrixFr;
                   setContextField("freightOverride",manual?+raw:'',"freightOverride");}}
                 style={{...inp(frOvr,48),textAlign:"center"}}/>
              :<span style={{...chip(frOvr),minWidth:34}} title={`Matrix: ${matrixFr}`}>
                 {frShown===''||frShown==null?"—":frShown}</span>}
            {/* the unit is written ONCE, as Batch Entry writes it */}
            <span style={{fontSize:T.micro,color:C.slateL}}>Rs/kg</span>
          </div>
          <span style={rowLbl} title="Payment Terms is the input; customer interest is derived">PT · Int</span>
          {(()=>{
            const note=interestOvr
              ? `Customer interest ${interestResolution.value}% — OVERRIDE stored on this Batch`
              : `Customer interest ${interestResolution.value}% — derived from ${interestResolution.annualInterestPct}% p.a. `
                + `on a ${interestResolution.dayCountBasis}-day year`;
            return editable
              ?<div style={{display:"flex",alignItems:"center",gap:4,minWidth:0}}>
                 <select value={v.paymentDisc||"30"} onChange={e=>pickPayment(e.target.value)}
                   title={note} style={{...inp(false,"100%"),cursor:"pointer"}}>
                   {PAY_OPTS.map(o=><option key={o[0]} value={o[0]}>{o[1]}</option>)}
                 </select>
                 <span style={{fontSize:T.label,fontWeight:700,whiteSpace:"nowrap",
                   color:interestOvr?C.amberD:C.slateL}}>{interestResolution.value}%</span>
               </div>
              :<span style={chip(false)} title={note}>
                 {v.paymentDisc?`≤${v.paymentDisc}d`:"—"} · {interestResolution.value}%{interestOvr?" ovr":""}</span>;
          })()}
        </div>
        </div>
      </SummaryRow>

      {/* ── 4. STATUS + ACTIONS — readiness is display-only; editing stays gated ── */}
      {(missing.blockers.length===0&&r||!editable)&&
        <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:"auto",flexShrink:0}}>
          {missing.blockers.length===0&&r&&
            <span style={{padding:"4px 8px",borderRadius:999,
              border:`1px solid ${C.green}55`,background:C.greenL,color:C.green,
              fontSize:T.label,fontWeight:700,whiteSpace:"nowrap"}}>
              ✅ Ready to quote{missing.warnings.length>0?` (${missing.warnings.length} warning${missing.warnings.length>1?"s":""} noted)`:""}
            </span>}
          {!editable&&<button onClick={()=>setTab("batch")}
            title="Open Batch Entry to change the Batch Profile"
            style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${C.amber}`,
              background:C.white,color:C.amber,fontSize:10,fontWeight:700,cursor:"pointer",
              whiteSpace:"nowrap"}}>
            Edit Batch Profile
          </button>}
        </div>}
    </div>
  );
}
