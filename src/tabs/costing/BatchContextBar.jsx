// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/costing/BatchContextBar.jsx — Costing's Batch Context.
//
// C5. THIS CREATES NO FIELD AND NO DATA. It is the existing batch-level fields,
// relocated out of SpecForm's scattered cards into one compact sticky bar.
//
// VISUAL GRAMMAR IS BATCH ENTRY'S, deliberately: three bordered cards with
// rotated section labels — Customer · Commercials · Terms — on the same grids
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
// The Payment → Interest rule is Batch Entry's, unchanged: choosing a term
// rewrites Interest from the same map. Interest has no independent editor in
// either mode, and always shows the STORED value.
// ═══════════════════════════════════════════════════════════════════════════
import { PLANTS } from "../../data/defaults.js";
import { useAppState } from "../../state/AppStateContext.js";
import { C } from "../../theme.js";

const PAY_INTEREST={"30":0.5,"45":0.75,"60":1.0,"90":1.5};
const PAY_OPTS=[["30","≤30d · 0.5%"],["45","≤45d · 0.75%"],["60","≤60d · 1.0%"],["90","≤90d · 1.5%"]];
const CUST_OPTS=[["existing","Existing"],["new","New"],["strategic","Strategic"],["spot","Spot"]];
const PRICE_OPTS=[["unknown","Unknown"],["sensitive","Sensitive"],["premium","Premium"],["tender","Tender"]];

const txt=v=>(v===""||v===null||v===undefined)?"—":String(v);

