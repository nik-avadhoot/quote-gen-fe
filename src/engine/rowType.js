// ═══════════════════════════════════════════════════════════════════════════
// src/engine/rowType.js — neutral row-type helpers.
//
// Split out of QuotationApp.jsx (Phase 3). These are imported by BOTH the
// export modules and the App itself (calcBatchRow, sendCostingToBatch,
// sendAllToQuoteItems, pushCostingToBatchRow, getBatchRowStatus,
// loadBatchRowIntoCosting), so they live in engine/ rather than export/.
//
// Pure: no React, no imports.
// ═══════════════════════════════════════════════════════════════════════════

// ── D-7: THE ONE PLACE SET CODES ARE COMPARED ────────────────────────────────
// Before this there were EIGHT comparison sites across six files using THREE
// conventions: .trim().toUpperCase(), .trim() alone, and raw === with no trim.
// A SET created in the grid as "Glass180" could never be matched by a row sent
// from Costing, which stores "GLASS180" — Costing's input uppercases, the grid's
// does not, and the grid's parent predicates compared case-sensitively.
//
// The defect was never any single comparison. It was that there were several,
// and nothing kept them aligned. Four comparisons can drift; one cannot.
//
// ⚠️ DO NOT compare setCode with === anywhere else. scripts/audit-setcode.py
// fails the build-adjacent gate if you do. Two sites are deliberately excluded
// and the script names why for each — an exception without its reason recorded
// is indistinguishable from a bug, and copying it is how the next drift starts.
//
// EMPTY MATCHES EMPTY, exactly as the previous code did. sameSetCode("","") is
// TRUE. That is preserved deliberately: this change alters CASE SENSITIVITY and
// nothing else. Two of the four call sites have no empty-guard of their own, so
// two rows with blank SET Codes match each other today — see the D-7 note in the
// register. Whether they should is a separate ruling, not smuggled in here.
export const normSetCode=v=>(v||"").trim().toUpperCase();
export const sameSetCode=(a,b)=>normSetCode(a)===normSetCode(b);

// R-1: single authoritative add-ons injection — replaces three identical inline blocks.
// buildSpecFromRow (costing.js) does not accept row.addOns; callers must inject them.
// Extracting here means a new add-on field is added in exactly one place.
export const applyAddOns=(sp,row)=>{
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
export const isPPType=(itemType)=>
  itemType==="Plate"||itemType==="Part-L"||itemType==="Part-W";
