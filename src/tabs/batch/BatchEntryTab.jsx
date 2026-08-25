// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/batch/BatchEntryTab.jsx — composes the Batch Entry tab.
//
// Extracted from QuotationApp.jsx (Phase 7b). The outer column layout only.
//
// Order matters visually, not logically: the profile bar is the flex-shrink:0
// header, the overlay is absolutely positioned and renders null when closed,
// and the grid takes the remaining height.
// ═══════════════════════════════════════════════════════════════════════════
import BatchProfileBar from "./BatchProfileBar.jsx";
import ConstructionOverlay from "./ConstructionOverlay.jsx";
import BatchGrid from "./BatchGrid.jsx";

export default function BatchEntryTab(){
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <BatchProfileBar/>
      <ConstructionOverlay/>
      <BatchGrid/>
    </div>
  );
}
