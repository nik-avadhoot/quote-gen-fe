// ═══════════════════════════════════════════════════════════════════════════
// src/state/costingDraftModel.js — the Costing draft's shape and semantics.
//
// PURE. No React, no storage, no side effects — so scripts/draft-fixtures.mjs
// can exercise it in Node the way scripts/costing-fixtures.mjs exercises the
// engine. useCostingDraft.js is the hook that wires this to state and storage.
//
// THE ENVELOPE IS FIXED FROM C3 ONWARD:
//
//     { v:1, spec, profileDraft:null, baseline }
//
// v:1 keeps this meaning for the rest of the START/REVIEW series. C5 fills
// profileDraft with an object and widens isValidEnvelope accordingly; it does
// NOT bump the version, because the envelope's shape does not change.
//
// C3 owns the shape, the merge and the comparator. It owns no transition:
// nothing here resets a baseline and nothing here prompts. C4 (X1/P1) and C5
// (S1-S3) are the first callers of isDirty.
// ═══════════════════════════════════════════════════════════════════════════

export const DRAFT_KEY='cbb_costing_draft';
export const DRAFT_CORRUPT_KEY='cbb_costing_draft_corrupt';
export const DRAFT_VERSION=1;

// A non-null, non-array object. Arrays are excluded deliberately: an array
// spec would satisfy `typeof x==="object"` and then behave as an object with
// numeric keys, which is corruption that reads as valid.
export const isPlainObject=v=>typeof v==='object'&&v!==null&&!Array.isArray(v);

// ── VALIDATION ────────────────────────────────────────────────────────────
// Malformed is corrupt EVEN WHEN JSON PARSES. A blob that parses to the wrong
// shape is not a draft; treating it as one would put undefined where every
// consumer expects a spec.
export function isValidEnvelope(env){
  if(!isPlainObject(env))return false;
  if(env.v!==DRAFT_VERSION)return false;
  if(!isPlainObject(env.spec))return false;
  if(!isPlainObject(env.baseline))return false;
  // C5 widened this from "only null": a profileDraft is null, or exactly
  // { values, baseline } with both members plain objects. The accepted set only
  // GREW, so every C3/C4 draft (all carry null) stays valid under v:1 with no
  // migration - which is why the version is not bumped.
  if(!isValidProfileDraft(env.profileDraft))return false;
  return true;
}

// ── HYDRATION MERGE ───────────────────────────────────────────────────────
// A stored draft written before a field was added to INIT_SPEC arrives without
// it. This fills those gaps.
//
// WHAT IT GUARANTEES, AND WHAT IT DOES NOT. s() in useCostingDraft accepts
// exactly two path shapes — a top-level key, or `layers.<K>.<field>` — and
// INIT_SPEC has exactly one non-scalar member, `layers`. So a top-level merge
// plus a two-level merge across layers covers every path s() can reach, and
// that is complete FOR THIS SHAPE, not in general.
//
// A shallow top-level merge alone would NOT be sufficient: it replaces
// `layers` wholesale with the stored map, so a layer key added later would be
// absent. That does not throw — {...undefined} is legal, so a write to a
// missing layer silently produces a half-populated {gsm} with no code — which
// is worse than a crash, because nothing announces it.
//
// If a future INIT_SPEC gains a second nested object, or s() gains a third
// path form, this merge stops covering it and must be revisited.
export function mergeSpec(initSpec,saved){
  const src=isPlainObject(saved)?saved:{};
  const initLayers=isPlainObject(initSpec.layers)?initSpec.layers:{};
  const savedLayers=isPlainObject(src.layers)?src.layers:{};
  const layers={...initLayers,...savedLayers};
  Object.keys(layers).forEach(k=>{
    layers[k]={...(isPlainObject(initLayers[k])?initLayers[k]:{}),
               ...(isPlainObject(layers[k])?layers[k]:{})};
  });
  return {...initSpec,...src,layers};
}

// Build the envelope a clean start writes: baseline initialised FROM the
// seeded spec, by value.
export function freshEnvelope(seededSpec){
  return {v:DRAFT_VERSION,spec:seededSpec,profileDraft:null,baseline:seededSpec};
}

