// Batch Builder's thin adapter around the shared Construction picker.
import ConstructionPicker from "../../components/ConstructionPicker.jsx";
import { constrAutoName } from "../../lib/constructionName.js";
import { useAppState } from "../../state/AppStateContext.js";

export default function ConstructionOverlay(){
  const {batchConstrOverlay,batchConstrOverlayFilter,batchConstrOverlayQuery,
    batchConstrTargetRowId,batchRows,constructionLib,invalidateBatchRow,
    setBatchConstrOverlay,setBatchConstrOverlayFilter,setBatchConstrOverlayQuery,
    setBatchConstrTargetRowId,setBatchRows,setTab,showToast}=useAppState();
  const targetRow=batchConstrTargetRowId
    ?batchRows.find(row=>row.id===batchConstrTargetRowId):null;
  const close=()=>{
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
  const openLibrary=()=>{close();setTab('constrlib');};

  return <ConstructionPicker open={batchConstrOverlay} constructions={constructionLib}
    query={batchConstrOverlayQuery} onQueryChange={setBatchConstrOverlayQuery}
    filter={batchConstrOverlayFilter} onFilterChange={setBatchConstrOverlayFilter}
    selectedCode={targetRow?.constructionCode||''}
    contextLabel={targetRow?`Applying to row: ${targetRow.matCode||'—'} · ${targetRow.product||'unnamed'}`:''}
    onClose={close} onOpenLibrary={openLibrary} onSelect={select}/>;
}
