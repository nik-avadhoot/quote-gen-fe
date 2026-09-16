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
// ⚠️ C4: A QUOTE ITEM ROW NO LONGER LOADS INTO COSTING. Batch Entry is the sole
// CalcGate — a calculation change becomes quotable only through a Batch row,
// Calculate All and Send All — so Quote Items is a staging surface, never an
// editing one. The row click now says so and navigates; it writes nothing, and
// it does NOT try to identify the originating Batch row, because no Quote Item
// carries one and every available match (Material Code, Product, SET Code, row
// type, position) is a guess. Do not add one here.
//
// Export wiring crosses two Phase 3 modules: exportFromTemplate from
// export/excel.js and exportAllPDF from export/pdf.js.
//
// ── SCREEN SPACE ──────────────────────────────────────────────────────────
// This is the "Working" view of the Quotes screen, on the shared standard:
// the TopBar names the screen, so there is no page header; QuotesWorkspace
// passes its view switch in as `toolbarLead`, so the view switch, Quote Ref and
// export share ONE toolbar; the quote dates, Maker and template loader sit in a
// Details disclosure; rows are 26px with the Material Code frozen, and the
// per-set amount has its own column instead of a second line; each SET is ONE
// group row carrying its item count, costed count and SET rate. These items are
// LOCAL browser state, never a governed revision — the Local tag on the view
// switch and in the footer is what says so, and it must survive any rework.
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment } from "react";
import { exportFromTemplate } from "../export/excel.js";
import { exportAllPDF } from "../export/pdf.js";
import { normSetCode, sameSetCode, isPPType } from "../engine/rowType.js";
import { findDivergence } from "../lib/overrideDivergence.js";
import { useAppState } from "../state/AppStateContext.js";
import { ProvenanceTag } from "../ui/dataDisplay.jsx";
import { PanelFocusToggle, ScreenFooter, ToolbarLabel } from "../ui/screenChrome.jsx";
import {
  control, denseCell, denseHead, denseTable, frozenCell, menuPanel, menuSummary, toolbar, usePanelFocus,
} from "../ui/screenStandards.js";
import { C, T, mono, sans } from "../theme.js";

const QI_READONLY_MSG="Quote Items are read-only. Review or revise the calculation in Batch Entry using Deep Dive.";

// Fix 11: Capacity limits — v7 template supports max 44 CBB data rows and 30 OFFER rows
const CBB_MAX=44;
const OFFER_MAX=30;

const COLUMNS = [
  ["SKU"], ["Dims"], ["Construction"], ["Std BS", "right"], ["Calc BS", "right"], ["Sheet Wt", "right"],
  ["Final Rate", "right"], ["Per set", "right"], ["MOQ", "right"],
];

const actionButton = (tone, disabled) => ({
  ...control, fontWeight: 700, whiteSpace: "nowrap", cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.45 : 1,
  ...(tone === "success" ? { background: C.green, borderColor: C.green, color: C.white }
    : tone === "info" ? { background: "#2E6094", borderColor: "#2E6094", color: C.white }
      : tone === "danger" ? { color: C.red, borderColor: `${C.red}66` } : {}),
});

const fieldLabel = { display: "grid", gap: 3, fontSize: T.label, color: C.slateL, fontWeight: 700 };

