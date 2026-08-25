// ═══════════════════════════════════════════════════════════════════════════
// src/lib/persist.js — the single seam for app-data persistence.
//
// Every read and write of a `cbb_*` / `qgos_*` key goes through here. Before
// this file those calls were spread across 37 sites in 8 files, which meant a
// backend migration had to find and edit all 37.
//
// SCOPE
//   IN : the app's own data - cbb_rates, cbb_freight, cbb_sectors, cbb_boxtrim,
//        cbb_partitions, cbb_constrlib, cbb_locations, cbb_rate_date,
//        cbb_batchprofile, cbb_quoteitems, cbb_batch_autosave, cbb_template,
//        cbb_pinned_addons, qgos_sidebar_collapsed.
//   OUT: the Supabase auth session. That lives in its own key and is handled
//        by lib/apiClient.js on purpose - it is not part of the cbb_* data
//        model and must not be routed through here.
//
// DELIBERATELY A THIN SHIM, NOT AN ABSTRACTION
// These mirror the localStorage API one-for-one and stay synchronous, so
// adopting them was a pure mechanical substitution with no behaviour change.
// That is the right shape for a refactor whose only evidence of correctness is
// that nothing moved.
//
// WHAT A SUPABASE SWAP ACTUALLY NEEDS - read before assuming this file is
// enough. Supabase is async and localStorage is not, so pointing these three
// functions at the network is not sufficient: every caller would have to
// become async too, and several are useState initialisers, which cannot be.
// The realistic path is hydrate-on-mount into state plus write-through from
// here. This file makes that change local to one module and one call graph; it
// does not make it free.
//
// Errors are swallowed and reported as null/false, matching what the original
// call sites did - each was already wrapped in try/catch, because Safari
// private mode and disabled-storage settings make every access throwable.
// ═══════════════════════════════════════════════════════════════════════════

export function getItem(key){
  try{ return localStorage.getItem(key); }
  catch{ return null; }
}

export function setItem(key,value){
  try{ localStorage.setItem(key,value); return true; }
  catch{ return false; }
}

export function removeItem(key){
  try{ localStorage.removeItem(key); return true; }
  catch{ return false; }
}
