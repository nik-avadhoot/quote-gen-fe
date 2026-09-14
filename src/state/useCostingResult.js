// ═══════════════════════════════════════════════════════════════════════════
// src/state/useCostingResult.js
//
// Derived costing output for the Costing tab.
//
// Resolves blank waste/conv against the effective authority (batch profile
// when a batch exists, else the sector master) and runs calcCosting.
//
// MUST be composed BEFORE useCostingBatchBridge and useQuoteActions: both
// consume resolveSpecWasteConv from here.
//
// MEMOISATION (Phase 5)
// calcCosting and the diagnostics run inside a useMemo. resolveSpecWasteConv
// is deliberately left OUTSIDE it: it is a trivial object-returning arrow, so
// memoising buys nothing, and it is the one value here that is a CLOSURE
// rather than data. The bridge calls it at send time
// (useCostingBatchBridge.js:166 and :481), so a stale copy would write
// waste/conv from an old spec into the batch row - with Final Rate still
// correct on screen, because the panel renders `r`, not the resolver.
// Rebuilding it every render makes that failure impossible by construction.
//
// Extracted verbatim from QuotationApp.jsx (Phase 4). The bodies below are
// byte-identical to the monolith; only the surrounding closure changed.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo } from "react";
import { calcCostingOutcome, checkMissingInfo, checkSpecCompliance, estimateOverspecSaving, suggestMargin } from "../engine/costing.js";
import { resolveField } from "../engine/resolveAuthority.js";
import { materializeEffectiveRates } from "../engine/rateMaster.js";
import { isFeatureEnabled } from "../lib/featureFlags.js";
import { isPPType } from "../engine/rowType.js";
import { constructionLayerIssues, requiredConstructionLayers } from "../lib/constructionIdentity.js";

