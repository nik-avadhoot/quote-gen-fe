// ═══════════════════════════════════════════════════════════════════════════
// src/lib/overrideDivergence.js — D-28. THE ONE PLACE OVERRIDE DIVERGENCE IS DECIDED.
//
// The workbook holds ONE slot per parameter per export group:
//   interest, freight        → one slot for the WHOLE QUOTE
//   waste%,  conv Rs/kg      → one slot for Box rows, one for PP rows
//
// So a row-level override survives export only if every row in its group agrees
// with it. THE DANGEROUS STATE IS DIVERGENCE, NOT OVERRIDE: if every PP row
// carries 4%, the export is correct and a warning would be noise — and a warning
// that fires when nothing is wrong is ignored within a week.
//
// ⚠️ TWO CALLERS, ONE RULE — DO NOT INLINE A SECOND COPY.
// BatchGrid compares batchRows against profile defaults, at the moment the value
// is typed. QuoteItemsTab compares the resolved item specs, at the moment the
// export is about to happen. Different inputs, different moments, SAME RULE.
//
// Two implementations of one comparison is precisely how D-7 (eight sites, three
// conventions) and D-27 (excel.js and server.py answering differently) happened.
// The adapters are each caller's business; the comparison is not.
//
// Pure: no React, no imports.
// ═══════════════════════════════════════════════════════════════════════════

// ── THE RULE: A ROW IS FLAGGED IFF ITS GROUP DIVERGES **AND** ITS VALUE ≠ THE
// ── GROUP'S BASELINE. Both halves are required and each rejects a real case.
//
// Group-diverges alone marks every row in the group, including ones sitting on
// the profile default that the Maker never touched. Five PP rows where two were
// changed would light up all five.
//
// Differs-from-baseline alone marks rows when nothing is wrong: three PP rows all
// overridden to 4% AGREE with each other, export correctly as 4%, and lose
// nothing — but all three differ from a default of 5%.
//
// Within a group every untouched row inherits the SAME baseline, so a diverging
// group always contains at least one row that differs from it. There is no case
// where a group diverges and nothing is marked.
//
// ⚠️ THE MARKED ROW IS NOT NECESSARILY THE ROW THAT LOSES. The export reads the
// FIRST row of each group, so if the odd row happens to be first it is the one
// that survives and the conforming rows are dropped. Which row loses depends on
// item order and — per D-18 limitation 3, where items[0] may not even be a Box
// row — is not reliably knowable here. This marks THE ROW THE MAKER CHANGED,
// which is deterministic and explicable. The warning text is deliberately worded
// to match: it never claims which value survives.
//
// Entries are { label, group, value, baseline }:
//   label    — what the caller shows the user for this row (e.g. "2" or "Row 2")
//   group    — the export slot this row competes for ("" when the whole quote is one slot)
//   value    — the EFFECTIVE value: the override if set, otherwise the inherited default.
//              Callers resolve inheritance; this module never guesses at a default.
//   baseline — the group's inherited default, so the odd-ones-out can be identified.
//              Callers resolve this too; omitting it falls back to marking the
//              whole group, which is the pre-fix behaviour and is NOT what you want.
//
// Returns [] when nothing diverges, else one entry per diverging group:
//   { group, values: [distinct, sorted], labels: [ONLY the rows that differ from baseline] }
export const findDivergence=(entries)=>{
  const groups=new Map();
  for(const e of entries){
    if(e.value===""||e.value==null)continue;   // unresolvable — the caller could not
    const g=e.group??"";                       // determine an effective value; skip it
    if(!groups.has(g))groups.set(g,[]);
    groups.get(g).push(e);
  }
  const out=[];
  for(const [group,list] of groups){
    // Compare NUMERICALLY. "4" and 4 are the same rate; a string/number split
    // across two rows must not read as disagreement.
    const distinct=[...new Set(list.map(e=>+e.value))].sort((a,b)=>a-b);
    if(distinct.length>1)out.push({group,values:distinct,
      // The ODD ONES OUT, not every member of the group. A row sitting on the
      // baseline was not changed by anyone and must not be marked.
      labels:list.filter(e=>e.baseline==null||+e.value!==+e.baseline).map(e=>e.label)});
  }
  return out;
};

// THE FIELD-LEVEL FLAG — both halves of the rule, for one row.
// `group` is "" when the whole quote shares one slot. Pass the row's own effective
// value and its group's baseline; a row on the baseline is never marked.
export const isDiverged=(result,group,value,baseline)=>{
  const d=result.find(x=>x.group===(group??""));
  if(!d)return false;                                   // the group agrees
  if(value===""||value==null)return false;              // unresolvable
  if(baseline===""||baseline==null)return true;         // no baseline to compare against
  return +value!==+baseline;                            // the row the Maker changed
};
