// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/batch/BatchProfileBar.jsx — the Batch Entry header card.
//
// Extracted from QuotationApp.jsx (Phase 7b). Structural move only.
//
// Four sections: Customer Details, Commercials, Terms, Actions.
//
// ⚠️ The two buttons in the Actions section are MARKUP ONLY here. Their
// handlers — copyCostingToProfile (the C11 guard) and startNewBatch (D-2) —
// were lifted into state/useCostingBatchBridge.js by Phase 7's prerequisite
// commit, precisely so this extraction could not disturb them. Do not inline
// either handler back into this file.
//
// See D-13: both guards block this state and both point the user at
// + New Batch, which is the destructive action. Recorded, deliberately unfixed.
// ═══════════════════════════════════════════════════════════════════════════
import { PLANTS } from "../../data/defaults.js";
import { C } from "../../theme.js";
import { useAppState } from "../../state/AppStateContext.js";

export default function BatchProfileBar(){
  const {batchAgeLabel,batchProfile,copyCostingToProfile,freight,importConstrFromSpec,locations,
    sectorCodes,sectors,setBatchProfile,startNewBatch}=useAppState();

  return(
    <div style={{background:"#FEF8F0",borderBottom:`2px solid ${C.amber}`,
      padding:"4px 12px 4px",flexShrink:0,display:"flex",gap:8,alignItems:"stretch"}}>

      {/* ── SECTION LABEL ── */}
      <div style={{display:"flex",alignItems:"center",marginRight:2}}>
        <span style={{color:C.amber,fontWeight:800,fontSize:10,textTransform:"uppercase",
          letterSpacing:"0.1em",writingMode:"vertical-rl",transform:"rotate(180deg)",
          whiteSpace:"nowrap"}}>Batch Profile</span>
      </div>

      {/* ── D-5: batch age — SURFACED, NOT GATED ────────────────────────────────
          The autosave used to be age-gated: past 7 days the recovery banner did not
          appear and the rows became unreachable through the UI even though they were
          still in localStorage. That gate is gone — batchRows hydrates regardless of
          age. This is what replaces it: information, with no behaviour attached.
          Do NOT hang a condition off this. A quieter age gate is still an age gate,
          and the gate is what created the hole. */}
      {batchAgeLabel&&(
        <div style={{display:"flex",alignItems:"center",marginRight:2}}
          title="This batch was last saved some time ago. It loads normally; this is a reminder, not a warning.">
          <span style={{fontSize:8,color:C.slateL,fontWeight:600,whiteSpace:"nowrap",
            background:C.cream,border:`1px solid ${C.border}`,borderRadius:3,padding:"2px 5px"}}>
            🕐 {batchAgeLabel}</span>
        </div>)}

      {/* ── 1. CUSTOMER DETAILS — 3 × 2 grid (label | field) ── */}
      <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,
        padding:"4px 8px 4px 4px",display:"flex",flexDirection:"row",gap:6,alignItems:"stretch"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",width:14,flexShrink:0}}>
          <span style={{color:C.amber,fontWeight:700,fontSize:7.5,textTransform:"uppercase",
            letterSpacing:"0.12em",writingMode:"vertical-rl",transform:"rotate(180deg)",
            whiteSpace:"nowrap"}}>Customer</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto 1fr",
          columnGap:5,rowGap:3,alignItems:"center"}}>
          {/* Row 1: Client | Sector */}
          <span style={{fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"}}>Client</span>
          <input value={batchProfile.client||""} onChange={e=>setBatchProfile(p=>({...p,client:e.target.value}))}
            style={{padding:"2px 6px",borderRadius:3,border:`1px solid ${C.border}`,
              fontSize:10,background:C.white,color:C.slate,width:90,minWidth:0}}/>
          <span style={{fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"}}>Sector</span>
          <select value={batchProfile.sector||""} onChange={e=>{
              const v=e.target.value;
              const sd=sectors.find(x=>x.code===v);
              setBatchProfile(p=>({...p,sector:v,
                waste:sd?sd.wasteCBB:5,convRate:sd?sd.convBox:7,
                wastePP:sd?sd.wastePP:5,convRatePP:sd?sd.convPP:12.5,
              }));
            }} style={{padding:"2px 4px",borderRadius:3,border:`1px solid ${C.border}`,
              fontSize:9,background:C.white,color:C.slate,cursor:"pointer",minWidth:0,width:90}}>
            <option value="">— select —</option>
            {sectorCodes.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          {/* Row 2: Plant | Delivery */}
          <span style={{fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"}}>Plant</span>
          <select value={batchProfile.plant||""} onChange={e=>{
              const nv=e.target.value;
              setBatchProfile(p=>{
                const newP={...p,plant:nv};
                const fr=freight?.[nv]?.[p.delivery];
                if(fr!==undefined) newP.freightOverride=fr;
                return newP;
              });
            }} style={{padding:"2px 4px",borderRadius:3,border:`1px solid ${C.border}`,
              fontSize:9,background:C.white,color:C.slate,cursor:"pointer",minWidth:0,width:90}}>
            <option value="">— select —</option>
            {PLANTS.map(o=><option key={o} value={o}>{o}</option>)}
          </select>
          <span style={{fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"}}>Delivery</span>
          <select value={batchProfile.delivery||""} onChange={e=>{
              const nv=e.target.value;
              setBatchProfile(p=>{
                const newP={...p,delivery:nv};
                const fr=freight?.[p.plant]?.[nv];
                if(fr!==undefined) newP.freightOverride=fr;
                return newP;
              });
            }} style={{padding:"2px 4px",borderRadius:3,border:`1px solid ${C.border}`,
              fontSize:9,background:C.white,color:C.slate,cursor:"pointer",minWidth:0,width:90}}>
            <option value="">— select —</option>
            {locations.map(o=><option key={o} value={o}>{o}</option>)}
          </select>
          {/* Row 3: Cust Type | Price Context */}
          <span style={{fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"}}>Cust Type</span>
          <select value={batchProfile.customerType||'existing'}
            onChange={e=>setBatchProfile(p=>({...p,customerType:e.target.value}))}
            style={{padding:"2px 4px",borderRadius:3,border:`1px solid ${C.border}`,
              fontSize:9,background:C.white,color:C.slate,cursor:"pointer",minWidth:0,width:90}}>
            <option value="existing">Existing</option>
            <option value="new">New</option>
            <option value="strategic">Strategic</option>
            <option value="spot">Spot</option>
          </select>
          <span style={{fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"}}>Price Ctx</span>
          <select value={batchProfile.priceContext||'unknown'}
            onChange={e=>setBatchProfile(p=>({...p,priceContext:e.target.value}))}
            style={{padding:"2px 4px",borderRadius:3,border:`1px solid ${C.border}`,
              fontSize:9,background:C.white,color:C.slate,cursor:"pointer",minWidth:0,width:90}}>
            <option value="unknown">Unknown</option>
            <option value="sensitive">Sensitive</option>
            <option value="premium">Premium</option>
            <option value="tender">Tender</option>
          </select>
        </div>
      </div>

      {/* ── 2. COMMERCIALS — header row + 2 data rows ── */}
      {(()=>{
        const sd=sectors.find(x=>x.code===batchProfile.sector);
        const defConvBox=sd?sd.convBox:7;
        const defConvPP=sd?sd.convPP:12.5;
        const defWstBox=sd?sd.wasteCBB:5;
        const defWstPP=sd?sd.wastePP:5;
        const isOvr=(key,def)=>{const v=batchProfile[key];return v!==undefined&&v!==null&&v!==''&&+v!==def;};
        const numField=(key,_w,def,step)=>{
          const ovr=isOvr(key,def);
          return<input type="number" step={step||0.25} value={batchProfile[key]??""}
            onChange={e=>{
              const raw=e.target.value;
              // Fix ②: blank on ANY numField (margin, waste, conv) must restore to sector default.
              // Previously only margin/marginPP were guarded — waste/conv went to 0 when cleared.
              if(raw===""||raw===null){setBatchProfile(p=>({...p,[key]:def}));return;}
              setBatchProfile(p=>({...p,[key]:+raw}));
            }}
            title={ovr?`Overriding sector default (${def})`:`Sector default: ${def}`}
            style={{width:"100%",padding:"2px 3px",borderRadius:3,textAlign:"center",
              boxSizing:"border-box",minWidth:0,
              border:`1px solid ${ovr?C.amber:C.border}`,
              background:ovr?"#FFF8ED":C.white,fontSize:10,color:C.slate}}/>;
        };
        const hdr={fontSize:8,fontWeight:700,color:C.slateL,textAlign:"center",textTransform:"uppercase",letterSpacing:"0.04em"};
        const lbl={fontSize:9,fontWeight:700,color:C.slateL,whiteSpace:"nowrap"};
        return(
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,
          padding:"4px 8px 4px 4px",display:"flex",flexDirection:"row",gap:6,alignItems:"stretch"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",width:14,flexShrink:0}}>
            <span style={{color:C.amber,fontWeight:700,fontSize:7.5,textTransform:"uppercase",
              letterSpacing:"0.12em",writingMode:"vertical-rl",transform:"rotate(180deg)",
              whiteSpace:"nowrap"}}>Commercials</span>
          </div>
          {/* Header + data rows grid — relative columns, 5px gap */}
          <div style={{display:"grid",gridTemplateColumns:"24px 1fr 1fr 1fr",
            columnGap:5,rowGap:2,alignItems:"center",minWidth:0}}>
            <div style={hdr}/>
            <div style={hdr}>Conv</div>
            <div style={hdr}>Wst%</div>
            <div style={hdr}>Mgn%</div>
            {/* Box row */}
            <div style={lbl}>Box</div>
            {numField("convRate",50,defConvBox)}
            {numField("waste",48,defWstBox)}
            {numField("margin",46,8)}
            {/* PP row */}
            <div style={lbl}>PP</div>
            {numField("convRatePP",50,defConvPP)}
            {numField("wastePP",48,defWstPP)}
            {numField("marginPP",46,8)}
          </div>
        </div>);
      })()}

      {/* ── 3. TERMS — Freight + Payment·Interest ── */}
      {(()=>{
        const _matrixFr=freight?.[batchProfile.plant]?.[batchProfile.delivery]??0;
        const _isOvr=batchProfile.freightOverride!==''&&batchProfile.freightOverride!==undefined;
        const _displayFr=_isOvr?batchProfile.freightOverride:_matrixFr;
        const DISC_MAP={"30":"0.5%","45":"0.75%","60":"1.0%","90":"1.5%"};
        const lbl={fontSize:9,fontWeight:700,color:C.slateL,whiteSpace:"nowrap"};
        return(
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,
          padding:"4px 8px 4px 4px",display:"flex",flexDirection:"row",gap:6,alignItems:"stretch"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",width:14,flexShrink:0}}>
            <span style={{color:C.amber,fontWeight:700,fontSize:7.5,textTransform:"uppercase",
              letterSpacing:"0.12em",writingMode:"vertical-rl",transform:"rotate(180deg)",
              whiteSpace:"nowrap"}}>Terms</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"auto 1fr",
            columnGap:8,rowGap:4,alignItems:"center"}}>
            {/* Freight */}
            <span style={lbl}>Freight</span>
            <div style={{display:"flex",alignItems:"center",gap:3}}>
              <input type="number" step="0.25" min="0" value={_displayFr}
                onChange={e=>{
                  const v=e.target.value;
                  const n=v===''?'':+v;
                  const isManual=v!==''&&+v!==_matrixFr;
                  setBatchProfile(p=>({...p,freightOverride:isManual?n:''}));
                }}
                style={{width:44,padding:"2px 4px",borderRadius:3,textAlign:"center",
                  border:`1px solid ${_isOvr?C.amber:C.border}`,
                  background:_isOvr?"#FFF8ED":C.white,fontSize:10,color:C.slate}}
                title={`Freight Rs/kg — matrix: ${_matrixFr}${_isOvr?" | OVERRIDDEN":""}`}/>
              <span style={{fontSize:8,color:C.slateL}}>Rs/kg</span>
            </div>
            {/* Payment Terms → Interest (linked) */}
            <span style={lbl} title="Payment Terms → auto-sets Interest %">PT · Int</span>
            <select value={batchProfile.paymentDisc||"30"}
              onChange={e=>{
                const m={"30":0.5,"45":0.75,"60":1.0,"90":1.5};
                setBatchProfile(p=>({...p,paymentDisc:e.target.value,interest:m[e.target.value]||1.5}));
              }}
              style={{padding:"2px 4px",borderRadius:3,border:`1px solid ${C.border}`,
                fontSize:9,background:C.white,color:C.slate,cursor:"pointer"}}
              title={`Interest auto-set: ${DISC_MAP[batchProfile.paymentDisc||"30"]}`}>
              <option value="30">≤30d · 0.5%</option>
              <option value="45">≤45d · 0.75%</option>
              <option value="60">≤60d · 1.0%</option>
              <option value="90">≤90d · 1.5%</option>
            </select>
          </div>
        </div>);
      })()}

      {/* ── 4. ACTIONS — Import + New Batch ── */}
      <div style={{display:"flex",flexDirection:"column",gap:4,
        justifyContent:"center",marginLeft:"auto",flexShrink:0}}>
        <div style={{border:`1px solid ${C.border}`,borderRadius:6,
          padding:"4px 7px",background:C.white}}>
          <div style={{fontSize:7.5,color:C.slateL,fontWeight:700,textTransform:"uppercase",
            letterSpacing:"0.06em",textAlign:"center",marginBottom:3}}>Import from Costing</div>
          <div style={{display:"flex",gap:4}}>
            <button onClick={copyCostingToProfile}
              style={{flex:1,padding:"4px 0",borderRadius:4,border:"none",
                background:"#2E6094",color:C.white,fontSize:10,fontWeight:600,cursor:"pointer"}}>
              ↓ Profile
            </button>
            <button onClick={importConstrFromSpec}
              style={{flex:1,padding:"4px 0",borderRadius:4,border:"none",
                background:C.amber,color:C.white,fontSize:10,fontWeight:600,cursor:"pointer"}}>
              + Constr
            </button>
          </div>
        </div>
        <button onClick={startNewBatch}
          style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${C.amber}`,
          background:C.white,color:C.amber,fontSize:10,fontWeight:700,cursor:"pointer",
          textAlign:"center"}}>
          + New Batch
        </button>
      </div>

    </div>
  );
}