// ── SEMANTIC EQUALITY ─────────────────────────────────────────────────────
// STRICT EQUALITY AT EVERY LEAF, WITH ONE EXPLICIT EXCEPTION: two NaNs are
// equal. That exception exists because === says NaN!==NaN, which would make a
// draft holding a NaN permanently dirty against a baseline holding the same
// NaN, with no edit able to clear it.
//
// Nothing else is relaxed. "" , 0, null and undefined are four distinct
// values, and "5" !== 5. Consequences of using === at the leaves:
//
//  · 0 and -0 compare EQUAL (=== says so). Object.is would separate them;
//    the app has no path that produces -0, and treating a signed zero as an
//    edit would be noise.
//  · An ABSENT key and an explicit `undefined` compare EQUAL, because keys are
//    compared by value over the union of both sides. This is deliberate: the
//    merge above materialises keys, and if spec were merged while baseline
//    kept a gap, key presence alone would report dirt nobody created. (Both
//    sides ARE merged in useCostingDraft — this is the second guard, not the
//    first.) `undefined` remains distinct from null, "" and 0.
export function deepEqual(a,b){
  if(a===b)return true;
  if(Number.isNaN(a)&&Number.isNaN(b))return true; // the one exception
  const aArr=Array.isArray(a),bArr=Array.isArray(b);
  if(aArr||bArr){
    if(!aArr||!bArr||a.length!==b.length)return false;
    return a.every((x,i)=>deepEqual(x,b[i]));
  }
  // "" vs 0 vs null vs undefined vs "5" vs 5 all land here and are unequal.
  if(!isPlainObject(a)||!isPlainObject(b))return false;
  const keys=new Set([...Object.keys(a),...Object.keys(b)]);
  for(const k of keys){ if(!deepEqual(a[k],b[k]))return false; }
  return true;
}

// Dirty = the contents materially differ from the baseline. Not touch-tracking.
// NO CALLER IN C3, deliberately: C4's X1 and C5's S1-S3 are the first, and the
// semantics are pinned by scripts/draft-fixtures.mjs before anything depends
// on them.
export function isDirty(current,baseline){
  return !deepEqual(current,baseline);
}

// ── C4 · THE SESSION-ONLY REVIEW COPY ─────────────────────────────────────
// Shape: { rowId, spec, baseline, prev:{ setAutoFill, costingContext } }
//
// Never persisted and never valid as a draft envelope - isValidEnvelope
// rejects it. That proves such a blob could not HYDRATE as a draft; it is not
// a guarantee that no code could ever write one. Only the absence of a write
// path gives that, and useCostingDraft has none.
//
// `prev` carries START's workspace flags across the review, because Deep Dive
// overwrites both (useCostingBatchBridge.js:56 and :58) and nothing restored
// them before C4. specCommitted is deliberately absent: Deep Dive stops
// clearing it, and every reader masks it behind activeBatchRowId
// (SpecForm.jsx:57, :68, :80, :82), so it needs no snapshot.
export function freshReviewCopy(rowId,spec,prev){
  return {rowId,spec,baseline:spec,prev:{...prev}};
}

// ── WHAT PUSH FORMALISES ──────────────────────────────────────────────────
// Shared-Construction fields. These reach the library ONLY when the Maker
// accepts the confirm at useCostingBatchBridge.js:263-286.
//
// boxType is written to the row as well, so it is formalised in one sense
// either way - but the ruling names box type among the shared-Construction
// differences that must stay dirty when the update is declined, and the library
// is where a box type actually lives. It is gated here.
export const PUSH_CONSTRUCTION_FIELDS=['boxType','ply','flute_F1','flute_F2','layers'];

