// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/DefaultsTab.jsx — the governed Sector master, plus the browser-local
// box-type trim table and partitions master.
//
// ── SECTORS ARE NOW GOVERNED (Product Owner, 2026-09-22) ──────────────────
// This screen used to edit a browser-local `cbb_sectors` list in localStorage
// that NO other screen read. The Customer Families Sector dropdown reads the
// governed `public.sectors` table, so a Sector added here never appeared
// there — the defect that started this work. Commercial Policies IS the
// governed Sector master now: every Sector action below is a single Flask
// request to a governed /masters/sectors* route, which forwards to a public.*
// invoker wrapper over an app_private operation. This screen never calls a
// Postgres RPC or runs mutation SQL directly. Request bodies and confirm
// copy come from lib/sectorActions.js, proven by
// scripts/sector-actions-fixtures.mjs.
//
// SINGLE-STEP EDIT FOR BETA. The database still moves every version through
// draft -> approved with two distinct capabilities; one operator action simply
// performs both inside one transaction. So the editing controls need
// propose_commercial_master AND approve_commercial_master, which is what the
// database itself requires — not the derived `role` label.
//
// A ROW IS THE UNIT OF SAVE. An approved sector_version is immutable (CDM-31),
// so a commercial edit is a NEW version carrying all six values. Saving per
// cell would mint one version per keystroke, so the row has one Save that
// commits every pending commercial change together.
//
// SECTORS ARE NEVER DELETED. No Family D table has a DELETE policy (CDM-31).
// The delete button that used to sit on each row is now Deactivate, and the
// database refuses even that while a live Customer Family is still classified
// by the Sector.
//
// ⚠️ UPSTREAM OF NEGATIVE CASE 4. Sector waste/conv values feed the wastePP
// resolution in useCostingResult (_sectorForCalc → _wasteDefPP/_convDefPP).
// The values now come from state/useGovernedSectors.js instead of this
// browser, and they additionally carry marginPct, which the local list never
// had and resolveAuthority.js:41 already anticipated.
//
// ── BOX TRIM AND PARTITIONS STAY LOCAL (Product Owner, 2026-09-22) ────────
// Neither has a governed table to move to, so both keep their existing
// browser-local behaviour AND their existing admin gate. That gate reads the
// derived `role` label, which contradicts the U1 rule; it remains recorded as
// follow-up debt rather than changed here, because inventing a capability for
// a browser-local master would be worse. The Local provenance tag now belongs
// to those two sections only.
//
// The cbb_boxtrim "Reset to Defaults" write goes through lib/persist.js, as
// routed in 4c. Do not unwrap it back to raw localStorage.
//
// ── SCREEN SPACE ──────────────────────────────────────────────────────────
// Three masters, ONE section at a time behind a switch in the one toolbar.
// Add forms sit in a disclosure; rows are 26px with the key column frozen;
// the explanatory notes and the provenance tag are in the footer.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { DEFAULT_BOX_TRIM_DATA } from "../data/defaults.js";
import { hasCapability } from "../lib/capabilities.js";
import { setItem } from "../lib/persist.js";
import { runMutation } from "../lib/runMutation.js";
import {
  commercialsAreDirty, deactivateSectorConfirmMessage, marginIsMissing, nameIsDirty,
  proposeSectorBody, reactivateSectorConfirmMessage, renameSectorBody,
  reviseConfirmMessage, reviseSectorCommercialsBody, sectorCodeIsBlank, sectorNameIsBlank,
  setSectorStatusBody,
} from "../lib/sectorActions.js";
import { useAppState } from "../state/AppStateContext.js";
import { ProvenanceTag } from "../ui/dataDisplay.jsx";
import { PanelFocusToggle, ScreenFooter } from "../ui/screenChrome.jsx";
import {
  cellInput, control, denseCell, denseHead, denseTable, frozenCell, inputCell, menuPanel, menuSummary,
  segment, toolbar, usePanelFocus,
} from "../ui/screenStandards.js";
import { C, T, mono } from "../theme.js";

