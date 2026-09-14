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
import BatchPricingCard from "./BatchPricingCard.jsx";
import ConstructionOverlay from "./ConstructionOverlay.jsx";
import BatchGrid from "./BatchGrid.jsx";
import NewGovernedBatchPanel from "./NewGovernedBatchPanel.jsx";
import { useAppState } from "../../state/AppStateContext.js";

export default function BatchEntryTab(){
  const { batchProfile, durableBatch, newBatchDialogOpen,
    setU3PricingBasisDraft, showToast, u3PricingBasisDraft } = useAppState();
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <div className="batch-workspace-profile-card">
        <BatchProfileBar pricingCard={<BatchPricingCard key={durableBatch?.id || "unbound"}
          fallbackPlantCode={batchProfile.plant} draft={u3PricingBasisDraft}
          setDraft={setU3PricingBasisDraft} showToast={showToast}/>}/>
      </div>
      <ConstructionOverlay/>
      <BatchGrid/>
      {newBatchDialogOpen && <NewGovernedBatchPanel/>}
    </div>
  );
}
