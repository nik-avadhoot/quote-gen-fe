// ═══════════════════════════════════════════════════════════════════════════
// src/export/excel.js — Excel export.
//
// Split out of QuotationApp.jsx (Phase 3). Pure functions: they take
// (items, rates, freight, …) and never touch React state.
//
// exportFromTemplate is the live path — it POSTs to the Python/openpyxl
// backend, then falls back to a client-side xlsx-js-style clone of the
// master template.
//
// ⚠️ BUG (pre-existing, carried over unchanged by deliberate decision):
// exportExcelFull references two identifiers that are not defined anywhere -
// `qty` (twice, in the item row map) and `locations` (in the freight matrix).
// It therefore throws ReferenceError on EVERY call, and it is reachable: it is
// the fallback when no template is stored, or when the stored template has no
// CBB+PP sheet. This means the client-side Excel fallback that covers Vercel's
// 10s function cap does not currently work. Fix separately - not part of the
// component split.
//
// ⚠️ Do NOT run Prettier or `eslint --fix` reflow over this file. One line in
// exportFromTemplate ends its statement INSIDE a trailing comment and relies
// on automatic semicolon insertion:
//     const _ppItem=items.find(i=>isPPType(i.spec.rowType)) // R-2;
// ═══════════════════════════════════════════════════════════════════════════
import * as XLSX from "xlsx-js-style";
import { CREDIT_PCT, TAKEUP, TRIM, PLANTS, LOCATIONS } from "../data/defaults.js";
import { getTrimD } from "../engine/costing.js";
import { applyAddOns, isPPType } from "../engine/rowType.js";
import { apiFetch } from "../lib/apiClient.js";
import { getItem } from "../lib/persist.js";

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
        // D-19: this row emitted two further values — `qty` and `finalRate*qty` — but
        // `qty` was never defined, because no order-quantity field exists anywhere in
        // the data model (qtyPerSet is nos-per-set, a different quantity). The header
        // above declares 10 columns; this row was written for 12. It was a schema that
        // was never built, not a typo. Dropped to match the header rather than invent
        // the field; the product question is recorded in docs/defect-pass-plan.md §8.
        s.spec_bs||"—",s.spec_bct||"—",r.calcMOQ,r.finalRate];
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
  // D-19: `locations` was in scope while this code lived inside QuotationApp.jsx and
  // went undefined when Phase 3 extracted the file. Read the persisted master through
  // the seam — exportFromTemplate already reads cbb_template the same way below.
  // Falling back to the imported LOCATIONS constant alone was rejected: it would
  // silently discard a customised locations master.
  let _locations=null;
  try{
    const _l=getItem('cbb_locations');
    const _pl=_l?JSON.parse(_l):null;
    if(Array.isArray(_pl)&&_pl.length)_locations=_pl;
  }catch{_locations=null;} // malformed cbb_locations — fall back to LOCATIONS
  const defRows=[
    ["FREIGHT RATE MATRIX (Rs/kg)","","Nagpur","Pune","Kolkata"],
    ...(_locations||LOCATIONS).map(loc=>["",loc,...PLANTS.map(p=>freight[p]?.[loc]||0)]),
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
export const exportFromTemplate=async(items,rates,freight,templateB64Arg,meta={},onError)=>{
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
  if(!tmplB64){try{tmplB64=getItem('cbb_template');}catch(e){}}
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
  // D-18: the template models these as BOX vs PP — every data row computes
  // IF(B7="Box",$BJ$3,$BJ$4). TWO slots, not one. BJ4 was written with the BOX
  // row's interest, so the code narrowed the template's two slots to one value
  // and every PP row was costed at the Box row's rate.
  //
  // Same treatment AY4/BA4 already get from _ppSpec three lines above — that was
  // never a "partial patch" of a per-row problem, it was filling the second
  // supported slot. This does the same for interest.
  //
  // What remains is a TEMPLATE limitation, not a code one: per-ROW overrides
  // (interest, margin, waste, conv, freight) have nowhere to go, because the
  // workbook offers exactly two values per parameter. See D-18's entry.
  sc(ws_cbb,'BJ3',_nv(f0.interest,0.5)/100);                    // BJ3=Interest% decimal, Box rows
  sc(ws_cbb,'BJ4',_nv(_ppSpec.interest??f0.interest,0.5)/100);  // BJ4=PP rows' own interest
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
