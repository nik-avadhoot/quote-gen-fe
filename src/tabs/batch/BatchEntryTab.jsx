// ═══════════════════════════════════════════════════════════════════════════
// src/tabs/batch/BatchEntryTab.jsx — composes the Batch Entry tab.
//
// Extracted from QuotationApp.jsx (Phase 7b). The outer column layout only.
//
// Order matters visually, not logically: the profile bar is the flex-shrink:0
// header, the overlay is absolutely positioned and renders null when closed,
// and the grid takes the remaining height.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef } from "react";
import BatchProfileBar from "./BatchProfileBar.jsx";
import BatchPricingCard from "./BatchPricingCard.jsx";
import ConstructionOverlay from "./ConstructionOverlay.jsx";
import BatchGrid from "./BatchGrid.jsx";
import BatchFirstShell from "./BatchFirstShell.jsx";
import NewGovernedBatchPanel from "./NewGovernedBatchPanel.jsx";
import { useAppState } from "../../state/AppStateContext.js";
import { FOCUS } from "../../lib/quoteJourney.js";
import { SummaryRow } from "../../ui/dataDisplay.jsx";

export default function BatchEntryTab(){
  const { batchFocusMode:focusMode, batchProfile, durableBatch, newBatchDialogOpen,
    setBatchFocusMode:setFocusMode,
    setSidebarCollapsed, setU3PricingBasisDraft, showToast, sidebarCollapsed,
    u3PricingBasisDraft } = useAppState();
  const sidebarBeforeFocus=useRef(sidebarCollapsed);
  const focusModeRef=useRef(false);
  const toggleFocusMode=()=>{
    const next=!focusModeRef.current;
    if(next){
      sidebarBeforeFocus.current=sidebarCollapsed;
      setSidebarCollapsed(true);
    }else{
      setSidebarCollapsed(sidebarBeforeFocus.current);
    }
    focusModeRef.current=next;
    setFocusMode(next);
  };
  useEffect(()=>{
    if(focusModeRef.current&&!focusMode)setSidebarCollapsed(sidebarBeforeFocus.current);
    focusModeRef.current=focusMode;
  },[focusMode,setSidebarCollapsed]);
  useEffect(()=>()=>{
    if(focusModeRef.current){
      setSidebarCollapsed(sidebarBeforeFocus.current);
      setFocusMode(false);
    }
  },[setFocusMode,setSidebarCollapsed]);

  const pricingCard=<BatchPricingCard key={durableBatch?.id || "unbound"}
    fallbackPlantCode={batchProfile.plant} draft={u3PricingBasisDraft}
    setDraft={setU3PricingBasisDraft} showToast={showToast}/>;
  return(
    <div id={FOCUS.workspace} tabIndex={-1}
      style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <BatchFirstShell/>
      <div id={FOCUS.profile} tabIndex={-1}
        className={`batch-workspace-profile-card${focusMode?" is-focus-mode":""}`}>
        <div className="batch-focus-summary">
          <SummaryRow title="Batch Profile"
            facts={[batchProfile.client||"No client",batchProfile.sector||"No sector",
              [batchProfile.plant,batchProfile.delivery].filter(Boolean).join(" → ")||"Route unresolved"]}
            status="Focus mode" statusTone="positive" expanded={false}
            onExpandedChange={toggleFocusMode}
            style={{border:0,borderRadius:0,borderBottom:"2px solid #D97B2E"}}/>
        </div>
        <div className="batch-profile-full">
          <BatchProfileBar pricingCard={pricingCard}/>
        </div>
      </div>
      <ConstructionOverlay/>
      <BatchGrid focusMode={focusMode} onToggleFocusMode={toggleFocusMode}/>
      {newBatchDialogOpen && <NewGovernedBatchPanel/>}
    </div>
  );
}
