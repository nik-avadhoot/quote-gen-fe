import { useState, useRef, useEffect, Fragment } from "react";
import * as XLSX from "xlsx-js-style"; // npm install xlsx-js-style

import { apiFetch } from "./lib/apiClient.js";
import { useAuth } from "./AuthContext.jsx";
import UserManagementTab from "./UserManagementTab.jsx";
import ChangePasswordModal from "./ChangePasswordModal.jsx";
import ProfileModal from "./ProfileModal.jsx";
import AccountMenu from "./AccountMenu.jsx";


// ── Brand logos — base64 blobs moved to src/assets/logos.js (Phase 1 refactor) ──
import { LOGO_WIDE_B64 } from "./assets/logos.js";

// ── Engine & Data — extracted to separate modules (Phase 1 & 2 refactor) ──
import {
  CREDIT_PCT, TAKEUP, TRIM, PLANTS, LOCATIONS, SECTORS, BOX_TYPES,
  DEFAULT_RATES, DEFAULT_FREIGHT, DEFAULT_SECTORS_DATA,
  DEFAULT_BOX_TRIM_DATA, PARTITIONS_MASTER_DEFAULT, INIT_SPEC,
} from "./data/defaults.js";
import {
  bfNum, gsmS, tuFor, getTrim, getTrimD,
  getEffectiveRate, calcCosting,
  checkMissingInfo, checkSpecCompliance, estimateOverspecSaving,
  suggestMargin, buildSpecFromRow,
} from "./engine/costing.js";

import { C, mono, sans } from "./theme.js";

/* ═══ EXCEL EXPORT — matches CBB+PP xlsx format ════════════════════════════ */
const exportExcelFull=(items,rates,freight)=>{
  const wb=XLSX.utils.book_new();
  const today=new Date().toLocaleDateString("en-IN");
  const firstSpec=items[0]?.spec||{};

  // ── CBB+PP sheet ──────────────────────────────────────────────────────────
  const cbbRows=[
    ["CFB QUOTATION MASTER — COSTING SHEET (CBB + PLATES & PARTITIONS)"],
    ["Client / Party:",firstSpec.client||"","","","Plant / Location:",firstSpec.plant||"","","","Date:",today,"","Ref:",items.map(i=>i.spec.material_code).filter(Boolean).join(", ")],
    ["Sector:",firstSpec.sector||"","","","Producing Plant:",firstSpec.plant||"","","","Default Freight Loc:",firstSpec.delivery||""],
    ["Conv Rate Rs/kg (Box):",firstSpec.convRate||7,"","Conv Rate Rs/kg (Board):",10.5,"","Waste% (Box):",(firstSpec.waste||5)+"%","","Margin%:",(firstSpec.margin||8)+"%","","Interest%:",(firstSpec.interest||1.5)+"%"],
    [],  // row 5 group headers — fill below
    // Row 6: field headers
    ["Sr No","Row Type","Mat Code","SKU / Description","Plant / Location",
     "L (mm)","W (mm)","H (mm)","Box Type","PLY","Ups",
     "3-ply Dkl Trim","3-ply Cut Trim","5-ply Dkl Trim","5-ply Cut Trim",
     "DECKLE (mm)","CUTTING (mm)","AREA (m²/box)",
     "Std Board GSM","Calc Board GSM","Std BS (NLT)","Calc BS","Std BCT (NLT kgf)","Std ECT (NLT kN/m)",
     "F1 Flute","F2 Flute",
     "TOP BF","TOP GSM","F1 BF","F1 GSM","L1 BF","L1 GSM","F2 BF","F2 GSM","L2 BF","L2 GSM",
     "Rate TOP (Rs/kg)","Rate F1","Rate L1","Rate F2","Rate L2",
     "Paper Consumed TOP (kg)","PC F1","PC L1","PC F2","PC L2","Paper Consumed Total","Sheet Wt (kg/box)",
     "Material Cost (Rs)","Sheet Wt excl waste","Conv Cost (Rs)","Printing","Stitching","Coating",
     "Non-Std Handling","MOQ Charge","Packing","Other Cost","Unloading","Interest (Rs)","Freight (Rs, separate)","Total Cost (Rs)",
     "Margin %","Margin (Rs)","FINAL RATE [Rs]","Rate/kg (Rs)","MOQ (boxes)"],
  ];
  // Fill group header row (row 5 = index 4)
  cbbRows[4]=["IDENTIFICATION","","","","",
    "DIMENSIONS (mm)","","","BOX SETUP","","",
    "TRIM MARGINS (3-ply: Dkl→Cut | 5-ply: Dkl→Cut)","","","",
    "CALC DIMS","","","BOARD SPECIFICATION","","","","","",
    "FLUTES","","PAPER LAYERS — BF | GSM","","","","","","","","","",
    "RATES (Rs/kg incl surcharge)","","","","",
    "WEIGHTS (kg/box)","","","","","",
    "COST BUILD-UP (Rs/box)","","","","","","","","","","","",
    "MARGIN","","FINAL RATE","Rate/kg","MOQ"];

  items.forEach((item,idx)=>{
    const s=item.spec,r=item.result;
    if(!r)return;
    const t3=getTrimD(s.boxType,3,null),t5=getTrimD(s.boxType,5,null);
    const rd=k=>r.rowDetails.find(d=>d.k===k)||{wt:0,rate:0};
    const gc=k=>{const l=s.layers[k]||{};return parseInt(l.code)||""};
    cbbRows.push([
      idx+1,"RS4",s.material_code,s.product,s.plant,
      s.L,s.W,s.H,s.boxType,s.ply,s.ups,
      t3[0],t3[1],t5[0],t5[1],
      r.deckle,r.cutting,+r.area.toFixed(4),
      s.board_gsm||"",r.calcGSM,s.spec_bs||"",r.calcBS,s.spec_bct||"",s.spec_ect||"",
      s.flute_F1,s.flute_F2||"",
      gc("TOP"),s.layers.TOP?.gsm||"",gc("F1"),s.layers.F1?.gsm||"",
      gc("L1"),s.layers.L1?.gsm||"",gc("F2"),s.layers.F2?.gsm||"",
      gc("L2"),s.layers.L2?.gsm||"",
      +rd("TOP").rate.toFixed(2),+rd("F1").rate.toFixed(2),+rd("L1").rate.toFixed(2),
      +rd("F2").rate.toFixed(2),+rd("L2").rate.toFixed(2),
      +rd("TOP").wt.toFixed(4),+rd("F1").wt.toFixed(4),+rd("L1").wt.toFixed(4),
      +rd("F2").wt.toFixed(4),+rd("L2").wt.toFixed(4),+r.wt.toFixed(4),+r.wtSheet.toFixed(4),
      +r.mat.toFixed(2),+(r.wtSheet*1000).toFixed(0)+" g",+r.conv.toFixed(2),
      +s.printing||0,+s.stitching||0,+s.coating||0,+s.handling||0,+s.moqCharge||0,
      +s.packing||0,+s.other||0,+s.unloading||0,+r.intC.toFixed(2),+r.fr.toFixed(2),+r.total.toFixed(2),
      (+s.margin||0)/100,+r.marginAmt.toFixed(2),r.finalRate,+r.ratePerKg.toFixed(2),r.calcMOQ,
    ]);
  });
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(cbbRows),"CBB+PP");

  // ── OFFER sheet ───────────────────────────────────────────────────────────
  const offerRows=[
    ["QUOTATION"],[""],
    ["To:",firstSpec.client||"—","","Date:",today],
    ["Sector:",firstSpec.sector||"—","","Producing Plant:",firstSpec.plant||"—"],[""],
    ["Sr No","Mat Code","SKU Description","Dims L×W×H (mm)","Ply","Flute","Std BS","Std BCT","MOQ (boxes)","Landed Rate (Rs excl GST)"],
    ...items.filter(i=>i.result).map((item,idx)=>{
      const s=item.spec,r=item.result;
      return[idx+1,s.material_code,s.product,`${s.L}×${s.W}×${s.H} (${s.dimType})`,
        s.ply,`${s.flute_F1||"—"}${s.flute_F2?"/"+s.flute_F2:""}`,
        s.spec_bs||"—",s.spec_bct||"—",r.calcMOQ,r.finalRate,qty,+(r.finalRate*qty).toFixed(2)];
    }),
    [""],["COMMERCIAL TERMS:"],
    ["Payment","30 days from invoice"],["Freight","FCL basis — included in rate"],
    ["Unloading","Customer's account"],["GST","Extra at actual"],
    ["Lead Time","First: 10–15 working days | Repeat: 3–7 working days"],
    ["Validity","Current quarter — subject to paper price movement"],
  ];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(offerRows),"OFFER");

  // ── RATE MASTER sheet ─────────────────────────────────────────────────────
  const rmRows=[
    ["PAPER RATE MASTER","","","","",""],
    ["Grade Code","Grade Description","Paper Price (Rs/kg)","Credit Cost (Rs/kg)","Discount (Rs/kg)","Freight (Rs/kg)","Effective Rate (Rs/kg)"],
    ...rates.map(r=>[r.code,r.desc,r.price,+(r.price*CREDIT_PCT).toFixed(2),r.disc,(r.freight||0),+(r.price+r.price*CREDIT_PCT-(r.disc||0)+(r.freight||0)).toFixed(2)]),
    [""],["GSM SURCHARGE: <100 GSM=+4 | =100 GSM=+1.5 (FIXED) | >200 GSM=+1 | else 0"],
  ];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rmRows),"RATE MASTER");

  // ── DEFAULTS sheet ────────────────────────────────────────────────────────
  const defRows=[
    ["FREIGHT RATE MATRIX (Rs/kg)","","Nagpur","Pune","Kolkata"],
    ...(locations||LOCATIONS).map(loc=>["",loc,...PLANTS.map(p=>freight[p]?.[loc]||0)]),
    [""],["TAKE-UP FACTORS","Flute","Rulebook Default"],
    ...Object.entries(TAKEUP).map(([f,v])=>["",f,v]),
  ];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(defRows),"DEFAULTS");

  const _dx=new Date();const fname=`CFB_Quote_${(firstSpec.client||"New").replace(/\s/g,"_")}_${_dx.getFullYear()}${String(_dx.getMonth()+1).padStart(2,"0")}${String(_dx.getDate()).padStart(2,"0")}.xlsx`;
  XLSX.writeFile(wb,fname);
};


/* ═══ TEMPLATE-BASED EXPORT ═══════════════════════════════════════════════
   Loads master xlsx template from state/localStorage, fills data cells only.
   All formulas, formatting and cross-sheet references stay intact.
   Falls back to basic SheetJS export if no template stored.
═══════════════════════════════════════════════════════════════════════════ */
// R-1: single authoritative add-ons injection — replaces three identical inline blocks.
// buildSpecFromRow (costing.js) does not accept row.addOns; callers must inject them.
// Extracting here means a new add-on field is added in exactly one place.
const applyAddOns=(sp,row)=>{
  const ao=row.addOns||{};
  sp.printing  =+(ao.printing  ||0);
  sp.stitching =+(ao.stitching ||0);
  sp.coating   =+(ao.coating   ||0);
  sp.handling  =+(ao.handling  ||0);
  sp.moqCharge =+(ao.moqCharge ||0);
  sp.packing   =+(ao.packing   ||0);
  sp.other     =+(ao.other     ||0);
  sp.unloading =+(ao.unloading ||0);
  return sp;
};

// R-2: single authoritative PP-type predicate.
// "PP item" = a flat-sheet corrugated piece (Plate or Partition) that uses PP waste%,
// PP conv rate, and marginPP. All six inline three-way ORs replaced with this call.
// To add a new PP row type, change it here only.
const isPPType=(itemType)=>
  itemType==="Plate"||itemType==="Part-L"||itemType==="Part-W";

const exportFromTemplate=async(items,rates,freight,templateB64Arg,meta={},onError)=>{
  // Fix 8: outer try/catch — surface any export failure visibly rather than silently.
  // onError is an optional callback (receives message string) for the caller to show a toast.
  try{
  const _dX=new Date();
  const _dtStr=`${_dX.getFullYear()}${String(_dX.getMonth()+1).padStart(2,'0')}${String(_dX.getDate()).padStart(2,'0')}`;
  const f0exp=items[0]?.spec||{};
  const fnameExp=`CFB_Quote_${(f0exp.client||'New').replace(/\s/g,'_')}_${_dtStr}.xlsx`;

  // Try Python export server first (full openpyxl formatting preserved)
  try{
    const resp=await apiFetch('/export',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({items,rates,freight,
        marginPP:meta.marginPP??8,           // PP margin — separate from Box margin in items[0].spec.margin
        filename:fnameExp,quoteRef:meta.quoteRef||'',makerName:meta.makerName||'',
        quoteDate:meta.quoteDate||'',effectiveFrom:meta.effectiveFrom||'',effectiveTo:meta.effectiveTo||''}),
      signal:(()=>{const c=new AbortController();setTimeout(()=>c.abort(),30000);return c.signal;})()
    });
    if(resp.ok){
      const blob=await resp.blob();
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=fnameExp;
      document.body.appendChild(a);a.click();
      setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},200);
      return;
    }
  }catch(e){console.warn('Python server unavailable, using xlsx-js-style:',e.message);}

  // Fallback: xlsx-js-style template clone
  let tmplB64=templateB64Arg;
  if(!tmplB64){try{tmplB64=localStorage.getItem('cbb_template');}catch(e){}}
  if(!tmplB64){exportExcelFull(items,rates,freight);return;}

  // Decode to ArrayBuffer
  const binStr=atob(tmplB64);
  const buf=new Uint8Array(binStr.length);
  for(let i=0;i<binStr.length;i++)buf[i]=binStr.charCodeAt(i);
  const wb=XLSX.read(buf,{type:'array',cellStyles:true,cellDates:true});
  const ws_rm=wb.Sheets['RATE MASTER'];
  const ws_def=wb.Sheets['DEFAULTS'];
  const ws_cbb=wb.Sheets['CBB+PP'];
  if(!ws_cbb){exportExcelFull(items,rates,freight);return;}

  // Helper: update cell value in-place — preserves style, removes formula
  const sc=(ws,addr,val)=>{
    if(!ws[addr])ws[addr]={};
    const cell=ws[addr];
    delete cell.f;delete cell.w;delete cell.r;
    if(val===''||val===null||val===undefined){cell.t='s';cell.v='';}
    else if(val instanceof Date){cell.t='d';cell.v=val;cell.z='DD-MMM-YY';}
    else if(typeof val==='number'){cell.t='n';cell.v=val;}
    else{cell.t='s';cell.v=String(val);}
  };

  // ── Update RATE MASTER prices and discounts ─────────────────────────────
  if(ws_rm){
    for(let r=7;r<=30;r++){
      const codeCell=ws_rm[`A${r}`];
      if(!codeCell?.v)continue;
      const code=String(codeCell.v).trim();
      const appRate=rates.find(x=>x.code===code);
      if(appRate){
        sc(ws_rm,`C${r}`,appRate.price);   // Paper Price
        sc(ws_rm,`E${r}`,appRate.disc);
        sc(ws_rm,`F${r}`,appRate.freight||0);  // Incoming Freight (col F)
        // D (credit cost =C*$B$4) and F (effective rate =C+D-E) keep their formulas
      }
    }
  }

  // ── Update DEFAULTS freight matrix (T=Kolkata, U=Nagpur, V=Pune) ────────
  if(ws_def){
    const PCOL={Kolkata:'T',Nagpur:'U',Pune:'V'};
    for(let r=4;r<=18;r++){
      const locCell=ws_def[`S${r}`];
      if(!locCell?.v)continue;
      const loc=String(locCell.v).trim();
      Object.entries(PCOL).forEach(([plant,col])=>{
        const rv=freight[plant]?.[loc];
        if(rv!==undefined)sc(ws_def,`${col}${r}`,rv);
      });
    }
  }

  // ── CBB+PP header ────────────────────────────────────────────────────────
  const f0=items[0]?.spec||{};
  sc(ws_cbb,'D2',f0.client||'');         // Client name
  sc(ws_cbb,'B2',f0.delivery||'');       // Client plant (delivery location)
  sc(ws_cbb,'B3',f0.plant||'Nagpur');    // Avadhoot producing plant
  sc(ws_cbb,'D3',f0.sector||'');         // Sector
  sc(ws_cbb,'B4',meta.quoteDate?new Date(meta.quoteDate):new Date());
  // A1 fix: removed dead/crashing line that used bare `effectiveFrom`/`quoteRef` variables not in scope.
  // The correct write below uses meta.quoteRef (always present via the meta object).
  sc(ws_cbb,'D4',(meta.quoteRef?meta.quoteRef+' | ':'')+items.map(i=>i.spec.material_code).filter(Boolean).join(', '));

  // Rate parameters — column addresses verified against v7 CBB+PP row 3/4/6
  const _nv=(v,d)=>(v!==null&&v!==undefined&&v!==''?+v:d);
  const _marginPP=_nv(meta.marginPP??f0.marginPP,8);
  sc(ws_cbb,'BA3',_nv(f0.convRate,7));       // BA3=Conv Cost RS4 (Rs/kg)
  // FIX: AY4/BA4 must use the PP row's actual effective waste%/conv, not the Box row (f0).
  // Find the first PP item to read its applied wastePP/convRatePP; fall back to defaults.
  const _ppItem=items.find(i=>isPPType(i.spec.rowType)) // R-2;
  const _ppSpec=_ppItem?.spec||{};
  sc(ws_cbb,'BA4',_nv(_ppSpec.convRatePP??f0.convRatePP,12.5));  // BA4=Conv Cost Board/PP (Rs/kg)
  sc(ws_cbb,'AY3',_nv(f0.waste,5)/100);      // AY3=Waste% decimal (RS4)
  sc(ws_cbb,'AY4',_nv(_ppSpec.wastePP??_ppSpec.waste??f0.wastePP??f0.waste,5)/100); // AY4=Waste% decimal (Board/PP) — uses PP row's applied value
  sc(ws_cbb,'BJ3',_nv(f0.interest,0.5)/100); // BJ3=Interest% decimal
  sc(ws_cbb,'BJ4',_nv(f0.interest,0.5)/100); // BJ4=same for PP rows
  sc(ws_cbb,'BM3',_nv(f0.margin,8)/100);     // BM3=Box margin decimal
  sc(ws_cbb,'BM4',_marginPP/100);             // BM4=PP margin decimal
  // Freight override — BK3 has VLOOKUP formula; only override if explicitly set
  if(f0.freightOverride!==''&&f0.freightOverride!=null)sc(ws_cbb,'BK3',_nv(f0.freightOverride,0));

  // Row 3 = RS4 add-on defaults; Row 4 = Board/PP defaults (zero)
  // BB=Printing, BC=Stitching, BD=Coating, BE=Handling, BF=MOQCharge, BG=Packing, BH=Other, BI=Unloading
  const rs4i=items.find(i=>(!i.spec.rowType||i.spec.rowType==='Box'));
  const rs4s=rs4i?.spec||{};
  ['BB','BC','BD','BE','BF','BG','BH','BI'].forEach(col=>sc(ws_cbb,`${col}4`,0));
  sc(ws_cbb,'BB3',+rs4s.printing||0);  sc(ws_cbb,'BC3',+rs4s.stitching||0);
  sc(ws_cbb,'BD3',+rs4s.coating||0);   sc(ws_cbb,'BE3',+rs4s.handling||0);
  sc(ws_cbb,'BF3',+rs4s.moqCharge||0); sc(ws_cbb,'BG3',+rs4s.packing||0);
  sc(ws_cbb,'BH3',+rs4s.other||0);     sc(ws_cbb,'BI3',+rs4s.unloading||0);

  // ── Data rows 7+ ─────────────────────────────────────────────────────────
  const DATA_START=7;
  items.forEach((item,idx)=>{
    const r=DATA_START+idx;
    const s=item.spec;
    const res=item.result;   // calcCosting result — contains deckle, cutting already trim-adjusted
    const isRS4=!s.rowType||s.rowType==='Box';
    const _isPP=isPPType(s.rowType); // R-2

    // Identity
    sc(ws_cbb,`B${r}`,s.rowType||'Box');
    sc(ws_cbb,`C${r}`,s.material_code||'');
    sc(ws_cbb,`D${r}`,s.product||'');
    sc(ws_cbb,`E${r}`,s.delivery||f0.delivery||'');

    // Dimensions — Issue 3 fix: write effective L/W/H for ALL row types directly.
    // No Excel formulas needed. For PP/Plate/Partition rows, s.L and s.W already
    // hold the resolved effective values (set by autoCalcPPDims in sendAllToQuoteItems).
    // H is blank for flat PP pieces — they are 2-dimensional only.
    sc(ws_cbb,`F${r}`,+s.L||'');
    sc(ws_cbb,`G${r}`,+s.W||'');
    sc(ws_cbb,`H${r}`,_isPP?'':(+s.H||''));
    // ── v7 CBB+PP column reference (DO NOT WRITE to formula columns) ──────────
    // T  = Calc GSM  — auto-formula from AD–AM layer inputs; never overwrite
    // BR = SET Code  — app writes this
    // BS = Nos/Set   — app writes this; required for SET rate assembly in template
    sc(ws_cbb,`BR${r}`,s.setCode||'');
    sc(ws_cbb,`BS${r}`,+s.qtyPerSet||1);

    // Box setup
    sc(ws_cbb,`I${r}`,s.boxType||'RSC');
    sc(ws_cbb,`J${r}`,+s.ply||5);
    sc(ws_cbb,`K${r}`,+s.ups||1);

    // Board specifications
    sc(ws_cbb,`S${r}`,+s.board_gsm||'');
    sc(ws_cbb,`U${r}`,+s.spec_bs||'');
    sc(ws_cbb,`W${r}`,+s.spec_bct||'');
    sc(ws_cbb,`X${r}`,+s.spec_ect||'');

    // Flutes — AB=F1 Flute, AC=F2 Flute (verified v7 col 6)
    sc(ws_cbb,`AB${r}`,s.flute_F1||'');
    sc(ws_cbb,`AC${r}`,s.flute_F2||'');

    // Paper layers — AD/AE=TOP, AF/AG=F1, AH/AI=L1, AJ/AK=F2, AL/AM=L2 (verified v7)
    const lyr=s.layers||{};
    sc(ws_cbb,`AD${r}`,lyr.TOP?.code||'');  sc(ws_cbb,`AE${r}`,+lyr.TOP?.gsm||'');
    sc(ws_cbb,`AF${r}`,lyr.F1?.code||'');   sc(ws_cbb,`AG${r}`,+lyr.F1?.gsm||'');
    sc(ws_cbb,`AH${r}`,lyr.L1?.code||'');   sc(ws_cbb,`AI${r}`,+lyr.L1?.gsm||'');
    sc(ws_cbb,`AJ${r}`,lyr.F2?.code||'');   sc(ws_cbb,`AK${r}`,+lyr.F2?.gsm||'');
    sc(ws_cbb,`AL${r}`,lyr.L2?.code||'');   sc(ws_cbb,`AM${r}`,+lyr.L2?.gsm||'');

    // Per-item add-on costs — BB-BI (verified v7 row 6)
    sc(ws_cbb,`BB${r}`,+s.printing||0);  sc(ws_cbb,`BC${r}`,+s.stitching||0);
    sc(ws_cbb,`BD${r}`,+s.coating||0);   sc(ws_cbb,`BE${r}`,+s.handling||0);
    sc(ws_cbb,`BF${r}`,+s.moqCharge||0); sc(ws_cbb,`BG${r}`,+s.packing||0);
    sc(ws_cbb,`BH${r}`,+s.other||0);     sc(ws_cbb,`BI${r}`,+s.unloading||0);
    // Per-item margin — BM column; write override when row differs from profile margin
    const _itemMargin=_nv(s.margin,8);
    const _isPPRow=isPPType(s.rowType); // R-2
    const _profileMgn=_isPPRow?_marginPP:_nv(f0.margin,8);
    if(Math.abs(_itemMargin-_profileMgn)>0.001)sc(ws_cbb,`BM${r}`,_itemMargin/100);
    else if(_isPPRow)sc(ws_cbb,`BM${r}`,_marginPP/100);
  });

  // ── Clear remaining sample rows (template has data in rows 7-10) ─────────
  // T is a formula column (Calc GSM) — never included in CLEAR_COLS.
  const CLEAR_COLS=['B','C','D','E','F','H','I','J','K',
    'S','U','W','X','AB','AC','AD','AE','AF','AG','AH','AI','AJ','AK','AL','AM',
    'BB','BC','BD','BE','BF','BG','BH','BI','BM','BR','BS'];
  for(let r=DATA_START+items.length;r<=50;r++){
    CLEAR_COLS.forEach(col=>{
      const addr=`${col}${r}`;
      if(ws_cbb[addr]&&ws_cbb[addr].v!==undefined&&ws_cbb[addr].v!==''){
        sc(ws_cbb,addr,'');
      }
    });
  }

  // ── Download ─────────────────────────────────────────────────────────────
  const fname=fnameExp;
  XLSX.writeFile(wb,fname);
  // Fix 8: close outer try/catch
  }catch(exportErr){
    console.error('[exportFromTemplate] Export failed:',exportErr);
    const msg=`❌ Export failed: ${exportErr.message||'Unknown error'}. Check the browser console for details.`;
    if(onError)onError(msg);
    else alert(msg);
  }
};

const exportPDF=(spec,result)=>{
  const r=result;if(!r)return;
  const today=new Date().toLocaleDateString("en-IN");
  const html=`<html><head><style>body{font-family:'Segoe UI',sans-serif;margin:32px;color:#1C2B3A;font-size:13px}
h1{color:#D97B2E;font-size:22px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:12px 0}
th{background:#1C2B3A;color:white;padding:7px 10px;font-size:11px;text-align:left}
td{padding:7px 10px;border-bottom:1px solid #DDD4C7}
.final{background:#D97B2E;color:white;border-radius:8px;padding:14px 18px;display:flex;justify-content:space-between;margin:16px 0}
.terms{font-size:10px;color:#4A647D;line-height:1.7;border-top:1px solid #DDD4C7;padding-top:10px}
</style></head><body>
<div style="display:flex;align-items:center;gap:16px;margin-bottom:6px">
    <img src="${LOGO_WIDE_B64}" style="height:36px;object-fit:contain"/>
    <span style="font-size:26px;font-weight:900;letter-spacing:0.05em;color:#1C2B3A">QUOTATION</span>
    </div><div style="color:#4A647D;font-size:11px;margin-bottom:20px">Avadhoot Packaging Solutions · ${today}</div>
<table>${[["To",spec.client||"—"],["Product",spec.product||"—"],["Material Code",spec.material_code||"—"],
["Dimensions",`${spec.L}×${spec.W}×${spec.H} mm (${spec.dimType||"ID"})`],
["Construction",`${spec.ply}-ply · ${spec.flute_F1||"—"}${spec.flute_F2?"/"+spec.flute_F2:""} flute · ${spec.boxType}`],
["Board GSM",`Std: ${spec.board_gsm||"—"} / Calc: ${r.calcGSM}`],
["BS NLT",`Std: ${spec.spec_bs||"—"} / Calc: ${r.calcBS} kg/cm²`],
spec.spec_bct?["BCT/CS NLT",`${spec.spec_bct} kgf`]:null,
].filter(Boolean).map(([k,v])=>`<tr><td style="color:#4A647D;width:160px">${k}</td><td>${v}</td></tr>`).join("")}</table>
<div class="final"><div><div style="font-size:26px;font-weight:800">₹${r.finalRate.toFixed(2)}</div>
<div style="font-size:11px;opacity:.8">Landed Rate per Box · Excl. GST</div></div>
<div style="text-align:right;font-size:13px"><div>₹${r.ratePerKg.toFixed(2)} / kg</div>
<div style="font-weight:700;margin-top:4px">MOQ: ${r.calcMOQ.toLocaleString()} boxes</div></div></div>
<div class="terms">Payment: ${spec.paymentDisc||"30"} days · Freight: FCL included · Unloading: Customer's account ·
GST extra at actual · Lead time first: 10–15 days, repeat: 3–7 days · Validity: current quarter</div>
</body></html>`;
  const w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(()=>w.print(),400);
};

// Re-import: parse Excel back to items
// Fix ①: added meta={} parameter so quoteRef, paymentDisc, and effectiveTo reach the live PDF.
// Previously these were hard-coded. exportPDF (single-SKU from Costing) uses dead code since Fix 13.
const exportAllPDF=(items,meta={})=>{
  if(!items.length)return;
  const client=items[0]?.spec.client||"Client";
  const today=new Date().toLocaleDateString("en-IN");
  const payDisc=meta.paymentDisc||items[0]?.spec?.paymentDisc||"30";
  const validLine=meta.effectiveTo
    ?`Rates valid until ${new Date(meta.effectiveTo).toLocaleDateString("en-IN")}, subject to review on paper price movement.`
    :"Rates valid for current quarter, subject to review on paper price movement.";
  // Group by SET for PDF
  const setMapPDF={};const standalonePDF=[];
  items.filter(i=>i.result).forEach(item=>{
    const sc=(item.spec.setCode||"").trim().toUpperCase();
    if(sc){if(!setMapPDF[sc])setMapPDF[sc]=[];setMapPDF[sc].push(item);}
    else standalonePDF.push(item);
  });
  let srNo=0;
  const itemRowHTML=item=>{
    const s=item.spec,r=item.result;srNo++;
    return`<tr>
      <td style="padding:6px 10px">${srNo}</td>
      <td style="padding:6px 10px;font-family:monospace;font-size:11px">${s.material_code||"—"}${s.rowType!=="Box"?` <span style="font-size:9px;color:#4A647D">(${s.rowType})</span>`:""}</td>
      <td style="padding:6px 10px"><strong>${s.product||"—"}</strong></td>
      <td style="padding:6px 10px;font-family:monospace">${s.L}×${s.W}${s.H?"×"+s.H:""} (${s.dimType||"ID"})</td>
      <td style="padding:6px 10px">${s.ply}-ply ${s.flute_F1||"—"}${s.flute_F2?"/"+s.flute_F2:""} ${s.boxType}</td>
      <td style="padding:6px 10px">${s.spec_bs?"BS≥"+s.spec_bs:"—"}${s.spec_bct?" / BCT≥"+s.spec_bct+" kgf":""}</td>
      <td style="padding:6px 10px;text-align:right;font-family:monospace">${r.calcMOQ.toLocaleString()}</td>
      <td style="padding:6px 10px;text-align:right;font-weight:800;color:#D97B2E;font-size:14px;font-family:monospace">₹${r.finalRate.toFixed(2)}</td>
    </tr>`;};
  const setHdrHTML=sc=>`<tr style="background:#2E4057"><td colspan="8" style="padding:6px 10px;color:#D97B2E;font-weight:700;font-size:11px">
    📦 SET: ${sc} — combined rate: <span style="font-family:monospace">₹${setMapPDF[sc].reduce((s,i)=>s+i.result.finalRate*(+(i.spec.qtyPerSet)||1),0).toFixed(2)}/set</span></td></tr>`;
  const setFtrHTML=(sc,sitems)=>`<tr style="background:#EBE3D8"><td colspan="7" style="padding:4px 10px;font-weight:600;font-size:10px;color:#2E4057">SET ${sc} total</td>
    <td style="padding:4px 10px;text-align:right;font-weight:800;font-family:monospace;color:#B5641F">₹${sitems.reduce((s,i)=>s+i.result.finalRate*(+(i.spec.qtyPerSet)||1),0).toFixed(2)}</td></tr>`;
  const rows=standalonePDF.map(itemRowHTML).join("")
    +Object.entries(setMapPDF).map(([sc,si])=>setHdrHTML(sc)+si.map(itemRowHTML).join("")+setFtrHTML(sc,si)).join("");
  const w=window.open("","_blank");
  w.document.write(`<html><head><style>
    body{font-family:'Segoe UI',sans-serif;margin:32px;color:#1C2B3A;font-size:12px}
    h1{color:#D97B2E;font-size:20px;margin:0 0 4px}
    .meta{display:flex;justify-content:space-between;margin-bottom:24px;color:#4A647D;font-size:11px}
    table{width:100%;border-collapse:collapse;margin:12px 0}
    th{background:#1C2B3A;color:white;padding:8px 10px;font-size:10px;text-align:left;font-weight:600}
    td{border-bottom:1px solid #DDD4C7}
    tr:nth-child(even){background:#FAF7F2}
    .terms{font-size:10px;color:#4A647D;line-height:1.8;border-top:2px solid #D97B2E;padding-top:12px;margin-top:24px}
    @media print{body{margin:16px}}
  </style></head><body>
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:6px">
    <img src="${LOGO_WIDE_B64}" style="height:36px;object-fit:contain"/>
    <span style="font-size:26px;font-weight:900;letter-spacing:0.05em;color:#1C2B3A">QUOTATION</span>
    </div>
    <div style="color:#4A647D;font-size:11px;margin-bottom:2px">Avadhoot Packaging Solutions</div>
    <div class="meta">
      <div><strong>To:</strong> ${client}${meta.quoteRef?` &nbsp;|&nbsp; <strong>Ref:</strong> ${meta.quoteRef}`:""}</div>
      <div><strong>Date:</strong> ${today} &nbsp;|&nbsp; <strong>Items:</strong> ${items.filter(i=>i.result).length}${meta.makerName?` &nbsp;|&nbsp; <strong>Prepared by:</strong> ${meta.makerName}`:""}</div>
    </div>
    <table><thead><tr>
      <th>#</th><th>Material Code</th><th>SKU Description</th><th>Dimensions (mm)</th>
      <th>Construction</th><th>Spec (BS / BCT)</th><th style="text-align:right">MOQ (boxes)</th>
      <th style="text-align:right">Landed Rate (Rs/box, excl GST)</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <div class="terms">
      <strong>Terms &amp; Conditions:</strong><br/>
      1. Rates are LANDED and EXCLUDE GST (applicable at prevailing rates).<br/>
      2. Orders on MOQ per SKU and Full Container Load (FCL) per delivery.<br/>
      3. Payment terms: ${payDisc} days from date of invoice (unless otherwise agreed).<br/>
      4. Unloading at delivery site is on customer account.<br/>
      5. First delivery: 10–15 working days. Repeat orders: 3–7 working days.<br/>
      6. ${validLine}
    </div>
  </body></html>`);
  w.document.close();setTimeout(()=>w.print(),400);
};

const parseImportedExcel=async(file,rates,freight,boxTrimData)=>{
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

/* ═══ PART 2 — AI ASSIST (isolated, optional) ══════════════════════════════ */
// ── AI ASSIST — DISABLED ─────────────────────────────────────────────────────
// AI features (PDF extraction and construction suggestion) are intentionally
// disabled to prevent unintended API token usage. All costing remains in the
// pure-formula engine (costing.js). Re-enable by restoring callAPI + prompts.
const toB64=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(f);});

/* ═══ UI PRIMITIVES ═════════════════════════════════════════════════════════ */
const inputSt={width:"100%",padding:"5px 8px",borderRadius:5,border:`1px solid ${C.border}`,
  fontSize:12,color:C.slate,background:C.white,boxSizing:"border-box",fontFamily:sans};
const Inp=({value,onChange,placeholder,type="text",st={},step})=>
  <input value={value??""} type={type} step={step} onChange={e=>onChange(e.target.value)}
    placeholder={placeholder} style={{...inputSt,...st}}/>;
const Sel=({value,onChange,opts,ph=""})=>
  <select value={value??""} onChange={e=>onChange(e.target.value)}
    style={{...inputSt,color:(value!==undefined&&value!==null&&value!=="")?C.slate:C.slateL}}>
    {ph&&<option value="">{ph}</option>}
    {opts.map(o=><option key={o.v??o} value={o.v??o}>{o.l??o}</option>)}
  </select>;
const Btn=({ch,onClick,v="primary",sm,full,disabled,style:sx={}})=>{
  const vs={primary:{background:C.amber,color:C.white},
    secondary:{background:C.white,color:C.slateM,border:`1px solid ${C.border}`},
    ghost:{background:"transparent",color:C.slateL,border:"none"},
    success:{background:C.green,color:C.white},danger:{background:C.red,color:C.white},
    info:{background:"#2E6094",color:C.white}};
  return<button onClick={disabled?undefined:onClick} style={{
    padding:sm?"5px 12px":"8px 16px",borderRadius:6,fontSize:sm?11:13,fontWeight:600,
    cursor:disabled?"not-allowed":"pointer",border:"none",width:full?"100%":"auto",
    opacity:disabled?.45:1,...vs[v],...sx}}>{ch}</button>;
};
const SH=({title,sub})=>(
  <div style={{borderBottom:`1px solid ${C.amber}`,paddingBottom:3,marginBottom:8}}>
    <div style={{fontSize:9,fontWeight:700,color:C.amber,textTransform:"uppercase",letterSpacing:"0.09em"}}>{title}</div>
    {sub&&<div style={{fontSize:10,color:C.slateL,marginTop:1}}>{sub}</div>}
  </div>);
const FR=({label,required,children,hint,cols})=>(
  <div style={{marginBottom:5}}>
    <label style={{fontSize:10,fontWeight:600,color:C.slateM,textTransform:"uppercase",
      letterSpacing:"0.06em",display:"block",marginBottom:3}}>
      {label}{required&&<span style={{color:C.red}}> *</span>}</label>
    {cols?<div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:6}}>{children}</div>:children}
    {hint&&<div style={{fontSize:10,color:C.slateL,marginTop:2}}>{hint}</div>}
  </div>);
const KN=({label,val,hl,sub})=>(
  <div style={{textAlign:"center",padding:"9px 6px",background:hl?C.amber:C.white,
    borderRadius:7,border:`1px solid ${hl?"transparent":C.border}`}}>
    <div style={{fontSize:hl?17:14,fontWeight:800,color:hl?C.white:C.slate,fontFamily:mono}}>{val||"—"}</div>
    {sub&&<div style={{fontSize:9,color:hl?"rgba(255,255,255,.7)":C.slateL,marginTop:1}}>{sub}</div>}
    <div style={{fontSize:9,fontWeight:600,color:hl?"rgba(255,255,255,.6)":C.slateL,
      marginTop:2,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</div>
  </div>);

/* ═══ MAIN APP ═══════════════════════════════════════════════════════════════ */

// ── BoxDieline: Live 2D die-line SVG from L×W×H + box type ──────────────────
// Renders a flat blank approximation. All dimensions derived, no external files.
// Flap height = min(W/2, H) for RSC/HRSC. Die-cut represented as rounded rect.
// KLD note: for die-cut SKUs, this is a reference approximation only.
// Actual KLD from customer supersedes.
function BoxDieline({L,W,H,boxType,dimType,ups,style={}}){
  const l=parseFloat(L)||0,w=parseFloat(W)||0,h=parseFloat(H)||0;
  if(!l||!w||!h)return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",
      height:160,background:"#F8F8F8",borderRadius:6,border:"1px dashed #CCC",
      fontSize:11,color:"#999",flexDirection:"column",gap:4,...style}}>
      <span>📦</span><span>Enter L×W×H to preview die-line</span>
    </div>);

  const isBoard=boxType==="Board"||boxType==="PP";
  const isCustom=boxType==="Custom";
  const isDie=boxType==="Die-R"||boxType==="Die-S";
  const isHRSC=boxType==="HRSC-L"||boxType==="HRSC-R"||boxType==="HRSC-O";
  const isRSC=!isBoard&&!isCustom&&!isDie&&!isHRSC;

  // Flat blank overall size:
  // RSC blank = (2L+2W) wide × (H + 2*flapH) tall
  // HRSC blank = (2L+2W) wide × (H + flapH) tall (bottom flaps only)
  // Flap height = min(W/2, H) per RSC standard
  const flapH=Math.min(w/2,h);
  const glueLap=Math.max(w*0.1,15); // glue lap ≈ 10% of W min 15mm

  // Blank dimensions (mm)
  let blankW, blankH;
  if(isBoard||isCustom||isDie){
    blankW=l; blankH=w; // simple rectangle or die approximation
  } else if(isHRSC){
    blankW=2*l+2*w+glueLap; blankH=h+flapH;
  } else {
    // RSC
    blankW=2*l+2*w+glueLap; blankH=h+2*flapH;
  }

  // SVG canvas — scale to fit 300×180 with 10px padding
  const PAD=12;
  const maxSVGW=300, maxSVGH=180;
  const scaleX=(maxSVGW-2*PAD)/blankW;
  const scaleY=(maxSVGH-2*PAD)/blankH;
  const sc=Math.min(scaleX,scaleY,1.2); // cap upscale to 1.2×
  const svgW=Math.round(blankW*sc+2*PAD);
  const svgH=Math.round(blankH*sc+2*PAD);

  const px=(mm)=>Math.round(mm*sc+PAD); // mm→px offset from origin
  const pw=(mm)=>Math.round(mm*sc);     // mm→px width/height

  // Colours
  const CUT="#444";    // cut line
  const FOLD="#888";   // fold/score line (dashed)
  const FILL="#F5F0E8";// blank fill
  const GLUE="#E8F5E8";// glue lap fill
  const FLAP="#F0F5FF";// flap fill
  const KLD="#E53E3E";  // KLD note colour
  const strokeW=1;

  const foldDash="3,3";

  // ── RSC panels: [leftFlap | leftPanel | frontPanel | rightPanel | glueLap] ──
  // leftPanel=W, frontPanel=L, rightPanel=W, leftFlap=L, glueLap
  // We'll lay out: glueLap at x=0, then W, L, W, L
  // Standard orientation: glue at left edge

  const x0=PAD;
  const y0=PAD;
  const yFlap=y0;                    // top flaps start
  const yBody=y0+(isHRSC?0:pw(flapH));  // body starts (RSC has top flaps above)
  const yBotFlap=yBody+pw(h);        // bottom flaps start

  // panel X positions
  const xGlue=x0;
  const xP1=xGlue+pw(glueLap);      // left (W) panel
  const xP2=xP1+pw(w);              // front (L) panel
  const xP3=xP2+pw(l);              // right (W) panel
  const xP4=xP3+pw(w);              // back (L) panel

  const totalW=pw(glueLap)+pw(w)+pw(l)+pw(w)+pw(l);

  if(isBoard||isCustom){
    // Simple rectangle
    return(
    <svg width={svgW} height={svgH} style={{display:"block",...style}}>
      <rect x={x0} y={y0} width={pw(l)} height={pw(w)} fill={FILL} stroke={CUT} strokeWidth={strokeW}/>
      {isCustom&&<text x={x0+pw(l)/2} y={y0+pw(w)/2} textAnchor="middle" dominantBaseline="middle"
        fontSize={11} fill="#AAA">Custom KLD</text>}
      <text x={x0} y={y0+pw(w)+10} fontSize={8} fill="#888">{l}×{w} mm</text>
    </svg>);
  }

  if(isDie){
    // Approximation: outer cut (rounded rect) with fold lines for walls
    const cr=Math.min(pw(20),pw(w)*0.2);
    return(
    <svg width={svgW} height={svgH} style={{display:"block",...style}}>
      <rect x={x0} y={y0} width={pw(l)} height={pw(w)} rx={cr} ry={cr}
        fill={FILL} stroke={CUT} strokeWidth={strokeW}/>
      {/* Inner fold lines suggesting panel layout */}
      <line x1={x0+pw(h)} y1={y0} x2={x0+pw(h)} y2={y0+pw(w)} stroke={FOLD} strokeWidth={strokeW} strokeDasharray={foldDash}/>
      <line x1={x0+pw(h)+pw(l-2*h)} y1={y0} x2={x0+pw(h)+pw(l-2*h)} y2={y0+pw(w)} stroke={FOLD} strokeWidth={strokeW} strokeDasharray={foldDash}/>
      <line x1={x0} y1={y0+pw(h)} x2={x0+pw(l)} y2={y0+pw(h)} stroke={FOLD} strokeWidth={strokeW} strokeDasharray={foldDash}/>
      <line x1={x0} y1={y0+pw(w)-pw(h)} x2={x0+pw(l)} y2={y0+pw(w)-pw(h)} stroke={FOLD} strokeWidth={strokeW} strokeDasharray={foldDash}/>
      <text x={x0+pw(l)/2} y={y0+pw(w)+10} fontSize={8} fill="#888">{boxType} — approx. KLD only</text>
    </svg>);
  }

  // RSC or HRSC
  const panels=[];

  // ── Glue lap (left edge) ──
  panels.push(<rect key="glue" x={xGlue} y={yBody} width={pw(glueLap)} height={pw(h)}
    fill={GLUE} stroke={CUT} strokeWidth={strokeW}/>);
  panels.push(<text key="glueTxt" x={xGlue+pw(glueLap)/2} y={yBody+pw(h)/2}
    textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="#888" transform={`rotate(-90,${xGlue+pw(glueLap)/2},${yBody+pw(h)/2})`}>Mfg Joint</text>);

  // ── Body panels ──
  [{x:xP1,w_:pw(w),lbl:"W"},{x:xP2,w_:pw(l),lbl:"L"},{x:xP3,w_:pw(w),lbl:"W"},{x:xP4,w_:pw(l),lbl:"L"}].forEach(({x,w_,lbl},i)=>{
    panels.push(<rect key={`body${i}`} x={x} y={yBody} width={w_} height={pw(h)} fill={FILL} stroke={CUT} strokeWidth={strokeW}/>);
    // fold lines between panels (vertical score lines)
    if(i>0)panels.push(<line key={`fold${i}`} x1={x} y1={yBody} x2={x} y2={yBody+pw(h)} stroke={FOLD} strokeWidth={strokeW} strokeDasharray={foldDash}/>);
    // panel dimension label
    panels.push(<text key={`lbl${i}`} x={x+w_/2} y={yBody+pw(h)/2} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="#999">{lbl}</text>);
  });

  // ── Flap height label on first body panel left flap ──
  const flapXcenters=[xP1,xP2,xP3,xP4];
  const flapWidths=[pw(w),pw(l),pw(w),pw(l)];
  const flapHalfH=Math.min(pw(w/2),pw(h)); // flap height in px

  // ── Top flaps (RSC only) ──
  if(!isHRSC){
    flapXcenters.forEach((fx,i)=>{
      const fw=flapWidths[i];
      const fyTop=y0;
      // Trapezoidal top flap: full width at base, narrower at tip for visual
      panels.push(<rect key={`tflap${i}`} x={fx} y={fyTop} width={fw} height={flapHalfH}
        fill={FLAP} stroke={CUT} strokeWidth={strokeW}/>);
      panels.push(<line key={`tfscore${i}`} x1={fx} y1={fyTop+flapHalfH} x2={fx+fw} y2={fyTop+flapHalfH}
        stroke={FOLD} strokeWidth={strokeW} strokeDasharray={foldDash}/>);
    });
  }

  // ── Bottom flaps ──
  flapXcenters.forEach((fx,i)=>{
    const fw=flapWidths[i];
    panels.push(<rect key={`bflap${i}`} x={fx} y={yBotFlap} width={fw} height={flapHalfH}
      fill={FLAP} stroke={CUT} strokeWidth={strokeW}/>);
    panels.push(<line key={`bfscore${i}`} x1={fx} y1={yBotFlap} x2={fx+fw} y2={yBotFlap}
      stroke={FOLD} strokeWidth={strokeW} strokeDasharray={foldDash}/>);
  });

  // ── H dimension label ──
  panels.push(<text key="dimH" x={xGlue-2} y={yBody+pw(h)/2} textAnchor="end" dominantBaseline="middle" fontSize={7} fill="#888" transform={`rotate(-90,${xGlue-4},${yBody+pw(h)/2})`}>{h}mm H</text>);

  // ── Blank total width annotation ──
  const dimY=yBotFlap+flapHalfH+8;

  // ── Legend ──
  const legX=x0, legY=dimY+10;

  return(
    <svg width={Math.max(svgW,totalW+2*PAD+20)} height={legY+18} style={{display:"block",overflow:"visible",...style}}>
      {panels}
      {/* Legend */}
      <line x1={legX} y1={legY+4} x2={legX+14} y2={legY+4} stroke={CUT} strokeWidth={1}/>
      <text x={legX+16} y={legY+7} fontSize={7} fill="#666">Cut</text>
      <line x1={legX+36} y1={legY+4} x2={legX+50} y2={legY+4} stroke={FOLD} strokeWidth={1} strokeDasharray="3,3"/>
      <text x={legX+52} y={legY+7} fontSize={7} fill="#666">Score/fold</text>
      <rect x={legX+98} y={legY} width={8} height={8} fill={FLAP} stroke={CUT} strokeWidth={0.5}/>
      <text x={legX+108} y={legY+7} fontSize={7} fill="#666">Flap</text>
      <rect x={legX+128} y={legY} width={8} height={8} fill={GLUE} stroke={CUT} strokeWidth={0.5}/>
      <text x={legX+138} y={legY+7} fontSize={7} fill="#666">Mfg Joint</text>
      {isDie&&<text x={legX+180} y={legY+7} fontSize={7} fill={KLD}>⚠ Approx — use customer KLD</text>}
    </svg>);
}
// ── end BoxDieline ────────────────────────────────────────────────────────────

export default function App(){
  const{profile,signOut}=useAuth();
  const role=profile?.role||"maker"; // maker | admin | checker — sourced from the logged-in account
  const[showChangePassword,setShowChangePassword]=useState(false);
  const[showProfile,setShowProfile]=useState(false);
  const[sidebarCollapsed,setSidebarCollapsed]=useState(()=>localStorage.getItem('qgos_sidebar_collapsed')==='1');
  useEffect(()=>{try{localStorage.setItem('qgos_sidebar_collapsed',sidebarCollapsed?'1':'0');}catch(e){}},[sidebarCollapsed]);
  const[tab,setTab]=useState("costing");
  const[spec,setSpec]=useState(()=>{
    try{
      const bp=JSON.parse(localStorage.getItem('cbb_batchprofile')||'{"plant":"","delivery":""}');
      return{...INIT_SPEC,plant:bp.plant||"",delivery:bp.delivery||""};
    }catch(e){return{...INIT_SPEC,plant:"",delivery:""};}
  });
  const[setAutoFill,setSetAutoFill]=useState(true); // "Part of a SET" switch — ON=apply existing auto-fill, OFF=leave SetCode blank
  const[costingContext,setCostingContext]=useState("same-batch"); // "same-batch"|"new-batch" — which batch context Costing is currently operating in
  const[rates,setRates]=useState(()=>{try{const s=localStorage.getItem('cbb_rates');return s?JSON.parse(s):DEFAULT_RATES;}catch(e){return DEFAULT_RATES;}});
  const[gyPremLow,setGyPremLow]=useState(1.5);   // GY premium for 16-24 BF grades
  const[gyPremHigh,setGyPremHigh]=useState(0.5);  // GY premium for 28+ BF grades
  const[blanketDisc,setBlanketDisc]=useState(1.5);
  const[blanketInterest,setBlanketInterest]=useState(1.5); // credit cost % for blanket apply
  const[freightBands,setFreightBands]=useState([0,0,0]); // blanket discount applied to all grades
  const[rateUpdatedAt,setRateUpdatedAt]=useState(()=>localStorage.getItem('cbb_rate_date')||'');
  const touchRateDate=()=>{
    const d=new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
    setRateUpdatedAt(d);
    try{localStorage.setItem('cbb_rate_date',d);}catch(e){}
  };
  const[freight,setFreight]=useState(()=>{try{const s=localStorage.getItem('cbb_freight');return s?JSON.parse(s):DEFAULT_FREIGHT;}catch(e){return DEFAULT_FREIGHT;}});
  const[sectors,setSectors]=useState(()=>{
    try{
      const s=localStorage.getItem('cbb_sectors');
      // First run only — no stored data yet: seed from defaults.
      // All subsequent runs use stored data exclusively so deliberate
      // admin deletions (or additions) are never overwritten by defaults.
      if(!s)return DEFAULT_SECTORS_DATA;
      const stored=JSON.parse(s);
      // Deduplicate by code (guards against backup/restore duplicates).
      // Field-merge with defaults so new schema keys propagate to stale backups,
      // but stored values always win — user edits are never silently reverted.
      // The re-seed loop (adding back deleted codes) has been removed: a sector
      // deleted by admin must stay deleted across refreshes.
      const seen=new Set();
      const deduped=[];
      for(const row of stored){
        if(!seen.has(row.code)){
          seen.add(row.code);
          const def=DEFAULT_SECTORS_DATA.find(d=>d.code===row.code)||{};
          deduped.push({...def,...row}); // stored wins; def fills missing keys only
        }
      }
      return deduped.length?deduped:DEFAULT_SECTORS_DATA;
    }catch(e){return DEFAULT_SECTORS_DATA;}
  });
  const[boxTrim,setBoxTrim]=useState(()=>{
    try{
      const s=localStorage.getItem('cbb_boxtrim');
      if(!s)return DEFAULT_BOX_TRIM_DATA;
      const stored=JSON.parse(s);
      // Merge: DEFAULT supplies new keys (PP), stored keys preserve user edits.
      // PP always forced to 0-trim since it's new and 0 is the correct default.
      return{...DEFAULT_BOX_TRIM_DATA,...stored,
        PP:stored.PP??DEFAULT_BOX_TRIM_DATA.PP,          // ensure PP exists with 0 trim
        Custom:{...DEFAULT_BOX_TRIM_DATA.Custom,...(stored.Custom||{})}};  // keep user Custom edits
    }catch(e){return DEFAULT_BOX_TRIM_DATA;}
  });
  const[partitionsMaster,setPartitionsMaster]=useState(()=>{try{const s=localStorage.getItem('cbb_partitions');return s?JSON.parse(s):PARTITIONS_MASTER_DEFAULT;}catch(e){return PARTITIONS_MASTER_DEFAULT;}});
  const[items,setItems]=useState(()=>{try{const s=localStorage.getItem('cbb_quoteitems');return s?JSON.parse(s):[];}catch(e){return[];}}); // saved quote items
  const[savedQuotes,setSavedQuotes]=useState({}); // per-customer saved drafts
  const[aiNotes,setAiNotes]=useState("");
  // A3: locations must be a persisted master — every other master has all three mechanisms.
  // On init: read cbb_locations from localStorage, fallback to hardcoded array, then UNION
  // with location keys found in cbb_freight so already-orphaned rates resurface immediately.
  const DEFAULT_LOCATIONS=["Nagpur","Pune","Kolkata","Haldia","Howrah","Guwahati","Delhi","Ahmedabad","Hyderabad"];
  const[locations,setLocations]=useState(()=>{
    try{
      const stored=localStorage.getItem('cbb_locations');
      const base=stored?JSON.parse(stored):DEFAULT_LOCATIONS;
      // Union with freight keys to resurface any locations that were added before this fix
      const freightStored=localStorage.getItem('cbb_freight');
      const freightKeys=freightStored
        ?Object.values(JSON.parse(freightStored)).flatMap(d=>Object.keys(d||{}))
        :[];
      const union=[...new Set([...base,...freightKeys])].sort();
      return union.length?union:DEFAULT_LOCATIONS;
    }catch(e){return DEFAULT_LOCATIONS;}
  });
  const[newLocation,setNewLocation]=useState("");
  const[newGrade,setNewGrade]=useState({code:"",desc:"",price:"",disc:1.5});
  const importRef=useRef(),templateRef=useRef(),restoreRef=useRef();
  const[templateLoaded,setTemplateLoaded]=useState(false);
  const[toasts,setToasts]=useState([]);
  const showToast=(msg,type='success',dur=2800)=>{
    const id=Date.now();
    setToasts(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),dur);
  };
  const today=new Date().toISOString().split('T')[0];
  const[quoteDate,setQuoteDate]=useState(today);
  const[effectiveFrom,setEffectiveFrom]=useState('');
  const[effectiveTo,setEffectiveTo]=useState('');
  const[quoteRef,setQuoteRef]=useState(()=>{
    const d=new Date();
    return`QR-${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,"0")}-001`;
  });
  const makerName=profile?.display_name||""; // sourced from the logged-in account, not free text
  // ── BATCH ENTRY STATE ─────────────────────────────────────────────────────
  const[batchProfile,setBatchProfile]=useState(()=>{
    try{const s=localStorage.getItem('cbb_batchprofile');return s?JSON.parse(s):{
      client:'',sector:'',plant:'',delivery:'',
      margin:8,marginPP:8,interest:0.5,paymentDisc:'30',freightOverride:'',
      waste:5,convRate:7,wastePP:5,convRatePP:12.5,customerType:'existing',priceContext:'unknown',
    };}catch(e){return{client:'',sector:'',plant:'',delivery:'',
      margin:8,marginPP:8,interest:0.5,paymentDisc:'30',freightOverride:'',
      waste:5,convRate:7,wastePP:5,convRatePP:12.5,customerType:'existing',priceContext:'unknown'};}
  });
  // Persist batchProfile on every change
  useEffect(()=>{try{localStorage.setItem('cbb_batchprofile',JSON.stringify(batchProfile));}catch(e){};},[batchProfile]);

  // ── BACKUP & RESTORE ──────────────────────────────────────────────────────
  // Backup: download all 10 localStorage keys as a single JSON file.
  // Fix 3: cbb_batch_autosave added so batch rows are included in manual JSON backups.
  const BACKUP_KEYS=['cbb_rates','cbb_freight','cbb_sectors','cbb_boxtrim',
    'cbb_partitions','cbb_constrlib','cbb_template',
    'cbb_rate_date','cbb_batchprofile','cbb_quoteitems','cbb_batch_autosave',
    'cbb_locations']; // A3: locations is a persisted master

  const handleBackup=()=>{
    const snap={_version:1,_ts:new Date().toISOString()};
    BACKUP_KEYS.forEach(k=>{try{const v=localStorage.getItem(k);if(v!=null)snap[k]=JSON.parse(v);}catch(e){snap[k]=null;}});
    // Also include current in-memory state for anything not yet flushed to localStorage
    snap.cbb_rates=rates;
    snap.cbb_freight=freight;
    snap.cbb_sectors=sectors;
    snap.cbb_boxtrim=boxTrim;
    snap.cbb_partitions=partitionsMaster;
    snap.cbb_constrlib=constructionLib;
    snap.cbb_batchprofile=batchProfile;
    snap.cbb_locations=locations; // A3
    snap.cbb_quoteitems=items;
    const blob=new Blob([JSON.stringify(snap,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    const d=new Date();
    a.download=`CFB_QOS_Backup_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('✅ Backup downloaded','success');
  };

  const handleRestore=()=>{
    if(!window.confirm('Restore from backup? This will overwrite your current Rate Master, Freight, Sectors, Construction Library, and all other settings. The page will reload after restore.'))return;
    restoreRef.current?.click();
  };

  const handleRestoreFile=async(e)=>{
    const f=e.target.files?.[0];
    if(!f)return;
    try{
      const text=await f.text();
      const snap=JSON.parse(text);
      if(!snap._version)throw new Error('Not a valid CFB QOS backup file');
      BACKUP_KEYS.forEach(k=>{
        if(snap[k]!=null){
          try{
            // cbb_template, cbb_rate_date are stored as raw strings, not JSON.
            // JSON.stringify("abc") produces '"abc"' — the surrounding quotes corrupt base64
            // and string values. Only stringify objects/arrays; pass strings through as-is.
            const v=typeof snap[k]==='string'?snap[k]:JSON.stringify(snap[k]);
            localStorage.setItem(k,v);
          }catch(err){}
        }
      });
      showToast('✅ Backup restored — reloading…','success');
      setTimeout(()=>window.location.reload(),1200);
    }catch(err){showToast('❌ Restore failed: '+err.message,'error');}
    e.target.value=''; // reset input so same file can be re-selected if needed
  };
  // pinnedAddOns: up to 2 add-on keys shown as main grid columns. Persisted.
  const[pinnedAddOns,setPinnedAddOns]=useState(()=>{
    try{const s=localStorage.getItem('cbb_pinned_addons');return s?JSON.parse(s):[];}catch(e){return[];}
  });
  const togglePinAddOn=(k)=>setPinnedAddOns(prev=>{
    const next=prev.includes(k)?prev.filter(x=>x!==k):[...prev,k].slice(-2);
    try{localStorage.setItem('cbb_pinned_addons',JSON.stringify(next));}catch(e){}
    return next;
  });
  // expandedRows: set of row ids that have sub-row open
  const[expandedRows,setExpandedRows]=useState(new Set());
  const toggleRowExpand=(id)=>setExpandedRows(prev=>{
    const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;
  });
  const[constructionLib,setConstructionLib]=useState(()=>{
    try{const s=localStorage.getItem('cbb_constrlib');return s?JSON.parse(s):[];}catch(e){return [];}
  });
  const[batchRows,setBatchRows]=useState([]);
  const[batchResults,setBatchResults]=useState({});
  const[activeBatchRowId,setActiveBatchRowId]=useState(null);
  // specCommitted: true after sendCostingToBatch successfully appends a row,
  // cleared by Start New SKU / Unlink / loadItem / loadBatchRowIntoCosting / New Batch.
  // Session/UI state only — not persisted, not backed up.
  const[specCommitted,setSpecCommitted]=useState(false);
  const[expandedConstr,setExpandedConstr]=useState(null);
  const[constrFilter,setConstrFilter]=useState({sector:'',client:'',status:'active'});
  const[constrQuery,setConstrQuery]=useState('');
  // Slide-over overlay state for Batch Entry (selection-only)
  const[batchConstrOverlay,setBatchConstrOverlay]=useState(false); // overlay open?
  const[batchConstrTargetRowId,setBatchConstrTargetRowId]=useState(null); // which row
  const[batchConstrOverlayQuery,setBatchConstrOverlayQuery]=useState('');
  const[batchConstrOverlayFilter,setBatchConstrOverlayFilter]=useState({sector:'',client:''});
  // Construction Library tab state
  const[clTabQuery,setClTabQuery]=useState('');
  const[clTabFilter,setClTabFilter]=useState({sector:'',client:'',status:'active'});
  const[clTabExpandedConstr,setClTabExpandedConstr]=useState(null);

  // ── AUTO-SAVE: batch rows ─────────────────────────────────────────────────
  // Must be declared AFTER batchRows and batchProfile (both used in dep array).
  const[autosaveBanner,setAutosaveBanner]=useState(()=>{
    try{
      const s=localStorage.getItem('cbb_batch_autosave');
      if(!s)return null;
      const{ts,rows}=JSON.parse(s);
      // Fix ④: extended to 7 days (10080 min). Friday→Monday is 72h; was 480 min (8h).
      // Data stays in localStorage regardless — this only controls banner visibility.
      const ageMin=(Date.now()-ts)/60000;
      if(ageMin>10080||!rows?.length)return null;
      const d=new Date(ts);
      const label=`${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
      return{ts,rows:rows.length,label};
    }catch(e){return null;}
  });
  useEffect(()=>{
    // Fix 3: Never let a smaller/empty batch overwrite a larger valid prior save.
    // Only write if current rows are non-empty AND >= the saved row count (or no prior save exists).
    if(!batchRows.length){
      try{
        const prev=localStorage.getItem('cbb_batch_autosave');
        if(prev){const{rows}=JSON.parse(prev);if(rows?.length>0)return;}
      }catch(e){}
    }
    try{localStorage.setItem('cbb_batch_autosave',JSON.stringify({
      ts:Date.now(),rows:batchRows,profile:batchProfile}));}catch(e){}
  },[batchRows,batchProfile]);
  const restoreAutosave=()=>{
    try{
      const s=localStorage.getItem('cbb_batch_autosave');
      if(!s)return;
      const{rows,profile}=JSON.parse(s);
      if(rows?.length)setBatchRows(rows);
      if(profile)setBatchProfile(p=>({...p,...profile}));
      setAutosaveBanner(null);
      setTab('batch');
      showToast(`✅ Restored ${rows.length} batch row(s) from autosave`,'success');
    }catch(e){showToast('❌ Could not read autosave','error');}
  };

  // Conversational filter parser — no AI tokens, pure local regex/keyword matching.
  // Parses a free-text query like "active alcobev ITC BS>8 GSM 700-750 Cobb 125"
  // and sets the filter state exactly as the dropdowns + range inputs would.
  const parseConstrQuery=(q)=>{
    if(!q.trim()){setConstrFilter({sector:'',client:'',status:'active'});return;}
    const lower=q.toLowerCase();
    const next={sector:'',client:'',status:'active',
      gsm_min:'',gsm_max:'',bs_min:'',bct_min:'',ect_min:'',cobb_max:''};
    // Status
    if(/\barchived\b/.test(lower))next.status='archived';
    else if(/\ball\b/.test(lower))next.status='all';
    else if(/\bactive\b/.test(lower))next.status='active';
    // Sector — match against known sector codes
    const sectorMatch=sectorCodes.find(s=>lower.includes(s.toLowerCase()));
    if(sectorMatch)next.sector=sectorMatch;
    // Client — match against existing clients in library
    const clients=[...new Set(constructionLib.map(c=>c.client||'').filter(Boolean))];
    const clientMatch=clients.find(cl=>lower.includes(cl.toLowerCase()));
    if(clientMatch)next.client=clientMatch;
    // Spec ranges — GSM x-y or GSM>x or GSM>=x
    const gsmRange=q.match(/gsm\s*(\d+)\s*[-–to]+\s*(\d+)/i);
    const gsmMin=q.match(/gsm\s*[>≥>=]+\s*(\d+)/i);
    const gsmMax=q.match(/gsm\s*[<≤<=]+\s*(\d+)/i);
    if(gsmRange){next.gsm_min=gsmRange[1];next.gsm_max=gsmRange[2];}
    else{if(gsmMin)next.gsm_min=gsmMin[1];if(gsmMax)next.gsm_max=gsmMax[1];}
    // BS
    const bsMin=q.match(/bs\s*[>≥>=]+\s*(\d+\.?\d*)/i)||q.match(/bs\s+(\d+\.?\d*)/i);
    if(bsMin)next.bs_min=bsMin[1];
    // BCT
    const bctMin=q.match(/bct\s*[>≥>=]+\s*(\d+\.?\d*)/i)||q.match(/bct\s+(\d+\.?\d*)/i);
    if(bctMin)next.bct_min=bctMin[1];
    // ECT
    const ectMin=q.match(/ect\s*[>≥>=]+\s*(\d+\.?\d*)/i)||q.match(/ect\s+(\d+\.?\d*)/i);
    if(ectMin)next.ect_min=ectMin[1];
    // Cobb — "Cobb 125" or "Cobb<=125" or "Cobb max 125"
    const cobbMax=q.match(/cobb\s*(?:max|[<≤<=]+)?\s*(\d+)/i);
    if(cobbMax)next.cobb_max=cobbMax[1];
    setConstrFilter(next);
  };
  const[autoCodeEnabled,setAutoCodeEnabled]=useState(false);
  const[autoCodeSeq,setAutoCodeSeq]=useState(1);
  const[templateB64,setTemplateB64]=useState(()=>{try{return localStorage.getItem('cbb_template')||null;}catch(e){return null;}});

  // Check localStorage for previously stored template
  useEffect(()=>{
    try{if(localStorage.getItem('cbb_template'))setTemplateLoaded(true);}catch(e){}
  },[]);

  // A3: persist locations whenever the list changes
  useEffect(()=>{try{localStorage.setItem('cbb_locations',JSON.stringify(locations));}catch(e){};},[locations]);
  // Persist all masters on change — rates was missing its useEffect
  useEffect(()=>{try{localStorage.setItem('cbb_rates',JSON.stringify(rates));}catch(e){}},[rates]);
  useEffect(()=>{try{localStorage.setItem('cbb_freight',JSON.stringify(freight));}catch(e){}},[freight]);
  useEffect(()=>{try{localStorage.setItem('cbb_sectors',JSON.stringify(sectors));}catch(e){}},[sectors]);
  useEffect(()=>{try{localStorage.setItem('cbb_boxtrim',JSON.stringify(boxTrim));}catch(e){}},[boxTrim]);
  useEffect(()=>{try{localStorage.setItem('cbb_partitions',JSON.stringify(partitionsMaster));}catch(e){}},[partitionsMaster]);
  useEffect(()=>{try{localStorage.setItem('cbb_constrlib',JSON.stringify(constructionLib));}catch(e){}},[constructionLib]);
  // Fix 1: Invalidate ALL batch results when masters change — rates, freight, or constructions
  // affect every row. constructionLib is watched because paper layer edits change per-row costs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{invalidateAllBatchResults();},[rates,freight,constructionLib]);
  useEffect(()=>{try{localStorage.setItem('cbb_quoteitems',JSON.stringify(items));}catch(e){}},[items]);

  const s=(k,v)=>setSpec(p=>{
    const ks=k.split(".");
    if(ks.length===1)return{...p,[k]:v};
    if(ks[0]==="layers")return{...p,layers:{...p.layers,[ks[1]]:{...p.layers[ks[1]],[ks[2]]:v}}};
    return p;
  });

  // Derived sector code list — always from sectors state so dynamic additions appear everywhere.
  // SECTORS constant from defaults.js is used only as the initial seed in DEFAULT_SECTORS_DATA.
  const sectorCodes=sectors.map(s=>s.code);

  // wastePP/convRatePP: "" in spec means "no override — inherit sector default",
  // resolved fresh here (not baked into spec) so it stays live if sector changes.
  // An explicit 0 (or any other typed number) is NOT blank and passes through as-is
  // — this is what lets a genuine 0% override actually take effect.
  const _sectorForCalc=sectors.find(x=>x.code===spec.sector);
  // When a batch exists, the Batch Profile is the committed context for waste/conv defaults.
  // When the batch is empty, the sector master is the only authority.
  // This ensures Costing's display and Calculate All use the same effective value.
  const _hasCommittedBatch=batchRows.length>0&&costingContext==="same-batch"; // false in new-batch context — Costing uses sector master for defaults, not parked batch profile
  const _wasteDefBox =_hasCommittedBatch?(batchProfile.waste??_sectorForCalc?.wasteCBB??5):(_sectorForCalc?.wasteCBB??5);
  const _convDefBox  =_hasCommittedBatch?(batchProfile.convRate??_sectorForCalc?.convBox??7):(_sectorForCalc?.convBox??7);
  const _wasteDefPP  =_hasCommittedBatch?(batchProfile.wastePP??_sectorForCalc?.wastePP??5):(_sectorForCalc?.wastePP??5);
  const _convDefPP   =_hasCommittedBatch?(batchProfile.convRatePP??_sectorForCalc?.convPP??12.5):(_sectorForCalc?.convPP??12.5);

  const _calcSpec=(spec.wastePP===""||spec.wastePP==null||spec.convRatePP===""||spec.convRatePP==null
                 ||spec.waste===""||spec.waste==null||spec.convRate===""||spec.convRate==null)
    ?{...spec,
       waste:(spec.waste===""||spec.waste==null)?_wasteDefBox:spec.waste,
       convRate:(spec.convRate===""||spec.convRate==null)?_convDefBox:spec.convRate,
       wastePP:(spec.wastePP===""||spec.wastePP==null)?_wasteDefPP:spec.wastePP,
       convRatePP:(spec.convRatePP===""||spec.convRatePP==null)?_convDefPP:spec.convRatePP,
      }:spec;
  // A1: single resolver — same blank→authority logic as _calcSpec above.
  // isWasteBlank/isConvBlank preserved so delta computation never writes 0 overrides.
  const resolveSpecWasteConv=(forPP)=>({
    waste: forPP
      ? ((spec.wastePP===""||spec.wastePP==null)?_wasteDefPP:+spec.wastePP)
      : ((spec.waste===""||spec.waste==null)?_wasteDefBox:+spec.waste),
    conv: forPP
      ? ((spec.convRatePP===""||spec.convRatePP==null)?_convDefPP:+spec.convRatePP)
      : ((spec.convRate===""||spec.convRate==null)?_convDefBox:+spec.convRate),
    isWasteBlank: forPP?(spec.wastePP===""||spec.wastePP==null):(spec.waste===""||spec.waste==null),
    isConvBlank:  forPP?(spec.convRatePP===""||spec.convRatePP==null):(spec.convRate===""||spec.convRate==null),
  });
  const result=calcCosting(_calcSpec,rates,freight,boxTrim);
  const r=result;
  const missing=checkMissingInfo(spec,r);
  const compliance=checkSpecCompliance(spec,r);
  const marginSugg=suggestMargin(spec,r?.calcMOQ);
  const osSaving=r&&compliance.find(c=>c.type==="over"&&c.field.includes("Burst"))
    ?estimateOverspecSaving(spec,r,rates):null;

  // ── Send-to-Batch readiness (hoisted so both panels share the same computation) ──
  const _sendLayers=spec.layers||{};
  const _sendBType=spec.boxType||"RSC";
  const _sendRType=spec.rowType||"Box";
  const _sendIsFlatSheet=_sendBType==="PP"||_sendBType==="Board"||_sendBType==="Custom"||
    isPPType(_sendRType);
  const _sendMissingDims=(!spec.L||+spec.L<=0)||(!spec.W||+spec.W<=0)||
    (!_sendIsFlatSheet&&(!spec.H||+spec.H<=0));
  const _sendReqLayers=["TOP","F1","L1"];
  if(+spec.ply===5)_sendReqLayers.push("F2","L2");
  const _sendLayerNames={TOP:"TOP liner",F1:"F1 flute",L1:"L1 liner",F2:"F2 flute",L2:"L2 liner"};
  const _sendMissingLayers=_sendReqLayers.filter(k=>!_sendLayers[k]?.code||String(_sendLayers[k].code).trim()==="");
  const _sendReady=!_sendMissingDims&&_sendMissingLayers.length===0;

  const addItem=()=>{
    if(!r||missing.blockers.length>0)return;
    // Point 3: Customer grouping — warn if client changes mid-quote
    const prevClient=(items[0]?.spec.client||"").trim();
    const curClient=(spec.client||"").trim();
    if(items.length>0&&prevClient&&curClient&&prevClient!==curClient){
      if(window.confirm(`Current quote has ${items.length} item(s) for "${prevClient}".\n\nOK = Save "${prevClient}" as draft and start fresh for "${curClient}"\nCancel = Keep all items together`)){
        setSavedQuotes(prev=>({...prev,[prevClient]:{items:[...items],savedAt:new Date().toLocaleString("en-IN")}}));
        setItems([]);
      }
    }
    // Point 2: Duplicate check — unique identity = product|material_code
    const uid=`${(spec.product||"").trim()}|${(spec.material_code||"").trim()}|${spec.rowType||"Box"}|${(spec.setCode||"").trim()}`;
    if(uid!=="|"){
      const existIdx=items.findIndex(i=>`${(i.spec.product||"").trim()}|${(i.spec.material_code||"").trim()}|${i.spec.rowType||"Box"}|${(i.spec.setCode||"").trim()}`===uid);
      if(existIdx>=0){
        if(window.confirm(`"${spec.product||"SKU"}" (${spec.material_code||"no code"}) already in quote.\n\nOK = Replace  |  Cancel = Add as separate entry`)){
          showToast(`🔄 "${spec.product||spec.material_code||'Item'}" replaced in Quote Items`,'info');
          setItems(prev=>prev.map((item,idx)=>idx===existIdx
            ?{...item,spec:{...spec},result:r,status:"updated",timestamp:new Date().toLocaleString("en-IN")}:item));
          setAiNotes(`✅ "${spec.product||"Item"}" updated in quote.`);
          return;
        }
      }
    }
    const id=Date.now();
    setItems(prev=>[...prev,{id,spec:{...spec},result:r,status:"draft",
      note:"",timestamp:new Date().toLocaleString("en-IN")}]);
    showToast(`✅ "${spec.product||spec.material_code||"Item"}" added to Quote Items`);
    setAiNotes(`✅ "${spec.product||"Item"}" added. ${items.length+1} item(s) in quote.`);
  };
  const removeItem=id=>setItems(prev=>prev.filter(i=>i.id!==id));
  // A4: clear activeBatchRowId so reviewing a Quote Item cannot hijack the push target.
  // Without this, a green "Push to Batch Row" button would silently overwrite an unrelated batch row.
  const loadItem=item=>{setSpec({...item.spec});setSetAutoFill(true);setActiveBatchRowId(null);setSpecCommitted(false);setTab("costing");};


  // ── BATCH ENTRY HELPERS ─────────────────────────────────────────────────
  // Auto-derives Plate/Part-L/Part-W dims from the nearest preceding Box row when
  // the row's own L/W is left blank — an explicit App-side value always overrides
  // this (matches the "App input wins, formula is only a fallback" xlsx rule).
  //
  // A1-01 (BATCH-03 FIX): The parent Box search is now restricted to rows that
  // share the same SET Code as this Plate/Partition row.
  //
  // Gate: if SET Code is still "assumed" (unconfirmed), auto-dims are suppressed —
  // we must not silently apply dimensions based on an unconfirmed relationship.
  // If SET Code was explicitly cleared (empty string, not assumed), the row is
  // standalone and auto-dims are disabled — user must enter L/W manually.
  const autoCalcPPDims=(row)=>{
    if(row.itemType==="Box"||!row.itemType)return row;
    // Gate 1: unconfirmed SET Code — do not apply auto-dims
    if(row.setCodeAssumed)return row;
    const needsL=row.L===""||row.L==null;
    const needsW=row.W===""||row.W==null;
    if(!needsL&&!needsW)return row;
    const rowSetCode=(row.setCode||"").trim();
    // Gate 2: explicitly cleared SET Code (blank, not assumed) — standalone row, no auto-dims
    if(!rowSetCode)return row;
    const idx=batchRows.findIndex(r=>r.id===row.id);
    // Only accept a parent Box with the same confirmed SET Code
    const parentBox=[...batchRows.slice(0,idx)].reverse().find(r=>
      r.itemType==="Box"&&!r.setCodeAssumed&&(r.setCode||"").trim()===rowSetCode);
    if(!parentBox)return row;
    const patch={};
    if(row.itemType==="Plate"){
      if(needsL&&parentBox.L)patch.L=+parentBox.L-5;
      if(needsW&&parentBox.W)patch.W=+parentBox.W-5;
    } else if(row.itemType==="Part-L"){
      if(needsL&&parentBox.L)patch.L=+parentBox.L-5;
      if(needsW&&parentBox.H)patch.W=+parentBox.H-15;
    } else if(row.itemType==="Part-W"){
      if(needsL&&parentBox.W)patch.L=+parentBox.W-5;
      if(needsW&&parentBox.H)patch.W=+parentBox.H-15;
    }
    return Object.keys(patch).length?{...row,...patch}:row;
  };

  // ── FIX 1: Profile-level staleness — invalidate ALL results when any costing-relevant
  // profile field changes (margin, waste, conv, sector, interest, freight, plant, delivery).
  // Non-costing profile fields (client, customerType, priceContext, paymentDisc display) are excluded.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{invalidateAllBatchResults();},[
    batchProfile.margin,batchProfile.marginPP,
    batchProfile.waste,batchProfile.convRate,
    batchProfile.wastePP,batchProfile.convRatePP,
    batchProfile.sector,batchProfile.interest,
    batchProfile.freightOverride,batchProfile.plant,batchProfile.delivery,
  ]);

  // ── FIX 1: Staleness invalidation ────────────────────────────────────────────
  // Row-level: clears only the affected row's result when a costing-relevant field changes.
  // Profile/master level: clears all results (called on profile, rates, freight, construction changes).
  // Non-costing fields (product name, matCode, remarks, setCode, spec_bs/bct/ect) do NOT invalidate.
  const invalidateBatchRow=(rowId)=>setBatchResults(prev=>{
    if(!prev[rowId])return prev;
    const next={...prev};delete next[rowId];return next;
  });
  const invalidateAllBatchResults=()=>setBatchResults({});

  const[newSector,setNewSector]=useState({code:"",name:"",wasteCBB:5,wastePP:5,convBox:7,convPP:12.5,specLang:"BS"});

  const calcBatchRow=(row)=>{
    const constEntry=constructionLib.find(c=>c.code===row.constructionCode);
    if(!constEntry)return null;
    const dimRow=autoCalcPPDims(row);
    const isPP=isPPType(dimRow.itemType); // R-2
    // Unified waste/conv: single column interpreted by row type
    const rowWaste=row.wasteConv_waste; // blank = inherit profile
    const rowConv=row.wasteConv_conv;
    const profWaste=isPP?(batchProfile.wastePP??5):(batchProfile.waste??5);
    const profConv=isPP?(batchProfile.convRatePP??12.5):(batchProfile.convRate??7);
    const effWaste=rowWaste!==""&&rowWaste!=null?+rowWaste:profWaste;
    const effConv=rowConv!==""&&rowConv!=null?+rowConv:profConv;
    const sp=buildSpecFromRow(dimRow,constEntry,batchProfile);
    if(!sp)return null;
    // Apply row-level overrides on top of buildSpecFromRow output
    sp.waste=isPP?sp.waste:effWaste; sp.convRate=isPP?sp.convRate:effConv;
    sp.wastePP=isPP?effWaste:sp.wastePP; sp.convRatePP=isPP?effConv:sp.convRatePP;
    if(row.interestOverride!==""&&row.interestOverride!=null)sp.interest=+row.interestOverride;
    if(row.freightRowOverride!==""&&row.freightRowOverride!=null)sp.freightOverride=row.freightRowOverride;
    applyAddOns(sp,row); // R-1: single injection point
    return calcCosting(sp,rates,freight,boxTrim);
  };

  const calculateAll=()=>{
    // Gate: block if any non-Box row has an unconfirmed SET Code
    const unconfirmed=batchRows.filter(r=>r.itemType!=="Box"&&r.setCodeAssumed);
    if(unconfirmed.length>0){
      const list=unconfirmed.map((r,i)=>`Row ${batchRows.indexOf(r)+1}${r.matCode?` [${r.matCode}]`:""}`).join(", ");
      showToast(`⚠️ Confirm SET Codes first: ${list}`,'error',5000);
      return;
    }
    const newResults={};
    batchRows.forEach(row=>{newResults[row.id]=calcBatchRow(row);});
    setBatchResults(newResults);
    setBatchRows(prev=>prev.map(r=>({...r,status:newResults[r.id]?"draft":"incomplete"})));
  };

  const getBatchRowStatus=(row)=>{
    const dimRow=autoCalcPPDims(row);
    if(!dimRow.L||!dimRow.W||!row.constructionCode)return"incomplete";
    const constEntry=constructionLib.find(c=>c.code===row.constructionCode);
    if(!constEntry)return"incomplete";
    // Plate/Partition rows are flat pieces — H not required
    const isFlatPiece=isPPType(row.itemType); // R-2
    if(!isFlatPiece&&!row.H)return"incomplete";
    const res=batchResults[row.id];
    // Fix 1: "stale" — row was previously calculated (row.status indicates it) but result was invalidated
    if(!res&&(row.status==="draft"||row.status==="reviewed"||row.status==="override"||row.status==="spec-gap"))return"stale";
    if(!res)return"draft-uncalc";
    if(row.reviewed)return"reviewed";
    if(row.marginOverride!=null&&row.marginOverride!=="")return"override";
    const sp=buildSpecFromRow(dimRow,constEntry,batchProfile);
    const comp=sp?checkSpecCompliance(sp,res):[];
    if(comp.some(c=>c.severity==="high"))return"spec-gap";
    return"draft";
  };

  const loadBatchRowIntoCosting=(row)=>{
    // Gate: block Deep Dive if this row has an unconfirmed SET Code
    if(row.setCodeAssumed){
      showToast(`⚠️ Confirm SET Code [${row.setCode||"?"}] on this row before deep-dive`,'error',4000);
      return;
    }
    const constEntry=constructionLib.find(c=>c.code===row.constructionCode);
    if(!constEntry)return;
    const dimRow=autoCalcPPDims(row);
    const isPP=isPPType(dimRow.itemType); // R-2
    const sp=buildSpecFromRow(dimRow,constEntry,batchProfile);
    if(!sp)return;
    // Apply row-level overrides — same logic as calcBatchRow so deepdive reflects exact costing
    const rowWaste=row.wasteConv_waste;
    const rowConv=row.wasteConv_conv;
    const profWaste=isPP?(batchProfile.wastePP??5):(batchProfile.waste??5);
    const profConv=isPP?(batchProfile.convRatePP??12.5):(batchProfile.convRate??7);
    if(rowWaste!==""&&rowWaste!=null){if(isPP)sp.wastePP=+rowWaste;else sp.waste=+rowWaste;}
    if(rowConv!==""&&rowConv!=null){if(isPP)sp.convRatePP=+rowConv;else sp.convRate=+rowConv;}
    if(row.interestOverride!==""&&row.interestOverride!=null)sp.interest=+row.interestOverride;
    if(row.freightRowOverride!==""&&row.freightRowOverride!=null)sp.freightOverride=row.freightRowOverride;
    applyAddOns(sp,row); // R-1: single injection point
    setSpec(sp);
    setSetAutoFill(row.setAutoFill??true); // restore stored setting; default true for legacy rows
    setActiveBatchRowId(row.id);
    setSpecCommitted(false); // REVIEW mode uses activeBatchRowId, not specCommitted
    setCostingContext("same-batch"); // REVIEW of an existing row always re-establishes same-batch context
    setTab("costing");
  };

  // Stage-1 fix for "Costing edits don't reach Batch Entry": an explicit, one-click
  // push — never automatic/live — from the currently-open Costing spec back into
  // the batch row it was loaded from. Row-level fields (dims, std specs, MOQ,
  // volume, margin override) always write straight back, since they belong to
  // this SKU alone. Shared Construction fields (box type/ply/flutes/paper layers)
  // are only pushed if the user explicitly confirms, because that Construction
  // may be reused by other SKUs and silently changing it would re-cost them too.
  // B3: specFromProfile — seeds batch-wide fields from batchProfile; blanks row-level fields.
  // Used by "✕ Unlink" (end of REVIEW) and the idle panel "Start new SKU" Reset.
  // The reverse direction (Costing → Profile) already exists as the "↓ Profile" button.
  // Without this, Reset yields INIT_SPEC (Nagpur/Nagpur/conv 12.5/margin 8) which
  // contradicts a populated batchProfile — the Maker validates a number they'll never see.
  const specFromProfile=()=>({
    ...INIT_SPEC,
    client:batchProfile.client||"",
    sector:batchProfile.sector||"",
    plant:batchProfile.plant||"",
    delivery:batchProfile.delivery||"",
    interest:batchProfile.interest??0.5,
    paymentDisc:batchProfile.paymentDisc||"30",
    // Leave waste/conv/wastePP/convRatePP blank so _calcSpec resolves from sector default —
    // matching what calcBatchRow will use after Calculate All (profile values, not INIT_SPEC hardcodes).
    waste:"",convRate:"",wastePP:"",convRatePP:"",
    margin:batchProfile.margin??8,
    customerType:batchProfile.customerType||"existing",
    priceContext:batchProfile.priceContext||"unknown",
    // Same-batch retention: carry forward construction and output-specs as starting working
    // intelligence for the next SKU in the same batch. These are STARTING DEFAULTS, fully editable.
    // Row-identity fields (client, sector, matCode, product, dims, setCode) are cleared above via
    // INIT_SPEC spread so the Maker supplies fresh values for the new SKU.
    // Waste/conv are intentionally NOT retained — they resolve from the committed Batch Profile/sector.
    ply:spec.ply||5,
    flute_F1:spec.flute_F1||"B",
    flute_F2:spec.flute_F2||"A",
    layers:JSON.parse(JSON.stringify(spec.layers||{})),
    boxType:spec.boxType||"RSC",
    spec_bs:spec.spec_bs||"",
    spec_bct:spec.spec_bct||"",
    spec_ect:spec.spec_ect||"",
    board_gsm:spec.board_gsm||"",
    spec_cobb:spec.spec_cobb||"",
  });

  // New-Batch/Scratchpad Start New SKU: retain construction/output-spec working
  // intelligence from current scratchpad spec, but read NOTHING from batchProfile.
  // Identity, dims, commercial terms all reset to blank/INIT_SPEC defaults.
  const specForNewBatch=()=>({
    ...INIT_SPEC,
    // Batch/customer context — same carry-forward semantics as specFromProfile(),
    // but sourced from current spec (not batchProfile, which belongs to the parked Old Batch).
    client:spec.client||"",
    sector:spec.sector||"",
    plant:spec.plant||"",
    delivery:spec.delivery||"",
    interest:spec.interest??0.5,
    paymentDisc:spec.paymentDisc||"30",
    // waste/conv: carry as-is from spec, preserving blank-as-inherit semantics.
    // Same intent as specFromProfile() which sets these to "" so _calcSpec resolves
    // from sector default. If spec has "" (inherit), carry ""; if spec has an explicit
    // value the Maker typed, carry that value.
    waste:spec.waste,convRate:spec.convRate,
    wastePP:spec.wastePP,convRatePP:spec.convRatePP,
    margin:spec.margin??8,
    customerType:spec.customerType||"existing",
    priceContext:spec.priceContext||"unknown",
    // Construction and board specifications — same as specFromProfile():
    ply:spec.ply||5,
    flute_F1:spec.flute_F1||"B",
    flute_F2:spec.flute_F2||"A",
    layers:JSON.parse(JSON.stringify(spec.layers||{})),
    boxType:spec.boxType||"RSC",
    spec_bs:spec.spec_bs||"",
    spec_bct:spec.spec_bct||"",
    spec_ect:spec.spec_ect||"",
    board_gsm:spec.board_gsm||"",
    spec_cobb:spec.spec_cobb||"",
    // NOT carried (same as specFromProfile()): freightOverride, add-ons, isRepeat,
    // skuType, volume, salesMOQ, reqBoxWt, material_code, product, L/W/H, setCode.
  });

  const pushCostingToBatchRow=()=>{
    if(!activeBatchRowId){showToast("⚠️ No batch row linked — open one via the grid's 🔍 icon first",'info');return;}
    const row=batchRows.find(r=>r.id===activeBatchRowId);
    if(!row){showToast("⚠️ That batch row no longer exists",'info');return;}
    const isPPRowType=isPPType(row.itemType); // R-2
    const profileMarginForRow=isPPRowType?(batchProfile.marginPP??batchProfile.margin??8):(batchProfile.margin??8);

    // ── A1-03: Compute waste/conv overrides to push back ─────────────────────
    // Determine what profile+library would produce for this row (same logic as
    // calcBatchRow and loadBatchRowIntoCosting) then compare with spec's actual
    // values. If they differ, record the override so Calculate All reproduces
    // the same result the professional saw and approved in the Costing tab.
    const constEntry=constructionLib.find(c=>c.code===row.constructionCode);
    const profWaste=isPPRowType?(batchProfile.wastePP??5):(batchProfile.waste??5);
    const profConv=isPPRowType?(batchProfile.convRatePP??12.5):(batchProfile.convRate??7);
    // buildSpecFromRow uses constEntry.waste/conv first, then profile — mirror that here
    const libWaste=isPPRowType
      ?(constEntry?.wastePP!=null?constEntry.wastePP:profWaste)
      :(constEntry?.waste!=null?constEntry.waste:profWaste);
    const libConv=isPPRowType
      ?(constEntry?.convRatePP!=null?constEntry.convRatePP:profConv)
      :(constEntry?.convRate!=null?constEntry.convRate:profConv);
    // A1: Use resolveSpecWasteConv (declared beside _calcSpec) so blank is treated
    // as "inherit sector default" — not coerced to 0 via +"". Both the Costing
    // calculator and this write-back now use the same resolution chain.
    const _rwc=resolveSpecWasteConv(isPPRowType);
    const specWaste=_rwc.waste;
    const specConv=_rwc.conv;
    // Only write an override if the resolved value differs from lib/profile resolution
    // AND the Maker explicitly typed a value (blank = inherit, so never write an override for blank)
    const wasteOverride=(!_rwc.isWasteBlank&&Math.abs(specWaste-libWaste)>0.001)?specWaste:"";
    const convOverride=(!_rwc.isConvBlank&&Math.abs(specConv-libConv)>0.001)?specConv:"";
    // ─────────────────────────────────────────────────────────────────────────

    const rowPatch={
      L:spec.L||"",W:spec.W||"",H:spec.H||"",ups:spec.ups||1,
      // G5: SKU/Product is editable in REVIEW and must be pushed back so the grid reflects the correction
      product:spec.product||"",
      // B1: nosPerSet was missing — a Maker correcting partition count in deep-dive lost it on Calculate All
      nosPerSet:spec.qtyPerSet||row.nosPerSet,
      board_gsm:spec.board_gsm||"",spec_bs:spec.spec_bs||"",
      spec_bct:spec.spec_bct||"",spec_ect:spec.spec_ect||"",
      reqBoxWt:spec.reqBoxWt||"",salesMOQ:spec.salesMOQ||"",volume:spec.volume||"",
      marginOverride:(+spec.margin!==+profileMarginForRow)?spec.margin:"",
      // A1-03: write waste/conv overrides back so next Calculate All matches Costing
      wasteConv_waste:wasteOverride,
      wasteConv_conv:convOverride,
      // Fix 2: push all row-owned fields that Costing tab pre-populates and the Maker can edit.
      // Mirrors the existing marginOverride pattern. Without these, edits in Costing are silently discarded.
      boxType:spec.boxType||row.boxType||"RSC",
      addOns:{
        printing:+(spec.printing||0),stitching:+(spec.stitching||0),
        coating:+(spec.coating||0),handling:+(spec.handling||0),
        moqCharge:+(spec.moqCharge||0),packing:+(spec.packing||0),
        other:+(spec.other||0),unloading:+(spec.unloading||0),
      },
      interestOverride:(()=>{
        // Only write an override if Costing's interest differs from the profile default
        const profInt=batchProfile.interest??0.5;
        return Math.abs(+spec.interest-profInt)>0.001?spec.interest:"";
      })(),
      freightRowOverride:(()=>{
        // Only write an override if Costing's freightOverride differs from the profile/matrix freight
        const profFr=batchProfile.freightOverride||freight?.[batchProfile.plant]?.[batchProfile.delivery]||0;
        const specFr=spec.freightOverride;
        return (specFr!==""&&specFr!=null&&Math.abs(+specFr-profFr)>0.001)?specFr:"";
      })(),
    };
    setBatchRows(prev=>prev.map(r=>r.id===activeBatchRowId?{...r,...rowPatch}:r));
    // Invalidate the cached result for this row — costing inputs have changed.
    // The grid's updC already does this for inline edits; Push must do the same.
    // Without this, batchResults[activeBatchRowId] survives with the pre-push rate
    // and the row shows as calculated when its inputs no longer match the result.
    invalidateBatchRow(activeBatchRowId);

    // constEntry already declared above for waste/conv override calculation
    const layersChanged=constEntry&&JSON.stringify(constEntry.layers||{})!==JSON.stringify(spec.layers||{});
    const constructionChanged=constEntry&&(
      constEntry.boxType!==spec.boxType||+constEntry.ply!==+spec.ply||
      constEntry.flute_F1!==spec.flute_F1||constEntry.flute_F2!==spec.flute_F2||layersChanged);
    if(constructionChanged){
      const otherUsers=batchRows.filter(r=>r.constructionCode===row.constructionCode&&r.id!==row.id).length;
      const warn=otherUsers>0
        ?`Construction [${constEntry.code}] is also used by ${otherUsers} other row(s) in this batch. Update it for ALL of them to match Costing's box type/ply/flutes/layers?`
        :`Update Construction [${constEntry.code}] to match Costing's box type/ply/flutes/layers?`;
      if(window.confirm(warn)){
        setConstructionLib(prev=>prev.map(c=>c.code===constEntry.code?{...c,
          boxType:spec.boxType||c.boxType,ply:spec.ply||c.ply,
          flute_F1:spec.flute_F1||c.flute_F1,flute_F2:spec.flute_F2||c.flute_F2,
          layers:JSON.parse(JSON.stringify(spec.layers||{})),
        }:c));
        showToast(`✅ Pushed to row + updated Construction [${constEntry.code}] — run Calculate All to update the rate`,'success',5000);
      } else {
        showToast("✅ Row updated (Construction left unchanged) — run Calculate All to update the rate",'success',5000);
      }
    } else {
      showToast("✅ Pushed to batch row — run Calculate All to update the rate",'success',5000);
    }
  };

  // ── SEND COSTING TO BATCH ENTRY ──────────────────────────────────────────────
  // Called when Maker clicks "→ Send to Batch Entry" from the idle Costing panel.
  // Validates minimum completeness, then creates or reuses a construction library
  // entry, appends a fully pre-populated batch row, links it as the active row,
  // and switches to Batch Entry so the Maker can scale to more SKUs.
  const sendCostingToBatch=()=>{
    // ── Upfront validation — must pass before anything is written ────────────
    const missing=[];

    // ── Context gate: hard block before ANY validation when new-batch context exists alongside an active batch ──
    // This is a pre-condition, not a field-value check. It fires unconditionally when costingContext==="new-batch"
    // and batchRows is non-empty, regardless of spec field values or G1 identity comparisons.
    if(costingContext==="new-batch"&&batchRows.length>0){
      showToast(
        "❌ New-Batch/Scratchpad context — cannot send into existing Batch Entry batch.\n\n"+
        "Go to Batch Entry → + New Batch to clear the old batch first, then send.",
        'error',8000
      );
      return;
    }

    // Dimensions — L and W always required.
    // H only required for RSC/HRSC/Die box types. PP, Board, Custom are flat sheets (L×W only).
    // Plate/Part-L/Part-W rowTypes are also flat — no H.
    const _bType=spec.boxType||"RSC";
    const _rType=spec.rowType||"Box";
    const _isFlatSheet=_bType==="PP"||_bType==="Board"||_bType==="Custom"||
      _rType==="Plate"||_rType==="Part-L"||_rType==="Part-W";
    if(!spec.L||+spec.L<=0) missing.push("Length (L)");
    if(!spec.W||+spec.W<=0) missing.push("Width (W)");
    if(!_isFlatSheet&&(!spec.H||+spec.H<=0)) missing.push("Height (H) — required for RSC / HRSC / Die box types");

    // Paper layers: minimum 3 layers with a paper code — TOP, F1, L1 are the
    // mandatory structural layers for any valid corrugated construction.
    // For 5-ply, F2 and L2 are also required — without them the engine costs
    // three layers against 5-ply trims and MOQ, producing a silently undercosted quote.
    const layers=spec.layers||{};
    const REQUIRED_LAYERS=["TOP","F1","L1"];
    if(+spec.ply===5) REQUIRED_LAYERS.push("F2","L2");
    const LAYER_NAMES={
      TOP:"TOP (outer liner)",F1:"F1 (flute medium)",L1:"L1 (inner liner)",
      F2:"F2 (second flute)",L2:"L2 (innermost liner — required for 5-ply)",
    };
    REQUIRED_LAYERS.forEach(k=>{
      if(!layers[k]?.code||String(layers[k].code).trim()==="")
        missing.push(LAYER_NAMES[k]);
    });

    if(!spec.plant)    missing.push("Avadhoot Plant — select before sending");
    if(!spec.delivery) missing.push("Client Plant (delivery location) — select before sending");
    if(missing.length>0){
      showToast(
        `⚠️ Complete these before sending:\n• ${missing.join("\n• ")}`,
        'error', 7000
      );
      return;
    }

    // ── G1: Identity-first guards — only for non-empty batches ───────────────
    // The TEXTILE/ICECREAM rule: batch-wide identity must match before any numeric
    // delta is computed. A mismatch must never become a row override.
    // These guards fire only when batchRows.length > 0 (profile is committed).
    // On first Send (empty batch), the seeding block below establishes the profile.
    if(batchRows.length>0){
      // Normalise: trim + lowercase for reliable comparison (sameClient helper inline)
      const _norm=v=>(v||"").trim().toLowerCase().replace(/\s+/g," ");
      const _specClient=_norm(spec.client);
      const _profClient=_norm(batchProfile.client);
      if(_specClient&&_profClient&&_specClient!==_profClient){
        showToast(
          `❌ Client mismatch — Costing is for "${spec.client}" but this Batch is for "${batchProfile.client}".\n\nThis is a different quotation. Start a New Batch for this client, or fix the Client field in Costing.`,
          'error', 9000
        );
        return;
      }
      // Sector, Plant, Delivery — hard block; mismatch must NOT become a row override
      const _specSector=_norm(spec.sector);
      const _profSector=_norm(batchProfile.sector);
      if(_specSector&&_profSector&&_specSector!==_profSector){
        showToast(
          `❌ Sector mismatch — Costing is "${spec.sector}" but this Batch Profile is "${batchProfile.sector}".\n\nFix the Batch Profile or start a New Batch.`,
          'error', 9000
        );
        return;
      }
      const _specPlant=_norm(spec.plant);
      const _profPlant=_norm(batchProfile.plant);
      if(_specPlant&&_profPlant&&_specPlant!==_profPlant){
        showToast(
          `❌ Plant mismatch — Costing is "${spec.plant}" but this Batch Profile is "${batchProfile.plant}".\n\nFix the Batch Profile or start a New Batch.`,
          'error', 9000
        );
        return;
      }
      const _specDelivery=_norm(spec.delivery);
      const _profDelivery=_norm(batchProfile.delivery);
      if(_specDelivery&&_profDelivery&&_specDelivery!==_profDelivery){
        showToast(
          `❌ Delivery mismatch — Costing is "${spec.delivery}" but this Batch Profile is "${batchProfile.delivery}".\n\nFix the Batch Profile or start a New Batch.`,
          'error', 9000
        );
        return;
      }
      // ── Duplicate (MatCode, rowType) guard ───────────────────────────────────
      // Same MatCode + same rowType in one batch = the same SKU sent twice.
      // Block hard — downstream dedup in sendAllToQuoteItems would silently collapse it.
      // Blank MatCode is not checked (pre-existing data quality gap, out of scope).
      const _incomingMC=(spec.material_code||"").trim();
      const _incomingRT=(spec.rowType||"Box");
      if(_incomingMC){
        const _dupRow=batchRows.find(r=>(r.matCode||"").trim()===_incomingMC&&(r.itemType||"Box")===_incomingRT);
        if(_dupRow){
          const _dupNum=batchRows.indexOf(_dupRow)+1;
          showToast(
            `❌ Duplicate — Mat Code "${_incomingMC}" [${_incomingRT}] already exists as Row ${_dupNum}.\n\nUse a different Mat Code, or Deep Dive Row ${_dupNum} to edit it.`,
            'error', 9000
          );
          return;
        }
        // Same MatCode, different itemType — warn+confirm (SET components can legitimately
        // share a code in rare cases, but it is unusual and worth flagging)
        const _codeOnly=batchRows.find(r=>(r.matCode||"").trim()===_incomingMC&&(r.itemType||"Box")!==_incomingRT);
        if(_codeOnly){
          const _codeNum=batchRows.indexOf(_codeOnly)+1;
          const _proceed=window.confirm(
            `Mat Code "${_incomingMC}" is already used by Row ${_codeNum} [${_codeOnly.itemType||"Box"}].\n\nSET components normally use distinct Mat Codes.\n\nOK = Continue anyway\nCancel = Go back and change the Mat Code`
          );
          if(!_proceed)return;
        }
      }
    }

    // ── Change 2: Cobb ≤ 125 moisture barrier gate ───────────────────────────
    // Cobb ≤ 125 g/m² requires a moisture barrier coating add-on.
    // If no coating charge has been entered, confirm before proceeding —
    // a quote sent without it is commercially wrong for this customer segment.
    const cobbV=spec.spec_cobb?+spec.spec_cobb:null;
    const coatingEntered=+(spec.coating||0)>0;
    if(cobbV&&cobbV<=125&&!coatingEntered){
      const proceed=window.confirm(
        `⚠️ Cobb ≤ 125 g/m² (moisture-sensitive board)\n\n`+
        `No coating add-on charge has been entered (currently ₹0/pc).\n\n`+
        `A moisture barrier coating is typically required for Cobb ≤ 125 g/m².\n\n`+
        `OK = Proceed without coating charge\n`+
        `Cancel = Go back and enter the coating rate first`
      );
      if(!proceed)return;
    }

    // ── Resolve construction — find existing match or create new ─────────────
    const LETTERS="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const usedCodes=new Set(constructionLib.map(c=>c.code));
    const toStr=v=>(v===undefined||v===null||v===""?"":String(v).trim());
    const incomingSector=spec.sector||batchProfile.sector||"";
    let constrCode=null;

    // C1: match on STDs + ply + both flutes + boxType + layers (all seven fields).
    // Without layers in the match, two constructions that share geometry but differ
    // in paper grade (e.g. 22BF vs 26HRCT top) silently collapse to the first one found.
    const specLayersStr=JSON.stringify(spec.layers||{});
    const existingFull=constructionLib.find(c=>
      toStr(c.board_gsm)===toStr(spec.board_gsm)&&
      toStr(c.spec_bs)===toStr(spec.spec_bs)&&
      toStr(c.spec_bct)===toStr(spec.spec_bct)&&
      toStr(c.spec_ect)===toStr(spec.spec_ect)&&
      +c.ply===(+spec.ply||5)&&
      toStr(c.flute_F1)===toStr(spec.flute_F1)&&
      toStr(c.flute_F2)===toStr(spec.flute_F2)&&
      toStr(c.boxType)===toStr(spec.boxType||"RSC")&&
      JSON.stringify(c.layers||{})===specLayersStr
    );

    if(existingFull){
      // Exact match including layers — reuse silently
      constrCode=existingFull.code;
      showToast(`✅ Matched existing construction [${constrCode}]`,'success',3000);
    } else {
      // C1: also check for STD-only match (layers differ) — confirm before reusing
      const existingSTD=constructionLib.find(c=>
        toStr(c.board_gsm)===toStr(spec.board_gsm)&&
        toStr(c.spec_bs)===toStr(spec.spec_bs)&&
        toStr(c.spec_bct)===toStr(spec.spec_bct)&&
        toStr(c.spec_ect)===toStr(spec.spec_ect)&&
        +c.ply===(+spec.ply||5)&&
        toStr(c.flute_F1)===toStr(spec.flute_F1)&&
        toStr(c.flute_F2)===toStr(spec.flute_F2)&&
        toStr(c.boxType)===toStr(spec.boxType||"RSC")
      );
      if(existingSTD){
        // STDs match but paper layers differ — must not silently reuse
        const reuse=window.confirm(
          `Construction [${existingSTD.code}] matches the board specs (ply/flute/STDs) `+
          `but has DIFFERENT paper layers.\n\n`+
          `OK = Reuse [${existingSTD.code}] — your Costing paper grades are discarded\n`+
          `Cancel = Create a new construction entry with your Costing layers`
        );
        if(reuse){
          constrCode=existingSTD.code;
        }
        // If cancelled, fall through to create new construction below
      }
      if(!constrCode){
        const nextCode=LETTERS.split("").find(l=>!usedCodes.has(l))||`C${constructionLib.length}`;
        const newConstr={
          code:nextCode,
          name:"",
          boxType:spec.boxType||"RSC",ply:spec.ply||5,
          flute_F1:spec.flute_F1||"B",flute_F2:spec.flute_F2||"A",
          layers:JSON.parse(JSON.stringify(spec.layers||{})),
          board_gsm:spec.board_gsm||"",spec_bs:spec.spec_bs||"",
          spec_bct:spec.spec_bct||"",spec_ect:spec.spec_ect||"",
          waste:null,convRate:null,wastePP:null,convRatePP:null,
          sector:incomingSector,
          client:spec.client||batchProfile.client||"",
          status:"active",
          mill_preferences:{
            TOP:{grade:"",mill:""},F1:{grade:"",mill:""},L1:{grade:"",mill:""},
            F2:{grade:"",mill:""},L2:{grade:"",mill:""},
          },
        };
        setConstructionLib(prev=>[...prev,newConstr]);
        constrCode=nextCode;
      }
    }

    // ── Build new batch row pre-populated from spec ───────────────────────────
    const newId=Date.now();
    const matCode=spec.material_code||"";

    // C3: carry rowType through — downstream uses itemType for PP-ness (waste/conv/margin source)
    const newItemType=spec.rowType||"Box";
    const isPPItem=isPPType(newItemType); // R-2

    // A1: use resolveSpecWasteConv — same blank→sector resolution as the calculator.
    // Previously +spec.convRatePP coerced ""→0, writing an explicit 0 override that
    // zeroed PP conversion cost silently. Blank must remain blank (inherit profile).
    // profWasteNew/profConvNew: what batchProfile would produce for this row type —
    // the baseline the delta is compared against (mirrors pushCostingToBatchRow exactly).
    const profWasteNew=isPPItem?(batchProfile.wastePP??5):(batchProfile.waste??5);
    const profConvNew=isPPItem?(batchProfile.convRatePP??12.5):(batchProfile.convRate??7);
    const _rwcNew=resolveSpecWasteConv(isPPItem);
    const specWasteNew=_rwcNew.waste;
    const specConvNew=_rwcNew.conv;
    // Only write an override when the Maker explicitly typed a value AND it differs from profile
    const wasteOverrideNew=(!_rwcNew.isWasteBlank&&Math.abs(specWasteNew-profWasteNew)>0.001)?specWasteNew:"";
    const convOverrideNew=(!_rwcNew.isConvBlank&&Math.abs(specConvNew-profConvNew)>0.001)?specConvNew:"";

    const profMarginNew=isPPItem?(batchProfile.marginPP??batchProfile.margin??8):(batchProfile.margin??8);
    const marginOverrideNew=(spec.margin!=null&&spec.margin!==""&&Math.abs(+spec.margin-profMarginNew)>0.001)?spec.margin:"";

    const profIntNew=batchProfile.interest??0.5;
    const interestOverrideNew=Math.abs(+spec.interest-profIntNew)>0.001?spec.interest:"";

    const profFrNew=batchProfile.freightOverride||freight?.[batchProfile.plant]?.[batchProfile.delivery]||0;
    const specFrNew=spec.freightOverride;
    const freightOverrideNew=(specFrNew!==""&&specFrNew!=null&&Math.abs(+specFrNew-profFrNew)>0.001)?specFrNew:"";

    const newRow={
      id:newId,
      matCode,
      product:spec.product||"",
      itemType:newItemType,                       // C3: was hardcoded "Box"
      setCode:spec.setCode||"",   // spec.setCode is single source of truth; blank when switch OFF
      setCodeAssumed:false,
      constructionCode:constrCode,
      L:spec.L||"",W:spec.W||"",H:spec.H||"",
      ups:spec.ups||1,
      boxType:spec.boxType||"RSC",
      spec_bs:spec.spec_bs||"",
      spec_bct:spec.spec_bct||"",
      spec_ect:spec.spec_ect||"",
      board_gsm:spec.board_gsm||"",
      reqBoxWt:spec.reqBoxWt||"",
      salesMOQ:spec.salesMOQ||"",
      volume:spec.volume||"",
      spec_cobb:spec.spec_cobb||"",   // Change 1: carry Cobb spec so amber flag appears in the grid
      nosPerSet:isPPItem?(spec.qtyPerSet||1):1,  // C3: PP rows use qtyPerSet from spec
      marginOverride:marginOverrideNew,           // C2: delta vs profile
      wasteConv_waste:wasteOverrideNew,           // C2: delta vs profile
      wasteConv_conv:convOverrideNew,             // C2: delta vs profile
      addOns:{
        printing:+(spec.printing||0),stitching:+(spec.stitching||0),
        coating:+(spec.coating||0),handling:+(spec.handling||0),
        moqCharge:+(spec.moqCharge||0),packing:+(spec.packing||0),
        other:+(spec.other||0),unloading:+(spec.unloading||0),
      },
      interestOverride:interestOverrideNew,       // C2: delta vs profile
      freightRowOverride:freightOverrideNew,      // C2: delta vs profile
      remarks:"",
      reviewed:false,
      autoCode:false,
      setAutoFill:setAutoFill,
      status:"incomplete",
    };

    // NewBatchNewSKU: on the first Send (batch empty), the Costing proposal is the source of truth
    // for all four batch-wide fields. Seed them unconditionally — existing profile defaults such as
    // "Nagpur" must not silently win over the Maker's explicit Costing values.
    // On subsequent Sends (batch non-empty), the profile already owns these fields and mismatches
    // are caught above by the identity guards — no further seeding is needed here.
    if(batchRows.length===0){
      const profilePatch={};
      if(spec.client)   profilePatch.client=spec.client;
      if(spec.sector){
        profilePatch.sector=spec.sector;
        // Mirror Batch Profile sector-change handler (lines 3042-3046): when sector is seeded
        // on first Send, also establish its derived waste/conv values so the profile is internally
        // consistent. Without this, batchProfile.sector=ICECREAM but waste/conv remain defaults.
        const _sd=sectors.find(x=>x.code===spec.sector);
        profilePatch.waste=_sd?_sd.wasteCBB:5;
        profilePatch.convRate=_sd?_sd.convBox:7;
        profilePatch.wastePP=_sd?_sd.wastePP:5;
        profilePatch.convRatePP=_sd?_sd.convPP:12.5;
      }
      if(spec.plant)    profilePatch.plant=spec.plant;
      if(spec.delivery) profilePatch.delivery=spec.delivery;
      if(Object.keys(profilePatch).length)setBatchProfile(p=>({...p,...profilePatch}));
    }

    // A2 (ruling): append the row, stay on Costing with spec retained so the Maker
    // can immediately send the next SET component (Plate, Part-L, Part-W) using
    // the same construction. Do NOT reset spec — that is B3's job only on explicit Unlink.
    // Do NOT set activeBatchRowId — that is REVIEW mode; START mode stays unlinked.
    setBatchRows(prev=>[...prev,newRow]);
    setSpecCommitted(true); // freeze identity fields until Maker clicks Start New SKU
    // New-batch: first successful send establishes the batch in BatchEntry → transition to same-batch
    if(costingContext==="new-batch")setCostingContext("same-batch");
    const rowNum=batchRows.length+1;
    const constrWasMatched=!!existingFull||(!!constrCode&&!constructionLib.find(c=>c.code===constrCode));
    // Single toast — construction info merged in so the Maker sees one clear signal
    showToast(
      `✅ Row ${rowNum} added to Batch Entry · [${constrCode}] · → switch to Batch Entry tab to verify`,
      'success', 5000
    );
  };

  const sendAllToQuoteItems=()=>{
    if(!batchProfile.plant||!batchProfile.delivery){
      showToast("❌ Select Avadhoot Plant and Client Plant in the Batch Profile before sending to Quote Items",'error',5000);
      return;
    }
    // Fix 5: client-mismatch guard — if Quote Items already has items for a different client, warn
    if(items.length>0&&batchProfile.client){
      const existingClient=(items[0]?.spec?.client||"").trim();
      const newClient=batchProfile.client.trim();
      if(existingClient&&newClient&&existingClient!==newClient){
        if(!window.confirm(`Quote Items currently has ${items.length} item(s) for "${existingClient}".\n\nThis batch is for "${newClient}".\n\nOK = Proceed (items will mix clients)\nCancel = Stop`)){
          return;
        }
      }
    }
    // Change 3: Cobb ≤ 125 coating check — scan all rows before sending
    // Same pattern as SET completeness check. Missing coating on moisture-sensitive
    // board is a quoting error; Maker must explicitly confirm to proceed.
    const cobbUncoated=batchRows.filter(r=>
      r.spec_cobb&&+r.spec_cobb<=125&&+(r.addOns?.coating||0)===0
    );
    if(cobbUncoated.length>0){
      const names=cobbUncoated.map(r=>`Row ${batchRows.indexOf(r)+1}${r.matCode?` [${r.matCode}]`:""} — Cobb ≤ ${r.spec_cobb} g/m²`);
      const proceed=window.confirm(
        `⚠️ Cobb ≤ 125 g/m² — Missing Coating Charge\n\n`+
        `The following ${cobbUncoated.length} row(s) specify moisture-sensitive board `+
        `but have no coating add-on charge (₹0/pc):\n\n`+
        `${names.join("\n")}\n\n`+
        `OK = Proceed and send without coating charge\n`+
        `Cancel = Go back and enter coating rates`
      );
      if(!proceed)return;
    }

    // Fix 1: block if any row has a stale result (inputs changed since last Calculate All)
    const staleRows=batchRows.filter(r=>getBatchRowStatus(r)==="stale");
    if(staleRows.length>0){
      const list=staleRows.map(r=>`Row ${batchRows.indexOf(r)+1}${r.matCode?` [${r.matCode}]`:""}`).join(", ");
      showToast(`🔄 Stale results — run Calculate All first. Affected: ${list}`,'error',6000);
      return;
    }
    // Gate: block if any non-Box row has an unconfirmed SET Code
    const unconfirmed=batchRows.filter(r=>r.itemType!=="Box"&&r.setCodeAssumed);
    if(unconfirmed.length>0){
      const list=unconfirmed.map(r=>`Row ${batchRows.indexOf(r)+1}${r.matCode?` [${r.matCode}]`:""}`).join(", ");
      showToast(`⚠️ Confirm SET Codes first: ${list}`,'error',5000);
      return;
    }
    const newItems=[];
    const sentRowIds=new Set(); // Fix 4: track which rows actually sent
    const skippedRows=[]; // Fix 4: collect skipped row numbers for toast
    batchRows.forEach((row,ri)=>{
      const res=batchResults[row.id];
      if(!res){skippedRows.push(`Row ${ri+1}${row.matCode?` [${row.matCode}]`:""}`);return;}
      const constEntry=constructionLib.find(c=>c.code===row.constructionCode);
      if(!constEntry){skippedRows.push(`Row ${ri+1}${row.matCode?` [${row.matCode}]`:""} (no construction)`);return;}
      const dimRow=autoCalcPPDims(row); // A1-01: use SET-Code-aware dim resolution
      const sp=buildSpecFromRow(dimRow,constEntry,batchProfile);
      const isPP=isPPType(dimRow.itemType); // R-2

      // ── A1-02: Apply row-level waste/conv overrides to the spec ──────────
      // calcBatchRow and loadBatchRowIntoCosting both apply these overrides —
      // sendAllToQuoteItems must do the same so the spec stored in Quote Items
      // (used for Excel export columns AY3/AY4/BA3/BA4) reflects the exact
      // effective values the engine used, not the profile defaults.
      const rowWaste=row.wasteConv_waste;
      const rowConv=row.wasteConv_conv;
      const profWaste=isPP?(batchProfile.wastePP??5):(batchProfile.waste??5);
      const profConv=isPP?(batchProfile.convRatePP??12.5):(batchProfile.convRate??7);
      sp.waste=isPP?sp.waste:(rowWaste!==""&&rowWaste!=null?+rowWaste:profWaste);
      sp.convRate=isPP?sp.convRate:(rowConv!==""&&rowConv!=null?+rowConv:profConv);
      sp.wastePP=isPP?(rowWaste!==""&&rowWaste!=null?+rowWaste:profWaste):sp.wastePP;
      sp.convRatePP=isPP?(rowConv!==""&&rowConv!=null?+rowConv:profConv):sp.convRatePP;
      if(row.interestOverride!==""&&row.interestOverride!=null)sp.interest=+row.interestOverride;
      if(row.freightRowOverride!==""&&row.freightRowOverride!=null)sp.freightOverride=row.freightRowOverride;
      // ─────────────────────────────────────────────────────────────────────

      // ── Add-on costs from batch row into the spec ─────────────────────────
      applyAddOns(sp,row); // R-1: single injection point — see module-level applyAddOns
      // ─────────────────────────────────────────────────────────────────────
      const existing=items.findIndex(i=>
        (i.spec.material_code||"")===row.matCode&&(i.spec.rowType||"Box")===(row.itemType||"Box"));
      sentRowIds.add(row.id); // Fix 4: record that this row was actually sent
      if(existing>=0){
        // Update existing
        setItems(prev=>prev.map((item,idx)=>idx===existing
          ?{...item,spec:sp,result:res,status:"batch-updated"}:item));
      } else {
        newItems.push({id:Date.now()+Math.random(),spec:sp,result:res,
          status:"batch",note:"",timestamp:new Date().toLocaleString("en-IN")});
      }
    });
    if(newItems.length)setItems(prev=>[...prev,...newItems]);
    // Fix 4: only mark rows that were actually sent as Reviewed — not rows that were skipped
    setBatchRows(prev=>prev.map(r=>sentRowIds.has(r.id)?{...r,reviewed:true,status:"reviewed"}:r));
    if(skippedRows.length>0){
      showToast(`⚠️ ${skippedRows.length} row(s) skipped (no result): ${skippedRows.join(", ")}`,'error',7000);
    }
    setTab("items");
  };

  const generateCode=(seq)=>{
    const cli=(batchProfile.client||"SKU").replace(/\s+/g,"").substring(0,4).toUpperCase();
    const d=new Date();
    const ym=`${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,"0")}`;
    return `${cli}${ym}-${String(seq).padStart(3,"0")}`;
  };

  const generateMissingCodes=()=>{
    let seq=autoCodeSeq;
    setBatchRows(prev=>prev.map(r=>{
      if(r.matCode)return r;
      const code=generateCode(seq++);
      return{...r,matCode:code,autoCode:true};
    }));
    setAutoCodeSeq(seq);
  };

  const addBatchRow=(itemType="Box")=>{
    const id=Date.now();
    const matCode=autoCodeEnabled?generateCode(autoCodeSeq):"";
    if(autoCodeEnabled)setAutoCodeSeq(s=>s+1);
    setBatchRows(prev=>{
      // For Main Box: SET Code = Mat Code (same identity)
      // For non-Box rows (Plate/Part-L/Part-W/Other): find the nearest preceding
      // confirmed Main Box and inherit its SET Code (not its Mat Code — they may
      // have diverged if the user renamed the SET Code manually).
      // Guard: only inherit if the parent Box's own SET Code is confirmed
      // (setCodeAssumed===false). If the parent itself is unconfirmed, leave blank
      // rather than stacking assumption on assumption.
      let setCode="";
      let setCodeAssumed=false;
      if(itemType==="Box"){
        setCode=matCode; // Main Box: SET Code = own Mat Code
      } else {
        // Walk backwards to find the nearest preceding confirmed Main Box
        const boxes=[...prev].reverse().filter(r=>r.itemType==="Box"&&r.matCode&&!r.setCodeAssumed);
        if(boxes.length>0){
          setCode=boxes[0].setCode||boxes[0].matCode; // prefer setCode; fall back to matCode
          setCodeAssumed=true; // flag: assumed from preceding Box, confirm/override
        }
      }
      return[...prev,{
        id,matCode,product:"",itemType,setCode,setCodeAssumed,constructionCode:"",setAutoFill:true,
        L:"",W:"",H:"",ups:1,
        boxType:itemType==="Box"?"RSC":"PP",
        spec_bs:"",spec_bct:"",nosPerSet:1,
        salesMOQ:"",volume:"",marginOverride:"",remarks:"",
        reviewed:false,autoCode:autoCodeEnabled,status:"incomplete",
      }];
    });
  };

  const importConstrFromSpec=()=>{
    // Fix 14: shared helper — first UNUSED letter, not array.length (which reuses deleted codes)
    const LETTERS="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const usedCodes=new Set(constructionLib.map(c=>c.code));
    const nextCode=LETTERS.split("").find(l=>!usedCodes.has(l))||`C${constructionLib.length}`;
    // Fix 14: duplicate check (was missing from this path; the Construction Library tab has it, this didn't)
    const incomingSector=spec.sector||batchProfile.sector||"";
    const toStr=v=>(v===undefined||v===null||v===""?"":String(v).trim());
    const duplicate=constructionLib.find(c=>
      toStr(c.board_gsm)===toStr(spec.board_gsm)&&
      toStr(c.spec_bs)===toStr(spec.spec_bs)&&
      toStr(c.spec_bct)===toStr(spec.spec_bct)&&
      toStr(c.spec_ect)===toStr(spec.spec_ect)&&
      toStr(c.sector)===toStr(incomingSector)
    );
    if(duplicate){
      window.alert(`A construction with identical STDs already exists as [${duplicate.code}]. No duplicate created.`);
      setTab("constrlib");
      return;
    }
    const newConstr={
      code:nextCode,
      // name left blank — auto-derives from spec in constrAutoName; user can override
      name:"",
      boxType:spec.boxType||"RSC",ply:spec.ply||5,
      flute_F1:spec.flute_F1||"B",flute_F2:spec.flute_F2||"A",
      layers:JSON.parse(JSON.stringify(spec.layers||{})),
      board_gsm:spec.board_gsm||"",spec_bs:spec.spec_bs||"",
      spec_bct:spec.spec_bct||"",spec_ect:spec.spec_ect||"",
      waste:null,convRate:null,wastePP:null,convRatePP:null,
      // tagging fields
      sector:spec.sector||batchProfile.sector||"",
      client:spec.client||batchProfile.client||"",
      status:"active",
      // mill_preferences: per-layer grade+mill preference for rate lookup.
      // Populated via UI once GSheets Mill Master cache is live.
      // Grade: A/B/C from Mill Master. Mill: specific mill name (optional — grade alone is valid).
      // Empty object = no preference (engine uses lowest available price).
      mill_preferences:{
        TOP:{grade:"",mill:""},F1:{grade:"",mill:""},L1:{grade:"",mill:""},
        F2:{grade:"",mill:""},L2:{grade:"",mill:""},
      },
    };
    setConstructionLib(prev=>[...prev,newConstr]);
    setTab("batch");
  };

  const handleTemplateLoad=async(e)=>{
    const file=e.target.files[0];if(!file)return;
    const b64=await toB64(file);
    setTemplateB64(b64);
    setTemplateLoaded(true);
    try{localStorage.setItem('cbb_template',b64);}catch(e){} // persist across refreshes if possible
    setAiNotes('✅ Master template loaded. All Excel exports will now use your master format with formulas and formatting intact.');
    e.target.value='';
  };

  const handleImport=async(e)=>{
    const f=e.target.files[0];if(!f)return;
    try{const parsed=await parseImportedExcel(f,rates,freight,boxTrim);
      setItems(prev=>[...prev,...parsed]);
      setTab("items");setAiNotes(`✅ Imported ${parsed.length} item(s) from Excel.`);
    }catch(err){setAiNotes("❌ Import failed: "+err.message);}
    e.target.value="";
  };

  const gradeCodes=["",...rates.map(r=>r.code)];
  const card={background:C.white,border:`1px solid ${C.border}`,borderRadius:7,padding:"10px 12px",marginBottom:7};

  // ── SIDEBAR (left nav) ────────────────────────────────────────────────────
  const NAV_ITEMS=[
    ["costing","📊","Costing"],
    ["items","📋","Quote Items",items.length],
    ["batch","🗂","Batch Entry"],
    ["constrlib","📚","Construction Library",constructionLib.length],
    ["rates","💰","Rate Master"],
    ["freight","🚚","Freight Rates"],
    ["defaults","🛠","Defaults"],
    ...(role==="admin"?[["users","👥","Users"]]:[]),
  ];
  const sidebar=(
    <div style={{background:C.slate,display:"flex",flexDirection:"column",flexShrink:0,
      width:sidebarCollapsed?56:200,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 14px",
        borderBottom:`2px solid ${C.amber}`,height:48,boxSizing:"border-box"}}>
        <div style={{width:28,height:28,flexShrink:0,background:C.amber,borderRadius:6,display:"flex",
          alignItems:"center",justifyContent:"center",fontSize:14}}>📦</div>
        {!sidebarCollapsed&&<div style={{color:C.white,fontWeight:700,fontSize:12,lineHeight:1.2,whiteSpace:"nowrap"}}>
          CFB Quotation Master
          <div style={{fontSize:8,color:"rgba(255,255,255,.4)",fontWeight:400}}>AVADHOOT PACKS</div>
        </div>}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
        {NAV_ITEMS.map(([t,icon,l,count])=>(
          <button key={t} onClick={()=>setTab(t)} title={sidebarCollapsed?l:undefined}
            style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:sidebarCollapsed?"10px 0":"10px 16px",
              justifyContent:sidebarCollapsed?"center":"flex-start",border:"none",background:tab===t?"rgba(217,123,46,.15)":"none",
              borderLeft:tab===t?`3px solid ${C.amber}`:"3px solid transparent",
              fontFamily:sans,fontSize:12,fontWeight:600,cursor:"pointer",
              color:tab===t?C.amber:"rgba(255,255,255,.6)"}}>
            <span style={{fontSize:15,flexShrink:0}}>{icon}</span>
            {!sidebarCollapsed&&<span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
              {l}{!!count&&` (${count})`}</span>}
            {sidebarCollapsed&&!!count&&<span style={{position:"absolute",marginLeft:14,marginTop:-14,
              background:C.amber,color:C.white,borderRadius:8,fontSize:8,padding:"1px 4px"}}>{count}</span>}
          </button>))}
      </div>
      <button onClick={()=>setSidebarCollapsed(v=>!v)} title={sidebarCollapsed?"Expand sidebar":"Collapse sidebar"}
        style={{padding:"10px 0",border:"none",borderTop:`1px solid rgba(255,255,255,.1)`,
          background:"none",color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:13}}>
        {sidebarCollapsed?"»":"« Collapse"}
      </button>
    </div>
  );

  // ── TOP BAR (account + backup/restore) ───────────────────────────────────
  const topBar=(
    <div style={{background:C.slate,display:"flex",alignItems:"center",padding:"0 16px",
      height:48,borderBottom:`2px solid ${C.amber}`,flexShrink:0,gap:8}}>
      <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
        <AccountMenu onEditProfile={()=>setShowProfile(true)} onChangePassword={()=>setShowChangePassword(true)}/>
        <button onClick={handleBackup} title="Download a full backup of all app data (rates, freight, sectors, constructions, partitions)"
          style={{padding:"4px 10px",borderRadius:5,fontSize:11,fontWeight:600,border:"1px solid rgba(255,255,255,.25)",
            background:"rgba(255,255,255,.10)",color:"rgba(255,255,255,.80)",cursor:"pointer",fontFamily:sans}}>
          ⬇ Backup
        </button>
        <button onClick={handleRestore} title="Restore all app data from a previously downloaded backup file"
          style={{padding:"4px 10px",borderRadius:5,fontSize:11,fontWeight:600,border:"1px solid rgba(255,255,255,.25)",
            background:"rgba(255,255,255,.10)",color:"rgba(255,255,255,.80)",cursor:"pointer",fontFamily:sans}}>
          ⬆ Restore
        </button>
        <input ref={restoreRef} type="file" accept="application/json" style={{display:"none"}}
          onChange={handleRestoreFile}/>
      </div>
    </div>
  );

  // ── SPEC FORM (left panel) ─────────────────────────────────────────────────
  const specForm=(
    <div style={{overflowY:"auto",height:"100%",padding:"10px 10px 24px"}}>
      {aiNotes&&<div style={{background:aiNotes.startsWith("✅")?C.greenL:C.redL,
        border:`1px solid ${aiNotes.startsWith("✅")?C.green:C.red}33`,
        borderRadius:6,padding:"8px 12px",marginBottom:10,fontSize:11,
        color:aiNotes.startsWith("✅")?C.green:C.red}}>
        {aiNotes}<button onClick={()=>setAiNotes("")}
          style={{float:"right",background:"none",border:"none",cursor:"pointer",color:"inherit",fontSize:14}}>×</button>
      </div>}
      <div style={card}>
        <SH title="Client & Product"/>
        {/* Identity freeze — batch-wide fields (Client, Sector) are locked once a batch row exists.
            G3/G5: MatCode is locked only in REVIEW (activeBatchRowId set) so the Maker can set a new
            MatCode for the next SET component after Send. SKU/Product is always editable and pushable.
            Exit from START lock: click "Start new SKU" (clears specCommitted).
            Exit from REVIEW lock: "↑ Push" or "✕ Unlink". */}
        {(activeBatchRowId||specCommitted)&&<div style={{
            background:"#FFF8ED",border:`1px solid ${C.amber}`,borderRadius:5,
            padding:"5px 10px",marginBottom:5,fontSize:10,color:C.amberD,lineHeight:1.5}}>
          {activeBatchRowId
            ?`🔒 Reviewing Batch Row ${batchRows.indexOf(batchRows.find(r=>r.id===activeBatchRowId))+1} — Client, Sector and Mat Code locked. SKU/Product editable. Push changes or ✕ Unlink.`
            :`🔒 SKU sent to Batch Entry — Client and Sector locked to this batch. Edit Mat Code and SKU/Product for the next item, or click "Start new SKU" to reset.`}
        </div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 8px",marginBottom:5}}>
          {/* Client — frozen in both REVIEW and START-after-Send */}
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Client *</div>
            {(activeBatchRowId||specCommitted)
              ?<div style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,
                  fontSize:11,color:C.slateM,background:"#F5F5F5",cursor:"not-allowed"}}
                  title={activeBatchRowId?"Locked — reviewing existing Batch row":"Locked to batch — click Start new SKU to change"}>
                {spec.client||"—"}
              </div>
              :<Inp value={spec.client} onChange={v=>s("client",v)}/>}
          </div>
          {/* Sector — frozen in both REVIEW and START-after-Send */}
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Sector
              {activeBatchRowId&&<span style={{fontSize:8,color:C.amber,marginLeft:4,fontWeight:400}}>(from Profile)</span>}
              {(!activeBatchRowId&&specCommitted)&&<span style={{fontSize:8,color:C.amber,marginLeft:4,fontWeight:400}}>(locked to batch)</span>}
            </div>
            {(activeBatchRowId||specCommitted)
              ?<div style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,
                  fontSize:11,color:C.slateM,background:"#F5F5F5",cursor:"not-allowed"}}
                  title={activeBatchRowId?"Sector is a batch-wide field. Change it in the Batch Profile, not here.":"Locked to batch — click Start new SKU to change"}>
                {spec.sector||"—"}
              </div>
              :<Sel value={spec.sector||""} onChange={v=>{
                const sd=sectors.find(x=>x.code===v);
                setSpec(p=>({...p,sector:v,
                  ...(sd?{waste:sd.wasteCBB,convRate:sd.convBox,
                           wastePP:sd.wastePP,convRatePP:sd.convPP}:{})}));
              }} opts={[{v:"",l:"— select —"},...sectorCodes.map(sc=>({v:sc,l:sc}))]}/>}
          </div>
          {/* Material Code — frozen in REVIEW only; editable in START (including after Send) */}
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase"}}>Material Code</div>
              {!activeBatchRowId&&<button onClick={()=>{
                const cli=(spec.client||"SKU").replace(/[^A-Za-z0-9]/g,"").substring(0,4).toUpperCase();
                const d=new Date();const ym=String(d.getFullYear()).slice(-2)+String(d.getMonth()+1).padStart(2,"0");
                const mc=cli+ym+"-"+String(Math.floor(Math.random()*900)+100);
                s("material_code",mc);
                if(setAutoFill&&(!spec.rowType||spec.rowType==="Box"))s("setCode",mc);
                showToast("Code: "+mc,'info',1800);
              }} style={{background:"none",border:"none",cursor:"pointer",fontSize:9,color:C.amber,fontWeight:700,padding:0}}>⚡ Auto</button>}
            </div>
            {activeBatchRowId
              ?<div style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,
                  fontSize:11,color:C.slateM,background:"#F5F5F5",cursor:"not-allowed",fontFamily:mono}}
                  title="Mat Code locked — reviewing existing Batch row. Unlink to create a new SKU.">
                {spec.material_code||"—"}
              </div>
              :<Inp value={spec.material_code} onChange={v=>{
                s("material_code",v);
                if(setAutoFill&&(!spec.rowType||spec.rowType==="Box")&&(spec.setCode===""||spec.setCode===spec.material_code))
                  s("setCode",v);
              }} placeholder="e.g. LT700"/>}
          </div>
          {/* SKU / Product — always editable; in REVIEW it is pushable via the Push button */}
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>
              SKU / Product *{activeBatchRowId&&<span style={{fontSize:8,color:C.green,marginLeft:4,fontWeight:400}}>(pushable)</span>}
            </div>
            <Inp value={spec.product} onChange={v=>s("product",v)}/>
          </div>
        </div>

      </div>
      <div style={card}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,borderBottom:`1px solid ${C.amber}`,paddingBottom:3,marginBottom:7}}>
          <input type="checkbox" id="setAutoFillChk" checked={setAutoFill}
            onChange={e=>{
              const on=e.target.checked;
              setSetAutoFill(on);
              if(!on){s("setCode","");}
              else if(!spec.rowType||spec.rowType==="Box")s("setCode",spec.material_code||"");
            }}
            style={{accentColor:C.amber,cursor:"pointer",width:11,height:11}}/>
          <label htmlFor="setAutoFillChk" style={{fontSize:9,fontWeight:700,color:C.amber,textTransform:"uppercase",letterSpacing:"0.09em",cursor:"pointer",margin:0}}>
            Part of a SET
          </label>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"90px 1fr 72px",gap:"0 7px",marginBottom:4}}>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>SET Code</div>
            <Inp value={spec.setCode} onChange={v=>s("setCode",v.toUpperCase())} placeholder="e.g. A"/>
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Set Role</div>
            <Sel value={spec.rowType} onChange={v=>{
              s("rowType",v);
              if(v==="Plate"||v==="Part-L"||v==="Part-W"){
                s("boxType","PP");
                // Do NOT clear skuType — Glass SKU Type is SET-level context, persists across role changes.
                // Part-L / Part-W: re-derive qtyPerSet from partitionsMaster for the new role.
                // Plate: do NOT modify qtyPerSet — Plate Nos/Set is at the Maker's discretion.
                if((v==="Part-L"||v==="Part-W")&&spec.skuType){
                  const _pm=partitionsMaster.find(x=>x.skuType===spec.skuType);
                  if(_pm) s("qtyPerSet",v==="Part-L"?_pm.lwise:_pm.wwise);
                }
              } else if(v==="Box"){s("boxType","RSC");}
            }}
              opts={[{v:"Box",l:"Main Box"},{v:"Plate",l:"Plate"},{v:"Part-L",l:"Partition-L"},{v:"Part-W",l:"Partition-W"},{v:"Other",l:"Other"}]}/>
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>
              Nos/Set <span style={{fontSize:8,fontWeight:400,color:C.slateL}}>pcs</span>
            </div>
            <input value={spec.qtyPerSet??1} type="number" min="1" step="1"
              onChange={e=>s("qtyPerSet",Math.max(1,+e.target.value||1))}
              style={{width:"100%",padding:"4px 5px",border:`1px solid ${spec.qtyPerSet>1?C.amber:C.border}`,
                borderRadius:4,fontSize:11,textAlign:"center",boxSizing:"border-box",
                fontWeight:spec.qtyPerSet>1?700:400,color:spec.qtyPerSet>1?C.amberD:C.slate}}/>
            {spec.qtyPerSet>1&&<div style={{fontSize:8,color:C.amberD,marginTop:1,textAlign:"center"}}>
              ×{spec.qtyPerSet} in SET rate</div>}
          </div>
        </div>
        {/* Auto-dims from parent Box: search batchRows first (primary), then items (legacy fallback) */}
        {spec.rowType!=="RS4"&&spec.setCode&&(()=>{
          const sc=(spec.setCode||"").trim().toUpperCase();
          // Issue 3 fix: parent Box is in batchRows (primary workflow path).
          // items (Quote Items) is the legacy path — kept as fallback only.
          const parent=
            batchRows.find(r=>(r.setCode||"").trim().toUpperCase()===sc&&(r.itemType||"Box")==="Box")||
            items.find(i=>(i.spec.setCode||"").trim().toUpperCase()===sc&&i.spec.rowType==="Box");
          if(!parent)return null;
          const pL=parent.L??parent.spec?.L;
          const pW=parent.W??parent.spec?.W;
          const pH=parent.H??parent.spec?.H;
          if(!pL||!pW||!pH)return null;
          const hints={Plate:`Plate: L=${+pL-5}mm, W=${+pW-5}mm`,
            "Part-L":`Part-L: L=${+pL-5}mm, W=${+pH-15}mm`,"Part-W":`Part-W: L=${+pW-5}mm, W=${+pH-15}mm`};
          const srcLabel=parent.matCode||parent.spec?.material_code||"parent Box";
          return<div style={{padding:"8px 10px",background:C.greenL,borderRadius:6,
            fontSize:11,color:C.green,marginTop:-4}}>
            <strong>Auto-dims from {srcLabel}:</strong> {hints[spec.rowType]||""}
            <Btn ch="Apply" v="success" sm style={{marginLeft:8}} onClick={()=>{
              if(spec.rowType==="Plate"){s("L",+pL-5);s("W",+pW-5);}
              else if(spec.rowType==="Part-L"){s("L",+pL-5);s("W",+pH-15);}
              else if(spec.rowType==="Part-W"){s("L",+pW-5);s("W",+pH-15);}
            }}/>
          </div>;
        })()}
        {/* Glass SKU Type — Alcobev partitions only */}
        {spec.sector==="ALCOBEV"&&(spec.rowType==="Part-L"||spec.rowType==="Part-W")&&<div style={{marginTop:6,padding:"8px 10px",background:"#EEF4FB",border:"1px solid #6A9FD433",borderRadius:6}}>
          <div style={{fontSize:9,color:"#2E6094",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>
            Glass SKU Type <span style={{fontSize:8,fontWeight:400}}>(auto-fills Nos/Set)</span>
          </div>
          <Sel value={spec.skuType||""} onChange={v=>{
            s("skuType",v);
            const pm=partitionsMaster.find(x=>x.skuType===v);
            if(pm){s("qtyPerSet",spec.rowType==="Part-L"?pm.lwise:pm.wwise);}
          }} opts={[{v:"",l:"— select SKU type —"},...partitionsMaster.map(x=>({v:x.skuType,l:x.skuType}))]}/>
          {spec.skuType&&(()=>{
            const pm=partitionsMaster.find(x=>x.skuType===spec.skuType);
            return pm?<div style={{fontSize:9,color:"#2E6094",marginTop:3}}>
              L-wise: {pm.lwise} pcs · W-wise: {pm.wwise} pcs →
              <b style={{color:C.amber,marginLeft:4}}>Nos/Set = {spec.rowType==="Part-L"?pm.lwise:pm.wwise}</b>
            </div>:null;
          })()}
        </div>}
      </div>

      {/* G6: Construction cue — shown when SET Role is non-Box and construction is non-blank.
          Derived from current values; no state tracking needed. This is a reminder only —
          it does NOT imply the retained construction is correct for this role. The Maker
          must confirm or change it. Box→PP does not require different construction;
          Part-L→Part-W does not require the same construction. */}
      {!activeBatchRowId&&(spec.rowType&&spec.rowType!=="Box")&&(
        spec.layers?.TOP?.code||spec.layers?.F1?.code||spec.layers?.L1?.code
      )&&<div style={{background:"#FFF8ED",border:`1px solid ${C.amber}`,borderRadius:5,
          padding:"6px 10px",marginBottom:4,fontSize:10,color:C.amberD,lineHeight:1.5}}>
        ⚠️ <b>Construction inherited from previous item</b> — confirm or change before sending.
        The retained construction is a starting default only, not a recommendation for this SET role.
      </div>}
      <div style={card}>
        <SH title="Dimensions & Construction"/>
        {/* Row 1: L W H Ups Dim */}
        <div style={{display:"grid",gridTemplateColumns:"62px 62px 62px 1fr 56px",gap:"4px 5px",marginBottom:4}}>
          {[["L","L (mm)"],["W","W (mm)"],["H","H (mm)"]].map(([k,lbl])=>(
            <div key={k}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>{lbl}</div>
              <Inp value={spec[k]} onChange={v=>s(k,v)} type="number"/>
            </div>))}
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Ups</div>
            <Inp value={spec.ups} onChange={v=>s("ups",+v)} type="number"/>
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Dim</div>
            <Sel value={spec.dimType} onChange={v=>s("dimType",v)} opts={["ID","OD"]}/>
          </div>
        </div>
        {/* Row 2: Box Type Ply F1 F2 — Box Type 1fr (fills available width), PLY 68px (fits 3-ply/5-ply) */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 68px 58px 58px",gap:"4px 5px",marginBottom:2}}>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Box Type</div>
            <Sel value={spec.boxType} onChange={v=>s("boxType",v)} opts={BOX_TYPES}/>
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Ply</div>
            <Sel value={spec.ply} onChange={v=>s("ply",+v)} opts={[{v:3,l:"3-ply"},{v:5,l:"5-ply"}]}/>
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>F1 Flute</div>
            <Sel value={spec.flute_F1} onChange={v=>s("flute_F1",v)} opts={["A","B","C","E"]}/>
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>F2 Flute</div>
            <Sel value={spec.flute_F2} onChange={v=>s("flute_F2",v)}
              opts={[{v:"",l:"—"},...["A","B","C","E"].map(f=>({v:f,l:f}))]}/>
          </div>
        </div>
      </div>
      {/* ── Live Die-line Preview ── */}
      {(spec.L&&spec.W&&spec.H)&&(
      <div style={{background:"#FAFAFA",borderRadius:6,border:"1px solid #E8E0D4",padding:"8px 10px",marginBottom:4}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontSize:9,fontWeight:700,color:"#9A7B4A",textTransform:"uppercase",letterSpacing:"0.07em"}}>
            Die-Line Preview
          </span>
          <span style={{fontSize:8,color:"#AAA"}}>
            {spec.boxType==="Die-R"||spec.boxType==="Die-S"
              ? "⚠ Approximation only — use customer KLD for die-cut SKUs"
              : `Flat blank: ${Math.round(2*(+spec.L||0)+(2*(+spec.W||0))+Math.max((+spec.W||0)*0.1,15))}×${Math.round((+spec.H||0)+2*Math.min((+spec.W||0)/2,(+spec.H||0)))} mm (RSC est.)`
            }
          </span>
        </div>
        <div style={{overflowX:"auto"}}>
          <BoxDieline L={spec.L} W={spec.W} H={spec.H}
            boxType={spec.boxType||"RSC"} dimType={spec.dimType} ups={spec.ups}/>
        </div>
      </div>)}
      <div style={card}>
        <SH title="Paper Construction"/>
        <div style={{display:"grid",gridTemplateColumns:"72px 1fr 80px 52px",gap:"3px 5px",
          fontSize:9,color:C.slateL,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>
          <div>Layer</div><div>Grade</div><div style={{textAlign:"center"}}>GSM</div><div style={{textAlign:"center"}}>Flute</div>
        </div>
        {[["TOP","TOP Liner",false,null],["F1","F1 Medium",true,"flute_F1"],
          ["L1","L1 Liner",false,null],["F2","F2 Medium",true,"flute_F2"],["L2","L2 Liner",false,null]]
        .map(([k,lbl,isF,fk])=>(
          <div key={k} style={{display:"grid",gridTemplateColumns:"72px 1fr 80px 52px",gap:"3px 5px",
            marginBottom:4,alignItems:"center"}}>
            <div style={{fontSize:11,fontWeight:600,color:C.slateM}}>{lbl}</div>
            <select value={spec.layers[k]?.code||""} onChange={e=>s(`layers.${k}.code`,e.target.value)}
              style={{...inputSt,fontFamily:mono,fontSize:11}}>
              {gradeCodes.map(c=><option key={c} value={c}>{c||"— select —"}</option>)}
            </select>
            <Inp value={spec.layers[k]?.gsm||""} onChange={v=>s(`layers.${k}.gsm`,v)} type="number" placeholder="GSM"/>
            {isF?<Sel value={spec[fk]||""} onChange={v=>s(fk,v)}
              opts={[{v:"",l:"—"},...["A","B","C","E"].map(f=>({v:f,l:f}))]}/>
            :<div style={{textAlign:"center",fontSize:11,color:C.slateL}}>—</div>}
          </div>))}
      </div>
      <div style={card}>
        <SH title="Board Specifications"/>
        {(()=>{
          // Tolerance order cycles on click: min → avg → max → min
          const TOL_SEQ=["min","avg","max"];
          const TOL_LABEL={min:"Min",avg:"Avg",max:"Max"}; // abbreviated to fit panel width
          const TC={min:"#3B82F6",avg:"#9B6F2F",max:"#C0392B"};
          const cobbV=spec.spec_cobb?+spec.spec_cobb:null;
          const cobbWarn=cobbV&&cobbV<=125;
          const sheetG=r?Math.round(r.wtSheet*1000):null;
          const estG=r?Math.round(r.estimatedBoxWt*1000):null;
          const reqG=spec.reqBoxWt&&+spec.reqBoxWt>0?+spec.reqBoxWt:null;
          const diffPct=reqG&&estG?Math.abs(estG-reqG)/reqG:null;
          const wtOk=diffPct!==null&&diffPct<=0.015;
          // Input row: flex with value taking 1fr and chip fixed 36px
          // Label sits above as a separate flex row — no wasted spacer column
          // Cycling chip — inline, right of value field
          const TolChip=({tk,def})=>{
            const tol=spec[tk]||def;
            const isDefault=tol===def;
            const next=TOL_SEQ[(TOL_SEQ.indexOf(tol)+1)%3];
            return(
              <button onClick={()=>s(tk,next)}
                title={`Tolerance: ${TOL_LABEL[tol]}${tol==="avg"?" ±5%":""} — click to cycle`}
                style={{flexShrink:0,width:28,padding:"1px 2px",
                  borderRadius:3,border:`1px solid ${isDefault?"#D8D8D8":TC[tol]}`,
                  background:isDefault?"#F4F4F4":TC[tol]+"18",
                  color:isDefault?"#AAA":TC[tol],
                  fontSize:6.5,fontWeight:isDefault?400:700,
                  cursor:"pointer",lineHeight:1.4,whiteSpace:"nowrap",
                  textAlign:"center",display:"block"}}>
                {TOL_LABEL[tol]}
              </button>);
          };
          const LEFT=[
            {k:"board_gsm",lbl:"GSM", unit:"g/m²",   stp:5,   def:"avg"},
            {k:"spec_bs",  lbl:"BS",  unit:"kg/cm²",  stp:0.25,def:"min"},
            {k:"spec_cobb",lbl:"Cobb",unit:"g/m²",   stp:5,   def:"max"},
          ];
          const RIGHT=[
            {k:"spec_ect",   lbl:"ECT",    unit:"kN/m", stp:0.25,def:"min"},
            {k:"spec_bct",   lbl:"BCT",    unit:"kgf",  stp:5,   def:"min"},
            {k:"reqBoxWt",   lbl:"Net Wt", unit:"g",    stp:1,   def:"avg"},
          ];
          // Row: label+unit inline on left (baseline-aligned), input+chip right-aligned.
          // inpColSt: marginRight:2 keeps chip 2px inside column edge.
          // RIGHT map overrides with marginLeft:-3 to pull that bundle leftward.
          const rowSt={display:"flex",alignItems:"center",gap:4,marginBottom:3};
          const lblColSt={flex:"0 0 38%",minWidth:0,display:"flex",alignItems:"baseline",gap:3,flexWrap:"nowrap",paddingLeft:2};
          const inpColSt={display:"flex",gap:3,alignItems:"center",marginRight:2};
          // Sub-header: matches Paper Construction column header style exactly —
          // fontSize:9, slateL, bold, uppercase, no border, marginBottom:4.
          const SubHdr=({title})=>(
            <div style={{fontSize:9,fontWeight:700,color:C.slateL,textTransform:"uppercase",
              letterSpacing:"0.09em",marginBottom:4}}>{title}</div>);
          return(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px",marginBottom:4}}>
                {/* LEFT: GSM · BS · Cobb */}
                <div>
                  <SubHdr title="Board"/>
                  {LEFT.map(({k,lbl,unit,stp,def},i)=>{
                    const tk=k+"_tol";
                    const tol=spec[tk]||def;
                    const isDefault=tol===def;
                    const hasVal=spec[k]&&+spec[k]>0;
                    const isCobbWarn=k==="spec_cobb"&&cobbWarn;
                    return(
                    <div key={k} style={{...rowSt,marginBottom:i<2?3:0}}>
                      <div style={lblColSt}>
                        <span style={{fontSize:10,fontWeight:600,color:C.slateM,lineHeight:1}}>{lbl}</span>
                        <span style={{fontSize:7,color:C.slateL,lineHeight:1}}>{unit}</span>
                      </div>
                      <div style={inpColSt}>
                        <Inp value={spec[k]??""} type="number" step={stp}
                          onChange={v=>s(k,v)}
                          st={{textAlign:"right",width:64,boxSizing:"border-box",padding:"3px 5px",
                            borderColor:isCobbWarn?C.amber:hasVal&&!isDefault?TC[tol]:undefined,
                            background:isCobbWarn?"#FFF8ED":undefined}}/>
                        <TolChip tk={tk} def={def}/>
                      </div>
                    </div>);
                  })}
                  {/* Cobb remark — sits flush under left panel, only when triggered */}
                  {cobbWarn&&<div style={{fontSize:8,color:C.amber,marginTop:4,lineHeight:1.3}}>
                    Cobb&#8804;125 → confirm Coating</div>}
                </div>
                {/* RIGHT: ECT · BCT · Net Wt — unified, no separator before Net Wt */}
                <div>
                  <SubHdr title="Performance"/>
                  {RIGHT.map(({k,lbl,unit,stp,def},i)=>{
                    const tk=k+"_tol";
                    const tol=spec[tk]||def;
                    const isDefault=tol===def;
                    const isNetWt=k==="reqBoxWt";
                    const val=isNetWt?spec.reqBoxWt:spec[k];
                    const hasVal=val&&+val>0;
                    const onChange=isNetWt?(v=>s("reqBoxWt",v)):(v=>s(k,v));
                    return(
                    <div key={k} style={{...rowSt,marginBottom:i<2?3:0}}>
                      <div style={lblColSt}>
                        <span style={{fontSize:10,fontWeight:600,color:C.slateM,lineHeight:1}}>{lbl}</span>
                        <span style={{fontSize:7,color:C.slateL,lineHeight:1}}>{unit}</span>
                      </div>
                      <div style={{...inpColSt,marginLeft:-3}}>
                        <Inp value={val??""} type="number" step={stp}
                          onChange={onChange}
                          st={{textAlign:"right",width:64,boxSizing:"border-box",padding:"3px 5px",
                            borderColor:hasVal&&!isDefault?TC[tol]:undefined}}/>
                        <TolChip tk={tk} def={def}/>
                      </div>
                    </div>);
                  })}
                  {/* Weight remarks — sits flush under right panel */}
                  {(sheetG||estG||reqG)&&<div style={{fontSize:8,color:C.slateM,marginTop:4,lineHeight:1.3}}>
                    {sheetG&&<span>Sheet: <b style={{fontFamily:mono,color:C.slate}}>{sheetG} g</b></span>}
                    {estG&&<span style={{marginLeft:6}}>Est: <b style={{fontFamily:mono,color:C.green}}>{estG} g</b>
                      {spec.boxType!=="RSC"&&<span style={{color:C.orange,fontSize:7,marginLeft:2}}>&#9888; verify</span>}
                    </span>}
                    {reqG&&estG&&<span style={{marginLeft:6,color:wtOk?C.green:C.red,fontWeight:600}}>
                      {wtOk?"On target":"\u26A0 "+(diffPct*100).toFixed(1)+"%"}
                    </span>}
                  </div>}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
      <div style={card}>
        <SH title="Commercial Intelligence"/>
        {/* Volume + MOQ — compact 2-col layout */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 8px",marginBottom:5}}>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>
              Volume (nos/month) <span style={{color:C.red}}>*</span></div>
            <Inp value={spec.volume} onChange={v=>s("volume",v)} type="number" step="100" placeholder="boxes/mo"/>
            {r?.calcMOQ&&<div style={{fontSize:9,color:C.slateL,marginTop:2,display:"flex",gap:4}}>
              {[1,2,3].map(m=><button key={m} onClick={()=>s("volume",r.calcMOQ*m)}
                style={{padding:"2px 7px",borderRadius:4,fontSize:9,cursor:"pointer",border:`1px solid ${C.border}`,
                  background:+spec.volume===r.calcMOQ*m?C.amberL:C.white,
                  color:+spec.volume===r.calcMOQ*m?C.amberD:C.slateL}}>{m}×MOQ</button>)}
            </div>}
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>
              Proposed MOQ (boxes)</div>
            <div style={{display:"flex",gap:4,alignItems:"center"}}>
              <Inp value={spec.salesMOQ} onChange={v=>s("salesMOQ",v)} type="number" placeholder="boxes"/>
              {r?.calcMOQ&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:5,whiteSpace:"nowrap",
                background:spec.salesMOQ&&+spec.salesMOQ<r.calcMOQ?C.redL:C.greenL,
                color:spec.salesMOQ&&+spec.salesMOQ<r.calcMOQ?C.red:C.green,fontWeight:700}}>
                Min {r.calcMOQ.toLocaleString()}</span>}
            </div>
            {r?.calcMOQ&&<div style={{fontSize:9,color:C.slateL,marginTop:2}}>
              {r.moqKg.toLocaleString()} kg ÷ {r.wt.toFixed(3)} kg/box</div>}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6,marginBottom:4}}>
          <div>
            <div style={{fontSize:9,fontWeight:600,color:C.slateL,textTransform:"uppercase",marginBottom:2}}>Customer Type</div>
            <Sel value={spec.customerType} onChange={v=>s("customerType",v)}
              opts={[{v:"strategic",l:"Strategic / Key Account"},{v:"new",l:"New Customer"},
                {v:"existing",l:"Existing Customer"},{v:"spot",l:"Spot / One-time"}]}/>
          </div>
          <div>
            <div style={{fontSize:9,fontWeight:600,color:C.slateL,textTransform:"uppercase",marginBottom:2}}>Price Context</div>
            <Sel value={spec.priceContext} onChange={v=>s("priceContext",v)}
              opts={[{v:"sensitive",l:"Price sensitive (street price known)"},{v:"unknown",l:"Price unknown"},
                {v:"premium",l:"Premium / quality buyer"},{v:"tender",l:"Tender / bid"}]}/>
          </div>
        </div>
        <div style={{marginBottom:4}}>
          <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>
            Payment Discipline
          </div>
          <select value={spec.paymentDisc||"30"}
            onChange={e=>{
              s("paymentDisc",e.target.value);
              const m={"30":0.5,"45":0.75,"60":1.0,"90":1.5};
              s("interest",m[e.target.value]||1.5);
            }}
            style={{...inputSt,color:C.slateM}}>
            <option value="30">Prompt — ≤ 30 days (Interest: 0.5%)</option>
            <option value="45">Moderate — ≤ 45 days (Interest: 0.75%)</option>
            <option value="60">Delayed — ≤ 60 days (Interest: 1.0%)</option>
            <option value="90">Chronic — ≤ 90 days (Interest: 1.5%)</option>
          </select>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",fontSize:11,color:C.slateL}}>
          <input type="checkbox" checked={spec.isRepeat} onChange={e=>s("isRepeat",e.target.checked)}
            style={{width:13,height:13,accentColor:C.amber}}/>
          Repeat customer / same SKU
        </label>
      </div>
      <div style={card}>
        <SH title="Commercial Parameters"/>
        {/* B2: Plant and Delivery are batch-wide fields — in REVIEW mode (activeBatchRowId set)
            buildSpecFromRow reads prof.plant/delivery, never spec.*. Show read-only in REVIEW. */}
        {/* Layout: Row 1 — Plant | Delivery | Freight */}
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.7fr) minmax(0,1.7fr) minmax(0,1fr)",gap:"4px 8px",marginBottom:5}}>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Avadhoot Plant</div>
            {activeBatchRowId
              ?<div style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,
                  fontSize:11,color:C.slateM,background:"#F5F5F5",cursor:"not-allowed"}}
                  title="Plant is a batch-wide field. Change it in the Batch Profile.">{spec.plant||"—"}</div>
              :<Sel value={spec.plant} onChange={v=>s("plant",v)} opts={PLANTS} ph="— select —"/>}
          </div>
          <div>
            <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>Client Plant</div>
            {activeBatchRowId
              ?<div style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,
                  fontSize:11,color:C.slateM,background:"#F5F5F5",cursor:"not-allowed"}}
                  title="Delivery is a batch-wide field. Change it in the Batch Profile.">{spec.delivery||"—"}</div>
              :<Sel value={spec.delivery} onChange={v=>s("delivery",v)} opts={locations} ph="— select —"/>}
          </div>
          <div>
            {/* Freight: matrix value shown as placeholder. Override field stays blank = inherit.
                Missing combination shown as "— no rate" so the Maker knows to enter manually. */}
            {(()=>{
              const _mxFr=freight?.[spec.plant]?.[spec.delivery];
              const _hasMx=_mxFr!=null;
              const _mxVal=_hasMx?+_mxFr:null;
              const _isOvr=spec.freightOverride!==""&&spec.freightOverride!=null&&+spec.freightOverride>0;
              return(
              <div>
                <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2,whiteSpace:"nowrap"}}>
                  Freight Rs/kg{_isOvr&&<span style={{fontSize:8,color:C.amber,marginLeft:3,fontWeight:700}}>↑</span>}{!_hasMx&&!_isOvr&&<span style={{fontSize:9,color:C.red,marginLeft:3}}>⚠</span>}
                </div>
                <input type="number" step="0.25" min="0"
                  value={spec.freightOverride??""}
                  onChange={e=>s("freightOverride",e.target.value)}
                  placeholder={_hasMx?String(_mxVal):"— no rate"}
                  title={_isOvr?`Override active — matrix: ${_hasMx?_mxVal+" Rs/kg":"no entry"}`
                    :_hasMx?`Matrix: ${_mxVal} Rs/kg (${spec.plant||"?"} → ${spec.delivery||"?"})`
                    :`No freight rate for ${spec.plant||"?"}→${spec.delivery||"?"}. Enter a manual override.`}
                  style={{width:"100%",padding:"4px 5px",border:`1px solid ${_isOvr?C.amber:(!_hasMx&&!_isOvr)?C.red:C.border}`,
                    borderRadius:4,fontSize:11,textAlign:"center",boxSizing:"border-box",
                    background:_isOvr?"#FFF8ED":C.white,fontFamily:mono}}/>
              </div>);
            })()}
          </div>
        </div>
        {/* Row 2 — Waste | Conv | Margin | Interest. Placeholder shows effective inherited value.
            Input stays blank = inherit. Explicit entry = override (amber border). */}
        {(()=>{
          const isPP=isPPType(spec.rowType||"Box");
          const _effWaste=isPP?_wasteDefPP:_wasteDefBox;
          const _effConv=isPP?_convDefPP:_convDefBox;
          const _wKey=isPP?"wastePP":"waste";
          const _cKey=isPP?"convRatePP":"convRate";
          const _isOvW=spec[_wKey]!==""&&spec[_wKey]!=null&&+spec[_wKey]!==+_effWaste;
          const _isOvC=spec[_cKey]!==""&&spec[_cKey]!=null&&+spec[_cKey]!==+_effConv;
          const mgnOvr=spec.margin!==""&&spec.margin!=null&&+spec.margin!==(batchProfile.margin??8);
          const intOvr=spec.interest!==""&&spec.interest!=null&&+spec.interest!==(batchProfile.interest??0.5);
          const fld=(label,key,placeholder,isOvr)=>(
            <div>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",marginBottom:2,display:"flex",justifyContent:"center",gap:4}}>
                <span>{label}{isPP&&(key==="wastePP"||key==="convRatePP")?<span style={{fontSize:7,fontWeight:400}}> PP</span>:null}</span>
                {isOvr&&<span style={{fontSize:8,color:C.amber,fontWeight:400}}>↑</span>}
              </div>
              <input value={spec[key]??""} type="number" step="0.25" onChange={e=>s(key,e.target.value)}
                placeholder={placeholder!=null?String(placeholder):""}
                title={isOvr?`Override — effective: ${spec[key]}`:`Effective: ${placeholder}`}
                style={{width:"100%",padding:"4px 5px",border:`1px solid ${isOvr?C.amber:C.border}`,
                  borderRadius:4,fontSize:11,textAlign:"center",boxSizing:"border-box",
                  background:isOvr?"#FFF8ED":C.white}}/>
            </div>
          );
          return(
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"4px 8px",marginBottom:5}}>
            {fld("Waste %",_wKey,_effWaste,_isOvW)}
            {fld("Conv Rs/kg",_cKey,_effConv,_isOvC)}
            {fld("Margin %","margin",batchProfile.margin??8,mgnOvr)}
            {fld("Interest %","interest",batchProfile.interest??0.5,intOvr)}
          </div>);
        })()}
      </div>
      <div style={card}>
        <div style={{fontSize:9,fontWeight:700,color:C.amber,textTransform:"uppercase",letterSpacing:"0.09em",borderBottom:`1px solid ${C.amber}`,paddingBottom:3,marginBottom:8,display:"flex",alignItems:"baseline",justifyContent:"center",gap:6}}>
          <span>Add-on Costs</span>
          {(()=>{
            const LABELS={printing:"Print",stitching:"Stitch",coating:"Coat",
              handling:"Hdlg",moqCharge:"MOQ±",packing:"Pack",other:"Other",unloading:"Unload"};
            const active=Object.entries(LABELS).filter(([k])=>spec[k]&&+spec[k]>0)
              .map(([k,l])=>`${l} ₹${(+spec[k]).toFixed(0)}`);
            return active.length?<span style={{fontSize:8,fontWeight:400,color:C.amber,textTransform:"none",letterSpacing:0}}>({active.join(" · ")})</span>:null;
          })()}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"5px 8px"}}>
          {[["printing","Printing","Rs/pc"],["stitching","Stitching","Rs/pc"],["coating","Coating","Rs/pc"],["handling","Non-Std Hdlg","Rs/pc"],
            ["moqCharge","MOQ Chg","Rs/pc"],["packing","Packing","Rs/pc"],["other","Other","Rs/pc"],["unloading","Unloading","Rs/pc"]].map(([k,lbl,unit])=>(
            <div key={k}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:1}}>{lbl}</div>
              <div style={{display:"flex",alignItems:"center",gap:2}}>
                <input value={spec[k]??0} type="number" step="0.25" onChange={e=>s(k,+e.target.value)}
                  style={{width:"100%",padding:"4px 5px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center",boxSizing:"border-box",fontFamily:mono}}/>
                <span style={{fontSize:9,color:C.slateL,whiteSpace:"nowrap"}}>{unit}</span>
              </div>
            </div>))}
        </div>
      </div>
      {/* ── SinglePointQuoteFinalization: Costing is analysis-only ── */}
      {activeBatchRowId
        ? (()=>{
            // BH-1: detect if construction fields in Costing differ from the library entry
            // for the active batch row. If so, warn the Maker before they navigate away.
            const _activeRow=batchRows.find(r=>r.id===activeBatchRowId);
            const _libEntry=_activeRow?constructionLib.find(c=>c.code===_activeRow.constructionCode):null;
            const _constrChanged=_libEntry&&(
              +spec.ply!==+_libEntry.ply||
              spec.boxType!==_libEntry.boxType||
              spec.flute_F1!==_libEntry.flute_F1||
              spec.flute_F2!==_libEntry.flute_F2||
              JSON.stringify(spec.layers||{})!==JSON.stringify(_libEntry.layers||{})
            );
            return(<>
              {/* A2b: visible banner naming the linked row — Maker always knows which row is under review */}
              <div style={{background:"#EEF4FB",border:"1px solid #2E6094",borderRadius:5,
                  padding:"6px 10px",marginBottom:4,fontSize:11,color:"#2E6094",lineHeight:1.5}}>
                🔍 <b>Reviewing Batch Row {batchRows.indexOf(_activeRow)+1}</b>
                {_activeRow?.matCode?<> [{_activeRow.matCode}]</>:null}
                {_activeRow?.product?<span style={{fontWeight:400}}> — {_activeRow.product}</span>:null}
                <span style={{fontWeight:400,marginLeft:4,fontSize:10}}>
                  · Changes apply only on Push
                </span>
              </div>
              {_constrChanged&&<div style={{
                  background:"#FFF8ED",border:`1px solid ${C.amber}`,borderRadius:5,
                  padding:"6px 10px",marginBottom:4,fontSize:11,color:C.amberD,lineHeight:1.5}}>
                ⚠️ Construction changes not yet saved to Batch row <b>[{_activeRow?.matCode||"?"}]</b>.
                Push to apply, or Unlink to discard.
              </div>}
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button onClick={pushCostingToBatchRow}
                  style={{flex:1,padding:"9px",borderRadius:6,border:"none",fontFamily:sans,
                    fontSize:13,fontWeight:700,cursor:"pointer",
                    background:C.green,color:"white",letterSpacing:"0.02em"}}>
                  ↑ Push to Row {batchRows.indexOf(_activeRow)+1}{_activeRow?.matCode?` [${_activeRow.matCode}]`:""}
                </button>

              </div>
            </>);
          })()
        : (()=>{
            // Readiness state is hoisted (_sendReady etc.) — reference directly
            return(
            <div style={{borderRadius:7,border:`1px solid ${_sendReady?"#2E6094":"#C0A000"}`,
              background:_sendReady?"#EEF4FB":"#FFFBEA",
              padding:"10px 12px",marginTop:4}}>
              <div style={{fontSize:11,fontWeight:700,
                color:_sendReady?"#2E6094":"#7A4500",marginBottom:4}}>
                {_sendReady?"✅ Ready to send to Batch Entry":"⚠️ Costing → Batch Entry"}
              </div>
              <div style={{fontSize:10,color:_sendReady?"#2E6094":"#7A4500",lineHeight:1.5}}>
                {_sendReady
                  ?"Use → Send to Batch Entry in the header to create a batch row."
                  :"Resolve the items shown in the right panel to enable Send."}
              </div>
            </div>);
          })()}
    </div>
  );

  // ── OUTPUT PANEL (right) ──────────────────────────────────────────────────
  const outputPanel=(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,background:C.cream,flexShrink:0}}>
        <div style={{padding:"9px 14px",fontFamily:sans,fontSize:12,fontWeight:600,
          color:C.amber,borderBottom:`2px solid ${C.amber}`}}>Costing</div>
        <div style={{marginLeft:"auto",padding:"4px 8px",display:"flex",gap:6,alignItems:"center"}}>
          {/* Unlink — shown only in REVIEW mode (activeBatchRowId set). Moved from left panel bottom. */}
          {activeBatchRowId&&<Btn ch="✕ Unlink" v="ghost" sm onClick={()=>{
            if(!window.confirm(
              "Unlink will exit this review.\n\n"+
              "Client/Sector/Mat Code/SKU will be cleared. Construction and output specs will be carried forward as starting defaults for the next SKU.\n\n"+
              "Any unsaved Costing changes will be lost. Continue?"
            ))return;
            setSpec(specFromProfile());
            setActiveBatchRowId(null);
            setSpecCommitted(false);
            setCostingContext("same-batch"); // returning from REVIEW to same-batch workspace
          }}/>}
          {/* C12: Context badge — visible when BatchEntry has rows, distinguishes same-batch vs new-batch */}
          {batchRows.length>0&&(
            <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:3,
              background:costingContext==="new-batch"?"#EEF4FB":"#FFF8ED",
              color:costingContext==="new-batch"?"#2E6094":C.amberD,
              border:`1px solid ${costingContext==="new-batch"?"#6A9FD4":C.amber}44`,
              whiteSpace:"nowrap"}}>
              {costingContext==="new-batch"
                ?`✦ Scratchpad · ${batchRows.length} row${batchRows.length!==1?"s":""} parked in Batch Entry`
                :`🔗 Batch active · ${batchRows.length} row${batchRows.length!==1?"s":""}`}
            </span>)}
          {/* C13: Send button — disabled when new-batch context would hard-block */}
          {(()=>{
            const _newBatchBlocked=costingContext==="new-batch"&&batchRows.length>0;
            const _disabled=!!activeBatchRowId||!_sendReady||_newBatchBlocked;
            return(
            <button onClick={activeBatchRowId?undefined:sendCostingToBatch}
              disabled={_disabled}
              title={activeBatchRowId?"Unavailable while reviewing an existing Batch row. Unlink the review first."
                :_newBatchBlocked?"Scratchpad context — go to Batch Entry → + New Batch to clear the old batch first"
                :_sendReady?"Send this spec to Batch Entry as a new row"
                :"Complete dimensions and paper layers first — see panel"}
              style={{padding:"6px 14px",borderRadius:6,border:"none",fontFamily:sans,
                fontSize:12,fontWeight:700,
                cursor:_disabled?"not-allowed":"pointer",
                background:_disabled?"#C0C0C0":C.amber,
                color:"white",letterSpacing:"0.01em",
                opacity:_disabled?0.55:1,transition:"all 0.15s"}}>
              → Send to Batch Entry
            </button>);
          })()}
          <Btn ch="Start new SKU" v="ghost" sm
            disabled={!!activeBatchRowId}
            title={activeBatchRowId?"Unavailable while reviewing an existing Batch row. Unlink the review first to start a new SKU."
              :costingContext==="new-batch"?"Start a fresh scratchpad SKU — retains construction, reads nothing from the parked BatchEntry batch"
              :"Start a fresh Costing spec seeded from the current Batch Profile"}
            onClick={activeBatchRowId?undefined:()=>{
              // costingContext is intentionally NOT changed — Start New SKU preserves current context
              setSpec(costingContext==="new-batch"?specForNewBatch():specFromProfile());
              setSpecCommitted(false);setSetAutoFill(true);}}/>
          {/* Costing + New Batch: non-destructive independent scratchpad context. Does NOT clear BatchEntry. */}
          <Btn ch="+ New Batch" v="ghost" sm
            disabled={!!activeBatchRowId}
            title={activeBatchRowId?"Unavailable while reviewing an existing Batch row."
              :"Start an independent scratchpad context. BatchEntry rows remain completely untouched."}
            onClick={activeBatchRowId?undefined:()=>{
              if(batchRows.length>0&&!window.confirm(
                "Start a new scratchpad batch context in Costing?\n\n"+
                `Your existing Batch Entry batch (${batchRows.length} row${batchRows.length!==1?"s":""}) remains completely untouched.\n\n`+
                "To import this new work into Batch Entry, go to Batch Entry → + New Batch first.\n\n"+
                "OK = Start scratchpad / Cancel = Stay"
              ))return;
              setSpec({...INIT_SPEC,plant:"",delivery:""});
              setCostingContext("new-batch");
              setSpecCommitted(false);
              setSetAutoFill(true);
            }}/>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:12}}>
        {/* Diagnostics — Blockers (left) + Warnings (right) always side-by-side for equal height.
             Plant warning injected locally (plant/delivery not in costing.js checkMissingInfo). */}
        {(()=>{
          const _extraWarnings=[];
          if(!spec.plant||!spec.delivery) _extraWarnings.push("Avadhoot Plant & Client Plant not selected");
          const _allWarnings=[...missing.warnings,..._extraWarnings];
          if(missing.blockers.length===0&&_allWarnings.length===0) return null;
          return(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
            {/* Left col — Blockers */}
            <div style={{background:C.redL,border:`1px solid ${C.red}33`,borderRadius:6,padding:"8px 10px"}}>
              <div style={{fontSize:10,fontWeight:700,color:C.red,marginBottom:3}}>
                ❌ {missing.blockers.length} BLOCKER{missing.blockers.length>1?"S":""}</div>
              {missing.blockers.length>0
                ? missing.blockers.map((b,i)=><div key={i} style={{fontSize:10,color:C.red,paddingLeft:3}}>
                    · {b.replace(" — enter at least one layer","")}
                  </div>)
                : <div style={{fontSize:10,color:C.red,paddingLeft:3,opacity:.5}}>None</div>}
            </div>
            {/* Right col — Warnings */}
            <div style={{background:"#FFF8ED",border:`1px solid ${C.amber}44`,borderRadius:6,padding:"8px 10px"}}>
              <div style={{fontSize:10,fontWeight:700,color:C.amberD,marginBottom:3}}>
                ⚠️ {_allWarnings.length} WARNING{_allWarnings.length>1?"S":""}</div>
              {_allWarnings.length>0
                ? _allWarnings.map((w,i)=><div key={i} style={{fontSize:10,color:C.amberD,paddingLeft:3}}>· {w}</div>)
                : <div style={{fontSize:10,color:C.amberD,paddingLeft:3,opacity:.5}}>None</div>}
            </div>
          </div>);
        })()}
        {missing.blockers.length===0&&r&&<div style={{marginBottom:8,fontSize:11,color:C.green,fontWeight:600}}>
          ✅ Ready to quote{missing.warnings.length>0?` (${missing.warnings.length} warning${missing.warnings.length>1?"s":""} noted)`:""}</div>}
        {!r&&<div style={{padding:"16px 0"}}>
          <div style={{fontSize:12,fontWeight:600,color:C.slateM,marginBottom:12,textAlign:"center"}}>
            Complete these fields to generate costing</div>
          {[["📐","Dimensions","L × W × H in mm (Costing form → Dimensions)"],
            ["📄","Paper Construction","Select grade + GSM for at least TOP, F1 and L1 layers"],
            ["🏭","Commercial","Avadhoot Plant + Client Plant + Monthly Volume (nos/month)"],
            ["💰","Rates","Verify Rate Master prices are current — use Rate Master tab"],
          ].map(([icon,title,desc])=>(
            <div key={title} style={{display:"flex",gap:10,padding:"9px 12px",marginBottom:6,
              background:C.white,border:`1px solid ${C.border}`,borderRadius:7,alignItems:"flex-start"}}>
              <div style={{fontSize:18,flexShrink:0}}>{icon}</div>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:C.slate,marginBottom:2}}>{title}</div>
                <div style={{fontSize:11,color:C.slateL,lineHeight:1.45}}>{desc}</div>
              </div>
            </div>))}
        </div>}

        {r&&<>
          {/* Key numbers */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:10}}>
            <KN label="Final Rate" val={`₹${r.finalRate.toFixed(2)}`} hl
              sub={+spec.qtyPerSet>1?`×${spec.qtyPerSet} nos/set = ₹${(r.finalRate*(+spec.qtyPerSet)).toFixed(2)}/set`:"MROUND 0.05 · excl GST"}/>
            <KN label="Rate/kg (landed)" val={`₹${r.ratePerKg.toFixed(2)}`} sub="Sheet Wt basis · incl freight"/>
            <KN label="Paper Consumed" val={`${(r.wt*1000).toFixed(0)} g`}
              sub={+spec.qtyPerSet>1
                ?`×${spec.qtyPerSet} = ${((r.wt*(+spec.qtyPerSet))*1000).toFixed(0)}g total · Sheet Wt: ${(r.wtSheet*1000).toFixed(0)}g`
                :`Sheet Wt (excl waste): ${(r.wtSheet*1000).toFixed(0)} g`}/>
            <KN label="Calc MOQ" val={r.calcMOQ.toLocaleString()}
              sub={spec.salesMOQ?`Sales: ${(+spec.salesMOQ).toLocaleString()} ${+spec.salesMOQ<r.calcMOQ?"⚠️ below min":"✅"}`:`${r.moqKg.toLocaleString()} kg`}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:10}}>
            <KN label="Deckle" val={r.deckle+"mm"}/>
            <KN label="Cutting" val={r.cutting+"mm"}/>
            <KN label="Calc BS" val={r.calcBS} sub={spec.spec_bs?`Std: ${spec.spec_bs}`:"no std set"}/>
            <KN label="Calc GSM" val={r.calcGSM} sub={spec.board_gsm?`Std: ${spec.board_gsm}`:"no std set"}/>
          </div>

          {/* Spec compliance */}
          {compliance.length>0&&<div style={{...card,padding:12,marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:700,color:C.slateM,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Specification Check</div>
            <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                {["Field","Std","Calc","Gap","Status","Action"].map(h=>(
                  <th key={h} style={{padding:"3px 7px",fontSize:9,color:C.slateL,
                    textTransform:"uppercase",textAlign:h==="Field"?"left":"center",fontWeight:600}}>{h}</th>))}
              </tr></thead>
              <tbody>{compliance.map((item,i)=>{
                const over=item.type==="over",high=item.severity==="high";
                const col=high?C.red:over?C.amberD:C.red;
                return<tr key={i} style={{background:i%2?C.cream:C.white}}>
                  <td style={{padding:"5px 7px",fontWeight:600,color:C.slateM}}>{item.field}</td>
                  <td style={{padding:"5px 7px",textAlign:"center",fontFamily:mono}}>{item.std} {item.unit}</td>
                  <td style={{padding:"5px 7px",textAlign:"center",fontFamily:mono}}>{item.calc} {item.unit}</td>
                  <td style={{padding:"5px 7px",textAlign:"center",fontWeight:700,color:col,fontFamily:mono}}>
                    {item.pct>0?"+":""}{item.pct}%</td>
                  <td style={{padding:"5px 7px",textAlign:"center"}}>
                    <span style={{background:high?C.redL:over?"#FFF8ED":C.redL,color:col,
                      padding:"2px 7px",borderRadius:10,fontSize:9,fontWeight:700}}>
                      {high?"❌ UNDER":over?"⚠️ OVER":"❌ UNDER"}</span></td>
                  <td style={{padding:"5px 7px",textAlign:"center",fontSize:10,color:over&&osSaving?C.green:C.slateL}}>
                    {over&&osSaving&&item.field.includes("Burst")
                      ?<><b>Save ₹{osSaving.saving}/box</b><br/><span style={{fontSize:9}}>{osSaving.note}</span></>
                      :high?"Upgrade needed":"Review"}
                  </td>
                </tr>;})}
              </tbody>
            </table>
          </div>}

          {/* Margin slider — min 0 */}
          <div style={{...card,padding:"10px 12px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:11,fontWeight:600,color:C.slateM,minWidth:50}}>Margin %</span>
              <input type="range" min={0} max={20} step={0.5} value={spec.margin}
                onChange={e=>s("margin",+e.target.value)} style={{flex:1,accentColor:C.amber}}/>
              <span style={{fontSize:15,fontWeight:800,color:C.amber,minWidth:34,textAlign:"right",fontFamily:mono}}>
                {spec.margin}%</span>
              <span style={{fontSize:13,fontWeight:700,color:C.slate,fontFamily:mono}}>→ ₹{r.finalRate.toFixed(2)}</span>
            </div>
            <div style={{display:"flex",gap:5,marginTop:7,flexWrap:"wrap",alignItems:"center"}}>
              {[0,6,8,10,12,15].map(m=><button key={m} onClick={()=>s("margin",m)}
                style={{padding:"3px 9px",borderRadius:5,fontSize:11,cursor:"pointer",
                  border:`1px solid ${+spec.margin===m?C.amber:C.border}`,
                  background:+spec.margin===m?C.amberL:C.white,
                  color:+spec.margin===m?C.amberD:C.slateL,fontWeight:+spec.margin===m?700:400}}>{m}%</button>)}
              {marginSugg.suggested!==+spec.margin&&(spec.customerType!=="existing"||spec.volume||spec.priceContext!=="unknown")&&(
                <button onClick={()=>s("margin",marginSugg.suggested)} style={{padding:"3px 10px",
                  borderRadius:5,fontSize:11,cursor:"pointer",border:`1px solid ${C.green}`,
                  background:C.greenL,color:C.green,fontWeight:700}}>
                  ✦ Suggested: {marginSugg.suggested}%</button>)}
            </div>
            {marginSugg.adjustments.length>0&&<div style={{marginTop:7,padding:"7px 9px",
              background:C.cream,borderRadius:5,fontSize:10,color:C.slateL,lineHeight:1.6}}>
              <b style={{color:C.slateM}}>Suggested: {marginSugg.suggested}%</b> — base 8%{marginSugg.adjustments.map(a=>" · "+a).join("")}
              {marginSugg.risk&&<span style={{marginLeft:6,color:C.amberD,fontWeight:600}}> {marginSugg.risk}</span>}
            </div>}
          </div>

          {/* Cost breakdown */}
          <div style={card}>
            <div style={{fontSize:10,fontWeight:700,color:C.slateM,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Cost Build-up</div>
            <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
              <tbody>
                {[["Material Cost (Paper Consumed)",r.mat],
                  ["Conversion",r.conv],
                  r.addOns>0&&[`Add-on Costs${(()=>{
                      const AL={printing:"Print",stitching:"Stitch",coating:"Coat",
                        handling:"Hdlg",moqCharge:"MOQ±",packing:"Pack",other:"Other",unloading:"Unload"};
                      const active=Object.entries(AL).filter(([k])=>spec[k]&&+spec[k]>0)
                        .map(([k,l])=>`${l} ₹${(+spec[k]).toFixed(2)}`);
                      return active.length?" ("+active.join("·")+")":"";
                    })()}`,r.addOns],
                  ["Interest",r.intC],
                  [`Freight (${r.frRate} Rs/kg)`,r.fr],
                  ["Margin ("+spec.margin+"%)",r.marginAmt]].filter(Boolean).map(([l,v])=>(
                  <tr key={l} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:"5px 0",color:C.slateM,fontSize:11}}>{l}</td>
                    <td style={{padding:"5px 0",textAlign:"right",fontWeight:600,fontFamily:mono,width:72}}>₹{(+(v??0)).toFixed(2)}</td>
                    <td style={{padding:"5px 0",textAlign:"right",fontFamily:mono,fontSize:10,color:C.amberD,width:60}}>
                      {r.wtSheet>0?`₹${(v/r.wtSheet).toFixed(2)}/kg`:"—"}</td>
                    <td style={{padding:"5px 0 5px 6px",width:80}}>
                      <div style={{height:4,borderRadius:2,background:C.paper}}>
                        <div style={{height:"100%",background:l.includes("Margin")?C.amber:C.slateM,borderRadius:2,
                          width:Math.min(100,v/r.finalRate*100).toFixed(0)+"%"}}/></div></td>
                    <td style={{padding:"5px 0",textAlign:"right",fontSize:10,color:C.slateL,width:28,fontFamily:mono}}>
                      {(v/r.finalRate*100).toFixed(0)}%</td>
                  </tr>))}
                <tr style={{borderTop:`2px solid ${C.amber}`}}>
                  <td style={{padding:"7px 0 3px",fontWeight:800,color:C.amber,fontSize:15,fontFamily:mono}} colSpan={2}>₹{r.finalRate.toFixed(2)}</td>
                  <td colSpan={2} style={{padding:"7px 0 3px",textAlign:"right",fontSize:10,color:C.slateL}}>LANDED RATE · excl GST</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Fluting BS Contribution Slider */}
          <div style={{...card,padding:"9px 12px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:11,fontWeight:600,color:C.slateM,minWidth:170}}>
                Fluting BS Contribution</span>
              <input type="range" min={0} max={30} step={1}
                value={Math.round((spec.flutingBCF!=null?spec.flutingBCF:0.10)*100)}
                onChange={e=>s("flutingBCF",+e.target.value/100)}
                style={{flex:1,accentColor:C.amber}}/>
              <span style={{fontSize:13,fontWeight:800,color:C.amber,minWidth:36,textAlign:"right",fontFamily:mono}}>
                {Math.round((spec.flutingBCF!=null?spec.flutingBCF:0.10)*100)}%</span>
            </div>
            <div style={{display:"flex",gap:5,marginTop:7}}>
              {[0,10,20,30].map(pct=>{
                const cur=Math.round((spec.flutingBCF!=null?spec.flutingBCF:0.10)*100);
                return<button key={pct} onClick={()=>s("flutingBCF",pct/100)}
                  style={{padding:"3px 9px",borderRadius:5,fontSize:11,cursor:"pointer",
                    border:`1px solid ${cur===pct?C.amber:C.border}`,
                    background:cur===pct?C.amberL:C.white,
                    color:cur===pct?C.amberD:C.slateL,fontWeight:cur===pct?700:400}}>
                  {pct}%</button>;})}
            </div>
            <div style={{fontSize:10,color:C.slateL,marginTop:5}}>
              Liner BCF = 1 always. Flute BCF = slider value. Formula: BS = Σ(BF_adj × BCF × GSM ÷ 1000).</div>
          </div>

          {/* Layer detail */}
          <div style={card}>
            <div style={{fontSize:10,fontWeight:700,color:C.slateM,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Layer Detail</div>
            <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                {["Layer","BF / Grade","GSM","TU","Paper Consumed","Sheet Wt","Rate","Cost"].map(h=>(
                  <th key={h} style={{padding:"3px 5px",fontSize:9,color:C.slateL,textTransform:"uppercase",
                    textAlign:h==="Layer"?"left":"center",fontWeight:600}}>{h}</th>))}
              </tr></thead>
              <tbody>{r.rowDetails.filter(x=>x.wt>0).map(x=>(
                <tr key={x.k} style={{borderBottom:`1px solid ${C.border}`}}>
                  <td style={{padding:"4px 5px",fontWeight:700,color:C.slateM,fontFamily:mono}}>{x.k}</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontFamily:mono}}>{x.code}</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontFamily:mono}}>{x.gsm}</td>
                  <td style={{padding:"4px 5px",textAlign:"center",color:C.slateL,fontFamily:mono}}>{x.tu?.toFixed(2)||"1.00"}</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontFamily:mono}}>{(x.wt*1000).toFixed(0)}g</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontFamily:mono,color:C.slateL}}>{(x.ws*1000).toFixed(0)}g</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontFamily:mono}}>₹{x.rate?.toFixed(2)}</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontWeight:700,fontFamily:mono}}>₹{x.cost?.toFixed(2)}</td>
                </tr>))}
                <tr style={{background:C.paper}}>
                  <td style={{padding:"4px 5px",fontWeight:700,fontSize:10,color:C.slateM}}>TOTAL</td>
                  <td style={{padding:"3px 5px",textAlign:"center",lineHeight:1.3}}>
                    <div style={{fontSize:8,color:C.slateL,textTransform:"uppercase"}}>Calc BS</div>
                    <div style={{fontWeight:800,fontFamily:mono,color:C.amber,fontSize:12}}>{r.calcBS}</div>
                  </td>
                  <td style={{padding:"3px 5px",textAlign:"center",lineHeight:1.3}}>
                    <div style={{fontSize:8,color:C.slateL,textTransform:"uppercase"}}>Calc GSM</div>
                    <div style={{fontWeight:800,fontFamily:mono,color:C.slateM,fontSize:12}}>{r.calcGSM}</div>
                  </td>
                  <td/>
                  <td style={{padding:"4px 5px",textAlign:"center",fontWeight:700,fontFamily:mono}}>{(r.wt*1000).toFixed(0)}g</td>
                  <td style={{padding:"4px 5px",textAlign:"center",fontWeight:700,fontFamily:mono,color:C.slateL}}>{(r.wtSheet*1000).toFixed(0)}g</td>
                  <td/>
                  <td style={{padding:"4px 5px",textAlign:"center",fontWeight:700,fontFamily:mono}}>₹{(r.mat||0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>}

      </div>
    </div>
  );

  // ── QUOTE ITEMS TAB ───────────────────────────────────────────────────────

  // ── BATCH ENTRY TAB ───────────────────────────────────────────────────────
  const STATUS_DISPLAY={
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
  const constrAutoName=(c)=>{
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

  const batchEntryTab=(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {/* ── BATCH PROFILE BAR — compact 3-section card + action column ─────── */}
      <div style={{background:"#FEF8F0",borderBottom:`2px solid ${C.amber}`,
        padding:"4px 12px 4px",flexShrink:0,display:"flex",gap:8,alignItems:"stretch"}}>

        {/* ── SECTION LABEL ── */}
        <div style={{display:"flex",alignItems:"center",marginRight:2}}>
          <span style={{color:C.amber,fontWeight:800,fontSize:10,textTransform:"uppercase",
            letterSpacing:"0.1em",writingMode:"vertical-rl",transform:"rotate(180deg)",
            whiteSpace:"nowrap"}}>Batch Profile</span>
        </div>

        {/* ── 1. CUSTOMER DETAILS — 3 × 2 grid (label | field) ── */}
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,
          padding:"4px 8px 4px 4px",display:"flex",flexDirection:"row",gap:6,alignItems:"stretch"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",width:14,flexShrink:0}}>
            <span style={{color:C.amber,fontWeight:700,fontSize:7.5,textTransform:"uppercase",
              letterSpacing:"0.12em",writingMode:"vertical-rl",transform:"rotate(180deg)",
              whiteSpace:"nowrap"}}>Customer</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto 1fr",
            columnGap:5,rowGap:3,alignItems:"center"}}>
            {/* Row 1: Client | Sector */}
            <span style={{fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"}}>Client</span>
            <input value={batchProfile.client||""} onChange={e=>setBatchProfile(p=>({...p,client:e.target.value}))}
              style={{padding:"2px 6px",borderRadius:3,border:`1px solid ${C.border}`,
                fontSize:10,background:C.white,color:C.slate,width:90,minWidth:0}}/>
            <span style={{fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"}}>Sector</span>
            <select value={batchProfile.sector||""} onChange={e=>{
                const v=e.target.value;
                const sd=sectors.find(x=>x.code===v);
                setBatchProfile(p=>({...p,sector:v,
                  waste:sd?sd.wasteCBB:5,convRate:sd?sd.convBox:7,
                  wastePP:sd?sd.wastePP:5,convRatePP:sd?sd.convPP:12.5,
                }));
              }} style={{padding:"2px 4px",borderRadius:3,border:`1px solid ${C.border}`,
                fontSize:9,background:C.white,color:C.slate,cursor:"pointer",minWidth:0,width:90}}>
              <option value="">— select —</option>
              {sectorCodes.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            {/* Row 2: Plant | Delivery */}
            <span style={{fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"}}>Plant</span>
            <select value={batchProfile.plant||""} onChange={e=>{
                const nv=e.target.value;
                setBatchProfile(p=>{
                  const newP={...p,plant:nv};
                  const fr=freight?.[nv]?.[p.delivery];
                  if(fr!==undefined) newP.freightOverride=fr;
                  return newP;
                });
              }} style={{padding:"2px 4px",borderRadius:3,border:`1px solid ${C.border}`,
                fontSize:9,background:C.white,color:C.slate,cursor:"pointer",minWidth:0,width:90}}>
              <option value="">— select —</option>
              {PLANTS.map(o=><option key={o} value={o}>{o}</option>)}
            </select>
            <span style={{fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"}}>Delivery</span>
            <select value={batchProfile.delivery||""} onChange={e=>{
                const nv=e.target.value;
                setBatchProfile(p=>{
                  const newP={...p,delivery:nv};
                  const fr=freight?.[p.plant]?.[nv];
                  if(fr!==undefined) newP.freightOverride=fr;
                  return newP;
                });
              }} style={{padding:"2px 4px",borderRadius:3,border:`1px solid ${C.border}`,
                fontSize:9,background:C.white,color:C.slate,cursor:"pointer",minWidth:0,width:90}}>
              <option value="">— select —</option>
              {locations.map(o=><option key={o} value={o}>{o}</option>)}
            </select>
            {/* Row 3: Cust Type | Price Context */}
            <span style={{fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"}}>Cust Type</span>
            <select value={batchProfile.customerType||'existing'}
              onChange={e=>setBatchProfile(p=>({...p,customerType:e.target.value}))}
              style={{padding:"2px 4px",borderRadius:3,border:`1px solid ${C.border}`,
                fontSize:9,background:C.white,color:C.slate,cursor:"pointer",minWidth:0,width:90}}>
              <option value="existing">Existing</option>
              <option value="new">New</option>
              <option value="strategic">Strategic</option>
              <option value="spot">Spot</option>
            </select>
            <span style={{fontSize:9,color:C.slateL,fontWeight:600,whiteSpace:"nowrap"}}>Price Ctx</span>
            <select value={batchProfile.priceContext||'unknown'}
              onChange={e=>setBatchProfile(p=>({...p,priceContext:e.target.value}))}
              style={{padding:"2px 4px",borderRadius:3,border:`1px solid ${C.border}`,
                fontSize:9,background:C.white,color:C.slate,cursor:"pointer",minWidth:0,width:90}}>
              <option value="unknown">Unknown</option>
              <option value="sensitive">Sensitive</option>
              <option value="premium">Premium</option>
              <option value="tender">Tender</option>
            </select>
          </div>
        </div>

        {/* ── 2. COMMERCIALS — header row + 2 data rows ── */}
        {(()=>{
          const sd=sectors.find(x=>x.code===batchProfile.sector);
          const defConvBox=sd?sd.convBox:7;
          const defConvPP=sd?sd.convPP:12.5;
          const defWstBox=sd?sd.wasteCBB:5;
          const defWstPP=sd?sd.wastePP:5;
          const isOvr=(key,def)=>{const v=batchProfile[key];return v!==undefined&&v!==null&&v!==''&&+v!==def;};
          const numField=(key,_w,def,step)=>{
            const ovr=isOvr(key,def);
            return<input type="number" step={step||0.25} value={batchProfile[key]??""}
              onChange={e=>{
                const raw=e.target.value;
                // Fix ②: blank on ANY numField (margin, waste, conv) must restore to sector default.
                // Previously only margin/marginPP were guarded — waste/conv went to 0 when cleared.
                if(raw===""||raw===null){setBatchProfile(p=>({...p,[key]:def}));return;}
                setBatchProfile(p=>({...p,[key]:+raw}));
              }}
              title={ovr?`Overriding sector default (${def})`:`Sector default: ${def}`}
              style={{width:"100%",padding:"2px 3px",borderRadius:3,textAlign:"center",
                boxSizing:"border-box",minWidth:0,
                border:`1px solid ${ovr?C.amber:C.border}`,
                background:ovr?"#FFF8ED":C.white,fontSize:10,color:C.slate}}/>;
          };
          const hdr={fontSize:8,fontWeight:700,color:C.slateL,textAlign:"center",textTransform:"uppercase",letterSpacing:"0.04em"};
          const lbl={fontSize:9,fontWeight:700,color:C.slateL,whiteSpace:"nowrap"};
          return(
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,
            padding:"4px 8px 4px 4px",display:"flex",flexDirection:"row",gap:6,alignItems:"stretch"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",width:14,flexShrink:0}}>
              <span style={{color:C.amber,fontWeight:700,fontSize:7.5,textTransform:"uppercase",
                letterSpacing:"0.12em",writingMode:"vertical-rl",transform:"rotate(180deg)",
                whiteSpace:"nowrap"}}>Commercials</span>
            </div>
            {/* Header + data rows grid — relative columns, 5px gap */}
            <div style={{display:"grid",gridTemplateColumns:"24px 1fr 1fr 1fr",
              columnGap:5,rowGap:2,alignItems:"center",minWidth:0}}>
              <div style={hdr}/>
              <div style={hdr}>Conv</div>
              <div style={hdr}>Wst%</div>
              <div style={hdr}>Mgn%</div>
              {/* Box row */}
              <div style={lbl}>Box</div>
              {numField("convRate",50,defConvBox)}
              {numField("waste",48,defWstBox)}
              {numField("margin",46,8)}
              {/* PP row */}
              <div style={lbl}>PP</div>
              {numField("convRatePP",50,defConvPP)}
              {numField("wastePP",48,defWstPP)}
              {numField("marginPP",46,8)}
            </div>
          </div>);
        })()}

        {/* ── 3. TERMS — Freight + Payment·Interest ── */}
        {(()=>{
          const _matrixFr=freight?.[batchProfile.plant]?.[batchProfile.delivery]??0;
          const _isOvr=batchProfile.freightOverride!==''&&batchProfile.freightOverride!==undefined;
          const _displayFr=_isOvr?batchProfile.freightOverride:_matrixFr;
          const DISC_MAP={"30":"0.5%","45":"0.75%","60":"1.0%","90":"1.5%"};
          const lbl={fontSize:9,fontWeight:700,color:C.slateL,whiteSpace:"nowrap"};
          return(
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,
            padding:"4px 8px 4px 4px",display:"flex",flexDirection:"row",gap:6,alignItems:"stretch"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",width:14,flexShrink:0}}>
              <span style={{color:C.amber,fontWeight:700,fontSize:7.5,textTransform:"uppercase",
                letterSpacing:"0.12em",writingMode:"vertical-rl",transform:"rotate(180deg)",
                whiteSpace:"nowrap"}}>Terms</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"auto 1fr",
              columnGap:8,rowGap:4,alignItems:"center"}}>
              {/* Freight */}
              <span style={lbl}>Freight</span>
              <div style={{display:"flex",alignItems:"center",gap:3}}>
                <input type="number" step="0.25" min="0" value={_displayFr}
                  onChange={e=>{
                    const v=e.target.value;
                    const n=v===''?'':+v;
                    const isManual=v!==''&&+v!==_matrixFr;
                    setBatchProfile(p=>({...p,freightOverride:isManual?n:''}));
                  }}
                  style={{width:44,padding:"2px 4px",borderRadius:3,textAlign:"center",
                    border:`1px solid ${_isOvr?C.amber:C.border}`,
                    background:_isOvr?"#FFF8ED":C.white,fontSize:10,color:C.slate}}
                  title={`Freight Rs/kg — matrix: ${_matrixFr}${_isOvr?" | OVERRIDDEN":""}`}/>
                <span style={{fontSize:8,color:C.slateL}}>Rs/kg</span>
              </div>
              {/* Payment Terms → Interest (linked) */}
              <span style={lbl} title="Payment Terms → auto-sets Interest %">PT · Int</span>
              <select value={batchProfile.paymentDisc||"30"}
                onChange={e=>{
                  const m={"30":0.5,"45":0.75,"60":1.0,"90":1.5};
                  setBatchProfile(p=>({...p,paymentDisc:e.target.value,interest:m[e.target.value]||1.5}));
                }}
                style={{padding:"2px 4px",borderRadius:3,border:`1px solid ${C.border}`,
                  fontSize:9,background:C.white,color:C.slate,cursor:"pointer"}}
                title={`Interest auto-set: ${DISC_MAP[batchProfile.paymentDisc||"30"]}`}>
                <option value="30">≤30d · 0.5%</option>
                <option value="45">≤45d · 0.75%</option>
                <option value="60">≤60d · 1.0%</option>
                <option value="90">≤90d · 1.5%</option>
              </select>
            </div>
          </div>);
        })()}

        {/* ── 4. ACTIONS — Import + New Batch ── */}
        <div style={{display:"flex",flexDirection:"column",gap:4,
          justifyContent:"center",marginLeft:"auto",flexShrink:0}}>
          <div style={{border:`1px solid ${C.border}`,borderRadius:6,
            padding:"4px 7px",background:C.white}}>
            <div style={{fontSize:7.5,color:C.slateL,fontWeight:700,textTransform:"uppercase",
              letterSpacing:"0.06em",textAlign:"center",marginBottom:3}}>Import from Costing</div>
            <div style={{display:"flex",gap:4}}>
              <button onClick={()=>{
                  // C11: block Profile import when Costing is in scratchpad context and old batch exists
                  if(costingContext==="new-batch"&&batchRows.length>0){
                    showToast("❌ Scratchpad context — cannot overwrite the existing Batch Profile.\n\nUse Batch Entry → + New Batch to clear the old batch first.",'error',6000);
                    return;
                  }
                  const isBoxRow=!spec.rowType||spec.rowType==="Box";
                  const srcMargin=typeof spec.margin==="number"?spec.margin:8;
                  const srcInterest=typeof spec.interest==="number"?spec.interest:0.5;
                  setBatchProfile(p=>({...p,
                    client:spec.client||p.client,sector:spec.sector||p.sector,
                    plant:spec.plant||p.plant,delivery:spec.delivery||p.delivery,
                    margin:isBoxRow?srcMargin:(typeof p.margin==="number"?p.margin:8),
                    marginPP:!isBoxRow?srcMargin:(typeof p.marginPP==="number"?p.marginPP:8),
                    interest:srcInterest,
                    paymentDisc:spec.paymentDisc||p.paymentDisc,
                    freightOverride:spec.freightOverride||p.freightOverride,
                    waste:spec.waste??p.waste??5,convRate:spec.convRate??p.convRate??7,
                    wastePP:spec.wastePP??p.wastePP??5,convRatePP:spec.convRatePP??p.convRatePP??12.5,
                    customerType:spec.customerType||p.customerType||'existing',
                    priceContext:spec.priceContext||p.priceContext||'unknown',
                  }));
                  showToast(isBoxRow?"✅ Box profile imported":"✅ PP profile imported",'success');
                }}
                style={{flex:1,padding:"4px 0",borderRadius:4,border:"none",
                  background:"#2E6094",color:C.white,fontSize:10,fontWeight:600,cursor:"pointer"}}>
                ↓ Profile
              </button>
              <button onClick={importConstrFromSpec}
                style={{flex:1,padding:"4px 0",borderRadius:4,border:"none",
                  background:C.amber,color:C.white,fontSize:10,fontWeight:600,cursor:"pointer"}}>
                + Constr
              </button>
            </div>
          </div>
          <button onClick={()=>{
            // Fix 5: also clear Quote Items on New Batch so prior customer's data cannot leak
          if(!window.confirm("Start a new batch? This will clear the current profile, all SKU rows, results, and Quote Items."))return;
            const fresh={client:'',sector:'',plant:'',delivery:'',
              margin:8,marginPP:8,interest:0.5,paymentDisc:'30',freightOverride:'',
              waste:5,convRate:7,wastePP:5,convRatePP:12.5,
              customerType:'existing',priceContext:'unknown'};
            setBatchProfile(fresh);
            setBatchRows([]);
            setBatchResults({});
            setExpandedRows(new Set());
            setActiveBatchRowId(null);
            setSpecCommitted(false); // Costing identity fields become editable again
            setItems([]); // Fix 5: clear Quote Items so new customer starts clean
            // Batch Entry cleared → Costing re-attaches to the now-empty batch (same-batch context)
            // Also reset Costing spec so the panel reflects the fresh state immediately
            setCostingContext("same-batch");
            setSpec({...INIT_SPEC,plant:"",delivery:""});
            setSetAutoFill(true);
            showToast("✅ New batch started — Quote Items cleared",'success');
          }} style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${C.amber}`,
            background:C.white,color:C.amber,fontSize:10,fontWeight:700,cursor:"pointer",
            textAlign:"center"}}>
            + New Batch
          </button>
        </div>

      </div>

      {/* ── Batch Entry Slide-Over Overlay: Construction Library ── */}
      {batchConstrOverlay&&(()=>{
        // Apply overlay-specific filter (sector + client + query)
        const oq=batchConstrOverlayQuery.toLowerCase();
        const of=batchConstrOverlayFilter;
        const overlayLibFiltered=constructionLib.filter(c=>{
          if((c.status||'active')!=='active')return false;
          if(of.sector&&(c.sector||'')!==of.sector)return false;
          if(of.client&&(c.client||'')!==of.client)return false;
          if(of.gsm_min&&+c.board_gsm<+of.gsm_min)return false;
          if(of.gsm_max&&+c.board_gsm>+of.gsm_max)return false;
          if(of.bs_min&&+c.spec_bs<+of.bs_min)return false;
          if(of.bct_min&&+c.spec_bct<+of.bct_min)return false;
          if(of.ect_min&&+c.spec_ect<+of.ect_min)return false;
          if(of.cobb_max&&c.spec_cobb&&+c.spec_cobb>+of.cobb_max)return false;
          if(!oq)return true;
          const autoN=constrAutoName(c).toLowerCase();
          return c.code.toLowerCase().includes(oq)||autoN.includes(oq)||
            (c.name||'').toLowerCase().includes(oq)||
            (c.sector||'').toLowerCase().includes(oq)||
            (c.client||'').toLowerCase().includes(oq);
        });
        const closeOverlay=()=>{setBatchConstrOverlay(false);setBatchConstrTargetRowId(null);setBatchConstrOverlayQuery('');};
        const targetRow=batchConstrTargetRowId?batchRows.find(r=>r.id===batchConstrTargetRowId):null;
        return(<>
          {/* Click-outside backdrop — closes overlay when clicking the dimmed area */}
          <div onClick={closeOverlay}
            style={{position:"absolute",top:0,left:0,right:400,bottom:0,zIndex:199,
              background:"rgba(0,0,0,0.15)",cursor:"pointer"}}/>
        <div style={{position:"absolute",top:0,right:0,bottom:0,width:400,zIndex:200,
          display:"flex",flexDirection:"column",
          background:C.white,borderLeft:`2px solid ${C.amber}`,
          boxShadow:"-4px 0 24px rgba(0,0,0,.18)"}}>
          {/* Overlay header */}
          <div style={{padding:"10px 14px",background:C.slateM,display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:700,color:C.amber}}>📚 Construction Library</div>
              {targetRow&&<div style={{fontSize:10,color:"rgba(255,255,255,.6)",marginTop:1}}>
                ↳ Applying to row: {targetRow.matCode||"—"} · {targetRow.product||"unnamed"}</div>}
            </div>
            <button onClick={()=>setTab("constrlib")}
              title="Open full Construction Library tab"
              style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${C.amber}`,
                background:"transparent",color:C.amber,fontSize:10,fontWeight:700,cursor:"pointer"}}>
              ⬡ Full Library
            </button>
            <button onClick={()=>{setBatchConstrOverlay(false);setBatchConstrTargetRowId(null);setBatchConstrOverlayQuery('');}}
              style={{background:"none",border:"none",color:"rgba(255,255,255,.6)",cursor:"pointer",fontSize:18,lineHeight:1,padding:"0 2px"}}>×</button>
          </div>
          {/* Search + Filter */}
          <div style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}`,background:C.cream,flexShrink:0}}>
            <input value={batchConstrOverlayQuery}
              onChange={e=>setBatchConstrOverlayQuery(e.target.value)}
              placeholder="Search code, name, sector, client…"
              style={{width:"100%",padding:"5px 8px",border:`1px solid ${batchConstrOverlayQuery?C.amber:C.border}`,
                borderRadius:5,fontSize:11,boxSizing:"border-box",marginBottom:6}}/>
            <div style={{display:"flex",gap:5,marginBottom:5}}>
              <select value={of.sector} onChange={e=>setBatchConstrOverlayFilter(p=>({...p,sector:e.target.value,client:''}))}
                style={{flex:1,padding:"3px 6px",border:`1px solid ${of.sector?C.amber:C.border}`,borderRadius:4,fontSize:10,color:C.slate,background:C.white}}>
                <option value="">All Sectors</option>
                {[...new Set(constructionLib.filter(c=>(c.status||'active')==='active').map(c=>c.sector||'').filter(Boolean))].sort()
                  .map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <select value={of.client} onChange={e=>setBatchConstrOverlayFilter(p=>({...p,client:e.target.value}))}
                style={{flex:1,padding:"3px 6px",border:`1px solid ${of.client?C.amber:C.border}`,borderRadius:4,fontSize:10,color:C.slate,background:C.white}}>
                <option value="">All Clients</option>
                {[...new Set(constructionLib
                  .filter(c=>(c.status||'active')==='active'&&(!of.sector||(c.sector||'')===of.sector))
                  .map(c=>c.client||'').filter(Boolean))].sort()
                  .map(cl=><option key={cl} value={cl}>{cl}</option>)}
              </select>
              {(batchConstrOverlayQuery||of.sector||of.client||of.gsm_min||of.gsm_max||of.bs_min||of.bct_min||of.ect_min||of.cobb_max)&&
                <button onClick={()=>{setBatchConstrOverlayQuery('');setBatchConstrOverlayFilter({sector:'',client:''});}}
                  style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${C.red}33`,
                    background:"transparent",color:C.red,fontSize:10,cursor:"pointer",fontWeight:600}}>✕ Clear</button>}
            </div>
            {/* STD spec filter — inline expand toggle */}
            {(()=>{
              const hasSpec=of.gsm_min||of.gsm_max||of.bs_min||of.bct_min||of.ect_min||of.cobb_max;
              return(<>
                <button onClick={()=>setBatchConstrOverlayFilter(p=>({...p,_showSpec:!p._showSpec}))}
                  style={{fontSize:9,color:hasSpec?C.amber:C.slateL,background:"none",border:"none",
                    cursor:"pointer",padding:"1px 0",fontWeight:hasSpec?700:400,width:"100%",textAlign:"left"}}>
                  {of._showSpec?"▴":"▾"} Filter by STD specs{hasSpec?" (active)":""}
                </button>
                {of._showSpec&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"3px 6px",marginTop:4,
                    padding:"6px 8px",background:C.white,borderRadius:4,border:`1px solid ${C.border}`}}>
                    {[["gsm_min","GSM ≥"],["gsm_max","GSM ≤"],["bs_min","BS ≥"],
                      ["bct_min","BCT ≥"],["ect_min","ECT ≥"],["cobb_max","Cobb ≤"]].map(([k,lbl])=>(
                      <div key={k} style={{display:"flex",alignItems:"center",gap:4}}>
                        <span style={{fontSize:8,color:C.slateL,whiteSpace:"nowrap",minWidth:40}}>{lbl}</span>
                        <input type="number" step={0.25} value={of[k]||""}
                          onChange={e=>setBatchConstrOverlayFilter(p=>({...p,[k]:e.target.value}))}
                          style={{flex:1,padding:"2px 4px",border:`1px solid ${of[k]?C.amber:C.border}`,
                            borderRadius:3,fontSize:9,textAlign:"center"}}/>
                      </div>))}
                  </div>)}
              </>);
            })()}
            <div style={{fontSize:9,color:C.slateL,marginTop:4}}>{overlayLibFiltered.length} of {constructionLib.filter(c=>(c.status||'active')==='active').length} active shown</div>
          </div>
          {/* Scrollable construction list */}
          <div style={{flex:1,overflowY:"auto",padding:"8px 12px"}}>
            {overlayLibFiltered.length===0&&(
              <div style={{textAlign:"center",color:C.slateL,padding:"24px 0",fontSize:12}}>
                <div>No matching constructions</div>
                <div style={{fontSize:10,marginTop:8}}>
                  <button onClick={()=>{setBatchConstrOverlay(false);setTab("constrlib");}}
                    style={{background:"none",border:"none",color:C.amber,cursor:"pointer",textDecoration:"underline",fontSize:10}}>
                    → Create one in the Construction Library tab
                  </button>
                </div>
              </div>)}
            {overlayLibFiltered.map(c=>{
              const autoN=constrAutoName(c);
              const isSelected=batchConstrTargetRowId&&
                batchRows.find(r=>r.id===batchConstrTargetRowId)?.constructionCode===c.code;
              return(
              <div key={c.code}
                onClick={()=>{
                  if(!batchConstrTargetRowId)return;
                  // Fix 1: invalidate stale result for this row when construction changes
                  invalidateBatchRow(batchConstrTargetRowId);
                  setBatchRows(prev=>prev.map(r=>{
                    if(r.id!==batchConstrTargetRowId)return r;
                    const patch={constructionCode:c.code};
                    // Auto-fill spec fields from construction entry
                    if(c.board_gsm)patch.board_gsm=c.board_gsm;
                    else if(c.layers){
                      const _TUF={A:1.51,B:1.37,C:1.47,E:1.31};
                      const _ly=c.layers||{};
                      const _cGSM=(+(_ly.TOP?.gsm)||0)+(+(_ly.F1?.gsm)||0)*(_TUF[c.flute_F1||'B']||1)
                        +(+(_ly.L1?.gsm)||0)+(+(_ly.F2?.gsm)||0)*(_TUF[c.flute_F2||'A']||1)+(+(_ly.L2?.gsm)||0);
                      if(_cGSM>0)patch.board_gsm=Math.round(_cGSM);
                    }
                    if(c.spec_bs)patch.spec_bs=c.spec_bs;
                    if(c.spec_bct)patch.spec_bct=c.spec_bct;
                    if(c.spec_ect)patch.spec_ect=c.spec_ect;
                    return{...r,...patch};
                  }));
                  showToast(`✅ [${c.code}] ${autoN} applied`,'success');
                  setBatchConstrOverlay(false);
                  setBatchConstrTargetRowId(null);
                  setBatchConstrOverlayQuery('');
                }}
                style={{padding:"8px 10px",marginBottom:5,borderRadius:6,cursor:"pointer",
                  border:`1px solid ${isSelected?C.amber:C.border}`,
                  background:isSelected?C.amberL:C.white,
                  transition:"background 0.15s"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                  <span style={{fontWeight:800,color:C.amber,fontFamily:mono,fontSize:13,flexShrink:0,minWidth:26}}>{c.code}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.slateM,lineHeight:1.3}}>{autoN}</div>
                    {c.name&&c.name!==autoN&&<div style={{fontSize:9,color:C.slateL,fontStyle:"italic",marginTop:1}}>{c.name}</div>}
                    <div style={{display:"flex",gap:3,marginTop:3,flexWrap:"wrap"}}>
                      {c.sector&&<span style={{fontSize:8,background:C.amberL,color:C.amberD,borderRadius:3,padding:"1px 4px"}}>{c.sector}</span>}
                      {c.client&&<span style={{fontSize:8,background:"#EEF4FB",color:"#2E6094",borderRadius:3,padding:"1px 4px"}}>{c.client}</span>}
                      {c.spec_bs&&<span style={{fontSize:8,background:"#F0FFF4",color:C.green,borderRadius:3,padding:"1px 4px"}}>BS≥{c.spec_bs}</span>}
                      {c.board_gsm&&<span style={{fontSize:8,background:C.cream,color:C.slateM,borderRadius:3,padding:"1px 4px"}}>{c.board_gsm}gsm</span>}
                    </div>
                  </div>
                  <div style={{fontSize:10,color:C.amber,fontWeight:700,flexShrink:0}}>Select →</div>
                </div>
              </div>);
            })}
          </div>
          {/* Overlay footer */}
          <div style={{padding:"8px 12px",borderTop:`1px solid ${C.border}`,background:C.cream,flexShrink:0}}>
            <div style={{fontSize:10,color:C.slateL,textAlign:"center"}}>
              To create or edit constructions, use the{" "}
              <button onClick={()=>{setBatchConstrOverlay(false);setTab("constrlib");}}
                style={{background:"none",border:"none",color:C.amber,cursor:"pointer",textDecoration:"underline",fontSize:10,fontWeight:700}}>
                Construction Library tab
              </button>
            </div>
          </div>
        </div></>);
      })()}

      <div style={{display:"flex",flex:1,overflow:"hidden",position:"relative"}}>
        {/* FULL WIDTH: SKU Grid (Construction Library now in overlay + separate tab) */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {/* Ghost left panel placeholder — REMOVED. The old 300px Construction Library
              panel has been replaced by:
              1. A slide-over overlay (opened per-row or via toolbar button)
              2. The standalone Construction Library tab */}
          {/* ↓↓↓ old LEFT panel content REMOVED ↓↓↓ */}
          {/* Grid toolbar */}
          <div style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:8,
            alignItems:"center",flexWrap:"wrap",background:C.cream,flexShrink:0}}>
            <Btn ch="⚡ Calculate All" v="primary" sm onClick={calculateAll}
              disabled={batchRows.length===0||constructionLib.length===0}/>
            <Btn ch="→ Send All to Quote Items" v="success" sm onClick={sendAllToQuoteItems}
              disabled={Object.keys(batchResults).length===0}/>
            <button onClick={()=>{setBatchConstrOverlay(true);setBatchConstrTargetRowId(null);setBatchConstrOverlayQuery('');setBatchConstrOverlayFilter({sector:'',client:'',});}}
              style={{padding:"3px 10px",borderRadius:5,border:`1px solid ${C.amber}`,
                background:C.amberL,color:C.amberD,fontSize:11,cursor:"pointer",fontWeight:700}}>
              📚 Construction Library ({constructionLib.filter(c=>(c.status||'active')==='active').length} active)
            </button>
            <div style={{borderLeft:`1px solid ${C.border}`,paddingLeft:8,display:"flex",gap:6}}>
              {["Box","Plate","Part-L","Part-W"].map(t=>(
                <button key={t} onClick={()=>addBatchRow(t)}
                  style={{padding:"3px 9px",borderRadius:5,border:`1px solid ${C.border}`,
                    background:C.white,color:C.slateM,fontSize:11,cursor:"pointer",fontWeight:600}}>
                  + {t}</button>))}
            </div>
            <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
              <label style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:C.slateM,cursor:"pointer"}}>
                <input type="checkbox" checked={autoCodeEnabled} onChange={e=>setAutoCodeEnabled(e.target.checked)}
                  style={{accentColor:C.amber}}/>
                Auto-code
              </label>
              {autoCodeEnabled&&<button onClick={generateMissingCodes}
                style={{padding:"3px 9px",borderRadius:5,border:`1px solid ${C.amber}`,
                  background:C.amberL,color:C.amberD,fontSize:11,cursor:"pointer",fontWeight:600}}>
                ↯ Generate Missing Codes</button>}
              <span style={{fontSize:10,color:C.slateL}}>Format: {generateCode(autoCodeSeq)}</span>
            </div>
          </div>

          {/* The grid */}
          {batchRows.length===0
            ?<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                height:"100%",color:C.slateL,gap:10}}>
                <div style={{fontSize:32}}>📋</div>
                <div style={{fontSize:13,fontWeight:600,color:C.slateM}}>No SKUs yet</div>
                <div style={{fontSize:11}}>Click + Box, + Plate etc above to add rows. First 5 columns (Status → SET Role) are frozen while you scroll right.</div>
              </div>
            :<div style={{flex:1,overflowX:"auto",overflowY:"auto"}}>
              <table style={{borderCollapse:"collapse",fontSize:11,minWidth:1400,width:"100%"}}>
                <thead style={{position:"sticky",top:0,zIndex:5}}>
                  <tr style={{background:C.slateM}}>
                    {(()=>{
                      // First 5 columns are frozen (sticky). Cumulative left offsets:
                      // St=28 | #=24 | MatCode=88 | SKU=118 | SETRole=78
                      const FROZEN={
                        "St":      {left:0,   width:28},
                        "#":       {left:28,  width:24},
                        "Mat Code":{left:52,  width:88},
                        "SKU / Product":{left:140, width:118},
                        "SET Role":{left:258, width:78, borderRight:true},
                      };
                      const CENTER_COLS=["L","W","H","Ups","Nos/Set","Std GSM","Std BS","Std BCT","Std ECT","Std Cobb","Std Box Wt","Sales MOQ","Vol/mo","Waste%","Conv Rs/kg","Margin%","Sheet Wt","Rate/SET (₹)","MOQ","Rate/kg (₹)","Calc GSM","Calc BS","Est Box Wt"];
                      return ["St","#","Mat Code","SKU / Product","SET Role","SET Code","Nos/Set","Box Type","Paper Construction","L","W","H","Ups",
                        "Std GSM","Std BS","Std BCT","Std ECT","Std Cobb","Std Box Wt",
                        "Sales MOQ","Vol/mo","Waste%","Conv Rs/kg","Margin%","Remarks",
                        "Sheet Wt","Final Rate (₹)","Rate/SET (₹)","MOQ","Rate/kg (₹)","Calc GSM","Calc BS","Est Box Wt","All Spec OK"
                      ].map(h=>{
                        const fr=FROZEN[h];
                        return<th key={h} style={{
                          padding:"6px 5px",color:C.white,fontSize:9,fontWeight:600,
                          textAlign:CENTER_COLS.includes(h)?"center":"left",
                          whiteSpace:"nowrap",
                          borderRight:fr?.borderRight?`2px solid ${C.amber}44`:`1px solid ${C.slateL}44`,
                          ...(fr?{
                            position:"sticky",left:fr.left,zIndex:6,
                            background:C.slateM,
                            boxShadow:fr.borderRight?"2px 0 6px rgba(0,0,0,.18)":undefined,
                          }:{}),
                        }}>{h}</th>;
                      });
                    })()}
                    {pinnedAddOns.map(k=>{
                      const AO_LABELS={printing:"Print",stitching:"Stitch",coating:"Coat",handling:"Hdlg",moqCharge:"MOQ Chg",packing:"Pack",other:"Other",unloading:"Unlod"};
                      return<th key={`pin_${k}`} style={{padding:"6px 4px",color:C.amber,fontSize:9,fontWeight:600,textAlign:"center",whiteSpace:"nowrap",borderRight:`1px solid ${C.slateL}44`,background:"#3a2a10"}}>
                        {AO_LABELS[k]||k}<br/><span style={{fontSize:8,fontWeight:400,opacity:0.7}}>Rs/pc ⊕</span></th>;})}
                    <th style={{padding:"6px 4px",color:C.white,fontSize:9,minWidth:52,textAlign:"center"}}>▾ more</th>
                  </tr>
                </thead>
                <tbody>
                  {batchRows.map((row,ri)=>{
                    const res=batchResults[row.id];
                    const st=getBatchRowStatus(row);
                    const sd=STATUS_DISPLAY[st]||STATUS_DISPLAY["draft-uncalc"];
                    const isActive=activeBatchRowId===row.id;
                    const upd=(k,v)=>setBatchRows(prev=>prev.map(r=>r.id===row.id?{...r,[k]:v}:r));
                    // Fix 1: updC = update a costing-relevant field AND clear this row's stale result.
                    const updC=(k,v)=>{upd(k,v);invalidateBatchRow(row.id);};
                    const inp=(k,w=50,type="text")=>(
                      <input type={type} value={row[k]??""} step={type==="number"?"0.25":undefined}
                        onChange={e=>upd(k,type==="number"?+e.target.value:e.target.value)}
                        style={{width:w,padding:"2px 4px",border:`1px solid ${C.border}`,
                          borderRadius:3,fontSize:10,textAlign:type==="number"?"center":"left",
                          fontFamily:type==="number"?mono:sans}}/>
                    );
                    // Fix ⑤: inpC = same as inp but uses updC (invalidates row result on change).
                    // Used for nosPerSet — changes SET rate — and any other costing-relevant simple inputs.
                    const inpC=(k,w=50,type="text")=>(
                      <input type={type} value={row[k]??""} step={type==="number"?"0.25":undefined}
                        onChange={e=>updC(k,type==="number"?+e.target.value:e.target.value)}
                        style={{width:w,padding:"2px 4px",border:`1px solid ${C.border}`,
                          borderRadius:3,fontSize:10,textAlign:type==="number"?"center":"left",
                          fontFamily:type==="number"?mono:sans}}/>
                    );
                    const dimRow=autoCalcPPDims(row);
                    const comp=res&&buildSpecFromRow(dimRow,constructionLib.find(c=>c.code===row.constructionCode),batchProfile)
                      ?checkSpecCompliance(buildSpecFromRow(dimRow,constructionLib.find(c=>c.code===row.constructionCode),batchProfile),res):[];
                    const bsOk=comp.length===0?"✅":comp.some(c=>c.severity==="high")?"❌":"⚠️";
                    return(<Fragment key={row.id}>
                      <tr style={{background:isActive?"#EEF4FB":ri%2?C.cream:C.white,
                        borderBottom:`1px solid ${C.border}44`}}>
                        {/* ── FROZEN COL 1: Status (left:0, w:28) — click to expand/collapse sub-row ── */}
                        <td onClick={()=>toggleRowExpand(row.id)}
                          title={expandedRows.has(row.id)?`Collapse sub-row (${sd.label})`:`Expand sub-row: add-ons, overrides, cost build-up (${sd.label})`}
                          style={{padding:"3px 4px",textAlign:"center",width:28,minWidth:28,
                            position:"sticky",left:0,zIndex:3,cursor:"pointer",
                            background:expandedRows.has(row.id)
                              ?`${C.amber}22`
                              :isActive?"#EEF4FB":ri%2?C.cream:C.white,
                            borderBottom:expandedRows.has(row.id)?`2px solid ${C.amber}`:undefined}}>
                          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                            <span>{sd.icon}</span>
                            <span style={{fontSize:7,color:expandedRows.has(row.id)?C.amber:C.slateL,lineHeight:1}}>
                              {expandedRows.has(row.id)?"▴":"▾"}
                            </span>
                          </div>
                        </td>
                        {/* ── FROZEN COL 2: Row # (left:28, w:24) ── */}
                        <td style={{padding:"3px 4px",color:C.slateL,fontWeight:600,width:24,minWidth:24,
                          position:"sticky",left:28,zIndex:3,
                          background:isActive?"#EEF4FB":ri%2?C.cream:C.white}}>
                          {ri+1}</td>
                        {/* ── FROZEN COL 3: Mat Code (left:52, w:88) ── */}
                        <td style={{padding:"2px 3px",width:88,minWidth:88,
                          position:"sticky",left:52,zIndex:3,
                          background:isActive?"#EEF4FB":ri%2?C.cream:C.white}}>
                          <div style={{display:"flex",gap:2,alignItems:"center"}}>
                            <input value={row.matCode||""} style={{width:72,padding:"2px 4px",border:`1px solid ${C.border}`,borderRadius:3,fontSize:10,fontFamily:mono}}
                              onChange={e=>{
                                const mc=e.target.value;
                                upd("matCode",mc);
                                // Main Box: keep SET Code in sync with Mat Code as long as they
                                // are currently equal (user hasn't manually diverged them).
                                if(row.setAutoFill&&(row.itemType||"Box")==="Box"&&(row.setCode===""||row.setCode===row.matCode)){
                                  upd("setCode",mc);
                                  invalidateAllBatchResults(); // cross-row: Part rows use Box setCode for auto-dim lookup
                                }
                              }}/>
                            {row.autoCode&&<span title="Auto-generated" style={{fontSize:9,color:C.amber}}>⚡</span>}
                          </div>
                        </td>
                        {/* ── FROZEN COL 4: SKU / Product (left:140, w:118) ── */}
                        <td style={{padding:"2px 3px",width:118,minWidth:118,
                          position:"sticky",left:140,zIndex:3,
                          background:isActive?"#EEF4FB":ri%2?C.cream:C.white}}>
                          <input type="text" value={row.product||""} onChange={e=>upd("product",e.target.value)}
                            style={{width:108,padding:"2px 4px",border:`1px solid ${C.border}`,borderRadius:3,fontSize:10}}/>
                        </td>
                        {/* ── FROZEN COL 5: SET Role (left:258, w:78) — disabled when no SET Code ── */}
                        <td style={{padding:"2px 3px",width:78,minWidth:78,
                          position:"sticky",left:258,zIndex:3,
                          borderRight:`2px solid ${C.amber}55`,
                          boxShadow:"2px 0 6px rgba(0,0,0,.18)",
                          background:isActive?"#EEF4FB":ri%2?C.cream:C.white}}>
                          {(()=>{
                            // SET Role is only meaningful when a SET Code exists and is confirmed.
                            // When SET Code is blank (explicitly cleared), role = NA, dropdown disabled.
                            const hasSetCode=(row.setCode||"").trim()!=="";
                            const isNA=!hasSetCode;
                            return(
                            <select value={isNA?"NA":row.itemType||"Box"}
                              disabled={isNA}
                              onChange={e=>{
                                // Fix ⑤: SET Role change switches boxType, deckle path, waste/conv source,
                                // and margin source — must invalidate the stale result.
                                const v=e.target.value;updC("itemType",v);
                                if(v==="Plate"||v==="Part-L"||v==="Part-W"){updC("boxType","PP");}
                                else if(v==="Box"){updC("boxType","RSC");}
                              }}
                              title={isNA?"SET Code is cleared — this row is standalone (no SET role)":undefined}
                              style={{padding:"2px 3px",border:`1px solid ${isNA?"#CCC":C.border}`,
                                borderRadius:3,fontSize:9,width:70,
                                background:isNA?"#F5F5F5":"",
                                color:isNA?"#999":C.slate,
                                cursor:isNA?"not-allowed":"pointer"}}>
                              {isNA&&<option value="NA">— N/A —</option>}
                              {[{v:"Box",l:"Main Box"},{v:"Plate",l:"Liner Plate"},{v:"Part-L",l:"Partition-L"},{v:"Part-W",l:"Partition-W"},{v:"Other",l:"Other"}]
                                .map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
                            </select>);
                          })()}
                        </td>
                        {/* SET Code — with "Part of a SET" switch + assumed indicator + confirm/clear for non-Box rows */}
                        <td style={{padding:"3px 4px",minWidth:86}}>
                          {(()=>{
                            const isAssumed=!!row.setCodeAssumed;
                            const isNonBox=row.itemType!=="Box";
                            // Confirm handler: clears assumed flag, triggers auto-dims + Glass SKU fill
                            const handleConfirm=()=>{
                              upd("setCodeAssumed",false);
                              // Glass SKU auto-fill for ALCOBEV Part-L / Part-W rows
                              if(batchProfile.sector==="ALCOBEV"&&(row.itemType==="Part-L"||row.itemType==="Part-W")){
                                const confirmedSetCode=(row.setCode||"").trim();
                                const parentBox=batchRows.find(r=>
                                  r.itemType==="Box"&&!r.setCodeAssumed&&(r.setCode||"").trim()===confirmedSetCode);
                                if(parentBox&&parentBox.glassSKUType){
                                  const pm=partitionsMaster.find(x=>x.skuType===parentBox.glassSKUType);
                                  if(pm){
                                    const nos=row.itemType==="Part-L"?pm.lwise:pm.wwise;
                                    updC("nosPerSet",nos); // row-scoped: nosPerSet changes this row's SET rate
                                    showToast(`🍶 Nos/Set auto-filled: ${nos} (${parentBox.glassSKUType})`,'success',3000);
                                  }
                                } else if(parentBox&&!parentBox.glassSKUType){
                                  showToast(`⚠️ Glass SKU Type not yet set on the parent Box — set it first to auto-fill Nos/Set`,'info',5000);
                                }
                              }
                            };
                            // Clear handler: blank SET Code, mark as standalone, disable SET Role
                            const handleClear=()=>{
                              upd("setCode","");
                              upd("setCodeAssumed",false);
                              invalidateAllBatchResults(); // cross-row: Part rows use this Box's setCode for auto-dim lookup
                            };
                            return(
                            <div style={{display:"flex",flexDirection:"column",gap:1}}>
                              <div style={{position:"relative",display:"inline-block"}}>
                                <input type="checkbox" checked={!!row.setAutoFill}
                                  onChange={e=>{
                                    const on=e.target.checked;
                                    upd("setAutoFill",on);
                                    if(!on){
                                      upd("setCode","");
                                      upd("setCodeAssumed",false);
                                      invalidateAllBatchResults();
                                    } else {
                                      // Restore default: Box→own matCode; PP→nearest preceding confirmed Box setCode
                                      if((row.itemType||"Box")==="Box"){
                                        upd("setCode",row.matCode||"");
                                        invalidateAllBatchResults();
                                      } else {
                                        const ri2=batchRows.findIndex(r=>r.id===row.id);
                                        const parentBox=[...batchRows.slice(0,ri2)].reverse().find(r=>r.itemType==="Box"&&r.matCode&&!r.setCodeAssumed);
                                        if(parentBox){upd("setCode",parentBox.setCode||parentBox.matCode||"");upd("setCodeAssumed",true);invalidateAllBatchResults();}
                                      }
                                    }
                                  }}
                                  style={{position:"absolute",left:3,top:"50%",transform:"translateY(-50%)",
                                    accentColor:"#9A7B4A",cursor:"pointer",width:10,height:10,zIndex:1}}/>
                                <input value={row.setCode||""} placeholder="SET code"
                                  onChange={e=>{
                                    // setCode is cross-row: autoCalcPPDims finds a Part row's parent Box by matching
                                    // r.setCode across all batch rows. Changing any setCode can alter another row's
                                    // auto-derived dims — invalidateBatchRow(row.id) is insufficient.
                                    upd("setCode",e.target.value);
                                    invalidateAllBatchResults();
                                    if(isAssumed)upd("setCodeAssumed",false);
                                  }}
                                  style={{width:76,padding:"2px 4px 2px 18px",
                                    border:`1px solid ${isAssumed?"#E8830A":C.border}`,
                                    borderRadius:3,fontSize:10,fontFamily:mono,
                                    background:isAssumed?"#FFF8ED":C.white}}/>
                              </div>
                              {isAssumed&&isNonBox&&(
                                <div style={{display:"flex",gap:2,alignItems:"center"}}>
                                  <span style={{fontSize:7,color:"#E8830A",fontWeight:700,letterSpacing:"0.03em"}}>⚠ assumed</span>
                                  <button onClick={handleConfirm}
                                    title="Confirm this SET Code is correct"
                                    style={{fontSize:8,color:C.green,background:"none",border:`1px solid ${C.green}`,
                                      borderRadius:2,cursor:"pointer",padding:"0 3px",lineHeight:1.4,fontWeight:700}}>✓</button>
                                  <button onClick={handleClear}
                                    title="Clear SET Code — this item is standalone, not part of a SET"
                                    style={{fontSize:8,color:C.red,background:"none",border:`1px solid ${C.red}33`,
                                      borderRadius:2,cursor:"pointer",padding:"0 3px",lineHeight:1.4}}>✕</button>
                                </div>)}
                            </div>);
                          })()}
                        </td>
                        {/* Nos/Set — shows 🍶 badge for ALCOBEV Part rows with glassSKUType set */}
                        <td style={{padding:"3px 4px",textAlign:"center",minWidth:50}}>
                          {(()=>{
                            const isAlcoPart=batchProfile.sector==="ALCOBEV"&&(row.itemType==="Part-L"||row.itemType==="Part-W");
                            return(
                            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                              {inpC("nosPerSet",40,"number")}
                              {isAlcoPart&&row.glassSKUType&&(
                                <span style={{fontSize:7,color:"#2E6094",background:"#EEF4FB",
                                  borderRadius:2,padding:"0 3px",whiteSpace:"nowrap",maxWidth:44,
                                  overflow:"hidden",textOverflow:"ellipsis"}}
                                  title={`Glass SKU: ${row.glassSKUType}`}>
                                  🍶 {row.glassSKUType.substring(0,8)}
                                </span>)}
                            </div>);
                          })()}
                        </td>
                        {/* Box Type */}
                        <td style={{padding:"3px 4px",minWidth:58}}>
                          <select value={row.boxType||"RSC"} onChange={e=>updC("boxType",e.target.value)}
                            style={{padding:"2px 3px",border:`1px solid ${C.border}`,borderRadius:3,fontSize:9,width:54}}>
                            {BOX_TYPES.map(bt=><option key={bt} value={bt}>{bt}</option>)}
                          </select>
                        </td>
                        {/* Paper Construction — opens slide-over overlay for selection */}
                        <td style={{padding:"3px 4px",minWidth:164}}>
                          {(()=>{
                            const ce=row.constructionCode?constructionLib.find(c=>c.code===row.constructionCode):null;
                            const autoN=ce?constrAutoName(ce):"";
                            return(
                            <button
                              onClick={()=>{
                                setBatchConstrOverlay(true);
                                setBatchConstrTargetRowId(row.id);
                                setBatchConstrOverlayQuery('');
                                setBatchConstrOverlayFilter({sector:'',client:''});
                              }}
                              title={ce?`[${ce.code}] ${autoN} — click to change`:"Click to select a construction"}
                              style={{width:156,padding:"3px 6px",
                                border:`1px solid ${row.constructionCode?C.border:C.red}`,
                                borderRadius:3,fontSize:9,textAlign:"left",cursor:"pointer",
                                background:row.constructionCode?C.white:"#FFF5F5",
                                color:row.constructionCode?C.slateM:C.red,
                                fontFamily:mono,display:"flex",alignItems:"center",gap:4}}>
                              {row.constructionCode
                                ?<><span style={{color:C.amber,fontWeight:800}}>{row.constructionCode}</span>
                                  <span style={{fontSize:8,color:C.slateL,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>
                                    {autoN.substring(0,22)}{autoN.length>22?"…":""}</span></>
                                :<span style={{fontSize:9}}>— pick construction 📚</span>}
                            </button>);
                          })()}
                        </td>
                        {/* L W H Ups — L/W show a live auto-calc placeholder for Plate/Partition rows
                            left blank (derived from the nearest preceding Box row) */}
                        {["L","W","H","ups"].map(k=>{
                          const isAutoDim=(k==="L"||k==="W")&&row.itemType!=="Box"&&(row[k]===""||row[k]==null);
                          const autoVal=isAutoDim?autoCalcPPDims(row)[k]:null;
                          // B6: dimension range validation for L/W/H (not ups)
                          const isDimField=k==="L"||k==="W"||k==="H";
                          const dimVal=row[k]!==""&&row[k]!=null?+row[k]:null;
                          const dimInvalid=isDimField&&dimVal!=null&&(dimVal<=0||dimVal>2500);
                          const dimTip=dimInvalid?`⚠ ${k}=${dimVal}mm is outside valid range (1–2500mm) — please verify`:"";
                          return(
                            <td key={k} style={{padding:"3px 4px",textAlign:"center",minWidth:52}}>
                              {isAutoDim
                                ?<input type="number" step="0.25" value=""
                                    placeholder={autoVal!=null?`↳${autoVal}`:"—"}
                                    onChange={e=>updC(k,e.target.value===""?"":+e.target.value)}
                                    title={autoVal!=null?`Auto-calculated from parent Box row: ${autoVal}mm (type a value to override)`:"No parent Box row found to auto-calculate from"}
                                    style={{width:44,padding:"2px 4px",border:`1px dashed ${C.border}`,
                                      borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,color:C.slateL}}/>
                                :<input type="number" step="0.25" value={row[k]??""}
                                    onChange={e=>updC(k,e.target.value===""?"":+e.target.value)}
                                    title={dimTip||undefined}
                                    style={{width:44,padding:"2px 4px",
                                      border:`1px solid ${dimInvalid?C.red:C.border}`,
                                      borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                                      background:dimInvalid?C.redL:C.white,
                                      color:dimInvalid?C.red:undefined}}/>}
                            </td>);
                        })}
                        {/* Std specs: Board GSM, BS, BCT, ECT, Cobb, Box Wt */}
                        {["board_gsm","spec_bs","spec_bct","spec_ect"].map(k=>(
                          <td key={k} style={{padding:"3px 4px",textAlign:"center",minWidth:50}}>
                            {inp(k,44,"number")}</td>))}
                        {/* Std Cobb — amber flag when ≤125 */}
                        <td style={{padding:"3px 4px",textAlign:"center",minWidth:54}}>
                          <input type="number" step={5} value={row.spec_cobb??""}
                            onChange={e=>upd("spec_cobb",e.target.value===""?"":+e.target.value)}
                            title={(()=>{const cv=row.spec_cobb?+row.spec_cobb:null;return cv&&cv<=125?"⚠️ Cobb Max "+cv+" — moisture-sensitive, confirm Coating add-on":cv&&cv<=155?"Cobb Max "+cv+" g/m² — standard":"Cobb (g/m² Max) — leave blank if not specified";})()}
                            style={{width:44,padding:"2px 4px",
                              border:`1px solid ${row.spec_cobb&&+row.spec_cobb<=125?C.amber:C.border}`,
                              borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                              background:row.spec_cobb&&+row.spec_cobb<=125?"#FFF8ED":C.white}}/>
                        </td>
                        <td style={{padding:"3px 4px",textAlign:"center",minWidth:52}}>
                          {inp("reqBoxWt",44,"number")}</td>
                        {/* Commercial */}
                        <td style={{padding:"3px 4px",textAlign:"center",minWidth:70}}>{inp("salesMOQ",58,"number")}</td>
                        <td style={{padding:"3px 4px",textAlign:"center",minWidth:62}}>{inp("volume",52,"number")}</td>
                        {/* Waste% override (context-interpreted: Box or PP based on row type) */}
                        <td style={{padding:"3px 4px",textAlign:"center",minWidth:52}}>
                          {(()=>{
                            const isPP=isPPType(row.itemType); // R-2
                            const profVal=isPP?(batchProfile.wastePP??5):(batchProfile.waste??5);
                            const isOvr=row.wasteConv_waste!==""&&row.wasteConv_waste!=null;
                            return<input type="number" step="0.25" value={row.wasteConv_waste??""}
                              placeholder={String(profVal)}
                              onChange={e=>updC("wasteConv_waste",e.target.value===""?"":+e.target.value)}
                              title={`${isPP?"PP":"Box"} Waste% — profile default: ${profVal}%${isOvr?" | OVERRIDDEN":""}`}
                              style={{width:44,padding:"2px 4px",border:`1px solid ${isOvr?C.amber:C.border}`,
                                borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                                background:isOvr?"#FFF8ED":C.white}}/>;
                          })()}
                        </td>
                        {/* Conv Rs/kg override */}
                        <td style={{padding:"3px 4px",textAlign:"center",minWidth:58}}>
                          {(()=>{
                            const isPP=isPPType(row.itemType); // R-2
                            const profVal=isPP?(batchProfile.convRatePP??12.5):(batchProfile.convRate??7);
                            const isOvr=row.wasteConv_conv!==""&&row.wasteConv_conv!=null;
                            return<input type="number" step="0.25" value={row.wasteConv_conv??""}
                              placeholder={String(profVal)}
                              onChange={e=>updC("wasteConv_conv",e.target.value===""?"":+e.target.value)}
                              title={`${isPP?"PP":"Box"} Conv Rs/kg — profile default: ${profVal}${isOvr?" | OVERRIDDEN":""}`}
                              style={{width:50,padding:"2px 4px",border:`1px solid ${isOvr?C.amber:C.border}`,
                                borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                                background:isOvr?"#FFF8ED":C.white}}/>;
                          })()}
                        </td>
                        {/* Margin% */}
                        <td style={{padding:"3px 4px",textAlign:"center",minWidth:58}}>
                          <input type="number" step="0.25" value={row.marginOverride??""}
                            placeholder={String(
                              (row.itemType==="Plate"||row.itemType==="Part-L"||row.itemType==="Part-W")
                                ?(batchProfile.marginPP??batchProfile.margin??8)
                                :(batchProfile.margin??8)
                            )}
                            onChange={e=>updC("marginOverride",e.target.value===""?"":+e.target.value)}
                            title={row.marginOverride!=null&&row.marginOverride!==""?"Row override":`Inherits: ${(row.itemType==="Plate"||row.itemType==="Part-L"||row.itemType==="Part-W")?(batchProfile.marginPP??batchProfile.margin??8):(batchProfile.margin??8)}% from profile`}
                            style={{width:46,padding:"2px 4px",border:`1px solid ${row.marginOverride!=null&&row.marginOverride!==""?C.amber:C.border}`,
                              borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                              background:row.marginOverride!=null&&row.marginOverride!==""?"#FFF8ED":C.white}}/>
                        </td>
                        <td style={{padding:"3px 4px",minWidth:100}}>{inp("remarks",88)}</td>
                        {/* Outputs: SheetWt > FinalRate > Rate/SET > MOQ > Rate/kg > CalcGSM > CalcBS > EstBoxWt > AllSpecOK */}
                        <td style={{padding:"3px 6px",textAlign:"center",fontFamily:mono,fontSize:10,color:C.slateL}}>
                          {res?(res.wtSheet*1000).toFixed(0)+"g":"—"}</td>
                        <td style={{padding:"3px 6px",textAlign:"center",fontWeight:800,color:C.amber,fontFamily:mono}}>
                          {res?`₹${res.finalRate.toFixed(2)}`:"—"}
                          {/* Fix 6: flag ₹0 material cost — usually means a paper grade was deleted */}
                          {res&&(res.mat||0)<0.001&&<span title="⚠️ Material cost is ₹0 — check paper grades in Rate Master" style={{fontSize:9,color:C.red,marginLeft:3}}>⚠️0</span>}
                        </td>
                        {/* Issue 5: Rate/SET = finalRate × nosPerSet. Shows SET contribution of this component.
                            Layout: ×N on left (multiplier tag), ₹rate on right (number always right-aligned).
                            When nosPerSet=1, rate renders alone right-aligned — no multiplier shown. */}
                        <td style={{padding:"3px 6px",textAlign:"right",fontWeight:800,
                          color:(+row.nosPerSet||1)>1?"#0F766E":C.amber,fontFamily:mono,
                          background:(+row.nosPerSet||1)>1?"#F0FAFA":undefined,whiteSpace:"nowrap"}}>
                          {(+row.nosPerSet||1)>1
                            ?<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:4}}>
                                <span style={{fontSize:8,fontWeight:500,color:"#0F766E",opacity:0.75,letterSpacing:"0.02em"}}>×{row.nosPerSet}</span>
                                <span>{res?`₹${(res.finalRate*(+row.nosPerSet||1)).toFixed(2)}`:"—"}</span>
                              </div>
                            :<>{res?`₹${(res.finalRate).toFixed(2)}`:"—"}</>}
                        </td>
                        <td style={{padding:"3px 6px",textAlign:"center",fontFamily:mono,fontSize:10}}>
                          {res?res.calcMOQ.toLocaleString():"—"}</td>
                        <td style={{padding:"3px 6px",textAlign:"center",fontFamily:mono,fontSize:10,color:C.slateL}}>
                          {res?`₹${res.ratePerKg.toFixed(2)}`:"—"}</td>
                        <td style={{padding:"3px 6px",textAlign:"center",fontFamily:mono,fontSize:10,color:C.slateM}}>
                          {res?res.calcGSM:"—"}</td>
                        <td style={{padding:"3px 6px",textAlign:"center",fontFamily:mono,fontSize:10,
                          color:comp.some(c=>c.field.includes("Burst"))?(comp.find(c=>c.field.includes("Burst"))?.severity==="high"?C.red:C.orange):C.slateM}}>
                          {res?.calcBS||"—"}</td>
                        <td style={{padding:"3px 6px",textAlign:"center",fontFamily:mono,fontSize:10,color:C.slateM}}>
                          {res?(res.wtSheet*1000*0.98).toFixed(0)+"g":"—"}</td>
                        <td style={{padding:"3px 6px",textAlign:"center",fontSize:12}}>
                          {(()=>{
                            // Fix 10: three distinct states —
                            //   "—"  : no customer specs entered (nothing to check — not "all OK")
                            //   "⚪" : row not yet calculated (cannot assess)
                            //   ✅/⚠️/❌ : result exists AND specs are present
                            const hasSpecs=row.spec_bs||row.spec_bct||row.spec_ect||row.board_gsm||row.reqBoxWt;
                            if(!hasSpecs)return<span title="No customer specs entered — nothing to check" style={{color:C.slateL,fontSize:11}}>—</span>;
                            if(!res)return<span title="Not calculated — run Calculate All first">⚪</span>;
                            const sp2=buildSpecFromRow(autoCalcPPDims(row),constructionLib.find(c=>c.code===row.constructionCode),batchProfile);
                            if(!sp2)return"—";
                            const aC=checkSpecCompliance(sp2,res);
                            const wtOk=(!row.reqBoxWt||!+row.reqBoxWt)||Math.abs(res.wtSheet*1000*0.98-(+row.reqBoxWt))/(+row.reqBoxWt)<=0.015;
                            const noHigh=!aC.some(c=>c.severity==="high");
                            return(wtOk&&noHigh)?"✅":aC.some(c=>c.severity==="high")?"❌":"⚠️";
                          })()}
                        </td>
                        {/* Pinned add-on cells */}
                        {pinnedAddOns.map(k=>(
                          <td key={`pin_${k}`} style={{padding:"3px 4px",textAlign:"center",minWidth:52}}>
                            <input type="number" step="0.25" value={(row.addOns||{})[k]??""}
                              onChange={e=>updC("addOns",{...(row.addOns||{}),[k]:e.target.value===""?"":+e.target.value})}
                              style={{width:44,padding:"2px 4px",border:`1px solid ${(row.addOns||{})[k]?C.amber:C.border}`,
                                borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                                background:(row.addOns||{})[k]?"#FFF8ED":C.white}}/>
                          </td>))}
                        {/* Actions + expand toggle */}
                        <td style={{padding:"3px 4px",textAlign:"center",whiteSpace:"nowrap",minWidth:52}}>
                          <button onClick={()=>toggleRowExpand(row.id)}
                            title={expandedRows.has(row.id)?"Collapse sub-row":"Expand: add-ons, interest, freight, cost breakdown"}
                            style={{background:"none",border:`1px solid ${expandedRows.has(row.id)?C.amber:C.border}`,
                              borderRadius:3,cursor:"pointer",fontSize:11,color:expandedRows.has(row.id)?C.amber:C.slateL,
                              padding:"1px 4px",marginRight:3}}>
                            {expandedRows.has(row.id)?"▴":"▾"}</button>
                          <button onClick={()=>loadBatchRowIntoCosting(row)} title="Deep-dive in Costing"
                            style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.slateL,padding:"0 3px"}}>🔍</button>
                          <button onClick={()=>setBatchRows(prev=>prev.filter(r=>r.id!==row.id))}
                            style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.red,padding:"0 3px"}}>×</button>
                        </td>
                      </tr>
                      {/* ── Expandable sub-row ── */}
                      {expandedRows.has(row.id)&&(()=>{
                        const AO_FIELDS=[
                          ["printing","Printing"],["stitching","Stitching"],["coating","Coating"],["handling","Handling"],
                          ["moqCharge","MOQ Chg"],["packing","Packing"],["other","Other"],["unloading","Unloading"]];
                        const ao=row.addOns||{};
                        const totalCols=31+pinnedAddOns.length; // match main row colspan
                        const isPP=isPPType(row.itemType); // R-2
                        const profInt=batchProfile.interest??0.5;
                        const profFr=batchProfile.freightOverride||freight?.[batchProfile.plant]?.[batchProfile.delivery]||0;
                        const isIntOvr=row.interestOverride!==""&&row.interestOverride!=null;
                        const isFrOvr=row.freightRowOverride!==""&&row.freightRowOverride!=null;
                        const res2=batchResults[row.id];
                        return(
                        <tr style={{background:ri%2?"#F5F0E8":"#F8F5EF"}}>
                          <td colSpan={totalCols} style={{padding:"6px 16px 8px 8px",borderBottom:`2px solid ${C.amber}44`}}>
                            <div style={{display:"flex",gap:24,flexWrap:"wrap",alignItems:"flex-start",justifyContent:"flex-end"}}>
                              {/* ── Glass SKU Type (ALCOBEV Main Box) ── */}
                              {batchProfile.sector==="ALCOBEV"&&row.itemType==="Box"&&(
                                <div style={{minWidth:200}}>
                                  <div style={{fontSize:9,color:"#2E6094",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>
                                    🍶 Glass SKU Type</div>
                                  <select value={row.glassSKUType||""}
                                    onChange={e=>{
                                      const v=e.target.value;
                                      upd("glassSKUType",v);
                                      // No auto-fill here — propagation happens when Part rows confirm their SET Code
                                    }}
                                    style={{padding:"3px 6px",border:`1px solid ${row.glassSKUType?"#2E6094":C.border}`,
                                      borderRadius:4,fontSize:11,color:C.slate,background:row.glassSKUType?"#EEF4FB":C.white,
                                      width:"100%"}}>
                                    <option value="">— select glass SKU type —</option>
                                    {partitionsMaster.map(x=><option key={x.skuType} value={x.skuType}>{x.skuType}</option>)}
                                  </select>
                                  {row.glassSKUType&&(()=>{
                                    const pm=partitionsMaster.find(x=>x.skuType===row.glassSKUType);
                                    return pm?<div style={{fontSize:9,color:"#2E6094",marginTop:3}}>
                                      Part-L: {pm.lwise} pcs · Part-W: {pm.wwise} pcs
                                      <span style={{fontSize:8,color:C.slateL,marginLeft:4}}>
                                        (auto-fills Nos/Set on Part rows when their SET Code is confirmed)
                                      </span>
                                    </div>:null;
                                  })()}
                                </div>)}
                              {/* ── Glass SKU read-only for Part rows ── */}
                              {batchProfile.sector==="ALCOBEV"&&(row.itemType==="Part-L"||row.itemType==="Part-W")&&(()=>{
                                const parentBox=batchRows.find(r=>
                                  r.itemType==="Box"&&!r.setCodeAssumed&&
                                  (r.setCode||"").trim()===(row.setCode||"").trim());
                                return(
                                <div style={{minWidth:160}}>
                                  <div style={{fontSize:9,color:"#2E6094",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>
                                    🍶 Glass SKU Type</div>
                                  <div style={{fontSize:11,color:parentBox?.glassSKUType?"#2E6094":C.slateL,
                                    padding:"3px 8px",border:"1px solid #6A9FD433",borderRadius:4,background:"#EEF4FB"}}>
                                    {parentBox?.glassSKUType||"— set on Main Box row —"}
                                  </div>
                                  <div style={{fontSize:9,color:C.slateL,marginTop:2}}>
                                    Nos/Set: <b style={{color:C.amber}}>{row.nosPerSet||1}</b>
                                    {parentBox?.glassSKUType&&" (inherited from Main Box)"}
                                  </div>
                                </div>);
                              })()}
                              {/* Add-ons grid */}
                              <div>
                                <div style={{fontSize:9,color:C.amber,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>
                                  Add-on Costs (Rs/pc)</div>
                                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"4px 10px"}}>
                                  {AO_FIELDS.map(([k,lbl])=>(
                                    <div key={k} style={{display:"flex",alignItems:"center",gap:4}}>
                                      <span style={{fontSize:9,color:C.slateL,whiteSpace:"nowrap",minWidth:56}}>{lbl}</span>
                                      <input type="number" step="0.01" value={ao[k]??""}
                                        onChange={e=>updC("addOns",{...ao,[k]:e.target.value===""?"":+e.target.value})}
                                        style={{width:52,padding:"2px 4px",border:`1px solid ${ao[k]?C.amber:C.border}`,
                                          borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                                          background:ao[k]?"#FFF8ED":C.white}}/>
                                      <button onClick={()=>togglePinAddOn(k)}
                                        title={pinnedAddOns.includes(k)?"Unpin from main grid":"Pin to main grid (max 2)"}
                                        style={{background:"none",border:"none",cursor:"pointer",fontSize:12,
                                          color:pinnedAddOns.includes(k)?C.amber:C.slateL,
                                          opacity:(!pinnedAddOns.includes(k)&&pinnedAddOns.length>=2)?0.3:1,
                                          padding:"0 2px"}}>⊕</button>
                                    </div>))}
                                </div>
                              </div>
                              {/* Interest + Freight overrides */}
                              <div>
                                <div style={{fontSize:9,color:C.amber,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>
                                  Row Overrides</div>
                                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                                    <span style={{fontSize:9,color:C.slateL,minWidth:68}}>Interest%</span>
                                    <input type="number" step="0.25" value={row.interestOverride??""}
                                      placeholder={String(profInt)}
                                      onChange={e=>updC("interestOverride",e.target.value===""?"":+e.target.value)}
                                      title={`Profile default: ${profInt}%${isIntOvr?" | OVERRIDDEN":""}`}
                                      style={{width:52,padding:"2px 4px",border:`1px solid ${isIntOvr?C.amber:C.border}`,
                                        borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                                        background:isIntOvr?"#FFF8ED":C.white}}/>
                                    {isIntOvr&&<button onClick={()=>updC("interestOverride","")}
                                      style={{background:"none",border:"none",color:C.slateL,cursor:"pointer",fontSize:10}}>✕</button>}
                                  </div>
                                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                                    <span style={{fontSize:9,color:C.slateL,minWidth:68}}>Freight Rs/kg</span>
                                    <input type="number" step="0.25" value={row.freightRowOverride??""}
                                      placeholder={String(profFr)}
                                      onChange={e=>updC("freightRowOverride",e.target.value===""?"":+e.target.value)}
                                      title={`Profile freight: ${profFr}${isFrOvr?" | OVERRIDDEN":""}`}
                                      style={{width:52,padding:"2px 4px",border:`1px solid ${isFrOvr?C.amber:C.border}`,
                                        borderRadius:3,fontSize:10,textAlign:"center",fontFamily:mono,
                                        background:isFrOvr?"#FFF8ED":C.white}}/>
                                    {isFrOvr&&<button onClick={()=>updC("freightRowOverride","")}
                                      style={{background:"none",border:"none",color:C.slateL,cursor:"pointer",fontSize:10}}>✕</button>}
                                  </div>
                                </div>
                              </div>
                              {/* Cost build-up */}
                              {res2&&(()=>{
                                const tot=res2.total||0;
                                const wt=res2.wtSheet||1; // Sheet weight for /kg calc
                                const items2=[
                                  ["Mat",res2.mat],["Conv",res2.conv],["Add-ons",res2.addOns],
                                  ["Int",res2.intC],["Freight",res2.fr],["Margin",res2.marginAmt]];
                                return(
                                <div>
                                  <div style={{fontSize:9,color:C.amber,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>
                                    Cost Build-up</div>
                                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                                    {items2.map(([lbl,v])=>(
                                      <div key={lbl} style={{textAlign:"center",minWidth:42}}>
                                        <div style={{fontSize:8,color:C.slateL,marginBottom:1}}>{lbl}</div>
                                        <div style={{fontSize:11,fontWeight:700,fontFamily:mono,color:C.slateM}}>
                                          ₹{((v||0)/wt).toFixed(2)}<span style={{fontSize:8,fontWeight:400}}>/kg</span></div>
                                        <div style={{fontSize:8,color:C.slateL}}>{tot>0?((v||0)/tot*100).toFixed(0):0}%</div>
                                        <div style={{fontSize:8,color:C.slateL,opacity:0.6}}>₹{(v||0).toFixed(3)}/pc</div>
                                      </div>))}
                                    <div style={{borderLeft:`1px solid ${C.amber}`,paddingLeft:10,textAlign:"center"}}>
                                      <div style={{fontSize:8,color:C.amber,marginBottom:1}}>FINAL</div>
                                      <div style={{fontSize:13,fontWeight:800,fontFamily:mono,color:C.amber}}>
                                        ₹{res2.ratePerKg?.toFixed(2)}<span style={{fontSize:9,fontWeight:400}}>/kg</span></div>
                                      <div style={{fontSize:10,fontWeight:600,fontFamily:mono,color:C.amberD}}>
                                        ₹{res2.finalRate?.toFixed(2)}<span style={{fontSize:8,fontWeight:400}}>/pc</span></div>
                                    </div>
                                  </div>
                                </div>);
                              })()}
                            </div>
                          </td>
                        </tr>);
                      })()}
                    </Fragment>);
                  })}
                </tbody>
              </table>
            </div>}
        </div>
      </div>
    </div>
  );
  // ── end batchEntryTab ─────────────────────────────────────────────────────

  // ── CONSTRUCTION LIBRARY TAB ─────────────────────────────────────────────
  const constructionLibTab=(()=>{
    // Filter logic for the full tab
    const applyClTabFilter=c=>{
      if(clTabFilter.status!=='all'&&(c.status||'active')!==clTabFilter.status)return false;
      if(clTabFilter.sector&&(c.sector||'')!==clTabFilter.sector)return false;
      if(clTabFilter.client&&(c.client||'')!==clTabFilter.client)return false;
      if(clTabFilter.gsm_min&&+c.board_gsm<+clTabFilter.gsm_min)return false;
      if(clTabFilter.gsm_max&&+c.board_gsm>+clTabFilter.gsm_max)return false;
      if(clTabFilter.bs_min&&+c.spec_bs<+clTabFilter.bs_min)return false;
      if(clTabFilter.bct_min&&+c.spec_bct<+clTabFilter.bct_min)return false;
      if(clTabFilter.ect_min&&+c.spec_ect<+clTabFilter.ect_min)return false;
      if(clTabFilter.cobb_max&&c.spec_cobb&&+c.spec_cobb>+clTabFilter.cobb_max)return false;
      // text search
      if(clTabQuery){
        const q=clTabQuery.toLowerCase();
        const autoN=constrAutoName(c).toLowerCase();
        if(!c.code.toLowerCase().includes(q)&&!autoN.includes(q)&&
           !(c.name||'').toLowerCase().includes(q)&&
           !(c.sector||'').toLowerCase().includes(q)&&
           !(c.client||'').toLowerCase().includes(q))return false;
      }
      return true;
    };
    const filtered=constructionLib.filter(applyClTabFilter);
    const activeCount=constructionLib.filter(c=>(c.status||'active')==='active').length;
    const archivedCount=constructionLib.filter(c=>(c.status||'active')==='archived').length;
    const hasFilter=clTabFilter.status!=='active'||clTabFilter.sector||clTabFilter.client||
      clTabFilter.gsm_min||clTabFilter.gsm_max||clTabFilter.bs_min||clTabFilter.bct_min||
      clTabFilter.ect_min||clTabFilter.cobb_max||clTabQuery;
    return(
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      {/* LEFT SIDEBAR: Filters + Stats */}
      <div style={{width:240,flexShrink:0,borderRight:`1px solid ${C.border}`,overflowY:"auto",
        padding:"14px 12px",background:C.cream,display:"flex",flexDirection:"column",gap:8}}>
        <div style={{fontSize:13,fontWeight:700,color:C.slate}}>Construction Library</div>
        {/* Stats strip */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
          {[["Total",constructionLib.length,C.slateM],["Active",activeCount,C.green],
            ["Archived",archivedCount,C.slateL],
            ["Sectors",[...new Set(constructionLib.map(c=>c.sector||'').filter(Boolean))].length,C.amber]].map(([l,v,col])=>(
            <div key={l} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 10px",textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:800,color:col,fontFamily:mono}}>{v}</div>
              <div style={{fontSize:9,color:C.slateL,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
            </div>))}
        </div>
        {/* Search */}
        <div style={{position:"relative"}}>
          <input value={clTabQuery} onChange={e=>setClTabQuery(e.target.value)}
            placeholder="Search code, name, sector, client…"
            style={{width:"100%",padding:"5px 22px 5px 8px",border:`1px solid ${clTabQuery?C.amber:C.border}`,
              borderRadius:5,fontSize:11,boxSizing:"border-box"}}/>
          {clTabQuery&&<button onClick={()=>setClTabQuery('')}
            style={{position:"absolute",right:4,top:"50%",transform:"translateY(-50%)",
              background:"none",border:"none",cursor:"pointer",fontSize:11,color:C.slateL}}>✕</button>}
        </div>
        {/* Status filter */}
        <div>
          <div style={{fontSize:9,fontWeight:700,color:C.slateL,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Status</div>
          <div style={{display:"flex",gap:3}}>
            {["active","archived","all"].map(s=>(
              <button key={s} onClick={()=>setClTabFilter(p=>({...p,status:s}))}
                style={{flex:1,padding:"3px 0",borderRadius:4,fontSize:10,fontWeight:600,cursor:"pointer",
                  border:`1px solid ${clTabFilter.status===s?C.amber:C.border}`,
                  background:clTabFilter.status===s?C.amber:C.white,
                  color:clTabFilter.status===s?C.white:C.slateL,textTransform:"capitalize"}}>
                {s}</button>))}
          </div>
        </div>
        {/* Sector */}
        <div>
          <div style={{fontSize:9,fontWeight:700,color:C.slateL,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Sector</div>
          <select value={clTabFilter.sector||''} onChange={e=>setClTabFilter(p=>({...p,sector:e.target.value,client:''}))}
            style={{width:"100%",padding:"4px 6px",border:`1px solid ${clTabFilter.sector?C.amber:C.border}`,borderRadius:4,fontSize:11,color:C.slate,background:C.white}}>
            <option value="">All Sectors</option>
            {[...new Set(constructionLib.map(c=>c.sector||'').filter(Boolean))].sort()
              .map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {/* Client */}
        <div>
          <div style={{fontSize:9,fontWeight:700,color:C.slateL,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Client</div>
          <select value={clTabFilter.client||''} onChange={e=>setClTabFilter(p=>({...p,client:e.target.value}))}
            style={{width:"100%",padding:"4px 6px",border:`1px solid ${clTabFilter.client?C.amber:C.border}`,borderRadius:4,fontSize:11,color:C.slate,background:C.white}}>
            <option value="">All Clients</option>
            {[...new Set(constructionLib
              .filter(c=>!clTabFilter.sector||(c.sector||'')===clTabFilter.sector)
              .map(c=>c.client||'').filter(Boolean))].sort()
              .map(cl=><option key={cl} value={cl}>{cl}</option>)}
          </select>
        </div>
        {/* Spec range filters */}
        <div>
          <div style={{fontSize:9,fontWeight:700,color:C.slateL,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Spec Ranges</div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {[["gsm_min","GSM ≥"],["gsm_max","GSM ≤"],["bs_min","BS ≥"],
              ["bct_min","BCT ≥"],["ect_min","ECT ≥"],["cobb_max","Cobb ≤"]].map(([k,lbl])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:9,color:C.slateL,minWidth:52}}>{lbl}</span>
                <input type="number" step={0.25} value={clTabFilter[k]||''}
                  onChange={e=>setClTabFilter(p=>({...p,[k]:e.target.value}))}
                  style={{flex:1,padding:"3px 5px",border:`1px solid ${clTabFilter[k]?C.amber:C.border}`,
                    borderRadius:4,fontSize:10,textAlign:"center"}}/>
              </div>))}
          </div>
        </div>
        {hasFilter&&<button onClick={()=>{setClTabFilter({sector:'',client:'',status:'active'});setClTabQuery('');}}
          style={{padding:"4px",borderRadius:5,border:`1px solid ${C.red}33`,
            background:"transparent",color:C.red,fontSize:10,cursor:"pointer",fontWeight:600}}>
          ✕ Clear all filters
        </button>}
        <div style={{fontSize:9,color:C.slateL,borderTop:`1px solid ${C.border}`,paddingTop:6,marginTop:4}}>
          {filtered.length}/{constructionLib.length} shown
        </div>
      </div>

      {/* RIGHT: Library entries */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Toolbar */}
        <div style={{padding:"8px 16px",borderBottom:`1px solid ${C.border}`,
          display:"flex",gap:8,alignItems:"center",background:C.cream,flexShrink:0}}>
          <button onClick={()=>{
            // Fix 14: first unused letter, not array.length — prevents code reuse after deletions
            const _LETTERS="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const _used=new Set(constructionLib.map(c=>c.code));
            const code=_LETTERS.split("").find(l=>!_used.has(l))||`C${constructionLib.length}`;
            const newEntry={code,name:"",boxType:"RSC",ply:5,
              flute_F1:"B",flute_F2:"A",
              layers:{TOP:{code:"",gsm:""},F1:{code:"",gsm:""},
                L1:{code:"",gsm:""},F2:{code:"",gsm:""},L2:{code:"",gsm:""}},
              waste:null,convRate:null,wastePP:null,convRatePP:null,
              sector:batchProfile.sector||"",client:batchProfile.client||"",status:"active",
              mill_preferences:{TOP:{grade:"",mill:""},F1:{grade:"",mill:""},L1:{grade:"",mill:""},
                F2:{grade:"",mill:""},L2:{grade:"",mill:""}}};
            setConstructionLib(prev=>[...prev,newEntry]);
            setClTabExpandedConstr(String(constructionLib.length));
            setClTabFilter({sector:'',client:'',status:'active'});
            setClTabQuery('');
          }} style={{padding:"5px 14px",borderRadius:6,border:"none",
            background:C.green,color:C.white,fontSize:12,fontWeight:700,cursor:"pointer"}}>
            + New Construction
          </button>
          <button onClick={()=>{
            // ── Duplicate check: exact match on all 5 STDs + Sector ──────────
            // If an existing construction matches on board_gsm, spec_bs, spec_bct,
            // spec_ect, spec_cobb AND sector, it is the same construction regardless
            // of client. Prompt user to add client to the existing entry instead.
            const incomingSector=spec.sector||batchProfile.sector||"";
            const toStr=v=>(v===undefined||v===null||v===""?"":String(v).trim());
            const duplicate=constructionLib.find(c=>
              toStr(c.board_gsm)===toStr(spec.board_gsm)&&
              toStr(c.spec_bs)===toStr(spec.spec_bs)&&
              toStr(c.spec_bct)===toStr(spec.spec_bct)&&
              toStr(c.spec_ect)===toStr(spec.spec_ect)&&
              toStr(c.spec_cobb)===toStr(spec.spec_cobb)&&
              toStr(c.sector)===toStr(incomingSector)
            );
            if(duplicate){
              const incomingClient=spec.client||batchProfile.client||"";
              const existingClient=duplicate.client||"";
              const msg=incomingClient&&incomingClient!==existingClient
                ?`A construction with identical STDs (GSM: ${duplicate.board_gsm||"—"}, BS: ${duplicate.spec_bs||"—"}, BCT: ${duplicate.spec_bct||"—"}, ECT: ${duplicate.spec_ect||"—"}, Cobb: ${duplicate.spec_cobb||"—"}) and sector "${duplicate.sector||"—"}" already exists as [${duplicate.code}].\n\nClient identity is not a reason to create a duplicate construction.\n\nClick OK to add "${incomingClient}" to existing [${duplicate.code}]'s client field instead.`
                :`A construction with identical STDs and sector already exists as [${duplicate.code}].\n\nNo duplicate will be created.`;
              if(incomingClient&&incomingClient!==existingClient){
                if(window.confirm(msg)){
                  // Add incoming client to existing construction's client field
                  const mergedClient=existingClient?`${existingClient}, ${incomingClient}`:incomingClient;
                  setConstructionLib(prev=>prev.map(c=>c.code===duplicate.code?{...c,client:mergedClient}:c));
                  // Expand the existing entry so user can review
                  const idx=constructionLib.findIndex(c=>c.code===duplicate.code);
                  setClTabExpandedConstr(String(idx));
                  setClTabFilter({sector:'',client:'',status:'active'});
                  setClTabQuery('');
                  showToast(`✅ Client "${incomingClient}" added to existing [${duplicate.code}]`,'success',4000);
                }
              } else {
                window.alert(msg);
                // Highlight the existing entry
                const idx=constructionLib.findIndex(c=>c.code===duplicate.code);
                setClTabExpandedConstr(String(idx));
              }
              return; // always stop — never create the duplicate
            }
            // ── No duplicate — proceed with import ───────────────────────────
            // Fix 14: first unused letter, not array.length
            const _ltrs="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const _usedC=new Set(constructionLib.map(c=>c.code));
            const nextCode=_ltrs.split("").find(l=>!_usedC.has(l))||`C${constructionLib.length}`;
            const newConstr={
              code:nextCode,name:"",
              boxType:spec.boxType||"RSC",ply:spec.ply||5,
              flute_F1:spec.flute_F1||"B",flute_F2:spec.flute_F2||"A",
              layers:JSON.parse(JSON.stringify(spec.layers||{})),
              board_gsm:spec.board_gsm||"",spec_bs:spec.spec_bs||"",
              spec_bct:spec.spec_bct||"",spec_ect:spec.spec_ect||"",
              waste:null,convRate:null,wastePP:null,convRatePP:null,
              sector:incomingSector,
              client:spec.client||batchProfile.client||"",
              status:"active",
              mill_preferences:{TOP:{grade:"",mill:""},F1:{grade:"",mill:""},L1:{grade:"",mill:""},
                F2:{grade:"",mill:""},L2:{grade:"",mill:""}},
            };
            setConstructionLib(prev=>[...prev,newConstr]);
            setClTabExpandedConstr(String(constructionLib.length));
            showToast(`✅ Imported as [${nextCode}] — review and save`,'success');
          }} style={{padding:"5px 14px",borderRadius:6,border:`1px solid ${C.amber}`,
            background:C.amberL,color:C.amberD,fontSize:12,fontWeight:700,cursor:"pointer"}}>
            ↓ Import from Costing
          </button>
          <div style={{fontSize:11,color:C.slateL,marginLeft:4}}>
            {constructionLib.length===0?"Library is empty — create your first construction."
              :`${filtered.length} construction${filtered.length!==1?"s":""} shown`}
          </div>
        </div>

        {/* Scrollable entries */}
        <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
          {constructionLib.length===0&&(
            <div style={{textAlign:"center",padding:"40px 0",color:C.slateL}}>
              <div style={{fontSize:32,marginBottom:10}}>🏗</div>
              <div style={{fontSize:14,fontWeight:600,color:C.slateM,marginBottom:6}}>No constructions yet</div>
              <div style={{fontSize:12}}>Click "+ New Construction" above to build your first construction profile,<br/>
                or switch to Costing tab, set up a paper construction, then click "↓ Import from Costing".</div>
            </div>)}

          {filtered.length===0&&constructionLib.length>0&&(
            <div style={{textAlign:"center",padding:"32px 0",color:C.slateL}}>
              <div style={{fontSize:13,fontWeight:600}}>No matches</div>
              <div style={{fontSize:11,marginTop:4}}>Try clearing filters on the left</div>
            </div>)}

          {filtered.map(c=>{
            const ci=constructionLib.indexOf(c);
            const expandKey=String(ci);
            const autoN=constrAutoName(c);
            const isArchived=(c.status||'active')==='archived';
            // Traceability: which batch rows use this construction
            const batchUses=batchRows.filter(r=>r.constructionCode===c.code);
            return(
            <div key={expandKey} style={{marginBottom:8,border:`1px solid ${clTabExpandedConstr===expandKey?C.amber:C.border}`,
              borderRadius:7,opacity:isArchived?0.65:1,background:C.white}}>
              {/* Header row */}
              <div style={{display:"flex",alignItems:"flex-start",padding:"10px 14px",
                background:clTabExpandedConstr===expandKey?C.amberL:C.white,
                borderRadius:clTabExpandedConstr===expandKey?"7px 7px 0 0":"7px",
                cursor:"pointer"}}
                onClick={()=>setClTabExpandedConstr(clTabExpandedConstr===expandKey?null:expandKey)}>
                {/* Code badge */}
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,marginRight:10,flexShrink:0}}>
                  <span style={{fontWeight:900,color:C.amber,fontFamily:mono,fontSize:15,lineHeight:1}}>{c.code}</span>
                  {isArchived&&<span style={{fontSize:7,color:C.slateL,background:"#eee",borderRadius:2,padding:"0 3px",textTransform:"uppercase"}}>arch</span>}
                </div>
                {/* Auto-name + tags */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.slateM,lineHeight:1.3}}>{autoN}</div>
                  {c.name&&<div style={{fontSize:10,color:C.slateL,fontStyle:"italic",marginTop:1}}>{c.name}</div>}
                  <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
                    {c.sector&&<span style={{fontSize:9,background:C.amberL,color:C.amberD,borderRadius:3,padding:"1px 5px"}}>{c.sector}</span>}
                    {c.client&&<span style={{fontSize:9,background:"#EEF4FB",color:"#2E6094",borderRadius:3,padding:"1px 5px"}}>{c.client}</span>}
                    {c.spec_bs&&<span style={{fontSize:9,background:"#F0FFF4",color:C.green,borderRadius:3,padding:"1px 5px"}}>BS≥{c.spec_bs}</span>}
                    {c.spec_bct&&<span style={{fontSize:9,background:"#F0FFF4",color:C.green,borderRadius:3,padding:"1px 5px"}}>BCT≥{c.spec_bct}kgf</span>}
                    {c.board_gsm&&<span style={{fontSize:9,background:C.cream,color:C.slateM,borderRadius:3,padding:"1px 5px"}}>{c.board_gsm}gsm</span>}
                    {batchUses.length>0&&<span style={{fontSize:9,background:"#EEF4FB",color:"#2E6094",borderRadius:3,padding:"1px 5px"}}>
                      ↳ {batchUses.length} batch row{batchUses.length>1?"s":""}</span>}
                  </div>
                </div>
                {/* Actions */}
                <div style={{display:"flex",gap:4,flexShrink:0,marginLeft:8,alignItems:"center"}}>
                  <button onClick={e=>{e.stopPropagation();
                    setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,status:isArchived?"active":"archived"}:x));}}
                    title={isArchived?"Restore":"Archive"}
                    style={{background:"none",border:`1px solid ${C.border}`,borderRadius:4,
                      color:C.slateL,cursor:"pointer",fontSize:11,padding:"3px 6px"}}>
                    {isArchived?"↩ Restore":"📦 Archive"}</button>
                  <button onClick={e=>{e.stopPropagation();
                    // Fix 14: name affected batch rows before deleting — batchUses already computed
                    const msg=batchUses.length>0
                      ?`Delete construction [${c.code}]?\n\n⚠️ ${batchUses.length} batch row(s) use this construction:\n${batchUses.map(r=>`  · ${r.matCode||"(no code)"} ${r.product?`— ${r.product}`:""}`).join("\n")}\n\nThose rows will lose their construction and be dropped by Send All. This cannot be undone.`
                      :`Delete construction [${c.code}]? This cannot be undone.`;
                    if(window.confirm(msg)){
                      setConstructionLib(prev=>prev.filter((_,j)=>j!==ci));
                      if(clTabExpandedConstr===expandKey)setClTabExpandedConstr(null);
                    }}}
                    style={{background:"none",border:`1px solid ${C.red}44`,borderRadius:4,
                      color:C.red,cursor:"pointer",fontSize:11,padding:"3px 6px"}}>Delete</button>
                  <span style={{fontSize:11,color:C.slateL}}>{clTabExpandedConstr===expandKey?"▴":"▾"}</span>
                </div>
              </div>

              {/* Expanded editor */}
              {clTabExpandedConstr===expandKey&&(
              <div style={{padding:"14px 16px",borderTop:`1px solid ${C.border}`,background:"#FAFAFA",
                borderRadius:"0 0 7px 7px"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 20px"}}>
                  {/* Left col: Identity + Tagging */}
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:"uppercase",
                      letterSpacing:"0.07em",marginBottom:8,borderBottom:`1px solid ${C.border}`,paddingBottom:4}}>
                      Identity &amp; Classification
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:"5px 10px",alignItems:"center"}}>
                      {[["Code","code"],["Label","name"]].map(([lbl,k])=>(
                        <Fragment key={k}>
                          <div style={{fontSize:10,color:C.slateL,fontWeight:600}}>{lbl}</div>
                          <input value={c[k]||""} onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,[k]:e.target.value}:x))}
                            style={{padding:"4px 8px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}/>
                        </Fragment>))}
                      <div style={{fontSize:10,color:C.slateL,fontWeight:600}}>Sector</div>
                      <select value={c.sector||""} onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,sector:e.target.value}:x))}
                        style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:10,color:C.slate}}>
                        <option value="">— any —</option>
                        {sectorCodes.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                      <div style={{fontSize:10,color:C.slateL,fontWeight:600}}>Client</div>
                      <input value={c.client||""} placeholder="e.g. Indorama, ITC"
                        onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,client:e.target.value}:x))}
                        style={{padding:"4px 8px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}/>
                      <div style={{fontSize:10,color:C.slateL,fontWeight:600}}>Status</div>
                      <select value={c.status||"active"} onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,status:e.target.value}:x))}
                        style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,color:C.slate}}>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    {/* Std specs */}
                    <div style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:"uppercase",
                      letterSpacing:"0.07em",margin:"12px 0 8px",borderBottom:`1px solid ${C.border}`,paddingBottom:4}}>
                      Standard Specification
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:"5px 10px",alignItems:"center"}}>
                      {[["board_gsm","Board GSM","g/m²"],["spec_bs","BS NLT","kg/cm²"],
                        ["spec_bct","BCT NLT","kgf"],["spec_ect","ECT NLT","kN/m"],
                        ["spec_cobb","Cobb Max","g/m²"]].map(([fk,lbl,unit])=>(
                        <Fragment key={fk}>
                          <div style={{fontSize:10,color:C.slateL}}>{lbl} <span style={{fontSize:8}}>({unit})</span></div>
                          <input type="number" step={fk==="board_gsm"?5:0.25} value={c[fk]||""}
                            onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,[fk]:e.target.value}:x))}
                            style={{padding:"4px 8px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,width:100}}
                            placeholder={lbl}/>
                        </Fragment>))}
                    </div>
                    {/* Traceability */}
                    {batchUses.length>0&&(
                      <div style={{marginTop:12,padding:"7px 10px",background:"#EEF4FB",
                        border:"1px solid #6A9FD433",borderRadius:5}}>
                        <div style={{fontSize:9,fontWeight:700,color:"#2E6094",marginBottom:3}}>
                          ↳ Used in current Batch Entry ({batchUses.length} row{batchUses.length>1?"s":""})</div>
                        {batchUses.map(r=>(
                          <div key={r.id} style={{fontSize:9,color:"#2E6094",paddingLeft:6}}>
                            · {r.matCode||"—"} {r.product?`— ${r.product}`:""}</div>))}
                      </div>)}
                  </div>

                  {/* Right col: Construction + Paper Layers */}
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:"uppercase",
                      letterSpacing:"0.07em",marginBottom:8,borderBottom:`1px solid ${C.border}`,paddingBottom:4}}>
                      Construction
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:"5px 10px",alignItems:"center",marginBottom:10}}>
                      <div style={{fontSize:10,color:C.slateL}}>Ply</div>
                      <select value={c.ply||5} onChange={e=>{
                        const newPly=+e.target.value;
                        // Fix 7: switching to 3-ply must clear F2/L2 layers — leaving them causes ~40-60% overcost
                        if(newPly===3&&(c.layers?.F2?.code||c.layers?.F2?.gsm||c.layers?.L2?.code||c.layers?.L2?.gsm)){
                          if(!window.confirm("Switch to 3-ply? F2 and L2 layer data will be cleared. This prevents overcost from unused layers."))return;
                          setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,ply:3,flute_F2:"",
                            layers:{...x.layers,F2:{code:"",gsm:""},L2:{code:"",gsm:""}}}:x));
                        } else {
                          setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,ply:newPly}:x));
                        }
                      }}
                        style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}>
                        <option value={3}>3-ply</option><option value={5}>5-ply</option>
                      </select>
                      <div style={{fontSize:10,color:C.slateL}}>Box Type</div>
                      <select value={c.boxType||"RSC"} onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,boxType:e.target.value}:x))}
                        style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}>
                        {BOX_TYPES.map(b=><option key={b} value={b}>{b}</option>)}
                      </select>
                      <div style={{fontSize:10,color:C.slateL}}>F1 Flute</div>
                      <select value={c.flute_F1||"B"} onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,flute_F1:e.target.value}:x))}
                        style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}>
                        {["A","B","C","E"].map(f=><option key={f} value={f}>{f}</option>)}
                      </select>
                      {+c.ply===5&&<Fragment>
                        <div style={{fontSize:10,color:C.slateL}}>F2 Flute</div>
                        <select value={c.flute_F2||"A"} onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,flute_F2:e.target.value}:x))}
                          style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}>
                          {["A","B","C","E"].map(f=><option key={f} value={f}>{f}</option>)}
                        </select>
                      </Fragment>}
                    </div>
                    <div style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:"uppercase",
                      letterSpacing:"0.07em",marginBottom:6,borderBottom:`1px solid ${C.border}`,paddingBottom:4}}>
                      Paper Layers
                    </div>
                    {[["TOP","TOP Liner",false],["F1","F1 Medium",true],["L1","L1 Liner",false],
                      ...(+c.ply===5?[["F2","F2 Medium",true],["L2","L2 Liner",false]]:[])].map(([lk,llbl])=>(
                      <div key={lk} style={{display:"grid",gridTemplateColumns:"60px 1fr 70px",gap:"3px 6px",marginBottom:4,alignItems:"center"}}>
                        <div style={{fontSize:10,color:C.slateL,fontWeight:600}}>{llbl}</div>
                        <select value={(c.layers||{})[lk]?.code||""}
                          onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,layers:{...x.layers,[lk]:{...(x.layers?.[lk]||{}),code:e.target.value}}}:x))}
                          style={{padding:"3px 5px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:10,fontFamily:mono}}>
                          <option value="">—</option>{rates.map(r=><option key={r.code} value={r.code}>{r.code}</option>)}
                        </select>
                        <input type="number" placeholder="GSM" value={(c.layers||{})[lk]?.gsm||""}
                          onChange={e=>setConstructionLib(prev=>prev.map((x,j)=>j===ci?{...x,layers:{...x.layers,[lk]:{...(x.layers?.[lk]||{}),gsm:e.target.value}}}:x))}
                          style={{padding:"3px 5px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:10,textAlign:"center"}}/>
                      </div>))}
                  </div>
                </div>
              </div>)}
            </div>);
          })}
        </div>
      </div>
    </div>);
  })();

  const itemsTab=(
    <div style={{padding:20,overflowY:"auto",height:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:C.slate}}>Quote Items</div>
          <div style={{fontSize:11,color:C.slateL}}>{items.length} item{items.length!==1?"s":""} in this session</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",
        background:templateLoaded?"#EBF7F1":"#FFF8ED",borderRadius:7,marginBottom:12,
        border:`1px solid ${templateLoaded?"#2A7550":"#D97B2E"}44`}}>
        <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",
          padding:"7px 14px",borderRadius:6,fontSize:12,fontWeight:700,flexShrink:0,
          background:templateLoaded?"#2A7550":"#D97B2E",color:"white"}}>
          {templateLoaded?"✅ Template Loaded":"📂 Load Master Template (.xlsx)"}
          <input ref={templateRef} type="file" accept=".xlsx" style={{display:"none"}}
            onChange={handleTemplateLoad}/>
        </label>
        <div style={{fontSize:11,color:templateLoaded?"#2A7550":"#B5641F",lineHeight:1.4}}>
          {templateLoaded
            ?"Exports will use your master format — all formulas, formatting and sheet structure preserved. Click to replace."
            :"Upload CFB_Quotation_Master_v6_1.xlsx once. All exports will retain exact formulas, formatting and cross-sheet references."}
        </div>
      </div>

      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {/* Quote Reference + Maker + Dates */}
          <div style={{display:"flex",gap:6,alignItems:"center",padding:"5px 10px",
            background:C.cream,border:`1px solid ${C.border}`,borderRadius:6,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase"}}>Quote Ref</div>
              <input value={quoteRef} onChange={e=>setQuoteRef(e.target.value)}
                style={{border:"none",background:"transparent",fontWeight:700,fontFamily:mono,
                  fontSize:12,color:C.slate,width:120}}/>
            </div>
            <div style={{width:1,height:16,background:C.border}}/>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase"}}>Maker</div>
              <span style={{fontSize:11,color:C.slateM,width:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{makerName}</span>
            </div>
            <div style={{width:1,height:16,background:C.border}}/>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"3px 8px",borderRadius:5,
              background:C.cream,border:`1px solid ${C.border}`}}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase"}}>Quoted</div>
              <input type="date" value={quoteDate} onChange={e=>setQuoteDate(e.target.value)}
                style={{border:"none",background:"transparent",fontSize:11,color:C.slate,fontFamily:mono,cursor:"pointer",width:110}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"3px 8px",borderRadius:5,
              background:(effectiveFrom||effectiveTo)?"#EBF7F1":C.cream,
              border:`1px solid ${effectiveFrom||effectiveTo?C.green:C.border}`}}>
              <div style={{fontSize:9,color:C.slateL,fontWeight:600,textTransform:"uppercase",whiteSpace:"nowrap"}}>
                Price Valid</div>
              <input type="date" value={effectiveFrom} onChange={e=>setEffectiveFrom(e.target.value)}
                style={{border:"none",background:"transparent",fontSize:11,color:C.slate,fontFamily:mono,cursor:"pointer",width:110}}
                title="Effective From"/>
              <span style={{fontSize:10,color:C.slateL}}>—</span>
              <input type="date" value={effectiveTo} onChange={e=>setEffectiveTo(e.target.value)}
                style={{border:"none",background:"transparent",fontSize:11,color:C.slate,fontFamily:mono,cursor:"pointer",width:110}}
                title="Effective To"/>
            </div>
          </div>
          {items.length>0&&(()=>{
            const canExport=quoteRef.trim()&&makerName.trim();
            const exportTip=!quoteRef.trim()?"Quote Ref is required before export":!makerName.trim()?"Your account has no display name set — contact an Admin":"";
            // Fix 11: Capacity limits — v7 template supports max 44 CBB data rows and 30 OFFER rows
            const CBB_MAX=44;
            const OFFER_MAX=30;
            // Fix ③: offerCount corrected — server.py writes ALL items (Box + Plate + Part) sequentially
            // into CBB rows 7…7+len−1, regardless of type. The prior Box-only filter was wrong:
            // 20 Box + 20 Plate = 40 total rows, cbbCount=40 ≤ 44 ✓, but OFFER only mirrors rows 7–36 (30 rows).
            // The correct check is simply items.length for both sheets.
            const cbbCount=items.length;
            const offerCount=items.length; // same limit — server writes all types into the same row band
            const capacityOk=cbbCount<=CBB_MAX&&offerCount<=OFFER_MAX;
            const capacityMsg=cbbCount>CBB_MAX
              ?`❌ Too many items: ${cbbCount} rows exceed the template capacity of ${CBB_MAX} CBB rows. Split the quote into multiple exports.`
              :offerCount>OFFER_MAX
              ?`❌ Too many Box items: ${offerCount} Box rows exceed the OFFER sheet capacity of ${OFFER_MAX}. Split the quote.`
              :"";
            // B3: SET completeness check — warn if any SET has a Box but no Plate/Partition
            const checkSETCompleteness=()=>{
              const setCodes=[...new Set(items.filter(i=>i.spec?.setCode&&i.spec.setCode.trim()).map(i=>i.spec.setCode.trim()))];
              const incomplete=setCodes.filter(sc=>{
                const inSet=items.filter(i=>(i.spec?.setCode||'').trim()===sc);
                const hasBox=inSet.some(i=>(i.spec?.rowType||'Box')==='Box');
                const hasPP=inSet.some(i=>['Plate','Part-L','Part-W'].includes(i.spec?.rowType||''));
                return hasBox&&!hasPP;
              });
              if(incomplete.length>0){
                return window.confirm(`⚠ SET completeness warning:\n\nThe following SET codes have a Box row but no Plate or Partition rows:\n${incomplete.join(', ')}\n\nExport anyway?`);
              }
              return true;
            };
            return(<>
              {!capacityOk&&<div style={{padding:"6px 12px",background:C.redL,border:`1px solid ${C.red}44`,
                borderRadius:5,fontSize:11,color:C.red,fontWeight:600,marginBottom:4}}>
                {capacityMsg}
              </div>}
              <div title={capacityOk?exportTip:capacityMsg} style={{display:"inline-block"}}>
                <Btn ch={templateLoaded?"↓ Export (Master Format)":"↓ Export All to Excel"}
                  v="success"
                  disabled={!canExport||!capacityOk}
                  onClick={()=>{if(checkSETCompleteness())exportFromTemplate(items,rates,freight,templateB64,{quoteRef,makerName,quoteDate,effectiveFrom,effectiveTo,marginPP:batchProfile.marginPP??8},msg=>showToast(msg,'error',8000));}}
                  style={(!canExport||!capacityOk)?{opacity:0.45,cursor:"not-allowed"}:{}}/>
              </div>
              <div title={capacityOk?exportTip:capacityMsg} style={{display:"inline-block"}}>
                <Btn ch="↓ PDF (All SKUs)" v="info"
                  disabled={!canExport}
                  onClick={()=>{if(checkSETCompleteness())exportAllPDF(items,{quoteRef,makerName,paymentDisc:batchProfile.paymentDisc||"30",effectiveTo});}}
                  style={!canExport?{opacity:0.45,cursor:"not-allowed"}:{}}/>
              </div>
              {!canExport&&<span style={{fontSize:10,color:C.red,fontWeight:600}}>{exportTip}</span>}
            </>);
          })()}

          {/* Fix 12: Re-import Excel button removed — the parseImportedExcel function reads
              wrong columns throughout (margin from Total Cost column etc.) and produces
              confidently wrong items. Disabled pre-beta; re-enable after column mapping is fixed.
          <label style={{padding:"8px 16px",borderRadius:6,fontSize:13,fontWeight:600,
            cursor:"pointer",background:C.white,color:C.slateM,border:`1px solid ${C.border}`}}>
            ↑ Re-import Excel
            <input ref={importRef} type="file" accept=".xlsx,.xls" style={{display:"none"}}
              onChange={handleImport}/>
          </label> */}
          {items.length>0&&<Btn ch="Clear All" v="danger" sm onClick={()=>{
            if(window.confirm("Clear all items? They will be lost unless exported."))setItems([]);}}/>}
          {Object.keys(savedQuotes).length>0&&<Btn ch={`📁 Drafts (${Object.keys(savedQuotes).length})`}
            v="secondary" sm onClick={()=>{
              const names=Object.keys(savedQuotes).join(", ");
              const pick=window.prompt(`Saved drafts: ${names}\n\nType client name to restore:`);
              if(pick&&savedQuotes[pick]){setItems(savedQuotes[pick].items);
                setSavedQuotes(prev=>{const n={...prev};delete n[pick];return n;});}}}/>}
        </div>
      </div>
      {items.length===0&&<div style={{textAlign:"center",color:C.slateL,marginTop:60,fontSize:13}}>
        No items yet. Add rows in <button onClick={()=>setTab("batch")} style={{background:"none",border:"none",color:C.amber,fontWeight:700,cursor:"pointer",fontSize:13,textDecoration:"underline"}}>Batch Entry</button>, calculate, then click "Send All to Quote Items".
      </div>}
      {items.length>0&&<>
      {(()=>{
        const setMap={};const standalone=[];
        items.forEach(item=>{
          const sc=(item.spec.setCode||"").trim().toUpperCase();
          if(sc){if(!setMap[sc])setMap[sc]=[];setMap[sc].push(item);}else standalone.push(item);
        });
        const IRw=({item,bg})=>{const{spec:is,result:ir}=item;return(
          <tr key={item.id} style={{background:bg,cursor:"pointer"}} onClick={()=>loadItem(item)}>
            <td style={{padding:"5px 10px"}}>
              {is.setCode&&<span style={{fontSize:9,background:C.amber,color:C.white,padding:"1px 5px",borderRadius:3,marginRight:4}}>{is.setCode}</span>}
              {is.rowType!=="Box"&&<span style={{fontSize:9,color:C.slateL,marginRight:3}}>({is.rowType})</span>}
              <span style={{fontFamily:mono,fontSize:11}}>{is.material_code||"—"}</span>
            </td>
            <td style={{padding:"5px 10px",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{is.product||"—"}</td>
            <td style={{padding:"5px 10px",fontFamily:mono,fontSize:11}}>{is.L&&is.W?`${is.L}×${is.W}${is.H?"×"+is.H:""}`:""}</td>
            <td style={{padding:"5px 10px"}}>{is.ply}p {is.flute_F1||"—"}{(+is.ply===5&&is.flute_F2)?"/"+is.flute_F2:""}</td>
            <td style={{padding:"5px 10px",fontFamily:mono}}>{is.spec_bs||"—"}</td>
            <td style={{padding:"5px 10px",fontFamily:mono,color:ir&&is.spec_bs?Math.abs(ir.calcBS-+is.spec_bs)/+is.spec_bs>0.05?C.orange:C.green:C.slateL}}>{ir?.calcBS||"—"}</td>
            <td style={{padding:"5px 10px",textAlign:"center",fontFamily:mono,color:C.slateL,fontSize:11}}>{ir?(ir.wtSheet*1000).toFixed(0)+"g":"—"}</td>
            <td style={{padding:"5px 10px",textAlign:"center",fontWeight:800,color:C.amber,fontFamily:mono}}>
              {ir?`₹${ir.finalRate.toFixed(2)}`:"—"}
              {ir&&(+is.qtyPerSet||1)>1&&<div style={{fontSize:9,color:C.slateL,fontWeight:400,marginTop:1}}>
                ×{is.qtyPerSet} = ₹{(ir.finalRate*(+is.qtyPerSet||1)).toFixed(2)}
              </div>}
            </td>
            <td style={{padding:"5px 10px",textAlign:"center",fontFamily:mono,fontSize:11}}>{ir?ir.calcMOQ.toLocaleString():"—"}</td>
            <td style={{padding:"4px 4px"}} onClick={e=>{e.stopPropagation();removeItem(item.id);}}>
              <button style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:16}}>×</button>
            </td>
          </tr>);};
        return<div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:860}}>
            <thead><tr style={{background:C.slateM}}>
              {["Mat Code / Type","SKU","Dims","Construction","Std BS","Calc BS","Sheet Wt","Final Rate","MOQ",""].map(h=>(
                <th key={h} style={{padding:"7px 10px",color:C.white,fontSize:10,fontWeight:600,
                  textAlign:["Final Rate","MOQ","Sheet Wt"].includes(h)?"center":"left"}}>{h}</th>))}
            </tr></thead>
            <tbody>
              {standalone.map((item,i)=><IRw key={item.id} item={item} bg={i%2?C.cream:C.white}/>)}
              {Object.entries(setMap).map(([sc,si])=>[
                <tr key={sc+"-h"} style={{background:C.slateM}}>
                  <td colSpan={10} style={{padding:"5px 10px",color:C.amber,fontWeight:700,fontSize:11}}>
                    📦 SET: {sc} &nbsp;·&nbsp; {si.length} item{si.length>1?"s":""} &nbsp;·&nbsp;
                    <span style={{fontFamily:mono}}>SET Rate: ₹{si.filter(i=>i.result).reduce((s,i)=>s+i.result.finalRate*(+i.spec.qtyPerSet||1),0).toFixed(2)}/set</span>
                  </td>
                </tr>,
                ...si.map((item,i)=><IRw key={item.id} item={item} bg={i%2?"#F5F0EC":C.cream}/>),
                <tr key={sc+"-f"} style={{background:"#EBE3D8"}}>
                  <td colSpan={7} style={{padding:"4px 10px",fontSize:10,fontWeight:600,color:C.slateM}}>
                    SET {sc} total ({si.filter(i=>i.result).length} items costed)</td>
                  <td style={{padding:"4px 10px",textAlign:"center",fontWeight:800,color:C.amberD,fontFamily:mono}}>
                    ₹{si.filter(i=>i.result).reduce((s,i)=>s+i.result.finalRate*(+i.spec.qtyPerSet||1),0).toFixed(2)}</td>
                  <td colSpan={2}/>
                </tr>
              ])}
            </tbody>
          </table>
        </div>;
      })()}
        <div style={{marginTop:10,fontSize:11,color:C.slateL,padding:"8px 12px",
          background:C.cream,borderRadius:6}}>
          Click any row to load it into the Costing tab for deep-dive analysis.
          To revise a rate, go to Batch Entry → adjust → Calculate All → Send All to Quote Items again.
          Re-import: export to Excel, make manual revisions, then use "Re-import Excel" to bring back revised items.
        </div>
      </>}
    </div>
  );


  // ── DEFAULTS TAB ──────────────────────────────────────────────────────────
  const defaultsTab=(
    <div style={{overflowY:"auto",height:"100%",padding:20}}>
      {/* SECTOR DEFAULTS */}
      <div style={{marginBottom:28}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.slate}}>Sector Defaults</div>
            <div style={{fontSize:11,color:C.slateL}}>Editable by Admin. Selecting a sector in Costing tab auto-populates Waste%, Conv rates.</div>
          </div>
          {role!=="admin"&&<span style={{fontSize:11,color:C.slateL}}>Switch to Admin to edit</span>}
          {role==="admin"&&<span style={{fontSize:11,color:C.green,fontWeight:600}}>⚙ Admin — edit enabled</span>}
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:800}}>
            <thead><tr style={{background:C.slateM}}>
              {["Sector Code","Sector Name","Waste% (CBB)","Waste% (P&P)","Conv Rs/kg (Box)","Conv Rs/kg (P&P)","Spec Language",...(role==="admin"?[""]:[])].map(h=>(
                <th key={h} style={{padding:"7px 10px",color:C.white,fontSize:10,fontWeight:600,
                  textAlign:h==="Sector Code"||h==="Sector Name"?"left":"center",whiteSpace:"pre"}}>{h}</th>))}
            </tr></thead>
            <tbody>
              {sectors.map((row,i)=>{
                const upd=(field,val)=>setSectors(prev=>prev.map((r,j)=>j===i?{...r,[field]:val}:r));
                const EditNum=({field,w=60})=>role==="admin"
                  ?<input type="number" step="0.5" value={row[field]} onChange={e=>upd(field,+e.target.value)}
                     style={{width:w,padding:"3px 5px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center",fontFamily:mono}}/>
                  :<span style={{fontFamily:mono}}>{row[field]}</span>;
                const EditStr=({field,w=80})=>role==="admin"
                  ?<input type="text" value={row[field]} onChange={e=>upd(field,e.target.value)}
                     style={{width:w,padding:"3px 5px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}/>
                  :<span>{row[field]}</span>;
                return<tr key={row.code} style={{background:i%2?C.cream:C.white}}>
                  <td style={{padding:"5px 8px",fontWeight:700,color:C.slateM,fontFamily:mono,fontSize:11}}>
                    {role==="admin"&&(()=>{
                      // Code is the join key across batchProfile.sector and constructionLib.sector.
                      // Editing it character-by-character orphans every reference at the first keystroke.
                      // Allow edit only while the code is unreferenced — covers typo-fixing just after
                      // adding. Once referenced, show as read-only with a title hint.
                      const isReferenced=batchProfile.sector===row.code||
                        constructionLib.some(c=>c.sector===row.code);
                      return isReferenced
                        ?<span style={{fontFamily:mono,fontWeight:700,fontSize:11,
                            cursor:"not-allowed",borderBottom:`1px dashed ${C.border}`}}
                            title={`Code locked — referenced by ${batchProfile.sector===row.code?"the active Batch Profile":""}`+
                              `${constructionLib.some(c=>c.sector===row.code)?` ${constructionLib.filter(c=>c.sector===row.code).length} construction(s)`:""}. `+
                              `To rename, first re-assign all references, then edit the code.`}>
                          {row.code}
                        </span>
                        :<input type="text" value={row.code}
                            onChange={e=>upd("code",e.target.value.toUpperCase())}
                            title="Code is editable while unreferenced. Will lock once used."
                            style={{width:90,padding:"3px 5px",border:`1px solid ${C.border}`,borderRadius:4,
                              fontSize:11,fontFamily:mono,fontWeight:700,textTransform:"uppercase"}}/>;
                    })()}
                    {role!=="admin"&&<span>{row.code}</span>}
                  </td>
                  <td style={{padding:"5px 8px",color:C.slateL,fontSize:11}}><EditStr field="name" w={160}/></td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}><EditNum field="wasteCBB"/>%</td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}><EditNum field="wastePP"/>%</td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}><EditNum field="convBox" w={65}/></td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}><EditNum field="convPP" w={65}/></td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}><EditStr field="specLang" w={80}/></td>
                  {role==="admin"&&<td style={{padding:"4px 6px",textAlign:"center"}}>
                    <button onClick={()=>{
                      // Delete guard: check batchProfile and constructionLib usage
                      // Bug fix: old guard used batchRows.filter(r=>batchProfile.sector===row.code)
                      // — predicate never referenced r, so .length = all rows or 0.
                      // Correct: check batchProfile.sector directly (batch-wide, not per row).
                      const profileUses=batchProfile.sector===row.code;
                      const inConstr=constructionLib.filter(c=>c.sector===row.code).length;
                      const msg=`Delete sector [${row.code}]?`
                        +(profileUses?`\n⚠️ Active Batch Profile uses this sector.`:"")
                        +(inConstr>0?`\n⚠️ ${inConstr} construction(s) reference this sector.`:"")
                        +"\nThis cannot be undone.";
                      if(window.confirm(msg))setSectors(prev=>prev.filter((_,j)=>j!==i));
                    }} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:15,padding:"0 4px"}}>×</button>
                  </td>}
                </tr>;})}
            </tbody>
          </table>
        </div>
        {role==="admin"&&<div style={{marginTop:8,fontSize:10,color:C.slateL}}>
          Changes apply immediately. Selecting a sector in the Costing form auto-fills Waste% (CBB) and Conv Rs/kg (Box).</div>}
        {role==="admin"&&(()=>{
          // newSector state is hoisted to component level (Rules of Hooks:
          // useState cannot be called inside a conditional or an IIFE in JSX —
          // doing so caused a blank screen when switching to Admin role).
          const ns=newSector;
          const setNs=setNewSector;
          const codeOk=ns.code.trim()&&!sectors.find(s=>s.code===ns.code.trim().toUpperCase());
          return<div style={{display:"flex",gap:6,alignItems:"center",marginTop:8,flexWrap:"wrap"}}>
            <span style={{fontSize:10,fontWeight:700,color:C.slateM}}>+ Add Sector:</span>
            {[["Code",60,"code"],[" Name",120,"name"]].map(([lbl,w,k])=>
              <input key={k} type="text" placeholder={lbl} value={ns[k]}
                onChange={e=>setNs(p=>({...p,[k]:k==="code"?e.target.value.toUpperCase():e.target.value}))}
                style={{width:w,padding:"3px 6px",border:`1px solid ${codeOk||!ns.code?C.border:C.red}`,
                  borderRadius:4,fontSize:11,fontFamily:k==="code"?mono:sans}}/>)}
            {[["Waste%",48,"wasteCBB",0.5],["WastePP%",48,"wastePP",0.5],
              ["ConvBox",52,"convBox",0.5],["ConvPP",52,"convPP",0.5]].map(([lbl,w,k,step])=>
              <input key={k} type="number" step={step} placeholder={lbl} value={ns[k]}
                onChange={e=>setNs(p=>({...p,[k]:+e.target.value}))}
                style={{width:w,padding:"3px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,fontFamily:mono,textAlign:"center"}}/>)}
            <input type="text" placeholder="SpecLang" value={ns.specLang}
              onChange={e=>setNs(p=>({...p,specLang:e.target.value}))}
              style={{width:70,padding:"3px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11}}/>
            <button disabled={!codeOk} onClick={()=>{
              setSectors(prev=>[...prev,{...ns,code:ns.code.trim().toUpperCase()}]);
              setNs({code:"",name:"",wasteCBB:5,wastePP:5,convBox:7,convPP:12.5,specLang:"BS"});
              showToast(`✅ Sector [${ns.code.toUpperCase()}] added`,'success');
            }} style={{padding:"4px 10px",borderRadius:4,border:"none",
              background:codeOk?C.green:"#CCC",color:C.white,fontSize:11,fontWeight:700,
              cursor:codeOk?"pointer":"not-allowed"}}>+ Add</button>
            {ns.code&&!codeOk&&sectors.find(s=>s.code===ns.code.toUpperCase())&&
              <span style={{fontSize:10,color:C.red}}>Code already exists</span>}
          </div>;
        })()}
      </div>

      {/* BOX TYPE TRIM DEFAULTS */}
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.slate}}>Box Type Trim Defaults</div>
            <div style={{fontSize:11,color:C.slateL}}>Auto-fills trim margins in the Costing form when box type is selected. Override per SKU if needed.</div>
          </div>
        </div>
        <table style={{borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:C.slateM}}>
            {["Box Type","3-ply Dkl","3-ply Cut","5-ply Dkl","5-ply Cut","Deckle Formula","Cutting Formula"].map(h=>(
              <th key={h} style={{padding:"7px 14px",color:C.white,fontSize:10,fontWeight:600,
                textAlign:h==="Box Type"?"left":"center"}}>{h}</th>))}
          </tr></thead>
          <tbody>
            {Object.entries(boxTrim).map(([bt,t],i)=>{
              const upd=(field,val)=>setBoxTrim(prev=>({...prev,[bt]:{...prev[bt],[field]:+val}}));
              const TCell=({field})=>role==="admin"
                ?<input type="number" step="1" value={t[field]} onChange={e=>upd(field,e.target.value)}
                   style={{width:70,padding:"3px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:12,textAlign:"center",fontFamily:mono}}/>
                :<span style={{fontFamily:mono,fontWeight:600}}>{t[field]}</span>;
              return<tr key={bt} style={{background:i%2?C.cream:C.white}}>
                <td style={{padding:"5px 14px",fontWeight:700,color:C.slateM}}>{bt}</td>
                <td style={{padding:"4px 10px",textAlign:"center"}}><TCell field="d3"/></td>
                <td style={{padding:"4px 10px",textAlign:"center"}}><TCell field="c3"/></td>
                <td style={{padding:"4px 10px",textAlign:"center"}}><TCell field="d5"/></td>
                <td style={{padding:"4px 10px",textAlign:"center"}}><TCell field="c5"/></td>
                <td style={{padding:"4px 8px",fontSize:9,color:C.slateL,fontStyle:"italic"}}>{t.deckleF||"—"}</td>
                <td style={{padding:"4px 8px",fontSize:9,color:C.slateL,fontStyle:"italic"}}>{t.cuttingF||"—"}</td>
              </tr>;})}
          </tbody>
        </table>
        {role!=="admin"&&<div style={{marginTop:8,fontSize:11,color:C.amberD,padding:"6px 10px",background:"#FFF8ED",borderRadius:6}}>
          Switch to Admin role to edit trim margins.</div>}
        <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center"}}>
          {role==="admin"&&<button onClick={()=>{
            const fresh={...DEFAULT_BOX_TRIM_DATA};
            setBoxTrim(fresh);
            try{localStorage.setItem('cbb_boxtrim',JSON.stringify(fresh));}catch(e){}
            }} style={{padding:"4px 12px",borderRadius:5,border:`1px solid ${C.border}`,
              background:C.white,color:C.slateM,fontSize:11,cursor:"pointer",fontWeight:600}}>
            ↺ Reset to Defaults</button>}
          <div style={{fontSize:10,color:C.slateL}}>
            PP: trim=0 · Board: trim=10mm · Custom: 0 · Changes are saved automatically.</div>
        </div>
      </div>

      {/* PARTITIONS MASTER */}
      <div style={{marginTop:24,paddingTop:20,borderTop:`1px solid ${C.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.slate}}>Partitions Master — Alcobev Glass SKU</div>
            <div style={{fontSize:11,color:C.slateL}}>Nos per set by SKU type. Auto-fills Nos/Set when Glass SKU is selected in the SET config for Partition-L and Partition-W rows.</div>
          </div>
          {role==="admin"&&<Btn ch="+ Add SKU" v="success" sm onClick={()=>setPartitionsMaster(prev=>[...prev,{skuType:"New SKU",lwise:1,wwise:1}])}/>}
        </div>
        <table style={{borderCollapse:"collapse",fontSize:12,minWidth:480}}>
          <thead><tr style={{background:C.slateM}}>
            {["SKU Type","Part-L (Length-wise nos)","Part-W (Width-wise nos)",...(role==="admin"?[""]:[])]
              .map(h=><th key={h} style={{padding:"7px 14px",color:C.white,fontSize:10,fontWeight:600,textAlign:h==="SKU Type"?"left":"center"}}>{h}</th>)}
          </tr></thead>
          <tbody>{partitionsMaster.map((row,i)=>(
            <tr key={i} style={{background:i%2?C.cream:C.white}}>
              <td style={{padding:"5px 14px",fontWeight:600,color:C.slateM}}>
                {role==="admin"?<input value={row.skuType} onChange={e=>setPartitionsMaster(prev=>prev.map((r,j)=>j===i?{...r,skuType:e.target.value}:r))}
                  style={{border:`1px solid ${C.border}`,borderRadius:4,padding:"3px 7px",fontSize:12,width:140}}/>
                :row.skuType}
              </td>
              {["lwise","wwise"].map(field=>(
                <td key={field} style={{padding:"4px 14px",textAlign:"center"}}>
                  {role==="admin"?<input type="number" min="0" step="1" value={row[field]}
                    onChange={e=>setPartitionsMaster(prev=>prev.map((r,j)=>j===i?{...r,[field]:+e.target.value}:r))}
                    style={{width:60,padding:"3px 6px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:12,textAlign:"center",fontFamily:mono}}/>
                  :<span style={{fontFamily:mono,fontWeight:700,fontSize:13}}>{row[field]}</span>}
                </td>))}
              {role==="admin"&&<td style={{padding:"3px 4px",textAlign:"center"}}>
                <button onClick={()=>setPartitionsMaster(prev=>prev.filter((_,j)=>j!==i))}
                  style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:16}}>×</button>
              </td>}
            </tr>))}
          </tbody>
        </table>
        {role!=="admin"&&<div style={{marginTop:8,fontSize:11,color:C.amberD,padding:"6px 10px",background:"#FFF8ED",borderRadius:6}}>
          Switch to Admin to edit the Partitions Master.</div>}
      </div>
    </div>
  );

  // ── RATE MASTER TAB ───────────────────────────────────────────────────────
  const rateTab=(
    <div style={{padding:16,overflowY:"auto",height:"100%"}}>

      {/* ── Strip 1: Price Rules ──────────────────────────────────────────── */}
      <div style={{background:"#EEF4FB",border:"1px solid #6A9FD4",borderRadius:8,
        padding:"10px 14px",marginBottom:10}}>
        {/* Row 1: all bulk controls */}
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"nowrap",overflowX:"auto"}}>
          {/* GY Premiums */}
          <span style={{fontSize:10,fontWeight:700,color:"#2E6094",whiteSpace:"nowrap"}}>GY Premium</span>
          {[["16–24BF",gyPremLow,setGyPremLow],["28–35BF",gyPremHigh,setGyPremHigh]].map(([lbl,val,setter])=>(
            <div key={lbl} style={{display:"flex",alignItems:"center",gap:2}}>
              <span style={{fontSize:9,color:C.slateL,whiteSpace:"nowrap"}}>{lbl}</span>
              <input type="number" step="0.25" value={val} disabled={role!=="admin"}
                onChange={e=>setter(+e.target.value)}
                style={{width:46,padding:"3px 4px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center",fontFamily:mono}}/>
            </div>))}
          {role==="admin"&&<button onClick={()=>{
            let _n=0;setRates(prev=>prev.map(gr=>{
              if(!gr.code.endsWith("GY"))return gr;
              const bf=parseInt(gr.code)||0;
              const nat=prev.find(x=>x.code===gr.code.replace("GY",""));
              if(!nat)return gr;_n++;
              return{...gr,price:+(nat.price+(bf<=24?gyPremLow:gyPremHigh)).toFixed(2)};
            }));touchRateDate();showToast(`GY applied — ${_n} grades`,"info");
          }} style={{padding:"3px 8px",borderRadius:5,border:"none",background:"#2E6094",
            color:C.white,fontSize:9,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>Apply GY</button>}

          <div style={{width:1,height:22,background:"#6A9FD4",flexShrink:0}}/>

          {/* Freight by BF Band */}
          <span style={{fontSize:10,fontWeight:700,color:"#2E6094",whiteSpace:"nowrap"}}>Freight</span>
          {[
            {lbl:"16–20BF",codes:["16","18","20","20GY"]},
            {lbl:"22–28BF",codes:["22","24","28","22GY","24GY","28GY","26HRCT"]},
            {lbl:"35BF+",codes:["35","35GY","25WTL","14DUP","40VKL"]},
          ].map((b,bi)=>(
            <div key={b.lbl} style={{display:"flex",alignItems:"center",gap:2}}>
              <span style={{fontSize:9,color:C.slateL,whiteSpace:"nowrap"}}>{b.lbl}</span>
              <input type="number" step="0.25" min="0" value={freightBands[bi]||0}
                onChange={e=>{const nv=[...freightBands];nv[bi]=+e.target.value;setFreightBands(nv);}}
                style={{width:40,padding:"3px 4px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center"}}
                disabled={role!=="admin"}/>
              {role==="admin"&&<button onClick={()=>{
                setRates(prev=>prev.map(r=>b.codes.includes(r.code)?{...r,freight:freightBands[bi]||0}:r));
                touchRateDate();showToast(`Freight ₹${freightBands[bi]||0}/kg → ${b.lbl}`,'info');
              }} style={{padding:"2px 5px",borderRadius:4,border:`1px solid ${C.amber}`,
                background:C.amberL,color:C.amberD,fontSize:9,cursor:"pointer",fontWeight:700}}>→</button>}
            </div>))}

          <div style={{width:1,height:22,background:"#6A9FD4",flexShrink:0}}/>

          {/* Blanket Discount */}
          <span style={{fontSize:10,fontWeight:700,color:"#2E6094",whiteSpace:"nowrap"}}>Disc</span>
          <input type="number" step="0.25" value={blanketDisc} disabled={role!=="admin"}
            onChange={e=>setBlanketDisc(+e.target.value)}
            style={{width:44,padding:"3px 4px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center",fontFamily:mono}}/>
          {role==="admin"&&<button onClick={()=>{
            setRates(prev=>prev.map(r=>({...r,disc:blanketDisc})));
            touchRateDate();showToast(`Disc ₹${blanketDisc}/kg → all`,'info');
          }} style={{padding:"2px 7px",borderRadius:4,border:`1px solid ${C.border}`,
            background:C.white,color:C.slateM,fontSize:9,fontWeight:600,cursor:"pointer"}}>All</button>}

          <div style={{width:1,height:22,background:"#6A9FD4",flexShrink:0}}/>

          {/* Blanket Interest (credit cost %) */}
          <span style={{fontSize:10,fontWeight:700,color:"#2E6094",whiteSpace:"nowrap"}}>Credit%</span>
          <input type="number" step="0.25" value={blanketInterest} disabled={role!=="admin"}
            onChange={e=>setBlanketInterest(+e.target.value)}
            style={{width:44,padding:"3px 4px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center",fontFamily:mono}}/>
          {role==="admin"&&<button onClick={()=>{
            setRates(prev=>prev.map(r=>({...r,interest:blanketInterest})));
            touchRateDate();showToast(`Credit ${blanketInterest}% → all grades`,'info');
          }} style={{padding:"2px 7px",borderRadius:4,border:`1px solid ${C.border}`,
            background:C.white,color:C.slateM,fontSize:9,fontWeight:600,cursor:"pointer"}}>All</button>}
        </div>

        {/* Row 2: footnote + date */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:5}}>
          <div style={{fontSize:9,color:"#6A9FD4"}}>
            GSM surcharge applied per layer during costing (not in Rate Master Eff Rate): &lt;100=+₹4 · =100=+₹1.5 · &gt;200=+₹1 &nbsp;|&nbsp;
            Example: 22BF=₹{rates.find(r=>r.code==="22")?.price||"—"} + GY₹{gyPremLow} → 22GY=₹{rates.find(r=>r.code==="22")?(rates.find(r=>r.code==="22").price+gyPremLow).toFixed(2):"—"}
          </div>
          <div style={{fontSize:9,color:C.slateL,textAlign:"right",whiteSpace:"nowrap",marginLeft:12}}>
            {rateUpdatedAt?<><b style={{color:"#2E6094"}}>Updated:</b> {rateUpdatedAt}</>:"Rate date not set"}
            {role==="admin"&&<> · <button onClick={touchRateDate}
              style={{background:"none",border:"none",color:"#2E6094",cursor:"pointer",fontSize:9,textDecoration:"underline",padding:0}}>
              Mark today</button></>}
          </div>
        </div>
      </div>

      {/* ── Strip 2: Add Grade (admin only) ───────────────────────────────── */}
      {role==="admin"&&<div style={{display:"flex",gap:6,alignItems:"center",
        background:C.cream,border:`1px solid ${C.border}`,borderRadius:7,
        padding:"7px 12px",marginBottom:10}}>
        <span style={{fontSize:10,fontWeight:700,color:C.amber,whiteSpace:"nowrap"}}>+ New Grade</span>
        {[
          {k:"code",ph:"Code e.g. 30GY",w:90},
          {k:"desc",ph:"Short description",w:180},
          {k:"price",ph:"Price",w:70,t:"number"},
          {k:"disc",ph:"Disc",w:55,t:"number"},
          {k:"freight",ph:"Freight",w:60,t:"number"},
        ].map(({k,ph,w,t="text"})=>(
          <input key={k} type={t} step={t==="number"?"0.25":undefined}
            value={newGrade[k]??""} placeholder={ph}
            onChange={e=>setNewGrade(g=>({...g,[k]:t==="number"?+e.target.value:e.target.value}))}
            style={{width:w,padding:"4px 7px",border:`1px solid ${C.border}`,borderRadius:5,
              fontSize:11,fontFamily:k==="code"||t==="number"?mono:sans}}/>))}
        <button onClick={()=>{
          if(!newGrade.code||!newGrade.price){showToast("Code and Price required",'error');return;}
          if(rates.find(r=>r.code===newGrade.code)){showToast("Grade code already exists",'error');return;}
          setRates(prev=>[...prev,{...newGrade,freight:newGrade.freight||0}]);
          touchRateDate();
          setNewGrade({code:"",desc:"",price:"",disc:1.5,freight:0});
        }} style={{padding:"4px 14px",borderRadius:5,border:"none",background:C.green,
          color:C.white,fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
          Add Grade</button>
        <span style={{fontSize:9,color:C.slateL,marginLeft:4}}>Eff Rate = Price + Credit% − Disc + Freight</span>
      </div>}

      {/* ── Rate Master table ─────────────────────────────────────────────── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <div style={{fontSize:13,fontWeight:700,color:C.slate}}>Rate Master
          <span style={{fontSize:10,fontWeight:400,color:C.slateL,marginLeft:8}}>
            {rates.length} grades · effective rates used in all costing</span>
        </div>
        {role==="admin"&&<span style={{fontSize:10,color:C.green,fontWeight:600}}>⚙ Admin — edit enabled</span>}
      </div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <thead><tr style={{background:C.slateM}}>
          {["Grade","Description","Paper Price","Credit %","Discount","Freight","Eff Rate",...(role==="admin"?[""]:[])].map(h=>(
            <th key={h} style={{padding:"6px 8px",color:C.white,fontSize:10,fontWeight:600,
              textAlign:["Paper Price","Credit %","Discount","Freight","Eff Rate"].includes(h)?"center":"left"}}>{h}</th>))}
        </tr></thead>
        <tbody>{rates.map((row,i)=>{
          const gCreditPct=(row.interest!=null&&row.interest!=='')?+row.interest/100:CREDIT_PCT;
          const eff=row.price?+(row.price+row.price*gCreditPct-(row.disc||0)+(row.freight||0)).toFixed(2):0;
          const fld=(k,w,step=0.5)=>role==="admin"
            ?<input value={row[k]??0} type="number" step={step}
               onChange={e=>{setRates(prev=>prev.map((r,j)=>j===i?{...r,[k]:+e.target.value}:r));touchRateDate();}}
               style={{width:w,padding:"3px 5px",border:`1px solid ${k==="freight"&&(row.freight||0)>0?C.amber:C.border}`,
                 borderRadius:4,fontSize:11,textAlign:"center",fontFamily:mono,
                 background:k==="freight"&&(row.freight||0)>0?"#FFF8ED":C.white}}/>
            :<span style={{fontFamily:mono,color:k==="freight"&&(row.freight||0)>0?C.amberD:C.slateL}}>
               {row[k]||"—"}</span>;
          return<tr key={row.code} style={{background:i%2?C.cream:C.white,borderBottom:`1px solid ${C.border}22`}}>
            <td style={{padding:"4px 8px",fontWeight:700,color:C.slateM,fontFamily:mono,fontSize:12}}>{row.code}</td>
            <td style={{padding:"4px 8px",color:C.slateL,fontSize:11,maxWidth:200}}>{row.desc}</td>
            <td style={{padding:"4px 8px",textAlign:"center"}}>{fld("price",65,0.5)}</td>
            <td style={{padding:"4px 6px",textAlign:"center"}}>
              {role==="admin"
                ?<input value={row.interest??1.5} type="number" step="0.25" min="0" max="5"
                   onChange={e=>{setRates(prev=>prev.map((r,j)=>j===i?{...r,interest:+e.target.value}:r));touchRateDate();}}
                   style={{width:46,padding:"3px 4px",border:`1px solid ${C.border}`,borderRadius:4,fontSize:11,textAlign:"center",fontFamily:mono}}
                   title="Credit cost % for this grade"/>
                :<span style={{fontFamily:mono,color:C.slateL,fontSize:11}}>{(row.interest??1.5).toFixed(2)}%</span>}
            </td>
            <td style={{padding:"4px 8px",textAlign:"center"}}>{fld("disc",55,0.25)}</td>
            <td style={{padding:"4px 8px",textAlign:"center"}}>{fld("freight",52,0.25)}</td>
            <td style={{padding:"4px 8px",textAlign:"center",fontWeight:700,color:C.green,fontFamily:mono,fontSize:12}}
              title={`${row.price} + credit(${row.interest??1.5}%)${(row.price*gCreditPct).toFixed(2)} - disc${row.disc||0} + fr${row.freight||0}`}>
              {eff}</td>
            {role==="admin"&&<td style={{padding:"3px 4px",textAlign:"center"}}>
              <button onClick={()=>{
                // Fix 6: count constructions using this grade before deleting
                const usedIn=constructionLib.filter(c=>
                  Object.values(c.layers||{}).some(l=>l.code===row.code)).length;
                const msg=usedIn>0
                  ?`Delete grade [${row.code}]? It is used in ${usedIn} construction(s). Rows using it will show ₹0 material cost. This cannot be undone.`
                  :`Delete grade [${row.code}]? This cannot be undone.`;
                if(window.confirm(msg))setRates(prev=>prev.filter((_,j)=>j!==i));
              }}
                style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:15}}>×</button>
            </td>}
          </tr>;})}
        </tbody>
      </table>
    </div>
  );
  // ── FREIGHT RATES TAB ─────────────────────────────────────────────────────
  const freightTab=(
    <div style={{padding:20,overflowY:"auto",height:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:C.slate,marginBottom:2}}>Freight Rate Matrix</div>
          <div style={{fontSize:11,color:C.slateL}}>Rs/kg from plant to delivery location. 3 plants: Nagpur · Pune · Kolkata</div>
        </div>
        {role==="admin"
          ?<span style={{fontSize:11,color:C.green,fontWeight:600}}>⚙ Admin — add/edit/delete enabled</span>
          :<span style={{fontSize:11,color:C.slateL}}>Switch to Admin to edit</span>}
      </div>
      {role==="admin"&&<div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,
        padding:"10px 12px",background:C.cream,borderRadius:7,border:`1px solid ${C.border}`}}>
        <span style={{fontSize:11,fontWeight:600,color:C.slateM}}>Add Location:</span>
        <input value={newLocation} onChange={e=>setNewLocation(e.target.value)}
          placeholder="e.g. Surat" style={{padding:"5px 9px",borderRadius:5,
            border:`1px solid ${C.border}`,fontSize:12,width:140}}/>
        <Btn ch="+ Add Row" v="success" sm disabled={!newLocation||locations.includes(newLocation)}
          onClick={()=>{
            setLocations(prev=>[...prev,newLocation]);
            setFreight(prev=>{const nf={...prev};
              PLANTS.forEach(p=>{nf[p]={...(nf[p]||{}),[newLocation]:0};});return nf;});
            setNewLocation("");}}/>
        <span style={{fontSize:10,color:C.slateL}}>Click cell to edit rates. × to delete a row.</span>
      </div>}
      <table style={{borderCollapse:"collapse",fontSize:12}}>
        <thead><tr>
          <th style={{padding:"7px 14px",background:C.slateM,color:C.white,textAlign:"left",
            fontSize:10,fontWeight:600,minWidth:140}}>Delivery ↓ / Plant →</th>
          {PLANTS.map(p=><th key={p} style={{padding:"7px 14px",background:C.amber,color:C.white,
            fontSize:10,fontWeight:600,minWidth:96,textAlign:"center"}}>{p}</th>)}
          {role==="admin"&&<th style={{padding:"7px 8px",background:C.slateM,color:"transparent",
            fontSize:10,width:30}}> </th>}
        </tr></thead>
        <tbody>{locations.map((loc,li)=>(
          <tr key={loc} style={{background:li%2?C.cream:C.white}}>
            <td style={{padding:"5px 14px",fontWeight:600,color:C.slateM}}>{loc}</td>
            {PLANTS.map(plant=>(
              <td key={plant} style={{padding:"3px 8px",textAlign:"center"}}>
                {role==="admin"
                  ?<input type="number" step="0.5" value={freight[plant]?.[loc]??0}
                     onChange={e=>setFreight(prev=>({...prev,[plant]:{...(prev[plant]||{}),[loc]:+e.target.value}}))}
                     style={{width:68,padding:"3px 6px",border:`1px solid ${C.border}`,borderRadius:4,
                       fontSize:12,textAlign:"center",fontFamily:mono}}/>
                  :<span style={{fontFamily:mono,color:C.slateM,fontSize:12}}>{freight[plant]?.[loc]??0}</span>}
              </td>))}
            {role==="admin"&&<td style={{padding:"3px 4px",textAlign:"center"}}>
              <button onClick={()=>{
                  setLocations(prev=>prev.filter(l=>l!==loc));
                  setFreight(prev=>{const nf={...prev};
                    PLANTS.forEach(p=>{const pl={...(nf[p]||{})};delete pl[loc];nf[p]=pl;});return nf;});}}
                style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:16,lineHeight:1}}>×</button>
            </td>}
          </tr>))}
        </tbody>
      </table>
      {role!=="admin"&&<div style={{marginTop:10,fontSize:11,color:C.amberD,
        padding:"7px 10px",background:"#FFF8ED",borderRadius:6}}>
        Switch to Admin role to add, edit or delete locations.</div>}
    </div>
  );


  // ── MAIN RENDER ───────────────────────────────────────────────────────────
  return(
    <>
    {autosaveBanner&&(
      <div style={{position:"fixed",top:0,left:0,right:0,zIndex:10000,
        background:C.amberD,color:C.white,padding:"8px 16px",
        display:"flex",alignItems:"center",gap:10,fontSize:12,fontWeight:600}}>
        <span>🕐 Unsaved batch work found from {autosaveBanner.label} ({autosaveBanner.rows} row{autosaveBanner.rows!==1?"s":""}). Restore it?</span>
        <button onClick={restoreAutosave}
          style={{padding:"3px 12px",borderRadius:4,border:"none",background:C.white,
            color:C.amberD,fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:sans}}>Restore</button>
        <button onClick={()=>setAutosaveBanner(null)}
          style={{padding:"3px 10px",borderRadius:4,border:"1px solid rgba(255,255,255,.4)",
            background:"transparent",color:C.white,fontSize:11,cursor:"pointer",fontFamily:sans}}>Dismiss</button>
      </div>)}
    <div style={{display:"flex",flexDirection:"row",height:"100vh",width:"100%",overflow:"hidden",
      background:C.cream,fontFamily:sans}}>
      {sidebar}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        {topBar}
        <div style={{flex:1,overflow:"hidden",position:"relative"}}>
          {tab==="costing"&&(
            <div style={{display:"grid",gridTemplateColumns:"380px 1fr",height:"100%",overflow:"hidden"}}>
              <div style={{borderRight:`1px solid ${C.border}`,overflow:"hidden",
                display:"flex",flexDirection:"column"}}>{specForm}</div>
              <div style={{overflow:"hidden",display:"flex",flexDirection:"column"}}>{outputPanel}</div>
            </div>)}
          {tab==="items"&&itemsTab}
          {tab==="batch"&&batchEntryTab}
          {tab==="constrlib"&&constructionLibTab}
          {tab==="rates"&&rateTab}
          {tab==="defaults"&&defaultsTab}
          {tab==="freight"&&freightTab}
          {tab==="users"&&role==="admin"&&<UserManagementTab showToast={showToast}/>}
        </div>
      </div>
    </div>
    {toasts.length>0&&<div style={{position:"fixed",top:68,right:20,zIndex:9999,display:"flex",flexDirection:"column",gap:7,pointerEvents:"none"}}>{toasts.map(t=>(<div key={t.id} style={{padding:"10px 18px",borderRadius:8,fontSize:12,fontWeight:700,color:"white",boxShadow:"0 4px 18px rgba(0,0,0,.2)",maxWidth:300,background:t.type==="success"?C.green:t.type==="error"?C.red:C.amberD}}>{t.msg}</div>))}</div>}
    {showProfile&&<ProfileModal onClose={()=>setShowProfile(false)} showToast={showToast}/>}
    {showChangePassword&&<ChangePasswordModal onClose={()=>setShowChangePassword(false)} showToast={showToast}/>}
  </>
  );
}
