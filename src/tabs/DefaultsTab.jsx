// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/DefaultsTab.jsx — sector defaults, box-type trim table, partitions.
//
// Extracted from QuotationApp.jsx (Phase 6c).
//
// newSector is now LOCAL state. The monolith carried an explicit admission at
// its declaration — "hoisted to component level (Rules of Hooks: useState
// cannot be called inside a conditional or an IIFE in JSX — doing so caused a
// blank screen when switching to Admin role)". That comment is deleted here
// because it is no longer true: this is a real component, so the Add-Sector
// form owns its own state and the IIFE constraint is gone.
//
// ⚠️ UPSTREAM OF NEGATIVE CASE 4. Sector waste/conv values feed the wastePP
// resolution in useCostingResult (_sectorForCalc → _wasteDefPP/_convDefPP).
// Nothing here changes those values or how they are read — this phase moves
// the editing UI only — but edits made on this tab do change costing output.
//
// Deliberate cross-domain reads, do NOT "clean up" — these ARE the guards:
//   * batchProfile.sector + constructionLib gate sector CODE renaming, since
//     the code is the join key across both.
//   * the same pair gates DELETION, and the source records that an earlier
//     version wrongly checked batchRows per-row instead of batchProfile
//     batch-wide.
//
// The cbb_boxtrim "Reset to Defaults" write goes through lib/persist.js, as
// routed in 4c. Do not unwrap it back to raw localStorage.
//
// ── SCREEN SPACE ──────────────────────────────────────────────────────────
// Three independent masters used to be stacked on one 1,924px scroll behind a
// jump-link strip, so two of them always sat below the fold. They are now ONE
// section at a time behind a switch in the one toolbar (Product Owner,
// 2026-09-16). Add forms sit in a disclosure; rows are 26px with the key column
// frozen; the explanatory notes and the Local provenance tag are in the footer.
//
// ⚠️ EDITING IS GATED ON THE DERIVED `role` LABEL, not on a capability. That
// contradicts the U1 rule, and it is recorded as follow-up debt rather than
// changed here: these are legacy browser-local masters with no governed
// capability of their own (Product Owner, 2026-09-16). Only the wording was
// corrected — there is no "switch to Admin" control, so none is promised.
//
// The two destructive actions here that had no confirm (Reset to Defaults,
// delete a Partitions row) now confirm first, like Sector delete (Product
// Owner, 2026-09-16).
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { DEFAULT_BOX_TRIM_DATA } from "../data/defaults.js";
import { setItem } from "../lib/persist.js";
import { useAppState } from "../state/AppStateContext.js";
import { ProvenanceTag } from "../ui/dataDisplay.jsx";
import { PanelFocusToggle, ScreenFooter } from "../ui/screenChrome.jsx";
import {
  cellInput, control, denseCell, denseHead, denseTable, frozenCell, inputCell, menuPanel, menuSummary,
  segment, toolbar, usePanelFocus,
} from "../ui/screenStandards.js";
import { C, T, mono } from "../theme.js";

const SECTIONS = [
  { id: "sector-defaults", label: "Sector Defaults", name: "Sector Defaults",
    note: "Selecting a sector in Costing auto-fills Waste% (CBB) and Conv Rs/kg (Box)." },
  { id: "box-trim-defaults", label: "Box Trim", name: "Box Type Trim Defaults",
    note: "Auto-fills trim margins in Costing when a box type is selected · PP: trim=0 · Board: trim=10mm · Custom: 0." },
  { id: "partitions-master", label: "Partitions", name: "Partitions Master — Alcobev Glass SKU",
    note: "Nos per set by SKU type · auto-fills Nos/Set for Partition-L and Partition-W rows when a Glass SKU is selected." },
];

const EMPTY_SECTOR = {code:"",name:"",wasteCBB:5,wastePP:5,convBox:7,convPP:12.5,specLang:"BS"};

const rowButton = { ...control, height: 22, padding: "0 8px", fontSize: T.label, fontWeight: 700, cursor: "pointer",
  whiteSpace: "nowrap" };
const removeButton = { background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: T.title,
  lineHeight: 1, padding: "0 4px" };