// ── THE PUSHED BASELINE ───────────────────────────────────────────────────
// The baseline must represent the state actually FORMALISED THROUGH BATCH
// ENTRY, never merely what is on screen.
//
// THERE IS DELIBERATELY NO ROW-FIELD LIST HERE. A second list of "fields push
// writes" would be an approximation of pushCostingToBatchRow's rowPatch and
// would drift away from it the first time that patch changes. Instead the
// bridge derives `pushedFields` FROM THE ROWPATCH IT JUST BUILT - comparing
// each persisted value against the spec value it came from - and passes the
// result in. This function only applies it.
//
// A field is advanced only if the row now actually carries the Maker's value.
// An edit that was rejected, replaced by a fallback (spec.qtyPerSet||row.
// nosPerSet), coerced away (spec.H||"" turning 0 into blank), or not written
// for this row type (the Box pair on a PP row) is NOT in pushedFields, so its
// baseline stays put and REVIEW stays dirty. Declining the Construction update
// leaves those five fields dirty the same way, and a later accepting Push is
// what makes REVIEW clean.
export function nextReviewBaseline(prevBaseline,spec,pushedFields,constructionFormalised){
  const next={...prevBaseline};
  (pushedFields||[]).forEach(k=>{
    next[k]=k==='layers'?JSON.parse(JSON.stringify(spec.layers||{})):spec[k];
  });
  if(constructionFormalised){
    PUSH_CONSTRUCTION_FIELDS.forEach(k=>{
      next[k]=k==='layers'?JSON.parse(JSON.stringify(spec.layers||{})):spec[k];
    });
  }
  return next;
}

// ── C5 · THE NEW-BATCH PROFILE DRAFT ──────────────────────────────────────
// Shape: { values, baseline } - both plain objects, or null when Costing is
// attached to the live batch.
//
// This is NOT a second copy of the Batch Profile. It is where the SAME
// batch-level fields live while a new batch is being prepared and no Batch
// Profile exists to hold them yet. At first Send its values are written
// through verbatim and it becomes null.
export const PROFILE_DRAFT_FIELDS=['client','sector','customerType','priceContext',
  'plant','delivery','paymentDisc','interest','freightOverride',
  'waste','convRate','wastePP','convRatePP','margin','marginPP'];

// CONTEXT-ONLY fields: one authority, never mirrored into spec. The resolver in
// useCostingDraft overlays these onto the spec every render, so nothing is
// stored twice and nothing can drift.
export const CONTEXT_ONLY_FIELDS=['client','sector','customerType','priceContext',
  'plant','delivery','paymentDisc'];

// Fields that have BOTH a batch default and a genuine SKU exception. These stay
// in spec. A Context edit advances one ONLY while it is still tracking the old
// default - see advanceOnDefaultChange.
export const SKU_EXCEPTION_FIELDS=['interest','freightOverride',
  'waste','convRate','wastePP','convRatePP','margin'];

export function isValidProfileDraft(pd){
  if(pd===null)return true;
  if(!isPlainObject(pd))return false;
  if(!isPlainObject(pd.values))return false;
  if(!isPlainObject(pd.baseline))return false;
  return true;
}

export function freshProfileDraft(values){
  return {values,baseline:values};
}

// ── THE ADVANCE RULE ──────────────────────────────────────────────────────
// When a Batch default changes, a SKU value follows it ONLY if it was still
// tracking the old default. A value the Maker moved away from is preserved and
// becomes an explicit SKU exception against the new default.
//
// Blank means "inherit", so a blank follows. Comparison is numeric and never
// coerces blank to 0 - that is the whole point of testing blankness first.
export function shouldAdvanceSkuValue(specValue,prevDefault){
  if(specValue===""||specValue===null||specValue===undefined)return true;
  if(prevDefault===""||prevDefault===null||prevDefault===undefined)return false;
  const a=+specValue,b=+prevDefault;
  if(Number.isNaN(a)||Number.isNaN(b))return false;
  return a===b;
}

// ── COMBINED DIRTY ────────────────────────────────────────────────────────
// Dirty spans BOTH stores. profileDraft carries its own baseline so the
// envelope keeps exactly four keys and every C3/C4 draft stays valid.
export function isDraftDirty(spec,baseline,profileDraft){
  if(isDirty(spec,baseline))return true;
  if(profileDraft&&isDirty(profileDraft.values,profileDraft.baseline))return true;
  return false;
}
