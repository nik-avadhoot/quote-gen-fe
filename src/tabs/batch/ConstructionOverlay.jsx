// Batch Builder's thin adapter around the shared Construction picker.
//
// It also hosts the in-place "New construction" window (beta issue log item 2):
// the Maker no longer leaves Batch Entry for another screen and comes back. The
// new Construction is created in the GOVERNED library (Product Owner ruling
// 2026-09-22), so the picker reloads and applies it by its permanent CON- code.
import { useState } from "react";
import ConstructionPicker from "../../components/ConstructionPicker.jsx";
import GovernedConstructionCreate from "./GovernedConstructionCreate.jsx";
import { constrAutoName } from "../../lib/constructionName.js";
import { hasCapability, hasCapabilityAtPlant } from "../../lib/capabilities.js";
import { useAppState } from "../../state/AppStateContext.js";

export default function ConstructionOverlay(){
  const {batchConstrOverlay,batchConstrOverlayFilter,batchConstrOverlayQuery,
    batchConstrTargetRowId,batchRows,constructionCatalogue,gradeCodes,
    governedConstructionBatchPlant,invalidateBatchRow,profile,
    refreshGovernedConstructions,
    setBatchConstrOverlay,setBatchConstrOverlayFilter,setBatchConstrOverlayQuery,
    setBatchConstrTargetRowId,setBatchRows,setTab,showToast}=useAppState();
  const[creating,setCreating]=useState(false);
  const targetRow=batchConstrTargetRowId
    ?batchRows.find(row=>row.id===batchConstrTargetRowId):null;
  const close=()=>{
    setCreating(false);
    setBatchConstrOverlay(false);
    setBatchConstrTargetRowId(null);
    setBatchConstrOverlayQuery('');
  };
  const select=construction=>{
    if(!targetRow)return;
    invalidateBatchRow(targetRow.id);
    setBatchRows(prev=>prev.map(row=>{
      if(row.id!==targetRow.id)return row;
      const patch={constructionCode:construction.code};
      if(construction.board_gsm)patch.board_gsm=construction.board_gsm;
      else if(construction.layers){
        const takeUp={A:1.51,B:1.37,C:1.47,E:1.31};
        const layers=construction.layers||{};
        const gsm=(+(layers.TOP?.gsm)||0)+
          (+(layers.F1?.gsm)||0)*(takeUp[construction.flute_F1||'B']||1)+
          (+(layers.L1?.gsm)||0)+
          (+(layers.F2?.gsm)||0)*(takeUp[construction.flute_F2||'A']||1)+
          (+(layers.L2?.gsm)||0);
        if(gsm>0)patch.board_gsm=Math.round(gsm);
      }
      if(construction.spec_bs)patch.spec_bs=construction.spec_bs;
      if(construction.spec_bct)patch.spec_bct=construction.spec_bct;
      if(construction.spec_ect)patch.spec_ect=construction.spec_ect;
      return {...row,...patch};
    }));
    showToast(`✅ [${construction.code}] ${constrAutoName(construction)} applied`,'success');
    close();
  };
  // The governed library is the destination now; the browser-held legacy list
  // keeps its own screen for the entries already stored against A-Z codes.
  const openLibrary=()=>{close();setTab('conlib');};
  // Courtesy only — the database checks both capabilities again (S4-7).
  const mayCreate=hasCapability(profile,"manage_construction_library")
    &&!!governedConstructionBatchPlant
    &&hasCapabilityAtPlant(profile,"adopt_construction_for_plant",
      governedConstructionBatchPlant.plant_code);
  // The created Construction is published and adopted, so it is in the caller's
  // next catalogue read. Apply it only after that read, never from the response
  // alone: the row must point at what the library actually holds.
  const created=async data=>{
    setCreating(false);
    await refreshGovernedConstructions();
    showToast(`✅ [${data?.construction_code||"CON-?"}] published and adopted`,'success',5000);
    if(data?.construction_code&&targetRow){
      invalidateBatchRow(targetRow.id);
      setBatchRows(prev=>prev.map(row=>row.id===targetRow.id
        ?{...row,constructionCode:data.construction_code}:row));
      close();
    }
  };

  return <ConstructionPicker open={batchConstrOverlay} constructions={constructionCatalogue}
    createPanel={creating&&mayCreate
      ?<GovernedConstructionCreate plant={governedConstructionBatchPlant} gradeCodes={gradeCodes}
         onCancel={()=>setCreating(false)} onCreated={created}/>
      :null}
    onCreate={mayCreate?()=>setCreating(true):null}
    query={batchConstrOverlayQuery} onQueryChange={setBatchConstrOverlayQuery}
    filter={batchConstrOverlayFilter} onFilterChange={setBatchConstrOverlayFilter}
    selectedCode={targetRow?.constructionCode||''}
    contextLabel={targetRow?`Applying to row: ${targetRow.matCode||'—'} · ${targetRow.product||'unnamed'}`:''}
    onClose={close} onOpenLibrary={openLibrary} onSelect={select}/>;
}
