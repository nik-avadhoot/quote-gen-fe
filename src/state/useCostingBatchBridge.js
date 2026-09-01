// ═══════════════════════════════════════════════════════════════════════════
// src/state/useCostingBatchBridge.js
//
// THE COSTING <-> BATCH BRIDGE - the most important business logic here.
//
// These five functions are kept together deliberately. They span three state
// slices (costing, batch, masters) and between them encode the invariants
// that stop one batch's data contaminating another:
//
//   * the two-context hard gate (same-batch vs new-batch)
//   * the G1 identity-first guards on client/sector/plant/delivery
//   * SET Code confirmation, which blocks auto-dims, Calculate All, Deep Dive
//     and Send-to-Quote-Items until the operator confirms
//   * override deltas computed against the profile, never absolute writes
//
// Splitting these across useCostingState / useBatchState / useQuoteActions is
// precisely how those guards get silently broken. Keep them together.
//
// Depends on resolveSpecWasteConv from useCostingResult - compose after it.
//
// Extracted verbatim from QuotationApp.jsx (Phase 4). The bodies below are
// byte-identical to the monolith; only the surrounding closure changed.
// ═══════════════════════════════════════════════════════════════════════════
import { INIT_SPEC } from "../data/defaults.js";
import { buildSpecFromRow } from "../engine/costing.js";
import { applyAddOns, isPPType } from "../engine/rowType.js";
import { findDuplicate } from "../lib/constructionIdentity.js";
import { getItem, setItem } from "../lib/persist.js";