export default function DefaultsTab(){
  const {
    role, showToast, sectors, setSectors, boxTrim, setBoxTrim,
    partitionsMaster, setPartitionsMaster, batchProfile, constructionLib,
  } = useAppState();
  const[newSector,setNewSector]=useState(EMPTY_SECTOR);
  const[section,setSection]=useState("sector-defaults");
  const { focusPanel, toggleFocus, exitFocusOnEscape } = usePanelFocus();
  const isAdmin=role==="admin";
  const active=SECTIONS.find(s=>s.id===section);

  const counts={
    "sector-defaults":`${sectors.length} sector${sectors.length===1?"":"s"}`,
    "box-trim-defaults":`${Object.keys(boxTrim).length} box types`,
    "partitions-master":`${partitionsMaster.length} SKU type${partitionsMaster.length===1?"":"s"}`,
  };

  // ── Sector Defaults ─────────────────────────────────────────────────────
  const sectorTable=()=>(
    <table style={denseTable}>
      <thead><tr>
        <th scope="col" style={{ ...denseHead, ...frozenCell(false, true) }}>Sector Code</th>
        {["Sector Name","Waste% (CBB)","Waste% (P&P)","Conv Rs/kg (Box)","Conv Rs/kg (P&P)","Spec Language"].map(h=>(
          <th key={h} scope="col" style={{ ...denseHead, textAlign: h==="Sector Name"?"left":"center" }}>{h}</th>))}
        {isAdmin&&<th scope="col" style={denseHead} aria-label="Delete sector"/>}
      </tr></thead>
      <tbody>
        {sectors.map((row,i)=>{
          const upd=(field,val)=>setSectors(prev=>prev.map((r,j)=>j===i?{...r,[field]:val}:r));
          // Render helpers, called as functions: declared as components inside
          // this map they were a new type on every render, so React remounted
          // the input and dropped focus after each keystroke.
          const editNum=(field,w=60)=>isAdmin
            ?<input type="number" step="0.5" value={row[field]} onChange={e=>upd(field,+e.target.value)}
               aria-label={`${row.code} ${field}`}
               style={{ ...cellInput, width: w, textAlign: "center", fontFamily: mono }}/>
            :<span style={{fontFamily:mono}}>{row[field]}</span>;
          const editStr=(field,w=80)=>isAdmin
            ?<input type="text" value={row[field]} onChange={e=>upd(field,e.target.value)}
               aria-label={`${row.code} ${field}`} style={{ ...cellInput, width: w }}/>
            :<span>{row[field]}</span>;
          const background=i%2?C.cream:C.white;
          return<tr key={row.code} style={{ height: 26, background }}>
            <td style={{ ...frozenCell(false), ...inputCell, background, fontWeight: 700, color: C.slateM, fontFamily: mono }}>
              {isAdmin&&(()=>{
                // Code is the join key across batchProfile.sector and constructionLib.sector.
                // Editing it character-by-character orphans every reference at the first keystroke.
                // Allow edit only while the code is unreferenced — covers typo-fixing just after
                // adding. Once referenced, show as read-only with a title hint.
                const isReferenced=batchProfile.sector===row.code||
                  constructionLib.some(c=>c.sector===row.code);
                return isReferenced
                  ?<span style={{fontFamily:mono,fontWeight:700,
                      cursor:"not-allowed",borderBottom:`1px dashed ${C.border}`}}
                      title={`Code locked — referenced by ${batchProfile.sector===row.code?"the active Batch Profile":""}`+
                        `${constructionLib.some(c=>c.sector===row.code)?` ${constructionLib.filter(c=>c.sector===row.code).length} construction(s)`:""}. `+
                        `To rename, first re-assign all references, then edit the code.`}>
                    {row.code} <span aria-hidden="true" style={{ fontSize: T.micro, color: C.slateL }}>🔒</span>
                  </span>
                  :<input type="text" value={row.code}
                      onChange={e=>upd("code",e.target.value.toUpperCase())}
                      title="Code is editable while unreferenced. Will lock once used."
                      aria-label="Sector code"
                      style={{ ...cellInput, width: 90, fontFamily: mono, fontWeight: 700, textTransform: "uppercase" }}/>;
              })()}
              {!isAdmin&&<span>{row.code}</span>}
            </td>
            <td style={{ ...denseCell, ...inputCell, color: C.slateL }}>{editStr("name",160)}</td>
            <td style={{ ...denseCell, ...inputCell, textAlign: "center" }}>{editNum("wasteCBB")}%</td>
            <td style={{ ...denseCell, ...inputCell, textAlign: "center" }}>{editNum("wastePP")}%</td>
            <td style={{ ...denseCell, ...inputCell, textAlign: "center" }}>{editNum("convBox",65)}</td>
            <td style={{ ...denseCell, ...inputCell, textAlign: "center" }}>{editNum("convPP",65)}</td>
            <td style={{ ...denseCell, ...inputCell, textAlign: "center" }}>{editStr("specLang",80)}</td>
            {isAdmin&&<td style={{ ...denseCell, ...inputCell, textAlign: "center" }}>
              <button type="button" aria-label={`Delete sector ${row.code}`} onClick={()=>{
                // Delete guard: check batchProfile and constructionLib usage
                // Bug fix: old guard used batchRows.filter(r=>batchProfile.sector===row.code)
                // — predicate never referenced r, so .length = all rows or 0.
                // Correct: check batchProfile.sector directly (batch-wide, not per row).
                const profileUses=batchProfile.sector===row.code;
                const inConstr=constructionLib.filter(c=>c.sector===row.code).length;
                const msg=`Delete sector [${row.code}]?`
                  +(profileUses?`\n⚠️ Active Batch Profile uses this sector.`:"")
                  +(inConstr>0?`\n⚠️ ${inConstr} construction(s) reference this sector.`:"")
                  +"\nThis cannot be undone.";
                if(window.confirm(msg))setSectors(prev=>prev.filter((_,j)=>j!==i));
              }} style={removeButton}>×</button>
            </td>}
          </tr>;})}
      </tbody>
    </table>
  );

  const addSectorForm=()=>{
    const ns=newSector;
    const setNs=setNewSector;
    const codeOk=ns.code.trim()&&!sectors.find(s=>s.code===ns.code.trim().toUpperCase());
    return<details style={{ position: "relative" }}>
      <summary style={menuSummary(!!ns.code)}>+ Add sector ▾</summary>
      <div style={{ ...menuPanel, minWidth: 320, gridTemplateColumns: "1fr 1fr" }}>
        {[["Code","code"],["Name","name"]].map(([lbl,k])=>
          <label key={k} style={{ display: "grid", gap: 3, fontSize: T.label, color: C.slateL, fontWeight: 700 }}>{lbl}
            <input type="text" placeholder={lbl} value={ns[k]}
              onChange={e=>setNs(p=>({...p,[k]:k==="code"?e.target.value.toUpperCase():e.target.value}))}
              style={{ ...control, fontFamily: k==="code"?mono:control.fontFamily,
                borderColor: k==="code"&&ns.code&&!codeOk?C.red:C.border }}/>
          </label>)}
        {[["Waste% (CBB)","wasteCBB"],["Waste% (P&P)","wastePP"],
          ["Conv Rs/kg (Box)","convBox"],["Conv Rs/kg (P&P)","convPP"]].map(([lbl,k])=>
          <label key={k} style={{ display: "grid", gap: 3, fontSize: T.label, color: C.slateL, fontWeight: 700 }}>{lbl}
            <input type="number" step={0.5} value={ns[k]}
              onChange={e=>setNs(p=>({...p,[k]:+e.target.value}))}
              style={{ ...control, fontFamily: mono, textAlign: "center" }}/>
          </label>)}
        <label style={{ display: "grid", gap: 3, fontSize: T.label, color: C.slateL, fontWeight: 700 }}>Spec Language
          <input type="text" placeholder="SpecLang" value={ns.specLang}
            onChange={e=>setNs(p=>({...p,specLang:e.target.value}))} style={control}/>
        </label>
        <span style={{ display: "flex", alignItems: "end", gap: 6 }}>
          <button type="button" disabled={!codeOk} onClick={()=>{
            setSectors(prev=>[...prev,{...ns,code:ns.code.trim().toUpperCase()}]);
            setNs(EMPTY_SECTOR);
            showToast(`✅ Sector [${ns.code.toUpperCase()}] added`,'success');
          }} style={{ ...control, fontWeight: 700, border: "none", color: C.white,
            background: codeOk?C.green:"#CCC", cursor: codeOk?"pointer":"not-allowed" }}>+ Add</button>
          {ns.code&&!codeOk&&sectors.find(s=>s.code===ns.code.toUpperCase())&&
            <span style={{ fontSize: T.label, color: C.red }}>Code already exists</span>}
        </span>
      </div>
    </details>;
  };

  // ── Box Type Trim Defaults ──────────────────────────────────────────────
  const boxTrimTable=()=>(
    <table style={denseTable}>
      <thead><tr>
        <th scope="col" style={{ ...denseHead, ...frozenCell(false, true) }}>Box Type</th>
        {["3-ply Dkl","3-ply Cut","5-ply Dkl","5-ply Cut"].map(h=>
          <th key={h} scope="col" style={{ ...denseHead, textAlign: "center" }}>{h}</th>)}
        {["Deckle Formula","Cutting Formula"].map(h=><th key={h} scope="col" style={denseHead}>{h}</th>)}
      </tr></thead>
      <tbody>
        {Object.entries(boxTrim).map(([bt,t],i)=>{
          const upd=(field,val)=>setBoxTrim(prev=>({...prev,[bt]:{...prev[bt],[field]:+val}}));
          const tCell=field=>isAdmin
            ?<input type="number" step="1" value={t[field]} onChange={e=>upd(field,e.target.value)}
               aria-label={`${bt} ${field}`} style={{ ...cellInput, width: 70, textAlign: "center", fontFamily: mono }}/>
            :<span style={{fontFamily:mono,fontWeight:600}}>{t[field]}</span>;
          const background=i%2?C.cream:C.white;
          return<tr key={bt} style={{ height: 26, background }}>
            <td style={{ ...frozenCell(false), background, fontWeight: 700, color: C.slateM }}>{bt}</td>
            {["d3","c3","d5","c5"].map(f=><td key={f} style={{ ...denseCell, ...inputCell, textAlign: "center" }}>{tCell(f)}</td>)}
            <td style={{ ...denseCell, color: C.slateL, fontStyle: "italic" }} title={t.deckleF||""}>{t.deckleF||"—"}</td>
            <td style={{ ...denseCell, color: C.slateL, fontStyle: "italic" }} title={t.cuttingF||""}>{t.cuttingF||"—"}</td>
          </tr>;})}
      </tbody>
    </table>
  );

  const resetBoxTrim=()=>{
    if(!window.confirm("Reset every box-type trim margin to the shipped defaults?\n\nEvery trim value edited on this screen is overwritten. This cannot be undone."))return;
    const fresh={...DEFAULT_BOX_TRIM_DATA};
    setBoxTrim(fresh);
    setItem('cbb_boxtrim',JSON.stringify(fresh)); // persist.js already swallows storage errors
  };

  // ── Partitions Master ───────────────────────────────────────────────────
  const partitionsTable=()=>(
    <table style={denseTable}>
      <thead><tr>
        <th scope="col" style={{ ...denseHead, ...frozenCell(false, true) }}>SKU Type</th>
        {["Part-L (Length-wise nos)","Part-W (Width-wise nos)"].map(h=>
          <th key={h} scope="col" style={{ ...denseHead, textAlign: "center" }}>{h}</th>)}
        {isAdmin&&<th scope="col" style={denseHead} aria-label="Delete SKU type"/>}
        <th scope="col" style={{ ...denseHead, width: "100%" }} aria-hidden="true"/>
      </tr></thead>
      <tbody>{partitionsMaster.map((row,i)=>{
        const background=i%2?C.cream:C.white;
        return <tr key={i} style={{ height: 26, background }}>
          <td style={{ ...frozenCell(false), ...inputCell, background, fontWeight: 600, color: C.slateM }}>
            {isAdmin?<input value={row.skuType} aria-label="SKU type"
              onChange={e=>setPartitionsMaster(prev=>prev.map((r,j)=>j===i?{...r,skuType:e.target.value}:r))}
              style={{ ...cellInput, width: 160 }}/>
            :row.skuType}
          </td>
          {["lwise","wwise"].map(field=>(
            <td key={field} style={{ ...denseCell, ...inputCell, textAlign: "center" }}>
              {isAdmin?<input type="number" min="0" step="1" value={row[field]} aria-label={`${row.skuType} ${field}`}
                onChange={e=>setPartitionsMaster(prev=>prev.map((r,j)=>j===i?{...r,[field]:+e.target.value}:r))}
                style={{ ...cellInput, width: 60, textAlign: "center", fontFamily: mono }}/>
              :<span style={{ fontFamily: mono, fontWeight: 700 }}>{row[field]}</span>}
            </td>))}
          {isAdmin&&<td style={{ ...denseCell, ...inputCell, textAlign: "center" }}>
            <button type="button" aria-label={`Delete ${row.skuType}`} onClick={()=>{
              if(window.confirm(`Delete the Partitions Master row [${row.skuType}]?\nThis cannot be undone.`))
                setPartitionsMaster(prev=>prev.filter((_,j)=>j!==i));
            }} style={removeButton}>×</button>
          </td>}
          <td style={denseCell} aria-hidden="true"/>
        </tr>;})}
      </tbody>
    </table>
  );

  return(
    <div onKeyDown={exitFocusOnEscape} style={{ height: "100%", display: "flex", flexDirection: "column",
      minHeight: 0, background: C.cream }}>
      <div role="toolbar" aria-label="Commercial Policies controls" style={toolbar}>
        <div role="tablist" aria-label="Commercial policy sections" style={{ display: "inline-flex",
          border: `1px solid ${C.border}`, borderRadius: 5, overflow: "hidden", flexShrink: 0, background: C.white }}>
          {SECTIONS.map(s=><button key={s.id} type="button" role="tab" aria-selected={section===s.id}
            title={s.name} onClick={()=>setSection(s.id)} style={{ ...segment(section===s.id), whiteSpace: "nowrap" }}>
            {s.label}</button>)}
        </div>
        {isAdmin&&section==="sector-defaults"&&addSectorForm()}
        {isAdmin&&section==="box-trim-defaults"&&<button type="button" onClick={resetBoxTrim} style={rowButton}>
          ↺ Reset to Defaults</button>}
        {isAdmin&&section==="partitions-master"&&<button type="button" style={{ ...rowButton, color: C.green }}
          onClick={()=>setPartitionsMaster(prev=>[...prev,{skuType:"New SKU",lwise:1,wwise:1}])}>+ Add SKU</button>}
        <span style={{ flex: "1 1 auto" }} />
        <span style={{ fontSize: T.label, color: C.slateL, whiteSpace: "nowrap" }}>{counts[section]}</span>
        {isAdmin
          ?<span style={{ fontSize: T.label, color: C.green, fontWeight: 700, whiteSpace: "nowrap" }}>⚙ Admin — edit enabled</span>
          :<span style={{ fontSize: T.label, color: C.amberD, fontWeight: 700, whiteSpace: "nowrap" }}
             title="Editing these masters needs an administrator account.">Read-only — editing needs an administrator account</span>}
        <PanelFocusToggle panel="list" noun={active.name} focused={focusPanel === "list"} onToggle={toggleFocus} />
      </div>

      <div role="tabpanel" aria-label={active.name} id={section}
        style={{ flex: 1, minHeight: 0, overflow: "auto", background: C.white }}>
        {section==="sector-defaults"&&sectorTable()}
        {section==="box-trim-defaults"&&boxTrimTable()}
        {section==="partitions-master"&&partitionsTable()}
      </div>

      <ScreenFooter right="Changes apply immediately · saved in this browser">
        <ProvenanceTag kind="local" />
        <span title={active.note} style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{active.name} · {active.note}</span>
      </ScreenFooter>
    </div>
  );
}
