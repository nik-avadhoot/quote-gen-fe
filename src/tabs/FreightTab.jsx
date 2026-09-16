// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/FreightTab.jsx — plant × location freight matrix (Rs/kg).
//
// Extracted from QuotationApp.jsx (Phase 6a). Follows the UserManagementTab
// pattern: own file, local state, inline styles, store access via useAppState().
//
// newLocation is now LOCAL state. In the monolith it had to be declared at the
// top of App() — thousands of lines from its only consumer — because Rules of
// Hooks forbid useState inside the JSX const this tab used to be. Being a real
// component is what makes it local, and that is the point of this phase.
//
// ── SCREEN SPACE ──────────────────────────────────────────────────────────
// ONE toolbar (location count, Add location disclosure, edit state) above a
// dense matrix with the delivery location frozen; the unit and the Local
// provenance tag are in the footer. Deleting a location row now confirms first
// (Product Owner, 2026-09-16) — it removes that location's rate for every plant.
//
// ⚠️ EDITING IS GATED ON THE DERIVED `role` LABEL, not on a capability — the
// same recorded follow-up debt as Commercial Policies and Rate Masters.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { PLANTS } from "../data/defaults.js";
import { useAppState } from "../state/AppStateContext.js";
import { ProvenanceTag } from "../ui/dataDisplay.jsx";
import { PanelFocusToggle, ScreenFooter } from "../ui/screenChrome.jsx";
import {
  cellInput, control, denseCell, denseHead, denseTable, frozenCell, inputCell, menuPanel, menuSummary,
  toolbar, usePanelFocus,
} from "../ui/screenStandards.js";
import { C, T, mono, sans } from "../theme.js";

export default function FreightTab(){
  const { role, locations, setLocations, freight, setFreight } = useAppState();
  const[newLocation,setNewLocation]=useState("");
  const { focusPanel, toggleFocus, exitFocusOnEscape } = usePanelFocus();
  const isAdmin=role==="admin";
  const canAdd=!!newLocation&&!locations.includes(newLocation);

  return(
    <div onKeyDown={exitFocusOnEscape} style={{ height: "100%", display: "flex", flexDirection: "column",
      minHeight: 0, background: C.cream, fontFamily: sans }}>
      <div role="toolbar" aria-label="Freight Masters controls" style={toolbar}>
        {isAdmin&&<details style={{ position: "relative" }}>
          <summary style={menuSummary(!!newLocation)}>+ Add location ▾</summary>
          <div style={menuPanel}>
            <label style={{ display: "grid", gap: 3, fontSize: T.label, color: C.slateL, fontWeight: 700 }}>
              Delivery location
              <input value={newLocation} onChange={e=>setNewLocation(e.target.value)}
                placeholder="e.g. Surat" style={control}/>
            </label>
            <button type="button" disabled={!canAdd}
              onClick={()=>{
                setLocations(prev=>[...prev,newLocation]);
                setFreight(prev=>{const nf={...prev};
                  PLANTS.forEach(p=>{nf[p]={...(nf[p]||{}),[newLocation]:0};});return nf;});
                setNewLocation("");}}
              style={{ ...control, border: "none", fontWeight: 700, color: C.white,
                background: canAdd?C.green:"#CCC", cursor: canAdd?"pointer":"not-allowed" }}>+ Add Row</button>
            {newLocation&&locations.includes(newLocation)&&
              <span style={{ fontSize: T.label, color: C.red }}>That location already exists</span>}
          </div>
        </details>}
        <span style={{ fontSize: T.label, color: C.slateL, whiteSpace: "nowrap" }}>
          Rs/kg from plant to delivery location · {PLANTS.length} plants: {PLANTS.join(" · ")}</span>
        <span style={{ flex: "1 1 auto" }} />
        <span style={{ fontSize: T.label, color: C.slateL, whiteSpace: "nowrap" }}>
          {locations.length} location{locations.length===1?"":"s"}</span>
        {isAdmin
          ?<span style={{ fontSize: T.label, color: C.green, fontWeight: 700, whiteSpace: "nowrap" }}>⚙ Admin — add/edit/delete enabled</span>
          :<span style={{ fontSize: T.label, color: C.amberD, fontWeight: 700, whiteSpace: "nowrap" }}>
             Read-only — editing needs an administrator account</span>}
        <PanelFocusToggle panel="list" noun="Freight matrix" focused={focusPanel === "list"} onToggle={toggleFocus} />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: C.white }}>
        <table style={denseTable}>
          <thead><tr>
            <th scope="col" style={{ ...denseHead, ...frozenCell(false, true), minWidth: 140 }}>Delivery ↓ / Plant →</th>
            {PLANTS.map(p=><th key={p} scope="col" style={{ ...denseHead, background: C.amber, textAlign: "center",
              minWidth: 96 }}>{p}</th>)}
            {isAdmin&&<th scope="col" style={{ ...denseHead, width: 30 }} aria-label="Delete location"/>}
            <th scope="col" style={{ ...denseHead, width: "100%" }} aria-hidden="true"/>
          </tr></thead>
          <tbody>{locations.map((loc,li)=>{
            const background=li%2?C.cream:C.white;
            return <tr key={loc} style={{ height: 26, background }}>
              <td style={{ ...frozenCell(false), background, fontWeight: 600, color: C.slateM }}>{loc}</td>
              {PLANTS.map(plant=>(
                <td key={plant} style={{ ...denseCell, ...inputCell, textAlign: "center" }}>
                  {isAdmin
                    ?<input type="number" step="0.5" value={freight[plant]?.[loc]??0} aria-label={`${loc} from ${plant}`}
                       onChange={e=>setFreight(prev=>({...prev,[plant]:{...(prev[plant]||{}),[loc]:+e.target.value}}))}
                       style={{ ...cellInput, width: 68, textAlign: "center", fontFamily: mono }}/>
                    :<span style={{fontFamily:mono,color:C.slateM}}>{freight[plant]?.[loc]??0}</span>}
                </td>))}
              {isAdmin&&<td style={{ ...denseCell, ...inputCell, textAlign: "center" }}>
                <button type="button" aria-label={`Delete ${loc}`} onClick={()=>{
                    if(!window.confirm(`Delete delivery location [${loc}]?\nIts freight rate from every plant is removed. This cannot be undone.`))return;
                    setLocations(prev=>prev.filter(l=>l!==loc));
                    setFreight(prev=>{const nf={...prev};
                      PLANTS.forEach(p=>{const pl={...(nf[p]||{})};delete pl[loc];nf[p]=pl;});return nf;});}}
                  style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: T.title,
                    lineHeight: 1, padding: "0 4px" }}>×</button>
              </td>}
              <td style={denseCell} aria-hidden="true"/>
            </tr>;})}
          </tbody>
        </table>
      </div>

      <ScreenFooter right="Changes apply immediately · saved in this browser">
        <ProvenanceTag kind="local" />
        <span>Freight Rate Matrix · Rs/kg · click a cell to edit</span>
      </ScreenFooter>
    </div>
  );
}