export function useCostingBatchBridge(st){
  const { activeBatchRowId, autoCalcPPDims, batchDefaults, batchProfile, batchRows, constructionLib, draftDirty, exitReview, invalidateBatchRow, markDraftSent, markReviewPushed, openReview, profileDraft, resetDraft, resolveSpecWasteConv, reviewDirty, setAutoFill, setBatchProfile, setItems, setExpandedRows, setBatchResults, setBatchRows, setConstructionLib, setSetAutoFill, setTab, showToast, spec, specRaw } = st;

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
    // WAVE 3: the two row-override reads were here. Freight and Interest are
    // BATCH-level only now, so the review copy keeps what buildSpecFromRow
    // seeded from the profile - freightOverride:prof.freightOverride||"" and
    // interest:prof.interest??0.5 (engine/costing.js:205,209). Those two lines
    // are the CANONICAL Batch values and are deliberately untouched; only the
    // per-row override on top of them is gone.
    applyAddOns(sp,row); // R-1: single injection point
    // C4 · E4: replacing a review copy that has unpushed changes is the one
    // Deep Dive that can lose work. Opening a review from START cannot — the
    // draft is not read, written or discarded — so there is deliberately NO
    // prompt about START being dirty.
    if(reviewDirty&&activeBatchRowId!==row.id){
      const _cur=batchRows.findIndex(r=>r.id===activeBatchRowId);
      if(!window.confirm(
        `Discard unpushed changes to Batch Row ${_cur+1}?\n\n`+
        "Your Costing draft is untouched either way.\n\n"+
        "OK = discard and open this row  |  Cancel = stay in the current review"
      ))return;
    }
    // C4: builds the SESSION-ONLY review copy. The persisted START draft is not
    // touched. openReview captures START's workspace flags BEFORE the two
    // setters below overwrite them.
    openReview(row.id,sp);
    setSetAutoFill(row.setAutoFill??true); // restore stored setting; default true for legacy rows
    // C5: setCostingContext("same-batch") was here. REVIEW's context is derived
    // now - contextValues and batchDefaults both read the live profile whenever
    // a review copy is open, so there is no flag to set and none to restore.
    // C4 stopped clearing specCommitted here; C6 deleted the flag entirely.
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
  // C5: BLANK CONTEXT-ONLY FIELDS. client/sector/plant/delivery/customerType/
  // priceContext/paymentDisc are resolved from the one Context authority every
  // render, so seeding copies of them here would be the mirroring the model
  // forbids - and would hand the G1 guards a value nobody typed.
  const _blankContext={client:"",sector:"",plant:"",delivery:"",
    customerType:"",priceContext:"",paymentDisc:""};
  // SKU exceptions start life TRACKING the batch default, with CONCRETE Box/PP
  // waste and conversion - never blank. specFromProfile used to leave those four
  // blank; a blank presented as inherited is D-25's job, not this series'.
  const _skuFromDefaults=(explicit)=>{
    const bd=explicit||batchDefaults||{};
    // C7a: interest and freightOverride are NOT seeded. They resolve from the
    // Batch Context every render, so seeding a copy here would be the mirroring
    // the model forbids - and would hand a Costing-authored value to the engine.
    return {margin:bd.margin??8,
      waste:bd.waste??5,convRate:bd.convRate??7,
      wastePP:bd.wastePP??5,convRatePP:bd.convRatePP??12.5};
  };
  const specFromProfile=()=>({
    ...INIT_SPEC,
    ..._blankContext,
    ..._skuFromDefaults(),
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
  // C5: specForNewBatch is gone. New SKU is ONE seed in both modes, because the
  // batch context no longer lives in the spec - batchDefaults already points at
  // the draft profile while a new batch is being prepared.
  const specForNextSku=()=>({
    ...INIT_SPEC,
    ..._blankContext,
    ..._skuFromDefaults(),
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

  // ── C5 · DRAFT LIFECYCLE OPERATIONS ─────────────────────────────────────
  // Each confirms only when there is work that has not reached Batch Entry, then
  // lands a CLEAN result in one state update. The draft is saved continuously,
  // so the prompts never say "unsaved" - what is at stake is work that has not
  // been SENT.
  const _confirmDiscardWork=(msg)=>!draftDirty||window.confirm(msg);

  // A batch-context-only seed: no construction, no board specs, no identity.
  // specFromProfile() carries construction forward by design; X3 and B2 must not,
  // so they use this instead.
  const specContextOnly=(explicitDefaults)=>({
    ...INIT_SPEC, ..._blankContext, ..._skuFromDefaults(explicitDefaults)});

  // S1 - another SKU in the same batch (or the same new-batch draft).
  const startNewSku=()=>{
    if(!_confirmDiscardWork(
      "Start a new SKU?" + "\n\n" +
      "This Costing draft has work that has not been sent to Batch Entry. Identity, "+
      "product and dimensions are reset; construction and board specs carry forward." + "\n\n" +
      "OK = start the new SKU  |  Cancel = keep working"))return;
    resetDraft(specForNextSku(),profileDraft?profileDraft.values:null);
    setSetAutoFill(true);
  };

  // S2 / S3 - New Draft. The draft profile is seeded either from the live profile
  // (same client) or from the concrete defaults a fresh Batch Profile takes.
  const _newDraft=(values)=>{
    if(!_confirmDiscardWork(
      "Start a new draft?" + "\n\n" +
      "This Costing draft has work that has not been sent to Batch Entry, and it "+
      "will be discarded." + "\n\n" +
      "OK = discard it and start the new draft  |  Cancel = keep working"))return;
    resetDraft(specContextOnly(values),values);
    setSetAutoFill(true);
    showToast("✦ New draft started — the parked batch is untouched",'info',5000);
  };
  const newDraftKeepClient=()=>_newDraft({...batchProfile});
  const newDraftNewClient=()=>_newDraft({client:'',sector:'',plant:'',delivery:'',
    margin:8,marginPP:8,interest:0.5,paymentDisc:'30',freightOverride:'',
    waste:5,convRate:7,wastePP:5,convRatePP:12.5,
    customerType:'existing',priceContext:'unknown'});

  // X3 - discard the new-batch draft and return to a clean START on the live
  // batch. Carries NONE of the abandoned draft: not its identity, dimensions,
  // construction or board specifications.
  const discardNewDraft=()=>{
    if(profileDraft===null)return;
    if(!_confirmDiscardWork(
      "Discard this new-batch draft?" + "\n\n" +
      "Its client, sector, dimensions, construction and board specs are all lost. "+
      "You return to a clean START on the current batch." + "\n\n" +
      "OK = discard  |  Cancel = keep the draft"))return;
    resetDraft(specContextOnly(batchProfile),null);
    setSetAutoFill(true);
    showToast("↩ Returned to the current batch",'info',4000);
  };

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

    // ── D-16: do NOT materialise derived dims back into the row ───────────────
    // loadBatchRowIntoCosting reads the row through autoCalcPPDims (:40), so a
    // Plate/Partition row whose L/W are BLANK arrives in Costing carrying the
    // values derived from its parent Box. Writing those straight back turns a
    // field that was blank by design into a concrete number: autoCalcPPDims then
    // returns early forever (needsL/needsW false), isAutoDim at BatchGrid.jsx:388
    // flips false, and the row SILENTLY STOPS TRACKING ITS PARENT. Change the Box
    // afterwards and the Part no longer follows. Invisible when it happens,
    // because the number written is identical to the one displayed.
    //
    // Same delta shape as wasteOverride above, and the same 0.001 tolerance:
    // write only what the Maker actually CHANGED. Both directions resolve through
    // autoCalcPPDims, so there is one derivation, not two that can disagree.
    // Blank L/W FIRST. autoCalcPPDims returns the row untouched when both dims are
    // already filled (useBatchState.js:168), so passing `row` as-is made _derivedDims
    // EQUAL to `cur` for exactly the rows this guard protects: the delta was always
    // zero and every explicit dim was rewritten to "". Deriving from a blanked copy
    // asks the real question - "what WOULD this row inherit?" - which is the only
    // value `cur` can meaningfully be compared against. The spread keeps row.id, so
    // the parent lookup still resolves.
    const _derivedDims=autoCalcPPDims({...row,L:"",W:""});
    const _dimBack=k=>{
      const cur=spec[k];
      if(cur===""||cur==null)return"";              // nothing typed — stay inherited
      if(row.itemType==="Box")return cur;           // Box rows never auto-derive
      const d=_derivedDims[k];
      // No parent to derive from: write the value. Deliberately asymmetric —
      // writing a number that may be redundant is recoverable; dropping one the
      // Maker can see on screen is not.
      if(d===""||d==null)return cur;
      return Math.abs(+cur-+d)<0.001?"":cur;        // unchanged — leave it inheriting
    };

    const rowPatch={
      // H and ups are untouched: autoCalcPPDims derives only L and W.
      L:_dimBack("L"),W:_dimBack("W"),H:spec.H||"",ups:spec.ups||1,
      // G5: SKU/Product is editable in REVIEW and must be pushed back so the grid reflects the correction
      product:spec.product||"",
      // B1: nosPerSet was missing — a Maker correcting partition count in deep-dive lost it on Calculate All
      nosPerSet:spec.qtyPerSet||row.nosPerSet,
      // D-1: Costing names this skuType, the grid names it glassSKUType. Same bug shape as B1 —
      // fixing only the send path would leave Deep-Dive→Push lossy. Known limitation, accepted:
      // ||row.glassSKUType means CLEARING the Glass SKU in Costing does not clear it on push.
      // Consistent with B1, but sharper here because Part rows have no editable Glass SKU control
      // in the grid — a wrong value is corrected by pushing a different one, never by clearing.
      glassSKUType:spec.skuType||row.glassSKUType,
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
      // C7a: interestOverride and freightRowOverride are NOT in this patch.
      // OMISSION IS THE MECHANISM. The row is written as {...r,...rowPatch}
      // below, so a key that is absent here is left exactly as the row holds it
      // - an existing Batch Entry override survives a Push byte-for-byte,
      // including the "" that means "no override". Writing them as "" would
      // DELETE a Maker's row override from Costing, which is precisely what this
      // commit removes the authority to do.
    };
    // ── C4 · WHICH SPEC FIELDS THE ROW NOW ACTUALLY CARRIES ─────────────────
    // Derived from the rowPatch just built, NOT from a parallel field list that
    // could drift away from it. The test is uniform for every fallback-style
    // write: the persisted value IS the spec value unless a fallback fired.
    // A field missing from this list keeps its old baseline, so an edit that
    // did not reach Batch Entry stays dirty and exiting still warns.
    const _pushed=[];
    const _mark=(k,ok)=>{ if(ok)_pushed.push(k); };
    // spec.X||fallback - equal iff the fallback did NOT fire. Covers clearing
    // qtyPerSet (row.nosPerSet is retained), clearing skuType (glassSKUType is
    // retained), H=0 coerced to "", ups="" coerced to 1, and the blank-to-""
    // writes that are faithful.
    _mark("H",rowPatch.H===spec.H);
    _mark("ups",rowPatch.ups===spec.ups);
    _mark("product",rowPatch.product===spec.product);
    _mark("qtyPerSet",rowPatch.nosPerSet===spec.qtyPerSet);
    _mark("skuType",rowPatch.glassSKUType===spec.skuType);
    ["board_gsm","spec_bs","spec_bct","spec_ect","reqBoxWt","salesMOQ","volume"]
      .forEach(k=>_mark(k,rowPatch[k]===spec[k]));
    // L/W follow _dimBack: a typed value is always carried, and a BLANK dim is
    // formalised only when nothing derives into it - otherwise the row goes on
    // showing the inherited number and the clear did not take.
    const _dimTook=k=>{
      const cur=spec[k];
      if(cur!==""&&cur!=null)return true;
      const d=_derivedDims[k];
      return d===""||d==null;
    };
    _mark("L",_dimTook("L"));_mark("W",_dimTook("W"));
    // Add-ons are written as +(spec.X||0): blank becomes a real 0 charge, which
    // is the same commercial statement. Only a non-numeric would fail to carry.
    ["printing","stitching","coating","handling","moqCharge","packing","other","unloading"]
      .forEach(k=>_mark(k,Number.isFinite(+(spec[k]||0))));
    // Delta-style writes: the row stores an override only when it differs from
    // the profile, so the EFFECTIVE value is the override or the profile figure.
    const _effMargin=rowPatch.marginOverride!==""?+rowPatch.marginOverride:+profileMarginForRow;
    _mark("margin",+spec.margin===_effMargin);
    // C7a: interest and freightOverride are NOT marked. _pushed exists to
    // advance the REVIEW baseline for fields an edit actually reached the row
    // with, and neither can be edited any more: the review copy carries the
    // row's own figure and no path writes it, so both are equal to their
    // baseline for the life of the review and can never be dirty. Marking a
    // field this Push did not write would be a false clean.
    // Waste/conv: ONE pair per row type. The other pair is never written, so an
    // edit to it can never be formalised from this row.
    const _effWaste=rowPatch.wasteConv_waste!==""?+rowPatch.wasteConv_waste:libWaste;
    const _effConv=rowPatch.wasteConv_conv!==""?+rowPatch.wasteConv_conv:libConv;
    _mark(isPPRowType?"wastePP":"waste",Math.abs(specWaste-_effWaste)<0.001);
    _mark(isPPRowType?"convRatePP":"convRate",Math.abs(specConv-_effConv)<0.001);
    // boxType is deliberately absent: it is Construction-gated below.

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
    // C4: what the REVIEW baseline advances to depends on THIS outcome. Nothing
    // to accept counts as formalised; a declined Construction update does not.
    let constructionFormalised=true;
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
        // Declined. The row-owned changes are written; the shared-Construction
        // differences are NOT, so they stay dirty against the baseline below and
        // exiting still warns about them.
        constructionFormalised=false;
        showToast("✅ Row updated (Construction left unchanged) — run Calculate All to update the rate",'success',5000);
      }
    } else {
      showToast("✅ Pushed to batch row — run Calculate All to update the rate",'success',5000);
    }
    // C4 · P1: stay in REVIEW and advance the baseline to what was actually
    // formalised through Batch Entry — never to whatever is on screen.
    markReviewPushed(_pushed,constructionFormalised);
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
    if(profileDraft!==null&&batchRows.length>0){
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

    // C5: these read the RESOLVED spec, so a Producing Plant owned by the
    // Batch Context satisfies them. Wording follows the Context bar.
    if(!spec.plant)    missing.push("Producing Plant — set it in Batch Context before sending");
    if(!spec.delivery) missing.push("Delivery — set it in Batch Context before sending");
    if(missing.length>0){
      showToast(
        `⚠️ Complete these before sending:\n• ${missing.join("\n• ")}`,
        'error', 7000
      );
      return;
    }

    // ── G1: Identity-first guards — gated on the PROFILE, not the row count ──
    // The TEXTILE/ICECREAM rule: batch-wide identity must match before any numeric
    // delta is computed. A mismatch must never become a row override.
    //
    // D-24: these guards used to fire only when batchRows.length > 0, on the
    // assumption that "no rows" means "no committed profile". That assumption is
    // false. A populated batchProfile with an empty grid IS a batch identity —
    // and before hydrate-on-mount (D-5) it was the state after EVERY reload.
    //
    // With the old condition an empty grid let every mismatch through, and the
    // seeding block below then silently rewrote the profile to the new client and
    // sector. Nothing recorded that it happened: rows carry no client or sector of
    // their own, so a returning Maker could not discover it before or after.
    //
    // RULED: a populated profile is still committed. Ask the profile.
    const _profileHasIdentity=!!(batchProfile.client||batchProfile.sector);
    if(_profileHasIdentity){
      // Normalise: trim + lowercase for reliable comparison (sameClient helper inline)
      const _norm=v=>(v||"").trim().toLowerCase().replace(/\s+/g," ");
      // C5: these four read specRaw, NOT the resolved spec. The resolved spec
      // takes its context from the profile by construction, so comparing it
      // would compare the profile with itself. specRaw is where a value put
      // there by an older persisted draft, a restored backup or a future
      // non-UI path still shows up - exactly what D-24 asked these to catch.
      const _specClient=_norm(specRaw.client);
      const _profClient=_norm(batchProfile.client);
      if(_specClient&&_profClient&&_specClient!==_profClient){
        showToast(
          `❌ Client mismatch — this Costing draft carries "${specRaw.client}" but this Batch is for "${batchProfile.client}".\n\nCosting no longer edits Client. Use New Draft for a different client, Start new SKU to clear this draft, or Edit Batch Profile in Batch Entry.`,
          'error', 9000
        );
        return;
      }
      // Sector, Plant, Delivery — hard block; mismatch must NOT become a row override
      const _specSector=_norm(specRaw.sector);
      const _profSector=_norm(batchProfile.sector);
      if(_specSector&&_profSector&&_specSector!==_profSector){
        showToast(
          `❌ Sector mismatch — this Costing draft carries "${specRaw.sector}" but this Batch Profile is "${batchProfile.sector}".\n\nFix the Batch Profile or start a New Batch.`,
          'error', 9000
        );
        return;
      }
      const _specPlant=_norm(specRaw.plant);
      const _profPlant=_norm(batchProfile.plant);
      if(_specPlant&&_profPlant&&_specPlant!==_profPlant){
        showToast(
          `❌ Plant mismatch — this Costing draft carries "${specRaw.plant}" but this Batch Profile is "${batchProfile.plant}".\n\nFix the Batch Profile or start a New Batch.`,
          'error', 9000
        );
        return;
      }
      const _specDelivery=_norm(specRaw.delivery);
      const _profDelivery=_norm(batchProfile.delivery);
      if(_specDelivery&&_profDelivery&&_specDelivery!==_profDelivery){
        showToast(
          `❌ Delivery mismatch — this Costing draft carries "${specRaw.delivery}" but this Batch Profile is "${batchProfile.delivery}".\n\nFix the Batch Profile or start a New Batch.`,
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
    // D-11: this predicate was the correct one and is now THE shared one.
    // `existingSTD` below is deliberately NOT routed through it — that is the
    // board-specs-match-but-layers-differ case, and its Cancel branch is a
    // SANCTIONED duplication route ruled by the product owner.
    const existingFull=findDuplicate(constructionLib,spec);

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
          // D-11 enabler: which of the four creation paths wrote this entry. Additive
          // only — existing entries are NOT backfilled, so an absent createdVia means
          // "created before the enabler" and never a guessed origin. A timestamp alone
          // would not distinguish the two duplicate hypotheses; the path is what does.
          createdVia:"bridge-send",createdAt:new Date().toISOString(),
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

    // C7a: no interest/freight delta is computed. Both now resolve FROM the
    // batch context this row is being created under, so the delta was
    // structurally zero; computing it would only re-open the possibility of
    // Costing authoring a row override.

    const newRow={
      id:newId,
      matCode,
      product:spec.product||"",
      itemType:newItemType,                       // C3: was hardcoded "Box"
      setCode:spec.setCode||"",   // spec.setCode is single source of truth; blank when switch OFF
      setCodeAssumed:false,
      // D-1: carry the Glass SKU across the naming boundary (Costing: skuType, grid: glassSKUType).
      // Written onto the row being sent, never onto a sibling — seeding the parent Box needs a
      // confirmed Box to already exist, which fails when the Part is sent first. See D-1-follow-up.
      glassSKUType:spec.skuType||"",
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
      // C7a: written as "" - no override. The KEYS stay so a Costing-created
      // row is shaped exactly like every existing one and Batch Entry's own
      // editors (BatchGrid.jsx:727,742) keep working on it unchanged.
      interestOverride:"",
      freightRowOverride:"",
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
    // ── C5 · S5: FIRST SEND ESTABLISHES THE PROFILE FROM THE DRAFT ─────────
    // What stood here re-derived the sector's waste/conv from the master and
    // wrote its own literals, so the profile it established could disagree with
    // the numbers Costing had just displayed and costed. It also carried SITE 4
    // of the inheritance-materialisation pattern (D-9 / D-16).
    //
    // The draft profile IS the authority now: the Context bar wrote it, the
    // resolver costed from it, and it is written through VERBATIM. One state,
    // no re-derivation, nothing to disagree with. S6 above is what keeps this
    // safe - it hard-blocks a new-batch Send while a batch still exists, so this
    // can only ever establish a profile that has none.
    if(profileDraft!==null){
      setBatchProfile(p=>({...p,...profileDraft.values}));
    }

    // A2 (ruling): append the row, stay on Costing with spec retained so the Maker
    // can immediately send the next SET component (Plate, Part-L, Part-W) using
    // the same construction. Do NOT reset spec — that is B3's job only on explicit Unlink.
    // Do NOT set activeBatchRowId — that is REVIEW mode; START mode stays unlinked.
    setBatchRows(prev=>[...prev,newRow]);
    // C5: the draft profile has just been written through, so it is retired and
    // the draft becomes CLEAN against what it produced - the batch row is now
    // the durable record of this spec. Mode returns to same-batch by derivation,
    // because profileDraft is null again.
    markDraftSent();
    const rowNum=batchRows.length+1;
    const constrWasMatched=!!existingFull||(!!constrCode&&!constructionLib.find(c=>c.code===constrCode));
    // Single toast — construction info merged in so the Maker sees one clear signal
    showToast(
      `✅ Row ${rowNum} added to Batch Entry · [${constrCode}] · → switch to Batch Entry tab to verify`,
      'success', 5000
    );
  };



  // ── CROSS-SLICE ACTIONS lifted from BatchProfileBar JSX (Phase 7 prerequisite) ──
  // Both were inline onClick bodies. They are cross-slice, so they belong here
  // rather than travelling into tabs/batch/BatchProfileBar.jsx in 7b.
  //
  // ⚠️ Only the HANDLER BODIES moved. The <button> elements stay in the JSX.
  // The lift had to start at the arrow function, not the line above it: the two
  // preceding lines are closing </div> tags for the Import-from-Costing block,
  // and consuming them leaves the profile bar unbalanced — the silent-deletion
  // failure mode CLAUDE.md warns about.

  // C11 guard lives inside: blocks a Profile import while Costing is in
  // scratchpad (new-batch) context and an old batch still exists.
  const copyCostingToProfile=()=>{
                  // C11: block Profile import when Costing is in scratchpad context and old batch exists
                  if(profileDraft!==null&&batchRows.length>0){
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
  };

  // The most cross-cutting action in the app: TEN setters across four slices
  // (batch, costing, quote items, batch UI) plus INIT_SPEC. Fix 5 also clears
  // Quote Items so a prior customer's data cannot leak into a new batch.
  //
  // ⚠️ See D-2: the confirm text names the profile, SKU rows, results and Quote
  // Items — four things — but setSpec below also discards the Costing
  // scratchpad, unnamed. Recorded, deliberately NOT fixed here (defect freeze).
  const startNewBatch=()=>{
            // Fix 5: also clear Quote Items on New Batch so prior customer's data cannot leak
            // ── D-2: name what CHANGES, not four of ten things ───────────────
            // The old confirm named the profile, rows, results and Quote Items —
            // four state changes out of ten — and stayed silent about setSpec,
            // which discarded the Costing scratchpad. It named what was
            // RECOVERABLE and hid the one thing that was not. Inverted warning.
            //
            // The spec is now preserved (below), so nothing unrecoverable is
            // destroyed and this stops being a last line of defence. It is not
            // merely informational either: the identity freeze releases and any
            // Deep-Dive link breaks, which change what MODE the Maker is in.
            // So: three lines grouped by effect, not ten setter names — a Maker
            // does not know what setSetAutoFill is and should not have to.
            //
            // NO RECOVERABILITY CLAIM. cbb_batch_previous holds the cleared batch
            // but has no reader yet, so from the Maker's position it is gone.
            // An unqualified "recoverable" would invite reliance on a route that
            // does not exist — see D-2's entry and the open item on the archive.
            //
            // The kept client/sector are NAMED because the spec survives now:
            // a stale client can silently seed the next batch's blank profile,
            // and no guard catches it (D-24's cannot — a blank profile has
            // nothing to mismatch against). Mitigation is visibility at the
            // decision point, not a guard. See PM-6.
            // ── C5 · B1 / B2 ────────────────────────────────────────────────
            // B1 - a NEW-BATCH draft is independent of the batch being cleared and
            // is the intended second step before its first Send, so it is
            // preserved unchanged and the confirm says so.
            //
            // B2 - a SAME-BATCH draft takes its whole Batch Context from the
            // profile being cleared, so it belongs to that batch. It is
            // discarded, and the Maker is pointed at New Draft as the way to keep
            // working. This qualifies D-2's spec-preservation for this one path.
            const _isNewBatchDraft=profileDraft!==null;
            const _keepLine=_isNewBatchDraft
              ?"• Keeps your new-batch draft — it is independent of the batch being cleared.\n"
              :"• DISCARDS your Costing draft — it belongs to the batch being cleared. Cancel and use New Draft first if you want to keep it.\n";
            if(!window.confirm(
              "Start a new batch?\n\n"+
              "• Clears the current batch — profile, all SKU rows, results and Quote Items.\n"+
              _keepLine+
              // C6 deleted specCommitted and the identity freeze with it, but this
              // line went on telling the Maker a freeze was being released. It named
              // a mechanism that no longer exists. Unlinking the review is the part
              // that is still true, so that is all it now says.
              "• Returns Costing to same-batch context: any Deep-Dive review is unlinked.\n\n"+
              "OK = Start new batch   |   Cancel = Stay"
            ))return;
            // ── D-5 prerequisite: archive the batch being cleared ────────────────
            // INVARIANT: cbb_batch_previous holds the most recent NON-EMPTY batch
            // cleared by + New Batch. One slot. Nothing else.
            //
            // startNewBatch does NOT clear cbb_batch_autosave. Today the autosave
            // write guard blocks the empty write, so the old rows survive in storage
            // and the recovery banner offers them back — which is the only reason
            // + New Batch is currently recoverable at all (see D-2).
            //
            // Once batchRows hydrates on mount that stops being true: the old rows
            // would load straight back into the grid and + New Batch would appear not
            // to work across a reload. Archiving here keeps the batch recoverable
            // WITHOUT the archive being the live autosave.
            //
            // POLICY — decided, not emergent. Read this before adding to it:
            //   * ONE SLOT. A second + New Batch OVERWRITES this key. It is not a
            //     stack and must not become one — a lone key with no reader grows a
            //     policy by accident otherwise.
            //   * Bounded by one batch. Worst case adds a single batch's storage,
            //     not unbounded growth.
            //   * Absent, unparseable, or zero rows => write NOTHING and leave any
            //     existing archive intact. Never destroy a real earlier archive to
            //     record that there was nothing to archive.
            //   * archivedAt is stamped so this can never be mistaken for the batch
            //     just cleared. The invariant is "the most recent NON-EMPTY batch
            //     cleared by + New Batch", not "the batch cleared by the last click".
            //
            // ⚠️ HALF A DESIGN, DELIBERATELY. The archive exists; the route for a
            // user to reach it does NOT. That is D-2's decision, not this one. Do not
            // leave it unreachable indefinitely — see the open item on D-2.
            try{
              const _prevRaw=getItem('cbb_batch_autosave');
              if(_prevRaw){
                const _prev=JSON.parse(_prevRaw);
                if(_prev?.rows?.length)
                  setItem('cbb_batch_previous',JSON.stringify({..._prev,archivedAt:Date.now()}));
              }
            }catch{ /* unparseable autosave — leave any existing archive intact */ }
            const fresh={client:'',sector:'',plant:'',delivery:'',
              margin:8,marginPP:8,interest:0.5,paymentDisc:'30',freightOverride:'',
              waste:5,convRate:7,wastePP:5,convRatePP:12.5,
              customerType:'existing',priceContext:'unknown'};
            setBatchProfile(fresh);
            // C5 · B2: seed the draft from the `fresh` object we just built, NOT
            // from batchProfile - that state does not update until the next
            // render, so reading it here would seed from the batch being cleared.
            if(!_isNewBatchDraft)resetDraft(specContextOnly(fresh),null);
            setBatchRows([]);
            setBatchResults({});
            setExpandedRows(new Set());
            exitReview(); // C4: leaves REVIEW and restores START's workspace flags
            setItems([]); // Fix 5: clear Quote Items so new customer starts clean
            // C5: setCostingContext("same-batch") was here. Mode is derived from
            // profileDraft now, and B2's resetDraft above already cleared it.
            // ── D-2: the Costing scratchpad SURVIVES ─────────────────────────
            // setSpec({...INIT_SPEC,...}) was here and silently discarded it.
            // C3 MADE THAT SENTENCE FALSE: the spec IS persisted now, under
            // cbb_costing_draft. The original note read "the spec is never
            // persisted anywhere, so that was the one unrecoverable loss".
            // RULED at the time: the spec has nothing to do with the batch.
            //
            // C5 QUALIFIES THAT for one path. A same-batch draft takes its whole
            // Batch Context from the profile being cleared, so it does belong to
            // the batch - see B2 below, which discards it and says so. A
            // new-batch draft is independent and is preserved (B1).
            //
            // setSetAutoFill(true) was here too and is removed as an EXTENSION
            // OF THE SAME RULING, not a separate change: setAutoFill is the
            // "auto-derive SET Code from Mat Code" checkbox in the Costing form
            // (SpecForm.jsx:132) — Costing workspace configuration, the same
            // category as the spec, not batch state. Resetting it would make
            // "keeps your Costing spec" partly false, since a preserved spec
            // would stop behaving the way the Maker left it.
            showToast("✅ New batch started — Costing spec kept",'success');
  };

  return { copyCostingToProfile, discardNewDraft, loadBatchRowIntoCosting, newDraftKeepClient, newDraftNewClient, pushCostingToBatchRow, sendCostingToBatch, specContextOnly, specForNextSku, specFromProfile, startNewBatch, startNewSku };
}
