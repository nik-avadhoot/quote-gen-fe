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