const SECTIONS = [
  { id: "sector-defaults", label: "Sector Defaults", name: "Sector Defaults", provenance: "governed",
    note: "The governed Sector master. Selecting a sector in Costing auto-fills Waste% (CBB) and Conv Rs/kg (Box)." },
  { id: "box-trim-defaults", label: "Box Trim", name: "Box Type Trim Defaults", provenance: "local",
    note: "Auto-fills trim margins in Costing when a box type is selected · PP: trim=0 · Board: trim=10mm · Custom: 0." },
  { id: "partitions-master", label: "Partitions", name: "Partitions Master — Alcobev Glass SKU", provenance: "local",
    note: "Nos per set by SKU type · auto-fills Nos/Set for Partition-L and Partition-W rows when a Glass SKU is selected." },
];

const EMPTY_SECTOR = { code: "", name: "", wasteCBB: 5, wastePP: 5, convBox: 7, convPP: 12.5, margin: 8, specLang: "BS" };

const rowButton = { ...control, height: 22, padding: "0 8px", fontSize: T.label, fontWeight: 700, cursor: "pointer",
  whiteSpace: "nowrap" };
const smallButton = { ...control, height: 20, padding: "0 7px", fontSize: T.label, fontWeight: 700, cursor: "pointer",
  whiteSpace: "nowrap" };