function ItemRow({ item, background, onOpen, onRemove }) {
  const { spec: is, result: ir } = item;
  const perSet = +is.qtyPerSet || 1;
  const bsOff = ir && is.spec_bs ? Math.abs(ir.calcBS - +is.spec_bs) / +is.spec_bs > 0.05 : null;
  return (
    <tr style={{ height: 26, background, cursor: "pointer" }} title={QI_READONLY_MSG} onClick={onOpen}>
      <td style={{ ...frozenCell(false), background }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {is.setCode && <span style={{ fontSize: T.micro, fontWeight: 700, lineHeight: 1.4, background: C.amber,
            color: C.white, padding: "0 5px", borderRadius: 3 }}>{is.setCode}</span>}
          {is.rowType !== "Box" && <span style={{ fontSize: T.label, color: C.slateL }}>({is.rowType})</span>}
          <span style={{ fontFamily: mono }}>{is.material_code || "—"}</span>
        </span>
      </td>
      <td style={{ ...denseCell, maxWidth: 220 }} title={is.product || ""}>{is.product || "—"}</td>
      <td style={{ ...denseCell, fontFamily: mono }}>{is.L && is.W ? `${is.L}×${is.W}${is.H ? "×" + is.H : ""}` : ""}</td>
      <td style={denseCell}>{is.ply}p {is.flute_F1 || "—"}{(+is.ply === 5 && is.flute_F2) ? "/" + is.flute_F2 : ""}</td>
      <td style={{ ...denseCell, fontFamily: mono, textAlign: "right" }}>{is.spec_bs || "—"}</td>
      <td style={{ ...denseCell, fontFamily: mono, textAlign: "right",
        color: bsOff === null ? C.slateL : bsOff ? C.orange : C.green }}>{ir?.calcBS || "—"}</td>
      <td style={{ ...denseCell, fontFamily: mono, textAlign: "right", color: C.slateL }}>
        {ir ? (ir.wtSheet * 1000).toFixed(0) + "g" : "—"}</td>
      <td style={{ ...denseCell, fontFamily: mono, textAlign: "right", fontWeight: 800, color: C.amber }}>
        {ir ? `₹${ir.finalRate.toFixed(2)}` : "—"}</td>
      <td style={{ ...denseCell, fontFamily: mono, textAlign: "right", color: C.slateL }}>
        {ir && perSet > 1 ? `×${is.qtyPerSet} = ₹${(ir.finalRate * perSet).toFixed(2)}` : ""}</td>
      <td style={{ ...denseCell, fontFamily: mono, textAlign: "right" }}>{ir ? ir.calcMOQ.toLocaleString() : "—"}</td>
      <td style={{ ...denseCell, padding: "0 6px", textAlign: "center" }}
        onClick={e => { e.stopPropagation(); onRemove(); }}>
        <button type="button" aria-label={`Remove ${is.material_code || "item"} from working items`}
          style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: T.title,
            lineHeight: 1, padding: 0 }}>×</button>
      </td>
    </tr>
  );
}

