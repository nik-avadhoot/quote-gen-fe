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
//
// ── SCREEN SPACE ──────────────────────────────────────────────────────────
// The Price Rules strip, the New Grade strip and a title row used to stack
// above the table. The table now starts under ONE toolbar: Price rules and New
// grade are disclosures, the rate date sits beside them, and the formula and
// GSM-surcharge notes are in the footer with the Local provenance tag. The
// three blanket operations (Apply GY, Discount → All, Paper Credit% → All) keep
// their `buildBlanketConfirm` confirm-before-write EXACTLY — only their
// container moved. `test:blanket` guards the helper.
//
// ⚠️ EDITING IS GATED ON THE DERIVED `role` LABEL, not on a capability — the
// same recorded follow-up debt as Commercial Policies. Only the wording
// changed: there is no "switch to Admin" control.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { buildBlanketConfirm, gyAffected } from "../lib/blanketConfirm.js";
import { establishEffectiveMaterialRate, resolveSupplierCreditCost } from "../engine/rateMaster.js";
import { useAppState } from "../state/AppStateContext.js";
import { ProvenanceTag } from "../ui/dataDisplay.jsx";
import { PanelFocusToggle, ScreenFooter, ToolbarLabel } from "../ui/screenChrome.jsx";
import {
  cellInput, control, denseCell, denseHead, denseTable, frozenCell, inputCell, menuPanel, menuSummary,
  toolbar, usePanelFocus,
} from "../ui/screenStandards.js";
import { C, T, mono, sans } from "../theme.js";