export default function DefaultsTab(){
  const {
    role, showToast, boxTrim, setBoxTrim,
    partitionsMaster, setPartitionsMaster,
    governedSectorState, governedSectors, refreshSectors,
  } = useAppState();
  const { profile } = useAuth();
  const[newSector,setNewSector]=useState(EMPTY_SECTOR);
  const[section,setSection]=useState("sector-defaults");
  const[drafts,setDrafts]=useState({});   // { [sectorId]: editedRow } — pending, unsaved
  const[busyId,setBusyId]=useState(null);
  const { focusPanel, toggleFocus, exitFocusOnEscape } = usePanelFocus();
  const isAdmin=role==="admin";           // box trim + partitions only (recorded debt)
  const active=SECTIONS.find(s=>s.id===section);

  // The database requires BOTH for a single-step propose/revise, so the screen
  // asks for exactly what the operation asks for — no narrower invention, and
  // no derived role label.
  const canEditSectors=hasCapability(profile,"propose_commercial_master")
    && hasCapability(profile,"approve_commercial_master");

  const counts={
    "sector-defaults":`${governedSectors.length} sector${governedSectors.length===1?"":"s"}`,
    "box-trim-defaults":`${Object.keys(boxTrim).length} box types`,
    "partitions-master":`${partitionsMaster.length} SKU type${partitionsMaster.length===1?"":"s"}`,
  };

  // ── Sector Defaults — governed ──────────────────────────────────────────
  const rowFor=row=>drafts[row.id]||row;
  const editRow=(row,field,value)=>setDrafts(prev=>({...prev,[row.id]:{...rowFor(row),[field]:value}}));
  const discardRow=row=>setDrafts(prev=>{const next={...prev};delete next[row.id];return next;});

  const saveCommercials=async row=>{
    const edited=rowFor(row);
    if(marginIsMissing(edited.margin)){
      showToast("❌ A target margin is required — every Sector maintains one.","error",8000);
      return;
    }
    if(!window.confirm(reviseConfirmMessage(row.name,row.versionNo)))return;
    setBusyId(row.id);
    const data=await runMutation(`/masters/sectors/${row.id}/commercials`,
      reviseSectorCommercialsBody(edited,row.versionNo),
      { showToast, successMessage: `Sector [${row.code}] saved as a new approved version.` });
    setBusyId(null);
    if(data!==null){ discardRow(row); refreshSectors(); }
  };

  const saveName=async row=>{
    const edited=rowFor(row);
    if(sectorNameIsBlank(edited.name)){
      showToast("❌ A Sector name is required.","error",8000);
      return;
    }
    setBusyId(row.id);
    const data=await runMutation(`/masters/sectors/${row.id}`,renameSectorBody(edited.name),
      { method: "PATCH", showToast, successMessage: `Sector [${row.code}] renamed.` });
    setBusyId(null);
    if(data!==null){ discardRow(row); refreshSectors(); }
  };

  const changeStatus=async(row,status)=>{
    const message=status==="inactive"
      ?deactivateSectorConfirmMessage(row.name)
      :reactivateSectorConfirmMessage(row.name);
    if(!window.confirm(message))return;
    setBusyId(row.id);
    const data=await runMutation(`/masters/sectors/${row.id}/status`,setSectorStatusBody(status),
      { showToast, successMessage: `Sector [${row.code}] is now ${status}.` });
    setBusyId(null);
    if(data!==null){ discardRow(row); refreshSectors(); }
  };

  const sectorTable=()=>{
    if(governedSectorState.status==="loading")
      return<div style={{ padding: 16, fontSize: T.label, color: C.slateL }}>Loading the Sector master…</div>;
    if(governedSectorState.status==="denied"||governedSectorState.status==="error")
      return<div style={{ padding: 16, fontSize: T.label, color: C.red }}>{governedSectorState.message}</div>;
    if(governedSectorState.status==="idle")
      return<div style={{ padding: 16, fontSize: T.label, color: C.amberD }}>
        Reading the Sector master needs read_party_master or read_construction_library.</div>;
    if(!governedSectors.length)
      return<div style={{ padding: 16, fontSize: T.label, color: C.slateL }}>
        No Sectors exist yet. {canEditSectors?"Add the first one from the toolbar.":""}</div>;

    return<table style={denseTable}>
      <thead><tr>
        <th scope="col" style={{ ...denseHead, ...frozenCell(false, true) }}>Sector Code</th>
        {["Sector Name","Waste% (CBB)","Waste% (P&P)","Conv Rs/kg (Box)","Conv Rs/kg (P&P)","Margin%","Spec Language","Ver"].map(h=>(
          <th key={h} scope="col" style={{ ...denseHead, textAlign: h==="Sector Name"?"left":"center" }}>{h}</th>))}
        {canEditSectors&&<th scope="col" style={denseHead} aria-label="Sector actions"/>}
      </tr></thead>
      <tbody>
        {governedSectors.map((row,i)=>{
          const edited=rowFor(row);
          const dirty=commercialsAreDirty(edited,row);
          const renamed=nameIsDirty(edited,row);
          const busy=busyId===row.id;
          // Render helpers, called as functions: declared as components inside
          // this map they were a new type on every render, so React remounted
          // the input and dropped focus after each keystroke.
          const editNum=(field,w=60)=>canEditSectors
            ?<input type="number" step="0.5" value={edited[field]??""}
               onChange={e=>editRow(row,field,e.target.value)}
               aria-label={`${row.code} ${field}`} disabled={busy}
               style={{ ...cellInput, width: w, textAlign: "center", fontFamily: mono }}/>
            :<span style={{fontFamily:mono}}>{row[field]===""?"—":row[field]}</span>;
          const editStr=(field,w=80)=>canEditSectors
            ?<input type="text" value={edited[field]??""}
               onChange={e=>editRow(row,field,e.target.value)}
               aria-label={`${row.code} ${field}`} disabled={busy}
               style={{ ...cellInput, width: w }}/>
            :<span>{row[field]||"—"}</span>;
          const background=row.status==="inactive"?C.paper:(i%2?C.cream:C.white);
          return<tr key={row.id} style={{ height: 26, background,
            opacity: row.status==="inactive"?0.62:1 }}>
            <td style={{ ...frozenCell(false), ...inputCell, background, fontWeight: 700, color: C.slateM, fontFamily: mono }}>
              {/* The code is the join key Costing resolves a Sector by
                  (spec.sector -> sectors.sector_code), so it is never editable
                  after creation — there is no governed rename-the-code
                  operation, because changing it would orphan every reference. */}
              <span title="A Sector code is permanent. A wrong code is a new Sector plus deactivation of this one.">
                {row.code}{row.status==="inactive"&&<span style={{ marginLeft: 4, fontSize: T.micro,
                  color: C.slateL, fontWeight: 700 }}>INACTIVE</span>}
              </span>
            </td>
            <td style={{ ...denseCell, ...inputCell, color: C.slateL }}>{editStr("name",160)}</td>
            <td style={{ ...denseCell, ...inputCell, textAlign: "center" }}>{editNum("wasteCBB")}%</td>
            <td style={{ ...denseCell, ...inputCell, textAlign: "center" }}>{editNum("wastePP")}%</td>
            <td style={{ ...denseCell, ...inputCell, textAlign: "center" }}>{editNum("convBox",65)}</td>
            <td style={{ ...denseCell, ...inputCell, textAlign: "center" }}>{editNum("convPP",65)}</td>
            <td style={{ ...denseCell, ...inputCell, textAlign: "center" }}>{editNum("margin",60)}%</td>
            <td style={{ ...denseCell, ...inputCell, textAlign: "center" }}>{editStr("specLang",80)}</td>
            <td style={{ ...denseCell, textAlign: "center", fontFamily: mono, color: C.slateL }}
              title={row.versionNo?`Approved version ${row.versionNo}`:"No approved version — this Sector cannot resolve in Costing"}>
              {row.versionNo??"—"}
            </td>
            {canEditSectors&&<td style={{ ...denseCell, ...inputCell, textAlign: "right", whiteSpace: "nowrap" }}>
              {renamed&&<button type="button" disabled={busy} onClick={()=>saveName(row)}
                style={{ ...smallButton, marginRight: 4 }}>Save name</button>}
              {dirty&&<button type="button" disabled={busy} onClick={()=>saveCommercials(row)}
                style={{ ...smallButton, marginRight: 4, border: "none", color: C.white,
                  background: busy?"#CCC":C.green }}>{busy?"Saving…":"Save v"+((row.versionNo||0)+1)}</button>}
              {(dirty||renamed)&&<button type="button" disabled={busy} onClick={()=>discardRow(row)}
                style={{ ...smallButton, marginRight: 4 }}>Discard</button>}
              {!dirty&&!renamed&&<button type="button" disabled={busy}
                onClick={()=>changeStatus(row,row.status==="active"?"inactive":"active")}
                style={{ ...smallButton, color: row.status==="active"?C.red:C.green }}>
                {row.status==="active"?"Deactivate":"Reactivate"}</button>}
            </td>}
          </tr>;})}
      </tbody>
    </table>;
  };

  const addSectorForm=()=>{
    const ns=newSector;
    const setNs=setNewSector;
    const codeBlank=sectorCodeIsBlank(ns.code);
    const duplicate=!codeBlank&&governedSectors.some(s=>s.code===ns.code.trim().toUpperCase());
    const nameBlank=sectorNameIsBlank(ns.name);
    const marginBlank=marginIsMissing(ns.margin);
    const ready=!codeBlank&&!duplicate&&!nameBlank&&!marginBlank;
    const submit=async()=>{
      if(!ready)return;
      setBusyId("new");
      const data=await runMutation("/masters/sectors",proposeSectorBody(ns),
        { showToast, successMessage: `Sector [${ns.code.trim().toUpperCase()}] created and approved.` });
      setBusyId(null);
      if(data!==null){ setNs(EMPTY_SECTOR); refreshSectors(); }
    };
    return<details style={{ position: "relative" }}>
      <summary style={menuSummary(!!ns.code)}>+ Add sector ▾</summary>
      <div style={{ ...menuPanel, minWidth: 320, gridTemplateColumns: "1fr 1fr" }}>
        {[["Code","code"],["Name","name"]].map(([lbl,k])=>
          <label key={k} style={{ display: "grid", gap: 3, fontSize: T.label, color: C.slateL, fontWeight: 700 }}>{lbl}
            <input type="text" placeholder={lbl} value={ns[k]}
              onChange={e=>setNs(p=>({...p,[k]:k==="code"?e.target.value.toUpperCase():e.target.value}))}
              style={{ ...control, fontFamily: k==="code"?mono:control.fontFamily,
                borderColor: k==="code"&&ns.code&&duplicate?C.red:C.border }}/>
          </label>)}
        {[["Waste% (CBB)","wasteCBB"],["Waste% (P&P)","wastePP"],
          ["Conv Rs/kg (Box)","convBox"],["Conv Rs/kg (P&P)","convPP"],
          ["Margin%","margin"]].map(([lbl,k])=>
          <label key={k} style={{ display: "grid", gap: 3, fontSize: T.label, color: C.slateL, fontWeight: 700 }}>{lbl}
            <input type="number" step={0.5} value={ns[k]}
              onChange={e=>setNs(p=>({...p,[k]:e.target.value}))}
              style={{ ...control, fontFamily: mono, textAlign: "center",
                borderColor: k==="margin"&&marginBlank?C.red:C.border }}/>
          </label>)}
        <label style={{ display: "grid", gap: 3, fontSize: T.label, color: C.slateL, fontWeight: 700 }}>Spec Language
          <input type="text" placeholder="SpecLang" value={ns.specLang}
            onChange={e=>setNs(p=>({...p,specLang:e.target.value}))} style={control}/>
        </label>
        <span style={{ display: "flex", alignItems: "end", gap: 6 }}>
          <button type="button" disabled={!ready||busyId==="new"} onClick={submit}
            style={{ ...control, fontWeight: 700, border: "none", color: C.white,
              background: ready&&busyId!=="new"?C.green:"#CCC",
              cursor: ready&&busyId!=="new"?"pointer":"not-allowed" }}>
            {busyId==="new"?"Creating…":"+ Add"}</button>
          {duplicate&&<span style={{ fontSize: T.label, color: C.red }}>Code already exists</span>}
          {!duplicate&&marginBlank&&<span style={{ fontSize: T.label, color: C.red }}>Margin is required</span>}
        </span>
        <span style={{ gridColumn: "1 / -1", fontSize: T.micro, color: C.slateL }}>
          The Sector and its first approved version are created together. A Sector code is permanent.
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
            }} style={{ background: "none", border: "none", color: C.red, cursor: "pointer",
              fontSize: T.title, lineHeight: 1, padding: "0 4px" }}>×</button>
          </td>}
          <td style={denseCell} aria-hidden="true"/>
        </tr>;})}
      </tbody>
    </table>
  );

  const editHint=()=>{
    if(section==="sector-defaults")
      return canEditSectors
        ?<span style={{ fontSize: T.label, color: C.green, fontWeight: 700, whiteSpace: "nowrap" }}>
           ⚙ Governed — edit enabled</span>
        :<span style={{ fontSize: T.label, color: C.amberD, fontWeight: 700, whiteSpace: "nowrap" }}
           title="Editing the Sector master needs propose_commercial_master and approve_commercial_master.">
           Read-only — needs propose + approve commercial master</span>;
    return isAdmin
      ?<span style={{ fontSize: T.label, color: C.green, fontWeight: 700, whiteSpace: "nowrap" }}>⚙ Admin — edit enabled</span>
      :<span style={{ fontSize: T.label, color: C.amberD, fontWeight: 700, whiteSpace: "nowrap" }}
         title="Editing these masters needs an administrator account.">Read-only — editing needs an administrator account</span>;
  };

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
        {canEditSectors&&section==="sector-defaults"&&addSectorForm()}
        {isAdmin&&section==="box-trim-defaults"&&<button type="button" onClick={resetBoxTrim} style={rowButton}>
          ↺ Reset to Defaults</button>}
        {isAdmin&&section==="partitions-master"&&<button type="button" style={{ ...rowButton, color: C.green }}
          onClick={()=>setPartitionsMaster(prev=>[...prev,{skuType:"New SKU",lwise:1,wwise:1}])}>+ Add SKU</button>}
        <span style={{ flex: "1 1 auto" }} />
        <span style={{ fontSize: T.label, color: C.slateL, whiteSpace: "nowrap" }}>{counts[section]}</span>
        {editHint()}
        <PanelFocusToggle panel="list" noun={active.name} focused={focusPanel === "list"} onToggle={toggleFocus} />
      </div>

      <div role="tabpanel" aria-label={active.name} id={section}
        style={{ flex: 1, minHeight: 0, overflow: "auto", background: C.white }}>
        {section==="sector-defaults"&&sectorTable()}
        {section==="box-trim-defaults"&&boxTrimTable()}
        {section==="partitions-master"&&partitionsTable()}
      </div>

      <ScreenFooter right={active.provenance==="governed"
        ? "Every change is an approved version · kept in history"
        : "Changes apply immediately · saved in this browser"}>
        <ProvenanceTag kind={active.provenance} />
        <span title={active.note} style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{active.name} · {active.note}</span>
      </ScreenFooter>
    </div>
  );
}
