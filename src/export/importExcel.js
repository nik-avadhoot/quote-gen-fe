// ═══════════════════════════════════════════════════════════════════════════
// src/export/importExcel.js — parse a CBB+PP sheet back into quote items.
//
// Split out of QuotationApp.jsx (Phase 3). DISABLED: the Re-import UI is
// commented out in the Quote Items tab, with a note (Fix 12) that the column
// mapping is wrong. Retained rather than deleted - there is documented intent
// to revive it once the mapping is corrected.
//
// ⚠️ BUG (pre-existing, carried over unchanged): the calcCosting call passes
// `boxTrim`, which is not defined here - the parameter is named `boxTrimData`.
// This throws ReferenceError. Part of why the feature is disabled. Fix when
// re-enabling, not as part of the component split.
// ═══════════════════════════════════════════════════════════════════════════
import * as XLSX from "xlsx-js-style";
import { calcCosting } from "../engine/costing.js";

export const parseImportedExcel=async(file,rates,freight,boxTrimData)=>{
  const ab=await file.arrayBuffer();
  const wb=XLSX.read(ab);
  const ws=wb.Sheets["CBB+PP"];
  if(!ws)throw new Error("No 'CBB+PP' sheet found in uploaded file");
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
  const dataRows=rows.slice(6).filter(r=>String(r[1]||"").trim()==="Box");
  return dataRows.map((row,idx)=>{
    const mkLayer=(bf,gsm)=>{
      const bfStr=String(bf||"").trim();
      if(!bfStr||!gsm)return{code:"",gsm:""};
      // Try to match rate master code
      const numBF=parseInt(bfStr)||0;
      const code=String(bf||"");
      return{code,gsm:String(gsm||"")};
    };
    const spec={
      client:rows[1]?.[1]||"",product:row[3]||"",material_code:row[2]||"",sector:rows[2]?.[1]||"",
      L:row[5]||"",W:row[6]||"",H:row[7]||"",dimType:"ID",
      boxType:row[8]||"RSC",ply:+row[9]||5,ups:+row[10]||1,
      flute_F1:row[24]||"B",flute_F2:row[25]||"A",
      layers:{
        TOP:mkLayer(row[26],row[27]),F1:mkLayer(row[28],row[29]),L1:mkLayer(row[30],row[31]),
        F2:mkLayer(row[32],row[33]),L2:mkLayer(row[34],row[35]),
      },
      board_gsm:row[18]||"",spec_bs:row[20]||"",spec_bct:row[22]||"",spec_ect:row[23]||"",
      plant:row[4]||"Nagpur",delivery:rows[3]?.[9]||"Nagpur",
      waste:5,convRate:+(rows[3]?.[1])||7,freightOverride:"",
      margin:+(row[63]||0.08)*100||8,interest:1.5,
      printing:+(row[49])||0,packing:+(row[50])||0,stitching:+(row[51])||0,
      handling:+(row[52])||0,coating:+(row[55])||0,other:+(row[56])||0,
      volume:"",salesMOQ:row[66]||"",customerType:"existing",priceContext:"unknown",isRepeat:false,
    };
    const result=calcCosting(spec,rates,freight,boxTrim);
    return{id:Date.now()+idx,spec,result,status:"imported",note:"Re-imported from Excel"};
  });
};
