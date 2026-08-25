// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/costing/CostingTab.jsx — the two-panel Costing layout.
//
// Extracted from QuotationApp.jsx (Phase 7a). Nothing but the grid wrapper:
// a fixed 380px spec form beside a flexible output panel.
// ═══════════════════════════════════════════════════════════════════════════
import SpecForm from "./SpecForm.jsx";
import OutputPanel from "./OutputPanel.jsx";
import { C } from "../../theme.js";

export default function CostingTab(){
  return(
    <div style={{display:"grid",gridTemplateColumns:"380px 1fr",height:"100%",overflow:"hidden"}}>
      <div style={{borderRight:`1px solid ${C.border}`,overflow:"hidden",
        display:"flex",flexDirection:"column"}}><SpecForm/></div>
      <div style={{overflow:"hidden",display:"flex",flexDirection:"column"}}><OutputPanel/></div>
    </div>
  );
}
