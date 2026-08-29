// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/QuoteItemsTab.jsx — the finalised quote: SET-grouped items + export.
//
// Extracted from QuotationApp.jsx (Phase 6e). Last of the leaf tabs.
//
// Deliberate cross-domain reads, do NOT "clean up" — these are documented fixes:
//   * batchProfile.marginPP  → passed to exportFromTemplate in the export meta
//   * batchProfile.paymentDisc → passed to exportAllPDF for the terms block
// A quote tab reading the batch profile looks like a smell and is the fix.
//
// ⚠️ THE DRAFTS BUTTON NEVER RENDERS TODAY, and that is not dead UI to delete.
// It is gated on Object.keys(savedQuotes).length>0, and the only writer of
// savedQuotes is addItem, which has zero call sites since finalisation moved
// into Batch Entry. savedQuotes is therefore permanently {}. Retained per the
// Phase 2 decision: it is a re-wirable path, not a dead one.
//
// ⚠️ THE RE-IMPORT BLOCK IS A JSX COMMENT, retained on purpose (Fix 12: the
// column mapping is wrong and produces confidently wrong items). Because it is
// commented out, importRef and handleImport are NOT destructured below — they
// would be unused bindings. Re-enabling the block means pulling both from
// useAppState() again; they still exist in the store.
//
// Export wiring crosses two Phase 3 modules: exportFromTemplate from
// export/excel.js and exportAllPDF from export/pdf.js.
// ═══════════════════════════════════════════════════════════════════════════
import { exportFromTemplate } from "../export/excel.js";
import { exportAllPDF } from "../export/pdf.js";
import { Btn } from "../ui/primitives.jsx";
import { normSetCode, sameSetCode, isPPType } from "../engine/rowType.js";
import { findDivergence } from "../lib/overrideDivergence.js";
import { useAppState } from "../state/AppStateContext.js";
import { C, mono } from "../theme.js";