export function useCostingResult(st){
  const { batchDefaults, boxTrim, freight, rates, sectors, spec } = st;

  // wastePP/convRatePP: "" in spec means "no override — inherit sector default",
  // resolved fresh here (not baked into spec) so it stays live if sector changes.
  // An explicit 0 (or any other typed number) is NOT blank and passes through as-is
  // — this is what lets a genuine 0% override actually take effect.
  // Primitives pulled out so the memo depends on VALUES, not on object identity.
  // batchProfile is replaced on every profile-bar keystroke and batchRows on every
  // grid edit; depending on either object would bust the memo constantly. Only
  // these five scalars actually feed the computation.
  // C5: batchDefaults is the ONE resolved source of batch-level defaults -
  // the live profile when attached to a batch or reviewing a row, the draft
  // profile while a new batch is being prepared, and null when neither applies
  // (the sector master is then the only authority, exactly as before C5).
  const _hasBD=batchDefaults!==null&&batchDefaults!==undefined;
  const{waste:bdWaste,convRate:bdConvRate,wastePP:bdWastePP,convRatePP:bdConvRatePP}=batchDefaults||{};

  const _derived=useMemo(()=>{
    // wastePP/convRatePP: "" in spec means "no override — inherit sector default",
    // resolved fresh here (not baked into spec) so it stays live if sector changes.
    // An explicit 0 (or any other typed number) is NOT blank and passes through as-is
    // — this is what lets a genuine 0% override actually take effect.
    const _sectorForCalc=sectors.find(x=>x.code===spec.sector);
    // When a batch exists, the Batch Profile is the committed context for waste/conv defaults.
    // When the batch is empty, the sector master is the only authority.
    // This ensures Costing's display and Calculate All use the same effective value.
    const _hasCommittedBatch=_hasBD; // C5: batchDefaults!==null. Same meaning, one source
    // S7. The four lines that used to sit here spelled out the chain by hand -
    // batch ?? sector ?? literal - and Batch Entry spelled out a DIFFERENT one,
    // with no Sector tier at all. Both now call the one resolver, which is the
    // whole point of the slice: the number on this screen and the number the
    // CalcGate freezes at Send can no longer disagree.
    //
    // C5's distinction is preserved exactly: with no committed Batch there is no
    // Batch tier to consult, so an empty profile is passed and the Sector becomes
    // the first tier that can answer.
    const _bp=_hasCommittedBatch?{waste:bdWaste,convRate:bdConvRate,
      wastePP:bdWastePP,convRatePP:bdConvRatePP}:{};
    const _inh=(field,isPP)=>resolveField(field,
      {rowOverride:'',batchProfile:_bp,sector:_sectorForCalc,isPP}).value;
    const _wasteDefBox =_inh('waste',false);
    const _convDefBox  =_inh('convRate',false);
    const _wasteDefPP  =_inh('waste',true);
    const _convDefPP   =_inh('convRate',true);

    const _calcSpec=(spec.wastePP===""||spec.wastePP==null||spec.convRatePP===""||spec.convRatePP==null
                   ||spec.waste===""||spec.waste==null||spec.convRate===""||spec.convRate==null)
      ?{...spec,
         waste:(spec.waste===""||spec.waste==null)?_wasteDefBox:spec.waste,
         convRate:(spec.convRate===""||spec.convRate==null)?_convDefBox:spec.convRate,
         wastePP:(spec.wastePP===""||spec.wastePP==null)?_wasteDefPP:spec.wastePP,
         convRatePP:(spec.convRatePP===""||spec.convRatePP==null)?_convDefPP:spec.convRatePP,
        }:spec;
    // S8(a). THE application boundary for freight: the flag is read here and
    // injected, so the engine never imports Vite environment state and stays
    // importable into plain Node for the goldens. The wrapper is destructured
    // on the line it is created - it never enters state and nothing downstream
    // can mistake it for a result.
    //
    // Pre-U4 there is no Pricing Group and no governed Freight Master reachable
    // from the app, so `opts` carries only the flag: the chain falls through to
    // the temporary legacy matrix and prices exactly as it does today, while
    // SAYING that it is temporary rather than claiming approved authority.
    const _effectiveRates=materializeEffectiveRates(rates);
    const {result,freightResolution}=calcCostingOutcome(_calcSpec,_effectiveRates,freight,boxTrim,
      {authorityV2:isFeatureEnabled("freight_authority_v2")});
    const r=result;
    // Same object the calculation used. checkMissingInfo does not recompute
    // freight; with the flag off it receives null and keeps its pre-S8 line.
    const missing=checkMissingInfo(spec,r,freightResolution);
    const compliance=checkSpecCompliance(spec,r);
    const marginSugg=suggestMargin(spec,r?.calcMOQ);
    const osSaving=r&&compliance.find(c=>c.type==="over"&&c.field.includes("Burst"))
      ?estimateOverspecSaving(spec,r,_effectiveRates):null;
    return{_sectorForCalc,_hasCommittedBatch,_wasteDefBox,_convDefBox,_wasteDefPP,_convDefPP,
      _calcSpec,result,r,missing,compliance,marginSugg,osSaving,freightResolution};
  },[spec,sectors,rates,freight,boxTrim,_hasBD,
     bdWaste,bdConvRate,bdWastePP,bdConvRatePP]);

  const{_sectorForCalc,_hasCommittedBatch,_wasteDefBox,_convDefBox,_wasteDefPP,_convDefPP,
    _calcSpec,result,r,missing,compliance,marginSugg,osSaving,freightResolution}=_derived;

  // A1: single resolver — same blank→authority logic as _calcSpec above.
  // isWasteBlank/isConvBlank preserved so delta computation never writes 0 overrides.
  // NOT memoised, on purpose — see the header note.
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

  // ── Send-to-Batch readiness (hoisted so both panels share the same computation) ──
  const _sendLayers=spec.layers||{};
  const _sendBType=spec.boxType||"RSC";
  const _sendRType=spec.rowType||"Box";
  const _sendIsFlatSheet=_sendBType==="PP"||_sendBType==="Board"||_sendBType==="Custom"||
    isPPType(_sendRType);
  const _sendMissingDims=(!spec.L||+spec.L<=0)||(!spec.W||+spec.W<=0)||
    (!_sendIsFlatSheet&&(!spec.H||+spec.H<=0));
  const _sendReqLayers=requiredConstructionLayers(spec);
  const _sendLayerNames={TOP:"TOP liner",F1:"F1 flute",L1:"L1 liner",F2:"F2 flute",L2:"L2 liner"};
  const _sendLayerIssues=constructionLayerIssues(spec);
  const _sendMissingLayers=[...new Set(_sendLayerIssues.map(issue=>issue.key))];
  const _sendReady=!_sendMissingDims&&_sendLayerIssues.length===0;


  return { _calcSpec, _convDefBox, _convDefPP, _hasCommittedBatch, _sectorForCalc, _sendBType, _sendIsFlatSheet, _sendLayerIssues, _sendLayerNames, _sendLayers, _sendMissingDims, _sendMissingLayers, _sendRType, _sendReady, _sendReqLayers, _wasteDefBox, _wasteDefPP, compliance, freightResolution, marginSugg, missing, osSaving, r, resolveSpecWasteConv, result };
}
