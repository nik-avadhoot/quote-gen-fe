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
  if(env.profileDraft!==null)return false; // C3: only null. C5 widens this.
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
