// ═══════════════════════════════════════════════════════════════════════════
// src/lib/constructionName.js — construction display name + row status map.
//
// Split out of QuotationApp.jsx (Phase 6 prerequisite). Both are pure and both
// are consumed by TWO tabs — Batch Entry and Construction Library — so they
// must live in a shared module rather than inside either one.
// ═══════════════════════════════════════════════════════════════════════════
import { C } from "../theme.js";

export const STATUS_DISPLAY={
    "incomplete":{icon:"🔴",label:"Incomplete",col:C.red},
    "draft-uncalc":{icon:"⚪",label:"Not calculated",col:C.slateL},
    "stale":{icon:"🔄",label:"Stale — recalculate",col:"#E8830A"},
    "draft":{icon:"🟡",label:"Draft",col:C.amberD},
    "reviewed":{icon:"🟢",label:"Reviewed",col:C.green},
    "override":{icon:"🔵",label:"Override",col:"#2E6094"},
    "spec-gap":{icon:"⚠️",label:"Spec gap",col:C.red},
  };
  // Spec-derived construction name — includes all applicable output parameters
  // Format: [Ply][Flutes] · [ActiveSpecs: GSM/BS/BCT/ECT/Cobb] · [PaperGrades/GSM layers]
export const constrAutoName=(c)=>{
    const ply=c.ply||5;
    const flutes=`${c.flute_F1||'B'}${ply===5&&c.flute_F2?c.flute_F2:''}`;
    const bfLayers=[c.layers?.TOP?.code,c.layers?.F1?.code,c.layers?.L1?.code,
      ...(ply===5?[c.layers?.F2?.code,c.layers?.L2?.code]:[])].filter(Boolean);
    const bfStr=bfLayers.length?bfLayers.join('/'):'—';
    // Layer GSM summary e.g. 180/150/180/150/180
    const gsmLayers=[c.layers?.TOP?.gsm,c.layers?.F1?.gsm,c.layers?.L1?.gsm,
      ...(ply===5?[c.layers?.F2?.gsm,c.layers?.L2?.gsm]:[])].filter(Boolean);
    const gsmStr=gsmLayers.length?gsmLayers.join('/'):null;
    const gradesGSM=[bfStr,gsmStr].filter(Boolean).join(' ');
    // Active specs (board-level)
    const gsm=c.board_gsm&&+c.board_gsm>0?`${+c.board_gsm}gsm`:'';
    const bs=c.spec_bs&&+c.spec_bs>0?`BS${(+c.spec_bs).toFixed(1)}`:'';
    const bct=c.spec_bct&&+c.spec_bct>0?`BCT${(+c.spec_bct).toFixed(0)}`:'';
    const ect=c.spec_ect&&+c.spec_ect>0?`ECT${(+c.spec_ect).toFixed(1)}`:'';
    const cobb=c.spec_cobb&&+c.spec_cobb>0?`Cobb≤${+c.spec_cobb}`:'';
    const specs=[gsm,bs,bct,ect,cobb].filter(Boolean).join(' ');
    // Order: [ply+flutes] · [active specs] · [grades+gsm layers]
    return [`${ply}p${flutes}`,specs,gradesGSM].filter(Boolean).join(' · ');
  };
