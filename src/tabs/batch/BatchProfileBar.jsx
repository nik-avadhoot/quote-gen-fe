// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/batch/BatchProfileBar.jsx — the Batch Entry header card.
//
// Extracted from QuotationApp.jsx (Phase 7b). Structural move only.
//
// Three sections: Customer Details, Commercials (including Terms), Actions.
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
import { normalizeFreightOverrideInput, resolveField, resolveInterest } from "../../engine/resolveAuthority.js";
import { C } from "../../theme.js";
import { useAppState } from "../../state/AppStateContext.js";
import { useFeatureFlag } from "../../lib/featureFlags.js";
import BatchClientField from "./BatchClientField.jsx";

export default function BatchProfileBar({ pricingCard = null }){
  const {batchAgeLabel,batchProfile,copyCostingToProfile,freight,importConstrFromSpec,locations,
    sectorCodes,sectors,setBatchProfile,showToast,startNewBatch}=useAppState();

  // ── U1 Slice D — Client is a GOVERNED SELECTION, not free text ───────────
  // Product Owner ruling, 2026-09-08. The whole control moved into
  // BatchClientField.jsx: a searchable Customer/Prospect Master dropdown for
  // callers holding read_party_master, an explicit governed create for text
  // that matches nothing, and a duplicate check before any create.
  //
  // Flag-gated and default-off. The flag makes the control MOUNTABLE; it
  // grants nothing — the caller still needs read_party_master to browse and
  // manage_customer_master or make_quote to create, both decided by the
  // backend and RLS. With the flag off, the plain input below is unchanged.
  //
  // What reaches Batch state is still ONE string in `client`, the temporary
  // U1 representation of that selection — not a foreign key. No partyId, no
  // link object, no new Batch or localStorage field; U4 owns the durable
  // Batch identity relationship.
  //
  // `delivery` is NOT part of any of this. It is the freight-destination
  // master key that resolves freight[plant][delivery] a few lines below, and
  // this slice leaves its options, its onChange and its rate behaviour
  // exactly as they were.
  const clientFieldEnabled=useFeatureFlag("u1_batch_party_link");

  return(
    <div className="batch-profile-bar" style={{background:"#FEF8F0",borderBottom:`2px solid ${C.amber}`,
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
          {clientFieldEnabled
            ?<BatchClientField batchProfile={batchProfile} setBatchProfile={setBatchProfile}
               showToast={showToast}/>
            :<input value={batchProfile.client||""} onChange={e=>setBatchProfile(p=>({...p,client:e.target.value}))}
               style={{padding:"2px 6px",borderRadius:3,border:`1px solid ${C.border}`,
                 fontSize:10,background:C.white,color:C.slate,width:90,minWidth:0}}/>}
          <span style={{fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"}}>Sector</span>
          <select value={batchProfile.sector||""} onChange={e=>{
              // S7(c) SITE 1. Choosing a Sector used to stamp its four numbers into
              // the profile as literals. That made every one of them look like a
              // deliberate override and froze the Batch to the Sector as it stood
              // that day. The Sector is a RESOLUTION TIER now: the profile keeps its
              // blanks, the resolver reads through them, and changing Sector moves
              // the effective values immediately without any stored value moving.
              setBatchProfile(p=>({...p,sector:e.target.value}));
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
                // S8 producer-side. This used to write the new route's matrix
                // rate into freightOverride, so choosing a PLANT manufactured a
                // Batch freight override nobody asked for - the materialisation
                // pattern S7 removed at five sites (proposal 10.3); freight was
                // not among the five and survived. A deliberate override is now
                // PRESERVED across a route change: it stays visibly overridden,
                // and clearing the field is the one action that inherits.
                const newP={...p,plant:nv};
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
                // S8 producer-side, same defect on the DELIVERY axis. See the
                // Plant handler above.
                const newP={...p,delivery:nv};
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

      {/* ── 2. COMMERCIALS — rates + aligned Terms row ── */}
      {(()=>{
        const sd=sectors.find(x=>x.code===batchProfile.sector);
        // S7(c). The greyed number a Maker sees is what the RESOLVER answers with
        // the profile's own value taken out - so it is the number the CalcGate will
        // actually use, not a literal restated here. With a Sector selected these
        // are its values; with none, the versioned system fallbacks. Same numbers as
        // before, one authority instead of five.
        const inh=(field,isPP)=>resolveField(field,{rowOverride:'',batchProfile:{},sector:sd,isPP}).value;
        const defConvBox=inh('convRate',false);
        const defConvPP =inh('convRate',true);
        const defWstBox =inh('waste',false);
        const defWstPP  =inh('waste',true);
        const defMgnBox =inh('margin',false);
        const defMgnPP  =inh('margin',true);
        // An override is now ANY stored value, not just one that differs from the
        // inherited number. A value equal to the Sector's is still a value someone
        // typed and still survives a Sector change, so showing it as "inherited"
        // would be a lie - and a Maker who cannot see that would not know clearing
        // the field changes the price. Blank is grey, stored is amber (CDM-19).
        const isOvr=(key)=>{const v=batchProfile[key];return v!==undefined&&v!==null&&v!=='';};
        const numField=(key,_w,def,step)=>{
          const ovr=isOvr(key);
          return<input type="number" step={step||0.25} value={batchProfile[key]??""}
            onChange={e=>{
              const raw=e.target.value;
              // S7(c) SITE 2, and the one that matters most. Clearing a field is the
              // ONLY gesture a Maker has for "inherit", and it used to write the
              // sector default into the profile - manufacturing the override the
              // user was trying to remove. It now stores null, and the resolver
              // answers. An explicit 0 is still a 0 and is still stored.
              if(raw===""||raw===null){setBatchProfile(p=>({...p,[key]:null}));return;}
              setBatchProfile(p=>({...p,[key]:+raw}));
            }}
            placeholder={def==null?"":String(def)}
            title={ovr?`Override — stored on this Batch. Clear it to inherit ${def}`
                      :`Inherited: ${def}. Nothing is stored on this Batch for this field`}
            style={{width:"100%",padding:"2px 3px",borderRadius:3,textAlign:"center",
              boxSizing:"border-box",minWidth:0,
              border:`1px solid ${ovr?C.amber:C.border}`,
              background:ovr?"#FFF8ED":C.white,fontSize:10,color:C.slate}}/>;
        };
        // TERMS remains a separate commercial authority area, but now shares the
        // Commercials card. Its three fields align with the three value columns
        // without inheriting the Conv/Wst/Mgn header meanings.
        // An absent plant × destination lane remains unavailable, while an explicit
        // zero remains a real governed rate. Stored overrides are detected by
        // presence, not by comparison with today's matrix value.
        const _mxRaw=freight?.[batchProfile.plant]?.[batchProfile.delivery];
        const _mxAvail=_mxRaw!==undefined&&_mxRaw!==null&&_mxRaw!=='';
        const _isFrOvr=batchProfile.freightOverride!==''&&batchProfile.freightOverride!==undefined;
        const _displayFr=_isFrOvr?batchProfile.freightOverride:(_mxAvail?_mxRaw:'');
        // Customer interest is independently resolved from payment terms and the
        // annual-interest policy. Changing PT must not discard an explicit override.
        const _int=resolveInterest({pricingGroup:{
          paymentTermsDays:batchProfile.paymentDisc,
          interestOverridePct:batchProfile.interest}});
        const _intOvr=_int.source==="pricing_group";
        const hdr={fontSize:8,lineHeight:1,fontWeight:700,color:C.slateL,
          textAlign:"center",textTransform:"uppercase",letterSpacing:"0.04em"};
        const lbl={fontSize:9,fontWeight:700,color:C.slateL,whiteSpace:"nowrap"};
        const termHdr={fontSize:6.25,lineHeight:1,fontWeight:700,color:C.slateL,
          textAlign:"center",whiteSpace:"nowrap"};
        return(
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,
          padding:"4px 8px 4px 4px",display:"flex",flexDirection:"row",gap:6,alignItems:"stretch"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",width:14,flexShrink:0}}>
            <span style={{color:C.amber,fontWeight:700,fontSize:7.5,textTransform:"uppercase",
              letterSpacing:"0.12em",writingMode:"vertical-rl",transform:"rotate(180deg)",
              whiteSpace:"nowrap"}}>Commercials</span>
          </div>
          {/* Header + data rows grid. The three data columns are PINNED at 52px,
              matching Costing's Batch Context bar (BatchContextBar.jsx:161) so the
              same three fields are the same size in both places. They were 1fr,
              which let them absorb the bar's free space and rendered a two-digit
              percentage in a field several times wider than its content - the
              numField width arguments below (50/48/46) were written for the
              intended size and never applied, because the input is width:100%. */}
          <div style={{display:"grid",gridTemplateColumns:"24px 52px 52px 52px",
            // The 17px controls previously sat in equal ~29px tracks: their visible
            // edge gap was about 12px. Two 23px tracks leave 6px (half that gap),
            // while the flexible final track receives the recovered height.
            gridTemplateRows:"8px 23px 23px minmax(0, 1fr)",height:"100%",
            columnGap:5,rowGap:0,alignItems:"center",minWidth:0}}>
            <div style={hdr}/>
            <div style={hdr}>Conv</div>
            <div style={hdr}>Wst%</div>
            <div style={hdr}>Mgn%</div>
            {/* Box row */}
            <div style={lbl}>Box</div>
            {numField("convRate",50,defConvBox)}
            {numField("waste",48,defWstBox)}
            {numField("margin",46,defMgnBox)}
            {/* PP row */}
            <div style={lbl}>PP</div>
            {numField("convRatePP",50,defConvPP)}
            {numField("wastePP",48,defWstPP)}
            {numField("marginPP",46,defMgnPP)}

            {/* Independently bordered third row. It starts at column 2 so each
                field aligns with a value column while its own label—not the
                Conv/Wst/Mgn header—states its commercial meaning. */}
            <div style={{gridColumn:"2 / -1",display:"grid",
              gridTemplateColumns:"52px 52px 52px",columnGap:5,alignItems:"end",
              alignSelf:"stretch",alignContent:"end",
              border:`1px solid ${C.border}`,borderRadius:4,padding:"2px 0 1px",marginTop:0}}>
              <label style={{display:"grid",gap:3,minWidth:0}}>
                <span style={termHdr}>Freight Rs/kg</span>
                <input type="number" step="0.25" min="0" value={_displayFr}
                  aria-label="Freight Rs/kg"
                  onChange={e=>setBatchProfile(p=>({...p,
                    freightOverride:normalizeFreightOverrideInput(e.target.value)}))}
                  style={{boxSizing:"border-box",width:"100%",height:17,minWidth:0,padding:"0 2px",
                    borderRadius:3,textAlign:"center",border:`1px solid ${_isFrOvr?C.amber:C.border}`,
                    background:_isFrOvr?"#FFF8ED":C.white,fontSize:9,color:C.slate}}
                  title={`Freight Rs/kg — ${_mxAvail?`matrix: ${_mxRaw}`:"matrix rate unavailable"}`
                    +`${_isFrOvr?" | OVERRIDDEN":""}`}/>
              </label>

              <label style={{display:"grid",gap:3,minWidth:0}}>
                <span style={termHdr} title="Payment Terms derives customer interest">PT</span>
                {/* Payment Terms is the input; interest remains a resolved output. */}
                <select value={batchProfile.paymentDisc||"30"}
                  aria-label="Payment terms"
                  onChange={e=>setBatchProfile(p=>({...p,paymentDisc:e.target.value}))}
                  style={{boxSizing:"border-box",width:"100%",height:17,minWidth:0,padding:"0 2px",
                    borderRadius:3,border:`1px solid ${C.border}`,fontSize:8.5,
                    background:C.white,color:C.slate,cursor:"pointer"}}
                  title={_intOvr
                    ? `Customer interest ${_int.value}% — OVERRIDE stored on this Batch. `
                      + `Clear it to derive from ${_int.annualInterestPct}% p.a. / ${_int.dayCountBasis}`
                    : `Customer interest ${_int.value}% — derived from the approved `
                      + `${_int.annualInterestPct}% p.a. on a ${_int.dayCountBasis}-day year`}>
                  <option value="30">≤30d</option>
                  <option value="45">≤45d</option>
                  <option value="60">≤60d</option>
                  <option value="90">≤90d</option>
                </select>
              </label>

              <div style={{display:"grid",gap:3,minWidth:0}}>
                <span style={termHdr}>Interest</span>
                <output aria-label="Customer interest"
                  title={_intOvr?"Customer interest override stored on this Batch":"Customer interest derived from governed annual-interest policy"}
                  style={{boxSizing:"border-box",display:"flex",alignItems:"center",justifyContent:"center",
                    height:17,minWidth:0,padding:"0 2px",borderRadius:3,
                    border:`1px solid ${_intOvr?C.amber:C.border}`,textAlign:"center",
                    background:_intOvr?"#FFF8ED":C.white,fontSize:7.5,fontWeight:700,
                    color:_intOvr?C.amberD:C.slateL,whiteSpace:"nowrap",overflow:"hidden"}}>
                  {_int.value}% · {_intOvr?"ovr":"der."}
                </output>
              </div>
            </div>
          </div>
        </div>);
      })()}

      {pricingCard&&<div className="batch-profile-pricing-card">{pricingCard}</div>}

      {/* ── 3. ACTIONS — Import + New Batch ── */}
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
