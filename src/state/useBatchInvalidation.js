// ═══════════════════════════════════════════════════════════════════════════
// src/state/useBatchInvalidation.js
//
// Staleness invalidation effects.
//
// Deliberately separate. These effects call invalidateAllBatchResults (owned
// by useBatchState) and depend on masters (rates/freight/constructionLib) AND
// batch (batchProfile fields), so they straddle both slices and must run
// AFTER both. In the monolith this was a use-before-declare that only worked
// because effects run after render - ESLint flagged it as
// react-hooks/immutability "Cannot access variable before it is declared".
//
// Extracted verbatim from QuotationApp.jsx (Phase 4). The bodies below are
// byte-identical to the monolith; only the surrounding closure changed.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef } from "react";

export function useBatchInvalidation(st){
  const { batchProfile, batchResults, constructionLib, freight, invalidateAllBatchResults, rates, showToast } = st;

  // ── D-8e: SAY WHAT THE EDIT JUST DESTROYED ─────────────────────────────────
  // Both effects below wipe EVERY cached batch result. Until now that happened
  // in silence: a Maker edits one paper rate, and a batch costed an hour ago
  // is quietly no longer costed. Nothing on screen said so, and the rows look
  // the same until Send All skips them for having no result.
  //
  // That invisibility is D-8's worst property. This does not fix the unguarded
  // write model (D-8a, deferred to PM-1) — it makes the damage VISIBLE at the
  // moment it occurs, which is the cheapest thing that changes the outcome.
  //
  // SILENT WHEN NOTHING WAS LOST. n===0 means there was nothing cached to
  // invalidate, so there is nothing to report — same principle as D-28's
  // divergence gate. A warning that fires when nothing is wrong gets ignored,
  // and this also covers mount, where batchResults is {} and no first-run
  // guard is needed.
  //
  // DEDUPE ON OBJECT IDENTITY, NOT A TIMER. A change can touch masters AND a
  // profile field in one commit — a backup restore does exactly that — and
  // both effects would then read the SAME batchResults object and toast twice.
  // Comparing the reference suppresses the second. After a wipe the object is
  // a new {}, so the next genuine invalidation warns again.
  const _warnedFor=useRef(null);
  const warn=(what)=>{
    const n=Object.keys(batchResults).length;
    if(n===0)return;
    if(_warnedFor.current===batchResults)return;
    _warnedFor.current=batchResults;
    // Naming the CAUSE matters: "N rows cleared" alone leaves the Maker
    // guessing which of several edits did it.
    //
    // "CLEARED", NOT "INVALIDATED" — see D-32. The effect watches the whole
    // rates/freight/constructionLib arrays by reference and cannot know which
    // rows use what, so it fires on edits that could not have changed a single
    // number. "Invalidated" would assert the results were WRONG; usually they
    // were not, they were merely discarded. This states what happened without
    // claiming why, which is all the app can honestly support until
    // invalidation is narrowed to the rows that reference the changed master.
    showToast(`\u26A0 ${what} — ${n} calculated row${n===1?"":"s"} cleared. Re-run Calculate All.`,'info',6000);
  };

  // NOTE: invalidateAllBatchResults is deliberately NOT in either dep array.
  // It is recreated every render (`()=>setBatchResults({})`), so including it
  // would fire the effect on EVERY render and wipe every cached batch result
  // continuously. The dep arrays encode the INTENT - invalidate when masters
  // or costing-relevant profile fields change - not the closure's identity.
  //
  // These directives read as dead in the monolith (ESLint reported them unused)
  // only because the function was declared AFTER these effects and the rule
  // bailed out on the TDZ. Once that ordering is fixed the rule fires for real,
  // so the suppressions are load-bearing here, not leftovers.
  // Fix 1: Invalidate ALL batch results when masters change — rates, freight, or constructions
  // affect every row. constructionLib is watched because paper layer edits change per-row costs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{warn("Master data changed");invalidateAllBatchResults();},[rates,freight,constructionLib]);
  // ── FIX 1: Profile-level staleness — invalidate ALL results when any costing-relevant
  // profile field changes (margin, waste, conv, sector, interest, freight, plant, delivery).
  // Non-costing profile fields (client, customerType, priceContext, paymentDisc display) are excluded.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{warn("Batch profile changed");invalidateAllBatchResults();},[
    batchProfile.margin,batchProfile.marginPP,
    batchProfile.waste,batchProfile.convRate,
    batchProfile.wastePP,batchProfile.convRatePP,
    batchProfile.sector,batchProfile.interest,
    batchProfile.freightOverride,batchProfile.plant,batchProfile.delivery,
  ]);

}