export default function QuoteItemsTab({ toolbarLead = null }){
  const {
    showToast, items, setItems, savedQuotes, setSavedQuotes,
    quoteRef, setQuoteRef, quoteDate, setQuoteDate,
    effectiveFrom, setEffectiveFrom, effectiveTo, setEffectiveTo,
    makerName, templateLoaded, templateB64, templateRef, handleTemplateLoad,
    rates, freight, batchProfile, removeItem, setTab,
  } = useAppState();
  const { focusPanel, toggleFocus, exitFocusOnEscape } = usePanelFocus();

  const canExport=quoteRef.trim()&&makerName.trim();
  const exportTip=!quoteRef.trim()?"Quote Ref is required before export":!makerName.trim()?"Your account has no display name set — contact an Admin":"";
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
    const rows=items.map((it,i)=>({it,label:String(i+1),isPP:isPPType(it.spec?.rowType)}));
    // Baselines are the batch profile's inherited defaults — the same values the
    // grid compares against, so the toast names the same rows the fields marked.
    const bp=batchProfile;
    const mk=(group,value,baseline)=>({group,value,baseline});
    const checks=[
      ["Waste%",       findDivergence(rows.map(r=>({label:r.label,
        ...mk(r.isPP?"PP":"Box",r.isPP?r.it.spec?.wastePP:r.it.spec?.waste,
              r.isPP?(bp.wastePP??5):(bp.waste??5))})))],
      ["Conv Rs/kg",   findDivergence(rows.map(r=>({label:r.label,
        ...mk(r.isPP?"PP":"Box",r.isPP?r.it.spec?.convRatePP:r.it.spec?.convRate,
              r.isPP?(bp.convRatePP??12.5):(bp.convRate??7))})))],
      ["Customer Interest%", findDivergence(rows.map(r=>({label:r.label,
        ...mk("",r.it.spec?.interest,bp.interest??0.5)})))],
      ["Freight Rs/kg",findDivergence(rows.map(r=>({label:r.label,
        ...mk("",r.it.spec?.freightOverride,bp.freightOverride??"")})))],
    ].filter(([,d])=>d.length>0&&d.some(x=>x.labels.length>0));
    if(!checks.length)return;
    const parts=checks.map(([label,ds])=>ds.map(d=>
      `${label}${d.group?` (${d.group})`:""}: rows ${d.labels.join(", ")} disagree (${d.values.join(", ")})`
    ).join(" · ")).join(" · ");
    showToast(
      `⚠ ${checks.length} value${checks.length===1?"":"s"} will not export as entered — ${parts}. `
      +`The workbook holds one value per slot; the others will not reach the quote.`,
      'error',12000);
  };

  // B3: SET completeness check — warn if any SET has a Box but no Plate/Partition
  const checkSETCompleteness=()=>{
    // D-7: normalise. Case-split SET codes made this gate see one SET as two —
    // a Box under "Glass180" and its Part under "GLASS180" reported the Box's
    // SET as incomplete when the Part existed all along. A FALSE WARNING on
    // the export path, not a display quirk. The grouping below is also
    // case-insensitive, so the file agrees with itself.
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

  const exportExcel=()=>{if(checkSETCompleteness()){warnDivergence();exportFromTemplate(items,rates,freight,templateB64,{quoteRef,makerName,quoteDate,effectiveFrom,effectiveTo,marginPP:batchProfile.marginPP??8},msg=>showToast(msg,'error',8000));}};
  const exportPdf=()=>{if(checkSETCompleteness())exportAllPDF(items,{quoteRef,makerName,paymentDisc:batchProfile.paymentDisc||"30",effectiveTo});};

  const setMap={};const standalone=[];
  items.forEach(item=>{
    const sc=(item.spec.setCode||"").trim().toUpperCase();
    if(sc){if(!setMap[sc])setMap[sc]=[];setMap[sc].push(item);}else standalone.push(item);
  });
  const openRow=()=>{showToast(QI_READONLY_MSG,'info',5000);setTab("batch");};
  const datesSet=!!(effectiveFrom||effectiveTo);
  const draftCount=Object.keys(savedQuotes).length;

  return(
    <div onKeyDown={exitFocusOnEscape} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
      fontFamily: sans, background: C.cream }}>
      <div role="toolbar" aria-label="Working Quote Items controls" style={toolbar}>
        {toolbarLead}
        <label style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <ToolbarLabel>Quote Ref</ToolbarLabel>
          <input value={quoteRef} onChange={e=>setQuoteRef(e.target.value)} aria-label="Quote Ref"
            style={{ ...control, width: 124, fontFamily: mono, fontWeight: 700 }}/>
        </label>
        <details style={{ position: "relative" }}>
          <summary style={menuSummary(datesSet)}
            title="Quoted date, price validity, Maker and the master export template">
            Details{datesSet ? " · validity set" : ""} ▾</summary>
          <div style={{ ...menuPanel, minWidth: 300 }}>
            <label style={fieldLabel}>Quoted
              <input type="date" value={quoteDate} onChange={e=>setQuoteDate(e.target.value)}
                style={{ ...control, fontFamily: mono }}/>
            </label>
            <div style={fieldLabel}>Price valid
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <input type="date" value={effectiveFrom} onChange={e=>setEffectiveFrom(e.target.value)}
                  title="Effective From" aria-label="Price valid from" style={{ ...control, fontFamily: mono }}/>
                <span style={{ fontSize: T.body, color: C.slateL }}>—</span>
                <input type="date" value={effectiveTo} onChange={e=>setEffectiveTo(e.target.value)}
                  title="Effective To" aria-label="Price valid to" style={{ ...control, fontFamily: mono }}/>
              </span>
            </div>
            <div style={fieldLabel}>Maker
              <span style={{ fontSize: T.body, fontWeight: 400, color: makerName ? C.slateM : C.red }}>
                {makerName || "No display name on this account"}</span>
            </div>
            <div style={fieldLabel}>Export template
              <label style={{ ...actionButton(templateLoaded ? null : "success"), display: "inline-flex",
                alignItems: "center", justifySelf: "start" }}>
                {templateLoaded ? "✅ Template loaded · replace" : "📂 Load Master Template (.xlsx)"}
                <input ref={templateRef} type="file" accept=".xlsx" style={{ display: "none" }}
                  onChange={handleTemplateLoad}/>
              </label>
              <span style={{ fontSize: T.label, fontWeight: 400, lineHeight: 1.4, color: templateLoaded ? C.green : C.amberD }}>
                {templateLoaded
                  ?"Exports will use your master format — all formulas, formatting and sheet structure preserved."
                  :"Upload AvadhootPacks_Quotation_Master_v6_1.xlsx once. All exports will retain exact formulas, formatting and cross-sheet references."}
              </span>
            </div>
          </div>
        </details>
        {items.length>0&&!capacityOk&&<span role="alert" title={capacityMsg}
          style={{ fontSize: T.label, fontWeight: 700, color: C.red, background: C.redL,
            border: `1px solid ${C.red}44`, borderRadius: 5, padding: "3px 7px", whiteSpace: "nowrap" }}>
          ❌ {items.length} items exceed the template capacity</span>}
        <span style={{ flex: "1 1 auto" }} />
        <span style={{ fontSize: T.label, color: C.slateL, whiteSpace: "nowrap" }}>
          {items.length} item{items.length!==1?"s":""}</span>
        {items.length>0&&<>
          {!canExport&&<span style={{ fontSize: T.label, color: C.red, fontWeight: 700, whiteSpace: "nowrap" }}>{exportTip}</span>}
          <button type="button" disabled={!canExport||!capacityOk} onClick={exportExcel}
            title={capacityOk?exportTip:capacityMsg} style={actionButton("success", !canExport||!capacityOk)}>
            {templateLoaded?"↓ Export (Master Format)":"↓ Export All to Excel"}</button>
          <button type="button" disabled={!canExport} onClick={exportPdf}
            title={capacityOk?exportTip:capacityMsg} style={actionButton("info", !canExport)}>
            ↓ PDF (All SKUs)</button>
          {/* Fix 12: Re-import Excel button removed — the parseImportedExcel function reads
              wrong columns throughout (margin from Total Cost column etc.) and produces
              confidently wrong items. Disabled pre-beta; re-enable after column mapping is fixed.
          <label style={{padding:"8px 16px",borderRadius:6,fontSize:13,fontWeight:600,
            cursor:"pointer",background:C.white,color:C.slateM,border:`1px solid ${C.border}`}}>
            ↑ Re-import Excel
            <input ref={importRef} type="file" accept=".xlsx,.xls" style={{display:"none"}}
              onChange={handleImport}/>
          </label> */}
          <button type="button" style={actionButton("danger")} onClick={()=>{
            if(window.confirm("Clear all items? They will be lost unless exported."))setItems([]);}}>Clear All</button>
        </>}
        {draftCount>0&&<button type="button" style={actionButton()} onClick={()=>{
          const names=Object.keys(savedQuotes).join(", ");
          const pick=window.prompt(`Saved drafts: ${names}\n\nType client name to restore:`);
          if(pick&&savedQuotes[pick]){setItems(savedQuotes[pick].items);
            setSavedQuotes(prev=>{const n={...prev};delete n[pick];return n;});}}}>📁 Drafts ({draftCount})</button>}
        <PanelFocusToggle panel="list" noun="working items" focused={focusPanel === "list"} onToggle={toggleFocus} />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: C.white }}>
        {items.length===0
          ? <div style={{ textAlign: "center", color: C.slateL, marginTop: 48, fontSize: T.title }}>
              No items yet. Add rows in <button type="button" onClick={()=>setTab("batch")}
                style={{ background: "none", border: "none", color: C.amber, fontWeight: 700, cursor: "pointer",
                  fontSize: T.title, textDecoration: "underline", padding: 0 }}>Batch Entry</button>, calculate,
              then click "Send All to Quote Items".
            </div>
          : <table style={denseTable}>
              <thead>
                <tr>
                  <th scope="col" style={{ ...denseHead, ...frozenCell(false, true) }}>Mat Code / Type</th>
                  {COLUMNS.map(([h, align]) => <th key={h} scope="col" style={{ ...denseHead, textAlign: align || "left" }}>{h}</th>)}
                  <th scope="col" style={denseHead} aria-label="Remove item" />
                </tr>
              </thead>
              <tbody>
                {standalone.map((item,i)=><ItemRow key={item.id} item={item} background={i%2?C.cream:C.white}
                  onOpen={openRow} onRemove={()=>removeItem(item.id)}/>)}
                {Object.entries(setMap).map(([sc,si])=>{
                  const costed=si.filter(i=>i.result);
                  const setRate=costed.reduce((s,i)=>s+i.result.finalRate*(+i.spec.qtyPerSet||1),0);
                  return <Fragment key={sc}>
                    <tr style={{ height: 26, background: C.slateM }}>
                      <td colSpan={COLUMNS.length + 2} style={{ ...denseCell, maxWidth: "none",
                        color: C.amber, fontWeight: 700 }}>
                        📦 SET {sc} · {si.length} item{si.length>1?"s":""} · {costed.length} costed ·{" "}
                        <span style={{ fontFamily: mono }}>SET Rate ₹{setRate.toFixed(2)}/set</span>
                      </td>
                    </tr>
                    {si.map((item,i)=><ItemRow key={item.id} item={item} background={i%2?"#F5F0EC":C.cream}
                      onOpen={openRow} onRemove={()=>removeItem(item.id)}/>)}
                  </Fragment>;
                })}
              </tbody>
            </table>}
      </div>

      <ScreenFooter right="Read-only · revise in Batch Entry → Calculate All → Send All again">
        <ProvenanceTag kind="local" />
        <span title="Kept in this browser only — not a governed record. Send a Batch to create a governed revision.">
          Working items · this browser only · not a governed Quote revision</span>
        <span aria-hidden="true">·</span>
        <span>Calc BS <span style={{ color: C.green }}>within 5%</span> / <span style={{ color: C.orange }}>over 5%</span> of Std BS</span>
      </ScreenFooter>
    </div>
  );
}