const ruleLabel = { fontSize: T.label, fontWeight: 700, color: "#2E6094", whiteSpace: "nowrap" };
const bandLabel = { fontSize: T.label, color: C.slateL, whiteSpace: "nowrap" };
const ruleInput = w => ({ ...cellInput, width: w, textAlign: "center", fontFamily: mono });
const ruleRow = { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" };

export default function RateMasterTab(){
  const {
    role, showToast, rates, setRates, rateUpdatedAt, touchRateDate,
    gyPremLow, setGyPremLow, gyPremHigh, setGyPremHigh,
    blanketDisc, setBlanketDisc, blanketInterest, setBlanketInterest,
    freightBands, setFreightBands, constructionLib,
  } = useAppState();
  const[newGrade,setNewGrade]=useState({code:"",desc:"",price:"",disc:1.5});
  const { focusPanel, toggleFocus, exitFocusOnEscape } = usePanelFocus();
  const isAdmin=role==="admin";
  const ruleFacts=`GY ₹${gyPremLow}/₹${gyPremHigh} · ${freightBands.length} freight bands · Disc ₹${blanketDisc} · Paper credit ${blanketInterest}%`;

  return(
    <div onKeyDown={exitFocusOnEscape} style={{ height: "100%", display: "flex", flexDirection: "column",
      minHeight: 0, background: C.cream, fontFamily: sans }}>
      <div role="toolbar" aria-label="Rate Masters controls" style={toolbar}>
        {/* ── Price Rules ──────────────────────────────────────────────────── */}
        <details style={{ position: "relative" }}>
          <summary style={menuSummary(false)} title={ruleFacts}>Price rules ▾</summary>
          <div style={{ ...menuPanel, minWidth: 460, gap: 9 }}>
            <div style={{ fontSize: T.label, color: C.slateL }}>{ruleFacts}</div>
            {/* GY Premiums */}
            <div style={ruleRow}>
              <span style={{ ...ruleLabel, width: 92 }}>GY Premium</span>
              {[["16–24BF",gyPremLow,setGyPremLow],["28–35BF",gyPremHigh,setGyPremHigh]].map(([lbl,val,setter])=>(
                <label key={lbl} style={{display:"flex",alignItems:"center",gap:3}}>
                  <span style={bandLabel}>{lbl}</span>
                  <input type="number" step="0.25" value={val} disabled={!isAdmin}
                    onChange={e=>setter(+e.target.value)} style={ruleInput(52)}/>
                </label>))}
              {isAdmin&&<button type="button" onClick={()=>{
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
              }} style={{ ...cellInput, border: "none", background: "#2E6094", color: C.white, fontWeight: 700,
                cursor: "pointer" }}>Apply GY</button>}
            </div>

            {/* Freight by BF Band */}
            <div style={ruleRow}>
              <span style={{ ...ruleLabel, width: 92 }}>Freight</span>
              {[
                {lbl:"16–20BF",codes:["16","18","20","20GY"]},
                {lbl:"22–28BF",codes:["22","24","28","22GY","24GY","28GY","26HRCT"]},
                {lbl:"35BF+",codes:["35","35GY","25WTL","14DUP","40VKL"]},
              ].map((b,bi)=>(
                <span key={b.lbl} style={{display:"flex",alignItems:"center",gap:3}}>
                  <span style={bandLabel}>{b.lbl}</span>
                  <input type="number" step="0.25" min="0" value={freightBands[bi]||0} aria-label={`Freight ${b.lbl}`}
                    onChange={e=>{const nv=[...freightBands];nv[bi]=+e.target.value;setFreightBands(nv);}}
                    style={ruleInput(46)}
                    disabled={!isAdmin}/>
                  {isAdmin&&<button type="button" title={`Apply to ${b.lbl} grades`} onClick={()=>{
                    setRates(prev=>prev.map(r=>b.codes.includes(r.code)?{...r,freight:freightBands[bi]||0}:r));
                    touchRateDate();showToast(`Freight ₹${freightBands[bi]||0}/kg → ${b.lbl}`,'info');
                  }} style={{ ...cellInput, border: `1px solid ${C.amber}`, background: C.amberL, color: C.amberD,
                    fontWeight: 700, cursor: "pointer" }}>→</button>}
                </span>))}
            </div>

            {/* Blanket Discount */}
            <div style={ruleRow}>
              <span style={{ ...ruleLabel, width: 92 }}>Disc</span>
              <input type="number" step="0.25" value={blanketDisc} disabled={!isAdmin} aria-label="Blanket discount"
                onChange={e=>setBlanketDisc(+e.target.value)} style={ruleInput(52)}/>
              {isAdmin&&<button type="button" onClick={()=>{
                // D-8b: one click rewrote every grade with no confirmation.
                const _c=buildBlanketConfirm({kind:"set",label:"Discount",
                  valueText:`₹${(+blanketDisc).toFixed(2)}/kg`,
                  affected:rates.length,total:rates.length,
                  currentValues:rates.map(r=>({text:`${r.desc||r.code} ₹${(+r.disc||0).toFixed(2)}`,value:+r.disc||0}))});
                if(!_c.actionable){showToast(_c.text,'info',5000);return;}
                if(!window.confirm(_c.text))return;
                setRates(prev=>prev.map(r=>({...r,disc:blanketDisc})));
                touchRateDate();showToast(`Disc ₹${blanketDisc}/kg → all`,'info');
              }} style={{ ...cellInput, fontWeight: 700, color: C.slateM, cursor: "pointer" }}>All</button>}
            </div>

            {/* Blanket SUPPLIER paper-credit cost (CDM-41). NOT customer interest. */}
            <div style={ruleRow}>
              <span style={{ ...ruleLabel, width: 92 }}>Paper Credit%</span>
              <input type="number" step="0.25" value={blanketInterest} disabled={!isAdmin} aria-label="Blanket paper credit %"
                onChange={e=>setBlanketInterest(+e.target.value)} style={ruleInput(52)}/>
              {isAdmin&&<button type="button" onClick={()=>{
                // D-8b: as above — every grade, one click, no confirmation.
                const _c=buildBlanketConfirm({kind:"set",label:"Paper Credit%",
                  valueText:`${(+blanketInterest).toFixed(2)}%`,
                  affected:rates.length,total:rates.length,
                  currentValues:rates.map(r=>({text:`${r.desc||r.code} ${(+r.interest||0).toFixed(2)}%`,value:+r.interest||0}))});
                if(!_c.actionable){showToast(_c.text,'info',5000);return;}
                if(!window.confirm(_c.text))return;
                setRates(prev=>prev.map(r=>({...r,interest:blanketInterest})));
                touchRateDate();showToast(`Paper credit ${blanketInterest}% → all grades`,'info');
              }} style={{ ...cellInput, fontWeight: 700, color: C.slateM, cursor: "pointer" }}>All</button>}
            </div>
            {!isAdmin&&<div style={{ fontSize: T.label, color: C.amberD }}>
              Read-only — editing price rules needs an administrator account.</div>}
          </div>
        </details>

        {/* ── Add Grade (admin only) ───────────────────────────────────────── */}
        {isAdmin&&<details style={{ position: "relative" }}>
          <summary style={menuSummary(!!newGrade.code)}>+ New grade ▾</summary>
          <div style={{ ...menuPanel, minWidth: 280 }}>
            {[
              {k:"code",ph:"Code e.g. 30GY",lbl:"Code"},
              {k:"desc",ph:"Short description",lbl:"Description"},
              {k:"price",ph:"Price",lbl:"Paper price",t:"number"},
              {k:"disc",ph:"Disc",lbl:"Discount",t:"number"},
              {k:"freight",ph:"Freight",lbl:"Freight",t:"number"},
            ].map(({k,ph,lbl,t="text"})=>(
              <label key={k} style={{ display: "grid", gap: 3, fontSize: T.label, color: C.slateL, fontWeight: 700 }}>{lbl}
                <input type={t} step={t==="number"?"0.25":undefined}
                  value={newGrade[k]??""} placeholder={ph}
                  onChange={e=>setNewGrade(g=>({...g,[k]:t==="number"?+e.target.value:e.target.value}))}
                  style={{ ...control, fontFamily: k==="code"||t==="number"?mono:sans }}/>
              </label>))}
            <button type="button" onClick={()=>{
              if(!newGrade.code||!newGrade.price){showToast("Code and Price required",'error');return;}
              if(rates.find(r=>r.code===newGrade.code)){showToast("Grade code already exists",'error');return;}
              setRates(prev=>[...prev,{...newGrade,freight:newGrade.freight||0}]);
              touchRateDate();
              setNewGrade({code:"",desc:"",price:"",disc:1.5,freight:0});
            }} style={{ ...control, border: "none", background: C.green, color: C.white, fontWeight: 700,
              cursor: "pointer" }}>Add Grade</button>
          </div>
        </details>}

        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
          <ToolbarLabel>Rates updated</ToolbarLabel>
          <span style={{ fontSize: T.body, fontFamily: mono, color: rateUpdatedAt ? C.slateM : C.amberD }}>
            {rateUpdatedAt || "Date not set"}</span>
          {isAdmin&&<button type="button" onClick={touchRateDate}
            style={{ background: "none", border: "none", color: "#2E6094", cursor: "pointer", fontSize: T.label,
              textDecoration: "underline", padding: 0 }}>Mark today</button>}
        </span>
        <span style={{ flex: "1 1 auto" }} />
        <span style={{ fontSize: T.label, color: C.slateL, whiteSpace: "nowrap" }}>{rates.length} grades</span>
        {isAdmin
          ?<span style={{ fontSize: T.label, color: C.green, fontWeight: 700, whiteSpace: "nowrap" }}>⚙ Admin — edit enabled</span>
          :<span style={{ fontSize: T.label, color: C.amberD, fontWeight: 700, whiteSpace: "nowrap" }}>
             Read-only — editing needs an administrator account</span>}
        <PanelFocusToggle panel="list" noun="Rate Master" focused={focusPanel === "list"} onToggle={toggleFocus} />
      </div>

      {/* ── Rate Master table ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: C.white }}>
        <table style={denseTable}>
          <thead><tr>
            <th scope="col" style={{ ...denseHead, ...frozenCell(false, true) }}>Grade</th>
            {["Description","Paper Price","Paper Credit %","Discount","Freight","Eff Rate"].map(h=>(
              <th key={h} scope="col" style={{ ...denseHead, textAlign: h==="Description"?"left":"center" }}>{h}</th>))}
            {isAdmin&&<th scope="col" style={denseHead} aria-label="Delete grade"/>}
          </tr></thead>
          <tbody>{rates.map((row,i)=>{
            const supplierCreditPct=resolveSupplierCreditCost({rateEntry:row}).value;
            const eff=row.price?+establishEffectiveMaterialRate(row).toFixed(2):0;
            const fld=(k,w)=>isAdmin
              ?<input value={row[k]??0} type="number" step={k==="price"?0.5:0.25} aria-label={`${row.code} ${k}`}
                 onChange={e=>{setRates(prev=>prev.map((r,j)=>j===i?{...r,[k]:+e.target.value}:r));touchRateDate();}}
                 style={{ ...cellInput, width: w, textAlign: "center", fontFamily: mono,
                   borderColor: k==="freight"&&(row.freight||0)>0?C.amber:C.border,
                   background: k==="freight"&&(row.freight||0)>0?"#FFF8ED":C.white }}/>
              :<span style={{fontFamily:mono,color:k==="freight"&&(row.freight||0)>0?C.amberD:C.slateL}}>
                 {row[k]||"—"}</span>;
            const background=i%2?C.cream:C.white;
            return<tr key={row.code} style={{ height: 26, background }}>
              <td style={{ ...frozenCell(false), background, fontWeight: 700, color: C.slateM, fontFamily: mono }}>{row.code}</td>
              <td style={{ ...denseCell, color: C.slateL }} title={row.desc||""}>{row.desc}</td>
              <td style={{ ...denseCell, ...inputCell, textAlign: "center" }}>{fld("price",65)}</td>
              <td style={{ ...denseCell, ...inputCell, textAlign: "center" }}>
                {isAdmin
                  ?<input value={row.interest??1.5} type="number" step="0.25" min="0" max="5" aria-label={`${row.code} paper credit %`}
                     onChange={e=>{setRates(prev=>prev.map((r,j)=>j===i?{...r,interest:+e.target.value}:r));touchRateDate();}}
                     style={{ ...cellInput, width: 52, textAlign: "center", fontFamily: mono }}
                     title="SUPPLIER paper-credit cost % for this grade — an exception to the Rate Set value. Blank inherits; 0 means cash terms. NOT customer Payment-Terms interest (CDM-41)"/>
                  :<span style={{fontFamily:mono,color:C.slateL}}>{(row.interest??1.5).toFixed(2)}%</span>}
              </td>
              <td style={{ ...denseCell, ...inputCell, textAlign: "center" }}>{fld("disc",55)}</td>
              <td style={{ ...denseCell, ...inputCell, textAlign: "center" }}>{fld("freight",55)}</td>
              <td style={{ ...denseCell, textAlign: "center", fontWeight: 700, color: C.green, fontFamily: mono }}
                title={`${row.price} + credit(${supplierCreditPct}%)${(row.price*supplierCreditPct/100).toFixed(2)} - disc${row.disc||0} + fr${row.freight||0}`}>
                {eff}</td>
              {isAdmin&&<td style={{ ...denseCell, ...inputCell, textAlign: "center" }}>
                <button type="button" aria-label={`Delete grade ${row.code}`} onClick={()=>{
                  // Fix 6: count constructions using this grade before deleting
                  const usedIn=constructionLib.filter(c=>
                    Object.values(c.layers||{}).some(l=>l.code===row.code)).length;
                  const msg=usedIn>0
                    ?`Delete grade [${row.code}]? It is used in ${usedIn} construction(s). Rows using it will show ₹0 material cost. This cannot be undone.`
                    :`Delete grade [${row.code}]? This cannot be undone.`;
                  if(window.confirm(msg))setRates(prev=>prev.filter((_,j)=>j!==i));
                }}
                  style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: T.title,
                    lineHeight: 1, padding: "0 4px" }}>×</button>
              </td>}
            </tr>;})}
          </tbody>
        </table>
      </div>

      <ScreenFooter right="Effective rates are used in all costing">
        <ProvenanceTag kind="local" />
        <span>Eff Rate = Price + Paper Credit% − Disc + Freight</span>
        <span aria-hidden="true">·</span>
        <span title="Applied per layer during costing, not in the Rate Master Eff Rate"
          style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          GSM surcharge per layer in costing: &lt;100=+₹4 · =100=+₹1.5 · &gt;200=+₹1 ·
          e.g. 22BF=₹{rates.find(r=>r.code==="22")?.price||"—"} + GY₹{gyPremLow} → 22GY=₹{rates.find(r=>r.code==="22")?(rates.find(r=>r.code==="22").price+gyPremLow).toFixed(2):"—"}
        </span>
      </ScreenFooter>
    </div>
  );
}
