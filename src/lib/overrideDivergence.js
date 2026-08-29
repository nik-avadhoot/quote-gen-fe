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

// Entries are { label, group, value }:
//   label — what the caller shows the user for this row (e.g. "2" or "Row 2")
//   group — the export slot this row competes for ("" when the whole quote is one slot)
//   value — the EFFECTIVE value: the override if set, otherwise the inherited default.
//           Callers resolve inheritance; this module never guesses at a default.
//
// Returns [] when nothing diverges, else one entry per diverging group:
//   { group, values: [distinct, sorted], labels: [rows in that group] }
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
    if(distinct.length>1)out.push({group,values:distinct,labels:list.map(e=>e.label)});
  }
  return out;
};

// True when ANY group for this parameter diverges — the field-level flag.
export const hasDivergence=(result,group)=>
  group==null?result.length>0:result.some(d=>d.group===group);