// Batch Entry's own type scale, reused verbatim.
const lbl={fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"};
const rowLbl={fontSize:9,fontWeight:700,color:C.slateL,whiteSpace:"nowrap"};
const hdr={fontSize:8,fontWeight:700,color:C.slateL,textAlign:"center",
  textTransform:"uppercase",letterSpacing:"0.04em"};
const vert={color:C.amber,fontWeight:700,fontSize:7.5,textTransform:"uppercase",
  letterSpacing:"0.12em",writingMode:"vertical-rl",transform:"rotate(180deg)",whiteSpace:"nowrap"};
const card={background:C.white,border:`1px solid ${C.border}`,borderRadius:6,
  padding:"4px 8px 4px 4px",display:"flex",flexDirection:"row",gap:6,
  alignItems:"stretch",flexShrink:0};
const vertWrap={display:"flex",alignItems:"center",justifyContent:"center",width:14,flexShrink:0};
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
    profileDraft, sectorCodes, sectors, setContextField, setTab } = useAppState();

  // Editable ONLY while preparing a new batch. REVIEW is always read-only over
  // the live profile — contextValues already returns batchProfile there, and a
  // review copy must never be able to edit batch context.
  const editable=profileDraft!==null&&!activeBatchRowId;
  const v=contextValues||{};

  // Override marking, identical rule to BatchProfileBar:139 — compare against
  // the sector master resolved from THIS mode's sector. Margin is not
  // sector-derived, so it compares against the literal 8 and says "Default".
  const sd=sectors.find(x=>x.code===v.sector);
  const def={convRate:sd?sd.convBox:7,waste:sd?sd.wasteCBB:5,
    convRatePP:sd?sd.convPP:12.5,wastePP:sd?sd.wastePP:5,margin:8,marginPP:8};
  const isOvr=k=>{const x=v[k];return x!==undefined&&x!==null&&x!==''&&+x!==+def[k];};
  const sectorial=k=>k!=="margin"&&k!=="marginPP";
  const tip=k=>isOvr(k)
    ?`Overriding ${sectorial(k)?"sector default":"default"} (${def[k]})`
    :`${sectorial(k)?"Sector default":"Default"}: ${def[k]}`;

  const matrixFr=freight?.[v.plant]?.[v.delivery]??0;
  const frOvr=v.freightOverride!==''&&v.freightOverride!==undefined&&v.freightOverride!==null;
  const frShown=frOvr?v.freightOverride:matrixFr;

  // ── writers (new-batch only) ────────────────────────────────────────────
  // Each is ONE action: the batch value moves, and the SKU value follows only
  // while it was still tracking the old default.
  const pickSector=code=>{
    const n=sectors.find(x=>x.code===code);
    applyContextCascade({sector:code,waste:n?n.wasteCBB:5,convRate:n?n.convBox:7,
      wastePP:n?n.wastePP:5,convRatePP:n?n.convPP:12.5},
      {waste:"waste",convRate:"convRate",wastePP:"wastePP",convRatePP:"convRatePP"});
  };
  const pickPlace=(key,val)=>{
    const plant=key==="plant"?val:v.plant, deliv=key==="delivery"?val:v.delivery;
    const fr=freight?.[plant]?.[deliv];
    applyContextCascade(fr===undefined?{[key]:val}:{[key]:val,freightOverride:fr},
      {freightOverride:"freightOverride"});
  };
  const pickPayment=code=>applyContextCascade(
    {paymentDisc:code,interest:PAY_INTEREST[code]||1.5},{interest:"interest"});

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
       onChange={e=>setContextField(k,e.target.value===""?def[k]:+e.target.value,
         k==="marginPP"?null:k)}
       style={{...inp(isOvr(k),"100%"),textAlign:"center"}}/>
    :<span style={chip(isOvr(k))} title={tip(k)}>{txt(v[k])}</span>;

  return(
    <div style={{background:"#FEF8F0",borderBottom:`2px solid ${C.amber}`,
      padding:"4px 12px",flexShrink:0,display:"flex",gap:8,alignItems:"stretch",
      lineHeight:1.25,overflowX:"auto"}}>

      {/* ── BAND LABEL ── */}
      <div style={{display:"flex",alignItems:"center",marginRight:2,flexShrink:0}}>
        <span style={{...vert,fontSize:10,fontWeight:800,letterSpacing:"0.1em"}}>
          {editable?"New Batch":"Context"}</span>
      </div>

      {/* ── 1. CUSTOMER — 3 × 2 grid, Batch Entry's field order ── */}
      <div style={card}>
        <div style={vertWrap}><span style={vert}>Customer</span></div>
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

      {/* ── 2. COMMERCIALS — header row + Box and PP data rows ── */}
      <div style={card}>
        <div style={vertWrap}><span style={vert}>Commercials</span></div>
        <div style={{display:"grid",gridTemplateColumns:"24px 52px 52px 52px",
          columnGap:5,rowGap:3,alignItems:"center",minWidth:0}}>
          <div style={hdr}/><div style={hdr}>Conv</div><div style={hdr}>Wst%</div><div style={hdr}>Mgn%</div>
          <div style={rowLbl}>Box</div>{num("convRate")}{num("waste")}{num("margin")}
          <div style={rowLbl}>PP</div>{num("convRatePP")}{num("wastePP")}{num("marginPP")}
        </div>
      </div>

      {/* ── 3. TERMS — Freight + Payment·Interest ── */}
      <div style={card}>
        <div style={vertWrap}><span style={vert}>Terms</span></div>
        <div style={{display:"grid",gridTemplateColumns:"auto 1fr",
          columnGap:8,rowGap:4,alignItems:"center"}}>
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
            <span style={{fontSize:8,color:C.slateL}}>Rs/kg</span>
          </div>
          <span style={rowLbl} title="Payment Terms → auto-sets Interest %">PT · Int</span>
          {editable
            ?<select value={v.paymentDisc||"30"} onChange={e=>pickPayment(e.target.value)}
               style={{...inp(false,"100%"),cursor:"pointer"}}>
               {PAY_OPTS.map(o=><option key={o[0]} value={o[0]}>{o[1]}</option>)}
             </select>
            :<span style={chip(false)} title="Interest is set by Payment Terms">
               {v.paymentDisc?`≤${v.paymentDisc}d`:"—"} · {v.interest===''||v.interest==null?"—":`${v.interest}%`}</span>}
        </div>
      </div>

      {/* ── 4. ACTIONS — read-only mode only; the bar's single tab stop ── */}
      {!editable&&<div style={{display:"flex",alignItems:"center",marginLeft:"auto",flexShrink:0}}>
        <button onClick={()=>setTab("batch")}
          title="Open Batch Entry to change the Batch Profile"
          style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${C.amber}`,
            background:C.white,color:C.amber,fontSize:10,fontWeight:700,cursor:"pointer",
            whiteSpace:"nowrap"}}>
          Edit Batch Profile
        </button>
      </div>}
    </div>
  );
}