export default function QuoteItemsTab(){
  const {
    showToast, items, setItems, savedQuotes, setSavedQuotes,
    quoteRef, setQuoteRef, quoteDate, setQuoteDate,
    effectiveFrom, setEffectiveFrom, effectiveTo, setEffectiveTo,
    makerName, templateLoaded, templateB64, templateRef, handleTemplateLoad,
    rates, freight, batchProfile, loadItem, removeItem, setTab,
  } = useAppState();

  return(
    <div style={{padding:20,overflowY:"auto",height:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:C.slate}}>Quote Items</div>
          <div style={{fontSize:11,color:C.slateL}}>{items.length} item{items.length!==1?"s":""} in this session</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",
        background:templateLoaded?"#EBF7F1":"#FFF8ED",borderRadius:7,marginBottom:12,
        border:`1px solid ${templateLoaded?"#2A7550":"#D97B2E"}44`}}>
        <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",
          padding:"7px 14px",borderRadius:6,fontSize:12,fontWeight:700,flexShrink:0,
          background:templateLoaded?"#2A7550":"#D97B2E",color:"white"}}>
          {templateLoaded?"✅ Template Loaded":"📂 Load Master Template (.xlsx)"}
          <input ref={templateRef} type="file" accept=".xlsx" style={{display:"none"}}
            onChange={handleTemplateLoad}/>
        </label>
        <div style={{fontSize:11,color:templateLoaded?"#2A7550":"#B5641F",lineHeight:1.4}}>
          {templateLoaded
            ?"Exports will use your master format — all formulas, formatting and sheet structure preserved. Click to replace."
            :"Upload CFB_Quotation_Master_v6_1.xlsx once. All exports will retain exact formulas, formatting and cross-sheet references."}
        </div>
      </div>

      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {/* Quote Reference + Maker + Dates */}
          <div style={{display:"flex",gap:6,alignItems:"center",padding:"5px 10px",
            background:C.cream,border:`1px solid ${C.border}`,borderRadius:6,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase"}}>Quote Ref</div>
              <input value={quoteRef} onChange={e=>setQuoteRef(e.target.value)}
                style={{border:"none",background:"transparent",fontWeight:700,fontFamily:mono,
                  fontSize:12,color:C.slate,width:120}}/>
            </div>
            <div style={{width:1,height:16,background:C.border}}/>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase"}}>Maker</div>
              <span style={{fontSize:11,color:C.slateM,width:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{makerName}</span>
            </div>
            <div style={{width:1,height:16,background:C.border}}/>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"3px 8px",borderRadius:5,
              background:C.cream,border:`1px solid ${C.border}`}}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase"}}>Quoted</div>
              <input type="date" value={quoteDate} onChange={e=>setQuoteDate(e.target.value)}
                style={{border:"none",background:"transparent",fontSize:11,color:C.slate,fontFamily:mono,cursor:"pointer",width:110}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"3px 8px",borderRadius:5,
              background:(effectiveFrom||effectiveTo)?"#EBF7F1":C.cream,
              border:`1px solid ${effectiveFrom||effectiveTo?C.green:C.border}`}}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",whiteSpace:"nowrap"}}>
                Price Valid</div>
              <input type="date" value={effectiveFrom} onChange={e=>setEffectiveFrom(e.target.value)}
                style={{border:"none",background:"transparent",fontSize:11,color:C.slate,fontFamily:mono,cursor:"pointer",width:110}}
                title="Effective From"/>
              <span style={{fontSize:10,color:C.slateL}}>—</span>
              <input type="date" value={effectiveTo} onChange={e=>setEffectiveTo(e.target.value)}
                style={{border:"none",background:"transparent",fontSize:11,color:C.slate,fontFamily:mono,cursor:"pointer",width:110}}
                title="Effective To"/>
            </div>
          </div>
          {items.length>0&&(()=>{
            const canExport=quoteRef.trim()&&makerName.trim();
            const exportTip=!quoteRef.trim()?"Quote Ref is required before export":!makerName.trim()?"Your account has no display name set — contact an Admin":"";
            // Fix 11: Capacity limits — v7 template supports max 44 CBB data rows and 30 OFFER rows
            const CBB_MAX=44;
            const OFFER_MAX=30;
            // Fix ③: offerCount corrected — server.py writes ALL items (Box + Plate + Part) sequentially
            // into CBB rows 7…7+len−1, regardless of type. The prior Box-only filter was wrong:
            // 20 Box + 20 Plate = 40 total rows, cbbCount=40 ≤ 44 ✓, but OFFER only mirrors rows 7–36 (30 rows).
            // The correct check is simply items.length for both sheets.
            const cbbCount=items.length;
            const offerCount=items.length; // same limit — server writes all types into the same row band
            const capacityOk=cbbCount<=CBB_MAX&&offerCount<=OFFER_MAX;
            const capacityMsg=cbbCount>CBB_MAX
              ?`❌ Too many items: ${cbbCount} rows exceed the template capacity of ${CBB_MAX} CBB rows. Split the quote into multiple exports.`
              :offerCount>OFFER_MAX
              ?`❌ Too many Box items: ${offerCount} Box rows exceed the OFFER sheet capacity of ${OFFER_MAX}. Split the quote.`
              :"";
            // B3: SET completeness check — warn if any SET has a Box but no Plate/Partition
            // ── D-28: warn when rows that share ONE export slot disagree ────────────────
  // The field warning in BatchGrid catches the Maker who typed the value. This
  // catches the one who did NOT — someone else's override, or their own from
  // yesterday. Different people, different moments, and the export is where the
  // mismatch becomes real.
  //
  // Computed on `items`, not batchRows: this is the actual payload, so it is what
  // the workbook will receive. Same comparison as the grid, via the shared module.
  //
  // Does NOT block the export. It is a warning, not a gate — the product position
  // is that the app design stays and the workbook is correct.
  const warnDivergence=()=>{
    const ent=(group,value)=>({group,value});
    const rows=items.map((it,i)=>({it,label:String(i+1),isPP:isPPType(it.spec?.rowType)}));
    const checks=[
      ["Waste%",     findDivergence(rows.map(r=>({label:r.label,...ent(r.isPP?"PP":"Box",r.isPP?r.it.spec?.wastePP:r.it.spec?.waste)})))],
      ["Conv Rs/kg", findDivergence(rows.map(r=>({label:r.label,...ent(r.isPP?"PP":"Box",r.isPP?r.it.spec?.convRatePP:r.it.spec?.convRate)})))],
      ["Interest%",  findDivergence(rows.map(r=>({label:r.label,...ent("",r.it.spec?.interest)})))],
      ["Freight Rs/kg",findDivergence(rows.map(r=>({label:r.label,...ent("",r.it.spec?.freightOverride)})))],
    ].filter(([,d])=>d.length>0);
    if(!checks.length)return;
    const parts=checks.map(([label,ds])=>ds.map(d=>
      `${label}${d.group?` (${d.group})`:""}: rows ${d.labels.join(", ")} disagree (${d.values.join(", ")})`
    ).join(" · ")).join(" · ");
    showToast(
      `\u26A0 ${checks.length} value${checks.length===1?"":"s"} will not export as entered — ${parts}. `
      +`The workbook holds one value per slot; the others will not reach the quote.`,
      'error',12000);
  };

  const checkSETCompleteness=()=>{
              // D-7: normalise. Case-split SET codes made this gate see one SET as two —
              // a Box under "Glass180" and its Part under "GLASS180" reported the Box's
              // SET as incomplete when the Part existed all along. A FALSE WARNING on
              // the export path, not a display quirk. :181 in this same file already
              // grouped case-insensitively, so the file disagreed with itself.
              const setCodes=[...new Set(items.filter(i=>i.spec?.setCode&&i.spec.setCode.trim()).map(i=>normSetCode(i.spec.setCode)))];
              const incomplete=setCodes.filter(sc=>{
                const inSet=items.filter(i=>sameSetCode(i.spec?.setCode,sc));
                const hasBox=inSet.some(i=>(i.spec?.rowType||'Box')==='Box');
                const hasPP=inSet.some(i=>['Plate','Part-L','Part-W'].includes(i.spec?.rowType||''));
                return hasBox&&!hasPP;
              });
              if(incomplete.length>0){
                return window.confirm(`⚠ SET completeness warning:\n\nThe following SET codes have a Box row but no Plate or Partition rows:\n${incomplete.join(', ')}\n\nExport anyway?`);
              }
              return true;
            };
            return(<>
              {!capacityOk&&<div style={{padding:"6px 12px",background:C.redL,border:`1px solid ${C.red}44`,
                borderRadius:5,fontSize:11,color:C.red,fontWeight:600,marginBottom:4}}>
                {capacityMsg}
              </div>}
              <div title={capacityOk?exportTip:capacityMsg} style={{display:"inline-block"}}>
                <Btn ch={templateLoaded?"↓ Export (Master Format)":"↓ Export All to Excel"}
                  v="success"
                  disabled={!canExport||!capacityOk}
                  onClick={()=>{if(checkSETCompleteness()){warnDivergence();exportFromTemplate(items,rates,freight,templateB64,{quoteRef,makerName,quoteDate,effectiveFrom,effectiveTo,marginPP:batchProfile.marginPP??8},msg=>showToast(msg,'error',8000));}}}
                  style={(!canExport||!capacityOk)?{opacity:0.45,cursor:"not-allowed"}:{}}/>
              </div>
              <div title={capacityOk?exportTip:capacityMsg} style={{display:"inline-block"}}>
                <Btn ch="↓ PDF (All SKUs)" v="info"
                  disabled={!canExport}
                  onClick={()=>{if(checkSETCompleteness())exportAllPDF(items,{quoteRef,makerName,paymentDisc:batchProfile.paymentDisc||"30",effectiveTo});}}
                  style={!canExport?{opacity:0.45,cursor:"not-allowed"}:{}}/>
              </div>
              {!canExport&&<span style={{fontSize:10,color:C.red,fontWeight:600}}>{exportTip}</span>}
            </>);
          })()}

          {/* Fix 12: Re-import Excel button removed — the parseImportedExcel function reads
              wrong columns throughout (margin from Total Cost column etc.) and produces
              confidently wrong items. Disabled pre-beta; re-enable after column mapping is fixed.
          <label style={{padding:"8px 16px",borderRadius:6,fontSize:13,fontWeight:600,
            cursor:"pointer",background:C.white,color:C.slateM,border:`1px solid ${C.border}`}}>
            ↑ Re-import Excel
            <input ref={importRef} type="file" accept=".xlsx,.xls" style={{display:"none"}}
              onChange={handleImport}/>
          </label> */}
          {items.length>0&&<Btn ch="Clear All" v="danger" sm onClick={()=>{
            if(window.confirm("Clear all items? They will be lost unless exported."))setItems([]);}}/>}
          {Object.keys(savedQuotes).length>0&&<Btn ch={`📁 Drafts (${Object.keys(savedQuotes).length})`}
            v="secondary" sm onClick={()=>{
              const names=Object.keys(savedQuotes).join(", ");
              const pick=window.prompt(`Saved drafts: ${names}\n\nType client name to restore:`);
              if(pick&&savedQuotes[pick]){setItems(savedQuotes[pick].items);
                setSavedQuotes(prev=>{const n={...prev};delete n[pick];return n;});}}}/>}
        </div>
      </div>
      {items.length===0&&<div style={{textAlign:"center",color:C.slateL,marginTop:60,fontSize:13}}>
        No items yet. Add rows in <button onClick={()=>setTab("batch")} style={{background:"none",border:"none",color:C.amber,fontWeight:700,cursor:"pointer",fontSize:13,textDecoration:"underline"}}>Batch Entry</button>, calculate, then click "Send All to Quote Items".
      </div>}
      {items.length>0&&<>
      {(()=>{
        const setMap={};const standalone=[];
        items.forEach(item=>{
          const sc=(item.spec.setCode||"").trim().toUpperCase();
          if(sc){if(!setMap[sc])setMap[sc]=[];setMap[sc].push(item);}else standalone.push(item);
        });
        const IRw=({item,bg})=>{const{spec:is,result:ir}=item;return(
          <tr key={item.id} style={{background:bg,cursor:"pointer"}} onClick={()=>loadItem(item)}>
            <td style={{padding:"5px 10px"}}>
              {is.setCode&&<span style={{fontSize:9,background:C.amber,color:C.white,padding:"1px 5px",borderRadius:3,marginRight:4}}>{is.setCode}</span>}
              {is.rowType!=="Box"&&<span style={{fontSize:9,color:C.slateL,marginRight:3}}>({is.rowType})</span>}
              <span style={{fontFamily:mono,fontSize:11}}>{is.material_code||"—"}</span>
            </td>
            <td style={{padding:"5px 10px",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{is.product||"—"}</td>
            <td style={{padding:"5px 10px",fontFamily:mono,fontSize:11}}>{is.L&&is.W?`${is.L}×${is.W}${is.H?"×"+is.H:""}`:""}</td>
            <td style={{padding:"5px 10px"}}>{is.ply}p {is.flute_F1||"—"}{(+is.ply===5&&is.flute_F2)?"/"+is.flute_F2:""}</td>
            <td style={{padding:"5px 10px",fontFamily:mono}}>{is.spec_bs||"—"}</td>
            <td style={{padding:"5px 10px",fontFamily:mono,color:ir&&is.spec_bs?Math.abs(ir.calcBS-+is.spec_bs)/+is.spec_bs>0.05?C.orange:C.green:C.slateL}}>{ir?.calcBS||"—"}</td>
            <td style={{padding:"5px 10px",textAlign:"center",fontFamily:mono,color:C.slateL,fontSize:11}}>{ir?(ir.wtSheet*1000).toFixed(0)+"g":"—"}</td>
            <td style={{padding:"5px 10px",textAlign:"center",fontWeight:800,color:C.amber,fontFamily:mono}}>
              {ir?`₹${ir.finalRate.toFixed(2)}`:"—"}
              {ir&&(+is.qtyPerSet||1)>1&&<div style={{fontSize:9,color:C.slateL,fontWeight:400,marginTop:1}}>
                ×{is.qtyPerSet} = ₹{(ir.finalRate*(+is.qtyPerSet||1)).toFixed(2)}
              </div>}
            </td>
            <td style={{padding:"5px 10px",textAlign:"center",fontFamily:mono,fontSize:11}}>{ir?ir.calcMOQ.toLocaleString():"—"}</td>
            <td style={{padding:"4px 4px"}} onClick={e=>{e.stopPropagation();removeItem(item.id);}}>
              <button style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:16}}>×</button>
            </td>
          </tr>);};
        return<div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:860}}>
            <thead><tr style={{background:C.slateM}}>
              {["Mat Code / Type","SKU","Dims","Construction","Std BS","Calc BS","Sheet Wt","Final Rate","MOQ",""].map(h=>(
                <th key={h} style={{padding:"7px 10px",color:C.white,fontSize:10,fontWeight:600,
                  textAlign:["Final Rate","MOQ","Sheet Wt"].includes(h)?"center":"left"}}>{h}</th>))}
            </tr></thead>
            <tbody>
              {standalone.map((item,i)=><IRw key={item.id} item={item} bg={i%2?C.cream:C.white}/>)}
              {Object.entries(setMap).map(([sc,si])=>[
                <tr key={sc+"-h"} style={{background:C.slateM}}>
                  <td colSpan={10} style={{padding:"5px 10px",color:C.amber,fontWeight:700,fontSize:11}}>
                    📦 SET: {sc} &nbsp;·&nbsp; {si.length} item{si.length>1?"s":""} &nbsp;·&nbsp;
                    <span style={{fontFamily:mono}}>SET Rate: ₹{si.filter(i=>i.result).reduce((s,i)=>s+i.result.finalRate*(+i.spec.qtyPerSet||1),0).toFixed(2)}/set</span>
                  </td>
                </tr>,
                ...si.map((item,i)=><IRw key={item.id} item={item} bg={i%2?"#F5F0EC":C.cream}/>),
                <tr key={sc+"-f"} style={{background:"#EBE3D8"}}>
                  <td colSpan={7} style={{padding:"4px 10px",fontSize:10,fontWeight:600,color:C.slateM}}>
                    SET {sc} total ({si.filter(i=>i.result).length} items costed)</td>
                  <td style={{padding:"4px 10px",textAlign:"center",fontWeight:800,color:C.amberD,fontFamily:mono}}>
                    ₹{si.filter(i=>i.result).reduce((s,i)=>s+i.result.finalRate*(+i.spec.qtyPerSet||1),0).toFixed(2)}</td>
                  <td colSpan={2}/>
                </tr>
              ])}
            </tbody>
          </table>
        </div>;
      })()}
        <div style={{marginTop:10,fontSize:11,color:C.slateL,padding:"8px 12px",
          background:C.cream,borderRadius:6}}>
          Click any row to load it into the Costing tab for deep-dive analysis.
          To revise a rate, go to Batch Entry → adjust → Calculate All → Send All to Quote Items again.
          Re-import: export to Excel, make manual revisions, then use "Re-import Excel" to bring back revised items.
        </div>
      </>}
    </div>
  );
}
