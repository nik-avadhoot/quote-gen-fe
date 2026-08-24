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
import { useEffect } from "react";

export function useBatchInvalidation(st){
  const { batchProfile, constructionLib, freight, invalidateAllBatchResults, rates } = st;

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
  useEffect(()=>{invalidateAllBatchResults();},[rates,freight,constructionLib]);
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

}
